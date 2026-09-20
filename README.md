# G37 — Git Happens

Gruppeprosjekt i **IBE160 Programmering med KI** ved Høgskolen i Molde, høsten 2026 (15 studiepoeng).

Repoet inneholder Studieplan, en lokal studieplanlegger, samt dokumentasjon av utvikling, testing og kvalitetssikring med KI.

## Medlemmer

- Elias Hemsett Yilmaz

## Kjør den komplette leveransen

Du trenger Docker med Compose. Fra repository-roten:

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
npm run build
npm run test:e2e:database
```

`npx playwright install chromium` kreves før både `npm run test:e2e` og `npm run test:e2e:database`. Databasekommandoen bygger appen, velger en ledig loopback-port og kjører den målrettede produksjonsflyten mot en midlertidig Node/SQLite-database; den trenger ikke Docker eller en eksisterende server. Den vanlige Vite-baserte nettlesersuiten kan kjøres separat med `npm run test:e2e` og bruker `localStorage`, ikke SQLite. Testene bruker syntetiske studentdata; kildeadaptrene testes også mot versjonerte fixturer fra offentlige kilder.

På en ren Linux-maskin kan Playwrights systembiblioteker også mangle. Bruk da `npx playwright install --with-deps chromium` med nødvendige lokale administratorrettigheter i stedet for den vanlige installasjonskommandoen.

## Arkitektur og dokumentasjon

Løsningen består av en Vite-klient i vanlig JavaScript, et lokalt Node-API og SQLite. Produksjons-/Docker-modusen bruker SQLite som autoritativ lagring. Klienten sender komplette, validerte tilstandsendringer med forventet revisjon; serveren skriver dem transaksjonelt. Compose binder vertsporten til `127.0.0.1` og beholder databasen i volumet `studieplan-data`.

- [Product brief](brief.md)
- [Arkitektur](.docs/planning-artifacts/architecture/architecture-studieplanlegger-2026-09-06/ARCHITECTURE-SPINE.md)
- [Løsningsguide](.docs/implementation-artifacts/solution-guide.md)
- [Fullstack-, database- og Docker-spesifikasjon](.docs/implementation-artifacts/spec-fullstack-database-docker-delivery.md)
- [Teknisk verifikasjon](studieplanlegger/VERIFICATION.md)
- [Prosjektrefleksjon — utkast](.docs/implementation-artifacts/project-reflection.md)
- [Plan for faktisk utprøving](.docs/implementation-artifacts/trial-log.md)

Refleksjonen er et kildegrunnlag og **utkast**. Dokumenterte hendelser og KI-bidrag er skilt fra åpne spørsmål som studenten selv må besvare. Teknisk verifikasjon er ikke det samme som studentens egen brukserfaring eller læringsrefleksjon.

Eldre BMAD-planer, story-overleveringer og detaljerte mellomrapporter er tatt ut av gjeldende leveranse for å unngå motstridende status og duplisert dokumentasjon. De er fortsatt tilgjengelige i Git-historikken ved commit [`1a39aaf`](https://github.com/IBE160-2026/G37-yilmaz/tree/1a39aaf450c3ff4a59908fd8caba9de10230b9a6). Gjeldende dokumenter ovenfor er autoritative.
