# Studieplan

## Full-stack drift med Docker

Den komplette leveransen bygger nettleserklient, Node-server og SQLite-database fra de låste npm-avhengighetene. Node-basisbildet bruker den valgte, mutable taggen `node:24-bookworm-slim`. Skjemaet opprettes automatisk, og databasen ligger i et navngitt Docker-volum.

Kommandoen nedenfor er runtime-verifisert fra en ren leveransekopi. Den bygger klient og server, oppretter SQLite-skjemaet automatisk og starter den lokale tjenesten:

```powershell
docker compose up --build -d
```

Kjør kommandoen i mappen som inneholder denne README-filen, uavhengig av hvor kildekoden er pakket ut.

Åpne **http://127.0.0.1:8088**. Kontroller drift med `docker compose ps` eller `Invoke-RestMethod http://127.0.0.1:8088/api/health`, og stopp med `docker compose down`. Ikke bruk `-v` hvis dataene skal beholdes. `studieplan-data` er Compose-nøkkelen; med standard prosjektnavn blir det faktiske Docker-volumet normalt `studieplanlegger_studieplan-data`. Volumet gjør at `/data/studieplan.sqlite` overlever en ny container. Vertspubliseringen er uttrykkelig bundet til `127.0.0.1`; serveren lytter på 0.0.0.0:8080 inne i containerens eget nettverk. Dette gir tilgang via den publiserte loopback-porten og er ikke LAN-publisering av vertsporten.

En ny database starter tomt. Valgfri seed er av som standard og gjelder bare en helt tom database. Kopier `.env.example` til `.env`, sett `STUDIEPLAN_SEED=true` og oppgi en komplett validert v1-envelope på én JSON-linje i `STUDIEPLAN_SEED_JSON`. Verdien `{"schemaVersion":1,"tasks":[]}` i `.env.example` er en gyldig tom envelope. Seed overskriver aldri eksisterende data.

Ved første åpning kan en tom database finne gyldige browserdata fra samme opprinnelse. Appen viser en opptelling og ber om eksplisitt bekreftelse før den importerer en kopi. Serveren arkiverer eksakt råtekst og et fingeravtrykk; gjentakelse er en no-op, og originalen i nettleseren slettes eller omskrives aldri. Ved bytte fra en annen opprinnelse brukes eksisterende portabel eksport/gjenoppretting. Private kalenderlegitimasjoner er fortsatt utelatt og må kobles til igjen.

Docker-/produksjonsleveransen bruker SQLite som autoritativ lagring. Hver sammensatt endring valideres som en komplett envelope på serveren, sammenlignes med forventet revisjon og skrives i én transaksjon før nettleserminnet oppdateres. Domeneobjekter har relasjonelle identitets-/koblingskolonner og tapsfri JSON for valgfrie leverandørfelt. Vite-kommandoene nedenfor beholder browserlagring for rask utvikling og den etablerte isolerte UI-regresjonen; de er ikke den komplette databaseleveransen.

### Avgrensede arbeidsflytrettinger — 2026-10-02

Blandede eldre/nye arbeidssteg bevares med stabile ID-er, rekkefølge, fullføring og forutsetninger. Begge fjernhandlingene stopper når andre steg er avhengige av steget og forklarer hvilke forutsetninger studenten må endre. Ved gjenbruk av et tema vises eksamensdatoen; et urørt felt beholder datoen, mens et uttrykkelig tømt felt fjerner den. Vurderingen gjelder temaet, med en valgfri økt som uavhengig kontekst. Eksporten bruker det faktiske temanavnet for repetisjon uten oppgave og navngir utelatte frister med årsak. Programvelgerens norske navnerekkefølge og variantidentiteter er kontrollert gjennom gjenoppretting. Se [daterte sluttresultater og gjenværende grenser](VERIFICATION.md).

Sluttkontrollen etter reviewrettingene bestod **1378 enhetstester i 109 filer, 40 berørte nettleserforløp og 3 ordinære Node/SQLite-forløp**, med normal avslutning og nytt produksjonsbygg. Det separate syntetiske produksjonsforløpet bestod i tillegg **1 create + 1 restore** både etter Node-restart og Docker-gjenskaping. Docker beholdt eksakt tilstand ved revisjon 11; restore ga 13, med integritet OK og ingen FK-brudd. Tidligere og mellomliggende Docker-kjøringer nedenfor er historikk.

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

På mobil er hovedmålene i bunnmenyen; øvrige valg ligger under «Mer». «Innstillinger» samler sikkerhetskopi, angre/papirkurv, oppstart og personlige estimater.

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

«Mine emner → Importer emner og plan» åpner studieprogram som hovedflyt; dokument/tekst og kalender er sekundære valg i samme område. Appen har 48 registrerte programadaptere og en datert oversikt over 49 norske institusjoner. Dette er **ikke full nasjonal dekning**: AHO har en avgrenset, verifisert programflyt, mens det slettede Ekko-foretaket fortsatt mangler en gjeldende selvstendig kullkatalog. [Importoversikten](IMPORT-COVERAGE.md) oppgir faktisk støtte, kilde, dato og begrensning for hver datatype. Et prøvd program eller emne beviser bare den prøvde flyten.

Velg publisert programutgave, opptakskull, studiesemester og kalendersemester uttrykkelig når kilden trenger dem. Campus vises bare når kilden gir et reelt valg. Påkrevde emner vises separat fra kildepubliserte alternativer; ingen alternativ gren velges for studenten, og studiepoengsum brukes bare som informasjon. Et manglende emne kan søkes opp eller registreres som en tydelig uverifisert post uten at programkonteksten må fylles inn på nytt. Det påbegynte utvalget beholdes ved kildefeil, tilbakegang og omlasting i samme fane, men regnes ikke som importert. Tilgjengelig undervisning kan kontrolleres samlet, men hvert emne beholder statusen «klar», «ingen treff», «feil» eller «krever tilgang», og bare mislykkede kilder prøves på nytt. Gruppemedlemskap utledes aldri fra et treff. Emner og vellykket undervisning lagres med én bekreftelse; kvitteringen sier presist hvor undervisning faktisk ble importert. Offentlig undervisning kan også hentes for et emne som allerede er lagret, selv når programimport mangler.

Kalenderpanelet har tre valg som åpnes ett om gangen: fil/lenke, offentlig institusjonskalender og undervisning for et lagret emne. Aktiviteter må velges før lagring. Kildeopplysninger og mangler kan åpnes i forhåndsvisningen. Kalenderinformasjon, faktiske undervisningsaktiviteter og innleveringsfrister holdes adskilt.

Dokumentimport støtter innlimt tekst, tekstbasert PDF, DOCX, CSV og ICS. Filene leses lokalt, med grenser på 10 MB for PDF/DOCX, 100 PDF-sider og 2 MB for tekst/CSV/ICS. Skannede eller uleselige dokumenter får en forklaring og vei til innlimt tekst/manuell registrering. Appen utfører ikke dokumentinnhold eller laster eksterne dokumentressurser.

Forhåndsvisningen viser forslag til emner, oppgaver, frister og aktiviteter med kildeutdrag. Rett felter, velg bort rader og koble til eksisterende emner. Uklare datoer, manglende år og usikre koblinger må avklares eller uttrykkelig utelates. Feil åpner den berørte raden og flytter fokus til feltet. Kildevarsler om eksempelvis uleselige PDF-sider bevares etter lagring og vises ved senere oppdatering. Ingenting lagres før bekreftelse.

Gjentatt import bevarer stabile identiteter og egne endringer. Endrede dokumenter kan kobles til en tidligere kilde; usikker samsvar og konflikter krever valg. Kalenderlenker oppdateres mens appen er åpen, med ventetid ved kildefeil. Tidligere data beholdes ved feil. Private lenker og tilgangsnøkler lagres lokalt; filer er øyeblikksbilder. Enkelte offentlige kilder har ustabile ID-er eller ukjent fullstendighet, slik at en flyttet aktivitet må avklares manuelt. Se [importbeskrivelsen](IMPORT.md).

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

Importerte eksamener beholder et strukturert aktivitetsmerke gjennom oppdatering og lagring. Strukturert `assessment` beholdes som generell vurdering og blir ikke automatisk eksamen, heller ikke for transparente punktoppføringer. Eldre hendelser gjenkjennes bare når tittelen eksplisitt sier «eksamen», `exam` eller `examination`; eksamensforberedelse, prøve-/mockeksamen, forelesninger om eksamen og generelle vurderingsord behandles ikke som eksamen. Kalender, agenda, dagsoversikt og emnevisning viser `📝 Eksamen`, emnet og en egen aksent uten å endre undervisningsfilter, tidsreservasjon eller eksportvalg.

Kalenderens ukevisning kan vise hele uken eller arbeidsuken. På mobil er dagvisningen standard. Dato, kalenderfiltre, ukemodus og rulleposisjon bevares gjennom navigasjon og sikkerhetskopi. Korte eller overlappende hendelser beholder faktisk varighet og har lesbare detaljkontroller; lange titler kan åpnes i sin helhet. Dagsoversikten samler økter og frist for samme oppgave.

Appen bruker fortsatt `studieplanlegger:v1` med valgfrie nye felt. Støttede eldre sikkerhetskopier kan åpnes. Oppstart skriver ikke om gammel lagring; uleselige data sperrer endring og gir gjenopprettingsvalg. Vite-utviklingsmodusen bruker browserlagring og bør ha én redigerende fane. Docker-/produksjonsmodusen bruker Node/SQLite med revisjonskontroll: en foreldet skriving avvises som konflikt og krever ny innlesing, slik at nyere serverdata ikke overskrives stille.

Eksport/gjenoppretting, angre og papirkurv finnes i innstillingene. Portabel sikkerhetskopi bevarer opplysninger og relasjoner, men utelater kalenderforbindelser og kjente tilgangsnøkler. Kildene må kobles til igjen etter gjenoppretting. En gjenoppretting viser innholdet før bekreftelse og beholder en lokal gjenopprettingskopi av forrige tilstand.

Frister lagres som lokale datoer/klokkeslett, og importert undervisning vises i norsk tid. Bruk samme lokale tidssone; flytting mellom tidssoner er ikke fullstendig støttet. Ikke-eksisterende eller tvetydige klokkeslett ved tidsskifte må avklares. Studieøkter kan krysse midnatt med eksplisitt sluttdato.

I Vite-utviklingsmodusen kan sletting av nettleserdata slette planen fordi denne modusen bruker `localStorage`. I Docker-/produksjonsmodusen er SQLite autoritativ; sletting av browserdata sletter ikke databasen, men kan fjerne en uimportert nettleseroriginal. Oppbevar uansett egne sikkerhetskopier utenfor kildekoden eller i `local-backups/`. Private dokumenter og arbeidsfiler hører hjemme utenfor delbar kode; relevante lokale mapper og genererte rapporter er ignorert.

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

Det konsoliderte BMAD- og prosjektmaterialet finnes under `../.docs/implementation-artifacts/`. [Fullstack-spesifikasjonen](../.docs/implementation-artifacts/spec-fullstack-database-docker-delivery.md), [løsningsguiden](../.docs/implementation-artifacts/solution-guide.md) og [utviklingsprosessen](../.docs/implementation-artifacts/development-process.md) er beholdt. Teknisk kontroll er ikke en dokumentert brukermåned eller studentens personlige refleksjon.
