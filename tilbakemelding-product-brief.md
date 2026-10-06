# Tilbakemelding på product brief

| | |
|---|---|
| **Gruppe** | G37 – G37-yilmaz |
| **Product brief** | `brief.md` (commit 5e23204) |
| **Tilbakemelding fra** | Faglærer i IBE160 (utarbeidet med KI-støtte) |
| **Dato** | 2026-10-06 |

## Samlet vurdering

- **Godt utgangspunkt med justeringer.** Gruppen kan gå videre og innarbeide punktene under.

**Det som er bra:**

1. Problemet er presist beskrevet: studenten må sette sammen emnebeskrivelser, timeplaner, oppgavetekster og kalendere til én plan, og planen svarer ikke på «hva bør jeg gjøre nå?». Skillene mellom «arbeidssteg fullført», «oppgave fullført» og «levert», og mellom logget tid og gjenstående anslag, viser gjennomtenkt domeneforståelse.
2. Studentens kontroll står sentralt: importer bekreftes med kilde og usikkerhet, omplanlegging foreslås og kan angres, og ingenting endres uten godkjenning. Scope har også en tydelig «Out of scope»-liste (hosting, kontoer, betaling, skysynk), og løsningen kjører lokalt med Docker uten nøkler.

**De viktigste endringene:**

1. Briefen gjør «støtte for universiteter og høgskoler i hele Norge» til et leveransekrav, og sier selv at kravet ikke er oppfylt. Et krav som avhenger av andres datakilder, kan dere ikke love. Gjør nasjonal dekning til visjon, og definer et avgrenset sett læresteder (f.eks. HiMolde pluss noen få) som v1-krav.
2. Briefen har gått fra å være en plan til å beskrive implementasjonen (revisjonskontroll, transaksjoner, loopback-binding, Vite-modus). Flytt tekniske detaljer til arkitekturdokumentet, og la briefen beskrive problem, brukere, mål og avgrensning. Det gjør sporbarheten fra plan til kode tydeligere for sensor.
3. Suksesskriteriene er observasjonsmål («observe whether …», «record difficulties»). Formuler dem slik at de kan sjekkes, og knytt dem til de testene dere allerede har.

## Vanskelighetsgrad og gjennomførbarhet

### Vurdert vanskelighetsgrad

- **Vanskelig**

**Sammenlignbart med:** 3) KI-styrt simulering av prosjektledelse (vanskelig) – planlegging med tid, avhengigheter, kapasitet og omplanlegging når noe går galt, fordelt på mange moduler som henger sammen. Selve oppgavelisten alene ville vært nærmere 6) To-do-liste med smarte etiketter (enkel), men importene og omplanleggingen løfter prosjektet tydelig.

**Begrunnelse:**

| Faktor | Nivå (lav / middels / høy) | Kommentar |
|---|---|---|
| Domenelogikk – hvor mange og hvor kompliserte regler og beregninger må stemme? | Høy | Forslag til neste handling ut fra tid, frister og avhengigheter, omplanlegging ved tapt tid, sammenligning av planalternativer og alternative emnekombinasjoner i studieprogram. |
| Datamodell – antall entiteter og relasjoner mellom dem | Høy | Lærested, program, emne, undervisning, oppgave, arbeidssteg, studieøkt, utfall, egenvurdering og revisjoner, med mange relasjoner. |
| Brukere, roller og innlogging | Lav | Én lokal bruker, ingen kontoer. Et godt valg. |
| KI-funksjonalitet i appen, f.eks. kall til språkmodell, prompts i koden og håndtering av usikre svar | Lav | Appen bruker bevisst regler og lokal historikk, ikke generativ KI. Det gjør resultatene forutsigbare og testbare. |
| Integrasjoner og eksterne tjenester, f.eks. API-er, betaling og e-post | Høy | Importer fra mange lærestedskilder (repoet har over 70 kildeadaptere). Kildene kan endre seg når som helst og kan ikke kontrolleres av dere. |
| Sanntid, samtidighet eller flere brukere som påvirker hverandre | Lav | Én bruker lokalt. |
| Filhåndtering, f.eks. opplasting, PDF-lesing og eksport | Høy | Dokument- og kalenderimport, PDF-lesing fra lærestedenes sider og `.ics`-eksport. |
| Sikkerhet og personvern | Middels | Lokal drift og syntetiske testdata er gode valg. Pass på at fixturer hentet fra offentlige kilder ikke inneholder personopplysninger. |

**Hva vanskelighetsgraden betyr for dere:**

- _Vanskelig:_ Et vanskelig prosjekt gir større mulighet for toppkarakter, men også større risiko. Definer en minimal versjon som sikkert kan bli ferdig, og legg resten i tydelige trinn etterpå. Her er kjerneflyten allerede på plass. Risikoen ligger i at omfanget fortsetter å vokse (flere kilder, flere funksjoner), og at kvaliteten og sporbarheten blir vanskeligere å holde oversikt over.

### Gjennomførbarhet med BMAD og Claude Code

Dere skal planlegge med BMAD (product brief → PRD → arkitektur → epics og stories) og implementere med Claude Code. Vurderingen under tar hensyn til at det må være tid til hele denne flyten, og til testing, retting og README til slutt.

| Spørsmål | Vurdering (OK / risiko / stor risiko) | Kommentar |
|---|---|---|
| **Tid og omfang** – kan v1 realistisk bli ferdig og stabil i løpet av semesteret, med tid til flere iterasjoner? | Risiko | Kjernefunksjonaliteten er implementert allerede. Men så lenge «full nasjonal dekning» står som krav, blir leveransen aldri ferdig etter egen definisjon. |
| **BMAD-flyten** – er briefen konkret nok til at PRD, arkitektur og stories kan lages uten store hull, og blir det overkommelig mange stories? | Risiko | Repoet har brief og arkitektur, men ingen PRD eller epics/stories på main. Briefen er skrevet om i etterkant for å beskrive det som er laget. Sensor ser etter en sporbar vei brief → PRD → stories → kode. |
| **Egnet for Claude Code** – bruker løsningen en vanlig, godt dokumentert teknologistakk som Claude Code håndterer godt, eller krever den nisjeteknologi, spesialmaskinvare eller mye manuell konfigurasjon? | OK | Vanlig JavaScript, Node, SQLite og Docker Compose er godt egnet. |
| **Kontroll på KI-ens arbeid** – kan gruppen selv avgjøre om koden gjør det riktige? Krever domenet kunnskap gruppen ikke har, f.eks. avanserte beregninger eller fagregler, så er det vanskelig å kvalitetssikre. | Risiko | Planleggingsreglene kan dere vurdere selv. Over 70 kildeadaptere og over 1 300 enhetstester er derimot mye KI-generert kode å ha reell oversikt over for én person. Vis i dokumentasjonen konkrete eksempler på at dere har kontrollert og rettet KI-ens arbeid. |
| **Testbarhet** – finnes det tydelige regler og forventede resultater som tester kan skrives mot? | OK | Godt testbart, og repoet har allerede enhetstester, nettlesertester og versjonerte fixturer. Knytt testene tydeligere til suksesskriteriene i briefen. |
| **Kjørbar for sensor** – kan appen kjøres lokalt etter README, uten gruppens nøkler, betalte kontoer eller egen infrastruktur? | OK | Docker Compose uten nøkler, med health-sjekk i README. Sørg for at kjerneflyten også virker når eksterne kilder er nede (manuell registrering og fixturer). |
| **Avhengigheter og kostnader** – krever løsningen betalte API-er, f.eks. språkmodeller, og finnes det en plan for kostnad, testmodus eller mock-data? | OK | Ingen betalte API-er. Eneste avhengighet er offentlige kilder, som dere håndterer med fixturer. |

**Konklusjon om gjennomførbarhet:**

- **Gjennomførbart med justert omfang.** Se forslagene under.

**Forslag til justering av omfang eller vanskelighetsgrad:**

1. Erstatt kravet om nasjonal dekning med et avgrenset v1-krav, f.eks. «import fra HiMolde og N navngitte læresteder er verifisert», og flytt resten til visjonen. Stopp utvidelsen med nye kilder til kjerneflyten er stabil og godt dokumentert.
2. Bruk resten av semesteret på kvalitet og sporbarhet i stedet for nye funksjoner: lag PRD og epics/stories som speiler det som finnes, og dokumenter feil dere har funnet i KI-generert kode og hvordan de ble rettet.

## Hvorfor product brief er viktig for mappen

Product brief er utgangspunktet for PRD, arkitektur, stories og til slutt koden. Del 1 av mappen vurderes blant annet på om sensor kan følge en sporbar vei fra plan til ferdig app. Den vurderes også på om appen gjør det dere har beskrevet, om den er testet, om den er godt designet, og om den kan kjøres etter README. Et uklart, for stort eller for lite brief gjør alt dette vanskeligere senere. Det er mye enklere å rette nå enn sent i semesteret.

## 1. Gjennomgang av briefens deler

| Del av brief | Status | Kommentar |
|---|---|---|
| Executive Summary – er det klart hva appen er, og hvilket problem den løser? | Juster | De to første avsnittene er klare. Resten (revisjoner, Docker-volum, emnefarger, `.ics`-eksport) er implementasjonsdetaljer som gjør sammendraget langt og tungt. Kort det ned til hva appen er og hvorfor. |
| The Problem – er problemet konkret, med reelle situasjoner og brukere? | OK | Konkret og godt formulert, med situasjoner som konkurrerende frister, avhengigheter og tapte økter. |
| The Solution – beskriver løsningen brukeropplevelsen, ikke bare teknologi? | OK | Beskriver brukerens vei godt: velg lærested og program, bekreft importer, planlegg, registrer utfall og godta omplanlegging. |
| What Makes This Different – er vurderingen ærlig og realistisk? | Juster | Ærlig om at dere ikke påstår markedsunikhet. Nevn gjerne konkrete alternativer studentene bruker i dag (kalenderapper, Canvas, oppgavelister), så forskjellen blir tydeligere. |
| Who This Serves – er primærbrukerne tydelige, og vet vi hva de trenger? | Juster | «Studenter ved norske universiteter og høgskoler» er bredt. Beskriv én konkret primærbruker, f.eks. en HiMolde-student med 3–4 emner og deltidsjobb. |
| Success Criteria – kan kriteriene faktisk sjekkes eller testes? | Endre | De fleste kriteriene er metoder («observe», «compare», «record»), ikke mål. Formuler dem som sjekkbare utsagn, f.eks. «en ny bruker kan gå fra tom planlegger til bekreftet emne, oppgave og studieøkt», «et omplanleggingsforslag legger aldri en økt oppå fast undervisning», «data overlever omstart av containeren». |
| Scope – er det klart hva som er med i første versjon, og hva som ikke er det? | Endre | God «Out of scope»-liste, men «In» inneholder et krav (nasjonal dekning) som ikke kan oppfylles, og listen har vokst underveis med arbeidssteg, egenvurdering, eksport og planvalg. Lås v1, og flytt nye ideer til en egen liste. |
| Vision – henger visjonen sammen med resten uten å blåse opp omfanget? | OK | Realistisk og tydelig merket som fremtidig retning. Nasjonal dekning hører naturlig hjemme her. |

## 2. Utgangspunkt for del 1 av mappen

Punktene følger kriteriene i sensorveiledningen for del 1. Vektene i parentes viser hvor mye hvert kriterium teller i del 1.

| Kriterium i del 1 | Hva briefen bør legge til rette for | Status | Kommentar |
|---|---|---|---|
| **1. Prosess og KI-styring** (30 %) | Brief som er presis nok til at PRD og stories kan bygges direkte på den, slik at krav kan spores fra brief til kode. | Endre | Historikken har relativt få og svært store commits fordelt på noen få dager, og det mangler PRD og stories på main. Briefen er oppdatert til å beskrive leveransen i etterkant. Lag PRD og stories, og arbeid videre i mindre, sporbare steg. |
| **2. Funksjonalitet og omfang** (20 %) | Realistisk omfang for gruppen og semesteret: en tydelig kjerneflyt som kan bli ferdig og stabil, og nok innhold til å vise reell funksjonalitet. | Juster | Mye reell funksjonalitet. Avgrens kravene slik at det dere leverer, faktisk oppfyller briefen. |
| **3. Kvalitetssikring og testing** (15 %) | Suksesskriterier og funksjoner som er konkrete nok til å bli testtilfeller. | Juster | Omfattende tester finnes. Koble dem tydelig til suksesskriterier og vis eksempler på feil i KI-generert kode som ble funnet og rettet. |
| **4. Design og brukeropplevelse** (10 %) | Tydelige brukere og brukssituasjoner som designet kan bygges rundt, gjerne med de viktigste skjermbildene eller flytene skissert. | Juster | Briefen nevner fokus, rekkefølge og at farge ikke er eneste signal – bra for tilgjengelighet. Legg gjerne ved skjermbilder eller skisser av hovedflyten. |
| **5. Kodekvalitet og arkitektur** (10 %) | Teknologivalg som er begrunnet og ikke mer komplekse enn appen trenger. | OK | Enkel og begrunnet stakk (Vite, Node, SQLite, Docker). Følg med på at mange kildeadaptere ikke gir mye duplisert kode. |
| **6. README og kjørbarhet** (10 %) | Løsning som andre kan kjøre lokalt uten betalte kontoer, og uten tilgang til gruppens egne tjenester og nøkler. | OK | Tydelig README med Docker-oppstart og testkommandoer, uten nøkler. |
| **7. Ryddighet i repoet** (5 %) | En plan for hvor hemmeligheter, testdata og dokumentasjon skal ligge. | Juster | `.env.example`, `.gitignore` og syntetiske testdata er på plass. Briefen ligger i roten mens øvrige planleggingsdokumenter ligger i `.docs/`; samle dem. Kontroller at alle fixturer fra offentlige kilder er fri for personopplysninger. |

## 3. Neste steg for gruppen

1. Revider Scope: gjør nasjonal dekning til visjon og definer et avgrenset, verifiserbart sett læresteder som v1-krav.
2. Skriv suksesskriteriene om til sjekkbare utsagn, og flytt tekniske detaljer fra briefen til arkitekturdokumentet.
3. Lag PRD og epics/stories som dekker det som er bygget, slik at sensor kan spore kravene fra brief til kode.
4. Arbeid videre i mindre commits, og dokumenter konkrete eksempler på at dere har vurdert, avvist eller rettet KI-forslag.

Oppdater product brief i repoet når dere har gjort endringene, slik at historikken viser hvordan planen utviklet seg. Det er en del av prosessen sensor ser etter.
