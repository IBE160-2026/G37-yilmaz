# Ajour — G37 «Git Happens»

**[Åpne Ajour på nett](https://ajour-sooty.vercel.app/) — Ingen installasjon nødvendig.**

Ajour hjelper deg å gjøre oppgaver og tilgjengelig tid om til en plan, registrere hva du faktisk fikk gjort og justere resten. Du godkjenner import og planendringer selv. Appen bruker faste, forklarbare regler og krever ingen konto.

Gruppeprosjekt i **IBE160 Programmering med KI** ved Høgskolen i Molde, høsten 2026 (15 studiepoeng). **Gruppe G37 — Git Happens. Medlem: Elias Hemsett Yilmaz.** Repoet inneholder appen og dokumentasjon av utvikling, testing og kvalitetssikring med KI. Appmappen heter `studieplanlegger`.

## Kom i gang

1. Åpne [nettutgaven](https://ajour-sooty.vercel.app/) og legg til en oppgave. Bare tittelen er obligatorisk; emne, frist, tidsanslag og arbeidssteg er valgfrie.
2. Registrer ledig studietid og opptatte perioder. Kontroller forslaget før du godkjenner en studieøkt.
3. Etter arbeidet registrerer du faktisk tid og gjenstående anslag hver for seg. Godkjenn eventuelle justeringer av planen; en godkjent omplanlegging kan angres.

Hovedflyten er **oppgave → valgfritt arbeidssteg → godkjent studieøkt → utfall → justering**. Fullført steg, ferdig oppgave og bekreftet innlevering er separate handlinger. Du kan registrere alt manuelt; import er valgfritt. [Brukerveiledningen](studieplanlegger/README.md#kom-i-gang-og-finn-frem) forklarer skjermbildene, import, kalenderkopi og temaene **System/Lyst/Mørkt**.

**Oppgave eller arbeidssteg:** Planforslag reserverer tid til oppgaven. Når **Start** viser et bestemt arbeidssteg, følger dette steget med til arbeidsutfallet. Gjenstående arbeid gjelder fortsatt hele oppgaven. [Avklaring, retting og teknisk nettleserprøve 2. november](.docs/implementation-artifacts/work-step-identity-2026-11-02.md) skiller disse flytene og dokumenterer testomfanget.

Et fullført avklaringssteg som er merket for å oppheve venting, åpner for videre arbeid når øvrige forutsetninger er oppfylt. [Oppfølgingen 3. november](.docs/implementation-artifacts/completion-and-local-request-validation-2026-11-03.md) dokumenterer denne rettingen og kontroll av lokal server og veiledning.

<a id="nettleserutgave--2026-10-29"></a>

## Ta vare på planen

Nettutgaven lagrer planen i den aktuelle nettleserprofilen på den nøyaktige nettadressen. En annen profil, enhet, localhost eller Vercel-forhåndsvisning har egne data. **Sletting av nettleserdata kan slette planen.** Det finnes ingen konto eller automatisk synkronisering mellom enheter.

Den faste hovedadressen er **[ajour-sooty.vercel.app](https://ajour-sooty.vercel.app/)**. Bruk denne også i bokmerker og prosjektlenker. Har du allerede data på en annen adresse, eksporter en sikkerhetskopi der før du flytter planen; adressene deler ikke lagring.

Åpne **Innstillinger → Data og sikkerhetskopi** (på mobil under **Mer**) for å eksportere en lokal JSON-fil. Oppbevar kopien trygt, og bruk forhåndsvist gjenoppretting når du vil flytte planen. Gjenoppretting erstatter data etter uttrykkelig bekreftelse. Kalenderlenker kan kreve ny tilkobling fordi tilgangsopplysninger utelates. Kalenderens `.ics`-eksport er en kalenderkopi, ikke en full sikkerhetskopi. [Lagring og sikkerhetskopi](studieplanlegger/README.md#lagring-og-sikkerhetskopi) beskriver forskjellene mellom nettutgaven og lokal drift.

<a id="arkitektur-og-dokumentasjon"></a>

## Finn dokumentasjonen

| Du vil … | Les her |
| --- | --- |
| Bruke Ajour | [Brukerveiledning](studieplanlegger/README.md#kom-i-gang-og-finn-frem) og [slik virker løsningen](.docs/implementation-artifacts/solution-guide.md). |
| Importere eller forstå kildegrenser | [Importavtale](studieplanlegger/IMPORT.md), [importdekning](studieplanlegger/IMPORT-COVERAGE.md) og [TP CSV-formatkontrakt](.docs/implementation-artifacts/tp-csv-format-contract-2026-10-23.md). |
| Se mål, krav og sporbarhet | [Brief](brief.md), [planindeks med PRD og stories](.docs/planning-artifacts/README.md) og [arkitektur](.docs/planning-artifacts/architecture/architecture-studieplanlegger-2026-09-06/ARCHITECTURE-SPINE.md). |
| Kontrollere tester og kjente begrensninger | [Daterte verifikasjonsresultater](studieplanlegger/VERIFICATION.md), [samlet begrensningsoversikt](studieplanlegger/README.md#kjente-begrensninger-ved-levering) og [åpne punkter](.logs/issues.md). |
| Vurdere prosess og KI-bruk | [Utviklingsprosess og kvalitetssikring](.docs/implementation-artifacts/development-process.md). |
| Lese refleksjonsrapporten | [Refleksjonsrapport — Markdown](.docs/submission/reflection-report.md), med prosjekteierens erfaringer og oppgitt KI-hjelp til struktur og formulering. |
| Kjøre eller utvikle lokalt | [Lokale alternativer og oppskrifter](studieplanlegger/README.md#lokal-drift-og-utvikling) og [tester og bygg](studieplanlegger/README.md#tester-og-bygg). |

<a id="dette-inneholder-dagens-versjon"></a>

## Avgrenset første versjon

V1-import gjelder **HiMolde IT 2026–27** med IBE110/IBE430 og enten IBE160 eller IBE102 + IBE152; undervisningsprøvene gjelder bare IBE110/IBE430/IBE160 høsten 2026. **NTNU** omfatter emnemetadata og emnelenket undervisning for ARK1001/EXPH0100 høsten 2026, uten løfte om et komplett program. Full nasjonal dekning er visjon. Det loves ikke full eksamensdekning eller personlig gruppetilhørighet.

Avgrensningen og [rekonstruerte planer fra 16. oktober](.docs/planning-artifacts/README.md) følger opp [faglærerens tilbakemelding](tilbakemelding-product-brief.md). Eksisterende adaptere og funksjoner er beholdt, men utvider ikke leveranseløftet. [Verifikasjonen](studieplanlegger/VERIFICATION.md) bevarer datoene for tidligere rettinger, Ajour-utformingen og nettutgaven som ble godkjent 29. oktober. Teknisk testing dokumenterer ikke generell studentnytte.

<a id="leveringsoversikt--1-november-2026"></a>

## Leveringsoversikt — 4. november 2026

**Teknisk oppfølging av ny audit:** [Importrekkefølge og kvalitetskontroller](.docs/implementation-artifacts/import-sequencing-audit-2026-11-04.md) samler de to bekreftede feilene ved overlappende filvalg, retting med regresjonstester, avhengighetskontroll og avgrenset sikkerhets-/nettleseroppfølging. Rapporten angir faktisk test- og publiseringsstatus; tidligere grønne tester alene lukker ikke de nye funnene.

**Prosjekteierens sju scenarier og tilleggsprøven for navngitt Start er bestått 3.–4. november.** [Prøverapporten](.docs/implementation-artifacts/owner-trial-2026-11-04.md) dokumenterer syntetiske data, faktisk gjennomføring, rettet prøveutførelse og metodegrenser. Den inkluderer gjenoppretting i et separat, tomt Chrome Gjest-miljø og lukker det tidligere dekningsforbeholdet for SC-07/R-07. Tidligere daterte omprøvinger, SC-07/1200–30 og Outlook-prøven beholder sine resultater. [Automatiske kontroller](studieplanlegger/VERIFICATION.md) er et separat bevisgrunnlag.

**Refleksjonsrapporten foreligger bare som Markdown; personlig sluttgjennomlesing og innlevering er ikke bekreftet.** [Planindeksens leveringskontroll](.docs/planning-artifacts/README.md#leveringskontroll--2026-11-04) samler vurderingsgrunnlag og formelle restpunkter. [Begrensningsoversikten](studieplanlegger/README.md#kjente-begrensninger-ved-levering) skiller V1-grenser og historiske funn fra dagens prøver; historisk F03 og personvernoppfølging er ikke lukket av egenutprøvingen.

Eieroppfølging av historisk tilgangsmateriale og administrativ kontroll av GitHub About, grenbeskyttelse og plattformgrenser føres separat i [auditoppfølgingen](.docs/implementation-artifacts/import-sequencing-audit-2026-11-04.md). De ferdigmeldes først når den aktuelle handlingen er bekreftet, ikke som følge av en kode- eller dokumentendring.

<a id="kjør-den-komplette-lokale-leveransen"></a>
<a id="tester-og-produksjonsbygg"></a>

## Lokal kjøring og utvikling

Dette er alternativer til nettutgaven for sensor og utviklere. Vanlig bruk på nett krever ingen av disse installasjonene.

| Alternativ | Forutsetning og lagring | Oppskrift |
| --- | --- | --- |
| Docker | Docker med Compose v2; lokal Node-installasjon trengs ikke. SQLite i navngitt volum. | [Docker-oppskrift](studieplanlegger/README.md#full-stack-drift-med-docker). |
| Lokal Node-server | Node.js 24. SQLite i en valgt lokal databasefil. | [Node-oppskrift](studieplanlegger/README.md#lokal-node-server-med-sqlite). |
| Vite-utvikling | Node.js 24. `localStorage` i nettleserprofilen på utviklingsadressen. | [Vite-oppskrift](studieplanlegger/README.md#vite-utvikling-med-nettleserlagring). |

Alle lokale alternativer har manuell registrering og import. Ingen konto, betalte nøkler eller `.env` kreves for standardoppsettet. [Testoppskriftene](studieplanlegger/README.md#tester-og-bygg) skiller enhetstester, bygd nettleserapp og isolert SQLite fra Vercel-kontroll. [Vercel-drift](studieplanlegger/README.md#nettleserdrift-med-vercel--2026-10-29) beskriver det eksisterende gratisprosjektet og kontroll av publisert commit.
