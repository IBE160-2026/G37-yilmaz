# Ukeplan og publiseringskontroll

## 2026-11-19 kl. 19:25 — GOplayer007

### Oppgave

Rett ukeplanen ved «Mer enn 4 timer», samordne datoene i planindeksen og prosessrapporten, og klargjør hovednettsiden med HiMolde-rettingen.

### Plan

- Reproduser feilen med åtte arbeidstimer og én registrert studieøkt.
- Kontroller grenen før integrering. Etter publisering skal hovednettsiden, GitHub main, testresultatene og versjonsmarkøren vise samme commit.

### Resultat

- Ukeplanen fordeler den kjente minste arbeidsmengden. Kapasitetsoversikten tar med øktene som kan brukes, og plansammenligningen viser når gjenstående arbeid er usikkert. Endringene er dokumentert i kodecommitene `954baebeeec08f97ab6303f47fd3b1aff59f2408` og `caba4ee1bcf5f91302e2f4742c0eecec1295a758`.
- 2 790 enhetstester, produksjonsbygget og den målrettede Chromium-regresjonen bestod lokalt. Nettlesertesten beholdt økten kl. 08.00–08.30, viste ingen fjerning og kontrollerte kapasitetsoversikten etter godkjenning. [Datert verifikasjon](../studieplanlegger/VERIFICATION.md#ukeplan-med-åpent-arbeidsanslag--2026-11-19)
- Planindeksen daterer oppfølgingen 4. november og peker til prøvene 19. november. Prosessrapporten daterer briefrevisjonen og tilleggene til 16. oktober. Dette følger opp lærerens punkter om sporbarhet og testbare kriterier. [Planindeksen](../.docs/planning-artifacts/README.md) · [Prosessrapporten](../.docs/implementation-artifacts/development-process.md#feedback-alignment--2026-10-16)
- Dette er den lokale kontrollen før integrering. Kvalitets- og produksjonsprøvene spores mot commit i [GitHub Actions](https://github.com/IBE160-2026/G37-yilmaz/actions).

### Åpne punkter

Ingen nye produktpunkter innenfor oppgaven.
