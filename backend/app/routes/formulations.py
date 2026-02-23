"""
Saved Formulations API Routes
CRUD operations for saved formulation configurations
"""
from fastapi import APIRouter, HTTPException, status
from typing import Optional
from datetime import datetime
from app.models.formulation import SavedFormulation

router = APIRouter(prefix="/formulations", tags=["Formulations"])


@router.post("/save")
async def save_formulation(data: dict):
    """Save a new formulation"""
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
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/list")
async def list_formulations(skip: int = 0, limit: int = 100):
    """List all saved formulations"""
    try:
        formulations = await SavedFormulation.find(
            SavedFormulation.status == "active"
        ).sort("-created_at").skip(skip).limit(limit).to_list()
        
        total = await SavedFormulation.find(
            SavedFormulation.status == "active"
        ).count()
        
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
