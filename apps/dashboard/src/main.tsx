import React, { useState, useEffect } from "react";
import { createRoot } from "react-dom/client";
import type { Task } from "@emergency/shared";
import "./style.css";
function App() {
  const [task, setTask] = useState<Task | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!task?.id) return;
    let stopped = false;
    const timer = setInterval(async () => {
      try {
        const r = await fetch(`/api/tasks/${task.id}`);
        if (!r.ok) throw new Error("Could not refresh task");
        const t = await r.json();
        if (!stopped) setTask(t);
      } catch (e) {
        if (!stopped) setError(String(e));
      }
    }, 1000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [task?.id]);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const r = await fetch("/api/tasks", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          request: f.get("request"),
          location: f.get("location"),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          maxArrivalMinutes: 30,
        }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Request failed");
      setTask(await r.json());
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  async function book(offerId: string) {
    if (!task) return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/tasks/${task.id}/book`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ offerId }),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      setTask(await r.json());
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main>
      <p className="badge">SCAFFOLD · SIMULATED CALLS · NO REAL DISPATCH</p>
      <h1>Help is a conversation away.</h1>
      <p>
        Find a mobile mechanic, compare arrival estimates, and choose an offer.
      </p>
      <form onSubmit={submit}>
        <label>
          What happened?
          <textarea
            name="request"
            required
            defaultValue="My car won’t start. I need a mobile mechanic within 30 minutes."
          />
        </label>
        <label>
          Breakdown location
          <input
            name="location"
            required
            placeholder="Street address and city"
          />
        </label>
        <button disabled={busy}>Find help</button>
      </form>
      {error && <p role="alert">{error}</p>}
      {task && (
        <section>
          <h2>Task: {task.stage.replaceAll("_", " ")}</h2>
          <p>
            {task.calls.filter((c) => c.status === "connected").length} calls
            active · {task.calls.filter((c) => c.status === "completed").length}{" "}
            completed
          </p>
          {task.warnings.map((w) => (
            <p key={w}>{w}</p>
          ))}
          {task.error && <p role="alert">{task.error}</p>}
          <div className="grid">
            {task.calls.map((c) => (
              <article key={c.id}>
                <h3>{c.business.name}</h3>
                <p>
                  {c.purpose} · {c.status}
                </p>
                {c.events
                  .filter((e) => e.type === "transcript")
                  .sort(
                    (a, b) =>
                      (a.type === "transcript" ? a.sequence : 0) -
                      (b.type === "transcript" ? b.sequence : 0),
                  )
                  .map((e) => (
                    <p key={e.eventId}>
                      {e.type === "transcript" && (
                        <>
                          <strong>{e.speaker}: </strong>
                          {e.text}
                        </>
                      )}
                    </p>
                  ))}
              </article>
            ))}
          </div>
          <h2>Offers</h2>
          <div className="grid">
            {task.offers.map((o) => (
              <article key={o.id}>
                <h3>
                  {task.businesses.find((b) => b.id === o.businessId)?.name}
                </h3>
                <p>
                  {o.etaMinutes ?? "Unknown"} minutes ·{" "}
                  {o.amountMinor === null
                    ? "Price unknown"
                    : new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: o.currency ?? "USD",
                      }).format(o.amountMinor / 100)}{" "}
                  ({o.quoteType})
                </p>
                <p>{o.conditions}</p>
                <button
                  disabled={
                    busy ||
                    task.stage !== "offers_ready" ||
                    !o.availableNow ||
                    o.etaMinutes === null ||
                    o.etaMinutes > task.input.maxArrivalMinutes
                  }
                  onClick={() => book(o.id)}
                >
                  Select and confirm
                </button>
              </article>
            ))}
          </div>
          {task.stage === "confirmed" && (
            <p role="status">
              Simulated booking confirmed. No real mechanic was dispatched.
            </p>
          )}
        </section>
      )}
      <footer>
        Khushi: voice recording, location timezone resolution, and Kane
        integration are next.
      </footer>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
