---
title: 'Story 1.3: Correct and delete saved tasks'
type: 'feature'
created: '2026-09-06'
status: 'done'
route: 'dispatch'
story_key: '1-3-rette-og-slette-egne-oppgaver'
baseline_commit: 'NO_VCS'
review_loop_iteration: 0
context:
  - '.docs/planning-artifacts/stories/1-3-rette-og-slette-egne-oppgaver.md'
  - '.docs/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Accepted stories 1.1/1.2 create and retain tasks but cannot correct or remove them. Implement only story 1.3, using its four acceptance criteria and epics.md as the sole epic source.

**Approach:** Reuse the inline form for editing; add task actions, deletion confirmation, explicit persistence outcomes and relevant focus. The user authorizes independent building, testing, code review and a concrete handover without another bmad-spec round or routine approval.

## Boundaries & Constraints

**Always:** Preserve the controller/state, pure rules, DOM UI and storage-adapter boundaries. Keep `studieplanlegger:v1` and `{schemaVersion: 1, tasks: [...]}`: unique nonempty string IDs, trimmed nonempty title/course, local `YYYY-MM-DDTHH:mm`, positive safe integer minutes, boolean completed. Validate the entire candidate, write once, then update saved state and success. Sort copies, display user content as text. Preserve exact dependencies/lockfile, Oslo tests, strict ports 5173/5174 and every sprint key.

**Never:** Access personal browser data, auto-reset unreadable storage, write on cancel/startup/render, convert deadlines to UTC, build completion/undo, week views or time filters. No Git repository/commit, installation without concrete failure, backend, account or publishing. Trial remains Ikke startet with empty dates; actual start requires overall clearance and own-task use, ending one calendar month later. Human acceptance of 1.2 does not accept 1.3.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected behavior | Error handling |
|---|---|---|---|
| Edit | Existing task; all four valid changed fields | Prefill same form; update selected ID only, preserving completed and storage position | Shared create validation; no duplicate |
| Invalid edit | Missing/whitespace fields, calendar/DST error, invalid/unsafe minutes | Field errors; retain draft and old task; zero writes | Focus first invalid field |
| Cancel edit | Open changed or invalid draft | Close/reset form; zero writes; restore selected edit control | Old values reappear on next edit |
| Delete | Several tasks; selected ID | Confirm identifies task; cancel writes nothing; confirm removes only selected ID | Last deletion shows empty state and Ny oppgave |
| Failed write | Edit or confirmed delete throws | Retain old list/raw value; retain any draft; announce unsaved action | Retry succeeds once without duplicate or wrong deletion |
| Bad read | Invalid data/getter/getItem failure | Block creation, editing and deletion; preserve raw value | Retry releases only after valid read |
| Persistence/focus | Successful edit/delete then reload/reopen | Same IDs/values/status/order; deleted task stays absent | Focus edited task, nearby remaining task or Ny oppgave |

</frozen-after-approval>

## Code Map

- `studieplanlegger/src/main.js`: sole saved-state owner; extend draftId/create/save/cancel without committing before storage.write succeeds.
- `src/tasks.js`: reuse validateDraft, validTasks and sortedTasks; add pure ID-targeted candidate operations. validateDraft currently creates completed:false, so editing must retain saved identity/status explicitly.
- `src/storage.js`: keep current full-list validation and explicit outcomes; no storage migration.
- `src/ui.js`, `index.html`, `src/style.css`: reuse one form, labels/errors/status and text rendering; add edit/delete controls and focus restoration without task IDs interpolated into unsafe selectors.
- `tests/unit/tasks.test.js`, `tests/unit/storage.test.js`, `tests/e2e/tasks.spec.js`, `tests/e2e/shell.spec.js`: retain all 43 unit/14 browser regressions; add focused edit/delete coverage.
- `README.md`, `tests/unit/README.md`: document available actions and failure recovery. Preserve package files and test isolation. Baseline: `.tmp/story-1-3-baseline/studieplanlegger/`.

## Tasks & Acceptance

**Execution:**
- [x] `studieplanlegger/src/tasks.js`, `tests/unit/tasks.test.js` — immutable edit/delete by ID, shared validation; test matrix and retained fields/order.
- [x] `studieplanlegger/src/main.js`, `src/ui.js`, `index.html`, `src/style.css` — form modes, guarded actions, confirmation, atomic outcomes, feedback and focus.
- [x] `studieplanlegger/tests/e2e/` — all-field edits, cancel/invalid paths, confirmed/last deletion, injected failures/retries, read locks, write counts, reload/reopen, ties/status and keyboard at 360/1280.
- [x] `studieplanlegger/README.md`, `tests/unit/README.md` — explain edit/delete and preserved data on errors.
- [x] `.docs/implementation-artifacts/story-1-3-evidence.md`, `story-1-3-handover-check.md`, `next-chat.md`, source story and sprint — record actual evidence, review and pending human checks, preserving other progress.

**Acceptance Criteria:**
- Given keyboard use at 360/1280 px, when editing, cancelling or deleting, then controls remain reachable, focus visible and meaningful, and essential content fits the viewport.
- Given this delivery, when the student reads the handover, then executed automation/agent observations are distinct from pending physical keyboard and new-action acceptance checks.

## Implementation Notes

- Activation rendered once successfully. Epic cache regenerated by the prescribed compiler subagent and verified. All requested source/continuity files read; 1.2 human acceptance confirmed. User's independent-build instruction and subsequent continue authorize implementation from this concrete spec without another approval round. Baseline copied before source changes; no VCS exists.

- Implementation dispatched without conversation context; root owned handover/status documents. All five task groups are implemented, including documented pending human checks. Root read the complete source diff twice after changes and audited all seven matrix rows against executed tests. One root finding reproduced a delete error outside the viewport; local task feedback now preserves focus and exposes retry. The regression failed before correction and passed after it.
- Pre-review full verification: 61/61 unit tests (232 ms), 22/22 browser tests (9.0 s, escalated with normal exit), production build exit 0 (80 ms). Both package hashes unchanged. Root inspected error, form, save-focus and delete-error screenshots. Full diff: C:/Users/dzfgd/AppData/Local/Temp/story-1-3-review-dfZOOD/changes.diff (48,763 bytes). Human acceptance remains pending.

## Spec Change Log


## Review Triage Log

2026-09-06: all three context-free reviewers ran at the parent model capability on the 48,763-byte diff; Blind Hunter floor min(floor(sqrt(48.763)+1),10)=7. Edge Case Hunter returned no findings after code tracing and claims check. Two instruction reads first failed in the sandbox, then completed through authorized escalation; no review layer was skipped. Each finding was graded before grouping:

| Finding | Verdict and evidence | Route |
|---|---|---|
| B1: task action accessible names contain no task identity | medium: UI creates each button with only Rediger/Slett text and no accessible task reference. A button list or restored focus cannot identify its task. | patch: add title to accessible names; update action locators and verify names |
| B2: hidden local alert may not announce when shown | maybe-false, potential low impact: role=alert is present before visibility changes, but no screen-reader trace establishes a missed announcement. Exact supported browser/screen-reader speech output would settle it; DOM visibility alone cannot. | reject: unverified low-impact claim; no claim of physical assistive-technology validation |
| B3: identical successive delete status may not announce | maybe-false, potential low impact: a browser probe confirmed textContent assignment replaces the text node and emits one mutation even for identical text. Whether a specific screen reader suppresses speech remains unverified and needs an actual speech trace. | reject: unverified low-impact claim; DOM mutation is not proof of speech |
| B4: edit write error can be outside a short viewport | medium: isolated Chromium probe at 360x500 measured feedback top -333.45/bottom -256.67 while Lagre remained focused; the error was wholly outside the viewport. | patch: place the error by form actions and verify message/control visibility with retained draft and retry |
| B5: duplicate task titles absent from browser fixtures | low: all current row helpers use unique titles, so incorrect title-based dispatch would escape this coverage despite the ID contract. Domain tests alone do not exercise DOM dispatch. | patch: two same-title tasks with distinct IDs; edit/delete only the selected task |
| B6: task-action lock only tested during edit | low: the active-create path with existing tasks is not exercised, leaving a draft-overwrite regression undetected. Shared UI code is currently correct. | patch: create draft locks task actions, and cancel/save restores them without unwanted writes |
| B7: cancel after failed edit untested | medium: current failure test retries the same draft; ordinary cancel has no write failure. Premature saved-state replacement would survive both cases. | patch: failed write, cancel, reopen original values, then save another task |
| V1: controller state after failed edit/cancel unverified | medium: accepted pre-verified regression gap; assigning tasks=result.tasks during candidate selection leaves existing tests green and can later persist a cancelled edit alongside another task. | patch: same missing transition as B7 |

B7 and V1 share the same missing failure/cancel/state-consumer test and were grouped for one correction. Five patch groups; no intent gap, bad-spec loop or deferred work. The original implementation agent was re-engaged with the prescribed patch prompt but could not continue because of its usage limit; root applied the patches under step-04's fallback. Button names now include task titles. Write errors reuse the existing status region beside form actions, with focus on Lagre; other messages restore its usual position. Three added browser tests cover duplicate titles, creation draft locks and failed-edit/cancel/reopen followed by saving a different task.

Final root verification, 2026-09-06: npm.cmd test 61/61, exit 0, 247 ms at 23:14:05; npm.cmd run build exit 0, eight modules, 107 ms; npm.cmd run test:e2e 25/25, exit 0, 13.3 s with normal escalated cleanup. Root read the patch diff and inspected the final 360x500 form-error viewport. All matrix rows and accepted patch findings are covered by passing tests. Final full source diff: C:/Users/dzfgd/AppData/Local/Temp/story-1-3-review-aKpgyh/changes.diff (54,009 bytes). Package/lock hashes unchanged. No deferred findings, no commit. Spec done records complete build/review; source story and sprint remain review pending human acceptance.

## Design Notes

No unresolved intent gaps or irreversible build actions. Multi-module change requires dispatch. Use native confirmation as permitted by architecture. While a form is open, prevent another task action from silently replacing its draft; complete or cancel it first. After deletion, prefer the next visible task, then previous, then Ny oppgave. These are reversible implementation choices. No VCS exists; preserve pre-change files for a complete no-index review diff.

## Verification

- From `studieplanlegger/`: `npm.cmd test`, `npm.cmd run test:e2e` (escalated for normal cleanup), `npm.cmd run build`; all applicable checks must pass.
- Check unchanged package hashes, inspect 360/1280 screenshots, audit matrix coverage and full diff. Browser tests use isolated contexts exclusively at 5174. Record human handover separately.

## Human Acceptance — 2026-09-06

Full human handover was confirmed on 2026-09-06 (local date, Europe/Oslo): «Jeg gjorde alt i # Story 1.3 — menneskelig overtakelse. alt funket.» All items in the [handover check](story-1-3-handover-check.md), including the physical keyboard and clarity checks, are recorded as confirmed by the student. The source story and sprint are now `done`; this spec remains `done`. Earlier pending-acceptance statements above describe the build/review history and are superseded by this note. No new automated tests were run for this documentation update. The frozen intent block and acceptance criteria are unchanged. The monthly trial remains **Ikke startet**, with empty start and end dates.
