import time
from collections import defaultdict, deque
from fastapi import HTTPException

_hits: dict[str, deque] = defaultdict(deque)


def hit(key: str, limit: int, window: int = 60) -> None:
    """Simple in-memory sliding-window limiter (single process; use Redis if you scale out)."""
    now = time.monotonic()
    dq = _hits[key]
    while dq and now - dq[0] > window:
        dq.popleft()
    if len(dq) >= limit:
        raise HTTPException(429, "Too many requests. Please wait a moment and try again.")
    dq.append(now)


def reset() -> None:
    _hits.clear()
