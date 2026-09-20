---
title: 'Klargjør og lever Studieplan til utdelt GitHub-repository'
type: 'chore'
created: '2026-09-20'
status: 'in-progress'
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
- [ ] `G37-yilmaz/` — kopier det eksplisitte leveranseutvalget og herd ignore-reglene uten genererte/private data.
- [ ] `G37-yilmaz/README.md`, `brief.md` og utvalgte `.docs/**/*.md` — rett utdaterte statuser, absolutte stier, lenker og refleksjonsmerking.
- [ ] Kandidat-treet og historikken — skann filnavn/innhold for data og hemmeligheter, kontroller lenker, diff og ignore-adferd.
- [ ] Ren checkout av kandidat-commit — kjør relevante tester og Docker-akseptanse med eget prosjektnavn, testvolum og ledig loopback-port; kontroller API/UI, backup/restore og persistens fra ny nettleserprofil.
- [ ] Git — commit med tydelig melding, hent remote på nytt, push uten force til tillatt branch, og bekreft commit og dokumentlenker på GitHub.

**Acceptance Criteria:**
- Given en ren checkout av levert commit, when README-instruksene følges, then appen bygger, blir healthy og er tilgjengelig lokalt uten absolutte utviklermaskinstier.
- Given isolerte testdata, when containeren gjenskapes med samme volum, then data, ID-er og relasjoner består og kan leses i en fersk nettleserkontekst.
- Given den endelige committen, when sporede filer og ny historikk undersøkes, then ingen faktiske databaser, private brukerdata eller hemmeligheter inngår.
- Given GitHub-repositoryet, when pushen er ferdig, then riktig commit finnes på tillatt branch og README, brief og refleksjonsutkast er tilgjengelige; ingen deployment er utløst.

## Implementation Notes

## Spec Change Log

## Review Triage Log

## Verification

**Commands:**
- `npm ci; npm run test:unit; npm run build` fra `studieplanlegger/` — forventet: ren installasjon, alle relevante tester består, produksjonsbygg fullføres.
- `docker compose -p <isolert-navn> up --build -d` med egen port/volum — forventet: container blir healthy og kun loopback-port publiseres.
- `git status --short`, `git diff --cached --check`, `git ls-files`, ignore- og hemmelighetsskann — forventet: kun tilsiktede, portable og ufarlige filer.
- `git fetch origin` og remote-kontroll etter push — forventet: fast-forward, lokal HEAD lik `origin/main`, GitHub viser samme commit.

**Manual checks:**
- Åpne appen i to separate nettleserkontekster; opprett/rediger relaterte data, gjenskap containeren og test backup/gjenoppretting.
- Åpne README-, brief- og refleksjonslenkene fra GitHub og bekreft at refleksjonen fortsatt krever studentens egen gjennomlesning.
