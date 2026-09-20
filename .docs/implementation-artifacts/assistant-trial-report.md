# KI-gjennomført prøve av studieplanleggeren

Gjennomført 7. september 2026. Dette er Codex sin tekniske utprøving med fem syntetiske oppgaver. Studentens egne studieoppgaver og erfaringer er ikke oppgitt i denne gjennomgangen. Brukermåneden står derfor fortsatt som «Ikke startet».

## Hva som er gjort

Appen ble åpnet fra eksisterende kildekode i en isolert Chromium-kontekst. Oppgaver, neste steg, statuser og studieøkter ble registrert med appens faktiske skjemaer og knapper. Testen brukte fast klokke 8. september 2026 kl. 08:00, Europe/Oslo. Datoen i skjermbildene er en testklokke, ikke tidspunktet for virkelig studiearbeid.

Nettsiden ble kjørt på en egen lokal testadresse, http://127.0.0.1:5186. Personlig nettleserprofil og oppgavene på studieplan.localhost ble ikke brukt. Testserver og nettleser ble lukket etter prøven.

## Oppgaver og håndregnet forventning

Alle titler begynte med «TEST». Følgende data ble lagt inn:

| Oppgave | Frist | Gjenstående | Arbeidsstatus |
| --- | --- | ---: | --- |
| Rapport i programmering, IBE160 | 8. september kl. 11:30 | 90 min | Uferdig; neste steg 15 min |
| Regneøving, MAT110 | 8. september kl. 13:00 | 60 min | Uferdig |
| Lesing i metode | 9. september kl. 12:00 | 45 min | Uferdig |
| Ferdig øving, IBE160 | 8. september kl. 10:30 | Lagret anslag 30 min | Fullført; bruker 0 min kapasitet |
| Klar til levering, IBE160 | 8. september kl. 11:00 | Lagret anslag 20 min | Arbeid ferdig; bruker 0 min kapasitet |

Aktivt arbeid utgjør 90 + 60 + 45 = **195 minutter**. De 15 minuttene i neste steg er en del av rapportens 90 minutter.

## Observerte resultater

Tallene nedenfor ble kontrollert med eksplisitte forventninger mot appens viste oppgaver og oppsummering. De ble ikke bare hentet fra algoritmen som skulle kontrolleres.

| Handling | Rapport: foreslått / mangler | Regneøving: foreslått / mangler | Lesing: foreslått / mangler | Totalt mangler |
| --- | --- | --- | --- | ---: |
| To økter 8. september, kl. 10–11 og 11–12 | 90 / 0 min | 30 / 30 min | 0 / 45 min | 75 min |
| Flytt andre økt til kl. 12–13 | 60 / 30 min | 60 / 0 min | 0 / 45 min | 75 min |
| Slett andre økt | 60 / 30 min | 0 / 60 min | 0 / 45 min | 135 min |
| Legg til en økt 9. september kl. 10–12 | 60 / 30 min | 0 / 60 min | 45 / 0 min | 90 min |

Siste tilfelle har **75 minutter ledig**, samtidig som **90 minutter mangler før fristene**. Dette er riktig: ledig tid 9. september kan ikke brukes før fristene 8. september. Ved flytting av andre økt var totalsummen uendret, mens fordelingen mellom rapport og regneøving endret seg. Dermed må også hver oppgave kontrolleres.

Disse handlingene besto også:

- Hurtigvalg 15 og 30 minutter samt egendefinert 20 minutter viste rapportens 15-minutterssteg som hovedforslag.
- Et forsøk på å registrere kl. 10:30–11:30 mellom de to første øktene ble avvist som overlapp; de to tidligere øktene ble beholdt.
- Omlasting bevarte alle fem oppgaver, statuser, neste steg og studieøkter.
- Kalenderagendaen viste egne tekstetiketter for frister og studieøkter.
- Ved 360 px bredde var det ingen horisontal sideskrolling. Enter på «Ny studieøkt» åpnet skjemaet og flyttet fokus til datofeltet.
- «Neste steg gjort» fjernet steget og beholdt gjenstående på 90 minutter. Manuell oppdatering til 75 minutter ga forventet rapportmangel på 15 minutter.
- Simulert «Bekreft levert» og «Angre levering» endret leveringsstatus separat og beholdt ferdig arbeidsstatus. Ingen virkelig innlevering ble gjort.
- Ingen JavaScript-sidefeil ble registrert i denne prøven.

## Automatiserte kontroller

Kontrollene ble kjørt mot eksisterende appkode og tester. Midlertidige konfigurasjoner sendte cache, skjermbilder, logger og bygg til et separat arbeidsområde.

| Kontroll | Faktisk resultat |
| --- | --- |
| Enhetstester | **308/308 besto**, exit 0 |
| Samlet nettleserkjøring | **86/86 besto**, exit 0; 73,21 sekunder i Playwright, 0 hoppet over og 0 ustabile tester |
| Produksjonsbygg | **Bestod**, exit 0; 12 moduler, 218 ms i Vite |
| Praktisk prøve beskrevet ovenfor | **Bestod**, én selvstendig nettlesergjennomgang med håndregnede forventninger |

Det er **394 eksisterende automatiserte tester**. De sju loggførte kontrollpunktene og fire kapasitetsøyeblikksbildene i den praktiske prøven telles ikke som ekstra testtilfeller i testsuiten.

Samlet nettleserkjøring som avsluttet normalt ble kjørt 7. september kl. 17:40:49–17:42:03 (Europe/Oslo). Den første kjøringen gjennomførte testhandlingene, men hang ved avslutning av sin Vite-server i sandkassen. Etter at kun denne eide serverprosessen ble stoppet, ble hele nettleserkjøringen gjentatt med godkjent kjøring utenfor sandkassen. Det endelige resultatet ovenfor kommer fra den nye kjøringen som avsluttet av seg selv. Appkode og eksisterende tester ble ikke endret for å få dette til.

Testnettleseren var Chromium. Mobildekningen er emulerte skjermbredder, ikke prøving på studentens fysiske telefon. Bygg kontrollerer pakking; det er ikke separat lint eller statisk typekontroll.

## Visuell gjennomgang og forbedringspunkter

Codex inspiserte det nye skjermbildet med ledig tid etter fristen ved 1280 px og den lange mobilagendaen ved 360 px. Oppgaver, kapasitetsforklaringer og kalender var synlige. På mobil kommer kalenderen etter hele oppgavelisten; dette gir en lang side med fem oppgaver. Om plasseringen er praktisk i daglig bruk, trenger en faktisk brukerobservasjon.

To forhold bør undersøkes i vanlig bruk:

1. Samtidig «mangler» og «ledig» er matematisk riktig, men det må være forståelig at den ledige tiden kommer for sent.
2. Gjenstående tid må oppdateres manuelt etter arbeid eller neste steg. Undersøk om denne oppdateringen blir glemt eller oppleves tungvint.

Dette er vurderinger basert på testflyt og skjermbilder, ikke studentens egne meninger. Ingen konkret funksjonsfeil ble funnet i den praktiske prøven, og appkoden ble ikke endret i denne gjennomgangen.

## Etterprøvbar dokumentasjon

Resultatene ovenfor er bevart som et tekstlig, datert prosessgrunnlag. Lokale skjermbilder, maskinspesifikke resultatfiler og prøveskript er med vilje utelatt fra GitHub-leveransen av hensyn til et ryddig og personvernsikkert filutvalg. Den nåværende automatiserte og Docker-baserte kontrollen står i [VERIFICATION.md](../../studieplanlegger/VERIFICATION.md).

## Hva som fortsatt trenger opplysninger fra studenten

[Kode- og refleksjonsstøtten](assistant-reflection-support.md) inneholder ferdige tekniske forklaringer til spørsmål 1–5, dokumentert oppgavefordeling i spørsmål 6, et faglig forslag i spørsmål 7 og en kort forståelsessjekk til spørsmål 8.

For å fylle ut personlige svar trengs studentens egne valg, forklaringer og erfaringer. Codex kan strukturere stikkord og formulere svar ut fra dem. En måned med faktisk bruk, eventuell glemt levering og opplevd nytte kan ikke fastslås med en simulert klokke. [Bruksloggen](trial-log.md) og de personlige svarfeltene i [prosjektrefleksjonen](project-reflection.md) er derfor beholdt åpne.
