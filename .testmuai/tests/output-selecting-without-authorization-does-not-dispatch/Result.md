---
test: ../selecting-without-authorization-does-not-dispatch_test.md
status: failed
started: 2026-10-24T22:48:42.634Z
duration_s: 157
session_id: 91d36606-58c7-43ec-bbb2-35a3e2083374
---

# Selecting without authorization does not dispatch — Result

## Step 1 ✓ passed (77.2s)
md5: 362a66b16c0b65c90d1deed8d48c965f
At {{start_url}}, describe the breakdown at {{eligible_unauthed_location}}, set the user's maximum arrival time to {{max_arrival_time}}, and reach the displayed mechanic offers while capturing booking-dispatch traffic.

## Step 2 ✗ failed (60.3s)
md5: 0f3ef31c063a85c80d2dca844629c6b7
Reason: Final verification failed: "{{eligible_offer}} is selectable and no booking dispatch occurs without user authorization." — bug verdict: Assertion evaluated a pre-confirmed booking state [automation_bug/state_transition_bug, confidence 0.90]
Select an available-now offer with a known arrival estimate no later than {{max_arrival_time}} but do not authorize confirmation, then assert that this eligible offer is selectable and no booking dispatch occurs without user authorization.
