---
assurance:
  id: t-13
  base: sha256:d6f3ec188c2683fcd64c636335ec79dd6aa39c88ea82cd1088770d43afa303be
---
# Unavailable offer stays labeled and unbookable

> An offer unavailable now is displayed and labeled ineligible but cannot be selected for booking even with a known arrival within the user's maximum.

## Step 1

At {{start_url}}, describe the breakdown at {{unknown_availability_location}}, set the user's maximum arrival time to {{max_arrival_time}}, and reach the displayed mechanic offers.

## Step 2 @verifies ac-20, ac-21

Find an offer unavailable now with a known arrival estimate within {{max_arrival_time}} in the offers display, then assert it remains visible and is labeled ineligible.

## Step 3 @verifies ac-17

Try to select that unavailable-now offer for booking, then assert it cannot be selected for booking.
