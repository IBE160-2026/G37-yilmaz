# Story 1.2 — menneskelig overtakelse

Status: **Fullført etter studentens bekreftelse 2026-09-06**. Studenten opplyser at alle punktene nedenfor er kontrollert og fungerer. Story og sprintnøkkel for 1.2 er satt til `done`. Automatiserte resultater og agentens skjermbilder står separat i [evidensen](story-1-2-evidence.md).

Start fra `studieplanlegger/` med `npm.cmd run dev`; åpne http://localhost:5173 i samme nettleserprofil. Bruk én redigerende fane og en fiktiv testoppgave. Dette starter ikke månedsutprøvingen med egne studieoppgaver.

- [x] Ved 360 og 1280 px: bruk fysisk Tab/Enter for «Ny oppgave», se synlig fokus og kontroller at alle feltene er leselige uten horisontal sideskrolling.
- [x] Send tomt skjema og kontroller forståelige feil og fokus på Tittel. Fyll gyldig emne, men ugyldige minutter; se at emnet beholdes. Velg Avbryt og kontroller fokus tilbake på Ny oppgave.
- [x] Lagre en oppgave med alle fire verdier. Kontroller tittel, emne, lokal frist, estimat og «Ikke fullført», samt at oppgaven bare vises én gang.
- [x] Last om, lukk siden og åpne samme adresse igjen i samme profil. Kontroller at oppgaven fortsatt finnes med samme verdier.
- [x] Åpne «Om lokal lagring» med Enter og lukk med mellomrom. Kontroller at forklaringen om lokal lagring, manglende synkronisering og sletting er forståelig.
- [x] Stopp serveren med Ctrl+C; bekreft Windows-spørsmålet med Y + Enter om nødvendig.

Faktisk menneskelig bekreftelse: «Alt funket og jeg sjekket alt som sto i 1.2.» Alle sjekkpunktene registreres som bekreftet ut fra dette svaret, inkludert tastatur, begge bredder, feltfeil, avbrudd, lagring, omlasting/gjenåpning og stopp av serveren. Ingen ny automatisert kjøring er utført i denne overtakelsesregistreringen.

Studentens vedlagte skjermbilder viser en lagret oppgave med alle verdier og «Ikke fullført», et lesbart oppgavekort ved 360 CSS-piksler og åpen forklaring av lokal lagring. Bildene alene dokumenterer ikke tastaturhandlinger, omlasting, stopp eller eksakt 1280 px; disse kontrollene bygger på studentens uttrykkelige bekreftelse av hele listen. Ingen feil er rapportert.

Månedsutprøving: **Ikke startet**.
Startdato:
Sluttdato:

Utprøvingen starter først etter samlet teknisk/manuell klarering og faktisk oppstart med egne oppgaver. Denne overtakelsen alene starter ikke måneden.
Ved faktisk oppstart settes sluttdato én kalendermåned etter startdato.
