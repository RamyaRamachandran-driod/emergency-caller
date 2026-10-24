import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { createTask, getTask, requestBooking } from './api'
import { createDemoTask, demoSnapshot } from './demo'
import type { CreateTaskInput, TaskSnapshot } from './types'

const demoMode = (import.meta.env.VITE_APP_MODE ?? 'test') === 'test'

function money(amountMinor: number | null, currency: string | null): string {
  if (amountMinor === null || !currency) return 'Price not confirmed'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amountMinor / 100)
}

function timeLabel(value: string): string {
  return new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

function statusLabel(status: string): string {
  return status.replaceAll('_', ' ')
}

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    spark: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" /><path d="m19 15 .8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15Z" /></>,
    pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    car: <><path d="m5 11 1.5-4h11L19 11l1.5 1.5V19h-2v-2h-13v2h-2v-6.5L5 11Z" /><path d="M6.5 14h.01M17.5 14h.01M5 11h14" /></>,
    arrow: <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    phone: <><path d="M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M10 17h4" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    refresh: <><path d="M20 7v5h-5" /><path d="M4 17v-5h5" /><path d="M5.5 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.5-3" /></>,
    mic: <><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3m-4 0h8" /></>,
    chevron: <path d="m7 10 5 5 5-5" />,
  }
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

export default function App() {
  const [snapshot, setSnapshot] = useState<TaskSnapshot | null>(demoMode ? demoSnapshot : null)
  const [problem, setProblem] = useState(demoMode ? demoSnapshot.problem : '')
  const [location, setLocation] = useState(demoMode ? demoSnapshot.location : '')
  const [vehicle, setVehicle] = useState(demoMode ? demoSnapshot.vehicle : '')
  const [arrival, setArrival] = useState(demoMode ? demoSnapshot.maxArrivalMinutes : 45)
  const [budget, setBudget] = useState('')
  const [locationCoordinates, setLocationCoordinates] = useState<{ latitude: number; longitude: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [expandedCalls, setExpandedCalls] = useState<string[]>(['demo-call-1'])

  useEffect(() => {
    if (demoMode || !snapshot?.taskId || ['confirmed', 'failed', 'no_matches'].includes(snapshot.stage)) return
    let cancelled = false
    const poll = async () => {
      try {
        const updated = await getTask(snapshot.taskId)
        if (!cancelled) setSnapshot(updated)
      } catch (pollError) {
        if (!cancelled) setError(pollError instanceof Error ? pollError.message : 'Could not refresh this task.')
      }
    }
    const timer = window.setInterval(poll, 1000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [snapshot?.taskId, snapshot?.stage])

  const activeCalls = useMemo(() => snapshot?.calls.filter((call) => ['queued', 'dialing', 'connected'].includes(call.status)).length ?? 0, [snapshot?.calls])
  const completeCalls = useMemo(() => snapshot?.calls.filter((call) => ['completed', 'failed'].includes(call.status)).length ?? 0, [snapshot?.calls])
  const canChooseOffer = snapshot?.stage === 'offers_ready'

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!problem.trim() || !location.trim()) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      if (demoMode) {
        const next = createDemoTask(problem.trim(), location.trim(), vehicle.trim(), arrival)
        setSnapshot(next)
        setExpandedCalls([])
        setNotice('Demo search started. The dashboard will show fixture events; no calls are placed.')
        window.setTimeout(() => setSnapshot((current) => current?.taskId === next.taskId ? advanceDemo(current, 'calling') : current), 900)
        window.setTimeout(() => setSnapshot((current) => current?.taskId === next.taskId ? advanceDemo(current, 'offers_ready') : current), 2600)
      } else {
        const input: CreateTaskInput = {
          service: 'mobile_mechanic',
          problem: problem.trim(),
          location: {
            address: location.trim(),
            latitude: locationCoordinates?.latitude ?? null,
            longitude: locationCoordinates?.longitude ?? null,
          },
          vehicle: { make: null, model: vehicle.trim() || null, year: null },
          maxArrivalMinutes: arrival,
          budgetMinor: budget ? Math.round(Number(budget) * 100) : null,
          currency: 'USD',
        }
        const result = await createTask(input)
        if (result.clarification) {
          setNotice(result.clarification.question)
        } else if (result.taskId) {
          setSnapshot(await getTask(result.taskId))
        } else {
          throw new Error('The server did not return a task ID or clarification.')
        }
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not start the request.')
    } finally {
      setBusy(false)
    }
  }

  async function chooseOffer(offerId: string) {
    if (!snapshot) return
    setError('')
    if (demoMode) {
      setSnapshot((current) => current ? { ...current, selectedOfferId: offerId, booking: { status: 'not_started', accepted: null, summary: null } } : current)
      return
    }
    setSnapshot({ ...snapshot, selectedOfferId: offerId })
  }

  async function confirmBooking() {
    if (!snapshot?.selectedOfferId) return
    setError('')
    if (demoMode) {
      setSnapshot((current) => current ? { ...current, stage: 'booking', booking: { status: 'calling', accepted: null, summary: null } } : current)
      window.setTimeout(() => setSnapshot((current) => current ? {
        ...current,
        stage: 'confirmed',
        booking: { status: 'confirmed', accepted: true, summary: 'Demo business explicitly accepted the selected offer.' },
      } : current), 1400)
      return
    }
    if (!snapshot.taskId) return
    setBusy(true)
    try {
      await requestBooking(snapshot.taskId, snapshot.selectedOfferId)
      setNotice('Booking confirmation call requested. This is not confirmed until the business explicitly accepts.')
    } catch (bookingError) {
      setError(bookingError instanceof Error ? bookingError.message : 'Could not request booking confirmation.')
    } finally {
      setBusy(false)
    }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError('Location sharing is not available in this browser.')
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocationCoordinates({ latitude: coords.latitude, longitude: coords.longitude })
        setLocation(`${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`)
      },
      () => setError('Could not read your location. Enter a nearby address or city instead.'),
      { timeout: 8000 },
    )
  }

  function resetDemo() {
    if (!demoMode) return
    setSnapshot(demoSnapshot)
    setProblem(demoSnapshot.problem)
    setLocation(demoSnapshot.location)
    setVehicle(demoSnapshot.vehicle)
    setArrival(demoSnapshot.maxArrivalMinutes)
    setLocationCoordinates(null)
    setNotice('Sample task restored. No businesses were contacted.')
    setError('')
    setExpandedCalls(['demo-call-1'])
  }

  const selectedOffer = snapshot?.offers.find((offer) => offer.offerId === snapshot.selectedOfferId)
  const selectedBusiness = snapshot?.businesses.find((business) => business.businessId === selectedOffer?.businessId)

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="Savior home">
          <span className="brand-mark"><Icon name="spark" size={21} /></span>
          <span className="brand-name">savior<span>.</span></span>
        </a>
        <nav className="top-nav" aria-label="Main navigation">
          <a className="nav-link active" href="#dashboard">Dashboard</a>
          <a className="nav-link" href="#how-it-works">How it works</a>
        </nav>
        <div className="top-actions">
          <span className={`mode-pill ${demoMode ? 'demo' : 'live'}`}><span className="status-dot" />{demoMode ? 'SIMULATED DEMO' : 'LIVE MODE'}</span>
          <button className="avatar" aria-label="Profile">K</button>
        </div>
      </header>

      <main id="dashboard" className="page-wrap">
        <section className="welcome-row">
          <div>
            <div className="eyebrow"><span className="eyebrow-line" />MOBILE MECHANIC ASSISTANT</div>
            <h1>Roadside help,<br /><span>handled.</span></h1>
            <p className="intro-copy">Tell us what’s wrong. We’ll find nearby mobile mechanics, ask about availability, and bring the options back to you.</p>
          </div>
          <div className="trust-card">
            <div className="trust-icon"><Icon name="check" size={18} /></div>
            <div><strong>You stay in control</strong><span>No booking is made without your choice and the mechanic’s explicit acceptance.</span></div>
          </div>
        </section>

        <div className="dashboard-grid">
          <section className="request-card panel">
            <div className="panel-heading">
              <div><span className="step-label">01 <span>YOUR REQUEST</span></span><h2>What do you need?</h2></div>
              {demoMode && <span className="sample-tag">SAMPLE DATA</span>}
            </div>
            <p className="panel-subtitle">A few details help us ask the right questions.</p>
            <form onSubmit={submitRequest}>
              <label className="field-label" htmlFor="problem">What happened?</label>
              <textarea id="problem" rows={3} value={problem} onChange={(event) => setProblem(event.target.value)} placeholder="e.g. Flat tire on the front passenger side" required />
              <div className="field-label-row"><label className="field-label" htmlFor="location">Where are you?</label><button type="button" className="text-button" onClick={useCurrentLocation}><Icon name="pin" size={14} /> Use my location</button></div>
              <div className="input-icon-wrap"><Icon name="pin" size={17} /><input id="location" value={location} onChange={(event) => { setLocation(event.target.value); setLocationCoordinates(null) }} placeholder="Address, city, or nearby landmark" required /></div>
              <label className="field-label" htmlFor="vehicle">Vehicle <span className="optional">OPTIONAL</span></label>
              <div className="input-icon-wrap"><Icon name="car" size={17} /><input id="vehicle" value={vehicle} onChange={(event) => setVehicle(event.target.value)} placeholder="Year, make, and model" /></div>
              <div className="form-row">
                <div><label className="field-label" htmlFor="arrival">Arrive within</label><div className="select-wrap"><select id="arrival" value={arrival} onChange={(event) => setArrival(Number(event.target.value))}><option value={30}>30 minutes</option><option value={45}>45 minutes</option><option value={60}>1 hour</option><option value={90}>90 minutes</option></select><Icon name="chevron" size={15} /></div></div>
                <div><label className="field-label" htmlFor="budget">Budget <span className="optional">OPTIONAL</span></label><div className="budget-input"><span>$</span><input id="budget" inputMode="decimal" value={budget} onChange={(event) => setBudget(event.target.value)} placeholder="Any" /></div></div>
              </div>
              <button className="primary-button" type="submit" disabled={busy || !problem.trim() || !location.trim()}>
                {busy ? 'Starting…' : demoMode ? 'Preview a sample search' : 'Find nearby mechanics'}<Icon name="arrow" size={17} />
              </button>
              <div className="form-footnote"><Icon name="phone" size={14} /><span>{demoMode ? 'Simulated calls only. No real businesses are contacted.' : 'We’ll ask before requesting a booking.'}</span></div>
            </form>
            {notice && <div className="notice" role="status">{notice}</div>}
            {error && <div className="error-message" role="alert">{error}</div>}
          </section>

          <section className="results-column">
            <div className="section-title-row">
              <div><span className="step-label">02 <span>LIVE SEARCH</span></span><h2>Your options</h2></div>
              <div className="call-count"><span className="pulse-dot" />{snapshot ? `${completeCalls} of ${snapshot.calls.length} calls complete` : 'Waiting for a request'}</div>
            </div>
            {snapshot ? <>
              <div className="task-summary panel">
                <div className="task-summary-top"><div className="task-status"><span className={`stage-dot ${snapshot.stage}`} />{statusLabel(snapshot.stage)}</div><span className="task-time">Started {timeLabel(snapshot.createdAt)}</span></div>
                <div className="task-main"><div><span className="task-problem">{snapshot.problem}</span><div className="task-meta"><span><Icon name="pin" size={14} />{snapshot.location}</span><span><Icon name="car" size={14} />{snapshot.vehicle}</span></div></div><div className="eta-target"><span>ARRIVAL GOAL</span><strong>{snapshot.maxArrivalMinutes}<small> min</small></strong></div></div>
                <div className="progress-rail">{snapshot.activity.map((item) => <div className={`progress-step ${item.state}`} key={item.id}><span className="progress-marker">{item.state === 'done' ? <Icon name="check" size={11} /> : null}</span><span>{item.label}</span></div>)}</div>
              </div>

              {snapshot.stage === 'confirmed' && snapshot.booking.accepted === true && <div className={`booking-banner ${demoMode ? 'simulated' : ''}`}><div className="booking-check"><Icon name="check" size={20} /></div><div><strong>{demoMode ? 'Simulated acceptance' : 'Booking confirmed'}</strong><span>{snapshot.booking.summary ?? 'The business explicitly accepted the dispatch and terms.'}</span>{demoMode && <small>This is fixture data, not a real reservation.</small>}</div></div>}

              <div className="results-heading"><div><h3>Mechanic calls</h3><p>{snapshot.businesses.length} local options · max 3 per request</p></div>{activeCalls > 0 && <span className="active-calls"><span className="pulse-dot" />{activeCalls} in progress</span>}</div>
              <div className="business-list">
                {snapshot.businesses.map((business, index) => {
                  const call = snapshot.calls.find((entry) => entry.businessId === business.businessId && entry.purpose === 'quote')
                  const offer = snapshot.offers.find((entry) => entry.businessId === business.businessId)
                  const isExpanded = call ? expandedCalls.includes(call.callId) : false
                  const isSelected = offer?.offerId === snapshot.selectedOfferId
                  return <article className={`business-card panel ${isSelected ? 'selected' : ''}`} key={business.businessId}>
                    <div className="business-top"><div className="business-rank">0{index + 1}</div><div className="business-info"><div className="business-name-row"><h4>{business.name}</h4><span className={`call-status ${call?.status ?? 'queued'}`}><span />{statusLabel(call?.status ?? 'queued')}</span></div><p>{business.relevance}</p><div className="business-location"><Icon name="pin" size={13} />{business.address ?? 'Location not provided'}<span className={`open-label ${business.openingStatus}`}>{business.openingStatus === 'unknown' ? 'Hours unknown' : business.openingStatus}</span></div></div>
                      <div className="business-offer">{offer ? <><strong>{money(offer.amountMinor, offer.currency)}</strong><span>{offer.quoteType === 'estimate' ? 'estimate' : offer.quoteType === 'fixed' ? 'fixed quote' : 'price unknown'}</span></> : <span className="pending-price">{call?.status === 'failed' ? 'No quote' : 'Waiting for quote'}</span>}</div>
                    </div>
                    {offer && <div className="offer-details"><div className="offer-stat"><span>ARRIVAL</span><strong>{offer.etaMinutes === null ? 'Unknown' : `${offer.etaMinutes} min`}</strong></div><div className="offer-stat"><span>AVAILABLE</span><strong>{offer.availableNow === null ? 'Unknown' : offer.availableNow ? 'Yes' : 'No'}</strong></div><div className="offer-stat"><span>FEES / TERMS</span><strong>{offer.extraFees ?? offer.conditions ?? 'Not confirmed'}</strong></div></div>}
                    {call?.reason && <div className="call-reason">{call.reason}</div>}
                    {offer && canChooseOffer && <button className={`offer-button ${isSelected ? 'chosen' : ''}`} onClick={() => chooseOffer(offer.offerId)}>{isSelected ? <><Icon name="check" size={15} /> Selected</> : 'Choose this offer'}</button>}
                    {call && call.transcript.length > 0 && <>
                      <button className="transcript-toggle" onClick={() => setExpandedCalls((current) => isExpanded ? current.filter((id) => id !== call.callId) : [...current, call.callId])} aria-expanded={isExpanded}>
                        <span><Icon name="phone" size={14} /> Call transcript <small>{call.transcript.length} exchanges</small></span><Icon name="chevron" size={15} />
                      </button>
                      {isExpanded && <div className="transcript-list">{[...call.transcript].sort((left, right) => left.sequence - right.sequence).map((segment) => <div className={`transcript-line ${segment.speaker}`} key={segment.segmentId}><span>{segment.speaker === 'agent' ? 'SAVIOR' : 'BUSINESS'} · {timeLabel(segment.at)}</span><p>{segment.text}</p></div>)}</div>}
                    </>}
                  </article>
                })}
              </div>
              {selectedOffer && <div className="booking-panel panel"><div><span className="step-label">03 <span>YOUR DECISION</span></span><h3>Ready to request this booking?</h3><p>{selectedBusiness?.name} will be called to confirm your selected offer. Any changed terms come back to you for approval.</p></div><button className="primary-button" onClick={confirmBooking} disabled={busy || snapshot.stage === 'booking' || snapshot.stage === 'confirmed'}>{snapshot.stage === 'booking' ? 'Calling to confirm…' : snapshot.stage === 'confirmed' ? 'Confirmation received' : 'Request confirmation call'}<Icon name="arrow" size={17} /></button></div>}
            </> : <div className="empty-state panel"><span className="empty-icon"><Icon name="spark" size={24} /></span><h3>Your search will show up here</h3><p>Share the issue and your location. We’ll keep the quotes, transcripts, and unknown details together.</p></div>}
          </section>
        </div>

        {demoMode && <div className="demo-footer"><span className="demo-footer-mark"><Icon name="spark" size={14} /></span><span><strong>DEMO MODE</strong> Everything shown is sample data. No calls are placed, no contact details are real, and no booking is made.</span><button onClick={resetDemo}><Icon name="refresh" size={14} />Reset sample</button></div>}
        <section id="how-it-works" className="how-section"><span className="eyebrow"><span className="eyebrow-line" />A CLEARER WAY FORWARD</span><h2>Quotes first. Your call, always.</h2><div className="how-grid"><div><span>01</span><strong>Tell us what’s wrong</strong><p>Describe the issue and where you are. We’ll ask for details only when they matter.</p></div><div><span>02</span><strong>Compare real answers</strong><p>See each mechanic’s availability, estimate, timing, and the exact terms they shared.</p></div><div><span>03</span><strong>Confirm together</strong><p>Your choice starts a confirmation call. The booking is real only after the business accepts.</p></div></div></section>
        <footer className="site-footer"><a className="brand compact" href="#top"><span className="brand-mark"><Icon name="spark" size={16} /></span><span className="brand-name">savior<span>.</span></span></a><span>Helpful by design. Honest about what’s unknown.</span><span>© 2026 Savior demo</span></footer>
      </main>
    </div>
  )
}

function advanceDemo(snapshot: TaskSnapshot, stage: 'calling' | 'offers_ready'): TaskSnapshot {
  const updated = structuredClone(snapshot)
  updated.stage = stage
  if (stage === 'calling') {
    updated.activity[1].state = 'done'
    updated.activity[2].state = 'active'
    updated.calls = updated.calls.map((call, index) => ({ ...call, status: index === 2 ? 'failed' : 'completed' }))
  } else {
    updated.activity[2].state = 'done'
    updated.activity[3].state = 'active'
    updated.offers = demoSnapshot.offers
    updated.calls = demoSnapshot.calls
  }
  return updated
}
