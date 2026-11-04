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

### Åpne punkter

- Personlig sluttlesing og faktisk innlevering er ikke bekreftet. Frist, kanal og obligatorisk format må fortsatt knyttes til emnets offisielle beskjed; se [issues](issues.md#vurderingskilder-som-ikke-er-identifisert).
- Historisk tilgangs-/personmateriale krever fortsatt repo-/kildeeierens vurdering. Gyldighet er ikke prøvd, ingen tilbakekalling eller historikkomskriving er utført; se [historisk oppfølging](issues.md#personlig-sluttkontroll-og-historisk-eksponering).
- Dokumenterte V1-/kildegrenser, historisk F03 med manglende original, nettleserkvote og bundlevarsel består. De er ikke nye påviste feil fra denne prøven. Se [begrensningsoversikten](../studieplanlegger/README.md#kjente-begrensninger-ved-levering).

Ingen ny personlig test er bestilt eller nødvendig for å lukke den dokumenterte sjuscenarioprøven.
