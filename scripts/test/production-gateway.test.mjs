import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import WebSocket, { WebSocketServer } from "ws";
import { createGateway } from "../production-gateway.mjs";

async function listen(server) { server.listen(0, "127.0.0.1"); await once(server, "listening"); return `http://127.0.0.1:${server.address().port}`; }
test("public gateway protects dashboard/API, isolates internal controls and preserves provider HTTP/audio", async t => {
  const dir = mkdtempSync(join(tmpdir(), "savior-gateway-"));
  writeFileSync(join(dir, "index.html"), "<h1>Savior production dashboard</h1>");
  const requests = [];
  const internal = createServer((req, res) => { requests.push(req.url); res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ route: req.url })); });
  const hooks = createServer(async (req, res) => { let body = ""; for await (const chunk of req) body += chunk; res.setHeader("content-type", "application/json"); res.end(JSON.stringify({ route: req.url, authorization: req.headers.authorization, body })); });
  const audio = new WebSocketServer({ server: hooks });
  audio.on("connection", ws => ws.on("message", (data, binary) => ws.send(data, { binary })));
  const internalUrl = await listen(internal), hooksUrl = await listen(hooks);
  let healthy = false;
  const user = "savior", password = "gateway-test-password-123";
  const gateway = createGateway({ username: user, password, orchestratorUrl: internalUrl, providerUrl: hooksUrl, staticDir: dir, ready: async () => healthy });
  const base = await listen(gateway);
  t.after(async () => { audio.clients.forEach(ws => ws.terminate()); audio.close(); await Promise.all([gateway, internal, hooks].map(s => new Promise(resolve => s.close(resolve)))); rmSync(dir, { recursive: true, force: true }); });
  const auth = { authorization: `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}` };
  assert.equal((await fetch(`${base}/health`)).status, 503);
  healthy = true; assert.equal((await fetch(`${base}/health`)).status, 200);
  assert.equal((await fetch(`${base}/app`)).status, 401);
  assert.equal((await fetch(`${base}/api/tasks`)).status, 401);
  const page = await fetch(`${base}/app?task=existing`, { headers: auth });
  assert.equal(page.status, 200); assert.match(await page.text(), /Savior production dashboard/);
  const api = await fetch(`${base}/api/tasks/test`, { headers: auth });
  assert.deepEqual(await api.json(), { route: "/api/tasks/test" });
  assert.deepEqual(requests, ["/api/tasks/test"]);
  for (const path of ["/internal/events", "/calls/test/stop", "/dev/calls", "/discover", "/setup"]) assert.equal((await fetch(base + path, { headers: auth })).status, 404);
  assert.equal((await fetch(`${base}/api/tasks`, { method: "POST", headers: { ...auth, origin: "https://untrusted.example" } })).status, 403);
  const body = '{"signed":"original bytes"}';
  const event = await fetch(`${base}/vonage/events/call/token`, { method: "POST", headers: { authorization: "Bearer provider-signature", "content-type": "application/json" }, body });
  assert.deepEqual(await event.json(), { route: "/vonage/events/call/token", authorization: "Bearer provider-signature", body });
  const ws = new WebSocket(`${base.replace("http:", "ws:")}/vonage/media/call/token`);
  await once(ws, "open");
  const reply = once(ws, "message"); const pcm = Buffer.from([0, 2, 4, 6]); ws.send(pcm);
  const [data, binary] = await reply;
  assert.equal(binary, true); assert.deepEqual(data, pcm);
  ws.close(); await once(ws, "close");
});

test("production launcher serves the complete workflow and preserves confirmed tasks after restart", async t => {
  const { spawn } = await import("node:child_process");
  const dir = mkdtempSync(join(tmpdir(), "savior-production-"));
  const ports = [];
  for (let i = 0; i < 5; i++) { const s = createServer(); await listen(s); ports.push(s.address().port); await new Promise(r => s.close(r)); }
  const base = `http://127.0.0.1:${ports[0]}`;
  const env = { ...process.env, APP_MODE: "test", VOICE_MODE: "test", VOICE_PROVIDER: "twilio", VOICE_TEST_NUMBER: "", VOICE_ALLOWED_NUMBERS: "", VOICE_DESTINATION_POLICY: "allowlist", PORT: String(ports[0]), ORCHESTRATOR_PORT: String(ports[1]), DISCOVERY_PORT: String(ports[2]), VOICE_PORT: String(ports[3]), VOICE_PROVIDER_PORT: String(ports[4]), DATA_DIR: dir, INTERNAL_SERVICE_TOKEN: "production-test-token", DASHBOARD_USER: "savior", DASHBOARD_PASSWORD: "production-test-password", FOUND_STAGE_HOLD_MS: "0", VONAGE_PRIVATE_KEY_B64: "" };
  let child, output = "";
  async function waitFor(fn) {
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) { const value = await fn().catch(() => false); if (value) return value; if (child.exitCode !== null) throw Error(output); await new Promise(r => setTimeout(r, 100)); }
    throw Error(`Production startup/workflow timed out: ${output}`);
  }
  async function start() {
    child = spawn(process.execPath, ["scripts/serve-production.mjs"], { env, stdio: ["ignore", "pipe", "pipe"] });
    child.stdout.on("data", chunk => { output += chunk; }); child.stderr.on("data", chunk => { output += chunk; });
    await waitFor(async () => (await fetch(`${base}/health`)).ok);
  }
  async function stop() { if (child && child.exitCode === null) { const exited = once(child, "exit"); child.kill("SIGTERM"); await exited; } }
  t.after(async () => { await stop(); rmSync(dir, { recursive: true, force: true }); });
  await start();
  const headers = { authorization: `Basic ${Buffer.from(`${env.DASHBOARD_USER}:${env.DASHBOARD_PASSWORD}`).toString("base64")}`, "content-type": "application/json", "Idempotency-Key": "production-test-request" };
  assert.equal((await fetch(`${base}/app`, { headers })).status, 200);
  const created = await fetch(`${base}/api/tasks`, { method: "POST", headers, body: JSON.stringify({ request: "Test service quote", location: "Test location", timezone: "America/Los_Angeles", maxArrivalMinutes: 60 }) });
  assert.equal(created.status, 202); const task = await created.json();
  const offered = await waitFor(async () => { const view = await (await fetch(`${base}/api/tasks/${task.id}`, { headers })).json(); return view.stage === "offers_ready" && view; });
  const booking = await fetch(`${base}/api/tasks/${task.id}/book`, { method: "POST", headers: { ...headers, "Idempotency-Key": "production-test-approval" }, body: JSON.stringify({ offerId: offered.offers.find(o => o.availableNow && o.etaMinutes <= 60).id, contact: { name: "Test customer", phone: "+14155550101" } }) });
  assert.equal(booking.status, 202);
  await waitFor(async () => { const view = await (await fetch(`${base}/api/tasks/${task.id}`, { headers })).json(); return view.stage === "confirmed" && view; });
  await stop(); await start();
  const restored = await (await fetch(`${base}/api/tasks/${task.id}`, { headers })).json();
  assert.equal(restored.stage, "confirmed"); assert.equal(restored.bookingAccepted, true);
  assert.equal(restored.calls.filter(c => c.purpose === "booking").length, 1);
});
