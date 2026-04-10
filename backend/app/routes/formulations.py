"""
Saved Formulations API Routes
CRUD operations for saved formulation configurations
"""
import logging
from fastapi import APIRouter, HTTPException, status, Depends
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone
from pydantic import BaseModel, Field
from app.models.formulation import SavedFormulation
from app.models.user import User, UserRole
from app.dependencies.auth import get_current_user, require_permission

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/formulations", tags=["Formulations"])

MAX_PAGE_SIZE = 200
MAX_TARGET_USERS = 50


class SaveFormulationRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    ingredients: List[Dict[str, Any]] = Field(..., min_length=1, max_length=500)
    serve_size: float = Field(default=30.0, ge=0, le=100000)
    nutrient_selections: Dict[str, Any] = Field(default_factory=dict)
    custom_values: Dict[str, Any] = Field(default_factory=dict)


class TransferFormulationRequest(BaseModel):
    target_users: List[str] = Field(..., min_length=1, max_length=MAX_TARGET_USERS)
    transfer_type: str = Field(default="copy", pattern=r"^(copy|move)$")


@router.post("/save")
async def save_formulation(
    data: SaveFormulationRequest,
    current_user: User = Depends(require_permission("use_coa_in_formulation"))
):
    """Save a new formulation (requires use_coa_in_formulation permission)"""
    try:
        name = data.name.strip()
        ingredients = data.ingredients
        serve_size = data.serve_size
        nutrient_selections = data.nutrient_selections
        custom_values = data.custom_values
        
        formulation = SavedFormulation(
            name=name,
            ingredients=ingredients,
            nutrient_selections=nutrient_selections,
            custom_values=custom_values,
            serve_size=serve_size,
            created_by=current_user.email,
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
            status="active"
        )
        
        await formulation.insert()
        
        return {
            "success": True,
            "message": f"Formulation '{name}' saved successfully",
            "id": str(formulation.id)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Save formulation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to save formulation")


@router.get("/list")
async def list_formulations(
    skip: int = 0, 
    limit: int = 100,
    created_by: Optional[str] = None,
    current_user: User = Depends(get_current_user)
):
    """
    List saved formulations.
    Super Admin sees all; others see only their own.
    """
    try:
        limit = min(limit, MAX_PAGE_SIZE)
        is_super_admin = current_user.role == UserRole.SUPER_ADMIN
        query_filters = [SavedFormulation.status == "active"]
        
        if is_super_admin and created_by:
            query_filters.append(SavedFormulation.created_by == created_by)
        elif not is_super_admin:
            query_filters.append(SavedFormulation.created_by == current_user.email)
        
        formulations = await SavedFormulation.find(*query_filters).sort("-created_at").skip(skip).limit(limit).to_list()
        total = await SavedFormulation.find(*query_filters).count()
        
        result = []
        for f in formulations:
            result.append({
                "id": str(f.id),
                "name": f.name,
                "ingredients_count": len(f.ingredients),
                "serve_size": f.serve_size,
                "created_by": f.created_by or "admin",
                "created_at": f.created_at.isoformat() if f.created_at else None,
                "updated_at": f.updated_at.isoformat() if f.updated_at else None,
            })
        
        return {
            "formulations": result,
            "total": total
        }
    except Exception as e:
        logger.error(f"List formulations failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to list formulations")


@router.get("/{formulation_id}")
async def get_formulation(
    formulation_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get a single saved formulation with full ingredient data"""
    try:
        from bson import ObjectId
        formulation = await SavedFormulation.get(ObjectId(formulation_id))
        
        if not formulation:
            raise HTTPException(status_code=404, detail="Formulation not found")
        
        is_super_admin = current_user.role == UserRole.SUPER_ADMIN
        if not is_super_admin and formulation.created_by != current_user.email:
            raise HTTPException(status_code=403, detail="Access denied")
        
        return {
            "id": str(formulation.id),
            "name": formulation.name,
            "ingredients": formulation.ingredients,
            "nutrient_selections": formulation.nutrient_selections or {},
            "custom_values": formulation.custom_values or {},
            "serve_size": formulation.serve_size,
            "created_by": formulation.created_by or "admin",
            "created_at": formulation.created_at.isoformat() if formulation.created_at else None,
            "updated_at": formulation.updated_at.isoformat() if formulation.updated_at else None,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Get formulation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to get formulation")


@router.delete("/{formulation_id}")
async def delete_formulation(
    formulation_id: str,
    current_user: User = Depends(require_permission("use_coa_in_formulation"))
):
    """Delete a saved formulation (owner or Super Admin only)"""
    try:
        from bson import ObjectId
        formulation = await SavedFormulation.get(ObjectId(formulation_id))
        
        if not formulation:
            raise HTTPException(status_code=404, detail="Formulation not found")
        
        is_super_admin = current_user.role == UserRole.SUPER_ADMIN
        if not is_super_admin and formulation.created_by != current_user.email:
            raise HTTPException(status_code=403, detail="Access denied")
        
        await formulation.delete()
        
        return {
            "success": True,
            "message": f"Formulation '{formulation.name}' deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Delete formulation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete formulation")


@router.post("/{formulation_id}/transfer")
async def transfer_formulation(
    formulation_id: str,
    data: TransferFormulationRequest,
    current_user: User = Depends(require_permission("use_coa_in_formulation"))
):
    """
    Transfer formulation ownership to another user or multiple users.
    Only owner or Super Admin can transfer.
    """
    try:
        from bson import ObjectId

        target_users = data.target_users
        transfer_type = data.transfer_type
        
        formulation = await SavedFormulation.get(ObjectId(formulation_id))
        
        if not formulation:
            raise HTTPException(status_code=404, detail="Formulation not found")
        
        is_super_admin = current_user.role == UserRole.SUPER_ADMIN
        if not is_super_admin and formulation.created_by != current_user.email:
            raise HTTPException(status_code=403, detail="Access denied")
        
        transferred_count = 0
        
        for target_user in target_users:
            new_formulation = SavedFormulation(
                name=formulation.name,
                ingredients=formulation.ingredients,
                nutrient_selections=formulation.nutrient_selections or {},
                custom_values=formulation.custom_values or {},
                serve_size=formulation.serve_size,
                created_by=target_user,
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
                status="active"
            )
            
            await new_formulation.insert()
            transferred_count += 1
        
        if transfer_type == "move":
            await formulation.delete()
            message = f"Formulation '{formulation.name}' moved to {transferred_count} user(s)"
        else:
            message = f"Formulation '{formulation.name}' copied to {transferred_count} user(s)"
        
        return {
            "success": True,
            "message": message,
            "transferred_count": transferred_count
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Transfer formulation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to transfer formulation")
