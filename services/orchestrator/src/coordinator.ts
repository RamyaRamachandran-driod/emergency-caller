import { mode, testCallNumber } from "@emergency/server-kit";
import { randomUUID } from "node:crypto";
import { CallEvent, CallRequest, quoteCallBrief, type Call, type Task, type TaskInput } from "@emergency/shared";
import type { MutationResult } from "./store.js";
import { TaskStore } from "./store.js";
import { DiscoveryClient, VoiceClient } from "./service-clients.js";

const foundStageHoldMs = Number(process.env.FOUND_STAGE_HOLD_MS ?? 5_000);
if (!Number.isFinite(foundStageHoldMs) || foundStageHoldMs < 0) throw new Error("FOUND_STAGE_HOLD_MS must be a nonnegative number.");

function settle(task: Task): void {
  const quoteCalls = task.calls.filter((call) => call.purpose === "quote");
  const finished = quoteCalls.length > 0 && quoteCalls.every((call) => ["completed", "failed"].includes(call.status));
  if (finished && (task.stage === "calling" || (task.stage === "no_matches" && task.offers.length > 0))) {
    task.stage = task.offers.length ? "offers_ready" : "no_matches";
  }
}

export class Orchestrator {
  constructor(
    private readonly store = new TaskStore(),
    private readonly discovery = new DiscoveryClient(),
    private readonly voice = new VoiceClient(),
    private readonly live = mode === "live",
  ) {}

  getTask(taskId: string): Task | null { return this.store.get(taskId); }
  getTaskByRequestId(key: string): Task | null { return this.store.findByClientRequestId(key); }

  submit(input: TaskInput, clientRequestId: string | null): Task {
    if (clientRequestId) {
      const existing = this.store.findByClientRequestId(clientRequestId);
      if (existing) return existing;
    }
    const task: Task = {
      id: randomUUID(), input, stage: "finding", businesses: [], calls: [], offers: [],
      warnings: [], simulated: !this.live,
    };
    this.store.create(task, clientRequestId);
    void this.findAndStartQuotes(task.id);
    return task;
  }

  async requestBooking(taskId: string, offerId: string, idempotencyKey: string): Promise<{ result: MutationResult; task: Task | null }> {
    let callToStart: Call | null = null;
    const claimed = this.store.claimBooking(taskId, idempotencyKey, (task) => {
      if (task.stage !== "offers_ready") return false;
      const offer = task.offers.find((candidate) => candidate.id === offerId);
      if (!offer || !offer.availableNow || offer.etaMinutes === null || offer.etaMinutes > task.input.maxArrivalMinutes) return false;
      const business = task.businesses.find((candidate) => candidate.id === offer.businessId);
      if (!business) return false;
      callToStart = { id: randomUUID(), business, purpose: "booking", status: "queued", events: [] };
      task.stage = "booking";
      task.selectedOfferId = offer.id;
      task.bookingAccepted = false;
      task.calls.push(callToStart);
      return true;
    });
    if (claimed.result === "booking_claimed" && claimed.task && callToStart) {
      void this.startCall(claimed.task, callToStart);
    }
    return claimed;
  }

  recordEvent(rawEvent: unknown): { result: MutationResult; task: Task | null } {
    const event = CallEvent.parse(rawEvent);
    return this.store.applyEvent(event, (task) => {
      const call = task.calls.find((candidate) => candidate.id === event.callId);
      if (!call) return "invalid";
      if (event.type === "offer" && (call.purpose !== "quote" || event.offer.callId !== call.id || event.offer.businessId !== call.business.id)) return "invalid";
      if (event.type === "booking_result" && call.purpose !== "booking") return "invalid";
      call.events.push(event);
      if (event.type === "status") {
        call.status = event.status;
        if (call.purpose === "booking" && ["completed", "failed"].includes(event.status) && task.stage === "booking") {
          task.stage = "offers_ready";
          task.bookingAccepted = false;
        }
      }
      if (event.type === "offer" && !task.offers.some((offer) => offer.callId === call.id)) task.offers.push(event.offer);
      if (event.type === "booking_result") {
        task.bookingAccepted = event.accepted;
        task.stage = event.accepted ? "confirmed" : "offers_ready";
      }
      settle(task);
      return "updated";
    });
  }

  private async findAndStartQuotes(taskId: string): Promise<void> {
    try {
      const initial = this.store.get(taskId);
      if (!initial) return;
      const searchAt = new Date().toISOString();
      const result = this.live && testCallNumber ? {
        businesses: [{ id: "personal-phone-test", name: "Your phone (live test)", phone: testCallNumber, sourceUrl: null, openingStatus: "unknown" as const, checkedAt: searchAt }],
        warnings: ["Personal-phone test: one real call to your number. No businesses are searched or called. Answer as the mechanic to test quote collection."],
      } : await this.discovery.find({ taskId, input: initial.input, searchAt });
      const found = this.store.mutate(taskId, (current) => {
        current.businesses = result.businesses.slice(0, 3);
        current.warnings.push(...result.warnings);
        if (!current.businesses.length) {
          current.stage = "no_matches";
          return;
        }
        current.stage = "found";
      });
      if (!found || found.stage !== "found") return;

      // Give the dashboard a visible Found state before automatically starting all quote calls.
      if (foundStageHoldMs > 0) await new Promise((resolve) => setTimeout(resolve, foundStageHoldMs));
      const task = this.store.mutate(taskId, (current) => {
        if (current.stage !== "found") return;
        current.stage = "calling";
        current.calls = current.businesses.map((business) => ({
          id: randomUUID(), business, purpose: "quote", status: "queued", events: [],
        }));
      });
      if (!task || task.stage !== "calling") return;
      await Promise.all(task.calls.filter((call) => call.purpose === "quote").map((call) => this.startCall(task, call)));
    } catch (error) {
      this.store.mutate(taskId, (task) => {
        task.stage = "failed";
        task.error = error instanceof Error ? error.message : "Discovery failed";
      });
    }
  }

  private async startCall(task: Task, call: Call): Promise<void> {
    const payload = CallRequest.parse({
      taskId: task.id, callId: call.id, input: task.input, business: call.business,
      brief: quoteCallBrief(task.input),
      purpose: call.purpose,
      selectedOffer: call.purpose === "booking" ? task.offers.find((offer) => offer.id === task.selectedOfferId) ?? null : null,
    });
    try {
      await this.voice.start(payload);
      this.store.mutate(task.id, (current) => {
        const currentCall = current.calls.find((candidate) => candidate.id === call.id);
        if (currentCall?.status === "queued") currentCall.status = "dialing";
      });
    } catch (error) {
      this.store.mutate(task.id, (current) => {
        const currentCall = current.calls.find((candidate) => candidate.id === call.id);
        if (!currentCall) return;
        currentCall.status = "failed";
        current.warnings.push("A call could not start; other calls may still complete.");
        if (currentCall.purpose === "booking") current.stage = "offers_ready";
        current.error = error instanceof Error ? error.message : String(error);
        settle(current);
      });
    }
  }
}
