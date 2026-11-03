# Avklaringssteg og lokal forespørselsvalidering

## 2026-11-03 kl. 19:29 — Codex (ChatGPT Work)

### Oppgave

Rette de fire konkrete funnene fra gjennomgangen av `f6a42e2de420812b0ed43c5e75223df844f11f4c`, samordne brief, PRD og berørt dokumentasjon og føre arbeidet gjennom tester og publisering. Ingen nye produktkrav eller personlige brukerobservasjoner skulle konstrueres.

### Plan

- Gjenskape den feilaktige ventemarkeringen og lokal serveravslutning med isolerte syntetiske data.
- Samle avklaringsregelen for eksisterende fullføringsveier og teste negative tilfeller, historikk og Angre.
- Avvise ugyldige forespørselsadresser ved servergrensene uten å svekke eksisterende adresse-/kildevern.
- Samordne produkttekst, [teknisk rapport](../.docs/implementation-artifacts/completion-and-local-request-validation-2026-11-03.md), [sporbarhet](../.docs/planning-artifacts/TRACEABILITY.md) og [verifikasjon](../studieplanlegger/VERIFICATION.md#avklaringssteg-og-lokal-forespørselsvalidering--2026-11-03), og kontrollere publiseringen separat.

### Resultat

Kode og dokumentasjon er samlet i commit `f959e28f7ed0b441ea87a62a67f79fe3c9376f20`. GitHub-treet er identisk med det lokalt kontrollerte staged-treet. Dette kontrollpunktet ligger før PR-integrering og produksjonspublisering.

`saveWorkSteps` opphever venting ved en ny fullføring av samme eksisterende, uttrykkelig merkede avklaringssteg. Start, direkte fullføring og steglistens lagring bruker samme regel. Vanlige endringer, historiske fullføringer, gjenåpning og avbrutte utkast opphever ikke venting. Arbeidsanslag, øvrige forutsetninger, historiske oppgavekopier og separate leveringshandlinger beholdes.

Lokal tilstands- og importbehandling avviser ugyldig forespørselsadresse med HTTP 400 før sidevirkninger. Nye prøver med ekte, isolerte HTTP-lyttere kontrollerer normal drift etter avvisningen og bevarer lokale og publiserte kildevern. README skiller oppgave- og stegutfall, og importveiledningen skiller lokal lenkehenting fra nettutgavens gjenkjente kilder og ICS-filalternativ.

Faktisk lokal kontroll: **2664/2664 enhetstester i 151 filer**, **141/141 undervisningsfixturer**, produksjonsbygg og staged diff-kontroll bestod. Hovedbundle er **961,20 kB / 293,91 kB gzip**; eksisterende størrelsesvarsel består. Uavhengig dokumentkontroll av 50 Markdown-filer fant **858 relative lenker og 224 fragmentreferanser**, uten manglende mål. Tallene gjelder dokumentkontrollen før denne loggen ble lagt til.

To nye nettleserregresjoner er skrevet og statisk gjennomgått. De kunne ikke kjøres lokalt: Chromium manglet, og nedlastingen ga ugyldig arkiv. Dette er en verktøybegrensning og ikke et bestått UI-resultat. GitHub-kontroller skal bekrefte nettleser- og SQLite-nettleserprøvene før integrering. Sensor-PDF var ikke tilgjengelig i denne runden; lærerfeedback er lest. Personlig refleksjon og lærerfeedback er uendret.

### Åpne punkter

- Faktisk nettleserkontroll av de nye fullføringsveiene, avbrudd og Angre gjenstår ved dette kontrollpunktet; se [issues](issues.md). Tidligere daterte resultater og eierens R-07-grenser beholdes.

## 2026-11-03 kl. 19:54 — Codex (ChatGPT Work), publiseringsoppfølging

### Resultat

Det tidligere kontrollpunktet ovenfor er fulgt opp. Kandidat `a01391e0ee9df1aaf3626fa8d5aba5540f5c94a8` i [PR #21](https://github.com/IBE160-2026/G37-yilmaz/pull/21) bestod [GitHub-kvalitet](https://github.com/IBE160-2026/G37-yilmaz/actions/runs/41694420525): **2664 enhetstester, produksjonsbygg, 155 faktiske Chromium-prøver og 14 SQLite-/nettleserprøver**. De to nye nettleserregresjonene inngikk. Lokal manglende Chromium er dermed fulgt opp med faktisk CI-kjøring, uten å omskrive den lokale historikken.

[Forhåndsvisningens kontroll](https://github.com/IBE160-2026/G37-yilmaz/actions/runs/41695410618) bestod med **60 runtimeprøver og seks faktiske kildeprøver**. PR #21 ble deretter integrert som **`a58a93d0c65d0fc68bcda9a999ff0018bdbcb393`**. [Main-kvalitet](https://github.com/IBE160-2026/G37-yilmaz/actions/runs/41696509142) bestod samme 2664/155/14, og eksisterende Vercel-prosjekt `ajour` rapporterte vellykket produksjonspublisering.

[Produksjonsdeployens kontroll](https://github.com/IBE160-2026/G37-yilmaz/actions/runs/41697481789) kjørte kl. **19:50:11–19:53:58 Europe/Oslo**, mot den eksakte deployen med samme SHA: **60/60 runtimeprøver og 6/6 faktiske kildeprøver bestod**. Den offentlige [versjonsmarkøren](https://ajour-sooty.vercel.app/release.json) viste samme main-SHA kl. **19:50:10**. JavaScript `index-DVKPiKe7.js` (961 202 byte) og CSS `index-9d3E6xgs.css` (99 759 byte), hentet fra produksjonsadressen, var byteidentiske med det lokalt kontrollerte bygget. Rapporten skiller den eksakte deploytesten fra denne kontrollen av den offentlige adressen.

En separat isolert lokal app-prosess svarte **HTTP 400** på ugyldig forespørselsadresse, deretter **HTTP 200** fra helsesjekken, med databaserevisjonen bevart og prosessen fortsatt kjørende. Før rettingen avsluttet den tilsvarende isolerte prosessen med kode 1.

### Dokumentasjon og avgrensning

Rapporten, VERIFICATION og issues er fulgt opp med disse faktiske resultatene. Dokumentasjonsoppfølgingen publiseres separat fra funksjonsrettingen; SHA-en ovenfor identifiserer den prøvde funksjonscommiten og er ikke en påstand om at ingen senere dokumentasjonscommiter finnes. Senere publiseringer kan etterprøves i GitHub-kjøringene og `/release.json`.

Sluttkontroll av dokumentasjonen omfattet 51 Markdown-filer, 866 relative lenker og 228 fragmentreferanser, uten manglende lokale mål eller ankere. Ingen personlige lokalstier ble funnet. Whitespace-kontrollen bestod. Eksterne URL-er er ikke medregnet i den lokale lenkekontrollen; GitHub-kjøringene og produksjonsadressen ovenfor ble hentet separat.

De fire konkrete funnene er lukket innen kontrollert omfang. Ingen nødvendig kontroll av disse rettingene står blokkert. Eksisterende bundlevarsel og øvrige dokumenterte begrensninger består. Personlig refleksjon, lærerfeedback og prosjekteierens R-07-attribusjon er uendret; dette er teknisk kontroll, ikke nye personlige prøveobservasjoner.
