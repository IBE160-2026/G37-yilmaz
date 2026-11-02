# Ajour – retting etter egenutprøving og KI-assistert mengdetesting

## 2026-10-29 kl. 20:26 — GOplayer007

### Oppgave

Rette og etterprøve prosjekteierens rapporterte avvik og den separate KI-rapporten, deretter innarbeide tilleggene fra mengdetestrapporten på samme branch. Brukeren autoriserte commit, push, PR-integrering og Vercel-publisering når kontrollene består. Lærerfiler, brukerdata, lagringsformat og eksisterende sperrer skulle bevares.

### Plan

- Gjenskape funnene med isolerte syntetiske profiler, kontrollere faktiske offentlige kilder og rette årsakene innen eksisterende støtte.
- Full enhetssuite og bygg med låste avhengigheter, nettleser-/SQLite-regresjon, faktiske preview-prøver og separat gjennomgang før integrering.
- Bevare rapporterte resultater i [prøveplanen](../.docs/planning-artifacts/USER-TRIAL-PLAN.md) og føre nye tekniske bevis i [verifikasjonen](../studieplanlegger/VERIFICATION.md).

### Resultat

Egen branch `fix/ajour-own-trial-20261029` fra `b9abc26`. `618357b` retter radio/fokus, blokkert planlegging, kommende økter/kapasitetsstatus/Angre, UiT-pakking, importpresentasjon og UTC-DTSTAMP. `f476604` retter F01/F02/F04/F07/F08/F09: felles emnevalg og mindre rendering, foreldet status/sene svar, lenkehjelp, ett kodeprefiks og kildebevisste HVL-metadata. Ingen automatisk fjerning av blokkering eller endring av brukerens lagrede plan.

Siste samlede lokale kontroll før NTNU-oppfølgingen: 2451/2451 enhetstester, 95/95 nettleserprøver, 3/3 isolerte Node/SQLite-prøver og bestått produksjonsbygg. Faktisk preview `f476604`: 40/40 berørte brukerforløp, 5/5 faktiske kildeprøver og separat visuell kontroll av alle 24 originalbilder (to dialoger, begge temaer, 390/900/1440 px, 100/200 % tekst). To runder med tre uavhengige kodegjennomganger og oppfølgingskontroller er utført.

`625b2e7` retter en konkret EXPH0100-regresjon funnet av automatisk etterkontroll: publiserte campus tilbys separat og valideres fortsatt mot detaljkilden. Siste låste fullsuite bestod 2453/2453 i 143 filer, produksjonsbygg og 2/2 nye nettleserprøver mot bygget (30,3 s). Rettelsen er separat gjennomgått. Første preview og senere f476604 hadde feilede automatiske kildeprøver; disse er dokumentert som feil. PR #6 er opprettet. Denne loggen skrives før ny preview og integrering; faktisk produksjonsresultat skal etterprøves mot siste commit, og er ikke forhåndsgodkjent her.

UiT-PDF-behandlingen fungerer på Vercel, men H-2025-emnetabellen er et bilde. BI lagrer emner og støtter ikke automatisk undervisningshenting. De tre navngitte NTNU-kalenderne svarte HTTP 200 og null hendelser direkte og gjennom Ajour. HVL DAT100 ga fem varianter med adskilt navn/campus/råetikett. Dette er avgrensede kildeøyeblikksbilder.

Den vedlagte mengderapporten er registrert separat som KI-assistert testing: NHH feilet; NIH ga forhåndsvisning med advarsler. Den er ikke samtidig belastningsprøve, sikkerhetsrevisjon, Outlook-kontroll eller prosjekteierens egenutprøving. Berørte punkter trenger omprøving. Originale lærerfiler og eksisterende CI-/Vercel-sperrer er bevart.

### Åpne punkter

- Prosjekteierens samlede egenutprøving er påbegynt med avvik, ikke ferdig; omprøv punktene i prøveplanen.
- Faktisk Outlook-prøve og personlig refleksjon gjenstår.
- F03 (fri tekst uten kjent format), F05 (NHH/FHS/Samisk kildevalg) og F06 (uverifiserte AHO-semesterår) står åpne innen rapportens begrensninger.
- UiTs bildetabell krever alternativ import; BI-undervisning og kalenderlenker utenfor støtten er fortsatt begrenset.
- Eksisterende bundlevarsel består. Godkjent proposal og overordnet sensorveiledning er fortsatt ikke identifisert; den identifiserte syvsiders veiledningen er kontrollert.

## 2026-11-01 kl. 14:25 — GOplayer007

### Oppgave

Rette gjenskapt SC-07-avvik der en startklar, delbar oppgave med 1200 minutter gjenstående og ingen arbeidssteg ga null forslag ved 30 minutter. Brukeren autoriserte commit, push, PR-integrering og produksjonspublisering med bevarte kontroller, data og tidligere testresultater. Outlook-prøven fra 30. oktober skulle forbli bestått, og tekniske prøver skulle ikke ferdigmelde personlig omprøving.

### Plan

- Lese prosjektinstruksjoner, tilbakemelding, identifisert sensorveiledning og relevant spesifikasjonskontekst; bruke vedleggene som feilrapport og gjenskape med syntetiske data.
- Rette forslag og forklaringer, beholde blokkeringer og ikke-delbart arbeid, gjøre oppdeling og fjerning av forutsetninger synlig og tastaturtilgjengelig.
- Kontrollere bygget app, faktisk preview og produksjon, inkludert samme syntetiske profil før/etter publisering. Bevare rapporterte resultater i [prøveplanen](../.docs/planning-artifacts/USER-TRIAL-PLAN.md) og teknisk evidens i [verifikasjonen](../studieplanlegger/VERIFICATION.md).

### Resultat

Arbeidet ble gjort i egen arbeidskopi fra `460537f`; annen arbeidskopi, pågående dokumentasjonsarbeid og brukerdata ble bevart. Førkontrollen identifiserte denne produksjonsversjonen uavhengig, men bekrefter ikke retroaktivt commit ved brukerens skjermbilde. `rankedSuggestions` brukte ikke den eksisterende `includePartial`-støtten, og krevde dermed at hele totalen passet i tidsvalget. Feilen ble gjenskapt både i nettleser og regresjoner før retting.

`827f672` tillater deløkter på startklart, delbart arbeid og skiller totalen fra tiden nå. Reelle blokkeringer, forutsetninger, ikke-delbart arbeid, lagring, backup, kalender og Angre beholdes. «Hvor lenge vil du jobbe nå?» og synlig oppdelingsvalg forklarer total/økt; forutsetninger beskrives som eksisterende oppgaver og har egen tastaturtilgjengelig fjernknapp. Deløkten endrer ikke anslag eller ferdigstatus automatisk, og faktisk tid registreres separat. `92541e8` presiserer en statusselektor i to lagringsfeiltester uten å svekke bevaringskravene. Uavhengig gjennomgang og oppfølgingslesning fant ingen konkrete uløste feil.

Siste lokale fullsuite bestod 2467/2467 enhetsprøver; bygget nettleserpakke 107/107, SC-07-utvalg 10/10, SQLite 3/3 og undervisningsfixturer 141/141. Produksjonsbygg bestod med eksisterende bundlevarsel. Tidligere tidsavbrudd, kollisjon i testutdata og mislykkede mellomkjøringer beholdes som feil i verifikasjonen. Siste preview bestod 40/40 automatiske kontraktprøver, 6/6 faktiske kildeprøver og separat 10/10 SC-07. Først da ble [PR #7](https://github.com/IBE160-2026/G37-yilmaz/pull/7) integrert normalt som `2057984904874b586ab4b3dbe2302bef47e41ddb` på main.

Main-kontrollen [41310394274](https://github.com/IBE160-2026/G37-yilmaz/actions/runs/41310394274) bestod 2467/2467 enhetsprøver, bygg, 107/107 nettleserprøver og 3/3 SQLite. Vercel meldte produksjonen vellykket. [Produksjonen](https://ajour-sooty.vercel.app/) viste samme fullstendige commitmarkør før og etter **10/10 SC-07-prøver** (45,4 s). Alle seks produksjonsbilder ved 1440/390 px ble vurdert uten nye visuelle avvik. Samme eide syntetiske profil fra før publisering bestod **1/1** gjenåpning med eksakt bevart lagring og preferanser (4,8 s). [Automatisk produksjonskontroll 41310830999](https://github.com/IBE160-2026/G37-yilmaz/actions/runs/41310830999) bestod **40/40 kontraktprøver og 6/6 faktiske kildeprøver**. CI og Vercels domenesperre ble beholdt; ingen administratoromgåelse eller tvangspromotering ble brukt.

`30fed6e` dokumenterer disse publiserte resultatene. Den etterfølgende loggoppdateringen gjelder bare Markdown. Personvernkontrollen før dokumentasjonscommit omfattet 769 tekstfiler og 11 utfoldede ICS-filer uten funn; 39 dokumenter, 545 lokale lenker og 113 ankre bestod lenkekontrollen. Rårapporter, bilder og syntetiske profiler holdes utenfor Git. Arbeidet følger lærerens punkter om testbare krav, tydelig brukerflyt og sporbar etterprøving av KI-retting.

Outlook-punktet i `issues.md` er lukket på grunnlag av brukerens bekreftede 37-hendelsesflyt 30. oktober, ikke en ny teknisk Outlook-prøve. Tidligere daterte resultater og begrensninger er bevart. Personlig SC-07-omprøving og refleksjon er fortsatt åpne; en kort 1200/30-prøve står i prøveplanen.

### Åpne punkter

- Prosjekteierens personlige SC-07-omprøving og egen refleksjon gjenstår; de tekniske produksjonsprøvene erstatter dem ikke.
- Tidligere importbegrensninger F03/F05/F06, UiTs bildetabell, BI-undervisning og avviste kalenderkilder beholdes som egne punkter i `issues.md`.
- Eksisterende bundlevarsel og tidligere åpne vurderingskilder beholdes i `issues.md`; denne rettingen utvider ikke prosjektets omfang.

## 2026-11-01 kl. 17:32 — GOplayer007

### Oppgave

Følge opp lagringsvekst ved identisk 500-import, stor backupgjenoppretting og avgrensede kilde-/presentasjonsfunn på samme arbeidsgren. Brukeren autoriserte hele løpet gjennom GitHub og Vercel med bevarte sperrer, brukerdata, Angre og tidligere testhistorikk.

### Plan

- Lese vedlegg som feilrapport, måle faktiske skriverier og feil med egne syntetiske data, og rette lagring/gjenoppretting først.
- Kontrollere NTNU, AHO og den konkrete UiT-PDF-en mot offentlige kilder, med avgrensede norske forklaringer.
- Uavhengig kodegjennomgang, full lokal kvalitetspakke og deretter kontrollert publisering. [Prøveplan](../.docs/planning-artifacts/USER-TRIAL-PLAN.md) og [verifikasjonsoversikten](../studieplanlegger/VERIFICATION.md) bevarer skillet mellom eierens og agentens prøver.

### Resultat

`1ecea29362f4cb81ecc1b99c325eb5459facad8c` retter metadatautløst historikkvekst, identiske skriverier, doble recovery-representasjoner og misvisende feilklassifisering. Syntetisk identisk reimport gikk fra **+1 144 543 byte historikk per gang til 0 byte / 0 skriverier**. En eldre formatert backup på **6 843 299 byte** består i tom, identisk og endret stor profil; sistnevnte bruker **360 347 byte** recovery. Både ekte kvotefeil og kontrollerte tilgangs-/ukjente feil bevarer opprinnelige data og tidligere recovery etter omlasting. Ingen gammel historikk er ekstra slettet for å skaffe plass; eksisterende 30-oppføringsgrense beholdes.

Eksport forklarer historisk innhold. Ugyldige/tvetydige klokkeslett avvises fortsatt med norske forklaringer, og identiske kapasitetsgrunner vises én gang. NTNUs publiserte programkatalog svarte faktisk tomt før filtrering; dette forklares uten falsk fullstendighet. TDT4109 ga fortsatt 115 hendelser. AHOs årshopp finnes i kilden; studiesemesteretikettene er rettet til 1–7, 10, 11 uten å endre årstall eller koblinger. UiTs konkrete engelske Applied Computer Science-PDF gjenkjennes, men termin-/ECTS-tabellen støttes ikke som semesterfordeling.

Siste lokale kontroll: **2529/2529 enhetstester, 127/127 bygde nettleserprøver, 3/3 SQLite, 141/141 undervisningsfixturer og produksjonsbygg**. To runder med tre uavhengige gjennomganger; siste oppfølging uten uløste kodefunn. 779 tekstfiler / 11 utfoldede ICS og 39 dokumenter / 552 lokale lenker / 116 ankre uten funn eller feil. Tidligere mislykkede kontroller er bevart i verifikasjonen. Store syntetiske profiler, bilder og råvedlegg holdes utenfor Git.

Begge GitHub-kvalitetssjekkene og faktisk Vercel-preview bestod. [Previewkontroll 41324922345](https://github.com/IBE160-2026/G37-yilmaz/actions/runs/41324922345) ga **60/60 funksjonsprøver og 6/6 faktiske kildeprøver** før [PR #8](https://github.com/IBE160-2026/G37-yilmaz/pull/8) ble integrert normalt som **`a7fb9435c2b47e53146190cdd8f819dd91133ebb`**. Main-kontrollen bestod 2529 enhetsprøver, bygg, 127 nettleserprøver og tre SQLite-prøver. Vercel meldte produksjonsdeployment `7475716325` vellykket. Ingen sperre ble omgått.

[Produksjonen](https://ajour-sooty.vercel.app/) viste eksakt samme merge-commit før og etter **30/30 separate målrettede nettleserprøver (5,9 min)**. [Automatisk produksjonskontroll 41326144049](https://github.com/IBE160-2026/G37-yilmaz/actions/runs/41326144049) bestod **60/60 funksjonsprøver og 6/6 faktiske kildeprøver**. Tre ekstra faktiske kilde-UI-flyter for NTNU/TDT4109, AHO og UiT bestod med uendrede lagrede byte etter omlasting; fire bilder ble vurdert. De to lagringsbildene ved 1440/390 px ble også vurdert. Identisk import ga fortsatt null vekst/null skriverier; stor gjenoppretting og ekte/innsprøytede feil bevarte data og historikk. Samme eide syntetiske profil fra `bbbf1bb` bestod **1/1** etterkontroll med eksakt samme lagring og preferanser. SC-07 er fortsatt teknisk bestått; brukerens Outlook-prøve fra 30. oktober gjenåpnes ikke.

`34bb684` dokumenterer de publiserte resultatene i verifikasjonen. Denne loggoppdateringen og dokumentasjonscommiten endrer bare Markdown. Personvernkontrollen omfattet 779 tekstfiler / 11 utfoldede ICS; 39 dokumenter / 558 lokale lenker / 116 ankre bestod før dokumentasjonscommit. Sluttmarkør og kontroll for den etterfølgende dokumentasjonspubliseringen føres i PR #8; vellykket push alene regnes fortsatt ikke som publisering.

### Åpne punkter

- Personlig omprøving og refleksjon forblir åpne. Tidligere verktøyblokkerte sikkerhetsprøver er ikke gjennomført; ingen generell sikkerhetskonklusjon gis.
- NTNUs tomme programkatalog, UiTs konkrete termin-/ECTS-tabell og tidligere F03/F05-/importbegrensninger er dokumenterte begrensninger. F06-årshoppet er nå kildebekreftet og semesteretikettene rettet.
- Nettleserlagring er fortsatt begrenset; rettingen lover ikke ubegrenset plass eller transaksjoner mellom faner. Bruk én redigerende fane. Eksisterende bundlevarsel og tidligere åpne vurderingskilder beholdes.

## 2026-11-01 kl. 19:23 — GOplayer007

### Oppgave

Ferdigstille dokumentasjon og leveringsoversikt etter prosjekteierens bekreftede egenutprøving, avgrenset til dokumentasjon, leveringskontroll og publisering. Prosjekteieren autoriserte commit, push og PR-integrering etter nødvendige kontroller, med bevarte CI-/Vercel-sperrer og uten nye funksjoner eller unødvendig gjentakelse av beståtte prøver.

### Plan

- Lese prosjektinstruksjoner, lærerfeedback, alle sju sider av identifisert sensorveiledning og de faktiske vedleggene som kildemateriale.
- Samordne eksisterende krav-/prøve-/leveringsdokumenter, føre eierens egne resultater korrekt, bevare teknisk historikk og beskrive gjenværende grenser.
- Kontrollere dokumentlenker, filutvalg og påkrevde tester; bruke eksisterende PR-/publiseringsløp og dokumentere faktisk sluttversjon i [PR #10](https://github.com/IBE160-2026/G37-yilmaz/pull/10).

### Resultat

`eb72b2d` oppdaterer elleve eksisterende Markdown-dokumenter: README-ene, brief, PRD, planindeks, stories, sporbarhet, prøveplan, verifikasjon, løsningsguide og utviklingsprosess. `e908fab` lenker verifikasjonen til publiseringsbeviset i PR #10. Appkode, tester, avhengigheter, data og arbeidsflyter er uendret; annen åpen PR og andre arbeidskopier er bevart.

De sju oppgitte omprøvingsresultatene føres som **egenutprøving utført av prosjekteier**: identisk 500-import med 525 uendrede, 28 Angre-oppføringer/0 byte vekst, faktisk 6,62 MB-erstatning fra 7 til 6 oppgaver, bevart datasett/historikk/papirkurv/ID-er etter omlasting, tre norske tidsfeilmeldinger, én kapasitetsforklaring og AHO 2031-semester 10/11. SC-07/1200–30 og Outlook 30. oktober beholder bestått. Disse konkrete restpunktene er lukket i `issues.md`; personlig refleksjon er fortsatt åpen.

Den faktiske HTML-filen finnes uten `(1)`. Rapportens tidligere «agentutført»-merking er uttrykkelig avklart mot prosjekteierens nyere bekreftelse. Original HTML/JPG er ikke endret eller committet; sjekksummene står i verifikasjonen. De fem underliggende eksportfilene er ikke lest. Opprinnelige tekniske rapporter og mislykkede forsøk beholdes som før/etter-bevis. Ingen slutning om produksjonscommit, interne skriverier eller full sikkerhet trekkes fra funksjonsprøvene.

Den tilgjengelige sensorveiledningen er kontrollert med samme SHA-256 som planindeksen. Brief/PRD beskriver produktmål og krav; detaljresultater ligger i prøve-/verifikasjonsdokumentasjonen. README gir én samlet begrensningsoversikt med V1-betydning og oppfølging. Utviklingsprosessen har en kort refleksjonsdisposisjon med spørsmål, uten oppdiktede personlige erfaringer. Dette følger lærerens punkter om avgrenset V1, sporbarhet, testbevis og styring av KI.

Lokal påkrevd enhetskjøring ga først 2528/2529 med ett 5000 ms-tidsavbrudd i den eksisterende 500-hendelsesprøven. Uendret fullsuite med to arbeidere bestod **2529/2529, 147 filer, 161,63 s**. Ingen tidsgrense eller test ble endret. Bygg bestod **1,72 s**, med kjent bundlevarsel. Lenke-/ankerkontroll før loggoppdateringen: **39 dokumenter, 605 lokale lenker, 130 ankre, ingen feil**. Avgrenset filkontroll: **779 tekstfiler / 11 utfoldede ICS, ingen funn i undersøkte mønstre**. Uavhengig dokumentkontroll fant en foreldet Outlook-rad og små presiseringsbehov; disse er rettet.

Ved denne oppfølgingens start viste GitHub main og produksjonens `/release.json` uavhengig **`c7bd8f557e715c29ae0e3813bc2d91fb8c4c25fe`**. Denne loggen skrives før PR-ens avsluttende CI/publisering; den forhåndsgodkjenner ikke ny produksjon. Faktisk main-commit, deployment, produksjonsmarkør og CI-resultater føres i den lenkede PR #10 etter fullføring. Ingen direkte hovedgren-push eller omgåelse av sperrer er planlagt.

### Åpne punkter

- Prosjekteieren må skrive personlig refleksjon fra egne erfaringer, kontrollere formell frist/kanal/format og gjennomføre innleveringen. Godkjent proposal og overordnet veiledning er ikke identifisert.
- NTNU-tomkilden, UiTs konkrete termin-/ECTS-tabell, F03/F05, tidligere kildegrenser, nettleserkvote og bundlevarsel står som dokumenterte begrensninger; full nasjonal dekning er ikke et nytt V1-krav.
- Full nettleseromstart, separat tom profil og forrige-kopi-handlingen inngikk ikke i siste egenutprøving. Tidligere verktøyblokkerte sikkerhetsprøver er ikke gjennomført. Ingen ny full omprøving bestilles av dokumentarbeidet.
