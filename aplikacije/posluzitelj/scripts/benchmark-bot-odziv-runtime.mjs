#!/usr/bin/env node
/**
 * Lokalni benchmark nastavivog runtime puta (RasporedjivacOdziva + odaberiPotezNastavivo).
 * Nije dio uobičajenog PR CI.
 *
 * Upotreba (iz aplikacije/posluzitelj):
 *   pnpm exec tsx scripts/benchmark-bot-odziv-runtime.mjs
 *   pnpm exec tsx scripts/benchmark-bot-odziv-runtime.mjs --prefiksi=ma,ra,pr --ponavljanja=3 --poslova=1,2,3
 *
 * Opcionalni veliki dataset: KALADONT_BENCH_RJECNIK (JSON/JSONL, read-only).
 * Označava rezultate kao dataset=fixture | dataset=rjecnik.
 *
 * Mjeri: vrijeme do starta prvog koraka nakon prijavi(), trajanje odabira,
 * event-loop lag, CPU, heap/RSS. Ne tvrdi VPS p95.
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
    poslova: [1, 2, 3],
    oznaka: 'prije',
  };
  for (const a of argv) {
    if (a.startsWith('--prefiksi=')) out.prefiksi = a.slice(11).split(',').map((s) => s.trim()).filter(Boolean);
    if (a.startsWith('--ponavljanja=')) out.ponavljanja = Math.max(1, Number(a.slice(14)) || 3);
    if (a.startsWith('--poslova=')) {
      out.poslova = a.slice(10).split(',').map((s) => Number(s.trim())).filter((n) => n >= 1 && n <= 16);
    }
    if (a.startsWith('--oznaka=')) out.oznaka = a.slice(9) || 'run';
  }
  if (out.poslova.length === 0) out.poslova = [1, 2, 3];
  return out;
}

function ugradjeniFixture() {
  const rijeci = [];
  for (const pref of ['ma', 'ra', 'na', 'po', 'pr', 'za']) {
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
  for (const nast of ['lampa', 'ravan', 'naranča', 'poklon', 'pravda', 'zagonetka']) {
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

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
}

function izmjeríEventLoopLag() {
  return new Promise((resolve) => {
    const t0 = performance.now();
    setImmediate(() => resolve(performance.now() - t0));
  });
}

async function ucitajModule() {
  // Preferiraj src (tsx) da mjeri aktualno stablo, ne zastarjeli dist.
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
        predajSetImmediate: raspored.predajSetImmediate,
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
      predajSetImmediate: raspored.predajSetImmediate,
      ZADANA_KONFIGURACIJA_BOTA: konfigMod.ZADANA_KONFIGURACIJA_BOTA,
      izvor: 'dist',
    };
  }
  throw new Error('Nema src/ ni dist/ bot modula');
}

async function pokreniScenarij({
  RasporedjivacOdziva,
  predajSetImmediate,
  odaberiPotezNastavivo,
  stvoriStanjeBota,
  konfig,
  prefiks,
  kandidati,
  meta,
  poPrefiksu,
  brojPoslova,
  seed,
}) {
  const raspored = new RasporedjivacOdziva();
  let prviKorakMs = null;
  const trajanjaOdabira = [];
  let dovrseno = 0;

  const tPrijave = performance.now();
  const cpuPrije = process.cpuUsage();
  const memPrije = process.memoryUsage();

  for (let i = 0; i < brojPoslova; i += 1) {
    const idx = i;
    raspored.prijavi(async () => {
      if (prviKorakMs === null) prviKorakMs = performance.now() - tPrijave;
      const t0 = performance.now();
      const stanje = stvoriStanjeBota(konfig, () => 0.5);
      const odluka = await odaberiPotezNastavivo(
        {
          trazenaSlova: prefiks,
          kandidati,
          frekvencijaZa: (r) => meta.get(r)?.frekvencija ?? 0,
          grupeZa: (r) => meta.get(r)?.grupe ?? [`imenica:${r}`],
          pravila: 'klasicni',
          brojAktivnih: brojPoslova + 1,
          iskoristeneGrupe: new Set(),
          imaSlobodnuRijecNa: () => true,
          poznatiKandidatiNa: (p) => poPrefiksu.get(p) ?? [],
          poznatiKandidatiNaNastavivo: async function* (p) {
            for (const rijec of poPrefiksu.get(p) ?? []) {
              const f = meta.get(rijec)?.frekvencija ?? 0;
              if (f > 0) yield rijec;
            }
          },
          turnToken: `bench-${seed}-${prefiks}-${idx}`,
        },
        stanje,
        konfig,
        () => 0.5,
        predajSetImmediate,
        () => true,
      );
      trajanjaOdabira.push(performance.now() - t0);
      dovrseno += 1;
      void odluka;
      return 'gotovo';
    });
  }

  const syncNakonPrijaveMs = performance.now() - tPrijave;
  // Čekaj da svi poslovi završe.
  for (let k = 0; k < 5000 && dovrseno < brojPoslova; k += 1) {
    await new Promise((r) => setImmediate(r));
  }
  const ukupnoMs = performance.now() - tPrijave;
  const cpuPoslije = process.cpuUsage(cpuPrije);
  const memPoslije = process.memoryUsage();
  const eventLoopLagMs = await izmjeríEventLoopLag();

  return {
    syncNakonPrijaveMs,
    prviKorakMs: prviKorakMs ?? -1,
    medOdabirMs: median(trajanjaOdabira),
    maxOdabirMs: Math.max(0, ...trajanjaOdabira),
    ukupnoMs,
    dovrseno,
    eventLoopLagMs,
    cpuUserUs: cpuPoslije.user,
    cpuSystemUs: cpuPoslije.system,
    heapUsedMbPrije: Number((memPrije.heapUsed / 1024 / 1024).toFixed(2)),
    heapUsedMbPoslije: Number((memPoslije.heapUsed / 1024 / 1024).toFixed(2)),
    rssMbPoslije: Number((memPoslije.rss / 1024 / 1024).toFixed(2)),
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

  const konfig = {
    ...mods.ZADANA_KONFIGURACIJA_BOTA,
    vjerojatnostPropustaKa: 0,
    vjerojatnostOstavljanjaKa: 0,
    vjerojatnostNeznanjaUMalomSkupu: 0,
    vjerojatnostTaktickogPoteza: 0,
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
    ponavljanja: args.ponavljanja,
  }));

  for (const brojPoslova of args.poslova) {
    for (const pref of args.prefiksi) {
      const kandidati = poPrefiksu.get(pref) ?? [];
      const syncovi = [];
      const prviKoraci = [];
      const medOdabiri = [];
      const ukupni = [];
      const lagovi = [];
      let zadnji = null;
      for (let p = 0; p < args.ponavljanja; p += 1) {
        const r = await pokreniScenarij({
          RasporedjivacOdziva: mods.RasporedjivacOdziva,
          predajSetImmediate: mods.predajSetImmediate,
          odaberiPotezNastavivo: mods.odaberiPotezNastavivo,
          stvoriStanjeBota: mods.stvoriStanjeBota,
          konfig,
          prefiks: pref,
          kandidati,
          meta,
          poPrefiksu,
          brojPoslova,
          seed: `${args.oznaka}-${p}`,
        });
        syncovi.push(r.syncNakonPrijaveMs);
        prviKoraci.push(r.prviKorakMs);
        medOdabiri.push(r.medOdabirMs);
        ukupni.push(r.ukupnoMs);
        lagovi.push(r.eventLoopLagMs);
        zadnji = r;
      }
      console.log(JSON.stringify({
        tip: 'rezultat',
        oznaka: args.oznaka,
        dataset: datasetOznaka,
        prefiks: pref,
        kandidata: kandidati.length,
        brojPoslova,
        medSyncNakonPrijaveMs: Number(median(syncovi).toFixed(3)),
        medPrviKorakMs: Number(median(prviKoraci).toFixed(3)),
        medOdabirMs: Number(median(medOdabiri).toFixed(3)),
        medUkupnoMs: Number(median(ukupni).toFixed(3)),
        medEventLoopLagMs: Number(median(lagovi).toFixed(3)),
        cpuUserUsZadnji: zadnji?.cpuUserUs ?? 0,
        cpuSystemUsZadnji: zadnji?.cpuSystemUs ?? 0,
        heapUsedMbPoslije: zadnji?.heapUsedMbPoslije ?? 0,
        rssMbPoslije: zadnji?.rssMbPoslije ?? 0,
      }));
    }
  }
}

main();
