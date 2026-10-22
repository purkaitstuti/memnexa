import { createContext, useCallback, useContext, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

export const inputCls = "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder-slate-500";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}>{children}</div>;
}

export function Button({ variant = "primary", className = "", ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "danger" }) {
  const v = { primary: "bg-brand text-white hover:bg-brand-hover", ghost: "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800",
    danger: "bg-red-600 text-white hover:bg-red-700" }[variant];
  return <button {...p} className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 ${v} ${className}`} />;
}

const tones = { neutral: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300", red: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  green: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300", amber: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  brand: "bg-brand-light text-brand dark:bg-indigo-950 dark:text-indigo-300" };
export const Badge = ({ tone = "neutral", children }: { tone?: keyof typeof tones; children: ReactNode }) =>
  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;

export const Spinner = () => <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-brand" aria-label="Loading" /></div>;

export function ErrorBox({ message, retry }: { message: string; retry?: () => void }) {
  return <div role="alert" className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300">
    <AlertCircle className="h-5 w-5 shrink-0" /><span className="flex-1">{message}</span>{retry && <button onClick={retry} className="font-semibold underline">Retry</button>}</div>;
}

export const Empty = ({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) =>
  <div className="py-8 text-center"><p className="font-medium">{title}</p>{hint && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{hint}</p>}{action && <div className="mt-4 flex justify-center">{action}</div>}</div>;

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  if (!open) return null;
  return <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4" onClick={onClose}>
    <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
      className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl dark:bg-slate-900 sm:rounded-2xl">{children}</div></div>;
}

const ToastCtx = createContext<(msg: string, kind?: "ok" | "err") => void>(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<{ id: number; msg: string; kind: string }[]>([]);
  const push = useCallback((msg: string, kind: "ok" | "err" = "ok") => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, msg, kind }]);
    setTimeout(() => setItems((s) => s.filter((i) => i.id !== id)), 3500);
  }, []);
  return <ToastCtx.Provider value={push}>{children}
    <div className="pointer-events-none fixed bottom-20 right-4 z-[60] flex flex-col gap-2 md:bottom-6" aria-live="polite">
      {items.map((i) => <div key={i.id} className="pointer-events-auto flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-lg dark:bg-slate-100 dark:text-slate-900">
        {i.kind === "ok" ? <CheckCircle2 className="h-4 w-4 text-green-400" /> : <AlertCircle className="h-4 w-4 text-red-400" />}{i.msg}</div>)}
    </div></ToastCtx.Provider>;
}
