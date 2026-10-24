---
test: ../concurrent-mechanic-calls-show-progress-and-transcripts_test.md
status: passed
started: 2026-10-24T22:45:03.587Z
duration_s: 157
session_id: 8ba1b890-c093-49d8-af53-f2e1a3bae8a2
---

# Concurrent mechanic calls show progress and transcripts — Result

## Step 1 ✓ passed (33s)
md5: 90a004fa5915f80cdb5830c943215c9f
Open {{start_url}} and reach the breakdown request journey for mobile mechanic help.

## Step 2 ✓ passed (70.1s)
md5: 6807e2f909b3704f620b6cde0e903577
In the breakdown request journey, describe the car breakdown and supply {{multiple_offers_location}}, a seeded location for multiple reporting mechanics; follow call progress, then assert overlapping mechanic calls and a displayed status for each selected mechanic.

## Step 3 ✓ passed (31.7s)
md5: 68e9f4df2b9105aacab75cd35f444554
On the comparison view after the calls, inspect the selected mechanics' call records, then assert no more than three mechanics are returned and each selected mechanic has a displayed call transcript.
