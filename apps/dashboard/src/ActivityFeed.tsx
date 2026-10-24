import type { Task } from "@emergency/shared";
import { Icon, LiveDot, money, relative } from "./ui";

interface FeedItem {
  id: string;
  at: string;
  order: number;
  businessId: string;
  kind: "agent" | "business" | "offer" | "failed" | "booking";
  text: string;
}

const GLYPH: Record<FeedItem["kind"], string> = { agent: "A", business: "B", offer: "$", failed: "!", booking: "✓" };

const STEPS = [
  "Request received",
  "Finding nearby mobile mechanics",
  "Collecting availability and quotes",
  "Compare offers and choose one",
  "Business confirms dispatch",
];

const ACTIVE_STEP: Record<Task["stage"], number> = {
  finding: 1,
  calling: 2,
  offers_ready: 3,
  booking: 4,
  confirmed: STEPS.length,
  no_matches: 1,
  failed: 1,
};

export function ActivityFeed({ task, onOpen }: { task: Task; onOpen: (businessId: string) => void }) {
  const names = new Map(task.businesses.map((business) => [business.id, business.name]));
  const items: FeedItem[] = [];
  for (const call of task.calls) {
    for (const event of call.events) {
      const base = { id: event.eventId, at: event.at, businessId: call.business.id };
      if (event.type === "transcript") items.push({ ...base, order: event.sequence, kind: event.speaker, text: event.text });
      if (event.type === "status" && event.status === "failed")
        items.push({ ...base, order: 1e6, kind: "failed", text: `${call.purpose === "quote" ? "Quote" : "Booking"} call failed` });
      if (event.type === "offer")
        items.push({
          ...base,
          order: 1e6,
          kind: "offer",
          text: `Quote captured · ${money(event.offer.amountMinor, event.offer.currency)} · ETA ${event.offer.etaMinutes === null ? "unknown" : `${event.offer.etaMinutes} min`}`,
        });
      if (event.type === "booking_result")
        items.push({ ...base, order: 1e6, kind: "booking", text: `${event.accepted ? "Accepted" : "Not accepted"} · ${event.summary}` });
    }
  }
  items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || b.order - a.order);

  const active = ACTIVE_STEP[task.stage];
  const stopped = task.stage === "no_matches" || task.stage === "failed";

  return (
    <aside className="feed" aria-label="Agent activity">
      <header className="feed-header">
        <LiveDot />
        <span>Agent activity</span>
        <span className="count">{items.length}</span>
      </header>
      <ol className="progress">
        {STEPS.map((step, index) => {
          const state = index < active ? "done" : index === active ? (stopped ? "failed" : "active") : "pending";
          const text = state === "failed" ? (task.stage === "no_matches" ? "No matching businesses found" : (task.error ?? "Task failed")) : step;
          return (
            <li key={step} className={state}>
              <span className="progress-marker">{state === "done" && <Icon name="check" size={10} />}</span>
              {text}
            </li>
          );
        })}
      </ol>
      <ul className="feed-list">
        {items.map((item) => (
          <li key={item.id}>
            <button className={`feed-row kind-${item.kind}`} onClick={() => onOpen(item.businessId)}>
              <span className="glyph">{GLYPH[item.kind]}</span>
              <span className="feed-text">
                <span className="feed-title">
                  <strong>{names.get(item.businessId) ?? "Unknown business"}</strong>
                  <span className="mono muted">{relative(item.at)}</span>
                </span>
                <span className="feed-preview">{item.text}</span>
              </span>
            </button>
          </li>
        ))}
        {items.length === 0 && <li className="feed-empty">Waiting for call activity…</li>}
      </ul>
    </aside>
  );
}
