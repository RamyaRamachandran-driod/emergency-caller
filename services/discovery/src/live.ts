import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { DiscoveryResult, TaskInput, type Business } from "@emergency/shared";

const Hours = z
  .array(z.object({ day: z.number().int(), open: z.string(), close: z.string() }))
  .nullable();
export const Found = z.object({
  timezone: z.string(),
  businesses: z.array(
    z.object({
      name: z.string(),
      phone: z.string(),
      sourceUrl: z.string().describe("The full absolute http:// or https:// URL of the page publishing the phone number. Never a citation ID such as turn0search1."),
      hours: Hours,
    }),
  ),
});
export type Found = z.infer<typeof Found>;

const prompt = (input: TaskInput) => `Find up to 5 businesses that can come to this vehicle breakdown (mobile mechanics, roadside repair, towing).
Breakdown location: ${input.location}
Problem: ${input.request}

Rules:
- phone: use E.164 format (+1 followed by 10 digits for US/Canada); only a number published on the business's own site or a listing page. Never guess or construct a number.
- sourceUrl: the FULL absolute http:// or https:// URL of the page where you found that phone number. Never return a citation ID (for example turn0search1), a Markdown link, or a reference marker. If you cannot find a real source URL and published number, omit that business.
- hours: weekly opening hours as published. day 0=Sunday..6=Saturday, open/close as 24h "HH:MM" local time. Use "00:00"-"24:00" for open 24 hours. A close earlier than open means it closes after midnight. Use null when hours are not published.
- timezone: the IANA timezone of the breakdown location.`;

export async function searchLive(input: TaskInput) {
  const model = process.env.OPENAI_TEXT_MODEL;
  if (!process.env.OPENAI_API_KEY || !model)
    throw new Error("Set OPENAI_API_KEY and OPENAI_TEXT_MODEL in root .env");
  const response = await new OpenAI({ timeout: 180_000 }).responses.parse({
    model,
    tools: [{ type: "web_search" }],
    tool_choice: "required",
    input: prompt(input),
    text: { format: zodTextFormat(Found, "discovery") },
  });
  if (!response.output_parsed) throw new Error("Discovery model returned no result");
  return response.output_parsed;
}

export async function discoverLive(input: TaskInput, searchAt: string) {
  return shortlist(await searchLive(input), input, searchAt);
}

// Turns raw search results into at most three callable, sourced, not-closed businesses.
export function shortlist(found: Found, input: TaskInput, searchAt: string) {
  const warnings: string[] = [];
  let timeZone = input.timezone;
  if (found.timezone !== timeZone && TaskInput.shape.timezone.safeParse(found.timezone).success) {
    warnings.push(`Using location timezone ${found.timezone} instead of ${timeZone}.`);
    timeZone = found.timezone;
  }
  const seen = new Set<string>();
  const candidates: Business[] = [];
  for (const b of found.businesses) {
    const phone = normalizePhone(b.phone);
    if (!phone || !isWebUrl(b.sourceUrl)) {
      warnings.push(`Skipped ${b.name}: no valid published phone number with a source.`);
      continue;
    }
    const name = b.name.trim().toLowerCase();
    if (seen.has(phone) || seen.has(name)) continue;
    seen.add(phone).add(name);
    candidates.push({
      id: "",
      name: b.name,
      phone,
      sourceUrl: b.sourceUrl,
      openingStatus: statusAt(b.hours, new Date(searchAt), timeZone),
      checkedAt: searchAt,
    });
  }
  const closed = candidates.filter((b) => b.openingStatus === "closed").length;
  if (closed) warnings.push(`Skipped ${closed} business(es) closed at the local search time.`);
  const businesses = candidates
    .filter((b) => b.openingStatus !== "closed")
    .sort((a, b) => Number(b.openingStatus === "open") - Number(a.openingStatus === "open"))
    .slice(0, 3)
    // Same <prefix>-<n> shape as the demo ids; the simulated voice agent derives quotes from n.
    .map((b, i) => ({ ...b, id: `live-${i + 1}` }));
  for (const b of businesses)
    if (b.openingStatus === "unknown") warnings.push(`${b.name}: opening hours not found.`);
  return DiscoveryResult.parse({ businesses, warnings });
}

export function normalizePhone(raw: string) {
  // ponytail: US/Canada (+1) only; switch to libphonenumber-js if discovery goes international
  raw = raw.normalize("NFKC").replace(/[\u2010-\u2015\u2212]/g, "-");
  if (!/^[\d\s().+-]+$/.test(raw)) return null;
  const digits = raw.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  return /^[2-9]\d{2}[2-9]\d{6}$/.test(digits) ? `+1${digits}` : null;
}

function isWebUrl(value: string) {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

const toMinutes = (hm: string) => {
  const m = /^(\d{2}):(\d{2})$/.exec(hm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};

export function statusAt(
  hours: z.infer<typeof Hours>,
  at: Date,
  timeZone: string,
): Business["openingStatus"] {
  if (!hours?.length) return "unknown";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const today = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  const now = Number(parts.hour) * 60 + Number(parts.minute);
  let open = false;
  for (const h of hours) {
    const from = toMinutes(h.open);
    const to = toMinutes(h.close);
    if (!(h.day >= 0 && h.day <= 6) || Number.isNaN(from) || Number.isNaN(to)) return "unknown";
    if (to > from) open ||= h.day === today && now >= from && now < to;
    else open ||= (h.day === today && now >= from) || (h.day === (today + 6) % 7 && now < to);
  }
  return open ? "open" : "closed";
}
