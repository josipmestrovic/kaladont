# Plan implementacije — Kaladont radi lokalno (end-to-end)

> **Status: sve lokalne faze ovog plana (0–9) dovršene.** MVP jezgra igre (red čekanja → partija → kraj) i puni HTTP API
> (registracija, profil, ljestvica, povijest, prijave, admin) rade lokalno, verificirano 50 automatiziranih
> testova (24 posluzitelj + 26 zajednicko) i ručnim testiranjem u pregledniku + `simulacija` skriptom.
>
> **Granica ovog statusa:** faze 0–9 u ovom dokumentu opisuju lokalnu aplikacijsku implementaciju. Produkcijska spremnost zasebna je, još nedovršena Faza 8 iz [plana razvoja](docs/08-plan-razvoja/faze-razvoja.md). Docker, CI/CD, VPS, pravi email i backup/recovery ne smatraju se dovršenima ovim statusom.
>
> Radni dokument za praćenje implementacije. Svaka faza je zasebna, testabilna cjelina — radimo ih redom, jednu po jednu, uz potvrdu prije prelaska na sljedeću.
>
> Izvor istine za pravila/arhitekturu/model podataka je `docs/` — ovaj plan ih ne mijenja, samo raspoređuje posao. Vidi posebno: [pravila-igre.md](docs/02-pravila-igre/pravila-igre.md), [rubni-slucajevi.md](docs/02-pravila-igre/rubni-slucajevi.md), [protokol-poruka.md](docs/03-arhitektura/protokol-poruka.md), [model-podataka.md](docs/03-arhitektura/model-podataka.md), [pregled-arhitekture.md](docs/03-arhitektura/pregled-arhitekture.md).

## Napomena: timer poteza isključen tijekom ručnog testiranja

`.env` lokalno ima `ONEMOGUCI_TIMER_POTEZA=true` — poslužitelj ne eliminira automatski igrača zbog isteka 30 sekundi (vidi [postavljanje-okoline.md](docs/06-razvoj/postavljanje-okoline.md)). Pravilo od 30 s ostaje službeno i implementirano u `igra/motor-partije.ts`; ovo je isključivo prekidač za udobnije ručno testiranje. **Prije bilo kakvog "produkcijskog" ponašanja postaviti na `false` ili izbrisati.**

## Stanje na početku ovog plana

Već postoji i radi:

- Monorepo scaffold (pnpm workspaces, TS strict, ESLint/Prettier).
- `paketi/zajednicko`: `grafemi.ts`, `pravila.ts` (`validirajPotez`, `odrediRazlogMrtvihSlova`), `bodovanje.ts` (`izracunajBodove`), `protokol.ts` (svi tipovi), `poruke.ts`. 21 Vitest test, svi zeleni.
- `aplikacije/posluzitelj`: Drizzle shema (7 tablica), `rjecnik/ucitaj.ts` (učitavanje u memoriju), Fastify + Socket.IO instanca, `/zdravlje` health endpoint. **Socket.IO nema registrirane handlere.**
- `aplikacije/web`: SvelteKit skeleton (`/`, `/red`, `/partija/[id]`) — statične stranice, bez logike.
- `skripte/uvoz-rjecnika`: napisan cjevovod, **još nije pokrenut** (rječnik u bazi prazan).
- PostgreSQL 16 native, baza `kaladont_dev`, migracije primijenjene.

## Opseg ovog plana

Uključeno: jezgra igre (red čekanja → partija → kraj) **i** puni HTTP API (registracija/prijava, profil, ljestvica, povijest, prijave grešaka, osnovni admin uvid u rječnik). Identitet u prvoj radnoj verziji je **samo gost token** (nasumični UUID) — registracija/prijava dolazi kao zasebna faza nakon što jezgra igre radi.

Isključeno (van opsega, ostaje dokumentirano za kasnije): CI/CD, VPS provisioning, Umami analitika, rate-limit finese preko osnovnog, e2e Playwright testovi, buduće značajke iz `08-plan-razvoja/`.

## Lokalne faze ovog dokumenta

### Faza 0 — Uvoz rječnika (izvodi se odmah, prije ostatka)

- Pokreni `pnpm --filter uvoz-rjecnika start`: preuzimanje hrLex 1.3 (MD5 provjera), filtar `Nc.sn`, čišćenje, parsiranje grafema, upis u `rijeci` + `izmjene_rjecnika`.
- Provjera: broj uvezenih riječi, mrtvi parovi, 30 nasumičnih riječi za pregled (uvoz-rjecnika.md).
- Bez ovoga nijedan sljedeći korak nema smisla testirati (svaka riječ bi bila odbijena).

### Faza 1 — Gost identitet + Socket.IO autentikacija

- Web: generiranje/čitanje gost UUID-a iz `localStorage` (`src/lib/identitet.ts`), slanje kao `token` u Socket.IO handshake (`PodaciVeze`).
- Poslužitelj: middleware pri `io.use()` koji razrješava `token` → `igracId` (INSERT novog gosta u `igraci` ako ne postoji, ili UPDATE `zadnja_aktivnost`); generira nadimak (npr. `VeseliJež42`) ako je nov.
- RS-18: jedna aktivna veza po identitetu — nova zamjenjuje staru (server drži `Map<igracId, socketId>`).
- Testovi: integracijski (socket.io-client) — spajanje, dodjela nadimka, zamjena stare veze.

### Faza 2 — Red čekanja (server + web `/red`)

- Poslužitelj: spoji postojeći `RedCekanja` (već napisan skeleton u `red/red-cekanja.ts`) na Socket.IO evente `red:udji` / `red:izadji`; emitiraj `red:stanje` svima u redu pri svakoj promjeni (RS-16, RS-17).
- Prosjek čekanja zadnjih 100 partija: upit nad `sudionici_partije.cekanje_ms` (keširan u memoriji, osvježava se pri početku partije) — vidi model-podataka.md.
- Kad `pokusajSastaviStol()` vrati 4 igrača → prijelaz u Fazu 3 (kreiranje partije).
- Web: `/red` se spaja na socket, prikazuje `StanjeReda` (4 mjesta, prosjek čekanja), redirect na `/partija/[id]` pri `partija:pocetak`.

### Faza 3 — Engine partije (`igra/`)

- Stanje stola u memoriji: sjedala, trenutni napadač/na potezu, iskorištene riječi (cijela partija), runda, timer (30s, poslužitelj je sat — RS-14).
- Obrada `potez:rijec`: `validirajPotez()` iz `zajednicko` → `potez:prihvacen` ili `potez:odbijen`; nakon prihvaćanja `odrediRazlogMrtvihSlova()` za automatsku eliminaciju sljedećeg (RS-02/RS-03).
- Obrada `potez:ne-znam`, istek timera, `partija:izadji`, prekid veze (RS-09/RS-10/RS-11/RS-12/RS-13) → eliminacija, `partija:eliminacija`, `partija:nova-runda` s novim napadačem.
- Kraj partije (1 igrač preostao) → `izracunajBodove()` iz `zajednicko` po igraču → `partija:kraj`.
- Rate limiting poteza (RS-23, 3/s) i reakcija (RS-22, 1/2s).
- Testovi: integracijski — puna simulirana partija (4 socket klijenta, nasumične valjane riječi iz testnog rječnika), istek timera (ubrzani sat), utrka poteza i isteka (RS-14).

### Faza 4 — Upis u bazu

- Pri početku partije: INSERT `partije` (status `u_tijeku`) + `sudionici_partije` (4 retka, sjedala).
- Pri svakom potezu: INSERT `potezi` (runda, redni_broj, vrsta, riječ/trazena_slova, trajanje_ms).
- Pri kraju partije: transakcijski UPDATE `partije` (status `zavrsena`, kraj, pobjednik) + `sudionici_partije` (plasman, bodovi, eliminacije, nacin_ispadanja) + agregati u `igraci` (odigrane, pobjede, eliminacije_ukupno, bodovi_ukupno) — sve u jednoj transakciji (model-podataka.md).

### Faza 5 — Web UI za partiju (`/partija/[id]`)

- Prikaz stola (4 sjedala, nadimci), trenutno traženi grafemi, prsten/broj timera (informativan, server je sat), unos riječi, gumb "Ne znam".
- Prikaz eliminacija (poruka + razlog), emoji reakcije (fiksni skup), promatrački način nakon eliminacije.
- Ekran kraja partije: plasmani, bodovi, novi prosjek/rang.
- Sve UI poruke dolaze iz `poruke.ts` / s poslužitelja — ništa se ne izmišlja na klijentu (konvencije.md).

### Faza 4.5 — Ručna administracija rječnika

- `rjecnik/ucitaj.ts`: interne strukture su `let` unutar closure-a + `ponovoUcitaj()` metoda koja ih zamijeni in-place (RS-21 signal ponovnog učitavanja) bez re-wire-anja referenci koje već drži `igra/motor-partije.ts`.
- `rjecnik/administracija.ts`: `dodajRijec(rijec, razlog)` — normalizacija, izračun grafema, UPSERT u `rijeci`, zapis u `izmjene_rjecnika`. Reusable primitiva — Faza 7 je poziva iz punog admin sučelja.
- `POST /admin/rjecnik/dodaj`: privremeni shared-secret header `X-Admin-Kljuc` (env `ADMIN_TAJNI_KLJUC`) dok Faza 6/7 ne donesu pravu admin autentikaciju; odmah poziva `ponovoUcitaj()` (live, isti proces).
- Dokumentirano u `docs/04-rjecnik/odrzavanje-rjecnika.md`.

### Faza 6 — Registracija i prijava (identitet, faza 2 dokumentacije)

- Fastify rute: `POST /racuni/registracija`, `POST /racuni/prijava`, `POST /racuni/odjava`, `GET /racuni/potvrdi-email`, `POST /racuni/zaboravljena-lozinka`, `POST /racuni/resetiraj-lozinku`.
- `@node-rs/argon2` (argon2id, prebuilt binarni paket) hash lozinke; stateless potpisani token (HMAC nad `SESIJA_TAJNA`, `racuni/tokeni.ts`) umjesto DB sesijske tablice — httpOnly+SameSite=Lax kolačić (`Secure` samo u produkciji) preko `@fastify/cookie`, token se vraća i u JSON tijelu za Socket.IO `auth.token`.
- Socket.IO handshake (`identitet/identitet.ts`) prihvaća i potpisani sesijski token i goli gost UUID; **goli UUID je odbijen** ako red već postoji i nije `gost` (sprječava impersonaciju registriranog računa).
- Gost → registriran: `UPDATE` istog retka u `igraci` (RS-20), statistika ostaje.
- zod scheme za svaki HTTP body; generičke poruke koje ne otkrivaju postoji li račun (prijava, zaboravljena lozinka).
- 7 integracijskih testova zeleno (uklj. ključni sigurnosni test impersonacije).

### Faza 7 — Profil, ljestvica, povijest, prijave grešaka

- `GET /profil`, `GET /ljestvica` (top 100 po prosjeku bodova, min. 10 partija), `GET /povijest/:igracId`, `GET /partije/:partijaId/potezi`.
- `POST /prijave` (partijaId, potezId?, poruka) + admin rute (`GET /admin/prijave`, `POST /admin/prijave/:id/rijesi`, `POST /admin/rjecnik/dodaj|deaktiviraj|vrati`) — zamijenjen privremeni `ADMIN_TAJNI_KLJUC` iz Faze 4.5 pravom provjerom `vrsta==='admin'` iz sesijskog tokena (`racuni/autentikacija.ts`).
- `paketi/zajednicko/src/rangovi.ts` — `izracunajRang()` (Piskaralo prvih 10 partija, zatim pragovi iz bodovanje-i-rangovi.md).
- Web stranice: `/prijava`, `/registracija`, `/profil`, `/ljestvica`, `/admin`; `lib/identitet.ts` prošireno sa sesijskim tokenom (`dohvatiAuthToken`).
- **Poznato ograničenje:** "dodaj iznimku digrafa" iz `odrzavanje-rjecnika.md` nije implementirano kao live admin akcija — iznimke digrafa su hardkodirane u `zajednicko/grafemi.ts` (nema DB tablice za njih), zahtijevaju izmjenu koda + redeploy.
- Admin promocija je ručni SQL (`UPDATE igraci SET vrsta='admin' WHERE email=...`) — nema self-service.
- 22 nova integracijska testa zelena (ukupno 46 sa zajednicko); ručno potvrđeno u pregledniku (registracija čuva statistiku gosta - RS-20).

### Faza 8 — Očvršćivanje (sigurnost + rate limit + testovi)

- Zod validacija `potez:rijec`/`reakcija:posalji` Socket.IO payloada (igra/motor-partije.ts) — neispravan payload se tiho ignorira.
- `@fastify/rate-limit` registriran globalno (100 zahtjeva/min po IP-u); RS-22/RS-23 in-game limiti već postojali i testirani su.
- Property-based test (`fast-check`, paketi/zajednicko/test/svojstveni.test.ts) — zbroj bodova stola = 10 bez samoeliminacija, < 10 s njima, pobjednik uvijek ≥ 5 bodova, plasmani su permutacija {1,2,3,4} (200+50 nasumičnih pokretanja).
- `pnpm --filter posluzitelj simulacija` — 4 socket.io-client bota igraju stvarnim riječima iz baze do kraja partije; ručno pokrenuto i potvrđeno (RS-02 i RS-03 obje prirodno okinute, zbroj bodova = 10).
- Nedostajući DB indeksi iz `model-podataka.md` dodani: `idx_rijeci_prva_dva`, `idx_rijeci_zadnja_dva` (parcijalni, `WHERE aktivna`).

### Faza 9 — Verifikacija end-to-end

1. `pnpm dev` — web + poslužitelj, `/zdravlje` vraća 200. ✅
2. `simulacija` skripta odigrala punu partiju do kraja s ispravnim bodovanjem. ✅
3. Registracija/prijava ručno testirana u pregledniku — statistika gosta preživjela konverziju (RS-20). ✅
4. `/ljestvica` i `/profil` rade (rang "Piskaralo" dok < 10 partija — potvrđeno jediničnim testom `rangovi.test.ts`, stvarnih 10+ partija pod istim identitetom nije ručno odigrano jer `simulacija` svaki put generira nove goste).
5. Svi automatizirani testovi zeleni: **50 ukupno** (24 posluzitelj + 26 zajednicko), uklj. nove RS-09/RS-10 testove (prekid na potezu vs izvan poteza).
6. Ručno/testovima pokrivenI rubni slučajevi: RS-01, RS-02, RS-03, RS-06 (dijakritici) — `pravila.test.ts`; RS-09, RS-10 — `motor-partije.test.ts`; RS-16, RS-17 — `red-cekanja.test.ts`; RS-18 — `identitet.test.ts`; RS-20 — ručno u pregledniku; RS-22, RS-23 — implementirano u motoru (rate limit), nije izdvojen poseban test.
7. **Poznato ograničenje:** RS-14 (utrka poteza i isteka) nije automatski testirana niti ručno provjerena u ovom krugu — zahtijeva `ONEMOGUCI_TIMER_POTEZA=false` (stvarni 30s timer) da bi se scenarij uopće mogao dogoditi; ostavljeno za budući krug prije produkcije.

## Redoslijed rada

Faze 0 i 1 mogu ići paralelno (uvoz rječnika je nezavisan od identiteta). Faza 2 ovisi o 1. Faza 3 ovisi o 2. Faza 4 ovisi o 3 (treba postojeće `partijaId`/potezi). Faza 5 ovisi o 2+3 (treba evente). Faza 6 nezavisna od 2-5, ali logički dolazi nakon što jezgra igre radi. Faze 7-8 dolaze nakon 6. Faza 9 na kraju.

## Status

- [x] Faza 0 — Uvoz rječnika (32.846 riječi uvezeno, MD5 provjeren, mrtvi parovi nt/onj potvrđeni)
- [x] Faza 1 — Gost identitet + Socket.IO autentikacija (io.use() middleware, RS-18, 3 integracijska testa zelena)
- [x] Faza 2 — Red čekanja (red:udji/izadji/stanje, RS-16/17, /red UI spojen na socket, 2 integracijska testa zelena; stub partija:pocetak do Faze 3)
- [x] Faza 3 — Engine partije (igra/motor-partije.ts: otvaranje runde, potez:rijec/ne-znam, RS-02/03/09/10/14/22/23, partija:kraj + bodovanje; 3 integracijska testa zelena, uklj. stvarna riječ iz uvezenog rječnika)
- [x] Faza 4 — Upis u bazu (partije/sudionici_partije/potezi + transakcijski agregati u igraci pri kraju partije; ručno provjereno u bazi)
- [x] Faza 5 — Web UI za partiju (stol, timer/trazena slova, unos riječi, "Ne znam", eliminacije, emoji, ekran kraja; globalno stanje igre u +layout.svelte jer partija:pocetak stiže dok je korisnik na /red; svelte-check 0 grešaka)
- [x] Faza 4.5 — Ručna administracija rječnika (ponovoUcitaj() live-reload, rjecnik/administracija.ts, POST /admin/rjecnik/dodaj s privremenim shared-secret headerom; 2 integracijska testa zelena)
- [x] Faza 6 — Registracija i prijava (racuni/tokeni.ts + racuni/rute.ts, argon2id, sesijski token u Socket.IO handshakeu, zaštita od impersonacije; 7 integracijskih testova zelena)
- [x] Faza 7 — Profil, ljestvica, povijest, prijave (profil/prijave/admin rute, zajednicko/rangovi.ts, 5 novih web stranica, pravi admin umjesto ADMIN_TAJNI_KLJUC; 46 testova ukupno zeleno)
- [x] Faza 8 — Očvršćivanje (zod validacija, rate-limit, property-based test, simulacija skripta, DB indeksi)
- [x] Faza 9 — Verifikacija end-to-end (50 testova zeleno, simulacija uspješna, ručna provjera registracije/profila/ljestvice; RS-14 ostaje poznato ograničenje za budući krug)
- [x] Faza 10 — Proširenje rječnika na sve vrste riječi (ADR-013): uvoz svih UPOS kategorija iz hrLexa (1.210.654 oblika, 141.039 leksemskih grupa; batch UPSERT, bez po-riječ revizije), stupci `rijeci.vrste`/`rijeci.grupe` (migracija 0004), potrošnja ponavljanja po leksemskoj grupi (RS-28/RS-29) u `zajednicko` + motoru partije, poruka odbijanja s potrošenim oblikom, `--analiza` mod uvozne skripte (RAM gate: ~150 MB heapa), obavezna `vrsta` u admin dodavanju, javna ruta `GET /rjecnik/statistika` + blok statistike po kategorijama na naslovnici (sortirano silazno); 62 testa zelena (33 zajednicko + 29 posluzitelj)
