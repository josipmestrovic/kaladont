#!/usr/bin/env node
/**
 * Lokalni benchmark nastavivog runtime puta (RasporedjivacOdziva + odaberiPotezNastavivo).
 * Nije dio uobičajenog PR CI.
 *
 * Upotreba (iz aplikacije/posluzitelj):
 *   pnpm exec tsx scripts/benchmark-bot-odziv-runtime.mjs
 *   pnpm exec tsx scripts/benchmark-bot-odziv-runtime.mjs --oznaka=poslije --poslova=1,10,25 --aktivnih=2,3
 *
 * Opcionalni veliki dataset: KALADONT_BENCH_RJECNIK (JSON/JSONL, read-only).
 * Označava rezultate kao dataset=fixture | dataset=rjecnik.
 *
 * Incomplete run (timeout / nedovršeni poslovi) → non-zero exit.
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
    poslova: [1, 10, 25],
    aktivnih: [2, 3, 4],
    oznaka: 'poslije',
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
    if (a.startsWith('--timeout-ms=')) out.timeoutMs = Math.max(1000, Number(a.slice(13)) || 120_000);
    if (a === '--tezak-takticki') out.tezakTakticki = true;
  }
  if (out.poslova.length === 0) out.poslova = [1, 10, 25];
  if (out.aktivnih.length === 0) out.aktivnih = [2, 3, 4];
  return out;
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

function indeksiraj(zapisi) {
  const poPrefiksu = new Map();
  const meta = new Map();
  for (const z of zapisi) {
    const pref = z.prefiks ?? String(z.rijec).slice(0, 2);
    if (!poPrefiksu.has(pref)) poPrefiksu.set(pref, []);
    poPrefiksu.get(pref).push(z.rijec);
    meta.set(z.rijec, z);
  }
  return { poPrefiksu, meta };
}

function percentile(arr, p) {
  if (arr.length === 0) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1));
  return s[idx] ?? 0;
}

function median(arr) {
  return percentile(arr, 50);
}

function stats(arr) {
  if (arr.length === 0) {
    return { p50: 0, p95: 0, p99: 0, max: 0, n: 0 };
  }
  return {
    p50: Number(percentile(arr, 50).toFixed(3)),
    p95: Number(percentile(arr, 95).toFixed(3)),
    p99: Number(percentile(arr, 99).toFixed(3)),
    max: Number(Math.max(...arr).toFixed(3)),
    n: arr.length,
  };
}

/** Uzorkuje event-loop lag tijekom računanja (setImmediate round-trip). */
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
  if (existsSync(srcOdabir) && existsSync(srcRaspored) && existsSync(srcKonfig)) {
    try {
      const odabir = await import(pathToFileURL(srcOdabir).href);
      const raspored = await import(pathToFileURL(srcRaspored).href);
      const konfigMod = await import(pathToFileURL(srcKonfig).href);
      return {
        odaberiPotezNastavivo: odabir.odaberiPotezNastavivo,
        stvoriStanjeBota: odabir.stvoriStanjeBota,
        RasporedjivacOdziva: raspored.RasporedjivacOdziva,
        CHECKPOINT_ZAPISA: raspored.CHECKPOINT_ZAPISA,
        ZADANA_KONFIGURACIJA_BOTA: konfigMod.ZADANA_KONFIGURACIJA_BOTA,
        izvor: 'tsx-src',
      };
    } catch {
      /* pad na dist */
    }
  }
  const distOdabir = resolve(root, 'dist/bot/odabir-rijeci.js');
  const distRaspored = resolve(root, 'dist/bot/raspored-odziva.js');
  const distKonfig = resolve(root, 'dist/bot/konfiguracija-bota.js');
  if (existsSync(distOdabir) && existsSync(distRaspored) && existsSync(distKonfig)) {
    const odabir = await import(pathToFileURL(distOdabir).href);
    const raspored = await import(pathToFileURL(distRaspored).href);
    const konfigMod = await import(pathToFileURL(distKonfig).href);
    return {
      odaberiPotezNastavivo: odabir.odaberiPotezNastavivo,
      stvoriStanjeBota: odabir.stvoriStanjeBota,
      RasporedjivacOdziva: raspored.RasporedjivacOdziva,
      CHECKPOINT_ZAPISA: raspored.CHECKPOINT_ZAPISA,
      ZADANA_KONFIGURACIJA_BOTA: konfigMod.ZADANA_KONFIGURACIJA_BOTA,
      izvor: 'dist',
    };
  }
  throw new Error('Nema src/ ni dist/ bot modula');
}

async function pokreniScenarij({
  RasporedjivacOdziva,
  CHECKPOINT_ZAPISA,
  odaberiPotezNastavivo,
  stvoriStanjeBota,
  konfig,
  prefiks,
  kandidati,
  meta,
  poPrefiksu,
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
  let dovrseno = 0;
  let otkazano = 0;

  const tPrijave = performance.now();
  const cpuPrije = process.cpuUsage();
  const memPrije = process.memoryUsage();
  const zaustaviLag = pokreniUzorkovanjeLaga(lagUzorci);

  // Stvarni prefiks-indeks (ne () => true) — i na fixtureu i na rječniku.
  const imaSlobodnu = (pref, potrosene) => {
    const lista = poPrefiksu.get(pref) ?? [];
    for (const r of lista) {
      const m = meta.get(r);
      if (!m || (m.frekvencija ?? 0) <= 0) continue;
      const grupe = m.grupe ?? [`imenica:${r}`];
      if (grupe.some((g) => potrosene.has(g))) continue;
      return true;
    }
    return false;
  };

  for (let i = 0; i < brojPoslova; i += 1) {
    const idx = i;
    const rng = seededRng((seed * 1009 + idx * 9176) >>> 0);
    const tReg = performance.now();
    let zadnjiSlice = null;
    raspored.prijavi(async ({ predaj }) => {
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
              const lista = poPrefiksu.get(p) ?? [];
              return lista.filter((r) => {
                const m = meta.get(r);
                if (!m || (m.frekvencija ?? 0) <= 0) return false;
                const grupe = m.grupe ?? [`imenica:${r}`];
                return !grupe.some((g) => potrosene.has(g));
              });
            },
            poznatiKandidatiNaNastavivo: (p, potrosene) => ({
              async *[Symbol.asyncIterator]() {
                let n = 0;
                for (const rijec of poPrefiksu.get(p) ?? []) {
                  n += 1;
                  const m = meta.get(rijec);
                  const frek = m?.frekvencija ?? 0;
                  const grupe = m?.grupe ?? [`imenica:${rijec}`];
                  const igriva = frek > 0 && !grupe.some((g) => potrosene.has(g));
                  if (igriva) yield rijec;
                  if (n % CHECKPOINT_ZAPISA === 0) await predajMjeri();
                }
              },
            }),
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
        otkazano += 1;
        return 'odustani';
      }
    });
  }

  const syncNakonPrijaveMs = performance.now() - tPrijave;

  const deadline = tPrijave + timeoutMs;
  while (dovrseno + otkazano < brojPoslova && performance.now() < deadline) {
    await new Promise((r) => setImmediate(r));
  }
  zaustaviLag();

  const nedovrseno = brojPoslova - dovrseno - otkazano;
  const ukupnoMs = performance.now() - tPrijave;
  const cpuPoslije = process.cpuUsage(cpuPrije);
  const memPoslije = process.memoryUsage();

  return {
    syncNakonPrijaveMs,
    waitToFirstSlice: stats(waitToFirstSlice),
    trajanjaOdabira: stats(trajanjaOdabira),
    waitIzmeduSliceova: stats(waitIzmeduSliceova),
    eventLoopLagTijekom: stats(lagUzorci),
    ukupnoMs,
    dovrseno,
    otkazano,
    nedovrseno,
    cpuUserUs: cpuPoslije.user,
    cpuSystemUs: cpuPoslije.system,
    heapUsedMbPrije: Number((memPrije.heapUsed / 1024 / 1024).toFixed(2)),
    heapUsedMbPoslije: Number((memPoslije.heapUsed / 1024 / 1024).toFixed(2)),
    rssMbPoslije: Number((memPoslije.rss / 1024 / 1024).toFixed(2)),
    uspjeh: nedovrseno === 0,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { zapisi, oznaka: datasetOznaka } = ucitajDataset();
  const { poPrefiksu, meta } = indeksiraj(zapisi);

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
    // Normalni scenarij: taktika uključena (zadane vrijednosti), ne forsiramo 0.
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
    dataset: datasetOznaka,
    putanjaDataset: process.env.KALADONT_BENCH_RJECNIK ?? null,
    zapisa: zapisi.length,
    izvorModula: mods.izvor,
    prefiksi: args.prefiksi,
    poslova: args.poslova,
    brojAktivnihIgraca: args.aktivnih,
    ponavljanja: args.ponavljanja,
    imaSlobodnuRijecNa: 'prefiks-indeks',
    napomena: datasetOznaka === 'fixture'
      ? 'ugrađeni fixture (nije produkcijski rječnik); imaSlobodnuRijecNa preko lokalnog indeksa'
      : 'KALADONT_BENCH_RJECNIK dataset; imaSlobodnuRijecNa preko lokalnog indeksa',
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
          const kandidati = poPrefiksu.get(pref) ?? [];
          const syncovi = [];
          const ukupni = [];
          let zadnji = null;
          for (let p = 0; p < args.ponavljanja; p += 1) {
            const r = await pokreniScenarij({
              RasporedjivacOdziva: mods.RasporedjivacOdziva,
              CHECKPOINT_ZAPISA: mods.CHECKPOINT_ZAPISA,
              odaberiPotezNastavivo: mods.odaberiPotezNastavivo,
              stvoriStanjeBota: mods.stvoriStanjeBota,
              konfig: scenarij.konfig,
              prefiks: pref,
              kandidati,
              meta,
              poPrefiksu,
              brojPoslova,
              brojAktivnihIgraca,
              seed: (args.oznaka.length * 31 + p * 17 + brojPoslova) >>> 0,
              timeoutMs: args.timeoutMs,
            });
            if (!r.uspjeh) ikadFail = true;
            syncovi.push(r.syncNakonPrijaveMs);
            ukupni.push(r.ukupnoMs);
            zadnji = r;
          }
          console.log(JSON.stringify({
            tip: 'rezultat',
            oznaka: args.oznaka,
            scenarij: scenarij.ime,
            dataset: datasetOznaka,
            prefiks: pref,
            kandidata: kandidati.length,
            brojPoslova,
            brojAktivnihIgraca,
            medSyncNakonPrijaveMs: Number(median(syncovi).toFixed(3)),
            medUkupnoMs: Number(median(ukupni).toFixed(3)),
            waitToFirstSlice: zadnji?.waitToFirstSlice,
            trajanjaOdabira: zadnji?.trajanjaOdabira,
            waitIzmeduSliceova: zadnji?.waitIzmeduSliceova,
            eventLoopLagTijekom: zadnji?.eventLoopLagTijekom,
            dovrseno: zadnji?.dovrseno ?? 0,
            otkazano: zadnji?.otkazano ?? 0,
            nedovrseno: zadnji?.nedovrseno ?? 0,
            uspjeh: zadnji?.uspjeh ?? false,
            cpuUserUsZadnji: zadnji?.cpuUserUs ?? 0,
            cpuSystemUsZadnji: zadnji?.cpuSystemUs ?? 0,
            heapUsedMbPoslije: zadnji?.heapUsedMbPoslije ?? 0,
            rssMbPoslije: zadnji?.rssMbPoslije ?? 0,
          }));
        }
      }
    }
  }

  if (ikadFail) {
    console.error(JSON.stringify({ tip: 'fail', razlog: 'nedovrseni ili timeout poslovi' }));
    process.exitCode = 1;
  }
}

main();
