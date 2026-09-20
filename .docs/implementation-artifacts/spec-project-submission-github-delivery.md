---
title: 'Klargjør og lever Studieplan til utdelt GitHub-repository'
type: 'chore'
created: '2026-09-20'
status: 'done'
route: 'dispatch'
review_loop_iteration: 0
baseline_commit: 'bf1fe35713c8df34d2bd16a26bb60a472d7458fe'
context:
  - 'G37-yilmaz/README.md'
  - 'G37-yilmaz/brief.md'
  - 'studieplanlegger/README.md'
  - '.docs/implementation-artifacts/project-reflection.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** Det utdelte repositoryet inneholder foreløpig bare gruppens korte README, `.gitignore` og en eldre product brief. Den verifiserte fullstack-applikasjonen, kjørbar Docker-leveranse og nødvendig, personvernsikkert dokumentasjonsgrunnlag må samles og overføres uten å forveksle GitHub-push med skolens formelle brief- og refleksjonsinnleveringer.

**Approach:** Bevar repositoryets historikk og gruppedata, legg den eksisterende appen under `studieplanlegger/`, legg kuratert BMAD-/refleksjonsmateriale under `.docs/`, oppdater rot-README og brief med dokumentert nåstatus, og verifiser den eksakte committen fra en ren checkout før ordinær push til `main`.

## Boundaries & Constraints

**Always:** Bevar gruppenavnet «G37 — Git Happens», medlemmet Elias Hemsett Yilmaz, den godkjente briefens produktinnhold og eksisterende Git-historikk. Bruk Node/Vite/Vanilla JS → Node API → SQLite og dagens Docker-oppsett uendret med mindre en konkret verifikasjonsfeil krever retting. Appen skal bare publiseres på loopback lokalt. Lever kildekode, låsefil, databaseskjema/migrering, tester, syntetiske fixtures og nødvendige dokumenter. Merk refleksjonen som utkast og skill kildebelagte hendelser fra studentens egne ubesvarte vurderinger.

**Never:** Ikke inkluder databaser/WAL/SHM, datavolumer, private `.env`-filer, sikkerhetskopier, recovery-data, nettleserprofiler, logger, spor/skjermbilder med brukerdata, tokens eller personlige kalenderlenker. Ikke kopier hele `C:\IBE160\2026`, `node_modules`, `dist`, `artifacts` eller lokale arbeidsnotater. Ikke host/deploy, endre synlighet, omskriv historikk, force-push, slette volumer eller berøre port 80/faktisk brukerlagring.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|---------------|----------------------------|----------------|
| Ren sensorstart | Ren checkout, Docker/Compose, ingen database | README-kommando bygger og starter appen på dokumentert loopback-port; skjema opprettes automatisk | Stopp før push hvis leveransen ikke kan startes eller dokumenter en konkret miljøhindring |
| Vedvarende data | Syntetisk emne, oppgave og økt med stabile relasjoner | Samme ID-er og relasjoner leses fra ny nettleserprofil etter container-recreate med samme testvolum | Rett konkret kode-/konfigurasjonsfeil og kjør berørte tester/verifikasjon på nytt |
| Uønsket fil | DB, privat miljøfil, backup, profil eller artefakt finnes i kandidat-treet | Filen er ignorert og ikke sporet/pushet | Avbryt staging/push; fjern den fra kandidat-commit uten historikkomskriving |
| Remote har endret seg | `origin/main` avviker før push eller regler krever PR | Bevar remote-arbeidet og bruk fast-forward/PR i samsvar med regelen | Ikke force-push; rapporter konflikten eller åpen PR-status |

</frozen-after-approval>

## Code Map

- `G37-yilmaz/README.md` — sensorens landingsside, gruppedata, arkitektur, eksakte kjøre-/testkommandoer og dokumentlenker.
- `G37-yilmaz/brief.md` — obligatorisk product brief; produktbeskrivelsen bevares, teknisk status synkroniseres.
- `G37-yilmaz/studieplanlegger/` — komplett app-, API-, SQLite-, Docker- og testleveranse.
- `studieplanlegger/server/database.js` — kodebasert databaseskjema og idempotente migreringer.
- `studieplanlegger/compose.yaml` — loopback-port, helse og navngitt vedvarende volum.
- `G37-yilmaz/.gitignore` og `studieplanlegger/.dockerignore` — vern mot lokale data, hemmeligheter og genererte artefakter.
- `G37-yilmaz/.docs/implementation-artifacts/project-reflection.md` — eksisterende refleksjonsgrunnlag, tydelig utkast med fem personlige spørsmål.
- `G37-yilmaz/.docs/` — kuratert arkitektur, fullstack-/Docker-spesifikasjoner og prosessbevis som dokumentlenkene trenger.

## Tasks & Acceptance

**Execution:**
- [x] `G37-yilmaz/` — kopier det eksplisitte leveranseutvalget og herd ignore-reglene uten genererte/private data.
- [x] `G37-yilmaz/README.md`, `brief.md` og utvalgte `.docs/**/*.md` — rett utdaterte statuser, absolutte stier, lenker og refleksjonsmerking.
- [x] Kandidat-treet og historikken — skann filnavn/innhold for data og hemmeligheter, kontroller lenker, diff og ignore-adferd.
- [x] Ren checkout av kandidat-commit — kjør relevante tester og Docker-akseptanse med eget prosjektnavn, testvolum og ledig loopback-port; kontroller API/UI, backup/restore og persistens fra ny nettleserprofil.
- [x] Git — commit med tydelig melding, hent remote på nytt, push uten force til tillatt branch, og bekreft commit og dokumentlenker på GitHub.

**Acceptance Criteria:**
- Given en ren checkout av levert commit, when README-instruksene følges, then appen bygger, blir healthy og er tilgjengelig lokalt uten absolutte utviklermaskinstier.
- Given isolerte testdata, when containeren gjenskapes med samme volum, then data, ID-er og relasjoner består og kan leses i en fersk nettleserkontekst.
- Given den endelige committen, when sporede filer og ny historikk undersøkes, then ingen faktiske databaser, private brukerdata eller hemmeligheter inngår.
- Given GitHub-repositoryet, when pushen er ferdig, then riktig commit finnes på tillatt branch og README, brief og refleksjonsutkast er tilgjengelige; ingen deployment er utløst.

## Implementation Notes

- Lokal implementering ble samlet i commit `37fdfc5`; en egen oppryddingscommit `e5ad5be` fjernet lokale skjermbilder/resultatfiler og rettet refleksjons- og importdokumentasjonen uten å endre produktkode.
- Ren clone av `e5ad5be` bestod 1195/1195 enhetstester, 68-modulers bygg, healthy Docker-start, 2/2 produksjons-Chromiumtester og same-volume container-recreate. En fersk Chromium-kontekst uten localStorage viste samme ID-er og relasjoner fra SQLite.
- Filnavn-, innholds-, ignore- og lenkekontroller fant ingen faktisk database, privat miljøfil eller reell hemmelighet. Treff på `PRIVATE_SECRET_9182` og `ADDITIONAL_SECRET_9182` er uttrykkelig syntetiske negativtestverdier under `tests/` og bruker domenet `example.invalid`.
- Remote var uendret på baseline `bf1fe35`, fast-forward-kontrollen bestod, og den kontrollerte leveransen ble pushet ordinært til `main`. Repositoryet hadde ingen workflow, Pages-oppsett, regler eller branchbeskyttelse som utløste deployment eller krevde pull request.
- Reviewrettelsene er samlet i `670b2ab` og `b817b52`. En ny ren checkout av `b817b52` bestod 1196/1196 enhetstester, 68-modulers bygg, 2/2 produksjonsdatabasetester og Docker recreate med identisk revisjon 8, stabile relasjoner og en fersk Chromium-kontekst uten localStorage.

## Spec Change Log

## Review Triage Log

| # | Finding | Severity | Verdict | Evidence / disposition |
|---|---|---|---|---|
| 1 | Overdue calculation can differ outside the stored Oslo/local-wall-time assumption. | Low | Deferred | Existing documented same-timezone limitation; broader travel/timezone semantics require a product and migration decision. |
| 2 | Week bounds can differ across timezone changes. | Low | Deferred | Same root cause and scope as #1; recorded in `deferred-work.md`. |
| 3 | Subject-agenda deadline parsing can differ across timezone changes. | Low | Deferred | Same root cause and scope as #1; recorded in `deferred-work.md`. |
| 4 | Calendar scroll persistence writes synchronously on every scroll event. | Medium | Deferred | A debounced/async storage redesign is broader than the approved submission fixes; recorded with #7. |
| 5 | Calendar scroll-position keys are not explicitly bounded. | Low | Rejected | Keys derive from the bounded rendered calendar scope; no demonstrated everyday failure, and an arbitrary cap would add a new retention policy. |
| 6 | Data-tools render called the recovery endpoint twice. | Low | Fixed | `b817b52` caches one `actions.recovery()` result per render; full unit and production database suites pass. |
| 7 | Server storage uses synchronous XMLHttpRequest. | Medium | Deferred | Existing architecture; converting the complete storage contract safely is a wider change. Recorded with #4. |
| 8 | An indivisible task may ignore an alternative free period when a reservation exists. | Medium | Rejected | Scheduling remediation tests explicitly preserve indivisible/retained locks and use eligible free time without combining short fragments. |
| 9 | The regular Playwright config could run the production database suite against Vite. | Medium | Fixed | `670b2ab` excludes it from the regular config and adds `npm run test:e2e:database`; clean run passed 2/2. |
| 10 | `.woff2` lacked an explicit MIME mapping under `nosniff`. | Low | Fixed | `670b2ab` serves `font/woff2`; clean Chromium verified the response. |
| 11 | Collections and text fields have no practical size limits. | Medium | Deferred | Limits affect product contracts, imports and migration; recorded for a separate bounded design decision. |
| 12 | Calendar horizontal viewport calculation used `clientTop`. | Low | Fixed | `670b2ab` uses `clientLeft`; focused viewport regression passed 5/5. |
| 13 | Privacy purge did not scrub work logs inside valid `legacy_archives.raw`. | Medium | Fixed | `670b2ab` purges valid archives in the same transaction and adds database coverage. |
| 14 | Invalid explicit `PORT` values are not replaced by a custom validation message. | Low | Rejected | Node fails fast before serving on invalid explicit configuration; this is safe and preferable to silently choosing another port. |
| 15 | Malformed optional seed JSON terminates startup. | Low | Rejected | Startup fails before database mutation, while documented seed examples are valid; fail-fast preserves existing data. |
| 16 | Production-storage E2E was not wired to a repeatable production runner. | Medium | Fixed | Duplicate root cause of #9; the dedicated build/server/test runner passed 2/2 in the clean checkout. |
| 17 | The custom reporter could label a run with skipped suites as passed. | Medium | Fixed | `670b2ab` reports `passed-with-skips`; reporter unit checks and the full 1196-test suite pass. |

## Verification

**Commands:**
- `npm ci; npm run test:unit; npm run build` fra `studieplanlegger/` — forventet: ren installasjon, alle relevante tester består, produksjonsbygg fullføres.
- `docker compose -p <isolert-navn> up --build -d` med egen port/volum — forventet: container blir healthy og kun loopback-port publiseres.
- `git status --short`, `git diff --cached --check`, `git ls-files`, ignore- og hemmelighetsskann — forventet: kun tilsiktede, portable og ufarlige filer.
- `git fetch origin` og remote-kontroll etter push — forventet: fast-forward, lokal HEAD lik `origin/main`, GitHub viser samme commit.

**Manual checks:**
- Åpne appen i to separate nettleserkontekster; opprett/rediger relaterte data, gjenskap containeren og test backup/gjenoppretting.
- Åpne README-, brief- og refleksjonslenkene fra GitHub og bekreft at refleksjonen fortsatt krever studentens egen gjennomlesning.
