# Local voice agent

Owner: Tanay. Node.js 22+. Supports outbound quote calls through **Vonage or Twilio**, with OpenAI Realtime for the conversation. The services stay on your computer; a temporary tunnel forwards provider events and audio. Live booking is blocked until dispatch contacts and durable booking coordination exist.

## Vonage: first real call

From the repository root:

```sh
nvm use
npm ci
cp .env.example .env # only if .env does not exist
```

In the ignored root `.env`, set:

```dotenv
INTERNAL_SERVICE_TOKEN=your-random-local-service-secret
VOICE_PROVIDER=vonage
VOICE_MODE=live
VOICE_ALLOWED_NUMBERS=+1YOUR_VERIFIED_PHONE
VONAGE_API_KEY=your-account-api-key
VONAGE_API_SECRET=your-account-api-secret
VONAGE_SIGNATURE_SECRET=your-account-signature-secret
VONAGE_FROM_NUMBER=123456789
OPENAI_API_KEY=your-openai-api-key
```

Sign up for a [Vonage API account](https://dashboard.nexmo.com/) using the phone you will test with. `123456789` is the test caller ID documented for demo/trial accounts, which can call the signup number without renting a number. This is not a production caller ID; US carriers may reject it. Prefer an existing Vonage voice-enabled number in VONAGE_FROM_NUMBER when available. Account permissions, regional restrictions and verification still apply. Prove the basic phone connection before relying on the trial for AI calls. See [Vonage getting started](https://developer.vonage.com/en/voice/voice-api/getting-started).

API credentials are in the Vonage dashboard. The webhook **signature secret** is separate from the API secret. It is used to authenticate Vonage event callbacks. You can obtain it from the dashboard's API/signature settings.

Create the Voice application and save its RSA private key locally:

```sh
npm run voice:vonage:setup
```

The setup command creates or recovers an application for the local key, enables signed callbacks, and updates `VONAGE_APPLICATION_ID` and `VONAGE_PRIVATE_KEY_PATH` in `.env`. It does not purchase a number. When the caller ID is still the trial placeholder, it checks for an existing voice-enabled account number and uses that number if available. Keys are stored under `.secrets/`, ignored by Git. Existing app IDs require a matching private key; setup refuses a mismatch instead of replacing credentials.

Start the service:

```sh
npm run voice:dev
```

In another terminal:

```sh
npm run voice:call -- setup
npm run voice:call -- probe +1YOUR_VERIFIED_PHONE
```

The probe places a real call and plays a short connection-test message. It needs application credentials and an allowed destination, but **no OpenAI key, webhook signature secret or public tunnel**. Call status is polled through the Voice API; signed callbacks add detailed carrier outcomes when a tunnel and signature secret are available. A completed attempt alone does not prove the phone rang. The CLI explicitly reports when no answered/audio connection was confirmed. If the probe fails, its result reports the provider HTTP status/error category without exposing credentials. Do not repeatedly dial while account access or caller-ID setup is failing.

## Connect the AI conversation

Run a tunnel in a separate terminal:

```sh
npm run voice:tunnel                  # cloudflared Quick Tunnel
# or: npm run voice:tunnel -- ngrok   # requires ngrok account setup
```

Install [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/) or [ngrok](https://ngrok.com/downloads) if needed. Copy the generated **HTTPS origin** into `PUBLIC_VOICE_URL` in `.env`, without a path/query, then restart voice. Keep the service and tunnel running. Quick Tunnel URLs change when the tunnel restarts.

```sh
npm run voice:call -- setup
npm run voice:call -- quote +1YOUR_VERIFIED_PHONE "123 Main St, San Francisco" "My car will not start. Can a mobile mechanic help?"
```

Answer your phone and play the business. The terminal prints call status, finalized speaker transcripts, and the quote. Unknown terms remain unknown. Ctrl+C requests a hangup. From a second terminal:

```sh
npm run voice:call -- status CALL_ID
npm run voice:call -- stop CALL_ID
```

With `VOICE_MODE=test`, commands simulate the call without any provider credentials or tunnel. CLI output explicitly identifies simulated versus live telephone calls. A simulated probe produces only a connection-test message, not a quote.

## Audio and authentication

The OpenAI conversation, instructions, quote tool, transcripts and call journal are shared across providers:

- Vonage uses an NCCO WebSocket endpoint with a per-call bearer credential and 16 kHz mono PCM16LE. Streaming resamplers convert to/from OpenAI's 24 kHz PCM. Output is framed into 20 ms packets, with final padding, playback notifications and buffer clearing on interruption. The 16 kHz wire format follows the NCCO reference; the conceptual WebSocket guide also documents 24 kHz support.
- Vonage status callbacks require HS256 signed JWTs, the expected API key/application, recent issue time, and matching SHA-256 body hash. Only the original telephone leg's status can finish a call; events for the WebSocket leg are ignored. Polling also reconciles missing terminal callbacks.
- Twilio uses 8 kHz PCMU audio, signed HTTP callbacks and signed media handshakes. To use it, set `VOICE_PROVIDER=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and a voice-enabled `TWILIO_PHONE_NUMBER`. Current Twilio trial restrictions block `<Stream>`, so its real AI calling path requires an account with Media Streams access. See [Twilio trial restrictions](https://www.twilio.com/docs/usage/trials/try-out-voice#blocked-verbs).

## Ports and local state

- `VOICE_PORT=4102`: local authenticated control API; never tunnel this port.
- `VOICE_PROVIDER_PORT=4103`: provider-only HTTP/WebSocket server; tunnel this port only. Other routes return 404.
- `PUBLIC_VOICE_URL`: HTTPS origin of the provider tunnel.

Both servers bind to `127.0.0.1`. Change `VOICE_PORT` if occupied; update `VOICE_URL` too for orchestrator integration. For standalone CLI tests, keep `APP_MODE=test` and independently enable real voice through `VOICE_MODE=live`. For dashboard calling, use `APP_MODE=live`, `VOICE_MODE=live`, and `VOICE_DESTINATION_POLICY=sourced`; discovery also needs `OPENAI_TEXT_MODEL`. Mixed dashboard service modes are rejected before starting work. The stand-alone CLI does not use discovery's fictional phone numbers or require the dashboard/orchestrator.

`VOICE_DATA_DIR` defaults to `data/voice` relative to the repository root. `VONAGE_PRIVATE_KEY_PATH` also resolves relative to the root. Calls, transcripts, provider name, status and retry queues persist in private local JSON files. Old journals without a provider field are treated as Twilio records. Switching provider does not reinterpret saved provider call IDs. A process lock prevents concurrent writers. Interrupted calls are failed on restart and known provider legs are hung up; they are never automatically redialed.

Stop the service before deleting local journals. Removing records also removes duplicate-call protection. This journal is for local rehearsals, not a replacement for durable orchestrator booking state. Assistant transcripts reflect generated speech and may include audio interrupted before it finished playing.

## Call controls and results

- The default `VOICE_DESTINATION_POLICY=allowlist` permits only numbers in `VOICE_ALLOWED_NUMBERS`. The `sourced` policy additionally permits authenticated `/calls` requests with valid international numbers, an HTTP(S) published source URL without embedded credentials, and a business not marked closed. Standalone `/dev` calls and probes still require the allowlist. Source presence does not independently verify that a search result is accurate. Defaults: three concurrent live calls, 30-second ringing timeout and a 180-second provider call limit (`VOICE_MAX_SECONDS`, maximum 600). Probes have a 30-second provider call limit. Additional watchdogs bound media setup, inactivity and total call duration.
- Duplicate call IDs return their existing result. Changing the request or probe/quote purpose under a used ID returns 409. No automatic retries create a second call.
- Quote calls identify the caller as an AI assistant and only collect service area, availability, arrival estimate, price, fees and conditions. They never dispatch or book. Voicemail and IVR handling is prompt-based best effort; dedicated machine detection/navigation are not implemented.
- The quote tool validates its schema and requires exact business transcript fragments for known availability, ETA and price. Unknown values stay null, and unknown availability is ineligible. Fragment checks establish transcript presence; review semantic accuracy in live rehearsals.
- `/health` and `/setup` report local configuration readiness, not verified account/model access or carrier connectivity. Use the probe and a real conversation for that evidence.

## Integration API

All control routes require `Authorization: Bearer INTERNAL_SERVICE_TOKEN` and `x-emergency-contract-version` matching `API_CONTRACT_VERSION` from the shared package. The CLI sends both headers:

| Route | Purpose |
|---|---|
| `POST /calls` | Shared `CallRequest`; persist and acknowledge with 202, then emit orchestrator events |
| `POST /dev/calls` | Same request; keep results local without callbacks (CLI quote command) |
| `POST /dev/probe` | Vonage connectivity call using the same request shape and no AI |
| `GET /calls/:id` | Status, transcripts, offers, provider, probe flag and pending callback count |
| `POST /calls/:id/stop` | Hang up and record user cancellation |
| `GET /setup` | Provider, configuration readiness, probe readiness and missing variable names |

Orchestrator events have stable IDs and per-call ordering in a durable retry outbox. An unavailable orchestrator can leave callbacks pending; local results remain readable. The tunnel server exposes only authenticated provider routes:

- `POST /vonage/events/:callId/:token`
- WebSocket `/vonage/media/:callId/:token`
- `POST /twilio/status/:callId`
- WebSocket `/twilio/media/:callId/:token`

Call-control instructions and event URLs are supplied inline when dialing. No purchased-number incoming webhook setup is required for outbound tests.

## Verification

```sh
npm run test:voice
npm run build
```

The automated suite uses local HTTP/WebSocket mocks and generated test keys, not paid calls. It covers both transports, resampling across packet boundaries, playback interruption, request/JWT authentication, call-body generation, probe operation, callback reconciliation, durable state and callback retry. Actual team-phone calls remain necessary to verify provider permissions, microphone/speaker quality, model access and latency.

References: [Vonage WebSockets](https://developer.vonage.com/en/voice/voice-api/concepts/websockets), [NCCO](https://developer.vonage.com/en/voice/voice-api/ncco-reference), [signed callbacks](https://developer.vonage.com/en/getting-started/concepts/webhooks), [OpenAI Realtime](https://developers.openai.com/api/docs/guides/realtime-conversations).


### Personal phone and transcript quote recovery

Set `VOICE_TEST_NUMBER` and `VOICE_ALLOWED_NUMBERS` to your own number, with `VOICE_DESTINATION_POLICY=allowlist`. The dashboard bypasses discovery and makes one personal-phone call per request. Every other live destination is rejected by the voice service even when it has a published source URL. The dashboard reads the configured target through `/api/setup` and labels the action **Call my phone**.

Set `OPENAI_TEXT_MODEL` to enable transcript-based recovery when the audio model's quote evidence does not match finalized ASR wording. The text extractor receives finalized speaker-labelled transcripts, uses a strict quote schema, and passes the same business-evidence validation before an offer is saved. Missing data stays unknown; call-out fees must not become repair totals. An authenticated `POST /calls/:id/recover-quote` can review an ended live quote call without redialing. It returns an existing offer on repeat and blocks concurrent review requests. Failed reviews return 422, leaving the transcript intact. This endpoint is available only on the internal listener.

Vonage completion without a verified connection counts as failure. Detailed failure callbacks correct generic polling results, and status events carry the provider reason to the dashboard.


### Conversational turns and audio checks

Voice detection interrupts output, but does not automatically generate replies. The bridge waits until the person stops speaking and their transcript is finalized, then starts one response with the current conversation phase and original orchestrator brief. Tool follow-ups share that same turn controller. The opening is brief; later turns address the latest caller intent with one relevant question rather than listing the brief. A completed closing ends playback without another spoken follow-up.

`npm run voice:smoke` exercises a genuine Realtime audio interruption using synthesized speech and a fake local telephone socket. `npm run voice:smoke -- --ack` tests a short acknowledgement. These manual checks use paid OpenAI TTS and Realtime APIs and never call the phone provider or dial any number. They print transcripts and assert a brief contextual reply without a repeated introduction or combined timing/price checklist.
