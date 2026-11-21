# Ajour

**[Åpne Ajour på nett](https://ajour-sooty.vercel.app/)** uten konto eller installasjon.

Ajour er en studieplanlegger som samler oppgaver, undervisning og ledig studietid. Du får forslag til hva du kan jobbe med nå, og når du kan sette av tid til annet arbeid. Forslagene bygger på opplysningene du legger inn og faste regler. Etter en økt kan du logge tiden du brukte og justere planen.

Ajour er laget i **IBE160 Programmering med KI** (15 studiepoeng) ved Høgskolen i Molde høsten 2026. **Gruppe G37 – Git Happens. Medlem: Elias Hemsett Yilmaz.** Appkoden ligger i `studieplanlegger/`.

## Kom i gang

1. Legg til en oppgave med en tittel. Du kan legge til emne, frist, tidsanslag og arbeidssteg senere.
2. Registrer når du kan studere og når du er opptatt. Se over forslagene før du godkjenner en studieøkt.
3. Logg tiden du brukte, og anslå hvor mye arbeid som gjenstår. Du velger selv hvilke planendringer du vil godta. En godkjent omplanlegging kan angres.

Du kan legge inn alt for hånd eller importere opplysninger og se over dem før du lagrer. [Brukerveiledningen](studieplanlegger/README.md#kom-i-gang-og-finn-frem) viser hvordan du bruker appen.

Oversikt og Ukeplan tar hensyn til de samme øktlengdene og pausene når de vurderer om en oppgave rekker fristen. I tekstfeltet kan du velge år når en ny frist er tvetydig, og skrive tidsanslag som «4,1 timer». [Slik bruker du tekstfeltet](studieplanlegger/README.md#fleksibel-tekstregistrering-og-egne-aktiviteter)

<a id="nettleserutgave--2026-10-29"></a>

## Ta vare på planen

Nettutgaven lagrer planen i nettleserprofilen du bruker, på den aktuelle nettadressen. Sletting av nettleserdata kan slette planen. Planen synkroniseres ikke mellom enheter.

Åpne **Innstillinger → Data og sikkerhetskopi** (på mobil under **Mer**) for å laste ned en JSON-kopi. Bruk den når du vil gjenopprette planen eller flytte den til en annen nettleser, enhet eller adresse. Se over innholdet før du godkjenner at kopien erstatter planen. Noen kalenderlenker må kobles til på nytt. Kalenderens `.ics`-fil inneholder bare kalenderhendelser. [Lagring og sikkerhetskopi](studieplanlegger/README.md#lagring-og-sikkerhetskopi)

<a id="arkitektur-og-dokumentasjon"></a>

## Finn dokumentasjonen

| Du vil … | Les her |
| --- | --- |
| Bruke appen | [Brukerveiledning](studieplanlegger/README.md) og [slik virker løsningen](.docs/implementation-artifacts/solution-guide.md) |
| Se hva som kan importeres | [Importveiledning](studieplanlegger/IMPORT.md), [importdekning](studieplanlegger/IMPORT-COVERAGE.md) og [TPs CSV-format](.docs/implementation-artifacts/tp-csv-format-contract-2026-10-23.md) |
| Se mål, krav og designvalg | [Produktbeskrivelse](brief.md), [planleggingsdokumenter](.docs/planning-artifacts/README.md) og [arkitektur](.docs/planning-artifacts/architecture/architecture-studieplanlegger-2026-09-06/ARCHITECTURE-SPINE.md) |
| Se tester og kjente begrensninger | [Testresultater](studieplanlegger/VERIFICATION.md#fristvurdering-og-tekstregistrering-2026-11-21), [manuell utprøving](.docs/implementation-artifacts/owner-trial-2026-11-04.md), [kjente begrensninger](studieplanlegger/README.md#kjente-begrensninger) og [åpne saker](.logs/issues.md) |
| Lese om utvikling og KI-bruk | [Utviklingsprosess, KI-bruk og feilretting](.docs/implementation-artifacts/development-process.md) og [refleksjonsrapport](.docs/submission/reflection-report.md) |
| Se teknisk oppfølging | [Sluttkontroll 20. november](studieplanlegger/VERIFICATION.md#sluttkontroll-2026-11-20), [filimport og testoppfølging 4. november](.docs/implementation-artifacts/import-sequencing-audit-2026-11-04.md) og [opprydding i Git-historikken 9. november](.docs/implementation-artifacts/history-cleanup-2026-11-09.md) |

<a id="dette-inneholder-dagens-versjon"></a>

## Import i første versjon

For **HiMolde IT 2026–27** omfatter første versjon IBE110 og IBE430, med enten IBE160 eller IBE102 og IBE152. Undervisningsimporten er prøvd med IBE110, IBE430 og IBE160 høsten 2026. For **NTNU** er omfanget emneinformasjon og undervisning for ARK1001 og EXPH0100 høsten 2026. Andre kilder har ulik dekning. Se [importdekningen](studieplanlegger/IMPORT-COVERAGE.md) for hva som er testet og hvilke opplysninger du må sjekke selv.

<a id="kjør-den-komplette-lokale-leveransen"></a>
<a id="tester-og-produksjonsbygg"></a>

## Lokal kjøring og utvikling

Med Docker og Compose v2 kan du starte Ajour fra roten av repoet:

```sh
cd studieplanlegger
docker compose up --build -d
```

Åpne `http://127.0.0.1:8088`. Stopp appen med `docker compose down`. SQLite-databasen ligger i et Docker-volum og beholdes når du stopper appen.

| Alternativ | Forutsetning og lagring | Oppskrift |
| --- | --- | --- |
| Docker | Docker med Compose v2. SQLite i et navngitt volum. | [Docker-oppskrift](studieplanlegger/README.md#full-stack-drift-med-docker). |
| Lokal Node-server | Node.js 24. SQLite i en valgt lokal databasefil. | [Node-oppskrift](studieplanlegger/README.md#lokal-node-server-med-sqlite). |
| Vite-utvikling | Node.js 24. `localStorage` i nettleserprofilen på utviklingsadressen. | [Vite-oppskrift](studieplanlegger/README.md#vite-utvikling-med-nettleserlagring). |

Alle alternativene støtter manuell registrering og import. Standardoppsettet krever ingen konto, nøkler eller `.env`. Se [tester og bygg](studieplanlegger/README.md#tester-og-bygg) for testkommandoer og [Vercel-drift](studieplanlegger/README.md#nettleserdrift-med-vercel--2026-10-29) for oppsettet av nettutgaven.
