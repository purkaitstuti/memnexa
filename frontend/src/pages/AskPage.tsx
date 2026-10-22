import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Brain, Send, Sparkles, Trash2, X } from "lucide-react";
import { api, dueLabel, type AskResult, type Memory, type Recent, type Task } from "../api";
import { Badge, Button, Card, ErrorBox, inputCls, useToast } from "../components/ui";

type Msg = { role: "user" | "ai" | "error"; text: string; tasks?: Task[]; memories?: Memory[]; q?: string };

const SUGGESTED = [
  "What do I need to do this weekend?", "What assignments are due next week?", "Which tasks are overdue?",
  "What did I save about my last project?", "What important things should I remember today?",
  "Show me my pending academic tasks.", "What deadlines do I have this month?",
];

function Rich({ text }: { text: string }) {
  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {text.split("\n").map((l, i) => {
        if (!l.trim()) return null;
        const b = l.match(/^\s*[-*•]\s+(.*)/);
        const parts = (b ? b[1] : l).split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
          p.startsWith("**") && p.endsWith("**") ? <strong key={j}>{p.slice(2, -2)}</strong> : <span key={j}>{p}</span>);
        return b ? <div key={i} className="flex gap-2"><span>•</span><span>{parts}</span></div> : <p key={i}>{parts}</p>;
      })}
    </div>
  );
}

export default function AskPage() {
  const toast = useToast();
  const [sp] = useSearchParams();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState<Recent[]>([]);
  const end = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  const loadRecent = useCallback(() => { api.get<Recent[]>("/ask/recent").then(setRecent).catch(() => {}); }, []);
  const ask = useCallback(async (raw: string) => {
    const q = raw.trim();
    if (!q || busy) return;
    setMsgs((m) => [...m, { role: "user", text: q }]); setInput(""); setBusy(true);
    try {
      const r = await api.post<AskResult>("/ask", { question: q, tz: Intl.DateTimeFormat().resolvedOptions().timeZone, tz_offset: -new Date().getTimezoneOffset() });
      setMsgs((m) => [...m, { role: "ai", text: r.answer, tasks: r.tasks, memories: r.memories }]);
      loadRecent();
    } catch (e) { setMsgs((m) => [...m, { role: "error", text: (e as Error).message, q }]); } finally { setBusy(false); }
  }, [busy, loadRecent]);

  useEffect(() => { loadRecent(); }, [loadRecent]);
  useEffect(() => { const q = sp.get("q"); if (q && !started.current) { started.current = true; ask(q); } }, [sp, ask]);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  async function removeOne(id: number) { try { await api.del(`/ask/recent/${id}`); setRecent((r) => r.filter((x) => x.id !== id)); } catch (e) { toast((e as Error).message, "err"); } }
  async function clearAll() { try { await api.del("/ask/recent"); setRecent([]); toast("Recent searches cleared"); } catch (e) { toast((e as Error).message, "err"); } }
  const submit = (e: FormEvent) => { e.preventDefault(); ask(input); };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="flex min-w-0 flex-col lg:col-span-2">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold"><Sparkles className="h-5 w-5 text-brand" />Ask Memnexa</div>
          {msgs.length > 0 && <button onClick={() => setMsgs([])} className="text-sm text-slate-500 hover:text-red-600">Clear conversation</button>}
        </div>
        <div className="h-[52vh] min-h-[260px] space-y-4 overflow-y-auto overflow-x-hidden pr-1 lg:h-[60vh]" aria-live="polite">
          {msgs.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-10 text-center">
              <span className="rounded-2xl bg-brand-light p-3 text-brand dark:bg-indigo-950"><Brain className="h-7 w-7" /></span>
              <p className="font-medium">Ask about your tasks and memories</p>
              <p className="max-w-sm text-sm text-slate-500 dark:text-slate-400">Answers come only from what you've saved. If it isn't there, Memnexa will say so.</p>
            </div>
          )}
          {msgs.map((m, i) => m.role === "user" ? (
            <div key={i} className="flex justify-end"><div className="max-w-[85%] break-words rounded-2xl rounded-br-md bg-brand px-4 py-2.5 text-sm text-white">{m.text}</div></div>
          ) : m.role === "error" ? (
            <ErrorBox key={i} message={m.text} retry={m.q ? () => ask(m.q!) : undefined} />
          ) : (
            <div key={i} className="max-w-full space-y-3 sm:max-w-[92%]">
              <div className="break-words rounded-2xl rounded-bl-md bg-slate-100 px-4 py-3 dark:bg-slate-800"><Rich text={m.text} /></div>
              {(m.tasks?.length || m.memories?.length) ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {m.tasks?.map((t) => (
                    <Link key={`t${t.id}`} to={`/add?task=${t.id}`} className="rounded-xl border border-slate-200 p-3 text-sm hover:border-brand dark:border-slate-700">
                      <div className="mb-1 flex flex-wrap gap-1"><Badge tone="brand">Task</Badge>{t.is_overdue && <Badge tone="red">Overdue</Badge>}{t.status === "completed" && <Badge tone="green">Completed</Badge>}</div>
                      <p className="break-words font-medium">{t.title}</p><p className="text-xs text-slate-500">{dueLabel(t)}</p></Link>))}
                  {m.memories?.map((x) => (
                    <Link key={`m${x.id}`} to={`/add?memory=${x.id}`} className="rounded-xl border border-slate-200 p-3 text-sm hover:border-brand dark:border-slate-700">
                      <div className="mb-1 flex gap-1"><Badge>Memory</Badge><Badge>{x.category}</Badge></div>
                      <p className="break-words font-medium">{x.title}</p><p className="line-clamp-2 text-xs text-slate-500">{x.content}</p></Link>))}
                </div>) : null}
            </div>
          ))}
          {busy && <div className="flex items-center gap-2 text-sm text-slate-500"><span className="h-2 w-2 animate-bounce rounded-full bg-brand" /><span className="h-2 w-2 animate-bounce rounded-full bg-brand [animation-delay:150ms]" /><span className="h-2 w-2 animate-bounce rounded-full bg-brand [animation-delay:300ms]" />Thinking… the first answer can take a little while</div>}
          <div ref={end} />
        </div>
        <form onSubmit={submit} className="mt-4 flex gap-2">
          <input className={`${inputCls} min-w-0 flex-1`} placeholder="Ask a question…" aria-label="Your question" maxLength={500} value={input} onChange={(e) => setInput(e.target.value)} />
          <Button type="submit" disabled={busy || !input.trim()} aria-label="Send" className="shrink-0"><Send className="h-4 w-4" /></Button>
        </form>
      </Card>
      <div className="min-w-0 space-y-6">
        <Card>
          <h3 className="mb-3 font-semibold">Suggested questions</h3>
          <div className="flex flex-wrap gap-2">{SUGGESTED.map((s) => (
            <button key={s} onClick={() => ask(s)} disabled={busy} className="max-w-full whitespace-normal break-words rounded-full border border-slate-200 px-3 py-1.5 text-left text-xs hover:border-brand hover:text-brand disabled:opacity-50 dark:border-slate-700">{s}</button>))}</div>
        </Card>
        <Card>
          <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">Recent searches</h3>
            {recent.length > 0 && <button onClick={clearAll} className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" />Clear all</button>}</div>
          {recent.length === 0 ? <p className="text-sm text-slate-500">Your questions will show up here.</p> : (
            <ul className="space-y-1">{recent.map((r) => (
              <li key={r.id} className="flex items-center gap-1">
                <button onClick={() => ask(r.query)} disabled={busy} className="min-h-[40px] flex-1 truncate rounded-lg px-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800" title={r.query}>{r.query}</button>
                <button onClick={() => removeOne(r.id)} aria-label={`Remove "${r.query}"`} className="rounded-lg p-2 text-slate-400 hover:text-red-600"><X className="h-4 w-4" /></button></li>))}</ul>)}
        </Card>
      </div>
    </div>
  );
}
