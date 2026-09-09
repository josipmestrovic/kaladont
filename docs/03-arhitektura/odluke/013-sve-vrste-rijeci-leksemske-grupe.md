# ADR-013: Sve vrste riječi u rječniku i potrošnja po leksemskoj grupi

- **Status:** prihvaćen
- **Datum:** 2026-09-08

## Kontekst

Rječnik je od ADR-005 sadržavao isključivo opće imenice u nominativu jednine (~33 tisuće oblika). Povratne informacije testera pokazale su da igrači prirodno pokušavaju priloge, zamjenice, pridjeve i glagole — usmena tradicija Kaladonta ne poznaje gramatički filtar. Otvaranje svih oblika donosi dva problema koje je trebalo riješiti dizajnom: (1) paradigma jedne riječi ne smije postati neiscrpan izvor „novih" poteza (dobar/dobra/dobro/dobrima…), (2) rječnik raste s ~33 tisuće na ~1,2 milijuna oblika pa pretpostavke ADR-007 o memoriji treba ponovno provjeriti.

Analiza hrLexa (Faza 0, izvještaj u `skripte/uvoz-rjecnika/podaci/`) izmjerila je: 1.210.660 jedinstvenih oblika, 141.046 leksemskih grupa, serverske strukture ~150 MB heapa, 114 mrtvih parova („nt" ostaje mrtav), trajanje parsiranja ~30 s.

## Odluka

1. **Uvoze se sve vrste riječi** iz hrLexa, u svim oblicima (svi padeži, brojevi, rodovi, stupnjevi, konjugirani oblici, klitike): imenice, glagoli (uklj. pomoćne), pridjevi, prilozi, zamjenice (uklj. UD `DET`), brojevi, prijedlozi, veznici, čestice, uzvici. Vlastita imena (`PROPN`), kratice, interpunkcija i strani znakovi i dalje otpadaju; rimski brojevi (`NumForm=Roman`) se isključuju. Riječi s manje od **2 grafema** ne ulaze (ne mogu nikad biti valjan potez).
2. **Potrošnja po leksemskoj grupi:** svaka riječ pripada jednoj ili više grupa s ključem `vrsta:lema`, a za pridjeve i priloge `vrsta:lema:stupanj` (pozitiv/komparativ/superlativ su **zasebne** grupe). Prihvaćen potez troši **sve grupe** kojima oblik pripada; svaki kasniji oblik iz potrošene grupe odbija se porukom koja navodi oblik koji je grupu potrošio. Glagolski vid razdvaja grupe (pisati ≠ napisati) jer su u hrLexu različite leme.
3. **Homografi/višekategorijski oblici** („dobro" = imenica + pridjev + prilog): jedan redak u tablici `rijeci` sa stupcima `vrste text[]` i `grupe text[]`; odigravanje troši sve navedene grupe.
4. **Riječi „kaladont"/„kalodont"** zadržavaju posebni status (izvan grupa, smiju se ponavljati).
5. Tablica `rijeci` ostaje izvor istine s predizračunatim `prva_dva`/`zadnja_dva`; igra i dalje radi isključivo iz memorije (ADR-007), uz interniranje grupa u brojčane ID-jeve (nazivi grupa ne žive u RAM-u igre).

## Razmotrene alternative

- **Zaključavanje pridjeva na jedan rod / glagola na infinitiv** — jednostavnije, ali proizvoljno: igraču je nemoguće objasniti zašto „dobra" nije riječ. Odbačeno u korist grupa.
- **Potrošnja samo primarne kategorije oblika** — nakon „dobro" prolazi „dobra"; igrači to doživljavaju kao ponavljanje. Odbačeno.
- **Zajednička grupa za sve stupnjeve pridjeva** — „dobar" bi trošio i „bolji"/„najbolji"; komparativ je semantički dovoljno različit da ostane zaseban. Odbačeno.
- **Prag frekvencije pri uvozu** — i dalje odbačen (dosljedno ADR-005): čišćenje ide kroz prijave igrača.

## Posljedice

- **Balans igre se mijenja:** mrtvih parova je malo (114), a riječi koje na njih završavaju ~2 tisuće — eliminacije „mrtvim slovima" postaju rjeđe, partije potencijalno dulje; prati se simulacijom i metrikama nakon objave.
- Memorija poslužitelja raste s < 50 MB na ~150–200 MB — i dalje komotno unutar CX23 (4 GB), ali ADR-007 brojka je zastarjela.
- Uvoz mora biti grupni (batch UPSERT); pojedinačni INSERT-i po riječi i po-riječ revizijski zapisi u `izmjene_rjecnika` ne skaliraju na milijun redaka — masovni uvoz bilježi se sažetkom, a `izmjene_rjecnika` ostaje za ručne izmjene.
- Poruka odbijanja mora znati **koji** je oblik potrošio grupu → partija pamti mapu grupa → oblik.
- Atribucijski tekst prema CLARIN.SI (CC BY-SA 4.0) mora se ažurirati: izvedeni popis više nije „samo opće imenice".
