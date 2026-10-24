---
test: ../dashboard-offers-agree-with-the-same-request-s-server-task_test.md
status: passed
started: 2026-10-24T22:43:00.241Z
duration_s: 96
session_id: 0722a98b-de73-433e-b699-f0c682168c3f
---

# Dashboard offers agree with the same request's server task data — Result

## Step 1 ✓ passed (29.6s)
md5: b5e2b711059530749d187915c9de84d0
At {{start_url}}, open the breakdown request page and observe its browser network responses for this visit.

## Step 2 ✓ passed (63.8s)
md5: 2dae856e6d7ce43c8138c714c46d65e9
On the breakdown request page, describe a car breakdown at {{multiple_offers_location}} and request mobile mechanics; on the resulting dashboard, compare each displayed offer detail with the corresponding task data returned by the app's own server for this same request in the browser network response, then assert every displayed offer detail equals its corresponding returned task field.
