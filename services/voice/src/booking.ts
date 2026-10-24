import { z } from "zod";
import type { Record } from "./store.js";
import { Store } from "./store.js";

export const BookingResult = z.object({
  outcome: z.enum(["accepted", "declined", "terms_changed"]),
  summary: z.string().min(1).max(2000),
  amountMinor: z.number().int().nonnegative().nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
  etaMinutes: z.number().nonnegative().nullable(),
  addressConfirmed: z.boolean().describe("The merchant accepted attendance at the supplied address you mentioned. No address read-back or separate address question is required."),
  conditionsUnchanged: z.boolean().describe("No change to the approved quote conditions was introduced. Do not ask the merchant to repeat established terms."),
  evidence: z.string().max(2000),
}).strict();

export function saveBooking(r: Record, store: Store, raw: unknown) {
  if (r.request.purpose !== "booking" || !r.request.approval) throw Error("No customer booking approval exists");
  if (r.events.some(e => e.type === "booking_result")) throw Error("A confirmation outcome is already recorded; do not authorize another dispatch");
  const result = BookingResult.parse(raw);
  const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();
  const business = normalize(r.events.filter(e => e.type === "transcript" && e.speaker === "business").map(e => e.type === "transcript" ? e.text : "").join("\n"));
  if (normalize(result.evidence).length < 3 || !business.includes(normalize(result.evidence))) throw Error("Outcome requires an exact finalized business transcript fragment; wait for transcription if needed");
  const approved = r.request.approval.offer;
  // These are hard authorization boundaries, regardless of the model's outcome label.
  if (result.outcome === "accepted" && (result.amountMinor !== approved.amountMinor ||
    result.currency !== approved.currency || result.etaMinutes !== approved.etaMinutes ||
    !result.addressConfirmed || !result.conditionsUnchanged)) {
    throw Error("Terms do not match customer approval. Tell the merchant to hold dispatch and report terms_changed; never accept modified terms.");
  }
  store.emit(r, { type: "booking_result", accepted: result.outcome === "accepted", outcome: result.outcome, summary: result.summary });
  return result;
}
