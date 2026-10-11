import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, fromInput, toInput, type Memory, type Task } from "../api";
import { Button, Card, ErrorBox, inputCls, Spinner, useToast } from "../components/ui";
import UploadPanel from "../components/UploadPanel";

const cats = ["Personal", "Academic", "Ideas", "Important Information", "Events", "Other"];
const parseTags = (s: string) => s.split(",").map((t) => t.trim().replace(/^#/, "")).filter(Boolean);
const Field = ({ label, children }: { label: string; children: React.ReactNode }) =>
  <label className="block"><span className="mb-1 block text-sm font-medium">{label}</span>{children}</label>;

function DateTime({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [d, t] = value ? value.split("T") : ["", ""];
  const upd = (nd: string, nt: string) => onChange(nd ? `${nd}T${nt || "23:59"}` : "");
  return (
    <Field label={label}>
      <div className="flex gap-2">
        <input type="date" className={inputCls} value={d} onChange={(e) => upd(e.target.value, t)} />
        <input type="time" className={inputCls} value={t} disabled={!d} onChange={(e) => upd(d, e.target.value)} />
      </div>
    </Field>
  );
}

export default function Add() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const toast = useToast();
  const taskId = sp.get("task"), memId = sp.get("memory");
  const [mode, setMode] = useState<"memory" | "task" | "upload">(taskId ? "task" : memId ? "memory" : sp.get("mode") === "task" ? "task" : sp.get("mode") === "upload" ? "upload" : "memory");
  const [loading, setLoading] = useState(!!(taskId || memId));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [m, setM] = useState({ title: "", content: "", category: "Personal", tags: "", date: "", reminder: "" });
  const [t, setT] = useState({ title: "", description: "", due: "", priority: "medium", tags: "", reminder: "", done: false });

  useEffect(() => {
    if (taskId) api.get<Task>(`/tasks/${taskId}`).then((x) => setT({ title: x.title, description: x.description, due: toInput(x.due_at), priority: x.priority,
      tags: x.tags.join(", "), reminder: toInput(x.reminder_at), done: x.status === "completed" })).catch((e) => setErr(e.message)).finally(() => setLoading(false));
    else if (memId) api.get<Memory>(`/memories/${memId}`).then((x) => setM({ title: x.title, content: x.content, category: x.category, tags: x.tags.join(", "),
      date: toInput(x.memory_date), reminder: toInput(x.reminder_at) })).catch((e) => setErr(e.message)).finally(() => setLoading(false));
  }, [taskId, memId]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setErr("");
    try {
      if (mode === "task") {
        const body = { title: t.title, description: t.description, due_at: fromInput(t.due), priority: t.priority, tags: parseTags(t.tags), reminder_at: fromInput(t.reminder) };
        const saved = taskId ? await api.patch<Task>(`/tasks/${taskId}`, body) : await api.post<Task>("/tasks", body);
        if (!!taskId && (saved.status === "completed") !== t.done) await api.post(`/tasks/${saved.id}/complete?done=${t.done}`);
        toast(taskId ? "Task updated" : "Task saved");
      } else {
        const body = { title: m.title, content: m.content, category: m.category, tags: parseTags(m.tags), memory_date: fromInput(m.date), reminder_at: fromInput(m.reminder) };
        memId ? await api.patch(`/memories/${memId}`, body) : await api.post("/memories", body);
        toast(memId ? "Memory updated" : "Memory saved");
      }
      nav("/");
    } catch (x) { setErr("Your changes couldn't be saved. " + (x as Error).message); } finally { setBusy(false); }
  }

  if (loading) return <Spinner />;
  const editing = !!(taskId || memId);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {!editing && <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800" role="tablist">
        {(["memory", "task", "upload"] as const).map((k) => <button key={k} role="tab" aria-selected={mode === k} onClick={() => setMode(k)}
          className={`min-h-[44px] rounded-lg text-sm font-medium ${mode === k ? "bg-white shadow-sm dark:bg-slate-900" : "text-slate-500"}`}>{k === "memory" ? "Add Memory" : k === "task" ? "Add Task" : "From file"}</button>)}
      </div>}
      {mode === "upload" ? <UploadPanel /> : <Card>
        <form onSubmit={submit} className="space-y-4">
          {err && <ErrorBox message={err} />}
          {mode === "memory" ? (<>
            <Field label="Title"><input className={inputCls} required maxLength={200} value={m.title} onChange={(e) => setM({ ...m, title: e.target.value })} /></Field>
            <Field label="Content"><textarea className={inputCls} rows={5} value={m.content} onChange={(e) => setM({ ...m, content: e.target.value })} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Category"><select className={inputCls} value={m.category} onChange={(e) => setM({ ...m, category: e.target.value })}>{cats.map((c) => <option key={c}>{c}</option>)}</select></Field>
              <Field label="Tags (comma separated)"><input className={inputCls} value={m.tags} onChange={(e) => setM({ ...m, tags: e.target.value })} /></Field>
              <DateTime label="Date (optional)" value={m.date} onChange={(v) => setM({ ...m, date: v })} />
              <DateTime label="Reminder (optional)" value={m.reminder} onChange={(v) => setM({ ...m, reminder: v })} />
            </div></>) : (<>
            <Field label="Task title"><input className={inputCls} required maxLength={200} value={t.title} onChange={(e) => setT({ ...t, title: e.target.value })} /></Field>
            <Field label="Description / notes"><textarea className={inputCls} rows={4} value={t.description} onChange={(e) => setT({ ...t, description: e.target.value })} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <DateTime label="Due date & time" value={t.due} onChange={(v) => setT({ ...t, due: v })} />
              <Field label="Priority"><select className={inputCls} value={t.priority} onChange={(e) => setT({ ...t, priority: e.target.value })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></Field>
              <Field label="Tags (comma separated)"><input className={inputCls} value={t.tags} onChange={(e) => setT({ ...t, tags: e.target.value })} /></Field>
              <DateTime label="Reminder date & time" value={t.reminder} onChange={(v) => setT({ ...t, reminder: v })} />
            </div>
            {taskId && <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5 accent-indigo-600" checked={t.done} onChange={(e) => setT({ ...t, done: e.target.checked })} />Completed</label>}</>)}
          <div className="flex gap-3"><Button type="submit" disabled={busy}>{busy ? "Saving…" : mode === "task" ? "Save Task" : "Save Memory"}</Button>
            <Button type="button" variant="ghost" onClick={() => nav(-1)}>Cancel</Button></div>
        </form>
      </Card>}
    </div>
  );
}
