import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Store, type Request } from "../src/store.js";
import { simulate } from "../src/simulate.js";

test("merged Kane simulation preserves unknown fields, arrival boundaries, failures and pending bookings", async t => {
  const dir = mkdtempSync(join(tmpdir(), "savior-scenario-merge-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  async function run(scenario: string, n = 1, booking = false) {
    const request: Request = { taskId: randomUUID(), callId: randomUUID(),
      input: { request: "Car will not start", location: `Test location scenario: ${scenario}`, timezone: "America/Los_Angeles", maxArrivalMinutes: 30 },
      business: { id: `demo-${n}`, name: "Simulated mechanic", phone: "+12025550101", sourceUrl: null, openingStatus: "unknown", checkedAt: new Date().toISOString() },
      purpose: booking ? "booking" : "quote", selectedOffer: booking ? { id: randomUUID(), callId: randomUUID(), businessId: `demo-${n}`, availableNow: true, etaMinutes: 20, amountMinor: 11000, currency: "USD", quoteType: "estimate", conditions: null } : null };
    const record = store.create(request, false, false);
    await simulate(record, store);
    return record;
  }
  const [unknownPrice, unknownEta, unknownAvailability, unknownConditions, unavailable, over, exact, failed, surviving, pending] = await Promise.all([
    run("unknown-quote"), run("unknown-eta"), run("unknown-availability"), run("unknown-conditions"), run("unavailable"),
    run("over-max"), run("at-max"), run("failed-call", 2), run("failed-call", 1), run("pending", 1, true),
  ]);
  const offer = (record: typeof unknownPrice) => record.events.find(e => e.type === "offer")?.offer;
  assert.equal(offer(unknownPrice)?.amountMinor, null); assert.equal(offer(unknownPrice)?.currency, null);
  assert.equal(offer(unknownEta)?.etaMinutes, null); assert.equal(offer(unknownAvailability)?.availableNow, null);
  assert.equal(offer(unknownConditions)?.conditions, null); assert.equal(offer(unavailable)?.availableNow, false);
  assert.equal(offer(over)?.etaMinutes, 50); assert.equal(offer(exact)?.etaMinutes, 30);
  assert.equal(failed.status, "failed"); assert.equal(offer(failed), undefined);
  assert.equal(surviving.status, "completed"); assert.ok(offer(surviving));
  assert.equal(pending.status, "connected"); assert.equal(pending.events.some(e => e.type === "booking_result"), false);
});
