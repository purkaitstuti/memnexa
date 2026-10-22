from fastapi import Cookie, Depends, HTTPException
from sqlalchemy.orm import Session
from .database import SessionLocal
from .models import User
from .security import read_token

COOKIE = "memnexa_session"


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def current_user(session: str | None = Cookie(default=None, alias=COOKIE), db: Session = Depends(get_db)) -> User:
    uid = read_token(session) if session else None
    user = db.get(User, uid) if uid else None
    if not user:
        raise HTTPException(401, "Not authenticated")
    return user


def pack_tags(tags: list[str]) -> str:
    clean = sorted({t.strip().lower() for t in tags if t.strip()})
    return f",{','.join(clean)}," if clean else ""


def unpack_tags(s: str) -> list[str]:
    return [t for t in s.split(",") if t]
