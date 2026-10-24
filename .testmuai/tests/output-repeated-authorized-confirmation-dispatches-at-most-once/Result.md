---
test: ../repeated-authorized-confirmation-dispatches-at-most-once_test.md
status: passed
started: 2026-10-24T21:02:44.201Z
duration_s: 91
session_id: 0a706bd2-97ab-46be-b6fb-0ff57850333d
---

# Repeated authorized confirmation dispatches at most once — Result

## Step 1 ✓ passed (4.25s)
md5: af1973a487c1331cd73b9267bddd98fd
At {{start_url}}, describe the breakdown at {{eligible_repeat_location}}, set the user's maximum arrival time to {{max_arrival_time}}, and reach the displayed mechanic offers while capturing the app's booking dispatch traffic.

## Step 2 ✓ passed (25.3s)
md5: 6fe51ee9751b9443fd2d56fe06c55a3b
Select an available-now offer with a known arrival estimate no later than {{max_arrival_time}} without authorizing confirmation, then assert the offer is selectable and no booking dispatch occurs before authorization.

## Step 3 ✓ passed (36.3s)
md5: 53c3f9f446c93cf5691dd77392800362
Authorize confirmation and repeat the confirmation action for the same offer and attempt while observing its booking-dispatch traffic, then assert no more than one dispatch occurred for that attempt.
