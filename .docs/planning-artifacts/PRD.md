---
title: "PRD: Ajour"
status: final
created: 2026-10-16
updated: 2026-10-26
---

# PRD: avgrenset Ajour-leveranse

**Rekonstruert 2026-10-16, revidert 2026-10-26.** Dette er den eksisterende PRD-en, oppdatert etter [lærerens tilbakemelding](../../tilbakemelding-product-brief.md) og PRD-forberedelsene gjengitt i prosjekteierens oppdrag. Den beskriver allerede utviklet funksjonalitet og planlagt egenutprøving; den er ikke en opprinnelig plan for koden. [Briefen](../../brief.md) eier produktløftet, og [planindeksen](README.md) dokumenterer proveniens.

## Hva vi skal lage og hvilket problem det skal løse

Ajour er en lokal studieplanlegger som knytter oppgaver til tilgjengelig tid, foreslår neste handling og lar studenten justere planen etter faktisk arbeid. Emneinformasjon, undervisning, oppgavetekster og egne notater ligger ofte hver for seg. En kalender eller fristliste alene svarer ikke nødvendigvis på hva studenten kan gjøre nå når tiden er knapp eller et anslag har endret seg. Dette er prosjektets problemforståelse, ikke et resultat fra studentintervjuer.

Hovedreisen er **oppgave → valgfritt arbeidssteg → godkjent studieøkt → utfall → justering**. Bare oppgavetittel er obligatorisk. Studenten kan legge til emne, frist, steg og arbeidsanslag senere, kontrollere en foreslått økt, registrere faktisk arbeid og velge om planen skal endres. Forslag bygger på lokale regler og opplysninger studenten har registrert. Ukjent tid forblir ukjent, og ingen planendring lagres uten godkjenning.

## Hvem løsningen er for og hvilke behov de kan ha

Målgruppen er studenter ved norske universiteter og høgskoler som må samordne flere emner og begrenset arbeidstid. Primærscenarioet er en **hypotetisk HiMolde-student** med IBE110, IBE430, IBE160 og deltidsjobb to ettermiddager. Det er et designscenario, ikke en intervjuet person. Behovsantakelsene er å kunne starte med lite registrering, finne håndterbart arbeid, se tidskonflikter og endre et urealistisk anslag uten å miste oversikten.

Studenten trenger tydelig skille mellom fullført steg, ferdig oppgave og bekreftet innlevering. Faktisk brukt tid skal holdes atskilt fra gjenstående anslag og faglig mestring. Egenutprøvingen utføres bare av prosjekteieren; målgruppen endres ikke av hvem som gjennomfører prøven. Vi har ikke dokumentert at ukjente brukere forstår appen eller at studentgruppen generelt får nytte av den.

## V1-avgrensning

V1 omfatter manuell registrering, emner og oppgaver, undervisning og tilgjengelig tid, forklarte øktforslag, arbeidsutfall, godkjent omplanlegging med Angre, lokal varig lagring og dokumentert Docker-oppstart uten konto eller betalt API. Manuell registrering skal fungere når eksterne kilder er nede. Eksisterende ordnede steg, frivillig egenvurdering/repetisjon, kalenderkopi og plansammenligning bevares.

Importløftet er fortsatt **«HiMolde IT 2026–27 og NTNU emneutvalg høst 2026»**:

- HiMolde-programprøven har IBE110 og IBE430, samt valget **IBE160 eller IBE102 + IBE152**. Undervisningsprøvene gjelder bare IBE110/IBE430/IBE160 høsten 2026.
- NTNU-prøvene gjelder emnemetadata og emnelenket undervisning for **ARK1001 og EXPH0100 høsten 2026**. Det loves ikke komplett NTNU-program, full eksamensdekning eller personlig gruppetilhørighet.
- [Importdekningen](../../studieplanlegger/IMPORT-COVERAGE.md) avgrenser lokale kontrakttester, historisk offentlig transport og teknisk UI-kontroll. Hele HiMolde-programflytens gjentakelse er fortsatt ikke verifisert. Eksisterende adaptere utvider ikke leveranseløftet.

## Krav og akseptansekriterier

ID-ene er stabile. [Stories](EPICS-CURRENT.md) utdyper Given/When/Then, og [sporbarheten](TRACEABILITY.md) kobler hvert krav til kode, test/metode og datert evidens.

| ID | Krav og sjekkbart resultat | Brief / story |
| --- | --- | --- |
| R-01 | En oppgave kan lagres med bare tittel, også uten emne. Frivillige felt kan fylles senere; omlasting bevarer lagrede emne-/oppgave-/øktkoblinger. | SC-01 / S-01 |
| R-02 | Import bevarer kildens påkrevde emner og alternative grener. Kilde, periode, usikkerhet og endringer vises før bekreftelse. Feilet oppdatering bevarer tidligere undervisning og valg. | SC-02 / S-02 |
| R-03 | Forslag bruker registrerte arbeidsvinduer, opptatt tid, frister, avhengigheter og gjenstående arbeid. Nye økter unngår kjente konflikter; manglende kapasitet og ukjent grunnlag forklares uten å gjette mestring eller utført arbeid. | SC-03 / S-03 |
| R-04 | Faktiske minutter og nytt gjenstående anslag registreres hver for seg. Fullført steg fullfører ikke oppgaven; fullført oppgave bekrefter ikke innlevering. | SC-04 / S-04 |
| R-05 | Forhåndsvisning skriver ikke planen. Godkjenning kontrollerer grunnlaget på nytt og lagrer samlet; Angre gjenoppretter den samlede endringen. Foreldet grunnlag avvises uten delvis lagring. | SC-05 / S-05 |
| R-06 | Lokal produksjonslagring bevarer identiteter og relasjoner etter omstart/gjenskaping med samme datavolum. Ugyldig eller foreldet lagring avvises uten delvis endring; sikkerhetskopi/gjenoppretting bevarer domenedata. | SC-06 / S-06 |
| R-07 | Egenutprøving utføres av prosjekteieren etter prøveplanens sju scenarier, med syntetiske data, isolert lagring og registrerte observasjoner per scenario. Automatiske tester erstatter ikke den manuelle prøven. | SC-07 / S-07 |
| R-08 | Bevar leverte tillegg: ordnede steg, frivillig egenvurdering/repetisjon, kalenderkopi og plansammenligning. Logget tid er ikke mestring; repetisjon krever godkjenning og eksport er ikke synkronisering. | Eksisterende tillegg / S-08 |
| Q-01 | Norsk grensesnitt, merkede felt, tastaturfokus og tekstlig status/emnekode. Farge supplerer tekst. Kalender, emnefarger og System/Lyst/Mørkt er lesbare; temabytte bevarer arbeid og åpne utkast. | SC-01, SC-07 / S-01, S-07 |
| Q-02 | Ingen konto eller betalt API kreves. Studentdata lagres lokalt; private notater, rålogger og runtimefiler inngår ikke i Git-leveransen. Testdata minimeres uten å miste nødvendig kilde- og parserstruktur. | SC-02, SC-06 / S-02, S-06 |
| Q-03 | Evidens oppgir dato, metode og avgrensning. Skill fixturtest, offentlig kildetransport, teknisk UI-/Docker-kontroll og prosjekteierens manuelle egenutprøving. | Alle SC / alle stories |

### Videreførte presiseringer av eksisterende krav

Dette samler presiseringene fra 18.–26. oktober uten nye funksjoner. Detaljerte eksempler er bevart i [stories](EPICS-CURRENT.md), [importavtalen](../../studieplanlegger/IMPORT.md) og [arkitekturen](architecture/architecture-studieplanlegger-2026-09-06/ARCHITECTURE-SPINE.md).

- **R-02/R-05/R-06:** Import skal gi én forståelig vei fra kildevalg via forhåndsvisning og nødvendige gruppeavklaringer til samlet bekreftelse. Gyldige valg, manuelle koblinger, uttrykkelig uten-emne-valg og beholdte utelatelser skal overleve oppdatering. Kildeskifte og forsinkede svar skal ikke overskrive nyere utkast. Entydige navn og koblinger gjenbrukes; manglende, provisorisk eller motstridende informasjon skal vises ærlig. Samme emnekode ved ulike læresteder skal ikke blandes.
- **R-02/R-03:** Kildens periode og nøyaktige tidspunkt skal bevares. Manglende, like eller ugyldige sluttider gir ikke automatisk varighet, kapasitet, eksamen eller frist. Nødvendig valg mellom retting, punkt uten varighet og utelatelse skal forklares. Ugyldige kalenderdeler skal ikke flyttes til oppdiktede datoer eller slette gyldige data; kildeavlysninger skal treffe riktig forekomst. Oppdatering og gjentatt import skal bevare tidligere identiteter og kreve valg ved reell konflikt.
- **R-05/R-08:** Kalenderkopi skal vise faktisk eksportutvalg og forklare utelatelser før bekreftelse, bevare tid og opptattstatus og aldri endre originalen. Eksport som ikke kan representere lagret presisjon skal ikke runde lydløst eller hevde at en tom nedlasting lyktes. Sletting og Angre skal vise riktig endring og bekrefte først etter vellykket lagring.
- **Q-01:** Neste handling skal være lett å finne på tom og fylt oversikt. Leveringspåminnelser skal bevare de separate tilstandene. Ved 1440/900/390 px, 200 % tekst og tastatur skal felt og Lagre/Avbryt være tilgjengelige uten overlapp; utkast, fokus og relevant rulling skal bevares. Vanlig tekst krever 4,5:1 kontrast, nødvendige kontrollgrenser/fokus 3:1; redusert bevegelse skal respekteres.
- **Q-01/R-06:** Tolv emnefarger skal bruke ledige plasser før gjenbruk og følge samme emne ved navneendring, visning og omlasting. Tema og farger er lokale visningspreferanser; de loves ikke overført i sikkerhetskopier. Tekniske navn og dataformater beholdes ved navnet Ajour, jf. arkitekturens AD-14 og AD-15.

## Researchgrunnlag og lignende løsninger

Dette er en avgrenset kildeoversikt, ikke en markeds- eller studentundersøkelse. De tre produktveiledningene nedenfor er lest 2026-10-26; de øvrige radene gjenbruker daterte undersøkelser som allerede finnes i prosjektet.

| Hva og når | Kilde og faktisk funn | Betydning for Ajour og begrensning |
| --- | --- | --- |
| Produktgrunnlag, 2026-10-06 | [Lærerfeedback](../../tilbakemelding-product-brief.md) vurderer problemet og hovedreisen som konkrete, men etterspør avgrenset V1, sjekkbare kriterier og sporbarhet. | Gir føringer for leveransen; er ikke dokumentasjon på studentbehov eller nytte. |
| V1-kilder, 2026-09-26 og 2026-10-01 | [Importdekning](../../studieplanlegger/IMPORT-COVERAGE.md) og [verifikasjon](../../studieplanlegger/VERIFICATION.md) beskriver daterte HiMolde-/NTNU-prøver og offentlig transport. | Underbygger et navngitt kildeutvalg, ikke nasjonal dekning eller personlig gruppetilhørighet. Hele HiMolde-programgjentakelsen er uverifisert; ingen nye live-prøver er kjørt nå. |
| Kalenderformat, 2026-10-23 | [TP CSV-formatgrunnlag](../implementation-artifacts/tp-csv-format-contract-2026-10-23.md) dokumenterer offentlig NTNU-veiledning, offisiell TP-klient og CSV-header. | Kildeinformasjon og tidsusikkerhet må bevares og forklares. Ingen private originaler er undersøkt; feltroller er ikke en full TP-spesifikasjon. |
| Kalenderalternativ, lest 2026-10-26 | [Google Calendar: oppgaver](https://support.google.com/calendar/answer/9901136?co=GENIE.Platform%3DDesktop&hl=en) beskriver planlagt tid, frist, fullføring og omplanlegging. | Har overlappende planleggingsfunksjoner. Ajours sammenhengende arbeidsflyt er et designvalg, ikke dokumentert overlegenhet eller markedsunikhet. |
| Læringsplattform, lest 2026-10-26 | [Canvas: studentkalender](https://community.instructure.com/en/kb/articles/662787-unknown) beskriver emne-/gruppekalender, oppgaver, egne gjøremål, kalenderfeed og innleveringsmarkering. | Ajour må skille lokal arbeidsstatus fra faktisk innlevering. Dette lover ingen generell Canvas-integrasjon; faktisk innlevering skjer fortsatt i lærestedets løsning. |
| Oppgavelistealternativ, lest 2026-10-26 | [Microsoft To Do](https://support.microsoft.com/en-us/todo/add-due-dates-and-reminders-in-microsoft-to-do) beskriver forfallsdatoer, påminnelser, gjentakelse og planlagtlisten. | Et relevant alternativ til deler av flyten. Studentenes preferanser og eventuell fordel ved Ajour er ikke undersøkt. |

Ingen intervjuer, studentundersøkelser eller observerte brukerresultater inngår i dette grunnlaget. Antakelsen om at koblingen mellom arbeid, tid og justering gir bedre oversikt, gjenstår å undersøke. Den planlagte egenutprøvingen kan gi konkrete observasjoner fra prosjekteieren, men ikke dokumentere bedre læring eller generell studentnytte.

## Hva som er kontrollert, antatt og planlagt

| Kategori | Gjeldende status 2026-10-26 |
| --- | --- |
| Implementert og teknisk kontrollert | R-01–R-06/R-08 og Q-01–Q-03 har avgrenset evidens i [sporbarheten](TRACEABILITY.md) og [siste dokumenterte kandidatkontroll](../../studieplanlegger/VERIFICATION.md#lokal-commitkontroll--2026-10-26). [Temarunden](../../studieplanlegger/VERIFICATION.md#emnepalett-og-mørk-modus--2026-10-26) har faktisk Node-/Docker-kontroll; eldre Docker-blokkeringer er historiske. Ingen tidligere kjøring blir ny ved denne dokumentrevisjonen. |
| Antakelser om behov og nytte | Designscenarioet, ønsket om mindre planleggingsarbeid og nytten av ett neste forslag er ikke validert med brukerundersøkelser. Tekniske tester beviser ikke læring eller generell studentnytte. |
| Planlagt egenutprøving | SC-07/R-07/S-07: **planlagt / ikke gjennomført**. Bare prosjekteieren utfører de sju manuelle scenariene i [prøveplanen](USER-TRIAL-PLAN.md). Observasjoner, feil og eventuell omprøving fylles først inn etter faktisk utførelse. |

**Endret prøveopplegg 2026-10-26:** Prosjekteieren har besluttet egenutprøving uten rekruttering av andre testpersoner. Dette erstatter den tidligere planlagte prøven med en ny student; den tidligere prøven ble ikke gjennomført eller bestått. Samme SC-07/R-07/S-07 beholdes. Egenutprøvingen dokumenterer bare prosjekteierens bruk og observasjoner. Personlig refleksjon må fortsatt bygge på prosjekteierens egne erfaringer.

## Reelle åpne spørsmål og diskusjonstemaer

| Spørsmål | Ansvar og når det følges opp |
| --- | --- |
| Hvilke deler av hovedflyten, kalenderen og temavalget oppleves uklare eller arbeidskrevende i egen bruk? | Prosjekteieren registrerer dette under de sju scenariene. Status er planlagt; ingen svar er fylt inn. |
| Er vedlikeholdet av oppgaver og anslag nyttig nok sammenlignet med egen kalender/Canvas/oppgaveliste? | Prosjekteieren kan beskrive konkrete erfaringer etter prøven. Svaret kan ikke generaliseres til målgruppen eller dokumentere bedre læring. |
| Hva er faktisk bekreftet utover lokale importprøver? | Hele HiMolde-programgjentakelsen og ekstern Outlook-import er ikke bekreftet. Eventuell senere kontroll får egen dato og avgrensning; den er ikke en ny funksjonsbestilling. |
| Hvilke øvrige vurderingsdokumenter gjelder? | Godkjent proposal og overordnet veiledning er fortsatt ikke identifisert. Prosjekteieren kan supplere med disse når de foreligger; den tilgjengelige sensorveiledningen identifiseres i planindeksen. |

## Framtidige ideer utenfor V1

Nasjonal dekning er en **visjon**, ikke et uoppfylt V1-krav. Offentlig hosting, kontoer, betaling, skysynk, generativ KI i appen, automatisk kontakt, oppmøtekontroll og automatisk innlevering/bekreftelse er utenfor V1. Eventuell framtidig research eller brainstorming om målgruppens ulike behov og flere kilder må vurderes separat. Det bestilles ingen nye funksjoner eller ekstern brukerrekruttering i denne revisjonen.

## Revisjonshistorikk og dokumentgrenser

| Dato | Betydning |
| --- | --- |
| 2026-10-16 | PRD og sporbare ID-er rekonstruert mot eksisterende kode, jf. [proveniens](README.md). |
| 2026-10-18–24 | Avgrensede import-/kalenderrettinger presiserte eksisterende krav. Aksepteksemplene er bevart i stories; faktiske kjøringer og begrensninger i VERIFICATION. |
| 2026-10-25–26 | Ajour-grensesnitt, personvernretting, emnefarger og tema innen samme V1. Historiske resultater beholdes med dato. |
| 2026-10-26, denne revisjonen | Produkt/problem/målgruppe, research og åpne spørsmål gjort lettere å finne; egenutprøving innført etter prosjekteierens beslutning; korrigert uriktige dokumentpåstander. Ingen nye produktfunksjoner. |

Implementasjonsvalg og kontrakter hører til arkitekturen. Detaljerte kjøreresultater hører til verifikasjonen. Denne PRD-en beskriver produktbehov, krav og grensen for hva dokumentasjonen kan underbygge.
