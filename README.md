# Emergency Caller

Four-person hackathon monorepo for consumer roadside assistance. This is **your own scaffold**; no Tavi code is used.

The scaffold provides a simulated end-to-end workflow with a React dashboard and separate orchestrator, discovery, and voice services.

## Team
| Owner | Workstream |
|---|---|
| Tanay | Voice agent, Vonage/Twilio, OpenAI Realtime |
| Safi | Businesses and published phone numbers based on location and time |
| Ramya | Main orchestrator, shared backend, database and contracts |
| Khushi | Dashboard UI and Kane CLI integration |

[Architecture, graph and integration plan](docs/ARCHITECTURE.md) · [Shared contracts](packages/shared/src/index.ts)

## Run locally
Requires Node.js 22+ and npm. From this folder:

```sh
cp .env.example .env
# Replace INTERNAL_SERVICE_TOKEN with a local development value.
npm install
npm run dev
```

Open http://localhost:5173. Orchestrator: 4100; discovery: 4101; voice: 4102. Submit a request and location to watch three simulated calls, quotes and a simulated booking confirmation. No real businesses are called. Stop the root process to stop all four components.

`npm run build` typechecks every workspace and builds the dashboard. `npm run test:kane` runs generated Kane tests and fails when none exist. CI verifies the build, voice integration tests, discovery tests, and the generated Kane suite. Kane needs the repository authentication secrets and a required branch-protection check.

## Local voice agent

Live outbound quote calls use Vonage or Twilio with OpenAI Realtime. A local CLI shows speaker transcripts and structured offers; a provider-only tunnel supplies call audio without deploying a server. The agent closes without a spoken recap. Vonage also offers a spoken connectivity probe. See [voice setup and first call](services/voice/README.md). The dashboard can approve a priced quote, collect customer contact details, and call the selected business again to confirm the original price, scope, address and ETA.

## What works in the scaffold
- Three independent backend processes communicating through validated HTTP contracts.
- Authenticated internal endpoints and simulated concurrent call callbacks.
- Typed complaint intake, polling UI, speaker transcripts, offer eligibility and simulated confirmation.
- SQLite task snapshots and durable callback de-duplication in the orchestrator.
- Workspace commands, lockfile, environment template, requirements and CI build.

The orchestrator uses one canonical set of shared Zod contracts. Its discovery and voice clients validate messages at the service boundary; bump the shared contract version and update the matching adapter when a team payload changes. Discovery requests time out after three minutes by default. Kane CLI is the planned generated-journey validation path.

## Not implemented yet
Clarification turns, offer expiry, production authentication, and deployment. Customer requests are typed. The dashboard defaults to simulation. Set APP_MODE=live, VOICE_MODE=live and VOICE_DESTINATION_POLICY=sourced to run discovery and quote calls from the dashboard. GET /api/setup checks service readiness and matching modes before any task starts. Live requests call up to three sourced businesses and stream transcripts and quotes back to the board. Approval starts a separate confirmation call; dispatch is confirmed only after explicit merchant acceptance. End-to-end production dispatch is not verified. Do not expose the internal APIs or use the scaffold for actual dispatch.

Use root .env for server credentials; never put OpenAI/Twilio keys into frontend variables. Keep databases, real contacts, recordings, and credentials out of Git.


### Local live dashboard

Set `APP_MODE=live`, `VOICE_MODE=live`, `VOICE_DESTINATION_POLICY=sourced`, `OPENAI_TEXT_MODEL` and the voice credentials in `.env`. Keep `VOICE_ALLOWED_NUMBERS` for personal CLI tests; sourced calling applies only to authenticated `/calls` requests with a published HTTP(S) business source and a business not known to be closed. Discovery filters phone numbers to US/Canada and uses the breakdown location timezone for opening hours.

Run `npm run voice:tunnel`, keep `PUBLIC_VOICE_URL` current, and run `npm run dev`. Open `/app` for the dashboard (`/` is the landing page). The dashboard proxies to `ORCHESTRATOR_URL`, including when using custom local ports. Check `/api/setup` through the dashboard: all services must use the same mode. **Find and call businesses** starts real quote calls; it does not book or dispatch. Standalone CLI tests can use live voice with `APP_MODE=test`, but mixed service modes cannot start dashboard tasks.

`npm run test:workflow` verifies the live HTTP workflow with stub discovery and an injected phone provider, including transcript/offer callbacks, duplicate submission protection, mixed-mode rejection durable quote approval, duplicate callback protection, and accepted/declined/changed-term confirmation outcomes. It does not place a real call or verify the external discovery model.


### Personal-phone dashboard rehearsal

For a real call only to yourself, set `APP_MODE=live`, `VOICE_MODE=live`, `VOICE_TEST_NUMBER=+YOUR_NUMBER`, `VOICE_ALLOWED_NUMBERS=+YOUR_NUMBER`, and `VOICE_DESTINATION_POLICY=allowlist`. Restart the backend services after changing `.env`. The dashboard shows **Call my phone** and discovers a real matching business and keeps its name, source, and other details, replacing only the phone number with your test number. It uses the first result for exactly one call per request. The voice service rejects every different destination even if sourced calling was accidentally enabled. Answer as the business shown on the card to test availability, ETA, and quote collection. Requests remain real phone calls, not simulated offers. Approving a quote makes one additional call to your test number. A successful test confirmation does not dispatch the real business. Task links use `/app?task=<task-id>` and can restore the task after a refresh.

Call failures include the provider reason in dashboard events. A provider `completed` status without a verified connection is a failed attempt; a later detailed failure callback replaces a generic earlier result. Historical completed calls with recorded failures and no connection are corrected on voice startup without redialing.


### Orchestrator-to-caller brief

The orchestrator sends each quote call an explicit `brief` containing the customer task, objective, information needed, and completion criteria. These describe outcomes rather than dialogue. The caller interprets the service from the actual request, chooses relevant questions and follow-ups, answers interruptions in context, and saves supported results or explicit unknowns. Legacy standalone requests without a brief derive the same outcome brief from their input. The caller introduces itself briefly as Savior on behalf of a customer; it answers truthfully if directly asked about automation. After the person starts speaking, the session retains that the opening phase is finished, including when interrupted audio is truncated. Plumbing requests and other services share this workflow.

### Quote approval

Pick an eligible quote and review the actual business, service address, original price/type, conditions and arrival window. Enter your name and callback number, then choose **Approve & call to confirm**. The orchestrator durably saves the approval and one confirmation-call claim before dialing. Repeated clicks or retries cannot create another call. The merchant must explicitly accept the approved terms; changed price, scope, fees or ETA are returned in the call result and must not be accepted silently. Estimates and visit fees retain their original scope.

The current flow permits one confirmation attempt per task. A declined, changed, interrupted or inconclusive callback stays unconfirmed; review the transcript before arranging a new booking. The original ETA is explicitly requested again from confirmation, rather than treated as a guarantee. Personal-phone mode routes this callback to your phone as well.
