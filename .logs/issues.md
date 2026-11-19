# Aktiviteter og oppfølging

Oppfølgingen bygger på [retting og dokumentert egenutprøving](994-2026-10-29-20-26-15-ajour-egenutproving-og-mengdetesting.md). Prosjekteieren bekreftet resultatene fra omprøvingene 1. november. Den 4. november ble listen oppdatert etter [fullført personlig sjuscenarioprøve og Start-tillegg](../.docs/implementation-artifacts/owner-trial-2026-11-04.md). Tekniske prøver føres separat. [Leveringsoversikten](../README.md#leveringsoversikt) og [samlede begrensninger med V1-betydning](../studieplanlegger/README.md#kjente-begrensninger-ved-levering) er gjeldende innganger. Eldre loggseksjoner bevarer statusen på sine tidspunkter.

Sluttrapporten er innarbeidet bare som Markdown etter prosjekteierens senere ønske; Manrope-fontnavnene er rettet til TrueType. Se [Sluttrapport og leveringskontroll med datert oppfølging](993-2026-11-01-22-34-20-ajour-sluttleveranse.md). Ingen nye produktpunkter følger av oppryddingen. Oppfølgingen av funn 1–4 er avsluttet. Dagens filer er ikke bevis på ren historikk. Se [oppryddingsrapporten](../.docs/implementation-artifacts/history-cleanup-2026-11-09.md).

## Åpne punkter

### Kjente tekniske begrensninger

- [ ] 2026-11-13 [Epic 4-oppfølging](982-2026-11-12-21-38-19-fristvalg-og-utproving.md) — Den eldre, CSS-skjulte emneagendaens cache bruker dato i stedet for nøyaktig tidspunkt. Et tidsfilter kan derfor forbli utdatert innen samme dag uten endring i data eller emnevalg. A4 retter rekkefølgen; denne separate oppdateringsbegrensningen er ikke lukket.

- [ ] 2026-11-19 A-04: GitHubs gren-API bekreftet at `main` er ubeskyttet og har null påkrevde kontroller. En administrator må aktivere grenbeskyttelse eller et regelsett dersom teamet vil kreve grønn **Ajour quality** før sammenslåing. [Auditoppfølging](../.docs/implementation-artifacts/import-sequencing-audit-2026-11-04.md)

- [ ] 2026-11-19 Dependabot-PR #30 er åpen. Den endrer fem avhengigheter i pakkemanifest og låsefil. Begge registrerte **Ajour quality**-kontroller feilet. PR-en trenger egen feilavklaring og ny CI før eventuell sammenslåing. [Dependabot-PR #30](https://github.com/IBE160-2026/G37-yilmaz/pull/30)

- [ ] 2026-11-04 [Plattformkontroll](../.docs/implementation-artifacts/import-sequencing-audit-2026-11-04.md) — Vercels rate-/samtidighetsgrenser og forbruksvarsler er ikke verifisert. Per-forespørselsbudsjett og same-origin-vern er ikke global ratebegrensning. Ingen betalt tjeneste eller nytt prosjekt er bestilt.

- [ ] 2026-10-29 [KI-assistert mengdetesting](994-2026-10-29-20-26-15-ajour-egenutproving-og-mengdetesting.md) — F03 (fri tekst uten kjent importformat) og F05 (NHH/FHS/Samisk kildevalg) står åpne; ingen generell støtte for alle 25 læresteder er bekreftet. F06 er fulgt opp separat nedenfor.

- [ ] 2026-11-01 [Avgrensede kilder](994-2026-10-29-20-26-15-ajour-egenutproving-og-mengdetesting.md) — NTNUs samlede programkatalog returnerer tomt før filtrering; separate emne-/planendepunkter fungerer. UiTs Applied Computer Science-PDF 941723 har åtte niukersterminer med ECTS-tabell som ikke støttes som semesterfordeling. Begrensningene forklares, men kildene fylles ikke med gjetninger.

- [ ] 2026-11-01 [Lagringsgrenser](994-2026-10-29-20-26-15-ajour-egenutproving-og-mengdetesting.md) — Identisk import og store recovery-kopier er rettet, men nettleserkvote og optimistisk konfliktvern gjelder fortsatt. Bruk én redigerende fane; komprimering er synkron og garanterer ikke ubegrenset plass.

- [ ] 2026-11-01 [Sikkerhetsavgrensning](994-2026-10-29-20-26-15-ajour-egenutproving-og-mengdetesting.md) — Tidligere verktøyblokkerte sikkerhetsprøver er ikke gjennomført. Avgrensede validerings-/lagringsprøver er ingen generell sikkerhetsrevisjon.

- [ ] 2026-10-29 [Importbegrensninger](994-2026-10-29-20-26-15-ajour-egenutproving-og-mengdetesting.md) — UiTs H-2025-emnetabell er et bilde og krever alternativ import. BI støtter ikke automatisk undervisningshenting; kalenderlenker utenfor eksisterende kildevern forblir avvist med filalternativ.

- [ ] 2026-10-26 [Ajour-samordning og publisering](999-2026-10-26-22-07-17-ajour-samordning-og-publisering.md) — Bundlevarsel over 500 kB består. Det beståtte bygget 2026-11-01 målte 957,30 kB / 292,79 kB gzip; den [nyere daterte kontrollen 2026-11-02](../studieplanlegger/VERIFICATION.md#fristavklaring-oppgavebekreftelse-og-lagringshjelp--2026-11-02) målte 959,61 kB / 293,45 kB gzip. [Stegrettingen 2.–3. november](../studieplanlegger/VERIFICATION.md#oppgavearbeid-og-navngitt-arbeidssteg--2026-11-02) målte 961,13 kB / 293,89 kB gzip. [Avklaringsrettingen 3. november](../studieplanlegger/VERIFICATION.md#avklaringssteg-og-lokal-forespørselsvalidering--2026-11-03) målte 961,20 kB / 293,91 kB gzip. Mulig nedlastings-/oppstartsulempe, ingen avtalt numerisk V1-grense. Mål et konkret ytelsesproblem før eventuell optimalisering.

### Vurderingskilder som ikke er identifisert

Dette beskriver manglende kildegrunnlag, ikke nye obligatoriske innleveringskrav.

- [ ] 2026-10-26 [Ajour-samordning og publisering](999-2026-10-26-22-07-17-ajour-samordning-og-publisering.md) — Godkjent proposal og overordnet sensorveiledning er ikke identifisert.

<a id="gjenstående-aktiviteter"></a>

## Fullførte aktiviteter

- [x] 2026-11-02 [PRD-validering](998-2026-10-26-23-09-41-ajour-prd-og-egenutproving.md#2026-11-02-kl-1903--goplayer007) — R-03/S-03 må skille planlegging med bekreftede arbeidsvinduer fra eksisterende, godkjennbare betingede startøkter med fortsatt ukjent totalanslag. To små dokumentfunn gjelder Q-01s «lett å finne» og direkte avsnittslenker i kravtabellen. Produkttekstene ble ikke endret i Validate-runden. Alle tre funn er rettet og kontrollert etter prosjekteierens [Update-valg](998-2026-10-26-23-09-41-ajour-prd-og-egenutproving.md#2026-11-02-kl-1918--goplayer007), uten ny funksjon eller manuell prøverunde (løst 2026-11-02).

- [x] 2026-10-29 [Ajour for Vercel](997-2026-10-29-13-35-00-ajour-vercel.md) — Offentlig tilgang godkjent bare for ajour etter kildekontroll. Faktisk preview, alle 30 skjermbilder, live-import, profilisolasjon, gjenåpning og samme-adresse-redeploy bestod før PR-integrering. [Produksjon](https://ajour-sooty.vercel.app) er promotert og funksjonskontrollert, og lenken står i README (løst 2026-10-29).

- [x] 2026-10-26 [Egenutprøving / SC-07](998-2026-10-26-23-09-41-ajour-prd-og-egenutproving.md) — Prosjekteieren bekrefter egenutprøvingen gjennomført og resultatene kontrollert. De dokumenterte omprøvingene er bestått; SC-07/1200–30 beholder bestått. Opprinnelige tomme scenariofelt fylles ikke med antatte observasjoner, og ingen andre testpersoner skal rekrutteres. [Prøveplanen](../.docs/planning-artifacts/USER-TRIAL-PLAN.md#egenutprøving-utført-av-prosjekteier--2026-11-01) avgrenser lukkingen (løst innen dokumentert omfang 2026-11-01).
- [x] 2026-11-01 [Lagring og gjenoppretting](994-2026-10-29-20-26-15-ajour-egenutproving-og-mengdetesting.md) — Egenutprøving utført av prosjekteier: 525 uendrede elementer uten lagringsfeil, 28 Angre-oppføringer og 0 byte vekst; faktisk 6,62 MB-gjenoppretting fra 7 til 6 oppgaver med hele datasettet, historikken, papirkurven og ID-ene bevart etter omlasting. Tre tidsfeil ga norske meldinger og kapasitetsforklaringen ble vist én gang (løst innen dokumentert omfang 2026-11-01).
- [x] 2026-10-26 [Ajour-samordning og publisering](999-2026-10-26-22-07-17-ajour-samordning-og-publisering.md) — Brukerlevert refleksjonsrapport foreligger som [Markdown](../.docs/submission/reflection-report.md), innarbeidet 1. november med uttrykkelig tillatelse. Word-kopien ble senere fjernet etter prosjekteierens ønske.
- [x] 2026-10-26 [Ajour-samordning og publisering](999-2026-10-26-22-07-17-ajour-samordning-og-publisering.md) — Brukeren bekreftet faktisk Outlook-import av eksporten med 37 hendelser 2026-10-30. Bestått for den viste flyten; prøven gjenåpnes ikke. Dette bekrefter ikke alle sluttider, gjentatt import eller alle Outlook-klienter (løst 2026-10-30; registrert 2026-11-01).
- [x] 2026-10-26 [PRD og egenutprøving](998-2026-10-26-23-09-41-ajour-prd-og-egenutproving.md) — Hel HiMolde-programgjentakelse kontrollert med syntetiske kilder på faktisk Vercel-preview og produksjon, med stabile ID-er, bevarte valg/notater og ingen duplikater. [Avgrenset teknisk evidens](995-2026-10-29-15-37-33-ajour-teknisk-sluttkontroll.md); hel gjentakelse med faktisk kildetransport påstås ikke (løst 2026-10-29).

### Arkitekturvalidering — 2026-11-12

- [x] 2026-11-12 [Ajour-arkitektur mot PRD](984-2026-11-12-13-47-31-ajour-arkitekturvalidering.md) — N1–N5 er rettet etter prosjekteierens godkjenning: planleggingsresultater/betingede forslag, gjeldende driftskart, backupgrenser, språkmodellavgrensning og korrekt pako-omtale. Tre uavhengige etterkontroller har ingen gjenstående funn innen omfanget. V1, AD-ID-er og daterte resultater er bevart; produktkoden er uendret. O1–O3 er fortsatt valgfrie (løst 2026-11-12).

### Teknisk oppfølging

- [x] 2026-11-13 [Epic 4-oppfølging](982-2026-11-12-21-38-19-fristvalg-og-utproving.md) — Et delvis utfylt dato- eller dato/tid-felt stoppet import selv om brukeren valgte å beholde lokal frist. Nettlesertester mot produksjonsbygget bekrefter at lokalvalget fullfører importen, mens et ufullstendig valgt kildefelt fortsatt stopper lagring (løst lokalt 2026-11-19).

- [x] 2026-11-19 [Lokal E2E-gjennomgang](982-2026-11-12-21-38-19-fristvalg-og-utproving.md) — De 30 utdaterte E2E-tilfellene er oppdatert. Hele den lokale suiten rapporterte 692 bestått, 67 hoppet over og 0 feil (løst lokalt 2026-11-19).

- [x] 2026-11-19 [Mobil importforhåndsvisning](982-2026-11-12-21-38-19-fristvalg-og-utproving.md) — Valgfeltet beholder samme plass i visningsområdet når tidsvalget endrer innholdet over feltet. Tastaturtestene i `import-clarity.spec.js` består ved 390 piksler med vanlig og forstørret tekst (løst lokalt 2026-11-19).

- [x] 2026-11-04 [Importrekkefølge](../.docs/implementation-artifacts/import-sequencing-audit-2026-11-04.md) — A-01/A-02 er rettet med operasjonsidentitet, avbrudd og filnavn i backupforhåndsvisningen. Femten målrettede regresjoner er lagt til; faktisk sluttkontroll og publisering spores i [PR #24](https://github.com/IBE160-2026/G37-yilmaz/pull/24). Første testmenyavvik er bevart i rapporten. Egenutprøvingen gjenåpnes ikke.

- [x] 2026-11-03 [Avklaringssteg og lokal validering](988-2026-11-03-19-29-10-avklaringssteg-og-lokal-validering.md) — De fire funnene er rettet, dokumentert og publisert gjennom PR #21. GitHub-kvalitet på kandidat og integrert main bestod med 2664 enhetstester, 155 Chromium-prøver og 14 SQLite-/nettleserprøver, inkludert nye fullføringsveier, avbrudd og Angre. Faktisk forhåndsvisning og produksjonsdeploy bestod hver 60 runtimeprøver og seks kildeprøver. Offentlig produksjonsadresse leverte riktig SHA og byteidentiske appfiler. Den lokale Chromium-begrensningen er fulgt opp av faktisk CI-kjøring; tekniske resultater erstatter ikke personlig R-07 (løst innen kontrollert omfang 2026-11-03).

- [x] 2026-11-03 [Arbeidssteg og teknisk prøving](989-2026-11-03-00-32-35-ajour-arbeidssteg-og-teknisk-proving.md) — Første rapport brukte legitim oppgaveplanlegging; separat Start-reproduksjon påviste tapt navngitt steg og ignorert nytt anslag. Stabil stegidentitet, separat faktisk/gjenstående og bakoverkompatibilitet er rettet. Sju scenarioer med 20 delkontroller, regresjoner, main-CI og faktisk produksjon er prøvd med syntetiske data. Dette er Codex-utført teknisk nettlesertest og lukker ikke automatisk prosjekteierens R-07-dekningsforbehold (løst innen beskrevet omfang 2026-11-03).

- [x] 2026-11-02 [Fristavklaring og lagringshjelp](991-2026-11-02-12-11-30-ajour-frist-og-hjelp.md) — Det nye fredags-eksemplet er reprodusert og rettet, med atomisk import, uttrykkelige valg og bevaring ved omlasting. Klokkeslett før oppgavebekreftelse og driftsavhengig hjelp er også rettet og prøvd i faktisk Chromium/SQLite (løst innen dette omfanget 2026-11-02). Historisk F03 står fortsatt under [Åpne punkter](#åpne-punkter). Rapporten er funnet, men originalen `stress-text-005.txt` er ikke funnet eller omprøvd.

- [x] 2026-11-01 [AHO / F06](994-2026-10-29-20-26-15-ajour-egenutproving-og-mengdetesting.md) — Årshoppet 2029–2031 er teknisk bekreftet i originalkilden; rettingen bevarer årstall, eksisterende koblinger og Angre. Egenutprøving utført av prosjekteier bekrefter vår 2031 som semester 10 og høst 2031 som 11 i forhåndsvisningen. Ingen AHO-emner ble lagret i denne omprøvingen; selve kildehullet består (etikettavvik løst 2026-11-01).

- [x] 2026-11-01 [Omfang for siste egenutprøving](994-2026-10-29-20-26-15-ajour-egenutproving-og-mengdetesting.md) — Dekningsforbeholdet fra 1.–2. november er fulgt opp av prosjekteierens [sju scenarioer og navngitte Start-prøve 3.–4. november](../.docs/implementation-artifacts/owner-trial-2026-11-04.md). Separat tom Chrome-gjesteøkt, forhåndsvist import, omlasting og identisk slutteksport bekrefter scenario 7; de øvrige scenarioene har egne observasjoner og bevis. Full nettleserprosessomstart og «Gjenopprett forrige kopi» er fortsatt ikke påstått prøvd, men er ikke egne krav i sjuscenarioprøven. Ingen beståtte prøver gjenåpnes (dekningsforbehold lukket innen dokumentert omfang 2026-11-04).

### Personlig sluttkontroll og historisk eksponering

- [x] A-05: GitHub About viser hovedadressen `https://ajour-sooty.vercel.app/`. [Auditoppfølgingen](../.docs/implementation-artifacts/import-sequencing-audit-2026-11-04.md) beholder det daterte HTTP 404-resultatet.

- [x] 2026-11-01 [Sluttrapport og leveringskontroll](993-2026-11-01-22-34-20-ajour-sluttleveranse.md) — Sluttlesing av refleksjonsrapporten er dokumentert i [leveringsstatusen](../.docs/planning-artifacts/README.md#leveringsstatus).
- [x] 2026-11-01 [Sluttrapport og leveringskontroll](993-2026-11-01-22-34-20-ajour-sluttleveranse.md) — Frist, kanal, filformat og kvittering er omtalt i [leveringsstatusen](../.docs/planning-artifacts/README.md#leveringsstatus). Rapportmalen oppgir 3000–5000 ord.
- [x] Historikkopprydding og oppfølging av funn 1–4 er avsluttet. [Oppryddingsrapporten](../.docs/implementation-artifacts/history-cleanup-2026-11-09.md) dokumenterer rensing av 26 publiserte brancher og bevaring av dagens filer. Ved kontroll 2026-11-04 mot `43e5cd33d8c374d1161c0d43a0139f25af13cd30` var alle 12 historiske eksempelblobs fortsatt tilgjengelige via referanser. Fullstendig sletting av eldre kopier og sperring av tilgang er ikke bekreftet.

## Status ved kontrollen — 2026-11-04

Gjeldende status for historikkoppfølgingen og GitHub About står under [Personlig sluttkontroll og historisk eksponering](#personlig-sluttkontroll-og-historisk-eksponering).

Prosjekteierens sju scenarioer og navngitte Start-prøve er gjennomført og bestått innen dokumentert prøveomfang. Det tidligere R-07-forbeholdet om gjenoppretting i separat tomt miljø er lukket: Chrome Gjest og tomme førverdier er synlige, omlasting er brukerbekreftet, og hele sluttdataene er identiske med kildekopien. [Rapporten](../.docs/implementation-artifacts/owner-trial-2026-11-04.md) bevarer metodeavvik og skiller eierens handlinger fra teknisk filsammenligning.

Den etterfølgende auditrapporten identifiserte to konkrete rekkefølgefeil ved filimport. [Oppfølgingen 4. november](../.docs/implementation-artifacts/import-sequencing-audit-2026-11-04.md) dokumenterer retting, regresjoner og faktiske kontrollresultater. Tidligere personlige prøver beholdes med sitt omfang. [Senere leveringsstatus](../.docs/planning-artifacts/README.md#leveringsstatus)
