# Story 1.3 — bygge- og testevidens

Oppdatert 2026-09-06 (lokal dato, Europe/Oslo): **Bygget, testet, kodegjennomgått og menneskelig godkjent.** Studenten bekreftet hele [overtakelseskontrollen](story-1-3-handover-check.md): «Jeg gjorde alt i # Story 1.3 — menneskelig overtakelse. alt funket.» Story og sprint er nå `done`; [byggespesifikasjonen](spec-1-3-rette-og-slette-egne-oppgaver.md) er fortsatt `done`. Bygge- og testhistorikken nedenfor beskriver de tidligere kjøringene; ingen nye automatiserte tester er kjørt ved denne dokumentoppdateringen. Månedsutprøvingen er **Ikke startet**, med tomme datoer.

## Leveranse

«Rediger» bruker samme skjema med alle fire lagrede verdier. Bare valgt ID oppdateres, med samme fullføringsstatus og lagringsplass. Ugyldig redigering beholder utkastet og gammel oppgave; «Avbryt» skriver ingenting. Andre oppgavehandlinger sperres mens skjemaet er åpent. Sletting krever bekreftelse, fjerner bare valgt ID og viser riktig tomtilstand etter siste sletting.

Lagringsadapteren er beholdt: hele kandidaten valideres før én komplett skriving; først deretter erstattes lagret tilstand og suksess vises. Lesefeilsperren er bevart. Skrivefeil beholder tidligere data og redigeringsutkast. Feilen vises ved «Lagre» eller den valgte oppgavens «Slett», også når brukeren har skrollet. Fokus går til oppgavens «Rediger», en nabo eller «Ny oppgave» etter handlingen; skrivefeil gir en synlig vei til nytt forsøk. Oppgaveknappenes tilgjengelige navn inkluderer tittel. Brukerinnhold vises som tekst, og sortering endrer ikke lagringsrekkefølgen.

## Endelige kontroller

Kjørt av root fra `C:/IBE160/2026/studieplanlegger/` etter alle reviewrettinger:

- `npm.cmd test`: **61/61 bestått**, to filer, exit 0, 247 ms. Start kl. 23:14:05 lokal tid, Europe/Oslo.
- `npm.cmd run test:e2e`: **25/25 bestått**, exit 0, 13,3 s. Kjørt utenfor sandkassen med normal opprydding, Chromium, strict port 5174 og isolerte kontekster i Europe/Oslo. Ingen tester hoppet over eller deaktivert.
- `npm.cmd run build`: exit 0, åtte moduler, 107 ms. `dist/index.html` 3,88 kB, CSS 2,65 kB og JavaScript 7,26 kB. Ingen publisering.
- Alle 43 enhetstester og 14 nettlesertester fra 1.2 er beholdt, med relevante utvidelser. 18 nye enhetstester og 11 nye nettlesertester inngår.
- Etter sluttkjøringen svarte både 127.0.0.1:5174 og [::1]:5174 med ECONNREFUSED: testserveren var avsluttet. Ingen personlig server på 5173 ble undersøkt eller stoppet i denne sluttkontrollen.
- package.json SHA256 er uendret: `F159F1EC37BC77D05A616AACAA77C780A707502E5467A710CCDB788C6F062F86`. package-lock.json SHA256 er uendret: `476E69C7060A70F11CC467F9167B4CDBC5CF3998D306BC79198DA5F6D01F27AF`.
- Faktisk miljø er beholdt: Node 24.19.0, npm 11.17.0, Vite 8.2.2, Vitest 5.0.0 og Playwright 1.63.0. Installert nettlesermanifest angir Chromium 153.0.8010.12, revisjon 1243. Ingen installasjon eller PATH-endring.

## Sporbar dekning

| Kriterium / matrix | Kjørte tester |
| --- | --- |
| AC1 / gyldig redigering | Enhetstester for eksakt ID, alle felt, beholdt completed/listeplass; browser «all-field edit» for trimming, trygg HTML-lignende tekst, like frister og reload/reopen |
| AC1 / ugyldig redigering | 12 parametriserte edit-tilfeller og beholdte 1.2-grenser; browser «invalid edits» for feltfeil, beholdt utkast/råverdi, null skriving og fokus |
| AC1 / avbryt og utkast | Browser «cancel discards», «creation draft locks» og «cancel after failed edit»; siste prøve åpner igjen gamle verdier og lagrer en annen oppgave for å kontrollere kontrollerens beholdte tilstand |
| AC2 / sletting | Rene delete-tester; browser «delete confirmation» og «same-title tasks» for bekreftelse/avbrudd, eksakt ID også ved like titler, uendret øvrig liste og siste sletting |
| AC3 / skrivefeil | Adaptertester for begge kandidater med feil i en annen oppgave; browser «failed edit» og «failed deletion near the end» for bevart liste/råverdi/utkast, fullt synlig melding/knapp og riktig nytt forsøk |
| AC3 / lesefeilsperre | 1.2-tester for JSON/skjema/felt/ID og getter/getItem, utvidet med utilgjengelig Rediger/Slett og aktive kontroller først etter gyldig lesing |
| AC4 / persistens og fokus | Browser «all-field edit» for redigering/sletting etter omlasting og gjenåpning; tastaturtester ved 360/1280 for Tab-flyt, synlig fokus, lagring, avbrudd, nabo og tomtilstand |

Instrumentert setItem kontrollerer én komplett skriving før synlig ny liste/suksess. De nye persistensprøvene seedes én gang, slik at omlasting leser faktisk lagrede endringer. Automatiseringen bruker bare fiktive data i egne kontekster på 5174; ingen personlig profil, lagring eller oppgaver på 5173 er lest eller endret.

## Skjermbilder og menneskelig kontroll

Root har inspisert feil, skjema, fokus etter lagring og skrive-/slettefeil ved 360 og 1280 px. Norske tegn, leselig tekst, synlig tastaturfokus og brukbar bredde er observert. Skjermbildene er utelatt fra GitHub-leveransen; den tekstlige kontrollbeskrivelsen er beholdt.

Dette er agentobservasjoner fra byggingen. Ved avsluttet bygging gjenstod fysisk tastaturprøve, forståelighet og studentens godkjenning av de nye handlingene. Studenten bekreftet deretter hele [overtakelseskontrollen](story-1-3-handover-check.md) 2026-09-06; se toppnotatet og den ordrette bekreftelsen i kontrollen. Ingen fysisk skjermleserprøve påstås. Godkjenningen gjelder nå uttrykkelig 1.3.

## Kodegjennomgang og rettinger

Blind Hunter, Edge Case Hunter og Verification Gap Reviewer er kjørt som separate agenter på samme modellnivå. Alle åtte funn ble vurdert enkeltvis i [triageloggen](spec-1-3-rette-og-slette-egne-oppgaver.md). Edge Case Hunter leverte ingen bekreftede funn. Fem rettinger ble utført: oppgavetittel i tilgjengelige knappenavn, skrivefeil ved skjemahandlingene, like titler med ulike ID-er, beskyttet opprettingsutkast og avbrudd etter skrivefeil. To funn gjaldt samme siste testhull.

To skjermleserpåstander ble vurdert som ubekreftede med lav mulig konsekvens og avvist etter flytens regel; de er ikke erklært løst. DOM-proben bekreftet ny tekstnode og én mutasjon ved identisk statustekst, men dette beviser ikke faktisk tale. Ingen funn er utsatt, og ingen review-loopback var nødvendig.

Root fant før review at slettefeil ved toppen av siden lå utenfor viewport i en lang liste. Implementasjonsagenten reproduserte feilen (viewport-ratio 0), flyttet feilen til valgt oppgave og fikk samme regresjon til å bestå. Review fant tilsvarende problem ved redigering i et lavt vindu; root-proben ved 360×500 målte meldingens top -333,45 / bottom -256,67 mens «Lagre» hadde fokus. Etter retting kontrollerer sluttprøven at både melding og knapp er helt synlige og at nytt forsøk lykkes.

Den opprinnelige implementasjonsagenten ble gjenkontaktet med byggeflytens pålagte patchprompt, men stoppet på bruksgrensen. Root fullførte rettingene under flytens uttrykkelige reservevei og kjørte hele sluttkontrollen. Root leste hele kodediffen før review og alle etterfølgende patchendringer. Den lokale midlertidige diffen var 54 009 byte og er med vilje ikke del av leveransen.

## Verktøyhistorikk og avgrensning

- bmad-build-renderingen ble kjørt nøyaktig én gang fra prosjektroten med require_escalated, exit 0. Snapshot: `_bmad/render/bmad-build/2026-ebaaf4165725/dc93704410ad8424d0cd/`. Epic-konteksten ble kompilert på nytt gjennom den pålagte underagenten og kontrollert. Ingen separat bmad-spec-runde.
- Første kontroll: 61/61 enhetstester og bygg bestått. Første fokuserte browser-kjøring: 8/8. Første fulle kjøring rapporterte 22/22, men hang i sandkassens opprydding. Egen Vite PID 7608 på strict 5174 ble identifisert før stopp; Stop-Process feilet og målrettet taskkill lyktes. Kjøringen avsluttet deretter med exit 0 (2,1 min). Ingen bruker-server ble stoppet. Senere full kjøring før review bestod 22/22 på 9,0 s utenfor sandkassen med normal avslutning.
- To reviewagenter møtte PermissionDenied ved snapshotlesing, fulgt av misvisende PathNotFound. Autorisert eskalert lesing lyktes, og begge gjennomgangene ble fullført. Ingen reviewlag ble hoppet over.
- Første forsøk på nettleserkjøring etter review ble avvist av automatisk godkjenningskontroll fordi kontrolltjenesten traff bruksgrensen. Root kontrollerte uendret testkommando, pakkehash, strict 5174, nye kontekster og fravær av personlig profil. Et nytt eskalert forsøk med denne dokumentasjonen ble godkjent og ga sluttresultatet 25/25 over. Avvisningen ble ikke omgått.
- Ingen Git-repository finnes eller er opprettet; ingen commit. Baseline er `.tmp/story-1-3-baseline/studieplanlegger/`, brukt med git diff --no-index. Alle fire AC-tekster samsvarer fortsatt med 1.3 i epics.md, og alle elleve sprintnøkler er bevart. Bare 1.3 har fått ny fremdriftsstatus.

Story 1.1 og 1.2 forblir done. Story 1.4 og senere er ikke bygget i denne økten. Neste rekkefølge etter ferdig 1.3 er 1.4 → 2.1 → 2.2 → 2.3. Ingen backend, konto eller publisering.

Månedsutprøving: **Ikke startet**.
Startdato:
Sluttdato:

Måneden starter først etter samlet teknisk/manuell klarering og faktisk oppstart med egne oppgaver. Sluttdato settes da én kalendermåned senere.
