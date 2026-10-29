# Verifisering av Ajour

## Separat KI-assistert mengdetesting — 2026-10-29

Prosjekteieren sendte HTML-rapporten «Ajour stresstest 2026-10-29» som tillegg etter første rettingscommit `618357b`. Rapporten er et separat KI-assistert testgrunnlag, ikke prosjekteierens egenutprøving eller nye kontroller utført her. Rårapporten og prøveprofilen publiseres ikke. Arbeidet fortsetter på samme branch og innen eksisterende importstøtte.

Rapportert omfang: 25 læresteder undersøkt, 21 programlister med til sammen 3525 rader og 45 emneforhåndsvisninger. 2278 kildeforekomster er verken unike hendelser eller lagrede hendelser. Bare NTNU-eksemplet ble faktisk lagret i institusjonsutvalget: fem emner og 28 valgte undervisningshendelser. Det syntetiske filutvalget ga 628 hendelser; profilen endte med 73 emner og 658 aktiviteter inkludert tidligere data. Detaljrapporten sier **NHH feilet**, mens **NIH ga forhåndsvisning med advarsler**.

500 hendelser med nye emnekoder ble lagret, mens varianten med eksisterende emner ble avbrutt i en tung forhåndsvisning med 1656 select-elementer og 44866 option-elementer. Gjentatt identisk ICS-import og endret hendelse med samme UID ga rapportert korrekt dubletthåndtering. Eksporten hadde 412 unike UID-er, men 396 doble emnekodeprefiks og epoketid i DTSTAMP. Dette er rapporterte resultater; de nye regresjonene bruker egne syntetiske data.

Oppfølgingen prioriterer F01 (mengdeforhåndsvisning), F02 (foreldet importstatus/sene svar), F07 (kodeprefiks), F04 (kalenderlenkens støtte) og F09 (HVL-metadata), samordnet med F08/DTSTAMP-rettingen. F03 er en avgrensning ved fri tekst uten kjent importformat. F05 (NHH/FHS/Samisk kildevalg) og F06 (AHO-semesterår) er fortsatt åpne kildefunn; AHO-årstallene er ikke verifisert mot offisiell studieplan. Ingen av disse punktene gir grunnlag for å love støtte for alle 25 læresteder.

Rapporten er ingen samtidig belastningsprøve, sikkerhetsrevisjon eller måling av representative svartider. PDF/DOCX-filvelgeren stoppet i testautomatiseringen og viser ikke en bekreftet appfeil. Omlasting ble kontrollert i samme profil; full nettleseromstart og gjenoppretting i en annen profil ble ikke prøvd der. Smalt vindu, full tilgjengelighet, Outlook, full oppgave-/Angre-flyt og personlig refleksjon var heller ikke fullført. Avvist gov.uk-kalender og UiB-timeplanside skal forklares innen eksisterende kildevern, ikke løses ved å fjerne det.

Nye syntetiske regresjoner gjenskapte de prioriterte funnene før retting:

| Funn | Avgrenset oppfølging |
| --- | --- |
| F01 | 500 hendelser med 25 eksisterende emner har felles emnevalg og individuelle felt som opprettes ved åpning. Valideringsfeil hører til fellesvalget; avvist lagring skal ikke åpne 500 redigeringsrader. Eksakt kobling, redigering, nytt emne, lagring, omlasting og gjentatt import kontrolleres. |
| F02 | Tre statusprøver feilet på `618357b` før retting. Bytte av lærested/program nullstiller nå avledet status og valg. Ti kontrollerte nettleserprøver dekker også sene svar og feil fra eldre forespørsler; de eksisterende forespørselsvernene beholdes. |
| F04 | Hjelp før henting skiller støttede studiekalendere fra HTML-timeplansider og andre domener, med en konkret vei til filimport. De rapporterte lenkene er fortsatt avvist etter eksisterende kildevern. |
| F07/F08 | Identisk innledende emnekode legges ikke til to ganger, heller ikke foran generert «Studieøkt». Andre koder og intern titteltekst bevares. Faktisk nettlesernedlasting, kontrollerbar UTC-klokke, UID-er og hendelsestider inngår. |
| F09 | HVL DAT100 høst 2026 skiller emnenavn, publisert campus og variant fra råetiketten. Ukjente felt og flere campusnavn forblir uavklart. Gjenimport av samme eldre TimeEdit-objekt reparerer feil campus først ved bekreftelse og bevarer ID, egne navn/notater og hendelses-/oppgavelenker. Søket kan være kode eller navn; kildekontrakten og objektidentiteten valideres fortsatt strengt. |

En ny separat gjennomgang fant blant annet validering som åpnet alle radene, manglende fokus ved nytt emne, gjenoppretting av åpne underfelt, eldre HVL-råmetadata og blokkering ved ukjent tidsanslag. Disse ble tatt inn i rettingen. Første mengdeutvalg mot låst bygg var **12/14**, og neste målrettede utvalg **16/18**; de feilede kjøringene er ikke beståttresultater. Oppfølgingskontrollen omfatter de konkrete feilene før ny helkjøring.

F01 ble også profilert lokalt med 500 syntetiske hendelser og 25 eksisterende emner. Første gjenskaping hadde **1626 select / 34150 option / 52505 DOM-elementer**; den kompakte visningen hadde **126 / 4650 / 7006** før enkeltredigering. Det er et annet datasett enn rapportens profil. Profilering av den resterende tregheten viste gjentatt normalisering av institusjon ved gruppering. En cache med alle sju identitetsfeltene som ugyldiggjøringsgrunnlag reduserte to målte emnevalg fra **5888/5525 ms til 362/386 ms** i samme lokale komponentoppsett. Gjenimportens oppsummering tar nå én kopi av lagret plan per beregning, og emnealternativene bygges én gang per gruppevisning. Dette er få diagnostiske målinger, ikke en svartidsgaranti eller samtidig belastningsprøve.

Første preview `618357b` bestod **Ajour quality**, men automatisk etterkontroll feilet i to NTNU-prøver. Den faktiske emnesiden hadde en nestet «Sted»-etikett som ble med i campusverdien. Parseren fjerner nå etiketten, og skiller også tvetydige campus med «og»/«&». Den faktiske UiT-PDF-prøven på samme preview bestod og viste den forventede bildetabellbegrensningen. CI- og Vercel-sperrene er uendret; en ny grønn etterkontroll kreves før integrering.

Etter oppfølgingsrettingene bestod begge F01-prøvene mot låst produksjonsbygg: **2/2**, med 500-hendelsesforløpet på **58,2 s** og nytt emne/fokus på **4,8 s**. Samme 120-sekunders testgrense ble beholdt. Den siste fullstendige enhetssuiten bestod **2451/2451 i 142 filer** (75,46 s), og isolert Node/SQLite bestod **3/3** med normal avslutning. Produksjonsbygget bestod; eksisterende bundlevarsel består (**902,60 kB / 274,68 kB gzip**). Dette er teknisk regresjon, ikke prosjekteierens omprøving.

Siste samlede nettleserkjøring mot ferdig bygg bestod **95/95** (6,0 min), med normal avslutning. Alle **24 nye dialogbilder** ble faktisk åpnet og vurdert uten konkrete visuelle funn: to dialoger × lyst/mørkt × 390/900/1440 px × 100/200 % tekst. Fokus, klikkbare etiketter, tastaturavbrudd og en representativ lagring ved 390 px/mørkt/200 % inngår. Personvernkontrollen omfattet **763 tekstfiler og 11 utfoldede ICS-filer**, uten funn; Markdown-kontrollen omfattet **38 dokumenter, 534 lokale lenker og 110 ankre**, uten feil. To runder med tre uavhengige gjennomganger er fullført, med avgrensede oppfølgingslesninger av rettingene.

## Retting etter rapportert egenutprøving — 2026-10-29

Utgangspunkt `b9abc268e9b6881d61b0b09a2afdfb8d0695a95a`, egen branch `fix/ajour-own-trial-20261029`. Brukerens observasjoner og den separate KI-rapporten er bevart i [prøveplanen](../.docs/planning-artifacts/USER-TRIAL-PLAN.md). Berørte punkter trenger omprøving; SC-07, Outlook og personlig refleksjon er ikke ferdigmeldt. Den identifiserte syvsiders sensorveiledningen ble lest på nytt, med samme SHA-256 som i planindeksen. Lærerfiler er urørt.

| Funn | Retting og teknisk evidens |
| --- | --- |
| Store radioknapper og ellipsefokus | Generell tekstfeltbredde/minstehøyde traff også radioknapper. Valgkontroller har nå avgrenset størrelse, klikkbar etikett og synlig tastaturfokus. Nettlesermatrisen dekker utfalls- og planleggingsdialog i begge temaer, 390/900/1440 px og 100/200 % tekst. |
| «Lesing» under «Venter på» | Gjenskapt med syntetiske data. Blokkeringen forklares uttrykkelig og **Avklar** åpner riktig felt. Hjelpeteksten skiller arbeidssteg fra venting. Ukjent aktivitetstid har egen vei til redigering. Ingen sperrer eller brukerdata endres automatisk. |
| Tilgjengelighet | Ingen lagringsfeil gjenskapt. Begge inngangene til detaljert tilgjengelighet er prøvd med ugyldig og gyldig tidsrom, omlasting og en startklar oppgave med ledig tid før fristen. |
| UiT PDF | Produksjonsloggene bekreftet manglende canvas/DOMMatrix i PDF-workerens pakke. Native avhengigheter inkluderes nå i Vercel-funksjonen. [Valgt H-2025-PDF](https://uit.no/Content/931776/cache=20261310132856/Studieplan%20Bachelor%20i%20geovitenskap%20H-2025.pdf) ble lest lokalt: syv sider, 280 tekstelementer; emnetabellen på side 5 er et bilde, visuelt kontrollert. Denne begrensningen forklares særskilt med kildelenke og manuelle alternativer. Ingen OCR eller konstruerte emner. |
| BI | Begrenset undervisningsstøtte vises før henting; emnene kan fortsatt lagres. Kvitteringen skiller emner fra undervisning, og unødvendige undervisningsforespørsler/dupliserte varsler er fjernet. Campus fra studieplanvalg merkes med opphav. Fil-, tekst-, kalender- og manuelle alternativer beholdes. |
| NTNU | [HMS0004](https://www.ntnu.no/studier/emner/HMS0004/2026), [AAR4619](https://www.ntnu.no/studier/emner/AAR4619/2026) og [AAR4711](https://www.ntnu.no/studier/emner/AAR4711/2026): hver offisiell 2026-side og dens kalender for `26h` svarte HTTP 200; alle tre kalendere hadde 0 hendelser ved kontrollen. Dette viser et tomt valgt kildesvar, ikke at undervisning ikke finnes. Ugyldige hendelser og transportfeil skilles fra gyldig tom kalender. Emnesidens «Sted» beholdes. |
| ICS | `METHOD:PUBLISH` får ett UTC-tidspunkt per eksport etter [RFC 5545 §3.8.7.2](https://www.rfc-editor.org/rfc/rfc5545#section-3.8.7.2). Injisert klokke prøver gjentatt eksport og endrede hendelser med stabile UID-er, sommertid/vintertid, start/slutt og heldager. Originalfilen var ikke tilgjengelig på oppgitt sti; 24 hendelser med epoketid er brukerens rapport, ikke ny filanalyse. Outlook er ikke prøvd. |
| KI-rapporterte avvik | Gjenskapt med syntetisk klokke: kommende økt kl. 18 vises nå ved kontroll kl. 17.48; full reservasjon gir samsvarende kapasitetsmelding. Direkte øktredigering bruker eksisterende Angre-historikk, med eksakt gjenoppretting også etter omlasting. Dette er teknisk etterprøving av KI-rapporten. |

Sluttkontroll kjøres i en separat kopi med `npm ci`, fordi den vanlige arbeidsmappens installasjon avvek fra låsefilen. Node **24.19.0**, Vite **8.2.4**, Vitest **5.0.3**, Playwright **1.63.0**; installasjonen rapporterte **0 kjente sårbarheter**. Første samlede kontroll før gjennomgangsrettingene: **2424/2424 enhetstester i 140 filer**, **76/76 nettlesertester mot ferdig bygg**, **3/3 isolerte SQLite-prøver** og bestått produksjonsbygg. Det eksisterende bundlevarselet over 500 kB består. Lagrings-/backupformat, emnefarger, tema og importvern er uendret.

Den tidlige utviklingsserverprøven for import viste fem beståtte tilfeller, men hang ved avslutning og ble avbrutt. Den føres derfor ikke som en bestått helkjøring; senere bygget kjøring avsluttet normalt. **24/24 faktiske kontrollbilder** ble åpnet og vurdert: begge dialoger × to temaer × tre bredder × to tekststørrelser. Ingen blokkerende visuelle funn. Utvidet Tab-/Enter-kontroll bestod også **12/12**, med synlig fokus på dialogknappen og eksakt bevart lagring etter avbrudd.

Tre separate, kontekstfrie gjennomganger ble fullført før integrering. Oppfølgingen retter blant annet ugyldig-til-tomt-status ved kalenderoppdatering, bevarer kildefeil og delvise resultater, avklarer fler-campus og hindrer at beregnet fri kapasitet kalles en lagret reservasjon. «Pågår nå»/«Neste aktivitet» beholdes i den flyttede aktivitetsraden. Prøvene er utvidet med tidligere lagrede data og bytte av undervisningskilde. Separate oppfølgingslesninger bekreftet rettingene uten gjenværende konkrete funn; ingen funn er utsatt.

Etter disse rettingene bestod full enhetssuite **2428/2428 i 140 filer**, produksjonsbygg og alle **78/78 nettleserprøver mot ferdig bygg** (2,9 min). Det målrettede importutvalget bestod også **7/7** før helkjøringen. Lokal Node/SQLite bestod på nytt **3/3** (12,9 s), med egen database og tilfeldig port. Hovedbundle er **896,34 kB / 272,70 kB gzip**. Kontrollkopiens 737 app-/test-/konfigfiler hadde identiske SHA-256-verdier med arbeidskandidaten. Før staging bestod personvernkontrollen av 754 tekstfiler, inkludert 11 utfoldede ICS-filer; sikkerhetstestene bruker uttrykkelig syntetiske verdier på reserverte eksempeldomener. Markdown-kontroll: 38 dokumenter, 533 lokale lenker og 110 ankre, ingen feil.

## Teknisk sluttkontroll og publiseringssperrer — 2026-10-29

Avgrenset videreføring fra `0c8bd730f5115edd22926277c0f5fd9630ca4f1a`, på egen branch `fix/ajour-release-gates`. Lærerens punkter om kvalitetssikring, sporbarhet, kontrollerbart KI-arbeid og kjørbarhet følges opp uten nye produktkrav. Sensorvedlegget identifisert i planindeksen ble ikke funnet i denne økten; tidligere lesing gjøres ikke til en ny kildekontroll.

| Område | Førkontroll og tiltak |
| --- | --- |
| Eksisterende funksjoner og sikkerhet | Komplett nettleserlagring, backup, tolv emnefarger, tema, isolerte profiler og avgrenset importvern var allerede implementert. HTTPS-/kilde-/redirect-/DNS-kontroller, importfrister og størrelsesgrenser beholdes. Ingen nye bekreftede SSRF-/XSS-funn i det undersøkte utvalget. |
| CI og publisering | Repositoryet hadde ingen Actions-workflows; `main` var ubeskyttet og siste sjekk var bare Vercel bygg. Kontoen har push, ikke admin. Ny **Ajour quality** kjører låsefilinstallasjon, full enhetssuite, bygg, nettleserkontrakter mot bygget og isolert SQLite. Vercel-sjekken krever dette navnet før domenetildeling i preview/production. Ingen krav om en annen persons godkjenning eller endringer i organisasjonsregler. |
| Dokumentert importfeil | FHS og Kristiania kunne returnere fragmenter av ugyldig JSON i advarsler etter en vellykket første katalogside. Reprodusert via hosted handler med oppdiktede data. Begge bruker nå eksisterende feilsanitering, beholder forventet veiledning og lar avbrudd forbli avbrudd. Seks regresjonsprøver dekker begge adapterne. |
| Feiloppfølging | Automatisk etterkontroll bruker deploymentets commit, faktisk byggmarkør og syntetiske nettprøver. Faste feilkategorier bevares i CI-loggen; ingen private planer, kalendere eller sensitive URL-er logges. README forklarer bygg-/kjøretidslogger, delvis import og Hobby-loggenes korte levetid. |
| Tilbakerulling og data | README skiller Hobby Instant Rollback av appkode fra backup/gjenoppretting og lokal SQLite. Fungerende produksjon er ikke rullet tilbake. Ingen ny database, innlogging, betalt tjeneste eller periodisk agentjobb. |

Den rene, separate testkopien ble installert med `npm ci`: Node **24.19.0**, Vite **8.2.4**, Vitest **5.0.3**, Playwright **1.63.0**. `npm audit` fant **0 kjente sårbarheter**; ingen oppgraderinger var nødvendige. Endelig lokal kodekandidat `ce6d410` bestod **2411/2411 enhetstester i 136 filer**, **145/145 releasetester**, produksjonsbygg og **55/55 nettleserkontrakter mot ferdig bygg**. SQLite bestod **3/3** med egen midlertidig database/port, inkludert migrering, gjenoppretting, gjentakelse og Angre.

Før produksjonsendring bestod en ny syntetisk profil **1/1** på produksjonsadressen: hovedflyt, backup til profil B, profilisolasjon og full Chromium-gjenåpning. Den samme profilen beholdes for kontroll etter publisering. Ingen eksisterende privat nettleserprofil ble åpnet.

**Trygg lokal øvelse:** På en egen tilfeldig loopbackport bestod oppretting/backup/gjenåpning **1/1**, verifisering etter kandidatbygg **1/1** og verifisering etter tilbakekopiering av det tidligere statiske bygget **1/1**. Domenedata og preferansenøkler var eksakt bevart. Dette var en lokal kontroll av statiske filer og syntetiske data, ikke Vercel Instant Rollback eller full tilbakeføring av serverfunksjoner. Før- og kandidatbyggets klientfiler var uendret i denne første runden. SQLite-gjenopprettingen ovenfor er separat evidens.

Mellomkjøring av nettleserutvalget ga **54/55**, med én `ENOENT` i sporingsfil fordi samtidige tester brukte samme resultatrot. Separat temakjøring ga **18/19** og avdekket at forsinkelsesprøven bare fanget utviklingsmodulen, ikke bygget bundle. Testen fanger nå faktisk entry-modul og krever at forsinkelsen traff. Det nye kjøreverktøyet eier server, tilfeldig port og egen resultatmappe. Første Linux-CI på `ce6d410` ga **54/55** fordi en native scroll-hendelse kunne lagres etter tematestens før-snapshot. `f6b38b4` venter uttrykkelig på korrekt lagret rulleposisjon før snapshot; alle etterassertions beholdes. **20/20** lokale repetisjoner med to workers bestod, og [ny full GitHub-kvalitetssjekk](https://github.com/IBE160-2026/G37-yilmaz/actions/runs/40890626996) ble grønn. Ingen appatferd eller testkrav er svekket.

Separat gjennomgang hadde to uavhengige, kontekstfrie lesninger og en verifikasjonslesning utført av sikkerhetsimplementøren på grunn av samtidig agentgrense. Den fant blant annet at oppgitt SHA alene ikke beviser nettstedets versjon, og at CI tidligere prøvde utviklingsserveren etter bygg. Disse kontrollfeilene rettes med en offentlig commitmarkør, negativ SHA-prøve og nettleserkjøring mot ferdig bygg. Gjennomgangen er teknisk kontroll, ikke prosjekteierens egenutprøving.

### Bevis på håndhevet publiseringssperre

Vercel-prosjektsjekk `chk_650e90c9-b8f1-4f54-89e0-24f3ade17c45` krever GitHub **Ajour quality**, blokkerer `deployment-alias` og gjelder **preview og production**, med 1800 s tidsgrense. Automatisk Git-deploy er fortsatt aktiv; domenet tildeles først ved bestått sjekk. GitHub `main` er ikke beskyttet, og det påstås ingen separat mergesperre. Vercels egne bygg-/releasetester kommer i tillegg til full CI.

Den isolerte grenen `test/ajour-release-gate`, commit `cc8fae30de439efd339db72a15acaef572825e4e`, la til én bevisst feilende test uten å ødelegge appbygget. [GitHub-kjøring 40889286979](https://github.com/IBE160-2026/G37-yilmaz/actions/runs/40889286979) ga **2411 bestått / én tilsiktet feil**. Vercel-deploy `dpl_AkU8pNJ2CuqLmjGcG3f3SqxETU5k` ble `READY`, mens sjekk `ckr_f65ab988-83e5-458d-b8a1-4c7431198ef6` fikk `failed`, `checks.deployment-alias.state=failed` og **`aliasAssigned=false`**. Produksjonen beholdt `0c8bd730` og svarte HTTP 200. Den ødelagte testgrenen skal aldri integreres. Et byggs unike testadresse kan fortsatt svare; det er domenetildeling som håndheves.

Positiv kontroll: `f6b38b4c6c02ee15cc236b302e49e647897c783d`, deploy `dpl_HXwckKHmbR87Uu9bbCYg35QybgaX`, fikk **`succeeded` / `aliasAssigned=true`** etter grønn kvalitetssjekk. [Automatisk etterkontroll](https://github.com/IBE160-2026/G37-yilmaz/actions/runs/40891202949) startet fra Vercels faktiske deployment-hendelse og bestod. Ingen Force Promote, administratoromgåelse eller godkjenning fra en annen person er brukt.

### Faktisk preview og målinger

Nettprøvene nedenfor brukte [den konkrete Vercel-previewen](https://ajour-klao1js30-ajour1.vercel.app), deploy `dpl_6Bysx41z6LtPg6Zf6PKxq8pb5XWb`, commit **`ce6d410a47581ace22577b167a6f4257cb634f0d`**, bekreftet både i deploymentmetadata og offentlig `/release.json`. Den senere `f6b38b4` endrer bare synkroniseringen i én test. GitHub, den lokale testkopien og Vercel bygger hver for seg; identiske byggeartefakter påstås ikke.

| Kontroll | Resultat og avgrensning |
| --- | --- |
| Hovedflyt, bygde ressurser og feil | **36/36**, 2,4 min: 19 hovedflyt-/API-/PDF-prøver, seks visuelle scenarioer og elleve negative scenarioer. Oppgaver, økter, utfall, omplanlegging, Angre, filimport, backup, lagringsfeil og importfeil inngår. |
| Visuell inspeksjon | **30/30 forskjellige PNG-er faktisk åpnet**: fem visninger × lyst/mørkt × 1440/900/390 px. Ingen blokkerende funn. Kalenderens interne siderulling beholdes. Dette er agentens tekniske inspeksjon. |
| Hel HiMolde-programgjentakelse | **1/1**, 7,3 s, inngår i de 36: hele IBE110/IBE430/IBE160-flyten gjentas etter omlasting med syntetiske kilder. Stabile ID-er, aktivitetsvalg og eget notat beholdes; ingen duplikater eller lagring før godkjenning. [Presis avgrensning](IMPORT-COVERAGE.md#hel-himolde-programgjentakelse-med-syntetiske-kilder--2026-10-29). |
| Faktisk HiMolde-/NTNU-transport | Første utvalg **5/6**. IBE430-søket fikk `socket hang up`; appen viste kildefeilen. Bare den feilede prøven ble gjentatt: **1/1**, 10,4 s, uten kodeendring. Alle seks navngitte scenarioer har dermed bestått, men første kjøring var ikke helgrønn. Dette er adskilt fra den syntetiske programgjentakelsen. |
| Egen preview-profil | **1/1**, 14,6 s: UI-opprettet plan, gyldig ICS, backup/gjenoppretting til separat profil B, profilisolasjon og full lukking/gjenåpning av Chromium. Ingen privat profil ble åpnet. |

Målemetode: tre nye, cachedeaktiverte Chromium-profiler per visning; servercache er ukontrollert. Desktop 1440×1000, mobil 390×844 med 4× CPU-brems, 150 ms nettverkslatens og 200 000 byte/s ned. Mobil er **emulering**, ikke fysisk telefon. Tid til klar UI inkluderer nettleserautomatisering; LCP er siste observerte verdi før interaksjon. Tre sekvensielle importmålinger gjelder bare HiMolde IBE160 høst 2026. Alle målinger var komplette, uten registrerte side-/konsoll-/nettverksfeil.

| Måling, median (min–maks) | Før: produksjon `0c8bd730` | Preview `ce6d410` |
| --- | --- | --- |
| Desktop: klar UI | 322 ms (311–3089) | 377 ms (322–715) |
| Emulert mobil: klar UI | 3922 ms (3828–3946) | 3943 ms (3839–4050) |
| Emulert mobil: observert LCP | 3836 ms (3736–3852) | 3804 ms (3736–3892) |
| Emulert mobil: navigasjon til malt UI | 153 ms (152–153) | 167 ms (163–253) |
| Avgrenset undervisningssøk | 723 ms (590–2300) | 515 ms (509–1061) |

Dette lille utvalget viser ventetid ved kald oppstart under mobilstruping, men beviser ingen ny kodeflaskehals eller statistisk ytelsesforbedring. Import-/UI-kode utenfor den påviste feilsaniteringen er derfor ikke bygget om. Hovedbundle **891,30 kB / 271,05 kB gzip** og eksisterende varsel over 500 kB består. Hobby-grenser, tidsfrister og enkel feilsøking står i [driftsbeskrivelsen](README.md#gratisbruk-og-målinger). Ingen belastningstest som bruker opp gratisressurser er utført.

### Kontrollert produksjon etter PR-integrering

[PR #4](https://github.com/IBE160-2026/G37-yilmaz/pull/4) ble integrert med vanlig merge etter grønn PR-/push-kvalitetssjekk, faktisk preview og separat gjennomgang. Produksjonscommit er **`e77620ad596c0a09066ec3d24d3dd72034a8609e`**, deploy **`dpl_GjdHds8q1dpDzTRHJbzDtQcbXGoE`**. Vercel viste først `READY / production`, `pending` og `aliasAssigned=false`. Etter [grønn main-kvalitetssjekk](https://github.com/IBE160-2026/G37-yilmaz/actions/runs/40892129913) ble sjekken `succeeded` og aliaset tildelt. [Produksjonens `/release.json`](https://ajour-sooty.vercel.app/release.json) bekreftet eksakt mergecommit.

På [produksjonsadressen](https://ajour-sooty.vercel.app) bestod **19/19 hovedflyt-/API-/PDF-prøver**, 1,4 min. Den samme syntetiske profilen som var opprettet på `0c8bd730` før endring, bestod verifisering **1/1**, 4,1 s: alle lagrede plan- og preferansenøkler var eksakt bevart etter ny deploy. [Automatisk etterkontroll](https://github.com/IBE160-2026/G37-yilmaz/actions/runs/40892608749) bestod dessuten bygde nettprøver og avgrenset live-import på deploymentets unike adresse, med eksakt commitkontroll først.

Siste CLI-tørrkontroll omfattet **188 filer**, uten miljøfiler, databaser, profiler, rålogger eller testresultater. Dette lastet ikke opp eller publiserte noe. Dokument-/loggoppfølging endrer ingen appkode og går gjennom samme CI-/Vercel-sperre; den siste publiserte dokumentcommiten kan leses fra commitmarkøren og GitHub/Vercel-historikken. Denne seksjonens funksjonstester gjelder uttrykkelig produksjonscommit ovenfor, ikke et påstått identisk senere byggeartefakt.

**Restpunkter:** SC-07/egenutprøving, personlig refleksjon og faktisk Outlook-prøve er fortsatt ikke gjennomført. Bundlevarselet består. Det tekniske restpunktet for full HiMolde-programgjentakelse er lukket med syntetisk evidens; faktisk kildetransport gjennom hele gjentakelsen påstås ikke. Uidentifisert proposal/overordnet veiledning beholdes som kildebegrensning.

## Vercel-nettleserutgave — 2026-10-29

**Publisert og funksjonskontrollert: [Ajour](https://ajour-sooty.vercel.app).** [PR #1](https://github.com/IBE160-2026/G37-yilmaz/pull/1) ble integrert med vanlig merge etter beståtte faktiske preview-kontroller. Produksjonsgrunnlaget er `491b8442f53b38af275b1b60dda5943f0236f4aa`, deploy `dpl_FDEYDKxy7Fd1nJTcrgFPFP5EopXT`, **READY / production**. Domenet ga HTTP 200 etter promotering. Senere dokument-/loggcommits endrer ikke appgrunnlaget; siste publiserte Git-hash kan også kontrolleres i Vercel/GitHub.

Det eneste prosjektet er **`ajour` i Hobby-teamet `ajour1`**, koblet til det offentlige repositoryet `IBE160-2026/G37-yilmaz`. Root Directory `studieplanlegger`, Node **24.x**, `npm ci`, `npm run build`, output `dist`, produksjonsgren `main`. Ingen betalt tjeneste, database, brukerkonto eller miljøhemmelighet er innført. Automatisk produksjonsdomenetildeling er aktiv igjen etter kontrollert staging.

Hele nettplanen bruker eksisterende validert `localStorage`, med revisjonskontroll, relasjoner, Angre, recovery og samme backupformat. Bare avgrenset, tilstandsløs import kjører på Vercel. API-et tilbyr ingen studenttilstand, sikkerhetskopi eller SQLite. Lokal Node/Docker beholder SQLite. Profiler, localhost, preview-adresser og produksjonsadressen har adskilte data. Nettleserdata kan slettes; backup må eksporteres for oppbevaring/flytting. Ingen enhetssynkronisering loves. Layout, logo, tolv emnefarger og temaer er beholdt.

### Faktiske offentlige nettprøver

Prøvene brukte syntetiske profiler og låste testavhengigheter. Ingen lokal appserver ble startet av fjernkonfigurasjonen. Previewgrunnlaget var `57cf6916e5ed3a2c83f3c6e7b8c19d31a9781e3a`; testrettingen `71ec2f681d388f83987e48ab369396dfa1a361df` endret bare to testfiler. Nettprøvene erstatter ikke prosjekteierens manuelle observasjoner.

| Kontroll | Faktisk resultat |
| --- | --- |
| [Stabil Vercel-preview](https://ajour-git-feat-ajour-vercel-ajour1.vercel.app), `test:e2e:remote` | **35/35**, **3,6 min**: 18 hovedflyt-/API-/PDF-prøver, 6 visuelle scenarioer og 11 negative scenarioer. Oppgaver, emner, studieøkter, arbeidsutfall, omplanlegging, Angre, filimport og backup er kontrollert gjennom UI. |
| Preview: live HiMolde/NTNU | **6/6**, **1,5 min**. HiMolde IT 2026-programvalg med IBE110/IBE430/IBE160, direkte undervisningsimport for de tre emnene og NTNU ARK1001/EXPH0100 med emnemetadata/TP. Kilde-ID, valgte aktiviteter, bekreftelse, lagring og omlasting er kontrollert. Direkte emneimport gjentas; dette er fortsatt ikke gjentakelse av hele HiMolde-programflyten. |
| Visuell inspeksjon av preview | **30/30 faktiske PNG-er åpnet og vurdert**: oversikt, kalender, oppgaver, import og innstillinger × lyst/mørkt × 1440/900/390 px. Ingen blokkerende funn. Logo, lesbarhet, emnefarger og handlinger beholdt. Kalenderens avgrensede siderulling og undervisningslistens interne rulling er tilsiktet; ingen horisontal sideflyt. |
| Preview: eget profilforløp | Create **1/1, 31,3 s**. UI-opprettet plan, økter, utfall og steg, omplanlegging/Angre, parsbar ICS, nedlastet backup og eksplisitt gjenoppretting til profil B. B startet tom, egen B-oppgave endret ikke A. Full lukking/gjenåpning av Chromium beholdt eksakt lagring. |
| Preview: ny deploy på samme adresse | Verify **1/1, 4,6 s**. Fra `dpl_AxTzusxYR1L5YyZqf43LszYKmKiz` til `dpl_5VD1nHkTzKLEbbpCgYtST7fP6yGM` etter Git-push av `71ec2f6`. Alle plan-/preferansenøkler var eksakt bevart i den samme eide profilen. Ny deploy og uendret branch-alias er bekreftet separat med Vercel API. |
| Produksjon: hovedflyt og routing | **18/18**, **1,6 min**, mot produksjonsdomenet på `491b844`. Også direkte `/`, `/index.html` og annen appsti, bygde ressurser, PDF-worker og JSON-API ble kontrollert. Ukjent API, `/api/state`, recovery og backup gir JSON 404; de faller ikke gjennom til HTML. |
| Produksjon: live HiMolde/NTNU | **6/6**, **1,6 min**, samme avgrensede utvalg gjennom produksjonsfunksjonen. Dette er faktisk kildetransport, adskilt fra negative prøvers injiserte kildefeil. |
| Produksjon: lagring og eksport | Create **1/1, 30,9 s** på ny syntetisk profil: hovedflyt, gjenåpning, adskilt profil, backup/gjenoppretting og ICS. |
| Preview og produksjon i samme profil | Produksjon startet uten preview-planen. En syntetisk oppgave lagret på produksjon lot samtlige preview-nøkler være uendret. Ingen automatisk deling mellom adresser. |
| Feil og nettverk | Ingen uventede konsoll-/sidefeil eller mislykkede nettverkskall i beståtte prøver. De negative tilfellene injiserer og avgrenser forventede feil: utilgjengelig/full lagring, ugyldig backup/lagret JSON, mislykket gjenoppretting, HTTP 503, avbrutt forbindelse og ugyldig JSON/ICS. Tidligere data og utkast beholdes. CSP frame-ancestors, frame/no-sniff og API no-store er kontrollert på Vercel. |

**Konkrete funn og omprøving:** Live-utvalget startet først ikke fordi importert testmodul satte `serial`, mens fjernmodulen ba om `default`. Fjernkjøring beholder nå én arbeider med uavhengige tilfeller. De neste prøvene avdekket utdaterte testforventninger til «IT»/«Årsstudium i IT», navnevisning og tomt kildevalg selv når dagens UI foreslår ett eksakt kodetreff. Testene ble rettet til eksisterende brukerflyt; eksakt kildeobjekt (`kode¤1`), aktivitetvalg, bekreftelse og uendret lagring før bekreftelse er fortsatt påkrevd. Ny kjøring bestod alle seks tilfeller på både preview og produksjon. Ingen appkode eller design ble endret for å få disse prøvene grønne.

### Lokal kontroll og personvern før åpning

Den isolerte kandidaten ble installert fra låsefil med Node **24.19.0**, npm **11.17.0**, Vite **8.2.4**, Vitest **5.0.3**, Playwright **1.63.0**. Seneste fullsuite: **2378/2378 i 134 filer**, **114,04 s**, exit 0; seneste bygg **87 moduler**, **3,56 s**, exit 0. **3/3 SQLite-prøver, 10,9 s**, kontrollerte lokal migrering, revisjonskonflikt, recovery/purge og gjentatt programimport/Angre. SQLite-prøven ble kjørt før siste hosted-only feilsanitering, som også bevarer lokal catch-oppførsel i fullsuiten. Tidligere lokal nettmodus **35/35** og profilprøve **1/1** er lokal evidens, adskilt fra nettresultatene over.

Tre uavhengige kodegjennomganger førte til terminal håndheving av samlet importgrense, skjerming av uventet parserinnhold og minimert diagnostikk. Fullsuiten dekker blant annet oppslag 250/251, samlet bytegrense, direkte kalenderfeil og syntetiske personvernmarkører. Ingen dataformat eller lokale lagringskontrakter ble endret. Eksisterende bundlevarsel over 500 kB består.

Før Vercel Authentication ble deaktivert, ble alle **fem beholdte deployer** identifisert; neste listeside var tom. De to CLI-deployenes manifester inneholdt **181 kildefiler hver**, uten miljøfiler, databaser, profiler, testdata eller logger. Hashene ble knyttet til kontrollerte kilder, med normalisering av Git-linjeslutt. Ett eldre `import-api.js`-innhold ble hentet og sammenlignet: avviket var bare den senere feilsaniteringen, ingen private data. De tre Git-deployene var knyttet til kjente kildecommits; ett hadde mislykket bygg og ingen kjørende app. Git-filtreets API ga 404, så Git-kildeproveniens ble kontrollert gjennom deploymentmetadata og repositoryet. Prosjektet hadde ingen egendefinerte miljøvariabler. Avgrenset kilde-/klientscan fant ingen hemmelighetsmønstre; hosted-handleren eksponerte ikke lokal tilstandsserver.

Eieren godkjente deretter uttrykkelig offentlig tilgang for **bare `ajour`**, inkludert eksisterende og framtidige previews. CLI bekreftet riktig prosjekt-ID og deaktivert SSO; preview skiftet fra 302 innlogging til HTTP 200. Ingen andre prosjekters tilgang ble endret. Nye CLI-opplastinger avgrenses av ett rotfilter til **180 bygg-/kjøretidsfiler**. Dokument-/fixturekontrollen inkluderer **11 utfoldede ICS** og kategori-basert hemmelighetssøk uten å skrive ut treffverdier. Rålogger, profiler, skjermbilder og databaser er lokale/ignorerte.

### Historikk fra klargjøringen samme dato

Prosjektlisten var tom før det ene Hobby-prosjektet ble opprettet. Vercel klassifiserte de første deployforsøkene som produksjon selv med ønsket preview; egne prøve-deployer ble fjernet etter kontroll. Beskyttet staging og midlertidig deaktivert automatisk domenetildeling gjorde det mulig å opprette en ekte Preview. Første Git-push (`5e93e3d`) feilet fordi et ekstra `.vercelignore` i appmappen fjernet låsefilen. Ett rotfilter rettet dette i `b81083e`, og Git-triggeren ble READY. Vercel Authentication blokkerte først nettprøvene; den ble beholdt til eksplisitt eiersamtykke. Ingen av disse grønne byggene alene ble regnet som bestått publisering. PR #1 ble først integrert etter resultatene over; main-deployen ble deretter promotert og kontrollert.

Oppfølgingen adresserer faglærerens krav om avgrensning, sjekkbare kriterier, sporbarhet, personvern og kontrollerbart KI-arbeid. **SC-07/egenutprøving og personlig refleksjon er fortsatt ikke gjennomført.** Faktisk Outlook-prøve, gjentakelse av hele HiMolde-programflyten og eksisterende bundlevarsel er fortsatt åpne. Den tidligere lokale produksjonsavgrensningen og daterte resultater nedenfor beholdes som historikk.


## Lokal commitkontroll — 2026-10-26

Avgrenset sluttkontroll av dokumentrevisjonen nedenfor og de tre navnetekstene, fra `main` på `2d7be923853fed30173399df6c62765103a69ca5`, med tom indeks ved start. Begge dokumentrollene er beholdt: briefen er produktgrunnlaget, PRD-en utdyper behov, krav og aksept. V1, stabile ID-er og rekonstruksjonshistorikk er uendret. Egenutprøving er fortsatt **planlagt / ikke gjennomført**, observasjonsfeltene er tomme, og personlig refleksjon er ikke fylt ut.

Den tidligere 2278-kjøringen gjaldt samme rapporterte tre tekstendringer. Siden den ikke hadde et eget filmanifest, ble tekniske kontroller kjørt på nytt for dette commitutvalget. De **707 tracked ikke-Markdown-filene i appen** har identiske SHA-256-manifester før og etter testene; manifestets SHA-256 er `ae3d6fde33fc2d6ce828b3e61e78b74385e7051d30d5c8fb150a32581125c22d`. Rålogger, manifester og bygg forblir lokale/ignorerte.

| Ny kontroll før lokal commit | Faktisk resultat |
| --- | --- |
| Fokusutvalg | `npm.cmd test -- --maxWorkers=2 tests/unit/database-delivery.test.js tests/unit/import-middleware-program-plan.test.js tests/unit/import-routing-matrix.test.js tests/unit/ajour-compatibility.test.js`: **52/52 i 4 filer**, exit 0, **2,27 s**. |
| Full enhetssuite | `npm.cmd test -- --maxWorkers=2`: **2278/2278 i 132 filer**, exit 0, **50,00 s**. Fokusutvalget inngår i fullsuiten. |
| Produksjonsbygg | `npm.cmd run build`: **87 moduler**, exit 0, **1,07 s**. Eksisterende bundlevarsel over 500 kB består. PDF-header-varselet i testene kommer fra den syntetiske ugyldige PDF-prøven. |
| Verktøygrunnlag | Eksisterende Node **24.19.0**, npm **11.17.0**, Vitest **5.0.0**, Vite **8.2.2**, Playwright **1.63.0**. Ingen ny installasjon eller endring av manifest/låsefil; lokale Vitest-/Vite-patcher avviker fortsatt fra låsefilen. |
| Dokumentasjon | Hele endringsdiffen, inkludert slettinger, er lest. Uavhengig kontroll bekrefter dokumentroller, V1, ID-er og korrekt prøvestatus. Faktiske Markdown-overskrifter, tabeller og escaping er kontrollert; **12 PowerShell-kodeblokker** er syntaksparset uten kjøring, **0 feil**. Lenker/ankre og kravkjeden er kontrollert på nytt; endelig kontroll føres i sesjonsloggen. |
| Personvern og filutvalg | **18 relevante kandidatfiler:** 15 Markdown og tre serverfiler. Mønster-/formatkontroll av **323 unike filer**, inkludert **298 tracked fixturer** og den nye kuraterte loggen; **11 ICS** utfoldet og **269 HTML/JSON** samt PDF-/DOCX-metadata kontrollert. Eksisterende syntetiske verdier og offentlige kilde-/kontaktopplysninger er klassifisert; ingen nye uavklarte treff i commitutvalget. Læreroriginalene samsvarer med HEAD etter Git-normalisering av linjeendinger. Private data, databaser, sikkerhetskopier, rålogger, skjermbilder og genererte artefakter er utenfor utvalget. Dette er en avgrenset kontroll, ikke en universell garanti. |

Restpunktene er beholdt som henholdsvis uutførte aktiviteter, tekniske begrensninger og uidentifiserte vurderingskilder. Manglende kildegrunnlag er ikke gjort til nye obligatoriske innleveringskrav. Lærerens originalfiler er bevart. Ingen nye nettleser-, Docker-, live-kilde- eller manuelle prøver er utført. Eldre resultater nedenfor er datert historikk. Oppdraget autoriserer bare lokale commits, uten push, publisering eller driftsendringer; commitresultatet føres i sesjonsloggen.

## Dokumentrevisjon og navnekontroll — 2026-10-26

Denne seksjonen gjelder den foregående dokumentrunden før commitkontrollen ovenfor; dens testtider og Git-status beholdes som historikk.

Eksisterende PRD, brief, stories, sporbarhet og prøveplan er samordnet med lærerfeedback og prosjekteierens oppdrag. Rekonstruksjonsdatoen 16. oktober, V1-avgrensningen og stabile ID-er er beholdt. PRD-en samler produkt, problem, målgruppe/behov, krav, faktisk researchgrunnlag og reelle åpne spørsmål. Uriktige dokumentpåstander er korrigert i leveransedokumenter, sesjonslogg, åpne punkter og relevant lokalt arbeidsnotat.

**SC-07/R-07/S-07:** Etter prosjekteierens beslutning 2026-10-26 gjelder [prøveplanen](../.docs/planning-artifacts/USER-TRIAL-PLAN.md) manuell egenutprøving alene, med sju scenarier, syntetiske data og isolert lagring. Status er **planlagt / ikke gjennomført**. Ingen andre testpersoner rekrutteres. Den tidligere eksterne studentprøven ble ikke gjennomført eller bestått. Automatiske tester er teknisk evidens og fyller ikke ut manuelle observasjoner eller personlig refleksjon.

Navnesøket klassifiserte aktive produktnavn, generiske fagord, historikk/kildetekst og tekniske kontrakter. UI, nettlesertittel, metadata og brukerrettede eksportnavn brukte allerede Ajour. Tre runtime-/feiltekster er nå rettet i `server/app.js`, `server/import-api.js` og `server/database.js`. Mapper/pakkenavn, lagringsnøkler, database-/backupformat, API-er, importidentiteter/User-Agent, ICS-UID-er/adapter-PRODID, `STUDIEPLAN_*` og Compose-navn beholdes, jf. [arkitekturen](../.docs/planning-artifacts/architecture/architecture-studieplanlegger-2026-09-06/ARCHITECTURE-SPINE.md#ad-14--ajour-presentation-with-stable-data-contracts-2026-10-25). Ingen migrering eller ny funksjon er innført.

| Nye kontroller i denne runden | Faktisk resultat |
| --- | --- |
| Full enhetssuite etter de tre tekstendringene | `npm.cmd test`: **2278/2278 i 132 filer**, exit 0, **78,02 s**. |
| Produksjonsbygg | `npm.cmd run build`: **87 moduler**, exit 0, **6,00 s**. Eksisterende bundlevarsel over 500 kB og et plugin-tidsvarsel; ingen byggfeil. |
| Kontrollgrunnlag | Eksisterende lokal installasjon: Node **24.19.0**, Vitest **5.0.0**, Vite **8.2.2**. Ingen ny `npm ci`; manifest/låsefil angir nyere patchversjoner. Dette er ikke den tidligere isolerte, låste kandidaten. |
| Dokumentlenker og ID-er | **36 Markdown-filer, 487 lokale lenker og 84 ankre**, ingen manglende mål. SC-01–SC-07, R-01–R-08, Q-01–Q-03, S-01–S-08 og E-01–E-03 er definert og koblet. Kodeblokkers eksempellenker er holdt utenfor. |
| Uavhengig dokumentgjennomgang | Innhold kontrollert mot oppdrag, lærerfeedback og sensorvedlegg; struktur og språk kontrollert separat. Fire praktiske prøveplanfunn er rettet: beholdt framtidig økt til kalender/restore, isolert oppstartsoppskrift, nødvendig prøveoppsett etter tittel alene og uttrykkelig navneendring før fargekontroll. Ingen åpne funn fra gjennomgangen. |
| Git og whitespace | `git diff --check` bestått; LF/CRLF-varsler er linjeendingsinformasjon. HEAD er uendret, og staged diff er tom. Sesjonslogg er skrevet lokalt uten commit. |

Ingen nye nettleser-, Node/SQLite-runtime-, Docker- eller live-kildeprøver er kjørt her. Siste slike bevis er datert i [publiseringskandidaten](#samordning-og-publiseringskandidat--2026-10-26) og [temaoppfølgingen](#emnepalett-og-mørk-modus--2026-10-26); eldre Docker-blokkeringer er historiske. Private originalkalendere, brukerens databaser, profiler og sikkerhetskopier er ikke åpnet. Ingen staging, commit eller push er utført, heller ikke automatisk loggcommit.

## Samordning og publiseringskandidat — 2026-10-26

Lærerens faktiske `origin/main` var `1e6af23dc09971a435d843950106075d73ed06d0`, med committene `87081a7` og `1e6af23` etter lokalt grunnlag `9d3a169`. Hele den innkommende endringen var tillegg av `CLAUDE.md` og `.claude/skills/sesjonslogg/SKILL.md`. Ingen lokale filkollisjoner eller pågående Git-operasjon ble funnet; indeksen var tom for staged endringer. `git merge --ff-only --no-autostash origin/main` bevarte lærerens opprinnelige commits.

**Bevaring:** Alle **740** lokale leveransefiler, inkludert 15 nye filer, samsvarte med det tidligere leveransemanifestet før integrering og var byteidentiske umiddelbart etterpå. Den allerede utelatte illustrasjonen forble utelatt. Ingen produktfil er endret i denne publiseringsrunden; bare denne verifikasjonsseksjonen og en kuratert sesjonslogg tilføyes. Tidligere utsagn nedenfor om manuell commit og ingen publisering gjelder de daterte lokalrundene.

| Ny kontroll av samlet kandidat | Faktisk resultat |
| --- | --- |
| Komplett isolert utvalg | **742 filer før sesjonslogging:** de 740 vurderte Ajour-filene og lærerens to instruksfiler. Kopiert bare fra det eksplisitte manifestutvalget. Lokalt SHA-256-manifest og kontrollverktøy ligger utenfor repositoryet under `ajour-publish-2026-10-26/`. Sluttantall med sesjonslogg og åpne punkter dokumenteres i loggcommiten. |
| Låst installasjon | Ny `npm.cmd ci --offline --cache <lokal-pakkebuffer> --no-audit --no-fund`: **94 pakker**, exit 0. Egen `node_modules`; uendret låsefil. Node **24.19.0**, npm **11.17.0**, Vite **8.2.4**, Vitest **5.0.3**, Playwright **1.63.0**. Dette er ingen ny nettbasert sårbarhetsaudit. |
| Målrettede regresjoner | **451/451 i 8 filer**, ingen feil/hopp, exit 0; tema, tolv emnefarger, Ajour-kompatibilitet, agenda, kalender, personvern, backup og SQLite. Samme navngitte utvalg som i temaseksjonen nedenfor; inngår også i fullsuiten. |
| Full enhetssuite | **2278/2278 i 132 filer**, ingen feil/hopp, exit 0. Kandidatens Vitest kjørt med `--maxWorkers=2`; samlet prosesstid **80,41 s**. |
| Bygg og Node/API/SQLite | `node tests/run-database-e2e.mjs`: produksjonsbygg **87 moduler**, **1,65 s**, deretter **3/3**, ingen hopp, **9,9 s**, exit 0. Egen midlertidig database og tilfeldig ledig loopbackport; egne ressurser ryddet. Eksisterende bundlevarsel over 500 kB består. |
| Personvern og leveranse | Ny kontroll av **742 filer / 298 fixturer**, inkludert 269 HTML-/JSON-filer, alle 11 ICS etter linjeutfolding og PDF-/DOCX-metadata. De samme **51 klassifiserte treffkategoriene**, ingen nye uavklarte treff. Begge NIH-filtre har samlet 14 syntetiske etiketter/verdier; 62 resultatrader og 30 hendelsesrader er bevart. Tolv palettplasser med lyst/mørkt, tidlig temainitialisering og 13 merkevare-/font-/bootstrapressurser med fontlisens er bevart. |
| Dokumentasjon | **33 Markdown-filer / 466 lokale lenker / 87 ankre / 44 testreferanser**, ingen feil. Lenkeeksempler inne i kodeblokker er eksempler, ikke prosjektlenker; lærerens skill er uendret. Commitkontrollen krever samsvar mellom staged filutvalg, Git-normalisert innhold og kandidaten, samt bestått `git diff --cached --check`. |

**Gjenbrukt bevis, ikke nye kjøringer:** Alle **709 ikke-Markdown-filer**, inkludert kode, tester, fixturer, konfigurasjon og avhengigheter, er byteidentiske med temaoppfølgingens testede manifest. Faktisk rårapport bekrefter **215/215 Chromium-tilfeller i 20 filer**, ingen feil/hopp/flaky. Faktiske runtime-rapporter bekrefter **3 Node + 3 Docker-scenarioer**, 20 UI-/20 SQLite-kontroller, seks gjenskapinger og to synlige backup-gjenopprettinger; alle 180 runtimehashverdier samsvarer med det tidligere testede grunnlaget. Node-delen i `tp-csv-1793046145980-47833a89` bestod før kjøringens Docker-tilgangsfeil; separat `tp-csv-1793046716218-f44d5569` bestod Docker. Ingen ny Docker- eller live-kildekjøring er utført her.

Faglærerfeedbacken og sensorvedleggets sju sider er lest i denne runden; kontrollsummen samsvarer med planindeksen. Samordningen følger opp sporbarhet, kontrollerbar kvalitet og ryddige fixturer. Brief, PRD, krav-ID-er og avgrenset V1 bevares uten ny kravrunde. SC-07, personlig refleksjon og faktisk Outlook-kontroll er egne åpne aktiviteter; SC-07 følger nå egenutprøvingsplanen beskrevet øverst. Godkjent proposal og overordnet sensorveiledning er ikke identifisert. Ingen ny teknisk blokkering er påvist i dette utvalget.

Private originaler, databaser, sikkerhetskopier, nettleserprofiler, rålogger, mellomnotater, referanser og genererte artefakter inngår ikke i leveransen. Historiske NIH-verdier er ikke sanert fra Git-historikken. Ingen reset, autostash, historikkomskriving, repository-navnebytte eller driftsoppdatering inngår; brukerdata, port 80 og driftscontaineren er uberørt. Faktisk publiseringsresultat registreres i den separate sesjonsloggen etter vellykket push.

## Emnepalett og mørk modus — 2026-10-26

Den godkjente temaoppfølgingen bevarer dagens layout, logo og funksjonalitet. Tolv kuraterte emnefarger erstatter tidligere åtte kodebaserte farger; hver har bakgrunn, markør og tekst i begge temaer. Førgrunnlaget med tolv syntetiske emner viste bare sju forskjellige markører. Temaknappen og **System · Lyst · Mørkt** i Innstillinger endrer utseendet uten ny sidelasting eller domeneskriving. Hovedreisen og avgrenset V1 er uendret.

**Status ved temaoppfølgingen:** implementert, uavhengig gjennomgått og kontrollert i en isolert kandidat med egen `npm ci` fra uendret låsefil. Ingen åpne tekniske blokkeringer ble påvist i dette avgrensede sluttutvalget. Den tidligere Docker-blokkeringen ble lukket med kontrollene nedenfor. Eksisterende bundlevarsel og ikke gjennomført manuell utprøving/Outlook-kontroll er reelle begrensninger, ikke en påstand om en feilfri app. Gjeldende egenutprøving har status som beskrevet øverst.

| Kontroll på den oppdaterte kandidaten | Resultat |
| --- | --- |
| Avhengigheter | Node **24.19.0**, npm **11.17.0**, Vite **8.2.4**, Vitest **5.0.3**, Playwright **1.63.0**; egen installasjon, **94 pakker**. Ingen endring av package-/låsefiler. |
| Full enhetssuite etter review | **2278/2278 i 132 filer**, 0 hopp, exit 0, **66,08 s**. `npm.cmd run test:unit -- --maxWorkers=2`. |
| Målrettet sluttkontroll | **451/451 i 8 filer**, 0 hopp, exit 0, **3,48 s**: `theme-init`, `course-colors`, `ajour-compatibility`, `agenda-view`, `calendar`, `fixture-privacy`, `connected-backup-privacy`, `database-delivery` under `tests/unit` (alle `.test.js`). Inngår også i fullsuiten. |
| Produksjonsbygg og API/SQLite | **87 moduler**, bygg bestått på **1,17 s**. `node tests/run-database-e2e.mjs`: **3/3**, 0 hopp, exit 0, **8,5 s**. Eksisterende varsel om JavaScript-bundle over 500 kB består. |
| Nettleserutvalg etter review | **215/215 i 20 filer**, 0 feil/hopp/flaky, exit 0, **14,2 min**, to arbeidere. Én komplett grønn kjøring, inkludert **19 nye tematilfeller**. Dette er det relevante Chromium-utvalget, ikke hele nettlesersuiten. |
| Node/Docker/persistens | **3 Node + 3 Docker-scenarioer**, samlet **20 UI / 20 direkte SQLite-kontroller / 6 gjenskapinger / 2 synlige backup-gjenopprettinger**. Integritet `ok`, 0 FK-brudd. Første `both main,correction-ui,corrections-ics` fullførte alle Node-prøvene, men fikk exit 1 ved Docker-tilgang nektet i sandkassen. Separat `docker main,correction-ui,corrections-ics` med ordinær kjøretillatelse bestod, exit 0, ingen hopp/flaky. Hvert miljø hadde seks klientkontroller av tittel, sju SVG-/favicon-filer og `theme-init.js` med eksakte bytes/MIME, temabytte/omlasting og uendret domene/revisjon. Alle **180 runtimefilhashverdier** samsvarte i Docker. Motor **29.8.0** var allerede tilgjengelig; egne containere, porter og testvolumer ble brukt og ryddet. Driftscontainerens ID/bilde/starttid/restartantall/porter/restartpolicy er uendret. |
| Visuelt og kontrast | Faktiske sluttbilder åpnet og vurdert i lyst/mørkt ved **1440, 900 og 390 px samt 200 % tekst**, med oversikt, oppgaver, tolv emner, alle kalendermoduser og representative dialoger/import/utfall. Ekstra måling: **120 opptak / 4188 tekstobservasjoner / 500 feltgrenser**, ingen påviste brudd eller dokumentoverflyt. 84 gjentatte klokketekster over gradient ble uttrykkelig holdt utenfor flatemålingen; separat kontroll av de faktiske gradientene og 24 klokketekster per tema ga minst **8,39:1 lyst / 9,25:1 mørkt**. Emnepalettens tekstminimum er **6,45:1 / 9,13:1** og markørminimum **3,63:1 / 5,51:1**. Hover/valg/fokus og bevarte utkast/filter/dato/rulling kontrolleres i nettlesertestene. |
| Leveranse og dokumentasjon | **740 vurderte filer / 709 ikke-Markdown-filer**, SHA-256-samsvar mellom hovedkopi, kandidat og testet kode; bare dokumentasjon er sluttredigert etter testfrys. **31 dokumenter / 466 lokale lenker / 87 ankre / 44 testreferanser**, ingen feil. `git diff --check` og egen kontroll av 15 nye filer bestod; forventede LF/CRLF-varsler består. HEAD og indekshash er uendret. Referansebilder, hjelpeverktøy, skjermbilder, rålogger, databaser og genererte bygg inngår ikke. |
| Isolert lokal oppstart | README-oppskriften ble kjørt fra kandidaten med PowerShell på **127.0.0.1:5200**, egen tom SQLite-fil og seed av. Helse/tittel/åtte ressurser, system-mørkt, eksplisitt lyst etter omlasting, avbrutt tittelutkast og uendret domene/revisjon bestod. Første wrapper fikk en sandkassefeil under prosessopprydding; bare verifisert egen Node-prosess ble stoppet. Ny komplett prøve med ordinær kjøretillatelse bestod, exit 0; port 5200 er ledig. Den separate gradienthjelperen traff først en allerede stoppet prøveserver og ble deretter kjørt på den aktive isolerte serveren. Ingen produktretting eller svakere måling var nødvendig. |

De 20 nettleserfilene under `tests/e2e` er `action-planning`, `ajour-theme`, `ajour`, `bounded-assessment-fixes`, `bounded-export-programme`, `bounded-work-steps`, `calendar-file-flow`, `calendar-viewport-corrections`, `connected-root-acceptance`, `connected-teaching`, `dashboard-calendar`, `design-final`, `import-clarity-review`, `import-reimport-repair`, `import-resolution`, `import-tp-journey`, `shell`, `simple-planning-flow`, `tasks` og `text-registration-exam` (alle `.spec.js`). De kontrollerer syntetiske ICS-/CSV-/TP-forløp, samme kode ved ulike læresteder, tidsavklaring, hovedreise, avlysning/fullføring/innlevering, feil/Angre og gjenimport. Nye tema-/registerprøver dekker også tolv/pluss-tolv, ugyldig/nektet lagring, systemendring, tidlig oppstart og domene-skriving før omlasting.

Fargeregisteret bruker stabil `course.id` og ledige aktive plasser før gjenbruk. Samme emnekode ved ulike læresteder kan få forskjellige farger. Sortering, filtrering, navneendring, navigasjon, tillegg og gjenimport beholder tildelte plasser. Ved mer enn tolv emner fordeles gjenbruk forutsigbart. Historikken beholdes ved sletting; vanlig Angre får samme farge. Dersom en slettet plass allerede er tatt i bruk, eller antallet går fra over tolv til tolv, flyttes bare en nødvendig kollisjon til ledig plass. Det er ingen garanti om ubegrenset unike farger. Uavhengige syntetiske registerprøver bestod med tolv trinnvise tildelinger, kontrollert gjenbruk og **100 delte register-/slette-/gjenopprettingssekvenser**.

`ajour:appearance:v1` lagrer temavalget og `ajour.course-colors.v1` lagrer ID→palettplass, separat fra oppgaver og kalender. Uten valg følger appen systemet, også ved senere systemendringer. Knappen velger motsatt av vist tema og lagrer et eksplisitt valg. Tidlig same-origin `theme-init.js` setter tema før stilene; ugyldig eller utilgjengelig lagring gir et brukbart standardtema. **32 uavhengige oppstartssekvenser** bestod. Fargeregisteret fletter nyere lokal lagring mellom faner og prøver mislykket skriving igjen. Tema-/fargepreferansene er nettleserlokale og **inngår ikke i backupformatet**; gammel backup får gyldig standardtildeling når separat preferanse mangler.

Tre uavhengige reviewlag ga **15 funn**, inkludert overlappende funn. Rettelsene gjelder synkronisering/retry, faktisk synlige markører i filtre, editorer, import og kompakt eksamensagenda, forståelige korte kalenderhendelser samt sterkere tester med uavhengige domene-ID-er og målt markør. Farge erstatter ikke emnenavn, kode, eksamen, frist, avlysning eller leveringsstatus. Uavhengig bildegjennomgang vurderte paletten som samordnet med Ajour og minst ti tydelig forskjellige emner; nærmeste par er rav/honning og plomme/støvet rosa. Dette er ikke studenttesting eller en garanti om identisk fargeoppfatning for alle.

Uavhengig sluttgjennomgang av rettet kode fant ingen nye konkrete feil og bekreftet rettelsene. En separat prøve med **10 000 steg, fire delte registre og 28 ID-er** bestod; seks faktiske sluttbilder ved 900 px ble også åpnet og vurdert uten nye synlige funn. Skjermbilder og målerapporter ligger lokalt under ignorerte `artifacts/ajour-theme-2026-10-26/visual/final/` og kandidatens egne artefaktmapper. Node-evidens: `tp-csv-1793046145980-47833a89`; separat Docker-evidens: `tp-csv-1793046716218-f44d5569`. Disse er lokale bevis, ikke leveransefiler.

Mellomkjøringer holdes adskilt: første fullsuite ga **2267 pass / 9 feil**, fordi gamle åttefargeforventninger ikke beskrev den godkjente tolvfargeendringen. Bare disse presentasjonsforventningene ble oppdatert; åtte kompatibilitetskontroller for gamle data/backup/UID-er ble beholdt. Før reviewrettelsene bestod **2270 enheter**, **210 nettlesertilfeller i 20 filer**, bygg og **3 Node/API-prøver**. Disse er ikke sluttresultater for rettet kode. Implementeringsagentens avgrensede prøver brukte hovedkopiens eldre verktøyinstallasjon og er heller ikke kandidatens sluttbevis. Ingen live-kildeprøver eller nye importtilbydere er lagt til.

NIH-rettingen og tidligere dokumentopprydding er bevart: **alle 298 fixturer og begge personvernhjelper-/testfilene** er byteidentiske med det godkjente lokale førgrunnlaget. Personvernsuiten kjørte på nytt med **339 pass**. Hele leveranseutvalget ble kontrollert for kjente person-/kontakt-/tilgangs-/metadatamønstre: de samme **51 klassifiserte treffkategoriene**, ingen nye uavklarte treff. Dette er avgrenset felt- og mønsterkontroll, ikke universell navnedeteksjon. **90 tekniske kontraktfiler**, inkludert alle 80 backendfiler, lagring, backup, import/eksport, planregler, Compose og avhengigheter, er uendret. Ingen database-/backupmigrering, repository-endring eller endring av `STUDIEPLAN_*`, gamle nøkler eller ICS-UID-er.

SC-07, personlig refleksjon og faktisk Outlook-kontroll var ikke gjennomført ved denne tekniske kontrollen; SC-07 følger nå egenutprøvingsplanen beskrevet øverst. Sensorveiledningens sju sider ble lest på nytt i denne temaoppfølgingen, med kontrollsum som i [planindeksen](../.docs/planning-artifacts/README.md); eldre fraværsnotater beskriver sine daværende runder. Godkjent proposal var ikke identifisert. Ingen staging, commit, push eller driftsoppdatering var del av denne lokale temaoppfølgingen.

<a id="gjeldende-lokal-oppfølging--2026-10-26"></a>

## Tidligere lokal UI- og personvernoppfølging — 2026-10-26

**Historisk før temaoppfølgingen ovenfor.** Tall, filutvalg, oppstartsport og Docker-blokkering i denne seksjonen beskriver den tidligere lokale kandidaten, ikke dagens sluttstatus.

Den godkjente oppfølgingen bevarer Ajour, avgrenset V1 og **oppgave → valgfritt arbeidssteg → godkjent økt → utfall → justering**. Den omfatter mobil/900 px-hierarki, tidsvalg, rolige leveringspåminnelser, dialoger med 200 % tekst, NIH-fixturens to foreleserfiltre og kontroll av hele den lokale leveransen. Arbeidet er lokalt for brukerens senere commit; tidligere publikasjon **`9d3a169` er historisk og før Ajour**.

**Status:** UI- og personvernrettingene er implementert, uavhengig gjennomgått og kontrollert i den isolerte sluttkandidaten med egen låst installasjon. Enheter, bygg, relevante nettleserforløp, Node/SQLite, visuelle kontroller og isolert oppstart er fullført som beskrevet nedenfor. Klar for lokal utprøving, men **ikke fullt teknisk klarert for commit**: den påkrevde Docker-kontrollen er fortsatt blokkert.

| Kontroll 26. oktober | Bekreftet resultat |
| --- | --- |
| Egen `npm ci` fra uendret låsefil | **94 pakker**. Node **24.19.0**, npm **11.17.0**, Vite **8.2.4**, Vitest **5.0.3**, Playwright **1.63.0**. Ingen avhengigheter fra hovedkopiens `node_modules`. Det tidligere gapet for låst installasjon er lukket for denne kandidaten. |
| Full enhetssuite | **2244/2244 i 130 filer**, 0 hopp, exit 0, **110,85 s**. `npm.cmd run test:unit -- --maxWorkers=2`. Den eksisterende kontrollen av alle 269 HTML-/JSON-fixturer rapporteres nå per fil; økt testantall er ikke 268 nye dekningsområder. |
| Målrettet personvern-/TimeEdit-/Ajour-kompatibilitet-/backup-/SQLite-utvalg | **386/386 i 5 filer**, 0 hopp, exit 0, **9,93 s**: `fixture-privacy`, `public-timeedit`, `ajour-compatibility`, `connected-backup-privacy`, `database-delivery` under `tests/unit` (alle `.test.js`). Overlapper fullsuiten og legges ikke til dens antall. |
| NIH-fixtur og personvernregresjoner | Begge foreleserfiltre har **14 syntetiske navn og 14 syntetiske verdier** samlet. Resultattabellen og øvrige fixturebytes er identiske med førrettingen; sammenligning i minnet fant 0 beholdte gamle filterpersoner/-referanser. Personvernfilen har **339 pass**, inkludert kontroll av hver HTML-/JSON-fixture. Uavhengig etterkontroll: **44 syntetiske tilfeller × to hjelpere = 88 pass** for begge filtre, etiketter, senere segmenter, omslag og attributter. |
| Produksjonsbygg | **85 moduler**, bestått. Eksisterende varsel om JavaScript-bundle over 500 kB består. |
| Sluttkjøring i nettleser | **224 tilfeller i 22 filer:** første sluttkjøring **217 pass / 6 feil / 1 hopp**, 24,0 min. Fem importprøver traff eksisterende tidsgrenser under langsomme lokale Vite-responser; én gammel test brukte et skjult oversiktsfilter. Etter presis navigasjonsretting bestod alle tre berørte filer **49/49**, 0 hopp, exit 0, 6,2 min, med én arbeider og uendrede tidsgrenser/assertions. **223 unike tilfeller bestått på tvers av kjøringene**; den ene runtime-only backupprøven kontrolleres separat nedenfor. Dette er et utvalg, ikke hele nettlesersuiten eller én grønn kjøring på 224. |
| Sluttkjøring Node/SQLite | `node tests/run-database-e2e.mjs`: **3/3**, exit 0. `node tests/run-tp-csv-persistence.mjs node main,correction-ui,corrections-ics`: **3 scenarioer / 10 UI / 10 direkte SQLite-kontroller / 3 gjenskapinger / 1 synlig backup-gjenoppretting**, exit 0. Hver UI-kjøring har ett pass, ingen hopp/flaky. Integritet `ok`, 0 FK-brudd. Ajour-tittel og fire statiske SVG-/favicon-filer ble kontrollert med eksakte bytes/MIME før og etter hver gjenskaping, seks klientkontroller. Den ellers hoppede `calendar-corrections-backup.spec.js` bestod her. |
| Separate produksjonsforløp | `bounded-workflow.spec.js`: **2 pass / 2 motsatte fasehopp**. `acceptance.spec.js`: **3 pass / 5 hopp** (tre motsatte fasehopp og to uttrykkelig avslåtte live-kildeprøver). Begge kommandoer exit 0, SQLite `ok`, 0 FK-brudd. Backup/gjenoppretting og bevaring etter gjenskaping inngår. |
| Visuell sluttkontroll | Faktiske kandidatbilder åpnet og vurdert ved **1440, 900, 390 px og 200 % tekst**, med tom, fylt og varslet tilstand. Alle fire berørte dialoger, kalender og importbekreftelse vurdert; tilhørende tester kontrollerer intern rulling, fokusretur, synlige handlinger, tekst/valg/åpne seksjoner og ingen horisontal dokumentoverflyt. 44 lokale bilder beholdes under `artifacts/ajour-final-2026-10-26/visual/`; de er ikke leveransefiler. |
| Isolert lokal oppstart | PowerShell-oppskriften nedenfor ble prøvd på **127.0.0.1:5190**, med egen tom SQLite-fil og seed av. HTTP 200 for helse, Ajour-tittel og fire SVG-/favicon-filer med eksakte bytes/MIME. Ved 390 px ble tittelutkast åpnet, redigert og avbrutt; tomtilstanden bestod omlasting. Egen testserver ble deretter stoppet. |
| Filutvalg og dokumentasjon | **730 leveransefiler**, inkludert nye Ajour-filer, kopiert fra arbeidskopien. SHA-256-kontroll fant **0 avvik** mellom hele hovedkopiens leveranseutvalg og kandidaten; alle **699 ikke-Markdown-filer** samsvarer også med det testede utvalget. Bare sluttdokumentasjon er oppdatert etter siste tester. **31 Markdown-filer / 447 lokale lenker / 81 ankre / 44 testreferanser**, ingen feil. `git diff --check` og separat whitespace-/konfliktkontroll av fem nye filer bestod; Git varsler fortsatt om forventet LF/CRLF-konvertering. HEAD og indekshash er uendret. |
| Docker | **Ikke kjørt:** Linux-motorpipe mangler, tjenesten er `Stopped`. Motoren ble ikke startet, fordi oppstart kan påvirke eksisterende drift. En ny isolert kontroll krever en tilgjengelig motor med kontroll på eksisterende tjenester; gamle Dockerpass erstatter ikke denne kontrollen. |

Nettleserutvalget under `tests/e2e` var `shell`, `tasks`, `design-final`, `daily-guidance-ux`, `simple-planning-flow`, `action-planning`, `connected-root-acceptance`, `connected-planner`, `dashboard-calendar`, `text-registration-exam`, `bounded-work-steps`, `bounded-assessment-fixes`, `bounded-export-programme`, `calendar-corrections-backup`, `calendar-viewport-corrections`, `calendar-file-flow`, `import-resolution`, `import-clarity-review`, `import-tp-journey`, `import-reimport-repair`, `ajour` og `review-corrections` (alle `.spec.js`). Omkjøringen omfattet hele `import-reimport-repair`, `import-clarity-review` og `review-corrections`. De **32 Ajour-tilfellene** bestod i første sluttkjøring. De undersøkte importsporene viste fortsatt lesetilstand, ingen registrerte sidefeil og opptil 4,27 s lokal workerrespons pluss avhengighetslasting. Dette dokumenterer tidsvariasjon i testmiljøet; ingen produksjonsendring eller utvidet tidsgrense ble brukt som løsning.

Førrettingen ble kontrollert i den kjørende syntetiske appen på egen port 5196 og i tidligere faktiske bilder. Ved 900 px gikk «DITT NESTE STEG» fra tre linjer til én med naturlig bredde; tidsvalg samles med semantisk feltgruppe og legend. Mobilens fylte intro gikk **181,5 → 65,6 px**, og Start flyttet **y 620,9 → y 504,95** i samme syntetiske tilstand. Påminnelser er roligere og står etter Start, uten gjentatte tilstandstekster eller tomme emneetiketter; forfalt, ferdig og levert beholdes som ulike tilstander. Onboarding viser oppgave med bare tittel som hovedvei og valgfri import med luft mellom handlingene.

Den nye tastaturprøven ved 390 px/200 % tekst påviste faktisk footeroverlapp i oppgavens details-/flervalgsfelt; scroll-padding er rettet. Onboarding bevarer nå både oppgave- og planåpneren for fokusretur, og «Tilbake» respekteres uten umiddelbar automatisk fremrykning. Uavhengig review fant også økter som falt ut når deres oppgaver lå utenfor de tre viste radene; deduplisering bruker nå bare faktisk viste oppgaver. Frister gjentas ikke for disse oppgavene, andre kommende frister beholdes. Aktivitetene viser eksisterende emne/rom og særskilte tilgjengelige knappnavn. Ukjent planleggingsgrunnlag viser oppgavens navn; tom/ferdig plan leder til registrering eller leveringsoversikt. Korte kalendermerker bruker mørk semantisk farge med minst 3:1 grafisk kontrast. Dette er tekniske rettinger, ikke studenttesting.

NIH-rettingen bevarer nødvendig emne-ID, `sid`, datogrenser og iCal-lenke. Begge filtrenes etiketter, verdier og attributter kontrolleres uavhengig, også etter en gyldig syntetisk etikett og i JSON-innkapslet HTML. Negative prøver fanger senere personsegmenter, ID-er, lenker og metadata uten å skrive personverdier i feilmeldinger. Fixturen har 75 tabellrader totalt, men selve resultattabellen har 62 rader, 30 hendelsesrader og 27 utfylte foreleserfelt. [Fixtureproveniensen](tests/fixtures/public-timeedit/README.md) forklarer avledningen. Dekningen gjelder kjente felt/kontrakter, ikke universell navnegjenkjenning i fritekst, bilder eller framtidige kilder. Det påviste filterhullet fra 25. oktober er rettet; tidligere skannerpass brukes ikke alene som lukkebevis.

Vesentlige mellomresultater: før review bestod **1972 enheter**, **114 målrettede prøver** og bygg. Første 21-filers nettleserutvalg ga **196 pass / 5 feil / 1 hopp**; fem utdaterte oversikts-/kalenderselektorer ble rettet med datakontrollene beholdt, og hele berørte fil bestod **11/11** separat. Tre feilaktige forventninger i nye reviewprøver ble presisert; alle 16 berørte tilfeller bestod samlet. Deretter ga fullsuiten **1975 pass / 1 tidsavbrudd**: én test samlet hele HTML-/JSON-korpuset under 5000 ms. Den er delt per fixture med identisk filtrering/hjelper/assertion og uendret tidsgrense; sluttkjøringen på 2244 tester bestod. Avbrutte kjøringer er ikke sluttevidens. Ingen datakontroller eller fixturer er hoppet over for å få grønt.

**Bevarte kontrakter:** `studieplanlegger:v1`, recovery-/utkastnøkler, backupformat v1, SQLite-fil/skjema/versjon, API-er, importidentiteter og ICS-UID-er (`@studieplanlegger.local`), `STUDIEPLAN_*`, Compose-tjeneste/volum og eksisterende mapper. Ingen navnebegrunnet datamigrering. **90 tekniske grunnlagsfiler**, inkludert alle 80 backendfiler, lagring, backup, kalenderimport/-eksport, oppgave-/planleggingsregler, Compose og package-/låsefiler, er byteidentiske med det lokale førgrunnlaget. Aktivt UI bruker Ajour; faguttrykket «Studieplanens kilde», kildeadresser og historiske dokumentnavn er beholdt med sin mening.

**Hele filutvalget er vurdert:** 730 filer og alle 298 fixturer ble kontrollert for kjente personfelt, kontaktdata, tilgangsmønstre og metadata, ikke bare endrede linjer. Den rekursive personverngarden dekker 269 HTML-/JSON-filer; ICS kontrolleres etter linjeutfolding, og DOCX/PDF har egne metadata-/strukturkontroller. Den eneste PDF-fixturen har sju sider, ingen Author/Creator/XMP-personfelt eller vedlegg og ingen person-/kjørehandlinger i den ene annotasjonen. Ingen nye uavklarte funn i dette avgrensede utvalget: øvrige mønstertreff ble klassifisert som organisasjonskontakter, akademisk navigasjon/filtre, syntetiske negative prøver eller mønsterfeil. Legitim attribusjon, lisenser, prosjektmedlem og lærerens original er bevart. Dette er ikke en universell personnavndetektor eller en garanti om alle framtidige kilder.

**Leveranseavgrensning:** produktkode, tester, minimale fixturer, fire SVG-er og lokale fonter/lisens inngår. Referanser, designprompter/-pakker, rålogger, databaser, sikkerhetskopier, skjermbilder og genererte bygg inngår ikke. Den ubrukte `public/study-focus-v2.png` er bevart lokalt under ignorerte `artifacts/ajour-final-2026-10-26/local-archive/`, og er utelatt fra kandidaten. En presis ignore-regel dekker Ajours standard backupfilnavn. Ingen lokal arbeidsfil er slettet permanent eller fjernet fra Git-indeksen. Tidligere NIH-verdier i Git-historikk er ikke omskrevet av denne arbeidskopirettingen.

**Historisk teknisk evidenspunkt i denne runden:** ny Dockeraksept var blokkert. Klient 29.8.0 fantes, men `desktop-linux` manglet `dockerDesktopLinuxEngine`-pipe, tjenesten var stoppet og ingen separat Linux-motor var tilgjengelig. Docker Desktop ble ikke startet fordi eksisterende tjenester med automatisk restart kunne berøres. Den senere [temaoppfølgingen](#emnepalett-og-mørk-modus--2026-10-26) dokumenterer bestått isolert Dockeraksept; blokkeringen gjelder ikke siste dokumenterte kontroll. Nettleserkjøringenes tidsvariasjon og eksisterende bundlevarsel er dokumenterte begrensninger, ikke skjult av omkjøringene.

Den prøvde PowerShell-oppskriften står i [README](README.md#isolert-lokal-utprøving-av-ajour). Bruk kandidatens appmappe, egen database, `HOST=127.0.0.1`, `PORT=5190` og `STUDIEPLAN_SEED=false`; fjern eventuell `STUDIEPLAN_SEED_JSON` i samme prosess. Den lokale hjelperen `ajour-followup-2026-10-26/preview.ps1` utenfor repositoryet utfører akkurat dette og bygger først. Ingen staging, indeksendring, commit, push eller oppdatering av driftscontaineren er utført i oppfølgingen.

Studentutprøving **SC-07**, personlig refleksjon, faktisk Outlook-import, godkjent proposal og overordnet sensorveiledning er fortsatt ikke dokumentert ferdig/identifisert. Lærerfeedbacken gjelder avgrensning, tydelig hovedflyt, sporbar kvalitetskontroll og ryddige fixturer. Sju-siders sensorvedlegg ble dokumentert lest i Ajour-runden **25. oktober**; tidligere fraværsnotater gjelder sine daterte runder. En lesepåstand fra tidligere arbeid er ikke en ny lesing 26. oktober.

Denne filen er kondensert på stedet; eksisterende seksjonsankre er beholdt. [Sporbarheten](../.docs/planning-artifacts/TRACEABILITY.md) knytter SC-/R-/Q-/S-ID-er til kode og tester. [README](README.md#isolert-lokal-utprøving-av-ajour) gir isolert oppstart, [IMPORT-COVERAGE](IMPORT-COVERAGE.md) detaljerer historisk kildeutvalg. Fixturpass, faktisk transport, syntetisk browser/SQLite/Docker og studentprøve er forskjellige bevis. Antall fra overlappende runder summeres ikke. Rapporter/bilder under `artifacts/` er lokale ignorerte bevis og følger ikke Git-klonen. Produksjonsbygget har et eksisterende varsel om stor bundle; ingen egen lint-/typecheck-kommando finnes.

## Ajour grensesnitt og databevaring — 2026-10-25

<a id="tidligere-kontroll-samme-dag"></a>

Historisk lokal Ajour-kontroll fra grunnlaget `9d3a1698db8b9c0a213d2448ec1abfa92893c2fb`, før oppfølgingen 26. oktober. V1, ukjent tid, separate fullføringer, godkjenning, angre og datakontrakter ble beholdt. De leverte PNG-referansene og `START_HER.md` var designgrunnlaget; en større designpakke manglet. Ordmerke, notatbok og dekor ble gjenskapt som lokale SVG-er; eksisterende Manrope/lisens ble brukt.

| Kontroll | Faktisk resultat 25. oktober |
| --- | --- |
| Full enhetssuite / bygg | `npm.cmd run test:unit -- --maxWorkers=2`: **1960/1960 i 130 filer**, exit 0, 43,48 s. Bygg: **85 moduler**, exit 0; eksisterende bundlevarsel. |
| Playwright | **166/166 i 17 filer**, ingen hopp/flaky/feil, exit 0. Egen Vite-prosess på 5192 måtte stoppes etter at arbeiderne var ferdige før rapport/exit kom; ingen assertions eller tidsgrenser ble endret. |
| Node/API/SQLite | `node tests/run-database-e2e.mjs`: **3/3**. `node tests/run-tp-csv-persistence.mjs node main,correction-ui,corrections-ics`: **3 scenarioer, 10 UI-/10 SQL-kontroller, 3 gjenskapinger og 1 synlig backup/restore**. Integritet `ok`, 0 FK-brudd. |
| Produksjonsforløp | `bounded-workflow.spec.js`: **2 pass / 2 fasehopp**. `acceptance.spec.js`, live av: **3 pass / 5 hopp** (3 fasehopp, 2 livehopp). Tittel alene, plan/utfall/angre og eksakt backup/restore kontrollert. |
| Kompatibilitet / merkevare | Faktisk syntetisk backup fra før endringen gjenopprettet, omlastet og eksportert eksakt. Nøkler, backupversjon, relasjoner og ICS-UID-er kontrollert. Bygd Node-klient beholdt eksakt tilstand/revisjon ved restart; favicon og tre SVG-er hadde HTTP 200, riktig MIME og identiske bytes. |
| Visuelt / dokumentasjon | Åpnede bilder ved 1440/900/390 px, 150/200 % tekst, tastatur/fokus og redusert bevegelse. Siste uavhengige runde: **24 måleposter / 559 tekstkontrastobservasjoner**, ingen påviste brudd/overflyt i utvalget. Filterkant **4,15:1**, gradientklokketekst minst **8,39:1**. **397 lenker, 73 ankre, 11 dokumenter**; README-oppstart på 5190 ga HTTP 200 for API/tittel/4 SVG-er. |
| Docker / avhengigheter | Docker **ikke kjørt**: `desktop-linux` manglet motorpipe, tjenesten var stoppet. Desktop ble ikke startet. Eksisterende installasjon var Node **24.19.0**, Vite **8.2.2**, Vitest **5.0.0**, Playwright **1.63.0**; ingen ny `npm ci`. Låsefilen angav Vite 8.2.4/Vitest 5.0.3. |

De 17 nettleserfilene under `tests/e2e` var `shell`, `tasks`, `design-final`, `daily-guidance-ux`, `simple-planning-flow`, `action-planning`, `connected-root-acceptance`, `text-registration-exam`, `bounded-work-steps`, `bounded-assessment-fixes`, `calendar-viewport-corrections`, `calendar-file-flow`, `import-resolution`, `import-clarity-review`, `import-tp-journey`, `import-reimport-repair` og `ajour` (alle `.spec.js`). Produksjonskjøringene er separate; overlappende kontroller summeres ikke.

Review rettet filterkontrast, mobilens Mer-markering (arvet `scaleX(0)`), tomt planforslag, synlig tastaturåpnet begrunnelse og kalenderens brukbare rulleflate. Første nettleserrunde hadde **152 pass / 8 feil**: tre forventningsfeil ble gjenskapt på gammel klient; leserekkefølge, kalenderplass og testnavigasjon ble rettet med data-/300 px-krav beholdt. To importfeil oppstod under samtidige kildeendringer; stabil sluttkjøring bestod. En fixturetest traff uendret 5000 ms-grense under parallell belastning, og hele suiten bestod alene. Produksjonstestens daterte data fikk fast testklokke uten svakere tids-/kapasitetsassertions. Reviewens to målrettede ikon-/markørforventningsfeil er ikke sluttresultater.

Mobilens Start lå ved **y 621–665**, oversikten var 2389 px mot baseline 2254; desktop 1763 mot 2210 px. Disse målene gjelder 25. oktober og blir ikke bevis for oppfølgingen. NIH-fixturens **to usyntetiserte foreleserfiltre** og manglende testdekning stod fortsatt åpne denne dagen. Den godkjente oppfølgingen 26. oktober overtar dette funnet. Sensorveiledningens sju sider ble lest i Ajour-runden; tidligere fravær samme dag gjaldt publiseringsrunden nedenfor.

Lokal evidens ligger under ignorerte `artifacts/ajour-2026-10-25/`, blant annet `visual/review-final/overview-populated-{1440,390}.png`, `browser-reviewed.json` og `runtime-1792958724668/result.json`. Ingen staging, commit, push eller produksjonsoppdatering inngikk. Den tidligere pre-Ajour-kontrollen samme dag hadde 1941 enhetstester, 32 nettleserpass og 2 Node + 2 Docker-scenarioer, separat nedenfor.

## Publiseringskontroll — 2026-10-25

<a id="rettet-innhold-og-kontrollgrunnlag"></a>
<a id="nye-kandidatresultater"></a>
<a id="review-omkjøringer-og-begrensninger"></a>
<a id="tidligere-publisering--f1a5863-2026-10-25"></a>
<a id="kandidatresultater-for-den-tidligere-publiseringen"></a>
<a id="review-og-daværende-tekniske-begrensninger"></a>
<a id="gjenbrukt-historisk-evidens-ved-den-tidligere-publiseringen"></a>

**Historisk publiseringsgrunnlag før Ajour:** `9d3a1698db8b9c0a213d2448ec1abfa92893c2fb`. Denne kontrollen rettet `f1a5863`; den er verken publisering av Ajour eller en ny passering for dagens arbeidskopi.

Personverngjennomgangen erstattet **207 feltsegmenter i seks kalenderfixturer**, fjernet to unødvendige HGUt-personavsnitt og ni Sámi-forfattermetadatafelt. ID-er, tider, rom, grupper, parserstruktur, attribusjon, lisenser og prosjekt-/læreropplysninger ble bevart. Alle **298 fixturer** (171 HTML, 98 JSON, 11 ICS, 4 CSV, PDF, DOCX, JS og 11 README-er) ble kontrollert, inkludert utfoldede ICS-felt, senere/gjentatte segmenter og innkapslet innhold. Kontrollen var avgrenset, ikke en universell navnedetektor: NIH-filterhullet ble påvist senere. Ordinær retting sanerer ikke Git-historikk.

Kalenderrettingen normaliserte støttede symbolverdier uten å endre UID/fritekst, avviste flere UID-er, motstridende komponenter, DTEND sammen med DURATION og uforenlig UNTIL/DTSTART. Ugyldig nyere tid kan ikke erstatte gyldig eldre komponent; TP-JSON-datoer valideres før normalisering. Delvis input kan ikke begrunne sletting; eksameners publiseringsgrenser bevares.

| Kandidat / kontroll | Historisk sluttresultat |
| --- | --- |
| Utvalg / installasjon | **726 filer**, separat Git-indeks i den daværende publiseringsrunden; egen `npm ci`, 0 rapporterte npm-sårbarheter den dagen. Node **24.19.0**, npm **11.17.0**, Vite **8.2.4**, Vitest **5.0.3**, Playwright **1.63.0**. |
| Enheter / bygg | **1941/1941 i 129 filer**, ingen hopp, exit 0; bygg **85 moduler**, exit 0, eksisterende bundlevarsel. |
| Sju Playwright-filer | **32 pass, 3 tilsiktede hopp, 0 feil/flaky**, exit 0. To hopp kjøres i runtimeutvalget; separat terminpersistens ble ikke gjentatt. |
| `node tests/run-tp-csv-persistence.mjs both corrections-ics,closure-ics` | **2 Node + 2 Docker-scenarioer**, **14 UI / 14 SQL**, **4 gjenskapinger / 2 synlige backup/restore**, exit 0. Hver UI-kjøring nøyaktig ett pass, ingen hopp/flaky. SQLite `ok`, 0 FK-brudd, **172** runtimefilhashverdier samsvarte. |
| Leveranse / review | Alle 726 filer formålsvurdert og kontrollert for tilgangsmateriale, private stier, metadata og artefakter. Lenker/ankre, testreferanser og krav-ID-er bestod; **15 navngitte tester** finnes. Tre reviewlag og oppfølgende **39 kalender-/25 personvernprøver**. |

Browserutvalget var `calendar-file-flow`, `import-calendar-closure-raw-validation`, `import-calendar-closure-ics`, `calendar-corrections-ics`, `connected-institutional-calendar`, `calendar-import-ui` og `connected-root-acceptance` under `tests/e2e`. Kandidattre `fc502f99942463451c6d4076b8205f6e4ed8c7ae`; **695 ikke-Markdown-filer** hadde samlet SHA-256 `0162732bb1c2807cc17240278797de5fd4105c96f9249db82ff190ee361c1fdd` (sortert repo-sti→bytehash-JSON). Bare Markdown ble oppdatert etter testing.

Materielle mellomfeil: kandidat 1 hadde 1904 enhetspass og to varsel-lokatorfeil; kandidat 2 hadde 1931 pass og feil kildeposisjonsforventning etter delvis import. Runtimeforsøkene stoppet på disse. Kandidat 3 fikk **1940/1941** fordi ny varighetsvalidering kom før etablert navn/ID-feil; rekkefølgen ble rettet. Hele sluttutvalget ble deretter kjørt fra kandidat 4. Ingen bevaringsassertions ble svekket. TP-avlysning med bare ustabil eksport-ID krever fortsatt kildeavklaring; full iCalendar/iTIP eller nasjonal dekning ble ikke lovet.

**Tidligere publisering `f1a58631b10a5e35cfd43ed50236d7cd97a5aa22`, samme dato:** 725 filer, tre `88d19ca128c65d94282bf5a2dbf74d2e543fedc4`, 692 ikke-Markdown-filer med hash `e6d439e58b3131586828ab993e08bedc0f88121c0221cd8bda481e29ed12ca52`. Ren installasjon, **1818 enheter**, bygg, **3 databaseprøver**, isolert Compose og **2 arbeidsflytpass / 2 fasehopp**. Browser: **87 pass / 1 feil**, deretter berørt fil **14/14**; **88 unike pass** samlet, ingen påstand om én grønn kjøring. **4 Node + 4 Docker-scenarioer**, 30 UI/30 SQL/8 gjenskapinger/6 backupkontroller bestod på ny hel kjøring. **385 lenker/ankre, 63 testfilreferanser og 15 testtitler** ble kontrollert.

Der avdekket første `npm ci` fem advisories; Vite/Vitest/lås ble oppdatert før sluttkandidaten. CRLF-konvertering brøt en syntetisk CSV/backup-hash: presis `.gitattributes`-regel beholdt LF, 45 berørte enheter og hele runtimeutvalget bestod etterpå. Delt Playwright-output slettet en aktiv trace; egen resultatmappe løste omkjøringen. Review strammet inputhjelp og helsetidsavbrudd; negativ prøve feilet som forventet etter **30,176 s**, ryddet prosess/port. Etterpå bestod 1818 enheter, bygg, 20 berørte browserprøver og ny hel runtime. Fire da åpne kalenderfeil (symbolcase, identitetskonflikt, tidskombinasjoner og TP-rådato) ble rettet i den senere 1941-kandidaten ovenfor. UiS-profilavsnitt ble minimert med parserguard.

Sensorveiledning og godkjent proposal var **ikke tilgjengelige i disse publiseringsrundene**. Dette avviker fra senere dokumentert lesing i Ajour-runden samme dag. Eldre resultater fra 24. oktober ble brukt som datert støtte, aldri lagt til nye tall; deres kilde-/byggmanifest omfattet ikke tester/fixturer. Egne ressurser ble ryddet, driften ble ikke oppdatert. Hardt signalavbrudd kan fortsatt omgå runtimekjørerens `finally` og kreve kontroll av egne ressurser.

## Consolidated import and calendar closure — 2026-10-24

<a id="corrected-behavior-and-evidence-map"></a>
<a id="independent-review"></a>
<a id="acceptance-recorded-on-2026-10-24"></a>
<a id="measurement-and-evidence-boundaries"></a>
<a id="preservation-and-running-version"></a>

Den godkjente rettingen samlet tittel-/emnegjenkjenning og ni tidligere kalenderpunkter. Uavhengige syntetiske førprøver viste tap av sene RDATE-er, avlysninger med ekvivalente UTC/TZID-tider, feil termin over januar, for kort DURATION-periode, brøkdelseksport og utydelig høsttime. Rettet kode bevarer kvalifiserte emne-/kildeidentiteter og manuelle valg, ber én gang om uklare eldre koblinger, gjenkjenner entydige emnekoder gjennom hele tittelen uten eksamensgjetting og viser importopphav. Eksport forklarer utelatelser, bevarer DATE/eksklusiv slutt og utelater ikke-representerbare brøkdeler uten avrunding. Eksplisitt CSV-ID-valg håndteres; personlige aktiviteter lager ikke unødvendige emneforslag.

Tre reviewlag, 13 funn gruppert i ti rettinger, samt etterkontroll av all-day-redigering og uferdig native tallutkast ble gjennomført. Summaryoppdatering skjer etter typing; validering er fortsatt umiddelbar ved change/submit. Skjult numerisk utkast, lenkede referanser, fokus og ugyldig-input/no-write ble bevart. Ukjent tidssone håndteres som synlig avvist komponent med gyldige søsken beholdt, ikke som stille aksept.

| Sluttkontroll | Resultat |
| --- | --- |
| Enheter / bygg | **1818/1818 i 129 filer**, exit 0, 131,301 s; **85 moduler**, exit 0, kjent bundlevarsel. |
| Relevant Vite-utvalg | **175 pass / 18 runtimehopp / 0 feil**, exit 0. Inputytelse, råvalidering og eksportkanter er Vite-bevis; runtime gjentar ikke alle kantene. |
| Produksjonsmatrise | **17 Node + 17 Docker-scenarioer**, **124 UI / 124 SQL**, **34 gjenskapinger**, **22 synlige backup/restore**. Alle 18 hoppede testidentiteter kjørt; hver akseptert invocation hadde ett pass, 0 hopp/flaky/feil. SQLite `ok`, 0 FK-brudd; **172 runtimefilhashverdier** samsvarte ved hver Docker-start. |
| Dokument / visuelt | **253 lokale lenker**, scoped scan av fem syntetiske fixtures og whitespace bestod. Åpnede desktop-/390 px-/150%-bilder, tastatur, synlig fokus og ingen målt horisontal overflyt. Bekreftelse under avklaring: desktop y 49,0 / stor mobiltekst y 104,2. |

Runtime er den kontrollerte unionen av **11 Node** fra `tp-csv-1792856913535-0590f615`, **6 Node** fra `tp-csv-1792858251721-4c211577` og **17 Docker** fra `tp-csv-1792858265703-5496bc86`. Første runner stoppet fordi termfilteret også valgte en hoppet test. Filkvalifiserte filtre og listekontroll av **35 selektorer** sikret ett riktig treff; ingen zero-skip-guard ble svekket. Siste to resultater hadde `passed:true`, men PowerShell-stderr-wrapper ga exit 1, gjenskapt med minimalt exit-0-program; ingen ytre exit-0-påstand for dem.

158 browserkildefiler: manifest `ade3b5544119e3d01bea7d03dee10eab110cd9a8991b7b0665a4c927c48b8662`; 172 kilde-/pakke-/byggfiler: `47444dd8348aa60b72964d2daa9fa6a0d49b5c05a9268c54127543ed9da71935`. Disse omfatter ikke tester/fixturer/testkonfigurasjon. Ny koblingsprøve beholdt 1 emne/4 hendelser; eldre reparasjon 4 emner/samme 7 ID-er; serieprøve 13 hendelser/2 avlysninger; eksport 5 lagrede/3 eksporterte/2 forklart utelatt.

Tekniske mål: emnekoder **1/5 → 5/5** relevante titler, to-kode-tittel fortsatt tvetydig; 11-rads tidsflyt fortsatt **5 handlinger / 1 beslutning / 0 skrevne verdier**. Ingen studentmåling. [RFC 5545](https://www.rfc-editor.org/rfc/rfc5545) ligger til grunn for hele sekunder/DATE-semantikk. Uendelig gjentakelse forblir avgrenset, utilstrekkelig eldre identitet gir spørsmål, og eksakte ikke-støttede eksportformer utelates synlig. Ingen ny live TP-, Outlook-, privatoriginal- eller fysisk diskfeilprøve. HTTP 500 var injisert før SQLite; 409 kom fra reell konkurrerende skriving. Sensorveiledningen var utilgjengelig i denne runden. Driftscontainer/kode var uendret og eldre; 36 eide porter og testressurser ble kontrollert ryddet. Ingen Git-skriving eller deploy.

## Calendar corrections — 2026-10-24

<a id="reproduced-defects-and-bounded-corrections"></a>
<a id="same-scenario-technical-measurement"></a>
<a id="verification-checkpoints"></a>
<a id="final-code-after-independent-review"></a>

Seks reproduksjoner før retting: feil slettingskvittering (`undefined`/eldre tombstone), blandede navnekollisjoner, gammelt punktvalg etter endret kildetid, normalisert ugyldig ICS-dato, feil/manglende TRANSP og bekreftelse utenfor skjermen (desktop−449,8 px/mobil−511,3 px). Rettet nye slettetransisjoner, kvalifiserte navn, optional kilde-tidsproveniens, rådato/typevalidering med gyldige søsken beholdt, kapasitetsbasert TRANSP og sticky bekreftelse. [RFC5545](https://www.rfc-editor.org/rfc/rfc5545) underbygger rådato/tid/transparens og offset før vårgap; Outlook ble ikke prøvd.

Samme 11 syntetiske rader: **5→5 handlinger,1→1 tidsvalg,0→0 skrevne verdier**; bekreftelse ble synlig på desktop 390 px/150%-tekst. Ingen klikkreduksjon/studenttest. Review rettet DATE/DATE-TIME-mismatch, linked emnenavn med draftretur og 18 ugyldige/4 gyldige legacy-tidsproveniensvarianter. Slutt **1711/1711 /124 filer**,47,14 s; bygg 85 moduler; browser **64 pass/4 runtimehopp**, exit 0. ICSfokus 49/decisions 39 inngår, ikke ekstra unike totalsuiter.

Runtime `tp-csv-1792841715061-d90f7d14` med `node tests/run-tp-csv-persistence.mjs both`: **52 UI /52 direkteSQL /16 eksakte gjenskapinger**, åtte scenarioer i begge runtimer, **19 kildefil/bygghasher per Dockerstart**, exit 0. Fire Vite-hopp ble kjørt her. Full envelope/IDs/notater/utelatelser og synlig backuprestore; SQLite `ok`,0 FK-brudd. Scenarioene var 30 radsCSV, tidsunntak, eldre blandet, brukerpunkt, slett/undo, endret tid/eksport, like koder fra flere institusjoner og delvis ugyldig ICS.500 før database/reell 409, ingen fysisk diskfeil.

Første runtime stoppet på testnavnfilter som valgte 0 backuptester; streng runner avviser nå 0 utførte/hopp/flaky, og hele matrisen ble gjentatt. Mellomresultater 1685/59 er ikke sluttresultater. Åpnede sluttbilder og 220 lenker/whitespace bestod. Alle egne containere/åtte volumer/image og porter ryddet. Produksjonskode/uvedkommende data/Git var uendret.

**Da åpne punkter**, senere behandlet i [samlet closure](#consolidated-import-and-calendar-closure--2026-10-24): sen RDATE ved uendelig serie, UTC/TZID-avlysning, eksplisitt CSV-ID-kolonne, personlig CSV-emnehint, høst/January-termin, brøkdelseksport, gjentatt høsttime, lang DURATION-dekning og feil Manuell-opphav. Historiske grenser er ikke påstått gjeldende uløste feil. Sensor-PDF var utilgjengelig i denne runden; privat liktid-rads mening var fortsatt brukerens valg.

## Import clarity final review — 2026-10-23

Etterreview beholdt tidsvalg, kilde/campus-etiketter, synkronisert samtykke, referanseinstitusjon, radfokus, native uferdig tallutkast og lukket løst gruppe. Kvitteringsundo avvises etter nyere lagret endring med hele konvolutten bevart.67-browserkjøring ga 66 pass/1 reell fokusbeskyttelsesfeil som holdt ferdig uten-emne-rad åpen; rettet med originalassertion+fokusassertion, fem berørte pass. **67 unike pass på tvers av løp**, ikke én grønn 67-kjøring.

Slutt **1623/1623 /122 filer**,63,16 s, bygg 85 moduler, exit 0. Runtime `tp-csv-1792757126201-99026fb1`: **24 browser /8 gjenskapinger /17 hashverdier**, allepass/exit 0. Node+Docker hoved/unntak/blandet/punkt bevarte henholdsvis 30/3/3/4 hendelser. Separat TP-/ICS-bevaring **10/10**, exit 0. Sluttmåling og ni bilder bekreftet tallene ovenfor; etter font/layoutventing var 390 px/150%-bildet lesbart. Decimalminutter og gammelt Manuell-badge var da grenser. Rådatovalidering/transparens var fortsatt utsatt til 24. oktober; ingen privatCSV-/Outlook-/liveTP-/studentprøve.

## Import clarity implementation — 2026-10-23

Felles fil/lenke fikk uttrykkelig **Vis forhåndsvisning → Importer valgte**, kompakte emne-/institusjonsvalg, punkt/rett/utelat, tydelig kvittering og guarded undo. Bevaringsrettinger omfatter kjent og uttrykkelig ukjent institusjon, gjentatt metadatafri import, reservert proveniensnøkkel og ingen tittelbasert eksamensgjetting i dokumentimport.

Regresjon først: ny modell 9 røde/1 grønn, synlig Importer-inngang rød; senere røde punkt→intervall-/fokusprøver 2/2 ble grønne etter produktretting. Reell runtimefeil ved **andre identiske metadatafrie import** avviste dobbel kildeentry; reservert proveniens ble rettet, med eksakt trippelreimport-regresjon. Full førreview **1618/1618 /121 filer**, bygg 85 moduler, exit 0. Berørt 53 browserutvalg var 52 pass/1 gammel disclosureforventning, deretter 1/1; samlet 53 unikepass, ikke én grønn kjøring.

Runtime `tp-csv-1792754335948-4938ad77`: **24 browser /8 eksakte gjenskapinger**, fire scenarioer i Node og Docker (30 rad, tidsunntak, blandede institusjoner, brukerpunkt),17 hashverdier per Dockerstart, exit 0. Syntetisk 500/reell 409 beholdt konvolutt; ingen diskfeilprøve. Avbrutt tregt Dockerbygg ryddet eget image, ikke pass. En 1616-testkjøring med wrapperexit 1 er heller ikke vellykket kommando.

Før/etter gyldigCSV **3→4 handlinger,7→3 knapper,0→0 navn**; liktid **4→5 handlinger,8→1 synlige felt**, én nødvendig beslutning i begge. BlandetICS9→2 knapper. Preview er den tilsiktede ekstra handlingen. Åpnede desktop 390/150%-bilder og målt 390 px-bredde viste ikke horisontal overflyt; én rask viewportcapture var uavklart og utløste ingen CSS-endring.224 lenker bestod. Review aksepterte fokus/nativeutkast/samtykke-/gruppepreservering, senere sluttføring nedenfor. Ugyldig ICS-dato og transparent intervall-eksport ble **påvist og utsatt denne dagen**, senere rettet 24. oktober. Ingen privat-/live-/studentaksept, sensor-PDF manglet.

## Import clarity investigation — 2026-10-23, before implementation

Før implementasjon: syntetisk modell beviste tapt kvalifisert match når samme ICS-source/UID mistet institusjonsmetadata, og manglende synlig/proveniensbevart brukerpunkt. Felles institusjonsvalg **bevarte allerede kjente råverdier**; privat overskriving ble ikke bevist. Sekunder var allerede bevart. Korrigert synlighetsmåling utelot skjulte detailsdescendenter: gyldig 30-rads CSV **3 handlinger/0 navn/7 knapper**, liktid-variant 4 handlinger/8 synlige felt/29 lagrede ved utelatelse; blandet 6 hendelser/3 emner 9 knapper. Tall er teknisk baseline, ikke studentprøve.

Offentlig statisk TP-klient viste excel.php-eksport, parser med sekunder og én minuttformatter; det beviser ikke eksportrunding/private rader. DockerEngine 29.8.0 var igjen tilgjengelig, og fem produksjonshasher samsvarte med daværende baseline, så gammel deployment var ikke etablert som årsak. Ingen runtimeaksept eller produksjonsendring her. Sensor-PDF utilgjengelig.

## Recognized TP CSV main-flow repair — 2026-10-23

[Den kuraterte offentlige formatkontrakten](../.docs/implementation-artifacts/tp-csv-format-contract-2026-10-23.md) avgrenser TP-CSV-rettingen. Radvis tittel-fallback og tydelig provisoriske navn fjerner unødvendig navneregistrering; positive intervaller beholder sekunder. Manglende/ugyldig/lik slutt trenger positivt punktbevis eller uttrykkelig valg. Eldre feilaktige punkter blir ikke automatisk bekreftet.

Samme 30-rads bytes gikk fra 1 emne+8 aktivitetsnavn til **0 skrevne navn**; én umerket liktid-rad krever fortsatt utelatelse/korreksjon (29 lagret), mens gyldig hovedfixture lagrer 30. Slutt **1594/1594 /120 filer**,60,55 s, bygg 85 moduler, exit 0. Vite **70 pass /2 runtimehopp**, pluss separat oppdatert hovedreise 1/1 = **71 unike sluttkodepass**, ikke én grønn fullsuite. Node-runtime **8 kontroller**,6 browser+2 gjenskapinger, hoved 30 hendelser og unntak 3 lagrede/4 utelatte, eksakt konvolutt/500/409/frisk browser. Resultat `tp-csv-1792739640783-55015f19`.

Reelle korrigeringer underveis: automatisk preview lekket til generisk oppgave-CSV og ble avgrenset; reread beholdt gamle kontroller under parsing og lukket nye detaljer, gjenskapt i **76/77**-kjøring og rettet.58-checkpoint 53 pass/5 feil og avbrutt 115-forsøk er ikke pass. PowerShell npm-shim/stderrproblemer ble skilt fra testexit. Review rettet navnstatus, nøytrale tidsnavn, avkoding og tekniske konflikter. Åpnede desktop 390/stor tekst-bilder og faktisk kalenderdialog beholdt 11:00:07–11:00:17, fokus/undo/IDs; decimalminuttpresentasjon var fortsatt gammel.

Dockerforsøk **exit 1,0 tester,0 ressurser**: Linux-engine-pipe manglet, sist `tp-csv-1792740032238-48aaf91f`; Dockeraksept av denne revisjonen var da uutført.177 lenker/whitespace bestod. Ingen privat original, liveTP, fysisk diskfeil eller studenttest; sensor-PDF manglet. Senere daterte Dockerresultater må leses separat.

## Reopened source lifecycle blocker - 2026-10-21

<a id="approved-source-continuation-implementation"></a>
<a id="source-continuation-verification-checkpoint"></a>
<a id="continuation-review-and-final-acceptance"></a>

Etter senere brukerfeil ble A/B/A-kildeversjoner gjenskapt rødt: opprinnelig hash-ID ble funnet med forventet revisjon 0 mot faktisk 2, og totalsummer ble misvisende null. Kjente institusjoner kunne også gå tapt ved manglende rawmetadata. Dette gjenåpnet flyten; gamle pass var ikke tilstrekkelig.

Rettet entydig opprinnelig hash-ID/reell revisjon, kvalifisert institusjonsarv og målbundet samtykke, isolert neste-fil-intensjon og avbrutt sen lookup. Ingen global migrering. Tre reviewlag/10 funn førte til read-only referanseinstitusjon, consentguard, feil-lest-kildeintensjon og live oppdatert mål. Slutt **1554/1554 /117 filer**,32,53 s, bygg 85 moduler; **126/126 browser**,3,4 min, exit 0. Runtime `continuation-1792599126515-a12794`: **8 kontroller**,6 synlige+2 gjenskapinger,11 Dockerhashverdier, eksakt 108 ICS/30 CSV/8 TP, restore/omit/undo/500/409/frisk browser. A/B/A gir 0 identitets-/restaureringskontroller og 0 uavklarte rader; faktisk sletting av 1 emne+27 hendelser krever fortsatt valg.

Mellomkontroller 1551/117 browser og 1554-før-siste-målfiks var ikke sluttkilde. Tidlige testkontrollfeil (selectOption på tekstfelt, feil label, lukking av åpent details) ble rettet med assertions beholdt. Stale-/ownership-tester bruker ekte renderer i isolert vert; øvrige komplette appformer. Åpnede desktop/390 px/stor tekst-bilder,160 lenker/whitespace bestod. Sensorveiledning utilgjengelig; brukerens 88-tall/privatoriginal/all-format/studentnytte er ikke verifisert. Produksjon/Git uendret.

## Reimport repair final verification - 2026-10-21

<a id="proven-causes-correction-and-remaining-decisions"></a>
<a id="production-build-persistence-and-visual-checks"></a>
<a id="intermediate-failures-retained-as-evidence"></a>
<a id="independent-review-and-post-review-corrections"></a>
<a id="final-code-and-preservation-record"></a>

Unik fil-/kilde-/tid-/emneevidens forsoner eldre tittelbaserte nøkler uten generell migrering eller sletting. Kolonnevalg etter 30 lagrede aktiviteter krever nå **0 matches**, samme IDs beholdes. Like kolonner slås sammen, reelle ulike valg forklares med daterte eksempler. Slettede emner/hendelser krever eksplisitt samlet keep/restore; manuelle konflikter og usikre gamle utelatelser forblir valg.108-hendelses ICS-kontroll passerte før og etter; brukerens rapporterte 88 avklaringer er ikke forklart.

Slutt: **1543/1543 /116 filer**,72,91 s; bygg 85 moduler; **107/107 browserprøver**,4,1 min, exit 0 etter at eid Vite-child ble stoppet under teardown. Node/Docker **8 kontroller** (6 synlige runs +2 eksakte gjenskapinger), exit 0,11 hashverdier samsvarte;108 ICS+30 CSV+8 syntetiske TP-hendelser, lokale endringer, undo,500/409 og frisk browser bevart. Tre reviewlag/ni grupper rettet blant annet legacynegativer, valgt kandidat utenfor 20 treff og riktig lokalt fristformat.182 fokusunits/24 browser og egen 2/2 tekstkontroll er overlappende bevis.

Materielle feil: tidlig harness antok feil tomtilstand/tastaturretning; bred 467-kjøring ble avbrutt med gamle `unblocksWaiting:false`- og statuslokatorfeil utenfor oppgaven.93-prøve checkpoint 90 pass/3 feil og 107-checkpoint 106 pass/1 feil var ikke grønne; ordlyd/disclosures ble rettet og siste stabile kilde gjentatt. En tidligere passing rapport manglet terminalexit, derfor ny 107-kjøring. Åpnede 1365/390 px/150%-bilder;156 lenker bestod. Evidens `artifacts/import-reimport-repair-20261021/repair-1792593436817-c988fb/`. Sensor-PDF utilgjengelig, ingen private data/liveaksept/diskfeil/studenttest/deploy.

## Reimport repair investigation — 2026-10-21

Planleggings-/reproduksjonskontroll, ikke akseptanse: to uavhengige synlige CSV-prøver feilet (like titteletiketter og **30 individuelle matches** etter kolonnebytte). ICS-kontroll **1/1** beholdt eksakt 108 hendelser/4 emner/19 punkter; institusjonsvalg alene forklarte derfor ikke brukerens rapport. Modellprøver viste legacy-scope/tittelhash/dangling targets, uten bevis for brukerens historikk. To starts feilet før tester på Windows-reservert port 62137; eid 5197 brukt uten systemendring. Ingen runtime/privatdata/studenttest; senere godkjent retting nedenfor overtar status.

## Import usability continuation — 2026-10-21

<a id="established-causes-and-corrections"></a>
<a id="technical-checks"></a>
<a id="independent-review-and-corrective-regressions"></a>
<a id="actual-public-observations"></a>
<a id="runtime-evidence-boundaries"></a>
<a id="preservation-and-deployment"></a>

Rettet full institusjonsliste, publiserte TP-grupper, CSV-alias/avkoding, eksakte sekunder/millisekunder, navne-/kildeopphav og SQLite-undo som tidligere sammenlignet objektnøkkelrekkefølge. Ulike CSV-er med gjenbrukte generiske ID-er krever uttrykkelig kildetilknytning; ukjent er ikke gjettet. Submillisekunder avvises synlig.

Slutt: **1517/1517 enheter i 115 filer**, 80,02 s; bygg **85 moduler**; **138/138 browserprøver**, 152,930 s; alle exit 0. **6 runtime-scenarioer** (TP først, CSV først og lik-periode-sammenligning i Node og Docker) bevarte eksakte konvolutter, IDs, tider, unntak og navn over reimport/gjenskaping. Førsteimportene endte med 6 emner/24 hendelser; sammenligningen 2/22. **16 containerhashverdier** samsvarte. Evidens: `artifacts/import-usability-20261021/` og `studieplan-usability-1792585054079-d595f540`. Tre reviewlag; 16 funn før gruppering/13 rettinger, ingen utsatt.

Vesentlige feil: retry-klikk forsvant ved DOM-flytting på blur; samme foreldrerelasjon beholdes nå. CSV-lesetimeout og to 15 s reload-stopp ble ikke forklart sikkert; native testproxy med 87 reloads unngikk global Playwright-interception uten økte grenser. Kvadratisk testmatcher ble erstattet med strengere ordnet prefixlikhet; produktets eksklusjonssøk, emnesøk og identisk tidskonvertering ble målt og effektivisert. 5900-rads prøven beholdt femsekundersgrensen (3916,9→1153,3 ms i separate målinger, ikke kontrollert benchmark). En senere runtimefeil kom fra ventende scroll-skriving etter bildeendring; harness venter nå på layout/font/persistens og sammenligner hele konvolutten etter browserlukking.

Åtte ugrupperte aktiviteter gikk fra **9 til 2** valg-/lagringshandlinger; publisert åttemedlemsgruppe krevde også 2. Faktiske begrensede offentlige oppslag: UiO IN1000 **313 aktiviteter uten publiserte grupper**, HiMolde IBE160 **30 med publiserte grupper**; dette er transport/normalisering, ikke lagrede live-reiser eller privat CSV-bevis. Docker bruker produksjonsklient/API/SQLite, mens vertens samme importmiddleware får syntetiske upstreams. HTTP 500 er ikke diskfeil; 409 er reell revisjonskonflikt. Åpnede desktop/390 px/150%-bilder og bredere 200%-tastaturtester bestod. Sensorvedlegg var utilgjengelig; ingen studentprøve, Git-skriving eller deploy.

## Import usability: focused implementation checks — 2026-10-21

Implementasjonens separate røde alias-/åtte-aktivitet-prøver ble fulgt av **139/139 /5 filer**, deretter **155/155 /5 filer** og browser**22/22**, exit 0. SQLite-nøkkelrekkefølge, CSV-ID-kollisjon, senere norske eksempler og avviste submillisekunder inngår. Mellomløp 21/22 fant retry-knapp som ble flyttet på blur; samme originaltest passerte etter retting. Syntetisk førkode-harness beholdt eksakte ICS/CSV-identiteter. Disse overlappende fokusresultatene er ikke tillegg til den koordinerte 1517-/138-testakseptansen. Privat CSV/TP-ekvivalens og studentnytte uverifisert.

## Final blocked-import continuation — 2026-10-19

<a id="causes-corrections-and-visible-evidence"></a>
<a id="final-verification"></a>
<a id="actual-public-checks"></a>
<a id="running-version-and-preservation-evidence"></a>

Tre uavhengig oppdiktede browserprøver var røde før retting: manglende institusjon hindret ICS-navneoppslag, bare TP-koder ble avvist før kildevalg, og TP-CSV-felt ble mistet/defaultet til oppgave. Rettet kvalifisert navneoppslag/provisorisk samtykke, eksisterende eksakt TP-kandidatoppdagelse og eksplisitt avkodings-/kolonnevalg. BOM er autoritativ; faktisk privat CSV-avkoding og den klippede brukerlenkens problem er ukjent.

Slutt: **1450/1450 enheter / 114 filer**, 67,42 s; **100/100 browserprøver**, 2,7 min; bygg **85 moduler**, alle exit 0. Node/SQLite og Docker importerte syntetisk 102 hendelser/to punkter og deretter én CSV-hendelse til 103, med tre emner, eksakt reimport, undo, 500-avvisning og reell 409. Hele konvolutten overlevde frisk browser/gjenskaping; **13 kildehashverdier** samsvarte. Tre reviewlag/11 individuelt vurderte funn. Holdt asynkront svar avdekket reell **104 px rulleforskyvning**; rulling gjenopprettes etter hele renderingen. PowerShell-stderrfeil ved forventet ugyldig PDF ble skilt fra barnets exitkode.

Åpnede desktop/390 px/150%-bilder og egne 200%-tastaturprøver. Faktisk offentlig HiMolde IBE160-navneoppslag nådde synlig input og lagring (18:22:58 CEST); separat offentlig UiO IN1000-barekode ga **313** oppføringer (18:03:12), kun aggregater beholdt. Gjentakbare filer: `tests/unit/import-resolution.test.js`, `tests/e2e/import-resolution.spec.js`, `tests/e2e/import-tp-journey.spec.js`. Evidens under `artifacts/import-followup-20261019/`. Sensor-PDF utilgjengelig i denne runden. Drift/Git/uvedkommende data ble ikke endret.

## Blocked calendar journeys: implementation checks - 2026-10-19

Separate førprøver gjenskapte manglende institusjon, bare TP-kodeavvisning og tapte CSV-kalenderfelt. Fokusbrowser **17 pass**,19,1 s; seks unitfiler **177 pass**, exit 0, inkludert valgt-tilstandguard og eventid-alias etter browserkjøringen. Samlet sluttaksept tilhører den senere 1450-/100-testkontrollen. Ingen private skjermbilder/filer ble brukt som fixture.

## Course resolution, source changes and CSV clarification — 2026-10-19

Kvalifiserte kilde-/lagrede navn og HiMolde/NTNU-oppslag ble samlet med eksplisitt uten-emne/provisorisk valg. Navnemangel alene gjenskapte ikke brukerens fire utelatelser; syntetisk avvalg viste referanser til utelatte emneforslag. Fil-/lenkekilder knyttes uttrykkelig, aldri bare med tittel/tid. CSV-avkoding og kolonnevalg bevarer dato/tid og kildeidentitet. Sensorveiledningens sju sider ble lest i akkurat denne runden.

Sluttkontroll: **1439/1439 enheter i 114 filer**, bygg **85 moduler** og **92/92 relevante nettleserprøver**, alle med normal exit 0. Førreview 1430 enheter og den feilende brede 86/89-kjøringen er tidligere kontrollpunkter. Tre reviewlag med 15 funn før gruppering rettet blant annet BOM-løs UTF-16, retry, kvalifisert identitet, alias og navneopphav. En reell produksjonsfeil viste at kodebasert oppdatering må beholde tidligere godkjent navn; regresjonen var rød før retting, og kontrollene ble gjentatt. Syntetisk Node/SQLite og Docker sluttet med **3 emner, 103 hendelser, 2 punkter**, bevarte eksakt tilstand/IDs/relasjoner etter gjenskaping og frisk browser; **13 kildefiler** samsvarte. Den 102-hendelses navneprøven krevde to emnevalg før én bekreftelse. Original utelatelsessekvens/CSV-avkoding, live tilgjengelighet og studentforståelse forble uverifisert. Denne tidligere runden er ikke erstatning for den senere 1450-/100-testkontrollen ovenfor.

## Calendar import forms: final follow-up, 2026-10-19

Automatisk periode er nå standard; åpning av valgfrie innstillinger aktiverer ikke skjult filter. Bare uttrykkelig manuell periode krever termin/år. Nye filer nullstiller filter, samme draft beholder kompatible valg. Manglende emnenavn avklares én gang før samlet validering. Lenkeimport kan være et øyeblikksbilde uten forhåndslagret emne. HTML-visning får ICS-veiledning; ingen gjettet eksportadresse eller ny adapter.

**1424/1424 enheter / 113 filer, 81/81 browserprøver / 12 filer og bygg 83 moduler**, alle exit 0. Isolert Node/SQLite og Docker startet tomt og lagret **2 emner / 85 hendelser / 2 punkter** i én revisjon; eksakt konvolutt, relasjoner og tider overlevde reimport, reload og gjenskaping. **7 kildehashverdier** samsvarte. Åpnede 1365 px-/390 px-/150%-bilder, tastatur/fokusretur og feilnavigasjon. Tre reviewlag/13 funn, alle rettet. Tidlige avbrutte eller feilende selektorkjøringer er ikke pass. Happy path krevde fire apphandlinger; ingen vellykket førflyt eller studenttid ble målt. Privatoriginal/live kilder/drift ble ikke brukt.

## ICS point markers and period correction — 2026-10-19

To påviste årsaker: ICALs gyldige implisitte nullvarighet ble avvist som `end <= start`, og gamle skjulte periodefelt filtrerte nye filer. Punkter beholdes nå som ikke-opptatte hendelser; ugyldige intervaller avvises, DATE-hendelser beholder døgn/eksklusiv slutt, og tittel/transparens skaper ikke automatisk oppgave. Kildedeler, avviste deler, genererte forekomster og avvalg telles separat. [RFC 5545 §3.6.1](https://www.rfc-editor.org/rfc/rfc5545.html#section-3.6.1) var kildegrunnlag.

**1416/1416 enheter / 113 filer**, bygg og **74/74 berørte browserprøver** bestod, exit 0. Bredere førkontroll **88/89** hadde en eksisterende timeouttekstfeil i `connected-review-calendar-selection.spec.js:150`; den ble ikke fremstilt som grønn. Node/SQLite og Docker beholdt hele syntetiske konvolutten: seks VEVENT ga sju hendelser/fem punkter, emnekoblinger, notater og eksakte instanter ved gjenskaping/frisk browser. Første harness sammenlignet scroll før skjermbildeendring var ferdig; sluttløpet ventet på lagret preferanse og beholdt eksakt sammenligning.

Tre reviewlag; RDATE-perioder, flyttede/avlyste unntak, høsttime, varighet, relasjoner, revisjon/undo og skriveavvisning inngår. Åpnede desktop/390 px/150%-bilder med tastatur. Sensorveiledningen ble lest. Et privat vedlegg ble denne dagen undersøkt **bare i minnet med aggregater**, ikke importert, kopiert eller brukt som fixture; alle lagrings-/browserbevis er uavhengig syntetiske. Lokal evidens: `artifacts/ics-point-fix-20261019/`.

## Kalenderfil og sammenhengende flyt — 2026-10-18

Fra `69b489db3bd32a538394a7404242484e8bf2c47d`: felles kalenderfilflyt erstattet krav om ett emne/oppgitt periode og bevarte aktivitetstype, emnevalg, kildeidentitet og atomisk lagring. Reell grunnlagsendring gjenskapte stale-avvisning; intern asynkron status som årsak til brukerens tilfelle ble ikke etablert. RDATE-perioder, eldre filkilder, gruppevalg, fokusretur og prioritet ble rettet gjennom tre reviewlag.

**1405/1405 enheter / 112 filer**, bygg **83 moduler**, **104/104 browserprøver / 16 filer**, alle exit 0. Node/SQLite og Docker beholdt eksakt konvolutt over gjenskaping/frisk browser etter synlig import i én revisjon (3 emner, 4 hendelser, én egen aktivitet). Første cleanupskript ga exit 1 etter passerte assertions; korrigert hel kjøring bestod. Browsermellomløp **95/99** og **103/104** hadde utdaterte testinteraksjoner; bevart identitets-/skrive-/angrekontroll bestod etter retting.

Samme syntetiske før/etter-fil: **20 → 3 handlinger**, med navigation/rulling/tastetrykk utenfor tellingen. Åpnede desktop-/390 px-/150%-bilder og tastatur viste tilgjengelig bekreftelse uten horisontal overflyt. Seks måneders uendelig seriegrense, mengdegrenser, ukjente navn/grupper og lokale øyeblikksbilder er eksplisitte grenser. Ingen live- eller studentaksept; sensor-PDF ikke funnet i denne runden. Egne ressurser ryddet; Git/drift uendret.

## ZIP-oppfølging: PHS-video og SC-01 — 2026-10-16

Fra `aefb179569f56a7213b97b74d3797a157ac92f3a` ble PHS-rekrutteringsvideo/spiller fjernet, inkludert tilgangslignende strømparameter uten å teste gyldighet eller kopiere verdi. Ni overskrifter og 15 faglige lenker var identiske. A02 i `connected-root-acceptance.spec.js` fikk nøyaktige emne-/oppgave-/økt-ID-er, relasjoner og tid etter synlig reload; dette er domeneverdier, ikke hel konvolutt.

Fokus **14/14**, A02 **1/1**, bygg **83 moduler**; full suite **1390/1390 / 110 filer** før siste lenkepresisering, deretter berørte 14 igjen. 286 fixtures/28 Markdown-filer ble mønsterskannet med utfoldet ICS/gjentatt URL-dekoding; 201 lenker og whitespace bestod. Første unitstart fra feil mappe ga ENOENT; to A02-mellomløp brukte feil `tasks`-nøkkel, korrigert til `all` med assertions beholdt. Ingen SQLite/Docker-/studentprøve eller historikksanering.

## Publiseringskontroll — 2026-10-16

Lærerfeedback og alle sju sensorsider ble lest; kildens identitet står i planindeksen. Ni PHS Outlook Safe Links med mottakermetadata ble erstattet med opprinnelige HTTPS-mål; 21 lenketekster/mål/struktur beholdt. **13/13 fixture-/PHS-prøver**, exit 0, kl. 13:39. Ingen live kilde, appserver eller Docker.

19 leveransefiler (16 dokumenter/instruksjoner + 3 fixture-/proveniens-/testfiler), 286 fixtures, **201 lenker/ankre i 28 Markdown-filer**, 7 suksesskriterier, 11 R/Q, 8 stories og 16 testtitler ble kontrollert. Uavhengig gjennomgang fant ingen konkret publiseringsblokkering. Tillatelse til commit/push gjaldt denne historiske runden, ikke senere lokale oppdrag. Ingen ny fullsuite/studentprøve eller garanti for historikkens personvern.

## Første dokumentkontroll — 2026-10-16

Planleggingskjeden ble rekonstruert datert 16. oktober etter lærerfeedback; nasjonal dekning ble visjon og HiMolde/NTNU avgrenset V1. Tre reviewlag førte til presisert prøveoppskrift, kilde-/fristkrav, evidenslenker og arkitekturmetadata. **186 lenker/ankre i 28 dokumenter**, 7 SC, 8 R, 3 Q, 8 stories og 16 testtitler bestod. Fokus `fixture-privacy`, `vortex-programs`, `public-tp`, `teaching-check`: **56/56 / 4 filer**, exit 0, 6,33 s. Ingen ny full app-/Docker-aksept, studentprøve eller Git-skriving.

## Personvernminimerte kildefixturer — 2026-10-02

FIH-kontakt-/delingsinnhold, personprofiler og undervisernavn ble minimert uten live oppslag, mens kildevalg, hendelsesantall, 75 NIH-rader/32 syntetiske underviserfelt, HiMolde-arrayform og Ansgar-koordinater ble kontrollert. Første for brede FIH-fjerning tok en nødvendig plantabell; avgrenset retting bestod **18/18**, etterreview **14/14**, deretter **1388/1388 / 110 filer**, bygg **83 moduler**, **76 lenkemål / 22 filer**. NIH-foreleserfiltrene var ikke dekket tilstrekkelig av denne gamle kontrollen; oppfølgingen 26. oktober behandler det påviste hullet. Ingen realdata/live test eller garanti for alle personfelt.

## Ren kandidatkontroll for Git-leveransen — 2026-10-02

Ren sporet worktree fra `3a03f9f6ee0da0902e02334646a6915e8ae5a11a`: `npm ci` 96 pakker, **1382/1382 enheter / 109 filer**, **92/92 undervisningskontrakter / 10 filer**, bygg **83 moduler**, **3/3 databaseprøver**, **41/41 arbeidsflyt + 2/2 kalenderprøver**, normal exit. Node og isolert Docker på 18546 bestod hver **create 1/1 + restore 1/1** med eksakt konvolutt over restart/gjenskaping; SQLite revision 13, `ok`, 0 FK-brudd. Container/nettverk stoppet uten volumesletting. Kandidat/metadata/lenker kontrollert, bare dokumentasjon endret etter kjøring. Nasjonal dekning var uoppfylt daværende krav; Outlook/studenttest var ikke gjennomført.

## Avgrensede arbeidsflyt- og eksportrettinger — 2026-10-02

Rettet blandede legacy-/ordnede steg, slettesperrer for avhengigheter, temaets tom/utelatt dato, uavhengig vurderingskontekst, eksportnavn/utelatelser og norsk programrekkefølge. Åpning migrerer ikke lagring. Review bevarte eldre tekst/ID-er, krevde ny godkjenning ved endret repetisjon og beholdt fokus/ukjent historisk navn.

Slutt: **1378/1378 enheter / 109 filer**, **40/40 browserprøver**, bygg **83 moduler**, **3/3 databaseprøver**, alle exit 0. Node og Docker bestod hver **create 1/1 + restore 1/1**, med én motsatt-fase-skip per kjøring; eksakt envelope og revision 11→13, recovery, `ok`, 0 FK-brudd. Dockerbygget hadde **642 hashkontrollerte filer**, Node 24.21.0/SQLite 3.53.4/UID 1000, port 18544. Åpnede 1440/390 px-/24 px-tekstbilder.

Reelle røde funn: stegutfall ga `undefined` i stedet for `false`; kryssreferert repetisjonsøkt ble slettet ved temaendring og gjorde konvolutten ugyldig. Begge rettet med bevarte IDs/historikk. Testfeil **27 pass/2 feil** gjaldt rullepreferanse/label; etterreview **39/40** fikk forsinket scrolllagring, korrigert med font-/layout-/persistensventing, **5/5** gjentakelser og 40/40. Første Docker-wrapper stoppet på stderr-fargevarsel, og tidligere mellombygg er ikke sluttaksept. Evidens: `studieplan-bounded-fixes-20261002/final-evidence.json`, `docker-20261002-0050/manifest.json` og `docker-evidence.json`, lokale/utenfor Git. Outlook/studentprøve og nasjonal dekning ble ikke etablert.

## Historisk sluttkontroll etter uavhengig review — 2026-10-01

<a id="historiske-reviewdisposisjoner--2026-10-01"></a>

Etter tre reviewlag: **1346/1346 enheter / 106 filer**, **41/41 browserprøver**, **92/92 undervisningskontrakter**, bygg **83 moduler**, **3/3 databaseprøver**, alle exit 0. `database-delivery.test.js` **11/11** inkluderer historisk sessionId som først ga FK-brudd. Ren kopi **641 filer**; uavhengig kontroll av **168 produksjonsfiler** ga 0 avvik/utelatelser/forbudte filer. Manifest `55AEB1261F6B0A45717D44642F627A1C15AFA2B819F7ADF5F5E43CB6972339AA`.

Docker 18521: **3/3 create + 1/1 restore**, fire fasehopp separat, UID 1000/Node 24.21.0/SQLite 3.53.4. Eksakt tilstand revision 34 overlevde gjenskaping; UI-backup/restore revision 36, ett recovery-snapshot, `ok`, 0 FK-brudd og frisk browser. Synlig titteloppgave, egne aktiviteter/ukjent tid, faktisk plan/replan og eksamensmerking bestod. Ekte NTNU EXPH0100 gjennom produksjon beholdt identiteter; senere 401/ugyldig kalender var **injiserte** feil som bevarte tidligere data. Offentlig transport: HiMolde IBE110/430/160 **26/13/32**, NTNU ARK1001/EXPH0100 **42/141**; ikke personlig gruppebevis.

Review rettet parserdatoer, legacy-steg, vurderings-/historikkrelasjoner, taskless kapasitet, fristklipping, kildefeilklassifisering og mobiltekst. Kalenderkoordinatfunnet ble avvist fordi dokumentposisjon var riktig invariant; ugyldig arkivpurge avviste atomisk, ikke falsk suksess. Samtidige legacy/steg, stegsletting, tom temadato, kryssvurdering og eksport/programsortering var da fortsatt avgrensede åpne punkter, senere behandlet 2. oktober. Outlook/studentprøve forble åpne. Nasjonale restkrav var historiske; AHO/FHS/NLA/KRUS/NBI-feil hadde ukjent årsak, HLT-XLSX manglet adapter og Sámi hadde 0 gyldige aktiviteter. Hele historiske browserpakken var ikke gjentatt.

## Kontroll før avsluttende review — 2026-10-01

Mellomkontroll før sluttreview: **1332/1332 enheter / 105 filer**, fokus 22/22, undervisning 90/90, adapterfamilier 388/388, browser 33/33, database 3/3 og bygg 83 moduler, exit 0. Offentlig HiMolde/NTNU **26/13/32 og 42/141**; Kristiania 49/58 og NIH26 ga to ekte browserpass, deretter egen NIH-mobilprøve. Sandbox EACCES var miljøavvisning, ikke kildefunn.

640-filskopi, isolert Docker 18511, **3 create + 1 restore**, fire motsatt-fasehopp; eksakt state revision 33 og restore 35, `ok`, 0 FK-brudd, frisk browser. Tidligere Node-harness avviste backup og var ikke grønt; Vite-teardown trengte kontrollert serverstopp; Docker 18491/18501 var før senere rettinger, og readiness-race ble rettet. Endelig reviewrunde ovenfor overtar akseptansen. Ukjent kildefeil er ikke tilgangsbevis; nasjonale restkrav og HLT/Sámi/Ekko-begrensninger ble beholdt. Ingen Outlook-/studenttest.

## Fleksibel registrering og egne kalenderaktiviteter — 2026-09-29

Tittel alene/ukjent arbeid og egne aktiviteter med eksakt, start-only eller date-only tid: fokus 108/108, **1316/1316 /104 filer**, undervisning 89/89, bygg 83 moduler, database 3/3, browser 6/6, exit 0. Første samtidige browser/databasekjøring delte traceutmappe og ga ENOENT/heng; separat utmappe/eid server bestod. Åpnede 1440/1280/390 px/24 px-bilder.

Docker 56862 fra implementasjonen beholdt egen aktivitet, tom emnekobling, ID og tid etter gjenskaping. Etterreview endret ikke skjema/lagret form; sluttkilde bestod Node 3/3. En ekstra Docker-gjentakelse av nøyaktig sluttkilde ble **ikke kjørt** fordi snever systemgodkjenning var utilgjengelig ved kvotegrense; ingen omgåelse. Dette gapet tilhører denne datoen. Ingen ekstern/studentprøve.

## Regelbasert tekstregistrering og eksamensmerking — 2026-09-29

Lokal regelparser og eksplisitt eksamensart: **1303/1303 /103 filer**, undervisning 88/88, bygg 83 moduler, database 3/3, browser 5/5, exit 0. Fast klokke, Oslo-år/dato, tvetydighet, stable mål, invalid/stale/no-write, skrivefeil/undo og negativ `assessment`/mockeksamen inngår. Tekniske aktiveringer: oppretting 2 vs 2, fristendring 2 vs 3. Åpnede 1440/1280/390 px/24 px-tekstbilder, alle felt minst 8 px over fast navigasjon. Råtekst lagres ikke; ingen KI/nettverk i appflyten, full historisk browserpakke eller ekstern kalenderklient ble ikke prøvd.

## Stabil kalender, kalenderkopi og alfabetiske kataloger — 2026-09-29

Rettet stabil kalenderhøyde fra dokumentposisjon, eksportert transparent VEVENT-frist uten oppdiktet slutt, og norsk ikke-muterende katalogsortering. **1274/1274 /101 filer**, bygg 80 moduler, browser 21/21 +separat 9/9, exit 0. To parallelle fullkjøringer traff UiT-PDF-timeout; isolert 22/22 og sekvensiell fullsuite bestod. ICS ble lastet ned/parsegjenlest med låst ical.js; **Outlook-klient ble ikke prøvd**.

Docker 56854 fra arbeidskopien bestod database 3/3, eksakt revision 12 etter gjenskaping, frisk browser 1/1/backup/recovery og eget UI-harness for 49 institusjoner, alfabetiske varianter, kalenderhøyde og treVEVENT-er. Harnessets første asynkrone listeventing var testfeil. Slutt SQLite revision 30,5 recovery,0 FK-brudd. Egne ressurser stoppet; volum beholdt.

## Integrerte arbeidssteg, egenvurdering, kalenderfil og plansammenligning — 2026-09-29

Valgfrie arbeidssteg, egenvurdering, ICS-kopi og revisjonsbundet plansammenligning beholdt tittel-only og separate fullføringer. Review rettet stalegrunnlag, stegavhengigheter, datoer, sessionvurdering, utsettelse, backupnøkler og kapasitetunion. **1267/1267 /100 filer**, undervisning 80/80, bygg 79 moduler, database 3/3, full lokal browser **318 pass /49 livehopp**, exit 0. Åpnede 1440/1280/390 px/stor tekst-bilder. Docker 18140 beholdt nye relasjoner revision 1 ved gjenskaping, bestod dockerbrowser 1/1 og UI-backuprestore tilrevision 3. Ingen studenttest; teknisk hovedflyt fortsatt 8/7 handlinger.

## Integrert leveransekandidat — 2026-09-28

Kandidat `26d552cfe5dc5aec5275f2b77d0b917d23edca50`, ren checkout fra samordnet `delivery/studieplan-20260926`, `npm ci`96 pakker: **1249/1249 enheter / 99 filer**, undervisning 80/80, database 3/3, bygg 73 moduler. Bred browser **303 pass / 49 livehopp / 0 feil**; alle 352 utfall skrevet, men Windows Playwright/Vite krevde kontrollert avbrudd, så **ingen ren runner-exit** påstås.

Isolert Docker 18473 ble healthy, beholdt relasjoner/revisjon ved gjenskaping og bestod `test:e2e:docker`1/1 med frisk browser/SQL/UI-backup. Første håndlagde fixture brukte feil `remainingMinutes:null`; korrigert fixture og hel gjenskaping bestod. Egne ressurser ryddet. 49 livehopp er ikke pass eller nasjonal aksept.

## Systematisk undervisningsimport og verifikasjon — 2026-09-25

<a id="live-nettlesermatrise--2026-09-26"></a>
<a id="strømlinjeformet-undervisningsimport--2026-09-26"></a>

Den systematiske HiMolde-ruten følger offentlig anonym bootstrap og JSON, med scoped cookie/Referer/X-Requested-With; gammel IBE152/400-forventning er erstattet. Slutt første runde: **1240/1240 /99 filer**, undervisning 78/78, bygg 73 moduler, database 3/3, lokal browser 9/9. Parserstramming av manglende vurderings-ID/listetyper og `source-changed` ble retestet.

26. september: ekte HiMolde IBE110/430/160 **3/3**, NTNU ARK1001/EXPH0100 **2/2**, og HiMolde IT-program/undervisning **1/1**. Transportantall **26/13/32 og 42/141**. Hele programflyten ble **ikke** importert på nytt; direkte emneprøver har eget gjentaksbevis. En senere samlet kjøring fikk transient IBE160-transportfeil og er ikke pass. Mobil 24 px-bilde åpnet. Automatisk Vite-teardown krevde eid prosessstopp; separat 9/9 ga normal exit.

Strømlinjeformet oppfølging sluttet med **1246/1246 /99 filer**, undervisning 79/79, bygg 73 moduler, database 3/3 og browser 17/17, exit 0. Uendret oppdatering gikk teknisk fra 2 til 1 aktivering; endret valg ble fortsatt bekreftet. Rulling/fokus, kildebevis/grupper og metadata beholdt;1440/390 px/200%-bilder åpnet. Et bredt 352-testdiagnostikkforsøk ble avbrutt etter 72 saker med mange gamle timeouts; det er ikke sluttaksept.

## Programimport: synlig respons og kompakte programvalg — 2026-09-25

Hovedhandlingen manglet lokal startstatus og viste valideringsfeil langt unna; radioer arvet tekstfeltstørrelse. Rettet fokusert status, begrenset undervisningssøk, kompakt native radiogruppe og samme kildegrener. **1230/1230 /98 filer**, bygg 72 moduler, database 3/3, browser 34/34, normal exit. Første 21 browserfeil var 16 gamle kvitteringsforventninger og 5 tests som lukket automatisk åpnede detaljer; dataassertions beholdt. Etterreview av avbrudd/retry/proveniens/utkast passerte samme pakke. Åpnede 1440/390 px/150%-bilder; offentlig HiMolde-struktur ble kontrollert separat, ikke live ende-til-ende-prøve.

## Simplified study and teaching import — 2026-09-25

HiMolde IT-fixture bevarte IBE110/430 og nøyaktig ett kildevalg: IBE160 eller IBE102+IBE152; like studiepoengsummer er ikke bevis for alternativer. **1230/1230 /98 filer**, fokus 24/24, bygg 72 moduler, database 2/2, programbrowser 9/9 og etterfølgende berørt pakke 18/18, normal exit. Uforpliktende sessionStorage-utkast overlevde reload; én samlet lagring og delvis undervisningsstatus kontrollert.

Samme syntetiske scenario: **39→23 handlinger**, kontekstvalg 13→10, ikke studentopplevelse. Desktop/390 px/150%-bilder åpnet. Eldre `.data-menu`/navn/timer-hook-forventninger ble oppdatert med atomiske assertions beholdt; parallelle trace-mappekonflikter ga ENOENT, identisk pakke bestod alene.

## Simplified task-to-plan flow — 2026-09-25

Samme teknisk målte oppgave→forslag→flytt→bruk-flyt gikk **15→8 handlinger først /7 senere**, obligatoriske felt 3→1 (tittel). Ingen studentprøve. **1225/1225 /97 filer**, bygg 71 moduler, database 2/2 og ny browser 5/5, exit 0. Ukjent arbeid, betinget tid, registrert kapasitet, cancel/stale/repeat/undo og 390 px/200%tekst inngår; bilder åpnet. Bred gammel 341-pakke ble avbrutt etter 53 saker/24 feil i utdaterte selektorer/ordlyd; ikke rapportert grønn. BMAD startet med uv 0.12.6 gjennom vanlig snever godkjenning, uten systemendring.

## Samordnet UX-sluttkontroll — 2026-09-25

Isolert integrasjonsworktree fra `10d7085b964a537dc8006a68300878eae74260f5` beholdt atomisk shape_json-migrering, rollback og lås. **1218/1218 enheter / 96 filer**, fokus 119/119, bygg 70 moduler, database 2/2, UX/dokument 13/13 mot eid Vite, alle exit 0. Åpnede 1440/1280/390 px/stor tekst-bilder. Docker 18126 fra sluttkoden ble healthy og bestod UI/backup/fersk browser samt samme-volum-gjenskaping; løp **2/2 og 1/1**, exit 0. Container stoppet, syntetisk volum beholdt. Daværende fungerende Docker opphever ikke senere datoers motorblokkering.

## Repository-opprydding — 2026-09-20

Historisk staged tree `a710df69971cf7263b970b19612d5495f7d91b9a`, ren kopi 606 filer: alle 17 påkrevde leveransefiler og lenker i 20 Markdown-filer; `npm ci`96 pakker, **1200/1200 enheter /95 filer**, bygg 68 moduler. Før avsporing ble **35/35** originaler kopiert/hashkontrollert og uavhengig bekreftet. Fire særskilte kildefixturer ble beholdt;31 filer ble avsporet, men beholdt lokalt og kontrollert ignorert. Ingen original ble slettet. Dette er historisk handling, ikke autorisasjon til ny avsporing.

## Legacy `shape_json` migration correction — 2026-09-20

En ekte eldre skjemafixture uten `state_meta.shape_json` feilet ved oppstart. Migrering legger nå kompatibilitetskolonner før bruk, med DDL/FK-rebuild/validering/markører i én `BEGIN IMMEDIATE`. Fokus **10/10** kontrollerte eksakt revision 7, identiteter, kilde-/arkivmetadata, gjentatt åpning, mellomskjema og full rollback ved orphan-FK, inkludert frigitt Windows-filhandle.

Etter testtillegg uten produktendring: ny ren kopi/låst installasjon **1200/1200 /95 filer**, bygg 68 moduler, database 2/2 (tidligere 1199 var mellomresultat). Docker 18102 fra samme tre beholdt emne–oppgave–økt og revision 1 etter gjenskaping. Prosjekt stoppet uten å slette eget testvolum.

## Post-review clean-checkout acceptance — 2026-09-20

Ren Git-kopi av `b817b52ba6cdba01390e677a80cdc8c85407bd9e`: låst installasjon, **1196/1196 /95 filer**, bygg 68 moduler, database 2/2 og kalender 5/5. Docker 18100 bestod produksjonsdatabase 2/2 og eksakt revision 8/relasjoner ved gjenskaping/frisk browser; font svarte `font/woff2`. To oppsettfeil (npm ci én mappe for høyt og relativ font-URL uten baseURL) ble rettet uten produktendring. Eget prosjekt stoppet, syntetisk volum beholdt.

## Git clean-checkout submission acceptance — 2026-09-20

Ren Git-kopi av `e5ad5be1df2aa3c256a42c6d1bbde07b8265e44e`: `npm ci`96 pakker, **1195/1195 /95 filer**, bygg 68 moduler. Docker 18099 ble healthy som node; målrettet produksjonsbrowser **2/2** kontrollerte engangsmigrering, UI/SQL, 409, recovery og purge. Eksakt API-tilstand revision 8 og relasjoner overlevde containerbytte/samme volum; frisk browser uten localStorage viste dataene. Prosjekt stoppet uten volumesletting. Senere dokumentendring alene.

## Docker clean-copy runtime acceptance — 2026-09-20

Med baseimage lokalt (`node@sha256:0e0ff40c39bc087845bfb27465a0df4ea419520094bc35842ff83dd8cbe6f9b6`) bygget ren kopi med to låste npm-steg og 68 moduler. Desktop 4.91.0/Engine 29.8.0/containerd 2.3.4. Isolert Docker 18088 ble healthy som `node`, tom revision 0. UI opprettet/redigerte emne–oppgave–økt til revision 7; gjenskaping beholdt volum, eksakt IDs/relasjoner og senere tittel i en helt ny Chromium-prosess. Synlig backuprestore gikk 7→8 med opprinnelig tittel, samme IDs og forrige tilstand i recovery; direkte SQLite bekreftet ett snapshot/184320 byte.

Første harness hadde feil handlingsselektorer og `recovery.envelope` i stedet for `recovery.data`; første fase-B-artefakt viste bare post-restore-resume. Den strenge `-02`-kjøringen begynte tom og utførte hele overgangen, uten produktendring. Lokal evidens `docker-phase-a.json`, `docker-phase-b.json`, `docker-orchestration.json` og åpnede browserbilder. Egne container/nettverk stoppet, isolert volum beholdt.

## Docker transport follow-up — 2026-09-20

Historisk Dockerdiagnose: Desktop 4.88.1, Engine 29.7.2/containerd 2.3.3, direkte proxybane; TLS `bad record MAC` forekom også utenfor prosjektbygg. Én ny pull og kontrollerte reversible undersøkelser ga ikke sikker årsak. Wi-Fi var eneste fysisk tilkoblede adapter, så ingen nettverksadapter ble endret; heller ingen sikkerhet-/register-/installasjonsendring. BMAD/uv 0.12.6 startet gjennom ordinær snever tillatelse. Manglende bildeaksept ble stående frem til den faktiske clean-copy-kjøringen nedenfor.

## Full-stack database and Docker delivery — 2026-09-20

Fullstack innførte autoritativ SQLite med validerte relasjoner, revisjon/rollback, recovery og privat historikkpurge. **1195/1195 enheter /95 filer**, bygg 68 moduler og Node-runder **1/1**, deretter **2/2** etter review. Ren kopi 601 filer/96 låste pakker samsvarte på alle hasher og bestod samme 1195/bygg/2 browserprøver. HTTP-smoke viste loopbackstandard, ugyldig URL400, header/MIME-bevaring. Første browserfeil var skjult option-lokator og ugyldig stale-fixture som korrekt fikk 400 før revisjonskontroll.

Compose-konfigurasjon bestod, men **tre no-cache-bygg og direkte baseimage-pull** feilet med `local error: tls: bad record MAC` før appinstallasjon/bygg. Dette var ingen Dockeraksept; senere seksjoner viser den faktisk fullførte testen. Ingen reelle brukerdata brukt.

## R31 – avsluttende kontroll av T3-restene, 2026-09-20

T3-restfeltene 4 campus/19 gruppe/36 personlige planer ble undersøkt og klassifisert med avgrenset kildegrunnlag; ingen `U` var igjen, uten at dette ga full funksjonsdekning. NIH IDR107/25097.10/høst 2026 ga 26 VEVENT og ekte preview/save/reload/repeat 1/1. Først sandbox EACCES, deretter godkjent begrenset nettverk; mobilkildeetiketter ble rettet og prøven gjentatt. **1189/1189 enheter /94 filer**, fokus 24/24, bygg 67 moduler. Gammel Molde/IBE152-400-forventning ble senere erstattet av fungerende anonym bootstrap for IBE110/430/160. Ingen personlig gruppebekreftelse.

## R30 – sju ekte programforløp og to undervisningsrester, 2026-09-19

`national-program-live.spec.js` bestod **7/7 ekte programreiser** for Nord, UiA, UiO, HiMolde, NIH, HiØ og Skrivekunst; lagrede utvalg var **1/6/1/4/4/3/1**. Alle hadde preview/save/reload/repeat med identitetsbevaring, ikke full katalogdekning. Nord språklenke/periode og UiAs uavhengige valggrupper ble rettet; Skrivekunst forble én 60 sp-enhet. **1178/1178 enheter /93 filer**, fokus 11/11, browser 15/15 og bygg 67 moduler. Automatisk Vite-teardown hang; eid server ga normal exit. Åpnede sju bilder. Programmatrise 48 V + EkkoØ gjelder kun dokumenterte programprøver; datatypefelter beholder svakere status.

## R29 – AHO og nasjonal adapterstatus, 2026-09-19

AHOs designplan 2026–31 ga 10 perioder/31 emner; arkitektur 9/44. Design bestod ekte browser 1/1 med to lagrede stabile emne-ID-er; arkitektur var serverbevis. Fokus 72/72, full **1177/1177 /93 filer**, bygg 67 moduler. UiT-PDF-test traff 5 s både parallelt og isolert; bare den tunge lokale runtimegrensen ble endret til 15 s, deretter 22/22 og sekvensiell fullsuite. Ingen UiT-produktendring.

Ekko Digitale AS var slettet etter fusjon, og to relevante ONH-tilbud ble sett; dette etablerte ikke historisk Ekko-kull/arkiv. Daterte detaljer og datatypefordelinger står i [IMPORT-COVERAGE](IMPORT-COVERAGE.md). Ingen full nasjonal dekning.

## Nasjonal T1/T3-videreføring, 19. september 2026

Sju nye programadaptere (Nord/UiA/UiO/HiMolde/NIH/HiØ/Skrivekunst) hadde avgrensede offentlige prøver, adskilt fra fixtures. Ekte DOM-varianter avdekket blant annet Nord-modellinnpakning, UiA emne-/modellperioder og Vortex/Skrivekunst-overskrifter; rettet før **1172/1172 enheter**, bygg 67 moduler, **19/19 browserutfall**, egen 4/4 visuell og 1/1 Vortex-periode. Browserreporter beholdt `running` etter komplette utfall; kontrollert teardown, ingen normal-exit-påstand. Tidlige Skrivekunst-testfeil og reell kalenderkoblingsfeil ble rettet. R29 løste senere AHO; Ekko-arkiv og BIs ufullstendige 234/223/57-katalogobservasjon forble grenser. Lokale rapporter under `artifacts/national-*20260919*`; ikke studentprøve.

## Connected planner: final local evidence through 2026-09-19

Historisk samling av den sammenkoblede kjernen; lokale fixtures, simulerte svar og faktisk transport holdes adskilt. Slutt R26: låst kopigrunnlag **536 hashkontrollerte filer**, **1134/1134 enheter /88 filer**, bygg 67 moduler; browser **271 pass /34 livehopp /0 feil av 305**, men reporter/teardown krevde Ctrl+C etter alle utfall. Ni avgrensede reviewrettinger omfattet inerte kildelenker, sammensatt URL-redigering, cross-site loopback, Oslo-år/frister, kildenotater og fokus.

Vesentlige tidligere feil: to tester leste lokale artefakter og ble flyttet til varige fixtures; A12 avviste korrekt avhengighetsforklaring og ble styrket til identitetsassertion; fire gjenåpningstester forventet null der kontrakten var ukjent, rettet og 39/39 berørte pass; HMR- og serverrestartfeil ble bare erstattet av eksplisitte omkjøringer. Historiske enhetskontrollpunkter **768,888,988,1014,1092** og browser **208/10 hopp/2 feil**, **213/28 hopp**, **228/34 hopp/1 feil**, **250/34 hopp/4 feil** er ikke nye eller ubetinget grønne fullkjøringer. Fokusgrupper overlapper og summeres ikke.

Faktiske begrensede program-/kildeprøver omfattet 40 institusjoner, UiT PDF (3 lesbare utvalg +1 synlig bilde-tabellavvisning), ONH2026/27 og historisk 2025/26, Kristiania 49 gyldige/58 rå, NMBU/HVL/USN/MF, NHH24 aktiviteter, NMH, PHS/Gestalt/Plandisc, FIH/Ansgar og 12 TP/øvrige undervisningsprøver. Ansgar 87 gyldige/3 uavklarte; Sámi 7 rå/0 gyldige er negativt kildebevis. Utvalgene dokumenterer ikke personlig campus/gruppe eller alle programvarianter. Kildedetaljer står i [IMPORT-COVERAGE](IMPORT-COVERAGE.md); lokale rapportfamilier `artifacts/connected-public-sources/`, `connected-unit-r26-final2-20260919.json` og `connected-browser-r26-final-20260919.json` knytter historikken til kjøringene.

Kjernen kontrollerte A02–A14, atomisk undo, dokumentimport, avhengigheter, ukjente anslag, privat backup/recovery og personlige øktforslag med sparse-history-avvisning. Åpnede desktop/390 px-/24/32 px-tekstbilder viste fokusretur, korrigering, langt innhold og tilgjengelige handlinger. Ingen studentbrukertest.

## Konsolidert eldre verifikasjon

Tidlige feature-, redesign-, kalender- og importrunder 6.–12. september avdekket fokus-, identitets-, parser- og dokumentasjonsfeil senere dekket av nyere runder. Detaljhistorikk finnes ved `1a39aaf450c3ff4a59908fd8caba9de10230b9a6`. Lokale `artifacts/`-råfiler inngår ikke i Git-klonen. Ingen av disse historiske tallene er ny akseptanse eller personlig brukserfaring.
