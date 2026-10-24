---
assurance:
  id: t-16
  base: sha256:8e02c5ccaa75991190f224b475debb661be86ac66f224ec046ff45c4cc92fcba
---
# Arrival exactly at maximum permits selection

> An available-now offer with a known arrival estimate exactly equal to the user's maximum can be selected for booking.

## Step 1

At {{start_url}}, describe the breakdown at {{at_max_arrival_location}}, set the user's maximum arrival time to {{max_arrival_time}}, and reach the displayed mechanic offers.

## Step 2 @verifies ac-22

Select the available-now offer with a known arrival estimate exactly equal to {{max_arrival_time}}, then assert the offer can be selected for booking.
