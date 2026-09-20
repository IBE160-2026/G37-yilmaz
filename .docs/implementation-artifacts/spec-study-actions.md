---
title: 'Concrete study actions and separate submission'
type: feature
created: 2026-09-07
status: review
baseline_commit: NO_VCS
story_keys:
  - 3-1-neste-steg-hovedforslag-og-levering
---

> This records the task-extension implementation and its partial manual observation before the dashboard/calendar redesign. Its task and persistence rules remain in force; current presentation and calendar requirements are in [spec-ui-calendar.md](spec-ui-calendar.md). Prior test results and observations below are not acceptance of the redesign.

# Concrete study actions and separate submission

## Intent

Extend the existing browser-local study planner with the user's three authorized current-scope features: one optional active next step per task, one explained available-time suggestion with alternatives, and work completion separate from manually confirmed submission. Preserve existing functionality and saved tasks. Easier task initiation is an intended effect, not a tested result.

## Boundaries & Constraints

Keep the vanilla JavaScript/HTML/CSS structure, existing design, local dates, positive safe whole-minute estimates, IDs and creation order, storage key `studieplanlegger:v1` and `{schemaVersion: 1, tasks: [...]}`. Missing optional fields are interpreted when used while retaining the old record shape; there is no startup rewrite. Missing or null `nextStep` means none; missing `requiresSubmission` and `submitted` mean false. Old `completed` is never submission evidence.

The existing model has generic tasks, so “Krever innlevering” is a boolean. A submitted task requires completed work and a submission requirement. Undo submission before reversing either prerequisite; disabled controls explain this. Undo submission retains completed work. One active `nextStep` contains `description` and `estimatedMinutes`; completing/removing it clears it without history or changing parent estimate, completion or submission. General subtasks and automation remain outside scope.

Keep the existing validation → one full-list write → saved-state replacement sequence. Invalid stored data stays intact with mutations blocked. Failed writes retain state and drafts. Use isolated synthetic test data, preserve package/lock files, and do not publish or access personal browser records. The student trial remains “Ikke startet” with blank dates until actual own-task use is reported.

## I/O & Edge-Case Matrix

| Scenario | Required behavior | Verification |
| --- | --- | --- |
| Older and mixed saved tasks | Original records survive; no step/requirement/submission assumed; old completed work is never delivered; IDs/order retained; no startup write | Unit storage/contract and browser reload/reopen |
| New step lifecycle | Add/edit/remove/done/replacement; description and own positive safe integer minutes; parent estimate and statuses unchanged | Unit transitions/validation and browser actions/failures |
| Candidate estimate | Active step estimate overrides whole task; otherwise whole-task estimate; only unfinished work and estimate ≤ available time | 240-minute task/20-minute step fits 30; 20-minute task/31-minute step does not |
| Main suggestion/alternatives | Earliest deadline first, stable ties, action/parent/estimate/deadline, truthful explanation, exactly one main suggestion and optional ordered alternatives | Unit sorting and browser text/expansion/focus |
| Empty result/deadline views | Change time or open all tasks to add a smaller step; large/urgent/overdue tasks remain visible outside the filter | Browser empty-state routes and independent weekly/all views |
| Work versus submission | Complete → ready to submit → manual confirmed → undo to ready; ordinary completion unchanged; ready work excluded from suggestions but remains deadline-relevant/overdue | Unit state invariants and browser persisted transitions |
| Failure/accessibility | Every new write can fail without false success or data loss; read lock covers new actions; fields and feedback accessible at 360/1280 with stable focus/drafts | Unit failure behavior and isolated browser keyboard/mobile checks |

## Code Map

- `studieplanlegger/src/tasks.js`: optional-field validation and backward-compatible defaults, immutable step/submission transitions, effective estimate and overdue rules.
- `studieplanlegger/src/storage.js`: existing adapter and backward-compatible contract, full candidate validation.
- `studieplanlegger/src/main.js`: sole saved-state owner, new action handlers and transient alternatives state.
- `studieplanlegger/src/ui.js`, `index.html`, `src/style.css`: forms, next-step actions, explained main suggestion, alternatives, ready/submitted status, responsive keyboard behavior.
- `studieplanlegger/tests/unit/`, `tests/e2e/`: existing regression suite plus extension coverage.
- Current brief, PRD, architecture, epic/story, README, test documentation, reflection, trial template and handoff: same scope and honest evidence.

## Tasks & Acceptance

The canonical acceptance criteria are [story 3.1](../planning-artifacts/stories/3-1-neste-steg-hovedforslag-og-levering.md), mirrored in [epics.md](../planning-artifacts/epics.md). Original stories remain historical accepted work; no previous human approval is transferred to the additions.

Actual implementation and command results are recorded in [study-actions-evidence.md](study-actions-evidence.md). The student has reported trying the short example flow and supplied two screenshots; this is partial manual observation, not confirmation of every item in the [human walkthrough](study-actions-handover-check.md). Required tests/build are run before handoff; missing tools or checks must be reported precisely.

## Implementation Notes

The user explicitly requested implementation and all affected documents, authorizing ordinary technical decisions without routine confirmation. AI assistance includes code, tests, document reconciliation and inspection under that delegation. No student learning, month-long outcome or new human acceptance is assumed.

The `bmad-build` render command was attempted once for this run; `uv.exe` failed with “Filen er ikke tilordnet noe program for denne operasjonen”. The user's explicit instruction to carry implementation through takes precedence over a workflow stop. Work proceeds directly with the existing code and acceptance matrix; the failed render is not reported as successful workflow execution.


## Verification result

Technical implementation is complete. The 2026-09-07 final checks passed: 196 unit tests, 64 browser tests (53 previous plus 11 new), syntax checks for 19 JavaScript files and production build. There is no configured standalone lint or typecheck. Six 360/1280 px screenshots were inspected by the test agent. Detailed results and resolved failures are in [the evidence](study-actions-evidence.md). In a later reply, “Jeg har gjort det”, the student reported trying the short example flow and supplied screenshots showing an empty suggestion view and completed work marked “Klar til levering” without an active step. These screenshots do not by themselves establish submission/undo actions, persistence or keyboard checks. Status remains review because the full human checklist is not confirmed; the student trial has not started. No new automated tests were run for this documentation-only status update.
