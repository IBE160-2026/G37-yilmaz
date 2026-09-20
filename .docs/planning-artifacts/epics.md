---
title: Studieplanlegger – epics og stories
status: final
created: 2026-09-06
updated: 2026-09-07
stepsCompleted: [step-01-validate-prerequisites, step-02-design-epics, step-03-create-stories, step-04-final-validation]
inputDocuments:
  - .docs/planning-artifacts/prds/prd-studieplanlegger-2026-09-06/prd.md
  - .docs/planning-artifacts/prds/prd-studieplanlegger-2026-09-06/addendum.md
  - .docs/planning-artifacts/architecture/architecture-studieplanlegger-2026-09-06/ARCHITECTURE-SPINE.md
---

# Studieplanlegger – epics og stories

## Overview

Første versjon er en **nettside** for et individuelt nybegynnerprosjekt i IBE160. Den åpnes i nettleseren, kjøres lokalt og bygges i `studieplanlegger/` under `C:/IBE160/2026`. Ordet «app» i eldre dokumenter betyr her denne nettsiden, ikke en installert mobil- eller skrivebordsapp. Publisering på internett er ikke bestilt og er ikke nødvendig for denne versjonen.

Brukerens siste instruksjon styrer språk og gjennomføring: enkel norsk, dokumenterte valg og spørsmål bare ved viktige mangler. De tre oppgitte dokumentene er grunnlaget; ingen separat UX-kontrakt finnes. Skjerm- og samhandlingsvalgene i arkitekturen brukes. Grunnversjonen er bygget og menneskelig overtatt; 2026-09-07 bestilte brukeren i tillegg ett aktivt neste steg, ett begrunnet hovedforslag med alternativer og separat leveringsstatus. Alle tre inngår nå i scope og samles i epic 3/story 3.1 nedenfor.

Den senere bestillingen av dashboardredesign og fristkalender inngår også i nåværende scope og samles i epic 4/story 4.1. Oppdaterte krav nedenfor gir «Oversikt» som startvisning, hurtigvalg for tid, norsk 24-timersfrist, beregnede tall, tilgjengelige oppgavemenyer og månedskalender/mobilagenda. Den teknisk ferdige 3.1-løsningen og studentens delvise eksempelflyt-observasjon beholdes; de er ikke godkjenning av den nye utformingen.

Story 1.1–2.3 og deres opprinnelige akseptansekriterier nedenfor er historisk byggegrunnlag, ikke full beskrivelse av den utvidede løsningen. Opprinnelig «Planlagt»-tekst i disse seksjonene beskriver oppdelingstidspunktet; faktisk tidligere status er `done` i kilde-storyene og [sprintstatus](../implementation-artifacts/sprint-status.yaml). Endrede regler om forslag, forfalt og levering styres nå av kravoversikten og story 3.1. Gammel menneskelig godkjenning gjelder ikke de nye handlingene.

## Requirements Inventory

### Functional Requirements

- FR-1: Opprett én ufullført oppgave med trimmet, ikke-tom tittel og emne, gyldig lokal dato og klokkeslett samt positivt heltallsestimat. Skjemaet bruker separate dato- og 24-timersfelt (`HH:mm`) som blir samme lagrede `deadlineLocal`; ingen AM/PM. Mangler, ugyldige kalenderverdier, bare mellomrom og ugyldige minutter gir feltfeil uten oppretting eller tap av gyldig inndata.
- FR-2: Rediger eksisterende oppgave uten ny identitet eller duplikat; ugyldig redigering bevarer lagret oppgave. Slett bare valgt oppgave etter bekreftelse; avbryt bevarer den.
- FR-3: Fullfør og angre arbeidsfullføring manuelt. Fullført arbeid utelates fra tidsforslag, også «Klar til levering». Oppgaver med innleveringskrav må bekreftes levert separat. Angre levering før ferdigstatus endres på en levert oppgave; visningsbytte endrer ingen status.
- FR-4: Vis inneværende lokale uke, mandag–søndag, og alle oppgaver uavhengig av tidsfilteret. Store oppgaver blir fortsatt synlige. Merk uferdige og «Klar til levering» som forfalt bare når nå er strengt etter fristen; vanlige fullførte og bekreftet leverte er ikke forfalt. Forfalte oppgaver er tilgjengelige i full oversikt og ukens totalantall, også etter ukeskifte. Test uke-, måneds- og årsskifter.
- FR-5: Velg 15/30/45/60 minutter eller en egendefinert positiv sikker heltallsverdi; 30 er første midlertidige valg og lagres ikke. Bruk aktivt stegestimat når det finnes, ellers hovedestimatet. Finn uferdig arbeid på tvers av alle uker med dette estimatet ≤ tilgjengelige minutter. Sorter på tidligste frist, så opprettingsrekkefølge. Vis ett hovedforslag visuelt skilt fra fristoversikten med konkret handling, riktig merket estimat, oppgave og frist og begrunn den faktiske regelen; tilby øvrige kandidater som alternativer. Tomt resultat tilbyr endret tid eller alle oppgaver for et mindre steg. Ingen automatisk oppdeling/kombinasjon eller KI.
- FR-6: Oppretting, redigering, sletting, steg og begge statuser beholdes etter omlasting/gjenåpning. Bevar gamle oppgaver med samme nøkkel/skjema og uten oppstartsskriving; manglende nye felt betyr intet steg/false/false, aldri levering fra gammel fullføring. Rapporter lagringsfeil uten falsk suksess; uleselige data må ikke overskrives med tom liste.
- FR-7: Maksimalt ett valgfritt aktivt neste steg med trimmet beskrivelse og eget positivt sikkert heltallsestimat. Legg til, rediger, fjern og marker gjort; fullføring/fjerning tømmer steget uten historikk, hovedstatusendring eller reduksjon av hovedestimat. Et nytt steg kan legges til etterpå.
- FR-8: Valgfritt «Krever innlevering» for eksisterende generiske oppgaver. Ferdig arbeid blir «Klar til levering», manuell «Bekreft levert» krever ferdig arbeid, og «Angre levering» beholder ferdigstatus. Angre bekreftet levering før ferdigstatus eller innleveringskrav endres. Vanlige oppgaver fullføres som før.
- FR-9: «Oversikt» er et dashboard med varm bakgrunn/grønn identitet, faktisk beregnede tall for gjenstående denne uken, forfalt og klar til levering, og lenker til relevante lister. Vis inntil tre forfalte og tre kommende uavklarte oppgaver med tilgang til resten. Stabile emnefarger supplerer navn/status; ingen oppdiktede oppgaver/statistikker. Relevant hovedhandling fremheves og sekundære handlinger samles i tilgjengelige menyer med kort tilbakemelding.
- FR-10: Lokal fristkalender med mandag først, måned/år, dagens/valgt dato, forrige/neste måned og «I dag». Velg dag for alle dens oppgaver med emne, 24-timersklokke, status og redigeringsmulighet. Flere/tomme datoer og alle statuser håndteres uavhengig av tidsfilteret. Mobil starter med agenda for valgt måneds frister; bytte til måned er tilgjengelig. Ingen kalenderhandling skriver eller endrer oppgavedata.

### NonFunctional Requirements

- NFR-1: Norsk grensesnitt med 24-timersklokke, varm grønn identitet, merkede felt, tastaturbetjening og synlig fokus. Farge supplerer tekst. Hurtigvalg, kalender, oppgavemenyer, skjema og viktig tekst fungerer uten horisontal sideskrolling ved 360 og 1280 px. Manuell gjennomgang kreves.
- NFR-2: Oppgaveinnhold forblir i nettleseren; ingen konto, analyse, sporing eller ekstern overføring. Forklar manglende synkronisering og risikoen ved å slette nettleserdata.
- NFR-3: Brukerinnhold vises som tekst, aldri kjørbar HTML. Test HTML-lignende tittel og at 100 oppgaver fortsatt kan håndteres.

### Additional Requirements

- AD-1: Vanlig JavaScript med ES-moduler, HTML/CSS og Vite. Kontroller eier lagret tilstand; UI sender handlinger, rene regler håndterer validering og utvalg, lagringsadapter håndterer localStorage. Ett aktivt neste steg inngår i oppgaven. Ingen router, backend, innlogging, synkronisering, Canvas, påminnelser, generelle deloppgavelister, steghistorikk, tidsmåling, avansert planlegging eller KI-anbefalingsmotor.
- AD-2: Nøkkel `studieplanlegger:v1`; JSON `{schemaVersion: 1, tasks: [...]}`. Oppgavefelt: unik ikke-tom `id`, trimmet `title` og `course`, gyldig `deadlineLocal` i `YYYY-MM-DDTHH:mm`, positivt sikkert heltall `estimatedMinutes`, boolsk `completed`. Valgfrie nye felt: `nextStep` med trimmet `description` og positivt sikkert heltall `estimatedMinutes`, `requiresSubmission` og `submitted` som boolske. Manglende/null steg betyr intet steg, manglende flagg betyr false. Gamle objekter beholdes uten automatisk migreringsskriving. `submitted: true` krever `requiresSubmission` og `completed`. Oppretting legger til sist; alle andre endringer bevarer ID og plass. Tilgjengelige minutter/åpne alternativer er midlertidig UI-tilstand.
- AD-3: Manglende nøkkel betyr tom liste. Lesefeil, ugyldig JSON, skjema, felt eller dupliserte ID-er viser feil og sperrer endringer; bevar rådata og tilby nytt leseforsøk, ingen automatisk nullstilling. Ved endring: valider kandidat, skriv hele listen én gang, oppdater først så tilstand og suksessmelding. Skrivefeil bevarer tidligere tilstand og utkast med mulighet for nytt forsøk. Ingen skriving ved render, oppstart eller avbrutt sletting. Opplys om én redigerende fane om gangen.
- AD-4: Lokale kalenderverdier uten UTC-konvertering. Valider ekte dato/klokkeslett og avvis ikke-eksisterende lokal tid ved sommertid; gjentatte minutter beholder veggklokkeetiketten. Uke er mandag 00:00 inklusiv til neste mandag 00:00 eksklusiv. Injiser `now` i regler. Oppdater visning ved handlinger, sidefokus og minst hvert sekund mens siden er synlig, uten å miste fokus eller utkast. Tidssoneendring beholder innskrevne klokkeverdier. Ikke muter kildelisten ved sortering/filtrering.
- AD-5: Følg skjermplanen nedenfor. Ingen eksterne ressurser under vanlig bruk; rendrer brukerinnhold via tekstnoder eller `textContent`.
- AD-6: Personlig bruk på `http://localhost:5173` med strict port, tester på `http://localhost:5174` med isolert nettleserprofil. Ikke åpne HTML-filen direkte. Registrer faktiske kommandoer, resultater, feil og rettinger.
- AD-7: Kalender og dashboard avledes fra eksisterende oppgaver uten nye felt/nøkler/avhengigheter. Kalenderens måned/dato/modus er midlertidig; mandag-først-rutenett har 42 dager inklusive nabodager. Agenda viser alle frister i valgt måned og er første modus ved høyst 700 px. Piltaster flytter dag/uke, Home/End til mandag/søndag med én dag i Tab-rekken. Kalenderen bevarer valgt dato gjennom klokketikk/visningsbytte og sender redigering til eksisterende kontroller.
- Første story oppretter Vite-prosjektet i `studieplanlegger/`, lokal kjøring og testoppsett. Teknisk dokumentert utgangspunkt: Node 24 LTS, create-vite 9.2.0 vanilla, Vite 8.2.2, Vitest 5.0.0 og Playwright 1.63.0 med Chromium. Byggeren må kontrollere faktisk tilgjengelighet og kompatibilitet, låse eksakte installerte versjoner og beholde `package-lock.json`; denne planen bekrefter ikke installasjon.
- Struktur: `index.html`, `src/main.js`, `src/ui.js`, `src/tasks.js`, `src/storage.js`, `src/style.css`, `tests/unit/` og `tests/e2e/`. Lag modulene når funksjonen trenger dem, ikke tom abstraksjon for fremtidige behov.
- Planlagte kommandoer fra nettsidemappen: `npm.cmd ci`, `npm.cmd run dev`, `npm.cmd test`, `npm.cmd run test:e2e`, `npm.cmd run build`. Vitest oppdager bare enhetstester; Playwright bare nettlesertester.
- Måneden med egne studieoppgaver begynner først når nettsiden er brukbar. Faktisk start/slutt og manuell logg over glemte frister, organiseringsarbeid og byrden ved tidsestimater holdes atskilt fra teknisk godkjenning. Målet er null glemte frister, uten at tungvint bruk eller oppgitt bruk skjules. Bevar studentvalg, KI-bidrag og kvalitetssikring til refleksjon.

### UX Design Requirements

Ingen separat UX-fil; konkrete valg fra arkitekturens AD-5 og skjermplan:

- UX-DR1: Én side med «Studieplanlegger», «Ny oppgave», samme inline-skjema for oppretting/redigering, merkede felt, separat dato og `HH:mm`, «Lagre», «Avbryt» og feil ved feltene. Lagringsformatet er fortsatt lokalt med minuttpresisjon.
- UX-DR2: «Oversikt» er startvisning, med «Denne uken», «Alle oppgaver» og «Hva kan jeg gjøre nå?». Hurtig15/30/45/60 og egendefinert tid/«Vis forslag» viser ett forklart hovedforslag med «Åpne neste steg»/«Åpne oppgave» og alternativer. Tomtilstanden tilbyr endrede minutter og alle oppgaver for et mindre steg. Kalender og fristoppsummering er visuelt skilt fra anbefalt handling.
- UX-DR3: Felles oppgavekort viser tittel, emne, frist, hovedestimat, valgfritt aktivt steg og tekststatus. Relevant hovedhandling fremheves; «Flere handlinger» samler redigering/sletting/fullføring, steg og angre. Innleveringsoppgaver beholder «Ferdig med arbeidet», «Klar til levering» og «Levert (bekreftet manuelt)» med separate handlinger. Status uttrykkes med tekst, ikke bare farge. Stabile emnefarger brukes konsekvent i kort og kalender.
- UX-DR4: Bekreft sletting med avbryt (nettleserens egen dialog er tilstrekkelig). Gjenopprett relevant fokus etter lagring, avbrudd og sletting. Klokkeoppdateringer beholder fokus og utkast.
- UX-DR5: Én kolonne på liten skjerm, hovedinnhold og kalender side om side på stor. Mobilagenda med månedsbytte. Kort tilgjengelig lese-/lagringsmelding, ny-lesing ved lesefeil og «Hjelp og lokal lagring» med forklaring av lokal lagring og én fane.

### FR Coverage Map

| Krav | Epic | Stories |
| --- | --- | --- |
| FR-1 | 1 og 3 | 1.2; 3.1 valgfritt innleveringskrav |
| FR-2 | 1 og 3 | 1.3; 3.1 nye felt og statussperrer |
| FR-3 | 1 og 3 | 1.4; 3.1 arbeidsfullføring skilt fra levering |
| FR-4 | 2 og 3 | 2.1; 3.1 klar-til-levering og filteruavhengig fristoversikt |
| FR-5 | 2 og 3 | 2.2; 3.1 stegestimat, hovedforslag og alternativer |
| FR-6 | 1 og 3 | 1.2–1.4; 2.3 samlet sjekk; 3.1 eldre/nye valgfrie felt og statuser |
| FR-7 | 3 | 3.1 ett aktivt neste steg og uavhengig livsløp |
| FR-8 | 3 | 3.1 manuell levering og angre |
| FR-9 | 4 | 4.1 dashboard, virkelige tall, oppgavehandlinger og visuell identitet |
| FR-10 | 4 | 4.1 måned/dag/agenda og redigering fra kalenderen |
| FR-1–8 | 4 | 4.1 beholder alle eksisterende regler/lagring; utvider dato-/tidsinntasting og handlingsgrensesnitt |
| NFR-1–3 | 4 | 4.1 mobil/tastatur, tekst/farge, ingen fiktive data/ekstern overføring og beholdte regresjoner |
| NFR-1 | 1, 2 og 3 | 1.1–2.2 løpende; 2.3 tidligere manuell kontroll; 3.1 nye felt, fokus og mobil/tastatur |
| NFR-2 | 1, 2 og 3 | 1.1–1.2; 2.3 samlet sjekk; 3.1 lokal lagring uten overføring |
| NFR-3 | 1, 2 og 3 | 1.2 trygg tekst; 2.3 med 100 oppgaver; 3.1 bokstavelig stegtekst og regresjoner |
| AD-1–2 | 1, 2 og 3 | 1.1 struktur, 1.2 kontrakt, 3.1 valgfrie felt; beholdes i alle stories |
| AD-3 | 1 og 3 | 1.2 grunnmur, 1.3–1.4 endringer; 3.1 steg-/leveringsskriving med feil og nytt forsøk |
| AD-4 | 1, 2 og 3 | 1.2 datovalidering/sortering, 2.1 klokke/uke, 2.2 filter; 3.1 nye estimat-/forfaltregler |
| AD-5 / UX-DR1–5 | 1, 2 og 3 | 1.1–2.3 grensesnitt og tidligere kontroll; 3.1 nye steg-, leverings- og forslagshandlinger |
| AD-6 | 1, 2 og 3 | 1.1 kjøring/testisolasjon, evidens i hver story, 2.3 tidligere og 3.1 ny samlet kontroll |
| AD-1–7 / UX-DR1–5 | 4 | 4.1 lagringsuavhengig kalender/dashboard, norsk 24-timersklokke, tilgjengelige menyer og ny samlet kontroll |

## Epic List

### Epic 1: Registrere og vedlikeholde studieoppgaver trygt

Studenten kan åpne nettsiden, opprette, rette, slette og fullføre oppgaver og finne igjen lagrede data. Dekker FR-1, FR-2, FR-3 og FR-6. Fire små steg med fungerende grunnoversikt; trenger ikke epic 2 for å brukes.

### Epic 2: Finne ukens frister og en oppgave som passer tiden

Studenten får ukeoversikt, ser forfalte oppgaver og finner arbeid som passer tilgjengelige minutter. Dekker FR-4 og FR-5 samt samlet kontroll av første versjon. Tre steg som bygger på epic 1. Oppgavedata deles med epic 1; det legges bare til avledede visninger, ikke nye datalag. Tidlig erfaring med grunnoversikten kan brukes før disse visningene bygges.

### Epic 3: Velge neste handling og følge opp levering

Studenten kan velge ett konkret neste steg innen tilgjengelig tid, forstå hovedforslaget og velge alternativer, og følge opp ferdig arbeid til manuelt bekreftet levering. Dekker FR-7–8 og utvider FR-1–6 med samme datalagring og kvalitetskrav. Story 3.1 bygger på den ferdige grunnversjonen; generell deloppgaveliste og automatisk levering inngår ikke.

### Epic 4: Tydelig dashboard og lokal fristkalender

Studenten får en varm grønn oversikt med faktiske tall, raske tidsvalg, relevante oppgavehandlinger og en fristkalender med mobilagenda. Dekker FR-9–10 og redesign av eksisterende FR-1–8 uten endret datamodell. Story 4.1 bygger videre på den teknisk ferdige 3.1; den tidligere delvise manuelle observasjonen gjelder ikke den nye utformingen.

Byggerekkefølge: **1.1 → 1.2 → 1.3 → 1.4 → 2.1 → 2.2 → 2.3 → 3.1 → 4.1**. De sju opprinnelige storyene er ferdige, 3.1 er teknisk ferdig med delvis menneskelig observasjon og 4.1 er teknisk ferdig med ny menneskelig gjennomgang åpen. Ingen story krever en senere story. Valgene er laget under brukerens delegasjon; de er ikke særskilt bekreftet i en meny.

## Epic 1: Registrere og vedlikeholde studieoppgaver trygt

Studenten kan bruke en lokal nettside til å vedlikeholde oppgaver uten at mislykket lagring fremstilles som vellykket. FR-1–3 og FR-6; AD-1–3, AD-5–6, NFR-1–3 og UX-DR1/3/4/5 gjelder løpende.

### Story 1.1: Åpne nettsiden lokalt

Som student vil jeg starte Studieplanlegger i nettleseren, slik at jeg har et enkelt, fungerende utgangspunkt for prosjektet.

**Krav:** AD-1, AD-5, AD-6; grunnlag for NFR-1–2. **Avhengigheter:** Ingen. **Status:** Planlagt, ikke bygget.

**Acceptance Criteria:**

1. **Gitt** prosjektroten og ingen eksisterende nettside, **når** oppsettet gjennomføres, **så** opprettes `studieplanlegger/` fra dokumentert vanilla JavaScript Vite-mal, med HTML/CSS, eksakte installerte avhengigheter og `package-lock.json`. **Og** eventuell forskjell fra arkitekturens versjonsutgangspunkt dokumenteres med faktisk årsak og kompatibilitetskontroll.
2. **Gitt** installerte avhengigheter, **når** `npm.cmd run dev` kjøres fra nettsidemappen, **så** åpnes et norsk sideskall med overskriften «Studieplanlegger» på `http://localhost:5173`. **Og** opptatt port gir tydelig oppstartsfeil fremfor adressebytte. Siden har `lang="nb"`, semantisk hovedinnhold, lesbar tekst og forklaring av lokal bruk; ingen uferdige handlingsknapper presenteres som fungerende.
3. **Gitt** testoppsettet, **når** enhetstester og nettlesertester kjøres, **så** bruker Vitest bare `tests/unit/` og Playwright bare `tests/e2e/`; Playwright starter siden på strict port 5174 i isolert profil. **Og** testene bruker ikke personlig lagring på port 5173. Ingen kunstige enhetstester opprettes bare for å få grønn status; manglende domenetester oppgis ærlig frem til 1.2.
4. **Gitt** README i `studieplanlegger/`, **når** studenten følger den, **så** forklares nødvendige installasjoner, `npm.cmd ci`, start, stopp med Ctrl+C, samme adresse/profil hver gang og de tre test-/byggkommandoene på enkel norsk. **Og** produksjonsbygg lager `dist/` uten krav om publisering.

**Planlagt verifikasjon:** Playwright røykprøve åpner siden og finner norsk sidetittel/hovedoverskrift. Kjør produksjonsbygg og kontroller strict-port-feil med en kontrollert opptatt port. Kontroller faktisk lokal åpning og grunnlayout ved 360/1280 px. Dokumenter installerte versjoner, kommandoer og resultater. Ingen av disse kontrollene er kjørt i planleggingen.

### Story 1.2: Opprette oppgaver og beholde dem trygt

Som student vil jeg registrere og finne igjen studieoppgaver, slik at fristene mine ikke forsvinner når jeg lukker nettsiden.

**Krav:** FR-1, FR-6, NFR-1–3, AD-1–3, AD-4 datovalidering/sortering, AD-5–6, UX-DR1/3/5. **Avhengigheter:** 1.1. **Status:** Planlagt.

**Acceptance Criteria:**

1. **Gitt** tilgjengelig lagring, **når** jeg velger «Ny oppgave» og lagrer gyldig tittel, emne, lokal frist med dato/klokkeslett og estimat, **så** vises oppgaven nøyaktig én gang i en enkel «Alle oppgaver»-oversikt med alle verdiene, unik ID og `completed: false`. **Og** tittel/emne trimmes, lagring følger AD-2 og listen sorteres på frist/opprettingsrekkefølge uten å endre lagret rekkefølge. Uke- og tidsvisning tilføyes i epic 2.
2. **Gitt** et åpent skjema, **når** jeg sender manglende felt, bare mellomrom, ugyldig kalenderdato/tid, manglende dato eller klokkeslett, eller tomt/null/negativt/desimalt/usikkert heltall som estimat, **så** vises forståelige feltfeil og ingen oppgave skrives. **Og** gyldig inndata beholdes. Ikke-eksisterende lokal tid ved sommertid avvises, uten UTC-konvertering eller automatisk datoforskyvning.
3. **Gitt** en gyldig kandidat, **når** lagring lykkes, **så** skrives hele JSON-listen én gang før lagret tilstand erstattes og suksess vises. **Når** skriving kaster feil, **så** bevares forrige tilstand, lagret verdi og skjemaets utkast, og meldingen sier at endringen ikke ble lagret. **Og** nytt lagringsforsøk kan lykkes uten duplikat.
4. **Gitt** oppstart, **når** nøkkelen mangler, **så** vises tomtilstand med vei til «Ny oppgave» uten automatisk skriving. **Når** lesing feiler eller lagret JSON/skjema/oppgavefelt/ID-er er ugyldige, **så** vises forståelig feil, endringer sperres og rådata bevares uten nullstilling. **Og** «Prøv igjen» forsøker lesing på nytt og frigir endringer først etter gyldig lesing. Tom feiltilstand fremstilles ikke som at brukeren mangler oppgaver.
5. **Gitt** lagrede oppgaver, **når** siden lastes om og lukkes/gjenåpnes på samme adresse i samme nettleserkontekst, **så** vises de samme oppgavene. **Og** brukerinnhold settes som tekst, alle felt er merket, feil er knyttet til felt, tilbakemeldinger er tilgjengelige for hjelpemidler, og skjema kan betjenes med tastatur og synlig fokus. Forklar lokal lagring, ingen synkronisering, mulig tap ved sletting av nettleserdata og én redigerende fane.

**Planlagt verifikasjon:** Vitest for trimming, obligatoriske felt, kalenderfeil (f.eks. 30. februar), gyldig skuddårsdag, minuttgrenser og `Number.MAX_SAFE_INTEGER`/større verdier, kontrakt, unike ID-er og ikke-muterende sortering. Datoer i Europe/Oslo: avvis `2026-03-29T02:30`, godta gjentatt veggklokkeetikett `2026-10-25T02:30`. Playwright for gyldig/ugyldig innsending, omlasting og gjenåpning, HTML-lignende tittel som bokstavelig tekst, skrivefeil med beholdt utkast og vellykket nytt forsøk. Injiser lesefeil, ugyldig JSON, ukjent schemaVersion, ugyldige felt og dupliserte ID-er; kontroller sperrede endringer og uendret råverdi. Instrumenter skriving for å vise at oppstart/render ikke skriver og vellykket handling skriver én gang. Manuell tastatur-/feltfeilsjekk ved begge bredder.

### Story 1.3: Rette og slette egne oppgaver

Som student vil jeg rette feil og fjerne oppgaver jeg ikke trenger, slik at oversikten stemmer.

**Krav:** FR-2, FR-6, NFR-1, AD-2–3, AD-5, UX-DR1/3/4. **Avhengigheter:** 1.2. **Status:** Planlagt.

**Acceptance Criteria:**

1. **Gitt** en oppgave, **når** jeg velger «Rediger», **så** fylles samme skjema med eksisterende verdier. **Når** gyldige endringer lagres, **så** oppdateres bare valgt oppgave, med samme ID, fullføringsstatus og plass i lagringslisten. **Og** ugyldige endringer gir samme validering som oppretting uten å endre lagret oppgave; «Avbryt» lukker utkast uten skriving.
2. **Gitt** flere oppgaver, **når** jeg velger «Slett», **så** ber nettsiden om bekreftelse. **Når** jeg avbryter, **så** endres ingenting og ingen skriving skjer. **Når** jeg bekrefter og lagring lykkes, **så** fjernes bare valgt ID; siste sletting viser riktig tomtilstand.
3. **Gitt** mislykket skriving under redigering eller bekreftet sletting, **når** feilen oppstår, **så** beholdes gammel oppgave og lagret verdi; redigeringsutkast beholdes, feilmelding vises og handlingen kan forsøkes på nytt. **Og** read-error-sperren fra 1.2 gjelder begge handlinger.
4. **Gitt** tastaturbruk, **når** redigering lagres/avbrytes eller sletting fullføres, **så** flyttes fokus til en relevant eksisterende kontroll uten å forsvinne. **Og** vellykket redigering/sletting beholdes etter omlasting og gjenåpning.

**Planlagt verifikasjon:** Vitest for oppdatering/sletting av riktig ID, beholdt rekkefølge/status og ugyldig redigering. Playwright for retting av alle felt, avbryt redigering, ugyldig redigering, avbryt/bekreft sletting, siste oppgave, gjenåpning og injisert skrivefeil i begge handlinger. Kontroller ingen skriving ved avbrudd, beholdt utkast og vellykket nytt forsøk. Manuell tastatur- og fokusprøve.

### Story 1.4: Fullføre oppgaver og angre

Som student vil jeg markere arbeid som ferdig og kunne angre, slik at oppgavestatusen stemmer med det jeg faktisk har gjort.

**Krav:** FR-3, FR-6, NFR-1, AD-2–3, AD-5, UX-DR3. **Avhengigheter:** 1.3. **Status:** Planlagt.

**Acceptance Criteria:**

1. **Gitt** en ufullført oppgave, **når** jeg markerer fullført og lagring lykkes, **så** endres bare dens boolske status og den forblir synlig med tydelig fullførtmerking som ikke bare bruker farge. **Og** ID og opprettingsrekkefølge beholdes.
2. **Gitt** en fullført oppgave, **når** jeg angrer markeringen, **så** blir den ufullført igjen. **Og** riktig status overlever omlasting og gjenåpning; senere redigering endrer ikke status utilsiktet.
3. **Gitt** skrivefeil ved fullføring eller angre, **når** jeg endrer avkrysningen, **så** beholdes tidligere lagret status også visuelt, med tydelig feil og mulighet for nytt forsøk. **Og** endringer er sperret ved uløst lesefeil.
4. **Gitt** tastaturbruk, **når** jeg betjener statusfeltet, **så** har det forståelig navn og synlig fokus, og fokus beholdes etter handlingen. Tidsfilterets utelatelse av fullførte kontrolleres når filteret finnes i 2.2.

**Planlagt verifikasjon:** Vitest for fullføring/angre og uendrede øvrige felt/rekkefølge. Playwright for begge retninger, redigering av fullført oppgave, gjenåpning, skrivefeil og nytt forsøk uten falsk visuell status. Manuell tastaturprøve. Epic 1 kan nå brukes til grunnleggende oppgavevedlikehold; full versjon og månedsutprøving er ennå ikke erklært klare.

## Epic 2: Finne ukens frister og en oppgave som passer tiden

Studenten kan se kommende og forfalte frister og velge en passende oppgave. FR-4–5, AD-4–6, NFR-1–3 og UX-DR2–5; samlet teknisk kontroll dekker begge epics.

### Story 2.1: Se denne ukens frister og forfalte oppgaver

Som student vil jeg se ukens oppgaver og finne forfalte frister, slik at jeg får oversikt over hva som haster.

**Krav:** FR-4, FR-3 visningsbytte, NFR-1, AD-4–5, UX-DR2–4. **Avhengigheter:** 1.4. **Status:** Planlagt.

**Acceptance Criteria:**

1. **Gitt** en fast lokal nåtid, **når** nettsiden åpnes, **så** er «Denne uken» startvisning og inkluderer frister fra mandag 00:00 til før neste mandag 00:00. **Og** forrige søndag og neste mandag utelates, også over måneds- og årsskifte; fullføringsstatus forblir synlig.
2. **Gitt** oppgaver utenfor uken, **når** jeg velger «Alle oppgaver», **så** er alle tilgjengelige. **Og** alle visninger sorteres på frist og deretter opprettingsrekkefølge uten å mutere kildelisten eller fullføringsstatusen.
3. **Gitt** en ufullført oppgave, **når** nå er strengt senere enn fristen, **så** merkes den «Forfalt». Før og nøyaktig på fristen merkes den ikke forfalt; fullførte merkes aldri forfalt. **Og** ukevisningen viser antall forfalte ufullførte oppgaver på tvers av alle uker og en «Alle oppgaver»-snarvei, slik at gamle frister kan finnes etter ukeskifte.
4. **Gitt** åpen side, **når** jeg utfører en handling, siden får fokus igjen eller tiden passerer mens den er synlig, **så** oppdateres uke og forfaltstatus fra samme klokke, minst hvert sekund mens synlig. **Og** fokus og påbegynt skjema beholdes; klokkeoppdatering skriver aldri til lagring. Ved tidssoneendring beholdes innskrevne veggklokkeverdier.
5. **Gitt** ingen oppgaver i uken, **når** ukevisningen vises, **så** forklares dette og jeg kan opprette eller se alle oppgaver. **Og** visningsknappene kan betjenes med tastatur med synlig/tilgjengelig valgt tilstand.

**Planlagt verifikasjon:** Vitest med injisert `now`: mandag 00:00, søndag 23:59, neste mandag, månedsskiftet rundt 31. august/1. september 2026, årsskiftet 28. desember 2026–3. januar 2027, og før/nøyaktig/etter frist. Test fullførte og tom uke, ikke-mutert kildeliste og beholdt veggklokkeetikett ved endret tidssone. Playwright med styrt klokke for fristpassering, ukeskifte, fokusretur, alle/uke-bytte, gammel forfalt oppgave og fullføring/angre i begge visninger. Kontroller bevart tastaturfokus og utkast gjennom klokketikk, og null lagringsskriving fra oppdateringen.

### Story 2.2: Finne en oppgave som passer tilgjengelig tid

Som student vil jeg oppgi hvor mange minutter jeg har, slik at jeg kan velge en passende ufullført oppgave.

**Krav:** FR-5, FR-3 filtervirkning, NFR-1, AD-2/4/5, UX-DR2–4. **Avhengigheter:** 2.1. **Status:** Planlagt.

**Acceptance Criteria:**

1. **Gitt** «Hva kan jeg gjøre nå?», **når** jeg oppgir 30 minutter og velger «Vis oppgaver», **så** vises ufullførte oppgaver på 20 og 30 minutter, mens 31 minutter og fullførte oppgaver utelates. **Og** utvalget omfatter alle uker, inkludert forfalte, uten å kombinere eller dele oppgaver.
2. **Gitt** flere treff, **når** resultatet vises, **så** kommer tidligste frist først uavhengig av varighet; kl. 12:00 kommer før 23:59 samme dato. **Og** like frister beholder opprettingsrekkefølge også etter redigering, fullføring/angre og gjenåpning.
3. **Gitt** tomt, null, negativt, desimalt eller ikke-sikkert heltall som tilgjengelig tid, **når** jeg sender feltet, **så** vises tydelig feltfeil uten misvisende nytt resultat eller endring av oppgaver. **Og** tilgjengelig tid er midlertidig UI-tilstand og inngår ikke i lagret oppgavedata.
4. **Gitt** ingen passende oppgaver, **når** søket utføres, **så** vises «Ingen oppgaver passer tiden» med mulighet til å endre minutter eller gå til alle oppgaver. **Og** felt, knapp og tilbakemelding fungerer med tastatur.
5. **Gitt** et aktivt tidsfilter, **når** en treffoppgave fullføres og lagringen lykkes, **så** forsvinner den fra treffene og fokus flyttes til relevant kontroll. **Når** fullføring angres i alle oppgaver og jeg går tilbake med samme gyldige tid, **så** er oppgaven kvalifisert igjen. Redigering og sletting oppdaterer treffene; mislykket lagring beholder tidligere oppgave og treff.

**Planlagt verifikasjon:** Vitest for 20/30/31, ugyldige minutter, fullført/ufullført, forfalte og fremtidige uker, frist før varighet, samme-dag-klokkeslett, like frister og ikke-mutert liste. Playwright for hele tidsvalget, tomt resultat og begge utveier, feltfeil, fullføring/angre, redigering/sletting av treff og skrivefeil. Kontroller at lagringskontrakten ikke får et felt for tilgjengelig tid, og at UI beholder minuttvalget ved visningsbytte i samme økt.

### Story 2.3: Kontrollere første versjon og klargjøre egen utprøving

Som student vil jeg vite hva som faktisk virker og hvordan jeg starter egen utprøving, slik at jeg kan bruke nettsiden og dokumentere prosjektet ærlig.

**Krav:** Samlet FR-1–6, NFR-1–3, AD-6 og PRD Validation and success. **Avhengigheter:** 2.2. **Status:** Planlagt. Dette er en avgrenset akseptanseøkt; måneden inngår ikke i storyens varighet.

**Acceptance Criteria:**

1. **Gitt** alle funksjonene i første versjon, **når** samlet kontroll kjøres fra `studieplanlegger/`, **så** registreres faktiske resultater for `npm.cmd test`, `npm.cmd run test:e2e` og `npm.cmd run build`, med dato, miljø, antall tester/feil og relevante feil/rettinger. **Og** relevante tester kjøres igjen etter retting; ingen ukjørte eller blokkerte tester telles som bestått.
2. **Gitt** nettsiden i nettleseren, **når** den manuelle gjennomgangen utføres ved 360 og 1280 px, **så** registreres oppretting, redigering, avbrutt/bekreftet sletting, fullføring/angre, uke/alle, tidsfilter, tomme resultater og lagring etter omlasting og lukking/gjenåpning. **Og** essensielle kontroller og tekst er brukbare uten horisontal sideskrolling; tastaturrekkefølge, merkede felt, synlig fokus, fokus etter handlinger og uavbrutt utkast ved klokketikk kontrolleres.
3. **Gitt** feiltilstander, **når** lesing/skriving feiler eller data er uleselige, **så** bekrefter nettlesertester riktig bevaring, sperring og nytt forsøk for alle endringstyper. **Og** feilmeldingene vurderes manuelt for forståelig norsk, uten at personlige data ødelegges under testen.
4. **Gitt** en isolert testprofil med 100 oppgaver, **når** jeg bytter visninger, filtrerer, redigerer, sletter og fullfører, **så** forblir kontrollene operative og resultatene korrekte. **Og** HTML-lignende tekst utføres ikke, og kontroll av kildekode og nettleserens nettverksforespørsler viser at brukerhandlinger ikke sender oppgavedata ut eller bruker eksterne runtime-ressurser, analyse eller sporing. Lokale utviklingsforespørsler vurderes separat fra oppgavedata.
5. **Gitt** registrerte resultater, **når** teknisk status oppdateres, **så** står gjenværende feil og eventuelle manglende manuelle kontroller uttrykkelig; storyen blir ikke ferdig med uløste akseptansefeil. **Og** det finnes en enkel lokal oversikt over studentvalg, KI-bidrag og utført kvalitetssikring, uten ny funksjon i nettsiden.
6. **Gitt** at nettsiden er brukbar og tekniske/manuelle krav er oppfylt, **når** Elias faktisk begynner å bruke egne studieoppgaver, **så** noteres virkelig startdato og planlagt sluttdato én kalendermåned senere i en enkel manuell logg. **Og** loggen har dato, eventuell glemt frist, opplevd organiseringsarbeid og hvor tungvint tidsestimeringen er. Hvis bruk ikke har startet, står «Ikke startet» med tom dato; ingen dato settes ved ferdig planlegging. Mål: null frister oversett fordi oppgaven ble glemt, med egen vurdering av brukervennlighet og eventuell oppgitt bruk.

**Planlagt verifikasjon:** Utfør sjekkene ovenfor og lag faktisk evidens i `.docs/implementation-artifacts/` under bygging. En tom månedslogg er klargjøring, ikke gjennomført utprøving. Manglende manuell tilgang må oppgis og overleveres til Elias, ikke erstattes av antatt godkjenning. Fullført teknisk story krever ikke at måneden er ferdig.

## Epic 3: Velge neste handling og følge opp levering

Brukerbestilt utvidelse 2026-09-07 av eksisterende nettside. Alle tre funksjonene er nåværende scope. FR-1–8, AD-1–6 og NFR-1–3 gjelder. Den opprinnelige overtakelsen beholdes som historikk. Studenten har meldt at den nye eksempelflyten er prøvd og sendt to skjermbilder; full menneskelig kontrolliste er fortsatt ikke bekreftet.

### Story 3.1: Neste steg, hovedforslag og levering

Som student vil jeg velge én konkret handling som passer tiden min og skille ferdig arbeid fra bekreftet levering, slik at det blir lettere å komme i gang og holde oversikt over gjenstående innlevering.

**Krav:** FR-1–8, NFR-1–3, AD-1–6. **Avhengigheter:** eksisterende 1.1–2.3. **Status:** Teknisk ferdig og verifisert; studenten har meldt at eksempelflyten er prøvd. Full menneskelig kontrolliste er ikke bekreftet, derfor review.

**Acceptance Criteria:**

1. **Gitt** en oppgave, **når** jeg legger til, redigerer, fjerner eller markerer neste steg gjort, **så** finnes maksimalt ett aktivt steg med kort beskrivelse og eget positivt sikkert heltallsestimat i minutter. **Og** fullføring/fjerning tømmer steget uten historikk, slik at et nytt kan legges til, uten å endre hovedoppgavens ID, rekkefølge, estimat, fullføring eller levering. Tom beskrivelse og ugyldige minutter gir feltfeil med beholdt utkast.
2. **Gitt** tilgjengelig tid, **når** forslag beregnes, **så** brukes aktivt stegestimat når det finnes, ellers hovedestimatet; bare uferdig arbeid som passer tas med på tvers av alle uker. **Og** frist sorteres stigende med stabil opprettingsrekkefølge ved lik frist. En 240-minuttersoppgave med 20-minutterssteg passer 30 minutter; en 20-minuttersoppgave med aktivt 31-minutterssteg passer ikke.
3. **Gitt** flere treff, **når** resultatet vises, **så** presenteres ett tydelig hovedforslag og en kontroll for å vise/skjule de øvrige alternativene i samme fristrekkefølge. **Og** konkret handling, riktig estimat, tilhørende oppgave og frist vises med faktisk begrunnelse: passer tiden og nærmest frist blant kandidatene. Stegestimat merkes uttrykkelig og fremstilles ikke som tid til hele oppgaven.
4. **Gitt** ingen treff, **når** resultatet vises, **så** kan jeg endre minutter eller åpne alle oppgaver og legge til et mindre neste steg. **Og** store oppgaver og oppgaver med nær eller passert frist finnes fortsatt i relevant uke-/alleoversikt, uavhengig av tidsfilteret.
5. **Gitt** «Krever innlevering», **når** arbeidet fullføres, **så** står «Klar til levering», oppgaven forblir i relevant fristoversikt/forfaltantall og utelates fra arbeidsforslag. **Når** jeg bekrefter levering manuelt, **så** står «Levert (bekreftet manuelt)». **Når** jeg angrer levering, **så** beholdes ferdig arbeid og «Klar til levering» gjenopprettes. Levering kan ikke bekreftes før arbeidet er ferdig eller for en vanlig oppgave. Bekreftet levering må angres før arbeidsfullføring eller innleveringskrav kan endres. Vanlige oppgaver beholder fullføring/angre uten leveringskontroller.
6. **Gitt** eldre og nye lagrede oppgaver, **når** siden lastes, endres og gjenåpnes, **så** beholdes oppgaver, ID-er, rekkefølge og alle gyldige felt i samme nøkkel/skjema. **Og** manglende nye felt betyr intet aktivt steg, intet innleveringskrav og ikke levert; gammel fullføring tolkes aldri som levering. Nye felt valideres når de finnes. Ingen oppstartsskriving eller automatisk nullstilling forekommer.
7. **Gitt** validerings-/lese-/skrivefeil eller tastaturbruk ved 360/1280 px, **når** nye handlinger utføres, **så** bevares lagrede data og gyldige utkast ved feil, sperrer dekker alle endringer, og et nytt forsøk kan lykkes. **Og** felt/navn, synlig fokus, alternativer, feilmeldinger og relevant fokus etter at forslag forsvinner fungerer uten horisontal sideskrolling. Klokkeoppdateringer bevarer utkast/fokus.
8. **Gitt** fullført implementering, **når** verifisering og dokumentasjon ferdigstilles, **så** registreres faktiske resultater fra tilgjengelige enhetstester, nettlesertester, bygg og eventuell lint/typekontroll. **Og** brief, krav, arkitektur, funksjonsbeskrivelse, tester og prosjektstatus samsvarer med alle tre funksjoner som nåværende scope; forventede brukereffekter og ukjørte menneskelige kontroller markeres uttrykkelig uten å omskrive eldre testbevis.

**Planlagt verifikasjon:** Eksisterende Vitest-/Playwright-opplegg med nye regresjoner for stegestimatets forrang, fristsortering, gamle/nye data, statusskille, skrivefeil og alle UI-handlinger. Kjør eksisterende tester og produksjonsbygg. Dokumenter tilgjengeligheten av lint/typekontroll og eventuelle blokkerte kontroller. Se [spesifikasjonen](../implementation-artifacts/spec-study-actions.md), [evidensen](../implementation-artifacts/study-actions-evidence.md) og [ny menneskelig kontrolliste](../implementation-artifacts/study-actions-handover-check.md).


## Faktisk evidens

Sluttkontroll 2026-09-07: 196/196 enhetstester, 64/64 nettlesertester, syntakskontroll av 19 JavaScript-filer og produksjonsbygg bestått. Alle tidligere tester består. Prosjektet har ingen egen lint/typekontroll. Seks nye skjermbilder ved 360/1280 px er inspisert av testagenten. Studenten har senere meldt «Jeg har gjort det» til den korte eksempelflyten og sendt to skjermbilder. Dette registreres som delvis manuell observasjon; hele kontrollisten, lagring, tastatur og faktiske leverings-/angrehandlinger er ikke dermed særskilt bekreftet. Se [evidensen](../implementation-artifacts/study-actions-evidence.md). Ingen nye automatiserte tester er kjørt ved denne statusoppdateringen. Månedsutprøving er fortsatt **Ikke startet** med tomme datoer.

## Epic 4: Tydelig dashboard og lokal fristkalender

Ny brukerbestilt videreutvikling av eksisterende nettsted. FR-1–10, NFR-1–3 og AD-1–7 gjelder; ingen endring av oppgavedata, lagringsversjon eller avhengigheter. Tidligere menneskelig observasjon er historisk og gjelder ikke redesignet.

### Story 4.1: Oversiktlig dashboard og fristkalender

Som student vil jeg få en rolig, tydelig oversikt over studiearbeidet og se frister i en kalender, slik at jeg lettere finner en konkret handling og holder oversikt over innleveringene.

**Krav:** FR-1–10, NFR-1–3, AD-1–7. **Avhengigheter:** den teknisk ferdige løsningen fra 3.1; brukerens nye bestilling autoriserer videre arbeid uten å forutsette full tidligere menneskelig godkjenning. **Status:** Teknisk ferdig og verifisert; ny menneskelig gjennomgang er ikke meldt, derfor review.

**Acceptance Criteria:**

1. **Gitt** lagrede oppgaver eller en tom liste, **når** nettsiden åpnes, **så** vises et oversiktlig dashboard med varm bakgrunn, grønn identitet, tydelig hierarki og faktiske beregnede tall. **Og** ingen oppdiktede oppgaver, statistikker, aktivitetsserier eller fremdriftsdata vises. Emner får stabile visuelle farger, men navn/status er forståelige uten farge.
2. **Gitt** «Hva kan jeg gjøre nå?», **når** jeg velger 15, 30, 45 eller 60 minutter eller oppgir en egendefinert tid, **så** brukes den eksisterende regelen: aktivt stegestimat før hovedestimat, bare uferdig arbeid som passer, nærmeste frist og stabil opprettingsrekkefølge. **Og** ett hovedforslag med konkret handling, tydelig stegestimat og faktisk begrunnelse skilles visuelt fra alternativer og fristoversikt. Tomtilstandene beholder nyttige veier videre.
3. **Gitt** kalenderen, **når** jeg viser en måned, **så** starter uken mandag og riktig lokal måned/år, ukedager, dagens dato og valgt dato fremgår. **Og** forrige/neste måned og «I dag» virker over måneds-/årsskifter uten å endre oppgaver, frister eller lagring.
4. **Gitt** frister på en dato, **når** datoen velges, **så** vises dagens oppgaver i fristrekkefølge med tittel, emne, lokalt klokkeslett og korrekt status, og jeg kan åpne oppgaven for redigering. **Og** flere oppgaver på samme dag, tom dag, gamle frister, «Klar til levering», levert og fullført håndteres. Kalenderen bruker samme oppgaver som øvrige visninger og påvirkes ikke av tidsfilteret.
5. **Gitt** en smal mobilskjerm, **når** kalenderen åpnes, **så** er agenda den innledende visningen, med mulighet til å bytte til månedskalender. **Og** både mobil og større skjerm kan brukes uten horisontal sideskrolling; innhold og nødvendige handlinger forblir tilgjengelige.
6. **Gitt** oppretting, redigering eller en fristvisning, **når** dato og klokkeslett skrives eller leses, **så** brukes norsk datofremstilling og 24-timersklokke uten AM/PM. **Og** skjemaet har dato og et uttrykkelig `HH:mm`-felt, mens lagret `deadlineLocal` fortsatt er `YYYY-MM-DDTHH:mm`; ugyldig/manglende tid og ikke-eksisterende lokal tid avvises uten å endre lagret oppgave.
7. **Gitt** tastaturbruk, **når** jeg navigerer hurtigvalg, kalender/datoer, oppgavemenyer, skjemaer og status-/steghandlinger, **så** har kontrollene forståelige navn, synlig fokus og korrekt valgt/åpen tilstand. **Og** Escape lukker oppgavemenyen, fokus vender relevant tilbake, og klokkeoppdatering eller mislykket lagring mister ikke utkast/fokus. Tilbakemeldinger er korte, forståelige og tilgjengelige.
8. **Gitt** eldre og nyere lagrede oppgaver, **når** siden åpnes, redigeres og gjenåpnes etter redesignet, **så** beholdes ID-er, rekkefølge, estimater, aktivt neste steg og separate ferdig-/levertstatuser. **Og** nøkkel/skjema 1, kandidatvalidering før én skriving, lesefeilsperre og bevart rådata/utkast ved feil gjelder fortsatt. Visnings-, kalender- og minuttvalg er avledet/midlertidig tilstand; ingen ny datamodell eller avhengighet innføres.
9. **Gitt** ferdig implementering, **når** kontroll og dokumentasjon fullføres, **så** registreres faktiske enhets-/nettlesertester, syntaks, bygg og eventuell manglende lint/typekontroll. **Og** kalendergrenser, samme dato/flere frister, statusvisning, 24-timersformat, hurtigvalg, skjema-/menyfokus, mobil og eksisterende regresjoner kontrolleres. Tidligere delvis menneskelig observasjon av 3.1 bevares som historikk, og ingen ny menneskelig godkjenning eller brukereffekt antas.

**Planlagt verifikasjon:** Eksisterende Vitest og Playwright utvides for ren lokal kalenderlogikk, norske datoer/24-timersformat, avledede status-/emnefarger og dashboardtall, kalendernavigasjon/valg/redigering, mobilagenda, hurtigvalg og tilgjengelige menyer. Gamle kontrollscenarioer tilpasses endret grensesnitt uten å miste atferdskrav. Faktiske resultater i [evidensen](../implementation-artifacts/ui-calendar-evidence.md), kontrakt i [spesifikasjonen](../implementation-artifacts/spec-ui-calendar.md) og ny menneskelig [prøveliste](../implementation-artifacts/ui-calendar-handover-check.md).


## Faktisk evidens

Sluttkontroll 2026-09-07: 230/230 enhetstester, én full nettleserkjøring med 75/75 tester, syntakskontroll av 21 JavaScript-filer og produksjonsbygg bestått. Etter siste CSS-retting og supplert 45/60-/Escape-dekning besto 14/14 berørte nettlesertester; disse er et delsett av 75. Endelig bygg besto på 153 ms. Visuell kontroll omfatter stor skjerm, mobil, smalt skjema og lange titler/emnenavn, med 15 bevarte skjermbilder. Ingen egne lint-/typekontrollskript finnes. Se [evidensen](../implementation-artifacts/ui-calendar-evidence.md). Ny fysisk studentgjennomgang er ikke registrert, og månedsutprøvingen er **Ikke startet** med tomme datoer.

## Dokumentkontroll og overlevering

Oppdatert 2026-09-07: kravoversikten gjelder FR-1–10 og AD-1–7, inklusive både 3.1-funksjonene og redesign/kalender i epic 4/story 4.1. [Gjeldende spesifikasjon](../implementation-artifacts/spec-ui-calendar.md) og [kalenderevidensen](../implementation-artifacts/ui-calendar-evidence.md) følger den nye leveransen. Opprinnelige story-/epicstatuser, 3.1-resultater og delvis menneskelig observasjon beholdes; den nye leveransen får egen status. Teksten nedenfor bevarer planleggingskontrollen fra 2026-09-06 og er ikke gjeldende fremdriftsrapport.

Kontrollert 2026-09-06: Seks FR-er, tre NFR-er, AD-1–6 og UX-DR1–5 er knyttet til akseptansekriterier og planlagt verifikasjon. To epics, sju stories, ingen fremoveravhengigheter. Første story oppretter bare nødvendig nettside-/testoppsett. Data og regler tilføyes med første registreringsfunksjon. Oppdeling i grunnleggende vedlikehold og avledede visninger gir et nyttig stoppunkt for erfaring etter epic 1, selv om noen UI-/kontrollerfiler deles.

Dette er dokumentkontroll, ikke gjennomførte nettsidetester, produksjonsbygg, sprintklarering eller brukermåned. Alle stories er fortsatt planlagt. Ingen viktig beslutning mangler for neste planleggingssteg. Installasjonsversjonene må verifiseres under oppsett.

`uv` kunne ikke starte («Filen er ikke tilordnet noe program for denne operasjonen»). Tilpasning ble derfor lest manuelt etter skillens reserveprosedyre: standard workflow har ingen ekstra aktiveringssteg, vedvarende fakta eller on_complete-handling, og ingen tilpasningsfiler for denne skillen ble funnet. Brukerens beskjed om bare å spørre ved viktige mangler ble fulgt fremfor rutinemessige bekreftelsesmenyer. Ingen særskilt menybekreftelse eller instruktørgodkjenning påstås.

Samlet krav- og storygrunnlag er denne filen. Separate storyfiler i `stories/` er arbeidsgrunnlag med samme akseptansekriterier ved overlevering; ved senere kravendringer må berørte kriterier samordnes her og i storyfilen. Faktisk fremdrift/evidens føres under bygging og i sprintstatus når den opprettes.

Historisk neste steg var `bmad-sprint-planning`; dette er utført. Bruk de leverte spesifikasjonene og verifikasjonene, og ikke gjenstart oppsett eller planlegging av den allerede bygde nettsiden.
