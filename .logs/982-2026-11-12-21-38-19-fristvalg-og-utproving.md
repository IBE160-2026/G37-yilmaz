# Fristvalg og utprøving

## 2026-11-12 kl. 21:38 — GOplayer007

### Oppgave

Prosjekteieren ba om commit og push etter gjennomgangen av frister, neste steg og en kort lokal prøve med eksempeloppgaver. De manuelle observasjonene skulle bevares med riktig omfang, og de bekreftede fristfeilene skulle følge leveransen.

### Plan

- Finn Git-repoet som arbeidsområdet faktisk bruker, og bevar nyere Ajour-funksjoner og innhentede dokumentendringer.
- Overfør de konkrete fristrettingene og prøv dagens deløktregel med oppdeling både på og av.
- Skill tidligere manuelle observasjoner fra nye automatiserte kontroller i [den daterte rapporten](../.docs/implementation-artifacts/deadline-occurrences-2026-11-12.md).
- Kontroller tester, bygg, relevante leveransefiler og Git-endringer før commit og bestilt push til `main`.

### Resultat

Kode og dokumentasjon er samlet i commit `c8db5cc98f26390cfdbcf0f89f5cf5060eb33d14`: eksplisitt første/andre forekomst ved vintertid, presise feil ved ugyldig klokkeslett og sommertidshull, og bevart utkast. Valgt forekomst brukes også i kalender, eksport, kapasitet og omplanlegging. Tekstendringer av fristen nullstiller et foreldet forekomstvalg. Datofrister, arbeidssteg med stabile ID-er og dagens deløktregel er bevart.

Gjennomgangen ble først utført i en eldre lokal kopi uten Git. Rettingene er derfor overført selektivt til dagens Ajour, og observasjonene er ikke fremstilt som ny manuell godkjenning av denne versjonen. Den korte prøven brukte eksempeloppgaver, ikke en månedslang utprøving. Tidligere R-07-evidens og V1 er uendret. Relevante punkter om testbare kriterier og kvalitet fra produktbrief-tilbakemeldingen og sensorveiledningen for del 1 er brukt som kontrollgrunnlag.

Lokale kontroller:

- **2737/2737 enhetstester** i 155 filer bestod etter retting av funn fra første kjøring.
- **191/191 Chromium-prøver** mot ferdig bygg bestod på 6,3 minutter, inkludert sju nye frist-/deløktprøver. Mobilbildet for det andre 02:30-valget ble også kontrollert.
- Produksjonsbygg bestod. Hovedbundle er 963,42 kB / 294,67 kB gzip; tidligere dokumentert størrelsesvarsel består.
- Leveransekontrollen av eksakte indeksbytes før kodecommit kontrollerte 1042 relative lenker, 257 ankere og 354 dokument-/fixturefiler, inkludert utfoldet ICS og PDF-/DOCX-metadata, uten funn. Ingen byggeartefakter i inventaret. Kontrollen dekker ikke all PDF-brødtekst, eksterne lenkemål eller renhet i historiske GitHub-kopier.
- `git diff --cached --check` bestod. Private arbeidsdokumenter og lokal råevidens ble ikke lagt til i repoet.

Siste `origin/main` ved innhenting var `392e5a1`. Den ble integrert med ordinær merge `7bb2e35`, som bevarer både nyere eksterne dokumentendringer og eksisterende lokal loggcommit `3bb4daa`. Denne loggen føres i egen commit før brukerens bestilte push. Lokal verifisering er ikke en påstand om ny produksjonsdeployment eller ferdig innlevering.

### Åpne punkter

Ingen nye produktpunkter fra rettingen. Eksisterende restpunkter i [issues.md](issues.md), inkludert formell innlevering og historiske kopier, er uendret.
