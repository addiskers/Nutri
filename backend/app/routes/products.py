"""
Product Routes - Two-Step OCR + Structure Pipeline
"""
import asyncio
import os
import re
import unicodedata
from rapidfuzz import fuzz
import json
from io import BytesIO
from typing import List, Optional
from datetime import datetime
from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from pydantic import BaseModel
from PIL import Image
from app.models.user import User
from app.models.product import Product
from app.dependencies.auth import get_current_user

router = APIRouter(prefix="/products", tags=["Products"])

from config.settings import settings

# ============================================================
# CONFIGURATION
# ============================================================
OCR_MODEL       = "gemini-3-flash-preview"
STRUCTURE_MODEL = "gemini-3.1-flash-lite-preview"

PRICING = {
    "ocr":       {"input": 0.50, "output": 3.00},
    "structure": {"input": 0.25, "output": 1.50},
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
# OCR PROMPT
# ============================================================
OCR_PROMPT = """
Extract all text exactly as visible in the image.

ANTI-HALLUCINATION RULE (CRITICAL):
You are a strict OCR engine.

- Extract ONLY characters that are physically visible.
- Never infer, reconstruct, or complete missing words, numbers, or table rows.
- If text is partially visible → extract only the visible part.
- If a value is unclear → write NA.

Never generate nutrition values, ingredients, or numbers that are not visible.
Never use food knowledge to complete nutrition tables.

--------------------------------------------------
NUMERIC AUTHENTICITY RULE (CRITICAL):

Long numeric sequences (8+ digits) must be copied ONLY if every digit is clearly visible.

Rules:
- Do NOT guess or complete digits.
- If any digit is unclear → output NA.
- Never generate regulatory numbers (FSSAI, GST, barcode, batch, phone) from context.

--------------------------------------------------
CROSSED-OUT / CANCELLED TEXT DETECTION:

Mark text as:
[CROSSED: text]

ONLY when clearly cancelled by:
1. Horizontal strike line through text
2. Two diagonal lines forming X
3. Marker/pen cancellation line across text

Strict rules:
- Line must visibly cross the text
- Line must be separate from characters
- Symbols like *, #, ^ near a price are NOT cancellation
- Dot-matrix printing or random dots are NOT strikethrough
- If unsure → treat as normal text

Examples:
₹50 with strike line → [CROSSED: ₹50]
MRP ₹120 with X mark → [CROSSED: MRP ₹120]

--------------------------------------------------
TABLE EXTRACTION:

Apply table formatting ONLY if a table is clearly visible.

For visible tables (nutrition or ingredients):

<label> | <value1> | <value2> | <value3>

Rules:
- Extract ONLY visible rows
- If a value cell is unreadable → NA
- NEVER create new rows
- NEVER fill missing values

--------------------------------------------------
NUTRITION EXTRACTION GATE:

Output nutrition rows ONLY if the image contains one of these headers:

- Nutrition
- Nutrition Facts
- Nutritional Information

If none are visible → DO NOT output nutrition rows.

--------------------------------------------------
SYMBOL EXTRACTION RULES:

Capture ALL symbols exactly as printed.

Must extract symbols such as:
*, #, ^, ~, †, ‡, ※, ⁂, °, +, ', ", •, ·

Rules:
- Preserve symbol placement exactly
- Extract even faint or tiny symbols
- Do NOT ignore superscripts or micro-marks
- Do NOT remove symbols near claims, ingredients, or nutrition values

--------------------------------------------------
GRAPHICAL ICON RULE:
- If an icon appears on the packaging:
    • Identify the symbol and its color/meaning, if applicable.
    • Map recognized symbols to standard text as follows:
        - Green Dot symbol → [GREEN DOT]
        - Brown Dot symbol → [BROWN DOT]
        - Recycle / ♻ symbol → [RECYCLABLE]
- If the icon is not recognized or has no clear meaning, extract the visible symbol as-is (e.g., ●, ♻) and include a placeholder.
- Preserve the symbol exactly as printed in the OCR text, and store the mapped meaning in the JSON array "claims": [].
- Do NOT invent new meanings for unrecognized symbols.

--------------------------------------------------
DATE PRESERVATION RULE (CRITICAL):

Dates must be preserved EXACTLY as printed.
Do NOT normalize or rewrite dates.

Examples of valid formats:

12/05/2024
12-05-2024
08/2024
08.2024
15/03/25
OCT 2024
OCT.2024
OCT. 2024
02/DEC/2022
29/NOV/2023
AUG/24-AUG/25
08/2024 - 08/2026

Rules:
- Do NOT change separators (/ - .)
- Do NOT convert month names
- Do NOT remove dots after month names
- Do NOT merge numbers

Extract ALL visible dates (MFG, PKD, EXP, USE BY).
--------------------------------------------------
FIELD ASSOCIATION RULE (CRITICAL):
- A value must ONLY be attached to a label if it appears on the SAME LINE or immediately after the label.
- If a number appears on a different line or floating → DO NOT assume it belongs to the label.
- If the label has no clearly attached value → output the label exactly as printed.
- If location is ambiguous → leave number on its own line.
- Never guess or move numbers between lines.

LABEL COMPLETION RULE:
- Do NOT attach numbers to a label if the number is on a separate line.
- If a label ends with ":" and no value is visible on the same line → leave label empty.

--------------------------------------------------
GENERAL OUTPUT RULE:

Return the text exactly as seen:
- line by line
- same order
- same spacing
- same mistakes
- include all symbols

If OCR cannot read a value → write NA.
Do NOT fill values from context.

Example output (misaligned pack handled correctly):

MAX. RETAIL PRICE: ₹ 139.00
[Inclusive of all taxes]
A21021
BATCH NO.:
10/2021
MFG DATE:
"""

# ============================================================
# STRUCTURE PROMPT TEMPLATE  (raw_text is injected at call time)
# ============================================================
STRUCTURE_PROMPT_TEMPLATE = """
You MUST extract every meaningful detail from the OCR text WITHOUT summarizing or skipping important fields.

==================================================
PRODUCT NAME RULE
==================================================
Product Name = ONLY:
- Brand
- Product category
- Variant / flavor
- Quantity descriptors (e.g., Sugar Free, Lite)

DO NOT include:
- Slogans, taglines, or marketing lines.

Examples:
✔ Bisk Farm Cream Cracker Sugar Free
✔ Cadbury Bournville 70% Dark Chocolate

==================================================
CROSSED-OUT TEXT HANDLING (CRITICAL)
==================================================
PRIORITY RULE: When extracting MRP or any other field:
1. If text appears as [CROSSED: value], IGNORE it completely.
2. Extract ONLY the non-crossed value.
3. If multiple MRP values exist:
   - Use the one WITHOUT [CROSSED: ] marker
   - Discard the one WITH [CROSSED: ] marker

Example in OCR text:
  [CROSSED: ₹ 48] ₹ 46/-
  → Extract: ₹ 46/- (ignore the crossed value entirely)

Apply this rule to ALL fields, not just MRP.

==================================================
CORE EXTRACTION RULES
==================================================
Extract EXACTLY as printed:
- All manufacturers, packers, addresses.
- Packaging material manufacturer.
- All barcode/EAN numbers.
- All batch/lot/pack/manufacturing codes.
- All machine codes.
- All storage instructions.
- All claims/certifications.

DO NOT infer or modify any information.
DO NOT treat decorative text as meaningful.

==================================================
DATE EXTRACTION AND CALCULATION RULES
==================================================
1. Extract all dates exactly as printed in the OCR text.
   This includes manufacturing dates (MFG), expiry dates (EXP), best-before statements,
   and any other date references.

2. Standardize all identified dates to the format:
   DD/MM/YYYY

3. Handling partial dates:
   - If a date contains only month and year (e.g., JAN-25, JAN 2025, 01-2025),
     assume the first day of that month.
     Example:
     JAN-25 → 01/01/2025

4. Expiry calculation from Best Before:
   - If a manufacturing date is present and a Best Before duration is specified
     (example: "BEST BEFORE 15 MONTHS FROM MANUFACTURE"),
     you MUST calculate expiry_date by adding the mentioned duration to
     the manufacture_date.
   - expiry_date must never be "Not Specified" in this case.

5. Shelf life rules:
   - If the Best Before duration is explicitly mentioned, use that value
     directly as shelf_life (example: "15 months").
   - If shelf life is NOT explicitly mentioned but BOTH manufacture_date
     and expiry_date are present, you MUST calculate shelf_life.
   - shelf_life = difference between expiry_date and manufacture_date
     calculated in months.
   - Return shelf_life in months.

   Example:
   manufacture_date: 01/11/2024
   expiry_date: 01/02/2026
   shelf_life: 15 months

6. Always populate shelf_life whenever possible based on the above rules.

   If BOTH manufacture_date and expiry_date exist,
   shelf_life must NEVER be "Not Specified".

7. All final dates in the structured output must be in DD/MM/YYYY format.

8. If no manufacturing date, expiry date, best-before statement, or shelf life
   information is found in the OCR text, return:
   manufacture_date: "Not Specified"
   expiry_date: "Not Specified"
   shelf_life: "Not Specified"

9. Do NOT modify, reinterpret, or correct other extracted text.
   Calculations are only allowed for expiry_date and shelf_life.

==================================================
TEXT PRESERVATION RULE (CRITICAL)
==================================================
Preserve ALL visible OCR text.
1. First extract and store all meaningful text into the appropriate JSON fields.
2. If text does NOT clearly belong to any defined field, store it under:
"other_important_text": []

This includes slogans, taglines, marketing text, environmental messages, disclaimers,
regulatory notes, preparation notes, miscellaneous packaging text, and brand communication messages.
Rules:
- Preserve text exactly as printed.
- Do NOT summarize or rewrite.
- Store each line as a separate array item.

Final Safety Rule:
- After structured extraction, ensure any remaining partial, fragmented, or half-structured
  OCR text that was not mapped to fields is also preserved in "other_important_text".
- This guarantees no meaningful OCR text is lost.

==================================================
USPF RULE (NEW)
==================================================
Any price that contains "/Unit", "/g", "/ml", "/kg", "/pc", "/tablet", "/capsule"
or similar unit formats is NOT an MRP.
Extract it as: uspf

Example:
₹120.00/Unit → uspf: "₹120.00/Unit"
₹ 0.14/g → uspf: "₹ 0.14/g"

- DO NOT merge it with MRP.
- DO NOT place it under "Other Important Text".

==================================================
NUTRITION JSON RULE (STRICT)
==================================================
You MUST output the nutrition table ONLY as JSON.
JSON Format:
[
{{
"nutrient_name": "<as printed>",
"unit": "<unit printed for that nutrient>",
"values": {{
    "<column header>": "<value>"
    }}
}}
]

Rules:
- NO Markdown tables.
- NO ```json fences around the JSON.
- Use exact nutrient row names exactly as printed on packaging.
- Extract the UNIT printed for that nutrient (examples: g, mg, µg, kcal, kJ, IU).
- The unit usually appears in brackets next to the nutrient name (example: Protein (g)).
- If the unit appears in the column header instead of the nutrient name, still extract the correct unit for that nutrient.
- Store ONLY the unit in the "unit" field (do NOT include brackets).
- Do NOT attach the unit to numeric values.
- Column headers must remain EXACT.
- If RDA value is missing or blank, return: "not specified".
- Do NOT return empty strings for any RDA values.

Dynamic column handling:
- Identify the table header row, if present, and map each column to its header.
- First column = "nutrient_name".
- Any numeric column with a clear header → use that header as the key.
- If a middle numeric column has no header → treat it as "per_serving".
- If a column contains "%" or "%RDA", preserve the header exactly as printed (including symbols like *, #).
- Preserve all symbols (*, **, †, ‡) exactly as printed.
- If a value is missing or unclear → return "not specified".

Handling %RDA printed outside the table:
- If %RDA values appear separately from the nutrition table (e.g., below, above, or beside it),
  map them to the correct nutrient rows using the nutrient names.
- Store these values under the appropriate "%RDA" column header exactly as printed.
- If a nutrient exists but no %RDA value is found → return "not specified" for that column.

NUTRITION NOTES:
Store nutrition footnotes, explanations, and reference statements related to the nutrition table under:

"nutrition_notes": []

These usually appear:
- Below the nutrition table
- After symbols like *, **, ^, †
- As lines explaining %RDA, serving references, or nutrient definitions.
Rules:
- Extract ONLY if the text actually appears in the OCR.
- Preserve symbols (*, **, ^, †, etc.) exactly as printed.
- Do NOT merge these lines into the nutrition table rows.
- If no nutrition notes are present in the OCR text, return: []

==================================================
CLAIMS EXTRACTION RULE
==================================================
All product claims should be stored under:

"claims": []

1. Extract all short statements on the packaging that describe:
   - Product attribute
   - Feature
   - Benefit
   Examples: "Clinically Proven", "Doctor Recommended", "Supports Immunity", "Gluten Free", "Premium Quality", "Trusted by Mothers"

2. Symbol-based claims:
   - Convert recognized symbols into claim text:
     - [GREEN DOT] → "Vegetarian"
     - [BROWN DOT] → "Non-Vegetarian"
     - [RECYCLABLE] → "Recyclable"
   - Extract these symbols even if no text is visible.
   - Store the mapped meaning, not the raw symbol, in the claims array.

3. Rules:
   - Extract claim text exactly as printed when visible.
   - Include each claim as a separate item in the "claims" array.
   - Do NOT include explanations, footnotes, or any non-claim text.

==================================================
CERTIFICATIONS EXTRACTION RULE
==================================================
Identify certifications, regulatory approvals, or
quality standard marks printed on the packaging.
Store them under:

"certifications": []

Examples:
- "FSSAI"
- "ISO 22000"
- "HACCP"
- "USFDA"
- "GMP Certified"
- "Organic Certified"

Rules:
- Extract certification names exactly as printed.
- Do NOT store certifications under "claims".
- Store each certification as a separate item in the array.

==================================================
MRP FLATTENING RULE (NEW)
==================================================
When extracting MRP:
- Combine all MRP-related lines into ONE single line.
- Remove line breaks inside MRP.
- IGNORE any value marked with [CROSSED: ]
- Final output MUST be:

  mrp: <currency symbol> <amount> (<tax text>)
Examples:
- "MRP ₹\\n54.00\\n(INCL. OF\\nALL TAXES)" →
  "₹ 54.00 (INCL. OF ALL TAXES)"

- "[CROSSED: ₹ 48] ₹ 46/-" →
  "₹ 46/-"

- Remove duplicate words like "MRP" if they appear before the currency.
- Do NOT change the amount or currency.

==================================================
BATCH / LOT / MACHINE CODES
==================================================
Lot Number:
- Extract only alphanumeric lot/batch codes (e.g., B1025L4).
- Date-like values can NEVER be lot numbers.
- If "Lot No." is followed by a date → ignore the date.

Machine Code:
- Extract only if explicitly printed or located near the lot/batch code.
- Must be alphanumeric.
- Do NOT treat dates or lot numbers as machine codes.

Other Codes:
- Any standalone numbers, alphanumeric codes, or printed codes that are NOT clearly labeled as Lot, Batch, or Machine codes must be stored under:
"batch_information.other_codes": []

==================================================
FSSAI LICENSE EXTRACTION RULE
==================================================
Extract ALL FSSAI license numbers printed on the packaging.
Common patterns:
- "FSSAI Lic. No."
- "Lic. No."
- "License No."
- "FSSAI License No."

Store under:
"fssai_information": {{
  "license_numbers": []
}}

Rules:
- Preserve the exact number.
- Do not remove duplicates unless identical.
- Do NOT attach FSSAI license numbers to manufacturer license fields unless explicitly written with that manufacturer block.

==================================================
MANUFACTURER TYPE RULE
==================================================
Normalize "manufacturer_information.type" to ONLY one of these values:
- "Manufactured By"
- "Marketed By"

Mapping:
- Manufactured By → Manufactured By, Manufacturer, Mfg By, Mfd By, Produced By, Made By, Manufacturing Unit, Manufactured & Packed By
- Marketed By → Marketed By, Marketer, Marketing Company, Marketed & Distributed By, Distributed By, Distributed and Marketed By

Rules:
- Extract manufacturer name, address, and license exactly as printed.
- Only normalize the "type" field to the two allowed values.
- If multiple manufacturer blocks exist, create separate objects in "manufacturer_information".
- Do NOT merge different manufacturer blocks.
- If license is not printed, return "".

==================================================
FINAL OUTPUT FORMAT (STRICT JSON ONLY)
==================================================
Return ONLY raw JSON.
CRITICAL:
- DO NOT wrap JSON in markdown code fences.
- DO NOT include explanations.
- DO NOT include bullet points.
- The response MUST start with {{ and end with }}.

JSON STRUCTURE:
{{
  "product_type": "single",
  "product_identity": {{
    "brand": {{
      "parent_brand": "",
      "sub_brand": ""
    }},
    "product_name": "",
    "variant": "",
    "product_category": ""
  }},
  "pack_details": {{
    "net_quantity": "",
    "pack_size": "",
    "serving_size": "",
    "servings_per_pack": "",
    "packing_format": ""
  }},
  "pricing": {{
    "mrp": "",
    "uspf": ""
  }},
  "nutrition": {{
    "nutrition_table": [
        {{
        "nutrient_name": "",
        "unit": "",
        "values": {{
            "<column_header>": ""
        }}
        }}
    ],
    "nutrition_notes": []
  }},
  "ingredients": "",
  "allergen_information": "",
  "claims": [],
  "medical_information": {{
    "intended_use": [],
    "warnings": [],
    "contraindications": []
  }},
  "usage_instructions": {{
    "directions_to_use": [],
    "preparation_method": []
  }},
  "storage_instructions": [],
  "manufacturer_information": [
    {{
      "type": "",
      "name": "",
      "address": "",
      "license_number": ""
    }}
  ],
  "fssai_information": {{
    "license_numbers": []
  }},
  "packaging_information": {{
    "packaging_material_manufacturer": "",
    "packaging_codes": []
  }},
  "batch_information": {{
    "lot_number": "",
    "machine_code": "",
    "other_codes": []
  }},
  "dates": {{
    "manufacturing_date": "",
    "expiry_date": "",
    "best_before": "",
    "shelf_life": ""
  }},
  "barcodes": [],
  "certifications": [],
  "customer_care": {{
    "phone": [],
    "email": "",
    "website": "",
    "address": ""
  }},
  "regulatory_text": [],
  "footnotes": [],
  "other_important_text": []
}}

==================================================
JSON RULES (CRITICAL)
==================================================
1. Output MUST be valid JSON.
2. All arrays must remain arrays even if only one item exists.
3. If a field is missing in the OCR text, return:
   - "" for strings
   - [] for arrays
   - 0.00 for mrp
4. Do NOT invent values.
5. Extract text EXACTLY as printed on packaging.
6. Nutrition table must remain in the JSON array format defined earlier.

==================================================
OCR TEXT:
{raw_text}
"""

# ============================================================
# HELPER FUNCTIONS
# ============================================================
FUZZY_THRESHOLD = 85


def safe_print(msg):
    try:
        print(msg)
    except UnicodeEncodeError:
        try:
            print(msg.encode("ascii", "replace").decode("ascii"))
        except Exception:
            print("[LOG] (message contains special characters)")


def convert_energy_kj_to_kcal(nutrition_table):
    for row in nutrition_table:
        name = row.get("nutrient_name", "")
        if re.search(r"\bkj\b", name, flags=re.IGNORECASE):
            values = row.get("values", {})
            amount = values.get("amount")
            if amount is not None:
                kcal = round(float(amount) / 4.184, 2)
                values["amount"] = kcal
                row["nutrient_name"] = "Energy (kcal)"  


def canonicalize(label):
    label = unicodedata.normalize("NFKC", label)
    label = label.lower()
    SPELLING_MAP = {"fibre": "fiber"}
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
            safe_print(f"Mapping '{original}' → '{standard_name}' (exact match)")
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
                safe_print(f"Mapping '{original}' → '{standard_name}' (fuzzy match {best_score:.2f}%)")

        if not standard_name:
            safe_print(f"Adding new nutrient: {original}")
            standard_name = original

        values = row.get("values", {})
        cleaned_values = {}
        for key, value in values.items():
            if value is None or value == "" or value == "null" or value == "-":
                cleaned_values[key] = "not specified"
            else:
                cleaned_values[key] = value
        
        if not any(v != "not specified" for v in cleaned_values.values()):
            continue

        standardized.append({
            "nutrient_name": standard_name,
            "unit": row.get("unit", ""),          # preserve unit from new OCR format
            "values": cleaned_values,
            "original_name": original,
        })

    return standardized


def extract_numeric_mrp(mrp_value):
    if not mrp_value or mrp_value in ("not specified", "", "0.00", 0, 0.0):
        return None
    if isinstance(mrp_value, (int, float)):
        return float(mrp_value) if float(mrp_value) > 0 else None
    if not isinstance(mrp_value, str):
        try:
            return float(mrp_value)
        except Exception:
            return None
    cleaned = re.sub(r"[₹Rs.MRP:INCL\.OFALLTAXES\s]", "", mrp_value, flags=re.IGNORECASE)
    numbers = re.findall(r"\d+\.?\d*", cleaned)
    if numbers:
        try:
            return float(numbers[0])
        except Exception:
            return None
    return None


def detect_packing_format(text):
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


def validate_fssai(text):
    if not isinstance(text, str):
        text = str(text) if text else ""
    return list(set(re.findall(r"\b\d{14}\b", text)))


def calculate_shelf_life(mfg_str, exp_str):
    """Calculate shelf life in months from two DD/MM/YYYY date strings."""
    for fmt in ["%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d"]:
        try:
            mfg = datetime.strptime(mfg_str, fmt)
            exp = datetime.strptime(exp_str, fmt)
            delta = relativedelta(exp, mfg)
            months = delta.years * 12 + delta.months
            if months > 0:
                return f"{months} months"
            days = (exp - mfg).days
            return f"{days} days" if days > 0 else None
        except ValueError:
            continue
    return None


def calculate_cost(task, input_tokens, output_tokens):
    input_tokens = input_tokens or 0
    output_tokens = output_tokens or 0
    input_cost  = (input_tokens  / 1_000_000) * PRICING[task]["input"]
    output_cost = (output_tokens / 1_000_000) * PRICING[task]["output"]
    return {
        "input_tokens":  input_tokens,
        "output_tokens": output_tokens,
        "input_cost":    input_cost,
        "output_cost":   output_cost,
        "total_cost":    input_cost + output_cost,
    }


def clean_json_string(raw):
    """Strip markdown fences and locate the outermost JSON object."""
    raw = raw.strip()
    if raw.startswith("```"):
        first_newline = raw.find("\n")
        if first_newline != -1:
            raw = raw[first_newline + 1:]
        if "```" in raw:
            raw = raw[: raw.rfind("```")].rstrip()
    first_brace = raw.find("{")
    if first_brace != -1:
        raw = raw[first_brace:]
    last_brace = raw.rfind("}")
    if last_brace != -1:
        raw = raw[: last_brace + 1]
    return raw


# ============================================================
# PYDANTIC SCHEMAS
# ============================================================
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
    product_category: Optional[str] = None
    net_quantity: Optional[str] = None
    net_weight: Optional[str] = None
    pack_size: Optional[str] = None
    serving_size: Optional[str] = None
    servings_per_pack: Optional[str] = None
    packing_format: Optional[str] = None
    mrp: Optional[float] = None
    uspf: Optional[str] = None
    nutrition_table: List[dict] = []
    nutrition_notes: List[str] = []
    ingredients: Optional[str] = None
    allergen_information: Optional[str] = None
    allergen_info: Optional[str] = None
    claims: List[str] = []
    medical_information: dict = {}
    usage_instructions: dict = {}
    instructions_to_use: Optional[str] = None
    storage_instructions: List[str] = []
    manufacturer_information: List[dict] = []
    manufacturer_details: List[dict] = []
    brand_owner: Optional[str] = None
    fssai_information: dict = {}
    fssai_licenses: List[str] = []
    packaging_information: dict = {}
    batch_information: dict = {}
    manufacturing_date: Optional[str] = None
    expiry_date: Optional[str] = None
    best_before: Optional[str] = None
    shelf_life: Optional[str] = None
    barcodes: List[str] = []
    barcode: Optional[str] = None
    certifications: List[str] = []
    regulatory_text: List[str] = []
    footnotes: List[str] = []
    customer_care: dict = {}
    other_important_text: List[str] = []
    veg_nonveg: Optional[str] = None
    category: Optional[str] = None
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


# ============================================================
# ROUTES
# ============================================================

@router.post("/extract", response_model=ExtractedProductData)
async def extract_product_from_images(
    images: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_user),
):
    """
    Two-step extraction:
      Step 1 — OCR each image individually (OCR_MODEL)
      Step 2 — Structure the combined raw text (STRUCTURE_MODEL)
    No image preprocessing is applied.
    """
    safe_print("\n" + "=" * 60)
    safe_print("[EXTRACTION] ===== NEW EXTRACTION REQUEST =====")
    safe_print("=" * 60)
    
    try:
        safe_print(f"[EXTRACTION] User: {current_user.email}")
        safe_print(f"[EXTRACTION] Images received: {len(images)}")
        
        api_key = settings.GEMINI_API_KEY
        if not api_key:
            raise HTTPException(
                status_code=500, 
                detail="Gemini API key not configured. Please set GEMINI_API_KEY in environment.",
            )
        
        if len(images) == 0:
            raise HTTPException(status_code=400, detail="At least one image is required")
        if len(images) > 10:
            raise HTTPException(status_code=400, detail="Maximum 10 images allowed")
        
        from google import genai

        client = genai.Client(api_key=api_key)
        safe_print("[EXTRACTION] Gemini client initialized")

        # ── Token accumulators ──────────────────────────────────────────────
        ocr_tokens       = {"input": 0, "output": 0}
        structure_tokens = {"input": 0, "output": 0}

        # ══════════════════════════════════════════════════════════════════════
        # STEP 1 — OCR each image
        # ══════════════════════════════════════════════════════════════════════
        raw_text_blocks = []

        for idx, img_file in enumerate(images):
            filename = img_file.filename
            safe_print(f"[OCR] Processing image {idx + 1}/{len(images)}: {filename}")
            try:
                content_bytes = await img_file.read()
                pil_img = Image.open(BytesIO(content_bytes))
                if pil_img.mode != "RGB":
                    pil_img = pil_img.convert("RGB")
                safe_print(f"[OCR] Image {idx + 1} size: {pil_img.size}")

                # Run sync Gemini call in a thread so it doesn't block the event loop.
                # 60-second per-image timeout prevents indefinite hangs.
                ocr_response = await asyncio.wait_for(
                    asyncio.to_thread(
                        client.models.generate_content,
                        model=OCR_MODEL,
                        contents=[OCR_PROMPT, pil_img],
                        config={"temperature": 0, "top_p": 0},
                    ),
                    timeout=60,
                )

                if hasattr(ocr_response, "usage_metadata") and ocr_response.usage_metadata:
                    um = ocr_response.usage_metadata
                    # use `or 0` because the attribute may exist but hold None
                    ocr_tokens["input"]  += (getattr(um, "prompt_token_count",    None) or 0)
                    ocr_tokens["output"] += (getattr(um, "candidates_token_count", None) or 0)

                extracted = ocr_response.text.strip() if ocr_response.text else ""
                safe_print(f"[OCR] Image {idx + 1} extracted {len(extracted)} chars")
                if extracted:
                    raw_text_blocks.append(extracted)

            except asyncio.TimeoutError:
                safe_print(f"[OCR] Image {idx + 1} timed out after 60s — skipping")
            except Exception as img_err:
                safe_print(f"[OCR] Image {idx + 1} failed: {img_err}")

        combined_raw_text = "\n\n".join(raw_text_blocks).strip()
        safe_print(f"[OCR] Combined OCR text length: {len(combined_raw_text)} chars")

        if not combined_raw_text:
            return ExtractedProductData(success=False, error="OCR produced no text from the provided images.")

        # ══════════════════════════════════════════════════════════════════════
        # STEP 2 — Structure the combined raw text
        # ══════════════════════════════════════════════════════════════════════
        safe_print("[STRUCTURE] Calling structure model...")

        structure_prompt = STRUCTURE_PROMPT_TEMPLATE.format(raw_text=combined_raw_text)

        # 120-second timeout for the structuring step (prompt can be large)
        struct_response = await asyncio.wait_for(
            asyncio.to_thread(
                client.models.generate_content,
                model=STRUCTURE_MODEL,
                contents=structure_prompt,
                config={"temperature": 0},
            ),
            timeout=120,
        )

        if hasattr(struct_response, "usage_metadata") and struct_response.usage_metadata:
            um = struct_response.usage_metadata
            structure_tokens["input"]  += (getattr(um, "prompt_token_count",    None) or 0)
            structure_tokens["output"] += (getattr(um, "candidates_token_count", None) or 0)

        safe_print("[STRUCTURE] Response received")

        # ── Parse JSON ──────────────────────────────────────────────────────
        raw_json = clean_json_string(struct_response.text or "")
        safe_print(f"[STRUCTURE] JSON length: {len(raw_json)} chars")

        product_data = json.loads(raw_json)
        safe_print("[STRUCTURE] JSON parsed successfully")

        # ══════════════════════════════════════════════════════════════════════
        # POST-PROCESSING
        # ══════════════════════════════════════════════════════════════════════
        safe_print("[POST] Starting post-processing...")

        nutrition_block = product_data.get("nutrition", {})
        nutrition_table = nutrition_block.get("nutrition_table", [])

        if nutrition_table:
            convert_energy_kj_to_kcal(nutrition_table)
            nutrition_table = standardize_nutrition(nutrition_table, NOMENCLATURE_MAP)
            nutrition_block["nutrition_table"] = nutrition_table

        # Numeric MRP
        pricing = product_data.get("pricing", {})
        numeric_mrp = extract_numeric_mrp(pricing.get("mrp"))
        if numeric_mrp is not None:
            pricing["mrp"] = numeric_mrp

        # Packing format fallback
        pack_details = product_data.get("pack_details", {})
        if not pack_details.get("packing_format") or pack_details["packing_format"] in ("", "not specified"):
            pack_details["packing_format"] = detect_packing_format(json.dumps(product_data))

        # Dates + shelf life
        dates = product_data.get("dates", {})
        mfg = dates.get("manufacturing_date", "")
        exp = dates.get("expiry_date", "")
        shelf = dates.get("shelf_life", "")

        if mfg and exp and (not shelf or shelf in ("", "Not Specified", "not specified")):
            computed = calculate_shelf_life(mfg, exp)
            if computed:
                dates["shelf_life"] = computed

        # FSSAI — validate any 14-digit numbers found in raw JSON
        fssai_info = product_data.get("fssai_information", {})
        existing_licenses = fssai_info.get("license_numbers", [])
        detected_licenses = validate_fssai(raw_json)
        merged = list(dict.fromkeys(existing_licenses + detected_licenses))
        fssai_info["license_numbers"] = merged
        product_data["fssai_information"] = fssai_info

        # Veg/NonVeg detection from claims
        claims = product_data.get("claims", [])
        veg_nonveg = ""
        for claim in claims:
            cl = claim.lower()
            if "non-vegetarian" in cl or "non vegetarian" in cl:
                veg_nonveg = "Non-Vegetarian"
                break
            if "vegetarian" in cl:
                veg_nonveg = "Vegetarian"

        # ── Build cost info ──────────────────────────────────────────────────
        ocr_cost  = calculate_cost("ocr",       ocr_tokens["input"],       ocr_tokens["output"])
        str_cost  = calculate_cost("structure",  structure_tokens["input"],  structure_tokens["output"])
        cost_info = {
            "ocr":        ocr_cost,
            "structure":  str_cost,
            "grand_total": ocr_cost["total_cost"] + str_cost["total_cost"],
        }
        safe_print(f"[COST] Grand total: ${cost_info['grand_total']:.6f}")

        # ── Build frontend-friendly transformed_data ─────────────────────────
        identity    = product_data.get("product_identity", {})
        brand_block = identity.get("brand", {})

        transformed_data = {
            "basic": {
                "productName":   identity.get("product_name", ""),
                "brand":         brand_block.get("parent_brand", ""),
                "subBrand":      brand_block.get("sub_brand", ""),
                "variant":       identity.get("variant", ""),
                "category":      identity.get("product_category", ""),
                "packSize":      pack_details.get("net_quantity", ""),
                "serveSize":     pack_details.get("serving_size", ""),
                "servingsPerPack": pack_details.get("servings_per_pack", ""),
                "packingFormat": pack_details.get("packing_format", ""),
                "mrp":           pricing.get("mrp", ""),
                "uspf":          pricing.get("uspf", ""),
                "manufactured":  dates.get("manufacturing_date", ""),
                "expiry":        dates.get("expiry_date", ""),
                "bestBefore":    dates.get("best_before", ""),
                "shelfLife":     dates.get("shelf_life", ""),
                "vegNonVeg":     veg_nonveg,
            },
            "nutrition": {
                "table": nutrition_block.get("nutrition_table", []),
                "notes": nutrition_block.get("nutrition_notes", []),
            },
            "composition": {
                "ingredients":        product_data.get("ingredients", ""),
                "allergenInfo":       product_data.get("allergen_information", ""),
                "claims":             product_data.get("claims", []),
                "storageInstructions": product_data.get("storage_instructions", []),
                "usageInstructions":  product_data.get("usage_instructions", {}),
                "medicalInformation": product_data.get("medical_information", {}),
            },
            "company": {
                "manufacturerDetails":  product_data.get("manufacturer_information", []),
                "fssaiInformation":     product_data.get("fssai_information", {}),
                "packagingInformation": product_data.get("packaging_information", {}),
                "barcodes":             product_data.get("barcodes", []),
                "certifications":       product_data.get("certifications", []),
                "customerCare":         product_data.get("customer_care", {}),
            },
            "batch":      product_data.get("batch_information", {}),
            "dates":      dates,
            "regulatory": product_data.get("regulatory_text", []),
            "footnotes":  product_data.get("footnotes", []),
            "other":      product_data.get("other_important_text", []),
            "raw":        product_data,
        }

        safe_print("[EXTRACTION] SUCCESS")
        return ExtractedProductData(success=True, data=transformed_data, cost=cost_info)
        
    except json.JSONDecodeError as e:
        safe_print(f"[ERROR] JSON parse failed: {e}")
        return ExtractedProductData(success=False, error=f"Failed to parse AI response: {e}")

    except HTTPException:
        raise

    except Exception as e:
        safe_print(f"[ERROR] {type(e).__name__}: {e}")
        import traceback
        try:
            safe_print(traceback.format_exc())
        except Exception:
            pass
        error_msg = f"{type(e).__name__}: {str(e)}"
        try:
            error_msg = error_msg.encode("ascii", "replace").decode("ascii")
        except Exception:
            pass
        return ExtractedProductData(success=False, error=f"Extraction failed: {error_msg}")


@router.post("", response_model=dict)
async def create_product(
    product: ProductCreate,
    current_user: User = Depends(get_current_user),
):
    """Create a new product"""
    try:
        new_product = Product(
            product_name=product.product_name,
            parent_brand=product.parent_brand,
            sub_brand=product.sub_brand,
            variant=product.variant,
            product_category=product.product_category,
            net_quantity=product.net_quantity,
            net_weight=product.net_weight,
            pack_size=product.pack_size,
            serving_size=product.serving_size,
            servings_per_pack=product.servings_per_pack,
            packing_format=product.packing_format,
            mrp=product.mrp,
            uspf=product.uspf,
            nutrition_table=product.nutrition_table,
            nutrition_notes=product.nutrition_notes,
            ingredients=product.ingredients,
            allergen_information=product.allergen_information,
            allergen_info=product.allergen_info,
            claims=product.claims,
            medical_information=product.medical_information,
            usage_instructions=product.usage_instructions,
            instructions_to_use=product.instructions_to_use,
            storage_instructions=product.storage_instructions,
            manufacturer_information=product.manufacturer_information,
            manufacturer_details=product.manufacturer_details,
            brand_owner=product.brand_owner,
            fssai_information=product.fssai_information,
            fssai_licenses=product.fssai_licenses,
            packaging_information=product.packaging_information,
            batch_information=product.batch_information,
            manufacturing_date=product.manufacturing_date,
            expiry_date=product.expiry_date,
            best_before=product.best_before,
            shelf_life=product.shelf_life,
            barcodes=product.barcodes,
            barcode=product.barcode,
            certifications=product.certifications,
            regulatory_text=product.regulatory_text,
            footnotes=product.footnotes,
            customer_care=product.customer_care,
            other_important_text=product.other_important_text,
            veg_nonveg=product.veg_nonveg,
            category=product.category,
            tags=product.tags,
            images=product.images,
            status=product.status,
            created_by=str(current_user.id),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        await new_product.insert()
        return {"success": True, "message": "Product created successfully", "product_id": str(new_product.id)}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create product: {e}")


@router.get("", response_model=dict)
async def list_products(
    skip: int = 0,
    limit: int = 50,
    category: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
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
                {"product_name":  {"$regex": search, "$options": "i"}},
                {"parent_brand":  {"$regex": search, "$options": "i"}},
                {"variant":       {"$regex": search, "$options": "i"}},
            ]
        
        products = await Product.find(query).skip(skip).limit(limit).to_list()
        total    = await Product.find(query).count()

        return {
            "products": [
                {
                    "id":               str(p.id),
                    "product_name":     p.product_name,
                    "parent_brand":     p.parent_brand,
                    "variant":          p.variant,
                    "mrp":              p.mrp,
                    "uspf":             p.uspf,
                    "category":         p.category,
                    "status":           p.status,
                    "pack_size":        p.pack_size,
                    "net_quantity":     p.net_quantity,
                    "net_weight":       p.net_weight,
                    "created_at":       p.created_at.isoformat(),
                    "manufacturing_date": p.manufacturing_date,
                    "expiry_date":      p.expiry_date,
                    "images":           p.images if p.images else [],
                }
                for p in products
            ],
            "total": total,
            "skip":  skip,
            "limit": limit,
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch products: {e}")


@router.get("/{product_id}", response_model=dict)
async def get_product(
    product_id: str,
    current_user: User = Depends(get_current_user),
):
    """Get a single product by ID"""
    try:
        from bson import ObjectId
        product = await Product.get(ObjectId(product_id))
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        return {
            "id":                     str(product.id),
            "product_name":           product.product_name,
            "parent_brand":           product.parent_brand,
            "sub_brand":              product.sub_brand,
            "variant":                product.variant,
            "product_category":       product.product_category,
            "product_type":           product.product_type,
            # pack
            "net_quantity":           product.net_quantity,
            "net_weight":             product.net_weight,
            "pack_size":              product.pack_size,
            "serving_size":           product.serving_size,
            "servings_per_pack":      product.servings_per_pack,
            "packing_format":         product.packing_format,
            # pricing
            "mrp":                    product.mrp,
            "uspf":                   product.uspf,
            # nutrition
            "nutrition_table":        product.nutrition_table,
            "nutrition_notes":        product.nutrition_notes,
            # composition
            "ingredients":            product.ingredients,
            "allergen_information":   product.allergen_information,
            "claims":                 product.claims,
            "medical_information":    product.medical_information,
            "usage_instructions":     product.usage_instructions,
            "storage_instructions":   product.storage_instructions,
            # manufacturer / fssai
            "manufacturer_information": product.manufacturer_information,
            "manufacturer_details":   product.manufacturer_details,
            "brand_owner":            product.brand_owner,
            "fssai_information":      product.fssai_information,
            "fssai_licenses":         product.fssai_licenses,
            # packaging / batch
            "packaging_information":  product.packaging_information,
            "batch_information":      product.batch_information,
            # dates
            "manufacturing_date":     product.manufacturing_date,
            "expiry_date":            product.expiry_date,
            "best_before":            product.best_before,
            "shelf_life":             product.shelf_life,
            # identifiers
            "barcodes":               product.barcodes,
            "barcode":                product.barcode,
            # regulatory / other
            "certifications":         product.certifications,
            "regulatory_text":        product.regulatory_text,
            "footnotes":              product.footnotes,
            "customer_care":          product.customer_care,
            "other_important_text":   product.other_important_text,
            "veg_nonveg":             product.veg_nonveg,
            "category":               product.category,
            "tags":                   product.tags,
            "images":                 product.images,
            "status":                 product.status,
            "created_at":             product.created_at.isoformat(),
            "updated_at":             product.updated_at.isoformat(),
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch product: {e}")


@router.put("/{product_id}", response_model=dict)
async def update_product(
    product_id: str,
    product_update: ProductCreate,
    current_user: User = Depends(get_current_user),
):
    """Update a product"""
    try:
        from bson import ObjectId
        product = await Product.get(ObjectId(product_id))
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        update_data = product_update.model_dump(exclude_unset=True)
        update_data["updated_at"] = datetime.utcnow()
        for field, value in update_data.items():
            setattr(product, field, value)
        
        await product.save()
        return {"success": True, "message": "Product updated successfully", "product_id": str(product.id)}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update product: {e}")


@router.delete("/{product_id}", response_model=dict)
async def delete_product(
    product_id: str,
    current_user: User = Depends(get_current_user),
):
    """Delete a product"""
    try:
        from bson import ObjectId
        product = await Product.get(ObjectId(product_id))
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        await product.delete()
        return {"success": True, "message": "Product deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete product: {e}")
