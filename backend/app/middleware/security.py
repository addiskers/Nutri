from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from config.settings import settings
from app.utils.audit import audit_event

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=[f"{settings.RATE_LIMIT_PER_MINUTE}/minute"],
)

_ALLOWED_REQUEST_HEADERS = [
    "Authorization",
    "Content-Type",
    "Accept",
    "X-Requested-With",
]
_EXPOSED_RESPONSE_HEADERS = [
    "Content-Disposition",
]

def configure_cors(app):
    if settings.DEBUG:

        allowed_origins = [
            "http://localhost:5173",
            "http://localhost:3000",
            "http://127.0.0.1:5173",
            settings.FRONTEND_URL.rstrip("/"),
        ]
        seen = set()
        allowed_origins = [o for o in allowed_origins if o and not (o in seen or seen.add(o))]
        print(f"[WARNING] DEBUG mode CORS origins: {allowed_origins}")
    else:
        production_origin = settings.FRONTEND_URL.rstrip("/")

        if not production_origin.startswith("https://"):
            raise RuntimeError(
                "FRONTEND_URL must be an https:// origin when DEBUG=False. "
                f"Got: {production_origin!r}"
            )
        allowed_origins = [production_origin]
        print(f"[OK] CORS restricted to: {allowed_origins}")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allow_headers=_ALLOWED_REQUEST_HEADERS,
        expose_headers=_EXPOSED_RESPONSE_HEADERS,
        max_age=600,
    )

    print("[OK] CORS configured")

def configure_body_size_limit(app):
    """Reject oversize request bodies up front.

    Starlette / FastAPI do not enforce a body-size cap by default. We look at
    `Content-Length` only — streaming uploads with no length fall through to
    per-endpoint size checks (`/products/extract`, `/coa/extract`).
    """

    max_bytes = settings.MAX_REQUEST_BODY_SIZE_MB * 1024 * 1024

    @app.middleware("http")
    async def enforce_body_size(request: Request, call_next):
        if request.method in {"POST", "PUT", "PATCH"}:
            length = request.headers.get("content-length")
            if length is not None:
                try:
                    if int(length) > max_bytes:
                        return JSONResponse(
                            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                            content={
                                "detail": (
                                    f"Request body exceeds {settings.MAX_REQUEST_BODY_SIZE_MB}MB limit"
                                )
                            },
                        )
                except ValueError:
                    pass
        return await call_next(request)

    print(f"[OK] Body size limit: {settings.MAX_REQUEST_BODY_SIZE_MB}MB")

def configure_rate_limiting(app):
    app.state.limiter = limiter
    app.add_middleware(SlowAPIMiddleware)

    @app.exception_handler(RateLimitExceeded)
    async def rate_limit_handler(request: Request, exc: RateLimitExceeded):

        route = request.scope.get("route")
        route_path = getattr(route, "path", None) or request.url.path
        fwd = request.headers.get("x-forwarded-for")
        ip = (fwd.split(",")[0].strip() if fwd else None) or (
            request.client.host if request.client else None
        )
        audit_event(
            "rate_limit.exceeded",
            outcome="failure",
            path=route_path,
            method=request.method,
            status=429,
            ip=ip,
        )
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={"detail": "Rate limit exceeded. Please try again later."},
        )

    print("[OK] Rate limiting configured")

def rate_limit(times: int = 5, seconds: int = 60):
    return limiter.limit(f"{times}/{seconds}seconds")

