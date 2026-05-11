from typing import Optional, List, Dict, Any, Union
from datetime import datetime, timezone
from beanie import Document
from pydantic import Field, field_validator

class ManufacturerDetail(Dict):
    type: str
    name: str
    address: Optional[str] = None
    license_number: Optional[str] = None
    fssai: Optional[str] = None

class Product(Document):

    product_name: str
    parent_brand: str
    sub_brand: Optional[str] = None
    variant: Optional[str] = None
    product_type: str = "single"

    net_quantity: Optional[str] = None
    pack_size: Optional[str] = None
    serving_size: Optional[str] = None
    servings_per_pack: Optional[str] = None
    packing_format: Optional[str] = None

    mrp: Optional[str] = None
    uspf: Optional[str] = None

    @field_validator("mrp", mode="before")
    @classmethod
    def coerce_mrp_to_str(cls, v):
        if v is None:
            return None
        if isinstance(v, (int, float)):
            return str(v)
        return v

    nutrition_table: List[Dict[str, Any]] = Field(default_factory=list)
    nutrition_notes: List[str] = Field(default_factory=list)

    ingredients: Optional[str] = None
    allergen_information: Optional[str] = None
    claims: List[str] = Field(default_factory=list)

    medical_information: Dict[str, Any] = Field(default_factory=dict)

    usage_instructions: Dict[str, Any] = Field(default_factory=dict)

    storage_instructions: Optional[List[str]] = Field(default_factory=list)

    manufacturer_information: List[Dict[str, Any]] = Field(default_factory=list)
    brand_owner: Optional[str] = None
    fssai_information: Dict[str, Any] = Field(default_factory=dict)

    packaging_information: Dict[str, Any] = Field(default_factory=dict)

    batch_information: Dict[str, Any] = Field(default_factory=dict)

    manufacturing_date: Optional[str] = None
    expiry_date: Optional[str] = None
    shelf_life: Optional[str] = None

    barcodes: List[str] = Field(default_factory=list)

    certifications: List[str] = Field(default_factory=list)
    regulatory_text: List[str] = Field(default_factory=list)
    customer_care: Dict[str, Any] = Field(default_factory=dict)

    other_important_text: List[str] = Field(default_factory=list)
    veg_nonveg: Optional[str] = None

    category: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    images: List[str] = Field(default_factory=list)
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    extraction_cost: Optional[Dict[str, Any]] = None
    status: str = "published"

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
                "mrp": "₹ 450.00",
                "uspf": "",
                "veg_nonveg": "veg",
                "category": "Health Drink"
            }
        }
