---
title: "PRD: Ajour"
status: final
created: 2026-10-16
updated: 2026-11-02
---

# PRD: avgrenset Ajour-leveranse

Denne PRD-en beskriver produktbehov, krav og avgrensninger. Prosjekteierens manuelle resultater står i [prøveplanen](USER-TRIAL-PLAN.md#egenutprøving-utført-av-prosjekteier--2026-11-01), automatiske kontroller i [verifikasjonen](../../studieplanlegger/VERIFICATION.md) og gjeldende leveringsoversikt i [planindeksen](README.md). Detaljert testutførelse føres der, ikke som produktkrav her.

**Rekonstruert 2026-10-16, revidert 2026-11-02.** Dette er den eksisterende PRD-en, oppdatert etter [lærerens tilbakemelding](../../tilbakemelding-product-brief.md) og PRD-forberedelsene gjengitt i prosjekteierens oppdrag. Den beskriver allerede utviklet funksjonalitet og kravene til egenutprøving; den er ikke en opprinnelig plan for koden. [Briefen](../../brief.md) eier produktløftet, og [planindeksen](README.md) dokumenterer proveniens.

## Hva vi skal lage og hvilket problem det skal løse

Ajour er en studieplanlegger med lokale data som knytter oppgaver til tilgjengelig tid, foreslår neste handling og lar studenten justere planen etter faktisk arbeid. Emneinformasjon, undervisning, oppgavetekster og egne notater ligger ofte hver for seg. En kalender eller fristliste alene svarer ikke nødvendigvis på hva studenten kan gjøre nå når tiden er knapp eller et anslag har endret seg. Dette er prosjektets problemforståelse, ikke et resultat fra studentintervjuer.

Hovedreisen er **oppgave → valgfritt arbeidssteg → godkjent studieøkt → utfall → justering**. Bare oppgavetittel er obligatorisk. Studenten kan legge til emne, frist, steg og arbeidsanslag senere, kontrollere en foreslått økt, registrere faktisk arbeid og velge om planen skal endres. Forslag bygger på lokale regler og opplysninger studenten har registrert. Ukjent tid forblir ukjent, og ingen planendring lagres uten godkjenning.

## Hvem løsningen er for og hvilke behov de kan ha

Målgruppen er studenter ved norske universiteter og høgskoler som må samordne flere emner og begrenset arbeidstid. Primærscenarioet er en **hypotetisk HiMolde-student** med IBE110, IBE430, IBE160 og deltidsjobb to ettermiddager. Det er et designscenario, ikke en intervjuet person. Behovsantakelsene er å kunne starte med lite registrering, finne håndterbart arbeid, se tidskonflikter og endre et urealistisk anslag uten å miste oversikten.

Studenten trenger tydelig skille mellom fullført steg, ferdig oppgave og bekreftet innlevering. Faktisk brukt tid skal holdes atskilt fra gjenstående anslag og faglig mestring. Egenutprøvingen utføres bare av prosjekteieren; målgruppen endres ikke av hvem som gjennomfører prøven. Vi har ikke dokumentert at ukjente brukere forstår appen eller at studentgruppen generelt får nytte av den.

## V1-avgrensning

V1 omfatter manuell registrering, emner og oppgaver, undervisning og tilgjengelig tid, forklarte øktforslag, arbeidsutfall, godkjent omplanlegging med Angre, lokal varig lagring og dokumentert Docker-oppstart uten konto eller betalt API. Manuell registrering skal fungere når eksterne kilder er nede. Eksisterende ordnede steg, frivillig egenvurdering/repetisjon, kalenderkopi og plansammenligning bevares.

Importløftet er fortsatt **«HiMolde IT 2026–27 og NTNU emneutvalg høst 2026»**:

- HiMolde-programprøven har IBE110 og IBE430, samt valget **IBE160 eller IBE102 + IBE152**. Undervisningsprøvene gjelder bare IBE110/IBE430/IBE160 høsten 2026.
- NTNU-prøvene gjelder emnemetadata og emnelenket undervisning for **ARK1001 og EXPH0100 høsten 2026**. Det loves ikke komplett NTNU-program, full eksamensdekning eller personlig gruppetilhørighet.
- [Importdekningen](../../studieplanlegger/IMPORT-COVERAGE.md) avgrenser lokale kontrakttester, offentlig transport og teknisk UI-kontroll. Eksisterende adaptere og supplerende prøver utvider ikke leveranseløftet. [Kjente begrensninger](../../studieplanlegger/README.md#kjente-begrensninger-ved-levering) beskriver gjenværende kilde- og driftsgrenser.

## Krav og akseptansekriterier

**Godkjent driftsutvidelse 2026-10-29:** Den komplette nettleserflyten kan publiseres i ett gratis Vercel-prosjekt uten konto, skydatabase eller delte studentdata. Lokal Node-/Docker-drift beholdes. R-01–R-06/R-08 gjelder også nettleserutgaven: emner, oppgaver, økter, utfall, justering/Angre og sikkerhetskopier skal beholde identiteter og relasjoner ved omlasting og gjenåpning på samme adresse. R-06s lokale datavolumkrav gjelder fortsatt Node/Docker; i nettutgaven er nettleserprofil og nøyaktig nettadresse lagringsgrensen. En ny publisering på samme adresse skal bevare gyldige data. Uavhengige profiler og adresser skal være adskilt. Ugyldig eller mislykket lagring/gjenoppretting skal beholde lagrede data og åpne utkast.

Nettutgaven skal forklare at sletting av nettleserdata kan slette planen, at localhost/forhåndsvisning/produksjon har separate data, og at flytting skjer med sikkerhetskopi uten enhetssynkronisering. Offentlig import bruker bare gjenkjente kildeintegrasjoner og studentens kontroll før lagring; vilkårlige kalenderadresser avvises med veiledning til filimport. Importløftet utvides ikke. Faktisk forhåndsvisning skal kontrolleres før integrering, og publisert adresse, commit og produksjonskontroll skal dokumenteres etterpå. Tekniske prøver, kildetransport og prosjekteierens manuelle egenutprøving skal dokumenteres hver for seg.

ID-ene er stabile. [Stories](EPICS-CURRENT.md) utdyper Given/When/Then, og [sporbarheten](TRACEABILITY.md) kobler hvert krav til kode, test/metode og datert evidens.

| ID | Krav og sjekkbart resultat | Brief / story |
| --- | --- | --- |
| R-01 | En oppgave kan lagres med bare tittel, også uten emne. Frivillige felt kan fylles senere; omlasting bevarer lagrede emne-/oppgave-/øktkoblinger. | SC-01 / S-01 |
| R-02 | Import bevarer kildens påkrevde emner og alternative grener. Kilde, periode, usikkerhet og endringer vises før bekreftelse. Feilet oppdatering bevarer tidligere undervisning og valg. | SC-02 / S-02 |
| R-03 | Neste handling, kapasitetsberegning og omplanlegging følger [tre separate resultatkrav](#r-03-tre-forskjellige-planleggingsresultater). Nye økter respekterer registrerte begrensninger og kjente konflikter. Oppgavenære forslag kan bruke uttrykkelig merket, betinget tilgjengelighet; den teller ikke som bekreftet kapasitet. Ukjent grunnlag forklares, og ingen økt lagres uten godkjenning. | SC-03 / S-03 |
| R-04 | Faktiske minutter og nytt gjenstående anslag registreres hver for seg. Fullført steg fullfører ikke oppgaven; fullført oppgave bekrefter ikke innlevering. | SC-04 / S-04 |
| R-05 | Forhåndsvisning skriver ikke planen. Godkjenning kontrollerer grunnlaget på nytt og lagrer samlet. Angre gjenoppretter endringen samlet når historikkoppføringen er beholdt og relevant grunnlag er uendret; foreldet grunnlag avvises uten delvis lagring. Se [bruksgrenser for R-05 og R-06](#bruksgrenser-for-r-05-og-r-06). | SC-05 / S-05 |
| R-06 | Lokal Node-/Docker-lagring bevarer identiteter og relasjoner etter omstart/gjenskaping med samme datavolum. Nettleserutgaven bevarer data på samme adresse/profil med én redigerende fane. Lagring og sikkerhetskopi/gjenoppretting følger [bruksgrenser for R-05 og R-06](#bruksgrenser-for-r-05-og-r-06); avvist eller mislykket skriving bevarer tidligere data. | SC-06 / S-06 |
| R-07 | Egenutprøving utføres av prosjekteieren etter prøveplanens sju scenarier, med syntetiske data, isolert lagring og registrerte observasjoner per scenario. Automatiske tester erstatter ikke den manuelle prøven. | SC-07 / S-07 |
| R-08 | Bevar leverte tillegg: ordnede steg, frivillig egenvurdering/repetisjon, kalenderkopi og plansammenligning. Logget tid er ikke mestring; repetisjon krever godkjenning og eksport er ikke synkronisering. | Eksisterende tillegg / S-08 |
| Q-01 | Norsk grensesnitt, merkede felt, tastaturfokus og tekstlig status/emnekode. Farge supplerer tekst. Kalender, emnefarger og System/Lyst/Mørkt er lesbare; temabytte bevarer arbeid og åpne utkast. | SC-01, SC-07 / S-01, S-07 |
| Q-02 | Ingen konto eller betalt API kreves. Studentdata lagres lokalt; private notater, rålogger og runtimefiler inngår ikke i Git-leveransen. Testdata minimeres uten å miste nødvendig kilde- og parserstruktur. | SC-02, SC-06 / S-02, S-06 |
| Q-03 | Evidens oppgir dato, metode og avgrensning. Skill fixturtest, offentlig kildetransport, teknisk UI-/Docker-kontroll og prosjekteierens manuelle egenutprøving. | Alle SC / alle stories |

### R-03: tre forskjellige planleggingsresultater

- **Neste handling:** Studenten får et startklart arbeidssteg eller en oppgave som passer valgt arbeidstid nå, med forklaring og eventuelle alternativer. Rangeringen tar hensyn til egne og avhengige oppgavers frister, avhengigheter og prioritet. Forslaget er ikke en reservasjon av ledig kalendertid. En startklar, delbar oppgave uten arbeidssteg med **1200 minutter gjenstående** kan foreslås som **30 minutters arbeid nå** uten å endre totalanslaget eller fullføre oppgaven.
- **Kapasitetsberegning:** Registrert gjenstående arbeid vurderes mot bekreftede arbeidsvinduer, opptatt tid, frister, avhengigheter, reservasjoner og økt-/pauseregler. Reservert, foreslått, manglende og ledig tid forklares. Beregningen skriver ikke planen og er ikke i seg selv en godkjent øktplan.
- **Omplanlegging:** Konkrete framtidige økter bruker bekreftede arbeidsvinduer når de finnes og respekterer kjent opptatt tid, frister, avhengigheter og økt-/pauseregler. Uten bekreftede vinduer kan den oppgavenære flyten bruke et valgt studietidsmønster som preferanse eller, uten et slikt valg, vise ett tydelig merket, betinget forslag på 30 minutter. Studenten ser forutsetningene og kan kontrollere, redigere, godkjenne eller forkaste øktene; grunnlaget kontrolleres på nytt ved godkjenning etter R-05. Et betinget forslag eller en lagret enkeltøkt gjør ikke den antatte tilgjengeligheten til bekreftet, gjentakende kapasitet.

En oppgave med bare tittel kan lagres straks. Ved ukjent gjenstående arbeid kan den oppgavenære flyten foreslå en kort utforskende startøkt som studenten godkjenner konkret. Totalanslaget forblir ukjent, og økten betyr ikke at hele arbeidsmengden er planlagt eller at arbeid er utført. Studenten kan senere oppgi et anslag eller et kjent arbeidssteg; arbeidssteg forblir valgfrie. [S-03](EPICS-CURRENT.md#s-03--gjennomførbare-forslag-r-03-sc-03) utdyper akseptansen, [brukerveiledningen](../../studieplanlegger/README.md#oppgaver-arbeidssteg-og-egenvurdering) beskriver den betingede flyten, og [løsningsguiden](../implementation-artifacts/solution-guide.md#tre-forskjellige-planleggingsfunksjoner) skiller funksjonene.

### Bruksgrenser for R-05 og R-06

- **Angre:** De 30 nyeste Angre-oppføringene beholdes ved reelle endringer, med separat papirkurv. Angre mot endret relevant grunnlag avvises uten overskriving; det loves ikke ubegrenset historikk. Se [historikk og lagring](../../studieplanlegger/README.md#kalender-og-lokale-data).
- **Driftsform:** Nettleserutgaven forutsetter én redigerende fane og tilgjengelig nettleserlagring. Konfliktvernet gir ikke samme garanti ved samtidig redigering som Node-/SQLite-revisjonskontroll. Nettleserkvote gjelder fortsatt; sletting av nettleserdata kan også fjerne den lokale gjenopprettingskopien.
- **Sikkerhetskopi:** Filer over **20 000 000 byte** avvises før forhåndsvisning i alle driftsformer. En mindre fil er ikke garantert å få plass i nettleserens lagring. Portabel kopi bevarer støttede domenedata og relasjoner, men utelater kalenderforbindelser og kjente tilgangsnøkler; kildene må kobles til igjen. Tema og emnefargepreferanser følger heller ikke kopien. Fullt innhold, gjenopprettingsvalg og feilgrenser beskrives i [backupavtalen](../../studieplanlegger/README.md#sikkerhetskopi-og-lagring).

### R-08: behovene de bevarte tilleggene støtter

| Tillegg | Tiltenkt brukerbehov og avgrensning |
| --- | --- |
| Ordnede arbeidssteg | Dele arbeid i håndterbare handlinger uten at et fullført steg fullfører hele oppgaven. |
| Frivillig egenvurdering og repetisjon | Registrere egen vurdering og velge eventuell videre øving; logget tid dokumenterer ikke mestring, og ingen repetisjonsøkt lagres uten godkjenning. |
| Kalenderkopi | Ta med et kontrollert utvalg til en annen kalender; eksporten er verken synkronisering eller full sikkerhetskopi. |
| Plansammenligning | Vurdere planalternativer før studenten velger; sammenligningen skriver ikke planen. |

Dette begrunner bevaring innen låst V1, ikke dokumentert nytte eller en bestilling av flere funksjoner. Kjerneflyt, databevaring og retting prioriteres før nye tillegg. [S-08](EPICS-CURRENT.md#s-08--bevare-eksisterende-tillegg-r-08-støtter-sc-04sc-05) inneholder aksepteksemplene.

### Videreførte presiseringer av eksisterende krav

Dette samler presiseringene fra 18.–26. oktober uten nye funksjoner. Detaljerte eksempler er bevart i [stories](EPICS-CURRENT.md), [importavtalen](../../studieplanlegger/IMPORT.md) og [arkitekturen](architecture/architecture-studieplanlegger-2026-09-06/ARCHITECTURE-SPINE.md).

- **R-02/R-05/R-06:** Import skal gi én forståelig vei fra kildevalg via forhåndsvisning og nødvendige gruppeavklaringer til samlet bekreftelse. Gyldige valg, manuelle koblinger, uttrykkelig uten-emne-valg og beholdte utelatelser skal overleve oppdatering. Kildeskifte og forsinkede svar skal ikke overskrive nyere utkast. Entydige navn og koblinger gjenbrukes; manglende, provisorisk eller motstridende informasjon skal vises ærlig. Samme emnekode ved ulike læresteder skal ikke blandes.
- **R-02/R-03:** Kildens periode og nøyaktige tidspunkt skal bevares. Manglende, like eller ugyldige sluttider gir ikke automatisk varighet, kapasitet, eksamen eller frist. Nødvendig valg mellom retting, punkt uten varighet og utelatelse skal forklares. Ugyldige kalenderdeler skal ikke flyttes til oppdiktede datoer eller slette gyldige data; kildeavlysninger skal treffe riktig forekomst. Oppdatering og gjentatt import skal bevare tidligere identiteter og kreve valg ved reell konflikt.
- **R-05/R-08:** Kalenderkopi skal vise faktisk eksportutvalg og forklare utelatelser før bekreftelse, bevare tid og opptattstatus og aldri endre originalen. Eksport som ikke kan representere lagret presisjon skal ikke runde lydløst eller hevde at en tom nedlasting lyktes. Sletting og Angre skal vise riktig endring og bekrefte først etter vellykket lagring.
- **Q-01:** Tom oversikt skal tilby registrering med bare tittel og valgfri import. På fylt oversikt skal tidsspørsmål, hurtigvalg, egendefinert tid og Start være samlet; på mobil kommer Start etter den korte introduksjonen, jf. [eksisterende aksepteksempler](EPICS-CURRENT.md#lokal-ajour-oppfølging--2026-10-26). Leveringspåminnelser skal bevare de separate tilstandene. Ved 1440/900/390 px, 200 % tekst og tastatur skal felt og Lagre/Avbryt være tilgjengelige uten overlapp; utkast, fokus og relevant rulling skal bevares. Vanlig tekst krever 4,5:1 kontrast, nødvendige kontrollgrenser/fokus 3:1; redusert bevegelse skal respekteres.
- **Q-01/R-06:** Tolv emnefarger skal bruke ledige plasser før gjenbruk og følge samme emne ved navneendring, visning og omlasting. Tema og farger er lokale visningspreferanser; de loves ikke overført i sikkerhetskopier. Tekniske navn og dataformater beholdes ved navnet Ajour, jf. arkitekturens AD-14 og AD-15.

## Researchgrunnlag og lignende løsninger

Dette er en avgrenset kildeoversikt, ikke en markeds- eller studentundersøkelse. De tre produktveiledningene nedenfor er lest 2026-10-26; de øvrige radene gjenbruker daterte undersøkelser som allerede finnes i prosjektet.

| Hva og når | Kilde og faktisk funn | Betydning for Ajour og begrensning |
| --- | --- | --- |
| Produktgrunnlag, 2026-10-06 | [Lærerfeedback](../../tilbakemelding-product-brief.md) vurderer problemet og hovedreisen som konkrete, men etterspør avgrenset V1, sjekkbare kriterier og sporbarhet. | Gir føringer for leveransen; er ikke dokumentasjon på studentbehov eller nytte. |
| V1-kilder, avgrenset 2026-10-16 | [Importdekningen](../../studieplanlegger/IMPORT-COVERAGE.md) beskriver grunnlaget for det navngitte HiMolde-/NTNU-utvalget. | Kildeavhengigheten begrunner et begrenset importløfte og manuell registrering som alternativ, uten løfte om nasjonal dekning eller personlig gruppetilhørighet. |
| Kalenderformat, 2026-10-23 | [TP CSV-formatgrunnlag](../implementation-artifacts/tp-csv-format-contract-2026-10-23.md) dokumenterer offentlig NTNU-veiledning, offisiell TP-klient og CSV-header. | Kildeinformasjon og tidsusikkerhet må bevares og forklares. Ingen private originaler er undersøkt; feltroller er ikke en full TP-spesifikasjon. |
| Kalenderalternativ, lest 2026-10-26 | [Google Calendar: oppgaver](https://support.google.com/calendar/answer/9901136?co=GENIE.Platform%3DDesktop&hl=en) beskriver planlagt tid, frist, fullføring og omplanlegging. | Har overlappende planleggingsfunksjoner. Ajours sammenhengende arbeidsflyt er et designvalg, ikke dokumentert overlegenhet eller markedsunikhet. |
| Læringsplattform, lest 2026-10-26 | [Canvas: studentkalender](https://community.instructure.com/en/kb/articles/662787-unknown) beskriver emne-/gruppekalender, oppgaver, egne gjøremål, kalenderfeed og innleveringsmarkering. | Ajour må skille lokal arbeidsstatus fra faktisk innlevering. Dette lover ingen generell Canvas-integrasjon; faktisk innlevering skjer fortsatt i lærestedets løsning. |
| Oppgavelistealternativ, lest 2026-10-26 | [Microsoft To Do](https://support.microsoft.com/en-us/todo/add-due-dates-and-reminders-in-microsoft-to-do) beskriver forfallsdatoer, påminnelser, gjentakelse og planlagtlisten. | Et relevant alternativ til deler av flyten. Studentenes preferanser og eventuell fordel ved Ajour er ikke undersøkt. |

Ingen intervjuer eller studentundersøkelser inngår i researchgrunnlaget ovenfor. Prosjekteierens egne observasjoner dokumenteres separat i prøveplanen. De kan belyse egen bruk, men dokumenterer ikke bedre læring eller generell studentnytte. Antakelser om målgruppens behov må fortsatt skilles fra det én prosjekteier har erfart.

## Krav, antakelser og evidens

| Kategori | Dokumentasjonsgrense |
| --- | --- |
| Produktkrav og teknisk kontroll | R-01–R-06/R-08 og Q-01–Q-03 spores til kode og daterte kontroller i [sporbarheten](TRACEABILITY.md) og [verifikasjonen](../../studieplanlegger/VERIFICATION.md). En dokumentrevisjon gjør ikke en tidligere kjøring til en ny test. |
| Antakelser om behov og nytte | Designscenarioet, ønsket om mindre planleggingsarbeid og nytten av ett neste forslag er ikke validert med brukerundersøkelser. Tekniske tester beviser ikke læring eller generell studentnytte. |
| Egenutprøving | SC-07/R-07/S-07 gjelder prosjekteierens egen manuelle betjening og observasjoner. [Prøveplanen](USER-TRIAL-PLAN.md) eier faktisk utførelse, før-/etter-resultater og avgrensninger. Automatiske kontroller kan ikke fylle inn eierens erfaringer. |

### Prioriterte nyttehypoteser

Funksjonskrav kan være oppfylt uten at ønsket hverdagsnytte er dokumentert. Følgende antakelser er derfor beholdt som uavklarte hypoteser; de innfører ingen nye beståttgrenser eller prøvekrav.

| Hypotese | Status og eksisterende grunnlag | Konsekvens hvis den svikter |
| --- | --- | --- |
| Studenten vedlikeholder anslag, arbeidsvinduer og oppgaver tilstrekkelig. | Stabil bruksvane er ikke dokumentert. Egenutprøvingen viser avgrensede registreringsforløp, ikke vedlikehold over tid. | Forslag og kapasitetsvurderinger kan bygge på utdaterte opplysninger. |
| Planleggingshjelpen sparer mer arbeid enn registreringen krever. | Uavklart. Funksjonsprøvene måler ikke netto tidsbesparelse eller arbeidsbelastning. | En teknisk korrekt løsning kan oppleves som merarbeid. |
| Ett begrunnet neste forslag gjør det lettere å komme i gang. | Forslagsatferd er prøvd innen [dokumentert omfang](USER-TRIAL-PLAN.md); effekt på oppstart eller generell studentnytte er ikke etablert. | Kjernefunksjonen kan gi mindre nytte enn ønsket. |

Prosjekteieren kan knytte allerede dokumenterte erfaringer til hypotesene ved personlig sluttgjennomlesing. Ubesvarte hypoteser forblir akseptert uvisshet i V1; eventuell senere undersøkelse krever et eget opplegg. Det føres ingen etterkonstruerte tidsmål eller resultater.

**Endret prøveopplegg 2026-10-26:** Prosjekteieren har besluttet egenutprøving uten rekruttering av andre testpersoner. Dette erstatter den tidligere planlagte prøven med en ny student; den tidligere prøven ble ikke gjennomført eller bestått. Samme SC-07/R-07/S-07 beholdes. Egenutprøvingen dokumenterer bare prosjekteierens bruk og observasjoner. Personlig refleksjon må fortsatt bygge på prosjekteierens egne erfaringer.

**Avstemt dokumentasjonsstatus 2026-11-02:** R-07s sjuscenariokrav er beholdt. Full oppfyllelse av alle opprinnelige scenariodetaljer er ikke dokumentert; de rapporterte omprøvingene beholder bestått innen sitt omfang. [Scenariooversikten](USER-TRIAL-PLAN.md#scenario-dekning-2026-11-02) kobler eksisterende observasjoner til hvert scenario og viser grensene. Denne presiseringen endrer ikke akseptomfanget i ettertid og bestiller ingen ny prøverunde.

## Reelle åpne spørsmål og diskusjonstemaer

| Spørsmål | Beslutningsstatus | Ansvar og oppfølging |
| --- | --- | --- |
| Hvilke deler av hovedflyten, kalenderen og temavalget oppleves uklare eller arbeidskrevende i egen bruk? | Avklares mot eksisterende erfaringer ved personlig sluttgjennomlesing. | Prosjekteieren kontrollerer at refleksjonen samsvarer med [rapporterte observasjoner](USER-TRIAL-PLAN.md). Uobserverte forhold markeres som ukjente; en ny brukertest er ikke bestilt. |
| Er vedlikeholdet nyttig nok sammenlignet med egen kalender/Canvas/oppgaveliste? | Akseptert uvisshet i V1; generell nytte er framtidig research. | Prosjekteieren kan beskrive eksisterende egne erfaringer ved sluttgjennomlesing. En bredere vurdering tas bare opp dersom videre produktarbeid bestilles; ingen dato eller nyttegevinst er fastsatt. |
| Hva er faktisk bekreftet utover lokale importprøver? | Aksepterte, daterte kilde- og dekningsgrenser i V1. | Prosjekteieren bruker [importdekning](../../studieplanlegger/IMPORT-COVERAGE.md), [prøveplan](USER-TRIAL-PLAN.md) og [verifikasjon](../../studieplanlegger/VERIFICATION.md) ved levering og oppdaterer dem ved eventuelle nye kontroller. Enkeltprøver utvider ikke kildekravet. |
| Hvilke øvrige vurderingsdokumenter gjelder? | Manglende kildegrunnlag må håndteres i den formelle leveringskontrollen. | Prosjekteieren kontrollerer offisiell beskjed før innlevering, jf. [leveringskontrollen](README.md#leveringskontroll--2026-11-01). Godkjent proposal og overordnet veiledning er fortsatt ikke identifisert; ingen manglende krav eller frist gjettes. |

## Framtidige ideer utenfor V1

Nasjonal dekning er en **visjon**, ikke et uoppfylt V1-krav. Kontoer, betaling, skysynk, generativ KI i appen, automatisk kontakt, oppmøtekontroll og automatisk innlevering/bekreftelse er utenfor V1. Offentlig hosting var utenfor før 2026-10-29; den daterte driftsutvidelsen tillater bare ett gratis Vercel-prosjekt med nettleserlokale studentdata. Eventuell framtidig research eller brainstorming om målgruppens ulike behov og flere kilder må vurderes separat. Ekstern brukerrekruttering bestilles ikke.

## Revisjonshistorikk og dokumentgrenser

| Dato | Betydning |
| --- | --- |
| 2026-10-16 | PRD og sporbare ID-er rekonstruert mot eksisterende kode, jf. [proveniens](README.md). |
| 2026-10-18–24 | Avgrensede import-/kalenderrettinger presiserte eksisterende krav. Aksepteksemplene er bevart i stories; faktiske kjøringer og begrensninger i VERIFICATION. |
| 2026-10-25–26 | Ajour-grensesnitt, personvernretting, emnefarger og tema innen samme V1. Historiske resultater beholdes med dato. |
| 2026-10-26 | Produkt/problem/målgruppe, research og åpne spørsmål gjort lettere å finne; egenutprøving innført etter prosjekteierens beslutning; korrigert uriktige dokumentpåstander. Ingen nye produktfunksjoner. |
| 2026-10-29 | Uttrykkelig godkjent Vercel-nettleserdrift med komplett hovedflyt, lokale data og avgrenset import. Eldre lokalavgrensning beholdes som historikk; faktiske prøver føres separat. |
| 2026-11-01 | Dokumentasjonsgrensene tydeliggjort: mål, brukerbehov, krav og omfang her; eierens sluttresultater og automatiske kontrollresultater i prøve-/verifikasjonsdokumentasjonen. Krav-ID-er og V1 er uendret. |
| 2026-11-02 | Etter godkjent PRD-kritikk: R-03s tre resultater, eksisterende Angre-/lagringsgrenser, behovsbegrunnelse for R-08, nyttehypoteser og oppfølging av åpne spørsmål presisert. R-07 er avstemt mot dokumentert scenariodekning uten nye prøveresultater eller endret V1. |
| 2026-11-02, etter validering | R-03/S-03 avstemt mot eksisterende betingede og utforskende startøkter. Q-01 har observerbar innholdsrekkefølge, og kravtabellen har direkte avsnittslenker. Dette retter tre dokumentfunn uten ny funksjonalitet eller nye manuelle prøveresultater. |

Implementasjonsvalg og kontrakter hører til arkitekturen. Detaljerte kjøreresultater hører til verifikasjonen. Denne PRD-en beskriver produktbehov, krav og grensen for hva dokumentasjonen kan underbygge.
