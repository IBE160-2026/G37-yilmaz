---
title: "Product Brief: Studieplan"
status: bounded-delivery-documented
created: 2026-09-06
updated: 2026-10-16
---

# Product brief: Studieplan

Studieplan hjelper studenten å gjøre oppgaver og tilgjengelig tid om til en gjennomførbar plan, registrere hva som faktisk skjedde og godkjenne nødvendige endringer. Appen kjører lokalt uten konto eller betalte tjenester. Studenten beholder kontroll over import, arbeidsanslag og planvalg.

Briefen er avgrenset **2026-10-16** etter [faglærerens tilbakemelding](tilbakemelding-product-brief.md) på commit `5e23204`. [PRD, stories og sporbarhet](.docs/planning-artifacts/README.md) er en datert rekonstruksjon av levert funksjonalitet, ikke en påstand om at disse dokumentene styrte tidligere utvikling.

## Problem og primærbruker

En **hypotetisk** HiMolde-student tar IBE110, IBE430 og IBE160 og har deltidsjobb to ettermiddager. Emneinformasjon, undervisning, Canvas-oppgaver og egne notater gir mange bruddstykker, men svarer ikke samlet på hva studenten kan gjøre den neste halvtimen. En tapt økt eller et for lavt anslag gjør planen urealistisk. Dette er et designscenario, ikke et gjennomført studentintervju.

Kalenderapper viser avtaler og frister, Canvas samler fagets informasjon og innleveringer, og oppgavelister hjelper med å huske arbeid. Studieplan forsøker å knytte disse behovene sammen gjennom én kontrollert planleggingssløyfe. Det er ingen påstand om markedsunikhet eller dokumentert lavere arbeidsbelastning.

## Hovedflyt og låst v1

Registrer oppgave manuelt eller bekreft importforslag → velg gjennomførbart steg/økt → registrer utfall → kontroller og godkjenn justeringer. Bare oppgavetittel er obligatorisk. Ukjent tid og manglende frist skal fortsatt være ukjent. Fullført steg, fullført oppgave og manuelt bekreftet innlevering er tre forskjellige tilstander. Logget tid er verken automatisk gjenstående arbeid eller dokumentasjon på mestring.

Kjernen omfatter emner og oppgaver, undervisning og tilgjengelig tid, forklarte handlingsforslag, arbeidsutfall, godkjent omplanlegging med angre, samt varig lokal lagring og dokumentert Docker-oppstart. Manuell registrering gjør kjernen brukbar uten eksterne kilder.

**Avgrensede importprøver i v1 — «HiMolde IT 2026–27 og NTNU emneutvalg høst 2026»:** HiMolde IT 2026–27 med IBE110 og IBE430 samt kildevalget **IBE160 eller IBE102 + IBE152**. Undervisningsprøvene gjelder bare IBE110/IBE430/IBE160 høsten 2026. NTNU omfatter emnemetadata og emnelenket undervisning for ARK1001 og EXPH0100 høsten 2026; dette lover ikke komplett NTNU-program. Det loves ikke full eksamensdekning eller personlig gruppetilhørighet. [Importdekning](studieplanlegger/IMPORT-COVERAGE.md) skiller lokale kontrakttester, historisk kildetransport og UI-prøver. Gjentakelse av hele HiMolde-programflyten er ikke verifisert; direkte emnegjentakelser er dokumentert historisk.

**Allerede implementerte tillegg:** ordnede arbeidssteg, frivillig egenvurdering og repetisjonsforslag, kalenderkopi og sammenligning av planalternativer. Disse bevares og beskrives i PRD, men utvider ikke kildekravet. Ingen nye adaptere eller funksjoner inngår i denne dokumentasjonsleveransen.

## Sjekkbare suksesskriterier

Hver rad har krav, story, kode, test/metode og evidensstatus i [sporbarhetsmatrisen](.docs/planning-artifacts/TRACEABILITY.md).

| ID | Forventet resultat |
| --- | --- |
| SC-01 | En tom planlegger kan lagre ett manuelt emne, en oppgave med bare tittel og én godkjent økt; koblingene beholdes ved omlasting. |
| SC-02 | Den avgrensede importen beholder kildevalgene og krever kontroll av endringer; kildefeil sletter ikke tidligere undervisning. |
| SC-03 | Nye øktforslag bruker registrerte arbeidsvinduer, unngår kjent opptatt tid og respekterer kjente avhengigheter; manglende tid og usikkert grunnlag forklares, ugyldige eller foreldede endringer avvises. |
| SC-04 | Registrering av faktisk tid endrer ikke automatisk gjenstående anslag; steg, arbeid og innlevering fullføres separat. |
| SC-05 | Et forslag skriver ingen økter før godkjenning; godkjente endringer kan angres samlet. |
| SC-06 | Emner, oppgaver, økter og relasjoner overlever omstart/gjenskaping med samme lokale datavolum. |
| SC-07 | En ny student kan fullføre hovedflyten og forklare skillet mellom ferdig og levert uten fasilitatorhjelp, etter prøveprotokollen. **Ikke testet med student.** |

## Utenfor v1 og videre visjon

Offentlig hosting, kontoer, betaling, skysynk, generativ KI i appen, automatisk kontakt, oppmøtekontroll og automatisk innlevering/bekreftelse er utenfor. Full nasjonal dekning er **framtidsvisjon**, ikke et uoppfylt v1-krav. Eksisterende adaptere beholdes med sine dokumenterte begrensninger. Før mer funksjonalitet prioriteres kvalitet, sporbarhet og faktisk studentutprøving. Teknisk arkitektur og daterte kjøreresultater finnes via [planindeksen](.docs/planning-artifacts/README.md); de beviser ikke studentnytte.
