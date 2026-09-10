# Specifikacija ekrana

Svi ekrani dizajniraju se **mobile-first (portret)**. Desktop **nije** zaseban layout — isti mobilni raspored se samo centrira unutar `max-width: 1000px` kontejnera (vidi [Responzivnost](#responzivnost) na dnu dokumenta). Ovdje je funkcionalna specifikacija — vizualni jezik definira [vizualni-identitet.md](vizualni-identitet.md).

## 0. Header / navigacija (trajna traka)

**Svrha:** stalna orijentacija — tko sam, koji mi je status, brz pristup postavkama. Prikazuje se na svim ekranima OSIM landinga i registracije/prijave (koji imaju vlastiti minimalni zaglavni prostor).

- **Lijevo:** pozdrav — „Bok, Ana" (registriran) ili „Igraš kao gost" (gost, bez imena jer nadimak je nasumičan i nebitan gostu).
- **Sredina/desno:** avatar (s automatskim rang-borderom za registrirane; gost avatar nosi diskretnu oznaku „GOST", bez bordera).
- **Rang bedž** uz avatar (samo registrirani, nakon kalibracije od 10 partija; gosti i igrači u kalibraciji nemaju bedž).
- **Brzi link** na `/ljestvica`.
- **Gumb postavki** (ikona zupčanika) → otvara `/postavke` (izbor avatara za registrirane; gostu prikazuje samo poziv na registraciju).
- **Audio kontrola:** diskretna ikona mute/unmute i klizač glasnoće; postavka je lokalna po browseru/uređaju. Pravila i matrica događaja su u [zvukovi.md](zvukovi.md).

## 1. Landing (`/`)

**Svrha:** jedan pogled → jedan klik → igra. Dvije varijante ovisno o statusu prijave.

**Gost (nije prijavljen):**

- Logotip + podnaslov: „Hrvatska igra riječi. Četvero za stolom, 30 sekundi po potezu."
- **Velika tipka IGRAJ** — dominira ekranom, vodi ravno u red čekanja kao gost.
- U ranom pristupu uz igru je vidljiva poveznica „Pridruži se zajednici” na `https://forum.kaladont.hr` i kratka poruka da se igra aktivno testira. Poveznica ne blokira niti uvjetuje ulazak u red.
- Diskretno ispod: „Prijavi se" / „Registriraj se" i tri retka pravila u slikovnicama (riječ na zadnja dva slova → 30 sekundi → zadnji preživjeli pobjeđuje).

**Registriran (prijavljen):**

- Isti logotip + IGRAJ gumb.
- Umjesto „Prijavi se/Registriraj se": **ikona postavki (zupčanik) + tekst „Postavke"** — link na `/postavke`.
- **Rotirajući hint tekst** ispod IGRAJ gumba — pri svakom učitavanju stranice nasumično prikazuje jednu od nekoliko kratkih činjenica o bodovanju/rangovima (izvor istine: [bodovanje-i-rangovi.md](../02-pravila-igre/bodovanje-i-rangovi.md), ne izmišljati nove brojke ovdje). Primjeri hint tekstova:
  - „Prosjek bodova po partiji jedina je metrika ranga — očekivani prosjek je 2,5."
  - „Savršena partija nosi 7 bodova: pobjeda + bonus + sve 3 eliminacije."
  - „Od 11. partije rang se računa iz prosjeka bodova — prvih 10 igraš kao Piskaralo."
  - „Najviši rang zove se Kaladont — prosjek 5,70 ili više."

- Podnožje (obje varijante): poveznice **Pravila**, **O igri**, Ljestvica, Privatnost, Uvjeti i **Zajednica** — vode na stvarne rute (`/pravila`, `/o-igri`, `/ljestvica`, `/privatnost`, `/uvjeti`) odnosno `https://forum.kaladont.hr`. Vanjska poveznica ima pristupačni naziv koji navodi da otvara forum Kaladonta.
- **Statistika rječnika (obje varijante):** blok ispod IGRAJ gumba — ukupan broj riječi + broj oblika po kategoriji (imenice, glagoli, pridjevi…), **sortirano silazno po broju oblika**. Podaci s `GET /rjecnik/statistika` (javno, bez tokena); ako dohvat ne uspije, blok se jednostavno ne prikazuje. Vidljivo gostu i registriranom.
- SSR (SEO za „kaladont igra" upite).
- Nakon naknadne konfiguracije Umamija anonimno se bilježe klik na IGRAJ i klikovi na forumsku poveznicu s landinga i stranice „O igri”, bez identifikatora korisnika. Umami nije preduvjet javnog starta.

## 2. Red čekanja (`/red`)

**Svrha:** pretvoriti čekanje u iščekivanje — igrač mora _vidjeti_ da se stol puni.

- Četiri kružna mjesta oko praznog stola; svako popunjeno mjesto **odmah** dobiva avatar, ime i **punu statistiku** pridošlog igrača (rang, prosjek bodova, % pobjeda — isti podaci kao na ljestvici) uz suptilnu animaciju. Igrači u kalibraciji prikazuju „Piskaralo" umjesto ranga.
- Tekst stanja: „Čekamo još N igrača…"
- **Prosječno čekanje: ~X s** (prosjek zadnjih 100 partija) — postavlja realna očekivanja.
- Gumb „Odustani" vraća na landing — **bez potvrde** (nema još posljedica dok stol nije popunjen).
- Kad sjedne četvrti: **numerički countdown 3-2-1** preko cijelog ekrana (zamjenjuje stariju statičnu poruku) → tek nakon countdowna prijelaz na stol. Countdown daje svim igračima trenutak da se priprave prije prvog poteza.
- Audio: klik na `IGRAJ`/ulazak u sobu i ulazak/izlazak igrača koriste suptilne zajedničke signale; samo zadnje tri sekunde countdowna imaju ton.

## 3. Stol (`/partija/:id`) — srce igre

Raspored (portret):

- **Vrh:** četiri avatara u luku (protivnici) — krug, ime, značka ranga; eliminirani posive uz oznaku plasmana. Vlastito sjedalo, uključujući avatar, ime i status ispod njega, jedna je klikabilna cjelina koja otvara izbornik brzih poruka; protivnička sjedala nisu interaktivna.
- **Aktivni igrač:** oko njegova avatara **crveni prsten koji se prazni** sinkrono s 30-sekundnim odbrojavanjem (SVG stroke, izvor vremena `istekPotezaIso`). Prsten napravi jedan jači vizualni puls kada igrač dobije red, uključujući prvi potez partije. Zadnjih 5 s prsten pulsira, a zadnje 3 s avatar se vrlo blago pomiče lijevo-desno. **Slojevi oko avatara, redom od avatara prema van: avatar → crveni timer prsten → rang-border prsten.** Timer prsten mora biti vizualno ispred (iznad) rang-bordera, ne iza njega — mora se vidjeti neovisno o rangu igrača.
- **Sredina stola:** prethodna riječ velikim slovima s posljednja **dva grafema otisnuta žutom kremom** (npr. medenj**AK** → traži se „ak"; k**ONJ** → traži se „onj", jer su o + nj dva grafema) + natpis „Riječ na: ONJ". Tekstualni opis odigrane riječi i obavijesti o eliminaciji prikazuju se ispod zone akcija kako ne bi pomicali unos.
- **Otvaranje runde (sustav bira riječ):** na početku partije, nakon svake eliminacije i nakon kaladont-efekta prikazuje se **5-sekundni cjelozaslonski ekran** na svijetloj podlozi — sve ostalo (ploča, unos) nestaje. Sadržaj: obrazloženje zadnje eliminacije (ako postoji, ista rečenica kao inače uz eliminaciju), zatim tekst „Sustav će sada nasumično odabrati novu riječ..." s brojačem 5→0 (obavezan brojač ili loading indikator). Po isteku, ekran nestaje i ploča prikazuje otkrivenu riječ kao običan „zadnji potez" autora **Sustav** (isti prikaz kao za bilo koji odigrani potez), a igrač na potezu odgovara na nju kao na normalan nastavak.
- **Dno (zona na potezu):** polje za upis (autofokus, hrvatska tipkovnica, najviše 31 znak) i gumb pošalji. Na širini od 500 px naviše stoje u istom retku, pri čemu unos zauzima 70 %, a gumb 30 % širine; na užim zaslonima gumb je ispod unosa pune širine.
- **Izbornik brzih poruka:** klik, Enter ili Space na **vlastitom sjedalu** otvara mali animirani izbornik s četiri predefinirane poruke (tekst + emoji, ne slobodan upis — izbjegava moderaciju): 👋 „Prijatno", 😅 „Nemoj zamjerit", 👏 „Bravo!", 😎 „Hvala". Opcije su prikazane jedna ispod druge radi čitljivosti. Izabrana poruka doleti iznad avatara pošiljatelja i nakratko podigne njegov avatar, zatim nestane (1 po 2 s); rate limit je 1 poruka / 2 s.
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

## 6. Registracija / Prijava (`/racun`)

- Registracija: email, lozinka, nadimak (ako je gost imao statistiku — jasna poruka: „Tvoja dosadašnja statistika ostaje uz tebe"). Kraj email polja diskretna napomena: „Email koristimo isključivo za pristup računu (npr. zaboravljena lozinka) — nema newslettera, nema reklamnih poruka."
- Potvrda emaila poveznicom; prijava standardna; „Zaboravljena lozinka" tok.

## 7. Profil (`/profil`) — samo vlastiti

- Rang sa značkom + prosjek bodova; napredak do sljedećeg ranga.
- Statistika: partije, pobjede (%), eliminacije po partiji, ukupni bodovi.
- Zadnjih 10 partija s plasmanom → poveznice na povijesti.
- Kalibracija: „Još X partija do ranga" (dok je Piskaralo).

## 7a. Postavke (`/postavke`) — samo registrirani

- **Izbor avatara:** ponuđeni avatari iz statičkog kataloga slika, klik odmah sprema (`PUT /profil/avatar`) i odmah ažurira prikaz bez ručnog osvježavanja.
- **Border** se NE bira ovdje — prikazan je informativno („Trenutni border: Riječarac — sljedeći se otključava na rangu Jezičar") jer se dodjeljuje automatski prema trenutnom rangu.
- **Povijest partija:** popis proteklih partija (plasman, bodovi, datum) — isti podaci kao trenutno na `/povijest`, ovdje dostupno kao dio jednog panela za upravljanje računom.
- **Detaljna statistika:** partije, pobjede (%), eliminacije po partiji, ukupni bodovi, prosjek, trenutni rang i napredak do sljedećeg (isti podaci kao `/profil`, konsolidirano ovdje).
- **Promjena emaila:** polje + potvrda trenutnom lozinkom — nova adresa zahtijeva ponovnu potvrdu emailom prije nego postane aktivna (`PUT /profil/email`).
- **Promjena lozinke:** trenutna lozinka + nova lozinka (min. 8 znakova) (`PUT /profil/lozinka`).
- Gost koji dođe na ovu rutu vidi samo poziv na registraciju umjesto cijelog panela.

## 8. Ljestvica (`/ljestvica?tab=igraci|rijeci`)

Dva taba unutar iste rute — jedan mentalni koncept "ljestvice", ne dvije odvojene stranice. **Lijeno učitavanje**: zadano se dohvaća i prikazuje samo top 10; puna top 100 lista dohvaća se tek na zahtjev.

- **Tab „Igrači" (zadano):** Top 10 zadano: mjesto, nadimak, značka ranga, prosjek bodova, partije, % pobjeda (min. 10 partija). **„Tvoje mjesto"** prikazano je uvijek (posebni redak ispod top liste ili istaknuto unutar nje ako si već u top 10), čak i ako nisi u trenutno prikazanom dijelu liste. Ispod top 10, gumb **„Učitaj do 100"** — klik okida novi upit prema `GET /ljestvica?limit=100`, prikazuje loading indikator dok traje, zatim proširuje listu na puni top 100. Prazno stanje: „Odigraj 10 partija da uđeš na ljestvicu."
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
