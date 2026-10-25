# Epics og stories for dagens leveranse

**Samordnet 2026-10-25.** S-01/S-03/S-04/S-05 følger **oppgave → arbeidssteg → godkjent studieøkt → utfall → justering** med lokale regler; S-02 støtter flyten med import, S-06 bevarer data, og S-08 bevarer valgfrie tillegg. Et eget steg er valgfritt. Krav-ID-er og HiMolde-/NTNU-avgrensning er uendret. Daterte tekniske resultater nedenfor tilhører sine kontrollerte versjoner; [publiseringskontrollen](../../studieplanlegger/VERIFICATION.md#publiseringskontroll--2026-10-25) skiller dem fra kandidatkontrollene. S-07/studentprøven er fortsatt planlagt.

## Personvern og kalenderintegritet — 2026-10-25

Presisering av S-02/S-05/S-06 og Q-02/Q-03 innen samme V1:

- **Given** standarddefinerte kalenderverdier med små bokstaver, **when** de importeres, **then** avlysning, transparens og støttede gjentakelser får samme betydning som store bokstaver, mens UID og fritekst beholdes.
- **Given** flere UID-felt eller motstridende komponenter, **when** identiteten vurderes, **then** ingen vilkårlig førsteverdi får avlyse eller erstatte data. Gyldige duplikater, entydige revisjoner og serieunntak beholdes.
- **Given** samtidig DTEND/DURATION, uforenlige UNTIL/DTSTART eller ugyldig TP-JSON-dato, **when** kilden leses, **then** feilen forklares uten datoflytting; opptellingen og tidligere data forblir riktige ved delvis import.
- **Given** testdata med personfelt i senere eller alternative segmenter, **when** personvernguardene kjøres, **then** en syntetisk verdi ett sted fritar ikke resten av feltet fra kontroll. Negative prøver er selvstendig oppdiktet, og feilmeldinger gjengir ikke de opprinnelige verdiene.

Kjøreresultater og begrensninger føres i [VERIFICATION](../../studieplanlegger/VERIFICATION.md), adskilt fra historikken nedenfor.

## Consolidated import closure — 2026-10-24

Approved additions to S-02/S-03/S-05/S-06/S-08 and Q-01–Q-03:

Implementation and independent review were recorded complete on 24 October. [That dated technical acceptance](../../studieplanlegger/VERIFICATION.md#consolidated-import-and-calendar-closure--2026-10-24) records source/build hashes, the full unit run, relevant browser regression and 17 scenarios on each production runtime. Its manifests omit tests, fixtures and configuration, so they do not establish identical test inputs for a later candidate. The results do not establish student acceptance or private-calendar verification.

- **Given** first/middle/later title codes and qualified file/plan courses, **when** previewed, **then** unique links resolve automatically without title-based exam/deadline classification; multiple codes or institutions require one shared clarification.
- **Given** legacy empty links or explicit manual links/no-course decisions, **when** repaired and reimported, **then** uncertain legacy intent is clarified per course once, the decision persists, and event/source identities and unrelated edits survive.
- **Given** equivalent UTC/TZID cancellations, an endless series with explicit RDATE, a published autumn term with January activity, or long DURATION, **when** imported, **then** the correct occurrence, bounded coverage, published course term and actual period end are preserved; unsupported ambiguity is explained without data loss.
- **Given** personal CSV hints or an explicit parser identifier choice, **when** parsed and confirmed where applicable, **then** no incidental course is required and the requested valid identity is used, while an invalid choice fails explicitly.
- **Given** fractional-second entries or distinct autumn-fold instants, **when** details/export are opened, **then** exact instants remain stored, ambiguous wall times show offsets, and export lists representable/omitted items before approval with no false empty success.
- **Given** an imported personal interval overlapping the export range or an exactly representable all-day period with Oslo-midnight endpoints, **when** the selected calendar copy is reviewed and downloaded, **then** the interval remains included and DATE/exclusive-end semantics survive re-reading. Fractional precision and inconsistent stored all-day periods after clock-time editing are explicitly listed as omissions before consent; stored values remain unchanged.
- **Given** malformed raw ICS values, duplicate singleton time fields or an unknown event timezone alongside valid events, **when** previewed, **then** the affected component is visibly rejected without normalized invented times or loss of valid siblings. This validates the existing supported calendar forms; it adds no timezone service.
- **Given** fresh/previously imported synthetic state on desktop/mobile/enlarged text/keyboard, **when** the complete forms, reload, repeat, backup/restore, undo, rejected writes and recreation are exercised, **then** exact data and usable confirmation survive. Record actual tests and limitations separately in [VERIFICATION](../../studieplanlegger/VERIFICATION.md); technical checks are not student testing.

## Import clarity follow-up — 2026-10-23

The [approved bounded correction](../../studieplanlegger/VERIFICATION.md#import-clarity-final-review--2026-10-23) adds these acceptance examples to S-02/S-05/S-06 and Q-01–Q-03, preserving the existing V1 scope:

- **Given** mixed known/unknown institutions, **when** the student opens compact per-course choices or applies a common choice, **then** known affiliations remain intact, unknown remains valid, and deliberate corrections require consent. A same-source/UID reimport with omitted affiliation restores only uniquely established context.
- **Given** an equal, missing or invalid end with a valid start, **when** the student explicitly confirms a point, **then** user provenance persists through refresh/reload/reimport and the point reserves no duration or invented deadline. Invalid starts remain rejected; later positive ends restore intervals.
- **Given** valid 30-row TP CSV or mixed ICS input, **when** the student previews, chooses all/published groups/individual exceptions and confirms once, **then** exact times, names, IDs, course links and omissions survive storage, editing, undo and recreation. HTTP rejection or a real stale revision preserves the previous envelope.
- **Given** desktop, 390px or enlarged text, **when** keyboard controls or delayed responses update the draft, **then** focus, scroll, open sections and newer choices remain usable. Technical screenshots and action/control counts are recorded separately from student testing in [VERIFICATION](../../studieplanlegger/VERIFICATION.md).
- **Given** a time decision, an incomplete numeric edit or a retained receipt, **when** selection/rendering changes or a later edit is saved, **then** reselection preserves the explicit time decision, rendering retains the live input and current row binding, and stale receipt undo rejects without changing the saved envelope. Colliding group labels remain distinguishable; compact and detailed institution choices show the same effective affiliation and consent.

**Rekonstruert 2026-10-16**, jf. [proveniens og historikk](README.md). Disse åtte små historiene beskriver eksisterende kode og en framtidig studentprøve. «Implementert» betyr at kode og tekniske tester finnes; det er ikke en ny kjøring eller studentaksept. [PRD](PRD.md) eier R-/Q-kravene, og [sporbarhet](TRACEABILITY.md) peker til kode, navngitte tester og daterte resultater.

## Epic E-01: Etablere en plan

### S-01 — Manuell start (R-01, Q-01; SC-01)

Som student vil jeg registrere det jeg vet, slik at manglende detaljer ikke hindrer start.

- **Given** tom planlegger, **When** jeg lagrer et manuelt emne og en oppgave med bare tittel, **Then** oppgaven lagres uten oppdiktet frist eller anslag.
- **Given** oppgaven og tilgjengelig tid, **When** jeg kontrollerer og godkjenner en økt og laster siden på nytt, **Then** emne, oppgave og økt beholder sine koblinger.

Status: implementert; automatisert teknisk onboarding finnes. Studentforståelse gjenstår i S-07.

### S-02 — Avgrenset, kontrollert import (R-02, Q-02; SC-02)

Som student vil jeg se kildens informasjon og usikkerhet før jeg bekrefter den.

Bounded correction **2026-10-19**, see [correction](../../studieplanlegger/VERIFICATION.md#ics-point-markers-and-period-correction--2026-10-19): given a mixed calendar with intervals, date-only events and timed events without an end, when imported, then valid point markers remain editable without invented duration or busy time. Given a new file after an earlier period choice, then automatic file dates apply until an explicit filter is chosen; included, filtered and rejected source entries must be explained separately from generated course proposals and recurrence occurrences.

Tillegg bestilt **2026-10-18**, jf. [datert oppfølging](../../studieplanlegger/VERIFICATION.md#kalenderfil-og-sammenhengende-flyt--2026-10-18):

- **Given** én ICS-fil med tydelig identifiserte nye/eksisterende emner og en hendelse uten emne, **When** studenten gjennomgår nødvendige gruppeavklaringer og bekrefter én gang, **Then** opplysningene lagres samlet med stabile identiteter og eksisterende angre; uten-emne-hendelsen kan vises og redigeres etter omlasting.
- **Given** samme kalenderkilde med endrede, avlyste og manglende oppføringer, **When** en oppdatering kontrolleres, **Then** UID/forekomstidentitet beholdes, fravær sletter ikke hendelser, og lokale konflikter må avklares.
- **Given** endringer etter forhåndsvisning, **When** studenten oppdaterer forhåndsvisningen, **Then** fortsatt gyldige valg beholdes og nye konflikter krever avklaring før samlet lagring.
- **Given** et emnesøk skrevet i programsøket, **When** ingen programmer finnes, **Then** søketypen forklares og studenten kan gå uttrykkelig til emnesøk med institusjon og tekst bevart.

- **Given** HiMolde IT 2026–27, **When** planen tolkes og et alternativ velges, **Then** IBE110/IBE430 er påkrevd og valget er enten IBE160 eller begge IBE102/IBE152.
- **Given** endret kildeinnhold, **When** importen forhåndsvises, **Then** endringene krever bekreftelse; ingen personlig gruppe utledes.
- **Given** tidligere importert undervisning, **When** oppdateringen feiler, **Then** tidligere hendelser/valg og siste suksess beholdes, mens feilen beskrives separat.
- **Given** NTNU ARK1001 eller EXPH0100 høst 2026, **When** studenten søker emnemetadata, henter emnelenket undervisning, kontrollerer aktivitetsutvalget og bekrefter importen, **Then** emnet og undervisningskoblingene beholdes ved omlasting og samme import gjentatt med stabile ID-er. Testkilde: [connected-public-teaching-live.spec.js](../../studieplanlegger/tests/e2e/connected-public-teaching-live.spec.js), `live NTNU course and teaching round-trip: ARK1001` / `live NTNU course and teaching round-trip: EXPH0100`. Dette er eksisterende testkode, ingen ny live-kjøring.

Status: implementert. Ny lokal kontraktkontroll 2026-10-16; transport og UI er historiske avgrensede prøver. Hele HiMolde-programgjentakelsen er ikke verifisert. NTNU-avgrensningen følger PRD, uten programløfte.

Approved S-02 follow-up **2026-10-19**, [resolution correction](../../studieplanlegger/VERIFICATION.md#course-resolution-source-changes-and-csv-clarification--2026-10-19):

- **Given** a qualified course code and one verified name, **When** a file or link is previewed, **Then** the name is resolved without a separate approval; unknown or ambiguous identity requires one grouped clarification.
- **Given** a missing name or explicit course deselection, **When** linked activities remain selected, **Then** the preview explains the unresolved relationship and cannot save a dangling reference or silently remap activities.
- **Given** an in-flight calendar request, **When** the user switches to a file, **Then** prior feedback and late responses cannot affect the new draft.
- **Given** supported TP course selections or synthetic CSV encodings/ambiguous columns, **When** imported through visible controls, **Then** existing adapters and the shared preview are reused with explicit uncertainty and one atomic confirmation.

## Epic E-02: Gjennomføre og justere

### S-03 — Gjennomførbare forslag (R-03; SC-03)

Som student vil jeg se hva som får plass innenfor de opplysningene jeg har registrert.

- **Given** arbeidsvinduer, kjent undervisning/opptatt tid og avhengigheter, **When** forslag beregnes, **Then** nye økter ligger i gyldig ledig tid og respekterer forutsetninger; manglende kapasitet forklares.
- **Given** et manuelt flyttet utkast, **When** det overlapper, bryter vinduet eller har foreldet grunnlag, **Then** godkjenning avvises uten lagring.
- **Given** kjent frist og utilstrekkelig tid før fristen, **When** kapasiteten beregnes, **Then** arbeid etter fristen telles ikke som tilgjengelig, og manglende tid forklares. Testkilder: [capacity-invariants.test.js](../../studieplanlegger/tests/unit/capacity-invariants.test.js), `keeps every assigned minute inside a real session and deadline, never assigns it twice, and preserves input`, og [capacity-notice.test.js](../../studieplanlegger/tests/unit/capacity-notice.test.js), `identifies a hard deadline shortage independently of planned sessions`.
- **Given** et forslag beregnet fra et tidligere gjenstående anslag, **When** anslaget endres før godkjenning, **Then** det gamle forslaget avvises som foreldet uten skriving. Dette er eksplisitt kontrollert av A10-testen i [connected-planner.test.js](../../studieplanlegger/tests/unit/connected-planner.test.js): `A10 rejects edits that overlap, lack breaks, violate windows, stale data or elapsed start, with atomic undo`.

Status: implementert med enhetstester og historisk teknisk evidens; ingen garanti ved ukjente eller feilregistrerte opplysninger.

### S-04 — Utfall uten falsk framgang (R-04; SC-04)

Som student vil jeg registrere arbeid uten at systemet gjetter fullføring eller levering.

- **Given** 30 planlagte minutter og 120 opprinnelig anslag, **When** jeg registrerer 30 faktiske minutter og 45 gjenstående, **Then** begge opplysninger beholdes hver for seg.
- **Given** en oppgave med steg og innleveringskrav, **When** et steg fullføres, **Then** hele oppgaven og innleveringen forblir ufullført; når oppgaven senere fullføres, kreves fortsatt separat leveringsbekreftelse.
- **Given** en ikke utført økt, **When** utfallet registreres, **Then** ingen produktiv tid eller mestring utledes.

Status: implementert; automatiserte domene-/stegtester, ikke dokumentasjon på læring.

### S-05 — Godkjenne og angre (R-05; SC-05)

Som student vil jeg kontrollere planendringer og kunne angre dem samlet.

- **Given** et forslag, **When** jeg bare forhåndsviser eller avbryter, **Then** ingen ny økt lagres.
- **Given** uendret gyldig grunnlag, **When** jeg godkjenner og deretter angrer, **Then** den samlede endringen lagres og gjenopprettes samlet.
- **Given** endret grunnlag, **When** gammelt forslag brukes, **Then** det avvises uten delvis skriving.

Status: implementert med tekniske tester; denne samordningen endrer ikke produktatferden.

## Epic E-03: Bevare og etterprøve

### S-06 — Varig lokal leveranse (R-06, Q-02; SC-06)

Som student vil jeg bevare planen uten konto og kunne følge dokumentert lokal oppstart.

- **Given** lagrede emner, oppgaver og økter, **When** produksjonsserveren/containeren starter på nytt med samme datavolum, **Then** identiteter og relasjoner beholdes.
- **Given** ugyldig eller foreldet tilstand, **When** lagring forsøkes, **Then** ingen del av kandidaten erstatter gyldige data.

Status: implementert; datert Node/SQLite- og Docker-evidens. Ingen ny Docker-kjøring 2026-10-16.

### S-07 — Undersøke studentforståelse (R-07, Q-01; SC-07)

Som leveranseansvarlig vil jeg skille teknisk funksjon fra faktisk studentforståelse.

- **Given** en frivillig ny student og syntetiske data, **When** [prøveplanen](USER-TRIAL-PLAN.md) gjennomføres, **Then** registreres selvstendig fullføring av hovedflyten og studentens forklaring av ferdig/levert.
- **Given** nødvendig fasilitatorhjelp eller feil forklaring, **When** prøven vurderes, **Then** kriteriet rapporteres som ikke oppnådd i den prøven, med konkret problem og uten oppdiktet nytte.

Status: planlagt, ikke gjennomført. Personlig refleksjon og eventuell lengre egenbruk må skrives av studenten fra faktiske erfaringer.

### S-08 — Bevare eksisterende tillegg (R-08; støtter SC-04/SC-05)

Som student vil jeg fortsatt kunne bruke valgfrie tillegg uten nye obligatoriske registreringsfelt.

- **Given** ordnede steg, **When** et steg fullføres, **Then** identitet og historikk beholdes uten automatisk fullføring av oppgaven.
- **Given** lav frivillig egenvurdering, **When** repetisjon foreslås, **Then** ingen økt lagres før godkjenning.
- **Given** lagret plan, **When** kalenderkopi eksporteres eller planalternativer sammenlignes, **Then** eksporten er en kopi og sammenligningen skriver ikke før eksplisitt valg.

Status: implementert tillegg, med integrerte tester; ekstern Outlook-import og studentnytte er ikke bekreftet.


### Subsequent calendar form correction — 2026-10-19 (S-02, S-05, S-06; Q-01)

The [bounded UI correction](../../studieplanlegger/VERIFICATION.md#calendar-import-forms-final-follow-up-2026-10-19) refines the existing stories without extending coverage.

- **Given** an empty planner and a mixed synthetic ICS file, **When** the student uses any file entry with automatic dates and resolves a code-only course name once, **Then** new courses and linked/unassigned events are saved together.
- **Given** optional settings or an earlier program semester, **When** a new file draft opens, **Then** only an explicit manual period choice enables filtering and required semester/year validation.
- **Given** a supported calendar link without saved courses, **When** snapshot import is selected, **Then** the shared preview offers course clarification; the existing recurring-source contract remains an explicit separate choice.
- **Given** many events, **When** the preview opens, **Then** counts distinguish courses/events/points, valid event groups collapse and confirmation remains reachable.

These are reported UI problems and technical acceptance criteria, not a student trial. See the separately dated entry in [VERIFICATION](../../studieplanlegger/VERIFICATION.md) for actual results.


### Import story correction evidence - 2026-10-19

S-02, S-05 and S-06 retain their existing scope. The [approved continuation](../../studieplanlegger/VERIFICATION.md#final-blocked-import-continuation--2026-10-19) supplies missing context-to-name resolution, explicit grouped fallback, exact TP term discovery and CSV calendar identity/time persistence. New synthetic visible cases reproduce the three blockers before fixes; focused corrected results are 177 unit tests and 17 browser cases. These are technical evidence, not student testing or national source coverage.

Final story acceptance is technically verified through the visible forms: empty planner → code-only ICS → context/name/fallback/no-course decisions → one save; populated planner → legacy CSV encoding/title choice → linked calendar event; bare public TP → exact published term or explicit variant choice. Reimport, undo, failed write, real revision conflict and Node/Docker recreation preserve exact state. The final 100-case browser run includes asynchronous active-field and scroll preservation. Actual public name lookup and separate TP adapter evidence, limitations and deployment status are documented in [VERIFICATION](../../studieplanlegger/VERIFICATION.md). The original private files and complete clipped URL remain unverified.

### Import usability acceptance — 2026-10-21 (S-02, S-05, S-06; Q-01)

At the **2026-10-21 pre-review checkpoint**, all six isolated Node/SQLite and Docker/SQLite scenarios passed with recreation and fresh browsers. Visible first UiO TP/CSV imports required no precreated UiO course. Published-group and ungrouped all-selection each saved eight activities in two selection/confirmation actions; deliberate exceptions remained excluded on reimport. Exact seconds and source labels survived storage. These checkpoint results precede the review corrections below; current execution status and bounded source/test limitations are maintained in [VERIFICATION](../../studieplanlegger/VERIFICATION.md).

The [approved correction](../../studieplanlegger/VERIFICATION.md#import-usability-continuation--2026-10-21) adds bounded acceptance to the existing import story:

- **Given** another institution in an existing or empty planner, **when** its published context or a registry choice is supplied, **then** institutions, accepted course names and links survive save/reload without precreating that institution's courses.
- **Given** eight ungrouped seminars or eight members of one published group, **when** the student chooses all or that group and confirms, **then** selection/save needs two activations; individual exclusions survive repeat import. Titles and overlaps never establish membership.
- **Given** reliable CSV bytes and equivalent/empty aliases, **when** the file is read, **then** no redundant decoding/title/ID question appears; uncertain decoding uses readable examples, and a missing activity title remains unresolved until the student enters a name or explicitly accepts the labelled provisional suggestion.
- **Given** exact instants and source-qualified point/assessment metadata, **when** saved or edited, **then** seconds/offsets are preserved and capacity follows proven semantics. Generic short intervals remain intervals.

Review corrections on the same date add these cases to S-02/S-05/S-06 and the existing capacity story S-03:

- **Given** a saved qualified ICS event after reload, **when** the student selects the same source and confirms its explicit cancellation, **then** the event keeps its ID, source scope and course link while releasing occupied time; preview alone changes nothing.
- **Given** a point without a duration, **when** the student enters a valid end time, **then** the saved interval reserves capacity unless explicit transparency or source information says otherwise; no duration is invented.
- **Given** repeated CSV course rows, **when** a later row supplies a name or disagrees with an earlier name, **then** a consistent later name fills the proposal and conflicting names require one course clarification. Explicit course rows preserve campus, campus code and source-object distinctions.
- **Given** a saved link snapshot, **when** the student selects it for a file revision, **then** the current file origin and filename appear after save/reload while source/event IDs and local notes remain intact.
- **Given** equal group names in different course contexts or simultaneous start/end column ambiguities, **when** the student reviews choices, **then** labels distinguish the course and destination field, and examples expose the actual differing rows even when those occur later in the file.
- **Given** supported millisecond timestamps and deliberate exclusions, **when** the student previews, opens calendar details, edits notes and reimports, **then** exact instants, links and exclusions survive. Refresh also retains explicitly approved provisional-title provenance; equivalent start aliases remain calendar events, malformed assessment groups are rejected, and exceeding the existing retained-exclusion limit gives a specific nonmutating error.

The added [visible review journeys](../../studieplanlegger/tests/e2e/import-usability-review.spec.js), [unit regressions](../../studieplanlegger/tests/unit/import-usability-review.test.js) and expanded [selection/editor journey](../../studieplanlegger/tests/e2e/import-resolution.spec.js) verify these outcomes. Final post-review technical acceptance passed, including Node/SQLite and Docker recreation; earlier checkpoints remain historical. Tests are synthetic technical evidence. Public CSV schema, private CSV/TP equivalence and actual student understanding remain distinct, unverified claims; see dated [verification results](../../studieplanlegger/VERIFICATION.md).

### S-02/S-05/S-06/S-07 follow-up - 2026-10-21

The [reimport repair](../../studieplanlegger/VERIFICATION.md#reimport-repair-final-verification---2026-10-21) adds these acceptance cases: a display-title change after reload retains activity IDs; pre-fix deletion/exclusion history survives reimport; real deletion needs an explicit grouped keep/restore decision; changing the missing candidate requires fresh consent; accepted course names and manual edits remain; undo followed by reimport retains valid relationships. Dates and course consequences distinguish ambiguous choices. No missing activity is silently recreated. Concrete results and limits are in [VERIFICATION](../../studieplanlegger/VERIFICATION.md).


### Source lifecycle continuation - 2026-10-21

The user's subsequent failure reopens the existing R-02/R-05/R-06 and S-02/S-05/S-06/S-07 import journey. [The approved continuation](../../studieplanlegger/VERIFICATION.md#reopened-source-lifecycle-blocker---2026-10-21) requires A-to-B-to-A source revisions, deletion restore/omit and refreshed confirmation to reach storage with stable IDs; known per-course institutions must survive missing raw context, and deliberate corrections need explicit consent. New-file source selection and asynchronous drafts must remain isolated. Invalid previews explain their state rather than show zero completed totals. This applies the teacher's main-flow and documented-quality feedback within the same bounded providers/formats. [Dated verification](../../studieplanlegger/VERIFICATION.md) distinguishes proven synthetic failures, implementation checks and final runtime acceptance; earlier counts are not proof of this later blocker.

### S-02/S-05/S-06: recognized TP CSV repair — 2026-10-23

The [approved repair](../../studieplanlegger/VERIFICATION.md#recognized-tp-csv-main-flow-repair--2026-10-23) adds bounded acceptance without new adapters:

- **Given** a recognized 30-row TP CSV with partial blank titles and no full course name, **when** the file is selected, reviewed and collectively confirmed, **then** reliable row-level text fallbacks and marked provisional names save without individual name typing or a technical column question.
- **Given** an exact positive subminute interval, **when** previewed, edited, saved and reloaded, **then** its seconds and duration remain exact. Explicit valid points remain nonblocking; missing, invalid, reversed or unmarked equal ends require correction or explicit omission, without invented duration.
- **Given** previous ICS data and CSV import history, **when** importing a new CSV or reimporting after reload, manual edits or undo, **then** source selection, stable IDs, course links, accepted names and deliberate exclusions survive. Failed or stale writes leave the stored envelope unchanged.

The original user's time values remain unverified. Technical synthetic evidence, runtime availability and exact exit codes are recorded separately in [VERIFICATION](../../studieplanlegger/VERIFICATION.md); neither private-file compatibility nor student usability is inferred.

### Calendar correction acceptance — 2026-10-24 (S-02/S-03/S-05/S-06/S-08; Q-01–Q-03)

- **Given** a provisional course or an active event after earlier deletions, **when** deletion succeeds, **then** the receipt identifies that newly deleted item; reload and undo preserve exact relationships. Failed or stale writes show an error without false success or partial storage.
- **Given** HiMolde/NTNU courses including equal codes and an unknown affiliation, **when** compact course choices and an unknown-only bulk choice are confirmed, **then** distinct correct identities survive SQLite persistence, reload, metadata-free reimport, backup/restore and container recreation.
- **Given** equal minute-only source times, **when** the user selects point, correction or omission, **then** the selected content saves atomically with explicit accounting. A point is the user's clarification, has no invented duration/capacity and gains no exam/deadline classification from its title.
- **Given** an earlier time decision, **when** a later file changes timing, **then** a new valid interval is not overridden by an obsolete point; only genuine uncertainty requires a new question. Unchanged timing and title-only changes preserve safe decisions and local edits.
- **Given** invalid and valid ICS components together, **when** previewed and confirmed, **then** invalid dates are not silently shifted, affected omissions are visible, and unrelated valid components remain usable. Existing valid date, timezone, all-day, no-end and supported recurrence behavior is preserved.
- **Given** busy intervals, transparent activities and points selected for export, **when** the actual file is downloaded and reread, **then** TRANSP matches capacity and points have no invented end. Export remains a copy with the existing selection scope.
- **Given** desktop, 390px mobile, larger text and keyboard use, **when** the necessary clarification is completed, **then** confirmation remains reachable, blockers and ready counts are understandable, and focus/selection/open details survive updates.

These are approved acceptance criteria. Dated execution evidence is recorded separately in [VERIFICATION](../../studieplanlegger/VERIFICATION.md). The user's new equal-time report supplies the structural CSV fact; this round does not inspect the original or establish its meaning. Sensor guidance remains unavailable; technical checks are not student testing.
