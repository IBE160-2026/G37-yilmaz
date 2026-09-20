---
title: 'Story 1.2: Create tasks and retain them safely'
type: 'feature'
created: '2026-09-06'
status: 'done'
baseline_commit: 'NO_VCS'
route: 'dispatch'
story_key: '1-2-opprette-oppgaver-og-beholde-dem-trygt'
review_loop_iteration: 0
context:
  - '.docs/planning-artifacts/stories/1-2-opprette-oppgaver-og-beholde-dem-trygt.md'
  - '.docs/implementation-artifacts/epic-1-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The accepted 1.1 shell cannot register tasks. Implement only story 1.2 so students can create tasks and reliably find their saved work again.

**Approach:** Add an inline Norwegian form, an all-tasks list, pure validation and a storage adapter. Implement all five source-story acceptance criteria. User authorizes independent implementation, testing, code review and a concrete handover; build documents are permitted without another planning approval.

## Boundaries & Constraints

**Always:** Controller owns saved state; UI sends actions; only storage adapter accesses localStorage. Key `studieplanlegger:v1`, envelope `{schemaVersion: 1, tasks: [...]}`. Tasks have unique nonempty string IDs, trimmed nonempty title/course, local `YYYY-MM-DDTHH:mm` deadline, positive safe integer minutes and boolean completed; new tasks append unfinished. Sort copies by deadline, preserving source position on ties. Render user content as text. Retain dependencies and lockfile, strict ports 5173/5174, isolated test contexts and existing sprint keys.

**Never:** Build 1.3 or later, fake action controls, reset unreadable data, write on startup/render/cancel, convert deadlines to UTC, create Git/backend/accounts or publish. Trial remains Ikke startet with empty start/end dates. Human acceptance of 1.1 does not accept 1.2.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected behavior | Error handling |
|---|---|---|---|
| Create | Valid form, readable storage | Validate full candidate, write once, then replace state/show success | Preserve original state and draft until successful write |
| Invalid form | Missing/whitespace text; missing date/time; calendar rollover; empty/zero/negative/fractional/unsafe minutes | Field errors, no writes, retain input | Focus first invalid field; accessible error association |
| Oslo clock | 2026-03-29T02:30 / 2026-10-25T02:30 | Reject missing spring minute / accept repeated autumn label unchanged | No automatic date adjustment |
| Write failure | Existing tasks plus draft, setItem throws | Previous data/list and draft retained, explicit unsaved error | Retry saves once without duplicate |
| Read | Missing key / valid envelope | Empty list without write / same tasks after reload and page reopen | Empty state offers Ny oppgave |
| Bad read | Getter/getItem error, malformed JSON/schema/fields/IDs | Block mutations, retain raw storage, distinct error state | Prøv igjen reads again; unblock only after valid read |

</frozen-after-approval>

## Code Map

- `studieplanlegger/index.html`, `src/style.css`: reuse Norwegian shell, skip link, local details and focus style; replace obsolete welcome text.
- `src/main.js`: currently CSS import only; becomes controller. Add `src/tasks.js` (rules), `src/storage.js` (adapter), `src/ui.js` (DOM).
- `tests/e2e/shell.spec.js`: replace zero-button/no-storage/old Tab claims; retain Norwegian, focus, responsive and resource checks.
- `vitest.config.js`, `playwright.config.js`: preserve discovery/strict server isolation; explicitly set Europe/Oslo for tests.
- `package.json`, `package-lock.json`: exact versions verified; preserve. Baseline copy: `.tmp/story-1-2-baseline/studieplanlegger/`.
- `README.md`, `tests/unit/README.md`: replace obsolete no-save/no-test statements. Reuse accepted 1.1 setup.

## Tasks & Acceptance

**Execution:**
- [x] `src/tasks.js`, `tests/unit/tasks.test.js` — validate form/task lists, local dates, safe minutes, IDs and stable copy sorting; test matrix boundaries.
- [x] `src/storage.js`, `tests/unit/storage.test.js` — validate reads/candidates, catch access/parse/write failures, expose explicit outcomes; verify preserved data and write counts.
- [x] `src/main.js`, `src/ui.js`, `index.html`, `src/style.css` — implement create/cancel/retry, controller state transition after write, text-only list, labelled form and accessible feedback/focus.
- [x] `vitest.config.js`, `playwright.config.js`, `tests/e2e/shell.spec.js`, `tests/e2e/tasks.spec.js` — explicit Oslo timezone; test matrix, reopened page in same isolated context, literal HTML text, no writes on passive actions, one write before visible success.
- [x] `README.md`, `tests/unit/README.md` — document available function, retry behavior, local-only limitations and meaningful tests.
- [x] `.docs/implementation-artifacts/story-1-2-evidence.md`, `story-1-2-handover-check.md`, `next-chat.md`, source story — document actual verification and pending human checks. Root finalizes review/status after implementation.

**Acceptance Criteria:**
- Given a saved task, when reloading or closing/reopening a page at the same origin/context, then the same task/ID/clock label appears once with all values and textual status.
- Given keyboard use at 360/1280 px, when opening/submitting/cancelling the form, then labels, field errors, feedback and visible focus remain usable without horizontal page scrolling.
- Given this delivery, when reading the handover, then automated/agent observations are separate from pending physical keyboard/field-error checks and unstarted monthly trial.

## Implementation Notes

- Subsequent human acceptance, 2026-09-06: the student explicitly confirmed that every item in the 1.2 handover checklist worked. Source story and sprint are now done. Later wording below about pending checks/review preserves the earlier build history. See [human acceptance](story-1-2-handover-check.md). No new code/tests; monthly trial remains unstarted.

- Implemented all six execution tasks; source files are under `studieplanlegger/`. User's independent-build instruction and subsequent “continue” authorize proceeding from the reviewable spec. No intent gap required another planning question.
- Activation rendered once, exit 0. Regenerated epic context through the prescribed subagent; verified 1.1 story/sprint/handover done. No VCS; diff generated with `git diff --no-index` against the preserved pre-change source copy, without creating a repository.
- Root read the complete source diff, audited all six matrix rows against executed unit/browser tests and inspected form errors/long titles at 360/1280. All matrix rows covered: domain validation/date tests; adapter read/write tests; browser creation, invalid form/cancel, retry, malformed data and reopen tests.
- Root strengthened getter/getItem failure tests with existing raw data, zero writes through failed/successful retries and restored task identity. Initial HTML now blocks creation and hides empty-state content until storage is read; a delayed-module browser test verifies this.
- Verified 2026-09-06: Vitest 43/43 (675 ms), Playwright 12/12 (4.4 s, normal exit), production build exit 0 (84 ms). No tests skipped. [Evidence](story-1-2-evidence.md) records prior failures/fixes; [human checks](story-1-2-handover-check.md) remain pending. Review/status finalized separately below.

## Spec Change Log

## Review Triage Log

2026-09-06: all three context-free reviewers completed on the same model capability. Initial sandbox read failures were retried with authorized escalated reads; the edge reviewer also encountered a quota failure before succeeding after the user's continue. Blind Hunter diff: 42,512 bytes, N=7. Nine findings evaluated individually before grouping:

| Finding | Verdict and evidence | Route |
|---|---|---|
| B1: stored deadline becomes invalid after UTC → Oslo travel into a DST gap | low: reproduced with the unchanged label 2026-03-29T02:30. Raw data is retained and restored by returning to the original timezone; ordinary use in one device timezone is unaffected. Fix needs distinct stored/create validation semantics, beyond a direct correction. Architecture defers timezone-travel support. | reject: rare low-impact case requiring additional branches/contract semantics |
| B2: trailing newline passes deadline regex | false: direct execution rejected LF, CR, CRLF, U+2028 and U+2029 suffixes; the exact label passed. The regex has no multiline flag. | reject: disproved |
| B3: keyboard test bypasses intervening tab stops | medium: shell test uses direct focus on cancel and fill; continuous forward/backward reachability is unverified. | patch: traverse Tab/Shift+Tab to fields and cancel |
| B4: equal deadlines lack persistence integration coverage | low: unit copy-sort test covers ties, browser suite only different deadlines. | patch: add equal-deadline reload coverage |
| B5: loaded completed task preservation untested | low: UI/storage accept booleans correctly, but browser fixtures are all unfinished. | patch: load a completed task and preserve status when appending |
| B6: failed-write unit fixture does not share its raw value with reads | low: standalone raw assertion cannot detect state replacement; browser test does cover real storage. | patch: use one backing value and read through adapter after failure |
| B7: disabled JavaScript has no explanation | low: initial button stays disabled and content hidden. Static correction adds no execution branch. | patch: Norwegian noscript explanation |
| V1: cleared draft/errors on reopen untested | medium: pre-verified regression gap; removing reset/errors from close would leave current tests green and risk accidental copies. | patch: assert blank fields/cleared errors after cancel and successful save |
| E1: timezone travel blocks list at new-zone DST gap | low: independently verified same outcome as B1; raw label is preserved, not converted or overwritten. Rare travel case needs separate validation semantics. | reject: same rare low-impact complexity rule as B1 |

All six patch findings resolved by the original implementation agent and checked by root. Final verification: 43/43 unit tests (269 ms), 14/14 browser tests (6.5 s, normal exit), production build exit 0 (111 ms). The noscript test initially targeted filtered text; corrected to the visible paragraph and passed. The full diff was read from a local temporary review file that is intentionally not part of the delivery. No findings deferred, no review loopback, no commit. Spec done records completed build/review; sprint and source story remain review pending human acceptance.

## Design Notes

No intent gaps or irreversible actions. Dispatch: three new modules plus UI/tests/docs. Strict date shape and local component round-trip reject rollover/DST gaps. Minute text uses decimal digits and safe-integer validation. Retain draft ID and form DOM on errors; clear only after success/cancel. Clock loop starts in 2.1.

## Verification

- `npm.cmd test`: domain/storage matrix tests pass; assert Oslo timezone.
- `npm.cmd run test:e2e`: isolated Chromium on 5174; matrix, keyboard/layout/resource checks pass.
- `npm.cmd run build`: exit 0 and local dist output.
- Check unchanged package/lock hashes; inspect 360/1280 screenshots. Human keyboard/field-error checks remain pending.
