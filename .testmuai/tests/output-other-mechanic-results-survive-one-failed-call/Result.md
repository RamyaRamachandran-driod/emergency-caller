---
test: ../other-mechanic-results-survive-one-failed-call_test.md
status: passed
started: 2026-10-24T22:46:26.723Z
duration_s: 111
session_id: 1bf3a8ef-1ce7-490c-938f-bee7d8200dce
---

# Other mechanic results survive one failed call — Result

## Step 1 ✓ passed (27.8s)
md5: 90a004fa5915f80cdb5830c943215c9f
Open {{start_url}} and reach the breakdown request journey for mobile mechanic help.

## Step 2 ✓ passed (37.8s)
md5: 8af6f092efc3fe2df395e9cc3418c1cd
In the breakdown request journey, describe the car breakdown and supply {{failed_call_location}}, a seeded location with at least two candidate mechanics including one successful call and one failed call; wait for the successful mechanic's result to appear.

## Step 3 ✓ passed (23.1s)
md5: 87ebe8b659378e45f99e2a02464e3251
On the mechanic comparison view, let the other mechanic's call fail, then assert the successful mechanic's result is still present rather than removed by that failure.
