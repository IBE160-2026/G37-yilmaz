---
title: "PRD: Ajour"
status: final
created: 2026-10-16
updated: 2026-11-12
---

# PRD: Ajour

Ajour knytter oppgaver til tilgjengelig tid og hjelper studenten å velge, gjennomføre og justere eget studiearbeid. Denne PRD-en beskriver gjeldende V1. **R-01–R-08** er funksjons- og utprøvingskrav, **Q-01–Q-03** er kvalitetskrav, **SC-01–SC-07** er briefens suksesskriterier og **S-01–S-08** er tilhørende [stories](EPICS-CURRENT.md). ID-ene beholdes; UJ-1–UJ-4 nedenfor illustrerer bruken.

[Briefen](../../brief.md) eier produktløftet. [Planindeksen](README.md#prd-revisjonshistorikk) bevarer rekonstruksjonsproveniens, beslutninger og revisjonshistorikk; [prøveplanen](USER-TRIAL-PLAN.md#egenutproving-2026-11-04) og [verifikasjonen](../../studieplanlegger/VERIFICATION.md) eier daterte resultater. Oppdateringen følger [PRD-tilbakemeldingen 12. november](tilbakemelding-prd.md), uten å utvide V1 eller endre tidligere resultater.

## Hva vi skal lage og hvilket problem det skal løse

Emneinformasjon, undervisning, oppgavetekster og egne notater ligger ofte hver for seg. En kalender eller fristliste alene svarer ikke nødvendigvis på hva studenten kan gjøre nå når tiden er knapp eller et anslag har endret seg. Ajours hovedflyt er **oppgave → valgfritt arbeidssteg → godkjent studieøkt → utfall → justering**. Bare oppgavetittel er obligatorisk; emne, frist, steg og anslag kan fylles inn senere. Ukjent tid forblir ukjent, og ingen planendring lagres uten godkjenning.

## Hvem løsningen er for og hvilke behov de kan ha

Målgruppen er studenter ved norske universiteter og høgskoler som samordner flere emner og begrenset arbeidstid. Primærscenarioet er en hypotetisk HiMolde-student med IBE110, IBE430, IBE160 og deltidsjobb to ettermiddager. Behovsantakelsene er å starte med lite registrering, finne håndterbart arbeid, se tidskonflikter og justere urealistiske anslag.

Dette er prosjektets problemforståelse og designscenario, ikke intervjufunn. Egenutprøvingen utføres bare av prosjekteieren; den endrer ikke målgruppen eller dokumenterer generell studentnytte. Fullført arbeidssteg, ferdig oppgave og bekreftet innlevering er forskjellige tilstander. Faktisk tid, gjenstående anslag og faglig mestring holdes atskilt.

## V1-avgrensning

V1 omfatter manuell registrering, emner og oppgaver, undervisning og tilgjengelig tid, forklarte øktforslag, arbeidsutfall, godkjent omplanlegging med Angre og lokal varig lagring uten konto eller betalt API. Manuell registrering skal fungere når eksterne kilder er nede. Eksisterende ordnede steg, frivillig egenvurdering/repetisjon, kalenderkopi og plansammenligning bevares. Kjerneflyt, databevaring og retting prioriteres før nye tillegg.

Importløftet er **«HiMolde IT 2026–27 og NTNU emneutvalg høst 2026»**:

- HiMolde-programprøven har IBE110 og IBE430, samt valget **IBE160 eller IBE102 + IBE152**. Undervisningsprøvene gjelder bare IBE110/IBE430/IBE160 høsten 2026.
- NTNU-prøvene gjelder emnemetadata og emnelenket undervisning for **ARK1001 og EXPH0100 høsten 2026**. Komplett NTNU-program, full eksamensdekning og personlig gruppetilhørighet inngår ikke.
- [Importdekningen](../../studieplanlegger/IMPORT-COVERAGE.md) skiller lokale kontrakttester, offentlig transport og teknisk UI-kontroll. Eksisterende adaptere og supplerende prøver utvider ikke løftet; [kjente begrensninger](../../studieplanlegger/README.md#kjente-begrensninger-ved-levering) gjelder fortsatt.

Leveransen beholder dokumentert lokal Node-/Docker-oppstart og den godkjente nettleserutgaven i **ett gratis Vercel-prosjekt**, uten skydatabase, konto eller delte studentdata. Hovedflyten R-01–R-06/R-08 gjelder begge driftsformer. Teknologivalg og driftsmekanismer står i [arkitekturen](architecture/architecture-studieplanlegger-2026-09-06/ARCHITECTURE-SPINE.md); R-06 beskriver brukerens lagringsgrenser.

## Felles begreper

| Begrep | Betydning i krav og brukerreiser |
| --- | --- |
| Oppgave | Arbeid studenten vil utføre. Kan opprettes med bare tittel og ha eget anslag og fullføringsstatus. |
| Arbeidssteg | Valgfri, avgrenset handling innen en oppgave. Fullføring gjelder steget, ikke automatisk oppgaven. |
| Studieøkt | Godkjent, tidfestet arbeidsperiode knyttet til en oppgave. Et øktforslag er ikke lagret før godkjenning; et bestemt stegmål må være uttrykkelig identifisert. |
| Neste handling / Start | Forslag til arbeid nå ut fra valgt arbeidstid. Det er ikke i seg selv en reservasjon i kalenderen. |
| Utfall | Registrering etter arbeid: faktisk tid og eventuelle uttrykkelige valg om anslag eller fullføring. |
| Arbeidsvindu | Tidsrom studenten har bekreftet som tilgjengelig for studiearbeid. |
| Tilgjengelig tid | Studentens valgte arbeidstid nå eller registrert framtidig tid; sammenhengen skal framgå. |
| Betinget tilgjengelighet | Antatt tid bak et tydelig merket forslag. Den teller ikke som bekreftet, gjentakende kapasitet. |
| Oppgavenært forslag | Forslag om en konkret økt fra en oppgaves flyt, også ved ukjent anslag eller manglende arbeidsvinduer. |
| Gjenstående anslag | Studentens anslag for arbeid som gjenstår. Ukjent anslag er ikke null. |
| Faktisk tid | Registrerte minutter brukt på arbeid; de dokumenterer verken gjenstående arbeid eller mestring. |
| Bekreftet innlevering | Studentens særskilte bekreftelse på levering. Ferdig oppgave eller steg setter ikke denne statusen. |

## Brukerreiser

**UJ-1–UJ-4 er hypotetiske redaksjonelle illustrasjoner av eksisterende krav**, strukturert fra hovedflyten og tilbakemeldingen. Mina er et navn på designscenarioet, ikke en intervjuet eller observert student. Reisene innfører ingen nye funksjoner eller prøveresultater.

### UJ-1: Mina kommer i gang med lite registrering

Mina har de tre HiMolde-emnene og deltidsjobb to ettermiddager. I en tom oversikt registrerer hun en oppgave med bare tittel. Emne og arbeidssteg kan vente. Fra oppgaven ser hun et kort, utforskende øktforslag; ukjent totalarbeid og eventuell betinget tilgjengelighet er synlige. Hun kontrollerer tidspunktet og godkjenner. Kalenderen viser den lagrede økten, mens totalanslaget fortsatt er ukjent. Verdien er en konkret start uten at planen hevder at hele oppgaven er planlagt. **Realiserer R-01, R-03, R-05 og Q-01.**

### UJ-2: Mina kontrollerer import før den påvirker planen

Mina åpner **Mine emner → Finn studieprogram** og velger HiMolde-prøven. Forhåndsvisningen viser kilde, periode, påkrevde emner og valget IBE160 eller IBE102 + IBE152. Hun velger IBE160 og avklarer nødvendige undervisningsvalg før samlet bekreftelse. Etter lagring ser hun undervisningen i planen. Ved en senere kildefeil beholder hun tidligere undervisning og valg; hun kan fortsatt registrere manuelt. Verdien er oversikt med synlig kildegrunnlag og kontroll over endringene. **Realiserer R-02, R-05 og R-06.**

### UJ-3: Mina justerer etter mindre arbeid enn planlagt

Mina fikk gjort 20 av 60 planlagte minutter. I utfallsregistreringen fører hun 20 faktiske minutter og vurderer gjenstående anslag separat. Et fullført arbeidssteg gjør ikke oppgaven ferdig eller levert. Hun åpner omplanlegging, ser foreslåtte økter og hva som flyttes innen hennes bekreftede arbeidsvinduer, og godkjenner etter kontroll. Deretter velger hun Angre, og planen går samlet tilbake til tilstanden før endringen når grunnlaget fortsatt er uendret. Verdien er en justerbar plan uten falsk framgang. **Realiserer R-03, R-04 og R-05.**

### UJ-4: Mina beholder arbeidet og flytter en kopi

Mina åpner nettutgaven igjen på samme adresse og profil og finner lagrede oppgaver, økter og utfall med koblingene bevart. Før hun flytter planen, tar hun en portabel sikkerhetskopi, kontrollerer forhåndsvisningen ved gjenoppretting i en separat tom profil og bekrefter med **Erstatt lokale data**. Støttede domenedata og relasjoner følger kopien; kalenderforbindelser må kobles til igjen, og tema/emnefarger følger ikke med. Verdien er kontrollert videreføring av arbeidet med forståelige lagringsgrenser, uten løfte om synkronisering. **Realiserer R-05, R-06 og Q-02.**

## Suksesskriterier og motmål

Følgende **SC-01–SC-07 gjengir briefens eksisterende kriterier**. R-03 og R-06 presiserer henholdsvis betinget planlegging og de to driftsformene. Kriteriene er krav til leveransen, ikke påstander om nye målinger; faktisk kontroll og status finnes i [sporbarheten](TRACEABILITY.md), prøveplanen og verifikasjonen.

| ID | Sjekkbart suksesskriterium |
| --- | --- |
| SC-01 | En tom planlegger kan lagre ett manuelt emne, en oppgave med bare tittel og én godkjent økt; koblingene beholdes ved omlasting. |
| SC-02 | Den avgrensede importen beholder kildevalgene og krever kontroll av endringer; kildefeil sletter ikke tidligere undervisning. |
| SC-03 | Nye øktforslag bruker registrerte arbeidsvinduer, unngår kjent opptatt tid og respekterer kjente avhengigheter; manglende tid og usikkert grunnlag forklares, ugyldige eller foreldede endringer avvises. |
| SC-04 | Registrering av faktisk tid endrer ikke automatisk gjenstående anslag; steg, arbeid og innlevering fullføres separat. |
| SC-05 | Et forslag skriver ingen økter før godkjenning; godkjente endringer kan angres samlet. |
| SC-06 | Emner, oppgaver, økter og relasjoner overlever omstart/gjenskaping med samme lokale datavolum. |
| SC-07 | Prosjekteieren gjennomfører sju manuelle scenarier med syntetiske data i isolert testmiljø og dokumenterer forventet mot faktisk resultat, feil og eventuell omprøving. |

Motmålene er å unngå mer obligatorisk registrering før første forslag, skjulte planendringer og framgang som bare skyldes logget tid. De følger R-01/R-03, R-05 og R-04: bare tittel er obligatorisk, godkjenning kreves, og tid, anslag og fullføring holdes atskilt. Ved eventuell senere nytteundersøkelse kan registreringsarbeid og behov for manuell retting vurderes sammen med forslagenes nytte. Det fastsettes ingen ny tallgrense, måling eller prøverunde her.

## Krav og akseptansekriterier

Konsekvensene nedenfor utdyper eksisterende ID-er. Nummererte underpunkter er lokale lesepunkter, ikke nye krav-ID-er. [Stories](EPICS-CURRENT.md) har Given/When/Then; [sporbarheten](TRACEABILITY.md) kobler kravene til kode, metode og datert evidens.

### R-01: registrere med lite grunnlag

Studenten kan lagre en oppgave med bare tittel, også uten emne, og fylle frivillige felt senere. Omlasting bevarer lagrede emne-/oppgave-/øktkoblinger. **SC-01 / S-01; UJ-1.**

### R-02: kontrollere og bevare import

Studenten kan kontrollere kilde, periode, usikkerhet og endringer før samlet bekreftelse. **SC-02 / S-02; UJ-2.**

1. Kildens påkrevde emner, alternative grener og nødvendige gruppeavklaringer bevares. I nettutgaven støttes bare gjenkjente kildeintegrasjoner; vilkårlige kalenderadresser avvises med veiledning til filimport. Lokal Node-/Docker-drift og Vite beholder støtte for offentlige HTTPS-/webcal-adresser innen eksisterende kildevern, jf. importavtalen.
2. Feilet oppdatering bevarer tidligere undervisning og valg. Gyldige valg, manuelle koblinger, uttrykkelig uten-emne-valg og beholdte utelatelser overlever oppdatering. Kildeskifte eller forsinkede svar overskriver ikke nyere utkast.
3. Entydige navn og koblinger gjenbrukes. Manglende, provisorisk og motstridende informasjon vises som usikker; samme emnekode fra ulike læresteder blandes ikke. Oppdatering/gjentatt import beholder identiteter og krever valg ved reell konflikt.
4. Periode og nøyaktige tidspunkt bevares. Manglende, like eller ugyldige sluttider skaper ikke varighet, kapasitet, eksamen eller frist. Valg mellom retting, punkt uten varighet og utelatelse forklares. Ugyldige kalenderdeler flyttes ikke til oppdiktede datoer og fører ikke til at gyldige data slettes; avlysninger treffer riktig forekomst.

[Importavtalen](../../studieplanlegger/IMPORT.md) utdyper kildekontraktene.

### R-03: tre forskjellige planleggingsresultater

Studenten kan velge arbeid nå, vurdere kapasitet og kontrollere framtidige økter som tre forskjellige resultater. **SC-03 / S-03; UJ-1 og UJ-3.**

1. **Neste handling:** Et startklart arbeidssteg eller en oppgave passer valgt arbeidstid nå, med forklaring og eventuelle alternativer. Rangering tar hensyn til egne og avhengige oppgavers frister, avhengigheter og prioritet. Forslaget reserverer ikke kalendertid. En startklar, delbar oppgave uten steg med **1200 minutter gjenstående** kan gi **30 minutters arbeid nå** uten å endre anslaget eller fullføre oppgaven.
2. **Kapasitetsberegning:** Gjenstående arbeid vurderes mot bekreftede arbeidsvinduer, opptatt tid, frister, avhengigheter, reservasjoner og økt-/pauseregler. Reservert, foreslått, manglende og ledig tid forklares. Beregningen skriver ikke planen og godkjenner ingen økter.
3. **Omplanlegging:** Framtidige økter bruker bekreftede arbeidsvinduer når de finnes og respekterer kjent opptatt tid, frister, avhengigheter og økt-/pauseregler. Uten bekreftede vinduer kan den oppgavenære flyten bruke valgt studietidsmønster som preferanse eller ellers vise ett tydelig merket, betinget forslag på **30 minutter**. Studenten ser forutsetningene og kan kontrollere, redigere, godkjenne eller forkaste. R-05 krever ny kontroll ved godkjenning. Betingede forslag eller lagrede enkeltøkter skaper ikke bekreftet, gjentakende kapasitet.

Ukjent gjenstående arbeid kan gi en kort utforskende startøkt som studenten godkjenner konkret. Totalanslaget forblir ukjent; økten betyr ikke at alt arbeid er planlagt eller utført. Studenten kan senere angi et anslag eller et kjent steg; steg forblir valgfrie.

Arbeid kan gjelde hele oppgaven eller et bestemt steg. En oppgave med steg gjør ikke enhver reservasjon til stegarbeid. Når Neste handling/Start presenterer et bestemt steg som mål, identifiserer utfallet dette steget entydig og beholder koblingen ved lagring, navneendring og omrekkefølge. Kjente koblinger bevares uten å gjette historiske mål. [S-03](EPICS-CURRENT.md#s-03--gjennomførbare-forslag-r-03-sc-03), [brukerveiledningen](../../studieplanlegger/README.md#oppgaver-arbeidssteg-og-egenvurdering) og [løsningsguiden](../implementation-artifacts/solution-guide.md#tre-forskjellige-planleggingsfunksjoner) utdyper flytene.

### R-04: registrere utfall uten falsk framgang

Studenten registrerer faktiske minutter og nytt gjenstående anslag hver for seg. Fullført steg fullfører ikke oppgaven; fullført oppgave bekrefter ikke innlevering. Når et eksisterende steg uttrykkelig merket som avklaring av venting fullføres, oppheves denne ventingen; andre uoppfylte forutsetninger beholdes. **SC-04 / S-04; UJ-3.**

### Bruksgrenser for R-05 og R-06

#### R-05: godkjenne og angre samlet

Studenten kan kontrollere en endring før lagring og angre den samlet innen beholdt historikk. **SC-05 / S-05; UJ-1–UJ-3.**

1. Forhåndsvisning endrer ingen lagrede økter.
2. Godkjenning kontrollerer grunnlaget på nytt og lagrer samlet. Ugyldig eller foreldet grunnlag avvises uten delvis lagring.
3. Angre tilbakestiller hele endringen når oppføringen er beholdt og relevant grunnlag er uendret. Endret grunnlag gir avvisning og beholder dagens plan.
4. De **30 nyeste Angre-oppføringene** beholdes ved reelle endringer, med separat papirkurv. Det loves ikke ubegrenset historikk.
5. Sletting og Angre viser riktig endring og bekrefter først etter vellykket lagring.

Se [historikk og lagring](../../studieplanlegger/README.md#kalender-og-lokale-data).

#### R-06: beholde og gjenopprette lokale data

Studenten kan gjenåpne lagrede data og flytte støttede data med sikkerhetskopi innen tydelige driftsgrenser. **SC-06 / S-06; UJ-2 og UJ-4.**

1. Lokal Node-/Docker-drift bevarer identiteter og relasjoner etter omstart/gjenskaping med samme datavolum. Nettutgaven bevarer emner, oppgaver, økter, utfall, justering/Angre og sikkerhetskopier ved omlasting/gjenåpning på samme nøyaktige adresse og profil. Ny publisering på samme adresse bevarer gyldige data.
2. Uavhengige profiler og adresser er adskilt. Nettutgaven forklarer at localhost, forhåndsvisning og produksjon har egne data, og at flytting krever sikkerhetskopi uten enhetssynkronisering.
3. Nettutgaven forutsetter tilgjengelig nettleserlagring og **én redigerende fane**; den lover ikke samme konfliktvern ved samtidig redigering som lokal serverdrift. Nettleserkvote gjelder, og sletting av nettleserdata kan fjerne både planen og lokal gjenopprettingskopi. Dette forklares til studenten.
4. Ugyldig eller mislykket lagring/gjenoppretting bevarer tidligere data og åpne utkast.
5. Sikkerhetskopier over **20 000 000 byte** avvises før forhåndsvisning i alle driftsformer. Mindre filer er ikke garantert å få plass i nettleserlagringen.
6. Portabel kopi bevarer støttede domenedata og relasjoner, men utelater kalenderforbindelser og kjente tilgangsnøkler; kildene må kobles til igjen. Tema og emnefargepreferanser følger ikke kopien.

[Backupavtalen](../../studieplanlegger/README.md#sikkerhetskopi-og-lagring) beskriver innhold, gjenopprettingsvalg og feilgrenser.

### R-07: dokumentere egenutprøving

Prosjekteieren gjennomfører prøveplanens sju manuelle scenarier med syntetiske data, isolert lagring og registrerte observasjoner per scenario. Automatiske kontroller erstatter ikke manuell betjening eller personlig refleksjon. **SC-07 / S-07; validering av hovedflytene.** [Prøveplanen](USER-TRIAL-PLAN.md) eier prøveoppskrift og resultater; ekstern brukerrekruttering inngår ikke.

### R-08: behovene de bevarte tilleggene støtter

Studenten beholder de leverte tilleggene innen samme V1. **Eksisterende tillegg / S-08; støtter UJ-1 og UJ-3.**

| Tillegg | Brukerbehov og testbar grense |
| --- | --- |
| Ordnede arbeidssteg | Dele arbeid i håndterbare handlinger uten at et fullført steg fullfører oppgaven. |
| Frivillig egenvurdering og repetisjon | Registrere egen vurdering og velge videre øving; tid dokumenterer ikke mestring, og repetisjonsøkter krever godkjenning. |
| Kalenderkopi | Ta et kontrollert utvalg til en annen kalender. Faktisk utvalg og utelatelser vises før bekreftelse; tid og opptattstatus bevares, originalen endres ikke. Ikke-representerbar presisjon rundes ikke lydløst, og tom nedlasting rapporteres ikke som vellykket. Eksport er verken synkronisering eller full sikkerhetskopi. |
| Plansammenligning | Vurdere alternativer før valg; sammenligningen skriver ikke planen. |

Dette begrunner bevaring, ikke dokumentert nytte eller flere funksjoner. [S-08](EPICS-CURRENT.md#s-08--bevare-eksisterende-tillegg-r-08-støtter-sc-04sc-05) har aksepteksemplene.

## Kvalitetskrav

### Q-01: forståelig og tilgjengelig grensesnitt

Studenten kan lese, navigere og redigere på norsk med tastatur og på ulike skjermstørrelser. Tonen følger briefens «Kom ajour.» og «Planer endrer seg. Det er helt greit.» og støtter justering når planen endrer seg. **SC-01, SC-07 / S-01, S-07; alle UJ-er.**

1. Felt er merket, tastaturfokus synlig, og status/emnekode uttrykkes i tekst. Farge supplerer tekst; kalender, emnefarger og System/Lyst/Mørkt er lesbare.
2. Tom oversikt tilbyr registrering med bare tittel og valgfri import. Fylt oversikt samler tidsspørsmål, hurtigvalg, egendefinert tid og Start. På mobil kommer Start etter den korte introduksjonen, jf. [aksepteksemplene](EPICS-CURRENT.md#lokal-ajour-oppfølging--2026-10-26).
3. Ved **1440/900/390 px**, **200 % tekst** og tastatur er felt og Lagre/Avbryt tilgjengelige uten overlapp. Utkast, fokus og relevant rulling bevares; temabytte bevarer arbeid og åpne utkast.
4. Vanlig tekst har **4,5:1** kontrast; nødvendige kontrollgrenser/fokus har **3:1**. Redusert bevegelse respekteres.
5. Tolv emnefarger bruker ledige plasser før gjenbruk og følger samme emne ved navneendring, visning og omlasting. Tema/farger er lokale visningspreferanser og følger ikke sikkerhetskopier.
6. Leveringspåminnelser bevarer skillet mellom fullført steg, ferdig oppgave og bekreftet innlevering.

### Q-02: lokale data og regelbasert støtte

Ingen konto eller betalt API kreves. Studentdata lagres lokalt. **Appen bruker ingen språkmodell; forslag er regelbaserte og kan gjenskapes med samme datagrunnlag, tidsgrunnlag og valg.** Private notater, rålogger og runtimefiler inngår ikke i Git-leveransen. Testdata minimeres uten å miste nødvendig kilde- og parserstruktur. **SC-02, SC-06 / S-02, S-06; alle UJ-er.**

### Q-03: etterprøvbar dokumentasjon

Evidens oppgir dato, metode og avgrensning, og skiller fixturtest, offentlig kildetransport, teknisk UI-/Docker-kontroll og prosjekteierens manuelle egenutprøving. Faktisk forhåndsvisning kontrolleres før integrering; publisert adresse, commit og produksjonskontroll dokumenteres etterpå. En dokumentrevisjon gjør ikke en tidligere kjøring til en ny test. **Alle SC / alle stories.**

## Researchgrunnlag og lignende løsninger

Dette er en avgrenset kildeoversikt, ikke en markeds- eller studentundersøkelse. De tre produktveiledningene nedenfor er lest 2026-10-26; øvrige rader gjenbruker daterte undersøkelser i prosjektet.

| Hva og når | Kilde og faktisk funn | Betydning og begrensning |
| --- | --- | --- |
| Produktgrunnlag, 2026-10-06 | [Lærerfeedback](../../tilbakemelding-product-brief.md) vurderer problemet og hovedreisen som konkrete, men etterspør avgrenset V1, sjekkbare kriterier og sporbarhet. | Føringer for leveransen, ikke dokumentasjon på studentbehov eller nytte. |
| V1-kilder, avgrenset 2026-10-16 | [Importdekningen](../../studieplanlegger/IMPORT-COVERAGE.md) beskriver grunnlaget for det navngitte HiMolde-/NTNU-utvalget. | Begrenset importløfte og manuell registrering som alternativ, uten nasjonal dekning eller personlig gruppetilhørighet. |
| Kalenderformat, 2026-10-23 | [TP CSV-formatgrunnlag](../implementation-artifacts/tp-csv-format-contract-2026-10-23.md) dokumenterer offentlig NTNU-veiledning, offisiell TP-klient og CSV-header. | Kildeinformasjon og tidsusikkerhet må forklares. Ingen private originaler er undersøkt; feltroller er ikke en full TP-spesifikasjon. |
| Kalenderalternativ, lest 2026-10-26 | [Google Calendar: oppgaver](https://support.google.com/calendar/answer/9901136?co=GENIE.Platform%3DDesktop&hl=en) beskriver planlagt tid, frist, fullføring og omplanlegging. | Overlappende funksjoner. Ajours sammenhengende flyt er et designvalg, ikke dokumentert overlegenhet eller markedsunikhet. |
| Læringsplattform, lest 2026-10-26 | [Canvas: studentkalender](https://community.instructure.com/en/kb/articles/662787-unknown) beskriver emne-/gruppekalender, oppgaver, egne gjøremål, kalenderfeed og innleveringsmarkering. | Lokal arbeidsstatus må skilles fra faktisk innlevering i lærestedets løsning. Ingen generell Canvas-integrasjon loves. |
| Oppgavelistealternativ, lest 2026-10-26 | [Microsoft To Do](https://support.microsoft.com/en-us/todo/add-due-dates-and-reminders-in-microsoft-to-do) beskriver forfallsdatoer, påminnelser, gjentakelse og planlagtlisten. | Relevant alternativ til deler av flyten; studentpreferanser og eventuell fordel ved Ajour er ikke undersøkt. |

Ingen intervjuer eller studentundersøkelser inngår. Prosjekteierens observasjoner dokumenteres separat; de beviser ikke bedre læring eller generell studentnytte.

## Antakelser og åpne produktspørsmål

Behovsantakelsene er samlet nedenfor. Signalene er mulige observasjoner ved eventuell senere undersøkelse, **ikke nye V1-krav, resultater eller bestilte prøver**.

| Antakelse | Positivt signal / mottegn | Gjeldende usikkerhet og konsekvens |
| --- | --- | --- |
| Studenten trenger og forstår en enkel vei fra lite grunnlag til konkret arbeid. | Kan forklare neste handling og forutsetningene / må ha hjelp eller misforstår et betinget forslag som bekreftet kapasitet. | Designscenario, ikke dokumentert forståelse hos ukjente brukere. Uklarhet kan gi feil forventninger. |
| Studenten vedlikeholder anslag, arbeidsvinduer og oppgaver tilstrekkelig. | Opplysninger justeres når planen endres / utdaterte opplysninger blir stående. | Stabil bruksvane er ikke dokumentert; forslag kan bygge på utdatert grunnlag. |
| Planleggingshjelpen sparer mer arbeid enn registreringen krever. | Opplevd hjelp oppveier registrering og retting / vedlikeholdet oppleves som merarbeid sammenlignet med kalender/Canvas/oppgaveliste. | Netto tidsbesparelse og arbeidsbelastning er ikke målt. Teknisk korrekthet sikrer ikke nytte. |
| Ett begrunnet neste forslag gjør det lettere å komme i gang. | Studenten bruker forslaget til å starte / avviser det eller må planlegge på nytt. | Forslagsatferd er prøvd innen [dokumentert omfang](USER-TRIAL-PLAN.md); effekt på oppstart og generell studentnytte er ikke etablert. |

Prosjekteieren kan knytte eksisterende egne erfaringer til antakelsene ved personlig sluttgjennomlesing. Ubesvarte nytte- og forståelsesspørsmål er akseptert uvisshet i V1. Prosjekteieren vurderer dem på nytt dersom videre produktarbeid eller brukerundersøkelse bestilles; det føres ingen etterkonstruerte tidsmål eller resultater. Kildedekningens daterte grenser finnes i [importdekningen](../../studieplanlegger/IMPORT-COVERAGE.md); formelle leveringsspørsmål og manglende vurderingsgrunnlag følges opp i [planindeksen](README.md#leveringskontroll--2026-11-04).

## Framtidige ideer utenfor V1

Nasjonal dekning er en **visjon**, ikke et uoppfylt V1-krav. Kontoer, betaling, skysynk, generativ KI i appen, automatisk kontakt, oppmøtekontroll og automatisk innlevering/bekreftelse er utenfor V1. Flere kilder eller videre research om målgruppens behov krever en separat beslutning. Ekstern brukerrekruttering bestilles ikke. Historiske scopebeslutninger og dokumenterte resultater er bevart i [planindeksen](README.md#prd-revisjonshistorikk), ikke erstattet av disse illustrasjonene og kravpresiseringene.
