---
assurance:
  id: t-6
  base: sha256:e218d94caed1bdb575f65f0bad15088baa5835dd0bff527a18203b419a5978aa
---
# Unknown arrival estimate is not fabricated

> A mechanic does not report arrival time; compare the resulting offer without an invented estimate.

## Step 1

Open {{start_url}} and reach the breakdown request journey for mobile mechanic help.

## Step 2 @verifies ac-8

In the breakdown request journey, describe the car breakdown and supply {{unknown_arrival_location}}, a seeded case where the mechanic does not report an arrival estimate; reach the comparison view and inspect the transcript and offer, then assert there is no arrival estimate not reported by that mechanic.
