---
assurance:
  id: t-7
  base: sha256:030f60b9919e2664dc54a25c0729976df00891125ae9fb2884b6e20252055f43
---
# Unknown availability is not fabricated

> A mechanic does not report availability; compare the resulting offer without invented availability.

## Step 1

Open {{start_url}} and reach the breakdown request journey for mobile mechanic help.

## Step 2 @verifies ac-7

In the breakdown request journey, describe the car breakdown and supply {{unknown_availability_location}}, a seeded case where the mechanic does not report availability; reach the comparison view and inspect the transcript and offer, then assert there is no availability value not reported by that mechanic.
