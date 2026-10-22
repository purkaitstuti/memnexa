import { useEffect, useState } from "react";
import { Brain } from "lucide-react";

export default function Splash() {
  const [slow, setSlow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setSlow(true), 6000); return () => clearTimeout(t); }, []);
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-violet-50 p-6 text-center dark:from-slate-950 dark:via-slate-950 dark:to-indigo-950">
      <div aria-hidden className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-indigo-300/40 blur-3xl animate-blob motion-reduce:animate-none dark:bg-indigo-600/20" />
      <div aria-hidden className="absolute -bottom-28 -right-20 h-96 w-96 rounded-full bg-violet-300/40 blur-3xl animate-blob motion-reduce:animate-none [animation-delay:-7s] dark:bg-violet-600/20" />
      <div className="relative animate-fadeup" role="status" aria-live="polite">
        <div className="relative mx-auto h-20 w-20">
          <span className="absolute inset-0 rounded-3xl bg-brand/40 animate-pulsering motion-reduce:animate-none" />
          <span className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-brand text-white shadow-lg shadow-indigo-500/30"><Brain className="h-10 w-10" /></span>
        </div>
        <h1 className="mt-6 text-3xl font-bold tracking-tight">Memnexa</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">Your memory, and what to do next.</p>
        <div className="mx-auto mt-8 h-1 w-40 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" aria-hidden>
          <div className="h-full w-1/3 rounded-full bg-brand animate-slide motion-reduce:animate-none" />
        </div>
        <span className="sr-only">Loading</span>
        {slow && <p className="mx-auto mt-6 max-w-xs text-sm text-slate-500 dark:text-slate-400">Taking longer than usual… Make sure the backend is running (<code>uvicorn app.main:app --reload</code>).</p>}
      </div>
    </div>
  );
}
