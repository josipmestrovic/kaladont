import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { zatvoriBazu } from '../baza/klijent.js';
import { stanjeRjecnika } from '../operacije/rjecnik-bootstrap.js';

const ZADANI_ULAZ_U_SLICI = '/app/alati/uvoz-rjecnika/dist/index.js';

async function nadjiUlazUvoznika(): Promise<string> {
  if (process.env.UVOZ_RJECNIKA_ENTRY?.trim()) {
    return process.env.UVOZ_RJECNIKA_ENTRY.trim();
  }

  const kandidati = [
    ZADANI_ULAZ_U_SLICI,
    path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../../../skripte/uvoz-rjecnika/dist/index.js',
    ),
  ];

  for (const kandidat of kandidati) {
    try {
      await access(kandidat);
      return kandidat;
    } catch {
      // probaj sljedeći
    }
  }

  throw new Error(
    'Uvoznik hrLexa nije pronađen. Očekivan je /app/alati/uvoz-rjecnika/dist/index.js ili lokalni dist.',
  );
}

function pokreniUvoz(ulaz: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const dijete = spawn(process.execPath, [ulaz], {
      env: {
        ...process.env,
        HRLEX_PODACI_DIR: process.env.HRLEX_PODACI_DIR?.trim() || '/tmp/kaladont-hrlex',
      },
      stdio: 'inherit',
    });
    dijete.on('error', reject);
    dijete.on('close', (kod) => resolve(kod ?? 1));
  });
}

async function glavno(): Promise<void> {
  const ulaz = await nadjiUlazUvoznika();
  console.log(`Pokrećem uvoz hrLexa: ${ulaz}`);
  const kod = await pokreniUvoz(ulaz);
  if (kod !== 0) {
    process.exitCode = kod;
    return;
  }

  const stanje = await stanjeRjecnika();
  console.log(`Nakon uvoza: ${stanje.broj} riječi (prag ${stanje.prag}).`);
  if (!stanje.dovoljan) {
    process.exitCode = 2;
    console.error('Uvoz je završio, ali rječnik je i dalje ispod praga — ponovi uvoz.');
  }
}

glavno()
  .catch((greska: unknown) => {
    console.error(greska instanceof Error ? greska.message : greska);
    process.exitCode = 1;
  })
  .finally(() => zatvoriBazu());
