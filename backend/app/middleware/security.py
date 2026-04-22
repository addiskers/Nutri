import ipaddress
import logging
from fastapi import Request, status
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from config.settings import settings

logger = logging.getLogger(__name__)


def _parse_trusted_networks():
    """Parse TRUSTED_PROXY_IPS into a list of ipaddress networks."""
    networks = []
    for entry in settings.TRUSTED_PROXY_IPS.split(","):
        entry = entry.strip()
        if not entry:
            continue
        try:
            networks.append(ipaddress.ip_network(entry, strict=False))
        except ValueError:
            try:
                networks.append(ipaddress.ip_network(f"{entry}/32", strict=False))
            except ValueError:
                logger.warning("Invalid trusted proxy IP/network: %s", entry)
    return networks


_trusted_networks = _parse_trusted_networks()


def _is_trusted_proxy(ip_str: str) -> bool:
    """Check if an IP belongs to a trusted proxy network."""
    try:
        addr = ipaddress.ip_address(ip_str)
        return any(addr in net for net in _trusted_networks)
    except ValueError:
        return False


def _get_real_ip(request: Request) -> str:
    """Extract client IP, trusting proxy headers only from verified proxy IPs."""
    if settings.BEHIND_PROXY:
        remote_ip = get_remote_address(request) or ""
        if _is_trusted_proxy(remote_ip):
            # Prefer X-Real-IP (set by Nginx to $remote_addr, harder to spoof)
            real_ip = request.headers.get("X-Real-IP")
            if real_ip and real_ip.strip():
                return real_ip.strip()
            # Fall back to rightmost non-trusted IP in X-Forwarded-For
            forwarded = request.headers.get("X-Forwarded-For")
            if forwarded:
                # Walk from right to left; the rightmost entry added by our proxy
                # is the actual client IP. Skip trusted proxy IPs.
                parts = [p.strip() for p in forwarded.split(",")]
                for ip in reversed(parts):
                    if ip and not _is_trusted_proxy(ip):
                        return ip
                # All IPs are trusted proxies; use the leftmost
                if parts:
                    return parts[0]
    return get_remote_address(request)


limiter = Limiter(
    key_func=_get_real_ip,
    default_limits=[f"{settings.RATE_LIMIT_PER_MINUTE}/minute"],
)


def configure_cors(app):
    if settings.DEBUG:
        allowed_origins = [
            "http://localhost:5173",
            "http://localhost:3000",
            "http://127.0.0.1:5173",
            "http://127.0.0.1:3000",
        ]
        logger.warning("CORS DEBUG MODE ACTIVE — localhost origins allowed. Do NOT use in production!")
    else:
        frontend = settings.FRONTEND_URL.rstrip("/")
        allowed_origins = [frontend]
        logger.info("CORS restricted to: %s", allowed_origins)
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
        expose_headers=["Content-Disposition"]
    )
    
    logger.info("CORS configured")


def configure_rate_limiting(app):
    app.state.limiter = limiter
    app.add_middleware(SlowAPIMiddleware)
    
    @app.exception_handler(RateLimitExceeded)
    async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={"detail": "Rate limit exceeded. Please try again later."}
        )
    
    logger.info("Rate limiting configured")
