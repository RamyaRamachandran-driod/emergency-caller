import { z } from "zod";
import type { Record } from "./store.js";
import { Store } from "./store.js";
import { needsLocationDiscussion } from "./quote.js";

// Acceptance reuses the immutable customer approval; the model only reports the
// merchant's decision and any actual changes, rather than re-entering known terms.
export const BookingResult = z.object({
  outcome: z.enum(["accepted", "declined", "terms_changed"]),
  summary: z.string().min(1).max(2000),
  evidence: z.string().min(1).max(2000),
  changedTerms: z.object({
    amountMinor: z.number().int().nonnegative().nullable(),
    currency: z.string().regex(/^[A-Z]{3}$/).nullable(),
    etaMinutes: z.number().nonnegative().nullable(),
    conditions: z.string().max(2000).nullable(),
  }).strict().nullable().describe("Null when the approved offer is accepted unchanged or declined. Only provide newly stated terms when the merchant changes the offer; those require fresh customer approval."),
}).strict();

export class BookingEvidencePending extends Error {}
const normalize = (text: string) => text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
export function saveBooking(r: Record, store: Store, raw: unknown) {
  if (r.request.purpose !== "booking" || !r.request.approval) throw Error("No customer booking approval exists");
  if (r.events.some(e => e.type === "booking_result")) throw Error("A confirmation outcome is already recorded; do not authorize another dispatch");
  const result = BookingResult.parse(raw);
  const evidence = normalize(result.evidence);
  const segments = r.events.filter(e => e.type === "transcript" && e.speaker === "business");
  const supported = segments.some(e => e.type === "transcript" && (` ${normalize(e.text)} `).includes(` ${evidence} `));
  if (evidence.length < 2 || !supported) throw new BookingEvidencePending("Outcome requires words from a finalized business transcript; punctuation and capitalization may differ");
  const approved = r.request.approval.offer;
  if (result.outcome === "accepted") {
    if (result.changedTerms !== null) throw Error("Terms do not match customer approval. Tell the merchant to hold dispatch and report terms_changed; never accept modified terms.");
    const last = segments.at(-1);
    if (last?.type !== "transcript" || !(` ${normalize(last.text)} `).includes(` ${evidence} `)) throw Error("Use the latest merchant answer to the dispatch request, not an earlier greeting acknowledgement");
    if (needsLocationDiscussion(r, { availability: "available", etaMinutes: null, amountMinor: null, currency: null, quoteType: "unknown", conditions: null, evidence: { availability: "", eta: "", price: "" } })) {
      throw Error("Mention the supplied service address in the dispatch request before recording acceptance; no address read-back is needed");
    }
  }
  const summary = result.outcome === "accepted"
    ? `Business accepted the approved ${approved.currency} ${((approved.amountMinor ?? 0) / 100).toFixed(2)} ${approved.quoteType} for ${r.request.input.location}, with arrival within ${approved.etaMinutes} minutes.${approved.conditions ? ` Conditions: ${approved.conditions}` : ""}`
    : result.summary;
  store.emit(r, { type: "booking_result", accepted: result.outcome === "accepted", outcome: result.outcome, summary });
  return result;
}
