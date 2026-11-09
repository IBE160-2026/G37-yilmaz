# Historikkopprydding i Ajour — 9. november 2026

Denne delbare oppsummeringen følger opp de [tolv historiske funnene i kontrollrapporten](submission-audit-2026-11-01.md#git-historikk-og-gjenstående-oppfølging). Den bygger på de daterte publiserings- og overgangskontrollene fra 9. november. Originalrapportene og gjenopprettingsgrunnlaget oppbevares privat; ingen sensitive verdier eller private vedlegg gjengis her.

## Hva som ble ryddet og bevart

Etter uttrykkelig godkjenning ble 26 avtalte branches oppdatert samlet, med kontroll av forventet gammel commit-ID for hver branch. Den rensede main-commiten er [`05054f79d420b5d073799cd0eebf8321d8560e2f`](https://github.com/IBE160-2026/G37-yilmaz/commit/05054f79d420b5d073799cd0eebf8321d8560e2f).

Mulige kalender-/møtetilgangsverdier og medietoken ble erstattet med syntetiske verdier. Unødvendige mottaker-, kontakt- og personfelt ble fjernet eller anonymisert, også i historiske duplikater. Lokale brukerbaner fikk anonymisert brukernavnsegmentet. PDF-personmetadata ble fjernet strukturelt i to eldre versjoner, inkludert egendefinerte egenskaper og nestet XMP. Funn 7 var en offentlig institusjonsbeskrivelse og ble beholdt som falskt positivt treff. Samlet ble 23 historiske blobs i 18 filbaner erstattet; kildehenvisninger, lisenser og autoriserte forfatteropplysninger ble bevart.

**Alle 899 filer på main var byteidentiske før og etter oppryddingen**, inkludert dagens rensede testfiler. Appkode, design, avhengigheter, produktkrav, refleksjonsrapport og feilrettingene i PR #27 ble bevart. Alle 141 commits beholdt forfattere, datoer, meldinger og mergeforhold. **139 commit-ID-er endret seg; 28 kryptografiske signaturer falt bort og gjelder ikke de nye commitene.** PR #1–#27 ble historisk berørt. Ingen tags eller beskyttelser ble endret.

Gamle SHA-henvisninger og testresultater beholdes som datert vurderingsgrunnlag. Privat originalbackup og kartet mellom gamle og nye commit-ID-er er bevart for oppfølging av slike henvisninger. Den senere lokale overgangen endret bare Git-administrasjonen; arbeidsfiler og innstillinger ble beholdt på opprinnelig plassering, og gjenoppretting av upublisert arbeid ble kontrollert.

## Dokumenterte kontroller 9. november

Dette er resultater fra oppryddingen, ikke nye testkjøringer under dokumentasjonsarbeidet:

- En ny GitHub-klon bekreftet de 26 branchene, 141 commits, 899 uendrede filer og bestått `git fsck --full`. Målrettet kontroll av 1956 blobobjekter fant ingen av de 23 erstattede originalblobbene i den undersøkte branch-historikken.
- Alle tre PDF-versjonene ble gjenåpnet og egenskapene kontrollert særskilt. Sider, sideinnhold og ressurser ble bevart. Dagens uendrede PDF beholder sine tre tidligere strukturvarsler.
- [Ajour quality på renset main](https://github.com/IBE160-2026/G37-yilmaz/actions/runs/42677012562) bestod: 2698 enhetstester, 184 Chromium-prøver, fire Firefox/WebKit-prøver, 14 SQLite-prøver, produksjonsbygg og avhengighetskontroll uten rapporterte sårbarheter. Eksisterende bundlevarsel består; den historiske testbranchen med en bevisst feilende kontrolltest er uendret.
- [Ajour deployment smoke](https://github.com/IBE160-2026/G37-yilmaz/actions/runs/42678421271) bestod med 60 runtimeprøver og seks avgrensede prøver mot offentlige kilder. Produksjonscommiten på hovedadressen ble kontrollert mot SHA-en over. Vercel-domener, prosjektinnstillinger og brukerdata ble ikke flyttet eller endret.

Dette er tekniske kontroller med isolerte testdata, ikke ny egenutprøving eller dokumentasjon på generell studentnytte. [Tidligere verifikasjonsresultater](../../studieplanlegger/VERIFICATION.md) beholder sine datoer og avgrensninger.

## Fortsatt oppfølging

**Renset branch-historikk er ikke det samme som fjernede kopier eller sperret tilgang.** Etter publisering kunne gamle PR-referanser fortsatt nå de 23 originalblobbene, og gamle GitHub-visninger viste fortsatt berørt innhold. Originalbackup og andre eldre kopier kan også inneholde det. Eventuell håndtering hos GitHub krever administrator-/Support-oppfølging; Support-utkastet er ikke sendt.

Ingen tilgangsverdi er brukt, sperret eller byttet. Tjenesteeierne må vurdere funn 1–4. GitHub About-lenken var heller ikke rettet ved kontrollen: påloggingen manglet nødvendige rettigheter. Administrator må sette repoets Website til `https://ajour-sooty.vercel.app/` og kontrollere at den er lagret. [Åpne punkter](../../.logs/issues.md#personlig-sluttkontroll-og-historisk-eksponering) bevarer denne oppfølgingen; ingen fullstendig sletting fra GitHub eller andre kopier påstås.
