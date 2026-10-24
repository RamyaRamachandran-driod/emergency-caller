---
test: ../unknown-availability-is-not-fabricated_test.md
status: passed
started: 2026-10-24T22:51:27.314Z
duration_s: 104
session_id: 213a4204-cd59-4337-9f18-b7a68a6a7e14
---

# Unknown availability is not fabricated — Result

## Step 1 ✓ passed (10.9s)
md5: 90a004fa5915f80cdb5830c943215c9f
Open {{start_url}} and reach the breakdown request journey for mobile mechanic help.

## Step 2 ✓ passed (66s)
md5: 0d63fdefe8ee61fcf1bddcade7c9bcb3
In the breakdown request journey, describe the car breakdown and supply {{unknown_availability_location}}, a seeded case where the mechanic does not report availability; reach the comparison view and inspect the transcript and offer, then assert there is no availability value not reported by that mechanic.
