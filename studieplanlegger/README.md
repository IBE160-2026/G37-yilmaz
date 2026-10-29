# Ajour

Ajour knytter **oppgave → valgfritt arbeidssteg → godkjent studieøkt → utfall → justering** sammen med lokale regler. Bare oppgavetittel er obligatorisk; registrerte opplysninger og valgfrie importer gir grunnlaget for forslag som studenten kontrollerer før lagring. Appen bruker ingen generativ KI under kjøring.

**Ajour-oppdatering, 2026-10-26:** Ordmerket er **ajour**, med «Kom ajour.» og «Planer endrer seg. Det er helt greit.». Oversikten prioriterer neste handling og korte utdrag med vei videre til komplette visninger. De lokale SVG-illustrasjonene er gjenskapt med de to leverte PNG-referansene som grunnlag; en større designpakke var ikke tilgjengelig. Eksisterende Manrope og fontlisens beholdes. [Tidligere UI- og personvernkontroll](VERIFICATION.md#gjeldende-lokal-oppfølging--2026-10-26) skiller oppfølgingens resultater fra den historiske Ajour-runden 25. oktober og publiseringen `9d3a169` før Ajour.

Navneendringen krever ingen datamigrering. Mappen `studieplanlegger`, eksisterende lagrings-/backupformat, miljøvariabler og Docker-tjenesten `studieplan` med volumet `studieplan-data` beholder navnene sine. Bruk oppstartskommandoene nedenfor som før.

**Farger og utseende, 2026-10-26:** Sol-/måneknappen ved logoen bytter mellom lyst og mørkt. **Innstillinger → Utseende → System / Lyst / Mørkt** velger om appen følger systemet eller et fast tema. Første bruk følger systemet, også senere systemendringer. Knappen lagrer det motsatte av temaet som vises. Byttet beholder åpne dialoger, utkast og kalenderposisjon.

Tolv samordnede emnefarger følger emnets stabile ID, også når to læresteder bruker samme kode. Ledige plasser brukes før gjenbruk; mer enn tolv emner gir forutsigbar gjenbruk. Navn, kode, aktivitetstype og status står fortsatt i tekst. Vanlig sletting/Angre beholder fargen. Hvis en slettet fargeplass i mellomtiden er tatt av et annet emne, flyttes bare den nødvendige kollisjonen til en ledig plass; øvrige tildelinger beholdes. Det samme gjelder når en samling med fargegjenbruk krymper til tolv emner.

Tema (`ajour:appearance:v1`) og ID→fargeplass (`ajour.course-colors.v1`) er separate preferanser i nettleseren, per adresse. De inngår **ikke** i database eller sikkerhetskopi. En gammel backup får gyldige standardfarger når slike preferanser mangler. Ugyldig eller utilgjengelig preferanselagring hindrer ikke bruk, men valget kan da gå tapt ved omlasting. Eksisterende automatisk kodehash er erstattet; appen hadde ingen tidligere brukerbetjent fargevelger eller lagret brukerfarge å migrere. [Ny temakontroll](VERIFICATION.md#emnepalett-og-mørk-modus--2026-10-26) skiller denne endringen fra tidligere Ajour-resultater.

**Samordnet leveransedokumentasjon, 2026-10-26:** Import, kalendergrenser og eksport er beskrevet nedenfor. [Verifikasjonen](VERIFICATION.md) viser nyeste kontrollerte kandidat, personvernrettinger og tekniske begrensninger først; eldre resultater beholder sine datoer. Private originaler og faktisk studentnytte er ikke verifisert.

**Gjeldende avgrensning 2026-10-16:** [Planindeksen](../.docs/planning-artifacts/README.md) knytter brief, PRD og stories til kode/test som en datert rekonstruksjon. V1-import er HiMolde IT 2026–27 med IBE110/IBE430 og enten IBE160 eller IBE102+IBE152, undervisning bare IBE110/IBE430/IBE160 høst 2026, samt NTNU ARK1001/EXPH0100 emnemetadata og emnelenket undervisning høst 2026. Ingen komplett NTNU-program-, eksamens- eller personlig gruppedekning loves. Full nasjonal dekning er visjon. Historiske tekniske kontroller nedenfor er ikke nye kjøringer eller dokumentert studentnytte.

En syntetisk hovedflyt er å opprette oppgaven «Les eksempelkapittel» med bare tittel, eventuelt legge til emne og steg, godkjenne en ledig økt, registrere faktisk arbeid og nytt gjenstående anslag, og godkjenne eller forkaste en justering. Fullført steg, ferdig arbeid og bekreftet innlevering er separate handlinger. Se [løsningsguiden](../.docs/implementation-artifacts/solution-guide.md) og [planen for egenutprøving](../.docs/planning-artifacts/USER-TRIAL-PLAN.md). Etter prosjekteierens beslutning 26. oktober utfører prosjekteieren prøven alene med syntetiske data i et isolert miljø. Status er **planlagt / ikke gjennomført**; automatiske tester fyller ikke ut de manuelle observasjonene.

## Nettleserdrift med Vercel — 2026-10-29

**Produksjon: [Ajour på nett](https://ajour-sooty.vercel.app)**, kontrollert 2026-10-29. Den godkjente driftsutvidelsen bruker det eksisterende prosjektet **`ajour` i Hobby-teamet `ajour1`**. Gjenbruk dette ene gratisprosjektet; opprett ikke separate prosjekter for forhåndsvisning og produksjon. Eieren godkjente offentlig tilgang til eksisterende og framtidige preview-adresser etter kontroll av deployenes kildegrunnlag. Automatisk domenetildeling for `main` er aktivert. [Faktisk publiseringsstatus](VERIFICATION.md#vercel-nettleserutgave--2026-10-29) dokumenterer commit og kjørte kontroller.

Prosjektinnstillingene er repository `IBE160-2026/G37-yilmaz`, rotmappe `studieplanlegger`, rammeverk **Vite**, installasjon `npm ci`, bygg `npm run build`, utmappe `dist` og **Node.js 24.x**. `main` er produksjonsgren. [vercel.json](vercel.json) styrer API-ruting og appens inngang; `api/` eksponerer bare avgrenset, tilstandsløs import. `server/app.js` skal fortsatt bare starte den lokale Node-/SQLite-tjenesten. Nettutgaven krever ingen database, miljøhemmeligheter, konto eller betalt tjeneste.

Konfigurasjonen setter den offentlige runtimeinnstillingen `NODEJS_HELPERS=0`, slik at funksjonen kan kontrollere rå forespørselsbytes før JSON-parsing. Dette er ingen hemmelighet. Handleren støtter også plattformer som allerede har tolket JSON, men rå bytegrense er den foretrukne Vercel-banen. Importfunksjonen har 60 sekunders plattformgrense og avslutter selv forespørselen etter 50 sekunder.

Ved eventuell CLI-publisering kjøres Vercel fra **repository-roten**, siden prosjektets rotmappe allerede er `studieplanlegger`. `.vercelignore` begrenser opplastingen til bygg- og kjøretidskilder; `.gitignore` alene er ikke Vercels opplastingsfilter. Kontroller filutvalget med `vercel deploy --dry --json` før opplasting. Et nytt prosjekt kan få sin aller første deploy klassifisert som produksjon selv med eksplisitt preview. [Vercels egen forklaring](https://github.com/vercel/vercel/pull/17206) og [publisering uten domenetildeling](https://vercel.com/docs/cli/deploying-from-cli#deploying-a-staged-production-build) beskriver dette. Kontroller faktisk `target`, alias og tilgang etter opprettelsen; et grønt bygg eller en ønsket preview-etikett er ikke publiseringsgodkjenning.

Hele planen lagres i den aktuelle nettleserprofilen på den **nøyaktige nettadressen**. Omlasting, gjenåpning og et nytt bygg på samme adresse bruker samme lagring. En annen forhåndsvisningsadresse, localhost, produksjonsadressen, en annen profil eller en annen enhet har separate data. Privat nettlesermodus kan slette planen når vinduet lukkes; sletting av nettstedets data kan også slette planen. Bruk **Innstillinger → Eksporter sikkerhetskopi**, oppbevar filen utenfor kildekoden, og importer den med forhåndsvisning og bekreftelse på den nye adressen. Ingen automatisk enhetssynkronisering eller felles studentdatabase finnes. Tema og emnefargepreferanser er fortsatt separate nettleserpreferanser og inngår ikke i backupformatet.

Gjenkjente kildeintegrasjoner beholdes med sine eksisterende begrensninger. Den offentlige importfunksjonen avviser vilkårlige kalenderverter og utrygge adresser/videresendinger. Last da ned kalenderens `.ics`-fil og velg filimport; feil ved en kilde skal ikke fjerne tidligere data. Importløftet er fortsatt de navngitte HiMolde-/NTNU-prøvene, ikke nasjonal dekning.

Kjør den separate fjernkonfigurasjonen mot en faktisk, offentlig tilgjengelig forhåndsvisnings- eller produksjonsadresse. Den starter ingen lokal appserver og bruker egne syntetiske profiler. Sett adressen til det konkrete prosjektets kontrollerte URL:

```powershell
$env:AJOUR_REMOTE_URL = 'https://<faktisk-forhaandsvisningsadresse>'
npm.cmd run test:e2e:remote
$env:RUN_LIVE_TEACHING = '1'
npm.cmd run test:e2e:remote:live
```

Standardutvalget kontrollerer hovedflyt, lagring, direkte innlasting og injiserte feil, og tar tretti skjermbilder fordelt på fem visninger, to temaer og tre bredder. Bildene må åpnes og vurderes; genererte PNG-filer er ikke automatisk visuell godkjenning. **Kjør også `test:e2e:remote:persistence` nedenfor:** dette separate prosjektet kontrollerer UI-opprettet tilstand, gjenåpning, adskilte profiler, sikkerhetskopi/gjenoppretting og gyldig ICS, med ny verifiseringsfase etter publisering på samme adresse. Begge kommandoene kreves for komplett fjernkontroll. Live-kildetransport rapporteres separat. Lokale tester eller emulering er ikke Vercel-evidens. Behold kontroll med `npm.cmd run test:e2e:database` for lokal Node-/SQLite-drift.

For å kontrollere gjenåpning og samme-adresse-persistens bruker du en ny prøve-ID. Testen oppretter selv en syntetisk Chromium-profil under ignorerte `artifacts/remote-persistence/`; angi aldri en personlig nettleserprofil. Før ny publisering:

```powershell
$env:AJOUR_REMOTE_PROFILE = 'preview-20261029'
$env:AJOUR_REMOTE_PHASE = 'create'
$env:AJOUR_REMOTE_DEPLOYMENT = '<kontrollert-forrige-deploy-eller-commit>'
npm.cmd run test:e2e:remote:persistence
```

Etter en faktisk ny publisering på **samme** `AJOUR_REMOTE_URL` og med samme prøve-ID:

```powershell
$env:AJOUR_REMOTE_PHASE = 'verify'
$env:AJOUR_REMOTE_DEPLOYMENT = '<kontrollert-ny-deploy-eller-commit>'
npm.cmd run test:e2e:remote:persistence
```

Prøven sammenligner lagrede opplysninger etter ny nettleserstart. Deployetiketten er bare en referanse; selve publiseringen må dokumenteres separat. Produksjon har en annen adresse og krever sin egen prøve-ID og tilsvarende kontroll.

## Import files and calendar links

Open **Mine emner → Importer**, choose a file or **Fra kalenderlenke**, and select **Vis forhåndsvisning**. Check the selected counts, dates and warnings, make any necessary clarifications, then select **Importer valgte** for one atomic save. The receipt shows saved and omitted counts and offers **Åpne kalenderen** and **Angre importen** when the import changed stored data. Optional source/period settings stay under **Kilde og kalenderperiode**; automatic file dates apply until a manual semester/year filter is selected.

Each course shows its institution. **Filen inneholder flere læresteder** opens compact per-course choices; **Ukjent / velg senere** is valid. A common institution choice fills unknown courses only. Existing qualified names, links and identities remain authoritative; changing an established institution requires explicit consent. A recognized TP CSV can retain clearly marked provisional names without individual name entry. Published groups and individual exceptions remain selectable; the app never guesses your personal group.

A unique course code can also appear later in an activity title. Course recognition does not classify the activity as an exam or deadline. Ambiguous codes or institutions require a shared course choice. Older imports without recorded choice provenance ask once per affected course whether to repair the link or keep **Uten emne**; the decision is retained on unchanged reimport. Existing explicit choices and manual edits remain authoritative. Imported origin and later manual edits are shown separately.

An uncertain time shows the activity, date and time with a short reason. Choose **Vis som tidspunkt uten varighet**, **Rett tiden** or **Ikke importer denne**. A point requires a valid start, reserves no busy duration and does not create a deadline. Source-declared points and user decisions remain distinct. Exact seconds are retained. A later source version with a valid interval replaces an obsolete point decision; changed uncertain times need a new choice. An older import may also need one renewed choice when its previous source times cannot be compared reliably. Unchanged timing retains safe choices. The ready/blocking summary and **Importer valgte** stay reachable while reviewing rows; necessary warnings remain visible.

Invalid ICS dates are reported with the affected component and omission count instead of silently moving to another date. Unrelated valid components remain importable. Existing all-day, no-end and supported timezone/recurrence forms remain supported within the documented limits. Calendar export keeps its existing selection scope and writes transparency according to actual busy time; points and deadlines receive no invented end. The downloaded file remains a copy, not synchronization.

Before export, check **Blir med** and **Utelates**, including exact times and reasons. Standard ICS has whole-second precision: entries requiring fractional seconds are explicitly omitted from the proposed file rather than rounded; their saved times remain unchanged. Nonblocking teaching/information intervals remain outside the existing teaching-export selection and are listed as omissions. Overlapping personal intervals and supported all-day dates retain their interval or DATE meaning in the copy. An empty export cannot be downloaded. Repeated autumn-hour instants show their different UTC offsets in details. Published TP terms keep January activities in their autumn course when the source explicitly assigns that term.

Files and link snapshots are copies. Use the saved document source's update action for a changed file from the same source; absent events are not deleted automatically. ICS, PDF, DOCX, CSV and pasted text remain supported through the same entry. CSV supports UTF-8/UTF-16 BOM detection and explicit Windows-1252 or BOM-less UTF-16 selection. **Ser teksten riktig ut?** displays examples before accepting uncertain decoding. Invalid characters are never silently replaced. Comma, semicolon and tab delimiters with quoted values are supported; this is not XLSX support. Infinite ICS rules retain the explained six-month expansion window, while explicit later RDATE values are considered separately within the bounded import. Excessive input is rejected. Equivalent UTC/TZID cancellations use the occurrence's instant; an older cancellation lacking enough identity evidence is explained without guessing or deleting an unrelated activity. See [dated results and limits](VERIFICATION.md).

Under **Fra kalenderlenke** kan du hente et **øyeblikksbilde** og avklare emner i samme forhåndsvisning uten først å opprette dem. **Synkronisering for ett lagret emne** beholder den eksisterende oppdateringsavtalen. TP-visning støttes bare for én offentlig emne-/terminoppføring på `tp.educloud.no/<institusjon>/app/schedule` med `semester`, `scheduleType=course` og `course`, hos UiO, UiB, UiT, OsloMet, Nord, INN, UiS, UiA, HiMolde og HiØ (allerede eksisterende TP-adapter). Semester og kildevalg kontrolleres mot publiserte data. Personlige visninger, innlogging og andre nettsider tolkes ikke som kalendere; bruk sidens iCalendar-/ICS-eksport eller last ned en `.ics`-fil. Et kildebytte rydder gammel lenkefeil og hindrer forsinkede svar i å endre den nye importen.

## Isolert lokal utprøving av Ajour

Kjør fra denne appmappen i en egen PowerShell-terminal. Dette bruker Node/SQLite på port 5200 med en separat database under ignorerte `artifacts`, uten å oppdatere Docker eller bruke vanlig lagring. Bruk et privat nettleservindu til den syntetiske utprøvingen.

```powershell
npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Bygget feilet.' }
$env:HOST = '127.0.0.1'
$env:PORT = '5200'
$env:STUDIEPLAN_DB = Join-Path $PWD 'artifacts\ajour-preview\studieplan.sqlite'
$env:STUDIEPLAN_SEED = 'false'
Remove-Item Env:STUDIEPLAN_SEED_JSON -ErrorAction SilentlyContinue
node server/app.js
```

Åpne **http://127.0.0.1:5200**. Første oppstart er tom; syntetiske oppgaver beholdes ved neste oppstart med samme fil. Ctrl+C stopper bare denne serveren. Hvis porten er opptatt, avslutt din egen prøveprosess eller velg en annen ledig port; ikke stopp en ukjent tjeneste. [Verifikasjonen](VERIFICATION.md#emnepalett-og-mørk-modus--2026-10-26) oppgir hvilke nye kontroller som er kjørt på kandidaten og aktuell Docker-status.

## Full-stack drift med Docker

Forutsetning: Docker med Compose v2; kontroller med `docker compose version`. Standardoppstart krever ingen miljøfil eller nøkler. Valgfri konfigurasjon står i [.env.example](.env.example): `STUDIEPLAN_PORT` velger den lokale vertsporten (standard 8088), `STUDIEPLAN_SEED` er normalt `false`, og `STUDIEPLAN_SEED_JSON` brukes bare ved uttrykkelig valgt seed til tom database. Kopier eventuelt filen til `.env`; ekte studentdata skal ikke legges i Git. Porten bindes fortsatt til loopback. Ingen bestemt Docker Engine-patchversjon er dokumentert som testkrav.

Den komplette leveransen bygger nettleserklient, Node-server og SQLite-database fra de låste npm-avhengighetene. Node-basisbildet bruker den valgte, mutable taggen `node:24-bookworm-slim`. Skjemaet opprettes automatisk, og databasen ligger i et navngitt Docker-volum.

Kommandoen nedenfor er historisk runtime-verifisert fra en ren leveransekopi. [Verifikasjonen](VERIFICATION.md#emnepalett-og-mørk-modus--2026-10-26) skiller ny isolert Docker-kontroll fra den tidligere motorblokkeringen; den er ikke en oppdatering av vanlig drift. Kommandoen bygger klient og server, oppretter SQLite-skjemaet automatisk og starter den lokale tjenesten:

```powershell
docker compose up --build -d
```

Kjør kommandoen i mappen som inneholder denne README-filen, uavhengig av hvor kildekoden er pakket ut.

En allerede kjørende container tar ikke automatisk i bruk lokale kodeendringer. For å bygge og starte tjenesten med ny kode på vanlig port 8088, kjør følgende fra samme mappe når du selv vil oppdatere driften. Det eksisterende datavolumet beholdes:

```powershell
$env:STUDIEPLAN_PORT = '8088'
docker compose up -d --build studieplan
```

Åpne **http://127.0.0.1:8088**. Kontroller drift med `docker compose ps` eller `Invoke-RestMethod http://127.0.0.1:8088/api/health`, og stopp med `docker compose down`. Ikke bruk `-v` hvis dataene skal beholdes. `studieplan-data` er Compose-nøkkelen; med standard prosjektnavn blir det faktiske Docker-volumet normalt `studieplanlegger_studieplan-data`. Volumet gjør at `/data/studieplan.sqlite` overlever en ny container. Vertspubliseringen er uttrykkelig bundet til `127.0.0.1`; serveren lytter på 0.0.0.0:8080 inne i containerens eget nettverk. Dette gir tilgang via den publiserte loopback-porten og er ikke LAN-publisering av vertsporten.

En ny database starter tomt. Valgfri seed er av som standard og gjelder bare en helt tom database. Kopier `.env.example` til `.env`, sett `STUDIEPLAN_SEED=true` og oppgi en komplett validert v1-envelope på én JSON-linje i `STUDIEPLAN_SEED_JSON`. Verdien `{"schemaVersion":1,"tasks":[]}` i `.env.example` er en gyldig tom envelope. Seed overskriver aldri eksisterende data.

Ved første åpning kan en tom database finne gyldige browserdata fra samme opprinnelse. Appen viser en opptelling og ber om eksplisitt bekreftelse før den importerer en kopi. Serveren arkiverer eksakt råtekst og et fingeravtrykk; gjentakelse er en no-op, og originalen i nettleseren slettes eller omskrives aldri. Ved bytte fra en annen opprinnelse brukes eksisterende portabel eksport/gjenoppretting. Private kalenderlegitimasjoner er fortsatt utelatt og må kobles til igjen.

Den lokale Node-/Docker-leveransen bruker SQLite som autoritativ lagring. Hver sammensatt endring valideres som en komplett envelope på serveren, sammenlignes med forventet revisjon og skrives i én transaksjon før nettleserminnet oppdateres. Domeneobjekter har relasjonelle identitets-/koblingskolonner og tapsfri JSON for valgfrie leverandørfelt. Vite-utvikling og Vercel-utgaven bruker den komplette nettleserlagringen og har ingen autoritativ serverdatabase.

### Avgrensede arbeidsflytrettinger — 2026-10-02

Blandede eldre/nye arbeidssteg bevares med stabile ID-er, rekkefølge, fullføring og forutsetninger. Begge fjernhandlingene stopper når andre steg er avhengige av steget og forklarer hvilke forutsetninger studenten må endre. Ved gjenbruk av et tema vises eksamensdatoen; et urørt felt beholder datoen, mens et uttrykkelig tømt felt fjerner den. Vurderingen gjelder temaet, med en valgfri økt som uavhengig kontekst. Eksporten bruker det faktiske temanavnet for repetisjon uten oppgave og navngir utelatte frister med årsak. Programvelgerens norske navnerekkefølge og variantidentiteter er kontrollert gjennom gjenoppretting. Se [daterte sluttresultater og gjenværende grenser](VERIFICATION.md).

Sluttkontrollen etter reviewrettingene bestod **1382 enhetstester i 109 filer, 43 berørte nettleserforløp og 3 ordinære Node/SQLite-forløp**, med normal avslutning og nytt produksjonsbygg. Det separate syntetiske produksjonsforløpet bestod i tillegg **1 create + 1 restore** både etter Node-restart og Docker-gjenskaping. Docker beholdt eksakt tilstand ved revisjon 11; restore ga 13, med integritet OK og ingen FK-brudd. Tidligere og mellomliggende Docker-kjøringer nedenfor er historikk.

### Historisk Docker-kontroll — 2026-10-01

Etter uavhengig review ble sluttkoden bygget fra **641 hashkontrollerte leveransefiler** i eget prosjekt på `127.0.0.1:18521`. Fire produksjonsforløp bestod normalt: fleksibel registrering, faktisk plan/replan, ekte NTNU-import med bevaring ved simulerte kildefeil og fersk browser/UI-backup/restore etter containergjenskaping. Hele tilstanden ved revisjon **34** overlevde; restore ga **36**. SQLite hadde integritet OK og **0 FK-brudd**. Container/nettverk er stoppet og det syntetiske volumet beholdt. Sluttregresjon: **1346 enheter, 41 nettleserforløp, 92 undervisningskontroller og 3 Node/SQLite-forløp**, alle normalt avsluttet. [VERIFICATION.md](VERIFICATION.md) skiller sluttbevis, historiske kjøringer og åpne review-/dekningstema.

En lokal studieplanlegger for emner, oppgaver og tid. Appen bruker lokal parsing, planleggingsregler og enkel statistikk, uten konto eller generativ KI. Oppgaver, dokumentutdrag og arbeidshistorikk blir på denne enheten. Vanlig Node-start lytter på loopback; Docker bruker 0.0.0.0 inne i containeren og publiserer vertsporten bare på 127.0.0.1.

## Start appen

Oppsettet er kontrollert med Node.js 24.19.0 og npm 11.17.0 på Windows. Installer Node fra [nodejs.org](https://nodejs.org/) ved behov. Kjør én linje om gangen i PowerShell:

```powershell
cd studieplanlegger
npm.cmd ci
npm.cmd run dev
```

Installasjonen trenger normalt internett. Stopp en server du selv har startet før du installerer pakker, fordi Windows kan låse filer. Åpne **http://studieplan.localhost** når serveren er klar. Terminalen må stå åpen; Ctrl+C stopper serveren. Neste gang holder det å kjøre `npm.cmd run dev` fra appmappen.

Port 80 er fast. Ved opptatt port stopper oppstarten; den velger ikke en ny adresse. Ingen endring i Windows' hosts-fil er nødvendig i Chrome/Edge. Ikke dobbeltklikk `index.html`.

Bruk samme adresse og nettleserprofil hver gang. **Gamle data på http://localhost:5173 er beholdt der.** Start den gamle adressen med `npm.cmd run dev:legacy` ved behov. Nettleseren har separat lagring per adresse; data flyttes eller synkroniseres ikke automatisk. Bruk sikkerhetskopi og bekreftet gjenoppretting for å flytte dem.

## Kom i gang og finn frem

«Kom i gang» hjelper en ny student å lagre første emne, opprette første oppgave og bekrefte en studieøkt. Import og manuell registrering kan kombineres, steg kan hoppes over, og oppstarten kan fortsettes senere fra innstillingene. Et nylig importert emne kan være forhåndsvalgt for oppgaven. Eksisterende brukere beholder oversikten sin.

- **Oversikt:** dagens aktiviteter, uavklarte frister og ett begrunnet hovedforslag, med alternativer.
- **Kalender:** undervisning, andre aktiviteter, frister og reserverte studieøkter. Dag, uke og agenda gjør tid og overlapp synlig.
- **Alle oppgaver:** registrering og vedlikehold av hele arbeidslisten. «Denne uken» er et oppgavefilter.
- **Mine emner:** fag, emnekoblinger og samlet import.
- **Planlegg uken:** tilgjengelig arbeidstid, faste opptatte tidsrom, kapasitet og realistiske planforslag.

På mobil ligger hovedmålene i toppnavigasjonen; øvrige valg ligger under «Mer». «Innstillinger» samler sikkerhetskopi, angre/papirkurv, oppstart og personlige estimater.

En oppgave trenger bare **tittel**. Frist kan være bare dato eller dato med klokkeslett; en dato uten tid beholdes og eksporteres som heldagsfrist. Emne, prioritet, avhengigheter og oppgavetype finnes under «Flere detaljer». Gjenstående arbeid kan være et intervall; «Vet ikke» er ukjent, ikke null, og en åpen øvre grense bevares som åpen. Null minutter markerer ikke oppgaven som ferdig. Ved validerings- eller lagringsfeil beholdes utkastet.

Arbeidssteg er en ordnet del av oppgaven. Eldre «neste steg» vises også når oppgaven allerede har en stegliste; åpning skriver ingenting. Ved lagring får det en deterministisk ID uten å endre eksisterende ID-er eller rekkefølge. Bare eksplisitt eldre opphav med nøyaktig samme innhold slås sammen; senere fullføring, notater og forutsetninger bevares. Et steg som andre steg bruker som forutsetning kan ikke fjernes før disse koblingene er redigert. Stegestimater legges ikke til oppgavens gjenstående arbeid. Dokumentforslag skiller eksplisitte krav, foreslått arbeidsmåte og uavklarte opplysninger, og skriver ingenting før samlet godkjenning.

Gyldig eldre stegtekst og avledede ID-er beholdes også når de er lengre enn de nyere feltgrensene. Etter sletting med tastatur flyttes fokus til et gjenværende steg eller knappen for å legge til et steg. Ved avvist lagring beholdes utkastet for nytt forsøk.

Egenvurdering er valgfri og bruker valgene «Trenger hjelp», «Forstår med støtte», «Kan forklare selv» og «Hopp over». Daterte vurderinger kan vises, endres eller slettes, og repetisjonsforslag kan slås av per tema. Ukjent eksamensdato eller manglende kollisjonsfri kapasitet vises som usikkerhet. Repetisjon blir først en vanlig studieøkt etter at studenten godkjenner eller justerer forslaget. Avvisning og utsettelse lagres som beslutninger slik at samme vurdering ikke foreslås flere ganger.

Vurderingen gjelder **temaet**. Temaet kan ha oppgave-/emnekobling; en levende eller historisk økt er uavhengig, valgfri kontekst og kan høre til en annen oppgave eller være uten oppgave. Automatisk arbeidsavslutning bruker bare den faktisk avsluttede, validerte økten. Visningen merker historisk kontekst med lagret tidspunkt og oppgavenavn; manglende opplysninger oppgis som ukjente. Gjenbruk av tema forhåndsutfyller eksamensdatoen. En uttrykkelig tømming fjerner datoen og opphever framtidige repetisjonsvalg etter samme regler som temaeditoren, mens ferdig repetisjon og tidligere vurderinger bevares.

En økt som allerede er brukt som vurderingskontekst beholdes ved endrede temainnstillinger. Hvis vurderingen som eier repetisjonsforslaget endres eller slettes, kan den refererte økten beholdes som en vanlig økt med samme identitet og tidspunkt; andre vurderinger blir ikke omkoblet eller slettet.

«Eksporter kalender» ligger øverst i kalendervisningen og kan laste ned valgte lagrede studieøkter og frister som `.ics`; undervisning er et uttrykkelig tillegg. Dialogen viser antallet i filen og navngir hver utelatt frist med forklaring, for eksempel tvetydig klokkeslett ved vintertid. Tomt utvalg kan ikke lastes ned. Repetisjon uten oppgave bruker temanavnet eller «Repetisjon (tema ikke tilgjengelig)» når temaet mangler. Hver frist eksporteres én gang som en transparent kalenderhendelse uten oppdiktet sluttid. Filen bruker stabile, ugjennomsiktige UID-er, norsk tid konvertert til korrekte tidspunkter og standard linjefolding. Eksporten er en kopi, ikke synkronisering, og inneholder ikke dokumentutdrag eller andre private forhåndsvisningsfelt.

Repetisjonsforhåndsvisningen bruker samme temainnstillinger og oppheving av ubrukte planer som lagringen. Når tema eller dato endres, fjernes foreldede automatiske tider og tidligere godkjenning. Tider studenten selv har redigert beholdes, men krever et nytt uttrykkelig valg. Historiske oppgavenavn vises bare fra riktig lagret øyeblikksbilde; ellers oppgis at det historiske navnet er ukjent.

Planvinduet kan sammenligne gjeldende kapasitet, redusert kapasitet og prioriterte oppgaver fra samme lagrede revisjon og klokkeslett. Alternativene viser fordelt tid, mangel, flyttinger, utelatelser og usikkerhet. Bare valgt alternativ kan brukes; endret grunnlag gir stale-avvisning, og den vanlige historikken gjør den sammensatte lagringen angrebar.

Etter lagring åpner **Se planforslag** uten å kreve detaljert tilgjengelighet. Første gang kan studenten velge dagtid på hverdager (09–15), kveld på hverdager (18–20), helg (10–14), «Det varierer» eller detaljert tilpasning. Et valgt gjentakende mønster lagres og gjenbrukes som preferanse; det registreres ikke som bekreftet kapasitet. Uten valg viser appen bare ett tydelig merket, betinget forslag på 30 minutter. Ukjent arbeidsmengde gir en kort startøkt, ikke et anslag for hele oppgaven.

## Importer en bekreftbar plan

**Mine emner → Importer** opens the file/link flow described above; **Finn studieprogram** retains the separate existing program flow. The dated [coverage inventory](IMPORT-COVERAGE.md) records 48 program adapters and 49 institutions, with each source's limits. These counts do not establish national coverage or change the bounded V1 acceptance criteria. A tested program or course establishes only that tested flow.

Velg publisert programutgave, opptakskull, studiesemester og kalendersemester uttrykkelig når kilden trenger dem. Campus vises bare når kilden gir et reelt valg. Påkrevde emner vises separat fra kildepubliserte alternativer; ingen alternativ gren velges for studenten, og studiepoengsum brukes bare som informasjon. Et manglende emne kan søkes opp eller registreres som en tydelig uverifisert post uten at programkonteksten må fylles inn på nytt. Det påbegynte utvalget beholdes ved kildefeil, tilbakegang og omlasting i samme fane, men regnes ikke som importert. Tilgjengelig undervisning kan kontrolleres samlet, men hvert emne beholder statusen «klar», «ingen treff», «feil» eller «krever tilgang», og bare mislykkede kilder prøves på nytt. Gruppemedlemskap utledes aldri fra et treff. Emner og vellykket undervisning lagres med én bekreftelse; kvitteringen sier presist hvor undervisning faktisk ble importert. Offentlig undervisning kan også hentes for et emne som allerede er lagret, selv når programimport mangler.

Kalenderpanelet har tre valg som åpnes ett om gangen: fil/lenke, offentlig institusjonskalender og undervisning for et lagret emne. Aktiviteter må velges før lagring. Kildeopplysninger og mangler kan åpnes i forhåndsvisningen. Kalenderinformasjon, faktiske undervisningsaktiviteter og innleveringsfrister holdes adskilt.

Dokumentimport støtter innlimt tekst, tekstbasert PDF, DOCX, CSV og ICS. Filene leses lokalt, med grenser på 10 MB for PDF/DOCX, 100 PDF-sider og 2 MB for tekst/CSV/ICS. Skannede eller uleselige dokumenter får en forklaring og vei til innlimt tekst/manuell registrering. Appen utfører ikke dokumentinnhold eller laster eksterne dokumentressurser.

Forhåndsvisningen viser forslag til emner, oppgaver, frister og aktiviteter med kildeutdrag. Rett felter, velg bort rader og koble til eksisterende emner. Uklare datoer, manglende år og usikre koblinger må avklares eller uttrykkelig utelates. Feil åpner den berørte raden og flytter fokus til feltet. Kildevarsler om eksempelvis uleselige PDF-sider bevares etter lagring og vises ved senere oppdatering. Ingenting lagres før bekreftelse.

Gjentatt import bevarer stabile identiteter og egne endringer. Endrede dokumenter kan kobles til en tidligere kilde; usikker samsvar og konflikter krever valg. Kalenderlenker valgt som synkronisering oppdateres mens appen er åpen, med ventetid ved kildefeil. Tidligere data beholdes ved feil. Private lenker og tilgangsnøkler lagres lokalt; filer og lenker valgt som øyeblikksbilder oppdateres ikke automatisk. Enkelte offentlige kilder har ustabile ID-er eller ukjent fullstendighet, slik at en flyttet aktivitet må avklares manuelt. Se [importbeskrivelsen](IMPORT.md).

## Planlegg og oppdater fremdrift

Registrer og bekreft arbeidsvinduer og faste opptatte tidsrom under «Planlegg uken». Undervisning og overlapp trekkes fra kapasiteten; samme opptatte minutt telles én gang. Manglende arbeidsvinduer eller tidsestimater gir usikkerhet, ikke et oppdiktet kapasitetsoverskudd. Minuttsummen er en kapasitetsoversikt; det konkrete planforslaget kontrollerer også øktlengder, pauser og tidsskifte.

«Status i dag» forklarer registrert arbeid mot reell kapasitet. «Jeg har tid nå» oppdaterer opptil tre begrunnede forslag straks du velger 15, 30, 45, 60 eller egendefinert tid. «Se realistisk forslag» viser konkrete nye, delte eller flyttede reservasjoner, påvirkning på andre oppgaver og eventuelt restunderskudd før du godkjenner. Forslaget respekterer faste aktiviteter, låste studieøkter, frister, avhengigheter, delingsvalg, øktlengder og pauser. Godkjenning og angre behandler planendringen samlet.

Det oppgavenære forslaget viser oppgave, dag, klokkeslett, varighet og forutsetninger som lesbar tekst. **Flytt** tilbyr først kontrollerte alternativer; dato- og tidsfelt vises først etter **Velg tidspunkt selv**. Flytting endrer bare utkastet. **Bruk planen** kontrollerer grunnlaget på nytt og lagrer nøyaktig de viste øktene; **Ikke nå** skriver ingenting, gjentatt godkjenning lager ingen duplikater, og **Angre** gjenoppretter tilstanden før planendringen. Registrerte arbeidsvinduer og avtaler er autoritative; en tom kalender fremstilles aldri som bekreftet fritid.

For en isolert prøve som unngår port 80 og eksisterende nettleserlagring, kjør `npx.cmd vite --host 127.0.0.1 --port 5278 --strictPort` fra denne mappen og åpne `http://127.0.0.1:5278` i en ny privat nettleserprofil. Stopp den egne serveren med Ctrl+C etterpå.

Planlagt tid betyr ikke utført arbeid. Etter en planlagt økt eller arbeid registrert i etterkant velger du:

- **Utført:** det aktuelle arbeidssteget fullføres. Hele oppgaven og innlevering avklares separat.
- **Trenger mer tid:** oppgi nytt anslag på gjenstående arbeid eller «Vet ikke».
- **Ikke utført:** ingen faktisk arbeidstid eller fremdrift registreres, og ingen økter flyttes automatisk.

Faktisk arbeidstid er valgfri og trekkes ikke automatisk fra gjenstående arbeid. En økt med 30 minutter faktisk arbeid kan derfor ende med 45 minutter gjenstående. Gjentatte klikk registrerer ikke samme økt flere ganger. Angre gjenoppretter oppgave, arbeidshistorikk og berørte reservasjoner samlet.

Registrer «må gjøres etter», venting og ett eller flere ordnede arbeidssteg i oppgaven. Steg kan fullføres, gjenåpnes, flyttes eller slettes uten at selve oppgaven slettes eller automatisk markeres ferdig. Et registrert avklaringssteg kan foreslås før annet arbeid; blokkerte oppgaver vises ikke som startklare. Fristen til arbeid som avhenger av en oppgave kan gjøre den viktig å starte nå; begrunnelsen viser den registrerte sammenhengen. En større oppgave kan foreslås som en deløkt med forklaring. Appen sender ingen meldinger eller e-post. «Klar til levering» og «Levert» krever forskjellige handlinger.

Personlige estimater bruker lokale medianer først ved minst fem relevante fullførte oppgaver med bekreftet fullstendig arbeidstid, eller fem utførte økter uten avbrudd for øktlengde. Hele oppgaver og deløkter vurderes hver for seg; gjenåpnet arbeid teller ikke som en fullført oppgave. Under «Øktlengde og pauser» kan du bruke eller rette et personlig øktforslag og beregne en ny plan før bekreftelse. Grenser og pauser endres ikke av forslaget. Datagrunnlag og usikkerhet vises, og forslag endrer ikke estimater eller planer før du velger dem. Slå av personalisering eller slett arbeidshistorikken i innstillingene. Sletting fjerner også historikken fra appens gjenopprettingskopi og tilhørende angre/papirkurv; tidligere nedlastede sikkerhetskopier endres ikke.

## Kalender og lokale data

Under Oversikt og Alle oppgaver kan du skrive én lokal, regelbasert handling: opprette en oppgave, endre en frist eller endre gjenstående arbeid. Forslaget viser konkrete Oslo-datoer og kan redigeres før én bekreftelse. Oppgave- og emnenavn må matche nøyaktig; som et avgrenset norsk alias kan entydig `rapporten` vise til oppgaven `rapport`, men tvetydighet gir alltid et eksplisitt valg med emne/frist. Ukjent emne beholder de forståtte feltene for korreksjon. Flere handlinger og foreldede forslag avvises uten delvis lagring. Råteksten lagres ikke, og funksjonen bruker verken KI eller nettverk. Støttede alias er `legg til`/`opprett`/`ny oppgave`, `frist`/`leveres` og `gjenstår`/`gjenstående arbeid`. Eksempler er `Legg til rapport i IBE160 med frist fredag kl. 14.`, `Ny oppgave: Les kapittel 3.`, `Endre fristen på rapporten til 12. oktober.` og `Sett gjenstående arbeid på rapporten til to timer.`

Importerte eksamener beholder et strukturert aktivitetsmerke gjennom oppdatering og lagring. Strukturert `assessment` beholdes som generell vurdering og blir ikke automatisk eksamen, heller ikke for transparente punktoppføringer. Dokumentimporterte hendelser og forhåndsvisningen bruker uttrykkelig aktivitetstype, ikke titteltolkning. For manuelle og eldre kalenderhendelser uten dokumentimportopphav beholdes gjenkjenning når tittelen eksplisitt sier «eksamen», `exam` eller `examination`; eksamensforberedelse, prøve-/mockeksamen, forelesninger om eksamen og generelle vurderingsord behandles ikke som eksamen. Kalender, agenda, dagsoversikt og emnevisning viser `📝 Eksamen`, emnet og en egen aksent uten å endre undervisningsfilter, tidsreservasjon eller eksportvalg.

Kalenderens ukevisning kan vise hele uken eller arbeidsuken. På mobil er dagvisningen standard. Dato, kalenderfiltre, ukemodus og rulleposisjon bevares gjennom navigasjon og sikkerhetskopi. Korte eller overlappende hendelser beholder faktisk varighet og har lesbare detaljkontroller; lange titler kan åpnes i sin helhet. Dagsoversikten samler økter og frist for samme oppgave.

Appen bruker fortsatt `studieplanlegger:v1` med valgfrie nye felt. Støttede eldre sikkerhetskopier kan åpnes. Oppstart skriver ikke om gammel lagring; uleselige data sperrer endring og gir gjenopprettingsvalg. Vite-utvikling og Vercel-utgaven bruker nettleserlagring og bør ha én redigerende fane. Lokal Node-/Docker-modus bruker SQLite med revisjonskontroll: en foreldet skriving avvises som konflikt og krever ny innlesing, slik at nyere serverdata ikke overskrives stille.

Eksport/gjenoppretting, angre og papirkurv finnes i innstillingene. Portabel sikkerhetskopi bevarer opplysninger og relasjoner, men utelater kalenderforbindelser og kjente tilgangsnøkler. Kildene må kobles til igjen etter gjenoppretting. En gjenoppretting viser innholdet før bekreftelse og beholder en lokal gjenopprettingskopi av forrige tilstand.

Frister lagres som lokale datoer/klokkeslett, og importert undervisning vises i norsk tid. Bruk samme lokale tidssone; flytting mellom tidssoner er ikke fullstendig støttet. Ikke-eksisterende eller tvetydige klokkeslett ved tidsskifte må avklares. Studieøkter kan krysse midnatt med eksplisitt sluttdato.

I Vite-utvikling og Vercel-utgaven kan sletting av nettleserdata slette planen fordi disse bruker `localStorage`. I lokal Node-/Docker-modus er SQLite autoritativ; sletting av nettleserdata sletter ikke databasen, men kan fjerne en uimportert nettleseroriginal. Oppbevar uansett egne sikkerhetskopier utenfor kildekoden eller i `local-backups/`. Private dokumenter og arbeidsfiler hører hjemme utenfor delbar kode; relevante lokale mapper og genererte rapporter er ignorert.

## Tester og bygg

Programimporten kan forberede undervisning i samme gjennomgang når det finnes nøyaktig ett offentlig treff med identisk emnekode. Vanlige, eksplisitt kildeetiketterte serier kan foreslås; nummererte paralleller og grupper velges aldri automatisk. Åpne detaljer, fokus og rulleposisjon beholdes ved lokale oppdateringer, og emnekode samt deterministisk farge følger undervisning, frister og studieøkter i kalender- og agendavisningene.

Installer Playwrights testnettleser ved behov og kjør kontrollene fra prosjektmappen:

```powershell
npx.cmd playwright install chromium
npm.cmd run test:unit
npm.cmd run test:e2e
npm.cmd run test:e2e:database
npm.cmd run verify:teaching
npm.cmd run build
```

Den vanlige nettlesersuiten bruker isolerte kontekster og en Vite-server på **127.0.0.1:5174**. `test:e2e:database` bygger appen, velger en ledig loopback-port, starter den faktiske Node/SQLite-serveren med en midlertidig database og rydder databasen etterpå. Begge bruker syntetiske studentdata. `verify:teaching` kjører den frakoblede adaptermatrisen med varige fixturer. Den eksplisitte opt-in-kommandoen `npm.cmd run verify:teaching:live` gjør avgrensede, skrivebeskyttede kontroller av HiMolde IBE110/IBE430/IBE160 og NTNU ARK1001/EXPH0100; den krever nettverk og lagrer ingen sesjonscookie. Live-prøver telles separat fra simulerte svar og offentlige fixturer. [VERIFICATION.md](VERIFICATION.md) dokumenterer de faktiske kjøringene, visuelle kontrollene og begrensningene.

`build` lager lokale filer i `dist/` og publiserer ingenting. Prosjektet har ingen egen lint- eller typekontrollkommando. Behold `package-lock.json`; `npm.cmd ci` installerer de låste avhengighetene.

## Fleksibel tekstregistrering og egne aktiviteter

Trykk **Lag forslag** etter å ha skrevet en kort oppgavetittel, for eksempel «Øve på koding». Tittel er eneste obligatoriske opplysning; emne, frist og arbeid kan stå ukjent. «Uten emne»/«ikke et emne» fjerner emnet, og «vet ikke»/«mye» betyr ukjent arbeid, ikke null. Spørsmål og uklare flytte-, endre- eller sletteønsker lagres ikke automatisk. Korte datoer bruker inneværende Oslo-år; hvis datoen allerede er passert, må år velges uttrykkelig.

Et kjent intervall som «Tannlege 4.10 kl. 12–13» foreslås som en egen aktivitet uten emne eller importkilde. «Egen aktivitet: Ring banken 4.10» beholder ukjent klokkeslett, og en aktivitet med bare start beholder ukjent varighet. Bare komplette start-/sluttintervaller reserverer kapasitet; ufullstendige tider vises som usikkerhet. Egne aktiviteter kan redigeres eller slettes fra emne-/aktivitetsflaten og tas bare med i kalenderkopien når **Egne aktiviteter** velges uttrykkelig.

## Kode og tidligere prosjektarbeid

Appen bygger videre på [Vites vanilla JavaScript-mal](https://vite.dev/guide/). `src/main.js` eier felles tilstand og transaksjoner; `storage.js`, `history.js` og `backup.js` håndterer lagring og gjenoppretting. Rene moduler for oppgaver, arbeidshistorikk, kapasitet, avhengigheter og omplanlegging brukes av de samme visningene. Offentlige kildeadaptere ligger i `server/providers/`; privat dokumentparsing skjer i en lokal nettleser-worker.

Det kuraterte prosjektmaterialet finnes via [planindeksen](../.docs/planning-artifacts/README.md), [arkitekturen](../.docs/planning-artifacts/architecture/architecture-studieplanlegger-2026-09-06/ARCHITECTURE-SPINE.md), [løsningsguiden](../.docs/implementation-artifacts/solution-guide.md) og [utviklingsprosessen](../.docs/implementation-artifacts/development-process.md). Interne arbeidsspesifikasjoner er lokale og inngår ikke i leveransen. Teknisk kontroll er ikke en dokumentert brukermåned eller studentens personlige refleksjon.
