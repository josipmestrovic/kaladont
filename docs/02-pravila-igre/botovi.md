# Botovi i Zagrijavanje — pravila ponašanja

Dopuna [pravila igre](pravila-igre.md) prema [ADR-017](../03-arhitektura/odluke/017-botovi-i-zagrijavanje.md). Vrijedi za javne partije s botovima i za trening.

## Popuna javnog reda

Vrijeme se računa na poslužitelju od `usaoU` **najstarijeg prisutnog čovjeka** u nepotpunoj grupi. Bot nikada nije vremensko polazište; dolazak novog čovjeka ne resetira čekanje ostalih.

U redovnom radu prag Dvoboja izvlači se između 26 i 34 s, a pragovi Četveroboja između 17–23, 27–33 i 37–43 s. Odstupanja se izvlače jednom po epizodi čekanja, ne na svakom osvježavanju; tablica navodi njihove središnje vrijednosti. Kada red postane prazan ili grupa započne igru, sljedeća epizoda dobiva novi raspored.

| Situacija | Ponašanje |
| --- | --- |
| Dvoboj, jedan čovjek | Čeka do 30 s; na 30 s slobodan bot popunjava mjesto. |
| Dvoboj, drugi čovjek stigne prije pokretanja | Igraju dva čovjeka; rezervirani bot se oslobađa. |
| Četveroboj, 3 čovjeka | Jedan bot na 20 s i početak. |
| Četveroboj, 2 čovjeka | Bot na 20 s; drugi na 30 s i početak. |
| Četveroboj, 1 čovjek | Botovi na 20 s, 30 s i 40 s; početak na 40 s. |
| Četveroboj, 4 čovjeka | Početak odmah. |
| Novi ljudi između pragova | Popune mjesta; početak čim je grupa puna. |
| Najstariji čovjek ode | Rokovi se računaju prema sljedećem najstarijem; višak rezerviranih botova se oslobađa. |
| Posljednji čovjek ode | Sve rezervacije grupe se oslobađaju. |
| Nema slobodnog bota | Čeka se dalje; ponovno se razmatra kad se bot oslobodi. |

Pragovi daju kumulativno najviše 1/2/3 bota u Četveroboju i 1 u Dvoboju, dodatno ograničeno slobodnim mjestima i fondom. Nova javna partija ne nastaje bez barem jednog čovjeka. Nakon pokretanja partije nema zamjene sudionika.

Rezervirani bot prikazuje se u čekaonici kao sudionik koji čeka od trenutka rezervacije. Pri početku partije čekaonica preuzima puna sjedala iz serverske poruke početka, tako da tijekom odbrojavanja prikazuje i konačne botove. Prikaz ne mijenja autoritativne rokove.

Namjera čovjeka da čeka prati se odvojeno od članstva u socket sobi. Neuspješan početak vraća samo još povezane ljude s istom generacijom ulaska, bez promjene izvornog vremena čekanja. Izlazak ili promjena konteksta poništava namjeru; ponavljanje neuspjelog početka ima ograničen odmak, ne trenutačnu petlju.

## Pravila za bota u partiji

Tehnički oporavak dopušta najviše dva ponovna pokušaja nakon početnog pokušaja za isti token. Svaki pokušaj provjerava aktualno stanje motora; uspješan potez ne ponavlja se. Odbijena riječ izuzima se iz sljedećeg izbora. Trajni kvar prekida igru bez dodjele pobjede ili natjecateljskih nagrada, ne pretvara se u „Ne znam”.

Samo u lokalnom razvojnom okruženju (`NODE_ENV=development`), radi bržeg testiranja javnog Dvoboja i Četveroboja, sva potrebna mjesta popunjavaju se botovima nakon 1 s čekanja, a javni botovi odigravaju nakon 2 s bez namjernog isteka. `BOTOVI_BRZI_RAZVOJ=false` vraća realni tempo i odstupanja popune. Popuna i dalje mora biti uključena za pojedini mod. Trening ostaje bez timera s odgovorom nakon 1–3 s. Staging i produkcija zadržavaju redovne pragove i tempo; `test` ne koristi slučajna odstupanja popune. Eksplicitni pragovi pojedinačnih testova imaju prednost.

- Bot igra po **istim pravilima** kao čovjek: isti potez, timer, validacija, leksemske grupe, eliminacija i Kaladont-efekt. Potezi ljudi i botova prolaze istu obradu na poslužitelju.
- Bot koristi **cijeli aktivni rječnik** dopušten pravilima partije. Nema legalne riječi koja je trajno nedostupna zbog položaja u popisu.
- **Nenapadačka politika:** bot ne traži mrtve nastavke, ne gleda protivnikove mogućnosti i ne bira riječ prema broju protivnikovih nastavaka. Slučajan mrtvi nastavak smije se dogoditi. Pravilo je isto neovisno o tome je li sljedeći igrač čovjek ili bot.
- **Izbor riječi (politika v3):** prvo se filtriraju „poznate” riječi (isključene su jako rijetke i one od 15+ grafema; duljine 10–14 imaju jači soft ponder). Među poznatim uobičajenim osnovnim oblicima zadano 90 % bira imenicu, a 10 % glagol ili pridjev. Oblik jednak lemi koristi se kao aproksimacija nominativa jednine / infinitiva / osnovnog pridjeva. Ako poželjnih nema, potez se broji kao težak (moguće „Ne znam”); bot ne pada na stručne/jako rijetke oblike. Unutar odabrane skupine svi kandidati imaju pozitivan ponder frekvencije i duljine. Sve izabrane riječi prolaze postojeću serversku validaciju i leksemske zabrane ponavljanja.
- **Tempo:** Računalo u treningu odgovara nasumično nakon 1–3 s. Javni odgovor pripada brzoj kategoriji (20 %, 8–20 % punog poteza), uobičajenoj (65 %, 20–55 %) ili sporoj (15 %, 55–85 %). Trajni koeficijent identiteta 0,90–1,10 i male korekcije duljine/frekvencije ne izlaze iz ukupnog raspona 8–85 %. Primljeni KA koji završi kaladontom koristi brzu kategoriju; propust primljenog KA koristi običan tempo. Težina prefiksa računa se po broju **prepoznatih** kandidata. Vrijeme se računa od početka punog poteza, uz oduzimanje već proteklog vremena i sigurnosnu marginu prije roka; zakašnjeli događaj ne pokreće novo razmišljanje. Već istekao rok ne zakazuje novu normalnu akciju.
- **Propust:** na početku sudjelovanja postoji 20 % šanse za najviše jednu priliku za „Ne znam”, na unaprijed izvučenom 1.–3. teškom potezu. Težak potez nema poželjnih uobičajenih osnovnih oblika među poznatim. Brojač ne napreduje ponovno za isti token niti tijekom tehničkog oporavka. Ako legalnog nastavka uopće nema, vrijedi redovno pravilo mrtvih slova. Tehnička greška poslužitelja nikad se ne prikazuje kao namjerni propust.
- **Namjerni istek:** javno sudjelovanje bota ima 2 % šanse za jednu priliku da pričeka redovni istek timera, na unaprijed izvučenom vlastitom 2.–12. potezu, uključujući potez na „ka”. Ako partija ne dosegne taj potez, prilika ostaje neiskorištena. Trening nema namjerni istek. Namjerno čekanje posebno se bilježi i razlikuje od neočekivanog isteka/tehničkog zastoja u admin nadzoru i testovima.
- **KA:** bot prepoznaje KA i odigrava `kaladont` kad to pravila dopuštaju; u zadano 8 % slučajeva propusti tuđi „ka” i pokuša običnu riječ. Pri vlastitom izboru, tek među poznatim, u zadano 1,5 % slučajeva ostavlja riječ na „ka” ako postoji obična alternativa; ako su poznate samo na „ka”, odigra takvu riječ.
- Bot nikada ne dogovara igru s drugim botom niti namješta ishod čovjeku.
- **Brze poruke (javne partije):** botovi šalju iste brze reakcije kao ljudi, s globalnim frekvencijama u admin postavkama (ne po botu). Zadano: 20 % pozdrav (Bok!) na početku po botu; 30 % „Nemoj zamjerit” kad bot eliminira nekoga; pri ispadanju bota 10 % „Bravo!” ili 5 % „Hvala” (međusobno isključivo). Svaka zakazana reakcija čeka najmanje 2 s plus nasumično 0–3 s. Trening i privatne partije bez ovih reakcija. Vrijedi postojeći cooldown 2 s po igraču (RS-22).
- Nakon eliminacije čovjeka preostali botovi normalno dovršavaju javnu partiju; eliminirani čovjek može gledati.

Postoci su početne vrijednosti verzionirane konfiguracije i mijenjaju se nakon mjerenja, ne skrivenim promjenama u kodu.

Konfiguracija se snima za cijelu partiju pri prvom događaju motora. Kasnija izmjena ne mijenja postojeću partiju ni odluku za isti token. Promjena rječnika zadržava odabranu riječ ako je još legalna i ne izvlači ponovno planirano neznanje. Stari env ključevi `BOT_VJEROJATNOST_NE_ZNAM` i `BOT_VJEROJATNOST_ISTEKA` više se ne čitaju: nisu prešutno pretvoreni iz vjerojatnosti po potezu u vjerojatnost po sudjelovanju.

Svi oblici odabrane skupine imaju pozitivan ponder `(1 + log1p(frekvencija)) × ponder duljine`. Najprije se filtriraju poznate riječi, zatim među njima ide izbor KA/bez KA, pa preferencije vrste. Dobrovoljni KA postotak vrijedi kada su obje skupine dostupne i bot igra riječ. Težina prefiksa procjenjuje se iz broja prepoznatih kandidata.

## Trajne admin postavke

Admin zapis sadrži samo podržane parametre ponašanja: pragove popune i odstupanja, gateove, sve kategorije javnog tempa i treninga, margine/raspone, ponder frekvencije/duljine/vrste, KA/propust/izostanak, osobni i prefiksni tempo, aktivni limit, oporavke, refresh retry, povijest protivnika i 4/5-minutnu neaktivnost. Ne prihvaća proizvoljne env vrijednosti ili tajne. Spremanje zahtijeva očekivanu reviziju; neaktualna revizija vraća 409. Promjena i audit (revizija, postavke, administrator i vrijeme) zapisuju se u jednoj transakciji. Čitanje i pisanje zahtijevaju admin sesiju i koriste `Cache-Control: no-store`.

Postavke se učitavaju jednom pri pokretanju procesa. Ako trajni zapis još ne postoji, vrijede provjereni env zadani parametri; nedostupna baza nije povod za ignoriranje spremljenih postavki. Nakon uspješnog spremanja novi snapshot koristi se za nove partije, nove epizode reda i nove trening-aktivnosti; odluka, rok ili timer postojeće aktivnosti ne mijenjaju se. Isključivanje popune može odmah osloboditi rezervacije, ali ne prekida započetu igru. Brzi razvoj nije dopušten izvan `development`.

## Identitet javnog bota

- Dvoboj i Četveroboj dijele jednu promiješanu vrećicu identiteta. U osnovnom krugu svaki slobodan bot dobiva jednu priliku. Zauzeti ostaju u vrećici dok se ne oslobode; ako su svi preostali zauzeti, pomoćni promiješani izbor koristi druge slobodne botove bez dodatnog čekanja. Osvježavanje profila ne resetira krug ni generacije rezervacija. Na granici kruga izbjegava se isti posljednji bot kad postoji druga slobodna opcija.
- Među dostupnim kandidatima istog prioriteta izbjegavaju se posljednja dva različita bot-protivnika čovjeka, zajednički za oba moda, bez dodatnog čekanja. Povijest nastaje samo nakon uspješnog početka, istječe nakon 24 h, ograničena je na 50.000 zapisa i ne preživljava restart.
- Trajan profil, nadimak i avatar; statistika nastaje stvarnim odigranim javnim partijama.
- Prije sljedeće rezervacije nakon spremljene igre osvježavaju se agregati i stvarni nizovi za oba javna moda. Bot sa zastarjelim profilom ostaje nedostupan dok osvježavanje ne uspije; neuspjeh ne zaustavlja druge slobodne botove.
- Administrator vidi oznaku bota; običan igrač ne. Imenovani botovi ulaze na javne ljestvice jednako kao ljudi (isti minimum igara, metrike i razdoblja); gost-botovi ne. Imenovani botovi imaju javni profil kao registrirani igrači.
- Jedan identitet igra najviše jednu partiju istodobno. Zamjenski fond v4 ima 80 imenovanih i 20 botova prikazanih kao „Gost”; tvrdi maksimum aktivnog fonda je 100. Stari identiteti se deaktiviraju, ne preimenuju niti brišu. Gost-bot je trajan račun kojim upravlja bot, nema javni profil ni ljestvicu, a nije običan privremeni gost.
- Administrator može stvarati imenovane ili gost-botove, aktivirati/deaktivirati ih te mijenjati validirane postavke. Deaktivacija odmah sprječava nove rezervacije i oslobađa čekajuće rezervacije; već započete partije se dovršavaju. Sve promjene identiteta bilježe se s administratorom i vremenom.
- Bot identitet ne može se prijaviti, resetirati lozinku ni biti preuzet.

## Zagrijavanje

- Dvoboj protiv jednog računalnog protivnika „Računalo” s jednim stalnim avatarom. Dostupno gostima i registriranima, uključujući nepotvrđen e-mail.
- Pokreće se odmah, bez javnog reda i bez trošenja javnog fonda botova. Igrač može imati samo jedan aktivni kontekst igranja (red, soba, partija ili trening).
- Pravila valjanosti poteza i eliminacije identična su javnom Dvoboju, ali trening nema vremensko ograničenje poteza: nema automatskog ispadanja zbog čekanja ni prikaza timera. Računalo odigrava nakon 1–3 s; igrač može razmišljati bez roka.
- Trening ne bilježi partiju, poteze ni natjecateljski napredak: nema bodova, XP-a, ranga, forme, nizova, kolekcije riječi ni općih dostignuća. Gostu i privremenom „Računalu” ne sprema se ništa.
- Registrirani čovjek koji prirodno pobijedi dobiva napredak dostignuća **Zagrijan** na 1, 5, 20, 50 i 100 trening pobjeda. Ne dodjeljuje se pri izlasku, porazu, tehničkom prekidu ili neaktivnosti. Gosti nemaju dostignuće Zagrijan.
- Neaktivni trening upozorava nakon 4 minute i tehnički se zatvara nakon 5 minuta bez ljudskog prihvaćenog poteza ili izričitog nastavka. Otkucaji veze i potezi Računala ne resetiraju neaktivnost. Zatvaranje nije pobjeda ni poraz.
- Završni ekran jasno navodi da se trening ne bilježi kao partija i ne utječe na natjecateljske statistike, XP, rang, formu ni kolekciju; može prikazati novu razinu dostignuća Zagrijanog.
- Poslužitelj ograničava broj aktivnih treninga odvojeno od javnih partija; pri zauzeću prikazuje jasnu poruku.

## Provjera pod opterećenjem

Pravila iznad provjeravaju se i na stagingu: predtest popune reda mjeri pragove 30 s / 20–30–40 s i sastav 1 odnosno 3 bota; namjerni javni istek nije tehnička greška. Miješani stres test (profil v5) uključuje do 100 istodobnih treninga protiv Računala i traži da računalni protivnik nikad ne bude eliminiran istekom vremena ni zahvaćen tehničkom greškom. Postupak i kriteriji: [testiranje.md](../06-razvoj/testiranje.md#profil-v5-računalni-protivnici-u-stres-testu).
