---
title: 'Product Brief: Studieplan'
status: draft
created: 2026-09-06
updated: 2026-09-20
document_role: historical-snapshot
superseded_by: ../../../../brief.md
---

# Product Brief: Studieplan

> **Historisk planleggingskopi.** Dette dokumentet bevares med BMAD-metadata som grunnlag fra 6. september 2026. Den gjeldende innleveringsbriefen er [brief.md i repository-roten](../../../../brief.md). Der er implementert fullstackstatus og skillet mellom automatisk bekreftelse fra lærestedet (utenfor scope) og studentens manuelle innleveringsbekreftelse (implementert) beskrevet korrekt. Påstander nedenfor i framtidsform eller den generelle utelukkelsen av «submission confirmation» skal derfor ikke leses som dagens produktstatus.

## Executive Summary

Studieplan is a study planner for students at Norwegian universities and university colleges. The information needed to study effectively is often spread across course descriptions, teaching schedules, assignment texts, semester plans, calendars, and personal notes. Turning those sources into a realistic plan requires repeated manual work, and the plan can quickly become outdated when an activity is missed or a task takes longer than expected.

Studieplan turns those sources into one connected experience. The student establishes the academic context, confirms imported tasks or tasks entered manually, and brings teaching, deadlines, and study sessions into one calendar. Guided onboarding and quick capture make it practical to start before every detail is known. The resulting plan supports understandable suggestions about what is useful and feasible to do next.

Studieplan also helps keep the plan credible. The student records work outcomes, and the product can propose adjustments when time is lost or needs change. The complete delivery runs locally as a full-stack application with a browser interface, back end, durable database, and documented Docker setup. Suggestions use registered information, rules, dependencies, and local work history; Studieplan does not require generative AI or change the plan without the student's confirmation.

## The Problem

Students often assemble the same semester picture from several places: course information, timetables, assignment texts, semester plans, and personal calendars. Even when every source is available, the student must translate it into one dependable plan and keep it current.

The difficulty becomes sharper when several courses compete for the same available time. A task with an imminent deadline may be too large for the next hour, while a smaller task may depend on unfinished work. Estimates are uncertain, and one missed session can make the rest of the plan unrealistic. An expired calendar entry does not prove that the work happened.

The result is more administration, difficult prioritization, and work that starts later than intended. At the moment the student needs to act, the plan still may not answer the immediate question: given the time and constraints I have, what should I do now?

## The Solution

Studieplan begins with a trustworthy study context. The student selects an institution, study programme, and semester, then reviews the course and teaching information that Studieplan can retrieve. Manual entry and document or calendar import keep the journey usable when direct data is unavailable.

Onboarding turns that context into a first course, task, and study session. Later tasks need only a title until more is known. Documents and calendars can propose tasks, deadlines, and activities. The student reviews each proposal with its source and stated uncertainties, makes corrections, and confirms what enters the plan.

The planned full-stack delivery provides a browser-based interface, a back end for request handling and validation, and a suitable database for courses, tasks, study sessions, progress, dependencies, and import links. Durable storage preserves the student's information and its relationships across restarts, giving planning and replanning a consistent basis.

The calendar combines fixed teaching, deadlines, and study sessions without treating them as equivalent. Studieplan suggests work that fits the student's available time and respects known deadlines and dependencies. Each suggestion explains what to do, why it matters, and what remains uncertain. Local work history may improve estimates without replacing the student's judgment.

After a study session, the student records that the task is finished, needs more time, or was not started. If time is lost, an estimate increases, or work releases capacity, Studieplan proposes schedule changes that the student can inspect, adjust, accept, reject, or undo.

## What Makes This Different

Studieplan connects information that is often maintained separately: academic context, tasks, fixed activities, available time, progress, and dependencies. Each part informs the next action. Imported course information can lead to a confirmed task, the task can be planned around teaching, and its outcome can update the remaining workload or prompt a recovery proposal.

Instead of reconciling separate notes, task lists, and calendar entries, the student maintains one coherent model of the semester. Studieplan's distinction is this connected planning loop and the student's control over it, not a claim of market uniqueness.

## Who This Serves

The primary users are students at Norwegian universities and university colleges who manage several courses, deadlines, and fixed activities within limited study time. They need a reliable overview without turning planning into a second workload, and recommendations that acknowledge uncertain estimates, dependencies, and changing needs.

A successful experience lets a student establish and maintain a useful plan, understand what to do next, and recover when reality diverges from the schedule while retaining control of information and decisions.

## Success Criteria

Success is assessed through user outcomes and delivery checks. These are goals and methods, not documented results; numeric thresholds remain proposals until agreed.

- **Usable start:** Observe whether a student can move from an empty planner to a confirmed course, task, and study session, then assess whether the plan is understandable and actionable.
- **Low-friction maintenance:** Observe task capture, later detail entry, and progress registration; record difficulties and qualitative feedback.
- **Trustworthy import:** Compare imported information with its sources, recording corrections, omissions, uncertainties, and source limitations.
- **Feasible replanning:** Check proposals against fixed activities, available time, deadlines, dependencies, and remaining work; assess whether the student can act on them.
- **Reduced planning burden:** Compare the student's perceived maintenance effort and overview with their previous approach. Technical test results alone do not demonstrate user value.
- **Delivery acceptance:** Verify that the student can create, retrieve, and change central information; that data and relationships among courses, tasks, and study sessions survive restart; and that the documented source code and Docker setup reproduce the local full-stack application with persistent storage.

## Scope

The agreed first complete delivery covers the product areas required for one connected study-planning journey:

- institution, programme, and semester selection, plus manual entry and controlled imports from documents, calendars, and available teaching sources;
- onboarding, quick task capture, later detail entry, and a calendar for teaching, deadlines, and study sessions;
- explained next actions, progress registration, and student-approved replanning based on time, deadlines, dependencies, and applicable local history;
- a browser interface, back-end request and validation handling, and durable database storage for the connected study plan;
- local and private operation, supported data recovery, and student control of imports and plan changes; and
- delivered source code and a documented Docker setup for running the required components locally with persistent data storage.

The complete local delivery now uses a Node server and SQLite database as the authoritative store, with automatic schema migration and a Docker Compose named volume. The previous browser envelope remains only as an explicitly previewed migration source and as the development-server compatibility path; it is not the production database. Actual startup commands, migration behavior and verification limits belong in the README and VERIFICATION.md.

National support across Norwegian universities and university colleges is a delivery requirement, dependent on available and permitted data sources. Coverage must be reported honestly. Manual and file import provide continuity but do not establish direct institutional integration; detailed evidence belongs in the import documentation.

Project evidence must document AI-assisted development, the BMAD process, and quality assurance. This is distinct from Studieplan's runtime behavior, which uses registered data, rules, and local statistics rather than generative AI. The scope excludes public hosting, accounts, payments, cloud synchronization, automatic contact, attendance monitoring, and submission confirmation. An expired study session does not prove work was performed, and finished work does not prove submission.

## Vision

Over time, Studieplan can become a more useful and less labor-intensive companion throughout a student's education. Broader, better-maintained source coverage can reduce repeated registration, while clearer handling of uncertainty can keep imports trustworthy across different institutions. More relevant local history can improve estimates and recommendations without removing student control.

The long-term direction is a plan that stays realistic as courses, workload, and available time change: easy to establish, light to maintain, and practical when the student falls behind. This is future direction, not an expansion of the agreed delivery.
