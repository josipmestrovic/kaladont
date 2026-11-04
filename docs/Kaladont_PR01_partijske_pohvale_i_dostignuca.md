# Kaladont: PR 01/05 – Partijske pohvale i dostignuća

**Vrsta dokumenta:** samostalna implementacijska specifikacija za AI developera  
**Datum:** 4. 11. 2026.  
**Repozitorij:** https://github.com/josipmestrovic/kaladont  
**Polazna grana:** aktualni `main` (ponovno provjeriti pri početku rada)  
**Ciljna grana, prijedlog:** `feat/partijske-pohvale-dostignuca`  
**PR naslov, prijedlog:** `feat: usporedne partijske pohvale i dostignuca`  
**Izvor:** `Kaladont_specifikacija_gamifikacije_misija_v2_2.md`, odjeljci 1–2, 9.3 (dva partijska dostignuća), 10.1–10.2 (partijski dio), 11, 13, 16.1 i 17.  
**Status:** zadatak spreman za **planiranje**, ne za nekontroliranu implementaciju; produktni detalji u odjeljku 3 zahtijevaju potvrdu.

> **VAŽNO: dogovorena nova podjela je PET PR-ova.** Stariji dokument v2.2 govori o dva PR-a; taj raspored isporuke više nije aktualan. Ovaj dokument vrijedi **isključivo za PR 01** i sam po sebi sadrži zahtjeve, granice opsega i testove. Ne širiti PR na druge funkcionalnosti.

## 1. Mjesto ovog PR-a u planu od pet PR-ova

| PR | Područje | Odnos prema PR 01 |
|---|---|---|
| **01/05 – ovaj** | Usporedne pohvale za javnu partiju i dva trajna dostignuća | Temelj; mora biti samostalno funkcionalan |
| 02/05 | Oznake kolekcije riječi i samo **redoslijed** postojećih sekcija završnog ekrana | Koristi završni payload i blok pohvala iz PR 01; ne mijenja izračun |
| 03/05 | Backend dnevnih i tjednih misija (7 + 7, dodjela, zamjena, progres, XP, „Majstor misija”) | Ne smije pribrajati misijski XP partijskom kriteriju „XP prvak” |
| 04/05 | Stranica `/misije`, navigacija, progres, zamjene i završne obavijesti o misijama | Integrira se u završni ekran bez promjene pohvala |
| 05/05 | „Stalno si tu”, aktivni dani, trajni najbolji niz i profil | Neovisan od partijskih pohvala |

**U ovaj PR NE ulaze:** kolekcijske oznake, preslagivanje završnog ekrana, promjene prijavnih panela, misije, bilo kakav misijski XP, `Majstor misija`, `Stalno si tu`, novi način igre, nove ljestvice, refaktor cijelog XP sustava, novi CI workflow. U PR 01 smije se dodati **samo uski vizualni blok za nove pohvale** na postojećem završnom ekranu i nužna integracija novih dostignuća u postojeći katalog/profil.

## 2. Funkcionalni zahtjevi, obvezni

### 2.1. Dvije različite usporedne pohvale

Obje se dodjeljuju **tek nakon autoritativno završene i uspješno spremljene javne partije** (`dva_igraca` ili `cetiri_igraca`). Uspoređuju se **sudionici iste partije**, a ne osobni rekordi iz prošlosti. Registrirani igrač ne mora osvojiti prvo mjesto po bodovima da bi dobio jednu ili obje pohvale.

**A. „Najdulji niz bez greške u partiji”**

- Mjeriti **najdulji niz vlastitih uzastopnih prihvaćenih riječi u toj partiji** iz već postojećeg `statistikeRijeci.get(igracId)?.najduziStreak`.
- Ne koristiti `nizoviPobjedaIgraca`, povijesni osobni rekord ni prosjek preko partija.
- Odbijeni unos i reset niza slijede **postojeću** logiku motora. Ne prepravljati pravila ni zasebno rekonstruirati niz iz UI-ja.
- Primjer: ljudski igrači 4, 7 i 5; bot 9 → prema preporučenom pravilu pobjednik pohvale je čovjek sa 7.
- Primjer prikaza: **„🔥 Najdulji niz bez greške u ovoj partiji: 7 riječi”**.

**B. „Najviše XP-a u partiji”**

- Mjeriti **bruto partijski XP nakon svih postojećih partijskih bonusa**, uključujući bonus za pobjednički niz i ocjenu igre. **Ne** koristiti samo početni `osnovniXp` ni prerani subtotal.
- Na razini 100 stvarno dodijeljeni `osvojenoIskustvo` može biti 0 zbog kapice. Za rangiranje koristiti `brutoIskustvo` bez kapice, ali u standardnom XP bloku zadržati **stvarno dodijeljen iznos**.
- Ne uključiti budući XP iz dnevnih/tjednih misija, završnu nagradu za ovu pohvalu ni broj XP-a skupljen u prethodnim partijama.
- Primjer: bruto XP 160, **190**, 130 → drugi igrač dobiva pohvalu, iako nije pobijedio po bodovima.
- Primjer prikaza: **„⭐ Najviše ostvarenog partijskog XP-a: 190”** (nikad „+190 XP” ako toliko nije stvarno dodijeljeno).

**Obje pohvale**:

- mogu pripasti istom igraču u istoj partiji;
- ne dodjeljuju dodatni XP (pohvala + napredak dostignuća su nagrada);
- ne mijenjaju postojeće bodovanje, prosjek, rang, formu, pobjednički niz, DNK, kolekciju ili XP;
- ne daju se za privatnu sobu, Zagrijavanje, poništenu partiju ili partiju koja nije završno spremljena;
- trajno osvajanje priznanja broji se **najviše jednom za igrača, vrstu pohvale i partiju**.

### 2.2. Dva NOVA trajna dostignuća

| ID (prijedlog) | Naziv (prijedlog) | Broji | Pragovi, ukupno dobivenih pohvala |
|---|---|---|---|
| `vladar_niza` | **Vladar niza** | Koliko puta je igrač osvojio usporednu pohvalu A | **5, 15, 30, 60, 100** |
| `xp_prvak` | **XP prvak** | Koliko puta je igrač osvojio usporednu pohvalu B | **5, 15, 30, 60, 100** |

- Brojači su **ukupni kroz javni Dvoboj i Četveroboj** i uvećavaju se za točno 1 po osvojenoj pohvali.
- Ako je maksimum izjednačen, jedan igrač i dalje dobiva samo **jedno** uvećanje po vrsti pohvale i partiji.
- Pragovi otključavaju postojeći sustav zvjezdica; nova dostignuća su u postojećem katalogu, profilu, istaknutim dostignućima i završnom prikazu **kad je doista prijeđen prag**.
- **„Jezik u plamenu” ostaje nepromijenjen**: on prati *najbolji osobni niz*, a `Vladar niza` broji *koliko je puta igrač bio najbolji među sudionicima partije*. Ne dijeliti isti `najduziStreak` brojač za oboje.
- Ne dodjeljivati retroaktivno priznanja za stare partije ako iz spremljenih podataka nema nedvojbenog dokaza.

## 3. Produktna pitanja za kratku potvrdu PRIJE pisanja koda

Samo podjela na pet PR-ova već je odobrena. Sljedeća pravila iz v2.2 bila su **preporuke**, a ne doslovno potvrđene odluke. Agent neka ih iznese na početku plana i dobije potvrdu; ne smije ih predstaviti kao već odobrene:

| Pitanje | Preporučeni default | Zašto |
|---|---|---|
| Tko sudjeluje u usporedbi? | Samo stvarni ljudi (`upravljac === 'covjek'`), uključujući goste; botovi isključeni | Bot koji deterministički igra ne bi smio uzimati titule ljudima |
| Minimalan broj ljudi? | Barem **dva** čovjeka u istoj javnoj partiji, inače nema novih pohvala | Onemogućuje farmanje u partiji jednog čovjeka i botova |
| Izjednačen najbolji rezultat? | Svi ljudi s pozitivnim maksimumom dobivaju pohvalu | Nema proizvoljnog tie-breaka |
| Rezultat 0? | Nitko ne dobiva pohvalu ako je maksimum 0 | Nema titule bez odigranog učinka |
| Gost i registrirani igrač? | Gost je ravnopravan u usporedbi; trajni napredak piše se samo registriranome | Poštena usporedba, ali bez privremenog farmanja računa |
| XP na razini 100? | Rangirati po potpunom `brutoIskustvo` | Pravedno bez promjene kapice XP-a |
| Dostignuća: nazivi i pragovi? | Gornji ID/naziv i **5 / 15 / 30 / 60 / 100** | Prva razina na 5 odgovara izrečenom primjeru; ostali pragovi prijedlog |

Ako korisnik želi, ove odluke može potvrditi **jednim odgovorom** u PR plan raspravi. Potom zamrznuti pravila i prema njima napisati testove.

## 4. Nalazi iz postojećeg koda i mjesta implementacije

Ovo su **smjernice prema pregledanom `main` 4. 11. 2026.**, ne tvrdnja da je kod već promijenjen. Prije rada agent mora provjeriti aktualne tipove i granu.

| Mjesto | Što je već prisutno / što je potrebno |
|---|---|
| `paketi/zajednicko/src/dostignuca.ts` | `BrojacDostignuca`, `DEFINICIJE_DOSTIGNUCA`, `izracunajNovaDostignuca` i izbor istaknutih. Dodati dva **inkrementalna** brojača i definicije, **ne** max-semantiku `najduziStreak`. |
| `paketi/zajednicko/src/iskustvo.ts` | `ObracunIskustva` s `brutoIskustvo` i `osvojenoIskustvo`. Reuse postojećeg izračuna i stanja kapice. |
| `aplikacije/posluzitelj/src/igra/motor-partije.ts` | U `zakljuciPartiju` nastaju `zavrsenoU`, obračuni, završni DTO i `rezultatiKraja`; obratiti pažnju da se partijski bonusi dopunjuju nakon spremanja. Priznanja računati iz **konačne** vrijednosti i pohraniti uz autoritativni završetak, ne u klijentu. |
| `aplikacije/posluzitelj/src/igra/upis-partije.ts` | `zakljuciPartijuUBazi` već ima transakcijski claim kroz status `partije` i `obracuni_partija`; novi podatci moraju biti obračunati **u istoj idempotentnoj granici**. Ne kreirati sporedni obračun koji se može ponoviti. |
| `aplikacije/posluzitelj/src/baza/shema.ts` | `napredak_dostignuca_igraca`, `dostignuca_igraca`, `partije`, `igraci` i `obracuni_partija` već postoje. Dodati odgovarajuće stupce i/ili audit tablicu uz ključ jedinstvenosti. |
| `paketi/zajednicko/src/protokol.ts` | `KrajPartije` trenutačno nema pohvale; proširiti tipizirani dio samo za dvije pohvale. Ne dodavati misije u PR 01. |
| `aplikacije/web/src/routes/partija/[id]/+page.svelte` | Prikaz zaključka već koristi `stanje.kraj`; dodati mali semantički blok za pohvalu. **Ne preslagivati ostale sekcije**, to je PR 02. |
| Profil/katalog dostignuća | Postojeću logiku prikaza i isticanja dopuniti s dva nova ID-a; provjeriti fallback ikonice i prikaz pet zvjezdica. |
| `aplikacije/posluzitelj/src/igra/politika-ucinka.ts` | Javna daje puni napredak; privatna zadržava postojeću kolekciju/dostignuća, ali nema XP; trening ima zaseban režim. Ne dirati tu politiku samo da bi nova značajka radila. |

### 4.1. Posebna opasnost: obračun XP-a u dvije faze

U trenutačnom kodu završni partijski `obracun.brutoIskustvo` nadopunjuje se bonusima nakon poziva na transakcijsko zaključivanje. Naivan izračun pobjednika XP pohvale **prije** tih dopuna može odabrati pogrešnog igrača, dok bi rezultat u bazi i rezultat na ekranu prikazivali različite iznose.

**Zahtjev:** razviti jednu pouzdanu, testiranu točku s **potpunim finalnim bruto XP-om svakog sudionika** (uključujući postojeći bonus ocjene igre i pobjedničkog niza), dostupnu za usporedbu i trajni upis u **istoj transakcijskoj logici** kao završetak partije. Agent mora prije kodiranja u planu pokazati kako to radi **bez** novog dodavanja XP-a i bez dupliciranja obračuna. Dopušten je uski refaktor izračuna/prijenosa podataka, ali **ne** promjena formule ili postojećeg rezultata XP-a.

### 4.2. Shema i idempotentnost

**Predloženo, nije obvezujući naziv:** `pohvale_partije(partija_id, igrac_id, vrsta, vrijednost, stvoreno)` s `UNIQUE(partija_id, igrac_id, vrsta)`; `vrsta ∈ {najduzi_niz, najvise_xp}`. Pri implementaciji koristiti postojeće FK/brisanje i migracijske konvencije te objasniti odluku za račun gosta. Brojači `pohvale_niz_ukupno` i `pohvale_xp_ukupno` mogu biti stupci u `napredak_dostignuca_igraca`, ali autoritativnost mora biti jasna: **jedinstven audit zapis** kontrolira uvećanje brojača ili se brojač izdvaja iz audita; ne dopustiti dva neovisna istinita izvora koja se razilaze.

Ključno ponašanje:

1. Samo uspješan završni claim javne partije smije stvarati priznanja; ne pokretati kasnije nezaštićeni „naknadni job”.
2. U jednoj DB transakciji: utvrditi pobjednike i pozitivne rezultate; zabilježiti pohvale; uvećati pripadajući **registrirani** brojač i izračunati nova dostignuća; spremiti završni obračun; zatim emitirati završni snapshot.
3. Ako isti završetak stigne dvaput (Socket.IO reconnect, retry transakcije, dva handlera), ne smije nastati drugi audit zapis, brojač ni level up.
4. Ako transakcija padne, **nema** trajnih pohvala ni napretka; sljedeći uspješan pokušaj daje točan ishod.
5. Povijest i pragove čuvati kao postojeći trajni napredak; pri brisanju računa poštovati postojeći proces, FK i pravila privatnosti.

**Napomena za agentov plan:** treba razraditi kako očuvati završni `KrajPartije` snapshot kada je claim već obrađen, a poslužitelj naknadno ponovno šalje kraj. U postojećem motoru `rezultatiKraja` se koristi pri reconnectu. Ne smije ponovno izgledati kao *novo* osvojeno dostignuće ako je već prikazano.

### 4.3. Predloženi završni DTO

Jednostavan tip (nazivi polja mogu se prilagoditi već postojećim konvencijama):

```ts
type VrstaPohvalePartije = 'najduzi_niz' | 'najvise_xp';
type PohvalaPartije = {
  vrsta: VrstaPohvalePartije;
  vrijednost: number;
  dijeljenoPrvoMjesto: boolean;
};
// KrajPartije: pohvale?: PohvalaPartije[];
```

- `pohvale` se šalju *konkretnom primatelju*; ako nije osvojio ništa, prazno polje ili `[]`.
- Za gosta je moguć prolazni prikaz pohvale, ali nema trajnog brojača bez registriranog računa (prema preporučenom defaultu).
- Polje nije izvor odluke ni izvršitelj nagrade; UI ne smije kreirati svoje pobjednike uspoređivanjem drugih korisnika.
- Zadržati kompatibilnost starih potrošača poruke, privatnog kraja i Zagrijavanja.

## 5. Minimalna promjena sučelja u PR 01

- Na postojećem završnom ekranu dodati blok **„Pohvale ove partije”** samo kada postoje pohvale za lokalnog igrača. Prikazati 0–2 stavke i jasan broj/tekst. Ako nema pohvale, ne prikazivati praznu karticu.
- Obje pohvale mogu biti prikazane istodobno; u slučaju izjednačenja poruka pošteno kaže **„Dijeljeno prvo mjesto”**.
- Nova dostignuća prikazivati kroz **postojeći** prikaz zvjezdica/dostignuća kada se otključa prag; ne stvarati drugi paralelni modal ili animaciju.
- Ne ispisivati bruto XP kao da je dodijeljeni XP. Posebno prikaz na MAX LVL mora biti istinit.
- Ne mijenjati sekcije `Forma`, `XP`, `DNK`, `Kolekcija` ni njihovu poziciju, boje, tipografiju, prijelaze ili animacije izvan nužne male integracije.
- **„Prijavi riječ” i „Prijavi igrača” ostaju posljednja dva panela** i potpuno funkcionalni. Ako se doda novi blok, staviti ga **prije** ta dva panela.
- Provjeriti postojeći font za disleksiju, malu mobilnu širinu i dostupnu oznaku tekstualnog bloka. Nije potreban pixel-perfect redizajn.

## 6. Testni ugovor: obvezna matrica PR 01

Testove graditi tako da štite **poslovno pravilo**, ne redoslijed Socket.IO callbackova ili stvarno trajanje partije.

| ID | Sloj | Slučaj / točno očekivanje |
|---|---|---|
| P01-01 | shared Vitest | `dva_igraca`: usporedba `najduziStreak` 3 : 6 → samo 6 dobiva pohvalu; plasman nije bitan |
| P01-02 | shared Vitest | `cetiri_igraca`: ljudi 4/7/5 + bot 9 → čovjek 7 osvaja; bot nikad ne prima priznanje |
| P01-03 | shared Vitest | Dva čovjeka imaju 4/4 → oba osvajaju po jedno; 0/0 → nijedan; 1 čovjek + bot → nijedan (ako default potvrđen) |
| P01-04 | shared Vitest | Jedan čovjek ima najbolji niz i najbolji bruto XP → dvije različite pohvale u jednoj partiji |
| P01-05 | shared Vitest | Bruto XP 160/190/130, pobjednik po bodovima nije 190 → `najvise_xp` ide igraču 190 |
| P01-06 | shared Vitest | Provjeriti bonus ocjene igre i pobjedničkog niza u **finalnom bruto XP-u**, ne subtotal; izbor pobjednika ne smije ovisiti o redoslijedu obrade sudionika |
| P01-07 | shared Vitest | LVL 100: bruto XP > 0, stvarni dodijeljeni XP = 0, pohvala može pripasti tom igraču bez netočnog „+XP” prikaza |
| P01-08 | shared Vitest | „Jezik u plamenu” `najduziStreak` je **maksimum**; `Vladar niza` novi brojač je **suma osvojenih partija**; postojeći rezultati ostaju nepromijenjeni |
| P01-09 | DB integracija | Ista partija obrađena dvaput ili paralelno → jedan audit red po vrsti/igraču, jedan pomak brojača i jedno otključavanje praga |
| P01-10 | DB integracija | Pragovi `4→5`, `14→15`, `29→30`, `59→60`, `99→100` → točno sljedeća zvjezdica, bez duplikata; razina ne pada |
| P01-11 | DB integracija | Privatna soba, Zagrijavanje, poništeni javni zapis → **0 novih** pohvala; postojeća privatna kolekcija i dostignuća normalno rade |
| P01-12 | DB integracija | Nepotpuni/ponovljeni završetak ili namjerno bačena DB greška → nema djelomično dodijeljenog brojača; uspješan retry točno jednom |
| P01-13 | server/Socket.IO | Završni DTO dolazi **nakon** trajnog obračuna; prijavljenom igraču prikazuje 0–2 samo njegove pohvale; gost nema trajni brojač |
| P01-14 | server/Socket.IO | Reconnect ili ponovno traženje završnog stanja ne mijenja pohranjene pohvale, XP i dostignuća; zadržan isti rezultat |
| P01-15 | Playwright | Jedan stvarni javni završetak: pohvala i napredak dostignuća (ako je prag) vidljivi, bez dupliciranih prikaza |
| P01-16 | Playwright | Mobilni završni ekran (barem jedan uzak viewport): novi blok čitljiv; „Prijavi riječ” i „Prijavi igrača” posljednji su i nisu prekriveni |
| P01-17 | regresija | `pnpm test`, auth, postojeći XP, bodovi, rangovi, forma, DNK, javna/privatna/trening, „Jezik u plamenu”, zbirka i izvještaji ne regresiraju |
| P01-18 | migracije | Upgrade test na zatečenim računima/dostignućima čuva stare podatke; novi brojači startaju na 0; stranica profila radi s 0 novih pohvala |

**Napomena:** ovo je sada testna matrica za novi **PR 01 od pet**. Stariji testovi `P1-09` i `P1-10` iz v2.2 (oznake kolekcije) te `P1-11` (puni redoslijed završnog ekrana) pripadaju **PR 02**, ne ovom PR-u. Testove prijavnih panela u PR 01 zadržati kao **regresiju**, ne redizajn.

### 6.1. Testne zamke i kako ih izbjeći

1. **Ne testirati isteke pomoću `sleep(30s)`**; izračun pohvala testirati čistom funkcijom na determinističkim ulazima. Za end-to-end dovršetak koristite postojeće testne mehanizme i sintetički rječnik.
2. **Socket.IO listener registrirati prije akcije** koja emitira kraj, nikada nakon akcije; čekati poznati događaj ili `expect.poll` na poslovno stanje.
3. **Ne oslanjati se na nasumičan sastav botova**, matchmaking ni njihove slučajne odgovore. Unit/DB testovi eksplicitno definiraju ljudske i bot-sudionike, ulaze i finale.
4. **Ne testirati učinak s realnim LVL 100 grindom.** Postaviti poznato početno stanje XP-a/DB fixture i kontrolirati bruto vrijednost. Provjeriti razliku `brutoIskustvo` i `osvojenoIskustvo`.
5. **Ne paralelizirati testove na zajedničkoj DB ili javnom redu** dok ne postoje odvojeni resursi po testu. U trenutnom repozitoriju poslužiteljski Vitest ima `fileParallelism: false`, Playwright `workers: 1`.
6. **Ne brojiti samo UI toast** kao dokaz uspješnog osvajanja. Provjeriti stvarne DB retke i stanje brojača; provjeriti jednu novu zvjezdicu pri prelasku praga.
7. **Ne manipulirati sučeljem samo da bi „dobio pobjedu”.** API/server su autoritativni. U browseru treba samo dokazati ispravan prikaz već provjerene serverske odluke.
8. **Ne dodavati dugačke E2E partije za sve kombinacije**. 80–90% logike pokriti brzim čistim i DB testovima, a jedan reprezentativni javni kraj i jedan mobilni pogled Playwrightom.
9. **Ne oslanjati se na `Date.now()` za ponovno proglašenje nove nagrade**. `partijaId` i trajni zapis određuju je li pohvala već obračunata. Ponovljeni payload može prikazati prethodno ostvarenu pohvalu, ali ne smije proizvesti novi obračun ili novi celebracijski događaj.
10. **Migracijski test** mora krenuti od postojeće sheme s postojećim podacima, ne samo od prazne baze. Postojeći CI koristi `migracije:upgrade-test -- --zadnje=2` i treba potvrditi da novi migracijski skup stvarno ulazi u upgrade scenarij.

### 6.2. Pokretanje provjera

```bash
# Nakon lokalne pripreme ovisnosti / Postgresa i migracija:
pnpm --filter zajednicko build
pnpm --filter zajednicko test
pnpm --filter posluzitelj test
pnpm --filter web check
pnpm lint

# Prije PR mergea: postojeći obvezni CI pokreće puni suite,
# Playwright E2E, Docker build i image smoke. Lokalno po potrebi:
pnpm test
pnpm build
pnpm test:e2e
```

Ne pokretati ručni produkcijski `test:prijave-produkcija` prema stvarnoj produkciji za dokaz ispravnosti ovog PR-a. Ne pokretati staging load test bez zasebnog dogovora. Ne uvoditi novi GitHub Actions workflow samo za pohvale.

## 7. Koraci koje agent treba predložiti u plan modu

1. **Provjeri aktualni `main` i stanje branch-a.** Pronađi točne završne strukture i nazive brojača u datom commitu; reci je li nešto od ovoga već implementirano.
2. **Iznesi 7 produktnih pitanja iz odjeljka 3** i preporučene defaulte. Sačekaj potvrdu vlasnika prije kodiranja. Ako se pravilo promijeni, ažuriraj očekivane testove u planu.
3. **Dizajniraj čistu funkciju za usporedbu** (ulaz: javni kontekst, lista sudionika, metrike pojedine partije, finalni bruto XP; izlaz: deterministički pobjednici/izjednačenja). Nema SQL-a ni Socket.IO u toj funkciji.
4. **Razriješi trenutak finalnog XP-a**: napiši kratki tok kako isti puni obračun ulazi u usporedbu, DB upis i završni UI bez dvostrukog bonusa i bez razlike zbog LVL 100 kapice.
5. **Planiraj bazu i migraciju** (audit/unique i 2 inkrementalna brojača ili sigurna izvedena strategija), postojeći katalog dostignuća i ispravne FK/brisanje.
6. **Planiraj transakcijski tok** za normalno zaključivanje, retry, paralelne završetke i rollback; očuvaj postojeći privatni/trening režim.
7. **Planiraj tipizirani payload i minimalni UI** bez mijenjanja ostatka završnog ekrana. Definiraj prikaz za gosta, izjednačenje i LVL 100.
8. **U plan uključi preslikavanje svakog P01-01 do P01-18** na konkretan testni file, s obveznim testovima i očekivanim rezultatima, te pokretanje trenutnog PR CI-ja.
9. Tek nakon odobrenog plana implementiraj **jedan PR** prema `main`, lokalno pokreni ciljane testove, pripremi migraciju, zatim puni CI; ne razbijaj ovaj zadatak dalje na pet malih PR-ova.

## 8. Definition of Done / prihvatni checklist

- [ ] Pravila o botovima, minimalno dvoje ljudi, izjednačenju, gostima, bruto XP-u, nazivima i pragovima **potvrđena ili eksplicitno promijenjena**.
- [ ] Dvije usporedne pohvale rade za javni Dvoboj i Četveroboj, **bez** privatne sobe i Zagrijavanja.
- [ ] Konačan bruto XP uključuje sve postojeće bonuse i ne predstavlja kapirani XP kao zarađeni.
- [ ] `Vladar niza` i `XP prvak` napreduju po broju osvojenih pohvala, ne po najboljoj pojedinačnoj vrijednosti.
- [ ] `Jezik u plamenu` i stari brojači, bodovi, XP, DNK, forma, rangovi i kolekcije nisu promijenjeni.
- [ ] Sve nagrade, brojači i pragovi idempotentni su i transakcijski zaštićeni.
- [ ] Potrebne migracije, zajednički tipovi, katalog dostignuća, profil i završni `KrajPartije` ažurirani su.
- [ ] Novi pohvalni blok ne mijenja redoslijed ostalih sekcija, a oba panela za prijave ostaju na dnu.
- [ ] Scenariji P01-01 do P01-18 pokriveni su automatizirano ili je ekvivalent jasno obrazložen u PR opisu; svi prolaze.
- [ ] Postojeći obvezni GitHub CI agregator zelen; priloženi prikazi mobilnog/desktop završnog ekrana.
- [ ] PR opis jasno navodi što **nije** dio PR-a 01 i što predaje PR-u 02/03.

## 9. Predaja sljedećem agentu (PR 02)

Nakon mergea agent predaje: (1) točan naziv javnog tipa `PohvalaPartije` i polja `KrajPartije`, (2) mjesta na završnoj stranici gdje se novi blok umeće, (3) testne podatke za dvije pohvale i izjednačenje, (4) identifikatore dva dostignuća, (5) eventualne potvrđene odluke različite od preporučenih defaulta. PR 02 tada **samo preslaguje postojeće blokove** i dodaje oznake kolekcije riječi; ne mijenja izračun niti trajni obračun pohvala.

---

### Reference iz repozitorija

- [Dostignuća](https://github.com/josipmestrovic/kaladont/blob/main/paketi/zajednicko/src/dostignuca.ts)
- [XP obračun](https://github.com/josipmestrovic/kaladont/blob/main/paketi/zajednicko/src/iskustvo.ts)
- [Motor javne partije](https://github.com/josipmestrovic/kaladont/blob/main/aplikacije/posluzitelj/src/igra/motor-partije.ts)
- [Transakcijski upis](https://github.com/josipmestrovic/kaladont/blob/main/aplikacije/posluzitelj/src/igra/upis-partije.ts)
- [Shema baze](https://github.com/josipmestrovic/kaladont/blob/main/aplikacije/posluzitelj/src/baza/shema.ts)
- [Završna poruka](https://github.com/josipmestrovic/kaladont/blob/main/paketi/zajednicko/src/protokol.ts)
- [Završni ekran](https://github.com/josipmestrovic/kaladont/blob/main/aplikacije/web/src/routes/partija/%5Bid%5D/+page.svelte)
- [Politika javno/privatno/trening](https://github.com/josipmestrovic/kaladont/blob/main/aplikacije/posluzitelj/src/igra/politika-ucinka.ts)
- [Postojeće testiranje](https://github.com/josipmestrovic/kaladont/blob/main/docs/06-razvoj/testiranje.md)

**Napomena:** ovaj dokument definira zahtjev za implementaciju. Ne potvrđuje da je PR već otvoren, kod izmijenjen ni da su novi testovi već izvršeni.
