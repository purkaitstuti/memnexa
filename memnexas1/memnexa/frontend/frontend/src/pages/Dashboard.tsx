import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, Clock, ListTodo, AlertTriangle, Pencil, Plus, Sparkles, Trash2, Upload } from "lucide-react";
import { api, fmt, type Memory, type Page, type Stats, type Task } from "../api";
import { useAuth } from "../auth";
import { Badge, Button, Card, Empty, ErrorBox, Spinner, useToast } from "../components/ui";
import TaskRow from "../components/TaskRow";

export default function Dashboard() {
  const { user } = useAuth();
  const toast = useToast();
  const go = useNavigate();
  const [ask, setAsk] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [mems, setMems] = useState<Memory[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setErr(""); setLoading(true);
    try {
      const [s, t, m] = await Promise.all([
        api.get<Stats>("/tasks/stats"),
        api.get<Page<Task>>("/tasks?status=pending&sort=due_asc&size=8"),
        api.get<Memory[]>("/memories?limit=4"),
      ]);
      setStats(s); setTasks(t.items); setMems(m);
    } catch (e) { setErr((e as Error).message); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function toggle(t: Task) {
    try { await api.post(`/tasks/${t.id}/complete?done=${t.status !== "completed"}`); toast(t.status === "completed" ? "Task reopened" : "Task completed ✓"); load(); }
    catch (e) { toast((e as Error).message, "err"); }
  }
  async function delMem(m: Memory) {
    if (!confirm(`Delete memory "${m.title}"?`)) return;
    try { await api.del(`/memories/${m.id}`); toast("Memory deleted"); load(); } catch (e) { toast((e as Error).message, "err"); }
  }

  const h = new Date().getHours();
  const greet = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  const cards = [
    { label: "Total tasks", v: stats?.total, icon: ListTodo, cls: "text-brand" },
    { label: "Completed", v: stats?.completed, icon: CheckCircle2, cls: "text-green-600" },
    { label: "Pending", v: stats?.pending, icon: Clock, cls: "text-amber-500" },
    { label: "Overdue", v: stats?.overdue, icon: AlertTriangle, cls: "text-red-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">{greet}, {user?.name.split(" ")[0]}</h2>
        <p className="text-slate-500 dark:text-slate-400">Your thoughts, tasks, and memories — all in one place.</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Link to="/add?mode=memory"><Button><Plus className="h-4 w-4" />Add Memory</Button></Link>
        <Link to="/add?mode=task"><Button variant="ghost"><Plus className="h-4 w-4" />Add Task</Button></Link>
        <Link to="/ask"><Button variant="ghost"><Sparkles className="h-4 w-4" />Ask Memnexa</Button></Link>
        <Link to="/add?mode=upload"><Button variant="ghost"><Upload className="h-4 w-4" />Upload File</Button></Link>
      </div>
      {err && <ErrorBox message={err} retry={load} />}
      {loading && !stats ? <Spinner /> : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {cards.map((c) => (
              <Card key={c.label} className={c.label === "Overdue" && (c.v ?? 0) > 0 ? "!border-red-300 !bg-red-50 dark:!border-red-900 dark:!bg-red-950/30" : ""}>
                <c.icon className={`h-5 w-5 ${c.cls}`} /><p className="mt-2 text-3xl font-bold">{c.v ?? 0}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">{c.label}</p>
              </Card>
            ))}
          </div>
          <Card className="!border-brand/30 bg-gradient-to-r from-brand-light to-white dark:from-indigo-950/40 dark:to-slate-900">
            <div className="flex items-center gap-2 font-semibold"><Sparkles className="h-5 w-5 text-brand" />Ask Memnexa</div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Ask about your tasks and memories, e.g. “What do I need to do this weekend?”</p>
            <form className="mt-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (ask.trim()) go(`/ask?q=${encodeURIComponent(ask.trim())}`); }}>
              <input className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30 dark:border-slate-700 dark:bg-slate-900" placeholder="Ask a question…" aria-label="Ask Memnexa" value={ask} onChange={(e) => setAsk(e.target.value)} />
              <Button type="submit">Ask</Button></form>
          </Card>
          <div className="grid gap-6 lg:grid-cols-5">
            <Card className="lg:col-span-3">
              <div className="mb-3 flex items-center justify-between"><h3 className="font-semibold">Upcoming tasks</h3><Link to="/history" className="text-sm font-medium text-brand">View all</Link></div>
              {tasks.length === 0 ? <Empty title="No pending tasks" hint="Add a task to see its deadline here." action={<Link to="/add?mode=task"><Button>Add Task</Button></Link>} />
                : <div className="space-y-2">{tasks.map((t) => <TaskRow key={t.id} t={t} onToggle={toggle} />)}</div>}
            </Card>
            <Card className="lg:col-span-2">
              <h3 className="mb-3 font-semibold">Recent memories</h3>
              {mems.length === 0 ? <Empty title="No memories yet" hint="Save your first memory so you can recall it later." action={<Link to="/add?mode=memory"><Button>Add Memory</Button></Link>} />
                : <div className="space-y-3">{mems.map((m) => (
                  <div key={m.id} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                    <div className="flex items-start justify-between gap-2"><p className="break-words font-medium">{m.title}</p>
                      <div className="flex shrink-0"><Link to={`/add?memory=${m.id}`} aria-label="Edit memory" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><Pencil className="h-4 w-4" /></Link>
                        <button onClick={() => delMem(m)} aria-label="Delete memory" className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"><Trash2 className="h-4 w-4" /></button></div></div>
                    {m.content && <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{m.content}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs"><Badge>{m.category}</Badge>{m.tags.map((g) => <Badge key={g} tone="brand">#{g}</Badge>)}<span className="text-slate-400">{fmt(m.created_at)}</span></div>
                  </div>))}</div>}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
