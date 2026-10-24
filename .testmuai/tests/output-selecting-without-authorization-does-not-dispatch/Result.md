---
test: ../selecting-without-authorization-does-not-dispatch_test.md
status: passed
started: 2026-10-24T21:37:10.724Z
duration_s: 41
session_id: 6f5bc4cf-3d76-4e57-8c39-6154b78696e8
---

# Selecting without authorization does not dispatch — Result

## Step 1 ✓ passed (2.43s)
md5: 362a66b16c0b65c90d1deed8d48c965f
At {{start_url}}, describe the breakdown at {{eligible_unauthed_location}}, set the user's maximum arrival time to {{max_arrival_time}}, and reach the displayed mechanic offers while capturing booking-dispatch traffic.

## Step 2 ✓ passed (27.9s)
md5: 0f3ef31c063a85c80d2dca844629c6b7
Select an available-now offer with a known arrival estimate no later than {{max_arrival_time}} but do not authorize confirmation, then assert that this eligible offer is selectable and no booking dispatch occurs without user authorization.
