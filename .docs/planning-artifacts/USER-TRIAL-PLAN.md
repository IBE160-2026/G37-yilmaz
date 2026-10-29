# Plan for egenutprøving av Ajour

**Opprettet 2026-10-16; revidert 2026-10-29. Status: påbegynt med rapporterte avvik; omprøving gjenstår.** Dette er den ene gjeldende prøveplanen for [SC-07](../../brief.md), [R-07](PRD.md) og [S-07](EPICS-CURRENT.md). Filnavnet er beholdt for stabile referanser.

## Rapporterte funn og omprøving — 2026-10-29

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

Nye tekniske resultater føres i [verifikasjonen](../../studieplanlegger/VERIFICATION.md). Ingen rad over betyr at omprøvingen er gjennomført. Samlet egenutprøving, Outlook-prøve og personlig refleksjon er fortsatt ikke ferdige.

**Beslutning 2026-10-26:** Prosjekteieren gjennomfører egenutprøvingen selv. Ingen andre testpersoner skal rekrutteres. Dette erstatter den tidligere planlagte prøven med en ny student; den ble ikke gjennomført eller bestått. Produktets målgruppe er uendret. Prøven dokumenterer bare prosjekteierens bruk og observasjoner, ikke ukjente brukeres forståelse eller generell studentnytte.

## Formål, datagrunnlag og registrering

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

Prosjekteierens rapporterte avvik 2026-10-29 viser at egenutprøvingen er påbegynt. Samlet status er **påbegynt med avvik; omprøving gjenstår**, uten å erklære de sju scenariene bestått. Nye resultater føres med reell dato, versjon og begrensning; de gir ingen representativ vurdering av studentgruppen. Eldre daterte statusutsagn beskriver tilstanden før denne rapporten.

| Scenario | Status nå |
| --- | --- |
| 1–7 | Rapporterte avvik ovenfor; fullstendige resultater per scenario og omprøving mangler |
| Samlet resultat | Påbegynt med avvik; ikke ferdig eller bestått |

Etter prøven kan prosjekteieren med egne ord beskrive hva som var lett eller uklart, og om vedlikehold av oppgaver og anslag var nyttig sammenlignet med egen kalender, Canvas eller oppgaveliste. Dette er åpne refleksjonsspørsmål, ikke forhåndsskrevne svar eller påstand om bedre læring. Personlige rånotater forblir lokale; et kort, anonymisert sammendrag kan senere knyttes til SC-07.

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
