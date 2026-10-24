import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { configFromEnv } from "../src/config.js";
import { Store } from "../src/store.js";
import { extractTranscriptQuote, saveQuote, needsPricingDiscussion, needsLocationDiscussion } from "../src/quote.js";

test("transcript extraction preserves verbatim evidence, rejects invented evidence, and saves once", async t => {
  const dir = mkdtempSync(join(tmpdir(), "savior-extract-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const store = new Store(dir);
  const r = store.create({ taskId: randomUUID(), callId: randomUUID(), purpose: "quote", selectedOffer: null,
    input: { request: "Test", location: "San Jose, California", timezone: "America/Los_Angeles", maxArrivalMinutes: 30 },
    business: { id: "personal-phone-test", name: "Your phone", phone: "+14155550101", sourceUrl: null, openingStatus: "unknown", checkedAt: new Date().toISOString() } }, true, true);
  store.emit(r, { type: "transcript", speaker: "agent", sequence: 0, text: "How soon and what price?" });
  store.emit(r, { type: "transcript", speaker: "business", sequence: 1, text: "Twenty-five minutes. Hundred dollars. Fixed fee for coming out." });
  const missingPrice = { availability: "available" as const, etaMinutes: 25, amountMinor: null, currency: null, quoteType: "unknown" as const, conditions: null, evidence: { availability: "We can help", eta: "Twenty-five minutes", price: "" } };
  const bare = { ...r, events: [] };
  assert.equal(needsPricingDiscussion(bare, missingPrice), true);
  assert.equal(needsPricingDiscussion({ ...bare, events: [{ ...r.events[0], type: "transcript", speaker: "agent", sequence: 0, text: "I'm calling for a quote. Can you help with a leak?" }] }, missingPrice), true);
  assert.equal(needsPricingDiscussion({ ...bare, events: [{ ...r.events[0], type: "transcript", speaker: "agent", sequence: 0, text: "What would the visit cost?" }] }, missingPrice), false);
  assert.equal(needsPricingDiscussion({ ...bare, events: [{ ...r.events[0], type: "transcript", speaker: "business", sequence: 0, text: "I need to inspect it before I can quote." }] }, missingPrice), false);
  assert.equal(needsPricingDiscussion(bare, { ...missingPrice, availability: "unavailable" }), false);
  const located = { ...bare, request: { ...r.request, input: { ...r.request.input, location: "1550 Mission St, San Francisco, CA 94103" } } };
  assert.equal(needsLocationDiscussion(located, missingPrice), true);
  const event = (speaker: "agent" | "business", text: string, sequence: number) => ({ eventId: randomUUID(), taskId: r.request.taskId, callId: r.request.callId, at: new Date().toISOString(), type: "transcript" as const, speaker, text, sequence });
  assert.equal(needsLocationDiscussion({ ...located, events: [event("agent", "Can you attend the location?", 0), event("business", "Yes", 1)] }, missingPrice), true);
  assert.equal(needsLocationDiscussion({ ...located, events: [event("agent", "Can you attend fifteen fifty Mission Street in San Francisco?", 0)] }, missingPrice), true);
  assert.equal(needsLocationDiscussion({ ...located, events: [event("agent", "Can you attend fifteen fifty Mission Street in San Francisco?", 0), event("business", "Yes, I can", 1)] }, missingPrice), false);
  assert.equal(needsLocationDiscussion({ ...located, events: [event("business", "Yes, we serve 1550 Mission Street in San Francisco", 0)] }, missingPrice), false);
  const config = configFromEnv({ OPENAI_TEXT_MODEL: "test-model", OPENAI_API_KEY: "fake" });
  const quote = { availability: "unknown", etaMinutes: 25, amountMinor: 10000, currency: "USD", quoteType: "fixed", conditions: "Call-out fee only; repair total unknown.", evidence: { availability: "", eta: "Twenty-five minutes", price: "Hundred dollars" } };
  const mock: typeof fetch = async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, "test-model");
    assert.ok(body.input.includes("Twenty-five minutes"));
    assert.equal(body.text.format.strict, true);
    return Response.json({ output: [{ content: [{ type: "output_text", text: JSON.stringify(quote) }] }] });
  };
  const result = await extractTranscriptQuote(r, config, mock);
  assert.equal(result.etaMinutes, 25); assert.equal(result.amountMinor, 10000);
  saveQuote(r, store, result);
  assert.throws(() => saveQuote(r, store, result), /already been saved/);
  assert.equal(r.events.filter(e => e.type === "offer").length, 1);
  const offer = r.events.find(e => e.type === "offer");
  assert.equal(offer?.offer.availableNow, null); // availability "unknown" stays unknown
  quote.evidence.price = "Two hundred dollars";
  await assert.rejects(extractTranscriptQuote(r, config, mock), /exact business transcript/);
  await assert.rejects(extractTranscriptQuote(r, config, async () => new Response("unavailable", { status: 503 })), /HTTP 503/);
});
