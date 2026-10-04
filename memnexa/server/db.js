const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(process.env.DB_PATH || 'memnexa.db');
db.exec(`
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, google_id TEXT UNIQUE, name TEXT, email TEXT, avatar TEXT);
CREATE TABLE IF NOT EXISTS memories(
  id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, title TEXT NOT NULL, notes TEXT DEFAULT '',
  type TEXT DEFAULT 'task', due_date TEXT, status TEXT DEFAULT 'active', priority TEXT DEFAULT 'medium',
  tags TEXT DEFAULT '', recur TEXT DEFAULT '', source TEXT DEFAULT 'typed',
  created_at TEXT DEFAULT (datetime('now')), done_at TEXT);
CREATE INDEX IF NOT EXISTS idx_mem ON memories(user_id, status, due_date);`);

const fmt = d => d.toLocaleDateString('en-CA');
const today = () => fmt(new Date());
const addDays = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return fmt(d); };
const addMonths = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setMonth(d.getMonth() + n); return fmt(d); };
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function upsertUser(p) {
  db.prepare(`INSERT INTO users(google_id,name,email,avatar) VALUES(?,?,?,?)
    ON CONFLICT(google_id) DO UPDATE SET name=excluded.name,email=excluded.email,avatar=excluded.avatar`)
    .run(p.id, p.name ?? '', p.email ?? '', p.avatar ?? '');
  return db.prepare('SELECT * FROM users WHERE google_id=?').get(p.id);
}
const getUser = id => db.prepare('SELECT * FROM users WHERE id=?').get(id);

// Overdue tasks past the grace window move to history (struck off or not)
function rollover(uid) {
  const grace = Number(process.env.GRACE_DAYS ?? 1);
  db.prepare(`UPDATE memories SET status='history' WHERE user_id=? AND type='task'
    AND status IN ('active','done') AND due_date IS NOT NULL AND due_date<?`).run(uid, addDays(today(), -grace));
}
function list(uid) {
  rollover(uid);
  return db.prepare('SELECT * FROM memories WHERE user_id=? ORDER BY due_date IS NULL, due_date, id').all(uid);
}
function clean(m) {
  const tags = Array.isArray(m.tags) ? m.tags.join(',') : String(m.tags || '');
  return {
    title: String(m.title || '').trim().slice(0, 300),
    notes: String(m.notes || '').slice(0, 5000),
    type: m.type === 'life' ? 'life' : 'task',
    due_date: DATE.test(m.due_date || '') ? m.due_date : null,
    priority: ['low', 'medium', 'high'].includes(m.priority) ? m.priority : 'medium',
    tags: tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean).join(','),
    recur: ['daily', 'weekly', 'monthly'].includes(m.recur) ? m.recur : '',
    source: ['typed', 'screenshot', 'pdf', 'voice'].includes(m.source) ? m.source : 'typed'
  };
}
function add(uid, m) {
  const c = clean(m);
  if (!c.title) throw new Error('Title is required');
  const r = db.prepare(`INSERT INTO memories(user_id,title,notes,type,due_date,priority,tags,recur,source)
    VALUES(?,?,?,?,?,?,?,?,?)`).run(uid, c.title, c.notes, c.type, c.due_date, c.priority, c.tags, c.recur, c.source);
  return db.prepare('SELECT * FROM memories WHERE id=?').get(r.lastInsertRowid);
}
function update(uid, id, patch) {
  const cur = db.prepare('SELECT * FROM memories WHERE id=? AND user_id=?').get(id, uid);
  if (!cur) return null;
  const c = clean({ ...cur, ...patch });
  db.prepare('UPDATE memories SET title=?,notes=?,type=?,due_date=?,priority=?,tags=?,recur=? WHERE id=? AND user_id=?')
    .run(c.title, c.notes, c.type, c.due_date, c.priority, c.tags, c.recur, id, uid);
  return db.prepare('SELECT * FROM memories WHERE id=?').get(id);
}
const remove = (uid, id) => db.prepare('DELETE FROM memories WHERE id=? AND user_id=?').run(id, uid).changes > 0;

// Strike off / un-strike. Completing a recurring task spawns the next one.
function toggle(uid, id) {
  const m = db.prepare("SELECT * FROM memories WHERE id=? AND user_id=? AND type='task'").get(id, uid);
  if (!m || m.status === 'history') return null;
  if (m.status === 'done') {
    db.prepare("UPDATE memories SET status='active',done_at=NULL WHERE id=?").run(id);
  } else {
    db.prepare("UPDATE memories SET status='done',done_at=? WHERE id=?").run(today(), id);
    if (m.recur && m.due_date) {
      const next = m.recur === 'daily' ? addDays(m.due_date, 1) : m.recur === 'weekly' ? addDays(m.due_date, 7) : addMonths(m.due_date, 1);
      add(uid, { ...m, due_date: next });
      db.prepare("UPDATE memories SET recur='' WHERE id=?").run(id);
    }
  }
  return db.prepare('SELECT * FROM memories WHERE id=?').get(id);
}
module.exports = { db, today, addDays, upsertUser, getUser, list, add, update, remove, toggle, rollover };
