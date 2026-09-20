# Visuell oppdatering

Presentasjonslaget bruker eksisterende handlinger, rendering og lagring. Det
oppretter eller endrer ikke brukerdata. Ingen KI er del av produktets logikk.

- Desktop: 220 px venstremeny, innhold på inntil 1280 px og kompakt nøkkeltallsrad.
- Fokus: tidsvalg med aktivmarkør, egen studieillustrasjon og ett oppgavekort.
- Frister: korte rader uten gjentatt begrunnelse og kapasitetsvarsel.
- Kalender: kommende agenda som standard, månedsvisning og tilgjengelig hjelp.
- Mobil: bunnavigasjon med tre hovedvalg og en tastaturbetjent «Mer»-meny.
- Kapasitet: manglende studieøkter er en planleggingsmelding, ikke bevis på
  tidsmangel. Faktisk tidsmangel varsles når gjenstående arbeid overstiger hele
  tidsrommet før fristen etter registrert undervisning. Beregninger ligger i
  detaljer. Søvn og andre uregistrerte avtaler kan ikke utledes av dataene.
- Bevegelse: aktivmarkører, kort introduksjon av illustrasjonen og overgang ved
  endret hovedforslag. Redusert bevegelse deaktiverer dette.

## Illustrasjon

`public/study-focus-v2.png` er en ferdig, lokal ressurs laget med det innebygde
bildeverktøyet. Den lastes fra appen, uten eksterne bilde- eller KI-kall.

Prompt: a cohesive premium editorial isometric study illustration of a cobalt
blue notebook, offwhite calendar sheet and navy/lime pencil; precise paper edges,
restrained texture, cool offwhite #f5f7fb, navy #172842, blue #2864ed, small lime
#d2eb88 accents; soft shadows, transparent background, no text, people or logos;
strong compact silhouette suitable for a 250px website asset.

## Kontroll

`tests/unit/capacity-notice.test.js` dekker forskjellen mellom uplanlagt arbeid
og reell tidsmangel, undervisningsoverlapp og ukjente estimater.
`tests/e2e/redesign.spec.js` bruker isolerte testdata og kontrollerer desktop,
mobil, oppgaveåpning, tidsvalg, agenda/måned, navigasjon og redusert bevegelse.
Skjermbilder lagres som `artifacts/redesign-1440.png` og
`artifacts/redesign-390.png` ved kjøring av nettlesertestene.

## Ferdigstilling 8. september 2026

`redesign.css` samler det visuelle designsystemet. Tidligere doble regler for
markører, fokusflate og mobilnavigasjon er erstattet. Eksisterende funksjonelle
stiler ligger i et lavere CSS-lag. Manrope i vektene 400, 500 og 600 lastes lokalt
fra `public/fonts/`, med medfølgende SIL Open Font License. Norske tegn som var
feilkodet i HTML, er rettet.

Tom konto har én oppstartskomposisjon. Kontoer med emner eller undervisning, men
uten oppgaver, viser en relevant invitasjon sammen med kalenderen. Oppstarten
skjuler ikke lenger registrering, oppgavelister eller kapasitet på andre sider.

Den mørke fokusflaten samler tidskontrollene og illustrasjonen. Hovedforslaget
ligger i ett selvstendig kort. Fristlisten bruker korte rader som åpner oppgaven;
statusendringene er fortsatt tilgjengelige i oppgavemenyen. Illustrasjonen kan
ikke fange klikk på kontrollene.

`agenda-view.js` leser oppgaver, undervisning og studieøkter direkte fra modellen.
Agendaen viser de fem nærmeste oppføringene, også over månedsskifter, med flere
tilgjengelige ved behov. Pågående undervisning prioriteres. Emne, sted og norsk
klokkeslett følger oppføringen. Månedsvisning og kalenderhjelp er beholdt.

Registrering bruker native dialoger med fokusavgrensning, Escape og returfokus.
Mobilmenyen har tre hovedvalg og en tastaturbetjent Mer-meny. Redusert bevegelse
bevarer synlig innhold. Kapasitetsvisningen skiller uplanlagt arbeid fra påvist
tidsmangel, og ukjent arbeidstid vises som ukjent.

### Utført kontroll

- Tom, delvis utfylt og realistisk konto i Chromium ved 1440 x 900 og 390 x 844.
- Skjermbildene er åpnet og visuelt vurdert, også dialoger og emnevisning.
- Tidsvalg, egen tid, riktig oppgaveåpning, alternativer, navigasjon og kalender.
- Dialogfokus, tastaturbruk, 200 prosent tekststørrelse og redusert bevegelse.
- Lokal fontlasting og kontrast på minst 4,5:1 for kontrollerte tekstpar.
- Manuell registrering, kalenderimport, duplikatvern, norsk sommer-/vintertid,
  importfeil og bevaring av data i isolerte nettleserkontekster.
- NTNU-kilden for TDT4110 høst 2026 hentet faktisk emneinformasjon og 140 økter.
  Hentingen ble også kontrollert gjennom appens lokale importtjeneste.

Målrettede nettlesertester: `tests/e2e/design-final.spec.js`,
`tests/e2e/redesign.spec.js` og `tests/e2e/subjects-import.spec.js`.
Agendaens regler er dekket i `tests/unit/agenda-view.test.js`.

Skjermbilder: `artifacts/studieplan-{empty,partial,populated}-{1440,390}.png`,
`artifacts/studieplan-dialog-{1440,390}.png` og
`artifacts/studieplan-subjects-{1440,390}.png`. Mobilvariantene av oversikten finnes
også med `-full.png` for hele sidelengden. Alt eksempelinnhold er testdata og
lagres aldri i brukerens nettleserprofil.

## Sluttkontroll 8. september 2026

Implementeringen er ferdig kontrollert med isolerte eksempeldata. Brukerens faktiske lokale lagring er ikke endret.

- Produksjonsbygg: `npm run build` bestått.
- Enhetstester: 330 bestått i 11 testfiler.
- Nettleser: 104 unike scenarier bekreftet bestått. Fullkjøringen ga 100 bestått og fire feil. Etter retting ble de fire, samt to tilgrensende scenarier, kjørt på nytt: seks bestått, ingen uavklarte feil. Dette er en fullkjøring med dokumentert omkjøring, ikke en ny samlet fullkjøring etter siste rettelse.
- Ekte nettlesermåling: aktivmarkører 220 ms, forslagsovergang 200 ms og dialogovergang 180 ms. Dialogene beholder og returnerer fokus. Redusert bevegelse gir 0 s overgang og ingen illustrasjonsanimasjon.
- Tom, delvis utfylt og realistisk konto er kontrollert ved 1440 x 900 og 390 x 844. Skjermbildene er åpnet og vurdert. Større tekst, lange norske navn, tekstkontrast og faktisk lokal lasting av Manrope er kontrollert.
- Oppgaveforslag, alle tidsvalg og egendefinert tid, åpning av riktig oppgave, manuell registrering, kalenderfiltrering, månedsvisning, import, gjentatt import, feil og gjenoppretting er dekket. Ingen KI eller automatisk generert arbeidsplan er innført.

Den siste fokusrettelsen utelukker også CSS-skjulte kalenderkontroller fra returfokus. Testene bruker nå faktisk modalitet, ikke en antakelse om at alle bakgrunnsknapper må ha `disabled`. Vite ignorerer testartefakter, slik at HTML-snapshots i Playwright-spor ikke laster om andre nettleserøkter.

Maskinlesbart resultat: `artifacts/verification-summary.json`. Full rapport: `artifacts/final-e2e-report.json`. Omkjøring: `artifacts/recheck-e2e-report.json`.

Utvalgte skjermbilder:

- `artifacts/studieplan-empty-1440.png`
- `artifacts/studieplan-empty-390.png`
- `artifacts/studieplan-partial-1440.png`
- `artifacts/studieplan-partial-390.png`
- `artifacts/studieplan-populated-1440.png`
- `artifacts/studieplan-populated-390.png`
- `artifacts/studieplan-dialog-390.png`
- `artifacts/studieplan-course-dialog-390.png`

Begge adressene `http://studieplan.localhost/` og `http://localhost:5173/` er åpnet i Chromium og returnerte 200 med fungerende oversikt. Lokal lagring er knyttet til nettadressen: bruk samme adresse som tidligere for eksisterende data.

NTNU-kontroll og konkrete tilgangsbegrensninger er beskrevet i `IMPORT.md`. Offentlige emnedata og TP-kalender for TDT4110 høsten 2026 ble hentet fra de faktiske kildene. Feide-beskyttede kilder krever kalenderfil eller en tilgjengelig kalenderlenke. Filimport er en engangsimport; lagrede lenker oppdateres med «Oppdater nå», ikke automatisk synkronisering.
