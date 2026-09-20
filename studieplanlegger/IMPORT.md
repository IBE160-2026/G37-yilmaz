# Emner, undervisning og oppgaveforslag

Appen bruker vanlige, deterministiske regler. Data lagres lokalt i nettleseren. Oppgaver, studieøkter, emner og kalenderkilder lagres samlet, slik at en mislykket lagring ikke gir en halv import.

Kildeutgave, opptakskull, studiesemester og kalendersemester er forskjellige opplysninger. Når kilden bare gir et studieår, velger du faktisk studiesemester innen det publiserte året. Et studentoppgitt kull lagres som studentavklart og regnes ikke som en kildebekreftelse. Daterte emnetilbud kan ikke velges utenfor den perioden kilden oppgir.

Under kalenderimport finnes **Offentlig institusjonskalender**. Plandisc gir informasjon som ikke reserverer arbeidstid. HØFY, Gestalt, Fjellhaug og Ansgar har offentlig publiserte klasse-/samlingsplaner; Politihøgskolen har eksamens- og innleveringsoversikter. Velg kildeklasse eller oversikt og kalendersemester, og velg selv relevante oppføringer. Usikre uker, motstridende datoer eller ukjente klokkeslett beholdes som avklaringer. Nye oppføringer har ingen automatisk emnetilknytning; bekreftede emnekoblinger beholdes ved gjentakelse. Hent samme kalendersemester på nytt for å forhåndsvise og bekrefte oppdatering. Disse kildene gir ikke en bekreftet personlig timeplan.

**Finn offentlig undervisning for et lagret emne** bruker emnets kalendersemester og et lærested du velger. Søk etter publisert emnekode/navn, eller program-/kullnavn der kilden bruker det. Velg riktig kildeobjekt og relevante aktiviteter; de nye valgene er uvalgt. Dette fungerer også der appen mangler direkte programimport. Tomme eller ugyldige kalenderoppføringer betyr ikke at semesteret er undervisningsfritt.

Noen TP-eksporter lager nye ID-er ved hver henting. Appen gjenkjenner den dokumenterte eksportformen og bevarer aktiviteter ved endret rom, beskrivelse eller sluttid. Endret starttid eller navn kan ikke kobles sikkert og må kontrolleres. Gamle økter slettes ikke automatisk fordi en ufullstendig kilde utelater dem. En vurderingsmarkør uten reell varighet vises som informasjon; den blir ikke en oppdiktet innleveringsfrist.

## Bruk

1. Åpne **Mine emner → Importer emner og plan** og velg **Fra lærested**, **Fra dokument eller tekst** eller **Fra kalenderfil eller lenke**. Programvalg, kull, studiesemester og kalendersemester er separate valg. Velg publisert campus, studiemodell, obligatoriske/valgfrie emner og undervisningsgrupper før bekreftelse. Under lærestedsimport finnes også «Søk etter ett enkelt emne» for de eksisterende adapterne. [Importdekningen](IMPORT-COVERAGE.md) skiller implementert, faktisk lokalt testet og ekte verifisert import per datatype.
2. Støttede TP- og TimeEdit-kilder har offentlig emne-/klassevalg i forhåndsvisningen og for lagrede emner. Velg kildeobjektet selv, og kontroller aktivitetene. Når kalenderen mangler gruppeidentitet, vises et aktivitetsutvalg med antall, alle/ingen og individuelle økter. Et valgt objekt eller aktivitetsnavn bekrefter ikke personlig tilhørighet. Du kan også lagre bare emneinformasjonen.
3. For alle universiteter kan du velge et registrert emne og laste opp en `.ics`-fil eller hente en offentlig HTTPS-/webcal-lenke.
4. Velg aktivitetene og parallellene du følger. Kontroller tidspunkt, sted, semester, kilde og varsler i forhåndsvisningen. Ingen data lagres før bekreftelse.
5. Lagrede lenker har **Sist oppdatert** og **Oppdater nå**. Appen kontrollerer oppdaterbare lenker ved åpning og mens den er synlig, normalt når minst 30 minutter har gått. Oppdatering pauses under redigering. Ved feil økes ventetiden, opptil ett døgn; eksisterende data beholdes. Manuell oppdatering forhåndsvises før bekreftelse. Filimport er et øyeblikksbilde. Appen oppdaterer ikke kilder mens den er lukket.

Semesteret avgrenser importen: vår er januar–juni, høst er juli–desember. NTNUs emneinformasjon følger studieår: vår 2027 hentes fra studieåret 2026/2027. Alle undervisningstidspunkter vises i `Europe/Oslo`, også når datamaskinen bruker en annen tidssone. Oppgavenes eksisterende lokale fristformat er bevart.

Endrer du semester eller år manuelt på et kildebundet emne, merkes gammel verifisering som utdatert. Gamle kildeopplysninger/proveniens beholdes; appen gjetter ikke ny kildepost eller versjon. Velg riktig periode i importveiviseren, kontroller forhåndsvisningen og bekreft import for å binde en ny verifisert periode. Lokale emne-ID-er, egne notater og koblinger beholdes, og eksisterende oppgaver/hendelser eller faktiske datoer flyttes ikke av periodeendringen.


Oppgaver kan være uten emne, bruke fri emnetekst eller knyttes til et registrert emne. Frist og tidsestimat er valgfrie. Eksplisitt ukjent gjenstående arbeid faller ikke tilbake til et gammelt estimat. Et registrert neste steg kan gi et begrunnet forslag, mens en deløkt er merket som en del av arbeidet. Ukjent arbeid får ingen påstand om nøyaktig tidsplass eller fullføring. Blokkerte oppgaver er ikke startklare; en bekreftet registrert handling kan avklare ekstern venting.

## Lokal dokumentimport

Lim inn tekst eller velg TXT, PDF, DOCX, CSV eller ICS. PDF/DOCX er begrenset til 10 MB, PDF til 100 sider, og tekst/CSV/ICS til 2 MB. Lokalt pakket parserkode kjører i en avbrytbar nettleserarbeider med grenser for tekstmengde, DOCX-utpakking og arbeidstid. Ingen dokumenter sendes til en konverteringstjeneste, og skript, makroer og eksterne ressurser kjøres ikke.

Forhåndsvisningen samler emner, oppgaver/frister og faste aktiviteter med korte kildeutdrag. Velg hver oppføring, korriger navn/tid og avklar emnekoblingen. En dato uten år eller klokkeslett må avklares eller uttrykkelig utelates. Skannet eller uleselig innhold gir beskjed om innliming/manuell registrering. Kalenderundervisning, dokumentfrister og foreslåtte studieøkter holdes adskilt.

Aktivitetsbeskrivelser kan rettes før lagring. Feil åpner de berørte radene og viser hvilket felt som trenger retting, med tastaturfokus på første feil. Et uferdig tall regnes som en feil; et bevisst tomt estimat er fortsatt ukjent. Lagrede dokumentkilder bevarer revisjon, tidspunkt, fullstendighet og avgrensede kildevarsler, også gjennom sikkerhetskopi. Eldre kilder uten slik informasjon får ingen antatt bekreftelse på fullstendighet.

Gjentakende ICS-gjøremål vises uvalgt og kan bare tas med som én konkret oppgave etter kontroll; appen utvider ikke slike gjentakelser til en komplett oppgaveserie. En kalender merket som avlysning krever samme uttrykkelige statusavklaring som et avlyst gjøremål. Kildeutdraget viser gjentakelse og avlysning også når beskrivelsen er lang.

Endrer du klasse, kalenderlenke, periode eller valgt timeplan, må undervisningen hentes for det nye valget. Gamle forhåndsvisninger kan ikke bekreftes for et nytt valg. «Avbryt henting» stopper pågående henting eller dokumentlesing og beholder inndata for nytt forsøk; lagret undervisning beholdes.

Identiske dokumenter gjenkjennes uavhengig av filnavn ved lokal SHA-256. En endret utgave kan kobles til en eksisterende dokumentkilde. Kildegrunnlag og egne endringer sammenlignes; motstridende verdier og tvetydige koblinger krever et valg. Korrigert oppføringstype beholdes ved identisk gjentakelse; senere typebytte må avklares og kan ikke bryte eksisterende koblinger. Kobling til et eksisterende emne gir ikke dokumentet rett til å overta emnets opplysninger eller kilde. Ferdige/avlyste ICS-gjøremål vises med kildestatus og krever et uttrykkelig valg før de tas med som åpne oppgaver. Utelatte eller manglende oppføringer innebærer ingen antatt sletting. Kun valgte gyldige oppføringer lagres, samlet med proveniens og relasjoner. Utkastet beholdes ved feil, og ingen privat originalfil lagres automatisk.

## Kilder som er implementert

- NTNU-emneinformasjon fra den offisielle [emnesiden](https://www.ntnu.no/studier/emner/TDT4110/2026): emnenavn, studiepoeng, faglig innhold og oppgitt undervisningsstart der feltene finnes.
- NTNU-undervisning fra TP-lenken som faktisk finnes på emnesiden. [Kalenderen for TDT4110 høst 2026](https://tp.educloud.no/ntnu/timeplan/ical.php?sem=26h&id%5B0%5D=TDT4110&type=course) ble kontrollert 7. september 2026: 140 økter, med tilgjengelige aktivitetsnavn og paralleller. To påfølgende hentinger ga 140 beholdte økter og ingen duplikater. Dette bekrefter denne offentlige kalenderen, ikke tilgang til alle personlige timeplaner.
- NMBU: offentlig program-/semesterimport og separat emnesøk, med versjonskontroll av tilgjengelige emnedetaljer. MATH100 har ekte offentlig TimeEdit-import med eksplisitt objekt-/aktivitetsvalg, lagring, omlasting og gjentakelse. Manglende emnebeskrivelse og uverifisert campus i emnesøket beholdes ukjent.
- HVL: programimport samt kontrollert TimeEdit-søk på kode/navn, semester og campus-/programvariant. Navnet i emnesøket kommer fra kildens etikett; denne kilden har ikke studiepoeng eller detaljert beskrivelse. DAT100 har ekte offentlig undervisningsimport med lagring, omlasting og gjentakelse.
- UiB: offentlig kode-/navnesøk og publiserte periodeversjoner. INF100 høst 2026 bestod reell sluttkontroll etter reviewpatch, inkludert navnesøk, forhåndsvisning, lagring, omlasting og gjentatt import. Campus forblir ukjent når den ikke er oppgitt.
- UiT: FYS-3000, post 923370, høst 2026, Tromsø bestod ny ekte nettleseraksept 12. september: søk, forhåndsvisning, lagring, lokale notater/oppgavelenke, omlasting, gjentakelse og navnesøk. Tidligere `ECONNRESET` er historikk. Undervisning er ikke bekreftet av denne metadataflyten.

- Generell kalenderimport fra fil og offentlige HTTPS-lenker, uavhengig av universitet. Oversikten omfatter 49 institusjoner fra NOKUT, men dette betyr ikke at alle har fungerende direkte import. Se [datert importdekning](IMPORT-COVERAGE.md) for status per lærested og faktisk kildekontroll.

UiB og UiTs «Offisiell emnekilde» og «Åpne offisiell timeplan» er separate lenker i forhåndsvisning og lagrede emnekort. Offentlig TP-emnevalg og undervisningsimport er faktisk prøvd for UiB INF100 og UiT INF-0101 høst 2026. Studenten velger fortsatt riktig kildeobjekt og aktiviteter; en emneside oppretter ingen undervisning eller innleveringsoppgave automatisk.

Programimporten omfatter faktiske HTML-/JSON-/PDF-kontrakter ved 48 av de 49 kartlagte institusjonene. [Importdekningen](IMPORT-COVERAGE.md) fører alle 49 og datatypene separat; en registrert adapter betyr ikke at alle programmer eller kull er verifisert. AHO leser offisielle program- og studieplansider med egne planutgaver, perioder og studentvalgte valgemner. ONHs publiserte PDF-utgaver velges etter program; studieåret på forsiden er ikke et opptakskull. Flere fordypninger eller åpne valgkrav gjør at også obligatorisk merkede emner krever uttrykkelig valg. Lesing av en kjent offentlig kilde skjer lokalt i importtjenesten med egne grenser; brukerens dokumentimport beholder grensen på 100 sider.

Alle 48 adaptere har nå minst én avgrenset ekte programimportprøve. Nord, UiA, UiO, Molde, NIH, HiØ og Skrivekunstakademiet ble 19. september kontrollert samlet fra faktisk offentlig kilde gjennom forhåndsvisning, lagring, omlasting og gjentatt import. Dette gjør ikke studentoppgitt kull, kalendersemester, campus eller studiesemester til kildebekreftede felt. Ekko står fortsatt uten en selvstendig historisk kullplan; ONH-programmer importeres under ONH. For Molde svarte den gjeldende TP-hendelsesruten HTTP 401 og den annonserte iCalendar-ruten HTTP 400 etter et gyldig IBE152-valg. NIHs offisielt annonserte anonyme TimeEdit-inngang løste den tidligere 412-observasjonen for den avgrensede IDR107-prøven. Appen beholder eksisterende data ved kildefeil og tilbyr fil eller manuell registrering.

UiTs publiserte PDF-studieplaner kan velges fra det aktuelle programmet. Studenten velger kildeutgave, eget opptakskull og relevant tabell/periode; et studieår i tabellen erstatter ikke valg av studiesemester. Informatikk, sykepleie og elektronikk har separate ekte nettleserprøver fra 19. september. En sykepleieutgave med emnetabell som bilde gir en forklaring og dokumentalternativ, uten å låne emner fra en annen utgave. Prøvene dokumenterer disse utgavene, ikke alle UiT-programmer.

Offentlige PDF-er leses i en lokal, terminerbar serverarbeider med 30 sekunders grense, side-/bytegrenser og løpende tekstgrense. Avbrudd eller feil lagrer ingen delvis parserbuffer som en fullstendig kilde. Dette endrer ikke dokumentimportens egne filgrenser.

Når en kilde ikke kan nås, vises feilen uten å gjøre den til et krav om innlogging. Tilbake, manuell registrering, fil og lenke forblir tilgjengelige, og kode-/periodeutkastet beholdes. Rapportene og skillet mellom nye og tidligere kontroller finnes i `VERIFICATION.md`.


Nasjonalt emneoppslag via Sikt krever godkjent Maskinporten-tilgang. En avgrenset, serverbasert lesetransport og kontroll av API-skjema er forberedt, men nasjonal emneimport er ikke ferdig eller annonsert som støttet. Se [tilgang og gjenstående arbeid](SIKT-ACCESS.md). Ingen personlige Feide-tilganger antas å finnes.

[NTNUs timeplanveiledning](https://i.ntnu.no/timeplan) beskriver innlogging med MinID/Feide, valg av gruppeaktiviteter og eksport under **Verktøy**. Personlige timeplaner og enkelte kilder krever tilgang appen ikke har. Appen videresender ikke innloggingskapsler. Eksporter da en `.ics`-fil fra timeplanen etter at du har valgt riktig semester og grupper. Emneinformasjon kan fortsatt lagres hvis kalenderhentingen feiler.

Nettverkshenting krever appens lokale importtjeneste, som følger med `npm run dev`, `npm run dev:legacy` og `npm run preview`. Etter `npm run build` kan bygget brukes lokalt med `npm run preview`. Frontend og importtjeneste skal bare lytte på loopback. Ikke bruk `--host 0.0.0.0`, tunneler eller publisering. En løs statisk kopi av `dist` har ikke importtjenesten; manuell registrering og filimport fungerer fortsatt.

## Oppdateringer og begrensninger

Kalenderparseren er [ical.js](https://kewisch.github.io/ical.js/api/ICAL.Event.html). Den brukes for gjentakelser, `EXDATE`, `RDATE`, `RECURRENCE-ID` og innebygde `VTIMEZONE`-definisjoner. IANA-tidssoner uten medfølgende definisjon håndteres med Temporal og systemets tidssonedatabase. Tider uten tidssone tolkes etter kalenderens `X-WR-TIMEZONE`, eller norsk tid, med et synlig varsel. Tvetydige manuelle klokkeslett ved tidsskiftet avvises med en forklaring.

Vanlige kilder identifiseres med `UID` og opprinnelig gjentakelsestidspunkt. Den eldre NTNU-eksporten har en egen bevart kontrakt for innholdsidentitet og entydig flytting. De nye offentlige TP-eksportene normaliserer bare bekreftet ustabile eksport-ID-er. Samme start og tittel med endret rom, slutt eller beskrivelse beholder identitet. Endret start eller navn krever kontroll; en ufullstendig kilde utløser ingen automatisk avlysning. Ekte stabile kilde-ID-er erstattes ikke av denne regelen.

Bare en dokumentert fullstendig kalenderoppdatering kan bruke fravær som tegn på avlysning. Rullerende abonnement og ufullstendige svar er ikke bevis på at en tidligere økt er slettet. Delvise `METHOD:CANCEL`-meldinger avlyser bare identifiserte økter. Avlyste, transparente eller lokalt skjulte økter tar ikke kapasitet. Kildeoppdateringer sammenlignes med sist importerte verdier; egne notater beholdes, og motstridende endringer krever et synlig valg mellom kildeverdiene og egne verdier. Skjulte importerte økter beholdes slik at en oppdatering ikke gjenoppretter dem uventet.

Emnebundet undervisningsimport oppretter hendelser, og varsler om `VTODO` som ikke inngår i denne kontrakten. Dokument-/kalenderimport kan i stedet forhåndsvise faktiske `VTODO`-oppgaver med kildefrist og avklaringer sammen med hendelsene. PHS' separate eksamensoversikt bruker samme blandede flyt og avgrenser også fristene til valgt semester. Ingen innleveringsoppgaver utledes automatisk fra undervisningstitler. Manglende felter og utelatte økter vises, og en ufullstendig import kan ikke fjerne tidligere økter ved utelatelse.

Grensene er 2 MB per kalender, 5000 økter per semester og 20000 utvidelser av gjentakelser. For store eller ugyldige kalendere avvises med en forklaring. Lenkehenting tillater offentlige HTTPS-adresser, kontrollerer omdirigeringer, begrenser svartid og størrelse og avviser private nettverksadresser.

## Kontroll og testdata

Åpne **Innstillinger** (på mobil under **Mer**) for **Data og sikkerhetskopi**, med eksport til en lokal JSON-fil og forhåndsvist gjenoppretting fra filen brukeren velger. Gjenoppretting erstatter data uttrykkelig og tar først vare på en lokal, gjenopprettbar kopi. Tilgangsopplysninger eksporteres ikke; kalenderlenker kan kreve ny tilkobling etter filgjenoppretting. Ingen sikkerhetskopi lastes opp. **Angre siste endring** og **Papirkurv** bevarer tidligere verdier og relasjoner, i stedet for å sette generiske standardverdier.

Kalendersiden har dag, uke, måned og agenda. Undervisning og studieøkter er tidsblokker; oppgavefrister er tidspunkter uten oppdiktet varighet. Arbeidstid og andre opptatte perioder registreres under **Kapasitet**. En studieøkt knyttet til en oppgave reserverer tid, men reduserer ikke automatisk gjenstående arbeid.

`npm test` kjører domene-, lagrings-, kapasitets- og importtester. `npm run test:e2e` kjører nettleserflytene, inkludert import, manuell registrering, oppgaveåpning, tidsvalg, feilhåndtering og mobilvisning. `npm run build` kontrollerer produksjonsbygget.

De nye testene bruker egne nettleserkontekster og tydelig merkede testemner, oppgaver og kalenderhendelser. Offentlig NTNU-kontroll ble utført separat uten å skrive i brukerens nettleserlagring. Automatiske tester bruker testdata og simulerte nettverksfeil; de er ikke avhengige av NTNU for å kjøre.

Tidligere kildekontroll 8. september 2026, før targeted-reviewpatch: Integrasjonen hentet TDT4110 høst 2026 med
navn, 7,5 studiepoeng, beskrivelse og 140 undervisningshendelser fra TP. Appens
importtjeneste på `http://studieplan.localhost/` returnerte også emneinformasjonen
med HTTP 200. Flere paralleller finnes i dette materialet og må velges i
forhåndsvisningen. Kontrollen omfatter denne offentlige emnekalenderen; Feide-
beskyttede personlige kalendere er fortsatt ikke tilgjengelige direkte.

Ubegrensede, svært tette sekundgjentakelser avvises før kostbar utvidelse.
Avgrensede gjentakelser, unntak og tidssoner behandles fortsatt av kalenderparseren.

## Bevarte presiseringer fra tidligere sluttkontroll 2026-09-08

TP-aktiviteter med skiftende kilde-ID sammenholdes med innhold og parallelle grupper, ikke bare identisk navn og tid. Tvetydige treff avvises fremfor å slå sammen forskjellige aktiviteter. Lokale hendelses-ID-er og brukerens merknader beholdes når en ekstern kilde-ID oppdateres.

Forhåndsvisning og lagring bruker samme importbeslutning. Uttrykkelig utvalg/utelatelse skilles fra at en kilde bare mangler data. Nye grupper fra en kalenderlenke forblir uavklarte gjennom senere oppdateringer til brukeren velger. Forsinkede svar fra en erstattet tilkobling avvises.

Sikkerhetskopi skjer bare til lokal fil. Eksporten utelater tilkoblingshemmeligheter; etter gjenoppretting kan en kalenderkilde be om lenken på nytt. Åpne kildens tilkoblingsdetaljer, angi kalenderlenken, velg «Lagre tilkobling» og «Oppdater nå». Denne flyten er kontrollert med ekte NTNU-undervisning og beholdt de samme 14 hendelses-ID-ene uten duplikater.

Se `WORK-STATUS.md`, `VERIFICATION.md` og `IMPORT-COVERAGE.md` for datert status og faktiske kildebegrensninger. Appen sender ikke private oppgaver, notater eller sikkerhetskopier til importtjenestene.
