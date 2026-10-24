import type { BusinessCall, Offer, TaskSnapshot } from './types'
import { Icon, clock, label, money } from './ui'

const CHAIN = ['queued', 'dialing', 'connected', 'completed'] as const

function sourceHost(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return url
  }
}

export function ThreadDrawer({ snapshot, businessId, onClose }: {
  snapshot: TaskSnapshot
  businessId: string
  onClose: () => void
}) {
  const business = snapshot.businesses.find((entry) => entry.businessId === businessId)
  if (!business) return null
  const calls = snapshot.calls.filter((call) => call.businessId === businessId)
  const offer = snapshot.offers.find((entry) => entry.businessId === businessId)

  return (
    <aside className="drawer" aria-label={`${business.name} call details`}>
      <button className="drawer-close" onClick={onClose} aria-label="Close details"><Icon name="close" /></button>
      <div className="drawer-header">
        <h2 className="display">{business.name}</h2>
        <p className="muted">{business.relevance}</p>
        <div className="drawer-meta mono">
          <span><Icon name="phone" size={12} /> {business.phoneE164}</span>
          <span><Icon name="pin" size={12} /> {business.address ?? 'Address unknown'}</span>
          <span>
            Sources:{' '}
            {business.sourceUrls.length === 0 ? 'none listed' : business.sourceUrls.map((url) =>
              /^https?:\/\//i.test(url)
                ? <a key={url} href={url} target="_blank" rel="noreferrer">{sourceHost(url)} <Icon name="external" size={11} /></a>
                : <span key={url}>{url}</span>)}
          </span>
        </div>
      </div>
      <div className="drawer-body">
        {calls.length === 0 && <p className="drawer-empty">No call has started for this business.</p>}
        {calls.map((call) => <CallThread key={call.callId} call={call} offer={call.purpose === 'quote' ? offer : undefined} />)}
      </div>
    </aside>
  )
}

function CallThread({ call, offer }: { call: BusinessCall; offer: Offer | undefined }) {
  const current = call.status === 'failed' ? CHAIN.length - 1 : CHAIN.indexOf(call.status)
  return (
    <section className="thread">
      <div className="thread-title">{call.purpose === 'quote' ? 'Quote call' : 'Booking confirmation call'}</div>
      <div className="state-chain">
        {CHAIN.map((step, index) => {
          const failed = call.status === 'failed' && index === CHAIN.length - 1
          return (
            <span key={step} className={index <= current ? 'reached' : ''}>
              <i className={failed ? 'failed' : index < current ? 'past' : index === current ? 'now' : ''} />
              {failed ? 'failed' : step}
            </span>
          )
        })}
      </div>
      <div className="conversation">
        {[...call.transcript].sort((a, b) => a.sequence - b.sequence).map((segment) => (
          <div className={`message ${segment.speaker}`} key={segment.segmentId}>
            <div className="message-meta"><span>{segment.speaker === 'agent' ? 'Savior agent' : 'Business'}</span><span className="mono">{clock(segment.at)}</span></div>
            <p>{segment.text}</p>
          </div>
        ))}
        {call.transcript.length === 0 && <p className="drawer-empty">{call.status === 'failed' ? 'No conversation recorded.' : 'Waiting for the conversation to start.'}</p>}
        {call.reason && <p className="call-card-note warn"><Icon name="alert" size={12} />{call.reason}</p>}
        {offer && (
          <div className="offer-bubble">
            <div className="offer-bubble-top"><span>Quote captured</span><strong className="display">{money(offer.amountMinor, offer.currency)}</strong><span className="chip">{label(offer.quoteType)}</span></div>
            <dl>
              <div><dt>ETA</dt><dd>{offer.etaMinutes === null ? 'Unknown' : `${offer.etaMinutes} min`}</dd></div>
              <div><dt>Available now</dt><dd>{offer.availableNow === null ? 'Unknown' : offer.availableNow ? 'Yes' : 'No'}</dd></div>
              <div><dt>Extra fees</dt><dd>{offer.extraFees ?? 'None stated'}</dd></div>
              <div><dt>Conditions</dt><dd>{offer.conditions ?? 'None stated'}</dd></div>
            </dl>
          </div>
        )}
      </div>
    </section>
  )
}
