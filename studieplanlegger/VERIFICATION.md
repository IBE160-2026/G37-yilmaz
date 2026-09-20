# Verifisering av Studieplan

## R31 – avsluttende kontroll av T3-restene, 2026-09-20

Den nasjonale evidensmodellen har nå null `Ikke undersøkt` for de tre avtalte restområdene. De 4 campus-, 19 gruppe- og 36 personlige timeplanfeltene er kontrollert mot avgrensede offisielle innganger og fordelt på `N`, `M`, `A` eller `Ø` med datert adresse og konkret omfang. Enhetstesten krever nå at ingen av disse feltene går tilbake til `U`, og at appens kapabilitetskart skiller `requires-institution-access` fra `no-suitable-anonymous-source`.

NIHs ekte undervisningsforløp brukte den offisielt annonserte anonyme TimeEdit-inngangen, høst 2026, IDR107 og kildeobjekt 25097.10. Kalenderresponsen inneholdt 26 VEVENT. Kildevalg, forhåndsvisning, ett uttrykkelig aktivitetsvalg, lagring, omlasting og identisk gjentatt import bestod uten duplikater. Den første nye kjøringen i ordinær sandkasse feilet før kilden med `connect EACCES 35.201.110.240:443`; dette er registrert som avvist nettverk i miljøet. Den samme avgrensede testen med godkjent nettverkstilgang bestod 1/1 på `127.0.0.1:5174` på 11,6 sekunder. Skjermbildet `test-results/connected-public-teaching--05caf-aching-for-saved-course-nih/public-teaching-preview.png` ble åpnet. Første versjon viste lange overlappende kildeetiketter; etter retting viser mobilbredden korte etiketter, full kildetekst er bevart som tittel/verdi, og ny live-kjøring bestod.

Molde-kontrollen fulgte den faktiske offisielle klientkontrakten. Metadata fant IBE152/termin 1/MOLDE. Hendelsesruten `/himolde/ws/timeplan/?type=course&id[]=IBE152,1&sem=26h` svarte HTTP 401, mens iCalendar-ruten svarte HTTP 400 med `Type unknown: 'course'`. Dette skiller dokumentert tilgang til hendelser fra den offentlige metadataflyten og fra appfeil. Det etablerte feilforløpet bevarer eksisterende emne, kilder, aktiviteter og studentvalg.

Sluttkontroller etter kilde-/statusendringene:

- målrettet program-/evidens-/TimeEdit-regresjon: **24/24 bestått**;
- samlet enhetssuite: **1189/1189 bestått i 94 filer** på 41,82 sekunder;
- NIH ekte nettleserforløp etter visuell retting: **1/1 bestått**;
- produksjonsbygg: **67 moduler**, bestått; bare det eksisterende ikke-feilende størrelsesvarselet;
- formell trepartsreview: sjette runde fullført, alle aksepterte lokale funn rettet, ingen utsatt.

Alle nye nettleserdata var isolerte testdata. Testserveren bandt bare til loopback; brukerens port 80 og faktiske lagring ble ikke åpnet eller endret.

## R30 – sju ekte programforløp og to undervisningsrester, 2026-09-19

`tests/e2e/national-program-live.spec.js` bruker ingen rute­simulering. Den samlede kjøringen på `127.0.0.1:5194` bestod **7/7** for Nord, UiA, UiO, Høgskolen i Molde, NIH, Høgskolen i Østfold og Skrivekunstakademiet. Hvert forløp hentet dagens offentlige katalog/plan, gjorde nødvendige studentvalg, forhåndsviste, lagret, lastet om og gjentok importen med samme identiteter. Lagrede prøveomfang var henholdsvis 1, 6, 1, 4, 4, 3 og 1 valgte emner/programenheter; dette er representative valg, ikke full katalogdekning.

| Adapter | Ekte kontroll og resultat |
| --- | --- |
| Nord | MAENM, Høst 2026, 1. studiesemester, Bodø. Språklenke kunne overskrive «Høst 2026» og er rettet; gjentatt import beholdt samme identitet. |
| UiA | Dataingeniør 2026–2029. Kilden publiserer tre opptaksveier og to senere studieretninger som uavhengige valggrupper; seks kildebeviste kombinasjoner bevares. Første semester lagret seks obligatoriske emner. |
| UiO | Informatikk: programmering og systemarkitektur. Studenten oppga kull og kalendersemester fordi kilden ikke publiserer disse. Første navngitte emneperiode ble lagret; frie krav ble ikke gjort til emner. |
| Molde | Logistikk og SCM 2026–2029. Fire obligatoriske emner ble lagret etter uttrykkelig studiesemesteravklaring. |
| NIH | Trenerrollen og idrettspsykologi 2026–2029. Fire obligatoriske emner ble lagret; uplassert studiesemester ble avklart av teststudenten. |
| HiØ | Bedriftsøkonomi årsstudium 2026–2027. Tre obligatoriske emner ble lagret etter studiesemesteravklaring. |
| Skrivekunst | Studieåret 2026/27. Én samlet 60-studiepoengsenhet over studiesemester 1–2 ble lagret; ingen underemner ble oppdiktet. |

De sju fullskjermbildene i `test-results/national-program-live-*/*-actual-program-import.png` ble åpnet. Valg, kildeutdrag, studentavklaringer og lagrede kort var lesbare uten horisontal sideavkutting. Målrettet Nord/UiA-regresjon bestod 11/11.

Avsluttende lokal regresjon bestod **1178/1178 enhetstester i 93 filer**, **15/15 berørte nettleserforløp** og produksjonsbygg med **67 moduler**. Nettleserpakken dekket de sju programstrukturene, Skrivekunsts to studiesemestre, Vortex-plan uten publisert periode og etablerte emne-/kalenderimporter. De første kjøringene hang i Playwrights automatiske Vite-teardown etter at siste scenario var startet. Samme pakke ble derfor kjørt mot en eksplisitt `127.0.0.1:5194`-server og avsluttet med 15 pass og exit 0. Den prosessen ble stanset; bare avsluttede `TIME_WAIT`-forbindelser stod igjen, ingen lytter. Programkall har fortsatt den nødvendige 180-sekundersgrensen for store kataloger, men tidsuret ryddes nå umiddelbart etter svar.

Molde-undervisning er kontrollert separat i en ekte appflyt. TP-søket fant IBE152, undervisningstermin 1 og campuskode MOLDE, mens eksporten svarte HTTP 400. `live Molde TP source failure preserves saved data` bestod 1/1: feilen ble synlig, forhåndsvisningen forble lukket og lagring var uendret. Skjermbildet ble åpnet. NIH TimeEdit svarte fortsatt HTTP 412 ved ett nytt avgrenset forsøk. Dette er M-status med ukjent årsak, ikke dokumentert tilgangskrav.

Programmatrisen viser nå 48 V og Ekko Ø. Periode-, valgemne-, undervisnings-, campus-, gruppe- og personfelter beholder egne svakere statuser. Ingen av disse tallene brukes som bevis for alle programvarianter eller full nasjonal undervisningsdekning.

## R29 – AHO og nasjonal adapterstatus, 2026-09-19

AHOs offisielle programoversikt og de to oppgitte planene svarte HTTP 200 gjennom appmiljøet. Den nye adapteren leste Master i design 2026–2031 som 10 perioder/31 emner og Master i arkitektur 2026–2031 som 9 publiserte perioder/44 emner. Designprøven bestod hele ekte nettleserforløpet på `127.0.0.1:5193`: program og gjeldende planutgave, første studiesemester/høst 2026, AHO OSLO, forhåndsvisning, lagring, omlasting og gjentatt import med samme to emneidentiteter. `artifacts/aho-program-live-20260919.png` ble åpnet; kull, periode, campus, emnetype, kildelenker og lagret resultat var synlig uten blokkende feil. Arkitekturprøven er ekte serverbevis, ikke separat nettleseraksept.

Målrettet enhetskontroll bestod 72/72 i AHO-, ruting- og institusjonsfilene. Live Playwright bestod 1/1. Produksjonsbygget bestod med 67 moduler. Første fullkjøring ga 1176 pass og ett femsekunders tidsavbrudd i den uendrede tunge UiT PDF-runtimekontrollen, samtidig som bygget kjørte. Isolert gjentakelse traff samme tidsgrense. Testens lokale runtimegrense ble avgrenset til 15 sekunder; den bestod deretter 22/22, og en ny sekvensiell fullkjøring bestod **1177/1177 tester i 93 filer**. Ingen appkode ble endret for UiT.

Brønnøysunds offentlige enhets-API og kunngjøringer bekrefter at Ekko Digitale AS ble slettet 3. september 2026 etter fusjon med Oslo Nye Høyskole AS, org.nr. 992 061 030. NOKUTs dokumenter identifiserer Ekko som høyere utdanning, mens Ekko Digitale Fagskole er separat. ONHs offentlige katalog viste to kontrollerte aktive høyere tilbud med relevant Ekko-bakgrunn; dette verifiserer ONH-katalogoppføringer, ikke et historisk Ekko-kull. Ingen egnet selvstendig Ekko-kullkatalog eller historisk planarkiv ble funnet.

Programrutingen har nå 48 identiteter. Statusmatrisen viser program 41 V / 7 L, mens periode, obligatorisk/valgbart, undervisning, campus, grupper og personlig timeplan har egne og svakere fordelinger i `IMPORT-COVERAGE.md`. Adaptertallet er derfor ikke brukt som bevis for full nasjonal dekning. Port 80 og faktisk brukerlagring ble ikke berørt.

## Nasjonal T1/T3-videreføring, 19. september 2026

Sju nye programadaptere er koblet til den faktiske import-rutingen. Etter reviewreparasjonene bestod de berørte provider-, identitets- og rutingtestene. Den avsluttende integrerte enhetskjøringen bestod **1172/1172** tester uten feil: `artifacts/national-unit-final-20260919.json`. Produksjonsbygget består med 67 moduler.

Ekte offentlige kilder ble kontrollert avgrenset og adskilt fra fixtures:

| Institusjon | Kontrollert kildeutvalg | Resultat |
| --- | --- | --- |
| Nord | MAENM, høst 2026 | 4 perioder, 8 emner; versjonert opptakstermin og Bodø bevart. |
| UiA | Dataingeniør, plan 2026H | 5 modeller, 70 emneforekomster; FYS002s avvikende emnesideutgave beholdt som usikkerhet. |
| UiO | Hele synlige programkatalogen og Informatikk: programmering og systemarkitektur | 188 programidentiteter; 6 perioder og 13 emner. Kull/kalender krever studentavklaring. |
| Høgskolen i Molde | Logistikk og SCM, plan 2026 | 9 perioder, 53 emner. |
| NIH | Bachelor i trenerrollen og idrettspsykologi, 2026H | 6 perioder, 23 emner; 3 ufullstendige kilderader utelatt med varsel. |
| Høgskolen i Østfold | Bedriftsøkonomi årsstudium, H2026 | 2 perioder, 6 emner. |
| Skrivekunstakademiet | Årsstudium 2026/27 | Én samlet 60-studiepoengsenhet over studiesemester 1–2. |

De første ekte prøvene avdekket og førte til retting av seks reelle DOM-/kildevarianter: Nord FS-modellinnpakning, UiA avvik mellom modellperiode og emnesideutgave, WordPress-tittel/ordform hos Skrivekunst og Vortex-lister med semesteroverskrift utenfor den innpakkede emnelisten. Fixturepass alene er derfor ikke brukt som ekstern aksept.

Den avsluttende berørte nettleserpakken bestod **19/19** forløp i `artifacts/national-import-browser-final-20260919.json`: alle sju nye adaptere gjennom kildevalg, nødvendige studentvalg, forhåndsvisning, lagring, omlasting og gjentatt import; historisk NIH-bekreftelse; Vortex-plan uten publisert periode; Vortex modell 2 med samme kode i to perioder; Skrivekunst i begge studiesemestre uten duplikat eller 120 studiepoeng; avvist kalenderperiode utenfor publisert studieår; og etablerte emne-/kalender-/plasseringsregresjoner. Etter siste felles Vortex term↔studiesemester-validering bestod samme monterte modell-/periodeforløp 1/1 i `artifacts/vortex-model-period-final-20260919.json`. Den tidligere 10/10-rapporten er bevart i `artifacts/national-program-continuation-final-20260919.json`. En separat visuell kjøring bestod 4/4 i `artifacts/national-program-visual-final-20260919.json`.

UiA, historisk NIH og HiØ ble åpnet på desktop, og Skrivekunst ble åpnet ved 390 px. Program, kull, studiemodell, studie- og kalendersemester, campus/ukjent campus, emnevalg, kilde og lagret resultat er synlige uten avkuttet hovedhandling. Mobilvisningen beholder navigasjon og den samlede 60-poengsenheten. Skjermbilder: `artifacts/national-uia-programme-final-20260919.png`, `national-nih-programme-final-20260919.png`, `national-hiof-programme-final-20260919.png` og `national-skrivekunst-mobile-final-20260919.png`.

Playwrights Windows-prosess hang i teardown etter at alle forventede resultater var skrevet. Reporteren lagrer derfor sluttstatus når siste testresultat foreligger; runneren ble stanset kontrollert etter 19/19 og 4/4, og ingen testlytter ble beholdt. De første nye Skrivekunst-kjøringene fant feil i testkode og ga senere ett reelt kravfunn om kalenderkobling; testfeilene og produktfunnet ble rettet og er erstattet av de grønne rapportene. Brukerens port 80 og lagring ble ikke berørt.

Ved R27-kontrollpunktet hadde AHO og Ekko ingen bestått direkte programimport og var ikke telt blant de 47. R29-seksjonen øverst erstatter denne statusen: AHO har nå bestått direkte programimport, mens Ekko fortsatt mangler en gjeldende selvstendig eller historisk kullkatalog. BIs daterte 234/223/57-observasjon er bevart separat i `artifacts/bi-live-catalogue-summary-20260919.json` og er fortsatt klassifisert som ufullstendig med ukjent årsak. Se `IMPORT-COVERAGE.md` for datatypestatus og kilder.

R27s formelle trepartsreview og reparasjonsreviewer er fullført. Alle aksepterte funn er rettet; avsluttende kode-/sikkerhets- og dokument-/bevisreviewer fant ingen nye konkrete feil. Ved dette kontrollpunktet var T10 lukket, mens T3 stod åpen for AHO og Ekko. R29-seksjonen øverst erstatter denne restlisten med AHO løst og Ekko fortsatt åpent.

## Connected planner: final local evidence through 2026-09-19

These records supersede historical status claims below. A source/fixture pass is not browser acceptance; each real import is limited to the actual programme, cohort, term, campus and selected activities shown in its report. Review outcomes belong in the existing connected-planner specification.

| Check | Observed result and evidence |
| --- | --- |
| Final R26 clean unit/build, 19 September | 1134/1134 tests in 88 files pass: `artifacts/connected-unit-r26-final2-20260919.json`. Production build passes, 67 modules, with the existing non-failing chunk-size warning. The clean snapshot contains 536 copied and hash-verified application/source/test/config files. |
| Final uninterrupted browser result, 19 September | All 305 outcomes were recorded in one run: **271 passed, 34 deliberate live-source opt-in skips, 0 failed**: `artifacts/connected-browser-r26-final-20260919.json`. The custom reporter retained `status: running` after writing all results and required controlled Ctrl+C teardown; the completed result array is authoritative and no listener remains on 5191. Port 80 and real user storage were untouched. |
| Final three-layer review and R26 | Blind, edge-case and verification-gap layers all completed. Nine accepted bounded rows were fixed: inert source links, compound URL-token redaction, cross-site loopback rejection, Oslo deadline/year handling, bounded source notes, programme-stage focus, Noroff/Volda century terms and distinguishing successful middleware fixtures. Focused unit checks pass 113/113; the mounted programme/teaching/focus journey passes and is included in the full result. No local review item is deferred. |
| Final visual assessment | Current desktop onboarding, 390 px/32 px recovery and 390 px/24 px document-correction screenshots were opened. Editable session time, recovery actions, uncertainty text, explicit deadline clarification, visible focus and mobile navigation remain usable; no new blocking visual issue was observed. |
| Iteration 3 clean locked unit/build, 19 September | 1092/1092 tests in 85 files pass, 66.00 s: `artifacts/connected-unit-r3-final-20260919.json`. Production build passes, 67 modules, 4.08 s, with the existing non-failing chunk-size warning. All 533 application/source/test/config files were copied and hash-verified into the physical locked install. The 303-case complete browser run is in progress; no browser pass is claimed in this row. |
| R11/R13/R14 focused verification, 19 September | R11: 87/87 unit checks, 3/3 identity/campus browser checks and 1/1 NHFH unavailable-period browser check. R13: 120/120 units and 8/8 browser checks (`connected-review-r13-browser.json`). R14: 57/57 units and 23/23 browser checks (`r14-saved-teaching-final-20260919.json`). All certified browser runs exit0; groups overlap and are not summed. Captured public fixtures and simulated API responses are distinct from live acceptance. Root opened enlarged-mobile unavailable-period, cancelled VTODO and saved-note screenshots. |
| R12 source fidelity, 19 September | 44/44 checks across five focused files pass (1.69 s), then a captured UiB programme regression was added and all 13 cases in the changed test file pass (1.01 s): 45 distinct focused cases overall, with overlap not summed. NTNU inheritance, conflicting NLA periods, UiB row-level credits and unknown Ansgar weeks use synthetic contracts and permanent public fixtures, not new live acceptance. |
| Iteration 2 full browser, 19 September | 250 passed, 34 deliberate external opt-in skips and 4 failed old reopening expectations, 288 total, 13.2 minutes: `artifacts/connected-browser-r2-final-20260919.json`. All failures expected zero where the approved reopened-work behavior is now explicit unknown. The four assertions are corrected; all 39 affected-file cases pass in the separate clean locked run `connected-reopen-regression-20260919.json`, exit0 (4.0 minutes). Latest combined outcomes are 254 distinct passes and 34 deliberate skips. All 25 new R7?R9 cases passed in this run. No uninterrupted all-green full run is claimed. |
| Iteration 2 clean locked unit/build, 19 September | 1014/1014 tests in 82 files pass, 35.68 s: `artifacts/connected-unit-r2-final-20260919.json`. Production build passes, 67 modules, 3.26 s. Root copied and hash-verified all 527 app/source/test/config files into the physical locked install. The full browser result is recorded above; affected-file verification is recorded above; third-review remediation is in progress. |
| R7–R9 focused verification, 19 September | R7: 109 focused units and 4 mounted browser passes (`connected-review-r7-20260919.json`). R8: 84 units and fourteen distinct browser passes across `connected-r8-document-final.json` and `connected-r8-document-followup.json`; the former has one HMR navigation failure resolved by the latter, not an uninterrupted green run. R9: certified 20/20 browser passes, no skips/flaky cases, exit0 (`r9-browser-final-results.json`). Root opened long-row keyboard correction at desktop/mobile, partial source evidence after reload, and enlarged mobile cancellation screenshots. These use simulated network responses and actual local workers; no new external acceptance is implied. |
| Second-review public source/transport fixes, 19 September | 52/52 focused tests in 6 files pass (4.71 s): typed NTNU codes, bounded unnamed directions, exact/overflow terminal pagination, successful USN production POST and Ansgar anonymous-cookie redirect/PDF transport, plus mixed-course estimate precedence/fallback. A clearer wholly over-deep NTNU error then passed all 19 affected source tests. These are local simulated responses/public fixtures, not additional external acceptance. These overlapping groups are included in the integrated total above. |
| Review remediation: clean locked unit/build, 19 September | 988/988 tests in 78 files pass, 33.54 s: `artifacts/connected-unit-review-fixed-20260919.json`. Production build passes, 67 modules, 3.00 s. These checks use the physical clean locked install, including canvas 1.0.8; no app unit file is omitted. The excluded `clean-pdf-runtime.test.js` exists only as an earlier snapshot diagnostic. Main-install canvas 1.0.9 is not the basis of this verification. |
| Review remediation: full browser, 19 September | 228 passed, 34 deliberate live opt-in skips and one failed assertion, 263 total, 11.9 minutes: `artifacts/connected-browser-review-fixed-20260919.json`. A12 incorrectly rejected a blocked dependent's name even inside the valid prerequisite's new explanatory text; its identity-based correction is verified separately. This run is not reported as all-green. Actual user storage and port 80 are untouched; only the completed test run's loopback server on 5191 was stopped after Windows teardown stalled. |
| Final affected browser verification, 19 September | All 7 cases in `connected-planner.spec.js` pass in the clean locked snapshot: `artifacts/connected-planner-review-final-20260919.json`. This includes the strengthened task-ID/title/next-action A12 check and the unchanged cycle-rejection assertion. Together with the full run, latest outcomes are 229 distinct passing browser cases and 34 deliberate live skips; these are combined outcomes, not one uninterrupted green full run. The implementer's separate one-case confirmation is `artifacts/review-a12-suggestion-20260919.json`. |
| Terminable public PDF worker: actual UiT flow, 19 September | 1/1 actual source → worker → preview → save → reload → repeat passes, 40.0 s: `artifacts/connected-uit-worker-live-20260919.json`. UIT-279505/PDF868804/INF-0101 runs through Vite's real server worker path. New 390/1440 screenshots opened. No further repeated public sample is needed to establish worker integration. |
| R1–R6 focused verification, 19 September | Scheduling/DST/continuity/downstream urgency: 402 passes in 14 files. Document identity, corrected kind, VTODO status and date offsets: 121/121 unit checks plus 4/4 mounted browser cases (`connected-review-documents-final-20260919.json`). Privacy purge/reopened learning: 79/79 focused units plus 2/2 recovery/reload/export/failure browser cases (`connected-review-history-20260919.json`). Actual gzip/deflate/br transport and terminable PDF worker lifecycle: 18/18 units. Mounted document cancellation/timeout/retry and mobile date controls: 5/5 browser checks (`connected-review-controls-20260919.json`). These overlapping groups are not added to the full-run totals. |
| Earlier clean locked-dependency unit/build, before R1–R6 | 888/888 unit tests in 73 files pass: `artifacts/connected-unit-final-fixed-20260919.json`. Initial run found two legacy tests reading local artifacts; they now read the same permanent public ICS fixtures. Production build passes, 67 modules, with a non-failing large-chunk warning. The isolated install uses offline `npm ci`; actual user storage is untouched. |
| UiT public PDF browser acceptance, 19 September | 4/4 pass in 39.7 s: `artifacts/connected-uit-pdf-live-final-20260919.json`. Informatics INF-0101/PDF868804, nursing SYP-1121/PDF803726 and electronics TEK-1507/PDF921058 retain source identity across preview/save/reload/repeat. Year-table selection rejects missing/out-of-year study semester. PDF876230's image table fails visibly without changing data and permits document recovery. Mobile/desktop screenshots opened. 29 targeted UiT unit tests cover 14 cached editions/local PDF runtime; 13 readable, one deliberate image-table rejection. |
| Kristiania guest timetable, 19 September | 1/1 actual browser pass, 8.6 s: `artifacts/connected-kristiania-live-final-20260919.json`. PGR102/161320.5/H2026: 49 valid of 58 raw activities, nine invalid durations warned. Explicit selection, write-free preview, save/reload/repeat retain IDs. Oslo/Bergen rows do not establish personal campus/group membership. Opened 390/1440 screenshots. Initial sandbox EACCES was resolved by narrow approved network execution, not treated as source failure. |
| Personal session-length adoption, 19 September | 8/8 focused browser checks pass: `artifacts/connected-session-estimate-20260919.json`; the shortened mobile/large-text case passed again in `connected-session-estimate-visual-20260919.json`. Adoption/manual correction changes draft rules only, invalidates the old preview and requires recomputation/confirmation. Sparse, interrupted, missed and disabled history cannot create an unsupported suggestion. |
| ONH archive browser acceptance, 12 September | 1/1 pass, 6.3 s: `artifacts/connected-onh-archive-final-20260912.json`. SIR1010, selected 2026/27 PDF, independent student cohort and calendar period; preview/save/reload/repeat preserve identity. Mobile screenshot opened. This resolves the older pending browser note below. |
| Latest calendar keyboard check, 12 September | The final 44 px control check is `artifacts/connected-public-teaching-keyboard-final2-20260912.json`, 1/1 pass at 390 px/24 px text, with the screenshot opened; it supersedes the earlier keyboard report referenced below. |
| Pre-review unit/build | 768/768 unit tests and production build passed in root's pre-review snapshot; `artifacts/connected-unit-pre-review-20260912.json`. This precedes later Sámi/NSKI/NHFH/HGUt/calendar/TP additions. |
| Pre-review full browser | 208 pass, 10 deliberate live opt-in skips, 2 missing-file failures in isolated copy; `artifacts/connected-browser-pre-review-20260912.json`. Existing public ICS fixtures were moved into portable test fixtures, and both affected tests passed: `connected-public-file-final-20260912.json`. |
| Final frozen core/UI browser | 213 pass, 28 explicit live opt-in skips, 241 total, zero failures, 6.6 minutes; `artifacts/connected-browser-final-20260912.json`. This precedes final ONH/UiT archive additions and independent review. |
| Real programme import | 40 institutions with actual source → preview → save → reload → repeat evidence. `artifacts/connected-public-sources/browser/` and `browser-20260912/`; newest groups include `results-hfy-nmh-bas-phs-gestalt.json`, `results-nski-nhfh.json`, `results-nski-nhfh-hgut-samas.json` and four UiT courses in `results-uit.json`. First two server-restart failures in the latter grouped report are superseded only by the explicit two-pass retry, not erased. |
| Additional real PDF variants | LDH barsel VIB-101 and KRUS published 2026 cohort PDF both passed source/save/reload/repeat in `browser-20260912/results-ldh-krus.json`. |
| Real course regression | UiT FYS-3000/post923370/2026H passed search, note/task link, reload/repeat/name search; `artifacts/connected-uit-live.json`. Prior ECONNRESET is historical. |
| Real teaching | NMBU/HVL/USN/MF 4/4 pass: `connected-teaching-live-final-20260912.json`. NHH BED1 24 selected activities: `connected-teaching-nhh-final-20260912.json`. NMH EXMUS11K passed: `connected-nmh-teaching-final2-20260912.json`. |
| Source calendar semantics | PHS mixed deadline/school exam/transparent oral period passed with six out-of-semester VTODOs excluded: `connected-phs-calendar-final2-20260912.json`. Gestalt helg passed in `connected-gestalt-phs-calendar-live-20260912.json`. Plandisc passed in `connected-plandisc-live-final2-20260912.json`. |
| FIH / Ansgar classes | Final two real source/preview/save/reload/repeat flows passed, 19.1 s; `connected-public-classes-final-20260912.json`. Four desktop/mobile screenshots opened. Ansgar full multiline name is asserted in preview and saved activity; source remains 87 valid/3 unresolved for the tested class. |
| Additional real teaching | Nine TP and LDH/Steiner/Volda, 12/12 pass in 49.6 s: `connected-public-teaching-final2-20260912.json`. Exact UiO IN1000 and Nord passed the final layout in `connected-public-teaching-layout-final-20260912.json`. KHiO BAKK/Fagverktøy passed: `connected-khio-teaching-live-20260912.json`; HØFY actual class day and Plandisc 2/2 pass: `connected-hfy-calendar-final-20260912.json`. |
| Calendar usability | Exclusive native import choices, deduplicated source warnings, 44 px detail controls and local list scrolling. Nine mocked navigation regressions pass: `connected-calendar-navigation-final2-20260912.json`; keyboard-only 390 px/24 px text with explicit selection and source-failure preservation passes: `connected-public-teaching-keyboard-final2-20260912.json`. Actual images opened. |
| ONH published PDF editions | Twelve bounded tests and five actual complete 2026/27 catalogue/archive/PDF chains pass; `onh-pdf-adapter-results-20260912.json`. Includes all 102 psychology pages, split source codes, actual elective groups, ambiguous titles and semantic revision identity. One actual historical 2025/26 peace/conflict PDF also passes, 60 pages/28 courses: `onh-pdf-history-result-20260912.json`. Source edition is not cohort. The separate passed browser result is recorded above. |
| Portable backup privacy | Four new connected private pwd/source-text/work-log/undo/trash roundtrip cases pass within 25 targeted backup/recovery tests. Existing source IDs, relations, actual/remaining minutes and safe reimport are retained; private credentials require reconnection. |
| Sámi negative teaching control | DUL-1001 returns seven raw items but zero valid teaching events (blank titles and zero-duration all-day entries), confirmed in source HTML/JSON. No dates or titles are invented. UI explicitly reports zero valid events and permits course-only/manual continuation. |
| Latest bounded unit run | 80/80 ONH, TP, calendar and national-evidence tests passed after the generic calendar warning and final datatype evidence. Earlier 65/65 Ansgar/TP/calendar checks verify actual multi-line names, moved weeks, simultaneous groups, pauses, unknown weeks and anonymous cookie cleanup. Final clean-install unit/build totals are recorded above. |
| Work and document journeys | Connected unit/e2e suites cover A02–A14, including dependency order, invalid locked reservations, missing/unknown estimates, transaction/undo, DOCX/CSV/VTODO, Norwegian date ambiguity and retained course links during repeat import. The final affected run passes all 23 cases across planner, document, onboarding, actual backup, large-text keyboard and personal session-length journeys: `artifacts/connected-final-affected-20260919.json`. |

Screenshots have been opened at desktop/mobile sizes and enlarged text. Fixed findings include Escape focus restoration, long teaching lists, activity/group wording, transparent information labels and full Ansgar names. Failures and source limitations remain recorded. All browser work uses isolated loopback origins and synthetic user state; public responses used as fixtures are kept distinct from actual network acceptance.

## Historisk sluttkontroll etter reviewpatch, 2026-09-08

Resultatene nedenfor er parents rapporterte sluttkjøringer og visuelle kontroller, ikke nye kjøringer utført under dokumentkonsolideringen. Full lokal kontroll ble kjørt 22:28-22:32 CEST mot parent-eid `127.0.0.1:5178`, med friske isolerte profiler.

| Kontroll | Faktisk resultat | Evidens |
| --- | --- | --- |
| Enhetstester | 496 bestått i 18 filer | `npm.cmd test` |
| Produksjonsbygg | Bestått, 41 moduler | `npm.cmd run build` |
| Full e2e-regresjon | 177 bestått, 0 feil, 2 bevisste live-skips; 3,7 minutter | `artifacts/targeted-final-regression.json` |
| UiB, separat reell import | INF100, høst 2026: full flyt bestått, inkludert navnesøk | `artifacts/targeted-final-live-results.json` |
| UiT, første reelle forsøk | Første søk feilet: `transport-error / read ECONNRESET` | `artifacts/targeted-final-live-results.json` |
| UiT, eneste avgrensede retry | Første søk feilet igjen med samme transportfeil; 5,1 sekunder | `artifacts/targeted-final-uit-retry.json` |

UiB-flyten dekker kode-/navnesøk, forhåndsvisning, lagring, omlasting og gjentatt import med beholdte lokale ID-er, notater og oppgavelenker. Prøvd periode er høst 2026, kildepost `inf100`, versjon `2026H`; metadataimporten oppretter ikke undervisning.

UiT kom ikke forbi første søk etter reviewpatch. Varslet «Kilden kunne ikke nås» ble vist; manuell registrering, tilbake, fil og lenke forble tilgjengelige, og utkastet `FYS-3000 / 2026 / autumn` ble beholdt. To forbindelsesbrudd er en observert ekstern transportbegrensning, **ikke et bevist tilgangskrav**. Ingen flere nettverksforsøk i denne runden. Tidligere UiT-livepass kan ikke brukes som postpatch-bevis.

Alle lokale sluttkontroller er grønne, men ikke alle eksterne sluttakseptanser. Parent beholder spec i `in-review` kun for UiT-liveakseptansen når kilden svarer; ingen ytterligere lokal implementering eller brukergodkjenning mangler.

### Avgrenset worker-evidens før parents fulle kjøring

Kommandoene nedenfor er allerede kjørt, ikke en oppfordring til nye tester i dokumentfasen:

```powershell
$env:PLAYWRIGHT_PORT='5178'
$env:PLAYWRIGHT_REUSE_SERVER='1'
npm.cmd test -- tests/unit/targeted-improvements.test.js tests/unit/review-patch.test.js tests/unit/public-transport-review.test.js
npm.cmd run test:e2e -- tests/e2e/targeted-improvements.spec.js tests/e2e/calendar-viewport-corrections.spec.js tests/e2e/review-patch.spec.js --output artifacts/review-patch-final-results --reporter=list --workers=1
npm.cmd run test:e2e -- tests/e2e/review-patch.spec.js --grep 'compact agenda details.*390/24' --output artifacts/review-date-stamp-results --reporter=list --workers=1
```

Resultater: 52 unit bestått; 32 e2e bestått og 2 bevisste live-skips; deretter 1/1 større-tekst-test etter siste datomerke-CSS. Den siste er en ny kjøring av samme test, ikke en ekstra unik test. Første review-e2e ga 31 bestått, 1 feil og 2 skips i `artifacts/review-patch-results`: avbrutt oppgaveredigering etterlot fokusmålet deaktivert. En refresh etter at redigeringsstatus var nullstilt rettet feilen. Ingen eksisterende assertions ble fjernet eller svekket. List-reporteren opprettet ingen separat HTML-/JSON-rapport for disse avgrensede kjøringene. Parents fulle sluttkjøring ovenfor inkluderer siste datomerkejustering.

### Reviewmapping: 20 funnrader

`U` = `tests/unit/review-patch.test.js`; `T` = `tests/unit/public-transport-review.test.js`; `E` = `tests/e2e/review-patch.spec.js`. Alle er med i bestått full postpatch-kjøring.

| Funn | Faktisk bestått regresjon |
| --- | --- |
| B1 / E1 | E: samme tittel/tid på forskjellige dager skilles med norsk dato i synlig tekst og tilgjengelige navn, også korte oppføringer. |
| E4 | E: nøyaktig 1/5/10 px og midnattsklipp 1/5 px, uendrede tidspunkt og separate lesbare mål >=44 px. |
| B2 | E: oppgave-/øktredigering, lagre og avbryt etter klokketikk, returnerer til riktig daglig nøkkel. |
| E2 | E: fullført rad forsvinner ved midnatt; fokus går til tilgjengelig daglig handling, ikke BODY. |
| B3 | U: forfalt/nært/neste frist sorteres uavhengig av lagringsrekkefølge, med stabil ID-tie-break og kronologiske økter. |
| B4 | E: angrebekreftelse overlever klokketikk, kan lukkes og kan ikke angre en annen nyere handling. |
| B5 / E3 | U + E: aksepterte dato-/tidsstempelvarianter håndteres uten oppdiktet klokke/sone; dato alene, sonefri tid og 0 lar avbryt og gjenopprett fungere. Backupdata/relasjoner endres ikke for visning. |
| B6 / V2 | U + E: entydig verifisert kilde prioriteres over manuell lookalike; manuelt opprettet legacy-emne får kildeidentitet med samme lokale ID, notater og oppgavelenker. Annen post, tvetydighet og campuskonflikt avvises. |
| B7 | U + E: manuell semesterendring markerer gammel binding; ny verifisert periode bindes først ved bekreftet import. Proveniens, relasjoner og faktiske datoer beholdes gjennom reload. |
| B8 | U: campusfelt avgrenses fra etterfølgende korttekst; ustrukturert/ukjent campus diktes ikke opp. |
| B9 / V1 | U + T: motstridende UiT-sti/query avvises. Faktisk fetchPublicText kjøres med mock node DNS/HTTPS gjennom tillatt redirect og rekursiv avvisning av institusjon, sti, post og motstridende identitet; ingen reell nettverkstrafikk. |
| B10 | U: beskrivelse avgrenses til egen seksjon; tom seksjon gir manglende verdi, ikke opptakskrav. |
| V3 | E: daglig meny endrer og lagrer bare økt s2; s1 og oppgaver forblir uendret. |
| P4 | E: faktisk viktige detaljer >=14 px, kontrast >=4,5, wrapping og ingen sideoverflow ved 1440/16, 390/16 og 390/24. Datomerket beholder hele dag/måned, med måned under dag. |
| P5 | E: UiB-kilde og timeplan har separate mål >=44 px, avstand >=8 px og synlig tastaturfokus i preview og lagrede kort ved 1280/390. |
| P6 | E: smale overlapp ved 1280/16 og 1280/20 bruker ellipsis uten delvise klokkeslett; full dato/tid/tittel finnes i åpen lesbar liste og detaljer. |

Eksisterende `tests/e2e/calendar-viewport-corrections.spec.js` dekker også 240-minutters hendelse klippet av faktisk synlig viewport ved scroll/resize, korrekt geometri, fokus/scroll etter detaljer og reload, fem kolonner og uendret >=300 px-høydekrav. `tests/e2e/targeted-improvements.spec.js` beholder offline import-/ID-/reload-/repeat-flytene, korte hendelser, innstillinger og daglig oversikt. De to live-testene kjøres separat fra offline-regresjonen.

### Visuell sluttkontroll og rettet høydefeil

Parent åpnet fulluke ved 1440, arbeidsuke ved 1280, daglig oversikt ved 1440/390, tom/delvis konto ved 390, agenda ved 390 med 24 px tekst og importlenker ved 390. Norske ø/å ble vist korrekt. FontFaceSet viste Manrope 400/500/600 som loaded. Ingen pageerrors eller horisontal sideoverflow ble observert i disse kontrollene.

Nye parentbilder:

- `artifacts/targeted-final-daily-1440.png`
- `artifacts/targeted-final-daily-390.png`
- `artifacts/targeted-final-calendar-full-1440.png`
- `artifacts/targeted-final-empty-390.png`
- `artifacts/targeted-final-partial-390.png`

Reviewbilder: `artifacts/review-agenda-1440-16.png`, `review-agenda-390-16.png`, `review-agenda-390-24.png`, `review-uib-links-1280.png`, `review-uib-links-390.png`, `review-overlap-1280-16.png` og `review-overlap-1280-20.png`, alle under `artifacts/`. Parent åpnet større-tekst-agendaen, 1280-breddekontrollen og P5-lenkebildene. Worker åpnet det regenererte 390/24-bildet etter datomerkerettingen; «08» og «SEP» er udelte, mens måned fortsatt står under dag.

Det historiske høydefunnet på 258,921875 px er **rettet**. Parents sluttmål er 314/414 px; den uendrede >=300 px-kontrollen består i full sluttkjøring. Den lesbare listen er fortsatt åpen som standard, viktig tekst/trykkflater er ikke redusert, og varigheter er ikke gjort kunstig lange. Oppdaterte bilder inkluderer `artifacts/targeted-correction-calendar-1280.png` og `artifacts/targeted-correction-calendar-1440.png`.

`artifacts/targeted-correction-calendar-large-text-stable.png` ble åpnet etter avsluttet dialoganimasjon og viser ikke den gamle dialog-backdropen. Det tidligere uskarpe bildet var ikke gyldig visuelt bevis. Scroll/resize-bilder er `artifacts/targeted-correction-clipped-top.png` og `artifacts/targeted-correction-clipped-bottom-resize.png`; komplette lesbare tider og separat kontroll beholdes når tidsblokken klippes av sticky header eller viewport.

### Lokal drift, personvern og testavhengigheter

Parent stoppet bare test-PID 21676 etter CIM-verifisering av Vite/app/5178/loopback. `Get-NetTCPConnection` etter stopp, 2026-09-08 kl. 22:37:26+02:00, viste `127.0.0.1:80`, PID 17108, og ingen 5178-listener. Brukerens port-80-prosess var urørt. Før stopp var begge appportene dokumentert bundet til loopback, ikke LAN/offentlig adresse. Reell port 80 serverte ny innstillingsmarkup og ny UiB-validering av ugyldig valg uten ekstern henting. Reell origin-brukerlagring ble ikke åpnet eller endret.

Ingen kildekode/private brukerdata ble eksponert eller lastet opp. Bare friske testprofiler på 5178 og avgrensede offentlige kildeforespørsler ble brukt. Worker startet/stoppet ingen appserver. Ingen Git-operasjoner, registreringer, nye tilganger eller offentlig eksponering ble gjort.

Behold alle fire `tests/fixtures/public-courses/{uib-search,uib-course,uit-search,uit-course}.html` og begge `artifacts/public-nmbu-math100-2026.ics` / `artifacts/public-hvl-dat100-2026.ics`. De er nødvendige testinput, ikke genererte rapporter. Backupnavnet er `studieplan-YYYY-MM-DD.json`, fra UTC-datoen i `backup.createdAt`. Parent har utført målrettet ignore/opprydding av nøyaktig fem foreldede app-artefaktkopier etter realpath-/filkontroll, uten andre slettinger eller Git-operasjoner. Hele dokument-/artefaktmapper, bilder og fixturer er ikke ignorert. BMAD-spec, planlogg og nyttig oppstartsdokumentasjon beholdes. Ingen foreldet privatdatakopi ble åpnet.

### Historiske targeted-resultater før reviewpatch

Tidligere worker-handoff hadde 468 unit, 154 e2e og to bevisste live-skips; parents fulle prepatch-kjøring hadde 468 unit og 158 e2e. Disse er **ikke** postpatch-evidens. `artifacts/targeted-final-regression.json` viser nå parents 177-testers sluttkjøring og skal ikke brukes som rapport for de eldre tallene.

Før reviewpatch bestod både UiB og UiT reelle metadataflyter med ID-/notat-/oppgavelenkebevaring, reload og repeat. Eldre UiT-pass ligger i `artifacts/targeted-live-uit-final.json`; det fulgte eldre forbindelsesbrudd og er ikke et bestått resultat etter de siste parserrettingene. Eldre UiB-livebevis ligger under `artifacts/targeted-live-public/`. Tidligere bred kjøring avdekket 13 feil; rettinger omfattet meldingsbredde og foreldede selektorer. Ingen varighets-/DST-krav ble svekket. Tidligere mistanke om årsaken til et mobiltimeout er ikke en bevist årsak.

Offisielle UiB-/UiT-TP-sider er funnet og tidligere lest som HTML-innganger, ikke verifiserte nedlastbare kalenderstrømmer. Ingen automatisk undervisningsimport fra disse sidene eller full nasjonal/personlig dekning er erklært.

---

## Previous verification evidence

Historisk ellevepunktsleveranse, 2026-09-08, Europe/Oslo. Tall og kildekontroller nedenfor gjelder før targeted-reviewpatch; gjeldende sluttresultater står øverst. BMAD-spec og planhistorikk beholdes.

## Resultat

| Kontroll | Siste resultat | Evidens |
| --- | --- | --- |
| Alle enhetstester | 444/444, 15 filer | `npm.cmd test` |
| Produksjonsbygg | Bestått, 39 moduler | `npm.cmd run build` |
| Hele nettlesersuiten | 145/145 | `artifacts/resume-full-regression.json` |
| Review-reparasjoner, målrettede enhetstester | 189/189 | Seks målrettede testfiler, inkludert `tests/unit/review-corrections.test.js` |
| Review-reparasjoner, nettleser | 14/14 | `tests/e2e/review-corrections.spec.js` |
| Uavhengige akseptansetester | 6/6 | `tests/e2e/resume-acceptance.spec.js`, `artifacts/resume-independent-acceptance.json` |
| Visuelle kontroller | Ingen JavaScript-feil eller horisontal sideoverflyt i opptakene | `artifacts/delivery-visual-report.json` |
| Vanlig lokal app | HTTP 200, Studieplan, kalender åpnet, ingen JavaScript-feil | Isolert Chromium mot eksisterende `127.0.0.1:80` |

Testene bruker isolerte nettleserprofiler og tydelige testdata, ikke brukerens konto. En vellykket fixture-/mocktest regnes ikke som en fungerende universitetsintegrasjon.

## Brukerhandlinger og kritisk logikk

- Tidsvalg, egendefinerte minutter, ugyldig verdi, forslag, ukjent gjenstående tid, status/levering, sortering og åpning av riktig oppgave.
- Manuelle emner, oppgaver og undervisning; tom konto, påbegynt oppgave, validering, avbrytelse, lagring og omlasting.
- Dag/uke/måned/agenda, dato og filtre, samme emnekode ved ulike institusjoner, eksplisitte emnerelasjoner og studieøkter i kompakt agenda.
- Frister uten oppdiktet varighet, korte/overlappende aktiviteter, midnatt, Oslo-tid og overgang mellom sommer- og vintertid.
- Arbeidsvinduer, sammenslåing av opptatte intervaller, ikke-blokkerende hendelser, reserverte studieøkter, ukjent estimat, passert frist og sekundforskjøvne intervaller uten dobbeltelling.
- Kalenderparserens gjentakelser, unntak og avlysninger; stabile kilde-ID-er; TP-paralleller; gjentatt import; feil og ufullstendig respons uten massedeleting.
- Kildeoppdatering, lokale merknader/overstyringer/skjulinger, nye grupper som krever valg, og avvisning av forsinket respons fra en erstattet tilkobling.
- Forhåndsvisning og faktisk import bruker samme beslutning; eksplisitt utvalg/utelatelse og null valgte aktiviteter.
- Lokal backup, datavalidering, hemmeligheter, relasjoner, feil ved erstatning, bevart eldre gjenopprettingskopi, reparasjon av skadet lagring og ny tilkobling etter restore.
- Angre, papirkurv, tidligere status og arbeidstid, emnerelasjoner, rask gjentakelse, omlasting og ekte konfliktkontroll uten falsk konflikt ved tidsstempeloppdatering.
- Klokkeoppdatering fra neste til pågående aktivitet uten fokustap, navigasjon, dialoger, tastaturfokus, redusert bevegelse og større tekst.

## Ekte eksterne kontroller, uten simulerte svar

### NTNU

TDT4110, høst 2026, Trondheim: faktisk emnesøk og detaljhenting, offentlig TP-kalender, gruppevalg, forhåndsvisning og import. Den valgte gruppen ga 14 hendelser. Manuell oppdatering beholdt 14 unike ID-er og riktig campus.

Den samme isolerte kontoen ble deretter eksportert til en lokal sikkerhetskopifil, gjenopprettet, tilkoblet den samme offentlige kalenderlenken på nytt og oppdatert. Resultat: 1 emne, 1 kilde, 14 hendelser, 14 unike ID-er og nøyaktig samme hendelses-ID-er. Ingen innleveringsoppgaver ble diktet opp fra undervisningen.

Rapport: `artifacts/delivery-live-import-report.json`, status `live-import-backup-reconnect-refresh-passed`.

### NMBU og HVL

NMBU MATH100 (Ås) og HVL DAT100 (Bergen) ble søkt opp mot faktiske kilder, forhåndsvist, lagret og beholdt ved omlasting. NMBU-kilden ga navn og 10 studiepoeng; HVL-kilden ga TimeEdit-relaterte opplysninger, men ikke verifiserte studiepoeng/beskrivelse. Manglende felt ble ikke fabrikert.

Rapport: `artifacts/delivery-live-other-providers-report.json`.

I tillegg er offentlige NMBU-/HVL-kalenderfiler hentet fra faktiske kilder og brukt i nettleserimport: `artifacts/public-nmbu-math100-2026.ics` og `artifacts/public-hvl-dat100-2026.ics`. Råfiler hadde henholdsvis 68 og 54 VEVENT; 63 og 49 gyldige aktiviteter ble håndtert. Dette dokumenterer offentlig kalenderimport, ikke personlig Feide-timeplan eller automatisk gruppetilhørighet.

Seks nye kode-/navneforespørsler mot NTNU, NMBU og HVL svarte HTTP 200 med status OK: `artifacts/resume-live-provider-searches.json`. NTNU-navnesøk viser kildens resultatbegrensning; det er ikke et bevis på uttømmende nasjonalt søk.

### Nasjonal tilgangsgrense

NOKUT-basert oversikt omfatter 49 institusjoner. Tre kilder er kontrollert som over; de øvrige 46 er ikke erklært fungerende automatisk emneimport. Sikt produksjons-API svarte 401 uten godkjent tilgang. Serverbasert, avgrenset transport og tilgangskontroll er klargjort, men skjema-/domenespørringer og institusjonsvis dekning må verifiseres med godkjent Maskinporten-tilgang. Se `IMPORT-COVERAGE.md` og `SIKT-ACCESS.md`.

## Skjermbilder og faktisk visuell kontroll

Bildene er lokale, ikke publiserte. Følgende leveransebilder viser isolerte data ved omtrent 1440 x 900 og 390 x 844:

- `artifacts/delivery-calendar-1440.png`
- `artifacts/delivery-calendar-390.png`
- `artifacts/delivery-overview-1440.png`
- `artifacts/delivery-overview-390.png`
- `artifacts/delivery-suggestion-1440.png`
- `artifacts/delivery-suggestion-390.png`
- `artifacts/delivery-empty-1440.png`
- `artifacts/delivery-empty-390.png`
- `artifacts/delivery-partial-1440.png`
- `artifacts/delivery-partial-390.png`
- `artifacts/delivery-live-import-1440.png`
- `artifacts/delivery-live-import-390.png`
- `artifacts/delivery-live-tp-preview-1440.png`
- `artifacts/delivery-live-tp-calendar-1440.png`
- `artifacts/delivery-live-nmbu-1440.png`
- `artifacts/delivery-live-hvl-1440.png`

Desktopkalender, mobilkalender, dagsoversikt, tom konto, delvis konto og den reelle importforhåndsvisningen er åpnet og vurdert, ikke bare generert. Mobilkalenderen og `artifacts/focused-mobile-200-content.png` ble åpnet igjen ved sluttkontrollen. Kalenderen har egen rullbar tidsflate; store importforhåndsvisninger og større tekst får naturlig vertikal scrolling. Navigasjon og hovedhandlinger er tilgjengelige. Nettlesertestene kontrollerer også interaksjoner og ikke bare stillbilder.

## Feil som ble funnet og rettet

De individuelle review-funnene er bevart i `REVIEW-HANDOFF-2026-09-08.md` og triageloggen i arbeidsplanen. Reparasjonene omfatter blant annet gjenoppretting ved skadet lagring, transaksjon/rollback, falske angrekonflikter, korte hemmeligheter i eksport, nye kalendergrupper, source-ID-er og parallelle TP-aktiviteter, forhåndsvisning mot faktisk merge, campus, emnefiltre, midnatt og konsistent kapasitet.

Første komplette gjenopptatte testkjøring ga 443/444 enhetstester: en eldre fixture manglet påkrevd studieøkt-ID. Fixture ble gjort eksplisitt med ID og tidssone, uten å svekke forventningen. Siste komplette kjøring ga 444/444. To målrettede nettleserskript måtte åpne eksisterende `<details>` før de brukte felt. Sluttkjøringer bestod. Historiske feilrapporter er beholdt og er ikke gjeldende sluttstatus.

## Lokal nettverkskontroll

`netstat` og prosesskommandoer viste Vite på `127.0.0.1:80` og separat test-Vite på `127.0.0.1:5178`, begge eksplisitt startet med loopback. Den vanlige appen ble latt urørt. Ved den historiske kontrollen 2026-09-08 kl. 18:29 var daværende testserver avsluttet, og bare appens `127.0.0.1:80` ble observert uten offentlig app-binding; se `artifacts/loopback-closeout.json`. Dette beskriver ikke nåværende parent-server; gjeldende listenerstatus står øverst. `server.host` og `preview.host` er satt til `127.0.0.1`. Ingen publisering, tunneler, ekstern lagring eller opplasting av private oppgaver/notater ble utført.

Bruk samme opprinnelige adresse `http://studieplan.localhost/` og nettleserprofil for brukerens faktiske data. Testene mot `127.0.0.1` brukte isolerte profiler og representerer ikke brukerens lagring.

## Historical parent visual-correction round, 2026-09-08 (height failure subsequently fixed)

This earlier bounded round, before the final reviewpatch, changed src/calendar-page.js and adds src/calendar-viewport.js and src/calendar-viewport.css. It adds tests/e2e/calendar-viewport-corrections.spec.js and stabilizes the closing-dialog screenshot in tests/e2e/targeted-improvements.spec.js. No import adapters, import fixtures, stored data schemas, or real-source acceptance results changed.

Verification used the parent-owned loopback server only:

```powershell
$env:PLAYWRIGHT_PORT='5178'
$env:PLAYWRIGHT_REUSE_SERVER='1'
npm.cmd test
npm.cmd run build
$env:PLAYWRIGHT_JSON_OUTPUT_FILE='artifacts/targeted-correction-focused.json'
npm.cmd run test:e2e -- tests/e2e/calendar-viewport-corrections.spec.js tests/e2e/targeted-improvements.spec.js --output artifacts/targeted-correction-focused --reporter=list,json --workers=1
$env:PLAYWRIGHT_JSON_OUTPUT_FILE='artifacts/targeted-correction-calendar-regression.json'
npm.cmd run test:e2e -- tests/e2e/eleven-improvements.spec.js tests/e2e/final-corrections.spec.js tests/e2e/acceptance-closeout.spec.js tests/e2e/resume-acceptance.spec.js --output artifacts/targeted-correction-calendar-regression --reporter=list,json
```

- Unit: 468 passed, 16 files. Build: passed, 41 modules.
- Focused: 12 passed, 1 failed, 2 intentionally skipped live-public tests (30.5 seconds).
- Additional calendar/data regression: 26 passed (23.3 seconds).
- New viewport-clipping test passed: the 2026-09-08T04:30Z..08:30Z event remains 240 pixels/minutes at top 390, has readable 06:30..10:30 details, reports top clipping at scroll 440 and bottom clipping after resize at scroll 300, retains keyboard focus after closing details and resize, and retains scroll/data/IDs after reload.
- The dense workweek test FAILED its new >=300-pixel visible-clock-space guard: measured 258.921875 pixels. This guard was not lowered. Later assertions and screenshots in that failed test did not run. A separate bounded browser measurement and image showed all five columns fit, scroll 440, grid 529.078125..788, and the 10:00..11:30 event at 689.078125..779.078125. At that point this improved the parent's approximately 172-pixel clock area but did not meet the density target. The later minimal band adjustment fixed this: parent reported 314/414 pixels, and the unchanged >=300-pixel guard passed in the final 177-test regression. The readable list remains open by default.
- Paused-clock dialog evidence: immediately after Escape, open=false but display=block, overlay=auto, and two transitions remained running at about 16.668 milliseconds. Advancing the installed clock 300 milliseconds yielded display=none and overlay=none. The stable large-text screenshot was inspected; it has no dialog backdrop. This reproduces the mechanism behind the invalid earlier screenshot.
- The prior report's claim that a mobile timeout was caused by development-server updates was a suspected explanation, not an isolated or proven cause. Its subsequent passing result remains valid.

New image paths in this round:

- artifacts/targeted-correction-clipped-reproduced.png (before correction)
- artifacts/targeted-correction-clipped-top.png
- artifacts/targeted-correction-clipped-bottom-resize.png
- artifacts/targeted-correction-calendar-large-text-stable.png
- artifacts/targeted-correction-calendar-390-large-text.png
- artifacts/targeted-correction-calendar-1280-observed.png
- artifacts/targeted-correction-calendar-1440-observed.png

artifacts/targeted-calendar-large-text.png was also regenerated after the real closing transition and visually inspected. Existing test-owned image names were regenerated by the selected regression suites. The planned targeted-correction-calendar-1280.png and targeted-correction-calendar-1440.png were not produced in that first failed run because the dense test stopped at its height assertion. They were subsequently produced after the height correction and are included in the final visual evidence above.

Cleanup dependencies: retain both new production modules and the new browser test. No new fixture files were introduced in this correction round. Previously required tests/fixtures/public-courses/{uib-search,uib-course,uit-search,uit-course}.html and artifacts/public-nmbu-math100-2026.ics / artifacts/public-hvl-dat100-2026.ics remain test inputs, not disposable outputs. The backup download name is still studieplan-YYYY-MM-DD.json, using the UTC date from backup.createdAt.

No server was started or stopped by this worker. Only short-lived test/build/browser processes were launched, all reported test sessions completed, port80 was untouched, and the parent retains ownership of port5178. No external source reads were made in this round. The local review corrections and density decision are now complete. Only the concrete external UiT postpatch-live acceptance remains open as described above.

## Full-stack database and Docker delivery — 2026-09-20

Observed checks from the `studieplanlegger/` project directory:

- `npm.cmd test`: **1195/1195 passed in 95 files**. This includes six repository tests for lossless linked-state round-trip, database foreign-key enforcement, stale-revision rollback, exact/idempotent legacy migration with raw archive, automatic upgrade from the earlier no-FK schema, database reopen, recovery snapshots, privacy purge across live and recovery data, portable backup restore and empty-only seed/settings protection.
- `npm.cmd run build`: passed, **68 modules transformed**. Vite retained its existing large-chunk warning; no lint or typecheck script exists.
- Production Node smoke used an isolated temporary SQLite path with `HOST=127.0.0.1` and `PORT=18088`: `/api/health` returned `status=ok`, `database=sqlite`; `/api/state` returned revision 0; a validated PUT committed revision 1. The process was then stopped. Port 80 and real browser storage were untouched.
- The database smoke used only synthetic empty state. Unit tests use temporary SQLite files and remove their own directories after close.

Production-browser acceptance against the Node/SQLite server: `npm.cmd run test:e2e -- tests/e2e/database-delivery.spec.js --workers=1` passed **1/1** on `127.0.0.1:18089`. Chromium explicitly confirmed one same-origin migration, unchanged original localStorage, an ordinary UI edit committed through SQLite with linked session/course IDs intact, exact API state after reload, no second prompt and HTTP 409 for a stale but otherwise valid write. Two earlier attempts are retained as failed evidence: the first locator selected a hidden task `<option>` although migration had succeeded; the second stale candidate was relationally invalid and correctly returned 400 before revision comparison. Only test assertions were corrected.

Post-review production-browser acceptance, finally repeated on `127.0.0.1:18096`, passed **2/2**. It covered migration, UI create/edit/delete with direct SQLite/API confirmation, linked course/session preservation, reload and stale-write rejection. It also exercised real `/api/state/replace`, `/api/state/recovery` and `/api/state/purge-work-history` operations: a work log was saved, a backup-style replacement created a recoverable prior state, that state was restored, and privacy purge removed the log from both live SQLite state and the recovery snapshot. A JSON `null` write was rejected with HTTP 400. The server was stopped after the run.

Clean-delivery acceptance used an isolated temporary copy containing the delivery files rather than the working installation. After review fixes, a fresh `npm.cmd ci` installed 96 packages from the lockfile; `npm.cmd test` passed **1195/1195**, `npm.cmd run build` passed with 68 modules, and the final two production Chromium cases passed **2/2** on an isolated SQLite file and `127.0.0.1:18097`. The process was stopped afterwards. Runtime databases, `node_modules` and `dist` are ignored delivery artifacts, not required source inputs.

A separate post-review HTTP smoke omitted `HOST` and confirmed that `npm.cmd start` listened on `127.0.0.1:18093`; raw malformed path `/%E0%A4%A` returned 400 while `/` returned 200 with `X-Frame-Options: DENY` and `Cache-Control: no-cache`. The process was stopped afterwards.

The final source comparison covered **601 deliverable files** after excluding generated/runtime directories and log files; the clean copy had zero missing files and zero SHA-256 differences. `docker compose config --quiet` still exited 0 in that copy. No listeners remained on the temporary acceptance ports, `8088`, or port 80 after the checks. This paragraph records the earlier non-container verification and is superseded for Docker runtime status by the completed acceptance below.

`docker compose config` passed and rendered loopback publication `127.0.0.1:8088`, target 8080, named volume `studieplanlegger_studieplan-data` and the healthcheck. Docker Desktop 29.7.2 was started and daemon access was verified. Three clean-copy `docker compose -p studieplan_delivery_verify build --no-cache` attempts and a direct `docker pull node:24-bookworm-slim` all failed while transferring the selected base-image tag's layers with BuildKit `local error: tls: bad record MAC`, at Dockerfile `WORKDIR /app`, before project dependency installation or build commands ran. Therefore image completion, Compose health and named-volume container recreation are **untested due to the repeated Docker registry transport failure**, not inferred from the passing normal Node build.

## Docker transport follow-up — 2026-09-20

The blocked transport observations in this section are historical. The later clean-copy runtime acceptance below supersedes their then-current conclusion that Docker execution was unavailable.

The mandatory BMAD generator was first confirmed independently of Docker. From Windows PowerShell 5.1 at the project root, the documented direct uv executable and `uv --version` both returned `uv 0.12.6`; the required `uv run --no-cache ...render_skill.py` then exited 0 under the same narrow approved execution mechanism. No uv installation, association, PATH, registry, ACL or security setting changed.

Read-only Docker evidence:

- Docker Desktop 4.88.1 (237512), client/Engine 29.7.2, containerd 2.3.3, Linux engine and active `desktop-linux` context were observed. Docker Desktop was running after the controlled checks.
- WinHTTP reported direct access. No user `HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY`, Docker client proxy block or explicit Desktop proxy override was present. Docker's HTTP-proxy log states that registry/CDN connections use the direct path.
- Only Wi-Fi was physically connected; Ethernet was already disconnected. The multiple-physical-adapter hypothesis therefore did not justify changing an adapter.
- Local Docker VM and host logs contained BuildKit and Desktop updater failures with `failed to copy: local error: tls: bad record MAC`. This proved that the observed TLS transfer failure also occurred outside the project build steps; it did not validate the then-unbuilt Dockerfile or identify whether the remaining fault was in the Desktop VM/network stack, Wi-Fi/router path or an upstream connection.

Targeted reversible checks:

1. With Desktop already running, one direct `docker pull node:24-bookworm-slim` again downloaded some layers and failed with `local error: tls: bad record MAC`.
2. A controlled `docker desktop restart` completed; one new pull again downloaded some layers and failed identically.
3. The existing user-level Docker daemon configuration was copied to an isolated backup, `max-concurrent-downloads` was temporarily set to 1, Desktop was restarted, and one final pull failed identically. The original file was restored byte-for-byte, followed by a controlled Desktop restart.

No project image, container, Compose project or volume was created; `docker image ls` still contained only the pre-existing `hello-world` image, `docker volume ls` was empty, and the two pre-existing stopped containers were not changed. No tested port was published and port 80 was untouched. Because the required base image is still absent, clean-copy build, container health, browser use in Docker, backup/restore in Docker and same-volume recreation remain **unverified**. Repeating the same build would add no evidence.

Concrete next action: connect the machine to one different stable, trusted network path with only that physical adapter active and run `docker pull node:24-bookworm-slim` once. A successful pull permits the already documented isolated Compose/UI/recreate acceptance; the same failure on the alternate path narrows the next investigation to Docker Desktop/WSL networking rather than this project.

When the pull succeeds, run the remaining acceptance from the clean copy with these isolated values (increment the project suffix or port if either is already present):

```powershell
cd <isolated-clean-copy>\studieplanlegger
$dockerProject = 'studieplan-docker-accept-20260920-01'
$env:STUDIEPLAN_PORT = '18088'
$env:STUDIEPLAN_SEED = 'false'
Remove-Item Env:STUDIEPLAN_SEED_JSON -ErrorAction SilentlyContinue
docker compose -p $dockerProject config --quiet
docker compose -p $dockerProject up --build -d
docker compose -p $dockerProject ps
Invoke-RestMethod http://127.0.0.1:18088/api/health
docker volume inspect "${dockerProject}_studieplan-data"
```

The expected publication is only `127.0.0.1:18088:8080`, and the inspected volume must mount at `/data`. Browser A must create and edit one course, linked task and linked study session, export a backup, then make a post-backup task-title change. Record `/api/state` revision plus exact course/task/session IDs and relations. Recreate only the service with `docker compose -p $dockerProject up -d --no-deps --force-recreate studieplan`; require a different container ID, the same volume name and healthy API. Browser B must use a new Chromium profile with no storage state and still show the post-backup change and identical IDs/relations. Restoring the exported backup must return the pre-mutation title with the same linked IDs, increment the database revision and leave the immediately previous state available through `/api/state/recovery`. Stop with `docker compose -p $dockerProject down`, never `down -v`, and confirm no listener remains on port 18088. The completed results are recorded below.

## Docker clean-copy runtime acceptance — 2026-09-20

The previously blocked base image was present locally as `node@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6`. The mandatory BMAD generator again exited 0 through the documented narrow approved execution. The observed runtime was Docker Desktop 4.91.0, client/Engine 29.8.0, containerd 2.3.4 and context `desktop-linux`.

From an isolated clean delivery copy, `docker compose -p studieplan-docker-accept-20260920-02 up --build -d` completed in the final strict run. Both locked `npm ci` stages passed in the initial build, Vite built 68 modules, and the service became healthy as the non-root `node` user. Inspection showed only `127.0.0.1:18088->8080/tcp` and volume `studieplan-docker-accept-20260920-02_studieplan-data` mounted read/write at `/data`. `/api/health` returned `status=ok` and `database=sqlite`; the initial state was revision 0 and empty.

Browser A was a new Chromium process with no `studieplanlegger:v1` localStorage entry. Through the visible UI it created and edited course `0e3819a1-2dfc-4fed-a914-87e0fed41600`, task `4276b4a7-3ab0-4a5d-8046-d79b191b9ee9`, and study session `ec7b58e3-f6d8-4e17-a7f3-cc36140476ea`. The API reached revision 7 with `tasks.courseId` equal to the course ID and `sessions.taskId` equal to the task ID. The settings UI exported `artifacts/docker-ui-backup.json`; a later UI edit changed the task title after that backup.

Service-only force recreation changed the container ID from `f164b0655963d089f6d19d5388681f5f9499d5e46a66b08e828c51c3bd1a77c2` to `9ee25baa185908dd12d70e33ec3aa883fa8f3f619506526badd53e45441538b6`. The same named volume and loopback publication remained, and the replacement became healthy. Browser B was a separately launched Chromium process with no localStorage state; it read the post-backup title plus the same three IDs and both relations from SQLite and displayed the course, task and session in the UI.

Browser B restored the downloaded backup through Settings in the same successful final run. Revision advanced from 7 to 8, the pre-backup title returned without changing any ID or relation, reload retained it, and `/api/state/recovery` contained the immediately preceding post-backup title. A read-only `node:sqlite` query inside the recreated container independently returned revision 8, matching foreign-key values, one recovery snapshot and a 184320-byte `/data/studieplan.sqlite` file. Screenshots and machine-readable state are in `artifacts/docker-browser-a.png`, `artifacts/docker-browser-b-restored.png`, `artifacts/docker-phase-a.json`, `artifacts/docker-phase-b.json` and `artifacts/docker-orchestration.json` in the clean copy.

The final acceptance harness ran in this order from the clean-copy directory: set `STUDIEPLAN_BASE_URL=http://127.0.0.1:18088`; run `node artifacts/docker-acceptance-run.mjs a`; force-recreate only `studieplan` with the documented `docker compose -p studieplan-docker-accept-20260920-02 up -d --no-deps --force-recreate studieplan` command and verify a new healthy container ID plus the same volume; then run `node artifacts/docker-acceptance-run.mjs b`. The harness is retained as evidence under the clean copy's ignored `artifacts` directory and is not required for ordinary application startup.

The temporary harness initially used two selectors that did not match the rendered action controls and then expected `recovery.envelope` instead of the actual `recovery.data` response. Review also found that the first retained phase-B artifact represented a post-restore resume rather than the transition itself. The final `-02` run therefore required an empty revision-0 database, waited for every UI commit and always performed restore; it recorded revision 7 to 8 directly. These were harness/evidence defects, not product defects, and no product code change was required. The Compose project was stopped with `docker compose -p studieplan-docker-accept-20260920-02 down`, never `down -v`. Its isolated volume was retained only for optional local reinspection; the portable JSON reports and screenshots are the review evidence. Port 80, default project names, existing volumes and actual browser/user storage were untouched.

## Git clean-checkout submission acceptance — 2026-09-20

Commit `e5ad5be1df2aa3c256a42c6d1bbde07b8265e44e` was cloned into a new temporary checkout containing only the Git tree. From its `studieplanlegger/` directory, a fresh `npm.cmd ci` installed 96 locked packages, `npm.cmd run test:unit` passed **1195/1195** tests in **95/95** files, and `npm.cmd run build` completed with **68 modules**. The later submission-status edit changed documentation only; the tested application, lockfile, Dockerfile and Compose file are identical.

The same checkout built and started with `docker compose -p studieplan-git-accept-e5ad5be up --build -d`, using loopback port `127.0.0.1:18099` and the isolated volume `studieplan-git-accept-e5ad5be_studieplan-data`. Docker Engine 29.8.0 used the pinned resolved base-image digest already recorded above. The container became healthy as user `node`; `/api/health` returned `status=ok`, `database=sqlite`, and initial revision 0.

The targeted production Chromium suite passed **2/2** against the container. It explicitly migrated synthetic browser data once, preserved the original browser copy, edited and created/deleted tasks through the UI, retained task/course/session IDs and relations, rejected a stale revision with HTTP 409, and exercised backup-style replace, recovery restore and work-history purge through the live API/database.

Forced recreation with the same Compose project changed the container ID from `db3e5d90c543ff970f60c2f5c5a49abb414cf321351f020f518fab99447454d1` to `91f7a060d60d53812eac6f2c9a1fc400605dd5f52329b6cba0d5a7d0bc6a24d7`. The serialized API state was byte-for-byte identical before and after recreation at revision 8: task `legacy-task` remained linked to course `legacy-course`, and session `legacy-session` remained linked to that task. A separately launched Chromium context had no `studieplanlegger:v1` localStorage entry, displayed the edited task, and read those same IDs and relations from the API. This rules out browser cache as the source of the persisted state.

The Compose project was stopped with `docker compose -p studieplan-git-accept-e5ad5be down`, without `-v`. Port 18099 was confirmed free afterwards; the isolated test volume was retained for optional reinspection. Port 80, actual user storage and other Docker projects were not used.

## Post-review clean-checkout acceptance — 2026-09-20

Commit `b817b52ba6cdba01390e677a80cdc8c85407bd9e` was checked out into a second temporary Git-only directory after the review corrections. A fresh locked install passed, the complete unit suite passed **1196/1196 tests in 95/95 files**, and the production build completed with **68 modules**. The dedicated production database command `npm run test:e2e:database` passed **2/2**, and the focused calendar viewport regression passed **5/5**.

The same clean checkout built and started with `docker compose -p studieplan-git-final-b817b52 up --build -d` on only `127.0.0.1:18100`, using isolated volume `studieplan-git-final-b817b52_studieplan-data`. The container became healthy as user `node`; the health response reported `status=ok`, `database=sqlite` and revision 0. The production database suite then passed **2/2** against this container.

Forced recreation changed the container ID from `b51f6dda020b3631f5c32ab52b29dc62fdce748c6145c8ea00a9bbfa25625332` to `dd76d2cfc57bed9c51955d21265dbe8bce0ed7ebaf35daae4f983873159b4846`. State before and after recreation was identical at revision 8: task `legacy-task` remained linked to course `legacy-course`, and session `legacy-session` remained linked to that task. A new Chromium context had no `studieplanlegger:v1` localStorage value, displayed the task, read the same IDs and relations from the API, and received `font/woff2` for the font asset. This independently confirmed database-backed persistence rather than browser cache.

The project was stopped with `docker compose ... down`, never `down -v`; port 18100 was confirmed free and the isolated volume was retained. Port 80, actual user data and other Docker projects were untouched. Two setup mistakes were corrected without product changes: the first `npm ci` was invoked one directory above `package-lock.json`, and the first ad-hoc font request used a relative URL without a Playwright `baseURL`. Only the successful, corrected commands are counted as acceptance evidence.

## Legacy `shape_json` migration correction — 2026-09-20

A schema-first regression fixture created a representative older SQLite database whose `state_meta` table had no `shape_json` column. Before the correction, the focused test failed at startup with `table state_meta has no column named shape_json`; this reproduced the reviewed defect independently of a fresh database. The fixture and all later checks used temporary or isolated synthetic data only.

The corrected migration adds compatibility columns before any statement uses them and keeps bootstrap DDL, the foreign-key rebuild, validation and migration markers inside one `BEGIN IMMEDIATE` transaction. After review, the focused database file passed **10/10** cases. It verified exact revision-7 envelope preservation, stable course/task/session/dependency identities, retained provider/source IDs, original update time, recovery and legacy-archive metadata, current foreign keys and migration markers, two further opens without mutation, a fresh revision-0 database, complete rollback when an older orphan relation deliberately fails the final foreign-key check, and the independent intermediate case where foreign keys already exist but `shape_json` does not. The rollback case compares the complete pre/post `sqlite_master` definition and renames the file after failure to verify handle release on Windows.

The working tree and separate clean Git worktrees were tested. Before the documentation/test-only review additions, the first clean worktree's `npm ci` installed 96 locked packages, the complete unit suite passed **1199/1199 tests in 95/95 files**, the production build completed with **68 modules**, and `npm run test:e2e:database` passed **2/2** against its temporary Node/SQLite server. After review added the independent intermediate-schema test without changing production code, a new clean worktree from the final staged tree installed the same 96 locked packages, passed **1200/1200 tests in 95/95 files**, built 68 modules and passed another **2/2** production database E2E run. Only this evidence paragraph was added after that run; application code, tests and commands are identical to the tested tree. The E2E cases retained the existing revision-conflict, relational round-trip, backup-style replace, recovery restore and work-history purge coverage.

Docker Compose project `studieplan-migration-fix-final-20260920` built the same clean tree and started healthy as user `node` on only `127.0.0.1:18102`, with isolated volume `studieplan-migration-fix-final-20260920_studieplan-data` mounted at `/data`. A synthetic course `final-migration-course`, task `final-migration-task` and session `final-migration-session` were written through the API at revision 1. Service recreation changed the container ID from `ac5b24889aa1c5586d9711601f6a2dfc99732cfc48fafb69a2bb3781d977b683` to `ffb5eaef1cf14d91773751e4001ad6dae498bfb836f8db10b69ab2da79525940`; health returned `ok/sqlite/1`, the same volume remained mounted, and both task→course and session→task relations retained the exact IDs.

The isolated Compose project was stopped with `down`, not `down -v`; port 18102 was confirmed free and the test volume was retained. Port 80, existing projects, actual browser data and the user's database were not opened or changed.
