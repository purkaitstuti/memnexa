from pathlib import Path
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from ..ai import user_tz
from ..config import settings
from ..deps import current_user, get_db, pack_tags
from ..extract import ALLOWED, ExtractError, extract_text, sniff
from ..models import Memory, Task, User, utcnow
from ..ratelimit import hit
from ..schemas import MemoryIn, TaskIn
from ..suggest import Suggestion, analyze
from .tasks import apply_default_reminder

MAX_BYTES = settings.max_upload_mb * 1024 * 1024
router = APIRouter(prefix="/api/uploads", tags=["uploads"])


class UploadOut(BaseModel):
    filename: str
    text: str
    suggestions: list[Suggestion]
    ai_error: str | None = None
    summary: str = ""


class AnalyzeIn(BaseModel):
    text: str = Field(min_length=1, max_length=20000)
    tz: str = "UTC"
    tz_offset: int = Field(default=0, ge=-840, le=840)


class AnalyzeOut(BaseModel):
    suggestions: list[Suggestion]
    ai_error: str | None = None
    summary: str = ""


class SaveIn(BaseModel):
    tasks: list[TaskIn] = Field(default=[], max_length=50)
    memories: list[MemoryIn] = Field(default=[], max_length=50)


class SaveOut(BaseModel):
    saved_tasks: int
    saved_memories: int
    skipped: int


@router.post("", response_model=UploadOut)
def upload(file: UploadFile = File(...), tz: str = Form("UTC"), tz_offset: int = Form(0),
           user: User = Depends(current_user)):
    hit(f"upload:{user.id}", 10)
    name = file.filename or "file"
    ext = Path(name).suffix.lower()
    if ext not in ALLOWED:
        raise HTTPException(415, "Unsupported file type. Upload a PNG, JPG, WEBP, PDF, TXT or MD file.")
    data = file.file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(413, f"File is too large. The limit is {settings.max_upload_mb} MB.")
    if not data or not sniff(ext, data):
        raise HTTPException(400, "The file's contents don't match its type, or the file is empty.")
    try:
        text = extract_text(ext, data)
    except ExtractError as e:
        raise HTTPException(422, str(e))
    if not text:
        raise HTTPException(422, "We couldn't find any text in this file. Try another file or add the information manually.")
    suggestions, err, summary = analyze(text, utcnow(), user_tz(tz, tz_offset))
    return UploadOut(filename=name, text=text, suggestions=suggestions, ai_error=err, summary=summary)


@router.post("/analyze", response_model=AnalyzeOut)
def reanalyze(data: AnalyzeIn, user: User = Depends(current_user)):
    hit(f"upload:{user.id}", 10)
    suggestions, err, summary = analyze(data.text, utcnow(), user_tz(data.tz, data.tz_offset))
    return AnalyzeOut(suggestions=suggestions, ai_error=err, summary=summary)


@router.post("/save", response_model=SaveOut)
def save(data: SaveIn, user: User = Depends(current_user), db: Session = Depends(get_db)):
    """Save only what the user confirmed in the review screen. Exact duplicates are skipped."""
    nt = nm = skipped = 0
    for t in data.tasks:
        title = t.title.strip()
        same = db.scalars(select(Task).where(Task.user_id == user.id, func.lower(Task.title) == title.lower())).all()
        if any(x.due_at == t.due_at for x in same):
            skipped += 1
            continue
        db.add(Task(user_id=user.id, title=title, description=t.description, due_at=t.due_at, priority=t.priority,
                    tags=pack_tags(t.tags), reminder_at=apply_default_reminder(user, t.due_at, t.reminder_at)))
        db.flush(); nt += 1
    for m in data.memories:
        title = m.title.strip()
        same = db.scalars(select(Memory).where(Memory.user_id == user.id, func.lower(Memory.title) == title.lower())).all()
        if any(x.content == m.content for x in same):
            skipped += 1
            continue
        db.add(Memory(user_id=user.id, title=title, content=m.content, category=m.category, tags=pack_tags(m.tags),
                      memory_date=m.memory_date, reminder_at=m.reminder_at))
        db.flush(); nm += 1
    db.commit()
    return SaveOut(saved_tasks=nt, saved_memories=nm, skipped=skipped)
