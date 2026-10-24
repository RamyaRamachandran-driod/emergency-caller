import { API_CONTRACT_VERSION } from "@emergency/shared";
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import { once } from "node:events";
import WebSocket, { WebSocketServer } from "ws";
import twilio from "twilio";
import { configFromEnv, missingConfig } from "../src/config.js";
import { Store, type Request } from "../src/store.js";
import { validateQuote } from "../src/prompt.js";
import { bridge } from "../src/bridge.js";
process.env.INTERNAL_SERVICE_TOKEN = "local-test-token";
process.env.VOICE_TEST_NUMBER = "";
const { createVoiceService } = await import("../src/service.js");
const pause = (ms = 20) => new Promise(r => setTimeout(r, ms));
async function until(fn: () => boolean, timeout = 4000) { const end = Date.now() + timeout; while (!fn()) { if (Date.now() > end) throw Error("Timed out waiting for condition"); await pause(); } }
const config = (dir: string) => ({ ...configFromEnv({ VOICE_MODE: "live", TWILIO_ACCOUNT_SID: `AC${"a".repeat(32)}`, TWILIO_AUTH_TOKEN: "fake-auth", TWILIO_PHONE_NUMBER: "+14155550100", OPENAI_API_KEY: "fake-key", PUBLIC_VOICE_URL: "https://example.test", VOICE_ALLOWED_NUMBERS: "+14155550101", VOICE_DATA_DIR: dir }), port: 0, providerPort: 0 });
const request = (): Request => ({ taskId: randomUUID(), callId: randomUUID(), input: { request: "Car won't start", location: "123 Test Street, Test City", timezone: "America/Los_Angeles", maxArrivalMinutes: 30 }, business: { id: "team-1", name: "Team phone", phone: "+14155550101", sourceUrl: null, openingStatus: "unknown", checkedAt: new Date().toISOString() }, purpose: "quote", selectedOffer: null });
function origin(server: Server) { return `http://127.0.0.1:${(server.address() as { port: number }).port}`; }
async function harness(t: test.TestContext, overrides = {}) {
  const dir = mkdtempSync(join(tmpdir(), "savior-voice-test-"));
  const c = { ...config(dir), ...overrides };
  const dialed: unknown[] = [], hung: string[] = [];
  const service = createVoiceService(c, { dial: async options => { dialed.push(options); return { sid: `CA${"b".repeat(32)}` }; }, hangup: async sid => { hung.push(sid); } });
  await service.listen();
  t.after(async () => { await service.close(); rmSync(dir, { recursive: true, force: true }); });
  async function api(path: string, body?: unknown, auth = true) {
    return fetch(`${origin(service.internalServer)}${path}`, { method: body ? "POST" : "GET", headers: { "x-emergency-contract-version": API_CONTRACT_VERSION, "content-type": "application/json", ...(auth ? { authorization: "Bearer local-test-token" } : {}) }, body: body ? JSON.stringify(body) : undefined });
  }
  return { service, c, api, dialed, hung };
}
test("readiness identifies missing configuration without exposing keys", () => {
  const c = configFromEnv({});
  assert.equal(c.live, false);
  assert.ok(missingConfig(c).includes("OPENAI_API_KEY"));
  assert.equal(missingConfig(config("unused")).length, 0);
});
test("internal APIs require authentication and tunnel server exposes no controls", async t => {
  const h = await harness(t);
  assert.equal((await h.api("/setup", undefined, false)).status, 401);
  assert.equal((await fetch(`${origin(h.service.providerServer)}/dev/calls`, { method: "POST" })).status, 404);
  assert.equal((await fetch(`${origin(h.service.providerServer)}/health`)).status, 404);
  const health = await (await h.api("/health")).json();
  assert.equal(health.mode, "live"); assert.equal(health.liveReady, true);
});
test("missing credentials, unlisted numbers and live booking never dial", async t => {
  const h = await harness(t);
  const r = request(); r.business.phone = "+14155550199";
  assert.equal((await h.api("/dev/calls", r)).status, 403);
  const booking = request(); booking.purpose = "booking";
  booking.selectedOffer = { id: randomUUID(), callId: randomUUID(), businessId: "team-1", availableNow: true, etaMinutes: 20, amountMinor: 10000, currency: "USD", quoteType: "estimate", conditions: null };
  assert.equal((await h.api("/dev/calls", booking)).status, 409);
  const incomplete = await harness(t, { apiKey: "" });
  assert.equal((await incomplete.api("/dev/calls", request())).status, 503);
  assert.equal(h.dialed.length, 0); assert.equal(incomplete.dialed.length, 0);
});
test("duplicate call IDs never redial; changed payload is rejected; stop hangs up", async t => {
  const h = await harness(t), r = request();
  assert.equal((await h.api("/dev/calls", r)).status, 202);
  assert.equal((await h.api("/dev/calls", r)).status, 202);
  assert.equal((await h.api("/dev/calls", { ...r, input: { ...r.input, location: "Other address" } })).status, 409);
  await until(() => h.dialed.length === 1);
  assert.equal((await h.api(`/calls/${r.callId}/stop`, {})).status, 200);
  assert.deepEqual(h.hung, [`CA${"b".repeat(32)}`]);
  assert.equal(h.service.store.records.get(r.callId)?.status, "failed");
  assert.match((h.dialed[0] as { mediaUrl: string }).mediaUrl, /wss:\/\/example.test\/twilio\/media\//);
  assert.equal((h.dialed[0] as { maxSeconds: number }).maxSeconds, 180);
});
test("concurrent call limit prevents new provider calls", async t => {
  const h = await harness(t, { maxConcurrent: 1 });
  assert.equal((await h.api("/dev/calls", request())).status, 202);
  assert.equal((await h.api("/dev/calls", request())).status, 429);
  assert.equal(h.dialed.length, 1);
});
test("signed terminal callbacks end matching calls; forged callbacks do not", async t => {
  const h = await harness(t), r = request();
  await h.api("/dev/calls", r);
  const path = `/twilio/status/${r.callId}`;
  const params = { AccountSid: h.c.accountSid, CallSid: `CA${"b".repeat(32)}`, CallStatus: "busy", To: r.business.phone, From: h.c.from };
  const send = (sig: string) => fetch(`${origin(h.service.providerServer)}${path}`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", "x-twilio-signature": sig }, body: new URLSearchParams(params) });
  assert.equal((await send("forged")).status, 403);
  assert.equal((await send(twilio.getExpectedTwilioSignature(h.c.authToken, `${h.c.publicUrl}${path}`, params))).status, 204);
  assert.equal(h.service.store.records.get(r.callId)?.status, "failed");
  assert.equal(h.hung.length, 0);
});
test("restart preserves idempotency and fails interrupted calls without redialing", async t => {
  const dir = mkdtempSync(join(tmpdir(), "savior-restart-"));
  const c = config(dir), store = new Store(dir), r = store.create(request(), true, false);
  r.sid = `CA${"b".repeat(32)}`; store.save(r);
  let dials = 0, hangs = 0;
  const service = createVoiceService(c, { dial: async () => { dials++; return { sid: "unexpected" }; }, hangup: async () => { hangs++; } });
  await service.listen(); t.after(async () => { await service.close(); rmSync(dir, { recursive: true, force: true }); });
  assert.equal(service.store.records.get(r.request.callId)?.status, "failed");
  await service.drain(); assert.equal(hangs, 1); assert.equal(dials, 0);
  const response = await fetch(`${origin(service.internalServer)}/dev/calls`, { method: "POST", headers: { "x-emergency-contract-version": API_CONTRACT_VERSION, authorization: "Bearer local-test-token", "content-type": "application/json" }, body: JSON.stringify(r.request) });
  assert.equal(response.status, 202); assert.equal(dials, 0);
});
test("simulation remains available without credentials and produces a quote", async t => {
  const h = await harness(t, { live: false, apiKey: "" }); const r = request();
  await h.api("/dev/calls", r);
  await until(() => h.service.store.records.get(r.callId)?.status === "completed");
  const state = await (await h.api(`/calls/${r.callId}`)).json();
  assert.equal(state.simulated, true); assert.ok(state.events.some((e: any) => e.type === "offer")); assert.equal(h.dialed.length, 0);
});
test("quote extraction rejects invented evidence and unqualified money", () => {
  const q = { availability: "available", etaMinutes: 20, amountMinor: 12500, currency: "USD", quoteType: "estimate", conditions: null, evidence: { availability: "We can help", eta: "twenty minutes", price: "125 dollars" } };
  assert.throws(() => validateQuote(q, "Hello"), /Availability/);
  assert.throws(() => validateQuote({ ...q, currency: null }, "We can help in twenty minutes, 125 dollars"), /Price/);
  assert.equal(validateQuote(q, "We can help in twenty minutes, 125 dollars").amountMinor, 12500);
  assert.equal(validateQuote({ ...q, availability: "unknown", etaMinutes: null, amountMinor: null, currency: null, quoteType: "unknown" }, "").amountMinor, null);
});
test("durable outbox retries the same event ID after a callback failure", async t => {
  const prior = process.env.ORCHESTRATOR_URL;
  let fail = true; const ids: string[] = [];
  const target = createServer((req, res) => { let body = ""; req.on("data", c => body += c); req.on("end", () => { ids.push(JSON.parse(body).eventId); res.writeHead(fail ? 503 : 200, { "content-type": "application/json" }); res.end("{}"); }); });
  target.listen(0, "127.0.0.1"); await once(target, "listening"); process.env.ORCHESTRATOR_URL = origin(target);
  t.after(() => { process.env.ORCHESTRATOR_URL = prior; target.close(); });
  const h = await harness(t, { live: false });
  const r = h.service.store.create(request(), false, true);
  h.service.store.emit(r, { type: "status", status: "completed" });
  await h.service.drain(); assert.equal(r.outbox.length, 1);
  fail = false; await pause(1100); await h.service.drain();
  assert.equal(r.outbox.length, 0); assert.ok(ids.length >= 2); assert.equal(ids[0], ids[1]);
});
test("audio bridge configures PCMU, relays audio, handles interruption, and saves supported quote", async t => {
  const dir = mkdtempSync(join(tmpdir(), "savior-bridge-"));
  const store = new Store(dir), c = config(dir), r = store.create(request(), true, false); r.sid = `CA${"b".repeat(32)}`;
  const phoneServer = new WebSocketServer({ port: 0, host: "127.0.0.1" });
  const aiServer = new WebSocketServer({ port: 0, host: "127.0.0.1" });
  await Promise.all([once(phoneServer, "listening"), once(aiServer, "listening")]);
  let aiPeer: WebSocket | undefined; const aiMessages: any[] = [], phoneMessages: any[] = [], finished: string[] = [];
  aiServer.on("connection", ws => { aiPeer = ws; ws.on("message", raw => aiMessages.push(JSON.parse(raw.toString()))); });
  phoneServer.on("connection", ws => bridge(ws, r, store, c, async reason => { finished.push(reason); }, () => new WebSocket(`ws://127.0.0.1:${(aiServer.address() as { port: number }).port}`)));
  const caller = new WebSocket(`ws://127.0.0.1:${(phoneServer.address() as { port: number }).port}`);
  caller.on("message", raw => phoneMessages.push(JSON.parse(raw.toString())));
  await once(caller, "open");
  t.after(() => { caller.terminate(); aiPeer?.terminate(); phoneServer.close(); aiServer.close(); rmSync(dir, { recursive: true, force: true }); });
  const sendPhone = (m: object) => caller.send(JSON.stringify(m));
  const sendAI = (m: object) => aiPeer!.send(JSON.stringify(m));
  sendPhone({ event: "start", start: { streamSid: "MZtest", callSid: r.sid, accountSid: c.accountSid, mediaFormat: { encoding: "audio/x-mulaw", sampleRate: 8000 } } });
  await until(() => aiMessages.some(m => m.type === "session.update"));
  assert.equal(aiMessages[0].session.audio.input.format.type, "audio/pcmu");
  sendAI({ type: "session.updated" });
  sendPhone({ event: "media", streamSid: "MZtest", media: { payload: "////" } });
  await until(() => aiMessages.some(m => m.type === "input_audio_buffer.append"));
  sendAI({ type: "response.created", response: { id: "response-1" } });
  sendAI({ type: "response.output_audio.delta", response_id: "response-1", item_id: "item-1", delta: "////" });
  await until(() => phoneMessages.some(m => m.event === "media"));
  sendAI({ type: "input_audio_buffer.speech_started" });
  await until(() => phoneMessages.some(m => m.event === "clear"));
  assert.ok(aiMessages.some(m => m.type === "conversation.item.truncate"));
  sendAI({ type: "conversation.item.input_audio_transcription.completed", item_id: "business-1", transcript: "We can help in twenty minutes for 125 dollars, estimated." });
  const args = JSON.stringify({ availability: "available", etaMinutes: 20, amountMinor: 12500, currency: "USD", quoteType: "estimate", conditions: null, evidence: { availability: "We can help", eta: "twenty minutes", price: "125 dollars" } });
  const badArgs = JSON.stringify({ ...JSON.parse(args), evidence: { ...JSON.parse(args).evidence, eta: "20 mins" } });
  sendAI({ type: "response.function_call_arguments.done", call_id: "repair-tool", name: "report_quote", arguments: badArgs });
  await until(() => aiMessages.some(m => m.type === "conversation.item.create" && m.item.call_id === "repair-tool"), 7000);
  const repair = JSON.parse(aiMessages.find(m => m.type === "conversation.item.create" && m.item.call_id === "repair-tool").item.output);
  assert.deepEqual(repair.businessTranscriptSegments, ["We can help in twenty minutes for 125 dollars, estimated."]);
  assert.match(repair.instruction, /Do not ask the business to repeat/);
  assert.equal(r.events.filter(e => e.type === "offer").length, 0);
  sendAI({ type: "response.done", response: { status: "completed" } });
  await until(() => aiMessages.filter(m => m.type === "response.create").length === 2);
  sendAI({ type: "response.created", response: { id: "response-repair" } });
  sendAI({ type: "response.function_call_arguments.done", call_id: "tool-1", name: "report_quote", arguments: args });
  await until(() => r.events.some(e => e.type === "offer"));
  sendAI({ type: "response.function_call_arguments.done", call_id: "tool-1", name: "report_quote", arguments: args });
  await pause(); assert.equal(r.events.filter(e => e.type === "offer").length, 1);
  assert.equal(aiMessages.filter(m => m.type === "response.create").length, 2, "do not start a tool follow-up while its originating response is active");
  sendAI({ type: "response.done", response: { status: "completed" } });
  await until(() => aiMessages.filter(m => m.type === "response.create").length === 3);
  sendAI({ type: "error", error: { code: "test_failure" } });
  await until(() => finished.length === 1);
});

test("media upgrades require both a signed request and the call correlation token", async t => {
  const h = await harness(t), r = request();
  await h.api("/dev/calls", r);
  const record = h.service.store.records.get(r.callId)!;
  const path = `/twilio/media/${r.callId}/${record.token}`;
  const wsOrigin = origin(h.service.providerServer).replace("http:", "ws:");
  const rejected = new WebSocket(`${wsOrigin}${path}`, { headers: { "x-twilio-signature": "forged" } });
  rejected.on("error", () => {});
  const [, response] = await once(rejected, "unexpected-response");
  assert.equal(response.statusCode, 403); rejected.terminate();
  const good = new WebSocket(`${wsOrigin}${path}`, { headers: { "x-twilio-signature": twilio.getExpectedTwilioSignature(h.c.authToken, `${h.c.publicUrl}${path}`, {}) } });
  good.on("error", () => {});
  await once(good, "open");
  t.after(() => good.terminate());
  assert.equal(good.readyState, WebSocket.OPEN);
});

test("sourced policy only permits authenticated discovery calls with a published, open-or-unknown business", async t => {
  const h = await harness(t, { destinationPolicy: "sourced", allowedNumbers: [] });
  for (const sourceUrl of [null, "file:///tmp/phone", "https://user:pass@example.test/phone"]) {
    const r = request(); r.business.sourceUrl = sourceUrl;
    assert.equal((await h.api("/calls", r)).status, 403);
  }
  const closed = request(); closed.business.sourceUrl = "https://example.test/phone"; closed.business.openingStatus = "closed";
  assert.equal((await h.api("/calls", closed)).status, 403);
  const r = request(); r.business.sourceUrl = "https://example.test/phone";
  assert.equal((await h.api("/dev/calls", r)).status, 403);
  assert.equal(h.dialed.length, 0);
  assert.equal((await h.api("/calls", r)).status, 202);
  await until(() => h.dialed.length === 1);
  assert.equal((await h.api("/health")).status, 200);
});

test("personal phone lock overrides sourced policy and every other allowlisted destination", async t => {
  const h = await harness(t, { testNumber: "+14155550101", destinationPolicy: "sourced", allowedNumbers: ["+14155550101", "+14155550199"] });
  const r = request(); r.business.phone = "+14155550199"; r.business.sourceUrl = "https://example.test/contact";
  assert.equal((await h.api("/calls", r)).status, 403);
  assert.equal(h.dialed.length, 0);
  const own = request();
  assert.equal((await h.api("/calls", own)).status, 202);
  await until(() => h.dialed.length === 1);
});
