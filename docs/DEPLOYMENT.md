# Live deployment

`render.yaml` deploys the built React frontend, orchestrator, discovery, and voice worker as one Docker web service. The gateway is the only public port. Internal services remain on loopback. The first live deployment requires `VOICE_TEST_NUMBER` and enforces an allowlist containing only that number.

The dashboard and `/api/*` use HTTP Basic authentication over the host's HTTPS endpoint. Public `/vonage/*` and `/twilio/*` traffic goes only to the provider server, which verifies provider signatures and per-call media credentials. Internal control routes are not forwarded. `/health` checks all three internal services without exposing their data.

The initial deployment uses Render Free with ephemeral storage at `/tmp/savior`. Task snapshots and voice journals can disappear on sleep, restart, or redeploy. This is a personal-phone demo, not durable production dispatch. A later paid deployment can attach a persistent disk and set `DATA_DIR=/var/data`; use one service instance for this SQLite storage design. The launcher writes the Vonage RSA key from `VONAGE_PRIVATE_KEY_B64` into a protected runtime file. Keep all API keys and credentials in Render environment settings; `.env`, `.secrets`, and local databases are excluded from the image.

Render supplies `RENDER_EXTERNAL_URL`; the launcher uses it as `PUBLIC_VOICE_URL`, so deployed calls use the live HTTPS/WSS endpoints rather than the local tunnel. Outbound calls already provide their answer/event URLs when created; local configuration stays unchanged.

## Commands

- Build the dashboard and check TypeScript: `npm run build`.
- Test gateway authentication, routing, binary WebSockets, the complete simulated workflow, and persistence across restarts: `npm run test:production`.
- Launch the production gateway and backend services: `npm start`.

Required production settings: `INTERNAL_SERVICE_TOKEN`, `DASHBOARD_USER`, and `DASHBOARD_PASSWORD` (at least 16 characters). Live mode also requires the existing OpenAI/Vonage credentials and `VOICE_TEST_NUMBER`. The Render Blueprint lists these settings. `DATA_DIR` defaults to `data/production` outside Docker and `/var/data` inside the image.

Auto-deployment is initially disabled: deployments interrupt active phone connections. The free instance also sleeps after inactivity and loses its ephemeral files; open the app and wait for readiness before calling. Deploy when no calls are active. GitHub Actions runs the production tests alongside backend checks and the existing Kane simulation suite. Never run the live call workflow as an automatic deployment smoke test.

After deployment, verify `/health` is healthy, unauthenticated `/app` returns 401, and authenticated `/api/setup` reports `ready: true` with the intended test number. Load `/app` using the dashboard credentials. Do not declare live calling ready solely because the frontend loads.
