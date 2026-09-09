# Postavljanje razvojne okoline

> **Napomena:** lokalno se koristi **native instalacija PostgreSQL-a** (bez Dockera), jer razvojno računalo nema dostupnu virtualizaciju. Ciljana produkcija koristi Docker Compose kako je opisano u [ADR-009](../03-arhitektura/odluke/009-hetzner-docker-caddy.md) i [produkciji i objavi](../07-operacije/produkcija-i-objava.md) — VPS ima virtualizaciju, ovo je isključivo lokalna razvojna prilagodba i ne mijenja produkcijsku arhitekturu. Docker sliku testira CI smoke test ([ci-cd.md](../07-operacije/ci-cd.md)), pa lokalni Docker nije potreban za deployment. U razvoju web i poslužitelj rade kao dva procesa; ciljano ih u produkciji poslužuje jedan Node proces ([ADR-012](../03-arhitektura/odluke/012-jedan-proces-same-origin.md)).

> **Status produkcije:** Docker slika, Compose/Caddy konfiguracije, CI smoke test i GHCR objava postoje; staging je ručno online. Automatski staging deploy, produkcijski VPS/deploy i backup automatika još nisu implementirani. Ovaj dokument vodi samo do lokalnog Windows razvoja. Budući rad na produkciji smije početi tek nakon production-readiness kontrolne liste iz [Operacije for dummies](../07-operacije/operacije-for-dummies.md); ciljani model definira [ADR-014](../03-arhitektura/odluke/014-operativni-model-mvp-a.md).

## Preduvjeti

| Alat       | Verzija             | Napomena                                                                                                           |
| ---------- | ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Node.js    | 22 LTS (ili noviji) | preko nvm/fnm ili native installer                                                                                 |
| pnpm       | ≥ 9                 | `corepack enable`                                                                                                  |
| PostgreSQL | 16                  | native Windows instalacija (EDB installer / `winget install PostgreSQL.PostgreSQL.16`), servis na `localhost:5432` |
| Git        | aktualan            |                                                                                                                    |

## Koraci

```bash
# 1. Kloniraj repozitorij
git clone <url-repozitorija> kaladont
cd kaladont

# 2. Instaliraj ovisnosti (cijeli monorepo)
pnpm install

# 3. Kopiraj predložak okoline i po potrebi prilagodi
cp .env.primjer .env

# 4. Kreiraj lokalnu rolu i bazu (jednom, preko psql ili pgAdmina)
#    psql -U postgres -h localhost
#    CREATE ROLE kaladont WITH LOGIN PASSWORD 'kaladont';
#    CREATE DATABASE kaladont_dev OWNER kaladont;

# 5. Primijeni migracije sheme
pnpm --filter posluzitelj migracije

# 6. Uvezi rječnik (preuzima hrLex ~52 MB, traje nekoliko minuta)
pnpm --filter uvoz-rjecnika start

# 7. Pokreni sve u razvojnom načinu
pnpm dev
```

Nakon toga:

- Web klijent: `http://localhost:5173`
- Poslužitelj (HTTP + Socket.IO): `http://localhost:3000`
- PostgreSQL: `localhost:5432` (native servis, podaci u standardnom PostgreSQL data direktoriju)

## Varijable okoline (`.env.primjer`)

| Varijabla                   | Opis                                                                                                                                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BAZA_URL`                  | PostgreSQL konekcijski string                                                                                                                                                                                 |
| `SESIJA_TAJNA`              | Tajna za potpisivanje sesija                                                                                                                                                                                  |
| `EMAIL_API_KLJUC`           | Resend ključ (u razvoju prazan → mailovi se ispisuju u konzolu)                                                                                                                                               |
| `DEV_MAIL`                  | Adresa za notifikacije prijava                                                                                                                                                                                |
| `UMAMI_URL`                 | Prazno u razvoju (analitika isključena)                                                                                                                                                                       |
| `ONEMOGUCI_TIMER_POTEZA`    | **Samo za lokalno testiranje** — vidi napomenu ispod. `false` ili izbrisano u produkciji.                                                                                                                     |
| `ODGODA_POCETKA_PARTIJE_MS` | Odgoda početka partije (odbrojavanje u čekaonici), zadano 10000 ms. Testovi postavljaju 0; ne mijenjati u produkciji. Neovisno o `ONEMOGUCI_TIMER_POTEZA` — odbrojavanje radi i s isključenim timerom poteza. |

### Isključivanje timera poteza tijekom testiranja

Pravilo od **30 sekundi po potezu** ([pravila-igre.md](../02-pravila-igre/pravila-igre.md)) je službeno pravilo igre i ne mijenja se. Radi udobnijeg ručnog testiranja (da se ne žuri dok se istražuje tijek partije), postavljanjem `ONEMOGUCI_TIMER_POTEZA=true` u `.env` poslužitelj prestaje automatski eliminirati igrača zbog isteka vremena — potez ostaje otvoren dok se ne pošalje riječ ili "Ne znam". Ovo je isključivo razvojna pogodnost:

- **Mora biti `false` ili izbrisano prije bilo kakvog "produkcijskog" ponašanja** (uključujući demo/review okruženja koja trebaju vjerno oponašati produkciju).
- Ne utječe na ostala pravila (RS-02/RS-03 mrtva slova i dalje eliminiraju odmah; RS-22/RS-23 rate limiti ostaju aktivni).

## Testiranje četiri igrača lokalno

Partija traži 4 igrača — lokalno se testira s **4 kartice u anonimnim prozorima** (svaka dobiva vlastiti gost ID) ili skriptom `pnpm --filter posluzitelj simulacija` koja spaja 4 socket klijenta i odigra partiju nasumičnim valjanim riječima (vidi [testiranje.md](testiranje.md)).

## Česti problemi

- **Rječnik prazan** (igra odbija svaku riječ): korak 6 nije izveden — poslužitelj u logu ispisuje broj učitanih riječi pri startu.
- **Port zauzet:** promijeni portove u `.env`; klijent čita adresu poslužitelja iz okoline, ništa nije tvrdo kodirano.
