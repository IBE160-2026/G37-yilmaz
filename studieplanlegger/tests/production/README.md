<a id="sequential-production-acceptance"></a>

# Sekvensiell akseptkontroll av lokal Node-/SQLite-drift

Denne kontrollen gjelder den bygde appen på en lokal Node-server med SQLite, eventuelt i en isolert Docker-container. Den kontrollerer ikke nettutgavens `localStorage` eller hvilken commit Vercel har publisert. [Vercel-kontroll og publiseringsbevis](../../README.md#nettleserdrift-med-vercel--2026-10-29) har egne oppskrifter.

## Kjør med midlertidig SQLite-database

Du trenger **Node.js 24** og Playwrights Chromium. Fra repository-roten, i PowerShell:

```powershell
cd studieplanlegger
npm.cmd ci
npx.cmd --no-install playwright install chromium
npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Bygget feilet.' }
$env:STUDIEPLAN_SEED = 'false'
Remove-Item Env:STUDIEPLAN_SEED_JSON -ErrorAction SilentlyContinue
node tests/run-production-acceptance.mjs
```

På andre systemer brukes `npm`/`npx` og miljøvariabelsyntaksen til det aktuelle skallet. Linux kan trenge `npx playwright install --with-deps chromium`; se [forutsetninger og tester](../../README.md#tester-og-bygg).

Testkjøreren oppretter en midlertidig SQLite-database og velger en ledig loopback-port. Den kjører registrering og import i én nettleserprosess, starter sin egen server på nytt med samme database, prøver en ny nettleserkontekst og sikkerhetskopi/gjenoppretting i brukergrensesnittet, stopper serveren og åpner SQLite bare for lesing for å kontrollere integritet og fremmednøkler. Kjøreren beholder mappen med syntetiske testbevis og skriver ut plasseringen. Den bruker eksisterende `dist`, bygger ikke på nytt og starter eller endrer ingen Docker-container.

Faktisk offentlig NTNU-import av **EXPH0100 høsten 2026** er et uttrykkelig tilvalg. Sett variabelen før samme kjøring:

```powershell
$env:RUN_LIVE_TEACHING = '1'
node tests/run-production-acceptance.mjs
Remove-Item Env:RUN_LIVE_TEACHING
```

Uten tilvalget hoppes importscenarioet over, og det skal ikke rapporteres som bestått. Dette er en teknisk kildeprøve, ikke prosjekteierens manuelle egenutprøving.

## Kjør mot en egen isolert Node-server eller Docker-container

Bygg og start først serveren du eier for prøven. Sett disse miljøvariablene i PowerShell med `$env:NAVN = 'verdi'`:

| Variabel | Betydning |
| --- | --- |
| `STUDIEPLAN_ACCEPTANCE_PORT` | Den uttrykkelig eide loopback-porten, aldri port 80. |
| `STUDIEPLAN_ACCEPTANCE_PHASE` | Først `create` mot tom syntetisk tilstand, deretter `restore` etter gjenskaping med samme database/volum. |
| `STUDIEPLAN_ACCEPTANCE_SNAPSHOT` | Absolutt filsti til hele API-tilstanden og revisjonen, delt mellom begge faser. |
| `STUDIEPLAN_ACCEPTANCE_OUTPUT` | En egen ignorert resultatmappe for hver sekvensielle kjøring. |
| `RUN_LIVE_TEACHING` | Verdien `1` velger faktisk offentlig kildeimport i `create`-fasen. |

Kjør fra `studieplanlegger/` for hver fase:

```powershell
node node_modules/@playwright/test/cli.js test --config=tests/playwright.production.config.js tests/production/acceptance.spec.js
```

Den som kjører prøven, har ansvar for Docker-gjenskaping, opphav til image/bygg, helsesjekk, identifisering av kjørende versjon, vern av volumet, SQLite-kontroll bare for lesing og opprydding av egne testcontainere. Bruk bare syntetiske data og egne testressurser. Ikke kjør en annen nettlesersuite samtidig.

Med faktisk import valgt er det én forventet utelatelse i `create` og tre i `restore`, fordi scenariene tilhører ulike faser. Samlet utføres alle fire. Uten faktisk import blir også det scenarioet utelatt i `create`. Omplanleggingsscenarioet bruker et uttrykkelig anslag, undersøker forhåndsvisningen uten å lagre, flytter en overlappende reservasjon, godtar planen og kontrollerer lagrede tidsintervaller. Importscenarioet bruker den lagrede kildens **Oppdater nå**, fanger opp kalenderforespørselen fra den lokale serveren og kontrollerer feilet forsøk separat fra bevart siste suksess, hendelser og aktivitetsvalg.

Gjenskaping sammenligner hele API-tilstanden og revisjonen nøyaktig. Sikkerhetskopien bevarer ID-er, relasjoner, typer og tider for oppgaver, økter og hendelser, mens kalenderlenker bevisst kobles fra etter produktets personvernkontrakt. Gjenoppretting skal samsvare nøyaktig med den nedlastede portable tilstanden og øke revisjonen med nøyaktig to etter den mellomliggende UI-endringen. Skjermbilder viser kalenderinnhold på desktop og mobil, med et ekstra mobilbilde av de nedre radene etter intern rulling. Åpne bildene før du rapporterer visuell kontroll.

## Avgrenset syntetisk arbeidsflyt

Den separate `bounded-workflow.spec.js` er helt syntetisk. Velg den før du bruker kjøreren:

```powershell
$env:STUDIEPLAN_ACCEPTANCE_TEST_FILE = 'tests/production/bounded-workflow.spec.js'
node tests/run-production-acceptance.mjs
Remove-Item Env:STUDIEPLAN_ACCEPTANCE_TEST_FILE
```

For en egen Docker-container brukes samme fil i stedet for `acceptance.spec.js` i Playwright-kommandoen ovenfor. Flyten prøver blandede eldre arbeidssteg, sletting som ivaretar avhengigheter, fullføring og angre, tømming av dato ved gjenbruk av tema, bevarte uavhengige/historiske øktkoblinger, parserkontrollerte tematitler og forklaringer på utelatte frister. De to fasene kjører ett opprettingsscenario og ett gjenopprettingsscenario, med én fasebestemt utelatelse hver.

Hele den endrede tilstanden, stegfullføring, egenvurderinger, historikk og arbeidsloggens øyeblikksbilder skal overleve gjenåpning/gjenskaping av SQLite, ny nettleserkontekst, sikkerhetskopi/gjenoppretting og recovery. Kalenderens eksportdialog lagres som bilder i desktopbredde og ved 390 piksler med forstørret tekst, utenfor Git i den valgte resultatmappen.
