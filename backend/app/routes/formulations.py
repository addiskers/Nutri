from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime
from app.models.user import User, UserRole
from app.models.formulation import SavedFormulation
from app.dependencies.auth import get_current_user
from app.utils.queries import parse_object_id, normalize_pagination
from app.utils.audit import audit_event

router = APIRouter(prefix="/formulations", tags=["Formulations"])

def _is_admin(user: User) -> bool:
    return user.role in (UserRole.ADMIN, UserRole.SUPER_ADMIN)

def _owns(user: User, formulation: SavedFormulation) -> bool:
    return (formulation.created_by or "").lower() == (user.email or "").lower()

@router.post("/save")
async def save_formulation(
    data: dict,
    current_user: User = Depends(get_current_user),
):
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

        formulation = SavedFormulation(
            name=name,
            ingredients=ingredients,
            nutrient_selections=nutrient_selections,
            custom_values=custom_values,
            serve_size=serve_size,
            created_by=current_user.email,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
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
        raise HTTPException(status_code=500, detail="Failed to save formulation")

@router.get("/list")
async def list_formulations(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_user),
):
    """Non-admins only see formulations they created; admins see everything."""
    try:
        skip, limit = normalize_pagination(skip, limit, max_limit=100)

        base = SavedFormulation.find(SavedFormulation.status == "active")
        if not _is_admin(current_user):
            base = SavedFormulation.find(
                SavedFormulation.status == "active",
                SavedFormulation.created_by == current_user.email,
            )

        formulations = await base.sort("-created_at").skip(skip).limit(limit).to_list()
        total = await base.count()

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
        raise HTTPException(status_code=500, detail="Failed to list formulations")

@router.get("/{formulation_id}")
async def get_formulation(
    formulation_id: str,
    current_user: User = Depends(get_current_user),
):
    try:
        oid = parse_object_id(formulation_id, field="formulation_id")
        formulation = await SavedFormulation.get(oid)

        if not formulation:
            raise HTTPException(status_code=404, detail="Formulation not found")

        if not _is_admin(current_user) and not _owns(current_user, formulation):
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
        raise HTTPException(status_code=500, detail="Failed to fetch formulation")

@router.delete("/{formulation_id}")
async def delete_formulation(
    formulation_id: str,
    current_user: User = Depends(get_current_user),
):
    try:
        oid = parse_object_id(formulation_id, field="formulation_id")
        formulation = await SavedFormulation.get(oid)

        if not formulation:
            raise HTTPException(status_code=404, detail="Formulation not found")

        if not _is_admin(current_user) and not _owns(current_user, formulation):
            raise HTTPException(status_code=404, detail="Formulation not found")

        target_name = formulation.name
        await formulation.delete()

        audit_event(
            "formulation.delete",
            actor_id=str(current_user.id),
            actor_role=current_user.role,
            target_type="formulation",
            target_id=str(oid),
        )

        return {
            "success": True,
            "message": f"Formulation '{target_name}' deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] delete_formulation failed: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Failed to delete formulation")
