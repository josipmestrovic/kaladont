# Pravila igre — službena digitalna verzija

Ovaj dokument je autoritativan opis pravila. Sve druge datoteke, uključujući kod i UI tekstove, moraju biti usklađene s njim.

## Postava, formati i pravilnici

<!-- HINT PR15: format stola ≠ pravilnik ≠ kontekst (javna/privatna/trening). -->

Format javnog stola i pravilnik odvojene su osi. Pod „Igraj” igrač prvo bira pravilnik, zatim format.

### Formati stola

- **Četveroboj** — točno 4 igrača. Sjedala se nepristrano nasumično promiješaju; igra ide u krug.
- **Troboj** — točno 3 igrača. Isto pravilo sjedala i kružnog reda. Prelazak na dva aktivna ne mijenja format ni bodovanje.
- **Dvoboj** — točno 2 igrača. Početna sjedala i prvi igrač biraju se nasumično.
- Gosti i registrirani igraju pod istim pravilima.
- **Privatna soba** prima 2 do 8 igrača. Domaćin bira pravilnik, trajanje poteza (15/30/60 s ili bez tajmera), vrste riječi i bodove za eliminacije. Imenice su uvijek dopuštene.
- Javni formati koriste javni red, bodovanje, jedan univerzalni rang i ljestvice po formatu. Privatna soba ima samo privremenu ljestvicu.
- U javnom redu prazna mjesta nakon pragova popunjavaju **botovi**. **Zagrijavanje** igra odabrani pravilnik: Klasični ima čovjeka + 2 Računala; KA-ZNA i Dokaži nastavak čovjeka + 1 Računalo. Detalji: [botovi.md](botovi.md).

### Pravilnici

| Pravilnik | Posebna riječ na „ka” | „Ne znam” / istek | Mrtva slova |
|---|---|---|---|
| **Klasični Kaladont** | Ispada sljedeći aktivni iza autora posebne riječi | Redovna eliminacija igrača na potezu | Ispada sljedeći na redu |
| **KA-ZNA** | Ispada autor riječi koja je ostavila „ka” (današnje ponašanje) | Redovna eliminacija | Ispada sljedeći na redu |
| **Dokaži nastavak** | Kao KA-ZNA | Može otvoriti dokaz autoru prethodne riječi | Odmah ispada **autor** riječi; nema eliminacijskog boda |

U spojenom javnom Dvoboju (Klasični + KA-ZNA) motor izvodi **KA-ZNA**; svaki igrač i dalje vidi vlastiti odabrani naziv. Stare partije i stari klijenti bez pravilnika = KA-ZNA.

Redoslijed sjedala dodjeljuje se jednom na početku partije i određuje kružni red poteza; sjedalo 0 započinje prvi potez. Svaki igrač vidi isti red sjedala iz vlastite perspektive, zakrenut tako da je njegovo sjedalo prvo. Ta je zakrenuta projekcija samo prikaz: potez, timer i eliminacije i dalje se određuju prema identitetu koji pošalje poslužitelj. Eliminirani igrači ostaju na svojem mjestu do kraja partije.

## Tijek partije

1. Sustav bira početnu riječ; igrač je nikada ne bira sam. Prvo se pokušava odabrati riječ iz odobrenog skupa sigurnih riječi. Sigurnosni uvjet i rezervni odabir opisani su u odjeljku [Otvaranje runde](#otvaranje-runde).
2. Igrač na potezu odgovara riječju koja počinje na zadnja dva grafema prethodne riječi. Javni potez traje 30 sekundi. Privatna soba može imati 15, 30 ili 60 sekundi ili biti bez tajmera.
3. Nevaljan upis odbija se uz razlog. Igrač ne ispada odmah i može pokušati ponovno, ali njegov timer nastavlja teći.
4. Nakon eliminacije ili Kaladont-efekta sustav bira novu početnu riječ (osim dokaznog prijelaza u Dokaži nastavak, gdje se ne bira nova riječ između odustajanja i dokaza).
5. Partija završava kada ostane jedan igrač. U Dvoboju prva eliminacija završava partiju.

## Grafemi

Igra se na zadnja i prva **dva grafema**, ne na dva znaka na tipkovnici.

- `nj`, `lj` i `dž` jedno su slovo.
- Nakon `kralj` traži se `alj`, nakon `ulje` traži se `lje`, a nakon `konj` traži se `onj`.
- Nekoliko riječi ima jezične iznimke: primjerice, `injekcija` počinje na `in`, jer se rastavlja kao `i-n-j`.
- Poslužitelj računa grafeme i jedini presuđuje je li potez valjan.

Detaljni primjeri i popis iznimaka nalaze se u [digrafi-i-grafemi.md](digrafi-i-grafemi.md).

## Valjana riječ

Riječ je valjana samo ako zadovoljava sve uvjete:

| # | Uvjet | Poruka pri odbijanju |
|---|---|---|
| 1 | Postoji u bazi riječi | „Ta riječ ne postoji u našoj bazi.” |
| 2 | Počinje na tražena dva grafema | „Riječ mora početi na 'XY'.” |
| 3 | Njezina leksemska grupa nije već potrošena u toj partiji | „Već je iskorišten oblik te riječi: 'X'.” |
| 4 | Dijakritici su upisani točno | Pokriveno provjerom riječi i početka |

Baza za igrive poteze prihvaća imenice, glagole, pridjeve, priloge, zamjenice, brojeve, prijedloge, veznike, čestice i usklike, u svim uvezenim oblicima. Privatnoj sobi vlasnik može ograničiti vrste, ali imenice ostaju dopuštene. Čista vlastita imena i nazivi (osobna imena, mjesta, marke i slično) zadano nisu igriva na stagingu i produkciji; uključuju se samo kad je `DOPUSTI_VLASTITA_IMENA=true`. Riječ koja je i obična riječ i vlastito ime i dalje prolazi kao obična. Kratice te riječi s brojkama, crticama ili razmacima nisu u igrivom rječniku.

Nevaljan pokušaj ne eliminira igrača. Potez se odbija uz objašnjenje, a vrijeme nastavlja teći.

## Leksemske grupe i ponavljanje

Zabrana ponavljanja vrijedi cijelu partiju, uključujući ranije runde, i računa se po leksemskoj grupi, a ne samo po identičnom zapisu riječi.

- Nakon „dobar” odbijaju se i „dobra”, „dobro” i drugi oblici istog leksema.
- Stupnjevi pridjeva i priloga zasebne su grupe: „dobar”, „bolji” i „najbolji” nisu ista grupa.
- Glagolski vid razdvaja grupe: „pisati” i „napisati” mogu oba proći.
- Oblik s više gramatičkih uloga troši sve svoje grupe.
- „Kaladont” i „kalodont” izuzeti su od zabrane ponavljanja i smiju se odigrati više puta.

Riječi kraće od dva grafema nisu valjane jer se svaki potez mora poklapati s dva grafema.

## Otvaranje runde

Sustav bira početnu riječ pri početku partije, nakon eliminacije i nakon Kaladont-efekta. Igrač je ne bira i ne može namjestiti jezik kako bi sljedeći igrač odmah ispao. Javni i privatni modovi koriste isti [odobreni skup od 52 sigurnih riječi](../04-rjecnik/pocetne-rijeci.md), ali valjanost svakog kandidata ovisi o trenutačnom stanju partije i dopuštenim vrstama riječi.

Riječ iz skupa odabire se nasumičnim redoslijedom i prihvaća se kao sigurna samo ako vrijede svi uvjeti:

1. Riječ je aktivna u rječniku, dopuštene vrste i nijedna njezina leksemska grupa nije već potrošena.
2. Nakon što se potroše sve njezine leksemske grupe, postoji barem jedan dopušten odgovor na zadnja dva grafema.
3. Svaki dopušten odgovor iz 2. uvjeta, nakon što se potroše i sve njegove leksemske grupe, ostavlja barem jedan dopušten nastavak za sljedećeg igrača.

Provjera uključuje ranije potrošene grupe iz svih rundi iste partije i ograničenja vrsta riječi u privatnoj sobi. „Sigurna” zato znači da početna riječ ne stavlja sljedećeg igrača pred nemoguć potez i da nijedan njegov dopušten prvi odgovor ne stvara odmah slijepu ulicu. To nije jamstvo da će cijela partija imati nastavak: kasniji potezi i dalje mogu završiti mrtvim slovima.

Ako nijedan od 52 kandidata trenutačno ne zadovolji sva tri uvjeta, sustav koristi rezervni odabir: kratku aktivnu i dopuštenu riječ iza koje, uzimajući u obzir već potrošene grupe, postoji barem jedna slobodna dopuštena riječ. Rezervni odabir ne jamči da će i taj odgovor ili sljedeći odgovori imati nastavak. Ako ni rezervna riječ nije dostupna, partija se sigurnosno završava (RS-27).

Početna riječ troši svoje leksemske grupe kao i riječ igrača. Nakon objave na potez dolazi sljedeći aktivni igrač; njegov timer počinje tek tada. To vrijedi i kada se rundu otvara nakon eliminacije ili Kaladont-efekta.

## Kaladont efekt i dokaz

„Kaladont” i „kalodont” smiju se ponavljati. Posebno pravilo vrijedi samo kad se odigraju na traženi `ka`, a igrač je na potezu.

1. **KA-ZNA** i **Dokaži nastavak** (običan potez): ispada autor riječi koja je ostavila `ka`; uzročnik je igrač s posebnom riječju; nova sistemska riječ ide prvom aktivnom iza njega (kao danas).
2. **Klasični Kaladont**: ispada prvi aktivni *iza* autora posebne riječi; uzročnik je i dalje onaj tko je rekao kaladont; nova riječ ide prvom aktivnom iza žrtve.
3. Ako je `ka` otvorio sustav, nitko ne ispada i sustav odmah otvara novu rundu.
4. U privatnoj sobi eliminacijski bod vrijedi samo ako ga je domaćin uključio.

### Dokaži nastavak — odgođena eliminacija

Kad Bruno na potezu kaže „Ne znam”, istekne ili napusti, a postoji igrivi nastavak na Aninu riječ, Ana dobiva **potez dokaza** (isti prefiks, novi rok). Dotad nema plasmana ni eliminacijskog boda.

- Ana uspije (npr. „ćaća”) → **samo Bruno ispada**; Ana je uzročnik; nova **sistemska** riječ za prvog aktivnog iza Brune.
- Ana ne uspije / „Ne znam” / istek → **samo Ana ispada**; Bruno ostaje; nitko ne dobiva eliminacijski bod; nova sistemska riječ za prvog aktivnog iza Ane.
- Ako Ana odmah odigra riječ bez nastavka (npr. „cement”) → **odmah ispada samo Ana** (RS-31); Bruno ostaje.

Rubni slučajevi: RS-31, RS-32 u [rubni-slucajevi.md](rubni-slucajevi.md).

## Ispadanje

| Način | Opis | Bod napadaču? |
|---|---|---|
| **Ne znam** | Predaja poteza; u Dokaži nastavak može otvoriti dokaz | Ovisi (dokaz: ne odmah) |
| **Istek vremena** | Timer istekne bez valjane riječi | Ovisi (dokaz: ne odmah) |
| **Mrtva slova** | Nema dostupne riječi; u Dokaži nastavak ispada autor | Da, osim mrtvih slova autora u dokazu |
| **Prekid veze** | Igrač se ne vrati u 10 sekundi | Samo ako je bio na potezu |
| **Kaladont** | Posebno pravilo po pravilniku | Da (kad postoji žrtva) |
| **Neuspješan dokaz** | Autor ne dokaže nastavak | Ne |

U Klasičnom i KA-ZNA, ako nema nastavka, sljedeći igrač ispada odmah. U Dokaži nastavak autor riječi bez nastavka ispada odmah (RS-31).

Igrač se nakon prekida veze može vratiti u roku od 10 sekundi od trenutka kada igra utvrdi prekid, koristeći isti identitet. Vrijeme poteza nastavlja teći i tijekom prekida. Ako igrač nije bio na potezu, ispada bez boda za protivnika; ako je bio na potezu, bod može dobiti igrač koji mu je ostavio tražena slova. Namjerni izlazak iz partije odmah eliminira igrača i nema razdoblja za povratak.

U Troboju i Četveroboju plasman prati redoslijed stvarnog ispadanja (prvi ispao = zadnje mjesto). Eliminirani ostaju promatrači. U Dvoboju prva eliminacija završava partiju.

## Bodovanje

- **Četveroboj:** plasman 3/2/1/0 + 1 pobjedniku + 1 po izazvanoj eliminaciji; maksimum **7**.
- **Troboj:** plasman 2/1/0 + 1 pobjedniku + 1 po eliminaciji; maksimum **5**.
- **Dvoboj:** pobjednik 1, poraženi 0.
- Statistike, forma, niz i ljestvice su **po veličini stola**; pravilnici se spajaju unutar formata. **Rang i Kaladont DNK** su jedni za sve javne formate (kalibracija 10 ukupno).
- **Privatne sobe:** domaćin bira bodove za eliminacije; rezultat ne mijenja javni rang ni ljestvice.

Detaljna pravila bodova, XP-a, ocjene partije, rangova, niza pobjeda i dostignuća nalaze se na stranici [Bodovanje i rangovi](bodovanje-i-rangovi.md).

## Povijest i prijave

Potezi javnih partija trajno se zapisuju. Igrač može otvoriti povijest partije i prijaviti grešku u rječniku uz pojedini potez. Detalji su u [odrzavanje-rjecnika.md](../04-rjecnik/odrzavanje-rjecnika.md).
