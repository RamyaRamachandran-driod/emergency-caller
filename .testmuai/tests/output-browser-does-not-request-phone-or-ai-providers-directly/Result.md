---
test: ../browser-does-not-request-phone-or-ai-providers-directly_test.md
status: passed
started: 2026-10-24T22:45:03.317Z
duration_s: 70
session_id: afcff836-e945-4497-8d4b-d6fd2ff15a03
---

# Browser does not request phone or AI providers directly — Result

## Step 1 ✓ passed (1.29s)
md5: 45757dcd7e991f5b869e86fc819a2353
At {{start_url}}, open the breakdown request page and observe browser network traffic from the beginning of this visit.

## Step 2 ✓ passed (53.9s)
md5: a95cc2bf077db196b6c8d7da6dad6b7b
On the breakdown request page, describe a car breakdown at {{multiple_offers_location}} and request mobile mechanics; through the results and call-progress display, inspect browser network requests and their destination origins, then assert no browser request was sent directly to a phone or AI provider, including Twilio, Vonage or OpenAI.
