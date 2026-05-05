from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.exception_handlers import http_exception_handler as _default_http_exception_handler
from starlette.exceptions import HTTPException as StarletteHTTPException
from contextlib import asynccontextmanager
from typing import Optional
from app.database import Database
from app.utils.audit import audit_event
from app.routes import (
    auth,
    users,
    products,
    categories,
    nomenclature,
    coa,
    formulations,
    coa_nomenclature,
    nutrient_hierarchy,
)
from app.middleware.security import (
    configure_cors,
    configure_rate_limiting,
    configure_body_size_limit,
)
from config.settings import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("=" * 60)
    print("Starting NutriEyeQ Backend...")
    await Database.connect_db()
    if settings.DEBUG:
        print("[OK] Server ready (DEBUG mode)")
        print("[OK] API Documentation: /docs")
    else:
        print("[OK] Server ready")
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
configure_body_size_limit(app)


# Every API response carries either a token, user-tied data, or both, so
# blanket no-store on `/api/*` rather than maintaining a per-route allow-list.
# Public endpoints (`/api/health`, `/api/auth/login`) don't gain anything from
# being cached, so the broader rule is also the safer default.
_SENSITIVE_PATH_PREFIXES = ("/api/",)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)

    response.headers["X-Content-Type-Options"] = "nosniff"
    # `X-XSS-Protection: 1; mode=block` is deprecated and can be abused in
    # some browser/CSP combinations. OWASP/MDN recommend `0` + CSP instead.
    response.headers["X-XSS-Protection"] = "0"
    response.headers["X-Frame-Options"] = "DENY"
    if not settings.DEBUG:
        # 2 years + `preload` is the HSTS preload-list requirement. The deploy
        # owner must submit the apex domain to hstspreload.org when ready;
        # emitting the header early is safe since browsers only honour
        # `preload` after the submission round-trip.
        response.headers["Strict-Transport-Security"] = (
            "max-age=63072000; includeSubDomains; preload"
        )

    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    # API needs no sensor / payment / USB / autoplay access — deny outright to
    # shrink the blast radius of any future XSS on an embedded response.
    response.headers["Permissions-Policy"] = (
        "geolocation=(), microphone=(), camera=(), "
        "payment=(), usb=(), autoplay=(), fullscreen=(), "
        "magnetometer=(), accelerometer=(), gyroscope=()"
    )
    # Cross-origin isolation on API responses. Stops malicious sites pulling
    # JSON into <object>/<iframe> or reading via Spectre.
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    response.headers["Cross-Origin-Resource-Policy"] = "same-origin"
    response.headers["X-Permitted-Cross-Domain-Policies"] = "none"

    # Prevent caches from retaining auth responses (tokens, /me).
    if any(request.url.path.startswith(p) for p in _SENSITIVE_PATH_PREFIXES):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"

    # Strict CSP defends against HTML injection in error pages and accidental
    # docs exposure. Relaxed in DEBUG so /docs (Swagger from CDN) still works.
    if settings.DEBUG:
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
            "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
            "img-src 'self' data: https://fastapi.tiangolo.com; "
            "connect-src 'self'; frame-ancestors 'none'; base-uri 'self'"
        )
    else:
        response.headers["Content-Security-Policy"] = (
            "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
        )

    return response


@app.middleware("http")
async def log_requests(request: Request, call_next):
    # In DEBUG keep a minimal per-request line for local iteration; in
    # production defer to the reverse proxy / uvicorn access log so we don't
    # log PII embedded in URLs.
    try:
        response = await call_next(request)
        if settings.DEBUG:
            print(f"[REQ] {request.method} {request.url.path} -> {response.status_code}")
        return response
    except Exception as e:
        print(f"[ERROR] Middleware error: {type(e).__name__}")
        raise


app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(products.router, prefix="/api")
app.include_router(categories.router, prefix="/api")
app.include_router(nomenclature.router, prefix="/api")
app.include_router(coa.router, prefix="/api")
app.include_router(formulations.router, prefix="/api")
app.include_router(coa_nomenclature.router, prefix="/api")
app.include_router(nutrient_hierarchy.router, prefix="/api")


@app.get("/")
async def root():
    # Only advertise /docs when it's actually enabled — publishing the path
    # in production is a cheap reconnaissance hint.
    payload = {
        "app": settings.APP_NAME,
        "version": "1.0.0",
        "status": "running",
    }
    if settings.DEBUG:
        payload["docs"] = "/docs"
    return payload


@app.get("/api/health")
async def health():
    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": "1.0.0"
    }


def _client_ip(request: Request) -> Optional[str]:
    # Honour X-Forwarded-For (set by the edge nginx with the real client IP)
    # before falling back to the immediate peer.
    fwd = request.headers.get("x-forwarded-for")
    if fwd:
        return fwd.split(",")[0].strip() or None
    return request.client.host if request.client else None


@app.exception_handler(StarletteHTTPException)
async def audit_and_handle_http_exception(request: Request, exc: StarletteHTTPException):
    # Log every privilege-check failure so brute-force / token-replay /
    # permission-probing attempts show up in the audit trail. Successes are
    # already audited at the action site; this is the failure-side companion.
    if exc.status_code in (401, 403):
        route = request.scope.get("route")
        route_path = getattr(route, "path", None) or request.url.path
        audit_event(
            "auth.denied",
            outcome="failure",
            path=route_path,
            method=request.method,
            status=exc.status_code,
            ip=_client_ip(request),
            reason=exc.detail if isinstance(exc.detail, str) else None,
        )
    return await _default_http_exception_handler(request, exc)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    # Log internally; client response stays generic. Log the route template
    # (e.g. "/api/users/{user_id}") rather than the raw URL so ids/emails
    # don't land in logs as plaintext PII.
    import traceback
    route = request.scope.get("route")
    route_path = getattr(route, "path", None) or "<unmatched>"
    print(
        f"[ERROR] Unhandled exception at {request.method} {route_path}: "
        f"{type(exc).__name__}"
    )
    if settings.DEBUG:
        traceback.print_exc()
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
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
