import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { createTask, getTask, requestBooking } from './api'
import { createDemoTask, demoSnapshot } from './demo'
import { ActivityFeed } from './ActivityFeed'
import { Board } from './Board'
import { QuoteBar } from './QuoteBar'
import { ThreadDrawer } from './ThreadDrawer'
import type { CreateTaskInput, TaskSnapshot } from './types'
import { Icon, LiveDot, demoMode, label, money, relative } from './ui'

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
  const [openBusinessId, setOpenBusinessId] = useState<string | null>(null)
  const [pendingOfferId, setPendingOfferId] = useState<string | null>(null)
  const requestDialog = useRef<HTMLDialogElement>(null)
  const bookingDialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (!snapshot) requestDialog.current?.showModal()
    // Only on first load: live mode starts with no task, so ask for one.
  }, [])

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

  const quoteCalls = useMemo(() => snapshot?.calls.filter((call) => call.purpose === 'quote') ?? [], [snapshot?.calls])
  const activeCalls = quoteCalls.filter((call) => ['dialing', 'connected'].includes(call.status)).length
  const canChooseOffer = snapshot?.stage === 'offers_ready'
  const pendingOffer = snapshot?.offers.find((offer) => offer.offerId === pendingOfferId)
  const pendingBusiness = snapshot?.businesses.find((business) => business.businessId === pendingOffer?.businessId)

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
        setOpenBusinessId(null)
        requestDialog.current?.close()
        setNotice('Simulated search started. Fixture events only; no calls are placed.')
        window.setTimeout(() => setSnapshot((current) => current?.taskId === next.taskId ? advanceDemo(current, 'calling') : current), 1200)
        window.setTimeout(() => setSnapshot((current) => current?.taskId === next.taskId ? advanceDemo(current, 'offers_ready') : current), 4000)
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
          setOpenBusinessId(null)
          requestDialog.current?.close()
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

  function reviewOffer(offerId: string) {
    setPendingOfferId(offerId)
    bookingDialog.current?.showModal()
  }

  async function confirmBooking() {
    if (!snapshot || !pendingOfferId) return
    const offerId = pendingOfferId
    bookingDialog.current?.close()
    setError('')
    if (demoMode) {
      setSnapshot((current) => current ? { ...current, selectedOfferId: offerId, stage: 'booking', booking: { status: 'calling', accepted: null, summary: null } } : current)
      window.setTimeout(() => setSnapshot((current) => current ? {
        ...current,
        stage: 'confirmed',
        booking: { status: 'confirmed', accepted: true, summary: 'Demo business explicitly accepted the selected offer.' },
      } : current), 2200)
      return
    }
    setBusy(true)
    try {
      await requestBooking(snapshot.taskId, offerId)
      setSnapshot((current) => current ? { ...current, selectedOfferId: offerId } : current)
      setNotice('Booking confirmation call requested. It is not confirmed until the business explicitly accepts.')
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
    setOpenBusinessId(null)
    setNotice('Sample task restored. No businesses were contacted.')
    setError('')
  }

  return (
    <div className="shell">
      <nav className="rail" aria-label="Main navigation">
        <div className="rail-brand" title="Savior"><Icon name="spark" size={16} /></div>
        <button className="rail-item active" title="Task board" aria-label="Task board"><Icon name="board" /></button>
        <button className="rail-item" title="New request" aria-label="New request" onClick={() => requestDialog.current?.showModal()}><Icon name="plus" /></button>
        {demoMode && <button className="rail-item" title="Reset sample" aria-label="Reset sample" onClick={resetDemo}><Icon name="refresh" /></button>}
      </nav>

      <div className="workspace">
        <header className="task-header">
          {snapshot ? (
            <div className="task-header-main">
              <div className="task-header-line">
                <span className="service-chip">Mobile mechanic</span>
                <strong className="truncate">{snapshot.location}</strong>
                <span className="arrival-chip"><Icon name="clock" size={11} /> within {snapshot.maxArrivalMinutes} min</span>
                <span className="mono muted truncate">{snapshot.vehicle}</span>
              </div>
              <p className="task-problem truncate">{snapshot.problem}</p>
            </div>
          ) : <div className="task-header-main"><strong>No active request</strong><p className="task-problem">Start a request to see calls and offers here.</p></div>}
          {snapshot && (
            <div className="task-stats">
              <span className={`stage stage-${snapshot.stage}`}>{label(snapshot.stage)}</span>
              <span className="stat"><LiveDot /> {relative(snapshot.createdAt)}</span>
              <span className="stat"><span className="mono">{activeCalls}</span> live</span>
              <span className="stat"><span className="mono">{quoteCalls.length}</span> calls</span>
              <span className="stat"><span className="mono">{snapshot.offers.length}</span> quotes</span>
            </div>
          )}
          <span className={`mode-pill ${demoMode ? 'demo' : 'live'}`}>{demoMode ? 'Simulated' : 'Live'}</span>
          <button className="btn primary" onClick={() => requestDialog.current?.showModal()}><Icon name="plus" size={14} /> New request</button>
        </header>

        <div className="workspace-body">
          <div className="center">
            {(demoMode || notice || error || (snapshot?.warnings.length ?? 0) > 0) && (
              <div className="strips">
                {demoMode && <div className="strip demo"><Icon name="alert" size={13} /><span><strong>Simulated demo.</strong> Sample data only. No calls are placed, no contact details are real, and no booking is made.</span></div>}
                {snapshot?.warnings.filter((warning) => !demoMode || !warning.startsWith('Demo')).map((warning) => <div className="strip warn" key={warning}><Icon name="alert" size={13} />{warning}</div>)}
                {notice && <div className="strip info" role="status">{notice}</div>}
                {error && <div className="strip error" role="alert">{error}</div>}
              </div>
            )}
            <main className="board-wrap">
              {snapshot
                ? <Board snapshot={snapshot} openBusinessId={openBusinessId} onOpen={setOpenBusinessId} />
                : <div className="empty"><Icon name="spark" size={22} /><h3>Your search will show up here</h3><p>Share the issue and your location. Calls, transcripts, and quotes appear as they happen.</p><button className="btn primary" onClick={() => requestDialog.current?.showModal()}>Start a request</button></div>}
            </main>
            {snapshot && <QuoteBar snapshot={snapshot} canChoose={canChooseOffer} onPick={reviewOffer} onOpen={setOpenBusinessId} />}
            {snapshot && openBusinessId && <ThreadDrawer snapshot={snapshot} businessId={openBusinessId} onClose={() => setOpenBusinessId(null)} />}
          </div>
          {snapshot && <ActivityFeed snapshot={snapshot} onOpen={setOpenBusinessId} />}
        </div>
      </div>

      <dialog ref={requestDialog} className="modal" aria-labelledby="request-title">
        <form onSubmit={submitRequest}>
          <div className="modal-head">
            <div><h2 id="request-title" className="display">What do you need?</h2><p className="muted">A few details help us ask the right questions.</p></div>
            <button type="button" className="icon-button" aria-label="Close" onClick={() => requestDialog.current?.close()}><Icon name="close" /></button>
          </div>
          <label className="field-label" htmlFor="problem">What happened?</label>
          <textarea id="problem" rows={3} value={problem} onChange={(event) => setProblem(event.target.value)} placeholder="e.g. Flat tire on the front passenger side" required />
          <div className="field-label-row"><label className="field-label" htmlFor="location">Where are you?</label><button type="button" className="text-button" onClick={useCurrentLocation}><Icon name="pin" size={13} /> Use my location</button></div>
          <input id="location" value={location} onChange={(event) => { setLocation(event.target.value); setLocationCoordinates(null) }} placeholder="Address, city, or nearby landmark" required />
          <label className="field-label" htmlFor="vehicle">Vehicle <span className="optional">optional</span></label>
          <input id="vehicle" value={vehicle} onChange={(event) => setVehicle(event.target.value)} placeholder="Year, make, and model" />
          <div className="form-row">
            <div><label className="field-label" htmlFor="arrival">Arrive within</label><select id="arrival" value={arrival} onChange={(event) => setArrival(Number(event.target.value))}><option value={30}>30 minutes</option><option value={45}>45 minutes</option><option value={60}>1 hour</option><option value={90}>90 minutes</option></select></div>
            <div><label className="field-label" htmlFor="budget">Budget (USD) <span className="optional">optional</span></label><input id="budget" inputMode="decimal" value={budget} onChange={(event) => setBudget(event.target.value)} placeholder="Any" /></div>
          </div>
          {notice && <div className="strip info" role="status">{notice}</div>}
          {error && <div className="strip error" role="alert">{error}</div>}
          <button className="btn primary wide" type="submit" disabled={busy || !problem.trim() || !location.trim()}>
            {busy ? 'Starting…' : demoMode ? 'Preview a sample search' : 'Find nearby mechanics'}<Icon name="arrow" size={15} />
          </button>
          <p className="footnote muted">{demoMode ? 'Simulated calls only. No real businesses are contacted.' : 'We ask before requesting any booking.'}</p>
        </form>
      </dialog>

      <dialog ref={bookingDialog} className="modal" aria-labelledby="booking-title">
        {pendingOffer && (
          <div>
            <div className="modal-head">
              <div><h2 id="booking-title" className="display">Request this booking?</h2><p className="muted">{pendingBusiness?.name} will be called to confirm dispatch.</p></div>
              <button type="button" className="icon-button" aria-label="Close" onClick={() => bookingDialog.current?.close()}><Icon name="close" /></button>
            </div>
            <dl className="offer-summary">
              <div><dt>Price</dt><dd>{money(pendingOffer.amountMinor, pendingOffer.currency)} <span className="chip">{label(pendingOffer.quoteType)}</span></dd></div>
              <div><dt>ETA</dt><dd>{pendingOffer.etaMinutes === null ? 'Unknown' : `${pendingOffer.etaMinutes} min`}</dd></div>
              <div><dt>Extra fees</dt><dd>{pendingOffer.extraFees ?? 'None stated'}</dd></div>
              <div><dt>Conditions</dt><dd>{pendingOffer.conditions ?? 'None stated'}</dd></div>
            </dl>
            <p className="footnote muted">This starts a confirmation call. It is not a booking until the business explicitly accepts. Changed terms come back to you; a higher price is never accepted silently.</p>
            <div className="modal-actions">
              <button className="btn" onClick={() => bookingDialog.current?.close()}>Cancel</button>
              <button className="btn primary" onClick={confirmBooking} disabled={busy}>Request confirmation call <Icon name="arrow" size={15} /></button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  )
}

function advanceDemo(snapshot: TaskSnapshot, stage: 'calling' | 'offers_ready'): TaskSnapshot {
  const updated = structuredClone(snapshot)
  updated.stage = stage
  if (stage === 'calling') {
    updated.activity[1].state = 'done'
    updated.activity[2].state = 'active'
    updated.calls = demoSnapshot.calls.map((call, index) => index === 2
      ? { ...call, status: 'dialing', reason: null }
      : { ...call, status: 'connected', transcript: call.transcript.slice(0, 2 - index) })
  } else {
    updated.activity[2].state = 'done'
    updated.activity[3].state = 'active'
    updated.offers = demoSnapshot.offers
    updated.calls = demoSnapshot.calls
  }
  return updated
}
