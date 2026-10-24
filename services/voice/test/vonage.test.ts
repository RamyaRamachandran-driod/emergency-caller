import { API_CONTRACT_VERSION } from "@emergency/shared";
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash, createPublicKey, generateKeyPairSync, randomUUID } from "node:crypto";
import { once } from "node:events";
import WebSocket, { WebSocketServer } from "ws";
import { SignJWT, jwtVerify } from "jose";
import { configFromEnv, missingConfig } from "../src/config.js";
import { applicationJwt, verifyVonageWebhook, vonageRequest } from "../src/vonage.js";
import { vonageCallBody, twilioCallBody, type DialPlan } from "../src/providers.js";
import { PcmResampler } from "../src/media.js";
import { Store, type Request } from "../src/store.js";
import { bridge } from "../src/bridge.js";
process.env.INTERNAL_SERVICE_TOKEN = "vonage-test-token";
const { createVoiceService } = await import("../src/service.js");
const root = mkdtempSync(join(tmpdir(), "savior-vonage-tests-"));
const keys = generateKeyPairSync("rsa", { modulusLength: 2048, privateKeyEncoding: { type: "pkcs8", format: "pem" }, publicKeyEncoding: { type: "spki", format: "pem" } });
const keyPath = join(root, "test.key"); writeFileSync(keyPath, keys.privateKey, { mode: 0o600 });
after(() => rmSync(root, { recursive: true, force: true }));
const config = () => ({ ...configFromEnv({ VOICE_PROVIDER: "vonage", VOICE_MODE: "live", VONAGE_API_KEY: "test-api-key", VONAGE_SIGNATURE_SECRET: "test-signature-secret", VONAGE_APPLICATION_ID: "abcf8140-37b0-4e7c-b24a-5590061c5416", VONAGE_PRIVATE_KEY_PATH: keyPath, OPENAI_API_KEY: "test-openai-key", PUBLIC_VOICE_URL: "https://example.test", VOICE_ALLOWED_NUMBERS: "+16692121418", VOICE_DATA_DIR: mkdtempSync(join(root, "calls-")) }), port: 0, providerPort: 0 });
const request = (): Request => ({ taskId: randomUUID(), callId: randomUUID(), purpose: "quote", selectedOffer: null, input: { request: "Car won't start", location: "Test Street", timezone: "America/Los_Angeles", maxArrivalMinutes: 30 }, business: { id: "team", name: "Test phone", phone: "+16692121418", sourceUrl: null, openingStatus: "unknown", checkedAt: new Date().toISOString() } });
const pause = (ms = 20) => new Promise(resolve => setTimeout(resolve, ms));
async function until(fn: () => boolean) { const end = Date.now() + 4000; while (!fn()) { if (Date.now() > end) throw Error("Condition timeout"); await pause(); } }
function origin(server: { address(): any }) { return `http://127.0.0.1:${server.address().port}`; }
async function signature(c: ReturnType<typeof config>, body: Buffer, claims: object = {}, issued = Math.floor(Date.now() / 1000)) {
  return new SignJWT({ api_key: c.vonageApiKey, application_id: c.vonageApplicationId, payload_hash: createHash("sha256").update(body).digest("hex"), ...claims }).setProtectedHeader({ alg: "HS256" }).setIssuer("Vonage").setIssuedAt(issued).setJti(randomUUID()).sign(new TextEncoder().encode(c.vonageSignatureSecret));
}
async function harness(t: test.TestContext, options: { missingAi?: boolean; missingSignature?: boolean } = {}) {
  const c = config(); if (options.missingAi) { c.apiKey = ""; c.publicUrl = ""; } if (options.missingSignature) c.vonageSignatureSecret = "";
  const dialed: DialPlan[] = [], hung: string[] = []; let status = "started";
  const service = createVoiceService(c, { dial: async plan => { dialed.push(plan); return { sid: "ac3727f0-8a77-4d80-bbb8-2a00580c6fa8" }; }, hangup: async sid => { hung.push(sid); }, status: async () => ({ status }) });
  await service.listen(); t.after(() => service.close());
  const api = (path: string, body?: object) => fetch(`${origin(service.internalServer)}${path}`, { method: body ? "POST" : "GET", headers: { "x-emergency-contract-version": API_CONTRACT_VERSION, authorization: "Bearer vonage-test-token", "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  return { c, service, api, dialed, hung, setStatus: (value: string) => status = value };
}
test("Vonage readiness uses application credentials; probe needs no OpenAI key or tunnel", () => {
  const c = config(); assert.equal(c.from, "123456789"); assert.deepEqual(missingConfig(c), []);
  c.apiKey = ""; c.publicUrl = ""; c.vonageSignatureSecret = "";
  assert.deepEqual(missingConfig(c, { probe: true }), []);
  assert.ok(missingConfig(c).includes("OPENAI_API_KEY")); assert.ok(missingConfig(c).includes("VONAGE_SIGNATURE_SECRET"));
});
test("application JWT is RS256 and identifies the configured application", async () => {
  const c = config(), token = await applicationJwt(c);
  const { payload } = await jwtVerify(token, createPublicKey(keys.publicKey), { algorithms: ["RS256"] });
  assert.equal(payload.application_id, c.vonageApplicationId); assert.ok(payload.jti); assert.ok(payload.exp! - payload.iat! <= 300);
});
test("signed webhooks reject body tampering, wrong account and stale tokens", async () => {
  const c = config(), body = Buffer.from('{"status":"completed"}');
  assert.equal(await verifyVonageWebhook(c, `Bearer ${await signature(c, body)}`, body), true);
  assert.equal(await verifyVonageWebhook(c, `Bearer ${await signature(c, body)}`, Buffer.from("{}")), false);
  assert.equal(await verifyVonageWebhook(c, `Bearer ${await signature(c, body, { api_key: "other" })}`, body), false);
  assert.equal(await verifyVonageWebhook(c, `Bearer ${await signature(c, body, {}, Math.floor(Date.now()/1000)-600)}`, body), false);
  assert.equal(await verifyVonageWebhook(c, "", body), false);
});
const plan: DialPlan = { to: "+16692121418", from: "123456789", callId: "test-call", token: "test-token", mediaUrl: "wss://example.test/vonage/media/test-call", eventUrl: "https://example.test/vonage/events/test-call", maxSeconds: 180, probe: false };
test("Vonage call uses trial caller ID, authenticated media NCCO and bounded duration", () => {
  const body = vonageCallBody(plan);
  assert.equal(body.from.number, "123456789"); assert.equal(body.to[0].number, "16692121418"); assert.equal(body.length_timer, 180);
  const endpoint = (body.ncco[0] as any).endpoint[0];
  assert.equal(endpoint["content-type"], "audio/l16;rate=16000"); assert.deepEqual(endpoint.authorization, { type: "custom", value: "Bearer test-token" });
  const probe = vonageCallBody({ ...plan, eventUrl: "", probe: true }); assert.equal(probe.ncco[0].action, "talk"); assert.equal(probe.event_url, undefined);
  assert.match(twilioCallBody({ ...plan, from: "+14155550100" }).twiml, /<Connect><Stream/);
});
test("provider request signs call API requests and reports safe errors", async () => {
  const c = config(); let authorization = "";
  const result = await vonageRequest(c, "", "POST", vonageCallBody(plan), async (url, options) => { assert.equal(url, "https://api.nexmo.com/v1/calls"); authorization = (options!.headers as any).authorization; return new Response(JSON.stringify({ uuid: "call-uuid" }), { status: 201 }); });
  assert.equal(result.uuid, "call-uuid"); assert.match(authorization, /^Bearer /);
  await assert.rejects(vonageRequest(c, "", "POST", {}, async () => new Response(JSON.stringify({ type: "https://developer.vonage.com/api-errors/voice/invalid-from" }), { status: 403 })), /HTTP 403, invalid-from/);
});
test("streaming resampling is independent of packet boundaries and preserves sample rate", () => {
  const input = Buffer.alloc(640); for (let i = 0; i < 320; i++) input.writeInt16LE(Math.round(Math.sin(i/10)*10000), i*2);
  const whole = new PcmResampler(16000,24000).push(input), split = new PcmResampler(16000,24000);
  const chunks = [input.subarray(0,100), input.subarray(100,346), input.subarray(346)].map(b => split.push(b));
  assert.deepEqual(Buffer.concat(chunks), whole); assert.ok(Math.abs(whole.length - 960) <= 4);
  const down = new PcmResampler(24000,16000).push(whole); assert.ok(Math.abs(down.length - 640) <= 6);
});
test("connection probe dials without AI credentials and polls through completion", async t => {
  const h = await harness(t, { missingAi: true, missingSignature: true }), r = request();
  assert.equal((await h.api("/dev/calls", r)).status, 503);
  assert.equal((await h.api("/dev/probe", r)).status, 202);
  assert.equal(h.dialed.length, 1); assert.equal(h.dialed[0].probe, true); assert.equal(h.dialed[0].maxSeconds, 30);
  h.setStatus("completed"); await h.service.drain();
  assert.equal(h.service.store.records.get(r.callId)?.status, "completed"); assert.equal(h.hung.length, 0);
  await h.api("/dev/probe", r); assert.equal(h.dialed.length, 1);
});
test("Vonage event handler validates signatures, body integrity and telephone leg UUID", async t => {
  const h = await harness(t), r = request(); await h.api("/dev/calls", r);
  const record = h.service.store.records.get(r.callId)!;
  const path = `/vonage/events/${r.callId}/${record.token}`;
  const body = Buffer.from(JSON.stringify({ uuid: record.sid, status: "busy", to: "16692121418", direction: "outbound" }));
  const send = (token: string, data = body) => fetch(`${origin(h.service.providerServer)}${path}`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: data });
  assert.equal((await send("forged")).status, 403);
  assert.equal((await send(await signature(h.c, body), Buffer.from("{}"))).status, 403);
  const otherLeg = Buffer.from(JSON.stringify({ uuid: randomUUID(), status: "completed" }));
  assert.equal((await send(await signature(h.c, otherLeg), otherLeg)).status, 204);
  assert.equal(record.status, "dialing");
  assert.equal((await send(await signature(h.c, body))).status, 204); assert.equal(record.status, "failed");
});
test("Vonage media upgrade requires the exact per-call authorization header", async t => {
  const h = await harness(t), r = request(); await h.api("/dev/calls", r); const record = h.service.store.records.get(r.callId)!;
  const path = `/vonage/media/${r.callId}/${record.token}`;
  const url = `${origin(h.service.providerServer).replace("http:","ws:")}${path}`;
  const bad = new WebSocket(url); bad.on("error", () => {});
  const [, response] = await once(bad, "unexpected-response"); assert.equal(response.statusCode,403); bad.terminate();
  const good = new WebSocket(url, { headers: { authorization: `Bearer ${record.token}` } }); good.on("error", () => {}); await once(good,"open"); t.after(() => good.terminate());
  assert.equal(good.readyState, WebSocket.OPEN);
});
test("Vonage bridge relays binary PCM both ways, flushes the tail and clears interrupted audio", async t => {
  const c = config(), store = new Store(c.dataDir), r = store.create(request(), true, false, "vonage"); r.sid = randomUUID();
  const carrier = new WebSocketServer({port:0,host:"127.0.0.1"}), aiServer = new WebSocketServer({port:0,host:"127.0.0.1"});
  await Promise.all([once(carrier,"listening"),once(aiServer,"listening")]);
  let peer: WebSocket | undefined; const events: any[] = [], frames: Buffer[] = [], controls: any[] = [];
  aiServer.on("connection", ws => { peer=ws; ws.on("message", raw => events.push(JSON.parse(raw.toString()))); });
  let controller: ReturnType<typeof bridge> | undefined;
  carrier.on("connection", ws => { controller = bridge(ws,r,store,c,async()=>{},()=>new WebSocket(origin(aiServer).replace("http:","ws:"))); });
  const caller = new WebSocket(origin(carrier).replace("http:","ws:")); caller.on("message", (raw,binary) => { if(binary) frames.push(Buffer.from(raw as Buffer)); else controls.push(JSON.parse(raw.toString())); });
  await once(caller,"open");
  t.after(() => { controller?.close(); caller.terminate(); peer?.terminate(); carrier.close(); aiServer.close(); });
  caller.send(JSON.stringify({event:"websocket:connected","content-type":"audio/l16;rate=16000",callId:r.request.callId}));
  await until(()=>events.some(e=>e.type==="session.update")); assert.deepEqual(events[0].session.audio.input.format,{type:"audio/pcm",rate:24000});
  peer!.send(JSON.stringify({type:"session.updated"})); caller.send(Buffer.alloc(640));
  await until(()=>events.some(e=>e.type==="input_audio_buffer.append"));
  const input=events.find(e=>e.type==="input_audio_buffer.append"); assert.ok(Buffer.from(input.audio,"base64").length>=956);
  peer!.send(JSON.stringify({type:"response.created",response:{id:"response-1"}}));
  peer!.send(JSON.stringify({type:"response.output_audio.delta",response_id:"response-1",item_id:"item-1",delta:Buffer.alloc(1920).toString("base64")}));
  peer!.send(JSON.stringify({type:"response.output_audio.done"}));
  await until(()=>frames.length>=2); assert.ok(frames.every(b=>b.length===640));
  assert.ok(controls.some(e=>e.action==="notify"));
  peer!.send(JSON.stringify({type:"input_audio_buffer.speech_started"})); await until(()=>controls.some(e=>e.action==="clear"));
  assert.ok(events.some(e=>e.type==="conversation.item.truncate"));
});
