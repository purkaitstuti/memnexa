import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Brain, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../auth";
import { api, ApiError } from "../api";
import { Button, ErrorBox, inputCls } from "../components/ui";
import { ThemeToggle } from "../components/Layout";

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
    const e = new URLSearchParams(location.search).get("error");
    if (e) setErr("Google sign-in didn't complete. Please try again.");
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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-light to-slate-50 p-4 dark:from-slate-900 dark:to-slate-950">
      <div className="absolute right-4 top-4"><ThemeToggle /></div>
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <span className="rounded-2xl bg-brand p-3 text-white"><Brain className="h-7 w-7" /></span>
          <h1 className="text-2xl font-bold">{isSignup ? "Create your account" : "Welcome back"}</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Your thoughts, tasks, and memories — all in one place.</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          {err && <ErrorBox message={err} />}
          {isSignup && <input className={inputCls} placeholder="Full name" value={f.name} onChange={set("name")} required autoComplete="name" />}
          <input className={inputCls} type="email" placeholder="Email" value={f.email} onChange={set("email")} required autoComplete="email" />
          <div className="relative">
            <input className={inputCls} type={show ? "text" : "password"} placeholder="Password" value={f.password} onChange={set("password")} required autoComplete={isSignup ? "new-password" : "current-password"} />
            <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-3 top-2.5 text-slate-400">{show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}</button>
          </div>
          {isSignup && <input className={inputCls} type={show ? "text" : "password"} placeholder="Confirm password" value={f.confirm} onChange={set("confirm")} required autoComplete="new-password" />}
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
  );
}
