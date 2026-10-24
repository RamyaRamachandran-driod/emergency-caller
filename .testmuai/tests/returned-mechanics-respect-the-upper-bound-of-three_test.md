---
assurance:
  id: t-5
  base: sha256:e057deb69f7b25cb1088859a43139c9b78aac45dfefbaa01ec7048db1141cbd4
---
# Returned mechanics respect the upper bound of three

> From a request with more potential candidates than the upper limit, observe no more than three returned mechanics.

## Step 1

Open {{start_url}} and reach the breakdown request journey for mobile mechanic help.

## Step 2 @verifies ac-1

In the breakdown request journey, describe the car breakdown and supply {{four_candidates_location}}, a seeded case with at least four potential mechanics; reach the comparison view, then assert the number of mechanics returned is no more than three.
