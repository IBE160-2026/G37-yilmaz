# Tilbakemelding på PRD

| | |
|---|---|
| **Gruppe** | G37 – G37-yilmaz |
| **PRD vurdert** | `.docs/planning-artifacts/PRD.md` (status: final, sist endret 2026-11-04, commit e81fbd5) |
| **Dato** | 2026-11-12 |
| **Type** | Formativ tilbakemelding, ikke karakter |

## 1. Samlet inntrykk

PRD-en har et tydelig produktløfte, en låst V1 og uvanlig ærlig skille mellom det dere har bygget og det dere ikke har dokumentert (studentnytte, nasjonal dekning). Risikoen er at den har blitt et dokument som både skal være krav, endringslogg og evidensrapport. Da blir det vanskelig for UX, arkitektur og stories å hente ut hva produktet skal gjøre, og hvordan hvert krav kontrolleres.

## 2. Dette fungerer godt

- **Ærlig avgrensning.** § «V1-avgrensning» navngir import for «HiMolde IT 2026–27 og NTNU emneutvalg» (ARK1001 og EXPH0100) og sier at det «ikke loves komplett NTNU-program». Nasjonal dekning er flyttet til visjon, slik briefen-tilbakemeldingen ba om.
- **Skiller det som er påvist fra det som er antatt.** Tabellen «Prioriterte nyttehypoteser» sier at «Planleggingshjelpen sparer mer arbeid enn registreringen krever» er «Uavklart», og hva som skjer hvis hypotesen svikter. Forskningsseksjonen sier rett ut at det ikke finnes intervjuer.
- **Krav med målbare grenser flere steder.** R-01 («lagres med bare tittel, også uten emne»), «30 minutters arbeid nå» av «1200 minutter gjenstående», sikkerhetskopi over «20 000 000 byte» avvises og «30 nyeste Angre-oppføringene» kan gjøres direkte om til testtilfeller. Krav-IDene (R-/Q-) er stabile og sporet til stories og SC.

## 3. Oversikt per dimensjon

| Dimensjon | Vurdering | Kort begrunnelse |
|---|---|---|
| Beslutningsklarhet | god | Valg og avgrensninger er synlige (egenutprøving i stedet for rekruttering, Vercel-utvidelsen), men «Reelle åpne spørsmål» handler mest om sluttgjennomlesing, ikke produktvalg. |
| Substans | god | Innholdet er konkret og eget, ikke generisk. Seksjonene om presiseringer og historikk fyller mye uten å styre produktet. |
| Strategisk sammenheng | god | Tesen (oppgave → økt → utfall → justering, uten falsk framgang) er klar, men skjult bak historikk og unntak. |
| Testbarhet | god | Mange krav har sjekkbare grenser, men flere R-rader samler 5–8 utfall i ett avsnitt uten nummerering. |
| Scope og avgrensning | sterk | V1 er låst, utenfor-listen er eksplisitt og dato for utvidelser er oppgitt. |
| Brukbarhet for neste fase | svak | Ingen glossar, ingen brukerreiser, ingen suksessmål i PRD-en selv, og sentralt innhold ligger spredt i lenker. |
| Formtilpasning | svak | Et forbrukerprodukt med én enkelt-linje-reise og en PRD som leses som en revisjonslogg. |

## 4. Viktigste forbedringer

### 4.1 Hovedreisen er én linje, ikke en brukerreise
- **Alvorlighet:** høy
- **Hvor:** «Hva vi skal lage…»: «Hovedreisen er **oppgave → valgfritt arbeidssteg → godkjent studieøkt → utfall → justering**». «Hvem løsningen er for…»: «en **hypotetisk HiMolde-student** med IBE110, IBE430, IBE160 og deltidsjobb».
- **Problem og hvorfor det betyr noe:** Personaen er god, men er ikke brukt i noen scene. UX trenger rekkefølge, skjermer og hva brukeren ser når verdien leveres. Stories trenger å vite hvilken reise hvert krav tilhører.
- **Forslag:** Skriv 3–4 nummererte reiser (UJ-1…) med navngitt hovedperson, f.eks.: «**UJ-2. Mina rekalkulerer etter en tapt økt.** Mina (HiMolde, IBE110/IBE430/IBE160, jobber tirsdag og torsdag) registrerer 20 av 60 planlagte minutter. Appen foreslår ny økt torsdag, viser hva som flyttes og ber om godkjenning. Hun trykker Angre og ser at planen er som før.» Henvis fra kravene («realiserer UJ-2»).

### 4.2 PRD-en blander krav, historikk og evidens
- **Alvorlighet:** høy
- **Hvor:** «Rekonstruert 2026-10-16, revidert 2026-11-04», «Presisering … 2026-11-02», «Historisk dokumentasjonsstatus», revisjonstabellen med 13 rader, «R-07 er dermed oppfylt innen dokumentert prøveomfang».
- **Problem og hvorfor det betyr noe:** En leser som vil vite hva R-03 krever, må lese datert presiseringstekst om andre ting enn kravet. Teststatus (hva som er bestått) endrer seg og hører til verifikasjon og prøveplan, ikke kravdokumentet. Det gjør PRD-en ca. 3 200 ord og tung å bruke som kilde.
- **Forslag:** Behold PRD-en som «slik er kravene nå», uten datoerte presiseringer. Flytt revisjonshistorikk og R-07-status til README/USER-TRIAL-PLAN og la PRD-en peke dit med én setning. Skriv R-03 som tre nummererte krav (neste handling, kapasitet, omplanlegging), hvert med egne testbare konsekvenser.

### 4.3 Krav med mange utfall i én celle
- **Alvorlighet:** medium
- **Hvor:** R-03, R-05, R-06 og «Videreførte presiseringer» (f.eks. Q-01 med «1440/900/390 px, 200 % tekst … 4,5:1 kontrast»).
- **Problem og hvorfor det betyr noe:** Tester og stories må plukke ut hvert utfall selv. Det er også blandet inn teknologi (Vercel, Docker, Node/SQLite, «AD-14 og AD-15») som hører til arkitekturen.
- **Forslag:** Bryt ned etter malen «Aktør kan … **Konsekvenser (testbare):**». Eksempel for R-05: «(1) Forhåndsvisning endrer ingen lagrede økter. (2) Godkjenning med endret grunnlag avvises uten delvis lagring. (3) Angre gjenoppretter hele endringen i én handling. (4) Angre mot endret grunnlag gir avvisning og beholder dagens plan.»

### 4.4 Suksesskriterier og åpne spørsmål ligger utenfor PRD-en
- **Alvorlighet:** medium
- **Hvor:** Kravtabellens kolonne «Brief / story» (SC-01…SC-07). Selve SC-ene står i briefen. «Reelle åpne spørsmål…»: «Avklares … ved personlig sluttgjennomlesing».
- **Problem og hvorfor det betyr noe:** PRD-en sier ikke selv hva som er suksess eller hva som ikke skal optimaliseres. Det er få åpne spørsmål om produktet; de fire radene handler om dokumentasjon og innlevering.
- **Forslag:** Gjengi SC-ene som SM-1…SM-n i PRD-en og legg til minst ett motmål, f.eks. «SM-C1: antall registreringer som kreves før første forslag, bør ikke øke» (motvekt til forslagskvalitet). Hypotesene kan få en «signal»-kolonne: hva ville vist at de holder.

### 4.5 Mangler glossar og eksplisitt KI-/personvernlinje
- **Alvorlighet:** medium
- **Hvor:** Hele dokumentet. Begrepene «økt», «studieøkt», «startøkt», «arbeidsvindu», «tilgjengelig tid», «betinget tilgjengelighet» og «oppgavenært forslag» brukes i ulike former.
- **Problem og hvorfor det betyr noe:** Arkitektur og stories trenger ett navn per entitet (Oppgave, Arbeidssteg, Studieøkt, Utfall, Arbeidsvindu), ellers får kode og tester ulike navn. Dere har riktig valgt regelbasert logikk uten generativ KI, men det står bare under «Framtidige ideer».
- **Forslag:** Lag et glossar på 8–12 termer, f.eks. «**Studieøkt** — en godkjent, tidfestet arbeidsperiode knyttet til én oppgave, valgfritt til ett arbeidssteg. Kan angres.» Legg til én setning i Q-02: «Appen bruker ingen språkmodell; forslag er regelbaserte og kan reproduseres med samme data.»

## 5. Mekaniske funn

- R-01–R-08 og Q-01–Q-03 er sammenhengende, og S-/SC-henvisningene løser seg mot EPICS-CURRENT.md og briefen. Lenkene til underdokumenter fungerer.
- Ingen FR-/UJ-/SM-ID-er som i malen; dere bruker R-/Q- og SC. Det er greit hvis dere forklarer det i første avsnitt.
- Antakelser står som prosa («Antakelser om behov og nytte»), ikke merket og samlet. Samle dem i en liste.
- Tittel i frontmatter («PRD: Ajour») og overskrift («PRD: avgrenset Ajour-leveranse») avviker.

## 6. Før dere går videre

**Må avklares nå (før UX, arkitektur, epics):**
- Hvem er brukeren i hver hovedreise (4.1), og hvilke begreper er de samme som i koden (4.5)?
- Hvilke deler av R-03/R-05/R-06 er krav, og hvilke er teknologivalg som skal inn i arkitekturen?

**Kan vente:** nyttehypotesene (krever brukerundersøkelse, som dere har avgrenset), og spørsmålet om flere kilder.

**Oppfølging av briefen-tilbakemeldingen: delvis.** Nasjonal dekning er gjort til visjon, persona og alternativer (Google Calendar, Canvas, To Do) er på plass, og kravene er knyttet til tester. Tekniske detaljer er fortsatt delvis i PRD-en (4.3), og SC-ene ligger ennå i briefen (4.4).

## 7. Refleksjonsspørsmål

1. PRD-en sier selv at den er «rekonstruert» etter koden. Hvilke krav ville dere skrevet annerledes om PRD-en hadde kommet før koden, og hva sjekket dere mot koden for å se at KI-en ikke beskrev noe som ikke finnes?
2. Revisjonstabellen har 13 rader. Hvilke av presiseringene kom fra at dere selv oppdaget et hull, og hvilke fra at KI-en foreslo dem? Hvordan bestemte dere hva som skulle bli et krav?

_Vurdert mot kvalitetsrubrikken i bmad-prd. Dette er veiledning, ikke sensur._
