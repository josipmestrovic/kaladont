# Specifikacija ekrana

Svi ekrani dizajniraju se **mobile-first (portret)**. Većina desktop prikaza centrira isti sadržaj unutar `max-width: 1000px` kontejnera; naslovnica je namjerna iznimka s dvije kolone na desktopu i jednom kolonom na mobitelu. Ovdje je funkcionalna specifikacija — vizualni jezik definira [vizualni-identitet.md](vizualni-identitet.md).

## 0. Header / navigacija (trajna traka)

**Svrha:** brz pristup novostima, povratku i profilu. Prikazuje se na svim ekranima OSIM u čekaonici (`/red`) i na cijeloj ruti partije (`/partija/*`), uključujući završni poredak.

- Traka je potpuno transparentna, bez donjeg obruba i bez sjene, tako da se vizualno stapa s pozadinom stranice.
- **Lijevo na naslovnici:** poveznica **Što je novo?** na `/novosti`, oblikovana s notebook ikonom iznad i tekstom ispod. Ikona je zadano boje `#1a1815`, a pri hoveru/fokusu ikona i tekst postaju narančasti. Ukupna visina ikone, razmaka i teksta iznosi 80 px.
- **Lijevo na svim drugim stranicama s headerom:** klikabilna narančasta povratna strelica s tekstom „Nazad”, koja koristi povijest preglednika. Ako prethodna ruta nije root `/` ili nije poznata, uz nju se prikazuje `GiFastBackwardButton` s tekstom „Početna” i poveznicom na `/`. Obje akcije preslikavaju uzorak „Što je novo?”: ikona 59 × 59 px, ukupna visina 80 px te ista veličina i težina fonta na desktopu i mobitelu.
- **Desno:** avatar korisnika ili gosta i njegov nadimak u horizontalnom rasporedu na desktopu i mobitelu; klik vodi na `/profil`. Avatar je povećan tako da njegova visina odgovara ukupnoj visini notebook ikone i teksta „Što je novo?”. Dugi nadimak skraćuje se elipsom umjesto širenja headera.
- **Naslovnica, registrirani korisnik:** uz „Što je novo?” prikazuje se akcija **Pomozi poboljšati igru** (`/povratne-informacije`) s `GiTeamIdea` ikonom iznad teksta. Ima potpuno iste dimenzije, tipografiju i hover/focus ponašanje kao notebook akcija. Gosti je ne vide.
- **Admin:** ispod glavnog headera vidi dodatnu navigaciju sa svim admin površinama: **Rječnik**, **Prijave** i **Mišljenja korisnika**. Ta navigacija je samo pogodnost; server zasebno štiti svaku admin rutu.

## 1. Landing (`/`)

**Svrha:** jedan pogled → odabir glavne akcije ili informativne stranice.

- Ilustracija Kaladonta nije prikazana ni na desktopu ni na mobitelu. Naslov i navigacija centrirani su u jednoj koloni po sredini ekrana.
- Iznad glavnog naslova stoji „Hrvatska online igra riječi”, a H1 vrlo velikim slovima prikazuje „KALADONT multiplayer”. Oznaka verzije nije prikazana. Naslov i navigacija nalaze se u gornjoj polovici dostupnog prostora.
- Uža glavna navigacija ima osnovne retke **Igraj**, **Pravila**, **Ljestvica** i **Moja statistika**. „Moja statistika” vodi na zadani statistički prikaz `/profil#statistika`. Sekundarne stavke imaju tamni standardni tekst i ikone, zelenu strelicu te tekst lijevo poravnat uz ikonu.
- Glavna navigacija koristi vlastite SVG assete: `GiToothbrush` za Igraj, `GiSpellBook` za Pravila, `GiHoleLadder` za Ljestvicu, `GiGamepad` za Moju statistiku, `GiAutoRepair` za Postavke, `GiExitDoor` za Odjavu te `GiTwoShadows` za Prijavu i Registraciju. Modal igre koristi `GiLevelTwoAdvanced`, `GiLevelFourAdvanced` i `GiLockedDoor`.
- Registrirani korisnik dodatno vidi **Postavke** (`/postavke`, uz preusmjeravanje i scroll na `/profil?tab=postavke#postavke`) i blago narančastu akciju **Odjavi se**. Gost ne vidi Postavke ni Odjavu, nego uzastopno vidi **Prijavi se** i ispod nje **Registriraj se**.
- **Igraj** otvara modal sa slijedom: **2 igrača** (`/red?mod=dva_igraca`), **4 igrača** (`/red?mod=cetiri_igraca`) i **Privatna soba** (`/soba/kreiraj`). Modal zamućuje pozadinu.
- **Pravila** vode na `/pravila`, a **Ljestvica** na `/ljestvica`.
- **Uvjeti i privatnost** nalazi se u footeru na dnu naslovnice i otvara modal bez ikona i nadnaslova, s naslovom „Što te zanima?” te dvije tekstualne opcije s kratkim opisima: **Uvjeti korištenja** (`/uvjeti`) i **Pravila privatnosti** (`/privatnost`).
- Zaseban red poveznica Prijavi se / Registriraj se ispod navigacije ne prikazuje se; te su akcije dio jedinstvene navigacije gosta.

## 2. Red čekanja (`/red?mod=cetiri_igraca|dva_igraca`)

- Ovisno o odabranom modu (4p ili 1v1), čekaonica prikazuje 4 ili 2 kružna mjesta.
- Čim se skupe 4 (ili 2) igrača, pokreće se numerički countdown 3-2-1 i partija kreće.
- Gosti idu ravno u čekaonicu klikom na odabrani mod bez zapreka ili prompta za ime.

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
- **Aktivni igrač:** cijelo sjedalo (avatar, ime i status) dobiva debeli zeleni zaobljeni okvir, ime je zeleno, a iznad sjedala stoji label „Na redu!”. Sva sjedala rezerviraju isti prostor za label kako se raspored ne bi pomicao. Oko avatara ide **zeleni prsten koji se prazni** sinkrono sa stvarnim trajanjem poteza (15, 30 ili 60 sekundi u privatnoj sobi; SVG stroke, rok `istekPotezaIso`, serverov clock anchor `serverVrijemeIso`), s brojem preostalih sekundi u sredini. Prsten napravi jedan jači vizualni puls kada igrač dobije red, uključujući prvi potez partije. Zadnjih 5 s prsten pulsira, a zadnje 3 s avatar se vrlo blago pomiče lijevo-desno. Tijekom sustavskog odabira riječi nema aktivnog okvira ni labela. **Slojevi oko avatara, redom od avatara prema van: avatar → timer prsten → rang-border prsten.** Timer prsten mora biti vizualno ispred (iznad) rang-bordera, ne iza njega — mora se vidjeti neovisno o rangu igrača.
- **Glavna zona igre:** prije prikaza sjedala prikazuje traženu riječ velikim slovima s posljednja **dva grafema otisnuta žutom kremom** (npr. medenj**AK** → traži se „ak"; k**ONJ** → traži se „onj", jer su o + nj dva grafema), prethodnu riječ i obavijest, zatim unos i gumb za slanje te statusne poruke. Sjedala igrača dolaze ispod kao sekundarni kontekst.
- **Otvaranje runde (sustav bira riječ):** na početku partije, nakon svake eliminacije i nakon kaladont-efekta prikazuje se **10-sekundni cjelozaslonski ekran** na svijetloj podlozi — sve ostalo (ploča, unos) nestaje. U prvoj rundi prikazuje se samo poruka da je sustav dodijelio početnu riječ. Nakon eliminacije prvo se prikazuje kratko neutralno objašnjenje razloga, uzročne riječi/traženih slova i osvojenog boda ako postoji, zatim tekst „Sustav će sada nasumično odabrati novu riječ..." s brojačem 10→0. Po isteku, ekran nestaje i ploča prikazuje otkrivenu riječ kao običan „zadnji potez" autora **Sustav** (isti prikaz kao za bilo koji odigrani potez), a igrač na potezu odgovara na nju kao na normalan nastavak.
- **Dno (zona na potezu):** polje za upis (autofokus, hrvatska tipkovnica, najviše 31 znak) i gumb pošalji. Na širini od 500 px naviše stoje u istom retku, pri čemu unos zauzima 70 %, a gumb 30 % širine; na užim zaslonima gumb je ispod unosa pune širine. Gumb „Ne znam” je sekundaran i prije predaje poteza otvara potvrdu unutar aplikacije.
- **Zadnja riječ i izbornik brzih poruka:** zadnja prihvaćena riječ igrača prikazuje se kao jedan stabilan word bubble neposredno iznad avatara autora, s većim tekstom i narančasto istaknuta zadnja dva grafema. Bubble nestaje ili se premješta kada server prihvati novu igračku riječ; riječ sustava ostaje samo u glavnoj zoni igre. Ako je autor riječi eliminiran, njegov bubble nestaje. Duga riječ dobiva manji font na mobitelu kako bi layout ostao stabilan. Klik, Enter ili Space na **vlastitom sjedalu** otvara mali animirani izbornik s četiri predefinirane poruke (tekst + emoji, ne slobodan upis — izbjegava moderaciju): 👋 „Prijatno", 😅 „Nemoj zamjerit", 👏 „Bravo!", 😎 „Hvala". Reakcija se prikazuje ispod imena igrača, može biti vidljiva istodobno s word bubbleom i zatim nestane (1 po 2 s); rate limit je 1 poruka / 2 s.
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

## 5. Prijava riječi (`/partija/:id/povijest`)

- Prikaz odigranih riječi iz završene javne ili privatne partije.
- Uz svaku riječ gumb **„Prijavi riječ"**; prijava se šalje bez dodatnog teksta i može se poslati najviše tri puta po sudioniku i partiji.
- U prvoj izvedbi dostupno trajno nakon završetka partije. Bočna ploha tijekom aktivne partije planirana je za kasniju nadogradnju.

## 6. Registracija / Prijava (`/registracija` i `/prijava`)

- Registracija: višekoračni tijek (1. Korak: nadimak; 2. Korak: email, lozinka, odabir avatara). Kod email polja diskretna napomena: „Na tvoju email adresu nećemo slati nikakve obavijesti, isključivo je koristimo kako bi ti omogućili pristup računu ako zaboraviš lozinku."
- Prijava: jednostavna prijava u dva odvojena retka (Email i Lozinka) s velikim zelenim gumbom.
- Nakon uspješne registracije korisnik dolazi na javnu stranicu `/zahvala` s čestitkom, nenametljivim konfetima i izborom sljedeće akcije: javna igra za 2 ili 4 igrača, privatna soba, pravila, profil, postavke, ljestvice ili zasebna stranica novosti `/novosti`.

## 7. Profil (`/profil`) — vlastiti i javni

- Vlastiti profil u gornjem desnom bloku više ne ponavlja akcije Postavke i Odjavi se jer su dostupne na naslovnici. **Prosječna ocjena** i **Stil igre** ostaju u svom dosadašnjem informativnom bloku, s nepromijenjenom tipografijom i vizualnim stilom.
- Vlastiti profil sadrži tabove **4 Igrača** i **2 Igrača (1v1)** s odvojenim karticama rezultata (`Odigrane`, `Pobjede`, `Ukupno bodova`, `Prosjek`, `Eliminacije`, `Rang`).
- Odjeljak „Riječi i streak” zajednički je za oba javna moda; promjena taba ne mijenja te brojke. Privatne sobe se ne računaju.
- Registrirani igrači imaju javni read-only profil, primjerice `/profil/javni/:igracId`. Javni profil prikazuje nadimak, avatar, rang, rezultate, gamifikacijske statistike, najdužu i najrjeđu riječ, ali nikad email ili podatke za autentikaciju. Gosti nemaju javni profil.
- Profil prikazuje mode-specific DNK naslove (`Kaladont DNK 4 igrača` i `Kaladont DNK 2 igrača`). Ispod DNK grafa prikazuje mode-specific statistike: eliminacije po partiji, niz prihvaćenih riječi, prosjek prihvaćenog poteza, duge riječi po partiji i rijetke riječi po partiji.
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
- Registrirani igrači vide izbor avatara, izmjenu email adrese i lozinke.
- Gosti vide obavijest da su napredne postavke rezervirane za registrirane korisnike uz gumb za registraciju.

## 8. Ljestvica (`/ljestvica?tab=igraci|rijeci`)

Dva taba unutar iste rute — jedan mentalni koncept "ljestvice", ne dvije odvojene stranice.
- Pod-tabovi **4 Igrača** i **2 Igrača (1v1)** omogućuju neovisni pregled ljestvice po modovima.
- **Zadano učitavanje:** prikazuje top 10 igrača, uz gumb "Učitaj do 100" koji dohvaća cijelu top 100 listu s poslužitelja.
- **Tab „Riječi":** Top 10 zadano najučestalijih odigranih riječi u svim partijama (stvarna upotreba iz `potezi`, ne statička frekvencija iz uvoznog korpusa). Stupci: mjesto, riječ (WordChip s istaknuta zadnja dva grafema), broj upotreba, % partija u kojima se pojavila. Isti gumb **„Učitaj do 100"** s loading indikatorom — nema koncepta „tvoje riječi" pa nema dodatnog retka.
- Tab „Igrači" vraća identitet igrača samo za registrirane profile. Nadimak/avatar vode na javni profil. Linkovi se ne prikazuju u lobbyju ni tijekom aktivne partije; na završnom sažetku partije profili sudionika mogu biti otvoreni.
- Prebacivanje tabova bez ponovnog učitavanja cijele stranice (isti header/podnožje); učitana proširena lista (100) pamti se dok je tab otvoren, ne treba ponovno učitavati pri povratku na isti tab.

## 9. Admin (`/admin`) — zaštićena uloga

- **Prijave:** tablica s filtrima po statusu; klik otvara povijest partije s označenim spornim potezom; akcije: dodaj riječ / deaktiviraj riječ / dodaj iznimku digrafa / odbij — sve uz obaveznu napomenu.
- **Rječnik:** pretraga riječi, stanje (aktivna/neaktivna), povijest izmjena.

## 10. Statične stranice

- `/pomoc?tema=kako-igrati|pravila|nacini|bodovi|napredak|pitanja` — pomoć kroz šest tema, od prvog poteza do pravila, načina igre, rangova, napretka i praktičnog FAQ-a. `/pravila` i `/o-igri` ostaju kompatibilni redirecti na odgovarajući sadržaj.
- Footer popup „O igri” — priča o imenu, rani pristup, **atribucija hrLexa** prema [izvor-i-licenca.md](../04-rjecnik/izvor-i-licenca.md#tekst-atribucije-za-stranicu-o-igri), statistika rječnika i kontakt; popup povezuje na Help hub.
- `/privatnost`, `/uvjeti` — pravni minimum (vidi [sigurnost-i-privatnost.md](../07-operacije/sigurnost-i-privatnost.md)).
- `/zahvala` — javna zahvalna stranica nakon registracije s navigacijom prema glavnim akcijama i stranici `/novosti`.
- `/novosti` — javna stranica s izdanjima, novim značajkama, prijedlozima za testiranje i poznatim ograničenjima.

## Responzivnost

- **Mobile-first** je jedini dizajnirani layout — sve komponente/ekrani grade se za portret mobilni zaslon.
- **Desktop nije zaseban dizajn.** Cijeli sadržaj se centrira unutar kontejnera `max-width: 1000px; margin: 0 auto` — isti raspored, iste komponente, samo više praznog prostora lijevo/desno na širim ekranima. Ne graditi alternativne desktop-specifične rasporede (npr. sidebar, višestupčani grid) u v1.
