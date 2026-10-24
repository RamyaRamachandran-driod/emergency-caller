---
assurance:
  id: t-11
  base: sha256:67d1465ed0a469a8ac4e2e4d8fc6430700685cca67301b4cf848fb60761c1a16
---
# Repeated authorized confirmation dispatches at most once

> Authorize an eligible offer, repeat the confirmation action, and observe at most one dispatch for that booking attempt.

## Step 1

At {{start_url}}, describe the breakdown at {{eligible_repeat_location}}, set the user's maximum arrival time to {{max_arrival_time}}, and reach the displayed mechanic offers while capturing the app's booking dispatch traffic.

## Step 2 @verifies ac-22, ac-16

Select an available-now offer with a known arrival estimate no later than {{max_arrival_time}} without authorizing confirmation, then assert the offer is selectable and no booking dispatch occurs before authorization.

## Step 3 @verifies ac-15

Authorize confirmation and repeat the confirmation action for the same offer and attempt while observing its booking-dispatch traffic, then assert no more than one dispatch occurred for that attempt.
