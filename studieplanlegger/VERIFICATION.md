# Verifisering av Ajour

**Kortoversikt, redigert 2. november 2026.** Dette er inngangen til dokumenterte rettinger, prøver og begrensninger. [Hele verifikasjonshistorikken](VERIFICATION-HISTORY.md) er bevart ordrett fra versjonen før forkortingen: alle daterte resultater, feilforsøk, før/etter-målinger, metoder, kildeidentifikasjoner, commit-hasher og forbehold finnes der. Eldre utsagn om åpne feil må leses sammen med senere, daterte rettinger.

## Omfang og hvordan resultatene skal leses

Ajour støtter **oppgave → valgfritt arbeidssteg → godkjent studieøkt → utfall → justering**. Fullført steg, ferdig arbeid og bekreftet innlevering er separate handlinger; faktisk tidsbruk og gjenstående arbeid registreres separat. Appen bruker lokale regler, ikke generativ KI under kjøring.

Avtalt V1 er de navngitte HiMolde-/NTNU-prøvene i [briefen](../brief.md). Flere eksisterende adaptere betyr ikke full nasjonal dekning. [Sporbarheten](../.docs/planning-artifacts/TRACEABILITY.md) kobler krav og stories til kode og tester. Nettutgaven lagrer planen i nettleserprofilen på den nøyaktige adressen, uten konto eller skysynk; lokal Node-/Docker-drift bruker SQLite. Disse driftsformene har forskjellige lagringsgrenser.

**Eierens egenutprøving, automatiske tester med syntetiske data og faktiske offentlige kildeprøver er forskjellige bevis.** Et bestått resultat gjelder den daterte prøven og dens versjon, ikke automatisk dagens produksjon, alle kilder eller generell studentnytte. Denne forkortingen er dokumentarbeid og innebærer ingen ny manuell egenutprøving.

## Dokumenterte resultater

| Grunnlag | Resultat og avgrensning | Detaljer |
| --- | --- | --- |
| Publisert teknisk kontroll, 1. november | **2529 enhetstester**, produksjonsbygg, **127 bygde nettleserprøver** og **3 SQLite-prøver** bestod for daværende publiserte versjon. | [CI 41328182714](https://github.com/IBE160-2026/G37-yilmaz/actions/runs/41328182714) |
| Automatisk kontroll av faktisk deploy, 1. november | **60 funksjonsprøver og 6 faktiske kildeprøver** bestod. Dette er ikke nye eierresultater. | [Kjøring 41328761071](https://github.com/IBE160-2026/G37-yilmaz/actions/runs/41328761071) |
| Fontretting, 1. november | **2529/2529 enhetstester i 147 filer**, bygg og **3/3 SQLite-/nettleserprøver** bestod. Tre fontvekter ga identiske fontdata, tekstmål og kontrollbilder før/etter. | [Metode og resultater](VERIFICATION-HISTORY.md#fontnavn-og-markdown-som-eneste-rapportformat--2026-11-01) |
| Egenutprøving, 1. november | Prosjekteieren bekreftet omprøvingen nedenfor. Tidligere **SC-07/1200–30** og **Outlook 30. oktober** beholder bestått innen dokumentert omfang. | [Prøveplan og kildegrunnlag](../.docs/planning-artifacts/USER-TRIAL-PLAN.md) |

Eierens omprøving bekreftet følgende:

- **Identisk import:** 500 aktiviteter og 25 emner ga 0 nye, 0 oppdaterte og 525 uendrede, uten lagringsfeil. Angre-historikken beholdt 28 oppføringer og 3 049 990 byte: **0 byte vekst**, også etter omlasting.
- **Faktisk gjenoppretting:** En backup på **6 624 803 byte (ca. 6,62 MB)** erstattet en endret profil fra 7 til 6 oppgaver. Data, historikk, papirkurv og ID-er ble bevart; `rekeyedIds: 0`. Etterkopiene samsvarte med førkopien bortsett fra eksporttidspunktet utenfor `data`.
- **Tid og forklaringer:** Manglende sommertime, tvetydig vintertime og ugyldig klokkeslett ble avvist på norsk uten lagring. Den tidligere seksdoble kapasitetsforklaringen ble vist én gang.
- **AHO/F06:** Vår 2031 ble vist som studiesemester 10 og høst 2031 som 11. Etikettfeilen er lukket for forhåndsvisningen; kildeårenes hopp består. Ingen AHO-emner ble lagret i denne prøven.

Attribusjonen er korrigert etter eierens uttrykkelige bekreftelse: dette er **eierens egenutprøving**, selv om vedlegget tidligere kalte den agentutført. Vedleggenes navn, sjekksummer, miljøopplysninger og nøyaktige datasettall står i [den fullstendige registreringen](VERIFICATION-HISTORY.md#egenutprøving-utført-av-prosjekteier--2026-11-01). Underliggende private backupfiler ble ikke lest i dokumentarbeidet.

Outlook-resultatet gjelder eierens viste import av **37 hendelser**, ikke alle sluttider, oppdateringsatferd, gjentatt import eller alle Outlook-klienter. Den siste omprøvingen omfattet omlasting i samme profil, men ikke full nettleseromstart, separat tom profil, alle backupstørrelser eller aktivering av «Gjenopprett forrige kopi». Interne skriveoperasjoner ble ikke målt manuelt. Tidligere automatiske prøver av slike tilfeller står separat i historikken.

## Hva som ble rettet og kontrollert

| Periode og tema | Arbeid, begrunnelse og bevart kontekst |
| --- | --- |
| [September: grunnlag, import og lagring](VERIFICATION-HISTORY.md#full-stack-database-and-docker-delivery--2026-09-20) | Program-/undervisningsimport, oppgaveflyt, kalender, arbeidssteg og lokal fullstack-drift ble utviklet og kontrollert. Migrasjon, stabile ID-er, backup og gjenoppretting ble prøvd med isolert Node/SQLite og Docker. Historikken skiller feilforsøk, transportproblemer og senere beståtte prøver. |
| [Oktober: kalender og import](VERIFICATION-HISTORY.md#consolidated-import-and-calendar-closure--2026-10-24) | Parserdatoer, kalendergeometri, eksport, kildeendringer, reimport, CSV-avklaring og bevaring av egne valg/notater ble rettet. Offentlige fixturer og syntetiske regresjoner ble kontrollert; faktiske kildeprøver og utilgjengelige private originaler er særskilt angitt. |
| [25.–26. oktober: Ajour og tema](VERIFICATION-HISTORY.md#emnepalett-og-mørk-modus--2026-10-26) | Navn, oversikt, lokale illustrasjoner, lys/mørk modus og tolv stabile emnefarger ble samordnet. Data-/backupkontrakter ble bevart, og visuelle, tastatur-, nettleser- og isolerte Docker-kontroller er datert hver for seg. |
| [29. oktober: nettutgave og publiseringssperre](VERIFICATION-HISTORY.md#teknisk-sluttkontroll-og-publiseringssperrer--2026-10-29) | Nettleserutgaven ble publisert i det godkjente Vercel-prosjektet med avgrenset stateless import. CI, domenesperre, syntetiske profiler, live-import og produksjonscommit ble kontrollert; blokkerte sikkerhetsprøver er ikke gjort om til beståtte. |
| [29. oktober: feilrapport og mengdetesting](VERIFICATION-HISTORY.md#separat-ki-assistert-mengdetesting--2026-10-29) | Rapporterte feil i import, kalender og eksport fikk teknisk oppfølging. KI-assistert mengdetesting er ført separat fra eierens erfaringer; åpne F03/F05 og kildebegrensninger består. |
| [1. november: SC-07](VERIFICATION-HISTORY.md#sc-07-kortøkt-på-stor-oppgave--2026-11-01) | En delbar oppgave med 1200 minutter gjenstående kunne ikke foreslås ved 30 minutters ledig tid. Eksisterende deløktstøtte ble aktivert i anbefalingen; økttid, totalanslag, blokkeringer og ikke-delbart arbeid skilles fortsatt. Forslag/start endrer ikke fremdrift. |
| [1. november: lagring og gjenoppretting](VERIFICATION-HISTORY.md#lagring-gjenoppretting-og-import--2026-11-01) | Tidsstempelendringer utløste store angrekopier ved identisk reimport; recovery doblet store datasett. Identisk innhold unngår unødvendig historikk, recovery bruker kontrollert tapsfri DEFLATE, og kvote-/tilgangs-/konfliktfeil skilles. Reelle endringer forblir angrebare; tidligere data bevares ved prøvde feil. |
| [1. november: font og rapport](VERIFICATION-HISTORY.md#fontnavn-og-markdown-som-eneste-rapportformat--2026-11-01) | Manrope-filer fikk korrekt `.ttf`-navn/MIME uten endrede fontdata eller lisens. Refleksjonsrapporten ble innarbeidet; Word-kopien ble senere fjernet etter eierens ønske. Markdown-rapportens tekst ble bevart. |

## Begrensninger og gjenstående arbeid

[README har samlet begrensningsoversikt](README.md#kjente-begrensninger-ved-levering); [issues.md](../.logs/issues.md) fører åpne punkter.

- **Kilder:** NTNU-programkilden var tom før filtrering; en fungerende TDT4109-prøve erstatter ikke de navngitte V1-prøvene. De konkrete UiT-tabellene kan ikke tolkes sikkert. BI mangler automatisk undervisningshenting. F03 (fri tekst) og F05 (NHH/FHS/Samisk kildevalg) er åpne. Manuell registrering og støttede filkilder er reserveflyter; kildevern beholdes.
- **Lagring og ytelse:** Nettleserkvoten er ikke økt. Store backuper kan fortsatt feile; komprimering er ikke kryptering. Bruk én redigerende fane og oppbevar egne backuper. Hovedbundle var **957,30 kB / 292,79 kB gzip** i siste dokumenterte funksjonsbygg; størrelsesvarselet består uten avtalt numerisk V1-grense.
- **Bevisgrenser:** Funksjonsprøver er ingen full sikkerhetsrevisjon eller dokumentasjon på generell studentnytte. Verktøyblokkerte sikkerhetsprøver er ikke gjennomført. Kontroll av dagens filer beviser ikke ren Git-historikk; tidligere eksponering og eieroppfølging er dokumentert i [leveringskontrollen](../.docs/implementation-artifacts/submission-audit-2026-11-01.md#git-historikk-og-gjenstående-oppfølging). Historiske feilkjøringer, tidsavbrudd og etterfølgende omkjøringer er bevart som forskjellige resultater.
- **Innlevering:** [Refleksjonsrapporten](../.docs/submission/reflection-report.md) foreligger i Markdown. Personlig sluttgjennomlesing og formell innlevering er ikke bekreftet. Godkjent proposal, overordnet veiledning og konkrete leveringsopplysninger er fortsatt avgrenset som manglende grunnlag i [planindeksen](../.docs/planning-artifacts/README.md#leveringskontroll--2026-11-01).

## Finne og gjenta kontrollene

[README](README.md#tester-og-bygg) beskriver testmiljø og kommandoer. Fra `studieplanlegger`: `npm ci`, `npm run test:unit`, `npm run build`, `npm run test:e2e:ci` og `npm run test:e2e:database`. Faktiske kildeprøver er eksplisitt nettverksavhengige og telles separat. Testene bruker syntetiske data og isolerte profiler/databaser.

For en publisert versjon må [GitHub Actions](https://github.com/IBE160-2026/G37-yilmaz/actions), Vercel-status og produksjonens `/release.json` knyttes til **samme commit**. Eldre hasher er historiske. [Sesjonsloggene](../.logs) dokumenterer senere oppfølging; [hele arkivet](VERIFICATION-HISTORY.md) beholder detaljene som kortoversikten bygger på.
