---
title: "Product Brief: Ajour"
status: bounded-delivery-documented
created: 2026-09-06
updated: 2026-11-01
---

# Product brief: Ajour

Denne briefen beskriver produktmål, brukerbehov og avtalt omfang. Gjeldende leveringsstatus finnes i [planindeksen](.docs/planning-artifacts/README.md), prosjekteierens egenutprøving i [prøveplanen](.docs/planning-artifacts/USER-TRIAL-PLAN.md) og automatiske kontroller i [verifikasjonen](studieplanlegger/VERIFICATION.md). Resultater og testutførelse føres der, med riktig dato og utfører.

Ajour hjelper studenten å gjøre oppgaver og tilgjengelig tid om til en gjennomførbar plan, registrere hva som faktisk skjedde og godkjenne nødvendige endringer. Appen kan kjøres lokalt eller som nettleserutgave uten konto eller betalte tjenester. Studenten beholder kontroll over import, arbeidsanslag og planvalg.

**Godkjent driftsutvidelse, 2026-10-29:** Nettleserutgaven [Ajour](https://ajour-sooty.vercel.app) omfattes av ett gratis Vercel-prosjekt med samme hovedflyt, utseende og avgrensede importløfte. Planen tilhører nettleserprofilen og den nøyaktige nettadressen; den synkroniseres ikke mellom enheter. Sletting av nettleserdata kan slette planen. Sikkerhetskopi brukes til oppbevaring og flytting mellom lokal drift, forhåndsvisning og publisert adresse. Lokal Node-/Docker-drift beholdes. Tidligere avgrensning mot offentlig hosting beskriver omfanget før denne beslutningen.

«Kom ajour.» og «Planer endrer seg. Det er helt greit.» uttrykker planleggingssløyfen. Tydelig neste handling, tilgjengelige dialoger, stabile emnefarger og System/Lyst/Mørkt skal støtte hovedreisen uten nye registreringskrav. Tema er en lokal visningspreferanse.

Briefen er avgrenset **2026-10-16** etter [faglærerens tilbakemelding](tilbakemelding-product-brief.md) på commit `5e23204`. [PRD, stories og sporbarhet](.docs/planning-artifacts/README.md) er en datert rekonstruksjon av levert funksjonalitet, ikke en påstand om at disse dokumentene styrte tidligere utvikling.

## Problem og primærbruker

En **hypotetisk** HiMolde-student tar IBE110, IBE430 og IBE160 og har deltidsjobb to ettermiddager. Emneinformasjon, undervisning, Canvas-oppgaver og egne notater gir mange bruddstykker, men svarer ikke samlet på hva studenten kan gjøre den neste halvtimen. En tapt økt eller et for lavt anslag gjør planen urealistisk. Dette er et designscenario, ikke et gjennomført studentintervju.

Kalenderapper viser avtaler og frister, Canvas samler fagets informasjon og innleveringer, og oppgavelister hjelper med å huske arbeid. Ajour forsøker å knytte disse behovene sammen gjennom én kontrollert planleggingssløyfe. Det er ingen påstand om markedsunikhet eller dokumentert lavere arbeidsbelastning. [Researchgrunnlaget i PRD-en](.docs/planning-artifacts/PRD.md#researchgrunnlag-og-lignende-løsninger) skiller kilder fra antakelser.

## Hovedflyt og låst v1

**Oppgave → valgfritt arbeidssteg → godkjent studieøkt → utfall → justering.** Registrer oppgaven manuelt eller bekreft et importforslag, velg et gjennomførbart neste steg, og kontroller økten før den lagres. Etter arbeid registrerer studenten utfallet og godkjenner eventuelle planendringer. Bare oppgavetittel er obligatorisk; et eget arbeidssteg er valgfritt. Ukjent tid og manglende frist skal fortsatt være ukjent. Fullført steg, fullført oppgave og manuelt bekreftet innlevering er tre forskjellige tilstander. Logget tid er verken automatisk gjenstående arbeid eller dokumentasjon på mestring.

Kjernen omfatter emner og oppgaver, undervisning og tilgjengelig tid, forklarte handlingsforslag, arbeidsutfall, godkjent omplanlegging med angre, samt varig lokal lagring og dokumentert Docker-oppstart. Forslagene bygger på lokale regler og registrerte opplysninger. Import gir støttedata til denne flyten; manuell registrering gjør kjernen brukbar uten eksterne kilder.

**Avgrensede importprøver i v1 — «HiMolde IT 2026–27 og NTNU emneutvalg høst 2026»:** HiMolde IT 2026–27 med IBE110 og IBE430 samt kildevalget **IBE160 eller IBE102 + IBE152**. Undervisningsprøvene gjelder bare IBE110/IBE430/IBE160 høsten 2026. NTNU omfatter emnemetadata og emnelenket undervisning for ARK1001 og EXPH0100 høsten 2026; dette lover ikke komplett NTNU-program. Det loves ikke full eksamensdekning eller personlig gruppetilhørighet. [Importdekning](studieplanlegger/IMPORT-COVERAGE.md) beskriver hvilke kilder og forløp som faktisk er kontrollert.

**Allerede implementerte tillegg:** ordnede arbeidssteg, frivillig egenvurdering og repetisjonsforslag, kalenderkopi og sammenligning av planalternativer. Disse bevares og beskrives i PRD, men utvider ikke kildekravet.

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
| SC-07 | Prosjekteieren gjennomfører sju manuelle scenarier med syntetiske data i isolert testmiljø og dokumenterer forventet mot faktisk resultat, feil og eventuell omprøving. |

**Endret prøveopplegg 2026-10-26:** Prosjekteieren har besluttet egenutprøving uten rekruttering av andre testpersoner. SC-07 beholder ID-en og følger [prøveplanen](.docs/planning-artifacts/USER-TRIAL-PLAN.md). Den tidligere planlagte studentprøven ble ikke gjennomført eller bestått. Egenutprøvingen dokumenterer bare prosjekteierens bruk og observasjoner; målgruppen er uendret.

## Utenfor v1 og videre visjon

Kontoer, betaling, skysynk, generativ KI i appen, automatisk kontakt, oppmøtekontroll og automatisk innlevering/bekreftelse er utenfor. Offentlig hosting var utenfor fram til den uttrykkelig godkjente nettleserutvidelsen 2026-10-29; denne omfatter bare ett gratis Vercel-prosjekt uten delt studentlagring. Full nasjonal dekning er **framtidsvisjon**, ikke et uoppfylt v1-krav. Eksisterende adaptere beholdes med sine [dokumenterte begrensninger](studieplanlegger/README.md#kjente-begrensninger-ved-levering). Kvalitet, sporbarhet og dokumentasjon av faktisk egenutprøving prioriteres før mer funksjonalitet. Teknisk arkitektur og daterte kjøreresultater finnes via [planindeksen](.docs/planning-artifacts/README.md); de beviser ikke generell studentnytte.
