---
test: ../unknown-arrival-estimate-is-not-fabricated_test.md
status: passed
started: 2026-10-24T22:50:28.657Z
duration_s: 117
session_id: 6789daec-896c-4264-aa17-9933d904367f
---

# Unknown arrival estimate is not fabricated — Result

## Step 1 ✓ passed (28.6s)
md5: 90a004fa5915f80cdb5830c943215c9f
Open {{start_url}} and reach the breakdown request journey for mobile mechanic help.

## Step 2 ✓ passed (68.6s)
md5: 6ddc422d9ecee607cb3ea6be3600628d
In the breakdown request journey, describe the car breakdown and supply {{unknown_arrival_location}}, a seeded case where the mechanic does not report an arrival estimate; reach the comparison view and inspect the transcript and offer, then assert there is no arrival estimate not reported by that mechanic.
