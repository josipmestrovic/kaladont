# Kaladont — Misije: katalog, nagrade i dizajnerske odluke v2

**Datum:** 4. studenoga 2026.  
**Svrha:** zajednička produktna specifikacija za PR03 i PR04; 20 dnevnih + 20 tjednih predložaka te rezervni brainstorm.  
**Povezani dokumenti:** `Kaladont_PR03_backend_misija_v2.md`, `Kaladont_PR04_frontend_misija_v2.md`. Agent treba dobiti sva tri dokumenta.  
**Pregledani kod:** [main na commitu 646c00c3](https://github.com/josipmestrovic/kaladont/tree/646c00c3b3a00b4681156d2ef54bbe00b8f9f171), 4. 11. 2026. PR02 je u toj bazi spojen; sustav misija još nije prisutan.

Ova verzija zamjenjuje produktna pravila iz priloženih starih PR03/PR04 dokumenata. Nije promjena koda niti tvrdnja da su misije implementirane. Izraz „20 misija” znači **20 predložaka u svakom poolu**, a ne 20 istodobnih zadataka.

## 1. Potvrđene odluke i radne preporuke

| Tema | Odluka | Izvor/status |
|---|---|---|
| Naziv | U sučelju koristimo „Misije”. | Korisnikov zahtjev |
| Dnevni dotok | Jedna nova dnevna misija u ponoć, ako ima slobodnog mjesta. | Korisnikov zahtjev |
| Dnevna zaliha | Najviše tri nedovršene dnevne; stare ostaju s napretkom. | Korisnik izričito odabrao „Skupljanje do 3” |
| Tjedni paket | Tri nove tjedne u ponedjeljak u 00:00. | Korisnikov zahtjev |
| Tjedna zamjena | Jednom dnevno zamijeniti jednu od tri nedovršene tjedne. | Korisnikov zahtjev; kvota vrijedi za cijelu skupinu |
| Dnevna zamjena | Jednom dnevno zamijeniti jednu nedovršenu dnevnu; odvojena kvota od tjednih. | Radna preporuka prema traženom obrascu |
| Nagrade | Svaka dnevna 200 XP; svaka tjedna 2.000 XP. Samo XP kao izravna nagrada misije. | Korisnik predložio iznose; usvajamo ih kao početni balans |
| Pobjede | Pobjede smiju biti uvjet. | Naknadna izričita korisnikova odluka |
| Trening | Dnevna: pobijediti jednom; tjedna: pobijediti tri puta. | Korisnikov zahtjev |
| Četveroboj | Dnevna: pobijediti jednom; tjedna: pobijediti pet puta. | Korisnikov zahtjev |
| Dvoboj | Dnevna: pobijediti tri puta; tjedna: pobijediti dvadeset puta. | Korisnikov zahtjev |
| Katalog | 20 dnevnih i 20 tjednih; dodatne ideje zasebno. | Razrada korisnikova proširenja sa 7 na 20 |
| Potvrda uspjeha | Na završnom ekranu iste igre vidi se dovršena misija i stvarno dodijeljeni XP. | Korisnikov zahtjev |
| Puni pregled | Stranica `/misije`, progres i zamjene u PR04. | Korisnikov redoslijed rada |
| Vremenska zona | Sve granice po `Europe/Zagreb`, uključujući ljetno računanje vremena. | Radna preporuka, usklađena s igrom |

**„Samo XP” u ovoj verziji:** ne dodajemo novi „Majstor misija”, valutu, predmete, škrinje ni dodatni bonus za sve tri tjedne. Postojeća dostignuća ostaju funkcionalna: XP može povećati razinu i postojeću „Iskusnjaru”, a pobjeda u treningu može otključati postojeći „Zagrijan”. To nisu nove izravne nagrade misija. PR05 „Stalno si tu” ostaje zaseban zadatak.

Preporuke u nastavku služe kao konkretan početni dizajn. Agent ih treba kratko navesti u planu, a ne ponovno otvarati svaku već donesenu odluku. Pita samo ako pregled koda otkrije stvaran sukob ili ako predlaže promjenu opsega, nagrada ili pravila.

## 2. Raspored bez skrivenih pravila

### Dnevne

- Nedovršena dnevna **nema rok isteka**. Ponedjeljak je ne briše. Napredak ostaje do dovršetka ili zamjene.
- Na prvom uključivanju sustava igrač dobije jednu dnevnu, ne odmah tri. Taj dan time koristi svoju dodjelu. Sljedeća dolazi sljedeće lokalne ponoći.
- Nakon inicijalizacije misije pristižu i tijekom odsutnosti, do tri slobodna mjesta ukupno. Povratak nakon tri dana nije uvjet za dodjelu; server može tek tada materijalizirati ono što je trebalo pristizati.
- Kad su u ponoć sva tri mjesta zauzeta, taj dotok se preskače. Nema skrivene četvrte misije, neograničenog reda ni naknadne nadoknade nakon oslobađanja mjesta.
- Dovršena dnevna odmah oslobađa aktivno mjesto. **Ne daje novu misiju odmah:** sljedeći dotok je u ponoć. Dokaz dovršetka ostaje na rezultatu i u sažetku „Danas dovršeno”.
- Zamjena nije dodatna dodjela: mijenja odabranu misiju, nova kreće od nule i zauzima isto mjesto.
- Ponovljeni GET, prijava ili ponovno otvaranje igre ne daju dodatnu misiju.

| Primjer | Rezultat |
|---|---|
| Prvi posjet u srijedu u 15:00 | Jedna dnevna; sljedeća u četvrtak 00:00. |
| Nakon inicijalizacije dva dana ne igraš, imao si jednu dnevnu | Po povratku imaš tri, ako nijedna nije dovršena. |
| Tri aktivne u 00:00; jednu dovršiš u 10:00 | Dvije aktivne do sljedeće ponoći. Nema dopune u 10:00. |
| Dovršiš sve tri u jednoj partiji | Tri isplate po 200 XP, nula aktivnih; sljedeća jedna u ponoć. |
| U nedjelju ostanu dvije dnevne | U ponedjeljak ostaju i može pristići treća; tjedne se zasebno obnavljaju. |

### Tjedne

- Paket sadrži tri različita predloška. Sve tri istodobno mogu napredovati.
- Vrijede od ponedjeljka 00:00 do idućeg ponedjeljka 00:00, s isključivom završnom granicom.
- Dovršena ostaje vidljiva do ponedjeljka kao „Završeno”. Ne može se zamijeniti i ne otvara četvrtu nagradu.
- Nedovršene tjedne u ponedjeljak istječu; novi paket ima tri misije s napretkom nula. Ne prenose se kao dnevne.
- Prvi dolazak usred tjedna daje tri misije za ostatak **tekućeg** tjedna. Nema paketa za propuštene tjedne.
- „Tri dana igre” ne dodjeljuje se prvi put niti kroz zamjenu u subotu/nedjelju. Petak je dopušten: petak, subota i nedjelja su tri lokalna dana.
- Kasni dolazak ne snižava automatski ostale ciljeve i ne mijenja XP. Moguće je da igrač neće stići završiti svaki cilj; to jasno prikazuje rok.

### Zamjene

Najviše **jedna dnevna zamjena i jedna tjedna zamjena po zagrebačkom kalendarskom danu**, ukupno dvije akcije ako igrač želi. Ne jedna po kartici. Prava se ne gomilaju. Zamijenjena misija gubi napredak i ne daje nagradu; nagrada nove ostaje 200 ili 2.000 XP. `×` znači „Zamijeni”, ne „Obriši mjesto”.

## 3. Gdje se misije računaju

| Izvor igre | Koje misije napreduju | Obični XP igre |
|---|---|---|
| Javni Četveroboj | Opće javne i one za Četveroboj | Postojeća pravila |
| Javni Dvoboj | Opće javne i one za Dvoboj | Postojeća pravila |
| Zagrijavanje / trening | **Samo D10 i W10** iz početnog kataloga | Ostaje 0; može se dobiti odvojeni XP dovršene misije |
| Privatna soba | Nijedna iz ovog kataloga | Postojeća pravila ostaju |

Misije su za registrirane ljudske račune, uključujući admina koji igra kao čovjek. Gosti vide objašnjenje i prijavu. Botovi ne dobivaju misije, ali pobjede i valjani potezi protiv botova vrijede u dopuštenom javnom modu. Trening s računalom namjerno vrijedi za trening-misije.

**Radna zaštita od pasivnog skupljanja:** za misijski napredak sudionik mora u toj igri odigrati barem jedan prihvaćen potez. Tehnički poništena igra, napuštanje označeno razlogom `prekid` i igra bez vlastitog prihvaćenog poteza ne donose misijski napredak. Regularni poraz, ispadanje, „Ne znam” ili istek poteza nakon stvarnog sudjelovanja mogu pridonijeti misijama koje ne traže pobjedu. Odlazak nakon već regularnog ispadanja ne pretvara se retroaktivno u napuštanje. Ovo ne mijenja postojeće bodovanje ni stare achievemente.

Napredak se potvrđuje nakon konačnog serverskog završetka i uspješnog spremanja. Jedan potez ili jedna igra smiju pomoći svim odgovarajućim aktivnim misijama. Nema potrebe birati „praćenu” misiju.

## 4. Početni dnevni katalog — 20 predložaka

**Svaka dnevna daje 200 XP.** Brojčani ciljevi su početni prijedlog osim D08, D09 i D10, koje je zadao korisnik. „Javna” u tablici znači oba javna moda ako nije suženo. Broje se osobni prihvaćeni potezi, ne potezi drugih igrača.

| ID | Naziv | Točan cilj | Izvor | Obitelj | Zahtjevnija |
|---|---|---|---|---|---|
| D01 | Dvije partije | Završi 2 javne partije. | Javna | aktivnost | Ne |
| D02 | Riječ po riječ | Odigraj ukupno 10 prihvaćenih riječi. | Javna | kolicina_rijeci | Ne |
| D03 | Uhvati niz | U jednoj partiji ostvari niz 3 prihvaćene riječi bez pogreške. | Javna | niz | Ne |
| D04 | Pet u jednoj | U jednoj partiji odigraj 5 prihvaćenih riječi. | Javna | ucinak_partije | Ne |
| D05 | Duge riječi | Odigraj 2 riječi s najmanje 10 grafema. | Javna | duljina | Ne |
| D06 | Rijetko otkriće | Odigraj 1 riječ bilo kojeg postojećeg tiera rijetkosti. | Javna | rijetkost | Ne |
| D07 | Za stolom četvorice | Završi 1 Četveroboj. | Javni Četveroboj | aktivnost | Ne |
| D08 | Pobjednik Četveroboja | Pobijedi u 1 Četveroboju. | Javni Četveroboj | plasman | Ne |
| D09 | Tri dvobojske pobjede | Pobijedi u 3 Dvoboja. | Javni Dvoboj | plasman | Ne |
| D10 | Pobjeda za zagrijavanje | Završi i pobijedi u 1 treningu. | Trening | trening | Ne |
| D11 | Dvobojski ritam | Završi 3 Dvoboja. | Javni Dvoboj | aktivnost | Ne |
| D12 | Oba lica Kaladonta | Završi 1 Dvoboj i 1 Četveroboj. | Oba javna moda | oba_moda | Ne |
| D13 | Dva izbacivanja | Izazovi 2 eliminacije protivnika prema pravilima motora. | Javna | taktika | Ne |
| D14 | Kaladont potez | Izvedi 1 uspješan Kaladont prema pravilima motora. | Javna | taktika | Da |
| D15 | Baš duga riječ | Odigraj 1 riječ s najmanje 15 grafema. | Javna | duljina | Da |
| D16 | Skriveno blago | Odigraj 1 riječ označenu kao „jako rijetka”. | Javna | rijetkost | Da |
| D17 | Dvostruki pogodak | Odigraj 1 riječ koja je istodobno duga (≥10 grafema) i rijetka (bilo koji tier). | Javna | spoj_rijeci | Da |
| D18 | Pet početaka | Odigraj riječi s 5 različitih početaka od dva hrvatska grafema. | Javna | raznolikost | Ne |
| D19 | Među najboljima | Završi 1 Četveroboj na 1. ili 2. mjestu. | Javni Četveroboj | plasman | Ne |
| D20 | Dvije dobre partije | U 2 različite partije odigraj barem 3 prihvaćene riječi po partiji. | Javna | ucinak_partije | Ne |

„Dnevna” ovdje označava učestalost dobivanja, ne obvezu da se zadatak riješi isti dan. Zahtjevnije dnevne mogu ostati sačuvane. Traka niza prikazuje najbolji niz u jednoj partiji; ne zbraja dva niza iz dviju partija.

## 5. Početni tjedni katalog — 20 predložaka

**Svaka tjedna daje 2.000 XP.** W08, W09 i W10 slijede korisnikove brojčane ciljeve. Ostali ciljevi su početni prijedlog, a ne izmjeren balans.

| ID | Naziv | Točan cilj | Izvor | Obitelj | Zahtjevnija |
|---|---|---|---|---|---|
| W01 | Redoviti igrač | Završi 15 javnih partija. | Javna | aktivnost | Ne |
| W02 | Sto riječi | Odigraj ukupno 100 prihvaćenih riječi. | Javna | kolicina_rijeci | Ne |
| W03 | Tri dobra niza | U 3 različite partije ostvari niz od barem 5 prihvaćenih riječi bez pogreške. | Javna | niz | Ne |
| W04 | Čuvar dugih riječi | Odigraj 15 riječi s najmanje 10 grafema. | Javna | duljina | Ne |
| W05 | Lovac na rijetke | Odigraj 10 rijetkih riječi, bilo kojeg postojećeg tiera. | Javna | rijetkost | Ne |
| W06 | Tri dana igre | Završi barem 1 javnu partiju u 3 različita zagrebačka dana ovog tjedna. | Javna | razliciti_dani | Ne |
| W07 | Osam dobrih partija | U 8 različitih partija odigraj barem 5 prihvaćenih riječi po partiji. | Javna | ucinak_partije | Ne |
| W08 | Pet četverobojnih pobjeda | Pobijedi u 5 Četveroboja. | Javni Četveroboj | plasman | Da |
| W09 | Dvobojski pobjednik | Pobijedi u 20 Dvoboja. | Javni Dvoboj | plasman | Da |
| W10 | Trening tjedan | Završi i pobijedi u 3 različita treninga. | Trening | trening | Ne |
| W11 | Četverobojni tjedan | Završi 10 Četveroboja. | Javni Četveroboj | aktivnost | Ne |
| W12 | Dvobojski maraton | Završi 25 Dvoboja. | Javni Dvoboj | aktivnost | Ne |
| W13 | Taktičar | Izazovi 10 eliminacija protivnika prema pravilima motora. | Javna | taktika | Ne |
| W14 | Kaladont majstor | Izvedi 5 uspješnih Kaladonta. | Javna | taktika | Da |
| W15 | Velike riječi | Odigraj 5 riječi s najmanje 15 grafema. | Javna | duljina | Da |
| W16 | Rijetka zbirka | Odigraj 5 riječi označenih kao „jako rijetke”. | Javna | rijetkost | Da |
| W17 | Dugi i rijetki | Odigraj 5 riječi koje su svaka istodobno duge (≥10 grafema) i rijetke. | Javna | spoj_rijeci | Da |
| W18 | Dvadeset početaka | Odigraj riječi s 20 različitih početaka od dva hrvatska grafema. | Javna | raznolikost | Ne |
| W19 | Stalno pri vrhu | Završi 10 Četveroboja na 1. ili 2. mjestu. | Javni Četveroboj | plasman | Ne |
| W20 | Svestrani igrač | Završi 5 Dvoboja i 5 Četveroboja. | Oba javna moda | oba_moda | Ne |

W03 je broj kvalificiranih partija, a ne niz 15 riječi. W07 je broj partija s pet riječi, a ne 40 riječi bilo gdje. W20 ima dva uvjeta: deset Dvoboja ne ispunjava nijedan Četveroboj. W06 ne traži uzastopne dane niti prijavu bez igranja.

## 6. Odabir koji čuva raznolikost

**Početna preporuka za generator:**

1. Najprije filtrirati vrstu, kontekst, aktivnu verziju i vremensku izvedivost. Bez W06 od subote nadalje.
2. Ne dodjeljivati isti predložak dvaput u aktivnoj dnevnoj zalihi. U tjednom ciklusu ne ponoviti predložak koji je već bio dodijeljen, zamijenjen ili dovršen.
3. U jednoj skupini od do tri misije najviše jedna iz iste `obitelj`. Npr. ne dodijeliti zajedno D08, D09 i D19 niti W01, W11 i W12.
4. Najviše jedna označena `zahtjevnija` unutar dnevne zalihe odnosno tjednog paketa. To je početna zaštita od tri zahtjevna cilja odjednom, ne mjerenje stvarne težine.
5. Tjedni paket mora sadržavati barem jednu pristupačnu misiju iz skupa **W01, W02, W10, W11, W20**. Dovršena pristupačna misija i dalje ispunjava ovu kvotu paketa.
6. Ostalo birati nasumično među dopuštenim kombinacijama. Koristiti isti izbor i pri zamjeni, uz očuvanje ostalih kartica i svih navedenih uvjeta.
7. Za dnevne mekano preferirati predloške koji nisu nedavno dobiveni, uz povijest zadnjih 7 dodjela. Ako to isprazni izbor, popustiti samo tu preferenciju, nikad tvrde uvjete.
8. Ako stvarno nema alternative, stara misija i pravo zamjene ostaju. Ne zamijeniti je istim zadatkom niti kriomice promijeniti nagradu.

Dnevne i tjedne mogu dijeliti sličan cilj: primjerice D08 i W08 smiju napredovati istom pobjedom. To daje osjećaj povezanog napretka. Nije potrebno onemogućiti svako preklapanje.

## 7. Mišljenje o nagradama i težini

Zadržao bih jednak iznos unutar vrste za prvi test: igrač odmah zna što dnevna, a što tjedna donosi. Zamjenom tada bira željeni način igre, bez traženja većeg iznosa XP-a. Glavni izazov je **razlika u potrebnom trudu**.

| Primjer | Zašto pratiti |
|---|---|
| W10: 3 trening-pobjede nasuprot W09: 20 Dvoboj-pobjeda | Ista nagrada uz vjerojatno vrlo različit trud; to treba izmjeriti. |
| W08: 5 pobjeda u Četveroboju | Vjerojatnost pobjede i trajanje nisu isti kao u Dvoboju; broj se ne može uspoređivati samo 5 prema 20. |
| Rijetke i jako duge riječi | Težina ovisi o rječniku, početnim nastavcima i iskustvu igrača, ne samo o broju traženih riječi. |
| Kaladont i eliminacije | Ovise i o potezima protivnika; ne obećavati da će ih svatko završiti u jednoj sesiji. |
| Različiti dani | Mali ukupan trud, ali obvezno čekanje kalendara; zato je važan filtar kasne dodjele. |

**Analiza postojećeg XP-a:** u pregledanom `iskustvo.ts` obična prihvaćena riječ donosi 5 XP, pobjednički bonus 50 XP, a razine koriste postojeću nelinearnu krivulju. Dodatni bonusi za riječ, eliminacije, niz i ocjenu igre znače da 5 XP nije prosječni XP po potezu.

| Količina novih misija | Nominalna nagrada |
|---|---:|
| 7 dnevnih dodjela u punom tjednu | 1.400 XP |
| 3 tjedne dodjele | 6.000 XP |
| Ukupno iz novih dodjela tog tjedna | **7.400 XP** |
| Udio tjednih u tom iznosu | **81,1 %** |

To **nije tvrdi limit isplate u jednom kalendarskom tjednu**: igrač može dovršiti i do tri dnevne prenesene iz ranijeg tjedna. Budući da dnevne ne istječu, uvijek razlikovati vrijeme dodjele od vremena isplate.

Izračun prema pregledanoj formuli, krenuvši od 0 XP i bez XP-a igre: 200 XP znači razinu 2, 2.000 XP razinu 7, a 7.400 XP razinu 13. Za razinu 100 potrebno je ukupno 284.975 XP. To pokazuje da tjedna misija može preskočiti više početnih razina; UI i postojeća dostignuća moraju to podržati.

Ovo nije razlog da agent sam smanji nagrade. Početno implementirati 200/2.000 i korisnikove pobjedničke ciljeve. Nakon probnog igranja pogledati udio zamjena i dovršavanja po predlošku, broj kvalificiranih partija do završetka te odnos XP-a iz misija i XP-a iz igre. Za riječ „balansirano” zasad nema podataka.

Ako W09 često ostaje nedovršena, prvo razgovarati o cilju; ako gotovo svi biraju W10 samo radi nagrade, razgovarati o razlici u trudu. Automatsko skaliranje prema razini i individualne cijene nisu dio ove verzije. Nije potreban novi analitički servis: inicijalno su dovoljni postojeći zapisi i mali interni pregled.

## 8. Rezervni brainstorm — 30 dodatnih ideja

**Ovo nije automatski dodatan opseg PR03.** Katalog za implementaciju ostaje 20 + 20 iz §4–5. Ispod su konkretne ideje za zamjene u katalogu ili kasnije proširenje. Brojevi su prijedlozi. Ne uključivati rezervnu ideju u generator bez dogovora i mjerljive serverske metrike.

| # | Ideja | Primjer dnevne / tjedne | Procjena i preduvjet |
|---|---|---|---|
| R01 | Tri vrste riječi | Odigraj imenicu, glagol i pridjev / po 10 svake vrste | Edukativno; treba dogovoriti višeznačne oblike i postojeće spajanje pridjeva/priloga. |
| R02 | Imenički dan | 5 / 30 imenica | Jednostavan tekst, ali tek uz pouzdanu klasifikaciju prihvaćenog oblika. |
| R03 | Glagolski izazov | 5 / 30 glagola | Isti tehnički preduvjet; ne pretpostavljati kategoriju iz osnovnog oblika. |
| R04 | Pridjevi i prilozi | 3 / 20 prihvaćenih riječi te kategorije | Uskladiti s postojećom kolekcijom i razumljivim nazivom. |
| R05 | Hrvatska slova | 3 / 15 riječi koje sadrže č, ć, đ, š ili ž | Jasan i lako mjerljiv cilj; jedna riječ vrijedi jednom bez obzira na broj takvih slova. |
| R06 | Digrafi | 3 / 15 riječi s lj, nj ili dž | Dobar identitet Kaladonta; koristiti parser i njegove iznimke. |
| R07 | Različiti završeci | 5 / 20 različitih završetaka od dva grafema | Slično početnom D18/W18; ne nuditi oba identična koncepta istodobno. |
| R08 | Različite duljine | Riječi 4, 5 i 6 grafema / pet zadanih duljina | Potrebne podstavke; bez zahtjeva za nedostupnim nastavkom. |
| R09 | Kratko i jasno | 5 / 30 riječi od 4–6 grafema | Pristupačnije od vrlo dugih riječi; ne smije poticati uvijek najkraći potez. |
| R10 | Srednje duge | 2 / 10 riječi od najmanje 12 grafema | Jednostavan postojeći tier, ali mala novost u odnosu na katalog. |
| R11 | Tri veličine | Barem jedna riječ iz svakog tiera duljine / po tri | Složenije, jasno prikazati podciljeve. |
| R12 | Tri rijetkosti | Barem jedna iz svakog tiera / po tri | Više ovisno o klasifikaciji rječnika; oznake moraju biti razumljive. |
| R13 | Nova riječ za kolekciju | Otključaj 3 / 20 novih leksema | Nepravedno prema punoj kolekciji; nije za univerzalni pool bez provjere izvedivosti. |
| R14 | Novi osobni rekord | Poboljšaj najbolji niz / najdulju riječ | Loše za iskusne igrače s visokim rekordom; bolje trajno dostignuće. |
| R15 | Pobjeda u oba moda | 1 pobjeda u svakom / 3 u svakom | Dobar izazov s dva jasna uvjeta; zahtjevnije od običnog igranja oba moda. |
| R16 | Pobjednički niz | 2 uzastopne pobjede / niz 3 | Uzbudljivo, ali poraz resetira cilj; za kasniji izbor zahtjevnijih misija. |
| R17 | Čista partija | ≥3 prihvaćene riječi bez pogreške / 5 takvih partija | Treba točno definirati pogrešku i isključiti mrežne/stale zahtjeve. |
| R18 | Pouzdan niz više puta | U 2 / 8 partija niz od 3 | Pristupačnija alternativa jednom jako dugom nizu. |
| R19 | Dvije duge u jednoj | 2 duge riječi u jednoj / 3 takve partije | Kontrolirana kombinacija; traži sažetak po partiji. |
| R20 | Rijetka i pobjeda | Pobijedi u partiji u kojoj si odigrao rijetku riječ / 3 takve pobjede | Dva uvjeta na istoj partiji, ne preko različitih igara. |
| R21 | Pobjeda uz eliminaciju | 1 / 5 pobjeda s barem jednom osobnom eliminacijom | Dobro za Četveroboj, provjeriti različitu semantiku Dvoboja. |
| R22 | Mrtva slova | Izazovi 1 / 3 eliminacije mrtvim nastavkom | Postojeća metrika; može poticati frustrirajuću taktiku, zato povremeno. |
| R23 | Obrani „ka” | Valjano odgovori u 1 / 5 situacija u kojima se traži „ka” | Ovisi o dobivenim prilikama; precizno dogovoriti što je obrana. |
| R24 | Četiri dana igre | Igraj tijekom 4 dana tjedna | Samo tjedna; više povrataka, obvezan filtar kasne dodjele. |
| R25 | Vikend izazov | Završi po jednu partiju u subotu i nedjelju | Daje raspored koji nekima ne odgovara; eventualno događaj, ne obični nasumični pool. |
| R26 | Ocjena igre | Jedna partija s ≥4 zvjezdice / 5 takvih partija | Postojeća serverska ocjena; objasniti kriterij, ne koristiti skrivenu formulu bez konteksta. |
| R27 | Prvo javno iskustvo | Završi prvi Dvoboj i prvi Četveroboj | Prikladnije jednokratnom upoznavanju igre nego ponavljajućim misijama. |
| R28 | Trening bez pobjedničkog uvjeta | Završi trening uz ≥5 / ≥20 prihvaćenih riječi | Pristupačnije, ali traži evidenciju valjanih poraza/završetaka treninga; početni katalog bilježi pobjede. |
| R29 | Trening pa javna partija | Završi jedan trening i jednu javnu partiju / 3 para | Povezuje učenje i igranje; treba eksplicitno odlučiti je li redoslijed važan. |
| R30 | Suradnički cilj | U zajedničkoj igri svi ljudi odigraju zadani broj riječi | Dobra buduća ideja, ali ovisi o drugima i traži drukčije kriterije protiv dogovorenog farmanja. |

Ne bih uključivao nagrađivanje prijava igrača/riječi, namjernih poraza, broja odbijenih pokušaja, sati otvorenog taba ili pozivanja prijatelja. Ti ciljevi mjere ponašanje koje nije kvaliteta igre, mogu stvarati loše prijave ili zahtijevaju nove sustave. Misije za ekstremno brz unos također bih odgodio zbog različitih uređaja i ciljane publike.

## 9. Dizajnerske smjernice

- Stranica pokazuje dvije jasne skupine: **Dnevne — do 3 sačuvane** i **Tjedne — 3 u ovom tjednu**. Desktop: tri kartice u redu po skupini kad prostor dopušta; mobitel: jedna ispod druge.
- Svaka kartica ima naziv, jednu preciznu rečenicu, oznaku moda/konteksta, napredak i nagradu. Trening mora biti označen „Zagrijavanje”, a pobjeda mora biti vidljiva u opisu.
- Na dnevnim karticama ne pisati „Istječe u ponoć”. Tekst je „Ostaje dok je ne završiš” ili kratko „Bez isteka”. Rok pripada tjednoj skupini; dotok pripada dnevnoj skupini.
- Prazno dnevno mjesto ne izgleda kao zaključana plaćena kartica. Jedno objašnjenje govori kada stiže iduća misija; ne obećavati popunjavanje svih praznih mjesta odjednom.
- Uz `×` postoji pristupačno ime „Zamijeni misiju” i objašnjenje zajedničke kvote. Potvrda: „Napredak ove misije bit će izgubljen.”
- Za D12/W20 prikazati oba broja: Dvoboji i Četveroboji. Za D18/W18 „Različiti počeci”, a ne generičko „riječi”.
- Na rezultatu igre: „Misija završena!” → naziv → stvarno dodijeljeni XP. Ako ih je više, jedna skupina s više redaka. Bez ručnog gumba „Preuzmi”.
- Igrač koji izgubi može napredovati u drugim misijama. Tekst ipak ne smije tvrditi da pobjeda nikad nije važna, jer postoje pobjednički ciljevi.
- Pobjeda u treningu može pokazati misijski XP iako je partijski XP nula. Ne skrivati blok misija iza uvjeta „nije trening”.

## 10. Što agent smije odlučiti, a kada pita

Agent sam bira nazive internih servisa, strukturu malih prezentacijskih komponenti, postojeće UI tokene, način injekcije sata/RNG-a i raspored ciljanih testova. Potvrđene brojeve, trening-pravila i kapacitet ne mijenja na svoju ruku.

Pita ako predlaže drukčiji XP, drukčije korisnikove pobjedničke ciljeve, dopuštanje privatnih soba, ukidanje prijenosa dnevnih, novi achievement kao nagradu ili opipljivo drukčiji UX zbog tehničkog ograničenja. Ako se pregledom pokaže da neki predložak nema pouzdan izvor podataka, pokazuje konkretan nedostatak i predlaže minimalni dodatak; ne objavljuje karticu koja nikad ne napreduje.

**Prije implementacije:** kratak tehnički plan s razdvajanjem potvrđenih odluka i preporuka. Nema potrebe ponovno pitati smiju li misije tražiti pobjede ili hoće li se dnevne skupljati do tri: to je već potvrđeno.

## 11. Izvori i granice analize

- [XP i formula razina](https://github.com/josipmestrovic/kaladont/blob/646c00c3b3a00b4681156d2ef54bbe00b8f9f171/paketi/zajednicko/src/iskustvo.ts).
- [Pravila konteksta igre](https://github.com/josipmestrovic/kaladont/blob/646c00c3b3a00b4681156d2ef54bbe00b8f9f171/aplikacije/posluzitelj/src/igra/politika-ucinka.ts).
- [Postojeće spremanje trening-pobjeda](https://github.com/josipmestrovic/kaladont/blob/646c00c3b3a00b4681156d2ef54bbe00b8f9f171/aplikacije/posluzitelj/src/trening/upis-napretka.ts).
- [Hearthstoneov izvorni opis tjednih misija](https://hearthstone.blizzard.com/en-us/news/23534414): inspiracija za tri tjedne i dnevnu zamjenu, ne specifikacija Kaladonta ni tvrdnja o svim današnjim pravilima Hearthstonea.
- [Blizzardova retrospektiva promjena težine](https://news.blizzard.com/en-us/article/24148498/hearthstone-progression-update): primjer zašto treba mjeriti doživljaj truda, umjesto samo povećavati ciljeve.

Pregledan je relevantni kod i izračunata XP krivulja. Nisu provedena korisnička testiranja, mjerenje prosječnog trajanja partija ni implementacijski testovi novog sustava. Oznake težine i prijedlozi balansa su dizajnerske procjene.
