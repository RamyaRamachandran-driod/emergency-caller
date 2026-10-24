// Manual paid OpenAI audio check. Uses a fake telephone socket and never dials a phone.
import dotenv from "dotenv";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import WebSocket, { WebSocketServer } from "ws";
import { bridge } from "../services/voice/src/bridge.js";
import { Store } from "../services/voice/src/store.js";
import { PcmResampler } from "../services/voice/src/media.js";
import { configFromEnv } from "../services/voice/src/config.js";

dotenv.config({ quiet: true });
const config = configFromEnv({ ...process.env, VOICE_PROVIDER: "vonage" });
async function speech(text: string) {
  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST", headers: { authorization: `Bearer ${config.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ model: "gpt-4o-mini-tts", voice: "ash", input: text, response_format: "pcm" }), signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) throw Error(`Speech fixture failed: HTTP ${response.status}`);
  return new PcmResampler(24000, 16000).push(Buffer.from(await response.arrayBuffer()));
}
const acknowledgement = process.argv.includes("--ack");
const pricing = process.argv.includes("--pricing");
const interrupt = await speech(pricing ? "Yes, I can fix that bathroom leak at 1550 Mission Street. I can be there in fifteen minutes." : acknowledgement ? "Uh-huh." : "Wait, is the leak in the bathroom or the kitchen?");
const dir = mkdtempSync(join(tmpdir(), "savior-conversation-smoke-"));
const store = new Store(dir), record = store.create({ taskId: randomUUID(), callId: randomUUID(), purpose: "quote", selectedOffer: null,
  input: { request: "My bathroom pipe is leaking badly. I need a plumber.", location: "1550 Mission Street, San Francisco", timezone: "America/Los_Angeles", maxArrivalMinutes: 60 },
  business: { id: "audio-test", name: "Test plumber", phone: "+14155550101", sourceUrl: null, openingStatus: "unknown", checkedAt: new Date().toISOString() },
}, true, false, "vonage");
const server = new WebSocketServer({ port: 0, host: "127.0.0.1" });
await once(server, "listening");
let controller: ReturnType<typeof bridge> | undefined;
let failure: string | undefined;
const wire: string[] = [];
let speechStoppedAt = 0, replyStartedAt = 0, firstReplyAudioAt = 0;
server.on("connection", ws => {
  controller = bridge(ws, record, store, config, async reason => { failure = reason; }, () => {
    const ai = new WebSocket(`wss://api.openai.com/v1/realtime?model=${encodeURIComponent(config.model)}`, { headers: { Authorization: `Bearer ${config.apiKey}` } });
    ai.on("message", raw => { const m = JSON.parse(raw.toString()); if (m.type === "input_audio_buffer.speech_stopped") speechStoppedAt = Date.now(); if (m.type === "response.created" && speechStoppedAt) replyStartedAt = Date.now(); if (m.type === "response.output_audio.delta" && replyStartedAt && !firstReplyAudioAt) firstReplyAudioAt = Date.now(); if (["input_audio_buffer.speech_started", "input_audio_buffer.speech_stopped", "response.created"].includes(m.type)) wire.push(m.type); });
    return ai;
  });
});
const caller = new WebSocket(`ws://127.0.0.1:${(server.address() as { port: number }).port}`);
let injected = false;
let injection: Promise<void> | undefined;
const playback: ({ mark: string } | Buffer)[] = [];
const tick = setInterval(() => {
  while (playback.length && !Buffer.isBuffer(playback[0])) {
    const item = playback.shift() as { mark: string };
    if (caller.readyState === WebSocket.OPEN) caller.send(JSON.stringify({ event: "websocket:notify", payload: item }));
  }
  if (Buffer.isBuffer(playback[0])) playback.shift();
}, 20);
caller.on("message", (raw, binary) => {
  if (binary) {
    playback.push(Buffer.from(raw as Buffer));
    if (!injected) {
      injected = true;
      injection = (async () => {
        await new Promise(r => setTimeout(r, 350));
        for (let offset = 0; offset < interrupt.length + 32000; offset += 640) {
          if (caller.readyState !== WebSocket.OPEN) return;
          const frame = Buffer.alloc(640); if (offset < interrupt.length) interrupt.copy(frame, 0, offset, Math.min(offset + 640, interrupt.length));
          caller.send(frame); await new Promise(r => setTimeout(r, 20));
        }
      })();
    }
  } else {
    const m = JSON.parse(raw.toString());
    if (m.action === "notify") playback.push(m.payload);
    if (m.action === "clear") playback.length = 0;
  }
});
try {
  await once(caller, "open");
  caller.send(JSON.stringify({ event: "websocket:connected", "content-type": "audio/l16;rate=16000", callId: record.request.callId }));
  const deadline = Date.now() + 40000;
  while (Date.now() < deadline) {
    if (failure) throw Error(failure);
    const business = record.events.find(e => e.type === "transcript" && e.speaker === "business");
    if (business && record.events.some(e => e.type === "transcript" && e.speaker === "agent" && e.sequence > business.sequence)) break;
    await new Promise(r => setTimeout(r, 100));
  }
  const transcript = record.events.filter(e => e.type === "transcript");
  console.log(JSON.stringify({ wire, speechEndToReplyAudioMs: firstReplyAudioAt && speechStoppedAt ? firstReplyAudioAt - speechStoppedAt : null, transcript: transcript.map(e => ({ speaker: e.speaker, text: e.text })) }));
  const business = transcript.find(e => e.speaker === "business");
  assert.ok(business, "the synthesized interruption must be transcribed");
  const reply = transcript.find(e => e.speaker === "agent" && e.sequence > business.sequence);
  assert.ok(reply, "the caller must answer the interruption");
  if (pricing) assert.match(reply.text, /cost|price|fee|charge|quote|estimate|how much/i, "availability and ETA alone must lead to a pricing question");
  else if (!acknowledgement) assert.match(reply.text, /bathroom/i);
  assert.doesNotMatch(reply.text, /(?:how soon|when).*(?:cost|price|fee)|(?:cost|price).*(?:how soon|when)/i, "do not combine timing and pricing requirements in one turn");
  assert.doesNotMatch(reply.text, /hello|this is Savior|calling on behalf/i);
  assert.ok(reply.text.split(/\s+/).length <= 40, "interruption reply must be brief");
  console.log(pricing ? "PASS: availability and ETA without price prompted a pricing question." : "PASS: real audio interruption received a brief contextual reply without restarting the introduction.");
} finally {
  clearInterval(tick); controller?.close(); caller.terminate();
  await injection;
  await new Promise<void>(resolve => server.close(() => resolve()));
  rmSync(dir, { recursive: true, force: true });
}
