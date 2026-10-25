import { mkdirSync, readdirSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { CallRequest, type CallEvent } from "@emergency/shared";
import type { ProviderName } from "./config.js";
import type { z } from "zod";
export type Request = z.infer<typeof CallRequest>;
export type EventBody = CallEvent extends infer E ? E extends CallEvent ? Omit<E, "eventId" | "taskId" | "callId" | "at"> : never : never;
export interface Record {
  request: Request; fingerprint: string; live: boolean; callback: boolean; token: string;
  provider?: ProviderName; probe?: boolean;
  providerEvents?: { status: string; detail?: string; sipCode?: string; source: string }[];
  sid?: string; status: "dialing" | "connected" | "completed" | "failed";
  events: CallEvent[]; outbox: CallEvent[]; sequence: number; createdAt: string;
  reason?: string; providerEnded?: boolean;
  toolErrors?: { tool: string; error: string; at: string }[];
}
export class Store {
  records = new Map<string, Record>();
  constructor(private dir: string) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    for (const f of readdirSync(dir).filter(f => /^[a-f\d-]{36}\.json$/.test(f))) {
      const r = JSON.parse(readFileSync(join(dir, f), "utf8")) as Record;
      this.records.set(r.request.callId, r);
    }
  }
  save(r: Record) {
    const file = join(this.dir, `${r.request.callId}.json`);
    writeFileSync(`${file}.tmp`, JSON.stringify(r), { mode: 0o600 });
    renameSync(`${file}.tmp`, file);
    this.records.set(r.request.callId, r);
  }
  create(request: Request, live: boolean, callback: boolean, provider: ProviderName = "twilio", probe = false): Record {
    const r: Record = { provider, probe, request, fingerprint: JSON.stringify(request), live, callback, token: randomUUID(), status: "dialing", events: [], outbox: [], sequence: 0, createdAt: new Date().toISOString() };
    this.save(r); return r;
  }
  emit(r: Record, body: EventBody) {
    const event = { eventId: randomUUID(), taskId: r.request.taskId, callId: r.request.callId, at: new Date().toISOString(), ...body } as CallEvent;
    r.events.push(event);
    if (r.callback) r.outbox.push(event);
    if (event.type === "status") r.status = event.status;
    this.save(r);
  }
  terminal(r: Record) { return r.status === "completed" || r.status === "failed"; }
  public(r: Record) {
    return { connectionConfirmed: r.events.some(e => e.type === "status" && e.status === "connected"), providerEvents: r.providerEvents || [], provider: r.provider || "twilio", probe: !!r.probe, callId: r.request.callId, taskId: r.request.taskId, status: r.status, simulated: !r.live, reason: r.reason, events: r.events, pendingCallbacks: r.outbox.length };
  }
}
