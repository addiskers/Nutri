from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
from app.models.category import Category
from app.models.user import User, UserRole
from app.dependencies.auth import get_current_user, require_role
from app.utils.queries import parse_object_id, normalize_pagination
from app.utils.audit import audit_event

router = APIRouter(prefix="/categories", tags=["Categories"])

_admin_or_above = require_role(UserRole.ADMIN)

class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

@router.post("", response_model=dict)
async def create_category(
    category_data: CategoryCreate,
    current_user: User = Depends(_admin_or_above)
):
    try:
        existing = await Category.find_one(Category.name == category_data.name)
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Category '{category_data.name}' already exists"
            )

        category = Category(
            name=category_data.name,
            description=category_data.description,
            created_by=current_user.email
        )
        await category.insert()

        audit_event(
            "category.create",
            actor_id=str(current_user.id),
            actor_role=current_user.role,
            target_type="category",
            target_id=str(category.id),
        )

        return {
            "id": str(category.id),
            "name": category.name,
            "description": category.description,
            "created_at": category.created_at.isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] create_category failed: {type(e).__name__}")
        raise HTTPException(
            status_code=500,
            detail="Failed to create category"
        )

@router.get("", response_model=dict)
async def list_categories(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
):
    try:
        skip, limit = normalize_pagination(skip, limit, max_limit=200)

        categories = await Category.find_all().skip(skip).limit(limit).to_list()
        total = await Category.find_all().count()

        return {
            "categories": [
                {
                    "id": str(cat.id),
                    "name": cat.name,
                    "description": cat.description,
                    "created_at": cat.created_at.isoformat()
                }
                for cat in categories
            ],
            "total": total
        }

    except Exception as e:
        print(f"[ERROR] list_categories failed: {type(e).__name__}")
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch categories"
        )

@router.get("/{category_id}", response_model=dict)
async def get_category(
    category_id: str,
    current_user: User = Depends(get_current_user),
):
    try:
        category = await Category.get(parse_object_id(category_id, field="category_id"))

        if not category:
            raise HTTPException(status_code=404, detail="Category not found")

        return {
            "id": str(category.id),
            "name": category.name,
            "description": category.description,
            "created_at": category.created_at.isoformat(),
            "updated_at": category.updated_at.isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] get_category failed: {type(e).__name__}")
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch category"
        )

@router.put("/{category_id}", response_model=dict)
async def update_category(
    category_id: str,
    category_update: CategoryUpdate,
    current_user: User = Depends(_admin_or_above)
):
    try:
        category = await Category.get(parse_object_id(category_id, field="category_id"))

        if not category:
            raise HTTPException(status_code=404, detail="Category not found")

        if category_update.name and category_update.name != category.name:
            existing = await Category.find_one(Category.name == category_update.name)
            if existing:
                raise HTTPException(
                    status_code=400,
                    detail=f"Category '{category_update.name}' already exists"
                )

        changed: List[str] = []
        if category_update.name is not None:
            category.name = category_update.name
            changed.append("name")
        if category_update.description is not None:
            category.description = category_update.description
            changed.append("description")

        category.updated_at = datetime.utcnow()
        await category.save()

        audit_event(
            "category.update",
            actor_id=str(current_user.id),
            actor_role=current_user.role,
            target_type="category",
            target_id=str(category.id),
            fields=changed,
        )

        return {
            "id": str(category.id),
            "name": category.name,
            "description": category.description,
            "updated_at": category.updated_at.isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] update_category failed: {type(e).__name__}")
        raise HTTPException(
            status_code=500,
            detail="Failed to update category"
        )

@router.delete("/{category_id}", response_model=dict)
async def delete_category(
    category_id: str,
    current_user: User = Depends(_admin_or_above)
):
    try:
        category = await Category.get(parse_object_id(category_id, field="category_id"))

        if not category:
            raise HTTPException(status_code=404, detail="Category not found")

        category_name = category.name
        await category.delete()

        audit_event(
            "category.delete",
            actor_id=str(current_user.id),
            actor_role=current_user.role,
            target_type="category",
            target_id=str(category_id),
        )

        return {
            "message": f"Category '{category_name}' deleted successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] delete_category failed: {type(e).__name__}")
        raise HTTPException(
            status_code=500,
            detail="Failed to delete category"
        )
