---
assurance:
  id: t-1
  base: sha256:31553c28f57d6855f6656e22dc23f251cb636cba793217e2ada0fd32d1bdfd12
---
# Other mechanic results survive one failed call

> Fail one of multiple mechanic calls while keeping independently returned results visible.

## Step 1

Open {{start_url}} and reach the breakdown request journey for mobile mechanic help.

## Step 2

In the breakdown request journey, describe the car breakdown and supply {{failed_call_location}}, a seeded location with at least two candidate mechanics including one successful call and one failed call; wait for the successful mechanic's result to appear.

## Step 3 @verifies ac-11

On the mechanic comparison view, let the other mechanic's call fail, then assert the successful mechanic's result is still present rather than removed by that failure.
