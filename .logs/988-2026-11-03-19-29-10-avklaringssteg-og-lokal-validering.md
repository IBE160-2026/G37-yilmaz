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
