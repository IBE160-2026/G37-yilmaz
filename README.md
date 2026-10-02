# G37 — Git Happens

Gruppeprosjekt i **IBE160 Programmering med KI** ved Høgskolen i Molde, høsten 2026 (15 studiepoeng).

Repoet inneholder Studieplan, en lokal studieplanlegger, samt dokumentasjon av utvikling, testing og kvalitetssikring med KI.

## Medlemmer

- Elias Hemsett Yilmaz

## Dette inneholder dagens versjon

Studieplan samler studieprogram, emner og tilgjengelig offentlig undervisning i én kontrollert importflyt. Publiserte alternativgrener beholdes som valg i stedet for å bli gjort obligatoriske; HiMolde-eksempelet krever IBE110 og IBE430 samt enten IBE160 eller kombinasjonen IBE102 og IBE152. Undervisning behandles per emne, med presis status for blant annet tomt resultat, timeout, transportfeil, ugyldig svar, tilgangskrav og manglende støtte. Tidligere lagrede aktiviteter og studentvalg beholdes ved kildefeil.

Planleggingen støtter gjenbrukbare studietidsmønstre, usikre arbeidsanslag, daglig veiledning og studentgodkjent omplanlegging. Import- og kalendergrensesnittet bevarer relevante åpne seksjoner, rulleposisjon og fokus, viser læresteder, programmer og emner alfabetisk etter norsk navn, og viser stabile emnefarger sammen med tydelige emnekoder. Kalenderens topp har en eksporthandling som lager en lokal `.ics`-kopi; frister blir kompatible, transparente kalenderhendelser uten oppdiktet varighet. Implementert kildekode og avgrensede kontroller er ikke det samme som full nasjonal kilde- eller programdekning; se [importdekningen](studieplanlegger/IMPORT-COVERAGE.md).

Sluttkontrollen **2. oktober 2026** verifiserte den samlede lokale koden i et isolert Docker-prosjekt. Arbeidssteg, vurderingskoblinger, kalenderkopi, programrekkefølge, registrering, planlegging, gjenskaping, backup/restore og SQLite-integritet bestod. **1378 enhetstester, 40 berørte nettleserforløp, 3 ordinære Node/SQLite-forløp og 2 nye syntetiske livssyklusforløp** avsluttet normalt; undervisningskontraktene inngår i enhetssuiten og har dessuten daterte, separate kontroller. Konkrete reviewrettelser og åpne begrensninger står i [VERIFICATION.md](studieplanlegger/VERIFICATION.md); nasjonal full dekning er fortsatt uoppfylt.

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
npm run verify:teaching
npm run build
npm run test:e2e:database
```

`npx playwright install chromium` kreves før både `npm run test:e2e` og `npm run test:e2e:database`. `verify:teaching` er den repeterbare, lokale kontrollen av versjonerte undervisningsfixturer; den gjør ikke eksterne kildeoppslag. Databasekommandoen bygger appen, velger en ledig loopback-port og kjører den målrettede produksjonsflyten mot en midlertidig Node/SQLite-database; den trenger ikke Docker eller en eksisterende server. Den vanlige Vite-baserte nettlesersuiten kan kjøres separat med `npm run test:e2e` og bruker `localStorage`, ikke SQLite. Testene bruker syntetiske studentdata; kildeadaptrene testes også mot versjonerte fixturer fra offentlige kilder.

På en ren Linux-maskin kan Playwrights systembiblioteker også mangle. Bruk da `npx playwright install --with-deps chromium` med nødvendige lokale administratorrettigheter i stedet for den vanlige installasjonskommandoen.

## Arkitektur og dokumentasjon

Løsningen består av en Vite-klient i vanlig JavaScript, et lokalt Node-API og SQLite. Produksjons-/Docker-modusen bruker SQLite som autoritativ lagring. Klienten sender komplette, validerte tilstandsendringer med forventet revisjon; serveren skriver dem transaksjonelt. Compose binder vertsporten til `127.0.0.1` og beholder databasen i volumet `studieplan-data`.

Dokumentasjonen nedenfor beskriver løsningen, utviklingsprosessen med KI/BMAD og gjennomførte kontroller.

- [Product brief](brief.md)
- [Arkitektur](.docs/planning-artifacts/architecture/architecture-studieplanlegger-2026-09-06/ARCHITECTURE-SPINE.md)
- [Løsningsguide](.docs/implementation-artifacts/solution-guide.md)
- [Fullstack-, database- og Docker-spesifikasjon](.docs/implementation-artifacts/spec-fullstack-database-docker-delivery.md)
- [Teknisk verifikasjon](studieplanlegger/VERIFICATION.md)
- [Utviklingsprosess og kvalitetssikring](.docs/implementation-artifacts/development-process.md)
