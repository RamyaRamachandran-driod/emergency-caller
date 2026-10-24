# Run Emergency Caller and the Kane tests on your laptop

Everything runs in **test mode**: simulated mechanics, no real phone calls, no OpenAI or Twilio keys needed.

## 1. Requirements

- Node.js 22 or newer (`node -v`)
- Google Chrome (only for running Kane tests)

## 2. Get the code and install

```sh
git clone https://github.com/RamyaRamachandran-driod/emergency-caller.git
cd emergency-caller
npm install
cp .env.example .env
```

Open `.env` and set `INTERNAL_SERVICE_TOKEN` to any word, for example `INTERNAL_SERVICE_TOKEN=local-dev`. Leave `APP_MODE=test`.

## 3. Start the app

```sh
npm run dev
```

Wait until you see `Orchestrator ready`, `Discovery ready`, `Voice ready` and the Vite `Local:` line. Keep this terminal open; `Ctrl+C` stops everything.

- Landing page: http://127.0.0.1:5173
- Dashboard: http://127.0.0.1:5173/app

Try it: on the dashboard enter a location such as `Sunnyvale, CA`, click **Find help**, watch three calls, open a mechanic to read the transcript, then **Book top offer** and confirm. You should see "Simulated acceptance".

If the dashboard starts on a different port (another app is using 5173), stop that app first: the Kane tests expect 5173.

## 4. Look at the Kane evidence (no test run needed)

The evidence packs from our runs are committed in `tests/kane/evidence/`. Install Kane CLI once:

```sh
npm install -g @testmuai/kane-cli
```

Open a pack:

```sh
kane-cli evidence serve tests/kane/evidence/run4-bug-unknown-availability-before-fix-FAIL.evidence
```

Click the `viewer` link it prints. Open the test, then its last step: the transcript says "I'm not sure anyone is free" while the offer says "Available now: No". That is the bug Kane caught. Press `Ctrl+C`, then open the fixed run:

```sh
kane-cli evidence serve tests/kane/evidence/run5-bug-unknown-availability-after-fix-PASS.evidence
```

Same step now shows "Available now: Unknown" and the test passes.

| Pack | What it shows |
|---|---|
| `run4-bug-unknown-availability-before-fix-FAIL` | Kane catching the availability bug |
| `run5-bug-unknown-availability-after-fix-PASS` | the same test passing after the fix |
| `run7-devtools-network-checks` | Kane checking browser network traffic: no direct calls to Twilio, Vonage or OpenAI, and the screen matches the server data |
| `run2-replay-merged-orchestrator-16-of-16` | the full suite passing after a backend rewrite |

## 5. Run the Kane tests yourself (optional, uses your Kane credits)

Keep `npm run dev` running. In a second terminal, sign in once with your TestMu AI account:

```sh
kane-cli login
```

Watch Kane drive Chrome through one flow:

```sh
kane-cli testmd run .testmuai/tests/eligible-booking-confirms-after-business-acceptance_test.md
```

Or run the whole suite headless (19 tests, about 10 minutes):

```sh
npm run test:kane
```

When a run finishes, the terminal prints a `kane-cli evidence serve …` line: run it to open that run's evidence. Packs are saved in `.testmuai/evidence/`, and every run also appears in your TestMu AI account under **Test Manager → Recent Tests**.

Expect most tests to pass. A few older checks are known to be flaky; Kane's failure diagnosis in the evidence pack says whether a failure is the app or the test wording.

## 6. Where CI results are

Your laptop runs do not show up in GitHub. CI runs the same suite on every push and pull request:

1. GitHub repo, **Actions** tab, workflow **Verify scaffold**, pick a run.
2. Open the **kane** job and expand **Run npm run test:kane** to see the results.
3. At the bottom of the run page, **Artifacts → kane-evidence**: download, unzip, then `kane-cli evidence serve <file>.evidence`.

The `kane` check is required on `main`, so a failed run blocks merging.

## More

- How the tests were designed, the test-mode scenarios and every run: [tests/kane/README.md](../tests/kane/README.md)
- The requirements Kane tests against: [requirements/demo.md](../requirements/demo.md)
- Architecture and owners: [docs/ARCHITECTURE.md](ARCHITECTURE.md)
