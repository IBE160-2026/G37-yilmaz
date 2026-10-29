---
title: "Product Brief: Ajour"
status: bounded-delivery-documented
created: 2026-09-06
updated: 2026-10-29
---

# Product brief: Ajour

Ajour er en studieplanlegger for studenter som må samordne flere emner med begrenset arbeidstid. Primærbrukeren er en hypotetisk HiMolde-student med tre emner og deltidsjobb. Oppgaver, undervisning og egne notater ligger spredt, og en tapt økt eller et endret arbeidsanslag gjør det vanskelig å vite hva som kan gjøres nå.

Ajour knytter oppgaver til tilgjengelig tid, foreslår en gjennomførbar studieøkt og lar studenten registrere utfallet og godkjenne justeringer. Målet er å gjøre det enkelt å lage en første plan, finne neste handling og beholde oversikten når planen endres. Studenten kontrollerer import, anslag og planvalg. Dette er produktmål og behovsantakelser; studentnytte er ikke dokumentert.

V1 omfatter denne planleggingssløyfen, manuell registrering og et navngitt importutvalg fra HiMolde og NTNU. Appen kan kjøres lokalt eller på nett uten konto eller betalte tjenester. Nasjonal importdekning, skysynkronisering og automatisk innlevering er utenfor V1. [PRD, stories og sporbarhet](.docs/planning-artifacts/README.md) utdyper kravene og deres dokumenterte grunnlag.

## Problem og primærbruker

I primærscenarioet tar studenten IBE110, IBE430 og IBE160 og har deltidsjobb to ettermiddager. Emneinformasjon, undervisning, Canvas-oppgaver og egne notater må bli til et svar på hva studenten kan gjøre den neste halvtimen. Dette er et designscenario, ikke et gjennomført studentintervju.

Kalenderapper viser avtaler og frister, Canvas samler fagets informasjon og innleveringer, og oppgavelister hjelper med å huske arbeid. Ajour forsøker å knytte disse behovene sammen gjennom én kontrollert planleggingssløyfe. Det er ingen påstand om markedsunikhet eller dokumentert lavere arbeidsbelastning. [Researchgrunnlaget i PRD-en](.docs/planning-artifacts/PRD.md#researchgrunnlag-og-lignende-løsninger) skiller kilder fra antakelser.

## Hovedflyt og låst v1

**Oppgave → valgfritt arbeidssteg → godkjent studieøkt → utfall → justering.** Registrer oppgaven manuelt eller bekreft et importforslag, velg et gjennomførbart neste steg, og kontroller økten før den lagres. Etter arbeid registrerer studenten utfallet og godkjenner eventuelle planendringer. Bare oppgavetittel er obligatorisk; et eget arbeidssteg er valgfritt. Ukjent tid og manglende frist skal fortsatt være ukjent. Fullført steg, fullført oppgave og manuelt bekreftet innlevering er tre forskjellige tilstander. Logget tid er verken automatisk gjenstående arbeid eller dokumentasjon på mestring.

Kjernen omfatter emner og oppgaver, undervisning og tilgjengelig tid, forklarte handlingsforslag, arbeidsutfall, godkjent omplanlegging med angre og lagring i valgt driftsform. Forslagene bygger på lokale regler og registrerte opplysninger. Import gir støttedata til denne flyten; manuell registrering gjør kjernen brukbar uten eksterne kilder.

**Avgrensede importprøver i v1 — «HiMolde IT 2026–27 og NTNU emneutvalg høst 2026»:** HiMolde IT 2026–27 med IBE110 og IBE430 samt kildevalget **IBE160 eller IBE102 + IBE152**. Undervisningsprøvene gjelder bare IBE110/IBE430/IBE160 høsten 2026. NTNU omfatter emnemetadata og emnelenket undervisning for ARK1001 og EXPH0100 høsten 2026; dette lover ikke komplett NTNU-program. Det loves ikke full eksamensdekning eller personlig gruppetilhørighet. [Importdekning](studieplanlegger/IMPORT-COVERAGE.md) skiller lokale kontrakttester, historisk kildetransport og UI-prøver. Gjentakelse av hele HiMolde-programflyten er ikke verifisert; direkte emnegjentakelser er dokumentert historisk.

**Allerede implementerte tillegg:** ordnede arbeidssteg, frivillig egenvurdering og repetisjonsforslag, kalenderkopi og sammenligning av planalternativer. Disse bevares og beskrives i PRD, men utvider ikke kildekravet.

## Driftsformer og databevaring

Begge driftsformene har samme hovedflyt og avgrensede importløfte:

| Driftsform | Hvor planen lagres og hva som må bevares |
| --- | --- |
| Lokal Node-/Docker-drift | Planen lagres i SQLite. Omstart og gjenskaping skal bruke samme database/datavolum for å beholde dataene. Oppstart er dokumentert i [README](README.md). |
| [Nettutgaven på Vercel](https://ajour-sooty.vercel.app) | Planen lagres i nettleseren, knyttet til nettleserprofil og nøyaktig nettadresse (origin: protokoll, vertsnavn og port). Omlasting, gjenåpning og ny publisering på samme adresse skal bevare gyldige data. Andre profiler, localhost, forhåndsvisning og produksjon har separate data. Sletting av nettleserdata kan slette planen. |

Sikkerhetskopi brukes til oppbevaring og kontrollert flytting mellom lokal drift, profiler og nettadresser. Ingen enhetssynkronisering eller delt skylagring inngår. Tema og emnefarger er nettleserlokale visningspreferanser og loves ikke overført i sikkerhetskopien. Nettutgaven tillater bare gjenkjente offentlige importkilder; andre kalenderadresser henvises til filimport. [PRD-en](.docs/planning-artifacts/PRD.md#driftsformer-og-databevaring) utdyper disse grensene.

## Sjekkbare suksesskriterier

Hver rad har krav, story, kode, test/metode og evidensstatus i [sporbarhetsmatrisen](.docs/planning-artifacts/TRACEABILITY.md).

| ID | Forventet resultat |
| --- | --- |
| SC-01 | En tom planlegger kan lagre ett manuelt emne, en oppgave med bare tittel og én godkjent økt; koblingene beholdes ved omlasting. |
| SC-02 | Den avgrensede importen beholder kildevalgene og krever kontroll av endringer; kildefeil sletter ikke tidligere undervisning. |
| SC-03 | Nye øktforslag bruker registrerte arbeidsvinduer, unngår kjent opptatt tid og respekterer kjente avhengigheter; manglende tid og usikkert grunnlag forklares, ugyldige eller foreldede endringer avvises. |
| SC-04 | Registrering av faktisk tid endrer ikke automatisk gjenstående anslag; steg, arbeid og innlevering fullføres separat. |
| SC-05 | Et forslag skriver ingen økter før godkjenning; godkjente endringer kan angres samlet. |
| SC-06 | Emner, oppgaver, økter og relasjoner bevares i valgt driftsform: lokal Node/Docker ved omstart/gjenskaping med samme database/datavolum; nettutgaven ved omlasting, gjenåpning og ny publisering på samme nettadresse i samme nettleserprofil. Sikkerhetskopi/gjenoppretting bevarer domenedata ved kontrollert flytting. |
| SC-07 | Prosjekteieren gjennomfører sju manuelle scenarier med syntetiske data i isolert testmiljø og dokumenterer forventet mot faktisk resultat, feil og eventuell omprøving. **Planlagt / ikke gjennomført.** |

**Endret prøveopplegg 2026-10-26:** Prosjekteieren har besluttet egenutprøving uten rekruttering av andre testpersoner. SC-07 beholder ID-en og følger [prøveplanen](.docs/planning-artifacts/USER-TRIAL-PLAN.md). Den tidligere planlagte studentprøven ble ikke gjennomført eller bestått. Egenutprøvingen dokumenterer bare prosjekteierens bruk og observasjoner; målgruppen er uendret.

Som supplement foreslås observasjoner av tidsbruk, antall handlinger og uklarheter ved første plan og omplanlegging, knyttet til [prøveplanens eksisterende scenarier](.docs/planning-artifacts/USER-TRIAL-PLAN.md#foreslåtte-brukbarhetsobservasjoner). Dette er forslag til senere beslutning, uten nye beståttgrenser eller oppnådde resultater. [PRD-ens kvalitetsgrunnlag](.docs/planning-artifacts/PRD.md#kvalitetsgrunnlag-og-testede-miljøer) skiller faktisk nettlesertestdekning fra lovet støtte og åpne ytelsesmål.

## Utenfor v1 og videre visjon

Kontoer, betaling, skysynk, generativ KI i appen, automatisk kontakt, oppmøtekontroll og automatisk innlevering/bekreftelse er utenfor. Offentlig hosting var utenfor fram til den uttrykkelig godkjente nettleserutvidelsen 2026-10-29; denne omfatter bare ett gratis Vercel-prosjekt uten delt studentlagring. Full nasjonal dekning er **framtidsvisjon**, ikke et uoppfylt v1-krav. Eksisterende adaptere beholdes med sine dokumenterte begrensninger. Før mer funksjonalitet prioriteres kvalitet, sporbarhet og planlagt egenutprøving. Teknisk arkitektur og daterte kjøreresultater finnes via [planindeksen](.docs/planning-artifacts/README.md); de beviser ikke studentnytte.

## Kort revisjonshistorikk

| Dato | Endring og grunnlag |
| --- | --- |
| 2026-10-16 | V1 avgrenset etter [faglærerens tilbakemelding](tilbakemelding-product-brief.md) på `5e23204`. PRD, stories og sporbarhet er rekonstruert fra levert funksjonalitet; de påstås ikke å ha styrt tidligere utvikling. |
| 2026-10-18–25 | Import-/kalenderrettinger og minimering av testdata samordnet innen samme V1; [daterte kjøreresultater](studieplanlegger/VERIFICATION.md) beholdes som historikk. |
| 2026-10-26 | Ajour-navnet, «Kom ajour.» og «Planer endrer seg. Det er helt greit.» viderefører hovedflyten. [Ajour-oppfølgingen](studieplanlegger/VERIFICATION.md#gjeldende-lokal-oppfølging--2026-10-26) gjelder neste handling, tilgjengelige dialoger og personvern. Tolv emnefarger og System/Lyst/Mørkt er kontrollert i [temarunden](studieplanlegger/VERIFICATION.md#emnepalett-og-mørk-modus--2026-10-26). Ingen av rundene dokumenterer studentnytte. |
| 2026-10-29 | Godkjent driftsutvidelse til ett gratis Vercel-prosjekt, med lokal Node/Docker beholdt. [Publiseringskontrollen](studieplanlegger/VERIFICATION.md#vercel-nettleserutgave--2026-10-29) dokumenterer faktiske nettprøver. Dokumentrevisjonen samordner driftsformer og sporbarhet og foreslår brukbarhetsobservasjoner; eldre resultater er ikke nye kjøringer. |
