import type { Task } from "@emergency/shared";
import { Icon, LiveDot, ineligibleReason, money, rankOffers } from "./ui";

export function QuoteBar({
  task,
  onPick,
  onOpen,
}: {
  task: Task;
  onPick: (offerId: string) => void;
  onOpen: (businessId: string) => void;
}) {
  const max = task.input.maxArrivalMinutes;
  const ranked = rankOffers(task.offers, max);
  if (ranked.length === 0) return null;
  const canChoose = task.stage === "offers_ready";
  const name = (businessId: string) => task.businesses.find((entry) => entry.id === businessId)?.name ?? "Unknown business";
  const top = ranked.find((offer) => !ineligibleReason(offer, max));
  const selected = task.offers.find((offer) => offer.id === task.selectedOfferId);

  return (
    <div className="quote-bar">
      {selected && <BookingStatus task={task} businessName={name(selected.businessId)} />}
      <div className="quote-bar-row">
        <div className="quote-bar-label">
          Offers <span className="mono">{ranked.length}</span>
        </div>
        <ul className="quote-list">
          {ranked.map((offer, index) => {
            const reason = ineligibleReason(offer, max);
            const bookable = canChoose && !reason;
            return (
              <li key={offer.id}>
                <button
                  className={`quote-item${offer === top && !selected ? " is-leader" : ""}${offer === selected ? " is-selected" : ""}${reason ? " is-ineligible" : ""}`}
                  onClick={() => (bookable ? onPick(offer.id) : onOpen(offer.businessId))}
                  title={reason ?? (bookable ? "Review and request booking" : "View call details")}
                >
                  <span className="mono rank">#{index + 1}</span>
                  <span className="quote-price">{money(offer.amountMinor, offer.currency)}</span>
                  <span className="quote-name">{name(offer.businessId)}</span>
                  <span className={`tag${reason ? " warn" : ""}`}>{reason ? "not eligible" : `${offer.etaMinutes} min`}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {canChoose && top && (
          <button className="btn primary" onClick={() => onPick(top.id)}>
            <Icon name="trophy" size={14} /> Book top offer
          </button>
        )}
      </div>
    </div>
  );
}

function BookingStatus({ task, businessName }: { task: Task; businessName: string }) {
  const bookingCall = task.calls.filter((call) => call.purpose === "booking").at(-1);
  if (!bookingCall) return null;
  const result = bookingCall.events.find((event) => event.type === "booking_result");
  if (task.stage === "booking") {
    return (
      <div className="booking-status calling">
        <LiveDot />
        <span><strong>Calling {businessName} to confirm.</strong> Nothing is booked until they explicitly accept.</span>
      </div>
    );
  }
  if (task.stage === "confirmed" && task.bookingAccepted === true) {
    return (
      <div className={`booking-status confirmed${task.simulated ? " simulated" : ""}`}>
        <Icon name="check" size={16} />
        <span>
          <strong>{task.simulated ? "Simulated acceptance" : "Booking confirmed"}</strong> ·{" "}
          {result?.summary ?? `${businessName} explicitly accepted the dispatch and terms.`}
          {task.simulated && " · No real mechanic was dispatched."}
        </span>
      </div>
    );
  }
  if (result && !result.accepted) {
    return (
      <div className="booking-status failed">
        <Icon name="alert" size={16} />
        <span><strong>{businessName} did not accept.</strong> {result.summary} Nothing was booked; choose an offer again.</span>
      </div>
    );
  }
  if (bookingCall.status === "failed") {
    return (
      <div className="booking-status failed">
        <Icon name="alert" size={16} />
        <span><strong>Confirmation call to {businessName} failed.</strong> Nothing was booked; choose an offer again.</span>
      </div>
    );
  }
  return null;
}
