# Orchestrator service

Owner: **Ramya**. Default port: **4100**.

Run from the repository root with `npm run dev -w @emergency/orchestrator`.

## Responsibilities

- Accept typed breakdown descriptions and location through `/api/tasks`.
- Coordinate discovery, concurrent quote calls, offers, and an explicitly requested booking call.
- Persist task snapshots and processed event IDs in SQLite. Interrupted work is marked failed at restart and is never dialed again automatically.
- Expose task snapshots for the dashboard and validate all incoming agent events against the shared schemas.

## Module boundaries

- `src/index.ts` contains the HTTP routes and service startup/shutdown.
- `src/coordinator.ts` owns task workflow and agent coordination.
- `src/service-clients.ts` owns discovery/voice HTTP calls, timeouts, and shared-contract validation.
- `src/store.ts` owns SQLite persistence, atomic booking claims, and callback de-duplication.
- `packages/shared/src/index.ts` is the canonical request, response, and event contract. Internal calls use its contract version. Change shared schemas and the relevant service adapter together; incompatible internal versions fail with HTTP 426.

Discovery has a three-minute timeout by default (`DISCOVERY_TIMEOUT_MS=180000`); change it in the root `.env` if needed. Voice's call-start acknowledgement has a separate 15-second timeout (`VOICE_REQUEST_TIMEOUT_MS`).

The scaffold runs in simulated mode by default. Kane CLI generated journeys are the project validation path; do not hand-write Kane `_test.md` cases. See `tests/kane/README.md` and `docs/ARCHITECTURE.md`.
