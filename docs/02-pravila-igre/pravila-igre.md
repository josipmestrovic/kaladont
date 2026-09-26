# Pravila igre — službena digitalna verzija

Ovaj dokument je autoritativan opis pravila. Sve druge datoteke, uključujući kod i UI tekstove, moraju biti usklađene s njim.

## Postava i modovi

- **Klasični mod** igraju točno 4 igrača. Sjedala se dodjeljuju nasumično, a igra ide u krug.
- **1v1 Dvoboj** igraju točno 2 igrača. Nakon svakog poteza na redu je protivnik.
- Gosti i registrirani igrači igraju pod istim pravilima.
- **Privatna soba** prima 2 do 8 igrača. Vlasnik može odabrati trajanje poteza (15, 30 ili 60 sekundi ili bez tajmera), dopuštene vrste riječi i želi li bodove za izazvane eliminacije. Imenice su uvijek dopuštene. Pravila nastavaka, grafema, ponavljanja i Kaladont-efekta ostaju ista.
- Javni modovi koriste javni red čekanja, bodovanje, rangove i ljestvice. Privatna soba koristi samo svoju privremenu ljestvicu; njezin rezultat ne mijenja javne bodove ni rang.

## Tijek partije

1. Sustav bira početnu riječ; igrač je nikada ne bira sam. Prvo se pokušava odabrati riječ iz odobrenog skupa sigurnih riječi. Sigurnosni uvjet i rezervni odabir opisani su u odjeljku [Otvaranje runde](#otvaranje-runde).
2. Igrač na potezu odgovara riječju koja počinje na zadnja dva grafema prethodne riječi. Javni potez traje 30 sekundi. Privatna soba može imati 15, 30 ili 60 sekundi ili biti bez tajmera.
3. Nevaljan upis odbija se uz razlog. Igrač ne ispada odmah i može pokušati ponovno, ali njegov timer nastavlja teći.
4. Nakon eliminacije ili Kaladont-efekta sustav bira novu početnu riječ, a red se nastavlja prema pravilima konkretnog moda.
5. Partija završava kada ostane jedan igrač. U Dvoboju prvi koji ispadne odmah gubi.

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

Baza za igrive poteze prihvaća imenice, glagole, pridjeve, priloge, zamjenice, brojeve, prijedloge, veznike, čestice, usklike i vlastita imena, u svim uvezenim oblicima. Privatnoj sobi vlasnik može ograničiti vrste, ali imenice ostaju dopuštene. Vlastita imena poput „Ana”, „Italija” i „Zagreb” su dopuštena kao zasebna vrsta. Kratice te riječi s brojkama, crticama ili razmacima nisu u igrivom rječniku.

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

## Kaladont efekt

„Kaladont” i „kalodont” imaju posebno pravilo kada se odigraju na `ka`:

1. Ne ispada sljedeći igrač, nego igrač čija je riječ otvorila nastavak `ka`.
2. Bod za eliminaciju dobiva igrač koji je odigrao kaladont.
3. Sustav zatim bira novu riječ za otvaranje runde.

Ako je `ka` otvorio sustav, nema igrača koji bi ispao: nitko ne dobiva bod, a sustav odmah otvara novu rundu.

„Kaladont” i „kalodont” mogu se ponoviti i daju posebnu nagradu XP-a u javnim partijama. Pravilo o tome tko ispada vrijedi neovisno o postavci eliminacijskih bodova privatne sobe; u privatnoj sobi bod se dodjeljuje samo ako je vlasnik uključio bodove za eliminacije.

## Ispadanje

| Način | Opis | Bod napadaču? |
|---|---|---|
| **Ne znam** | Igrač predaje potez | Da |
| **Istek vremena** | Timer istekne bez valjane riječi | Da |
| **Mrtva slova** | Nema nijedne dostupne riječi na tražena dva grafema | Da |
| **Prekid veze** | Igrač se ne vrati u 10 sekundi od prekida | Samo ako je bio na potezu |
| **Kaladont** | Primjenjuje se posebno pravilo iznad | Da |

Ako rječnik nema riječ koja počinje traženim grafemima, sljedeći igrač ispada odmah, bez čekanja da istekne vrijeme. Igrač koji je otvorio taj par dobiva bod za eliminaciju u javnom Klasičnom modu, a moguću rupu u rječniku može prijaviti. Ako riječi postoje, ali su sve njihove leksemske grupe već potrošene, sljedeći igrač također odmah ispada; to je uobičajena taktička situacija i ne prijavljuje se kao rupa u rječniku.

Igrač se nakon prekida veze može vratiti u roku od 10 sekundi od trenutka kada igra utvrdi prekid, koristeći isti identitet. Vrijeme poteza nastavlja teći i tijekom prekida. Ako igrač nije bio na potezu, ispada bez boda za protivnika; ako je bio na potezu, bod može dobiti igrač koji mu je ostavio tražena slova. Namjerni izlazak iz partije odmah eliminira igrača i nema razdoblja za povratak.

U Klasičnom modu prvi ispali zauzima četvrto mjesto, sljedeći treće, a zatim drugi; posljednji preostali igrač pobjeđuje. Eliminirani igrači ostaju promatrači do kraja partije. U Dvoboju prva eliminacija završava partiju.

## Bodovanje

- **Klasični mod:** plasman donosi 0, 1, 2 ili 3 boda; svaka izazvana eliminacija donosi 1 bod; pobjednik dobiva dodatni bod. Maksimum je 7 bodova po partiji.
- **1v1 Dvoboj:** pobjednik dobiva 1 bod, poraženi 0. Dvoboj ima zasebne statistike, rang, kalibraciju i ljestvicu od Klasičnog moda.
- **Privatne sobe:** vlasnik bira dodjeljuju li se bodovi za izazvane eliminacije. Bodovi i pobjede zbrajaju se samo na privremenoj ljestvici aktivne sobe; privatni rezultat ne mijenja javne bodove, javni rang ni ljestvicu.

Detaljna pravila bodova, XP-a, ocjene partije, rangova, niza pobjeda i dostignuća nalaze se na stranici [Bodovanje i rangovi](bodovanje-i-rangovi.md).

## Povijest i prijave

Potezi javnih partija trajno se zapisuju. Igrač može otvoriti povijest partije i prijaviti grešku u rječniku uz pojedini potez. Detalji su u [odrzavanje-rjecnika.md](../04-rjecnik/odrzavanje-rjecnika.md).
