/**
 * Uvoz hrLex 1.3 u tablicu `rijeci` (docs/04-rjecnik/uvoz-rjecnika.md, ADR-013).
 * Idempotentan: UPSERT po rijec čuva aktivna+napomena (ručne izmjene admina preživljavaju).
 * Masovni uvoz se NE bilježi po-riječ u izmjene_rjecnika — sažetak ide u izvještaj.
 */
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { baza, rijeci } from './baza.js';
import { agregirajHrLex, preuzmiAkoNedostaje, provjeriMd5, PODACI_DIR } from './hrlex.js';
import { fmt, izracunajStatistiku, izvjestajMarkdown } from './statistika.js';

const PUTANJA_IZVJESTAJA = path.join(PODACI_DIR, 'izvjestaj-uvoza.md');
// 1000 redaka x 9 stupaca = 9000 parametara po upitu (Postgres limit je 65534)
const VELICINA_CHUNKA = 1000;

async function uvezi(): Promise<void> {
  await preuzmiAkoNedostaje();
  await provjeriMd5();

  const pocetak = Date.now();
  console.log('Parsiram hrLex...');
  const rezultat = await agregirajHrLex();
  const statistika = izracunajStatistiku(rezultat);
  console.log(`Parsirano: ${fmt(statistika.ukupnoOblika)} jedinstvenih oblika. Upisujem u bazu...`);

  const sve = [...rezultat.agregat.entries()];
  let upisano = 0;
  for (let i = 0; i < sve.length; i += VELICINA_CHUNKA) {
    const chunk = sve.slice(i, i + VELICINA_CHUNKA).map(([oblik, podaci]) => ({
      rijec: oblik,
      prvaDva: podaci.prvaDva,
      zadnjaDva: podaci.zadnjaDva,
      vrste: [...podaci.vrste],
      grupe: [...podaci.grupe],
      frekvencija: podaci.frekvencija,
      aktivna: true,
      napomena: null,
    }));
    await baza
      .insert(rijeci)
      .values(chunk)
      .onConflictDoUpdate({
        target: rijeci.rijec,
        // aktivna i napomena se namjerno NE diraju (odrzavanje-rjecnika.md)
        set: {
          prvaDva: sql`excluded.prva_dva`,
          zadnjaDva: sql`excluded.zadnja_dva`,
          vrste: sql`excluded.vrste`,
          grupe: sql`excluded.grupe`,
          frekvencija: sql`excluded.frekvencija`,
        },
      });
    upisano += chunk.length;
    if (upisano % 100000 < VELICINA_CHUNKA) console.log(`  ... upisano ${fmt(upisano)}`);
  }

  const trajanjeS = ((Date.now() - pocetak) / 1000).toFixed(0);
  const izvjestaj =
    izvjestajMarkdown('Izvještaj uvoza hrLexa u tablicu rijeci (ADR-013)', rezultat, statistika) +
    `\n\n## Upis\n\nUpisano/ažurirano **${fmt(upisano)}** redaka u ${trajanjeS} s.\n`;
  await writeFile(PUTANJA_IZVJESTAJA, izvjestaj, 'utf8');

  console.log('');
  console.log(`=== UVOZ GOTOV (${trajanjeS} s) — izvještaj: podaci/izvjestaj-uvoza.md ===`);
  console.log(`Upisano/ažurirano ${fmt(upisano)} oblika u ${fmt(statistika.ukupnoGrupa)} grupa.`);
  for (const { vrsta, oblika } of statistika.kategorije) console.log(`  ${vrsta.padEnd(10)} ${fmt(oblika)}`);
  console.log(`Mrtvih parova: ${fmt(statistika.mrtviParovi.length)} · „nt" mrtav: ${statistika.ntJeMrtav ? 'DA' : 'NE!!!'}`);
}

uvezi()
  .then(() => process.exit(0))
  .catch((greska) => {
    console.error('Uvoz nije uspio:', greska);
    process.exit(1);
  });
