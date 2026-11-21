# Fristvurdering og tekstregistrering

## 2026-11-21 kl. 12:25 — GOplayer007

### Oppgave

Samordne fristvurderingen i Oversikt og Ukeplan, vise årsvalg ved fristendring fra tekst og tolke desimaltimer nøyaktig.

### Plan

- Gjenskap avvikene med syntetiske data og legg regresjonstestene ved hver retting.
- Oppdater brukerveiledningen, testoversikten og prosessdokumentasjonen. Følg GitHub-kontrollene og Vercel-publiseringen.

### Resultat

- `b4d28b3` bruker samme planforslag i begge visningene. Regresjonene viser 10 minutter som mangler med pause, full dekning uten pause og uendret lagring.
- `e856d41` viser årsvalgene ved fristendring fra tekst. Rapport beholder 5. januar 2027 etter omlasting.
- `96157a3` gir 246 og 90 minutter for de gyldige desimaltimene og avviser det brøkdelsminuttet som ikke kan lagres.
- [Testoversikten](../studieplanlegger/VERIFICATION.md#fristvurdering-og-tekstregistrering-2026-11-21) dokumenterer 2 894 enhetstester, 45 fokuserte nettlesertester og bestått produksjonsbygg. [Prosessdokumentet](../.docs/implementation-artifacts/development-process.md#tidlig-eksempel-oppstart-med-en-eldre-sqlite-database-20-september-2026) lenker til den tidlige SQLite-rettingen og kontrollene av den.

### Åpne punkter

Ingen nye.
