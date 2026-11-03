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
| Separat lokal app-prosess | En egen isolert prosess med den lokale app-serveren svarte HTTP 400 på forespørselsmålet `http://[`. Påfølgende `/api/health` svarte HTTP 200, databaserevisjonen var bevart og prosessen kjørte fortsatt. Før rettingen hadde samme feilklasse avsluttet den isolerte prosessen med kode 1. Dette er en faktisk lokal prosesskontroll, separat fra middleware-prøvene og Vercel. |
| Full enhetssuite | 2664/2664 tester i 151 filer, exit 0. Kjøring startet kl. 19:11:24 og varte 21,22 sekunder. |
| Undervisningsfixturer | 141/141 i ti filer, exit 0. Ingen nye faktiske kildeoppslag i denne lokale kontrollen. |
| Produksjonsbygg | Bestått, exit 0. Hovedfil `index-DVKPiKe7.js`: 961,20 kB / 293,91 kB gzip. Eksisterende bundlevarsel består. |
| Dokument- og diffkontroll | 50 Markdown-filer, 858 relative lenker og 224 fragmentreferanser uten manglende mål. Endrede filer hadde ingen treff i kontrollen av private nøkkel-/tokenmønstre eller personlige filstier; dette er en avgrenset mønsterkontroll. Whitespace- og syntakskontroll bestod. |
| Lokale nettleserprøver | To nye regresjoner er skrevet for Start og steglisten, men kunne ikke kjøres lokalt fordi Chromium manglet og nettlesernedlastingen feilet. Ingen bestått nettleserstatus utledes av enhetstestene. |

Utvalgene overlapper full enhetssuite og skal ikke summeres som uavhengige testmengder. Den tidligere sjuscenarioprøven beholder sin dato, metode og avgrensning i [rapporten om stegidentitet](work-step-identity-2026-11-02.md).

## GitHub og faktisk forhåndsvisning — 2026-11-03

[GitHub-kvalitetskontrollen](https://github.com/IBE160-2026/G37-yilmaz/actions/runs/41694420525) for kandidaten `a01391e0ee9df1aaf3626fa8d5aba5540f5c94a8` i [PR #21](https://github.com/IBE160-2026/G37-yilmaz/pull/21) bestod med **2664/2664 enhetstester, produksjonsbygg, 155/155 faktiske Chromium-prøver og 14/14 SQLite-/nettleserprøver**. Chromium-suiten brukte 4,4 minutter og SQLite-suiten 31,5 sekunder. De to nye nettleserregresjonene inngikk dermed i en faktisk bestått kjøring; den tidligere lokale Chromium-begrensningen er fortsatt historisk korrekt og er ikke omgjort til en lokal beståttstatus.

Den faktiske [Vercel-forhåndsvisningen](https://ajour-muz4lkg0b-ajour1.vercel.app) for samme kandidat bestod [publiseringskontroll 41695410618](https://github.com/IBE160-2026/G37-yilmaz/actions/runs/41695410618) med **60/60 runtimeprøver** på 4,4 minutter og **6/6 avgrensede faktiske kildeprøver** på 57,1 sekunder. Kildetransporten er separat fra de syntetiske nettleserprøvene og de lokale undervisningsfixturene. Disse resultatene gjelder forhåndsvisningen, ikke produksjonsadressen eller prosjekteierens R-07.

## Publiseringsstatus

Det første lokale kontrollpunktet ovenfor ble registrert før GitHub-kontroller og publisering. Etter bestått kvalitets- og forhåndsvisningskontroll ble [PR #21](https://github.com/IBE160-2026/G37-yilmaz/pull/21) integrert som main-commit **`a58a93d0c65d0fc68bcda9a999ff0018bdbcb393`**. Produksjonskontrollen nedenfor gjelder denne integrerte funksjonsrettingen.

### Produksjon etter integrering — 2026-11-03

Den separate [main-kvalitetskontrollen](https://github.com/IBE160-2026/G37-yilmaz/actions/runs/41696509142) bestod med **2664/2664 enhetstester, produksjonsbygg, 155/155 faktiske Chromium-prøver og 14/14 SQLite-/nettleserprøver**. Chromium-suiten brukte 4,4 minutter og SQLite-suiten 26,4 sekunder. Vercel rapporterte vellykket publisering av [den eksakte deploymenten](https://ajour-4zzfp3i5i-ajour1.vercel.app) for samme main-commit.

Den offentlige [produksjonsmarkøren `/release.json`](https://ajour-sooty.vercel.app/release.json) viste **`a58a93d0c65d0fc68bcda9a999ff0018bdbcb393`** ved kontroll **3. november kl. 19:50:10.632811 Europe/Oslo**. [Produksjonskontroll 41697481789](https://github.com/IBE160-2026/G37-yilmaz/actions/runs/41697481789), jobb `126131730279`, kontrollerte den eksakte deploymenten og commiten kl. **19:50:11–19:53:58 Europe/Oslo** og bestod med **60/60 runtimeprøver** på 2,9 minutter og **6/6 faktiske kildeprøver** på 50,1 sekunder.

JavaScript- og CSS-filene hentet over HTTP fra produksjonen var byteidentiske med det kontrollerte lokale bygget:

| Fil | Byte | SHA-256 |
| --- | ---: | --- |
| `index-DVKPiKe7.js` | 961202 | `de14a17167ad815adb7535a9600aba3e5b6deba7b2e12eccd2b5df443ad0fbf3` |
| `index-9d3E6xgs.css` | 99759 | `91eaf8bd4f47f3cccd7af09a3043c451439ff952644185bab1434c20234d2d34` |

Dette bekrefter den daterte produksjonsleveransen av funksjonsrettingen. Senere dokumentasjonscommiter får egen GitHub-/publiseringsstatus; de endrer ikke hvilke versjoner prøvene ovenfor gjaldt. [Verifikasjonen](../../studieplanlegger/VERIFICATION.md#avklaringssteg-og-lokal-forespørselsvalidering--2026-11-03) og sesjonsloggen skiller denne funksjonsleveransen fra oppfølgende dokumentasjon. Tidligere sjuscenarioprøve og prosjekteierens R-07 beholder sine egne datoer, metoder og grenser.
