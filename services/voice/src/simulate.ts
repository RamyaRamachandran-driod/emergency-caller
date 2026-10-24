import { randomUUID } from "node:crypto";
import type { Offer } from "@emergency/shared";
import { Store, type Record } from "./store.js";
// Test mode only: a location containing "scenario: <name>" bends the simulated calls so each
// Kane acceptance criterion has a reproducible setup. Live mode never reaches this code.
// Scenarios: failed-call, unknown-quote, unknown-eta, unknown-availability, unknown-conditions,
// unavailable, over-max, at-max, pending. Anything else is the default happy path.
function scenarioOf(location: string): string | null {
  return /scenario:\s*([a-z-]+)/i.exec(location)?.[1].toLowerCase() ?? null;
}

function simulatedBusinessOrdinal(businessId: string): number {
  // Demo IDs already contain a small sequence number. Live discovery IDs contain phone digits,
  // so hash those IDs instead of treating the phone number as a quote index.
  const demoMatch = /^demo-(\d+)$/.exec(businessId);
  if (demoMatch) return ((Number(demoMatch[1]) - 1) % 3 + 3) % 3 + 1;
  let hash = 0;
  for (const character of businessId) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return (hash % 3) + 1;
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

export async function simulate(r: Record, store: Store) {
  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  await wait(500);
  if (store.terminal(r)) return;
  store.emit(r, { type: "status", status: "connected" });
  if (r.probe) {
    store.emit(r, { type: "transcript", sequence: r.sequence++, speaker: "agent", text: "Simulated phone connectivity test. No real phone was called." });
    store.emit(r, { type: "status", status: "completed" }); return;
  }
  const call = r.request, scenario = scenarioOf(call.input.location);
  store.emit(r, { type: "transcript", sequence: r.sequence++, speaker: "agent", text: call.purpose === "quote" ? "Can you provide a mobile mechanic arrival estimate and quote?" : "Please reconfirm the selected quote and dispatch request." });
  await wait(1000);
  if (store.terminal(r)) return;
  const n = simulatedBusinessOrdinal(call.business.id);
  if (call.purpose === "quote") {
    if (scenario === "failed-call" && n === 2) { store.emit(r, { type: "status", status: "failed" }); return; }
    const { reply, ...offer } = simulatedQuote(n, scenario, call.input.maxArrivalMinutes);
    store.emit(r, { type: "transcript", sequence: r.sequence++, speaker: "business", text: reply });
    store.emit(r, { type: "offer", offer: { id: randomUUID(), callId: call.callId, businessId: call.business.id, ...offer } });
  } else {
    if (scenario === "pending") {
      store.emit(r, { type: "transcript", sequence: r.sequence++, speaker: "business", text: "Simulated response: let me check with dispatch and call you back." }); return;
    }
    store.emit(r, { type: "transcript", sequence: r.sequence++, speaker: "business", text: "Simulated response: dispatch accepted at the selected terms." });
    store.emit(r, { type: "booking_result", accepted: true, summary: "Simulated dispatch acceptance" });
  }
  store.emit(r, { type: "status", status: "completed" });
}
