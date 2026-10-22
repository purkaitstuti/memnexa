from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.orm import Session
from ..ai import AIUnavailable, build_messages, chat, retrieve, user_tz
from ..deps import current_user, get_db
from ..models import RecentSearch, User, utcnow
from ..ratelimit import hit
from ..schemas import MemoryOut, TaskOut
from .memories import out as mem_out
from .tasks import out as task_out

router = APIRouter(prefix="/api/ask", tags=["ask"])
KEEP = 20


class AskIn(BaseModel):
    question: str = Field(min_length=1, max_length=500)
    tz: str = "UTC"
    tz_offset: int = Field(default=0, ge=-840, le=840)


class AskOut(BaseModel):
    answer: str
    tasks: list[TaskOut]
    memories: list[MemoryOut]
    used_ai: bool


class RecentOut(BaseModel):
    id: int
    query: str


def save_recent(db: Session, user: User, q: str) -> None:
    db.execute(delete(RecentSearch).where(RecentSearch.user_id == user.id, RecentSearch.query == q))
    db.add(RecentSearch(user_id=user.id, query=q))
    db.flush()
    old = db.scalars(select(RecentSearch.id).where(RecentSearch.user_id == user.id).order_by(RecentSearch.id.desc()).offset(KEEP)).all()
    if old:
        db.execute(delete(RecentSearch).where(RecentSearch.id.in_(old)))
    db.commit()


@router.post("", response_model=AskOut)
def ask(data: AskIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    hit(f"ask:{user.id}", 15)
    q = data.question.strip()
    if not q:
        raise HTTPException(422, "Please type a question.")
    tzi, now = user_tz(data.tz, data.tz_offset), utcnow()
    tasks, mems, label = retrieve(db, user, q, now, tzi)  # always scoped to this user
    if not tasks and not mems:
        save_recent(db, user, q)
        where = f" for {label}" if label else ""
        return AskOut(answer=f"I couldn't find anything{where} in your saved tasks or memories.", tasks=[], memories=[], used_ai=False)
    try:
        answer = chat(build_messages(q, tasks, mems, label, now, tzi))
    except AIUnavailable as e:
        raise HTTPException(503, str(e))
    save_recent(db, user, q)
    return AskOut(answer=answer, tasks=[task_out(t) for t in tasks], memories=[mem_out(m) for m in mems], used_ai=True)


@router.get("/recent", response_model=list[RecentOut])
def recent(user: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(RecentSearch).where(RecentSearch.user_id == user.id).order_by(RecentSearch.id.desc()).limit(10)).all()
    return [RecentOut(id=r.id, query=r.query) for r in rows]


@router.delete("/recent/{rid}", status_code=204)
def delete_one(rid: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    r = db.get(RecentSearch, rid)
    if not r or r.user_id != user.id:
        raise HTTPException(404, "Search not found")
    db.delete(r); db.commit()


@router.delete("/recent", status_code=204)
def clear(user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.execute(delete(RecentSearch).where(RecentSearch.user_id == user.id)); db.commit()
