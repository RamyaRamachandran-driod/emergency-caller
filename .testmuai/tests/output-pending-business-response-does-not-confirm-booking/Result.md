---
test: ../pending-business-response-does-not-confirm-booking_test.md
status: passed
started: 2026-10-24T20:52:36.016Z
duration_s: 90
session_id: c764bc9b-4924-4b97-b339-21a039ab95bb
---

# Pending business response does not confirm booking — Result

## Step 1 ✓ passed (35.1s)
md5: aeadb54b0b7005a738754ce2ef6327d0
At {{start_url}}, describe the breakdown at {{eligible_pending_location}}, set the user's maximum arrival time to {{max_arrival_time}}, and reach the displayed mechanic offers.

## Step 2 ✓ passed (29.4s)
md5: 59eca2aa8496fdbfcdfd04e3e20dcad6
Select an available-now offer with a known arrival estimate no later than {{max_arrival_time}} without authorizing confirmation, then assert that the eligible offer can be selected and no booking dispatch occurs before authorization.

## Step 3 ✓ passed (23.7s)
md5: eef939b94337ac49e6657d264b8c9db3
Authorize confirmation for that selected offer while the controlled business response is still pending, then assert no confirmed booking appears before explicit business acceptance.
