---
test: ../concurrent-mechanic-calls-show-progress-and-transcripts_test.md
status: passed
started: 2026-10-24T20:50:36.652Z
duration_s: 118
session_id: 645da3f7-6a82-465e-ac1f-da4f0c102622
---

# Concurrent mechanic calls show progress and transcripts — Result

## Step 1 ✓ passed (26.2s)
md5: 90a004fa5915f80cdb5830c943215c9f
Open {{start_url}} and reach the breakdown request journey for mobile mechanic help.

## Step 2 ✓ passed (48.3s)
md5: 6807e2f909b3704f620b6cde0e903577
In the breakdown request journey, describe the car breakdown and supply {{multiple_offers_location}}, a seeded location for multiple reporting mechanics; follow call progress, then assert overlapping mechanic calls and a displayed status for each selected mechanic.

## Step 3 ✓ passed (27.8s)
md5: 68e9f4df2b9105aacab75cd35f444554
On the comparison view after the calls, inspect the selected mechanics' call records, then assert no more than three mechanics are returned and each selected mechanic has a displayed call transcript.
