import { randomUUID } from "node:crypto";
import { CallRequest, type CallEvent } from "@emergency/shared";
import { appFor, internal, errors, mode, post } from "@emergency/server-kit";
const app = appFor("voice");
const accepted = new Set<string>();
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
    await emit({
      type: "transcript",
      sequence: 1,
      speaker: "business",
      text:
        call.purpose === "quote"
          ? `Simulated response: available in ${15 + n * 5} minutes, estimated $${90 + n * 20}.`
          : "Simulated response: dispatch accepted at the selected terms.",
    });
    if (call.purpose === "quote")
      await emit({
        type: "offer",
        offer: {
          id: randomUUID(),
          callId: call.callId,
          businessId: call.business.id,
          availableNow: true,
          etaMinutes: 15 + n * 5,
          amountMinor: (90 + n * 20) * 100,
          currency: "USD",
          quoteType: "estimate",
          conditions: "Simulated estimate; no real business contacted.",
        },
      });
    else
      await emit({
        type: "booking_result",
        accepted: true,
        summary: "Simulated dispatch acceptance",
      });
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
