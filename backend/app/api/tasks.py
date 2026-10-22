from datetime import datetime, timedelta
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session
from ..deps import current_user, get_db, pack_tags, unpack_tags
from ..models import Task, User, utcnow
from ..schemas import TaskIn, TaskOut, TaskUpdate

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


def is_overdue(t: Task, now: datetime | None = None) -> bool:
    """Overdue = has a due date in the past AND is not completed."""
    return t.status != "completed" and t.due_at is not None and t.due_at < (now or utcnow())


def out(t: Task) -> TaskOut:
    return TaskOut(id=t.id, title=t.title, description=t.description, due_at=t.due_at, priority=t.priority,
                   status=t.status, is_overdue=is_overdue(t), tags=unpack_tags(t.tags),
                   reminder_at=t.reminder_at, completed_at=t.completed_at, created_at=t.created_at)


def owned(db: Session, user: User, task_id: int) -> Task:
    t = db.get(Task, task_id)
    if not t or t.user_id != user.id:  # 404 (not 403) so ids can't be probed
        raise HTTPException(404, "Task not found")
    return t


def apply_default_reminder(user: User, due_at, reminder_at):
    """If no reminder was chosen, use the user's default timing (-1 = no default)."""
    if reminder_at is None and due_at is not None and user.reminders_enabled and user.default_reminder_minutes >= 0:
        return due_at - timedelta(minutes=user.default_reminder_minutes)
    return reminder_at


@router.post("", response_model=TaskOut, status_code=201)
def create(data: TaskIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    t = Task(user_id=user.id, title=data.title.strip(), description=data.description, due_at=data.due_at,
             priority=data.priority, tags=pack_tags(data.tags),
             reminder_at=apply_default_reminder(user, data.due_at, data.reminder_at))
    db.add(t); db.commit()
    return out(t)


@router.get("/stats")
def stats(user: User = Depends(current_user), db: Session = Depends(get_db)):
    now = utcnow()
    base = select(func.count(Task.id)).where(Task.user_id == user.id)
    total = db.scalar(base)
    done = db.scalar(base.where(Task.status == "completed"))
    overdue = db.scalar(base.where(Task.status != "completed", Task.due_at < now))
    return {"total": total, "completed": done, "pending": total - done, "overdue": overdue}


@router.get("/calendar", response_model=list[TaskOut])
def calendar(start: datetime, end: datetime, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Tasks due in [start, end). Pass UTC (or tz-aware) ISO datetimes for the user's local range."""
    from ..schemas import to_utc_naive
    s, e = to_utc_naive(start), to_utc_naive(end)
    rows = db.scalars(select(Task).where(Task.user_id == user.id, Task.due_at >= s, Task.due_at < e)
                      .order_by(Task.due_at)).all()
    return [out(t) for t in rows]


@router.get("")
def history(
    status: Literal["all", "pending", "completed", "overdue"] = "all",
    priority: Literal["low", "medium", "high"] | None = None,
    tag: str | None = None, q: str | None = None,
    date_from: datetime | None = None, date_to: datetime | None = None,
    sort: Literal["due_asc", "due_desc", "created_desc", "priority"] = "due_asc",
    page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100),
    user: User = Depends(current_user), db: Session = Depends(get_db),
):
    from ..schemas import to_utc_naive
    stmt = select(Task).where(Task.user_id == user.id)
    now = utcnow()
    if status == "pending":
        stmt = stmt.where(Task.status == "pending")
    elif status == "completed":
        stmt = stmt.where(Task.status == "completed")
    elif status == "overdue":
        stmt = stmt.where(Task.status != "completed", Task.due_at < now)
    if priority:
        stmt = stmt.where(Task.priority == priority)
    if tag:
        stmt = stmt.where(Task.tags.like(f"%,{tag.strip().lower()},%"))
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Task.title.ilike(like), Task.description.ilike(like), Task.tags.ilike(like)))
    if date_from:
        stmt = stmt.where(Task.due_at >= to_utc_naive(date_from))
    if date_to:
        stmt = stmt.where(Task.due_at < to_utc_naive(date_to))
    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    order = {"due_asc": Task.due_at.asc(), "due_desc": Task.due_at.desc(),
             "created_desc": Task.created_at.desc(), "priority": Task.priority.asc()}[sort]
    rows = db.scalars(stmt.order_by(order, Task.id).offset((page - 1) * size).limit(size)).all()
    return {"items": [out(t) for t in rows], "total": total, "page": page, "size": size}


@router.get("/{task_id}", response_model=TaskOut)
def get_one(task_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return out(owned(db, user, task_id))


@router.patch("/{task_id}", response_model=TaskOut)
def update(task_id: int, data: TaskUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    t = owned(db, user, task_id)
    for k, v in data.model_dump(exclude_unset=True).items():
        setattr(t, k, pack_tags(v) if k == "tags" else v)
    db.commit()
    return out(t)


@router.post("/{task_id}/complete", response_model=TaskOut)
def complete(task_id: int, done: bool = True, user: User = Depends(current_user), db: Session = Depends(get_db)):
    t = owned(db, user, task_id)
    t.status, t.completed_at = ("completed", utcnow()) if done else ("pending", None)
    db.commit()
    return out(t)


@router.delete("/{task_id}", status_code=204)
def delete(task_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    db.delete(owned(db, user, task_id)); db.commit()
