# Savior dashboard

Khushi's React dashboard and Kane CLI starter, following the team architecture in the root `README.md`. Until the backend in `apps/server` is available, the app runs in a browser-only fixture mode. Fixture mode makes no calls and creates no real bookings.

## Start locally

```sh
cd apps/web
npm install
npm run dev
```

The default `VITE_APP_MODE=test` shows clearly labeled fixture data. To connect to the shared backend, set `VITE_APP_MODE=live` and `VITE_API_BASE_URL` in a local `.env` file. The backend must serve the agreed endpoints and snapshot shape described in `requirements/savior-dashboard.md` (repo root) and `src/types.ts`.

## Dashboard scope

The layout follows the Tavi command-web reference: a task header, a call board, a ranked offer bar, a per-business call drawer, and an activity feed.

- Request entry in a dialog: problem, location or browser location lookup, vehicle details, arrival target, and optional budget.
- Call board with Queued, On the call, Quoted, and No quote lanes for up to three businesses.
- Call drawer with business sources, call state chain, ordered speaker-labeled transcript, and the captured offer with unknown values shown as unknown.
- Offer bar ranked eligible-first by price. Offers with an unknown ETA, no availability, or an ETA over the arrival goal are labeled not eligible and cannot be booked.
- Booking requires an explicit confirmation dialog. Confirmed appears only when the backend reports explicit business acceptance; fixture acceptance is labeled as simulated. Changed terms, declines, and unclear outcomes are shown and never treated as booked.
- The dashboard polls active live tasks every second. Browser code never calls Twilio or OpenAI directly.

Voice recording, backend implementation, sourced business discovery, and real phone calls remain with the relevant backend team owners.

## Kane CLI assurance

Use the root `requirements/savior-dashboard.md` as the source for Kane assurance. Check the installed release with `kane-cli --version`; this event requires the 0.10.0 release candidate or newer. Once the team agrees on the requirement text and shared-project setup, ingest it from the repository root with:

```sh
kane-cli context ingest requirements/savior-dashboard.md --mode agent
```

Kane pauses for a human review of extracted use cases and again for the designed tests. Follow those review checkpoints before authoring or running tests. Do not hand-write `_test.md` files. The UI fixture alone does not validate backend logic or prove that a real call occurred.
