# Konvencije

## Jezik — temeljno pravilo projekta

**Sve je na hrvatskom**, uz jednu tehničku iznimku:

| Gdje | Pravilo | Primjer |
|---|---|---|
| Identifikatori u kodu | hrvatski **bez dijakritika** | `rijec`, `igrac`, `zadnjaDvaGrafema()` |
| Tablice i stupci | hrvatski bez dijakritika, snake_case | `sudionici_partije.nacin_ispadanja` |
| Socket.IO događaji | hrvatski bez dijakritika, kebab uz `:` namespace | `potez:ne-znam` |
| Komentari i dokumentacija | puni hrvatski **s dijakriticima** | `// Provjeri dostupnost nastavka` |
| UI tekstovi | puni hrvatski s dijakriticima, u `poruke.ts` | „Sve riječi na 'XY' već su iskorištene" |
| Commit poruke | hrvatski s dijakriticima | vidi dolje |

Zašto bez dijakritika u identifikatorima: TypeScript ih tehnički dopušta, ali stvaraju trajne muke s tipkovnicama, alatima i pretragom. Podaci (sadržaj stupca `rijec`) naravno **sadrže** dijakritike.

## Imenovanje

- Funkcije glagolski: `validirajPotez()`, `izracunajBodove()`, `ucitajRjecnik()`.
- Booleani upitno: `jeNaPotezu`, `imaNastavak`, `jeIskoristena`.
- Konstante SCREAMING_SNAKE: `TRAJANJE_POTEZA_MS = 30_000`, `BROJ_IGRACA = 4`.
- Svelte komponente PascalCase: `Stol.svelte`, `PrstenTimera.svelte`, `EmojiTraka.svelte`.

## Commit poruke

Format: `glagol u infinitivu + što` (+ opcionalno tijelo s razlogom).

- ✅ `Dodati validaciju klopke u otvaranju runde`
- ✅ `Ispraviti parsiranje digrafa za iznimku "injekcija"`
- ❌ `fix bug`, `update`, `wip`

## Grane

- `main` — uvijek isporučivo; svaka promjena kroz PR sa zelenim CI-jem.
- Radne grane: `znacajka/red-cekanja`, `ispravak/digraf-iznimke`, `docs/pravila-igre`.

## Stil koda

- TypeScript **strict**; `any` zabranjen (ESLint greška), iznimno `unknown` + suženje.
- ESLint + Prettier bez rasprave — format je strojni, ne ljudski posao.
- Bez `console.log` u produkcijskom kodu — struktuirani logger (pino).
- Sve poruke korisniku dolaze **s poslužitelja ili iz `poruke.ts`** — klijent ne izmišlja tekstove pravila.

## Definicija gotovog (za svaki PR)

1. CI zelen (lint + testovi + build).
2. Nova logika pravila ima testove (posebno: svaki RS iz [rubni-slucajevi.md](../02-pravila-igre/rubni-slucajevi.md) koji dotiče).
3. Ako mijenja ponašanje igre → ažuriran odgovarajući dokument u `docs/` (dokumentacija i kod putuju zajedno).
4. Nijedan tekst vidljiv korisniku nije na engleskom.
