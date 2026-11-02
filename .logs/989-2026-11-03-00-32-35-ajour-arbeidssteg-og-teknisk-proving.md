# Ajour: arbeidssteg og teknisk prøving

## 2026-11-03 kl. 00:32 — GOplayer007

### Oppgave

Avklare den første tekniske rapportens stegkoblingsfunn, undersøke den faktiske Start-flyten og rette påviste feil innen eksisterende V1. Bevare historiske observasjoner og skille teknisk Codex-prøving fra prosjekteierens egenutprøving og R-07.

### Plan

- Kontrollere den opprinnelige rapportens valgte mål mot UI-observasjoner og lagrede data; prøve oppgaveplanlegging og navngitt Start hver for seg.
- Rette eksplisitt stegidentitet og gjenstående oppgaveanslag, med kontroll av historiske kopier, Angre, SQLite og sikkerhetskopiens personvernfiltrering.
- Gjennomføre uavhengig kode-/dokumentkontroll, regresjoner og faktisk Vercel-forhåndsvisning. Føre den separate sjuscenarioprøven først etter faktisk utførelse.
- Samordne [prøveplan](../.docs/planning-artifacts/USER-TRIAL-PLAN.md), [teknisk rapport](../.docs/implementation-artifacts/work-step-identity-2026-11-02.md), krav, arkitektur og [verifikasjon](../studieplanlegger/VERIFICATION.md), med bevarte eldre resultater.

### Resultat

Kodecommit `a929c412341a38e786a68b0740f7b80c402a8614` inngår i [PR #19](https://github.com/IBE160-2026/G37-yilmaz/pull/19). PR-en er integrert og den første produksjonspubliseringen er etterkontrollert som beskrevet nedenfor. Dette er en datert teknisk kontroll; loggen endrer ikke prosjekteierens tidligere personlige observasjoner.

Den første Codex-prøven mot `285dfac8e8513ce969da50017531622f40f15a7f`, 2. november kl. 22:00:50–22:40:12 Europe/Oslo, brukte oppgaveplanlegging i scenario 2 og avsluttet denne oppgaveøkten i scenario 3. Oppgave-/øktkoblingen var bevart. Kravet om en ekstra stegkobling i denne flyten var en for sterk testantakelse; rapporten beviste ikke tap av et valgt steg. Originalrapport, daterte resultater og kildeutdrag beholdes. Avklaringen gir ingen beståttstatus til en uprøvd stegflyt.

En separat produksjonsreproduksjon viste den reelle feilen: Start presenterte et navngitt steg, men utfallet mistet entydig stegidentitet. «Trenger mer tid», faktisk 0 minutter og nytt eksakt anslag 75 ble lagret med fortsatt 60 gjenstående. Dette var en kort simulert start, ikke dokumentert studiearbeid i 30 minutter.

Rettingen fører det presenterte stegets stabile `stepId` fra Start til utfall og arbeidslogg. Oppgavereservasjoner forblir på oppgavenivå. Faktisk tid og nytt oppgaveanslag lagres separat; stegfullføring, oppgavefullføring og levering er forskjellige handlinger. Loggkoblingen valideres mot `taskSnapshot`, og `taskCompleted` skiller fullføringsomfang ved gjentatt lagring også når resten er null. Eldre logger får ingen gjettede koblinger. Backup bevarer eksplisitte og avledede legacy-ID-er ved anonymisering, også med kollisjoner og historikk; eventuell materialisering av eldre steg skjer bare i eksportkopien.

Faktisk utførte sluttkontroller på kodekandidaten:

- Enhetstester: **2652/2652 i 150 filer**; faktisk lagring og ny åpning av SQLite inngår.
- Bygd app i Chromium: **153/153**, uten hoppede tester. Sju målrettede steg-/oppgaveflyter inngår.
- Isolert Node-/SQLite-nettleserkjøring: **14/14**.
- Releasekontroller: **145/145 i fem filer**, produksjonsbygg bestått. Bundle **961,13 kB / 293,89 kB gzip**; eksisterende størrelsesvarsel består.
- Undervisningsfixturer: **141/141**. Separat faktisk kildekontroll: **5/5** navngitte HiMolde-/NTNU-oppslag; ingen generell kildegaranti.
- Uavhengig etterkontroll: **18/18 legacy-/aliasvarianter og 3/3 eksplisitte ID-varianter**, inkludert eksport, gjenoppretting, Angre og papirkurv. Kildedata ble bevart, og manglende historiske stegkoblinger forble manglende.
- Faktisk Vercel-forhåndsvisning: UI-prøve kl. **23:28:55–23:29:05** i to tomme kontekster, med navngitt steg, 0 faktiske/75 gjenstående minutter, oppgaveplanlegging, eksport/gjenoppretting og omlasting. `/release.json` viste kodekandidaten før og etter. **7/7** målrettede nettleserregresjoner bestod også på forhåndsvisningen; disse brukte testfixturer og kontrollert testtid.

En mellomkjøring hadde 142 bestått, én feil og ti ikke kjørt etter HTTP 404 på en parserfil mens et samtidig lokalt bygg endret `dist`. Den avsluttende 153-prøvekjøringen brukte uendret bygg og bestod. Dette testoppsettavbruddet beholdes i rapporten; appkode og testkrav ble ikke svekket.

Den separate sjuscenarioprøven bestod **20 delkontroller** kl. **23:21:23–23:57:25 Europe/Oslo** 2. november, med dokumenterte dato-/UI-tilpasninger. Økten gikk faktisk **23:27–23:57**, og simulert utfall 30 faktiske/75 gjenstående ble lagret **23:57:09.891**. Uavhengige scenario 6-kontroller og en tredje syntetisk Start-oppgave ble prøvd under ventingen. Etter virkelig slutt ble arbeidsutfall, omplanlegging/Angre, separat steg-/oppgave-/leveringsfullføring, kalender/historikk og gjenoppretting prøvd. Data var identiske etter omlasting i begge nye kontekster; navneendring og omrekkefølge endret ikke arbeidsloggens stegidentitet eller historiske oppgavekopi. Nettleseren ble lukket kl. 23:57:27. Ingen klokkeendring eller direkte skriving til applagring ble brukt. Lokal `release.commit=null`; prøven identifiseres med `index-DiSpRgob.js` og SHA-256 i den tekniske rapporten, ikke en påstått publisert commit.

Dokumentasjon og kuraterte syntetiske bevis ble committet i `8669fc41c22584c5ce17125e3b385c1ce31b5924`. Samme app bestod UI-etterkontroll på faktisk Vercel-forhåndsvisning 3. november kl. 00:03:00–00:03:06 med denne eksakte SHA-en før og etter. Push-CI avdekket én eksisterende tidsavhengig ICS-test: 2651 bestått, én feil, bare forskjellig `DTSTAMP` ved et sekundskifte. Testrettingen `2496b796525ed1b7c875d87addc3c761b2259259` gir begge eksportkall samme eksplisitte tidspunkt og bevarer alle assertions. De to relevante testfilene bestod 26/26; appens tidsoppførsel og den reelle sjuscenarioprøven ble ikke endret. Hoppet deploykontroll og feilet kjøring er bevart som slike i rapporten.

PR #19 ble integrert 3. november kl. 00:19:51 Europe/Oslo som main-commit `b60455b808d3e3a3c92cf52fe8671db3e9c0d67a`, etter grønne push-/PR-kontroller og deploykontroll på siste kandidat `2496b79`. Main bestod nye 2652 enhetstester, 153 nettleserprøver, 14 SQLite-prøver og produksjonsbygg; Vercel kjørte 145 releasekontroller og rapporterte Ready i eksisterende prosjekt `ajour`. Produksjonens `/release.json` var lik main før og etter UI-prøven kl. **00:26:45–00:26:59**. To nye tomme kontekster bevarte kjent stegkobling, separate 0/75 minutter, tre framtidige oppgaveøkter uten gjettet stegkobling og alle data etter UI-gjenoppretting og omlasting. Den publiserte appfilen var byteidentisk med sjuscenariokandidaten. Den etterfølgende [produksjonskontrollen](https://github.com/IBE160-2026/G37-yilmaz/actions/runs/41545400372) bestod **60/60 runtimeprøver og 6/6 avgrensede faktiske kildeprøver**. [Rapportens daterte produksjonsoppføring](../.docs/implementation-artifacts/work-step-identity-2026-11-02.md#produksjon-etter-integrering--2026-11-03) inneholder syntetiske bevis. Senere dokumentcommiter er ikke denne kontrollerte main-SHA-en og må få separat sluttkontroll; denne loggen påstår ikke et resultat for en ennå ukjent commit.

Dette er Codex-utførte tekniske kontroller med syntetiske brukerdata og særskilt oppgitte offentlige kildeoppslag. De er ikke prosjekteierens personlige observasjoner og oppfyller ikke automatisk R-07. Historiske beståtte enkeltprøver, SC-07/1200–30, Outlook-resultatet og dokumenterte dekningsgrenser beholdes. Ingen generell studentnytte eller formell innlevering er bekreftet gjennom denne rettingen.

### Åpne punkter

- Eksisterende åpne punkter i [issues.md](issues.md), inkludert F03/F05, kilde-/lagringsgrenser, bundlevarsel, personlig sluttkontroll, innlevering og historisk eksponering, beholdes. Denne rettingen lukker dem ikke.
