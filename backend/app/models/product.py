from typing import Optional, List, Dict, Any, Union
from datetime import datetime
from beanie import Document
from pydantic import Field, field_validator


class ManufacturerDetail(Dict):
    type: str
    name: str
    address: Optional[str] = None
    license_number: Optional[str] = None
    fssai: Optional[str] = None  # kept for backward compatibility


class Product(Document):
    # ── Identity ──────────────────────────────────────────────────────────────
    product_name: str
    parent_brand: str
    sub_brand: Optional[str] = None
    variant: Optional[str] = None
    product_type: str = "single"

    # ── Pack details ──────────────────────────────────────────────────────────
    net_quantity: Optional[str] = None
    pack_size: Optional[str] = None
    serving_size: Optional[str] = None
    servings_per_pack: Optional[str] = None
    packing_format: Optional[str] = None

    # ── Pricing ───────────────────────────────────────────────────────────────
    mrp: Optional[float] = None
    uspf: Optional[str] = None               # Unit Selling Price Format

    # ── Nutrition ─────────────────────────────────────────────────────────────
    nutrition_table: List[Dict[str, Any]] = Field(default_factory=list)
    nutrition_notes: List[str] = Field(default_factory=list)

    # ── Composition ───────────────────────────────────────────────────────────
    ingredients: Optional[str] = None
    allergen_information: Optional[str] = None
    claims: List[str] = Field(default_factory=list)

    # ── Medical ───────────────────────────────────────────────────────────────
    medical_information: Dict[str, Any] = Field(default_factory=dict)
    # shape: {"warnings": []}

    # ── Usage / Storage ───────────────────────────────────────────────────────
    usage_instructions: Dict[str, Any] = Field(default_factory=dict)
    # shape: {"directions_to_use": [], "preparation_method": []}
    storage_instructions: Optional[List[str]] = Field(default_factory=list)

    # ── Manufacturer / FSSAI ──────────────────────────────────────────────────
    manufacturer_information: List[Dict[str, Any]] = Field(default_factory=list)
    brand_owner: Optional[str] = None
    fssai_information: Dict[str, Any] = Field(default_factory=dict)
    # shape: {"license_numbers": []}

    # ── Packaging / Batch ─────────────────────────────────────────────────────
    packaging_information: Dict[str, Any] = Field(default_factory=dict)
    # shape: {"packaging_material_manufacturer": "", "packaging_codes": []}
    batch_information: Dict[str, Any] = Field(default_factory=dict)
    # shape: {"lot_number": "", "machine_code": "", "other_codes": []}

    # ── Dates ─────────────────────────────────────────────────────────────────
    manufacturing_date: Optional[str] = None
    expiry_date: Optional[str] = None
    shelf_life: Optional[str] = None

    # ── Identifiers ───────────────────────────────────────────────────────────
    barcodes: List[str] = Field(default_factory=list)

    # ── Regulatory / Other ────────────────────────────────────────────────────
    certifications: List[str] = Field(default_factory=list)
    regulatory_text: List[str] = Field(default_factory=list)
    customer_care: Dict[str, Any] = Field(default_factory=dict)
    # shape: {"phone": [], "email": "", "website": "", "address": ""}
    other_important_text: List[str] = Field(default_factory=list)
    veg_nonveg: Optional[str] = None

    # ── Misc ──────────────────────────────────────────────────────────────────
    category: Optional[str] = None           # UI category (separate from product_category)
    tags: List[str] = Field(default_factory=list)
    images: List[str] = Field(default_factory=list)
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    extraction_cost: Optional[Dict[str, Any]] = None
    status: str = "published"

    # ── Backward-compatibility validators ─────────────────────────────────────
    # Old documents may store these fields as None, a plain string, or the
    # wrong shape.  These validators silently coerce to the expected type so
    # existing MongoDB records load without validation errors.

    @field_validator(
        "storage_instructions", "nutrition_notes", "barcodes",
        "regulatory_text", "other_important_text",
        "claims", "certifications",
        mode="before",
    )
    @classmethod
    def coerce_to_str_list(cls, v):
        if v is None:
            return []
        if isinstance(v, str):
            return [v] if v else []
        if isinstance(v, list):
            return v
        return []

    @field_validator(
        "nutrition_table", "manufacturer_information",
        "tags", "images",
        mode="before",
    )
    @classmethod
    def coerce_to_dict_list(cls, v):
        if v is None:
            return []
        if isinstance(v, list):
            return v
        return []

    @field_validator(
        "medical_information", "usage_instructions", "packaging_information",
        "batch_information", "fssai_information", "customer_care",
        mode="before",
    )
    @classmethod
    def coerce_to_dict(cls, v):
        if v is None:
            return {}
        if isinstance(v, dict):
            return v
        return {}

    class Settings:
        name = "products"
        indexes = [
            "status",
            "category",
            "product_name",
            [("status", 1), ("category", 1)],
        ]

    class Config:
        json_schema_extra = {
            "example": {
                "product_name": "Junior Horlicks Chocolate",
                "parent_brand": "Horlicks",
                "sub_brand": "Junior Horlicks",
                "variant": "Chocolate",
                "net_quantity": "500g",
                "mrp": 450.00,
                "uspf": "",
                "veg_nonveg": "veg",
                "category": "Health Drink"
            }
        }