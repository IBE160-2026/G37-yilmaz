# Aktiviteter og oppfølging

Prosjekteieren bekreftet resultatene fra [prøvene som ble gjentatt 1. november](994-2026-10-29-20-26-15-ajour-egenutproving-og-mengdetesting.md). Den 4. november ble listen oppdatert etter [prosjekteierens sju scenarioer og prøven av navngitt Start](../.docs/implementation-artifacts/owner-trial-2026-11-04.md). [Tekniske testresultater](../studieplanlegger/VERIFICATION.md) og [kjente begrensninger](../studieplanlegger/README.md#kjente-begrensninger) er samlet i egne dokumenter.

[Refleksjonsrapporten](../.docs/submission/reflection-report.md) ligger i repoet som Markdown. [Loggen fra 1. november](993-2026-11-01-22-34-20-ajour-sluttleveranse.md) dokumenterer rapporten og rettingen av Manrope-fontnavnene til TrueType.

## Åpne punkter

### Kjente tekniske begrensninger

- [ ] 2026-11-20 [Sluttkontroll etter ce8babe](975-2026-11-19-23-55-00-ajour-sluttkontroll.md#oppfølging-2026-11-20) — Den nyere versjonerte matrisen bestod 1 800 alternativer på `a0ea535`. Originalmatrisens generator og avviksrader mangler. De konkrete emnefarge- og kalendertilfellene fra 20. november er gjenskapt. Øvrige vedleggsspesifikke eksempler krever den eksterne testpakken. [Teknisk sluttkontroll](../studieplanlegger/VERIFICATION.md#sluttkontroll-2026-11-20)

- [x] 2026-11-13 [Epic 4-oppfølging](982-2026-11-12-21-38-19-fristvalg-og-utproving.md) — K03: Den eldre emneagendaen oppdateres når en frist eller undervisningsslutt passerer. Nettleserprøven flyttet klokken gjennom begge grensene uten omlasting eller endring av emne (løst 2026-11-19). [Regresjonstestene](976-2026-11-19-21-31-13-ajour-leveringsregresjoner.md)

- [ ] 2026-11-19 A-04: GitHubs gren-API bekreftet at `main` er ubeskyttet og har null påkrevde kontroller. En administrator må aktivere grenbeskyttelse eller et regelsett dersom teamet vil kreve grønn **Ajour quality** før sammenslåing. [Oppfølging etter gjennomgangen](../.docs/implementation-artifacts/import-sequencing-audit-2026-11-04.md)

- [ ] 2026-11-19 Dependabot-PR #30 er åpen. Den endrer fem avhengigheter i pakkemanifest og låsefil. Begge registrerte **Ajour quality**-kontroller feilet. Feilene må undersøkes og CI kjøres på nytt før eventuell sammenslåing. [Dependabot-PR #30](https://github.com/IBE160-2026/G37-yilmaz/pull/30)

- [ ] 2026-11-04 [Plattformkontroll](../.docs/implementation-artifacts/import-sequencing-audit-2026-11-04.md) — Vercels rate-/samtidighetsgrenser og forbruksvarsler er ikke verifisert. Appen begrenser hver forespørsel og kontrollerer opphavet. Ingen betalt tjeneste eller nytt prosjekt er bestilt.

- [ ] 2026-10-29 [KI-assistert mengdetesting](994-2026-10-29-20-26-15-ajour-egenutproving-og-mengdetesting.md) — F03 (fri tekst uten kjent importformat) står fremdeles åpent per 20. november fordi originalen mangler. F05 (NHH/FHS/Samisk kildevalg) ligger utenfor avtalt V1. F06 er fulgt opp separat nedenfor.

- [ ] 2026-11-01 [Avgrensede kilder](994-2026-10-29-20-26-15-ajour-egenutproving-og-mengdetesting.md) — NTNUs samlede programkatalog returnerer tomt før filtrering; separate emne-/planendepunkter fungerer. UiTs Applied Computer Science-PDF 941723 har åtte niukersterminer med ECTS-tabell som ikke støttes som semesterfordeling. Begrensningene forklares, men kildene fylles ikke med gjetninger.

- [ ] 2026-11-01 [Lagringsgrenser](994-2026-10-29-20-26-15-ajour-egenutproving-og-mengdetesting.md) — Feil ved identisk gjenimport og store gjenopprettingskopier er rettet. Appen oppdager lagringskonflikter ved hjelp av revisjonsnummer. Bruk én redigerende fane. Lagringsgrensen avhenger av nettleseren, også ved synkron komprimering.

- [ ] 2026-11-01 [Sikkerhetsavgrensning](994-2026-10-29-20-26-15-ajour-egenutproving-og-mengdetesting.md) — Tidligere verktøyblokkerte sikkerhetsprøver er ikke gjennomført. Avgrensede validerings-/lagringsprøver er ingen generell sikkerhetsrevisjon.

- [ ] 2026-10-29 [Importbegrensninger](994-2026-10-29-20-26-15-ajour-egenutproving-og-mengdetesting.md) — UiTs H-2025-emnetabell er et bilde og krever alternativ import. BI støtter ikke automatisk undervisningshenting; kalenderlenker utenfor eksisterende kildevern forblir avvist med filalternativ.

- [ ] 2026-10-26 [Ajour-samordning og publisering](999-2026-10-26-22-07-17-ajour-samordning-og-publisering.md) — Bundlevarsel over 500 kB består. Det beståtte bygget 2026-11-01 målte 957,30 kB / 292,79 kB gzip; den [nyere daterte kontrollen 2026-11-02](../studieplanlegger/VERIFICATION.md#fristavklaring-oppgavebekreftelse-og-lagringshjelp--2026-11-02) målte 959,61 kB / 293,45 kB gzip. [Stegrettingen 2.–3. november](../studieplanlegger/VERIFICATION.md#oppgavearbeid-og-navngitt-arbeidssteg--2026-11-02) målte 961,13 kB / 293,89 kB gzip. [Avklaringsrettingen 3. november](../studieplanlegger/VERIFICATION.md#avklaringssteg-og-lokal-forespørselsvalidering--2026-11-03) målte 961,20 kB / 293,91 kB gzip. Mulig nedlastings-/oppstartsulempe, ingen avtalt numerisk V1-grense. Mål et konkret ytelsesproblem før eventuell optimalisering.

### Vurderingskilder som ikke er identifisert

- [ ] 2026-10-26 [Ajour-samordning og publisering](999-2026-10-26-22-07-17-ajour-samordning-og-publisering.md) — Godkjent proposal og overordnet sensorveiledning er ikke identifisert.

<a id="gjenstående-aktiviteter"></a>

## Fullførte aktiviteter

- [x] 2026-11-02 [PRD-validering](998-2026-10-26-23-09-41-ajour-prd-og-egenutproving.md#2026-11-02-kl-1903--goplayer007) — R-03/S-03 må skille planlegging med bekreftede arbeidsvinduer fra eksisterende, godkjennbare betingede startøkter med fortsatt ukjent totalanslag. To små dokumentfunn gjelder Q-01s «lett å finne» og direkte avsnittslenker i kravtabellen. Produkttekstene ble ikke endret i Validate-runden. Alle tre funn er rettet og kontrollert etter prosjekteierens [Update-valg](998-2026-10-26-23-09-41-ajour-prd-og-egenutproving.md#2026-11-02-kl-1918--goplayer007), uten ny funksjon eller manuell prøverunde (løst 2026-11-02).

- [x] 2026-10-29 [Ajour for Vercel](997-2026-10-29-13-35-00-ajour-vercel.md) — Offentlig tilgang godkjent bare for ajour etter kildekontroll. Faktisk preview, alle 30 skjermbilder, live-import, profilisolasjon, gjenåpning og samme-adresse-redeploy bestod før PR-integrering. [Produksjon](https://ajour-sooty.vercel.app) er promotert og funksjonskontrollert, og lenken står i README (løst 2026-10-29).

- [x] 2026-10-26 [Egenutprøving / SC-07](998-2026-10-26-23-09-41-ajour-prd-og-egenutproving.md) — Prosjekteieren bekrefter egenutprøvingen gjennomført og resultatene kontrollert. De dokumenterte omprøvingene er bestått; SC-07/1200–30 beholder bestått. Opprinnelige tomme scenariofelt fylles ikke med antatte observasjoner, og ingen andre testpersoner skal rekrutteres. [Prøveplanen](../.docs/planning-artifacts/USER-TRIAL-PLAN.md#egenutprøving-utført-av-prosjekteier--2026-11-01) avgrenser lukkingen (løst innen dokumentert omfang 2026-11-01).
- [x] 2026-11-01 [Lagring og gjenoppretting](994-2026-10-29-20-26-15-ajour-egenutproving-og-mengdetesting.md) — Egenutprøving utført av prosjekteier: 525 uendrede elementer uten lagringsfeil, 28 Angre-oppføringer og 0 byte vekst; faktisk 6,62 MB-gjenoppretting fra 7 til 6 oppgaver med hele datasettet, historikken, papirkurven og ID-ene bevart etter omlasting. Tre tidsfeil ga norske meldinger og kapasitetsforklaringen ble vist én gang (løst innen dokumentert omfang 2026-11-01).
- [x] 2026-10-26 [Ajour-samordning og publisering](999-2026-10-26-22-07-17-ajour-samordning-og-publisering.md) — Prosjekteierens [refleksjonsrapport](../.docs/submission/reflection-report.md) ble lagt til i repoet 1. november. Etter at Word-kopien ble fjernet, ligger rapporten som Markdown.
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

- [x] 2026-11-03 [Arbeidssteg og teknisk prøving](989-2026-11-03-00-32-35-ajour-arbeidssteg-og-teknisk-proving.md) — Den første prøven planla tid for hele oppgaven slik den skulle. En egen prøve av Start viste at det navngitte steget og det nye anslaget falt bort. Rettingen beholder steget gjennom registreringen, skiller brukt tid fra gjenstående arbeid og støtter eldre data. Codex prøvde sju scenarioer med 20 delkontroller, regresjonstester, CI på `main` og produksjon med syntetiske data (rettet 2026-11-03).

- [x] 2026-11-02 [Fristavklaring og lagringshjelp](991-2026-11-02-12-11-30-ajour-frist-og-hjelp.md) — Det nye fredags-eksemplet er reprodusert og rettet, med atomisk import, uttrykkelige valg og bevaring ved omlasting. Klokkeslett før oppgavebekreftelse og driftsavhengig hjelp er også rettet og prøvd i faktisk Chromium/SQLite (løst innen dette omfanget 2026-11-02). Historisk F03 står fortsatt under [Åpne punkter](#åpne-punkter). Rapporten er funnet, men originalen `stress-text-005.txt` er ikke funnet eller omprøvd.

- [x] 2026-11-01 [AHO / F06](994-2026-10-29-20-26-15-ajour-egenutproving-og-mengdetesting.md) — Årshoppet 2029–2031 er teknisk bekreftet i originalkilden; rettingen bevarer årstall, eksisterende koblinger og Angre. Egenutprøving utført av prosjekteier bekrefter vår 2031 som semester 10 og høst 2031 som 11 i forhåndsvisningen. Ingen AHO-emner ble lagret i denne omprøvingen; selve kildehullet består (etikettavvik løst 2026-11-01).

- [x] 2026-11-01 [Omfang for siste egenutprøving](994-2026-10-29-20-26-15-ajour-egenutproving-og-mengdetesting.md) — Prosjekteieren bestod [sju scenarioer og prøven av navngitt Start 3.–4. november](../.docs/implementation-artifacts/owner-trial-2026-11-04.md). I scenario 7 ble sikkerhetskopien forhåndsvist og gjenopprettet i en tom Chrome-gjesteøkt. Eksporten etter omlasting var identisk med kildekopien. Full omstart av nettleseren og «Gjenopprett forrige kopi» var utenfor prøveomfanget.

### Historisk eksponering

- [x] A-05: GitHub About viser hovedadressen `https://ajour-sooty.vercel.app/`. [Auditoppfølgingen](../.docs/implementation-artifacts/import-sequencing-audit-2026-11-04.md) beholder det daterte HTTP 404-resultatet.

- [x] Historikkopprydding og oppfølging av funn 1–4 er avsluttet. [Oppryddingsrapporten](../.docs/implementation-artifacts/history-cleanup-2026-11-09.md) dokumenterer rensing av 26 publiserte grener og bevaring av dagens filer. Ved kontroll 2026-11-04 mot `43e5cd33d8c374d1161c0d43a0139f25af13cd30` var alle 12 historiske eksempelblobs fortsatt tilgjengelige via referanser. Fullstendig sletting av eldre kopier og sperring av tilgang er ikke bekreftet.

## Status ved kontrollen — 2026-11-04

Se [historisk eksponering](#historisk-eksponering) for oppfølgingen av eldre kopier og GitHub About.

Prosjekteieren bestod alle sju scenarioer og prøven av navngitt Start. Prøven av R-07 bekreftet gjenoppretting i en tom Chrome-gjesteøkt. Prosjekteieren bekreftet omlasting, og filsammenligningen viste at dataene etter gjenoppretting var identiske med kildekopien. [Rapporten](../.docs/implementation-artifacts/owner-trial-2026-11-04.md) beskriver metodeavvikene og den tekniske etterkontrollen.

Ved den tekniske gjennomgangen ble det funnet to feil som oppstod når brukeren byttet fil under import. [Oppfølgingen 4. november](../.docs/implementation-artifacts/import-sequencing-audit-2026-11-04.md) dokumenterer rettingene og testresultatene.
