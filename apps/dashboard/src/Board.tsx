import type { Business, Call, Offer, Task } from "@emergency/shared";
import { Icon, LiveDot, ineligibleReason, label, money, relative, transcriptOf } from "./ui";

type LaneId = "queued" | "live" | "quoted" | "closed";

const LANES: Array<{ id: LaneId; title: string; description: string }> = [
  { id: "queued", title: "Found", description: "Waiting to dial" },
  { id: "live", title: "On the call", description: "Dialing or talking now" },
  { id: "quoted", title: "Quoted", description: "Offers to compare" },
  { id: "closed", title: "No quote", description: "Failed or no offer" },
];

interface Row {
  business: Business;
  call: Call | undefined;
  offer: Offer | undefined;
  lane: LaneId;
}

function laneFor(call: Call | undefined, offer: Offer | undefined): LaneId {
  if (!call || call.status === "queued") return "queued";
  if (offer) return "quoted";
  if (call.status === "dialing" || call.status === "connected") return "live";
  return "closed";
}

export function Board({
  task,
  openBusinessId,
  onOpen,
}: {
  task: Task;
  openBusinessId: string | null;
  onOpen: (businessId: string) => void;
}) {
  const rows: Row[] = task.businesses.map((business) => {
    const call = task.calls.find((entry) => entry.business.id === business.id && entry.purpose === "quote");
    const offer = task.offers.find((entry) => entry.businessId === business.id);
    return { business, call, offer, lane: laneFor(call, offer) };
  });
  const selectedBusinessId = task.offers.find((offer) => offer.id === task.selectedOfferId)?.businessId;

  return (
    <div className="board">
      {LANES.map((lane) => {
        const laneRows = rows.filter((row) => row.lane === lane.id);
        return (
          <section className={`lane lane-${lane.id}`} key={lane.id} aria-label={lane.title}>
            <header className="lane-header">
              <div className="lane-title-row">
                <h3>{lane.title}</h3>
                <span className="count">{laneRows.length}</span>
              </div>
              <p>{lane.description}</p>
            </header>
            <div className="lane-body">
              {laneRows.map((row) => (
                <CallCard
                  key={row.business.id}
                  row={row}
                  maxArrivalMinutes={task.input.maxArrivalMinutes}
                  selected={row.business.id === selectedBusinessId}
                  open={row.business.id === openBusinessId}
                  onOpen={onOpen}
                />
              ))}
              {laneRows.length === 0 && <div className="lane-empty">No businesses</div>}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function CallCard({
  row,
  maxArrivalMinutes,
  selected,
  open,
  onOpen,
}: {
  row: Row;
  maxArrivalMinutes: number;
  selected: boolean;
  open: boolean;
  onOpen: (businessId: string) => void;
}) {
  const { business, call, offer, lane } = row;
  const lastAt = call && transcriptOf(call).at(-1)?.at;
  const reason = offer ? ineligibleReason(offer, maxArrivalMinutes) : null;
  return (
    <article className={`call-card rail-${lane}${selected ? " is-selected" : ""}${open ? " is-open" : ""}`}>
      <div className="call-card-top">
        <button className="call-card-name" onClick={() => onOpen(business.id)}>
          {business.name}
        </button>
        {lane === "live" && <LiveDot />}
      </div>
      <div className="chip-row">
        <span className={`chip hours-${business.openingStatus}`}>
          {business.openingStatus === "unknown" ? "hours unknown" : business.openingStatus}
        </span>
        <span className={`status-text status-${call?.status ?? "queued"}`}>{label(call?.status ?? "not called")}</span>
      </div>
      {call?.status === "failed" && <p className="call-card-note warn"><Icon name="alert" size={12} />{call.events.flatMap(e => e.type === "status" && e.status === "failed" && e.reason ? [e.reason] : []).at(-1) ?? "Call failed before a quote"}</p>}
      {reason && <p className="call-card-note warn"><Icon name="alert" size={12} />{reason}</p>}
      <div className="call-card-foot">
        <span className="channel"><Icon name="phone" size={12} /></span>
        <span className="mono muted">{lastAt ? relative(lastAt) : business.phone}</span>
        {offer && (
          <>
            <span className="eta-chip">{offer.etaMinutes === null ? "ETA ?" : `${offer.etaMinutes} min`}</span>
            <span className="price-chip">{offer.amountMinor === null ? "Price ?" : money(offer.amountMinor, offer.currency)}</span>
          </>
        )}
      </div>
    </article>
  );
}
