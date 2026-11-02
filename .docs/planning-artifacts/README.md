# Ajour: planlegging og leveranseevidens

**Teknisk oppfølging 2026-11-02:** [Oppgave- og stegidentitet](../implementation-artifacts/work-step-identity-2026-11-02.md) avklarer den første Codex-rapportens testantakelse og dokumenterer den separate navngitte Start-flyten, retting og tekniske kontroller. Oppgavearbeid er fortsatt gyldig uten stegkobling. Codex-prøvene erstatter ikke prosjekteierens R-07; eldre daterte resultater beholdes.

**Leveringsoversikt oppdatert 2026-11-01.** [Brief](../../brief.md) og [PRD](PRD.md) beskriver produktmål, brukerbehov, krav og avgrensninger. V1 og krav-/story-ID-er er uendret. Hovedreisen er **oppgave → valgfritt arbeidssteg → godkjent studieøkt → utfall → justering**.

**[Åpne Ajour på nett](https://ajour-sooty.vercel.app/) — Ingen installasjon nødvendig.** [Brukerveiledningen](../../studieplanlegger/README.md#kom-i-gang-og-finn-frem) forklarer de første stegene og sikkerhetskopi. Nettutgaven lagrer planen i nettleserprofilen på den nøyaktige adressen, uten konto eller synkronisering. [Lokal Node-/Docker-drift med SQLite og Vite-utvikling med nettleserlagring](../../studieplanlegger/README.md#lokal-drift-og-utvikling) er egne alternativer for sensor og utviklere.

**Egenutprøving utført av prosjekteier:** De rapporterte omprøvingene 1. november er bestått innen [dokumentert omfang](USER-TRIAL-PLAN.md#egenutprøving-utført-av-prosjekteier--2026-11-01). SC-07/1200–30 og Outlook-prøven fra 30. oktober beholder bestått. [Refleksjonsrapporten](../submission/reflection-report.md) foreligger; personlig sluttgjennomlesing og innlevering er ikke bekreftet. Ingen andre testpersoner rekrutteres; den tidligere planlagte eksterne studentprøven ble ikke gjennomført. Resultatene dokumenterer prosjekteierens observasjoner, ikke ukjente brukeres forståelse eller generell studentnytte. Eldre daterte avvik og tekniske rapporter beholdes som før-/etter-bevis.

Planene ble **rekonstruert 2026-10-16** mot kodegrunnlag `1a58ffce782fd4e42a7153e21e82fc982ae00268`. De er ikke opprinnelige planer for allerede skrevet kode. Revisjonen følger opp lærerens krav om avgrenset V1, sjekkbare kriterier, tekniske detaljer i arkitekturen og synlig kontroll av KI-generert arbeid.

**PRD-presisering 2026-11-02:** [Gjeldende PRD](PRD.md) skiller de tre planleggingsfunksjonene og synliggjør eksisterende bruksgrenser og nyttehypoteser. SC-07/R-07/S-07 beholder sjuscenariokravet, men full oppfyllelse av alle opprinnelige detaljer er ikke dokumentert. [Scenariooversikten](USER-TRIAL-PLAN.md#scenario-dekning-2026-11-02) viser grunnlaget; de avgrensede omprøvingene beholder bestått. V1, tidligere resultater og bestillingen om egenutprøving er uendret.

## Finn leveransen

| Status / behov | Autoritativ inngang |
| --- | --- |
| Ferdig og dokumentert: produkt, oppstart og bruk | [Ajour på nett](https://ajour-sooty.vercel.app/), [README](../../README.md), [brukerveiledning](../../studieplanlegger/README.md#kom-i-gang-og-finn-frem) og [løsningsguide](../implementation-artifacts/solution-guide.md). Lokal kjøring er valgfri. |
| Ferdig og dokumentert: prosjekteierens egenutprøving | [Prøveplan og sluttresultater](USER-TRIAL-PLAN.md#egenutprøving-utført-av-prosjekteier--2026-11-01). De konkrete avvikene er lukket innen oppgitt omfang; den opprinnelige scenariooppskriften utvides ikke til udokumenterte beståttresultater. |
| Automatiske kontroller og publisering | [VERIFICATION](../../studieplanlegger/VERIFICATION.md) skiller automatiske tester, CI og kontroll av publisert commit fra eierens manuelle observasjoner. Funksjonsprøver alene bekrefter ikke produksjonscommit, interne skriveoperasjoner eller full sikkerhet. |
| Kjente begrensninger | [Samlet begrensningsoversikt](../../studieplanlegger/README.md#kjente-begrensninger-ved-levering) med status, V1-betydning og oppfølging; [importdekning](../../studieplanlegger/IMPORT-COVERAGE.md) gir kildegrunnlaget. Historisk F03, F05, personvernfunn og bundlevarselet står åpne. Den [rettede fredags-/fristregresjonen 2. november](../../studieplanlegger/VERIFICATION.md#fristavklaring-oppgavebekreftelse-og-lagringshjelp--2026-11-02) lukker ikke historisk F03; originalen `stress-text-005.txt` er ikke funnet eller omprøvd. |
| Prosess, krav og sporbarhet | [Utviklingsprosess](../implementation-artifacts/development-process.md), dokumentlisten nedenfor og [sporbarhetsmatrisen](TRACEABILITY.md). |
| Refleksjonsrapport foreligger | [Lesbar Markdown-rapport](../submission/reflection-report.md), med prosjekteierens uttrykkelige tillatelse til inkludering i repoet. Markdown er rapportens eneste format i dagens repo. |
| Prosjekteieren må fullføre | Personlig sluttgjennomlesing, kontroll av formelle leveringsopplysninger og selve innleveringen med kvittering. Se [vurderingsgrunnlag og manglende opplysninger](#leveringskontroll--2026-11-01). Ingen ny full funksjonsprøve er bestilt. |

Full nettleseromstart og separat tom profil ble ikke verifisert i prosjekteierens siste omprøving. Tidligere, separat dokumenterte tekniske kontroller beholder sin egen dato og metode; de omgjøres ikke til personlige resultater. Den samme grensen gjelder sikkerhetsprøver som tidligere ble stoppet av verktøyvern.

## Gjeldende dokumenter

Sensorvedleggets sju sider er lest på nytt 2026-11-01, med samme SHA-256 som identifikasjonen nedenfor. Det etterspør dokumenterte manuelle tester eller testplaner der automatisering ikke passer; ekstern studentrekruttering er ikke et krav i dette vedlegget. PRD-forberedelsenes seks spørsmål er tidligere brukt slik de er gjengitt i prosjekteierens oppdrag; selve lærerbildet er ikke kontrollert som separat vedlegg i denne runden. Godkjent proposal og overordnet veiledning er fortsatt ikke identifisert.

1. [Autoritativ brief i roten](../../brief.md): problem, hypotetisk bruker, avgrensning og SC-01–SC-07.
2. [Gjeldende PRD](PRD.md): krav R-01–R-08 og kvalitetskrav Q-01–Q-03.
3. [Gjeldende epics og stories](EPICS-CURRENT.md): S-01–S-08 med Given/When/Then.
4. [Arkitektur](architecture/architecture-studieplanlegger-2026-09-06/ARCHITECTURE-SPINE.md): gjeldende beslutninger og tydelig merket historikk.
5. [Sporbarhet](TRACEABILITY.md): forventet resultat, metode, kode, test og faktisk evidensstatus.
6. [Prøveplan og egenutprøving](USER-TRIAL-PLAN.md): opprinnelig scenariooppskrift, rapporterte avvik og eierens beståtte omprøvinger med dato og avgrensning.
7. [Importavtale og brukerflyt](../../studieplanlegger/IMPORT.md): forhåndsvisning, identiteter, emnevalg, tidspunkt og kildenes grenser.
8. [Kuratert TP CSV-formatkontrakt, 2026-10-23](../implementation-artifacts/tp-csv-format-contract-2026-10-23.md): offentlig formatgrunnlag og avgrensning mot private originalfiler.
9. [Daterte kontrollresultater](../../studieplanlegger/VERIFICATION.md): konkrete feil, rettelser, tester og begrensninger. Testkode er lenket fra sporbarheten; interne arbeidsspesifikasjoner beholdes lokalt og er ikke del av den offentlige dokumentkjeden.
10. [Refleksjonsrapport – Markdown](../submission/reflection-report.md): prosjekteierens ferdige rapporttekst med oppgitt KI-hjelp til struktur og formulering; personlig sluttgjennomlesing er et separat restpunkt.

[Oppstart](../../README.md), [løsningsguide](../implementation-artifacts/solution-guide.md), [utviklingsprosess](../implementation-artifacts/development-process.md), [importdekning](../../studieplanlegger/IMPORT-COVERAGE.md) og [verifikasjon](../../studieplanlegger/VERIFICATION.md) supplerer planen. [Faglærertilbakemeldingen](../../tilbakemelding-product-brief.md) og hele sensorveiledningen er kontrollert ved publiseringsoppfølgingen 2026-10-16.

## Godkjent driftsutvidelse — 2026-10-29

[Teknisk sluttkontroll samme dato](../../.logs/995-2026-10-29-15-37-33-ajour-teknisk-sluttkontroll.md) dokumenterer den rundens CI, domenesperre, sikkerhetsretting, preview, målinger og isolerte gjenopprettingsøvelse. [Hel HiMolde-programgjentakelse](TRACEABILITY.md#hel-himolde-programgjentakelse--2026-10-29) er kontrollert med syntetiske kilder. Disse daterte tekniske kontrollene er separate fra senere egenutprøving.

[Briefen](../../brief.md), [PRD-en](PRD.md) og [AD-16](architecture/architecture-studieplanlegger-2026-09-06/ARCHITECTURE-SPINE.md#ad-16--browser-deployment-with-bounded-stateless-imports-2026-10-29) beskriver den uttrykkelig godkjente nettleserutgaven i ett gratis Vercel-prosjekt. Hele hovedflyten og lokale Node-/Docker-valg beholdes. Nettutgaven har nettleser-/adresselokal lagring og avgrensede importfunksjoner, uten konto, skydatabase eller synkronisering. Historiske lokalavgrensninger er datert; importløftet og krav-ID-ene endres ikke. [Verifikasjonen fra 29. oktober](../../.logs/997-2026-10-29-13-35-00-ajour-vercel.md) dokumenterer den rundens publisering, adskilt fra tidligere klargjøring og lokale prøver.

## Leveringskontroll — 2026-11-01

[Faglærertilbakemeldingen 6. oktober](../../tilbakemelding-product-brief.md) og den identifiserte sensorveiledningen er tilgjengelige og lest. Denne dokumentoppfølgingen adresserer avgrenset V1, produktmål i brief/PRD, sporbare testbevis og synlig styring av KI-arbeidet. Ingen ny funksjon eller kilde er lagt til som leveransekrav.

Sensorveiledningen beskriver vurdering av repoets siste commit før innleveringsfristen (s. 2), kjøring etter README (s. 2 og 5–6), prosess-/KI-spor og relevante manuelle og automatiske tester (s. 2–4). Del 1 teller 70 prosent; personlig refleksjon i del 2 teller 30 prosent (s. 1 og 7). Dette bekrefter vurderingsområdene, ikke at innleveringen allerede er godkjent.

**Bekreftet rapportgrunnlag:** Den brukerleverte `reflection-report-template (1).md` angir **3000–5000 ord**, med gruppeinformasjon, utviklingsprosess, utfordringer, kritisk KI-vurdering, etiske og teknologiske implikasjoner, konklusjon/personlig refleksjon og valgfrie vedlegg. Malen brukes som arbeidsgrunnlag og legges ikke i repoet. [Sluttrapporten](../submission/reflection-report.md) foreligger bare som redigerbar Markdown-rapport i repoet.

**Mangler i tilgjengelig grunnlag:** Godkjent proposal og den overordnede sensorveiledningen er ikke identifisert. Konkret leveringsdato/klokkeslett, innleveringskanal og obligatorisk filformat er fortsatt ikke bekreftet. Prosjekteieren må kontrollere disse opplysningene i emnets offisielle innleveringsbeskjed, sluttlese rapporten og gjennomføre innleveringen med kvittering. Ingen av disse handlingene ferdigmeldes her. Det innføres ikke oppdiktede krav om PDF, zip-fil, video eller nye tester. En publisert Vercel-side erstatter ikke selve innleveringen.

Rapporten bygger på prosjekteierens leverte tekst og egne svar; opplysningen om KI-hjelp til struktur og formulering beholdes. [Utviklingsprosessen](../implementation-artifacts/development-process.md) er separat dokumentasjon av hendelser og kontroll, og teknisk teststatus erstatter ikke personlig refleksjon.

## Vurderingsgrunnlag kontrollert 2026-10-16

- Tilbakemeldingen av 2026-10-06 vurderer brief ved `5e23204` og angir konkrete rettelser for G37.
- «Sensorveiledning IBE160 - Del 1 applikasjon og prosess.pdf», høst 2026, sju sider, er lest i sin helhet som brukerlevert lokalt vedlegg. SHA-256: `a0069856666a32e2e5c886fe1c46ade1d666a99bf800bc42b9e20113adc2e509`. PDF-en er ikke lagt i Git; identifikasjonen gjør det mulig å kontrollere samme utgave uten personlige filstier. Framtidige oppdrag må få tilgang til vedlegget eller relevant offisiell utgave, ikke behandle dette sammendraget som hele kilden.
- [Vurderingsområdene med bevis og mangler](TRACEABILITY.md#sensorveiledningens-sju-områder) bruker de veiledende vektene uten å sette karakter. Veiledningen vurderer del 1 (70 % av mappen); personlig refleksjon tilhører del 2. Den er et grunnlag for faglig skjønn, ikke en automatisk godkjenning.

Godkjent proposal og den overordnede sensorveiledningen som PDF-en viser til, er ikke identifisert i denne kontrollen. Briefen beholdes som autoritativ inngang i roten; PDF-en krever en lesbar inngang og planlegging, men angir ikke at briefen må flyttes. Rekonstruksjonsdatoen 2026-10-16 beholdes også etter denne supplerende kontrollen samme dag.

## Historikk og personvern

Commit `1a39aaf450c3ff4a59908fd8caba9de10230b9a6` inneholder historiske filer på `.docs/planning-artifacts/prds/prd-studieplanlegger-2026-09-06/prd.md`, `.docs/planning-artifacts/epics.md` og `.docs/planning-artifacts/briefs/brief-studieplanlegger-2026-09-06/brief.md`. Den gamle lokale PRD-kopien ble fjernet etter prosjekteierens ønske 2026-11-02; [PRD.md](PRD.md) er eneste gjeldende PRD. Øvrige lokale ignorerte historiske kopier beholdes urørt. Gamle krav om obligatorisk emne/frister/tid og bare nettleserlagring er erstattet av registrering med bare tittel og støtte for både publisert nettutgave og lokal Node-/Docker-drift med SQLite; gamle FR/NFR-ID-er er historiske.

`EPICS-CURRENT.md` brukes fordi den private historiske `epics.md` kolliderer med `EPICS.md` på Windows. Ingen historisk privat fil er omdøpt eller gjort leveringsklar for å fylle et dokumentasjonshull. **Uttrykkelig unntak 2026-11-01:** Prosjekteieren autoriserte først sluttrapporten som Markdown og Word. Word-kopien ble senere fjernet etter prosjekteierens ønske; gjeldende unntak gjelder bare `.docs/submission/reflection-report.md`, med uendret rapporttekst. Eldre private refleksjonsutkast, inkludert `.docs/implementation-artifacts/project-reflection.md`, rårapporter, rålogger, interne notater, personlige testdata, sikkerhetskopier, databaser og runtimefiler forblir lokale/ignorerte. Rapporten er tilgjengelig gjennom GitHub-dokumentasjonen og holdes utenfor appens `public/`, brukergrensesnitt og Vercel-opplastingsutvalg.
