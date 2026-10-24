# Savior dashboard requirements

## Product

Savior helps a driver with a vehicle problem compare nearby mobile mechanic availability and quotes without calling several businesses themselves. The first demo supports mobile tire service in one city and a maximum of three businesses per request.

## Main user flow

1. The user enters the vehicle problem, location, arrival deadline, and optional vehicle and budget details.
2. If essential details are missing, the application asks a concise clarification question before searching.
3. The system shows no more than three sourced business candidates and the status of each quote call.
4. The dashboard refreshes the task snapshot every second while work is active and keeps transcript segments associated with the correct business and ordered by sequence.
5. Each offer shows price, quote type, ETA, availability, fees, conditions, and unknown values without inventing missing details.
6. An offer is eligible only when backend rules confirm it meets the user's arrival constraint. The user selects at most one eligible offer.
7. Selecting an offer requests one booking confirmation call. The interface reports a confirmed booking only after the business explicitly accepts the selected offer and dispatch terms.
8. If a business changes terms, the interface returns the new terms to the user for a separate decision. It never silently accepts a higher price.

## Demo mode

The dashboard's local fixture mode must be clearly labeled as simulated. It must not dial real phone numbers or present fixture data as live quotes. The real test mode belongs to the backend and uses controlled discovery and call adapters while keeping task, persistence, offer eligibility, and booking logic real. Test data must use a separate database from live mode.

## Kane CLI plan

Kane CLI should verify the real dashboard flow against the backend's controlled test mode. Generate requirement-linked tests from this document with Kane assurance commands; do not hand-author `_test.md` cases. Prioritize clarification, three-business limit, concurrent status updates, ordered transcripts, faithful unknown and fee display, partial call failures, arrival eligibility, offer selection, changed terms, and duplicate booking prevention. Review extracted use cases and designed tests with the team before authoring or running them. Preserve the Kane run report and coverage output for the event submission. A separate test with a team-controlled phone is required for live telephony evidence; fixture runs do not prove real calling.

## Current dashboard contract assumptions

The React dashboard posts task input to `POST /api/tasks`, fetches snapshots from `GET /api/tasks/:id` once per second, and requests confirmation at `POST /api/tasks/:id/book`. The server team must align the snapshot and clarification response shapes with `apps/web/src/types.ts` before integration. Browser code never calls Twilio or OpenAI directly.
