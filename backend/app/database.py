"""
Database connection and initialization
"""
from motor.motor_asyncio import AsyncIOMotorClient
from beanie import init_beanie
from app.models.user import User
from app.models.product import Product
from app.models.category import Category
from app.models.nomenclature import NomenclatureMapping
from app.models.coa import COA
from app.models.formulation import SavedFormulation
from config.settings import settings


class Database:
    """Database manager for MongoDB connection"""
    
    client: AsyncIOMotorClient = None
    
    @classmethod
    async def connect_db(cls):
        """Connect to MongoDB and initialize Beanie ODM"""
        print(f"[*] Connecting to MongoDB at {settings.MONGODB_URL}...")
        
        cls.client = AsyncIOMotorClient(settings.MONGODB_URL)
        
        # Initialize Beanie with document models
        await init_beanie(
            database=cls.client[settings.DATABASE_NAME],
            document_models=[User, Product, Category, NomenclatureMapping, COA, SavedFormulation]
        )
        
        print(f"[OK] Connected to MongoDB database: {settings.DATABASE_NAME}")
        
        # Create indexes
        await User.find_one()  # Triggers index creation
        print("[OK] Database indexes created")
    
    @classmethod
    async def close_db(cls):
        """Close MongoDB connection"""
        if cls.client:
            cls.client.close()
            print("[*] MongoDB connection closed")


async def get_database():
    """Dependency to get database (if needed for raw queries)"""
    return Database.client[settings.DATABASE_NAME]

