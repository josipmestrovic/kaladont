# Kaladont ljestvice

Specifikacija za agenta · 2. 10. 2026. · v1 za implementaciju nakon plan moda

## 1. Nalog i status

Implementirati pet vremenskih ljestvica igrača za Četveroboj i Dvoboj, vlastitu poziciju, prikaz deset susjednih igrača, položaje na profilu i zaključanu povijest godišnjih rezultata.

Ovaj dokument je priprema i specifikacija. Kod aplikacije nije izmijenjen, ništa nije objavljeno i stvarna produkcijska baza nije pregledana. Novi zadatak ne zamjenjuje ranije naloge za stabilnost igre.

Pregledan je aktualni dohvaćeni `origin/main`, commit **87bf60439cda67ab921e4a33683ea2f858c01dbe**, zadnji commit 26. 9. 2026. Pregled je obavljen 2. 10. 2026. u zasebnom checkoutu. Agent prije rada provjerava svoj HEAD i lokalne upute. Ne oslanjati se na raniji pregled 2c108c2: u novoj verziji postoje forma, nizovi pobjeda, CV i rano spremanje poraza.

Koristi postojeći TypeScript/pnpm/SvelteKit/Fastify/Postgres/Drizzle stack. Nije potreban Redis, novi mikroservis, event sourcing, nova infrastruktura za poruke ili spašavanje aktivne igre nakon restarta. Treba pouzdano spremiti metrike završene igre u već postojećoj transakciji.

## 2. Potvrđene odluke vlasnika

Ovo su zahtjevi, ne otvorena pitanja:

1. Pet ljestvica: **Prosjek bodova**, **Najduži niz riječi**, **Najduža riječ**, **Najbrži igrači** (prosječno vrijeme prihvaćenog poteza) i **Najduži niz pobjeda**.
2. Svaka ima **Dnevnu, Tjednu, Mjesečnu, Godišnju i Svih vremena**.
3. Četveroboj i Dvoboj su odvojeni. Ne miješati podatke načina.
4. Dnevna traži **najmanje 10 igara toga dana**. Sve dulje traže **najmanje 20 unutar baš tog razdoblja**. Svih vremena traži 20 u ukupnom obuhvatu.
5. Vlasnik je izričito izabrao **pristup A**. Raniji zahtjev „na dnevnoj znači automatski rangiran na tjednoj” zamijenjen je ovim pravilom. Današnje igre automatski pridonose svim duljim obuhvatima, ali rang se dobiva tek kad je njihov minimum ispunjen.
6. Hrvatsko lokalno vrijeme i ponoć: zona **Europe/Zagreb**, ne fiksni UTC+1/UTC+2.
7. Godišnja je kalendarska: npr. 2026. Nakon završetka ide u zaključanu povijest.
8. Glavni rezultat određuje mjesto; kod istog rezultata prednost uvijek ima **više odigranih igara u istom načinu i razdoblju**.
9. Broj igara mora biti vidljiv u svakoj tablici. Uz svaku jasno opisati kriterij, minimum i izjednačenje.
10. Korisnik bira **Top 10** ili **Oko mene**. Drugi prikaz ima ukupno 10 redaka, uključujući igrača.
11. Vlastiti redak označiti narančasto i tekstom **Ovo si ti**. Identitet uspoređivati po ID-u, nikad nadimku.
12. Uz svaki odabir razdoblja stoji **Tvoja pozicija: 500**, bez „500 / 12340”.
13. Na profilu ispod avatara prikazati mjesta po razdobljima i smislen tekst kada mjesta nema.
14. Novi javni URL je **/ljestvice**.
15. Svih vremena otključava se tek nakon prve godine javnog praćenja. Dotad se gumb može kliknuti i dobiti objašnjenje s datumom.
16. Staging podaci/računi ne prenose se u produkciju. Open beta i early access koriste istu produkcijsku bazu; rezultati i računi se pri promjeni oznake izdanja ne resetiraju.

**Primjeri pristupa A:** 10 igara danas = dnevna rangiran, tjedna/mjesečna još ne ako imaju samo tih 10. Dvadeset igara raspoređeno 7+7+6 daje tjedni rang, ali nijedan dnevni. Nijedna igra danas = nema današnjeg ranga; tjedni/mjesečni mogu postojati. Dvadeset dvoboja i nula četveroboja ne otključava četveroboj.

## 3. Početne preporuke i pitanja

Gdje korisnik nije izričito odlučio, ovaj dokument daje konkretan zadani prijedlog. Agent ih sažima u planu i pita samo bitne stavke iz završnog poglavlja. Ne pretvarati svaku implementacijsku sitnicu u novo odobravanje.

Zadano predlažemo:

- tjedan ponedjeljak–ponedjeljak;
- samo završene spremljene javne igre; privatne, aktivne i poništene isključene;
- rezultati pripadaju razdoblju završetka cijele igre, ne početka ili upisa pojedine riječi;
- zadržati postojeće sudjelovanje gostiju na ljestvicama, bez otvaranja njihova punog javnog profila;
- točna matematička vrijednost za poredak, zaokruživanje samo za prikaz;
- kad su rezultat i broj igara jednaki: ranije ostvarenje rezultata, zatim stabilni ID;
- rekord pobjeda broji samo pobjede unutar traženog razdoblja, odvojeno od postojeće vatre/XP niza;
- povijest godišnjih ljestvica obvezna; pregled prošlih dana/tjedana/mjeseci nije obvezan v1;
- početak podataka svih pet novih ljestvica zajednički i unaprijed definiran;
- jedna tablica odjednom, uz odabir kategorije, načina, metrike i razdoblja.

Pitanja o kronologiji ranog ispadanja, datumu početka, zatvaranju arhive i starim podacima posebno su označena jer ih postojeći kod čini stvarnim odlukama, a ne teorijom.

## 4. Nalazi iz aktualnog repozitorija

| Područje | Stanje u pregledanom kodu | Posljedica |
|---|---|---|
| Web ruta | `aplikacije/web/src/routes/ljestvica/+page.svelte` | Postoji jednina `/ljestvica`, ne tražena `/ljestvice`. Treba preusmjeravanje i ažuriranje linkova. |
| Poredak API | `profil/rute.ts`, GET `/ljestvica`, izvana `/api/ljestvica` | Koristi ukupne brojače `igraci`, minimalno 10, Top 10/100; nema vremenskih obuhvata ni around-me. |
| Vlastito mjesto | Poseban upit broji samo strogo veće prosjeke | Nema istog potpunog tie-breaka kao tablica; taj put također ne ponavlja filter obrisanih. Ne širiti ovu nedosljednost. |
| Riječi | `/api/rijeci/top` | Postojeća lista učestalosti riječi, ne lista osobnih rekorda. To su različiti proizvodi. |
| Javna povijest | `partije`, `sudioniciPartije`, `potezi` | Postoje način, početak/kraj, status, plasman, bodovi, prihvaćene riječi i trajanja. |
| Ukupni agregati | `igraci.odigrane`, `odigrane1v1`, bodovi, pobjede | Nisu dostatni za dan/tjedan/mjesec ili zamrznutu godinu. |
| DNK i rekordi | `dnkStatistikeIgraca`, `statistikeRijeciIgraca` | Ukupne vrijednosti po načinu; ne sadrže punu povijest kada je pojedini rekord ostvaren. |
| Metrike završene igre | `ZapisStatistikeRijeci` u `upis-partije.ts` | Motor već prosljeđuje broj/trajanje prihvaćenih poteza, najduži niz i riječ. Sačuvati ih po igraču i igri, ne samo ukupno. |
| Idempotencija | `zakljuciPartijuUBazi`, statusni claim + `obracuniPartija` | Novi upis vezati uz istu transakciju i claim; retry ne smije dvostruko povećati broj igara. |
| Pobjednički nizovi | `nizoviPobjedaIgraca`, shared `forma.ts` | Postoje `trenutniNiz` i životni `najboljiNiz`; ne predstavljaju rekord unutar proizvoljnog kalendarskog razdoblja. |
| Forma | `rezultatiFormeIgraca`, profil čita zadnjih 20 | To nije tablica za sve nove ljestvice. Samo čitanje zadnjih 20 nije cijeli tjedan/godina. |
| Rani poraz | `spremiRaniPorazUBazi` upisuje rezultat i prije završetka cijele igre | Ne uzeti taj zapis kao da je igra već konačno završena. Postoji mogućnost drukčijeg redoslijeda korisnikovih igara i završetaka stolova. |
| Riječni niz | Motor resetira `streakovi` na odbijenu riječ | Odbijeni pokušaji ne spremaju se u `potezi`; iz prihvaćenih redaka nije moguće točno obnoviti stari najduži niz. |
| Trajnost loga poteza | `zapisiPotez` hvata grešku i ne propagira je | Iako završni tok čeka promiseove, to nije dokaz da je svaki stari potez stvarno spremljen. Ne obećavati potpuni povijesni backfill. |
| Završno vrijeme | `partije.kraj` postavlja `new Date()` u završnom DB pokušaju | Retry preko ponoći može promijeniti razdoblje ako se ne sačuva stvarni trenutak kraja. |
| Profil | Oba profila već imaju CV, formu i podizbornike | Ugraditi mali blok poretka; ne zamijeniti te featuree ili ponovo graditi profil. |
| Brisanje računa | `racuni/brisanje.ts` anonimizira redak | Novi živi i arhivski prikazi trebaju uvažavati obrisanog igrača, bez vraćanja starih osobnih oznaka. |

U `sudioniciPartije` zasad nema per-game najdužeg niza/riječi niti ukupnog vremena prihvaćenih poteza. U `potezi` nema evidencije svih odbijenih riječi. U pregledanim produkcijskim izvorima nije pronađen posao koji briše svu povijest igara, ali stvarnu retenciju i vanjske skripte treba provjeriti u planu; odsutnost skripte iz repozitorija nije dokaz da podaci postoje u bazi.

## 5. Pet metrika: točne definicije

Prema preporučenom obuhvatu javnih konačnih rezultata, svi kandidati prvo zadovoljavaju broj završenih javnih igara u odabranom načinu i razdoblju. Taj se broj označava **Odigrane igre** i isti je za svih pet metrika. Ne računati broj poteza kao broj igara.

### 5.1. Prosjek bodova (`prosjek_bodova`)

`sum(spremljeni_bodovi) / count(zavrsene_javne_igre)`.

Veće je bolje. Uključiti i igre s 0 bodova. Bodove uzimati iz konačnog zapisa sudionika; ne preračunavati povijest po novoj verziji pravila. U Dvoboju postojeće bodovanje 1/0 znači da prosjek odgovara udjelu pobjeda, ali naziv ostaje prosjek bodova.

Ne primjenjivati minimalni životni rang kao dodatni uvjet. Ovo je sezonski poredak; rang na profilu i dalje se računa postojećim pravilima.

Prikaz: **Mjesto · Igrač · Prosjek bodova · Odigrane igre**. Prosjek u pravilu dvije decimale, uz objašnjenje da poredak koristi punu preciznost. Omogućiti detaljniju vrijednost u dostupnom objašnjenju ako se susjedni prikazani prosjeci čine isti, a stvarni nisu.

### 5.2. Najduži niz riječi (`niz_rijeci`)

`max(najduzi_niz_prihvacenih_rijeci_u_jednoj_igri)` za igre u razdoblju.

Niz prati postojeću semantiku motora: povećava se prihvaćanjem riječi, prekida kad postojeća pravila resetiraju streak, ne nastavlja se u sljedećoj igri. Ne mijenjati pravilo samo radi ljestvice. Sustavske riječi, tuđi potezi, eliminacijski događaji i neispravni socket paketi nisu prihvaćene riječi igrača. Prihvaćeni Kaladont koji motor obradi kao riječ ulazi kao i sada; zaseban efekt eliminacije nije još jedna riječ.

Sačuvati konačni `najduziStreak` iz memorije motora u sažetku sudionika. Ne zaključivati da svih 20 prihvaćenih riječi čini niz 20 ako je između bilo odbijanja.

Najbolji niz ostaje rekord i nakon kasnije pogreške. Kandidat s maksimumom 0 nema rezultat ove metrike i ne ulazi u tablicu s nulom.

Prikaz: **Mjesto · Igrač · Niz riječi · Odigrane igre**.

### 5.3. Najduža riječ (`najduza_rijec`)

Za svakog igrača izabrati jednu najdužu prihvaćenu riječ iz završenih javnih igara razdoblja. Duljina je broj grafema preko postojećeg `grafemi()` s njegovim iznimkama za digrafe, ne JavaScript `.length`.

Ne tražiti da riječ spada u bonus-kategoriju „duga”: i najduža riječ od 7 slova jest valjan osobni rezultat. Postojeća rječnička validacija ostaje izvor prihvatljivosti. Ne revalidirati staru riječ po promijenjenom rječniku pri svakom GET-u.

Jedan igrač = jedan redak. Pri više jednako dugih riječi istog igrača predloženo je: prva ostvarena po kanonskom vremenu završetka igre; unutar iste igre zadržati prvu zabilježenu najdužu riječ (postojeći `>` update), za konačnu tehničku izjednačenost koristiti ID igre. To pravilo bira prikazanu riječ i ne zamjenjuje inter-player prednost većeg broja igara.

Prikaz: **Mjesto · Igrač · Riječ · Broj slova · Odigrane igre**. Nijedan string se ne renderira kroz `{@html}`. Duge riječi se prelamaju, bez gubitka punog sadržaja.

### 5.4. Najbrži igrači (`brzina`)

`sum(trajanje_svih_prihvacenih_poteza_ms) / sum(broj_prihvacenih_poteza)`.

Manje je bolje. To je ponderirani prosjek svih poteza, ne prosjek prosjeka igara. Primjer: 1 potez od 1 s i 9 poteza od 9 s daje 8,2 s, ne 5 s.

Trajanje mjeri server prema postojećem početku poteza. Obuhvaća vrijeme do prihvaćene riječi, uključujući vrijeme potrošeno na prethodne odbijene pokušaje istog poteza ako ga postojeći motor tako mjeri. Klijentski sat, vrijeme slanja requesta i trajanje animacije nisu izvor.

Sustavski potezi, istek, odustajanje i prekid veze ne ulaze u zbroj/brzinski nazivnik. Završena igra bez prihvaćene riječi svejedno pridonosi broju **odigranih igara**, ali ne broju prihvaćenih poteza.

- Nazivnik 0 → nema rezultata brzine, nikad 0 s.
- Poznato valjano mjerenje 0 ms pojedinog prihvaćenog poteza ne izmišljeno podići; ukupni prosjek 0 ili neispravna mjerenja treba označiti za provjeru i ne rangirati kao najbolji rezultat.
- Negativan/infinite/NaN podatak je greška; ne prikazati ga kao brzinu.
- Podaci o trajanju svih uključenih igara moraju biti poznati. Ne izbacivati tiho samo sporije/neispravno zapisane igre pa iz preostalih napraviti povoljniji prosjek.

Prikaz: **Mjesto · Igrač · Prosječno vrijeme · Odigrane igre**. Vrijeme u sekundama, predloženo dvije decimale i hrvatski decimalni zarez. Tooltip/pomoć navodi da se radi o prihvaćenim potezima. Dodatni minimum broja prihvaćenih poteza nije korisnikova odluka; plan pitanje niže. Zadano minimum igara + barem jedan valjan potez.

### 5.5. Najduži niz pobjeda (`niz_pobjeda`)

Najveći broj uzastopnih pobjeda igrača u javnim igrama odabranog načina **unutar traženog razdoblja**. Pobjeda je konačni `plasman === 1`, provjeren prema pobjedniku; svi ostali konačni plasmani su nepobjede i prekidaju niz.

Poništena, privatna i aktivna igra se izostavlja iz sekvence: ne povećava i ne prekida ovaj rekord. Igra drugog načina nema učinak. Pauza bez igranja sama po sebi ne prekida niz unutar istog razdoblja. Diskonekcija koja rezultira konačnim porazom u završenoj javnoj igri prekida ga.

Sekvencu prvo ograničiti na razdoblje, zatim računati maksimum. Ne prenositi startnu vrijednost iz prethodnog razdoblja. Tri pobjede jučer + dvije danas, bez poraza između = dnevni 2, tjedni 5 ako je isti tjedan. Četiri 31. 12. + tri 1. 1. daju godišnje 4 i 3; svih vremena 7. U tablicu se ulazi tek kad je ispunjen odgovarajući minimum ukupnih igara, ne minimum pobjeda.

**Kronologija koju treba potvrditi u planu:** preporuka je redoslijed igara u koje je igrač ušao, `partije.pocetak ASC, partije.id ASC`, nakon filtriranja konačno završenih igara odabranog obuhvata. To izbjegava da spor završetak stola A prebaci njegov raniji poraz iza pobjede u kasnijoj igri B. Pripadnost kalendarskom razdoblju i dalje određuje kraj cijele igre. Ne koristiti redoslijed DB callbackova ili `nizoviPobjedaIgraca.najboljiNiz`.

Primjer za provjeru: A počinje, igrač ispadne; B počinje i igrač pobijedi; B se završi prije A. Kad su obje igre konačne, sekvenca je A-poraz pa B-pobjeda. Ako vlasnik želi strogo redoslijed konačnih završetaka umjesto ulazaka, agent mora jasno prikazati posljedicu i promijeniti jedan zajednički poredak, testove i objašnjenje. Nije dopušteno da dnevni/tjedni koriste različita tumačenja.

Dok je ranije započeta igra još aktivna, njezin konačni ishod nije dio ljestvice; aktualni poredak može se promijeniti nakon završetka. To je normalno za aktivno razdoblje. Postojeću vatru, bonuse XP-a i rani reset niza ne mijenjati u sklopu ovog featurea; oni su druga logika i druga svrha.

Prikaz: **Mjesto · Igrač · Niz pobjeda · Odigrane igre**. Maksimum 0 → „Još nema pobjede u ovom razdoblju”, uz provjeru uvjeta igara prema pravilima statusa.

## 6. Vremenski obuhvat i točno računanje

Koristiti interval `[pocetak, kraj)` — početak uključiv, kraj isključiv. U SQL-u `kraj_igre >= $od AND kraj_igre < $do`. Bez `BETWEEN` na dvije uključive ponoći i bez filtra samo po broju mjeseca/tjedna.

Dnevno: lokalna ponoć do sljedeće lokalne ponoći. Tjedno: ponedjeljak do sljedećeg ponedjeljka. Mjesečno: prvi dan mjeseca do prvog dana sljedećeg. Godišnje: 1. 1. godine do 1. 1. sljedeće. Tjedan može prijeći granicu godine; ne odrezati ga na 31. 12. Ne koristiti broj tjedna bez ISO tjedne godine.

Granice računati kalendarski u `Europe/Zagreb`, potom pretvoriti u UTC instants za upit. PostgreSQL 16 podržava `AT TIME ZONE` i zonirano skraćivanje datuma. Primjer jednog dana, konceptualni SQL s parametrima:

```sql
WITH lokalno AS (
  SELECT date_trunc('day', $1::timestamptz AT TIME ZONE 'Europe/Zagreb') AS od_local
)
SELECT od_local AT TIME ZONE 'Europe/Zagreb' AS od_utc,
       (od_local + interval '1 day') AT TIME ZONE 'Europe/Zagreb' AS do_utc
FROM lokalno;
```

Za tjedan/mjesec/godinu koristiti allowlist jedinica i odgovarajući kalendarski interval; ne interpolirati korisnički SQL. Datum i sat requesta dolaze sa servera. Cijeli odgovor i sve pripadajuće pozicije računati prema istom `asOf` i snapshotu baze, a ne zasebnim `now()` iz više JS handlera oko ponoći.

DST test: 29. 3. 2026. ima 23 sata između zagrebačkih ponoći; 25. 10. 2026. ima 25. Ne dodavati fiksnih 86400000 ms za granice dana. Za godišnjicu početka dodati kalendarsku godinu u istoj zoni, ne 365 dana; 29. 2. sljedeće ne-prijestupne godine preslikati u 28. 2.

`LJESTVICE_POCETAK` / trajna konfiguracija natjecanja definira točan datum i vrijeme od kojeg vrijede novi podaci. Ne uzeti datum registracije pojedinog igrača, prvog deploya staginga ili vrijeme restarta. `allTimeUnlockAt` je godina nakon dogovorenog početka open bete/javnog praćenja. Ako su ti datumi različiti, vlasnik mora eksplicitno odlučiti koji datum definira godišnjicu.

Prvi nepotpuni dan/tjedan/mjesec/godina koristi `max(kalendarskiPocetak, LJESTVICE_POCETAK)`; minimum ostaje isti, nema proporcionalnog snižavanja. Prikazati „Rezultati od [datum]” kada godina 2026. ne sadrži cijelu godinu.

Sve igre jednim konačnim rezultatom pridonose dnevnom, tjednom, mjesečnom, godišnjem i ukupnom obuhvatu u kojem se njihov kraj nalazi. Poredak se ne sprema resetiranjem igračevih životnih brojača.

### Svih vremena prije otključavanja

API mora vratiti status `zakljucano`, `otkljucavaSe`, praznu tablicu i bez stvarnog poretka. Nije dovoljno samo sakriti gumb. Klik radi i otvara:

„Ljestvicu svih vremena otključavamo nakon prve godine javnog igranja. Dostupna od {datum}.”

Ne tvrditi da je do tada nužno identična godišnjoj: kalendarska godišnja već u siječnju odbacuje prethodnu godinu. Metrike se skupljaju od dogovorenog početka, ne tek od dana otključavanja. Na godišnjicu minimum je 20 ukupnih igara u načinu, ne 20 godišnjih ili 20 nakon otključavanja.

## 7. Poredak, izjednačenja i kvalifikacija

### 7.1. Jedan zajednički redoslijed

Za sve prikaze, uključujući profil i arhivu, koristiti isti servis i isti redoslijed:

1. Glavna vrijednost: silazno, osim brzine koja ide uzlazno.
2. Broj svih uključenih završenih igara: silazno.
3. Ako su i vrijednost i broj igara jednaki: kanonsko vrijeme ostvarenja rezultata, uzlazno — zadani prijedlog, objasniti u UI-ju.
4. Ako je i to isto: stabilni ID igrača, uzlazno. ID je samo tehnički završetak redoslijeda; ne prikazivati ga kao zaslugu.

Vrijeme ostvarenja definirati bez dvojbe: za prosjek bodova i brzinu posljednji kraj uključene igre; za rekord riječi/niza riječi prvi kraj igre koja ostvaruje maksimum; za pobjednički niz prvi završni trenutak kada su sve igre u prvom maksimalnom pobjedničkom segmentu završene (`max(kraj)` toga segmenta, pa najraniji od maksimalnih segmenata). Time kasniji zapis na bazu ne daje prednost ili kaznu.

Koristiti jedinstvena mjesta 1, 2, 3… odnosno `ROW_NUMBER()` nad punim redoslijedom. Ne kombinirati `RANK()` u tablici i zaseban count za moje mjesto. Ako vlasnik kasnije želi dijeljena mjesta nakon prvih dvaju kriterija, to je promjena proizvoda: zahtijeva usklađenje svih prikaza, arhive i definicije deset susjeda.

**Primjeri:** niz 8 u 30 igara pobjeđuje niz 8 u 20 igara; niz 9 u 20 igara pobjeđuje niz 8 u 200 igara. Brzina 2,00 s u 50 igara pobjeđuje 2,00 s u 20 igara kada su stvarne vrijednosti jednake. Brzina 1,999 s pobjeđuje 2,001 s čak ako se obje na ekranu zaokruže na 2,00 s. Broj igara nije glavni kriterij.

Ne rangirati prema `toFixed(2)`, lokaliziranom stringu ili floating-point rezultatu iz postojećeg lifetime upita. Čuvati numerator i denominator; uspoređivati numerički s dovoljnom preciznošću. PostgreSQL `numeric` prikladniji je od `real/double precision`; SQL dijeljenje cijelih brojeva prije castanja nije dopušteno.

Tehnički prijedlog za deterministički SQL sort omjera: brojnike castati u `numeric(80,40)` prije dijeljenja, zatim zadržati najmanje 40 decimala za sort. Broj igara i broj prihvaćenih poteza moraju stati u pozitivan signed bigint. Pri tom ograničenju razlika dvaju različitih racionalnih rezultata iznosi najmanje `1/(d1*d2) > 10^-38`, pa 40 decimalnih mjesta ne stapa različite rezultate. U testovima usporediti s referentnim cross-multiplication comparatorom na BigInt vrijednostima. Ako agent odabere jednostavniji cast, mora dokazati isto ponašanje unutar stvarnih ograničenja, ne samo prikazati dvije decimale. Ne slati ogromne interne decimalne stringove u tablicu.

### 7.2. Status bez lažnog mjesta

Za svakog promatranog igrača vratiti `mjesto: null` kada ne postoji rang; nikad 0, NaN ili `-1`. Predložena enumeracija, evaluirana ovim redoslijedom:

| Status | Uvjet | Tekst za vlastiti profil/ljestvicu |
|---|---|---|
| `zakljucano` | Svih vremena još nije otvorena | Dostupno od {datum}. |
| `arhiva_u_pripremi` | Godina završena, konačni snapshot još nije objavljen | Zaključujemo godišnju ljestvicu. |
| `prijava_potrebna` | Nema prepoznatog igrača u sessionu | Prijavi se za prikaz svoje pozicije. |
| `nije_igrano` | 0 završenih igara u obuhvatu | Nije odigrano danas / ovaj tjedan / ovaj mjesec / ove godine / dosad. |
| `nedovoljan_broj_igara` | 1–9 dnevno ili 1–19 ostalo | Odigrano: 7 od 10. Još 3 igre do poretka. |
| `podaci_nepotpuni` | Minimum ispunjen, ali izvor ove metrike nepotpun | Rezultat još nije dostupan. |
| `nema_rezultata` | Poznati podaci, ali nema pozitivnog rekorda ili valjanog brzinskog nazivnika | Još nema prihvaćene riječi / pobjede / izmjerenog poteza u ovom razdoblju. |
| `rangiran` | Svi uvjeti zadovoljeni | Tvoja pozicija: 500. |

Nula bodova je valjan prosjek i nije `nema_rezultata`. Nula najdužeg niza ili nijedna riječ/pobjeda nema smisla kao rekordna tablica i zadano ne ulazi. Kandidati s nepotpunim novim mjerenjima i dalje smiju biti rangirani u prosjeku bodova i pobjedama ako su njihovi konačni rezultati potpuni.

Ovo su stanja za prikaz, ne HTTP greške. Nedostupna baza ili pokvaren request nije `nije_igrano`: vratiti/prikazati stvarnu grešku s ponovnim pokušajem. Za obrisan/nepostojeći javni profil koristiti postojeću politiku 404. Ne odavati privatne profile kroz novi endpoint.

### 7.3. Top 10 i Oko mene

Najprije rangirati sve kvalificirane igrače; tek potom odabrati prozor. Ako je vlastito mjesto `r`, a broj rangiranih `N`:

```text
pocetnoMjesto = max(1, min(r - 4, max(1, N - 9)))
krajnjeMjesto = min(N, pocetnoMjesto + 9)
```

U sredini su četiri iznad + igrač + pet ispod. Pri vrhu/dnu nadopuniti s druge strane. Ako ukupno postoji manje od deset, vratiti sve. Broj `N` može biti interna vrijednost ili pagination metadata, ali se ne ispisuje kao „500 / N”.

Primjeri: `N=1000,r=500` → 496–505; `r=1` → 1–10; `r=1000` → 991–1000; `N=7,r=4` → 1–7. Redci uvijek nose globalna mjesta; ne numerirati prikaz oko mene opet 1–10.

Nerangiranom igraču kontrola ostaje razumljiva, ali bez lažnog prozora oko pozicije 0. Prikazati razlog i mogućnost povratka na Top 10. Preporuka je zadržati Top 10 vidljiv uz poruku zašto Oko mene još nije dostupno. Gost s postojećim identitetom, ako goste uključimo, ima vlastitu poziciju; posjetitelj bez sessiona nema.

## 8. Podatkovni model: najmanja održiva promjena

### 8.1. Proširiti postojeći konačni zapis sudionika

Prednost dati stupcima u `sudionici_partije`, jer već postoji jedan zapis po igraču i igri. Nema potrebe za drugom tablicom koja duplicira sve sudionike niti trajnim spremanjem svakog odbijenog pokušaja samo zbog ljestvice.

Sljedeći nazivi su prijedlog; uskladiti TypeScript i SQL konvencije repozitorija:

| Novi podatak | Tip | Pravilo |
|---|---|---|
| `metrike_verzija` | nullable smallint/integer | `1` znači da je novi sažetak konačno spremljen; stari/nepoznati ostaju NULL. |
| `prihvacene_rijeci` | nullable integer | >= 0; count prihvaćenih riječi toga igrača u toj igri. |
| `trajanje_prihvacenih_ms` | nullable bigint | >= 0; zbroj serverskih trajanja. U TS-u paziti na bigint i JSON. |
| `najduzi_niz_rijeci` | nullable integer | >= 0 i <= broj prihvaćenih riječi. |
| `najduza_rijec` | nullable text | Najduža prihvaćena riječ te igre, ili NULL kada ih nema. |
| `najduza_rijec_grafemi` | nullable integer | > 0 uz riječ; NULL kada nema riječi. |

Zadržati postojeće `bodovi`, `plasman`, `eliminacije`, `igrac_id`, `partija_id`. Ne uvoditi dodatni `broj_igara=1` stupac. Sve igre broje se iz konačnih zapisa, bez dvostrukog zbrajanja dodatnih obracun redaka.

DB CHECK ograničenja moraju dopuštati stare NULL sažetke, a za `metrike_verzija=1` tražiti sve obvezne numeričke vrijednosti. Ako je broj riječi 0: trajanje 0, niz 0, riječ i duljina NULL. Ako je >0: riječ postoji, duljina >0, niz između 1 i broja riječi. Trajanje može biti 0 kao zapis za dijagnostiku, ali takav ukupni brzinski rezultat ne rangirati. Ne zamijeniti nepoznato s nulom kroz migracijski `DEFAULT 0`.

Predložiti `rezultati_spremljeni_at` na `partije` ili odgovarajući pouzdani postojeći timestamp obračuna za praćenje zakašnjelih konačnih upisa. Taj timestamp nije kriterij kalendarskog obuhvata. `partije.kraj` postaje stvarni nepromjenjivi trenutak kraja igre.

Provjeriti stvarne Drizzle tipove za vrijeme. Ne preimenovati `timestamp without time zone` u `timestamptz` bez provjere dosadašnje interpretacije podataka. Eventualnu konverziju napraviti eksplicitno prema utvrđenoj staroj zoni; ne prepustiti session timezoneu. Novi vremenski trenuci trebaju jednoznačno označavati UTC instant, a poslovni kalendar je Zagreb.

### 8.2. Put upisa konačnog rezultata

U motoru jednom zabilježiti `zavrsenoU` kada igra stvarno završi. Proslijediti ga u isti objekt za svaki retry `zakljuciPartijuUBazi`. Ne ponovno pozvati `new Date()` za poslovni kraj u svakom pokušaju.

Unutar postojeće finalizacijske transakcije:

1. Izvesti postojeći idempotentni claim; očuvati semantiku javnih/privatnih obračuna.
2. Za javnu igru upisati konačne rezultate i nove per-game sažetke svih sudionika, uključujući ranije ispale igrače i goste s ID-em.
3. Sačuvati dosadašnje lifetime/DNK/forma/XP ažuriranje bez ponovnog povećanja na retryju.
4. Označiti završenu igru s istim `zavrsenoU`; konačni status i sažeci postaju vidljivi u jednom commit-u.
5. Nakon uspjeha eventualno invalidirati lokalni kratki cache. Ne ažurirati petnaest tablica ljestvica na svaki prihvaćeni potez.

Ako novi obvezni sažetak nedostaje, ne izmišljati nulu i ne uspješno završiti samo dio transakcije. Ispraviti tok koji proizvodi nedostajući podatak; zabilježiti razumljivu internu grešku. Za stare završene igre jasno ostaje nepotpunost, a ne beskonačno ponavljanje novih upisa.

Testirati dvije istodobne finalizacije iste igre i retry nakon uspješnog commita: broj igara, bodovi, pobjede i novi sažetak ostaju jednom upisani. `ON CONFLICT DO UPDATE` bez finalizacijskog claima nije dostatan za životne brojače. Privatna igra ne smije postati javna ljestvica zato što je dobila nove statističke stupce.

Rani zapis poraza ne pokreće javnu ljestvicu. Konačni upit uvijek provjerava status cijele igre. Postojeći motor smije izgubiti nezavršenu igru pri restartu kako je ranije dogovoreno; ovaj zadatak ne uvodi recovery aktivnih stolova.

### 8.3. Početak mjerenja i stare igre

Najjednostavniji MVP je uključiti novi zapis prije otvaranja produkcijske bete i ljestvice pokrenuti od dogovorenog javnog početka. Staging služi provjeri i ne prelijeva se u produkciju.

Ako produkcija već sadrži igre koje korisnici očekuju na ljestvicama, agent u planu mora navesti:

- koji podaci stvarno postoje i za koji period;
- može li pouzdano obnoviti bodove/plasmane;
- ima li dokaz da su svi prihvaćeni potezi spremljeni;
- da najduži niz riječi nije moguće točno obnoviti ako odbijanja nisu spremljena;
- predloženi datum od kojeg su svih pet novih mjerenja potpuna.

Ne resetirati postojeće račune, bodove ili povijest radi urednije migracije. Ne fabricirati povijesne rekorde. Bez pouzdanog backfilla ponuditi zajednički početak novih sezonskih ljestvica i jasno ga navesti u UI-ju; postojeću životnu statistiku sačuvati. Ako vlasnik želi različit početak za pojedinu metriku, to mora biti eksplicitna promjena meta-podataka i objašnjenja, ne skrivena implementacijska odluka.

Za novu verziju postojeće aktivne igre pri deployu razriješiti kontroliranim održavanjem ili podržanom kompatibilnošću motora. Ne označiti njihov nepotpun sažetak kao verziju 1. Migracije su aditivne; operativni deploy slijedi postojeći postupak održavanja.

## 9. Servis i SQL izračun

### 9.1. Jedan izvor istine

Predložena nova mapa `aplikacije/posluzitelj/src/ljestvice/`:

- `razdoblja.ts`: čiste funkcije granica i datuma otključavanja;
- `pravila.ts`: allowlist metrika, minimumi, redoslijed, verzija pravila;
- `upiti.ts`: parametrizirani upiti i zajednička baza kandidata;
- `servis.ts`: tablica, pozicije, statusi, arhiva;
- `rute.ts`: validacija ulaza, identitet, HTTP ugovor;
- `arhiva.ts`: idempotentno godišnje zatvaranje.

Nazivi nisu obveza novih datoteka ako projekt ima prikladniju organizaciju. Obveza je zajednička pravila koristiti za tablicu, moje mjesto, tuđi profil i arhivu, umjesto kopiranja formula u četiri handlera i browser.

Osnovni skup podataka: javne konačno završene igre nakon početka mjerenja, odabrani način, `kraj >= od AND kraj < do`, konačni sudionici s valjanim ID-em. Kod u pregledu privatne igre ne sprema u `partije`; agent mora to provjeriti na svojem HEAD-u i odabrati eksplicitan dokaz javne igre. Ako koristi `obracuni_partija.vrsta='javna_partija'`, preferirati `EXISTS` umjesto join-a koji bi umnožio sudionike. Prije takvog filtra provjeriti pokrivenost starih redaka i početak mjerenja.

Obrisane igrače izostaviti iz novih živih poredaka. Isti filter primijeniti na tablicu, vlastito mjesto i profil. Zbog kasnijeg brisanja živa mjesta se mogu pomaknuti; zaključana godišnja arhiva ima zasebno pravilo anonimnog retka.

Aktivni upit dodatno ograničiti na konzistentni serverski presjek `asOf`; ne uključivati pogrešno buduće konačne zapise. Neispravan konačni plasman ili nedostajući bodovi zahtijevaju status nepotpunosti i dijagnostiku. Ne ukloniti samo takvu igru iz nazivnika pa igraču poboljšati prosjek.

### 9.2. Skica upita prosjeka

Ovo je logička skica, ne gotova migracija. Agent mora uskladiti stvarna imena stupaca i tipove:

```sql
WITH igre AS (
  SELECT s.igrac_id, p.id AS partija_id, p.pocetak, p.kraj, s.bodovi,
         s.plasman, s.metrike_verzija, s.prihvacene_rijeci,
         s.trajanje_prihvacenih_ms, s.najduzi_niz_rijeci,
         s.najduza_rijec, s.najduza_rijec_grafemi
  FROM partije p
  JOIN sudionici_partije s ON s.partija_id = p.id
  JOIN igraci i ON i.id = s.igrac_id
  WHERE p.status = 'zavrsena' AND p.mod = $1
    AND p.kraj >= $2 AND p.kraj < $3
    AND i.obrisan_at IS NULL
    -- Dodati provjereni uvjet javne igre i početka praćenja.
), agregati AS (
  SELECT igrac_id, count(*) AS igre,
         sum(bodovi) AS zbroj_bodova,
         max(kraj) AS ostvareno_u
  FROM igre
  GROUP BY igrac_id
), kvalificirani AS (
  SELECT *, zbroj_bodova::numeric(80,40) / igre AS sort_vrijednost
  FROM agregati WHERE igre >= $4
), rangirani AS (
  SELECT *, row_number() OVER (
    ORDER BY sort_vrijednost DESC, igre DESC, ostvareno_u ASC, igrac_id ASC
  ) AS mjesto
  FROM kvalificirani
)
SELECT * FROM rangirani
WHERE mjesto BETWEEN $5 AND $6
ORDER BY mjesto;
```

Moje mjesto iz istog `rangirani` skupa uzeti po ID-u. Za Top 10 i vlastito mjesto izvesti jedan statement s odvojenim podupitima/JSON agregacijom ili read-only transakciju s konzistentnim snapshotom. Default READ COMMITTED s dva nepovezana upita ne jamči isti poredak ako između završi igra. Nije potrebno zaključavati tablicu dok je korisnik gleda.

Upit za brzinu zbraja cijele zbrojeve i nazivnike, traži potpunost svake uključene igre i koristi rastući numerički sort. Za najdužu riječ birati osobni najbolji redak zasebno, ali `igre` računati iz svih uključenih igara, ne samo igara s tom riječju. Za niz riječi koristiti maksimum sažetaka; NULL za jednu igru znači nepoznati mogući maksimum.

### 9.3. Pobjednički niz preko prozorskih funkcija

Ne zbrajati ukupne pobjede kao da su uzastopne. Ne čitati samo zadnjih 20 rezultata. Najprije dobiti sve igre igrača u zadanom obuhvatu i načinu, zatim:

```sql
-- igre iz prethodne zajedničke baze, s konačnim plasmanom.
WITH sekvenca AS (
  SELECT *, sum(CASE WHEN plasman = 1 THEN 0 ELSE 1 END) OVER (
    PARTITION BY igrac_id
    ORDER BY pocetak, partija_id
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ) AS blok
  FROM igre
), pobjednicki_blokovi AS (
  SELECT igrac_id, blok, count(*) AS duljina, max(kraj) AS ostvareno_u
  FROM sekvenca
  WHERE plasman = 1
  GROUP BY igrac_id, blok
)
-- Odabrati najveći blok svakog igrača; kod istih maksimuma najranije ostvarenje.
-- Spojiti broj SVIH igara iz zasebnog agregata; zatim kvalifikacija i rangiranje.
```

`ROWS` i stabilan sekundarni ID su važni kada dva zapisa imaju isti timestamp. Pobjedničke redove filtrirati tek nakon izračuna blokova; ranije filtriranje uklonilo bi poraze koji prekidaju niz. Igra bez valjanog konačnog plasmana predstavlja grešku podataka, ne pobjedu i ne tihi preskok. Kad vlasnik potvrdi kronologiju, koristiti je posvuda. Navedeni primjer koristi preporučeni početak igre.

### 9.4. Opterećenje i cache

Za MVP izračun nad trajnim konačnim zapisima ima najmanje pokretnih dijelova i može se ponovno provjeriti. Nedostatak je rast troška za godišnju/ukupnu ljestvicu. Ne uvoditi sve agregacijske tablice unaprijed; najprije izmjeriti konkretne upite.

Razmotriti partial index na `partije(mod, kraj, id) WHERE status='zavrsena'`; postojeći PK sudionika i index `(igrac_id, partija_id)` provjeriti kroz `EXPLAIN (ANALYZE, BUFFERS)` na realističnim podacima. Index koji nije korišten nije automatska obveza. Za izvedbu dokumentirati dataset i plan upita; cilj za MVP predloženo p95 ispod 500 ms na stagingu s dogovorenim reprezentativnim volumenom, bez tvrdnje da je to sada izmjereno.

Ne slati sve rezultate browseru pa tamo sortirati. Ne raditi 50 HTTP requestova za kombinacije pet metrika, dva načina i pet razdoblja. Tablica vraća deset redaka i pozicije za pet razdoblja odabrane metrike/načina. Profil koristi isti grupni izračun samo za trenutačni odabir.

Ako je potreban kratki lokalni cache, predloženo 15–30 s; key uključuje način, metriku, stvarni period ID, godinu, verziju pravila i datum početka podataka. Rok ne smije preživjeti kraj razdoblja ili otključavanje svih vremena. Globalne podatke i personalizirani `jeJa`/moje mjesto ne smije se pomiješati između sessiona. Najsigurniji početak je bez HTTP shared cachea za personalizirane odgovore (`Cache-Control: private, no-store`). Cache nije mjesto trajnog čuvanja rezultata.

## 10. API ugovor

Prilagoditi postojećem Fastify registriranju pod `/api`. Web helperu ne dodavati `/api` dvaput. Predloženi novi endpointi u ovom poglavlju još ne postoje u pregledanom kodu.

### 10.1. Glavna tablica

`GET /api/ljestvice?mod=1v1&metrika=prosjek_bodova&razdoblje=dnevno&prikaz=top`

| Parametar | Vrijednosti i pravila |
|---|---|
| `mod` | Stvarni postojeći enum za Dvoboj/Četveroboj; primjer koristi `1v1`. Agent mora preuzeti postojeći četveroboj enum, ne izmisliti novi. |
| `metrika` | `prosjek_bodova`, `niz_rijeci`, `najduza_rijec`, `brzina`, `niz_pobjeda`. |
| `razdoblje` | `dnevno`, `tjedno`, `mjesecno`, `godisnje`, `svih_vremena`. |
| `prikaz` | `top` ili `oko_mene`; zadano `top`. Nema proizvoljnog SQL offseta iz klijenta. |
| `godina` | Samo uz godišnje; tekuća ili postojeća završena godina od početka podataka. Buduću/nekonzistentnu odbiti 400; poznatu ali još nezaključanu vratiti u pripremi. |

Identitet „mene” dolazi iz provjerenog sessiona. Ne prihvaćati proizvoljan `mojIgracId` kao dokaz identiteta. Za tablicu je opcionalna autentikacija; anonimni posjetitelj smije Top 10. Stanje `prijava_potrebna` nije 500.

Primjer oblika odgovora; ISO vremena su ilustracija, a konkretne enum oznake i tipove definirati u shared paketu:

```ts
type Metrika = 'prosjek_bodova' | 'niz_rijeci' | 'najduza_rijec'
  | 'brzina' | 'niz_pobjeda';
type StatusPozicije = 'rangiran' | 'nije_igrano' | 'nedovoljan_broj_igara'
  | 'podaci_nepotpuni' | 'nema_rezultata' | 'zakljucano'
  | 'arhiva_u_pripremi' | 'prijava_potrebna';

type Pozicija = {
  status: StatusPozicije;
  mjesto: number | null;
  odigraneIgre: number | null; // null = nepoznato/nedostupno, a ne nula
  minimumIgara: 10 | 20;
  nedostajeIgara: number | null;
};

type Vrijednost =
  | { vrsta: 'prosjek_bodova'; prosjek: string; bodoviUkupno: string }
  | { vrsta: 'niz_rijeci'; broj: number }
  | { vrsta: 'najduza_rijec'; rijec: string; brojSlova: number }
  | { vrsta: 'brzina'; prosjekMs: string; brojPrihvacenihPoteza: string }
  | { vrsta: 'niz_pobjeda'; broj: number };

type Redak = {
  mjesto: number;
  igracId: string | null; // arhivski obrisani redak može biti anoniman
  oznakaRetka: string; // stabilni key, posebno za arhivske anonimne retke
  nadimak: string;
  avatar: string | null; // ili postojeći tip avatara iz shared ugovora
  jeJavanProfil: boolean;
  jeJa: boolean;
  odigraneIgre: number;
  vrijednost: Vrijednost;
};

type OdgovorLjestvice = {
  mod: string;
  metrika: Metrika;
  razdoblje: {
    vrsta: string; id: string; godina?: number;
    od: string; do: string | null; // UTC ISO; svih vremena nema konačan kraj
    zona: 'Europe/Zagreb';
    stanje: 'aktivno' | 'zakljucano' | 'arhiva_u_pripremi' | 'arhivirano';
    otkljucavaSe: string | null;
    podaciOd: string;
  };
  pravila: {
    verzija: number; minimumIgara: 10 | 20;
    smjer: 'vece_je_bolje' | 'manje_je_bolje';
    izjednacenje: ['vise_igara', 'ranije_ostvarenje', 'stabilni_id'];
  };
  prikaz: 'top' | 'oko_mene';
  redci: Redak[];
  mojaPozicija: Pozicija;
  pozicijePoRazdobljima: Record<string, Pozicija>;
  izracunatoU: string;
  arhiviranoU: string | null;
};
```

API decimalne/bigint vrijednosti može prenositi stringovima kako JSON/JS ne bi izgubio preciznost. Frontend formatira kroz `Intl.NumberFormat('hr-HR')` nakon sigurne konverzije za prikaz. Sort ostaje serverski. Brojevi mjesta i igara trebaju imati kontrolu safe integer raspona; dokumentirati ugovor ako ikada premaše taj raspon.

`pozicijePoRazdobljima.godisnje` prati trenutačno odabranu godinu, dok dnevno/tjedno/mjesečno prate sadašnje razdoblje. Pri pregledu arhive jasno napisati godinu uz godišnji tab. Alternativa je povijesni prikaz odvojiti od aktualnih pet tabova; agent neka predloži jednostavniji UX prije kodiranja. Ne prikazati mjesto iz 2026. uz naslov „Godišnja 2027.”.

Zaključana lista svih vremena vraća prazne retke, bez ranga i podatka `nema_rezultata`. Metadata ostaje dostupan i klik radi. Za prazan otvoren poredak vratiti 200 s praznim poljem. Validacijske greške 400, nepostojeći javni profil 404, privremeni backend problem 5xx s postojećim formatom greške. Ne slati stack trace u UI.

### 10.2. Profil i metapodaci

Predloženo `GET /api/ljestvice/pozicije?igracId={id}&mod=...&metrika=...` vraća pet statusa/mjesta za promatranog igrača. Ako nema `igracId`, koristiti vlastiti identitet. Za tuđi profil koristiti postojeću provjeru javne vidljivosti; endpoint ne smije otkriti gostov ili obrisani profil ako to postojeća aplikacija ne dopušta. Pozicije smiju biti dio postojećeg profila ako se izračun uključuje samo kada je potreban i ne usporava sve profile.

Odvojiti `promatraniIgracId` od session igrača. Na tuđem profilu naslov je „Poredak igrača”, ne „Tvoja pozicija”. Ako se kasnije uvede „Oko ovog igrača”, to je zaseban eksplicitan fokus, ne promjena značenja „Oko mene”.

Popis godina, datum početka, otključavanje i pravila mogu doći u glavnom odgovoru ili kroz mali `/api/ljestvice/meta`; ne uvoditi endpoint samo radi jednog konstantnog stringa. Arhivske godine dobivati iz baze, ne hardkodirati `[2026,2027]`.

### 10.3. Kompatibilnost i sigurnost ulaza

- Nova web ruta `/ljestvice`; stara `/ljestvica` trajno preusmjerava na nju, uz očuvanje/prevođenje podržanih query parametara.
- Postojeći `/api/ljestvica` nije web redirect. Zadržati ga privremeno za postojeće klijente ili ga eksplicitno adaptirati uz test ugovora; ne vratiti HTML umjesto JSON-a.
- Ažurirati interne linkove, navigaciju, SEO canonical i relevantne e2e testove.
- Parametre validirati allowlistom; SQL identifikatori/smjer sortiranja dolaze samo iz serverske mape, ne iz query stringa.
- Koristiti postojeći rate limiting i auth middleware. Poseban agresivni limiter samo ako mjerenja pokažu potrebu; klik kroz pet tabova ne smije rutinski zaključati korisnika.
- Browser pri brzoj promjeni tabova otkazuje stari fetch ili zanemaruje zastarjeli response kroz request ID. Odgovor za Dvoboj ne smije prepisati noviji Četveroboj.

## 11. Izgled i tekstovi

### 11.1. `/ljestvice`

Predložena hijerarhija, od vrha:

1. Naslov **Ljestvice**.
2. Kategorija **Igrači | Riječi**.
3. Način **Četveroboj | Dvoboj**.
4. Metrika: u Igračima **Prosjek bodova | Niz pobjeda | Najbrži igrači**; u Riječima **Niz riječi | Najduža riječ**.
5. Razdoblja **Dnevna | Tjedna | Mjesečna | Godišnja | Svih vremena**. Svako ima vlastitu poziciju/status za odabranu metriku i način.
6. Pravila odabrane liste + datumi obuhvata.
7. Kontrola **Top 10 | Oko mene**.
8. Tablica, jasno stanje učitavanja/greške/praznine.
9. Uz godišnju, odabir godine i oznaka **Zaključana ljestvica za 2026.** kada je arhivirana.

Zadano pri prvom otvaranju dnevna, prosjek bodova, Top 10. Način može preuzeti postojeću sklonost aplikacije; ako je nema, predloženo Četveroboj prema traženom redoslijedu. Pri izričitom odabiru Dvoboja prvi put otvoriti njegovu dnevnu. Ako već postoji URL s odabranim razdobljem, poštovati URL; Back/Forward mora vraćati odabir. Ne resetirati razdoblje pri svakom refreshu.

Pet novih metrika nije dodatnih pet velikih tablica na istoj stranici. Učitavati i pokazati jednu, uz pet kratkih vlastitih pozicija. Na mobitelu tabovi mogu imati vodoravni pomak, ali vlastita pozicija i naziv razdoblja moraju ostati čitljivi i dostupni tipkovnicom. Širinu rješavati CSS-om bez skrivanja broja igara ili riječi.

Vlastiti redak: narančasti rub/pozadina i vidljiva oznaka „Ovo si ti”. Ne oslanjati se samo na boju; osigurati kontrast i fokus. Isti nadimak dvaju korisnika ne smije označiti oba. Nadimak vodi na postojeći javni profil samo kada je to dopušteno; gost nema lažni pokvareni link. Avatar koristiti postojeći prikaz/fallback.

Uz tab piše `Tvoja pozicija: 500` kada postoji; inače kraći status s detaljem ispod: `Još 3 igre do poretka`, `Nije igrano danas`, `Dostupno od …`. Za mjesta u retku dopušteno hrvatski `500.`; fraza koju je vlasnik tražio ostaje bez ukupnog broja sudionika.

### 11.2. Obvezni opisi kriterija

Predlošci popunjavaju `{minimum}` i `{razdoblje}`:

- **Prosjek bodova:** „Poredak prema prosjeku bodova po završenoj javnoj igri. Za ulazak treba {minimum} igara {razdoblje}. Veći prosjek je bolji.”
- **Niz riječi:** „Tvoj najduži niz prihvaćenih riječi u jednoj završenoj javnoj igri. Za ulazak treba {minimum} igara {razdoblje}. Dulji niz je bolji.”
- **Najduža riječ:** „Tvoja najduža prihvaćena riječ iz završene javne igre. Za ulazak treba {minimum} igara {razdoblje}. Više slova je bolje.”
- **Najbrži igrači:** „Prosječno vrijeme svih prihvaćenih poteza u završenim javnim igrama. Za ulazak treba {minimum} igara {razdoblje}. Kraće vrijeme je bolje.”
- **Niz pobjeda:** „Tvoj najduži niz uzastopnih pobjeda unutar razdoblja. Za ulazak treba {minimum} igara {razdoblje}. Dulji niz je bolji.”

Zajednički dodatak: „Kod jednakog rezultata prednost ima igrač s više odigranih igara u ovom razdoblju. Ako je i broj igara isti, prednost ima ranije ostvaren rezultat.” Tehnički ID ne treba opteretiti glavni tekst, ali pravila mogu navesti da je preostali potpuni izjednačeni redoslijed stabilan.

„Svi rezultati odnose se na završene javne igre. Dan završava u ponoć po hrvatskom vremenu.” Za pobjednički niz u proširenom objašnjenju dodati dogovorenu kronologiju i da se pobjede izvan obuhvata ne pribrajaju.

Opis treba biti neposredno uz ljestvicu, ne skriven samo u udaljenim pravilima. Tooltip nije jedini način pristupa jer ne radi jednako na mobitelu.

### 11.3. Profil ispod avatara

Dodati blok **Poredak na ljestvicama** s odabirom načina i metrike. Ispod je pet kratkih redaka:

```text
Dnevna ljestvica: 10.
Tjedna ljestvica: 24.
Mjesečna ljestvica: 51.
Godišnja ljestvica (2026.): 85.
Svih vremena: dostupno od 15. 10. 2027.
```

Primjeri statusa:

- „Dnevna ljestvica: nije odigrano danas.”
- „Tjedna ljestvica: nije odigrano ovaj tjedan.”
- „Mjesečna ljestvica: odigrano 12 od potrebnih 20 igara.”
- „Godišnja ljestvica: još nema pobjede ove godine.” — samo za niz pobjeda nakon dovoljnog broja igara.

Ispraviti raniji lapsus u razgovoru: za tjednu piše **ovaj tjedan**, za mjesečnu **ovaj mjesec**. Ako ima igre, ali ne dovoljno, ne pisati da nije igrao.

Postoji ukupno **50 kombinacija** (5 metrika × 2 načina × 5 razdoblja). Ne ispisivati 50 redaka ispod avatara. Odabir metrike/načina izlaže svih pet razdoblja odabranog skupa; zadano prosjek bodova. Klik vodi na odgovarajuću ljestvicu uz sačuvane filtere. Na vlastitom profilu može otvoriti Oko mene ako je rangiran; na tuđem profilu ne preimenovati tu osobu u „mene”.

### 11.4. Postojeća učestalost riječi

Aktualni `/rijeci/top` prikazuje učestalost riječi. Nije isto što i najduža riječ igrača. Preporuka: zadržati ga u kategoriji Riječi kao zaseban odabir **Najčešće riječi**, izvan novih pet osobnih poredaka. Za njega ne glumiti vlastito mjesto, broj igara pojedinog igrača ili Oko mene.

Agent u planu neka pita želi li vlasnik taj postojeći prikaz zadržati ili sakriti u prvoj verziji. Ne širiti ga automatski na pet vremenskih obuhvata jer to nije potvrđeni zahtjev. Ne brisati endpoint i statistike samo zato što se mijenja navigacija.

## 12. Godišnja arhiva i svih vremena

### 12.1. Što znači zaključano

Zaključana godina ne smije se iznova sortirati svaki put iz živih agregata. Spremiti konačan poredak, broj igara i vrijednosti za **svih pet metrika i oba načina**, ne samo Top 10. Inače nije moguće sačuvati poziciju 500 i deset susjeda.

Potrebna je i informacija o nekvalificiranim igračima koji su te godine igrali, kako profil za 2026. zna razlikovati 0 igara od 12/20. Opcije: snapshot statusa po igraču/metriki ili posebna mala godišnja tablica broja igara. Preporuka: snapshot redak s nullable mjestom i statusom za svaku metriku igrača koji ima barem jednu igru. Za igrača bez ijedne igre odsutnost retka znači 0. Nije potrebno stvarati retke za sve registrirane neaktivne račune.

Minimalni predloženi model:

- `arhive_ljestvica`: `id`, `godina`, `verzija_pravila`, `zona`, `podaci_od`, `presjek_at`, `zakljucano_at`, `status`, opcionalno `verzija_arhive` za eksplicitne korekcije. Jedna objavljena verzija po godini.
- `arhivske_pozicije_ljestvica`: `arhiva_id`, `mod`, `metrika`, stabilna oznaka igrača/retka, referenca na igrača, `mjesto NULL`, `status`, `odigrane_igre`, vrijednost i potrebni izvorni zbrojevi, odabrana riječ/duljina, `ostvareno_u`.
- Unique `(arhiva_id, mod, metrika, stabilna_oznaka_igraca)`; unique mjesto za rangirane unutar `(arhiva_id,mod,metrika)`; index za dohvat po mjestu i po igraču.

Za vrijednosti agent može odabrati eksplicitne nullable stupce s CHECK-ovima po metrici ili tipizirani JSONB uz strogu serversku validaciju. Prvo ima bolju DB kontrolu, drugo kraću shemu; oba trebaju verziju formata. Ne spremati samo formatirani string „2,15 s” jer se gubi mogućnost provjere.

Snapshot brojeva je nepromjenjiv. Avatar/nadimak mogu biti aktualni, uz jasno pravilo anonimizacije; ne treba arhivirati osobne slike i sve stare nadimke. Obična promjena nadimka ne mijenja mjesto.

### 12.2. Postupak zatvaranja

Predloženi MVP: godina prestaje primati igre prema poslovnom kraju točno u ponoć; kratki završni tehnički prozor do 00:15 služi već završenim rezultatima koji se još spremaju. Duljina i politika kasnih upisa potvrđuju se u planu. Aktivna igra koja završi 1. 1. u 00:02 pripada novoj godini, čak ako je počela u staroj.

Jedan idempotentni postupak, pozivljiv iz aplikacijskog periodičnog posla i administrativne CLI naredbe:

1. Pronaći završene godine koje još nemaju objavljenu arhivu, nakon početka mjerenja.
2. Provjeriti da je prošao završni prozor i da nema poznatih još neriješenih konačnih upisa za tu godinu. Ako ih ima, ostaviti status „u pripremi”, logirati i ponoviti; ne objaviti nepotpun snapshot kao konačan.
3. Uz DB lock/unique zaštitu uzeti jedan konzistentan snapshot podataka i izračunati svih 10 godišnjih poredaka i statuse istim pravilima kao žive liste.
4. Spremiti sve retke i metadata te tek na kraju atomarno označiti arhivu objavljenom. Korisnik nikad ne vidi pola metrika zaključano, pola prazno.
5. Ponovni poziv nakon uspjeha je no-op. Pad prije commita ne objavljuje polovične rezultate.

Periodični posao pokrenuti pri startupu i npr. svakih 10–15 minuta. Time propuštena novogodišnja ponoć zbog ugašenog servera nije trajni gubitak arhive. Ako radi više procesa, zaštita je u bazi, ne samo JS boolean. Ne treba novi servis za raspoređivanje. Ne graditi cijelu arhivu tijekom javnog GET requesta.

Ako server ne radi mjesec dana, nakon povratka se arhiviraju sve nedostajuće završene godine za koje postoji razdoblje praćenja. Prazna godina također ima zaključan prazan snapshot. Siječanjske igre ne ulaze u prosinački izračun zbog duljeg tehničkog čekanja.

### 12.3. Zakašnjeli rezultati i ispravci

Stvarni kraj igre i vrijeme commita odvojeni su upravo zbog ovog slučaja. Ako rezultat sa starim `kraj` ipak stigne nakon objave arhive:

- normalno sačuvati rezultat, račun i druge odgovarajuće statistike;
- ne automatski prepisati zaključanu godinu niti obrisati rezultat;
- označiti/detektirati kasni upis, logirati godinu/ID igre i otvoriti odluku o kontroliranoj korekciji;
- vlasnik bira zadržati izvorni konačni presjek ili objaviti označenu novu verziju arhive.

Ovo je stvarna razlika između „strogo zamrznuta godina” i „godina uvijek uključuje svaki naknadno pristigli rezultat”. Oba obećanja bez iznimke ne mogu vrijediti istodobno. Agent treba predložiti navedeni kratki prozor i eksplicitnu korekciju, pa potvrditi politiku s vlasnikom. Za MVP nije potreban administrativni ekran: dovoljna je provjerena interna naredba s dry-run prikazom, brojem pogođenih redaka i eksplicitnim operativnim odobrenjem prije korekcije. Nije dio automatskog završavanja igre.

### 12.4. Brisanje računa

Žive ljestvice izostavljaju obrisanog igrača. Arhiva zadano čuva matematički poredak i anonimni redak **Obrisani igrač**, bez avatara/linka/nadimka. Ne pomicati povijesno 500. mjesto na 499. samo zato što je netko kasnije obrisao račun. Sačuvati stabilni anonimni ključ retka kako render ne bi imao duple/null keyeve.

Uklopiti u postojeću politiku brisanja; ne uvesti snapshot nadimka koji poništava anonimizaciju. Ako postojeća politika zahtijeva potpuno uklanjanje određenih sadržaja, ukloniti osobnu referencu/tekst prema njoj i zadržati samo dopuštene anonimne vrijednosti. Potvrditi product prikaz praznog/anonimnog mjesta bez izmišljanja nove pravne politike u ovom zadatku.

### 12.5. Svih vremena nije zbroj godišnjih rekorda

- Prosjek bodova = zbroj svih bodova / broj svih igara; ne prosjek godišnjih prosjeka.
- Brzina = zbroj svih trajanja / zbroj svih prihvaćenih poteza.
- Najduža riječ i riječni niz = maksimum svih uključenih igara.
- Niz pobjeda može prijeći 31. 12.; iz maksimuma godišnjih nizova nije moguće rekonstruirati ukupni maksimum.

Zato zadržati per-game konačne podatke. Ne brisati ih nakon godišnjeg snapshota i ne resetirati aktualne račune. Ako se kasnije radi retencija/kompakcija, treba dodatna struktura za početni/završni niz, ukupne zbrojeve i dokaz rekordne riječi; to je post-MVP, ne razlog za uvođenje sada.

## 13. Testovi koji dokazuju da feature radi

Proširiti postojeće testove i koristiti stvarni Postgres za SQL/transakcijske testove. Mock koji unaprijed vrati očekivani poredak ne dokazuje rangiranje. Ne treba svaki red tablice pretvoriti u zaseban e2e test: čiste formule jedinicama, upite/integritet integracijskim testovima, a glavne korisničke putove malim brojem e2e scenarija.

U pripremi specifikacije neovisno su provjereni formula prozora za sva mjesta pri 1–1000 rangiranih, navedeni datumi promjene sata i primjeri ponderiranja/nizova. To su provjere specifikacije, ne izvršeni testovi aplikacije ili SQL-a.

### 13.1. Obvezna matrica

| ID | Scenarij | Očekivanje |
|---|---|---|
| K01 | 9 / 10 dnevnih igara | Nema ranga / ima rang ako metrika ima rezultat. |
| K02 | 19 / 20 tjednih, mjesečnih, godišnjih, ukupnih | Minimum provjeren u svakom obuhvatu zasebno. |
| K03 | 10 igara danas, ukupno ovaj tjedan 10 | Dnevna da; tjedna i mjesečna ne. |
| K04 | 7+7+6 u tri dana istog tjedna | Tjedna da, nijedna dnevna ne. |
| K05 | Jučer 20, danas 0 | Dnevna „nije igrano”; dulje imaju rang ako su igre unutar njihovih granica. |
| K06 | 20 Dvoboja, 0 Četveroboja | Nema prelijevanja načina. |
| K07 | 9 javnih + 20 privatnih + 1 poništena | Dnevna još nema 10. |
| K08 | Rani poraz upisan, igra još aktivna | Nema ulaska u broj konačnih igara. |
| K09 | Završena igra bez prihvaćenih riječi | Broji se kao igra; ne dodaje potez brzini. |
| K10 | 20 igara, 0 bodova | Prosjek 0 je rangiran. |
| K11 | 20 poraza, nijedna pobjeda | Niz pobjeda nema pozitivan rekord, ne „nije igrano”. |
| K12 | Nepotpuni riječni sažeci uz potpune bodove | Bodovi mogu imati rang; riječi/brzina imaju nepotpune podatke. |
| V01 | Točno lokalna ponoć | Igra ulazi u novo razdoblje, ne oba. |
| V02 | 29. 3. i 25. 10. 2026. | Zagreb dan traje 23/25 sati; svi UTC trenuci pravilno obuhvaćeni. |
| V03 | Tjedan preko Nove godine | Tjedni obuhvat ne prekida 31. 12.; godišnji prekida. |
| V04 | Početak mjerenja usred dana/mjeseca | Obuhvat skraćen od početka; minimum nije smanjen. |
| V05 | Igra počne 23:55, završi 00:02 | Cijeli sažetak ide u razdoblje kraja. |
| V06 | Igra završi 23:59, DB retry 00:01 | Ostaje u starom razdoblju; stvarni kraj nije promijenjen. |
| V07 | Godišnjica i početak 29. veljače | Kalendarska godina i dogovoreno preslikavanje, bez fiksnih 365 dana. |
| V08 | UI otvoren preko ponoći | Nakon sljedećeg osvježenja nova granica, nema starog cachea pod novim naslovom. |
| M01 | Jednaki bodovni prosjeci, različit broj igara | Više igara ima prednost. |
| M02 | Jednak rekord riječi, niza riječi, niza pobjeda | Isti sekundarni kriterij za svaku metriku. |
| M03 | Jednaka brzina, različit broj igara | Više igara, a ne više poteza, određuje sekundarnu prednost. |
| M04 | Različiti omjeri koji se prikazuju jednako zaokruženi | Sort po punoj preciznosti, ne po tekstu. |
| M05 | Jednak rezultat i igre | Determinističko vrijeme/ID; isti redoslijed na ponovljenom upitu. |
| M06 | 1 potez × 1 s + 9 poteza × 9 s | Brzina 8,2 s. |
| M07 | Nazivnik brzine 0 / svi odmjeri 0 / negativan zapis | Nema lažne najbolje brzine; validacija/dijagnostika. |
| M08 | Prihvaćena riječ + Kaladont efekt | Jedna prihvaćena riječ i jedno trajanje, ne dvostruko. |
| M09 | Sustavska riječ, istek, odustajanje | Ne ulaze u accepted count/duration. |
| M10 | Prihvaćanja 3, odbijanje, prihvaćanja 2 | Najduži niz 3, ne 5. |
| M11 | Najduži niz 7 pa pogreška | Rekord 7 ostaje sačuvan. |
| M12 | Niz 3 u jednoj i 4 u drugoj igri | Riječni rekord 4, ne 7. |
| M13 | Grafemi, digrafi i postojeće iznimke | Duljina identična postojećem helperu/igri. |
| M14 | Isti igrač ima više jednako dugih riječi | Jedan redak, deterministička riječ; count svih igara. |
| P01 | P,P,N,P,P,P | Najduži pobjednički niz 3, ne 5 i ne trenutni broj svih pobjeda. |
| P02 | Tri pobjede jučer, dvije danas | Dnevni niz 2, tjedni 5 uz isti tjedan; minimum provjeriti zasebno. |
| P03 | Četiri pobjede u staroj i tri u novoj godini | Godišnji 4/3, ukupni 7 kad otvoren. |
| P04 | Poraz drugog načina između pobjeda | Ne prekida niz odabranog načina. |
| P05 | Poništena/privatna između pobjeda | Ne povećava i ne prekida javni niz. |
| P06 | Rano ispadanje u A, pobjeda u B, B završi prije A | Rezultat slijedi potvrđenu kronologiju, ne callbackove. |
| P07 | Više od 20 igara s najboljim nizom prije zadnjih 20 | Računa cijeli obuhvat. |
| P08 | Isti timestamp početka dviju igara | Stabilni ID daje determinističku sekvencu. |
| R01 | Top 10 + vlastiti igrač 500. | Pozicija 500 dostupna iako ga nema među deset. |
| R02 | Oko mene za 1,5,500,N-1,N | Ispravan prozor, globalni rankovi, do 10 redaka. |
| R03 | Ukupno 0,1,7,10,11 rangiranih | Bez duplih redaka, negativnih offseta ili pogrešnog nadopunjavanja. |
| R04 | Nerangiran igrač / anoniman posjetitelj | Smislen status i Top 10, nema lažnog „oko 0”. |
| R05 | Dva jednaka nadimka | Samo session ID dobiva „Ovo si ti”. |
| R06 | Gledam tuđi profil | Mjesta pripadaju njemu, oznaka „ti” i session nisu zamijenjeni. |
| R07 | Brzo mijenjanje načina i metrike | Stari response ne prepisuje noviji odabir. |
| R08 | Neuspješan API | Greška i ponovni pokušaj, ne „Nisi igrao”. |
| R09 | Stari web URL / stari API URL | Web redirect radi; API i dalje vraća ugovoreni JSON. |
| R10 | Zaključano svih vremena kroz direktni API poziv | Nema stvarnog poretka prije otključavanja. |
| R11 | Tabovi/metrika/profil za svih 50 kombinacija | Koriste zajednička pravila; minimalni smoke/parametrizirani ugovorni test. |
| D01 | Dva paralelna završetka iste igre | Jedan obračun i jedan sažetak, bez udvostručenja. |
| D02 | Greška usred transakcije, zatim retry | Nema polovično vidljivog konačnog rezultata. |
| D03 | Migracija baze s postojećim računima | Računi/bodovi ostaju; stara nepoznata mjerenja NULL. |
| A01 | Godina završi | Nova godina odmah ima svoj obuhvat; stara pokazuje pripremu pa arhivu. |
| A02 | Arhiviranje istodobno iz dva procesa | Jedna objavljena potpuna arhiva. |
| A03 | Pad usred arhiviranja | Retry dovršava, javno nema polovičnog snapshota. |
| A04 | Server ne radi u ponoć / dulje | Startup naknadno zatvara propuštenu godinu. |
| A05 | Arhivska pozicija 500 | Top/oko mene/profil iz istog snapshota, nisu spremljeni samo prvih 10. |
| A06 | Godina bez igara / igrač s 12 od 20 | Prazna zaključana godina / sačuvan nerangirani status. |
| A07 | Brisanje ili promjena nadimka nakon arhive | Nema curenja starog nadimka; numerički rangovi ostaju. |
| A08 | Zakašnjeli rezultat nakon zatvaranja | Sačuvan, signaliziran; nema tihe promjene arhive. |
| A09 | Rezultat nove godine nakon objave stare | Stara se ne mijenja. |
| A10 | Otključavanje svih vremena | Podaci od početka praćenja, ne od dana godišnjice. |

Za testove kvalifikacije i nizova dodatne neutralne igre dodavati tako da ne promijene očekivani maksimum. Jasno odvojiti provjeru samog rekorda od kvalifikacije: primjer s pet pobjeda demonstrira formulu, ali sam po sebi ne ispunjava minimum 10/20.

### 13.2. Realistična provjera i opažanje grešaka

Na stagingu napraviti mali kontrolirani dataset za sve statuse i jedan veći za planove upita. Koristiti postojeći sustav testiranja; ne uvoditi novi framework. U izvještaju navesti pokrenute naredbe i rezultate, bez tvrdnje da su produkcijski load testovi obavljeni ako nisu.

Minimalni interni logovi: greška spremanja konačnog sažetka, broj novih završetaka bez potpune metrike, trajanje i neuspjeh arhiviranja, broj zakašnjelih upisa nakon presjeka. Ne logirati sve nadimke, riječi i sesijske tokene u svaki request. Admin ekran i nova observability platforma nisu preduvjet MVP-a.

## 14. Redoslijed implementacije, prioritet i rizik

Skala: P0 = točnost/zaštita postojećih podataka; P1 = obvezna funkcija prije puštanja ovog featurea; P2 = naknadno ako opravdano. Kompleksnost i rizik su relativni (niska/srednja/visoka), ne obećanje broja dana. Dugoročna vrijednost označava koliko stavka olakšava provjeru i održavanje.

| Paket | Što napraviti i kako | Prioritet | Kompleksnost | Rizik izvedbe | Dugoročna vrijednost |
|---|---|---|---|---|---|
| 1. Plan i podaci | Potvrditi početak, kronologiju, postojeću retenciju i politiku arhive; prikazati relevantne stvarne tokove iz HEAD-a. | P0 | Srednja | Visok ako se preskoči | Visoka: izbjegava pogrešno tumačenje rekorda. |
| 2. Konačni sažeci | Aditivni stupci i validacija; zapis unutar postojećeg idempotentnog završetka; nepromjenjivi kraj igre. | P0 | Srednja | Visok: dodiruje spremanje rezultata | Vrlo visoka: izvor svih budućih povijesnih statistika. |
| 3. Vremenska pravila | Europe/Zagreb, 10/20, launch cutover, godišnjica, zajednički clock. | P0 | Srednja | Visok: greške daju krive pobjednike | Visoka: jedno mjesto za sva razdoblja. |
| 4. Rangiranje | Pet SQL izračuna, točni omjeri, isti tie-break, stanja, vlastito mjesto i prozor. | P0 | Visoka | Visok: suptilne razlike rankova | Vrlo visoka: jedan servis za sve prikaze. |
| 5. API | Tipizirani ugovor, validacija, batch pozicije, session/fokus razdvojeni, kompatibilnost. | P1 | Srednja | Srednji | Visoka: web/profil dijele pravila. |
| 6. Web | Nova ruta, odabiri, Top/Oko mene, narančasti identitet, opisi, mobile/error stanja. | P1 | Srednja | Srednji | Visoka: razumljiv i provjerljiv prikaz. |
| 7. Profil | Mali blok s odabirom metrike/načina i pet statusa; vlastiti/javni profil. | P1 | Srednja | Srednji | Srednja–visoka: ne duplicira 50 tablica. |
| 8. Godišnja arhiva | Sve pozicije, idempotentan posao, dosljedan presjek, anonimizacija, startup catch-up. | P1 | Visoka | Visok: zaključava javnu povijest | Vrlo visoka: trajna i pouzdana sezonska povijest. |
| 9. Regresija i puštanje | Ciljani integracijski/e2e testovi, mjerenje upita, backup/restore, feature flag. | P0/P1 | Srednja | Visok ako izostane | Visoka: čuva račune i postojeću igru. |
| 10. Dodatne dnevne agregacije | Tek kad upiti postanu preskupi; izgradive iz činjenica i istih pravila. | P2 | Visoka | Srednji–visok | Visoka tek uz dokazanu potrebu. |
| 11. Prošli dani/tjedni/mjeseci | Povijesni picker i dodatne arhivske odluke. | P2 | Srednja | Srednji | Srednja. |
| 12. Dodatne ljestvice | Ukupan broj igara, najveći napredak, postotak pobjeda izvan Dvoboja. | P2 | Ovisi | Srednji: širi kriterije i UI | Procijeniti nakon korištenja pet dogovorenih. |

Svaki paket završiti reviewable promjenom i ciljanim dokazom. Nije obveza jedan PR po retku, ali izbjegavati jedan nerazumljiv diff koji istodobno mijenja motor, računanje rangova i sav profil. Agent ne smije samostalno izbaciti godišnju arhivu iz scopea zato što je najteža: vlasnik ju je tražio. Ako treba fazno puštanje, predložiti vlasniku jasne funkcije po fazi i ostaviti nedovršene prikaze iskreno označene.

## 15. Pristupi: što dobivamo i što plaćamo

| Odluka | Prednost predloženog pristupa | Nedostatak / alternativa |
|---|---|---|
| Konačni sažetak po igri | Mali dodatak postojećoj transakciji; riječni niz sačuvan bez logiranja svih pogrešnih pokušaja. | Ne dopušta buduću rekonstrukciju svakog poteza; detaljni event log bio bi veći scope. |
| Računanje iz završenih igara | Jednostavno provjeriti, promijeniti upit i dokazati rezultate. | Trošak raste s poviješću; kasnije dodati agregate uz mjerenje. |
| Jedna tablica s odabirima | Čitljivo na mobitelu i manji broj upita. | Ne vidi se svih 50 kombinacija odjednom; profil nudi isti odabir. |
| Minimum 10/20 | Sprečava ulazak nakon jedne sretne igre, jednostavno pravilo. | Novi/neaktivni igrači često nemaju mjesto; prikazati napredak, ne sniziti minimum potajno. |
| Rekord + više igara | Točno slijedi vlasnikovu odluku i lako se objašnjava. | Više igara daje više prilika za rekord i prednost kod izjednačenja; to je svjesni dizajn, ne „čista vještina”. |
| Prosjek trajanja prihvaćenih poteza | Jasna brzina stvarnih odigranih riječi; koristi postojeću metriku. | Nije mjera ukupne kvalitete; porazi bez riječi ne pogoršavaju prosjek, a vrlo malo poteza može dati povoljan rezultat. Dodatni minimum poteza treba product odluku. |
| Cijela igra pripada svom kraju | Svi bodovi i riječi imaju isti obuhvat; jednostavan audit. | Potez od 23:59 može završiti na sutrašnjoj listi ako igra završi iza ponoći. |
| Niz pobjeda po početku igre | Rani poraz iz sporog stola ne dolazi iza kasnije igre. | Obuhvat po kraju + redoslijed po početku treba objasniti; alternativa je sve po kraju ili nova individualna vremena rezultata. |
| Zaključan godišnji snapshot | Godišnje mjesto ostaje stabilno i nakon rasta baze/promjene pravila. | Dodatni posao arhiviranja i eksplicitna politika kasnih rezultata. |
| Gosti kao danas | Ne oduzima postojeću mogućnost, više igrača na listi. | Gost bez trajnog računa može izgubiti pristup identitetu; ne obećavati trajnost gosta kao registriranog računa. |

**Bez novih dodatnih ljestvica u ovom nalogu.** Broj igara već je stupac; zasebna lista aktivnosti može kasnije. Dvoboj win-rate uglavnom duplicira prosjek 1/0, pa nije dobra prva dodatna metrika. Ne uvoditi AI sažetke, nagrade, bedževe, Elo, plaćanja ili nov sustav borbe protiv varanja u ovaj zadatak. U planu upozoriti na očito postojeće omogućavanje lažnih javnih rezultata ako ga agent stvarno pronađe, bez izmišljanja velikog novog sustava.

## 16. Checklist prije produkcije

### Podaci i pravila

- [ ] Potvrđen stvarni datum početka javnog praćenja i datum otključavanja svih vremena.
- [ ] Minimum 10 dnevno / 20 unutar svakog duljeg razdoblja jedinstveno definiran i testiran.
- [ ] Potvrđeni tjedan, kronologija niza pobjeda i politika kasnih godišnjih rezultata.
- [ ] Nema staging računa/rezultata u produkcijskom izvoru.
- [ ] Nema resetiranja računa, bodova ili završene povijesti pri uvođenju featurea/early accessa.
- [ ] Svih pet novih metrika ima poznat početak potpunog mjerenja; stari NULL nije 0.
- [ ] Stvarno provjerena retencija `partije`/sudionika i vanjskih cleanup poslova.

### Implementacija i provjera

- [ ] Završetak igre i retry čuvaju isti stvarni kraj i jednom zapisuju sažetke.
- [ ] Privatne/poništene/aktivne igre isključene; rani poraz sam ne ulazi.
- [ ] Isti globalni poredak koriste tablica, moje mjesto, profil i arhiva.
- [ ] Svi tie-breakovi, ponderirani prosjek i rekord pobjeda imaju integracijske testove.
- [ ] Zagreb/DST/ponoć/Nova godina imaju testove s kontroliranim satom.
- [ ] Svih vremena zaključano je i na serveru, a gumb daje smisleno objašnjenje.
- [ ] Godišnja arhiva sprema i niža mjesta/statusne retke, ne samo prvih deset.
- [ ] Arhiviranje preživi retry, dva procesa i propuštenu ponoć; kasni upis je detektiran.
- [ ] Brisanje računa ne vraća nadimak/avatar kroz novi profil ili arhivu.
- [ ] Stari linkovi preusmjeravaju, a stari API ne vraća HTML.
- [ ] Stanja „nije igrano”, „nedostaje igara”, „nema rezultata” i „greška” nisu pomiješana.
- [ ] Profil tuđeg igrača i istovjetni nadimci ne proizvode krivu oznaku „Ovo si ti”.
- [ ] Tablica je upotrebljiva na mobitelu i tipkovnicom; broj igara i pravila vidljivi.
- [ ] Izmjereni reprezentativni upiti i provjereni potrebni indexi.

### Puštanje i povratak

- [ ] Napravljen backup produkcijske baze i provjeren postojeći postupak vraćanja prije migracije; ne obećati backup koji nitko ne zna vratiti.
- [ ] Migracija je aditivna i pokrenuta prvo na stagingu/kopiji relevantne sheme.
- [ ] Deploy koordiniran s ranije dogovorenim održavanjem, bez usputnog resetiranja podataka.
- [ ] Novi zapis sažetaka uveden prije aktiviranja javnih ljestvica, ili točno istodobno s prvim javnim igrama.
- [ ] Feature flag može sakriti novi UI ako zapne, uz nastavak spremanja pouzdanih sažetaka.
- [ ] Rollback ne spušta staru verziju motora koja bi tiho prestala spremati obvezna mjerenja dok igre ostaju otvorene. Ako to nije moguće, održavanje do popravka ili eksplicitno označen prekid pokrivenosti.
- [ ] Primijenjena trajna konfiguracija vremena/početka; restart ne pokreće novu sezonu ili godišnjicu.
- [ ] Nakon puštanja provjerena jedna stvarna završena igra kroz bazu → dnevni broj → kvalifikacijski status; ne fabrikovati pobjede na javnoj produkcijskoj listi radi testa.
- [ ] Logovi završavanja i arhiviranja provjereni, poznato tko reagira na konkretne greške.

Ne treba čekati stvarnu Novu godinu ili godišnjicu da bi se dokazao rad. Koristiti kontrolirani sat i izolirane testne podatke na stagingu. Ne mijenjati produkcijski sat niti datum javnog starta radi demonstracije.

## 17. Pitanja za plan mode

Agent prvo sam pregledava kod i postojeću konfiguraciju. Vlasniku postavlja pitanja koja stvarno mijenjaju pravila ili otkrivaju podatkovnu prazninu. U jednoj poruci ponuditi preporuku i posljedicu druge opcije; ne tražiti da netehnički vlasnik odlučuje o imenima stupaca ili SQL joinovima.

### 17.1. Važna pitanja prije implementacije

**Q1 — Od kojeg datuma počinje javno praćenje?**

„Koji je datum i lokalno vrijeme početka open bete na kaladont.hr? Postoje li već produkcijske igre koje želiš uključiti? Predlažem zajednički početak svih novih ljestvica kad uvedemo potpuna mjerenja, uz čuvanje svih postojećih računa i ukupnih statistika.”

Zašto: određuje rez, povijesnu pokrivenost i godišnjicu. Ako datum još nije poznat, agent može implementirati konfiguraciju i staging vrijednost; ne izmišljati produkcijski datum niti zaključiti da treba obrisati stare podatke.

**Q2 — Kako poredati igre pri ranom ispadanju?**

„Ako ispadneš iz igre A pa pobijediš u igri B, ali A traje dulje od B, predlažem da niz prati redoslijed ulaska u igre: A pa B. Slažeš li se? Druga jednostavna mogućnost je redoslijed završetka cijelih igara, pa bi u tom primjeru bilo B pa A.”

Zašto: postojeći kod omogućuje taj slučaj. Preporučeni redoslijed iz dokumenta primijeniti tek nakon jasno iznesene odluke u planu. Treća mogućnost je trajno spremiti vrijeme individualnog poraza/pobjede, ali to je dodatni model i druga pravila pripadnosti razdoblju; ne uvoditi ga krišom.

**Q3 — Kad godišnja postaje konačna?**

„Predlažem da rezultat pripada staroj godini ako je igra završila prije ponoći, a ljestvicu zaključamo nakon 15 minuta kada se dovrše poznati upisi. Ako kasnije stigne stari rezultat, sačuvamo ga i posebno odlučimo treba li ispraviti arhivu. Želiš li taj postupak ili dulji završni prozor?”

Zašto: stroga trajna arhiva i proizvoljno zakašnjeli upis zahtijevaju dogovor. Ne čekati godinu dana da se to prvi put pojavi.

### 17.2. Pitanja koja imaju preporučeni zadani odgovor

| Pitanje vlasniku | Preporuka za MVP | Što se mijenja drukčijim odgovorom |
|---|---|---|
| Računamo tjedan od ponedjeljka u ponoć? | Da, do sljedećeg ponedjeljka, Zagreb. | Granice i testovi; ne minimum. |
| Ostaju li gosti na listama kao sada? | Da, uz postojeći identitet i bez novog javnog profila gosta. | Filter kvalifikacije i osobne pozicije gostiju. |
| Samo javne završene igre, sve pripada kraju cijele igre? | Da. | Ako želi privatne ili raspodjelu poteza po danima, to je veća promjena modela. |
| Nakon istog rezultata i istog broja igara, ranije ostvarenje ima prednost? | Da, zatim stabilni ID. | Dijeljena mjesta ili drugi kriterij utječu na sve prikaze. |
| Treba li brzina dodatni minimum prihvaćenih poteza? | Za ovu verziju zadržati samo 10/20 igara i barem jedan valjan potez; otvoreno naglasiti manu. | Dodatni prag postaje javno pravilo i poseban status, ne skriveni filter. |
| Čuvamo li „Najčešće riječi”? | Da, zaseban postojeći prikaz bez novih osobnih filtera. | Može se sakriti u UI-ju; podatke/API ne brisati bez potrebe. |
| Profil ima odabir metrike i načina, pa pet redaka? | Da, umjesto 50 istodobnih redaka. | Drugi dizajn utječe na prostor i broj upita. |
| Nakon brisanja računa u arhivi ostaje anonimno mjesto? | Da, u skladu s postojećom politikom brisanja, bez osobnih oznaka. | Alternativa mijenja prikaz rupa i povijesni kontinuitet. |

Ne mora se blokirati sav razvoj dok se čeka odgovor na svaki UX detalj. Agent može pripremiti migraciju, zajedničke tipove i testnu infrastrukturu prema odobrenom planu; poslovnu odluku koja mijenja povijesni rezultat ne smije neprimjetno proglasiti potvrđenom.

### 17.3. Što agent mora sam provjeriti

- Stvarni HEAD, lokalne `AGENTS.md` upute, postojeće helper funkcije i shared enumovi.
- Stvarnu shemu/timezone postojećih datuma, postojeće migracije i redoslijed upisa.
- Sprema li motor per-player sažetke za svakog ispalog igrača i gosta i jesu li dostupni na retryju.
- Mogu li igre ili rezultati nestati kroz DB FK cascade, cleanup, brisanje računa ili vanjski job.
- Je li produkcija već pokrenuta i imaju li podaci dokazivu kompletnost, bez ispisa privatnih podataka u plan.
- Koji javni status/dokaz isključuje privatne igre i stare nekonačne rezultate.
- Koji postojeći UI helperi rješavaju brojanje, hrvatske oblike, avatar i javnost profila.
- Postojeće naredbe za testove, build, migraciju i deploy; navesti stvarne naredbe iz package skripti, ne pretpostavljene.

Ne pitati vlasnika ponovno želi li najduži niz pobjeda, minimum 20 po razdoblju, dnevni minimum 10, prednost većeg broja igara ili migraciju staging računa. To je već odlučeno.

## 18. Uputa agentu za početak i završetak rada

**Prvi odgovor agenta u plan modu treba sadržavati:**

1. Kratak opis opsega u najviše nekoliko rečenica i potvrdu pet metrika × dva načina × pet razdoblja.
2. Provjerene razlike između svog HEAD-a i ovog dokumenta, s konkretnim datotekama.
3. Plan promjena po paketima iz poglavlja 14, uključujući migraciju i zaštitu računa.
4. Najviše tri važna pitanja Q1–Q3; ostale predložene zadane odluke može objediniti u kratkom popisu za potvrdu/izmjenu.
5. Testove i kriterije završetka; označiti eventualni stvarni blocker podataka.

Ne treba iznova pisati cijelu ovu specifikaciju. Ne započinjati produkcijski deploy iz plan moda. Nakon dogovorenog plana provesti traženi kod, provjeriti i pripremiti reviewable rezultat; produkcijsko puštanje slijedi autorizaciju i operativni postupak projekta.

**Završni izvještaj implementacijskog agenta:** što je promijenjeno; točna pravila koja su eventualno izmijenjena od ove verzije; migracije i konfiguracija; stvarno pokrenuti testovi; izmjereno opterećenje; preostala ograničenja; uputa za puštanje i rollback. Ne navoditi „sve radi” bez dokaza. Posebno potvrditi da računi i završeni rezultati nisu resetirani.

**Definicija dovršenosti featurea:** svih pet ljestvica i oba načina rade prema istim pravilima u tablici/profilu; 10/20 su testirani po obuhvatu; podaci su trajni i konačni upis je idempotentan; Oko mene i identitet su točni; godišnja arhiva i zaključavanje svih vremena dokazani su kontroliranim satom; stari linkovi rade; vlasnik može razumjeti zašto ima ili nema mjesto.

## 19. Izvori i granice ovog pregleda

Repozitorij: [josipmestrovic/kaladont](https://github.com/josipmestrovic/kaladont), pregledan commit [87bf60439cda67ab921e4a33683ea2f858c01dbe](https://github.com/josipmestrovic/kaladont/tree/87bf60439cda67ab921e4a33683ea2f858c01dbe).

Ključne putanje relativno korijenu repozitorija:

- `aplikacije/posluzitelj/src/baza/shema.ts`
- `aplikacije/posluzitelj/src/profil/rute.ts`
- `aplikacije/posluzitelj/src/igra/upis-partije.ts`
- `aplikacije/posluzitelj/src/igra/motor-partije.ts`
- `aplikacije/posluzitelj/src/racuni/brisanje.ts`
- `aplikacije/posluzitelj/src/server.ts`
- `aplikacije/posluzitelj/test/upis-partije.test.ts`
- `aplikacije/web/src/routes/ljestvica/+page.svelte`
- `aplikacije/web/src/lib/api-url.ts`
- `paketi/zajednicko/src/bodovanje.ts`
- `paketi/zajednicko/src/forma.ts`

Tehnička dokumentacija za PostgreSQL 16:

- [Datumi, intervali i vremenske zone](https://www.postgresql.org/docs/16/functions-datetime.html).
- [Prozorske funkcije](https://www.postgresql.org/docs/16/tutorial-window.html).
- [Numerički tipovi](https://www.postgresql.org/docs/16/datatype-numeric.html).

Nalazi o postojećem kodu temelje se na čitanju izvora na navedenom commitu. Predloženi novi stupci, endpointi, statusi, SQL i arhivski postupak predstavljaju projektni prijedlog, ne tvrdnju da već postoje. U izradi ovog dokumenta nisu izvršene produkcijske migracije, testovi aplikacije ni promjene servera. Integracijske testove i stvarnu izvedbu treba provesti implementacijski agent.
