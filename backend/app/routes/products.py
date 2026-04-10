"""
Product Routes - Two-Step OCR + Structure Pipeline
"""
import asyncio
import logging
import os
import re
import unicodedata
from rapidfuzz import fuzz
import json
from io import BytesIO
from typing import List, Optional
from datetime import datetime, timezone, timedelta
from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Request
from pydantic import BaseModel
from PIL import Image
from app.models.user import User
from app.models.product import Product
from app.dependencies.auth import get_current_user, require_permission
from app.middleware.security import limiter

router = APIRouter(prefix="/products", tags=["Products"])

from config.settings import settings

logger = logging.getLogger(__name__)

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
    "saturate": "Saturated Fat",
    "saturated": "Saturated Fat",
    "unsaturated fat": "Unsaturated Fat",
    "unsaturated fatty acids": "Unsaturated Fat",
    "monounsaturated fat": "Monounsaturated Fat",
    "mufa": "Monounsaturated Fat",
    "polyunsaturated fat": "Polyunsaturated Fat",
    "pufa": "Polyunsaturated Fat",
    "trans fat": "Trans Fat",
    "trans fatty acids": "Trans Fat",
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
    "vitamin b7": "Vitamin B7",
    "biotin": "Vitamin B7",
    "vitamin b9": "Folic Acid",
    "folic acid": "Folic Acid",
    "folate": "Folic Acid",
    "vitamin b12": "Vitamin B12",
    "cobalamin": "Vitamin B12",
    "vitamin k": "Vitamin K",
    "vitamin k1": "Vitamin K1",
    "vitamin k2": "Vitamin K2",
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
- Do NOT mark text as [CROSSED] if only a symbol (*, #, ^, @, -) is present near it. There must be a visible line crossing the text.
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
- ALWAYS set "pack_details.packing_format" to "" even if packaging type (Bottle, Pouch, Box, etc.) is clearly mentioned in OCR.

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

This includes slogans, taglines, marketing text, environmental messages, disclaimers, regulatory notes, preparation notes, miscellaneous packaging text, and brand communication messages.
Rules:
- Preserve text exactly as printed.
- Do NOT summarize or rewrite.
- Store each line as a separate array item.

Final Safety Rule:
- After structured extraction, ensure any remaining partial, fragmented, or half-structured OCR text that was not mapped to fields is also preserved in "other_important_text".
- This guarantees no meaningful OCR text is lost.

==================================================
USPF RULE (NEW)
==================================================
Any price that contains "/Unit", "/g", "/ml", "/kg", "/pc", "/tablet", "/capsule"
or similar unit formats is NOT an MRP.
Extract it as: **USPF**

Example:
₹120.00/Unit → **USPF**: ₹120.00/Unit
₹ 0.14/g → **USPF**: ₹ 0.14/g

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
IMPORTANT:
Examples below are for reference only. NEVER copy them into the output unless the exact text appears in the OCR.

Examples:
- "*other than naturally occurring trans fat"
- "**RDA calculated based on 2000 kcal diet"
- "^Sucrose"

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

  **MRP**: <currency symbol> <amount> (<tax text>)
Examples:
- "MRP ₹\n54.00\n(INCL. OF\nALL TAXES)" →
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
- Manufactured By → Manufactured By, Manufacturer, Mfg By, Mfd By, Produced By, Made By, Manufacturing Unit, Manufactured & Packed By, Manufactured At, Mfg At, Mfd At, Produced At, Made At, Manufacturing Unit At
- Marketed By → Marketed By, Marketer, Marketing Company, Marketed & Distributed By, Distributed By, Distributed and Marketed By, Marketed At, Distributed At, Marketed & Distributed At

Rules:
- Treat "At" the same as "By" ONLY for determining the "type" value.
- Extract manufacturer name, address, and license exactly as printed (do NOT modify "At" to "By" in extracted text).
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
    "variant": ""
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
    "warnings": []
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
    logger.debug("%s", msg)

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
    label = re.sub(r"^of which[:\s]+", "", label)
    label = re.sub(r"\s+", " ", label).strip()
    words = label.split()
    normalized_words = []
    for w in words:
        if len(w) > 3 and w.endswith("s") and not w.endswith(("ss", "us", "ns")):
            normalized_words.append(w[:-1])
        else:
            normalized_words.append(w)
    return " ".join(normalized_words)

CANONICAL_NOMENCLATURE = {
    canonicalize(k): v for k, v in NOMENCLATURE_MAP.items()
}

async def load_nomenclature_map_from_db():
    """Load nomenclature map from database, falling back to hardcoded map."""
    try:
        from app.models.nomenclature import NomenclatureMapping
        mappings = await NomenclatureMapping.find_all().to_list()
        if not mappings:
            return NOMENCLATURE_MAP, CANONICAL_NOMENCLATURE
        nom_map = {}
        for m in mappings:
            nom_map[m.standardized_name.lower()] = m.standardized_name
            for raw in m.raw_names:
                nom_map[raw.lower()] = m.standardized_name
        canonical = {canonicalize(k): v for k, v in nom_map.items()}
        return nom_map, canonical
    except Exception as e:
        logger.warning("Failed to load nomenclature from DB, using hardcoded: %s", e)
        return NOMENCLATURE_MAP, CANONICAL_NOMENCLATURE

def apply_notes_rda(nutrition_block, canonical_nomen=None):
    """Parse nutrition_notes for %RDA per serve line and overwrite table values."""
    notes = nutrition_block.get("nutrition_notes", [])
    table = nutrition_block.get("nutrition_table", [])
    if not notes or not table:
        return nutrition_block

    for note in notes:
        # Match lines like "% RDA^ per Serve (30 g): Energy-5%, Added Sugar*-0%, ..."
        header_match = re.search(
            r'%\s*RDA[^:]*per\s+(?:Serve|Serving)\s*(\([^)]*\))?',
            note, re.IGNORECASE
        )
        if not header_match:
            continue

        # Build the column key to match
        serve_info = header_match.group(1) or ""
        col_key_fragment = "% RDA per serve"
        if serve_info:
            col_key_fragment += f" {serve_info}"

        # Find the actual column key in the table
        target_col = None
        for row in table:
            for k in row.get("values", {}):
                if "rda" in k.lower() and "serve" in k.lower():
                    target_col = k
                    break
            if target_col:
                break

        if not target_col:
            safe_print(f"[NOTES_RDA] No matching %RDA serve column found in table")
            continue

        safe_print(f"[NOTES_RDA] Found column: '{target_col}' from note: {note[:80]}...")

        # Extract pairs like "Energy-5%", "Sodium-<10%", "Added Sugar*-0%"
        after_colon = note.split(":", 1)[1] if ":" in note else note
        pairs = re.findall(r'([\w\s\*\(\)]+?)\s*[-–—]\s*([<>]?\d+(?:\.\d+)?%)', after_colon)

        safe_print(f"[NOTES_RDA] Extracted {len(pairs)} pairs: {pairs}")

        for raw_name, value in pairs:
            raw_name = raw_name.strip().rstrip("*^ ")
            canon_note = canonicalize(raw_name)

            for row in table:
                nutrient = row.get("nutrient_name", "")
                original = row.get("original_name", "")
                canon_n = canonicalize(nutrient)
                canon_o = canonicalize(original)

                # Check direct match or via nomenclature
                matched = False
                if canon_note == canon_n or canon_note == canon_o:
                    matched = True
                elif fuzz.token_sort_ratio(canon_note, canon_n) >= FUZZY_THRESHOLD:
                    matched = True
                elif fuzz.token_sort_ratio(canon_note, canon_o) >= FUZZY_THRESHOLD:
                    matched = True
                else:
                    _cn = canonical_nomen if canonical_nomen is not None else CANONICAL_NOMENCLATURE
                    mapped_note = _cn.get(canon_note)
                    mapped_n = _cn.get(canon_n)
                    if mapped_note and mapped_n and mapped_note == mapped_n:
                        matched = True

                if matched:
                    old_val = row["values"].get(target_col, "")
                    row["values"][target_col] = value
                    safe_print(f"[NOTES_RDA] {nutrient}: '{old_val}' → '{value}'")
                    break

    nutrition_block["nutrition_table"] = table
    return nutrition_block


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
            "unit": row.get("unit", ""),
            "values": cleaned_values,
            "original_name": original,
        })

    return standardized

def merge_external_rda(structured_json, raw_text, canonical_nomen=None):
    nutrition_table = structured_json.get("nutrition", {}).get("nutrition_table", [])
    if not nutrition_table:
        return structured_json
    _cn = canonical_nomen if canonical_nomen is not None else CANONICAL_NOMENCLATURE
    all_rda_headers = set()
    def match_nutrient(ocr_name, table_name):
        canon_ocr = canonicalize(ocr_name)
        canon_table = canonicalize(table_name)
        mapped_ocr = _cn.get(canon_ocr)
        mapped_table = _cn.get(canon_table)

        if canon_ocr == canon_table:
            return True

        if mapped_ocr and mapped_table and mapped_ocr == mapped_table:
            return True

        if mapped_ocr and canonicalize(mapped_ocr) == canon_table:
            return True

        if mapped_table and canonicalize(mapped_table) == canon_ocr:
            return True

        score = fuzz.token_sort_ratio(canon_ocr, canon_table)
        return score >= FUZZY_THRESHOLD

    existing_rda_columns = set()
    for row in nutrition_table:
        for k in row.get("values", {}):
            if '%' in k:
                existing_rda_columns.add(k)
    if existing_rda_columns:
        logger.debug("Nutrition table already has '%%' columns: %s", existing_rda_columns)

    lines = raw_text.splitlines()
    merged_rda_blocks = []
    current_block = ""
    for line in lines:
        if '%' in line:
            current_block += " " + line.strip()
        else:
            if current_block:
                merged_rda_blocks.append(current_block.strip())
                current_block = ""
    if current_block:
        merged_rda_blocks.append(current_block.strip())

    logger.debug("Found %d merged %%RDA blocks", len(merged_rda_blocks))

    for block_num, block in enumerate(merged_rda_blocks, start=1):
        logger.debug("Processing block %d: %s", block_num, block)

        column_header = "% RDA"

        column_header_match = re.search(
            r'((?:%\s*)?RDA[^\w%]*(?:\s*(?:per|/)\s*[\w\s\(\)\.]+)?|(?:per\s*[\w\s\(\)\.]+\s*%?\s*(?:contribution\s*to\s*)?RDA))',
            block,
            re.IGNORECASE
        )

        if column_header_match:
            raw_header = column_header_match.group(1).strip().lower()
            raw_header = re.sub(r'\s+', ' ', raw_header)

            per_match = re.search(
                r'per\s*([\w\s]+(?:\(\s*\d+\s*[a-zA-Z]+\s*\))?)',
                raw_header
            )

            if per_match:
                clean_per = per_match.group(1).strip()
                column_header = f"% RDA per {clean_per}"
            column_header = re.sub(r'\bto\s*rda\b', '', column_header, flags=re.IGNORECASE)
            column_header = re.sub(r'\s+', ' ', column_header).strip()    
        
        paren_match = re.search(r'\(([^)]*\d+(?:\.\d+)?\s*(g|ml|kg|l)[^)]*)\)', block, re.IGNORECASE)
        if paren_match and "per serve" in column_header.lower():
            full_text = paren_match.group(1).strip()
            
            if '(' not in column_header:
                column_header = f"{column_header} ({full_text})"
        logger.debug("Column header detected: %s", column_header)

        # If table already has a matching % column, use its exact name
        if existing_rda_columns:
            for ec in existing_rda_columns:
                if fuzz.token_sort_ratio(column_header.lower(), ec.lower()) >= 70:
                    logger.debug("Reusing existing column header: '%s' instead of '%s'", ec, column_header)
                    column_header = ec
                    break
        
        has_rda_any = re.search(r'%?\s*RDA', block, re.IGNORECASE)
        has_percent = re.search(r'\d+\s*%', block) or re.search(r'\b\d+(\.\d+)?\b', block)
        is_per_serve_rda = re.search(
            r'(per\s*(serve|serving).*rda|rda.*per\s*(serve|serving))',
            block,
            re.IGNORECASE
        )

        if not (has_rda_any and has_percent and is_per_serve_rda):
            logger.debug("Skipping non-nutrient block")
            continue
        all_rda_headers.add(column_header)
        pairs = re.findall(r'([\w\s\*\-\(\)/]+?)\s*\(?([\d<>\.%]+)\)?', block)
        value_first_pairs = re.findall(
            r'(\d+(?:\.\d+)?\s*%)\s*([A-Za-z][\w\s\*\-\(\)/]*)',
            block
        )

        pairs += [(nutrient.strip(), value.strip()) for value, nutrient in value_first_pairs]
        logger.debug("Found pairs: %s", pairs)

        for nutrient, value in pairs:
            nutrient = nutrient.strip().rstrip("():*-")
            nutrient = re.sub(r'\b(max|min|approx|value)\b', '', nutrient, flags=re.IGNORECASE)

            value = value.strip().rstrip(".,;:")
            matched = False

            for row in nutrition_table:
                if match_nutrient(nutrient, row["nutrient_name"]):
                    existing = row["values"].get(column_header)
                    if existing and existing not in ("not specified", "", None):
                        logger.debug("Skipping %s: already has '%s'", nutrient, existing)
                        matched = True
                        break
                    row["values"][column_header] = value
                    matched = True
                    logger.debug("Merged %s -> %s under %s", nutrient, value, column_header)
                    break

            if not matched:
                logger.debug("Could not match nutrient '%s' in nutrition_table", nutrient)

    for row in nutrition_table:
        for header in all_rda_headers:
            if header not in row["values"]:
                row["values"][header] = "not specified"

    structured_json["nutrition"]["nutrition_table"] = nutrition_table
    logger.debug("Final nutrition_table after merging %%RDA values: %d rows", len(nutrition_table))

    return structured_json

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
    net_quantity: Optional[str] = None
    pack_size: Optional[str] = None
    serving_size: Optional[str] = None
    servings_per_pack: Optional[str] = None
    packing_format: Optional[str] = None
    mrp: Optional[str] = None
    uspf: Optional[str] = None
    nutrition_table: List[dict] = []
    nutrition_notes: List[str] = []
    ingredients: Optional[str] = None
    allergen_information: Optional[str] = None
    claims: List[str] = []
    medical_information: dict = {}
    usage_instructions: dict = {}
    storage_instructions: List[str] = []
    manufacturer_information: List[dict] = []
    brand_owner: Optional[str] = None
    fssai_information: dict = {}
    packaging_information: dict = {}
    batch_information: dict = {}
    manufacturing_date: Optional[str] = None
    expiry_date: Optional[str] = None
    shelf_life: Optional[str] = None
    barcodes: List[str] = []
    certifications: List[str] = []
    regulatory_text: List[str] = []
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
@limiter.limit("10/minute")
async def extract_product_from_images(
    request: Request,
    images: List[UploadFile] = File(...),
    current_user: User = Depends(require_permission("add_products")),
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

        client = genai.Client(vertexai=True, api_key=api_key)
        safe_print("[EXTRACTION] Gemini client initialized (Vertex AI)")

        ocr_tokens       = {"input": 0, "output": 0}
        structure_tokens = {"input": 0, "output": 0}

        async def gemini_call_with_retry(fn, *args, timeout_s=90, max_retries=5, **kwargs):
            delay = 2.0
            for attempt in range(1, max_retries + 1):
                try:
                    return await asyncio.wait_for(
                        asyncio.to_thread(fn, *args, **kwargs),
                        timeout=timeout_s,
                    )
                except asyncio.TimeoutError:
                    raise
                except Exception as exc:
                    err_str = str(exc).lower()
                    is_429 = (
                        "429" in err_str
                        or "resource_exhausted" in err_str
                        or "quota" in err_str
                        or "rate limit" in err_str
                    )
                    if is_429 and attempt < max_retries:
                        safe_print(
                            f"[RETRY] 429 rate-limit hit (attempt {attempt}/{max_retries}). "
                            f"Waiting {delay:.1f}s before retry..."
                        )
                        await asyncio.sleep(delay)
                        delay = min(delay * 2, 64)
                        continue
                    raise

        # ══════════════════════════════════════════════════════════════════════
        # STEP 1 — OCR each image
        # ══════════════════════════════════════════════════════════════════════
        raw_text_blocks = []

        for idx, img_file in enumerate(images):
            filename = img_file.filename
            safe_print(f"[OCR] Processing image {idx + 1}/{len(images)}: {filename}")
            
            max_ocr_retries = 10
            base_timeout = 10
            
            for retry_attempt in range(1, max_ocr_retries + 1):
                timeout_duration = base_timeout + (retry_attempt - 1) * 5
                
                try:
                    content_bytes = await img_file.read()
                    if len(content_bytes) > 10 * 1024 * 1024:
                        raise HTTPException(status_code=400, detail=f"File '{img_file.filename}' exceeds 10MB limit")
                    pil_img = Image.open(BytesIO(content_bytes))
                    if pil_img.mode != "RGB":
                        pil_img = pil_img.convert("RGB")
                    safe_print(f"[OCR] Image {idx + 1} size: {pil_img.size} (attempt {retry_attempt}/{max_ocr_retries}, timeout: {timeout_duration}s)")

                    ocr_response = await gemini_call_with_retry(
                        client.models.generate_content,
                        model=OCR_MODEL,
                        contents=[OCR_PROMPT, pil_img],
                        config={
                            "temperature": 0,
                            "top_p": 0,
                            "thinking_config": {"thinking_budget": 0},
                        },
                        timeout_s=timeout_duration,
                    )

                    if hasattr(ocr_response, "usage_metadata") and ocr_response.usage_metadata:
                        um = ocr_response.usage_metadata
                        ocr_tokens["input"]  += (getattr(um, "prompt_token_count", None) or 0)
                        ocr_tokens["output"] += (getattr(um, "candidates_token_count", None) or 0)

                    extracted = ocr_response.text.strip() if ocr_response.text else ""
                    safe_print(f"[OCR] Image {idx + 1} extracted {len(extracted)} chars")
                    if extracted:
                        raw_text_blocks.append(extracted)
                    break

                except asyncio.TimeoutError:
                    if retry_attempt < max_ocr_retries:
                        safe_print(f"[OCR] Image {idx + 1} timed out after {timeout_duration}s (attempt {retry_attempt}/{max_ocr_retries}) — retrying...")
                        await img_file.seek(0)
                    else:
                        safe_print(f"[OCR] Image {idx + 1} timed out after {max_ocr_retries} attempts — skipping")
                except Exception as img_err:
                    safe_print(f"[OCR] Image {idx + 1} failed: {img_err}")
                    break

        combined_raw_text = "\n\n".join(raw_text_blocks).strip()
        safe_print(f"[OCR] Combined OCR text length: {len(combined_raw_text)} chars")

        if not combined_raw_text:
            return ExtractedProductData(success=False, error="OCR produced no text from the provided images.")

        # ══════════════════════════════════════════════════════════════════════
        # STEP 2 — Structure the combined raw text
        # ══════════════════════════════════════════════════════════════════════
        safe_print("[STRUCTURE] Calling structure model...")

        structure_prompt = STRUCTURE_PROMPT_TEMPLATE.format(raw_text=combined_raw_text)

        struct_response = await gemini_call_with_retry(
            client.models.generate_content,
            model=STRUCTURE_MODEL,
            contents=structure_prompt,
            config={
                "temperature": 0,
                "thinking_config": {"thinking_budget": 0},
            },
            timeout_s=120,
        )

        if hasattr(struct_response, "usage_metadata") and struct_response.usage_metadata:
            um = struct_response.usage_metadata
            structure_tokens["input"]  += (getattr(um, "prompt_token_count",    None) or 0)
            structure_tokens["output"] += (getattr(um, "candidates_token_count", None) or 0)

        safe_print("[STRUCTURE] Response received")

        raw_json = clean_json_string(struct_response.text or "")
        safe_print(f"[STRUCTURE] JSON length: {len(raw_json)} chars")

        product_data = json.loads(raw_json)
        safe_print("[STRUCTURE] JSON parsed successfully")
        safe_print("\n================ BEFORE POST-PROCESSING ================")
        safe_print(json.dumps(product_data, indent=2, ensure_ascii=False))

        # ══════════════════════════════════════════════════════════════════════
        # POST-PROCESSING
        # ══════════════════════════════════════════════════════════════════════
        safe_print("[POST] Starting post-processing...")

        nutrition_block = product_data.get("nutrition", {})
        nutrition_table = nutrition_block.get("nutrition_table", [])

        # Load nomenclature from DB (falls back to hardcoded)
        db_nom_map, db_canonical = await load_nomenclature_map_from_db()

        if nutrition_table:
            product_data = merge_external_rda(product_data, combined_raw_text, canonical_nomen=db_canonical)
            nutrition_block = product_data.get("nutrition", {})
            nutrition_table = nutrition_block.get("nutrition_table", [])
            nutrition_table = standardize_nutrition(nutrition_table, db_nom_map)
            nutrition_block["nutrition_table"] = nutrition_table
            # Apply authoritative %RDA from nutrition_notes (overrides Gemini table values)
            nutrition_block = apply_notes_rda(nutrition_block, canonical_nomen=db_canonical)

        pricing = product_data.get("pricing", {})

        pack_details = product_data.get("pack_details", {})
        # Always clear packing_format — user selects manually on frontend
        pack_details["packing_format"] = ""

        dates = product_data.get("dates", {})
        mfg = dates.get("manufacturing_date", "")
        exp = dates.get("expiry_date", "")
        shelf = dates.get("shelf_life", "")

        if mfg and exp and (not shelf or shelf in ("", "Not Specified", "not specified")):
            computed = calculate_shelf_life(mfg, exp)
            if computed:
                dates["shelf_life"] = computed

        fssai_info = product_data.get("fssai_information", {})
        existing_licenses = fssai_info.get("license_numbers", [])
        detected_licenses = validate_fssai(raw_json)
        merged = list(dict.fromkeys(existing_licenses + detected_licenses))
        fssai_info["license_numbers"] = merged
        product_data["fssai_information"] = fssai_info

        claims = product_data.get("claims", [])
        veg_nonveg = ""
        for claim in claims:
            cl = claim.lower()
            if "non-vegetarian" in cl or "non vegetarian" in cl:
                veg_nonveg = "Non-Vegetarian"
                break
            if "vegetarian" in cl:
                veg_nonveg = "Vegetarian"

        safe_print("\n================ AFTER POST-PROCESSING ================")
        safe_print(json.dumps(product_data, indent=2, ensure_ascii=False))
        ocr_cost  = calculate_cost("ocr",       ocr_tokens["input"],       ocr_tokens["output"])
        str_cost  = calculate_cost("structure",  structure_tokens["input"],  structure_tokens["output"])
        cost_info = {
            "ocr":        ocr_cost,
            "structure":  str_cost,
            "grand_total": ocr_cost["total_cost"] + str_cost["total_cost"],
        }
        safe_print(f"[COST] Grand total: ${cost_info['grand_total']:.6f}")

        identity    = product_data.get("product_identity", {})
        brand_block = identity.get("brand", {})

        transformed_data = {
            "basic": {
                "productName":   identity.get("product_name", ""),
                "brand":         brand_block.get("parent_brand", ""),
                "subBrand":      brand_block.get("sub_brand", ""),
                "variant":       identity.get("variant", ""),
                "category":      "",
                "packSize":      pack_details.get("net_quantity", ""),
                "serveSize":     pack_details.get("serving_size", ""),
                "servingsPerPack": pack_details.get("servings_per_pack", ""),
                "packingFormat": pack_details.get("packing_format", ""),
                "mrp":           pricing.get("mrp", ""),
                "uspf":          pricing.get("uspf", ""),
                "manufactured":  dates.get("manufacturing_date", ""),
                "expiry":        dates.get("expiry_date", ""),
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
            "other":      product_data.get("other_important_text", []),
            "raw":        product_data,
        }

        safe_print("[EXTRACTION] SUCCESS")
        return ExtractedProductData(success=True, data=transformed_data, cost=cost_info)
        
    except json.JSONDecodeError as e:
        logger.error(f"[ERROR] JSON parse failed: {e}")
        return ExtractedProductData(success=False, error="Failed to parse AI response")

    except HTTPException:
        raise

    except Exception as e:
        logger.error("Product extraction failed: %s", e, exc_info=True)
        return ExtractedProductData(success=False, error="Extraction failed. Please try again.")


@router.post("", response_model=dict)
async def create_product(
    product: ProductCreate,
    current_user: User = Depends(require_permission("add_products")),
):
    """Create a new product"""
    try:
        # Sanitise medical_information – keep only "warnings"
        raw_med = product.medical_information or {}
        sanitised_medical = {"warnings": raw_med.get("warnings", [])}

        new_product = Product(
            product_name=product.product_name,
            parent_brand=product.parent_brand,
            sub_brand=product.sub_brand,
            variant=product.variant,
            net_quantity=product.net_quantity,
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
            claims=product.claims,
            medical_information=sanitised_medical,
            usage_instructions=product.usage_instructions,
            storage_instructions=product.storage_instructions,
            manufacturer_information=product.manufacturer_information,
            brand_owner=product.brand_owner,
            fssai_information=product.fssai_information,
            packaging_information=product.packaging_information,
            batch_information=product.batch_information,
            manufacturing_date=product.manufacturing_date,
            expiry_date=product.expiry_date,
            shelf_life=product.shelf_life,
            barcodes=product.barcodes,
            certifications=product.certifications,
            regulatory_text=product.regulatory_text,
            customer_care=product.customer_care,
            other_important_text=product.other_important_text,
            veg_nonveg=product.veg_nonveg,
            category=product.category,
            tags=product.tags,
            images=product.images,
            status=product.status,
            created_by=str(current_user.id),
            created_at=datetime.now(timezone.utc),
            updated_at=datetime.now(timezone.utc),
        )
        await new_product.insert()
        return {"success": True, "message": "Product created successfully", "product_id": str(new_product.id)}
        
    except Exception as e:
        logger.error(f"Failed to create product: {e}")
        raise HTTPException(status_code=500, detail="Failed to create product")


@router.get("/stats", response_model=dict)
async def get_product_stats(current_user: User = Depends(require_permission("view_products"))):
    """Dashboard stats: counts, recent 7 products, category breakdown — all in one DB round-trip."""
    try:
        now = datetime.now(timezone.utc)
        seven_days_ago    = now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=7)
        fourteen_days_ago = seven_days_ago - timedelta(days=7)

        total, last7, prev7, recent, category_agg = await asyncio.gather(
            Product.find().count(),
            Product.find({"created_at": {"$gte": seven_days_ago}}).count(),
            Product.find({"created_at": {"$gte": fourteen_days_ago, "$lt": seven_days_ago}}).count(),
            Product.find().sort("-created_at").limit(7).to_list(),
            Product.find().aggregate([
                {"$group": {"_id": "$category", "count": {"$sum": 1}}},
                {"$sort": {"count": -1}}
            ]).to_list(),
        )

        return {
            "total_products": total,
            "products_last_7_days": last7,
            "products_prev_7_days": prev7,
            "category_breakdown": {
                (item["_id"] or "Uncategorized"): item["count"]
                for item in category_agg
            },
            "recent_products": [
                {
                    "id":                 str(p.id),
                    "product_name":       p.product_name,
                    "parent_brand":       p.parent_brand,
                    "variant":            p.variant,
                    "category":           p.category,
                    "mrp":                p.mrp,
                    "pack_size":          p.pack_size,
                    "manufacturing_date": p.manufacturing_date,
                    "expiry_date":        p.expiry_date,
                    "created_at":         p.created_at.isoformat(),
                }
                for p in recent
            ],
        }
    except Exception as e:
        logger.error(f"Failed to fetch stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch stats")


@router.get("/brands", response_model=dict)
async def get_brands(current_user: User = Depends(require_permission("view_products"))):
    """Return all distinct parent_brand values (for filter dropdown)."""
    try:
        results = await Product.find().aggregate([
            {"$group": {"_id": "$parent_brand"}},
            {"$match": {"_id": {"$ne": None, "$ne": ""}}},
            {"$sort": {"_id": 1}},
        ]).to_list()
        return {"brands": [r["_id"] for r in results if r["_id"]]}
    except Exception as e:
        logger.error(f"Failed to fetch brands: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch brands")


@router.get("", response_model=dict)
async def list_products(
    skip: int = 0,
    limit: int = 50,
    category: Optional[str] = None,
    status: Optional[str] = None,
    brand: Optional[str] = None,
    search: Optional[str] = None,
    current_user: User = Depends(require_permission("view_products")),
):
    """List products with server-side filtering, sorting, and pagination."""
    try:
        limit = min(limit, 200)
        query = {}
        if category:
            query["category"] = category
        if status:
            query["status"] = status
        if brand:
            query["parent_brand"] = brand
        if search:
            escaped = re.escape(search)
            query["$or"] = [
                {"product_name":  {"$regex": escaped, "$options": "i"}},
                {"parent_brand":  {"$regex": escaped, "$options": "i"}},
                {"variant":       {"$regex": escaped, "$options": "i"}},
            ]
        
        products, total = await asyncio.gather(
            Product.find(query).sort("-created_at").skip(skip).limit(limit).to_list(),
            Product.find(query).count(),
        )

        # Resolve created_by user IDs to names
        user_ids = list({p.created_by for p in products if p.created_by})
        user_name_map = {}
        if user_ids:
            from bson import ObjectId
            valid_oids = []
            for uid in user_ids:
                try:
                    valid_oids.append(ObjectId(uid))
                except Exception:
                    pass
            if valid_oids:
                users = await User.find({"_id": {"$in": valid_oids}}).to_list()
                for u in users:
                    user_name_map[str(u.id)] = u.name

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
                    "created_at":       p.created_at.isoformat(),
                    "manufacturing_date": p.manufacturing_date,
                    "expiry_date":      p.expiry_date,
                    "created_by_name":  user_name_map.get(p.created_by, "Admin") if p.created_by else "Admin",
                }
                for p in products
            ],
            "total": total,
            "skip":  skip,
            "limit": limit,
        }
        
    except Exception as e:
        logger.error(f"Failed to fetch products: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch products")


@router.get("/{product_id}", response_model=dict)
async def get_product(
    product_id: str,
    current_user: User = Depends(require_permission("view_products")),
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
            "product_type":           product.product_type,
            # pack
            "net_quantity":           product.net_quantity,
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
            "brand_owner":            product.brand_owner,
            "fssai_information":      product.fssai_information,
            # packaging / batch
            "packaging_information":  product.packaging_information,
            "batch_information":      product.batch_information,
            # dates
            "manufacturing_date":     product.manufacturing_date,
            "expiry_date":            product.expiry_date,
            "shelf_life":             product.shelf_life,
            # identifiers
            "barcodes":               product.barcodes,
            # regulatory / other
            "certifications":         product.certifications,
            "regulatory_text":        product.regulatory_text,
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
        logger.error(f"Failed to fetch product: {e}")
        raise HTTPException(status_code=500, detail="Failed to fetch product")


@router.put("/{product_id}", response_model=dict)
async def update_product(
    product_id: str,
    product_update: ProductCreate,
    current_user: User = Depends(require_permission("edit_products")),
):
    """Update a product"""
    try:
        from bson import ObjectId
        product = await Product.get(ObjectId(product_id))
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        
        update_data = product_update.model_dump(exclude_unset=True)
        update_data["updated_at"] = datetime.now(timezone.utc)
        # Sanitise medical_information – keep only "warnings"
        if "medical_information" in update_data:
            raw_med = update_data["medical_information"] or {}
            update_data["medical_information"] = {"warnings": raw_med.get("warnings", [])}
        for field, value in update_data.items():
            setattr(product, field, value)
        
        await product.save()
        return {"success": True, "message": "Product updated successfully", "product_id": str(product.id)}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update product: {e}")
        raise HTTPException(status_code=500, detail="Failed to update product")


@router.delete("/{product_id}", response_model=dict)
async def delete_product(
    product_id: str,
    current_user: User = Depends(require_permission("delete_products")),
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
        logger.error(f"Failed to delete product: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete product")
