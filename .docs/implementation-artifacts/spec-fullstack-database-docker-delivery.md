---
title: 'Full-stack database and Docker delivery'
type: 'feature'
created: '2026-09-20'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'NO_VCS'
context:
  - '{project-root}/.docs/planning-artifacts/architecture/architecture-studieplanlegger-2026-09-06/ARCHITECTURE-SPINE.md'
  - '{project-root}/brief.md'
  - '{project-root}/studieplanlegger/IMPORT-COVERAGE.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Studieplan is functionally rich, but central user data is still authoritative in an origin-scoped `localStorage` envelope. The existing Node/Vite import middleware is not a complete backend, and no database or Docker delivery exists, so the source cannot yet reproduce the required durable full-stack application.

**Approach:** Retain the vanilla JavaScript/Vite interface, rules, import adapters and visual design, while moving authoritative state behind a local Node API backed by SQLite. Add a controlled, idempotent browser-data transition and a reproducible single-service Docker delivery with automatic schema migration, named-volume persistence and documented evidence.

## Boundaries & Constraints

**Always:** Preserve IDs, ordering, relationships, provider provenance, import baselines, history, preferences and optional legacy fields. Preserve the distinctions among estimated/remaining work, planned sessions, actual work, completion and submission. Validate the complete relational envelope server-side and commit each compound change, migration, restore or purge in one SQLite transaction with optimistic revision checks. Keep the original browser data untouched; test only synthetic copies. Keep import coverage frozen. Bind the host port to `127.0.0.1`; the server listens separately inside the container. Seed data is explicit, empty-database-only and optional.

**Never:** Use the database as a cache or demo-only store; silently migrate, delete or rewrite real browser data; merge records by labels; lose tombstones or intentionally missing dependencies; expose a public listener; depend on absolute Windows paths, existing `node_modules`, manual database creation, cloud services or runtime generative AI; change port 80, publish, deploy or push to GitHub.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Normal use | Valid API create/change of linked courses, tasks, sessions, work logs or imports | SQLite is authoritative; stable IDs and all relations survive reload/restart | Invalid or stale revision writes nothing and leaves the UI draft/state intact |
| Same-origin transition | Valid legacy v1 envelope and empty DB | Preview, explicit confirmation, raw archive and one transactional import; repeat is a no-op | Invalid/nonempty/conflicting input is refused without changing either store |
| Different Docker origin | Existing portable backup | Existing validated import restores supported data and identities into SQLite | Credentials remain intentionally excluded with reconnection guidance; invalid backup changes nothing |
| Recovery operations | Backup restore, undo, trash restore or privacy purge | Live state, history and server recovery snapshots change atomically | Partial failure rolls back; prior recoverable data remains available |
| Container lifecycle | Recreated container with same named volume | Schema upgrades automatically and user state survives | Fresh volume starts empty unless optional seed is explicitly requested |

</frozen-after-approval>

## Code Map

- `studieplanlegger/src/main.js` — sole controller and current synchronous `snapshot`/`commitState` seam; convert startup and writes to confirmed API operations before updating memory.
- `studieplanlegger/src/storage.js` — legacy v1 reader, complete validator and migration source; retain for validation/read-only transition, not ongoing authority.
- `studieplanlegger/src/{tasks,planner,capacity,work-log,task-dependencies,import-source-contract,history,backup}.js` — reuse domain validation, compound semantics, privacy-safe backup and identity rules; do not simplify three-way import merging or tombstones.
- `studieplanlegger/server/import-api.js`, `vite.config.js` — preserve guarded import middleware and compose it with new local state endpoints.
- `studieplanlegger/server/database.js`, `server/state-api.js`, `server/app.js` — new SQLite schema/migrations, transactional repository/API and production static/API server.
- `studieplanlegger/tests/unit/storage.test.js`, `connected-backup-privacy.test.js`, `connected-review-history.test.js` — reuse linked-envelope, idempotency, rollback and privacy fixtures.
- `studieplanlegger/tests/e2e/connected-root-acceptance.spec.js`, `capacity-lifecycle.spec.js`, `subjects-import.spec.js` — adapt helpers to isolated API databases and cover persisted browser flows.
- `studieplanlegger/Dockerfile`, `.dockerignore`, `compose.yaml`, `.env.example` — new locked build, local runtime, named volume and safe configuration.
- `studieplanlegger/README.md`, planning brief/architecture, `WORK-STATUS.md`, `VERIFICATION.md`, `.docs/implementation-artifacts/development-process.md` — record actual architecture, commands, evidence, failures and the boundary between technical evidence and personal reflection without parallel reports.

## Tasks & Acceptance

**Execution:**
- [x] Implement a versioned relational SQLite repository for courses, tasks, sessions, dependencies, work logs/progress, planner events/sources, document import sources/entries, windows, preferences and history. Keep complete validated payload JSON beside indexed identity/relation columns so provider-specific fields round-trip losslessly.
- [x] Add guarded state/health/migration APIs and a production Node server; make frontend bootstrap, mutations, backup/restore, undo/trash and purge await successful server transactions with revision conflicts surfaced.
- [x] Add previewed same-origin legacy migration with fingerprint receipts/raw archive, plus the existing portable export/import bridge for changed origins.
- [x] Add multi-stage Docker/Compose delivery using `npm ci`, automatic migrations, `/data/studieplan.sqlite`, named volume, explicit optional seed and default `127.0.0.1:8088` publication.
- [x] Add focused repository/API/migration/browser tests, then verify a clean delivery copy and volume-backed container recreation without touching port 80 or real user storage. The isolated clean-copy build, healthy runtime, two-browser UI acceptance, backup/restore and same-volume service recreation completed on 2026-09-20.
- [x] Update existing product, architecture, operation, verification and development-process documents from observed results only.

**Acceptance Criteria:**
- Given an empty or existing persistent volume, when the documented Compose command starts the app, then schema setup is automatic and the app is usable locally without host paths, preinstalled dependencies or a manual database.
- Given synthetic linked legacy data, when migration runs twice and the container is recreated, then IDs, relations, import identities, history and distinct planning/progress/submission values remain exact with no duplicates.
- Given UI CRUD, import, undo/trash, backup/restore and a forced invalid/stale write, when each flow is reloaded, then successful changes come from SQLite and failed changes leave both database and visible draft/state consistent.

## Implementation Notes

- `baseline_commit: NO_VCS` is historical metadata from when this specification was approved before the delivery repository had a usable baseline commit; it is not a claim about the current Git state.

- `server/database.js` owns schema migration, optimistic revision checks and one-transaction replacement of the complete validated envelope. Domain tables retain indexed IDs/relations/order plus complete JSON. Recovery snapshots and legacy raw archives are in the same SQLite file.
- `server/state-api.js` applies local host/origin/fetch-metadata guards and exposes health, state, restore, recovery, purge and legacy preview/import routes. `server/app.js` composes these with the existing import middleware and static production client.
- Production HTML enables `src/server-storage.js`; its existing synchronous controller seam now returns only after the server confirms a transaction, so failed/stale writes do not replace browser memory. The Vite development/test path retains its established isolated localStorage adapter and is documented as non-production persistence.
- Same-origin transition validates and counts the raw v1 envelope, asks for explicit confirmation, archives exact raw input with a SHA-256 receipt and never edits/deletes browser data. Existing portable backup/restore remains the changed-origin bridge.
- Docker uses a multi-stage Node 24 build, locked `npm ci`, non-root runtime, automatic SQLite migration, `/data/studieplan.sqlite`, named volume, explicit empty-only JSON seed and `127.0.0.1:8088` host publication.
- The previously blocked Docker runtime acceptance later completed under Compose project `studieplan-docker-accept-20260920-01` on loopback port 18088. A forced service recreation changed the container ID while retaining the same isolated volume; a separate Chromium process read identical course/task/session IDs and relations from SQLite. UI backup/restore advanced revision 8 to 9 and preserved the pre-restore state in recovery. No product code change was required.

## Review Triage Log

| # | Verdict and route | Evidence |
|---|---|---|
| B1 | medium — patch | `decodeURIComponent` runs before the static-file error guard and the returned promise is not caught; malformed request paths can create an unhandled rejection. |
| B2 | high — patch | `server/app.js` defaults to `0.0.0.0`; the local-only contract requires host execution to default to loopback while Compose may explicitly select the container listener. |
| B3 | false — reject | The approved transition intentionally preserves the exact legacy raw archive and original browser record. Privacy purge is specified for live history and recoverable server snapshots, not the immutable migration source. |
| B4 | medium — patch | Frontend emptiness counts omit revision/settings and ignore the preview's `empty` result, so an empty imported legacy envelope can prompt again and settings-only state can be offered an invalid migration. |
| B5 | medium — patch | `importLegacy` checks revision before its fingerprint receipt, so a retry after a lost response is not the promised idempotent no-op. |
| B6 | medium — patch | `read()` deletes every top-level key starting with `__`, while `_replace()` mixes internal shape flags into the same JSON; valid optional legacy fields can be lost. |
| B7 | medium — patch | Every save currently adds a full recovery snapshot with no retention. This is reachable during ordinary edits and can grow the local database indefinitely. |
| B8 | medium — patch | Ordinary saves create newer recovery rows, so the pre-restore state is immediately hidden by the next edit. Recovery snapshots must be created by replacement/restore operations, not every write. |
| B9 | low — patch | Parsed JSON can be `null` or another non-object and route code dereferences it, returning 500 instead of a bounded 400 response. |
| B10 | low — patch | The server marks every non-HTML file immutable for one year, including unhashed `public` files; only Vite's hashed asset directory is safe for that policy. |
| B11 | medium — patch | `.dockerignore` omits `.env` and private local directories already identified in `.gitignore`, so they enter the Docker build context even though the Dockerfile does not copy them. |
| B12 | low — patch documentation | `node:24-bookworm-slim` is a selected mutable tag, not a digest pin. The evidence text must not call it pinned; digest maintenance is not required by the approved lockfile acceptance. |
| B13 | low — reject | Synchronous confirmation preserves the existing synchronous controller invariant. A five-second SQLite contention pause is possible but unlikely in this single-user local service; making the whole controller asynchronous is disproportionate to this edge case. |
| B14 | medium — patch | Static responses lack an anti-framing header, so a remote page can frame the local UI even though direct cross-origin API calls are guarded. |
| B15 | medium — patch | The sole production browser test covers migration/edit/stale write but not server-backed replace/recovery/purge, and fresh-schema tests do not cover the schema-upgrade branch. |
| E1 | medium — patch | Independent edge review reproduced B1: malformed percent encoding reaches unguarded decode. |
| E2 | medium — patch | Independent edge review reproduced B4: entity-count emptiness can disagree with authoritative database eligibility. |
| E3 | medium — patch | Independent edge review reproduced B7: unbounded full snapshots can eventually exhaust the volume. |
| V1 | medium — patch | No test executes `_upgradeForeignKeys`; reopening a current schema does not exercise preservation from the earlier no-FK schema. |
| V2 | medium — patch | Local-storage UI tests and direct repository tests do not exercise `/replace`, `/recovery`, and `/purge-work-history` together through the production server adapter. |
| V3 | medium — defer, externally blocked | Docker runtime/recreate verification is genuinely absent. Three Compose builds and a direct base-image pull fail in registry transfer before project commands, so no code patch can establish this evidence in the current environment. |
| V3F | medium — resolved in follow-up | The transport blocker cleared. A strict clean-copy run started from a new empty project-scoped volume, built and became healthy on loopback, recreated the service with a new container ID, and preserved exact UI-created IDs/relations for a separate Chromium process. |

## Design Notes

SQLite fits a single-user local planner because the application server and database file share one machine, write concurrency is low, and transactions provide atomic compound changes without a separate database service. Node 24's built-in `node:sqlite` matches the installed stack and avoids a native add-on. Domain tables are authoritative; full payload JSON preserves the project's extensive optional/provider fields, while foreign keys plus the existing complete-envelope validator enforce relations. Intentional missing dependencies, deleted import targets and historical snapshots are represented explicitly rather than erased by cascades.

## Verification

**Commands:**
- `npm.cmd ci && npm.cmd test && npm.cmd run build` — all locked unit tests and production build pass.
- Targeted Playwright against an isolated temp DB/port — CRUD, migration, restart, import identity, work-state distinctions, backup/recovery and undo/trash pass.
- `docker compose build --no-cache` and `docker compose up -d` from a clean copied delivery — health/UI pass at `http://127.0.0.1:8088`; recreate with the same volume retains data; explicit seed does not overwrite.

**Manual checks (if Docker daemon remains unavailable):**
- Record the exact daemon/access failure, complete non-container verification, and mark container execution untested rather than inferring success from a normal build.

**Observed 2026-09-20:**
- `npm.cmd test`: 1195/1195 passed in 95 files, including six SQLite/revision/migration/schema-upgrade/reopen/recovery/restore/purge/foreign-key/seed checks.
- `npm.cmd run build`: passed, 68 modules; existing large-chunk warning retained.
- Local production Node smoke on `127.0.0.1:18088`: health/state read and revision-controlled write passed.
- Production Chromium on `127.0.0.1:18089`: 1/1 passed for explicit migration, database-confirmed UI edit with linked IDs intact, exact reload, untouched browser original and stale 409.
- Post-review production Chromium, finally repeated on `127.0.0.1:18096`: 2/2 passed, adding database-confirmed UI create/delete, backup-style replace, recovery restore, work-history purge across live/recovery state and invalid-body 400 coverage.
- Clean copy `C:\IBE160\2026\.tmp\studieplan-docker-delivery-20260920-1108`: fresh locked `npm.cmd ci`, 1195/1195 unit tests, 68-module build and final 2/2 production Chromium on `127.0.0.1:18097` passed after review fixes.
- `docker compose config`: passed with loopback port, named volume and healthcheck. Docker Desktop 29.7.2/daemon started, but three clean-copy `build --no-cache` attempts and direct `docker pull node:24-bookworm-slim` failed during base-layer transfer with `local error: tls: bad record MAC` before project commands ran. Container health and named-volume recreation remain untested; port 80 and real user storage were untouched.
- Superseding Docker follow-up: the base image became available by digest. Strict project `studieplan-docker-accept-20260920-02` built and started healthy as non-root on only `127.0.0.1:18088`; forced service recreation changed the container ID and retained the same isolated volume. A new Chromium process read identical course/task/session IDs and relations, UI restore advanced revision 7 to 8, and a direct SQLite query confirmed the foreign-key values and recovery snapshot. Port 80 and real user storage remained untouched.
