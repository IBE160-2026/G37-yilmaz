---
title: 'Dashboard redesign and deadline calendar'
type: feature
created: 2026-09-07
status: review
baseline_commit: NO_VCS
story_keys:
  - 4-1-oversiktlig-dashboard-og-fristkalender
---

# Dashboard redesign and deadline calendar

## Intent

Redesign the existing study planner with a warm, calm green visual identity, a clearer dashboard and a deadline calendar. Make the next concrete action easy to find while preserving the implemented one-step, suggestion and separate-submission rules. All calendar and redesign requirements are current scope. A calmer interface or easier task initiation is an intended effect, not an observed student-trial result.

## Boundaries & Constraints

Keep vanilla JavaScript/HTML/CSS, exact dependencies, local-only operation and the current task contract. Storage remains `studieplanlegger:v1` with `{schemaVersion: 1, tasks: [...]}`. No task migration, new stored task field, dependency, account, backend, external resource or publishing is introduced. Existing IDs/order, optional active next steps, `completed`, `requiresSubmission` and `submitted` retain their meaning. Old completion remains insufficient evidence of submission.

The controller owns saved tasks. Calendar month/selected date/agenda choice, available minutes, expanded alternatives and open task menus are transient. Calendar items, stable course colors and dashboard counts derive from existing data; do not invent statistics, sample tasks, study streaks or tracked time. Continue validating the full candidate before one write and only then replace saved state. Failed reads preserve raw data and block mutations; failed writes preserve tasks and form drafts.

The calendar uses local wall-clock dates, Monday-first 42-day month grids including neighboring dates, previous/next month and “I dag”. Selecting a day exposes its deadline-ordered tasks and an edit route. Agenda includes all tasks due in the selected month, grouped by date, including completed and confirmed submissions. At widths up to 700 px, agenda is the initial presentation; both agenda and month can be selected at any width. Arrow keys move by day/week and Home/End to Monday/Sunday, with one date in the Tab sequence. Deadline views include ready-to-submit work and remain independent of available-time filtering. All new views remain keyboard operable and usable at 360 and 1280 px without horizontal page scrolling.

Deadline entry uses a date field plus explicit 24-hour `HH:mm` text input, avoiding locale-dependent AM/PM time controls. Compose the same `YYYY-MM-DDTHH:mm` value for validation and storage; show Norwegian dates and 24-hour times throughout the interface. Existing invalid-local-time and daylight-saving validation remains in force.

## I/O & Edge-Case Matrix

| Scenario | Required behavior | Verification |
| --- | --- | --- |
| Dashboard | Warm/green hierarchy; real derived counts; empty state has no fictional data; stable course color plus readable names/status | Browser rendered counts, empty data, visual inspection |
| Quick minutes | 15/30/45/60/custom all use the existing step-first filter; one main action, ordered alternatives, truthful explanation | Unit regressions and browser quick/custom choices |
| Local calendar | Correct Monday-first month across month/year/leap/DST boundaries, previous/next/today, today/selected date distinguished | Pure fixed-date unit checks and browser navigation |
| Day tasks | Multiple/timed/same-date tasks in stable deadline order, empty date, old/current/future deadlines, every work/submission status, edit action | Unit selection and browser task edit reflected in calendar |
| Mobile calendar | Initial agenda, month toggle, readable actions without horizontal page overflow | Browser 360/1280 px and screenshots |
| Deadline language | Explicit date + HH:mm entry, Norwegian display, no AM/PM, unchanged deadlineLocal, invalid/draft/error behavior | Unit format/input boundaries and browser creation/edit/persistence |
| Menus and feedback | Accessible task disclosure menus; keyboard/escape/focus behavior, short feedback, intact drafts during clock refresh | Browser keyboard, failures and controlled-clock regressions |
| Existing task lifecycle | Old/new persistence and every next-step/work/submission action retains its contract | Existing unit/browser regressions retained with selectors adapted to UI |

## Code Map

- `studieplanlegger/index.html`, `src/style.css`: dashboard structure, warm/green identity, responsive layout, form fields and focus styles.
- `studieplanlegger/src/main.js`, `src/ui.js`: saved-state ownership, quick minutes, calendar integration, real counts, task menus and concise feedback.
- `studieplanlegger/src/task-view.js`: shared task/suggestion cards, prominent state-dependent actions and accessible secondary-action disclosures; all actions go through the controller.
- `studieplanlegger/src/calendar.js`: pure local calendar/date/status/course-color helpers and a calendar widget whose DOM uses those helpers. `createCalendar(host, {edit})` returns `render({tasks, now, disabled})`; the widget owns transient month/date/mode only and requests existing edit actions.
- `studieplanlegger/src/tasks.js`, `src/storage.js`: existing task/next-step/submission and persistence contracts remain authoritative.
- `studieplanlegger/tests/unit/`, `tests/e2e/`: calendar and redesigned interaction checks plus prior regressions.
- Brief, PRD, architecture, epics/story, README, test documentation, reflection and current handoff reflect the implemented scope.

## Tasks & Acceptance

[Story 4.1](../planning-artifacts/stories/4-1-oversiktlig-dashboard-og-fristkalender.md) contains AC1–9, mirrored in [epics.md](../planning-artifacts/epics.md). Actual commands, fixes and remaining limits belong in [ui-calendar-evidence.md](ui-calendar-evidence.md). The [new human walkthrough](ui-calendar-handover-check.md) remains unconfirmed until the student reports it.

Story 3.1's technical checks and the student's “Jeg har gjort det” with two screenshots remain documented separately. They are partial manual observation of that earlier example flow, not acceptance of the redesign/calendar or completion of a full checklist. The student trial remains “Ikke startet” with blank dates until actual own-task use is reported.

## Implementation Notes

The user explicitly authorized implementation and related documents without stopping at a plan. UI details and module choices are agent-selected within that request; no additional individual student decisions are invented. AI contributes implementation, tests, checks and document reconciliation.

The root agent attempted the `bmad-build` render once for this run; `uv.exe` failed with “Filen er ikke tilordnet noe program for denne operasjonen”. The work continued directly under the user's implementation order. The failed render is not recorded as a successful workflow or a reason to claim unexecuted checks.


## Verification result

Technical implementation is complete. Final checks on 2026-09-07 passed: 230 unit tests, a full 75-test browser run, syntax checks for 21 JavaScript files (calendar.js repeated after its final DOM change) and production build. After the final CSS adjustment and explicit 45/60-minute/Escape coverage, all 14 affected dashboard/acceptance tests passed again; these 14 are a subset of 75, not additional tests. The final build passed in 153 ms. Fifteen screenshots document desktop, mobile, narrow forms, long words, real task counts, agenda and 24-hour presentation. Detailed commands, fixes and limitations are in [the evidence](ui-calendar-evidence.md). There is no standalone lint/typecheck configuration. Status remains review to distinguish completed technical work from unreported new human acceptance; the earlier 3.1 observation is preserved and the student trial has not started.
