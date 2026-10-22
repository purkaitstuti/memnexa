import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { api, fmt, type Notif, type NotifList } from "../api";

export default function NotificationBell() {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<NotifList>({ items: [], unread: 0 });
  const fired = useRef(new Set<number>());

  const load = useCallback(async () => {
    try {
      const d = await api.get<NotifList>("/notifications");
      setData(d);
      const on = localStorage.getItem("browserNotifs") === "1" && typeof Notification !== "undefined" && Notification.permission === "granted";
      const fresh = d.items.filter((n) => !n.delivered && !n.read && !fired.current.has(n.id));
      if (on && fresh.length) {
        fresh.forEach((n) => { fired.current.add(n.id); new Notification("Memnexa", { body: n.message }); });
        api.post("/notifications/delivered", { ids: fresh.map((n) => n.id) }).catch(() => {});
      }
    } catch { /* keep the last list; the next poll retries */ }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 45000);
    const vis = () => { if (!document.hidden) load(); };
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", vis); };
  }, [load]);

  async function openItem(n: Notif) {
    setOpen(false);
    if (!n.read) { api.post(`/notifications/${n.id}/read`).catch(() => {}); setData((d) => ({ items: d.items.map((x) => x.id === n.id ? { ...x, read: true } : x), unread: Math.max(0, d.unread - 1) })); }
    if (n.task_id) nav(`/add?task=${n.task_id}`); else if (n.memory_id) nav(`/add?memory=${n.memory_id}`);
  }
  async function readAll() { await api.post("/notifications/read-all").catch(() => {}); load(); }

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-label={`Notifications, ${data.unread} unread`} aria-expanded={open}
        className="relative rounded-xl p-2.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
        <Bell className="h-5 w-5" />
        {data.unread > 0 && <span className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{data.unread > 9 ? "9+" : data.unread}</span>}
      </button>
      {open && (
        <div className="fixed inset-x-3 top-16 z-50 max-h-[70vh] overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-800 dark:bg-slate-900 md:absolute md:inset-x-auto md:right-0 md:top-12 md:w-80">
          <div className="flex items-center justify-between px-3 py-2"><span className="text-sm font-semibold">Notifications</span>
            {data.unread > 0 && <button onClick={readAll} className="text-xs font-medium text-brand">Mark all read</button>}</div>
          {data.items.length === 0 ? <p className="px-3 py-6 text-center text-sm text-slate-500">No notifications yet. Reminders you set will show up here.</p> :
            data.items.map((n) => (
              <button key={n.id} onClick={() => openItem(n)} className="flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-brand"}`} aria-label={n.read ? "Read" : "Unread"} />
                <span className="min-w-0"><span className={`block break-words text-sm ${n.read ? "text-slate-500" : "font-medium"}`}>{n.message}</span>
                  <span className="text-xs text-slate-400">{fmt(n.scheduled_at)}</span></span></button>))}
        </div>)}
    </div>
  );
}
