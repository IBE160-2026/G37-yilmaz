# Synthetic legacy reimport fixture

Created 2026-10-21 solely from the invented three-event CSV embedded in `legacy.json`. No personal input, runtime database, calendar URL or captured browser state was used.

Generation used the preserved dirty source baseline from immediately before this repair, not HEAD. SHA-256 of its UTF-8 module text:

- `src/document-parsers.js`: `57388b60aa986267ec307618a76d9fcc5e491d10ecac2cf721538db51d2329bb`
- `src/import-preview.js`: `cb65543861dd9d3e1799a9bf4dfe117c4c851150f697c9c64b2654dad048340c`

Parse the embedded CSV with `columns.title = 'title'`, use synthetic contentHash `'a'.repeat(64)`, create a preview against `{schemaVersion: 1, tasks: []}`, omit preview row 3, and commit with `now = 2041-03-01T00:00:00Z`. Remove the second committed event while retaining its source entry. This produces one retained event, one tombstone and one deliberately excluded event using actual pre-repair keys. The fixture is accepted by `validEnvelope(..., {relations: true})` before the repair tests start.

`import-reimport-repair.test.js` verifies changed-title interpretation, exact IDs, missing-target consent, exclusion retention and undo. The browser tests replace only the synthetic content hash with the real SHA-256 of this same invented CSV so ordinary file recognition is exercised. A dangling ownership mismatch is intentionally not admitted or repaired: normal storage validation rejects that corrupt state.

`ambiguous-exclusions.json` is a second independently invented negative fixture, generated on 2026-10-21 using those same pre-fix modules. Parse its embedded three-row CSV with `columns.title = 'title'` and synthetic hash `'a'.repeat(64)`. Omit preview rows 2 and 3, commit at `2041-03-01T00:00:00Z`, then retain only the first exclusion to model valid partial history. Both old title interpretations explain the retained event, but swapped titles associate the retained exclusion with different dated rows. The resulting envelope passes normal relational validation. Tests require an explicit selection instead of inferring the union of these uncertain exclusions.

`legacy-mapped-course.json` uses the same invented CSV as `legacy.json` and the same pre-fix modules/hashes. Begin with the standalone `chosen-legacy`/`OTHER731` course, omit the source course proposal, map all event rows to `chosen-legacy`, omit the final event, and commit at the same synthetic time/hash. This is a valid deliberately different-course mapping, not evidence that the source course code changed. Tests repeat with a missing event target and verify exact source alias/time identity retains the mapping without creating duplicates or recreating the missing event automatically.
