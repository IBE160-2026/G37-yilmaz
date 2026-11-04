# Importrekkefølge og auditoppfølging

## 2026-11-04 kl. 12:28 — Codex

### Oppgave
Prosjekteieren ba om å følge opp den vedlagte auditrapporten og gjøre GitHub og nettsiden ferdige før personlig sluttlesing. Arbeidet retter konkrete kodefeil og beholder synlige grenser der administrasjon, kildeeier eller formelt kursgrunnlag mangler.

### Plan
- Følge eksisterende V1 og lærerens tilbakemelding om testbarhet, sporbarhet og kontroll av KI-assistert kode.
- Rette de to importkappløpene, legge til avgrensede regresjoner og kontrollere dokumenter, avhengigheter og publisering.
- Bruke [auditoppfølgingen](../.docs/implementation-artifacts/import-sequencing-audit-2026-11-04.md) og [PR #24](https://github.com/IBE160-2026/G37-yilmaz/pull/24) som samlede bevisinnganger.

### Resultat
Kodecommit `236a37e0f9be8fe78c65ea0485411b6b28f1bd88` retter filrekkefølge i arbeidssteg- og backupdialogene. Den omfatter 15 Chromium-regresjoner, fem CSP-enhetstester, fire Firefox-/WebKit-smokeprøver, eksplisitt npm-audit, Dependabot og samordnet veiledning. Kodeendringene er gjennomgått uavhengig. Lokal Node 24.22.1-kontroll bestod 2669 tester i 152 filer og produksjonsbygg; audit rapporterte null kjente sårbarheter. Bundlevarselet består: 961,68 kB / 294,18 kB gzip.

54 Markdown-filer, 943 relative lenker og 243 ankere ble kontrollert uten feil før publisering; ti aktive offentlige lenker svarte HTTP 200. 344 dokument-/fixturfiler, alle 11 utfoldede ICS-filer og dokumentmetadata ble skannet uten nye uavklarte funn; dette beviser ikke ren historikk. 460 JavaScript-filer bestod syntakskontroll.

Første GitHub-kandidat bestod audit/enhet/bygg og 169 Chromium-prøver. Én ny prøve ble stoppet av en åpen oppgavemeny før importkontrollen; testens vanlige menybetjening er rettet uten å endre appen. Den første feilen beholdes i rapporten. Endelige kvalitets-, forhåndsvisnings- og produksjonsresultater samt SHA-er registreres samlet i PR #24; lokale nettleserresultater påstås ikke når nedlastingen feilet.

Begge offentlige Ajour-adresser svarte HTTP 200 uten omdirigering. Hovedadressen beholdes; eksisterende profil-/adresselokale data er ikke berørt. Kode-/GitHub-arbeidet endrer ingen ekte brukerdata og utvider ikke V1.

### Åpne punkter
- GitHub-administrator må beskytte `main` og korrigere About-lenken. Tilkoblingen mangler administrasjon; nettleserinnlogging ble ikke fullført.
- Historisk tilgangsmateriale krever fortsatt repo-/kildeeiers vurdering og eventuell tilbakekalling; ingen verdier ble prøvd eller historikk omskrevet.
- Vercel rate-/samtidighets- og forbruksgrenser er ikke verifisert; ingen betalt tjeneste eller nytt prosjekt er bestilt.
- Offisiell frist, kanal, filformat og øvrig manglende vurderingsgrunnlag må verifiseres. Personlig sluttlesing og faktisk innlevering er ikke utført av Codex.
- F03/F05, kilde-/lagringsgrenser og bundlevarsel beholder avgrensningene i [åpne punkter](issues.md). Ingen nye manuelle prøver er bestilt.
