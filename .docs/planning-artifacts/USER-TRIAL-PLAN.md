# Plan for egenutprøving av Ajour

**Opprettet 2026-10-16; revidert 2026-10-26. Status: planlagt / ikke gjennomført.** Dette er den ene gjeldende prøveplanen for [SC-07](../../brief.md), [R-07](PRD.md) og [S-07](EPICS-CURRENT.md). Filnavnet er beholdt for stabile referanser.

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

Inntil prosjekteieren faktisk har gjennomført prøven og oppgitt resultatene, beholdes samlet status **planlagt / ikke gjennomført** i brief, PRD, stories, sporbarhet, verifikasjon og åpne punkter. Resultatet føres med reell dato, versjon og begrensning; det gir ingen representativ vurdering av studentgruppen.

| Scenario | Status nå |
| --- | --- |
| 1–7 | Planlagt / ikke gjennomført |
| Samlet resultat | Planlagt / ikke gjennomført |

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
