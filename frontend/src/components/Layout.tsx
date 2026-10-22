import { useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Brain, CalendarDays, History, LayoutDashboard, LogOut, Moon, PlusCircle, Settings, Sparkles, Sun } from "lucide-react";
import { useAuth } from "../auth";
import { useTheme } from "../theme";
import { api } from "../api";
import NotificationBell from "./NotificationBell";
import SearchBox from "./SearchBox";

const nav = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/add", label: "Add", icon: PlusCircle },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/ask", label: "Ask", icon: Sparkles },
  { to: "/history", label: "History", icon: History },
  { to: "/settings", label: "Settings", icon: Settings },
];
const titles: Record<string, string> = { "/": "Dashboard", "/add": "Add Memory / Task", "/calendar": "Calendar", "/ask": "Ask Memnexa", "/upload": "Upload file", "/history": "History", "/settings": "Settings" };

export function ThemeToggle() {
  const { dark, setTheme } = useTheme();
  return <button onClick={() => { const t = dark ? "light" : "dark"; setTheme(t); api.patch("/auth/me", { theme: t }).catch(() => {}); }}
    aria-label={dark ? "Switch to light mode" : "Switch to dark mode"} className="rounded-xl p-2.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
    {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}</button>;
}

export default function Layout() {
  const { user, logout } = useAuth();
  const nav2 = useNavigate();
  const { pathname } = useLocation();
  const [menu, setMenu] = useState(false);
  const link = (isActive: boolean) => `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? "bg-brand-light text-brand dark:bg-indigo-950 dark:text-indigo-300" : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"}`;
  return (
    <div className="min-h-screen md:pl-60">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:flex">
        <div className="mb-6 flex items-center gap-2 px-2 py-1"><span className="rounded-xl bg-brand p-2 text-white"><Brain className="h-5 w-5" /></span><span className="text-lg font-bold">Memnexa</span></div>
        <nav className="space-y-1">{nav.map((n) => <NavLink key={n.to} to={n.to} end={n.to === "/"} className={({ isActive }) => link(isActive)}><n.icon className="h-5 w-5" />{n.label === "Add" ? "Add Memory / Task" : n.label === "Ask" ? "Ask Memnexa" : n.label}</NavLink>)}</nav>
      </aside>
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 md:px-8">
        <div className="flex items-center gap-2 md:hidden"><span className="rounded-lg bg-brand p-1.5 text-white"><Brain className="h-4 w-4" /></span><span className="font-bold">Memnexa</span></div>
        <h1 className="hidden text-lg font-semibold md:block">{titles[pathname] ?? "Memnexa"}</h1>
        <div className="relative flex items-center gap-1">
          <SearchBox />
          <NotificationBell />
          <ThemeToggle />
          <button onClick={() => setMenu((m) => !m)} aria-label="Profile menu" aria-expanded={menu}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-brand text-sm font-semibold text-white">{user?.name.charAt(0).toUpperCase()}</button>
          {menu && <div className="absolute right-0 top-12 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg dark:border-slate-800 dark:bg-slate-900">
            <div className="px-3 py-2"><p className="truncate text-sm font-semibold">{user?.name}</p><p className="truncate text-xs text-slate-500">{user?.email}</p></div>
            <button onClick={() => { setMenu(false); nav2("/settings"); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-800"><Settings className="h-4 w-4" />Settings</button>
            <button onClick={logout} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950"><LogOut className="h-4 w-4" />Sign out</button></div>}
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-4 pb-24 md:p-8 md:pb-8"><h1 className="mb-4 text-xl font-semibold md:hidden">{titles[pathname]}</h1><Outlet /></main>
      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-slate-800 dark:bg-slate-900 md:hidden">
        {nav.map((n) => <NavLink key={n.to} to={n.to} end={n.to === "/"} className={({ isActive }) => `flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${isActive ? "text-brand" : "text-slate-500 dark:text-slate-400"}`}><n.icon className="h-5 w-5" />{n.label}</NavLink>)}
      </nav>
    </div>
  );
}
