import { z } from "zod";
export const API_CONTRACT_VERSION = "1" as const;
export const TaskInput = z.object({
  request: z.string().min(1).max(4000),
  location: z.string().min(1).max(500),
  timezone: z.string().refine((v) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: v });
      return true;
    } catch {
      return false;
    }
  }, "Use an IANA timezone"),
  maxArrivalMinutes: z.number().int().positive().max(240).default(30),
});
export type TaskInput = z.infer<typeof TaskInput>;
export const Business = z.object({
  id: z.string(),
  name: z.string(),
  phone: z.string(),
  sourceUrl: z.string().nullable(),
  openingStatus: z.enum(["open", "closed", "unknown"]),
  checkedAt: z.string(),
});
export type Business = z.infer<typeof Business>;
export const DiscoveryRequest = z.object({
  taskId: z.string().uuid(),
  input: TaskInput,
  searchAt: z.string().datetime(),
});
export const DiscoveryResult = z.object({
  businesses: z.array(Business).max(3),
  warnings: z.array(z.string()),
});
export const Offer = z.object({
  id: z.string().uuid(),
  businessId: z.string(),
  callId: z.string().uuid(),
  availableNow: z.boolean().nullable(), // null when the business did not say
  etaMinutes: z.number().nonnegative().nullable(),
  amountMinor: z.number().int().nonnegative().nullable(),
  currency: z.string().nullable(),
  quoteType: z.enum(["fixed", "estimate", "unknown"]),
  conditions: z.string().nullable(),
});
export type Offer = z.infer<typeof Offer>;
export const CallBrief = z.object({
  task: z.string().min(1).max(4000),
  objective: z.string().min(1).max(1000),
  neededInformation: z.array(z.string().min(1).max(500)).min(1).max(12),
  completionCriteria: z.array(z.string().min(1).max(500)).min(1).max(12),
});
export type CallBrief = z.infer<typeof CallBrief>;

// Outcome brief, deliberately independent of industry and conversational order.
export function quoteCallBrief(input: TaskInput): CallBrief {
  return {
    task: input.request,
    objective: `Find out whether this business can help at ${input.location}, and obtain a useful quote for the customer's decision.`,
    neededInformation: [
      "Whether the business can handle the actual requested work at the supplied location.",
      `Availability and relevant timing; the customer wants arrival within ${input.maxArrivalMinutes} minutes. Establish actual timing rather than assuming it.`,
      "Price, currency, whether fixed or estimated, what it covers, and any visit fees or material conditions. Distinguish visit fees from the full job cost.",
    ],
    completionCriteria: [
      "Use the conversation to resolve the objectives, choosing relevant questions and following up on real ambiguity. Do not follow a fixed question sequence.",
      "Before closing, ensure each needed detail is established or explicitly unavailable/unknown. Respect a refusal or request to stop rather than inventing facts or pressing indefinitely.",
      "Save a transcript-supported quote with report_quote, including limitations and unknowns. A quote inquiry never authorizes a booking or dispatch.",
      "Finish with the customer's preferred brief thanks, without reading back a summary, then end the call.",
    ],
  };
}

export const CallRequest = z.object({
  taskId: z.string().uuid(),
  callId: z.string().uuid(),
  input: TaskInput,
  business: Business,
  purpose: z.enum(["quote", "booking"]),
  selectedOffer: Offer.nullable(),
  brief: CallBrief.optional(),
});
export const CallAccepted = z.object({ callId: z.string().uuid() });
const base = {
  eventId: z.string().uuid(),
  taskId: z.string().uuid(),
  callId: z.string().uuid(),
  at: z.string().datetime(),
};
export const CallEvent = z.discriminatedUnion("type", [
  z.object({
    ...base,
    type: z.literal("status"),
    status: z.enum(["dialing", "connected", "completed", "failed"]),
    reason: z.string().max(500).optional(),
  }),
  z.object({
    ...base,
    type: z.literal("transcript"),
    sequence: z.number().int().nonnegative(),
    speaker: z.enum(["agent", "business"]),
    text: z.string(),
  }),
  z.object({ ...base, type: z.literal("offer"), offer: Offer }),
  z.object({
    ...base,
    type: z.literal("booking_result"),
    accepted: z.boolean(),
    summary: z.string(),
  }),
]);
export type CallEvent = z.infer<typeof CallEvent>;
export interface Call {
  id: string;
  business: Business;
  purpose: "quote" | "booking";
  status: "queued" | "dialing" | "connected" | "completed" | "failed";
  events: CallEvent[];
}
export interface Task {
  id: string;
  input: TaskInput;
  stage:
    | "finding"
    | "found"
    | "calling"
    | "offers_ready"
    | "no_matches"
    | "booking"
    | "confirmed"
    | "failed";
  businesses: Business[];
  calls: Call[];
  offers: Offer[];
  warnings: string[];
  error?: string;
  selectedOfferId?: string;
  bookingAccepted?: boolean;
  simulated: boolean;
}
