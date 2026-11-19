# Leveringsregresjoner i Ajour

## 2026-11-19 kl. 21.31 — Codex

### Oppgave

Rette funnene fra kontrollen av `12c8d3306109785f0b1a682c843f65c6de071aae`, verifisere rettelsene og følge den eksisterende GitHub- og Vercel-flyten. Oppfølgingen gjelder faglærerens punkter om studentens godkjenning, avgrenset V1, sjekkbare kriterier og sporbarhet. Vurderingsvedlegget ble sist dokumentert lest 12. november. [Faglærertilbakemeldingen](../tilbakemelding-product-brief.md) · [Vurderingsgrunnlaget](../.docs/planning-artifacts/README.md#vurderingsgrunnlag-kontrollert-2026-10-16)

### Plan

- Reprodusere og rette I01, B01, P01–P03 og U01 først. Bruke lokale syntetiske filer, tomme testprofiler og separat SQLite-database og Compose-volum.
- Dekke øvrige import-, plan-, kalender- og tilgjengelighetsfunn med regresjoner. Kontrollere omlasting og Angre der brukerflyten endrer lagret tilstand.
- Bruke den samme leveringskandidaten til bygge-, CI- og forhåndsvisningskontroll. Registrere main-SHA, versjonsmarkøren og resultatene etter publisering i [PR #33](https://github.com/IBE160-2026/G37-yilmaz/pull/33).

### Resultat

| Funn | Retting og målrettet kontroll |
| --- | --- |
| B01, B02, U05, SQLite og gjenopprettet kalenderrulling | Kompakt JSON, felles UTF-8-grense, eksportalternativ uten Angre-historikk, koblingsvalidering og reservekopi. Lokal SQLite-prøve brukte 500 hendelser og 11 angreoppføringer. Tidligere format ville vært 22 548 291 byte. Ny nedlastet fil var 13 357 901 byte og kunne gjenopprettes i en tom database. Testet også 20 000 000 og 20 000 001 byte, gjentatt import, eldre reservekopi og 120 → 640 px etter gjenoppretting og omlasting. [Grenseprøvene](../studieplanlegger/tests/unit/backup-size.test.js) · [SQLite-prøvene](../studieplanlegger/tests/e2e/database-delivery.spec.js) · [Rulleprøven](../studieplanlegger/tests/e2e/calendar-viewport-corrections.spec.js) |
| I01, I02 og undervisning | Fristsignaler styrer dokumenttolkningen. Uklar frist krever et valg. De fire dokumentformatene ble prøvd i nettleser med forhåndsvisning, lagring, omlasting og Angre. Heldager i tre tidssoner ble prøvd gjennom gjenimport, sammen med nattøkter og innebygd `VTIMEZONE`. [Dokumentprøvene](../studieplanlegger/tests/e2e/delivery-document-import.spec.js) · [Kalenderfilprøvene](../studieplanlegger/tests/unit/calendar-file-flow.test.js) |
| P01–P09 og P12 | Sammenligning krever et synlig valg. Forslag beholder gyldige økter og vurderer én sammenhengende økt ved udelelig arbeid. Regresjonene prøver låste økter, pauser, ukjent og åpen arbeidsmengde, en deløkt på 30 minutter, kjent minimumsmangel og utforsking innenfor valgte lengderegler. [Planmatrisen](../studieplanlegger/tests/unit/delivery-plan-regressions.test.js) · [Nettleserprøvene](../studieplanlegger/tests/e2e/simple-planning-flow.spec.js) |
| P10 og P11 | Automatisk søk bruker første gyldige minuttslag i sammenhengende ledig tid, også over tilstøtende vinduer. Prøvene dekker både klokkeomstillingene, bekreftelse av valgt tidspunkt, opptatt tid og fremtidig utsettelsesdato. [Repetisjonsprøvene](../studieplanlegger/tests/unit/delivery-review-calendar.test.js) · [Redigeringsprøvene](../studieplanlegger/tests/e2e/bounded-assessment-fixes.spec.js) |
| K01–K03 og Oslo-tid | Modernisert emnefilter for navn, kode og ID. Kalenderen skiller lokale aktivitetsvalg fra kildeavlysing, og tidslinjen markerer fristen på fristtidspunktet. Den eldre emneagendaen oppdateres ved neste frist eller øktslutt. [Kalenderprøven](../studieplanlegger/tests/e2e/delivery-calendar.spec.js) · [Agendaprøvene](../studieplanlegger/tests/e2e/epic4-retro-agendas.spec.js) |
| U01–U04 og U06 | Menyen følger oppgavekortets bredde. Brukerprøvene dekker berøring, tastatur og omlasting ved 320, 390 og 1440 CSS-piksler. Dobbel tekststørrelse er prøvd i begge temaer. Synlig knappetekst følger tilgjengelig navn, og kapasitetsrådet viser til Planlegg uken. [Tilgjengelighetsprøvene](../studieplanlegger/tests/e2e/delivery-accessibility.spec.js) |
| D01–D06 | Samordnet lagrings-, personvern- og oppfølgingsdokumentasjon, korrigerte ical.js-lenken og bevarte historiske referanser. POSIX-oppskriften ble prøvd i Linux med ren pakkeinstallasjon, bygg, helsesjekk, syntetisk skriving og omstart med bevart SQLite-tilstand. macOS ble ikke kjørt. [Brukerveiledningen](../studieplanlegger/README.md#lokal-node-server-med-sqlite) · [Sakslisten](issues.md) |

Rettecommiten `6eaa831ec22ffabc1373d0f3e497104dbbdccc6f` gjelder de oppførte områdene. Oppfølgingen `f215d20874dfdd666683c4e5d65f47330133bf56` gjelder tilgjengelig navn på agendakort (U03). Commit `9f6ead353889ea649b7d9599b4132ff9c5b4e7a1` bevarer studentens valg av øktlengde (P12), kontrollerer godkjenningen ved endring av repetisjon (P10–P11) og oppdaterer den eldre agendaen ved neste tidsgrense (K03). Senere justeringer, testkjøringer og publisert versjon spores i [PR #33](https://github.com/IBE160-2026/G37-yilmaz/pull/33).

Den rapporterte førkontrollen på `12c8d33` hadde 2 790 beståtte enhetstester. En annen planprøve fant 175 avvik i 1 800 alternativer. Originalens generator og enkeltrader var ikke tilgjengelige. Den nye, versjonerte matrisen prøvde 1 800 plankort og bestod alle kontroller i sitt eget testutvalg. De historiske tallene 700 lokale nettlesertester, 67 utelatte og 93 produksjonsscenarier tilhører den vedlagte gjennomgangen av førversjonen. Kontroller og overlappende utvalg summeres ikke.

### Åpne punkter

- F03, F05, Vercels kontogrenser og eventuell påkrevd GitHub-CI følges i [sakslisten](issues.md). Dependabot #30 har egne feilede CI-sjekker.
- UiT-fixturen prøver programlogikken uavhengig av kilden. Den separate HTTP-kontrollen 19. november fikk 200 for to offentlige UiT-PDF-adresser. Det gir bare kildebevis ved kontrolltidspunktet. [Geovitenskap](https://uit.no/Content/931776/cache=20261310132856/Studieplan%20Bachelor%20i%20geovitenskap%20H-2025.pdf) · [Applied Computer Science](https://uit.no/Content/941723/cache=20262310134639/2026%20Study%20Plan%20Applied%20Computer%20Science%20-%20Master%20M-IT.pdf)
