import os
import re
import json
import base64
from io import BytesIO
from typing import Any, Dict, List, Optional, Union
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form, Request
from pydantic import BaseModel
from PIL import Image

from app.models.user import User, UserPermissions
from app.models.product import Product
from app.dependencies.auth import get_current_user, require_permission
from app.middleware.security import limiter
from app.utils.queries import safe_regex, parse_object_id, normalize_pagination
from app.utils.audit import audit_event
from app.utils.uploads import read_upload_capped

router = APIRouter(prefix="/products", tags=["Products"])

from config.settings import settings

_ALLOWED_IMAGE_CONTENT_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/gif",
}

def _validate_uploads(files, allowed_types, max_files):
    """Shared pre-flight upload validation. Raises 400/413 early so we never
    pull a hostile payload fully into memory."""
    if not files:
        raise HTTPException(status_code=400, detail="At least one file is required")
    if len(files) > max_files:
        raise HTTPException(
            status_code=400,
            detail=f"Maximum {max_files} files allowed"
        )

    per_file_cap = settings.MAX_UPLOAD_FILE_SIZE_MB * 1024 * 1024
    total_cap = settings.MAX_UPLOAD_TOTAL_SIZE_MB * 1024 * 1024
    total = 0
    for f in files:
        if f.content_type and f.content_type.lower() not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type for {f.filename!r}: {f.content_type}"
            )
        size = getattr(f, "size", None) or 0
        if size and size > per_file_cap:
            raise HTTPException(
                status_code=413,
                detail=f"File {f.filename!r} exceeds {settings.MAX_UPLOAD_FILE_SIZE_MB}MB limit"
            )
        total += size
    if total and total > total_cap:
        raise HTTPException(
            status_code=413,
            detail=f"Total upload size exceeds {settings.MAX_UPLOAD_TOTAL_SIZE_MB}MB limit"
        )

GEMINI_MODEL = "gemini-2.5-flash"

PRICING = {
    "input": 0.30,
    "output": 2.50,
}

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

def standardize_nutrition_table(nutrition_table):
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

def validate_dates(text):
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
    if not isinstance(text, str):
        text = str(text) if text else ""
    return list(set(re.findall(r"\b\d{14}\b", text)))

def calculate_cost(input_tokens, output_tokens):
    input_cost = (input_tokens / 1_000_000) * PRICING["input"]
    output_cost = (output_tokens / 1_000_000) * PRICING["output"]
    return {
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "input_cost": input_cost,
        "output_cost": output_cost,
        "total_cost": input_cost + output_cost,
    }

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

DATES:
- manufacturing_date: in dd/mm/yyyy format
- expiry_date: in dd/mm/yyyy format
- shelf_life: Extract if printed on pack (e.g., "18 months", "2 years"). If not visible, calculate from manufacturing to expiry date difference and express in months (e.g., if mfg is 15/03/2023 and expiry is 14/09/2023, shelf_life is "6 months")

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
    "dates": {"manufacturing_date": "", "expiry_date": "", "shelf_life": ""},
    "barcode": "",
    "certifications": [],
    "symbols": {"veg_nonveg": "", "recyclable": ""},
    "customer_care": {"phone": [], "email": "", "website": ""},
    "other_important_text": []
  },
  "child_variants": []
}

Return ONLY the JSON."""

class ExtractedProductData(BaseModel):
    success: bool
    data: Optional[dict] = None
    error: Optional[str] = None
    cost: Optional[dict] = None

class ProductCreate(BaseModel):
    product_name: str
    parent_brand: str
    sub_brand: Optional[str] = None
    variant: Optional[str] = None
    net_weight: Optional[str] = None
    net_quantity: Optional[str] = None
    pack_size: Optional[str] = None
    serving_size: Optional[str] = None
    servings_per_pack: Optional[str] = None
    mrp: Optional[float] = None
    uspf: Optional[str] = None
    packing_format: Optional[str] = None
    veg_nonveg: Optional[str] = None
    category: Optional[str] = None
    nutrition_table: List[dict] = []
    nutrition_notes: Optional[Union[List[str], str]] = None
    ingredients: Optional[str] = None
    allergen_info: Optional[str] = None
    allergen_information: Optional[str] = None
    claims: List[str] = []

    storage_instructions: Optional[Union[List[str], str]] = None
    instructions_to_use: Optional[str] = None
    usage_instructions: Optional[Dict[str, Any]] = None
    shelf_life: Optional[str] = None

    manufacturer_details: Optional[List[dict]] = None
    manufacturer_information: Optional[List[dict]] = None
    brand_owner: Optional[str] = None
    manufacturing_date: Optional[str] = None
    expiry_date: Optional[str] = None

    barcode: Optional[str] = None
    barcodes: Optional[List[str]] = None
    certifications: List[str] = []
    fssai_licenses: Optional[List[str]] = None
    fssai_information: Optional[Dict[str, Any]] = None

    batch_information: Optional[Dict[str, Any]] = None
    packaging_information: Optional[Dict[str, Any]] = None
    medical_information: Optional[Dict[str, Any]] = None
    customer_care: Dict[str, Any] = {}
    regulatory_text: Optional[Union[List[str], str]] = None
    other_important_text: Optional[Union[List[str], str]] = None
    tags: List[str] = []
    images: List[str] = []
    status: str = "draft"

class ProductResponse(BaseModel):
    id: str
    product_name: str
    parent_brand: str
    variant: Optional[str]
    mrp: Optional[float]
    category: Optional[str]
    status: str
    created_at: datetime

@router.post("/extract", response_model=ExtractedProductData)
@limiter.limit(settings.EXTRACT_RATE_LIMIT)
async def extract_product_from_images(
    request: Request,
    images: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_user)
):
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

        safe_print(f"[EXTRACTION] actor_id={current_user.id} files={len(images)}")
        for idx, img in enumerate(images):
            safe_print(f"[EXTRACTION] file[{idx + 1}] content_type={img.content_type}")

        api_key = settings.GEMINI_API_KEY
        if not api_key:
            safe_print("[ERROR] Gemini API key not configured")
            raise HTTPException(
                status_code=500,
                detail="Gemini API key not configured. Please set GEMINI_API_KEY in environment."
            )

        safe_print("[EXTRACTION] API key configured")

        _validate_uploads(images, _ALLOWED_IMAGE_CONTENT_TYPES, max_files=10)

        safe_print(f"[EXTRACTION] Processing {len(images)} images")

        per_file_cap = settings.MAX_UPLOAD_FILE_SIZE_MB * 1024 * 1024
        total_cap = settings.MAX_UPLOAD_TOTAL_SIZE_MB * 1024 * 1024
        bytes_read = 0

        pil_images = []
        for idx, img in enumerate(images):
            position_label = f"file at position {idx + 1}"
            try:
                safe_print(f"[EXTRACTION] Loading file[{idx + 1}]/{len(images)}")

                content = await read_upload_capped(
                    img,
                    per_file_cap_bytes=per_file_cap,
                    remaining_total_cap_bytes=total_cap - bytes_read,
                    file_label=position_label,
                )
                bytes_read += len(content)
                pil_img = Image.open(BytesIO(content))
                safe_print(f"[EXTRACTION] file[{idx + 1}] loaded: {pil_img.size} pixels")
                pil_images.append(pil_img)
            except HTTPException:
                raise
            except Exception as e:

                safe_print(f"[ERROR] Failed to load file[{idx + 1}]: {type(e).__name__}")
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid image file at position {idx + 1}",
                )

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

        usage = response.usage_metadata
        safe_print(f"[EXTRACTION] Token usage - Input: {usage.prompt_token_count}, Output: {usage.candidates_token_count}")
        cost_info = calculate_cost(
            usage.prompt_token_count,
            usage.candidates_token_count
        )
        safe_print(f"[EXTRACTION] Estimated cost: ${cost_info['total_cost']:.4f}")

        raw_json = response.text.strip()
        safe_print(f"[EXTRACTION] Response length: {len(raw_json)} characters")

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

        safe_print("[EXTRACTION] Post-processing extracted data...")
        parent = product_data.get("parent_product", {})

        if "nutrition_table" in parent:
            safe_print("[EXTRACTION] Standardizing nutrition table...")
            parent["nutrition_table"] = standardize_nutrition_table(parent["nutrition_table"])

        if "pricing" in parent:
            mrp_value = parent["pricing"].get("mrp")
            numeric_mrp = extract_numeric_mrp(mrp_value)
            if numeric_mrp is not None:
                parent["pricing"]["mrp"] = numeric_mrp

        parent.pop("packing_format", None)

        mfg_date, exp_date = validate_dates(raw_json)
        if "dates" in parent:
            if mfg_date:
                parent["dates"]["manufacturing_date"] = mfg_date
            if exp_date:
                parent["dates"]["expiry_date"] = exp_date

        shelf_life = parent.get("dates", {}).get("shelf_life", "") or parent.get("shelf_life", "")
        if not shelf_life or shelf_life == "not specified":
            if mfg_date and exp_date:
                try:
                    from datetime import datetime
                    for date_format in ["%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d"]:
                        try:
                            mfg = datetime.strptime(mfg_date, date_format)
                            exp = datetime.strptime(exp_date, date_format)
                            days_diff = (exp - mfg).days
                            months = days_diff // 30
                            if months > 0:
                                shelf_life = f"{months} months"
                            else:
                                shelf_life = f"{days_diff} days"
                            break
                        except ValueError:
                            continue
                except:
                    pass

        if shelf_life:
            parent["shelf_life"] = shelf_life
            if "dates" in parent:
                parent["dates"]["shelf_life"] = shelf_life

        fssai_licenses = validate_fssai(raw_json)
        if fssai_licenses and "manufacturer_details" in parent:
            for manufacturer in parent["manufacturer_details"]:
                if manufacturer.get("fssai") == "not specified" and fssai_licenses:
                    manufacturer["fssai"] = fssai_licenses.pop(0)

        transformed_data = {
            "basic": {
                "productName": parent.get("product_name", ""),
                "brand": parent.get("brand", {}).get("parent_brand", ""),
                "subBrand": parent.get("brand", {}).get("sub_brand", ""),
                "variant": parent.get("variant", ""),
                "packSize": parent.get("weight_and_size", {}).get("net_weight", ""),
                "netQuantity": parent.get("weight_and_size", {}).get("net_weight", ""),
                "packCount": parent.get("weight_and_size", {}).get("pack_size", ""),
                "serveSize": parent.get("weight_and_size", {}).get("serving_size", ""),
                "servingsPerPack": parent.get("weight_and_size", {}).get("servings_per_pack", ""),
                "mrp": parent.get("pricing", {}).get("mrp", ""),
                "uspf": parent.get("pricing", {}).get("uspf", ""),
                "manufactured": parent.get("dates", {}).get("manufacturing_date", ""),
                "expiry": parent.get("dates", {}).get("expiry_date", ""),
                "shelfLife": parent.get("shelf_life", ""),
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
            "batch": {
                "lotNumber":   parent.get("batch_codes", {}).get("lot_number", ""),
                "machineCode": parent.get("batch_codes", {}).get("machine_code", ""),
            },
            "dates": parent.get("dates", {}),
            "other": parent.get("other_important_text", []),
            "raw": product_data,
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
        def safe_print(msg):
            try:
                print(msg)
            except UnicodeEncodeError:
                try:
                    print(msg.encode('ascii', 'replace').decode('ascii'))
                except Exception:
                    print("[ERROR] Could not display error message (encoding error)")

        safe_print(f"[ERROR] extract_product_from_images failed: {type(e).__name__}")
        if settings.DEBUG:
            import traceback
            try:
                safe_print(traceback.format_exc())
            except Exception:
                pass

        return ExtractedProductData(
            success=False,
            error="Extraction failed. Please try again or contact support."
        )

@router.post("", response_model=dict)
async def create_product(
    product: ProductCreate,
    current_user: User = Depends(require_permission(UserPermissions.ADD_PRODUCTS.value))
):
    try:

        if isinstance(product.storage_instructions, list):
            storage_list = [s for s in product.storage_instructions if s]
        elif isinstance(product.storage_instructions, str) and product.storage_instructions:
            storage_list = [product.storage_instructions]
        else:
            storage_list = []

        usage_payload = product.usage_instructions or {}
        if not usage_payload and product.instructions_to_use:
            usage_payload = {
                "directions_to_use": [product.instructions_to_use],
                "preparation_method": [],
            }

        manufacturer_info = (
            product.manufacturer_information
            if product.manufacturer_information is not None
            else (product.manufacturer_details or [])
        )
        barcode_list = (
            product.barcodes
            if product.barcodes is not None
            else ([product.barcode] if product.barcode else [])
        )
        if product.fssai_information is not None:
            fssai_info = product.fssai_information
        elif product.fssai_licenses:
            fssai_info = {"license_numbers": product.fssai_licenses}
        else:
            fssai_info = {}

        allergen_information = (
            product.allergen_information
            if product.allergen_information is not None
            else product.allergen_info
        )

        def _to_list(v):
            if isinstance(v, list):
                return [s for s in v if s]
            if isinstance(v, str) and v:
                return [v]
            return []

        new_product = Product(
            product_name=product.product_name,
            parent_brand=product.parent_brand,
            sub_brand=product.sub_brand,
            variant=product.variant,
            net_quantity=product.net_quantity if product.net_quantity is not None else product.net_weight,
            pack_size=product.pack_size,
            serving_size=product.serving_size,
            servings_per_pack=product.servings_per_pack,
            mrp=product.mrp,
            uspf=product.uspf,
            packing_format=product.packing_format,
            veg_nonveg=product.veg_nonveg,
            category=product.category,
            nutrition_table=product.nutrition_table,
            nutrition_notes=_to_list(product.nutrition_notes),
            ingredients=product.ingredients,
            allergen_information=allergen_information,
            claims=product.claims,
            storage_instructions=storage_list,
            usage_instructions=usage_payload,
            medical_information=product.medical_information or {},
            shelf_life=product.shelf_life,
            manufacturer_information=manufacturer_info,
            brand_owner=product.brand_owner,
            manufacturing_date=product.manufacturing_date,
            expiry_date=product.expiry_date,
            barcodes=barcode_list,
            certifications=product.certifications,
            fssai_information=fssai_info,
            batch_information=product.batch_information or {},
            packaging_information=product.packaging_information or {},
            customer_care=product.customer_care,
            regulatory_text=_to_list(product.regulatory_text),
            other_important_text=_to_list(product.other_important_text),
            tags=product.tags,
            images=product.images,
            status=product.status,
            created_by=str(current_user.id),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )

        await new_product.insert()

        audit_event(
            "product.create",
            actor_id=str(current_user.id),
            actor_role=current_user.role,
            target_type="product",
            target_id=str(new_product.id),
        )

        return {
            "success": True,
            "message": "Product created successfully",
            "product_id": str(new_product.id)
        }

    except Exception as e:
        print(f"[ERROR] create_product failed: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Failed to create product")

@router.get("", response_model=dict)
async def list_products(
    skip: int = 0,
    limit: int = 50,
    category: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(require_permission(UserPermissions.VIEW_PRODUCTS.value))
):
    try:
        skip, limit = normalize_pagination(skip, limit)

        query = {}

        if category:
            query["category"] = category
        if status:
            query["status"] = status
        if search:
            escaped = safe_regex(search)
            if escaped:
                query["$or"] = [
                    {"product_name": {"$regex": escaped, "$options": "i"}},
                    {"parent_brand": {"$regex": escaped, "$options": "i"}},
                    {"variant": {"$regex": escaped, "$options": "i"}},
                ]

        products = await Product.find(query).skip(skip).limit(limit).to_list()
        total = await Product.find(query).count()

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
                    "net_weight": getattr(p, "net_quantity", None),
                    "net_quantity": getattr(p, "net_quantity", None),
                    "created_at": p.created_at.isoformat() if p.created_at else None,
                    "manufacturing_date": p.manufacturing_date,
                    "expiry_date": p.expiry_date,
                    "images": p.images if p.images else []
                }
                for p in products
            ],
            "total": total,
            "skip": skip,
            "limit": limit
        }

    except Exception as e:
        print(f"[ERROR] list_products failed: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Failed to fetch products")

@router.get("/dashboard-stats", response_model=dict)
async def dashboard_stats(
    current_user: User = Depends(require_permission(UserPermissions.VIEW_PRODUCTS.value))
):
    try:
        from datetime import timedelta, timezone as _tz

        now = datetime.now(_tz.utc)
        week_ago = now - timedelta(days=7)
        two_weeks_ago = now - timedelta(days=14)

        total_products = await Product.find_all().count()
        products_last_7_days = await Product.find(
            {"created_at": {"$gte": week_ago}}
        ).count()
        products_prev_7_days = await Product.find(
            {"created_at": {"$gte": two_weeks_ago, "$lt": week_ago}}
        ).count()

        breakdown_cursor = Product.get_motor_collection().aggregate([
            {"$match": {"category": {"$ne": None, "$exists": True}}},
            {"$group": {"_id": "$category", "count": {"$sum": 1}}},
        ])
        category_breakdown = {}
        async for doc in breakdown_cursor:
            name = doc.get("_id")
            if name:
                category_breakdown[str(name)] = int(doc.get("count", 0))

        recent = (
            await Product.find_all()
            .sort("-created_at")
            .limit(5)
            .to_list()
        )
        recent_products = [
            {
                "id": str(p.id),
                "product_name": p.product_name,
                "parent_brand": p.parent_brand,
                "category": p.category,
                "mrp": p.mrp,
                "pack_size": p.pack_size,
                "expiry_date": p.expiry_date,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in recent
        ]

        return {
            "total_products": total_products,
            "products_last_7_days": products_last_7_days,
            "products_prev_7_days": products_prev_7_days,
            "category_breakdown": category_breakdown,
            "recent_products": recent_products,
        }

    except Exception as e:
        print(f"[ERROR] dashboard_stats failed: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Failed to fetch dashboard stats")

@router.get("/brands", response_model=dict)
async def list_brands(
    current_user: User = Depends(require_permission(UserPermissions.VIEW_PRODUCTS.value))
):
    try:
        raw = await Product.get_motor_collection().distinct("parent_brand")
        brands = sorted({str(b).strip() for b in raw if b and str(b).strip()})
        return {"brands": brands}
    except Exception as e:
        print(f"[ERROR] list_brands failed: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Failed to fetch brands")

@router.get("/{product_id}", response_model=dict)
async def get_product(
    product_id: str,
    current_user: User = Depends(require_permission(UserPermissions.VIEW_PRODUCTS.value))
):
    try:
        product = await Product.get(parse_object_id(product_id, field="product_id"))

        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        manufacturer_info = getattr(product, "manufacturer_information", None) or []
        fssai_info = getattr(product, "fssai_information", None) or {}
        usage_info = getattr(product, "usage_instructions", None) or {}
        barcodes_list = getattr(product, "barcodes", None) or []
        net_quantity = getattr(product, "net_quantity", None)
        allergen_information = getattr(product, "allergen_information", None)
        fssai_license_numbers = (
            fssai_info.get("license_numbers", []) if isinstance(fssai_info, dict) else []
        )
        directions_to_use = (
            usage_info.get("directions_to_use") if isinstance(usage_info, dict) else None
        )

        return {
            "id": str(product.id),
            "product_name": product.product_name,
            "parent_brand": product.parent_brand,
            "sub_brand": product.sub_brand,
            "variant": product.variant,

            "net_weight": net_quantity,
            "net_quantity": net_quantity,
            "pack_size": product.pack_size,
            "serving_size": product.serving_size,
            "servings_per_pack": getattr(product, "servings_per_pack", None),
            "mrp": product.mrp,
            "uspf": getattr(product, "uspf", None),
            "packing_format": product.packing_format,
            "veg_nonveg": product.veg_nonveg,
            "category": product.category,
            "nutrition_table": product.nutrition_table,
            "nutrition_notes": getattr(product, "nutrition_notes", []) or [],
            "ingredients": product.ingredients,

            "allergen_info": allergen_information,
            "allergen_information": allergen_information,
            "claims": product.claims,
            "storage_instructions": product.storage_instructions,

            "instructions_to_use": directions_to_use,
            "usage_instructions": usage_info,
            "shelf_life": product.shelf_life,

            "manufacturer_details": manufacturer_info,
            "manufacturer_information": manufacturer_info,
            "brand_owner": product.brand_owner,
            "manufacturing_date": product.manufacturing_date,
            "expiry_date": product.expiry_date,

            "barcode": barcodes_list[0] if barcodes_list else None,
            "barcodes": barcodes_list,
            "certifications": product.certifications,

            "fssai_licenses": fssai_license_numbers,
            "fssai_information": fssai_info,
            "customer_care": product.customer_care,
            "batch_information": getattr(product, "batch_information", {}) or {},
            "packaging_information": getattr(product, "packaging_information", {}) or {},
            "medical_information": getattr(product, "medical_information", {}) or {},
            "regulatory_text": getattr(product, "regulatory_text", []) or [],
            "other_important_text": getattr(product, "other_important_text", []) or [],
            "tags": product.tags,
            "images": product.images,
            "status": product.status,
            "created_at": product.created_at.isoformat() if product.created_at else None,
            "updated_at": product.updated_at.isoformat() if product.updated_at else None,
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] get_product failed: {type(e).__name__}: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch product")

@router.put("/{product_id}", response_model=dict)
async def update_product(
    product_id: str,
    product_update: ProductCreate,
    current_user: User = Depends(require_permission(UserPermissions.EDIT_PRODUCTS.value))
):
    try:
        product = await Product.get(parse_object_id(product_id, field="product_id"))

        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        update_data = product_update.model_dump(exclude_unset=True)
        update_data["updated_at"] = datetime.utcnow()

        if "storage_instructions" in update_data:
            si = update_data["storage_instructions"]
            if isinstance(si, list):
                update_data["storage_instructions"] = [s for s in si if s]
            elif isinstance(si, str) and si:
                update_data["storage_instructions"] = [si]
            else:
                update_data["storage_instructions"] = []

        if "usage_instructions" not in update_data and "instructions_to_use" in update_data:
            legacy = update_data.pop("instructions_to_use") or ""
            update_data["usage_instructions"] = {
                "directions_to_use": [legacy] if legacy else [],
                "preparation_method": [],
            }
        elif "instructions_to_use" in update_data:
            update_data.pop("instructions_to_use", None)

        if "net_weight" in update_data and "net_quantity" not in update_data:
            update_data["net_quantity"] = update_data.pop("net_weight")
        else:
            update_data.pop("net_weight", None)

        if "allergen_info" in update_data and "allergen_information" not in update_data:
            update_data["allergen_information"] = update_data.pop("allergen_info")
        else:
            update_data.pop("allergen_info", None)

        if "manufacturer_details" in update_data and "manufacturer_information" not in update_data:
            update_data["manufacturer_information"] = update_data.pop("manufacturer_details") or []
        else:
            update_data.pop("manufacturer_details", None)

        if "barcode" in update_data and "barcodes" not in update_data:
            single = update_data.pop("barcode")
            update_data["barcodes"] = [single] if single else []
        else:
            update_data.pop("barcode", None)

        if "fssai_information" not in update_data and "fssai_licenses" in update_data:
            licenses = update_data.pop("fssai_licenses") or []
            update_data["fssai_information"] = {"license_numbers": licenses}
        else:
            update_data.pop("fssai_licenses", None)

        for key in ("regulatory_text", "other_important_text", "nutrition_notes"):
            if key in update_data:
                v = update_data[key]
                if isinstance(v, str):
                    update_data[key] = [v] if v else []
                elif isinstance(v, list):
                    update_data[key] = [s for s in v if s]
                else:
                    update_data[key] = []

        for field, value in update_data.items():
            setattr(product, field, value)

        await product.save()

        audit_event(
            "product.update",
            actor_id=str(current_user.id),
            actor_role=current_user.role,
            target_type="product",
            target_id=str(product.id),
            fields=list(update_data.keys()),
        )

        return {
            "success": True,
            "message": "Product updated successfully",
            "product_id": str(product.id)
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] update_product failed: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Failed to update product")

@router.delete("/{product_id}", response_model=dict)
async def delete_product(
    product_id: str,
    current_user: User = Depends(require_permission(UserPermissions.DELETE_PRODUCTS.value))
):
    try:
        product = await Product.get(parse_object_id(product_id, field="product_id"))

        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        await product.delete()

        audit_event(
            "product.delete",
            actor_id=str(current_user.id),
            actor_role=current_user.role,
            target_type="product",
            target_id=str(product_id),
        )

        return {
            "success": True,
            "message": "Product deleted successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] delete_product failed: {type(e).__name__}")
        raise HTTPException(status_code=500, detail="Failed to delete product")

