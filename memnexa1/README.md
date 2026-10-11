# Memnexa

Node 22.5+ required (uses built-in `node:sqlite`).

## Setup
1. `npm install`
2. `cp .env.example .env` and fill it in.
3. **Google OAuth:** Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID (Web application).
   Authorized redirect URI: `http://localhost:3000/auth/google/callback` (use your real domain in production).
   Put the Client ID and Secret in `.env`. On the consent screen, add yourself as a test user.
4. **AI (screenshots, PDFs, Ask):** install Ollama (https://ollama.com), then run `ollama pull gemma3:4b`. Keep Ollama running.
   Text-based PDFs are read as text; scanned PDFs must be uploaded as screenshots.
5. `npm start`, then open http://localhost:3000

No Google yet? Set `DEV_LOGIN=true` and visit `/auth/dev` to try the app locally (never in production).

## Behaviour
- Overdue + not struck off: shown **red**. After `GRACE_DAYS` (default 1) it moves to **History** as "Missed".
- Struck-off tasks past their date go to History as "Completed".
- Recurring tasks create the next occurrence when struck off.

## Production
Set `NODE_ENV=production`, `BASE_URL` to your https URL, a long `SESSION_SECRET`, and persist `memnexa.db`.
The default session store is in-memory (users re-login after a restart); swap in a persistent store for scale.
