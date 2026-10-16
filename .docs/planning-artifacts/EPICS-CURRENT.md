# Epics og stories for dagens leveranse

**Rekonstruert 2026-10-16**, jf. [proveniens og historikk](README.md). Disse åtte små historiene beskriver eksisterende kode og en framtidig studentprøve. «Implementert» betyr at kode og tekniske tester finnes; det er ikke en ny kjøring eller studentaksept. [PRD](PRD.md) eier R-/Q-kravene, og [sporbarhet](TRACEABILITY.md) peker til kode, navngitte tester og daterte resultater.

## Epic E-01: Etablere en plan

### S-01 — Manuell start (R-01, Q-01; SC-01)

Som student vil jeg registrere det jeg vet, slik at manglende detaljer ikke hindrer start.

- **Given** tom planlegger, **When** jeg lagrer et manuelt emne og en oppgave med bare tittel, **Then** oppgaven lagres uten oppdiktet frist eller anslag.
- **Given** oppgaven og tilgjengelig tid, **When** jeg kontrollerer og godkjenner en økt og laster siden på nytt, **Then** emne, oppgave og økt beholder sine koblinger.

Status: implementert; automatisert teknisk onboarding finnes. Studentforståelse gjenstår i S-07.

### S-02 — Avgrenset, kontrollert import (R-02, Q-02; SC-02)

Som student vil jeg se kildens informasjon og usikkerhet før jeg bekrefter den.

- **Given** HiMolde IT 2026–27, **When** planen tolkes og et alternativ velges, **Then** IBE110/IBE430 er påkrevd og valget er enten IBE160 eller begge IBE102/IBE152.
- **Given** endret kildeinnhold, **When** importen forhåndsvises, **Then** endringene krever bekreftelse; ingen personlig gruppe utledes.
- **Given** tidligere importert undervisning, **When** oppdateringen feiler, **Then** tidligere hendelser/valg og siste suksess beholdes, mens feilen beskrives separat.
- **Given** NTNU ARK1001 eller EXPH0100 høst 2026, **When** studenten søker emnemetadata, henter emnelenket undervisning, kontrollerer aktivitetsutvalget og bekrefter importen, **Then** emnet og undervisningskoblingene beholdes ved omlasting og samme import gjentatt med stabile ID-er. Testkilde: [connected-public-teaching-live.spec.js](../../studieplanlegger/tests/e2e/connected-public-teaching-live.spec.js), `live NTNU course and teaching round-trip: ARK1001` / `live NTNU course and teaching round-trip: EXPH0100`. Dette er eksisterende testkode, ingen ny live-kjøring.

Status: implementert. Ny lokal kontraktkontroll 2026-10-16; transport og UI er historiske avgrensede prøver. Hele HiMolde-programgjentakelsen er ikke verifisert. NTNU-avgrensningen følger PRD, uten programløfte.

## Epic E-02: Gjennomføre og justere

### S-03 — Gjennomførbare forslag (R-03; SC-03)

Som student vil jeg se hva som får plass innenfor de opplysningene jeg har registrert.

- **Given** arbeidsvinduer, kjent undervisning/opptatt tid og avhengigheter, **When** forslag beregnes, **Then** nye økter ligger i gyldig ledig tid og respekterer forutsetninger; manglende kapasitet forklares.
- **Given** et manuelt flyttet utkast, **When** det overlapper, bryter vinduet eller har foreldet grunnlag, **Then** godkjenning avvises uten lagring.
- **Given** kjent frist og utilstrekkelig tid før fristen, **When** kapasiteten beregnes, **Then** arbeid etter fristen telles ikke som tilgjengelig, og manglende tid forklares. Testkilder: [capacity-invariants.test.js](../../studieplanlegger/tests/unit/capacity-invariants.test.js), `keeps every assigned minute inside a real session and deadline, never assigns it twice, and preserves input`, og [capacity-notice.test.js](../../studieplanlegger/tests/unit/capacity-notice.test.js), `identifies a hard deadline shortage independently of planned sessions`.
- **Given** et forslag beregnet fra et tidligere gjenstående anslag, **When** anslaget endres før godkjenning, **Then** det gamle forslaget avvises som foreldet uten skriving. Dette er eksplisitt kontrollert av A10-testen i [connected-planner.test.js](../../studieplanlegger/tests/unit/connected-planner.test.js): `A10 rejects edits that overlap, lack breaks, violate windows, stale data or elapsed start, with atomic undo`.

Status: implementert med enhetstester og historisk teknisk evidens; ingen garanti ved ukjente eller feilregistrerte opplysninger.

### S-04 — Utfall uten falsk framgang (R-04; SC-04)

Som student vil jeg registrere arbeid uten at systemet gjetter fullføring eller levering.

- **Given** 30 planlagte minutter og 120 opprinnelig anslag, **When** jeg registrerer 30 faktiske minutter og 45 gjenstående, **Then** begge opplysninger beholdes hver for seg.
- **Given** en oppgave med steg og innleveringskrav, **When** et steg fullføres, **Then** hele oppgaven og innleveringen forblir ufullført; når oppgaven senere fullføres, kreves fortsatt separat leveringsbekreftelse.
- **Given** en ikke utført økt, **When** utfallet registreres, **Then** ingen produktiv tid eller mestring utledes.

Status: implementert; automatiserte domene-/stegtester, ikke dokumentasjon på læring.

### S-05 — Godkjenne og angre (R-05; SC-05)

Som student vil jeg kontrollere planendringer og kunne angre dem samlet.

- **Given** et forslag, **When** jeg bare forhåndsviser eller avbryter, **Then** ingen ny økt lagres.
- **Given** uendret gyldig grunnlag, **When** jeg godkjenner og deretter angrer, **Then** den samlede endringen lagres og gjenopprettes samlet.
- **Given** endret grunnlag, **When** gammelt forslag brukes, **Then** det avvises uten delvis skriving.

Status: implementert med tekniske tester; denne samordningen endrer ikke produktatferden.

## Epic E-03: Bevare og etterprøve

### S-06 — Varig lokal leveranse (R-06, Q-02; SC-06)

Som student vil jeg bevare planen uten konto og kunne følge dokumentert lokal oppstart.

- **Given** lagrede emner, oppgaver og økter, **When** produksjonsserveren/containeren starter på nytt med samme datavolum, **Then** identiteter og relasjoner beholdes.
- **Given** ugyldig eller foreldet tilstand, **When** lagring forsøkes, **Then** ingen del av kandidaten erstatter gyldige data.

Status: implementert; datert Node/SQLite- og Docker-evidens. Ingen ny Docker-kjøring 2026-10-16.

### S-07 — Undersøke studentforståelse (R-07, Q-01; SC-07)

Som leveranseansvarlig vil jeg skille teknisk funksjon fra faktisk studentforståelse.

- **Given** en frivillig ny student og syntetiske data, **When** [prøveplanen](USER-TRIAL-PLAN.md) gjennomføres, **Then** registreres selvstendig fullføring av hovedflyten og studentens forklaring av ferdig/levert.
- **Given** nødvendig fasilitatorhjelp eller feil forklaring, **When** prøven vurderes, **Then** kriteriet rapporteres som ikke oppnådd i den prøven, med konkret problem og uten oppdiktet nytte.

Status: planlagt, ikke gjennomført. Personlig refleksjon og eventuell lengre egenbruk må skrives av studenten fra faktiske erfaringer.

### S-08 — Bevare eksisterende tillegg (R-08; støtter SC-04/SC-05)

Som student vil jeg fortsatt kunne bruke valgfrie tillegg uten nye obligatoriske registreringsfelt.

- **Given** ordnede steg, **When** et steg fullføres, **Then** identitet og historikk beholdes uten automatisk fullføring av oppgaven.
- **Given** lav frivillig egenvurdering, **When** repetisjon foreslås, **Then** ingen økt lagres før godkjenning.
- **Given** lagret plan, **When** kalenderkopi eksporteres eller planalternativer sammenlignes, **Then** eksporten er en kopi og sammenligningen skriver ikke før eksplisitt valg.

Status: implementert tillegg, med integrerte tester; ekstern Outlook-import og studentnytte er ikke bekreftet.
