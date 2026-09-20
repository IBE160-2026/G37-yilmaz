# UTKAST – refleksjonsgrunnlag for Studieplan

Dette dokumentet er et kildebelagt grunnlag for studentens egen refleksjonsrapport. Det er **ikke en ferdig personlig refleksjon**. Hendelsene nedenfor er dokumentert i prosjektfiler og kontrollresultater; vurderinger av egen læring, opplevelse og arbeidsinnsats må studenten formulere og kontrollere selv.

## Hvordan KI-arbeidet ble styrt og avgrenset

- Prosjektet ble først avgrenset til en lokal studieplanlegger med oppgaver, frister, neste steg, studieøkter og et tydelig skille mellom planlagt tid, faktisk arbeid, ferdig arbeid og bekreftet innlevering. Senere bestillinger la til kalender, kapasitetsplanlegging og import uten å erstatte eksisterende data eller brukerflyt.
- Fullstack-runden ble uttrykkelig avgrenset til arkitektur, database, trygg dataoverføring, lokal Docker-leveranse og dokumentasjon. Videre institusjonsdekning ble satt på pause. Ingen generativ KI ble lagt inn som runtime-avhengighet.
- Studenten krevde at faktisk brukerlagring, ID-er, importkoblinger og port 80 skulle bevares. Docker-kontrollene brukte derfor egne prosjektnavn, porter og volumer.
- BMAD ble brukt til spesifikasjon, implementeringsgrenser, uavhengig kontroll og dokumentasjon. Den godkjente fullstack-planen finnes i [fullstack-spesifikasjonen](spec-fullstack-database-docker-delivery.md), og arkitekturen er samlet i [arkitekturdokumentet](../planning-artifacts/architecture/architecture-studieplanlegger-2026-09-06/ARCHITECTURE-SPINE.md).

Dette dokumenterer bestillinger og prosessgrenser. Det dokumenterer ikke hvorfor studenten personlig valgte dem eller hva studenten lærte av dem.

## Konkrete feil, utfordringer og rettinger

1. **BMAD/uv startet ikke i agentkonteksten.** Den første feilen ble ikke behandlet som bevis på manglende installasjon. Prosjektets feilsøkingsnotat ble brukt til å skille programfil, kommando/sti og blokkert kjøretillatelse. Den eksisterende `uv`-installasjonen og generatoren kjørte senere med avgrenset, ordinær godkjenning og exitkode 0; ingen reinstallasjon eller endring av filtilknytninger var nødvendig.
2. **Første databaseskjema var ikke strengt nok.** Gjennomgang fant at foreign keys var aktivert uten faktiske `REFERENCES`, at en database med bare innstillinger kunne regnes som tom under migrering, og at purge-testen manglet reell arbeidshistorikk. Skjema, revisjonskrav og tester ble strammet inn. Se [database.js](../../studieplanlegger/server/database.js) og [database-delivery.test.js](../../studieplanlegger/tests/unit/database-delivery.test.js).
3. **Docker-image kunne først ikke lastes ned.** Feilen `local error: tls: bad record MAC` ble registrert som en observert transportfeil, ikke forklart uten bevis. Etter at basisimaget kunne hentes, ble Compose-bygget og den faktiske runtime-kontrollen gjennomført. Se [den tekniske verifikasjonen](../../studieplanlegger/VERIFICATION.md#docker-clean-copy-runtime-acceptance--2026-09-20).
4. **Leveranseutvalget måtte begrenses.** Den første lokale Git-committen tok med eldre BMAD-skjermbilder og valideringsartefakter som ikke var nødvendige for sensor. De ble fjernet før push; tekstlig prosessgrunnlag, kildekode og syntetiske testfixturer ble beholdt. Ignore-reglene ble utvidet for databaser, miljøfiler, sikkerhetskopier, profiler og genererte artefakter.
5. **Importstatus i README var foreldet.** README oppga 47 adaptere og AHO som uløst, mens gjeldende dekning dokumenterte 48 adaptere og en avgrenset AHO-flyt. Teksten ble korrigert, samtidig som Ekko-restkravet og manglende full nasjonal/datatype/personlig dekning ble bevart.
6. **Innleveringsreviewen fant konkrete avvik.** Personvernssletting fjernet ikke arbeidslogg inne i gyldige legacy-arkiver, produksjonsdatabasetesten var ikke en egen repeterbar kommando, hoppede Playwright-suiter kunne rapporteres som bestått, `.woff2` manglet eksplisitt MIME-type, og kalenderens horisontale beregning brukte `clientTop` i stedet for `clientLeft`. Avvikene ble rettet og kontrollert med målrettede tester før ny ren Docker-kjøring. Andre forslag om tidssonestøtte, asynkron lagring og størrelsesgrenser ble dokumentert som utsatt arbeid fordi de krever bredere produkt- eller migreringsvalg.
7. **En eldre databasevariant manglet testdekning.** Den daværende komplette enhetssuiten bestod, men en separat kontroll med en isolert database der `state_meta` manglet `shape_json`, avdekket at oppstarten brukte kolonnen før migreringen opprettet den. En ny schema-first-regresjonstest gjenskapte feilen `table state_meta has no column named shape_json`. Migreringen ble samlet i én transaksjon og rekkefølgen ble rettet; målrettede tester kontrollerte eksakt bevaring, gjentatt åpning, ny database og full rollback ved en ugyldig eldre relasjon. Reviewen la til den mellomliggende varianten der fremmednøkler allerede finnes, men `shape_json` mangler. Den etterfølgende komplette suiten bestod 1200/1200. Dette er en dokumentert test- og rettingshendelse, ikke en påstand om hvem som oppdaget feilen eller hva studenten lærte av den.

## Hvordan forslag og kode ble kvalitetssikret

- Serveren validerer komplette tilstandskonvolutter og forventet revisjon før transaksjonell SQLite-skriving. Relasjonelle ID-/koblingskolonner gjør sentrale forbindelser kontrollerbare, mens komplett JSON bevarer valgfrie og leverandørspesifikke felt.
- Nettlesermigrering krever eksplisitt bekreftelse, arkiverer original råtekst og fingeravtrykk på serveren og lar original `localStorage` stå urørt. Gjentatt import blir en no-op. Ved bytte av lokal adresse brukes portabel eksport og validert gjenoppretting.
- Enhetstestene, produksjonsbygget og produksjonsrettede Chromium-forløp ble kjørt mot isolerte data. [VERIFICATION.md](../../studieplanlegger/VERIFICATION.md) oppgir de daterte resultatene og skiller beståtte kontroller fra begrensninger.
- Docker-akseptansen kontrollerte healthy container, API/UI, syntetiske emner, oppgaver og økter, bevarte ID-er/relasjoner etter container-recreate med samme volum, fersk nettleserkontekst og backup/gjenoppretting. Dette beviser de prøvde lokale flytene, ikke drift over lang tid eller beskyttelse mot diskfeil.
- GitHub-leveransen kontrolleres fra en ren checkout. Faktiske databaser, brukerbackuper, nettleserprofiler, private miljøfiler, logger og lokale skjermbilder skal ikke følge committen.

## Hva KI bidro med – og hva som krever menneskelig vurdering

KI bidro med kravstrukturering, arkitektur, kode, tester, feilsøking, Docker-oppsett og dokumentutkast. Tekniske forslag ble ikke regnet som verifisert før de var sammenholdt med kode, kjørt test eller observert runtime-resultat. Automatiske tester kan kontrollere datamodell og flyt, men kan ikke dokumentere studentens egen forståelse, faktiske studievaner, opplevde nytte eller læringsutbytte.

Importen har 48 registrerte programadaptere blant 49 kartlagte institusjoner, men dette er ikke full nasjonal dekning. Program, kull, studiesemester, kalendersemester, campus, gruppe og personlig timeplan har ulik dekning. Ekko mangler en gjeldende selvstendig kullkatalog, flere kalenderkilder krever særskilt tilgang eller har observerte kildefeil, og Sikt-ruten krever godkjent Maskinporten-tilgang. Det presise grunnlaget står i [IMPORT-COVERAGE.md](../../studieplanlegger/IMPORT-COVERAGE.md).

Den lokale studieillustrasjonen ble laget med et innebygd bildeverktøy under utviklingen og lagres som en vanlig statisk ressurs. Appen gjør ingen bilde- eller KI-kall under kjøring; fontene distribueres lokalt med SIL Open Font License.

## Fem spørsmål studenten må besvare selv

1. Hvilke krav og avgrensninger valgte du selv, og hvordan brukte du dem til å styre KI/BMAD når forslagene ble for brede eller usikre?
2. Velg én konkret feil eller korrigering fra listen ovenfor. Hvordan vurderte du at rettingen var riktig, og hvilket alternativ ville du eventuelt ha valgt?
3. Forklar med egne ord hvorfor løsningen bruker forventet revisjon, relasjonelle ID-/koblingskolonner og komplett JSON, og hvordan nettleserdata flyttes uten å ødelegge originalen.
4. Hva beviser container-recreate med samme volum, og hva er forskjellen mellom denne testen og eksport/gjenoppretting av en sikkerhetskopi? Hva beskytter ingen av testene mot?
5. Hva kan du nå forklare eller endre selv, og hva trenger du fortsatt hjelp til? Legg til faktiske, daterte brukerobservasjoner fra [bruksloggen](trial-log.md); hvis slik utprøving ikke er gjort, skriv det uttrykkelig i stedet for å anta et resultat.

Dokumentet skal fortsatt merkes som utkast inntil studenten har svart, kontrollert kildehenvisningene og formulert sin egen konklusjon.
