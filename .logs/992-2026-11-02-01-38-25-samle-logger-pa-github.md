# Samle logger på GitHub

## 2026-11-02 kl. 01:38 — GOplayer007

### Oppgave
Samle loggene direkte i `.logs/`, også i GitHub-repoets hovedgren, etter brukerens uttrykkelige ønske.

### Plan
- Ta utgangspunkt i siste `origin/main` (`ded625e`) og bevare alle sju eksisterende loggfiler.
- Flytte filene, justere lenker og prosjektinstrukser, kontrollere endringen og publisere via pull request.

### Resultat
Commit `78060c7` flytter alle sju filer direkte til `.logs/`. Relative lenker i loggene og referanser i `studieplanlegger/VERIFICATION.md` er oppdatert. `AGENTS.md` og `CLAUDE.md` overstyrer sesjonslogg-skillens brukermapper slik at framtidige logger også samles direkte i `.logs/`. Eksisterende åpne punkter er bevart.

Kontroll 2026-11-02: alle sju filer er bevart bortsett fra nødvendige lenkejusteringer, og 89 lokale lenkemål finnes. Sammenlignende mønstersøk i 332 dokumentasjons-/fixturefiler, med utfoldede ICS-linjer, fant ingen nye personvern-/metadataflagg. Alle 301 fixturer er uendret. Full enhetstestsuite: 2529/2529 bestått i 147 filer. Fokuserte personvern-/stresstester: 340/340 bestått. Produksjonsbygg: bestått, 91 moduler, eksisterende størrelsesvarsel. `git diff --cached --check` bestått for endringscommiten.

Endringen støtter faglærerens tilbakemelding om ryddighet og sporbarhet. V1 og funksjonalitet er uendret. Sensorvedlegget er ikke kontrollert på nytt for denne mappeflyttingen. Publiseringsstatus og GitHub-kontroller verifiseres etter denne loggcommiten i pull requesten.

### Åpne punkter
Ingen nye. Eksisterende punkter i `issues.md` er bevart.
