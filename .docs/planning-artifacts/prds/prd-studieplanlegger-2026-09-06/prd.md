---
title: 'PRD: Studieplanlegger'
status: final
created: 2026-09-06
updated: 2026-09-07
---

# PRD: Studieplanlegger

## Purpose and users

Define the simple first version for a solo beginner IBE160 project, so design, implementation and tests share a clear scope. Sources: [product brief](../../briefs/brief-studieplanlegger-2026-09-06/brief.md) and [supporting notes](../../briefs/brief-studieplanlegger-2026-09-06/addendum.md). The brief is still labelled draft; the user explicitly authorized progressing from its documented decisions to this PRD.

University students need an overview of scattered deadlines and help starting coursework. Elias is the initial trial user and has reported forgotten assignments, late starts and missed deadlines. The intended benefit is less organization effort and easier task selection; this has not yet been measured.

The current core interaction is: enter assignments, optionally define one concrete next step, see this week's deadlines, enter available minutes, act on one explained suggestion or open alternatives, and manually mark completed work. Submission-required tasks have a separate manual submission confirmation and undo. No login is needed. The user explicitly added these three features on 2026-09-07 to the existing implementation.

The subsequent redesign/calendar request makes “Oversikt” the initial dashboard, with real task counts, quick available-time choices, a distinct main suggestion and deadline calendar. It preserves the earlier task, step and submission rules. The calendar and redesigned interface are current implementation scope, not a future aspiration.

## Version-one scope

Included: task entry, editing and deletion, manual work completion, initial overview dashboard, weekly/all-task overview, month calendar with selected-day tasks and mobile agenda, estimated duration, one optional active next step per task with its own estimate, quick/custom time selection and one explained suggestion with alternatives, separate manual submission confirmation/undo when required, and backward-compatible local persistence. Warm green styling, real derived counts, stable course colors, accessible secondary-action menus and Norwegian 24-hour date/time handling are part of the redesign.

Excluded: login, multi-device synchronization, Canvas import, reminders, automatic completion, submission or attendance detection, general subtask lists, next-step history, time tracking, advanced scheduling and an AI recommendation engine. The single active next step is deliberately limited and is in current scope. Future automation and privacy considerations stay in the brief's vision. The existing browser-only architecture remains in use.

## Working defaults

**D1–D8** are agent-selected working defaults, not individually user-confirmed details. They are adopted for the simple first version under the user's instruction to progress toward a working app. They do not block technical planning. The student can correct them; the architecture workflow owns resolving implementation ambiguities and recording any necessary change before building. Editing and deletion are confirmed by Q2; D3 specifies deletion confirmation.

## Terms

- **Task:** an assignment with title, course, deadline, estimated duration and work-completion state; optionally a next step and a submission requirement. The existing app has generic tasks, so submission is a checkbox rather than a new task-type hierarchy.
- **Next step:** at most one active short action with a trimmed, nonempty description and its own positive safe whole-minute estimate. Finishing or removing it clears the active step; no history is kept.
- **Ready to submit:** work is completed, submission is required, and submission has not been confirmed. Display “Klar til levering”.
- **Submitted:** the student explicitly confirmed submission; never inferred from completed work, a next step, the deadline or old saved completion data.
- **Deadline:** a required date and time, with minute precision. [DEFAULT D8] Use the device's local calendar; enter a date and explicit 24-hour `HH:mm`, display Norwegian dates and 24-hour times without AM/PM. Keep the stored local wall-clock value unchanged; no timezone selector.
- **Estimated duration:** the student's estimate in whole minutes, not automatic time tracking.
- **Available time:** minutes entered to filter tasks; not a calendar slot or a combined schedule.
- **Current week:** [DEFAULT D1] Monday through Sunday in the device's local calendar.
- **Calendar:** an additional view of task deadlines, grouped by local date. Month/day selection and the mobile agenda presentation do not create events, study sessions or persistent task fields.

## Functional requirements and acceptance

### Task overview

**FR-1 — Add tasks.** Enter a title, course, deadline (both date and time) and estimated duration manually, and optionally select “Krever innlevering”. New tasks are unfinished and unsubmitted. [DEFAULT D2] Remove spaces from the start and end of the title and course; neither field may be empty. Duration is a positive safe whole number.

Acceptance: a valid submission appears once with its entered values. Missing required fields (including either deadline date or time), an invalid date/time, whitespace-only text, zero, negative or fractional minutes produce a clear field error without adding a task or clearing valid input.

The redesign presents deadline date and `HH:mm` as separate labelled fields, composes the existing local value for validation, and preserves the same persisted `deadlineLocal`. Test `09:05`, `20:48`, missing parts, invalid times and daylight-saving gaps, including a browser with an English locale; no AM/PM clock is introduced.

**FR-2 — Correct tasks.** Allow editing the entered fields and deleting an individual task. [DEFAULT D3] Ask for confirmation before deletion and allow cancellation.

Acceptance: editing updates the existing task rather than adding another; invalid edits preserve the saved task. Cancelling deletion preserves the task; confirming removes only the selected task.

**FR-3 — Mark work completion.** Manually mark work complete. [DEFAULT D4] Allow undoing this mark; completed tasks remain visible and clearly distinguished in the full overview. For submission-required tasks, completion alone shows “Klar til levering” and never confirms submission. For an already submitted task, undo submission first before changing work completion or removing the submission requirement; explain the disabled controls.

Acceptance: marking complete removes the task from time-based suggestions, including ready-to-submit tasks. Undoing restores eligibility if its effective estimate fits. Changing views does not change completion or submission. A next step and the whole-task estimate remain unchanged by work completion.

### Deadlines and available time

**FR-4 — Weekly overview.** Show tasks with deadlines in the current week, independently of the available-time filter. [DEFAULT D5] Provide an all-task overview as well; visibly label overdue unfinished tasks and ready-to-submit tasks so they do not disappear when a week changes. Ready-to-submit tasks remain visible in their relevant week, and old overdue tasks remain accessible through the overdue count and all-task view.

Acceptance: with a fixed current date, include tasks due from Monday through Sunday of that week. Exclude tasks due on the preceding Sunday and following Monday. Repeat across month and year boundaries. Status remains visible. A large task excluded from time suggestions still appears in its relevant week and all-task view. [DEFAULT D8] An unfinished task or completed-but-unsubmitted submission-required task is overdue once current time is strictly later than its deadline. Test immediately before, exactly at, and after the deadline. Completed ordinary tasks and confirmed submissions are not labelled overdue.

**FR-5 — What can I do now?** Select 15, 30, 45 or 60 minutes, or enter custom positive safe whole minutes and choose “Vis forslag”. Initially select 30 minutes as transient UI state, not a saved preference. For each unfinished task, use its active next-step estimate when present, otherwise the whole-task estimate. Include only candidates with that estimate less than or equal to available time, across all weeks. [DEFAULT D6] Include overdue unfinished tasks; order by earliest deadline and preserve creation order for ties. Show the first candidate as one main suggestion, visibly separated from deadline lists; make the remaining candidates available as alternatives. State the concrete action, estimated duration, parent task and deadline. Explain the actual rule: it fits the available time and has the nearest deadline among candidates. Label next-step estimates explicitly so they do not imply whole-task completion. When unfinished work exists but none fits, offer changing minutes or opening all tasks to add a smaller next step. When all work is complete, explain that state, identify any ready-to-submit work and offer new/all-task routes; an entirely empty list points to creating the first task.

Acceptance: for 30 available minutes, a 240-minute unfinished task with a 20-minute active step qualifies, and the action and duration refer to that step. A 20-minute task with an active 31-minute step does not qualify; do not fall back to its whole-task estimate. Without steps, 20 and 30 minutes qualify and 31 does not. Completed work, including “Klar til levering”, is excluded. An earlier deadline outranks shorter duration; 12:00 precedes 23:59 on the same date. Verify one main suggestion, alternatives in the same order, explanation matching the rule, tie stability, empty-state routes and deadline views unaffected by the filter. Validate zero, negative, fractional, empty and unsafe integer input. Do not combine tasks, automatically divide tasks, infer priorities or require an AI service.

### Next step and submission

**FR-7 — One active next step.** Allow adding, editing, removing and marking done one optional next step per task. Require both a trimmed nonempty description and a positive safe whole-minute estimate. Completing or removing the step clears it without history, and a new step may then be added. Never change the parent task's completion, submission or estimated duration automatically.

Acceptance: add a 20-minute step to a 240-minute task, edit both step fields, remove it, add another, mark it done and add a replacement. Each action preserves parent ID, list position, whole-task estimate and work/submission state. Missing or whitespace-only descriptions and empty, zero, negative, fractional or unsafe minutes produce field errors without changing saved data or discarding a valid draft. Failed writes preserve the old step and allow retry; reload/reopen restores the saved step or its absence.

**FR-8 — Separate submission confirmation.** For tasks marked “Krever innlevering”, allow “Bekreft levert” only after work is complete. Confirmation is manual and shows “Levert (bekreftet manuelt)”. “Angre levering” keeps work complete and restores “Klar til levering”. A submitted task must have submission undone before work completion or the submission requirement can be changed. Ordinary tasks retain “Fullført” without submission controls.

Acceptance: create a submission-required task, complete its work, and verify “Klar til levering”, deadline/overdue visibility and absence from work suggestions. Confirm submission, reload/reopen, undo submission, and verify completed work with unconfirmed delivery. Prevent confirmation for unfinished or ordinary tasks. Prevent accidental loss of confirmed submission through edit/completion controls. Read/write failures follow FR-6. An older completed task loads with no inferred delivery; selecting a submission requirement later makes it ready to submit until separately confirmed.

### Local persistence

**FR-6 — Retain saved tasks.** Store tasks in the same browser without a user account. Reopening the app at the same address in the same browser retains tasks, edits, deletions, active next steps, work completion and submission state. Preserve the existing storage key and schema-one envelope. Missing optional fields in old records mean no active step, no submission requirement and no confirmed submission; never derive submission from `completed`. Validate optional fields when present. Interpret absent optional fields at use time while retaining older record shapes, with no startup write or loss of task fields, IDs or order.

Acceptance: create, edit and complete tasks, reload and reopen the page, and verify the resulting state. A confirmed deletion remains deleted. If saving fails, report that the change could not be saved; do not imply persistence succeeded. Unreadable stored data must not be silently overwritten with an empty list.

### Dashboard and calendar

**FR-9 — Clear overview dashboard.** “Oversikt” is the initial view. Use a warm background, green identity, readable hierarchy and a distinct primary action. Show actual counts of remaining work/submission obligations this week, overdue tasks and work ready to submit; make these counts lead to the relevant list. Show up to three overdue and three upcoming unresolved tasks with access to all remaining tasks. Never seed the user's interface with invented tasks, activity, study streaks or statistics. Derive stable course colors from existing course names, and retain text labels. Keep secondary actions in accessible task menus; the appropriate primary action depends on active step, work state and submission state.

Acceptance: empty and mixed-status saved data produce correct counts/list contents, including completed-but-unsubmitted work. Counts and summaries update after successful mutations and clock changes, with no write caused by display. Quick-time suggestions follow FR-5. Task menus open by keyboard, close with Escape, expose their state/name and restore relevant focus. Existing edit/delete/completion/step/submission actions remain reachable and obey their original contracts. Success/error feedback is concise and does not claim an unsaved change persisted.

**FR-10 — Deadline calendar.** Provide local month navigation with Monday as first weekday, a visible month/year, today and selected date, previous/next month and “I dag”. Selecting a day exposes its tasks in deadline/creation order with title, course, local 24-hour time and work/submission status, with an edit route. Include multiple tasks per date and an understandable empty day. Calendar membership is independent of the available-time filter. On mobile, initially show an agenda with an option to view the month grid. Calendar navigation and display choices remain transient.

Acceptance: verify month/year/leap-day and daylight-saving boundaries, today/selected date, multiple deadlines on one day, empty dates, old and future months and all work/submission states. Date edits move the task to the right day after a successful save; failed saves leave its saved date intact. Large tasks and “Klar til levering” remain accessible regardless of time selection. The 360/1280 px interface, date choices and edit route work with keyboard and without horizontal page scrolling. Calendar actions alone do not write or change task data.

## Quality requirements

- **NFR-1 — Simple use:** [DEFAULT D7] Norwegian interface with 24-hour times, usable by keyboard with visible focus and labelled inputs. Use the warm green redesign, clear reading order, appropriate primary actions and concise feedback. Course/status colors supplement visible labels. At 360 px and 1280 px viewport widths, essential controls, forms, menus, calendar and text remain usable without horizontal page scrolling. Check with a short manual walkthrough.
- **NFR-2 — Privacy:** task contents stay in the browser; no accounts, analytics, tracking or external task-data transmission. Explain briefly that browser data is not synchronized and may be lost if the user clears it. No legal compliance claim is made.
- **NFR-3 — Predictability:** user-entered text is displayed as text, never executed as markup. Test with a title containing HTML-like characters. A task list of 100 items must remain usable; no elaborate scale target is needed.

## Validation and success

- Run automated checks for filtering, sorting, input validation and week boundaries with fixed dates. Extend existing Vitest and Playwright coverage for next-step independence, effective estimates, one suggestion/alternatives, empty states, separate submission states, backward-compatible persistence and storage failures.
- Extend those checks for derived dashboard data, quick/custom minutes, month/day/agenda navigation, deadline editing through the calendar, menu/focus behavior, Norwegian 24-hour input/display and retained existing flows. Record actual results in the [redesign/calendar evidence](../../../implementation-artifacts/ui-calendar-evidence.md); earlier test counts and partial manual observations are not new acceptance.
- Manually check keyboard use, small/large screens, understandable empty/error states and the full core interaction. Record actual results, failures and fixes; planned checks are not passing checks.
- Run the agreed one-month trial with Elias's own coursework. Target: zero deadlines overlooked because a task was forgotten; record any incidents. The trial starts after a usable version is available and is separate from technical acceptance.
- Also note how much effort organizing tasks takes and whether entering duration estimates makes the planner cumbersome. Do not treat zero missed deadlines as success if the app is abandoned or creates excessive upkeep. This qualitative check introduces no tracking feature.
- Keep evidence of AI use, student decisions and quality assurance for the course's code submission and reflection report. The original version has [recorded test evidence and human acceptance](../../../implementation-artifacts/version-one-evidence.md); the additions have [separate evidence](../../../implementation-artifacts/study-actions-evidence.md). The trial has not started, and easier initiation or fewer forgotten submissions are not established outcomes.

## Confirmed decisions and technical handoff

**Q1 — Resolved:** the user requires both date and time for deadlines.

**Q2 — Resolved:** the user confirms editing and deletion.

**Q3 — Resolved by the 2026-09-07 request:** the three additions are current scope. Use the existing generic task model with an optional submission checkbox, one active step without history, and the specified deterministic suggestion rule. Positive safe whole-minute values retain the existing project's minute convention. These implementation defaults are agent-selected, not separate student confirmations.

The existing technical plan, code and README define the stack, test tools, UI and local running instructions. Trial start/end dates remain with Elias, to record when use actually begins.

**Q4 — Current redesign/calendar request:** implement the dashboard, warm green identity, quick available-time choices, deadline calendar/mobile agenda, real data and accessible controls in the existing app. Use explicit date plus 24-hour time entry while retaining `deadlineLocal`, schema/key and dependencies. Concrete layouts, derived count semantics and navigation defaults are agent-selected implementation choices within this request; they do not establish measured user benefits.

## Workflow handoff

This PRD describes the existing app plus the authorized redesign/calendar scope. Earlier planning handoffs and human acceptance are historical; story 3.1 retains its separate partial manual observation. Continue from the [redesign/calendar specification](../../../implementation-artifacts/spec-ui-calendar.md) and its actual evidence; do not restart completed planning or infer approval of new interactions from earlier acceptance.
