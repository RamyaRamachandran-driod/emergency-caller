import type { TaskSnapshot } from './types'
import { Icon, LiveDot, money, relative } from './ui'

interface FeedItem {
  id: string
  at: string
  order: number
  businessId: string
  kind: 'agent' | 'business' | 'offer' | 'failed'
  text: string
}

const GLYPH: Record<FeedItem['kind'], string> = { agent: 'S', business: 'B', offer: '$', failed: '!' }

export function ActivityFeed({ snapshot, onOpen }: { snapshot: TaskSnapshot; onOpen: (businessId: string) => void }) {
  const names = new Map(snapshot.businesses.map((business) => [business.businessId, business.name]))
  const items: FeedItem[] = []
  for (const call of snapshot.calls) {
    for (const segment of call.transcript) {
      items.push({ id: segment.segmentId, at: segment.at, order: segment.sequence, businessId: call.businessId, kind: segment.speaker, text: segment.text })
    }
    if (call.status === 'failed') {
      items.push({ id: `${call.callId}-failed`, at: call.transcript.at(-1)?.at ?? snapshot.createdAt, order: 1e6, businessId: call.businessId, kind: 'failed', text: `Call failed · ${call.reason ?? 'no reason given'}` })
    }
  }
  for (const offer of snapshot.offers) {
    items.push({ id: offer.offerId, at: offer.capturedAt, order: 1e6 + 1, businessId: offer.businessId, kind: 'offer', text: `Quote captured · ${money(offer.amountMinor, offer.currency)} · ETA ${offer.etaMinutes === null ? 'unknown' : `${offer.etaMinutes} min`}` })
  }
  items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at) || b.order - a.order)

  return (
    <aside className="feed" aria-label="Agent activity">
      <header className="feed-header"><LiveDot /><span>Agent activity</span><span className="count">{items.length}</span></header>
      <ol className="progress">
        {snapshot.activity.map((step) => (
          <li key={step.id} className={step.state}>
            <span className="progress-marker">{step.state === 'done' && <Icon name="check" size={10} />}</span>
            {step.label}
          </li>
        ))}
      </ol>
      <ul className="feed-list">
        {items.map((item) => (
          <li key={item.id}>
            <button className={`feed-row kind-${item.kind}`} onClick={() => onOpen(item.businessId)}>
              <span className="glyph">{GLYPH[item.kind]}</span>
              <span className="feed-text">
                <span className="feed-title"><strong>{names.get(item.businessId) ?? 'Unknown business'}</strong><span className="mono muted">{relative(item.at)}</span></span>
                <span className="feed-preview">{item.text}</span>
              </span>
            </button>
          </li>
        ))}
        {items.length === 0 && <li className="feed-empty">Waiting for call activity…</li>}
      </ul>
    </aside>
  )
}
