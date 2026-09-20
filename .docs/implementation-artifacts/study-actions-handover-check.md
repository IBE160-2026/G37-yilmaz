# Neste steg, hovedforslag og levering — menneskelig gjennomgang

> Prøveliste og delvis observasjon fra grensesnittet før dashboardredesign/fristkalender. Den registrerte eksempelflyten er bevart nedenfor. Bruk [ny kalender-/redesignprøveliste](ui-calendar-handover-check.md) for den videreutviklede utformingen; dette dokumentet er ikke ny godkjenning av den.

Status: **Eksempelflyten er prøvd; hele sjekklisten er ikke bekreftet**. Studenten meldte «Jeg har gjort det» 2026-09-07 etter den korte prøvebeskrivelsen og la ved to skjermbilder. Observasjonene står nedenfor. Tidligere menneskelig godkjenning gjelder grunnversjonen. Automatisk verifisering føres i [evidensen](study-actions-evidence.md).

Start med `npm.cmd run dev` fra `C:/IBE160/2026/studieplanlegger/` og åpne **http://localhost:5173**. Bruk samme profil, én redigerende fane og samme tidssone. Bevar egne oppgaver; bruk tydelig fiktive kontrolloppgaver, og en egen profil ved kontroll av tom liste. Ikke injiser lagringsfeil i personlige data.

- [ ] Opprett «Skriv rapport i IBE160», 240 minutter, med frist denne uken og «Krever innlevering». Legg til «Les oppgaveteksten og lag en disposisjon», 20 minutter, som neste steg. Kontroller separate estimater for oppgave og steg.
- [ ] Rediger stegets beskrivelse og minutter. Prøv tom beskrivelse og ugyldige minutter og kontroller forståelig feil og beholdt utkast. Fjern steget, legg det til igjen, marker «Neste steg gjort» og legg til et nytt. Oppgaven skal fortsatt være uferdig og ikke levert med hovedestimat 240.
- [ ] Legg inn en annen passende oppgave med senere frist. Velg «Hva kan jeg gjøre nå?» og 30 minutter. Kontroller ett hovedforslag med konkret handling, riktig stegestimat, oppgavetittel, frist og forståelig regelbegrunnelse. Vis/skjul alternativene og kontroller fristrekkefølgen.
- [ ] Prøv en gyldig tid uten treff. Bruk både «Endre minutter» og «Legg til et mindre neste steg»/«Alle oppgaver». Store oppgaver og gamle frister skal fortsatt finnes i relevant uke-/alleoversikt.
- [ ] Marker rapportens arbeid ferdig. Kontroller «Klar til levering», fortsatt relevant frist-/forfaltvisning, og at rapporten ikke foreslås som uferdig arbeid. Bekreft levering manuelt, kontroller «Levert (bekreftet manuelt)», og angre levering. Arbeidet skal fortsatt være ferdig og klart til levering.
- [ ] For bekreftet levert arbeid: les forklaringen om å angre levering før ferdigstatus eller innleveringskravet endres. Kontroller at en vanlig oppgave fortsatt kan fullføres/angres uten leveringshandlinger. Hvis en eldre fullført oppgave markeres med innleveringskrav, skal den bli klar til levering uten automatisk leveringsbekreftelse.
- [ ] Last om og lukk/gjenåpne siden på samme adresse/profil. Kontroller lagrede steg, begge statuser, oppgavedetaljer og eventuell fjernet steg. Tilgjengelig tid og valgt visning er fortsatt midlertidige.
- [ ] Gjennomfør de nye handlingene ved 360 og 1280 px med Tab, Shift+Tab, Enter og mellomrom. Kontroller tydelige feltnavn, synlig/relevant fokus, ingen horisontal sideskrolling og beholdt utkast når klokken oppdaterer siden. Kontroller fokus etter at hovedforslaget forsvinner eller alternativer skjules.

Dato: 2026-09-07.
Faktiske observasjoner og eventuelle feil:

- Studenten bekrefter at det foreslåtte prøveeksempelet er gjennomført. Vedleggene i samtalen viser meldingen «Neste steg er gjort» og at et nytt steg kan legges til.
- «Alle oppgaver» viser «Fransk presentasjon» med hovedestimat 20 minutter, frist 2026-09-16 kl. 20:48, avkrysset «Ferdig med arbeidet», «Klar til levering» og knappen «Bekreft levert».
- Tidsvisningen viser 0 forslag ved 200000 minutter. Dette stemmer med at den viste oppgavens arbeid allerede er ferdig og derfor utelates fra arbeidsforslag, selv om levering gjenstår. Oppgaven finnes fortsatt i alleoversikten.
- Skjermbildene viser sluttstatusen, ikke alle overganger eller lagrede verdier før og etter handlingene. Ingen feil er uttrykkelig meldt. Hele punktene ovenfor, herunder validering, alternativer, omlasting og mobil/tastatur, er ikke enkeltvis bekreftet; de står derfor fortsatt åpne. Ingen faktisk oppstart av månedsutprøvingen er meldt.

Fyll inn bare det du faktisk prøver. Denne listen starter ikke månedsutprøvingen automatisk og er ikke en antatt godkjenning. Bruk [månedsloggen](trial-log.md) når du begynner med egne studieoppgaver.
