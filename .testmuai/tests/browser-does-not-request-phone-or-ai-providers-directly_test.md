---
assurance:
  id: t-18
  base: sha256:51081a89fbec3c6c4207884f46d334c0a9cf8267e182e77a5ab9154522474da7
---
# Browser does not request phone or AI providers directly

> Inspect browser network traffic while finding and comparing mechanics for any direct phone or AI provider requests.

## Step 1

At {{start_url}}, open the breakdown request page and observe browser network traffic from the beginning of this visit.

## Step 2 @verifies ac-27

On the breakdown request page, describe a car breakdown at {{multiple_offers_location}} and request mobile mechanics; through the results and call-progress display, inspect browser network requests and their destination origins, then assert no browser request was sent directly to a phone or AI provider, including Twilio, Vonage or OpenAI.
