# Neste steg, hovedforslag og levering — implementering og evidens

> Historisk evidens for neste-steg-/leveringstilleggene før dashboardredesign og kalender. Testresultater og den delvise menneskelige observasjonen nedenfor beholdes uendret. [Redesign-/kalenderevidensen](ui-calendar-evidence.md) dokumenterer den nye leveransen separat.

Opprettet 2026-09-07 (Europe/Oslo). Gjelder [utvidelsesspesifikasjonen](spec-study-actions.md) og [story 3.1](../planning-artifacts/stories/3-1-neste-steg-hovedforslag-og-levering.md).

## Implementert omfang

Den bestilte utvidelsen omfatter ett valgfritt aktivt neste steg med eget estimat, ett forklart hovedforslag med alternativer og separat ferdig-/levertstatus. Det er ingen generell deloppgaveliste eller steghistorikk. Å gjøre et steg endrer ikke hovedestimatet, arbeidsfullføringen eller leveringen. Alle tre funksjonene inngår i nåværende scope.

Eksisterende generiske oppgaver får et valgfritt innleveringskrav. Gammel `completed`-status brukes aldri som leveringsbevis. Nøkkel og schemaVersion 1 beholdes; manglende nye felt håndteres bakoverkompatibelt uten oppstartsskriving. En bekreftet levering må angres før arbeidets ferdigstatus eller innleveringskravet kan endres. Angre levering gir fortsatt ferdig arbeid, «Klar til levering».

## Kjørte kontroller

Faktisk sluttkontroll 2026-09-07 (Europe/Oslo), fra `studieplanlegger/`. Implementerings- og testagentene kjørte kontrollene, og hovedagenten bekreftet samlet test-/byggresultat.

| Kontroll | Faktisk resultat |
| --- | --- |
| `npm.cmd test` | Exit 0, 196/196 tester i fire filer; de tidligere 142 pluss 54 nye domenetester |
| `npm.cmd run test:e2e -- --workers=2` | Exit 0, 64/64 tester, 31,7 s; de tidligere 53 og 11 nye nettlesertester består |
| `npm.cmd run build` | Exit 0, 80 ms; produksjonsfiler i `dist/`, ingen publisering |
| `node --check` for prosjektets 19 JavaScript-filer | Alle med exit 0; syntakskontroll, ikke statisk typekontroll |
| Lint og typekontroll | Ingen egne skript eller verktøyoppsett i eksisterende JavaScript-prosjekt; disse er ikke kjørt som separate kontroller |
| Mobil/tastatur og visuell inspeksjon | Automatiserte kontroller ved 360/1280 px består; seks nye skjermbilder inspisert av testagenten uten observerte visuelle feil. Studentens egen mobil-/tastaturkontroll er ikke bekreftet |

En målrettet kjøring av de 11 nye nettlesertestene besto først på 8,0 s; tabellen viser den etterfølgende samlede sluttkjøringen. Tidligere mislykkede forsøk er ikke telt som bestått: en vanlig redigering la først til false-felt i eldre objekter og ble rettet med regresjonstest. Gamle kontrollselektorer ble avgrenset til synlige kontroller etter at leveringsknappen ble innført. To nye fokusprøver ble rettet til faktisk Tab-navigasjon i stedet for programmatisk fokus etter musebruk, slik at nettleserens `:focus-visible` ble testet riktig. Alle gamle testbetydninger er beholdt.

En nettleserkjøring hadde oppryddingsproblem i sandkassen. Den identifiserte egne testserveren ble stoppet målrettet, og sluttkjøringen utenfor sandkassen avsluttet normalt. Det ble ikke injisert feil i personlige nettleserdata.

## Akseptansekriterier og begrensninger

| Kriterium | Faktisk dekning i bestått sluttkjøring |
| --- | --- |
| AC1, ett neste steg | `next-action.test.js` og `action-planning.spec.js`: oppretting, redigering, fjerning/gjort/nytt steg, validering, bokstavelig tekst, bevaring av hovedestimat og statuser |
| AC2–3, forslag | Stegestimat før hovedestimat, 240/20/30 og steg som ikke passer selv om hovedestimatet gjør det, stabil fristsortering, ett hovedforslag med forklaring, vis/skjul alternativer |
| AC4, tomt/frister | Nyttig tomtilstand og veier videre; store/forfalte oppgaver forblir i fristoversikten, forslag filtrerer bare tidsvisningen |
| AC5, ferdig/levert | Manuell ferdig → klar → levert → angre, sperrer på ugyldige overganger, klar-til-levering fortsatt forfalt ved gammel frist og utelatt fra arbeidsforslag; vanlig fullføring består |
| AC6, lagring | Eldre, blandede og nye oppgaver, optional/null steg, fraværende flagg, ingen levering avledet fra gammel fullføring, vanlig gammel redigering uten påtvungne nye felt, omlasting/gjenåpning |
| AC7, feil/tilgjengelighet | Kandidat-/feltvalidering, rådata og utkast beholdt ved feil/retry, lesesperre for nye handlinger, nye mobil-/tastatur-/fokusprøver ved 360/1280; fysisk menneskelig bruk er ikke påstått |
| AC8, ferdigstilling | Enhets-/nettlesertester, syntaks og bygg dokumentert ovenfor; brief, PRD, arkitektur, epics/story, README, testbeskrivelse, status, refleksjon og prøvelogg samordnet |

Teknisk implementering og tilgjengelige kontroller er ferdige. Story/spesifikasjon står i `review`: studenten har nå meldt at den korte eksempelflyten er prøvd, men hele den nye menneskelige sjekklisten er ikke bekreftet. Det er ikke en ukjørt automatisk kontroll. Eldre godkjenning finnes i [versjonsevidensen](version-one-evidence.md) og er ikke overført til utvidelsen.

## Skjermbilder

Seks skjermbilder fra sluttkontrollen er bevart utenfor den midlertidige testmappen:

- Neste-steg-skjema: [360 px](study-actions-screenshots/next-step-form-360.png), [1280 px](study-actions-screenshots/next-step-form-1280.png).
- Hovedforslag med neste steg: [360 px](study-actions-screenshots/next-step-suggestion-360.png), [1280 px](study-actions-screenshots/next-step-suggestion-1280.png).
- Klar til levering: [360 px](study-actions-screenshots/ready-for-delivery-360.png), [1280 px](study-actions-screenshots/ready-for-delivery-1280.png).

Inspeksjonen er agentens vurdering av automatiserte skjermbilder, ikke studentens fysiske gjennomgang eller en måling av brukereffekt.

Kjente eksisterende begrensninger består: én redigerende fane og samme lokale tidssone. Nettleserdata er lokale og usynkroniserte. Ingen konto, automatisk levering/import, sporing eller publisering er innført.

## Studentens prøveeksempel 2026-09-07

Etter den korte instruksen om å prøve neste steg, tidsforslag og ferdig-/leveringshandlingene svarte studenten «Jeg har gjort det» og la ved to skjermbilder i samtalen. Ett viser meldingen «Neste steg er gjort» og 0 forslag ved 200000 tilgjengelige minutter. Det andre viser «Fransk presentasjon» i alleoversikten med estimat 20 minutter, frist 2026-09-16 kl. 20:48, avkrysset «Ferdig med arbeidet», «Klar til levering», «Bekreft levert» og mulighet til å legge til et nytt steg.

Den viste ferdigstatusen forklarer at oppgaven ikke inngår i arbeidsforslag, uansett tilgjengelig tid, samtidig som den beholdes i alleoversikten for oppfølging av levering. Skjermbildene dokumenterer denne sluttstatusen; de viser ikke alle overgangene eller en før/etter-sammenligning av hovedestimatet. Ingen feil er uttrykkelig meldt. Meldingen er registrert som prøvd eksempelflyt, ikke bekreftelse på alle punktene i [den fulle sjekklisten](study-actions-handover-check.md), lagring etter gjenåpning eller fysisk mobil-/tastaturkontroll. Ingen kodeendringer eller nye automatiserte testkjøringer er gjort ved denne registreringen.

## KI-bruk og menneskelig vurdering

Brukeren bestilte de tre funksjonene og ba om selvstendig implementering, dokumentasjon og verifisering. KI bidrar med kode, tester, tilpasning til eksisterende modell og dokumentoppdateringer. De konkrete tekniske valgene er agentens under denne delegeringen; de er ikke fremstilt som studentens egne kodebidrag eller særskilt godkjente valg.

Byggeflytens render ble forsøkt én gang, men `uv.exe` kunne ikke starte («Filen er ikke tilordnet noe program for denne operasjonen»). Arbeidet fortsatte direkte i tråd med brukerens uttrykkelige gjennomføringsordre. Ingen vellykket render eller ikke-utført workflowkontroll påstås.

Den [nye menneskelige kontrollisten](study-actions-handover-check.md) inneholder nå studentens prøveobservasjoner; de fullstendige sjekkpunktene står fortsatt åpne. Tidligere «Alt funket» gjelder den eldre versjonen. [Månedsloggen](trial-log.md) står **Ikke startet** med blanke datoer. Enklere oppstart, mindre valgarbeid eller færre glemte innleveringer er forventninger som ikke er målt.
