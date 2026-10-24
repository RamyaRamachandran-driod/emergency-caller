---
test: ../selecting-without-authorization-does-not-dispatch_test.md
status: passed
started: 2026-10-24T22:18:56.102Z
duration_s: 61
session_id: fbc4fb40-8d67-4f68-b910-ce8c0defabb8
---

# Selecting without authorization does not dispatch — Result

## Step 1 ✓ passed (2.47s)
md5: 362a66b16c0b65c90d1deed8d48c965f
At {{start_url}}, describe the breakdown at {{eligible_unauthed_location}}, set the user's maximum arrival time to {{max_arrival_time}}, and reach the displayed mechanic offers while capturing booking-dispatch traffic.

## Step 2 ✓ passed (42.7s)
md5: 0f3ef31c063a85c80d2dca844629c6b7
Select an available-now offer with a known arrival estimate no later than {{max_arrival_time}} but do not authorize confirmation, then assert that this eligible offer is selectable and no booking dispatch occurs without user authorization.
