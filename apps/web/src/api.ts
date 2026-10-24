import type { CreateTaskInput, CreateTaskResponse, TaskSnapshot } from './types'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') ?? ''

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: { 'content-type': 'application/json', ...options?.headers },
  })
  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || `Request failed with status ${response.status}`)
  }
  return response.json() as Promise<T>
}

export function createTask(input: CreateTaskInput): Promise<CreateTaskResponse> {
  return request('/api/tasks', { method: 'POST', body: JSON.stringify(input) })
}

export function getTask(taskId: string): Promise<TaskSnapshot> {
  return request(`/api/tasks/${encodeURIComponent(taskId)}`)
}

export function requestBooking(taskId: string, offerId: string): Promise<void> {
  return request(`/api/tasks/${encodeURIComponent(taskId)}/book`, {
    method: 'POST',
    body: JSON.stringify({ offerId }),
  })
}
