---
title: "Ajour: arkitekturvalidering mot PRD 12. november"
date: 2026-11-12
intent: validate
source_architecture_updated: 2026-11-04
source_prd_updated: 2026-11-12
---

# Ajour: arkitekturvalidering mot PRD 12. november

**Oppfølging 12. november: N1–N5 er rettet i [arkitekturen](ARCHITECTURE-SPINE.md).** Tre uavhengige etterkontroller fant ingen gjenstående rettelser innen dette omfanget. Den opprinnelige vurderingen og funnene nedenfor er bevart som datert grunnlag; linjetallene viser til arkitekturen før retting. [Oppfølgingen nederst](#oppfølging-etter-retting--2026-11-12) beskriver sluttstatus. O1–O3 er fortsatt valgfrie.

**Vurdering: Arkitekturen dekker hovedflytene, men trenger fem dokumentrettelser før den er en entydig kontrakt for videre arbeid.** To har høy dokumentrisiko: planleggingsbegrepene og oversikten over driftsformene. Tre har middels dokumentrisiko: backupgrensene, språkmodellavgrensningen og en foreldet pakkeversjon. Ingen ny kjøretidsfeil er påvist i denne valideringen.

V1, PRD-en, arkitekturen, produktkoden og tidligere resultater er bevart. Rapporten foreslår rettelser; den gjennomfører dem ikke. De 26 utslagene fra BMADs mekaniske kontroll er behandlet separat fra de fem innholdsfunnene.

## Nødvendige rettelser

### N1 · Høy · Bind de tre planleggingsresultatene og den betingede flyten

**Funn:** AD-9, linje 150, sier at omplanlegging bare bruker bekreftede arbeidsvinduer. AD-11, linje 130, åpner for preferanser og engangsantakelser, men forklarer ikke hvordan de virker sammen. PRD R-03 og UJ-1 krever en kort, tydelig betinget økt når arbeidsvinduer mangler, og utforskende arbeid når totalanslaget er ukjent. Den aktive arkitekturteksten skiller heller ikke tydelig nok mellom Start, kapasitetsberegning og godkjent kalenderreservasjon.

**Konsekvens:** To implementatører kan følge teksten og henholdsvis avvise UJ-1 eller opprette en reservasjon direkte fra Start. Den ene kan dessuten gjøre en antatt studietid til gjentakende kapasitet. Dette er kontraktuklarhet, ikke en påvist feil i dagens app.

**Minste rettelse:** Presiser eksisterende AD-9/AD-11, uten nye ID-er eller datamigrering:

- Neste handling/Start foreslår arbeid nå og oppretter ikke i seg selv en kalenderreservasjon. En delbar oppgave med 1200 minutter igjen kan gi 30 minutters arbeid uten å endre anslaget.
- Kapasitetsberegningen er en avlesning av arbeid og bekreftede tidsrammer; den lagrer eller godkjenner ingen økter.
- Omplanlegging gir en forhåndsvisning med ny kontroll før samlet godkjenning. Bekreftede vinduer brukes når de finnes. Den oppgavenære flyten kan ellers bruke studietidspreferanse eller et tydelig betinget 30-minutters forslag.
- Ukjent totalanslag forblir ukjent ved en utforskende økt. En godkjent enkeltøkt eller preferanse oppretter ikke bekreftet, gjentakende kapasitet. Arbeidssteg er valgfrie.

**Belegg:** [replanning-view.js](../../../../studieplanlegger/src/replanning-view.js), linje 124–127, velger tilgjengelighetsgrunnlag og utforskende 30 minutter; [study-time.js](../../../../studieplanlegger/src/study-time.js), linje 34–72, skiller antakelser, preferanser og bekreftede vinduer; [replanning.js](../../../../studieplanlegger/src/replanning.js), linje 79–97, behandler disse grunnlagene. [simple-planning.test.js](../../../../studieplanlegger/tests/unit/simple-planning.test.js) har relevante kontrakttester, lest uten ny kjøring.

**Kontroll ved retting:** UJ-1 og R-03s tre resultater skal kunne utledes uten å lese septemberhistorikken eller anta at `sessions` og `workWindows` betyr det samme. Tiltak: **rett dokumentet**.

### N2 · Høy · Samordne gjeldende driftsoversikt med AD-16/AD-17

**Funn:** Hoveddiagrammet, linje 175–176, viser nettleserlagring bare for utvikling/regresjon og lokal Node/SQLite som produksjonsleveranse. `Deferred`, linje 313–314, sier fortsatt at offentlig drift er utsatt. Kravkartets R-06-rad, linje 111, viser bare AD-10. AD-16 og PRD R-06 beskriver allerede godkjent nettleserproduksjon.

**Minste rettelse:** Vis begge godkjente driftsformer i gjeldende diagram og kravkart: Vercel med komplett nettleseradapter, og lokal Node/Docker med autoritativ SQLite. Kravkartet må vise AD-16/17 for R-06 og AD-14/15 for Q-01. Merk de gamle utsagnene om utsatt hosting som historikk. Bevar én redigerende nettleserfane, profil-/adresseisolasjon, portable kopier og skillet mellom optimistiske nettlesersjekker og serverens revisjonskontroll.

**Belegg:** AD-16, linje 49–59, og AD-17, linje 41; [storage.js](../../../../studieplanlegger/src/storage.js) velger adapter; [vercel.json](../../../../studieplanlegger/vercel.json) og [server/app.js](../../../../studieplanlegger/server/app.js) viser separate driftsgrenser. R-06/Q-02 er berørt, særlig UJ-4.

**Kontroll ved retting:** Oversiktsdiagram, kravkart og `Deferred` skal gi samme lagringssvar som AD-16. Ingen konto, skydatabase, synkronisering eller ekstra Vercel-prosjekt innføres. Tiltak: **rett dokumentet**.

### N3 · Middels · Skill filbackup fra intern gjenoppretting

**Funn:** AD-17 oppgir 50 MB for utpakket intern gjenopprettingsjournal. PRD R-06.5 krever at backupfiler over **20 000 000 byte** avvises før forhåndsvisning i alle driftsformer. Denne separate inngangsgrensen er ikke eksplisitt i arkitekturen. Kravet om å koble kalenderforbindelser til på nytt står også svakere enn PRD R-06.6/UJ-4. Tema og emnefarger er allerede tydelig unntatt i AD-15.

**Minste rettelse:** Knytt filgrensen og gjenoppkoblingsregelen til den eksisterende backupkontrakten. Bevar skillet mellom portable domenedata, kjent tilgangsmateriale, lokale visningspreferanser og intern recovery. En fil under grensen er ikke garantert å få plass i nettleserlagringen.

**Belegg:** [data-tools.js](../../../../studieplanlegger/src/data-tools.js), linje 67, sjekker `file.size` før lesing; [backup.js](../../../../studieplanlegger/src/backup.js), linje 86–87 og 129–134, fjerner forbindelser og validerer kopi/relasjoner. Den sistnevnte størrelsessjekken gjelder strenglengde og er et tillegg til filens bytekontroll, ikke en erstatning for den.

**Kontroll ved retting:** En leser skal kunne forklare hvorfor 20 000 000-byte filgrense, 50 MB intern utpakkingsgrense og nettleserkvote er tre forskjellige begrensninger. Tiltak: **rett dokumentet**.

### N4 · Middels · Gjør språkmodellavgrensningen like bindende som Q-02

**Funn:** Arkitekturens linje 103 sier at en generativ KI-tjeneste ikke kreves ved kjøring. Dette er svakere enn PRD Q-02: appen bruker ingen språkmodell, og regelbaserte forslag kan gjenskapes med samme data, tidsgrunnlag og valg.

**Minste rettelse:** Skriv uttrykkelig at V1 ikke bruker språkmodell, og at reglene skal gi samme resultat med samme datagrunnlag, tidsgrunnlag og valg. Da kan ikke en valgfri modell oppfattes som et tillatt tillegg innen V1. Skillet gjelder appen; det endrer ikke dokumentert bruk av KI under utviklingen.

**Belegg:** PRD Q-02; eksisterende rene domenegrenser i AD-1/AD-9 og regelmodulene [tasks.js](../../../../studieplanlegger/src/tasks.js), [capacity.js](../../../../studieplanlegger/src/capacity.js) og [replanning.js](../../../../studieplanlegger/src/replanning.js). Ingen modellbruk er påvist i denne kontrollen. Tiltak: **rett dokumentet**.

### N5 · Middels · Rett aktiv pako-omtale mot låsefilen

**Funn:** AD-17, linje 41, oppgir `pako 2.1.0`. [package.json](../../../../studieplanlegger/package.json), linje 42, og [package-lock.json](../../../../studieplanlegger/package-lock.json), linje 1474–1475, angir **3.0.3** for den direkte avhengigheten.

**Minste rettelse:** Korriger den aktive omtalen, helst med manifest/låsefil som eier av nøyaktig versjon. Behold DEFLATE, integritets- og størrelseskontroll, intern journalversjon 2 og hoveddata/portabel kopi i v1. Dette er ingen bestilling av pakkeoppgradering eller migrering.

**Kontroll ved retting:** Aktiv omtale og gjeldende låsefil skal samsvare. Den uttrykkelig historiske stakktabellen fra september skal ikke omskrives til dagens versjoner. Tiltak: **rett dokumentet**.

## Kravdekning

«Dekket» betyr at arkitekturen fastsetter eller henviser til nødvendig ansvar og grense. Det betyr ikke at alle akseptansekriterier er prøvd på nytt. PRD-en eier produktkravene; arkitekturen trenger ikke duplisere alle tall, UI-eksempler og testoppskrifter.

| Krav | Arkitekturgrunnlag | Vurdering |
| --- | --- | --- |
| R-01 · Lite grunnlag | AD-9: bare tittel påkrevd, ukjente anslag bevart; AD-14: eksisterende eiere | Dekket. UJ-1s videre planlegging har N1. |
| R-02 · Kontrollert import | AD-11/13: kildevalg, identitet, tid, forsinkede svar; AD-16: offentlig kildegrense | Dekket. Lokal HTTPS/webcal og nettutgavens gjenkjente kilder må fortsatt holdes atskilt. |
| R-03 · Tre planleggingsresultater | AD-9/11, kapasitets- og omplanleggingsregler | Delvis entydig; N1. |
| R-04 · Utfall uten falsk framgang | AD-9/12/17 og avklaringsrettingen 3. november | Dekket: faktisk/gjenstående, steg/oppgave/innlevering og uttrykkelig oppheving av venting. |
| R-05 · Godkjenne og angre | AD-9: kandidat før lagring, revalidering og samlet Angre; AD-17: 30 reelle oppføringer | Dekket. R-03s skriveskille må presiseres i N1. |
| R-06 · Beholde og flytte data | AD-10/15/16/17 | Delvis entydig i oversikt og backupinngang; N2/N3. Relasjoner, utkastvern og én fane er beskrevet. |
| R-07 · Egenutprøving | Innledende evidens 4. november og kravkartets R-07-rad | Dekket som validerings-/dokumentasjonsansvar, ikke en runtimefunksjon. Ingen ny prøverunde kreves. |
| R-08 · Bevarte tillegg | AD-12/13/17 | Dekket: stabile steg, egenvurdering, godkjent repetisjon, lesende kalenderkopi og frosset plansammenligning. |
| Q-01 · Forståelig og tilgjengelig UI | AD-14/15 samt AD-11s fokus-/utkastvern | Dekket sammen med PRD-ens konkrete skjerm-, tekst- og kontrastkrav. Tolv emnefarger og status som tekst er beskrevet. |
| Q-02 · Lokale data og regler | AD-9/10/15/16/17, runtimeavgrensning linje 103 | Data- og personverngrenser dekket; formuleringen om språkmodell må strammes i N4. |
| Q-03 · Etterprøvbarhet | Daterte evidenslenker, AD-14/16 og R-07-rad | Dekket. Historiske tekniske prøver og eierobservasjoner beholder dato, metode og begrensninger. |

SC-01–SC-07 og S-01–S-08 beholder koblingene i PRD og [sporbarhetsmatrisen](../../TRACEABILITY.md). Valideringen innfører ingen SM-, FR- eller nye R-ID-er. N5 gjelder teknisk faktanøyaktighet, ikke et nytt produktkrav.

## De fire brukerreisene

| Reise | Arkitekturens ansvarskjede | Vurdering |
| --- | --- | --- |
| UJ-1 · Første økt med lite grunnlag | Titteloppgave → valgfritt steg → betinget/utforskende forslag → revalidert godkjenning → lagret økt | Registrering og lagring dekket. N1 må gjøre mellomleddet entydig uten å gjøre anslag eller arbeidsvindu obligatorisk. |
| UJ-2 · Kontrollert programimport | Programvalg → kilde-/gruppeavklaring → samlet godkjenning → bevarende oppdatering | Dekket av AD-11/13/16. HiMolde-grenen IBE160 eller IBE102 + IBE152 bevares; kildefeil sletter ikke tidligere undervisning. |
| UJ-3 · 20 av 60 minutter og Angre | Utfall → separat anslag/fullføringsvalg → forslag → godkjenning → samlet Angre ved uendret grunnlag | Dekket av AD-9/12/17. Navngitt stegmål er stabilt, og stegfullføring betyr verken ferdig oppgave eller levering. N1 tydeliggjør planleggingens tre resultater. |
| UJ-4 · Gjenåpne og flytte kopi | Samme adresse/profil → eksport → forhåndsvisning → Erstatt lokale data i tom profil | Hovedkontrakten finnes. N2/N3 samordner driftskartet, filgrensen og utelatte forbindelser. Tema/farger følger allerede AD-15. |

Mina og UJ-1–UJ-4 er hypotetiske illustrasjoner. Eierprøven 3.–4. november og navngitt Start-tillegg beholder dokumentert resultat og metodegrense; de gjøres ikke om til observasjoner av Mina eller generell studentnytte.

## Begreper mot arkitektur og kode

Dette er et lesekart, ikke nye feltnavn eller en full datamodell. Eksisterende kompatibilitetsnavn beholdes.

| PRD-begrep | Teknisk forankring | Grense som skal være tydelig |
| --- | --- | --- |
| Oppgave | `tasks`, [tasks.js](../../../../studieplanlegger/src/tasks.js), AD-9 | Egen identitet og fullføring; bare tittel påkrevd. |
| Arbeidssteg | Steg i oppgaven, `taskSteps`, [work-steps.js](../../../../studieplanlegger/src/work-steps.js), AD-12/17 | Valgfritt; stabil ID. Historisk utfall viser til loggens oppgavesnapshot. |
| Studieøkt | Godkjent reservasjon i `sessions`, AD-9/17 | Forslag er ikke lagret økt; oppgavereservasjon blir ikke automatisk stegarbeid. Den bredere tekniske samlingen kan også ha andre reservasjoner. |
| Neste handling / Start | Forslagsregler, `main.js` og [study-session-view.js](../../../../studieplanlegger/src/study-session-view.js) | Arbeid nå, ikke automatisk kalenderreservasjon; N1. |
| Utfall | `workLogs`, [work-log.js](../../../../studieplanlegger/src/work-log.js), AD-9/17 | Faktisk tid og uttrykkelige anslags-/fullføringsvalg holdes atskilt. |
| Arbeidsvindu | `workWindows`, AD-9/11 | Bekreftet tilgjengelig tidsrom; ikke synonym for `sessions`. |
| Tilgjengelig tid | Valgte minutter nå eller framtidig tilgjengelighetsgrunnlag | Konteksten må framgå; ett teknisk felt skal ikke dekke begge betydninger. |
| Betinget tilgjengelighet | `availability.conditional`, [study-time.js](../../../../studieplanlegger/src/study-time.js) | Midlertidig grunnlag for forslag; ikke bekreftet gjentakende kapasitet; N1. |
| Oppgavenært forslag | Avgrenset oppgaveflyt i [replanning-view.js](../../../../studieplanlegger/src/replanning-view.js) | Et forslag før godkjenning, ikke en egen varig domeneentitet. |
| Gjenstående anslag | `remainingMinutes` og støttede anslagsformer, AD-9 | Verdien `null` betyr ukjent, ikke tallet `0`. Fraværende eldre felt har en dokumentert kompatibilitetsregel. |
| Faktisk tid | `workLogs[].actualMinutes`, AD-9/17 | Minutter brukt; verken automatisk fratrekk eller mestring. |
| Bekreftet innlevering | `submitted` / `requiresSubmission`, videreført tilstandsregel | Særskilt brukerbekreftelse, uavhengig av steg- og oppgavefullføring. |

## Mekanisk kontroll og valgfrie forbedringer

`lint_spine.py` returnerte **26 funn merket «high» av verktøyet**: 16 gjelder ikke-stigende AD-rekkefølge, og 10 gjelder manglende eksplisitte `Binds`/`Prevents`/`Rule`-etiketter. Det ble ikke rapportert dupliserte AD-ID-er, plassholdere eller tomme versjonsfelt. Verktøyet kontrollerer form; det kan ikke bekrefte aktuell pakkeversjon eller semantisk kravdekning.

Dokumentet har bevisst akkumulert daterte beslutninger øverst og gammel historikk nederst. Derfor er ikke disse 26 utslagene 26 alvorlige produktfeil. AD-1–AD-8 og septemberoppsettet er uttrykkelig merket som historiske ved linje 114; gamle obligatoriske oppgavefelter og ett-steg-begrensninger skal ikke gjøres til aktive avvik. N2 gjelder derimot en oversiktsfigur og `Deferred` som fortsatt kan leses som gjeldende.

| Valgfri forbedring | Tiltak og avgrensning |
| --- | --- |
| O1 · Tilpasse dagens BMAD-format | Ved ønsket formatrydding: sorter beslutninger og legg til eksplisitte felt. Behold AD-1–AD-17, lenkeankere, datoer og overstyringshistorikk. Nødvendig for ren mekanisk lint, ikke for å utvide eller nygodkjenne V1. |
| O2 · Kortere aktiv arkitektur | Samle gjeldende kontrakter først og flytt lengre historisk seed/oppskrift til tydelig arkiv med bevarte lenker. Innhold og historisk proveniens beholdes. Kan vente til senere dokumentvedlikehold. |
| O3 · Navigasjon til PRD-begreper og UJ-er | Lenk det korrigerte kravkartet til glossar og brukerreiser. Rapportens kart kan gjenbrukes; hele PRD-en trenger ikke kopieres inn i arkitekturen. |

## Grunnlag og metode

Autoritative kilder er [PRD oppdatert 12. november](../../PRD.md), [arkitektur oppdatert 4. november](ARCHITECTURE-SPINE.md), [brief](../../../../brief.md) og [planindeks](../../README.md). Kontrollen gjelder arbeidskopien `G37-yilmaz` ved commit `9882eb24d19ab21569d45522f5b35fad04eedd6c`. Linjetall ovenfor gjelder disse uendrede kildefilene.

Tre uavhengige gjennomganger kontrollerte henholdsvis krav/rubrikk, samsvar med kode og kontrakter som kunne gi uforenlige implementasjoner. Deterministisk `lint_spine.py` ble kjørt. Utvalgt kode og testkode ble lest. Appen og automatiske produkttester ble ikke kjørt på nytt; det ble heller ikke gjort nye kontroller mot offentlige kilder eller produksjonen. Dette er dokument- og kildekontroll, ikke en ny akseptanseprøve.

[Lærerfeedback 6. oktober](../../../../tilbakemelding-product-brief.md) følges opp på avgrenset V1, tekniske beslutninger i arkitekturen og sporbarhet fra sjekkbare krav til kode. [PRD-feedback 12. november](../../tilbakemelding-prd.md), særlig 4.1–4.5, følges opp med brukerreiser, begreper og kravdekning. Den lokale sjusiders «Sensorveiledning IBE160 – Del 1 applikasjon og prosess», høst 2026, er lest; SHA-256 samsvarer med planindeksens `a0069856666a32e2e5c886fe1c46ade1d666a99bf800bc42b9e20113adc2e509`. Særlig side 2, 4 og 5 underbygger kontroll av sammenheng, etterprøvbarhet og arkitektur. Vedlegget kopieres ikke inn. Godkjent proposal og overordnet sensorveiledning er fortsatt ikke identifisert.

## Avgrensning og anbefalt oppfølging

Bevar importløftet **HiMolde IT 2026–27 og NTNU ARK1001/EXPH0100 høst 2026**, valgfri stegbruk, ukjent tid, separate fullføringstilstander, godkjenning/Angre og begge godkjente driftsformer. Nasjonal dekning, kontoer, skysynk, språkmodell, automatisk innlevering og ekstern brukerrekruttering blir ikke nye oppgaver. Akseptert uvisshet om studentnytte forblir uvisshet.

Neste konkrete arbeid er en avgrenset **Update av N1–N5**, med stabile AD-ID-er og bevart historikk. O1–O3 kan velges separat. Etter retting kontrolleres krav-/begrepssamsvar og dokumentlenker på nytt; nye produkttester er først nødvendig dersom produktkode faktisk endres. Denne rapporten alene markerer ikke arkitekturen som oppdatert eller ferdig rettet.

## Oppfølging etter retting — 2026-11-12

Prosjekteieren godkjente deretter retting av N1–N5. Denne delen erstatter anbefalingen om neste arbeid ovenfor; de opprinnelige funnene og metodebeskrivelsen beholder sin historiske betydning.

| Funn | Sluttstatus og plassering |
| --- | --- |
| N1 | Rettet i AD-9/AD-11: Start, lesende kapasitet og godkjent omplanlegging er skilt. Betingede/utforskende forslag, ukjent anslag, valgfrie steg og oppgaveløse reservasjoner er presisert. |
| N2 | Rettet i hoveddiagram, gjeldende kravkart og Deferred. Begge driftsformer er synlige, med AD-14/15 for Q-01 og AD-16/17 for R-06. |
| N3 | Rettet i AD-17: filgrensen over 20 000 000 byte, intern utpakking, kvote og portable kopiers utelatte forbindelser/preferanser er skilt. |
| N4 | Rettet i gjeldende omfang/kravkart: ingen språkmodell i V1; samme data, tidsgrunnlag og valg gir samme planleggingsresultat. Nye post-ID-er påvirker ikke denne regelen. |
| N5 | Rettet i AD-17: manifest og låsefil eier nøyaktig versjon, avstemt til direkte pako 3.0.3. Ingen pakke- eller formatendring. |

Rubrikkontroll, kontroll mot kode og uavhengig kontraktgjennomgang fant ingen gjenstående funn innen N1–N5. Dokumentkontrollen bevarer alle 17 AD-ID-er, eksisterende overskrifter/ankere, historiske AD-1–AD-8 og stakktabellen. PRD-en og produktfilene er uendret. Ingen nye lenkefeil er funnet; ett gammelt lenkeeksempel i sesjonslogg-skillen er fortsatt ikke en produktlenke.

BMAD-lint har fortsatt de samme 26 formatfunnene, uten nye kategorier. O1–O3 er ikke gjennomført. Ingen nye app-, kilde-, produksjons- eller eierprøver er utført. [Sesjonsloggen](../../../../.logs/984-2026-11-12-13-47-31-ajour-arkitekturvalidering.md) dokumenterer gjennomføring og kontroll.
