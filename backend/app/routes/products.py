"""
Product Routes - Including AI-Powered Image Extraction
"""
import os
import re
import json
import base64
from io import BytesIO
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from pydantic import BaseModel
from PIL import Image

from app.models.user import User
from app.models.product import Product
from app.dependencies.auth import get_current_user

router = APIRouter(prefix="/products", tags=["Products"])

# Import settings
from config.settings import settings

# ============================================================
# CONFIGURATION
# ============================================================
GEMINI_MODEL = "gemini-2.5-flash"

# Pricing (for cost tracking)
PRICING = {
    "input": 0.30,
    "output": 2.50,
}

# ============================================================
# NUTRITION NOMENCLATURE MAP
# ============================================================
NOMENCLATURE_MAP = {
    "protein": "Protein",
    "proteins": "Protein",
    "crude protein": "Protein",
    "total protein": "Protein",
    "protein (n x 6.25)": "Protein",
    "protein content": "Protein",
    "protein (g)": "Protein",
    "fat": "Total Fat",
    "total fat": "Total Fat",
    "crude fat": "Total Fat",
    "lipids": "Total Fat",
    "total fat (g)": "Total Fat",
    "saturated fat": "Saturated Fat",
    "saturated fatty acids": "Saturated Fat",
    "sfa": "Saturated Fat",
    "monounsaturated fat": "Monounsaturated Fat",
    "mufa": "Monounsaturated Fat",
    "polyunsaturated fat": "Polyunsaturated Fat",
    "pufa": "Polyunsaturated Fat",
    "trans fat": "Trans Fat",
    "carbohydrate": "Total Carbohydrates",
    "total carbohydrate": "Total Carbohydrates",
    "carbs": "Total Carbohydrates",
    "carbohydrate (g)": "Total Carbohydrates",
    "available carbohydrates": "Available Carbohydrates",
    "sugar": "Total Sugars",
    "total sugar": "Total Sugars",
    "total sugars": "Total Sugars",
    "total sugars (g)": "Total Sugars",
    "added sugar": "Added Sugars",
    "added sugars": "Added Sugars",
    "added sugars (g)": "Added Sugars",
    "sucrose": "Sucrose",
    "dietary fiber": "Dietary Fiber",
    "fiber": "Dietary Fiber",
    "soluble fiber": "Soluble Fiber",
    "insoluble fiber": "Insoluble Fiber",
    "fos": "FOS",
    "moisture": "Moisture",
    "moisture content": "Moisture",
    "ash": "Ash",
    "total ash": "Ash",
    "cholesterol": "Cholesterol",
    "cholesterol (mg)": "Cholesterol",
    "energy (kcal)": "Energy (kcal)",
    "energy (kj)": "Energy (kJ)",
    "energy": "Energy (kcal)",
    "calories": "Energy (kcal)",
    "sodium": "Sodium (Na)",
    "sodium (mg)": "Sodium (Na)",
    "potassium": "Potassium (K)",
    "calcium": "Calcium (Ca)",
    "iron": "Iron (Fe)",
    "zinc": "Zinc (Zn)",
    "magnesium": "Magnesium (Mg)",
    "phosphorus": "Phosphorus (P)",
    "chloride": "Chloride (Cl)",
    "vitamin a": "Vitamin A",
    "vitamin a (mcg)": "Vitamin A",
    "vitamin d": "Vitamin D",
    "vitamin d₂": "Vitamin D2",
    "vitamin d2": "Vitamin D2",
    "vitamin d₂ (mcg)": "Vitamin D2",
    "vitamin d3": "Vitamin D3",
    "vitamin e": "Vitamin E",
    "vitamin e (mg)": "Vitamin E",
    "vitamin c": "Vitamin C",
    "vitamin b1": "Vitamin B1",
    "vitamin b2": "Vitamin B2",
    "vitamin b3": "Vitamin B3",
    "vitamin b5": "Vitamin B5",
    "vitamin b6": "Vitamin B6",
    "vitamin b7": "Vitamin B7",
    "vitamin b9": "Vitamin B9",
    "vitamin b12": "Vitamin B12",
    "vitamin k": "Vitamin K",
}


# ============================================================
# HELPER FUNCTIONS
# ============================================================
def standardize_nutrition_table(nutrition_table):
    """Standardize nutrient names using NOMENCLATURE_MAP"""
    if not nutrition_table:
        return []

    standardized = []
    for nutrient in nutrition_table:
        original_name_raw = nutrient.get("nutrient_name", "")
        
        if not original_name_raw or not isinstance(original_name_raw, str):
            continue
            
        original_name = original_name_raw.strip().lower()
        if not original_name:
            continue
            
        standardized_name = NOMENCLATURE_MAP.get(original_name, original_name_raw)
        
        values = nutrient.get("values", {})
        if not values or not any(values.values()):
            continue
            
        standardized.append({
            "nutrient_name": standardized_name,
            "values": values,
            "original_name": original_name_raw,
        })

    return standardized


def extract_numeric_mrp(mrp_value):
    """Extract numeric MRP from string"""
    if not mrp_value or mrp_value == "not specified":
        return None
    if isinstance(mrp_value, (int, float)):
        return float(mrp_value)
    if not isinstance(mrp_value, str):
        try:
            return float(mrp_value)
        except:
            return None
    cleaned = re.sub(r"[₹Rs.MRP:INCL\.OFALLTAXES\s]", "", mrp_value, flags=re.IGNORECASE)
    numbers = re.findall(r"\d+\.?\d*", cleaned)
    if numbers:
        try:
            return float(numbers[0])
        except:
            return None
    return None


def detect_packing_format(text):
    """Detect packing format from text"""
    if not isinstance(text, str):
        text = str(text) if text else ""
    text_lower = text.lower()
    formats = {
        "sachet": ["sachet", "sachets"],
        "bottle": ["bottle", "bottles"],
        "pouch": ["pouch", "pouches"],
        "jar": ["jar", "jars"],
        "can": ["can", "cans", "tin"],
        "tetra pack": ["tetra pack", "tetra pak"],
        "carton": ["carton", "cartons"],
        "box": ["box", "boxes"],
        "pack": ["pack", "packet"],
        "tub": ["tub", "tubs", "container"],
    }
    for format_name, keywords in formats.items():
        for keyword in keywords:
            if keyword in text_lower:
                return format_name
    return "not specified"


def validate_dates(text):
    """Extract and validate dates from text"""
    if not isinstance(text, str):
        text = str(text) if text else ""
    date_strings = re.findall(r"\b\d{2}/\d{2}/\d{2,4}\b", text)
    valid_dates = []
    for ds in date_strings:
        try:
            if len(ds.split("/")[-1]) == 4:
                dt = datetime.strptime(ds, "%d/%m/%Y")
            else:
                dt = datetime.strptime(ds, "%d/%m/%y")
            valid_dates.append(dt)
        except ValueError:
            continue
    mfg_date = valid_dates[0].strftime("%d/%m/%Y") if valid_dates else None
    exp_date = valid_dates[-1].strftime("%d/%m/%Y") if len(valid_dates) > 1 else None
    return mfg_date, exp_date


def validate_fssai(text):
    """Extract FSSAI license numbers"""
    if not isinstance(text, str):
        text = str(text) if text else ""
    return list(set(re.findall(r"\b\d{14}\b", text)))


def calculate_cost(input_tokens, output_tokens):
    """Calculate API cost"""
    input_cost = (input_tokens / 1_000_000) * PRICING["input"]
    output_cost = (output_tokens / 1_000_000) * PRICING["output"]
    return {
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "input_cost": input_cost,
        "output_cost": output_cost,
        "total_cost": input_cost + output_cost,
    }


# ============================================================
# EXTRACTION PROMPT
# ============================================================
EXTRACTION_PROMPT = """Extract complete product packaging data from these images.

CRITICAL: Return ONLY raw JSON. DO NOT wrap in markdown code fences. Start with { and end with }.

PRODUCT TYPE:
- "single": One product, one variant
- "parent_child": Multi-variant pack

BRAND & PRODUCT:
- parent_brand: Main company name ( owner of the product) not name of product 
- sub_brand: Product line or "not specified" ( brand of the product)
- product_name: Full product name + variant ( name of the product)
- variant: Flavor/type

WEIGHT & SIZE:
1. net_weight: Product weight (e.g., "30 g")
2. pack_size: If mentioned (e.g., "Pack of 10")
3. serving_size: From nutrition table (e.g., "15 g")
4. servings_per_pack: If mentioned

PRICING:
- mrp: NUMBER ONLY (e.g., 40.00 not "₹ 40")

PACKING FORMAT:
sachet, bottle, pouch, jar, can, tetra pack, carton, box, tub, pack

NUTRITION TABLE - CRITICAL:

**YOU MUST EXTRACT THE NUTRITION TABLE IF IT EXISTS with all the nutrients and values**

Look for:
- "Nutritional Information" or "Approximate Composition Per 100 g"
- Table with nutrient names and values
- Usually on back/side of pack

Table structure:
- Column 1: Nutrient name
- Column 2: Per 100g values
- Column 3: Per Serve values (if present)
- Column 4: % RDA (if present)

Extract EVERY nutrient row:
[
  {
    "nutrient_name": "Energy (kcal)",
    "values": {
      "Per 100g": "503 kcal",
      "Per Serve (15g)": "75 kcal",
      "% RDA": "4%"
    }
  }
]

RULES:
1. NEVER return [] for nutrition_table if you see a table
2. Extract ALL nutrient rows
3. Each entry MUST have non-null nutrient_name
4. Keep units exactly as printed
5. If RDA empty: "not specified"
6. Energy in kJ AND kcal: TWO separate entries

MANUFACTURER:
- Type: "Manufactured by" | "Packed by" | "Marketed by"
- Extract ALL manufacturer entries
Date: in dd/mm/yyyy format
JSON STRUCTURE:
{
  "product_type": "single",
  "parent_product": {
    "brand": {"parent_brand": "", "sub_brand": ""},
    "product_name": "",
    "variant": "",
    "weight_and_size": {
      "net_weight": "",
      "pack_size": "",
      "serving_size": "",
      "servings_per_pack": ""
    },
    "pricing": {"mrp": 0.00, "uspf": ""},
    "packing_format": "",
    "nutrition_table": [],
    "ingredients": "",
    "allergen_info": "",
    "claims": [],
    "storage_instructions": "",
    "instructions_to_use": "",
    "manufacturer_details": [
      {"type": "", "name": "", "address": "", "fssai": ""}
    ],
    "batch_codes": {"lot_number": "", "machine_code": ""},
    "dates": {"manufacturing_date": "", "expiry_date": ""},
    "barcode": "",
    "certifications": [],
    "symbols": {"veg_nonveg": "", "recyclable": ""},
    "customer_care": {"phone": [], "email": "", "website": ""},
    "other_important_text": []
  },
  "child_variants": []
}

Return ONLY the JSON."""


# ============================================================
# SCHEMAS
# ============================================================
class ExtractedProductData(BaseModel):
    """Response schema for extracted product data"""
    success: bool
    data: Optional[dict] = None
    error: Optional[str] = None
    cost: Optional[dict] = None


class ProductCreate(BaseModel):
    """Schema for creating a product"""
    product_name: str
    parent_brand: str
    sub_brand: Optional[str] = None
    variant: Optional[str] = None
    net_weight: Optional[str] = None
    pack_size: Optional[str] = None
    serving_size: Optional[str] = None
    mrp: Optional[float] = None
    packing_format: Optional[str] = None
    veg_nonveg: Optional[str] = None
    category: Optional[str] = None
    nutrition_table: List[dict] = []
    ingredients: Optional[str] = None
    allergen_info: Optional[str] = None
    claims: List[str] = []
    storage_instructions: Optional[str] = None
    instructions_to_use: Optional[str] = None
    shelf_life: Optional[str] = None
    manufacturer_details: List[dict] = []
    brand_owner: Optional[str] = None
    manufacturing_date: Optional[str] = None
    expiry_date: Optional[str] = None
    barcode: Optional[str] = None
    certifications: List[str] = []
    fssai_licenses: List[str] = []
    customer_care: dict = {}
    tags: List[str] = []
    images: List[str] = []
    status: str = "draft"


class ProductResponse(BaseModel):
    """Response schema for product"""
    id: str
    product_name: str
    parent_brand: str
    variant: Optional[str]
    mrp: Optional[float]
    category: Optional[str]
    status: str
    created_at: datetime


# ============================================================
# ROUTES
# ============================================================

@router.post("/extract", response_model=ExtractedProductData)
async def extract_product_from_images(
    images: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    Extract product data from uploaded images using Gemini AI
    
    - Accepts up to 10 images
    - Returns structured product data
    - User can review and edit before saving
    """
    # Safe print function to handle Unicode encoding errors on Windows
    def safe_print(msg):
        try:
            print(msg)
        except UnicodeEncodeError:
            try:
                print(msg.encode('ascii', 'replace').decode('ascii'))
            except:
                print("[LOG] (message contains special characters)")
    
    safe_print("\n" + "="*60)
    safe_print("[EXTRACTION] ===== NEW EXTRACTION REQUEST =====")
    safe_print("="*60)
    
    try:
        safe_print(f"[EXTRACTION] User: {current_user.email}")
        safe_print(f"[EXTRACTION] Number of images received: {len(images)}")
        for idx, img in enumerate(images):
            safe_print(f"[EXTRACTION] Image {idx + 1}: filename={img.filename}, content_type={img.content_type}")
        
        # Check API key
        api_key = settings.GEMINI_API_KEY
        if not api_key:
            safe_print("[ERROR] Gemini API key not configured")
            raise HTTPException(
                status_code=500, 
                detail="Gemini API key not configured. Please set GEMINI_API_KEY in environment."
            )
        
        safe_print(f"[EXTRACTION] API key configured: {api_key[:20]}...")
        
        # Validate image count
        if len(images) == 0:
            raise HTTPException(status_code=400, detail="At least one image is required")
        if len(images) > 10:
            raise HTTPException(status_code=400, detail="Maximum 10 images allowed")
        
        safe_print(f"[EXTRACTION] Processing {len(images)} images")
        
        # Load and validate images
        pil_images = []
        for idx, img in enumerate(images):
            try:
                safe_print(f"[EXTRACTION] Loading image {idx + 1}/{len(images)}: {img.filename}")
                content = await img.read()
                pil_img = Image.open(BytesIO(content))
                safe_print(f"[EXTRACTION] Image {idx + 1} loaded: {pil_img.size} pixels")
                pil_images.append(pil_img)
            except Exception as e:
                safe_print(f"[ERROR] Failed to load image {img.filename}: {str(e)}")
                raise HTTPException(
                    status_code=400, 
                    detail=f"Invalid image file: {img.filename}. Error: {str(e)}"
                )
        
        # Call Gemini API
        safe_print("[EXTRACTION] Initializing Gemini client...")
        from google import genai
        
        client = genai.Client(api_key=api_key)
        safe_print("[EXTRACTION] Client initialized successfully")
        
        content = [EXTRACTION_PROMPT] + pil_images
        
        safe_print(f"[EXTRACTION] Calling Gemini API with model: {GEMINI_MODEL}")
        safe_print(f"[EXTRACTION] This may take 10-30 seconds for {len(images)} images...")
        
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=content,
            config={
                "temperature": 0,
                "top_p": 0.95,
                "top_k": 40,
                "response_mime_type": "application/json",
            },
        )
        
        safe_print("[EXTRACTION] Response received from Gemini API")
        
        # Calculate cost
        usage = response.usage_metadata
        safe_print(f"[EXTRACTION] Token usage - Input: {usage.prompt_token_count}, Output: {usage.candidates_token_count}")
        cost_info = calculate_cost(
            usage.prompt_token_count, 
            usage.candidates_token_count
        )
        safe_print(f"[EXTRACTION] Estimated cost: ${cost_info['total_cost']:.4f}")
        
        # Parse response
        raw_json = response.text.strip()
        safe_print(f"[EXTRACTION] Response length: {len(raw_json)} characters")
        
        # Clean markdown if present
        if raw_json.startswith("```"):
            safe_print("[EXTRACTION] Cleaning markdown formatting...")
            first_newline = raw_json.find("\n")
            if first_newline != -1:
                raw_json = raw_json[first_newline + 1:]
            if "```" in raw_json:
                last_fence = raw_json.rfind("```")
                raw_json = raw_json[:last_fence].rstrip()
        
        if not raw_json.startswith("{"):
            first_brace = raw_json.find("{")
            if first_brace != -1:
                raw_json = raw_json[first_brace:]
        
        if not raw_json.endswith("}"):
            last_brace = raw_json.rfind("}")
            if last_brace != -1:
                raw_json = raw_json[:last_brace + 1]
        
        safe_print("[EXTRACTION] Parsing JSON response...")
        product_data = json.loads(raw_json)
        safe_print("[EXTRACTION] JSON parsed successfully")
        
        # Post-process the data
        safe_print("[EXTRACTION] Post-processing extracted data...")
        parent = product_data.get("parent_product", {})
        
        # Standardize nutrition
        if "nutrition_table" in parent:
            safe_print("[EXTRACTION] Standardizing nutrition table...")
            parent["nutrition_table"] = standardize_nutrition_table(parent["nutrition_table"])
        
        # Extract numeric MRP
        if "pricing" in parent:
            mrp_value = parent["pricing"].get("mrp")
            numeric_mrp = extract_numeric_mrp(mrp_value)
            if numeric_mrp is not None:
                parent["pricing"]["mrp"] = numeric_mrp
        
        # Detect packing format
        if parent.get("packing_format") == "not specified":
            combined_text = json.dumps(product_data)
            parent["packing_format"] = detect_packing_format(combined_text)
        
        # Validate dates
        mfg_date, exp_date = validate_dates(raw_json)
        if "dates" in parent:
            if mfg_date:
                parent["dates"]["manufacturing_date"] = mfg_date
            if exp_date:
                parent["dates"]["expiry_date"] = exp_date
        
        # Calculate shelf life if not provided
        shelf_life = parent.get("shelf_life", "")
        if not shelf_life or shelf_life == "not specified":
            if mfg_date and exp_date:
                try:
                    from datetime import datetime
                    # Try different date formats
                    for date_format in ["%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d"]:
                        try:
                            mfg = datetime.strptime(mfg_date, date_format)
                            exp = datetime.strptime(exp_date, date_format)
                            days_diff = (exp - mfg).days
                            months = days_diff // 30
                            if months > 0:
                                parent["shelf_life"] = f"{months} months"
                            else:
                                parent["shelf_life"] = f"{days_diff} days"
                            break
                        except ValueError:
                            continue
                except:
                    pass
        
        # Extract FSSAI
        fssai_licenses = validate_fssai(raw_json)
        if fssai_licenses and "manufacturer_details" in parent:
            for manufacturer in parent["manufacturer_details"]:
                if manufacturer.get("fssai") == "not specified" and fssai_licenses:
                    manufacturer["fssai"] = fssai_licenses.pop(0)
        
        # Transform to frontend-friendly format
        transformed_data = {
            "basic": {
                "productName": parent.get("product_name", ""),
                "brand": parent.get("brand", {}).get("parent_brand", ""),
                "subBrand": parent.get("brand", {}).get("sub_brand", ""),
                "variant": parent.get("variant", ""),
                "packSize": parent.get("weight_and_size", {}).get("net_weight", ""),
                "serveSize": parent.get("weight_and_size", {}).get("serving_size", ""),
                "mrp": parent.get("pricing", {}).get("mrp", ""),
                "packingFormat": parent.get("packing_format", ""),
                "vegNonVeg": parent.get("symbols", {}).get("veg_nonveg", ""),
            },
            "nutrition": parent.get("nutrition_table", []),
            "composition": {
                "ingredients": parent.get("ingredients", ""),
                "allergenInfo": parent.get("allergen_info", ""),
                "claims": parent.get("claims", []),
                "storageInstructions": parent.get("storage_instructions", ""),
                "instructionsToUse": parent.get("instructions_to_use", ""),
                "shelfLife": parent.get("shelf_life", ""),
            },
            "company": {
                "manufacturerDetails": parent.get("manufacturer_details", []),
                "barcode": parent.get("barcode", ""),
                "certifications": parent.get("certifications", []),
                "customerCare": parent.get("customer_care", {}),
            },
            "dates": parent.get("dates", {}),
            "other": parent.get("other_important_text", []),
            "raw": product_data,  # Keep raw data for reference
        }
        
        safe_print("[EXTRACTION] SUCCESS - Extraction completed successfully!")
        return ExtractedProductData(
            success=True,
            data=transformed_data,
            cost=cost_info
        )
        
    except json.JSONDecodeError as e:
        safe_print(f"[ERROR] JSON parsing failed: {str(e)}")
        safe_print(f"[ERROR] Raw response preview: {raw_json[:500] if 'raw_json' in locals() else 'N/A'}")
        return ExtractedProductData(
            success=False,
            error=f"Failed to parse AI response: {str(e)}"
        )
    except HTTPException as e:
        try:
            print(f"[ERROR] HTTP Exception: {e.detail}")
            print(f"[ERROR] Status Code: {e.status_code}")
        except UnicodeEncodeError:
                print("[ERROR] HTTP Exception (Unicode error in message)")
        raise
    except Exception as e:
        # Safe print function that handles Unicode encoding errors
        def safe_print(msg):
            try:
                print(msg)
            except UnicodeEncodeError:
                # Fallback: print ASCII-only version
                try:
                    print(msg.encode('ascii', 'replace').decode('ascii'))
                except:
                    print("[ERROR] Could not display error message (encoding error)")
        
        safe_print("\n[ERROR] ===== EXTRACTION FAILED =====")
        safe_print(f"[ERROR] Exception Type: {type(e).__name__}")
        safe_print(f"[ERROR] Error Message: {str(e)}")
        
        import traceback
        safe_print("[ERROR] Full Traceback:")
        try:
            tb = traceback.format_exc()
            safe_print(tb)
        except Exception:
            safe_print("[ERROR] Could not format traceback")
        
        safe_print("="*60)
        
        # Return error response instead of raising exception
        # This ensures a 200 status with error details in the response
        error_msg = f"{type(e).__name__}: {str(e)}"
        try:
            # Try to encode to ASCII to avoid Unicode errors in response
            error_msg = error_msg.encode('ascii', 'replace').decode('ascii')
        except:
            error_msg = f"{type(e).__name__}: (error message contains non-ASCII characters)"
        
        return ExtractedProductData(
            success=False,
            error=f"Extraction failed: {error_msg}"
        )


@router.post("", response_model=dict)
async def create_product(
    product: ProductCreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new product"""
    try:
        new_product = Product(
            product_name=product.product_name,
            parent_brand=product.parent_brand,
            sub_brand=product.sub_brand,
            variant=product.variant,
            net_weight=product.net_weight,
            pack_size=product.pack_size,
            serving_size=product.serving_size,
            mrp=product.mrp,
            packing_format=product.packing_format,
            veg_nonveg=product.veg_nonveg,
            category=product.category,
            nutrition_table=product.nutrition_table,
            ingredients=product.ingredients,
            allergen_info=product.allergen_info,
            claims=product.claims,
            storage_instructions=product.storage_instructions,
            instructions_to_use=product.instructions_to_use,
            shelf_life=product.shelf_life,
            manufacturer_details=product.manufacturer_details,
            brand_owner=product.brand_owner,
            manufacturing_date=product.manufacturing_date,
            expiry_date=product.expiry_date,
            barcode=product.barcode,
            certifications=product.certifications,
            fssai_licenses=product.fssai_licenses,
            customer_care=product.customer_care,
            tags=product.tags,
            images=product.images,
            status=product.status,
            created_by=str(current_user.id),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        await new_product.insert()
        
        return {
            "success": True,
            "message": "Product created successfully",
            "product_id": str(new_product.id)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create product: {str(e)}")


@router.get("", response_model=dict)
async def list_products(
    skip: int = 0,
    limit: int = 50,
    category: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None
):
    """List all products with optional filters"""
    try:
        query = {}
        
        if category:
            query["category"] = category
        if status:
            query["status"] = status
        if search:
            query["$or"] = [
                {"product_name": {"$regex": search, "$options": "i"}},
                {"parent_brand": {"$regex": search, "$options": "i"}},
                {"variant": {"$regex": search, "$options": "i"}}
            ]
        
        products = await Product.find(query).skip(skip).limit(limit).to_list()
        total = await Product.find(query).count()

        # Debug logging
        for p in products:
            if "Nutralite" in p.product_name:
                print(f"[API DEBUG] Product: {p.product_name}")
                print(f"[API DEBUG] Images count: {len(p.images) if p.images else 0}")
                print(f"[API DEBUG] Images type: {type(p.images)}")

        return {
            "products": [
                {
                    "id": str(p.id),
                    "product_name": p.product_name,
                    "parent_brand": p.parent_brand,
                    "variant": p.variant,
                    "mrp": p.mrp,
                    "category": p.category,
                    "status": p.status,
                    "pack_size": p.pack_size,
                    "net_weight": p.net_weight,
                    "created_at": p.created_at.isoformat(),
                    "manufacturing_date": p.manufacturing_date,
                    "expiry_date": p.expiry_date,
                    "images": p.images if p.images else []  # All images for preview
                }
                for p in products
            ],
            "total": total,
            "skip": skip,
            "limit": limit
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch products: {str(e)}")


@router.get("/{product_id}", response_model=dict)
async def get_product(
    product_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get a single product by ID"""
    try:
        from bson import ObjectId
        product = await Product.get(ObjectId(product_id))
        
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        return {
            "id": str(product.id),
            "product_name": product.product_name,
            "parent_brand": product.parent_brand,
            "sub_brand": product.sub_brand,
            "variant": product.variant,
            "net_weight": product.net_weight,
            "pack_size": product.pack_size,
            "serving_size": product.serving_size,
            "mrp": product.mrp,
            "packing_format": product.packing_format,
            "veg_nonveg": product.veg_nonveg,
            "category": product.category,
            "nutrition_table": product.nutrition_table,
            "ingredients": product.ingredients,
            "allergen_info": product.allergen_info,
            "claims": product.claims,
            "storage_instructions": product.storage_instructions,
            "instructions_to_use": product.instructions_to_use,
            "shelf_life": product.shelf_life,
            "manufacturer_details": product.manufacturer_details,
            "brand_owner": product.brand_owner,
            "manufacturing_date": product.manufacturing_date,
            "expiry_date": product.expiry_date,
            "barcode": product.barcode,
            "certifications": product.certifications,
            "fssai_licenses": product.fssai_licenses,
            "customer_care": product.customer_care,
            "tags": product.tags,
            "images": product.images,
            "status": product.status,
            "created_at": product.created_at.isoformat(),
            "updated_at": product.updated_at.isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch product: {str(e)}")


@router.put("/{product_id}", response_model=dict)
async def update_product(
    product_id: str,
    product_update: ProductCreate,
    current_user: User = Depends(get_current_user)
):
    """Update a product"""
    try:
        from bson import ObjectId
        product = await Product.get(ObjectId(product_id))
        
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        # Update fields
        update_data = product_update.model_dump(exclude_unset=True)
        update_data["updated_at"] = datetime.utcnow()
        
        for field, value in update_data.items():
            setattr(product, field, value)
        
        await product.save()
        
        return {
            "success": True,
            "message": "Product updated successfully",
            "product_id": str(product.id)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update product: {str(e)}")


@router.delete("/{product_id}", response_model=dict)
async def delete_product(
    product_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a product"""
    try:
        from bson import ObjectId
        product = await Product.get(ObjectId(product_id))
        
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        await product.delete()
        
        return {
            "success": True,
            "message": "Product deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete product: {str(e)}")

