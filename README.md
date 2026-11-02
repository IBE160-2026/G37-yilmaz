# G37 — Git Happens

Gruppeprosjekt i **IBE160 Programmering med KI** ved Høgskolen i Molde, høsten 2026 (15 studiepoeng).

Ajour hjelper studenten gjennom **oppgave → valgfritt arbeidssteg → godkjent studieøkt → utfall → justering**. Lokale regler bruker registrerte frister, gjenstående arbeid, avhengigheter og ledig tid til å foreslå neste handling. Studenten godkjenner planen og registrerer hva som faktisk skjedde. Import støtter denne flyten; manuell registrering fungerer uten eksterne kilder. Repoet inneholder appen og dokumentasjon av utvikling, testing og kvalitetssikring med KI.

**Ajour, oppfølging 2026-10-26:** Produktet bruker ordmerket **ajour**, «Kom ajour.» og «Planer endrer seg. Det er helt greit.». Tolv stabile emnefarger og **System/Lyst/Mørkt** viderefører dagens layout, V1, dataformater og oppstartskommandoer. Appmappen heter fortsatt `studieplanlegger`. [Verifikasjonsoversikten](studieplanlegger/VERIFICATION.md#hva-som-ble-rettet-og-kontrollert) oppsummerer temaendringen og tidligere rettinger med dato. Publiseringen `9d3a169` er historisk og før Ajour; eldre kontroller er ikke nye pass.

**Avgrensning 2026-10-16:** [Brief → PRD → stories → kode/test](.docs/planning-artifacts/README.md) er nå dokumentert som en datert rekonstruksjon etter faglærertilbakemeldingen. V1-import gjelder HiMolde IT 2026–27 med IBE110/IBE430 og enten IBE160 eller IBE102+IBE152; undervisning bare IBE110/IBE430/IBE160 høst 2026. NTNU omfatter ARK1001/EXPH0100 emnemetadata og emnelenket undervisning høst 2026, uten komplett programløfte. Full nasjonal dekning er visjon. Ingen full eksamensdekning eller personlig gruppetilhørighet loves. Historiske kontroller beholder sine datoer; teknisk testing dokumenterer ikke studentnytte.

## Nettleserutgave — 2026-10-29

**Åpne [Ajour på nett](https://ajour-sooty.vercel.app/).** Appen bruker **ett gratis Vercel-prosjekt**, `ajour`. Hele Ajour-flyten beholdes; lokal Node-/Docker-drift er fortsatt tilgjengelig. [Verifikasjonen](studieplanlegger/VERIFICATION.md) skiller daterte produksjonskontroller og commitbevis fra prosjekteierens egenutprøving. Den første publiseringen via [PR #1](https://github.com/IBE160-2026/G37-yilmaz/pull/1) er historikk fra 29. oktober.

I nettutgaven lagres planen bare i den aktuelle nettleserprofilen på den nøyaktige nettadressen. Localhost, Vercel-forhåndsvisninger og produksjonsadressen har separate data. Sletting av nettleserdata kan slette planen; eksporter sikkerhetskopi for trygg oppbevaring eller flytting mellom adresser/enheter. Det finnes ingen konto eller enhetssynkronisering. [Oppsett og fjernkontroll](studieplanlegger/README.md#nettleserdrift-med-vercel--2026-10-29) beskriver den nye driftsformen uten å endre V1-importløftet eller statusen for egenutprøving.

## Medlemmer

- Elias Hemsett Yilmaz

## Dette inneholder dagens versjon

En oppgave trenger bare tittel; emne, frist, arbeidsanslag og ordnede steg er valgfrie. En godkjent økt er planlagt tid. Faktisk tid og nytt gjenstående anslag registreres hver for seg, og fullført steg, ferdig oppgave og bekreftet innlevering er separate handlinger. Den [syntetiske hovedflyten](.docs/implementation-artifacts/solution-guide.md#hovedflyt-og-gjeldende-løfte--2026-10-16) viser hvordan delene henger sammen.

Studieprogram, emner og offentlig undervisning kan importeres etter kontroll. Kildens alternativgrener beholdes som valg; tidligere aktiviteter og studentvalg bevares ved kildefeil. Fil- og kalenderlenkeimport deler forhåndsvisning og én samlet godkjenning, med nødvendige avklaringer av emner og usikre tidspunkt. Gjentatt import bevarer identiteter og egne endringer innen de dokumenterte kontraktene.

Planleggingen støtter gjenbrukbare studietidsmønstre, usikre arbeidsanslag, daglig veiledning og studentgodkjent omplanlegging. Import- og kalendergrensesnittet bevarer relevante åpne seksjoner, rulleposisjon og fokus, viser læresteder, programmer og emner alfabetisk etter norsk navn, og viser stabile emnefarger sammen med tydelige emnekoder. Kalenderens topp har en eksporthandling som lager en lokal `.ics`-kopi; frister blir kompatible, transparente kalenderhendelser uten oppdiktet varighet. Implementert kildekode og avgrensede kontroller er ikke det samme som full nasjonal kilde- eller programdekning; se [importdekningen](studieplanlegger/IMPORT-COVERAGE.md).

## Leveringsoversikt — 1. november 2026

**Ferdig og dokumentert:** De rapporterte omprøvingene er registrert som **egenutprøving utført av prosjekteier**. Identisk 500-import, historikk uten vekst, faktisk stor gjenoppretting med bevarte data etter omlasting, norske tidsfeil, én kapasitetsforklaring og AHOs semesteretiketter bestod innen det dokumenterte omfanget. SC-07/1200–30 og Outlook-prøven fra 30. oktober beholder bestått. [Prøveplan og egenresultater](.docs/planning-artifacts/USER-TRIAL-PLAN.md#egenutprøving-utført-av-prosjekteier--2026-11-01) er skilt fra [oppsummerte automatiske kontroller](studieplanlegger/VERIFICATION.md#dokumenterte-resultater).

| Finn fram | Innhold |
| --- | --- |
| [Brukerveiledning](studieplanlegger/README.md#kom-i-gang-og-finn-frem) og [løsningsguide](.docs/implementation-artifacts/solution-guide.md) | Hovedflyt, lagring, sikkerhetskopi og bruk. Lokal oppstart står nedenfor. |
| [Planindeks og leveringsgrunnlag](.docs/planning-artifacts/README.md) | Brief, PRD, stories, arkitektur og krav-/testsporbarhet. |
| [Kjente begrensninger](studieplanlegger/README.md#kjente-begrensninger-ved-levering) | NTNU, UiT, lagringskvote, prøvens avgrensning, F03/F05 og bundlevarsel, med betydning for V1. |
| [Refleksjonsrapport – Markdown](.docs/submission/reflection-report.md) | Prosjekteierens leverte rapport med egne erfaringer og oppgitt KI-hjelp til struktur og formulering. Rapporten leveres bare som Markdown i repoet. |
| [Utviklingsprosess og kvalitetssikring](.docs/implementation-artifacts/development-process.md) | Dokumenterte hendelser, KI-styring og avgrensning av personvernkontroll. |
| [GitHub-repo](https://github.com/IBE160-2026/G37-yilmaz) og [produksjonsapp](https://ajour-sooty.vercel.app/) | Leveringsdokumentene leses på GitHub; appen publiseres gjennom det eksisterende Vercel-prosjektet. |

**Rapporten foreligger; personlig sluttgjennomlesing og innlevering er ikke bekreftet.** Prosjekteieren må sluttlese rapporten, kontrollere konkret frist, kanal og obligatorisk filformat i emnets offisielle innleveringsbeskjed, og gjennomføre selve innleveringen med kvittering. Den leverte rapportmalen angir **3000–5000 ord**. Det opprettes ingen PDF uten et bekreftet behov. Den tilgjengelige sensorveiledningen er lest; godkjent proposal og overordnet veiledning er fortsatt ikke identifisert. Dette er manglende kildegrunnlag, ikke nye krav. Eldre testresultater beholdes med dato; egenutprøvingen dokumenterer ikke generell studentnytte eller full sikkerhet.

Sluttrapporten er inkludert etter prosjekteierens uttrykkelige tillatelse. Den ligger bare under `.docs/submission/`, uten kopi i appens `public/` eller brukergrensesnitt. Private refleksjonsutkast, rålogger, sikkerhetskopier og personlige testdata forblir lokale og ignorerte.

## Kjør den komplette lokale leveransen

Du trenger Docker med **Compose v2** (`docker compose version`). Ingen konto, nøkler eller `.env` er nødvendig med standardoppsettet. Fra repository-roten:

```powershell
cd studieplanlegger
docker compose up --build -d
```

Åpne <http://127.0.0.1:8088>. Kontroller at tjenesten er klar med:

```powershell
docker compose ps
Invoke-RestMethod http://127.0.0.1:8088/api/health
```

Stopp med `docker compose down`. Ikke bruk `-v` hvis dataene skal beholdes. Tjenesten publiseres bare på loopback, og SQLite-databasen ligger i et navngitt Docker-volum. Se [appens README](studieplanlegger/README.md) for bruk, lagring, sikkerhetskopi og kjente begrensninger.

## Tester og produksjonsbygg

Docker-oppstarten ovenfor krever ikke en lokal Node-installasjon. For lokal utvikling og npm-testene trenger du **Node.js 24** (låsefilen er kontrollert med npm 11). Kjør fra `studieplanlegger/`:

```powershell
npm ci
npx playwright install chromium
npm run test:unit
npm run verify:teaching
npm run build
npm run test:e2e:database
```

`npx playwright install chromium` kreves før både `npm run test:e2e` og `npm run test:e2e:database`. `verify:teaching` er den repeterbare, lokale kontrollen av versjonerte undervisningsfixturer; den gjør ikke eksterne kildeoppslag. Databasekommandoen bygger appen, velger en ledig loopback-port og kjører den målrettede produksjonsflyten mot en midlertidig Node/SQLite-database; den trenger ikke Docker eller en eksisterende server. Den vanlige Vite-baserte nettlesersuiten kan kjøres separat med `npm run test:e2e` og bruker `localStorage`, ikke SQLite. Testene bruker syntetiske studentdata; kildeadaptrene testes også mot versjonerte fixturer fra offentlige kilder.

På en ren Linux-maskin kan Playwrights systembiblioteker også mangle. Bruk da `npx playwright install --with-deps chromium` med nødvendige lokale administratorrettigheter i stedet for den vanlige installasjonskommandoen.

## Arkitektur og dokumentasjon

`studieplanlegger/src/` inneholder klient og domeneregler, `studieplanlegger/server/` API/database og kildeadaptere, og `studieplanlegger/tests/` enhets-, nettleser- og produksjonstester. `.docs/planning-artifacts/` samler gjeldende krav og sporbarhet; `.docs/implementation-artifacts/` inneholder kuratert prosess, løsningsbeskrivelse og CSV-formatkontrakt. [Sporbarhetsmatrisen](.docs/planning-artifacts/TRACEABILITY.md#sensorveiledningens-sju-områder) bevarer den daterte vurderingsgjennomgangen fra 16. oktober. Sensorveiledning og godkjent proposal var ikke tilgjengelige i den tidligere dokumentasjonsrunden 25. oktober. I Ajour-oppfølgingen samme dag ble alle sju sider av sensorveiledningen lest på nytt; kilde og sjekksum står i planindeksen. Godkjent proposal er fortsatt ikke identifisert.

Løsningen består av en Vite-klient i vanlig JavaScript, kildeadaptere og to tydelige driftsformer. Lokal Node-/Docker-produksjon bruker SQLite som autoritativ lagring: klienten sender komplette, validerte tilstandsendringer med forventet revisjon, og serveren skriver transaksjonelt. Compose binder vertsporten til `127.0.0.1` og beholder databasen i volumet `studieplan-data`. Vercel-utgaven bruker den eksisterende nettleserlagringen; serverfunksjonene gir bare avgrenset importforhåndsvisning og har ingen delt studenttilstand.

Dokumentasjonen nedenfor beskriver løsningen, utviklingsprosessen med KI/BMAD og gjennomførte kontroller.

- [Product brief](brief.md)
- [Arkitektur](.docs/planning-artifacts/architecture/architecture-studieplanlegger-2026-09-06/ARCHITECTURE-SPINE.md)
- [Løsningsguide](.docs/implementation-artifacts/solution-guide.md)
- [Krav, stories og kode-/testsporbarhet](.docs/planning-artifacts/README.md)
- [Kuratert TP CSV-formatkontrakt](.docs/implementation-artifacts/tp-csv-format-contract-2026-10-23.md)
- [Teknisk verifikasjon](studieplanlegger/VERIFICATION.md)
- [Utviklingsprosess og kvalitetssikring](.docs/implementation-artifacts/development-process.md)
- [Refleksjonsrapport – Markdown](.docs/submission/reflection-report.md)
