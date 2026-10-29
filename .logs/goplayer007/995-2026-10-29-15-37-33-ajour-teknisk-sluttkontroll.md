# Ajour teknisk sluttkontroll

## 2026-10-29 kl. 15:37 — GOplayer007

### Oppgave

Gjennomføre avgrenset teknisk sluttkontroll, rette dokumenterte mangler og fullføre kontrollert publisering. Oppdraget autoriserte branch, PR, commits, push, integrering og nødvendige CI-/prosjektinnstillinger. Design, dataavtaler, lokal SQLite og faktisk uutførte eieraktiviteter skulle bevares.

### Plan

- Videreføre [Vercel-arbeidet](997-2026-10-29-13-35-00-ajour-vercel.md), lese prosjektinstrukser, lærerfeedback og siste verifikasjon, og undersøke faktisk Git-/GitHub-/Vercel-status før tiltak.
- Fordele avgrenset implementasjon, sikkerhetskontroll og verifikasjon; bruke egen branch, låst testkopi og bare syntetiske data/profiler.
- Bevise negativ og positiv publiseringssperre, prøve faktisk preview, gjøre separat gjennomgang, integrere via PR og kontrollere produksjon og eksisterende syntetisk lagring.
- Oppdatere eksisterende [verifikasjon](../../studieplanlegger/VERIFICATION.md#teknisk-sluttkontroll-og-publiseringssperrer--2026-10-29), driftsbeskrivelse og sporbarhet. Den interne arbeidsspesifikasjonen og råartefaktene beholdes lokalt.

### Resultat

Utgangspunktet var ren `main` på `0c8bd730f5115edd22926277c0f5fd9630ca4f1a`. Nettleserlagring, backup, kilde-/DNS-/redirect-/størrelsesvern, tolv emnefarger og tema var allerede implementert. Kontoen har push, ikke admin; ingen organisasjonsregler er endret. Det eneste Hobby-prosjektet `ajour` i `ajour1` er gjenbrukt. Ingen betalt tjeneste, innlogging, database eller periodisk agentjobb er innført.

`ce6d410a47581ace22577b167a6f4257cb634f0d` la til låst CI, nødvendige Vercel-sjekker, automatisk etterkontroll med faktisk commitmarkør, syntetisk hel HiMolde-gjentakelse og avgrenset måleverktøy. FHS/Kristiania kunne eksponere fragmenter fra ugyldig JSON etter en vellykket første side; eksisterende feilsanitering er brukt med seks regresjonsprøver for parserfeil, forventede kildefeil og avbrudd. Ingen dataformat eller design er endret. `npm audit` fant null kjente sårbarheter; avhengighetene er ikke oppgradert.

Den låste kandidaten bestod **2411/2411 enhetstester i 136 filer**, **145/145 releasetester**, bygg, **55/55 bygde nettleserkontrakter** og **3/3 isolerte SQLite-prøver**. Gjennomgangen avdekket manglende ekstern SHA-kontroll og test mot utviklingsserver fremfor bygget; begge ble rettet med egne kontroller. To lesninger var uavhengige og kontekstfrie; verifikasjonslesningen gjenbrukte sikkerhetsimplementøren på grunn av agentgrensen. Ingen reelle funn stod uløst etter oppfølgingen.

Første Linux-CI avdekket et kappløp mellom native scroll-hendelse og tematestens før-snapshot. `f6b38b4c6c02ee15cc236b302e49e647897c783d` venter på faktisk lagret rulleposisjon, uten å fjerne assertions. **20/20** repetisjoner og separat lesegjennomgang bestod; ny push-/PR-CI ble grønn. Tidligere mellomfeil og omprøvinger står åpent i verifikasjonen.

Den bevisst feilende grenen `test/ajour-release-gate`, `cc8fae30de439efd339db72a15acaef572825e4e`, fikk akkurat én tilsiktet feil i [CI](https://github.com/IBE160-2026/G37-yilmaz/actions/runs/40889286979). Vercel bygget `dpl_AkU8pNJ2CuqLmjGcG3f3SqxETU5k`, men kvalitetssjekken fikk `failed` og **`aliasAssigned=false`**. Fungerende produksjon ble stående. Denne grenen er ikke integrert og skal aldri brukes som kandidat. Samme prosjektkrav gjelder preview og production. Den riktige `f6b38b4` fikk grønn sjekk, tildelt alias og automatisk etterkontroll **30/30 + 6/6**. Det hevdes ingen beskyttet main eller separat mergesperre.

Faktisk Vercel-preview av `ce6d410`, `dpl_6Bysx41z6LtPg6Zf6PKxq8pb5XWb`, bestod **36/36** nettprøver, **30/30 faktisk åpnede bilder** og **1/1** profil-/backup-/ICS-/gjenåpningsprøve. Live-utvalget ga først **5/6**, med `socket hang up` ved IBE430; avgrenset omprøving bestod **1/1** uten kodeendring. Hel HiMolde-programgjentakelse bestod med syntetiske kilder, stabile identiteter og bevarte valg/notater. Dette lukker det tekniske gjentakelsespunktet med uttrykkelig syntetisk avgrensning, ikke med påstand om hel live-gjentakelse eller studentutprøving.

Tre nye profiler per visning målte median klar UI til **377 ms desktop / 3943 ms emulert mobil**, og avgrenset import til **515 ms** på previewen. Mobil brukte 4× CPU-brems, 150 ms latens og 200 000 byte/s ned. Det lille utvalget beviser ingen ny kodeflaskehals; bundlevarselet består. README beskriver Hobby-grenser og enkel feilsøking uten private data i logger.

En isolert lokal øvelse bestod oppretting/gjenoppretting, kandidatbygg og tilbakekopiering av tidligere statiske filer, **1/1 i hver fase**, med eksakt bevart syntetisk lagring. Dette var ikke Vercel Instant Rollback eller full servertilbakerulling. SQLite-gjenoppretting er prøvd separat. Fungerende produksjon er ikke rullet tilbake. README skiller konkret Hobby-kodetilbakerulling fra brukerdata, backup og lokal SQLite.

[PR #4](https://github.com/IBE160-2026/G37-yilmaz/pull/4) ble integrert med vanlig merge til **`e77620ad596c0a09066ec3d24d3dd72034a8609e`**. Automatisk godkjenningskontroll avviste først merge på feil autorisasjonsgrunnlag; originaloppdragets uttrykkelige merge-/publiseringsautorisasjon og grønne sjekker ble kontrollert, og samme ordinære handling ble deretter godkjent. Ingen sperre ble omgått.

Produksjonsdeploy **`dpl_GjdHds8q1dpDzTRHJbzDtQcbXGoE`** ventet uten alias mens main-CI kjørte. Etter grønn sjekk ble produksjonsdomenet tildelt, og `/release.json` på [Ajour](https://ajour-sooty.vercel.app) bekreftet `e77620ad`. Hovedflyt/API/PDF bestod **19/19**. Samme syntetiske profil fra `0c8bd730` bestod **1/1**, med eksakt bevarte plan- og preferansenøkler etter oppdateringen. [Automatisk produksjonsetterkontroll](https://github.com/IBE160-2026/G37-yilmaz/actions/runs/40892608749) bestod også. GitHub, lokal testkopi og Vercel bygger hver for seg; identiske artefakter påstås ikke.

`e1a4ca9` samler dokumentert evidens i seks eksisterende dokumenter. Dokumentkontrollen bestod **36 dokumenter, 515 lokale lenker og 104 ankre**, og personvernkontrollen **324 dokument-/fixturefiler og 11 utfoldede ICS**, uten funn. Siste Vercel-tørrkontroll omfattet **188 filer**, uten private artefaktstier. Denne separate loggcommiten og dokumentoppfølgingen går gjennom samme PR-/kvalitets-/publiseringsløp. Siste deploys eksakte hash finnes i GitHub/Vercel og commitmarkøren; loggen kan ikke inneholde sin egen commit-hash.

Lærerens punkter om kvalitetssikring, sporbarhet, kontrollerbart KI-arbeid og kjørbarhet er fulgt opp. Det identifiserte sju-siders sensorvedlegget var ikke tilgjengelig i denne økten; ingen ny lesing eller nye krav er oppdiktet. Samtidig separat produktdokumentasjonsarbeid er bevart og ikke integrert på vegne av dette oppdraget.

### Åpne punkter

- Egenutprøving/SC-07 er fortsatt planlagt / ikke gjennomført. Prosjekteieren utfører selv de sju scenariene med syntetiske data.
- Personlig refleksjon og faktisk Outlook-prøve er fortsatt ikke gjennomført. Agentens tester fyller ikke disse aktivitetene.
- Eksisterende bundlevarsel og uidentifisert proposal/overordnet vurderingsveiledning beholdes som begrensninger i `issues.md`. V1 og kildeutvalget er uendret.
