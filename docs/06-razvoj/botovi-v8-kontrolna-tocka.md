# Botovi V8 — Kontrolna točka (V7 vs V8)

Mjerenje i rubovi korektnosti prije taktičkog indeksa. **Bez mergea, bez Commit 09.**

| Polje | Vrijednost |
| --- | --- |
| Datum | 2026-11-27 |
| V8 SHA | `74f27a9` (draft [#167](https://github.com/josipmestrovic/kaladont/pull/167)) |
| V7 SHA | `4cb69ed` (worktree `.worktrees/botovi-v7-4cb69ed`) |
| OS | Windows 10 (build 22000) |
| Node | v24.19.0 (AGENTS.md propisuje 22; lokalno je 24) |
| CPU | AMD Ryzen 5 1600, 12 logičkih jezgri |
| RAM (slobodan tijekom mjerenja) | ~4,3 GB |
| Dataset | `fixture` (ugrađeni harness, **6407** zapisa) — **nije** produkcijski rječnik |
| `KALADONT_BENCH_RJECNIK` | nije korišten |
| Napomena | Lokalni Windows bench — **nije** VPS kapacitet ni produkcijski p95 |

## Metodologija

- Isti harness (`aplikacije/posluzitelj/scripts/benchmark-bot-odziv-runtime.mjs`) u V8 stablu; u V7 worktree kopiran mjerni sloj + `--api=v7-step`.
- **Iskrenost indeksa:** `poznatiKandidatiNa*` / nastavivo skeniraju repertoar (`izgradiRepertoarBotova`, ≤256+256); `imaSlobodnuRijecNa*` skenira **puni** prefiksni niz dataseta + ista `jeIgriva`.
- Seed-baza `42`, zagrijavanje `1`, ponavljanja `≥3`; u tablicama p50/p95 (medUkupno = p50 wall-clock do dovršetka svih poslova u runu).
- Konfig: `vjerojatnostNeznanjaUMalomSkupu=0` za throughput; gameplay razlike nisu perf.
- API varijante: V7 `v7-step` (jedan dugi korak = cijeli `odaberiPotezNastavivo` + `predajSetImmediate`); V8 `v8-slice` (scheduler-owned `ctx.predaj()`, pravi RR).
- **Ne uspoređivati 1:1:** `waitIzmeduSliceova` na V7 ≈ event-loop yield; `objedinjeneAnalize` / predmemorija hitovi V7 (`boolean`) vs V8 (`AnalizaNastavka`).

Siovi JSONL (ne commitati): `bench-rezultati/v{7,8}-{burst-core,burst-spec,razmazano}.jsonl`, `bench-rezultati/v8-microbench.jsonl`.

## Sažetak rezultata

Na fixture datasetu V8 wall-clock (medUkupno) je **~25× brži** od V7 u burst matrici (medijan omjera v8/v7 ≈ **0,038** na 60 sparovanih ćelija). Dominantni uzrok: V7 serializira duge korake → `waitToFirstSlice` raste s brojem poslova; V8 RR slice drži red kratkim.

Pri visokom N, V8 `trajanjaOdabira.p50` raste (wall unutar sliceova/parkinga), dok V7 per-job odabir ostaje ~20–35 ms — to **nije** regresija CPU odabira, nego drugačiji scheduler model.

### Burst — normalan, prefiks `ma` (V7 vs V8)

| Poslova | Aktivnih | V7 med ms | V8 med ms | Δ% | V7 odabir p50 | V8 odabir p50 | V7 wait1 p50 | V8 wait1 p50 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | 2 | 37,7 | 3,5 | −90,6 | 35,4 | 3,4 | 0,01 | 0,07 |
| 10 | 2 | 299,0 | 12,5 | −95,8 | 29,8 | 10,2 | 124,8 | 0,22 |
| 25 | 2 | 714,1 | 28,4 | −96,0 | 27,9 | 25,8 | 338,4 | 0,49 |
| 50 | 2 | 1383,4 | 53,6 | −96,1 | 27,2 | 48,3 | 685,7 | 0,67 |
| 100 | 2 | 2825,4 | 105,2 | −96,3 | 27,6 | 95,8 | 1405,0 | 1,32 |
| 100 | 4 | 2091,7 | 76,5 | −96,3 | 20,4 | 64,9 | 1028,8 | 1,19 |

Težak-taktički burst prati isti omjer (med Δ% ≈ −96 %). Prefiks `ra` (veliki u fixtureu: 801 punih / 512 repertoar) jednako.

### Specijalni scenariji (burst, poslova=10, aktivnih=2)

| Scenarij | V7 med ms | V8 med ms | Δ% | Napomena |
| --- | --- | --- | --- | --- |
| primljeni-ka | 1,06 | 0,47 | −56 | mali kandidatni skup (`ka`) |
| veliki-prefiks | 359,3 | 13,6 | −96 | `ra`, puni 801 |
| gotovo-iscrpljen | 317,2 | 16,9 | −95 | |
| potpuno-iscrpljen | 336,9 | 11,3 | −97 | |

### Razmazano vs burst (normalan, `ma`, aktivnih=2)

| Poslova | Dolazak | V7 med | V8 med | Δ% |
| --- | --- | --- | --- | --- |
| 10 | razmazano | 292 | 45 | −85 |
| 50 | razmazano | 1415 | 232 | −84 |
| 100 | razmazano | 2764 | 477 | −83 |

Razmazano smanjuje V8 prednost u wall-clocku jer stagger sam odgađa dolaske; odabir p50 i dalje znatno kraći na V8 (~3,5 ms vs ~28 ms).

## Microbench (V8, isti stroj)

| Mjerenje | Rezultat |
| --- | --- |
| `potpisPotrosenihGrupa` \|S\|=10 | 0,0011 ms/poziv (200×) |
| \|S\|=100 | 0,010 ms |
| \|S\|=1 000 | 0,088 ms |
| \|S\|=10 000 | 0,76 ms; potpis ~169 KB |
| `uzorkujPonderirano` n=200→k=100 | 0,18 ms/uzorak; frekvencija pozvana 200× po uzorku |
| Indeksiranje 4000 zapisa / 5 prefiksa | 0,57 ms |
| `izgradiRepertoarBotova` | 22,5 ms |

**Nalaz B:** potpis je O(\|S\| log \|S\|) zbog sortiranja; na 10k grupa ~0,8 ms po odluci — prihvatljivo kao jedan poziv po odluci, ali raste s potrošenim skupinama. **Nije optimizirano** u ovoj točki (nije očit bottleneck na fixtureu).

## Ljudski potez / emit

**NIJE IZMJERENO.** Nema tanak, izolirani in-memory put koji pouzdano mjeri wall-clock od `prihvatiPotez` do emit/stanja bez staginga / punog motora u ovoj kontroli. Ne izmišljati brojeve.

## Rubovi korektnosti

### A. Verzija rječnika + stale `odustani`

**POTVRĐENO (repro harness).** `BotKontroler.pokusajIzvrsitiPlan` (~493–498): pri mismatchu verzije, ako je plan `odustani`, **odmah** `izvrsi` stale odluke; `rijec` ide na re-račun.

Repro (prazan repertoar → plan `nema_rijeci` → bump verzije + `mama` prije thinking timera → izvršen `odustani` na verziji 2):

```text
node --import tsx scripts/_tmp-repro-odustani-verzija.mjs
→ REPRO POTVRĐEN: stale odustani izvršen na verziji 2
```

Razlikovanje:

| Razlog | Ponašanje |
| --- | --- |
| `namjerni_propust` | Namjerno sačuvan preko verzije (postojeći test „promjena rječnika čuva već odabrano neznanje”) |
| `bot_duel_limit` | Forsiran limit, nije „nedostatak riječi” |
| `nema_rijeci` | Danas se stale izvrši — **proizvodni rub**; C08 cache/otkazano **ne** pokriva |

**Popravljeno nakon kontrole** (`fix(botovi): osvježi odustajanje nakon promjene rječnika`): `nema_rijeci` ide na ponovni izračun (uz limit osvježavanja); `namjerni_propust` / `bot_duel_limit` ostaju.

### B. `potpisPotrosenihGrupa`

Samo mjerenje (vidi microbench). Alokacija stringa raste linearan s \|S\|.

### C. Taktički scorer

- Sync `odaberiPotez` i nastavivo dijele istu politiku bodova (`dodajBodNastavka`, opasni završeci, KA agresivnost); nastavivo dodaje `predaj` + `AnalizaNastavka` / otkaz.
- Predmemorija V7 vs V8 **nije** 1:1 usporediva.
- Namjerne gameplay razlike V7↔V8 (ne tretirati kao perf): profilne vjerojatnosti; leave/`namjerni_propust` **prije** uzorka; deterministički leave po tokenu; KA grane. Bench forsirao usporedivi throughput konfig (`neznanje=0`).
- Seeded usporedba „ista riječ V7 vs V8” nije tvrđena na cijelom matrici — različiti scheduler i predmemorija mijenjaju međuvrijeme, ne nužno politiku.

## Vitest checklist (uski, lokalno)

Naredba:

```text
pnpm --filter posluzitelj exec vitest run bot-odabir bot-prihvat-odziva bot-profili bot-raspored-odziva bot-repertoar rjecnik-pretraga-nastavaka
```

Rezultat: **6 datoteka, 145 testova, PROŠLO** (~5,2 s). Bez `ci:*` / Playwrighta.

| Stavka | Status |
| --- | --- |
| bot-odabir / prihvat / profili / raspored / repertoar / pretraga nastavaka | PROŠLO |
| Stari trening payload / 4 profila / 1–3 bota | PROŠLO (unutar gornjeg suitea) |
| Klasični / KA / oprezni leave / taktika / oporavak / refresh / otkaz / bot-duel | PROŠLO (bot-odabir) |
| Trening-izazov kraj / 3 ljudska pravilnika (E2E/širi) | NIJE POKRENUTO |
| Puni `ci:*` / Playwright | NIJE POKRENUTO (namjerno) |

## Anomalije i ograničenja

1. Dataset = fixture-simulirano (6407); ne lažno „puni produkcijski rječnik”.
2. V7 `waitIzmeduSliceova` ≠ RR park; interpretirati kao yield.
3. Event-loop lag lokalno ≠ korisnički lag na VPS-u.
4. Node 24 lokalno vs propisani 22 — mogući mali pomaci brojeva.
5. Harness izmijenjen u V8 stablu (honesty + CLI + adapter); produkcijski bot kod **nije** diran u ovoj točki.

## Spremnost za taktički indeks (Commit 09)

**Ne — još ne kao sljedeći korak „za performanse”.**

Uvjeti prije C09:

1. Ponoviti matricu s `KALADONT_BENCH_RJECNIK` (produkcijski izvoz) — fixture ne dokazuje skaliranje prefiksa.
2. Nalaz A (`nema_rijeci` + verzija) — **zatvoren** u follow-up fix commit-u.
3. Na velikom rječniku ponovno izmjeriti potpis (|S| u dugoj partiji) i taktički put s pravim nastavcima.
4. V8 burst već daje ~25× bolji wall-clock na konkurentnim botovima — indeks nije hitni bottleneck-fix na ovoj razini dok (1) i (3) nisu zatvoreni.

## Prilog — putanje

| Datoteka | Sadržaj |
| --- | --- |
| `bench-rezultati/v8-burst-core.jsonl` | V8 normalan+težak, burst, 1…100 × 2..4 |
| `bench-rezultati/v7-burst-core.jsonl` | isto, V7 |
| `bench-rezultati/v8-burst-spec.jsonl` | KA / veliki / iscrpljenost |
| `bench-rezultati/v7-burst-spec.jsonl` | isto, V7 |
| `bench-rezultati/v8-razmazano.jsonl` | stagger 10/50/100 |
| `bench-rezultati/v7-razmazano.jsonl` | isto, V7 |
| `bench-rezultati/v8-microbench.jsonl` | potpis / ponder / load |

Worktree V7: `.worktrees/botovi-v7-4cb69ed` @ `4cb69ed` (ne koristiti `.worktrees/bench-prije-b818815`).
