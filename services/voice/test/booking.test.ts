import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { Store } from "../src/store.js";
import { saveBooking } from "../src/booking.js";
import { instructions, tools } from "../src/prompt.js";

test("confirmation needs an approved matching quote and explicit supported outcome; changed terms never become acceptance", t => {
  const dir = mkdtempSync(join(tmpdir(), "savior-booking-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  const callId = randomUUID();
  const offer = { id: randomUUID(), callId: randomUUID(), businessId: "plumber", availableNow: true, etaMinutes: 20, amountMinor: 10000, currency: "USD", quoteType: "estimate" as const, conditions: "Visit fee only; repairs extra after separate approval" };
  const r = store.create({ taskId: randomUUID(), callId, purpose: "booking", selectedOffer: offer,
    approval: { callId, offer, approvedAt: new Date().toISOString(), contact: { name: "Test customer", phone: "+14155550101" } },
    input: { request: "Leaking pipe", location: "1550 Mission St, San Francisco", timezone: "America/Los_Angeles", maxArrivalMinutes: 30 },
    business: { id: "plumber", name: "Test Plumbing", phone: "+14155550101", sourceUrl: null, openingStatus: "unknown", checkedAt: new Date().toISOString() } }, true, true);
  const accepted = { outcome: "accepted", summary: "Confirmed approved visit fee and original ETA.", amountMinor: 10000, currency: "USD", etaMinutes: 20, addressConfirmed: true, conditionsUnchanged: true, evidence: "Yes, dispatch confirmed for those terms." };
  assert.throws(() => saveBooking(r, store, accepted), /exact finalized/);
  store.emit(r, { type: "transcript", speaker: "business", sequence: 0, text: accepted.evidence });
  for (const change of [{ amountMinor: 12000 }, { currency: "CAD" }, { etaMinutes: 30 }, { etaMinutes: 15 }, { addressConfirmed: false }, { conditionsUnchanged: false }]) {
    assert.throws(() => saveBooking(r, store, { ...accepted, ...change }), /Terms do not match/);
  }
  assert.equal(r.events.some(e => e.type === "booking_result"), false);
  assert.ok(!tools("booking").some(t => t.name === "report_quote"));
  assert.ok(!tools("quote").some(t => t.name === "report_booking"));
  assert.match(instructions(r.request), /HOLD dispatch/);
  assert.match(instructions(r.request), /Test Plumbing/);
  saveBooking(r, store, accepted);
  assert.equal(r.events.find(e => e.type === "booking_result")?.accepted, true);
  assert.throws(() => saveBooking(r, store, accepted), /already recorded/);
  const otherId = randomUUID();
  const changed = store.create({ ...r.request, callId: otherId, approval: { ...r.request.approval!, callId: otherId } }, true, true);
  store.emit(changed, { type: "transcript", speaker: "business", sequence: 0, text: "It is now one hundred fifty dollars and forty minutes." });
  saveBooking(changed, store, { ...accepted, outcome: "terms_changed", amountMinor: 15000, etaMinutes: 40, summary: "Price and ETA changed; dispatch held pending customer approval.", evidence: "one hundred fifty dollars and forty minutes" });
  const event = changed.events.find(e => e.type === "booking_result");
  assert.equal(event?.accepted, false); assert.equal(event?.outcome, "terms_changed");
  const unapproved = store.create({ ...r.request, callId: randomUUID(), approval: undefined }, true, true);
  assert.throws(() => saveBooking(unapproved, store, accepted), /No customer booking approval/);
});
