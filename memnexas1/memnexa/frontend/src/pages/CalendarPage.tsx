import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { api, dayKey, dueLabel, utc, type Task } from "../api";
import { Badge, Button, Card, ErrorBox, Modal, useToast } from "../components/ui";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export default function CalendarPage() {
  const toast = useToast();
  const [view, setView] = useState<"month" | "week">("month");
  const [anchor, setAnchor] = useState(() => new Date());
  const [tasks, setTasks] = useState<Task[]>([]);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<Task | null>(null);

  const cells = useMemo(() => {
    if (view === "week") { const s = addDays(anchor, -anchor.getDay()); return Array.from({ length: 7 }, (_, i) => addDays(s, i)); }
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const s = addDays(first, -first.getDay());
    return Array.from({ length: 42 }, (_, i) => addDays(s, i));
  }, [anchor, view]);

  const load = useCallback(async () => {
    setErr("");
    try {
      const q = new URLSearchParams({ start: cells[0].toISOString(), end: addDays(cells[cells.length - 1], 1).toISOString() });
      setTasks(await api.get<Task[]>(`/tasks/calendar?${q}`));
    } catch (e) { setErr((e as Error).message); }
  }, [cells]);
  useEffect(() => { load(); }, [load]);

  const byDay = useMemo(() => {
    const m = new Map<string, Task[]>();
    tasks.forEach((t) => { if (t.due_at) { const k = dayKey(utc(t.due_at)); m.set(k, [...(m.get(k) ?? []), t]); } });
    return m;
  }, [tasks]);

  const step = (n: number) => setAnchor(view === "week" ? addDays(anchor, 7 * n) : new Date(anchor.getFullYear(), anchor.getMonth() + n, 1));
  const heading = view === "month" ? anchor.toLocaleString([], { month: "long", year: "numeric" })
    : `${cells[0].toLocaleDateString([], { day: "numeric", month: "short" })} – ${cells[6].toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}`;

  async function toggle(t: Task) {
    try { const u = await api.post<Task>(`/tasks/${t.id}/complete?done=${t.status !== "completed"}`); setOpen(u); toast(u.status === "completed" ? "Task completed ✓" : "Task reopened"); load(); }
    catch (e) { toast((e as Error).message, "err"); }
  }
  async function del(t: Task) {
    if (!confirm(`Delete "${t.title}"?`)) return;
    try { await api.del(`/tasks/${t.id}`); setOpen(null); toast("Task deleted"); load(); } catch (e) { toast((e as Error).message, "err"); }
  }
  const pill = (t: Task) => t.status === "completed" ? "bg-green-100 text-green-800 line-through dark:bg-green-950 dark:text-green-300"
    : t.is_overdue ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200";
  const today = dayKey(new Date());

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{heading}</h2>
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800" role="tablist" aria-label="Calendar view">
            {(["month", "week"] as const).map((v) => <button key={v} role="tab" aria-selected={view === v} onClick={() => setView(v)}
              className={`min-h-[36px] rounded-lg px-3 text-sm font-medium capitalize ${view === v ? "bg-white shadow-sm dark:bg-slate-900" : "text-slate-500"}`}>{v}</button>)}
          </div>
          <Button variant="ghost" aria-label={`Previous ${view}`} onClick={() => step(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="ghost" onClick={() => setAnchor(new Date())}>Today</Button>
          <Button variant="ghost" aria-label={`Next ${view}`} onClick={() => step(1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
      {err && <ErrorBox message={err} retry={load} />}
      {view === "month" ? (
        <Card className="!p-2 sm:!p-3">
          <div className="grid grid-cols-7 text-center text-xs font-medium text-slate-500">{DOW.map((d) => <div key={d} className="py-2">{d}</div>)}</div>
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl bg-slate-200 dark:bg-slate-800">
            {cells.map((d) => {
              const k = dayKey(d), list = byDay.get(k) ?? [], inMonth = d.getMonth() === anchor.getMonth();
              return (
                <div key={k} className={`min-h-[64px] min-w-0 bg-white p-1 dark:bg-slate-900 sm:min-h-[96px] ${inMonth ? "" : "opacity-40"}`}>
                  <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${k === today ? "bg-brand font-bold text-white" : ""}`}>{d.getDate()}</span>
                  <div className="mt-0.5 space-y-0.5">
                    {list.slice(0, 2).map((t) => <button key={t.id} onClick={() => setOpen(t)} title={t.title} className={`block w-full truncate rounded px-1 py-0.5 text-left text-[10px] sm:text-xs ${pill(t)}`}>{t.title}</button>)}
                    {list.length > 2 && <button onClick={() => { setAnchor(d); setView("week"); }} className="px-1 text-[10px] text-slate-500">+{list.length - 2} more</button>}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-3 p-2 text-xs text-slate-500"><span>⬜ Upcoming</span><span>🟥 Overdue</span><span>🟩 Completed</span></div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
          {cells.map((d) => {
            const k = dayKey(d), list = byDay.get(k) ?? [];
            return (
              <Card key={k} className={`min-w-0 !p-3 ${k === today ? "!border-brand" : ""}`}>
                <p className={`mb-2 text-sm font-semibold ${k === today ? "text-brand" : ""}`}>{DOW[d.getDay()]} {d.getDate()}{k === today && <span className="ml-1 text-xs font-normal">· today</span>}</p>
                {list.length === 0 ? <p className="text-xs text-slate-400">No tasks</p> : (
                  <div className="space-y-1.5">{list.map((t) => (
                    <button key={t.id} onClick={() => setOpen(t)} className={`block w-full rounded-lg px-2 py-1.5 text-left text-xs ${pill(t)}`}>
                      <span className="block break-words font-medium">{t.title}</span>
                      <span className="opacity-80">{utc(t.due_at!).toLocaleTimeString([], { timeStyle: "short" })}{t.is_overdue ? " · Overdue" : ""}{t.status === "completed" ? " · Done" : ""}</span></button>))}</div>)}
              </Card>
            );
          })}
        </div>
      )}
      <Modal open={!!open} onClose={() => setOpen(null)} title="Task details">
        {open && <div className="space-y-3">
          <h3 className="break-words text-lg font-semibold">{open.title}</h3>
          <div className="flex flex-wrap gap-1.5">
            {open.is_overdue && <Badge tone="red">Overdue</Badge>}{open.status === "completed" && <Badge tone="green">Completed</Badge>}
            <Badge tone="amber">{open.priority}</Badge>{open.tags.map((g) => <Badge key={g} tone="brand">#{g}</Badge>)}</div>
          <p className="text-sm text-slate-500">Due: {dueLabel(open)}</p>
          {open.reminder_at && <p className="text-sm text-slate-500">Reminder: {utc(open.reminder_at).toLocaleString()}</p>}
          {open.description && <p className="whitespace-pre-wrap text-sm">{open.description}</p>}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-5 w-5 accent-indigo-600" checked={open.status === "completed"} onChange={() => toggle(open)} />Completed</label>
          <div className="flex flex-wrap gap-2 pt-2">
            <Link to={`/add?task=${open.id}`}><Button variant="ghost"><Pencil className="h-4 w-4" />Edit</Button></Link>
            <Link to="/history"><Button variant="ghost">History</Button></Link>
            <Button variant="danger" onClick={() => del(open)}><Trash2 className="h-4 w-4" />Delete</Button>
            <Button variant="ghost" onClick={() => setOpen(null)}>Close</Button></div></div>}
      </Modal>
    </div>
  );
}
