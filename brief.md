---
title: "Product Brief: Studieplan"
status: implemented
created: 2026-09-06
updated: 2026-09-20
---

# Product Brief: Studieplan

## Executive Summary

Studieplan is a study planner for students at Norwegian universities and university colleges. Study information is often spread across course descriptions, teaching schedules, assignment texts, semester plans, calendars, and personal notes. Students must repeatedly turn these sources into a realistic plan and update it when activities are missed or tasks take longer than expected.

Studieplan connects confirmed imports and manually entered tasks with teaching, deadlines, and study sessions in one calendar. Guided onboarding and quick capture let the student begin before every detail is known, while explained suggestions support useful and feasible next actions.

The student records work outcomes, and Studieplan can propose adjustments when time is lost or the student's needs change. The delivered implementation includes a local browser interface, a loopback-only Node API, durable SQLite storage and a documented Docker Compose setup. The database schema is created automatically and a named volume preserves data across container recreation. Suggestions use registered information, rules, dependencies, and local work history; they do not require generative AI or change the plan without the student's confirmation.

## The Problem

Students often assemble the same semester picture from several places: course information, timetables, assignment texts, semester plans, and personal calendars. Even when every source is available, the student must translate it into one dependable plan and keep it current.

The difficulty becomes sharper when several courses compete for the same available time. A task with an imminent deadline may be too large for the next hour, while a smaller task may depend on unfinished work. Estimates are uncertain, and one missed session can make the rest of the plan unrealistic. An expired calendar entry does not prove that the work happened.

The result is more administration, difficult prioritization, and work that starts later than intended. At the moment the student needs to act, the plan may still not answer the immediate question: Given the time and constraints I have, what should I do now?

## The Solution

Studieplan begins with a trustworthy study context. The student selects an institution, study programme, and semester, then reviews the course and teaching information that Studieplan can retrieve. Manual entry and document or calendar import keep the journey usable when direct data is unavailable.

Onboarding turns that context into a first course, task, and study session. Later tasks need only a title until more is known. Documents and calendars can propose tasks, deadlines, and activities. The student reviews each proposal with its source and stated uncertainties, makes corrections, and confirms what enters the plan.

The calendar combines fixed teaching, deadlines, and study sessions without treating them as equivalent. Studieplan suggests work that fits the student's available time and respects known deadlines and dependencies. Each suggestion explains what to do, why it matters, and what remains uncertain. Local work history may improve estimates without replacing the student's judgment.

After a study session, the student records that the task is finished, needs more time, or was not started. If time is lost, an estimate increases, or completed work frees time, Studieplan proposes schedule changes that the student can inspect, adjust, accept, reject, or undo.

## What Makes This Different

Studieplan connects information that is often maintained separately: academic context, tasks, fixed activities, available time, progress, and dependencies. Each part informs the next action. Imported course information can lead to a confirmed task, the task can be planned around teaching, and its outcome can update the remaining workload or prompt a recovery proposal.

Instead of reconciling separate notes, task lists, and calendar entries, the student maintains one coherent model of the semester. Studieplan's distinction is this connected planning loop and the student's control over it, not a claim of market uniqueness.

## Who This Serves

The primary users are students at Norwegian universities and university colleges who manage several courses, deadlines, and fixed activities within limited study time. They need a reliable overview without turning planning into a second workload, and recommendations that acknowledge uncertain estimates, dependencies, and changing needs.

## Success Criteria

Success means that a student can establish and maintain a useful plan, understand what to do next, and recover when reality diverges from the schedule while retaining control of information and decisions. It is assessed through user outcomes and delivery checks. These are goals and methods, not documented results; numeric thresholds remain proposals until agreed.

- **Usable start:** Observe whether a student can move from an empty planner to a confirmed course, task, and study session, then assess whether the plan is understandable and actionable.
- **Low-friction maintenance:** Observe task capture, later detail entry, and progress registration; record difficulties and qualitative feedback.
- **Trustworthy import:** Compare imported information with its sources, recording corrections, omissions, uncertainties, and source limitations.
- **Feasible replanning:** Check proposals against fixed activities, available time, deadlines, dependencies, and remaining work; assess whether the student can act on them.
- **Reduced planning burden:** Compare the student's perceived maintenance effort and overview with their previous approach. Technical test results alone do not demonstrate user value.
- **Delivery acceptance:** Verify that the student can create, retrieve, and change central information; that data and relationships among courses, tasks, and study sessions survive application restarts; and that the documented source code and Docker setup reproduce the local full-stack application with persistent storage.

## Scope

The agreed first complete delivery covers the product areas required for one connected study-planning journey:

- institution, programme, and semester selection, with manual entry and controlled imports from documents, calendars, and available teaching sources;
- onboarding, task capture, teaching, deadlines, study sessions, progress registration, and student-approved replanning;
- explained next actions based on time, deadlines, dependencies, and applicable local history;
- local and private operation through the existing browser interface and import service, extended as needed for durable database storage; and
- source code, support for data recovery, and a documented Docker setup for running the required components locally with persistent storage.

The delivered production path uses SQLite as authoritative storage behind the local Node API. Complete state changes are validated, revision-checked and written transactionally. Docker Compose binds only to `127.0.0.1`, creates the schema automatically and keeps the database in a named volume. Browser storage remains available in the separate Vite development mode and as an explicitly confirmed migration source. Startup, health, test and recovery instructions are documented in the README and verification record.

Support for universities and university colleges across Norway is a delivery requirement, dependent on available and permitted data sources. Coverage must be reported honestly. Manual and file import provide continuity but do not establish direct institutional integration; detailed evidence belongs in the import documentation.

**Delivery evidence.** Project evidence must document AI-assisted development, the BMAD process, and quality assurance. These delivery-evidence requirements are distinct from Studieplan's runtime behavior, which uses registered data, rules, and local statistics rather than generative AI.

**Out of scope.** The scope excludes public hosting, accounts, payments, cloud synchronization, automatic contact, attendance monitoring, automatic submission, and automatic confirmation from an institution's systems. The student can still confirm manually that an assignment has been submitted. An expired study session does not prove work was performed, and finished work does not prove submission.

## Vision

Over time, Studieplan can become a more useful and less labor-intensive companion throughout a student's education. Broader, better-maintained source coverage can reduce repeated registration, while clearer handling of uncertainty can keep imports trustworthy across different institutions. More relevant local history can improve estimates and recommendations without removing student control.

The long-term direction is a plan that stays realistic as courses, workload, and available time change: easy to establish, light to maintain, and practical when the student falls behind. This is future direction, not an expansion of the agreed delivery.
