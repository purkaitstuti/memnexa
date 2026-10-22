import { useState } from "react";
import { LogOut, Monitor, Moon, Sun } from "lucide-react";
import { api, type User } from "../api";
import { useAuth } from "../auth";
import { useTheme, type Theme } from "../theme";
import { Button, Card, inputCls, useToast } from "../components/ui";

export default function SettingsPage() {
  const { user, setUser, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const toast = useToast();
  const [name, setName] = useState(user?.name ?? "");
  const [busy, setBusy] = useState(false);
  const supported = typeof Notification !== "undefined";
  const [perm, setPerm] = useState(supported ? Notification.permission : "denied");
  const [browserOn, setBrowserOn] = useState(localStorage.getItem("browserNotifs") === "1");

  async function saveReminder(patch: Partial<Pick<User, "reminders_enabled" | "default_reminder_minutes">>) {
    try { setUser(await api.patch<User>("/auth/me", patch)); toast("Reminder settings saved"); }
    catch (e) { toast("Your changes couldn't be saved. " + (e as Error).message, "err"); }
  }
  async function toggleBrowser(on: boolean) {
    if (!on) { localStorage.removeItem("browserNotifs"); setBrowserOn(false); return; }
    if (!supported) return toast("This browser doesn't support notifications.", "err");
    const p = await Notification.requestPermission();
    setPerm(p);
    if (p !== "granted") return toast("Notifications are blocked. Allow them in your browser's site settings.", "err");
    localStorage.setItem("browserNotifs", "1"); setBrowserOn(true); toast("Browser notifications enabled");
  }

  async function saveName() {
    setBusy(true);
    try { setUser(await api.patch<User>("/auth/me", { name })); toast("Profile updated"); }
    catch (e) { toast("Your changes couldn't be saved. " + (e as Error).message, "err"); } finally { setBusy(false); }
  }
  async function pick(t: Theme) {
    setTheme(t);
    try { setUser(await api.patch<User>("/auth/me", { theme: t })); } catch { toast("Theme applied here, but couldn't be saved to your account.", "err"); }
  }
  const opts = [{ t: "light", label: "Light", icon: Sun }, { t: "dark", label: "Dark", icon: Moon }, { t: "system", label: "System", icon: Monitor }] as const;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card className="space-y-4">
        <h3 className="font-semibold">Profile</h3>
        <label className="block"><span className="mb-1 block text-sm font-medium">Name</span><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></label>
        <label className="block"><span className="mb-1 block text-sm font-medium">Email</span><input className={`${inputCls} opacity-70`} value={user?.email} disabled /></label>
        <p className="text-sm text-slate-500">Sign-in method: {user?.provider === "google" ? "Google" : "Email & password"}</p>
        <Button onClick={saveName} disabled={busy || !name.trim() || name === user?.name}>Save profile</Button>
      </Card>
      <Card className="space-y-4">
        <h3 className="font-semibold">Appearance</h3>
        <div className="grid grid-cols-3 gap-2">
          {opts.map((o) => <button key={o.t} onClick={() => pick(o.t)} aria-pressed={theme === o.t}
            className={`flex min-h-[64px] flex-col items-center justify-center gap-1 rounded-xl border text-sm font-medium ${theme === o.t ? "border-brand bg-brand-light text-brand dark:bg-indigo-950" : "border-slate-200 dark:border-slate-700"}`}><o.icon className="h-5 w-5" />{o.label}</button>)}
        </div>
      </Card>
      <Card className="space-y-4">
        <h3 className="font-semibold">Notifications</h3>
        <label className="flex items-center justify-between gap-4 text-sm"><span>Enable reminders</span>
          <input type="checkbox" className="h-5 w-5 accent-indigo-600" checked={!!user?.reminders_enabled} onChange={(e) => saveReminder({ reminders_enabled: e.target.checked })} /></label>
        <label className="block text-sm"><span className="mb-1 block font-medium">Default reminder for tasks with a due date</span>
          <select className={inputCls} value={user?.default_reminder_minutes ?? 60} onChange={(e) => saveReminder({ default_reminder_minutes: Number(e.target.value) })}>
            <option value={-1}>No default reminder</option><option value={0}>At the due time</option><option value={10}>10 minutes before</option>
            <option value={30}>30 minutes before</option><option value={60}>1 hour before</option><option value={1440}>1 day before</option></select></label>
        <label className="flex items-center justify-between gap-4 text-sm"><span>Browser notifications <span className="text-slate-500">(permission: {perm})</span></span>
          <input type="checkbox" className="h-5 w-5 accent-indigo-600" checked={browserOn && perm === "granted"} onChange={(e) => toggleBrowser(e.target.checked)} /></label>
        <p className="text-xs text-slate-500 dark:text-slate-400">Reminders always appear in the bell. Browser pop-ups only show while Memnexa is open in a tab; they can't wake a closed browser.</p>
      </Card>
      <Card className="space-y-3">
        <h3 className="font-semibold">Account</h3>
        <Button variant="danger" onClick={logout}><LogOut className="h-4 w-4" />Sign out</Button>
      </Card>
    </div>
  );
}
