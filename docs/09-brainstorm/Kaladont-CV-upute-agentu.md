# Kaladont CV

Detaljna specifikacija za implementacijskog agenta · 26. 9. 2026.

## 1. Opseg i izvor

Repozitorij: https://github.com/josipmestrovic/kaladont

Aktualni `origin/main` dohvaćen je tijekom ovog pregleda i pokazuje na commit `2c108c262759717df981b9b41392013294f39301` (24. 9. 2026.). Ovo su upute za novu funkcionalnost, a ne tvrdnja da je CV implementiran. Pregledani su stvarni izvori registracije, sheme, agregata, obračuna igre, DNK-a, rangova, dostignuća, API-ja i oba profila. Nije provjeravano stanje produkcijske baze ili izgled aktivnog staginga.

Prije implementacije pročitaj lokalne projektne upute, provjeri aktualni HEAD i prilagodi putanje ako su se promijenile. Očuvaj korisnikove postojeće izmjene. Prethodne upute za timer i održavanje zaseban su zadatak; ovaj dokument ih ne zamjenjuje.

**Cilj:** inline Kaladont CV uz zaglavlje vlastitog i javnog profila registriranog igrača, s kalendarskim stažem od registracije i kratkom dinamičkom biografijom od 4–5 rečenica. Na desktopu sadržaj je desno od zaglavlja profila, a na mobitelu ispod njega. Tekst je na hrvatskom, u trećem licu muškog roda, s jednom blagom šalom o igri na kraju. Gost na vlastitom profilu vidi samo poruku da opis postaje dostupan nakon registracije; gosti nemaju javni profil ni javni CV.

**Ne graditi:** AI servis, vanjske pozive za generiranje teksta, bazu spremljenih biografija, novu analitiku, novi izračun forme ili nizova pobjeda, izvoz PDF-a/slike, CV editor, administraciju predložaka, zasebnu CV adresu, gumb/modal za otvaranje ili promjenu pravila bodovanja. Reuse-ati postojeći izračun forme i postojeće javne rezultate po načinu igre. Nema podataka sa staginga za uvoz u produkciju.

Sva pravila i pragovi označeni kao CV pravila u nastavku novi su produktni prijedlog za ovaj feature; nisu tvrdnja da već postoje u igri.

## 2. Nazivi

- Interni naziv značajke: **Kaladont CV**. Inline biografija nema vidljiv naslov ni gumb.
- Nadimak je ime kandidata; ne tražiti pravo ime.
- Datum rođenja zamijeniti datumom registracije, uz poštene alternative za gosta i stare račune.
- Vremenski podatak nazvati **Kaladont staž**, a ne aktivno vrijeme igranja.
- „Partija” u novom korisničkom tekstu zamijeniti s **igra**; 1v1 nazivati **dvoboj**, 4p **igra učetvero**.
- Ne koristiti „meč”, „runda” ili „susret” kao dodatne sinonime. Runda može značiti dio igre.
- U kodu ne preimenovati `partije`, `partijaId`, Socket.IO događaje, tablice ni `/partija/` rutu. Terminološka promjena je tekstualna, nije migracija aplikacijskog modela.
- U dodirnutom prikazu profila smiju se urediti oznake poput „Eliminacije po partiji” → „Eliminacije po igri”. Globalna zamjena svih tekstova aplikacije nije dio zadatka.

## 3. Što kod već ima

| Podatak | Stvarni izvor | Važno značenje |
|---|---|---|
| Identitet | `igraci.id`, `vrsta`, `nadimak`, `avatarId`, `avatarConfig`, `avatarRevision` | `vrsta` je gost/registriran/admin; u CV-u admin prikazati kao registriranog igrača. |
| Nastanak identiteta | `igraci.stvoren` | Vrijeme nastanka retka, često prvog dolaska gosta. Nije pouzdan datum kasnije registracije. |
| Registracija | `racuni/rute.ts`, POST `/racuni/registracija` | Gost se nadograđuje UPDATE-om istog retka. Poseban datum registracije trenutačno se ne čuva. |
| Javne igre učetvero | `igraci.odigrane`, `pobjede`, `bodoviUkupno`, `eliminacijeUkupno` | `odigrane` nije zbroj svih načina. |
| Javni dvoboji | `igraci.odigrane1v1`, `pobjede1v1`, `bodovi1v1`, `eliminacije1v1` | Odvojeni brojači; ne oduzimati ih od `odigrane`. |
| Rang | `izracunajRang` u `paketi/zajednicko/src/rangovi.ts` | Kalibracija je 10 javnih igara **u svakom načinu zasebno**. Prije toga „Piskaralo”. |
| Viši trenutačni rang | `vratiVeciRang` | Postojeći avatar/profil već koristi viši rang; CV ga treba objasniti uz pripadajući način. |
| DNK | `dnkStatistikeIgraca`, `igra/izracun-dnk.ts`, `zajednicko/src/dnk.ts` | Šest osi, odvojeno po načinu. Vještina, taktika, fokus, brzina, duge i rijetke riječi. |
| Brzina | `prihvaceniPotezi`, `ukupnoTrajanjePrihvaceniPoteziMs` | Prosjek trajanja prihvaćenih poteza, ne svih pokušaja i ne vrijeme tipkanja. |
| Niz | `najduziStreak` | Najdulji niz prihvaćenih riječi. **Nije niz pobjeda.** |
| Rekordi riječi | `statistikeRijeciIgraca` po načinu | `najduzaRijec`, `najduzaRijecGrafemi`, `najrjedaRijec`, frekvencija/tier. |
| XP/razina | `igraci.iskustvoUkupno` → `stanjeIskustva` | Razina nije rang; ne miješati ih. |
| Dostignuća | `dostignucaIgraca`, `napredakDostignucaIgraca`, `DEFINICIJE_DOSTIGNUCA` | Neka vrijede i u privatnim igrama; iz njih ne dokazivati broj javnih igara. |
| Postojeći stil | `stilIgre()` u `profil/rute.ts` | Spaja eliminacije oba načina uz jedan prag. Ne koristiti za novi precizni opis po načinu. |
| Prosječna ocjena | `prosjecnaOcjenaIgre` profila | Trenutačno bira 4p prosjek, a tek ako njega nema 1v1. Nije objedinjeni prosjek oba načina. Ne koristiti u bio-u v1. |
| Forma/niz pobjeda | `izracunajFormu` u `paketi/zajednicko/src/forma.ts`; `dohvatiFormu` u `profil/rute.ts` već dohvaća do 20 najnovijih javnih rezultata po načinu, uz postojeći niz pobjeda | Reuse-ati ih za sažetak; forma koristi zadnjih do 10, trend uspoređuje dva puna prozora od 10. Ne uvoditi novu formulu. |

U `upis-partije.ts`, `!samoStatistika` odvaja javne agregate i javni DNK od privatnog obračuna. Dostignuća imaju vlastita pravila uključivanja privatnih igara. Broj javnih igara, omjer načina, rang i opis DNK-a u CV-u temelje se samo na spremljenim javnim agregatima. Nedovršene, poništene ili nespremljene igre ne pribrajati.

Trenutačni profil dohvaća `statistikaRijeci` samo za 4p. Za CV-ov rekord treba eksplicitno učitati oba načina; nemoj 4p rekord predstavljati kao osobni rekord svih javnih igara ako 1v1 nije provjeren.

Rijetke riječi u DNK-u uključuju brojače leksemskih grupa. Ne pretvarati taj broj u tvrdnju „odigrao je točno N različitih rijetkih riječi”. Za v1 koristiti opisnu DNK osobinu, bez numeričke tvrdnje o broju različitih riječi.

## 4. Izgled i otvaranje

### 4.1. Na profilu

Prikazati inline blok odmah uz profilno zaglavlje na vlastitom `/profil` i javnom `/profil/javni/[igracId]`. Na desktopu blok stoji desno od avatara i ostalih podataka zaglavlja; na mobitelu se slaže ispod zaglavlja, prije tabova. Nema gumba, modala ni zasebne `/cv/:igracId` stranice. Blok je skriven kad vlasnik otvori Postavke.

Registrirani igrač na vlastitom i javnom profilu dobiva isti sadržaj. Javni profil već dopušta samo registrirane/admin račune; ne mijenjati ga da izlaže goste. Na vlastitom gostujućem profilu prikazati samo: „Ovaj igrač igra kao gost. Opis će biti dostupan nakon registracije.” Ne generirati gostu CV ni prikazivati njegov sadržaj javno.

CV uvijek obuhvaća oba javna načina, neovisno o odabranom tabu Statistika. Sažetak forme i rezultata prikazuje oba načina odvojeno. Greška dohvaćanja povijesti ne smije sakriti već uspješno dohvaćen profil ni inline sažetak; razdvojiti postojeće greške profila i povijesti gdje je potrebno.

### 4.2. Sadržaj inline bloka

Redoslijed:

1. Oznaka staža i proteklo vrijeme od registracije; ne prikazivati točan datum.
2. Nadimak/rang prema postojećem zaglavlju ne duplicirati bez potrebe; u CV sažetku navesti način na kojem vrijedi najviši rang i razinu iskustva.
3. Jedan odlomak od 4–5 rečenica za registrirane, bez zasebnog vidljivog naslova.
4. Činjenični sažetak forme i zadnjih do 10 javnih rezultata, odvojeno za dvoboje i igre učetvero. Uključiti trenutni i najbolji pobjednički niz po načinu. Zadržati detaljnu postojeću karticu forme u pogledu Statistika.
5. Prazan biografski tekst, kad nema javnih igara ni trajnih dostignuća: „Još nemamo dovoljno informacija za opis ovog igrača.” Ostali činjenični podaci i prazna stanja ostaju prikazani.

Za rezultate prikazati stvaran broj do 10. U dvoboju ishod je pobjeda/poraz; u igri učetvero prikazati plasman 1–4. Jedan način bez rezultata dobiva svoje prazno stanje, a drugi način i dalje se prikazuje. Trend je dostupan tek kada postoje najmanje 20 rezultata tog načina, prema postojećem helperu.

Ne stavljati email, adminsko stanje, tokene ili privatne rezultate u inline sadržaj. Koristiti običan tekstovni render; nadimak i dinamička riječ ne smiju se tumačiti kao HTML.

Staž govori samo o vremenu od registracije, ne o aktivnosti ili vremenu provedenom u igri. Gostu se ne prikazuje gostujući staž.

### 4.3. Vizualni detalji

- Reuse tokena iz `aplikacije/web/src/app.css`: krem podloga, zeleni detalj i postojeća tipografija; ne dodavati naslov u inline blok.
- Desktop inline blok treba stati desno od cijelog zaglavlja; ispod 768 px slagati ga ispod avatara i podataka. Koristiti CSS grid s `min-width: 0` i responsive prebacivanje u jedan stupac.
- Koristiti postojeće tipografske tokene. Odlomak ima `line-height: 1.65`, normalno prelamanje i nikakav `line-clamp`.
- Biografski tekst treba biti kompaktan i prirodan uz profil; koristiti samo činjenice iz igre i blagu igračku šalu. Bez razgovora za posao, radnog iskustva, poslodavaca, ugovora, intervjua, preporuka ili drugih poslovnih metafora.
- Rezultati moraju ostati čitljivi na 320/375 px i pri povećanom tekstu; ne dopustiti horizontalno pomicanje zbog nadimka, teksta ili oznaka rezultata.
- Nema modalnih loading/error/focus stanja. API pogreška ne smije pretvoriti igrača u nultu statistiku: koristiti postojeći profilni error tok, a ako profil već postoji, zadržati ga i jasno prikazati da sažetak nije dostupan.

### 4.4. Privatnost i granice gostiju

Javni profil registriranog igrača prikazuje isti CV kao vlastiti profil. Endpointi profila moraju zadržati postojeću zaštitu: javni profil vraća samo `registriran`/`admin` igrače koji nisu obrisani, a privatni `/profil` zahtijeva identitet i vraća samo pripadajućeg igrača. Ne dodavati javni dohvat CV-a po proizvoljnom UUID-u.

Gost vidi samo dogovorenu poruku na vlastitom `/profil`. Javni profil, aktivnost i druge javne rute i dalje isključuju goste. Ne stvarati gostujući identitet za javni prikaz i ne dodavati popis gostiju.

## 5. Datum registracije i staž

### 5.1. Mala potrebna migracija

Dodati u `igraci` nullable timestamptz `registriran_at`, u Drizzle shemi `registriranAt`. **Bez `defaultNow()`**, jer gost nije registriran.

- Nova izravna registracija: zapisati datum u istom INSERT-u kao registrirani račun. Izričito zadati isti DB trenutak za `registriranAt` i `stvoren`; nemoj kombinirati raniji Node `new Date()` s kasnijim PostgreSQL `DEFAULT now()` jer bi novi račun izgledao kao da je registriran prije nastanka.
- Gost → registriran: zapisati datum u istom UPDATE-u koji mijenja vrstu računa; sačuvati `stvoren`, ID i svu statistiku. Uvjetovati UPDATE s `id` i `vrsta = 'gost'`, koristiti `returning` i odbiti zahtjev ako redak više nije gost.
- Vrijeme uzeti na serveru, ne iz request bodyja.
- Postavljanje je jednokratno; prijava, promjena emaila, potvrda emaila, avatar i nadimak ne mijenjaju datum.
- Ponovljeni ili neuspjeli zahtjev ne smije prepisati već postojeći datum. Pri konkurentnoj registraciji nadograditi samo redak koji je još gost, provjeriti `returning`/broj izmijenjenih redaka; ne prijavljivati drugi zahtjev kao uspješan prijenos istoga gosta. Zadržati postojeće zaštite jedinstvenog emaila.
- Migracija dodaje stupac i ne dira postojeće račune. Novi broj migracije generirati prema aktualnom journalu; ne preimenovati stare datoteke.
- Stare registrirane račune ostaviti s `NULL`, osim ako postoji izravan, provjerljiv podatak o stvarnoj registraciji. Ne backfillati sa `stvoren`, prvom igrom, posljednjom potvrdom emaila ili vremenom migracije.

To je jedina nova trajna informacija potrebna za CV. Bio i staž se ne pohranjuju.

### 5.2. Prikaz datumskog bloka

| Stanje | Prvi redak | Staž i njegova osnova |
|---|---|---|
| Registriran/admin, valjan `registriranAt` | Točan datum se ne prikazuje | „Kaladont staž”, računat od registracije |
| Stari registrirani, nema `registriranAt` | Točan datum nije zabilježen | „Staž nije dostupan”; pomoć „Datum registracije nije zabilježen.” |
| Gost, bilo koji `stvoren` | Ne prikazuje se | Nema gostujućeg staža ni CV-a |
| Registrirani, datum nedostaje/nevaljan/budući | Točan datum nije zabilježen | „Staž nije dostupan”; bez lažne nule |

Ako je poznat `registriranAt` nevaljan, ne zamjenjivati ga sa `stvoren` niti datumom prve igre; prikazati nedostupno i zabilježiti internu dijagnostiku. `stvoren` služi postojećoj logici računa, ali nikad nije CV staž. Ne poništavati statistiku pri registraciji.

### 5.3. Točan izračun

- Staž računati s referentnim vremenom poslužitelja i datumom početka `registriranAt`, oba pretvorena u kalendarski datum **Europe/Zagreb**.
- Razlika nije `floor((now-start)/86400000)`: to pogrešno tretira ponoć i ljetno vrijeme.
- Čista funkcija prima početni civilni datum i današnji civilni datum kao argumente; ne koristi globalni `Date.now()` u testiranoj logici.
- Izračunati pune kalendarske godine, zatim mjesece, zatim preostale dane. Za nepostojeći datum godišnjice koristiti zadnji dan mjeseca (29. 2. → 28. 2. u ne-prijestupnoj godini).
- Implementacijski algoritam: `years = end.year - start.year`, `anchor = addYearsClamped(start, years)`; ako `anchor > end`, smanjiti years za 1 i ponovno izračunati anchor. Iz `anchor` izračunati broj punih mjeseci; `addMonthsClamped(anchor, months)` mora biti <= end. Ostatak dana je razlika civilnih day-index vrijednosti. Računanje dodatka mjeseci ide od tog anchor-a, ne iteracijom mjesec po mjesec koja gubi izvorni dan.
- Civilni day-index smije koristiti UTC datum napravljen iz već izdvojenih year/month/day dijelova. Ne koristiti UTC datum izvornog timestampa prije pretvorbe u Zagreb.
- Format prikazuje najviše dvije nenulte jedinice: „2 godine i 3 mjeseca”, „1 godina i 4 dana”, „1 mjesec i 2 dana”, „2 dana”. Ako je sve 0, „Prvi dan”. Ne zaokruživati na sljedeći mjesec/godinu.
- U internom/shared rezultatu zadržati i `ukupnoDana` radi testiranja; pojam je protekli broj kalendarskih dana, ne uključivo brojanje. UI prikazuje samo izračunati staž.
- Staž je dio običnog profilnog odgovora i obnavlja se pri učitavanju profila; nema posebnog modalnog dohvaćanja ni timer/listenera do ponoći.

Primjeri: isti dan = Prvi dan; sljedeći kalendarski dan = 1 dan; 31. 1. → 28. 2. 2027. = 1 mjesec; 29. 2. 2024. → 28. 2. 2025. = 1 godina. Za fiksne testove koristite eksplicitne civilne datume, ne stvarni dan izvođenja.

## 6. Arhitektura i ugovor

### 6.1. Postojeći profilni API

Ne dodavati CV endpoint. Proširiti `GET /api/profil` i postojeći `GET /api/profil/javni/:igracId` samo potrebnim registracijskim stažem i CV rečenicama; `api.ts` već šalje identitetski token za privatni profil. Javni profil mora zadržati postojeće ograničenje na registrirane/admin račune i `obrisanAt IS NULL`. Privatni profil ostaje vezan uz autentificiranog igrača. Nikad ne dodavati javni CV dohvat po proizvoljnom UUID-u.

- Javni profil ne smije dobiti email, hash, tokene, IP, `zadnjaAktivnost` ili oznaku adminsko/registrirano stanje izvan već definiranog DTO-a.
- Registracijski `registriranAt` može biti null za stare račune; API vraća nedostupan staž, nikad zamjenski `stvoren` datum.
- Javni rezultati, rang i DNK dolaze iz već postojećih javnih agregata. Reuse-ati postojeće helper-e za formu/niz i dostignuća; ne čitati poteze ili cijelu povijest za bio.
- CV računanje koristi isti profilni snapshot, bez zasebnog nesinkroniziranog poziva za privatni/javni CV. Shared generator je deterministički pa isti profilni podaci daju isti tekst.
- Dostignuća računati kao postojeći profil: za poznatu definiciju najveća od spremljene razine i razine izvedene iz postojećeg brojača. Poštovati katalog; ne izmišljati dostignuće iz slobodnog stringa.

### 6.2. Shared tipovi i profilni DTO

Predloženi shared ugovor u `paketi/zajednicko/src/cv.ts` (imenovanja se mogu uskladiti s projektom, semantika ne). Profilni API ugradi ga u postojeće odgovore i nadopuni već postojeće `forma` objekte; nema zasebne rute:

```ts
export type CvMod = 'dva_igraca' | 'cetiri_igraca';
export type CvOsnovaStaza = 'registracija' | 'nepoznato';
export type CvRecenice =
  | readonly [string, string, string, string]
  | readonly [string, string, string, string, string];
export type CvBiografija =
  | { tip: 'opis'; recenice: CvRecenice }
  | { tip: 'nedovoljno_informacija'; tekst: string };

export interface KaladontCvDto {
  verzijaPredlozaka: 1;
  datum: {
    osnova: CvOsnovaStaza;
    oznaka: string;
    pomoc: string | null;
  };
  staz: {
    godine: number;
    mjeseci: number;
    dani: number;
    ukupnoDana: number;
    tekst: string;
  } | null;
  kvalifikacija: {
    rang: string; // Piskaralo kad još nema kalibriranog ranga
    kalibriran: boolean;
    nacini: readonly CvMod[]; // načini u kojima vrijedi prikazani rang
    razina: number; // iz stanjeIskustva
  };
  biografija: CvBiografija;
}
```

Profilni odgovor već sadrži identitet i avatar; ne duplicirati ih u CV podobjektu. Ne slati detaljne interne odluke/SQL izvore u javni odgovor. Za testove generator može vratiti dodatne `templateId`, `stilMod`, `primarnaOs`, `dokazId` u internoj strukturi, ali ih profilni API ne serializira.

Server/shared generator sastavlja tekst. Frontend prikazuje `biografija.recenice.join(' ')` kao običan tekst kad je `biografija.tip === 'opis'`, ili `biografija.tekst` za no-info stanje; nema `{@html}`, markdown parsiranja ili interpolacije u HTML. Ne brojati rečenice dijeljenjem po točki; broj elemenata tuplea je izvor istine.

### 6.3. Čista logika, jedan izvor pravila

- `normalizirajCvPodatke`: eksplicitni adapter iz DB snapshot-a u tipizirani ulaz.
- `odaberiRaspodjeluIgara`: odabir S1 prema pravilima niže.
- `odaberiKvalifikaciju`: rangovi postojećim funkcijama, bez kopiranih pragova.
- `odaberiStil`: javni DNK određenog načina, bez spajanja skala.
- `odaberiDokaz`: najviše jedna zanimljivost.
- `sastaviKaladontCv`: stabilni predlošci, vraća 4–5 rečenica i interne odluke za test.
- `izracunajKalendarskiStaz` i hrvatski numerali odvojeni su čisti helperi.

Predložena podjela: čisti hrvatski formatteri/generator u shared paketu, DB adapter unutar postojećih profilnih ruta i inline Svelte komponenta u webu. Renderer ne importira DB, Socket.IO ili browser storage. Generator ne poziva mrežu i ne zapisuje ništa.

Ako nedostaje cijeli opcionalni DNK/statistika redak, to znači „nema pouzdanog podatka za tu osobinu”, a ne automatski nula. U DB-u valjana spremljena nula jest nula. Ne koristiti `value || default` za brojke. Brojila javnih igara moraju biti nenegativni sigurni cijeli brojevi; ako su temeljna brojila oštećena, vratiti nedostupan CV i internu dijagnostiku, ne generirati lažan CV početnika. Neispravna opcionalna metrika isključuje samo tu osobinu/dokaz. Ne popravljati bazu pri GET zahtjevu.

## 7. Potpuna pravila za biografiju

### 7.1. Struktura, duljina i stabilnost

Normalan biografski opis za registriranog igrača ima:

1. S1 — iskustvo i raspodjela javnih igara;
2. S2 — kvalifikacija/rang;
3. S3 — stil iz DNK-a ili pošten opis zašto ga još nema;
4. E — neobvezan dokaz: dostignuće ili rekord;
5. H — jedna završna CV šala.

Ako E ne postoji, rezultat je `[S1,S2,S3,H]`; inače `[S1,S2,S3,E,H]`. Ovo pravilo ne vrijedi za registrirani profil bez javnih igara i bez trajnih dostignuća: tada se umjesto biografskog odlomka prikazuje jedna poruka „Još nemamo dovoljno informacija za opis ovog igrača.” Gosti uvijek dobivaju samo zasebnu poruku iz odjeljka 4.1. Ne dodavati šestu rečenicu ili pozdrav. Staž se prikazuje odvojeno od biografije.

Ciljati 55–100 riječi, tvrdi limit 120 riječi za odlomak. Testirati sve predloške s maksimalnim valjanim nadimkom i velikim brojevima. Ako izlaz premaši 120 riječi, prvo izostaviti E, zatim drugu DNK osobinu; ne rezati tekst, riječ ili rečenicu usred sadržaja. Ako i nakon toga prelazi limit, koristiti unaprijed napisane kraće S1/S2 varijante, ne LLM i ne substring. Te varijante su: S1 „{nadimak} ima {D(n2)} i {I(n4)} učetvero u javnim igrama.” za oba pozitivna načina; S2 „Njegov najviši trenutačni rang je „{rang}” ({lokacijaRanga}).” Za nule zadržati njihove kratke specijalne grane.

Pragovi v1 na jednom mjestu:

```ts
const CV_MIN_IGARA_ZA_IZBOR_CESCEG_NACINA = 10;
const CV_DOMINANTNI_UDIO = 0.60;
const CV_MIN_PRIHVACENIH_POTEZA_ZA_STIL = 10;
const CV_MIN_ISTAKNUTA_OS = 60; // postojeća normalizirana DNK vrijednost 0..100
const CV_MAKS_RAZLIKA_DRUGE_OSI = 20;
const CV_MIN_RAZINA_DOSTIGNUCA_ZA_BIO = 2;
const CV_MIN_NIZ_RIJECI_ZA_BIO = 5;
```

Za DNK i rang prag broja igara uzeti iz postojećih funkcija/konstanti (`jeDnkOtkljucan`, `BROJ_PARTIJA_ZA_KALIBRACIJU`), ne stvarati treći broj „10” za istu stvar. Novih 10 prihvaćenih poteza je CV uvjet kvalitete uzorka, ne promjena otključavanja DNK grafa.

Tekst je deterministički: isti podaci + isti igrač + ista verzija predložaka daju iste rečenice. Staž se mijenja s datumom, bio ne mora. Ne koristiti `Math.random`, redoslijed SQL rezultata, avatarRevision, vrijeme requesta ili redoslijed tabova kao seed. Dvije varijante završne šale birati stabilno po ID-u; dovoljno je paritet zadnjeg heksadekadskog znaka validiranog UUID-a (`parseInt(id.at(-1)!, 16) % 2`). Ne uvoditi hash servis. Varijante i njihov redoslijed dio su verzije predložaka.

### 7.2. S1 — broj igara i češći način

Označimo:

```ts
n2 = igrac.odigrane1v1;
n4 = igrac.odigrane;
n = n2 + n4;
// I(x): hrvatski broj + igra u akuzativu (1 igru, 2 igre, 5 igara)
// D(x): broj + dvoboj (1 dvoboj, 2 dvoboja, 5 dvoboja)
```

Sljedeću tablicu evaluirati redom; prva odgovarajuća grana pobjeđuje. Za oba pozitivna načina i `n >= 10`, dominantnost računati bez zaokruživanja postotka: `5 * nDominantni >= 3 * n`. Ne određivati dominantnost već na 51 : 49. Ne tvrditi da igrač nešto „voli”, jer se zna samo koliko je igrao.

| Uvjet | Točan predložak |
|---|---|
| `n === 0` | „{nadimak} još nije završio nijednu javnu igru.” |
| `n2 > 0 && n4 === 0` | „{nadimak} dosad je završio {D(n2)}, a javnu igru učetvero još nije odigrao.” |
| `n4 > 0 && n2 === 0` | „{nadimak} dosad je završio {I(n4)} učetvero, a javni dvoboj još nije odigrao.” |
| oba > 0, `n < 10` | „{nadimak} dosad je završio {D(n2)} i {I(n4)} učetvero u javnim igrama.” |
| oba > 0, `n >= 10`, `n2 === n4` | „{nadimak} ima podjednak broj javnih igara u oba načina: završio je {D(n2)} i {I(n4)} učetvero.” |
| oba > 0, `n >= 10`, `n2/n >= 0.60` | „{nadimak} više javnih igara odigrao je u dvobojima: završio je {D(n2)} i {I(n4)} učetvero.” |
| oba > 0, `n >= 10`, `n4/n >= 0.60` | „{nadimak} više javnih igara odigrao je učetvero: završio je {I(n4)} učetvero i {D(n2)}.” |
| preostalo, oba > 0 | „{nadimak} igra oba javna načina: završio je {D(n2)} i {I(n4)} učetvero.” |

U granama samo jednog načina broj se odnosi na javni skup kako definira napomena CV-a. Može se eksplicitno dodati „u javnim igrama” ako urednik želi, ali ne uvoditi riječ „nikad”: privatne igre nisu obuhvaćene tim brojem.

### 7.3. S2 — kvalifikacija

Rang svakog načina izračunati postojećim `izracunajRang`. Rang u tekstu mora biti jednak postojećem rangiranju profila za iste agregate, a ne `dnk.osi[vjestina].oznaka`.

- Kalibriran je samo način s potrebnih 10 igara. Npr. 9 dvoboja + 9 igara učetvero još ne daje kalibrirani rang ni u jednom načinu.
- Od kalibriranih načina izabrati viši rang preko postojećeg poretka / `vratiVeciRang`.
- Ako oba imaju isti najviši rang, navesti oba, bez odlučivanja po broju igara.
- Ako je viši rang u manje igranom načinu, S1 i S2 smiju spominjati različite načine, uz izričito imenovanje. To nije kontradikcija.
- Ne koristiti „najviši ikada”, jer se prati trenutačni rang, ne povijesni maksimum.

Predlošci:

| Stanje | Tekst |
|---|---|
| Najviši rang samo u 1v1 | „Njegov je najviši trenutačni rang „{rang}”, ostvaren u dvobojima.” |
| Najviši rang samo u 4p | „Njegov je najviši trenutačni rang „{rang}”, ostvaren u igri učetvero.” |
| Oba imaju isti kalibrirani najviši rang | „Njegov je najviši trenutačni rang „{rang}”, koji ima u oba načina igre.” |
| Oba nekalibrirana, `n === 0` | „Trenutačno ima početnu oznaku „Piskaralo”, a prvi rang tek treba steći.” |
| Oba nekalibrirana, `n > 0` | „Trenutačno ima početnu oznaku „Piskaralo”, a do prvog ranga {nedostajeFraza} u {cilj}.” |

Za posljednju granu `cilj` je način s više igara, pri jednakosti odabrati dvoboje radi stabilnosti; `{cilj}` = „dvobojima” ili „igri učetvero”. `preostalo = BROJ_PARTIJA_ZA_KALIBRACIJU - max(n2,n4)`. Gramatika `{nedostajeFraza}`: „nedostaje mu još 1 javna igra”, „nedostaju mu još 2 javne igre”, „nedostaje mu još 5 javnih igara”. Ovo nije akuzativni I(n), nego poseban nominativni helper.

Razina stoji u metapodacima kartice kao „Razina iskustva: 12”. Ne zatrpavati bio još jednim brojem nakon ranga. Razina može rasti po postojećim pravilima, bez izmišljanja radnog mjesta „junior/senior” prema starosti računa.

### 7.4. S3 — DNK stil

**Odabir načina za stil:**

1. Kandidati su samo načini s otključanim DNK-om prema postojećem pravilu, stvarnim DNK retkom, najmanje 10 prihvaćenih poteza i valjanim osnovnim brojačima.
2. Među kandidatima uzeti onaj s više javnih igara; pri istom broju dvoboje.
3. Ako češći način ima oštećen/nedostajući DNK, a drugi je valjan i otključan, uzeti drugi i eksplicitno ga imenovati. Ne predstavljati ga kao stil prvoga.
4. Niti jednu osu ne uzimati iz drugog načina radi ljepšeg opisa. Ne prosječiti DNK 1v1 i 4p.

**Osobine:**

- Koristiti kanonske osi iz `izracunajDnk` / `izracunajKaladontDnk`.
- Izuzeti `vjestina`: već je obrađena rangom.
- Kandidat mora imati `vrijednost >= 60`, valjan broj 0–100 i odgovarajući valjan izvorni podatak. `NaN`, infinity, negativni ili vrijednost izvan 0–100 = nevaljano, ne clamp radi lijepe priče.
- Brzina dodatno zahtijeva ukupan zabilježeni pozitivan vremenski zbroj i prosjek > 0. Nula ne znači superbrz igrač.
- Fokus zahtijeva pozitivan valjan najduži niz; duge/rijetke pozitivan valjan relevantni brojač; taktika valjan pozitivan broj eliminacija. Pozitivne vrijednosti koje proturječe broju prihvaćenih poteza treba odbaciti gdje su jedinice doista usporedive, npr. broj dugih riječi ne može biti veći od broja prihvaćenih poteza. Ne uspoređivati broj leksemskih grupa s brojem riječi kao da su ista jedinica.
- Sortirati silazno po vrijednosti, kod jednakosti po redoslijedu `rijetke_rijeci`, `duge_rijeci`, `taktika`, `fokus`, `brzina`.
- Uzeti prvu; drugu samo ako je također >= 60 i zaostaje najviše 20 bodova za prvom. Najviše dvije.
- Prag 60 je urednički prag istaknute osobine CV-a, **nije percentil među igračima**. Ne govoriti „bolji od 60 % igrača”, „top 10 %” ili slično.

Fragmenti su namjerno u instrumentalu i mogu se sigurno povezati s „i”:

| Os | Fragment |
|---|---|
| `brzina` | „brzim prihvaćenim potezima” |
| `duge_rijeci` | „uporabom dugih riječi” |
| `rijetke_rijeci` | „otkrivanjem rijetkih riječi” |
| `taktika` | „izazvanim eliminacijama” |
| `fokus` | „dugim nizom prihvaćenih riječi” |

Predložak jedne/dviju osobina: „{U nacinu} njegov se DNK ističe {fragment1}[ i {fragment2}].”

`{U nacinu}` je „U dvobojima” ili „U igri učetvero”. Ne ispisivati raw labelu kao „stil mu je Brzi” ili „on je Sigurne riječi”. Fragmenti su unaprijed provjereni; nema programatskog sklanjanja oznaka.

**Fallbackovi, redom:**

| Stanje | S3 |
|---|---|
| `n === 0` | „Za opis njegova stila u javnim igrama tek treba prikupiti podatke.” |
| Nijedan način nije otključan | „Njegov stil još se oblikuje, a DNK profil otključava nakon deset javnih igara u istom načinu.” |
| Postoji otključan način, ali nema valjanog uzorka poteza/DNK retka | „Za pouzdan opis njegova stila još nedostaje zabilježenih podataka o potezima.” |
| Valjan odabrani način i sve osim eventualne brzine imaju valjane podatke, ali nijedna os ne prelazi prag | „Njegov DNK {u nacinu} zasad ne izdvaja jednu jasnu specijalnost.” |
| Postoji djelomično oštećen DNK, nema nijedne sigurne jake osobine | „Za pouzdan opis njegova stila još nedostaje zabilježenih podataka o potezima.” |

Donji početni oblik `{u nacinu}` je „u dvobojima” / „u igri učetvero”. Ne proglašavati sporog igrača glupim, nisku taktiku miroljubivim karakterom ili visok fokus koncentracijom u stvarnom životu. Mjerimo samo igru.

### 7.5. E — jedan dokaz iz statistike

Za zanimljivost je dovoljan jedan postojeći dokaz. Ne navoditi svih deset metrika. U v1 primijeniti sljedeći redoslijed, bez nasumičnog preslagivanja:

**E1. Dostignuće**

- Poznato pozitivno dostignuće s razinom >= 2 i <= broju pragova.
- Whitelist i konačni tie-break redoslijed: `kaladont`, `rijetkolovac`, `dugometras`, `jezik_u_plamenu`, `slijepa_ulica`, `lovac_na_glave`, `zavrsna_rijec`, `iskusnjara`.
- Sortirati po udjelu dovršenosti (`razina / brojPragova`) silazno, zatim po whitelist redoslijedu. Broj pragova trenutačno je 5, ali ne hardkodirati to u račun.
- `ka_zna` ne birati za pohvalu (to je izbacivanje igrača); `glas_zajednice` nije igračka kvalifikacija za ovaj bio. Ne mijenjati njihov postojeći prikaz drugdje.
- Tekst: „Među njegovim dostignućima ističe se „{naziv}”, s osvojenih {zvjezdiceGenitiv}.” Primjeri: „2 od 5 zvjezdica”, „5 od 5 zvjezdica”. Ovdje zbog uvjeta >= 2 nema konstrukcije „s osvojenih 1”. Ako se prag jednog dana spusti na 1, treba zasebna gramatička grana.
- Dopušteno i za `n === 0`: neka dostignuća mogu biti iz privatnih igara. Tada ne tvrditi da su ostvarena javno.

**E2. Najduža riječ**

Ako nema E1, uzeti već zabilježenu najdužu riječ oba javna načina, samo iz načina s `nMode > 0`. Za kandidata tražiti valjan ne-prazan tekst bez kontrolnih znakova, ispravnu duljinu prema postojećem `grafemi()` i `grafemi >= PRAGOVI_DULJINE.duga` (trenutačno 10). Riječ duža od 64 grafema izostaviti iz bio-a kao zaštitu prikaza; ovo ne mijenja pravila igre. Ne rezati je na pola.

Sortirati po broju grafema silazno, zatim načinu (dvoboji prije 4p), zatim stabilnoj leksikografskoj usporedbi normaliziranog teksta. Jedna kandidatska riječ po načinu, nema povijesne pretrage.

Tekst: „U javnim igrama njegova najduža zabilježena riječ glasi „{rijec}” ({N} {slovo}).” Za 10 „10 slova”, 21 „21 slovo”, 22 „22 slova”. U korisničkom tekstu „slovo” znači grafem po pravilima Kaladonta; `nj`, `lj`, `dž` obrađuje postojeći helper s njegovim iznimkama. Ne koristiti `string.length`.

Ako nema valjanog E2 najdužeg rekorda, kao rezervu upotrijebiti `najrjedaRijec` iz moda s javnim igrama. Tekst mora ostati činjeničan i ne tvrditi apsolutni rekord: „Među njegovim zabilježenim rijetkim riječima nalazi se „{rijec}”.” Postojeće spremanje bira najbolji tier i ne jamči usporedbu frekvencije svih riječi unutar njega.

**E3. Niz prihvaćenih riječi**

Ako nema E1/E2, uzeti maksimalni valjan `dnk.najduziStreak` iz javnih načina s `nMode > 0`, ako je >= 5. Za ovaj dokaz nije potrebno 10 igara: to je ostvareni rekord, ne generalizacija stila. Ako S3 već uključuje fokus, preskočiti E3 da ne ponavlja istu stvar.

Tekst: „Njegov najdulji niz obuhvaća {N} uzastopno prihvaćenih riječi.” To je gramatički stabilno bez „5 uzastopnih pobjeda” ili krive množine nakon 21. Ne nazivati nizom trenutačnu seriju jer je ovo maksimum.

**E4. Javne pobjede**

Ako nema E1–E3, `pobjede + pobjede1v1 >= 1`, brojevi su valjani i svaki <= broju igara odgovarajućeg načina:

„U javnim igrama dosad je ostvario {pobjedeAkuzativ}.” Npr. „1 pobjedu”, „2 pobjede”, „5 pobjeda”. Ne izvoditi pobjede iz bodova i ne navoditi win-rate bez potrebe.

**Nema dokaza:** izostaviti E. Nema „još nema nikakvih uspjeha” jer to ne znamo i ne treba obeshrabrivati igrača.

Ukupne bodove, prosječnu ocjenu i eliminacije već imamo za druge prikaze; ne moraju svi završiti u bio-u.

### 7.6. H — blaga igračka šala

Odabir kategorije redom:

1. Registriran i `n === 0`.
2. Registriran, `n > 0`, postoji primarna DNK os u S3 — kategorija te osi.
3. Registriran, `n > 0`, nema primarne osi — neutralna kategorija.

Unutar kategorije odabrati jednu od dvije varijante stabilnim paritetom UUID-a iz 7.1. Sve su to metafore, ne novi statistički zaključci.

| Kategorija | Varijanta 0 | Varijanta 1 |
|---|---|---|
| Bez javnih igara | „Prva javna igra još čeka da otvori ovu priču.” | „Početak njegove javne statistike još je prazan list.” |
| Brzina | „Kad se pojavi prava riječ, njegov odgovor ne čeka dugo.” | „Ponekad potez stigne prije nego što protivnik završi misao.” |
| Duge riječi | „U njegovoj igračkoj priči duge riječi zauzimaju posebno mjesto.” | „Kad riječ potraje, i potez dobije svoju malu priču.” |
| Rijetke riječi | „U njegovim se igrama katkad pojavi riječ koju protivnik nije očekivao.” | „Rijetka riječ ponekad postane najpamtljiviji dio njegove igre.” |
| Taktika | „Timski je igrač, sve dok ostali ne sjednu za suprotnu stranu stola.” | „Jednim potezom katkad promijeni smjer cijele igre.” |
| Fokus | „Kad uhvati niz prihvaćenih riječi, teško ga je prekinuti.” | „Njegovi nizovi riječi znaju potrajati dulje od očekivanog.” |
| Neutralno | „Svaka igra njegove priče započinje s dva nova slova.” | „Njegova igra piše se potez po potez.” |

Ne dodavati šalu u S1/S2/S3/E. Koristiti samo jednu završnu, blagu šalu o igri; bez poslovnih/karijernih referenci i bez šala o inteligenciji, dobi, spolu ili vjeri. CV generator se poziva samo za registrirane/admin profile; gostu se prikazuje zasebna poruka, bez šale ili CV sadržaja.

## 8. Hrvatska gramatika

### 8.1. Brojevi

Nemoj osloniti akuzativ na generički `Intl.PluralRules` bez tablice padeža. Za nenegativan cijeli broj:

```ts
function oblikBroja(n: number): 0 | 1 | 2 {
  // 0 = jedan, 1 = nekoliko (2–4), 2 = ostalo
  if (!Number.isSafeInteger(n) || n < 0) throw new Error('Nevaljan broj');
  const zadnjeDvije = n % 100;
  if (zadnjeDvije >= 11 && zadnjeDvije <= 14) return 2;
  const zadnja = n % 10;
  if (zadnja === 1) return 0;
  if (zadnja >= 2 && zadnja <= 4) return 1;
  return 2;
}
```

| Kontekst | jedan | nekoliko | ostalo |
|---|---|---|---|
| Završio je N… | igru | igre | igara |
| Javne igre, akuzativ | javnu igru | javne igre | javnih igara |
| Završio je N… | dvoboj | dvoboja | dvoboja |
| Ostvario je N… | pobjedu | pobjede | pobjeda |
| Duljina riječi N… | slovo | slova | slova |
| Staž N… | dan | dana | dana |
| Staž N… | mjesec | mjeseca | mjeseci |
| Staž N… | godina | godine | godina |
| Nedostaje/nedostaju… | 1 javna igra | 2 javne igre | 5 javnih igara |

Sufiks broja računati iz numeričke vrijednosti, a prikaz broja formatirati `Intl.NumberFormat('hr-HR', { maximumFractionDigits: 0 })`. Oblik 101 = „101 igru”, 111 = „111 igara”, 112 = „112 igara”, 122 = „122 igre”. Za tabličnu oznaku „Odigrane igre” množina ne ovisi o iznosu jer je to naziv polja, ali bio mora biti točan.

Za `nedostajeFraza`: several → „nedostaju mu još…”, one i many → „nedostaje mu još…”. Primjeri su namjerno nominativni, ne „nedostaje mu još 1 igru”.

### 8.2. Nadimci i nazivi

- Nadimak nikada ne sklanjati niti iz njega zaključivati rod. **U svim S1 predlošcima `{nadimak}` renderirati kao `Igrač ${nadimak}`**. Tako „Igrač Ana dosad je završio…” ostaje u dogovorenom muškom rodu jer se odnosi na imenicu „igrač”, ne na nadimak. U primjerima ispod primjenjuje se to pravilo; nadimak u zaglavlju ostaje bez prefiksa. Ne uvoditi automatsko otkrivanje roda.
- Nazive rangova ne sklanjati: „rang „Doktor riječi””, ne generirati „Doktora riječi” iz stringa.
- Dostignuće u navodnicima ostaje iz kataloga: „dostignuće „Jezik u plamenu””.
- Dinamičke riječi navoditi kao citat, nikad pokušavati sklanjati njihov oblik.
- Osi imaju ručno napisane instrumentalne fragmente, zato su sve njihove kombinacije gramatički sigurne.
- Koristiti hrvatske navodnike „…”. Kontrolirati završnu točku; nedodavanje dodatne točke iza uskličnika unutar citiranog naziva ne rješavati općim splitanjem rečenica.
- Ne pisati „21 odigranih igara” ili „1 mjeseci”. Bio ne treba decimalne brojeve pa ih v1 izbjegava.

## 9. Rubni slučajevi — obvezno ponašanje

| Slučaj | Očekivano ponašanje |
|---|---|
| Nema javnih igara | S1 jasno kaže **javnih**; ne tvrditi da nema privatnog iskustva. Rang početni, nema stila. |
| 2 dvoboja, 0 igara učetvero | Navesti 2 dvoboja, ne govoriti da preferira dvoboje; cilj kalibracije još 8 dvoboja. |
| 0 dvoboja, 2 igre učetvero | Zrcalna logika, bez 1v1 DNK-a iz nula podataka. |
| 1 dvoboj | „1 dvoboj”, ne „1 dvoboja”; još 9 javnih igara u dvobojima do ranga. |
| 1 igra učetvero | „1 igru učetvero”; nijedan postotak uspješnosti. |
| 1 + 1 | Mala činjenična grana, ne zaključivati trajnu preferenciju. |
| 9 + 9 | Oba DNK-a i oba ranga još nekalibrirana, unatoč ukupno 18 igara. |
| 10 + 0 | Rang i DNK u dvobojima mogu biti otključani, ali stil još treba valjane podatke o potezima. |
| 0 + 10 | Isto za 4p. |
| 6 + 4 | S1 češće dvoboji (60 %), ali stil još nije otključan ni u jednom načinu. |
| 59 + 41 | Nema dominantne grane, jer je manje od 60 %. |
| 60 + 40 | Dominantni dvoboji. |
| 50 + 50 | Jednaka raspodjela; rang ne mora biti isti; stil pri valjanim podacima bira 1v1. |
| Češći način ima niži rang | Broj igara u S1; viši rang uz točan drugi način u S2. |
| Oba imaju isti rang | S2 navodi oba, header također. |
| Postoji 100 igara, ali nema DNK retka | Rang može postojati; S3 kaže da nedostaju podaci. Nije novaček i nije „Munjevit”. |
| Prihvaćeni potezi 0 | Nema brzine ili stila iz defaulta 0 ms. |
| Prihvaćeni potezi 9/10 | Granica CV uzorka; 9 nema stila, 10 dopušta valjane osi ako je otključan DNK. |
| Prosjek vremena 0 / negativan / NaN | Brzina se izostavlja. Ostale valjane jake osi mogu ostati. |
| Zaključani DNK već sadrži visoke izračunate osi | Ne prikazati stil do otključavanja. |
| Primarna os 60 | Dopuštena; 59 nije. |
| Druga os na 20 bodova razlike | Dopuštena; 21 razlike nije; obje moraju biti >= 60. |
| Sve osi jednako visoke | Stabilni tie-break; maksimalno dvije. |
| Sve valjane osi slabe | Neutralna S3; ne generirati lažnu specijalnost ili „uravnotežen” osobni karakter. |
| Gost ima 200 javnih igara | Ne postoji javni gost profil/CV; vlastiti profil gosta prikazuje samo dogovorenu poruku. |
| Gost bez javnih igara, s privatnim dostignućem | I dalje prikazati samo gostujuću poruku; ne generirati ni objaviti CV. |
| Gost se registrira | ID i statistika ostaju; `registriranAt` se postavlja, a inline CV se može generirati za registrirani profil. |
| Stari registrirani bez točnog datuma | „Na Kaladontu od”, nikad izmišljeni datum registracije. |
| Admin | Isti javni CV kao registrirani, bez posebne javne administratorske oznake. |
| Račun obrisan | 404, bez starog CV-a iz cachea. Novi korisnik istog nadimka ima drugi ID i svoj staž. |
| Ponovna instalacija/brisan gost-token | CV se veže uz ID, ne uz nadimak ili preglednik; ne spajati dva gosta istog imena. |
| Posjet vlastitom i javnom CV-u | Isti podaci i predlošci za isti snapshot. Nema „ti” verzije i „on” verzije. |
| Nadimak s `_`, `-`, brojevima ili ženskim imenom | „Igrač {nadimak}”; nema sklanjanja nadimka. |
| Neočekivan HTML u starom nadimku | Render kao tekst; nikakav HTML execution. Ne mijenjati povijesne nadimke u GET-u. |
| Najduža riječ samo u dvobojima | Pronaći je učitavanjem statistike oba načina, ne samo 4p. |
| Rekord i nula javnih igara tog načina | Ne koristiti taj nekonzistentan rekord za javni bio. |
| `nj`, `lj`, `dž` i iznimke | Duljina preko `grafemi()`, jednako kao igra. |
| Najrjeđa riječ postoji | V1 je ne koristi kao apsolutni rekord; ne obećavati dokaz koji update ne jamči. |
| Nepoznato dostignuće iz stare baze | Ignorirati nepoznati ID; ne ispisivati raw ID. |
| Dostignuće razine 1 | Nema E1, ali drugi dokaz može postojati. |
| Nema javnih igara ni trajnog dostignuća | Prikazati no-info poruku umjesto biografije; rang/staž/form-status i dalje su činjenični podaci. |
| Nema nijednog dobrog dokaza, ali postoje javne igre | Točno 4 biografske rečenice, bez umjetnog punjenja. |
| Profil je otvoren pri završetku igre | Sažetak koristi spremljeni profilni snapshot; ponovno učitavanje profila dohvaća nove rezultate. Ne čitati polugotove socket podatke. |
| Posjetitelj je u drugoj vremenskoj zoni | Staž je izračunat po kalendarskom datumu Europe/Zagreb, ne zoni preglednika. |
| Baza/server nedostupan | Jasna postojeća profilna greška; ne prikazati novog igrača s nulama. |

## 10. Posebne zamke zatečene u kodu

### 10.1. DNK API ugovor je nepotpun

U `aplikacije/posluzitelj/src/profil/rute.ts`, `izracunajDnkProfil` vraća `osi`, `odigrano`, `preostaloDoOtkljucavanja`, `metrike` i `otkljucan`, ali ne vraća `mod` koji zajednički `DnkProfil` i `KaladontDnkGraf.svelte` očekuju.

Minimalni povezani popravak:

- Dodati `mod`; postojeći `otkljucan` uskladiti s `jeDnkOtkljucan(odigrano)` iz zajedničkog helpera.
- Povratni tip definirati eksplicitno kao `DnkProfil & { metrike: ... }` ili postojeći zajednički prošireni DTO. Ne prikrivati `as DnkProfil` castom.
- U API testu provjeriti oba profila i oba načina za 9 i 10 igara. Ovo je postojeći lokalni ugovorovni popravak, ne nova CV metrika.
- CV dodatno poštuje svoj prag valjanih prihvaćenih poteza. Popravak API ugovora ne mijenja pravila DNK-a.

### 10.2. Izvor ranga i oznake DNK-a nisu zamjenjivi

`rangovi.ts` koristi rastuće minimalne pragove; pojedine label-tablice u `dnk.ts` koriste min/max intervale. Ne kopirati raspon rangova iz DNK-a. Za CV rang uvijek `izracunajRang`, za izbor osobina kanonska numerička DNK vrijednost i ručno provjereni fragmenti. U ovom featureu ne prepravljati sve DNK pragove i ne uvoditi treći sustav bodovanja. Ako se pri testu utvrdi nesklad grafičke oznake i vrijednosti, prijaviti zaseban nalaz; ne „popraviti” ga lažnom biografijom.

### 10.3. Javni profil ne otvara gostujuće podatke

Postojeći javni profil filtrira goste; tu granicu zadržati. Inline CV za registriranog prikazuje se na njegovu javnom profilu kao i na vlastitom. Ne dodavati javnu rutu ili endpoint po proizvoljnom ID-u, ne uklanjati filtre iz povijesti/riječi/postavki i ne uklanjati provjeru obrisanog računa. Identitet posjetitelja nije identitet prikazanog igrača.

### 10.4. Nula nije nedostajući podatak

`dnkStatistika?.polje ?? 0` u starom profilu može dati vizualni fallback, ali CV adapter mora zasebno znati postoji li DNK redak. U suprotnom bi izostanak starih mjerenja postao lažan stil pacifista ili munjevitog igrača. Nema povijesne rekonstrukcije cijelog DNK-a u ovom zadatku.

## 11. Primjeri gotovog teksta

Sljedeći su primjeri testni slučajevi s izmišljenim igračima i unaprijed definiranim statističkim ulazima, ne stvarni podaci korisnika. Varijantu šale odabrati ID-em s parnim zadnjim hex znakom. Primjeri se moraju slagati s predlošcima, ne dodavati ručne rečenice samo za demo.

### A. Registriran, bez javnih igara i bez dokaza

> Još nemamo dovoljno informacija za opis ovog igrača.

Prikazuje se kao biografska poruka umjesto 4–5 rečenica. Neovisno o tome, profil zadržava rang/razinu i prazna stanja forme. Staž se računa od registracije ako je datum poznat, neovisno o starosti računa.

### B. Točno 2 dvoboja, 0 igara učetvero, bez pobjeda/dokaza

> Igrač Joka dosad je završio 2 dvoboja, a javnu igru učetvero još nije odigrao. Trenutačno ima početnu oznaku „Piskaralo”, a do prvog ranga nedostaje mu još 8 javnih igara u dvobojima. Njegov stil još se oblikuje, a DNK profil otključava nakon deset javnih igara u istom načinu. Otvoren je za nove izazove, osobito one sa zadnja dva slova.

4 rečenice. Ne tvrditi da dvoboje voli više i ne izračunati stil iz nula igara učetvero.

### C. Točno 2 igre učetvero, 0 dvoboja, bez pobjeda/dokaza

> Igrač Joka dosad je završio 2 igre učetvero, a javni dvoboj još nije odigrao. Trenutačno ima početnu oznaku „Piskaralo”, a do prvog ranga nedostaje mu još 8 javnih igara u igri učetvero. Njegov stil još se oblikuje, a DNK profil otključava nakon deset javnih igara u istom načinu. Otvoren je za nove izazove, osobito one sa zadnja dva slova.

4 rečenice. Razlika u tekstu proizlazi iz podataka, ne iz aktivnog taba profila.

### D. Iskusniji igrač: 84 dvoboja, 26 igara učetvero

Ulaz za test: 1v1 44 boda / 84 igre daje „Lektor”; 4p 58 / 26 daje „Jezičar”. Valjan 1v1 DNK ima duge riječi 85 i brzinu 70, ostalo < 60. Dostignuće `kaladont` razine 3; ostala dostignuća najviše razine 3 pa je `kaladont` prvi prema tie-break pravilu.

> Igrač Joka više javnih igara odigrao je u dvobojima: završio je 84 dvoboja i 26 igara učetvero. Njegov je najviši trenutačni rang „Lektor”, ostvaren u dvobojima. U dvobojima njegov se DNK ističe uporabom dugih riječi i brzim prihvaćenim potezima. Među njegovim dostignućima ističe se „Kaladont!”, s osvojenih 3 od 5 zvjezdica. U njegovoj igračkoj priči duge riječi zauzimaju posebno mjesto.

5 rečenica. Osi su ulaz čistog generator testa. Za integracijski fixture može se koristiti 100 prihvaćenih poteza ukupnog trajanja 730000 ms, 53 jako duge riječi i 1 duga riječ: postojeće formule daju brzinu 70 i duge riječi 85 nakon zaokruživanja. Najduži niz 4, rijetke grupe 0 i 10 eliminacija drže preostale opisne osi ispod 60. `kaladontIzvedbe=10` daje razinu 3, `dugeRijeci=54` daje razinu 3, `javnePobjede=44` daje razinu 3; katalog tada stabilno bira „Kaladont!”. Ostale globalne brojače postaviti konzistentno s fixtureom i ne dopustiti dostignuće razine 4/5 koje bi legitimno promijenilo E1.

### E. Registriran bez javnih igara, s trajnim dostignućem

Ulaz: registriran, `n2=0`, `n4=0`, `dugometras` razina 2, drugo niže.

> Igrač Tikvan još nije završio nijednu javnu igru. Trenutačno ima početnu oznaku „Piskaralo”, a prvi rang tek treba steći. Za opis njegova stila u javnim igrama tek treba prikupiti podatke. Među njegovim dostignućima ističe se „Dugometraš”, s osvojenih 2 od 5 zvjezdica. Početak njegove javne statistike još je prazan list.

5 rečenica. Dostignuće može doći iz privatnih igara i ne smije se predstavljati kao javno ostvareno. Ako nema ni trajnog dostignuća, koristi se posebna poruka o nedovoljno informacija umjesto biografskog odlomka.

### F. Dovoljno igara, ali nema starih DNK mjerenja

Ulaz: 10 dvoboja, 0 bodova/pobjeda, 0 igara učetvero, nema DNK retka ni drugog dokaza.

> Igrač Joka dosad je završio 10 dvoboja, a javnu igru učetvero još nije odigrao. Njegov je najviši trenutačni rang „Prvopisac”, ostvaren u dvobojima. Za pouzdan opis njegova stila još nedostaje zabilježenih podataka o potezima. Otvoren je za nove izazove, osobito one sa zadnja dva slova.

4 rečenice. Ovo nije isto što i CV bez igara.

## 12. Datoteke i red implementacije

| Red | Datoteka/područje | Posao |
|---|---|---|
| 1 | `aplikacije/posluzitelj/src/baza/shema.ts` i nova generirana migracija | Nullable `registriranAt`, bez lažnog povijesnog backfilla. |
| 2 | `aplikacije/posluzitelj/src/racuni/rute.ts` | Jednokratni datum u izravnoj i gost-registraciji; ista DB vremenska oznaka kao `stvoren` pri izravnom INSERT-u; očuvanje ID-a/podataka. |
| 3 | Novi `paketi/zajednicko/src/cv.ts`, `cv-jezik.ts`, `cv-datumi.ts` | Shared DTO, čisti tekstualni generator, hrvatski formatteri i registracijski staž. |
| 4 | `paketi/zajednicko/src/index.ts` | Izvoz novih tipova/funkcija, bez ručnog uređivanja generiranog dist-a. |
| 5 | `aplikacije/posluzitelj/src/profil/rute.ts` | Ugraditi CV i registracijski staž u postojeće privatne/javne profile; reuse forme i nizova; bez nove CV rute. |
| 6 | Nova `aplikacije/web/src/lib/komponente/KaladontCvSazetak.svelte` | Inline bio/staž/forma/zadnji rezultati; bez gumba ili modala. |
| 7 | `aplikacije/web/src/routes/profil/+page.svelte`, `profil/javni/[igracId]/+page.svelte` | Responsivni položaj, gostova privatna poruka, skrivanje u Postavkama, odvajanje greške povijesti od profila. |
| 8 | Shared/server/e2e testovi navedeni niže | Pokriti čistu logiku, registraciju/migraciju, privatnost profila i desktop/mobilni prikaz. |

Postojeći `Avatar.svelte`, `rangovi.ts`, `dnk.ts`, `izracun-dnk.ts`, `dostignuca.ts`, `grafemi.ts` i `iskustvo.ts` prvenstveno su izvori za reuse; ne prepisivati njihove formule. `motor-partije.ts` i `upis-partije.ts` ne trebaju novi CV kod ni nove socket događaje.

Normalizirani ulaz generatora mora eksplicitno sadržavati registriranog igrača, po oba načina broj javnih igara/pobjeda/bodova/eliminacija, rezultate kanonskog ranga, nullable `registriranAt`, postoji-li-DNK-redak, broj prihvaćenih poteza i vremenski zbroj, kanonske osi, opcionalne rekorde riječi te poznata dostignuća s razinama. Gost ne ulazi u generator. Izostanak pojedinog retka predstaviti nullom/flagom, ne implicitnim objektom punim nula. Ne definirati ulaz kao `any`, `Record<string, any>` ili široki database row.

Pseudokod glavnog toka:

```ts
const profil = await dohvatiProfil(igrac); // postojeći profilni snapshot i forma
const ulaz = normalizirajCvPodatke(profil); // samo registrirani/admin; odbaci nevaljane temeljne podatke
const danas = zagrebackiDatum(now);
const kvalifikacija = odaberiKvalifikaciju(ulaz);
const stil = odaberiStil(ulaz);
const dokaz = odaberiDokaz(ulaz, stil);
const biografija = ulaz.bezJavnihIgara && !dokaz
  ? { tip: 'nedovoljno_informacija', tekst: 'Još nemamo dovoljno informacija za opis ovog igrača.' }
  : { tip: 'opis', recenice: [s1(ulaz), s2(ulaz, kvalifikacija), s3(ulaz, stil), ...(dokaz ? [e(ulaz, dokaz)] : []), h(ulaz, stil)] };
return serijalizirajProfilniCv({ ulaz, kvalifikacija, biografija, danas });
```

`serijalizirajProfilniCv` provodi 4/5 rečenica za opis, duljinu i eksplicitni whitelist; no-info poruka je zasebna unija tipa, ne umjetna rečenica CV-a. Poziv H koristi primarnu osobinu koja je stvarno ostala u S3 nakon eventualnog skraćivanja. Rezultati forme već dolaze iz postojećeg profilnog helpera; u CV sažetak se ne rekonstruiraju čitanjem povijesti.

## 13. Testovi prihvata

Ovo su obvezni testovi nove funkcionalnosti koje agent treba napisati i pokrenuti; tijekom ovog pregleda nije implementiran CV pa oni još nisu izvršeni.

### 13.1. Shared unit testovi

Predložene datoteke `paketi/zajednicko/test/cv.test.ts`, `cv-jezik.test.ts`, `cv-datumi.test.ts`.

1. Table-driven sve grane S1: `(0,0)`, `(1,0)`, `(2,0)`, `(0,1)`, `(0,2)`, `(1,1)`, `(6,4)`, `(4,6)`, `(9,9)`, `(59,41)`, `(60,40)`, `(41,59)`, `(40,60)`, `(50,50)`.
2. Hrvatski oblici za `0,1,2,3,4,5,10,11,12,13,14,15,21,22,24,25,101,111,112,114,121,122,1001` za sve padežne helper-e.
3. Nominativ i glagol u kalibraciji: 1 nedostaje, 2–4 nedostaju, 5–9 nedostaje.
4. Rang pri 9/10 u oba načina; 9+9 nije kalibriran; dva različita ranga; isti rang; viši rang u manje igranom načinu; null iz `vratiVeciRang` postaje početna oznaka.
5. DNK zaključan, nedostajući redak, validan 10+ igara ali 0/9/10 prihvaćenih poteza; neispravna brzina; sve nule; jedna/dvije/sve jake osi; prag 59/60 i razlika 20/21.
6. Taktika/duge/rijetke/fokus/brzina imaju provjerene instrumentalne fragmente; pokriti svih 10 parova osi.
7. Stil iz jednog načina ne uključuje osobinu drugoga; fallback na drugi valjan način ga izričito imenuje.
8. Dokazi E1–E4 s točnim prioritetom; sort E1 po udjelu, stabilni tie-break, ignoriranje nepoznatog ID-a i `ka_zna`; ne duplirati fokus.
9. Riječ s hrvatskim digrafima i postojećim iznimkama; rekord veći u 1v1; jedan izostao redak; tekst preko 64 grafema; neispravna duljina; nMode=0.
10. Niz prihvaćenih riječi se nigdje ne naziva nizom pobjeda. Forma, trend i pobjednički niz prikazuju se zasebno od biografskog teksta i reuse-aju postojeće profilne podatke.
11. Gost početnik/veteran na vlastitom profilu dobiva samo poruku, bez javnog endpointa ili gostujućeg teksta; registriran/admin javno jednaki; registriran N0 bez trajnog dostignuća dobiva no-info poruku; registriran N0 s privatnim dostignućem može dobiti dokaz bez tvrdnje da je javan.
12. Snapshotovi primjera A–F, uz no-info tip za primjer A i registrirani profil s privatnim dostignućem za E.
13. Determinističnost: 100 poziva s istim ulazom daje iste rečenice; isti ulaz drugi dan mijenja samo datum/staž; promjena redoslijeda DB redaka ne mijenja tekst.
14. Test duljine svih template kombinacija; normalni izlaz <= 120 riječi i bez `undefined`, `NaN`, dvostrukih razmaka, napola odrezane riječi ili prazne rečenice.
15. Pogrešni temeljni brojevi nisu fallback 0; jedan loš opcionalni rekord ne ruši ostatak CV-a.
16. Datumi: isti dan, prijelaz ponoći, 31. 1. → veljača, prestupna godina, 29. 2. → 28. 2. iduće godine, više godina, nedostaje datum, datum u budućnosti, timestamps `stvoren`/`registriranAt` iz istog insert-a, povijesni null.
17. DST početak: `2026-03-28T23:30:00Z` → `2026-03-29T22:30:00Z` je 1 zagrebački kalendarski dan iako je 23 sata.
18. DST kraj: `2026-10-24T22:30:00Z` → `2026-10-25T23:30:00Z` je 1 zagrebački kalendarski dan iako je 25 sati.
19. Brojač rečenica radi po strukturiranom nizu, ne po točkama, uskličniku dostignuća ili datumskom formatu.

### 13.2. Server integracijski testovi

Novi `aplikacije/posluzitelj/test/cv.test.ts`; proširiti postojeće `racuni.test.ts` i `profil.test.ts` gdje pripada.

- Registracija izravna i gost→registriran spremaju `registriranAt`; gost ostaje null; prijava/potvrda emaila ne mijenjaju datum.
- Gost→registriran čuva ID, brojače, avatar prema postojećim pravilima i dostignuća. Provjeriti ponovljeni/konkurentni pokušaj ne prepisuje datum.
- Migracija na postojećoj testnoj bazi zadržava račune/agregate; stari `registriranAt` ostaje null, s ispravnim fallbackom. Ne resetirati bazu da bi test prošao.
- Javni `/profil/javni/:igracId` prikazuje CV registriranog/admin igrača; gost nema javni profil/CV; obrisani/nepostojeći ostaju skriveni.
- Javni profilni JSON i dalje nema email, lozinku, tokene, sesije, last-active ili admin status; CV dodatak ih ne smije izložiti.
- Privatni `/profil` vraća samo autentificiranog igrača, uključujući gostovu poruku, ne tuđe CV podatke.
- Upis jedne javne igre mijenja samo odgovarajući mod CV-a; privatni upis ne povećava javni broj igara/DNK/rang, ali dopušteno dostignuće može se pojaviti.
- Postojeći DNK endpointovi vraćaju `mod` i boolean `otkljucan`, uključujući 9/10 granicu.
- Gost i dalje nema pristup tuđim privatnim profilnim podacima ni promjenama računa. Postojeći guest restrictions izvan CV-a ostaju.
- Baza nedostupna → kontrolirana greška, nikad 200 s izmišljenim nulama. Bez masovnog čitanja povijesti/poteza.
- Nakon brisanja novi dohvat 404. Bez trajnog spremljenog CV teksta koji ostaje nakon računa.

### 13.3. Playwright

Novi `e2e/cv-profil.spec.ts` prema postojećim fixtureima:

- Registrirani vlasnik i javni profil pokazuju isti bio/staž; gostov vlastiti profil pokazuje samo dogovorenu poruku, gost ne dobiva javni profil.
- Desktop: blok je desno od avatara i cijelog zaglavlja; mobitel 320/375 px: blok je ispod zaglavlja, nema horizontalnog overflowa, čitljiv je pri 200% zoomu.
- Postavke skrivaju inline blok; povratak na glavni profil ga prikazuje.
- Javni profil ostaje dostupan bez autentikacije samo za registriranog/admin igrača; javni response nema privatna polja.
- Staž potječe isključivo od registracije; stari račun s null `registriranAt` prikazuje datum nezabilježen i ne koristi `stvoren`.
- Forma i zadnji rezultati oba načina prikazuju se neovisno; prazan način ne skriva drugi. Rezultati i privatne igre podudaraju se s postojećim javnim profilnim podacima.
- Greška učitavanja povijesti ne skriva uspješno dohvaćen profil/sažetak.
- Tekst je escaped; nema izvršavanja skripte iz nadimka ili rekorda riječi.

### 13.4. Naredbe i izvještaj

Koristiti postojeće package skripte. Primjer ciljane provjere (prilagoditi nazivima stvarno dodanih datoteka):

```bash
pnpm --filter zajednicko build
pnpm --filter zajednicko exec vitest run test/cv.test.ts test/cv-jezik.test.ts test/cv-datumi.test.ts
pnpm --filter posluzitelj exec vitest run test/cv.test.ts test/racuni.test.ts test/profil.test.ts
pnpm --filter web check
pnpm build
pnpm exec playwright test e2e/cv-profil.spec.ts
```

Integracijske testove pokretati samo uz projektnu namjensku testnu bazu i fixturee. Testni cleanup ograničiti na testne ID-eve. Playwright pokrenuti s postojećom konfiguracijom i potrebnim servisima. Ako okruženje nedostaje, jasno prijaviti što nije pokrenuto; nemoj zelenim unit testovima proglasiti provjereni deploy.

**Provjera provedena pri izradi ovog dokumenta:** shared paket prošao je svih 58 postojećih testova u 11 datoteka. Nije proveden CV test (funkcionalnost još ne postoji), test s pravom Postgres bazom, browser test novog CV-a niti deploy. Repozitorij nije mijenjan ovim nalogom.

## 14. Prioritet i granice

Prioriteti su unutar ovog featurea, ne zamjenjuju raniji redoslijed kritičnih popravaka igre.

| Paket | Prioritet | Kompleksnost | Rizik | Dugoročna vrijednost |
|---|---|---|---|---|
| Istiniti datumi + migracija registracije | P1, obvezno | Mala–srednja | Srednji jer dira registraciju | Visoka |
| Kanonski CV DTO + podaci oba načina + DNK ugovor | P1, obvezno | Srednja | Srednji | Visoka |
| Hrvatski predlošci, izbor činjenica, rubni slučajevi | P1, obvezno | Srednja | Nizak–srednji | Visoka |
| Inline profilni sažetak, javna/privatna granica | P1, obvezno | Srednja | Srednji zbog layouta i privatnosti | Visoka |
| Dodatne šale i redizajn cijelog profila | P2, poslije | Mala–srednja | Nizak | Srednja |
| PDF/slika za dijeljenje, novi izračun forme/niza ili novi pravilnik pobjedničkog niza | Izvan v1 | Ovisi o featureu | Povećava opseg | Procijeniti kasnije |

Predlošci su brzi, jeftini i lako testabilni; nedostatak je da će se neke rečenice ponavljati. To je svjestan MVP izbor. Nije potrebno uvoditi AI da bi svaki klik bio drukčiji. Ako kasnije dodajete varijante, dodajte ih u isti katalog uz testove i novu verziju predložaka.

Poseban datum registracije zahtijeva malu migraciju, ali je pošteniji od pogrešnog preimenovanja `stvoren`. Inline prikaz reuse-a postojeći javni i privatni profil te ne otvara novu javnu rutu niti gostujuće podatke.

## 15. Završni nalog agentu

1. Potvrdi stvarne izvore na aktualnom HEAD-u i napravi male odvojene izmjene: podaci/datum, generator, UI/testovi.
2. Implementiraj pravila iz ovog dokumenta; ne odlučuj nasumično o gramatici, primarnom načinu ili tome što znači niz.
3. U predlošcima koristi „igra” i „dvoboj”; interne postojeće nazive ostavi.
4. Ne proširuj zadatak na novu formulu forme/niza pobjeda, globalni DNK refaktor, nova pravila ranga ili AI generiranje; samo prikazati postojeće profilne vrijednosti.
5. Priloži konkretne primjere izlaza za no-info stanje, 2/0, 0/2, 9/9, oba kalibrirana načina, gosta (poruka bez bio-a), registriranog bez javnih igara s privatnim dostignućem i stari račun bez datuma registracije.
6. Priloži točne rezultate izvedenih testova, popis onih koji nisu izvedeni i kratko objašnjenje nove migracije.
7. Provjeri postojeće račune nakon migracije i osiguraj da javni CV ne otkriva privatna polja.
8. Prije predaje pokaži desktop i mobilni prikaz. Vlasnik treba pregledati ton šala; ne blokirati izradu na tom pitanju jer su ovdje zadane sigurne početne varijante.

**Pitati vlasnika samo ako se otkrije stvarna nova odluka:** npr. aktualna grana već ima drugačiji datum registracije ili profilni endpoint koristi drugi javni skup rezultata. Dogovoreno je: nema zasebne CV adrese/modalnog gumba; registrirani CV je na vlastitom i javnom profilu; gost vidi samo poruku privatno; staž računa samo registracijski datum; forma i zadnji rezultati reuse-aju postojeći profilni izračun. Za stare račune bez datuma prikazati nezabilježen podatak, ne izmišljati zamjenu.

## 16. Izvori u pregledanom commitu

Poveznice su vezane uz točno pregledanu verziju, ne promjenjivi main:

- [Shema baze](https://github.com/josipmestrovic/kaladont/blob/2c108c262759717df981b9b41392013294f39301/aplikacije/posluzitelj/src/baza/shema.ts)
- [Registracija i računi](https://github.com/josipmestrovic/kaladont/blob/2c108c262759717df981b9b41392013294f39301/aplikacije/posluzitelj/src/racuni/rute.ts)
- [Profilni API](https://github.com/josipmestrovic/kaladont/blob/2c108c262759717df981b9b41392013294f39301/aplikacije/posluzitelj/src/profil/rute.ts)
- [Upis igre i agregata](https://github.com/josipmestrovic/kaladont/blob/2c108c262759717df981b9b41392013294f39301/aplikacije/posluzitelj/src/igra/upis-partije.ts)
- [Izračun DNK-a na serveru](https://github.com/josipmestrovic/kaladont/blob/2c108c262759717df981b9b41392013294f39301/aplikacije/posluzitelj/src/igra/izracun-dnk.ts)
- [DNK osi i funkcije](https://github.com/josipmestrovic/kaladont/blob/2c108c262759717df981b9b41392013294f39301/paketi/zajednicko/src/dnk.ts)
- [Rangovi i kalibracija](https://github.com/josipmestrovic/kaladont/blob/2c108c262759717df981b9b41392013294f39301/paketi/zajednicko/src/rangovi.ts)
- [Definicije dostignuća](https://github.com/josipmestrovic/kaladont/blob/2c108c262759717df981b9b41392013294f39301/paketi/zajednicko/src/dostignuca.ts)
- [Vlastiti profil](https://github.com/josipmestrovic/kaladont/blob/2c108c262759717df981b9b41392013294f39301/aplikacije/web/src/routes/profil/+page.svelte)
- [Javni profil](https://github.com/josipmestrovic/kaladont/blob/2c108c262759717df981b9b41392013294f39301/aplikacije/web/src/routes/profil/javni/%5BigracId%5D/+page.svelte)
- [Layout i inicijalizacija identiteta](https://github.com/josipmestrovic/kaladont/blob/2c108c262759717df981b9b41392013294f39301/aplikacije/web/src/routes/+layout.svelte)
- [Vizualni tokeni](https://github.com/josipmestrovic/kaladont/blob/2c108c262759717df981b9b41392013294f39301/aplikacije/web/src/app.css)
