# Ajour: PRD og egenutprøving

## 2026-10-26 kl. 23:09 — GOplayer007

### Oppgave

Oppdatere eksisterende PRD og tilhørende dokumentasjon etter lærerfeedback og prosjekteierens instruks, samordne egenutprøving og kontrollere Ajour som produktnavn. Dokumentretting var autorisert; staging, commit og push var uttrykkelig utelukket, også skillens automatiske loggcommit.

### Plan

- Lese instrukser, lærerfeedback, eksisterende [planindeks](../.docs/planning-artifacts/README.md), [PRD](../.docs/planning-artifacts/PRD.md) og siste verifikasjon; kontrollere Git-status og bevare eksisterende arbeid.
- Samordne SC-07/R-07/S-07 med [sju scenarier for egenutprøving](../.docs/planning-artifacts/USER-TRIAL-PLAN.md), gjenbruke faktisk research og klassifisere gamle navn før retting.
- Gjennomføre uavhengig innholds-/struktur-/språkgjennomgang, relevante tester og dokumentkontroll, og skrive nødvendig logg lokalt.

### Resultat

Arbeidstre og indeks var rene ved start på `2d7be923853fed30173399df6c62765103a69ca5`. Eksisterende PRD er revidert på stedet; rekonstruksjonsdato 2026-10-16, V1 og ID-er er beholdt. Brief, stories, sporbarhet, prøveplan, arkitektur, README-er, løsning, prosess, verifikasjon og åpne punkter er samordnet. Korrigert uriktige dokumentpåstander, også i ett relevant lokalt arbeidsnotat utenfor repositoryet. Lærerens originaltekster og ekte verktøybruk er bevart. Historisk Docker-blokkering peker til senere dokumenterte kontroller.

Research bruker eksisterende lærerfeedback, importdekning og TP CSV-undersøkelse samt tre avgrensede offentlige primærkilder lest 2026-10-26: Google Calendar, Canvas og Microsoft To Do. Sensorvedleggets sju sider er lest med samsvarende kontrollsum. Lærerbildets seks spørsmål er brukt fra prosjekteierens gjengivelse; bildet er ikke separat undersøkt. Ingen intervjuer, prøveutfall eller personlige erfaringer er konstruert.

Egenutprøvingen er **planlagt / ikke gjennomført**, kun prosjekteieren, syntetiske data og isolert miljø. Den tidligere studentprøven ble ikke gjennomført eller bestått. Uavhengig gjennomgang førte til et gjennomførbart prøveoppsett: egen framtidig økt til kalender/gjenoppretting, ett isolert oppstartsopplegg og uttrykkelige handlinger før forventede resultater. Målgruppen er uendret.

Tre aktive server-/feiltekster er rettet til Ajour. UI, metadata og eksportnavn brukte allerede Ajour. Tekniske kontrakter, generiske fagord, kildenavn og datert historikk er beholdt. Nye kontroller: **2278/2278 enhetstester i 132 filer**, exit 0; **produksjonsbygg, 87 moduler**, exit 0. Eksisterende installasjon med Node 24.19.0, Vitest 5.0.0 og Vite 8.2.2; ingen ny låst installasjon. Bundle-/plugin-tidsvarsel er oppgitt. Ingen nye browser-/Docker-/live-/manuelle prøver. [Verifikasjonsoversikten](../studieplanlegger/VERIFICATION.md#begrensninger-og-gjenstående-arbeid) samler gjenværende begrensninger.

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

Nye kjøringer: **52/52 fokustester**, **2278/2278 enhetstester i 132 filer** og **produksjonsbygg med 87 moduler**, alle exit 0. Tidligere testtall er historikk. Alle 707 versjonerte ikke-Markdown-filer i appen er byteidentiske før/etter test og ved staging. Eksisterende installasjon ble brukt uten avhengighetsendring; gjenværende begrensninger er samlet i [verifikasjonsoversikten](../studieplanlegger/VERIFICATION.md#begrensninger-og-gjenstående-arbeid).

Uavhengig dokumentkontroll fant ingen nye avvik. Faktiske Markdown-filer har ingen påviste feil fra escaping; 12 PowerShell-kodeblokker er syntaksparset uten kjøring, 0 feil. Sluttkontrollen omfatter 36 Markdown-filer, 488 lokale lenker og 85 ankre, uten manglende mål, samt stabile krav-/storyreferanser. Hele diffen, slettinger og staged whitespace er kontrollert. Personvern-/formatkontrollen omfatter 323 filer, inkludert 298 versjonerte fixturer og 11 utfoldede ICS; ingen nye uavklarte treff i utvalget. Læreroriginalene er uendret. Bare relevante dokumenter, tre serverfiler og kuraterte logger inngår; private data og genererte artefakter er utelatt.

Sesjonsloggen og `issues.md` fullføres i en separat lokal loggcommit etter hovedcommitten. Ingen push, GitHub-endring, nettleser-/Docker-/live-prøve, manuell egenutprøving eller driftsendring er utført i denne kontrollrunden.

### Åpne punkter

Egenutprøving er fortsatt **planlagt / ikke gjennomført**; observasjonsfeltene er tomme. Personlig refleksjon, faktisk Outlook-kontroll og full HiMolde-programgjentakelse gjenstår. Bundlevarselet består som teknisk begrensning. Uidentifisert proposal og overordnet sensorveiledning er kildebegrensninger, ikke nye obligatoriske innleveringskrav. Alle punktene er bevart og gruppert i `issues.md`.

## 2026-10-26 kl. 23:37 — GOplayer007

### Oppgave

Publisere de ferdige lokale Ajour-committene til GitHub med vanlig push, etter brukerens uttrykkelige autorisasjon. Oppdraget deler den kontrollerte revisjonen som følger opp lærerens krav om avgrensning, sporbarhet og sjekkbare kriterier.

### Plan

- Kontrollere repository, remote, `main`, arbeidskopi, indeks og de to angitte committene; hente oppdatert status med `git fetch origin`.
- Kontrollere at push kan gjøres som fast-forward, gjenbruke dokumenterte tester ved uendret kode og fullføre kuratert logg før siste push.
- Pushe `main` til `origin/main` og deretter sammenligne lokal HEAD direkte med `git ls-remote`.

### Resultat

Arbeidskopi og indeks var rene på `main`, HEAD `97a6fafbc04a5a8555a35bc6ca5ca614672ff607`. Både `ffcf0a3` og `97a6faf` inngår i lokal `main`. Fetch-/push-remote er `https://github.com/IBE160-2026/G37-yilmaz.git`. Etter vellykket `git fetch origin` var `origin/main` fortsatt `2d7be923853fed30173399df6c62765103a69ca5`: to lokale commits foran, ingen remote-commits bak. Ancestry-kontrollen bekrefter at disse kan publiseres med fast-forward.

Uavhengig kontroll bekrefter at alle 707 versjonerte ikke-Markdown-appfiler er byteidentiske med begge manifestene fra den dokumenterte commitkontrollen. Tidligere 52 fokustester, 2278 enhetstester og produksjonsbygg gjenbrukes; ingen nye tester er kjørt. Utgående endringer er de tidligere kontrollerte 18 filene. Appen, testresultatene og driftscontaineren er uendret.

Ny personvern-/formatkontroll av 323 dokument-/fixturefiler, inkludert 11 utfoldede ICS, fant ingen nye avvik. Den nye loggteksten er også kontrollert. Dokumentkontrollen fant ingen feil i 489 lokale lenker, 85 ankre eller krav-/storyreferansene; diff-/whitespacekontrollen bestod.

Denne loggoppdateringen ferdigstilles og committes før den autoriserte pushen. Pushresultat, slutthash, direkte remote-sammenligning og endelig Git-status rapporteres etter utførelsen; de er ikke forhåndsregistrert som bestått her.

### Åpne punkter

Ingen nye. De dokumenterte aktivitetene, tekniske begrensningene og manglende vurderingskildene i [issues](issues.md) er uendret; egenutprøving er fortsatt **planlagt / ikke gjennomført**.

## 2026-11-02 kl. 17:27 — GOplayer007

### Oppgave

Gjennomgå gjeldende PRD med de fire valgte metodene i bmad-advanced-elicitation og innarbeide forslagene etter prosjekteierens uttrykkelige «apply». Oppdraget følger opp lærerfeedback om sjekkbare kriterier, produktbehov, avgrensning og sporbarhet.

### Plan

- Kontrollere funn mot brief, stories, arkitektur, brukerveiledning og daterte prøveobservasjoner før redigering.
- Presisere planleggingsresultater, eksisterende bruksgrenser og behovshypoteser; avstemme R-07 mot de dokumenterte observasjonene uten å konstruere nye resultater.
- Kontrollere dokumentkjeden, fakta, personvern, tester og bygg; føre denne kuraterte loggen etter repositoryets loggregel.

### Resultat

[PRD](../.docs/planning-artifacts/PRD.md) er revidert 2. november med tre forskjellige R-03-resultater, betinget Angre, én redigerende nettleserfane og sikkerhetskopiens størrelse-/innholdsgrenser. R-08 har korte behovsbegrunnelser. Tre nyttehypoteser er uttrykkelig uavklarte, og åpne spørsmål har beslutningsstatus og oppfølgingsbetingelse. Rekonstruksjonsdato, krav-ID-er og navngitt V1 er beholdt.

[Scenariomatrisen](../.docs/planning-artifacts/USER-TRIAL-PLAN.md#scenario-dekning-2026-11-02) kobler scenario 1–7 til eksisterende rapporterte observasjoner og dokumentasjonsgrenser. R-07s opprinnelige krav beholdes; full oppfyllelse av alle opprinnelige detaljer er ikke dokumentert. Beståtte enkeltprøver og omprøvinger beholder sine daterte resultater. Brief, stories, sporbarhet og planindeks er samordnet med denne presiseringen. Ingen ny manuell prøve eller effektmåling er gjennomført eller bestilt.

Uavhengig faktasjekk fant ingen konkrete feil i de seks dokumentdiffene. **394 fokustester i tre filer**, **2604 enhetstester i 149 filer** og produksjonsbygg bestod. Det eksisterende bundlevarselet består: 959,61 kB / 293,45 kB gzip. Markdown-lenker, avsnittsmål, stabile krav-ID-er og diffens whitespace er kontrollert. Personvernskanningen kontrollerte 790 filer, inkludert 11 utfoldede ICS-filer, uten treff i de kontrollerte kategoriene. Dette er lokale tekniske kontroller av uendret appkode, ikke nye personlige prøveobservasjoner.

Lærerfeedbacken er lest. Det identifiserte sensorvedlegget var ikke tilgjengelig i denne gjennomgangen; ingen nye sensorkrav er utledet fra sammendraget. Produktendringene gjelder bare dokumentasjon. Denne loggoppdateringen og presiseringen i issues inngår i lokal loggcommit etter prosjektets sesjonsloggregel; de seks dokumentendringene ligger i arbeidskopien. Ingen push eller publisering er utført.

### Åpne punkter

Scenariomatrisens dokumentasjonsgrenser føres under eksisterende punkt om egenutprøvingens omfang i [issues](issues.md). Dette er et dekningsforbehold, ikke en ny feil eller pålagt prøverunde. Nyttehypotesene er akseptert uvisshet i V1. Eksisterende formell sluttkontroll, kildebegrensninger og tekniske begrensninger er beholdt.

## 2026-11-02 kl. 19:03 — GOplayer007

### Oppgave

Validere den oppdaterte PRD-en med bmad-prd etter prosjekteierens valg av Validate. Arbeidskopien med de tidligere godkjente presiseringene er vurderingsgrunnlaget; produktdokumentene skal ikke endres av valideringen.

### Plan

- Gjennomføre uavhengig vurdering av BMADs sju kvalitetsdimensjoner og kontrollere krav/evidens mot kildedokumentene.
- Samle vurderingene i en lokal HTML-rapport og tilsvarende Markdown-rapport, kontrollere rapporten og føre konkrete restfunn i issues.

### Resultat

Valideringen gir **ett medium-funn og to low-funn**, ingen high eller critical. Fire dimensjoner er strong og tre adequate. BMADs oppgitte beregningsregel gir etiketten **Excellent** for dokumentkvalitet; dette betyr verken full produktaksept, rettet R-03-avvik eller akademisk karakter.

R-03s formulering om bekreftede arbeidsvinduer utelater en eksisterende, tydelig merket betinget planleggingsflyt. [Brukerveiledningen](../studieplanlegger/README.md#oppgaver-arbeidssteg-og-egenvurdering) og [simple-planning-testene](../studieplanlegger/tests/unit/simple-planning.test.js) viser at en kort utforskende økt kan godkjennes uten registrerte arbeidsvinduer, mens totalanslaget fortsatt er ukjent. Dette er en dokumentkonflikt, ikke en ny påvist kodefeil. De to små funnene gjelder «lett å finne» uten egen akseptgrense og stedsord som «nedenfor» der direkte avsnittslenker vil gjøre kravene enklere å trekke ut. SC-07s presiserte evidensgrenser og kildeavgrensningen er konsistente.

Samlet rapport er lagret lokalt i Git-ignorert `.tmp/prd-validation-2026-11-02/validation-report.html` og `validation-report.md`, med separate underlagsrapporter. Rapportene er gjennomgått, og HTML-visningen er kontrollert i isolert Chromium: sju dimensjoner, én supplerende reviewer, fungerende utfellingskontroller, ingen sidefeil eller horisontal overflyt på kontrollert bredde. Automatisk åpning i standardnettleseren ble avvist med «Ingen tilgang»; ingen alternativ åpner er forsøkt.

Ny målrettet teknisk kontroll: **8/8 simple-planning-tester bestod** kl. 18:58. Dokumentkontrollen før loggoppdateringen fant 47 Markdown-filer, 721 lokale lenker og 203 avsnittsreferanser uten manglende mål. Åtte dokumentkilder er hashkontrollert før/etter og er uendret. Dagens tidligere 2604 enhetstester og produksjonsbygg gjenbrukes for uendret appkode; de er ikke nye kjøringer i denne valideringen. Lærerfeedbacken er brukt, særlig avgrensning, sjekkbare krav og sporbarhet. Sensororiginalen var utilgjengelig og er ikke erstattet av antatte krav.

Kun denne loggseksjonen og issues oppdateres i Git som lokal loggcommit. De tidligere seks dokumentendringene beholdes i arbeidskopien. Ingen produktretting, ny manuell egenutprøving, push eller publisering er utført.

### Åpne punkter

R-03 må avstemmes mot eksisterende betinget planlegging. Q-01s formulering og direkte interne kravlenker kan presiseres i samme dokumentoppfølging. Funnene står i [issues](issues.md); retting krever et eget Update-valg etter denne valideringen.

## 2026-11-02 kl. 19:18 — GOplayer007

### Oppgave

Rette de tre dokumentfunnene fra PRD-valideringen etter prosjekteierens uttrykkelige «Update». Arbeidet følger opp lærerfeedback om sjekkbare krav, avgrensning og sporbarhet.

### Plan

- Avstemme funnene mot gjeldende beslutninger og eksisterende planleggingsflyt; bevare V1 og dokumentasjonsgrensene for R-07.
- Presisere PRD og S-03, kontrollere fakta, struktur, språk og lenker, og lukke de tre valideringsfunnene i issues.

### Resultat

[PRD](../.docs/planning-artifacts/PRD.md) skiller nå bekreftede arbeidsvinduer fra uttrykkelig merket, betinget tilgjengelighet. En godkjent utforskende startøkt kan lagres mens totalanslaget fortsatt er ukjent; antatt tilgjengelighet blir ikke bekreftet kapasitet. [S-03](../.docs/planning-artifacts/EPICS-CURRENT.md#s-03--gjennomførbare-forslag-r-03-sc-03) har et eget aksepteksempel for dette, forankret i eksisterende brukerveiledning og tester. Kjente begrensninger, konflikter, foreldet grunnlag og uttrykkelig godkjenning gjelder fortsatt.

Q-01 erstatter «lett å finne» med eksisterende, observerbare krav til tom oversikt, samlet tidsvalg/Start og mobilrekkefølge. Kravtabellens henvisninger fra R-03, R-05 og R-06 peker direkte til relevante avsnitt. Én skrivefeil er rettet. Revisjonshistorikken viser oppdateringen; krav-ID-er, rekonstruksjonsdato, navngitt V1 og R-07 er uendret.

Uavhengig avstemming mot alle tre valideringsfunn og en målrettet faktakontroll fant ingen gjenstående feil i dette endringsutvalget. Struktur- og språkkontroll er gjennomført. Underlagsrapportene ligger lokalt i Git-ignorert `.tmp/prd-update-2026-11-02/`; valideringsrapporten fra før retting beholdes som datert vurdering. BMADs minnelogg er opprettet med gjenvunne gjeldende beslutninger og holdes ignorert, slik repositoryets personvernregel krever.

Ny dokumentkontroll før loggoppdateringen: 47 Markdown-filer, 732 lokale lenker og 211 avsnittsreferanser, uten feil. De **8/8 simple-planning-testene fra kl. 18:58**, dagens tidligere **2604 enhetstester i 149 filer** og produksjonsbygg gjenbrukes for uendret appkode; ingen tester eller bygg er kjørt på nytt i Update-runden. Det tidligere bundlevarselet består. Sensororiginalen er fortsatt utilgjengelig; lærerfeedbacken er lest uten å utlede nye sensorkrav.

Personvernkontrollen omfattet 790 filer og 11 utfoldede ICS-filer uten treff i de kontrollerte kategoriene. Diffens whitespace er kontrollert. Minnelogg og lokale vurderingsfiler er bekreftet Git-ignorert.

Valideringspunktet i [issues](issues.md) er lukket for de tre dokumentfunnene. Bare denne loggen og issues inngår i lokal loggcommit; produktdokumentene ligger i arbeidskopien. Ingen ny funksjonalitet, manuell egenutprøving, push eller publisering er utført.

### Åpne punkter

Ingen nye. R-07s eksisterende dokumentasjonsgrenser, de aksepterte nyttehypotesene og øvrige tidligere begrensninger beholdes.
