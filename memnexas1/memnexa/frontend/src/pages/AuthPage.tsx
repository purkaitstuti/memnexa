import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Bell, Brain, CalendarCheck, Check, Eye, EyeOff, FileUp, Sparkles } from "lucide-react";
import { useAuth } from "../auth";
import { api, ApiError } from "../api";
import { Button, ErrorBox, inputCls } from "../components/ui";
import { ThemeToggle } from "../components/Layout";

const features = [
  { icon: FileUp, text: "Capture notes, screenshots and PDFs" },
  { icon: CalendarCheck, text: "See what's due, and what's overdue" },
  { icon: Sparkles, text: "Ask anything you've saved" },
];

export default function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const { login, signup } = useAuth();
  const [f, setF] = useState({ name: "", email: "", password: "", confirm: "" });
  const [show, setShow] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleOk, setGoogleOk] = useState<boolean | null>(null);
  const isSignup = mode === "signup";
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    api.get<{ configured: boolean }>("/auth/google/status").then((r) => setGoogleOk(r.configured)).catch(() => setGoogleOk(null));
    if (new URLSearchParams(location.search).get("error")) setErr("Google sign-in didn't complete. Please try again.");
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr("");
    if (isSignup) {
      if (f.password.length < 8) return setErr("Password must be at least 8 characters.");
      if (f.password !== f.confirm) return setErr("Passwords don't match.");
    }
    setBusy(true);
    try { isSignup ? await signup(f.name, f.email, f.password) : await login(f.email, f.password); }
    catch (x) { setErr(x instanceof ApiError ? x.message : "Something went wrong."); }
    finally { setBusy(false); }
  }
  function google() {
    if (googleOk) location.href = "/api/auth/google/login";
    else setErr("Google sign-in isn't configured yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env, restart the backend, and see the README's Google OAuth section.");
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      {/* Brand panel (desktop) */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="absolute -left-20 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl animate-blob motion-reduce:animate-none" />
        <div aria-hidden className="absolute -bottom-32 -right-24 h-[28rem] w-[28rem] rounded-full bg-violet-400/30 blur-3xl animate-blob motion-reduce:animate-none [animation-delay:-7s]" />
        <div className="relative flex items-center gap-3">
          <span className="rounded-2xl bg-white/15 p-2.5 backdrop-blur"><Brain className="h-7 w-7" /></span>
          <span className="text-2xl font-bold tracking-tight">Memnexa</span>
        </div>
        <div className="relative max-w-md animate-fadeup">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-200">Memory + Next</p>
          <h2 className="mt-3 text-4xl font-bold leading-tight">Your memory, and what to do next.</h2>
          <p className="mt-4 text-indigo-100">Memnexa keeps everything you need to remember in one place, then shows you what comes next.</p>
          <ul className="mt-8 space-y-3">
            {features.map((x) => <li key={x.text} className="flex items-center gap-3 text-indigo-50"><span className="rounded-lg bg-white/15 p-2"><x.icon className="h-4 w-4" /></span>{x.text}</li>)}
          </ul>
        </div>
        <div aria-hidden className="relative flex flex-wrap gap-4">
          <div className="animate-float rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur motion-reduce:animate-none">
            <div className="flex items-center gap-3"><span className="flex h-5 w-5 items-center justify-center rounded-md bg-white text-indigo-700"><Check className="h-3.5 w-3.5" /></span>
              <div><p className="text-sm font-medium">Submit assignment</p><p className="text-xs text-indigo-200">Due Friday · High</p></div></div>
          </div>
          <div className="animate-float rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur [animation-delay:-3s] motion-reduce:animate-none">
            <div className="flex items-center gap-3"><Bell className="h-5 w-5 text-indigo-100" />
              <div><p className="text-sm font-medium">Library closes at 6 pm</p><p className="text-xs text-indigo-200">Memory · #campus</p></div></div>
          </div>
        </div>
      </div>

      {/* Form side */}
      <div className="relative flex min-h-screen items-center justify-center bg-gradient-to-b from-indigo-50 to-slate-50 p-4 dark:from-slate-900 dark:to-slate-950 lg:min-h-0 lg:bg-none lg:bg-slate-50 lg:dark:bg-slate-950">
        <div className="absolute right-4 top-4"><ThemeToggle /></div>
        <div className="w-full max-w-sm animate-fadeup py-10">
          <div className="mb-8 flex flex-col items-center gap-2 text-center lg:hidden">
            <span className="rounded-2xl bg-brand p-3 text-white shadow-lg shadow-indigo-500/30"><Brain className="h-7 w-7" /></span>
            <span className="text-xl font-bold">Memnexa</span>
            <span className="text-sm text-slate-500 dark:text-slate-400">Your memory, and what to do next.</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">{isSignup ? "Create your account" : "Welcome"}</h1>
          <p className="mb-6 mt-1 text-sm text-slate-500 dark:text-slate-400">{isSignup ? "Start keeping your memories and tasks in one place." : "Log in to see what's next."}</p>
          <form onSubmit={submit} className="space-y-4">
            {err && <ErrorBox message={err} />}
            {isSignup && <input className={inputCls} placeholder="Full name" aria-label="Full name" value={f.name} onChange={set("name")} required autoComplete="name" />}
            <input className={inputCls} type="email" placeholder="Email" aria-label="Email" value={f.email} onChange={set("email")} required autoComplete="email" />
            <div className="relative">
              <input className={inputCls} type={show ? "text" : "password"} placeholder="Password" aria-label="Password" value={f.password} onChange={set("password")} required autoComplete={isSignup ? "new-password" : "current-password"} />
              <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-3 top-2.5 text-slate-400">{show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>
            </div>
            {isSignup && <input className={inputCls} type={show ? "text" : "password"} placeholder="Confirm password" aria-label="Confirm password" value={f.confirm} onChange={set("confirm")} required autoComplete="new-password" />}
            <Button type="submit" disabled={busy} className="w-full">{busy ? "Please wait…" : isSignup ? "Create account" : "Log in"}</Button>
          </form>
          <div className="my-5 flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />or<span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" /></div>
          <Button variant="ghost" className="w-full" onClick={google}>Continue with Google</Button>
          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            {isSignup ? "Already have an account? " : "New to Memnexa? "}
            <Link className="font-semibold text-brand" to={isSignup ? "/login" : "/signup"}>{isSignup ? "Log in" : "Create an account"}</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
