# Botovi i Zagrijavanje — pravila ponašanja

Dopuna [pravila igre](pravila-igre.md) prema [ADR-017](../03-arhitektura/odluke/017-botovi-i-zagrijavanje.md). Vrijedi za javne partije s botovima i za trening.

## Popuna javnog reda

Vrijeme se računa na poslužitelju od `usaoU` **najstarijeg prisutnog čovjeka** u nepotpunoj grupi. Bot nikada nije vremensko polazište; dolazak novog čovjeka ne resetira čekanje ostalih.

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

## Pravila za bota u partiji

- Bot igra po **istim pravilima** kao čovjek: isti potez, timer, validacija, leksemske grupe, eliminacija i Kaladont-efekt. Potezi ljudi i botova prolaze istu obradu na poslužitelju.
- Bot koristi **cijeli aktivni rječnik** dopušten pravilima partije. Nema legalne riječi koja je trajno nedostupna zbog položaja u popisu.
- **Nenapadačka politika:** bot ne traži mrtve nastavke, ne gleda protivnikove mogućnosti i ne bira riječ prema broju protivnikovih nastavaka. Slučajan mrtvi nastavak smije se dogoditi. Pravilo je isto neovisno o tome je li sljedeći igrač čovjek ili bot.
- **Izbor riječi (politika v2):** među uobičajenim legalnim osnovnim oblicima zadano 90 % izbora bira imenicu, a 10 % glagol ili pridjev. Oblik jednak lemi koristi se kao aproksimacija nominativa jednine / infinitiva / osnovnog pridjeva; rječnik nema zasebne morfološke oznake pa iznimke poput „škare” nisu automatski prepoznate. Ako jedna skupina nedostaje, koristi se druga. Nema redovnog nasumičnog izbora rijetkih riječi; bira se među najfrekventnijim raspoloživim kandidatima. Kad poželjnih uobičajenih oblika nema, dopušten je fallback na ostale legalne oblike, najprije one s poznatom višom frekvencijom. Sve izabrane riječi prolaze postojeću server validaciju i leksemske zabrane ponavljanja.
- **Tempo:** Računalo u treningu odgovara nakon 3 s. Javni botovi normalno razmišljaju nasumično od 5 do 14 s. Ako je preostali rok kraći, normalan potez mora stati unutar njega; timer igre ostaje autoritativan.
- **Propust:** samo kad nema poželjnih uobičajenih osnovnih oblika, svaki potez ima 10 % šanse za „Ne znam”. To zamjenjuje prijašnji propust dodijeljen po partiji. Ako legalnog nastavka uopće nema, vrijedi redovno pravilo mrtvih slova. Tehnička greška poslužitelja nikad se ne prikazuje kao namjerni propust.
- **Namjerni istek:** svaki potez javnog bota ima 0,5 % šanse da ne odigra i pričeka redovni istek timera, uključujući potez na „ka”. Trening nema namjerni istek. Namjerno čekanje posebno se bilježi i razlikuje od neočekivanog isteka/tehničkog zastoja u admin nadzoru i testovima.
- **KA:** bot prepoznaje KA i odigrava `kaladont`/`kalodont` kad to pravila dopuštaju. Pri vlastitom izboru riječi na „ka” u zadano 5 % slučajeva ostavlja takvu riječ ako postoji među legalnim kandidatima; ako su svi kandidati na „ka”, odigra legalnu riječ.
- Bot nikada ne dogovara igru s drugim botom niti namješta ishod čovjeku.
- Nakon eliminacije čovjeka preostali botovi normalno dovršavaju javnu partiju; eliminirani čovjek može gledati.

Postoci su početne vrijednosti verzionirane konfiguracije i mijenjaju se nakon mjerenja, ne skrivenim promjenama u kodu.

## Identitet javnog bota

- Trajan profil, nadimak i avatar; statistika nastaje stvarnim odigranim javnim partijama.
- Administrator vidi oznaku bota; običan igrač ne. Botovi se ne prikazuju na javnim ljestvicama, ali imaju javni profil kao i registrirani igrači.
- Jedan identitet igra najviše jednu partiju istodobno. Fond: 40 aktivnih, najviše 100.
- Bot identitet ne može se prijaviti, resetirati lozinku ni biti preuzet.

## Zagrijavanje

- Dvoboj protiv jednog računalnog protivnika „Računalo” s jednim stalnim avatarom. Dostupno gostima i registriranima, uključujući nepotvrđen e-mail.
- Pokreće se odmah, bez javnog reda i bez trošenja javnog fonda botova. Igrač može imati samo jedan aktivni kontekst igranja (red, soba, partija ili trening).
- Pravila valjanosti poteza i eliminacije identična su javnom Dvoboju, ali trening nema vremensko ograničenje poteza: nema automatskog ispadanja zbog čekanja ni prikaza timera. Računalo i dalje odigrava nakon 3 s; igrač može razmišljati bez roka.
- **Ništa se ne bilježi:** nema partije u povijesti, poteza, bodova, XP-a, ranga, forme, nizova, dostignuća ni kolekcija. Nema obavijesti o napretku ni usred igre. Odlazak iz treninga nema kaznu.
- Završni ekran: „Ovo je trening. Rezultat se ne bilježi i ne utječe na tvoju statistiku, dostignuća ni formu.” s tipkama „Igraj novi trening” i povratak na odabir igre.
- Poslužitelj ograničava broj aktivnih treninga odvojeno od javnih partija; pri zauzeću prikazuje jasnu poruku.

## Provjera pod opterećenjem

Pravila iznad provjeravaju se i na stagingu: predtest popune reda mjeri pragove 30 s / 20–30–40 s i sastav 1 odnosno 3 bota; namjerni javni istek nije tehnička greška. Miješani stres test (profil v5) uključuje do 100 istodobnih treninga protiv Računala i traži da računalni protivnik nikad ne bude eliminiran istekom vremena ni zahvaćen tehničkom greškom. Postupak i kriteriji: [testiranje.md](../06-razvoj/testiranje.md#profil-v5-računalni-protivnici-u-stres-testu).
