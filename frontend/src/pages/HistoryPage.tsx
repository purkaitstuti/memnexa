import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, type Page, type Task } from "../api";
import { Button, Card, Empty, ErrorBox, inputCls, Spinner, useToast } from "../components/ui";
import TaskRow from "../components/TaskRow";

const tabs = ["all", "pending", "completed", "overdue"] as const;

export default function HistoryPage() {
  const toast = useToast();
  const [sp] = useSearchParams();
  const [f, setF] = useState({ status: "all", q: "", priority: "", tag: "", from: "", to: "", sort: "due_asc", page: 1 });
  const [debQ, setDebQ] = useState("");
  const [data, setData] = useState<Page<Task> | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => { const t = sp.get("tag"); if (t !== null) setF((s) => ({ ...s, tag: t, page: 1 })); }, [sp]);
  useEffect(() => { const id = setTimeout(() => setDebQ(f.q), 300); return () => clearTimeout(id); }, [f.q]);

  const load = useCallback(async () => {
    setLoading(true); setErr("");
    const q = new URLSearchParams({ status: f.status, sort: f.sort, page: String(f.page), size: "15" });
    if (debQ) q.set("q", debQ);
    if (f.priority) q.set("priority", f.priority);
    if (f.tag.trim()) q.set("tag", f.tag.trim().replace(/^#/, ""));
    if (f.from) q.set("date_from", new Date(f.from + "T00:00").toISOString());
    if (f.to) q.set("date_to", new Date(new Date(f.to + "T00:00").getTime() + 86400000).toISOString());
    try { setData(await api.get<Page<Task>>(`/tasks?${q}`)); } catch (e) { setErr((e as Error).message); } finally { setLoading(false); }
  }, [f.status, f.sort, f.page, f.priority, f.tag, f.from, f.to, debQ]);
  useEffect(() => { load(); }, [load]);

  const upd = (p: Partial<typeof f>) => setF((s) => ({ ...s, page: 1, ...p }));
  async function toggle(t: Task) {
    try { await api.post(`/tasks/${t.id}/complete?done=${t.status !== "completed"}`); toast(t.status === "completed" ? "Task reopened" : "Task completed ✓"); load(); }
    catch (e) { toast((e as Error).message, "err"); }
  }
  async function del(t: Task) {
    if (!confirm(`Delete "${t.title}"?`)) return;
    try { await api.del(`/tasks/${t.id}`); toast("Task deleted"); load(); } catch (e) { toast((e as Error).message, "err"); }
  }
  const pages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-slate-800" role="tablist">
        {tabs.map((s) => <button key={s} role="tab" aria-selected={f.status === s} onClick={() => upd({ status: s })}
          className={`min-h-[44px] flex-1 rounded-lg px-3 text-sm font-medium capitalize ${f.status === s ? "bg-white shadow-sm dark:bg-slate-900" : "text-slate-500"}`}>{s === "all" ? "All tasks" : s}</button>)}
      </div>
      <Card className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <input className={`${inputCls} lg:col-span-2`} placeholder="Search tasks…" aria-label="Search tasks" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value, page: 1 })} />
        <select className={inputCls} aria-label="Priority" value={f.priority} onChange={(e) => upd({ priority: e.target.value })}><option value="">Any priority</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select>
        <input className={inputCls} placeholder="Tag" aria-label="Tag" value={f.tag} onChange={(e) => upd({ tag: e.target.value })} />
        <input type="date" className={inputCls} aria-label="Due from" value={f.from} onChange={(e) => upd({ from: e.target.value })} />
        <input type="date" className={inputCls} aria-label="Due to" value={f.to} onChange={(e) => upd({ to: e.target.value })} />
        <select className={inputCls} aria-label="Sort" value={f.sort} onChange={(e) => upd({ sort: e.target.value })}>
          <option value="due_asc">Due: soonest</option><option value="due_desc">Due: latest</option><option value="created_desc">Recently added</option><option value="priority">Priority</option></select>
      </Card>
      {err && <ErrorBox message={err} retry={load} />}
      {loading && !data ? <Spinner /> : data && data.items.length === 0 ? (
        <Card><Empty title="You have no tasks matching these filters." action={<Link to="/add?mode=task"><Button>Add Task</Button></Link>} /></Card>
      ) : (
        <div className="space-y-2">{data?.items.map((t) => <TaskRow key={t.id} t={t} onToggle={toggle} onDelete={del} />)}</div>
      )}
      {data && data.total > data.size && <div className="flex items-center justify-center gap-3">
        <Button variant="ghost" disabled={f.page <= 1} onClick={() => setF({ ...f, page: f.page - 1 })}>Previous</Button>
        <span className="text-sm text-slate-500">Page {f.page} of {pages}</span>
        <Button variant="ghost" disabled={f.page >= pages} onClick={() => setF({ ...f, page: f.page + 1 })}>Next</Button></div>}
    </div>
  );
}
