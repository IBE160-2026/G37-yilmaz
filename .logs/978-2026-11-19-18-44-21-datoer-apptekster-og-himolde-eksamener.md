# Datoer, apptekster og HiMolde-eksamener

## 2026-11-19 kl. 18:44 — GOplayer007

### Oppgave

Gjør leveringshistorikken etterprøvbar, rett appens veiledning om levering og planforslag, og bruk TPs publiseringsflagg også for eksamensrader med nøytrale titler.

### Plan

- Samordne innleveringsstatus og bevare daterte observasjoner, beslutninger og lenker.
- Prøve appflytene i isolert Chromium og kontrollere HiMolde-importen med syntetiske rader.

### Resultat

- [Planindeksen](../.docs/planning-artifacts/README.md#leveringsstatus) samler innleveringsstatusen og knytter klokkeslettet til Git-commiten som dokumenterte bekreftelsen. Løsningsguiden daterer briefrevisjonen og tilleggene til 16. oktober. Faglærerens arkitektureksempel har fått merking og lenke. [Aktivitetslisten](issues.md#fullførte-aktiviteter) skiller fullførte aktiviteter fra åpne punkter.
- Leveringsmeldingen er prøvd både før og etter en syntetisk frist. «Se planforslag» åpnet riktig oppgave fra oppgavekortet og fra tilbakemeldingen i Oversikt. De sju nye TP-regresjonene feilet før rettingen og bestod etterpå. Den opprinnelige testen bestod også. Ved gjenimport beholdes tidligere lagrede oppføringer som mangler fra en ufullstendig kilde. [Verifikasjonen](../studieplanlegger/VERIFICATION.md#apptekster-og-eksamensimport-fra-himolde--2026-11-19)
- 2 784 enhetstester, 25 målrettede Chromium-tester mot lokalt produksjonsbygg, selve bygget og Markdown-lenkekontrollen bestod. Bygget beholdt størrelsesvarselet. Oppfølgingen gjelder faglærerens punkter om sporbar planhistorikk, testbare kriterier og dokumentert kvalitetssikring innen V1. Det lokale tekstuttrekket av sensorveiledningens sju sider ga vurderingskontekst om sporbarhet og testbevis.
- Kode og dokumentasjon er lagret lokalt som `1d11ba9f99b264e49ef547779ec0b7e2ef30b68e` på `fix/ajour-dato-apptekst-tp`.

### Åpne punkter

Ingen nye innenfor oppgaven.


## 2026-11-19 kl. 18:50 — GOplayer007

### Oppgave

Publiser de lokale Ajour-commitene på GitHub.

### Plan

- Kontroller arbeidskopien og push arbeidsgrenen til `origin`.

### Resultat

- GitHub bekreftet at `origin/fix/ajour-dato-apptekst-tp` inneholdt rettingen og den opprinnelige sesjonsloggen ved `0cf2707aaf79c7fdb69e6b52ee5cd0992fdb1943`.

### Åpne punkter

Ingen nye innenfor oppgaven.
