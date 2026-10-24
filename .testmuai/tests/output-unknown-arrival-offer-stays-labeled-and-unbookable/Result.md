---
test: ../unknown-arrival-offer-stays-labeled-and-unbookable_test.md
status: passed
started: 2026-10-24T22:51:06.413Z
duration_s: 112
session_id: f6968db3-f97d-4668-b2d0-bcbd5c5c8c28
---

# Unknown arrival offer stays labeled and unbookable — Result

## Step 1 ✓ passed (39.9s)
md5: 4296d53dbae451fdfb00e773a9b5a116
At {{start_url}}, describe the breakdown at {{unknown_arrival_location}}, set the user's maximum arrival time to {{max_arrival_time}}, and reach the displayed mechanic offers.

## Step 2 ✓ passed (23s)
md5: 8d70ad94a85e401c90baecb6019c00a5
Find the available-now offer with an unknown arrival estimate in the offers display, then assert it remains visible and is labeled ineligible.

## Step 3 ✓ passed (29.4s)
md5: 46091cc947da6a6fbda0d914d3d1a742
Try to select that unknown-arrival offer for booking, then assert it cannot be selected for booking.
