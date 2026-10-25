# Independent historical-state fixture

`legacy-term.json` is an invented portable backup. No private calendar, backup or real person supplied its contents. The title, HST682 code, campus, two dates and retained notes/task are synthetic.

It was generated once on 2026-10-24 with the preserved pre-correction TP adapter, calendar parser and document preview. The January-only TP publication belongs to autumn 2045, but the old code stored its course as spring 2046. The fixture retains that defect. The visible test restores this actual old-format result, then imports the corrected publication and checks stable course/event/source IDs, notes and task links.

Preserved baseline SHA-256:

- `src/document-parsers.js`: `b22bf625bdae73b6fefdf0749be1772150c981a3567563ebc31ef49ff5c20fb9`
- `src/import-preview.js`: `d62a078a7059d4c0b159220ba7a8bdde1382fcc68a59ff07f6522d0fae320276`
- `server/providers/public-tp.js`: `6b6445e9e1c154c67bfa6235a7aaea7673931c73e5023bc05e32d28257288c86`

The temporary generator and baseline code copies are ignored local evidence, not required to run the regression.

`published-term.csv` and `legacy-csv-term.csv` use a separate invented course, SYN974, with a recognized TP CSV header and the published `45h` semester. The first file spans September 2045 and January 2046. The second contains two January activities without an explicit event identifier; one was deliberately excluded.

`legacy-csv-term.json` was generated once on 2026-10-24 from the exact `legacy-csv-term.csv` bytes using the preserved document parser and preview with the same baseline hashes above. It contains the old spring-2046 course, old term-derived occurrence keys, one excluded key, invented course/event notes and a linked task. The visible CSV test restores this backup and verifies that publication-term correction preserves those identities, exclusions and edits. The ignored generator is `artifacts/import-calendar-closure-20261024/generate-legacy-csv-term.mjs`; the portable fixture requires no generator or private input when tests run.

Publication check, 2026-10-25: the original CSV is 460 UTF-8 bytes with three LF line endings, SHA-256 `e794a2a4ff7dd53b2726229d18926b3f9db2d11537c0ca57a480d7d5eef9847e`, matching the backup's stored `contentHash`. A clean checkout with `core.autocrlf=true` changed it to 463 bytes with CRLF and broke that deliberately exact historical identity. The root `.gitattributes` now pins LF for this one fixture, and the browser test checks its hash before using the backup. Neither fixture was regenerated or rewritten; the original source, course/event keys, exclusions and all persistence assertions remain unchanged. This protects the historical test input and does not claim automatic identity recovery for arbitrary modified CSV files.
