# Kaladont — PR03 v2: sustav misija i potvrda dovršetka

**Datum:** 4. studenoga 2026.  
**Predložena grana:** `feat/misije-backend`  
**Produktni izvor istine:** `Kaladont_Misije_katalog_i_dizajn_v2.md` — obvezno pročitati uz ovaj dokument.  
**Nastavak:** `Kaladont_PR04_frontend_misija_v2.md`.  
**Pregledana baza:** [646c00c3b3a00b4681156d2ef54bbe00b8f9f171](https://github.com/josipmestrovic/kaladont/commit/646c00c3b3a00b4681156d2ef54bbe00b8f9f171), 4. 11. 2026.

Ovo zamjenjuje priloženi stari PR03. Najvažnije promjene: **20 + 20 predložaka; do 3 prenosive dnevne; 3 tjedne; 200/2.000 XP; pobjedničke i trening-misije; nema novog „Majstora misija”.** Stari model „jedna dodjela po vrsti i razdoblju” više nije valjan.

Dokument specificira buduću implementaciju. Kod repozitorija u ovom zadatku nije mijenjan, a niže navedeni novi DTO-ovi i servisi još ne postoje.

## 0. Uputa agentu i podjela isporuke

1. Osvježi `main`, pročitaj važeće upute repozitorija i provjeri stanje prethodnih PR-ova. Pregledana baza već sadrži PR02, ali ne pretpostavljaj da je kasniji `main` isti.
2. Pročitaj sva tri v2 dokumenta. Najnovije korisnikove odluke imaju prednost pred starim specifikacijama. Ne vraćaj 7 + 7 predložaka, jednu tjednu ili zabranu svih trening-misija.
3. Prije kodiranja predstavi sažet plan: shema, kalendarski dotok, zamjene, izvor svake metrike, javni/trening obračun, XP/DTO i ciljani testovi. Navedi konkretne otvorene tehničke rizike.
4. Radne preporuke iz kataloga koristi kao početni dizajn. Ne postavljaj ponovno sva riješena produktna pitanja. Pitanje vlasniku treba konkretan razlog: promjena ponašanja, ekonomije ili opsega.
5. Implementiraj ovaj PR nakon uobičajenog dogovora o planu. Ne objavljuj na produkciju niti zaobilazi postojeći CI.

**Prilagodba podjele rada:** PR03 uz backend uključuje **minimalan prikaz misija i konačnog XP-a na završnom ekranu**. To je mali nužan dio korisnikova zahtjeva da odmah vidi što je postigao. PR04 zatim gradi `/misije`, navigaciju, kartice i zamjene. Ne duplicirati završni obračun ili dvije različite implementacije sažetka u oba PR-a.

## 1. Opseg

### Obvezno

- Centralni, verzionirani katalog D01–D20 i W01–W20 iz produktnog dokumenta.
- Dnevni dotok jedne misije, kapacitet tri, prijenos bez isteka i kontrolirana nadoknada tijekom odsutnosti.
- Tri tjedne dodjele po ciklusu ponedjeljak–ponedjeljak; dovršene zauzimaju svoj tjedni položaj do reseta.
- Jedna zamjena po vrsti i lokalnom danu, zajednička svim karticama te vrste.
- Osobne metrike iz dopuštenih javnih igara te trening-pobjeda za D10/W10.
- Jednokratni misijski XP u pouzdanoj transakciji, uz postojeći cap i konačnu razinu.
- Tipizirani GET, zamjena po **ID-u dodjele**, završni osobni payload i trajni rezultat za retry/reconnect.
- Minimalan završni UI za javnu igru i trening; bez stranice `/misije` u ovom PR-u.
- Migracije, brisanje računa, ciljani testovi, postojeći CI i dokumentacija.

### Izvan opsega

Puna stranica i navigacija PR04; PR05 „Stalno si tu”; novi „Majstor misija”; novi rangovi ili promjena formule razina; privatne misije; rezervne ideje R01–R30; valute/predmeti; ručno preuzimanje nagrade; personalizirana težina i novi analitički sustav.

## 2. Produktne invarijante

| Pravilo | Obvezno ponašanje |
|---|---|
| Dnevne | `0..3` aktivne; najviše jedna nova dodjela po lokalnom datumu, osim zamjene koja ne povećava broj mjesta. |
| Tjedne | Točno 3 položaja u tekućem ciklusu; svaki s jednom trenutačnom dodjelom, aktivnom ili dovršenom. |
| Kapacitet | Dnevna dovršena oslobađa mjesto, ali ne izaziva trenutnu dopunu. Tjedna dovršena ostaje do ponedjeljka. |
| Nagrade | Nominalno 200 XP dnevna, 2.000 XP tjedna; snapshot pri dodjeli. Jedna isplata po `dodjelaId`. |
| Kvota `×` | Jedna dnevna i jedna tjedna zamjena po `Europe/Zagreb` datumu, ne po kartici. |
| Zamjena | Drugi dopušteni predložak, nula napretka, isti položaj i vrsta. Završena se ne mijenja. |
| Više ciljeva | Jedna igra može pomoći svim odgovarajućim dodjelama. Nikakav izbor „aktivno praćene” misije. |
| Pristup | Registriran/admin ljudski račun; gost, bot i obrisan račun ne dobivaju misijski progres/XP. |
| Izvori | Javne igre za sve osim D10/W10; samo te dvije prihvaćaju trening-pobjedu. Privatne ne napreduju. |
| XP usporedbe | Misijski XP ne utječe na partijski `brutoIskustvo`, bodove, ocjenu, DNK, formu ni pohvalu „XP prvak”. |
| Povijest | Ponovni GET, retry završetka, reconnect ili novi proces ne mijenjaju već priznati rezultat. |

Postojeći „Zagrijan” i „Iskusnjara” rade dalje. Novi achievement za broj misija nije dio ovog PR-a.

## 3. Katalog i izvor metrika

U `paketi/zajednicko/src/misije.ts` ili odgovarajućem modulu centralizirati definicije: `predlozakId`, `vrsta`, `verzijaDefinicije`, `naziv`, `opis`, `metrika`, `cilj`, eventualni podciljevi, `xp`, `obitelj`, `zahtjevnija`, `konteksti`, `modovi`, `aktivna`.

Brojevi ciljeva točno su u tablicama produktnog dokumenta. Ne uvoditi drugi ručno održavani katalog na klijentu. D01/W01 i ostali zadržavaju vlastite stabilne ID-ove; promjena semantike ili cilja znači novu verziju definicije, ne prepisivanje stare dodjele.

### 3.1. Normalizirani serverski sažetak jedne igre po igraču

```ts
interface MetrikeMisijaIgre {
  izvorId: string; // stvarni partijaId ili treningId iz motora
  kontekst: 'javna' | 'trening';
  mod: 'dva_igraca' | 'cetiri_igraca';
  igracId: string; // iskljucivo serverski identitet
  zavrsenoU: Date; // stabilno kroz retry
  plasman: number;
  nacinIspadanja: string; // u implementaciji koristiti postojeci union
  prihvaceneRijeci: number;
  najduziNiz: number;
  dugeRijeci: number;          // >=10 grafema, sva tri tiera duljine
  jakoDugeRijeci: number;      // >=15 grafema
  rijetkeRijeci: number;       // svaki prihvaceni oblik, svi tierovi
  jakoRijetkeRijeci: number;
  dugeIRijetkeRijeci: number;  // oba svojstva u ISTOM potezu
  eliminacije: number;
  kaladontIzvedbe: number;
  razlicitiPoceci: string[];   // prvaDva(rijec), normalizirani skup
}
```

Tip je nacrt ugovora, ne nalog da se bez razmišljanja uvede svako polje za svaki kontekst. Treningu za D10/W10 trebaju identitet, ishod, prihvaćeni potezi i vrijeme; ostale metrike treninga ne treba umjetno proizvoditi.

### 3.2. Pravila brojanja

| Metrika / misije | Agregacija i izvor |
|---|---|
| D01/D07/D11, W01/W11/W12 | +1 po kvalificiranoj dovršenoj igri odgovarajućeg moda. Rani poraz nije terminalni završetak stola. |
| D08/D09, W08/W09 | +1 samo `plasman === 1`, uz točan javni mod. Pobjeda protiv javnog bota vrijedi. |
| D10/W10 | +1 po zasebnoj autoritativnoj pobjedi u kontekstu `trening`; javni Dvoboj protiv bota nije trening. |
| D19/W19 | +1 samo javni Četveroboj i plasman 1 ili 2; Dvoboj ne vrijedi iako ima drugo mjesto. |
| D02/W02 | Zbroj stvarnih prihvaćenih poteza čovjeka; ne zahtijeva novi leksem u kolekciji. |
| D03 | `max(stariNapredak, najduziNizJednePartije)`, cilj 3. Pogreška prekida tekući niz prema motoru, ali ne briše raniji najbolji niz. |
| D04 | Maksimum osobnog broja prihvaćenih riječi u jednoj partiji, cilj 5. |
| W03 | +1 po različitoj partiji s `najduziNiz >= 5`, cilj 3 partije; niz 10 u jednoj i dalje daje +1. |
| D20/W07 | +1 po partiji s ≥3 odnosno ≥5 osobnih riječi; ciljevi 2 odnosno 8 partija. |
| D05/W04 | Zbroj svih prihvaćenih riječi s ≥10 grafema. Postojeći brojači duljine su disjunktni: zbrojiti duge + srednje duge + jako duge. |
| D15/W15 | Zbroj prihvaćenih riječi s ≥15 grafema. |
| D06/W05, D16/W16 | Broj stvarno odigranih rijetkih/jako rijetkih oblika. Postojeći `otkrivene*Grupe` broje nove grupe i nisu odgovarajuća metrika. |
| D17/W17 | Po jedan za potez koji je i dug i rijedak. Jedna duga i druga rijetka riječ ne ispunjavaju ovaj cilj. |
| D13/W13 | Brojač eliminacija pripisanih ovom igraču u motoru, bez vlastitog tumačenja iz plasmana protivnika. |
| D14/W14 | Postojeća serverska `kaladontIzvedbe` delta ili ekvivalentan valjan događaj. Ne provjeravati samo sadrži li string „kaladont”. |
| D18/W18 | Unija `prvaDva()` vlastitih prihvaćenih riječi kroz kvalificirane igre; cilj 5/20 različitih početaka. Isti početak vrijedi jednom. |
| D12/W20 | Dva odvojena brojača modova, svaki ograničen svojim ciljem 1/5. Ukupni progres je zbroj ograničenih podciljeva 0..2/0..10. |
| W06 | Skup lokalnih datuma iz `zavrsenoU` kvalificiranih javnih igara te dodjele; cilj 3. Nisu uzastopni dani niti login-streak. |

Rijetkost računati postojećim `tierRijetkostiIskustva`, duljinu preko `grafemi`/`PRAGOVI_DULJINE`. `nj`, `lj`, `dž` i iznimke parsera moraju ostati ispravni. Ne koristiti UTF-16 `.length` niti broj novih kolekcijskih oznaka. Riječ koja je već odigrana u nekoj ranijoj partiji vrijedi ponovno ako je sada prihvaćena; različitost se traži samo tamo gdje je izričito navedena.

Rijetkost, duljinu i početak snapshotirati pri prihvaćanju poteza. Reload rječnika prije konačnog spremanja ne smije promijeniti ono što se dogodilo. Set početaka može se ograničiti na dovoljno podataka za najveći cilj 20, uz dokaz da unija i dalje daje točan capped napredak.

### 3.3. Kvalificirani sudionik

Kontekst i mod dolaze iz autoritativnog motora. Za misije se dodatno traži barem jedan vlastiti prihvaćeni potez i da sudionik nije završio kao `prekid`. Normalno ispadanje/poraz ostaje prihvatljivo za nepobjedničke ciljeve. Tehničko poništenje, restartom poništen stol i trening zatvoren zbog neaktivnosti nisu pobjeda niti završena misija. Ovaj filter ne mijenja stare XP/achievement/statističke politike.

## 4. Kalendar, dotok i odsutnost

Koristiti postojeći `kalendarskeGranice()` iz `paketi/zajednicko/src/ljestvice.ts` i `Europe/Zagreb`. Ne uvoditi paralelan izračun preko UTC datuma ili `24 * 60 * 60 * 1000`.

### 4.1. Dnevne dodjele

Čuvati početak sudjelovanja u misijama i zadnji obrađeni lokalni datum dotoka. Inicijalna dodjela jedna je za dan uključivanja; nema backfilla prije uključivanja sustava ili registracije.

Za svaki još neobrađeni lokalni dan nakon inicijalizacije:

1. Razmotri njegovu ponoć i tadašnji raspoloživi kapacitet.
2. Ako ima mjesta, kreiraj jednu novu dodjelu i zabilježi da je dotok potrošen.
3. Ako je zaliha puna, zabilježi preskakanje/napreduj watermark. Ne stvaraj „dug” za poslije.
4. Ne resetiraj postojeće dnevne i ne mijenjaj njihove snapshot vrijednosti.

Dok igrač nije aktivan, kapacitet se ne oslobađa sam od sebe. Zato višemjesečna odsutnost ne zahtijeva tisuće dodjela: nadopuniti najviše do tri, potom sigurno preskočiti ostatak raspona. Audit može biti pojedinačni zapis ili dokaziv watermark s poviješću promjena kapaciteta; ne iterirati neograničeno kroz sve dane i stare partije na svakom GET-u.

**Važan redoslijed:** kad zaliha ima tri misije, a igra završi točno u ponoć, prvo se provede dotok za novu ponoć prema zauzetosti prije tog završetka — preskače se — a zatim obračun igre može osloboditi mjesta. Sljedeća nova stiže iduće ponoći. To sprječava ovisnost o redoslijedu HTTP zahtjeva.

Dnevna dodjela ima `istjeceU = null`; `sljedeciDotokU` pripada skupini, ne pojedinoj kartici. Dovršavanje i zamjena nisu nove dnevne dodjele za potrebe ograničenja dotoka.

### 4.2. Tjedne dodjele

Jedan paket po `(igracId, pocetakTjedna)` s položajima 1, 2, 3. Interval `[od, do)`. Na novom ciklusu stari paket prelazi u povijest i nastaje novi paket od tri; ni dnevne ni pravo zamjene ne ovise o broju dovršenih tjednih.

Pri prvom dolasku usred tjedna kreirati samo tekući paket. Feasibility W06 ocijeniti prema trenutku kada novi zadatak stvarno postaje raspoloživ, ne pretvarati nedjeljni prvi posjet u ponedjeljak. Tjedne koje su već ranije dodijeljene zadržavaju svoj postojeći napredak.

### 4.3. Pokretanje i granice događaja

- Osiguravanje stanja pozvati pri autentificiranom ulasku/GET-u i prije relevantne javne igre ili treninga. Korisnik ne mora posjetiti `/misije` da bi mu se računala prva igra.
- Završni obračun ima idempotentni fallback za dotok do stabilnog `zavrsenoU`.
- Napredak pripada misijama koje su valjano raspoložive u trenutku **završetka igre**. Igra započeta prije ponoći može pomoći tada nastaloj novoj dnevnoj; stara sačuvana dnevna također može napredovati.
- Igra završena točno u ponedjeljak 00:00 pripada novom tjednom paketu. Stari tjedni paket za taj događaj ne raste. Ne dijeliti poteze jedne igre na dva tjedna.
- Zamjena je izuzetak od redovnog kalendarskog dotoka: ne smije dati novoj dodjeli igru koja je završila **prije** nego što je zamjena postala raspoloživa. Ne prebrojavati ranije završene igre pri GET-u.
- Kvota zamjena resetira se svake lokalne ponoći i kad tjedni paket ostaje isti.

### 4.4. Odgođeni obračun nije novi događaj

`zavrsenoU`, identitet izvora i dodjele koje događaj smije obraditi moraju biti stabilni kroz retry. Posebno pokriti završetak u nedjelju 23:59:59, zatim GET novog tjedna, pa ponovljeni DB pokušaj u ponedjeljak. Stari događaj ne smije progresirati novi paket ili izgubljenu dodjelu pretvoriti u drugu nasumičnu nagradu.

Agent u planu mora dati konkretan način serijalizacije: trajni zapis završnog događaja/snapshota i zaključavanje stanja ili ekvivalent koji čuva pravilan poredak. Prije konfliktnog dotoka/zamjene razriješiti poznati nedovršeni završni obračun; ako to trenutačno nije moguće, vratiti kratko stanje `OBRACUN_U_TIJEKU`, umjesto premještanja starog događaja na današnje misije. Ne treba novi message broker ni opći event-sourcing projekt.

Za običnu utrku zamjene i aktualne igre oba serijalizirana poretka su dopuštena: obračun prvi može dovršiti staru i onemogućiti zamjenu; zamjena prva gasi staru i nova smije dobiti samo vremenski dopušten završetak. Ne primijeniti isti događaj na oba naraštaja istog mjesta. Čuvati povijesne dodjele za zakašnjele potvrde; ne vraćati kalendarski watermark unatrag. Ako agent ne može dokazati taj rubni slučaj odabranim modelom, to je tehnički bloker za merge, ne razlog za tiho prepisivanje proizvoda.

### 4.5. Egzaktni testni datumi

| Zagreb interval | UTC interval | Trajanje |
|---|---|---:|
| 04.11.2026. → 05.11.2026. | `2026-11-03T23:00:00Z` → `2026-11-04T23:00:00Z` | 24 h |
| 29.03.2026. → 30.03.2026. | `2026-03-28T23:00:00Z` → `2026-03-29T22:00:00Z` | 23 h |
| 25.10.2026. → 26.10.2026. | `2026-10-24T22:00:00Z` → `2026-10-25T23:00:00Z` | 25 h |
| Tjedan 23.03. → 30.03.2026. | `2026-03-22T23:00:00Z` → `2026-03-29T22:00:00Z` | 167 h |
| Tjedan 19.10. → 26.10.2026. | `2026-10-18T22:00:00Z` → `2026-10-25T23:00:00Z` | 169 h |

Testirati 1 ms prije, točno na i 1 ms poslije granice. Dvostruki lokalni 02:30 u jesenskom prijelazu ne daje dvije kvote/dodjele.

## 5. Generator i snapshot

Generator slijedi §6 kataloga: različiti predlošci i obitelji, najviše jedna zahtjevnija, barem jedna pristupačna u tjednom paketu, filtar W06 i dnevna preferencija nedavnih izbora. Za tjedni paket odabrati valjanu **cijelu kombinaciju**, a ne tri nepovezana izbora koji se poslije ne mogu uskladiti. Dvadeset predložaka dopušta jednostavno pretraživanje valjanih kombinacija, bez teškog optimizacijskog sustava.

Pri zamjeni promijeniti samo traženi položaj, uz ostala dva kao ograničenja. Dovršeni tjedni položaji ostaju dio paketa pri provjeri kombinacije. U dnevnoj zalihi gleda se aktivne dodjele. Prazan skup kandidata ne troši kvotu i ne briše staru misiju.

RNG injektirati za testove. Dobiveni izbor jednom zapisati; reconnect, ponovni GET, rollback-retry uz već potvrđen zapis i restart ne smiju nasumično mijenjati dodjelu. Snapshot uključuje cilj, podciljeve, XP, naziv/opis i verziju pravila. Naknadni tuning utječe samo na nove dodjele; aktivne dnevne bez isteka posebno se ne smiju nenajavljeno prepisivati.

## 6. Predloženi DB model i invarijante

Nazivi tablica su preporuka; invarijante su obvezne. PostgreSQL/Drizzle, nove migracije bez resetiranja postojećih podataka.

| Cjelina | Sadržaj i zaštite |
|---|---|
| `stanje_misija_igraca` | Jedan red po igraču; inicijalizacija, zadnji obrađeni dnevni datum, rastuća `verzijaStanja`; sigurno mjesto za zaključavanje. |
| `dotok_dnevnih_misija` ili ekvivalent | Jedinstven `(igrac_id, lokalni_datum)` za dodjelu/preskakanje, ili provjerljiv watermark; sprječava naknadno punjenje propuštene ponoći. |
| `ciklusi_tjednih_misija` | Jedinstven `(igrac_id, period_od)`; UTC početak/kraj, tri položaja. |
| `dodjele_misija` | UUID, vlasnik, vrsta, položaj 1..3, izvorni dotok/ciklus, predložak/verzija, snapshot cilja/nagrade/teksta, progres i podstanje, raspoloživost, završetak/zamjena/istek. |
| `zamjene_misija` | Jedinstven `(igrac_id, vrsta, zagrebacki_datum)`; stara i nova dodjela, vrijeme, idempotency key. |
| `doprinosi_misijama` | Jedinstven `(dodjela_id, kontekst_izvora, izvor_id)`; osobni snapshot primijenjenog napretka. |
| `nagrade_misija` | Jedinstven `dodjela_id`; nominalni i stvarni XP, vlasnik, izvor i vrijeme. I na capu postoji zapis sa stvarnim iznosom 0. |
| `ishodi_misija_igara` | Jedinstven `(igrac_id, kontekst_izvora, izvor_id)`; trajni osobni sažetak promjena i XP-a za ponovno slanje bez ponovnog računanja. |

### 6.1. Različita jedinstvenost dnevnih i tjednih

- Za dnevne može postojati najviše jedna **aktivna** dodjela po `(igrac_id, dnevni_slot)`; slot je 1..3. Dovršene i zamijenjene se čuvaju kao povijest i više ne zauzimaju aktivni slot.
- Za tjedne može postojati jedna trenutačna dodjela po `(ciklus_id, slot)`, status aktivna **ili dovršena**. Zamijenjene su povijest.
- Jedan običan `UNIQUE(igrac_id, vrsta, period_od)` je pogrešan: ne dopušta tri misije ni povijest zamjena.
- Za tekuće dnevne spriječiti duplikat predloška; za tjedne dodatno zabrana ponovnog dodjeljivanja već korištenog predloška u tom ciklusu. Kombinacijska pravila provjeriti pod istim zaključavanjem.
- Invarijante: `cilj > 0`, `0 <= napredak <= cilj`, slot 1..3, snapshot nepromjenjiv, tjedni `period_od < period_do`, dnevni istek `NULL`, dosljedni status/timestampovi. Ne ograničavati ukupni broj povijesnih dnevnih redova na tri.

### 6.2. Izvori treninga nisu javne partije

`pobjede_treninga.trening_id` već je UUID PK i **nema** obvezni FK na `partije`; trening ne zapisuje redovne partije. Zato `doprinosi_misijama.izvor_id` ne smije bezuvjetno referencirati javnu tablicu `partije`.

Koristiti diskriminirani izvor (`javna` / `trening`) s provjerom odgovarajućeg trajnog claima, odvojene FK stupce s CHECK pravilom ili zajednički trajni zapis izvora. U planu navesti jednu konkretnu izvedbu. Ne stvarati lažne javne partije radi zadovoljavanja FK-a.

### 6.3. Identitet, zadržavanje i brisanje

Sve osobne misijske tablice uključiti u postojeći soft-delete tok `racuni/brisanje.ts`. Sam FK cascade nije dovoljan ako se red igrača ne briše fizički. Riješiti redoslijed brisanja audita, nagrada, dodjela i stanja; ne dodijeliti XP računu koji je u međuvremenu obrisan. Zadržati postojeću politiku povijesnih agregata partija. Migrate-upgrade test mora sačuvati stare XP, rangove, kolekcije i dostignuća.

## 7. Transakcije, zaključavanje i zamjena

Svi tokovi koji mijenjaju stanje istog igrača — dotok, zamjena, javni obračun, trening i brisanje računa — moraju koristiti usklađen poredak zaključavanja. Zaključati igrača/stanje prije čitanja kvote i XP-a. Više sudionika javne partije zaključavati sortirano po ID-u. Osigurati i utrku stvaranja prvog state reda; in-memory mutex nije zaštita između procesa.

### Zamjena

1. Autorizirati igrača iz Bearer sesije. Validirati UUID dodjele i idempotency key.
2. U transakciji zaključati igrača i osvježiti valjani kalendar/riješiti eventualni raniji završni događaj.
3. Ponovno pročitati **točnu dodjelu**: vlasnik, status, ciklus, generacija, kvota i raspoloživi kandidati.
4. Odabrati drugu valjanu definiciju; označiti staru kao zamijenjenu; upisati novu u isti slot s napretkom nula i stabilnim aktivacijskim trenutkom.
5. Upisati kvotu i rezultat zahtjeva; povećati `verzijaStanja`; commit.
6. Vratiti cijelo aktualno stanje za UI.

Ne uspije li bilo što, stara dodjela/napredak i kvota ostaju. Dva paralelna zahtjeva za **različite** tjedne kartice isti dan također smiju proizvesti samo jednu zamjenu. Tuđi ID ne smije otkrivati podatke o vlasniku; vratiti 404. Dovršena kartica je 409. Zahtjev koji ponavlja isti idempotency key i isti sadržaj vraća spremljeni rezultat, uključujući retry nakon ponoći; isti key s drugim tijelom je konflikt.

Endpoint tipa `/:vrsta/zamijeni` iz stare specifikacije nije dovoljan: više je aktivnih dodjela iste vrste. Zamjena mora imenovati dodjelu, a server iz nje izvodi vrstu i slot.

## 8. Integracija s javnim završetkom i treningom

### 8.1. Javne igre

`zakljuciPartijuUBazi()` u `igra/upis-partije.ts` već radi transakcijski claim javne partije. Progres i misijski XP uključiti **u tu transakciju**. Ne dodavati zasebno nagrađivanje u Socket.IO handler nakon commita.

Predloženi redoslijed:

1. Motor pripremi stabilan `zavrsenoU` i osobne metrike. Sačuva ulaz da retry ne append-a ni mijenja vrijednosti.
2. Jednom claimati izvor; ako je već obrađen, vratiti spremljeni osobni ishod.
3. Obračunati postojeći partijski XP/bonuse i pohvale neovisno o misijama. Snapshotirati `nakonPartije` prije misijskih nagrada.
4. Pod zaključavanjem osigurati raspoložive dodjele i za svaku novu audit vezu primijeniti zbroj, maksimum, skup ili podciljeve.
5. Za prijelaz u dovršeno jednom zapisati nagradu i promijeniti XP. Dnevno mjesto se oslobađa; tjedno ostaje dovršeno.
6. Izračunati konačnu razinu i postojeća dostignuća ovisna o razini. Spremiti osobni ishod s prije/poslije napretkom i stvarnim iznosima.
7. Commit pa emitiranje. Rollback ne smije ostaviti završenu misiju bez nagrade niti emitirati uspješnu isplatu.

Pregledani motor ručno dorađuje `mojeIskustvo` nakon DB poziva. Zato nije dovoljno samo povećati `igraci.iskustvo_ukupno`: konačna razina u UI-ju ostala bi bez misija. Također ne append-ati bonuse ponovno pri retryju. Potreban je rezultat zasnovan na potvrđenim snapshotima iz transakcije.

`spremiRaniPorazUBazi` nije mjesto za isplatu misija. Ispali igrač može napredovati nakon stvarnog završetka stola, a prerano prikazani/provizorni obračun ne smije glumiti završenu misiju.

### 8.2. Trening: obvezan poseban put

Pregledano stvarno stanje:

- `politika-ucinka.ts`: trening nema obični napredak, XP ni povijest partije.
- `motor-partije.ts`: trening ipak ima `partijaId`, konačni plasman i brojač prihvaćenih poteza.
- `trening/upis-napretka.ts`: `zabiljeziPobjeduTreninga(treningId, igracId)` već claim-a `pobjede_treninga` i u transakciji ažurira postojeći „Zagrijan”.

Nadograditi taj postojeći tok: stabilan `zavrsenoU`, kvalifikacija misije, snapshot misijskog napretka i XP isplata u **istoj transakciji** s trening-claimom. Izvući pomoćnu funkciju koja prima postojeći `tx` ako je potrebno; ne koristiti ugniježđenu neovisnu transakciju za XP.

**Važne razlike:**

- Ne uključivati `dajeNapredak: true` za trening. Time bi se nenamjerno otvorili bodovi, rangovi, forma i osnovni XP.
- Samo D10/W10 smiju napredovati. Trening-pobjeda ne smije pomoći D09/W09 zato što izgleda kao 1v1.
- I bez običnog XP-a trening smije dodati 200/2.000 XP dovršene misije. Ukupna razina i „Iskusnjara” moraju se uskladiti.
- Postojeći „Zagrijan” ostaje prema postojećem pravilu; novi minimum jednog prihvaćenog poteza odnosi se na misije i ne mijenja ga potajno.
- Ponovljeni `treningId` ne daje novu pobjedu, progres ni XP. Trenutačni povrat `null` kod duplikata treba dopuniti čitanjem stabilnog misijskog ishoda kad se ponavlja dostava rezultata.
- Trenutačni motor hvata grešku spremanja trening-napretka i ipak prelazi u `rezultati_spremljeni`. S novim XP-om ne smije potvrditi nagradu nakon te greške. Uvesti kontrolirani retry/stanje spremanja i emitirati misijsku potvrdu tek nakon commita.
- Ako trening pobjeda završi u nedjelju, DB retry u ponedjeljak koristi izvorni završetak. Postojeći `DEFAULT now()` nije dovoljan kao jedini poslovni timestamp.

## 9. XP: odvojeni izvori i jedno konačno stanje

Nominalna nagrada se ne množi nizom, ocjenom igre ili pobjedničkim bonusom. Nije dio `StavkaIskustva` za partijske usporedbe i ne ulazi u `sudionici_partije.iskustvo` ako to polje označava partijski rezultat.

Prvo primijeniti postojeći partijski XP, zatim misije. Deterministički red misija blizu capa: dnevne po vremenu dodjele pa ID-u, zatim tjedne po slotu pa ID-u. Za svaku:

```text
stvarno = min(nominalno, max(0, MAKSIMALNO_ISKUSTVO - trenutnoUkupno))
```

Sačuvati nominalni i stvarni iznos. Na capu je misija dovršena i ledger postoji iako je stvarni XP 0. Jedna igra može završiti više misija, najviše šest trenutačnih, pa DTO ne smije imati fiksna polja „jedna dnevna + jedna tjedna”.

Konačne jednakosti za jedan potvrđeni osobni obračun:

```text
nakonPartije.ukupno - prije.ukupno = partijskiXpStvarno
poslije.ukupno - nakonPartije.ukupno = misijskiXpStvarno
ukupnoXpStvarno = partijskiXpStvarno + misijskiXpStvarno
misijskiXpStvarno = zbroj stvarnih nagrada ovog izvora
```

`prije` mora biti stvarno zaključano DB stanje za taj obračun, ne zastarjela vrijednost iz početka igre ako je u međuvremenu spremljen drugi izvor. Za trening je `partijskiXpStvarno = 0`, `nakonPartije = prije`.

Postojeća „Iskusnjara” mora prepoznati i skok preko više razina zbog misija; spojiti obavijesti po ID-u na najvišu novu razinu, bez dvostrukog toasta. Ne uvoditi vlastitu formulu levela. Puni izračun ekonomije je u katalogu: 7.400 XP novih dodjela po punom tjednu, bez računanja eventualno prenesenih dnevnih.

## 10. API i zajednički DTO za PR04

Nazivi u nastavku čine predloženi ugovor. Agent ga može uskladiti s konvencijama repozitorija prije implementacije, ali PR04 mora dobiti **jedan konačan tip**, primjer odgovora i tablicu grešaka. Nije dopušteno zasebno izmišljanje ugovora na klijentu.

```ts
interface MisijaDto {
  dodjelaId: string;
  slot: 1 | 2 | 3;
  vrsta: 'dnevna' | 'tjedna';
  predlozakId: string;
  verzijaDefinicije: number;
  status: 'aktivna' | 'dovrsena';
  naziv: string;
  opis: string;
  metrika: string; // implementirati kao zatvoreni union kataloga
  kontekst: 'javna' | 'trening';
  mod: 'oba' | 'dva_igraca' | 'cetiri_igraca';
  napredak: number;
  cilj: number;
  podciljevi?: { kljuc: string; naziv: string; napredak: number; cilj: number }[];
  xpNagrada: number;
  dostupnaOdIso: string;
  istjeceU: string | null; // dnevna null
  zavrsenaU: string | null;
  nagrada: null | {
    xpNominalno: number;
    xpStvarnoDodijeljeno: number;
    dodijeljenaU: string;
  }; // iz trajnog ledgera; null dok nije dovrsena
  zamjena: { dopustena: boolean; razlog: string | null };
}

interface StanjeMisijaDto {
  ok: true;
  stanjeVerzija: number;
  serverVrijemeIso: string;
  vremenskaZona: 'Europe/Zagreb';
  obracunUTijeku: boolean;
  /** Za PR04 main-menu popup: true ako ima nerazgledanih novih dodjela/paketa. */
  novosti: { dnevne: boolean; tjedne: boolean };
  dnevne: {
    kapacitet: 3;
    aktivne: MisijaDto[]; // 0..3, bez dovrsenih
    danasDovrsene: MisijaDto[]; // prikaz/audit, ne zauzimaju mjesta
    sljedeciDotokU: string;
  };
  tjedne: {
    pocetakIso: string;
    krajIso: string;
    misije: MisijaDto[]; // 3 u uspjesno inicijaliziranom paketu
  };
  zamjene: Record<'dnevna' | 'tjedna', {
    preostalo: 0 | 1;
    obnovaU: string;
  }>;
}
```

`danasDovrsene` i dovršene tjedne nose stvarnu `nagrada` iz ledgera, da stranica može prikazati točan dokaz isplate i na XP capu. `zavrsenaU` označava stabilni poslovni trenutak dovršetka, a `dodijeljenaU` stvarno knjiženje; kalendarski prikaz dovršetka koristi prvo. Nema zahtjeva za punom stranicom povijesti svih misija u v2.

### Rute

- `GET /api/misije`: auth, idempotentno osiguravanje dotoka i aktualno osobno stanje. `Cache-Control: private, no-store`. Ne cacheirati korisnički progres u zajedničkom CDN-u.
- `POST /api/misije/:dodjelaId/zamijeni`: idempotency key u zaglavlju ili tipiziranom bodyju; samo ID i ključ zahtjeva. Ne prihvaćati klijentski `igracId`, predložak, progres, cilj, nagradu ili vrijeme. Vratiti cijeli `StanjeMisijaDto`. Semantika je **zamjena/recycle**, ne brisanje mjesta.
- `POST /api/misije/pregled`: body `{ skupina: 'dnevna' | 'tjedna' }`; označi pregledano (`zadnji_pregled_*_u`); gasi odgovarajući `novosti.*`. Za PR04 popup dismiss. Zamjena/dovršetak ne forsiraju ponovni popup — samo novi dnevni dotok ili novi tjedni ciklus.
- Ako postojeći reconnect nema trajni dohvat osobnog rezultata, dodati mali autentificirani `GET /api/misije/ishod/:kontekst/:izvorId` ili uklopiti isto u postojeći rezultatni endpoint. Čita spremljeni vlastiti ishod, bez ponovnog obračuna i bez dodjele današnjih misija za staru igru.

| Status / kod | Značenje |
|---|---|
| 400 `NEVALJAN_ZAHTJEV` | Neispravan ID, ključ ili tijelo. |
| 401 `PRIJAVA_POTREBNA` | Nevažeća/istekla autentikacija. |
| 403 `REGISTRACIJA_POTREBNA` | Valjan gost; registracija je potrebna za misije. Bot također nema pravo, prema postojećem auth stilu. |
| 404 `MISIJA_NIJE_PRONADENA` | Nepostojeći ili tuđi ID, bez razlike koja otkriva vlasnika. |
| 409 `MISIJA_DOVRSENA` / `MISIJA_NIJE_AKTIVNA` | Dovršena, zamijenjena ili iz starog tjedna. |
| 409 `ZAMJENA_ISKORISTENA` | Potrošena današnja kvota te vrste. |
| 409 `NEMA_ALTERNATIVE` | Nema valjanog drugog predloška; kvota nije potrošena. |
| 409 `IDEMPOTENCY_KONFLIKT` | Isti ključ upotrijebljen s drukčijim zahtjevom. |
| 409 `OBRACUN_U_TIJEKU` | Poznati završni događaj mora biti razriješen prije ove mutacije. |
| 429 | Postojeći rate limit; vrati smislen retry podatak ako sustav to podržava. |
| 503 `MISIJE_NEDOSTUPNE` | Privremena greška; nije lažno prazna zaliha. |

### Završni payload

```ts
interface PromjenaMisije {
  dodjelaId: string;
  predlozakId: string;
  vrsta: 'dnevna' | 'tjedna';
  naziv: string;
  opisNapretka: string;
  prije: number;
  poslije: number;
  cilj: number;
  podciljeviPoslije?: MisijaDto['podciljevi'];
  upravoDovrsena: boolean;
  xpNominalno: number;          // 0 ako nije dovrsena ovim izvorom
  xpStvarnoDodijeljeno: number; // 0 i na capu
}

interface UkupnoIskustvoIshoda {
  prije: StanjeIskustva;
  nakonPartije: StanjeIskustva;
  poslije: StanjeIskustva;
  partijskiXpStvarno: number;
  misijskiXpNominalno: number;
  misijskiXpStvarno: number;
  ukupnoXpStvarno: number;
}

// Kompatibilna prosirenja KrajPartije:
// promjeneMisija?: PromjenaMisije[];
// ukupnoIskustvo?: UkupnoIskustvoIshoda;
// misijeStanjeVerzija?: number;
```

`mojeIskustvo` zadržava značenje partijskog obračuna. `ukupnoIskustvo` je konačni prikaz globalne razine nakon oba izvora. Trening može imati `mojeIskustvo: null` i istodobno valjan misijski sažetak/`ukupnoIskustvo`.

U niz staviti samo stvarno promijenjene dodjele. Snapshot vezati uz korisnika i izvor, ne slati tuđe misije cijeloj sobi. Reconnect vraća iste promjene i iste nagrade, ne trenutno stanje misije iz neke kasnije igre. `stanjeVerzija` omogućuje klijentu odbacivanje zastarjelih odgovora; globalni endpoint i povijesni rezultat imaju različitu svrhu.

## 11. Minimalni rezultatni UI u ovom PR-u

Dodati mali `NapredakMisijaPartije.svelte` ili ekvivalent te kompatibilno prilagoditi `IskustvoPartije.svelte`/roditeljski ekran za konačnu razinu. Detaljni vizualni zahtjevi su u PR04, ali ovaj minimum mora raditi odmah:

- Nakon postojećeg partijskog XP-a, prije pohvala, jedan blok „Misije”. Dovršene stavke prve, zatim ostali stvarni pomaci.
- „Misija završena!” + naziv + stvarni XP. Za nedovršenu `prije → poslije / cilj`; bez lažne nagrade.
- Jedan konačni level/progress prikaz iz `ukupnoIskustvo.poslije`, uz razdvojene iznose „Iz igre” i „Iz misija”. Ne računati zbroj ponovo u browseru.
- Radi i za trening: osnovni XP ostaje 0, misijski je zasebno vidljiv. Ako nema promjene misija, nema praznog bloka.
- Na capu piše završeno, uz stvarni iznos 0 i objašnjenje najveće razine; ne „Dodano +2.000 XP”.
- Najviše jedan vizualni efekt za potvrđeni izvor; replay može prikazati isti sažetak bez nove čestitke.
- Nema `Preuzmi`, stranice `/misije`, konfiguriranja poola ili nove navigacije u ovom PR-u.
- Čuvati postojeći redoslijed ostalih blokova PR02 i oba panela prijava na dnu gdje su već predviđeni. Ne dodavati prijavu privremenog trening-bota ako to postojeći UI nema.

PR04 preuzima ovu komponentu i dorađuje pristupačnost/izgled u sklopu cijele funkcije, bez ponovne implementacije XP-a.

## 12. Obvezna testna matrica

Scenariji nisu nalog za isti broj sporih testnih datoteka. Parametrizirani unit testovi za 40 definicija, stvarni PostgreSQL za transakcije, mali reprezentativni Socket.IO/UI tokovi.

| Skup | Scenariji koje treba dokazati |
|---|---|
| Katalog | Točno 20 D + 20 W; ID-ovi jedinstveni; svi ciljevi pozitivni; svaki D=200, W=2.000; D08/D09/D10 i W08/W09/W10 imaju korisnikove ciljeve. |
| Metrike | Sum/max/set/podciljevi; nizovi iz dviju partija se ne spajaju; W03/W07 +1 po igri; D17 traži ista dva svojstva u istom potezu. |
| Riječ | Digrafi/iznimke; 10/12/15 grafema; svi tierovi rijetkosti; ponovljena poznata rijetka riječ vrijedi; reload rječnika ne mijenja snapshot. |
| Raznolikost | Ponovljeni početak ne raste; `prvaDva` radi s nj/lj/dž; W20 deset istih modova ne ispunjava drugi podcilj. |
| Pobjede | Točan kontekst/mod/plasman; pobjeda javnog bota ne daje botu misije, ljudska pobjeda nad botom vrijedi; top2 samo Četveroboj. |
| Trening | D10 jedan, W10 tri različita valjana treninga; poraz, neaktivnost, prekid i nula prihvaćenih poteza ne daju misijski napredak. |
| Odvajanje izvora | Trening ne pomiče javne misije ni obični XP/rang; privatna ne pomiče ništa misijsko; javni 1v1 s botom ne pomiče D10. |
| Prvo stanje | Prvi posjet/javna igra/trening bez posjeta stranici daje jednu dnevnu i tri tjedne; dva istodobna bootstrapa ne dupliciraju. |
| Dnevni dotok | 1 po ponoći, ukupno 0..3; odsutnost 1/2/30 dana; nema backfilla prije inicijalizacije; puna zaliha ne stvara skriveni dug. |
| Dnevni završetak | Oslobađa mjesto bez trenutne dopune; tri dnevne mogu dati tri nagrade u jednoj igri; kasniji GET isti dan ne daje novu. |
| Tjedni paket | Tri različita položaja; završene ostaju do ponedjeljka; nema četvrte nagrade; nedovršene istječu; dnevne preživljavaju reset. |
| Kombinacije | Tvrdi uvjeti obitelji/težine/pristupačnosti; seedani RNG; zamjena čuva druga dva položaja; prazan izbor ne troši kvotu. |
| W06 | Više igara isti dan daje jedan dan; petak dopušten, subota/nedjelja nisu za novu dodjelu; trening ne broji javni dan. |
| Kalendar | Tablica DST granica, obična ponoć, ponedjeljak i ±1 ms; nema UTC-string prečaca ni reseta nakon 24 sata. |
| Zamjena | Jedna po vrsti/danu; dvije različite tjedne kartice dijele kvotu; dnevna i tjedna ne dijele kvotu; sutra nova prava. |
| Konkurencija | Dva POST-a, dva GET-a, završetak × zamjena, dva izvora istog igrača, javna × trening, brisanje računa × nagrada. Čitati stvarne retke i XP. |
| Ponovljeni zahtjev | Isti key/ista dodjela vraća rezultat bez nove potrošnje čak i poslije ponoći; drugi payload s istim key-em je konflikt. |
| Stari događaj | Završetak prije ponoći/ponedjeljka, rollover GET, pa retry; ne pomiče novu dodjelu, ne troši novi dnevni dotok i ne gubi potvrđenu nagradu. |
| Atomičnost | Kontrolirani rollback između progresa i XP-a; nema isplate bez dovršetka, dovršetka bez ledgera ili potrošene kvote bez zamjene. |
| XP cap | Dio nagrade do capa, više nagrada istodobno u dogovorenom redu, 0 stvarnog XP-a na maxu; jedna isplata po dodjeli. |
| XP regresija | Isti „XP prvak” s/bez misije; bez množenja misijskog XP-a; konačna razina i „Iskusnjara” uključuju misije i višestruki level-up. |
| Trening retry | Isti `treningId` samo jednom; kvar DB-a ne potvrđuje spremljenu nagradu; retry vraća isti osobni sažetak; „Zagrijan” ostaje dosljedan. |
| HTTP/auth | Gost/bot/istekla sesija/tuđi ID/obrisan račun/klijentski XP; status i nikakva neautorizirana DB promjena. |
| Socket/UI minimum | Javna i trening šalju osobne promjene; 1–6 stavki, cap, replay bez druge čestitke; konačni XP nije zastario. |
| Migracija | Upgrade postojeće baze čuva podatke; ispravni partial unique/FK; soft-delete obuhvaća sve osobne misijske retke. |

Koristiti injektiran sat i RNG, ne čekanje do ponoći. DB testovi stvarno odvojene transakcije s kontroliranim barijerama, bez nasumičnog „stressa”. Postojeći Vitest ima `fileParallelism: false`; poštovati izolaciju baze. Za 40 definicija ne pokretati 40 browser partija. Testni računi/riječi su sintetički, bez stvarnih produkcijskih tokena.

### Provjere

```bash
pnpm --filter zajednicko build
pnpm --filter zajednicko test
# Potom ciljani novi Vitest testovi prema stvarnim imenima datoteka.
pnpm --filter posluzitelj test
pnpm --filter web check
pnpm lint
pnpm build
# Postojeci migracijski upgrade i obvezni PR CI prema aktualnom repozitoriju.
```

Navesti što je stvarno pokrenuto i rezultate. Ne tvrditi da nova imena testova već postoje. Nakon prolaska ciljanih provjera i obveznih gateova ne dodavati nasumična ponavljanja ili novi veliki workflow.

## 13. Relevantne datoteke provjerene u kodu

| Put | Relevantna točka |
|---|---|
| `paketi/zajednicko/src/iskustvo.ts` | 5 XP osnovni potez, 50 pobjeda, postojeća krivulja/cap; `ObracunIskustva`. |
| `paketi/zajednicko/src/ljestvice.ts` | `Europe/Zagreb`, kalendarske granice. |
| `paketi/zajednicko/src/grafemi.ts` | Grafemi i `prvaDva`, iznimke digrafa. |
| `paketi/zajednicko/src/protokol.ts` | `KrajPartije`, opcionalna nova polja. |
| `paketi/zajednicko/src/dostignuca.ts` | Postojeća „Iskusnjara” i „Zagrijan”; bez novog „Majstora misija”. |
| `aplikacije/posluzitelj/src/igra/motor-partije.ts` | Prihvaćeni potezi, snapshot i odvojeni javni/trening završeci. |
| `aplikacije/posluzitelj/src/igra/upis-partije.ts` | Transakcija, idempotentni javni claim, partijski XP, pohvale. |
| `aplikacije/posluzitelj/src/igra/politika-ucinka.ts` | Ne otvarati treningu cjelokupni javni napredak. |
| `aplikacije/posluzitelj/src/trening/upis-napretka.ts` | Postojeća trajna trening-pobjeda i „Zagrijan”. |
| `aplikacije/posluzitelj/src/baza/migracije/0038_napredak_treninga_i_kolekcija.sql` | `pobjede_treninga`, stvarni FK i nepostojanje FK-a na javnu partiju. |
| `aplikacije/posluzitelj/src/racuni/brisanje.ts` | Ručno čišćenje osobnih podataka uz soft-delete. |
| `aplikacije/web/src/lib/komponente/IskustvoPartije.svelte` | Trenutačno prikazuje razinu samo iz partijskog `obracun.poslije`; prilagoditi konačnom izvoru. |
| `aplikacije/web/src/routes/partija/[id]/+page.svelte` | Rezultati PR02, misijski minimum i oba postojeća panela prijava. |
| `aplikacije/web/src/lib/stanje-igre.svelte.ts` | `partija:kraj`, status spremanja i ponovljena dostava. |

Prije izmjene dodatno otvoriti shemu, auth, registraciju ruta, migracijski upgrade i relevantne postojeće testove. Navedeni novi misijski moduli su prijedlozi, ne postojeće putanje.

## 14. Definition of Done i predaja PR04

- [ ] Katalog 20 + 20 odgovara produktnom dokumentu, uključujući sve korisnikove pobjedničke/trening ciljeve.
- [ ] Tri dnevna mjesta, dotok jedan dnevno, prijenos/odsutnost i puna zaliha dokazani testovima.
- [ ] Tri tjedne u ponedjeljak, jedna zajednička dnevna kvota zamjene tjednih, bez četvrte nagrade.
- [ ] Javna i trening integracija su atomske, idempotentne i razdvojene po kontekstu.
- [ ] Partijski XP/pohvale ostaju čisti; misijski XP i konačna razina točni i na capu.
- [ ] Zakašnjeli obračun preko reseta i utrka zamjene imaju dokazano ponašanje, bez preskakanja tih testova.
- [ ] Minimalni završni prikaz radi u javnoj igri i treningu, bez ručnog preuzimanja i bez dvostruke čestitke.
- [ ] Stabilni GET/POST i socket tipovi, kodovi grešaka i sintetički primjeri predani PR04.
- [ ] Migracije, soft-delete i postojeći CI prolaze; nepokrivene stvari jasno navedene.

Predati konkretne primjere: prvi ulaz (1 dnevna + 3 tjedne), puna zaliha, potrošena tjedna zamjena, dvije dovršene misije u javnoj igri, trening s misijskim XP-om, MAX razina i replay istog ishoda. PR opis treba objasniti problem, dobiveno ponašanje i rezultate provjera, a ne prepisati cijelu specifikaciju.
