---
test: ../arrival-exactly-at-maximum-permits-selection_test.md
status: passed
started: 2026-10-24T22:45:03.203Z
duration_s: 83
session_id: 9fda9fe0-00fa-43f3-853b-8c694f0f5bae
---

# Arrival exactly at maximum permits selection — Result

## Step 1 ✓ passed (39.2s)
md5: 1a8dfc0fa6fd1ce3d4312fb1ba5328bd
At {{start_url}}, describe the breakdown at {{at_max_arrival_location}}, set the user's maximum arrival time to {{max_arrival_time}}, and reach the displayed mechanic offers.

## Step 2 ✓ passed (21.9s)
md5: 8d5db1158d9d15aa56fd91741cc6c3ab
Select the available-now offer with a known arrival estimate exactly equal to {{max_arrival_time}}, then assert the offer can be selected for booking.
