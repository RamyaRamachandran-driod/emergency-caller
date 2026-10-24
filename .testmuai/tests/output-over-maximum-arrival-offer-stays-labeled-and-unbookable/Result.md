---
test: ../over-maximum-arrival-offer-stays-labeled-and-unbookable_test.md
status: passed
started: 2026-10-24T20:52:08.319Z
duration_s: 126
session_id: 3ffa1f5a-f230-4bb7-97a3-8f78d7b1abca
---

# Over-maximum arrival offer stays labeled and unbookable — Result

## Step 1 ✓ passed (53.1s)
md5: 110e5f1f07e1b1e9fac2869911f2f585
At {{start_url}}, describe the breakdown at {{over_arrival_location}}, set the user's maximum arrival time to {{max_arrival_time}}, and reach the displayed mechanic offers.

## Step 2 ✓ passed (39.3s)
md5: b3ff12464c847d42912bcace13b43d69
Find an available-now offer with a known arrival estimate later than {{max_arrival_time}} in the offers display, then assert it remains visible and is labeled ineligible.

## Step 3 ✓ passed (31.1s)
md5: a6f3cb7d63c785aa4773c0b6c8be17b7
Try to select that later-than-maximum offer for booking, then assert it cannot be selected for booking.
