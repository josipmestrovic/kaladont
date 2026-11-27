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

Lokalni web origin-i na portovima `5173` i `5174` dopušteni su za HTTP i Socket.IO. Razvojni
poslužitelj ne vjeruje `X-Forwarded-*` zaglavljima; `trustProxy` se uključuje samo iza Caddyja na
stagingu i produkciji.

## Varijable okoline (`.env.primjer`)

| Varijabla                   | Opis                                                                                                                                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BAZA_URL`                  | PostgreSQL konekcijski string                                                                                                                                                                                 |
| `SESIJA_TAJNA`              | Tajna za potpisivanje sesija                                                                                                                                                                                  |
| `EMAIL_API_KLJUC`           | Resend ključ (u razvoju prazan → mailovi se ispisuju u konzolu)                                                                                                                                               |
| `JAVNA_ADRESA`              | Javna osnova za email poveznice; lokalno `http://localhost:3000`, staging `https://staging.kaladont.hr`, produkcija `https://kaladont.hr`                                                                     |
| `DEV_MAIL`                  | Adresa za notifikacije prijava                                                                                                                                                                                |
| `UMAMI_URL` / `PUBLIC_UMAMI_URL` | Prazno u razvoju i na stagingu. U produkciji `https://analitika.kaladont.hr` nakon uključivanja ([runbook-umami.md](../07-operacije/runbook-umami.md)). Compose mapira `UMAMI_URL` → `PUBLIC_UMAMI_URL`. |
| `UMAMI_WEBSITE_ID` / `PUBLIC_UMAMI_WEBSITE_ID` | Prazno = tracker se ne učitava. Vrijednost iz Umami dashboarda nakon bootstrapa. |
| `UMAMI_BAZA_LOZINKA`, `UMAMI_APP_SECRET` | Samo produkcijski Compose za Umami servis; staging i lokalno ne trebaju. |
| `ONEMOGUCI_TIMER_POTEZA`    | Lokalno i **staging QA** — vidi napomenu ispod. Staging Compose zadano `true`. U produkciji mora biti `false` ili izbrisano.                                                                                    |
| `ODGODA_POCETKA_PARTIJE_MS` | Jedno početno odbrojavanje (3 s) nakon što je poslužitelj spreman: u javnoj čekaonici, na stolu u privatnoj/treningu/izazovu. Zadano 3000 ms; testovi/CI postavljaju 0. Lokalni override `0` samo za brži razvoj. Neovisno o `ONEMOGUCI_TIMER_POTEZA`. |
| `TOLERANCIJA_PREKIDA_MS`    | Tolerancija mrežnog prekida tijekom aktivne partije. Zadano 10000 ms; staging i produkcija zahtijevaju točno tu vrijednost. Timer poteza ne pauzira se.                                                       |
| `POSLUZUJ_WEB`              | `true` kada isti Fastify proces treba posluživati izgrađeni SvelteKit frontend; u lokalnom razvoju ostaje `false`.                                                                             |
| `TRENING_OMOGUCEN`          | Zagrijavanje protiv „Računala” (ADR-017). Zadano `true`; `false` isključuje pokretanje novih treninga.                                                                                              |
| `BOTOVI_DVOBOJ`, `BOTOVI_TROBOJ`, `BOTOVI_CETVEROBOJ` | Popuna javnog reda botovima po modu (Dvoboj ~30 s; Troboj ~20/30 s; Četveroboj ~20/30/40 s). Staging Compose zadano `true` (uz seedani fond); lokalni `.env.primjer` i produkcijski Compose zadano `false` (opt-in). Isključivanje zaustavlja nove rezervacije. |
| `MAKSIMALNO_AKTIVNIH_TRENINGA` | Gornja granica istodobnih treninga, odvojena od javnog limita partija. Zadano 100.                                                                                                             |
| `BOT_NEZNANJE_U_MALOM_SKUPU`, `BOT_VJEROJATNOST_AGRESIVNOSTI`, `BOT_VJEROJATNOST_SHIELDA`, `BOT_PRIORITET_POOLOVA` | Politika V8 C10+: neznanje 0.1 u malom skupu; agresivnost 0.3 / Shield 0.6 zadano (Iskusni); prioritet `p2_p1` ili `p1_p2`. Stari `BOT_VJEROJATNOST_TAKTICKOG_POTEZA` / `BOT_MAKS_TAKTICKIH_KANDIDATA` se ne čitaju. Na primljeni „ka” bot uvijek igra `kaladont`. Vidi [botovi.md](../02-pravila-igre/botovi.md). |
| `BOTOVI_BRZI_RAZVOJ` | Samo `development`: zadano ubrzava javnu **popunu** na 1 s. Tempo poteza bota ostaje ~4 s (±0,3 s). `false` vraća realna odstupanja pragova popune; ne ubrzava staging, produkciju ni `test`. |

Javne bot identitete stvara `pnpm --filter posluzitelj seed-botova -- --broj=40` (idempotentno, najviše 100). Ponovno pokretanje ne mijenja postojeće botove ni ljudske račune. Bez seeda popuna reda ostaje bez botova iako je zastavica uključena.

Taktičke poolove (P1/P2) sije `pnpm --filter posluzitelj seed-bot-poolova` (idempotentno; ne oživljava obrisane članove). Migracija može već primijeniti seed; CLI je za ručni reimport na postojećoj bazi.

Staging `.env` mora sadržavati `JAVNA_ADRESA=https://staging.kaladont.hr` i
Staging email slanje prema bilo kojoj adresi služi za testiranje potvrde i reseta na različitim uređajima.
Staging se ne smije javno dijeliti niti koristiti za stvarne korisnike jer otvoreno slanje omogućuje
zlouporabu Resend računa.

### Isključivanje timera poteza tijekom testiranja

Pravilo od **30 sekundi po potezu** ([pravila-igre.md](../02-pravila-igre/pravila-igre.md)) je službeno pravilo igre i ne mijenja se. Radi udobnijeg ručnog testiranja (da se ne žuri dok se istražuje tijek partije), postavljanjem `ONEMOGUCI_TIMER_POTEZA=true` poslužitelj prestaje automatski eliminirati igrača zbog isteka vremena — potez ostaje otvoren dok se ne pošalje riječ ili "Ne znam".

- **Lokalno i staging** smiju imati `true` (staging Compose za QA #100). **Produkcija mora biti `false`** — startup odbija `true`.
- Na stagingu botov potez bez roka traje ~3 s dok ima aktivnog čovjeka, ~0,2 s kad ostanu samo botovi. Pragovi ulaska botova u red ostaju normalni (20/30/40 s).
- Ne utječe na ostala pravila (RS-02/RS-03 mrtva slova i dalje eliminiraju odmah; RS-22/RS-23 rate limiti ostaju aktivni; `TOLERANCIJA_PREKIDA_MS` ostaje 10 s).

## Testiranje četiri igrača lokalno

Partija traži 4 igrača — lokalno se testira s **4 kartice u anonimnim prozorima** (svaka dobiva vlastiti gost ID) ili skriptom `pnpm --filter posluzitelj simulacija` koja spaja 4 socket klijenta i odigra partiju nasumičnim valjanim riječima (vidi [testiranje.md](testiranje.md)).

## Česti problemi

- **Rječnik prazan** (igra odbija svaku riječ): korak 6 nije izveden — poslužitelj u logu ispisuje broj učitanih riječi pri startu.
- **Port zauzet:** promijeni portove u `.env`; klijent čita adresu poslužitelja iz okoline, ništa nije tvrdo kodirano.
