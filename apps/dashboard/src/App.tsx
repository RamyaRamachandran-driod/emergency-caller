import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Task } from "@emergency/shared";
import { bookOffer, createTask, getTask, getSetup, type Setup } from "./api";
import { ActivityFeed } from "./ActivityFeed";
import { Board } from "./Board";
import { QuoteBar } from "./QuoteBar";
import { ThreadDrawer } from "./ThreadDrawer";
import { Icon, LiveDot, label, money } from "./ui";

const TERMINAL: Task["stage"][] = ["confirmed", "failed", "no_matches"];

export default function App() {
  const [setup, setSetup] = useState<Setup | null>(null);
  const submission = useRef<{ fingerprint: string; key: string } | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const [request, setRequest] = useState("My car won’t start. I need a mobile mechanic within 30 minutes.");
  const [location, setLocation] = useState("");
  const [arrival, setArrival] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [openBusinessId, setOpenBusinessId] = useState<string | null>(null);
  const [pendingOfferId, setPendingOfferId] = useState<string | null>(null);
  const requestDialog = useRef<HTMLDialogElement>(null);
  const bookingDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let cancelled = false;
    const taskId = new URLSearchParams(window.location.search).get("task");
    if (taskId) {
      getTask(taskId).then(value => { if (!cancelled) setTask(value); }).catch(() => {
        if (!cancelled) { setError("Could not restore the task."); requestDialog.current?.showModal(); }
      });
    } else requestDialog.current?.showModal();
    const refresh = () => getSetup().then(value => { if (!cancelled) setSetup(value); }).catch(() => { if (!cancelled) setSetup(null); });
    void refresh();
    const timer = window.setInterval(refresh, 5000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (!task?.id || TERMINAL.includes(task.stage)) return;
    let cancelled = false;
    const timer = window.setInterval(async () => {
      try {
        const updated = await getTask(task.id);
        if (!cancelled) setTask(updated);
      } catch (pollError) {
        if (!cancelled) setError(pollError instanceof Error ? pollError.message : "Could not refresh this task.");
      }
    }, 1000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [task?.id, task?.stage]);

  const quoteCalls = task?.calls.filter((call) => call.purpose === "quote") ?? [];
  const activeCalls = quoteCalls.filter((call) => call.status === "dialing" || call.status === "connected").length;
  const pendingOffer = task?.offers.find((offer) => offer.id === pendingOfferId);
  const pendingBusiness = task?.businesses.find((business) => business.id === pendingOffer?.businessId);

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!request.trim() || !location.trim()) return;
    setBusy(true);
    setError("");
    try {
      const input = {
        request: request.trim(),
        location: location.trim(),
        // Placeholder per docs/ARCHITECTURE.md: live discovery must use the breakdown location's timezone.
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        maxArrivalMinutes: arrival,
      };
      const fingerprint = JSON.stringify(input);
      if (submission.current?.fingerprint !== fingerprint) submission.current = { fingerprint, key: crypto.randomUUID() };
      const created = await createTask(input, submission.current!.key);
      submission.current = null;
      setTask(created);
      window.history.replaceState(null, "", `${window.location.pathname}?task=${created.id}`);
      setOpenBusinessId(null);
      requestDialog.current?.close();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not start the request.");
    } finally {
      setBusy(false);
    }
  }

  function reviewOffer(offerId: string) {
    setPendingOfferId(offerId);
    bookingDialog.current?.showModal();
  }

  async function confirmBooking() {
    if (!task || !pendingOfferId || busy) return;
    setBusy(true);
    setError("");
    try {
      setTask(await bookOffer(task.id, pendingOfferId));
      bookingDialog.current?.close();
    } catch (bookingError) {
      setError(bookingError instanceof Error ? bookingError.message : "Could not request booking confirmation.");
      bookingDialog.current?.close();
    } finally {
      setBusy(false);
    }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setError("Location sharing is not available in this browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setLocation(`${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`),
      () => setError("Could not read your location. Enter a nearby address or city instead."),
      { timeout: 8000 },
    );
  }

  return (
    <div className="shell">
      <nav className="rail" aria-label="Main navigation">
        <a className="rail-brand" href="/" title="Emergency Caller home" aria-label="Emergency Caller home"><Icon name="spark" size={16} /></a>
        <button className="rail-item active" title="Task board" aria-label="Task board"><Icon name="board" /></button>
        <button className="rail-item" title="New request" aria-label="New request" onClick={() => requestDialog.current?.showModal()}>
          <Icon name="plus" />
        </button>
      </nav>

      <div className="workspace">
        <header className="task-header">
          {task ? (
            <div className="task-header-main">
              <div className="task-header-line">
                <span className="service-chip">Mobile mechanic</span>
                <strong className="truncate">{task.input.location}</strong>
                <span className="arrival-chip"><Icon name="clock" size={11} /> within {task.input.maxArrivalMinutes} min</span>
                <span className="mono muted truncate">{task.input.timezone}</span>
              </div>
              <p className="task-problem truncate">{task.input.request}</p>
            </div>
          ) : (
            <div className="task-header-main">
              <strong>No active request</strong>
              <p className="task-problem">Start a request to see calls and offers here.</p>
            </div>
          )}
          {task && (
            <div className="task-stats">
              <span className={`stage stage-${task.stage}`}>{label(task.stage)}</span>
              <span className="stat"><span className="mono">{activeCalls}</span> live</span>
              <span className="stat"><span className="mono">{quoteCalls.length}</span> calls</span>
              <span className="stat"><span className="mono">{task.offers.length}</span> quotes</span>
            </div>
          )}
          {task && <span className={`mode-pill ${task.simulated ? "demo" : "live"}`}>{task.simulated ? "Simulated" : "Live"}</span>}
          <button className="btn primary" onClick={() => requestDialog.current?.showModal()}>
            <Icon name="plus" size={14} /> New request
          </button>
        </header>

        <div className="workspace-body">
          <div className="center">
            {(task?.simulated || error || task?.error || (task?.warnings.length ?? 0) > 0) && (
              <div className="strips">
                {task?.simulated && (
                  <div className="strip demo">
                    <Icon name="alert" size={13} />
                    <span><strong>Simulated calls.</strong> No real businesses are called and no mechanic is dispatched.</span>
                  </div>
                )}
                {task?.warnings.map((warning) => (
                  <div className="strip warn" key={warning}><Icon name="alert" size={13} />{warning}</div>
                ))}
                {task?.error && <div className="strip error" role="alert">{task.error}</div>}
                {error && <div className="strip error" role="alert">{error}</div>}
              </div>
            )}
            <main className="board-wrap">
              {task ? (
                task.businesses.length > 0 ? (
                  <Board task={task} openBusinessId={openBusinessId} onOpen={setOpenBusinessId} />
                ) : (
                  <div className="empty">
                    {task.stage === "finding" ? <LiveDot /> : <Icon name="alert" size={22} />}
                    <h3>{task.stage === "finding" ? "Finding nearby mobile mechanics…" : "No businesses to call"}</h3>
                    <p>{task.stage === "finding" ? "Up to three businesses will appear here." : "Try a different location or a wider arrival window."}</p>
                  </div>
                )
              ) : (
                <div className="empty">
                  <Icon name="spark" size={22} />
                  <h3>Your search will show up here</h3>
                  <p>Share the issue and your location. Calls, transcripts, and quotes appear as they happen.</p>
                  <button className="btn primary" onClick={() => requestDialog.current?.showModal()}>Start a request</button>
                </div>
              )}
            </main>
            {task && <QuoteBar task={task} onPick={reviewOffer} onOpen={setOpenBusinessId} />}
            {task && openBusinessId && <ThreadDrawer task={task} businessId={openBusinessId} onClose={() => setOpenBusinessId(null)} />}
          </div>
          {task && <ActivityFeed task={task} onOpen={setOpenBusinessId} />}
        </div>
      </div>

      <dialog ref={requestDialog} className="modal" aria-labelledby="request-title">
        <form onSubmit={submitRequest}>
          <div className="modal-head">
            <div>
              <h2 id="request-title" className="display">What do you need?</h2>
              <p className="muted">Describe the breakdown, including your vehicle if you can.</p>
            </div>
            <button type="button" className="icon-button" aria-label="Close" onClick={() => requestDialog.current?.close()}><Icon name="close" /></button>
          </div>
          <label className="field-label" htmlFor="request">What happened?</label>
          <textarea id="request" rows={3} value={request} onChange={(event) => setRequest(event.target.value)} placeholder="e.g. Flat tire on a 2021 Honda Civic" required />
          <div className="field-label-row">
            <label className="field-label" htmlFor="location">Breakdown location</label>
            <button type="button" className="text-button" onClick={useCurrentLocation}><Icon name="pin" size={13} /> Use my location</button>
          </div>
          <input id="location" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Street address and city" required />
          <label className="field-label" htmlFor="arrival">Arrive within</label>
          <select id="arrival" value={arrival} onChange={(event) => setArrival(Number(event.target.value))}>
            <option value={30}>30 minutes</option>
            <option value={45}>45 minutes</option>
            <option value={60}>1 hour</option>
            <option value={90}>90 minutes</option>
          </select>
          <p className="footnote muted">{!setup ? "Checking service readiness…" : setup.testCallNumber ? `Personal-phone test: one real call to ${setup.testCallNumber}. No businesses will be searched or called. Answer as the mechanic.` : setup.mode === "live" ? "Live calling: this will find and phone up to three businesses for quotes. No booking or dispatch is requested." : "Simulation: no real businesses will be called."}</p>
          {setup && !setup.ready && <div className="strip warn">{setup.issues.join(" ")}</div>}
          {error && <div className="strip error" role="alert">{error}</div>}
          <button className="btn primary wide" type="submit" disabled={busy || !setup?.ready || !request.trim() || !location.trim()}>
            {busy ? "Starting…" : setup?.testCallNumber ? "Call my phone" : setup?.mode === "live" ? "Find and call businesses" : "Find help"}
            <Icon name="arrow" size={15} />
          </button>
          <p className="footnote muted">We ask before requesting any booking.</p>
        </form>
      </dialog>

      <dialog ref={bookingDialog} className="modal" aria-labelledby="booking-title">
        {pendingOffer && (
          <div>
            <div className="modal-head">
              <div>
                <h2 id="booking-title" className="display">Request this booking?</h2>
                <p className="muted">{pendingBusiness?.name} will be called to confirm dispatch.</p>
              </div>
              <button type="button" className="icon-button" aria-label="Close" onClick={() => bookingDialog.current?.close()}><Icon name="close" /></button>
            </div>
            <dl className="offer-summary">
              <div><dt>Price</dt><dd>{money(pendingOffer.amountMinor, pendingOffer.currency)} <span className="chip">{label(pendingOffer.quoteType)}</span></dd></div>
              <div><dt>ETA</dt><dd>{pendingOffer.etaMinutes === null ? "Unknown" : `${pendingOffer.etaMinutes} min`}</dd></div>
              <div className="wide"><dt>Conditions</dt><dd>{pendingOffer.conditions ?? "None stated"}</dd></div>
            </dl>
            <p className="footnote muted">
              This starts a confirmation call. It is not a booking until the business explicitly accepts. Changed terms come back to you; a higher price is never accepted silently.
            </p>
            <div className="modal-actions">
              <button className="btn" onClick={() => bookingDialog.current?.close()}>Cancel</button>
              <button className="btn primary" onClick={confirmBooking} disabled={busy}>
                {busy ? "Requesting…" : "Request confirmation call"} <Icon name="arrow" size={15} />
              </button>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
