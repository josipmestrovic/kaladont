# ADR-006: Digrafi nj/lj/dž kao jedno slovo

- **Status:** prihvaćen
- **Datum:** 2026-08-20

## Kontekst

Hrvatska abeceda ima tri digrafa (dž, lj, nj) koji su jedno slovo zapisano dvama znakovima. „Posljednja dva slova" iz pravila igre može značiti dva znaka ili dva grafema — izbor mijenja tijek igre („konj" → „nj" kao dva znaka ili „onj" kao dva grafema).

## Odluka

Igra se na **grafeme**: nj, lj i dž računaju se kao jedno slovo, i na kraju („konj" traži riječ na „onj") i na početku riječi („džamija" pokriva „dža"). Riječi kod kojih slijed nije digraf (npr. „injekcija" = in-jekcija) vode se u **listi iznimaka**.

## Razmotrene alternative

- **Dva znaka** — jednostavnije za implementaciju, ali jezično pogrešno: digraf je jedno slovo hrvatske abecede, a upravo je vlasnik projekta potvrdio da se igra tradicionalno tako igra.

## Posljedice

- Parsiranje grafema (s iznimkama) implementira se u `paketi/zajednicko` i izvodi **jednom pri uvozu** — stupci `prva_dva`/`zadnja_dva` su predizračunati.
- Lista iznimaka je živa — širi se kroz prijave igrača.
- Mrtvi parovi računaju se nad grafemima (uključuju npr. „onj", „edž").
- Detalji i testni slučajevi: [digrafi-i-grafemi.md](../../02-pravila-igre/digrafi-i-grafemi.md).
