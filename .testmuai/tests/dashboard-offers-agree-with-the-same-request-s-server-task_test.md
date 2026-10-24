---
assurance:
  id: t-19
  base: sha256:cb1f651a91e48290e4bc0dca1cda7053de6f39237230db4d883a23725df02a91
---
# Dashboard offers agree with the same request's server task data

> Compare displayed dashboard offer details with the corresponding task response from the app server for the same breakdown request.

## Step 1

At {{start_url}}, open the breakdown request page and observe its browser network responses for this visit.

## Step 2 @verifies ac-28

On the breakdown request page, describe a car breakdown at {{multiple_offers_location}} and request mobile mechanics; on the resulting dashboard, compare each displayed offer detail with the corresponding task data returned by the app's own server for this same request in the browser network response, then assert every displayed offer detail equals its corresponding returned task field.
