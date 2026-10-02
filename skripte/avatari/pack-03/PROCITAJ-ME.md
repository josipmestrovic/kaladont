# Kaladont — avatar SVG pack 03

52 nova dodatka: više ženskih frizura i detalja, komične crte lica i prave sunčane naočale. Ovo je dodatni paket. Nema ponovljenih SVG asseta iz packa 02; svi novi ID-jevi počinju s `k3-`.

| Folder | Kategorija | Novih SVG-ova |
|---|---|---:|
| `kosa/` | Kosa | 12 |
| `oci/` | Oči | 5 |
| `obrve/` | Obrve | 3 |
| `nos/` | Nos | 5 |
| `usta/` | Usta | 6 |
| `usi/` | Uši | 4 |
| `odjeca/` | Odjeća | 4 |
| `naocale/` | Naočale | 6 |
| `nausnice/` | Naušnice | 5 |
| `brada-i-brkovi/` | Brada i brkovi | 2 |

## Što je novo

- 12 frizura: duga ravna i valovita kosa, repovi, pletenice, punđice, bob s mašnom i druge varijante.
- Trepavice, naglašene oči, usne s ružem, bluze i viseće naušnice. Dijelovi nisu ograničeni po spolu; svi se slobodno kombiniraju.
- Ogromne klempave, lepezaste, vilenjačke i viseće uši; pet pretjeranih nosova; tri potpuno bezuba osmijeha i drugi izrazi.
- Šest sunčanih naočala s potpuno neprozirnim tamnim lećama. Boja okvira može se promijeniti bez posvjetljivanja leća.
- Dvije komične varijante brkova.

## Pregled

Raspakiraj ZIP. `PREGLED-KOMBINACIJA.png` prikazuje gotove primjere. Otvori `PREGLED.html` za interaktivno kombiniranje i promjenu boja, bez interneta. Možeš prikazati samo SVG dodatak na šahovskoj prozirnoj podlozi ili cijeli avatar.

52 SVG datoteke imaju prozirnu pozadinu i čistu vektorsku geometriju. Nemaju ugrađene rasterske slike, vidljive natpise ni vanjske ovisnosti. Kružna pozadina i originalna baza lica postoje samo u pregledniku i PNG primjerima. Originalni dijelovi ugrađeni u HTML služe usporedbi; nisu kopirani u kategorijske foldere niti se broje u novih 52.

## Obavezno pri ugradnji

Pročitaj `INTEGRACIJA.md`. Registracijski podaci su u `registracija.ts` i `manifest.json`.

20 dodataka ima proširen lokalni okvir: 11 frizura, 5 nosova i 4 uha. Gornja sidrišta glave i ključna mjesta spajanja su očuvana, ali renderer za te ID-jeve mora preuzeti `frame` vrijednosti iz manifesta. Bez toga bi se duga kosa, velike uši i nosovi stisnuli u stare okvire. Ostala 32 dodatka koriste stare dimenzije slojeva.

Ne centrirati, automatski obrezivati niti pretvarati sve dodatke u 320 × 320 SVG-ove. Oni su dijelovi kompozicije 380 × 380; gotovi avatar se može prikazati u bilo kojoj veličini.

Paket je provjeren kroz SVG validaciju, rasterizaciju svih 52 asseta na prozirnoj podlozi i 156 pojedinačnih kompozicija u tri palete. Svi dijelovi vizualno su pregledani na bazi avatara, uz dodatne miješane kombinacije i prikaz pri 96 px. Svih šest modela sunčanih naočala pokriva standardne zjenice bez prozirnih piksela, provjereno i uz svijetli okvir. To ne zamjenjuje provjeru spremanja nakon registracije u aplikaciji.

Repozitorij nije mijenjan ovom isporukom. Pripremljeno 1. 10. 2026. prema packu 02 i prethodno pregledanom kreatoru, revizija `87bf60439cda67ab921e4a33683ea2f858c01dbe`.
