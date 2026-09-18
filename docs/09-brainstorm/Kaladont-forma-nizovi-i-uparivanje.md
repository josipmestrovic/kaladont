# Kaladont: forma i nizovi

Detaljna specifikacija za implementacijskog agenta

Status: objedinjeni dogovor i predloženi tehnički kriteriji. Pitanja za zaključavanje scopea nalaze se na kraju.

## 1. Zadatak agenta

U postojeću igru Kaladont dodaj formu igrača, mini povijest rezultata, odvojene nizove pobjeda za javne igre s 2 i 4 igrača, XP bonus za uzastopne pobjede, vizualni prikaz vatre te zaštite javnog uparivanja.

Prvo prouči aktualni repozitorij, njegove upute, postojeći obračun XP-a, životni ciklus partije, red čekanja, identitet gosta i registriranog igrača, DNK i profil. Ovaj dokument je specifikacija željenog ponašanja, a ne tvrdnja da navedena struktura koda još odgovara aktualnom HEAD-u.

Prije implementacije prođi pitanja iz završnog poglavlja s vlasnikom projekta. Prvo iznesi nalaze iz aktualnog koda i preporučene odgovore; nemoj pitati stvari koje možeš sam provjeriti. Ne mijenjaj potvrđene produktne odluke da bi izbjegao implementacijski problem. Za odluke označene kao prijedlog potvrdi izbor prije implementacije pogođenog dijela.

Nakon dogovora izradi plan, implementiraj povezane promjene, migracije i testove te pripremi rezultat za staging. Ovaj dokument sam po sebi nije odobrenje za produkcijsku objavu, reset postojećeg napretka ili promjenu drugih pravila igre.

## 2. Potvrđeni opseg

### 2.1. Uključeno

- Forma odvojena za javni dvoboj i javnu igru četvero.
- Forma iz posljednjih 10 završenih partija odabranog načina.
- Osam razina: loša, slaba, prolazna, dobra, odlična, izvanredna, sjajna, top forma.
- Namjerno dostupni pragovi za dobru i odličnu formu.
- Forma ispod DNK grafa, unutar odgovarajuće profilne kartice.
- Objašnjenje promjene forme u rezultatima partije.
- Mini povijest: kvačica/križić za dvoboj; obojeni plasmani 1–4 za četvero.
- Trenutni i najbolji niz pobjeda, zasebno po javnom načinu.
- XP bonus od druge uzastopne pobjede: +10 postotnih bodova po koraku u četvero, +5 u dvoboju; maksimum u oba slučaja +100%.
- Vatra i dodatni vanjski crveni obrub: od 3 pobjede u četvero, od 4 u dvoboju.
- Jedna do tri vatre i tri debljine obruba prema duljini niza.
- Prikaz niza na profilu, u redu čekanja, tijekom igre i u rezultatima.
- Različiti igrači s istim efektivnim javnim IP-om ne smiju biti u istoj javnoj partiji, ni u dvoboju ni u četvero.
- Privatne sobe dopuštaju isti IP.
- Isti par igrača smije imati najviše 5 javnih dvoboja u jednom danu. Nakon toga traže druge protivnike.
- Postojeći rang, bodovanje partije i pravila riječi ostaju osnova; forma i niz ne mijenjaju ishod ni bodove.

### 2.2. Značenje „zaseban queue”

Nakon pet međusobnih dvoboja A i B nisu više kompatibilni za javni dvoboj tog dana. A i dalje može igrati protiv C, a B protiv D. Ne stvarati trajne odvojene redove ili privatne skupine kandidata za svakog od njih.

Implementirati zajednički red za odgovarajući način i pravila kompatibilnosti kandidata. To ostvaruje željeno razdvajanje bez nepotrebnog cijepanja populacije. Ako vlasnik pod „zaseban queue” želi nešto drugo, razjasniti u završnim pitanjima.

### 2.3. Izvan opsega bez dodatnog dogovora

Novi rangovi, promjena osnovnih bodova, botovi, uparivanje po vještini, nove valute, daily spin, kupovi privatnih soba, puni replay, sustav prijatelja, sezonski reset, detekcija svih VPN-ova i uređaja, retroaktivna isplata novog XP bonusa. Forma nema vlastiti XP bonus. U ovom zadatku XP nagradu daje niz pobjeda.

## 3. Pojmovi i invarianti

| Pojam | Značenje |
|---|---|
| Forma | Razina izvedena iz rezultata najviše posljednjih 10 javnih partija jednog načina |
| Trend forme | Usporedba posljednjih 10 s prethodnih 10 partija istog načina |
| Promjena nakon partije | Razlika forme neposredno prije i poslije konkretne partije |
| Niz pobjeda | Broj uzastopnih završenih pobjeda u jednom javnom načinu |
| Niz riječi | Postojeći niz prihvaćenih riječi unutar igre; potpuno zaseban pojam |
| XP prije bonusa pobjeda | Iznos koji bi postojeći sustav dodijelio za tu partiju, uključujući postojeće bonuse, ali bez novog bonusa niza pobjeda |
| Efektivni IP | Serverom pouzdano utvrđena i normalizirana adresa klijenta iza provjerenog proxyja |
| Par igrača | Neuređeni par stabilnih ID-jeva; A–B je isti par kao B–A |

Invarianti:

- Javna igra 2 i javna igra 4 imaju zasebne forme, nizove i rekorde.
- Privatna igra ne povećava niti prekida javni niz i ne ulazi u formu.
- Poraz u jednom načinu ne prekida niz u drugom.
- Promjena nadimka, avatara i odjava ne smiju resetirati statistiku istog računa.
- Registracija gosta koja zadržava njegov ID zadržava formu, niz i dnevne susrete.
- Server je autoritet za formule, XP, konačne rezultate i pravila uparivanja.
- Klijent ne šalje autoritativni niz, bonus, formu, dnevni brojač ni svoj navodni IP.
- Ista završena partija smije proizvesti jedan obračun i jednu dodjelu nagrade.

## 4. Izračun forme

### 4.1. Prihvatljive partije

Uzeti završene javne partije odabranog načina, sortirane po autoritativnom završetku od najnovije prema starijima. Dodati stabilan sekundarni redoslijed za jednake vremenske oznake. Ne koristiti klijentovo vrijeme.

Poništene i aktivne partije ne ulaze. Završeni poraz zbog prekida veze ulazi kao poraz odnosno stvarni plasman i bodovi. Napuštanje ne smije omogućiti izbjegavanje lošeg rezultata.

Za formu uzeti najviše 10 takvih partija. Za trend dohvatiti najviše 20. U SQL-u prvo ograničiti skup partija; spajanje s potezima ne smije proizvesti višestruko brojanje jedne partije.

### 4.2. Metrika dvoboja

udioPobjeda = brojPobjeda / brojPrihvatljivihPartija

Pobjeda znači plasman 1 odnosno autoritativni pobjednik partije. Koristiti udio od 0 do 1, a ne zaokruženi postotak iz sučelja.

### 4.3. Metrika četvero

prosjekBodova = zbrojStvarnihBodova / brojPrihvatljivihPartija

Uključiti bodove koje postojeće bodovanje daje za plasman, eliminacije i pobjedu. Ne zamijeniti bodove samim plasmanom. Brzina, XP, duljina riječi i ocjena partije ne ulaze u ovu formulu.

### 4.4. Pragovi

Svaki raspon uključuje donju, a isključuje gornju granicu. Posljednji raspon nema gornju granicu. Klasificirati pomoću nezaokružene vrijednosti.

| Razina | Naziv | Udio pobjeda u dvoboju | Pobjede uz točno 10 igara | Prosjek bodova u četvero |
|---:|---|---|---|---|
| 1 | Loša | [0; 0,10) | 0 | [0; 0,75) |
| 2 | Slaba | [0,10; 0,20) | 1 | [0,75; 1,25) |
| 3 | Prolazna | [0,20; 0,30) | 2 | [1,25; 1,75) |
| 4 | Dobra | [0,30; 0,50) | 3–4 | [1,75; 2,50) |
| 5 | Odlična | [0,50; 0,70) | 5–6 | [2,50; 3,25) |
| 6 | Izvanredna | [0,70; 0,80) | 7 | [3,25; 4,00) |
| 7 | Sjajna | [0,80; 0,90) | 8 | [4,00; 5,00) |
| 8 | Top forma | [0,90; 1] | 9–10 | [5,00; +∞) |

Namjera: tri pobjede od deset dovoljne su za dobru formu u dvoboju, pet za odličnu. U četvero dobra kreće na 1,75 bodova, odlična na 2,50. Maksimalni XP bonus ne ovisi o ovim razinama.

Centralizirati konfiguraciju pragova i naziva. Ne kopirati pragove odvojeno u profil, rezultate i pomoć.

### 4.5. Mali uzorak

| Broj završenih igara u tom načinu | Ponašanje |
|---:|---|
| 0 | Bez ocjene. „Forma se još zagrijava. Odigraj prvu igru.” |
| 1–4 | Mini povijest i poruka koliko igara nedostaje do prve procjene; bez imenovane forme |
| 5–9 | Izračun prema stvarnom broju igara i oznaka „Početna procjena · X igara” |
| 10–19 | Forma posljednjih 10; nema trenda prema nepotpunom prethodnom razdoblju |
| 20+ | Forma posljednjih 10 i trend u odnosu na prethodnih 10 |

Primjer: 3 pobjede u 5 igara = 60% = odlična, uz vidljivu oznaku početne procjene. Ne pretvarati 5 igara u 10 dodavanjem poraza. Niz pobjeda i XP mogu raditi od početka, ne čekaju otključavanje forme ili DNK-a.

## 5. Trend na profilu

### 5.1. Dva odvojena prozora

Trenutni prozor: 10 najnovijih prihvatljivih partija. Prethodni: sljedećih 10 starijih. Prozori se ne preklapaju. Ne uspoređivati posljednjih deset s ukupnom karijerom.

Dvoboj: razlika broja pobjeda. Četvero: razlika prosjeka bodova. Ne uvoditi ocjenu uzroka poput „igraš pametnije”; protivnici i situacije variraju.

### 5.2. Tekstovi

- „6 pobjeda u zadnjih 10 igara — dvije više nego u prethodnih 10.”
- „6 pobjeda u zadnjih 10 igara — dvije manje nego u prethodnih 10.”
- „6 pobjeda u zadnjih 10 igara — jednako kao u prethodnih 10.”
- „Prosječno 2,8 bodova u zadnjih 10 igara — 0,6 više nego u prethodnih 10.”
- „Prosječno 2,8 bodova u zadnjih 10 igara — 0,3 manje nego u prethodnih 10.”
- „Prosječno 2,8 bodova u zadnjih 10 igara — jednako kao u prethodnih 10.”

Prikazati strelicu gore, dolje ili neutralnu oznaku uz usporedbu. Forma može biti odlična i imati negativan trend. Ne mijenjati naziv forme prema smjeru trenda.

Prikaz prosjeka pune forme: jedna decimala s hrvatskim decimalnim zarezom. Kod početne procjene može se prikazati dvije decimale ako jedna zamagljuje prag. Usporedbe punih prozora računati točno iz cijelih zbrojeva bodova da numerička pogreška ne proizvede lažan trend.

## 6. Promjena forme u rezultatima

### 6.1. Što uspoređujemo

Za konkretnu partiju izračunati formu prije uključivanja njezina rezultata i formu nakon uključivanja. To nije isto što i profilna usporedba dvaju prozora od 10 igara.

Pohraniti ili stabilno rekonstruirati rezultat obračuna te partije. Ponovni dolazak na isti rezultat ne smije pokazati formu iz neke kasnije partije kao da je ostvarena u ovoj.

### 6.2. Osobni prikaz

- Porast: „Forma: dobra → odlična. Ovom pobjedom došao si do 5 pobjeda u zadnjih 10 dvoboja.”
- Pad: „Forma: odlična → dobra. U zadnjih 10 dvoboja sada imaš 4 pobjede.”
- Ista razina: „Forma ostaje odlična. Prosjek zadnjih 10 igara sada ti je 2,9 bodova.”
- Prva procjena nakon pete igre: „Prva procjena forme: odlična. 3 pobjede u prvih 5 dvoboja.”
- Deseta igra: ukloniti oznaku početne procjene i objasniti da je uzorak sada 10.
- Dvadeseta: profil prvi put može prikazati usporedbu s prethodnih 10.

Kratko objašnjenje dostupno na info ikoni: „Najnovija igra ulazi u izračun, a najstarija izlazi.”

Pobjeda ne mora povećati formu: iz prozora može izaći jednaka ili bodovno bolja stara partija. U četvero ne zaključivati smjer iz plasmana; računati stvarne bodove.

### 6.3. Što vide drugi

Zajednička tablica rezultata prikazuje uz svakog sudionika njegovu novu formu i aktivnu vatru za taj način, ako postoji. Kod nedovoljnog uzorka prikazati nenametljivo prazno stanje, ne izmišljenu razinu.

Detaljno objašnjenje promjene, XP obračun i sljedeći bonus prikazuju se vlasniku rezultata. Koristiti stanje iz upravo zaključene partije. Opseg prikaza javne povijesti drugim osobama potvrditi u pitanjima.

## 7. Mini povijest

### 7.1. Položaj i raspored

Unutar kartice odabranog javnog načina, odmah ispod DNK grafa:

1. „Forma igrača” i info ikona.
2. „Forma: odlična” ili stanje prikupljanja uzorka.
3. Tekst profilnog trenda ili trenutačnog rezultata uzorka.
4. Naslov „Zadnjih 10 igara” odnosno „Zadnjih X igara”.
5. Jedan red oznaka rezultata.
6. Trenutni niz pobjeda i aktivni bonus; najbolji niz kao sekundarna informacija.
7. „Prikaži povijest” prema postojećem dijelu povijesti, s odabranim načinom ako je podržan.

Ako je DNK zaključan do 10 igara, forma i niz ostaju dostupni ispod njegova zaključanog stanja. Ne skrivati novu funkcionalnost zbog DNK uvjeta.

### 7.2. Oznake rezultata

| Način i ishod | Simbol | Boja |
|---|---|---|
| Dvoboj, pobjeda | ✓ | Zelena |
| Dvoboj, poraz | × | Crvena |
| Četvero, 1. mjesto | 1 | Zelena |
| Četvero, 2. mjesto | 2 | Žuta |
| Četvero, 3. mjesto | 3 | Narančasta |
| Četvero, 4. mjesto | 4 | Crvena |

Najstarija prikazana igra je lijevo, najnovija desno. Najnovija ima diskretan obrub. Oznake su jednake veličine, deset stane u jedan red na uobičajenom uskom mobitelu. Pri izrazitom povećanju teksta dopušten je pristupačan raspored bez preklapanja; ne smanjivati sadržaj do nečitljivosti.

Tooltip/popover dostupan mišem, tipkovnicom i dodirom:

- „Pobjeda · 17. rujna 2026.”
- „2. mjesto · 3 boda · 1 eliminacija · 17. rujna 2026.”

Čitač ekrana dobiva puni opis. Simboli i brojevi nose značenje neovisno o boji. Na žutoj i narančastoj koristiti odgovarajuće taman tekst.

Oznake četvero prikazuju plasman; forma uključuje sve bodove. To navesti u objašnjenju. Ne izmišljati URL detalja partije ako takav ekran još ne postoji; za početnu verziju dovoljan je popover i poveznica na postojeću povijest.

## 8. Nizovi pobjeda

### 8.1. Stanje po igraču i načinu

Voditi currentWinStreak i bestWinStreak (nazive prilagoditi hrvatskim konvencijama repozitorija). Po potrebi čuvati vrijeme ili partiju početka niza. Rekord se mijenja samo kada trenutni niz nadmaši prethodni.

Pobjeda u četvero znači prvo mjesto. Drugo mjesto, neovisno o bodovima, prekida niz. Niz može biti dulji od 10 i ne računa se samo iz mini povijesti.

### 8.2. Prijelazi

| Događaj | Trenutni niz | Najbolji niz | Novi XP bonus |
|---|---|---|---|
| Javna pobjeda | +1 | max(stari rekord, novi niz) | Prema novom nizu |
| Javni poraz, uključujući prekid | 0 | Ostaje | 0% za izgubljenu partiju |
| Privatna igra | Bez promjene | Bez promjene javnog rekorda | Nema javnog bonusa |
| Poništena igra prije obračuna | Bez promjene | Bez promjene | Nema |
| Promjena načina | Mijenja se samo odigrani način | Zasebno | Prema odigranom načinu |
| Odjava, reconnect ili restart servera | Bez promjene već potvrđenog stanja | Bez promjene | Nema nove isplate |

Niz se ne resetira na ponoć niti zbog neaktivnosti. Dnevno resetiranje odnosi se samo na limit međusobnih dvoboja.

### 8.3. Poraz i rekord

„Niz je završio na 5 pobjeda. Bonus pobjeda vraća se na 0%.” Ako je završeni niz bio najbolji, može se navesti „Tvoj najbolji niz: 5”, ali ne ponavljati događaj otključavanja rekorda kao novu nagradu nakon svakog poraza.

Nov rekord pri pobjedi: „Novi osobni rekord: 6 pobjeda zaredom!”

Stanje se konačno potvrđuje transakcijskim završetkom partije. Nakon ranog ispadanja može se prikazati privremena informacija da je niz prekinut, ali ne smije se isplatiti nagrada ni nepovratno promijeniti rekord prije autoritativnog zaključka.

## 9. XP bonus

### 9.1. Formula

Za upravo završenu javnu pobjedu neka je n novi niz, uključujući tu pobjedu:

- Četvero: bonusPostotak = min(100, max(0, n - 1) * 10).
- Dvoboj: bonusPostotak = min(100, max(0, n - 1) * 5).
- Za poraz: bonusPostotak = 0.

| Niz nakon pobjede | Četvero | Dvoboj |
|---:|---:|---:|
| 1 | 0% | 0% |
| 2 | 10% | 5% |
| 3 | 20% | 10% |
| 4 | 30% | 15% |
| 5 | 40% | 20% |
| 6 | 50% | 25% |
| 8 | 70% | 35% |
| 11 | 100% | 50% |
| 21 | 100% | 100% |
| Iznad praga maksimuma | 100% | 100% |

Maksimum ostaje 100%, bez daljnjeg spuštanja ili zamjene. To je najviše x2 u odnosu na postojeći XP obračun iste partije.

### 9.2. Redoslijed obračuna

1. Izračunati postojeći XP za partiju: riječi, duljinu, rijetkost, eliminacije, pobjedu, postojeći bonus niza riječi i postojeću ocjenu partije, prema aktualnom kodu.
2. Dobiti kanonski cjelobrojni XP iznos B koji bi igrač dobio bez novog bonusa pobjeda.
3. Izračunati bonusXp = round(B * bonusPostotak / 100).
4. Ukupno za partiju = B + bonusXp.
5. Primijeniti postojeće ograničenje ukupnog iskustva/razine pri upisu na račun. Ako cap ograniči stvarnu dodjelu, rezultat mora razlikovati obračunati i stvarno dodani XP.

Ne dodavati bonus na već uvećani iznos drugi put. Ne koristiti bonus pobjeda kao zamjenu za bonus niza riječi. Ne ponovno zaokruživati međukorake postojećeg sustava; za novi dodatak zaokružiti jednom. Ako se postojeći obračun razlikuje od ovih pretpostavki, agent treba opisati točno poravnanje.

Primjer: B = 200, treća pobjeda u četvero, bonus = 20%, bonusXp = 40, ukupno = 240.

Primjer: B = 205, druga pobjeda u dvoboju, bonus = 5%, bonusXp = 10, ukupno = 215 (pravilo round na pozitivne vrijednosti).

Na maksimumu B = 200 daje dodatnih 200, ukupno 400. Nema eksponencijalnog kumuliranja bonusa između partija.

### 9.3. Tekstovi i trenutak prikaza

Na profilu nakon treće pobjede u četvero: „3 pobjede zaredom · +20% XP”. Pomoć objašnjava da je to bonus dosegnut posljednjom pobjedom i da vrijedi za pobjednički obračun; sljedeća pobjeda donosi +30%.

U queueu i igri: „Ako pobijediš: +30% XP” ili kraće „Sljedeća pobjeda: +30% XP”. Izbjegavati obećanje da bonus pripada i za poraz.

U rezultatima:

- „XP prije bonusa pobjeda: 200”
- „Treća pobjeda zaredom: +20% · 40 XP”
- „Ukupno: 240 XP”
- „Sljedeća pobjeda donosi +30%.”

Kod maksimuma: „Maksimalni bonus: +100% XP.” Kod niza 0 ili 1, informativno objasniti da bonus kreće od druge pobjede. Ne prikazivati bonus 0% kao osvojenu nagradu.

## 10. Vatra i obrub

### 10.1. Pragovi

| Razina efekta | Četvero | Dvoboj | Ikonice | Dodatni obrub |
|---:|---|---|---|---|
| 0 | 0–2 | 0–3 | Bez vatre | Bez crvenog dodatka |
| 1 | 3–4 | 4–7 | 1 vatra | 1 px |
| 2 | 5–7 | 8–13 | 2 vatre | 2 px |
| 3 | 8+ | 14+ | 3 vatre | 3 px |

Tri vatre ne znače nužno +100%. Broj pobjeda i stvarni postotak dostupni su u detalju. Ovi pragovi prihvaćeni su kao prijedlog iz razgovora; ne uvoditi četvrtu razinu.

### 10.2. Dizajn

Crveni obrub je zaseban vanjski sloj oko postojećeg obruba ranga. Ne zamjenjuje rang niti njegovu boju. Rezervirati prostor za najveći obrub da se avatar i susjedni elementi ne pomiču. Ikonice ne prekrivaju lice, nadimak, timer ili status poteza.

Koristiti postojeći vizualni jezik i jedinstvenu komponentu avatara. Ikona vatre može biti postojeći asset/SVG radi jednakog prikaza; semantika je jedna do tri vatre. Početna verzija može biti statična. Ako se dodaju animacije, poštovati reduced-motion i ne ometati unos riječi.

Naziv forme ne koristiti za uključivanje vatre. Vatra ovisi samo o nizu pobjeda. Dobra forma može imati tri vatre i obrnuto.

### 10.3. Gdje se prikazuje

| Mjesto | Koji niz | Trenutak |
|---|---|---|
| Vlastiti profil | Odabrani javni način | Posljednje potvrđeno stanje |
| Javni profil | Odabrani javni način | Posljednje potvrđeno stanje |
| Javni queue | Način čekanja | Pri ulasku i autoritativnom osvježavanju |
| Aktivna javna partija | Način partije | Potvrđeni niz pri ulasku; privremeni poraz odvojeno |
| Rezultati | Način završene partije | Stanje nakon zaključka te partije |
| Privatna soba/igra | Nema jednoznačnog javnog načina | Predloženo bez novog efekta; potvrditi |

Kod promjene načina ne prenositi vatru dvoboja u četvero. Nakon poraza sljedeći queue i profil više nemaju aktivni crveni dodatak. Rekord ostaje vidljiv kao sekundarna informacija.

## 11. Zaštita istog IP-a

### 11.1. Pravilo

U svakom novoformiranom javnom dvoboju ili stolu četvero svi sudionici moraju imati međusobno različite efektivne IP adrese. Pravilo vrijedi i za goste i za registrirane. Ista IP adresa nije globalna zabrana igranja: dva igrača s iste mreže mogu istodobno biti u različitim javnim partijama protiv drugih ljudi.

Privatne sobe izuzete su iz ove zabrane. Ne mijenjati njihove pozivnice, broj igrača ili pravila zbog javnog filtra.

Za četvero usporediti svih šest parova sudionika, a ne samo odnos s prvim kandidatom.

### 11.2. Pouzdan izvor

Pregledati aktualni Caddy/Fastify/Socket.IO proxy lanac. Prihvaćati forwarded podatke samo od provjerenog proxyja i normalizirati adrese. Ne postaviti neograničeno povjerenje u proizvoljni X-Forwarded-For. Ne vjerovati IP-u iz Socket payloadova ili localStoragea.

Izjednačiti ekvivalentne IPv4/IPv4-mapped IPv6 prikaze. Za IPv6 unaprijed odrediti uspoređuje li se puna adresa ili mrežni prefiks. Preporuka za početni scope je normalizirana puna adresa; prefiks predstavlja strože, zasebno pravilo i traži dogovor.

Adresa se provjerava pri ulasku i konačnoj rezervaciji javnog meča. Ponovno spajanje ažurira adresu za buduće uparivanje, ali ne smije samo po sebi promijeniti već završeni rezultat.

Nedostajuća ili nepouzdana adresa: ne koristiti zajedničku izmišljenu vrijednost poput 0.0.0.0 i ne preskočiti zaštitu. Predloženo odbiti javni matchmaking uz poruku za ponovni pokušaj i operativni zapis; potvrditi očekivani fallback.

### 11.3. Posljedice i granice

Članovi istog kućanstva, škole, ureda ili korisnici zajedničkog izlaznog NAT-a mogu biti blokirani od međusobne javne igre. To je stvarna posljedica traženog pravila, ne dokaz varanja. Ne označavati ih kao prevarante. Poruka treba nuditi privatnu sobu za zajedničko igranje.

IP zaštita ne dokazuje identitet i ne zaustavlja drugu mrežu, VPN, IPv6 promjenu ili novi gostujući identitet. Nemoj je opisati kao potpunu zaštitu od dogovaranja.

Ne slati IP adrese drugim igračima ni u javne API odgovore. Ako za privremenu usporedbu ili audit treba trajni mrežni ključ, predložiti HMAC normalizirane adrese server tajnom, s odvojenim pravilom zadržavanja. Običan hash nije dovoljna zaštita lako pretraživog skupa IPv4 adresa. Rok zadržavanja i svrhu dogovoriti; ne uvoditi trajni log adresa bez potrebe.

### 11.4. Promjena mreže tijekom partije

Preporučeni scope: IP je uvjet pri formiranju partije. Promjena mreže/reconnect nakon početka ne poništava automatski meč i ne izbacuje igrača samo zbog nove podudarnosti, jer mobilne mreže mogu promijeniti adresu. Novo stanje vrijedi za sljedeće uparivanje. Ovu granicu vlasnik treba potvrditi.

## 12. Najviše pet dvoboja istog para dnevno

### 12.1. Identitet para i dnevni period

Ključ: (manjiStabilniIgracId, veciStabilniIgracId, dan). Par je neuređen. Brojati samo javne dvoboje. Privatne igre ne ulaze, a međusobni susreti u četvero nisu predmet ovog limita.

Predloženi dan: kalendarski dan u Europe/Zagreb, s resetom u lokalnu ponoć i ispravnom obradom ljetnog/zimskog vremena. Ne koristiti klijentovu vremensku zonu niti fiksni UTC+1/UTC+2. Potvrditi u pitanjima; alternativa je kliznih 24 sata, što je drugo pravilo.

### 12.2. Ponašanje nakon petog susreta

Prvih pet dozvoljenih dvoboja A–B tretira se normalno za bodove, formu, niz i XP. Šesti se ne smije započeti tog dana. A i B ostaju u zajedničkom redu, ali se međusobno preskaču pri izboru protivnika.

Obojica mogu igrati s drugim kompatibilnim igračima bez ukupnog dnevnog limita. Novo razdoblje omogućuje im ponovni susret ako ne krše IP pravilo.

### 12.3. Što se broji — prijedlog za potvrdu

Brojati autoritativno započete dvoboje i rezervirati pravo na susret prije njihova pokretanja. Namjerni prekid nakon starta troši susret. Ako se broje samo završene igre, prekidom bi se mogao zaobilaziti limit.

Rezervacija koja propadne prije stvarnog početka oslobađa se idempotentno. Tehnički poništenje nakon starta: preporuka zadržati potrošen susret za dnevni limit, ali ne mijenjati formu, niz ni XP. Izuzetak za dokazani serverski incident može biti kontrolirana operativna korekcija. Potvrditi ovu produktnu odluku.

Dvoboj započet prije ponoći pripada danu početka za limit para, čak ako završi poslije ponoći. Za formu i niz koristi se redoslijed autoritativnih završetaka.

### 12.4. Atomska rezervacija

Uvjet count < 5 mora se provjeriti i rezervirati atomski u trajnom spremištu. Dva procesa ili dva istodobna pokušaja ne smiju oba dopustiti šesti meč. Kombinirati transakciju, jedinstveni ključ para/dana i uvjetni update/zaključavanje prema stvarnoj arhitekturi.

Veza rezervacije s partijaId ili matchAttemptId mora biti jedinstvena. Retry istog pokušaja ne smije povećati brojač drugi put. Riješiti oporavak rezervacije nakon pada procesa: razlikovati rezervirano, započeto i otkazano. Aktivne rezervacije računaju se pri provjeri kapaciteta, a zastarjele se provjeravaju prema stanju meča prije oslobađanja.

Dnevni brojač ne smije nestati restartom servera. Ne oslanjati zaštitu isključivo na Map u memoriji.

## 13. Algoritam reda čekanja

### 13.1. Uvjeti kompatibilnosti

Dvoboj: različiti identiteti, valjana aktivna prijava u queue, nisu već rezervirani/u aktivnoj partiji, različit IP i manje od pet međusobnih susreta uključujući aktivne rezervacije za dan.

Četvero: četiri različita kompatibilna identiteta, aktivni zahtjevi, bez dvostruke rezervacije i četiri različita IP-a. Dnevni limit dvoboja ne prenosi se na četvero.

### 13.2. Izbor bez blokiranja cijelog reda

Ne uzimati slijepo prva dva/prva četiri kandidata. Tražiti najstariju izvedivu kombinaciju. Ako A nije kompatibilan ni s kim, ali B i C jesu, B i C moraju moći započeti meč. A zadržava vrijeme ulaska i prioritet za sljedećeg kompatibilnog kandidata.

Ne resetirati vrijeme čekanja nakon preskakanja. Ne izbacivati igrača zato što trenutno nema kompatibilnog protivnika. Kad nema valjane kombinacije, ostaviti ih u redu; ne zaobilaziti pravila nakon timeouta. Nema automatskog spajanja A i B nakon petog meča radi kraćeg čekanja.

Za četvero kombinacije tražiti ograničenim, predvidljivim algoritmom bez neograničenog kombinatornog pretraživanja. Agent treba predložiti strukturu prema stvarnoj veličini reda i provjeriti scenarij više kandidata s istih mreža. Ograničenje pretrage ne smije trajno izgladnjivati starije kompatibilne igrače.

### 13.3. Konačna provjera

Prije početka ponovno provjeriti identitet, aktivnu vezu, IP, status rezervacije i dnevni limit. Uklanjanje iz queuea i rezervacija igrača moraju biti dosljedni. Ako dio postupka propadne, vratiti preostale igrače bez duplikata i s očuvanim prioritetom.

Jedan račun ne može s dva taba dobiti dva paralelna meča niti dvostruki bonus. Primijeniti postojeći model jedne aktivne partije i razjasniti smije li eliminirani igrač prije zaključka započeti novu partiju (pitanja na kraju).

### 13.4. UX čekanja

Broj vidljivih ljudi u redu nije jamstvo da mogu igrati zajedno. Kad pravila onemogućuju trenutno uparivanje, poruka: „Tražimo drugog dostupnog protivnika.” Za četvero: „Tražimo igrače za tvoj stol.”

Opće objašnjenje dostupno u pomoći: „U javnim igrama igrači s iste mreže ne igraju zajedno. Isti par može odigrati najviše pet javnih dvoboja dnevno.”

Ako se prikazuje osobna poruka o limitu, ne otkrivati identitet blokiranog protivnika niti njegov IP. Za zajedničko igranje ponuditi privatnu sobu, uz jasnoću da privatna ne dodjeljuje javni bonus.

## 14. Podaci i ugovori

### 14.1. Pregledati postojeće izvore

U ranijem pregledu relevantni su bili:

- aplikacije/posluzitelj/src/igra/motor-partije.ts
- aplikacije/posluzitelj/src/igra/upis-partije.ts
- aplikacije/posluzitelj/src/red/servis-reda.ts i red-cekanja.ts
- aplikacije/posluzitelj/src/soba/servis-soba.ts
- aplikacije/posluzitelj/src/profil/rute.ts
- aplikacije/posluzitelj/src/baza/shema.ts
- paketi/zajednicko/src/dnk.ts, iskustvo.ts, protokol.ts, bodovanje.ts
- aplikacije/web/src/routes/profil, profil/javni, red, partija
- aplikacije/web/src/lib/komponente/Avatar.svelte i komponente DNK/XP
- pomoć, queue savjeti i Socket stanje na klijentu.

Provjeriti aktualne nazive. Ne duplicirati postojeću infrastrukturu gdje se može sigurno proširiti.

### 14.2. Trajno stanje — konceptualni model

| Skup | Potrebne informacije |
|---|---|
| Niz po igraču i modu | trenutni niz, najbolji niz, verzija/posljednja obrađena partija prema modelu idempotentnosti |
| Rezultat igrača u partiji | forma prije/poslije ili dovoljan stabilan snapshot; niz prije/poslije; rekord događaj; B; bonus postotak; bonus XP; konačni i stvarno dodijeljeni XP; verzija formule |
| Dnevni par | kanonski par ID-jeva, lokalni dan, broj započetih/rezerviranih susreta ili ledger iz kojeg se izvodi |
| Rezervacija meča | jedinstveni pokušaj, kandidati, dan, status, početak/istek, povezana partija |
| Postojeća povijest | javni mod, konačni status, vrijeme završetka, sudionik, plasman i bodovi |

Forma se može računati iz posljednjih 20 rezultata; nije nužno održavati još jedan nepouzdan zbroj u bazi. Za arhivirane rezultate treba sačuvati značenje u trenutku obračuna, osobito ako se formule kasnije promijene.

Ne koristiti javni tip moda kao jedini dokaz da partija nije privatna. Ako postojeće spremanje privatnih agregata dijeli neke tablice, uvesti jasnu selekciju izvora bez miješanja javne i privatne statistike.

### 14.3. API/Socket sadržaj

Predloženi semantički podaci, nazive prilagoditi repozitoriju:

- mod; broj igara u uzorku; status uzorka (nema/prikupljanje/početna/puna).
- formaLevel, formaLabel, metricValue, wins/sampleSize ili totalPoints/sampleSize.
- trend ili null: prethodni uzorak, razlika, smjer.
- recentMatches: matchId, endedAt, placement, points, win, eliminations po potrebi.
- currentWinStreak, bestWinStreak, fireLevel, currentBonusPercent, nextWinBonusPercent.
- U rezultatu: before/after forma i niz, earnedBonusPercent, earnedBonusXp, totalXp, capApplied po potrebi.

Razlikovati currentBonusPercent, nextWinBonusPercent i earnedBonusPercent da klijent ne prikaže pogrešan postotak. Nula i nedostajući podatak nisu isto. Privatna partija koristi not-applicable/null za ove javne obračune, ne lažnu lošu formu.

Ne slati dnevne parove ili mrežne ključeve javnom klijentu. U queueu je dovoljan ograničen razlog stanja za UX.

## 15. Konzistentan završetak

Preporučeni redoslijed autoritativnog zaključka:

1. Zaključati/rezervirati obradu partije i provjeriti nije li već obrađena.
2. U determinističkom redoslijedu zaključati pogođeno stanje igrača/moda.
3. Dohvatiti valjano prethodno stanje i povijest.
4. Utvrditi konačne ishode i osnovne bodove.
5. Izračunati forme prije/poslije, nizove, rekorde, postojeći XP i novi bonus.
6. Upisati rezultate, XP, nizove i stabilne obračune u jednoj konzistentnoj transakciji ili postojećem pouzdanom ekvivalentu.
7. Tek nakon uspješnog commita poslati konačan rezultat klijentima i invalidirati profile/queue cache.
8. Ponovljeni zahtjev vratiti iz već spremljenog obračuna bez novog XP-a.

Ako postojeći završetak poziva sporedne fire-and-forget upise koji su nužni za XP, agent mora riješiti konkretan rizik nedostajućih podataka. Ne objavljivati konačan nagradni rezultat prije uspješnog upisa.

Rani izlazak eliminiranog igrača: ako može pokrenuti novu igru prije zaključka stare, kasno upisani poraz može pogrešno prekinuti noviji niz. Prije implementacije odabrati model: zabrana nove javne igre do zaključka ili autoritativni redoslijed i obrada ishoda koji sigurno podržavaju preklapanje. Ne prešutjeti ovo ponašanje.

Za naknadno poništenje već obrađene partije unaprijed definirati scope. Takva promjena može utjecati na sve kasnije nizove i bonuse, pa jednostavno oduzimanje jednog rezultata nije dovoljno.

## 16. Migracije i postojeći igrači

Predloženo: iz postojeće pouzdane javne povijesti izračunati formu, trenutni i najbolji niz. Novi XP bonus vrijedi samo za partije završene nakon aktivacije funkcije; stare isplate se ne mijenjaju. Odluku potvrditi prije backfilla.

Ako povijest nije potpuna, ne predstavljati djelomični rekord kao puni rekord karijere. Odabrati početni datum evidencije i jasno prikazati opseg.

Za dnevni limit pri objavi usred dana rekonstruirati današnje javne dvoboje gdje je moguće. Ako nedostaju informacije za brojenje započetih/poništenih susreta, dogovoriti aktivaciju na početku sljedećeg lokalnog dana. Ne resetirati limit svakim deployem.

Migracija mora biti ponovljivo sigurna prema postojećem migracijskom sustavu, s potrebnim indeksima za igrača/mod/vrijeme i par/dan. Prije dodavanja indeksa provjeriti postojeće upite i volumen; ne stvarati redundantne indekse naslijepo.

Poželjno je imati server kontroliranu aktivaciju novog XP bonusa i novih UI prikaza za staging rollout. Isključivanje prikaza ne smije obrisati podatke niti promijeniti već dodijeljen XP.

## 17. Postojeće veze koje treba provjeriti

U ranijem pregledu postojao je rizik da dio DNK profilnog izračuna dvoboja koristi statistiku riječi četvero. Provjeri je li to već popravljeno. Nova forma mora imati ispravan mod neovisno o tome. Predloži nužan popravak ako bi zajednička kartica prikazivala proturječne podatke.

Provjeri usklađenost ocjene partije, XP breakdowna i trajno spremljenog XP-a. Novi bonus mora se primijeniti na isti iznos koji korisnik vidi kao osnovicu. Ako postoji postojeći bug, opiši ga i odvoji nužan popravak od šireg redizajna DNK-a.

Provjeri maksimalno iskustvo, gost → registrirani račun, odjavu, reconnect, više tabova, promjenu moda, cache profila, javni profil i postojeće ponašanje nakon ispadanja.

## 18. Tekstovi i pomoć

Ton: jednostavan hrvatski, kratke rečenice, opušten ali jasan. Humor nakon informacije, bez posramljivanja zbog poraza ili mreže.

Dodati u pomoć objašnjenja:

- razlika ranga, forme, trenda, niza riječi i niza pobjeda;
- formula forme i osam pragova za oba načina;
- forma prije/poslije partije nasuprot trendu dvaju prozora;
- bonus vrijedi za pobjedu, od druge, +10/+5, maksimum +100%;
- tri razine vatre i njihov odnos prema nizu;
- odvojeni nizovi, privatne ne utječu, poraz prekida;
- javni IP filter i pet dnevnih dvoboja istog para;
- objašnjenje da čekanje ovisi o kompatibilnim igračima.

Kratki tekstovi:

- „Još 2 igre do prve procjene forme.”
- „Početna procjena · 7 igara.”
- „Nema aktivnog niza. Nova pobjeda je početak.”
- „3 pobjede zaredom · +20% XP.”
- „Sljedeća pobjeda: +30% XP.”
- „Tražimo drugog dostupnog protivnika.”
- „Za zajedničku igru s iste mreže otvorite privatnu sobu.”

Hrvatske množine riječi pobjeda/igra/bod treba ispravno riješiti. Ne prikazivati „1 pobjede” ni „2 pobjeda”. Info sadržaj mora raditi na dodir, ne samo hover.

## 19. Testovi i kriteriji prihvata

### 19.1. Jedinični testovi formula

- Svaka donja/gornja granica svih osam razina, za oba načina.
- 0–4 partije bez imenovane forme; 5–9 početna; 10 puna; 19 bez trenda; 20 s trendom.
- Klasifikacija nezaokruženog prosjeka i ispravan prikaz decimala.
- Dva odvojena prozora, stabilan redoslijed i izbacivanje najstarije partije.
- Forma ostaje ista nakon pobjede kada izlazi jednaka stara pobjeda.
- Nizovi 0, 1, 2, 3, 4, 8, 11, 14, 21 i iznad maksimuma.
- Četvero n=2 → 10%, n=11 → 100%; dvoboj n=2 → 5%, n=21 → 100%.
- Poraz → 0%, privatna → nije primjenjivo, rekord ostaje.
- Vatra: 2/3, 4/5, 7/8 u četvero; 3/4, 7/8, 13/14 u dvoboju.
- XP osnovica, zaokruživanje, cap računa, nema dvostruke primjene.

### 19.2. Integracijski testovi rezultata

- Pobjeda i poraz ažuriraju samo ispravan mod.
- Privatna i poništena ne mijenjaju javnu formu/niz/XP bonus.
- Disconnect poraz ne čuva niz.
- Ponovljeni završetak, retry nakon timeouta i reconnect ne dupliciraju isplatu.
- Pad transakcije ne ostavlja XP ažuriran bez niza ili obrnuto.
- Stari rezultat nakon nove partije zadržava svoj originalni obračun.
- Gost koji se registrira zadržava ID i podatke.
- Restart čuva niz i dnevni limit.
- Preklapanje partija nakon ranog ispadanja prema dogovorenom modelu.

### 19.3. Integracijski testovi uparivanja

- Isti IP, različiti računi: ne mogu zajedno u javni dvoboj.
- Četvero: nijedan par ne smije dijeliti IP; tri jedinstvena IP-a nisu dovoljna za četiri igrača.
- Isti IP dopušten privatno; može istodobno igrati u različitim javnim partijama.
- Normalizirani IPv4 i IPv4-mapped IPv6 ne zaobilaze provjeru.
- Lažni forwarded header nepouzdanog izvora ne mijenja mrežni identitet.
- A–B i B–A broje se kao isti par.
- Pet susreta dopušteno; šesti blokiran; A–C i B–D i dalje dopušteni.
- Blokirani prvi kandidati ne zaustavljaju druge kompatibilne igrače.
- Privatni susret ne troši dnevni limit; četvero ga ne troši.
- Atomska utrka za peti susret dopušta samo preostali kapacitet.
- Retry rezervacije ne broji dvaput; propast prije početka pravilno oslobađa.
- Ponoć Europe/Zagreb, promjena sata i partija preko ponoći.
- Dva taba istog računa ne rezerviraju dvije partije.
- Prekid veze kandidata između izbora i starta sigurno vraća ostale u red.
- Brojači i rezervacije preživljavaju restart uz dogovoreni oporavak.

### 19.4. UI i ručni staging scenariji

- Vlastiti i javni profil, oba moda, zaključan DNK i svi uzorci od 0 do 20+.
- Deset ikonica na mobitelu, čitljive boje i simboli, tipkovnica i dodir.
- Niz veći od 10 prikazan uz samo 10 rezultata.
- Vatra 0–3 bez pomicanja avatara, postojeći rang ostaje vidljiv.
- Queue prikazuje niz odgovarajućeg moda; promjena moda ne ostavlja staru vatru.
- Nakon pobjede bonus i vatra rastu na točnom pragu; nakon poraza gase se.
- Osobni XP breakdown jednak serverom spremljenom obračunu.
- Rezultati drugih imaju ispravnu formu i vatru, bez privatnih mrežnih podataka.
- Nema kompatibilnog protivnika: razumljiva poruka, očuvan red, moguć izlazak.
- Isti kućni IP testirati s dva odvojena identiteta; različite mreže s kontroliranim testnim klijentima.

Ne širiti testiranje na nepovezane funkcionalnosti bez konkretnog rizika. Produkcijske zaštite ne gasiti radi lakših testova; koristiti kontrolirano testno okruženje i pouzdanu injekciju adresa u testovima.

## 20. Operativni pregled i rollout

Za staging pripremiti anonimizirane scenarije: korisnik s 0, 4, 5, 9, 10, 19 i 20 igara; nizovi na svim pragovima; par s 4 i 5 susreta; više igrača s istim IP-om; igrač na XP capu.

Mjeriti zbirno: vrijeme čekanja po modu, udio pokušaja bez kompatibilne kombinacije, blokade zbog IP-a i para, duplicirane završetke koji su sigurno odbijeni, količinu XP-a dodanu novim bonusom. Ne bilježiti sirove IP-eve ni javno izlagati parove radi obične analitike.

Ako zaštite znatno produlje čekanje, iznijeti vlasniku stvarne podatke. Ne popuštati automatski potvrđena pravila. Izravno objasniti da IP zabrana i limit mogu smanjiti broj dostupnih protivnika u maloj populaciji.

Pripremiti migracije, kompatibilnost frontend/backend verzija i povratak na prethodni prikaz bez gubitka statistike. Produkcijsku objavu provesti samo prema dogovorenom release postupku.

## 21. Definicija gotovosti

- Sve potvrđene funkcije rade povezano, u oba javna načina.
- Privatne ostaju izuzete iz javnih formula i zaštita uparivanja.
- Maksimalni bonus je +100% i obračun je transparentan.
- Rezultati objašnjavaju formu, niz i dobiveni bonus.
- Profil, queue i igra koriste isti autoritativni niz i iste pragove.
- Nema dupliciranog XP-a ni šestog nedozvoljenog dvoboja pod paralelnim zahtjevima.
- Isti efektivni IP ne prolazi u isti novoformirani javni meč.
- Nema blokiranja cijelog reda zbog nekompatibilnog prvog kandidata.
- Migracije i početno stanje postojećih korisnika imaju dogovoreno ponašanje.
- Testovi pokrivaju navedene granice i rizične prijelaze; staging ručni testovi imaju kratke upute.
- Pomoć i tekstovi objašnjavaju ponašanje bez proturječja s implementacijom.
- Agent daje sažetak promjena, provjera, otvorenih rizika i točnih koraka za release.

## 22. Pitanja za vlasnika

Ovo je obvezan dio pripreme implementacije. Agent prvo provjerava kod, zatim prolazi pitanja u kratkim tematskim skupinama. Uz svako pitanje navesti preporuku i stvarni utjecaj na scope. Ne tražiti ponovno potvrdu već dogovorenog maksimuma +100%, pragova +10/+5 ili zabrane istog IP-a u javnom meču.

### A. Uparivanje — zaključati prije backend rada

1. **Znači li „zaseban queue” zabranu međusobnog uparivanja A–B uz normalno traženje drugih protivnika?** Preporuka: da, zajednički red s provjerom kompatibilnosti. Doslovno odvajanje redova traži drugačiji sustav i može znatno produljiti čekanje.

2. **Je li dan kalendarski dan Europe/Zagreb ili kliznih 24 sata?** Preporuka: Europe/Zagreb, reset u lokalnu ponoć. Time par može imati pet susreta prije i pet nakon ponoći; ako to nije prihvatljivo, potrebno je klizno pravilo.

3. **Troši li limit već započet dvoboj ili samo završen?** Preporuka: započet, uz rezervaciju prije starta. Inače se limit može zaobilaziti prekidima. Tehničko otkazivanje prije starta ne troši susret.

4. **Što s tehnički poništenim dvobojem nakon starta?** Preporuka: troši dnevni susret, ne utječe na formu/niz/XP; kontrolirana korekcija kod potvrđenog server incidenta. Želi li se automatski povrat, treba definirati pouzdano razlikovanje server greške od namjernog prekida.

5. **Kako tumačimo isti IP na IPv6 mrežama?** Preporuka: ista normalizirana puna adresa za početak. Usporedba mrežnog prefiksa stroža je i može blokirati više nepovezanih korisnika. Agent treba objasniti stvarni deployment i posljedice obje opcije.

6. **Potvrđujemo li da promjena IP-a nakon početka ne ruši postojeću partiju?** Preporuka: provjera pri uparivanju, nova adresa za buduće partije. Kontinuirano izbacivanje pri promjeni mreže moglo bi kažnjavati normalni mobilni reconnect.

7. **Što korisnik vidi kad nema kompatibilnih protivnika i što ako IP nije moguće pouzdano utvrditi?** Preporuka: čeka bez popuštanja pravila, vidi neutralnu poruku i može otvoriti privatnu sobu; nepouzdani IP zaustavlja javno uparivanje do ponovnog pokušaja. Želi li se detaljan razlog blokade ili samo opća poruka?

8. **Koliki scope zaštite od novih gostujućih identiteta želimo sada?** Stabilni ID i IP ne zaustavljaju nove goste na drugim mrežama. Preporuka: implementirati dogovorene dvije zaštite i jasno evidentirati granicu. Dodatna provjera računa/uređaja zaseban je scope; ne uvoditi je skriveno.

### B. Rezultati i integritet — zaključati prije obračuna

9. **Smije li eliminirani igrač započeti novu javnu partiju dok stara još traje?** Agent prvo utvrđuje aktualno ponašanje. Ako da, treba odabrati točan redoslijed evidentiranja ishoda da zakašnjeli poraz ne poništi noviji niz. Preporuka: sačuvati postojeći UX samo uz ispravno riješenu konzistentnost; zabrana nove igre je jednostavnija, ali vidljiva promjena iskustva.

10. **Treba li podržati naknadno poništavanje već nagrađenih partija?** Ako da, treba definirati preračun kasnijih nizova, rekorda i XP-a. Preporuka za prvi scope: nema novog admin sustava retroaktivnih korekcija; agent ipak mora utvrditi postoje li takve akcije danas.

11. **Kako prikazujemo bonus korisniku na maksimalnoj razini?** Preporuka: pokazati obračunati bonus i jasno navesti da cap ograničava stvarno dodavanje XP-a. Bez nove prestige valute ili razina u ovom zadatku.

### C. Migracija i aktivacija

12. **Računamo li trenutne i najbolje nizove iz postojeće povijesti ili kreću od objave?** Preporuka: rekonstruirati iz potpune javne povijesti; bonus isplaćivati samo za nove partije. Agent treba provjeriti kvalitetu podataka prije obećanja backfilla.

13. **Kako aktivirati dnevni limit usred dana?** Preporuka: uključiti već odigrane današnje javne dvoboje ako ih možemo pouzdano rekonstruirati; u suprotnom aktivirati od sljedeće lokalne ponoći. Treba li staging imati zasebnu testnu aktivaciju?

14. **Treba li povijesni završni ekran dobiti novi blok forme/niza i za stare partije?** Preporuka: stabilni snapshot za nove rezultate; stare označiti bez podataka ili rekonstruirati samo ako je pouzdano. Retroaktivni snapshotovi proširuju migraciju.

### D. Prikaz i dizajn

15. **Prikazujemo li vatru u privatnim sobama?** Preporuka: ne u prvom scopeu, jer privatna nema jednoznačan javni mod. Ako da, izabrati izvor: dvoboj, četvero ili eksplicitno odabrani niz; obavezna oznaka odakle dolazi.

16. **Koliko detalja vide drugi na javnom profilu?** Preporuka: forma, trend, mini povijest ishoda, trenutni i najbolji niz, bez protivničkih identiteta u popoveru i bez osobnog XP obračuna. Je li takav javni prikaz željen?

17. **Želimo li statičnu vatru ili animaciju u prvoj verziji?** Preporuka: statična, tri razine i obrub, bez pomicanja rasporeda. Animacija je dizajnerski dodatak koji traži mobile/reduced-motion provjeru.

18. **Gdje prikazati novu formu kad je DNK zaključan?** Preporuka: u istoj kartici ispod zaključanog DNK-a; početna forma nakon pet igara, povijest i niz od prve. Time ne zaključavamo niz i XP iza deset igara.

### E. Opseg isporuke

19. **Je li dovoljna postojeća povijest s popoverima ili se očekuje novi ekran detalja partije?** Preporuka: postojeća povijest i popoveri za ovaj zadatak. Novi detalj/replay zaseban je dodatak.

20. **Koje postojeće DNK/XP nedosljednosti moramo popraviti u istom releaseu?** Agent treba donijeti konkretne aktualne nalaze. Preporuka: uključiti ono što je nužno za ispravan mod i konačan XP obračun; širi redizajn DNK-a odvojiti.

21. **Što točno znači završena isporuka: lokalni kod i testovi, PR ili staging objava?** Dogovoriti cilj, dopuštene grane i postojeći release postupak. Produkcijska objava ostaje zasebna odluka.

22. **Koje operativne podatke zadržavamo i koliko dugo?** Preporuka: samo ono što treba za dnevni limit, oporavak rezervacija i provjeru obračuna; zbirna analitika bez javnog izlaganja adresa. Agent treba predložiti konkretne rokove prema stvarnom modelu i backupima, bez nove nepotrebne trajne evidencije mreža.

### Kako agent treba završiti pripremu

Nakon odgovora vratiti kratku tablicu: odluka, odabrano ponašanje, pogođene komponente, test prihvata. Navesti što ulazi u prvi release i što je odgođeno. Tek zatim započeti implementaciju dogovorenog scopea.

## Referentna osnova

Specifikacija se temelji na dogovoru u razgovoru i ranijem pregledu repozitorija, ne na novom auditu koda tijekom pisanja dokumenta. Referentni pregled bio je na commitu 67068041e1f304e84755bdbcd112be56b09eafaa. Aktualni kod agent mora ponovno provjeriti.

- Repozitorij: https://github.com/josipmestrovic/kaladont
- Referentni commit: https://github.com/josipmestrovic/kaladont/commit/67068041e1f304e84755bdbcd112be56b09eafaa
- DNK: https://github.com/josipmestrovic/kaladont/blob/67068041e1f304e84755bdbcd112be56b09eafaa/paketi/zajednicko/src/dnk.ts
- Upis rezultata: https://github.com/josipmestrovic/kaladont/blob/67068041e1f304e84755bdbcd112be56b09eafaa/aplikacije/posluzitelj/src/igra/upis-partije.ts
- Shema: https://github.com/josipmestrovic/kaladont/blob/67068041e1f304e84755bdbcd112be56b09eafaa/aplikacije/posluzitelj/src/baza/shema.ts
