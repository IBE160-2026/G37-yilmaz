# Epic 4: fristimport, agendaer og etterprøvbar oppfølging

Oppdatert 13. november 2026. Denne rapporten følger opp A1–A7 fra den lokale Epic 4-retrospektiven. Rettelsene er overført til dagens Ajour med bevarte dato-frister, flere arbeidssteg og deløktregler. Oppfølgingen gjelder eksisterende V1 og endrer ikke dataskjema eller avhengigheter. [PRD](../planning-artifacts/PRD.md) og [prøveplan](../planning-artifacts/USER-TRIAL-PLAN.md) eier fortsatt krav og samlet prøveomfang.

## Før og etter

Førgrunnlaget i dette repoet er commit `434b14828deae1db0bacfad58d27429ce56c81ad`. Den har allerede eksplisitt forekomstvalg og presise klokkeslettfeil fra [fristoppfølgingen 12. november](deadline-occurrences-2026-11-12.md). Tabellen avgrenser hva denne nye oppfølgingen endrer eller verifiserer. Historiske lokale funn og tester er ikke automatisk resultater for dagens Git-versjon.

| Punkt | Førgrunnlag / behov | Oppfølging og kontrollgrunnlag |
| --- | --- | --- |
| A1 – arkitektur | AD-18 beskrev gjeldende fristvalg, mens AD-4/5/8 fortsatt hadde eldre formuleringer om lokal klokke, UTC og første forekomst. | [Arkitekturen](../planning-artifacts/architecture/architecture-studieplanlegger-2026-09-06/ARCHITECTURE-SPINE.md) markerer de eldre reglene som historiske og samler Oslo-tidspunkt, importvalg, agendaer og begge kapasitetsspor i AD-18. Dato-frister beholder grensen ved starten av neste Oslo-dag. |
| A2 – prøvestatus | Historiske kalenderdokumenter beskrev en fremtidig månedsprøve. Den korte prøven i eldre lokal kopi var allerede omtalt i den publiserte fristrapporten. | Månedsprøven er uttrykkelig trukket tilbake og ikke et åpent Epic 4-krav. Den korte eksempelprøven og den separate R-07-prøven beholder hvert sitt faktiske omfang og dato, se nedenfor. |
| A3 – valgt frist ved reimport | Innkommende kildefrist kunne avvises før konfliktvalget, selv når brukeren beholdt en gyldig lokal frist og forekomst. | [Importen](../../studieplanlegger/src/import-preview.js) slår sammen valgene før den validerer den valgte fristen. [Regresjonene](../../studieplanlegger/tests/unit/deadline-import-followup.test.js) dekker parsede og redigerte forhåndsvisninger, beholdt lokal forekomst og atomisk avvisning av ugyldig valgt kildeverdi. |
| A4 – emneagendaens rekkefølge | Tidsstempler med UTC og eksplisitt offset ble sammenlignet som tekst. Dagens kode har også personlige hendelser uten eksplisitt offset. | [Emneagendaen](../../studieplanlegger/src/subjects-view.js) sorterer avklarte hendelser etter numeriske tidspunkter og tolker personlige lokale tider i Oslo uavhengig av nettleserens tidssone. Undervisning kl. 02:15 med `+02:00` kommer før frist kl. 02:30 med andre forekomst; uavklarte frister har uttrykkelig reparasjonsprioritet og stabile likhetstilfeller. |
| A5 – kompakt agenda og fokus | Fem sikkert utløpte uavklarte frister kunne fylle alle de første plassene og skjule kommende arbeid. | [Agendaen](../../studieplanlegger/src/agenda-view.js) flytter disse etter kommende arbeid først når siste mulige tidspunkt er strengt passert. Utvidelse og reparasjon beholdes. Hvis klokkeoppdatering flytter et fokusert element ut av den sammenfoldede listen, går fokus til utvidelsesknappen. Ingen forekomst velges automatisk. |
| A6 – egne forbrukerregresjoner | Valgt forekomst manglet direkte regresjonsvern for reserverte minutter og de to selvstendige sorteringene i dagsoversikten. Dagens Git-versjon hadde fortsatt veggklokkesortering i den selvstendige listen over kommende frister. | [Enhetstestene](../../studieplanlegger/tests/unit/epic4-retro-consumers.test.js) og [nettlesertestene](../../studieplanlegger/tests/e2e/epic4-retro-consumers.spec.js) kontrollerer 90/150 reserverte minutter og at 02:45/første kommer før 02:15/andre. [Dagsoversiktens renderer](../../studieplanlegger/src/daily-overview.js) er rettet til numerisk tidspunktsrekkefølge; kapasitetsregelen er bevart. |
| A7 – sporbarhet | Den eldre arbeidskopien manglet Git-historikk; delvise snapshots kunne ikke dokumentere hele den historiske epicen. | Lokale før-/etterkopier og hashkontroll dokumenterte den avgrensede lokale oppfølgingen. Denne publiserbare overføringen har et identifisert Git-førgrunnlag, lesbar endringsoversikt og egne daterte kontrollresultater nedenfor. Arbeidscommit og separat sesjonslogg identifiserer den ferdige leveransen. Det rekonstrueres ingen manglende historikk. |

[Agendaenes enhetstester](../../studieplanlegger/tests/unit/epic4-retro-agendas.test.js) og [nettlesertester](../../studieplanlegger/tests/e2e/epic4-retro-agendas.spec.js) dekker rekkefølge, grensen før/ved/etter siste mulige frist, kommende arbeid foran utløpte reparasjoner, tastatur og fokus. Nettleserprøvene bruker isolerte profiler, syntetiske oppgaver og Europe/Oslo samt America/Los_Angeles for å avdekke enhetsavhengig sortering. Emneagendaens eldre renderer er skjult av dagens CSS; dens DOM-regresjon er ikke en påstand om synlig navigasjon. De synlige kompakte agendaene prøves ved 360 og 1280 piksler.

## Prøvestatus og metodegrenser

Månedsprøven som omtales i eldre Epic 4-arbeid ble trukket tilbake og aldri gjennomført. Den erstattes ikke med en oppdiktet varighet eller med automatiserte tester. [Den korte lokale eksempelprøven](deadline-occurrences-2026-11-12.md#prosjekteierens-rapporterte-observasjoner) omfattet oppgaver, et arbeidssteg, kalenderflytting og omlasting i en eldre lokal kopi. Faktisk varighet var ikke oppgitt, og prøven dokumenterer ikke bruk over tid eller generell studentnytte.

Prosjekteierens separate [R-07-prøve 3.–4. november](owner-trial-2026-11-04.md) er fortsatt gjennomført og bestått innen sitt dokumenterte omfang. Denne oppfølgingen omgjør ingen tidligere eierbekreftelser og påstår ingen ny manuell prøve av den overførte Git-versjonen.

Den lokale gjennomgangen fant også to eldre begrensninger: emneagendaens skjulte renderer oppdaterer ikke tidsfilteret innen samme dag når cachen gjenbrukes, og et ufullstendig native datofelt kan bli avvist før konfliktvalget selv om den lokale fristen senere ville blitt beholdt. Dette er separate forhold fra A3s komplette parsede/redigerte verdier; de ferdigmeldes ikke av denne oppfølgingen.

## Kontroller av denne Git-versjonen

Kontrollene nedenfor ble kjørt 13. november i dette repoet etter de siste integreringsrettelsene. Alle beståtte kjøringer hadde exitkode 0. Tidligere lokale testtall brukes ikke som resultater for denne versjonen.

| Kontroll | Resultat |
| --- | --- |
| Fokuserte enhetstester | **135/135 bestått i ni filer**, 5,78 sekunder, med start 13. november kl. 01:24:53 lokal tid. Utvalget dekker import, fristvalg, agendaer, forbrukere og personlige hendelser. |
| Hele enhetstestsuiten, `node node_modules/vitest/vitest.mjs run` | **2757/2757 bestått i 157 filer**, 100,87 sekunder. Kjøringen startet 13. november kl. 01:23:51 lokal tid. |
| Produksjonsbygg, `node node_modules/vite/bin/vite.js build` | Bestått. Hovedbundle **963,57 kB / 294,75 kB gzip**; det eksisterende størrelsesvarselet består. |
| Fokuserte nettleserprøver mot ferdig bygg, kommando nedenfor | **13/13 Chromium-prøver bestått**, 40,6 sekunder: åtte nye agenda-/forbrukertilfeller og fem eksisterende fristtilfeller. |
| Avgrenset publiseringskontroll av arbeidskopien | Bestått: **1066 relative lenker, 258 ankere og 356 dokument-/fixturefiler**. Utfoldet ICS omfattet 11 filer med 982 hendelser; kontrollkategoriene hadde ingen funn. Den separate sesjonsloggen registrerer sluttkontrollen av staged innhold. |

Nettleserkommandoen fra appmappen var `node tests/run-built-e2e.mjs epic4-retro-agendas.spec.js epic4-retro-consumers.spec.js deadline-followup.spec.js --reporter=line`. Dette var et fokusert utvalg, ikke hele nettlesersuiten. Enhetsutvalget bestod av `deadline-import-followup`, `document-deadline-clarification`, `deadline-import-view`, `deadline-followup`, `epic4-retro-agendas`, `epic4-retro-consumers`, `agenda-view`, `personal-activities` og `event-kind`, alle som `.test.js` under `tests/unit/`. De inngår også i full enhetssuite; tallene skal ikke summeres.

Første nettleserkjøring bestod ni av tolv tilfeller. Tre feilet fordi overførte prøveoppsett forutsatte den eldre oversiktens kompakte panel og en dagsliste uten dagens duplikatfjerning. Prøvene ble tilpasset dagens faktiske grensesnitt. En rettet forbrukerprøve bekreftet deretter feil rekkefølge i målrepoets selvstendige kommende-liste før A6-rettingen. En separat America/Los_Angeles-regresjon feilet forventet mot det første bygget fordi en personlig datoaktivitet kom etter undervisning kl. 02:15 i Oslo. A4 bruker derfor eksplisitt Oslo-tolkning også for denne hendelsen. De endelige nettleserprøvene ovenfor omfatter begge rettelsene.

Den foregående lokale gjennomgangen brukte isolerte mutasjoner for å kontrollere at de nye forbrukertestene reagerte på fjernet forekomstargument i reservasjonen og feil sortering i hver av dagsoversiktens to forbrukere. De forventede testfeilene er lokal metodeevidens, ikke nye mutasjonsresultater for denne Git-versjonen. Fokusfeilen ved klokkeoppdatering ble funnet i den gjennomgangen og inngår i overføringen og regresjonen ovenfor.

BMAD-oppstarten i den lokale arbeidsflyten ble kontrollert med den installerte `uv` 0.12.6. Den fungerte ved avgrenset kjøring utenfor den restriktive sandkassen; ingen reinstallasjon eller endring av PATH eller tilgangsregler var nødvendig. Dette er verktøyoppstart, ikke en appendring eller en test av publisert drift.

## Krav, sporbarhet og publisering

Oppfølgingen støtter eksisterende R-01, R-03, R-05 og R-06 samt Q-01–Q-03. Den følger [lærerens produktbrief-tilbakemelding](../../tilbakemelding-product-brief.md) om avgrenset V1, konkrete suksesskriterier, tekniske valg i arkitekturen og synlig kvalitetskontroll av KI-arbeid. Sensor-PDF-en var ikke tilgjengelig for ny lesing i denne runden. Tidligere daterte vurderinger beholdes; det innføres ingen nye kurskrav.

Ettergrunnlaget er commit-en som inneholder denne rapporten og de lenkede rettelsene/testene. Sammenligning med førcommit-en viser den publiserte overføringen; tidligere rålogger, lokale snapshots og interne arbeidsspesifikasjoner inngår ikke i den offentlige dokumentkjeden. [VERIFICATION](../../studieplanlegger/VERIFICATION.md) er inngangen til daterte resultater. Publisering og eventuell produksjonskontroll dokumenteres separat; lokale prøver bekrefter ikke alene hva som er satt i produksjon.
