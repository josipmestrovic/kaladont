# Bodovanje, rangovi i napredak

Ova stranica opisuje što igrač dobiva za rezultat, kako se računaju javni rangovi i kako napreduju XP, forma, nizovi i dostignuća. **Bodovi, rang, XP, ocjena partije, forma i nizovi različiti su sustavi**: bonus u jednom sustavu ne mijenja izravno ostale.

## Bodovi po partiji

### Klasični mod za 4 igrača

| Rezultat | Bodovi za plasman |
|---|---:|
| 1. mjesto | 3 |
| 2. mjesto | 2 |
| 3. mjesto | 1 |
| 4. mjesto | 0 |

Uz bodove za plasman:

- Igrač čija riječ izazove eliminaciju dobiva **1 bod za tu eliminaciju**.
- Pobjednik dobiva dodatni **1 bod za prvo mjesto**.
- Maksimum je **7 bodova**: 3 za prvo mjesto, 1 bonus za pobjedu i najviše 3 za eliminacije.
- Prekid veze izvan igračeva poteza samoeliminira igrača i ne daje nikome eliminacijski bod. Prekid na potezu može donijeti bod igraču koji je otvorio traženi nastavak; pogledaj [Pravila igre](pravila-igre.md#ispadanje).

### Dvoboj za 2 igrača

- Pobjednik dobiva **1 bod**, a poraženi **0 bodova**.
- Bodovanje je fiksno: plasman i eliminacije ne dodaju dvoboju bodova.

### Privatna soba

- Pobjednik dobiva **2 boda** na privremenoj ljestvici sobe.
- Vlasnik bira želi li dodijeliti dodatni **1 bod za svaku izazvanu eliminaciju**. Ta je opcija pri stvaranju sobe zadano uključena.
- Bodovi i pobjede iz privatne sobe vide se samo na privremenoj ljestvici sobe. Ne mijenjaju javne bodove, rang ni javnu ljestvicu.
- Kod jednakog broja bodova prednost ima igrač s više pobjeda. Rezultat nestaje zatvaranjem sobe.

## Javne statistike i ljestvice

Javni modovi imaju zaseban broj partija, pobjeda i eliminacija, prosjek bodova, rang, formu i niz pobjeda. Rezultat igre za četiri igrača ne prenosi se u dvoboj, ni obratno. XP i trajni napredak u dostignućima zajednički su za oba javna moda.

Javna ljestvica prikazuje do 100 registriranih igrača s najmanje **10 završenih javnih partija u odabranom modu**. Statistika i poredak računaju se samo za odabrani način igre.

## Rangovi

Rang je **prikazni status** izračunat iz rezultata javnih partija. Ne utječe na prihvaćanje riječi, odabir protivnika ni ishod partije; može rasti ili padati s novim rezultatima. Četveroigračka igra i dvoboj imaju zasebne rangove i kalibraciju.

Dok igrač ne završi 10 javnih partija u pojedinom modu, njegov je status **Piskaralo**. Nakon desete partije rang odgovara prosjeku bodova tog moda.

### Rangovi za četiri igrača

Prosjek se računa kao zbroj bodova u javnim četveroigračkim partijama podijeljen njihovim brojem.

| Rang | Prosjek bodova |
|---|---:|
| Prvopisac | manje od 1,50 |
| Riječarac | 1,50–manje od 2,10 |
| Jezičar | 2,10–manje od 2,50 |
| Lektor | 2,50–manje od 2,90 |
| Književnik | 2,90–manje od 3,30 |
| Jezikoslovac | 3,30–manje od 3,80 |
| Doktor riječi | 3,80–manje od 4,40 |
| Jezični maestro | 4,40–manje od 5,00 |
| Gospodar rječnika | 5,00–manje od 5,70 |
| Kaladont | 5,70 ili više |

### Rangovi u dvoboju

Budući da pobjeda u dvoboju donosi 1 bod, a poraz 0, prosjek bodova odgovara udjelu pobjeda. Rang se računa iz nezaokružene vrijednosti, ne iz zaokruženog postotka prikazanog na zaslonu.

| Rang | Udio pobjeda |
|---|---:|
| Prvopisac | manje od 30 % |
| Riječarac | 30–manje od 40 % |
| Jezičar | 40–manje od 47 % |
| Lektor | 47–manje od 54 % |
| Književnik | 54–manje od 61 % |
| Jezikoslovac | 61–manje od 68 % |
| Doktor riječi | 68–manje od 75 % |
| Jezični maestro | 75–manje od 82 % |
| Gospodar rječnika | 82–manje od 89 % |
| Kaladont | 89 % ili više |

## XP i razine

XP je trajni napredak, ali nije rezultat partije i ne mijenja izravno rang. Dodjeljuje se za normalno završene javne partije; privatne sobe ne daju XP. Razina se računa iz ukupnog XP-a igrača. Maksimalna je razina **100**, a nakon nje dodatni XP više ne povećava razinu.

### Izvori XP-a

| Događaj | XP |
|---|---:|
| Prihvaćena riječ | +5 |
| Duga riječ, 10–11 grafema | dodatnih +10 |
| Srednje duga riječ, 12–14 grafema | dodatnih +20 |
| Jako duga riječ, najmanje 15 grafema | dodatnih +35 |
| Rijetka riječ, frekvencija 10–99 | dodatnih +15 |
| Srednje rijetka riječ, frekvencija 1–9 | dodatnih +30 |
| Jako rijetka riječ, frekvencija 0 i najmanje 4 grafema | dodatnih +50 |
| Izazvana eliminacija | +25 |
| Pobjeda u javnoj partiji | +50 |
| Kaladont / kalodont | zasebnih +100 |

Povećanja za duljinu i rijetkost mogu se dobiti za istu riječ uz osnovni XP za prihvaćenu riječ. Duljina se računa grafemima: `nj`, `lj` i `dž` svaki su jedan grafem. Rijetkost ovisi o frekvenciji u rječniku. Kaladont donosi fiksnih +100 XP umjesto redovnih +5 XP i dodataka za duljinu ili rijetkost.

XP za dugu ili rijetku riječ dobiva se pri njezinu prihvaćanju, neovisno o tome je li igrač ranije otključao leksemsku grupu. Trajna kolekcija riječi i dostignuća su zaseban napredak.

### Niz prihvaćenih riječi tijekom partije

Ovaj se niz broji **tijekom jedne partije**. Svaka uzastopna prihvaćena riječ povećava niz, a odbijena riječ vraća ga na nulu. Najdulji niz u partiji određuje XP-množitelj:

| Najdulji niz prihvaćenih riječi u partiji | XP-množitelj |
|---:|---:|
| 0–2 | ×1,00 |
| 3 | ×1,10 |
| 4 | ×1,25 |
| 5 | ×1,40 |
| 6 | ×1,60 |
| 7 | ×1,75 |
| 8 | ×1,90 |
| 9 ili više | ×2,00 |

Množitelj se primjenjuje na zbroj osnovnih XP stavki u toj partiji. To nije isto što i niz pobjeda kroz više partija.

### Niz pobjeda kroz partije

Niz pobjeda čine uzastopne **javne pobjede** u istom modu. Niz za četiri igrača i niz za dvoboj odvojeni su. Poraz prekida niz u tom modu. Privatne partije ne povećavaju i ne prekidaju javni niz.

Bonus niza pobjeda dodaje se samo XP-u za osvojenu javnu partiju. Počinje od druge uzastopne pobjede; jedna pobjeda sama po sebi ne donosi bonus.

| Uzastopne pobjede u modu | 4 igrača | Dvoboj |
|---:|---:|---:|
| 1 | +0 % | +0 % |
| 2 | +10 % | +5 % |
| 3 | +20 % | +10 % |
| 4 | +30 % | +15 % |
| 5 | +40 % | +20 % |
| 6 | +50 % | +25 % |
| 7 | +60 % | +30 % |
| 8 | +70 % | +35 % |
| 9 | +80 % | +40 % |
| 10 | +90 % | +45 % |
| 11 | +100 % | +50 % |
| 12 | +100 % | +55 % |
| 13 | +100 % | +60 % |
| 14 | +100 % | +65 % |
| 15 | +100 % | +70 % |
| 16 | +100 % | +75 % |
| 17 | +100 % | +80 % |
| 18 | +100 % | +85 % |
| 19 | +100 % | +90 % |
| 20 | +100 % | +95 % |
| 21 ili više | +100 % | +100 % |

Formula je `min(100 %, (broj uzastopnih pobjeda − 1) × 10 %)` za četiri igrača, odnosno `min(100 %, (broj uzastopnih pobjeda − 1) × 5 %)` za dvoboj. Primjerice, treća uzastopna pobjeda u igri za četiri igrača donosi +20 %, a treća pobjeda u dvoboju +10 % dodatnog XP-a prije bonusa ocjene partije.

### Ocjena partije i njezin XP-bonus

Javna partija može dobiti ocjenu od 0 do 5 zvjezdica ako je igrač u njoj imao najmanje **3 prihvaćena poteza**. Ocjena se temelji na prosječnoj promjeni šest osi Kaladont DNK-a; pobjeda dodaje jednu zvjezdicu. Privatne partije ne dobivaju ocjenu.

Za svaku os računa se razlika između vrijednosti nakon i prije partije, a zatim prosjek tih razlika. Osnovna ocjena je zaokruženi rezultat `(prosječna promjena + 20) / 10`, ograničen na raspon 0–4. Pobjedniku se dodaje još jedna zvjezdica, a konačna je ocjena ograničena na 0–5. Ako nakon partije nema nijedne osi, osnovna ocjena je 0; pobjeda i dalje može dodati jednu zvjezdicu.

| Ocjena partije | XP-bonus |
|---:|---:|
| 0 ili 1 zvjezdica | +0 % |
| 2 zvjezdice | +5 % |
| 3 zvjezdice | +10 % |
| 4 zvjezdice | +15 % |
| 5 zvjezdica | +20 % |

Ocjena ne mijenja bodove ni rang. Njezin XP-bonus dodaje se nakon ostalih XP bonusa.

### Redoslijed obračuna XP-a i primjer

1. Zbrajaju se XP stavke za prihvaćene riječi, njihovu duljinu i rijetkost, eliminacije, pobjedu i Kaladont.
2. Zbroj osnovnih XP stavki množi se faktorom niza prihvaćenih riječi u toj partiji.
3. Ako je igrač osvojio javnu partiju, dodaje se bonus njegova niza pobjeda.
4. Ako je igrač imao dovoljno prihvaćenih poteza, dodaje se bonus ocjene partije.
5. Na kraju se primjenjuje ograničenje razine 100. Zato stvarno dodijeljeni XP može biti manji od obračunate sume.

Primjer: osnovne XP stavke iznose 200 XP, faktor niza prihvaćenih riječi je ×1,00, riječ je o trećoj uzastopnoj pobjedi u igri za četiri igrača (+20 %), a ocjena partije je pet zvjezdica (+20 %). Niz pobjeda dodaje 40 XP. Bonus ocjene zatim se računa na 240 XP i dodaje 48 XP. Prije ograničenja razine, partija ukupno donosi 288 XP.

Odbijena riječ prekida niz prihvaćenih riječi unutar partije; poraz prekida javni niz pobjeda u tom modu. To su različiti nizovi, a oba su odvojena od ocjene partije. Igrač koji dobrovoljno napusti partiju ili se ne vrati nakon prekida veze ne dobiva XP za tu partiju.

## Forma i vizualni prikaz niza pobjeda

Forma opisuje najviše posljednjih 10 završenih javnih partija u odabranom modu. U igri za četiri igrača mjeri prosjek bodova, a u dvoboju udio pobjeda. Modovi se ne miješaju.

- S manje od 5 partija prikazuje se prikupljanje podataka, bez naziva forme.
- Nakon 5–9 partija prikazuje se početna procjena na temelju dostupnih rezultata.
- Nakon 10 partija procjena se temelji na punom uzorku od 10 partija.
- Kada postoji 20 rezultata, zadnjih 10 uspoređuje se s prethodnih 10 radi prikaza trenda.

Svaka razina forme određena je pragovima u tablici. U dvoboju se broj pobjeda dijeli brojem partija; u igri za četiri igrača zbroj osvojenih bodova dijeli se brojem partija. Primjerice, 5 pobjeda u 10 dvoboja daje 50 % i formu **Odlična**. Prosjek od 2,50 boda u zadnjih 10 igara za četiri igrača također je **Odlična**.

| Forma | Udio pobjeda u dvoboju | Prosjek bodova za četiri igrača |
|---|---:|---:|
| Loša | manje od 10 % | manje od 0,75 |
| Slaba | 10–manje od 20 % | 0,75–manje od 1,25 |
| Prolazna | 20–manje od 30 % | 1,25–manje od 1,75 |
| Dobra | 30–manje od 50 % | 1,75–manje od 2,50 |
| Odlična | 50–manje od 70 % | 2,50–manje od 3,25 |
| Izvanredna | 70–manje od 80 % | 3,25–manje od 4,00 |
| Sjajna | 80–manje od 90 % | 4,00–manje od 5,00 |
| Top forma | 90 % ili više | 5,00 ili više |

Vatra ovisi o trenutačnom javnom nizu pobjeda, a ne o formi. U igri za četiri igrača razine vatre 1/2/3 počinju na 3/5/8 uzastopnih pobjeda; u dvoboju na 4/8/14 pobjeda. Vatra i obrub ranga samo su vizualni prikazi: ne mijenjaju bodove i ne dodaju poseban XP-bonus.

## Dostignuća

Registrirani igrač ima 10 dostignuća s po pet razina: ukupno **50 razina, odnosno zvjezdica, za otključavanje**. Razina raste kada napredak dosegne sljedeći prag; u jednoj partiji može se prijeći više pragova.

| Dostignuće | Što se broji | Pragovi za razine 1–5 |
|---|---|---|
| Iskusnjara | Dosegnuta razina XP-a | 10, 20, 40, 70, 100 |
| Rijetkolovac | Otkrivene rijetke leksemske grupe | 1, 5, 15, 40, 100 |
| Dugometraš | Odigrane duge riječi | 1, 10, 30, 75, 150 |
| Jezik u plamenu | Najdulji niz prihvaćenih riječi u partiji | 3, 5, 7, 10, 15 |
| Kaladont! | Izvedeni Kaladonti | 1, 3, 10, 25, 50 |
| KA-zna | Ispadanja zbog Kaladonta | 1, 5, 15, 25, 50 |
| Lovac na glave | Izazvane eliminacije | 1, 10, 30, 75, 150 |
| Slijepa ulica | Eliminacije izazvane mrtvim slovima | 1, 5, 15, 40, 100 |
| Završna riječ | Pobjede u javnim partijama | 1, 5, 20, 50, 100 |
| Glas zajednice | Poslane povratne informacije | 1, 2, 3, 4, 5 |

Privatnim partijama mogu napredovati i otključati se samo **Rijetkolovac**, **Dugometraš** i **Jezik u plamenu**. Ostala dostignuća zahtijevaju javnu partiju ili javno stečenu razinu XP-a. Dostignuća ne mijenjaju bodove ni rang.

## Gosti i prijenos napretka na račun

Gosti igraju po istim pravilima riječi i bodovanja, ali nemaju javni rang ni javni profil. Njihova statistika povezana je s gostujućim identitetom na tom uređaju; registracijom se taj identitet i napredak pretvaraju u račun. Registrirani igrač može otvoriti profil i statistiku na drugim uređajima.

Detalji pravila riječi i tijeka partije nalaze se u [Pravila igre](pravila-igre.md). Jezični primjeri i iznimke grafema nalaze se u [Digrafi i grafemi](digrafi-i-grafemi.md).