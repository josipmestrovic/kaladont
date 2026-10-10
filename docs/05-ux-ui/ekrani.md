# Admin nadzor poslužitelja

Čekaonice Dvoboja i Četveroboja tijekom odbrojavanja prikazuju konačna sjedala iz `partija:pocetak`, uključujući botove koji su upravo popunili zadnja mjesta. Zadnja poruka reda ne smije isprazniti puna sjedala nakon najave početka. Identitet bota ostaje neoznačen običnom igraču.

Admin ima zaseban odjeljak za CPU jedne jezgre aplikacijskog procesa, RSS/heap, event-loop p95, HTTP p95 i 4xx/5xx, Socket.IO pokušaje/odbijanja/autorizaciju, partije/treninge i bazu. Brojači spajanja i botova vrijede od pokretanja; HTTP metrike pokrivaju petosekundni prozor. Prikazuje se vrijeme uzorka, zastarjelost nakon 15 s, izdanje i ograničena povijest CPU/RAM od 15 minuta. Povijest se briše restartom. Na uskom zaslonu vrijednosti i trendovi slažu se u jedan stupac, bez horizontalnog pomicanja.

Automatsko osvježavanje radi samo u vidljivoj kartici i ne preklapa zahtjeve. Greška dohvaćanja ne skriva posljednji uzorak. Alarm prikazuje aktivnost, zadnji uspješan prihvat emaila i grešku slanja; probnu obavijest pokreće samo izričit admin klik i dostupna je samo kada su email alarmi uključeni. Nema javne rute za ove podatke niti tipke za reset brojača.
# Specifikacija ekrana

Svi ekrani dizajniraju se **mobile-first (portret)**. Većina desktop prikaza centrira isti sadržaj unutar `max-width: 1000px` kontejnera; naslovnica je namjerna iznimka s dvije kolone na desktopu i jednom kolonom na mobitelu. Ovdje je funkcionalna specifikacija — vizualni jezik definira [vizualni-identitet.md](vizualni-identitet.md).

## 0. Header / navigacija (trajna traka)

**Svrha:** brz pristup povratku i profilu. Prikazuje se na svim ekranima OSIM na naslovnici (`/`), u čekaonici (`/red`) i na cijeloj ruti partije (`/partija/*`), uključujući završni poredak.

- Traka je potpuno transparentna, bez donjeg obruba i bez sjene, tako da se vizualno stapa s pozadinom stranice.
- Naslovnica nema zajednički header ni avatar, neovisno o širini zaslona ili vrsti korisnika.
- **Lijevo na svim drugim stranicama s headerom:** klikabilna narančasta povratna strelica s tekstom „Nazad”, koja koristi povijest preglednika. Ako prethodna ruta nije root `/` ili nije poznata, uz nju se prikazuje `GiFastBackwardButton` s tekstom „Početna” i poveznicom na `/`. Obje akcije preslikavaju uzorak „Što je novo?”: ikona 59 × 59 px, ukupna visina 80 px te ista veličina i težina fonta na desktopu i mobitelu.
- **Desno:** avatar korisnika ili gosta i njegov nadimak u horizontalnom rasporedu na desktopu i mobitelu; klik vodi na `/profil`. Avatar je povećan tako da njegova visina odgovara ukupnoj visini notebook ikone i teksta „Što je novo?”. Dugi nadimak skraćuje se elipsom umjesto širenja headera.
- **Admin:** ispod glavnog headera vidi dodatnu navigaciju sa svim admin površinama: **Rječnik**, **Prijave** i **Mišljenja korisnika**. Ta navigacija je samo pogodnost; server zasebno štiti svaku admin rutu.

## Globalne obavijesti

- Status veze i upozorenje o čitanju naglas prikazuju se kao plutajuće kartice u zajedničkom stupcu, jedna ispod druge.
- Dok je čitanje naglas uključeno, obavijest objašnjava da govor ovisi o glasovima koje preglednik izlaže, prikazuje procijenjenu platformu te jezike preglednika i glasova, i vodi na temu **Pristupačnost** u `/pomoc`. Jezik preglednika nije nužno jezik operacijskog sustava. Ti se podaci koriste samo u pregledniku i ne šalju poslužitelju.
- **Razumijem** skriva govornu obavijest i potvrdu čuva lokalno dok je čitanje uključeno. Isključivanje čitanja briše potvrdu; iduće uključivanje ponovno prikazuje obavijest. Nedostupan hrvatski glas upozorava, ali ne blokira prekidač.

## 1. Landing (`/`)

**Svrha:** jedan pogled → odabir glavne akcije ili informativne stranice.

- Ilustracija Kaladonta nije prikazana ni na desktopu ni na mobitelu. Naslov i navigacija centrirani su u jednoj koloni po sredini ekrana.
- H1 prikazuje „KALADONT online”; na desktopu su riječi u istom retku, a na mobitelu u dva retka. Oznaka verzije nije prikazana.
- Uža glavna navigacija ima osnovne retke **Igraj**, **Pravila**, **Ljestvica** i **Moja statistika**. „Moja statistika” vodi na zadani statistički prikaz `/profil#statistika`. Sekundarne stavke imaju tamni standardni tekst i ikone, zelenu strelicu te tekst lijevo poravnat uz ikonu.
- Glavna navigacija koristi vlastite SVG assete: `GiToothbrush` za Igraj, `GiSpellBook` za Pravila, `GiHoleLadder` za Ljestvicu, `GiGamepad` za Moju statistiku, `GiAutoRepair` za Postavke, `GiExitDoor` za Odjavu te `GiTwoShadows` za Prijavu i Registraciju. Modal igre koristi `GiLevelTwoAdvanced`, `GiLevelFourAdvanced` i `GiLockedDoor`.
- Svi korisnici vide **Postavke** (`/postavke`, uz preusmjeravanje na `/profil?tab=postavke#postavke`); promjena teme dostupna je isključivo ondje. Registrirani korisnik dodatno vidi blago narančastu akciju **Odjavi se**. Gost vidi **Prijavi se** i **Registriraj se**. Editor avatara (`/profil/avatar`) dostupan je i gostima.
- **Igraj** otvara modal sa slijedom: **Dvoboj** (`/red?mod=dva_igraca`, opis „2 igrača”), **Četveroboj** (`/red?mod=cetiri_igraca`, opis „4 igrača”), **Zagrijavanje** (`/zagrijavanje`, podnaslov „Igraj dvoboj protiv računala.”, ikona `19-vatra.png`) i **Privatna soba** (`/soba/kreiraj`). Modal zamućuje pozadinu.
- **Pravila** vode na `/pravila`, a **Ljestvice** na `/ljestvice`.
- Footer na dnu naslovnice sadrži poveznice **Što je novo?** (`/novosti`) i **Pomozi poboljšati igru** (`/povratne-informacije`) te gumb **Uvjeti i privatnost** koji otvara modal bez ikona i nadnaslova, s naslovom „Što te zanima?” i opcijama **Uvjeti korištenja** (`/uvjeti`) i **Pravila privatnosti** (`/privatnost`). Poveznice su vidljive gostima i prijavljenim korisnicima.
- Font za disleksiju i čitanje naglas nalaze se u **Postavkama** za goste i registrirane korisnike. Font mijenja tipografiju cijelog sučelja; čitanje naglas izgovara novu riječ na stolu Web Speech API-jem uz `hr-HR`. Postavke se spremaju lokalno u pregledniku. Uključeno čitanje naglas prikazuje globalnu obavijest koju korisnik može potvrditi.
- Pomoć (`/pomoc?tema=pristupacnost`) objašnjava govornu mogućnost i vodi na upute za Android, iPhone/iPad, Windows, Mac i Linux. Ista tema opisuje disleksiju i moguću vrijednost jezične igre bez terapijskih tvrdnji.
- Zaseban red poveznica Prijavi se / Registriraj se ispod navigacije ne prikazuje se; te su akcije dio jedinstvene navigacije gosta.

## 2. Red čekanja (`/red?mod=cetiri_igraca|dva_igraca`)

- Ovisno o odabranom modu (4p ili 1v1), čekaonica prikazuje 4 ili 2 kružna mjesta.
- Čim se skupe 4 (ili 2) igrača, pokreće se numerički countdown 3-2-1 i partija kreće.
- Kad je popuna botovima uključena ([botovi.md](../02-pravila-igre/botovi.md)), rezervirani bot pojavljuje se na praznom mjestu kao sudionik koji čeka od trenutka rezervacije (Četveroboj: 20/30/40 s); u Dvoboju bot ulazi i partija kreće u istom trenutku (30 s). Prikaz ne nosi oznaku bota ni odbrojavanje do praga.
- Gosti idu ravno u čekaonicu klikom na odabrani mod bez zapreka ili prompta za ime.

## 2d. Zagrijavanje (`/zagrijavanje`)

- Stranica odmah šalje `trening:zapocni`, prikazuje „Pripremamo dvoboj protiv računala…”, napomenu da se ništa ne bilježi i gumb **Odustani**. Nakon `partija:pocetak` odbrojava kao čekaonica i vodi na `/partija/:id`.
- Greška (zauzet poslužitelj, isključen trening, aktivna partija ili soba) prikazuje poruku i **Pokušaj ponovno**; igrač koji već ima partiju preusmjerava se na nju.
- Protivnik je uvijek „Računalo” s jednim stalnim avatarom (`AVATAR_RACUNALA`). Stol, timer i potezi identični su javnom Dvoboju; XP, nagrade za riječi, kolekcija i dostignuća nisu prikazani ni tijekom igre.

## 2b. Povratne informacije (`/povratne-informacije` i `/zahvala-za-informacije`)

- Stranica je dostupna samo registriranim korisnicima. Sadrži jednu obaveznu poruku s najmanje 20 znakova i gumb **Pošalji**.
- Pri prvom uspješnom slanju prikazuje se početno označen checkbox **Želim ocijeniti igru i time pomoći u daljnjem razvoju**. Dok je označen, svih šest ocjena od 1 do 5 zvjezdica je obavezno: Pravila, Rječnik, Vrijeme za potez, Snalaženje u aplikaciji, Brzina učitavanja i Gamifikacija.
- Korisnik može odznačiti checkbox i poslati samo poruku. Nakon prvog uspješnog obrasca, bez obzira na odabir checkboxa, detaljna anketa se više ne prikazuje; sljedeća slanja imaju samo poruku.
- Uspješno slanje vodi na `/zahvala-za-informacije` s porukom zahvale za aktivno sudjelovanje u poboljšanju igre.
- Svako uspješno slanje povećava dostignuće **Glas zajednice**; pet brzih razina otključava se na 1, 2, 3, 4 i 5 obrazaca.

## 2c. Mišljenja korisnika (`/misljenja-korisnika`)

- Dostupno samo administratoru. Prikazuje najnovija mišljenja, filtere `sve`/`nova`/`pregledana`/`arhivirana`, detalj poruke i dostupne ocjene.
- Admin vidi nadimak, email i vrijeme slanja te može označiti mišljenje pregledanim ili arhiviranim.

## 2a. Privatna soba (`/soba/kreiraj` i `/soba/[kod]`)

- Konfiguracija: najviše 8 igrača, tajmer poteza (15s, 30s, 60s ili Bez tajmera), bodovi za eliminacije te vrste riječi. Imenice su uvijek uključene i prikazane označenim, onemogućenim checkboxom s objašnjenjem. Svih devet ostalih vrsta ostaje odmah vidljivo, opcionalno i zadano uključeno; odabir nije skriven u harmoniku.
- Uz izraz „skup sigurnih riječi” prikazuje se pojašnjenje na klik ili dodir: „Zbirka riječi koja uvijek ima nastavak te njihov nastavak isto ima nastavak.” Uz svaki korisniku vidljiv izraz „mrtva slova” prikazuje se pojašnjenje: „Riječi koje nemaju nastavka. Sustav automatski izbacuje sljedećeg igrača u slučaju takvih riječi.”
- Generira se kod sobe i pozivni link. Gosti i registrirani mogu ući kao gosti ili igrači.
- Soba živi u memoriji poslužitelja bez spremanja u bazu. Svaka igra je zasebna partija i počinje odmah; po završetku soba ostaje aktivna 5 minuta za novu partiju s istim postavkama.
- Iznad pravila sobe prikazuje se njezina kumulativna ljestvica: poredana je po osvojenim bodovima, zatim po pobjedama, a vodeći igrač dobiva krunu. Ti rezultati ne mijenjaju globalne ljestvice ni agregate igrača.
- Na sjedalima se igračima prikazuje **viši rang** (između 4p i 1v1 ranga).

## 3. Stol (`/partija/:id`) — srce igre

Raspored (portret):

- **Vrh:** četiri avatara u luku (protivnici) — krug, ime, značka ranga; eliminirani posive uz oznaku plasmana. Vlastito sjedalo, uključujući avatar, ime i status ispod njega, jedna je klikabilna cjelina koja otvara izbornik brzih poruka; protivnička sjedala nisu interaktivna.
- **Stabilan lokalni red:** sjedala se prikazuju u kanonskom kružnom redoslijedu partije, zakrenutom tako da lokalni igrač uvijek bude prvi. Red se računa iz sjedala i lokalnog ID-a, nikada iz igrača na potezu. Dok identitet ili sjedala nisu stigli, mjesta se ne prikazuju; nakon spremnog prikaza promjene poteza, timeri i eliminacije ne mijenjaju red ni položaj kartica. Eliminirani ostaju na svojem mjestu.
- **Čitanje riječi:** ako je uključeno, preglednik izgovara početnu riječ, svaku novu prihvaćenu riječ te sistemsku riječ na početku nove runde. Ne čita poruke sučelja ni ponovljena stanja; isključivanje ili napuštanje partije prekida govor. Dostupnost i glas ovise o pregledniku i instaliranim glasovima uređaja.
- **Aktivni igrač:** cijelo sjedalo (avatar, ime i status) dobiva debeli zeleni zaobljeni okvir, ime je zeleno, a iznad sjedala stoji label „Na redu!”. Sva sjedala rezerviraju isti prostor za label kako se raspored ne bi pomicao. Oko avatara ide **zeleni prsten koji se prazni** sinkrono sa stvarnim trajanjem poteza (15, 30 ili 60 sekundi u privatnoj sobi; SVG stroke, rok `istekPotezaIso`, serverov clock anchor `serverVrijemeIso`), s brojem preostalih sekundi u sredini. Prsten napravi jedan jači vizualni puls kada igrač dobije red, uključujući prvi potez partije. Zadnjih 5 s prsten pulsira, a zadnje 3 s avatar se vrlo blago pomiče lijevo-desno. Tijekom sustavskog odabira riječi nema aktivnog okvira ni labela. **Slojevi oko avatara, redom od avatara prema van: avatar → timer prsten → rang-border prsten.** Timer prsten mora biti vizualno ispred (iznad) rang-bordera, ne iza njega — mora se vidjeti neovisno o rangu igrača.
- **Glavna zona igre:** kompaktna zona traženih slova, unosa i statusnih poruka nalazi se ispod stalne zone sjedala. Promjene poteza, eliminacija, obračun XP-a, promatranje i spremanje rezultata ne mijenjaju položaj avatara ni visinu njihovih sjedala na istom zaslonu. Na mobitelu Četveroboj koristi dva retka po dva sjedala, a Dvoboj samo jedan redak. Detaljni rezultati mogu imati zaseban raspored.
- **Otvaranje runde:** nakon eliminacije i Kaladont-efekta ispod avatara prikazuje se jedno kompaktno objašnjenje uzroka i boda te „Nova runda za: 8…1”. Nema cjelozaslonskog ekrana. Po serverskom roku dodjeljuje se nova riječ i počinje timer poteza. Prva riječ ne dobiva dodatnu osamsekundnu pauzu. Nakon završetka avatari ostaju vidljivi uz posljednju eliminaciju, pobjednika i osamsekundno odbrojavanje do detaljnih rezultata; ako baza još sprema, prikazuje se kratka poruka bez pomicanja avatara.
- **Razlog ispadanja:** rezervirani jednoredni status svakog sjedala prikazuje „Ispao: Kaladont”, „Ispao: istek vremena”, „Ispao: nema nastavka”, „Ispao: sve iskorišteno”, „Ispao: izgubljena veza” ili „Ispao: Ne znam”. Pobjednik ima oznaku „Pobjednik”. Razlog se ne smije prelomiti niti sakriti elipsom.
- **Dno (zona na potezu):** polje za upis (autofokus, hrvatska tipkovnica, najviše 31 znak) i gumb pošalji. Na širini od 500 px naviše stoje u istom retku, pri čemu unos zauzima 70 %, a gumb 30 % širine; na užim zaslonima gumb je ispod unosa pune širine. Gumb „Ne znam” je sekundaran i prije predaje poteza otvara potvrdu unutar aplikacije.
- **Zadnja riječ i izbornik brzih poruka:** zadnja prihvaćena riječ igrača prikazuje se kao jedan stabilan word bubble neposredno iznad avatara autora, s većim tekstom i narančasto istaknuta zadnja dva grafema. Bubble nestaje ili se premješta kada server prihvati novu riječ; riječ sustava ostaje samo u glavnoj zoni igre. Eliminacija autora ne skriva njegov bubble: uzročni potez ostaje čitljiv tijekom prijelaza i čekanja rezultata. Duga riječ dobiva manji font na mobitelu kako bi layout ostao stabilan. Klik, Enter ili Space na **vlastitom sjedalu** otvara mali animirani izbornik s četiri predefinirane poruke (tekst + emoji, ne slobodan upis — izbjegava moderaciju): 👋 „Prijatno", 😅 „Nemoj zamjerit", 👏 „Bravo!", 😎 „Hvala". Reakcija se prikazuje ispod imena igrača, može biti vidljiva istodobno s word bubbleom i zatim nestane (1 po 2 s); rate limit je 1 poruka / 2 s.
- **Povijest poteza:** u prvoj izvedbi dostupna je nakon završetka partije, kako se tijekom brzog tijeka poteza ne bi prekidalo praćenje stola. Bočna ploha tijekom aktivne partije ostaje planirana nadogradnja.

| ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| Odbijena riječ   | Polje se pri svakom odbijanju zatrese i kratko dobije crveni rub i podlogu + poruka razloga (crveno, 2 s) ispod zone akcija; vrijeme vidljivo teče dalje. Za riječ koja ne postoji u bazi prikazuje se „**riječ** ne postoji u našoj bazi.”, pri čemu je unesena riječ podebljana i blago veća od ostatka poruke. |
| Prihvaćena riječ | Riječ „odleti" na sredinu stola; red prelazi dalje                                                                  |
| Eliminacija      | Preko stola kratka kartica: „Ana je ispala — nema riječi na 'onj'!" + tko dobiva bod                                |
| Nova runda       | „Boris otvara novu rundu" + prsten na Borisu                                                                        |
| Ja eliminiran    | Kartica s razlogom; prelazim u promatranje                                                                          |
| Promatram        | Traka „Promatraš partiju"; poruke i povijest i dalje rade                                                          |

Odabir „Ne znam” otvara kratku potvrdu s naslovom „Predati potez?” i bez dodatnog objašnjavajućeg odlomka. Akcije su „Da” kao crveni destruktivni gumb i „Ne” kao prozirni gumb sa zelenim tekstom i obrubom.

## 4. Kraj partije (`/partija/:id/kraj`)

- Redoslijed 1.– 4. s bodovima razloženim na plasman + eliminacije + bonus (npr. „3 + 2 + 1 = 6").
- Za mene: „Novi prosjek: 2,8 → **Lektor**" (registrirani) ili poruka za goste: „Ova statistika je spremljena lokalno u ovom pregledniku. Registriraj se da je zadržiš zauvijek!" (namjerno pojednostavljeno — tehnički je vezano uz gost-identitet ovog uređaja, ne doslovno preglednik, ali ovako je poruka jasnija igraču).
- Iznad plasmana je osobni XP obračun: `LVL`, dodijeljeni XP, grupirane stavke, streak bonus i traka do sljedeće razine. Sve stavke prikazuju se odmah, bez animacije. Eliminirani promatrač dobiva samo svoj obračun i može napustiti partiju dok se trajni upis dovršava pri kraju.
- Ocjena igre računa se samo kada igrač ima najmanje tri prihvaćena poteza. U suprotnom se prikazuje jasna poruka da nema dovoljno podataka, bez zvjezdica i bez XP bonusa ocjene.
- Tijekom partije gornji status ostaje vidljiv i pri izboru nove riječi, eliminaciji te završnom odbrojavanju: prikazuju se autoritativne XP stavke i privatna narančasta obavijest o upravo otključanom dostignuću. Obavijest o dostignuću traje 5 sekundi i nastavlja se prikazivati pri prijelazu na završni ekran. Privatne sobe ne prikazuju XP, ali mogu prikazati dostignuća koja su dopuštena u privatnom modu.
- Završni redoslijed je: **Završni poredak**, osobna ocjena igre, XP obračun, Kaladont DNK, nova dostignuća i akcije.
- Desetsekundni sažetak prije završnog poretka prikazuje se samo prvi put. Ako igrač nakon prikazanih rezultata ode na drugu stranicu i vrati se browser poviješću, ista partija odmah prikazuje završni poredak bez ponovnog odbrojavanja i zvuka završetka.
- Prijava riječi je zatvoreni accordion; nakon otvaranja prikazuju se odigrane riječi i gumb „Prijavi riječ”.
- Tipke: **Igraj opet** (u red), **Povratak**, a gostu i registracija za trajno čuvanje statistike.
- **Kraj treninga** (kontekst `trening`): naslov „Kraj treninga”, obavijest „Ovo je trening. Rezultat se ne bilježi i ne utječe na tvoju statistiku, dostignuća ni formu.”, poredak s oznakom Pobjeda/Poraz bez bodova; nema ocjene igre, XP-a, forme, DNK-a, kolekcije, dostignuća ni poruke za goste. Tipke: **Igraj novi trening** (`/zagrijavanje`) i **Povratak na odabir igre**.

## 5. Prijava riječi (`/partija/:id/povijest`)

- Prikaz odigranih riječi iz završene javne ili privatne partije.
- Uz svaku riječ gumb **„Prijavi riječ"**; prijava se šalje bez dodatnog teksta i može se poslati najviše tri puta po sudioniku i partiji.
- U prvoj izvedbi dostupno trajno nakon završetka partije. Bočna ploha tijekom aktivne partije planirana je za kasniju nadogradnju.

## 6. Registracija / Prijava (`/registracija` i `/prijava`)

- Registracija: višekoračni tijek (1. Korak: nadimak; 2. Korak: email, lozinka, odabir avatara). Kod email polja diskretna napomena: „Na tvoju email adresu nećemo slati nikakve obavijesti, isključivo je koristimo kako bi ti omogućili pristup računu ako zaboraviš lozinku."
- Prijava: jednostavna prijava u dva odvojena retka (Email i Lozinka) s velikim zelenim gumbom.
- Nakon uspješne registracije korisnik dolazi na javnu stranicu `/zahvala` s čestitkom, nenametljivim konfetima i izborom sljedeće akcije: Dvoboj, Četveroboj, privatna soba, pravila, profil, postavke, ljestvice ili zasebna stranica novosti `/novosti`.

## 7. Profil (`/profil`) — vlastiti i javni

- Stil igre prikazuje se odmah ispod XP-trake u bloku identiteta, na desktopu i mobitelu. Stil je „agresivan” iznad prosjeka 0,8 eliminacije po partiji, „uravnotežen” od 0,2 do uključivo 0,8, a „dobrica” ispod 0,2; bez partija je „neodređen”. Agresivan igrač traži priliku odigrati riječ koja će eliminirati sljedećeg igrača; uravnotežen nekad eliminira druge, ali mu to nije glavni prioritet; dobrica ne voli kad drugi ispadaju zbog njegove riječi. Stil „agresivan” je crven, „uravnotežen” neutralan, a „dobrica” zelen. Klik na podcrtani naziv stila ili gumb s upitnikom otvara objašnjenje iznad naziva; gumb X, klik izvan objašnjenja, pomicanje stranice ili Escape zatvaraju ga. **Prosječna ocjena igre** prikazuje se u statističkoj kartici „Ostalo” za oba načina.
- Desno od avatara prikazuje se kompaktni izbor najviše šest istaknutih dostignuća, s njihovim ikonama i osvojenim zvjezdicama. Prikazuju se razine 2–5; prvo idu sva dostignuća s 4–5 zvjezdica, a zatim Iskusnjara razine 2–3 prije ostalih razina 2–3. Unutar skupine s jednakim brojem zvjezdica vrijedi prioritet: Iskusnjara, Glas zajednice, Kaladont!, Rijetkolovac, Dugometraš, Slijepa ulica, Lovac na glave, Završna riječ, KA-zna, Jezik u plamenu. Klik/dodir na ikonu prikazuje naziv, opis i napredak do sljedeće zvjezdice; Escape i klik izvan zatvaraju objašnjenje. Tooltip se otvara uz kliknutu ikonu i ostaje unutar ruba zaslona. Ispod 500 px ikone i zvjezdice smanjuju se za približno 20 %, razmak se smanjuje, a dostignuća ostaju u tri kolone i dva reda.
- Gostu se prikazuju iste dostupne statistike, rekordi, dostignuća i kolekcija kao registriranom igraču; zaseban poziv na registraciju ostaje ispod zaglavlja. Gostu se ne prikazuje registracijski staž i javni profil gosta ne postoji. Na mobitelu istaknuta dostignuća ostaju uz avatar, a ime, XP i stil igre prikazuju se ispod gornjeg reda. Prosječna ocjena dostupna je u „Ostalo” statistike. Vlastiti profil ne ponavlja akcije Postavke i Odjavi se.
- Vlastiti i javni profil koriste tabove **Četveroboj** i **Dvoboj** za statistiku. Sažetak svakog moda prikazuje `Odigrane`, `Pobjede` i `Porazi`; Aktivnost koristi ista imena modova. Tab **Aktivnost** i sadržaj povijesti partija vidljivi su isključivo administratoru na svim profilima; ostali korisnici, uključujući vlasnika vlastitog profila, nemaju prikaz ni API pristup. Modovi imaju odvojene rezultate, a broj sudionika je četiri odnosno dva.
- Odjeljak „Riječi i streak” zajednički je za oba javna moda; promjena taba ne mijenja te brojke. Privatne sobe se ne računaju.
- Registrirani igrači imaju javni read-only profil, primjerice `/profil/javni/:igracId`. Javni profil prikazuje nadimak, avatar, rang, rezultate, gamifikacijske statistike, najdužu i najrjeđu riječ, ali nikad email ili podatke za autentikaciju. Gosti nemaju javni profil.
- Profil prikazuje mode-specific DNK naslove (`Kaladont DNK — Četveroboj` i `Kaladont DNK — Dvoboj`). U „Ostalo” Četveroboj prikazuje eliminacije po igri; oba moda prikazuju niz prihvaćenih riječi, prosjek prihvaćenog poteza, duge riječi po igri i rijetke riječi po igri.
  - `Otkriveno jako rijetkih riječi` — frekvencija `0`;
  - `Otkriveno srednje rijetkih riječi` — frekvencija `1–9`;
  - `Otkriveno rijetkih riječi` — frekvencija `10–99`;
  - `Upisano dugih riječi (10–11 grafema)`;
  - `Upisano srednje dugih riječi (12–14 grafema)`;
  - `Upisano jako dugih riječi (15+ grafema)`.
- Pragovi u tim nazivima dolaze iz centralne konfiguracije i moraju se prikazati stvarnim vrijednostima ako se kasnije promijene.
- Najduža riječ je ona s najviše grafema; kod izjednačenja ostaje prva. Najrjeđa riječ je zadnja odigrana riječ iz najboljeg dosegnutog frekvencijskog tiera; riječ iz slabijeg tiera ne prepisuje je. Obje se prikazuju kao običan tekst ispod statističkih kartica, a ne kao kartice, kako duge riječi ne bi probile okvir.
- Prikazuje paginiranu povijest partija (prvih 10 partija + gumb "Učitaj još").
- Gosti vide žuto/krem upozorenje s pozivom/CTA gumbom za registraciju kako bi sačuvali statistiku. Registrirani korisnici ovaj okvir ne vide.

## 7a. Postavke (`/postavke`)

- Zvučne kontrole (`AudioKontrola`) dostupne su svim korisnicima.
- Zajednička grupa **Pristupačnost** sadrži prekidače **Font za disleksiju** i **Čitanje naglas**. Prvi primjenjuje OpenDyslexic kroz cijelu aplikaciju, drugi govori samo novu riječ na stolu; obje postavke dostupne su gostima i registriranima te se pamte lokalno u pregledniku, ne na računu.
- Grupa **Kursor** dostupna je gostima i registriranima. Sadrži pet vizualno preglednih setova (Klasik, Vitez, Čudovište, Čarobnjak i Kaladont), zadani set je Kaladont, a izbor se sprema lokalno u pregledniku. Za odabrani set korisnik bira stalnu rukicu ili običnu strelicu; primarni klik prikazuje stanje `klik`, bez automatskog prebacivanja pri hoveru. Kursor se primjenjuje kroz cijelu aplikaciju samo na uređajima s mišem ili drugim pokazivačem. Napomena: „Prilagođeni kursor prikazuje se na računalima i prijenosnicima s mišem ili drugim pokazivačem. Na uređajima koji se koriste dodirom ostaje standardni pokazivač.”
- Registrirani igrači vide izbor avatara, izmjenu email adrese i lozinke.
- Gosti vide obavijest da su napredne postavke rezervirane za registrirane korisnike uz gumb za registraciju.

## 8. Ljestvice (`/ljestvice?kategorija&mod&metrika&razdoblje&prikaz`)

Jedna stranica s odabirima u URL-u (Natrag/Naprijed vraća odabir). Pravila poretka: [bodovanje-i-rangovi.md](../02-pravila-igre/bodovanje-i-rangovi.md#vremenske-ljestvice). Stara adresa `/ljestvica` preusmjerava ovamo.
- Redoslijed od vrha: kategorija **Igrači | Riječi**, način **Četveroboj | Dvoboj**, metrika (**Prosjek bodova | Niz pobjeda**), pet kartica razdoblja, okvir s pravilima i odbrojavanjem, **Top 10 | Oko mene**, tablica.
- Svaka kartica razdoblja pokazuje kratak status: „Tvoja pozicija: 500” (bez ukupnog broja), „Nije odigrano danas / ovaj tjedan / ovaj mjesec / ove godine”, „Još 3 igre do poretka” ili „Dostupno od …” za zaključano Svih vremena.
- Okvir s pravilima stoji neposredno uz tablicu: kriterij, minimum, izjednačenje i odbrojavanje „Resetira se za 05:55:12” (ispod dana) ili „3 d 4 h”; Godišnja piše „Zaključava se za”, Svih vremena nema odbrojavanja. Odbrojavanje teče u pregledniku prema serverskom satu; na nuli se ljestvica jednom ponovno učita.
- Tablica: Mjesto · Igrač · vrijednost metrike · Odigrane igre; najviše 10 redaka. Vlastiti redak (prema ID-u, ne nadimku) ima narančasti okvir i oznaku **Ovo si ti**. „Oko mene” pokazuje četiri iznad i pet ispod uz globalna mjesta; nerangiranom igraču prikazuje razlog i Top 10.
- Greška učitavanja prikazuje poruku i gumb „Pokušaj ponovno”, nikad „nije odigrano”.
- Na mobitelu se kartice razdoblja slažu u dva stupca, tablica u retke s `data-label` oznakama bez vodoravnog pomicanja.
- Kategorija **Riječi** (Najčešće riječi): Top 10 zadano najučestalijih odigranih riječi u svim partijama (stvarna upotreba iz `potezi`, ne statička frekvencija iz uvoznog korpusa). Stupci: mjesto, riječ, broj upotreba, % partija u kojima se pojavila. Gumb **„Učitaj do 100"** s loading indikatorom; nema osobnih pozicija.
- Nadimak vodi na javni profil samo za registrirane igrače; gost nema link.

## 9. Admin (`/admin`) — zaštićena uloga

- **Prijave:** tablica s filtrima po statusu; klik otvara povijest partije s označenim spornim potezom; akcije: dodaj riječ / deaktiviraj riječ / dodaj iznimku digrafa / odbij — sve uz obaveznu napomenu.
- **Rječnik:** pretraga riječi, stanje (aktivna/neaktivna), povijest izmjena.
- **Statistika čekanja i botova** (`GET /admin/statistike/cekanje?dani=1|7|30|90`): živo stanje zastavica, fonda botova (slobodni/rezervirani/u partiji/iscrpljenja), brojači bota i treninga od pokretanja; tablica po danu i modu s prosjekom, medijanom i P95 čekanja ljudi te raspodjelom partija po broju botova (0/1/2/3); pobjede ljudi po sastavu stola; načini ispadanja botova. Tablice koriste `tablica-mobilni-retci` s hrvatskim `data-label`. Javni profil bota administratoru vraća `jeBot: true`; običan korisnik tu oznaku ne dobiva.

## 10. Statične stranice

- `/pomoc?tema=kako-igrati|pravila|nacini|bodovi|napredak|dnk|pristupacnost|pitanja` — pomoć kroz teme od prvog poteza do pravila, brojnosti rječnika, napretka, zasebnog vodiča za DNK i pristupačnost te praktičnog FAQ-a. Broj oblika po vrsti i jedinstveni ukupni broj dolaze iz `/api/rjecnik/statistika`; zbroj kategorija može biti veći od ukupnog broja jer jedan oblik može pripadati više vrsta. DNK vodič objašnjava što mjeri svaka os i što utječe na njezin rast. `/pravila` i `/o-igri` ostaju kompatibilni redirecti na odgovarajući sadržaj.
- Footer popup „O igri” — priča o imenu, rani pristup, **atribucija hrLexa** prema [izvor-i-licenca.md](../04-rjecnik/izvor-i-licenca.md#tekst-atribucije-za-stranicu-o-igri), statistika rječnika i kontakt; popup povezuje na Help hub.
- `/privatnost`, `/uvjeti` — pravni minimum (vidi [sigurnost-i-privatnost.md](../07-operacije/sigurnost-i-privatnost.md)).
- `/zahvala` — javna zahvalna stranica nakon registracije s navigacijom prema glavnim akcijama i stranici `/novosti`.
- `/novosti` — javna stranica s izdanjima, novim značajkama, prijedlozima za testiranje i poznatim ograničenjima.

## Responzivnost

- **Mobile-first** je jedini dizajnirani layout — sve komponente/ekrani grade se za portret mobilni zaslon.
- Svi širinski prijelazi koriste jedinstveni prag: `max-width: 999px` za mobilni prikaz i `min-width: 1000px` za desktop prikaz.
- **Desktop nije zaseban dizajn.** Cijeli sadržaj se centrira unutar kontejnera `max-width: 1000px; margin: 0 auto` — isti raspored, iste komponente, samo više praznog prostora lijevo/desno na širim ekranima. Ne graditi alternativne desktop-specifične rasporede (npr. sidebar, višestupčani grid) u v1.

### HTML tablice na mobitelu

- Svaka tablica zadržava stvarne elemente `<table>`, `<thead>`, `<tbody>` i zaglavlja `<th scope="col">` odnosno `<th scope="row">` gdje su primjenjiva. Zaglavlje se u presloženom prikazu skriva samo vizualno, ne uklanja iz pristupačnog stabla.
- Tablice s više stupaca na mobilnom prikazu preslažu retke pomoću opt-in klase `tablica-mobilni-retci` iz `app.css`. Primarni podatak retka ostaje vidljiv na vrhu. Svaka ostala vrijednosna ćelija (`<td>`) ima hrvatski `data-label` koji opisuje njezin stupac, primjerice `<td data-label="Bodovi">5</td>`; CSS prikazuje oznaku kroz `::before { content: attr(data-label) }`. Kod usporedbe modova oznaka mora navesti i mod ako bi sama mjera bila nejasna.
- Pregledne dvostupčane tablice mogu ostati vodoravne ako cijeli sadržaj stane i pri 320 px, dugim nazivima te povećanom fontu. Popise pojmova i objašnjenja prikazati kao `<dl>`, ne kao tablice. Ne skrivati bitne stupce, ne odrezivati vrijednosti i ne koristiti vodoravno pomicanje tablice ili stranice kao mobilno rješenje.
- Provjeriti 320, 360, 390, 768 i 999 px te desktop od 1000 px; obje teme, dugačke vrijednosti, povećan/disleksijski font, tipkovnicu i čitač zaslona. Uz širinu stranice provjeriti i širinu svake tablice ili omotača jer `overflow-x: clip` na stranici može prikriti odsječen sadržaj.
