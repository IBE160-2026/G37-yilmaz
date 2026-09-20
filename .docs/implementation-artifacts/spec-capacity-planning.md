---
title: 'Kapasitetsplanlegging og grunnlag for egen utprøving'
type: 'feature'
created: '2026-09-07'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'NO_VCS'
---

<frozen-after-approval reason="User authorized implementation and ordinary technical decisions in the request">

## Intent

Compare remaining study work with real study sessions before deadlines, explain shortages, and prepare a month of personal use and an understandable technical account. Extend the existing local app while preserving tasks, next steps and separate manual submission.

## Boundaries & Constraints

Always use the existing Norwegian design, local dates, accessible mobile controls, pure rules, a single controller, validated atomic storage and truthful evidence. Preserve existing data and never write on startup. Suggestions never imply completed work or submission. Student observations, dates, learning and personal choices stay blank until supplied by the student. Ordinary implementation choices are delegated explicitly; no additional approval is needed for reversible local changes. No VCS is available in this workspace.

Never add dependencies, account services, tracking, automatic submission, a work timer or personal reflections written as the student's own. No deployment or real-browser data changes.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
| --- | --- | --- | --- |
| Split work | 90 min work, two 60 min sessions | 60 + 30 suggested, 30 spare | None |
| Shortage | 90 min work, 60 before deadline | 60 suggested, 30 missing with reason | Visible task warning |
| Midday deadline | Session 10–13, deadline 11:30 | Only 90 min before deadline | Never allocate after deadline |
| Overlap | Sessions 10–12 and 11–13 | Form rejects overlap; pure planner defensively counts union once | Retain form draft |
| Past / ongoing | Past session or session already started | No allocation in past; whole future minutes only | Explain lost capacity |
| Overdue task | Unfinished with past deadline | All remaining time missing; no future session consumed | Deadline-passed reason |
| Finished work | completed, with or without submission | No work allocation; pending delivery remains visible | Never infer delivery |
| Zero remaining | unfinished with explicit 0 | No allocation; tell user to confirm work status | No automatic completion |
| Legacy | No remaining field or sessions | Main estimate as fallback; empty sessions | No rewrite on read |
| Invalid / storage failure | Bad fields, JSON, access or write | Block invalid mutation; preserve saved state and drafts | Retry with visible explanation |

</frozen-after-approval>

## Code Map

- `studieplanlegger/src/tasks.js`: task validation and immutable actions; retain IDs, source order, next-step and submission transitions. Add optional nonnegative safe-integer `remainingMinutes`; fallback to original estimate. Quick suggestions use active next step, otherwise remaining work. Never add both.
- `src/storage.js`: existing v1 envelope and write-before-state contract. Extend with optional `sessions`, preserve old read/write shapes when absent and task operations when sessions exist.
- `src/main.js`: sole persisted-state owner; all changes and clock refresh pass through it.
- `src/ui.js`, `src/task-view.js`, `index.html`, `src/style.css`: forms, stable task rows, accessible focus and existing design.
- `src/calendar.js`: derived month/day/agenda renderer; retain deadline navigation and add separately labelled study-session entries.
- `tests/unit/`, `tests/e2e/`: existing Vitest and isolated Playwright regression suites with fixed Oslo clock and injected failures.

## Tasks & Acceptance

**Execution:**
- [x] `src/capacity.js`, `tests/unit/capacity.test.js`: session validation, deterministic earliest-deadline allocation over disjoint future intervals, shortage reasons and boundary tests.
- [x] `src/tasks.js`, `src/storage.js`, unit tests: remaining field, compatible optional sessions, preserved transitions and write failures.
- [x] `src/capacity-view.js`, `src/main.js`, `src/ui.js`, `src/task-view.js`, `index.html`, `src/style.css`: session create/edit/delete, remaining entry and view, live allocation and warnings; retain drafts/focus on clock updates and failure.
- [x] `src/calendar.js`: distinct text/style for sessions and deadlines in month, selected day and mobile agenda.
- [x] `tests/e2e/capacity.spec.js`: actual controls, persistence, insufficient capacity, overlaps, failures, keyboard/mobile and old data.
- [x] `README.md`, `.docs/implementation-artifacts/solution-guide.md`, `trial-log.md`, `project-reflection.md`, `capacity-evidence.md`, relevant architecture/current status: final behavior, rationale, limitations, blank personal trial and questions.

**Acceptance Criteria:**
- Given real tasks and sessions, when the capacity view is opened, then each unfinished task shows required, allocated and missing minutes with an explanation, and no instant is allocated twice.
- Given a next step, when a schedule is derived, then only the parent remaining work is allocated, once.
- Given a changed task or session, when saving succeeds, then calendar and suggestions derive from the same saved data; on failure prior data remain visible and drafts remain available.
- Given an older valid envelope, when opened and then edited, then tasks survive and optional new data do not disappear during subsequent existing task actions.
- Given a 360px viewport and keyboard input, when using the new flow, then controls remain operable and visible without horizontal page scrolling.
- Given the final documentation, when read before trial, then automated checks and personal observations are clearly separate, with no invented student outcomes.

## Implementation Notes

- Work allocation: the implementation agent owns application source, tests and README. A documentation agent already owns `trial-log.md` and `project-reflection.md`; the root agent owns `solution-guide.md`, `capacity-evidence.md`, architecture/current-status updates and this spec. Implement only your owned deliverables and report the interface/behavior to root; root completes and verifies the combined spec. One additional agent slot is available for independent implementation/test work; delegate bounded work where useful.
- Review adaptation: the tool refused additional agent threads after the four existing threads. Reuse available agents for cross-checks of code they did not author, alongside root's diff, invariant-test and visual inspection. These checks are not described as three fresh context-free BMAD review runs. Existing unit/browser assertions passed; final command termination and a session-error visibility correction are checked in parallel with the review under the user's complete-work authorization.
- Sessions are one local date with start/end `HH:mm`, end after start; adjacent sessions allowed. Remaining 0 is allowed without changing completion. Marking a step done still only clears that step; users re-estimate remaining time manually. Completed tasks contribute zero work regardless of retained estimate, so undo can restore the estimate. Times at daylight-saving offset transitions need conservative handling and explicit limits.
- No external side effects or data migration. Full scope is explicitly requested; user authorization overrides workflow's extra approval checkpoint. Norwegian learning/user documents follow the user's language and existing documents.

## Spec Change Log

## Review Triage Log

| Finding | Verdict | Evidence and resolution |
| --- | --- | --- |
| Stored overlaps blocked repair | medium | `validSessions` originally rejected overlap and blocked startup; form validation now enforces overlap while structurally valid stored intervals remain readable. Union and calendar-repair tests passed. |
| Calendar labels and counters overlapped visually | low | Root inspected 360/1280 screenshots. Corrected text layout and counter positions; regenerated images inspected successfully. |
| Session deletion failure could be offscreen | medium | A long mobile session list placed global feedback above the current action. Feedback is now attached to the session row; visible failure/retry browser test passed. |
| Diagram sent capacity results to calendar | low | Calendar receives saved tasks/sessions, not deriveCapacity output. Corrected the diagram to reflect actual dependencies. |
| Explanation omitted zero-remaining quick-filter guard | medium | `selectTasksForMinutes` requires positive remaining work even with a fitting next step. Guide and AD-4/AD-8 now state this rule explicitly. |
| Trial checklist omitted session changes | low | Added edit/delete of a session when personal plans change and a check that calendar/capacity both update. All actual observations remain blank. |
| Full controller lifecycle lacked stored-session regression proof | medium | Unit tests supplied sessions themselves; existing browser tests covered only some branches. Added and passed `capacity-lifecycle.spec.js` covering all task/step/completion/submission branches, injected failure/retry and reload with exact envelope checks. No app code change was needed. |

## Completion evidence

All implementation tasks and matrix cases are covered. Root's final checks passed: 308 unit tests (8 files), 85 browser tests in one full run, production build, then one new browser lifecycle regression on unchanged app code (86 distinct browser tests total). All completed commands returned exit 0. See [capacity-evidence.md](capacity-evidence.md) for commands, sandbox teardown limitation, images, cross-review adaptation and limits. No known required implementation work was deferred. The user's own trial and personal reflection remain intentionally open in their prepared documents; technical completion is not personal acceptance or a measured learning outcome.

## Verification

Run `npm.cmd test`, `npm.cmd run test:e2e`, `npm.cmd run build` from `studieplanlegger`. Record actual outcomes and limitations separately from the user's pending month of use. Inspect rendered new view at 360 and 1280 pixels using isolated test data.
