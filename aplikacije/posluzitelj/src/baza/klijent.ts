import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { konfiguracija } from '../konfiguracija.js';
import * as shema from './shema.js';

const klijent = postgres(konfiguracija.BAZA_URL);

export const baza = drizzle(klijent, { schema: shema });
export const zatvoriBazu = () => klijent.end();
