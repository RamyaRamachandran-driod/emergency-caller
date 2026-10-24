---
test: ../eligible-booking-confirms-after-business-acceptance_test.md
status: failed
started: 2026-10-24T22:45:23.115Z
duration_s: 124
session_id: 18053346-b355-4b93-b2fc-6cac1b896958
---

# Eligible booking confirms after business acceptance — Result

## Step 1 ✓ passed (40.6s)
md5: 1899cde1cbb96ac206676711e00e185b
At {{start_url}}, describe the breakdown at {{eligible_accepted_location}}, set the user's maximum arrival time to {{max_arrival_time}}, and reach the displayed mechanic offers.

## Step 2 ✓ passed (23.7s)
md5: 6ce261539e30e695860fa5c9b7d9d051
Select an available-now offer with a known arrival estimate no later than {{max_arrival_time}} without authorizing confirmation, then assert that the eligible offer can be selected and no booking dispatch occurs before user authorization.

## Step 3 ✗ failed (39.8s)
md5: a9e46242549f037bc3353b2057a0da7f
Reason: Final verification failed: "the booking is not shown as confirmed before explicit business acceptance" — bug verdict: Confirmation-state assertion misread pending booking [automation_bug/agent_misstep, confidence 0.94]
Authorize confirmation for the selected offer while its business has not yet accepted, then assert the booking is not shown as confirmed before explicit business acceptance.

## Step 4 ✓ passed (—)
md5: 4bf0e6f5b667272791d8ac5259ba78d7
Follow the selected offer through its controlled explicit business acceptance, then assert its booking is shown as confirmed after that acceptance.
