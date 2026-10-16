# Plan for studentutprøving

**2026-10-16 — planlagt, ikke gjennomført.** Gjelder [SC-07 i briefen](../../brief.md), R-07 og S-07. Teknisk onboarding i Playwright er ikke en studentprøve. Dette dokumentet er en protokoll, ikke en personlig logg eller refleksjon.

## Avgrenset første prøve

Inviter én frivillig student som ikke kjenner appen. Forklar at appens forståelighet undersøkes, at deltakeren kan avbryte, og at det brukes syntetiske oppgaver uten private kalenderlenker, ekte innleveringer eller personlige data. Bruk en separat tom testinstans; ikke port 80, eksisterende profiler eller reelle databaser. Lokal oppstart følger [README](../../README.md). Ingen prøve er startet gjennom denne dokumentasjonsendringen.

Gi følgende scenario skriftlig: «Du har et fiktivt emne, en oppgave som skal leveres og et ledig tidsrom. Lag en plan, registrer at du trenger mer tid, kontroller en justering og vis hva som skal til for at oppgaven er ferdig og levert.» Bruk manuell oppretting for å unngå at kildefeil avgjør forståelsestesten. Fasilitatoren kan gjenta scenariet, men skal ikke vise hvilke kontroller som må brukes uten å registrere det som hjelp.

| Del | Observerbart forventet resultat |
| --- | --- |
| Oppstart | Emne og oppgave opprettes; deltakeren finner og godkjenner én økt. |
| Utfall | Deltakeren registrerer faktisk arbeid og nytt gjenstående anslag hver for seg. |
| Justering | Deltakeren kontrollerer og godkjenner et forslag, og finner angre. |
| Forståelse | Deltakeren forklarer med egne ord at ferdig arbeid ikke bekrefter innlevering, og viser den separate bekreftelsen. |

SC-07 er oppnådd **for denne prøven** bare hvis alle fire deler fullføres uten veiledning i betjening og forklaringen er korrekt. Hjelp, avbrudd og misforståelser rapporteres som faktiske utfall. Registrer varighet, men ikke bruk en oppdiktet tidsgrense. Én prøve gir ikke representativ dokumentasjon på studentnytte eller bedre læring.

## Valgfri isolert oppstart før en framtidig prøve

Fasilitatoren kan bruke følgende i **en ny, separat PowerShell-terminal**, fra `studieplanlegger/`. Miljøoverstyringene gjelder bare denne terminalen og dens prosesser. Dette er en oppskrift, ikke en utført kjøring. Docker/Compose må være installert fra før. Prosjektnavnet gir et eget nytt volum; ikke bruk eksisterende prosjekt eller data.

```powershell
$trialProject = 'studieplan-trial-' + [guid]::NewGuid().ToString('N')
$trialProbe = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, 0)
$trialProbe.Start()
$env:STUDIEPLAN_PORT = [string]$trialProbe.LocalEndpoint.Port
$trialProbe.Stop()
$env:STUDIEPLAN_SEED = 'false'
$env:STUDIEPLAN_SEED_JSON = ''
docker compose -p $trialProject up --build -d
if ($LASTEXITCODE -ne 0) { throw 'Oppstart feilet; ikke bruk en annen eksisterende instans.' }
docker compose -p $trialProject ps
Invoke-RestMethod "http://127.0.0.1:$env:STUDIEPLAN_PORT/api/health"
```

Vent til `docker compose -p $trialProject ps` viser `healthy` før prøven; gjenta helsekontrollen hvis appen fortsatt starter. Etter prøven stoppes prosjektet i samme terminal:

```powershell
docker compose -p $trialProject down
```

Porten er kontrollert ledig på loopback før oppstart; hvis en annen prosess tar den i mellomtiden, må oppstarten avbrytes og oppskriften kjøres med et nytt prosjekt. Åpne den viste lokale adressen i en ny midlertidig nettleserprofil, og kontroller tom tilstand uten å importere nettleserdata. Siste kommando stopper bare prøveprosjektet og sletter ikke volumet. Noter prosjektnavn og port lokalt hvis stopp må gjøres senere; lukk terminalen etter stopp.

## Faste syntetiske verdier og teknisk forhåndskontroll

La **D** være oppsettdatoen i Europe/Oslo. Fasilitatoren skriver de faktiske kalenderdatoene for D+1, D+2 og D+3 i scenarioarket. Bruk emne `TEST101 – Eksempelfag`, oppgave `Les syntetisk eksempelkapittel`, innleveringskrav på, opprinnelig og gjenstående anslag **60 minutter**, og frist **D+3 kl. 16:00**. Arbeidsvinduer er **D+1 kl. 10:00–12:00** og **D+2 kl. 10:00–12:00**; registrert opptatt tid er **D+1 kl. 10:00–10:30**. Første økt er **D+1 kl. 10:30–11:00**, kontrollert og godkjent av deltakeren. Etter denne økten registreres **30 faktiske minutter**, «trenger mer tid» og **75 minutter gjenstående**; deltakeren kontrollerer deretter ny plan før fristen og finner angre. Eksempelinnlevering er kun en simulert manuell bekreftelse, aldri en handling mot et lærested.

Prøven kan deles i oppsett på D og oppfølging etter økten på D+1; ingen framtidig økt skal registreres som allerede utført. Eventuelle endrede datoer/tider noteres sammen med årsaken. Før studentprøven kontrollerer fasilitatoren oppstart, tom lagring og at scenarioet kan gjennomføres teknisk i et eget prøveprosjekt; studenten får deretter et nytt tomt prosjekt med samme oppskrift. Feil her er tekniske forhåndsfunn, ikke studentresultater. Ingen av disse kontrollene eller studentprøven er gjennomført i denne dokumentasjonsrunden.

## Dokumentasjon og oppfølging

Noter prøvedato, appversjon, syntetisk scenario, hvilke deler som ble fullført, hjelp som ble gitt, konkrete problemer og deltakerens frivillige tilbakemelding. Ikke publiser navn, råskjermopptak eller private notater. Et senere anonymisert sammendrag kan knyttes til SC-07 når det faktisk finnes; råmateriale forblir lokalt/ignorert.

Etter oppgavene spørres det hva som var uklart, og hvordan vedlikeholdsarbeidet opplevdes sammenlignet med kalender/Canvas/oppgaveliste. Dette er kvalitative spørsmål, ikke dokumentert effekt. Eventuell lengre egenbruk skal oppgi reelle datoer, avbrudd og hendelser. Ingen måned med bruk eller personlig læring fylles inn på forhånd. Avklar separat skolekrav og lærerens omtale av Claude Code; slike spørsmål er ikke blokkeringer for denne protokollen.
