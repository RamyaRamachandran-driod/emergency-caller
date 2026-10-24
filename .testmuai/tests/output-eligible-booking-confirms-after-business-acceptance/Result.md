---
test: ../eligible-booking-confirms-after-business-acceptance_test.md
status: passed
started: 2026-10-24T20:50:37.055Z
duration_s: 158
session_id: bcfea4aa-bfd6-4fe8-899f-67a3480508fd
---

# Eligible booking confirms after business acceptance — Result

## Step 1 ✓ passed (31.2s)
md5: 1899cde1cbb96ac206676711e00e185b
At {{start_url}}, describe the breakdown at {{eligible_accepted_location}}, set the user's maximum arrival time to {{max_arrival_time}}, and reach the displayed mechanic offers.

## Step 2 ✓ passed (30s)
md5: 6ce261539e30e695860fa5c9b7d9d051
Select an available-now offer with a known arrival estimate no later than {{max_arrival_time}} without authorizing confirmation, then assert that the eligible offer can be selected and no booking dispatch occurs before user authorization.

## Step 3 ✓ passed (53.4s)
md5: a9e46242549f037bc3353b2057a0da7f
Authorize confirmation for the selected offer while its business has not yet accepted, then assert the booking is not shown as confirmed before explicit business acceptance.

## Step 4 ✓ passed (27.6s)
md5: 4bf0e6f5b667272791d8ac5259ba78d7
Follow the selected offer through its controlled explicit business acceptance, then assert its booking is shown as confirmed after that acceptance.
