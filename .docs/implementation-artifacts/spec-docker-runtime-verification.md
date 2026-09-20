---
title: 'Docker runtime and persistence verification'
type: 'chore'
created: '2026-09-20'
status: 'done'
route: 'oneshot'
review_loop_iteration: 0
context:
  - '{project-root}/.docs/implementation-artifacts/spec-fullstack-database-docker-delivery.md'
  - '{project-root}/studieplanlegger/UV-STARTUP.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The full-stack delivery is implemented, but its actual Docker build, browser use, and named-volume persistence remain unverified because base-image transfers failed with `local error: tls: bad record MAC`.

**Approach:** Diagnose the local Docker transport with observed logs and a few targeted reversible actions, then build the clean delivery under a unique Compose project and loopback port. Verify UI-created linked data, container recreation with the same isolated volume, a fresh browser profile, and backup/restore; preserve port 80, user data, existing volumes and the implemented architecture. Never disable TLS verification, use insecure registries, factory-reset Docker, publish externally, or push to GitHub.

</frozen-after-approval>

## Implementation Notes

- BMAD startup was restored by reusing the documented narrow `require_escalated` execution from `C:\IBE160\2026`: both the direct uv executable and `uv --version` returned 0.12.6, and the required generator returned exit code 0. The earlier failure was restricted-process execution, not a missing or damaged uv installation.
- Read-only diagnosis found Docker Desktop 4.88.1, Engine/client 29.7.2, containerd 2.3.3 and active `desktop-linux`. WinHTTP and user environment expose no external proxy; Docker logs say registry/CDN traffic is direct.
- `vm/init.log` records three BuildKit transfers failing on the same layer with `tls: bad record MAC`. Docker Desktop's independent updater reports the same TLS error repeatedly, proving that this observed transfer failure occurs outside project build steps without validating the still-unbuilt Dockerfile. The evidence does not settle whether the remaining fault is Docker's VM/network stack, an adapter route, or the local network path.
- Use the clean copy `C:\IBE160\2026\.tmp\studieplan-docker-delivery-20260920-1108`, a unique Compose project, a confirmed-free loopback port and its automatically project-scoped named volume. Do not run `down -v`.
- The exhausted local actions are one pull while running, one after controlled Desktop restart and one with a temporary single-download limit. The next action is exactly one `docker pull node:24-bookworm-slim` on a different stable, trusted network path; success unlocks isolated Compose acceptance, while the same error narrows follow-up to Docker Desktop/WSL networking.
- Acceptance uses a temporary Playwright harness outside delivery files: browser A creates/edits course, task and session, records API IDs/relations, and exports a backup; force-recreate only the isolated service; browser B starts without storage state, proves DB-backed persistence, then restores the backup and rechecks exact IDs/relations.
- The only physical network path was Wi-Fi; Ethernet was already disconnected. One pull before restart, one after a controlled Desktop restart, and one with temporary `max-concurrent-downloads=1` all failed with the same TLS record error after partial layer progress.
- The engine configuration was restored byte-for-byte and Desktop restarted. No project image/container/volume or listener was created, so Docker build, browser acceptance and volume recreation remain unverified rather than inferred.
- Existing source and non-container verification remain unchanged; no product code changed and no repeated unit/build run was necessary. README, UV startup notes, work status and verification evidence now record observed commands, limits and the alternate-network next action.
- Reproducible acceptance values and commands are recorded in `studieplanlegger/VERIFICATION.md`: project `studieplan-docker-accept-20260920-01`, loopback port 18088, project-scoped volume inspection, health check and service-only force-recreate. Acceptance requires the same volume, a new container ID, identical linked IDs/relations in a fresh browser profile, a meaningful post-backup mutation, exact restore, revision advance and an available recovery snapshot; `down -v` is forbidden.

## Review Triage Log

| # | Verdict and route | Evidence |
|---|---|---|
| R1 | medium — defer | Institution adapter/program counts conflict across older documents, but this predates and is independent of Docker runtime verification; a deferred documentation reconciliation was recorded. |
| R2 | low — defer | WORK-STATUS places an older result before the full-stack section. Reordering the retained historical record is outside this transport task; a shared deferred documentation item was recorded. |
| R3 | low — defer | VERIFICATION likewise places older evidence before the later full-stack result. It shares R2's documentation-order issue and deferred route. |
| R4 | false — reject | README's ordinary Compose command is the end-user delivery path, while the clean-copy/project-scoped values are acceptance-only. The new blocker label prevents treating the command as already verified. |
| R5 | low — patch | The spec still described already exhausted actions as future work. It now names the alternate trusted network as the sole next action and gives both branches. |
| R6 | medium — patch | Later acceptance lacked runnable isolated values. VERIFICATION now supplies the clean-copy directory, project, port, config/up/health/volume/recreate/down commands. |
| R7 | medium — patch | Persistence assertions were implicit. Evidence now requires health, exact volume mount, new container ID, revisions, stable linked IDs and no remaining listener. |
| R8 | medium — patch | Restore could have been superficial. The procedure now requires a post-backup mutation, exact pre-mutation restore, revision advance and recovery snapshot. |
| R9 | medium — patch | Saying updater failures rule out the Dockerfile was too broad. Documentation now limits the conclusion to the observed TLS transfer failure and leaves hidden Dockerfile defects unverified. |
| R10 | low — patch | Docker log evidence was too generic. VERIFICATION now records absolute log paths, bounded UTC timestamps, commands and restoration hash. |
| R11 | low — patch | README called all dependencies locked despite a mutable base tag. It now limits lockfile wording to npm and names the mutable Node tag. |
| R12 | low — patch | The browser-data warning did not distinguish runtimes. README now explains localStorage development mode versus authoritative SQLite production mode. |
| R13 | low — patch | README conflated Compose volume key and rendered Docker name. It now explains both. |
| R14 | low — patch | Seed validity was unclear. README now states that `.env.example` contains a valid empty v1 envelope. |
| R15 | low — patch | The launch command appeared before its local verification limit. README now labels the host-specific runtime blocker immediately before the command. |
