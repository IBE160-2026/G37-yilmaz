# Tekstregistrering og auditstatus

## 2026-11-04 kl. 20:37 — Codex

### Oppgave

Rette bortfall av klokkeslett og utdaterte sammendrag i tekstregistreringen, avklare de dokumenterte historikkfunnene og rette GitHub About dersom rettighetene tillater det. Brukeren godkjente egen branch, commit, push, PR, kontrollert merge og publisering gjennom eksisterende Vercel-prosjekt `ajour`.

### Plan

- Leste AGENTS, prosjektinstruksjoner, tilbakemeldingen fra 2026-10-06 og den identifiserte sensorveiledningen. Arbeidet følger tilbakemeldingens krav om etterprøvbar feilretting, testbevis og personvern; det utvider ikke v1.
- Hentet origin/main og bekreftet at siste kode fortsatt var `43e5cd33d8c374d1161c0d43a0139f25af13cd30`. Begge kodefeilene var til stede. Brukte separat worktree og bevarte opprinnelig arbeidsmappe.
- Reproduserte feilene, rettet avgrenset, fikk uavhengig gjennomgang og kjørte enhets-, nettleser-, lagrings- og publiseringskontroller. Historikkfunn ble kontrollert uten bruk av tilgangsmateriale.

### Resultat

Kodecommit: `470968c1b726bb1db630e0fb0d9f92192048fb6d`. [PR #27](https://github.com/IBE160-2026/G37-yilmaz/pull/27) inneholder endringene. Dette er publiseringskandidatens sesjonslogg; eksakt kontrollert PR-head, GitHub-resultater, faktisk preview, merge-/produksjonscommit og sluttkontroll av produksjon føres i PR-beskrivelsen etter kontrollene. Appens hovedadresse er [Ajour](https://ajour-sooty.vercel.app/).

- `text-registration.js` normaliserer gyldig H:mm til HH:mm, beholder manglende tid som ukjent og avviser ugyldige intervaller. Felles validering brukes av sammendrag og lagring i `main.js`.
- `text-registration-view.js` oppdaterer tittel, arbeidsmengde, emne, dato, tid og type fra redigerte verdier. Ugyldige/uavklarte felt merkes. Tidsfelt som nettleseren tømmer ved ugyldig input beholder avvisningen til eksplisitt retting eller sletting. Native nettleserforskjeller for sekunder håndteres med samme minuttpresisjon som sammendraget. Design og annen produktfunksjonalitet er ikke endret.
- Før retting feilet 9 av de første 11 nettleserregresjonene mot baseline; parser-/sammendragsregresjonene viste også feil. Senere gjennomgang avdekket eksplisitt sletting av avvist klokke, endret emnekontekst og WebKits sekundaksept; disse ble reprodusert før sine rettinger.
- Endelig lokalt resultat: **2698/2698 enhetstester**, **42/42 målrettede nettleserprøver** (14 i hver av Chromium, Firefox og WebKit), produksjonsbygg og `npm audit --audit-level=high` bestod. Én mellomkjøring traff uendret femsekundersgrense i eksisterende mengdetest under parallell nettleserlast; hele enhetssuiten bestod alene med samme grense. Ingen test eller sikkerhetskontroll ble deaktivert.
- Den eksisterende bygde nettlesersuiten bestod 181 tester før de siste gjennomgangsrettingene; endelig full suite kjøres av PR-ens uendrede kvalitetsløp. 14 isolerte SQLite-prøver og 4 ordinære Firefox/WebKit-prøver bestod lokalt. Målrettede sluttprøver bruker faktisk lagring, bekreftelse og omlasting, fast dato 2026-11-04 og bare syntetiske data i egne nettleserkontekster.
- Før publisering bestod egen syntetisk produksjonsprofil prosessavslutning, ny oppstart og sikkerhetskopigjenoppretting på baseline. Samme isolerte profil brukes ved kontroll etter publisering; ingen reelle brukerdata berøres.
- Før kodecommit: 852 tekstfiler og 11 utfoldede ICS-filer bestod avgrenset personvernkontroll; 269 HTML/JSON-fixtures og én PDF hadde ingen treff i de undersøkte kategoriene. 55 Markdown-filer, 949 lokale lenker og 243 ankerreferanser bestod. Staget diff bestod whitespacekontroll. Nye logglenker kontrolleres separat før loggcommit.
- [Eksisterende audit](../.docs/implementation-artifacts/submission-audit-2026-11-01.md): alle **12 dokumenterte historiske eksempelblobs er fortsatt ref-tilgjengelige**. Dagens tilsvarende filer har andre blobs, men dette beviser ikke ren historikk. Ingen tilgangslenker ble brukt, og gyldighet/tilbakekalling er ikke bekreftet. Serverobjekter, forks og cacher er ikke fullstendig undersøkt.
- About: README bekrefter hovedadressen. Forsøk på å endre bare `homepage` ble avvist med HTTP 404; kontoen har `push`, men ikke `admin`/`maintain`. Ingen Vercel-domener eller brukerdata er endret.

### Åpne punkter

- Historisk eksponering står åpen i [issues](issues.md). Eventuell historikkomskriving/force-push krever særskilt godkjenning. Tilbakekalling må avklares med rette tjenesteeier; ingen andres tilgang er tilbakekalt.
- Administrator må åpne repoets **About → tannhjul → Website**, sette `https://ajour-sooty.vercel.app/` og lagre. Rettighetsblokkeringen står i [issues](issues.md).

Andre eksisterende begrensninger observert under gjennomgangen, uten retting utenfor oppdraget: årvelgeren følger det opprinnelige forslaget selv etter manuelt skrevet år; eksplisitt tekst med sekunder kan falle tilbake til oppgavetekst; aktivitetens datofelt er dato, mens klokkeslett må stå i egne tidsfelt. Disse er ikke innført av rettingen. Eksisterende aria-live-omfang og byggvarsel om stor JavaScript-bunt er beholdt.
