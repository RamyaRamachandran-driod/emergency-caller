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

Live outbound quote calls use Vonage or Twilio with OpenAI Realtime. A local CLI shows speaker transcripts and structured offers; a provider-only tunnel supplies call audio without deploying a server. The agent closes without a spoken recap. Vonage also offers a spoken connectivity probe. See [voice setup and first call](services/voice/README.md). Live booking remains blocked until dispatch contacts and booking validation are implemented.

## What works in the scaffold
- Three independent backend processes communicating through validated HTTP contracts.
- Authenticated internal endpoints and simulated concurrent call callbacks.
- Typed complaint intake, polling UI, speaker transcripts, offer eligibility and simulated confirmation.
- SQLite task snapshots and durable callback de-duplication in the orchestrator.
- Workspace commands, lockfile, environment template, requirements and CI build.

The orchestrator uses one canonical set of shared Zod contracts. Its discovery and voice clients validate messages at the service boundary; bump the shared contract version and update the matching adapter when a team payload changes. Discovery requests time out after three minutes by default. Kane CLI is the planned generated-journey validation path.

## Not implemented yet
Clarification turns, dispatch-contact collection, live booking validation, offer expiry, production authentication, and deployment. Customer requests are typed. The dashboard defaults to simulation; live discovery and live quote calling are implemented as independently configured services. End-to-end production dispatch is not verified. Do not expose the internal APIs or use the scaffold for actual dispatch.

Use root .env for server credentials; never put OpenAI/Twilio keys into frontend variables. Keep databases, real contacts, recordings, and credentials out of Git.
