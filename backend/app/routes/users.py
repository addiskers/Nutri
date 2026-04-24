"""
User Management Routes - CRUD operations for user management
"""
from fastapi import APIRouter, HTTPException, status, Depends, Request
from typing import List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel, EmailStr, Field
from app.models.user import User, UserRole, UserPermissions, ROLE_PERMISSIONS
from app.schemas.auth import UserResponse, MessageResponse
from app.dependencies.auth import get_current_user, require_permission as _require_permission_dep
from app.utils.security import hash_password, validate_password_strength
from app.utils.audit import log_event
from app.middleware.security import limiter
import logging
import re

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["User Management"])

MAX_PAGE_SIZE = 200


class UserCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=12, max_length=128)
    department: Optional[str] = Field(None, max_length=100)
    role: UserRole = UserRole.RESEARCHER


class UserUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    department: Optional[str] = Field(None, max_length=100)
    role: Optional[UserRole] = None
    permissions: Optional[List[str]] = None


class UserListResponse(BaseModel):
    users: List[UserResponse]
    total: int
    page: int
    page_size: int


def _check_permission(user: User, permission: str):
    if not user.has_permission(permission):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You don't have permission to {permission}"
        )


def _require_admin(user: User):
    """Require Admin or Super Admin role."""
    if user.role not in (UserRole.ADMIN, UserRole.SUPER_ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )


@router.get("", response_model=UserListResponse)
@limiter.limit("30/minute")
async def list_users(
    request: Request,
    page: int = 1,
    page_size: int = 50,
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    is_approved: Optional[bool] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """
    List all users with pagination and filters
    
    - **page**: Page number (default: 1)
    - **page_size**: Items per page (default: 50)
    - **role**: Filter by role
    - **is_active**: Filter by active status
    - **is_approved**: Filter by approval status
    - **search**: Search by name or email
    
    Requires: view_users permission + Admin role
    """
    _check_permission(current_user, "view_users")
    _require_admin(current_user)

    page_size = min(page_size, MAX_PAGE_SIZE)

    query_filters = []

    if role:
        query_filters.append(User.role == role)
    if is_active is not None:
        query_filters.append(User.is_active == is_active)
    if is_approved is not None:
        query_filters.append(User.is_approved == is_approved)

    if search:
        search = search[:200]  # Limit search length to prevent performance issues
        safe_search = re.escape(search)
        search_regex = {"$regex": safe_search, "$options": "i"}
        query_filters.append(
            {"$or": [{"name": search_regex}, {"email": search_regex}]}
        )

    if query_filters:
        total = await User.find(*query_filters).count()
        users_query = User.find(*query_filters)
    else:
        total = await User.count()
        users_query = User.find()

    skip = (page - 1) * page_size
    users = await users_query.skip(skip).limit(page_size).to_list()

    return UserListResponse(
        users=[UserResponse.from_user(u) for u in users],
        total=total,
        page=page,
        page_size=page_size
    )


@router.get("/pending", response_model=List[UserResponse])
@limiter.limit("30/minute")
async def get_pending_users(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """
    Get all users pending approval

    Requires: view_users permission + Admin role
    """
    _check_permission(current_user, "view_users")
    _require_admin(current_user)

    pending_users = await User.find(User.is_approved == False).to_list()
    return [UserResponse.from_user(u) for u in pending_users]


@router.get("/stats/summary")
@limiter.limit("30/minute")
async def get_user_stats(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """
    Get user statistics summary

    Requires: view_users permission + Admin role
    """
    _check_permission(current_user, "view_users")
    _require_admin(current_user)

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
    """
    Get user by ID

    - Researchers can only view their own profile
    - Admins/Super Admins can view any user
    """
    _check_permission(current_user, "view_users")

    # Researchers can only access their own profile
    if current_user.role == UserRole.RESEARCHER and str(current_user.id) != user_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own profile"
        )

    user = await User.get(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    return UserResponse.from_user(user)


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
async def create_user(
    request: Request,
    user_data: UserCreateRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Create a new user (Admin only)
    
    - **name**: User's full name
    - **email**: Valid email address (must be unique)
    - **password**: Minimum 8 characters with uppercase, lowercase, and numbers
    - **department**: Optional department name
    - **role**: User role (default: Researcher)
    
    Requires: add_users permission
    """
    _check_permission(current_user, "add_users")
    
    # Only Super Admin can create Super Admin users
    if user_data.role == UserRole.SUPER_ADMIN and current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Admins can create Super Admin users"
        )
    
    # Validate password strength
    is_valid, error_msg = validate_password_strength(user_data.password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_msg
        )
    
    # Check if email already exists
    existing_user = await User.find_one(User.email == user_data.email)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create new user
    hashed_password = hash_password(user_data.password)
    
    new_user = User(
        name=user_data.name,
        email=user_data.email,
        hashed_password=hashed_password,
        department=user_data.department,
        role=user_data.role,
        is_active=True,
        is_verified=True,
        is_approved=True,  # Admin-created users are auto-approved
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    
    # Set permissions based on role
    new_user.update_permissions_by_role()
    
    # Save to database
    await new_user.insert()
    
    logger.info("New user created by admin (role=%s)", new_user.role)
    log_event("USER_CREATE", user_id=str(current_user.id), user_email=current_user.email, target_id=str(new_user.id), detail=f"role={new_user.role}")
    
    return UserResponse.from_user(new_user)


@router.put("/{user_id}", response_model=UserResponse)
@limiter.limit("10/minute")
async def update_user(
    request: Request,
    user_id: str,
    user_data: UserUpdateRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Update user details
    
    Requires: edit_users permission
    """
    _check_permission(current_user, "edit_users")
    
    # Get user to update
    user = await User.get(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Only Super Admin can modify Super Admin users
    if user.role == UserRole.SUPER_ADMIN and current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Admins can modify Super Admin users"
        )
    
    # Only Super Admin can assign Super Admin role
    if user_data.role == UserRole.SUPER_ADMIN and current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Admins can assign Super Admin role"
        )
    
    # Update fields
    if user_data.name:
        user.name = user_data.name
    if user_data.department is not None:
        user.department = user_data.department
    if user_data.role:
        user.role = user_data.role
        user.update_permissions_by_role()  # Update permissions based on new role
    if user_data.permissions:
        # Custom permissions (requires manage_permissions)
        if not current_user.has_permission("manage_permissions"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to manage permissions"
            )
        # Validate against allowed permission values
        allowed_perms = {p.value for p in UserPermissions}
        invalid = [p for p in user_data.permissions if p not in allowed_perms]
        if invalid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid permissions: {', '.join(invalid)}"
            )
        user.permissions = user_data.permissions
    
    user.updated_at = datetime.now(timezone.utc)
    await user.save()
    
    logger.info("User updated by admin")
    log_event("USER_UPDATE", user_id=str(current_user.id), user_email=current_user.email, target_id=str(user.id))
    
    return UserResponse.from_user(user)


@router.patch("/{user_id}/approve", response_model=UserResponse)
async def approve_user(
    user_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Approve a pending user

    Requires: edit_users permission + Admin role
    """
    _check_permission(current_user, "edit_users")
    _require_admin(current_user)

    # Get user to approve
    user = await User.get(user_id)
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
    
    # Approve user
    user.is_approved = True
    user.updated_at = datetime.now(timezone.utc)
    await user.save()
    
    logger.info("User approved")
    log_event("USER_APPROVE", user_id=str(current_user.id), user_email=current_user.email, target_id=str(user.id))
    
    # TODO: Send approval email to user
    
    return UserResponse.from_user(user)


@router.patch("/{user_id}/toggle", response_model=UserResponse)
async def toggle_user_status(
    user_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Toggle user active/inactive status

    Requires: edit_users permission + Admin role
    """
    _check_permission(current_user, "edit_users")
    _require_admin(current_user)

    # Get user
    user = await User.get(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Prevent self-deactivation
    if str(user.id) == str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot deactivate your own account"
        )
    
    # Only Super Admin can deactivate Super Admin users
    if user.role == UserRole.SUPER_ADMIN and current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Admins can deactivate Super Admin users"
        )
    
    # Toggle status
    user.is_active = not user.is_active
    user.updated_at = datetime.now(timezone.utc)
    await user.save()
    
    status_str = "activated" if user.is_active else "deactivated"
    logger.info("User %s", status_str)
    log_event("USER_TOGGLE", user_id=str(current_user.id), user_email=current_user.email, target_id=str(user.id), detail=status_str)
    
    return UserResponse.from_user(user)


@router.delete("/{user_id}", response_model=MessageResponse)
@limiter.limit("10/minute")
async def delete_user(
    request: Request,
    user_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Delete a user (Super Admin only)
    
    Requires: delete_users permission + Super Admin role
    """
    _check_permission(current_user, "delete_users")
    
    if current_user.role != UserRole.SUPER_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Super Admins can delete users"
        )
    
    # Get user
    user = await User.get(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Prevent self-deletion
    if str(user.id) == str(current_user.id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own account"
        )
    
    # Delete user
    await user.delete()
    
    logger.info("User deleted")
    log_event("USER_DELETE", user_id=str(current_user.id), user_email=current_user.email, target_id=str(user.id), detail=user.email)
    
    return MessageResponse(
        message=f"User {user.name} has been deleted successfully",
        success=True
    )



