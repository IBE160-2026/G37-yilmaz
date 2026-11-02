# Ajour

**[Åpne Ajour i nettleseren](https://ajour-sooty.vercel.app/) — Ingen installasjon nødvendig.** Du trenger verken konto, nøkler eller en betalt tjeneste.

Ajour hjelper deg å gjøre oppgaver og tilgjengelig tid om til en plan: **oppgave → valgfritt arbeidssteg → godkjent studieøkt → utfall → justering**. Du kontrollerer import og forslag før lagring. Appen bruker lokale regler, ikke generativ KI under kjøring.

Planen lagres i nettleserprofilen på den nøyaktige nettadressen. Bruk samme adresse og profil, og ta [sikkerhetskopi](#sikkerhetskopi-og-lagring) jevnlig. Data synkroniseres ikke mellom enheter; sletting av nettstedets data eller lukking av et privat nettleservindu kan slette planen.

| Det du vil gjøre | Gå til |
| --- | --- |
| Lage første oppgave og økt | [Kom i gang og finn frem](#kom-i-gang-og-finn-frem) |
| Ta vare på eller flytte planen | [Sikkerhetskopi og lagring](#sikkerhetskopi-og-lagring) |
| Hente emner, dokumenter eller kalender | [Importer en bekreftbar plan](#importer-en-bekreftbar-plan) og [filer og kalenderlenker](#importer-filer-og-kalenderlenker) |
| Kjøre appen lokalt eller kontrollere kode | [Lokale driftsformer](#lokale-driftsformer) og [tester og bygg](#tester-og-bygg) |
| Finne prosjektet og leveringsgrunnlaget | [Leveringsoversikt for G37 i IBE160](../README.md#leveringsoversikt--1-november-2026), [planindeks](../.docs/planning-artifacts/README.md) og [daterte kontroller](VERIFICATION.md) |

## Kom i gang og finn frem

1. Åpne [Ajour](https://ajour-sooty.vercel.app/). «Kom i gang» hjelper deg med første emne, oppgave og studieøkt. Du kan hoppe over steg og fortsette senere fra **Innstillinger**.
2. Opprett en oppgave, for eksempel «Les eksempelkapittel». Bare **tittel** er obligatorisk; emne, frist og arbeid kan stå ukjent.
3. Åpne **Se planforslag**, velg når du kan jobbe, og kontroller oppgave, dato, klokkeslett og varighet før **Bruk planen**.
4. Etter økten åpner du **Planlegg uken** (på mobil via **Mer**), finner økten under **Studieøktene dine** og velger **Avslutt økt**. Velg **Utført**, **Trenger mer tid** eller **Ikke utført**, registrer faktisk tid og gjenstående arbeid hver for seg, og trykk **Lagre utfallet**.
5. Kontroller eventuelle justeringer før du godkjenner dem. En godkjent planendring kan angres.

Fullført arbeidssteg, ferdig oppgave og bekreftet innlevering er separate handlinger. Planlagt tid betyr ikke utført arbeid, og logget tid dokumenterer ikke mestring.

- **Oversikt:** dagens aktiviteter, uavklarte frister og ett begrunnet hovedforslag, med alternativer.
- **Kalender:** undervisning, andre aktiviteter, frister og reserverte studieøkter, vist som dag, uke eller agenda.
- **Alle oppgaver:** hele arbeidslisten. «Denne uken» er et oppgavefilter.
- **Mine emner:** fag, emnekoblinger og samlet import.
- **Planlegg uken:** tilgjengelig arbeidstid, faste opptatte tidsrom, kapasitet og planforslag.

På mobil ligger hovedmålene i toppnavigasjonen; øvrige valg ligger under **Mer**. **Innstillinger** samler sikkerhetskopi, angre/papirkurv, oppstart og personlige estimater. Import og manuell registrering kan kombineres; et nylig importert emne kan være forhåndsvalgt for oppgaven.

<a id="lagring-og-sikkerhetskopi"></a>

## Sikkerhetskopi og lagring

Velg **Innstillinger → Data og sikkerhetskopi → Eksporter sikkerhetskopi**, og oppbevar JSON-filen privat utenfor kildekoden. Ved flytting til en annen adresse, profil eller enhet åpner du Ajour der og velger **Innstillinger → Data og sikkerhetskopi → Importer sikkerhetskopi**. Velg filen, kontroller forhåndsvisningen og bekreft med **Erstatt lokale data**. Ta en ny kopi før du erstatter en eksisterende plan; en ukjent kopi kan først prøves i en separat nettleserprofil.

Filer over **20 000 000 byte (20 MB)** avvises før forhåndsvisning i alle driftsformer, også lokal Node-/Docker-drift. Dette er en fast importgrense, separat fra nettleserens lagringskvote.

En portabel sikkerhetskopi bevarer opplysninger og relasjoner, men utelater kalenderforbindelser og kjente tilgangsnøkler. Kildene må kobles til igjen. **Tema og emnefargepreferanser inngår ikke i sikkerhetskopien.** En full kopi kan inneholde tidligere opplysninger i Angre-historikk og papirkurv. Sletting i appen endrer ikke filer som allerede er lastet ned, og komprimering er ikke kryptering.

Når gjenopprettingen endrer planen, lagres og kontrolleres en lokal kopi av forrige tilstand først. **Gjenopprett forrige kopi** kan hente den tilbake. I nettutgaven ligger denne kopien i nettstedets nettleserlagring og kan forsvinne sammen med planen når nettleserdata slettes. Den nedlastede JSON-filen oppbevares separat og slettes ikke sammen med nettstedets data. Kalenderens ICS-eksport er bare en kalenderkopi og erstatter ikke en full sikkerhetskopi.

| Utgave | Hvor planen lagres | Hva du må ta vare på |
| --- | --- | --- |
| Publisert nettutgave og lokal Vite-utvikling | Nettleserens `localStorage`, separat for hver adresse og profil | Bruk én redigerende fane. Sletting av nettleserdata kan slette planen. Privat modus er egnet til en kort prøve, ikke varig oppbevaring. |
| Lokal Node-server | SQLite-filen angitt i `STUDIEPLAN_DB` | Start med samme databasefil for å beholde planen. Nettleserdata er ikke serverens database. |
| Docker | SQLite i det navngitte volumet `studieplan-data` | Behold volumet ved stopp og oppdatering; `docker compose down -v` fjerner data. |

Den synlige eksport-/gjenopprettingsflyten brukes i alle utgaver. En nedlastet appbackup er ikke en kopi av hele Docker-volumet. Sletting av nettleserdata sletter ikke Node-/Docker-databasen, men kan fjerne eldre nettleserdata som ennå ikke er importert. [Kalender og lokale data](#kalender-og-lokale-data) beskriver kompatibilitet, kvote og konflikter.

## Oppgaver, arbeidssteg og egenvurdering

**Se planforslag** planlegger arbeid på oppgaven, også når den har arbeidssteg. Et steg blir ikke valgt automatisk for disse kalenderøktene. **Start** på oversikten kan derimot vise et bestemt startklart steg. Stegnavnet følger da med til **Hva skjedde?**, og arbeidsloggen bevarer identiteten til akkurat dette steget ved senere navneendring eller omrekkefølge. **Gjenstående arbeid for hele oppgaven** er et nytt anslag du velger selv, separat fra faktiske minutter og stegets fullføring. [Den daterte tekniske kontrollen](../.docs/implementation-artifacts/work-step-identity-2026-11-02.md) forklarer skillet og rettingen.

Eldre arbeidslogger uten entydig stegkobling beholdes slik de er. Sikkerhetskopi og lokal SQLite bevarer nye, uttrykkelige stegkoblinger sammen med oppgavekopien fra registreringen; de konstruerer ikke koblinger for eldre arbeid.

En oppgave trenger bare **tittel**. Frist kan være bare dato eller dato med klokkeslett; en dato uten tid beholdes og eksporteres som heldagsfrist. Emne, prioritet, avhengigheter og oppgavetype finnes under «Flere detaljer». Gjenstående arbeid kan være et intervall; «Vet ikke» er ukjent, ikke null, og en åpen øvre grense bevares som åpen. Null minutter markerer ikke oppgaven som ferdig. Ved validerings- eller lagringsfeil beholdes utkastet.

Arbeidssteg er en ordnet del av oppgaven. Eldre «neste steg» vises også når oppgaven allerede har en stegliste; åpning skriver ingenting. Ved lagring får det en deterministisk ID uten å endre eksisterende ID-er eller rekkefølge. Bare eksplisitt eldre opphav med nøyaktig samme innhold slås sammen; senere fullføring, notater og forutsetninger bevares. Et steg som andre steg bruker som forutsetning kan ikke fjernes før disse koblingene er redigert. Stegestimater legges ikke til oppgavens gjenstående arbeid. Dokumentforslag skiller eksplisitte krav, foreslått arbeidsmåte og uavklarte opplysninger, og skriver ingenting før samlet godkjenning.

Gyldig eldre stegtekst og avledede ID-er beholdes også når de er lengre enn de nyere feltgrensene. Etter sletting med tastatur flyttes fokus til et gjenværende steg eller knappen for å legge til et steg. Ved avvist lagring beholdes utkastet for nytt forsøk.

Egenvurdering er valgfri og bruker valgene «Trenger hjelp», «Forstår med støtte», «Kan forklare selv» og «Hopp over». Daterte vurderinger kan vises, endres eller slettes, og repetisjonsforslag kan slås av per tema. Ukjent eksamensdato eller manglende kollisjonsfri kapasitet vises som usikkerhet. Repetisjon blir først en vanlig studieøkt etter at studenten godkjenner eller justerer forslaget. Avvisning og utsettelse lagres som beslutninger slik at samme vurdering ikke foreslås flere ganger.

Vurderingen gjelder **temaet**. Temaet kan ha oppgave-/emnekobling; en levende eller historisk økt er uavhengig, valgfri kontekst og kan høre til en annen oppgave eller være uten oppgave. Automatisk arbeidsavslutning bruker bare den faktisk avsluttede, validerte økten. Visningen merker historisk kontekst med lagret tidspunkt og oppgavenavn; manglende opplysninger oppgis som ukjente. Gjenbruk av tema forhåndsutfyller eksamensdatoen. En uttrykkelig tømming fjerner datoen og opphever framtidige repetisjonsvalg etter samme regler som temaeditoren, mens ferdig repetisjon og tidligere vurderinger bevares.

En økt som allerede er brukt som vurderingskontekst beholdes ved endrede temainnstillinger. Hvis vurderingen som eier repetisjonsforslaget endres eller slettes, kan den refererte økten beholdes som en vanlig økt med samme identitet og tidspunkt; andre vurderinger blir ikke omkoblet eller slettet.

«Eksporter kalender» ligger øverst i kalendervisningen og kan laste ned valgte lagrede studieøkter og frister som `.ics`; undervisning er et uttrykkelig tillegg. Dialogen viser antallet i filen og navngir hver utelatt frist med forklaring, for eksempel tvetydig klokkeslett ved vintertid. Tomt utvalg kan ikke lastes ned. Repetisjon uten oppgave bruker temanavnet eller «Repetisjon (tema ikke tilgjengelig)» når temaet mangler. Hver frist eksporteres én gang som en transparent kalenderhendelse uten oppdiktet sluttid. Filen bruker stabile, ugjennomsiktige UID-er, norsk tid konvertert til korrekte tidspunkter og standard linjefolding. Eksporten er en kopi, ikke synkronisering, og inneholder ikke dokumentutdrag eller andre private forhåndsvisningsfelt.

Repetisjonsforhåndsvisningen bruker samme temainnstillinger og oppheving av ubrukte planer som lagringen. Når tema eller dato endres, fjernes foreldede automatiske tider og tidligere godkjenning. Tider studenten selv har redigert beholdes, men krever et nytt uttrykkelig valg. Historiske oppgavenavn vises bare fra riktig lagret øyeblikksbilde; ellers oppgis at det historiske navnet er ukjent.

Planvinduet kan sammenligne gjeldende kapasitet, redusert kapasitet og prioriterte oppgaver fra samme lagrede revisjon og klokkeslett. Alternativene viser fordelt tid, mangel, flyttinger, utelatelser og usikkerhet. Bare valgt alternativ kan brukes; et forslag med foreldet grunnlag avvises, og den vanlige historikken gjør den sammensatte lagringen angrebar.

Etter lagring åpner **Se planforslag** uten å kreve detaljert tilgjengelighet. Første gang kan studenten velge dagtid på hverdager (09–15), kveld på hverdager (18–20), helg (10–14), «Det varierer» eller detaljert tilpasning. Et valgt gjentakende mønster lagres og gjenbrukes som preferanse; det registreres ikke som bekreftet kapasitet. Uten valg viser appen bare ett tydelig merket, betinget forslag på 30 minutter. Ukjent arbeidsmengde gir en kort startøkt, ikke et anslag for hele oppgaven.

## Fleksibel tekstregistrering og egne aktiviteter

Trykk **Lag forslag** etter å ha skrevet en kort oppgavetittel, for eksempel «Øve på koding». Tittel er eneste obligatoriske opplysning; emne, frist og arbeid kan stå ukjent. «Uten emne»/«ikke et emne» fjerner emnet, og «vet ikke»/«mye» betyr ukjent arbeid, ikke null. Spørsmål og uklare flytte-, endre- eller sletteønsker lagres ikke automatisk. Korte datoer bruker inneværende Oslo-år; hvis datoen allerede er passert, må år velges uttrykkelig.

Et kjent intervall som «Tannlege 4.10 kl. 12–13» foreslås som en egen aktivitet uten emne eller importkilde. «Egen aktivitet: Ring banken 4.10» beholder ukjent klokkeslett, og en aktivitet med bare start beholder ukjent varighet. Bare komplette start-/sluttintervaller reserverer kapasitet; ufullstendige tider vises som usikkerhet. Egne aktiviteter kan redigeres eller slettes fra emne-/aktivitetsflaten og tas bare med i kalenderkopien når **Egne aktiviteter** velges uttrykkelig.

## Importer en bekreftbar plan

**Mine emner → Importer** åpner [import av filer og kalenderlenker](#importer-filer-og-kalenderlenker). **Finn studieprogram** åpner den egne programflyten. Den daterte [dekningsoversikten](IMPORT-COVERAGE.md) beskriver 48 programadaptere og 49 læresteder, med kildebegrensninger. Antallet betyr ikke nasjonal dekning; et prøvd program eller emne bekrefter bare den konkrete flyten.

**V1 er avgrenset til HiMolde IT 2026–27 og et NTNU-emneutvalg høst 2026.** HiMolde omfatter IBE110/IBE430 og kildevalget IBE160 eller IBE102 + IBE152; undervisning er prøvd for IBE110/IBE430/IBE160 høsten 2026. NTNU omfatter emnemetadata og emnelenket undervisning for ARK1001/EXPH0100 høsten 2026. Komplett NTNU-program, full eksamensdekning og personlig gruppetilhørighet er ikke lovet. [Briefen](../brief.md#hovedflyt-og-låst-v1) angir det avtalte omfanget; nasjonal dekning er framtidsvisjon.

Velg publisert programutgave, opptakskull, studiesemester og kalendersemester uttrykkelig når kilden trenger dem. Campus vises bare når kilden gir et reelt valg. Påkrevde emner vises separat fra kildepubliserte alternativer; ingen alternativ gren velges for studenten, og studiepoengsum brukes bare som informasjon. Et manglende emne kan søkes opp eller registreres som en tydelig uverifisert post uten at programkonteksten må fylles inn på nytt. Det påbegynte utvalget beholdes ved kildefeil, tilbakegang og omlasting i samme fane, men regnes ikke som importert. Tilgjengelig undervisning kan kontrolleres samlet, men hvert emne beholder statusen «klar», «ingen treff», «feil» eller «krever tilgang», og bare mislykkede kilder prøves på nytt. Gruppemedlemskap utledes aldri fra et treff. Emner og vellykket undervisning lagres med én bekreftelse; kvitteringen sier presist hvor undervisning faktisk ble importert. Offentlig undervisning kan også hentes for et emne som allerede er lagret, selv når programimport mangler.

Kalenderpanelet har tre valg som åpnes ett om gangen: fil/lenke, offentlig institusjonskalender og undervisning for et lagret emne. Aktiviteter må velges før lagring. Kildeopplysninger og mangler kan åpnes i forhåndsvisningen. Kalenderinformasjon, faktiske undervisningsaktiviteter og innleveringsfrister holdes adskilt.

Dokumentimport støtter innlimt tekst, tekstbasert PDF, DOCX, CSV og ICS. Filene leses lokalt, med grenser på 10 MB for PDF/DOCX, 100 PDF-sider og 2 MB for tekst/CSV/ICS. Skannede eller uleselige dokumenter får en forklaring og vei til innlimt tekst/manuell registrering. Appen utfører ikke dokumentinnhold eller laster eksterne dokumentressurser.

Forhåndsvisningen viser forslag til emner, oppgaver, frister og aktiviteter med kildeutdrag. Rett felter, velg bort rader og koble til eksisterende emner. Uklare datoer, manglende år, ufortolkede fristuttrykk og usikre koblinger må avklares eller uttrykkelig utelates. For en frist kan du velge dato, dato uten klokkeslett eller **Uten frist**; ingen valgt rad som krever avklaring kan lagres. Feil åpner den berørte raden og flytter fokus til feltet. Kildevarsler om eksempelvis uleselige PDF-sider bevares etter lagring og vises ved senere oppdatering. Ingenting lagres før bekreftelse.

Gjentatt import bevarer stabile identiteter og egne endringer. Endrede dokumenter kan kobles til en tidligere kilde; usikkert samsvar og konflikter krever valg. Kalenderlenker valgt som synkronisering oppdateres mens appen er åpen, med ventetid ved kildefeil. Tidligere data beholdes ved feil. Private lenker og tilgangsnøkler lagres lokalt; filer og lenker valgt som øyeblikksbilder oppdateres ikke automatisk. Enkelte offentlige kilder har ustabile ID-er eller ukjent fullstendighet, slik at en flyttet aktivitet må avklares manuelt. Se [importbeskrivelsen](IMPORT.md).

Programimporten kan forberede undervisning i samme gjennomgang når det finnes nøyaktig ett offentlig treff med identisk emnekode. Vanlige, eksplisitt kildeetiketterte serier kan foreslås; nummererte paralleller og grupper velges aldri automatisk. Åpne detaljer, fokus og rulleposisjon beholdes ved lokale oppdateringer, og emnekode samt deterministisk farge følger undervisning, frister og studieøkter i kalender- og agendavisningene.

<a id="import-files-and-calendar-links"></a>

## Importer filer og kalenderlenker

Åpne **Mine emner → Importer**, velg en fil eller **Fra kalenderlenke**, og trykk **Vis forhåndsvisning**. Kontroller antall, datoer og varsler, avklar det som mangler, og velg **Importer valgte** for å lagre hele utvalget samlet. Kvitteringen viser hva som ble lagret og utelatt. Når importen endrer data, tilbys **Åpne kalenderen** og **Angre importen**. Valgfrie innstillinger ligger under **Kilde og kalenderperiode**; datoene i filen gjelder inntil du velger et manuelt semester-/årsfilter.

Hvert emne viser lærested. **Filen inneholder flere læresteder** åpner valg per emne, og **Ukjent / velg senere** er gyldig. Et felles lærestedsvalg fyller bare emner med ukjent lærested. Eksisterende navn, lenker og identiteter beholdes; bytte av etablert lærested krever uttrykkelig samtykke. En gjenkjent TP CSV kan beholde tydelig merkede foreløpige navn. Publiserte grupper og enkeltunntak kan velges, men appen gjetter aldri din personlige gruppe.

En entydig emnekode kan også stå senere i aktivitetstittelen. Gjenkjenning av emnet gjør ikke aktiviteten til eksamen eller frist. Tvetydige koder eller læresteder krever et felles emnevalg for de berørte radene. Eldre importer uten registrert valggrunnlag spør én gang per berørt emne om koblingen skal rettes eller **Uten emne** beholdes; valget huskes ved uendret gjenimport. Uttrykkelige valg og manuelle endringer beholdes. Importert opphav og senere egne endringer vises hver for seg.

Et usikkert tidspunkt viser aktivitet, dato og tid med en kort begrunnelse. Velg **Vis som tidspunkt uten varighet**, **Rett tiden** eller **Ikke importer denne**. Et tidspunkt krever gyldig start, reserverer ingen varighet og oppretter ingen frist. Tidspunkter fra kilden og brukerens egne valg holdes adskilt; nøyaktige sekunder beholdes. Et gyldig intervall i en nyere kildeversjon erstatter et foreldet punktvalg, mens endret usikker tid krever et nytt valg. Også en eldre import kan kreve nytt valg når tidligere kildetider ikke kan sammenlignes sikkert. Uendrede tider beholder gyldige valg. Oppsummeringen av klare/uavklarte rader og **Importer valgte** er tilgjengelige mens du gjennomgår radene.

Ugyldige ICS-datoer forklares med berørt kalenderkomponent og antall utelatelser, uten å flytte dem stille til en annen dato. Andre gyldige komponenter kan fortsatt importeres. Heldagshendelser, oppføringer uten slutt og støttede tidssoner/gjentakelser beholdes innen de dokumenterte grensene. Eksporten markerer opptatt tid ut fra faktisk reservasjon; punkter og frister får ingen oppdiktet slutt. Den nedlastede filen er en kopi og synkroniseres ikke.

Kontroller **Blir med** og **Utelates** før eksport, også nøyaktige tider og årsaker. Standard ICS har presisjon på hele sekunder. Oppføringer som trenger brøkdeler av sekunder utelates uttrykkelig fra filforslaget, uten avrunding eller endring av lagret tid. Undervisning/informasjon som ikke reserverer tid faller utenfor det eksisterende undervisningsutvalget og listes som utelatt. Overlappende egne aktiviteter og støttede heldagsdatoer beholder intervall- eller DATE-betydningen sin. Tomt utvalg kan ikke lastes ned. Den gjentatte høsttimen viser de ulike UTC-avvikene i detaljene. TP-aktiviteter i januar beholder høstemnet når kilden uttrykkelig plasserer dem der.

Filer og øyeblikksbilder av lenker er kopier. Bruk den lagrede dokumentkildens oppdateringsvalg for en endret fil fra samme kilde; manglende hendelser slettes ikke automatisk. ICS, PDF, DOCX, CSV og innlimt tekst støttes gjennom samme inngang. CSV oppdager UTF-8/UTF-16 med BOM; Windows-1252 og UTF-16 uten BOM kan velges uttrykkelig. **Ser teksten riktig ut?** viser eksempler før usikker tegnkoding godtas. Ugyldige tegn erstattes aldri stille. Komma, semikolon og tabulator med siterte verdier støttes; XLSX støttes ikke. Uendelige ICS-regler utvides innen det forklarte seksmånedersvinduet, mens uttrykkelige senere RDATE-verdier vurderes separat innen importgrensene. For store inndata avvises. Tilsvarende UTC-/TZID-kanselleringer bruker hendelsens faktiske tidspunkt; en eldre kansellering uten tilstrekkelig identitet forklares uten å gjette eller slette en annen aktivitet. Se [daterte resultater og grenser](VERIFICATION.md).

Under **Fra kalenderlenke** kan du hente et **øyeblikksbilde** og avklare emner i samme forhåndsvisning uten først å opprette dem. **Synkronisering for ett lagret emne** beholder den eksisterende oppdateringsavtalen. TP-visning støttes bare for én offentlig emne-/terminoppføring på `tp.educloud.no/<institusjon>/app/schedule` med `semester`, `scheduleType=course` og `course`, hos UiO, UiB, UiT, OsloMet, Nord, INN, UiS, UiA, HiMolde og HiØ (allerede eksisterende TP-adapter). Semester og kildevalg kontrolleres mot publiserte data. Personlige visninger, innlogging og andre nettsider tolkes ikke som kalendere; bruk sidens iCalendar-/ICS-eksport eller last ned en `.ics`-fil. Et kildebytte rydder gammel lenkefeil og hindrer forsinkede svar i å endre den nye importen.

## Planlegg og oppdater fremdrift

Registrer og bekreft arbeidsvinduer og faste opptatte tidsrom under «Planlegg uken». Undervisning og overlapp trekkes fra kapasiteten; samme opptatte minutt telles én gang. Manglende arbeidsvinduer eller tidsestimater gir usikkerhet, ikke et oppdiktet kapasitetsoverskudd. Minuttsummen er en kapasitetsoversikt; det konkrete planforslaget kontrollerer også øktlengder, pauser og tidsskifte.

«Status i dag» forklarer registrert arbeid mot reell kapasitet. «Jeg har tid nå» oppdaterer opptil tre begrunnede forslag straks du velger 15, 30, 45, 60 eller egendefinert tid. «Se realistisk forslag» viser konkrete nye, delte eller flyttede reservasjoner, påvirkning på andre oppgaver og eventuelt restunderskudd før du godkjenner. Forslaget respekterer faste aktiviteter, låste studieøkter, frister, avhengigheter, delingsvalg, øktlengder og pauser. Godkjenning og angre behandler planendringen samlet.

Det oppgavenære forslaget viser oppgave, dag, klokkeslett, varighet og forutsetninger som lesbar tekst. **Flytt** tilbyr først kontrollerte alternativer; dato- og tidsfelt vises først etter **Velg tidspunkt selv**. Flytting endrer bare utkastet. **Bruk planen** kontrollerer grunnlaget på nytt og lagrer nøyaktig de viste øktene; **Ikke nå** skriver ingenting, gjentatt godkjenning lager ingen duplikater, og **Angre** gjenoppretter tilstanden før planendringen. Registrerte arbeidsvinduer og avtaler er autoritative; en tom kalender fremstilles aldri som bekreftet fritid.

Planlagt tid betyr ikke utført arbeid. Etter en planlagt økt eller arbeid registrert i etterkant velger du:

- **Utført:** det aktuelle arbeidssteget fullføres. Hele oppgaven og innlevering avklares separat.
- **Trenger mer tid:** oppgi nytt anslag på gjenstående arbeid eller «Vet ikke».
- **Ikke utført:** ingen faktisk arbeidstid eller fremdrift registreres, og ingen økter flyttes automatisk.

Faktisk arbeidstid er valgfri og trekkes ikke automatisk fra gjenstående arbeid. En økt med 30 minutter faktisk arbeid kan derfor ende med 45 minutter gjenstående. Gjentatte klikk registrerer ikke samme økt flere ganger. Angre gjenoppretter oppgave, arbeidshistorikk og berørte reservasjoner samlet.

En startklar oppgave med **Kan deles i flere økter** kan foreslås som en kort økt også uten arbeidssteg. **Totalt gjenstående arbeid** gjelder hele oppgaven, mens **Hvor lenge vil du jobbe nå?** gjelder økten. Forslag og oppstart endrer ikke anslaget; etter en deløkt er **Trenger mer tid** forhåndsvalgt. Reelle blokkeringer og arbeid som ikke kan deles begrenser fortsatt forslagene. Forutsetninger er eksisterende oppgaver som må gjøres først; **Fjern alle forutsetninger** endrer bare utkastet fram til lagring.

Registrer «må gjøres etter», venting og ett eller flere ordnede arbeidssteg i oppgaven. Steg kan fullføres, gjenåpnes, flyttes eller slettes uten at selve oppgaven slettes eller automatisk markeres ferdig. Et registrert avklaringssteg kan foreslås før annet arbeid; blokkerte oppgaver vises ikke som startklare. Fristen til arbeid som avhenger av en oppgave kan gjøre den viktig å starte nå; begrunnelsen viser den registrerte sammenhengen. En større oppgave kan foreslås som en deløkt med forklaring. Appen sender ingen meldinger eller e-post. «Klar til levering» og «Levert» krever forskjellige handlinger.

Personlige estimater bruker lokale medianer først ved minst fem relevante fullførte oppgaver med bekreftet fullstendig arbeidstid, eller fem utførte økter uten avbrudd for øktlengde. Hele oppgaver og deløkter vurderes hver for seg; gjenåpnet arbeid teller ikke som en fullført oppgave. Under «Øktlengde og pauser» kan du bruke eller rette et personlig øktforslag og beregne en ny plan før bekreftelse. Grenser og pauser endres ikke av forslaget. Datagrunnlag og usikkerhet vises, og forslag endrer ikke estimater eller planer før du velger dem. Slå av personalisering eller slett arbeidshistorikken i innstillingene. Sletting fjerner også historikken fra appens gjenopprettingskopi og tilhørende angre/papirkurv; tidligere nedlastede sikkerhetskopier endres ikke.

## Kalender og lokale data

Under Oversikt og Alle oppgaver kan du skrive én lokal, regelbasert handling: opprette en oppgave, endre en frist eller endre gjenstående arbeid. Forslaget viser konkrete Oslo-datoer og kan redigeres før én bekreftelse. Oppgave- og emnenavn må matche nøyaktig; som et avgrenset norsk alias kan entydig `rapporten` vise til oppgaven `rapport`, men tvetydighet gir alltid et eksplisitt valg med emne/frist. Ukjent emne beholder de forståtte feltene for korreksjon. Flere handlinger og foreldede forslag avvises uten delvis lagring. Råteksten lagres ikke, og funksjonen bruker verken KI eller nettverk. Støttede alias er `legg til`/`opprett`/`ny oppgave`, `frist`/`leveres` og `gjenstår`/`gjenstående arbeid`. Eksempler er `Legg til rapport i IBE160 med frist fredag kl. 14.`, `Ny oppgave: Les kapittel 3.`, `Endre fristen på rapporten til 12. oktober.` og `Sett gjenstående arbeid på rapporten til to timer.`

Importerte eksamener beholder et strukturert aktivitetsmerke gjennom oppdatering og lagring. Strukturert `assessment` beholdes som generell vurdering og blir ikke automatisk eksamen, heller ikke for transparente punktoppføringer. Dokumentimporterte hendelser og forhåndsvisningen bruker uttrykkelig aktivitetstype, ikke titteltolkning. For manuelle og eldre kalenderhendelser uten dokumentimportopphav beholdes gjenkjenning når tittelen eksplisitt sier «eksamen», `exam` eller `examination`; eksamensforberedelse, prøve-/mockeksamen, forelesninger om eksamen og generelle vurderingsord behandles ikke som eksamen. Kalender, agenda, dagsoversikt og emnevisning viser `📝 Eksamen`, emnet og en egen aksent uten å endre undervisningsfilter, tidsreservasjon eller eksportvalg.

Kalenderens ukevisning kan vise hele uken eller arbeidsuken. På mobil er dagvisningen standard. Dato, kalenderfiltre, ukemodus og rulleposisjon bevares gjennom navigasjon og sikkerhetskopi. Korte eller overlappende hendelser beholder faktisk varighet og har lesbare detaljkontroller; lange titler kan åpnes i sin helhet. Dagsoversikten samler økter og frist for samme oppgave.

Appen bruker fortsatt `studieplanlegger:v1` med valgfrie nye felt. Støttede eldre sikkerhetskopier kan åpnes. Oppstart skriver ikke om gammel lagring; uleselige data sperrer endring og gir gjenopprettingsvalg. Vite-utvikling og Vercel-utgaven bruker nettleserlagring og bør ha én redigerende fane. Lokal Node-/Docker-modus bruker SQLite med revisjonskontroll: en foreldet skriving avvises som konflikt og krever ny innlesing, slik at nyere serverdata ikke overskrives stille.

Identisk filimport lager ikke en ny angrekopi bare fordi importen gjentas senere; reelle endringer kan fortsatt angres. Gjenoppretting av nøyaktig samme datasett skriver ingenting og beholder eventuell tidligere gjenopprettingskopi. Ved endring lagres og kontrolleres den lokale gjenopprettingskopien før planen erstattes. Store lokale kopier komprimeres tapsfritt; hoveddata og eksporterte sikkerhetskopier beholder eksisterende JSON-format. Dette øker ikke nettleserens lagringsgrense. Identisk reimport rydder ikke historikk for å skaffe plass; den eksisterende grensen på 30 nyeste Angre-oppføringer ved reelle endringer beholdes, med separat papirkurv.

Frister lagres som lokale datoer/klokkeslett, og importert undervisning vises i norsk tid. Bruk samme lokale tidssone; flytting mellom tidssoner er ikke fullstendig støttet. Ikke-eksisterende eller tvetydige klokkeslett ved tidsskifte må avklares. Studieøkter kan krysse midnatt med eksplisitt sluttdato.

Se [sikkerhetskopi og lagring](#sikkerhetskopi-og-lagring) for eksport, gjenoppretting og forskjellen mellom driftsformene. Private dokumenter, arbeidsfiler og sikkerhetskopier hører hjemme utenfor delbar kode, eventuelt i ignorerte `local-backups/`.

## Farger og utseende

Sol-/måneknappen ved logoen bytter mellom lyst og mørkt. **Innstillinger → Utseende → System / Lyst / Mørkt** velger om appen følger systemet eller et fast tema. Første bruk følger systemet, også senere systemendringer. Knappen lagrer det motsatte av temaet som vises. Byttet beholder åpne dialoger, utkast og kalenderposisjon.

Tolv samordnede emnefarger følger emnets stabile ID, også når to læresteder bruker samme kode. Ledige plasser brukes før gjenbruk; mer enn tolv emner gir forutsigbar gjenbruk. Navn, kode, aktivitetstype og status vises også som tekst. Sletting/Angre beholder fargen så langt plassen er ledig; bare nødvendige kollisjoner flyttes.

Tema (`ajour:appearance:v1`) og emnefarger (`ajour.course-colors.v1`) er separate nettleserpreferanser per adresse. De inngår **ikke** i databasen eller sikkerhetskopien. En eldre sikkerhetskopi får gyldige standardfarger når preferansene mangler. Utilgjengelig preferanselagring hindrer ikke bruk, men valget kan gå tapt ved omlasting.

## Kjente begrensninger ved levering

**Oversikt oppdatert 2. november 2026; prøvene beholder sine egne datoer.** V1 er fortsatt avgrenset til de navngitte HiMolde-/NTNU-prøvene i [briefen](../brief.md); full støtte for alle læresteder er ikke et leveringskrav. Tidligere feil og rettinger er oppsummert i [verifikasjonsoversikten](VERIFICATION.md#hva-som-ble-rettet-og-kontrollert). Tabellen beskriver restpunkter, ikke nye funksjonsbestillinger.

| Punkt og dokumentert status | Betydning for avtalt V1 og eventuell oppfølging |
| --- | --- |
| **NTNU:** Den samlede programkilden returnerte tomt før filtrering. TDT4109 fungerte og ga 115 undervisningshendelser i den tekniske kontrollen 1. november. | Komplett NTNU-programdekning er ikke lovet. Emnesøk og manuell registrering er alternativer. Kontroller katalogen på nytt bare ved et konkret behov eller kildeendring; TDT4109 erstatter ikke de navngitte V1-prøvene. |
| **UiT:** Den konkrete Applied Computer Science-PDF-en (kilde-ID 941723) har en termin-/ECTS-tabell som ikke kan tolkes som semesterfordeling. Den tidligere H-2025-bildetabellen er også begrenset. | UiT-tabellene er utenfor de navngitte V1-prøvene. Bruk manuell registrering eller en støttet kalender-/filkilde; ingen semesterfordeling gjettes. Se [importdekning](IMPORT-COVERAGE.md). |
| **Nettleserlagring:** Nettleserens lagringskvote gjelder fortsatt. Store sikkerhetskopier og samtidige redigeringer kan møte grenser selv etter rettingen. | Identisk import unngår unødvendig historikk, men lagringen er ikke ubegrenset. Oppbevar egne backuper og bruk én redigerende fane. Nettleserdata og lokal Node-/SQLite-lagring er forskjellige driftsformer. |
| **Omprøvingens omfang:** Full nettleseromstart og separat tom profil ble ikke verifisert i prosjekteierens omprøving. «Gjenopprett forrige kopi» ble tilbudt, men ikke aktivert. | Bestått gjelder de dokumenterte flytene og omlasting i samme profil. Tidligere automatiske profil-/omstartsprøver står separat i verifikasjonen og utvider ikke den manuelle prøven. Dette er en evidensgrense, ikke en ny påvist feil eller et automatisk krav om omprøving. |
| **F03 – fri tekst uten kjent importformat:** Åpent format-/tydelighetspunkt fra mengderapporten 29. oktober. Rapporten er funnet, men originalen `stress-text-005.txt` er ikke funnet eller omprøvd. | Import av vilkårlig prosa er ikke lovet. Funnet er relevant for forståelig avvisning i V1; manuell oppgaveregistrering og gjenkjente formater er alternativer. Det separate fredags-/fristavviket ble [rettet og kontrollert 2. november](VERIFICATION.md#fristavklaring-oppgavebekreftelse-og-lagringshjelp--2026-11-02); dette lukker ikke historisk F03. |
| **F05 – NHH/FHS/Samisk kildevalg:** Fortsatt åpent; ingen ny godkjenning av disse kildeflytene. | Kildene ligger utenfor de navngitte V1-prøvene. Dokumenter konkret kilde/år/valg ved senere oppfølging; eksisterende adaptere innebærer ingen generell dekningsgaranti. |
| **Bundlevarsel:** Bygget varsler om hovedbundle over 500 kB. Bygget 1. november målte 957,30 kB / 292,79 kB gzip, og fristrettingen 2. november målte 959,61 kB / 293,45 kB gzip. [Stegidentitetsrettingen 2. november](VERIFICATION.md#oppgavearbeid-og-navngitt-arbeidssteg--2026-11-02) målte 961,13 kB / 293,89 kB gzip; byggene bestod. | Varslet stopper ikke bygget, men er relevant for nedlasting og oppstart på tregt nett. Ingen konkret numerisk bundlegrense er avtalt som V1-akseptkrav. Mål ved et dokumentert ytelsesproblem før eventuell oppdeling; varslet er ikke fjernet eller løst her. |
| **Andre kildegrenser:** BI har ikke automatisk undervisningshenting; kalenderlenker utenfor kildevernet avvises med filalternativ. | Bevar kildevern og manuell/filbasert reserveflyt. Flere integrasjoner er eventuell senere utvikling. |
| **Personvern og historikk:** Tidligere eksponering står fortsatt åpen for eieroppfølging. | Kontroll av dagens filer beviser ikke ren Git-historikk. Se [dokumentert historikk og restpunkter](../.docs/implementation-artifacts/submission-audit-2026-11-01.md#git-historikk-og-gjenstående-oppfølging); denne dokumentendringen lukker dem ikke. |
| **Sikkerhetsbevis:** Tidligere verktøyblokkerte sikkerhetsprøver er ikke gjennomført. | Funksjonsprøver og avgrenset kontroll av dokumenter/fixturer bekrefter ikke full sikkerhet. Ingen sikkerhetssperrer er omgått. |

AHOs korrekte kildeårstall er beholdt: vår 2031 vises som studiesemester 10 og høst 2031 som 11. Etikettavviket er lukket innen den prøvde forhåndsvisningen; selve årshullet i kilden består. SC-07/1200–30 og prosjekteierens Outlook-prøve beholder sine tidligere beståttresultater. [Prøveplanen](../.docs/planning-artifacts/USER-TRIAL-PLAN.md) avgrenser hva som er personlig prøvd.

<a id="lokal-drift-og-utvikling"></a>

## Lokale driftsformer

Lokal kjøring er et alternativ for sensor, utvikling og egen drift. Bruk nettlenken øverst hvis du bare vil bruke Ajour.

| Valg | Forutsetning | Startadresse | Lagring |
| --- | --- | --- | --- |
| [Node-server](#lokal-node-server-med-sqlite) | Node.js 24.x og npm | `http://127.0.0.1:8080` i oppskriften | Egen SQLite-fil |
| [Docker](#full-stack-drift-med-docker) | Docker med Compose v2 | `http://127.0.0.1:8088` som standard | Navngitt SQLite-volum |
| [Vite-utvikling](#vite-utvikling-med-nettleserlagring) | Node.js 24.x og npm | `http://studieplan.localhost` | Nettleserprofil og adresse |
| [Isolert utprøving](#isolert-lokal-utprøving-av-ajour) | Node.js 24.x og npm | `http://127.0.0.1:5200` i oppskriften | Separat syntetisk SQLite-fil |

### Forbered Node og arbeidsmappe

[package.json](package.json), [Dockerfile](Dockerfile) og [CI-workflowen](../.github/workflows/ajour-quality.yml) bruker **Node.js 24.x**. Det tidligere dokumenterte Windows-oppsettet var Node.js 24.19.0 og npm 11.17.0; dette er et datert kontrollgrunnlag, ikke et nytt krav om akkurat disse patchversjonene. Installer Node fra [nodejs.org](https://nodejs.org/) ved behov.

Eksemplene bruker **PowerShell på Windows**. Kjør dem én linje om gangen. `npm.cmd` og `npx.cmd` kaller Windows-programmene direkte; på macOS/Linux brukes `npm` og `npx`, og miljøvariabler må settes med syntaksen til det aktuelle skallet.

Start i repository-roten, mappen som inneholder `brief.md` og `studieplanlegger/`:

```powershell
cd studieplanlegger
node --version
npm.cmd --version
npm.cmd ci
```

Alle lokale oppskrifter nedenfor kjøres deretter i **appmappen `studieplanlegger/`**, med mindre noe annet står uttrykkelig. Står du allerede der, skal du ikke kjøre `cd studieplanlegger` på nytt. `npm.cmd ci` installerer låste avhengigheter og trenger normalt internett. Behold `package-lock.json`. Stopp en server du selv startet før pakkeinstallasjon, siden Windows kan låse filer.

## Lokal Node-server med SQLite

Kjør i en egen PowerShell-terminal etter forberedelsen over. Velg en fast databaseplassering du vil beholde; oppskriften bruker en ignorert mappe under `artifacts/`. Serveren oppretter mappen og databaseskjemaet. `STUDIEPLAN_DB` settes uttrykkelig fordi serverens standard `/data/studieplan.sqlite` er beregnet på Docker.

```powershell
npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Bygget feilet.' }
$env:HOST = '127.0.0.1'
$env:PORT = '8080'
$env:STUDIEPLAN_DB = Join-Path $PWD 'artifacts\local-node\studieplan.sqlite'
$env:STUDIEPLAN_SEED = 'false'
Remove-Item Env:STUDIEPLAN_SEED_JSON -ErrorAction SilentlyContinue
npm.cmd start
```

Åpne **http://127.0.0.1:8080**. Første oppstart er tom. Kontroller serveren fra en annen terminal med `Invoke-RestMethod http://127.0.0.1:8080/api/health`. Ctrl+C stopper serveren. Neste gang setter du de samme miljøvariablene og kjører `npm.cmd start`; bygg på nytt etter kodeendringer. Miljøvariablene gjelder bare terminalen der de ble satt.

Bruk samme databasefil ved omstart. Ikke slett den eller eventuelle SQLite-sidefiler for å «starte på nytt» hvis planen skal beholdes. Ta sikkerhetskopi i appen før endringer i driften. En vanlig filkopi av en database i bruk er ikke oppskriften for portabel sikkerhetskopi. Hvis porten er opptatt, velg en ledig port eller avslutt din egen prøveprosess; ikke stopp en ukjent tjeneste.

## Full-stack drift med Docker

Kjør fra **appmappen `studieplanlegger/`**, der [compose.yaml](compose.yaml) ligger. Docker trenger ikke en separat lokal Node-installasjon. Forutsetning: Docker med Compose v2; kontroller med `docker compose version`. Standardoppstart krever ingen miljøfil eller nøkler. Valgfri konfigurasjon står i [.env.example](.env.example): `STUDIEPLAN_PORT` velger den lokale vertsporten (standard 8088), `STUDIEPLAN_SEED` er normalt `false`, og `STUDIEPLAN_SEED_JSON` brukes bare ved uttrykkelig valgt seed til tom database. Kopier eventuelt filen til `.env`; ekte studentdata skal ikke legges i Git. Porten bindes fortsatt til loopback. Ingen bestemt Docker Engine-patchversjon er dokumentert som testkrav.

Den komplette leveransen bygger nettleserklient, Node-server og SQLite-database fra de låste npm-avhengighetene. Node-basisbildet bruker den valgte, mutable taggen `node:24-bookworm-slim`. Skjemaet opprettes automatisk, og databasen ligger i et navngitt Docker-volum.

Start tjenesten fra appmappen:

```powershell
docker compose up --build -d
```

En allerede kjørende container tar ikke automatisk i bruk lokale kodeendringer. For å bygge og starte tjenesten med ny kode på vanlig port 8088, kjør følgende fra samme mappe når du selv vil oppdatere driften. Det eksisterende datavolumet beholdes:

```powershell
$env:STUDIEPLAN_PORT = '8088'
docker compose up -d --build studieplan
```

Åpne **http://127.0.0.1:8088**. Kontroller drift med `docker compose ps` eller `Invoke-RestMethod http://127.0.0.1:8088/api/health`, og stopp med `docker compose down`. Ikke bruk `-v` hvis dataene skal beholdes. `studieplan-data` er Compose-nøkkelen; med standard prosjektnavn blir det faktiske Docker-volumet normalt `studieplanlegger_studieplan-data`. Volumet gjør at `/data/studieplan.sqlite` overlever en ny container. Vertspubliseringen er uttrykkelig bundet til `127.0.0.1`; serveren lytter på 0.0.0.0:8080 inne i containerens eget nettverk. Dette gir tilgang via den publiserte loopback-porten og er ikke LAN-publisering av vertsporten.

En ny database starter tomt. Valgfri seed er av som standard og gjelder bare en helt tom database. Kopier `.env.example` til `.env`, sett `STUDIEPLAN_SEED=true` og oppgi en komplett validert v1-envelope på én JSON-linje i `STUDIEPLAN_SEED_JSON`. Verdien `{"schemaVersion":1,"tasks":[]}` i `.env.example` er en gyldig tom envelope. Seed overskriver aldri eksisterende data.

Ved første åpning kan en tom database finne gyldige browserdata fra samme opprinnelse. Appen viser en opptelling og ber om eksplisitt bekreftelse før den importerer en kopi. Serveren arkiverer eksakt råtekst og et fingeravtrykk; gjentakelse er en no-op, og originalen i nettleseren slettes eller omskrives aldri. Ved bytte fra en annen opprinnelse brukes eksisterende portabel eksport/gjenoppretting. Private kalenderlegitimasjoner er fortsatt utelatt og må kobles til igjen.

Den lokale Node-/Docker-leveransen bruker SQLite som autoritativ lagring. Hver sammensatt endring valideres som en komplett envelope på serveren, sammenlignes med forventet revisjon og skrives i én transaksjon før nettleserminnet oppdateres. Domeneobjekter har relasjonelle identitets-/koblingskolonner og tapsfri JSON for valgfrie leverandørfelt. Vite-utvikling og Vercel-utgaven bruker den komplette nettleserlagringen og har ingen autoritativ serverdatabase.

Ta [sikkerhetskopi i appen](#sikkerhetskopi-og-lagring) før oppdatering eller endring av lagringsoppsettet. Ikke fjern volumet for å oppdatere appen. De daterte Node-/Docker-kontrollene [nedenfor](#historisk-docker-kontroll--2026-10-01) dokumenterer tidligere prøver, ikke statusen til en kjørende lokal tjeneste.

## Isolert lokal utprøving av Ajour

Etter [Node-forberedelsen](#forbered-node-og-arbeidsmappe), kjør fra appmappen i en egen PowerShell-terminal. Dette bruker Node/SQLite på port 5200 med en separat database under ignorerte `artifacts`, uten å oppdatere Docker eller bruke vanlig lagring. Bruk et privat nettleservindu til den syntetiske utprøvingen.

```powershell
npm.cmd run build
if ($LASTEXITCODE -ne 0) { throw 'Bygget feilet.' }
$env:HOST = '127.0.0.1'
$env:PORT = '5200'
$env:STUDIEPLAN_DB = Join-Path $PWD 'artifacts\ajour-preview\studieplan.sqlite'
$env:STUDIEPLAN_SEED = 'false'
Remove-Item Env:STUDIEPLAN_SEED_JSON -ErrorAction SilentlyContinue
node server/app.js
```

Åpne **http://127.0.0.1:5200**. Første oppstart er tom; syntetiske oppgaver beholdes ved neste oppstart med samme fil. Ctrl+C stopper bare denne serveren. Hvis porten er opptatt, avslutt din egen prøveprosess eller velg en annen ledig port; ikke stopp en ukjent tjeneste. [Verifikasjonsoversikten](VERIFICATION.md#dokumenterte-resultater) oppsummerer daterte kontroller, uten å bekrefte statusen til en lokal kjørende tjeneste.

<a id="start-appen"></a>

## Vite-utvikling med nettleserlagring

Etter [Node-forberedelsen](#forbered-node-og-arbeidsmappe), kjør fra appmappen. Vite bruker nettleserlagring; denne kommandoen starter ikke SQLite-serveren:

```powershell
npm.cmd run dev
```

Åpne **http://studieplan.localhost** når serveren er klar. Terminalen må stå åpen; Ctrl+C stopper serveren. Neste gang holder det å kjøre `npm.cmd run dev` fra appmappen.

Port 80 er fast. Ved opptatt port stopper oppstarten; den velger ikke en ny adresse. På macOS/Linux kan lave porter kreve utvidede rettigheter; bruk da loopback-alternativet på port **5278** nedenfor med `npx` i stedet for `npx.cmd`. Ingen endring i Windows' hosts-fil er nødvendig i Chrome/Edge. Ikke dobbeltklikk `index.html`.

Bruk samme adresse og nettleserprofil hver gang. **Gamle data på http://localhost:5173 er beholdt der.** Start den gamle adressen med `npm.cmd run dev:legacy` ved behov. Nettleseren har separat lagring per adresse; data flyttes eller synkroniseres ikke automatisk. Bruk sikkerhetskopi og bekreftet gjenoppretting for å flytte dem.

For en isolert syntetisk prøve på en annen adresse kan du kjøre `npx.cmd vite --host 127.0.0.1 --port 5278 --strictPort` og åpne `http://127.0.0.1:5278` i et nytt privat vindu. Ctrl+C stopper denne serveren. Ta sikkerhetskopi før du lukker privat modus hvis du vil beholde prøvedataene.

## Tester og bygg

Kjør fra appmappen etter [Node-forberedelsen](#forbered-node-og-arbeidsmappe). Følgende rekkefølge tilsvarer hovedkontrollene i [CI](../.github/workflows/ajour-quality.yml):

```powershell
npm.cmd run test:unit
npm.cmd run build
npx.cmd --no-install playwright install chromium
npm.cmd run test:e2e:ci
npm.cmd run test:e2e:database
```

Stopp ved feil før neste trinn. `test:e2e:ci` trenger et ferdig bygg i `dist/` og kontrollerer den bygde nettleserutgaven med syntetiske data. CI installerer også systemavhengigheter for Chromium med `--with-deps` på Linux. `test:e2e:database` bygger appen selv, velger en ledig loopback-port og starter den faktiske Node-/SQLite-serveren med en midlertidig database som ryddes etterpå.

For den vanlige Vite-baserte nettlesersuiten og den frakoblede undervisningsmatrisen:

```powershell
npm.cmd run test:e2e
npm.cmd run verify:teaching
```

`test:e2e` bruker isolerte nettleserkontekster og en Vite-server på **127.0.0.1:5174**. `verify:teaching` bruker lagrede fixturer. Den uttrykkelige opt-in-kommandoen `npm.cmd run verify:teaching:live` krever nettverk og gjør avgrensede, skrivebeskyttede kontroller av HiMolde IBE110/IBE430/IBE160 og NTNU ARK1001/EXPH0100 uten å lagre sesjonscookie. Faktisk kildetransport telles separat fra simulerte svar og fixturer.

[Isolert akseptkontroll for lokal Node-/Docker-drift](tests/production/README.md) beskriver omstart, gjenskaping og gjenoppretting med syntetiske data. Bruk egne testprofiler, porter og databaser; prøvene skal ikke kjøres mot personlige data eller et vanlig driftsvolum. [Vercel-kontrollene](#nettleserdrift-med-vercel--2026-10-29) nedenfor gjelder den publiserte nettutgaven.

`build` lager lokale filer i `dist/` og publiserer ingenting. Prosjektet har ingen egen lint- eller typekontrollkommando. [Verifikasjonsoversikten](VERIFICATION.md) viser daterte resultater og hva kontrollene faktisk beviser.

<a id="nettleserdrift-med-vercel--2026-10-29"></a>

## Drift av nettutgaven på Vercel

**Godkjent driftsutvidelse 29. oktober 2026:** [Ajour på nett](https://ajour-sooty.vercel.app). Den godkjente driftsutvidelsen bruker det eksisterende prosjektet **`ajour` i Hobby-teamet `ajour1`**. Gjenbruk dette ene gratisprosjektet; opprett ikke separate prosjekter for forhåndsvisning og produksjon. Eieren godkjente offentlig tilgang til eksisterende og framtidige preview-adresser etter kontroll av deployenes kildegrunnlag. Automatisk domenetildeling for `main` er aktivert med nødvendig kvalitetssjekk. [Verifikasjonsoversikten](VERIFICATION.md#dokumenterte-resultater) oppsummerer daterte kontroller; [kontrolloppskriften](VERIFICATION.md#finne-og-gjenta-kontrollene) beskriver hvordan en publisert versjon knyttes til riktig commit.

Prosjektinnstillingene er repository `IBE160-2026/G37-yilmaz`, rotmappe `studieplanlegger`, rammeverk **Vite**, installasjon `npm ci`, bygg `npm run build:release`, utmappe `dist` og **Node.js 24.x**. `main` er produksjonsgren. [vercel.json](vercel.json) styrer byggesperre, API-ruting og appens inngang; `api/` eksponerer bare avgrenset, tilstandsløs import. `server/app.js` skal fortsatt bare starte den lokale Node-/SQLite-tjenesten. Nettutgaven krever ingen database, miljøhemmeligheter, konto eller betalt tjeneste.

Konfigurasjonen setter den offentlige runtimeinnstillingen `NODEJS_HELPERS=0`, slik at funksjonen kan kontrollere rå forespørselsbytes før JSON-parsing. Dette er ingen hemmelighet. Handleren støtter også plattformer som allerede har tolket JSON, men rå bytegrense er den foretrukne Vercel-banen. Importfunksjonen har 60 sekunders plattformgrense og avslutter selv forespørselen etter 50 sekunder.

Ved eventuell CLI-publisering kjøres Vercel fra **repository-roten**, siden prosjektets rotmappe allerede er `studieplanlegger`. `.vercelignore` begrenser opplastingen til bygg-/kjøretidskilder og den lille releasetestpakken; `.gitignore` alene er ikke Vercels opplastingsfilter. Kontroller filutvalget med `vercel deploy --dry --json` før opplasting. Et nytt prosjekt kan få sin aller første deploy klassifisert som produksjon selv med eksplisitt preview. [Vercels egen forklaring](https://github.com/vercel/vercel/pull/17206) og [publisering uten domenetildeling](https://vercel.com/docs/cli/deploying-from-cli#deploying-a-staged-production-build) beskriver dette. Kontroller faktisk `target`, alias og tilgang etter opprettelsen; et grønt bygg eller en ønsket preview-etikett er ikke publiseringsgodkjenning.

Nettutgaven bruker [nettleserlagring og portabel sikkerhetskopi](#sikkerhetskopi-og-lagring), uten delt studentdatabase eller synkronisering. En ny publisering på samme adresse bruker samme nettleserlagring; en annen preview-adresse har egne data.

Gjenkjente kildeintegrasjoner beholdes med sine eksisterende begrensninger. Den offentlige importfunksjonen avviser vilkårlige kalenderverter og utrygge adresser/videresendinger. Last da ned kalenderens `.ics`-fil og velg filimport; feil ved en kilde skal ikke fjerne tidligere data. Importløftet er fortsatt de navngitte HiMolde-/NTNU-prøvene, ikke nasjonal dekning.

Kjør fra **appmappen `studieplanlegger/`**, etter `npm.cmd ci` og installasjon av Playwrights Chromium. Den separate fjernkonfigurasjonen bruker en faktisk, offentlig tilgjengelig forhåndsvisnings- eller produksjonsadresse. Den starter ingen lokal appserver og bruker egne syntetiske profiler. For persistenskontrollen må adressen være et stabilt forhåndsvisningsalias for grenen eller produksjonsadressen, slik at den kan peke til en ny publisering. En unik, uforanderlig deployment-URL passer ikke til denne kontrollen. Sett prosjektets kontrollerte, stabile adresse:

```powershell
$env:AJOUR_REMOTE_URL = 'https://<stabilt-forhaandsvisningsalias-eller-produksjonsadresse>'
npm.cmd run test:e2e:remote
$env:RUN_LIVE_TEACHING = '1'
npm.cmd run test:e2e:remote:live
Remove-Item Env:RUN_LIVE_TEACHING
```

Standardutvalget kontrollerer hovedflyt, lagring, direkte innlasting og injiserte feil, og tar tretti skjermbilder fordelt på fem visninger, to temaer og tre bredder. Bildene må åpnes og vurderes; genererte PNG-filer er ikke automatisk visuell godkjenning. **Kjør også `test:e2e:remote:persistence` nedenfor:** dette separate prosjektet kontrollerer UI-opprettet tilstand, gjenåpning, adskilte profiler, sikkerhetskopi/gjenoppretting og gyldig ICS, med ny verifiseringsfase etter publisering på samme adresse. Begge kommandoene kreves for komplett fjernkontroll. Live-kildetransport rapporteres separat. Lokale tester eller emulering er ikke Vercel-evidens. Behold kontroll med `npm.cmd run test:e2e:database` for lokal Node-/SQLite-drift.

For å kontrollere gjenåpning og samme-adresse-persistens bruker du en ny prøve-ID: 1–61 tegn med små ASCII-bokstaver, sifre og bindestreker, og bokstav eller siffer først. Kommandoen nedenfor lager en unik ID i dette formatet. Testen oppretter selv en syntetisk Chromium-profil under ignorerte `artifacts/remote-persistence/`; angi aldri en personlig nettleserprofil. Oppgi full Git-SHA fra kontrollert CI/Vercel for hver fase, og kontroller `/release.json` mot den før prøven kjøres. Før ny publisering:

```powershell
$env:AJOUR_REMOTE_PROFILE = 'ajour-' + [guid]::NewGuid().ToString('N')
$env:AJOUR_REMOTE_PHASE = 'create'
$env:AJOUR_REMOTE_DEPLOYMENT = '<full-git-sha-foer-publisering>'
if ((Invoke-RestMethod ($env:AJOUR_REMOTE_URL.TrimEnd('/') + '/release.json')).commit -ne $env:AJOUR_REMOTE_DEPLOYMENT) { throw 'Publisert commit samsvarer ikke.' }
npm.cmd run test:e2e:remote:persistence
```

Etter en faktisk ny publisering på **samme** `AJOUR_REMOTE_URL` og med samme prøve-ID kontrollerer du den nye, forskjellige Git-SHA-en:

```powershell
$env:AJOUR_REMOTE_PHASE = 'verify'
$env:AJOUR_REMOTE_DEPLOYMENT = '<full-git-sha-etter-publisering>'
if ((Invoke-RestMethod ($env:AJOUR_REMOTE_URL.TrimEnd('/') + '/release.json')).commit -ne $env:AJOUR_REMOTE_DEPLOYMENT) { throw 'Publisert commit samsvarer ikke.' }
npm.cmd run test:e2e:remote:persistence
```

Prøven sammenligner lagrede opplysninger etter ny nettleserstart. Deployetiketten er bare en referanse; selve publiseringen må dokumenteres separat. Produksjon har en annen adresse og krever sin egen prøve-ID og tilsvarende kontroll.

### Publiseringssperre og feiloppfølging

GitHub-jobben **Ajour quality** installerer fra låsefil med `npm ci` og kjører enhetstester, produksjonsbygg, deterministiske nettleserprøver og isolert SQLite-kontroll. Vercel krever denne sjekken før domenet tildeles en ny preview eller produksjon. `build:release` gir i tillegg en lokal byggesperre for importvern og datakompatibilitet. Behold sjekknavnet i workflow og Vercel samordnet. GitHub-kontoen har skriverettigheter, men ikke administratorrettigheter: dette er en håndhevet **publiseringssperre**, ikke en påstand om beskyttet `main`. Én eier kan bruke PR uten en annen persons godkjenning. Ikke bruk Force Promote eller slå av sjekken ved feil.

Etter vellykket Vercel-deploy starter GitHub en separat nettprøve på deploymentets adresse og commit. Den kontrollerer hovedflyt, import, lagringsfeil og backup med nye syntetiske profiler. Den etterfølgende kontrollen er varsling om regresjoner, ikke en erstatning for preview-kontroll før merge. GitHub og Vercel bygger hver for seg; lik commit betyr ikke at byggeartefaktene er identiske.

Ved feil: åpne repositoryets **Actions** og den aktuelle kjøringen; bruk commit og deployment-ID for å finne riktig versjon i **Vercel → ajour → Deployments**. Byggeloggen viser installasjons-/testfeil. **Logs** kan filtreres på deployment, tidspunkt, funksjon og HTTP-status. På Hobby oppbevares kjøretidslogger bare **én time**; noter derfor tidspunkt og feiltype tidlig. En import kan ha HTTP 200 og likevel gi `transport-error` eller en delvis advarsel: kontroller også appens status. Noter bare feilklasse, status, tidspunkt, kildeadapternavn og deployment-ID. Ikke del oppgaver, kalendertitler, svarinnhold, private lenker, cookies eller rå nettverksopptak. Automatiske nettprøver bruker faste feilkategorier og syntetiske data.

### Tilbakerulling av appkode og gjenoppretting av data

Ved en faktisk produksjonsregresjon, noter gjeldende commit/deployment og åpne **ajour → Deployments → Instant Rollback**. På **Hobby kan bare den umiddelbart forrige produksjonsdeployen** velges. Kontroller at målversjonen er den sist fungerende, tidligere produksjonsmerkede deployen. En preview er ikke et gyldig Instant Rollback-mål. Bekreft først ved et reelt behov, og kontroller deretter produksjonsadressen med hovedflyt og en egen syntetisk profil. Tilbakerullingen gjenbruker et tidligere bygg og dets konfigurasjon; den bygger ikke nåværende kode på nytt.

Etter Instant Rollback stopper automatisk tildeling av produksjonsdomenet. Rett feilen på branch, test faktisk preview, integrer via PR, og bruk **Undo Rollback / Promote** for en verifisert kandidat med beståtte sjekker før normal automatisk publisering gjenopptas. Skal en eldre kildeendring reverseres gjennom Git, bruk en ny revert-commit og samme PR-/testløp; ikke skriv om historikken. [Vercels tilbakeføringsbeskrivelse](https://vercel.com/docs/instant-rollback) forklarer Hobby-begrensningen og gjenopptakelsen.

**Appkode og brukerdata gjenopprettes separat.** En Vercel-tilbakerulling endrer ikke nettleserens `localStorage` eller lokal SQLite. Bruk [sikkerhetskopi og bekreftet gjenoppretting](#sikkerhetskopi-og-lagring) på riktig adresse/profil når data skal gjenopprettes.

[Daterte øvelser](VERIFICATION.md) oppgir hva som faktisk er prøvd. En lokal kodeøvelse eller syntetisk backupprøve betyr aldri at fungerende produksjon er rullet tilbake.

### Gratisbruk og målinger

Prosjektet bruker Hobby med Fluid Compute, men beholder bevisst **60 s funksjonsgrense og 50 s intern importfrist**. Import har egne størrelses-/antallsgrenser og lagrer aldri studentdata på serveren. Plattformens maksimale funksjonspayload er **4,5 MB**; appen avviser tidligere ved sine egne grenser. Gratisplanen kan stoppe en brukt ressurs når inkludert kvote er oppbrukt; vanligvis må man vente på at bruksperioden fornyes. Dette er ingen garanti om ubegrenset tilgjengelighet. Se **Vercel → Usage**; ingen automatisk betalt oppgradering inngår. Same-origin-kontrollen er ikke ratebegrensning mot direkte klienter.

Manuell registrering og filimport er alternativer ved kildefeil. En allerede lastet app kan fortsatt bruke lokale data; dette er ikke en lovnad om full frakoblet oppstart. Bevar planen ved importfeil, og prøv igjen senere fremfor gjentatt automatisk polling. Gjeldende [funksjonsgrenser](https://vercel.com/docs/functions/limitations), [Hobby-vilkår og kvoter](https://vercel.com/docs/plans/hobby) og [loggoppbevaring](https://vercel.com/docs/logs/runtime) må kontrolleres ved endringer i driften.

`node scripts/measure-remote.mjs` bruker `AJOUR_REMOTE_URL` og `AJOUR_REMOTE_DEPLOYMENT` og rapporterer kald oppstart, respons ved navigasjon og avgrenset import. Mobilmålingen er Chromium-emulering med oppgitte nettverks-/CPU-vilkår, ikke en måling på fysisk telefon. Faktiske tall og eventuelle flaskehalser føres i verifikasjonen; bundlevarselet alene utløser ingen ombygging.

## Daterte resultater og leveringsgrunnlag

[Verifikasjonen](VERIFICATION.md) samler tekniske rettinger, kjøreresultater og bevisgrenser. [Prøveplanen](../.docs/planning-artifacts/USER-TRIAL-PLAN.md#egenutprøving-utført-av-prosjekteier--2026-11-01) dokumenterer **egenutprøving utført av prosjekteier**: omprøvingene 1. november bestod innen oppgitt omfang, og SC-07/1200–30 og Outlook-prøven fra 30. oktober beholder bestått. Tidligere «planlagt / ikke gjennomført» gjaldt beslutningen 26. oktober. Automatiske tester fyller ikke inn manglende manuelle observasjoner; ingen ny generell egenutprøving er bestilt.

[Refleksjonsrapporten](../.docs/submission/reflection-report.md) foreligger bare som Markdown i [GitHub-repoet](https://github.com/IBE160-2026/G37-yilmaz), med oppgitt KI-hjelp til struktur og formulering. Den er et leveringsdokument og følger ikke appens kjøretidsfiler. Personlig sluttgjennomlesing og formell innlevering er ikke bekreftet; [planindeksen](../.docs/planning-artifacts/README.md#leveringskontroll--2026-11-01) angir restpunktene.

### Avgrensede arbeidsflytrettinger — 2026-10-02

[Den historiske README-en](https://github.com/IBE160-2026/G37-yilmaz/blob/8e800effb59b4370f93ec104dba53ca78f6f436d/studieplanlegger/README.md#avgrensede-arbeidsflytrettinger--2026-10-02) beskriver rettingene for arbeidssteg, vurderingstema, eksport og programvalg. Sluttkontrollen bestod **1382 enhetstester i 109 filer, 43 berørte nettleserforløp og 3 Node-/SQLite-forløp**, samt produksjonsbygg. Det separate syntetiske forløpet bestod **1 create + 1 restore** etter både Node-restart og Docker-gjenskaping; revisjon 11 ble bevart, restore ga 13, integritet var OK og ingen FK-brudd ble funnet. Dette er resultatet fra 2. oktober, ikke en ny kjøring.

### Historisk Docker-kontroll — 2026-10-01

[Den daterte kontrollen](https://github.com/IBE160-2026/G37-yilmaz/blob/8e800effb59b4370f93ec104dba53ca78f6f436d/studieplanlegger/README.md#historisk-docker-kontroll--2026-10-01) brukte **641 hashkontrollerte leveransefiler** i eget prosjekt på `127.0.0.1:18521`. Fire produksjonsforløp bestod, revisjon **34** overlevde gjenskaping, restore ga **36**, integritet var OK og det var **0 FK-brudd**. Sluttregresjonen bestod **1346 enheter, 41 nettleserforløp, 92 undervisningskontroller og 3 Node-/SQLite-forløp**. Ved avslutningen ble container/nettverk stoppet og det syntetiske volumet beholdt; dette sier ikke noe om dagens lokale drift.

## Kode og tidligere prosjektarbeid

Appen bygger videre på [Vites vanilla JavaScript-mal](https://vite.dev/guide/). `src/main.js` eier felles tilstand og transaksjoner; `storage.js`, `history.js` og `backup.js` håndterer lagring og gjenoppretting. Rene moduler for oppgaver, arbeidshistorikk, kapasitet, avhengigheter og omplanlegging brukes av de samme visningene. Offentlige kildeadaptere ligger i `server/providers/`; privat dokumentparsing skjer i en lokal nettleser-worker.

Det kuraterte prosjektmaterialet finnes via [planindeksen](../.docs/planning-artifacts/README.md), [arkitekturen](../.docs/planning-artifacts/architecture/architecture-studieplanlegger-2026-09-06/ARCHITECTURE-SPINE.md), [løsningsguiden](../.docs/implementation-artifacts/solution-guide.md) og [utviklingsprosessen](../.docs/implementation-artifacts/development-process.md). Interne arbeidsspesifikasjoner er lokale og inngår ikke i leveransen. Teknisk kontroll er ikke en dokumentert brukermåned eller studentens personlige refleksjon.

Ajour-navnet og utseendet ble samordnet 25.–26. oktober 2026: ordmerket er **ajour**, med «Kom ajour.» og «Planer endrer seg. Det er helt greit.». Lokale SVG-illustrasjoner er gjenskapt fra de to leverte PNG-referansene; en større designpakke var ikke tilgjengelig. Manrope og fontlisensen er beholdt. [Daterte Ajour- og temakontroller](VERIFICATION.md#hva-som-ble-rettet-og-kontrollert) beskriver arbeidet; publiseringen `9d3a169` er historisk og før Ajour.

Navneendringen krever ingen datamigrering. Mappen `studieplanlegger`, lagrings-/backupformatet, miljøvariablene, Docker-tjenesten `studieplan` og volumet `studieplan-data` beholder navnene. Ingen tidligere brukerbetjent fargevelger eller lagret brukerfarge måtte migreres da automatisk kodehash ble erstattet. Planene ble [rekonstruert 16. oktober 2026](../.docs/planning-artifacts/README.md), og presenteres ikke som planer som styrte den eldre utviklingen. Private originaler og generell studentnytte er ikke verifisert.
