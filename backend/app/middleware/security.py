"""
Security middleware for rate limiting and CORS
"""
from fastapi import Request, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from config.settings import settings


# Rate limiter
limiter = Limiter(key_func=get_remote_address)


def configure_cors(app):
    """Configure CORS middleware"""
    # Dynamic CORS based on DEBUG mode
    if settings.DEBUG:
        # Development: allow all origins for testing
        allowed_origins = ["*"]
        print("[WARNING] CORS allows all origins (DEBUG=True)")
    else:
        # Production: restrict to specific domains
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
    """Configure rate limiting middleware"""
    app.state.limiter = limiter
    app.add_middleware(SlowAPIMiddleware)
    
    @app.exception_handler(RateLimitExceeded)
    async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
        return HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Rate limit exceeded. Please try again later."
        )
    
    print("[OK] Rate limiting configured")


# Rate limit decorators for routes
def rate_limit(times: int = 5, seconds: int = 60):
    """
    Rate limit decorator for routes
    
    Usage:
        @router.post("/login")
        @rate_limit(times=5, seconds=60)
        async def login(...):
    """
    return limiter.limit(f"{times}/{seconds}seconds")

