# Emergency Caller

Four-person hackathon monorepo for consumer voice assistance. This is **your own scaffold**; no Tavi code is used.

The scaffold provides a simulated end-to-end workflow with a React dashboard and separate orchestrator, discovery, and voice services.

## Team
| Owner | Workstream |
|---|---|
| Tanay | Voice agent, Twilio, OpenAI Realtime |
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

`npm run build` typechecks every workspace and builds the dashboard. `npm run test:kane` runs generated Kane tests and fails when none exist. The CI workflow currently verifies build only; Kane release enforcement is a remaining Khushi task.

## What works in the scaffold
- Three independent backend processes communicating through validated HTTP contracts.
- Authenticated internal endpoints and simulated concurrent call callbacks.
- Task API, polling UI, speaker transcripts, offer eligibility and simulated confirmation.
- Workspace commands, lockfile, environment template, requirements and CI build.

## Not implemented yet
Real OpenAI or Twilio calls, live search, speech recording/transcription, clarification turns, durable SQLite storage, dispatch-contact collection, offer expiry, production authentication, generated Kane tests, and deployment. Data is memory only; restarting services clears it. Live mode fails explicitly. Do not expose the scaffold to the public internet or use it for actual dispatch.

Use root .env for server credentials; never put OpenAI/Twilio keys into frontend variables. Keep databases, real contacts, recordings, and credentials out of Git.
