"""
Category Management Routes - CRUD operations for product categories
"""
import logging
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel
from app.models.category import Category
from app.models.user import User
from app.dependencies.auth import get_current_user, require_permission

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/categories", tags=["Categories"])


# Request Schemas
class CategoryCreate(BaseModel):
    """Schema for creating a category"""
    name: str
    description: Optional[str] = None


class CategoryUpdate(BaseModel):
    """Schema for updating a category"""
    name: Optional[str] = None
    description: Optional[str] = None


# ============================================================
# CREATE
# ============================================================
@router.post("", response_model=dict)
async def create_category(
    category_data: CategoryCreate,
    current_user: User = Depends(require_permission("add_products"))
):
    """Create a new category"""
    try:
        # Check if category already exists
        existing = await Category.find_one(Category.name == category_data.name)
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Category '{category_data.name}' already exists"
            )
        
        # Create category
        category = Category(
            name=category_data.name,
            description=category_data.description,
            created_by=current_user.email
        )
        await category.insert()
        
        return {
            "id": str(category.id),
            "name": category.name,
            "description": category.description,
            "created_at": category.created_at.isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to create category: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to create category"
        )


# ============================================================
# READ
# ============================================================
@router.get("", response_model=dict)
async def list_categories(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user)
):
    """List all categories"""
    try:
        limit = min(limit, 200)
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
        logger.error(f"Failed to fetch categories: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch categories"
        )


@router.get("/{category_id}", response_model=dict)
async def get_category(category_id: str, current_user: User = Depends(get_current_user)):
    """Get a specific category"""
    try:
        from bson import ObjectId
        category = await Category.get(ObjectId(category_id))
        
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
        logger.error(f"Failed to fetch category: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch category"
        )


# ============================================================
# UPDATE
# ============================================================
@router.put("/{category_id}", response_model=dict)
async def update_category(
    category_id: str,
    category_update: CategoryUpdate,
    current_user: User = Depends(require_permission("edit_products"))
):
    """Update a category"""
    try:
        from bson import ObjectId
        category = await Category.get(ObjectId(category_id))
        
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")
        
        # Check for duplicate name if changing name
        if category_update.name and category_update.name != category.name:
            existing = await Category.find_one(Category.name == category_update.name)
            if existing:
                raise HTTPException(
                    status_code=400,
                    detail=f"Category '{category_update.name}' already exists"
                )
        
        # Update fields
        if category_update.name is not None:
            category.name = category_update.name
        if category_update.description is not None:
            category.description = category_update.description
        
        category.updated_at = datetime.now(timezone.utc)
        await category.save()
        
        return {
            "id": str(category.id),
            "name": category.name,
            "description": category.description,
            "updated_at": category.updated_at.isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update category: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to update category"
        )


# ============================================================
# DELETE
# ============================================================
@router.delete("/{category_id}", response_model=dict)
async def delete_category(
    category_id: str,
    current_user: User = Depends(require_permission("delete_products"))
):
    """Delete a category"""
    try:
        from bson import ObjectId
        category = await Category.get(ObjectId(category_id))
        
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")
        
        await category.delete()
        
        return {
            "message": f"Category '{category.name}' deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete category: {e}")
        raise HTTPException(
            status_code=500,
            detail="Failed to delete category"
        )





