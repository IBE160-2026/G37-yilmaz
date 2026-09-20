# Story 1.2 — bygge- og testevidens

**Overtakelsen er fullført 2026-09-06.** Studenten bekrefter at alle punktene i [overtakelseskontrollen](story-1-2-handover-check.md) fungerer. Story og sprintnøkkel for 1.2 er nå `done`. Resten av dokumentet bevarer byggeøktens historikk, inkludert tidligere `review` og daværende gjenstående menneskelig kontroll. Ingen ny kode eller testkjøring ved registrering av godkjenningen. Månedsutprøvingen er fortsatt **Ikke startet**, med tomme datoer.

Dato: 2026-09-06. **Bygget, testet og kodegjennomgått.** Story og sprint står i `review`, mens [byggespesifikasjonen](spec-1-2-opprette-oppgaver-og-beholde-dem-trygt.md) er `done` etter byggeflytens regler. Menneskelig overtakelse gjenstår; 1.1-godkjenningen gjelder ikke det nye skjemaet.

## Leveranse

Inline-skjema, feltfeil, avbryt og alle-oppgaver-liste. Kontrolleren beholder tilstand og utkast frem til én vellykket komplett skriving. Lagringsadapteren validerer kandidater/lesing og sperrer endringer ved uleselige data. Bare adapteren aksesserer localStorage. Brukerinnhold vises som tekst; oppgaver sorteres på en kopi. Frister beholdes som lokale etiketter.

## Faktiske kontroller

- Endelig `npm.cmd test`: exit 0, 43/43 tester i to filer, 269 ms, startet kl. 17:35 lokal tid. Oslo-tidssone bekreftet; `2026-03-29T02:30` avvises og `2026-10-25T02:30` godtas uendret. Kalenderoverløp, tomme felt, sikre minuttgrenser, ID-er, kontrakt, stabil sortering, bevarte rådata og skrivefeil dekkes.
- Endelig `npm.cmd run test:e2e` etter reviewretting: exit 0, **14/14 bestått på 6,5 s**, utenfor sandkassen med normal avslutning. Chromium på strict 5174, separate kontekster og Europe/Oslo. Dekker én skriving før synlig suksess, ingen passive skrivinger, omlasting/gjenåpning med samme ID og verdier, bokstavelig HTML-tekst, skrivefeil med alle utkastfelt beholdt, nytt forsøk uten duplikat, visnings-/lagringsrekkefølge, ugyldig JSON/skjema/felt/ID-er og begge typer lesetilgangsfeil. Lesefeilene starter med eksisterende oppgaver og beviser uendret råverdi, null skrivinger og gjenfunnet identitet etter nytt forsøk.
- Tastaturtester ved 360/1280 px: skip-lenke, åpning, feltfeil, lagring med Enter, avbryt, fokusretur, synlig fokus og details med Enter/Space. Ingen horisontal sideskrolling med skjema/feil eller lang oppgavetittel. Ingen eksterne forespørsler, ressursfeil eller JavaScript-feil i sideskalltestene.
- Endelig `npm.cmd run build`: exit 0, 8 moduler, 111 ms; `dist/index.html` 3,75 kB, CSS 2,54 kB og JavaScript 4,90 kB. Ingen publisering.
- SHA256 uendret mot `.tmp/story-1-2-baseline/studieplanlegger/`: package.json `F159F1EC37BC77D05A616AACAA77C780A707502E5467A710CCDB788C6F062F86`; package-lock.json `476E69C7060A70F11CC467F9167B4CDBC5CF3998D306BC79198DA5F6D01F27AF`.
- Agentene åpnet og inspiserte feltfeil ved [360 px](story-1-2-screenshots/form-errors-360.png) og [1280 px](story-1-2-screenshots/form-errors-1280.png), samt lang oppgavetittel ved [360 px](story-1-2-screenshots/task-360.png) og [1280 px](story-1-2-screenshots/task-1280.png): norske tegn, leselige felt/feil, tydelig fokus og innhold innen bredden. Skjermbildene fra sluttkjøringen er kopiert hit fra test-results. Dette er agentobservasjoner, ikke studentens fysiske kontroll.
- Miljø beholdt: Node 24.19.0, npm 11.17.0, Vite 8.2.2, Vitest 5.0.0, Playwright 1.63.0. Installert Playwright-manifest angir Chromium 153.0.8010.12. Ingen reinstallasjon eller avhengighetsendring. Etter sluttkjøring ga tilkobling til 127.0.0.1 og ::1 på både 5173/5174 ECONNREFUSED; ingen server ble stående.

## Sporbar testdekning

| Story / matrisetilfelle | Kjørte tester som dekker utfallet |
| --- | --- |
| AC1 / gyldig oppretting og rekkefølge | tasks-enhetstester for trimming, ufullført status og kopisortering; nettlesertester for komplett skriving, unik ID, like frister og bevart lagringsrekkefølge |
| AC2 / feltfeil og Oslo-klokke | parametriserte dato-/minutt-/felt-enhetstester, browser invalid-fields, tom innsending ved begge bredder og høstetikett etter gjenåpning |
| AC3 / atomisk lagringsutfall og nytt forsøk | adaptertest med samme underliggende råverdi ved lesing/skriving; browser write-failure og observasjon av liste/feedback inne i setItem før suksess |
| AC4 / manglende eller uleselig lagring | adapterens missing/invalid/read-exception, fire ugyldige browserdatasett, getter/getItem med bevart eksisterende data; forsinket modul viser ingen falsk tomtilstand før lesing |
| AC5 / gjenåpning, trygg tekst og tilgjengelighet | browser reload/reopen i samme kontekst, bokstavelig HTML-tittel, Tab/Shift+Tab gjennom felter og handlinger ved 360/1280, fokusretur, tilbakemeldinger og ryddet skjema etter lagre/avbryt |

Ingen tester er deaktivert eller hoppet over. Den manuelle delen av AC5 er fortsatt en overtakelseskontroll.

## Feil og rettinger under arbeidet

- Unicode via en PowerShell/Python-pipe erstattet noen nye norske tegn med spørsmålstegn. Rettet med UTF-8-bevarende apply_patch; endelige skjermbilder viser korrekte tegn.
- Første Playwright-kjøring rapporterte 11 beståtte tester, men hang i sandkassens serveropprydding. Egen Vite-prosess PID 8536 ble identifisert fra kommandolinjen med strict port 5174. `Stop-Process` feilet med NullReferenceException. Ett nytt testforsøk avviste korrekt opptatt port (exit 1). Målrettet .NET Kill av samme testserver lyktes, og første kjøring avsluttet med exit 0 etter assistert opprydding. Den endelige kjøringen over brukte require_escalated og avsluttet normalt. Ingen bruker-server ble stoppet.
- Utdaterte 1.1-påstander i grensesnitt, README og shell-test er erstattet. Feltene er påkrevde, datetime-local har step 60, og egne feil brukes med novalidate.
- Første gjennomføring ga 43 enhetstester og 11 nettlesertester. Root fant en manglende lesefeilkontroll med eksisterende data og at initial HTML kunne vise tom liste før lesing. Rettet begge; 43/43 og 12/12 bestått samt nytt bygg før review.
- Kodegjennomgangens nye noscript-test hadde først en feil i lokatoren: Playwright filtrerte tekst fra selve noscript-elementet. Den konkrete synlige paragrafen ble kontrollert i stedet; målrettet sideskallkjøring og den endelige fulle suiten er bestått.
- Renderaktiveringen ble kjørt nøyaktig én gang fra prosjektroten med require_escalated, exit 0. Generert workflow ble fulgt, og epic-konteksten ble kompilert på nytt. Snapshotfiler krevde også eskalert lesing. To reviewlag måtte gjenopptas etter slik lesefeil; ett forsøk møtte bruksgrensen før senere vellykket gjennomgang. Dette er ikke hoppede reviewlag.

## Kodegjennomgang og avgrensning

Blind Hunter, Edge Case Hunter og Verification Gap Reviewer ble kjørt som separate agenter på samme modellnivå. Ni funn er vurdert enkeltvis i [triageloggen](spec-1-2-opprette-oppgaver-og-beholde-dem-trygt.md). Seks patchfunn ble rettet av samme implementasjonsagent og kontrollert av root: sammenhengende tastaturflyt, like frister etter omlasting, bevart innlastet fullførtstatus, meningsfull lagringsmock, forklaring uten JavaScript og tømt skjema/feltfeil etter avslutning. Ingen funn er utsatt.

Påstanden om godtatt linjeskift etter fristen ble avkreftet ved faktisk kjøring. To funn beskrev samme sjeldne tidssoneskifte: en etikett gyldig i UTC kan være et ugyldig lokalt sommertidsminutt i Oslo og dermed sperre lesing der. Rådata beholdes; ingen UTC-konvertering skjer. Dette er en kjent begrensning ved gjeldende lokale validering, mens arkitekturen utsetter støtte for tidssonereiser. Funnene ble vurdert lavt og avvist etter flytens regel for sjeldne tilfeller som krever nye valideringssemantikker. Det påstås ikke at denne situasjonen er løst.

Ingen Git-repository finnes eller er opprettet, og ingen commit er laget. Sammenligningen brukte git diff --no-index mot kopien av kildefilene før arbeidet; nye filer inngår. Brukervalg, implementasjonsagentens arbeid, root-kontroll og review er dokumentert; dette er ikke kurs- eller instruktørgodkjenning.

## Gjenstår

Fysisk tastatur-/feltfeilkontroll og menneskelig overtakelse av 1.2: se `story-1-2-handover-check.md`. Story 1.3 og senere er ikke bygget. Månedsutprøving: **Ikke startet**. Startdato: tom. Sluttdato: tom.
