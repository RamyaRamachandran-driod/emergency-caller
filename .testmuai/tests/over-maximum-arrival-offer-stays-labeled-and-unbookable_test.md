---
assurance:
  id: t-15
  base: sha256:ed3d479a8891f1c9e3627ecc1efbc4c43cc2af316447484b5d640e0964e39c23
---
# Over-maximum arrival offer stays labeled and unbookable

> An available-now offer with a known arrival later than the user's maximum remains visible and labeled ineligible but cannot be selected.

## Step 1

At {{start_url}}, describe the breakdown at {{over_arrival_location}}, set the user's maximum arrival time to {{max_arrival_time}}, and reach the displayed mechanic offers.

## Step 2 @verifies ac-20, ac-21

Find an available-now offer with a known arrival estimate later than {{max_arrival_time}} in the offers display, then assert it remains visible and is labeled ineligible.

## Step 3 @verifies ac-19

Try to select that later-than-maximum offer for booking, then assert it cannot be selected for booking.
