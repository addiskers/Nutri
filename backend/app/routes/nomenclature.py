from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
from app.models.nomenclature import NomenclatureMapping
from app.models.user import User, UserPermissions
from app.dependencies.auth import get_current_user, require_permission
from app.utils.queries import parse_object_id, normalize_pagination
from app.utils.audit import audit_event

router = APIRouter(prefix="/nomenclature", tags=["Nomenclature"])

_edit_nomenclature = require_permission(UserPermissions.EDIT_NOMENCLATURE.value)
_view_nomenclature = require_permission(UserPermissions.VIEW_NOMENCLATURE.value)

class NomenclatureCreate(BaseModel):
    standardized_name: str
    raw_names: List[str] = []

class NomenclatureUpdate(BaseModel):
    standardized_name: Optional[str] = None
    raw_names: Optional[List[str]] = None

class SynonymAdd(BaseModel):
    raw_name: str

@router.post("", response_model=dict)
async def create_nomenclature(
    nomenclature_data: NomenclatureCreate,
    current_user: User = Depends(_edit_nomenclature)
):
    try:
        existing = await NomenclatureMapping.find_one(
            NomenclatureMapping.standardized_name == nomenclature_data.standardized_name
        )
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Nomenclature mapping for '{nomenclature_data.standardized_name}' already exists"
            )

        mapping = NomenclatureMapping(
            standardized_name=nomenclature_data.standardized_name,
            raw_names=nomenclature_data.raw_names,
            created_by=current_user.email
        )
        await mapping.insert()

        audit_event(
            "nomenclature.create",
            actor_id=str(current_user.id),
            actor_role=current_user.role,
            target_type="nomenclature",
            target_id=str(mapping.id),
        )

        return {
            "id": str(mapping.id),
            "standardized_name": mapping.standardized_name,
            "raw_names": mapping.raw_names,
            "created_at": mapping.created_at.isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] create_nomenclature failed: {type(e).__name__}")
        raise HTTPException(
            status_code=500,
            detail="Failed to create nomenclature mapping"
        )

@router.get("", response_model=dict)
async def list_nomenclature(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(_view_nomenclature),
):
    try:
        skip, limit = normalize_pagination(skip, limit, max_limit=200)

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
        print(f"[ERROR] list_nomenclature failed: {type(e).__name__}")
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch nomenclature mappings"
        )

@router.get("/map", response_model=dict)
async def get_nomenclature_map(
    current_user: User = Depends(_view_nomenclature),
):
    """Get all mappings as a dictionary for quick lookup."""
    try:
        mappings = await NomenclatureMapping.find_all().to_list()

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
        print(f"[ERROR] get_nomenclature_map failed: {type(e).__name__}")
        raise HTTPException(
            status_code=500,
            detail="Failed to build nomenclature map"
        )

@router.get("/{mapping_id}", response_model=dict)
async def get_nomenclature(
    mapping_id: str,
    current_user: User = Depends(_view_nomenclature),
):
    try:
        mapping = await NomenclatureMapping.get(parse_object_id(mapping_id, field="mapping_id"))

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
        print(f"[ERROR] get_nomenclature failed: {type(e).__name__}")
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch nomenclature mapping"
        )

@router.put("/{mapping_id}", response_model=dict)
async def update_nomenclature(
    mapping_id: str,
    nomenclature_update: NomenclatureUpdate,
    current_user: User = Depends(_edit_nomenclature)
):
    try:
        mapping = await NomenclatureMapping.get(parse_object_id(mapping_id, field="mapping_id"))

        if not mapping:
            raise HTTPException(status_code=404, detail="Nomenclature mapping not found")

        if nomenclature_update.standardized_name and nomenclature_update.standardized_name != mapping.standardized_name:
            existing = await NomenclatureMapping.find_one(
                NomenclatureMapping.standardized_name == nomenclature_update.standardized_name
            )
            if existing:
                raise HTTPException(
                    status_code=400,
                    detail=f"Nomenclature mapping for '{nomenclature_update.standardized_name}' already exists"
                )

        changed: List[str] = []
        if nomenclature_update.standardized_name is not None:
            mapping.standardized_name = nomenclature_update.standardized_name
            changed.append("standardized_name")
        if nomenclature_update.raw_names is not None:
            mapping.raw_names = nomenclature_update.raw_names
            changed.append("raw_names")

        mapping.updated_at = datetime.utcnow()
        await mapping.save()

        audit_event(
            "nomenclature.update",
            actor_id=str(current_user.id),
            actor_role=current_user.role,
            target_type="nomenclature",
            target_id=str(mapping.id),
            fields=changed,
        )

        return {
            "id": str(mapping.id),
            "standardized_name": mapping.standardized_name,
            "raw_names": mapping.raw_names,
            "updated_at": mapping.updated_at.isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] update_nomenclature failed: {type(e).__name__}")
        raise HTTPException(
            status_code=500,
            detail="Failed to update nomenclature mapping"
        )

@router.post("/{mapping_id}/synonyms", response_model=dict)
async def add_synonym(
    mapping_id: str,
    synonym_data: SynonymAdd,
    current_user: User = Depends(_edit_nomenclature)
):
    try:
        mapping = await NomenclatureMapping.get(parse_object_id(mapping_id, field="mapping_id"))

        if not mapping:
            raise HTTPException(status_code=404, detail="Nomenclature mapping not found")

        if synonym_data.raw_name in mapping.raw_names:
            raise HTTPException(
                status_code=400,
                detail=f"Synonym '{synonym_data.raw_name}' already exists"
            )

        mapping.raw_names.append(synonym_data.raw_name)
        mapping.updated_at = datetime.utcnow()
        await mapping.save()

        audit_event(
            "nomenclature.synonym_add",
            actor_id=str(current_user.id),
            actor_role=current_user.role,
            target_type="nomenclature",
            target_id=str(mapping.id),
        )

        return {
            "id": str(mapping.id),
            "standardized_name": mapping.standardized_name,
            "raw_names": mapping.raw_names,
            "updated_at": mapping.updated_at.isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] add_synonym failed: {type(e).__name__}")
        raise HTTPException(
            status_code=500,
            detail="Failed to add synonym"
        )

@router.delete("/{mapping_id}/synonyms/{raw_name}", response_model=dict)
async def remove_synonym(
    mapping_id: str,
    raw_name: str,
    current_user: User = Depends(_edit_nomenclature)
):
    try:
        mapping = await NomenclatureMapping.get(parse_object_id(mapping_id, field="mapping_id"))

        if not mapping:
            raise HTTPException(status_code=404, detail="Nomenclature mapping not found")

        if raw_name not in mapping.raw_names:
            raise HTTPException(
                status_code=404,
                detail=f"Synonym '{raw_name}' not found"
            )

        mapping.raw_names.remove(raw_name)
        mapping.updated_at = datetime.utcnow()
        await mapping.save()

        audit_event(
            "nomenclature.synonym_remove",
            actor_id=str(current_user.id),
            actor_role=current_user.role,
            target_type="nomenclature",
            target_id=str(mapping.id),
        )

        return {
            "id": str(mapping.id),
            "standardized_name": mapping.standardized_name,
            "raw_names": mapping.raw_names,
            "updated_at": mapping.updated_at.isoformat()
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] remove_synonym failed: {type(e).__name__}")
        raise HTTPException(
            status_code=500,
            detail="Failed to remove synonym"
        )

@router.delete("/{mapping_id}", response_model=dict)
async def delete_nomenclature(
    mapping_id: str,
    current_user: User = Depends(_edit_nomenclature)
):
    try:
        mapping = await NomenclatureMapping.get(parse_object_id(mapping_id, field="mapping_id"))

        if not mapping:
            raise HTTPException(status_code=404, detail="Nomenclature mapping not found")

        standardized_name = mapping.standardized_name
        await mapping.delete()

        audit_event(
            "nomenclature.delete",
            actor_id=str(current_user.id),
            actor_role=current_user.role,
            target_type="nomenclature",
            target_id=str(mapping_id),
        )

        return {
            "message": f"Nomenclature mapping for '{standardized_name}' deleted successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] delete_nomenclature failed: {type(e).__name__}")
        raise HTTPException(
            status_code=500,
            detail="Failed to delete nomenclature mapping"
        )
