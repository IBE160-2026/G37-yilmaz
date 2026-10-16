# PRD: avgrenset Studieplan-leveranse

**Rekonstruert 2026-10-16.** Grunnlag og proveniens står i [indeksen](README.md). [Briefen](../../brief.md) eier produktløftet; kravene her beskriver eksisterende funksjonalitet og en planlagt studentprøve, ikke nye funksjonsbestillinger.

## Bruker og avgrensning

Primærscenarioet er den hypotetiske HiMolde-studenten med IBE110, IBE430, IBE160 og deltidsjobb. Kjernen er registrering/import → gjennomførbart steg/økt → utfall → godkjent justering. Appen skal fungere med manuell registrering når eksterne kilder er utilgjengelige. Studenten kontrollerer hva som lagres; forslag og ukjent informasjon blir ikke behandlet som bekreftede fakta.

Importkravet er HiMolde IT 2026–27 (IBE110 + IBE430 og enten IBE160 eller IBE102 + IBE152), undervisning bare for IBE110/IBE430/IBE160 høst 2026, og NTNU ARK1001/EXPH0100 emnemetadata og emnelenket undervisning høst 2026. Ingen komplett NTNU-program-, eksamens- eller personlig gruppedekning loves. Nasjonal dekning er visjon. Lokal fullstack, database og Docker er med; obligatorisk hosting, kontoer, cloud og generativ KI er utenfor.

## Krav

| ID | Krav og sjekkbart resultat | Brief / story |
| --- | --- | --- |
| R-01 | Manuelt emne og tittel alene kan bli en lagret oppgave; frivillige felt kan fylles senere, og omlasting bevarer emne-/oppgave-/øktkoblinger. | SC-01 / S-01 |
| R-02 | Import bevarer kildens påkrevde emner og alternative grener. Vis kilde, periode, usikkerhet og endringer før bekreftelse. Feilet oppdatering bevarer tidligere undervisning og valg. | SC-02 / S-02 |
| R-03 | Forslag bruker registrerte vinduer, opptatt undervisning/aktiviteter, frister, avhengigheter og gjenstående arbeid. Manglende/ukjent kapasitet forklares; ikke gjett mestring eller utført arbeid. | SC-03 / S-03 |
| R-04 | Faktiske minutter og nytt gjenstående anslag registreres hver for seg. Fullført steg fullfører ikke oppgaven; fullført oppgave bekrefter ikke innlevering. | SC-04 / S-04 |
| R-05 | Forhåndsvisning skriver ikke planen. Godkjenning validerer grunnlaget på nytt og skriver samlet; angre gjenoppretter samlet endring, foreldet grunnlag avvises. | SC-05 / S-05 |
| R-06 | Lokal produksjonslagring bevarer identiteter og relasjoner etter restart/gjenskaping med samme volum; ugyldig eller foreldet skriving avvises uten delvis lagring. | SC-06 / S-06 |
| R-07 | En ny student gjennomfører hovedflyten og forklarer ferdig/levert uten fasilitatorhjelp etter prøveprotokollen. Teknisk onboarding er ikke studentbevis. | SC-07 / S-07 |
| R-08 | Bevar leverte tillegg: ordnede steg, frivillig egenvurdering/repetisjon, kalenderkopi og plansammenligning. Logget tid er ikke mestring; repetisjon krever godkjenning og eksport er ikke synkronisering. | Eksisterende tillegg / S-08 |
| Q-01 | Norsk grensesnitt, merkede felt, tastaturfokus og tekstlig status/emnekode; farge er tillegg til tekst. | SC-01, SC-07 / S-01, S-07 |
| Q-02 | Ingen konto eller betalt API kreves. Studentdata lagres lokalt; private notater, rålogger og runtimefiler skal ikke inngå i Git-leveransen. Offentlige importkilder er eksterne avhengigheter. | SC-02, SC-06 / S-02, S-06 |
| Q-03 | Evidens oppgir dato, metode og avgrensning. Skill fixturtest, live transport, teknisk UI, Docker og studentprøve. | Alle SC / alle stories |

## Aksept og status

[Stories](EPICS-CURRENT.md) konkretiserer Given/When/Then. [Sporbarhetsmatrisen](TRACEABILITY.md) viser nøyaktige tester og status per forventet resultat. R-01–R-06/R-08 er implementert med avgrenset teknisk evidens; ingen av dem innebærer universell kilde- eller feilfrihetsgaranti. R-07 er ikke utprøvd med student. Q-01 har teknisk evidens, ikke dokumentert studentforståelse; Q-02/Q-03 avgrenses av de faktiske kontrollene. Denne dokumentasjonsrunden kjører ikke app-/Docker-aksepten på nytt.

Sensorveiledningen for del 1 er lest og kontrollert 2026-10-16; se kildeidentifikasjon og resterende kilder i indeksen. Faktisk studentnytte, personlig refleksjon og betydningen av lærerens Claude Code-formulering er fortsatt åpne spørsmål. De hindrer ikke korrekt dokumentasjon av eksisterende kode og evidens.
