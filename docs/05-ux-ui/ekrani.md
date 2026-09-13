# Specifikacija ekrana

Svi ekrani dizajniraju se **mobile-first (portret)**. Desktop **nije** zaseban layout — isti mobilni raspored se samo centrira unutar `max-width: 1000px` kontejnera (vidi [Responzivnost](#responzivnost) na dnu dokumenta). Ovdje je funkcionalna specifikacija — vizualni jezik definira [vizualni-identitet.md](vizualni-identitet.md).

## 0. Header / navigacija (trajna traka)

**Svrha:** stalna orijentacija — tko sam, brz pristup postavkama i pravilima. Prikazuje se na svim ekranima OSIM u čekaonici (`/red`) i u tijeku partije (`/partija/*`).

- **Lijevo:** ikone i labele navigacije u boji osnovnog teksta (narančasto istaknuto aktivno stanje, bez podcrtavanja) — **Početna** (🏠), **Pravila** (📖), **Ljestvice** (🏆), **Postavke** (⚙).
- **Desno:** avatar korisnika ili gosta. Pokraj avatara desno u boji naslova prikazano je ime samo za ulogirane registrirane korisnike, dok gosti imaju samo avatar (s tekstualnim napisom `GOST` unutar kružnog avatara). Klik na avatar vodi na `/profil`.

## 1. Landing (`/`)

**Svrha:** jedan pogled → odabir moda ili privatne sobe.

- Logotip + podnaslov: „Hrvatska igra riječi. IGRAJ mod po želji ili stvori svoju sobu."
- **Tipka IGRAJ** — otvara modalni prozor s izborom stola:
  - **4 Igrača (Klasični mod)** — vodi u čekaonicu za 4p (osvajaju se bodovi i rangovi).
  - **2 Igrača (1v1 Dvoboj)** — vodi u čekaonicu za 1v1 dvoboj (pobjednik nosi 1 bod).
  - Ispod gumba stoji objašnjenje: `*Glavni način igre gdje se osvajaju bodovi i rangovi`.
- **Tipka Privatna soba** — vodi na kreiranje privatne sobe po vlastitim pravilima s pozivnim linkom (bez ikone lokota). Ispod gumba stoji objašnjenje: `*Kreirate sobu po svojim pravilima i preko linka pozovete prijatelje`.
- Poveznice Prijavi se / Registriraj se za neotvorene sesije.

## 2. Red čekanja (`/red?mod=cetiri_igraca|dva_igraca`)

- Ovisno o odabranom modu (4p ili 1v1), čekaonica prikazuje 4 ili 2 kružna mjesta.
- Čim se skupe 4 (ili 2) igrača, pokreće se numerički countdown 3-2-1 i partija kreće.
- Gosti idu ravno u čekaonicu klikom na odabrani mod bez zapreka ili prompta za ime.

## 2a. Privatna soba (`/soba/kreiraj` i `/soba/[kod]`)

- Konfiguracija: najviše 8 igrača, tajmer poteza (15s, 30s, 60s ili Bez tajmera), bodovi za eliminacije te selektivne vrste riječi (imenice, pridjevi, glagoli, zamjenice, brojevi, prilozi, prijedlozi, veznici, čestice, usklici).
- Generira se kod sobe i pozivni link. Gosti i registrirani mogu ući kao gosti ili igrači.
- Soba živi u memoriji poslužitelja bez spremanja u bazu. Svaka igra je zasebna partija i počinje odmah; po završetku soba ostaje aktivna 5 minuta za novu partiju s istim postavkama.
- Iznad pravila sobe prikazuje se njezina kumulativna ljestvica: poredana je po osvojenim bodovima, zatim po pobjedama, a vodeći igrač dobiva krunu. Ti rezultati ne mijenjaju globalne ljestvice ni agregate igrača.
- Na sjedalima se igračima prikazuje **viši rang** (između 4p i 1v1 ranga).

## 3. Stol (`/partija/:id`) — srce igre

Raspored (portret):

- **Vrh:** četiri avatara u luku (protivnici) — krug, ime, značka ranga; eliminirani posive uz oznaku plasmana. Vlastito sjedalo, uključujući avatar, ime i status ispod njega, jedna je klikabilna cjelina koja otvara izbornik brzih poruka; protivnička sjedala nisu interaktivna.
- **Aktivni igrač:** cijelo sjedalo (avatar, ime i status) dobiva debeli zeleni zaobljeni okvir, ime je zeleno, a iznad sjedala stoji label „Na redu!”. Sva sjedala rezerviraju isti prostor za label kako se raspored ne bi pomicao. Oko avatara ide **zeleni prsten koji se prazni** sinkrono s 30-sekundnim odbrojavanjem (SVG stroke, izvor vremena `istekPotezaIso`), s brojem preostalih sekundi u sredini. Prsten napravi jedan jači vizualni puls kada igrač dobije red, uključujući prvi potez partije. Zadnjih 5 s prsten pulsira, a zadnje 3 s avatar se vrlo blago pomiče lijevo-desno. Tijekom sustavskog odabira riječi nema aktivnog okvira ni labela. **Slojevi oko avatara, redom od avatara prema van: avatar → timer prsten → rang-border prsten.** Timer prsten mora biti vizualno ispred (iznad) rang-bordera, ne iza njega — mora se vidjeti neovisno o rangu igrača.
- **Glavna zona igre:** prije prikaza sjedala prikazuje traženu riječ velikim slovima s posljednja **dva grafema otisnuta žutom kremom** (npr. medenj**AK** → traži se „ak"; k**ONJ** → traži se „onj", jer su o + nj dva grafema), prethodnu riječ i obavijest, zatim unos i gumb za slanje te statusne poruke. Sjedala igrača dolaze ispod kao sekundarni kontekst.
- **Otvaranje runde (sustav bira riječ):** na početku partije, nakon svake eliminacije i nakon kaladont-efekta prikazuje se **10-sekundni cjelozaslonski ekran** na svijetloj podlozi — sve ostalo (ploča, unos) nestaje. U prvoj rundi prikazuje se samo poruka da je sustav dodijelio početnu riječ. Nakon eliminacije prvo se prikazuje kratko neutralno objašnjenje razloga, uzročne riječi/traženih slova i osvojenog boda ako postoji, zatim tekst „Sustav će sada nasumično odabrati novu riječ..." s brojačem 10→0. Po isteku, ekran nestaje i ploča prikazuje otkrivenu riječ kao običan „zadnji potez" autora **Sustav** (isti prikaz kao za bilo koji odigrani potez), a igrač na potezu odgovara na nju kao na normalan nastavak.
- **Dno (zona na potezu):** polje za upis (autofokus, hrvatska tipkovnica, najviše 31 znak) i gumb pošalji. Na širini od 500 px naviše stoje u istom retku, pri čemu unos zauzima 70 %, a gumb 30 % širine; na užim zaslonima gumb je ispod unosa pune širine.
- **Zadnja riječ i izbornik brzih poruka:** zadnja prihvaćena riječ igrača prikazuje se kao jedan stabilan word bubble neposredno iznad avatara autora, s većim tekstom i narančasto istaknuta zadnja dva grafema. Bubble nestaje ili se premješta kada server prihvati novu igračku riječ; riječ sustava ostaje samo u glavnoj zoni igre. Ako je autor riječi eliminiran, njegov bubble nestaje. Duga riječ dobiva manji font na mobitelu kako bi layout ostao stabilan. Klik, Enter ili Space na **vlastitom sjedalu** otvara mali animirani izbornik s četiri predefinirane poruke (tekst + emoji, ne slobodan upis — izbjegava moderaciju): 👋 „Prijatno", 😅 „Nemoj zamjerit", 👏 „Bravo!", 😎 „Hvala". Reakcija se prikazuje ispod imena igrača, može biti vidljiva istodobno s word bubbleom i zatim nestane (1 po 2 s); rate limit je 1 poruka / 2 s.
- **Povijest poteza:** u prvoj izvedbi dostupna je nakon završetka partije, kako se tijekom brzog tijeka poteza ne bi prekidalo praćenje stola. Bočna ploha tijekom aktivne partije ostaje planirana nadogradnja.

| ---------------- | ------------------------------------------------------------------------------------------------------------------- |
| Odbijena riječ   | Polje se pri svakom odbijanju zatrese i kratko dobije crveni rub i podlogu + poruka razloga (crveno, 2 s) ispod zone akcija; vrijeme vidljivo teče dalje |
| Prihvaćena riječ | Riječ „odleti" na sredinu stola; red prelazi dalje                                                                  |
| Eliminacija      | Preko stola kratka kartica: „Ana je ispala — nema riječi na 'onj'!" + tko dobiva bod                                |
| Nova runda       | „Boris otvara novu rundu" + prsten na Borisu                                                                        |
| Ja eliminiran    | Kartica s razlogom; prelazim u promatranje                                                                          |
| Promatram        | Traka „Promatraš partiju"; poruke i povijest i dalje rade                                                          |

## 4. Kraj partije (`/partija/:id/kraj`)

- Redoslijed 1.– 4. s bodovima razloženim na plasman + eliminacije + bonus (npr. „3 + 2 + 1 = 6").
- Za mene: „Novi prosjek: 2,8 → **Lektor**" (registrirani) ili poruka za goste: „Ova statistika je spremljena lokalno u ovom pregledniku. Registriraj se da je zadržiš zauvijek!" (namjerno pojednostavljeno — tehnički je vezano uz gost-identitet ovog uređaja, ne doslovno preglednik, ali ovako je poruka jasnija igraču).
- Tipke: **Igraj opet** (u red), **Povijest partije**, Na početnu.

## 5. Povijest partije (`/partija/:id/povijest`)

- Kronološki popis: runda, igrač, riječ (ili „Ne znam"/istek/prekid), tražena slova, trajanje razmišljanja.
- Uz svaki potez gumb **„Prijavi grešku"** → obrazac s porukom (potez i partija vežu se automatski).
- U prvoj izvedbi dostupno trajno nakon završetka partije. Bočna ploha tijekom aktivne partije planirana je za kasniju nadogradnju.

## 6. Registracija / Prijava (`/registracija` i `/prijava`)

- Registracija: višekoračni tijek (1. Korak: nadimak; 2. Korak: email, lozinka, odabir avatara). Kod email polja diskretna napomena: „Na tvoju email adresu nećemo slati nikakve obavijesti, isključivo je koristimo kako bi ti omogućili pristup računu ako zaboraviš lozinku."
- Prijava: jednostavna prijava u dva odvojena retka (Email i Lozinka) s velikim zelenim gumbom.

## 7. Profil (`/profil`) — samo vlastiti

- Sadrži tabove **4 Igrača** i **2 Igrača (1v1)** s odvojenim karticama statistike (`Odigrane`, `Pobjede`, `Ukupno bodova`, `Prosjek`, `Eliminacije`, `Rang`).
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
- Prebacivanje tabova bez ponovnog učitavanja cijele stranice (isti header/podnožje); učitana proširena lista (100) pamti se dok je tab otvoren, ne treba ponovno učitavati pri povratku na isti tab.

## 9. Admin (`/admin`) — zaštićena uloga

- **Prijave:** tablica s filtrima po statusu; klik otvara povijest partije s označenim spornim potezom; akcije: dodaj riječ / deaktiviraj riječ / dodaj iznimku digrafa / odbij — sve uz obaveznu napomenu.
- **Rječnik:** pretraga riječi, stanje (aktivna/neaktivna), povijest izmjena.

## 10. Statične stranice

- `/pravila` — pravila igre razumljivim jezikom (izvor: [pravila-igre.md](../02-pravila-igre/pravila-igre.md)): cilj igre (ime "Kaladont" objašnjeno), postava (4 igrača), tijek partije, uvjeti valjane riječi, ispadanje (4 načina + razlika "mrtvih slova"), bodovanje ukratko (link na [bodovanje-i-rangovi.md](../02-pravila-igre/bodovanje-i-rangovi.md)), komunikacija (4 brze poruke).
- `/o-igri` — priča o imenu (paste za zube, "nt" bez nastavka), **poruka o ranom pristupu**: igra je u ranom pristupu ("early access"), aktivno se testira i nadograđuje; **uvijek besplatna, bez reklama**; poveznica na javno čitljiv forum `https://forum.kaladont.hr` za dogovore i mišljenja te objašnjenje da se rječničke presude prijavljuju gumbom „Prijavi” u igri. Uz to obavezna **atribucija hrLexa** — točan tekst iz [izvor-i-licenca.md](../04-rjecnik/izvor-i-licenca.md#tekst-atribucije-za-stranicu-o-igri) mora biti citiran doslovno, ne parafraziran. Kontakt na dnu.
- `/privatnost`, `/uvjeti` — pravni minimum (vidi [sigurnost-i-privatnost.md](../07-operacije/sigurnost-i-privatnost.md)).

## Responzivnost

- **Mobile-first** je jedini dizajnirani layout — sve komponente/ekrani grade se za portret mobilni zaslon.
- **Desktop nije zaseban dizajn.** Cijeli sadržaj se centrira unutar kontejnera `max-width: 1000px; margin: 0 auto` — isti raspored, iste komponente, samo više praznog prostora lijevo/desno na širim ekranima. Ne graditi alternativne desktop-specifične rasporede (npr. sidebar, višestupčani grid) u v1.
