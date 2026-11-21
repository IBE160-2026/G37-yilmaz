# Fristvalg og utprøving

## 2026-11-12 kl. 21:38 — GOplayer007

### Oppgave

Prosjekteieren ba om commit og push etter gjennomgangen av frister, neste steg og en kort lokal prøve med eksempeloppgaver. De manuelle observasjonene skulle bevares med riktig omfang, og de bekreftede fristfeilene skulle rettes.

### Plan

- Finn Git-repoet som arbeidsområdet faktisk bruker, og bevar nyere Ajour-funksjoner og innhentede dokumentendringer.
- Overfør de konkrete fristrettingene og prøv dagens deløktregel med oppdeling både på og av.
- Skill tidligere manuelle observasjoner fra nye automatiserte kontroller i [den daterte rapporten](../.docs/implementation-artifacts/deadline-occurrences-2026-11-12.md).
- Kontroller tester, bygg, berørte filer og Git-endringer før commit og bestilt push til `main`.

### Resultat

Kode og dokumentasjon er samlet i commit `c8db5cc98f26390cfdbcf0f89f5cf5060eb33d14`: eksplisitt første/andre forekomst ved vintertid, presise feil ved ugyldig klokkeslett og sommertidshull, og bevart utkast. Valgt forekomst brukes også i kalender, eksport, kapasitet og omplanlegging. Tekstendringer av fristen nullstiller et foreldet forekomstvalg. Datofrister, arbeidssteg med stabile ID-er og dagens deløktregel er bevart.

Gjennomgangen ble først utført i en eldre lokal kopi uten Git. Fristrettingene ble overført til dagens Ajour. De manuelle observasjonene gjelder en kort prøve med eksempeloppgaver i den eldre versjonen. Tidligere R-07-evidens og V1 er uendret. Relevante punkter om testbare kriterier og kvalitet fra produktbrief-tilbakemeldingen og sensorveiledningen for del 1 er brukt som kontrollgrunnlag.

Lokale kontroller:

- **2737/2737 enhetstester** i 155 filer bestod etter retting av funn fra første kjøring.
- **191/191 Chromium-prøver** mot ferdig bygg bestod på 6,3 minutter, inkludert sju nye frist-/deløktprøver. Mobilbildet for det andre 02:30-valget ble også kontrollert.
- Produksjonsbygg bestod. Hovedbundle er 963,42 kB / 294,67 kB gzip; tidligere dokumentert størrelsesvarsel består.
- Kontrollen av filene som var klargjort for commit, omfattet 1042 relative lenker, 257 ankere og 354 dokument-/fixturefiler, inkludert utfoldet ICS og PDF-/DOCX-metadata, uten funn. Ingen byggeartefakter i inventaret. Kontrollen dekker ikke all PDF-brødtekst, eksterne lenkemål eller renhet i historiske GitHub-kopier.
- `git diff --cached --check` bestod. Private arbeidsdokumenter og lokal råevidens ble ikke lagt til i repoet.

Siste `origin/main` ved innhenting var `392e5a1`. Den ble integrert med ordinær merge `7bb2e35`, som bevarer både nyere eksterne dokumentendringer og eksisterende lokal loggcommit `3bb4daa`. Denne loggen føres i egen commit før brukerens bestilte push. Kontrollen ble kjørt lokalt.

### Åpne punkter

Ingen nye produktpunkter fra rettingen. Gjenstående punkter er samlet i [sakslisten](issues.md).

## 2026-11-13 kl. 01:27 — GOplayer007

### Oppgave

Prosjekteieren ba om oppfølging av A1–A7 fra Epic 4-retrospektiven, deretter gjennomgang og uttrykkelig commit og push. Denne fortsettelsen publiserer de ferdige rettelsene fra den eldre lokale arbeidskopien til dagens Ajour.

### Plan

- Bruk det rene målrepoet på `main`, med førgrunnlag `434b14828deae1db0bacfad58d27429ce56c81ad`, og overfør rettelsene selektivt.
- Bevar nyere dato-frister, personlige aktiviteter, arbeidssteg og dagens deløktregler.
- Samle før-/ettertilstand, avgrensninger og faktiske prøver i [A1–A7-rapporten](../.docs/implementation-artifacts/epic-4-followup-2026-11-13.md), og kontroller publiserbare filer før commit og bestilt push.

### Resultat

Arbeidscommit `70ccbb021a6bd37e6b95b4912eb2408e12cb7d2c` inneholder 14 filer: fire produksjonsfiler, fem testfiler, utvidet utvalg for nettleserprøver mot bygg og fire dokumenter. Importen validerer den valgte fristen etter konfliktsammenslåing. Agendaer bruker faktiske tidspunkter, sikkert utløpte uavklarte frister fortrenger ikke kommende arbeid, og tastaturfokus bevares ved klokkeoppdatering. Egne regresjoner kontrollerer reserverte minutter og begge dagsoversiktens sorteringer. Arkitekturens eldre regler og den tilbaketrukne månedsprøven er tydelig merket; tidligere R-07-resultater beholdes.

Overføringen avdekket to forhold ved dagens kode: en personlig datoaktivitet måtte få en eksplisitt Oslo-sorteringsnøkkel, og dagsoversiktens selvstendige kommende-liste brukte fortsatt klokketeksten. Begge feilene ble først bekreftet med nettlesertester som feilet og deretter rettet. Tre innledende nettleserfeil skyldtes prøveoppsett for den eldre skjermstrukturen; de ble tilpasset dagens synlige navigasjon og duplikatfjerning. Det er ikke gjort nye påstander om manuell studentprøving.

Endelige kontroller 13. november:

- **135/135 fokuserte enhetstester** i ni filer og **2757/2757 i hele enhetstestsuiten**, fordelt på 157 filer. Utvalget inngår i totalen.
- **13/13 fokuserte Chromium-prøver** mot ferdig produksjonsbygg bestod på 40,6 sekunder, inkludert 360/1280 piksler og en nettleser i America/Los_Angeles. Hele nettlesersuiten er ikke kjørt på nytt.
- Produksjonsbygg bestod, med hovedbundle **963,57 kB / 294,75 kB gzip**. Det kjente størrelsesvarselet består.
- Indekskontrollen før arbeidscommiten kontrollerte **1066 relative lenker, 258 ankere og 356 dokument-/fixturefiler**, inkludert 11 utfoldede ICS-filer med 982 hendelser og PDF-/DOCX-metadata. Ingen funn i de kontrollerte kategoriene eller genererte artefakter. Eksterne lenkemål, all PDF-brødtekst og historiske kopier inngår ikke i denne kontrollen.
- `git diff --cached --check` bestod. Rålogger, lokale snapshots og interne arbeidsspesifikasjoner ble beholdt utenfor Git.

Arbeidet følger lærerens punkter om avgrensning, testbare kriterier og etterprøvbar kvalitetskontroll. Sensorvedlegget var ikke tilgjengelig for ny lesing i denne runden; tidligere daterte vurderinger er bevart. Installert `uv` fungerte ved avgrenset kjøring utenfor sandkassen uten reinstallasjon eller systemendringer. Prosjekteieren ba om ordinær push til eksisterende `main`. Verifiseringen ble gjort lokalt. Denne fortsettelsen føres i separat loggcommit etter arbeidscommiten.

### Åpne punkter

To eldre begrensninger er registrert separat i [issues.md](issues.md): den skjulte emneagendaens tidsfilter oppdateres ikke innen samme dato når cachen gjenbrukes, og et delvis utfylt standardfelt i nettleserens importskjema kan stoppe lagring før et lokalt konfliktvalg behandles. Disse er avgrenset fra de fullførte A1–A7-punktene.

## 2026-11-19 kl. 11:02 — Codex

### Oppgave

Undersøk og rett at et delvis utfylt datofelt stopper import etter «Behold min verdi». Undersøk også feilene fra `npm run test:e2e` og forklar forskjellen fra den grønne GitHub-jobben.

### Plan

- Gjenskap feilen med ekte nettleserfelter og syntetiske CSV-revisjoner. Kontroller konfliktvalg, validering og omlasting av den lagrede fristen.
- Sammenlign lokal testutvelgelse med GitHub på samme commit. Les hver feil og kjør egne prøver der feilmeldingen alene gir for lite informasjon.

### Resultat

- [Importskjemaet](../studieplanlegger/src/document-import.js) bruker konfliktvalget før det avviser et delvis utfylt kildefelt. «Behold min verdi» fjerner feilen for kildefristen og lar importen fullføres med lokal frist. Andre ufullstendige felter blokkerer fortsatt lagring.
- Begge tilfellene i [nettleserregresjonen](../studieplanlegger/tests/e2e/import-reimport-repair.spec.js) feilet før rettingen. Etterpå bestod hele filen med **22 av 22** tester mot produksjonsbygget. Det fokuserte enhetsutvalget bestod **106 av 106**. Hele enhetskjøringen bestod **2756 av 2757** med standard tidsfrist. Én prøve med 500 aktiviteter overskred fem sekunder og bestod ved omkjøring med 15 sekunders grense.
- [GitHub-jobben](https://github.com/IBE160-2026/G37-yilmaz/actions/runs/43337431457) bestod på samme commit som den lokale kjøringen startet fra. Jobben kjørte 199 Chromium-prøver mot ferdig bygg, 4 Firefox/WebKit-prøver og 14 SQLite-prøver. Den lokale Vite-kjøringen omfattet 755 tester før de to nye regresjonene ble lagt til. Feilgjennomgangen ligger som lokalt testartefakt i `studieplanlegger/artifacts/friste2e-audit.md`.
- Den brede kjøringen rapporterte **656 bestått, 67 hoppet over og 32 feilet**. Tretti gjaldt eldre testvelgere, forventninger eller testdata. Én prøve bestod ved omkjøring etter omlasting i Vite under den brede kjøringen. Én prøve gjenga et rullehopp på 24 piksler i mobilforhåndsvisningen, også med importmodulen fra før rettingen. De 32 testtilfellene er utenfor GitHub-utvalget.
- Dette følger lærerens tilbakemelding om avgrenset V1 og sporbare, sjekkbare kriterier. Sensorvedlegget var utilgjengelig for ny lesing i denne runden.

### Åpne punkter

- Oppdater de eldre forventningene i den brede E2E-suiten. Testgjennomgangen viser hvor de stopper og hva som faktisk vises.
- Undersøk rullehoppet i den mobile importforhåndsvisningen ved valg av tidspunkt uten varighet. Et ekte `ArrowDown` i det fokuserte valgfeltet gjenga hoppet. Tastaturfokus, åpen importrad og lagring ble bevart i prøven.

## 2026-11-19 kl. 11:35 — Codex

### Oppgave

Rett appfeilene fra E2E-gjennomgangen, oppdater de utdaterte testene og verifiser hele den lokale suiten.

### Plan

- Behold det fokuserte tidsvalget på samme sted i visningsområdet når forklaringsteksten endrer høyden på importraden.
- Prøv de faktiske tastatur- og konfliktvalgene i Chromium. Oppdater gamle selektorer og forventninger med tester av dagens handlinger og lagrede data.

### Resultat

- [Importskjemaet](../studieplanlegger/src/document-import.js) beholder posisjonen til det fokuserte tidsvalget og forkaster et delvis utfylt sluttfelt når brukeren velger tidspunkt uten varighet. [Mobiltestene](../studieplanlegger/tests/e2e/import-clarity.spec.js) dekker forstørret tekst, tastaturfokus, åpen rad og lagring.
- En uavklart lokal frist ved tidsomstilling viser nå feilen på [konfliktvalget](../studieplanlegger/src/import-preview.js). [Regresjonen](../studieplanlegger/tests/e2e/import-reimport-repair.spec.js) bytter mellom ugyldige alternativer og bekrefter at en gyldig kildefrist kan lagres.
- Oppdaterte de 30 gamle E2E-tilfellene og sjekket redusert bevegelse på det synlige panelet. Dette følger opp lærerens punkt om testbare kriterier for V1. Sensorvedlegget var utilgjengelig for ny lesing.
- Hele lokale E2E-suiten med fire arbeidere rapporterte **692 bestått, 67 hoppet over og 0 feil** på 18,5 minutter. Rapporten ligger i `studieplanlegger/artifacts/e2e-repair-full.json`. Hele enhetssuiten bestod med **2 757** tester, seks fokuserte nettleserprøver bestod, og produksjonsbygget bestod.

### Åpne punkter

Ingen fra E2E-gjennomgangen i denne økten.

## 2026-11-19 kl. 11:43 — Codex

### Oppgave

Prosjekteieren ba om å committe og pushe de verifiserte Ajour-endringene til GitHub.

### Plan

- Kontroller at `main` har samme utgangspunkt som `origin/main`. Kjør kontrollene før ordinær push og før loggen separat fra kodeendringene.

### Resultat

Arbeidscommit `53e2e2bdf63e99e805b9072bb8e83d203b6fa13c` inneholder app- og testrettelsene. Produksjonsbygget, alle 2 757 enhetstestene og seks fokuserte importtester bestod på nytt. Hele E2E-resultatet fra samme kildeinnhold var 692 bestått, 67 hoppet over og 0 feil. Lenker, utfoldede ICS-filer, metadata, tilgangsmønstre og byggeartefakter ble kontrollert lokalt. Kontrollen av arbeidskopien og det indekserte kodeinnholdet fant ingen avvik.

### Åpne punkter

Ingen fra commit-forberedelsen.
