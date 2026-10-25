# Bounded TP CSV format evidence — 2026-10-23

This records impersonal format knowledge for the CSV main-flow repair, connected to R-02/R-05/R-06 in the [curated requirements](../planning-artifacts/PRD.md) and [traceability](../planning-artifacts/TRACEABILITY.md). It is not a copy of a student's calendar, a guarantee covering every TP version, or verification of the reported original.

## Public evidence

[NTNU's timetable instructions](https://i.ntnu.no/timeplan) describe an Excel export under the tools menu. The [official TP frontend bundle](https://tp.educloud.no/app/assets/index-4ZJ_bq3T.js), function `_mt`, constructs an `/institution/timeplan/excel.php` export URL. A bounded request to the [public UiO course export](https://tp.educloud.no/uio/timeplan/excel.php?type=course&sem=26h&id%5B%5D=IN1000%2C1) read only the first header line, then stopped. It returned `application/download`, a `.csv` attachment and semicolon-separated headers. No public event values, names, contacts or access data were printed or retained. A deliberately nonexistent synthetic course returned only a newline and could not establish headers.

Observed field names, in order:

```text
semesterid;courseid;title-intro;courseversion;actid;id;weeknr;dtstart;dtend;lopenr;teaching-method;party;teaching-method-name;teaching-title;teaching-title_en;teaching-title_nn;summary;summary_en;summary_nn;isparty;status_plenary;staffs;studentgroups;tags;tp_resources;room;terminnr;aid;active;compulsory;discipline;disciplineobj;resources;alerts;coursetype;campusid;ownercampusid;editurl;staffnames;summary_nb;teaching-title_nb;virtual-course-name;curr;title;canEdit;weekday;eventid;multiday;allweeks;followers
```

The bundle consumes camelCase API properties. Its roles corroborate, but do not fully specify, the exported fields:

| Evidence | Established role and limit |
| --- | --- |
| `Gmt`, `titleIntro`, `courseid` | Course label with code fallback; not proof of a full course name. |
| `wb`, `teachingTitle…` | Localized teaching title, then base title. |
| `Cb`, `summary…` | Localized summary, then base summary. |
| `kb`, `title` | Additional text when different from teaching title; otherwise a distinct summary. |
| `teaching-method-name` | Separate activity-type field; do not conflate type with topic. |
| `rd`/`cft`, `curr` | Reading/resource content, not institution. |
| `vt`, `dtstart`/`dtend` | Frontend timestamp parser includes seconds and offset. No actual CSV timestamp values were examined. |
| `aid`, `id`, `eventid` | Activity grouping and separate identifiers; stability across exports is not documented. |

No authoritative rule was found equating equal timestamps, short intervals, assessment labels or missing ends with a point. The observed header contains neither `university` nor `coursename`. `virtual-course-name` and other opaque fields must not be guessed into these roles. The user's observed institution may come from another supported column variant, an explicit choice or saved context; that origin remains unknown.

## Bounded import policy to verify

Recognize this field family explicitly; keep generic CSV behavior separate. Within the recognized family, resolve each row using localized/base teaching title, localized/base summary, distinct supplementary title, then the known activity-type label. This order is an importer decision informed by field roles, not a claim that TP publishes that import priority. Preserve distinct source descriptions separately; never treat reading/resource HTML, edit URLs, staff fields or internal IDs as an activity title. If all relevant text is empty, use a marked neutral name with the known course code, without inventing a topic or type. Display date/time in their own fields; embedding mutable times in the saved neutral name would leave stale text after editing.

Keep code, actual course name and provisional presentation separate. Reuse only qualified existing names or already supported lookups; missing names may be accepted in the collective confirmation. Missing institution is unknown, never automatically UiO. Existing matched source context remains authoritative unless deliberately corrected.

Use validated unique identifiers within their source and qualified context, not as universal cross-format identity. Preserve exact instants; document genuine missing/equal/invalid time uncertainty and allow explicit row exclusion. Point handling needs positive source evidence and valid times, including when a fallback date grammar is used.

## Before-change evidence

The complete observed header with independently invented values produced 30 event rows, one empty course title and eight empty activity titles through the visible form. UiO was explicitly selected in that reproduction. Confirmation was blocked and stored zero events. A ten-second interval remained exact in preview values. Diagnostic runner exited 0; its first attempt exited 1 because of an incorrect navigation selector, corrected before the meaningful run. Desktop/mobile screenshots were opened. Local evidence is ignored under `studieplanlegger/artifacts/tp-csv-20261023/before/`; no product code changed.

Independent model probes established missing-end-to-point inference even with `point=false`, and invalid-end acceptance when both parsed `original` values are absent and `point=true`. Positive subminute intervals preserve seconds; equal times without a marker are rejected. These establish mechanisms, not the cause of the original 11:00 row. Resolving that row would require its exact start/end fields and any explicit marker semantics, under a separate privacy authorization; none was requested or accessed here.

## Subsequent clarity investigation — 2026-10-23

The [official NTNU guidance](https://i.ntnu.no/timeplan) was checked again for export and manual group-selection context. The same [official static TP client](https://tp.educloud.no/app/assets/index-4ZJ_bq3T.js) returned HTTP 200: `_mt` constructs the `excel.php` export, `vt` parses `YYYY-MM-DDTHH:mm:ssZ`, and `Rot` formats one displayed time as `HH:mm`. This establishes second-aware parsing and minute display in that client path, not CSV timestamp values or export rounding. No calendar rows were requested or retained; the earlier header observation remains historical.

[RFC 5545 section 3.6.1](https://www.rfc-editor.org/rfc/rfc5545.html#section-3.6.1) provides source-format semantics for a timed ICS event without DTEND/DURATION. It does not supply missing CSV point semantics. Current synthetic probes preserve exact positive subminute CSV intervals and reject equal/missing/invalid ends without positive point evidence. A new explicit user clarification must be recorded as the user's decision and preserved across refresh/reimport, separately from source-declared points and historical erroneous point inference. The private original and alleged equivalence to a one-second TP-link entry remain unverified.

## Explicit user clarification implementation — 2026-10-23

The clarity correction, described in the [import guide](../../studieplanlegger/IMPORT.md), offers a separate user decision for uncertain ends: correct the interval, confirm a point without duration, or omit the row. A saved user point carries `pointProvenance: 'user'`; its source baseline retains the original uncertainty. This is a local user clarification, not newly discovered TP export semantics. A valid start is still required, no duration or deadline is invented, and a later valid positive end restores interval behavior. Document-import previews and saved events use explicit structured activity kind for exam presentation; a title alone does not classify them, including after a point becomes an interval. Historical inferred CSV points without this provenance still require repair rather than being silently reaffirmed.

Same-source/UID matching can restore uniquely established institution context when a later source omits it; conflicting institutions, campuses, source objects or multiple compatible prior sources do not establish identity. Unknown institution remains valid, and registry selection adds no provider coverage. Independently invented [unit regressions](../../studieplanlegger/tests/unit/import-clarity.test.js), [form journeys](../../studieplanlegger/tests/e2e/import-clarity.spec.js) and the [isolated persistence runner](../../studieplanlegger/tests/run-tp-csv-persistence.mjs) exercise these rules. Actual execution results and unresolved limits belong to [VERIFICATION](../../studieplanlegger/VERIFICATION.md). No private original or additional public calendar rows were accessed for this implementation.
