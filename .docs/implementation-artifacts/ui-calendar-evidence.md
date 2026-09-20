# Dashboard og fristkalender — implementering og evidens

Opprettet 2026-09-07 (Europe/Oslo). Gjelder [spesifikasjonen](spec-ui-calendar.md) og [story 4.1](../planning-artifacts/stories/4-1-oversiktlig-dashboard-og-fristkalender.md).

## Implementert omfang

Et varmere og tydeligere dashboard med grønn identitet, faktiske beregnede tall, hurtigvalg for 15/30/45/60 minutter og egendefinert tid, ett visuelt prioritert hovedforslag, fristkalender med lokal måned/dagsliste og mobilagenda, stabile emnefarger, tilgjengelige oppgavemenyer og korte tilbakemeldinger. Frister skrives og vises på norsk med 24-timersklokke; skjemaet bruker dato og uttrykkelig `HH:mm`-felt.

Alle eksisterende regler om ett aktivt neste steg, tidsfilter og separate ferdig-/levertstatuser beholdes. Kalenderen og tallene avledes fra samme lagrede oppgaver. Ingen nye lagringsfelt, migrering, avhengigheter eller fiktive brukerdata innføres. Lagringsnøkkel og schemaVersion 1 er uendret.

## Kjørte kontroller

Faktiske sluttkontroller 2026-09-07 (Europe/Oslo), fra `studieplanlegger/`. Hovedagenten kjørte enheter, syntaks og bygg; nettlesertestagenten gjennomførte en sammenhengende fullkjøring. Etterpå ble en siste CSS-detalj for ekstremt lange emnenavn rettet, og hurtigvalg 45/60 minutter samt Escape-lukking fikk uttrykkelig testdekning. Den etterfølgende avgrensede kontrollen av dashboard og akseptanse besto mot siste CSS og de supplerte testene. Planlagte eller ufullførte kjøringer telles ikke som bestått.

| Kontroll | Faktisk resultat |
| --- | --- |
| `npm.cmd test` | Exit 0, 230/230 enhetstester i fem filer, 935 ms; de tidligere 196 og 34 nye kalenderprøver |
| `node node_modules/@playwright/test/cli.js test --workers=2` | Exit 0, 75/75 nettlesertester, 1,1 min; alle 64 tidligere scenarioer og 11 nye består i én fullkjøring |
| `node node_modules/@playwright/test/cli.js test tests/e2e/dashboard-calendar.spec.js tests/e2e/acceptance.spec.js --workers=2` | Exit 0, 14/14 tester, 17,0 s, etter siste CSS-retting og supplert kontroll av hurtig45/60 og Escape. Dette er en etterkontroll av delsettet, ikke 14 ekstra tester i totalen |
| `npm.cmd run build` | Exit 0, først 261 ms og deretter 153 ms etter siste CSS-retting; produksjonsfiler bygges lokalt, ingen publisering |
| `node --check` for 21 JavaScript-filer | Alle består; `calendar.js` ble kontrollert på nytt etter den siste DOM-justeringen. Dette er syntakskontroll, ikke statisk typekontroll |
| Lint og typekontroll | Ingen egne skript/verktøyoppsett i eksisterende prosjekt; ikke kjørt som separate kontroller |
| Visuell nettleserinspeksjon | Hovedagentens isolerte Chromium-kontroll ved 1440 × 1000, 390 × 844 og en skjemasjekk ved 320 × 740 er utført. Lange ord i tittel/emne er også kontrollert ved 360 × 900. Ingen observerte sidefeil eller horisontal sideskrolling. Automatisert tastatur-/regresjonskjøring består; ingen menneskelig godkjenning av redesignet er meldt |

Nettleserkjøringen brukte Playwrights eksisterende lokale CLI direkte med to arbeidere. Det er samme testoppsett som `npm.cmd run test:e2e`, ikke et nytt testverktøy eller en ny pakkeavhengighet.

## Visuell kontroll og rettinger

Hovedagenten undersøkte den lokale nettsiden i en isolert Chromium-kontekst med syntetiske testoppgaver. Kontrollene omfattet tomt og utfylt dashboard på stor skjerm, mobiloversikt og oppgaveskjema på smal skjerm. Testoppgavene var bare i den isolerte konteksten; produktet inneholder ikke oppdiktede brukeroppgaver eller statistikker, og personlige nettleserdata ble ikke brukt.

Observerte detaljer ble rettet under denne kontrollen: linjeskift i kalenderens knapper, bakgrunn for «Klar til levering», kontrast på sekundærtekst, synlig årstall for frister utenfor inneværende år, relevant fokus fra ukesammendraget og beholdt utkastbeskrivelse ved bruk av kalenderen. Kalenderjusteringen samler klokkeslett og emne i samme metadatarad og fjerner en utilsiktet toppmarg på tittelen, slik at mobilagendaen blir mer kompakt. En siste CSS-retting sørger for at ekstremt lange emnenavn ikke presser statusmerket til bokstavvise linjeskift. De seks opprinnelige kontrollbildene og bildet med lange titler/emnenavn ved 360 × 900 ble laget på nytt; hovedagenten bekreftet lesbar status og ingen horisontal sideskrolling. Ingen sidefeil ble observert. Enhetsprøver, syntaks, bygg, full nettleserkjøring og avgrenset etterkontroll er bestått som angitt ovenfor.

Bevarte skjermbilder:

- Stor skjerm, mobiloversikt, agenda, oppgaveskjema og lange ord ved 360 px ble inspisert lokalt. Skjermbildene er utelatt fra GitHub-leveransen.

Åtte bilder fra de beståtte nettleserprøvene er også arkivert. Arkivet ble oppdatert etter den siste etterkontrollen, og SHA-256 er sammenlignet mot de genererte testfilene:

- Dashboard med 0, 1 og 12 oppgaver ble kontrollert ved 360 og 1280 px. Norsk 24-timersklokke i en-US-nettleser og mobilagenda etter tastaturnavigasjon ble også kontrollert. De lokale skjermbildene er ikke med i leveransen.

Dette er agentens nettleser-/skjermbildeinspeksjon med emulerte vindusstørrelser og automatiserte nettleserprøver. Det er ikke studentens fysiske tastatur-/mobilgjennomgang eller måling av faktisk brukernytte.

## Akseptanse og avgrensninger

| Kriterium | Faktisk dekning |
| --- | --- |
| AC1, dashboard | `dashboard-calendar.spec.js`: 0/1/12 syntetiske oppgaver ved 360/1280, faktiske uke-/forfalttall, tomtilstand, hovedforslag og ingen skriving ved visning. `calendar.test.js` dekker stabile emnefarger; hovedagentens bilder dokumenterer den visuelle utformingen |
| AC2, tid/forslag | Dashboardprøvene klikker 15/30 minutter og bekrefter stegets 20-minuttersestimat på en 240-minuttersoppgave. Etterkontrollen bekrefter også faktiske klikk på 45/60, feltverdi, `aria-pressed` og forslag. Eksisterende tids-/stegprøver består for egendefinerte minutter, filtergrenser, fristsortering, alternativer og tomtilstander |
| AC3, kalender | `calendar.test.js` har lokale måned-/års-/skuddårs-/sommertidsgrenser og 42 dager. Nettleserprøven krysser desember/januar med piltaster, forrige/neste og «I dag», passerer midnatt og beholder valgt dato/fokus uten lagringsskriving |
| AC4, dagsliste/redigering | Nettleserprøver for tom/enkelt/flere frister, stabil tidsrekkefølge, alle statuser og korrekt forfaltmerking. Redigering fra kalender, forslag og oppgaveliste endrer samme ID og dato overalt; tre lagringer og omlasting kontrolleres |
| AC5, mobilagenda | 360 px starter i agenda; 1280 px viser måned. Tastatur bytter modus, piltaster/Home/End navigerer, tom/fylt måned vises, valgt modus beholdes gjennom klokke/visningsbytte, og redigering/avbryt gjenoppretter fokus. Ingen horisontal sideskrolling i kontrollerte bredder |
| AC6, lokal 24-timer | Rene formateringsprøver og en egen en-US-nettleserkontekst bekrefter `20:30` i tekstfelt, lagret `deadlineLocal`, norske fristtekster og ingen AM/PM i siden. Redigering, årstall utenfor inneværende år og oppdatering ved årsskifte kontrolleres; tidligere ugyldig-/sommertids- og skjemaprøver består |
| AC7, fokus/feil | Eksisterende tastatur-, feltfeil-, lagringsfeil- og utkastprøver består i det nye grensesnittet. Nye prøver kontrollerer ukesammendragsfokus, kalenderens tastaturrekkefølge og relevant fokus etter redigering/avbryt. Etterkontrollen bekrefter at Escape lukker en åpen oppgavemeny og gir fokus tilbake til menyens kontroll. Fysisk studentkontroll er ikke registrert |
| AC8, bakoverkompatibilitet | Alle tidligere 64 nettleserscenarioer og 196 enhetsprøver består sammen med tilleggene. Nye kalenderprøver kontrollerer uendret rålagring ved visning/navigasjon og samme oppgave etter kalenderredigering/omlasting; hashkontrollen nedenfor bekrefter uendrede domeneregler og lagringsadapter |
| AC9, ferdigstilling | 230 enhets-/75 nettleserprøver, syntaks, bygg og faktisk visuell kontroll er dokumentert. Aktive krav, arkitektur, story/epics, README, tester, status og refleksjon er samordnet; tidligere observasjoner holdes historisk atskilt |

Teknisk implementering og tilgjengelige kontroller er ferdige. Story/spesifikasjon står i `review` fordi ny menneskelig gjennomgang ikke er meldt, ikke fordi automatisering gjenstår. Tidligere delvis manuell observasjon gjelder [3.1-evidensen](study-actions-evidence.md) og er ikke godkjenning av redesignet eller kalenderen.

Kjente eksisterende begrensninger er én redigerende fane og samme lokale tidssone. Data er lokale og usynkroniserte. Kalenderen er en fristvisning, ikke automatisk planlegging, synkronisering eller import. Ingen måling av faktisk studietid eller brukersporing er innført.

Hovedagentens hashkontroll bekrefter at `src/tasks.js`, `src/storage.js`, `package.json` og `package-lock.json` er identiske med baselinen før redesignet. Oppgaveregler, lagringsadapter og pakkeversjoner er dermed bevart; nye kalender-/dashboardvisninger bruker eksisterende data. Dette erstatter ikke nettleserkontrollen av de endrede skjemaene og handlingene.

## KI-bruk og menneskelig vurdering

Brukeren bestilte redesignet og kalenderen; KI gjør de konkrete tekniske og visuelle valgene, kodeendringene, testtilpasningene og dokumentoppdateringene under denne delegeringen. Ingen selvstendig studentkode, læring eller nye enkeltgodkjenninger er antatt.

Byggeflytens render ble forsøkt én gang, men `uv.exe` feilet med «Filen er ikke tilordnet noe program for denne operasjonen». Arbeidet fortsatte direkte under brukerens gjennomføringsordre. Ikke-utførte workflowkontroller påstås ikke utført.

Den [nye menneskelige prøvelisten](ui-calendar-handover-check.md) står åpen. Studentens tidligere «Jeg har gjort det» gjelder eksempelflyten før redesignet. [Månedsloggen](trial-log.md) står **Ikke startet** med blanke datoer. Et roligere uttrykk, lettere oppstart og bedre fristoversikt er forventede virkninger som ikke er målt i en brukermåned.
