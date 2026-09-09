import path from 'node:path';
import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({ path: path.resolve(process.cwd(), '../../.env') });

if (!process.env.BAZA_URL) {
  throw new Error('BAZA_URL nije postavljen (vidi .env.primjer)');
}

export default defineConfig({
  schema: './src/baza/shema.ts',
  out: './src/baza/migracije',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.BAZA_URL,
  },
});
