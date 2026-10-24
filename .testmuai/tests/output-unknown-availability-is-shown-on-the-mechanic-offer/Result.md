---
test: ../unknown-availability-is-shown-on-the-mechanic-offer_test.md
status: passed
started: 2026-10-24T22:16:14.765Z
duration_s: 66
session_id: b20bf875-bf9e-4c5d-9350-8ea6e88857c2
---

# Unknown availability is shown on the mechanic offer — Result

## Step 1 ✓ passed (2.78s)
md5: 90a004fa5915f80cdb5830c943215c9f
Open {{start_url}} and reach the breakdown request journey for mobile mechanic help.

## Step 2 ✓ passed (60.4s)
md5: d40e201ca1d3b03abf9f90140c32b963
In the breakdown request journey, describe the car breakdown and supply {{unknown_availability_location}}, a seeded case where a mechanic does not say whether they are available now; reach the comparison view, compare that mechanic's transcript with their offer, then assert that offer shows availability as unknown rather than yes or no and displays no availability answer the mechanic did not report.
