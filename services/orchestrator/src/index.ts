import { randomUUID } from "node:crypto";
import {
  TaskInput,
  DiscoveryResult,
  CallEvent,
  type Task,
  type Call,
} from "@emergency/shared";
import { appFor, internal, errors, mode, post } from "@emergency/server-kit";
const app = appFor("orchestrator");
// Scaffold store only. Ramya: replace with SQLite; preserve idempotency across restarts.
const tasks = new Map<string, Task>();
const seen = new Set<string>();
const voice = process.env.VOICE_URL ?? "http://localhost:4102";
async function start(t: Task, call: Call) {
  try {
    await post(`${voice}/calls`, {
      taskId: t.id,
      callId: call.id,
      input: t.input,
      business: call.business,
      purpose: call.purpose,
      selectedOffer:
        call.purpose === "booking"
          ? t.offers.find((o) => o.id === t.selectedOfferId)
          : null,
    });
  } catch (e) {
    call.status = "failed";
    t.warnings.push("A call could not start");
    console.error(e);
    if (call.purpose === "booking") t.stage = "offers_ready";
    settle(t);
  }
}
function settle(t: Task) {
  if (
    t.stage === "calling" &&
    t.calls
      .filter((c) => c.purpose === "quote")
      .every((c) => ["completed", "failed"].includes(c.status))
  )
    t.stage = t.offers.length ? "offers_ready" : "no_matches";
}
app.post("/api/tasks", (req, res) => {
  const input = TaskInput.parse(req.body);
  if (mode === "live") {
    res
      .status(501)
      .json({
        error: "Live orchestration and persistence are not implemented",
      });
    return;
  }
  const t: Task = {
    id: randomUUID(),
    input,
    stage: "finding",
    businesses: [],
    calls: [],
    offers: [],
    warnings: [],
    simulated: true,
  };
  tasks.set(t.id, t);
  res.status(202).json(t);
  void (async () => {
    const result = DiscoveryResult.parse(
      await post(
        `${process.env.DISCOVERY_URL ?? "http://localhost:4101"}/discover`,
        { taskId: t.id, input, searchAt: new Date().toISOString() },
      ),
    );
    t.businesses = result.businesses;
    t.warnings = result.warnings;
    if (!t.businesses.length) {
      t.stage = "no_matches";
      return;
    }
    t.stage = "calling";
    t.calls = t.businesses.map((b) => ({
      id: randomUUID(),
      business: b,
      purpose: "quote",
      status: "dialing",
      events: [],
    }));
    await Promise.all(t.calls.map((c) => start(t, c)));
  })().catch((e) => {
    t.stage = "failed";
    t.error = "Discovery failed";
    console.error(e);
  });
});
app.get("/api/tasks/:id", (req, res) => {
  const t = tasks.get(req.params.id);
  if (!t) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  res.json(t);
});
app.post("/api/tasks/:id/book", (req, res) => {
  const t = tasks.get(req.params.id);
  if (!t) {
    res.status(404).json({ error: "Task not found" });
    return;
  }
  if (t.stage !== "offers_ready") {
    res.status(409).json({ error: "Task is not ready for booking" });
    return;
  }
  const offer = t.offers.find((o) => o.id === req.body.offerId);
  if (
    !offer ||
    !offer.availableNow ||
    offer.etaMinutes === null ||
    offer.etaMinutes > t.input.maxArrivalMinutes
  ) {
    res.status(400).json({ error: "Select an eligible offer" });
    return;
  }
  const business = t.businesses.find((b) => b.id === offer.businessId)!;
  t.stage = "booking";
  t.selectedOfferId = offer.id;
  const call: Call = {
    id: randomUUID(),
    business,
    purpose: "booking",
    status: "dialing",
    events: [],
  };
  t.calls.push(call);
  res.status(202).json(t);
  void start(t, call);
});
app.post("/internal/events", internal, (req, res) => {
  const e = CallEvent.parse(req.body);
  const t = tasks.get(e.taskId);
  const c = t?.calls.find((c) => c.id === e.callId);
  if (!t || !c) {
    res.status(404).json({ error: "Unknown call" });
    return;
  }
  if (seen.has(e.eventId)) {
    res.json({ ok: true });
    return;
  }
  if (
    e.type === "offer" &&
    (c.purpose !== "quote" ||
      e.offer.callId !== c.id ||
      e.offer.businessId !== c.business.id)
  ) {
    res.status(400).json({ error: "Offer does not match quote call" });
    return;
  }
  if (e.type === "booking_result" && c.purpose !== "booking") {
    res.status(400).json({ error: "Not a booking call" });
    return;
  }
  seen.add(e.eventId);
  c.events.push(e);
  if (e.type === "status") {
    c.status = e.status;
    if (c.purpose === "booking" && e.status === "failed")
      t.stage = "offers_ready";
  }
  if (e.type === "offer" && !t.offers.some((o) => o.callId === c.id))
    t.offers.push(e.offer);
  if (e.type === "booking_result") {
    t.bookingAccepted = e.accepted;
    t.stage = e.accepted ? "confirmed" : "offers_ready";
  }
  settle(t);
  res.json({ ok: true });
});
errors(app);
app.listen(Number(process.env.ORCHESTRATOR_PORT ?? 4100), "127.0.0.1", () =>
  console.log("Orchestrator ready (memory store)"),
);
