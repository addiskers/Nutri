"""
Product Model for NutriEyeQ
"""
from typing import Optional, List, Dict, Any
from datetime import datetime
from beanie import Document
from pydantic import Field


class NutritionEntry(Dict):
    """Nutrition table entry"""
    nutrient_name: str
    values: Dict[str, str]  # e.g., {"Per 100g": "25 kcal", "Per Serve": "10 kcal"}
    original_name: Optional[str] = None


class ManufacturerDetail(Dict):
    """Manufacturer information"""
    type: str  # "Manufactured by" | "Packed by" | "Marketed by"
    name: str
    address: Optional[str] = None
    fssai: Optional[str] = None


class Product(Document):
    """Product Document Model"""
    
    # Basic Information
    product_name: str
    parent_brand: str
    sub_brand: Optional[str] = None
    variant: Optional[str] = None
    
    # Weight & Size
    net_weight: Optional[str] = None
    pack_size: Optional[str] = None
    serving_size: Optional[str] = None
    servings_per_pack: Optional[str] = None
    
    # Pricing
    mrp: Optional[float] = None
    
    # Type & Format
    product_type: str = "single"  # "single" | "parent_child"
    packing_format: Optional[str] = None  # sachet, bottle, pouch, jar, can, etc.
    veg_nonveg: Optional[str] = None  # "veg" | "non-veg" | "vegan"
    
    # Category
    category: Optional[str] = None
    
    # Nutrition
    nutrition_table: List[Dict[str, Any]] = Field(default_factory=list)
    
    # Composition
    ingredients: Optional[str] = None
    allergen_info: Optional[str] = None
    claims: List[str] = Field(default_factory=list)
    
    # Storage
    storage_instructions: Optional[str] = None
    instructions_to_use: Optional[str] = None
    shelf_life: Optional[str] = None
    
    # Company/Manufacturer
    manufacturer_details: List[Dict[str, Any]] = Field(default_factory=list)
    brand_owner: Optional[str] = None
    
    # Dates
    manufacturing_date: Optional[str] = None
    expiry_date: Optional[str] = None
    
    # Regulatory
    barcode: Optional[str] = None
    certifications: List[str] = Field(default_factory=list)
    fssai_licenses: List[str] = Field(default_factory=list)
    
    # Symbols
    symbols: Dict[str, str] = Field(default_factory=dict)
    
    # Customer Care
    customer_care: Dict[str, Any] = Field(default_factory=dict)
    
    # Other
    other_important_text: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    
    # Images (stored as base64 or URLs)
    images: List[str] = Field(default_factory=list)
    
    # Metadata
    created_by: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    extraction_cost: Optional[Dict[str, Any]] = None
    
    # Status
    status: str = "published"  # "draft" | "published" | "archived"
    
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


