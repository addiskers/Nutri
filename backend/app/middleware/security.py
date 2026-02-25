from fastapi import Request, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from config.settings import settings


limiter = Limiter(key_func=get_remote_address)


def configure_cors(app):
    if settings.DEBUG:
        allowed_origins = ["*"]
        print("[WARNING] CORS allows all origins (DEBUG=True)")
    else:
        allowed_origins = [
            settings.FRONTEND_URL,
        ]
        print(f"[OK] CORS restricted to: {allowed_origins}")
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["*"]
    )
    
    print("[OK] CORS configured")


def configure_rate_limiting(app):
    app.state.limiter = limiter
    app.add_middleware(SlowAPIMiddleware)
    
    @app.exception_handler(RateLimitExceeded)
    async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
        return HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Please try again later."
        )
    
    print("[OK] Rate limiting configured")


def rate_limit(times: int = 5, seconds: int = 60):
    return limiter.limit(f"{times}/{seconds}seconds")

