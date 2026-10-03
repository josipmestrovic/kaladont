# Kaladont — 5 setova kursora

15 zasebnih transparentnih PNG asseta. Svaki asset ima točno **80 × 80 px** i RGBA prozirnost.

Svaki tematski folder sadrži:

- `normal.png` — osnovna strelica.
- `hover.png` — rukica s ispruženim kažiprstom.
- `klik.png` — ista rukica sa savijenim kažiprstom.

Setovi: **Klasik**, **Vitez**, **Čudovište**, **Čarobnjak** i **Kaladont**.

## Željeno ponašanje

Naziv `hover.png` opisuje raspoloživo stanje rukice; **nije obvezno prebacivanje pri hoveru**. Za traženo ponašanje poput kursora u kartaškoj igri koristi `hover.png` kao stalnu rukicu na cijelom području igre, `klik.png` dok je primarna tipka pritisnuta i ponovno `hover.png` nakon otpuštanja. Prelazak preko gumba ili drugih elemenata ne mijenja izgled.

`normal.png` je uključena strelica za zasebnu osnovnu opciju. Promjena između strelice i stalne rukice može biti eksplicitan izbor igrača, umjesto posljedice hovera.

## Pregled

Raspakiraj ZIP i otvori `PREGLED.html`. Galerija prikazuje sva tri stanja u stvarnoj veličini; probna zona omogućuje odabir seta, stalnu rukicu ili strelicu te klik animaciju bez hover prebacivanja. `PREGLED.png` je brzi pregled pet setova na svijetloj i tamnoj podlozi.

## Ugradnja

`kursori.json` sadrži putanje i `hotspot` za svaki asset. Hotspot je stvarna točka klika u koordinatama slike, a ne sredina slike. Koristi vrijednosti pojedinog asseta u `cursor: url(...) x y, auto`.

Rukica i klik iz istog seta imaju isti hotspot i zajednički okvir izvoza. Savijanje prsta ne smije promijeniti stvarno mjesto klika. Ne obrezivati transparentnu prazninu klik slike niti je neovisno povećavati da ponovno popuni kadar.

Na `pointerdown` primarne tipke odaberi klik stanje, na `pointerup` vrati osnovno stanje. Vrati osnovno stanje i na `pointercancel`, gubitak fokusa prozora i skrivanje dokumenta. Ne dodavati poseban `:hover { cursor: ... }` za gumbe ako želiš stalnu rukicu. Na dodirnim uređajima ostaje standardno ponašanje bez umjetnog kursora.

Pregled je samostalna demonstracija, ne izmjena produkcijskog repozitorija. Nakon ugradnje provjeriti ponašanje u ciljanim preglednicima.

## Stil i izrada

Izrađeno ugrađenim ImageGenom uz prethodne Kaladont ikonice kao vizualnu referencu. Debeli tamni obrub, topla krem, mint zelena, zlatnožuta i narančasta paleta; jednostavan crtež za mali prikaz. Ovo nisu SVG avatari iz prethodnih paketa.

Finalni PNG-ovi dobiveni su iz generiranih slika uz zajedničko kadriranje parova rukica/klik i smanjivanje na 80 × 80 px. Promptovi su u `PROMPTOVI.md`.
