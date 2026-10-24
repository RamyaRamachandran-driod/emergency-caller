---
test: ../unavailable-offer-stays-labeled-and-unbookable_test.md
status: passed
started: 2026-10-24T22:49:46.788Z
duration_s: 121
session_id: c3eafcff-4432-49e0-8cc1-0344f2c9dc7c
---

# Unavailable offer stays labeled and unbookable — Result

## Step 1 ✓ passed (36.6s)
md5: d09d820b174c7107ef1b998ad99f8c93
At {{start_url}}, describe the breakdown at {{unknown_availability_location}}, set the user's maximum arrival time to {{max_arrival_time}}, and reach the displayed mechanic offers.

## Step 2 ✓ passed (27.9s)
md5: 06446ba6b8899166e673f086daa191f8
Find an offer unavailable now with a known arrival estimate within {{max_arrival_time}} in the offers display, then assert it remains visible and is labeled ineligible.

## Step 3 ✓ passed (34.9s)
md5: e1f863def25a8b611431dbbccb33d1e2
Try to select that unavailable-now offer for booking, then assert it cannot be selected for booking.
