# UiT sine offentlige programkontrakter

HTML-opptak hentet 12.09.2026. Testene simulerer HTTP-transport, og er separate fra ekte eksterne adapter-/nettleserforløp.

- `catalogue.html`: https://uit.no/utdanning . Alle 276 kort finnes i HTML; den publiserte Isotope-klienten filtrerer lokalt. Katalogens numeriske dokument-ID er ikke en offisiell studiekode.
- `b-inf.html`: https://uit.no/utdanning/studieprogram/b-inf . Faktisk publisert lenke til `/utdanning/program/oppbygging?studkode=B-INF&p_document_id=279505`.
- `b-inf-structure.html`: denne oppbyggingssiden, som annonserer `ikb4` og `ikb5` via `iKnowBase.PageEngine.reloadComponent`. Den inkluderte offentlige klienten `/ressurs/iknowbase/iknowbase-full-min-b32937a5b693e95fde6034b75e1f76e1.js` bruker GET med `ikbRender` og uendrede sideparametre. Klientkode blir lest som data og aldri utført av importøren.
- `b-inf-component.html` og `empty-component.html`: faktisk `ikbRender=ikb4` og `ikbRender=ikb5` fra samme oppbyggingsside.
- `imat-inf-component.html`: https://uit.no/utdanning/program/oppbygging?studkode=IMAT-INF&p_document_id=279506&ikbRender=ikb4 . Tre navngitte studieretninger, ti studiesemestre hver.
- `nursing-component.html`: https://uit.no/utdanning/program/oppbygging?studkode=B-SYKEPL&p_document_id=661259&ikbRender=ikb4 . Faktiske emner over flere semestre, med kildeoppgitt varighet og hele emnets studiepoeng.
- `engineering-component.html`: https://uit.no/utdanning/program/oppbygging?studkode=B-IE&p_document_id=446226&ikbRender=ikb5 . Den andre dynamiske komponenten har en emnefordeling uten faner. STE-2603 fordeles med fem studiepoeng i hver av to semesterrader; samlet ti.
- `target.json` er en redusert fixture for UiTs observerte offentlige mållenke-JSON. Faktiske `/go/target/{dokument}/{publisert-mål-ID}` svarte med `data.URL` til den samme numeriske programidentiteten. Identitetskontrollen testes også med en motstridende returadresse.

Oppbyggingssiden har ingen kullvelger eller kalenderår. Appen krever eget kull og avklart kalendersemester, viser separate publiserte PDF-planutgaver og låner ikke oppbyggingen til et historisk kull. Valgemnene er noen steder uttrykkelig bare eksempler. Disse beholdes som valgemner med ukjente studiepoeng, sammen med mikroemnekrav og andre overordnede plankrav.

## PDF-planutgaver

`pdf/sources.json` dokumenterer de 14 faktisk lenkede PDF-ene hentet 12.09.2026. De tilsvarende JSON-filene bevarer teksten og koordinatene fra hver side; de er kildedata, ikke håndskrevne demonstrasjonsemner. Kildemanifestets opprinnelige opptelling for fire elektroplaner er fra før lesing av valgfagsvedlegget; slutt-testene teller også de navngitte valgemnene uten å tildele dem et semester. `pdf/868803.pdf` er den faktiske offentlige 2021-utgaven av informatikk bachelor og brukes til å prøve lokal PDF-lesing og transportvalidering sammen.

`uit-pdf.test.js` prøver alle 14 opptak lokalt, uten nettverksforespørsler: 13 lesbare utgaver og én sykepleieutgave fra 2025 med bildelagt emnetabell. Den siste skal vise en presis begrensning og tekst/manuell-alternativ; eldre emner skal ikke erstatte den. Testene kontrollerer dessuten publiserte kullgrenser, sykepleiens ulike kulltabeller, campusvalg og praksisrullering, valgemner, sammenslåtte celler med ukjente studiepoeng, separate studieår og studiesemestre, kildeidentitet og feilende PDF-videresending. Dette er gjenspilling av offentlige opptak, ikke ny ekstern verifikasjon. Gjenkjøring 19.09.2026: 22 PDF-tester og sju eksisterende programtester bestått.
