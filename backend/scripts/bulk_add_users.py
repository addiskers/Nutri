"""
Bulk Add Users Script for UAT Testing
Adds multiple users to MongoDB with a common password
"""
import asyncio
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
import os
from bson import ObjectId

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# MongoDB connection
# Default to SSH tunnel connection (localhost:27018 with auth)
MONGO_URI = os.getenv("MONGO_URI", "mongodb://admin:admin%403129%40ksdn@localhost:27018/?authSource=admin")
DB_NAME = os.getenv("MONGO_DB_NAME", "nutrieyeq_uat")

# Common password for all test users
COMMON_PASSWORD = "Test@1231"

# User data
USERS = [
    {"name": "Arti Mehta", "email": "artimehta@zyduswellness.com", "department": ""},
    {"name": "Akash N Shah", "email": "AkashN.Shah@zyduswellness.com", "department": ""},
    {"name": "Pratibha M. Purohit", "email": "Pratibha.M.Purohit@zyduswellness.com", "department": ""},
    {"name": "Virendra L Narkhede", "email": "Virendra.Narkhede@Zyduswellness.com", "department": ""},
    {"name": "Dr. Ramesh Kantaria", "email": "ramesh.kantaria@zyduswellness.com", "department": ""},
    {"name": "Vrunda Patel", "email": "vrunda.patel@zyduswellness.com", "department": ""},
    {"name": "Monika Kumari", "email": "Monika.Kumari@zyduswellness.com", "department": ""},
    {"name": "Preeti R Yadav", "email": "Preeti.R.Yadav@zyduswellness.com", "department": ""},
    {"name": "Ramesh Prajapati", "email": "Ramesh.Prajapati@zyduswellness.com", "department": ""},
    {"name": "Rutu Fenil Bhimani", "email": "Rutu.Bhimani@zyduswellness.com", "department": ""},
    {"name": "Nitin S. Nair", "email": "Nitin.S.Nair@zyduswellness.com", "department": ""},
    {"name": "Bijuli Swain", "email": "bkswain@zyduswellness.com", "department": ""},
    {"name": "Rajiv Ashok Thakur", "email": "Rajiv.A.Thakur@Zyduswellness.com", "department": ""},
    {"name": "SantoshKumar Singh", "email": "SantoshKumar.Singh@zyduswellness.com", "department": ""},
    {"name": "Tejas B Vyas", "email": "tejasb.vyas@zyduswellness.com", "department": ""},
    {"name": "Sandesh Mhatre", "email": "sandesh.mhatre@zyduswellness.com", "department": ""},
    {"name": "Mrityunjay Kumar Tiwari", "email": "Mrityunjay.Tiwari@zyduswellness.com", "department": ""},
    {"name": "Preeti Shrinivas", "email": "preeti.shrinivas@zyduswellness.com", "department": ""},
    {"name": "Arohi Bapna", "email": "Arohi.Bapna@zyduswellness.com", "department": ""},
    {"name": "Gauri Khullar", "email": "Gauri.Khullar@zyduswellness.com", "department": ""},
    {"name": "Madhuri Doss", "email": "madhuri.doss@zyduswellness.com", "department": ""},
    {"name": "Trupti S. Patel", "email": "truptipatel@zyduswellness.com", "department": ""},
]

# Researcher permissions (view-only)
RESEARCHER_PERMISSIONS = [
    "view_products",
    "view_coa",
    "view_users",
    "view_nomenclature",
    "run_comparisons",
    "view_analytics",
    "export_data"
]


async def bulk_add_users():
    """Add all users to MongoDB"""
    print("=" * 60)
    print("BULK USER ADDITION SCRIPT")
    print("=" * 60)
    print(f"MongoDB URI: {MONGO_URI}")
    print(f"Database: {DB_NAME}")
    print(f"Total users to add: {len(USERS)}")
    print(f"Common password: {COMMON_PASSWORD}")
    print("=" * 60)
    
    # Connect to MongoDB
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]
    users_collection = db["users"]
    
    # Hash the common password once
    hashed_password = pwd_context.hash(COMMON_PASSWORD)
    print(f"\n✓ Password hashed successfully")
    
    added_count = 0
    skipped_count = 0
    
    for user_data in USERS:
        email = user_data["email"].lower()
        
        # Check if user already exists
        existing = await users_collection.find_one({"email": email})
        if existing:
            print(f"⊘ SKIPPED: {user_data['name']} ({email}) - already exists")
            skipped_count += 1
            continue
        
        # Create user document
        user_doc = {
            "_id": ObjectId(),
            "name": user_data["name"],
            "email": email,
            "hashed_password": hashed_password,
            "reset_token": None,
            "reset_token_expires": None,
            "department": user_data["department"],
            "job_title": None,
            "role": "Researcher",
            "permissions": RESEARCHER_PERMISSIONS,
            "is_active": True,
            "is_verified": True,
            "is_approved": True,  # Auto-approved for UAT testing
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "last_login": None
        }
        
        # Insert user
        await users_collection.insert_one(user_doc)
        print(f"✓ ADDED: {user_data['name']} ({email})")
        added_count += 1
    
    print("\n" + "=" * 60)
    print(f"SUMMARY:")
    print(f"  Added: {added_count}")
    print(f"  Skipped: {skipped_count}")
    print(f"  Total: {len(USERS)}")
    print("=" * 60)
    print(f"\nAll users can login with password: {COMMON_PASSWORD}")
    print("All users have Researcher role with view-only permissions")
    print("=" * 60)
    
    client.close()


if __name__ == "__main__":
    asyncio.run(bulk_add_users())
