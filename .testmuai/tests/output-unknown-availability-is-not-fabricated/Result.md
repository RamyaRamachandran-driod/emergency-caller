---
test: ../unknown-availability-is-not-fabricated_test.md
status: failed
started: 2026-10-24T22:19:58.764Z
duration_s: 98
session_id: 213fae63-1248-4eb6-b2d0-67acdbe46cc9
---

# Unknown availability is not fabricated — Result

## Step 1 ✓ passed (1.52s)
md5: 90a004fa5915f80cdb5830c943215c9f
Open {{start_url}} and reach the breakdown request journey for mobile mechanic help.

## Step 2 ✗ failed (58.2s)
md5: 0d63fdefe8ee61fcf1bddcade7c9bcb3
Reason: Final verification failed: "there is no availability value not reported by that mechanic" — bug verdict: Unknown-availability mechanic displays a 20-minute ETA [application_issue/ui_data_defect, confidence 0.98]
In the breakdown request journey, describe the car breakdown and supply {{unknown_availability_location}}, a seeded case where the mechanic does not report availability; reach the comparison view and inspect the transcript and offer, then assert there is no availability value not reported by that mechanic.
