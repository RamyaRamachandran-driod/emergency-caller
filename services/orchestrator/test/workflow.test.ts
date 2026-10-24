import test from "node:test";
import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { configFromEnv } from "../../voice/src/config.js";
import type { Task } from "@emergency/shared";

const pause = () => new Promise(resolve => setTimeout(resolve, 30));
async function until<T>(fn: () => Promise<T | null | false>, timeout = 10000): Promise<T> {
  const end = Date.now() + timeout;
  while (Date.now() < end) { const result = await fn(); if (result) return result; await pause(); }
  throw Error("Workflow condition timed out");
}
function origin(server: Server) { return `http://127.0.0.1:${(server.address() as { port: number }).port}`; }
async function listen(server: Server) { server.listen(0, "127.0.0.1"); await once(server, "listening"); }

for (const personal of [false, true]) test(`live task API: ${personal ? "personal phone only" : "sourced calls"}, callbacks, deduplication and booking block`, async t => {
  const dir = mkdtempSync(join(tmpdir(), "savior-workflow-"));
  process.env.INTERNAL_SERVICE_TOKEN = "workflow-test-token";
  process.env.APP_MODE = "live";
  process.env.VOICE_TEST_NUMBER = "";
  const { createVoiceService } = await import("../../voice/src/service.js");
  const config = configFromEnv({
    VOICE_MODE: "live", VOICE_PROVIDER: "twilio", VOICE_DESTINATION_POLICY: personal ? "allowlist" : "sourced",
    VOICE_TEST_NUMBER: personal ? "+14155550101" : "", VOICE_ALLOWED_NUMBERS: personal ? "+14155550101" : "",
    TWILIO_ACCOUNT_SID: `AC${"a".repeat(32)}`, TWILIO_AUTH_TOKEN: "fake",
    TWILIO_PHONE_NUMBER: "+14155550100", OPENAI_API_KEY: "fake",
    PUBLIC_VOICE_URL: "https://example.test", VOICE_DATA_DIR: dir,
  });
  config.port = 0; config.providerPort = 0;
  let dialCount = 0;
  const voice = createVoiceService(config, {
    dial: async () => { dialCount++; return { sid: randomUUID() }; }, hangup: async () => {},
  });
  await voice.listen();
  let discoveryMode = "live";
  let searches = 0;
  const discovery = createServer(async (req, res) => {
    res.setHeader("content-type", "application/json");
    if (req.url === "/health") { res.end(JSON.stringify({ service: "discovery", status: "ok", mode: discoveryMode, liveReady: true })); return; }
    assert.equal(req.headers.authorization, "Bearer workflow-test-token");
    assert.equal(req.headers["x-emergency-contract-version"], "1");
    searches++;
    for await (const _chunk of req) { /* Consume the body. */ }
    res.end(JSON.stringify({ businesses: [{ id: "published-mechanic", name: "Test mechanic", phone: "+14155550101", sourceUrl: "https://example.test/contact", openingStatus: "unknown", checkedAt: new Date().toISOString() }], warnings: [] }));
  });
  await listen(discovery);
  const reservation = createServer(); await listen(reservation);
  const base = origin(reservation);
  await new Promise<void>(resolve => reservation.close(() => resolve()));
  process.env.ORCHESTRATOR_URL = base;
  const child = spawn(process.execPath, ["--import", "tsx", "services/orchestrator/src/index.ts"], {
    env: { ...process.env, VOICE_TEST_NUMBER: personal ? "+14155550101" : "", APP_MODE: "live", FOUND_STAGE_HOLD_MS: "0", ORCHESTRATOR_PORT: new URL(base).port, DATABASE_PATH: join(dir, "tasks.sqlite"), DISCOVERY_URL: origin(discovery), VOICE_URL: origin(voice.internalServer) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", chunk => { output += chunk; }); child.stderr.on("data", chunk => { output += chunk; });
  t.after(async () => {
    child.kill("SIGTERM");
    if (child.exitCode === null) await once(child, "exit");
    await voice.close();
    await new Promise<void>(resolve => discovery.close(() => resolve()));
    rmSync(dir, { recursive: true, force: true });
  });
  await until(async () => {
    if (child.exitCode !== null) throw Error(output);
    return fetch(`${base}/health`).then(r => r.ok).catch(() => false);
  });
  const submit = (key: string) => fetch(`${base}/api/tasks`, { method: "POST", headers: { "content-type": "application/json", "Idempotency-Key": key }, body: JSON.stringify({ request: "Test quote", location: "Test location", timezone: "America/Los_Angeles", maxArrivalMinutes: 30 }) });
  discoveryMode = "test";
  if (!personal) assert.equal((await submit("blocked")).status, 503);
  assert.equal(dialCount, 0); assert.equal(searches, 0);
  discoveryMode = "live";
  config.live = false;
  assert.equal((await submit("mixed-voice")).status, 503);
  config.live = true;
  config.destinationPolicy = personal ? "sourced" : "allowlist";
  assert.equal((await submit("restricted-voice")).status, 503);
  assert.equal(dialCount, 0); assert.equal(searches, 0);
  config.destinationPolicy = personal ? "allowlist" : "sourced";
  assert.equal((await (await fetch(`${base}/api/setup`)).json()).ready, true);
  const responses = await Promise.all([submit("same-key"), submit("same-key")]);
  const tasks = await Promise.all(responses.map(r => r.json() as Promise<Task>));
  assert.equal(tasks[0].id, tasks[1].id); assert.equal(tasks[0].simulated, false);
  await until(async () => dialCount === 1);
  assert.equal(searches, personal ? 0 : 1);
  assert.equal(tasks[0].businesses.length, 0); // Discovery finishes asynchronously.
  const record = [...voice.store.records.values()][0];
  assert.equal(record.request.business.phone, "+14155550101");
  assert.equal(record.request.brief?.task, "Test quote");
  assert.ok(record.request.brief?.neededInformation.length);
  assert.ok(record.request.brief?.completionCriteria.length);
  if (personal) assert.equal(record.request.business.name, "Your phone (live test)");
  voice.store.emit(record, { type: "status", status: "connected" });
  voice.store.emit(record, { type: "transcript", speaker: "business", sequence: 0, text: "Twenty minutes, two hundred dollars." });
  voice.store.emit(record, { type: "offer", offer: { id: randomUUID(), callId: record.request.callId, businessId: record.request.business.id, availableNow: true, etaMinutes: 20, amountMinor: 20000, currency: "USD", quoteType: "estimate", conditions: null } });
  voice.store.emit(record, { type: "status", status: "completed" });
  await voice.drain();
  const task = await until(async () => {
    const task: Task = await (await fetch(`${base}/api/tasks/${tasks[0].id}`)).json();
    return task.stage === "offers_ready" ? task : null;
  });
  assert.equal(task.offers.length, 1); assert.equal(task.offers[0].amountMinor, 20000);
  assert.ok(task.calls[0].events.some(e => e.type === "transcript" && e.speaker === "business"));
  assert.equal((await fetch(`${base}/api/tasks/${task.id}/book`, { method: "POST", headers: { "content-type": "application/json", "Idempotency-Key": "book-key" }, body: JSON.stringify({ offerId: task.offers[0].id }) })).status, 409);
  assert.equal(dialCount, 1);
});
