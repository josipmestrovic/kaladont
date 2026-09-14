# Pravila igre — službena digitalna verzija

Ovaj dokument je autoritativan opis pravila. Sve druge datoteke, uključujući kod i UI tekstove, moraju biti usklađene s njim.

## Postava i modovi

- **Klasični mod** igraju točno 4 igrača. Sjedala se dodjeljuju nasumično, a igra ide u krug.
- **1v1 Dvoboj** igraju točno 2 igrača. Nakon svakog poteza na redu je protivnik.
- Gosti i registrirani igrači igraju pod istim pravilima.
- Privatna soba prima 2 do 8 igrača. Vlasnik može prilagoditi tajmer, bodove za eliminaciju i dopuštene vrste riječi. Pravila nastavaka, grafema i ponavljanja ostaju ista.

## Tijek partije

1. Sustav nasumično odabire prvu riječ. Igrač nikada ne bira otvarajuću riječ.
2. Igrač na potezu odgovara riječju koja počinje na zadnja dva grafema prethodne riječi. U javnim modovima ima 30 sekundi; privatna soba može imati 15, 30 ili 60 sekundi, odnosno igru bez tajmera.
3. Nakon svake eliminacije sustav bira novu početnu riječ i igra se nastavlja s preostalim igračima.
4. Partija završava kada ostane jedan igrač. U Dvoboju prvi koji ispadne odmah gubi.

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

Baza prihvaća imenice, glagole, pridjeve, priloge, zamjenice, brojeve, prijedloge, veznike, čestice i usklike, u svim oblicima. Vlastita imena, kratice te riječi s brojkama, crticama ili razmacima nisu u bazi.

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

Sustav bira početnu riječ pri početku partije, nakon eliminacije i nakon kaladont-efekta. Odabrana riječ je aktivna imenička lema u nominativu kraća od šest znakova koja ima barem jedan slobodan nastavak. Time se početak runde ne može pretvoriti u namještenu klopku.

Nakon objave riječi na potez dolazi sljedeći aktivni igrač. Tek tada započinje tajmer poteza.

## Kaladont efekt

„Kaladont” i „kalodont” imaju posebno pravilo kada se odigraju na `ka`:

1. Ne ispada sljedeći igrač, nego igrač čija je riječ otvorila nastavak `ka`.
2. Bod za eliminaciju dobiva igrač koji je odigrao kaladont.
3. Sustav zatim bira novu riječ za otvaranje runde.

Ako je `ka` otvorio sustav, nema igrača koji bi ispao: nitko ne dobiva bod, a sustav odmah otvara novu rundu.

## Ispadanje

| Način | Opis | Bod napadaču? |
|---|---|---|
| **Ne znam** | Igrač predaje potez | Da |
| **Istek vremena** | Timer istekne bez valjane riječi | Da |
| **Mrtva slova** | Nema nijedne dostupne riječi na tražena dva grafema | Da |
| **Prekid veze** | Igrač se ne vrati u 10 sekundi od prekida | Samo ako je bio na potezu |
| **Kaladont** | Primjenjuje se posebno pravilo iznad | Da |

Ako baza nema nijednu riječ na tražena slova, eliminacija se događa odmah i igrač može prijaviti moguću rupu u bazi. Ako postoje samo već potrošene riječi, riječ je o regularnoj taktičkoj eliminaciji bez prijave.

U Klasičnom modu prvi ispali je četvrti, zatim treći i drugi; preostali igrač je prvi. Eliminirani ostaje promatrač do kraja partije.

## Bodovanje

- **Klasični mod:** plasman donosi 0, 1, 2 ili 3 boda; svaka izazvana eliminacija donosi 1 bod; pobjednik dobiva dodatni bod. Maksimum je 7 bodova po partiji.
- **1v1 Dvoboj:** pobjednik dobiva 1 bod, poraženi 0. Dvoboj ima zasebne statistike, rang i ljestvicu od Klasičnog moda.
- **Privatne sobe:** ne mijenjaju globalne statistike ni rang. Bodovi i pobjede zbrajaju se samo na privremenoj ljestvici aktivne sobe.

Detalji izračuna i rangova nalaze se u [bodovanje-i-rangovi.md](bodovanje-i-rangovi.md).

## Povijest i prijave

Potezi javnih partija trajno se zapisuju. Igrač može otvoriti povijest partije i prijaviti grešku u rječniku uz pojedini potez. Detalji su u [odrzavanje-rjecnika.md](../04-rjecnik/odrzavanje-rjecnika.md).
