"""Structured audit logging for privileged actions.

Emits one JSON line per audit event to stdout so a log aggregator can pick
them up without extra infrastructure.

Rules:
- Never log secrets (passwords, OTPs, tokens, API keys).
- Log user_id, not email, to keep PII out of logs by default.
- Best-effort: if serialization fails we fall back to repr.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any, Optional

_logger = logging.getLogger("nutrieyeq.audit")
if not _logger.handlers:

    _handler = logging.StreamHandler()
    _handler.setFormatter(logging.Formatter("%(message)s"))
    _logger.addHandler(_handler)
    _logger.setLevel(logging.INFO)
    _logger.propagate = False

def audit_event(
    action: str,
    *,
    actor_id: Optional[str] = None,
    actor_role: Optional[str] = None,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    outcome: str = "success",
    **metadata: Any,
) -> None:
    """Record an audit event.

    `action` is a short verb-noun string (e.g. `user.approve`, `role.change`).
    `metadata` may include arbitrary extra context but MUST NOT contain
    secrets; the helper never redacts for you.
    """
    payload = {
        "ts": datetime.utcnow().isoformat() + "Z",
        "type": "audit",
        "action": action,
        "outcome": outcome,
        "actor_id": actor_id,
        "actor_role": actor_role,
        "target_type": target_type,
        "target_id": target_id,
    }
    if metadata:
        payload["meta"] = metadata
    try:
        _logger.info(json.dumps(payload, default=str, separators=(",", ":")))
    except Exception:
        _logger.info(
            "{\"type\":\"audit\",\"action\":%r,\"outcome\":\"log-serialize-failed\"}"
            % action
        )
