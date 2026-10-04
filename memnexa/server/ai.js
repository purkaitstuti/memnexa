// Local AI via Ollama (Gemma). No API key needed.
const OLLAMA = () => (process.env.OLLAMA_URL || 'http://localhost:11434').replace(/\/$/, '');
const MODEL = () => process.env.OLLAMA_MODEL || 'gemma3:4b'; // must be a vision model for screenshots

async function chat(messages, { json = false, max = 1500 } = {}) {
  let res;
  try {
    res = await fetch(OLLAMA() + '/api/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(240000),
      body: JSON.stringify({
        model: MODEL(), messages, stream: false, ...(json ? { format: 'json' } : {}),
        options: { temperature: json ? 0 : 0.3, num_ctx: 8192, num_predict: max }
      })
    });
  } catch (e) {
    throw new Error(e.name === 'TimeoutError'
      ? 'The model took too long. Try a smaller image/file or a smaller model.'
      : `Cannot reach Ollama at ${OLLAMA()}. Start it (open the Ollama app or run "ollama serve").`);
  }
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(/not found/i.test(j.error || '')
    ? `Model "${MODEL()}" is not installed. Run: ollama pull ${MODEL()}` : j.error || 'Ollama error ' + res.status);
  return j.message?.content || '';
}

function parseItems(t) {
  const tryParse = s => { try { return JSON.parse(s); } catch { return null; } };
  let v = tryParse(t);
  if (!v) { const a = t.indexOf('['), b = t.lastIndexOf(']'); if (a >= 0 && b > a) v = tryParse(t.slice(a, b + 1)); }
  if (!v) { const a = t.indexOf('{'), b = t.lastIndexOf('}'); if (a >= 0 && b > a) v = tryParse(t.slice(a, b + 1)); }
  const arr = Array.isArray(v) ? v : Array.isArray(v?.items) ? v.items : v?.title ? [v] : [];
  return arr.filter(i => i && typeof i.title === 'string' && i.title.trim());
}

async function extract(buffer, mime, today) {
  const prompt = `Today is ${today}. Extract every task, deadline, event or thing worth remembering.
Reply with ONLY a JSON object: {"items":[{"title":string,"notes":string,"type":"task"|"life","due_date":"YYYY-MM-DD" or null,"priority":"low"|"medium"|"high","tags":[string]}]}
Use "task" for things to do by a date and "life" for personal memories or facts. Resolve relative dates (tomorrow, next Friday) against today. If nothing is found, reply {"items":[]}.`;
  let msg;
  if (mime === 'application/pdf') {
    const pdf = require('pdf-parse');
    const { text } = await pdf(buffer);
    if (!text || text.trim().length < 20)
      throw new Error('This PDF has no selectable text (it looks scanned). Upload a screenshot of it instead.');
    msg = { role: 'user', content: `${prompt}\n\nDOCUMENT TEXT:\n${text.slice(0, 12000)}` };
  } else {
    msg = { role: 'user', content: prompt, images: [buffer.toString('base64')] };
  }
  return parseItems(await chat([msg], { json: true, max: 2000 }));
}

async function ask(question, memories, today) {
  const ctx = memories.slice(-150).map(m =>
    `[${m.type}|${m.status}] ${m.title}${m.due_date ? ' | date ' + m.due_date : ''}${m.tags ? ' | tags ' + m.tags : ''}${m.notes ? ' | ' + m.notes.slice(0, 150) : ''}`).join('\n');
  return (await chat([
    { role: 'system', content: `You are Memnexa, a personal memory assistant. Today is ${today}. Answer ONLY from the user's memories below. If the answer is not there, say you don't have it. Be concise.\n\nMEMORIES:\n${ctx || '(none yet)'}` },
    { role: 'user', content: question }
  ], { max: 600 })).trim();
}
module.exports = { extract, ask, parseItems };
