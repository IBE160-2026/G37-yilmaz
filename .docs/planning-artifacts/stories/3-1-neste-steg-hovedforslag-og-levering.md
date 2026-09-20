---
source: ../epics.md
story: '3.1'
status: review
created: 2026-09-07
---

> Denne storyen bevarer oppgave-/steg-/leveringskravene, tidligere testresultater og delvis menneskelig observasjon. Dashboard, dato-/tidsgrensesnitt og fristkalender videreutvikles i [story 4.1](4-1-oversiktlig-dashboard-og-fristkalender.md); den tidligere observasjonen er ikke godkjenning av den nye utformingen.

### Story 3.1: Neste steg, hovedforslag og levering

Som student vil jeg velge én konkret handling som passer tiden min og skille ferdig arbeid fra bekreftet levering, slik at det blir lettere å komme i gang og holde oversikt over gjenstående innlevering.

**Krav:** FR-1–8, NFR-1–3, AD-1–6. **Avhengigheter:** eksisterende 1.1–2.3. **Status:** Teknisk ferdig og verifisert; studenten har meldt at eksempelflyten er prøvd. Full menneskelig kontrolliste er ikke bekreftet, derfor review.

**Acceptance Criteria:**

1. **Gitt** en oppgave, **når** jeg legger til, redigerer, fjerner eller markerer neste steg gjort, **så** finnes maksimalt ett aktivt steg med kort beskrivelse og eget positivt sikkert heltallsestimat i minutter. **Og** fullføring/fjerning tømmer steget uten historikk, slik at et nytt kan legges til, uten å endre hovedoppgavens ID, rekkefølge, estimat, fullføring eller levering. Tom beskrivelse og ugyldige minutter gir feltfeil med beholdt utkast.
2. **Gitt** tilgjengelig tid, **når** forslag beregnes, **så** brukes aktivt stegestimat når det finnes, ellers hovedestimatet; bare uferdig arbeid som passer tas med på tvers av alle uker. **Og** frist sorteres stigende med stabil opprettingsrekkefølge ved lik frist. En 240-minuttersoppgave med 20-minutterssteg passer 30 minutter; en 20-minuttersoppgave med aktivt 31-minutterssteg passer ikke.
3. **Gitt** flere treff, **når** resultatet vises, **så** presenteres ett tydelig hovedforslag og en kontroll for å vise/skjule de øvrige alternativene i samme fristrekkefølge. **Og** konkret handling, riktig estimat, tilhørende oppgave og frist vises med faktisk begrunnelse: passer tiden og nærmest frist blant kandidatene. Stegestimat merkes uttrykkelig og fremstilles ikke som tid til hele oppgaven.
4. **Gitt** ingen treff, **når** resultatet vises, **så** kan jeg endre minutter eller åpne alle oppgaver og legge til et mindre neste steg. **Og** store oppgaver og oppgaver med nær eller passert frist finnes fortsatt i relevant uke-/alleoversikt, uavhengig av tidsfilteret.
5. **Gitt** «Krever innlevering», **når** arbeidet fullføres, **så** står «Klar til levering», oppgaven forblir i relevant fristoversikt/forfaltantall og utelates fra arbeidsforslag. **Når** jeg bekrefter levering manuelt, **så** står «Levert (bekreftet manuelt)». **Når** jeg angrer levering, **så** beholdes ferdig arbeid og «Klar til levering» gjenopprettes. Levering kan ikke bekreftes før arbeidet er ferdig eller for en vanlig oppgave. Bekreftet levering må angres før arbeidsfullføring eller innleveringskrav kan endres. Vanlige oppgaver beholder fullføring/angre uten leveringskontroller.
6. **Gitt** eldre og nye lagrede oppgaver, **når** siden lastes, endres og gjenåpnes, **så** beholdes oppgaver, ID-er, rekkefølge og alle gyldige felt i samme nøkkel/skjema. **Og** manglende nye felt betyr intet aktivt steg, intet innleveringskrav og ikke levert; gammel fullføring tolkes aldri som levering. Nye felt valideres når de finnes. Ingen oppstartsskriving eller automatisk nullstilling forekommer.
7. **Gitt** validerings-/lese-/skrivefeil eller tastaturbruk ved 360/1280 px, **når** nye handlinger utføres, **så** bevares lagrede data og gyldige utkast ved feil, sperrer dekker alle endringer, og et nytt forsøk kan lykkes. **Og** felt/navn, synlig fokus, alternativer, feilmeldinger og relevant fokus etter at forslag forsvinner fungerer uten horisontal sideskrolling. Klokkeoppdateringer bevarer utkast/fokus.
8. **Gitt** fullført implementering, **når** verifisering og dokumentasjon ferdigstilles, **så** registreres faktiske resultater fra tilgjengelige enhetstester, nettlesertester, bygg og eventuell lint/typekontroll. **Og** brief, krav, arkitektur, funksjonsbeskrivelse, tester og prosjektstatus samsvarer med alle tre funksjoner som nåværende scope; forventede brukereffekter og ukjørte menneskelige kontroller markeres uttrykkelig uten å omskrive eldre testbevis.

**Planlagt verifikasjon:** Eksisterende Vitest-/Playwright-opplegg med nye regresjoner for stegestimatets forrang, fristsortering, gamle/nye data, statusskille, skrivefeil og alle UI-handlinger. Kjør eksisterende tester og produksjonsbygg. Dokumenter tilgjengeligheten av lint/typekontroll og eventuelle blokkerte kontroller. Se [spesifikasjonen](../../implementation-artifacts/spec-study-actions.md), [evidensen](../../implementation-artifacts/study-actions-evidence.md) og [ny menneskelig kontrolliste](../../implementation-artifacts/study-actions-handover-check.md).


## Faktisk evidens

Sluttkontroll 2026-09-07: 196/196 enhetstester, 64/64 nettlesertester, syntakskontroll av 19 JavaScript-filer og produksjonsbygg bestått. Alle tidligere tester består. Prosjektet har ingen egen lint/typekontroll. Seks nye skjermbilder ved 360/1280 px er inspisert av testagenten. Studenten har senere meldt «Jeg har gjort det» til den korte eksempelflyten og sendt to skjermbilder. Dette registreres som delvis manuell observasjon; hele kontrollisten, lagring, tastatur og faktiske leverings-/angrehandlinger er ikke dermed særskilt bekreftet. Se [evidensen](../../implementation-artifacts/study-actions-evidence.md). Ingen nye automatiserte tester er kjørt ved denne statusoppdateringen. Månedsutprøving er fortsatt **Ikke startet** med tomme datoer.
