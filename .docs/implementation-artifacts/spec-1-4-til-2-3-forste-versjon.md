---
title: 'Complete version one: stories 1.4, 2.1, 2.2 and 2.3'
type: 'feature'
created: '2026-09-06'
status: 'done'
route: 'dispatch'
baseline_commit: 'NO_VCS'
review_loop_iteration: 0
story_keys:
  - '1-4-fullfore-oppgaver-og-angre'
  - '2-1-se-denne-ukens-frister-og-forfalte-oppgaver'
  - '2-2-finne-en-oppgave-som-passer-tilgjengelig-tid'
  - '2-3-kontrollere-forste-versjon-og-klargjore-egen-utproving'
context:
  - '.docs/implementation-artifacts/epic-1-context.md'
  - '.docs/implementation-artifacts/epic-2-context.md'
  - '.docs/planning-artifacts/stories/1-4-fullfore-oppgaver-og-angre.md'
  - '.docs/planning-artifacts/stories/2-1-se-denne-ukens-frister-og-forfalte-oppgaver.md'
  - '.docs/planning-artifacts/stories/2-2-finne-en-oppgave-som-passer-tilgjengelig-tid.md'
  - '.docs/planning-artifacts/stories/2-3-kontrollere-forste-versjon-og-klargjore-egen-utproving.md'
---

> Historical accepted implementation specification. Its frozen intent, test evidence and scope describe the version before the authorized 2026-09-07 additions. The [current extension specification](spec-study-actions.md) supersedes the affected suggestion, overdue and task-contract rules; old approval is not approval of the additions.

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Accepted 1.1–1.3 provide safe task maintenance; completion, deadline views, time selection and final acceptance preparation remain.

**Approach:** Implement every acceptance criterion in the four context stories in order 1.4 → 2.1 → 2.2 → 2.3. The user explicitly chose all remaining goals and authorized independent building, testing, review and story documentation. Final human acceptance remains separate.

## Boundaries & Constraints

**Always:** Preserve layered ownership, full-candidate validation → one write → saved-state replacement/success, IDs, storage positions, literal text rendering, local calendar fields, positive safe integer minutes and the existing version-one envelope. Retain exact package/lock files and all regression meanings. Use npm.cmd/npx.cmd; explicit Europe/Oslo, isolated test contexts on strict 5174, personal use strict 5173. Run browser tests escalated for normal cleanup when needed.

**Never:** Access personal browser data; reset bad storage; persist view/minute selections; write on refresh/cancel; create Git, commits, backend, accounts, publishing, tracking or extra features; install without concrete failure. Trial stays **Ikke startet**, blank dates until overall clearance and actual own-task use; end one calendar month later. Do not equate 1.3 approval with new-action approval.

## I/O & Edge-Case Matrix

| Scenario | Input/state | Expected behavior | Error handling |
|---|---|---|---|
| Complete/undo | Selected saved ID | Only boolean changes, identity/order retained; reload/reopen persists; keyboard focus retained | Failed write restores checkbox and state, visible retry; read lock covers every mutation |
| Week/all | Injected local now | Initial week Monday inclusive/next Monday exclusive, including month/year/DST boundaries; all retains every task, stable copied deadline order | Meaningful empty week with create/all routes |
| Overdue/clock | Before/exactly/after deadline, completed tasks | Strictly after only; weekly count across all weeks plus all shortcut; actions/focus/visible one-second refresh | No writes, intact form/filter drafts and focus; unchanged wall-clock labels across timezone changes |
| Time selection | 30 minutes, 20/30/31 estimates, completed/overdue/future tasks | All-week unfinished hits ≤ minutes; deadline then storage order, not duration; valid selection retained across views | Empty/zero/negative/fractional/unsafe input: field error without misleading results or writes |
| Active results | Complete/undo, edit/delete, no hits | Successful changes update hits; disappearing item gets relevant focus; undo in all restores eligibility | Failed mutations keep prior hits/raw state/draft; empty text offers minutes/all |
| Whole application | 100 synthetic tasks; HTML-like text | All actions/views operable, no task transmission or external runtime resources | Preserve prior create/edit/delete read/write/cancel regressions |

</frozen-after-approval>

## Code Map

Paths below are relative to `studieplanlegger/` unless prefixed `.docs/`.

- `src/tasks.js`: reuse validation, edit/delete and stable sorting; add pure completion, minute and calendar/selection rules with injected now.
- `src/storage.js`: existing full-list contract and explicit failures; no migration needed.
- `src/main.js`: sole saved-state owner; add transient view/minutes and shared-clock refresh. Existing handlers already guard drafts and defer commits until write success.
- `src/ui.js`, `index.html`, `src/style.css`: reuse inline form and local feedback. Current render replaces rows: preserve nodes during clock ticks, including focused controls and local errors. Keep IDs out of CSS selectors.
- `tests/unit/`, `tests/e2e/`: 61 unit and 25 browser regressions. Existing dated CRUD fixtures need explicit all-view selection after navigation; adapt keyboard stops for new navigation without dropping assertions. Seed once for persistence tests.
- `README.md`, `tests/unit/README.md`: document the finished behavior. Package files/config already pin compatible tools and isolate test contexts.

## Tasks & Acceptance

**Execution:**
- [x] `src/tasks.js`, `src/main.js`, `src/ui.js`, `index.html`, `src/style.css` — completion, week/all/live overdue, then time selection; preserve existing contracts.
- [x] `tests/unit/` — exercise every matrix boundary, immutable candidates, repeated/local DST minutes and preserved wall-clock labels.
- [x] `tests/e2e/` — preserve old regressions; cover completion/undo persistence/failures, controlled-clock rollover/focus/drafts/no writes, filter mutations/errors, keyboard at 360/1280, 100 tasks and network privacy.
- [x] `README.md`, `tests/unit/README.md` — explain actions, recovery, views and local use.
- [x] `.docs/implementation-artifacts/version-one-evidence.md`, `version-one-handover-check.md`, `trial-log.md`, `project-reflection.md`, `next-chat.md`, source stories and sprint — root records actual results, pending human checks, untouched trial dates and exact existing keys.

**Acceptance Criteria:**
- Given all four source stories, when technical delivery is reviewed, then every automatic criterion has executed evidence and missing human checks are explicit, with source/sprint review pending human acceptance.
- Given keyboard use at 360/1280, when navigating and mutating tasks, then focus is visible/relevant and essential content fits without horizontal scrolling.

## Implementation Notes

- Activation rendered exactly once successfully for this remaining-version run. Both epic contexts were compiled by the prescribed compiler agents and verified. Previous completed 1.3 continuity was read; its human acceptance is recorded separately. User explicitly retained all four goals and repeatedly authorized autonomous completion, including story documents, so no routine spec approval pause is introduced. This combined spec is approximately 2,000 tokens; its larger context increases omission risk, addressed by the source-AC and matrix audit. Baseline was preserved before changes; no VCS exists.

- Context-free implementation dispatch completed application/tests/README; root owns acceptance/status documents. Root read the complete 1,919-line source diff and subsequent timezone-test correction. All six matrix rows have executed passing coverage in remaining.test.js plus completion/views/time-filter/acceptance browser suites and the preserved 25 baseline browser regressions. Root verification 2026-09-06: 142/142 unit tests (453 ms, 23:52:12), build exit 0 (87 ms), 49/49 browser tests (21.2 s, normal escalated exit). Package hashes unchanged. The review diff was read from a local temporary file that is intentionally not part of the delivery. Human checks and trial are explicitly pending.

## Spec Change Log


## Review Triage Log

2026-09-07: all three prescribed independent layers completed against the same 116,383-byte diff: blind review (floor 10, ten findings), edge-case review (one), verification-gap review (one preverified). Snapshot reads needed escalation; the final reviewer started after a temporary agent-capacity limit cleared. No layer was skipped. Each finding is graded below before grouping.

| ID | Severity / verdict | Evidence and disposition |
| --- | --- | --- |
| B1 | Medium, defer | A saved Oslo `2026-03-08T02:30` is rejected in New York. Root reproduced identical read/write behavior in baseline and current code. Pre-existing timezone-travel limitation; architecture defers travel support. Changing stored validation would weaken the retained read lock without provenance/schema changes. Clarify the limitation; defer functional change. |
| B2 | Medium, defer | Cached whole-list writes can overwrite another editing tab. Baseline already has this behavior and documents one editing tab. Multi-tab coordination is outside the agreed version-one architecture; retain the explicit usage limit. |
| B3 | Medium, patch | UI repairs focus only for disappearing task rows. The focused empty-week All button can be hidden when Monday introduces tasks. Preserve focus by moving to a relevant visible control; test this transition. |
| B4 | Medium, patch | Saving outside the active week or minute selection displays generic success beside an unchanged empty list. Give an accurate saved-but-outside-selection message and the All route; test both views. |
| B5 | Low, patch | Draft-lock explanation is calculated only when opening the form. Switching from empty filtered results to populated All leaves disabled rows unexplained. Recalculate this simple visibility state during render. |
| B6 | Low, reject | Unchanged ticks assign unchanged attributes repeatedly. The observation is valid, but no user-visible defect or performance failure was demonstrated with 100 tasks; per-attribute guards add complexity for marginal benefit. Existing text guards already prevent repeated live-region text changes. |
| B7 | Low, patch | The changing overdue total has no live-region semantics. Add polite, atomic announcement to the existing text-guarded count; do not claim physical screen-reader verification. |
| B8 | Low, patch | Shared focus helper checks horizontal bounds only. Strengthen existing keyboard checks to detect vertically clipped focused controls and visible focus outline. |
| B9 | Medium, patch | Write-failure instrumentation captures rendered status/feedback before writing, but the completion tests do not assert them. Assert that saved-status text and success feedback have not advanced before the write, in both directions. |
| B10 | Low, patch | Visibility test dispatches a visible event only. Add explicitly simulated hidden/resumed state with clock and retained draft/focus; distinguish simulation from real window minimization. |
| E1 | Medium, defer | Same timezone-gap consequence as B1, also reproduced on the baseline. Raw stored data remains preserved; group only after this individual assessment. |
| V1 | Medium, patch | Preverified verification gap: using total tasks instead of matching tasks in the live filter summary survives existing assertions. Trust the reviewer's evidence; assert exact five matches and four after completion. |

Routing after individual grading: eight separate trivial patch groups (B3, B4, B5, B7, B8, B9, B10, V1), no public contract change; one rejected low-priority group (B6). Two pre-existing groups are recorded in `deferred-work.md`: B1/E1 together, and B2 separately. No intent/spec change is needed. Re-engage the original implementation agent for the small patches; root performs full verification afterward.

Patch outcome 2026-09-07: the same implementation agent completed all eight groups and clarified the two existing limitations in README. B8's stronger checks demonstrated actual clipping and lost outer datetime focus, raising its practical severity to medium. The minimal CSS/UI fixes retain the datetime outline, provide scroll margin, and keep previously visible focus in view after layout shifts. Deliberate scrolling away remains unchanged and is tested. Initial targeted keyboard failures are recorded in the evidence; final targeted results were 25/25 affected behavior tests and 6/6 keyboard tests. No assertions were removed.

Root read the complete patch diff, including the subsequent CSS/UI and clock-test corrections. Final verification 2026-09-07: 142/142 unit tests at 00:18:53 (526 ms); build exit 0 (94 ms); 53/53 browser tests (21.7 s), normal escalated cleanup with strict 5174 confirmed free over IPv4 and IPv6. All 25 baseline browser regressions remain, with 28 new tests. The final full diff was read from a local temporary file that is intentionally not part of the delivery; package hashes remain identical. All patch groups are resolved; two pre-existing groups remain explicitly deferred. No further review loop or code change is needed. The spec is done under step 5; all four source stories and exact sprint keys move to review pending actual human acceptance. Both epics remain in-progress; the trial is not started.

## Design Notes

No unresolved intent gap or irreversible build action. Multi-module dispatch; user retained all four goals. Root owns documentation/status tasks, implementation agent owns application/tests/README and may delegate independent tests. Preserve baseline `.tmp/version-one-baseline/studieplanlegger/` for complete no-index review. Keep current draft lock for task actions. Clock refresh must patch/reconcile existing rows; if a focused row ceases to belong to the week, move to a relevant remaining control. Invalid filter submissions must not imply old hits match the new input; hide them or label their last valid minutes explicitly.

## Verification

From `studieplanlegger/`: `npm.cmd test`, `npm.cmd run test:e2e`, `npm.cmd run build`, all successful. Root audited matrix/source AC, package hashes, full diff, three independent review layers and screenshots. At technical closure, manual handover and trial were pending; no personal browser automation.

## Human Acceptance — 2026-09-07

After being asked to perform the entire version-one handover checklist personally at 360/1280 with physical keyboard use, the student replied: «Alt funket». This is recorded as acceptance of all 14 checklist items in `version-one-handover-check.md`. The four source stories and their exact sprint keys, plus both epics, are now done. Prior accepted stories remain done and retrospectives remain optional. The earlier automated report remains historical automated evidence, not the basis for personal acceptance.

This is a documentation-only acceptance update: no new render, code change, test run or personal-browser inspection. The frozen intent and acceptance criteria are unchanged. Known multi-tab/timezone limitations and recorded wording improvements remain documented. The monthly trial remains Ikke startet with blank dates until actual own-task use begins after clearance.
