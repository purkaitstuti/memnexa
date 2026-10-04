const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let M = [], T = '', view = 'today', type = 'task';

function toast(m) { const t = $('#toast'); t.textContent = m; t.style.display = 'block'; clearTimeout(toast.t); toast.t = setTimeout(() => t.style.display = 'none', 3500); }
async function api(path, opt = {}) {
  const o = { credentials: 'same-origin', ...opt };
  if (o.body && !(o.body instanceof FormData)) { o.headers = { 'Content-Type': 'application/json' }; o.body = JSON.stringify(o.body); }
  const r = await fetch('/api' + path, o);
  if (r.status === 401) { location = '/login.html'; throw new Error('Signed out'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Request failed');
  return j;
}
const guard = fn => async (...a) => { try { await fn(...a); } catch (e) { toast(e.message); } };
const isOver = m => m.type === 'task' && m.status === 'active' && m.due_date && m.due_date < T;

async function load() { M = await api('/memories'); render(); }

function filtered() {
  const q = $('#q').value.trim().toLowerCase();
  let r = M.filter(m => !q || (m.title + ' ' + m.notes + ' #' + m.tags.split(',').join(' #')).toLowerCase().includes(q));
  if (view === 'today') r = r.filter(m => m.type === 'task' && m.status !== 'history' && m.due_date && m.due_date <= T);
  if (view === 'tasks') r = r.filter(m => m.type === 'task' && m.status !== 'history');
  if (view === 'life') r = r.filter(m => m.type === 'life');
  if (view === 'history') r = r.filter(m => m.status === 'history').reverse();
  return r;
}
function renderList() {
  const r = filtered();
  $('#list').innerHTML = r.length ? r.map(m => {
    const hist = m.status === 'history', missed = hist && !m.done_at, over = isOver(m);
    const tags = m.tags ? m.tags.split(',').map(t => `<span class="pill">#${esc(t)}</span>`).join('') : '';
    return `<div class="item ${over || missed ? 'over' : ''} ${m.status === 'done' || (hist && m.done_at) ? 'done' : ''}">
      ${m.type === 'task' && !hist ? `<input type="checkbox" data-id="${m.id}" ${m.status === 'done' ? 'checked' : ''}>` : `<span>${m.type === 'life' ? '💭' : missed ? '✖' : '✔'}</span>`}
      <div class="grow"><div class="t">${esc(m.title)}</div>${m.notes ? `<div class="meta">${esc(m.notes)}</div>` : ''}
      <div class="meta">${m.due_date ? `<span class="due ${over || missed ? 'red' : ''}">${m.type === 'life' ? '' : '📅 '}${m.due_date}${over ? ' · OVERDUE' : ''}</span>` : ''}
      ${m.type === 'task' ? `<span class="pill ${m.priority === 'high' ? 'high' : ''}">${m.priority}</span>` : ''}
      ${hist ? `<span class="pill">${missed ? 'Missed' : 'Completed'}</span>` : ''}${m.recur ? `<span class="pill">🔁 ${m.recur}</span>` : ''}
      ${m.source !== 'typed' ? `<span class="pill">${m.source}</span>` : ''}${tags}</div></div>
      <button class="x" data-del="${m.id}" title="Delete">×</button></div>`;
  }).join('') : '<div class="empty">Nothing here yet.</div>';
}
function renderChart() {
  const days = [...Array(14)].map((_, i) => { const d = new Date(T + 'T12:00:00'); d.setDate(d.getDate() - 2 + i); return d.toLocaleDateString('en-CA'); });
  $('#chart').innerHTML = days.map(d => {
    const ts = M.filter(m => m.type === 'task' && m.due_date === d);
    const od = d < T && ts.some(m => !m.done_at);
    const lbl = new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
    return `<div class="col ${d === T ? 'today' : ''}"><h4>${lbl}</h4>
      <div class="bar"><i class="${od ? 'red' : ''}" style="height:${Math.min(ts.length * 20, 60)}px"></i></div>
      ${ts.map(m => `<div class="chip ${m.done_at ? 'done' : d < T ? 'red' : ''}" title="${esc(m.title)}">${esc(m.title)}</div>`).join('')}</div>`;
  }).join('');
}
function renderStats() {
  const doneDays = new Set(M.filter(m => m.done_at).map(m => m.done_at));
  let s = 0, d = new Date(T + 'T12:00:00'); if (!doneDays.has(T)) d.setDate(d.getDate() - 1);
  while (doneDays.has(d.toLocaleDateString('en-CA'))) { s++; d.setDate(d.getDate() - 1); }
  $('#sStreak').textContent = s;
  $('#sDone').textContent = M.filter(m => m.done_at).length;
  $('#sOver').textContent = M.filter(isOver).length;
  $('#sMiss').textContent = M.filter(m => m.status === 'history' && !m.done_at).length;
  const md = T.slice(5), y = T.slice(0, 4);
  const o = M.filter(m => m.type === 'life' && m.due_date && m.due_date.slice(5) === md && m.due_date.slice(0, 4) < y);
  $('#otd').innerHTML = o.length ? o.map(m => `<div>• <b>${m.due_date.slice(0, 4)}</b> – ${esc(m.title)}</div>`).join('') : 'No life memories from this date in earlier years.';
}
const render = () => { renderList(); renderChart(); renderStats(); };

// ---- add ----
document.querySelectorAll('.seg button').forEach(b => b.onclick = () => {
  type = b.dataset.t; document.querySelectorAll('.seg button').forEach(x => x.classList.toggle('on', x === b));
  $('#pri').style.display = $('#rec').style.display = type === 'task' ? '' : 'none';
  $('#title').placeholder = type === 'task' ? 'What do you need to do?' : 'What do you want to remember from your life?';
});
$('#add').onclick = guard(async () => {
  const title = $('#title').value.trim(); if (!title) return toast('Write something first');
  await api('/memories', { method: 'POST', body: { title, type, due_date: $('#due').value, priority: $('#pri').value, recur: type === 'task' ? $('#rec').value : '', tags: $('#tags').value, source: voiceUsed ? 'voice' : 'typed' } });
  $('#title').value = $('#tags').value = $('#due').value = ''; voiceUsed = false; await load(); toast('Added');
});
// voice notes
let voiceUsed = false;
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
$('#mic').onclick = () => {
  if (!SR) return toast('Voice input is not supported in this browser');
  const r = new SR(); r.lang = navigator.language; r.onresult = e => { $('#title').value += ($('#title').value ? ' ' : '') + e.results[0][0].transcript; voiceUsed = true; };
  r.onerror = () => toast('Could not hear you'); r.start(); toast('Listening…');
};
// ---- upload screenshot / pdf ----
const drop = $('#drop'), file = $('#file');
drop.onclick = () => file.click();
file.onchange = () => file.files[0] && up(file.files[0]);
drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); };
drop.ondragleave = () => drop.classList.remove('over');
drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); e.dataTransfer.files[0] && up(e.dataTransfer.files[0]); };
document.addEventListener('paste', e => { const f = [...(e.clipboardData?.files || [])][0]; if (f) up(f); });
const up = guard(async f => {
  toast('Reading ' + f.name + '…'); const fd = new FormData(); fd.append('file', f);
  const items = await api('/upload', { method: 'POST', body: fd }); file.value = '';
  if (!items.length) return toast('No memories found in that file');
  $('#props').innerHTML = items.map((p, i) => `<div class="prop" data-i="${i}"><input type="checkbox" checked>
    <input value="${esc(p.title)}"><input type="date" value="${esc(p.due_date || '')}">
    <select><option ${p.type !== 'life' ? 'selected' : ''} value="task">Task</option><option ${p.type === 'life' ? 'selected' : ''} value="life">Life</option></select></div>`).join('');
  $('#props').items = items; $('#modal').classList.add('show');
});
$('#cancelP').onclick = () => $('#modal').classList.remove('show');
$('#saveP').onclick = guard(async () => {
  const items = $('#props').items, out = [];
  document.querySelectorAll('.prop').forEach(r => { if (!r.children[0].checked) return;
    out.push({ ...items[+r.dataset.i], title: r.children[1].value, due_date: r.children[2].value, type: r.children[3].value }); });
  if (out.length) await api('/memories', { method: 'POST', body: out });
  $('#modal').classList.remove('show'); await load(); toast(out.length + ' memories saved');
});
// ---- ask ----
$('#askBtn').onclick = guard(async () => {
  const question = $('#ask').value.trim(); if (!question) return;
  const a = $('#ans'); a.style.display = 'block'; a.textContent = 'Thinking…';
  try { a.textContent = (await api('/ask', { method: 'POST', body: { question } })).answer; } catch (e) { a.textContent = e.message; }
});
$('#ask').addEventListener('keydown', e => { if (e.key === 'Enter') $('#askBtn').click(); });
// ---- list actions ----
$('#list').onchange = guard(async e => { if (e.target.dataset.id) { await api(`/memories/${e.target.dataset.id}/toggle`, { method: 'POST' }); await load(); } });
$('#list').onclick = guard(async e => { const id = e.target.dataset.del; if (id && confirm('Delete this memory?')) { await api('/memories/' + id, { method: 'DELETE' }); await load(); } });
$('#tabs').onclick = e => { if (!e.target.dataset.v) return; view = e.target.dataset.v; document.querySelectorAll('#tabs button').forEach(b => b.classList.toggle('on', b === e.target)); renderList(); };
$('#q').oninput = renderList;
// ---- theme, reminders, logout ----
const setTheme = t => { document.documentElement.dataset.theme = t; localStorage.setItem('theme', t); };
setTheme(localStorage.getItem('theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
$('#theme').onclick = () => setTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
$('#bell').onclick = async () => toast('Reminders ' + (await Notification.requestPermission() === 'granted' ? 'enabled (keep this tab open)' : 'blocked'));
function remind() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const seen = JSON.parse(localStorage.getItem('seen') || '{}');
  M.filter(m => m.type === 'task' && m.status === 'active' && m.due_date && m.due_date <= T && !seen[m.id + T]).forEach(m => {
    new Notification(m.due_date < T ? 'Overdue: ' + m.title : 'Due today: ' + m.title); seen[m.id + T] = 1; });
  localStorage.setItem('seen', JSON.stringify(seen));
}
$('#out').onclick = async () => { await fetch('/auth/logout', { method: 'POST' }); location = '/login.html'; };
(async () => {
  const me = await api('/me'); T = me.today;
  $('#av').innerHTML = me.avatar ? `<img class="av" src="${esc(me.avatar)}" referrerpolicy="no-referrer">` : esc((me.name || '?')[0]);
  await load(); remind(); setInterval(async () => { try { await load(); remind(); } catch {} }, 6e4);
})().catch(e => toast(e.message));
