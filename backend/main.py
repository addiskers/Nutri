from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
from app.database import Database
from app.routes import auth, users, products, categories, nomenclature, coa, formulations
from app.middleware.security import configure_cors, configure_rate_limiting
from config.settings import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("=" * 60)
    print("Starting NutriEyeQ Backend...")
    await Database.connect_db()
    print(f"[OK] Server ready at http://localhost:8000")
    print(f"[OK] API Documentation: http://localhost:8000/docs")
    print("=" * 60)
    
    yield
    
    print("\nShutting down...")
    await Database.close_db()
    print("Server stopped")


app = FastAPI(
    title=settings.APP_NAME,
    description="Product packaging data extraction and benchmarking API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None
)


configure_cors(app)
configure_rate_limiting(app)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["X-Frame-Options"] = "DENY"
    if not settings.DEBUG:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    
    return response


@app.middleware("http")
async def log_requests(request: Request, call_next):
    try:
        print(f"\n[REQUEST] {request.method} {request.url.path}")
        if request.method == "POST" and "extract" in request.url.path:
            print(f"[REQUEST] Extract endpoint called!")
        response = await call_next(request)
        print(f"[RESPONSE] Status: {response.status_code}")
        return response
    except Exception as e:
        print(f"[ERROR] Middleware error: {e}")
        raise


app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(products.router, prefix="/api")
app.include_router(categories.router, prefix="/api")
app.include_router(nomenclature.router, prefix="/api")
app.include_router(coa.router, prefix="/api")
app.include_router(formulations.router, prefix="/api")


@app.get("/")
async def root():
    return {
        "app": settings.APP_NAME,
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }


@app.get("/api/health")
async def health():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": "1.0.0"
    }


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    if settings.DEBUG:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": str(exc),
                "type": type(exc).__name__,
                "path": str(request.url)
            }
        )
    else:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "Internal server error"}
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
