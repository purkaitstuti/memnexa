import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileUp, Loader2 } from "lucide-react";
import { api, fromInput, type Suggestion, type UploadResult } from "../api";
import { Badge, Button, Card, ErrorBox, inputCls, useToast } from "./ui";

const EXT = [".png", ".jpg", ".jpeg", ".webp", ".pdf", ".txt", ".md"];
const MAX_MB = 10;
type Item = { id: number; kind: "task" | "memory" | "skip"; title: string; description: string; date: string; time: string; priority: string; tags: string; phrase: string | null; confirm: boolean };
const toItems = (s: Suggestion[]): Item[] => s.map((x, i) => ({ id: i, kind: x.kind, title: x.title, description: x.description, date: x.due_date ?? "",
  time: x.due_time ?? "", priority: x.priority, tags: x.tags.join(", "), phrase: x.date_phrase, confirm: x.needs_confirm }));
const tzBody = () => ({ tz: Intl.DateTimeFormat().resolvedOptions().timeZone, tz_offset: -new Date().getTimezoneOffset() });
const tags = (s: string) => s.split(",").map((t) => t.trim().replace(/^#/, "")).filter(Boolean);

export default function UploadPanel() {
  const nav = useNavigate();
  const toast = useToast();
  const pick = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [res, setRes] = useState<UploadResult | null>(null);
  const [text, setText] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [aiErr, setAiErr] = useState<string | null>(null);
  const [summary, setSummary] = useState("");

  async function send(file: File | undefined) {
    if (!file) return;
    setErr("");
    const ext = "." + (file.name.split(".").pop() ?? "").toLowerCase();
    if (!EXT.includes(ext)) return setErr("Unsupported file type. Upload a PNG, JPG, WEBP, PDF, TXT or MD file.");
    if (file.size > MAX_MB * 1024 * 1024) return setErr(`File is too large. The limit is ${MAX_MB} MB.`);
    setBusy(true);
    const fd = new FormData();
    fd.append("file", file); const t = tzBody(); fd.append("tz", t.tz); fd.append("tz_offset", String(t.tz_offset));
    try {
      const r = await api.upload<UploadResult>("/uploads", fd);
      setRes(r); setText(r.text); setItems(toItems(r.suggestions)); setAiErr(r.ai_error); setSummary(r.summary);
    } catch (e) { setErr((e as Error).message || "We couldn't extract information from this file. Try another file or add the information manually."); }
    finally { setBusy(false); if (pick.current) pick.current.value = ""; }
  }
  async function reanalyze() {
    setBusy(true); setAiErr(null);
    try { const r = await api.post<{ suggestions: Suggestion[]; ai_error: string | null; summary: string }>("/uploads/analyze", { text, ...tzBody() }); setItems(toItems(r.suggestions)); setAiErr(r.ai_error); setSummary(r.summary); }
    catch (e) { setAiErr((e as Error).message); } finally { setBusy(false); }
  }
  function addManual(kind: "task" | "memory") {
    const base = (summary || text).replace(/\s+/g, " ").trim();
    const title = (base.match(/^.*?[.!?](?=\s|$)/)?.[0] ?? base).slice(0, 100) || res?.filename || "Untitled";
    setItems((l) => [...l, { id: l.reduce((m, x) => Math.max(m, x.id), -1) + 1, kind, title, description: (summary || text).slice(0, 2000),
      date: "", time: "", priority: "medium", tags: "", phrase: null, confirm: false }]);
  }
  const upd = (id: number, p: Partial<Item>) => setItems((l) => l.map((x) => x.id === id ? { ...x, ...p } : x));

  async function save() {
    const chosen = items.filter((i) => i.kind !== "skip" && i.title.trim());
    if (!chosen.length) return toast("Nothing selected to save.", "err");
    setBusy(true);
    try {
      const body = {
        tasks: chosen.filter((i) => i.kind === "task").map((i) => ({ title: i.title, description: i.description, priority: i.priority, tags: tags(i.tags),
          due_at: i.date ? fromInput(`${i.date}T${i.time || "23:59"}`) : null })),
        memories: chosen.filter((i) => i.kind === "memory").map((i) => ({ title: i.title, content: i.description, category: "Other", tags: tags(i.tags),
          memory_date: i.date ? fromInput(`${i.date}T${i.time || "12:00"}`) : null })),
      };
      const r = await api.post<{ saved_tasks: number; saved_memories: number; skipped: number }>("/uploads/save", body);
      toast(`Saved ${r.saved_tasks} task(s) and ${r.saved_memories} memory(ies)` + (r.skipped ? `; skipped ${r.skipped} duplicate(s)` : ""));
      nav("/");
    } catch (e) { toast("Your changes couldn't be saved. " + (e as Error).message, "err"); setBusy(false); }
  }
  async function saveText() {
    setBusy(true);
    try { await api.post("/memories", { title: res?.filename ?? "Uploaded text", content: text, category: "Other", tags: [] }); toast("Saved the text as a memory"); nav("/"); }
    catch (e) { toast("Your changes couldn't be saved. " + (e as Error).message, "err"); setBusy(false); }
  }

  if (!res) return (
    <div className="space-y-4">
      {err && <ErrorBox message={err} />}
      <div onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); send(e.dataTransfer.files[0]); }}
        className={`flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center transition ${drag ? "border-brand bg-brand-light dark:bg-indigo-950/40" : "border-slate-300 dark:border-slate-700"}`}>
        {busy ? <><Loader2 className="h-10 w-10 animate-spin text-brand" /><p className="font-medium">Reading your file… this can take up to a minute</p></> : <>
          <FileUp className="h-10 w-10 text-brand" /><p className="font-medium">Drag a file here</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">Screenshots, images, PDFs or text notes · up to {MAX_MB} MB</p>
          <Button onClick={() => pick.current?.click()}>Browse files</Button></>}
        <input ref={pick} type="file" hidden accept={EXT.join(",")} onChange={(e) => send(e.target.files?.[0])} />
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400">Memnexa reads the text, suggests tasks and memories, and lets you review everything before anything is saved. Prefer to type it yourself? Use the Add Memory or Add Task tab.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Review suggestions from “{res.filename}”</h2>
        <button onClick={() => { setRes(null); setItems([]); setAiErr(null); setSummary(""); }} className="text-sm text-slate-500 hover:text-brand">Upload a different file</button></div>
      <Card className="space-y-3">
        <h3 className="font-semibold">What this says</h3>
        <p className="whitespace-pre-wrap text-sm">{summary || (text.length > 500 ? text.slice(0, 500) + "…" : text)}</p>
        {!summary && <p className="text-xs text-slate-500 dark:text-slate-400">A summary isn't available, so this is the text that was read from the file.</p>}
        <div className="flex flex-wrap gap-2"><Button variant="ghost" onClick={() => addManual("task")}>Add as task</Button><Button variant="ghost" onClick={() => addManual("memory")}>Add as memory</Button></div>
      </Card>
      {aiErr && <ErrorBox message={aiErr} retry={reanalyze} />}
      <Card className="space-y-2">
        <label className="text-sm font-medium" htmlFor="ocr">Extracted text (you can fix mistakes, then re-analyze)</label>
        <textarea id="ocr" className={inputCls} rows={5} value={text} onChange={(e) => setText(e.target.value)} />
        <div className="flex flex-wrap gap-2"><Button variant="ghost" onClick={reanalyze} disabled={busy || !text.trim()}>Re-analyze text</Button>
          <Button variant="ghost" onClick={saveText} disabled={busy || !text.trim()}>Save the full text as a memory</Button></div>
      </Card>
      {items.length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">{aiErr ? "Use the buttons above to add it yourself." : "Nothing in it looks like a task, but you can still keep it: use Add as task or Add as memory above."}</p> :
        items.map((i) => (
          <div key={i.id} className={`space-y-3 rounded-2xl border-2 border-dashed p-4 ${i.kind === "skip" ? "opacity-50" : ""} border-indigo-300 bg-white dark:border-indigo-800 dark:bg-slate-900`}>
            <div className="flex flex-wrap items-center gap-2"><Badge tone="brand">Suggestion · not saved yet</Badge>
              {i.confirm && <Badge tone="amber">Please confirm the date{i.phrase ? ` (document says “${i.phrase}”)` : ""}</Badge>}
              <select aria-label="Save as" className={`${inputCls} ml-auto !w-auto`} value={i.kind} onChange={(e) => upd(i.id, { kind: e.target.value as Item["kind"] })}>
                <option value="task">Save as task</option><option value="memory">Save as memory</option><option value="skip">Don't save</option></select></div>
            <input className={inputCls} aria-label="Title" value={i.title} maxLength={200} onChange={(e) => upd(i.id, { title: e.target.value })} />
            <textarea className={inputCls} aria-label="Details" rows={2} value={i.description} onChange={(e) => upd(i.id, { description: e.target.value })} />
            <div className="grid gap-2 sm:grid-cols-4">
              <input type="date" aria-label="Date" className={`${inputCls} ${i.confirm ? "!border-amber-400" : ""}`} value={i.date} onChange={(e) => upd(i.id, { date: e.target.value, confirm: false })} />
              <input type="time" aria-label="Time" className={inputCls} value={i.time} disabled={!i.date} onChange={(e) => upd(i.id, { time: e.target.value })} />
              {i.kind === "task" && <select aria-label="Priority" className={inputCls} value={i.priority} onChange={(e) => upd(i.id, { priority: e.target.value })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select>}
              <input className={`${inputCls} ${i.kind === "task" ? "" : "sm:col-span-2"}`} placeholder="Tags, comma separated" aria-label="Tags" value={i.tags} onChange={(e) => upd(i.id, { tags: e.target.value })} />
            </div>
          </div>))}
      {items.length > 0 && <div className="flex gap-3"><Button onClick={save} disabled={busy}>{busy ? "Saving…" : "Save selected"}</Button><Button variant="ghost" onClick={() => nav("/")}>Cancel</Button></div>}
    </div>
  );
}
