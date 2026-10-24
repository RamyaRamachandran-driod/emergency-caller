---
assurance:
  id: t-17
  base: sha256:7ee5aca68ad8b610964dc1247cce09ba0b20a14a0b1f878aa1d9517345ef6114
---
# Unknown availability is shown on the mechanic offer

> A mechanic does not say whether available now; compare the resulting offer with availability shown as unknown, not as yes or no.

## Step 1

Open {{start_url}} and reach the breakdown request journey for mobile mechanic help.

## Step 2 @verifies ac-7, ac-26

In the breakdown request journey, describe the car breakdown and supply {{unknown_availability_location}}, a seeded case where a mechanic does not say whether they are available now; reach the comparison view, compare that mechanic's transcript with their offer, then assert that offer shows availability as unknown rather than yes or no and displays no availability answer the mechanic did not report.
