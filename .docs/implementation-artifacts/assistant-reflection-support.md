# KI-laget støtteark til prosjektrefleksjonen

Laget 7. september 2026 etter gjennomgang av kode, [kodeforklaringen](solution-guide.md) og [prosjektrefleksjonen](project-reflection.md). Dette gir tekniske svar og forslag du kan kontrollere og bruke. Det dokumenterer hva løsningen gjør, men sier ikke at du har skrevet koden eller forstått den selv. Personlige svar kan føyes til når du har et konkret grunnlag.

## 1. Fra «Lagre» til oppgavekort

I [ui.js](../../studieplanlegger/src/ui.js) fanger skjemaets `submit`-hendelse opp lagringen. `syncDeadline` setter sammen dato og klokkeslett, og `actions.save` sender feltene videre. Handlingen `save(draft)` i [main.js](../../studieplanlegger/src/main.js) bruker `validateDraft` for nye oppgaver og `editTask` for eksisterende. Begge bruker reglene i [tasks.js](../../studieplanlegger/src/tasks.js), blant annet gyldig frist og heltallsminutter.

Gyldige data blir en kandidat: oppgavelisten slik den skal bli etter endringen. `writeTasks(candidate)` kaller `storage.write(candidate, sessions)` i [storage.js](../../studieplanlegger/src/storage.js). Her kontrolleres hele datasettet før `localStorage.setItem` lagrer JSON under `studieplanlegger:v1`.

Først når skrivingen lykkes, settes `tasks = candidate`. `refresh` beregner lister, tidsforslag og kapasitet, og sender modellen til `ui.render`. Der viser blant annet `taskList.render` oppgavekortene. Et aktivt filter kan skjule den nye oppgaven; da opplyser appen at den finnes under «Alle oppgaver».

Ved skrivefeil blir tidligere data stående, skjemaets utkast beholdes og brukeren får beskjed om å prøve igjen. Ugyldige felt gir feltfeil før skrivingen starter.

## 2. 90 minutter arbeid, 15 minutters neste steg

Forutsetninger: Oppgaven er uferdig, begge framtidige økter ligger før fristen, de overlapper ikke, og ingen andre oppgaver bruker kapasiteten først.

Med 20 minutter tilgjengelig nå passer neste steg på 15 minutter. `selectTasksForMinutes` bruker `getActionMinutes`, som velger neste stegs estimat når steget finnes. Oppgaven kommer derfor med blant forslagene. Hvis flere passer, prioriteres nærmeste frist; det er ikke sikkert denne blir hovedforslaget.

`deriveCapacity` i [capacity.js](../../studieplanlegger/src/capacity.js) fordeler hele gjenstående arbeid: 30 + 45 = **75 minutter planlagt**, og 90 − 75 = **15 minutter mangler**. Neste stegs 15 minutter inngår allerede i de 90. Beregningen bruker derfor ikke 105 minutter.

Tidsvalget «20 minutter nå» registrerer ingen studieøkt og legger ikke automatisk 20 minutter til kapasiteten. Hurtigforslaget velger en passende handling; kapasitetsplanen undersøker registrert tid før fristen.

## 3. Overlapp og frist midt i en økt

To økter kl. 10–11 og 10:30–11:30 dekker 90 ulike minutter. Håndregningen er 60 + 60 − 30 minutters overlapp = **90 minutter**. `validateSession` avviser denne overlappingen når en økt lagres gjennom skjemaet. Dersom strukturelt gyldige overlapp likevel finnes i innleste data, sørger `disjointIntervals` for at de felles minuttene telles én gang, og beregningen gir et varsel.

Anta i stedet én framtidig økt kl. 10–12 og en oppgave med frist kl. 11:15. Oppgaven kan bruke høyst **75 minutter** fra økten. Trenger den 90 minutter, mangler 15 før fristen. De siste 45 minuttene kan brukes til en annen oppgave med senere frist. `deriveCapacity` avgrenser fordelingen med `Math.min(interval.end, deadline)` og trekker brukt tid fra det ledige intervallet.

## 4. Null minutter, ferdig arbeid og levert

`remainingMinutes: 0` er et tidsanslag. Appen fordeler ingen arbeidstid, men ber fortsatt om at fullføring bekreftes. `setTaskCompleted` endrer den manuelle arbeidsstatusen. For innleveringsoppgaver gir ferdig arbeid uten bekreftet levering status «Klar til levering»; fristen følges fortsatt opp.

`setTaskSubmitted` bekrefter levering separat og krever at arbeidet allerede er ferdig. Dette er brukerens bekreftelse, ikke en kontroll mot innleveringssystemet. `completeNextStep` fjerner bare steget. Etterpå må brukeren selv vurdere og oppdatere gjenstående tid. En foreslått arbeidsøkt som passerer, registrerer heller ikke arbeid som utført.

## 5. Én konkret test forklart

Testen «avkorter økten ved en frist midt på dagen og gir resten til neste oppgave» i [capacity.test.js](../../studieplanlegger/tests/unit/capacity.test.js) bruker én økt kl. 10–13. Første oppgave trenger 120 minutter og har frist kl. 11:30. Forventningen er 90 tildelte minutter og 30 manglende. Andre oppgave får de resterende 90 minuttene fra kl. 11:30.

Den beskytter mot at planen bruker tid etter fristen eller gir samme minutter til to oppgaver. Testens innhold er gjennomgått for dette støttearket; en eventuell ny kjøring dokumenteres separat. Testen kan ikke fortelle om studenten faktisk vil studere tre timer, forstår forklaringen eller opplever mindre stress.

## 6. Dokumenterte krav og KI-bidrag

[Prosjektrefleksjonen](project-reflection.md) dokumenterer studentens bestillinger: lokal studieplanlegger, oppgavehandlinger, neste steg, separat levering, redesign med kalender og senere kapasitetsplanlegging. Bevaring av eldre oppgaver og en månedsplan for faktisk bruk var også krav.

Samme dokument oppgir at KI laget planlegging, arkitektur, kode, tester og dokumentasjon under studentens delegering. Valget av Vite, modulgrensene og selve fordelingsalgoritmen skal derfor beskrives som KI-bidrag. Tidligere svar som «Alt funket» gjelder avgrensede funksjonsgjennomganger. De dokumenterer ikke automatisk egen kodeforståelse eller erfaring med den senere kapasitetsplanleggingen. For siste del av spørsmål 6 trengs ditt konkrete eksempel på hva du selv undersøkte og kunne forklare.

## 7. Et teknisk valg å vurdere

**Forslag fra KI:** Behold «nærmeste frist først» som grunnregel. Fordelen er en forutsigbar plan som kan etterregnes. Ulempen er at vanskelighetsgrad, sammenhengende arbeid og avhengigheter ikke vurderes.

Et mulig alternativ er manuell prioritet som bryter likhet når fristene er identiske. Det gir brukeren mer kontroll, men krever et nytt felt og enda et valg. Dette er et diskusjonsgrunnlag. Det blir først studentens begrunnede valg når studenten vurderer alternativet selv.

## 8. Kort forståelsessjekk

Prøv uten å lese svarene samtidig:

- Finn `selectTasksForMinutes`, og forklar hvorfor et neste steg kan passe når hele oppgaven ikke passer.
- Regn ut hva som skjer i spørsmål 2 når 45-minuttersøkten slettes.
- Finn stedet der `tasks = candidate` kjøres. Forklar hvorfor det står etter lagringskontrollen.

Noter hvilke punkter du kunne forklare selv, hvor du måtte slå opp, og hva som fortsatt er uklart. KI kan kontrollere forklaringene etterpå. Gjennomlesing alene dokumenterer ikke at sjekken er utført.

## 9–12. Opplysninger som må komme fra faktisk bruk

For å skrive faktiske svar trengs disse opplysningene:

9. Dato, konkret oppgave, hva som hjalp eller hindret arbeidsstart, og hva du faktisk gjorde.
10. Oppgavens frist, om arbeidet ble ferdig, om og når levering skjedde, og eventuell årsak til forsinkelse.
11. Opprinnelig gjenstående tid og planlagte økter, faktisk tidsbruk, endringer etter kapasitetsvarsel og utfallet.
12. Konkrete problemer eller uklarheter, ønsket forbedring og faktisk bruksperiode. En konklusjon etter en måned trenger observasjoner fra den perioden.

Opplysningene kan gis som korte stikkord. KI kan strukturere dem og hjelpe med formuleringene. Simulerte oppgaver og automatiserte tester kan dokumentere teknisk oppførsel, men skal stå separat fra egne erfaringer i [bruksloggen](trial-log.md).
