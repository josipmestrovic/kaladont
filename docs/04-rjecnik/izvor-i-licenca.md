# Izvor rječnika i licenca

## Izvor

Baza riječi izvedena je iz flektivnog leksikona **hrLex 1.3**:

> Ljubešić, Nikola, 2019, *Inflectional lexicon hrLex 1.3*, Slovenian language resource repository CLARIN.SI, ISSN 2820-4042, <http://hdl.handle.net/11356/1232>

- 6 427 709 oblika riječi / 164 206 lema
- Svaki zapis: oblik, lema, MSD oznaka (MULTEXT-East V6 za hbs), UD oznake, frekvencija iz korpusa hrWaC v2.2
- Preuzimanje: `hrLex_v1.3.gz` (~52 MB) s repozitorija CLARIN.SI

## Licenca: CC BY-SA 4.0

hrLex je objavljen pod [Creative Commons Imenovanje-Dijeli pod istim uvjetima 4.0](https://creativecommons.org/licenses/by-sa/4.0/deed.hr). Naše obveze:

| Obveza | Kako je ispunjavamo |
|---|---|
| **Imenovanje (BY)** | Citat izvora na stranici „O igri" u aplikaciji + u ovom dokumentu + u `LICENCA.md` |
| **Dijeli pod istim uvjetima (SA)** | Izvedeni popis riječi zadržava CC BY-SA 4.0 |
| Naznaka izmjena | Stranica „O igri" navodi da je popis filtriran (bez vlastitih imena i kratica) i obogaćen stupcima za igru (grafemski parovi, leksemske grupe) |

## Odnos prema kodu projekta

Kod projekta **nije** pod CC BY-SA — SA obveza veže samo izvedene podatke, ne softver koji ih koristi. Zato (vidi [ADR-010](../03-arhitektura/odluke/010-javni-repo-sva-prava-pridrzana.md)):

- izvedeni popis riječi **ne commita se** u repozitorij;
- skripta uvoza preuzima hrLex i gradi bazu lokalno/na poslužitelju;
- ako netko zatraži izvedeni popis, dužni smo ga dati pod CC BY-SA 4.0 — i to je u redu: popis riječi nije naša konkurentska prednost, igra jest.

## Tekst atribucije za stranicu „O igri"

> Popis riječi izveden je iz leksikona **hrLex 1.3** (Nikola Ljubešić, CLARIN.SI, <http://hdl.handle.net/11356/1232>), dostupnog pod licencom CC BY-SA 4.0. Popis je za potrebe igre filtriran (bez vlastitih imena i kratica) te obogaćen podacima za tijek igre (grafemski parovi, leksemske grupe); izvedeni popis dostupan je pod istom licencom na zahtjev.
