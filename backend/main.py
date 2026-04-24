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
    env = os.getenv("ENVIRONMENT", "").lower()
    if settings.DEBUG and env not in ("development", "dev", "local", ""):
        logger.critical("DEBUG=True in a non-development environment (%s) — refusing to start", env)
        raise RuntimeError("DEBUG must be False in non-development environments")
    if settings.DEBUG:
        logger.warning("DEBUG mode is ON — API docs exposed, CORS relaxed, HSTS disabled")

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


MAX_BODY_SIZE = 50 * 1024 * 1024  # 50MB (covers file uploads)
MAX_JSON_BODY_SIZE = 50 * 1024 * 1024  # 50MB for JSON requests


@app.middleware("http")
async def enforce_body_size(request: Request, call_next):
    """Reject oversized request bodies to prevent memory exhaustion."""
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            content_length = int(content_length)
        except ValueError:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"detail": "Invalid Content-Length header"}
            )
        content_type = (request.headers.get("content-type") or "").lower()
        limit = MAX_BODY_SIZE if "multipart" in content_type else MAX_JSON_BODY_SIZE
        if content_length > limit:
            return JSONResponse(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                content={"detail": f"Request body too large (max {limit // 1024 // 1024}MB)"}
            )
    return await call_next(request)


@app.middleware("http")
async def enforce_content_type(request: Request, call_next):
    """Reject state-changing requests with unexpected Content-Type (CSRF defense)."""
    if request.method in ("POST", "PUT", "PATCH", "DELETE"):
        content_type = (request.headers.get("content-type") or "").lower()
        # Allow JSON, multipart (file uploads), and empty body (DELETE)
        allowed = (
            content_type.startswith("application/json")
            or content_type.startswith("multipart/form-data")
            or not content_type  # empty body (e.g. DELETE, PATCH with no body)
        )
        if not allowed:
            return JSONResponse(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                content={"detail": "Unsupported Content-Type"}
            )
    return await call_next(request)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)

    # Cache-Control is the only header we set at the app layer.
    # All other security headers (HSTS, X-Frame-Options, X-Content-Type-Options,
    # Referrer-Policy, Permissions-Policy, CSP) are set by Nginx at the edge —
    # single source of truth to avoid duplicate/conflicting values in audits.
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
