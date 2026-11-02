# Ajour – sluttrapport og leveringskontroll

## 2026-11-01 kl. 22:34 — GOplayer007

### Oppgave

Ferdigstille den eksisterende GitHub-/Vercel-leveransen med brukerens ferdige refleksjonsrapport, avgrenset fil-/historikkontroll og samordnet dokumentasjon. Oppdraget autoriserer commit, push, PR, integrering etter bestått CI og publisering i eksisterende ajour-prosjekt; ingen nye funksjoner, ny generell egenutprøving eller innlevering på eierens vegne.

### Plan

- Lese AGENTS, lærerfeedback, gjeldende brief/planindeks, identifisert sensorveiledning og rapportmal; videreføre [tidligere dokumenterte egenresultater](994-2026-10-29-20-26-15-ajour-egenutproving-og-mengdetesting.md).
- Bevare urelaterte arbeidsgrener, private kladder og runtime-data i en egen arbeidskopi fra aktuell main. Bruke BMAD, avgrenset parallell kontroll og uavhengig gjennomgang.
- Følge [audit og leveringskontroll](../.docs/implementation-artifacts/submission-audit-2026-11-01.md), eksplisitt staging, eksisterende CI og publiseringssperrer. Kontrollere endelig produksjonsmarkør og isolert nettleser etter denne separate loggcommiten.

### Resultat

Utgangspunktet var offentlig repo og main-/produksjonscommit `246e4eb19adc4f673d0a3c57484b5f1539f2a7a7`. Dokumentcommit **`5b7f2d3c1b27dd3ef6a9e7f74f8e4c53c048c205`** er pushet i [PR #11](https://github.com/IBE160-2026/G37-yilmaz/pull/11). Den inkluderte [lesbar rapport](../.docs/submission/reflection-report.md), Word-fil, samordnede README-/plan-/prosessdokumenter, verifikasjon og et presist sluttrapportunntak i `.gitignore`. Word-kopien ble senere fjernet etter prosjekteierens ønske; Markdown er nå eneste rapportformat i repoet. Rapportpunktet i issues er lukket for innarbeiding; personlig sluttgjennomlesing er et eget åpent punkt. Malens 3000–5000 ord er nå kjent; frist, kanal og obligatorisk filformat er fortsatt ubekreftet.

Den daværende Word-filen var byte-identisk med vedlegget. Alle 117 avsnitt og 31 nummererte overskrifter samsvarte med Markdown/malen. Den reproduserte tellingen ga 3530 ord i kapittel 2–7 inklusive overskrifter; originalens selvoppgitte 3562 er bevart. Metadata-/pakkeinspeksjon fant ingen konkrete unødvendige opplysninger; godkjent forfatteridentitet/student-e-post og KI-opplysning beholdes. Ingen Word-redigering, ny personlig historie eller PDF ble laget. Disse kontrollene er historiske etter at Word-kopien ble fjernet; rapporten inngår fortsatt bare i GitHub-dokumentasjonen.

Baselinekontrollen omfattet 805 sporede filer, 281 strukturelle fixturer og 11 utfoldede ICS. Ingen nye bekreftede funn i dagens filer krevde fixtureendring. Historikken omfattet 21 refs og 89 commits, utvidet til alle 2648 lokale objekter / 2036 blobs og 90 commits inkludert reflog. Eldre person-/tilgangsopplysninger og brukerbaner ble bekreftet uten å gjengi verdier. Ingen nøkkel eller lenke er prøvd mot en tjeneste, ingen tilgang er tilbakekalt og ingen historikk er omskrevet. PR-only refs, eksterne serverobjekter/forks/cacher og synlig innhold i historiske bilder er blant de oppgitte hullene.

Lokal låst installasjon, **2529/2529 enhetstester i 147 filer**, produksjonsbygg, rapportkontroll, eksplisitt stagingkontroll og Markdown-fil-/ankerlenker bestod. Dokumentcommiten ble kontrollert med 40 dokumenter, 651 lokale lenker og 138 ankre. De fire stagingtreffene var godkjent rapportmetadata/e-post og offentlige prosjektrelasjoner. Uavhengige gjennomganger førte til presiseringer av tellemetode, kildespor og auditgrenser; ingen runtime-endring var nødvendig. Vercel-tørrkontroll omfattet **190 filer uten rapport/.docs/.logs**. Bundlevarselet på 957,30 kB / 292,79 kB gzip står igjen.

Eksisterende `ajour` er GitHub-koblet til main, med Node 24, `build:release` og **Ajour quality** som domenesperre for preview/produksjon. Ingen CI, nettleser-/SQLite-prøve eller assertion er fjernet eller svekket. Loggcommiten inngår i samme PR; **commitbundne CI- og sluttpubliseringsresultater samles i [PR #11](https://github.com/IBE160-2026/G37-yilmaz/pull/11)** og [GitHub Actions](https://github.com/IBE160-2026/G37-yilmaz/actions). Den endelige hovedgren-/produksjonskontrollen gjøres etter denne loggcommiten, slik at loggen ikke bruker sin egen commit-hash eller et eldre grønt bygg som produksjonsbevis. Tidligere personlige SC-07-/Outlook-resultater beholdes separat.

### Åpne punkter

- Prosjekteierens sluttgjennomlesing, kontroll av offisiell frist/kanal/format og innlevering med kvittering; disse er ikke bekreftet utført.
- Repo-/kildeeiers vurdering av historisk eksponering og eventuell tilbakekalling; eventuell historikkomskriving krever et særskilt konkret oppdrag.
- Eksisterende NTNU-/UiT-grenser, F03/F05, nettleserkvote, bundlevarsel og tidligere prøvedekning beholdes i [issues](issues.md). Full nasjonal dekning er fortsatt visjon, ikke et nytt V1-krav.

## 2026-11-01 kl. 23:33 — GOplayer007

### Oppgave

Prosjekteieren ba om en avgrenset oppfølging: behold refleksjonsrapporten bare som Markdown, rett de tre Manrope-filnavnene til faktisk fontformat og fullfør eksisterende GitHub-/Vercel-flyt. Rapportteksten og de tre uttrykkelig beskyttede testfixturene skulle forbli uendret; ingen nye funksjoner eller generell egenutprøving.

### Plan

- Følge AGENTS, brief, planindeks, lærerfeedback, tilgjengelig sensorveiledning og BMAD. Oppfølgingen gjelder repoorden, sporbarhet og kontroll av KI-rettinger.
- Arbeide i en separat Git-arbeidskopi fra fersk main, sammenligne fontdata og rapport-/fixturebytes mot utgangspunktet, og samordne aktuelle og historiske dokumenthenvisninger.
- Kjør relevante automatiske kontroller, før denne separate loggcommiten inn i samme PR og følg uendrede CI-/publiseringssperrer til kontroll av faktisk produksjon.

### Resultat

Utgangspunktet var main og produksjon **`17096603fb79487da4056c336dc976073ad3cf37`**. Oppryddingen er committet som **`0f99d8dae144349914af2d9805623df799375ca3`** i [PR #12](https://github.com/IBE160-2026/G37-yilmaz/pull/12). Andre lokale arbeidsgrener og endringer er bevart.

De tre fontene var TrueType med signaturen `00010000` og `glyf`/`loca`-tabeller. `git mv` omdøpte dem til `.ttf` med 100 % byteidentitet; CSS, Node-serverens MIME-kart og eksisterende databaseprøve følger de nye adressene. Vektene 400/500/600, `format('truetype')`, OFL-lisensen og støtte for andre MIME-typer er bevart. Testen kontrollerer alle tre svarenes HTTP-status, `font/ttf`, `nosniff` og TrueType-signatur.

[Markdown-rapporten](../.docs/submission/reflection-report.md) er uendret. Word-kopien og bare dens ignoreringsunntak er fjernet. README-er, planindeks, prøveplan, sporbarhet, epics, guider, audit, verifikasjon og statusoversikt presenterer Markdown som eneste gjeldende rapportformat. Historiske Word-kontroller er bevart med vanlig tekst og forklaring om senere eierbestilt fjerning; ingen lenke peker til den slettede filen. Private kladder forblir ignorert. `connected-semester.docx`, `uit-programs/pdf/868803.pdf` og `public-pdf-hung.worker.js` er byte-identiske med utgangspunktet.

Bestått lokalt: låst installasjon, **2529/2529 enhetstester i 147 filer**, produksjonsbygg og **3/3 SQLite-/nettleserprøver**. Etter uavhengig gjennomgang ble fontsignaturassertionen lagt til, og den berørte databasesuiten bestod på nytt med 3/3. Alle tre lokale fontadresser returnerte identiske originalbytes. Isolert Chromium lastet fontene gjennom appens faktiske CSS; tekstmålinger og fontprøvebildet var identiske før og etter. Metoden står i [verifikasjonen](../studieplanlegger/VERIFICATION.md#fontnavn-og-markdown-som-eneste-rapportformat--2026-11-01). Ingen ekte profil eller database ble brukt.

Markdown-fil-/ankerlenkekontrollen og gjennomgangen av 332 dokument-/fixturefiler med 11 utfoldede ICS bestod. Stagingkontrollen av oppryddingscommiten ga fire mønstertreff, alle på uendrede emne-/programkodefelt i syntetiske tester; ingen reell tilgangsverdi ble påvist. `git diff --cached --check` bestod. Dette er avgrensede filkontroller, ikke en ny kontroll av Git-historikken eller en generell sikkerhetsgodkjenning.

Ingen CI, publiseringssperre, `build:release`, lagringsformat eller brukerdata er endret. Ingen Outlook-prøve eller generell egenutprøving er gjentatt. **Endelige CI-resultater, merge-SHA, produksjonens `/release.json`, de tre publiserte TTF-adressene og automatisk etterkontroll dokumenteres i [PR #12](https://github.com/IBE160-2026/G37-yilmaz/pull/12) etter denne loggcommiten.** Det unngår å bruke et eldre bygg som bevis for siste leveranse.

### Åpne punkter

- Ingen nye produktpunkter fra denne oppryddingen. Eksisterende begrensninger, bundlevarsel og historisk eksponering står fortsatt i [issues](issues.md).
- Prosjekteierens personlige sluttgjennomlesing av Markdown på GitHub og kontroll av offisiell innleveringsbeskjed/innlevering med kvittering er fortsatt ikke bekreftet. Word-layoutkontroll er ikke lenger et restpunkt.
