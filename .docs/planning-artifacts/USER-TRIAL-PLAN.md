# Plan for egenutprøving av Ajour

**Opprettet 2026-10-16; revidert 2026-11-01 etter prosjekteierens sluttbekreftelse av egenutprøvingen; dokumentasjonsgrensen presisert 2026-11-02. Status: egenutprøving utført av prosjekteier; dokumenterte omprøvinger bestått innen oppgitt omfang.** Dette er den ene gjeldende prøveplanen for [SC-07](../../brief.md), [R-07](PRD.md) og [S-07](EPICS-CURRENT.md). Filnavnet er beholdt for stabile referanser. [Refleksjonsrapporten](../submission/reflection-report.md) foreligger bare som Markdown i repoet; personlig sluttgjennomlesing og innlevering er ikke bekreftet.

<a id="scenario-dekning-2026-11-02"></a>

## Dokumentert dekning av scenario 1–7 — 2026-11-02

SC-07/R-07/S-07 beholder kravet om sju manuelle scenarier med observasjoner per scenario og [akseptkriteriet for hele prøven](#vurdering-og-oppfølging). **Full oppfyllelse av alle opprinnelige scenariodetaljer er ikke dokumentert i de rapporterte observasjonene.** De dokumenterte enkeltprøvene og omprøvingene beholder sine beståttstatuser og er lukket innen oppgitt omfang. Tabellen kobler eksisterende observasjoner til [den opprinnelige oppskriften](#sju-manuelle-scenarier); den endrer ikke kravet eller V1 og bestiller ingen ny prøverunde.

| Opprinnelig scenario | Eksisterende rapporterte observasjoner | Dokumentasjonsgrense |
| --- | --- | --- |
| 1. Opprette med bare tittel, deretter legge til emne, steg og øvrige opplysninger | [Rapporten 1. november](#rapportert-målrettet-omprøving--2026-11-01) beskriver oppgaver uten arbeidssteg og bevarte oppgaver etter omlasting. | Ingen særskilt rapportert observasjon dekker hele forløpet fra bare tittel til etterfølgende emne-/steg-/anslagsregistrering etter oppskriften. |
| 2. Forhåndsvise, avbryte og godkjenne en økt i ledig tid | [Rapporten 1. november](#rapportert-målrettet-omprøving--2026-11-01) dokumenterer godkjente og korrekt viste kalenderøkter på 30 minutter med pauser. Den målrettede 1200/30-prøven beholder [bekreftet bestått](#egenutprøving-utført-av-prosjekteier--2026-11-01). | Observasjonene dokumenterer ikke samlet oppskriftens avbrudd uten lagring og økten 10:30–11:00 etter den registrerte opptatte tiden. |
| 3. Registrere faktisk arbeid og gjenstående anslag for en avsluttet økt | [Rapporten 1. november](#rapportert-målrettet-omprøving--2026-11-01) dokumenterer 17 faktiske minutter og 1140 minutter gjenstående, lagret separat på oppgavenivå. | Arbeidsloggen manglet kobling til økten. Rapporten dekker dermed ikke hele oppskriftens økt-/stegkobling eller utfallet med 30 faktiske og 75 gjenstående minutter. |
| 4. Godkjenne og angre omplanlegging etter endret anslag | [Rapporten 1. november](#rapportert-målrettet-omprøving--2026-11-01) dokumenterer umiddelbar Angre etter direkte øktflytting. [Sluttbekreftelsen](#egenutprøving-utført-av-prosjekteier--2026-11-01) dokumenterer bevart angrehistorikk etter import og omlasting. | Dette dokumenterer ikke samlet omplanlegging etter utfallet i scenario 3, med bevart arbeidsutfall når planendringen angres. |
| 5. Fullføre steg, oppgave og innlevering separat | [Rapporten 1. november](#rapportert-målrettet-omprøving--2026-11-01) dokumenterer «Klar til levering» etter avsluttet arbeid og «Levert» etter egen bekreftelse. | Oppgavens arbeid og levering er prøvd separat; egen stegfullføring med fortsatt ufullført oppgave er ikke særskilt rapportert. |
| 6. Kontrollere kalender, emnefarger, navneendring, tema og åpent utkast | [Rapporten 1. november](#rapportert-målrettet-omprøving--2026-11-01) dokumenterer korrekt viste godkjente økter og tastatur-/etikettbetjening i arbeidsdialogene. | Rapporten dekker ikke hele scenarioets sammenligning av emnefarger, navneendring og bevaring av kalenderdato/utkast gjennom System/Lyst/Mørkt. |
| 7. Kontrollere omlasting og sikkerhetskopi/gjenoppretting i en annen isolert instans | [Rapporten 1. november](#rapportert-målrettet-omprøving--2026-11-01) dokumenterer identisk backupinnhold etter omlasting. [Sluttbekreftelsen](#egenutprøving-utført-av-prosjekteier--2026-11-01) dokumenterer gjenoppretting av omtrent 6,62 MB og bevarte data, historikk, papirkurv og ID-er. | Gjenoppretting i en annen ny isolert instans og bevaring av visningsvalg etter oppskriften er ikke særskilt dokumentert. Full nettleseromstart og separat tom profil inngikk heller ikke i siste omprøving. |

Manglende dokumentasjon i en rad er ikke et nytt rapportert appavvik. Automatiske kontroller beholder sine egne datoer og metoder i [sporbarheten](TRACEABILITY.md) og fyller ikke inn manuelle observasjoner. Outlook-prøven 30. oktober og de øvrige beståtte omprøvingene beholder sitt dokumenterte omfang uavhengig av denne kartleggingen.

## Egenutprøving utført av prosjekteier — 2026-11-01

Prosjekteieren har uttrykkelig bekreftet at egenutprøvingen er gjennomført og resultatene kontrollert. Tabellen registrerer eierens resultater, ikke automatiske kontroller eller KI-utført egenutprøving på eierens vegne. Den tidligere åpne målrettede omprøvingen er lukket innen omfanget nedenfor. **SC-07/1200–30 beholder dokumentert bestått, og Outlook-prøven 30. oktober beholder bestått.** Ingen av disse prøvene gjenåpnes her.

| Omprøving | Egen observasjon bekreftet av prosjekteieren | Sluttstatus |
| --- | --- | --- |
| Identisk 500-import | 0 nye, 0 oppdaterte og **525 uendrede elementer**, uten lagringsfeil. | **Bestått** |
| Angre-historikk | Fortsatt **28 oppføringer og 0 byte vekst** etter import og omlasting. | **Bestått** |
| Faktisk stor gjenoppretting | Backup på omtrent **6,62 MB** gjenopprettet **7 → 6 oppgaver**. | **Bestått** |
| Databevaring | Hele datasettet, historikken, papirkurven og ID-ene var bevart etter gjenoppretting og omlasting. | **Bestått** |
| Norske tidsfeilmeldinger | Tre ugyldige eller tvetydige tider ble avvist med forståelige norske meldinger, uten lagring. | **Bestått** |
| Kapasitetsforklaring | Den identiske forklaringen ble vist **én gang** i den kontrollerte visningen. | **Bestått innen prøvd visning** |
| AHO / F06 | **Vår 2031 = semester 10**, **høst 2031 = semester 11** i forhåndsvisningen; ingen emner ble lagret. | **Bestått for etikettene** |

Vedlagt `ajour-pr8-omproving-2026-11-01.html` og `ajour-pr8-500-bestatt-20261101.jpg` er lest som resultatgrunnlag. Filen med `(1)` i det etterspurte HTML-navnet var ikke tilgjengelig; den unummererte filen er den faktisk leste. Original-HTML-en kaller prøven agentutført, men prosjekteierens uttrykkelige korrigering av attribusjonen styrer denne sluttdokumentasjonen. Originale rapporter er beholdt uendret. [Verifikasjonen](../../studieplanlegger/VERIFICATION.md#dokumenterte-resultater) oppsummerer datasettstørrelser, observerte resultater og prøvegrenser. De underliggende backupfilene er ikke lest som del av dokumentasjonsarbeidet.

Dette dokumenterer **omlasting i samme syntetiske profil**. Full nettleseromstart, separat tom profil, kvotegrenser og «Gjenopprett forrige kopi» ble ikke verifisert i denne omprøvingen. Interne skriveoperasjoner ble ikke målt; funksjonsprøvene alene bekrefter heller ikke produksjonscommit, CI eller full sikkerhet. Tidligere tekniske kontroller av andre tilfeller beholder sin egen metode, dato og utfører. NTNU samlet programkilde, den konkrete UiT-tabellen, F03/F05 og nettleserkvoten er dokumenterte begrensninger, ikke nye beståttresultater.

Den opprinnelige sjuscenariomalen nedenfor bevares som prøveoppskrift og historikk. Manglende observasjoner i den gamle malen fylles ikke med antakelser eller automatiske resultater, og den brukes ikke til å pålegge en ny full prøverunde. Ingen generell studentnytte eller forståelse hos ukjente brukere er påvist. Prosjekteierens leverte refleksjonsrapport beholdes som eget dokument med oppgitt KI-hjelp til struktur og formulering.

## Ny lagrings- og importoppfølging — 2026-11-01

**Historisk status før sluttbekreftelsen ovenfor.** Den da planlagte målrettede omprøvingen er nå gjennomført og bestått innen dokumentert omfang. Rapporten og oppfølgingen nedenfor beholdes som før/etter-grunnlag.

`ajour-utvidet-test-2026-11-01(1).html` beskriver agentutførte prøver og er holdt separat fra prosjekteierens personlige egenutprøving. De to nye skjermbildene viser lagringsfeil ved 525 uendrede importelementer og stoppet gjenoppretting. Brukeren rapporterer dessuten omtrent 1,46 MB historikkvekst ved en tidligere identisk reimport og en egen eksport på 6 622 143 byte som kunne forhåndsvises, men ikke erstatte lokale data. Hoveddata var identiske før feil, etter feil og etter omlasting; datatap er ikke påvist. Årsaken og produksjonscommiten ved originalprøven er ikke uavhengig bekreftet.

[Den tekniske sporbarheten](TRACEABILITY.md#gjeldende-sporbarhet-for-omprøvingen--2026-11-01) kobler feilklassene og rettingene til kode og tester med uavhengige syntetiske data. Den bevarer eksisterende bestått **SC-07/1200–30** og **Outlook 30. oktober**. Den nye HTML-rapportens tekniske SC-07-resultat er heller ikke en ferdigmelding av de sju personlige scenariene nedenfor. Tidligere verktøyblokkerte sikkerhetsprøver er ikke utført eller bestått.

Kort målrettet omprøving etter publisering: I en separat syntetisk profil, importer samme 500-hendelsesfil på nytt, kontroller 525 uendrede uten lagringsfeil, og eksporter/gjenopprett den samme sikkerhetskopien. Last på nytt og kontroller at opplysninger og tidligere Angre er beholdt. Før eget resultat og faktisk versjon; **prøven står åpen til du selv har utført den**. NTNU-tomkilde, UiT-terminstøtte og øvrige kildegrenser har egne daterte tekniske forklaringer og er ikke ferdigmeldt som generell lærestedstøtte.

## Rapportert målrettet omprøving — 2026-11-01

**Historisk feilrapport før SC-07-rettingen.** Avviket og den daværende åpne statusen bevares; gjeldende beståttstatus står øverst.

Brukerens vedlegg `ajour-omproving-2026-11-01.html` og skjermbildet `ajour-sc07-nullforslag-20261101.jpg` dokumenterer et gjenskapt avvik på [produksjon](https://ajour-sooty.vercel.app/). Rapporten beskriver Chrome med tom profil ved prøvestart og klokkeslett i Europe/Oslo. Chrome-versjon og faktisk produksjonscommit er ikke uavhengig bekreftet. `460537f864a89d709ae08aca818ef5adbbe0afaf` fra PR #6 er rapportert teknisk status, ikke en verifisert versjonsidentifikasjon for denne UI-prøven. Vedleggenes forslag til videre arbeid behandles som feilrapport; den aktuelle arbeidsbestillingen styrer rettingen.

En uferdig oppgave hadde **1200 minutter gjenstående**, frist **15. november 2026 kl. 20:00**, aktivert «Kan deles i flere økter», ingen arbeidssteg, tomt «Venter på» og ingen forutsetninger. Separat `estimatedMinutes` var ikke satt. Ajour viste 83 timer 45 minutter tilgjengelig mot 20 timer arbeid, men «Ditt neste steg» ga **0 forslag ved 30 minutter** og meldingen «Ingen registrerte arbeidssteg passer sikkert innen 30 minutter.» Kalenderplanleggingen kunne samtidig foreslå **40 økter à 30 minutter**. Avviket vedvarte etter omlasting og senere også med 1140 minutter gjenstående. Rapporten fastslår ikke kodeårsaken; verken totalanslaget eller tidsvalget ble endret for å få 1200/30-prøven til å passere.

Følgende resultater bevares med vedleggets avgrensning. Dette er **rapporterte observasjoner**, ikke nye tester utført under rettingen og ikke en ferdigmelding av prosjekteierens samlede personlige omprøving.

| Berørt flyt | Rapportert resultat 2026-11-01 | Avgrensning og oppfølging |
| --- | --- | --- |
| Stor, delbar oppgave uten arbeidssteg / 1200 minutter totalt og 30 minutter nå | **Avvik**: ingen forslag, også etter omlasting. | Rett og omprøv kort arbeidsøkt uten krav om arbeidssteg eller mindre totalanslag. Bevar reelle blokkeringer og regler for oppgaver som ikke kan deles. |
| Forklaring av totalarbeid og oppdeling | **Fortsatt åpent**: oppdeling lå under «Flere detaljer»; tidsvalget het «Hvor mye tid har du?». | Oppdeling skal være synlig ved totalanslaget, og tidsvalget skal forklare arbeid nå. |
| Kalenderplanlegging og oversikt | **Bestått for rapportert flyt**: 40 × 30 minutter med 10 minutters pauser; de første øktene 1. november 12:15–12:45 og 12:55–13:25 ble godkjent og vist korrekt. | Behold resultatet; det er ikke bevis på at «Ditt neste steg» fungerte. |
| Direkte redigering og umiddelbar Angre | **Bestått for rapportert flyt**: flytting til 2. november 18:00–18:30 ble angret; UI og backup viste opprinnelig plassering 1. november 12:55–13:25. | Den flyttede plasseringen var borte. |
| Faktisk arbeid og gjenstående anslag | **Bestått på oppgavenivå**: 17 minutter faktisk arbeid og 1140 minutter gjenstående ble lagret separat og bekreftet i backup. | Loggen hadde ingen `sessionId`; dette dokumenterer ikke kobling til den opprettede avsluttede økten. |
| Avslutte arbeid og bekrefte levering | **Bestått for rapportert flyt**: kontrolloppgaven ble «Klar til levering» etter «Utført» og 5 faktiske minutter; separat «Bekreft levert» ga «Levert». | Bevar skillet mellom ferdig arbeid og levert. |
| Radio, etiketter og fokus | **Bestått for rapporterte flyter**: etikettklikk og venstre/høyre piltast fungerte i «Registrer arbeid» og «Avslutt». | Ingen ny full matrise av skjermbredder, tema og tekststørrelser er rapportert. |
| Fjerne alle forutsetninger | Tastatur fungerte med Home og Ctrl+Space; ingen egen fjern-alle-kontroll ble observert. | Redigeringen ble avbrutt uten lagring. En tydelig kontroll og forklaring av eksisterende oppgaver gjenstår. |
| Lagring etter omlasting | **Bestått for rapportert datasett**: backupinnhold var identisk før/etter, med 2 oppgaver, 41 studieøkter og 2 arbeidslogger. | Hovedoppgaven var uferdig/ikke levert med 1140 minutter; kontrolloppgaven var ferdig/levert med 0. |

**Outlook er bestått for brukerens viste flyt 2026-10-30.** Brukeren har bekreftet faktisk import av eksporten med 37 hendelser. Resultatet beholdes som brukerens egenutprøving, og prøven gjenåpnes ikke i denne rettingen. Dette bekrefter ikke alle 37 sluttider, gjentatt import, endringsoppdatering eller alle Outlook-klienter. Tidligere daterte utsagn om at Outlook gjenstod beskriver tilstanden før denne bekreftelsen.

«Tilpass selv», smalt vindu, større tekst, tema, UiT/BI/NTNU/HVL-import og 500-hendelsesimport ble ikke omprøvd i vedleggets runde. Tidligere resultater beholder sine egne datoer og forbehold. Den rapporterte kontrolloppgaven med 30 minutter og uten arbeidssteg fikk et forslag, men manglet fristen hovedoppgaven hadde; kontrollen isolerer derfor ikke oppgavestørrelse som eneste forskjell. «Tidsestimat ukjent» på hovedoppgavens kort er et observasjonsspor, ikke en fastslått årsak.

Teknisk oppfølging omtales separat i [verifikasjonsoversikten](../../studieplanlegger/VERIFICATION.md#hva-som-ble-rettet-og-kontrollert). **SC-07 er fortsatt påbegynt med avvik; prosjekteierens personlige omprøving og refleksjon ferdigmeldes ikke av tekniske kontroller.**

Etter publisert retting: Opprett en syntetisk, startklar oppgave med **1200 minutter gjenstående**, oppdeling på og uten arbeidssteg eller forutsetninger. Velg **30 minutter** under «Hvor lenge vil du jobbe nå?», og kontroller at et forslag om 30 minutters arbeid vises mens totalanslaget fortsatt er 1200 og oppgaven fortsatt er uferdig. Noter eget resultat og faktisk versjon.

## Avgrensning av F03 og ny fristregresjon — 2026-11-02

Den lokale HTML-stresstestrapporten fra 29. oktober er funnet. Historisk F03 gjelder «Tekst med klokkeslett blir oppgaver fremfor kalenderaktiviteter»: `stress-text-005.txt` med fem aktivitetslinjer og en overskrift ga seks uvalgte oppgaver. Selve tekstfilen er ikke funnet, og denne historiske prøven er ikke omprøvd eller lukket.

Det nye, syntetiske fristtilfellet gjelder dokumentimport av `Les kapittel 4 innen fredag kl. 14`, alene og sammen med `Innlevering syntetisk test, frist 2026-11-06 kl. 14:00`. Tidligere kunne den første valgte oppgaven få tom frist mens bekreftelsen viste at alt var klart. [Fristavklaringen](../../studieplanlegger/IMPORT.md) retter denne avgrensede feilen. [Verifikasjonen](../../studieplanlegger/VERIFICATION.md) oppgir de faktisk gjennomførte automatiske prøvene; dette er ikke nye resultater fra prosjekteierens egenutprøving og innfører ingen generell tolkning av naturlig språk.

## Rapporterte funn og omprøving — 2026-10-29

Denne seksjonen bevarer rapporten og planlagte prøver slik de stod 2026-10-29. Senere resultater ovenfor gjelder foran eldre åpne statuser; Outlook-prøven skal ikke gjenåpnes.

Den senere HTML-stresstestrapporten er **separat KI-assistert mengdetesting**, beskrevet med begrensninger i [verifikasjonen](../../studieplanlegger/VERIFICATION.md). Den fyller ikke ut eierens resultater nedenfor. Detaljrapportens NHH-forsøk feilet; NIH ga forhåndsvisning med advarsler. Etter retting skal import med mange hendelser og eksisterende emner, bytte av lærested/program under henting, ICS-titler, lenkehjelp og HVL-emnemetadata omprøves med syntetiske data. F03/F05/F06 er ikke ferdigmeldt.

Prosjekteieren har sendt skjermbilder og egne funn fra Ajour. Opplysningene nedenfor er beholdt som **rapporterte observasjoner**, uten å gjøre tekniske kontroller eller en vedlagt KI-rapport til prosjekteierens resultater. Eksakt testcommit, nettleserprofil og full gjennomføring av de sju opprinnelige scenariene er ikke oppgitt. De opprinnelige observasjonsfeltene nedenfor fylles derfor ikke med antatte beståttresultater.

| Grunnlag | Rapportert observasjon | Hva prosjekteieren skal prøve igjen |
| --- | --- | --- |
| Egne skjermbilder / scenario 3 og 6 | Store radioknapper langt fra etikettene i «Hva skjedde?», og fokusellipse over dialogen. Planleggingsdialogen er også berørt. | Åpne begge dialogene, klikk etikettene og bruk Tab/piltaster i lyst/mørkt tema, smalt/bredt vindu og større tekst. Kontroller synlig, avgrenset fokus og tilgjengelige Lagre/Avbryt-knapper. |
| Egne skjermbilder / scenario 1–2 | «Lesing» står i «Venter på». Planforslaget har null økter, uklar blokkering og en aktivitet med ukjent tid/varighet. | Kontroller forklaringen og rett bare egne syntetiske prøveopplysninger uttrykkelig: bruk arbeidssteg for eget arbeid; behold «Venter på» for en reell hindring. Prøv både «Tilpass selv» og «Detaljert tilgjengelighet», lagre ledig tid før fristen, last på nytt og prøv en startklar oppgave. Ventende arbeid skal fortsatt ikke planlegges. |
| Egne importfunn | UiT UIT-279541/H-2025 ga «PDF-kilden kunne ikke leses lokalt». BI lagret fire emner uten undervisning. NTNU HMS0004/AAR4619/AAR4711 høst 2026 ga tomme resultater. Varsler gjentas og campus er motstridende. | Gjenta disse tre kildevalgene og kontroller kildebegrensning før henting, tydelig skille mellom lagrede emner og undervisning, kilde-/campusforklaring og bevarte tidligere data. Tom offentlig kalender er ikke bevis for ingen undervisning. |
| Rapportert kalenderfil | Prosjekteieren oppgir 24 hendelser, alle med epoch-DTSTAMP, og METHOD:PUBLISH. | Last ned en ny kalenderkopi, gjenta eksporten og endre én syntetisk hendelse før ny eksport. Kontroller faktisk import i Outlook separat, inkludert tidssoner, heldag, duplikater og oppdateringsatferd. Filanalyse er ikke Outlook-prøve. |
| Separat KI-rapport / scenario 2, 4 og 6 | KI rapporterer en manglende kommende økt, motstridende «Arbeid gjenstår å planlegge»/«Planlagt» og manglende synlig Angre ved direkte øktredigering. Dette er **ikke prosjekteierens egne observasjoner**. | Sammenlign en framtidig økt i oversikt/kalender med gjenstående og reservert tid. Flytt økten direkte og prøv umiddelbar Angre; last på nytt og kontroller identitet/tid. |

Tilleggsprøvene nedenfor følger den separate KI-assisterte mengderapporten. Bruk bare syntetiske data; før dine egne resultater separat.

| Funn | Konkret omprøving |
| --- | --- |
| F01 | Importer 500 syntetiske hendelser med eksisterende emner. Velg riktig emne i fellesvalgene, rediger én hendelse og kontroller at manglende kobling stopper lagring. Fullfør koblingene, lagre, last på nytt og importer samme fil igjen: riktig emne/tid og ingen nye dubletter. Endre én hendelse med samme UID og kontroller at bare den oppdateres. |
| F02 | Bytt lærested og deretter program mens en henting pågår. Status, semester og campus skal tilhøre det nye valget; et sent gammelt svar eller en feil skal ikke erstatte visningen. |
| F04 | Les lenkehjelpen før henting. En HTML-timeplanside eller en kilde utenfor støtten skal gi forståelig forklaring og vei til filimport; kontroller at en støttet kalender fortsatt kan forhåndsvises. |
| F07/F08 | Eksporter en vanlig hendelse og en studieøkt der tittelen allerede begynner med emnekoden. Kontroller ett kodeprefiks, nytt UTC-tidsstempel ved ny eksport og uendrede UID-er/tider. Den faktiske Outlook-prøven utføres og registreres separat. |
| F09 | Søk HVL DAT100 høst 2026 både med kode og navn. Kontroller emnenavn, publisert campus og variant før lagring. Gjenimport av samme eldre prøveemne skal etter bekreftelse bevare egne navn/notater og oppgave-/hendelseskoblinger, uten dublett. Ukjente felt skal fortsatt være uavklart. |

Nye tekniske resultater føres i [verifikasjonen](../../studieplanlegger/VERIFICATION.md). Ved rapporten 2026-10-29 var ingen rad over registrert som gjennomført omprøving; samlet egenutprøving, Outlook-prøve og personlig refleksjon stod da åpne. Senere resultater er datert separat ovenfor.

**Beslutning 2026-10-26:** Prosjekteieren gjennomfører egenutprøvingen selv. Ingen andre testpersoner skal rekrutteres. Dette erstatter den tidligere planlagte prøven med en ny student; den ble ikke gjennomført eller bestått. Produktets målgruppe er uendret. Prøven dokumenterer bare prosjekteierens bruk og observasjoner, ikke ukjente brukeres forståelse eller generell studentnytte.

## Formål, datagrunnlag og registrering

**Opprinnelig prøveoppskrift.** De tomme feltene og forventningene nedenfor er beholdt fra planleggingen. Faktiske senere resultater er datert ovenfor; denne malen er ikke en ny bestilling om å gjenta beståtte prøver.

Gjennomfør hovedreisen **oppgave → valgfritt arbeidssteg → godkjent studieøkt → utfall → justering**, og kontroller kalender, visningspreferanser og databevaring manuelt. Alle oppgaver, emner, frister og arbeidsutfall i prøven er syntetiske. Et simulert arbeidsutfall i appen skal beskrives som simulert; den faktiske observasjonen er hvordan appen reagerte under manuell betjening.

Bruk et nytt, isolert testmiljø med tom lagring og ny midlertidig nettleserprofil. Ikke bruk port 80, privat originalkalender, reell database, eksisterende profil eller privat sikkerhetskopi. Sikkerhetskopien i scenario 7 skal opprettes fra denne syntetiske prøven og gjenopprettes i en annen ny testinstans. Ingen miljøer startes som del av denne dokumentrevisjonen.

Fyll inn etter faktisk utførelse. Automatiske tester og assistentens tekniske kontroller skal ikke kopieres inn som manuelle observasjoner. Tidligere brukerbekreftelser i prosjektet er heller ikke resultater fra denne nye planen.

| Prøveopplysninger | Fylles inn av prosjekteieren |
| --- | --- |
| Dato(er), klokkeslett og tidssone | — |
| Appversjon/commit og eventuelle lokale kodeendringer | — |
| Isolert testinstans/prosjektnavn og port | — |
| Nettleser, skjermbredde og eventuell forstørring | — |
| Faktiske syntetiske datoer og eventuelle avvik fra oppskriften | — |

## Faste syntetiske verdier

La **D** være oppsettdatoen i Europe/Oslo. Noter de faktiske datoene for D+1, D+2 og D+3. Start med oppgaven **«Les syntetisk eksempelkapittel»**, bare tittel. Opprett deretter emnet **TEST101 – Eksempelfag**, koble oppgaven og legg til steget **«Les første del»**, opprinnelig/gjenstående anslag **60 minutter**, innleveringskrav og frist **D+3 kl. 16:00**. Det finnes ingen ekte innlevering.

Registrer arbeidsvinduer **D+1 og D+2 kl. 10:00–12:00** og opptatt tid **D+1 kl. 10:00–10:30**. Den første studieøkten skal være **D+1 kl. 10:30–11:00**. Utfallsprøven gjøres etter at dette tidsrommet er passert; oppsett og oppfølging kan derfor skje på ulike dager. Ikke registrer en framtidig økt som allerede utført. Registrer det tydelig simulerte utfallet **30 faktiske minutter**, «trenger mer tid» og **75 minutter gjenstående**. Etter utfallsregistrering er økten arbeidshistorikk, ikke lenger en planlagt kalenderøkt. I scenario 6 opprettes derfor en annen syntetisk oppgave med en framtidig økt som beholdes til kalender-/gjenopprettingskontrollen. Dersom andre datoer er nødvendige, dokumenter dem og behold samme forhold mellom opptatt tid, økt og frist.

## Sju manuelle scenarier

Utfør i rekkefølge. «—» betyr ikke registrert, aldri bestått. Ved avvik noteres den konkrete handlingen, hva som skjedde og hva som var forventet. Ikke skriv en personlig vurdering på forhånd.

| Nr. / handling | Forventet resultat | Faktisk observasjon | Feil/avvik | Eventuell omprøving (dato/versjon/resultat) |
| --- | --- | --- | --- | --- |
| 1. Opprett oppgaven med bare tittel og kontroller den. Legg deretter til emne, steg, anslag, frist og innleveringskrav som angitt over, slik at resten av prøven har det nødvendige oppsettet. | Tittel alene kan lagres uten emne, frist eller tid; ukjente felt forblir ukjente. Opplysningene som er valgfrie i produktet, kan legges til etterpå uten at oppgaven fullføres eller dupliseres. | — | — | — |
| 2. Registrer de syntetiske arbeidsvinduene og opptatt tid. Opprett/forhåndsvis en studieøkt, avbryt én gang, og godkjenn deretter økten 10:30–11:00. | Forhåndsvisning/avbrudd lagrer ingen økt. Godkjent økt kobles til riktig oppgave/steg og ligger innenfor ledig tid, uten overlapp med 10:00–10:30. | — | — | — |
| 3. Etter øktens tidspunkt: registrer simulert faktisk arbeid på 30 minutter og nytt gjenstående anslag på 75 minutter. | Faktisk tid og gjenstående arbeid lagres separat. Ajour beregner ikke automatisk 30 minutter gjenstående, fullføring, levering eller mestring fra de loggede minuttene. | — | — | — |
| 4. Noter den lagrede planen, forhåndsvis omplanlegging etter økt/anslagsendring, kontroller ledig tid og frist, godkjenn og velg Angre før andre endringer. | Forslag endrer ingenting før godkjenning. Godkjent plan bruker kjent ledig tid og forklarer eventuell mangel. Angre gjenoppretter planendringen samlet; registrert utfall fra scenario 3 beholdes. | — | — | — |
| 5. Fullfør steget, deretter oppgavens arbeid, og til slutt bekreft den syntetiske innleveringen separat. Noter status etter hvert trinn. | Fullført steg fullfører ikke oppgaven. Ferdig arbeid betyr fortsatt ikke levert. Bare den separate bekreftelsen markerer innlevering; ingen handling sendes til Canvas/lærestedet. | — | — | — |
| 6. Opprett TEST102 – Annet eksempelfag og den ufullførte oppgaven «Les neste syntetiske eksempel» med 30 minutter gjenstående. Godkjenn en fortsatt framtidig økt D+2 kl. 11:00–11:30; ikke registrer utfall på denne. Åpne kalenderen, bytt visning/dato og sammenlign emnene i kalender og oppgaveliste. Endre navnet på TEST101 til «Endret eksempelfag». Prøv System, Lyst, Mørkt og temaknappen; kontroller et åpent utkast. | Den nye økten vises med riktig tidspunkt og emne; det første oppgaveutfallet ligger i arbeidshistorikken. Farge supplerer navn/kode og status. Samme emne beholder farge ved navigasjon og navneendring. Temabytte bevarer kalenderdato, oppgaver og utkast uten å lagre eller endre domenedata. | — | — | — |
| 7. Avbryt eventuelt åpent utkast. Noter begge syntetiske emner og oppgaver, den fortsatt planlagte økten fra 6 og første oppgaves utfall/fullførings-/leveringsstatus. Last siden på nytt. Eksporter sikkerhetskopi fra prøven og gjenopprett den via appens kontroll/bekreftelse i en annen ny isolert testinstans. Last også denne på nytt. | Omlasting og gjenoppretting bevarer opplysninger og koblinger uten tap eller duplikater, inkludert både planlagt økt og registrert arbeidshistorikk. Samme nettleser beholder lagrede visningsvalg ved omlasting. Tema-/fargepreferanser er nettleserlokale og loves ikke overført i sikkerhetskopien; en ny profil kan få standardvalg. | — | — | — |

## Vurdering og oppfølging

For hvert scenario registreres senere **ikke forsøkt**, **bestått**, **avvik** eller **avbrutt**, med konkret observasjon. Et scenario er bestått når alle forventede resultater er observert. Hele SC-07 er oppnådd for denne prøven først når alle sju er utført og bestått, eventuelt etter dokumentert omprøving. Feil og avbrudd er gyldige funn og skal beholdes. En utført prøve med avvik er ikke en bestått prøve.

Prosjekteierens sluttbekreftelse 1. november erstatter den tidligere statusen «påbegynt med avvik; personlig omprøving gjenstår» for de dokumenterte omprøvingene. Førfunnene fra 29. oktober og 1. november beholdes, og de konkrete etterresultatene står øverst. Dette gir ikke grunnlag for å fylle alle tomme felt i den opprinnelige sjuscenariomalen som bestått eller hevde representativ studentnytte. Det innebærer heller ikke at de allerede beståtte prøvene må gjentas.

| Omfang | Status nå |
| --- | --- |
| Dokumenterte omprøvinger 1. november | **Egenutprøving utført av prosjekteier; bestått innen tabellens omfang.** De berørte avvikene er lukket. |
| SC-07/1200–30 og Outlook 30. oktober | Tidligere dokumentert **bestått** beholdes. |
| Opprinnelig scenario 1–7-mal | Beholdt som oppskrift; ikke alle opprinnelige detaljfelt har et særskilt rapportert resultat. Ingen ekstra beståttresultater konstrueres. |
| Full nettleseromstart og separat tom profil | Ikke verifisert i den siste egenutprøvingen; tidligere automatiske/tekniske prøver er separate. |
| Personlig refleksjon | [Rapporten foreligger som Markdown](../submission/reflection-report.md), som eneste rapportformat i repoet. Personlig sluttgjennomlesing og selve innleveringen er ikke bekreftet. |

Den leverte rapporten inneholder prosjekteierens personlige vurderinger; denne prøveplanen dokumenterer forventet mot faktisk resultat. Rapporten gjør ikke tomme scenariofelt til beståtte tester eller egne erfaringer til bevis for generell studentnytte. Personlige rånotater og eldre private refleksjonsutkast forblir lokale; bare den uttrykkelig autoriserte sluttrapporten er lagt i leveringsdokumentasjonen. [Planindeksen](README.md#leveringskontroll--2026-11-01) oppgir malens 3000–5000 ord og hvilke formelle leveringsopplysninger som fortsatt må kontrolleres.

## Valgfri isolert oppstart før egenutprøvingen

Oppskriften nedenfor er videreført fra den eksisterende planen. Den er ikke kjørt i denne dokumentrevisjonen. Bruk en **ny, separat PowerShell-terminal**, fra `studieplanlegger/`. Docker/Compose må være installert og motoren allerede tilgjengelig. Ikke start eller endre brukerens driftsmiljø som del av prøven. Hvis denne isolerte oppstarten ikke kan gjennomføres, noter hindringen; ikke bruk en eksisterende instans som erstatning.

Miljøoverstyringene gjelder bare terminalen og dens prosesser. Det unike prosjektnavnet gir et eget nytt volum; ikke bruk eksisterende prosjekt eller data. For gjenopprettingsdelen i scenario 7 brukes en ny terminal og en ny kjøring av oppskriften, slik at kilde og mål har hvert sitt prosjekt, volum, ledige port og tomme nettleserprofil.

```powershell
$trialProject = 'studieplan-trial-' + [guid]::NewGuid().ToString('N')
$trialProbe = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
$trialProbe.Start()
$env:STUDIEPLAN_PORT = [string]$trialProbe.LocalEndpoint.Port
$trialProbe.Stop()
$env:STUDIEPLAN_SEED = 'false'
$env:STUDIEPLAN_SEED_JSON = ''
docker compose -p $trialProject up --build -d
if ($LASTEXITCODE -ne 0) { throw 'Oppstart feilet; ikke bruk en annen eksisterende instans.' }
docker compose -p $trialProject ps
Invoke-RestMethod "http://127.0.0.1:$env:STUDIEPLAN_PORT/api/health"
```

Vent til `docker compose -p $trialProject ps` viser `healthy` før prøven; gjenta helsekontrollen hvis appen fortsatt starter. Etter prøven stoppes prosjektet i samme terminal:

```powershell
docker compose -p $trialProject down
```

Porten er kontrollert ledig på loopback før oppstart; hvis en annen prosess tar den i mellomtiden, må oppstarten avbrytes og oppskriften kjøres med et nytt prosjekt. Åpne den viste lokale adressen i en ny, tom midlertidig nettleserprofil, og kontroller tom tilstand uten å importere eksisterende nettleserdata. Bruk bare syntetiske data i denne instansen. Siste kommando stopper bare prøveprosjektet og sletter ikke volumet. Noter prosjektnavn og port lokalt hvis stopp må gjøres senere; lukk terminalen etter stopp.
