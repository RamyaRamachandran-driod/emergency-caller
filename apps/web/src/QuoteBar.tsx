import type { TaskSnapshot } from './types'
import { Icon, LiveDot, demoMode, ineligibleReason, money, rankOffers } from './ui'

export function QuoteBar({ snapshot, canChoose, onPick, onOpen }: {
  snapshot: TaskSnapshot
  canChoose: boolean
  onPick: (offerId: string) => void
  onOpen: (businessId: string) => void
}) {
  const ranked = rankOffers(snapshot.offers, snapshot.maxArrivalMinutes)
  if (ranked.length === 0) return null
  const name = (businessId: string) => snapshot.businesses.find((entry) => entry.businessId === businessId)?.name ?? 'Unknown business'
  const top = ranked.find((offer) => !ineligibleReason(offer, snapshot.maxArrivalMinutes))
  const selected = snapshot.offers.find((offer) => offer.offerId === snapshot.selectedOfferId)

  return (
    <div className="quote-bar">
      {selected && <BookingStatus snapshot={snapshot} businessName={name(selected.businessId)} />}
      <div className="quote-bar-row">
        <div className="quote-bar-label">Offers <span className="mono">{ranked.length}</span></div>
        <ul className="quote-list">
          {ranked.map((offer, index) => {
            const reason = ineligibleReason(offer, snapshot.maxArrivalMinutes)
            const bookable = canChoose && !reason
            return (
              <li key={offer.offerId}>
                <button
                  className={`quote-item${offer === top && !selected ? ' is-leader' : ''}${offer === selected ? ' is-selected' : ''}${reason ? ' is-ineligible' : ''}`}
                  onClick={() => (bookable ? onPick(offer.offerId) : onOpen(offer.businessId))}
                  title={reason ?? (bookable ? 'Review and request booking' : 'View call details')}
                >
                  <span className="mono rank">#{index + 1}</span>
                  <span className="quote-price">{money(offer.amountMinor, offer.currency)}</span>
                  <span className="quote-name">{name(offer.businessId)}</span>
                  <span className={`tag${reason ? ' warn' : ''}`}>{reason ? 'not eligible' : `${offer.etaMinutes} min`}</span>
                </button>
              </li>
            )
          })}
        </ul>
        {canChoose && top && <button className="btn primary" onClick={() => onPick(top.offerId)}><Icon name="trophy" size={14} /> Book top offer</button>}
      </div>
    </div>
  )
}

function BookingStatus({ snapshot, businessName }: { snapshot: TaskSnapshot; businessName: string }) {
  const { status, accepted, summary } = snapshot.booking
  if (status === 'not_started') return null
  if (status === 'calling') {
    return <div className="booking-status calling"><LiveDot /><span><strong>Calling {businessName} to confirm.</strong> Nothing is booked until they explicitly accept.</span></div>
  }
  if (status === 'confirmed' && accepted === true) {
    return (
      <div className={`booking-status confirmed${demoMode ? ' simulated' : ''}`}>
        <Icon name="check" size={16} />
        <span><strong>{demoMode ? 'Simulated acceptance' : 'Booking confirmed'}</strong> · {summary ?? `${businessName} explicitly accepted the dispatch and terms.`}{demoMode && ' Fixture data, not a real reservation.'}</span>
      </div>
    )
  }
  if (status === 'terms_changed') {
    return <div className="booking-status warn"><Icon name="alert" size={16} /><span><strong>{businessName} proposed changed terms.</strong> {summary} Nothing was accepted. Your decision is needed.</span></div>
  }
  if (status === 'declined') {
    return <div className="booking-status failed"><Icon name="alert" size={16} /><span><strong>{businessName} declined.</strong> {summary} Choose another offer.</span></div>
  }
  return <div className="booking-status warn"><Icon name="alert" size={16} /><span><strong>Outcome unclear.</strong> {summary} This is not treated as a booking.</span></div>
}
