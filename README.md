# Memnexa

**Your memory, and what to do next.** Memnexa is a personal memory and task assistant: save memories and notes, upload screenshots/PDFs and let AI suggest tasks, see deadlines on a calendar, get reminders, and ask questions about what you saved.

- Frontend: React + TypeScript + Vite + Tailwind CSS
- Backend: FastAPI + SQLAlchemy + SQLite
- AI: Ollama running locally (default model `gemma4:e2b`), so your data stays on your computer
- OCR: Tesseract (screenshots/images only)

## 1. Prerequisites
| Tool | Version | Install |
|---|---|---|
| Python | 3.11+ | Windows: `winget install Python.Python.3.12` · macOS: `brew install python` |
| Node.js | 20+ | Windows: `winget install OpenJS.NodeJS.LTS` · macOS: `brew install node` |
| Ollama | latest | https://ollama.com/download |
| Tesseract OCR | any recent | Windows: `winget install UB-Mannheim.TesseractOCR` · macOS: `brew install tesseract` · Linux: `sudo apt install tesseract-ocr` |

## 2. Install dependencies
Run these in the project folder (the one containing `backend` and `frontend`).

**Windows PowerShell**
```powershell
cd backend
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
cd ..\frontend
npm install
```
**macOS / Linux**
```bash
cd backend && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
cd ../frontend && npm install
```
If PowerShell blocks the activate script, run once: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

## 3. Configure environment variables
Copy `.env.example` to `.env` in the project folder (next to `backend` and `frontend`) and edit it.
```powershell
copy .env.example .env      # macOS/Linux: cp .env.example .env
```
| Variable | Meaning |
|---|---|
| `SECRET_KEY` | Long random string that signs sessions. **Change it.** Generate one: `python -c "import secrets; print(secrets.token_urlsafe(48))"` |
| `DATABASE_URL` | Default `sqlite:///./memnexa.db` |
| `FRONTEND_ORIGIN` / `BACKEND_URL` | Default `http://localhost:5173` / `http://localhost:8000` |
| `COOKIE_SECURE` | `true` when served over HTTPS |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | See section 9 |
| `OLLAMA_BASE_URL` / `OLLAMA_MODEL` | Default `http://localhost:11434` / `gemma4:e2b` |
| `MAX_UPLOAD_MB` / `TESSERACT_CMD` | Upload limit (default 10) / full path to `tesseract.exe` if it isn't found automatically |

Secrets live only in `.env` (never committed, never sent to the browser).

## 4. Start the backend (terminal 1)
```powershell
cd backend
.venv\Scripts\Activate.ps1
uvicorn app.main:app --reload
```
API docs: http://localhost:8000/docs · health check: http://localhost:8000/api/health

## 5. Start the frontend (terminal 2)
```powershell
cd frontend
npm run dev
```
Open http://localhost:5173. The dev server proxies `/api` to the backend. Production check: `npm run build`.

## 6. Ollama and the AI model
```powershell
ollama -v                       # keep Ollama up to date
ollama pull gemma4:e2b          # smallest/fastest; gemma4:e4b answers better but is larger
ollama run gemma4:e2b "Say hello"
```
## 7. Test the AI assistant
Sign up, add a couple of tasks, open **Ask Memnexa** and click *What do I need to do this weekend?*. The first answer can take up to a minute while the model loads. Dates, statuses and ranges are computed by the backend; the model only phrases the answer from your own saved items, and says so when nothing matches.

## 8. Change the Ollama model
Edit `OLLAMA_MODEL` in `.env`, run `ollama pull <that model>`, restart the backend. Bigger models answer better but need more RAM and respond slower.

## 9. Google OAuth
1. Google Cloud Console, then *APIs & Services > Credentials > Create credentials > OAuth client ID* (type **Web application**).
2. Authorized redirect URI: `http://localhost:8000/api/auth/google/callback` (use your real backend URL when deployed).
3. Put the client ID and secret in `.env`, restart the backend.
Until this is done, the Google button shows a setup message; it never pretends to sign you in.

## 10. Database
SQLite tables are created automatically on first start (`memnexa.db` in the folder you start uvicorn from). Delete that file to reset everything. For a production database or schema changes, add Alembic migrations first (not included yet).

## 11. Uploads and OCR
Supported: PNG, JPG, WEBP, PDF, TXT, MD up to `MAX_UPLOAD_MB`. Files are read in memory, checked against their real content type, never saved or executed. Screenshots need Tesseract (section 1). Scanned PDFs with no selectable text are not supported: upload page screenshots instead. Nothing is saved until you review and confirm; weekday dates ("Friday") are proposed in code and marked *Please confirm the date*.

## 12. Reminders and notifications: how they work, and limits
- A reminder is stored with the task or memory. Every 45 seconds while Memnexa is open (and on load), the server creates one in-app notification per reminder that has come due, so nothing is lost on refresh and there are no duplicates.
- **There is no background scheduler.** If the app is closed, a due reminder appears next time you open Memnexa (reminders older than 7 days are skipped).
- **Browser notifications** (enable in Settings) use the Notifications API and only pop up while Memnexa is open in a tab. They cannot wake a closed browser, and permission being granted is not a delivery guarantee.
- New tasks with a due date and no reminder get your default timing from Settings ("No default reminder" turns this off).
- Reliable closed-app reminders would need a server-side scheduler plus email/push; that is not built.

## 13. Run the tests
```powershell
cd backend
.venv\Scripts\Activate.ps1
pytest
```
Covers registration/login, protected routes, task and memory CRUD, overdue logic, calendar ranges, user data isolation, recent searches, AI errors, uploads, reminders, search, password change, export and account deletion. (Frontend: `npm run build` type-checks it; there are no automated UI tests.)

## 14. Troubleshooting
| Problem | Fix |
|---|---|
| `No module named 'memnexas1'` (or any wrong package) in `pytest` | An editor auto-import rewrote an import. Imports must start with `app.` or `.`. Turn off Python "Auto Import Completions" in VS Code. |
| `cannot import name 'x' from 'app'` | Files are missing from `backend\app`: copy the whole folder from the latest zip. |
| `npm run dev`: `package.json` not found | Run it inside `frontend`, not `backend`. |
| Vite: `Failed to resolve import ./components/ui` | `components` and `pages` must be inside `frontend\src`. |
| `No module named PIL / pytesseract / pypdf` | `pip install -r requirements.txt` inside the activated venv. |
| Images can't be read | Install Tesseract; if `tesseract` isn't on PATH, set `TESSERACT_CMD` in `.env` and restart the backend. |
| "Memnexa couldn't connect to the AI assistant" | Start Ollama; check `ollama list` shows your model; `ollama pull <model>` if not. |
| Google button says it isn't configured | Section 9. |
| Date field says "invalid date" | Pick a date, then a time (the Add form fills 23:59 for you). |
| Old behaviour after updating | Another backend may still be on port 8000: stop it, then restart uvicorn from `backend`. |

## 15. Deploying
1. Build the frontend: `cd frontend && npm run build` (output in `frontend/dist`). Serve it from any static host and route `/api/*` to the backend (reverse proxy), so cookies stay same-origin.
2. Run the backend with `uvicorn app.main:app --host 0.0.0.0 --port 8000` behind HTTPS.
3. Set `SECRET_KEY` (strong), `COOKIE_SECURE=true`, `FRONTEND_ORIGIN` and `BACKEND_URL` to your real URLs, and add the real Google redirect URI.
4. The AI needs Ollama on the server (or reachable via `OLLAMA_BASE_URL`) with enough RAM, otherwise Ask and AI suggestions will report the AI as unavailable.
5. The rate limiter and reminders run in a single process; if you scale to several workers, move limits to Redis.
6. SQLite is fine for one small server; move to PostgreSQL (and add migrations) for anything larger.

## Known limitations
No password reset by email, no email/push reminders, no semantic (embedding) search (keyword retrieval only), scanned PDFs unsupported, no automated frontend tests.
