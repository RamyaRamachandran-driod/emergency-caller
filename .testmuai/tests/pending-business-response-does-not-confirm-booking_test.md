---
assurance:
  id: t-10
  base: sha256:d57749db4999f31d17727a481433c6faa69877c696e090694ff1b68652944bb5
---
# Pending business response does not confirm booking

> Authorize an eligible offer while business acceptance is still absent; a confirmed booking must not appear.

## Step 1

At {{start_url}}, describe the breakdown at {{eligible_pending_location}}, set the user's maximum arrival time to {{max_arrival_time}}, and reach the displayed mechanic offers.

## Step 2 @verifies ac-22, ac-16

Select an available-now offer with a known arrival estimate no later than {{max_arrival_time}} without authorizing confirmation, then assert that the eligible offer can be selected and no booking dispatch occurs before authorization.

## Step 3 @verifies ac-14

Authorize confirmation for that selected offer while the controlled business response is still pending, then assert no confirmed booking appears before explicit business acceptance.
