import { saveBooking } from "./booking.js";
import express, { type Request as HttpRequest } from "express";
import { createServer } from "node:http";
import { mkdirSync, writeFileSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { WebSocketServer } from "ws";
import twilio from "twilio";
import { CallRequest } from "@emergency/shared";
import { appFor, internal, errors, post } from "@emergency/server-kit";
import { configFromEnv, missingConfig, Phone } from "./config.js";
import { Store, type Record } from "./store.js";
import { makeProvider, type Provider } from "./providers.js";
import { equalSecret, ProviderError, verifyVonageWebhook } from "./vonage.js";
import { bridge } from "./bridge.js";
import { extractTranscriptQuote, saveQuote } from "./quote.js";
import { simulate } from "./simulate.js";

export function createVoiceService(config = configFromEnv(process.env), provider?: Provider) {
  const store = new Store(config.dataDir);
  const providers = new Map<string, Provider>();
  function phoneFor(r?: Record) {
    if (provider) return provider;
    const name = r?.provider || (r ? "twilio" : config.provider);
    if (!providers.has(name)) providers.set(name, makeProvider(config, name));
    return providers.get(name)!;
  }
  const active = new Map<string, ReturnType<typeof bridge>>();
  const dialing = new Set<Promise<unknown>>();
  const limits = new Map<string, ReturnType<typeof setTimeout>>();
  const hanging = new Set<string>();
  const finishLocks = new Map<string, Promise<void>>();
  let closing = false;
  async function hangup(r: Record) {
    if (!config.live || !r.live || !r.sid || r.providerEnded || hanging.has(r.request.callId)) return;
    hanging.add(r.request.callId);
    try { await phoneFor(r).hangup(r.sid); r.providerEnded = true; store.save(r); }
    catch { console.error(`Could not hang up call ${r.request.callId}; will retry`); }
    finally { hanging.delete(r.request.callId); }
  }
  async function finish(r: Record, reason: string, failed = false) {
    const id = r.request.callId;
    const existing = finishLocks.get(id); if (existing) return existing;
    const work = (async () => {
      clearTimeout(limits.get(id)); limits.delete(id);
      active.get(id)?.close(); active.delete(id);
      if (!store.terminal(r) || (failed && (r.status === "completed" || r.reason !== reason))) {
        r.reason = reason;
        store.emit(r, { type: "status", status: failed ? "failed" : "completed", reason });
      }
      await hangup(r);
    })();
    finishLocks.set(id, work);
    try { await work; } finally { finishLocks.delete(id); }
  }
  async function providerStatus(r: Record, status: string, event: { detail?: unknown; sip_code?: unknown } = {}, source = "poll") {
    const safe = (value: unknown) => typeof value === "string" && /^[a-zA-Z0-9_ .:-]{1,160}$/.test(value) ? value : undefined;
    const detail = safe(event.detail), sipCode = safe(String(event.sip_code || ""));
    const previous = r.providerEvents?.at(-1);
    if (!previous || previous.status !== status || previous.detail !== detail || previous.sipCode !== sipCode || previous.source !== source) {
      r.providerEvents = [...(r.providerEvents || []), { status, detail, sipCode, source }].slice(-50); store.save(r);
    }
    if (r.status === "failed" && status === "completed") return;
    if (["completed", "busy", "unanswered", "timeout", "failed", "rejected", "cancelled"].includes(status)) {
      r.providerEnded = true; store.save(r);
      const connection = active.get(r.request.callId);
      if (status === "completed" && connection) connection.remoteEnd(`Vonage: ${status}`);
      else {
        const connected = r.events.some(e => e.type === "status" && e.status === "connected");
        await finish(r, `Vonage: ${status}${detail ? ` (${detail})` : ""}${sipCode ? ` SIP ${sipCode}` : ""}${status === "completed" && !connected ? "; ended without a verified connection" : ""}`, status !== "completed" || !connected);
      }
    } else if (r.probe && status === "answered" && r.status === "dialing") store.emit(r, { type: "status", status: "connected" });
  }
  const polled = new Map<string, number>();
  let started = false;
  let draining = false;
  const retries = new Map<string, { at: number; delay: number }>();
  async function drain() {
    if (draining || closing || !started) return;
    draining = true;
    try {
      await Promise.all([...store.records.values()].map(async r => {
        if (r.live && r.provider === "vonage" && r.sid && !store.terminal(r) && Date.now() - (polled.get(r.request.callId) || 0) >= 2000) {
          polled.set(r.request.callId, Date.now());
          try { const state = await phoneFor(r).status?.(r.sid); if (state) await providerStatus(r, state.status); } catch { /* Keep the watchdog active if polling temporarily fails. */ }
        }
        if (r.live && store.terminal(r) && !r.providerEnded) await hangup(r);
        const id = r.request.callId;
        if (!r.outbox.length || Date.now() < (retries.get(id)?.at ?? 0)) return;
        // Preserve event IDs and per-call ordering through retries and restarts.
        for (let n = 0; n < 20 && r.outbox.length && !closing; n++) {
          try {
            await post(`${process.env.ORCHESTRATOR_URL ?? "http://localhost:4100"}/internal/events`, r.outbox[0]);
            r.outbox.shift(); store.save(r); retries.delete(id);
          } catch {
            const delay = Math.min((retries.get(id)?.delay ?? 500) * 2, 30000);
            retries.set(id, { at: Date.now() + delay, delay }); break;
          }
        }
      }));
    } finally { draining = false; }
  }
  const worker = setInterval(() => void drain(), 1000); worker.unref();
  const app = appFor("voice", () => ({ mode: config.live ? "live" : "test", testNumber: config.testNumber, provider: config.provider, destinationPolicy: config.destinationPolicy, liveReady: config.live && missingConfig(config).length === 0 }));
  app.get("/setup", internal, (_req, res) => res.json({ provider: config.provider, mode: config.live ? "live" : "test", liveReady: missingConfig(config).length === 0, missing: missingConfig(config), probeReady: missingConfig(config, { probe: true }).length === 0, probeMissing: missingConfig(config, { probe: true }), providerPort: config.providerPort, activeCalls: [...store.records.values()].filter(r => !store.terminal(r)).length }));
  function accept(callback: boolean, probe = false) {
    return async (req: HttpRequest, res: express.Response) => {
      const request = CallRequest.parse(req.body);
      const old = store.records.get(request.callId);
      if (old) {
        if (old.fingerprint !== JSON.stringify(request) || old.callback !== callback || !!old.probe !== probe) { res.status(409).json({ error: "callId already belongs to a different request" }); return; }
        res.status(202).json(store.public(old)); return;
      }
      if (!started || closing) { res.status(503).json({ error: "Voice service is shutting down" }); return; }
      if (request.purpose === "booking" && !request.selectedOffer) { res.status(400).json({ error: "Booking requires selectedOffer" }); return; }
      if (probe && config.provider !== "vonage") { res.status(409).json({ error: "Select VOICE_PROVIDER=vonage for the connection probe" }); return; }
      if (config.live) {
        if (config.testNumber && request.business.phone !== config.testNumber) { res.status(403).json({ error: "Personal-phone test mode blocks every other destination" }); return; }
        const missing = missingConfig(config, { probe });
        if (missing.length) { res.status(503).json({ error: "Voice setup incomplete", missing }); return; }
        if (request.purpose === "booking") {
          const a = request.approval, offer = request.selectedOffer;
          if (!callback || probe || !a || a.callId !== request.callId || !offer ||
            JSON.stringify(a.offer) !== JSON.stringify(offer) || offer.businessId !== request.business.id ||
            !offer.availableNow || offer.amountMinor === null || !offer.currency || offer.quoteType === "unknown" ||
            offer.etaMinutes === null || offer.etaMinutes > request.input.maxArrivalMinutes) {
            res.status(409).json({ error: "Live booking requires a matching durable customer approval, priced offer, arrival time and dispatch contact." }); return;
          }
        }
        let sourced = false;
        try {
          const url = new URL(request.business.sourceUrl || "");
          sourced = callback && !probe && config.destinationPolicy === "sourced" && ["https:", "http:"].includes(url.protocol) && !url.username && !url.password && request.business.openingStatus !== "closed";
        } catch { /* Unpublished numbers require the explicit allowlist. */ }
        if (!Phone.safeParse(request.business.phone).success || (!config.allowedNumbers.includes(request.business.phone) && !sourced)) { res.status(403).json({ error: "Destination requires VOICE_ALLOWED_NUMBERS or sourced discovery calling enabled" }); return; }
        if ([...store.records.values()].filter(r => r.live && !store.terminal(r)).length >= config.maxConcurrent) { res.status(429).json({ error: "Voice call capacity reached" }); return; }
      }
      const r = store.create(request, config.live, callback, config.provider, probe);
      store.emit(r, { type: "status", status: "dialing" });
      res.status(202).json(store.public(r));
      if (!config.live) { void simulate(r, store).catch(() => finish(r, "Simulation failed", true)); return; }
      // Persist before calling the provider; a repeated callId can never redial.
      limits.set(request.callId, setTimeout(() => void finish(r, "Maximum call duration reached", true), (config.maxSeconds + 45) * 1000));
      const dial = (async () => {
        const result = await phoneFor(r).dial({ to: request.business.phone, from: config.from,
          callId: request.callId, token: r.token, probe, maxSeconds: probe ? 30 : config.maxSeconds,
          mediaUrl: `${config.publicUrl.replace(/^https:/, "wss:")}/${config.provider}/media/${request.callId}/${r.token}`,
          eventUrl: config.provider === "vonage" ? (config.publicUrl && config.vonageSignatureSecret ? `${config.publicUrl}/vonage/events/${request.callId}/${r.token}` : "") : `${config.publicUrl}/twilio/status/${request.callId}` });
        if (r.sid && r.sid !== result.sid) throw Error("Provider call ID mismatch");
        r.sid = result.sid; store.save(r);
        if (store.terminal(r)) await hangup(r);
      })().catch(error => finish(r, error instanceof ProviderError ? error.message : `${config.provider} could not start the call; check account credentials and provider logs`, true));
      dialing.add(dial);
      void dial.finally(() => dialing.delete(dial));
    };
  }
  app.post("/calls", internal, accept(true));
  app.post("/dev/calls", internal, accept(false));
  app.post("/dev/probe", internal, accept(false, true));
  app.get("/calls/:id", internal, (req, res) => { const r = store.records.get(String(req.params.id)); if (!r) { res.status(404).json({ error: "Unknown call" }); return; } res.json(store.public(r)); });
  const recoveringQuotes = new Set<string>();
  app.post("/calls/:id/recover-quote", internal, async (req, res) => {
    const r = store.records.get(String(req.params.id));
    if (!r) { res.status(404).json({ error: "Unknown call" }); return; }
    if (!store.terminal(r) || !r.live || r.request.purpose !== "quote") { res.status(409).json({ error: "Only ended live quote calls can be reviewed" }); return; }
    if (r.events.some(e => e.type === "offer")) { res.json(store.public(r)); return; }
    if (recoveringQuotes.has(r.request.callId)) { res.status(409).json({ error: "Quote review is already running" }); return; }
    recoveringQuotes.add(r.request.callId);
    try { saveQuote(r, store, await extractTranscriptQuote(r, config)); await drain(); res.json(store.public(r)); }
    catch { res.status(422).json({ error: "The finalized transcript could not support a validated quote" }); }
    finally { recoveringQuotes.delete(r.request.callId); }
  });
  // Internal transcript review only: never starts or retries a telephone call.
  app.post("/calls/:id/recover-booking", internal, async (req, res) => {
    const r = store.records.get(String(req.params.id));
    if (!r) { res.status(404).json({ error: "Unknown call" }); return; }
    if (!store.terminal(r) || !r.live || r.request.purpose !== "booking" || !r.request.approval) { res.status(409).json({ error: "Only ended, approved live booking calls can be reviewed" }); return; }
    if (!r.events.some(e => e.type === "booking_result")) {
      try { saveBooking(r, store, req.body); }
      catch { res.status(422).json({ error: "The finalized transcript could not support this booking outcome" }); return; }
    }
    if (r.status !== "completed") {
      r.reason = "Booking outcome recovered from finalized transcript; no new call placed";
      store.emit(r, { type: "status", status: "completed", reason: r.reason });
    }
    await drain();
    res.json(store.public(r));
  });
  app.post("/calls/:id/stop", internal, async (req, res) => { const r = store.records.get(String(req.params.id)); if (!r) { res.status(404).json({ error: "Unknown call" }); return; } await finish(r, "Stopped by user", true); res.json(store.public(r)); });
  errors(app);
  const internalServer = createServer(app);
  // Only this restricted server is exposed through a tunnel. No internal APIs, health, or transcripts.
  const hooks = express();
  hooks.disable("x-powered-by");
  hooks.use(express.urlencoded({ extended: false, limit: "16kb" }));
  hooks.post("/twilio/status/:id", (req, res) => {
    const signature = req.header("x-twilio-signature") ?? "";
    if (!config.live || config.provider !== "twilio" || !req.is("application/x-www-form-urlencoded") || !req.body || !twilio.validateRequest(config.authToken, signature, `${config.publicUrl}${req.originalUrl}`, req.body)) { res.sendStatus(403); return; }
    const r = store.records.get(String(req.params.id));
    if (!r || req.body.AccountSid !== config.accountSid || req.body.To !== r.request.business.phone || req.body.From !== config.from || (r.sid && req.body.CallSid !== r.sid)) { res.sendStatus(404); return; }
    if (!/^CA[a-f\d]{32}$/i.test(req.body.CallSid ?? "")) { res.sendStatus(400); return; }
    r.sid = req.body.CallSid;
    const status = req.body.CallStatus;
    if (["completed", "busy", "no-answer", "failed", "canceled"].includes(status)) {
      r.providerEnded = true; store.save(r);
      const connection = active.get(r.request.callId);
      if (status === "completed" && connection) connection.remoteEnd(`Twilio: ${status}`);
      else void finish(r, `Twilio: ${status}`, status !== "completed");
    } else store.save(r);
    res.sendStatus(204);
  });
  hooks.post("/vonage/events/:id/:token", express.raw({ type: "application/json", limit: "16kb" }), async (req, res) => {
    if (!config.live || config.provider !== "vonage" || !Buffer.isBuffer(req.body) || !(await verifyVonageWebhook(config, req.header("authorization") || "", req.body))) { res.sendStatus(403); return; }
    const r = store.records.get(String(req.params.id));
    if (!r || r.provider !== "vonage" || !equalSecret(r.token, String(req.params.token))) { res.sendStatus(404); return; }
    try {
      const event = JSON.parse(req.body.toString());
      // Ignore the NCCO WebSocket leg's events; only the original telephone leg owns call status.
      if (typeof event.uuid !== "string" || !/^[a-f\d-]{32,36}$/i.test(event.uuid)) { res.sendStatus(400); return; }
      if (r.sid && r.sid !== event.uuid) { res.sendStatus(204); return; }
      if (!r.sid && (String(event.to).replace(/^\+/, "") !== r.request.business.phone.slice(1) || event.direction !== "outbound")) { res.sendStatus(204); return; }
      r.sid = event.uuid; store.save(r);
      await providerStatus(r, event.status, event, "callback");
      res.sendStatus(204);
    } catch { res.sendStatus(400); }
  });
  hooks.use((_req, res) => res.sendStatus(404));
  const providerServer = createServer(hooks);
  const ws = new WebSocketServer({ noServer: true, maxPayload: 128 * 1024 });
  providerServer.on("upgrade", (req, socket, head) => {
    const match = /^\/(twilio|vonage)\/media\/([a-f\d-]{36})\/([a-f\d-]{36})$/.exec(req.url ?? "");
    const r = match ? store.records.get(match[2]) : undefined;
    const url = `${config.publicUrl}${req.url}`;
    let valid = false;
    if (match?.[1] === "vonage" && r?.provider === "vonage") valid = equalSecret(String(req.headers.authorization || ""), `Bearer ${r.token}`);
    else if (match?.[1] === "twilio" && config.authToken) {
      const signature = String(req.headers["x-twilio-signature"] || "");
      valid = twilio.validateRequest(config.authToken, signature, url, {}) || twilio.validateRequest(config.authToken, signature, `${url}/`, {});
    }
    if (!config.live || !r || r.probe || match?.[1] !== config.provider || !valid || !equalSecret(r.token, match?.[3] || "") || store.terminal(r) || active.has(r.request.callId)) { socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n"); socket.destroy(); return; }
    ws.handleUpgrade(req, socket, head, connection => {
      active.set(r.request.callId, bridge(connection, r, store, config, (reason, failed) => finish(r, reason, failed)));
    });
  });
  let ownsLock = false;
  const lockPath = join(config.dataDir, ".process.lock");
  async function listen() {
    mkdirSync(config.dataDir, { recursive: true, mode: 0o700 });
    try { writeFileSync(lockPath, String(process.pid), { flag: "wx", mode: 0o600 }); ownsLock = true; }
    catch {
      const pid = Number(readFileSync(lockPath, "utf8"));
      if (!Number.isInteger(pid) || pid <= 0) throw Error("Invalid voice process lock; inspect data directory");
      let running = true;
      try { process.kill(pid, 0); } catch (e) { if ((e as NodeJS.ErrnoException).code === "ESRCH") running = false; }
      if (running) throw Error("Another voice process owns this data directory");
      unlinkSync(lockPath);
      writeFileSync(lockPath, String(process.pid), { flag: "wx", mode: 0o600 }); ownsLock = true;
    }
    const bind = (server: typeof internalServer, port: number) => new Promise<void>((resolve, reject) => { server.once("error", reject); server.listen(port, "127.0.0.1", () => { server.off("error", reject); resolve(); }); });
    try { await bind(internalServer, config.port); await bind(providerServer, config.providerPort); }
    catch (error) { internalServer.close(); if (ownsLock) { unlinkSync(lockPath); ownsLock = false; } clearInterval(worker); throw error; }
    store.records = new Store(config.dataDir).records;
  // Never redial after a crash. Reconcile and hang up previous telephone legs instead.
  for (const r of store.records.values()) {
    // Repair old polling/callback races without ever redialing an ended call.
    const failure = [...(r.providerEvents || [])].reverse().find(e => ["failed", "rejected", "busy", "unanswered", "timeout"].includes(e.status));
    if (r.status === "completed" && failure && !r.events.some(e => e.type === "status" && e.status === "connected")) {
      await providerStatus(r, failure.status, { detail: failure.detail, sip_code: failure.sipCode }, "recovery");
    }
    if (!store.terminal(r)) {
      r.reason = "Voice process restarted; call interrupted and not redialed";
      store.emit(r, { type: "status", status: "failed" });
    }
  }
    started = true;
  }
  async function close() {
    closing = true; clearInterval(worker);
    for (const timer of limits.values()) clearTimeout(timer);
    limits.clear();
    await Promise.all([...store.records.values()].filter(r => !store.terminal(r)).map(r => finish(r, "Voice service shutting down", true)));
    await Promise.all([...dialing]);
    while (draining) await new Promise(resolve => setTimeout(resolve, 25));
    ws.close();
    if (ownsLock) { unlinkSync(lockPath); ownsLock = false; }
    await Promise.all([internalServer, providerServer].map(s => new Promise<void>(resolve => { if (!s.listening) { resolve(); return; } s.close(() => resolve()); s.closeIdleConnections(); })));
  }
  return { listen, close, store, config, internalServer, providerServer, drain };
}
