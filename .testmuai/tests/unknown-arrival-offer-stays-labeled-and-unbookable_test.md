---
assurance:
  id: t-14
  base: sha256:8319ef8db4e6b5b2647b869802f1f96899782363e8e35ea6d428d7ecbef6e215
---
# Unknown arrival offer stays labeled and unbookable

> An available-now offer with an unknown arrival estimate remains labeled and visible but cannot be selected for booking.

## Step 1

At {{start_url}}, describe the breakdown at {{unknown_arrival_location}}, set the user's maximum arrival time to {{max_arrival_time}}, and reach the displayed mechanic offers.

## Step 2 @verifies ac-20, ac-21

Find the available-now offer with an unknown arrival estimate in the offers display, then assert it remains visible and is labeled ineligible.

## Step 3 @verifies ac-18

Try to select that unknown-arrival offer for booking, then assert it cannot be selected for booking.
