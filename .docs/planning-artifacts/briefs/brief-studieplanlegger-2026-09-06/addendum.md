# Supporting notes: Studieplanlegger

## Proposed task selection experience

The student is uncertain about differentiation but proposes a planner that answers “what should I work on right now?” They want one overview of courses, assignments and deadlines, the ability to split large assignments into smaller tasks, and duration estimates.

The proposed interaction is to enter available time (for example, 30 or 60 minutes) and receive task suggestions based on deadlines and estimated duration. The desired outcome is less organization effort and easier task initiation. Ease of use and minimal setup matter.

The original accepted first-version implementation used whole-task estimates, available minutes and deadline-ordered unfinished tasks. On 2026-09-07 the user expanded current scope to one optional active next step with its own estimate, one explained main suggestion with alternatives, and manual submission confirmation separate from completed work. General subtask lists remain deferred; the single next step has no history and completing it does not change the parent estimate or statuses. The [updated brief](brief.md) and [PRD](../../prds/prd-studieplanlegger-2026-09-06/prd.md) define the current behavior and useful empty state. No AI-based recommendation engine is required. Expected benefits have not been measured in the student trial.

The subsequent redesign/calendar request adds a warm green overview dashboard with real task counts, quick/custom available-time choices, a local month calendar with day tasks and mobile agenda, accessible task menus and Norwegian 24-hour deadline entry/display. It preserves the existing storage and suggestion/status rules. These are current requirements; they do not establish that the expected ease-of-use benefits have occurred.
