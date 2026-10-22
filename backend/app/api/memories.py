from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session
from ..deps import current_user, get_db, pack_tags, unpack_tags
from ..models import Memory, User
from ..schemas import MemoryIn, MemoryOut, MemoryUpdate

router = APIRouter(prefix="/api/memories", tags=["memories"])


def out(m: Memory) -> MemoryOut:
    return MemoryOut(id=m.id, title=m.title, content=m.content, category=m.category, tags=unpack_tags(m.tags),
                     memory_date=m.memory_date, reminder_at=m.reminder_at, created_at=m.created_at,
                     updated_at=m.updated_at)


def owned(db: Session, user: User, mid: int) -> Memory:
    m = db.get(Memory, mid)
    if not m or m.user_id != user.id:
        raise HTTPException(404, "Memory not found")
    return m


@router.post("", response_model=MemoryOut, status_code=201)
def create(data: MemoryIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    m = Memory(user_id=user.id, title=data.title.strip(), content=data.content, category=data.category,
               tags=pack_tags(data.tags), memory_date=data.memory_date, reminder_at=data.reminder_at)
    db.add(m); db.commit()
    return out(m)


@router.get("", response_model=list[MemoryOut])
def list_all(q: str | None = None, category: str | None = None, limit: int = 50,
             user: User = Depends(current_user), db: Session = Depends(get_db)):
    stmt = select(Memory).where(Memory.user_id == user.id)
    if category:
        stmt = stmt.where(Memory.category == category)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Memory.title.ilike(like), Memory.content.ilike(like), Memory.tags.ilike(like)))
    return [out(m) for m in db.scalars(stmt.order_by(Memory.created_at.desc()).limit(min(limit, 200))).all()]


@router.get("/{mid}", response_model=MemoryOut)
def get_one(mid: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return out(owned(db, user, mid))


@router.patch("/{mid}", response_model=MemoryOut)
def update(mid: int, data: MemoryUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    m = owned(db, user, mid)
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(m, k, pack_tags(v) if k == "tags" else v)
    db.commit()
    return out(m)


@router.delete("/{mid}", status_code=204)
def delete(mid: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.delete(owned(db, user, mid)); db.commit()
