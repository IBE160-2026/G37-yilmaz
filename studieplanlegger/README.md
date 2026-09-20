# Studieplan

## Full-stack drift med Docker

Den komplette leveransen bygger nettleserklient, Node-server og SQLite-database fra de låste npm-avhengighetene. Node-basisbildet bruker den valgte, mutable taggen `node:24-bookworm-slim`. Skjemaet opprettes automatisk, og databasen ligger i et navngitt Docker-volum.

Kommandoen nedenfor er runtime-verifisert fra en ren leveransekopi. Den bygger klient og server, oppretter SQLite-skjemaet automatisk og starter den lokale tjenesten:

```powershell
docker compose up --build -d
```

Kjør kommandoen i mappen som inneholder denne README-filen, uavhengig av hvor kildekoden er pakket ut.

Åpne **http://127.0.0.1:8088**. Kontroller drift med `docker compose ps` eller `Invoke-RestMethod http://127.0.0.1:8088/api/health`, og stopp med `docker compose down`. Ikke bruk `-v` hvis dataene skal beholdes. `studieplan-data` er Compose-nøkkelen; med standard prosjektnavn blir det faktiske Docker-volumet normalt `studieplanlegger_studieplan-data`. Volumet gjør at `/data/studieplan.sqlite` overlever en ny container. Vertspubliseringen er uttrykkelig bundet til `127.0.0.1`; serveren lytter på port 8080 inne i containeren.

En ny database starter tomt. Valgfri seed er av som standard og gjelder bare en helt tom database. Kopier `.env.example` til `.env`, sett `STUDIEPLAN_SEED=true` og oppgi en komplett validert v1-envelope på én JSON-linje i `STUDIEPLAN_SEED_JSON`. Verdien `{"schemaVersion":1,"tasks":[]}` i `.env.example` er en gyldig tom envelope. Seed overskriver aldri eksisterende data.

Ved første åpning kan en tom database finne gyldige browserdata fra samme opprinnelse. Appen viser en opptelling og ber om eksplisitt bekreftelse før den importerer en kopi. Serveren arkiverer eksakt råtekst og et fingeravtrykk; gjentakelse er en no-op, og originalen i nettleseren slettes eller omskrives aldri. Ved bytte fra en annen opprinnelse brukes eksisterende portabel eksport/gjenoppretting. Private kalenderlegitimasjoner er fortsatt utelatt og må kobles til igjen.

Docker-/produksjonsleveransen bruker SQLite som autoritativ lagring. Hver sammensatt endring valideres som en komplett envelope på serveren, sammenlignes med forventet revisjon og skrives i én transaksjon før nettleserminnet oppdateres. Domeneobjekter har relasjonelle identitets-/koblingskolonner og tapsfri JSON for valgfrie leverandørfelt. Vite-kommandoene nedenfor beholder browserlagring for rask utvikling og den etablerte isolerte UI-regresjonen; de er ikke den komplette databaseleveransen.

### Docker-kjørestatus på denne PC-en

Den tidligere lagoverføringsfeilen `local error: tls: bad record MAC` er ikke lenger en aktiv leveransehindring: `node:24-bookworm-slim` ble hentet, og det faktiske Compose-bygget fullførte mot digest `sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6`. Isolert akseptanse på `127.0.0.1:18088` bekreftet healthy container, nettleserbruk, SQLite-skriving, UI-eksport/gjenoppretting og bevarte ID-er/relasjoner etter tvungen servicegjenskaping med samme volum. Testcontainerne ble stoppet uten `-v`; de isolerte testvolumene ble beholdt for eventuell lokal etterkontroll, mens port 80 og faktisk brukerlagring ikke ble brukt.

En lokal studieplanlegger for emner, oppgaver og tid. Appen bruker lokal parsing, planleggingsregler og enkel statistikk, uten konto eller generativ KI. Oppgaver, dokumentutdrag og arbeidshistorikk blir på denne enheten. Serveren lytter bare på loopback.

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
- **Planlegg uken:** tilgjengelig arbeidstid, faste opptatte tidsrom, kapasitet og «Jeg ligger etter».

På mobil er hovedmålene i bunnmenyen; øvrige valg ligger under «Mer». «Innstillinger» samler sikkerhetskopi, angre/papirkurv, oppstart og personlige estimater.

En oppgave trenger bare **tittel**. Frist, emne, prioritet, avhengigheter og oppgavetype finnes under «Flere detaljer». Gjenstående arbeid er ett valgfritt anslag: tomt/«Vet ikke» er ukjent, og 0 minutter markerer ikke oppgaven som ferdig. Åpner du en ferdig oppgave med null gjenstående igjen, blir anslaget ukjent til du oppgir et nytt. Ved validerings- eller lagringsfeil beholdes utkastet.

## Importer en bekreftbar plan

«Mine emner → Importer emner og plan» gir valg mellom lærested, dokument/tekst og kalender. Appen har 48 registrerte programadaptere og en datert oversikt over 49 norske institusjoner. Dette er **ikke full nasjonal dekning**: AHO har en avgrenset, verifisert programflyt, mens det slettede Ekko-foretaket fortsatt mangler en gjeldende selvstendig kullkatalog. [Importoversikten](IMPORT-COVERAGE.md) oppgir faktisk støtte, kilde, dato og begrensning for hver datatype. Et prøvd program eller emne beviser bare den prøvde flyten.

Velg publisert programutgave, opptakskull, studiesemester og kalendersemester uttrykkelig. Avklar valgemner, campus og publisert timeplanvalg; gruppetilhørighet utledes ikke fra navn. Emner og tilgjengelig undervisning forhåndsvises før felles bekreftelse. Offentlig undervisning kan også hentes for et emne som allerede er lagret, selv når programimport mangler.

Kalenderpanelet har tre valg som åpnes ett om gangen: fil/lenke, offentlig institusjonskalender og undervisning for et lagret emne. Aktiviteter må velges før lagring. Kildeopplysninger og mangler kan åpnes i forhåndsvisningen. Kalenderinformasjon, faktiske undervisningsaktiviteter og innleveringsfrister holdes adskilt.

Dokumentimport støtter innlimt tekst, tekstbasert PDF, DOCX, CSV og ICS. Filene leses lokalt, med grenser på 10 MB for PDF/DOCX, 100 PDF-sider og 2 MB for tekst/CSV/ICS. Skannede eller uleselige dokumenter får en forklaring og vei til innlimt tekst/manuell registrering. Appen utfører ikke dokumentinnhold eller laster eksterne dokumentressurser.

Forhåndsvisningen viser forslag til emner, oppgaver, frister og aktiviteter med kildeutdrag. Rett felter, velg bort rader og koble til eksisterende emner. Uklare datoer, manglende år og usikre koblinger må avklares eller uttrykkelig utelates. Feil åpner den berørte raden og flytter fokus til feltet. Kildevarsler om eksempelvis uleselige PDF-sider bevares etter lagring og vises ved senere oppdatering. Ingenting lagres før bekreftelse.

Gjentatt import bevarer stabile identiteter og egne endringer. Endrede dokumenter kan kobles til en tidligere kilde; usikker samsvar og konflikter krever valg. Kalenderlenker oppdateres mens appen er åpen, med ventetid ved kildefeil. Tidligere data beholdes ved feil. Private lenker og tilgangsnøkler lagres lokalt; filer er øyeblikksbilder. Enkelte offentlige kilder har ustabile ID-er eller ukjent fullstendighet, slik at en flyttet aktivitet må avklares manuelt. Se [importbeskrivelsen](IMPORT.md).

## Planlegg og oppdater fremdrift

Registrer og bekreft arbeidsvinduer og faste opptatte tidsrom under «Planlegg uken». Undervisning og overlapp trekkes fra kapasiteten; samme opptatte minutt telles én gang. Manglende arbeidsvinduer eller tidsestimater gir usikkerhet, ikke et oppdiktet kapasitetsoverskudd. Minuttsummen er en kapasitetsoversikt; det konkrete planforslaget kontrollerer også øktlengder, pauser og tidsskifte.

«Jeg ligger etter» foreslår konkrete flyttinger og nye reservasjoner med opprinnelig/ny tid og berørte frister. Forslaget respekterer faste aktiviteter, låste studieøkter, frister, avhengigheter, delingsvalg, øktlengder og pauser. Manglende tid forklares. Du kan justere, godta eller forkaste; endret underliggende plan eller passert start kontrolleres før bruk. Godkjenning og angre behandler planendringen samlet.

Planlagt tid betyr ikke utført arbeid. Etter en planlagt økt eller arbeid registrert i etterkant velger du:

- **Ferdig:** arbeidet fullføres, og viste kommende reservasjoner frigjøres etter bekreftelse. Innlevering bekreftes separat.
- **Trenger mer tid:** oppgi nytt anslag på gjenstående arbeid eller «Vet ikke».
- **Kom ikke i gang:** ingen faktisk arbeidstid eller fremdrift registreres.

Faktisk arbeidstid er valgfri og trekkes ikke automatisk fra gjenstående arbeid. En økt med 30 minutter faktisk arbeid kan derfor ende med 45 minutter gjenstående. Gjentatte klikk registrerer ikke samme økt flere ganger. Angre gjenoppretter oppgave, arbeidshistorikk og berørte reservasjoner samlet.

Registrer «må gjøres etter», venting og et konkret neste steg i oppgaven. Et registrert avklaringssteg kan foreslås før annet arbeid; blokkerte oppgaver vises ikke som startklare. Fristen til arbeid som avhenger av en oppgave kan gjøre den viktig å starte nå; begrunnelsen viser den registrerte sammenhengen. En større oppgave kan foreslås som en deløkt med forklaring. Appen sender ingen meldinger eller e-post. «Klar til levering» og «Levert» krever forskjellige handlinger.

Personlige estimater bruker lokale medianer først ved minst fem relevante fullførte oppgaver med bekreftet fullstendig arbeidstid, eller fem utførte økter uten avbrudd for øktlengde. Hele oppgaver og deløkter vurderes hver for seg; gjenåpnet arbeid teller ikke som en fullført oppgave. Under «Øktlengde og pauser» kan du bruke eller rette et personlig øktforslag og beregne en ny plan før bekreftelse. Grenser og pauser endres ikke av forslaget. Datagrunnlag og usikkerhet vises, og forslag endrer ikke estimater eller planer før du velger dem. Slå av personalisering eller slett arbeidshistorikken i innstillingene. Sletting fjerner også historikken fra appens gjenopprettingskopi og tilhørende angre/papirkurv; tidligere nedlastede sikkerhetskopier endres ikke.

## Kalender og lokale data

Kalenderens ukevisning kan vise hele uken eller arbeidsuken. På mobil er dagvisningen standard. Dato, kalenderfiltre, ukemodus og rulleposisjon bevares gjennom navigasjon og sikkerhetskopi. Korte eller overlappende hendelser beholder faktisk varighet og har lesbare detaljkontroller; lange titler kan åpnes i sin helhet. Dagsoversikten samler økter og frist for samme oppgave.

Appen bruker fortsatt `studieplanlegger:v1` med valgfrie nye felt. Støttede eldre sikkerhetskopier kan åpnes. Oppstart skriver ikke om gammel lagring; uleselige data sperrer endring og gir gjenopprettingsvalg. Bruk én redigerende fane om gangen; motstridende endringer avvises.

Eksport/gjenoppretting, angre og papirkurv finnes i innstillingene. Portabel sikkerhetskopi bevarer opplysninger og relasjoner, men utelater kalenderforbindelser og kjente tilgangsnøkler. Kildene må kobles til igjen etter gjenoppretting. En gjenoppretting viser innholdet før bekreftelse og beholder en lokal gjenopprettingskopi av forrige tilstand.

Frister lagres som lokale datoer/klokkeslett, og importert undervisning vises i norsk tid. Bruk samme lokale tidssone; flytting mellom tidssoner er ikke fullstendig støttet. Ikke-eksisterende eller tvetydige klokkeslett ved tidsskifte må avklares. Studieøkter kan krysse midnatt med eksplisitt sluttdato.

I Vite-utviklingsmodusen kan sletting av nettleserdata slette planen fordi denne modusen bruker `localStorage`. I Docker-/produksjonsmodusen er SQLite autoritativ; sletting av browserdata sletter ikke databasen, men kan fjerne en uimportert nettleseroriginal. Oppbevar uansett egne sikkerhetskopier utenfor kildekoden eller i `local-backups/`. Private dokumenter og arbeidsfiler hører hjemme utenfor delbar kode; relevante lokale mapper og genererte rapporter er ignorert.

## Tester og bygg

Installer Playwrights testnettleser ved behov og kjør kontrollene fra prosjektmappen:

```powershell
npx.cmd playwright install chromium
npm.cmd run test:unit
npm.cmd run test:e2e
npm.cmd run test:e2e:database
npm.cmd run build
```

Den vanlige nettlesersuiten bruker isolerte kontekster og en Vite-server på **127.0.0.1:5174**. `test:e2e:database` bygger appen, velger en ledig loopback-port, starter den faktiske Node/SQLite-serveren med en midlertidig database og rydder databasen etterpå. Begge bruker syntetiske studentdata. Prøver mot ekte offentlige kilder er egne opt-in-forløp og telles separat fra simulerte svar og offentlige fixturer. [VERIFICATION.md](VERIFICATION.md) dokumenterer de faktiske kjøringene, visuelle kontrollene og begrensningene.

`build` lager lokale filer i `dist/` og publiserer ingenting. Prosjektet har ingen egen lint- eller typekontrollkommando. Behold `package-lock.json`; `npm.cmd ci` installerer de låste avhengighetene.

## Kode og tidligere prosjektarbeid

Appen bygger videre på [Vites vanilla JavaScript-mal](https://vite.dev/guide/). `src/main.js` eier felles tilstand og transaksjoner; `storage.js`, `history.js` og `backup.js` håndterer lagring og gjenoppretting. Rene moduler for oppgaver, arbeidshistorikk, kapasitet, avhengigheter og omplanlegging brukes av de samme visningene. Offentlige kildeadaptere ligger i `server/providers/`; privat dokumentparsing skjer i en lokal nettleser-worker.

Det konsoliderte BMAD- og prosjektmaterialet finnes under `../.docs/implementation-artifacts/`. [Fullstack-spesifikasjonen](../.docs/implementation-artifacts/spec-fullstack-database-docker-delivery.md), [løsningsguiden](../.docs/implementation-artifacts/solution-guide.md), [prosjektrefleksjonen](../.docs/implementation-artifacts/project-reflection.md) og [bruksloggen](../.docs/implementation-artifacts/trial-log.md) er beholdt. Teknisk kontroll er ikke en dokumentert brukermåned; egne brukserfaringer og datoer skal registreres ved faktisk utprøving.
