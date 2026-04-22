import logging
import os
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from app.database import Database
from app.routes import auth, users, products, categories, nomenclature, coa, coa_nomenclature, formulations, nutrient_hierarchy
from app.middleware.security import configure_cors, configure_rate_limiting
from config.settings import settings

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    if settings.DEBUG and os.getenv("ENVIRONMENT", "").lower() in ("production", "prod"):
        logger.critical("DEBUG=True in a production environment — refusing to start")
        raise RuntimeError("DEBUG must be False in production")

    logger.info("Starting NutriEyeQ Backend...")
    await Database.connect_db()
    logger.info("Server ready")
    if settings.DEBUG:
        logger.info("API Documentation available at /docs")
    
    yield
    
    logger.info("Shutting down...")
    await Database.close_db()
    logger.info("Server stopped")


app = FastAPI(
    title=settings.APP_NAME,
    description="Product packaging data extraction and benchmarking API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    openapi_url="/openapi.json" if settings.DEBUG else None,
)


configure_cors(app)
configure_rate_limiting(app)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    if not settings.DEBUG:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    response.headers["Cache-Control"] = "no-store"
    
    return response


@app.middleware("http")
async def log_requests(request: Request, call_next):
    try:
        logger.debug("%s %s", request.method, request.url.path)
        response = await call_next(request)
        logger.debug("Response: %d", response.status_code)
        return response
    except Exception as e:
        logger.error("Middleware error: %s", type(e).__name__)
        raise


app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(products.router, prefix="/api")
app.include_router(categories.router, prefix="/api")
app.include_router(nomenclature.router, prefix="/api")
app.include_router(coa.router, prefix="/api")
app.include_router(coa_nomenclature.router, prefix="/api")
app.include_router(formulations.router, prefix="/api")
app.include_router(nutrient_hierarchy.router, prefix="/api")


@app.get("/")
async def root():
    return {
        "status": "running"
    }


@app.get("/api/health")
async def health():
    return {
        "status": "healthy"
    }


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception on %s: %s", request.url.path, type(exc).__name__, exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"}
    )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        reload=True,
        log_level="info"
    )
