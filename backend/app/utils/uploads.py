"""Upload helpers shared by extract endpoints.

`UploadFile.size` and `Content-Length` are advisory: a hostile client can
omit both and stream an arbitrarily large body. The helper here reads an
`UploadFile` in fixed-size chunks while enforcing hard byte caps so we
never pull more than the configured limit into memory.
"""

from fastapi import HTTPException, UploadFile

_CHUNK_SIZE = 1024 * 1024

async def read_upload_capped(
    upload: UploadFile,
    *,
    per_file_cap_bytes: int,
    remaining_total_cap_bytes: int,
    file_label: str = "file",
) -> bytes:
    """Stream-read `upload` into memory, aborting if either cap is breached.

    Args:
        upload: The FastAPI ``UploadFile`` to consume.
        per_file_cap_bytes: Maximum allowed size for this single file.
        remaining_total_cap_bytes: Bytes still permitted in the current
            request's cumulative budget. Pass ``total_cap - bytes_read_so_far``.
        file_label: Used in the 413 error message; safe to surface to clients
            (e.g. ``"file at position 3"``). Don't pass user-supplied filenames
            to avoid log/PII leakage.

    Returns:
        The full file content as ``bytes`` on success.

    Raises:
        HTTPException(413): if either cap is exceeded mid-stream.
    """
    if per_file_cap_bytes <= 0 or remaining_total_cap_bytes <= 0:
        raise HTTPException(
            status_code=413,
            detail="Total upload size exceeds the request limit",
        )

    cap = min(per_file_cap_bytes, remaining_total_cap_bytes)
    parts: list[bytes] = []
    read = 0
    while True:
        chunk = await upload.read(_CHUNK_SIZE)
        if not chunk:
            break
        read += len(chunk)
        if read > cap:

            parts.clear()
            raise HTTPException(
                status_code=413,
                detail=f"{file_label} exceeds the upload size limit",
            )
        parts.append(chunk)
    return b"".join(parts)
