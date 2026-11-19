# Kapasitet, ukjent anslag og historikkstatus i Ajour

## 2026-11-19 kl. 14:39 — GOplayer007

### Oppgave

Samordne resultatet i Oversikt og Ukeplan når en oppgave krever sammenhengende tid. Lagre «Vet ikke» ved oppgaveredigering og kontroller resultatet etter omlasting. Oppdater historikkstatusen i planleggingsindeksen og punktlisten i samsvar med oppryddingsrapporten.

### Plan

- Bruk kapasitetsberegningen fra Ukeplan i Oversikt og prøv både separate vinduer og én sammenhengende økt.
- Kontroller at vanlig redigering beholder intervallet og at et uttrykkelig valg av «Vet ikke» fjerner intervallet.
- Oppdater gjeldende statusformuleringer mot [oppryddingsrapporten](../.docs/implementation-artifacts/history-cleanup-2026-11-09.md) og bevar daterte kontroller.

### Resultat

- [Dagsstatusen](../studieplanlegger/src/daily-guidance.js) viser samme beregnede underskudd som Ukeplan. [Nettlesertestene](../studieplanlegger/tests/e2e/daily-guidance-ux.spec.js) dekker to separate halvtimer og en sammenhengende time.
- [Oppgaveredigeringen](../studieplanlegger/src/task-form.js) viser det lagrede intervallet frem til brukeren endrer feltet. [Regresjonstesten](../studieplanlegger/tests/e2e/edit-delete.spec.js) bekrefter at «Vet ikke» lagres og vises etter omlasting.
- [Planleggingsindeksen](../.docs/planning-artifacts/README.md) og [punktlisten](issues.md#personlig-sluttkontroll-og-historisk-eksponering) viser at oppfølgingen av funn 1–4 er avsluttet. Kontrollen 4. november er bevart.
- 2 761 enhetstester, 21 nettlesertester og produksjonsbygget bestod. Den isolerte SQLite-prøven med 14 tester bestod på første versjon av rettelsen. Dette svarer på faglærerens tilbakemelding om testbare kriterier og dokumentert kvalitetssikring innen V1.

### Åpne punkter

Ingen innenfor oppgaven.
