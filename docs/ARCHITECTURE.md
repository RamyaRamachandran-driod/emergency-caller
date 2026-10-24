# Architecture and ownership

```mermaid
flowchart TD
 UI[Dashboard and Kane - Khushi] -->|HTTP submit / poll / select| O[Orchestrator - Ramya]
 O -->|POST /discover| D[Discovery - Safi]
 D -->|Sourced shortlist| O
 O -->|POST /calls| V[Voice - Tanay]
 V -->|POST /internal/events| O
 V <--> T[Vonage or Twilio + OpenAI Realtime]
 O --> DB[(SQLite)]
```

## Ramya: services/orchestrator
Own shared contracts, backend API, coordination, SQLite persistence, and validation. After discovery, candidates remain visible in the `found` stage for `FOUND_STAGE_HOLD_MS` (default 5 seconds), then up to three quote calls are queued concurrently. The orchestrator stores task snapshots and callback de-duplication records in SQLite. Discovery and voice calls cross explicit HTTP client boundaries that validate the shared Zod contracts; evolve those shared contracts and client adapters together when an agent's payload changes. Discovery gets a three-minute request timeout by default. The dashboard supports simulation or live quote workflows. GET /api/setup checks discovery and voice health, matching modes, live readiness, and sourced destination policy. Tasks are marked simulated only in test mode. Duplicate submission keys reuse the existing task. Live booking is rejected before claiming a booking attempt.

## Safi: services/discovery
Implement OpenAI web search discovery using breakdown location, backend-supplied UTC time, and the location's IANA timezone. Return at most three deduplicated businesses, normalized published phone numbers, source URLs, opening status, and warnings. Missing hours remain unknown. Opening hours do not establish a 30-minute ETA. Test mode returns fictional businesses. Live mode uses OpenAI web search with sourced, normalized business candidates.

## Tanay: services/voice
Own Vonage/Twilio outbound calling and media WebSockets to OpenAI Realtime. Give each call an isolated context and task/call IDs. Emit finalized ordered speaker-labeled transcripts, call lifecycle, supported quotes, and explicit booking acceptance. Verify Twilio signatures, bound call duration, and handle voicemail/no answer/disconnect. Quote calls cannot dispatch. Booking calls must reconfirm selected terms and collect the user's dispatch contact first; changed terms return to the user. The voice worker now supports live quote calls via a provider-only tunnel, isolated Realtime sessions, signed callbacks, transcript-supported quote tools, local journaling, and callback retry/deduplication. Live booking remains blocked pending dispatch contacts and durable orchestrator state. Vonage supports an independent connection probe and PCM media adapter; Twilio uses PCMU. See services/voice/README.md for the stand-alone local rehearsal.

## Khushi: apps/dashboard and tests/kane
Own typed complaint input, breakdown location, clarification UI, progress counts, transcripts, offer comparison and explicit selection. Browser timezone in the scaffold is only a placeholder: use the breakdown location's timezone in live discovery. Poll GET /api/tasks/:id every second. Implement Kane assurance ingestion/design, generated suites, evidence, and the required release gate. Test mode shares workflow code but replaces discovery/call adapters. No handwritten Kane cases. A team-phone live integration check is separate from deterministic browser evidence.

## Interfaces
All runtime request/event schemas and the internal API contract version live in packages/shared/src/index.ts. Internal discovery, voice and callback endpoints require INTERNAL_SERVICE_TOKEN and the matching x-emergency-contract-version. Payload shape changes must update the shared schema and the relevant service adapter together; incompatible versions fail explicitly. The browser only talks to orchestrator. Services use HTTP; voice acknowledges immediately and reports progress through callbacks. Bind locally during development and expose only the voice provider endpoints through a tunnel once implemented.

Current endpoints: GET /api/setup, POST /api/tasks, GET /api/tasks/:id, POST /api/tasks/:id/book (body offerId), POST /internal/events; POST /discover; POST /calls; GET /health on each service. VOICE_MODE independently selects simulated or live quote calls. Missing voice configuration returns 503 and live booking returns 409. The local voice CLI can rehearse a quote call without the dashboard or orchestrator.

## Integration order
1. Agree on contracts; all four work in their owned directories.
2. Tanay proves one real call to a teammate; Safi proves sourced search; Ramya maintains orchestration and persistence; Khushi builds typed input/transcripts and generates Kane tests.
3. Connect a single complete quote flow, then three concurrent calls.
4. Collect dispatch contact, reconfirm terms and acceptance; protect against duplicate dispatch.
5. Run Kane verification and a separate live phone rehearsal. Configure the Kane check as required before deployment.

## API references
- https://developers.openai.com/api/docs/guides/structured-outputs
- https://developers.openai.com/api/docs/guides/tools-web-search
- https://developers.openai.com/api/docs/guides/realtime-conversations
