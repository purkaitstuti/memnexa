import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Sparkles, X } from "lucide-react";
import { api, dueLabel, type SearchResult } from "../api";
import { Badge } from "./ui";

export default function SearchBox() {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [res, setRes] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  const close = () => { setOpen(false); setQ(""); setRes(null); setErr(""); };
  const go = (path: string) => { close(); nav(path); };

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName ?? "";
      if (e.key === "Escape") close();
      else if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(tag) && !open) { e.preventDefault(); setOpen(true); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [open]);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);

  useEffect(() => {
    const term = q.trim();
    if (!term) { setRes(null); setErr(""); return; }
    const id = ++seq.current;
    setLoading(true);
    const t = setTimeout(async () => {
      try { const r = await api.get<SearchResult>(`/search?q=${encodeURIComponent(term)}`); if (id === seq.current) { setRes(r); setErr(""); } }
      catch (e) { if (id === seq.current) setErr((e as Error).message); }
      finally { if (id === seq.current) setLoading(false); }
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const empty = res && !res.tasks.length && !res.memories.length && !res.tags.length;
  const head = "px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-slate-400";
  const row = "flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800";

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="Search" title="Search (press /)" className="rounded-xl p-2.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
        <Search className="h-5 w-5" /></button>
      {open && (
        <div className="fixed inset-0 z-[70] bg-slate-900/50 p-3 pt-16 md:pt-24" onClick={close}>
          <div role="dialog" aria-modal="true" aria-label="Search" onClick={(e) => e.stopPropagation()} className="mx-auto w-full max-w-xl rounded-2xl bg-white shadow-xl dark:bg-slate-900">
            <div className="flex items-center gap-2 border-b border-slate-200 px-4 dark:border-slate-800">
              <Search className="h-5 w-5 shrink-0 text-slate-400" />
              <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} maxLength={100} placeholder="Search tasks, memories and tags…" aria-label="Search your tasks, memories and tags"
                className="min-w-0 flex-1 bg-transparent py-4 text-sm outline-none placeholder-slate-400" />
              <button onClick={close} aria-label="Close search" className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700"><X className="h-5 w-5" /></button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-2" aria-live="polite">
              {!q.trim() && <p className="px-3 py-8 text-center text-sm text-slate-500">Type to search everything you've saved.</p>}
              {err && <p role="alert" className="px-3 py-4 text-sm text-red-600">{err}</p>}
              {loading && !res && q.trim() && <p className="px-3 py-6 text-center text-sm text-slate-500">Searching…</p>}
              {res && !err && (<>
                {res.tasks.length > 0 && <><p className={head}>Tasks</p>{res.tasks.map((t) => (
                  <button key={`t${t.id}`} className={row} onClick={() => go(`/add?task=${t.id}`)}>
                    <span className="break-words text-sm font-medium">{t.title}</span>
                    <span className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">{dueLabel(t)}
                      {t.is_overdue && <Badge tone="red">Overdue</Badge>}{t.status === "completed" && <Badge tone="green">Completed</Badge>}</span></button>))}</>}
                {res.memories.length > 0 && <><p className={head}>Memories</p>{res.memories.map((m) => (
                  <button key={`m${m.id}`} className={row} onClick={() => go(`/add?memory=${m.id}`)}>
                    <span className="break-words text-sm font-medium">{m.title}</span>
                    <span className="line-clamp-1 text-xs text-slate-500">{m.category}{m.content ? ` · ${m.content}` : ""}</span></button>))}</>}
                {res.tags.length > 0 && <><p className={head}>Tags</p>{res.tags.map((t) => (
                  <button key={t.tag} className={row} onClick={() => go(`/history?tag=${encodeURIComponent(t.tag)}`)}>
                    <span className="text-sm font-medium">#{t.tag}</span><span className="text-xs text-slate-500">{t.count} item{t.count === 1 ? "" : "s"} · show matching tasks</span></button>))}</>}
                {empty && <p className="px-3 py-6 text-center text-sm text-slate-500">Nothing matches “{q.trim()}”. Try a different word.</p>}
              </>)}
              {q.trim() && <button className={`${row} mt-1 border-t border-slate-200 dark:border-slate-800`} onClick={() => go(`/ask?q=${encodeURIComponent(q.trim())}`)}>
                <span className="flex items-center gap-2 text-sm font-medium text-brand"><Sparkles className="h-4 w-4" />Ask Memnexa: “{q.trim()}”</span>
                <span className="text-xs text-slate-500">Better for questions that need reasoning</span></button>}
            </div>
          </div>
        </div>)}
    </>
  );
}
