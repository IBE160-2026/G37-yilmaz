# Avklaringssteg og lokal forespørselsvalidering — 2026-11-03

Dette er en teknisk oppfølging av den uavhengige gjennomgangen av `f6a42e2de420812b0ed43c5e75223df844f11f4c`. Den følger lærerens tilbakemelding om sjekkbare kriterier, sporbarhet, avgrenset V1 og kontroll av KI-generert arbeid. Sensorvedlegget var ikke tilgjengelig i denne runden; ingen nye vurderingskrav er utledet fra sammendrag av det. Tekniske resultater erstatter ikke prosjekteierens R-07-observasjoner.

## Funn og retting

| Funn før retting | Rettet atferd | Grunnlag |
| --- | --- | --- |
| Start → Avslutt økten → Utført fullførte et avklaringssteg, men beholdt ventemarkeringen. Neste ordinære steg ble derfor blokkert. Steglisten hadde samme inkonsistens. | [Felles lagring av steg](../../studieplanlegger/src/work-steps.js) opphever venting når akkurat et eksisterende, uttrykkelig merket avklaringssteg går fra åpent til fullført. Start, direkte fullføring og lagring av steglisten bruker samme regel. | [Identitets-/utfallsprøver](../../studieplanlegger/tests/unit/work-step-identity.test.js), [steglisteprøver](../../studieplanlegger/tests/unit/bounded-work-steps.test.js) og [nettleserregresjoner](../../studieplanlegger/tests/e2e/own-trial-work-step-identity.spec.js). |
| En ugyldig forespørselsadresse kastet et ufanget unntak før lokal ruting. En isolert Node-testserver avsluttet med kode 1. | [Tilstands-](../../studieplanlegger/server/state-api.js) og [importgrensen](../../studieplanlegger/server/import-api.js) fanger ugyldig adresse, svarer HTTP 400 og utfører ingen database- eller kildeoperasjon. Tjenesten kan behandle neste gyldige forespørsel. | [Regresjoner med ekte HTTP-lyttere og rå forespørsler](../../studieplanlegger/tests/unit/local-request-boundary.test.js). Dette var et funn i lokal drift, ikke en påvist offentlig Vercel-sårbarhet. |
| README beskrev Utført som stegfullføring også når dialogen gjaldt hele oppgaven. | [Brukerveiledningen](../../studieplanlegger/README.md#planlegg-og-oppdater-fremdrift) skiller stegfullføring, uttrykkelig oppgavefullføring og separat leveringsbekreftelse. | Dokumenttekst avstemt mot utfallsdialogen og arbeidsloggen. |
| Den generelle importveiledningen skilte ikke tydelig nok mellom lokal lenkehenting og nettutgaven. | [Importveiledningen](../../studieplanlegger/IMPORT.md#bruk) forklarer gjenkjente kilder i nettutgaven og ICS-filalternativet for andre lenker. Lokal import beholder sine eksisterende adresse- og størrelsesgrenser. | Ingen nye kilder eller løsere kildevern. |

## Bevaring og avgrensning

Ventingen fjernes bare ved en ny fullføring av samme eksisterende steg-ID, med avklaringsmerket både før og etter. Historisk fullførte steg, nytt tekstinnhold, omrekkefølge, sletting, nye fullførte rader, gjenåpning og avbrutte utkast opphever ikke venting. Heller ikke vanlig oppgavearbeid eller utfallene Trenger mer tid og Ikke utført gjør det. Andre uoppfylte forutsetninger, arbeidsanslag og leveringsstatus beholdes. Angre gjenoppretter både venting og stegstatus, og den historiske oppgavekopien endres ikke.

Den lokale HTTP-rettingen endrer ikke Host-/Origin-/cross-site-kontroll, Vercels tilstandsløse drift eller listen over gjenkjente kilder. Ingen database- eller backupmigrasjon er innført. Eldre data og tidligere daterte resultater beholdes.

## Utførte kontroller

Lokale tekniske kontroller 3. november 2026, Europe/Oslo:

| Kontroll | Faktisk resultat |
| --- | --- |
| Nye målrettede stegprøver | Regresjoner feilet før retting; etter samlet retting bestod 152 tester i seks berørte filer. |
| Lokale HTTP-/importprøver | 134 tester bestod, inkludert fire nye grenseprøver med isolerte HTTP-lyttere. Samme lytter svarte normalt etter ugyldige forespørsler; database-/kildetilgang ble ikke utført ved avvisningen. |
| Full enhetssuite | 2664/2664 tester i 151 filer, exit 0. Kjøring startet kl. 19:11:24 og varte 21,22 sekunder. |
| Undervisningsfixturer | 141/141 i ti filer, exit 0. Ingen nye faktiske kildeoppslag i denne lokale kontrollen. |
| Produksjonsbygg | Bestått, exit 0. Hovedfil `index-DVKPiKe7.js`: 961,20 kB / 293,91 kB gzip. Eksisterende bundlevarsel består. |
| Dokument- og diffkontroll | 50 Markdown-filer, 858 relative lenker og 224 fragmentreferanser uten manglende mål. Endrede filer hadde ingen treff i kontrollen av private nøkkel-/tokenmønstre eller personlige filstier; dette er en avgrenset mønsterkontroll. Whitespace- og syntakskontroll bestod. |
| Lokale nettleserprøver | To nye regresjoner er skrevet for Start og steglisten, men kunne ikke kjøres lokalt fordi Chromium manglet og nettlesernedlastingen feilet. Ingen bestått nettleserstatus utledes av enhetstestene. |

Utvalgene overlapper full enhetssuite og skal ikke summeres som uavhengige testmengder. Den tidligere sjuscenarioprøven beholder sin dato, metode og avgrensning i [rapporten om stegidentitet](work-step-identity-2026-11-02.md).

## Publiseringsstatus

Dette kontrollpunktet dokumenterer arbeidskopien før GitHub-kontroller og publisering. Det hevder ikke at produksjonen allerede inneholder rettingene. Senere CI- og publiseringsresultater føres datert i [verifikasjonen](../../studieplanlegger/VERIFICATION.md#avklaringssteg-og-lokal-forespørselsvalidering--2026-11-03) og sesjonsloggen.
