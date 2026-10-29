# Ajour – retting etter egenutprøving og KI-assistert mengdetesting

## 2026-10-29 kl. 20:26 — GOplayer007

### Oppgave

Rette og etterprøve prosjekteierens rapporterte avvik og den separate KI-rapporten, deretter innarbeide tilleggene fra mengdetestrapporten på samme branch. Brukeren autoriserte commit, push, PR-integrering og Vercel-publisering når kontrollene består. Lærerfiler, brukerdata, lagringsformat og eksisterende sperrer skulle bevares.

### Plan

- Gjenskape funnene med isolerte syntetiske profiler, kontrollere faktiske offentlige kilder og rette årsakene innen eksisterende støtte.
- Full enhetssuite og bygg med låste avhengigheter, nettleser-/SQLite-regresjon, faktiske preview-prøver og separat gjennomgang før integrering.
- Bevare rapporterte resultater i [prøveplanen](../../.docs/planning-artifacts/USER-TRIAL-PLAN.md) og føre nye tekniske bevis i [verifikasjonen](../../studieplanlegger/VERIFICATION.md).

### Resultat

Egen branch `fix/ajour-own-trial-20261029` fra `b9abc26`. `618357b` retter radio/fokus, blokkert planlegging, kommende økter/kapasitetsstatus/Angre, UiT-pakking, importpresentasjon og UTC-DTSTAMP. `f476604` retter F01/F02/F04/F07/F08/F09: felles emnevalg og mindre rendering, foreldet status/sene svar, lenkehjelp, ett kodeprefiks og kildebevisste HVL-metadata. Ingen automatisk fjerning av blokkering eller endring av brukerens lagrede plan.

Siste samlede lokale kontroll før NTNU-oppfølgingen: 2451/2451 enhetstester, 95/95 nettleserprøver, 3/3 isolerte Node/SQLite-prøver og bestått produksjonsbygg. Faktisk preview `f476604`: 40/40 berørte brukerforløp, 5/5 faktiske kildeprøver og separat visuell kontroll av alle 24 originalbilder (to dialoger, begge temaer, 390/900/1440 px, 100/200 % tekst). To runder med tre uavhengige kodegjennomganger og oppfølgingskontroller er utført.

`625b2e7` retter en konkret EXPH0100-regresjon funnet av automatisk etterkontroll: publiserte campus tilbys separat og valideres fortsatt mot detaljkilden. Siste l?ste fullsuite bestod 2453/2453 i 143 filer, produksjonsbygg og 2/2 nye nettleserpr?ver mot bygget (30,3 s). Rettelsen er separat gjennomg?tt. F?rste preview og senere f476604 hadde feilede automatiske kildepr?ver; disse er dokumentert som feil. PR #6 er opprettet. Denne loggen skrives f?r ny preview og integrering; faktisk produksjonsresultat skal etterpr?ves mot siste commit, og er ikke forh?ndsgodkjent her.

UiT-PDF-behandlingen fungerer på Vercel, men H-2025-emnetabellen er et bilde. BI lagrer emner og støtter ikke automatisk undervisningshenting. De tre navngitte NTNU-kalenderne svarte HTTP 200 og null hendelser direkte og gjennom Ajour. HVL DAT100 ga fem varianter med adskilt navn/campus/råetikett. Dette er avgrensede kildeøyeblikksbilder.

Den vedlagte mengderapporten er registrert separat som KI-assistert testing: NHH feilet; NIH ga forhåndsvisning med advarsler. Den er ikke samtidig belastningsprøve, sikkerhetsrevisjon, Outlook-kontroll eller prosjekteierens egenutprøving. Berørte punkter trenger omprøving. Originale lærerfiler og eksisterende CI-/Vercel-sperrer er bevart.

### Åpne punkter

- Prosjekteierens samlede egenutprøving er påbegynt med avvik, ikke ferdig; omprøv punktene i prøveplanen.
- Faktisk Outlook-prøve og personlig refleksjon gjenstår.
- F03 (fri tekst uten kjent format), F05 (NHH/FHS/Samisk kildevalg) og F06 (uverifiserte AHO-semesterår) står åpne innen rapportens begrensninger.
- UiTs bildetabell krever alternativ import; BI-undervisning og kalenderlenker utenfor støtten er fortsatt begrenset.
- Eksisterende bundlevarsel består. Godkjent proposal og overordnet sensorveiledning er fortsatt ikke identifisert; den identifiserte syvsiders veiledningen er kontrollert.
