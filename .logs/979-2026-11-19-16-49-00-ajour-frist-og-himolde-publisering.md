# Fristvisning og HiMolde-publisering

## 2026-11-19 kl. 16:49 — GOplayer007

### Oppgave

Rett frister som merkes forfalt for tidlig i Oversikt, håndhev TPs publiseringsflagg i HiMolde-JSON, tell studiepoeng én gang per emne og samordne leveringsstatusen på main.

### Plan

- Kontroller visningen rundt midnatt i Oslo og test HiMolde-importen med syntetiske oppføringer.
- Bruk prosjekteierens daterte bekreftelse som grunnlag for leveringsstatusen.

### Resultat

- Rettelsene er samlet i `82eccfa` på lokal `main`.
- [Oversikt](../studieplanlegger/src/daily-overview.js) behandler en datofrist som aktiv ut fristdagen i Oslo. [Nettlesertesten](../studieplanlegger/tests/e2e/deadline-followup.spec.js) kontrollerer formiddagen og begge sider av midnatt.
- [HiMolde-JSON](../studieplanlegger/server/providers/public-tp.js) henter semesterets publiseringsflagg på nytt ved kalenderimport, utelater eksamensoppføringer når dato eller klokkeslett er upublisert, og skjuler rom og fritekst når rom er upublisert. [TP-testene](../studieplanlegger/tests/unit/public-tp.test.js) dekker hvert flagg og en endring av flaggene mellom to importer. [Programtesten](../studieplanlegger/tests/unit/vortex-programs.test.js) bekrefter ett IBE160-emne og 15 studiepoeng etter en syntetisk radduplisering.
- [Leveringsstatus](../.docs/planning-artifacts/README.md#leveringsstatus) er samordnet med prosjekteierens bekreftelse.
- 2 777 enhetstester, 23 berørte nettlesertester mot produksjonsbygget og selve bygget bestod. Dette følger opp tilbakemeldingen om testbare kriterier og dokumentert kvalitetssikring innen avgrenset V1. Sensorvedlegget var ikke tilgjengelig i arbeidsområdet for ny gjennomlesing.

### Åpne punkter

Ingen innenfor oppgaven.
