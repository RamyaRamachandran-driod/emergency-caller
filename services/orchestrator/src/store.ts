import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import type { CallEvent, Task } from "@emergency/shared";

export type MutationResult = "updated" | "missing" | "duplicate" | "invalid" | "booking_claimed" | "booking_replay" | "booking_exists";

export class TaskStore {
  private readonly db: Database.Database;
  private readonly saveStatement: Database.Statement;
  private readonly getStatement: Database.Statement;
  private readonly requestStatement: Database.Statement;

  constructor(path = process.env.DATABASE_PATH ?? "./data/orchestrator.sqlite") {
    const repositoryRoot = fileURLToPath(new URL("../../../", import.meta.url));
    const dbPath = resolve(repositoryRoot, path);
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        task_id TEXT PRIMARY KEY,
        client_request_id TEXT UNIQUE,
        booking_key TEXT UNIQUE,
        task_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS processed_events (
        event_id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE
      );
    `);
    this.saveStatement = this.db.prepare(`
      INSERT INTO tasks(task_id, client_request_id, booking_key, task_json, created_at, updated_at)
      VALUES (?, ?, NULL, ?, ?, ?)
      ON CONFLICT(task_id) DO UPDATE SET task_json = excluded.task_json, updated_at = excluded.updated_at
    `);
    this.getStatement = this.db.prepare("SELECT task_json FROM tasks WHERE task_id = ?");
    this.requestStatement = this.db.prepare("SELECT task_json FROM tasks WHERE client_request_id = ?");
    this.recoverInterruptedTasks();
  }

  get(taskId: string): Task | null {
    const row = this.getStatement.get(taskId) as { task_json: string } | undefined;
    return row ? JSON.parse(row.task_json) as Task : null;
  }

  findByClientRequestId(key: string): Task | null {
    const row = this.requestStatement.get(key) as { task_json: string } | undefined;
    return row ? JSON.parse(row.task_json) as Task : null;
  }

  create(task: Task, clientRequestId: string | null): void {
    const timestamp = new Date().toISOString();
    this.saveStatement.run(task.id, clientRequestId, JSON.stringify(task), timestamp, timestamp);
  }

  mutate(taskId: string, change: (task: Task) => void): Task | null {
    return this.db.transaction(() => {
      const task = this.get(taskId);
      if (!task) return null;
      change(task);
      this.persist(task);
      return task;
    })();
  }

  claimBooking(taskId: string, key: string, change: (task: Task) => boolean): { result: MutationResult; task: Task | null } {
    return this.db.transaction((): { result: MutationResult; task: Task | null } => {
      const row = this.db.prepare("SELECT booking_key FROM tasks WHERE task_id = ?").get(taskId) as { booking_key: string | null } | undefined;
      const task = this.get(taskId);
      if (!row || !task) return { result: "missing", task: null };
      if (row.booking_key) return { result: row.booking_key === key ? "booking_replay" : "booking_exists", task };
      const keyOwner = this.db.prepare("SELECT task_id FROM tasks WHERE booking_key = ?").get(key) as { task_id: string } | undefined;
      if (keyOwner) return { result: keyOwner.task_id === taskId ? "booking_replay" : "booking_exists", task };
      if (!change(task)) return { result: "invalid", task };
      const updated = this.db.prepare("UPDATE tasks SET booking_key = ? WHERE task_id = ? AND booking_key IS NULL").run(key, taskId);
      if (updated.changes !== 1) return { result: "booking_exists", task: this.get(taskId) };
      this.db.prepare("INSERT INTO processed_events(event_id, task_id) VALUES (?, ?)").run(`booking:${key}`, taskId);
      this.persist(task);
      return { result: "booking_claimed", task };
    })();
  }

  applyEvent(event: CallEvent, change: (task: Task) => "updated" | "invalid"): { result: MutationResult; task: Task | null } {
    return this.db.transaction((): { result: MutationResult; task: Task | null } => {
      const task = this.get(event.taskId);
      if (!task) return { result: "missing", task: null };
      const seen = this.db.prepare("SELECT 1 FROM processed_events WHERE event_id = ?").get(event.eventId);
      if (seen) return { result: "duplicate", task };
      const result = change(task);
      if (result === "invalid") return { result: "invalid", task };
      this.db.prepare("INSERT INTO processed_events(event_id, task_id) VALUES (?, ?)").run(event.eventId, task.id);
      this.persist(task);
      return { result: "updated", task };
    })();
  }

  close(): void { this.db.close(); }

  private persist(task: Task): void {
    const timestamp = new Date().toISOString();
    this.saveStatement.run(task.id, null, JSON.stringify(task), timestamp, timestamp);
  }

  private recoverInterruptedTasks(): void {
    const rows = this.db.prepare("SELECT task_id FROM tasks").all() as { task_id: string }[];
    for (const { task_id: taskId } of rows) {
      this.mutate(taskId, (task) => {
        if (!["finding", "calling", "booking"].includes(task.stage)) return;
        task.stage = "failed";
        task.error = "Orchestrator restarted before this task completed. No call was retried.";
        for (const call of task.calls) if (["dialing", "connected"].includes(call.status)) call.status = "failed";
      });
    }
  }
}
