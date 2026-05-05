"""
COA Nomenclature Mapping Routes - CRUD for COA-specific nutrient name standardization
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel, Field
from app.models.coa_nomenclature import COANomenclatureMapping
from app.models.user import User
from app.dependencies.auth import require_permission
from app.utils.queries import parse_object_id, safe_regex, normalize_pagination

router = APIRouter(prefix="/coa-nomenclature", tags=["COA Nomenclature"])


class COANomenclatureCreate(BaseModel):
    standardized_name: str
    raw_names: List[str] = []
    target_unit: Optional[str] = None
    category: Optional[str] = None


class COANomenclatureUpdate(BaseModel):
    standardized_name: Optional[str] = None
    raw_names: Optional[List[str]] = None
    target_unit: Optional[str] = None
    category: Optional[str] = None


class SynonymAdd(BaseModel):
    raw_name: str


@router.post("", response_model=dict)
async def create_coa_nomenclature(
    data: COANomenclatureCreate,
    current_user: User = Depends(require_permission("edit_nomenclature"))
):
    existing = await COANomenclatureMapping.find_one(
        COANomenclatureMapping.standardized_name == data.standardized_name
    )
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"COA nomenclature mapping for '{data.standardized_name}' already exists"
        )

    mapping = COANomenclatureMapping(
        standardized_name=data.standardized_name,
        raw_names=data.raw_names,
        target_unit=data.target_unit,
        category=data.category,
        created_by=current_user.email
    )
    await mapping.insert()

    return {
        "id": str(mapping.id),
        "standardized_name": mapping.standardized_name,
        "raw_names": mapping.raw_names,
        "target_unit": mapping.target_unit,
        "category": mapping.category,
        "created_at": mapping.created_at.isoformat()
    }


@router.get("", response_model=dict)
async def list_coa_nomenclature(
    skip: int = 0,
    limit: int = 200,
    search: Optional[str] = None,
    current_user: User = Depends(require_permission("view_nomenclature")),
):
    skip, limit = normalize_pagination(skip, limit, max_limit=200)
    query = {}
    if search:
        escaped = safe_regex(search)
        if escaped:
            query["$or"] = [
                {"standardized_name": {"$regex": escaped, "$options": "i"}},
                {"raw_names": {"$regex": escaped, "$options": "i"}},
            ]

    mappings = await COANomenclatureMapping.find(query).skip(skip).limit(limit).to_list()
    total = await COANomenclatureMapping.find(query).count()

    return {
        "mappings": [
            {
                "id": str(m.id),
                "standardized_name": m.standardized_name,
                "raw_names": m.raw_names,
                "target_unit": m.target_unit,
                "category": m.category,
                "mapped_terms": len(m.raw_names),
                "created_at": m.created_at.isoformat(),
            }
            for m in mappings
        ],
        "total": total,
    }


@router.get("/map", response_model=dict)
async def get_coa_nomenclature_map(
    current_user: User = Depends(require_permission("view_nomenclature"))
):
    """Reverse lookup map: raw_name (lower) -> standardized_name"""
    mappings = await COANomenclatureMapping.find_all().to_list()

    nomenclature_map = {}
    unit_map = {}
    for m in mappings:
        nomenclature_map[m.standardized_name.lower()] = m.standardized_name
        if m.target_unit:
            unit_map[m.standardized_name] = m.target_unit
        for raw in m.raw_names:
            nomenclature_map[raw.lower()] = m.standardized_name

    return {
        "map": nomenclature_map,
        "unit_map": unit_map,
        "total_mappings": len(mappings),
        "total_raw_names": len(nomenclature_map),
    }


class ResolveRequest(BaseModel):
    raw_names: List[str] = Field(..., max_length=500)


@router.post("/resolve", response_model=dict)
async def resolve_raw_names(
    data: ResolveRequest,
    current_user: User = Depends(require_permission("view_nomenclature")),
):
    """Fuzzy-resolve a list of raw nutrient names to standardized names
    using the same canonicalize logic as COA extraction."""
    from app.routes.coa import canonicalize, NOMENCLATURE_MAP, CANONICAL_NOMENCLATURE

    mappings = await COANomenclatureMapping.find_all().to_list()

    exact_map = {}
    for m in mappings:
        exact_map[m.standardized_name.lower()] = m.standardized_name
        for raw in m.raw_names:
            exact_map[raw.lower()] = m.standardized_name

    db_canonical = {}
    for m in mappings:
        db_canonical[canonicalize(m.standardized_name)] = m.standardized_name
        for raw in m.raw_names:
            db_canonical[canonicalize(raw)] = m.standardized_name

    resolved = {}
    for raw in data.raw_names:
        name = raw.strip()
        lower = name.lower()

        if lower in exact_map:
            resolved[raw] = exact_map[lower]
            continue

        canon = canonicalize(name)
        if canon in db_canonical:
            resolved[raw] = db_canonical[canon]
            continue
        if canon in CANONICAL_NOMENCLATURE:
            resolved[raw] = CANONICAL_NOMENCLATURE[canon]
            continue

        if lower in NOMENCLATURE_MAP:
            resolved[raw] = NOMENCLATURE_MAP[lower]
            continue

        resolved[raw] = None

    return {"resolved": resolved}


@router.get("/{mapping_id}", response_model=dict)
async def get_coa_nomenclature(
    mapping_id: str,
    current_user: User = Depends(require_permission("view_nomenclature")),
):
    mapping = await COANomenclatureMapping.get(parse_object_id(mapping_id, field="mapping_id"))
    if not mapping:
        raise HTTPException(status_code=404, detail="COA nomenclature mapping not found")

    return {
        "id": str(mapping.id),
        "standardized_name": mapping.standardized_name,
        "raw_names": mapping.raw_names,
        "target_unit": mapping.target_unit,
        "category": mapping.category,
        "created_at": mapping.created_at.isoformat(),
        "updated_at": mapping.updated_at.isoformat(),
    }


@router.put("/{mapping_id}", response_model=dict)
async def update_coa_nomenclature(
    mapping_id: str,
    update: COANomenclatureUpdate,
    current_user: User = Depends(require_permission("edit_nomenclature"))
):
    mapping = await COANomenclatureMapping.get(parse_object_id(mapping_id, field="mapping_id"))
    if not mapping:
        raise HTTPException(status_code=404, detail="COA nomenclature mapping not found")

    old_name = mapping.standardized_name

    if update.standardized_name and update.standardized_name != mapping.standardized_name:
        existing = await COANomenclatureMapping.find_one(
            COANomenclatureMapping.standardized_name == update.standardized_name
        )
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"COA nomenclature mapping for '{update.standardized_name}' already exists"
            )

    if update.standardized_name is not None:
        mapping.standardized_name = update.standardized_name
    if update.raw_names is not None:
        mapping.raw_names = update.raw_names
    if update.target_unit is not None:
        mapping.target_unit = update.target_unit
    if update.category is not None:
        mapping.category = update.category

    mapping.updated_at = datetime.now(timezone.utc)
    await mapping.save()

    # Sync rename to nutrient hierarchy if the standardized name changed
    hierarchy_synced = 0
    if update.standardized_name and update.standardized_name != old_name:
        from app.models.nutrient_hierarchy import NutrientHierarchyNode

        # Update node whose nutrient_name matches the old name
        node = await NutrientHierarchyNode.find_one(
            NutrientHierarchyNode.nutrient_name == old_name
        )
        if node:
            node.nutrient_name = update.standardized_name
            node.updated_at = datetime.now(timezone.utc)
            await node.save()
            hierarchy_synced += 1

        # Update children whose parent_nutrient matches the old name
        children = await NutrientHierarchyNode.find(
            NutrientHierarchyNode.parent_nutrient == old_name
        ).to_list()
        for child in children:
            child.parent_nutrient = update.standardized_name
            child.updated_at = datetime.now(timezone.utc)
            await child.save()
            hierarchy_synced += 1

        # Update any variant lists that contain the old name
        all_nodes = await NutrientHierarchyNode.find(
            {"variants": old_name}
        ).to_list()
        for vnode in all_nodes:
            vnode.variants = [update.standardized_name if v == old_name else v for v in vnode.variants]
            vnode.updated_at = datetime.now(timezone.utc)
            await vnode.save()
            hierarchy_synced += 1

    return {
        "id": str(mapping.id),
        "standardized_name": mapping.standardized_name,
        "raw_names": mapping.raw_names,
        "target_unit": mapping.target_unit,
        "category": mapping.category,
        "updated_at": mapping.updated_at.isoformat(),
        "hierarchy_synced": hierarchy_synced,
    }


@router.post("/{mapping_id}/synonyms", response_model=dict)
async def add_synonym(
    mapping_id: str,
    synonym_data: SynonymAdd,
    current_user: User = Depends(require_permission("edit_nomenclature"))
):
    mapping = await COANomenclatureMapping.get(parse_object_id(mapping_id, field="mapping_id"))
    if not mapping:
        raise HTTPException(status_code=404, detail="COA nomenclature mapping not found")

    if synonym_data.raw_name in mapping.raw_names:
        raise HTTPException(status_code=400, detail=f"Synonym '{synonym_data.raw_name}' already exists")

    mapping.raw_names.append(synonym_data.raw_name)
    mapping.updated_at = datetime.now(timezone.utc)
    await mapping.save()

    return {
        "id": str(mapping.id),
        "standardized_name": mapping.standardized_name,
        "raw_names": mapping.raw_names,
        "updated_at": mapping.updated_at.isoformat(),
    }


@router.delete("/{mapping_id}/synonyms/{raw_name}", response_model=dict)
async def remove_synonym(
    mapping_id: str,
    raw_name: str,
    current_user: User = Depends(require_permission("edit_nomenclature"))
):
    mapping = await COANomenclatureMapping.get(parse_object_id(mapping_id, field="mapping_id"))
    if not mapping:
        raise HTTPException(status_code=404, detail="COA nomenclature mapping not found")

    if raw_name not in mapping.raw_names:
        raise HTTPException(status_code=404, detail=f"Synonym '{raw_name}' not found")

    mapping.raw_names.remove(raw_name)
    mapping.updated_at = datetime.now(timezone.utc)
    await mapping.save()

    return {
        "id": str(mapping.id),
        "standardized_name": mapping.standardized_name,
        "raw_names": mapping.raw_names,
        "updated_at": mapping.updated_at.isoformat(),
    }


@router.delete("/{mapping_id}", response_model=dict)
async def delete_coa_nomenclature(
    mapping_id: str,
    current_user: User = Depends(require_permission("edit_nomenclature"))
):
    mapping = await COANomenclatureMapping.get(parse_object_id(mapping_id, field="mapping_id"))
    if not mapping:
        raise HTTPException(status_code=404, detail="COA nomenclature mapping not found")

    await mapping.delete()
    return {"message": f"COA nomenclature mapping for '{mapping.standardized_name}' deleted successfully"}


@router.post("/seed", response_model=dict)
async def seed_coa_nomenclature(
    current_user: User = Depends(require_permission("edit_nomenclature"))
):
    """Seed COA nomenclature from the hardcoded NOMENCLATURE_MAP + TARGET_UNITS in coa.py"""
    from app.routes.coa import NOMENCLATURE_MAP, TARGET_UNITS, get_nutrient_category

    grouped: dict[str, list[str]] = {}
    for raw, standard in NOMENCLATURE_MAP.items():
        grouped.setdefault(standard, []).append(raw)

    created = 0
    skipped = 0
    updated = 0

    for standard_name, raw_names in grouped.items():
        existing = await COANomenclatureMapping.find_one(
            COANomenclatureMapping.standardized_name == standard_name
        )
        target_unit = TARGET_UNITS.get(standard_name)
        category = get_nutrient_category(standard_name)

        if existing:
            new_raws = [r for r in raw_names if r not in existing.raw_names]
            changed = False
            if new_raws:
                existing.raw_names.extend(new_raws)
                changed = True
            if target_unit and existing.target_unit != target_unit:
                existing.target_unit = target_unit
                changed = True
            if category and existing.category != category:
                existing.category = category
                changed = True
            if changed:
                existing.updated_at = datetime.now(timezone.utc)
                await existing.save()
                updated += 1
            else:
                skipped += 1
        else:
            mapping = COANomenclatureMapping(
                standardized_name=standard_name,
                raw_names=raw_names,
                target_unit=target_unit,
                category=category,
                created_by=current_user.email,
            )
            await mapping.insert()
            created += 1

    return {
        "message": f"Seed complete: {created} created, {updated} updated, {skipped} skipped",
        "created": created,
        "updated": updated,
        "skipped": skipped,
    }
