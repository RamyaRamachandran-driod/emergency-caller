---
assurance:
  id: t-8
  base: sha256:85e61af057476aabcfac188532688ac5bef58dfc1cd036d8cd65bc60ced86d47
---
# Unknown conditions are not fabricated

> A mechanic does not report conditions; compare the resulting offer without invented conditions.

## Step 1

Open {{start_url}} and reach the breakdown request journey for mobile mechanic help.

## Step 2 @verifies ac-10

In the breakdown request journey, describe the car breakdown and supply {{unknown_conditions_location}}, a seeded case where the mechanic does not report conditions; reach the comparison view and inspect the transcript and offer, then assert there is no condition not reported by that mechanic.
