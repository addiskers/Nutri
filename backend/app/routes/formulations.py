"""
Saved Formulations API Routes
CRUD operations for saved formulation configurations
"""
from fastapi import APIRouter, HTTPException, status, Depends
from typing import Optional
from datetime import datetime, timezone
from app.models.formulation import SavedFormulation
from app.models.user import User
from app.dependencies.auth import get_current_user, require_permission

router = APIRouter(prefix="/formulations", tags=["Formulations"])


@router.post("/save")
async def save_formulation(
    data: dict,
    current_user: User = Depends(require_permission("use_coa_in_formulation"))
):
    """Save a new formulation (requires use_coa_in_formulation permission)"""
    try:
        name = data.get("name", "").strip()
        if not name:
            raise HTTPException(status_code=400, detail="Formulation name is required")
        
        ingredients = data.get("ingredients", [])
        if not ingredients:
            raise HTTPException(status_code=400, detail="At least one ingredient is required")
        
        serve_size = data.get("serve_size", 30.0)
        nutrient_selections = data.get("nutrient_selections", {})
        custom_values = data.get("custom_values", {})
        created_by = data.get("created_by", "admin")
        
        formulation = SavedFormulation(
            name=name,
            ingredients=ingredients,
            nutrient_selections=nutrient_selections,
            custom_values=custom_values,
            serve_size=serve_size,
            created_by=created_by,
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
        print(f"[ERROR] Save formulation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/list")
async def list_formulations(
    skip: int = 0, 
    limit: int = 100,
    created_by: Optional[str] = None,
    current_user_email: Optional[str] = None,
    is_super_admin: bool = False
):
    """
    List saved formulations
    - Super Admin: sees all formulations, can filter by user
    - Other users: see only their own formulations
    """
    try:
        query_filters = [SavedFormulation.status == "active"]
        
        # If Super Admin and filtering by specific user
        if is_super_admin and created_by:
            query_filters.append(SavedFormulation.created_by == created_by)
        # If not Super Admin, only show user's own formulations
        elif not is_super_admin and current_user_email:
            query_filters.append(SavedFormulation.created_by == current_user_email)
        
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
        print(f"[ERROR] List formulations failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{formulation_id}")
async def get_formulation(formulation_id: str):
    """Get a single saved formulation with full ingredient data"""
    try:
        from bson import ObjectId
        formulation = await SavedFormulation.get(ObjectId(formulation_id))
        
        if not formulation:
            raise HTTPException(status_code=404, detail="Formulation not found")
        
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
        print(f"[ERROR] Get formulation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{formulation_id}")
async def delete_formulation(formulation_id: str):
    """Delete a saved formulation"""
    try:
        from bson import ObjectId
        formulation = await SavedFormulation.get(ObjectId(formulation_id))
        
        if not formulation:
            raise HTTPException(status_code=404, detail="Formulation not found")
        
        await formulation.delete()
        
        return {
            "success": True,
            "message": f"Formulation '{formulation.name}' deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Delete formulation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{formulation_id}/transfer")
async def transfer_formulation(formulation_id: str, data: dict):
    """
    Transfer formulation ownership to another user or multiple users
    
    Request body:
    {
        "target_users": ["user_email1@example.com", "user_email2@example.com"],
        "transfer_type": "copy"  # or "move"
    }
    """
    try:
        from bson import ObjectId
        
        target_users = data.get("target_users", [])
        transfer_type = data.get("transfer_type", "copy")
        
        if not target_users:
            raise HTTPException(status_code=400, detail="At least one target user is required")
        
        if transfer_type not in ["copy", "move"]:
            raise HTTPException(status_code=400, detail="Transfer type must be 'copy' or 'move'")
        
        formulation = await SavedFormulation.get(ObjectId(formulation_id))
        
        if not formulation:
            raise HTTPException(status_code=404, detail="Formulation not found")
        
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
        print(f"[ERROR] Transfer formulation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
