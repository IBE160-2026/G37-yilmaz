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

## 2026-11-13 kl. 01:27 — GOplayer007

### Oppgave

Prosjekteieren ba om oppfølging av A1–A7 fra Epic 4-retrospektiven, deretter gjennomgang og uttrykkelig commit og push. Denne fortsettelsen publiserer de ferdige rettelsene fra den eldre lokale arbeidskopien til dagens Ajour.

### Plan

- Bruk det rene målrepoet på `main`, med førgrunnlag `434b14828deae1db0bacfad58d27429ce56c81ad`, og overfør rettelsene selektivt.
- Bevar nyere dato-frister, personlige aktiviteter, arbeidssteg og dagens deløktregler.
- Samle før-/ettertilstand, avgrensninger og faktiske prøver i [A1–A7-rapporten](../.docs/implementation-artifacts/epic-4-followup-2026-11-13.md), og kontroller publiserbare filer før commit og bestilt push.

### Resultat

Arbeidscommit `70ccbb021a6bd37e6b95b4912eb2408e12cb7d2c` inneholder 14 filer: fire produksjonsfiler, fem testfiler, utvidet utvalg for nettleserprøver mot bygg og fire dokumenter. Importen validerer den valgte fristen etter konfliktsammenslåing. Agendaer bruker faktiske tidspunkter, sikkert utløpte uavklarte frister fortrenger ikke kommende arbeid, og tastaturfokus bevares ved klokkeoppdatering. Egne regresjoner kontrollerer reserverte minutter og begge dagsoversiktens sorteringer. Arkitekturens eldre regler og den tilbaketrukne månedsprøven er tydelig merket; tidligere R-07-resultater beholdes.

Overføringen avdekket to forhold ved dagens kode: en personlig datoaktivitet måtte få en eksplisitt Oslo-sorteringsnøkkel, og dagsoversiktens selvstendige kommende-liste brukte fortsatt klokketeksten. Begge feilene ble først bekreftet med feilede nettleserassertjoner og deretter rettet. Tre innledende nettleserfeil skyldtes prøveoppsett for den eldre skjermstrukturen; de ble tilpasset dagens synlige navigasjon og duplikatfjerning. Det er ikke gjort nye påstander om manuell studentprøving.

Endelige kontroller 13. november:

- **135/135 fokuserte enhetstester** i ni filer og **2757/2757 i hele enhetstestsuiten**, fordelt på 157 filer. Utvalget inngår i totalen.
- **13/13 fokuserte Chromium-prøver** mot ferdig produksjonsbygg bestod på 40,6 sekunder, inkludert 360/1280 piksler og en nettleser i America/Los_Angeles. Hele nettlesersuiten er ikke kjørt på nytt.
- Produksjonsbygg bestod, med hovedbundle **963,57 kB / 294,75 kB gzip**. Det kjente størrelsesvarselet består.
- Indekskontrollen før arbeidscommiten kontrollerte **1066 relative lenker, 258 ankere og 356 dokument-/fixturefiler**, inkludert 11 utfoldede ICS-filer med 982 hendelser og PDF-/DOCX-metadata. Ingen funn i de kontrollerte kategoriene eller genererte artefakter. Eksterne lenkemål, all PDF-brødtekst og historiske kopier inngår ikke i denne kontrollen.
- `git diff --cached --check` bestod. Rålogger, lokale snapshots og interne arbeidsspesifikasjoner ble beholdt utenfor Git.

Arbeidet følger lærerens punkter om avgrensning, testbare kriterier og etterprøvbar kvalitetskontroll. Sensorvedlegget var ikke tilgjengelig for ny lesing i denne runden; tidligere daterte vurderinger er bevart. Installert `uv` fungerte ved avgrenset kjøring utenfor sandkassen uten reinstallasjon eller systemendringer. Brukerens bestilling gjelder ordinær push til eksisterende `main`; lokal verifikasjon er ikke en bekreftelse på produksjonsdeployment eller innlevering. Denne fortsettelsen føres i separat loggcommit etter arbeidscommiten.

### Åpne punkter

To eldre begrensninger er registrert separat i [issues.md](issues.md): den skjulte emneagendaens tidsfilter oppdateres ikke innen samme dato når cachen gjenbrukes, og et delvis utfylt native importfelt kan stoppe lagring før et lokalt konfliktvalg behandles. Disse er avgrenset fra de fullførte A1–A7-punktene. Eksisterende leverings-, drifts- og historikkpunkter beholdes.
