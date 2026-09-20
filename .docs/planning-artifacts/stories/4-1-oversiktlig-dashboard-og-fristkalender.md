---
source: ../epics.md
story: '4.1'
status: review
created: 2026-09-07
---

### Story 4.1: Oversiktlig dashboard og fristkalender

Som student vil jeg få en rolig, tydelig oversikt over studiearbeidet og se frister i en kalender, slik at jeg lettere finner en konkret handling og holder oversikt over innleveringene.

**Krav:** FR-1–10, NFR-1–3, AD-1–7. **Avhengigheter:** den teknisk ferdige løsningen fra 3.1; brukerens nye bestilling autoriserer videre arbeid uten å forutsette full tidligere menneskelig godkjenning. **Status:** Teknisk ferdig og verifisert; ny menneskelig gjennomgang er ikke meldt, derfor review.

**Acceptance Criteria:**

1. **Gitt** lagrede oppgaver eller en tom liste, **når** nettsiden åpnes, **så** vises et oversiktlig dashboard med varm bakgrunn, grønn identitet, tydelig hierarki og faktiske beregnede tall. **Og** ingen oppdiktede oppgaver, statistikker, aktivitetsserier eller fremdriftsdata vises. Emner får stabile visuelle farger, men navn/status er forståelige uten farge.
2. **Gitt** «Hva kan jeg gjøre nå?», **når** jeg velger 15, 30, 45 eller 60 minutter eller oppgir en egendefinert tid, **så** brukes den eksisterende regelen: aktivt stegestimat før hovedestimat, bare uferdig arbeid som passer, nærmeste frist og stabil opprettingsrekkefølge. **Og** ett hovedforslag med konkret handling, tydelig stegestimat og faktisk begrunnelse skilles visuelt fra alternativer og fristoversikt. Tomtilstandene beholder nyttige veier videre.
3. **Gitt** kalenderen, **når** jeg viser en måned, **så** starter uken mandag og riktig lokal måned/år, ukedager, dagens dato og valgt dato fremgår. **Og** forrige/neste måned og «I dag» virker over måneds-/årsskifter uten å endre oppgaver, frister eller lagring.
4. **Gitt** frister på en dato, **når** datoen velges, **så** vises dagens oppgaver i fristrekkefølge med tittel, emne, lokalt klokkeslett og korrekt status, og jeg kan åpne oppgaven for redigering. **Og** flere oppgaver på samme dag, tom dag, gamle frister, «Klar til levering», levert og fullført håndteres. Kalenderen bruker samme oppgaver som øvrige visninger og påvirkes ikke av tidsfilteret.
5. **Gitt** en smal mobilskjerm, **når** kalenderen åpnes, **så** er agenda den innledende visningen, med mulighet til å bytte til månedskalender. **Og** både mobil og større skjerm kan brukes uten horisontal sideskrolling; innhold og nødvendige handlinger forblir tilgjengelige.
6. **Gitt** oppretting, redigering eller en fristvisning, **når** dato og klokkeslett skrives eller leses, **så** brukes norsk datofremstilling og 24-timersklokke uten AM/PM. **Og** skjemaet har dato og et uttrykkelig `HH:mm`-felt, mens lagret `deadlineLocal` fortsatt er `YYYY-MM-DDTHH:mm`; ugyldig/manglende tid og ikke-eksisterende lokal tid avvises uten å endre lagret oppgave.
7. **Gitt** tastaturbruk, **når** jeg navigerer hurtigvalg, kalender/datoer, oppgavemenyer, skjemaer og status-/steghandlinger, **så** har kontrollene forståelige navn, synlig fokus og korrekt valgt/åpen tilstand. **Og** Escape lukker oppgavemenyen, fokus vender relevant tilbake, og klokkeoppdatering eller mislykket lagring mister ikke utkast/fokus. Tilbakemeldinger er korte, forståelige og tilgjengelige.
8. **Gitt** eldre og nyere lagrede oppgaver, **når** siden åpnes, redigeres og gjenåpnes etter redesignet, **så** beholdes ID-er, rekkefølge, estimater, aktivt neste steg og separate ferdig-/levertstatuser. **Og** nøkkel/skjema 1, kandidatvalidering før én skriving, lesefeilsperre og bevart rådata/utkast ved feil gjelder fortsatt. Visnings-, kalender- og minuttvalg er avledet/midlertidig tilstand; ingen ny datamodell eller avhengighet innføres.
9. **Gitt** ferdig implementering, **når** kontroll og dokumentasjon fullføres, **så** registreres faktiske enhets-/nettlesertester, syntaks, bygg og eventuell manglende lint/typekontroll. **Og** kalendergrenser, samme dato/flere frister, statusvisning, 24-timersformat, hurtigvalg, skjema-/menyfokus, mobil og eksisterende regresjoner kontrolleres. Tidligere delvis menneskelig observasjon av 3.1 bevares som historikk, og ingen ny menneskelig godkjenning eller brukereffekt antas.

**Planlagt verifikasjon:** Eksisterende Vitest og Playwright utvides for ren lokal kalenderlogikk, norske datoer/24-timersformat, avledede status-/emnefarger og dashboardtall, kalendernavigasjon/valg/redigering, mobilagenda, hurtigvalg og tilgjengelige menyer. Gamle kontrollscenarioer tilpasses endret grensesnitt uten å miste atferdskrav. Faktiske resultater i [evidensen](../../implementation-artifacts/ui-calendar-evidence.md), kontrakt i [spesifikasjonen](../../implementation-artifacts/spec-ui-calendar.md) og ny menneskelig [prøveliste](../../implementation-artifacts/ui-calendar-handover-check.md).


## Faktisk evidens

Sluttkontroll 2026-09-07: 230/230 enhetstester, én full nettleserkjøring med 75/75 tester, syntakskontroll av 21 JavaScript-filer og produksjonsbygg bestått. Etter siste CSS-retting og supplert 45/60-/Escape-dekning besto 14/14 berørte nettlesertester; disse er et delsett av 75. Endelig bygg besto på 153 ms. Visuell kontroll omfatter stor skjerm, mobil, smalt skjema og lange titler/emnenavn, med 15 bevarte skjermbilder. Ingen egne lint-/typekontrollskript finnes. Se [evidensen](../../implementation-artifacts/ui-calendar-evidence.md). Ny fysisk studentgjennomgang er ikke registrert, og månedsutprøvingen er **Ikke startet** med tomme datoer.
