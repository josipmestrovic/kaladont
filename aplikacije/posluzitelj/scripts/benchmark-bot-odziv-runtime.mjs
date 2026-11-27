#!/usr/bin/env node
/**
 * Lokalni benchmark nastavivog runtime puta (RasporedjivacOdziva + odaberiPotezNastavivo).
 * „Checkpoint honesty“: imaSlobodnuRijecNa skenira puni prefiks; kandidati samo repertoar.
 * Nije dio uobičajenog PR CI. Ne predstavlja produkcijske performanse.
 *
 * Upotreba (iz aplikacije/posluzitelj):
 *   pnpm exec tsx scripts/benchmark-bot-odziv-runtime.mjs
 *   node --import tsx scripts/benchmark-bot-odziv-runtime.mjs "--poslova=1" "--zagrijavanje=0"
 *
 * Opcionalni veliki dataset: KALADONT_BENCH_RJECNIK (JSON/JSONL, read-only).
 * Incomplete run (timeout / nedovršeni / pogreške) → non-zero exit.
 */
import { performance } from 'node:perf_hooks';
import { readFileSync, existsSync, appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultRoot = resolve(__dirname, '..');

const DOZVOLJENI_SCENARIJI = new Set([
  'normalan',
  'tezak-takticki',
  'primljeni-ka',
  'veliki-prefiks',
  'gotovo-iscrpljen',
  'potpuno-iscrpljen',
]);

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
    zagrijavanje: 1,
    dolazak: 'burst',
    scenariji: ['normalan', 'tezak-takticki'],
    izlaz: null,
    api: 'auto',
    moduliKorijen: null,
  };
  let scenarijiIzCli = false;
  for (const a of argv) {
    if (a.startsWith('--prefiksi=')) out.prefiksi = a.slice(11).split(',').map((s) => s.trim()).filter(Boolean);
    if (a.startsWith('--ponavljanja=')) out.ponavljanja = Math.max(0, Number(a.slice(14)) || 3);
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
    if (a.startsWith('--zagrijavanje=')) out.zagrijavanje = Math.max(0, Number(a.slice(15)) || 0);
    if (a.startsWith('--dolazak=')) {
      const v = a.slice(10).trim();
      if (v === 'burst' || v === 'razmazano') out.dolazak = v;
    }
    if (a.startsWith('--scenariji=')) {
      scenarijiIzCli = true;
      const lista = a.slice(12).split(',').map((s) => s.trim()).filter(Boolean);
      out.scenariji = lista.filter((s) => DOZVOLJENI_SCENARIJI.has(s));
    }
    if (a.startsWith('--izlaz=')) out.izlaz = a.slice(8).trim() || null;
    if (a.startsWith('--api=')) {
      const v = a.slice(6).trim();
      if (v === 'auto' || v === 'v7-step' || v === 'v8-slice') out.api = v;
    }
    if (a.startsWith('--moduli-korijen=')) out.moduliKorijen = resolve(a.slice(17).trim());
  }
  if (out.poslova.length === 0) out.poslova = [1, 10, 25, 50, 100];
  if (out.aktivnih.length === 0) out.aktivnih = [2, 3, 4];
  if (out.tezakTakticki && !scenarijiIzCli) out.scenariji = ['tezak-takticki'];
  if (out.scenariji.length === 0) out.scenariji = ['normalan', 'tezak-takticki'];
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

/**
 * puniPoPrefiksu = svi zapisi; snimka = repertoar (256+256 ili simulirana polovica).
 */
function indeksirajSnimku(zapisi, izgradiRepertoarBotova = null) {
  const meta = new Map();
  const puniPoPrefiksu = new Map();
  for (const z of zapisi) {
    const pref = z.prefiks ?? String(z.rijec).slice(0, 2);
    if (!puniPoPrefiksu.has(pref)) puniPoPrefiksu.set(pref, []);
    puniPoPrefiksu.get(pref).push(z.rijec);
    meta.set(z.rijec, {
      grupe: z.grupe ?? [`imenica:${z.rijec}`],
      frekvencija: z.frekvencija ?? 0,
      vrste: z.vrste ?? ['imenica'],
    });
  }

  if (typeof izgradiRepertoarBotova === 'function') {
    const izvor = {
      prefiksi: () => puniPoPrefiksu.keys(),
      rijeciNaPrefiksu: (p) => puniPoPrefiksu.get(p) ?? [],
      frekvencijaZa: (r) => meta.get(r)?.frekvencija ?? null,
      grupeZa: (r) => meta.get(r)?.grupe ?? [`imenica:${r}`],
      jeOsnovniOblik: () => true,
      jePostojecaRijec: (r) => meta.has(r),
    };
    const snimka = izgradiRepertoarBotova(izvor, 1);
    return {
      snimka,
      meta,
      puniPoPrefiksu,
      nacinSnimke: 'izgradiRepertoarBotova',
      kandidatiZa: (pref) => {
        const s = snimka.poPrefiksu.get(pref);
        if (!s) return [];
        return [...s.glavni, ...s.rezerva];
      },
    };
  }

  const poPrefiksu = new Map();
  for (const [pref, lista] of puniPoPrefiksu) {
    const polovica = Math.ceil(lista.length / 2);
    poPrefiksu.set(pref, {
      glavni: lista.slice(0, polovica),
      rezerva: lista.slice(polovica),
    });
  }
  return {
    snimka: { generacija: 1, poPrefiksu },
    meta,
    puniPoPrefiksu,
    nacinSnimke: 'simulirana-polovica',
    kandidatiZa: (pref) => {
      const s = poPrefiksu.get(pref);
      if (!s) return [];
      return [...s.glavni, ...s.rezerva];
    },
  };
}

function najveciPrefiks(puniPoPrefiksu) {
  let best = 'ma';
  let bestLen = 0;
  for (const [pref, lista] of puniPoPrefiksu) {
    if (lista.length > bestLen) {
      bestLen = lista.length;
      best = pref;
    }
  }
  return { prefiks: best, velicinaPunog: bestLen };
}

function grupeNaPrefiksu(prefiks, puniPoPrefiksu, meta) {
  const grupe = [];
  for (const r of puniPoPrefiksu.get(prefiks) ?? []) {
    const m = meta.get(r);
    if (!m) continue;
    for (const g of m.grupe ?? [`imenica:${r}`]) grupe.push(g);
  }
  return grupe;
}

function oznaciPotroseneGrupe(prefiks, omjer, puniPoPrefiksu, meta) {
  const sve = grupeNaPrefiksu(prefiks, puniPoPrefiksu, meta);
  const cilj = omjer >= 1 ? sve.length : Math.floor(sve.length * omjer);
  const set = new Set();
  for (let i = 0; i < cilj && i < sve.length; i += 1) set.add(sve[i]);
  return set;
}

function pripremiScenarij(ime, prefiksUlaz, puniPoPrefiksu, meta, kandidatiZa, zadanaKonfig) {
  const konfigBaza = {
    ...zadanaKonfig,
    vjerojatnostNeznanjaUMalomSkupu: 0,
  };
  let konfig = konfigBaza;
  let prefiks = prefiksUlaz;
  let trazenaSlova = prefiks;
  let kandidati = kandidatiZa(prefiks);
  let iskoristeneGrupe = [];
  const detalji = { ime };

  switch (ime) {
    case 'normalan':
      break;
    case 'tezak-takticki':
      konfig = { ...konfigBaza, vjerojatnostAgresivnosti: 1, vjerojatnostShielda: 1 };
      break;
    case 'primljeni-ka':
      trazenaSlova = 'ka';
      kandidati = kandidatiZa('ka').length ? kandidatiZa('ka').slice(0, 2) : [];
      detalji.trazenaSlova = 'ka';
      detalji.kandidata = kandidati.length;
      break;
    case 'veliki-prefiks': {
      const veliki = najveciPrefiks(puniPoPrefiksu);
      prefiks = veliki.prefiks;
      trazenaSlova = prefiks;
      kandidati = kandidatiZa(prefiks);
      detalji.velikiPrefiks = veliki.prefiks;
      detalji.velicinaPunogPrefiksa = veliki.velicinaPunog;
      detalji.kandidataRepertoar = kandidati.length;
      break;
    }
    case 'gotovo-iscrpljen': {
      const set = oznaciPotroseneGrupe(prefiks, 0.9, puniPoPrefiksu, meta);
      iskoristeneGrupe = [...set];
      detalji.potrosenihGrupa = set.size;
      detalji.ukupnoGrupa = grupeNaPrefiksu(prefiks, puniPoPrefiksu, meta).length;
      break;
    }
    case 'potpuno-iscrpljen': {
      const set = oznaciPotroseneGrupe(prefiks, 1, puniPoPrefiksu, meta);
      iskoristeneGrupe = [...set];
      detalji.potrosenihGrupa = set.size;
      detalji.ukupnoGrupa = grupeNaPrefiksu(prefiks, puniPoPrefiksu, meta).length;
      break;
    }
    default:
      break;
  }

  return {
    ime,
    konfig,
    prefiks,
    trazenaSlova,
    kandidati,
    iskoristeneGrupe,
    detalji,
  };
}

function odrediApiVarijantu(rasporedMod, apiArg) {
  if (apiArg === 'v7-step') return 'v7-step';
  if (apiArg === 'v8-slice') return 'v8-slice';
  if (rasporedMod.BUDZET_SLICE_MS !== undefined) return 'v8-slice';
  return 'v7-step';
}

function prijaviPosao(raspored, apiVarijanta, predajSetImmediate, runV8, onPrviSlice) {
  if (apiVarijanta === 'v8-slice') {
    return raspored.prijavi(async (ctx) => {
      onPrviSlice();
      return runV8(ctx.predaj);
    });
  }
  return raspored.prijavi(async () => {
    onPrviSlice();
    return runV8(predajSetImmediate);
  });
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

async function ucitajModule(moduliKorijen) {
  const root = moduliKorijen;
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
      let izgradiRepertoarBotova = null;
      if (existsSync(srcRepertoar)) {
        try {
          const rep = await import(pathToFileURL(srcRepertoar).href);
          poznatiNastavciNastavivo = rep.poznatiNastavciNastavivo ?? null;
          izgradiRepertoarBotova = rep.izgradiRepertoarBotova ?? null;
        } catch {
          poznatiNastavciNastavivo = null;
          izgradiRepertoarBotova = null;
        }
      }
      return {
        odaberiPotezNastavivo: odabir.odaberiPotezNastavivo,
        stvoriStanjeBota: odabir.stvoriStanjeBota,
        PredmemorijaLegalnosti: odabir.PredmemorijaLegalnosti,
        potpisPotrosenihGrupa: odabir.potpisPotrosenihGrupa,
        RasporedjivacOdziva: raspored.RasporedjivacOdziva,
        CHECKPOINT_ZAPISA: raspored.CHECKPOINT_ZAPISA,
        predajSetImmediate: raspored.predajSetImmediate,
        BUDZET_SLICE_MS: raspored.BUDZET_SLICE_MS,
        ZADANA_KONFIGURACIJA_BOTA: konfigMod.ZADANA_KONFIGURACIJA_BOTA,
        poznatiNastavciNastavivo,
        izgradiRepertoarBotova,
        izvor: 'tsx-src',
        moduliKorijen: root,
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
  PredmemorijaLegalnosti,
  potpisPotrosenihGrupa,
  predajSetImmediate,
  apiVarijanta,
  konfig,
  scenarij,
  snimka,
  meta,
  puniPoPrefiksu,
  brojPoslova,
  brojAktivnihIgraca,
  seed,
  timeoutMs,
  dolazak,
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

  const brojaci = {
    igrivost: 0,
    preglediRepertoara: 0,
    preglediPunogPrefiksa: 0,
    pogodciPredmemorije: 0,
    promasajiPredmemorije: 0,
    objedinjeneAnalize: 0,
  };

  const provjeriIgrivost = (rijec, potrosene) => {
    brojaci.igrivost += 1;
    const m = meta.get(rijec);
    if (!m || (m.frekvencija ?? 0) <= 0) return false;
    const grupe = m.grupe ?? [`imenica:${rijec}`];
    return !grupe.some((g) => potrosene.has(g));
  };

  const imaSlobodnu = (pref, potrosene) => {
    const lista = puniPoPrefiksu.get(pref);
    if (!lista) return false;
    for (const r of lista) {
      brojaci.preglediPunogPrefiksa += 1;
      if (provjeriIgrivost(r, potrosene)) return true;
    }
    return false;
  };

  const kandidatiScenarija = scenarij.kandidati;
  const trazenaSlova = scenarij.trazenaSlova;
  const iskoristenePredlozak = scenarij.iskoristeneGrupe;

  async function runBotJob(idx, predaj) {
    const rng = seededRng((seed + idx * 9176) >>> 0);
    const predajMjeri = async () => {
      const prije = performance.now();
      await predaj();
      const poslije = performance.now();
      waitIzmeduSliceova.push(poslije - prije);
    };
    const t0 = performance.now();
    const stanje = stvoriStanjeBota(konfig, rng);
    const iskoristeneGrupe = new Set(iskoristenePredlozak);
    try {
      const verzijaRjecnika = snimka.generacija ?? 1;
      const turnToken = `bench-${seed}-${trazenaSlova}-${idx}`;
      let predmemorija = null;
      if (PredmemorijaLegalnosti) {
        predmemorija = new PredmemorijaLegalnosti();
        const potpis = potpisPotrosenihGrupa
          ? potpisPotrosenihGrupa(iskoristeneGrupe)
          : undefined;
        try {
          predmemorija.uskladiKontekst(turnToken, verzijaRjecnika, potpis);
        } catch {
          predmemorija.uskladiKontekst(turnToken, verzijaRjecnika);
        }
        const origPeek = predmemorija.peek.bind(predmemorija);
        const origSpremi = predmemorija.spremi.bind(predmemorija);
        const origDohvati = predmemorija.dohvatiIliIzracunaj.bind(predmemorija);
        predmemorija.peek = (kljuc) => {
          const v = origPeek(kljuc);
          if (v !== undefined) brojaci.pogodciPredmemorije += 1;
          return v;
        };
        predmemorija.spremi = (kljuc, vrijednost) => {
          if (origPeek(kljuc) === undefined) {
            brojaci.promasajiPredmemorije += 1;
            brojaci.objedinjeneAnalize += 1;
          }
          return origSpremi(kljuc, vrijednost);
        };
        predmemorija.dohvatiIliIzracunaj = (kljuc, izracunaj) => {
          if (origPeek(kljuc) !== undefined) {
            brojaci.pogodciPredmemorije += 1;
          } else {
            brojaci.promasajiPredmemorije += 1;
            brojaci.objedinjeneAnalize += 1;
          }
          return origDohvati(kljuc, izracunaj);
        };
      }
      const odluka = await odaberiPotezNastavivo(
        {
          trazenaSlova,
          kandidati: kandidatiScenarija,
          frekvencijaZa: (r) => meta.get(r)?.frekvencija ?? 0,
          grupeZa: (r) => meta.get(r)?.grupe ?? [`imenica:${r}`],
          pravila: 'klasicni',
          brojAktivnih: brojAktivnihIgraca,
          iskoristeneGrupe,
          imaSlobodnuRijecNa: imaSlobodnu,
          poznatiKandidatiNa: (p, potrosene) => {
            const stavka = snimka.poPrefiksu.get(p);
            if (!stavka) return [];
            const izlaz = [];
            for (const rijec of [...stavka.glavni, ...stavka.rezerva]) {
              brojaci.preglediRepertoara += 1;
              if (provjeriIgrivost(rijec, potrosene)) izlaz.push(rijec);
            }
            return izlaz;
          },
          poznatiKandidatiNaNastavivo: (p, potrosene) => {
            if (poznatiNastavciNastavivo) {
              return poznatiNastavciNastavivo(
                snimka,
                p,
                (r) => {
                  brojaci.preglediRepertoara += 1;
                  return provjeriIgrivost(r, potrosene);
                },
                predajMjeri,
                () => true,
              );
            }
            return {
              async *[Symbol.asyncIterator]() {
                let n = 0;
                const stavka = snimka.poPrefiksu.get(p);
                if (!stavka) return;
                for (const rijec of [...stavka.glavni, ...stavka.rezerva]) {
                  n += 1;
                  brojaci.preglediRepertoara += 1;
                  if (provjeriIgrivost(rijec, potrosene)) yield rijec;
                  if (n % CHECKPOINT_ZAPISA === 0) await predajMjeri();
                }
              },
            };
          },
          predmemorija: predmemorija ?? undefined,
          verzijaRjecnika,
          dohvatiVerzijuRjecnika: () => verzijaRjecnika,
          turnToken,
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
  }

  const registacije = [];
  const rngDolazak = seededRng(seed ^ 0xdeadbeef);
  for (let i = 0; i < brojPoslova; i += 1) {
    const idx = i;
    const tReg = performance.now();
    const kasnjenjeMs = dolazak === 'razmazano' ? Math.floor(rngDolazak() * 6) * i : 0;
    registacije.push(
      new Promise((res) => {
        const registriraj = () => {
          const id = prijaviPosao(raspored, apiVarijanta, predajSetImmediate, (predaj) => runBotJob(idx, predaj), () => {
            waitToFirstSlice.push(performance.now() - tReg);
          });
          ids.push(id);
          res();
        };
        if (kasnjenjeMs <= 0) registriraj();
        else setTimeout(registriraj, kasnjenjeMs);
      }),
    );
  }
  await Promise.all(registacije);

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
    brojaciIgrivost: brojaci.igrivost,
    preglediRepertoara: brojaci.preglediRepertoara,
    preglediPunogPrefiksa: brojaci.preglediPunogPrefiksa,
    pogodciPredmemorije: brojaci.pogodciPredmemorije,
    promasajiPredmemorije: brojaci.promasajiPredmemorije,
    objedinjeneAnalize: brojaci.objedinjeneAnalize,
  };
}

function spojiBrojeve(ponavljanja, kljuc) {
  return ponavljanja.flatMap((r) => r[kljuc] ?? []);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const moduliKorijen = args.moduliKorijen ?? defaultRoot;
  const { zapisi, oznaka: datasetOznaka } = ucitajDataset();

  let emit;
  if (args.izlaz) {
    const putIzlaz = resolve(args.izlaz);
    emit = (obj) => {
      const line = JSON.stringify(obj);
      console.log(line);
      appendFileSync(putIzlaz, `${line}\n`, 'utf8');
    };
  } else {
    emit = (obj) => console.log(JSON.stringify(obj));
  }

  let mods;
  try {
    mods = await ucitajModule(moduliKorijen);
  } catch (e) {
    console.error('Učitavanje modula nije uspjelo. Koristi: pnpm exec tsx scripts/benchmark-bot-odziv-runtime.mjs');
    console.error(e);
    process.exitCode = 1;
    return;
  }

  const apiVarijanta = odrediApiVarijantu(mods, args.api);
  const { snimka, meta, puniPoPrefiksu, kandidatiZa, nacinSnimke } = indeksirajSnimku(
    zapisi,
    mods.izgradiRepertoarBotova,
  );

  const napomenaIskrenosti =
    'imaSlobodnuRijecNa skenira puniPoPrefiksu (svi zapisi dataseta po prefiksu); '
    + 'poznatiKandidatiNa i nastavivo skeniraju samo repertoar (izgradiRepertoarBotova 256+256 ili simulirana polovica u meta).';

  emit({
    tip: 'meta',
    oznaka: args.oznaka,
    seedBaza: args.seedBaza,
    dataset: datasetOznaka,
    putanjaDataset: process.env.KALADONT_BENCH_RJECNIK ?? null,
    zapisa: zapisi.length,
    izvorModula: mods.izvor,
    moduliKorijen: mods.moduliKorijen,
    apiVarijanta,
    apiArg: args.api,
    prefiksi: args.prefiksi,
    poslova: args.poslova,
    brojAktivnihIgraca: args.aktivnih,
    ponavljanja: args.ponavljanja,
    zagrijavanje: args.zagrijavanje,
    dolazak: args.dolazak,
    scenariji: args.scenariji,
    izlaz: args.izlaz,
    agregacija: 'mjerena-ponavljanja',
    validacijaRijeci: 'fixture-frekvencija-grupe',
    putRepertoara: mods.poznatiNastavciNastavivo ? 'poznatiNastavciNastavivo' : 'fallback-iterator',
    nacinSnimke,
    napomenaIskrenosti,
    napomena: 'Lokalni benchmark — nije produkcijski p95/VPS. Brojači: igrivost, preglediRepertoara, preglediPunogPrefiksa, predmemorija.',
  });

  let ikadFail = false;
  const zajednickiParam = {
    RasporedjivacOdziva: mods.RasporedjivacOdziva,
    CHECKPOINT_ZAPISA: mods.CHECKPOINT_ZAPISA,
    poznatiNastavciNastavivo: mods.poznatiNastavciNastavivo,
    odaberiPotezNastavivo: mods.odaberiPotezNastavivo,
    stvoriStanjeBota: mods.stvoriStanjeBota,
    PredmemorijaLegalnosti: mods.PredmemorijaLegalnosti,
    potpisPotrosenihGrupa: mods.potpisPotrosenihGrupa,
    predajSetImmediate: mods.predajSetImmediate,
    apiVarijanta,
    snimka,
    meta,
    puniPoPrefiksu,
    timeoutMs: args.timeoutMs,
    dolazak: args.dolazak,
  };

  for (const scenarijIme of args.scenariji) {
    for (const brojPoslova of args.poslova) {
      for (const brojAktivnihIgraca of args.aktivnih) {
        const prefiksi =
          scenarijIme === 'veliki-prefiks'
            ? [najveciPrefiks(puniPoPrefiksu).prefiks]
            : args.prefiksi;

        for (const prefUlaz of prefiksi) {
          const scenarij = pripremiScenarij(
            scenarijIme,
            prefUlaz,
            puniPoPrefiksu,
            meta,
            kandidatiZa,
            mods.ZADANA_KONFIGURACIJA_BOTA,
          );
          const prefIzlaz = scenarij.prefiks;
          const kandidati = scenarij.kandidati;

          for (let w = 0; w < args.zagrijavanje; w += 1) {
            const seedW = izracunajSeed(args.seedBaza, scenarijIme, -1 - w, brojPoslova, brojAktivnihIgraca, prefIzlaz);
            const rw = await pokreniScenarij({
              ...zajednickiParam,
              konfig: scenarij.konfig,
              scenarij,
              brojPoslova,
              brojAktivnihIgraca,
              seed: seedW,
            });
            if (!rw.uspjeh) ikadFail = true;
          }

          const runovi = [];
          for (let p = 0; p < args.ponavljanja; p += 1) {
            const seed = izracunajSeed(args.seedBaza, scenarijIme, p, brojPoslova, brojAktivnihIgraca, prefIzlaz);
            const r = await pokreniScenarij({
              ...zajednickiParam,
              konfig: scenarij.konfig,
              scenarij,
              brojPoslova,
              brojAktivnihIgraca,
              seed,
            });
            if (!r.uspjeh) ikadFail = true;
            runovi.push(r);
          }

          if (runovi.length === 0) continue;

          const syncovi = runovi.map((r) => r.syncNakonPrijaveMs);
          const ukupni = runovi.map((r) => r.ukupnoMs);
          emit({
            tip: 'rezultat',
            oznaka: args.oznaka,
            scenarij: scenarijIme,
            scenarijDetalji: scenarij.detalji,
            apiVarijanta,
            dolazak: args.dolazak,
            zagrijavanje: args.zagrijavanje,
            dataset: datasetOznaka,
            prefiks: prefIzlaz,
            trazenaSlova: scenarij.trazenaSlova,
            kandidata: kandidati.length,
            velicinaPunogPrefiksa: (puniPoPrefiksu.get(prefIzlaz) ?? []).length,
            kandidataRepertoar: kandidati.length,
            brojPoslova,
            brojAktivnihIgraca,
            agregacija: 'mjerena-ponavljanja',
            validacijaRijeci: 'fixture-frekvencija-grupe',
            napomenaIskrenosti,
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
            brojaciIgrivostUkupno: runovi.reduce((a, r) => a + (r.brojaciIgrivost ?? 0), 0),
            preglediRepertoaraUkupno: runovi.reduce((a, r) => a + (r.preglediRepertoara ?? 0), 0),
            preglediPunogPrefiksaUkupno: runovi.reduce((a, r) => a + (r.preglediPunogPrefiksa ?? 0), 0),
            pogodciPredmemorijeUkupno: runovi.reduce((a, r) => a + (r.pogodciPredmemorije ?? 0), 0),
            promasajiPredmemorijeUkupno: runovi.reduce((a, r) => a + (r.promasajiPredmemorije ?? 0), 0),
            objedinjeneAnalizeUkupno: runovi.reduce((a, r) => a + (r.objedinjeneAnalize ?? 0), 0),
            medPreglediRepertoaraPoRunu: Math.round(percentile(runovi.map((r) => r.preglediRepertoara ?? 0), 50)),
            medPreglediPunogPrefiksaPoRunu: Math.round(percentile(runovi.map((r) => r.preglediPunogPrefiksa ?? 0), 50)),
          });
        }
      }
    }
  }

  if (ikadFail) {
    emit({ tip: 'fail', razlog: 'nedovršeni ili pogreška poslovi' });
    process.exitCode = 1;
  }
}

main();