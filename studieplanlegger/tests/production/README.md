# Sequential production acceptance

Build the current source first. From the app directory, run `node tests/run-production-acceptance.mjs`. Set `RUN_LIVE_TEACHING=1` to include the bounded genuine NTNU EXPH0100, autumn 2026 import. Without it, the import scenario is skipped and must not be reported as accepted.

The runner creates an isolated temporary SQLite database and a random loopback port, runs registration and import in one browser worker, restarts its own server with the same database, runs fresh-browser and UI backup/restore checks, stops the server, and opens SQLite read-only for integrity and foreign-key checks. It preserves its synthetic evidence directory and prints its location. It uses the existing production build; it does not rebuild or operate Docker.

For an owned Docker container or another isolated production server, set these environment variables and run `node node_modules/@playwright/test/cli.js test --config=tests/playwright.production.config.js tests/production/acceptance.spec.js`:

- `STUDIEPLAN_ACCEPTANCE_PORT`: the explicitly owned loopback port, never 80.
- `STUDIEPLAN_ACCEPTANCE_PHASE`: `create` against empty synthetic state, then `restore` after recreation with the same volume.
- `STUDIEPLAN_ACCEPTANCE_SNAPSHOT`: an absolute local file for the full API envelope and revision shared by both phases.
- `STUDIEPLAN_ACCEPTANCE_OUTPUT`: a distinct ignored output directory for each sequential run.
- `RUN_LIVE_TEACHING=1`: explicit live-source opt-in for the create phase.

The caller owns Docker recreation, image/build provenance, health, runtime identity, volume protection, read-only SQLite inspection and container cleanup. Do not run another browser suite concurrently. The expected phase-inapplicable skips are one in `create` and three in `restore`; together the phases execute all four scenarios. The added replan scenario uses an explicit estimate, inspects the actual UI preview without writing, moves an overlapping reservation, accepts the plan and verifies its saved intervals. The genuine import scenario also clicks the saved source's actual “Oppdater nå” control, intercepts its production calendar refresh endpoint, and checks failed-attempt metadata separately from the retained last success, event data and activity choices.

Recreation compares the complete API state and revision exactly. Backup preserves task/session/event identities, relations, types and times, while intentionally disconnecting URL feeds according to the product privacy contract. Restore must exactly match the downloaded portable envelope and advance revision by exactly two after the intervening UI edit. Screenshots show desktop and mobile calendar content, with a second mobile image for the internally scrolled lower entries; open them before claiming visual verification.

The separate `bounded-workflow.spec.js` is entirely synthetic. Set `STUDIEPLAN_ACCEPTANCE_TEST_FILE=tests/production/bounded-workflow.spec.js` before running `node tests/run-production-acceptance.mjs`, or pass that file explicitly to the Playwright command for Docker. It exercises mixed legacy steps, dependency-safe removal, completion and undo, reused-topic date clearing, preserved independent/historical session links, parser-checked topic titles and deadline omission explanations. Its two phases execute one create and one restore case, with one phase-inapplicable skip each. The exact changed envelope, step completion, assessments, history and work-log snapshots survive SQLite reopen/recreation, fresh context, backup/restore and recovery. Desktop and enlarged 390 px export images are saved outside Git through the caller's output directory.
