---
assurance:
  id: t-9
  base: sha256:f8ca4462aebb138815dd493967845193af6efa392f178b3084104ff50966a490
---
# Eligible booking confirms after business acceptance

> Select an available-now offer with known arrival within the user's maximum, authorize confirmation, and observe confirmation only after the business explicitly accepts.

## Step 1

At {{start_url}}, describe the breakdown at {{eligible_accepted_location}}, set the user's maximum arrival time to {{max_arrival_time}}, and reach the displayed mechanic offers.

## Step 2 @verifies ac-22, ac-16

Select an available-now offer with a known arrival estimate no later than {{max_arrival_time}} without authorizing confirmation, then assert that the eligible offer can be selected and no booking dispatch occurs before user authorization.

## Step 3 @verifies ac-14

Authorize confirmation for the selected offer while its business has not yet accepted, then assert the booking is not shown as confirmed before explicit business acceptance.

## Step 4 @verifies ac-23

Follow the selected offer through its controlled explicit business acceptance, then assert its booking is shown as confirmed after that acceptance.
