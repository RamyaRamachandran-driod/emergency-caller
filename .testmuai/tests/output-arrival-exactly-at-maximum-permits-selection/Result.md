---
test: ../arrival-exactly-at-maximum-permits-selection_test.md
status: passed
started: 2026-10-24T20:50:33.286Z
duration_s: 82
session_id: c05c5de0-332b-477b-8dd5-941572aa9acb
---

# Arrival exactly at maximum permits selection — Result

## Step 1 ✓ passed (30.3s)
md5: 1a8dfc0fa6fd1ce3d4312fb1ba5328bd
At {{start_url}}, describe the breakdown at {{at_max_arrival_location}}, set the user's maximum arrival time to {{max_arrival_time}}, and reach the displayed mechanic offers.

## Step 2 ✓ passed (31.7s)
md5: 8d5db1158d9d15aa56fd91741cc6c3ab
Select the available-now offer with a known arrival estimate exactly equal to {{max_arrival_time}}, then assert the offer can be selected for booking.
