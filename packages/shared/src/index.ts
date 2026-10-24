import { z } from "zod";
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
  availableNow: z.boolean(),
  etaMinutes: z.number().nonnegative().nullable(),
  amountMinor: z.number().int().nonnegative().nullable(),
  currency: z.string().nullable(),
  quoteType: z.enum(["fixed", "estimate", "unknown"]),
  conditions: z.string().nullable(),
});
export type Offer = z.infer<typeof Offer>;
export const CallRequest = z.object({
  taskId: z.string().uuid(),
  callId: z.string().uuid(),
  input: TaskInput,
  business: Business,
  purpose: z.enum(["quote", "booking"]),
  selectedOffer: Offer.nullable(),
});
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
  status: "dialing" | "connected" | "completed" | "failed";
  events: CallEvent[];
}
export interface Task {
  id: string;
  input: TaskInput;
  stage:
    | "finding"
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
