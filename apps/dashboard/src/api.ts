import type { Task, TaskInput, BookingContact } from "@emergency/shared";

// Relative paths: Vite proxies /api to the orchestrator in development.
async function request<T = Task>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("content-type", "application/json");
  const response = await fetch(path, { ...init, headers });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = body?.error;
    throw new Error(
      Array.isArray(error)
        ? error.map((issue: { message: string }) => issue.message).join("; ")
        : (error ?? `Request failed with status ${response.status}`),
    );
  }
  return body as T;
}

export interface Setup { mode: "test" | "live"; ready: boolean; issues: string[]; liveBookingEnabled: boolean; testCallNumber: string | null }
export function getSetup() { return request<Setup>("/api/setup"); }

export function createTask(input: TaskInput, idempotencyKey: string): Promise<Task> {
  return request("/api/tasks", { method: "POST", headers: { "Idempotency-Key": idempotencyKey }, body: JSON.stringify(input) });
}

export function getTask(taskId: string): Promise<Task> {
  return request(`/api/tasks/${encodeURIComponent(taskId)}`);
}

export function bookOffer(taskId: string, offerId: string, contact: BookingContact, key: string): Promise<Task> {
  return request(`/api/tasks/${encodeURIComponent(taskId)}/book`, {
    method: "POST",
    headers: { "Idempotency-Key": key },
    body: JSON.stringify({ offerId, contact }),
  });
}
