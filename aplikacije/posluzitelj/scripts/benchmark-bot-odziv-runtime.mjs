#!/usr/bin/env node
/**
 * Lokalni benchmark nastavivog runtime puta (RasporedjivacOdziva + odaberiPotezNastavivo).
 * Nije dio uobičajenog PR CI. Ne predstavlja produkcijske performanse.
 *
 * Upotreba (iz aplikacije/posluzitelj):
 *   pnpm exec tsx scripts/benchmark-bot-odziv-runtime.mjs
 *   pnpm exec tsx scripts/benchmark-bot-odziv-runtime.mjs "--oznaka=poslije" "--poslova=1,10,25,50,100" "--seed-baza=42"
 *
 * Opcionalni veliki dataset: KALADONT_BENCH_RJECNIK (JSON/JSONL, read-only).
 * Incomplete run (timeout / nedovršeni / pogreške) → non-zero exit.
 */
import { performance } from 'node:perf_hooks';
import { readFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function parseArgs(argv) {
  const out = {
    prefiksi: ['ma', 'ra', 'na', 'po', 'pr'],
    ponavljanja: 3,
    poslova: [1, 10, 25, 50, 100],
    aktivnih: [2, 3, 4],
    oznaka: 'poslije',
    seedBaza: 42,
    timeoutMs: 120_000,
    tezakTakticki: false,
  };
  for (const a of argv) {
    if (a.startsWith('--prefiksi=')) out.prefiksi = a.slice(11).split(',').map((s) => s.trim()).filter(Boolean);
    if (a.startsWith('--ponavljanja=')) out.ponavljanja = Math.max(1, Number(a.slice(14)) || 3);
    if (a.startsWith('--poslova=')) {
      out.poslova = a.slice(10).split(',').map((s) => Number(s.trim())).filter((n) => n >= 1 && n <= 100);
    }
    if (a.startsWith('--aktivnih=')) {
      out.aktivnih = a.slice(11).split(',').map((s) => Number(s.trim())).filter((n) => n >= 2 && n <= 8);
    }
    if (a.startsWith('--oznaka=')) out.oznaka = a.slice(9) || 'run';
    if (a.startsWith('--seed-baza=')) out.seedBaza = Number(a.slice(12)) || 42;
    if (a.startsWith('--timeout-ms=')) out.timeoutMs = Math.max(1000, Number(a.slice(13)) || 120_000);
    if (a === '--tezak-takticki') out.tezakTakticki = true;
  }
  if (out.poslova.length === 0) out.poslova = [1, 10, 25, 50, 100];
  if (out.aktivnih.length === 0) out.aktivnih = [2, 3, 4];
  return out;
}

/** Seed neovisan o --oznaka (prije/poslije). */
function izracunajSeed(seedBaza, scenarij, p, brojPoslova, brojAktivnih, prefiks) {
  let h = seedBaza >>> 0;
  const dijelovi = [scenarij, String(p), String(brojPoslova), String(brojAktivnih), prefiks];
  for (const d of dijelovi) {
    for (let i = 0; i < d.length; i += 1) {
      h = Math.imul(h ^ d.charCodeAt(i), 0x01000193) >>> 0;
    }
    h = Math.imul(h ^ 0x9e3779b9, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

function seededRng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function ugradjeniFixture() {
  const rijeci = [];
  for (const pref of ['ma', 'ra', 'na', 'po', 'pr', 'za', 'la', 'ka']) {
    for (let i = 0; i < 800; i += 1) {
      const rijec = `${pref}${i.toString(36)}x`;
      rijeci.push({
        rijec,
        prefiks: pref,
        grupe: [`imenica:${rijec}`],
        frekvencija: i % 17 === 0 ? 0 : 100 + (i % 900),
        vrste: ['imenica'],
      });
    }
  }
  for (const nast of ['lampa', 'ravan', 'naranča', 'poklon', 'pravda', 'zagonetka', 'kaladont']) {
    rijeci.push({
      rijec: nast,
      prefiks: nast.slice(0, 2),
      grupe: [`imenica:${nast}`],
      frekvencija: 900,
      vrste: ['imenica'],
    });
  }
  return rijeci;
}

function ucitajDataset() {
  const put = process.env.KALADONT_BENCH_RJECNIK;
  if (!put || !existsSync(put)) return { zapisi: ugradjeniFixture(), oznaka: 'fixture' };
  const sirovo = readFileSync(put, 'utf8').trim();
  const zapisi = sirovo.startsWith('[')
    ? JSON.parse(sirovo)
    : sirovo.split('\n').filter(Boolean).map((linija) => JSON.parse(linija));
  return { zapisi, oznaka: 'rjecnik' };
}

/** Snimka u formatu SnimkaRepertoara (glavni/rezerva) + meta. */
function indeksirajSnimku(zapisi) {
  const poPrefiksuListe = new Map();
  const meta = new Map();
  for (const z of zapisi) {
    const pref = z.prefiks ?? String(z.rijec).slice(0, 2);
    if (!poPrefiksuListe.has(pref)) poPrefiksuListe.set(pref, []);
    poPrefiksuListe.get(pref).push(z.rijec);
    meta.set(z.rijec, z);
  }
  const poPrefiksu = new Map();
  for (const [pref, lista] of poPrefiksuListe) {
    const polovica = Math.ceil(lista.length / 2);
    poPrefiksu.set(pref, {
      glavni: lista.slice(0, polovica),
      rezerva: lista.slice(polovica),
    });
  }
  return {
    snimka: { generacija: 1, poPrefiksu },
    meta,
    kandidatiZa: (pref) => {
      const s = poPrefiksu.get(pref);
      if (!s) return [];
      return [...s.glavni, ...s.rezerva];
    },
  };
}

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1));
  return s[idx] ?? 0;
}

function stats(arr) {
  if (arr.length === 0) {
    return { p50: 0, p95: 0, p99: 0, max: 0, n: 0 };
  }
  let max = arr[0] ?? 0;
  for (let i = 1; i < arr.length; i += 1) {
    const v = arr[i];
    if (v > max) max = v;
  }
  return {
    p50: Number(percentile(arr, 50).toFixed(3)),
    p95: Number(percentile(arr, 95).toFixed(3)),
    p99: Number(percentile(arr, 99).toFixed(3)),
    max: Number(max.toFixed(3)),
    n: arr.length,
  };
}

function pokreniUzorkovanjeLaga(uzorci, intervalMs = 2) {
  let aktivno = true;
  const petlja = () => {
    if (!aktivno) return;
    const t0 = performance.now();
    setImmediate(() => {
      uzorci.push(performance.now() - t0);
      if (aktivno) setTimeout(petlja, intervalMs);
    });
  };
  petlja();
  return () => { aktivno = false; };
}

async function ucitajModule() {
  const srcOdabir = resolve(root, 'src/bot/odabir-rijeci.ts');
  const srcRaspored = resolve(root, 'src/bot/raspored-odziva.ts');
  const srcKonfig = resolve(root, 'src/bot/konfiguracija-bota.ts');
  const srcRepertoar = resolve(root, 'src/bot/repertoar.ts');
  if (existsSync(srcOdabir) && existsSync(srcRaspored) && existsSync(srcKonfig)) {
    try {
      const odabir = await import(pathToFileURL(srcOdabir).href);
      const raspored = await import(pathToFileURL(srcRaspored).href);
      const konfigMod = await import(pathToFileURL(srcKonfig).href);
      let poznatiNastavciNastavivo = null;
      if (existsSync(srcRepertoar)) {
        try {
          const rep = await import(pathToFileURL(srcRepertoar).href);
          poznatiNastavciNastavivo = rep.poznatiNastavciNastavivo ?? null;
        } catch {
          poznatiNastavciNastavivo = null;
        }
      }
      return {
        odaberiPotezNastavivo: odabir.odaberiPotezNastavivo,
        stvoriStanjeBota: odabir.stvoriStanjeBota,
        RasporedjivacOdziva: raspored.RasporedjivacOdziva,
        CHECKPOINT_ZAPISA: raspored.CHECKPOINT_ZAPISA,
        ZADANA_KONFIGURACIJA_BOTA: konfigMod.ZADANA_KONFIGURACIJA_BOTA,
        poznatiNastavciNastavivo,
        izvor: 'tsx-src',
      };
    } catch (e) {
      console.error('tsx-src import nije uspio:', e instanceof Error ? e.message : e);
      throw e;
    }
  }
  throw new Error('Nema src/ bot modula (pokreni s tsx)');
}

async function pokreniScenarij({
  RasporedjivacOdziva,
  CHECKPOINT_ZAPISA,
  poznatiNastavciNastavivo,
  odaberiPotezNastavivo,
  stvoriStanjeBota,
  konfig,
  prefiks,
  kandidati,
  snimka,
  meta,
  brojPoslova,
  brojAktivnihIgraca,
  seed,
  timeoutMs,
}) {
  const raspored = new RasporedjivacOdziva();
  const waitToFirstSlice = [];
  const trajanjaOdabira = [];
  const waitIzmeduSliceova = [];
  const lagUzorci = [];
  const ids = [];
  let dovrseno = 0;
  let otkazano = 0;
  let pogreska = 0;

  const tPrijave = performance.now();
  const cpuPrije = process.cpuUsage();
  const memPrije = process.memoryUsage();
  const zaustaviLag = pokreniUzorkovanjeLaga(lagUzorci);

  const imaSlobodnu = (pref, potrosene) => {
    const stavka = snimka.poPrefiksu.get(pref);
    if (!stavka) return false;
    for (const r of [...stavka.glavni, ...stavka.rezerva]) {
      const m = meta.get(r);
      if (!m || (m.frekvencija ?? 0) <= 0) continue;
      const grupe = m.grupe ?? [`imenica:${r}`];
      if (grupe.some((g) => potrosene.has(g))) continue;
      return true;
    }
    return false;
  };

  const provjeriIgrivost = (rijec, potrosene) => {
    const m = meta.get(rijec);
    if (!m || (m.frekvencija ?? 0) <= 0) return false;
    const grupe = m.grupe ?? [`imenica:${rijec}`];
    return !grupe.some((g) => potrosene.has(g));
  };

  for (let i = 0; i < brojPoslova; i += 1) {
    const idx = i;
    const rng = seededRng((seed + idx * 9176) >>> 0);
    const tReg = performance.now();
    let zadnjiSlice = null;
    const id = raspored.prijavi(async ({ predaj }) => {
      const first = performance.now();
      waitToFirstSlice.push(first - tReg);
      zadnjiSlice = first;
      const predajMjeri = async () => {
        const prije = performance.now();
        await predaj();
        const poslije = performance.now();
        if (zadnjiSlice !== null) waitIzmeduSliceova.push(poslije - prije);
        zadnjiSlice = poslije;
      };
      const t0 = performance.now();
      const stanje = stvoriStanjeBota(konfig, rng);
      try {
        const odluka = await odaberiPotezNastavivo(
          {
            trazenaSlova: prefiks,
            kandidati,
            frekvencijaZa: (r) => meta.get(r)?.frekvencija ?? 0,
            grupeZa: (r) => meta.get(r)?.grupe ?? [`imenica:${r}`],
            pravila: 'klasicni',
            brojAktivnih: brojAktivnihIgraca,
            iskoristeneGrupe: new Set(),
            imaSlobodnuRijecNa: imaSlobodnu,
            poznatiKandidatiNa: (p, potrosene) => {
              const stavka = snimka.poPrefiksu.get(p);
              if (!stavka) return [];
              return [...stavka.glavni, ...stavka.rezerva].filter((r) => provjeriIgrivost(r, potrosene));
            },
            poznatiKandidatiNaNastavivo: (p, potrosene) => {
              if (poznatiNastavciNastavivo) {
                return poznatiNastavciNastavivo(
                  snimka,
                  p,
                  (r) => provjeriIgrivost(r, potrosene),
                  predajMjeri,
                  () => true,
                );
              }
              // Fallback za stari SHA bez exporta — simulirani iterator s istim brojanjem.
              return {
                async *[Symbol.asyncIterator]() {
                  let n = 0;
                  const stavka = snimka.poPrefiksu.get(p);
                  if (!stavka) return;
                  for (const rijec of [...stavka.glavni, ...stavka.rezerva]) {
                    n += 1;
                    if (provjeriIgrivost(rijec, potrosene)) yield rijec;
                    if (n % CHECKPOINT_ZAPISA === 0) await predajMjeri();
                  }
                },
              };
            },
            turnToken: `bench-${seed}-${prefiks}-${idx}`,
          },
          stanje,
          konfig,
          rng,
          predajMjeri,
          () => true,
        );
        void odluka;
        dovrseno += 1;
        trajanjaOdabira.push(performance.now() - t0);
        return 'gotovo';
      } catch {
        pogreska += 1;
        return 'odustani';
      }
    });
    ids.push(id);
  }

  const syncNakonPrijaveMs = performance.now() - tPrijave;
  const deadline = tPrijave + timeoutMs;
  while (dovrseno + otkazano + pogreska < brojPoslova && performance.now() < deadline) {
    await new Promise((r) => setImmediate(r));
  }

  let timeoutPogoden = false;
  if (dovrseno + otkazano + pogreska < brojPoslova) {
    timeoutPogoden = true;
    for (const id of ids) raspored.otkazi(id);
    const cleanupDeadline = performance.now() + 5_000;
    while (raspored.brojAktivnih() > 0 && performance.now() < cleanupDeadline) {
      await new Promise((r) => setImmediate(r));
    }
    // Preostali nedovršeni nakon otkaza brojimo kao otkazane (timeout cleanup).
    const ostatak = brojPoslova - dovrseno - pogreska - otkazano;
    if (ostatak > 0) otkazano += ostatak;
  }
  zaustaviLag();

  const nedovrseno = timeoutPogoden && raspored.brojAktivnih() > 0
    ? raspored.brojAktivnih()
    : 0;
  const ukupnoMs = performance.now() - tPrijave;
  const cpuPoslije = process.cpuUsage(cpuPrije);
  const memPoslije = process.memoryUsage();

  return {
    syncNakonPrijaveMs,
    waitToFirstSlice,
    trajanjaOdabira,
    waitIzmeduSliceova,
    lagUzorci,
    ukupnoMs,
    dovrseno,
    otkazano,
    pogreska,
    nedovrseno,
    timeoutPogoden,
    cpuUserUs: cpuPoslije.user,
    cpuSystemUs: cpuPoslije.system,
    heapUsedMbPrije: Number((memPrije.heapUsed / 1024 / 1024).toFixed(2)),
    heapUsedMbPoslije: Number((memPoslije.heapUsed / 1024 / 1024).toFixed(2)),
    rssMbPoslije: Number((memPoslije.rss / 1024 / 1024).toFixed(2)),
    uspjeh: !timeoutPogoden && pogreska === 0 && nedovrseno === 0,
  };
}

function spojiBrojeve(ponavljanja, kljuc) {
  return ponavljanja.flatMap((r) => r[kljuc] ?? []);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { zapisi, oznaka: datasetOznaka } = ucitajDataset();
  const { snimka, meta, kandidatiZa } = indeksirajSnimku(zapisi);

  let mods;
  try {
    mods = await ucitajModule();
  } catch (e) {
    console.error('Učitavanje modula nije uspjelo. Koristi: pnpm exec tsx scripts/benchmark-bot-odziv-runtime.mjs');
    console.error(e);
    process.exitCode = 1;
    return;
  }

  const konfigNormal = {
    ...mods.ZADANA_KONFIGURACIJA_BOTA,
    vjerojatnostPropustaKa: 0,
    vjerojatnostOstavljanjaKa: 0,
    vjerojatnostNeznanjaUMalomSkupu: 0,
  };

  const konfigTezak = {
    ...mods.ZADANA_KONFIGURACIJA_BOTA,
    vjerojatnostPropustaKa: 0,
    vjerojatnostOstavljanjaKa: 0,
    vjerojatnostNeznanjaUMalomSkupu: 0,
    vjerojatnostTaktickogPoteza: 1,
  };

  console.log(JSON.stringify({
    tip: 'meta',
    oznaka: args.oznaka,
    seedBaza: args.seedBaza,
    dataset: datasetOznaka,
    putanjaDataset: process.env.KALADONT_BENCH_RJECNIK ?? null,
    zapisa: zapisi.length,
    izvorModula: mods.izvor,
    prefiksi: args.prefiksi,
    poslova: args.poslova,
    brojAktivnihIgraca: args.aktivnih,
    ponavljanja: args.ponavljanja,
    agregacija: 'sva-ponavljanja',
    validacijaRijeci: 'fixture-frekvencija-grupe',
    putRepertoara: mods.poznatiNastavciNastavivo ? 'poznatiNastavciNastavivo' : 'fallback-iterator',
    napomena: 'Lokalni fixture/bench — nije produkcijski p95/VPS.',
  }));

  let ikadFail = false;
  const scenariji = args.tezakTakticki
    ? [{ ime: 'tezak-takticki', konfig: konfigTezak }]
    : [
      { ime: 'normalan', konfig: konfigNormal },
      { ime: 'tezak-takticki', konfig: konfigTezak },
    ];

  for (const scenarij of scenariji) {
    for (const brojPoslova of args.poslova) {
      for (const brojAktivnihIgraca of args.aktivnih) {
        for (const pref of args.prefiksi) {
          const kandidati = kandidatiZa(pref);
          const runovi = [];
          for (let p = 0; p < args.ponavljanja; p += 1) {
            const seed = izracunajSeed(args.seedBaza, scenarij.ime, p, brojPoslova, brojAktivnihIgraca, pref);
            const r = await pokreniScenarij({
              RasporedjivacOdziva: mods.RasporedjivacOdziva,
              CHECKPOINT_ZAPISA: mods.CHECKPOINT_ZAPISA,
              poznatiNastavciNastavivo: mods.poznatiNastavciNastavivo,
              odaberiPotezNastavivo: mods.odaberiPotezNastavivo,
              stvoriStanjeBota: mods.stvoriStanjeBota,
              konfig: scenarij.konfig,
              prefiks: pref,
              kandidati,
              snimka,
              meta,
              brojPoslova,
              brojAktivnihIgraca,
              seed,
              timeoutMs: args.timeoutMs,
            });
            if (!r.uspjeh) ikadFail = true;
            runovi.push(r);
          }

          const syncovi = runovi.map((r) => r.syncNakonPrijaveMs);
          const ukupni = runovi.map((r) => r.ukupnoMs);
          console.log(JSON.stringify({
            tip: 'rezultat',
            oznaka: args.oznaka,
            scenarij: scenarij.ime,
            dataset: datasetOznaka,
            prefiks: pref,
            kandidata: kandidati.length,
            brojPoslova,
            brojAktivnihIgraca,
            agregacija: 'sva-ponavljanja',
            validacijaRijeci: 'fixture-frekvencija-grupe',
            medSyncNakonPrijaveMs: Number(percentile(syncovi, 50).toFixed(3)),
            medUkupnoMs: Number(percentile(ukupni, 50).toFixed(3)),
            p95UkupnoMs: Number(percentile(ukupni, 95).toFixed(3)),
            waitToFirstSlice: stats(spojiBrojeve(runovi, 'waitToFirstSlice')),
            trajanjaOdabira: stats(spojiBrojeve(runovi, 'trajanjaOdabira')),
            waitIzmeduSliceova: stats(spojiBrojeve(runovi, 'waitIzmeduSliceova')),
            eventLoopLagTijekom: stats(spojiBrojeve(runovi, 'lagUzorci')),
            dovrsenoUkupno: runovi.reduce((a, r) => a + r.dovrseno, 0),
            otkazanoUkupno: runovi.reduce((a, r) => a + r.otkazano, 0),
            pogreskaUkupno: runovi.reduce((a, r) => a + r.pogreska, 0),
            nedovrsenoUkupno: runovi.reduce((a, r) => a + r.nedovrseno, 0),
            uspjehSvih: runovi.every((r) => r.uspjeh),
            cpuUserUsMed: Math.round(percentile(runovi.map((r) => r.cpuUserUs), 50)),
            heapUsedMbPoslijeMed: Number(percentile(runovi.map((r) => r.heapUsedMbPoslije), 50).toFixed(2)),
            rssMbPoslijeMed: Number(percentile(runovi.map((r) => r.rssMbPoslije), 50).toFixed(2)),
          }));
        }
      }
    }
  }

  if (ikadFail) {
    console.error(JSON.stringify({ tip: 'fail', razlog: 'nedovrseni ili pogreska poslovi' }));
    process.exitCode = 1;
  }
}

main();
