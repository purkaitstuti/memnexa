"""Date-phrase resolution in plain code (no AI): the model may only quote a phrase from the document."""
import re
from datetime import date, timedelta

_MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"]
_WD = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]
_WD_RE = r"(mon(?:day)?|tue(?:s(?:day)?)?|wed(?:nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?|sun(?:day)?)"


def _month(word: str) -> int | None:
    w = word.lower().rstrip(".")
    if w == "sept":
        return 9
    if len(w) >= 3:
        for i, n in enumerate(_MONTHS, 1):
            if n.startswith(w):
                return i
    return None


def _mk(y: int, m: int, d: int) -> date | None:
    try:
        return date(y, m, d)
    except ValueError:
        return None


def _with_year(day: int, mon: int, year: str | None, today: date):
    if year:
        d = _mk(int(year), mon, day)
        return (d, False) if d else (None, True)
    d = _mk(today.year, mon, day)
    if d is None:
        return None, True
    if d < today:  # already passed this year: assume next year, but ask the user to confirm
        return _mk(today.year + 1, mon, day), True
    return d, False


def resolve_date(phrase: str | None, today: date) -> tuple[date | None, bool]:
    """Return (date or None, needs_confirmation). Weekdays/relative words always need confirmation."""
    if not phrase or not phrase.strip():
        return None, False
    p = phrase.strip().lower()
    m = re.search(r"\b(20\d{2})-(\d{1,2})-(\d{1,2})\b", p)
    if m:
        d = _mk(*map(int, m.groups()))
        if d:
            return d, False
    m = re.search(r"\b(\d{1,2})[^\w\s]*(?:st|nd|rd|th)?[^\w\s]*\s*(?:of\s+)?([a-z]{3,9})\.?(?:\s*,?\s*(20\d{2}))?\b", p)
    if m and _month(m.group(2)):
        return _with_year(int(m.group(1)), _month(m.group(2)), m.group(3), today)
    m = re.search(r"\b([a-z]{3,9})\.?\s*(\d{1,2})(?:st|nd|rd|th)?(?:\s*,?\s*(20\d{2}))?\b", p)
    if m and _month(m.group(1)):
        return _with_year(int(m.group(2)), _month(m.group(1)), m.group(3), today)
    if "tomorrow" in p:
        return today + timedelta(days=1), True
    if re.search(r"\b(today|tonight)\b", p):
        return today, True
    m = re.search(r"\b(next\s+)?" + _WD_RE + r"\b", p)
    if m:
        delta = (_WD.index(m.group(2)[:3]) - today.weekday()) % 7
        if m.group(1) and delta == 0:
            delta = 7
        return today + timedelta(days=delta), True
    return None, True


def valid_time(s: str | None) -> str | None:
    m = re.fullmatch(r"([01]?\d|2[0-3]):([0-5]\d)", (s or "").strip())
    return f"{int(m.group(1)):02d}:{m.group(2)}" if m else None
