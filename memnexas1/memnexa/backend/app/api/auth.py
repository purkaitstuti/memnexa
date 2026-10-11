from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from authlib.integrations.starlette_client import OAuth, OAuthError
from sqlalchemy import select
from sqlalchemy.orm import Session
from ..config import settings
from ..deps import COOKIE, current_user, get_db
from ..models import User
from ..ratelimit import hit
from ..schemas import Login, ProfileUpdate, SignUp, UserOut
from ..security import hash_password, make_token, verify_password

router = APIRouter(prefix="/api/auth", tags=["auth"])

oauth = OAuth()
if settings.google_client_id and settings.google_client_secret:
    oauth.register(
        name="google",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"},
    )


def set_session(resp: Response, user_id: int):
    resp.set_cookie(COOKIE, make_token(user_id), httponly=True, samesite="lax",
                    secure=settings.cookie_secure, max_age=settings.session_days * 86400, path="/")


@router.post("/signup", response_model=UserOut, status_code=201)
def signup(data: SignUp, request: Request, response: Response, db: Session = Depends(get_db)):
    hit(f"auth:{request.client.host if request.client else '-'}", 20)
    email = data.email.lower()
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(409, "An account with this email already exists")
    user = User(name=data.name.strip(), email=email, password_hash=hash_password(data.password))
    db.add(user); db.commit()
    set_session(response, user.id)
    return user


@router.post("/login", response_model=UserOut)
def login(data: Login, request: Request, response: Response, db: Session = Depends(get_db)):
    hit(f"auth:{request.client.host if request.client else '-'}", 20)
    user = db.scalar(select(User).where(User.email == data.email.lower()))
    if not user or not user.password_hash or not verify_password(data.password, user.password_hash):
        raise HTTPException(401, "Incorrect email or password")
    set_session(response, user.id)
    return user


@router.post("/logout", status_code=204)
def logout(response: Response):
    response.delete_cookie(COOKIE, path="/")


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(current_user)):
    return user


@router.patch("/me", response_model=UserOut)
def update_me(data: ProfileUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    for k, v in data.model_dump(exclude_unset=True).items():
        if v is not None:
            setattr(user, k, v)
    db.commit()
    return user


@router.get("/google/status")
def google_status():
    return {"configured": "google" in oauth._clients}


@router.get("/google/login")
async def google_login(request: Request):
    if "google" not in oauth._clients:
        raise HTTPException(503, "Google sign-in is not configured. Set GOOGLE_CLIENT_ID and "
                                 "GOOGLE_CLIENT_SECRET in .env (see README, section 'Google OAuth').")
    return await oauth.google.authorize_redirect(request, f"{settings.backend_url}/api/auth/google/callback")


@router.get("/google/callback")
async def google_callback(request: Request, db: Session = Depends(get_db)):
    if "google" not in oauth._clients:
        raise HTTPException(503, "Google sign-in is not configured")
    try:
        token = await oauth.google.authorize_access_token(request)
    except OAuthError:
        return RedirectResponse(f"{settings.frontend_origin}/login?error=google_failed")
    info = token.get("userinfo") or {}
    email = (info.get("email") or "").lower()
    if not email or not info.get("email_verified", False):
        return RedirectResponse(f"{settings.frontend_origin}/login?error=google_email")
    user = db.scalar(select(User).where(User.email == email))
    if not user:
        user = User(name=info.get("name") or email.split("@")[0], email=email, provider="google")
        db.add(user); db.commit()
    resp = RedirectResponse(f"{settings.frontend_origin}/")
    set_session(resp, user.id)
    return resp
