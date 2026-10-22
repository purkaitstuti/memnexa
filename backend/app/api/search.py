from collections import Counter
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session
from ..deps import current_user, get_db, unpack_tags
from ..models import Memory, Task, User
from ..schemas import MemoryOut, TaskOut
from .memories import out as mem_out
from .tasks import out as task_out

router = APIRouter(prefix="/api/search", tags=["search"])


class TagHit(BaseModel):
    tag: str
    count: int


class SearchOut(BaseModel):
    tasks: list[TaskOut]
    memories: list[MemoryOut]
    tags: list[TagHit]


@router.get("", response_model=SearchOut)
def search(q: str = Query(min_length=1, max_length=100), user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Search the signed-in user's own tasks, memories and tags (every query is scoped by user_id)."""
    q = q.strip().lower()
    if not q:
        return SearchOut(tasks=[], memories=[], tags=[])
    like = lambda col: func.lower(col).contains(q, autoescape=True)
    tasks = db.scalars(select(Task).where(Task.user_id == user.id, or_(like(Task.title), like(Task.description), like(Task.tags)))
                       .order_by(Task.due_at.is_(None), Task.due_at).limit(8)).all()
    mems = db.scalars(select(Memory).where(Memory.user_id == user.id, or_(like(Memory.title), like(Memory.content), like(Memory.tags)))
                      .order_by(Memory.created_at.desc()).limit(8)).all()
    counts: Counter[str] = Counter()
    for col, model in ((Task.tags, Task), (Memory.tags, Memory)):
        for s in db.scalars(select(col).where(model.user_id == user.id, like(col)).limit(500)):
            counts.update(t for t in unpack_tags(s) if q in t)
    tags = [TagHit(tag=t, count=n) for t, n in counts.most_common(8)]
    return SearchOut(tasks=[task_out(t) for t in tasks], memories=[mem_out(m) for m in mems], tags=tags)
