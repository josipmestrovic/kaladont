# Kaladont — avatar SVG pack 02

60 novih modularnih SVG dodataka u stilu postojećeg avatar kreatora.

| Folder | Kategorija | SVG dodataka |
|---|---|---:|
| `kosa/` | Kosa | 10 |
| `oci/` | Oči | 6 |
| `obrve/` | Obrve | 6 |
| `nos/` | Nos | 4 |
| `usta/` | Usta | 8 |
| `usi/` | Uši | 4 |
| `odjeca/` | Odjeća | 6 |
| `naocale/` | Naočale | 8 |
| `nausnice/` | Naušnice | 4 |
| `brada-i-brkovi/` | Brada i brkovi | 4 |

Svaki SVG je jedan dodatak, s prozirnom pozadinom, bez vidljivih natpisa, ugrađenih rasterskih slika, fontova i vanjskih ovisnosti. `title` je samo pristupačna metapodatkovna oznaka. Datoteke su pravi vektori.

## Pregled

Raspakiraj ZIP i otvori `PREGLED.html` u pregledniku. Radi bez interneta. Možeš kombinirati sve nove dodatke, usporediti ih s izvornim dijelovima, promijeniti boje te vidjeti dodatak samostalno ili na avataru. Originalni dijelovi ugrađeni su u preglednik samo kao referenca.

## Važno za ugradnju

Dijelovi imaju lokalne viewBoxe za postojeći sastav avatara 380 × 380. Nemoj ih centrirati, automatski obrezivati ili pretvarati u jednake 320 × 320 plohe: time se gube sidrišta. Cijeli sastavljeni avatar može se prikazati u bilo kojoj veličini.

Novi ID-jevi počinju s `k2-`; postojeći ID-jevi i datoteke ostaju netaknuti. Boje se mijenjaju istim pravilima kao u trenutnom kreatoru. Usta i nos nemaju vlastiti birač boje u postojećem kodu.

Koža u trenutnom editoru mijenja boju baze `Base-1.svg`; nije zaseban izbor oblika lica. Pozadina se crta u rendereru. Zbog toga su proširene sve 10 kategorija stvarnih dodataka, bez novih baza i pozadina.

`INTEGRACIJA.md` sadrži točne korake za agenta. `manifest.json` sadrži nazive, ID-jeve, putanje, sidrišta i pravila boja. `registracija.ts` sadrži gotove dodatke za registre. Samo kopiranje SVG-ova nije dovoljno: treba registrirati nove izbore u kodu. Repozitorij nije mijenjan ovom isporukom.

## Provjera

Provjerena je SVG struktura svih 60 dijelova, rasterizacija na prozirnoj podlozi i 180 pojedinačnih kompozicija u tri palete. Vizualno su pregledani svi dijelovi na izvornoj bazi, dodatne miješane kombinacije i prikaz pri 96 px. Provjera kompozicije reproducira aktualna sidrišta, redoslijed i regex pravila bojanja; nije zamjena za test spremanja avatara nakon ugradnje u aplikaciju.

Izvorna referenca: `josipmestrovic/kaladont`, commit `87bf60439cda67ab921e4a33683ea2f858c01dbe`. Pripremljeno 1. 10. 2026. Atribucija izvornog sustava nalazi se u `ATRIBUCIJA.md`.
