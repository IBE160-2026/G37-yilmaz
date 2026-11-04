# Prosjekteierens egenutprøving av Ajour — 3.–4. november 2026

**Resultat: alle sju manuelle scenarioer og supplementet for navngitt Start-steg er gjennomført og bestått innen tilpasningene og bevisgrensene nedenfor.** Scenario 3 ble først utført for tidlig og deretter korrigert. Gjenopprettingsprøven ble til slutt gjennomført i en synlig, tom Chrome-gjesteøkt, etter et første forsøk der målmiljøets isolasjon ikke var bekreftet.

Dette er prosjekteierens manuelle prøve med syntetiske data, dokumentert fra egne bekreftelser, skjermbilder og sikkerhetskopier. Codex ga veiledning og utførte den etterfølgende lesende filanalysen. Rapporten gjelder [SC-07 i briefen](../../brief.md), R-07/S-07 og [den gjeldende prøveplanens sju scenarioer og Start-avklaring](../planning-artifacts/USER-TRIAL-PLAN.md). Den er separat fra [Codex' tekniske prøve 2.–3. november](work-step-identity-2026-11-02.md) og endrer ikke tidligere daterte resultater.

Oppfølgingen adresserer [lærerfeedbacken 6. oktober](../../tilbakemelding-product-brief.md): sjekkbare kriterier, sporbar kvalitetssikring og synlig kontroll av KI-generert arbeid innen avgrenset V1. Sensor-PDF-en var ikke tilgjengelig for denne etterkontrollen; rapporten innfører ingen nye sensorkrav.

## Utfører, miljø og metode

| Opplysning | Registrert grunnlag |
| --- | --- |
| Manuell utfører | Prosjekteieren. Ingen ekstern studentgruppe inngår. |
| Dato og tidssone | 3.–4. november 2026, Europe/Oslo. Eksportenes UTC-tider er omregnet til denne tidssonen. |
| Starttid | Eksakt prøvestart er ikke oppgitt. Første bevarte oppgavelagring er 3. november kl. 22:03:04.888. |
| App | [Ajour på Vercel](https://ajour-sooty.vercel.app/), med nettleserlagring og syntetisk prøveinnhold. Ingen lokal server, port eller database ble brukt i denne prøven. |
| Versjon | `1c22b7cfe17836d9267b8495fb585250e1e414b5` ble kontrollert 3. november kl. 21:40:03. Dette er en datert baselinekontroll, ikke bevis på samme publiserte SHA ved hver senere handling. |
| Kildeprofil | Nytt, isolert prøveoppsett og første omlasting er bekreftet av prosjekteieren. Kildeprofilens nettleser og versjon, operativsystemversjon, skjermbredde og zoom er ikke registrert. Bildenes pikselmål er ikke behandlet som nettleserens visningsbredde. |
| Endelig målmiljø | Chrome med synlig **Gjest**-merking. Tom oppstart og null oppgaver/emner/økter før import er vist. Dette erstattet den foreslåtte navngitte Chrome-profilen. |
| Inndata og arbeidsminutter | Syntetiske oppgaver, emner, økter og manuelt oppgitte arbeidsutfall. Registrert tid dokumenterer appens behandling av prøvedata, ikke målt studiearbeid eller mestring. |
| Teknisk etterkontroll | 4. november: ni innsendte JSON-eksporter sammenlignet lesende, inkludert historikk, identiteter og relasjoner. Ingen apphandlinger, klokkeendringer eller direkte skriving til applagringen inngikk i denne analysen. |

Bevisene skilles i tre typer: **brukerbekreftelse** av en utført handling eller observasjon, **skjermbilde** av en synlig tilstand og **filkontroll** av lagrede opplysninger. Et stillbilde viser ikke en omlastingshandling, og identiske sluttfiler viser ikke alene en mellomliggende godkjenning og Angre.

## Faktiske verdier og tilpasninger

Oppgaven «Les syntetisk eksempelkapittel» ble først lagret med bare tittel. Den samme oppgaven fikk deretter TEST101, 60 minutter gjenstående, steget «Les første del» med 60 minutters anslag, innleveringskrav og frist **6. november kl. 16:00**. Det synlige gjenstående anslaget ble brukt; det eldre separate feltet `estimatedMinutes` på oppgaven forble `null`. Stegets anslag ble ikke lagt til totalen.

| Del av oppskriften | Faktisk verdi i denne prøven |
| --- | --- |
| Første arbeidsvindu | 3. november kl. **21:45–23:45** |
| Opptatt tid | 3. november kl. **21:45–22:15** |
| Første godkjente studieøkt | 3. november kl. **22:15–22:45** |
| Andre godkjente studieøkt | 3. november kl. **22:55–23:25** |
| Andre arbeidsvindu | 4. november kl. **10:00–12:00** |
| Kalenderens beholdte TEST102-økt | 4. november kl. **11:00–11:30**, for «Les neste syntetiske eksempel», med 30 minutter gjenstående |
| Start-supplement | «Stegkobling – syntetisk prøve», TEST102, først 60 minutter gjenstående; to steg med **30 minutter hver**, valgt deløkt **1 minutt**, deretter 75 minutter gjenstående |

Første arbeidsvindu ble lagt til samme kveld, slik at prøven kunne følges opp etter virkelig øktslutt. Forholdet mellom opptatt tid, ledig økt og senere frist ble bevart. Start-supplementet brukte en separat tredje oppgave. Temaprøven brukte det åpne tekstutkastet «Skriv en oppgave eller endring», slik at temaknappen kunne betjenes uten en blokkerende modal. Ingen skjulte felt eller bakgrunnskontroller måtte omgås.

## Bevismatrise

J- og I-identifikatorene peker til vedleggsnavn og SHA-256 i den [kuraterte bevisoversikten](evidence/owner-trial-2026-11-04/comparison.json). Rå sikkerhetskopier, rå samtale og skjermbildefiler er ikke kopiert inn i repoet.

| Scenario og forventning | Faktisk resultat | Grunnlag og grense | Status |
| --- | --- | --- | --- |
| **1. Bare tittel, deretter flere opplysninger.** Ukjente felt skal være ukjente; samme oppgave kan suppleres. | Historikken viser opprettelse med tomt emne/frist og `null` for anslag/gjenstående. Samme oppgave-ID fikk TEST101, frist og 60 gjenstående kl. 22:03:52.095; arbeidssteg ble lagt til kl. 22:04:12.369. Oppgaven var fortsatt ufullført. | J02/J04: bevarte før-/etter-opplysninger. I01: utfylt sluttresultat. Oppsett og første omlasting er brukerbekreftet. | **Bestått** |
| **2. Forhåndsvis, avbryt og godkjenn plan.** Ingen lagring før godkjenning; rett oppgave og ledig tid. | Prosjekteieren bekreftet at «Ikke nå» avbrøt uten lagrede økter. Godkjent plan kl. 22:12:16.081 inneholder to 30-minuttersøkter, 22:15–22:45 og 22:55–23:25, innen arbeidsvinduet og uten overlapp med opptatt tid. | J02: opprinnelig godkjenning bevart i historikken; I02 viser begge øktene. Avbruddet er brukerbekreftet. Dette var oppgaveplanlegging, uten valg av et bestemt steg. | **Bestått** |
| **3. Utfall etter øktslutt.** Faktisk tid og nytt gjenstående anslag skal lagres separat, med korrekt økt-/oppgavekobling. | Korrigert registrering kl. **22:51:16.362**, etter slutt 22:45, gir én arbeidslogg med **30 faktiske / 75 gjenstående**. Loggen har riktig `taskId`, `sessionId` og historisk økt-/oppgavekopi. Første økt er historie; den andre reservasjonen beholdes. Steg, oppgave og levering forblir ufullført; ingen mestringsdata opprettes. | J01 dokumenterer det tidlige forsøket; J02 dokumenterer korrigeringen og fravær av duplikat. I03 gjelder det tidlige forsøket og brukes ikke som tidsbevis for omprøvingen. | **Bestått etter korrigering** |
| **4. Omplanlegg og Angre.** Godkjenning endrer planen; Angre gjenoppretter den samlet og beholder arbeidsutfallet. | Prosjekteieren bekreftet forhåndsvisning/avbrudd, synlig endring med «Bruk planen» og gjenoppretting med «Angre». Hele datasettet etter Angre er identisk med korrigert scenario 3, inkludert 30/75-loggen, reservasjonen og historikken. | J02 = J03 for hele `.data`; I04 viser beholdt reservasjon og 75 gjenstående. Mellomliggende plan og kontroll av forslag er brukerbekreftet, ikke utledet av likheten alene. | **Bestått** |
| **5. Fullfør steg, arbeid og levering separat.** Ett trinn skal ikke utføre de neste. | Kl. **23:03:24.141**: steg fullført, oppgave åpen, ikke levert, 75 gjenstående. Kl. **23:04:18.051**: arbeid fullført, 0 gjenstående, fortsatt ikke levert; gjenværende reservasjon frigjort. Kl. **23:04:42.007**: separat lokal leveringsbekreftelse. Den tidligere 30-minuttersloggen er uendret; fullføringsloggen oppgir ukjent faktisk tid (`null`). | J04: tre separate historikkoverganger; I05–I07: tilstandene. Ingen virkelig innlevering til et lærested inngår. Dette er direkte fullføring, ikke Start-stegprøven. | **Bestått** |
| **6. Kalender, emner, farger, tema og åpent utkast.** Rett framtidig økt og bevart dato/utkast; farge supplerer tekst. | TEST102-økten vises 4. november 11:00–11:30 i måned/dag/uke og agenda. TEST101 ble omdøpt til «Endret eksempelfag» med samme emne-ID. Samme synlige utkast finnes i lyst og mørkt tema. Prosjekteieren bekreftet System/Lyst/Mørkt, temaknappen og bevart utkast, emnefarger og valgt kalenderdato 4. november. Utkastet finnes ikke i eksporterte data. | I08–I12 og I14; J05–J09 bekrefter lagrede koblinger og fravær av lagret testutkast. Ikke alle temaskift har egne før-/etter-eksporter; handlingsfølgen er brukerbekreftet. | **Bestått innen oppgitt utkastmetode** |
| **7. Omlasting og gjenoppretting i separat tom instans.** Opplysninger, historikk og koblinger skal bestå. | Kilde før/etter omlasting har identisk `.data`. Endelig mål er synlig Chrome Gjest med tom oppstart og forhåndsvisning **0→3 oppgaver, 0→2 emner, 0→1 økt**. Etter bekreftet import og omlasting har slutteksporten kl. **4. november 09:23:51.366** identisk `.data` med kilden. | J06 = J07 = J09; I15–I17 dokumenterer målmiljø og tilstander. Omlastingene er brukerbekreftet. Det tidligere J08-forsøket hadde likt innhold, men ubekreftet isolasjon; det er ikke grunnlaget for godkjent isolasjon. | **Bestått etter målrettet gjesteprøve** |
| **Supplement: navngitt Start-steg.** Det viste steget, eksakt gjenstående og historisk tilordning skal bestå gjennom endringer. | Start viste «Første teststeg» og 1 minutt. Prosjekteieren bekreftet **70 sekunders venting** og samme steg i utfallsdialogen. Kl. **4. november 00:21:19.386** ble 1 faktisk / 75 gjenstående lagret. Steget fikk nytt navn og ble flyttet til andre plass; samme ID, arbeidslogg og historiske oppgavekopi er bevart etter omplanlegging/Angre, omlasting og gjestegjenoppretting. Begge steg og oppgaven er fortsatt åpne. | I13–I14 og J05–J09. Omplanlegging/Angre etter stegendringen og ventetiden er brukerbekreftet. Loggen har en konkret `stepId` og ingen oppdiktet `sessionId`. | **Bestått** |

## Korrigeringer og observerte begrensninger

Første scenario-3-registrering ble lagret **3. november kl. 22:37:27.176**, før den valgte økten sluttet kl. 22:45. Den teller derfor ikke som bestått gjennomføring av «etter øktslutt». Prosjekteieren brukte Angre og lagret utfallet på nytt kl. 22:51:16.362. Sammenligningen viser samme domenedata bortsett fra registreringstidspunktet; historikken fikk ny identitet/tid for den nye lagringen, og tidligere historikk var uendret. Det finnes én arbeidslogg etter korrigeringen. Det tidlige forsøket bevares som prøveavvik, ikke som dokumentert datatap eller en ny appfeil.

I I02, mens økten 22:15–22:45 var merket «Pågår», viste appen «Arbeid gjenstår å planlegge i studieøktene» selv om de to reserverte øktene opprinnelig utgjorde 60 minutter. Kodegjennomgangen viser at bare framtidig del av reservasjonene teller som gjenværende kapasitet, mens arbeidsanslaget ikke automatisk reduseres når tid passerer. Dette forklarer observasjonen; den dokumenterer ikke at de lagrede øktene var borte. Den er ikke registrert som et nytt funksjonsavvik i denne prøven.

Det første gjenopprettingsforsøket ga en identisk eksport **4. november kl. 08:38:49.934**, men prosjekteieren kunne ikke bekrefte at måløkten var en ny gjesteprofil. Bare gjenoppretting/omlasting og datalikhet var da dokumentert. Den målrettede gjesteprøven med I15–I17 og J09 avklarte den gjenstående miljøbetingelsen; scenario 1–6 måtte ikke gjentas.

Tema og manuelt valgte emnefarger er nettleserlokale. Målprofilen viser egne farger; rapporten påstår ikke at kildeprofilens tema/farger ble overført. Dette endrer ikke scenario 6s brukerbekreftede bevaring ved navneendring og temabytte i kildeprofilen.

## Eksakt filkontroll og sporbarhet

Den [maskinlesbare oversikten](evidence/owner-trial-2026-11-04/comparison.json) inneholder vedleggsidentiteter, SHA-256, eksporttider, tellinger og **36 avgrensede kontrolluttrykk som alle bestod**. Dette er etterkontroll av innsendte filer, ikke 36 nye manuelle tester. Alle ni eksporter bestod appens `validEnvelope` med relasjonskontroll. Ingen appkode, nettleserdata eller råvedlegg ble endret.

Sammenligningen bruker rekursivt sorterte objektnøkler og beholder rekkefølgen i lister. For J06, J07, J08 og J09 er hele `.data` lik, med kanonisk SHA-256:

`2497cc859b0ef8045167bd5b84484897eec00cce79e106ead08ccb4322214e32`

Eksportenes `createdAt` og dermed hele filenes rå SHA-256 er forskjellige. Likheten gjelder appdataene, ikke identiske filbytes. Sluttdatasettet inneholder **2 emner, 3 oppgaver, 1 planlagt økt, 3 arbeidslogger, 2 arbeidsvinduer, 1 opptatt tidsrom, 18 angreoppføringer og 2 papirkurvoppføringer**. Oppgave-/emne-, økt-/oppgave- og arbeidslogg-/snapshot-koblinger er gyldige, uten duplikate identiteter i de kontrollerte samlingene. Ingen ID-er ble erstattet ved eksport (`rekeyedIds: 0`).

Det kjente Start-steget har ID `51111f63-5a97-4a36-a487-c8d92d616850`. I J05 ligger det først som «Første teststeg»; i J06–J09 ligger det som nummer to med navnet «Endret første teststeg». Loggen peker fortsatt til samme ID og samme historiske kopi med det opprinnelige navnet og 60 minutter tidligere gjenstående. Hele arbeidsloggsamlingen er identisk gjennom stegendringen, omlastingene og gjenopprettingene.

| Bevis | Originalt vedleggsnavn | Funksjon |
| --- | --- | --- |
| J01 | `ajour-sikkerhetskopi-2026-11-03(1).json` | For tidlig registrering; korrigeringsgrunnlag |
| J02 | `ajour-sikkerhetskopi-etter-angre-og-ny-lagring(1).json` | Korrigert scenario 3 og baseline for scenario 4 |
| J03 | `ajour-test-4-etter-angre(1).json` | Eksakt gjenopprettet plan etter Angre |
| J04 | `ajour-test-5-etter-levert(1).json` | Separate steg-, oppgave- og leveringsoverganger |
| J05 | `ajour-steg-for-navneendring(1).json` | Kjent stegidentitet før navne-/rekkefølgeendring |
| J06 | `ajour-for-omlasting(1).json` | Kilde før omlasting |
| J07 | `ajour-for-gjenoppretting(1).json` | Kilde etter omlasting og før gjenoppretting |
| J08 | `ajour-etter-gjenoppretting.json` | Tidligere gjenoppretting med ubekreftet isolasjon |
| J09 | `ajour-2026-11-04.json` | Sluttkontroll fra bekreftet Chrome Gjest |

Skjermbildenes opprinnelige filnavn, SHA-256 og pikselmål er også registrert under I01–I17 i oversikten. Filnavnenes tall er identifikatorer, ikke uavhengig bekreftede hendelsestider. Råvedlegg og mellomnotater forblir utenfor Git; den kuraterte oversikten inneholder bare relevant syntetisk identitet, kontrollresultater og bevismetadata.

Denne runden dokumenterer dermed gjennomført egenutprøving for de sju scenarioene og det påkrevde Start-supplementet, med rett utfører og synlige metodegrenser. Den beviser ikke generell studentnytte, alle mulige nettlesere eller datamengder, full nettleseromstart, formell innlevering eller at appen er feilfri.
