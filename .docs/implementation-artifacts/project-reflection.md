# Utkast: prosjektnotater til refleksjon — Studieplanlegger

Dette er et kildegrunnlag for studentens egen refleksjon, ikke en ferdig besvarelse eller dokumentasjon på læring som ikke er bekreftet.

## Studentens dokumenterte valg

- Et individuelt IBE160-prosjekt: en enkel lokal nettside som gir oversikt over studieoppgaver og hjelper med å velge arbeid innen tilgjengelig tid.
- Oppgaver skal kunne opprettes, rettes, slettes og markeres fullført, med lokal frist og estimat. Ingen konto, backend, synkronisering eller publisering er bestilt.
- Studenten har godkjent menneskelig overtakelse av 1.1, 1.2 og 1.3; se [1.3-kontrollen](story-1-3-handover-check.md).
- Den 2026-09-06 ba studenten om å bygge resten av første versjon samlet: 1.4, 2.1, 2.2 og 2.3. Etter instruksen om egen manuell gjennomgang svarte studenten «Alt funket» 2026-09-07. Hele første versjon er nå menneskelig overtatt; se [samlet kontroll](version-one-handover-check.md). Dette dokumenterer godkjenning av funksjonene, ikke læringsutbytte eller resultater fra månedsutprøvingen.
- Senere 2026-09-07 bestilte studenten tre tillegg til nåværende scope: ett valgfritt aktivt neste steg med eget estimat, ett hovedforslag med faktisk regelbegrunnelse og alternativer, samt ferdig arbeid skilt fra manuelt bekreftet levering med angre. Studenten ba uttrykkelig om å bevare gamle oppgaver og aldri tolke gammel fullføring som dokumentasjon på levering. Det er ingen generell deloppgaveliste eller automatisk levering i bestillingen.
- I den påfølgende bestillingen ba studenten om redesign og fristkalender i den eksisterende løsningen: et varmere grønt uttrykk, tydelig dashboard og hovedhandling, raske tidsvalg, kalender med mobilagenda, reelle oppgavetall, tilgjengelige oppgavemenyer og norsk 24-timersklokke. Dette videreutvikler brukergrensesnittet uten å erstatte de tidligere oppgave-/steg-/leveringsreglene eller lagrede data.
- Studenten bestilte deretter kapasitetsplanlegging med daterte studieøkter, gjenstående arbeid, fordeling før frister og forklarte tidsmangler. Bestillingen krever bevarte eldre data, mobilvisning, tydelig skille mellom forslag, utført arbeid og levering, samt en månedsplan for faktisk bruk og hjelp til å forstå koden. Vanlige implementeringsvalg er delegert til KI. Egne observasjoner, refleksjoner og læringsutbytte skal studenten selv formulere.

## KI-bidrag og tekniske valg

KI har hjulpet med planlegging, krav, stories, arkitektur, kode, tester, kodegjennomgang og dokumentasjon. Vite med vanlig HTML/CSS/JavaScript, modulgrensene, de konkrete testene og utformingen av kontroller er tekniske valg gjort under studentens delegering; de skal ikke fremstilles som selvstendig skrevet av studenten.

Planens arbeidsvalg er dokumentert i [PRD](../planning-artifacts/prds/prd-studieplanlegger-2026-09-06/prd.md) og [arkitektur](../planning-artifacts/architecture/architecture-studieplanlegger-2026-09-06/ARCHITECTURE-SPINE.md): lokal mandag–søndag, lokale klokkeslett, positivt heltallsestimat, frist før varighet i tidsfilteret, bekreftet sletting og mulighet til å angre fullføring. Det er ikke innført KI-anbefalinger i nettsiden.

For tilleggene beholdt KI den generiske oppgavemodellen og la til «Krever innlevering», valgfrie lagringsfelt og egne steg-/leveringshandlinger. Et aktivt stegestimat har forrang i tidsfilteret; «Klar til levering» inngår fortsatt i relevant frist-/forfaltvisning, men ikke arbeidsforslag. Å gjøre et steg tømmer det uten historikk eller endring av hovedoppgavens estimat, gjenstående tid eller statuser. Bekreftet levering må angres før dens forutsetninger endres. Dette er tekniske valg gjort under studentens delegering, ikke oppdiktede enkeltgodkjenninger. KI har også samordnet krav, kode, tester og dokumentasjon; se [utvidelsesspesifikasjonen](spec-study-actions.md).

Redesignet bruker «Oversikt» som start, 30 minutter som midlertidig første tidsvalg, hurtigvalg 15/30/45/60 og egendefinert tid. KI har valgt konkret kort-/menyutforming, beregnede tall, stabile emnefarger og en lokal kalender med måned/dagsliste/agenda. Dato og uttrykkelig `HH:mm`-felt gir samme lagrede `deadlineLocal` som før, uten localeavhengig AM/PM. Kalenderen bruker eksisterende data og skriver ikke ved navigasjon. Ingen ny avhengighet eller lagringstype er bestilt. De konkrete valgene, koden og testene er KI-bidrag under studentens delegering; se [redesign-/kalenderspesifikasjonen](spec-ui-calendar.md).

### Kapasitetsplanlegging: valg, begrunnelse og begrensning

Den [nye spesifikasjonen](spec-capacity-planning.md) beskriver den delegerte bestillingen. [Forklaringen av løsningen](solution-guide.md) går gjennom dataflyten og konkrete beregninger med kodelenker. Valgene nedenfor er tekniske KI-bidrag under denne bestillingen. At studenten bestilte funksjonen betyr ikke at studenten selv skrev algoritmen eller har bekreftet forståelse av den.

| Teknisk valg | Hvorfor det er valgt | Begrensning og kilde |
| --- | --- | --- |
| Rene oppgaveregler, én kontroller og en egen lagringsmodul | Samme regel kan brukes av skjema, visning og tester. Kontrolleren bytter til nye data først når lagring lykkes. | En lokal nettside gir ikke konto, sikkerhetskopi eller synkronisering. Se [tasks.js](../../studieplanlegger/src/tasks.js), [main.js](../../studieplanlegger/src/main.js) og [storage.js](../../studieplanlegger/src/storage.js). |
| Oppgaven har ett tall for gjenstående minutter | Kapasitetsplanen teller hele det gjenstående arbeidet én gang, inkludert neste steg. Et aktivt steg er en hjelp til å begynne, ikke ekstra arbeid som legges til summen. | Tallet er brukerens vurdering. Å gjøre et steg reduserer det ikke automatisk; brukeren oppdaterer gjenstående manuelt. [tasks.js](../../studieplanlegger/src/tasks.js). |
| Nærmeste frist først, arbeid kan deles mellom studieøkter | Regelen er enkel å følge for hånd og gir forutsigbar prioritering. Bare framtidig tilgjengelig tid før oppgavens klokkeslett brukes. | Regelen kjenner ikke oppgavens vanskelighet, arbeidsavhengigheter eller behov for sammenhengende arbeid og pauser. [capacity.js](../../studieplanlegger/src/capacity.js). |
| Overlapp avvises i øktskjemaet; innleste overlapp telles bare én gang i beregningen | To økter på samme klokkeslett gir ikke dobbelt så mye studietid. Defensive beregninger beskytter også når data kommer utenom skjemaet. | Brukeren må registrere realistiske økter og holde dem oppdatert. Økter har start og slutt på samme dato. [capacity.js](../../studieplanlegger/src/capacity.js). |
| Økttider som mangler eller gjentas ved sommertid, og økter som krysser et klokkeskifte, avvises | En lokal tid uten tidssoneforskyvning kan være tvetydig. Avvisning hindrer at en usikker varighet framstilles som tilgjengelig kapasitet. | På dager med klokkeskifte må brukeren velge entydige økter som ligger helt før eller etter overgangen. Støtte for bruk på tvers av tidssoner er fortsatt begrenset. [capacity.js](../../studieplanlegger/src/capacity.js). |
| Forslag, ferdig arbeid og bekreftet levering er separate | En fordeling viser hva det er plass til, uten å påstå at arbeidet er gjort. Null gjenstående krever fortsatt egen markering av ferdig arbeid, og innlevering bekreftes separat. | Det finnes ingen tidsmåling eller kontroll mot innleveringssystemet. Ferdig arbeid teller null i planen, men estimatet beholdes så angre kan gjenåpne arbeidet. [tasks.js](../../studieplanlegger/src/tasks.js) og [capacity-view.js](../../studieplanlegger/src/capacity-view.js). |
| Nye lagringsfelt er valgfrie innen eksisterende skjema | Eldre oppgaver bruker hovedestimatet når gjenstående mangler, og manglende økter betyr tom øktliste. Oppstart trenger ingen omskriving av gamle data. | En gammel fullførtmarkering er fortsatt ikke bevis på levering. Ugyldige lagrede data sperrer endringer og bevares for nytt leseforsøk. [storage.js](../../studieplanlegger/src/storage.js). |
| Frister og studieøkter har egne tekstetiketter i samme kalender | Kalenderen samler når arbeid er mulig og når det må være ferdig, også i mobilagendaen. | Kalenderen importerer ikke data fra emnene; navigasjon eller passert økt bekrefter ikke utført arbeid. [calendar.js](../../studieplanlegger/src/calendar.js). |

Hurtigforslaget og kapasitetsplanen svarer på ulike spørsmål: «Hva passer tiden jeg har nå?» bruker aktivt neste steg, ellers gjenstående arbeid. «Rekker jeg arbeidet før fristen?» fordeler oppgavens gjenstående tid over registrerte økter. Det opprinnelige estimatet brukes når et eldre oppgaveobjekt mangler gjenstående tid. Se [kodeforklaringen](solution-guide.md) før du prøver å forklare forskjellen med egne ord.

KI har også laget prøvelisten, loggmalen og spørsmålene nedenfor. Tomme svarfelt er ikke ferdige refleksjoner. Studentens personlige bidrag kan dokumenteres med egne svar, konkrete kodehenvisninger og daterte bruksnotater.

## Kvalitetssikring og begrensninger

Tidligere resultater finnes i evidensen for [1.2](story-1-2-evidence.md) og [1.3](story-1-3-evidence.md). Samlet kontroll av resten registreres i [versjonsevidensen](version-one-evidence.md), med faktisk kjørt testsett, feil, rettinger og kodegjennomgang. Automatiserte tester bruker fiktive data i isolerte nettleserkontekster. De erstatter ikke studentens vurdering av forståelighet og fysisk tastaturbruk.

De nye kontrollene og eventuelle begrensningene registreres separat i [utvidelsesevidensen](study-actions-evidence.md). Eldre «Alt funket» er ikke en godkjenning av de nye handlingene. Studenten har senere svart «Jeg har gjort det» på den korte eksempelflyten og sendt to skjermbilder med tomt tidsresultat og ferdig arbeid merket «Klar til levering» uten aktivt steg. Dette er registrert som en prøvd eksempelflyt og delvis manuell observasjon. Hele [den nye menneskelige prøvelisten](study-actions-handover-check.md), lagring, tastaturbruk og faktiske leverings-/angrehandlinger er ikke dermed særskilt bekreftet. Ingen nye automatiserte tester eller kodeendringer er gjort ved denne statusregistreringen. Forventningen om enklere arbeidsstart, færre valg og færre glemte innleveringer er ikke en målt brukereffekt. 3.1-utvidelsens mislykkede `bmad-build`-render og direkte videreføring under brukerens gjennomføringsordre er dokumentert i den daværende [spesifikasjonen](spec-study-actions.md); en ukjørt arbeidsflytkontroll telles ikke som utført. Den senere kapasitetsutvidelsen har sin egen gjennomføring dokumentert i [kapasitetsevidensen](capacity-evidence.md).

Månedsutprøvingen er **Ikke startet**, og det finnes foreløpig ingen måling av færre glemte frister eller redusert organiseringsarbeid. [Månedsplanen og den tomme loggen](trial-log.md) har en konkret prøveliste og en kort rytme for daglig og ukentlig oppfølging. Faktisk start, slutt og observasjoner skal fylles inn når bruk med egne oppgaver finner sted.

Redesign og kalender har [egen testevidens](ui-calendar-evidence.md) og [ny menneskelig prøveliste](ui-calendar-handover-check.md). Studentens «Jeg har gjort det» og skjermbildene ovenfor gjelder eksempelflyten før dette redesignet og beholdes som den avgrensede observasjonen de er. Ingen ny menneskelig godkjenning eller erfaring med kalenderens nytte er registrert. Et roligere uttrykk og bedre oversikt er forventede virkninger, ikke målte funn.

Kapasitetsplanleggingens faktiske tester, produksjonsbygg og eventuelle gjenstående begrensninger føres i [egen teknisk evidens](capacity-evidence.md). Regler for utilstrekkelig kapasitet, overlapp, frister midt på dagen, forfalte og ferdige oppgaver samt eldre lagring kontrolleres med konstruerte data. En bestått test viser at de konkrete testtilfellene virker; den viser ikke at studenten opplevde bedre arbeidsflyt eller lærte noe bestemt. Ingen egen bruk eller læring fra denne utvidelsen er registrert på forhånd.

## Studentens egne notater – besvar med egne ord

Begynn gjerne med spørsmålene om forståelse før brukermåneden, og fyll ut erfaringene etter at du har noe å vise til. En god besvarelse kan være noen få setninger, ett regneeksempel eller en lenke til kode og et loggnotat. Skriv også hva du fortsatt er usikker på. Svarene er bevisst åpne.

### Forståelse av løsningen

1. Følg en oppgave fra jeg trykker «Lagre» til kortet vises. Hvilke funksjoner kontrollerer, lagrer og viser dataene? Hva skjer hvis lagring feiler?

   Mitt svar:

2. En oppgave har 90 minutter gjenstående og ett neste steg på 15 minutter. Jeg har 20 minutter nå og to framtidige økter på 30 og 45 minutter før fristen. Hva gir hurtigforslaget og kapasitetsplanen, og hvorfor?

   Min beregning og forklaring:

3. Hvordan kan jeg kontrollere for hånd at to overlappende økter ikke gir dobbelt kapasitet? Hva skjer når fristen ligger midt i en økt?

   Mitt eksempel og forklaring:

4. Hva skiller null gjenstående tid, ferdig arbeid og bekreftet levering? Hva må jeg selv oppdatere etter et utført neste steg?

   Mitt svar:

5. Velg én test og forklar hvilket feilscenario den beskytter mot. Hvilken viktig erfaring kan testen ikke fortelle noe om?

   Valgt test og min forklaring:

### Egne valg og KI-hjelp

6. Hvilke krav og valg tok jeg selv? Hvilke konkrete deler laget KI, og hvordan undersøkte jeg at jeg kunne bruke og forstå dem?

   Mitt svar, med eksempler:

7. Hvilket teknisk valg ville jeg beholdt eller endret? Hvilken fordel og ulempe har alternativet mitt?

   Mitt valg og begrunnelse:

8. Hva kan jeg nå forklare eller endre selv i koden, og hva trenger jeg fortsatt hjelp til? Hvilket konkret eksempel viser dette?

   Mitt svar:

### Erfaringer fra faktisk bruk

9. Hva hjalp meg i gang? Beskriv én faktisk situasjon og vis til datoen i bruksloggen.

   Mitt svar og logghenvisning:

10. Overså jeg frister eller glemte levering? Hvordan skiller jeg en glemt oppgave, for lite kapasitet og ferdig arbeid som ikke ble levert?

    Mitt svar og logghenvisning:

11. Hvor realistiske var gjenstående tid og studieøktene? Forsto jeg tidsmangelen, hva endret jeg, og hvordan gikk det?

    Mitt svar og logghenvisning:

12. Hva var mest tungvint eller uklart, hvilken forbedring ønsker jeg først, og hva kan jeg konkludere med etter måneden?

    Mitt svar, grunnlag og usikkerhet:


## KI-støtte til spørsmålene, 7. september 2026

På studentens bestilling er det laget et [ferdig støtteark](assistant-reflection-support.md) med tekniske svar til spørsmål 1–5, dokumenterte brukerbestillinger og KI-bidrag til spørsmål 6, et faglig forslag til spørsmål 7 og en forståelsessjekk til spørsmål 8. Dette er tydelig merket KI-støtte. Personlige svarfelt ovenfor er beholdt, slik at egne erfaringer og egen forståelse kan legges til på faktisk grunnlag.

Codex har også gjennomført en [separat teknisk prøve](assistant-trial-report.md) med fem syntetiske oppgaver, endrede studieøkter, mobilvisning og regnekontroll. Prøven dokumenterer appens oppførsel og er ikke studentens egen brukermåned eller godkjenning.

## Databasen og Docker-leveransen – studentens egne refleksjonsspørsmål

Den komplette leveransen bruker nå SQLite i den lokale Node-serveren. KI valgte den innebygde `node:sqlite`-modulen, optimistiske revisjoner, relasjonelle identitets-/koblingskolonner og komplett JSON-payload per rad. Docker Compose binder bare loopback-porten og beholder databasen i et navngitt volum. Dette er tekniske KI-bidrag under studentens delegering, ikke dokumentasjon på at studenten selv har skrevet eller forstått implementasjonen.

### Dokumenterte hendelser som kan brukes som grunnlag

- Studenten avgrenset arbeidet uttrykkelig til arkitektur, lagring, lokal kjørbar leveranse og dokumentasjon, satte mer institusjonsdekning på pause, forbød publisering/GitHub-push og krevde at port 80 og eksisterende brukerdata skulle bevares. Kilde: den godkjente full-stack-bestillingen og [spesifikasjonen](spec-fullstack-database-docker-delivery.md).
- Før implementering ble et gjentatt `uv`-oppstartsproblem undersøkt via `UV-STARTUP.md`; programfil, programsti og agentens kjøretilgang ble skilt fra installasjonsfeil. BMAD-generatoren kjørte deretter med eksisterende installasjon, uten reinstallasjon eller endring av filtilknytninger. Kilde: feilsøkingsoppdraget og spesifikasjonens gjennomføringsspor.
- Gjennomgang oppdaget at første databaseskjema hadde slått på foreign keys uten faktiske `REFERENCES`, at en tomhetskontroll kunne tillate migrering over en database med bare innstillinger, og at purge-testen manglet reell arbeidshistorikk. Dette ble korrigert med skjemaoppgradering/FK-er, revisjonskrav for tom database og sterkere syntetiske tester. Kilder: [database.js](../../studieplanlegger/server/database.js) og [database-delivery.test.js](../../studieplanlegger/tests/unit/database-delivery.test.js).
- Kontrollene bestod med 1195 unit-tester, produksjonsbygg og to produksjons-Chromiumflyter mot isolerte SQLite-filer. Review la til kontroll av eldre skjemaoppgradering, backup-style restore, recovery og purge gjennom den virkelige API-serveren. De samme kontrollene bestod etter ny låst installasjon i en ren prosjektkopi. Kilde: [VERIFICATION.md](../../studieplanlegger/VERIFICATION.md).
- Den tidligere registertransportfeilen `local error: tls: bad record MAC` ble senere avklart. Det valgte Node-basisbildet ble hentet og Compose-bygget fullførte. En isolert akseptanse på loopback-port 18088 bekreftet healthy container, SQLite-skriving, UI-eksport/gjenoppretting og bevarte ID-er og relasjoner etter tvungen servicegjenskaping med samme testvolum. Kilde: [VERIFICATION.md](../../studieplanlegger/VERIFICATION.md).

Punktene over er dokumenterte hendelser, ikke studentens personlige erfaring, beslutningsbegrunnelse eller læringsutbytte. Spørsmålene nedenfor må besvares av studenten selv.

1. Hvorfor sender klienten forventet revisjon, og hva kan skje hvis to faner bygger på samme eldre tilstand?
2. Hvorfor lagres både relasjonelle kolonner og komplett JSON, og hvilken ulempe har denne dobbeltheten?
3. Hvordan viser en container-recreate med samme volum at databasen er varig, og hva viser testen ikke om sikkerhetskopi?
4. Hvorfor beholdes original `localStorage` etter migrering, og når må portabel eksport brukes i stedet?
5. Hvilke data er med vilje utelatt fra en portabel backup, og hva må brukeren gjøre etter restore?
