# Synthetic TP CSV fixtures

Created 2026-10-23 for the bounded CSV import repair, traced through [R-02/R-05/R-06 and their verification](../../../../.docs/planning-artifacts/TRACEABILITY.md).

Only the 50-column header/order follows the [bounded public format evidence](../../../../.docs/implementation-artifacts/tp-csv-format-contract-2026-10-23.md). Every row value is independently invented. These fixtures contain no exported student or staff data and do not explain the original reported time row. They verify the recognized field family, not every TP version or institution.

- `main.csv`: 30 events for synthetic code SYN742, 1–30 November 2041, campus SYN-CAMPUS. No institution or actual course-name field exists. Rows 23–30 have no teaching title; their fallback is respectively Bokmål summary, Nynorsk summary, English summary, base summary, supplementary title, activity type, neutral display, neutral display. The final two have unrelated resource/opaque-name values to prove these are not guessed into titles or course names. Event 11 is precisely 11:00:07–11:00:17+01:00 (10:00:07Z–10:00:17Z); every other event ends at 12:00:17+01:00.
- `time-exceptions.csv`: the same verified header plus an explicit `point` column already supported by the importer. Seven synthetic rows: marked equal-time point; unmarked equal times; missing end with false marker; invalid end with true marker; reversed interval; positive ten-second interval; marked point with absent end. The added marker is test input, not a claim that the observed TP export contains it.

The first main row has distinct summary and supplementary title text; both must survive as description while its localized teaching title is used for display. Published-group fields are empty, so the fixture makes no claims about membership.

Publication check, 2026-10-25: both files retain a trailing blank CSV record. The parser checks still require 30 and seven activity rows respectively; the blank record must not become an activity. The two `blank line at EOF` whitespace warnings are therefore retained as fixture input, not removed during delivery cleanup.
