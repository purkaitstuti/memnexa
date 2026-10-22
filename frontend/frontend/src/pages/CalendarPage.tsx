import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { api, dayKey, dueLabel, utc, type Task } from "../api";
import { Badge, Button, Card, ErrorBox, Modal, useToast } from "../components/ui";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarPage() {
  const toast = useToast();
  const [cur, setCur] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [tasks, setTasks] = useState<Task[]>([]);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<Task | null>(null);

  const cells = useMemo(() => {
    const start = new Date(cur.getFullYear(), cur.getMonth(), 1 - cur.getDay());
    return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, [cur]);

  const load = useCallback(async () => {
    setErr("");
    try {
      const end = new Date(cells[41].getFullYear(), cells[41].getMonth(), cells[41].getDate() + 1);
      const q = new URLSearchParams({ start: cells[0].toISOString(), end: end.toISOString() });
      setTasks(await api.get<Task[]>(`/tasks/calendar?${q}`));
    } catch (e) { setErr((e as Error).message); }
  }, [cells]);
  useEffect(() => { load(); }, [load]);

  const byDay = useMemo(() => {
    const m = new Map<string, Task[]>();
    tasks.forEach((t) => { if (t.due_at) { const k = dayKey(utc(t.due_at)); m.set(k, [...(m.get(k) ?? []), t]); } });
    return m;
  }, [tasks]);

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
        <h2 className="text-xl font-semibold">{cur.toLocaleString([], { month: "long", year: "numeric" })}</h2>
        <div className="flex gap-2">
          <Button variant="ghost" aria-label="Previous month" onClick={() => setCur(new Date(cur.getFullYear(), cur.getMonth() - 1, 1))}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="ghost" onClick={() => { const d = new Date(); setCur(new Date(d.getFullYear(), d.getMonth(), 1)); }}>Today</Button>
          <Button variant="ghost" aria-label="Next month" onClick={() => setCur(new Date(cur.getFullYear(), cur.getMonth() + 1, 1))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
      </div>
      {err && <ErrorBox message={err} retry={load} />}
      <Card className="!p-2 sm:!p-3">
        <div className="grid grid-cols-7 text-center text-xs font-medium text-slate-500">{DOW.map((d) => <div key={d} className="py-2">{d}</div>)}</div>
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl bg-slate-200 dark:bg-slate-800">
          {cells.map((d) => {
            const k = dayKey(d), list = byDay.get(k) ?? [], inMonth = d.getMonth() === cur.getMonth();
            return (
              <div key={k} className={`min-h-[64px] bg-white p-1 dark:bg-slate-900 sm:min-h-[96px] ${inMonth ? "" : "opacity-40"}`}>
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs ${k === today ? "bg-brand font-bold text-white" : ""}`}>{d.getDate()}</span>
                <div className="mt-0.5 space-y-0.5">
                  {list.slice(0, 2).map((t) => <button key={t.id} onClick={() => setOpen(t)} title={t.title} className={`block w-full truncate rounded px-1 py-0.5 text-left text-[10px] sm:text-xs ${pill(t)}`}>{t.title}</button>)}
                  {list.length > 2 && <button onClick={() => setOpen(list[2])} className="px-1 text-[10px] text-slate-500">+{list.length - 2} more</button>}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex flex-wrap gap-3 p-2 text-xs text-slate-500"><span>⬜ Upcoming</span><span>🟥 Overdue</span><span>🟩 Completed</span></div>
      </Card>
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
