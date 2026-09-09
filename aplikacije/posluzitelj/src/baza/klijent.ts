import path from 'node:path';
import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as shema from './shema.js';

config({ path: path.resolve(process.cwd(), '../../.env') });

if (!process.env.BAZA_URL) {
  throw new Error('BAZA_URL nije postavljen (vidi .env.primjer)');
}

const klijent = postgres(process.env.BAZA_URL);

export const baza = drizzle(klijent, { schema: shema });
export const zatvoriBazu = () => klijent.end();
