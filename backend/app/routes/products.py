"""
Product Routes - Including AI-Powered Image Extraction
"""
import os
import re
import unicodedata
from rapidfuzz import fuzz
import json
import base64
from io import BytesIO
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from pydantic import BaseModel
from PIL import Image, ImageEnhance, ImageFilter
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
    "crude protein": "Protein",
    "total protein": "Protein",
    "protein content": "Protein",
    "fat": "Total Fat",
    "total fat": "Total Fat",
    "crude fat": "Total Fat",
    "lipids": "Total Fat",
    "saturated fat": "Saturated Fat",
    "saturated fatty acids": "Saturated Fat",
    "sfa": "Saturated Fat",
    "unsaturated fat": "Unsaturated Fat",
    "monounsaturated fat": "Monounsaturated Fat",
    "mufa": "Monounsaturated Fat",
    "polyunsaturated fat": "Polyunsaturated Fat",
    "pufa": "Polyunsaturated Fat",
    "trans fat": "Trans Fat",
    "carbohydrate": "Total Carbohydrates",
    "total carbohydrate": "Total Carbohydrates",
    "carbs": "Total Carbohydrates",
    "available carbohydrates": "Available Carbohydrates",
    "sugar": "Total Sugars",
    "total sugar": "Total Sugars",
    "added sugar": "Added Sugars",
    "dietary fiber": "Dietary Fiber",
    "soluble fiber": "Soluble Fiber",
    "insoluble fiber": "Insoluble Fiber",
    "fos": "FOS",
    "moisture": "Moisture",
    "ash": "Ash",
    "cholesterol": "Cholesterol",
    "energy": "Energy (kcal)",
    "calories": "Energy (kcal)",
    "sodium": "Sodium (Na)",
    "potassium": "Potassium (K)",
    "calcium": "Calcium (Ca)",
    "iron": "Iron (Fe)",
    "zinc": "Zinc (Zn)",
    "magnesium": "Magnesium (Mg)",
    "phosphorus": "Phosphorus (P)",
    "chloride": "Chloride (Cl)",
    "vitamin a": "Vitamin A",
    "vitamin d": "Vitamin D",
    "vitamin d₂": "Vitamin D2",
    "vitamin d2": "Vitamin D2",
    "vitamin d3": "Vitamin D3",
    "vitamin e": "Vitamin E",
    "vitamin c": "Vitamin C",
    "vitamin b1": "Vitamin B1",
    "thiamine": "Vitamin B1",
    "vitamin b2": "Vitamin B2",
    "riboflavin": "Vitamin B2",
    "vitamin b3": "Vitamin B3",
    "niacin": "Vitamin B3",
    "vitamin b5": "Vitamin B5",
    "pantothenic acid": "Vitamin B5",
    "vitamin b6": "Vitamin B6",
    "pyridoxine": "Vitamin B6",
    "vitamin b7": "Biotin",
    "biotin": "Biotin",
    "vitamin b9": "Folic Acid",
    "folic acid": "Folic Acid",
    "folate": "Folic Acid",
    "vitamin b12": "Vitamin B12",
    "cobalamin": "Vitamin B12",
    "vitamin k": "Vitamin K",
    "omega 3": "Omega 3 Fatty Acid",
    "omega 3 fatty acid": "Omega 3 Fatty Acid",
    "omega-3": "Omega 3 Fatty Acid",
    "dha": "DHA",
    "docosahexaenoic acid": "DHA",
    "omega 6": "Omega 6 Fatty Acid",
    "omega 6 fatty acid": "Omega 6 Fatty Acid",
    "omega-6": "Omega 6 Fatty Acid",
    "monounsaturated fatty acid": "Monounsaturated Fatty Acid",
    "polyunsaturated fatty acid": "Polyunsaturated Fatty Acid",
    "iodine": "Iodine",
    "copper": "Copper",
    "chromium": "Chromium",
    "manganese": "Manganese",
    "molybdenum": "Molybdenum",
    "selenium": "Selenium",
    "carnitine": "Carnitine",
    "choline": "Choline",
    "inositol": "Inositol",
    "nucleotides": "Nucleotides",
    "taurine": "Taurine",
}

# ============================================================
# HELPER FUNCTIONS
# ============================================================
FUZZY_THRESHOLD = 85

def preprocess_image_for_ocr(pil_image, save_path=None):
    """
    Enhance image quality for better OCR/AI extraction
    - Aggressive upscaling (2x zoom minimum)
    - Strong sharpening for text clarity
    - Contrast enhancement
    - Noise reduction
    """
    def safe_print(msg):
        try:
            print(msg)
        except UnicodeEncodeError:
            try:
                print(msg.encode('ascii', 'replace').decode('ascii'))
            except:
                print("[IMAGE] (message contains special characters)")
    
    if pil_image.mode != 'RGB':
        pil_image = pil_image.convert('RGB')
    
    width, height = pil_image.size
    
    # AGGRESSIVE UPSCALING: Always upscale by 2x (like zooming in)
    # This helps AI see small text in nutrition tables better
    new_width = int(width * 2)
    new_height = int(height * 2)
    pil_image = pil_image.resize((new_width, new_height), Image.Resampling.LANCZOS)
    safe_print(f"[IMAGE] Upscaled 2x: {width}x{height} → {new_width}x{new_height}")
    
    # Enhance brightness slightly for faded text
    enhancer = ImageEnhance.Brightness(pil_image)
    pil_image = enhancer.enhance(1.1)
    safe_print("[IMAGE] Enhanced brightness (1.1x)")
    
    # Strong contrast for better text separation
    enhancer = ImageEnhance.Contrast(pil_image)
    pil_image = enhancer.enhance(1.8)
    safe_print("[IMAGE] Enhanced contrast (1.8x)")
    
    # Reduce noise before sharpening
    pil_image = pil_image.filter(ImageFilter.MedianFilter(size=3))
    safe_print("[IMAGE] Applied noise reduction")
    
    # STRONG sharpening for crisp text
    enhancer = ImageEnhance.Sharpness(pil_image)
    pil_image = enhancer.enhance(3.0)
    safe_print("[IMAGE] Applied strong sharpening (3.0x)")
    
    # Final edge enhancement for nutrition table borders
    pil_image = pil_image.filter(ImageFilter.EDGE_ENHANCE_MORE)
    safe_print("[IMAGE] Applied edge enhancement")
    
    if save_path:
        pil_image.save(save_path, quality=95)
        safe_print(f"[IMAGE] Saved processed image to: {save_path}")
    
    return pil_image

def convert_energy_kj_to_kcal(nutrition_table):
    for row in nutrition_table:
        name = row.get("nutrient_name", "")
        if re.search(r"\bkj\b", name, flags=re.IGNORECASE):
            values = row.get("values", {})
            amount = values.get("amount")
            if amount is not None:
                kcal = round(amount / 4.184, 2)  
                values["amount"] = kcal
                row["nutrient_name"] = "Energy (kcal)"  

def canonicalize(label):
    label = unicodedata.normalize("NFKC", label)
    label = label.lower()
    SPELLING_MAP = {
        "fibre": "fiber",
    }

    for wrong, correct in SPELLING_MAP.items():
        label = re.sub(rf"\b{wrong}\b", correct, label)

    label = re.sub(r"^-+", "", label)
    label = re.sub(r"\(.*?\)", "", label)
    label = re.sub(r"[^\w\s:\-]", " ", label)
    label = re.sub(r"\b(kcal|kj|mg|g|mcg|ug|[μµ]g|%)\b", "", label)
    label = re.sub(r"^of which\s+", "", label)
    label = re.sub(r"\s+", " ", label).strip()
    words = label.split()
    normalized_words = []
    for w in words:
        if len(w) > 3 and w.endswith("s") and not w.endswith(("ss", "us", "ns")):
            normalized_words.append(w[:-1])
        else:
            normalized_words.append(w)
    return " ".join(normalized_words)

def standardize_nutrition(nutrition_table, nomenclature_map):
    standardized = []
    canonical_nomenclature = {canonicalize(k): v for k, v in nomenclature_map.items()}
    for row in nutrition_table:
        original = row.get("nutrient_name")
        if not original:
            continue

        canon = canonicalize(original)
        standard_name = None
        if canon in canonical_nomenclature:
            standard_name = canonical_nomenclature[canon]
            print(f"Mapping '{original}' → '{standard_name}' (exact match)")

        else:
            best_match = None
            best_score = 0
            for key, value in canonical_nomenclature.items():
                score = fuzz.token_sort_ratio(canon, key)
                if score > best_score:
                    best_score = score
                    best_match = value

            if best_score >= FUZZY_THRESHOLD:
                standard_name = best_match
                print(f"Mapping '{original}' → '{standard_name}' (fuzzy match {best_score:.2f}%)")

        if not standard_name:
            print(f"Adding new nutrient: {original}")
            standard_name = original

        values = row.get("values", {})
        cleaned_values = {}
        for key, value in values.items():
            if value is None or value == "" or value == "null" or value == "-":
                cleaned_values[key] = "not specified"
            else:
                cleaned_values[key] = value
        
        # Skip rows with no meaningful data
        if not any(v != "not specified" for v in cleaned_values.values()):
            continue

        standardized.append({
            "nutrient_name": standard_name,
            "values": cleaned_values,
            "original_name": original
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
      # Handle None values
    input_tokens = input_tokens or 0
    output_tokens = output_tokens or 0
    
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

NUTRITION TABLE - **EXTREMELY CRITICAL - PAY EXTRA ATTENTION**:

**YOU MUST EXTRACT THE COMPLETE NUTRITION TABLE IF IT EXISTS - DO NOT MISS ANY NUTRIENTS**

Look for:
- "Nutritional Information" or "Approximate Composition Per 100 g"
- Table with nutrient names and values
- Usually on back/side of pack
- May have multiple columns for different serving sizes

Table structure:
- Column 1: Nutrient name (e.g., "Protein", "Total Fat", "Saturated Fat")
- Column 2: Per 100g values (most common)
- Column 3: Per Serve values (if present)
- Column 4: % RDA or % Daily Value (if present)

Extract EVERY nutrient row EXACTLY as shown:
[
  {
    "nutrient_name": "Energy (kcal)",
    "values": {
      "Per 100g": "503 kcal",
      "Per Serve (15g)": "75 kcal",
      "% RDA": "4%"
    }
  },
  {
    "nutrient_name": "Protein",
    "values": {
      "Per 100g": "6.4 g",
      "Per Serve (15g)": "1 g",
      "% RDA": "not specified"
    }
  },
  {
    "nutrient_name": "Total Fat",
    "values": {
      "Per 100g": "32.1 g",
      "Per Serve (15g)": "4.8 g",
      "% RDA": "not specified"
    }
  },
  {
    "nutrient_name": "Saturated Fat",
    "values": {
      "Per 100g": "14.2 g",
      "Per Serve (15g)": "2.1 g",
      "% RDA": "not specified"
    }
  }
]

**CRITICAL RULES**:
1. NEVER return [] for nutrition_table if you see a table - this is the MOST IMPORTANT data
2. Extract EVERY SINGLE nutrient row - don't skip any, including vitamins, minerals, and sub-nutrients
3. If a nutrient appears with units in parentheses like "Saturated fat (g)", use ONLY "Saturated fat" as nutrient_name
4. DO NOT create duplicate entries - if you see "Saturated Fat" in one row, don't create another row for "Saturated fat (g)"
5. Each entry MUST have non-null nutrient_name
6. Keep ALL values with units EXACTLY as printed (e.g., "32.1 g", "6.4 g", "29%", "< 0.1 g")
7. If a cell is empty, has "-", or is unclear: use "not specified"
8. **ENERGY EXTRACTION**: ONLY extract what is actually printed:
   - If ONLY "Energy (kcal)" is shown, create ONE entry for "Energy (kcal)"
   - If ONLY "Energy (kJ)" is shown, create ONE entry for "Energy (kJ)"
   - If BOTH are shown in separate rows, create TWO separate entries
   - DO NOT calculate or create missing energy values
9. Pay EXTRA attention to micronutrients (all B vitamins, minerals like Iodine, Copper, Selenium, etc.) - don't miss them
10. If a nutrient has multiple values across columns, capture ALL of them in the values object
11. Handle "less than" values: "< 0.1 g" or "< 1 mg" - extract exactly as shown
12. For ranges: "5-10 mg" - extract exactly as shown
13. If text is blurry/unclear but you can partially read it, extract what you can see and note uncertainty

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
    "dates": {"manufacturing_date": "", "expiry_date": "", "shelf_life": ""},
    "barcode": "",
    "certifications": [],
    "symbols": {"veg_nonveg": "", "recyclable": ""},
    "customer_care": {"phone": [], "email": "", "website": ""},
    "other_important_text": []
  },
  "child_variants": []
}

**OTHER IMPORTANT TEXT**:
- This field captures ALL other important text visible on the package that doesn't fit in other categories
- Include: warnings, disclaimers, quality statements, brand slogans, legal text, etc.
- This will map to "Additional Notes" or "Other Notes" in the frontend
- Extract as an array of strings, each string being a distinct piece of text

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
        
        # Create temp directory for processed images
        import tempfile
        temp_dir = tempfile.mkdtemp(prefix="nutri_processed_")
        safe_print(f"[EXTRACTION] Processed images will be saved to: {temp_dir}")
        
        # Load and validate images
        pil_images = []
        processed_image_paths = []
        for idx, img in enumerate(images):
            try:
                safe_print(f"[EXTRACTION] Loading image {idx + 1}/{len(images)}: {img.filename}")
                content = await img.read()
                pil_img = Image.open(BytesIO(content))
                safe_print(f"[EXTRACTION] Image {idx + 1} loaded: {pil_img.size} pixels")
                
                # Preprocess image for better OCR accuracy
                safe_print(f"[EXTRACTION] Preprocessing image {idx + 1} for OCR...")
                processed_path = os.path.join(temp_dir, f"processed_{idx + 1}_{img.filename}")
                pil_img = preprocess_image_for_ocr(pil_img, save_path=processed_path)
                processed_image_paths.append(processed_path)
                safe_print(f"[EXTRACTION] Image {idx + 1} preprocessed: {pil_img.size} pixels")
                
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
        
        if "nutrition_table" in parent:
            safe_print("[EXTRACTION] Converting energy from kJ to kcal if needed...")
            convert_energy_kj_to_kcal(parent["nutrition_table"])
            safe_print("[EXTRACTION] Standardizing nutrition table...")
            parent["nutrition_table"] = standardize_nutrition(
                parent["nutrition_table"], 
                NOMENCLATURE_MAP
            )
        
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
        
        # Get shelf life from extraction or calculate if not provided
        shelf_life = parent.get("dates", {}).get("shelf_life", "") or parent.get("shelf_life", "")
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
                                shelf_life = f"{months} months"
                            else:
                                shelf_life = f"{days_diff} days"
                            break
                        except ValueError:
                            continue
                except:
                    pass
        
        # Store shelf_life in both locations for compatibility
        if shelf_life:
            parent["shelf_life"] = shelf_life
            if "dates" in parent:
                parent["dates"]["shelf_life"] = shelf_life
        
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
            "dates": parent.get("dates", {}),
            "other": parent.get("other_important_text", []),
            "raw": product_data,  # Keep raw data for reference
            "processed_images": processed_image_paths,  # Paths to view enhanced images
        }
        
        safe_print("[EXTRACTION] SUCCESS - Extraction completed successfully!")
        safe_print(f"[EXTRACTION] View processed images at: {temp_dir}")
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

