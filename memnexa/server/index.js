require('dotenv').config();
const path = require('path');
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
const multer = require('multer');
const store = require('./db');
const ai = require('./ai');

const app = express();
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const prod = process.env.NODE_ENV === 'production';
if (prod) app.set('trust proxy', 1);
app.use(express.json({ limit: '1mb' }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret', resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: prod, maxAge: 30 * 864e5 }
}));
app.use(passport.initialize());
app.use(passport.session());
passport.serializeUser((u, d) => d(null, u.id));
passport.deserializeUser((id, d) => d(null, store.getUser(id) || false));

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: BASE + '/auth/google/callback'
  }, (_a, _r, p, done) => done(null, store.upsertUser({
    id: p.id, name: p.displayName, email: p.emails?.[0]?.value, avatar: p.photos?.[0]?.value
  }))));
} else console.warn('! GOOGLE_CLIENT_ID/SECRET missing: Google login disabled');

// ---- auth (first Google sign-in creates the account, so login = signup) ----
app.get('/auth/google', (req, res, next) => {
  if (process.env.GOOGLE_CLIENT_ID)
    return passport.authenticate('google', { scope: ['profile', 'email'], prompt: 'select_account' })(req, res, next);
  if (process.env.DEV_LOGIN === 'true') return res.redirect('/auth/dev'); // local testing without Google
  res.status(500).send('Google login is not set up. For local testing put DEV_LOGIN=true in .env and restart; otherwise add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.');
});
app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login.html?error=1' }),
  (_q, res) => res.redirect('/app'));
app.post('/auth/logout', (req, res) => req.logout(() => res.json({ ok: true })));
if (process.env.DEV_LOGIN === 'true') {
  app.get('/auth/dev', (req, res) =>
    req.login(store.upsertUser({ id: 'dev', name: 'Dev User', email: 'dev@local', avatar: '' }), () => res.redirect('/app')));
}

// ---- pages ----
app.get('/', (req, res) => res.redirect(req.isAuthenticated() ? '/app' : '/login.html'));
app.get('/app', (req, res) => req.isAuthenticated()
  ? res.sendFile(path.join(__dirname, '../views/dashboard.html')) : res.redirect('/login.html'));
app.use(express.static(path.join(__dirname, '../client'), { index: false }));

// ---- api ----
const api = express.Router();
api.use((req, res, next) => req.isAuthenticated() ? next() : res.status(401).json({ error: 'Not signed in' }));
const h = fn => async (req, res) => {
  try { res.json(await fn(req)); } catch (e) { res.status(e.status || 400).json({ error: e.message }); }
};
const notFound = () => Object.assign(new Error('Not found'), { status: 404 });

api.get('/me', h(req => ({ name: req.user.name, email: req.user.email, avatar: req.user.avatar, today: store.today() })));
api.get('/memories', h(req => store.list(req.user.id)));
api.post('/memories', h(req => {
  const items = Array.isArray(req.body) ? req.body : [req.body];
  return items.slice(0, 100).map(m => store.add(req.user.id, m));
}));
api.patch('/memories/:id', h(req => store.update(req.user.id, +req.params.id, req.body) || (() => { throw notFound(); })()));
api.post('/memories/:id/toggle', h(req => store.toggle(req.user.id, +req.params.id) || (() => { throw notFound(); })()));
api.delete('/memories/:id', h(req => store.remove(req.user.id, +req.params.id) ? { ok: true } : (() => { throw notFound(); })()));

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const OK = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'application/pdf'];
api.post('/upload', upload.single('file'), h(async req => {
  if (!req.file) throw new Error('No file received');
  if (!OK.includes(req.file.mimetype)) throw new Error('Only PNG, JPG, WEBP, GIF or PDF files are supported');
  const items = await ai.extract(req.file.buffer, req.file.mimetype, store.today());
  const source = req.file.mimetype === 'application/pdf' ? 'pdf' : 'screenshot';
  return items.slice(0, 50).map(i => ({ ...i, source }));
}));
api.post('/ask', h(async req => {
  const q = String(req.body.question || '').trim();
  if (!q) throw new Error('Ask something first');
  return { answer: await ai.ask(q, store.list(req.user.id), store.today()) };
}));
api.get('/export.csv', (req, res) => {
  const q = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const rows = store.list(req.user.id).map(m => [m.title, m.type, m.status, m.due_date, m.priority, m.tags, m.notes].map(q).join(','));
  res.type('text/csv').attachment('memnexa-export.csv').send(['title,type,status,due_date,priority,tags,notes', ...rows].join('\n'));
});
app.use('/api', api);

setInterval(() => {
  try { for (const u of store.db.prepare('SELECT id FROM users').all()) store.rollover(u.id); } catch (e) { console.error(e); }
}, 36e5);
app.listen(process.env.PORT || 3000, () => console.log('Memnexa running at ' + BASE));
