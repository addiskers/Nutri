from typing import Optional, List, Dict, Any
from datetime import datetime
from beanie import Document
from pydantic import Field


class NutritionEntry(Dict):
    nutrient_name: str
    values: Dict[str, str]  # e.g., {"Per 100g": "25 kcal", "Per Serve": "10 kcal"}
    original_name: Optional[str] = None


class ManufacturerDetail(Dict):
    type: str
    name: str
    address: Optional[str] = None
    fssai: Optional[str] = None


class Product(Document):
    product_name: str
    parent_brand: str
    sub_brand: Optional[str] = None
    variant: Optional[str] = None
    net_weight: Optional[str] = None
    pack_size: Optional[str] = None
    serving_size: Optional[str] = None
    servings_per_pack: Optional[str] = None
    mrp: Optional[float] = None
    product_type: str = "single"
    packing_format: Optional[str] = None
    veg_nonveg: Optional[str] = None
    category: Optional[str] = None
    nutrition_table: List[Dict[str, Any]] = Field(default_factory=list)
    ingredients: Optional[str] = None
    allergen_info: Optional[str] = None
    claims: List[str] = Field(default_factory=list)
    storage_instructions: Optional[str] = None
    instructions_to_use: Optional[str] = None
    shelf_life: Optional[str] = None
    manufacturer_details: List[Dict[str, Any]] = Field(default_factory=list)
    brand_owner: Optional[str] = None
    manufacturing_date: Optional[str] = None
    expiry_date: Optional[str] = None
    shelf_life: Optional[str] = None
    barcode: Optional[str] = None
    certifications: List[str] = Field(default_factory=list)
    fssai_licenses: List[str] = Field(default_factory=list)
    symbols: Dict[str, str] = Field(default_factory=dict)
    customer_care: Dict[str, Any] = Field(default_factory=dict)
    other_important_text: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    images: List[str] = Field(default_factory=list)
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    extraction_cost: Optional[Dict[str, Any]] = None
    status: str = "published"
    
    class Settings:
        name = "products"
        
    class Config:
        json_schema_extra = {
            "example": {
                "product_name": "Zydus Junior Horlicks Chocolate",
                "parent_brand": "Horlicks",
                "sub_brand": "Junior Horlicks",
                "variant": "Chocolate",
                "net_weight": "500g",
                "mrp": 450.00,
                "veg_nonveg": "veg",
                "category": "Health Drink"
            }
        }


