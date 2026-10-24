import type { BusinessCall, BusinessCandidate, Offer, TaskSnapshot } from './types'
import { Icon, LiveDot, ineligibleReason, label, money, relative } from './ui'

type LaneId = 'queued' | 'live' | 'quoted' | 'closed'

const LANES: Array<{ id: LaneId; title: string; description: string }> = [
  { id: 'queued', title: 'Queued', description: 'Found, waiting to dial' },
  { id: 'live', title: 'On the call', description: 'Dialing or talking now' },
  { id: 'quoted', title: 'Quoted', description: 'Offers to compare' },
  { id: 'closed', title: 'No quote', description: 'Failed, unavailable, or no offer' },
]

interface Row {
  business: BusinessCandidate
  call: BusinessCall | undefined
  offer: Offer | undefined
  lane: LaneId
}

function laneFor(call: BusinessCall | undefined, offer: Offer | undefined): LaneId {
  if (!call || call.status === 'queued') return 'queued'
  if (call.status === 'dialing' || call.status === 'connected') return 'live'
  return offer ? 'quoted' : 'closed'
}

export function Board({ snapshot, openBusinessId, onOpen }: {
  snapshot: TaskSnapshot
  openBusinessId: string | null
  onOpen: (businessId: string) => void
}) {
  const rows: Row[] = snapshot.businesses.map((business) => {
    const call = snapshot.calls.find((entry) => entry.businessId === business.businessId && entry.purpose === 'quote')
    const offer = snapshot.offers.find((entry) => entry.businessId === business.businessId)
    return { business, call, offer, lane: laneFor(call, offer) }
  })
  const selectedBusinessId = snapshot.offers.find((offer) => offer.offerId === snapshot.selectedOfferId)?.businessId

  return (
    <div className="board">
      {LANES.map((lane) => {
        const laneRows = rows.filter((row) => row.lane === lane.id)
        return (
          <section className={`lane lane-${lane.id}`} key={lane.id} aria-label={lane.title}>
            <header className="lane-header">
              <div className="lane-title-row"><h3>{lane.title}</h3><span className="count">{laneRows.length}</span></div>
              <p>{lane.description}</p>
            </header>
            <div className="lane-body">
              {laneRows.map((row) => (
                <CallCard
                  key={row.business.businessId}
                  row={row}
                  maxArrivalMinutes={snapshot.maxArrivalMinutes}
                  selected={row.business.businessId === selectedBusinessId}
                  open={row.business.businessId === openBusinessId}
                  onOpen={onOpen}
                />
              ))}
              {laneRows.length === 0 && <div className="lane-empty">No businesses</div>}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function CallCard({ row, maxArrivalMinutes, selected, open, onOpen }: {
  row: Row
  maxArrivalMinutes: number
  selected: boolean
  open: boolean
  onOpen: (businessId: string) => void
}) {
  const { business, call, offer, lane } = row
  const status = call?.status ?? 'queued'
  const lastAt = call?.transcript.at(-1)?.at
  const reason = offer ? ineligibleReason(offer, maxArrivalMinutes) : null
  return (
    <article className={`call-card rail-${lane}${selected ? ' is-selected' : ''}${open ? ' is-open' : ''}`}>
      <div className="call-card-top">
        <button className="call-card-name" onClick={() => onOpen(business.businessId)}>{business.name}</button>
        {lane === 'live' && <LiveDot />}
      </div>
      <div className="chip-row">
        <span className={`chip hours-${business.openingStatus}`}>{business.openingStatus === 'unknown' ? 'hours unknown' : business.openingStatus}</span>
        <span className={`status-text status-${status}`}>{label(status)}</span>
      </div>
      {call?.reason && <p className="call-card-note">{call.reason}</p>}
      {reason && <p className="call-card-note warn"><Icon name="alert" size={12} />{reason}</p>}
      <div className="call-card-foot">
        <span className="channel"><Icon name="phone" size={12} /></span>
        <span className="mono muted">{lastAt ? relative(lastAt) : business.address ?? 'Address unknown'}</span>
        {offer && <>
          <span className="eta-chip">{offer.etaMinutes === null ? 'ETA ?' : `${offer.etaMinutes} min`}</span>
          <span className="price-chip">{offer.amountMinor === null ? 'Price ?' : money(offer.amountMinor, offer.currency)}</span>
        </>}
      </div>
    </article>
  )
}
