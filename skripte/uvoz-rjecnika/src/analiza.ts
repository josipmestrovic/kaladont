/**
 * Analiza hrLexa za proširenje rječnika (ADR-013) — NE dira bazu.
 * Parsira hrLex s produkcijskim filtrima, gradi buduće serverske strukture
 * u memoriji i mjeri RAM. Izvještaj: podaci/izvjestaj-analize.md
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { agregirajHrLex, preuzmiAkoNedostaje, provjeriMd5, PODACI_DIR } from './hrlex.js';
import { fmt, izracunajStatistiku, izvjestajMarkdown } from './statistika.js';

const PUTANJA_IZVJESTAJA = path.join(PODACI_DIR, 'izvjestaj-analize.md');

function mb(bajtova: number): string {
  return `${(bajtova / 1024 / 1024).toFixed(0)} MB`;
}

async function analiziraj(): Promise<void> {
  await preuzmiAkoNedostaje();
  await provjeriMd5();

  const pocetak = Date.now();
  const rezultat = await agregirajHrLex();
  const statistika = izracunajStatistiku(rezultat);

  // Buduće serverske strukture (rjecnik/ucitaj.ts nakon ADR-013) + mjerenje RAM-a.
  globalThis.gc?.();
  globalThis.gc?.();
  const memPrije = process.memoryUsage();

  // Kanonizacija naziva grupa: identični stringovi dijele jedan objekt (pointer = trošak broja).
  const grupaKanon = new Map<string, string>();
  const rijecGrupe = new Map<string, string | string[]>();
  const poPrefiksu = new Map<string, string[]>();

  for (const [oblik, podaci] of rezultat.agregat) {
    const grupe = [...podaci.grupe].map((grupa) => {
      const kanon = grupaKanon.get(grupa);
      if (kanon) return kanon;
      grupaKanon.set(grupa, grupa);
      return grupa;
    });
    rijecGrupe.set(oblik, grupe.length === 1 ? grupe[0]! : grupe);
    const lista = poPrefiksu.get(podaci.prvaDva);
    if (lista) lista.push(oblik);
    else poPrefiksu.set(podaci.prvaDva, [oblik]);
  }

  rezultat.agregat.clear(); // server nema agregat - mjerimo samo strukture
  globalThis.gc?.();
  globalThis.gc?.();
  const memPoslije = process.memoryUsage();
  const trajanjeS = ((Date.now() - pocetak) / 1000).toFixed(0);

  const dodatak: string[] = [];
  dodatak.push('');
  dodatak.push('## Memorija (buduće serverske strukture)');
  dodatak.push('');
  dodatak.push('| Mjera | Prije izgradnje | Poslije izgradnje |');
  dodatak.push('|---|---|---|');
  dodatak.push(`| RSS | ${mb(memPrije.rss)} | ${mb(memPoslije.rss)} |`);
  dodatak.push(`| Heap used | ${mb(memPrije.heapUsed)} | ${mb(memPoslije.heapUsed)} |`);
  dodatak.push('');
  dodatak.push(
    `Strukture: Map<rijec, grupe> (${fmt(rijecGrupe.size)}), Map<prvaDva, rijec[]> (${fmt(poPrefiksu.size)} ključeva), ${fmt(grupaKanon.size)} kanoniziranih grupa. Trajanje: ${trajanjeS} s.`,
  );
  dodatak.push(`GC dostupan: ${globalThis.gc ? 'da (--expose-gc)' : 'ne — brojke su konzervativne'}`);
  dodatak.push('');

  const izvjestaj =
    izvjestajMarkdown('Izvještaj analize hrLexa — prošireni filtri (ADR-013)', rezultat, statistika) +
    '\n' +
    dodatak.join('\n');
  await writeFile(PUTANJA_IZVJESTAJA, izvjestaj, 'utf8');

  console.log('');
  console.log(`=== ANALIZA GOTOVA (${trajanjeS} s) — puni izvještaj: podaci/izvjestaj-analize.md ===`);
  console.log(`Jedinstvenih oblika: ${fmt(statistika.ukupnoOblika)} · grupa: ${fmt(statistika.ukupnoGrupa)}`);
  for (const { vrsta, oblika } of statistika.kategorije) console.log(`  ${vrsta.padEnd(10)} ${fmt(oblika)}`);
  console.log(`Mrtvih parova: ${fmt(statistika.mrtviParovi.length)} · „nt" mrtav: ${statistika.ntJeMrtav ? 'DA' : 'NE!!!'}`);
  console.log(`Heap nakon izgradnje struktura: ${mb(memPoslije.heapUsed)} (RSS ${mb(memPoslije.rss)})`);
}

analiziraj()
  .then(() => process.exit(0))
  .catch((greska) => {
    console.error('Analiza nije uspjela:', greska);
    process.exit(1);
  });
