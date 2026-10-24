import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePhone, shortlist, statusAt } from "./live";

const LA = "America/Los_Angeles";

test("normalizePhone keeps only valid +1 numbers", () => {
  assert.equal(normalizePhone("(415) 555-0123"), "+14155550123");
  assert.equal(normalizePhone("+1 415.555.0123"), "+14155550123");
  assert.equal(normalizePhone("1-800-TOW-TRUCK"), null);
  assert.equal(normalizePhone("+44 20 7946 0958"), null);
  assert.equal(normalizePhone("555-0123"), null);
});

test("statusAt uses local time, overnight hours and missing hours", () => {
  const weekday = [{ day: 1, open: "09:00", close: "17:00" }];
  assert.equal(statusAt(weekday, new Date("2026-10-26T20:00Z"), LA), "open"); // Mon 13:00 PDT
  assert.equal(statusAt(weekday, new Date("2026-10-27T02:00Z"), LA), "closed"); // Mon 19:00 PDT
  const overnight = [{ day: 5, open: "22:00", close: "02:00" }];
  assert.equal(statusAt(overnight, new Date("2026-10-31T08:00Z"), LA), "open"); // Sat 01:00 PDT
  assert.equal(statusAt(null, new Date(), LA), "unknown");
  assert.equal(statusAt([{ day: 9, open: "x", close: "y" }], new Date(), LA), "unknown");
});

test("shortlist dedupes, drops unsourced and closed, prefers open, caps at 3", () => {
  const monday1pmLA = "2026-10-26T20:00:00.000Z";
  const allWeek = [1].map((day) => ({ day, open: "00:00", close: "24:00" }));
  const result = shortlist(
    {
      timezone: LA,
      businesses: [
        { name: "Unknown Hours", phone: "415-555-0101", sourceUrl: "https://a.example", hours: null },
        { name: "Dup", phone: "(415) 555-0101", sourceUrl: "https://b.example", hours: null },
        { name: "No Source", phone: "415-555-0102", sourceUrl: "", hours: null },
        { name: "Closed", phone: "415-555-0103", sourceUrl: "https://c.example", hours: [{ day: 2, open: "09:00", close: "17:00" }] },
        { name: "Open A", phone: "415-555-0104", sourceUrl: "https://d.example", hours: allWeek },
        { name: "Open B", phone: "415-555-0105", sourceUrl: "https://e.example", hours: allWeek },
        { name: "Open C", phone: "415-555-0106", sourceUrl: "https://f.example", hours: allWeek },
      ],
    },
    { request: "flat tyre", location: "San Francisco", timezone: "America/New_York", maxArrivalMinutes: 30 },
    monday1pmLA,
  );
  assert.deepEqual(result.businesses.map((b) => b.name), ["Open A", "Open B", "Open C"]);
  assert.deepEqual(result.businesses.map((b) => b.id), ["live-1", "live-2", "live-3"]);
  assert.ok(result.warnings.some((w) => w.includes("Using location timezone America/Los_Angeles")));
  assert.ok(result.warnings.some((w) => w.includes("No Source")));
  assert.ok(result.warnings.some((w) => w.includes("1 business(es) closed")));
});
