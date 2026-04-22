"""
Lightweight audit logger for security-sensitive operations.
Logs structured events to a dedicated 'audit' logger for easy filtering.
"""
import logging
from datetime import datetime, timezone
from typing import Optional


audit_logger = logging.getLogger("audit")


def log_event(
    action: str,
    user_id: Optional[str] = None,
    user_email: Optional[str] = None,
    target_id: Optional[str] = None,
    detail: str = "",
):
    """Log a security-relevant event."""
    audit_logger.info(
        "ACTION=%s user_id=%s email=%s target=%s detail=%s ts=%s",
        action,
        user_id or "-",
        user_email or "-",
        target_id or "-",
        detail.replace("\n", " ").replace("\r", "")[:500],
        datetime.now(timezone.utc).isoformat(),
    )
