import { randomUUID } from "node:crypto";
import { Store, type Record } from "./store.js";
export async function simulate(r: Record, store: Store) {
  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  await wait(500);
  if (store.terminal(r)) return;
  store.emit(r, { type: "status", status: "connected" });
  if (r.probe) {
    store.emit(r, { type: "transcript", sequence: r.sequence++, speaker: "agent", text: "Simulated phone connectivity test. No real phone was called." });
    store.emit(r, { type: "status", status: "completed" }); return;
  }
  store.emit(r, { type: "transcript", sequence: r.sequence++, speaker: "agent", text: r.request.purpose === "quote" ? "Can you provide a mobile mechanic arrival estimate and quote?" : "Please reconfirm the selected quote and dispatch request." });
  await wait(1000);
  if (store.terminal(r)) return;
  const n = Number(r.request.business.id.split("-").at(-1)) || 1;
  store.emit(r, { type: "transcript", sequence: r.sequence++, speaker: "business", text: r.request.purpose === "quote" ? `Simulated response: available in ${15 + n * 5} minutes, estimated $${90 + n * 20}.` : "Simulated response: dispatch accepted at the selected terms." });
  if (r.request.purpose === "quote") store.emit(r, { type: "offer", offer: { id: randomUUID(), callId: r.request.callId, businessId: r.request.business.id, availableNow: true, etaMinutes: 15 + n * 5, amountMinor: (90 + n * 20) * 100, currency: "USD", quoteType: "estimate", conditions: "Simulated estimate; no real business contacted." } });
  else store.emit(r, { type: "booking_result", accepted: true, summary: "Simulated dispatch acceptance" });
  store.emit(r, { type: "status", status: "completed" });
}
