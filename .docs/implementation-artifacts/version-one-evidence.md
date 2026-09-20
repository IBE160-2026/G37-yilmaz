# Første versjon — bygge- og testevidens

> Historisk evidens for grunnversjonen før tilleggene med neste steg, hovedforslag/alternativer og separat levering. Testantall og menneskelig godkjenning nedenfor beholdes uendret og gjelder den daværende koden. Se [egen evidens for utvidelsen](study-actions-evidence.md) for nåværende kontroller.

Arbeidsstatus: **Bygget, kodegjennomgått, automatisk sluttkontrollert og menneskelig overtatt 2026-09-07**. Dette dokumentet gjelder resten av første versjon: 1.4, 2.1, 2.2 og 2.3. Etter instruksen om å utføre hele den manuelle kontrollisten svarte studenten «Alt funket». De fire storyene, begge epics og byggespesifikasjonen står i `done`. Godkjenningen er registrert i [overtakelsen](version-one-handover-check.md); den innebærer ingen ny automatisk testkjøring.

Studentens fullstendige overtakelse av 1.3 er registrert 2026-09-06. Story/sprint 1.1, 1.2 og 1.3 står i `done`. Den nye bestillingen omfatter alle fire resterende stories og deres dokumentasjon, med egen samlet menneskelig overtakelse til slutt.

[Byggespesifikasjonen](spec-1-4-til-2-3-forste-versjon.md) og de fire kilde-storyene angir omfanget. `epics.md` er eneste epic-kilde. Begge epic-kontekstene er kompilert på nytt gjennom byggeflyten. Den nye byggeaktiveringen kjørte render nøyaktig én gang med vellykket resultat.

Før kodeendringer ble nettsidens kilde, tester, konfigurasjon og pakkefiler kopiert til `.tmp/version-one-baseline/studieplanlegger/`. Ingen Git-repository eller commit er opprettet.

## Kontrollert miljø

Kontrollert fra lokal installasjon 2026-09-06: Node 24.19.0, npm 11.17.0, Vite 8.2.2, Vitest 5.0.0 og Playwright 1.63.0. Playwrights lokale manifest angir Chromium 153.0.8010.12, revisjon 1243. Ingen pakke- eller nettleserinstallasjon er utført i denne byggeøkten.

Pakkefilen og låsefilen har samme SHA256 som før endringene:

- `package.json`: `F159F1EC37BC77D05A616AACAA77C780A707502E5467A710CCDB788C6F062F86`
- `package-lock.json`: `476E69C7060A70F11CC467F9167B4CDBC5CF3998D306BC79198DA5F6D01F27AF`

Vitest bruker eksplisitt Europe/Oslo. Playwright bruker egne kontekster, samme tidssone og en egen server på strict port 5174 uten gjenbruk av eksisterende server. Personlige nettleserdata og vanlig bruk på 5173 inngår ikke i automatiseringen.

## Feil og rettinger under bygging

- Tidlig kildekontroll fant at konvertering av en lokal frist til et tidspunkt velger første forekomst av en gjentatt høsttime. Forfaltberegningen er rettet til sammenligning av lokale kalenderfelt, slik at en synlig 02:15 ikke regnes som etter en frist 02:30 på grunn av skjult offset. Enhetstester for begge forekomstene består.
- Klokketikk endrer bare tekst når innholdet faktisk er nytt. Dette unngår gjentatte DOM-endringer i tidsfilterets levende meldingsfelt. En DOM-kontroll er ikke en påstand om fysisk testing med skjermleser.
- Første nettleserkjøring: 45/47 bestått og to tidsavbrudd. Begge gjaldt testenes bruk av `check()` når vellykket fullføring fjernet raden fra tidsfilteret. De to testhandlingene er endret til klikk, med alle kontrollene av lagring og treff beholdt; begge besto ved omkjøring. Dette ble ikke løst ved å øke tidsgrensen.
- En senere test for tidssonebytte traff Chromium-feilen «Timezone override is already in effect» fordi testkonteksten allerede eide en overstyring. Testen bruker nå en egen isolert kontekst og samme kontrollsesjon for begge soner. Den setter og bekrefter eksplisitt Oslo før byttet og består i den samlede kjøringen.

## Kjørte kontroller før kodegjennomgang

Fra `studieplanlegger/`, 2026-09-06 (Europe/Oslo), kjørt av hovedagenten:

| Kommando | Faktisk resultat |
| --- | --- |
| `npm.cmd test` | Exit 0, 142/142 tester i tre filer, kl. 23:52:12, 453 ms |
| `npm.cmd run build` | Exit 0, åtte moduler, 87 ms; HTML 5,30 kB, CSS 3,13 kB, JavaScript 12,30 kB |
| `npm.cmd run test:e2e` | Exit 0, 49/49 tester, 21,2 s; normal opprydding utenfor sandkassen |

Ingen publisering er utført. Kontrollen ovenfor er det historiske resultatet før gjennomgang; endelig kontroll etter alle rettinger står nedenfor.

## Endelig kontroll etter kodegjennomgang

Fra `studieplanlegger/`, 2026-09-07 (Europe/Oslo), kjørt av hovedagenten etter siste kodeendring:

| Kommando | Faktisk resultat |
| --- | --- |
| `npm.cmd test` | Exit 0, 142/142 tester i tre filer, kl. 00:18:53, 526 ms |
| `npm.cmd run build` | Exit 0, åtte moduler, 94 ms; HTML 5,34 kB, CSS 3,21 kB, JavaScript 12,99 kB |
| `npm.cmd run test:e2e` | Exit 0, 53/53 tester, 21,7 s; ingen hoppet over, normal opprydding utenfor sandkassen |

Port 5174 svarte `ECONNREFUSED` på både IPv4 og IPv6 etter normal avslutning. Ingen prosess måtte stoppes manuelt. Pakkefilen og låsefilen har fortsatt hashene oppgitt ovenfor. Ingen personlige nettleserdata er lest eller endret.

## Dekning av stories og akseptansekriterier

Alle oppgitte automatiserte tester nedenfor inngikk i den beståtte samlede kjøringen; ingen tester er hoppet over.

En separat dokumentkontroll 2026-09-07 bekreftet at alle 33 akseptansekriterier i sju storyfiler samsvarer med `epics.md`, at alle 11 sprintnøkler med rekkefølge er bevart, og at 30 lokale Markdown-lenker i versjonsevidens, overtakelse, refleksjon, logg og byggespesifikasjon peker til eksisterende filer. Kontrollene bekreftet også «Ikke startet» og blanke utprøvingsdatoer.

| Story / kriterier | Faktisk dekning og begrensning |
| --- | --- |
| 1.4 AC1–4 | `remaining.test.js` og `completion.spec.js`: bare valgt boolsk status, beholdte felt/ID/rekkefølge, begge retninger, redigering av fullført, omlasting og gjenåpning, skrivefeil, synlig gjenopprettet boks og nytt forsøk. Lese- og utkastlås inkluderer fullføring. Automatisk tastaturkontroll består; studenten bekreftet den fysiske kontrollen 2026-09-07. |
| 2.1 AC1–5 | Lokale mandagsgrenser, måned/år og 167/169-timersuker, eksakt frist og millisekund, fullførte og totalantall fra alle uker. `views.spec.js` kontrollerer startvisning, snarveier/tomt, fokus- og synlighetshendelser, sekundtikk, utkast/feil/fokus ved ukeskifte, null skriving, gjentatt høstminutt og levende tidssonebytte uten endret fristetikett. |
| 2.2 AC1–5 | `remaining.test.js` og `time-filter.spec.js`: 20/30/31, alle uker, forfalte/fullførte, frist før varighet, lik frist og stabil lagringsrekkefølge etter endringer/gjenåpning, ugyldige minutter, midlertidig minuttvalg, tomme treff/begge utveier, fullføring/angre og redigering/sletting med feil og nytt forsøk. |
| 2.3 AC1 | Faktiske kommandoer, miljø, tidligere testfeil og rettinger står ovenfor. |
| 2.3 AC2–3 | De 25 eksisterende nettleserregresjonene er beholdt og består, i tillegg til de 28 nye. Alle endringstyper har skrivefeil/retry, uleselige data sperres/bevares og kan leses på nytt. 360/1280, tastatur, fokus, utkast og lagring er automatisert. Fysisk gjennomgang og vurdering av forståelighet er registrert som bekreftet av studenten 2026-09-07 gjennom hele overtakelseskontrollen. |
| 2.3 AC4 | `acceptance.spec.js`: 100 syntetiske oppgaver med visningsbytte, filter, redigering, fullføring, sletting, ny oppgave og omlasting. HTML-lignende tittel forblir tekst. HTTP/WebSocket-forespørsler og sendte rammer kontrolleres: bare lokale utviklingsressurser, ingen oppgavemarkører i URL/kropp/rammer og ingen skriveforespørsler. Kildekontrollen fant bare localStorage i adapteren og ingen nettverkskode for oppgaver. SVG-navnerommet er ikke en ekstern ressursforespørsel. |
| 2.3 AC5–6 | [Menneskelig kontroll](version-one-handover-check.md) er godkjent 2026-09-07. [Refleksjonsgrunnlag](project-reflection.md) og [tom månedslogg](trial-log.md) finnes. Faktisk bruk er ikke oppgitt; måneden er derfor fortsatt Ikke startet med blanke datoer. |

## Skjermbilder og forståelige feil

26 skjermbilder fra den endelige nettleserkjøringen er bevart i `version-one-screenshots/`. Hovedagenten har inspisert ukevisning og tidsfilter ved 360/1280 px, ugyldig tidsvalg og fullføring/angre ved skrivefeil; etter siste retting er også ny ukevisning, angrevisning, feltfeil og fullføringsfeil inspisert. Innholdet brytes innenfor siden, fokus er synlig, og feilen står ved kontrollen for nytt forsøk. Dette er agentens inspeksjon av automatiserte skjermbilder, ikke studentens fysiske overtakelse.

- Ukevisning: [360 px](version-one-screenshots/week-view-360.png), [1280 px](version-one-screenshots/week-view-1280.png).
- Tidsfilter: [360 px](version-one-screenshots/time-filter-360.png), [1280 px](version-one-screenshots/time-filter-1280.png).
- Ugyldige minutter: [360 px](version-one-screenshots/time-filter-error-360.png), [1280 px](version-one-screenshots/time-filter-error-1280.png).
- Skrivefeil: [fullføring](version-one-screenshots/completion-write-failure.png), [angre](version-one-screenshots/undo-write-failure.png), [redigering](version-one-screenshots/edit-write-failure.png), [sletting](version-one-screenshots/delete-write-failure.png).

Feilmeldinger studenten kan vurdere uten å injisere feil i personlige data:

| Situasjon | Melding og handling |
| --- | --- |
| Oppretting/redigering kan ikke skrives | «Endringen ble ikke lagret. Utkastet er beholdt. Prøv Lagre igjen.» |
| Sletting kan ikke skrives | «Oppgaven ble ikke slettet. Lagrede oppgaver er beholdt. Prøv Slett igjen.» |
| Fullføring/angre kan ikke skrives | «Statusen ble ikke lagret. Tidligere status er beholdt. Prøv avkrysningen igjen.» |
| Lagringen kan ikke leses | «Oppgavene kunne ikke leses. Lagrede data er ikke endret. Oppretting, redigering, sletting og fullføring er sperret til lagringen kan leses.» Knappen «Prøv igjen» leser på nytt. |

## Kodegjennomgang og kjente begrensninger

Alle tre uavhengige lag er gjennomført på samme diff: blind gjennomgang med ti funn, grensegjennomgang med ett og verifikasjonsgjennomgang med ett forhåndsbekreftet testhull. [Byggespesifikasjonens triagelogg](spec-1-4-til-2-3-forste-versjon.md) vurderer hvert av de tolv funnene før gruppering. Den opprinnelige implementasjonsagenten har rettet alle åtte grupper, og hovedagenten har lest hele rettingsdiffen og kjørt full sluttkontroll. Ett lavprioritert forslag om å unngå uendrede attributtskrivinger ved klokketikk er avvist: den faktiske 100-oppgaverskontrollen viste ingen funksjonsfeil, og ekstra vakter var ikke begrunnet av dokumentert brukerulempe.

Rettingene omfatter fokus når en tom uke får oppgaver, presis lagringsmelding utenfor valgt visning, forklaring på låste oppgavehandlinger under utkast, tilgjengelig varsling av forfaltantall og styrket test av korrekt treffantall, status før skriving og simulert skjult/aktiv side. Den siste testen simulerer Page Visibility API; fysisk minimering og skjermleserbruk er ikke påstått utført.

Den strengere fokusprøven avdekket faktisk klipping nederst i et 900 px høyt vindu, bortfall av ytre fokusramme på datofeltets interne Tab-steg og forskyvning av fokus ved ny forfalttekst/avbruddsmelding. Fire av seks målrettede tastaturtester feilet først. CSS/UI er rettet med beholdt ramme, rulleavstand og synlighetsreparasjon etter slike endringer. Klokketikk ruller bare tilbake når fokus var synlig før oppdateringen; bevisst skrolling bort fra feltet har egen bestått kontroll. Etter retting besto 25/25 berørte atferdstester og 6/6 tastaturtester før hovedagentens samlede 53-testkjøring. Ingen testkrav ble fjernet.

To eldre begrensninger er bekreftet:

- Bruk én redigerende fane. Flere faner med hver sin innleste liste kan overskrive hverandres endringer. Dette fantes før story 1.4 og står allerede i tidligere README.
- Bruk samme lokale tidssone. `2026-03-08T02:30` er gyldig i Oslo, men finnes ikke i New York ved overgangen til sommertid. Etter slikt tidssonebytte kan skriving avvises og ny lesing sperres. Hovedagenten reproduserte samme resultat med baseline og ny kode; rådata blir beholdt. Testet bevaring av lokale fristetiketter er ikke støtte for alle frister ved reiser mellom tidssoner. Arkitekturen utsetter denne støtten, og lagringskontrakten/lesefeilsperren er beholdt.

## Innsendt automatisert gjennomgang

Mottatt fra brukeren 2026-09-07, før den senere personlige godkjenningen samme dag. Tabellen nedenfor bevarer rapporterte resultater og avgrensninger på det tidspunktet. Det ble ikke kjørt nye tester eller gjort appendringer ved registreringen. Rapporten oppgir ikke nye kommandoer, testantall eller kjørelogger; den tidligere dokumenterte sluttkontrollen på 142 enhets- og 53 nettlesertester står derfor uendret.

| Kontroll | Rapportert resultat og avgrensning |
| --- | --- |
| Opprette 20/30/31-minuttersoppgaver | Bestått; uke er startvisning, lagring utenfor utvalget forklares og oppgavene finnes i allevisningen. |
| Fullføre og angre med tastatur | Bestått med automatisert tastaturbruk; bare valgt oppgave endres, status og fokus stemmer. |
| Redigere fullført oppgave | Bestått; status beholdes, ugyldige verdier beholder utkastet og avbrudd bevarer lagrede verdier. |
| Avbryte og bekrefte sletting | Bestått; valgt oppgave og relevant fokus håndteres riktig. |
| Visningsbytte og forfalte oppgaver | Bestått; markert visning, riktig forfaltutvalg og fungerende snarveier. |
| Fristpassering under redigering | Bestått med styrt klokke; utkast, markør og fokus beholdes. Retur til siden ble simulert. |
| Tidsfilter på 30 minutter | Bestått; ufullførte 20/30-minuttersoppgaver fra alle uker, sortert etter frist. |
| Ugyldige minutter | Bestått for tomt, null, negativt og desimalt; feltfeil og skjulte gamle treff. |
| Gyldig tid uten treff | Bestått; tomtekst, endring av minutter og allevisning fungerer. |
| Endre oppgaver i tidsutvalget | Bestått; fullføring, angre, redigering og sletting oppdaterer treff/fokus, og minutter beholdes mellom visninger. |
| Omlasting og gjenåpning | Bestått for siden i samme nettleserkontekst; full avslutning og omstart av nettleseren ble ikke kontrollert. |
| Tomtilstander | Bestått med isolerte testdata for tom uke, tomt utvalg og tom liste. |
| Tastatur, feltmerking og layout | Bestått i automatiserte situasjoner med Tab, Shift+Tab, Enter og mellomrom; fysisk studentkontroll gjenstår. |
| Lagringsfeil | Bestått i isolerte tester; rapporten oppgir også lesing av evidens og inspeksjon av eksisterende skjermbilder. |
| Serverstopp | Rapportert utført; ingen server lyttet på 5173 eller 5174 etter denne gjennomgangen. Dette er ikke en ny portkontroll utført ved registreringen. |

Rapporten bekrefter fortsatt de to kjente begrensningene ved samtidige redigeringsfaner og enkelte tidssonebytter. Den melder også to språkforbedringer: «1 ufullførte oppgaver» og visning av den tekniske maksverdien `9007199254740991` i feltfeilen. Språkmerknadene er registrert og ikke rettet i denne dokumentoppdateringen; den underliggende regelen om positive sikre heltallsminutter gjelder fortsatt.

Rapporten presiserte at den bare gjaldt automatisert gjennomgang. Ved registreringen sto fysisk studentkontroll åpen og storyene fortsatt i `review`. Den senere personlige bekreftelsen nedenfor er grunnlaget for at storyene nå er `done`; rapporten er ikke omklassifisert til menneskelig testing.

## Menneskelig overtakelse

Etter at studenten ble bedt om å gjennomføre hele [kontrollisten](version-one-handover-check.md) selv ved 360/1280 px med fysisk tastatur, svarte studenten 2026-09-07:

> Alt funket

Dette er registrert som godkjenning av alle 14 punktene, inkludert fysisk tastaturbruk, forståelighet og de nye funksjonene. Godkjenningen er studentens egen bekreftelse, atskilt fra agentens automatiserte kontroller og tidligere overtakelse av 1.3. Ingen nye kodeendringer, tester eller personlige nettleserundersøkelser er utført ved denne statusoppdateringen. Kjente begrensninger og registrerte språkforbedringer er beholdt i dokumentasjonen.

Menneskelig sluttkontroll: **Godkjent 2026-09-07**. Alle sju stories og begge epics står i `done`; retrospektiver er fortsatt `optional`. Månedsutprøving: **Ikke startet**, med tomme datoer i [loggen](trial-log.md), fordi faktisk oppstart med egne oppgaver ikke er meldt. Studentvalg og KI-bidrag dokumenteres i [prosjektnotatene](project-reflection.md).
