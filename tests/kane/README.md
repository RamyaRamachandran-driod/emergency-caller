# Kane suite — Khushi

The suite is designed by Kane assurance from `requirements/demo.md`, not written by hand. Kane keeps the designed tests in `.testmuai/tests/` (each `_test.md` carries an `assurance:` block linking it to the acceptance criteria it verifies), with their recordings in `.testmuai/tests/output-*/` so later runs replay without AI cost. Variable values live in `.testmuai/variables/assurance.json`; none are secret.

## Run it locally

```sh
npm run dev          # all four services in test mode
npm run test:kane    # replays every designed test, headless, 4 at a time
```

`start_url` in the variables file must match the dashboard address (5173 by default).

## Test-mode scenarios

Most criteria need a controlled situation. In test mode the simulated voice service reads `Scenario: <name>` from the breakdown location, for example `Sunnyvale, CA. Scenario: failed-call`:

| Scenario | Effect |
|---|---|
| `failed-call` | the second business's call fails; the others return offers |
| `unknown-quote` | first business gives no price |
| `unknown-eta` | first business gives no arrival estimate |
| `unknown-availability` | first business is unsure it is free (sent as not available: the contract has no "unknown") |
| `unknown-conditions` | first business states no conditions |
| `unavailable` | first business is not available now |
| `over-max` | first business arrives 20 minutes after the arrival goal |
| `at-max` | first business arrives exactly at the arrival goal |
| `pending` | the booking call never gets an answer |

Live mode never reads the scenario.

## Changing the requirements

Edit `requirements/demo.md`, then `kane-cli maintain reconcile --from requirements/demo.md --source-id demo --mode agent`. Do not edit designed test steps by hand: an edit becomes the next design version on the next run.

## CI

The `kane` job in `.github/workflows/verify.yml` starts the services, signs in with the `KANE_USERNAME` / `KANE_ACCESS_KEY` repository secrets, runs `npm run test:kane`, and uploads the evidence pack and NDJSON stream as the `kane-evidence` artifact. Make it a required check in branch protection.
