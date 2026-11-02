# Ajour: nettinngang og dokumentasjon

## 2026-11-02 kl. 14:23 — GOplayer007

### Oppgave

Gjøre den publiserte nettutgaven til en tydelig inngang for vanlige brukere, samtidig som sensor og utviklere beholder komplette lokale oppskrifter. Oppgaven omfatter bare dokumentasjon og denne sesjonsloggen; brukeren har også autorisert commit, push, PR-integrering etter beståtte kontroller og oppfølging av eksisterende Vercel-publisering.

### Plan

- Kontrollere prosjektinstruksjoner, [lærerens tilbakemelding](../tilbakemelding-product-brief.md), [brief](../brief.md), [planindeks](../.docs/planning-artifacts/README.md) og den identifiserte sjusiders sensorveiledningen. Oppgaven følger punktene om tydelig README, kjørbarhet, avgrensning, KI-bruk og sporbar dokumentasjon; ingen nye innleveringskrav er lagt til.
- Arbeide i et separat Git-worktree fra `origin/main` på `8e800effb59b4370f93ec104dba53ca78f6f436d`, og bevare annet lokalt arbeid.
- Samordne eksisterende dokumenter, kontrollere kommandoer og lenker, gjennomføre uavhengig dokumentgjennomgang og kjøre prosjektets påkrevde kontroller.
- Bruke eksisterende PR- og Vercel-flyt for prosjektet `ajour`, og kontrollere endelig main mot produksjonens `/release.json` etter integrering.

### Resultat

Dokumentendringene er committet som `d11cca524919154230fe2b4e894629e6c6cb2963` (`docs: gjør nettutgaven til tydelig inngang for Ajour`). Denne loggen og den avgrensede oppdateringen av [åpne punkter](issues.md) inngår i en separat loggcommit.

- [Rotens README](../README.md) prioriterer nettlenken og «Ingen installasjon nødvendig», korte startsteg, sikkerhetskopi og samlet dokumentoversikt. Lokal kjøring er et tydelig alternativ med direkte oppskriftslenker.
- [Appens README](../studieplanlegger/README.md) har brukerveiledning først, norsk importveiledning og et tydelig skille mellom nettleserlagring på nett, lokal Node-/Docker-drift med SQLite og lokal Vite-utvikling. Oppskriftene angir PowerShell, arbeidsmappe, forutsetninger, stopp, databevaring, tester og teknisk Vercel-drift. Relevante gamle ankre er beholdt.
- [Løsningsguiden](../.docs/implementation-artifacts/solution-guide.md), [planindeksen](../.docs/planning-artifacts/README.md), [importbeskrivelsen](../studieplanlegger/IMPORT.md) og [produksjonstestguiden](../studieplanlegger/tests/production/README.md) følger samme driftsinndeling. SQLite-diagrammet og produksjonstestene gjelder lokal Node-/Docker-drift.
- [Verifikasjonen](../studieplanlegger/VERIFICATION.md) og åpne punkter skiller den eldre byggmålingen fra 1. november fra den nyere daterte målingen 2. november. Historiske resultater, F03-forbeholdet og dokumentasjonen av den separat rettede fristregresjonen er bevart.

Kontrollert lokalt på Node 24.19.0 / npm 11.17.0:

- `npm ci --no-audit --no-fund` bestod.
- Første fulle enhetstestkjøring hadde ett tidsavbrudd på 5000 ms under samtidig testbelastning (2603 bestått). Hele suiten ble kjørt på nytt alene med `npm run test:unit -- --maxWorkers=2`: **2604/2604 tester i 149 filer bestod**. Ingen tester eller tidsgrenser ble endret.
- `npm run build` bestod: **959,61 kB / 293,45 kB gzip**. Dette er en ny lokal kontroll 2. november; det eksisterende varselet over 500 kB består.
- `npm run verify:teaching`: **141/141 bestod**.
- `npm run test:e2e:ci`: **146/146 bestod** i faktisk Chromium mot lokalt bygd app.
- `npm run test:e2e:database`: **14/14 bestod** mot isolert lokal Node-/SQLite-drift. Prøvene brukte egne midlertidige data og porter.
- Alle 15 PowerShell-blokkene i de berørte oppskriftene bestod syntakskontroll. Kommandoer, skriptnavn og driftsforutsetninger ble kontrollert mot eksisterende kode og konfigurasjon.
- Lokal kontroll av alle versjonerte Markdown-filstier og ankre bestod. Dokumenter og fixtures ble kontrollert for sensitive verdier, private stier, metadata og genererte artefakter, med utfolding av ICS-linjer og separat kontroll av PDF-fixturemetadata. Ingen nye funn ble påvist; dette friskmelder ikke Git-historikken.
- Uavhengig dokumentgjennomgang ble fulgt opp med presise knappetekster, backupgrense, byggestopp ved feil, nullstilling av prøvevariabler og kontroll av publisert commit ved dokumenterte persistensprøver. `git diff --cached --check` bestod for dokumentcommitten og kjøres også for loggcommitten.

Lærerens tilbakemelding og refleksjonsrapportens Markdown-fil er uendret, kontrollert mot utgangspunktet. Ingen appkode, brukergrensesnitt, lagring, avhengigheter, tester eller publiseringsoppsett er endret. Dette er tekniske kontroller og dokumentgjennomgang, ikke ny manuell egenutprøving eller bekreftet skoleinnlevering.

Loggen registrerer den lokale kontrollen før push. GitHub-kontroller, PR-integrering og den etterfølgende Vercel-publiseringen følges gjennom eksisterende arbeidsflyt; endelig commit-samsvar rapporteres først når det er kontrollert.

### Åpne punkter

Ingen nye produktpunkter. Eksisterende åpne punkter i [issues.md](issues.md), blant annet historisk F03, importdekning, bundlevarsel, personlig rapportgjennomlesing, faktisk innlevering og historisk eksponering, er bevart. Dokumentasjonsryddingen lukker dem ikke.
