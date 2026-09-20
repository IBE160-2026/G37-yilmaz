---
title: 'Complete isolated Docker runtime verification'
type: 'chore'
created: '2026-09-20'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context:
  - '{project-root}/.docs/implementation-artifacts/spec-docker-runtime-verification.md'
  - '{project-root}/studieplanlegger/VERIFICATION.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The required base image now pulls successfully, but the clean delivery still needs observed proof that it builds, starts, serves the browser application, stores linked planning data in SQLite, survives service recreation with the same isolated volume and restores a UI-created backup.

**Approach:** Reuse the documented clean copy, unique Compose project and loopback port 18088. Run the actual delivery, drive course/task/session creation and editing through a real browser, verify exact API identities and relations before and after service recreation in a new browser process, exercise backup/restore, fix only concrete defects, and update existing verification documents with observed results while preserving port 80 and all real user data and volumes.

</frozen-after-approval>

## Implementation Notes

- Planning found no user-visible intent gap and no irreversible operation. The footprint is limited to isolated Compose projects, project-scoped named volumes, temporary acceptance artifacts, and documentation or narrowly required defect fixes. The final strict evidence run used project `studieplan-docker-accept-20260920-02` and a new empty volume.
- Reuse `compose.yaml`, `Dockerfile`, the state API, and UI flows already covered by `tests/e2e/database-delivery.spec.js` and `tests/e2e/connected-root-acceptance.spec.js`. Never run `docker compose down -v` and never use the default Compose project name.
- The mandatory BMAD generator exited 0 through the documented approved uv execution. Docker Desktop 4.91.0 / Engine 29.8.0 found the base image by digest and completed both locked install stages plus the 68-module Vite build from the clean copy.
- Compose started a healthy non-root container on only `127.0.0.1:18088`, with the project-scoped volume mounted at `/data`. Browser A created and edited a linked course, task and session through the UI, exported a backup, and made a post-backup edit; the final strict run reached revision 7.
- Forced service recreation changed the container ID while preserving the same volume. Browser B was a separate Chromium process with no legacy localStorage and read the post-backup value, exact IDs and both relations from SQLite. UI restore advanced revision 7 to 8 in that same successful run, preserved IDs/relations, survived reload and exposed the pre-restore state through recovery.
- A read-only `node:sqlite` query inside the recreated container confirmed the relational columns and recovery row. The temporary harness required selector corrections and the documented `recovery.data` response shape; review then required a fresh strict run because the first retained phase-B artifact represented a post-restore resume. The final harness requires revision 0, waits for every UI commit and has no restore bypass. These were harness/evidence defects, not product defects. No source code change was required.
- Updated `README.md`, `VERIFICATION.md`, `WORK-STATUS.md` and the parent full-stack spec. Stopped the isolated Compose projects without `-v`; retained their volumes only for optional local reinspection, while portable JSON reports and screenshots carry the evidence. Port 80, default project names, existing volumes and actual user data remained untouched.

## Review Triage Log

| # | Verdict and route | Evidence |
|---|---|---|
| R1 | medium — patch | The first phase-B JSON represented a resumed post-restore state. A new `-02` run records persisted revision 7 and restored revision 8 in one successful run. |
| R2 | medium — patch | The resume bypass could pass without importing. It was removed; phase B now always imports the UI backup and requires a revision advance. |
| R3 | medium — patch | Reusing arbitrary prior rows weakened isolation. Phase A now requires revision 0 and empty course/task/session collections in a new project-scoped volume. |
| R4 | low — patch | Several UI submissions were read immediately. The harness now polls the API for every course, task and session commit before asserting. |
| R5 | low — patch | The harness hard-coded port 18088. It now accepts `STUDIEPLAN_BASE_URL` while retaining the documented loopback default. |
| R6 | medium — patch | State artifacts alone did not prove Docker topology. `docker-orchestration.json` records build, health, user, port, volume, old/new container IDs, SQLite result and cleanup. |
| R7 | false — reject | Service recreation is intentionally orchestrated outside the browser harness. The external command asserted a changed container ID and healthy status, and the structured orchestration artifact records the same-volume result. |
| R8 | medium — patch | Historical blocked text could read as current. VERIFICATION now marks those paragraphs as superseded before the completed acceptance section. |
| R9 | medium — patch | The parent spec retained the original V3 blocker. A V3 follow-up row and superseding observed result now record completed runtime evidence without rewriting history. |
| R10 | medium — patch | This runtime spec remained in progress. It is closed as done after the strict rerun and review triage. |
| R11 | medium — defer | Legacy migration/idempotency and Docker recreation pass separately, but were not combined in one Docker run. The optional combined proof is recorded in `deferred-work.md`. |
| R12 | low — defer | Seed/no-overwrite has focused database coverage, while the strict Docker run kept optional seed disabled. Container-path evidence is recorded in `deferred-work.md`. |
| R13 | low — patch | README used a machine-specific source path. Ordinary startup now runs from the directory containing README, independent of extraction path. |
| R14 | low — patch | The harness ordering was not documented. VERIFICATION now records phase A, force-recreate validation and phase B commands in order. |
| R15 | low — patch | A retained local volume is not portable evidence. Documentation now calls it optional reinspection only and identifies the portable JSON/screenshots as evidence. |
