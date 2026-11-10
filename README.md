# Kaladont

Hrvatska online višeigračka igra riječi: reci riječ koja počinje na posljednja dva grafema prethodne. Igraj na [kaladont.hr](https://kaladont.hr). Staging je na [staging.kaladont.hr](https://staging.kaladont.hr).

## Kako se igra

- **Dvoboj** — 2 igrača, 30 s po potezu.
- **Četveroboj** — 4 igrača, 30 s po potezu, ispadanje do posljednjeg.
- **Privatna soba** — 2 do 8 igrača; vlasnik bira trajanje poteza (15 / 30 / 60 s ili bez tajmera) i dopuštene vrste riječi.
- **Zagrijavanje** — trening Dvoboja protiv računala, bez natjecateljske statistike.
- U javnom redu prazna mjesta nakon pragova mogu popuniti **botovi**; ljudima vrijedi isti obračun.

Službena pravila: [docs/02-pravila-igre/pravila-igre.md](docs/02-pravila-igre/pravila-igre.md).

## Značajke

- Računi (gost, registracija, potvrda emaila, profil), rangovi, javne ljestvice, XP, dostignuća, dnevne i tjedne misije
- Kolekcija riječi, Kaladont DNK, editor avatara, sandučić/obavijesti
- Povijest partije, prijave grešaka u rječniku, admin alatke
- Rječnik izveden iz [hrLex 1.3](http://hdl.handle.net/11356/1232) (CLARIN.SI, CC BY-SA 4.0)

## Tehnologije

TypeScript + pnpm monorepo: SvelteKit (web), Fastify + Socket.IO (poslužitelj), PostgreSQL + Drizzle, Docker/Caddy, GitHub Actions CI/CD.

## Struktura repozitorija

```text
aplikacije/web          SvelteKit klijent
aplikacije/posluzitelj  Fastify + Socket.IO + Drizzle
paketi/zajednicko       zajednička pravila i tipovi
skripte/                uvoz rječnika, backup, avatar alati
docs/                   dokumentacija projekta
```

## Lokalno pokretanje

Minimalni koraci (Node, pnpm, lokalni PostgreSQL):

1. Kopiraj [`.env.primjer`](.env.primjer) u `.env` i prilagodi vrijednosti.
2. `pnpm install`
3. Migracije i uvoz hrLexa — vidi [docs/06-razvoj/postavljanje-okoline.md](docs/06-razvoj/postavljanje-okoline.md).
4. `pnpm dev`

Lokalni razvoj nije isto što i produkcijski deploy. Operativni postupci: [docs/07-operacije/](docs/07-operacije/).

## Testiranje

```bash
pnpm lint
pnpm --filter web check
pnpm test
pnpm build
```

Playwright E2E zahtijeva podignutu lokalnu okolinu — detalji u [docs/06-razvoj/testiranje.md](docs/06-razvoj/testiranje.md).

## Dokumentacija

Kazalo i ulazna točka: [docs/README.md](docs/README.md).

## Licence i autorstvo

Javni repozitorij je vidljiv radi transparentnosti, ali **nije open source** — sva prava pridržana. Detalji i atribucije (hrLex, avatar sustav, fontovi, Lucide) u [LICENCA.md](LICENCA.md).

## Kontakt

[info@kaladont.hr](mailto:info@kaladont.hr)
