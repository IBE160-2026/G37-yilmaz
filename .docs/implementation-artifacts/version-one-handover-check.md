# Første versjon — menneskelig overtakelse

> Historisk godkjent kontrolliste for grunnversjonen. Avkrysningene gjelder ikke de senere tilleggene med neste steg, hovedforslag/alternativer og separat levering. De har [egen, ny menneskelig kontrolliste](study-actions-handover-check.md); eldre beskrivelser av filter/forfalt nedenfor dokumenterer tidligere oppførsel.

Status: **Utført og godkjent 2026-09-07** (lokal dato, Europe/Oslo). Studenten svarte «Alt funket» etter instruksen om å gjennomføre hele kontrollisten selv. Alle punktene nedenfor er registrert som bekreftet på grunnlag av denne meldingen. Godkjenningen gjelder story 1.4, 2.1, 2.2 og 2.3 samlet og kommer i tillegg til tidligere godkjenning av 1.1–1.3. Automatiserte resultater dokumenteres separat i [evidensen](version-one-evidence.md).

Tidligere samme dag ble en supplerende automatisert gjennomgang [registrert i evidensen](version-one-evidence.md#innsendt-automatisert-gjennomgang). Den lot fysisk studentkontroll stå åpen: fristpassering og retur var simulert, og gjenåpning gjaldt siden i samme nettleserkontekst. Den rapporten er fortsatt automatisk evidens. Avkrysningene nedenfor bygger på studentens senere personlige bekreftelse, ikke på automatiseringen.

Start fra `C:/IBE160/2026/studieplanlegger/` med `npm.cmd run dev`, eller bruk din allerede kjørende server på **http://localhost:5173**. Bruk én redigerende fane og samme lokale tidssone. Bevar egne studieoppgaver: lag tydelig fiktive kontrolloppgaver, og bruk en separat nettleserprofil med bare fiktive oppgaver for tomtilstander. Ikke injiser lagringsfeil i den personlige profilen.

To eldre begrensninger er dokumentert: samtidige endringer i flere faner kan overskrive hverandre, og enkelte tidssonebytter kan gjøre en lagret lokal frist ugyldig og aktivere lesefeilsperren. Lagrede data blir ikke automatisk slettet. Støtte for disse bruksmåtene er ikke bygget i første versjon.

Kontrollgrunnlaget som studenten nå har bekreftet omfatter både **360 og 1280 px** bredde og fysisk Tab/Shift+Tab, Enter og mellomrom. Instruksjonene nedenfor beholdes som dokumentasjon av det som ble bedt kontrollert.

- [x] Opprett fiktive oppgaver med 20, 30 og 31 minutter og forskjellige frister: minst én i denne uken, én utenfor uken og én gammel frist. Kontroller at «Denne uken» er startvisningen, at lagring utenfor valgt visning gir en forståelig forklaring, og bruk «Alle oppgaver» for å finne alle.
- [x] Bruk tastaturet til å fullføre og angre på én oppgave. Bare den valgte oppgaven skal endres; tekststatus og avkrysning skal stemme, og fokus skal være synlig og bli på statusfeltet når oppgaven fortsatt vises.
- [x] Rediger en fullført oppgave i det samme skjemaet og lagre; statusen skal beholdes. Prøv en ugyldig verdi, kontroller feltfeilen og beholdt utkast, og avbryt uten at de gamle verdiene endres.
- [x] Åpne sletting på en fiktiv oppgave og avbryt. Bekreft så sletting av bare den valgte oppgaven. Kontroller relevant fokus etter begge handlingene.
- [x] Bytt mellom uke og alle oppgaver med tastaturet. Valgt visning skal være tydelig. Gamle ufullførte frister skal merkes «Forfalt» i allevisningen og inngå i ukens forfaltantall; fullførte skal ikke merkes forfalt. Bruk snarveien til alle oppgaver.
- [x] Sett en fiktiv frist litt frem i tid. Behold et påbegynt redigeringsutkast og fokus i et tekstfelt mens fristen passeres. Forfaltinformasjonen skal oppdateres uten at inndata, markør eller fokus forstyrres. Avbryt etterpå. Kontroller også etter at du går bort fra siden og tilbake.
- [x] Velg «Hva kan jeg gjøre nå?» og 30 minutter. Ufullførte 20/30-minuttersoppgaver skal kunne vises, også med gammel frist eller frist utenfor uken. 31-minuttersoppgaver og fullførte skal utelates. Tidligste frist skal komme først.
- [x] Prøv tomme, null, negative og desimale minutter. Feltfeilen skal være forståelig, og siden skal ikke påstå at et ugyldig valg har gitt nye treff. Prøv så en gyldig tid uten treff og kontroller «Ingen oppgaver passer tiden», endring av minutter og veien til alle oppgaver.
- [x] Fullfør et treff: det skal forsvinne med relevant fokus. Angre i alle oppgaver og gå tilbake: samme gyldige minutter beholdes, og oppgaven er med igjen. Rediger og slett fiktive treff og kontroller resultatene.
- [x] Last om, lukk og gjenåpne siden på samme adresse/profil. Oppgaver, rettinger og fullføringsstatus skal være bevart; slettede oppgaver skal fortsatt være borte. Visning og tilgjengelige minutter er midlertidige valg, så startsiden er uke igjen.
- [x] I en separat profil med bare fiktive oppgaver: kontroller tom uke, tomt tidsresultat og helt tom oppgaveliste. Det skal være tydelig hvordan du oppretter en oppgave eller går til alle oppgaver.
- [x] Ved begge bredder: les innholdet og bruk alle sentrale kontroller med tastaturet. Kontroller merkede felt, tydelig valgt visning, synlig fokus, relevante fokuspunkter etter handlinger og fravær av horisontal sideskrolling. Les forklaringen om lokal lagring og én redigerende fane.
- [x] Les dokumenterte lagringsfeil i evidensen og se skjermbildene. Vurder om det er klart hva som ikke ble lagret, at tidligere oppgaver/utkast beholdes, hvilke handlinger som er sperret ved lesefeil og hvordan du prøver igjen. Personlige data skal ikke endres for denne kontrollen.
- [x] Hvis du startet serveren bare for kontrollen, stopp med Ctrl+C; bekreft eventuelt Windows-spørsmålet med Y + Enter.

Faktisk menneskelig bekreftelse, mottatt 2026-09-07 (Europe/Oslo):

> Alt funket

Meldingen kom direkte etter instruksen om å gjennomføre hele denne kontrollisten selv og melde resultatet. Den registreres derfor som samlet godkjenning, inkludert fysisk tastaturbruk og vurdering av forståelighet. Ingen nye automatiserte tester, kodeendringer eller undersøkelser av personlige nettleserdata er utført ved registreringen.

Dato: 2026-09-07
Eventuelle feil eller begrensninger: Ingen nye feil meldt ved personlig overtakelse. De dokumenterte begrensningene og språkmerknadene nedenfor beholdes.

Språkmerknader fra den innsendte automatiserte gjennomgangen: entall bør vises som «1 ufullført oppgave», og feltfeilen bør forklare for store minuttall uten å vise den tekniske grensen `9007199254740991`. Merknadene er registrert; ingen språk- eller kodeendring er utført ved denne dokumentoppdateringen.

De fire storyene og begge epicene er registrert som `done`. Alle sju stories i første versjon er dermed bygget, kontrollert og menneskelig overtatt. Retrospektiver er ikke registrert som utført.

Månedsutprøving: **Ikke startet**.
Startdato:
Sluttdato:

Godkjenning alene starter ikke måneden. Registrer datoer i [utprøvingsloggen](trial-log.md) først når samlet kontroll er klarert og faktisk bruk med egne oppgaver begynner; sluttdato én kalendermåned senere.
