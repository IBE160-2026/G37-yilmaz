# Refleksjonsrapport om Ajour

Programmering med KI · IBE160 · Høsten 2026

## 1. Gruppeinformasjon

**Gruppenavn:** G37 – Git Happens

**Gruppemedlem:** Elias Hemsett Yilmaz

**Student-e-post:** elyil2613@himolde.no

**Dato:** 1. november 2026

Jeg har utviklet Ajour alene, med omfattende hjelp fra KI til kodingen. Prosjektet begynte med et problem jeg selv opplevde som student. Underveis lærte jeg både hvor mye KI kan gjøre tilgjengelig for en nybegynner, og hvor krevende det er å kontrollere resultatet. Denne rapporten beskriver arbeidsprosessen, konkrete feil og hva erfaringene har lært meg om ansvar, testing og egen kompetanse.

## 2. Utviklingsprosessen

### 2.1 Oversikt over prosjektet

Jeg studerer ved et universitet og en høgskole og tar flere emner samtidig. I tillegg jobber jeg. Informasjonen jeg trenger, ligger i forskjellige semesterplaner og kalendere, og jeg har måttet samle den selv for å få oversikt over aktiviteter og mulige kollisjoner. Dette var utgangspunktet for Ajour. Jeg ønsket en løsning som samlet studiene og egne avtaler, og som kunne hjelpe andre i samme situasjon.

Ajour kombinerer emner, oppgaver, undervisning og studieøkter. Studenten kan registrere en oppgave, anslå gjenstående arbeid og få forslag til når arbeidet kan gjøres. Planen godkjennes av studenten. Etter en økt registreres faktisk arbeidstid og gjenstående anslag hver for seg. Fullført arbeid og bekreftet innlevering er også forskjellige handlinger. Dette er viktig fordi en oppgave kan være ferdig skrevet uten å være levert. [1]

Jeg har brukt appen litt til egne behov, men hovedsakelig med testdata. Jeg er fornøyd med hvor løsningen har kommet, samtidig som jeg trenger mer erfaring med den gjennom vanlige studieuker. Testene viser at bestemte handlinger fungerer. De viser foreløpig mindre om hvor mye appen faktisk hjelper meg eller andre over tid.

### 2.2 Arbeidsmetodikk

Jeg begynte omtrent i starten av september. Jeg anslår at jeg vanligvis brukte tre til fire timer i uken, med mer arbeid mot slutten. Dette er et grovt anslag; jeg har ikke et sikkert samlet timetall. Arbeidet foregikk når jeg var ferdig på jobb og hadde tid mellom andre studier.

Som eneste gruppemedlem tok jeg alle beslutningene om prosjektets retning. Det gjorde det enkelt å velge hva jeg ville prioritere, men jeg manglet en samarbeidspartner som kunne utfordre vurderingene mine. Det vanskeligste var ofte å vite hva som måtte gjøres og i hvilken rekkefølge. Jeg fikk etter hvert bedre oversikt, men starten var mer uorganisert enn jeg skulle ønske.

Jeg brukte ChatGPT til diskusjon og utforming av oppgaver til KI, og Codex i terminalen i VS Code til arbeid med prosjektet. Der brukte jeg også BMAD-funksjoner, blant annet bmad-advanced-elicitation. BMAD hjalp meg med å utforske ideen og stille flere spørsmål til løsningene. Jeg snakket dessuten med medstudenter og andre mennesker. Disse samtalene ga perspektiver jeg ikke fikk fra KI alene.

GitHub ble brukt til kode og dokumentasjon. Mot slutten ble rettingene levert gjennom pull requests med kontroller før publisering. Jeg opplevde at tydelige, avgrensede oppgaver fungerte bedre enn brede bestillinger om å forbedre hele appen. Skjermbilder og konkrete eksempler gjorde det lettere å forklare hva jeg ønsket endret.

### 2.3 Teknologi og verktøy

Brukergrensesnittet er laget med vanlig JavaScript, HTML og CSS, med Vite som utviklings- og byggeverktøy. Den lokale serverdelen bruker Node.js og SQLite. Docker gjør den lokale løsningen mulig å starte med et samlet oppsett. I den publiserte Vercel-utgaven lagres planen i nettleserprofilens localStorage, mens avgrensede serverfunksjoner støtter import. Nettutgaven har ingen konto eller synkronisering mellom enheter. [1]

Automatisert testing omfatter Vitest og Playwright. Git og GitHub brukes til versjonskontroll, og GitHub Actions til automatiske kontroller. KI har hjulpet med implementering, feilsøking, tester og dokumentasjon. Selve Ajour bruker derimot regler og registrerte opplysninger til forslagene sine, uten å sende brukerens oppgaver til en generativ språkmodell. [1, 3]

Før prosjektet kjente jeg til ChatGPT, men hadde ingen erfaring med koding og lite kjennskap til resten av verktøykjeden. Jeg kan derfor ikke fremstille alle teknologivalgene som valg jeg gjorde ut fra egen teknisk ekspertise. KI bidro sterkt, mens forelesningene og pensum hjalp meg med å forstå hva verktøyene skulle brukes til.

### 2.4 Utviklingsfaser

Ideen kom før den tekniske løsningen. Først drøftet jeg behovet og mulige funksjoner med KI og andre studenter. Det gikk forholdsvis raskt å få et skall av nettsiden på plass. Deretter brukte jeg mye lengre tid på at skjermbildene og funksjonene skulle henge sammen og fungere slik jeg ønsket.

Planlegging og utvikling gikk delvis om hverandre. Faglærerens tilbakemelding 6. oktober pekte på for stort omfang, tekniske detaljer i briefen og manglende PRD og stories. PRD er dokumentet som beskriver produktkravene, mens stories deler arbeidet opp i konkrete brukerbehov. Jeg laget og systematiserte disse dokumentene etterpå. Repoet beskriver dette som en rekonstruksjon 16. oktober, ikke som dokumenter som hadde styrt all tidligere utvikling. [2, 3]

Tilbakemeldingen gjorde at jeg endret arbeidsmåte. Jeg avgrenset første versjon til dokumenterte eksempler fra enkelte læresteder og flyttet nasjonal dekning til en fremtidig visjon. Senere arbeid handlet mer om kvalitet og sammenheng mellom krav, kode og tester. BMAD-malen skiller nettopp mellom hva første versjon skal levere og hva produktet kan bli senere. Jeg forsto nytten av dette skillet tydeligere etter at mitt eget omfang hadde vokst. [2, 5]

Den siste fasen besto av egenutprøving, feilretting og omprøving. Jeg meldte konkrete avvik, fikk hjelp til retting og prøvde igjen. Til slutt ble dokumentene samordnet med leveransen. Jeg lagret ikke systematisk alle de opprinnelige promptene. Noen korte, daterte utdrag finnes i prosessdokumentet, men de erstatter ikke en fullstendig logg. Dette er en svakhet ved dokumentasjonen jeg ville håndtert annerledes neste gang. [3]

## 3. Utfordringer og løsninger

### 3.1 Tekniske utfordringer

#### Store oppgaver som ikke ga forslag til kort arbeid

En av de tydeligste feilene oppsto i «Ditt neste steg». En oppgave hadde 1200 minutter gjenstående, kunne deles opp og hadde ingen blokkeringer. Likevel fikk jeg ingen forslag når jeg valgte 30 minutter. Samtidig kunne kalenderplanleggingen dele den samme oppgaven i 40 økter på 30 minutter. Funksjonene ga dermed ulike svar på om det var mulig å arbeide med oppgaven. [3]

Jeg oppdaget problemet gjennom å prøve løsningen som en student med en stor innlevering. Et totalanslag på 20 timer burde ikke hindre en kort arbeidsøkt. Den tekniske rettingen gjorde at oversikten også kunne foreslå deløkter for startklare, delbare oppgaver. I omprøvingen viste den «Arbeid nå: 30 min · deløkt», samtidig som totalanslaget fortsatt var 1200 minutter og oppgaven var uferdig.

KI hjalp med å finne og rette logikken. Mitt bidrag var å oppdage motsetningen og presisere ønsket oppførsel. Jeg lærte at en test må følge brukerens behov på tvers av skjermbilder. At kalenderen kunne dele opp arbeidet, var ikke tilstrekkelig når oversikten fortsatt utelot oppgaven.

#### Gjentatt import og gjenoppretting av sikkerhetskopi

En annen utfordring gjaldt lagring. Gjentatt import av samme fil med 500 aktiviteter kunne vise at ingenting var nytt eller oppdatert, men likevel feile ved lagring. Historikken hadde tidligere vokst betydelig ved en slik import. Gjenoppretting av en sikkerhetskopi på omtrent 6,62 MB stoppet også med en melding om nettleserlagring. De eksisterende dataene var bevart etter feilen og ny innlasting. [3]

Den dokumenterte feilsøkingen viste at importmetadata utløste store Angre-kopier, og at gjenoppretting lagret doble representasjoner. Rettingen unngikk unødvendig lagring ved identisk import og komprimerte gjenopprettingskopien. I min omprøving ga samme 500-fil 525 uendrede elementer, ingen lagringsfeil og null vekst i historikken. Den store sikkerhetskopien kunne faktisk gjenopprettes fra sju til seks oppgaver, med øvrige data bevart etter omlasting. [3]

Her var jeg avhengig av KI for den tekniske analysen. Samtidig kunne jeg kontrollere konkrete resultater før og etter. Erfaringen viste hvor viktig det er å teste gjentakelser og større datamengder. En vellykket første import sier lite om hva som skjer etter flere importforsøk og mange historikkoppføringer.

#### Grensesnitt og forståelig arbeidsflyt

Grensesnittet var blant de mest tidkrevende delene. Jeg hadde en tydelig mening om hvordan nettsiden skulle se ut, men kunne ikke selv kode endringene direkte. KI foreslo ofte løsninger jeg ikke likte. Fargevalget krevde mange runder før jeg fant noe som passet. Logo og illustrasjon ble laget med KI etter mine beskrivelser.

Problemet gjaldt også forståelse. Muligheten til å dele opp store oppgaver var først vanskelig å oppdage under «Flere detaljer». Forutsetninger var heller ikke enkle å velge bort. Etter retting ble forklaringen om totalanslag og oppdeling mer synlig, og det kom en tastaturtilgjengelig knapp for å fjerne alle forutsetninger. [3]

Jeg lærte at en funksjon kan være implementert uten å være intuitiv. Når jeg selv måtte lete etter hvordan en viktig handling skulle utføres, var det et tegn på at grensesnittet trengte arbeid. Dette er noe av grunnen til at jeg brukte så mye tid på sammenhengen mellom funksjonene.

### 3.2 Samarbeidsutfordringer

Jeg hadde ingen intern oppgavefordeling eller konflikter med andre gruppemedlemmer. Utfordringen var heller at jeg måtte fylle alle rollene selv. KI kunne gi mange forslag, men hadde ikke en medstudents erfaring med studiehverdagen eller et selvstendig ansvar for resultatet.

Samtalene med andre var derfor verdifulle. Navnet Ajour kom fra en medstudent etter at forslagene fra KI ikke hadde truffet. Jeg tror en gruppe kunne gitt flere slike innspill og bedre vurderinger av løsningen. Samtidig ville samarbeid krevd mer koordinering. I dette prosjektet hadde jeg friheten til å arbeide når tiden min tillot det.

### 3.3 KI-spesifikke utfordringer

KI misforsto noen ganger hva jeg ønsket og la til funksjoner som ble overfladiske eller som jeg ikke hadde bedt om. Noen misforståelser kan ha skyldtes at jeg skrev uklare prompter. Andre ganger leste jeg selv ikke grundig nok før jeg lot arbeidet fortsette.

Jeg måtte lære å stoppe opp, undersøke endringer og forklare forventningene tydeligere. Mer presise beskrivelser av hva som skulle skje, hva som skulle beholdes og hvordan resultatet kunne prøves, ga meg bedre kontroll. Forelesningens begrep «context engineering» hjelper meg å forstå dette: KI trenger relevant prosjektinformasjon og konkrete rammer for å kunne arbeide nyttig. [4]

## 4. Kritisk vurdering av KI sin påvirkning

### 4.1 Fordeler med KI-assistanse

Den største fordelen var at jeg kunne gjennomføre et prosjekt som lå langt over det jeg kunne programmere alene. KI hjalp meg med å omsette beskrivelser til fungerende kode og gjorde det mulig å prøve ideer raskt. Den første synlige nettsiden kom derfor raskt på plass. Det ga motivasjon til å fortsette, også når detaljene senere ble vanskelige.

Jeg lærte å bruke VS Code, formulere tydeligere prompter og orientere meg bedre i et prosjekt. Forelesningene og pensum ga begreper jeg kunne knytte til praktiske erfaringer. Git, tester og publisering var først fremmede deler av arbeidet, men fikk mening når jeg så hvorfor de var nødvendige.

KI bidro også til automatiske tester og tekniske løsninger for validering, lagring og gjenoppretting. Disse var viktige for et prosjekt med mange sammenhengende funksjoner. Jeg kan likevel ikke vurdere kvaliteten på all koden selv. Det jeg kan vise, er konkrete tilfeller der endringer ga riktigere oppførsel og ble kontrollert med relevante prøver.

### 4.2 Begrensninger og ulemper

I starten tok jeg for ofte forklaringene fra KI for god fisk. Når man har liten kodekunnskap, er det vanskelig å skille en overbevisende forklaring fra en løsning som faktisk holder. En konsekvens var at jeg ble mer avhengig av KI enn jeg burde ha vært. Jeg kunne få mye gjort uten å forstå alle detaljene i det som ble endret.

Det er også en fare for at KI gjør det for lett å legge til nye funksjoner. Hver enkelt utvidelse kan virke overkommelig, mens summen blir vanskelig å kontrollere. Faglærerens tilbakemelding om de mange kildeadaptrene gjorde denne risikoen konkret. Jeg måtte begrense løftet om hva første versjon skulle støtte. [2]

For kreativiteten var KI nyttig som samtalepartner, men mange forslag føltes lite relevante. Jeg beholdt egne ønsker for utseende og oppførsel og avviste forslag som ikke passet. Dette krevde utholdenhet, særlig i arbeidet med farger og flyt. Samtidig ser jeg at jeg kunne ha låst meg for tidlig til forslag fra KI dersom jeg ikke hadde vært tydelig på egne preferanser.

### 4.3 Sammenligning med og uten KI

Uten KI kunne jeg kanskje laget en enkel kalender, men jeg er usikker på om jeg hadde klart selv det innenfor tiden jeg hadde. Jeg hadde ingen kodeerfaring å bygge på. Import fra ulike kilder, lagring, omplanlegging og samlet brukergrensesnitt ville vært spesielt vanskelig.

Et prosjekt uten KI ville trolig hatt mindre omfang. Det kunne gitt meg mer trening i grunnleggende programmering, fordi jeg måtte ha skrevet og forstått mer selv. Med KI kom jeg lenger med produktet, men trenger fortsatt å bygge opp den tekniske forståelsen. Jeg har ikke grunnlag for å tallfeste tidsbesparelsen eller si at KI alltid gir bedre kvalitet.

### 4.4 Samlet vurdering

KI var samlet sett svært positivt for dette prosjektet. Jeg fikk utviklet en løsning som svarer på et behov jeg kjenner, og interessen min for programmering har økt. Samtidig ble det tydelig at rask produksjon av kode ikke betyr at prosjektet er ferdig. Mye av arbeidet lå i å oppdage feil, forklare dem og kontrollere rettingene. Den viktigste lærdommen er at jeg må beholde ansvaret for målet og vurderingen av resultatet.

## 5. Etiske implikasjoner

### 5.1 Ansvar og eierskap

Jeg mener at ansvaret ligger hos meg som utvikler og prosjekteier. Jeg har valgt å bruke KI og bestemt hva den skal gjøre. Hvis appen gir et misvisende forslag eller lagrer noe feil, kan jeg ikke nøye meg med å si at KI skrev koden. Jeg må kunne forklare begrensningene og følge opp feilene jeg blir kjent med.

Opphavsrett og gjenbruk er også relevante spørsmål. Jeg har laget grafikken med KI ut fra egne beskrivelser, men det alene gir ikke grunnlag for å love at alle rettighetsspørsmål er avklart. For biblioteker, skrifttyper og eksternt materiale må opprinnelse og vilkår undersøkes. Prosjektet beholder lisensinformasjon for Manrope-skriften. Det er et konkret tiltak, men jeg vil ikke fremstille det som en full juridisk gjennomgang av hele leveransen. [3]

### 5.2 Transparens

Jeg mener det er viktig å være åpen om KI-bruken. Jeg har bestemt ideen, utformingen og ønsket funksjon, mens KI har bidratt omfattende til koden og den tekniske dokumentasjonen. Å fremstille alt som egen håndskrevet kode ville gitt et feil bilde av arbeidet og kompetansen min.

Samtidig må egenutprøving skilles fra automatiske kontroller. Jeg har selv prøvd løsningen og meldt feil. Automatiserte tester har kontrollert andre deler av oppførselen. Jeg har også brukt ChatGPT til å strukturere og formulere denne rapporten ut fra mine egne svar og prosjektmaterialet. Erfaringene og vurderingene bygger på det jeg har fortalt, og jeg har ansvar for å kontrollere den endelige teksten.

### 5.3 Påvirkning på læring og kompetanse

KI kan senke terskelen for å begynne, men også gjøre det mulig å hoppe over forståelse. Jeg merket dette når det ble gjennomført endringer jeg ikke forsto godt nok. Hvis jeg fortsetter slik uten å lære mer om koden, vil jeg være sårbar hver gang noe uventet skjer.

For meg bør videre læring derfor handle om mindre kodeområder som jeg faktisk kan forstå og endre selv. Et naturlig neste steg vil være mer trening i å lese kode og knytte en regel til en konkret test. Det vil gjøre meg bedre i stand til å vurdere KI-forslag, samtidig som jeg fortsatt kan bruke KI som støtte.

### 5.4 Arbeidsmarkedet

Jeg tror KI vil endre utviklerrollen betydelig, men ikke gjøre utviklere overflødige. Erfaringen min viser at behovet for å definere problemet og kontrollere løsningen består. Jeg tror kravforståelse, kommunikasjon og kvalitetssikring vil bli enda viktigere når mye kode kan produseres raskt.

Gode prompter er en del av dette, men teknisk forståelse er også nødvendig. Min egen avhengighet av KI viser begrensningen ved å kunne beskrive et ønske uten å forstå implementeringen godt nok. Prosjektet har gjort meg mer interessert i å lære programmering, fremfor å behandle KI som en erstatning for videre læring.

### 5.5 Datasikkerhet og personvern

Jeg delte skjermbilder, lenker og prosjektopplysninger med KI, og var opptatt av å unngå personopplysninger. Testingen foregikk hovedsakelig med testdata. Samtidig viser prosessdokumentasjonen at lagrede utdrag fra offentlige kilder tidligere inneholdt unødvendige kontakt- og profilopplysninger og kalenderrelatert tilgangsmateriale. Dette ble ryddet i den daværende filversjonen, men dokumentasjonen gir ingen garanti om at eldre Git-historikk er fri for slikt innhold. [3]

Dette er en viktig påminnelse om at en offentlig kilde kan inneholde mer enn appen trenger. Min egen hensikt om å unngå personopplysninger er ikke nok til å dokumentere hva alle automatiske innhentinger har lagret. Jeg har sett over mye, men ikke alt, og må være tydelig på den begrensningen.

Sikkerhetskopier viste også at tidligere verdier kan ligge i Angre-historikken selv om de ikke vises i dagens plan. Derfor må en backup vurderes som et større datasett enn det skjermbildet viser. At prøvene ikke avdekket datatap eller uønsket kodekjøring, betyr heller ikke at appen er fullstendig sikker.

## 6. Teknologiske implikasjoner

### 6.1 Kodekvalitet og vedlikehold

KI gjorde det mulig å bygge mange funksjoner, men økte også mengden kode jeg måtte forholde meg til. Jeg synes det var vanskelig å finne frem i starten. Etter hvert ble tydeligere dokumentstruktur og koblinger mellom krav og tester mer nyttige for meg.

Import fra læresteder krever dessuten vedlikehold fordi kildene kan endre seg. NTNUs samlede programkilde returnerte fortsatt tomt i de dokumenterte prøvene, selv om enkelt-emnesøk fungerte. En bestemt termin- og studiepoengtabell fra UiT var heller ikke støttet. Disse begrensningene viser hvorfor et fungerende eksempel ikke kan gjøres om til et løfte om at alle programmer ved et lærested vil fungere. [1, 3]

Jeg vurderer derfor vedlikehold som en del av funksjonens kostnad. Før jeg utvider med flere kilder, trenger jeg bedre oversikt over dem som allerede finnes og hvordan feil skal håndteres for brukeren.

### 6.2 Standarder og beste praksis

KI følger ikke automatisk en god arbeidsmåte bare fordi den kan beskrive den. Lagring av store historikkopier ved en uendret import var et eksempel på at en løsning kunne ha uheldige konsekvenser i praksis. De tekniske feilmeldingene ved ugyldige klokkeslett viste også at validering kunne virke uten at brukeren fikk en forståelig forklaring.

Jeg opplevde manuelle prøver som særlig nyttige fordi jeg kunne følge akkurat den handlingen jeg ønsket å kontrollere. Automatiske tester var samtidig viktige for gjentakelse og kontroll av tekniske regler. Jeg ville ikke valgt bort noen av delene. Forelesningen om GitHub Actions beskriver automatisering som en del av arbeidet med å hindre uønskede publiseringer. For mitt prosjekt må slike kontroller fortsatt kombineres med vurdering av hva brukeren faktisk opplever. [4]

### 6.3 Fremtidig utvikling

Videreutvikling av Ajour bør starte med mer vanlig bruk over tid. Jeg bør undersøke om forslagene faktisk hjelper med å komme i gang, og om planleggingen er lett å tilpasse når en studieuke endrer seg. Først da får jeg et bedre grunnlag for å velge nye funksjoner.

Jeg er også nysgjerrig på å prøve andre KI-verktøy, som Claude. Det betyr ikke at jeg vet at resultatet ville blitt bedre. En sammenligning med samme, avgrensede oppgave kunne gitt meg mer erfaring med styrker, svakheter og behovet for kontroll i forskjellige verktøy.

## 7. Konklusjon og læring

### 7.1 Viktigste lærdommer

1. Et kjent brukerbehov gjør det lettere å vurdere om løsningen hjelper. Min egen studiesituasjon ga meg konkrete spørsmål å teste.

2. Et tydelig omfang er nødvendig. Flere funksjoner og kilder gir flere sammenhenger som må kontrolleres.

3. KI-forslag må prøves mot forventet oppførsel. En overbevisende forklaring eller en grønn testsuite er ikke nok alene.

4. Dokumentasjon og promptutdrag bør lagres underveis. Rekonstruksjon kan forklare dagens løsning, men kan ikke gjenskape hele den opprinnelige prosessen.

5. Jeg må utvikle min egen forståelse samtidig som jeg bruker KI. Det gjør meg mindre avhengig og bedre i stand til å ta ansvar.

### 7.2 Hva ville jeg gjort annerledes

Jeg ville startet med en tydeligere avgrenset førsteversjon og en klarere rekkefølge på arbeidet. Plan, avgrensning og konkrete kontrollpunkter burde vært samlet tidligere. Jeg ville også beholdt korte promptutdrag og notert hvorfor jeg godtok eller avviste viktige forslag.

Samtidig har prosjektet gjort meg mer ambisiøs fordi jeg har sett hva som er mulig med KI. Jeg ser ingen motsetning mellom dette og en liten førsteversjon dersom videre ideer legges til etter at kjernen fungerer. Det jeg ville unngått, er å la alle ideene bli krav samtidig.

Jeg ville helst arbeidet i en gruppe neste gang. Da kunne flere vurdert løsningen, diskutert alternativer og brukt KI på ulike deler av arbeidet. Jeg savnet særlig muligheten til å få et menneskelig blikk på beslutningene mens jeg jobbet.

### 7.3 Anbefalinger til andre studenter

Mitt råd er å velge et problem man forstår, og beskrive konkret hva en bruker skal kunne gjøre. Be KI arbeide med avgrensede oppgaver og vis eksempler når noe blir feil. Les spørsmål og forslag grundig før arbeidet fortsetter, særlig når endringen er større enn forventet.

Jeg vil også anbefale å teste tidlig, bruke versjonskontroll og ta vare på noen reelle eksempler fra prosessen. Dokumentasjon bør følge arbeidet. Det er lettere å forklare en beslutning mens man husker hvorfor den ble tatt, enn å rekonstruere den mot slutten.

### 7.4 Personlig refleksjon

Jeg er mest fornøyd med hvordan Ajour ser ut og hvordan flyten fungerer nå. Det tok mange forsøk å komme dit. Den største frustrasjonen var å få KI til å forstå det jeg mente, spesielt når jeg ikke selv kunne kode endringen. Etter hvert ble jeg tydeligere i bestillingene mine og mer villig til å stoppe når resultatet ikke stemte.

Prosjektet har endret interessen min for programmering. Jeg startet uten kodeerfaring, men opplever nå at jeg kan bruke KI og VS Code til å lage noe som har en praktisk verdi for meg. Jeg har fortsatt mye å lære før jeg kan forstå og vedlikeholde hele løsningen selv. Det gjør meg både mer nysgjerrig og mer bevisst på begrensningene mine.

KI ga meg hjelp jeg vanskelig kunne vært foruten i dette prosjektet. Samtidig tror jeg kombinasjonen av flere mennesker og KI kunne gitt et enda bedre resultat. For min egen del er neste steg å bruke Ajour mer i hverdagen og bygge videre på den tekniske forståelsen, slik at jeg kan vurdere løsningene med større selvstendighet.

## 8. Vedlegg og kilder

Prosjektrepo: [https://github.com/IBE160-2026/G37-yilmaz](https://github.com/IBE160-2026/G37-yilmaz)

Publisert applikasjon: [https://ajour-sooty.vercel.app/](https://ajour-sooty.vercel.app/)

Henvisningene nedenfor viser til prosjektmateriale og undervisningsfiler. Prosjektets daterte testresultater og begrensninger finnes i verifikasjonen og prøveplanen.

[1] G37 – Git Happens (2026). README.md; studieplanlegger/README.md; package.json; ARCHITECTURE-SPINE.md. Ajour, prosjektarkiv per 1. november 2026.

[2] Faglærer i IBE160 (2026, 6. oktober). Tilbakemelding på product brief. G37 – G37-yilmaz, brief ved commit 5e23204.

[3] G37 – Git Happens (2026). Development process; VERIFICATION.md; USER-TRIAL-PLAN.md. Ajour, daterte prosess- og kontrollopplysninger i prosjektarkivet per 1. november 2026. Lisensfil: studieplanlegger/public/fonts/OFL.txt.

[4] IBE160 (2026). Kap. 2 – Tools of the trade [Forelesningspresentasjon]. Særlig lysbilde 6–7 om versjonskontroll, 13–14 om automatiske kontroller og 19 om agentens kontekst og arbeidsløp.

[5] IBE160 (u.å.). BMAD Product Brief – Student Template [Undervisningstilpasning]. Kildegrunnlag kontrollert 20. august 2026, særlig side 8–9 om første versjon og videre visjon.

Ordantall kapittel 2–7: 3 562
