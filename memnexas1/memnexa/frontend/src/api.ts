export type User = { id: number; name: string; email: string; provider: string; theme: "light" | "dark" | "system";
  reminders_enabled: boolean; default_reminder_minutes: number };
export type Task = { id: number; title: string; description: string; due_at: string | null; priority: "low" | "medium" | "high";
  status: "pending" | "completed"; is_overdue: boolean; tags: string[]; reminder_at: string | null;
  completed_at: string | null; created_at: string };
export type Memory = { id: number; title: string; content: string; category: string; tags: string[];
  memory_date: string | null; reminder_at: string | null; created_at: string; updated_at: string };
export type Stats = { total: number; completed: number; pending: number; overdue: number };
export type Page<T> = { items: T[]; total: number; page: number; size: number };

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function req<T>(path: string, method = "GET", body?: unknown, form?: FormData): Promise<T> {
  let r: Response;
  try {
    r = await fetch("/api" + path, { method, credentials: "include",
      headers: body ? { "Content-Type": "application/json" } : undefined, body: form ?? (body ? JSON.stringify(body) : undefined) });
  } catch {
    throw new ApiError(0, "Can't reach the Memnexa server. Make sure the backend is running.");
  }
  if (!r.ok) {
    let msg = "Something went wrong. Please try again.";
    try { const j = await r.json(); if (typeof j.detail === "string") msg = j.detail; else if (r.status === 422) msg = "Please check the highlighted fields."; } catch { /* keep default */ }
    throw new ApiError(r.status, msg);
  }
  return r.status === 204 ? (undefined as T) : r.json();
}

export const api = {
  get: <T,>(p: string) => req<T>(p),
  post: <T,>(p: string, b?: unknown) => req<T>(p, "POST", b ?? {}),
  patch: <T,>(p: string, b: unknown) => req<T>(p, "PATCH", b),
  del: (p: string) => req<void>(p, "DELETE"),
  upload: <T,>(p: string, f: FormData) => req<T>(p, "POST", undefined, f),
};

// Backend timestamps are naive UTC, so append Z before parsing.
export const utc = (iso: string) => new Date(iso.endsWith("Z") ? iso : iso + "Z");
export const fmt = (iso: string | null) =>
  iso ? utc(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "No due date";
export const toInput = (iso: string | null) => {
  if (!iso) return "";
  const d = utc(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
export const fromInput = (v: string) => (v ? new Date(v).toISOString() : null);
export const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
export function dueLabel(t: Task) {
  if (!t.due_at) return "No due date";
  const d = utc(t.due_at), now = new Date();
  const tmr = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const time = d.toLocaleTimeString([], { timeStyle: "short" });
  if (dayKey(d) === dayKey(now)) return `Today, ${time}`;
  if (dayKey(d) === dayKey(tmr)) return `Tomorrow, ${time}`;
  return fmt(t.due_at);
}

export type AskResult = { answer: string; tasks: Task[]; memories: Memory[]; used_ai: boolean };
export type Recent = { id: number; query: string };

export type Suggestion = { kind: "task" | "memory"; title: string; description: string; date_phrase: string | null; due_date: string | null;
  due_time: string | null; needs_confirm: boolean; priority: "low" | "medium" | "high"; tags: string[] };
export type UploadResult = { filename: string; text: string; suggestions: Suggestion[]; ai_error: string | null; summary: string };
export type Notif = { id: number; message: string; read: boolean; delivered: boolean; scheduled_at: string; task_id: number | null; memory_id: number | null };
export type NotifList = { items: Notif[]; unread: number };
