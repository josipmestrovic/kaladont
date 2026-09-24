import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { baza, zatvoriBazu } from '../baza/klijent.js';

async function glavno(): Promise<void> {
  const direktorijMigracija = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../src/baza/migracije',
  );

  await migrate(baza, { migrationsFolder: direktorijMigracija });
  console.log('Migracije su uspješno primijenjene.');
}

glavno()
  .catch((greska) => {
    console.error(greska instanceof Error ? greska.message : greska);
    process.exitCode = 1;
  })
  .finally(async () => {
    await zatvoriBazu();
  });
