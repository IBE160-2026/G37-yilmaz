# Ajour: planlegging og leveranseevidens

**Revidert 2026-10-26.** Den eksisterende PRD-en er samordnet med lærerens tilbakemelding og PRD-forberedelsene gjengitt i prosjekteierens oppdrag: produkt, problem, målgruppe/behov, krav, research/alternativer og reelle åpne spørsmål er samlet i [PRD](PRD.md). V1 og krav-/story-ID-er er uendret. Hovedreisen er **oppgave → valgfritt arbeidssteg → godkjent studieøkt → utfall → justering**.

**Egenutprøving:** Etter prosjekteierens beslutning 2026-10-26 gjelder SC-07/R-07/S-07 bare egenutprøving. Ingen andre testpersoner rekrutteres. Status er **planlagt / ikke gjennomført**; den tidligere studentprøven ble ikke gjennomført eller bestått. Målgruppen er fortsatt studenter, og egenutprøving gir ikke bevis for ukjente brukeres forståelse eller generell studentnytte. Personlig refleksjon må bygge på egne erfaringer.

Planene ble **rekonstruert 2026-10-16** mot kodegrunnlag `1a58ffce782fd4e42a7153e21e82fc982ae00268`. De er ikke opprinnelige planer for allerede skrevet kode. Revisjonen følger opp lærerens krav om avgrenset V1, sjekkbare kriterier, tekniske detaljer i arkitekturen og synlig kontroll av KI-generert arbeid.

[Lokal kandidatkontroll 2026-10-26](../../studieplanlegger/VERIFICATION.md#lokal-commitkontroll--2026-10-26) samler den rundens resultater og begrensninger. [Temaoppfølgingen](../../studieplanlegger/VERIFICATION.md#emnepalett-og-mørk-modus--2026-10-26) har Node-/Docker-kontrollen fra samme dato. Eldre Docker-blokkeringer og testtall gjelder sine daterte runder. Ny nett-/runtimekontroll 2026-10-29 står under driftsutvidelsen nedenfor; ingen ny manuell egenutprøving er utført.

## Gjeldende dokumenter

Sensorvedleggets sju sider er lest på nytt 2026-10-26, med samme SHA-256 som identifikasjonen nedenfor. Det etterspør dokumenterte manuelle tester eller testplaner der automatisering ikke passer; ekstern studentrekruttering er ikke et krav i dette vedlegget. PRD-forberedelsenes seks spørsmål er brukt slik de er gjengitt i prosjekteierens oppdrag; selve lærerbildet er ikke kontrollert som separat vedlegg i denne runden. Godkjent proposal og overordnet veiledning er fortsatt ikke identifisert.

1. [Autoritativ brief i roten](../../brief.md): problem, hypotetisk bruker, avgrensning og SC-01–SC-07.
2. [Gjeldende PRD](PRD.md): krav R-01–R-08 og kvalitetskrav Q-01–Q-03.
3. [Gjeldende epics og stories](EPICS-CURRENT.md): S-01–S-08 med Given/When/Then.
4. [Arkitektur](architecture/architecture-studieplanlegger-2026-09-06/ARCHITECTURE-SPINE.md): gjeldende beslutninger og tydelig merket historikk.
5. [Sporbarhet](TRACEABILITY.md): forventet resultat, metode, kode, test og faktisk evidensstatus.
6. [Plan for egenutprøving](USER-TRIAL-PLAN.md): sju manuelle scenarier for prosjekteieren med syntetiske data; **planlagt / ikke gjennomført**.
7. [Importavtale og brukerflyt](../../studieplanlegger/IMPORT.md): forhåndsvisning, identiteter, emnevalg, tidspunkt og kildenes grenser.
8. [Kuratert TP CSV-formatkontrakt, 2026-10-23](../implementation-artifacts/tp-csv-format-contract-2026-10-23.md): offentlig formatgrunnlag og avgrensning mot private originalfiler.
9. [Daterte kontrollresultater](../../studieplanlegger/VERIFICATION.md): konkrete feil, rettelser, tester og begrensninger. Testkode er lenket fra sporbarheten; interne arbeidsspesifikasjoner beholdes lokalt og er ikke del av den offentlige dokumentkjeden.

[Oppstart](../../README.md), [løsningsguide](../implementation-artifacts/solution-guide.md), [utviklingsprosess](../implementation-artifacts/development-process.md), [importdekning](../../studieplanlegger/IMPORT-COVERAGE.md) og [verifikasjon](../../studieplanlegger/VERIFICATION.md) supplerer planen. [Faglærertilbakemeldingen](../../tilbakemelding-product-brief.md) og hele sensorveiledningen er kontrollert ved publiseringsoppfølgingen 2026-10-16.

## Godkjent driftsutvidelse — 2026-10-29

[Teknisk sluttkontroll samme dato](../../studieplanlegger/VERIFICATION.md#teknisk-sluttkontroll-og-publiseringssperrer--2026-10-29) dokumenterer ny CI, faktisk håndhevet domenesperre, sikkerhetsretting, preview, målinger og isolert gjenopprettingsøvelse. [Hel HiMolde-programgjentakelse](TRACEABILITY.md#hel-himolde-programgjentakelse--2026-10-29) er kontrollert med syntetiske kilder; egenutprøving, refleksjon og Outlook er fortsatt åpne.

[Briefen](../../brief.md), [PRD-en](PRD.md) og [AD-16](architecture/architecture-studieplanlegger-2026-09-06/ARCHITECTURE-SPINE.md#ad-16--browser-deployment-with-bounded-stateless-imports-2026-10-29) beskriver den uttrykkelig godkjente nettleserutgaven i ett gratis Vercel-prosjekt. Hele hovedflyten og lokale Node-/Docker-valg beholdes. Nettutgaven har nettleser-/adresselokal lagring og avgrensede importfunksjoner, uten konto, skydatabase eller synkronisering. Historiske lokalavgrensninger er datert; importløftet, krav-ID-ene og uutført SC-07/refleksjon endres ikke. [Ny verifikasjonsseksjon](../../studieplanlegger/VERIFICATION.md#vercel-nettleserutgave--2026-10-29) dokumenterer bestått kontroll av [produksjonsadressen](https://ajour-sooty.vercel.app), adskilt fra tidligere klargjøring og lokale prøver.

## Vurderingsgrunnlag kontrollert 2026-10-16

- Tilbakemeldingen av 2026-10-06 vurderer brief ved `5e23204` og angir konkrete rettelser for G37.
- «Sensorveiledning IBE160 - Del 1 applikasjon og prosess.pdf», høst 2026, sju sider, er lest i sin helhet som brukerlevert lokalt vedlegg. SHA-256: `a0069856666a32e2e5c886fe1c46ade1d666a99bf800bc42b9e20113adc2e509`. PDF-en er ikke lagt i Git; identifikasjonen gjør det mulig å kontrollere samme utgave uten personlige filstier. Framtidige oppdrag må få tilgang til vedlegget eller relevant offisiell utgave, ikke behandle dette sammendraget som hele kilden.
- [Vurderingsområdene med bevis og mangler](TRACEABILITY.md#sensorveiledningens-sju-områder) bruker de veiledende vektene uten å sette karakter. Veiledningen vurderer del 1 (70 % av mappen); personlig refleksjon tilhører del 2. Den er et grunnlag for faglig skjønn, ikke en automatisk godkjenning.

Godkjent proposal og den overordnede sensorveiledningen som PDF-en viser til, er ikke identifisert i denne kontrollen. Briefen beholdes som autoritativ inngang i roten; PDF-en krever en lesbar inngang og planlegging, men angir ikke at briefen må flyttes. Rekonstruksjonsdatoen 2026-10-16 beholdes også etter denne supplerende kontrollen samme dag.

## Historikk og personvern

Commit `1a39aaf450c3ff4a59908fd8caba9de10230b9a6` inneholder historiske filer på `.docs/planning-artifacts/prds/prd-studieplanlegger-2026-09-06/prd.md`, `.docs/planning-artifacts/epics.md` og `.docs/planning-artifacts/briefs/brief-studieplanlegger-2026-09-06/brief.md`. Lokale ignorerte kopier beholdes urørt. Gamle krav om obligatorisk emne/frister/tid og bare nettleserlagring er erstattet av dagens registrering med bare tittel og lokal fullstack-leveranse; gamle FR/NFR-ID-er er historiske.

`EPICS-CURRENT.md` brukes fordi den private historiske `epics.md` kolliderer med `EPICS.md` på Windows. Ingen historisk privat fil er omdøpt eller gjort leveringsklar for å fylle et dokumentasjonshull. Personlige refleksjoner, rårapporter, interne notater, databaser og runtimefiler forblir lokale/ignorerte. Personlig refleksjon må bygge på studentens egne erfaringer.
