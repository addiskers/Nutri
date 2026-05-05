"""Shared query / request helpers used across routes."""
from __future__ import annotations

import re
from typing import Optional, Tuple

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import HTTPException, status


# MongoDB `$regex` evaluates user input as a regex. Without escaping, callers
# could inject ReDoS patterns or glob over unrelated fields. Length is bounded
# so a massive "search" query can't monopolise CPU.
_MAX_SEARCH_LEN = 100


def safe_regex(value: str) -> str:
    """Return a MongoDB-safe, case-insensitive substring regex for `value`.

    Callers should pair this with `$options: "i"` on the query. Empty / None
    inputs return an empty string so callers can detect and skip.
    """
    if not value:
        return ""
    trimmed = value.strip()[:_MAX_SEARCH_LEN]
    return re.escape(trimmed)


# bson.ObjectId raises InvalidId on malformed strings. Map that to 400
# instead of letting it become an uninformative 500.
def parse_object_id(raw: str, *, field: str = "id") -> ObjectId:
    try:
        return ObjectId(raw)
    except (InvalidId, TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {field}",
        )


# List endpoints accept `skip`/`limit` (or `page`/`page_size`). Without an
# upper bound a caller can request millions of rows and cheaply DoS Mongo.
DEFAULT_PAGE_SIZE = 50
MAX_PAGE_SIZE = 100


def normalize_pagination(
    skip: int = 0,
    limit: int = DEFAULT_PAGE_SIZE,
    *,
    max_limit: int = MAX_PAGE_SIZE,
) -> Tuple[int, int]:
    """Clamp paging inputs to sane bounds and return `(skip, limit)`."""
    safe_skip = max(0, int(skip or 0))
    safe_limit = int(limit or DEFAULT_PAGE_SIZE)
    if safe_limit <= 0:
        safe_limit = DEFAULT_PAGE_SIZE
    if safe_limit > max_limit:
        safe_limit = max_limit
    return safe_skip, safe_limit


def normalize_page(
    page: int = 1,
    page_size: int = DEFAULT_PAGE_SIZE,
    *,
    max_page_size: int = MAX_PAGE_SIZE,
) -> Tuple[int, int]:
    """Clamp page-based paging inputs; returns `(page, page_size)`."""
    safe_page = max(1, int(page or 1))
    safe_size = int(page_size or DEFAULT_PAGE_SIZE)
    if safe_size <= 0:
        safe_size = DEFAULT_PAGE_SIZE
    if safe_size > max_page_size:
        safe_size = max_page_size
    return safe_page, safe_size
