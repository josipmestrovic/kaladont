# ADR-010: Javni repozitorij, sva prava pridržana

- **Status:** prihvaćen
- **Datum:** 2026-08-20

## Kontekst

Vlasnik želi javno vidljiv repozitorij radi lakšeg dijeljenja (portfolio, suradnici, transparentnost), ali ne želi da itko legalno preuzme kod i napravi klon igre. Tehnička činjenica: javni git repozitorij se uvijek **može** klonirati — kontrolirati se može samo **pravo korištenja**, ne čin kopiranja.

## Odluka

Repozitorij je **javan**, ali **bez open-source licence**. U korijenu stoji `LICENCA.md` sa „sva prava pridržana": uvid i rasprava dopušteni, svako korištenje, izmjena, distribucija i izrada izvedenih djela zabranjeni bez pisanog odobrenja. Podaci rječnika (derivat hrLexa, CC BY-SA 4.0) izuzeti su iz repozitorija — generiraju se lokalno skriptom, čime kod ostaje zaštićen, a licenca podataka ispoštovana.

## Razmotrene alternative

- **MIT/Apache** — dopušta klonove, suprotno želji vlasnika.
- **AGPL** — ne sprječava klonove, samo ih prisiljava na otvaranje koda.
- **PolyForm Noncommercial** — dopušta više nego što vlasnik želi (nekomercijalne klonove).
- **Privatni repo** — gubi se svrha dijeljenja.

## Posljedice

- GitHub ToS dopušta gledanje i forkanje unutar platforme — to ne daje prava korištenja koda izvan nje.
- Vanjski doprinosi (PR-ovi) zahtijevali bi izjavu o ustupanju prava — dok je ne uvedemo, PR-ove ne prihvaćamo formalno.
- Prelazak na otvoreniju licencu kasnije je uvijek moguć (obratno ne bi bilo).
