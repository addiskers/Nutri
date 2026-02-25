"""
COA Routes - Certificate of Analysis Extraction and Management
"""
import os
import re
import json
import fitz  # PyMuPDF for PDF handling
from io import BytesIO
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel
from PIL import Image

from app.models.user import User
from app.models.coa import COA
from app.dependencies.auth import get_current_user
from config.settings import settings

router = APIRouter(prefix="/coa", tags=["COA"])

# ============================================================
# CONFIGURATION
# ============================================================
GEMINI_MODEL = "gemini-2.5-flash"

PRICING = {
    "input": 0.30,
    "output": 2.50,
}

# ============================================================
# NOMENCLATURE MAPPING (COA specific)
# ============================================================
NOMENCLATURE_MAP = {
    # Proteins
    "protein": "Protein",
    "proteins": "Protein",
    "crude protein": "Protein",
    "total protein": "Protein",
    "protein (n x 6.25)": "Protein",
    "protein (dry basis)": "Protein (Dry Basis)",
    "protein (wet basis)": "Protein (Wet Basis)",
    # Fats
    "fat": "Total Fat",
    "fats": "Total Fat",
    "total fat": "Total Fat",
    "crude fat": "Total Fat",
    "lipids": "Total Fat",
    "total lipids": "Total Fat",
    # Saturated Fat
    "saturated fat": "Saturated Fat",
    "saturated fatty acids": "Saturated Fat",
    "sfa": "Saturated Fat",
    "saturated fats": "Saturated Fat",
    # Monounsaturated Fat
    "monounsaturated fat": "Monounsaturated Fat",
    "monounsaturated fatty acids": "Monounsaturated Fat",
    "mufa": "Monounsaturated Fat",
    # Polyunsaturated Fat
    "polyunsaturated fat": "Polyunsaturated Fat",
    "polyunsaturated fatty acids": "Polyunsaturated Fat",
    "pufa": "Polyunsaturated Fat",
    # Specific PUFAs
    "linoleic acid": "Linoleic Acid",
    "alpha linolenic acid": "Alpha-Linolenic Acid",
    "alpha-linolenic acid": "Alpha-Linolenic Acid",
    "ala": "Alpha-Linolenic Acid",
    "dha": "DHA",
    "docosahexaenoic acid": "DHA",
    "epa": "EPA",
    "eicosapentaenoic acid": "EPA",
    # Trans Fat
    "trans fat": "Trans Fat",
    "trans fatty acids": "Trans Fat",
    "trans fats": "Trans Fat",
    # Carbohydrates
    "carbohydrate": "Total Carbohydrates",
    "carbohydrates": "Total Carbohydrates",
    "total carbohydrate": "Total Carbohydrates",
    "total carbohydrates": "Total Carbohydrates",
    "carbs": "Total Carbohydrates",
    # Sugars
    "sugar": "Total Sugars",
    "sugars": "Total Sugars",
    "total sugar": "Total Sugars",
    "total sugars": "Total Sugars",
    "added sugar": "Added Sugars",
    "added sugars": "Added Sugars",
    "sucrose": "Sucrose",
    "added sucrose": "Added Sucrose",
    # Fiber
    "dietary fiber": "Dietary Fiber",
    "dietary fibre": "Dietary Fiber",
    "total dietary fiber": "Dietary Fiber",
    "fiber": "Dietary Fiber",
    "fibre": "Dietary Fiber",
    "soluble fiber": "Soluble Fiber",
    "soluble fibre": "Soluble Fiber",
    "insoluble fiber": "Insoluble Fiber",
    "insoluble fibre": "Insoluble Fiber",
    "fos": "FOS (Fructooligosaccharides)",
    "fructooligosaccharides": "FOS (Fructooligosaccharides)",
    # Moisture/Ash
    "moisture": "Moisture",
    "moisture content": "Moisture",
    "ash": "Ash",
    "total ash": "Ash",
    # Cholesterol
    "cholesterol": "Cholesterol",
    # Energy
    "energy": "Energy",
    "calories": "Energy",
    "calorific value": "Energy",
    "energy value": "Energy",
    # Minerals
    "sodium": "Sodium",
    "na": "Sodium",
    "potassium": "Potassium",
    "k": "Potassium",
    "calcium": "Calcium",
    "ca": "Calcium",
    "iron": "Iron",
    "fe": "Iron",
    "zinc": "Zinc",
    "zn": "Zinc",
    "magnesium": "Magnesium",
    "phosphorus": "Phosphorus",
    "p": "Phosphorus",
    "chloride": "Chloride",
    "cl": "Chloride",
    # Vitamins
    "vitamin a": "Vitamin A",
    "vit a": "Vitamin A",
    "retinol": "Vitamin A",
    "vitamin d": "Vitamin D",
    "vit d": "Vitamin D",
    "vitamin d3": "Vitamin D3",
    "cholecalciferol": "Vitamin D3",
    "vitamin e": "Vitamin E",
    "vit e": "Vitamin E",
    "tocopherol": "Vitamin E",
    "alpha tocopherol": "Vitamin E",
    "vitamin c": "Vitamin C",
    "vit c": "Vitamin C",
    "ascorbic acid": "Vitamin C",
    "vitamin b1": "Vitamin B1",
    "thiamine": "Vitamin B1",
    "thiamin": "Vitamin B1",
    "vitamin b2": "Vitamin B2",
    "riboflavin": "Vitamin B2",
    "vitamin b3": "Vitamin B3",
    "niacin": "Vitamin B3",
    "nicotinic acid": "Vitamin B3",
    "vitamin b6": "Vitamin B6",
    "pyridoxine": "Vitamin B6",
    "vitamin b12": "Vitamin B12",
    "cobalamin": "Vitamin B12",
    "cyanocobalamin": "Vitamin B12",
    "folic acid": "Folic Acid",
    "folate": "Folic Acid",
    "vitamin b9": "Folic Acid",
    "biotin": "Biotin",
    "vitamin b7": "Biotin",
    "pantothenic acid": "Pantothenic Acid",
    "vitamin b5": "Pantothenic Acid",
    "vitamin d2": "Vitamin D2",
    "ergocalciferol": "Vitamin D2",
    "vitamin k": "Vitamin K",
    "phylloquinone": "Vitamin K",
    # Omega Fatty Acids
    "omega 3": "Omega 3 Fatty Acid",
    "omega-3": "Omega 3 Fatty Acid",
    "omega 3 fatty acid": "Omega 3 Fatty Acid",
    "omega 3 fatty acids": "Omega 3 Fatty Acid",
    "n-3 fatty acids": "Omega 3 Fatty Acid",
    "omega 6": "Omega 6 Fatty Acid",
    "omega-6": "Omega 6 Fatty Acid",
    "omega 6 fatty acid": "Omega 6 Fatty Acid",
    "omega 6 fatty acids": "Omega 6 Fatty Acid",
    "n-6 fatty acids": "Omega 6 Fatty Acid",
    # Trace Minerals
    "iodine": "Iodine",
    "i": "Iodine",
    "copper": "Copper",
    "cu": "Copper",
    "chromium": "Chromium",
    "cr": "Chromium",
    "manganese": "Manganese",
    "mn": "Manganese",
    "molybdenum": "Molybdenum",
    "mo": "Molybdenum",
    "selenium": "Selenium",
    "se": "Selenium",
    # Other Nutrients
    "carnitine": "Carnitine",
    "l-carnitine": "Carnitine",
    "choline": "Choline",
    "inositol": "Inositol",
    "myo-inositol": "Inositol",
    "nucleotides": "Nucleotides",
    "total nucleotides": "Nucleotides",
    "taurine": "Taurine",
}

# Target units for normalization
TARGET_UNITS = {
    "Protein": "g", "Protein (Dry Basis)": "g", "Protein (Wet Basis)": "g",
    "Total Fat": "g", "Saturated Fat": "g", "Monounsaturated Fat": "g",
    "Polyunsaturated Fat": "g", "Linoleic Acid": "g", "Alpha-Linolenic Acid": "g",
    "DHA": "mg", "EPA": "mg", "Trans Fat": "g",
    "Total Carbohydrates": "g", "Total Sugars": "g", "Added Sugars": "g",
    "Sucrose": "g", "Added Sucrose": "g",
    "Dietary Fiber": "g", "Soluble Fiber": "g", "Insoluble Fiber": "g",
    "FOS (Fructooligosaccharides)": "g", "Moisture": "g", "Ash": "g",
    "Cholesterol": "mg", "Energy": "kcal",
    "Sodium": "mg", "Potassium": "mg", "Calcium": "mg", "Iron": "mg",
    "Zinc": "mg", "Magnesium": "mg", "Phosphorus": "mg", "Chloride": "mg",
    "Vitamin A": "mcg", "Vitamin D": "mcg", "Vitamin D2": "mcg", "Vitamin D3": "mcg", 
    "Vitamin E": "mg", "Vitamin K": "mcg",
    "Vitamin C": "mg", "Vitamin B1": "mg", "Vitamin B2": "mg", "Vitamin B3": "mg",
    "Vitamin B6": "mg", "Vitamin B12": "mcg", "Folic Acid": "mcg",
    "Biotin": "mcg", "Pantothenic Acid": "mg",
    "Omega 3 Fatty Acid": "g", "Omega 6 Fatty Acid": "g",
    "Iodine": "mcg", "Copper": "mcg", "Chromium": "mcg", "Manganese": "mg",
    "Molybdenum": "mcg", "Selenium": "mcg",
    "Carnitine": "mg", "Choline": "mg", "Inositol": "mg", "Nucleotides": "mg", "Taurine": "mg",
}

UNIT_CONVERSIONS = {
    "kg": 1000, "g": 1, "gm": 1, "gram": 1, "grams": 1,
    "mg": 0.001, "milligram": 0.001, "milligrams": 0.001,
    "mcg": 0.000001, "μg": 0.000001, "µg": 0.000001, "ug": 0.000001,
    "microgram": 0.000001, "micrograms": 0.000001,
    "kcal": 1, "cal": 0.001, "kj": 0.239006,
    "kilojoule": 0.239006, "kilojoules": 0.239006,
    "iu": 0.3,  # For Vitamin A: 1 IU = 0.3 mcg retinol
}


# ============================================================
# HELPER FUNCTIONS
# ============================================================
def calculate_cost(input_tokens: int, output_tokens: int) -> dict:
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


def standardize_nutrient_name(raw_name: str) -> str:
    """Map raw nutrient name to standardized name"""
    cleaned = raw_name.lower().strip()
    cleaned = re.sub(r"\s*\(.*?\)\s*", " ", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return NOMENCLATURE_MAP.get(cleaned, raw_name.title())


def normalize_unit(value: float, from_unit: str, nutrient_name: str) -> tuple:
    """Convert value from source unit to target unit"""
    from_unit_lower = from_unit.lower().strip()
    target_unit = TARGET_UNITS.get(nutrient_name, "g")
    
    if from_unit_lower == target_unit.lower():
        return value, target_unit
    
    from_factor = UNIT_CONVERSIONS.get(from_unit_lower, 1)
    to_factor = UNIT_CONVERSIONS.get(target_unit.lower(), 1)
    
    if to_factor != 0:
        normalized_value = (value * from_factor) / to_factor
    else:
        normalized_value = value
    
    return round(normalized_value, 6), target_unit


def get_nutrient_category(nutrient_name: str) -> str:
    """Categorize nutrient for organization"""
    categories = {
        "Macronutrient": ["Protein", "Total Fat", "Total Carbohydrates", "Energy", "Moisture", "Ash"],
        "Fat - Saturated": ["Saturated Fat"],
        "Fat - Unsaturated": ["Monounsaturated Fat", "Polyunsaturated Fat", "Linoleic Acid", 
                             "Alpha-Linolenic Acid", "DHA", "EPA"],
        "Fat - Trans": ["Trans Fat"],
        "Carbohydrate - Sugar": ["Total Sugars", "Added Sugars", "Sucrose", "Added Sucrose"],
        "Carbohydrate - Fiber": ["Dietary Fiber", "Soluble Fiber", "Insoluble Fiber", 
                                  "FOS (Fructooligosaccharides)"],
        "Mineral": ["Sodium", "Potassium", "Calcium", "Iron", "Zinc", "Magnesium", 
                   "Phosphorus", "Chloride", "Cholesterol"],
        "Vitamin - Fat Soluble": ["Vitamin A", "Vitamin D", "Vitamin D3", "Vitamin E"],
        "Vitamin - Water Soluble": ["Vitamin C", "Vitamin B1", "Vitamin B2", "Vitamin B3",
                                     "Vitamin B6", "Vitamin B12", "Folic Acid", "Biotin", 
                                     "Pantothenic Acid"],
    }
    
    for category, nutrients in categories.items():
        if nutrient_name in nutrients:
            return category
    return "Other"


def process_extracted_coa(raw_data: dict) -> dict:
    """Post-process extracted COA data: standardize names and normalize units"""
    processed = raw_data.copy()
    
    if "nutritional_data" not in processed:
        return processed
    
    normalized_nutrients = []
    
    for nutrient in processed["nutritional_data"]:
        raw_name = nutrient.get("nutrient_name_raw", nutrient.get("nutrient_name", ""))
        std_name = standardize_nutrient_name(raw_name)
        raw_unit = nutrient.get("unit", nutrient.get("unit_raw", "g"))
        
        normalized_nutrient = {
            "nutrient_name": std_name,
            "nutrient_name_raw": raw_name,
            "category": get_nutrient_category(std_name),
        }
        
        # Normalize values
        for value_key in ["min_value", "max_value", "actual_value"]:
            if nutrient.get(value_key) is not None:
                try:
                    val = float(nutrient[value_key])
                    norm_val, norm_unit = normalize_unit(val, raw_unit, std_name)
                    normalized_nutrient[value_key] = norm_val
                except (ValueError, TypeError):
                    normalized_nutrient[value_key] = None
            else:
                normalized_nutrient[value_key] = None
        
        # Set target unit
        normalized_nutrient["unit"] = TARGET_UNITS.get(std_name, "g")
        normalized_nutrient["unit_raw"] = raw_unit
        normalized_nutrient["basis"] = "per 100g"
        
        # Calculate average if range exists
        if normalized_nutrient["min_value"] and normalized_nutrient["max_value"]:
            normalized_nutrient["average_value"] = round(
                (normalized_nutrient["min_value"] + normalized_nutrient["max_value"]) / 2, 6
            )
        else:
            normalized_nutrient["average_value"] = None
        
        # Preserve other fields
        for key in ["source_section", "notes"]:
            if key in nutrient:
                normalized_nutrient[key] = nutrient[key]
        
        normalized_nutrients.append(normalized_nutrient)
    
    processed["nutritional_data"] = normalized_nutrients
    processed["processing_status"] = "normalized"
    
    return processed


# ============================================================
# COA EXTRACTION PROMPT
# ============================================================
COA_EXTRACTION_PROMPT = """Extract complete nutritional data from this Certificate of Analysis (COA) document.

CRITICAL: Return ONLY raw JSON. DO NOT wrap in markdown code fences. Start with { and end with }.

DOCUMENT SECTIONS TO FOCUS ON:
1. Physical and Chemical Parameters / Specifications
2. Nutritional Information / Analysis Results
3. Product/Ingredient Identification

EXTRACTION RULES:

1. INGREDIENT IDENTIFICATION:
   - Extract the product/ingredient name exactly as stated
   - Extract lot/batch number if present
   - Extract manufacturer/supplier name
   - Extract storage condition/instructions if visible (e.g. "Store in cool dry place")
   - ALL DATES must be in DD/MM/YYYY format

2. NUTRIENT VALUES - CRITICAL:
   For EACH nutrient found, extract THREE possible values:
   
   a) RANGE VALUES (from specifications/limits):
      - "min_value": Lower limit (e.g., from "4-6%", min is 4)
      - "max_value": Upper limit (e.g., from "4-6%", max is 6)
      - Look for: "Specification", "Limits", "Range", "Min", "Max"
   
   b) ACTUAL/ANALYZED VALUE:
      - "actual_value": The tested/analyzed result
      - Look for: "Result", "Actual", "Typical", "Nutritional Information", "Analysis"
   
   c) UNIT:
      - Extract exact unit as printed (g, mg, mcg, %, kcal, kJ, IU)
      - Note: Values given as "%" are per 100g basis

3. RANGE DETECTION PATTERNS:
   - "4 - 6" or "4-6" or "4 to 6" → min: 4, max: 6
   - "Min 4" or "≥4" or ">4" → min: 4, max: null
   - "Max 6" or "≤6" or "<6" → min: null, max: 6
   - "< 1.0" or "less than 1" → actual: 1.0 (use limit as actual)
   - Single value "34.5" → actual: 34.5

4. NUTRIENTS TO EXTRACT (if present):
   
   MACRONUTRIENTS:
   - Moisture, Protein, Total Fat, Saturated Fat, Trans Fat
   - Total Carbohydrates, Total Sugars, Dietary Fiber
   - Cholesterol, Ash, Energy
   
   MINERALS:
   - Sodium, Potassium, Calcium, Iron, Zinc
   - Magnesium, Phosphorus, Chloride
   
   VITAMINS:
   - Vitamin A, D, E, C
   - B-vitamins (B1, B2, B3, B6, B12)
   - Folic Acid, Biotin, Pantothenic Acid

JSON STRUCTURE:
{
  "document_type": "COA",
  "extraction_date": "YYYY-MM-DD",
  
  "ingredient_info": {
    "ingredient_name": "exact name from document",
    "product_code": "if present or null",
    "lot_number": "batch/lot number or null",
    "manufacturing_date": "DD/MM/YYYY or null",
    "expiry_date": "DD/MM/YYYY or null",
    "shelf_life": "Extract if printed (e.g., '18 months', '2 years'). If not visible, calculate from manufacturing to expiry date difference in months",
    "supplier_name": "manufacturer/supplier or null",
    "supplier_address": "if present or null",
    "storage_condition": "storage instructions if present or empty string"
  },
  
  "nutritional_data": [
    {
      "nutrient_name": "Protein",
      "nutrient_name_raw": "exact name as printed",
      "min_value": 4.0,
      "max_value": 6.0,
      "actual_value": 4.57,
      "unit": "g",
      "unit_raw": "% or g/100g",
      "basis": "per 100g",
      "source_section": "Physical Parameters / Nutritional Info",
      "notes": "any relevant notes"
    }
  ],
  
  "other_parameters": [
    {
      "parameter_name": "pH",
      "value": "6.5",
      "specification": "6.0-7.0"
    }
  ],
  
  "certifications": [],
  "analysis_method": "if mentioned",
  "additional_notes": []
}

RULES:
1. If a value is not present, use null (not "not specified" for numeric fields)
2. If only range is given (no actual), leave actual_value as null
3. If only actual is given (no range), leave min_value and max_value as null
4. Preserve exact nutrient names in "nutrient_name_raw"
5. For "< X" values, store X as actual_value with note "less than"

Return ONLY the JSON structure above."""


# ============================================================
# SCHEMAS
# ============================================================
class ExtractedCOAData(BaseModel):
    """Response schema for extracted COA data"""
    success: bool
    data: Optional[dict] = None
    error: Optional[str] = None
    cost: Optional[dict] = None


class COACreate(BaseModel):
    """Schema for creating a COA entry"""
    ingredient_name: str
    product_code: Optional[str] = None
    lot_number: Optional[str] = None
    manufacturing_date: Optional[str] = None
    expiry_date: Optional[str] = None
    supplier_name: Optional[str] = None
    supplier_address: Optional[str] = None
    storage_condition: Optional[str] = None
    nutritional_data: List[dict] = []
    other_parameters: List[dict] = []
    certifications: List[str] = []
    analysis_method: Optional[str] = None
    additional_notes: List[str] = []
    document_images: List[str] = []
    status: str = "active"


class COAResponse(BaseModel):
    """Response schema for COA"""
    id: str
    ingredient_name: str
    supplier_name: Optional[str]
    lot_number: Optional[str]
    status: str
    created_at: datetime


# ============================================================
# ROUTES
# ============================================================

@router.post("/extract", response_model=ExtractedCOAData)
async def extract_coa_from_images(
    images: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_user)
):
    """
    Extract COA data from uploaded images using Gemini AI
    
    - Accepts multiple COA images (PDF pages or images)
    - Returns structured nutritional data
    - User can review and edit before saving
    """
    def safe_print(msg):
        try:
            print(msg)
        except UnicodeEncodeError:
            try:
                print(msg.encode('ascii', 'replace').decode('ascii'))
            except:
                print("[LOG] (message contains special characters)")
    
    safe_print("\n" + "="*60)
    safe_print("[COA EXTRACTION] ===== NEW COA EXTRACTION REQUEST =====")
    safe_print("="*60)
    
    try:
        safe_print(f"[COA EXTRACTION] User: {current_user.email}")
        safe_print(f"[COA EXTRACTION] Number of images received: {len(images)}")
        
        # Check API key
        api_key = settings.GEMINI_API_KEY
        if not api_key:
            safe_print("[ERROR] Gemini API key not configured")
            raise HTTPException(
                status_code=500, 
                detail="Gemini API key not configured. Please set GEMINI_API_KEY in environment."
            )
        
        # Validate file count
        if len(images) == 0:
            raise HTTPException(status_code=400, detail="At least one file is required")
        if len(images) > 15:
            raise HTTPException(status_code=400, detail="Maximum 15 files allowed")
        
        # Load and validate images (including PDF conversion)
        pil_images = []
        for idx, img in enumerate(images):
            try:
                safe_print(f"[COA EXTRACTION] Loading file {idx + 1}/{len(images)}: {img.filename}")
                content = await img.read()
                
                # Check if it's a PDF
                if img.filename.lower().endswith('.pdf'):
                    safe_print(f"[COA EXTRACTION] Converting PDF to images...")
                    # Use PyMuPDF to convert PDF pages to images
                    pdf_document = fitz.open(stream=content, filetype="pdf")
                    total_pages = len(pdf_document)
                    
                    for page_num in range(total_pages):
                        page = pdf_document[page_num]
                        # Render page to image at 300 DPI for good quality
                        mat = fitz.Matrix(300 / 72, 300 / 72)  # 300 DPI
                        pix = page.get_pixmap(matrix=mat)
                        
                        # Convert to PIL Image
                        img_data = pix.tobytes("png")
                        pil_img = Image.open(BytesIO(img_data))
                        pil_images.append(pil_img)
                        safe_print(f"[COA EXTRACTION] PDF page {page_num + 1}/{total_pages} converted: {pil_img.size} pixels")
                    
                    pdf_document.close()
                    safe_print(f"[COA EXTRACTION] PDF converted successfully: {total_pages} pages")
                else:
                    # Regular image file
                    pil_img = Image.open(BytesIO(content))
                    pil_images.append(pil_img)
                    safe_print(f"[COA EXTRACTION] Image {idx + 1} loaded: {pil_img.size} pixels")
                    
            except Exception as e:
                safe_print(f"[ERROR] Failed to load file {img.filename}: {str(e)}")
                raise HTTPException(
                    status_code=400, 
                    detail=f"Invalid file: {img.filename}. Error: {str(e)}"
                )
        
        # Call Gemini API
        safe_print("[COA EXTRACTION] Initializing Gemini client...")
        from google import genai
        
        client = genai.Client(api_key=api_key)
        content = [COA_EXTRACTION_PROMPT] + pil_images
        
        safe_print(f"[COA EXTRACTION] Calling Gemini API with model: {GEMINI_MODEL}")
        
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
        
        safe_print("[COA EXTRACTION] Response received from Gemini API")
        
        # Calculate cost
        usage = response.usage_metadata
        cost_info = calculate_cost(usage.prompt_token_count, usage.candidates_token_count)
        safe_print(f"[COA EXTRACTION] Estimated cost: ${cost_info['total_cost']:.4f}")
        
        # Parse response
        raw_json = response.text.strip()
        
        # Clean markdown if present
        if raw_json.startswith("```"):
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
        
        coa_data = json.loads(raw_json)
        safe_print("[COA EXTRACTION] JSON parsed successfully")
        
        # Post-process the data
        processed_data = process_extracted_coa(coa_data)
        
        # Transform to frontend-friendly format
        ingredient_info = processed_data.get("ingredient_info", {})
        
        transformed_data = {
            "ingredient_info": {
                "ingredient_name": ingredient_info.get("ingredient_name", ""),
                "product_code": ingredient_info.get("product_code"),
                "lot_number": ingredient_info.get("lot_number"),
                "manufacturing_date": ingredient_info.get("manufacturing_date"),
                "expiry_date": ingredient_info.get("expiry_date"),
                "shelf_life": ingredient_info.get("shelf_life"),
                "supplier_name": ingredient_info.get("supplier_name"),
                "supplier_address": ingredient_info.get("supplier_address"),
                "storage_condition": ingredient_info.get("storage_condition", ""),
            },
            "nutritional_data": processed_data.get("nutritional_data", []),
            "other_parameters": processed_data.get("other_parameters", []),
            "certifications": processed_data.get("certifications", []),
            "analysis_method": processed_data.get("analysis_method"),
            "additional_notes": processed_data.get("additional_notes", []),
            "raw": coa_data,  # Keep raw data for reference
        }
        
        safe_print("[COA EXTRACTION] SUCCESS - Extraction completed!")
        return ExtractedCOAData(
            success=True,
            data=transformed_data,
            cost=cost_info
        )
        
    except json.JSONDecodeError as e:
        safe_print(f"[ERROR] JSON parsing failed: {str(e)}")
        return ExtractedCOAData(
            success=False,
            error=f"Failed to parse AI response: {str(e)}"
        )
    except HTTPException:
        raise
    except Exception as e:
        safe_print(f"[ERROR] COA Extraction failed: {str(e)}")
        error_msg = f"{type(e).__name__}: {str(e)}"
        return ExtractedCOAData(
            success=False,
            error=f"Extraction failed: {error_msg}"
        )


@router.post("", response_model=dict)
async def create_coa(
    coa: COACreate,
    current_user: User = Depends(get_current_user)
):
    """Create a new COA entry"""
    try:
        # Build master entry for formulation calculations
        master_entry = {
            "ingredient_name": coa.ingredient_name,
            "product_code": coa.product_code,
            "lot_number": coa.lot_number,
            "supplier": coa.supplier_name,
            "nutrients": {}
        }
        
        for nutrient in coa.nutritional_data:
            name = nutrient.get("nutrient_name", "")
            if name:
                master_entry["nutrients"][name] = {
                    "min": nutrient.get("min_value"),
                    "max": nutrient.get("max_value"),
                    "actual": nutrient.get("actual_value"),
                    "average": nutrient.get("average_value"),
                    "unit": nutrient.get("unit"),
                    "category": nutrient.get("category"),
                }
        
        new_coa = COA(
            ingredient_name=coa.ingredient_name,
            product_code=coa.product_code,
            lot_number=coa.lot_number,
            manufacturing_date=coa.manufacturing_date,
            expiry_date=coa.expiry_date,
            supplier_name=coa.supplier_name,
            supplier_address=coa.supplier_address,
            storage_condition=coa.storage_condition,
            nutritional_data=coa.nutritional_data,
            other_parameters=coa.other_parameters,
            certifications=coa.certifications,
            analysis_method=coa.analysis_method,
            additional_notes=coa.additional_notes,
            document_images=coa.document_images,
            extraction_date=datetime.utcnow().strftime("%Y-%m-%d"),
            master_entry=master_entry,
            status=coa.status,
            created_by=str(current_user.id),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        await new_coa.insert()
        
        return {
            "success": True,
            "message": "COA created successfully",
            "coa_id": str(new_coa.id)
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create COA: {str(e)}")


@router.get("", response_model=dict)
async def list_coas(
    skip: int = 0,
    limit: int = 50,
    search: Optional[str] = None,
    status: Optional[str] = None
):
    """List all COA entries with optional filters"""
    try:
        query = {}
        
        if status:
            query["status"] = status
        if search:
            query["$or"] = [
                {"ingredient_name": {"$regex": search, "$options": "i"}},
                {"supplier_name": {"$regex": search, "$options": "i"}},
                {"lot_number": {"$regex": search, "$options": "i"}}
            ]
        
        coas = await COA.find(query).skip(skip).limit(limit).to_list()
        total = await COA.find(query).count()
        
        return {
            "coas": [
                {
                    "id": str(c.id),
                    "ingredient_name": c.ingredient_name,
                    "supplier_name": c.supplier_name,
                    "lot_number": c.lot_number,
                    "product_code": c.product_code,
                    "manufacturing_date": c.manufacturing_date,
                    "expiry_date": c.expiry_date,
                    "storage_condition": c.storage_condition,
                    "status": c.status,
                    "nutrients_count": len(c.nutritional_data) if c.nutritional_data else 0,
                    "has_documents": bool(c.document_images and len(c.document_images) > 0),
                    "documents_count": len(c.document_images) if c.document_images else 0,
                    "created_at": c.created_at.isoformat(),
                    "nutritional_data": c.nutritional_data,
                }
                for c in coas
            ],
            "total": total,
            "skip": skip,
            "limit": limit
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch COAs: {str(e)}")


@router.get("/{coa_id}", response_model=dict)
async def get_coa(
    coa_id: str,
    current_user: User = Depends(get_current_user)
):
    """Get a single COA by ID"""
    try:
        from bson import ObjectId
        coa = await COA.get(ObjectId(coa_id))
        
        if not coa:
            raise HTTPException(status_code=404, detail="COA not found")
        
        return {
            "id": str(coa.id),
            "ingredient_name": coa.ingredient_name,
            "product_code": coa.product_code,
            "lot_number": coa.lot_number,
            "manufacturing_date": coa.manufacturing_date,
            "expiry_date": coa.expiry_date,
            "supplier_name": coa.supplier_name,
            "supplier_address": coa.supplier_address,
            "storage_condition": coa.storage_condition,
            "nutritional_data": coa.nutritional_data,
            "other_parameters": coa.other_parameters,
            "certifications": coa.certifications,
            "analysis_method": coa.analysis_method,
            "additional_notes": coa.additional_notes,
            "document_images": coa.document_images,
            "master_entry": coa.master_entry,
            "status": coa.status,
            "created_at": coa.created_at.isoformat(),
            "updated_at": coa.updated_at.isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch COA: {str(e)}")


@router.put("/{coa_id}", response_model=dict)
async def update_coa(
    coa_id: str,
    coa_update: COACreate,
    current_user: User = Depends(get_current_user)
):
    """Update a COA entry"""
    try:
        from bson import ObjectId
        coa = await COA.get(ObjectId(coa_id))
        
        if not coa:
            raise HTTPException(status_code=404, detail="COA not found")
        
        update_data = coa_update.model_dump(exclude_unset=True)
        update_data["updated_at"] = datetime.utcnow()
        
        # Rebuild master entry
        master_entry = {
            "ingredient_name": coa_update.ingredient_name,
            "product_code": coa_update.product_code,
            "lot_number": coa_update.lot_number,
            "supplier": coa_update.supplier_name,
            "nutrients": {}
        }
        
        for nutrient in coa_update.nutritional_data:
            name = nutrient.get("nutrient_name", "")
            if name:
                master_entry["nutrients"][name] = {
                    "min": nutrient.get("min_value"),
                    "max": nutrient.get("max_value"),
                    "actual": nutrient.get("actual_value"),
                    "average": nutrient.get("average_value"),
                    "unit": nutrient.get("unit"),
                }
        
        update_data["master_entry"] = master_entry
        
        for field, value in update_data.items():
            setattr(coa, field, value)
        
        await coa.save()
        
        return {
            "success": True,
            "message": "COA updated successfully",
            "coa_id": str(coa.id)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update COA: {str(e)}")


@router.delete("/{coa_id}", response_model=dict)
async def delete_coa(
    coa_id: str,
    current_user: User = Depends(get_current_user)
):
    """Delete a COA entry"""
    try:
        from bson import ObjectId
        coa = await COA.get(ObjectId(coa_id))
        
        if not coa:
            raise HTTPException(status_code=404, detail="COA not found")
        
        await coa.delete()
        
        return {
            "success": True,
            "message": "COA deleted successfully"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete COA: {str(e)}")

