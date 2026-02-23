"""
Nomenclature Mapping Routes - CRUD operations for nutrition name standardization
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
from app.models.nomenclature import NomenclatureMapping
from app.models.user import User
from app.dependencies.auth import get_current_user

router = APIRouter(prefix="/nomenclature", tags=["Nomenclature"])


# Request Schemas
class NomenclatureCreate(BaseModel):
    """Schema for creating a nomenclature mapping"""
    standardized_name: str
    raw_names: List[str] = []


class NomenclatureUpdate(BaseModel):
    """Schema for updating a nomenclature mapping"""
    standardized_name: Optional[str] = None
    raw_names: Optional[List[str]] = None


class SynonymAdd(BaseModel):
    """Schema for adding a single synonym"""
    raw_name: str


# ============================================================
# CREATE
# ============================================================
@router.post("", response_model=dict)
async def create_nomenclature(
    nomenclature_data: NomenclatureCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new nomenclature mapping"""
    try:
        # Check if standardized name already exists
        existing = await NomenclatureMapping.find_one(
            NomenclatureMapping.standardized_name == nomenclature_data.standardized_name
        )
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Nomenclature mapping for '{nomenclature_data.standardized_name}' already exists"
            )
        
        # Create mapping
        mapping = NomenclatureMapping(
            standardized_name=nomenclature_data.standardized_name,
            raw_names=nomenclature_data.raw_names,
            created_by=current_user.email
        )
        await mapping.insert()
        
        return {
            "id": str(mapping.id),
            "standardized_name": mapping.standardized_name,
            "raw_names": mapping.raw_names,
            "created_at": mapping.created_at.isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create nomenclature mapping: {str(e)}"
        )


# ============================================================
# READ
# ============================================================
@router.get("", response_model=dict)
async def list_nomenclature(
    skip: int = 0,
    limit: int = 100
):
    """List all nomenclature mappings"""
    try:
        mappings = await NomenclatureMapping.find_all().skip(skip).limit(limit).to_list()
        total = await NomenclatureMapping.find_all().count()
        
        return {
            "mappings": [
                {
                    "id": str(mapping.id),
                    "standardized_name": mapping.standardized_name,
                    "raw_names": mapping.raw_names,
                    "mapped_terms": len(mapping.raw_names),
                    "created_at": mapping.created_at.isoformat()
                }
                for mapping in mappings
            ],
            "total": total
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch nomenclature mappings: {str(e)}"
        )


@router.get("/map", response_model=dict)
async def get_nomenclature_map():
    """Get all mappings as a dictionary for quick lookup"""
    try:
        mappings = await NomenclatureMapping.find_all().to_list()
        
        # Build reverse map: raw_name -> standardized_name
        nomenclature_map = {}
        for mapping in mappings:
            for raw_name in mapping.raw_names:
                nomenclature_map[raw_name.lower()] = mapping.standardized_name
        
        return {
            "map": nomenclature_map,
            "total_mappings": len(mappings),
            "total_raw_names": len(nomenclature_map)
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to build nomenclature map: {str(e)}"
        )


@router.get("/{mapping_id}", response_model=dict)
async def get_nomenclature(mapping_id: str):
    """Get a specific nomenclature mapping"""
    try:
        from bson import ObjectId
        mapping = await NomenclatureMapping.get(ObjectId(mapping_id))
        
        if not mapping:
            raise HTTPException(status_code=404, detail="Nomenclature mapping not found")
        
        return {
            "id": str(mapping.id),
            "standardized_name": mapping.standardized_name,
            "raw_names": mapping.raw_names,
            "created_at": mapping.created_at.isoformat(),
            "updated_at": mapping.updated_at.isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch nomenclature mapping: {str(e)}"
        )


# ============================================================
# UPDATE
# ============================================================
@router.put("/{mapping_id}", response_model=dict)
async def update_nomenclature(
    mapping_id: str,
    nomenclature_update: NomenclatureUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update a nomenclature mapping"""
    try:
        from bson import ObjectId
        mapping = await NomenclatureMapping.get(ObjectId(mapping_id))
        
        if not mapping:
            raise HTTPException(status_code=404, detail="Nomenclature mapping not found")
        
        # Check for duplicate standardized name if changing it
        if nomenclature_update.standardized_name and nomenclature_update.standardized_name != mapping.standardized_name:
            existing = await NomenclatureMapping.find_one(
                NomenclatureMapping.standardized_name == nomenclature_update.standardized_name
            )
            if existing:
                raise HTTPException(
                    status_code=400,
                    detail=f"Nomenclature mapping for '{nomenclature_update.standardized_name}' already exists"
                )
        
        # Update fields
        if nomenclature_update.standardized_name is not None:
            mapping.standardized_name = nomenclature_update.standardized_name
        if nomenclature_update.raw_names is not None:
            mapping.raw_names = nomenclature_update.raw_names
        
        mapping.updated_at = datetime.utcnow()
        await mapping.save()
        
        return {
            "id": str(mapping.id),
            "standardized_name": mapping.standardized_name,
            "raw_names": mapping.raw_names,
            "updated_at": mapping.updated_at.isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to update nomenclature mapping: {str(e)}"
        )


@router.post("/{mapping_id}/synonyms", response_model=dict)
async def add_synonym(
    mapping_id: str,
    synonym_data: SynonymAdd,
    current_user: User = Depends(get_current_user)
):
    """Add a synonym/raw name to an existing mapping"""
    try:
        from bson import ObjectId
        mapping = await NomenclatureMapping.get(ObjectId(mapping_id))
        
        if not mapping:
            raise HTTPException(status_code=404, detail="Nomenclature mapping not found")
        
        # Check if synonym already exists
        if synonym_data.raw_name in mapping.raw_names:
            raise HTTPException(
                status_code=400,
                detail=f"Synonym '{synonym_data.raw_name}' already exists"
            )
        
        # Add synonym
        mapping.raw_names.append(synonym_data.raw_name)
        mapping.updated_at = datetime.utcnow()
        await mapping.save()
        
        return {
            "id": str(mapping.id),
            "standardized_name": mapping.standardized_name,
            "raw_names": mapping.raw_names,
            "updated_at": mapping.updated_at.isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to add synonym: {str(e)}"
        )


@router.delete("/{mapping_id}/synonyms/{raw_name}", response_model=dict)
async def remove_synonym(
    mapping_id: str,
    raw_name: str,
    current_user: User = Depends(get_current_user)
):
    """Remove a synonym/raw name from a mapping"""
    try:
        from bson import ObjectId
        mapping = await NomenclatureMapping.get(ObjectId(mapping_id))
        
        if not mapping:
            raise HTTPException(status_code=404, detail="Nomenclature mapping not found")
        
        # Check if synonym exists
        if raw_name not in mapping.raw_names:
            raise HTTPException(
                status_code=404,
                detail=f"Synonym '{raw_name}' not found"
            )
        
        # Remove synonym
        mapping.raw_names.remove(raw_name)
        mapping.updated_at = datetime.utcnow()
        await mapping.save()
        
        return {
            "id": str(mapping.id),
            "standardized_name": mapping.standardized_name,
            "raw_names": mapping.raw_names,
            "updated_at": mapping.updated_at.isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to remove synonym: {str(e)}"
        )


# ============================================================
# DELETE
# ============================================================
@router.delete("/{mapping_id}", response_model=dict)
async def delete_nomenclature(
    mapping_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a nomenclature mapping"""
    try:
        from bson import ObjectId
        mapping = await NomenclatureMapping.get(ObjectId(mapping_id))
        
        if not mapping:
            raise HTTPException(status_code=404, detail="Nomenclature mapping not found")
        
        await mapping.delete()
        
        return {
            "message": f"Nomenclature mapping for '{mapping.standardized_name}' deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete nomenclature mapping: {str(e)}"
        )





