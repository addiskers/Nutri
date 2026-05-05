"""
Nutrient Hierarchy Routes - CRUD for configurable nutrient parent-child relationships
used by formulation roll-up logic.
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
from datetime import datetime, timezone
from pydantic import BaseModel
from app.models.nutrient_hierarchy import NutrientHierarchyNode
from app.models.user import User
from app.dependencies.auth import require_permission
from app.utils.queries import parse_object_id

router = APIRouter(prefix="/nutrient-hierarchy", tags=["Nutrient Hierarchy"])


class NodeCreate(BaseModel):
    nutrient_name: str
    parent_nutrient: Optional[str] = None
    rule: Optional[str] = None
    is_additive: bool = True
    variants: List[str] = []
    display_order: int = 0


class NodeUpdate(BaseModel):
    nutrient_name: Optional[str] = None
    parent_nutrient: Optional[str] = None
    rule: Optional[str] = None
    is_additive: Optional[bool] = None
    variants: Optional[List[str]] = None
    display_order: Optional[int] = None


def _serialize(node: NutrientHierarchyNode) -> dict:
    return {
        "id": str(node.id),
        "nutrient_name": node.nutrient_name,
        "parent_nutrient": node.parent_nutrient,
        "rule": node.rule,
        "is_additive": node.is_additive,
        "variants": node.variants,
        "display_order": node.display_order,
        "created_at": node.created_at.isoformat(),
        "updated_at": node.updated_at.isoformat(),
    }


@router.post("", response_model=dict)
async def create_node(
    data: NodeCreate,
    current_user: User = Depends(require_permission("edit_nomenclature")),
):
    existing = await NutrientHierarchyNode.find_one(
        NutrientHierarchyNode.nutrient_name == data.nutrient_name
    )
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"Hierarchy node '{data.nutrient_name}' already exists",
        )

    if data.parent_nutrient:
        parent = await NutrientHierarchyNode.find_one(
            NutrientHierarchyNode.nutrient_name == data.parent_nutrient
        )
        if not parent:
            raise HTTPException(
                status_code=400,
                detail=f"Parent nutrient '{data.parent_nutrient}' not found in hierarchy",
            )

    node = NutrientHierarchyNode(
        nutrient_name=data.nutrient_name,
        parent_nutrient=data.parent_nutrient,
        rule=data.rule,
        is_additive=data.is_additive,
        variants=data.variants,
        display_order=data.display_order,
        created_by=current_user.email,
    )
    await node.insert()
    return _serialize(node)


@router.get("", response_model=dict)
async def list_nodes(
    current_user: User = Depends(require_permission("view_nomenclature")),
):
    nodes = await NutrientHierarchyNode.find_all().sort("+display_order").to_list()
    return {
        "nodes": [_serialize(n) for n in nodes],
        "total": len(nodes),
    }


@router.get("/tree", response_model=dict)
async def get_tree(
    current_user: User = Depends(require_permission("view_nomenclature")),
):
    """Return the hierarchy as a nested tree structure for frontend consumption."""
    nodes = await NutrientHierarchyNode.find_all().sort("+display_order").to_list()

    node_map: dict[str, dict] = {}
    for n in nodes:
        node_map[n.nutrient_name] = {
            **_serialize(n),
            "children": [],
        }

    roots: list[dict] = []
    for n in nodes:
        entry = node_map[n.nutrient_name]
        if n.parent_nutrient and n.parent_nutrient in node_map:
            node_map[n.parent_nutrient]["children"].append(entry)
        else:
            roots.append(entry)

    return {"tree": roots, "total": len(nodes)}


@router.get("/{node_id}", response_model=dict)
async def get_node(
    node_id: str,
    current_user: User = Depends(require_permission("view_nomenclature")),
):
    node = await NutrientHierarchyNode.get(parse_object_id(node_id, field="node_id"))
    if not node:
        raise HTTPException(status_code=404, detail="Hierarchy node not found")
    return _serialize(node)


@router.put("/{node_id}", response_model=dict)
async def update_node(
    node_id: str,
    update: NodeUpdate,
    current_user: User = Depends(require_permission("edit_nomenclature")),
):
    node = await NutrientHierarchyNode.get(parse_object_id(node_id, field="node_id"))
    if not node:
        raise HTTPException(status_code=404, detail="Hierarchy node not found")

    if update.nutrient_name is not None and update.nutrient_name != node.nutrient_name:
        dup = await NutrientHierarchyNode.find_one(
            NutrientHierarchyNode.nutrient_name == update.nutrient_name
        )
        if dup:
            raise HTTPException(
                status_code=400,
                detail=f"Hierarchy node '{update.nutrient_name}' already exists",
            )
        old_name = node.nutrient_name
        node.nutrient_name = update.nutrient_name
        # Update children that reference the old name
        children = await NutrientHierarchyNode.find(
            NutrientHierarchyNode.parent_nutrient == old_name
        ).to_list()
        for child in children:
            child.parent_nutrient = update.nutrient_name
            await child.save()

    if update.parent_nutrient is not None:
        if update.parent_nutrient == "":
            node.parent_nutrient = None
        else:
            if update.parent_nutrient == node.nutrient_name:
                raise HTTPException(status_code=400, detail="A node cannot be its own parent")
            parent = await NutrientHierarchyNode.find_one(
                NutrientHierarchyNode.nutrient_name == update.parent_nutrient
            )
            if not parent:
                raise HTTPException(
                    status_code=400,
                    detail=f"Parent nutrient '{update.parent_nutrient}' not found",
                )
            node.parent_nutrient = update.parent_nutrient

    if update.rule is not None:
        node.rule = update.rule if update.rule else None
    if update.is_additive is not None:
        node.is_additive = update.is_additive
    if update.variants is not None:
        node.variants = update.variants
    if update.display_order is not None:
        node.display_order = update.display_order

    node.updated_at = datetime.now(timezone.utc)
    await node.save()
    return _serialize(node)


@router.delete("/{node_id}", response_model=dict)
async def delete_node(
    node_id: str,
    cascade: bool = False,
    current_user: User = Depends(require_permission("edit_nomenclature")),
):
    node = await NutrientHierarchyNode.get(parse_object_id(node_id, field="node_id"))
    if not node:
        raise HTTPException(status_code=404, detail="Hierarchy node not found")

    children = await NutrientHierarchyNode.find(
        NutrientHierarchyNode.parent_nutrient == node.nutrient_name
    ).to_list()

    if children and not cascade:
        # Re-parent children to this node's parent
        for child in children:
            child.parent_nutrient = node.parent_nutrient
            child.updated_at = datetime.now(timezone.utc)
            await child.save()
    elif children and cascade:
        await _delete_subtree(node.nutrient_name)

    await node.delete()
    return {
        "message": f"Hierarchy node '{node.nutrient_name}' deleted",
        "children_affected": len(children),
    }


async def _delete_subtree(parent_name: str):
    """Recursively delete all descendants of a node."""
    children = await NutrientHierarchyNode.find(
        NutrientHierarchyNode.parent_nutrient == parent_name
    ).to_list()
    for child in children:
        await _delete_subtree(child.nutrient_name)
        await child.delete()


# ── Default seed data ──────────────────────────────────────────────────────

DEFAULT_HIERARCHY = [
    # Fats
    {"nutrient_name": "Total Fat", "parent_nutrient": None, "rule": "gte_sum", "is_additive": True, "display_order": 0},
    {"nutrient_name": "Saturated Fat", "parent_nutrient": "Total Fat", "rule": None, "is_additive": True, "display_order": 0},
    {"nutrient_name": "Monounsaturated Fat", "parent_nutrient": "Total Fat", "rule": None, "is_additive": True, "display_order": 1},
    {"nutrient_name": "Polyunsaturated Fat", "parent_nutrient": "Total Fat", "rule": "gte_sum", "is_additive": True, "display_order": 2},
    {"nutrient_name": "Linoleic Acid", "parent_nutrient": "Polyunsaturated Fat", "rule": None, "is_additive": True, "display_order": 0},
    {"nutrient_name": "Alpha-Linolenic Acid", "parent_nutrient": "Polyunsaturated Fat", "rule": None, "is_additive": True, "display_order": 1},
    {"nutrient_name": "DHA", "parent_nutrient": "Polyunsaturated Fat", "rule": None, "is_additive": True, "display_order": 2},
    {"nutrient_name": "EPA", "parent_nutrient": "Polyunsaturated Fat", "rule": None, "is_additive": True, "display_order": 3},
    {"nutrient_name": "Trans Fat", "parent_nutrient": "Total Fat", "rule": None, "is_additive": True, "display_order": 3},
    # Carbohydrates
    {"nutrient_name": "Total Carbohydrates", "parent_nutrient": None, "rule": "gte_sum", "is_additive": True, "display_order": 1},
    {"nutrient_name": "Total Sugars", "parent_nutrient": "Total Carbohydrates", "rule": None, "is_additive": True, "display_order": 0},
    {"nutrient_name": "Added Sugars", "parent_nutrient": "Total Sugars", "rule": None, "is_additive": False, "display_order": 0},
    {"nutrient_name": "Dietary Fiber", "parent_nutrient": "Total Carbohydrates", "rule": None, "is_additive": True, "display_order": 1},
    {"nutrient_name": "Polyol", "parent_nutrient": "Total Carbohydrates", "rule": None, "is_additive": True, "display_order": 2},
    {"nutrient_name": "Other Carbs", "parent_nutrient": "Total Carbohydrates", "rule": None, "is_additive": True, "display_order": 3},
    # Protein
    {
        "nutrient_name": "Protein",
        "parent_nutrient": None,
        "rule": "collapse_variants",
        "is_additive": True,
        "display_order": 2,
        "variants": [
            "Protein (Dry Basis)",
            "Protein (Wet Basis)",
            "protein (n x 6.25)",
            "Protein (N x 6.38)",
            "Protein as is (N x 6.38)",
            "Protein (N x 6.38) Dry Basis",
        ],
    },
]


@router.post("/seed", response_model=dict)
async def seed_hierarchy(
    current_user: User = Depends(require_permission("edit_nomenclature")),
):
    created = 0
    skipped = 0
    updated = 0

    for entry in DEFAULT_HIERARCHY:
        existing = await NutrientHierarchyNode.find_one(
            NutrientHierarchyNode.nutrient_name == entry["nutrient_name"]
        )
        if existing:
            changed = False
            for key in ("parent_nutrient", "rule", "is_additive", "display_order"):
                if entry.get(key) is not None and getattr(existing, key) != entry[key]:
                    setattr(existing, key, entry[key])
                    changed = True
            if entry.get("variants") and existing.variants != entry["variants"]:
                existing.variants = entry["variants"]
                changed = True
            if changed:
                existing.updated_at = datetime.now(timezone.utc)
                await existing.save()
                updated += 1
            else:
                skipped += 1
        else:
            node = NutrientHierarchyNode(
                nutrient_name=entry["nutrient_name"],
                parent_nutrient=entry.get("parent_nutrient"),
                rule=entry.get("rule"),
                is_additive=entry.get("is_additive", True),
                variants=entry.get("variants", []),
                display_order=entry.get("display_order", 0),
                created_by=current_user.email,
            )
            await node.insert()
            created += 1

    return {
        "message": f"Seed complete: {created} created, {updated} updated, {skipped} skipped",
        "created": created,
        "updated": updated,
        "skipped": skipped,
    }
