# Pravila igre — službena digitalna verzija

Ovaj dokument je autoritativan opis pravila. Sve druge datoteke (kod, UI tekstovi, marketing) moraju biti usklađene s njim.

## Cilj igre

Reći riječ koja počinje na **posljednja dva grafema** riječi prethodnog igrača — i preživjeti dulje od ostalih. Ime igre dolazi od paste za zube: riječ „kaladont" završava na „nt", a nijedna hrvatska riječ ne počinje na „nt", pa onaj tko je izgovori postavlja protivniku nerješiv zadatak.

## Postava

- Partiju igra **točno 4 igrača** (gosti i registrirani zajedno, bez razlike).
- Raspored za stolom (sjedala 0–3) dodjeljuje se nasumično pri početku.
- Igra se u krug, u smjeru rastućih sjedala.

## Tijek partije

1. **Sustav** (ne igrač) nasumično odabire **prvu riječ** partije — vidi „Otvaranje runde: sustav bira riječ" niže.
2. Sljedeći igrač ima **30 sekundi** da upiše riječ koja počinje na zadnja dva grafema prethodne riječi.
3. Krug se nastavlja dok netko ne ispadne (vidi „Ispadanje").
4. Nakon svake eliminacije **sustav** ponovno nasumično bira riječ za otvaranje nove runde; igra se nastavlja s preostalim igračima.
5. Partija završava kad ostane jedan igrač — **pobjednik** (1. mjesto).

## Otvaranje runde: sustav bira riječ

Da se ne bi moglo namjestiti ishod biranjem "ciljane" početne riječi (npr. odabirom nejasne, rijetko poznate riječi kako bi sljedeći igrač zagarantirano ispao), **igrač nikad sam ne bira riječ kojom se otvara runda** — to uvijek radi **sustav**, i to u sljedećim trenucima: na početku partije (1. runda), nakon svake eliminacije i nakon kaladont-efekta.

Tijek otvaranja runde:

1. Klijentima se prikaže 5-sekundni ekran s obrazloženjem zadnje eliminacije (ako postoji) i porukom „Sustav će sada nasumično odabrati novu riječ..." uz brojač/loading indikator. Tijekom ovih 5 sekundi nitko ne može igrati.
2. Sustav nasumično odabere aktivnu **imeničku lemu u nominativu** kraću od 6 znakova koja **sama ima barem jedan slobodan (neiskorišten) nastavak**. Pool trenutno ima 3.821 riječi; ograničenje vrijedi samo za sustavovo otvaranje runde, ne i za riječi koje igrači smiju odigrati. Time je klopka u otvaranju strukturno nemoguća, a početne riječi ostaju kratke i poznatije.
3. Riječ se objavljuje („Sustav je odabrao riječ: X") i red prelazi na **sljedećeg aktivnog igrača** nakon onoga tko je prouzročio otvaranje nove runde (napadača prethodne eliminacije, ili nasumičnog prvog igrača za 1. rundu). Tek tada kreće **30-sekundni timer** poteza.
4. Igrač koji je sada na potezu odgovara na sustavovu riječ **kao na normalan nastavak** — ne bira on početnu riječ.

## Valjana riječ

Riječ je valjana ako zadovoljava **sve** uvjete:

| # | Uvjet | Poruka pri odbijanju |
|---|---|---|
| 1 | Postoji u bazi riječi (sve vrste riječi u svim oblicima — vidi [Leksemske grupe](#leksemske-grupe-zabrana-ponavljanja)) | „Ta riječ ne postoji u našoj bazi." |
| 2 | Počinje na tražena dva grafema | „Riječ mora početi na 'XY'." |
| 3 | Njezina leksemska grupa nije već potrošena **u ovoj partiji** (u bilo kojoj rundi) | „Već je iskorišten oblik te riječi: 'X'." |
| 4 | Dijakritici su upisani **točno** (č ≠ c, š ≠ s…) | (pokriveno uvjetom 1 ili 2) |

**Neispravan pokušaj ne eliminira igrača** — riječ se odbija uz poruku, a vrijeme teče dalje. Igrač smije pokušavati do isteka vremena.

### Leksemske grupe (zabrana ponavljanja)

Baza sadrži **sve vrste riječi u svim oblicima** — imenice, glagole, pridjeve, priloge, zamjenice, brojeve, prijedloge, veznike, čestice i uzvike ([ADR-013](../03-arhitektura/odluke/013-sve-vrste-rijeci-leksemske-grupe.md)). Da paradigma jedne riječi ne bi postala neiscrpan izvor poteza, ponavljanje se ne računa po točnom obliku nego po **leksemskoj grupi**:

- Svi oblici istog leksema dijele grupu: nakon „dobar" odbijaju se i „dobra", „dobro", „dobrima"…
- **Stupnjevi pridjeva i priloga zasebne su grupe:** „dobar", „bolji" i „najbolji" tri su različite grupe.
- **Glagolski vid razdvaja grupe:** „pisati" i „napisati" različite su riječi.
- Oblik koji pripada većem broju vrsta (npr. „dobro" — imenica, pridjev i prilog) pri odigravanju **troši sve svoje grupe**.
- Poruka odbijanja navodi oblik koji je grupu potrošio: „Već je iskorišten oblik te riječi: 'dobar'."

Riječi kraće od dva grafema (i, u, s, k, a…) nisu u bazi — potez uvijek traži poklapanje **dva** grafema pa ne mogu biti valjane.

## Posebno pravilo: "kaladont" i "kalodont"

Riječi **„kaladont"** i **„kalodont"** (obje se tretiraju jednako) imaju jedinstven efekt i **izuzete su od zabrane ponavljanja** — mogu se odigrati više puta u istoj partiji, svaki put kad se za to ukaže prilika (tražena slova „ka").

Kad ih igrač B izgovori:

1. **Ne ispada sljedeći igrač** kako bi se očekivalo od riječi koja završava na „nt" (mrtav par) — umjesto toga ispada igrač **A**, onaj čija je riječ omogućila otvaranje na „ka". Bod za tu eliminaciju ide **B**-u (napadač).
2. Ako je A bio pretposljednji preostali igrač, partija odmah završava — B pobjeđuje.
3. Inače **sustav** (ne B) bira novu riječ za otvaranje nastavka runde (vidi „Otvaranje runde: sustav bira riječ"), a red nakon toga prelazi na sljedećeg aktivnog igrača nakon B.

## Ispadanje

Igrač ispada iz partije na jedan od pet načina:

| Način | Opis | Bod napadaču? |
|---|---|---|
| **Ne znam** | Klik na gumb „Ne znam riječ na 'XY'" (uz potvrdu) | Da |
| **Istek vremena** | 30 sekundi prošlo bez valjane riječi | Da |
| **Mrtva slova** | Na tražena dva grafema ne postoji nijedna dostupna riječ — server to utvrđuje **odmah** pri upisu prethodne riječi | Da |
| **Prekid veze** | Veza prekinuta tijekom partije → trenutna eliminacija | Samo ako je prekid bio na potezu prekinutog |
| **Kaladont** | Netko je izgovorio „kaladont"/„kalodont" — ispada igrač koji je omogućio „ka" | Da, onome tko je izgovorio riječ |

Kod „mrtvih slova" razlikuju se dvije poruke eliminiranom igraču:

- *„Trenutno u bazi nemamo riječ na 'XY'."* — uz gumb **Prijavi** (možda je rupa u bazi);
- *„Sve riječi na 'XY' već su iskorištene u ovoj partiji."* — regularna taktička pobjeda napadača, bez gumba za prijavu.

Redoslijed ispadanja određuje plasman: prvi ispali = 4. mjesto, zatim 3., pa 2.; preostali igrač = 1. mjesto.

## Zabrane

- **Vlastita imena i kratice** ne postoje u bazi (filtrirano pri uvozu) — automatski su nevaljani.
- **Ponavljanje** je zabranjeno kroz cijelu partiju na razini **leksemske grupe** (bilo koji oblik iste riječi, uključujući riječi iz ranijih rundi) — **izuzetak: „kaladont"/„kalodont"** (vidi gore), koje se smiju ponoviti.

## Nakon ispadanja

Eliminirani igrač **ostaje za stolom kao promatrač** do kraja partije. Promatrači vide sve poteze i mogu slati emoji reakcije, ali ne igraju.

## Komunikacija za stolom

Jedina komunikacija su **emoji reakcije** iz fiksnog skupa: 👏 😂 😮 🔥 😅 🤝. Tekstualni chat ne postoji. Reakcije su ograničene na jednu svake 2 sekunde po igraču.

## Bodovi

Vidi [bodovanje-i-rangovi.md](bodovanje-i-rangovi.md). Ukratko: plasman (0/1/2/3) + 1 bod po izazvanoj eliminaciji + 1 bonus bod za 1. mjesto; najviše 7 bodova po partiji.

## Povijest i prijave

Svaki potez partije trajno se zapisuje. Igrač u svakom trenutku može otvoriti **povijest partije**, a s bilo kojeg poteza podnijeti **prijavu greške** (npr. riječ koja nedostaje u bazi). Detalji u [../04-rjecnik/odrzavanje-rjecnika.md](../04-rjecnik/odrzavanje-rjecnika.md).
