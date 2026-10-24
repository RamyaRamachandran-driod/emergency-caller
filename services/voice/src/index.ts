import { randomUUID } from "node:crypto";
import { CallRequest, type CallEvent, type Offer } from "@emergency/shared";
import { appFor, internal, errors, mode, post } from "@emergency/server-kit";
const app = appFor("voice");
const accepted = new Set<string>();

// Test mode only: a location containing "scenario: <name>" bends the simulated calls so each
// Kane acceptance criterion has a reproducible setup. Live mode never reaches this code.
// Scenarios: failed-call, unknown-quote, unknown-eta, unknown-availability, unknown-conditions,
// unavailable, over-max, at-max, pending. Anything else is the default happy path.
function scenarioOf(location: string): string | null {
  return /scenario:\s*([a-z-]+)/i.exec(location)?.[1].toLowerCase() ?? null;
}

type SimulatedQuote = Omit<Offer, "id" | "callId" | "businessId"> & { reply: string };

function simulatedQuote(n: number, scenario: string | null, maxArrivalMinutes: number): SimulatedQuote {
  const eta = 15 + n * 5;
  const price = 90 + n * 20;
  const quote: SimulatedQuote = {
    reply: `Simulated response: available in ${eta} minutes, estimated $${price}.`,
    availableNow: true,
    etaMinutes: eta,
    amountMinor: price * 100,
    currency: "USD",
    quoteType: "estimate",
    conditions: "Simulated estimate; no real business contacted.",
  };
  if (n !== 1) return quote;
  switch (scenario) {
    case "unknown-quote":
      return { ...quote, reply: `Simulated response: available in ${eta} minutes; can't give a price until we see the car.`, amountMinor: null, currency: null, quoteType: "unknown" };
    case "unknown-eta":
      return { ...quote, reply: `Simulated response: we can come out, estimated $${price}, but I can't say when we'd arrive.`, etaMinutes: null };
    case "unknown-availability":
      // The shared contract has no "unknown" for availableNow, so the closest truthful value is false.
      return { ...quote, reply: `Simulated response: I'm not sure anyone is free right now; it would be about ${eta} minutes, estimated $${price}.`, availableNow: false };
    case "unavailable":
      return { ...quote, reply: "Simulated response: sorry, nobody is free right now.", availableNow: false };
    case "unknown-conditions":
      return { ...quote, conditions: null };
    case "over-max":
      return { ...quote, reply: `Simulated response: available in ${maxArrivalMinutes + 20} minutes, estimated $${price}.`, etaMinutes: maxArrivalMinutes + 20 };
    case "at-max":
      return { ...quote, reply: `Simulated response: available in ${maxArrivalMinutes} minutes, estimated $${price}.`, etaMinutes: maxArrivalMinutes };
    default:
      return quote;
  }
}

app.post("/calls", internal, (req, res) => {
  const call = CallRequest.parse(req.body);
  if (mode === "live") {
    res
      .status(501)
      .json({
        error:
          "Tanay: implement Twilio + OpenAI Realtime before enabling live mode",
      });
    return;
  }
  if (call.purpose === "booking" && !call.selectedOffer) {
    res.status(400).json({ error: "Booking requires selectedOffer" });
    return;
  }
  if (accepted.has(call.callId)) {
    res.status(202).json({ callId: call.callId });
    return;
  }
  accepted.add(call.callId);
  res.status(202).json({ callId: call.callId });
  const emit = async (body: Record<string, unknown>) => {
    await post(
      `${process.env.ORCHESTRATOR_URL ?? "http://localhost:4100"}/internal/events`,
      {
        eventId: randomUUID(),
        taskId: call.taskId,
        callId: call.callId,
        at: new Date().toISOString(),
        ...body,
      },
    );
  };
  const scenario = scenarioOf(call.input.location);
  void (async () => {
    await new Promise((r) => setTimeout(r, 500));
    await emit({ type: "status", status: "connected" });
    await emit({
      type: "transcript",
      sequence: 0,
      speaker: "agent",
      text:
        call.purpose === "quote"
          ? "Can you send a mobile mechanic and provide an arrival estimate and quote?"
          : "Please reconfirm the selected quote and dispatch request.",
    });
    await new Promise((r) => setTimeout(r, 1000));
    const n = Number(call.business.id.split("-").at(-1)) || 1;
    if (call.purpose === "quote") {
      if (scenario === "failed-call" && n === 2) {
        await emit({ type: "status", status: "failed" });
        return;
      }
      const { reply, ...offer } = simulatedQuote(n, scenario, call.input.maxArrivalMinutes);
      await emit({ type: "transcript", sequence: 1, speaker: "business", text: reply });
      await emit({
        type: "offer",
        offer: { id: randomUUID(), callId: call.callId, businessId: call.business.id, ...offer },
      });
    } else {
      if (scenario === "pending") {
        // Business never answers the dispatch request, so the booking must stay unconfirmed.
        await emit({
          type: "transcript",
          sequence: 1,
          speaker: "business",
          text: "Simulated response: let me check with dispatch and call you back.",
        });
        return;
      }
      await emit({
        type: "transcript",
        sequence: 1,
        speaker: "business",
        text: "Simulated response: dispatch accepted at the selected terms.",
      });
      await emit({
        type: "booking_result",
        accepted: true,
        summary: "Simulated dispatch acceptance",
      });
    }
    await emit({ type: "status", status: "completed" });
  })().catch(async (e) => {
    console.error(e);
    try {
      await emit({ type: "status", status: "failed" });
    } catch (err) {
      console.error("Callback failed", err);
    }
  });
});
errors(app);
app.listen(Number(process.env.VOICE_PORT ?? 4102), "127.0.0.1", () =>
  console.log("Voice ready (simulated only)"),
);
