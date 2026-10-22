import { useState, type FormEvent } from "react";
import { Download, LogOut, Monitor, Moon, Sun, Trash2 } from "lucide-react";
import { api, type User } from "../api";
import { useAuth } from "../auth";
import { useTheme, type Theme } from "../theme";
import { Button, Card, ErrorBox, Modal, inputCls, useToast } from "../components/ui";

export default function SettingsPage() {
  const { user, setUser, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const toast = useToast();
  const [name, setName] = useState(user?.name ?? "");
  const [busy, setBusy] = useState(false);
  const supported = typeof Notification !== "undefined";
  const [perm, setPerm] = useState(supported ? Notification.permission : "denied");
  const [browserOn, setBrowserOn] = useState(localStorage.getItem("browserNotifs") === "1");
  const [pw, setPw] = useState({ cur: "", next: "", confirm: "" });
  const [delOpen, setDelOpen] = useState(false);
  const [del, setDel] = useState({ text: "", password: "" });
  const [delErr, setDelErr] = useState("");
  const hasPassword = user?.provider === "password";

  async function saveName() {
    setBusy(true);
    try { setUser(await api.patch<User>("/auth/me", { name })); toast("Profile updated"); }
    catch (e) { toast("Your changes couldn't be saved. " + (e as Error).message, "err"); } finally { setBusy(false); }
  }
  async function pick(t: Theme) {
    setTheme(t);
    try { setUser(await api.patch<User>("/auth/me", { theme: t })); } catch { toast("Theme applied here, but couldn't be saved to your account.", "err"); }
  }
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
  async function changePw(e: FormEvent) {
    e.preventDefault();
    if (pw.next.length < 8) return toast("The new password must be at least 8 characters.", "err");
    if (pw.next !== pw.confirm) return toast("The new passwords don't match.", "err");
    setBusy(true);
    try { await api.post("/account/password", { current_password: pw.cur, new_password: pw.next }); toast("Password updated"); setPw({ cur: "", next: "", confirm: "" }); }
    catch (x) { toast((x as Error).message, "err"); } finally { setBusy(false); }
  }
  async function exportData() {
    setBusy(true);
    try {
      const r = await fetch("/api/account/export", { credentials: "include" });
      if (!r.ok) throw new Error("The export failed. Please try again.");
      const url = URL.createObjectURL(await r.blob());
      const a = document.createElement("a"); a.href = url; a.download = "memnexa-export.json"; a.click(); URL.revokeObjectURL(url);
      toast("Your data was exported");
    } catch (e) { toast((e as Error).message, "err"); } finally { setBusy(false); }
  }
  async function deleteAccount() {
    setBusy(true); setDelErr("");
    try { await api.post("/account/delete", { confirm: del.text, password: hasPassword ? del.password : undefined }); setUser(null); }
    catch (e) { setDelErr((e as Error).message); setBusy(false); }
  }
  const opts = [{ t: "light", label: "Light", icon: Sun }, { t: "dark", label: "Dark", icon: Moon }, { t: "system", label: "System", icon: Monitor }] as const;
  const label = "mb-1 block text-sm font-medium";

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card className="space-y-4">
        <h3 className="font-semibold">Profile</h3>
        <label className="block"><span className={label}>Name</span><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} /></label>
        <label className="block"><span className={label}>Email</span><input className={`${inputCls} opacity-70`} value={user?.email} disabled /></label>
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
        <label className="block text-sm"><span className={label}>Default reminder for tasks with a due date</span>
          <select className={inputCls} value={user?.default_reminder_minutes ?? 60} onChange={(e) => saveReminder({ default_reminder_minutes: Number(e.target.value) })}>
            <option value={-1}>No default reminder</option><option value={0}>At the due time</option><option value={10}>10 minutes before</option>
            <option value={30}>30 minutes before</option><option value={60}>1 hour before</option><option value={1440}>1 day before</option></select></label>
        <label className="flex items-center justify-between gap-4 text-sm"><span>Browser notifications <span className="text-slate-500">(permission: {perm})</span></span>
          <input type="checkbox" className="h-5 w-5 accent-indigo-600" checked={browserOn && perm === "granted"} onChange={(e) => toggleBrowser(e.target.checked)} /></label>
        <p className="text-xs text-slate-500 dark:text-slate-400">Reminders always appear in the bell. Browser pop-ups only show while Memnexa is open in a tab; they can't wake a closed browser.</p>
      </Card>
      <Card className="space-y-4">
        <h3 className="font-semibold">Security</h3>
        {hasPassword ? (
          <form onSubmit={changePw} className="space-y-3">
            <input className={inputCls} type="password" placeholder="Current password" aria-label="Current password" autoComplete="current-password" value={pw.cur} onChange={(e) => setPw({ ...pw, cur: e.target.value })} required />
            <input className={inputCls} type="password" placeholder="New password (8+ characters)" aria-label="New password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required />
            <input className={inputCls} type="password" placeholder="Confirm new password" aria-label="Confirm new password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required />
            <Button type="submit" disabled={busy}>Change password</Button>
          </form>
        ) : <p className="text-sm text-slate-500 dark:text-slate-400">You sign in with Google, so there's no Memnexa password to change.</p>}
      </Card>
      <Card className="space-y-4">
        <h3 className="font-semibold">Data and privacy</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">Download everything Memnexa stores about you (profile, tasks, memories, notifications and recent searches) as a JSON file. Your password is never included.</p>
        <Button variant="ghost" onClick={exportData} disabled={busy}><Download className="h-4 w-4" />Export my data</Button>
        <hr className="border-slate-200 dark:border-slate-800" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Deleting your account permanently removes your profile, tasks, memories, notifications and searches. This can't be undone.</p>
        <Button variant="danger" onClick={() => { setDel({ text: "", password: "" }); setDelErr(""); setDelOpen(true); }}><Trash2 className="h-4 w-4" />Delete my account</Button>
      </Card>
      <Card className="space-y-3">
        <h3 className="font-semibold">Account</h3>
        <Button variant="danger" onClick={logout}><LogOut className="h-4 w-4" />Sign out</Button>
      </Card>
      <Modal open={delOpen} onClose={() => !busy && setDelOpen(false)} title="Delete account">
        <div className="space-y-3">
          <h3 className="text-lg font-semibold">Delete your account?</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">All your data will be permanently deleted. Consider exporting it first.</p>
          {delErr && <ErrorBox message={delErr} />}
          <input className={inputCls} placeholder="Type DELETE to confirm" aria-label="Type DELETE to confirm" value={del.text} onChange={(e) => setDel({ ...del, text: e.target.value })} />
          {hasPassword && <input className={inputCls} type="password" placeholder="Your password" aria-label="Your password" autoComplete="current-password" value={del.password} onChange={(e) => setDel({ ...del, password: e.target.value })} />}
          <div className="flex gap-2 pt-1">
            <Button variant="danger" onClick={deleteAccount} disabled={busy || del.text !== "DELETE" || (hasPassword && !del.password)}>{busy ? "Deleting…" : "Delete permanently"}</Button>
            <Button variant="ghost" onClick={() => setDelOpen(false)} disabled={busy}>Cancel</Button></div>
        </div>
      </Modal>
    </div>
  );
}
