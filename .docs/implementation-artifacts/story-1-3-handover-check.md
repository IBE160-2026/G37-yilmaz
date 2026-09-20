# Story 1.3 — menneskelig overtakelse

Status: **Utført og godkjent 2026-09-06** (lokal dato, Europe/Oslo). Studenten har bekreftet hele overtakelseskontrollen for 1.3, inkludert redigering og sletting. Alle punktene nedenfor er registrert som bekreftet på grunnlag av studentens egen melding. Automatiserte resultater og agentobservasjoner dokumenteres i [evidensen](story-1-3-evidence.md).

Start fra `C:/IBE160/2026/studieplanlegger/` med `npm.cmd run dev`, eller bruk serveren du allerede har startet på **http://localhost:5173**. Bruk én redigerende fane. Opprett to tydelig fiktive testoppgaver; velg bare disse under kontrollen. Egne studieoppgaver skal bevares.

- [x] Ved både 360 og 1280 px: bruk fysisk Tab/Shift+Tab og Enter for å nå «Rediger» og «Slett». Kontroller synlig fokus, leselige knapper og tekst, og at siden ikke krever horisontal skrolling.
- [x] Velg «Rediger» på én testoppgave. Kontroller at det samme skjemaet er fylt med alle fire verdier. Endre tittel, emne, lokal frist og estimat; lagre. Bare valgt oppgave endres, uten duplikat. Status beholdes, og fokus går tilbake til oppgavens «Rediger». Ny frist kan flytte oppgaven i visningen.
- [x] Rediger igjen med tom tittel og ugyldige minutter. Kontroller forståelige feltfeil, beholdt inndata og fokus på første ugyldige felt. Velg «Avbryt»: tidligere lagrede verdier beholdes, skjemaet lukkes og fokus går tilbake til «Rediger». Åpne igjen og kontroller gamle verdier uten gamle feltfeil.
- [x] Mens skjemaet er åpent: kontroller at en annen oppgavehandling ikke kan overskrive utkastet. Fullfør eller avbryt skjemaet før du går videre.
- [x] Velg «Slett» på en fiktiv oppgave. Dialogen skal identifisere riktig oppgave. Avbryt med tastaturet: oppgaven skal fortsatt finnes, og fokus skal være tilbake på «Slett».
- [x] Velg «Slett» igjen og bekreft. Bare den valgte testoppgaven forsvinner. Fokus går til en gjenværende oppgave, eller «Ny oppgave» hvis listen er tom.
- [x] Last om, lukk siden og åpne samme adresse igjen i samme nettleserprofil. Den redigerte testoppgaven skal beholde verdiene, og den slettede skal fortsatt være borte.
- [x] Kontroller tomtilstanden etter siste sletting **bare i en separat nettleserprofil med utelukkende fiktive oppgaver**. Ikke slett egne oppgaver for å få tom liste. «Ny oppgave» skal være tilgjengelig og ha fokus rett etter siste sletting.
- [x] Les dokumenterte feilmeldinger/skjermbilder i evidensen. Vurder om det er forståelig at mislykket redigering/sletting ikke er lagret, at tidligere data beholdes, og hvordan man forsøker igjen. Ikke injiser feil i personlige nettleserdata.
- [x] Hvis du startet serveren for kontrollen: stopp med Ctrl+C, og bekreft Windows-spørsmålet med Y + Enter om nødvendig.

Faktisk menneskelig bekreftelse, mottatt 2026-09-06 (lokal dato, Europe/Oslo):

> Jeg gjorde alt i # Story 1.3 — menneskelig overtakelse. alt funket.

Dette bekrefter hele kontrollen, også den fysiske tastaturprøven og vurderingen av forståelighet. Story 1.3 er menneskelig godkjent og registrert som `done` i story og sprint. Det er ikke kjørt nye automatiserte tester ved denne dokumentoppdateringen.

Månedsutprøving: **Ikke startet**.
Startdato:
Sluttdato:

Måneden starter først etter samlet teknisk/manuell klarering og faktisk oppstart med egne oppgaver. Ved faktisk oppstart settes sluttdato én kalendermåned senere. Testing med fiktive oppgaver og overtakelse av 1.3 starter ikke måneden.
