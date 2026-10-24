---
assurance:
  id: t-12
  base: sha256:d54547295c5ba1c5bc0a2c28f85e387ef43eb72473cf8225db1aad1b2f47ff6a
---
# Selecting without authorization does not dispatch

> Select an eligible offer but do not authorize confirmation; no booking is dispatched.

## Step 1

At {{start_url}}, describe the breakdown at {{eligible_unauthed_location}}, set the user's maximum arrival time to {{max_arrival_time}}, and reach the displayed mechanic offers while capturing booking-dispatch traffic.

## Step 2 @verifies ac-22, ac-16

Select an available-now offer with a known arrival estimate no later than {{max_arrival_time}} but do not authorize confirmation, then assert that this eligible offer is selectable and no booking dispatch occurs without user authorization.
