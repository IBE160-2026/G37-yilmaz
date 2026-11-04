# Egenutprøving og samordnet dokumentstatus

## 2026-11-04 kl. 09:50 — Codex (ChatGPT Work)

### Oppgave

Prosjekteieren ba om å innarbeide den fullførte egenutprøvingen i alle berørte dokumenter, rette gammel tekst og lenker og publisere gjennom GitHub til eksisterende Vercel-prosjekt. Reelle feil eller restpunkter skulle oppgis tydelig. Målet var at personlig sluttlesing skulle være den eneste gjenværende brukeraktiviteten; faktisk innlevering og historisk eksponering kan likevel ikke ferdigmeldes uten grunnlag.

### Plan

- Kontrollere innsendte syntetiske bevis, skille prosjekteierens handlinger fra teknisk etteranalyse og bevare tidligere forsøk med avvik.
- Samordne brief, PRD, stories, sporbarhet, prøveplan, arkitektur, README-er, løsningsguide, utviklingsprosess, VERIFICATION og issues uten å utvide V1.
- Kontrollere dokumentlenker, bevismetadata, personvernmønstre, full enhetssuite og produksjonsbygg før publisering; følge GitHub-kvalitet, Vercel og publiseringens egen kontroll.

Arbeidet følger opp [lærerfeedbacken 6. oktober](../tilbakemelding-product-brief.md), særlig sjekkbare kriterier, sporbar kvalitetssikring og synlig styring av KI-arbeid. AGENTS, lærerfeedback, brief og relevant plan-/kontekstgrunnlag er lest. Den tidligere identifiserte sju sider lange sensor-PDF-en var ikke tilgjengelig i denne runden. Tidligere dokumentert lesing beholdes som historikk; ingen nye formelle krav er utledet fra sammendraget.

### Resultat før publisering

[Eierens daterte prøverapport](../.docs/implementation-artifacts/owner-trial-2026-11-04.md) dokumenterer scenario 1–7 og navngitt Start som gjennomført og bestått 3.–4. november innen oppgitt prøveomfang. Rapporten skiller brukerbekreftede handlinger, synlige skjermbilder og Codex sin lesende filsammenligning. Første for tidlige utfallsregistrering og første gjenoppretting med ubekreftet isolasjon er bevart som metodeavvik; bare berørte deler ble fulgt opp.

Den endelige målprøven viser Chrome **Gjest**, tomme førverdier og gjenopprettet kalender. Prosjekteieren bekreftet omlasting og kontroll. Slutteksporten 4. november kl. **09:23:51.366 Europe/Oslo** har samme komplette `data` som kildekopien: to emner, tre oppgaver, én studieøkt, tre arbeidslogger, to arbeidsvinduer, ett opptatt tidsrom, 18 angreoppføringer og to papirkurvoppføringer. Det tidligere R-07-forbeholdet om separat målmiljø er lukket.

[Bevisoversikten](../.docs/implementation-artifacts/evidence/owner-trial-2026-11-04/comparison.json) inneholder SHA-256, tider, tellinger og 36 beståtte kontrolluttrykk fra ni eksporter. Alle ni bestod appens relasjonsvalidering. Dette er teknisk analyse av brukerens filer, ikke 36 nye manuelle prøver. Rå sikkerhetskopier, skjermbildefiler, chat og private mellomnotater er ikke publisert.

Gjeldende dokumenter bruker nå sluttstatusen 4. november. Gamle dekningsforbehold er tydelig datert som historikk, og gamle anker beholdes når aktuelle innganger får nye datoer. En arkitekturtekst som fortsatt kalte egenutprøvingen planlagt/ikke utført er rettet. Nettlenken er hovedinngang, mens lokal Node-/Docker-drift og SQLite fortsatt er dokumentert. Produktkrav, lærerfeedback, refleksjonsrapport, appkode og avhengigheter er uendret.

Lokale tekniske kontroller 4. november bestod:

- **2664/2664 enhetstester i 151 filer**, exit 0.
- **141/141 undervisningsfixturer i ti filer**, exit 0; dette utvalget overlapper enhetssuiten og er ikke nye live-oppslag.
- **Produksjonsbygg**, exit 0. Hovedbundle er 961,20 kB / 293,91 kB gzip; eksisterende størrelsesvarsel beholdes.
- JavaScript `index-DVKPiKe7.js` og CSS `index-9d3E6xgs.css` har samme byteantall og SHA-256 som den tidligere kontrollerte funksjonsleveransen. Dokumentarbeidet endrer ikke appfilene.
- Uavhengig gjennomgang av kravstatus, bevisrapport og dokumentdiff fant ingen vesentlig overdrivelse, kravutvanning eller ny funksjonsblokkering.

Den innledende mønsterkontrollen av 51 sporede Markdown-filer og 288 tekstfixturer, med 11 ICS-filer utfoldet før kontroll, fant ingen treff på de kontrollerte tilgangs-/personstipatternene. Dette er en avgrenset kontroll av dagens utvalg, ikke bevis på ren Git-historikk. Endelig lenke-, staged diff- og publiseringskontroll føres i oppfølgingen nedenfor.

### Publisering og etterkontroll — 2026-11-04 kl. 10:49

Dokumentasjonen ble publisert gjennom [PR #23](https://github.com/IBE160-2026/G37-yilmaz/pull/23). Commitrekken bestod av loggcommit `81e5b26a4e54c7f4181435f834cea7503edd4736` og dokumentcommit `b2359e49a09e0f4b089a23448213eb623f42e2a5`. Den siste commiten hadde samme Git-tre som den lokalt kontrollerte arbeidskopien og den integrerte main-versjonen **`9c55fd68bd9b4d33b01061aa60148c89d9237a2f`**.

- [PR-kvalitet](https://github.com/IBE160-2026/G37-yilmaz/actions/runs/41807195868), kandidatens push-kontroll og [main-kvalitet](https://github.com/IBE160-2026/G37-yilmaz/actions/runs/41808544888) bestod. De fullførte loggene bekrefter **2664 enhetstester i 151 filer, produksjonsbygg, 155 Chromium-prøver og 14 SQLite-/nettleserprøver**. Dette er faktiske nye CI-kjøringer; samme tester summeres ikke på tvers av kjøringene.
- [Forhåndsvisningens publiseringskontroll](https://github.com/IBE160-2026/G37-yilmaz/actions/runs/41808385203) bestod med **60 runtimeprøver og seks faktiske kildeprøver**, mot kandidatens eksakte deployment og SHA. Siste kildefase sluttet **kl. 10:38:25 Europe/Oslo**.
- [Produksjonens publiseringskontroll](https://github.com/IBE160-2026/G37-yilmaz/actions/runs/41809430923) bestod med **60 runtimeprøver og seks faktiske kildeprøver**, mot den integrerte main-versjonens eksakte deployment. Runtimefasen sluttet **kl. 10:47:22**, kildefasen **kl. 10:48:20 Europe/Oslo**.
- Vercel rapporterte vellykket publisering i det eksisterende prosjektet **ajour**. [Offentlig produksjon](https://ajour-sooty.vercel.app/) og [release.json](https://ajour-sooty.vercel.app/release.json) svarte HTTP 200. Kontrollen **kl. 10:43:59 Europe/Oslo** viste main-SHA-en ovenfor, samt byteidentiske appfiler mot lokalt bygg.
- Dokumentkontrollen før PR-en omfattet **53 Markdown-filer, 915 relative lenker og 240 ankerlenker**, uten feil eller lokale maskinstier. `git diff --cached --check` bestod, og alle 16 publiserte filer ble gjennomgått. Rå vedlegg og private mellomfiler er ikke med i Git-treet.

| Produksjonsfil | Byte | SHA-256 |
| --- | ---: | --- |
| `index-DVKPiKe7.js` | 961202 | `de14a17167ad815adb7535a9600aba3e5b6deba7b2e12eccd2b5df443ad0fbf3` |
| `index-9d3E6xgs.css` | 99759 | `91eaf8bd4f47f3cccd7af09a3043c451439ff952644185bab1434c20234d2d34` |

Den gamle [PR #3](https://github.com/IBE160-2026/G37-yilmaz/pull/3) ble gjennomgått og lukket uten merge **kl. 10:34:11 Europe/Oslo**. Produktløfte, driftsformer og sporbarhet er dekket av senere arbeid, og gammel R-07-status er foreldet. Dette betyr ikke at alle tekstforslag er integrert: frivillige måleforslag, foreslått nettlesermatrise og den daterte sesjonsloggen beholdes i PR-en og grenen. [Lukkekommentaren](https://github.com/IBE160-2026/G37-yilmaz/pull/3#issuecomment-6627531777) dokumenterer avgrensningen. Ingen gren eller Git-historikk ble slettet.

Denne oppfølgingen fører ferdige, daterte resultater og inngår i rene dokumentcommiter. Senere publisering av selve oppfølgingsteksten kan kontrolleres med [Actions](https://github.com/IBE160-2026/G37-yilmaz/actions) og produksjonens versjonsmarkør; den endrer ikke appfilene eller prøvegrunnlaget. Ingen sikkerhetsinnstilling eller kvalitetskontroll er slått av.

### Åpne punkter

- Personlig sluttlesing og faktisk innlevering er ikke bekreftet. Frist, kanal og obligatorisk format må fortsatt knyttes til emnets offisielle beskjed; se [issues](issues.md#vurderingskilder-som-ikke-er-identifisert).
- Historisk tilgangs-/personmateriale krever fortsatt repo-/kildeeierens vurdering. Gyldighet er ikke prøvd, ingen tilbakekalling eller historikkomskriving er utført; se [historisk oppfølging](issues.md#personlig-sluttkontroll-og-historisk-eksponering).
- Dokumenterte V1-/kildegrenser, historisk F03 med manglende original, nettleserkvote og bundlevarsel består. De er ikke nye påviste feil fra denne prøven. Se [begrensningsoversikten](../studieplanlegger/README.md#kjente-begrensninger-ved-levering).

Ingen ny personlig test er bestilt eller nødvendig for å lukke den dokumenterte sjuscenarioprøven.
