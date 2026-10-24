import type { Task, TaskInput } from "@emergency/shared";

// Relative paths: Vite proxies /api to the orchestrator in development.
async function request(path: string, init?: RequestInit): Promise<Task> {
  const response = await fetch(path, { ...init, headers: { "content-type": "application/json" } });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = body?.error;
    throw new Error(
      Array.isArray(error)
        ? error.map((issue: { message: string }) => issue.message).join("; ")
        : (error ?? `Request failed with status ${response.status}`),
    );
  }
  return body as Task;
}

export function createTask(input: TaskInput): Promise<Task> {
  return request("/api/tasks", { method: "POST", body: JSON.stringify(input) });
}

export function getTask(taskId: string): Promise<Task> {
  return request(`/api/tasks/${encodeURIComponent(taskId)}`);
}

export function bookOffer(taskId: string, offerId: string): Promise<Task> {
  return request(`/api/tasks/${encodeURIComponent(taskId)}/book`, {
    method: "POST",
    body: JSON.stringify({ offerId }),
  });
}
