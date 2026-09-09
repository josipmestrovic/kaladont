# ADR-001: TypeScript monorepo

- **Status:** prihvaćen
- **Datum:** 2026-08-20

## Kontekst

Igra u realnom vremenu traži da klijent i poslužitelj dijele logiku pravila (validacija riječi, grafemi) i tipove protokola. Dva jezika ili dva repozitorija značila bi dupliciranje te logike i neizbježno razilaženje.

## Odluka

Jedan repozitorij, jedan jezik: **TypeScript (strict) svugdje**, organiziran kao **pnpm workspaces monorepo** s radnim prostorima `aplikacije/web`, `aplikacije/posluzitelj`, `paketi/zajednicko` i `skripte/`.

## Razmotrene alternative

- **Odvojeni repozitoriji** — sinkronizacija dijeljenih tipova preko paketa je za tim od jednog do dva čovjeka čisti trošak.
- **Backend u drugom jeziku (Go, Elixir)** — Phoenix/Elixir je izvrstan za realno vrijeme, ali gubi se dijeljenje koda pravila i uvodi drugi ekosustav.

## Posljedice

- Pravila igre pišu se i testiraju jednom, u `paketi/zajednicko`.
- Jedan `pnpm install`, jedan CI, atomarni commitovi preko slojeva.
- Vezani smo uz Node ekosustav — prihvatljivo za predviđeni opseg.
