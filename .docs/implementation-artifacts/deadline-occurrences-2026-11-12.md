# Fristvalg ved tidsskifte og kort lokal prøve

Oppdatert 12. november 2026. Oppfølging av konkrete funn fra prosjekteierens gjennomgang og etterfølgende ønske om commit og push. Dette er feilretting innen eksisterende V1. [PRD](../planning-artifacts/PRD.md) og [prøveplan](../planning-artifacts/USER-TRIAL-PLAN.md) eier fortsatt krav og samlet prøveomfang.

## Funn og retting

| Funn | Oppførsel etter retting | Regresjonskontroll |
| --- | --- | --- |
| 31.10.2027 kl. 02:30 kunne lagres uten valg, men kalenderen krevde presisering uten at redigeringen tilbød dette. | Skjemaet krever første eller andre forekomst. Begge representerer samme lokale klokkeslett, men forskjellige faktiske tidspunkter. Valget lagres og brukes videre. | Begge valg, redigering, omlasting, kalender, eksport og beregninger. |
| `25:90` ble omtalt som en ugyldig dato. | Egen klokkeslettfeil med fokus på tidsfeltet; utkastet beholdes. | Ugyldig klokkeslett, bevart tekst og korrigering. |
| 28.03.2027 kl. 02:30 fikk samme generelle datofeil. | Forklarer at klokkeslettet ikke finnes ved overgangen til sommertid. | Avvisning av hullet, deretter lagring og omlasting av 03:30. |
| En 45-minuttersoppgave ble foreslått ved 15 minutter fordi oppdeling var på. | Testforventningene beskriver både deløkter og eksplisitte arbeidssteg. Gjeldende Ajour-regel beholdes. | Oppdeling på/av, 15/60 minutter, neste steg på 15 minutter og omlasting. |

`deadlineLocal` beholder eksisterende format. Det valgfrie feltet `deadlineDisambiguation` inneholder `earlier` eller `later` når en frist trenger et forekomstvalg. Valget fjernes når fristen endres til et tidspunkt som ikke trenger det. En eldre uavklart frist behandles som uavklart og kan repareres i oppgaveskjemaet; appen velger ikke en forekomst på brukerens vegne.

Dato uten klokkeslett forblir en datofrist i lagring, skjema og heldagseksport. Beregninger bruker den eksisterende grensen ved starten av neste Oslo-dag, også over tidsskifte. Flere arbeidssteg og stabile steg-ID-er er bevart. Identisk reimport kan beholde brukerens forekomstvalg; en endret frist må avklares på nytt når nødvendig.

## Deløkter i dagens kode

| Oppgave og valg i Oversikt | Oppdeling på | Oppdeling av |
| --- | --- | --- |
| 15 minutter arbeid, 15 minutter tilgjengelig | Foreslås | Foreslås |
| 45 minutter arbeid uten neste steg, 15 minutter tilgjengelig | Foreslås som tydelig merket deløkt | Foreslås ikke |
| 45 minutter arbeid, 60 minutter tilgjengelig | Foreslås | Foreslås |
| 45 minutter arbeid med neste steg på 15 minutter, 15 minutter tilgjengelig | Neste steg foreslås | Neste steg foreslås |

Oppdeling er på som standard i dagens skjema. Et neste steg gjør ikke resten av oppgaven ferdig og reduserer ikke automatisk det registrerte arbeidet. Den eldre lokale gjennomgangen hadde en strengere filterforventning. Dette er ikke brukt til å erstatte dagens dokumenterte støtte for deløkter.

## Prosjekteierens rapporterte observasjoner

Disse observasjonene gjelder **den eldre lokale kopien som ble brukt under gjennomgangen**, ikke en ny manuell prøve av denne Git-versjonen. De er en kort, redigert oppsummering av brukerens rapport, ikke automatiserte resultater eller en uavhengig observasjon fra Codex.

- Fristprøven bestod etter retting: begge 02:30-valg overlevde omlasting, feil klokkeslett og sommertidshullet fikk forståelige meldinger, og korrigert 03:30 ble beholdt.
- Gjennomgangen av neste steg bestod: validering og utkast, oppretting/redigering/fjerning/fullføring, arbeidsforslag, levering/gjenåpning, tastatur og skjema ved 360 piksler. Rapportoppgaven beholdt 240 minutter etter at et steg var gjort.
- Den korte lokale prøven brukte to **eksempeloppgaver**, med frister og 240/30 minutter arbeid. Et steg på 20 minutter ble anbefalt ved 30 minutter tilgjengelig. Registrert arbeidstid, studieøkt og frist viste seg i kalenderen. Flytting fra 09:00–09:20 til 10:00–10:20 og omlasting bevarte opplysninger og plan.

Faktisk prøvevarighet ble ikke oppgitt. Prøven dekker en kort gjennomføring, ikke bruk over en måned, reelle studieoppgaver over tid eller generalisert studentnytte. Den endrer ikke de separat daterte [R-07-observasjonene fra 3.–4. november](owner-trial-2026-11-04.md).

## Kontroller av denne Git-versjonen

Lokale kontroller 12. november 2026. Testene bruker syntetiske oppgaver og isolert lagring.

| Kontroll | Resultat |
| --- | --- |
| Hele enhetstestsuiten, `npm test -- --reporter=dot` | **2737/2737 bestått i 155 filer**. |
| Produksjonsbygg, `npm run build` | Bestått. Hovedbundle 963,42 kB / 294,67 kB gzip; det eksisterende størrelsesvarselet består. |
| Nettleserprøver mot ferdig bygg, `node tests/run-built-e2e.mjs` | **191/191 Chromium-prøver bestått**, inkludert de sju nye frist-/deløktprøvene. Kjøringen tok 6,3 minutter. |
| Avgrenset leveransekontroll | Relative lenker og ankere kontrollert uten funn. Dokument-/fixturemønstre, utfoldet ICS og PDF-/DOCX-metadata hadde ingen funn; ingen byggeartefakter i inventaret. |

Første samlede enhetskjøring avdekket to uferdige testoppsett, en gammel forventning om forfall ved første uavklarte forekomst og to regresjoner i presisjonsforklaringen for eldre eksportdata. Testoppsettene og den utdaterte forventningen ble korrigert; eksportens bevaring av sekunder/brøkdelssekunder ble gjenopprettet. Full omkjøring bestod. En separat kodekontroll fant at tekstregistrering kunne arve et gammelt forekomstvalg ved endret klokkeslett; dette er rettet og dekket av to nye tilfeller i [tekstregistreringstestene](../../studieplanlegger/tests/unit/text-registration.test.js).

Leveransekontrollen er lokal og avgrenset. Den henter ikke eksterne lenker, klassifiserer ikke all PDF-brødtekst og beviser ikke at historiske GitHub-kopier er rene. Dette kontrollpunktet gjelder lokal kode før push, ikke ny manuell godkjenning eller bekreftet produksjonsdeployment.

- [Frist- og domeneregresjoner](../../studieplanlegger/tests/unit/deadline-followup.test.js).
- [Reimport og forekomstvalg](../../studieplanlegger/tests/unit/deadline-import-followup.test.js).
- [Avklaringsstatus i importvisningen](../../studieplanlegger/tests/unit/deadline-import-view.test.js).
- [Faktiske nettleserprøver av fristskjemaet](../../studieplanlegger/tests/e2e/deadline-followup.spec.js).
- [Deløkter med oppdeling på og av](../../studieplanlegger/tests/e2e/own-trial-partial-suggestions.spec.js).

## Krav og metode

Oppfølgingen gjelder R-01 (registrering og validering), R-03 (arbeidsforslag og planberegninger), R-05 (brukerens uttrykkelige valg) og R-06 (bevaring av data), samt Q-01–Q-03 om forståelig bruk, lokal databehandling og etterprøvbar kvalitet. Krav og V1 utvides ikke. Lærerens produktbrief-tilbakemelding om konkrete suksesskriterier og sporbar kvalitetskontroll følges opp med funn, retting og avgrensede prøver. Sensorveiledningens krav om meningsfulle tester, forståelige feil og relevante leveransefiler er brukt som kontrollgrunnlag.

Codex overførte rettingene til den nyere Ajour-koden og bevarte blant annet datofrister, flere arbeidssteg og deløktregler. Prosjekteieren rapporterte de manuelle observasjonene ovenfor. Den forskjellen er avgjørende for hva resultatene dokumenterer.
