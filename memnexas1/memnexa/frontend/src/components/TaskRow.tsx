import { Link } from "react-router-dom";
import { AlertTriangle, Bell, CheckCircle2, Pencil, Trash2 } from "lucide-react";
import { dueLabel, fmt, type Task } from "../api";
import { Badge } from "./ui";

const prio = { low: "neutral", medium: "amber", high: "red" } as const;

export default function TaskRow({ t, onToggle, onDelete }: { t: Task; onToggle: (t: Task) => void; onDelete?: (t: Task) => void }) {
  const done = t.status === "completed";
  return (
    <div className={`flex items-start gap-3 rounded-xl border p-3 ${t.is_overdue ? "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30" : "border-slate-200 dark:border-slate-800"}`}>
      <input type="checkbox" checked={done} onChange={() => onToggle(t)} aria-label={`Mark "${t.title}" ${done ? "pending" : "completed"}`}
        className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-indigo-600" />
      <div className="min-w-0 flex-1">
        <p className={`break-words font-medium ${done ? "text-slate-400 line-through dark:text-slate-500" : ""}`}>{t.title}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
          {t.is_overdue && <Badge tone="red"><AlertTriangle className="h-3 w-3" />Overdue</Badge>}
          {done && <Badge tone="green"><CheckCircle2 className="h-3 w-3" />Completed</Badge>}
          <span className={t.is_overdue ? "font-semibold text-red-700 dark:text-red-300" : "text-slate-500 dark:text-slate-400"}>{dueLabel(t)}</span>
          <Badge tone={prio[t.priority]}>{t.priority}</Badge>
          {t.tags.map((g) => <Badge key={g} tone="brand">#{g}</Badge>)}
          {t.reminder_at && <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400"><Bell className="h-3 w-3" />{fmt(t.reminder_at)}</span>}
        </div>
      </div>
      <div className="flex shrink-0 gap-1">
        <Link to={`/add?task=${t.id}`} aria-label="Edit task" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><Pencil className="h-4 w-4" /></Link>
        {onDelete && <button onClick={() => onDelete(t)} aria-label="Delete task" className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950"><Trash2 className="h-4 w-4" /></button>}
      </div>
    </div>
  );
}
