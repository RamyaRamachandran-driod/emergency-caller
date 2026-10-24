import { Icon } from "./ui";

const STEPS = [
  { title: "Tell us what happened", text: "Describe the breakdown and where you are. Pick how soon someone needs to arrive." },
  { title: "We call three mechanics at once", text: "Up to three nearby mobile mechanics, called in parallel. Watch each call and its transcript live." },
  { title: "You pick, they confirm", text: "Compare price, arrival time, and terms. Choose one; it's booked only when the business says yes." },
];

const PROMISES = [
  { icon: "check", title: "Nothing booked without your OK", text: "Picking an offer starts a confirmation call. You authorize it first." },
  { icon: "alert", title: "Unknowns stay unknown", text: "No price or arrival time is guessed. If a mechanic didn't say, you'll see that." },
  { icon: "phone", title: "Confirmed means they said yes", text: "A booking shows as confirmed only after the business explicitly accepts." },
  { icon: "clock", title: "Late offers can't be booked", text: "Offers outside your arrival window stay visible and labeled, never auto-picked." },
];

export function Landing() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <a className="landing-brand" href="/">
          <span className="rail-brand"><Icon name="spark" size={16} /></span>
          Emergency caller
        </a>
        <a className="btn" href="/app">Open the app <Icon name="arrow" size={14} /></a>
      </header>

      <main className="landing-main">
        <section className="hero">
          <div>
            <p className="eyebrow">Roadside help · on the phone</p>
            <h1>
              Stranded?
              <span className="dot">We call.</span>
            </h1>
            <p className="hero-copy">
              Describe the breakdown. We find up to three mobile mechanics, call them at the same time, and bring back real
              quotes and arrival times. You choose; nothing is booked until the mechanic agrees.
            </p>
            <div className="hero-actions">
              <a className="btn primary" href="/app">Get help now <Icon name="arrow" size={15} /></a>
              <a className="btn ghost" href="#how">See how it works</a>
            </div>
          </div>
          <div className="terminal" aria-label="Example of three calls in progress">
            <div className="terminal-bar"><span className="live-dot" /> 3 calls live</div>
            <pre className="terminal-body">
              <span className="prompt">&gt;</span> flat tire · Sunnyvale, CA · within 30 min{"\n"}
              <span className="dim">  calling 3 mobile mechanics…</span>{"\n\n"}
              <span className="prompt">agent</span>    can you send someone? eta and price?{"\n"}
              <span className="biz">roadside</span> about 25 min, estimated $130{"\n"}
              <span className="biz">rescue  </span> 30 min, $150 for the call-out{"\n"}
              <span className="warn">tow+tire</span> can't say when we'd arrive{"\n\n"}
              <span className="prompt">✓</span> 2 eligible · 1 ETA unknown, not bookable
            </pre>
          </div>
        </section>

        <section className="section" id="how">
          <p className="section-label">How it works</p>
          <h2>Three steps, one phone call you don't make</h2>
          <div className="steps">
            {STEPS.map((step, index) => (
              <div className="step" key={step.title}>
                <div className="step-num">0{index + 1}</div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="section">
          <p className="section-label">Our promises</p>
          <h2>Built for the worst moment of your drive</h2>
          <div className="promises">
            {PROMISES.map((promise) => (
              <div className="promise" key={promise.title}>
                <Icon name={promise.icon} size={18} />
                <div>
                  <h3>{promise.title}</h3>
                  <p>{promise.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="section">
          <div className="verified">
            <div>
              <span className="verified-label"><Icon name="check" size={14} /> Verified by Kane CLI</span>
              <h3>Every promise above is tested in a real browser</h3>
              <p>
                Kane CLI turned our requirements into acceptance criteria and requirement-linked tests, and replays them
                against the app on every change. Last run: 16 of 16 passed.
              </p>
            </div>
            <div className="verified-stats">
              <div><strong>16</strong><span>Tests</span></div>
              <div><strong>23</strong><span>Criteria</span></div>
              <div><strong>88%</strong><span>Proven</span></div>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <span>Built at Kane CLI Hack Day SF</span>
        <span>Simulated calls in test mode · no real dispatch</span>
      </footer>
    </div>
  );
}
