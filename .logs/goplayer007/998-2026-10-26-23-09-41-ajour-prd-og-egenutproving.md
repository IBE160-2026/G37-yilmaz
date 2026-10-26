# Ajour: PRD og egenutprøving

## 2026-10-26 kl. 23:09 — GOplayer007

### Oppgave

Oppdatere eksisterende PRD og tilhørende dokumentasjon etter lærerfeedback og prosjekteierens instruks, samordne egenutprøving og kontrollere Ajour som produktnavn. Dokumentretting var autorisert; staging, commit og push var uttrykkelig utelukket, også skillens automatiske loggcommit.

### Plan

- Lese instrukser, lærerfeedback, eksisterende [planindeks](../../.docs/planning-artifacts/README.md), [PRD](../../.docs/planning-artifacts/PRD.md) og siste verifikasjon; kontrollere Git-status og bevare eksisterende arbeid.
- Samordne SC-07/R-07/S-07 med [sju scenarier for egenutprøving](../../.docs/planning-artifacts/USER-TRIAL-PLAN.md), gjenbruke faktisk research og klassifisere gamle navn før retting.
- Gjennomføre uavhengig innholds-/struktur-/språkgjennomgang, relevante tester og dokumentkontroll, og skrive nødvendig logg lokalt.

### Resultat

Arbeidstre og indeks var rene ved start på `2d7be923853fed30173399df6c62765103a69ca5`. Eksisterende PRD er revidert på stedet; rekonstruksjonsdato 2026-10-16, V1 og ID-er er beholdt. Brief, stories, sporbarhet, prøveplan, arkitektur, README-er, løsning, prosess, verifikasjon og åpne punkter er samordnet. Korrigert uriktige dokumentpåstander, også i ett relevant lokalt arbeidsnotat utenfor repositoryet. Lærerens originaltekster og ekte verktøybruk er bevart. Historisk Docker-blokkering peker til senere dokumenterte kontroller.

Research bruker eksisterende lærerfeedback, importdekning og TP CSV-undersøkelse samt tre avgrensede offentlige primærkilder lest 2026-10-26: Google Calendar, Canvas og Microsoft To Do. Sensorvedleggets sju sider er lest med samsvarende kontrollsum. Lærerbildets seks spørsmål er brukt fra prosjekteierens gjengivelse; bildet er ikke separat undersøkt. Ingen intervjuer, prøveutfall eller personlige erfaringer er konstruert.

Egenutprøvingen er **planlagt / ikke gjennomført**, kun prosjekteieren, syntetiske data og isolert miljø. Den tidligere studentprøven ble ikke gjennomført eller bestått. Uavhengig gjennomgang førte til et gjennomførbart prøveoppsett: egen framtidig økt til kalender/gjenoppretting, ett isolert oppstartsopplegg og uttrykkelige handlinger før forventede resultater. Målgruppen er uendret.

Tre aktive server-/feiltekster er rettet til Ajour. UI, metadata og eksportnavn brukte allerede Ajour. Tekniske kontrakter, generiske fagord, kildenavn og datert historikk er beholdt. Nye kontroller: **2278/2278 enhetstester i 132 filer**, exit 0; **produksjonsbygg, 87 moduler**, exit 0. Eksisterende installasjon med Node 24.19.0, Vitest 5.0.0 og Vite 8.2.2; ingen ny låst installasjon. Bundle-/plugin-tidsvarsel er oppgitt. Ingen nye browser-/Docker-/live-/manuelle prøver. [Dagens verifikasjon](../../studieplanlegger/VERIFICATION.md#dokumentrevisjon-og-navnekontroll--2026-10-26) samler endelige dokumentkontroller og begrensninger.

Ingen private originalkalendere, brukerens databaser, nettleserprofiler eller sikkerhetskopier er åpnet. Ingen pull, reset, clean, stash, staging, commit eller push er utført. Loggen er skrevet lokalt etter brukerens instruks.

### Åpne punkter

- Prosjekteierens egenutprøving og personlige refleksjon gjenstår; ingen generell studentnytte eller forståelse hos ukjente brukere er etablert.
- Faktisk Outlook-kontroll og gjentakelse av hele HiMolde-programflyten er ikke verifisert.
- Godkjent proposal og overordnet sensorveiledning er fortsatt ikke identifisert.
- Eksisterende bundlevarsel over 500 kB består.

Punktene er samlet i [issues](issues.md); historiske kjøringer og dagens tekniske kontroll er holdt atskilt.

## 2026-10-26 kl. 23:29 — GOplayer007

### Oppgave

Kontrollere og committe den ferdige dokument- og navneoppdateringen lokalt. Brukeren autoriserte avgrensede rettinger, eksplisitt staging og lokale commits; ingen push, publisering eller driftsendringer.

### Plan

- Kontrollere faktisk Git-status, hele endringsdiffen og dokumentkjeden uten ny produktplanlegging.
- Kontrollere testgrunnlag, Markdown/PowerShell, filutvalg og personvern; committe hovedendringen og deretter denne loggen med åpne punkter.

### Resultat

Start på `main`, HEAD `2d7be923853fed30173399df6c62765103a69ca5`, tom indeks og de forventede 18 endrede/nye filene. Hovedcommit **`ffcf0a3` — «Samordne Ajour-PRD, egenutproving og produktnavn»** inneholder 16 eksplisitt gjennomgåtte filer. Commitens filutvalg og Git-blobs samsvarer med kontrollmanifestet. Brief og PRD er begge beholdt, med ulike dokumentroller, stabile ID-er, uendret V1 og rekonstruksjonsdato 16. oktober. De tre navnestrengene endrer ingen tekniske kontrakter. Ingen nye produktrettinger var nødvendige; aktuelle statuslenker og kontrollresultater er oppdatert.

Nye kjøringer: **52/52 fokustester**, **2278/2278 enhetstester i 132 filer** og **produksjonsbygg med 87 moduler**, alle exit 0. Tidligere testtall er historikk. Alle 707 versjonerte ikke-Markdown-filer i appen er byteidentiske før/etter test og ved staging. Eksisterende installasjon ble brukt uten avhengighetsendring; versjoner, manifest og varsler står i [commitkontrollen](../../studieplanlegger/VERIFICATION.md#lokal-commitkontroll--2026-10-26).

Uavhengig dokumentkontroll fant ingen nye avvik. Faktiske Markdown-filer har ingen påviste feil fra escaping; 12 PowerShell-kodeblokker er syntaksparset uten kjøring, 0 feil. Sluttkontrollen omfatter 36 Markdown-filer, 488 lokale lenker og 85 ankre, uten manglende mål, samt stabile krav-/storyreferanser. Hele diffen, slettinger og staged whitespace er kontrollert. Personvern-/formatkontrollen omfatter 323 filer, inkludert 298 versjonerte fixturer og 11 utfoldede ICS; ingen nye uavklarte treff i utvalget. Læreroriginalene er uendret. Bare relevante dokumenter, tre serverfiler og kuraterte logger inngår; private data og genererte artefakter er utelatt.

Sesjonsloggen og `issues.md` fullføres i en separat lokal loggcommit etter hovedcommitten. Ingen push, GitHub-endring, nettleser-/Docker-/live-prøve, manuell egenutprøving eller driftsendring er utført i denne kontrollrunden.

### Åpne punkter

Egenutprøving er fortsatt **planlagt / ikke gjennomført**; observasjonsfeltene er tomme. Personlig refleksjon, faktisk Outlook-kontroll og full HiMolde-programgjentakelse gjenstår. Bundlevarselet består som teknisk begrensning. Uidentifisert proposal og overordnet sensorveiledning er kildebegrensninger, ikke nye obligatoriske innleveringskrav. Alle punktene er bevart og gruppert i `issues.md`.
