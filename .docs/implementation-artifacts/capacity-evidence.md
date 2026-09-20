# Teknisk kontroll – kapasitetsplanlegging

Arbeidsdato: 2026-09-07, Europe/Oslo. Grunnlag: [spesifikasjonen](spec-capacity-planning.md). Denne filen registrerer teknisk kontroll med syntetiske data. Den er ikke en rapport fra studentens månedsutprøving eller dokumentasjon på studentens læring.

## Utgangspunkt

- Relevant kode, tester, README, arkitektur og tidligere gjennomføringsdokumentasjon ble lest før implementering. Ingen ytterligere AGENTS.md ble funnet i prosjektet eller foreldremappene; brukerens oppgitte kvote-/språkinstruksjon gjelder.
- `npm.cmd test` før kodeendringene: **230/230 besto**, 5 testfiler, 816 ms (lokal start 15:29:02).
- Ingen Git-repository er tilgjengelig. Kildekode, tester, index.html og README ble kopiert til en separat midlertidig baseline før implementering for senere sammenligning. Ingen commit, staging eller publisering er utført.
- BMADs renderer feilet først inne i sandkassen med Windows-feilen «Filen er ikke tilordnet noe program for denne operasjonen». Den samme kommandoen lyktes etter godkjent kjøring utenfor sandkassen; den genererte arbeidsflyten ble lest. Lesing av genererte filer krevde også godkjent tilgang. Brukerens uttrykkelige gjennomføringsordre dekker vanlige lokale implementeringsvalg, uten ny rutinegodkjenning av spesifikasjonen.

## Sluttkontroll

Alle kommandoer ble kjørt fra `C:/IBE160/2026/studieplanlegger`. Sluttkoden besto kontrollene nedenfor. Den siste nye nettlesertesten endret bare testdekning, ikke appkoden.

| Kommando | Faktisk resultat |
| --- | --- |
| `npm.cmd test` | **308/308 besto**, 8 testfiler, exit 0. Siste samlede kjøring startet kl. 15:52:37 og tok 666 ms. |
| `npm.cmd run test:e2e` | **85/85 besto**, exit 0, 1,4 minutter. Full kjøring av eksisterende og nye nettlesertester på sluttkoden, med isolert Chromium i Europe/Oslo. |
| `npm.cmd run test:e2e -- tests/e2e/capacity-lifecycle.spec.js` | **1/1 besto**, exit 0, 5,4 sekunder. Ny regresjonsprøve lagt til etter fullkjøringen for å lukke et konkret hull i testdekningen. |
| `npm.cmd run build` | **Bestod**, exit 0, 134 ms. 12 moduler; produksjonsfiler i `dist/`. Ingen publisering. |

Totalt **86 ulike nettlesertester er kjørt og bestått**: 85 i den samlede kjøringen, deretter én ny målrettet test på samme appkode. Dette er ikke en påstand om én samlet 86-testkjøring. Tidligere målrettede og samlede kjøringer er ikke lagt til dette tallet.

108 lokale Markdown-lenker i oppdaterte bruker-, test- og prosjektdokumenter er kontrollert; alle mål finnes. Dette kontrollerer fil-/mappemål, ikke eksterne nettsider eller overskriftsankere.

En tidligere kjøring inne i sandkassen viste 84 grønne tester, men hang i testserverens avslutning og ble avbrutt med Ctrl+C (exit 1). Den regnes ikke som en normalt bestått kommando. Samme fullkjøring utenfor sandkassen avsluttet deretter normalt med 84/84, før en avgrenset feilvisningsretting. Den siste samlede kjøringen på 85 og den nye livsløpsprøven ovenfor avsluttet begge normalt utenfor sandkassen. Ingen testserveroppsett eller produksjonsavhengigheter ble endret for dette.

## Hva som er dekket

| Tilfelle | Kontroll og resultat |
| --- | --- |
| Utilstrekkelig kapasitet og deling | `capacity.test.js`: 90 minutter over to 60-minuttersøkter gir 60 + 30; én økt gir 30 manglende minutter. Nettlesertest oppretter, redigerer og sletter øktene og kontrollerer planen. |
| Overlapp, innestengte og like økter | Skjema avviser overlapp og beholder utkast. Innleste, strukturelt gyldige overlapp telles én gang og kan repareres via kalenderen. `capacity-invariants.test.js` sjekker hvert tildelte minutt i 24 varierte scenarier. |
| Frist midt på dagen | Økt kl. 10–13 og frist kl. 11:30 gir maksimalt 90 minutter før fristen; resten kan brukes av neste oppgave. Både regel- og nettlesertester klipper ved fristens klokkeslett. |
| Påbegynte/passerte økter og forfalte oppgaver | Bare hele framtidige minutter fordeles. Nådd/passert frist gir all gjenstående tid som mangel og bruker ingen senere kapasitet. Klokkestyrt nettlesertest verifiserer oppdatering uten lagringsskriving. |
| Ferdig, levert og null | Ferdig arbeid får null tildeling uavhengig av levering; «Klar til levering» er fortsatt synlig. Null gjenstående fullfører ikke automatisk. Aktivt neste steg telles ikke i tillegg. |
| Eldre og ugyldige data | Gamle oppgaver uten nye felt beholdes uten oppstartsskriving. Hovedestimatet er reserve. Ugyldige felt/JSON og lese-/skrivefeil bevarer rådata og tidligere tilstand, med nytt forsøk. |
| Bevaring ved alle oppgavehandlinger | `capacity-lifecycle.spec.js` bruker faktiske kontroller for oppretting/sletting, steg lagre/fjerne/fullføre, arbeidsfullføring/angre og levering/angre. Eksakt lagringskonvolutt og kapasitet kontrolleres etter hver handling, etter en injisert `persistAction`-skrivefeil, ved nytt forsøk og etter omlasting. |
| Mobil, tastatur og kalender | 360/1280 px: registrering, fokus gjennom klokketikk, lesbare frist-/øktetiketter og ingen horisontal sidescrolling. Feil ved sletting langt nede i en mobil øktliste vises ved aktuell økt med synlig nytt forsøk. Kalenderdager uten frister men med økter inngår. |
| Tidsskifte og tallgrenser | Ugyldige/tvetydige økttider og økter over sommertidsskifte avvises; gyldige økter utenfor skiftet fungerer. Tvetydig høstfrist bruker første forekomst med forklaring. For store summer begrenses med advarsel, mens oppgaveverdiene beholdes nøyaktig. |

## Gjennomgang og rettinger

Root leste kildekode og endringer mot den midlertidige baselinen, skrev uavhengige invariansprøver og inspiserte bildene. Tre eksisterende agenter ble gjenbrukt til krysskontroll av kode eller dokumenter de ikke hadde skrevet. Verktøyet avviste flere nye agenttråder. Dette var derfor **ikke tre nye, kontekstfrie BMAD-gjennomganger**.

Funn som ble rettet:

- Strukturelt gyldige innleste overlapp kunne først sperre hele appen. Lagringsvalideringen tillater nå reparerbare overlapp, mens skjemaet fortsatt avviser nye/endrede overlapp og planen teller unionen én gang.
- Kalenderens tekstetiketter og tellere kom for tett sammen. Avstand og plassering er rettet og nye bilder kontrollert. Øktredigering i kalenderen har minst 44 px høy knapp.
- Feil ved øktsletting kunne havne utenfor synsfeltet i en lang liste. Meldingen vises nå ved aktuell økt; en mobiltest kontrollerer melding, fokus og nytt forsøk.
- Arkitekturdiagrammet viste feil vei inn til kalenderen. Det viser nå at kalenderen får lagrede oppgaver/økter, mens kapasiteten har sin egen avledede visning. Nullregelen i hurtigforslag er presisert.
- Månedsprøvelisten har nå også endring/sletting av en økt når egne planer endres.
- Et reelt testhull i kontrollerens bevaring av økter gjennom hele oppgaveløpet er lukket med den beståtte nye nettlesertesten.

Krysskontrollen fant ingen ytterligere konkrete feil i oppgave-/lagringsreglene eller fordelingsalgoritmen. Ingen kjente nødvendige tekniske rettinger er utsatt. Dette er ikke en garanti for feilfrihet eller dokumentasjon på personlig bruk.

## Bilder og begrensninger

Fire bilder fra isolerte nettlesertester ble inspisert lokalt ved 360 og 1280 px. De inneholdt fiktive kontrolloppgaver, men er ikke tatt med i GitHub-leveransen; den tekstlige kontrollbeskrivelsen er beholdt.

Produksjonsbygget er en pakkekontroll; prosjektet har ingen egen lint- eller typekontrollkommando. Nettleserkontrollene bruker Chromium, ikke fysisk mobil eller studentens egne nettleserdata. Ingen menneskelig utprøving, tilgjengelighetsvurdering med skjermleser eller faktisk innlevering er utført på studentens vegne.

Funksjonens avgrensninger er bevisste: lokal lagring uten sikkerhetskopi/synkronisering; én redigerende fane og samme tidssone; økter på én dato; ingen automatisk tidsmåling, pauser, arbeidsavhengigheter eller leveringskontroll. Gjenstående minutter er et brukeranslag som må oppdateres. Detaljer står i [README](../../studieplanlegger/README.md) og [kodeforklaringen](solution-guide.md).

## Personlig utprøving

Ikke gjennomført eller startet på studentens vegne. [trial-log.md](trial-log.md) inneholder plan, konkrete handlinger og tomme felt. [project-reflection.md](project-reflection.md) dokumenterer KI-bidrag og lar studentens egne svar stå åpne. Tidligere manuelle godkjenninger gjelder sine daværende versjoner og er ikke flyttet til kapasitetsfunksjonen.
