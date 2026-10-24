import type { Call, Offer, Task } from "@emergency/shared";
import { Icon, clock, label, money, transcriptOf } from "./ui";

const CHAIN = ["dialing", "connected", "completed"] as const;

function sourceHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function ThreadDrawer({ task, businessId, onClose }: { task: Task; businessId: string; onClose: () => void }) {
  const business = task.businesses.find((entry) => entry.id === businessId);
  if (!business) return null;
  const calls = task.calls.filter((call) => call.business.id === businessId);
  const offer = task.offers.find((entry) => entry.businessId === businessId);
  const source = business.sourceUrl;

  return (
    <aside className="drawer" aria-label={`${business.name} call details`}>
      <button className="drawer-close" onClick={onClose} aria-label="Close details">
        <Icon name="close" />
      </button>
      <div className="drawer-header">
        <h2 className="display">{business.name}</h2>
        <div className="drawer-meta mono">
          <span><Icon name="phone" size={12} /> {business.phone}</span>
          <span><Icon name="clock" size={12} /> Hours {business.openingStatus} · checked {clock(business.checkedAt)}</span>
          <span>
            Source:{" "}
            {!source ? "none listed" : /^https?:\/\//i.test(source) ? (
              <a href={source} target="_blank" rel="noreferrer">{sourceHost(source)} <Icon name="external" size={11} /></a>
            ) : source}
          </span>
        </div>
      </div>
      <div className="drawer-body">
        {calls.length === 0 && <p className="drawer-empty">No call has started for this business.</p>}
        {calls.map((call) => (
          <CallThread key={call.id} call={call} offer={call.purpose === "quote" ? offer : undefined} />
        ))}
      </div>
    </aside>
  );
}

function CallThread({ call, offer }: { call: Call; offer: Offer | undefined }) {
  const current = call.status === "queued" ? -1 : call.status === "failed" ? CHAIN.length - 1 : CHAIN.indexOf(call.status);
  const transcript = transcriptOf(call);
  const bookingResult = call.events.find((event) => event.type === "booking_result");
  return (
    <section className="thread">
      <div className="thread-title">{call.purpose === "quote" ? "Quote call" : "Booking confirmation call"}</div>
      <div className="state-chain">
        {CHAIN.map((step, index) => {
          const failed = call.status === "failed" && index === CHAIN.length - 1;
          return (
            <span key={step} className={index <= current ? "reached" : ""}>
              <i className={failed ? "failed" : index < current ? "past" : index === current ? "now" : ""} />
              {failed ? "failed" : step}
            </span>
          );
        })}
      </div>
      <div className="conversation">
        {transcript.map((segment) => (
          <div className={`message ${segment.speaker}`} key={segment.eventId}>
            <div className="message-meta">
              <span>{segment.speaker === "agent" ? "Agent" : "Business"}</span>
              <span className="mono">{clock(segment.at)}</span>
            </div>
            <p>{segment.text}</p>
          </div>
        ))}
        {transcript.length === 0 && (
          <p className="drawer-empty">{call.status === "failed" ? "No conversation recorded." : "Waiting for the conversation to start."}</p>
        )}
        {offer && (
          <div className="offer-bubble">
            <div className="offer-bubble-top">
              <span>Quote captured</span>
              <strong className="display">{money(offer.amountMinor, offer.currency)}</strong>
              <span className="chip">{label(offer.quoteType)}</span>
            </div>
            <dl>
              <div><dt>ETA</dt><dd>{offer.etaMinutes === null ? "Unknown" : `${offer.etaMinutes} min`}</dd></div>
              <div><dt>Available now</dt><dd>{offer.availableNow ? "Yes" : "No"}</dd></div>
              <div className="wide"><dt>Conditions</dt><dd>{offer.conditions ?? "None stated"}</dd></div>
            </dl>
          </div>
        )}
        {bookingResult && (
          <div className={`booking-status ${bookingResult.accepted ? "confirmed" : "failed"} inline`}>
            <Icon name={bookingResult.accepted ? "check" : "alert"} size={14} />
            <span><strong>{bookingResult.accepted ? "Accepted" : "Not accepted"}</strong> · {bookingResult.summary}</span>
          </div>
        )}
      </div>
    </section>
  );
}
