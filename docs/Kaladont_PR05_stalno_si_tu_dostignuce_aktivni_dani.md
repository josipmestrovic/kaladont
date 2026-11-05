# Kaladont: PR 05/05 — „Stalno si tu” (uzastopni dani aktivnosti)

**Vrsta dokumenta:** samostalna specifikacija i zadatak za AI developera  
**Status:** Plan mode → potvrda otvorenih odluka → implementacija → testovi → PR  
**Datum:** 4. studenoga 2026.  
**Repozitorij:** https://github.com/josipmestrovic/kaladont  
**Predložena grana:** `feat/stalno-si-tu` → `main`  
**Izvor dogovora:** `Kaladont_specifikacija_gamifikacije_misija_v2_2.md` §9.2, §9.3, §10 i §11; naknadna podjela na pet PR-ova.  
**Preduvjet za implementaciju:** potvrditi stvarni spojeni status PR 01–04 i aktualni `main`. PR 05 ne smije pretpostavljati da implementirani kod identično odgovara dokumentima.

> **Ovo je samo PR 05 od ukupno pet.** PR 01: partijske pohvale; PR 02: kolekcija i završni ekran; PR 03: backend misija; PR 04: frontend misija; **PR 05: evidencija uzastopnih aktivnih dana + dostignuće „Stalno si tu”**. Stari dokument v2.2 još sadrži raniju organizaciju u 2 PR-a. Za organizaciju razvoja vrijedi ovdje potvrđena podjela u 5 PR-ova.

---

## 0. Obvezno za agenta: prvo Plan mode

1. `git fetch`, pregled `main`, stanje PR-ova 01–04 i postojećih migracija. **Ne raditi izravno na `main`**. Ako PR 03/04 nisu spojeni, predložiti postupak baziranja i tražiti potvrdu; preferirati novi PR na ažuriranom `main`, bez cherry-pickanja nedovršenih promjena naslijepo.
2. Pročitati ovaj dokument te relevantne implementirane dijelove: `paketi/zajednicko/src/dostignuca.ts`, `paketi/zajednicko/src/ljestvice.ts`, `aplikacije/posluzitelj/src/baza/shema.ts`, `aplikacije/posluzitelj/src/profil/rute.ts`, `aplikacije/posluzitelj/src/racuni/autentikacija.ts`, `aplikacije/posluzitelj/src/racuni/rute.ts`, `aplikacije/posluzitelj/src/racuni/brisanje.ts`, `aplikacije/posluzitelj/src/server.ts`, `aplikacije/web/src/routes/+layout.svelte`, `aplikacije/web/src/lib/identitet.ts`, `aplikacije/web/src/lib/api.ts`, profilne Svelte komponente, migracije i postojeće testove.
3. Prije kodiranja pokazati vlasniku proizvoda: plan datoteka, tok aktivnog posjeta, shemu baze, primjer API-ja, točnu definiciju kalendarskog dana, testnu matricu i otvorene odluke iz §16. Ne mijenjati već dogovorene pragove bez odobrenja.
4. Provjeriti uvodi li PR 03 već autentificirani bootstrap. Ako postoji, integrirati se bez drugog redundantnog mehanizma. Ako ne postoji, koristiti minimalni zasebni endpoint iz §7; ne pretvarati svaki `/api` GET u zapis aktivnosti.
5. Nakon odobrenja implementirati i dokumentirati samo navedeni opseg. Testove pokrenuti lokalno te omogućiti postojeći puni PR CI; **ne mijenjati CI pravila da bi testovi prošli**.
6. U PR priložiti opis ponašanja i snimke vlastitog profila (desktop/mobitel), migracijsku provjeru, relevantne testove i jasno označene pretpostavke.

## 1. Cilj i granice

**Cilj:** pohvaliti registriranog čovjeka koji se uzastopnih dana aktivno vraća u Kaladont, bez obveze da svaki dan odigra partiju i bez kažnjavanja kad preskoči dan. To je jedan novi podsustav evidencije aktivnosti, integriran u **postojeći sustav dostignuća**, ne nova vrsta valute, ljestvica ili misija.

### Ulazi u PR 05

- Evidencija valjanog dana po računu, najviše jednom dnevno; aktivni dan označava **svjesno otvaranje/korištenje vidljive aplikacije s valjanom prijavom**.
- Računanje trenutačnog i najboljeg niza uzastopnih *zagrebačkih kalendarskih dana*.
- Novo dostignuće **`stalno_si_tu`**, naziv **„Stalno si tu”**, pet zvjezdica na pragovima **2, 5, 10, 20, 30** dana.
- Postojan zapis odobrenih dana + agregata; idempotentnost, transakcijski otključavanje dostignuća i integritet pri paralelnim pozivima.
- Server endpoint ili postojeći autentificirani bootstrap za upis; minimalni klijentski okidač na stvarnu vidljivu aktivnost.
- Prikaz u postojećem katalogu dostignuća, vlastitom profilu i, uz postojeća pravila javnog profila, javnom katalogu dostignuća; sažeti status trenutačnog/najboljeg niza ako se uklapa bez redizajna.
- Usklađenje postojećeg načina označavanja *Novo*, broja ukupnih zvjezdica i istaknutih dostignuća; ikona u postojećem vizualnom jeziku.
- Testovi, migracije, minimalna dokumentacija, GDPR/brisanje računa i regresije.

### Izričito izvan opsega

- **Ne mijenjati** 7+7 definicija misija, njihovu dodjelu/zamjenu, misijski XP ili dostignuće „Majstor misija” iz PR 03.
- **Ne koristiti** W06 „Tri dana igre” kao streak aktivnosti: W06 broji dane sa završenim javnim partijama, a „Stalno si tu” dane svjesnog posjeta, bez obveze igre.
- Ne mijenjati PR 01 dostignuća „Vladar niza”/„XP prvak”, „Jezik u plamenu”, niz pobjeda (Dvoboj/Četveroboj), formu, DNK ni rang.
- Ne mijenjati pravila bodova, XP-a, završetak partije, kolekciju riječi, prijave riječi/igrača, servere, deployment, plaćanja ili postojeće push/email obavijesti.
- Bez dodatnih dnevnih nagrada u XP-u za dolazak, bez prisilnog logiranja, bez negativnog UX-a („Izgubio si niz!”), bez podsjetnika djeci da moraju svaki dan ući.
- Bez posebne nove stranice ili „kalendara prisutnosti” i bez javnog izlaganja datumâ pojedinačnih posjeta.

## 2. Produktna pravila (potvrđeno)

| Pravilo | Točno ponašanje |
|---|---|
| Naziv | **Stalno si tu** |
| Metrika | Najbolji niz uzastopnih valjanih **kalendarskih dana aktivnosti**, ne broj prijava lozinkom, pobjeda ili partija |
| Razina 1 | **2** dana |
| Razina 2 | **5** dana |
| Razina 3 | **10** dana |
| Razina 4 | **20** dana |
| Razina 5 | **30** dana |
| Značenje „mjesec dana” | U ovom sustavu točno **30 uzastopnih dana**, ne 28/29/30/31 kalendarski dan mjeseca |
| Vremenska zona | **Europe/Zagreb** prema satu poslužitelja; ne preglednik, klijentova IP zona ni fiksno UTC+1 |
| Kada se dan računa | Prvi potvrđen valjani aktivni posjet određenoga dana; daljnji posjeti istoga dana su no-op |
| Povratak sljedeći dan | Trenutačni niz raste za 1 |
| Propušten dan | Pri sljedećem valjanom posjetu trenutačni niz počinje od 1; najbolji niz se čuva |
| Nagrade | **Nema XP-a**; samo dostignuće i pet trajnih zvjezdica na pragovima |
| Ponovni dolazak nakon gubitka niza | Nema oduzimanja zvjezdica niti resetiranja *najboljeg* niza |
| Registrirani | Valjana autentificirana osoba (`vrsta` registriran/admin, `upravljac` čovjek, račun nije obrisan); bez ponovne prijave lozinkom svaki dan |
| Gost | Ne dobiva streak; pri kasnijoj registraciji počinje od prvoga valjanog registriranog dana, bez backfilla dana dok je bio gost |
| Bot | Nikad ne dobiva dan, streak, XP ili zvjezdice iz ove značajke, čak ni ako botov zapis ima `vrsta=registriran` |
| Javni profil | Prikazuje otključanu razinu u standardnom katalogu dostignuća samo ako profil inače smije biti javan; bez popisa datuma dolazaka |
| Negativne obavijesti | **Nema** prijetnji gubitkom niza, emocionalnog pritiska ili poruka da se dijete mora vratiti sutra |

**Važna razlika:** `trenutniNiz` u `nizovi_pobjeda_igraca` odnosi se na pobjede, `najduziStreak` u dostignućima na niz riječi u jednoj partiji. U PR-u 05 dodati **različito imenovan** brojač, npr. `najboljiNizAktivnosti`, kako ih agent ne bi pomiješao.

### 2.1. Primjeri toka

- Pon: prvi valjan posjet ⇒ trenutačni 1, najbolji 1, nema zvjezdice.
- Uto: povratak ⇒ trenutačni 2, najbolji 2, **prva zvjezdica**.
- Uto: refresh, prijava s drugog uređaja, povratak iz drugog taba ⇒ ostaje 2 i nema ponovne nagrade.
- Sri/Pet/sub/... neprekidno do 5 ⇒ druga zvjezdica; identično za 10, 20, 30.
- Uto nakon trodnevne pauze ⇒ trenutačni 1, najbolji npr. 20, već otključane 4 zvjezdice ostaju.
- Igrač dođe svaki dan, ali ništa ne odigra ⇒ streak svejedno napreduje.
- Igrač odigra 10 partija u jednom danu ⇒ **samo jedan** aktivan dan.

## 3. Točan izvor aktivnog posjeta

**Ne broji svaku HTTP autentikaciju.** `GET /profil`, background refresh misija, polling ljestvice, Socket.IO heartbeat, botova aktivnost ili cron **ne smiju sami automatski otključavati dan**. Inače bi stalno otvoreni skriveni tab ili serverski proces održavali niz bez dolaska igrača.

**Preporučeni klijentski okidači, jedan lagan servis:**

1. Nakon uspješne inicijalizacije autentičnog registriranog identiteta u SvelteKit `+layout.svelte`, **ako je `document.visibilityState === 'visible'`**. Isto vrijedi pri izravnom otvaranju `/misije`, `/profil`, `/red` i drugih dubokih poveznica.
2. Nakon prijave/registracije i promjene identiteta, nakon što je novi token zaista pohranjen (projekt već koristi događaj `kaladont:identitet-promijenjen`).
3. Kod `visibilitychange` iz hidden → visible, uz valjanu registriranu sesiju. Sam fokus prozora ne treba biti novi dan ako se već danas zabilježio.
4. Ako je korisnik ostavio tab vidljiv preko ponoći i **svjesno nastavio koristiti aplikaciju**, dodati lagani one-shot na prvi smisleni klik/tipku/navigaciju **nakon sljedeće serverske zagrebačke ponoći**. Bez trajnih timer-pingova ili noćnog polling-a.

**Nemoj** računati dan samo zato što je u browseru ostao valjan token. Nemoj koristiti sam `localStorage` kao autoritet; ne može potvrditi je li korisnik stvarno prijavljen. Na klijentu zadržati tek optimizaciju „već pokušano / već potvrđeno za ovaj serverski datum”, uz oslonac na server za konačnu odluku.

**Klijentski zahtjev:** jedan centralni servis (npr. `$lib/aktivnost-dana.ts`) s kratkim single-flight dedupeom; više komponenti ne šalje vlastite neovisne zahtjeve. Nakon neuspješne mreže dopustiti retry pri sljedećoj **stvarnoj** vidljivoj aktivnosti, ne u beskonačnoj petlji.

**Ako se na PR 03 već nadovezuje jedan autentificirani bootstrap:** razmotriti integraciju u taj tijek, ali samo ako se podudaraju gornji uvjeti vidljivosti; ne bilježiti aktivni dan pri serverskom periodičnom dohvaćanju misija.

## 4. Granice dana i kalendar (bez pretpostavke 24 sata)

- Izdvojiti čistu funkciju, primjerice `lokalniDatumZagreb(trenutak: Date): 'YYYY-MM-DD'`, i `jeSljedeciKalendarskiDanZagreb(prethodni, novi)`; iskoristiti postojeću infrastrukturu u `paketi/zajednicko/src/ljestvice.ts` (`ZONA_LJESTVICA`, `kalendarskeGranice`, `zagrebackaPonoc`) bez prepisivanja vremenske aritmetike u više modula.
- Oznaka dana neka bude **PostgreSQL `date`** ili kanonski `YYYY-MM-DD` izveden poslužiteljskim UTC trenutkom i zonom Europe/Zagreb.
- Za sljedeći dan koristiti **kalendarski pomak datuma** (npr. `2026-03-28` → `2026-03-29`), ne `Date.now() - lastTime <= 24*60*60*1000`.
- Server određuje `sada`, `lokalniDatum`, granice i novi niz. `POST` ne prima klijentski datum, broj dana ili user ID.
- Pri vraćanju trenutnog niza bez novog zapisa definirati *status na današnji datum*: ako je zadnji potvrđeni dan danas ili jučer, prethodni niz ostaje otvoren za nastavak; ako je prošlo više od jednog kalendarskog dana, **prikaz trenutačnog niza je 0** do nove aktivnosti. Sačuvani povijesni agregat u bazi može ostati do sljedećeg valjanog upisa; razdvojiti pojam „trajni posljednji niz” i „trenutno aktivni niz na današnji datum”.
- Nema backfill-a prethodnog dana na temelju XP-a, `igraci.zadnjaAktivnost`, starih login logova, sesija ili odigranih partija. Nema retroaktivnog otključavanja prije datuma uvođenja značajke.

### 4.1. Obvezni DST primjeri za 2026.

| Test | Očekivanje |
|---|---|
| `2026-03-28` → `2026-03-29` → `2026-03-30` | Tri uzastopna kalendarska dana, iako je 29. 3. dan od 23 sata |
| Zagrebačka granica `2026-03-30 00:00` | `2026-03-29T22:00:00Z`; sekundu ranije je 29. 3. |
| `2026-10-24` → `2026-10-25` → `2026-10-26` | Tri uzastopna dana, iako je 25. 10. dan od 25 sati |
| Zagrebačka granica `2026-10-26 00:00` | `2026-10-25T23:00:00Z`; sekundu ranije je 25. 10. |
| Uređaj UTC / America/New_York / Asia/Tokyo | Jedan te isti datum Zagreb za isti serverski trenutak; bez različitih streakova |

## 5. Baza podataka: jedan autoritativni model

**Prijedlog:** zasebna evidencija dana + zaseban agregat niza, oba po registriranom igraču. Agent može predložiti ekvivalentnu shemu, ali mora zadovoljiti sve invarijante i testove, uključujući postojeću migracijsku strategiju projekta.

### 5.1. Tablica `aktivnost_igraca_dani`

- `igrac_id UUID NOT NULL REFERENCES igraci(id) ON DELETE CASCADE`
- `lokalni_datum DATE NOT NULL` (po Europe/Zagreb)
- `zabiljezen_at TIMESTAMPTZ NOT NULL DEFAULT now()` (audit prve potvrde)
- **`PRIMARY KEY (igrac_id, lokalni_datum)`**
- Bez spremanja povijesti lokacije, IP-a, tabova, user-agenta ili nepotrebnih osobnih podataka.

### 5.2. Tablica `niz_aktivnosti_igraca`

- `igrac_id UUID PRIMARY KEY REFERENCES igraci(id) ON DELETE CASCADE`
- `zadnji_aktivni_datum DATE NOT NULL`
- `trenutni_niz INTEGER NOT NULL CHECK(trenutni_niz >= 1)`
- `najbolji_niz INTEGER NOT NULL CHECK(najbolji_niz >= trenutni_niz)`
- `azurirano_at TIMESTAMPTZ NOT NULL DEFAULT now()`
- Invarijanta: najbolji niz je monotono rastući maksimum stvarnih uzastopnih dana; ukupan broj jedinstvenih valjanih dana nije zamjena za najdulji niz.

**Prednosti:** upis dana je jedinstven i može se auditirati; agregat je brz za profil. **Ne održavati drugi nezavisni brojač najbolje serije** u `napredak_dostignuca_igraca` ako bi lako odstupao. Umjesto toga, profilna funkcija za novo dostignuće eksplicitno čita `najbolji_niz` iz `niz_aktivnosti_igraca`, ili agent mora dokazati jednako konzistentno rješenje u istoj transakciji.

**Migracije:** generirati legitimnu Drizzle migraciju i metapodatke iz postojećeg stanja; inicijalno **bez predpopunjavanja** postojećim korisnicima, bez masovnog brisanja/rekreiranja. Ako PR 03 uvodi tablice, pridružiti se novom redoslijedu migracija i provjeriti upgrade starijih podataka. Prije produkcije planirati backup i provjeru migracijskog upgradea (`migracije:upgrade-test`).

## 6. Poslužiteljska operacija: atomarno zabilježi aktivan dan

Pseudokod (opis transakcije, ne gotov patch):

```text
zabiljeziAktivniDan(autentificiraniIgracId, sat = serverClock):
  1. server provjeri: prijavljen registrirani/admin čovjek, nije obrisan, nije bot
  2. danas = zagrebackiDatum(sat.sada())
  3. transakcija:
       osiguraj red u niz_aktivnosti_igraca za igraca ili stabilan per-player lock
       zakljucaj agregatni red (SELECT ... FOR UPDATE), konzistentnim redoslijedom
       INSERT aktivnost_igraca_dani(igracId, danas)
         ON CONFLICT DO NOTHING RETURNING ...
       ako red nije umetnut:
         vrati postojeće stanje, ne dodjeljuj dostignuce, ne osvjezi 'novo'
       ako prvi valjani datum:
         trenutni = 1, najbolji = max(stariNajbolji, 1)
       inace ako je danas = sljedeci kalendarski datum nakon zadnjeg:
         trenutni = stariTrenutni + 1; najbolji = max(stariNajbolji, trenutni)
       inace ako je danas noviji uz propusteni dan:
         trenutni = 1; najbolji = max(stariNajbolji, 1)
       inace:
         zabraniti retroaktivni ili pogresno poredani datum, bez umanjivanja stanja
       upisi agregat i eventualno novu razinu dostignuca u dostignuca_igraca
       sve ili nista (commit / rollback)
  4. vrati snapshot (datum, trenutni, najbolji, razina, novootkljucanaRazina ili null)
```

**Istodobnost / zamke:**

- **Zaključavanje po igraču** i jedinstvenost `(igrac_id, lokalni_datum)` sprječavaju da dva uređaja oboje računaju „jučer” i narastu za 2.
- Pri prvom ikad upisu dva paralelna zahtjeva moraju završiti s **jednim** agregatom i jednim datumom bez `500 unique violation`; ispravno riješiti `INSERT ... ON CONFLICT` + zaključavanje.
- Ne potvrđivati upis dana prije eventualnog upisa dostignuća izvan transakcije. Ako drugi dio padne, retry mora moći ponoviti cijelu stvar, ne izgubiti zvjezdicu zbog već umetnutog dana.
- Za `dostignuca_igraca` poštovati postojeći jedinstveni ključ `(igrac_id, dostignuce_id)` i `GREATEST(stara_razina, nova_razina)`, `prvo_otkljucano` ostaje vrijeme **prvog** otključavanja, a `zadnje_otkljucavanje` mijenja se **samo** kod stvarnog povećanja razine.
- Ne izvoditi obavijest iz toga što je `GET /profil` vratio `razina>0`; to bi davalo toast pri svakom posjetu. Samo svježi transakcijski rezultat nosi `novootkljucanaRazina`.
- Ne zapisivati aktivan dan za drugačiji račun koji je bio otvoren u prethodnom tabu; server odlučuje igrača iz autentificirane sesije, a klijent pri promjeni identiteta resetira svoj dedupe ključ.
- U slučaju paralelnih transakcija s drugim sustavima (`Majstor misija`, napredak partije) ne držati globalni lock cijelog sustava; koristiti zaključavanje *samo konkretnog igrača* i dosljedan redoslijed zaključavanja.
- Nema vanjskog crona za „reset niza”: prekid se izračunava iz dana i primjenjuje na prvom sljedećem valjanom dolasku; očuvati beste niz i razinu.

## 7. API ugovor i autentikacija

### 7.1. Predloženi endpoint

`POST /api/racuni/aktivnost-dana`, bez tijela ili `{}`. Može se zamijeniti već postojećim potvrđenim aktivnim bootstrap pozivom ako je u PR 03 stvarno implementiran, pod uvjetom da se **ne izvršava** tijekom pozadinskog polling-a.

**Autentikacija:** postojeći `zahtijevajPrijavu` + dodatno `igrac.upravljac === 'covjek'` + `obrisanAt IS NULL`. Ne koristiti `igracId` iz zahtjeva, patha ili bodyja. Nikada ne dozvoliti botu s registriranim računom aktivnost. Predložena semantika: 401 za neautentificiranog/gosta; 403 za neovlašteni bot/vrstu i blokirani račun; validan čovjek dobiva 200 i pri ponavljanju.

**Predloženi 200 odgovor:**

```json
{
  "ok": true,
  "lokalniDatum": "2026-11-04",
  "trenutniNiz": 5,
  "najboljiNiz": 8,
  "razinaDostignuca": 2,
  "novootkljucanaRazina": null,
  "serverTimeIso": "2026-11-04T13:30:00.000Z",
  "sljedeciDanOdIso": "2026-11-04T23:00:00.000Z"
}
```

`sljedeciDanOdIso` je primjer sljedeće **zagrebačke** ponoći za studeni (CET, UTC+1). Ne hardkodirati offset, poštovati DST. Samo prvi upis koji stvarno prelazi prag vraća `novootkljucanaRazina` (2, 5, 10, 20 ili 30 **nije** razina; razina je indeks 1–5). Ovaj primjer ima `najboljiNiz = 8`, pa razina 2, bez nove razine.

**Minimalna podrška za profil:** koristiti postojeći `GET /api/profil` i `GET /api/dostignuca` kao jedinstven autoritativni izvor kataloga. Moguće dodati malen objekt `aktivnostDana: { trenutniNiz, najboljiNiz, zadnjiAktivniDatum }` na **vlastiti** profil. Javni profil po potrebi dobiva samo dostignuće/razinu, **ne povijest datuma dolazaka**.

**Caching:** za privatne podatke profila i dan aktivnosti `Cache-Control: private, no-store`, bez cachea na proxyju ili dijeljenja između korisnika.

## 8. Uklapanje u postojeći sustav dostignuća

- U `paketi/zajednicko/src/dostignuca.ts` dodati definiciju: `id: 'stalno_si_tu'`, `naziv: 'Stalno si tu'`, smislen pozitivan opis, `kategorija: 'napredak'` ili postojeća najbliža kategorija, `pragovi: [2,5,10,20,30]`, `brojac: 'najboljiNizAktivnosti'`, `vrijediUPrivatnoj: false` **kao sigurnosna oznaka u postojećem modelu**, ali aktivnost nije partijski događaj te se računa i kad osoba ne igra.
- Proširiti tip `BrojacDostignuca` i mapiranje profilnih vrijednosti. **Ne dozvoliti** da generički `izracunajNovaDostignuca` slučajno dodjeljuje `stalno_si_tu` na završetku partije; ako model dopušta, izdvojiti izračun iz aktivnog-dana servisa i sačuvati isključivo jedan autoritativni put zapisivanja. Posebno provjeriti `Object.entries(delta)` / čitanje polja koje u DB-u ne postoji.
- U `dohvatiDostignucaZaIgraca` (`aplikacije/posluzitelj/src/profil/rute.ts`) izvuci `najboljiNizAktivnosti` iz novog agregata, ne iz `napredak_dostignuca_igraca` ako ga tamo nema. Ostatak mape dostignuća ostaje nepromijenjen.
- U `dostignuca_igraca` zapisivati `razina` trajno i samo pri **novom** prelasku; već osvojene zvjezdice nikad ne nestaju nakon prekida niza.
- `UKUPNO_ZVJEZDICA_DOSTIGNUCA` i ukupni brojači profila moraju se automatski uključiti; provjeriti da korisnički i javni profil prikazuju iste razine, ali samo vlastiti prikazuje eventualni trenutni niz.
- `odaberiIstaknutaDostignuca` i `DostignucaIstaknuta.svelte` ne smiju izgubiti postojeća dostignuća ili promijeniti prikaz na nečitljivom mobitelu. Dopušteno prikazati novo dostignuće prema postojećim pravilima prioriteta; ne zahtijevati da odmah bude istaknuto svakom igraču.
- Dodati ikonu mapiranu u postojeći helper `aplikacije/web/src/lib/ikone-dostignuca.*`. Koristiti postojeći set i vizualni jezik, bez zasebnog UI sustava ili upisivanja nepostojećeg patha bez datoteke. Ako novi ilustracijski asset stvarno treba, predložiti najmanju izmjenu za potvrdu.
- `DostignuceKartica.svelte` već prikazuje razinu, opis, sljedeći cilj i progress. Prilagoditi formulaciju samo za dan/niz gdje treba da se jasno čita „Najbolji niz: 8 dana”, a ne generički „8 / 10” bez konteksta; očuvati ostale kartice.

## 9. UX za dijete: pohvala, ne obveza

**Predloženi primjer na vlastitom profilu:**

> **Stalno si tu** · ⭐⭐☆☆☆  
> Najbolji niz: **8 dana**  
> Sljedeća zvjezdica nakon **10 dana zaredom**.

Ako je danas potvrđen novi aktivni dan i korisnik upravo otključa novu zvjezdicu, dopušten je **jedan** kratki pozitivan signal iz serverom potvrđenog odgovora, npr. „Bravo! Stalno si tu, 5 dana zaredom!” Nema dodatnog XP-a. Ne prikazivati ponovljeni toast pri refreshu, noćnoj promjeni dana bez akcije ili otvaranju javnog profila.

Ako je niz prekinut, **ne naglašavati gubitak**. Standardni kartični prikaz nastavlja prikazivati najbolji postignuti niz i trajno osvojene zvjezdice. Po potrebi u vlastitom profilu neutralno „Trenutni niz: 1 dan”; bez crvene uzbune i bez poruka koje potiču svakodnevno otvaranje pod pritiskom.

Pristupačnost: hrvatski nazivi, semantička zvjezdica/tekst za čitače zaslona, tipkovnica, kontrast u obje teme, mobilni prikaz i `prefers-reduced-motion`. Bez nove trajne animacije.

## 10. Integracija s drugim PR-ovima i identitetom

- **PR 03/04:** ne dirati engine misija ni `/misije`; samo poštovati već implementirane autentifikacijske obrasce. Streak se ne ažurira automatski isplatom misijskog XP-a. Dnevni streak nije isto što i W06.
- **PR 01/02:** ne dirati izračune partijskih pohvala, oznake kolekcije ili redoslijed završnih sekcija. „Stalno si tu” ne zahtijeva prikaz na završnom ekranu partije jer se može otključati bez igranja; dovoljan je postojeći katalog i kratka potvrda aktivnog dolaska.
- **Guest → registered:** postojeći `racuni/rute.ts` ažurira zapis istog igrača. Evidencija streaka kreće tek nakon valjanog registriranog posjeta. Nikad ne računati ranije gostujuće dane.
- **Logout / account switch:** poslije odjave/izmjene identiteta klijent resetira svoj dedupe i, ako novi račun nije registriran, ne šalje upis. Zakasnjel odgovor prethodnog računa ne smije prikazati novu zvjezdicu drugom računu.
- **Istodobno otvoreni uređaji:** server serijalizira operaciju po `igrac_id`. Klijent možda prikaže trenutne podatke s malom odgodom, ali trajni broj dana i dostignuća su točni.
- **Brisanje računa:** `racuni/brisanje.ts` već briše trajna dostignuća i radi soft-delete računa. Nova evidencija i agregat moraju se ukloniti u postojećem postupku brisanja, iako imaju `ON DELETE CASCADE` jer **soft-delete ne aktivira CASCADE**. Uvažiti postojeći režim zaštite bot/admin računa.
- **Ne koristiti `igraci.zadnjaAktivnost`** kao streak: to je globalna aktivnost s drugim značenjem i potencijalnim automatskim ažuriranjima; ovdje je potreban posebno potvrđen aktivni dan.

## 11. Sigurnost, podaci i performanse

1. Server session je autoritativna: `zahtijevajPrijavu` + `upravljac === 'covjek'` + nije obrisan. Nepouzdane klijentske `igracId`, `datum`, `trenutniNiz`, `najboljiNiz`, `razina` ignorirati ili odbiti.
2. Ne dodati javnu rutu za povijest svih aktivnih dana. Javni profil smije pokazati sam achievement, ne kalendar prisutnosti djece.
3. Jedan INSERT + agregatni UPDATE u slučaju novog dana; no-op za ostale posjete. Izbjegavati skeniranje čitave povijesti aktivnosti pri svakom pozivu i globalne cronove.
4. Baza je trajni izvor istine za višestruke instance poslužitelja; ne smiju se koristiti lokalni in-memory brojači kao jedini izvor.
5. Etag, HTTP cache ili race u klijentu ne smiju lažno otključati dan. Server-verified read/write i auth uvijek ostaju ključni.
6. Logirati samo agregatne tehničke neuspjehe i relevantne DB greške; ne ispisivati sesijske tokene ni osobne dane korisnika u produkcijske logove.
7. Vrijeme, transakcije i potvrde povratka ne moraju biti blokirajući za početno učitavanje igre: u slučaju neuspjeha evidencije **igra i dalje radi**, uz opcionalan nenametljiv retry pri sljedećoj stvarnoj aktivnosti.

## 12. Testna matrica (obvezno)

### 12.1. Unit testovi: pravila i kalendar

| ID | Slučaj | Očekivanje |
|---|---|---|
| **S05-U01** | Prvi aktivni dan | Trenutačni 1; najbolji 1; razina 0 |
| **S05-U02** | Drugi uzastopni dan | Trenutačni 2; najbolji 2; razina 1 |
| **S05-U03** | Prag 5 | Razina 2 tek na petom danu |
| **S05-U04** | Prag 10 | Razina 3 tek na desetom danu |
| **S05-U05** | Prag 20 | Razina 4 tek na dvadesetom danu |
| **S05-U06** | Prag 30 | Razina 5; ne postoji šesta |
| **S05-U07** | 31. / 60. dan | Najbolji može rasti, razina ostaje 5 bez nove nagrade |
| **S05-U08** | Dva posjeta u isti dan | Nema dodatnog dana/razine |
| **S05-U09** | Razmak od 1 propuštenog kalendarskog dana | Na idući dolazak trenutačni 1; najbolji i zvjezdice ostaju |
| **S05-U10** | Povratak nakon velike pauze | Trenutačni 1, bez backfill-a, najbolji očuvan |
| **S05-U11** | Proljetni DST 2026, 28/29/30. ožujka | Svaki datum je jedan uzastopni dan, bez 24h aritmetike |
| **S05-U12** | Jesenski DST 2026, 24/25/26. listopada | Svaki datum je jedan uzastopni dan, bez dvostrukog brojenja ponovljenog sata |
| **S05-U13** | 23:59:59 / 00:00:00 po Europe/Zagreb | Različiti datumi upravo na zagrebačkoj ponoći |
| **S05-U14** | Kraj mjeseca/godine, 28/29. veljače | Kalendarski sljedeći dan ispravan; 30-dnevni prag ne ovisi o kalendarskom mjesecu |
| **S05-U15** | Isti UTC trenutak na raznim klijentskim zonama | Isti serverov zagrebački datum |
| **S05-U16** | Čitanje starog stanja nakon pauze | Trenutačni prikaz 0 nakon propuštenog jučer i danas; najbolji sačuvan |
| **S05-U17** | `jezik_u_plamenu` i javni pobjednički niz | Nisu pogođeni novim brojačem |

### 12.2. DB i API integracija

| ID | Slučaj | Očekivanje |
|---|---|---|
| **S05-D01** | Prva autorizirana aktivnost | 1 red u `aktivnost_igraca_dani`, 1 agregat, nema zvjezdice |
| **S05-D02** | 20 ponovljenih zahtjeva u danu | Točno 1 red, trenutačni ne raste, nema novih obavijesti |
| **S05-D03** | Dva paralelna zahtjeva istoga računa i dana | Jedan logički upis, bez `500`, točna razina |
| **S05-D04** | Dva različita uređaja isti račun tijekom prvog dana | Isti rezultat; nema `unique violation` |
| **S05-D05** | Dva različita računa isti dan | Neovisna dva niza; bez curenja osobnih podataka |
| **S05-D06** | Dostizanje 2 / 5 / 10 / 20 / 30 | Točno jedna promjena `dostignuca_igraca` po pragu; `prvoOtkljucano` očuvano |
| **S05-D07** | Retry ili reconnect poslije dovršene transakcije | Ne osvježava `zadnjeOtkljucavanje`, ne vraća novu razinu ponovo |
| **S05-D08** | Simulirana greška između upisa dana i dostignuća | Rollback svega; sljedeći valjani retry uredno otključava |
| **S05-D09** | Gost token | 401 ili potvrđeni javni model bez pisanja; nema aktivnog dana |
| **S05-D10** | Neautoriziran zahtjev i pokušaj podmetanja tuđeg ID-a | Nema knjiženja tuđem računu |
| **S05-D11** | Bot s `vrsta='registriran'`, `upravljac='bot'` | Odbijen; ne dobiva dan ni zvjezdice |
| **S05-D12** | Odjavljeni/obrisani račun | Bez upisa; nema pristupa povijesti |
| **S05-D13** | Gost postane registriran istog dana | Streak od dana registriranog aktivnog posjeta; bez retroaktivnih gostujućih dana |
| **S05-D14** | Dnevni upis 1 s prije i 1 s nakon midnight | Dva datuma; +1 samo u slučaju stvarno novih dana |
| **S05-D15** | Proljetni i jesenski DST | Bez dvostrukih datuma; ni reset ni dodatni zapis u ponovljenom satu |
| **S05-D16** | Migracija postojeće baze s korisnicima i dostignućima | Svi prethodni podaci očuvani; novi korisnici i stari korisnici počinju od prvog valjanog dana |
| **S05-D17** | Soft-delete računa s aktivnim danima | Novi dnevni/audit zapisi i agregat očišćeni u istom postojećem toku |
| **S05-D18** | Istodobni rad sa završetkom misije iz PR 03 | Nema deadlocka ili izgubljenih ažuriranja dostignuća drugih vrsta |

### 12.3. UI/E2E i regresije

| ID | Slučaj | Očekivanje |
|---|---|---|
| **S05-E01** | Registrirani otvori `/` | Nakon bootstrapa i vidljivog taba jedan upis dana; glavna navigacija radi |
| **S05-E02** | Registrirani otvori deep link `/profil` | Upis dana bez posjeta naslovnici |
| **S05-E03** | Vidljivi tab ostavljen preko ponoći, bez interakcije | Ponoć sama ne dodaje drugi dan |
| **S05-E04** | Korisnik stvarno klikne / tipka nakon ponoći | Novi dan se evidentira jednom, bez pollinga |
| **S05-E05** | Tab hidden pa next-day visible | Novi dan se evidentira pri povratku; hidden polling ne broji |
| **S05-E06** | Login/logout/switch računa | Ne prikazati achievement drugog računa zbog zakasnjele promise |
| **S05-E07** | Korisnik s 2+ dana otvori vlastiti profil | „Stalno si tu” s točnim brojem zvjezdica/progresom |
| **S05-E08** | Otvaranje javnog profila | Vidljiva samo dopuštena razina, bez popisa datuma dolazaka; ne broji posjet vlasniku javnog profila |
| **S05-E09** | Nova zvjezdica nakon potvrđenog prvog upisa | Točno jedna pozitivna obavijest, bez druge pri refreshu |
| **S05-E10** | Gost vidi profil/navigaciju | Ne prikazati lažni streak ni zaključavanje koje sugerira da se dani skupljaju gostu |
| **S05-E11** | Mobilne širine 320/390px i desktop, obje teme, font za disleksiju | Kartica se ne reže i nema horizontalnog scrolla |
| **S05-E12** | A11y: fokus, čitač zaslona, reduced motion | Značenje zvjezdica dostupno tekstom; nema prisilne animacije |
| **S05-E13** | PR 03/04 `/misije`, zamjena i završni ekran | Bez regresa i bez lažnog povećanja W06 ili misijskog XP-a |
| **S05-E14** | Slab internet ili greška endpointa | Igra se normalno učitava; poruka samo ako treba, retry na kasniju stvarnu aktivnost |

## 13. Kako spriječiti flaky testove i usporavanje CI-ja

- Za čistu logiku unositi **injektirani sat / poznat UTC trenutak**, bez `new Date()` iz stvarnoga sada i bez `sleep(1000)`.
- Testovi kalendara ne mijenjaju globalnu `TZ` procesnog runnera; pozivati čiste funkcije s eksplicitnom `Europe/Zagreb` zonom.
- DB integracija: zasebni računi/UUID-i i čišćenje po testu; ne mijenjati shared globalni clock i ne ovisiti o stvarnom datumu CI-ja.
- Za paralelne pozive koristiti `Promise.all` i stvarne integracijske asercije nad konačnim redovima/razinama, ne očekivati fiksan redoslijed odgovora.
- E2E UI: API fixture ili fiksna testna DB serija za otključavanje; za reakciju vidljivosti koristiti browser event i deterministic response, ne čekati stvarna 24 sata ili 30 dana.
- Provjeriti da Playwright tests na mobilnom i desktopu ne ovise o rasporedu učitavanja asseta/animacija; čekati `data-testid` i vidljiva dostupna stanja, ne proizvoljni timeout.
- Ne dodavati desetke punih E2E prolazaka za svaki dan. Jedan-dva reprezentativna toka kroz browser, ostalo unit + DB integracija.
- Lokalno: ciljano build/typecheck/testovi, pa puni postojeći CI. Ne smanjivati sigurnosne ili migracijske gateove radi brzine.
- CI trenutno provjerava migracijski upgrade stare baze; ako test očekuje točno stare stupce, proširiti fixture i asercije dovoljno da novi dijelovi budu pokriveni, bez brisanja postojećih provjera.

### 13.1. Preporučeni redoslijed provjera

```bash
pnpm --filter zajednicko build
pnpm --filter posluzitelj build
pnpm --filter web check
pnpm lint
# Dodati ciljane Vitest datoteke prema stvarno dodanim putanjama.
# Integracijski testovi trebaju testnu Postgres bazu s primijenjenim migracijama.
pnpm --filter posluzitelj test
pnpm test:e2e
```

**Napomena:** prije izvođenja provjeriti stvarne skripte/CI nakon PR 01–04; ne pretpostavljati da je svaka naredba dostupna na svakoj grani. Puni E2E pokrenuti kada su server i testni Postgres spremni. U opisu PR-a dokumentirati točne izvršene naredbe i rezultate, ne navoditi nešto što nije stvarno pokrenuto.

## 14. Implementacijski plan u jednom PR-u

1. **Pregled i Plan mode:** provjeriti PR 01–04 i aktualne relevantne API-je/tipove; potvrditi odluke iz §16.
2. **Shared pravila:** `stalno_si_tu` u katalogu, izolirana funkcija pragova i kalendarski datum, bez dodira misija.
3. **Migracije i trajni model:** tablica dana + agregat, PK/indeksi/FK/constrainti, integritet migracije.
4. **Servis aktivnosti:** autentificirani atomarni upis, idempotentnost, otključavanje svježeg dostignuća i čitanje trenutno/best.
5. **API:** lagan endpoint ili potvrđeni bootstrap hook i minimalni stabilni response; obavezna autentikacija.
6. **Klijent okidač:** centralizirani visible-visit lifecycle, promjena identiteta, prvi stvarni input nakon ponoći, bez polling-a.
7. **Profil:** postojeće kartice i javni profil, ikona, najbolje/trenutno, očuvanje oznaka Novo i broja zvjezdica.
8. **Brisanje računa / privatnost:** ugraditi uklanjanje novih zapisa u soft-delete.
9. **Testovi:** prema matrici, posebno race/DST/account-switch/rollback; dokumentacija i slike.
10. **PR:** samostalna testirana cjelina protiv odgovarajućeg `main`, bez preuređenja CI-ja ili drugih gamifikacijskih PR-ova.

## 15. Minimalni kriteriji za merge

- [ ] `Stalno si tu` ima točno pet pragova: 2, 5, 10, 20, 30.
- [ ] Dan = valjan svjestan dolazak **registriranog čovjeka** u vidljivu aplikaciju, ne stalan otvoren tab ni ponovljeni login.
- [ ] Brojanje koristi **Europe/Zagreb** i oboje DST prijelaza; ne ovisi o uređaju.
- [ ] Jedan dan po `(igrac_id, lokalni_datum)` te točno jedna promjena niza pri paralelnim posjetima.
- [ ] Prekid vraća trenutni niz na 1 pri povratku, ali **najbolji** i zvjezdice ostaju.
- [ ] Prijava nakon registracije gosta ne rekonstruira stare gostujuće dane.
- [ ] Bot i obrisani/neprijavljeni račun nemaju napredak.
- [ ] Profil, dostignuća i javni profil prikazuju isto trajno otključavanje i postojeći format kartica.
- [ ] Nema dodatnog XP-a ni prepravljanja PR 03/04 misija.
- [ ] Rollback usred upisa, dva uređaja i retry ne stvaraju duple nagrade.
- [ ] Soft-delete uklanja podatke aktivnosti, bez izlaganja javne detaljne evidencije posjeta.
- [ ] Unit/DB/E2E testovi i puni postojeći CI prolaze; migracijski upgrade test prolazi.
- [ ] PR sadrži screenshotove barem desktop i mobitel te dokumentirane sve produktne odluke.

## 16. Otvorene odluke za potvrdu prije implementacije

**Ovo su detalji implementacije, a ne ovlaštenje agentu da sam mijenja produkt:**

1. **Prvi dolazak nakon aktivacije:** preporuka je započeti niz tek prvim stvarno valjanim posjetom *nakon deploya* značajke, bez retroaktivnih dana. Potvrditi.
2. **Kako prikazati trenutačni niz:** preporuka je na vlastitom profilu prikazati `trenutni` i `najbolji`, a na javnom samo najbolji i osvojenu razinu; bez popisa datuma. Potvrditi.
3. **Mala obavijest kad se osvoji nova zvjezdica:** preporuka je jednu kratku pozitivnu obavijest na potvrđenom upisu dana, bez konfeta pri svakom otvaranju aplikacije. Potvrditi.
4. **Točka aktiviranja:** preporuka `+layout` visible bootstrap + `visibilitychange` + prvi korisnički input nakon serverove ponoći. Ako PR 03 već ima točan aktivni bootstrap, integrirati s njim. Predstaviti stvarni kod koji se planira mijenjati.

**Sve ostalo u §2 treba tretirati kao dogovoreno.** Nema potrebe ponovno otvoriti pitanje broja PR-ova, pet pragova ili dodjele XP-a; ovdje završavamo značajku u petom PR-u.

---

## 17. Kratak predložak PR opisa za GitHub

**Naslov:** `feat: dostignuce Stalno si tu i sigurni niz aktivnih dana`

**Što dodaje:** evidenciju zagrebačkih aktivnih dana, trenutačni/najbolji niz, 5 trajnih razina dostignuća, profilni prikaz i minimalni autentificirani signal posjeta.

**Što ne mijenja:** partijski XP, misije, ljestvice, završni ekran, postojeća dostignuća i pravila privatnih soba/treninga.

**Provjere:** unit (kalendar/DST), integracijske (idempotentnost/utrke/rollback/brisanje), UI i mobilni E2E, migracijski upgrade, lint/typecheck/build/CI.

**Rizik i rollback:** nova aditivna migracija + minimalni lifecycle hook; pri neuspjehu upisa ne blokirati igru. Dokumentirati deployment/rollback putanju prije spajanja.

**Predaja:** screenshotovi vlastitog profila i kratko objašnjenje kako se dan evidentira samo jednom; potvrđene otvorene odluke.
