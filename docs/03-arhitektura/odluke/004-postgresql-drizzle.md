# ADR-004: PostgreSQL + Drizzle ORM

- **Status:** prihvaćen
- **Datum:** 2026-08-20

## Kontekst

Trebamo trajno pohranjivati igrače, partije, kompletnu povijest poteza, rječnik s revizijskim tragom i prijave. Podaci su izrazito relacijski, a završetak partije traži transakcijski upis preko tri tablice.

## Odluka

**PostgreSQL 16** kao jedina baza (lokalno i u produkciji, u Dockeru) + **Drizzle ORM** za shemu, migracije i tipizirane upite.

## Razmotrene alternative

- **SQLite** — dostajao bi MVP-u, ali migracija na Postgres kasnije je nepotreban rizik; Postgres u Docker Composeu nije ništa kompliciraniji.
- **Prisma** — zreliji, ali teži (vlastiti engine); Drizzle je bliži SQL-u i lakši u monorepu.
- **MongoDB** — relacijski podaci s transakcijama ne pripadaju dokumentnoj bazi.

## Posljedice

- Hrvatske nazive tablica i stupaca definira [model-podataka.md](../model-podataka.md).
- Drizzle migracije verzioniraju shemu u repozitoriju.
- Dnevni `pg_dump` kao sigurnosna kopija (vidi operacije).
