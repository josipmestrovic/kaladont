# Kaladont — PR04 v2: stranica Misije i cjelovito korisničko iskustvo

**Datum:** 4. studenoga 2026.  
**Predložena grana:** `feat/misije-frontend`  
**Produktni izvor:** `Kaladont_Misije_katalog_i_dizajn_v2.md`.  
**Tehnički ugovor:** `Kaladont_PR03_backend_misija_v2.md`, posebno §10.  
**Pregledana baza:** [646c00c3](https://github.com/josipmestrovic/kaladont/tree/646c00c3b3a00b4681156d2ef54bbe00b8f9f171), 4. 11. 2026. Stvarni PR03 API tek treba implementirati i provjeriti prije rada na ovom PR-u.

Ova verzija zamjenjuje stari PR04. Novi model nije „dvije kartice”: prikazuje se **do tri aktivne dnevne i tri tjedne**, odabrane iz kataloga 20 + 20. Dnevne se prenose bez isteka, tjedne se obnavljaju ponedjeljkom, a dopuštene su i pobjedničke te posebne trening-misije.

## 0. Uputa agentu

1. Pročitaj sva tri v2 dokumenta, aktualni `main`, stvarne tipove/rute PR03 i završni ekran nakon PR02/PR03. PR03 je preduvjet; ako još nije spojen, dogovori jasnu bazu grane umjesto nagađanja API-ja.
2. Prije kodiranja predstavi kratku skicu desktopa/mobitela, stanja prikaza, konkretan API primjer, dodirne točke s postojećim završnim ekranom i ciljani plan testova.
3. Potvrđene produktne odluke se ne otvaraju ponovno: do tri dnevne, tri tjedne, 200/2.000 XP, pobjednički ciljevi i trening već su zadani. Izgled, komponente i tekstove razumno prilagodi postojećem Kaladontu.
4. Ako stvarni backend nedostaje podatak potreban za točan UI, navedi konkretno polje i predloži mali kompatibilan dodatak. Ne računaj misije/XP u browseru kao zamjenu za nedostajući backend.
5. Implementiraj nakon uobičajenog dogovora o planu, provjeri relevantne testove i postojeći CI. PR opis sadrži stvarne screenshotove izvedenog UI-ja i točne rezultate provjera.

## 1. Opseg i odnos s PR03

PR03 već treba isporučiti backend, shared katalog/tipove i **minimalni završni sažetak** koji se prikazuje nakon javne igre ili treninga. Ovaj PR dodaje:

- `/misije` s dnevnom zalihom i tjednim paketom;
- poveznicu Misije u glavnoj navigaciji;
- jasne kartice, progres/podciljeve, raspored dotoka i zajedničke kvote zamjene;
- sigurnu **recycle** zamjenu (ne X/obriši), potvrdu i obradu konflikata;
- main-menu popupove za nove dnevne/tjedne (vidi §16);
- stanje gosta, učitavanja, greške, prazne dnevne zalihe i dovršenih tjednih;
- usklađen izgled i pristupačnost postojeće PR03 rezultatne komponente;
- osvježavanje nakon događaja, promjene datuma i identiteta;
- ciljane desktop/mobilne testove.

Ne implementirati drugi mission engine, drugi katalog, dodatni XP, novi „Majstor misija”, rezervne ideje R01–R30 ili PR05 login-dostignuće. Nema ručnog „Preuzmi nagradu”, jer server XP dodjeljuje pri dovršetku.

## 2. Pravila koja UI mora vjerno predstavljati

| Tema | Prikaz i ponašanje |
|---|---|
| Broj kartica | Dnevne: 0–3 aktivne + prazna mjesta. Tjedne: 3 aktivne/dovršene. Nije javni katalog svih 40 zadataka. |
| Prvi posjet | Jedna dnevna i tri tjedne, ako se sustav tada prvi put inicijalizira. Dnevna dva prazna mjesta su očekivana. |
| Dnevni dotok | Jedna nova u sljedeću ponoć kad ima mjesta; ne tri odjednom. |
| Dnevni rok | Nema isteka. Ponoć i ponedjeljak ne brišu aktivnu dnevnu ni njezin progres. |
| Dnevna dovršena | Oslobađa aktivno mjesto; može se vidjeti u „Danas dovršeno” i rezultatu. Nema trenutne zamjenske dodjele. |
| Tjedna dovršena | Ostaje jedna od tri do ponedjeljka. Nema `×` i nema četvrte misije. |
| Tjedni rok | Ponedjeljak 00:00 po `Europe/Zagreb`; stare nedovršene istječu. |
| Zamjene | Dvije neovisne skupne kvote: jedna dnevna zamjena i jedna tjedna zamjena svaki lokalni dan. |
| Zamjena kartice | POST prema `dodjelaId`, ne samo vrsti ili indeksu na ekranu. Druga dva mjesta ostaju. |
| XP | Nominalno 200/2.000 iz snapshot podataka; na završetku stvarno dodijeljeni iznos iz servera, moguće i 0. |
| Pobjede | Opis jasno kaže „Pobijedi”; ne koristiti stari podnaslov da pobjeda nikad nije važna. |
| Trening | D10/W10 označene „Zagrijavanje”. Opće javne misije ne napreduju u treningu. |
| Progres | Potvrđuje se nakon konačnog spremanja igre. Rani poraz i privremeni XP nisu potvrda misije. |
| Više misija | Jedna igra može pomoći više zadataka i završiti više njih; bez odabira „praćene”. |
| Dostignuća | Postojeća ostaju zaseban sustav; nema nove nagrade „Majstor misija”. |

## 3. Informacijska hijerarhija stranice

**Naslov:** Misije  
**Podnaslov:** Igraj, isprobaj različite izazove i skupljaj iskustvo.

Ne kopirati novu vizualnu temu izvan Kaladonta. Koristiti postojeće boje, tipografiju, kartice i gumbe. Pregledane komponente već koriste CSS varijable; ne hardkodirati zaseban dizajnerski sustav.

| Redoslijed | Sadržaj | Zašto |
|---:|---|---|
| 1 | Naslov i jedna rečenica | Brzo objašnjava svrhu. |
| 2 | Dnevne misije — `N / 3 sačuvane` | Najbliži, manji ciljevi prvo. |
| 3 | Dnevni dotok + kvota zamjene | „Nova misija u ponoć” i „Zamjene danas: 1”. |
| 4 | Dnevna mjesta 1–3 | Aktivne kartice i jasna prazna mjesta. |
| 5 | Mali sažetak „Danas dovršeno”, ako postoji | Dokaz isplate bez zadržavanja dovršene dnevne u aktivnom slotu. |
| 6 | Tjedne misije — `N / 3 završene` | Zaseban paket većih ciljeva. |
| 7 | Zajednički rok + kvota zamjene | „Nove tjedne: ponedjeljak, 00:00” i preostala zamjena. |
| 8 | Tri tjedne kartice | Aktivne i dovršene ostaju na istim mjestima. |
| 9 | Kratko objašnjenje i link pravila po potrebi | Napredak se sprema nakon igre; trening vrijedi samo gdje je označen. |

### Desktop

Dvije odvojene sekcije jedna ispod druge. Kad širina dopušta, tri kartice po redu. Na srednjoj širini dvije ili jedna, bez lomljenja teksta. Ne slagati dnevne i tjedne u tri miješana stupca jer imaju različita pravila trajanja.

### Mobitel

Jedna kartica po retku i normalan vertikalni scroll. Dnevne pa tjedne, uz jasno vidljive naslove. Ne treba horizontalni carousel ni obvezno prebacivanje tabova da bi korisnik našao tjedne. Na 320 px tekst, progress i gumb ostaju čitljivi; ne smanjivati font i cilj dodira samo da sve stane na jedan zaslon.

### Vizualni prioriteti

Naziv i uvjet imaju prednost pred ilustracijom. XP je jasno vidljiv, ali ne smije prekriti točan mod ili uvjet pobjede. Jedna postojeća ikona po obitelji je dovoljna; nema potrebe stvarati 40 novih asseta.

## 4. Kartica i tekstovi

Preporučeni sadržaj:

1. Oznaka konteksta/moda i gumb zamjene u zaglavlju.
2. Naziv misije.
3. Jedna precizna rečenica cilja.
4. Tekstualni napredak i traka, po potrebi podciljevi.
5. Nagrada i stanje.

Naziv, opis, cilj, nagrada i kontekst dolaze iz shared/server snapshot-a. Renderirati kao tekst, ne `{@html}`. Reactivni ključ kartice je `dodjelaId`; položaj rasporeda dolazi iz `slot`. Ne koristiti indeks niza kao identitet za zamjenu ili animaciju.

### Primjeri prikaza

| Primjer | Opis / progres |
|---|---|
| D08 Pobjednik Četveroboja | `Pobijedi u 1 javnom Četveroboju.` → `Pobjede: 0 / 1` → `200 XP` |
| D09 Tri dvobojske pobjede | `Pobijedi u 3 javna Dvoboja.` → `Pobjede: 2 / 3` |
| D10 Pobjeda za zagrijavanje | Oznaka `Zagrijavanje` → `Pobijedi u 1 treningu.` → `0 / 1` |
| W09 Dvobojski pobjednik | `Pobijedi u 20 javnih Dvoboja.` → `Pobjede: 12 / 20` → `2.000 XP` |
| W10 Trening tjedan | `Pobijedi u 3 treninga.` → `Pobjede: 1 / 3` |
| D03 Uhvati niz | `Najdulji niz u jednoj partiji: 2 / 3` |
| W03 Tri dobra niza | `Partije s nizom od barem 5: 1 / 3` |
| W07 Osam dobrih partija | `Partije s barem 5 prihvaćenih riječi: 4 / 8` |
| W06 Tri dana igre | `Različiti dani s javnom partijom: 2 / 3` |
| D18 Pet početaka | `Različiti počeci riječi: 3 / 5` |
| D17 Dvostruki pogodak | `Odigraj riječ koja je i duga i rijetka.` → `Takve riječi: 0 / 1` |
| W20 Svestrani igrač | `Dvoboji: 4 / 5` i `Četveroboji: 2 / 5`; ukupno `6 / 10`. |

Opis dugih riječi može u pomoći objasniti da se lj/nj/dž broje kao jedno slovo prema pravilima igre. Oznake rijetkosti trebaju se podudarati s postojećom igrom; korisnik ne mora znati internu frekvenciju rječnika.

**Ne pisati:** „Još samo jedna riječ” za D03 jer sljedeća partija kreće s novim tekućim nizom. Bolje je prikazati najbolji ostvareni niz i traženi cilj. Isto tako `6 / 10` za W20 nije dovoljno bez podciljeva, jer deset Dvoboja ne zamjenjuje Četveroboje.

### Aktivna / dovršena

- Aktivna: progres i, ako server dopušta, `×`.
- Tjedna dovršena: tekst „Završeno”, check ikona, puna traka, bez `×`. Zadržava svoje mjesto i ne skače na početak paketa.
- Dnevna dovršena: uklanja se iz aktivne zalihe tek prema potvrđenom server stanju; sažetak je u „Danas dovršeno”. Ne animirati novu nasumičnu misiju na tom mjestu.
- Nominalni iznos smije ostati oznaka cilja, ali tvrdnja „Dodijeljeno” mora koristiti stvarni iznos nagrade.
- U „Danas dovršeno” i na dovršenim tjednim karticama stvarni iznos dolazi iz `nagrada.xpStvarnoDodijeljeno`, ne iz nominalnog `xpNagrada`.

## 5. Prazna dnevna mjesta, puna zaliha i rokovi

| Stanje | Preporučeni tekst |
|---|---|
| Dnevne 0/3 | `Sve spremljene dnevne misije su završene. Nova stiže u ponoć.` |
| Dnevne 1/3 ili 2/3 | `Svake ponoći dobivaš jednu novu misiju dok ima mjesta.` |
| Dnevne 3/3 | `Sačuvane su tri misije. Dovrši jednu kako bi u idućoj ponoći bilo mjesta za novu.` |
| Dnevna kartica | `Bez isteka` ili `Ostaje dok je ne završiš.` |
| Tjedne sve završene | `Tjedne misije su završene. Nove stižu u ponedjeljak u 00:00.` |
| Kvota potrošena | `Današnja zamjena je iskorištena. Nova je dostupna u ponoć.` |
| Spremanje rezultata | `Napredak se još sprema.` — bez potvrde XP-a prije commita. |

Samo jedno prazno mjesto treba isticati sljedeći dotok; ostala mogu diskretno pokazati raspoloživi prostor. Ne prikazivati tri ista countdowna koja sugeriraju tri nove misije iste ponoći. Točan datum/vrijeme uvijek dolazi iz servera; riječ „ponoć” u konačnom tekstu odnositi na sljedeću zagrebačku ponoć, ne „danas u 00:00” koje je već prošlo.

Tjedni rok može stajati u naslovu skupine. Ne treba sekundno odbrojavanje niti crveni alarm na svakoj kartici. Pokazati lokalni datum i vrijeme, po potrebi „preostalo 2 dana”. Dnevne ne prikazivati kao izgubljene ako korisnik danas ne igra.

## 6. Zamjena: mali `×`, jasno značenje

Gumb ima dovoljno veliko dodirno područje, približno 44 × 44 CSS px, vidljiv fokus i pristupačno ime poput `Zamijeni misiju: Tri dvobojske pobjede`. Sam simbol `×` nije dovoljno objašnjenje. U skupini jasno piše da je dostupna **jedna zamjena dnevno za sve dnevne**, odnosno jedna za sve tjedne.

### Tok

1. Klik na dopušteni `×` otvara postojeći mali dijalog ili inline potvrdu. Tekst: `Zamijeniti ovu misiju? Njezin napredak bit će izgubljen. Današnja zamjena za ovu skupinu bit će iskorištena.`
2. Akcije su `Zamijeni` i `Odustani`. Odustajanje šalje nula zahtjeva.
3. Nakon potvrde generirati idempotency key i poslati jedan POST prema **`dodjelaId`** preko stvarnog PR03 API-ja.
4. Dok traje, onemogućiti zamjene cijele **te vrste**, jer dijele kvotu. Druga vrsta može ostati dostupna.
5. Nakon uspjeha primijeniti cijelo serversko stanje, zamijeniti samo odgovarajući slot i prikazati `Misija zamijenjena`.
6. Preostali `×` gumbi u istoj skupini postaju nedostupni s jasnim razlogom ako je kvota potrošena. Ne ostaviti druga dva gumba kao da imaju zasebnu kvotu.
7. Vratiti fokus na novi sadržaj istog mjesta ili na status skupine; nema gubitka fokusa zbog zamjene DOM-a.

### Greške i nepoznat ishod

| Kod / događaj | Ponašanje UI-ja |
|---|---|
| `MISIJA_DOVRSENA` | Dohvati stanje; „Ova misija već je završena.” |
| `MISIJA_NIJE_AKTIVNA` / 404 | Dohvati stanje; stari ID više ne predstavljati kao aktivnu karticu. |
| `ZAMJENA_ISKORISTENA` | „Današnja zamjena je iskorištena.” Osvježi skupnu kvotu i kartice. |
| `NEMA_ALTERNATIVE` | Zadrži staru karticu; „Trenutačno nema druge dostupne misije.” Kvotu uzeti iz servera, ne smanjiti lokalno. |
| `OBRACUN_U_TIJEKU` | „Završetak igre još se sprema. Pokušaj nakon spremanja.” Bez automatskog ponavljanja mutacije u petlji. |
| 401 | Očisti osobne podatke; ponudi prijavu. |
| 403 gost | Objašnjenje da su misije za prijavljene/registrirane račune. |
| 429 | Jasna kratka poruka i poštovanje serverova retry vremena. |
| 503/network | Podaci ne postaju lažna prazna zaliha; prikazati grešku i ponovni dohvat. |
| POST timeout | Ishod je nepoznat. Jedan GET za usklađenje; ako se POST ponavlja, mora koristiti **isti** ključ i isti ID. Nikad automatski novi ključ. |
| `IDEMPOTENCY_KONFLIKT` | Ne ponavljati s nasumično promijenjenim sadržajem; osvježiti stanje i prijaviti kontroliranu grešku. |

Backend je jamac kvote; disabled gumb je samo pomoć. Brzi klikovi, Enter i drugi tab moraju završiti točnim stanjem.

Pregledani `$lib/api.ts` baca opći `Error` i gubi status/kod. Napraviti malu kompatibilnu nadogradnju tipiziranom greškom ili lokalni adapter koji ih zadržava. Ne mijenjati autentikaciju ili sve API pozive bez potrebe.

## 7. Učitavanje, identitet i vrijeme

### Izvor istine

`GET /api/misije` vraća `StanjeMisijaDto` s listama, podciljevima, serverovim vremenom i verzijom stanja. Klijent ne izvodi ciljeve iz rječnika, ne bira zamjensku misiju i ne pretvara primljene poteze u trajni napredak.

Učitavanje pri ulasku, nakon uspješne zamjene, nakon završene relevantne igre, povratka u vidljivi tab i na najbližoj kalendarskoj granici. Dovoljan je jedan koordinirani GET; bez polling petlje svakih nekoliko sekundi. Ako stranica nije otvorena, ne održavati beskonačni background fetch.

### SSR i autentikacija

- Uklopiti se u postojeći `+layout.svelte` i bootstrap identiteta. Pri direktnom dolasku pričekati raspoloživ klijentski identitet prije auth zahtjeva.
- Ne čitati `window`/`localStorage` tijekom SSR-a. Ne renderirati privatne misije iz zajedničkog server cachea.
- Gost vidi neutralno objašnjenje i gumbe Prijava / Registracija, bez izmišljenih dodjela 0/20.
- Na `kaladont:identitet-promijenjen` očistiti misijske podatke, povećati request generaciju i učitati stanje nove sesije.
- Pozni GET ili POST starog korisnika nikad ne prikazati novom. Sam `AbortController` nije dovoljno jamstvo; prije primjene odgovora provjeriti identitet/generaciju.

### Zastarjeli odgovori i više tabova

Koristiti monotono `stanjeVerzija` iz PR03 te lokalnu generaciju zahtjeva. GET započet prije uspješne zamjene ne smije poslije prebrisati novu karticu. Manju verziju ne prihvaćati kao novije stanje. Jednaka verzija smije ažurirati prikaz serverova sata, bez povratka starijih dodjela.

Na povratak fokusa/vidljivosti ponovno dohvatiti stanje; oba događaja coalescirati u jedan zahtjev. BroadcastChannel nije nužan; dopušten je samo ako u projektu već postoji odgovarajući obrazac. Ne spremati autoritativni progres/XP u `localStorage`.

### Kalendarski prikaz

- `serverVrijemeIso`, `sljedeciDotokU`, `obnovaU`, `pocetakIso` i `krajIso` su apsolutni instanti iz servera.
- Formatirati s `Intl.DateTimeFormat('hr-HR', { timeZone: 'Europe/Zagreb', ... })`; zonu uređaja ne koristiti za poslovni reset.
- Za proteklo vrijeme nakon dohvata može se koristiti monotoni sat preglednika uz serverov početni instant. Na povratak fokusa osvježiti serverovo vrijeme.
- Sljedeći GET zakazati na najmanju relevantnu granicu: dnevni dotok, obnova kvote ili kraj tjedna. Ne stvarati nove kartice lokalno kad timer dođe na nulu.
- Ako je sustav u `obracunUTijeku`, jasno označiti da prikaz čeka potvrdu; ne pretvoriti stari tjedni paket u aktivni novi niti prikazati nagradu unaprijed.
- Otkazati listenere/timere/zahtjeve pri napuštanju stranice. Vidljivi countdown u minutama je dovoljan; bez `aria-live` objave svake sekunde.

## 8. Završni ekran: dovršetak u istoj igri

PR03 već isporučuje minimalni blok i konačni XP; ovaj PR ga koristi i vizualno usklađuje. Ako PR03 minimum nedostaje, prijaviti konkretan nedostatak, ne dvaput implementirati isti tok.

### Redoslijed

Pregledani PR02 ekran: plasman → ocjena → XP → pohvale → dostignuća → forma → DNK → kolekcija → završne radnje i prijave. Misijski blok ulazi **nakon XP-a, prije pohvala**. Ostale sekcije zadržavaju poredak. `PanelPrijavaRijeci` pa `PanelPrijavaIgraca` ostaju posljednji postojeći prijavni blokovi u javnom rezultatu. Trening ne dobiva nove prijavne mogućnosti samo zbog misija.

### Sažetak misija

Prikazati samo `promjeneMisija` dobivene iz servera, nikad svih šest kartica automatski. Dovršene prve, a potom preostali pomaci. Redoslijed unutar skupine neka bude stabilan.

| Stanje | Primjer teksta |
|---|---|
| Dovršena dnevna | `Misija završena!` / `Pobjednik Četveroboja` / `Dodijeljeno +200 XP` |
| Dovršena tjedna | `Misija završena!` / `Dvobojski pobjednik` / `Dodijeljeno +2.000 XP` |
| Samo pomak | `Dvobojski pobjednik — 12 → 13 / 20 pobjeda` |
| Više dovršenih | Jedan naslov `Završene misije` i zaseban red za svaku; ne više preklapajućih modala. |
| Trening | `Trening tjedan — 2 → 3 / 3` i misijski XP, iako partijski XP ostaje 0. |
| Cap | `Misija završena` / `Na najvećoj si razini; dodijeljeno 0 XP.` |
| Djelomična nagrada do capa | `Dodijeljeno +75 XP` / `Nagrada 200 XP; dosegnuta najveća razina.` |

Na strani rezultata `upravoDovrsena` opisuje što je postigla **ta igra**, a ne je li browser prvi put vidio poruku. Sažetak ostaje valjan i na ponovnom otvaranju; samo jednokratni vizualni efekti moraju biti deduplicirani.

### Ukupni XP i razina

Prikaz mora imati jedan jasan konačni rezultat, primjerice:

| Izvor | Primjer |
|---|---:|
| Iz igre | 85 XP |
| Iz misija | 2.200 XP |
| Ukupno dodijeljeno | 2.285 XP |

Brojke u ovoj tablici samo su ilustracija. UI uzima stvarne iznose i konačno stanje iz `ukupnoIskustvo`, a postojeće `mojeIskustvo` koristi za detalje partijskog obračuna. Ne dodaje 2.200 još jednom na već konačni iznos. Konačna razina/traka dolazi iz `ukupnoIskustvo.poslije`.

Pregledani `IskustvoPartije.svelte` pokazuje level iz `obracun.poslije`. Ako bi ostao takav uz novi XP, mogao bi prikazati zastarjelu razinu. Koristiti PR03 kompatibilnu prilagodbu: jedan konačni level header uz razdvojene izvore i stare partijske detalje. Ne treba drugi veliki XP panel koji pokazuje drukčiji level.

Trening-misijski prikaz ne smije ovisiti o `mojeIskustvo !== null` ili `!jeTrening`. Na treningu nema običnog XP-a, ali misijska nagrada može uzrokovati level-up i postojeću „Iskusnjaru”. Istodobni „Zagrijan” prikazuje se kroz postojeći achievement blok jednom.

### Ponovljena dostava

- Ključ efekta: identitet korisnika + kontekst + ID izvora, uz dodjele za pojedinačne efekte ako postoje.
- Ponovljeni `partija:kraj` može obnoviti stabilan prikaz bez novog zvuka/konfeta/XP inkrementa.
- Koristiti postojeće `rezultatiPrikazaniPartijaId` ponašanje i mali session-scope marker ako treba za remount; ne graditi novi trajni browser ledger.
- Ne animirati nagradu za povijesni GET ili nakon punog refresha kao da je nova. Efekt se veže uz prijelaz iz žive igre u potvrđeni rezultat.
- `spremanje_rezultata` nije uspjeh. Ako server nije spremio trening ili javnu igru, pokazati čekanje/grešku prema stvarnom stanju.

## 9. Navigacija i ulazi

Glavna navigacija je u `aplikacije/web/src/routes/+page.svelte`, unutar `glavna-navigacija`. Dodati poveznicu `/misije`, preporučeno iza Moj profil i prije Ljestvice. Ne dodati je samo u administrativni dio `Header.svelte`.

Poštovati postojeći stil i mobilne kriterije. Ako nova stavka zahtijeva vertikalni scroll na vrlo malom zaslonu, osigurati da su sve radnje dostupne; ne odrezati donje linkove, footer ili gumb Igraj. Ako postojeći test zahtijeva suprotno, predložiti stvarnu korekciju rasporeda/kriterija umjesto smanjivanja dodirnih ciljeva do neupotrebljivosti.

Poveznicu „Sve misije” u rezultatu dodati tek kada ova stranica postoji. PR03 minimum ne smije slati korisnika na buduću 404 rutu. CTA za igranje unutar svake kartice nije obvezan za prvo izdanje; ako se dodaje, mora koristiti postojeći odabir moda i točan kontekst bez automatskog slanja igrača u pogrešan red.

## 10. Stanja koja treba dizajnirati prije kodiranja

| Stanje | Što korisnik vidi |
|---|---|
| Inicijalno učitavanje | Miran skeleton ili poruka; nema lažnih brojeva. |
| Prvi aktivni dan | Jedna dnevna, dva prazna mjesta, tri tjedne. |
| Puna zaliha | Tri dnevne s objašnjenjem dotoka, bez gumba za kupnju mjesta. |
| Dnevne sve završene | Prazna zaliha s idućim dotokom i današnjim dovršecima. |
| Tjedne sve završene | Tri dovršene kartice i termin obnove. |
| Zamjena na čekanju | Lokalna poruka i blokada svih zamjena iste vrste. |
| Konkurentna promjena | Osvježeni pravi podaci i kratko objašnjenje konflikta. |
| Gost | Objašnjenje i Prijava/Registracija. |
| Istekla prijava | Očišćeni osobni podaci i ponovna prijava. |
| Privremena greška | Retry; nije `0 misija` i nije prisilna odjava. |
| Granica dana/tjedna | Osvježavanje server stanja; nema lokalnog izmišljanja novih zadataka. |
| Zakašnjelo spremanje igre | Kratko čekanje potvrde, bez nagrade unaprijed. |
| MAX razina | Misije mogu završiti, stvarni XP je 0 i tekst je točan. |

## 11. Komponente i održavanje

| Predložena putanja | Odgovornost |
|---|---|
| `aplikacije/web/src/routes/misije/+page.svelte` | Dohvat, identitet, grupiranje, stanja, vrijeme i zamjene. |
| `aplikacije/web/src/lib/komponente/KarticaMisije.svelte` | Prikaz server podataka i emitiranje namjere za zamjenu. |
| `aplikacije/web/src/lib/komponente/NapredakMisijaPartije.svelte` | Ponovno koristiti PR03 rezultatni blok. |
| `aplikacije/web/src/lib/misije-klijent.ts` | Opcionalan tanak tipizirani adapter, ne zaseban state framework. |
| `aplikacije/web/src/lib/komponente/IskustvoPartije.svelte` | Ponovno koristiti PR03 prikaz ukupnog XP-a i partijskih detalja. |
| `aplikacije/web/src/routes/+page.svelte` | Poveznica Misije u stvarnoj glavnoj navigaciji. |
| `e2e/misije.spec.ts` | Desktop UI/HTTP fixture testovi. |
| `e2e/mobilni-tok.spec.ts` | Mali mobilni podskup prema postojećem Playwright configu. |

Ne uvoditi novi router, UI framework, globalni event bus ili biblioteku datuma. Shared tipovi i postojeći Svelte 5 obrasci dovoljni su za ovaj opseg. Nove putanje su prijedlog; stvarni PR03 možda je komponentu već imenovao drukčije.

## 12. Pristupačnost i performanse

- Jedan `h1`, dvije semantičke skupine s naslovima, kartice kao `article` ili postojeća semantička komponenta.
- `<progress>` ili odgovarajući `role=progressbar`; `aria-valuemin=0`, `aria-valuemax=cilj`, stvarni ograničeni napredak i čitljiv naziv metrike. Tekst `N / cilj` uvijek vidljiv.
- Status završetka nije samo zelena boja. Oznaka moda nije samo ikona.
- Dijalog zamjene ima naziv, smislen početni fokus, Escape/odustajanje i povrat fokusa. Koristiti postojeći pristupačni obrazac.
- `aria-live=polite` za završetak/zamjenu/grešku; ne najavljivati svaku promjenu countdowna.
- Uvažiti obje teme, font za disleksiju, povećanje teksta i `prefers-reduced-motion`. Nema velikih obveznih konfeta ili vibracija za svaku od šest promjena.
- Izbjegavati skokove visine pri učitavanju, ali ne fiksirati visinu koja odsijeca duži hrvatski tekst.
- Ne ispisivati tuđe osobne podatke u logove ili DOM; ne obrađivati ID igrača iz query stringa kao ovlaštenje.
- Jedan koordinirani timer/refresh po stranici, cleanup pri odlasku, bez stalnog pollanja ili šest zasebnih intervala po kartici.

## 13. Ciljana testna matrica

Ne ponavljati 40 backend metrika kroz 40 browser partija. Za tekstove/forme koristiti parametrizirane fixturee i zajedničke tipove; za stvarnu integraciju mali broj kontroliranih tokova.

| Skup | Obvezni scenariji |
|---|---|
| Navigacija / SSR | Vidljiva poveznica, direktni `/misije` i refresh bez 404/SSR greške; identitet se inicijalizira prije poziva. |
| Kapacitet | Prvi ulaz 1+3, puna zaliha 3+3, prazne dnevne 0+3; nema 40 kartica niti prisilno dvije kao u staroj specifikaciji. |
| Rokovi | Dnevna nema istek; obnova u ponoć ne briše progres; tjedna završena ostaje do ponedjeljka. |
| Ciljevi | Pobjede 1/3/5/20, trening 1/3, streak u jednoj, W03 broj partija, W20 oba podcilja, W18 različiti počeci. |
| Nagrade | 200/2.000 iz servera, djelomični cap i nula na capu; ne pokazuje lažno dodijeljeni nominalni XP. |
| Dnevni završetak | Kartica napušta aktivnu zalihu, dokaz je u „Danas dovršeno”; mjesto čeka ponoć bez trenutne dopune. |
| Tjedni završetak | Jedna od tri ostaje završena; nema zamjene ni četvrte kartice. |
| Točan ID | Zamjena druge/treće kartice šalje njezin `dodjelaId`; druga mjesta se ne mijenjaju. |
| Skupna kvota | Nakon tjedne zamjene sve tri tjedne imaju potrošenu kvotu, dnevne nisu pogođene; sutra se pravo obnavlja. |
| Potvrda / dvoklik | Odustani = nula POST; dva brza klika/Enter ne stvaraju dvije mutacije; tijekom POST-a blokada iste vrste. |
| Konflikti | Dovršena/stara/tuđa dodjela, potrošena kvota, nema alternative i obračun na čekanju; bez lažne nove kartice. |
| Timeout | GET razrješava nepoznati ishod; retry POST-a, ako postoji, koristi isti ključ i sadržaj. |
| Redoslijed odgovora | Stari GET nakon POST-a i niža `stanjeVerzija` ne vraćaju staru karticu; stara sesija ne upisuje podatke novoj. |
| Auth / greške | Gost, 401, 403, 429, 503 i network imaju odgovarajuće stanje; nedostupnost nije prazna zaliha. |
| Sat | Druga zona uređaja i pomak sata ±3 h; jedna koordinirana obnova na ponoć/ponedjeljak; nema lokalnog generatora. |
| Rezultat javne igre | Samo stvarni pomaci, više dovršenih, jedan konačni XP/level i bez utjecaja na „XP prvak”. |
| Rezultat treninga | `mojeIskustvo=null`, ali misija/XP/level-up vidljivi; postojeći „Zagrijan” jednom; generičke javne misije ne napreduju. |
| Replay / spremanje | Isti payload ponovno ne daje drugi efekt/XP; stanje spremanja nije završena misija; stari rezultat ne prepisuje aktualnu stranicu. |
| Regresija | Oba postojeća javna prijavna panela ostaju na dnu i funkcionalna; privatna/zagrijavanje zadržavaju odgovarajuće postojeće radnje. |
| Mobilno / a11y | 320×568 i 390×844, obje teme, font za disleksiju, povećani tekst, tipkovnica, fokus, smanjene animacije i bez horizontalnog scrolla. |

Jedan stvarni backend tok neka provjeri dodjelu → zamjenu → refresh, a rezultatni testovi PR03/PR04 zajedno trebaju pokriti barem jednu javnu i jednu trening-misiju. Ako ih PR03 već pouzdano pokriva, proširiti iste testove umjesto dupliciranja punih igara.

Pregledani `playwright.config.ts` mobilne projekte pokreće samo za `mobilni-tok.spec.ts`. Novi `misije.spec.ts` samim postojanjem ne pokriva Android/iPhone. Dodati mali broj ciljanih mobilnih slučajeva u postojeći raspored ili obrazloženo promijeniti `testMatch`, bez pokretanja svih desktop testova triput.

Koristiti kontrolirani sat, fiksne tipizirane fixturee i deferred odgovore za utrke. Bez `waitForTimeout(5000)`, čekanja ponoći, slučajnog odabira misije u UI testu ili stvarnih korisničkih računa.

### Provjere

```bash
pnpm --filter zajednicko build
pnpm --filter web check
pnpm --filter web build
pnpm exec playwright test e2e/misije.spec.ts --project=desktop-chrome
pnpm exec playwright test e2e/naslovnica.spec.ts --project=desktop-chrome
pnpm exec playwright test e2e/mobilni-tok.spec.ts --project=android-chrome --grep 'misije'
pnpm exec playwright test e2e/mobilni-tok.spec.ts --project=iphone-webkit --grep 'misije'
```

Naziv novih testova/pattern prilagoditi stvarnoj implementaciji; ne prijaviti prolaz komande koja nije pokrenula nijedan test. Nakon ciljanih provjera pokrenuti obvezni postojeći CI. U ovom dokumentacijskom zadatku te implementacijske provjere nisu izvođene.

## 14. Definition of Done

- [ ] PR03 stvarni ugovor poznat i korišten bez nagađanja; sva tri v2 dokumenta usklađena s konačnom implementacijom.
- [ ] `/misije` i navigacija rade za direktni ulaz, registriranog korisnika, gosta i obnovu sesije.
- [ ] Jasno se razlikuju prenosive dnevne, dnevni dotok i tjedni istek; UI ne koristi stari model 1+1.
- [ ] Sve početne vrste ciljeva imaju razumljiv tekst, točan kontekst i prikladan progres/podciljeve.
- [ ] Recycle zamjena mijenja točnu dodjelu uz jednu zajedničku kvotu po vrsti, potvrdu, idempotency i korekciju konflikata.
- [ ] Main-menu popupovi (daily pa weekly) po `novosti` + `POST /pregled`; lebde nad menijem.
- [ ] Zastarjeli odgovor, drugi tab i promjena identiteta ne vraćaju stari ili tuđi progres.
- [ ] Rezultat prikazuje dovršenu misiju i stvarni XP u istoj javnoj igri ili treningu; konačna razina je točna.
- [ ] Nema duplih nagrada/efekata, lažne isplate na capu, ručnog preuzimanja ili novog „Majstora misija”.
- [ ] Prijave i postojeći završni blokovi funkcionalni; nema regresije privatnih/trening pravila.
- [ ] Desktop/mobilni screenshotovi, relevantni testovi i postojeći CI predani s točnim rezultatima.

## 15. Predaja i stvarno otvorene odluke

Predati pregledne screenshotove: prvi ulaz, puna zaliha, potrošena kvota, dnevne završene/tjedne završene, mobitel te rezultat javne igre i treninga s nagradom. PR opis objasni novu funkciju i validaciju, uz link na stvarni PR03/SHA.

Rutinske odluke o ikoni, spacingu, maloj potvrdi i imenima komponenti agent može riješiti u skladu s postojećim UI-jem. Pita vlasnika samo ako želi promijeniti korisnikova pravila, proširiti opseg ili ako tehnički ugovor onemogućuje obećano ponašanje. Balans 3 trening-pobjede nasuprot 20 Dvoboj-pobjeda označen je u katalogu za kasniji razgovor; frontend zbog toga ne mijenja ciljeve ili nagrade samostalno.

**PR05 ostaje zaseban:** aktivni dani prijave i „Stalno si tu” ne izvode se iz W06, ne računaju se na stranici Misije i ne smiju uvjetovati dovršavanje ovog PR-a.

## 16. Dogovoreni UX dodaci (4. 11. 2026.) — popup i recycle

Ova sekcija bilježi dogovor iz PR03 planiranja. PR03 isporučuje samo ugovor (`novosti`, `POST /api/misije/pregled`); UI je isključivo ovaj PR.

### 16.1. Main-menu popup (Hearthstone-inspiracija)

Kad registrirani igrač uđe u **main menu** (prva registracija, prvi ulazak tog zagrebačkog dana, ili povratak s novim misijama):

1. Ako je `novosti.dnevne === true` → popup s aktivnim dnevnim misijama (do 3 kartice).
2. Nakon dismissa, ako je `novosti.tjedne === true` → drugi popup s tjednim (3 kartice).
3. Redoslijed uvijek **daily pa weekly**. Ako nema novosti za skupinu, taj popup se ne prikazuje.
4. Dismiss: klik bilo gdje na zatamnjenu pozadinu **ili** jasan gumb X. Kartice **lebe** nad main menijem; meni ostaje vidljiv iza (zatamnjeno/prozirno). Nema „odmah igraj” iz popupa u prvom izdanju.
5. Nakon dismissa skupine pozvati `POST /api/misije/pregled` s odgovarajućom `skupina` da se ugasi zastavica. Ne oslanjati se na `localStorage` kao jedini izvor istine (više uređaja).

Zamjena ili dovršetak **ne** forsiraju ponovni popup istog paketa. Zastavica se diže samo na **novi dnevni dotok** ili **novi tjedni ciklus** (uključujući prvu inicijalizaciju).

### 16.2. Stranica `/misije` — layout i akcije

- Layout **3 + 3** (do tri dnevna mjesta + tri tjedna), ne Hearthstoneov 4×N.
- Zamjena: ikona **recycle** (circular arrow), pristupačno ime „Zamijeni misiju…”. **Ne** koristiti X kao simbol brisanja mjesta.
- Opcionalno: mala strelica „odmah igraj” koja vodi u postojeći odabir moda/konteksta misije (`kontekst`/`mod` iz DTO-a). Nije obavezna za prvi merge ako CTA u kartici nije spreman; ako se doda, ne smije slati igrača u krivi red.
- Potvrda zamjene i dalje objašnjava gubitak napretka i potrošnju zajedničke dnevne kvote te vrste.
