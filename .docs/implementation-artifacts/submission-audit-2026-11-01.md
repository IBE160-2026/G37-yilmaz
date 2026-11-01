# Avgrenset leveringskontroll — 1. november 2026

Kontrollen gjelder sluttrapport, samordnet dokumentasjon og eksisterende GitHub-/Vercel-leveranse. Utgangspunktet var fersk `origin/main` **`246e4eb19adc4f673d0a3c57484b5f1539f2a7a7`**, kontrollert mot GitHub og produksjonens `/release.json`. Repoet er **offentlig**. En egen arbeidskopi og gren bevarer eldre arbeidsgrener og private lokale filer. Ingen ZIP erstatter Git-checkoutet; brukerens tidligere ZIP-gjennomgang er bakgrunn, ikke denne kontrollens testbevis.

## Refleksjonsrapport og kildegrunnlag

- [Lesbar rapport](../submission/reflection-report.md) er fremtidig redigerbar hovedtekst; [Word-filen](../submission/reflection-report.docx) er samsvarende eksport. Senere tekstendringer må gjøres i Markdown og eksporteres til Word med ny tekst-/layoutkontroll. Ingen generell eksportverktøykjede eller stilmal er etablert i denne runden: dagens Word-fil er den uendrede originalen, som brukes som layoutreferanse ved senere eksport. Rediger ikke Word-teksten separat.
- Word-filen er byte-identisk med det brukerleverte vedlegget, SHA-256 `4af19a2bdf560f2e274d0a541020b4ca188a0985f7c2d70b76d7784bd9b0a845`. Den er ikke redigert, så ingen ny Word-layout er produsert eller påstått kontrollert.
- Alle **117 avsnitt** har identisk normalisert synlig tekst i Word og Markdown. Alle **31 nummererte hoved-/underoverskrifter** følger rapportmalens struktur. Ingen erfaringer eller faglige vurderinger er lagt til.
- Rapporten oppgir **3562 ord** i kapittel 2–7; tellemetoden bak dette anslaget er ikke dokumentert. En reproduksjonskontroll som deler synlig tekst på mellomrom gir **3530**, inkludert overskrifter, eller 3404 uten overskrifter. Både det oppgitte anslaget og de reproduserte tellingene ligger innen malens **3000–5000 ord**. Originalens anslag er beholdt.
- DOCX-pakken er kontrollert for egenskaper, relasjoner, kommentarer, revisjoner, skjult tekst, innbygginger og miniatyrmetadata. Ingen konkrete unødvendige person-/adgangsopplysninger ble funnet. Forfatteren er prosjekteieren; oppgitt student-e-post og forfatteridentitet er bevisst autoriserte opplysninger. De to eksterne relasjonene er vanlige HTTPS-prosjektlenker uten tilgangsparametere. Tom standardbibliografi og et blankt standardminiatyrbilde inneholder ingen person-/lokasjonsmetadata.

AGENTS, lærerens tilbakemelding 6. oktober, gjeldende brief, planindeks, sesjonslogginstruksjonen, rapportmalen og alle sju sider av den identifiserte sensorveiledningen er lest. Sensor-PDF-ens SHA-256 samsvarer med [planindeksen](../planning-artifacts/README.md#vurderingsgrunnlag-kontrollert-2026-10-16). Mal og sensorvedlegg er ikke publisert. Frist, kanal og obligatorisk filformat er fortsatt ubekreftet. Personlig sluttgjennomlesing og faktisk innlevering med kvittering står åpne.

Rapportmalens SHA-256 er `5ef011358d9567a4b6afa48491db6b1d2275f5ccd3109bed2ac43179a7609c0b`. Ved sluttgjennomlesingen bør prosjekteieren også åpne Word-filen og se over sider, overskrifter og sideskift; XML-kontrollen erstatter ikke slik visuell lesing.

### Kildekart til rapporten

Rapportens kildehenvisninger er uendret. Kartet under identifiserer prosjektfilene i baseline `246e4eb19adc4f673d0a3c57484b5f1539f2a7a7`, som var tilgjengelig ved denne leveringskontrollen. Det påstår ikke at rapportforfatteren brukte akkurat denne commit-utgaven da teksten ble skrevet.

| Rapporthenvisning | Entydige prosjektkilder |
| --- | --- |
| [1] Produkt og teknologi | [Rot-README](https://github.com/IBE160-2026/G37-yilmaz/blob/246e4eb19adc4f673d0a3c57484b5f1539f2a7a7/README.md), [app-README](https://github.com/IBE160-2026/G37-yilmaz/blob/246e4eb19adc4f673d0a3c57484b5f1539f2a7a7/studieplanlegger/README.md), [appens package.json](https://github.com/IBE160-2026/G37-yilmaz/blob/246e4eb19adc4f673d0a3c57484b5f1539f2a7a7/studieplanlegger/package.json) og [arkitektur](https://github.com/IBE160-2026/G37-yilmaz/blob/246e4eb19adc4f673d0a3c57484b5f1539f2a7a7/.docs/planning-artifacts/architecture/architecture-studieplanlegger-2026-09-06/ARCHITECTURE-SPINE.md). |
| [2] Lærerfeedback | [Tilbakemeldingen 6. oktober](https://github.com/IBE160-2026/G37-yilmaz/blob/246e4eb19adc4f673d0a3c57484b5f1539f2a7a7/tilbakemelding-product-brief.md). |
| [3] Prosess, før/etter-resultater og lisens | [Development process](https://github.com/IBE160-2026/G37-yilmaz/blob/246e4eb19adc4f673d0a3c57484b5f1539f2a7a7/.docs/implementation-artifacts/development-process.md), [VERIFICATION](https://github.com/IBE160-2026/G37-yilmaz/blob/246e4eb19adc4f673d0a3c57484b5f1539f2a7a7/studieplanlegger/VERIFICATION.md), [USER-TRIAL-PLAN](https://github.com/IBE160-2026/G37-yilmaz/blob/246e4eb19adc4f673d0a3c57484b5f1539f2a7a7/.docs/planning-artifacts/USER-TRIAL-PLAN.md) og [Manrope OFL](https://github.com/IBE160-2026/G37-yilmaz/blob/246e4eb19adc4f673d0a3c57484b5f1539f2a7a7/studieplanlegger/public/fonts/OFL.txt). SC-07 og lagring/gjenoppretting har daterte seksjoner 1. november; eldre feil beholdes. |
| [4]–[5] Undervisningsmateriale | Rapportens egne kildeopplysninger beholdes. Presentasjonen og brief-malen er ikke kontrollert som separate kilder i denne leveringsrunden og publiseres ikke her. |

## Dagens filer og leveringsutvalg

Baseline omfatter **805 sporede filer**: 800 tekstfiler, én DOCX, én PDF og tre fontbinærer. Ingen gitleaks/trufflehog var installert; kontrollen brukte en lokal mønsterscanner og repoets eksisterende strukturelle hjelpere i [fixture-privacy.js](../../studieplanlegger/tests/helpers/fixture-privacy.js), med manuell vurdering av treff. Den omfattet nøkler/tokens, cookies/autorisasjon, URL-parametere, private kalender-/møteadresser, brukerbaner, personfelt og dokumentmetadata. HTML-entiteter og URL-koding ble dekodet; **11 ICS-filer** ble kontrollert etter utfolding av logiske linjer. **281 HTML-/JSON-/ICS-/PDF-fixturer** bestod strukturell kontroll uten funn eller parserfeil. PDF-fixturens sju sider og egenskaper ble lest; DOCX-fixturen har bare de tre forventede XML-delene.

**Resultat:** Ingen nye bekreftede reelle nøkler/tokens, private brukerbaner eller unødvendige personfelt ble funnet i dagens kontrollerte filer. Ingen kildefixture måtte derfor endres. Mønstertreff på syntetiske sikkerhetstester, kalender-UID-er, offentlige institusjonslenker/-kontaktpunkter, kildehenvisninger, lisensopplysninger og bevisste forfatteropplysninger ble vurdert separat og beholdt. Dette er en avgrenset kontroll, ikke en full sikkerhetsgodkjenning.

Rapportens to filer er et presist unntak i `.gitignore`; andre filer under `.docs/submission/` ignoreres. Eldre `project-reflection.md`, rålogger, personlige testdata, sikkerhetskopier, databaser og nettleserprofiler forblir ignorert. Kursmateriale, ZIP og private rapportvedlegg inngår ikke. De tilsiktede DOCX-/PDF-fixturene, kuraterte logger, agentinstruksjoner og fontlisenser beholdes.

## Git-historikk og gjenstående oppfølging

Etter `git fetch origin` ble **21 lokale refs**, **89 ref-tilgjengelige commits**, **2244 ref-tilgjengelige objekter** og **1683 ref-tilgjengelige blobs** undersøkt. I tillegg ble hele det lokale objektlageret lest: **2648 objekter**, herunder **90 commits, 522 trær og 2036 blobs**. Det omfatter reflog og **353 blobs utenfor dagens refs**. Klonen er ikke grunn; ingen delvis klon-konfigurasjon eller manglende objekter ble funnet. Tellingen beskriver utgangspunktet før denne leveransens nye commits.

Historikken bekrefter eldre unødvendige personopplysninger og kopiert kalender-/tilgangsmateriale. Utvalgte gjenfinnbare posisjoner oppgis uten verdier; blob-ID identifiserer historisk versjon, ikke dagens fil:

| Kategori | Historisk fil | Posisjon / blob |
| --- | --- | --- |
| Kalenderlenke med adgangsparameter | `studieplanlegger/tests/fixtures/public-programs/fih-calendar-html.html` | Linje 2 og videre; `a471c2b87a7ac2c2cdc0fbaa7b68fbc260b02d80`. |
| Kalenderlenke med adgangsparameter | `studieplanlegger/tests/fixtures/public-programs/fih-calendar-links.json` | Linje 7 og videre; `4c168086f6f311182564f2d970b3eb88f00d9308`. |
| Møteadgangslenker | `studieplanlegger/tests/fixtures/public-timeedit/ldh-calendar.ics` | Utfoldede linjer 1086, 1094 og 1102; `97950a36cf735cdb91b4b3518442d234c43326db`. |
| Tokenparameter i strømmelenke | `studieplanlegger/tests/fixtures/phs-programs/bachelor.html` | Dekodet linje 157; `529e37d921cdcc60e2f52f42149e8cba1a4df23f`. |
| Mottakermetadata i SafeLinks-adresse | `studieplanlegger/tests/fixtures/phs-programs/bachelor-cohorts.html` | Dekodet linje 74; `298230d52cbfe6dfa1f9790dd20dfe079da09045`. |
| Kontakt-/profilblokk | `studieplanlegger/tests/fixtures/business-programs/nhh-accounting.html` | `$.person-block[0]`; `5ce9c35a74f710b69226024bfbcf1fdb62fe604b`. |
| Personmetadata i HTML | `studieplanlegger/tests/fixtures/samas-programs/catalogue-nb.html` | `$.meta[13]`; `522ff9a9f9da61cb3f9a7979fc77ecda41522f2d`. |
| Underviserfelt i kalender | `studieplanlegger/tests/fixtures/public-programs/timeedit-hvl-dat100-2026.ics` | `event[0].DESCRIPTION[0]`; `2234c710984f1bb7af7ed3b87be625ff427299eb`. |
| Personvalg/-attributter i HTML | `studieplanlegger/tests/fixtures/public-timeedit/nih-schedule.html` | `$.person-filter[12].option[0]` og `node[3].attribute[0]`; `8657c584826e302372bee4cd13f93f3654fd9989`. |
| Personfelt i JSON | `studieplanlegger/tests/fixtures/public-tp/himolde-events.json` | `$.field[0][0].field[14]`; `a9c83e470f43501b0073ae443c304f4aef8b3a2b`. |
| PDF-forfatter og XMP-personmetadata | `studieplanlegger/tests/fixtures/uit-programs/pdf/868803.pdf` | `info.Author` og `xml.metadata`; `cd6542819d8ca2f66e89892c316beec819396c0b`. |
| Lokal brukerbane | `studieplanlegger/VERIFICATION.md` | Linje 286; `389ddfb3c252e966d8e9dd5f6fbd6363a58effcc`. |

Gyldighet, rettigheter og eventuell fortsatt tilgang for de kopierte adgangsverdiene er **ikke testet eller fastslått**. Repo-/kildeeier må vurdere eventuell tilbakekalling med rette tjenesteeier. Ingen verdi er prøvd mot en tjeneste, og ingen tilbakekalling er utført. De tidligere rettingene i dagens tre fjerner ikke gamle Git-objekter. Historikkomskriving og force-push er ikke utført; et eventuelt slikt tiltak må beskrives konkret og godkjennes særskilt. Historikken erklæres derfor ikke ren.

**Hull:** GitHub-refene som bare tilhører PR-er er ikke særskilt hentet; andre serverobjekter, slettede remote-objekter, forks og tjenestecacher er ikke undersøkt. Tre historiske PDF-versjoner er strukturkontrollert; 73 historiske PNG-objekter er kontrollert for tekst-/EXIF-metadata uten treff. Synlig innhold i historiske bilder er verken visuelt gjennomgått eller OCR-lest. Fontbinærer er bevart sammen med lisensen, uten en generell binær sikkerhetsanalyse. Verken mønstermatching eller strukturelle regler kan utelukke alle mulige hemmeligheter eller personopplysninger.

### Metode og gjentakelse

Utvalget ble etablert med `git for-each-ref --format='%(refname) %(objectname)'`, `git rev-list --objects --all`, `git rev-list --objects --all --reflog` og `git cat-file --batch-all-objects --batch-check`. Blobinnhold ble lest internt med `git cat-file --batch`; bare kategori, fil, blob-ID og posisjon ble skrevet til diagnostikk. Indexkontrollen bruker `git diff --cached --name-only --diff-filter=ACMR -z` og leser hver blob fra index. Ingen matchingverdi skrives ut. Senere kjøringer av disse kommandoene gir datidens lokale utvalg; flyttede refs og Git-opprydding kan endre antall og tilgjengelighet.

Den lokale scanneren behandlet rå UTF-8-tekst og varianter etter HTML-/URL-dekoding, normaliserte JSON-escapes for URL-er og foldet ut ICS-linjer før mønstermatching. Den søkte etter private nøkkelmarkører, kjente leverandørtoken-former/JWT, autorisasjons-/cookie-tildelinger, adgangsparametere, kalender-/møteadresser, e-post og brukerbaner. DOCX ble åpnet som ZIP med kontroll av XML, relasjoner og egenskaper; PDF ble lest med prosjektets låste `pdfjs-dist`. Repoets strukturelle fixturekontroll og manuell felt-/kontekstvurdering skilte reelle funn fra syntetiske data og nødvendig attribusjon. Lokale scripts og diagnostikk er arbeidsmateriale, ikke en ny fullverdig secretscanner eller publiserte rålogger.

## Kontroller og publiseringsløp

- `npm ci`: låst installasjon bestod; npm rapporterte null kjente avhengighetssårbarheter ved kjøringen. Dette er ikke en generell sikkerhetsattest.
- `npm run test:unit`: **2529/2529 tester i 147 filer**, inkludert eksisterende fixture-/lagrings-/releasekontroller.
- `npm run build`: bestått. Kjent bundlevarsel består: **957,30 kB / 292,79 kB gzip** for hovedfilen; ingen numerisk V1-grense er avtalt.
- Rapportkontroll: byteidentitet, normalisert tekstlikhet, kapitler, ordtelling og metadata bestod. Ingen Word-redigering eller PDF-produksjon.
- Vercel `deploy --dry`: **190 filer**, ingen `.docs`, `.logs` eller rapportfiler. `.vercelignore`, appens runtime, CI og `build:release` er uendret.

Stagingkontrollen leste de **13 gjennomgåtte index-blobbene** før dokumentcommit: tolv tekstfiler og rapportens DOCX. De fire rapporterte mønstertreffene var ett for forfattermetadata, ett for e-post i DOCX, ett for e-post i Markdown og ett samlet treff på DOCX-relasjonsfilen med de to offentlige prosjektlenkene. Alle er autoriserte; ingen korrigering var nødvendig. Før den supplerende metode-/kildepresiseringen bestod Markdown-kontrollen **40 dokumenter, 651 lokale lenker og 138 ankre**; `git diff --cached --check` bestod. Separate loggendringer og endelig dokumentutvalg kontrolleres på samme måte og registreres i sesjonsloggen. Historisk eksponering er et eget åpent oppfølgingspunkt; dagens grønne tester lukker det ikke.

Eksisterende Vercel-prosjekt **ajour** er koblet til `IBE160-2026/G37-yilmaz`, produksjonsgren `main`, rot `studieplanlegger`, Node 24 og `npm run build:release`. Prosjektets faktiske **Ajour quality**-sjekk sperrer domenetildeling for både preview og produksjon. GitHub oppgir ingen aktiv grenbeskyttelse på `main`; denne leveransen bruker likevel PR og venter på hele den eksisterende kvalitetssjekken, inkludert nettleser- og SQLite-prøvene. Ingen sperre eller assertion endres.

Et grønt bygg er ikke alene produksjonsbevis. Etter siste commit må full main-SHA sammenlignes med produksjonens `/release.json`, eksisterende automatisk `Ajour deployment smoke` følges, og appen lastes i isolert syntetisk profil. CI-/deploy-resultater finnes i [GitHub Actions](https://github.com/IBE160-2026/G37-yilmaz/actions); datert oppfølging føres i sesjonsloggen. [Brukerveiledning og kjente begrensninger](../../studieplanlegger/README.md), [prøveplan](../planning-artifacts/USER-TRIAL-PLAN.md) og [planindeks](../planning-artifacts/README.md) beholder skillet mellom automatikk, egenutprøving og faktisk innlevering.
