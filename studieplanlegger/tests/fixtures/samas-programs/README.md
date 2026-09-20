# Offentlige Sámi-kildefixtures

Hentet 12.09.2026 fra samas.no. HTML er kildeopptak; JSON inneholder tekst og koordinater fra de publiserte PDF-ene, lest lokalt uten OCR. Fixturetester simulerer transport og dokumenterer ikke alene en ekstern import.

- `catalogue-nb.html`: https://samas.no/nb/studier (7 kort).
- `catalogue-se-{0,1,2}.html`: https://samas.no/se/oahput og publisert `?page=1`, `?page=2` (12 + 12 + 2 kort). Tilbud på ulike språk beholdes; listen dokumenterer aktuelle publiserte kataloger, ikke alle historiske programmer.
- `tolking.html`: https://samas.no/nb/studie/dul-1000-innforing-i-tolking-sorsamisk-norsk . Faktisk oppstart høst 2026, to navngitte emner som går parallelt over to semestre.
- `master-language.html`: https://samas.no/se/studie/samegiela-ja-sami-girjjalasvuoda-masterprogramma . Oppstart 2026, 14 navngitte emner med obligatorisk/valgskille, uten semesterplassering.
- `gmoa.html`: https://samas.no/se/studier/sami-manaidgardeoahpaheaddjeoahppu-geabbilis-programma . `gmoa-2025.json` fra https://samas.no/sites/default/files/2025-08/GMOA%202025%20-%20f%C3%A1gajuohkin%20.pdf . Ni emner fordelt på sju faktiske kalendersemestre, hele emnepoeng separat fra semesterandeler.
- `vuoma.html`: https://samas.no/se/studier/sami-vuoddoskuvlaoahpaheaddjeoahppu-1-7-ceahki-master . `vuoma-2025.json` fra https://samas.no/sites/default/files/2025-08/F%C3%A1gajuohkin%20VUOMA%201-7%202025%20studeantajovkui.pdf .
- `vuoma510.html`: https://samas.no/se/studier/sami-vuoddoskuvlaoahpaheaddjeoahppu-5-10-ceahki-master . `vuoma510-2025.json` fra https://samas.no/sites/default/files/2025-08/F%C3%A1gajuohkin%20VUOMA%205-10%202025%20studeantajovkui.pdf . To sider; femte studieår fortsetter uten gjentatt tabellhode.

Begge VUOMA-sidene sier 2024 i lenketeksten, mens filnavnet og PDF-forsiden bekrefter 2025. Konflikten vises. Sammenslåtte årsceller blir uavklarte valg. Praksis uten studiepoeng får ukjent verdi; ufullstendig V5PÁČ-rad blir et synlig avklaringskrav. Språk- og undervisningsfagvalg velges av studenten.

TimeEdit-inngangen i `../public-timeedit/samas-entry.html` kommer fra https://cloud.timeedit.net/sahg/web/student/ri1Q56.html, lenket gjennom institusjonens offentlige studentinngang. Søket med MOA-kode bruker et simulert svar med faktiske publiserte objektidentiteter for å kontrollere mellomrom og lokal avgrensning. Ekte eksterne program- og kalenderkjeder føres separat i det aktive kildebeviset.
