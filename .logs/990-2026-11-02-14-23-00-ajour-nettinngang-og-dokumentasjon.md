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

## 2026-11-09 kl. 21:51 — GOplayer007

### Oppgave

Gjøre eksisterende dokumentasjon enkel å finne for sensor, og supplere med en kort, delbar forklaring av den gjennomførte historikkoppryddingen. Bare dokumentfiler klargjøres i den eksisterende prosjektmappen; brukeren skal godkjenne filene før commit eller publisering.

### Plan

- Lese prosjektinstruksjoner, README, planindeks, tidligere dokumentasjonsarbeid og de private publiserings-/overgangsrapportene. Originalrapportene beholdes lokalt.
- Følge [lærerens tilbakemelding](../tilbakemelding-product-brief.md) om README/kjørbarhet, sporbar planlegging, konkrete KI-rettinger og personvern. Sensor-PDF-en var ikke tilgjengelig blant prosjektfilene ved denne kontrollen; ingen nye vurderingskrav utledes fra tidligere sammendrag.
- Gjenbruke eksisterende oppskrifter og dokumentoversikter, kontrollere lenker og kommandoer, og holde historiske tester adskilt fra denne øktens dokumentkontroller.

### Resultat

Riktig repo `IBE160-2026/G37-yilmaz` er kontrollert. Main og origin/main peker på den dokumenterte rensede commiten `05054f79d420b5d073799cd0eebf8321d8560e2f`; aktive lokale branches og origin-referanser når de 141 rensede commitene. Arbeidskopien var ren ved start. Ingen ny prosjektkopi, flytting, historikkomskriving eller endring av Git-innstillinger er gjort.

- README hadde allerede nettside, lokal oppstart, tester, daterte resultater, brief, planindeks med PRD/stories, arkitektur og utviklingsprosess. Eksisterende dokumentasjonstabell er supplert med direkte lenker til KI-bruk, konkrete feilrettinger og den nye oppryddingsoppsummeringen.
- [Én delbar oppryddingsrapport](../.docs/implementation-artifacts/history-cleanup-2026-11-09.md) er laget i eksisterende dokumentasjonsmappe. Den beskriver rensede felt, bevaring av dagens app og utviklingshistorikk, endrede commit-ID-er/signaturer, tidligere kontroller og gjenstående ansvar uten private verdier eller vedlegg.
- [Planindeksen](../.docs/planning-artifacts/README.md) og [åpne punkter](issues.md#personlig-sluttkontroll-og-historisk-eksponering) har fått daterte henvisninger. Eldre resultater og statusoppføringer er beholdt; denne sesjonsloggen viderefører det eksisterende dokumentasjonsarbeidet.
- Kontroll av dokumentasjonskjeden fra README omfattet 38 Markdown-dokumenter: relative filbaner, overskriftslenker og Git-tilgjengelighet bestod. Ny rapport er ikke ignorert; øvrige lenkemål er allerede sporet. Eksterne nettlenker er ikke kontrollert på nytt i denne økten.
- Uavhengig kontroll av 13 dokumenterte `npm run`-kommandoer og 12 kjøre-/konfigurasjonsfiler bekreftet oppskriftene mot prosjektets oppsett. Node 24, lokal Node-/Docker-/Vite-oppstart og testkommandoene stemmer; appens README trengte ingen endring. Appkode er ikke feilrettet.
- Sammenhold mot begge private rapporter og avgrenset kontroll av ny tekst fant ingen sensitive verdier, private vedlegg eller private filstier. `git diff --check` bestod. Ingen private filer er inkludert i endringsutvalget.

Ingen apptester eller produksjonsbygg er kjørt i denne dokumentasjonsøkten. Tallene i oppryddingsrapporten er tidligere dokumenterte resultater med egne CI-lenker; de fremstilles ikke som nye kjøringer. Bare dokumentfiler er endret. Appkode, avhengigheter, design, produktkrav, refleksjonsrapport, lokale innstillinger og private filer er urørt. Ingen filer er staget, committet eller pushet; brukerens uttrykkelige krav om filgodkjenning går foran sesjonslogg-rutinens vanlige commit-steg. Påkrevde kontroller før staging/publisering hører til det senere godkjente branch-/PR-løpet.

### Åpne punkter

Ingen nye produktpunkter. Eksisterende oppfølging av gamle GitHub-/PR-kopier, tjenesteeiernes vurdering av tilganger og administratorens About-lenke er fortsatt åpen i [issues.md](issues.md#personlig-sluttkontroll-og-historisk-eksponering). Denne dokumentasjonsøkten lukker ingen av disse punktene.

## 2026-11-09 kl. 22:55 — GOplayer007

### Oppgave

Publisere de fem dokumentfilene etter brukerens uttrykkelige godkjenning, gjennom egen branch og PR med beståtte kvalitetskontroller. Den opprinnelige prosjektmappen og alt annet lokalt arbeid beholdes.

### Plan

- Kontrollere siste GitHub-main, endelig diff og de fem godkjente filene; bruke branchen `docs/sensor-documentation-20261109` i eksisterende mappe.
- Gjennomføre påkrevde kontroller før staging, deretter avgrenset commit, push og PR. Merge er autorisert først etter beståtte eksisterende kvalitetskontroller.
- Etter merge: oppdatere lokal main uten overskriving og kontrollere de fem dokumentene, README-lenkene og GitHub-visningen. Ingen force-push eller endring av Vercel-oppsett.

### Resultat

Dette er den daterte lokale førkontrollen for publiseringen. GitHub-main ble kontrollert til `05054f79d420b5d073799cd0eebf8321d8560e2f`. Diffen omfatter bare README, planindeksen, den delbare oppryddingsrapporten, åpne punkter og denne eksisterende sesjonsloggen.

- **145/145 fokuserte tester** og **2698/2698 enhetstester i 152 filer** bestod med uendrede tester, to arbeidere og deaktivert testcache. Første PowerShell-innpakning stoppet på et npm-varsel etter beståtte fokuserte tester; uendret omkjøring med kontrollert prosessretur bestod med exit 0.
- **Produksjonsbygg bestod**, med 21 utdatafiler og det eksisterende varselet over 500 kB. Byggeutdata ble lagt separat slik at eksisterende lokale byggefiler ble bevart.
- Lokal kontroll brukte eksisterende installasjon med Vitest 5.0.3 og Vite 8.2.4. Ingen avhengigheter ble reinstallert eller endret lokalt. PR-kontrollen installerer prosjektets låste avhengigheter og er et separat krav før merge.
- README-kjeden og denne loggen omfattet ved kontrollen **38 Markdown-dokumenter og 951 relative lenker**, uten manglende filer/ankere. Alle mål er sporet eller den godkjente nye rapporten. Oppstarts- og testoppskriftene stemmer med prosjektoppsettet.
- Personvernkontrollen omfattet 410 dokument-/fixturefiler, 387 tekstfiler og strukturell kontroll av 269 JSON/HTML-fixturer. Alle 11 ICS ble kontrollert etter utfolding av 1191 linjefortsettelser. Tilgangsparameterne som ble funnet er dokumenterte syntetiske testverdier; ingen publiseringsblokkering ble funnet.
- PDF-egenskaper og DOCX-metadata ble undersøkt særskilt uten funn av personmetadata. PDF-en er identisk med renset baseline og beholder sine tre tidligere strukturvarsler. De fem dokumentene inneholder ingen private stier, private vedlegg eller sensitive tilgangsverdier.

Tidligere tester og førkontrollen ovenfor er separate resultater. CI-, merge- og GitHub-visningsstatus bekreftes gjennom den tilhørende PR-en og etterkontrollen; de ferdigmeldes ikke i denne oppføringen før push. Lærerfeedback om README/kjørbarhet, sporbarhet og personvern følges uten endring av produktkrav, appkode eller refleksjonsrapport.

### Åpne punkter

Ingen nye produktpunkter. Eksisterende eier-/administratoroppfølging i [issues.md](issues.md#personlig-sluttkontroll-og-historisk-eksponering) er uendret; publisering av dokumentasjon lukker ikke disse punktene.
