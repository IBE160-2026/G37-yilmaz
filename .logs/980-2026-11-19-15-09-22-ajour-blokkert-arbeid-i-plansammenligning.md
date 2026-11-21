# Blokkert arbeid i plansammenligningen

## 2026-11-19 kl. 15:09 — GOplayer007

### Oppgave

Vis arbeid på blokkerte oppgaver i plansammenligningen. Bruk eksemplet med 60 gjenstående minutter og «Avventer veileder» i regresjonstesten.

### Plan

- Følg gjenstående arbeid fra [omplanleggingen](../studieplanlegger/src/replanning.js) gjennom [sammenligningen](../studieplanlegger/src/plan-comparison.js) til [visningen](../studieplanlegger/src/replanning-view.js).
- Kontroller dagens plan og begge utkastene med syntetiske oppgaver og tilgjengelighet.

### Resultat

- Alle tre alternativene viser 60 minutter som mangler, én oppgave som ikke får dekket arbeidet, og grunnen til at oppgaven venter. Reserverte økter opptar fortsatt tid, men regnes ikke som dekket arbeid for den blokkerte oppgaven. Ukjent arbeidsmengde vises som ukjent.
- [Enhetsprøvene](../studieplanlegger/tests/unit/integrated-workflow.test.js) dekker anslag, låst reservasjon og rekkefølge. [Nettleserprøven](../studieplanlegger/tests/e2e/integrated-workflow.spec.js) kontrollerer alle tre kortene og bekrefter at sammenligningen ikke skriver til lagringen.
- 2 767 enhetstester, tre nettlesertester og produksjonsbygget bestod. Dette svarer på faglærerens tilbakemelding om testbare kriterier og dokumentert kvalitetssikring innen V1.

### Åpne punkter

Ingen innenfor oppgaven.
