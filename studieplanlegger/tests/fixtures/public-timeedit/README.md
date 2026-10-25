# Offentlige TimeEdit-fixturer

## Personvernminimerte derivater

`mf-calendar.ics`, `nih-calendar.ics`, `steiner-calendar.ics` og `volda-calendar.ics` er personvernminimerte derivater. Undervisernavn i de kontrollerte kildefeltene er erstattet med stabile `Testunderviser`-etiketter etter utfolding av logiske RFC 5545-linjer. Rettelsen 25.10.2026 omfatter også de senere personsegmentene i MF-beskrivelsen og personsegmentene i NIH-sammendraget. `nih-schedule.html` beholder 75 tabellrader og den opprinnelige kolonneformen, men den ikke-tomme Foreleser-kolonnen er syntetisert. Hendelses-ID-er, emnekoder, aktivitetstyper, datoer, tider, rom, grupper, feltrekkefølge og kildehenvisninger er bevart.

`fixture-privacy.test.js` kontrollerer både kildefeltene og faste kontrakter for alle SUMMARY-, DESCRIPTION-, LOCATION- og X-ALT-DESC-forekomster i de lagrede ICS-hendelsene, også gjentatte felt og senere segmenter. Syntetiske negative tilfeller dekker rester før/etter syntetiske etiketter, alternative felt, linjefolding og andre navneformer. Kontraktene krever ny innholdsgjennomgang ved kildeendring; de er ikke en generell navnedetektor eller et personvernbevis for fremtidige kildeopptak. Faglige navn, romnavn og offentlig kildeattribusjon er beholdt.

Fixturene er daterte opptak av offentlig tilgjengelige søke-, timeplan- og kalenderkontrakter. De brukes lokalt og åpner ingen møte- eller abonnementslenker.

`ldh-calendar.ics` er avledet fra den offentlige LDH-kalenderen. Tre kildepubliserte møteblokker er erstattet med entydig syntetisk eksempel-URL, møte-ID og passord. Hendelser, tidspunkt, varigheter, RFC 5545-folding og øvrig offentlig kildeinnhold er bevart; de opprinnelige tilgangsverdiene er ikke dokumentert i repositoriet.
