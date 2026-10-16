# Planlegging og leveranseevidens

Oppdatert **2026-10-16**, mot kodegrunnlag `1a58ffce782fd4e42a7153e21e82fc982ae00268`. Dokumentene nedenfor rekonstruerer sporbarheten etter tilbakemeldingen på briefen. De er ikke opprinnelige planer for allerede skrevet kode.

1. [Autoritativ brief i roten](../../brief.md): problem, hypotetisk bruker, avgrensning og SC-01–SC-07.
2. [Gjeldende PRD](PRD.md): krav R-01–R-08 og kvalitetskrav Q-01–Q-03.
3. [Gjeldende epics og stories](EPICS-CURRENT.md): S-01–S-08 med Given/When/Then.
4. [Arkitektur](architecture/architecture-studieplanlegger-2026-09-06/ARCHITECTURE-SPINE.md): gjeldende beslutninger og tydelig merket historikk.
5. [Sporbarhet](TRACEABILITY.md): forventet resultat, metode, kode, test og faktisk evidensstatus.
6. [Plan for studentutprøving](USER-TRIAL-PLAN.md): framtidig undersøkelse, ingen innsamlede studentresultater.

[Oppstart](../../README.md), [løsningsguide](../implementation-artifacts/solution-guide.md), [utviklingsprosess](../implementation-artifacts/development-process.md), [importdekning](../../studieplanlegger/IMPORT-COVERAGE.md) og [verifikasjon](../../studieplanlegger/VERIFICATION.md) supplerer planen. [Faglærertilbakemeldingen](../../tilbakemelding-product-brief.md) og hele sensorveiledningen er kontrollert ved publiseringsoppfølgingen 2026-10-16. Lærerens omtale av Claude Code må fortsatt avklares; denne dokumentasjonsrunden bruker Codex.

## Vurderingsgrunnlag kontrollert 2026-10-16

- Tilbakemeldingen av 2026-10-06 vurderer brief ved `5e23204` og angir konkrete rettelser for G37.
- «Sensorveiledning IBE160 - Del 1 applikasjon og prosess.pdf», høst 2026, sju sider, er lest i sin helhet som brukerlevert lokalt vedlegg. SHA-256: `a0069856666a32e2e5c886fe1c46ade1d666a99bf800bc42b9e20113adc2e509`. PDF-en er ikke lagt i Git; identifikasjonen gjør det mulig å kontrollere samme utgave uten personlige filstier. Framtidige oppdrag må få tilgang til vedlegget eller relevant offisiell utgave, ikke behandle dette sammendraget som hele kilden.
- [Vurderingsområdene med bevis og mangler](TRACEABILITY.md#sensorveiledningens-sju-områder) bruker de veiledende vektene uten å sette karakter. Veiledningen vurderer del 1 (70 % av mappen); personlig refleksjon tilhører del 2. Den er et grunnlag for faglig skjønn, ikke en automatisk godkjenning.

Godkjent proposal og den overordnede sensorveiledningen som PDF-en viser til, er ikke identifisert i denne kontrollen. Briefen beholdes som autoritativ inngang i roten; PDF-en krever en lesbar inngang og planlegging, men angir ikke at briefen må flyttes. Rekonstruksjonsdatoen 2026-10-16 beholdes også etter denne supplerende kontrollen samme dag.

## Historikk og personvern

Commit `1a39aaf450c3ff4a59908fd8caba9de10230b9a6` inneholder historiske filer på `.docs/planning-artifacts/prds/prd-studieplanlegger-2026-09-06/prd.md`, `.docs/planning-artifacts/epics.md` og `.docs/planning-artifacts/briefs/brief-studieplanlegger-2026-09-06/brief.md`. Lokale ignorerte kopier beholdes urørt. Gamle krav om obligatorisk emne/frister/tid og bare nettleserlagring er erstattet av dagens registrering med bare tittel og lokal fullstack-leveranse; gamle FR/NFR-ID-er er historiske.

`EPICS-CURRENT.md` brukes fordi den private historiske `epics.md` kolliderer med `EPICS.md` på Windows. Ingen historisk privat fil er omdøpt eller gjort leveringsklar for å fylle et dokumentasjonshull. Personlige refleksjoner, rårapporter, interne notater, databaser og runtimefiler forblir lokale/ignorerte. Personlig refleksjon må bygge på studentens egne erfaringer.
