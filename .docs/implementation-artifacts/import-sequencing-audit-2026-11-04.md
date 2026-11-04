# Importrekkefølge og auditoppfølging — 4. november 2026

Den brukerleverte auditrapporten undersøkte `1c00250d2fc025bf3b67d2a526f10a25bc39dc13` og beskrev to kontrollerte feil ved overlappende filvalg. Denne oppfølgingen retter dem innen eksisterende R-02/R-05/R-06: et forsinket svar skal ikke erstatte et nyere utkast. Tidligere grønne tester dekket ikke disse forløpene. Prosjekteierens [beståtte sjuscenarioprøve](owner-trial-2026-11-04.md) beholdes med sitt faktiske omfang; nye automatiske prøver er ikke nye personlige erfaringer.

[Faglærertilbakemeldingen](../../tilbakemelding-product-brief.md), [briefen](../../brief.md), [PRD](../planning-artifacts/PRD.md) og planindeksen er lest. Arbeidet følger opp testbarhet, synlig retting av KI-assistert kode og ryddig dokumentasjon. Den identifiserte sensor-PDF-en og private arbeidsspesifikasjoner var ikke tilgjengelige for ny lesing. Ingen nye kurskrav, kilder eller V1-funksjoner er oppfunnet.

## Funn og retting

| Funn | Endring og bevisgrense |
| --- | --- |
| A-01: eldre dokument kunne erstatte nyere arbeidsstegforslag | [Arbeidsstegdialogen](../../studieplanlegger/src/work-steps-view.js) gir hver import egen identitet og `AbortController`. Fremdrift, resultat og feil kontrollerer både import, oppgave og dialog. Tekstendring, ny fil, lukking og oppgavebytte ugyldiggjør gammel import og forslag. Gjengitte kontroller kan fortsatt motta resultatet av gjeldende import. |
| A-02: eldre sikkerhetskopi kunne erstatte nyere forhåndsvisning | [Dataverktøyene](../../studieplanlegger/src/data-tools.js) kontrollerer operasjonsidentitet etter filavlesning og ved bekreftelse. Avbrudd, nye filvalg og andre gjenopprettingsdialoger ugyldiggjør gamle svar. Forhåndsvisningen viser valgt filnavn som tekst. Kontroll av endret datagrunnlag og lokal gjenopprettingskopi beholdes. |
| Avhengighetskontroll | [Ajour quality](../../.github/workflows/ajour-quality.yml) kjører nå `npm audit --audit-level=high` for både kjøretids- og utviklingsavhengigheter. Høy/kritisk sårbarhet eller utilgjengelig audittjeneste stopper kontrollen. [Dependabot](../../.github/dependabot.yml) foreslår ukentlige npm-/Actions-oppdateringer uten automatisk integrering. |
| Begrenset Content Security Policy | [Vercel](../../studieplanlegger/vercel.json) og [lokal server](../../studieplanlegger/server/app.js) sperrer objekter og endring av basisadresse med `object-src 'none'; base-uri 'none'`, i tillegg til rammebeskyttelsen. Dette er ikke en komplett skriptpolicy eller generell XSS-attest. Lokal oppstart og dokumentarbeidere beholder sine eksisterende behov. |
| Avgrenset nettleserdekning | [Fire prøver](../../studieplanlegger/tests/cross-browser/core-smoke.spec.js), to i Firefox og to i WebKit, dekker oppstart, oppgave med bare tittel, tema, forhåndsvist gjenoppretting og omlasting. Full Chromium-suite beholdes. Dette er ikke bevis på lik oppførsel i alle nettlesere. |
| Brukerveiledning | Kalenderens eksisterende månedsvisning er tatt med i oversikten. Gjeldende dokumenter peker til denne oppfølgingen uten å endre eldre daterte resultater eller prosjekteierens refleksjon. |

## Regresjoner og faktisk kontroll

- [Sju arbeidsstegprøver](../../studieplanlegger/tests/e2e/own-trial-work-step-import-race.spec.js) dekker omvendt fullføring, gammel feil/fremdrift, avsluttet arbeider, ugyldig nytt filvalg, tekst-/oppgavebytte og ny gjengivelse av dialogkontroller.
- [Åtte sikkerhetskopiprøver](../../studieplanlegger/tests/e2e/own-trial-backup-import-race.spec.js) dekker omvendt fullføring, gammel feil, nyere ventende/ugyldig fil, avbrudd, lokal gjenoppretting og endret lagringsgrunnlag.
- [Fem policyprøver](../../studieplanlegger/tests/unit/static-security-headers.test.js) kontrollerer lokal HTML/ressurser/HEAD, oppstartsmarkør og Vercel-konfigurasjon. [Publiseringsprøven](../../studieplanlegger/tests/remote/core.spec.js) kontrollerer de nye direktivene på faktiske svar.

Alle nye data er syntetiske. Filavlesningen i kappløpsprøvene fullføres kontrollert i feil rekkefølge; den virkelige dialogen, valideringen og lagringen kjøres. Den særskilte arbeiderprøven bruker en kontrollert arbeider for å levere en allerede kølagt fremdriftsmelding etter avbrudd. Dette isolerer rekkefølge og livsløp, ikke alle dokumentparserens egenskaper.

Lokal kontroll og GitHub-/publiseringsresultater føres nedenfor når de foreligger. Nettlesernedlasting feilet lokalt med et ugyldig arkiv; dette er en miljøbegrensning, ikke et bestått nettleserresultat.

## Uavklarte eier- og administratorpunkter

| Punkt | Bekreftet status og konkret neste handling |
| --- | --- |
| A-03: historisk tilgangsmateriale | Den [tidligere avgrensede oversikten](submission-audit-2026-11-01.md#git-historikk-og-gjenstående-oppfølging) står fortsatt åpen. Repo-/kildeeier må vurdere kalender-/møte-/strømmetilgang med riktig tjenesteeier, tilbakekalle ved behov og beslutte eventuell koordinert historikkrydding. Ingen verdier er gjengitt eller forsøkt brukt her. Dagens rene filer og grønne tester lukker ikke historikken. |
| A-04: `main` uten påkrevd kvalitetskontroll | GitHub `branches/main` viste `protected: false` ved denne kontrollen. Tilkoblingen gir kode-/push-tilgang, men ikke administrasjon; nettleserinnlogging ble ikke fullført. Administrator må beskytte `main`, kreve **Ajour quality**, avvise force-push og sletting, uten et kunstig krav om en annen student som reviewer. Ingen innstilling er endret eller påstått aktivert. |
| A-05: About-lenke | GitHub About viser fortsatt `ajour-ajour1.vercel.app`, mens den avtalte hovedadressen er **https://ajour-sooty.vercel.app/**. Administrator må sette About til hovedadressen. Ingen adresse er omdirigert eller fjernet; dette beskytter muligheten til å eksportere data som eventuelt finnes på den andre adressen. Direkte HTTP-kontroll 4. november ga HTTP 200 fra begge adressene uten omdirigering; planene har derfor separate origins. Plattformens aliasinnstillinger er ikke endret. |
| Vercel misbruks-/forbruksgrenser | Eksisterende same-origin-kontroll og budsjetter per forespørsel er ikke en samlet grense for uavhengige forespørsler. Plattformens rate-/samtidighetsgrenser og forbruksvarsler må kontrolleres i det eksisterende gratisprosjektet. Ingen plattforminnstilling eller betalt tjeneste er aktivert. |
| Formelle leveringsopplysninger | Godkjent proposal, overordnet veiledning, konkret frist/klokkeslett, kanal og påkrevd filformat mangler fortsatt i tilgjengelig grunnlag. [Leveringskontrollen](../planning-artifacts/README.md#leveringskontroll--2026-11-04) beholdes. Offisiell beskjed må verifiseres; publisering er ikke faktisk innlevering eller kvittering. |

Dermed kan prosjektet ikke ærlig beskrives som «bare personlig sluttlesing gjenstår» før disse forholdene er avklart. De er skilt fra de rettede kodefeilene, så allerede beståtte prøver ikke gjentas unødig.

## Bevarte grenser

Historisk F03 kan ikke omprøves uten det opprinnelige tekstgrunnlaget. F05 og øvrige kildeformat-/kataloggrenser er fortsatt avgrenset i [brukerveiledningen](../../studieplanlegger/README.md#kjente-begrensninger-ved-levering); de navngitte HiMolde-/NTNU-prøvene utvides ikke. Synkron lokal lagringsadapter, nettleserkvote, én redigerende fane og bundlevarsel er dokumenterte drifts-/arkitekturgrenser. En omfattende asynkron lagringsomlegging eller oppdeling uten målt ytelsesproblem inngår ikke som en skjult «liten retting».

## Kontrollresultater

**Lokal kontroll 4. november, Node 24.22.1 / npm 11.9.0:** Låst installasjon, **2669 enhetstester i 152 filer** og produksjonsbygg bestod. De fem nye policyprøvene inngår i totalen; eksisterende fixtur-/backup-personvernprøver er beholdt. `npm audit --audit-level=high` rapporterte null kjente sårbarheter. Hovedbundle er **961,68 kB / 294,18 kB gzip**, med samme ikke-blokkerende størrelsesvarsel. JavaScript-syntaks og diff-kontroll bestod. Dette lokale kontrollpunktet dokumenterer ikke nettleserkjøring eller publisering; GitHub-resultater er ført separat nedenfor.

**Dokument- og personvernkontroll:** 54 Markdown-filer med 943 relative lenker og 243 ankere uten feil. Alle ti aktive offentlige lenker i README-ene og planindeksen svarte HTTP 200; lokale oppskriftsadresser og historiske referanser inngikk ikke i denne HTTP-kontrollen. Avgrenset scan av 344 dokument-/fixturfiler, inkludert 11 utfoldede ICS-filer og dokumentmetadata, fant ingen nye uavklarte mønstre. Autorisert rapportkontakt, institusjonelle tjenestekontakter, kalender-ID-er og uttrykkelig syntetiske verdier er vurdert separat. Dette er kontroll av dagens filer, ikke hele Git-historikken.

**Første GitHub-kandidat:** `236a37e0f9be8fe78c65ea0485411b6b28f1bd88` bestod installasjon, audit, alle 2669 enhetstester og bygg. [PR-kjøringen](https://github.com/IBE160-2026/G37-yilmaz/actions/runs/41819950733) fikk **169 beståtte og én feilet Chromium-prøve**. Den nye oppgavebytteprøven lot en eksisterende oppgavemeny stå åpen; den dekket neste menypunkt og stoppet testen før importassertene. Testen lukker nå den synlige menyen gjennom vanlig brukerhandling før oppgavebyttet. Appkoden ble ikke endret for å tilpasse testen. Firefox/WebKit og SQLite ble ikke kjørt i dette feilede løpet.

**Endelig kvalitets- og publiseringsbevis:** [PR #24](https://github.com/IBE160-2026/G37-yilmaz/pull/24) samler den siste kandidatens SHA, ferdige kvalitets-/forhåndsvisningsresultater og produksjonsoppfølging. Den første feilede kjøringen over beholdes som historikk og omgjøres ikke til bestått. [GitHub Actions](https://github.com/IBE160-2026/G37-yilmaz/actions) og [produksjonens versjonsmarkør](https://ajour-sooty.vercel.app/release.json) gjør det mulig å kontrollere gjeldende versjon uten å forveksle en dokumentcommit med det tidligere kontrollpunktet.
