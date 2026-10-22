"""Work out the public address of the site, so Google login never sends a live user to localhost."""


def _is_local(value: str) -> bool:
    host = value.split("://")[-1].split("/")[0].split(":")[0].lower()
    return host in ("", "localhost", "127.0.0.1", "0.0.0.0")


def pick_base(configured: str, headers, scheme: str) -> str:
    """The configured address wins, unless it is a localhost default and the request clearly came from a real host
    (for example memnexa.onrender.com). Local development keeps using the configured localhost address."""
    configured = (configured or "").rstrip("/")
    if configured and not _is_local(configured):
        return configured
    host = (headers.get("x-forwarded-host") or headers.get("host") or "").split(",")[0].strip()
    if not host or _is_local(host):
        return configured
    proto = (headers.get("x-forwarded-proto") or scheme or "https").split(",")[0].strip()
    return f"{proto}://{host}"
