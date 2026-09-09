# ADR-007: Rječnik u memoriji poslužitelja

- **Status:** prihvaćen (strukture i brojke ažurirane [ADR-om 013](013-sve-vrste-rijeci-leksemske-grupe.md) — 1,2 M oblika, ~150–200 MB)
- **Datum:** 2026-08-20

## Kontekst

Svaki potez traži tri provjere: postoji li riječ, počinje li na tražena dva grafema i postoji li ijedan neiskorišten nastavak. Uz 30-sekundni timer i više paralelnih stolova, odlazak u bazu po svakom potezu je nepotrebna latencija i opterećenje.

## Odluka

Pri startu poslužitelja aktivne riječi se učitavaju u memorijske strukture: `Set` svih riječi + `Map<prvaDva, Set<rijec>>` po prefiksu. Sve provjere su O(1); dostupnost nastavka provjerava se brojanjem neiskorištenih riječi u skupu prefiksa. Izmjene rječnika primjenjuju se signalom ponovnog učitavanja; aktivne partije zadržavaju svoj snapshot (RS-21).

## Razmotrene alternative

- **Upit u Postgres po potezu** — latencija i opterećenje bez ikakve koristi; rječnik se mijenja rijetko.
- **Redis** — dodatna komponenta bez potrebe: 50–100 tisuća imenica zauzima < 50 MB RAM-a.

## Posljedice

- Start poslužitelja uključuje učitavanje rječnika (sekunde) — health check to uzima u obzir.
- Kod više procesa u budućnosti svaki proces drži vlastitu kopiju (rječnik je read-only) — nema problema konzistentnosti.
