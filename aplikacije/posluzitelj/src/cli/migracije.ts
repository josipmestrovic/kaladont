import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { urlZaMigracije } from '../operacije/db-uloge.js';

async function glavno(): Promise<void> {
  const bazaUrl = urlZaMigracije();
  if (!bazaUrl) {
    throw new Error('BAZA_URL_MIGRACIJE ili BAZA_URL nije postavljen.');
  }

  const direktorijMigracija = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../../src/baza/migracije',
  );

  const klijent = postgres(bazaUrl, { max: 1 });
  try {
    const baza = drizzle(klijent);
    await migrate(baza, { migrationsFolder: direktorijMigracija });
    console.log('Migracije su uspješno primijenjene.');
  } finally {
    await klijent.end({ timeout: 5 });
  }
}

glavno().catch((greska) => {
  console.error(greska instanceof Error ? greska.message : greska);
  process.exitCode = 1;
});
