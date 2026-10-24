---
assurance:
  id: t-4
  base: sha256:f99dd10187368fc6a584c24b1e0b86cfc4def2bbe16cefe3d72c330d6049dec1
---
# Concurrent mechanic calls show progress and transcripts

> Describe a breakdown and location, inspect overlapping mechanic calls and their statuses, transcripts and reported offers.

## Step 1

Open {{start_url}} and reach the breakdown request journey for mobile mechanic help.

## Step 2 @verifies ac-4, ac-5

In the breakdown request journey, describe the car breakdown and supply {{multiple_offers_location}}, a seeded location for multiple reporting mechanics; follow call progress, then assert overlapping mechanic calls and a displayed status for each selected mechanic.

## Step 3 @verifies ac-1, ac-6

On the comparison view after the calls, inspect the selected mechanics' call records, then assert no more than three mechanics are returned and each selected mechanic has a displayed call transcript.
