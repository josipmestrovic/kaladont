#!/usr/bin/env node
/**
 * Lokalni / ručni benchmark botovog odabira (nije dio uobičajenog PR CI).
 *
 * Upotreba (iz aplikacije/posluzitelj):
 *   node scripts/benchmark-bot-odabir.mjs
 *   node scripts/benchmark-bot-odabir.mjs --prefiksi=ma,ra,pr --ponavljanja=5
 *
 * Opcionalni veliki dataset:
 *   Postavi KALADONT_BENCH_RJECNIK na putanju JSONL/JSON snimke s poljima
 *   { rijec, prefiks, grupe, frekvencija, vrste } — inače koristi ugrađeni mali fixture.
 *
 * Mjeri: trajanje odaberiPotez, broj pregledanih zapisa u poznatiKandidatiNa.
 * Ne tvrdi VPS p95; za CI vidi test/bot-prihvat-odziva.test.ts.
 */
import { performance } from 'node:perf_hooks';
import { readFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function parseArgs(argv) {
  const out = { prefiksi: ['ma', 'ra', 'na', 'po', 'pr'], ponavljanja: 3 };
  for (const a of argv) {
    if (a.startsWith('--prefiksi=')) out.prefiksi = a.slice(11).split(',').map((s) => s.trim()).filter(Boolean);
    if (a.startsWith('--ponavljanja=')) out.ponavljanja = Math.max(1, Number(a.slice(14)) || 3);
  }
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
  // Poznati nastavci za 1-ply
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
  if (!put || !existsSync(put)) return ugradjeniFixture();
  const sirovo = readFileSync(put, 'utf8').trim();
  if (sirovo.startsWith('[')) return JSON.parse(sirovo);
  return sirovo.split('\n').filter(Boolean).map((linija) => JSON.parse(linija));
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const zapisi = ucitajDataset();
  const { poPrefiksu, meta } = indeksiraj(zapisi);

  // Dinamički import compiled/ts via vitest nije ovdje — koristi izvorni put kroz tsx ako postoji,
  // inače ispiši samo fixture metrike skeniranja (bez odaberiPotez).
  let odaberiPotez;
  let stvoriStanjeBota;
  let konfig;
  try {
    // Node ne učitava .ts bez loadera — preferiraj dist ako postoji.
    const distOdabir = resolve(root, 'dist/bot/odabir-rijeci.js');
    const distKonfig = resolve(root, 'dist/bot/konfiguracija-bota.js');
    if (existsSync(distOdabir)) {
      ({ odaberiPotez, stvoriStanjeBota } = await import(pathToFileURL(distOdabir).href));
      ({ ZADANA_KONFIGURACIJA_BOTA: konfig } = await import(pathToFileURL(distKonfig).href));
    } else {
      console.error('Nema dist/ — pokreni build poslužitelja ili koristi: pnpm exec tsx scripts/benchmark-bot-odabir.mjs');
      console.error('Ispisujem samo veličine prefiksa iz dataseta.');
      for (const pref of args.prefiksi) {
        console.log(JSON.stringify({ prefiks: pref, kandidata: (poPrefiksu.get(pref) ?? []).length }));
      }
      process.exitCode = 0;
      return;
    }
  } catch (e) {
    console.error(e);
    process.exitCode = 1;
    return;
  }

  const konfigBota = {
    ...konfig,
    vjerojatnostPropustaKa: 0,
    vjerojatnostOstavljanjaKa: 0,
    vjerojatnostNeznanjaUMalomSkupu: 0,
    vjerojatnostTaktickogPoteza: 0,
  };

  console.log(JSON.stringify({
    dataset: process.env.KALADONT_BENCH_RJECNIK ?? 'ugradjeni-fixture',
    zapisa: zapisi.length,
    prefiksi: args.prefiksi,
    ponavljanja: args.ponavljanja,
  }));

  for (const pref of args.prefiksi) {
    const kandidati = poPrefiksu.get(pref) ?? [];
    const vremena = [];
    let maxPregled = 0;
    for (let p = 0; p < args.ponavljanja; p += 1) {
      let pregledano = 0;
      const t0 = performance.now();
      const stanje = stvoriStanjeBota(konfigBota, () => 0.5);
      odaberiPotez({
        trazenaSlova: pref,
        kandidati,
        frekvencijaZa: (r) => meta.get(r)?.frekvencija ?? 0,
        grupeZa: (r) => meta.get(r)?.grupe ?? [`imenica:${r}`],
        pravila: 'ka_zna',
        brojAktivnih: 2,
        iskoristeneGrupe: new Set(),
        imaSlobodnuRijecNa: () => true,
        poznatiKandidatiNa: (prefiks) => ({
          *[Symbol.iterator]() {
            for (const rijec of poPrefiksu.get(prefiks) ?? []) {
              pregledano += 1;
              const f = meta.get(rijec)?.frekvencija ?? 0;
              if (f > 0) yield rijec;
            }
          },
        }),
        turnToken: `bench-${pref}-${p}`,
      }, stanje, konfigBota, () => 0.5);
      const ms = performance.now() - t0;
      vremena.push(ms);
      maxPregled = Math.max(maxPregled, pregledano);
    }
    vremena.sort((a, b) => a - b);
    const med = vremena[Math.floor(vremena.length / 2)];
    console.log(JSON.stringify({
      prefiks: pref,
      kandidata: kandidati.length,
      medMs: Number(med.toFixed(2)),
      maxMs: Number(vremena[vremena.length - 1].toFixed(2)),
      maxPregledanihUPoznatima: maxPregled,
    }));
  }
}

main();
