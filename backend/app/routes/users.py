from fastapi import APIRouter, HTTPException, status, Depends
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr, field_validator
from app.models.user import User, UserRole, UserPermissions, ROLE_PERMISSIONS
from app.schemas.auth import UserResponse, MessageResponse
from app.dependencies.auth import get_current_user
from app.utils.security import hash_password, validate_password_strength
from app.utils.queries import safe_regex, parse_object_id, normalize_page
from app.utils.audit import audit_event
from app.utils.email import _mask_email


router = APIRouter(prefix="/users", tags=["User Management"])


_VALID_PERMISSIONS = {p.value for p in UserPermissions}


class UserCreateRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    department: Optional[str] = None
    role: UserRole = UserRole.RESEARCHER


class UserUpdateRequest(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    role: Optional[UserRole] = None
    permissions: Optional[List[str]] = None

    @field_validator("permissions")
    @classmethod
    def _validate_permissions(cls, v):
        # Reject anything not in UserPermissions so callers with
        # manage_permissions can't invent permissions ROLE_PERMISSIONS
        # doesn't know about.
        if v is None:
            return v
        invalid = [p for p in v if p not in _VALID_PERMISSIONS]
        if invalid:
            raise ValueError(f"Unknown permission(s): {', '.join(sorted(set(invalid)))}")
        seen = set()
        return [p for p in v if not (p in seen or seen.add(p))]


class UserListResponse(BaseModel):
    users: List[UserResponse]
    total: int
    page: int
    page_size: int


def require_permission(user: User, permission: str):
    if not user.has_permission(permission):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You don't have permission to {permission}"
        )


@router.get("", response_model=UserListResponse)
async def list_users(
    page: int = 1,
    page_size: int = 50,
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    is_approved: Optional[bool] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """List users with pagination, role/status filters, and DB-level search.

    Requires: view_users permission
    """
    require_permission(current_user, UserPermissions.VIEW_USERS.value)

    page, page_size = normalize_page(page, page_size)

    mongo_query: dict = {}
    if role:
        mongo_query["role"] = role
    if is_active is not None:
        mongo_query["is_active"] = is_active
    if is_approved is not None:
        mongo_query["is_approved"] = is_approved
    if search:
        escaped = safe_regex(search)
        if escaped:
            search_clause = {
                "$or": [
                    {"name": {"$regex": escaped, "$options": "i"}},
                    {"email": {"$regex": escaped, "$options": "i"}},
                ]
            }
            if mongo_query:
                mongo_query = {"$and": [mongo_query, search_clause]}
            else:
                mongo_query = search_clause

    total = await User.find(mongo_query).count()
    skip = (page - 1) * page_size
    users = await User.find(mongo_query).skip(skip).limit(page_size).to_list()

    return UserListResponse(
        users=[UserResponse.from_user(u) for u in users],
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/pending", response_model=List[UserResponse])
async def get_pending_users(
    current_user: User = Depends(get_current_user)
):
    require_permission(current_user, UserPermissions.VIEW_USERS.value)
    pending_users = await User.find(User.is_approved == False).to_list()
    return [UserResponse.from_user(u) for u in pending_users]


# NOTE: must be declared before `GET /{user_id}` — otherwise FastAPI matches
# "stats" as a user_id and the ObjectId parser 400s.
@router.get("/stats/summary")
async def get_user_stats(
    current_user: User = Depends(get_current_user)
):
    require_permission(current_user, UserPermissions.VIEW_USERS.value)

    total_users = await User.count()
    active_users = await User.find(User.is_active == True).count()
    pending_approval = await User.find(User.is_approved == False).count()

    super_admins = await User.find(User.role == UserRole.SUPER_ADMIN).count()
    admins = await User.find(User.role == UserRole.ADMIN).count()
    researchers = await User.find(User.role == UserRole.RESEARCHER).count()

    return {
        "total_users": total_users,
        "active_users": active_users,
        "inactive_users": total_users - active_users,
        "pending_approval": pending_approval,
        "by_role": {
            "super_admin": super_admins,
            "admin": admins,
            "researcher": researchers
        }
    }


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    current_user: User = Depends(get_current_user)
):
    require_permission(current_user, UserPermissions.VIEW_USERS.value)

    user = await User.get(parse_object_id(user_id, field="user_id"))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return UserResponse.from_user(user)


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreateRequest,
    current_user: User = Depends(get_current_user)
):
    require_permission(current_user, UserPermissions.ADD_USERS.value)

    if user_data.role == UserRole.SUPER_ADMIN and current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Admins can create Super Admin users"
        )

    is_valid, error_msg = validate_password_strength(user_data.password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )

    existing_user = await User.find_one(User.email == user_data.email.lower())
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    hashed_password = hash_password(user_data.password)

    new_user = User(
        name=user_data.name,
        email=user_data.email.lower(),
        hashed_password=hashed_password,
        department=user_data.department,
        role=user_data.role,
        is_active=True,
        is_verified=True,
        is_approved=True,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow()
    )
    new_user.update_permissions_by_role()
    await new_user.insert()

    # Mask email in logs; full email retrievable via user_id if needed.
    print(f"[INFO] User created by actor={current_user.id} target={_mask_email(new_user.email)} role={new_user.role}")

    audit_event(
        "user.create",
        actor_id=str(current_user.id),
        actor_role=current_user.role,
        target_type="user",
        target_id=str(new_user.id),
        role=new_user.role,
    )

    return UserResponse.from_user(new_user)


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    user_data: UserUpdateRequest,
    current_user: User = Depends(get_current_user)
):
    require_permission(current_user, UserPermissions.EDIT_USERS.value)

    user = await User.get(parse_object_id(user_id, field="user_id"))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if user.role == UserRole.SUPER_ADMIN and current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Admins can modify Super Admin users"
        )

    if user_data.role == UserRole.SUPER_ADMIN and current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Admins can assign Super Admin role"
        )

    changed_fields: List[str] = []

    if user_data.name:
        user.name = user_data.name
        changed_fields.append("name")
    if user_data.department is not None:
        user.department = user_data.department
        changed_fields.append("department")
    if user_data.role:
        user.role = user_data.role
        user.update_permissions_by_role()
        changed_fields.append("role")
    if user_data.permissions is not None:
        if not current_user.has_permission(UserPermissions.MANAGE_PERMISSIONS.value):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to manage permissions"
            )
        # Validator already ensured entries are valid UserPermissions values.
        user.permissions = user_data.permissions
        changed_fields.append("permissions")

    user.updated_at = datetime.utcnow()
    await user.save()

    print(f"[INFO] User updated by actor={current_user.id} target={_mask_email(user.email)} fields={changed_fields}")

    audit_event(
        "user.update",
        actor_id=str(current_user.id),
        actor_role=current_user.role,
        target_type="user",
        target_id=str(user.id),
        fields=changed_fields,
    )

    return UserResponse.from_user(user)


@router.patch("/{user_id}/approve", response_model=UserResponse)
async def approve_user(
    user_id: str,
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Admins can approve users"
        )

    user = await User.get(parse_object_id(user_id, field="user_id"))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if user.is_approved:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already approved"
        )

    user.is_approved = True
    user.updated_at = datetime.utcnow()
    await user.save()

    print(f"[INFO] User approved by actor={current_user.id} target={_mask_email(user.email)}")

    audit_event(
        "user.approve",
        actor_id=str(current_user.id),
        actor_role=current_user.role,
        target_type="user",
        target_id=str(user.id),
    )

    return UserResponse.from_user(user)


@router.patch("/{user_id}/toggle", response_model=UserResponse)
async def toggle_user_status(
    user_id: str,
    current_user: User = Depends(get_current_user)
):
    require_permission(current_user, UserPermissions.EDIT_USERS.value)

    user = await User.get(parse_object_id(user_id, field="user_id"))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if str(user.id) == str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate your own account"
        )

    if user.role == UserRole.SUPER_ADMIN and current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Admins can deactivate Super Admin users"
        )

    user.is_active = not user.is_active
    user.updated_at = datetime.utcnow()
    # Deactivating a user should immediately invalidate any live sessions.
    # Re-activating is harmless: the bumped version rolls forward so callers
    # must re-authenticate.
    if not user.is_active:
        user.token_version = (user.token_version or 0) + 1
    await user.save()

    state = "activated" if user.is_active else "deactivated"
    print(f"[INFO] User {state} by actor={current_user.id} target={_mask_email(user.email)}")

    audit_event(
        "user.toggle_active",
        actor_id=str(current_user.id),
        actor_role=current_user.role,
        target_type="user",
        target_id=str(user.id),
        is_active=user.is_active,
    )

    return UserResponse.from_user(user)


@router.delete("/{user_id}", response_model=MessageResponse)
async def delete_user(
    user_id: str,
    current_user: User = Depends(get_current_user)
):
    require_permission(current_user, UserPermissions.DELETE_USERS.value)

    if current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Admins can delete users"
        )

    user = await User.get(parse_object_id(user_id, field="user_id"))
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if str(user.id) == str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own account"
        )

    target_id = str(user.id)
    target_email_masked = _mask_email(user.email)
    await user.delete()

    print(f"[INFO] User deleted by actor={current_user.id} target={target_email_masked}")

    audit_event(
        "user.delete",
        actor_id=str(current_user.id),
        actor_role=current_user.role,
        target_type="user",
        target_id=target_id,
    )

    return MessageResponse(
        message=f"User {user.name} has been deleted successfully",
        success=True
    )
