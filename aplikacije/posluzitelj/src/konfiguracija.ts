import path from 'node:path';
import { config as ucitajDotenv } from 'dotenv';
import { z } from 'zod';

ucitajDotenv({ path: path.resolve(process.cwd(), '../../.env') });

const shemaKonfiguracije = z.object({
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  BAZA_URL: z.string().min(1, 'BAZA_URL nije postavljen'),
  SESIJA_TAJNA: z.string().min(1, 'SESIJA_TAJNA nije postavljen'),
  EMAIL_API_KLJUC: z.string().default(''),
  EMAIL_POSILJATELJ: z.string().email().default('noreply@kaladont.hr'),
  JAVNA_ADRESA: z.string().url().default('http://localhost:3000'),
  DEV_MAIL: z.string().email().default('dev@example.com'),
  UMAMI_URL: z.string().default(''),
  ONEMOGUCI_TIMER_POTEZA: z.enum(['true', 'false']).default('false'),
  TRAJANJE_POTEZA_MS: z.coerce.number().int().positive().default(() => process.env.NODE_ENV === 'staging' || process.env.NODE_ENV === 'production' ? 30_000 : 5_000),
  ODGODA_POCETKA_PARTIJE_MS: z.coerce.number().int().nonnegative().default(() => process.env.NODE_ENV === 'staging' || process.env.NODE_ENV === 'production' ? 10_000 : 0),
  TOLERANCIJA_PREKIDA_MS: z.coerce.number().int().nonnegative().default(() => process.env.NODE_ENV === 'staging' || process.env.NODE_ENV === 'production' ? 10_000 : 1_000),
  HTTP_DOKUMENTI_PO_IP_MINUTI: z.coerce.number().int().positive().default(30),
  SOCKET_HANDSHAKE_PO_IP_MINUTI: z.coerce.number().int().positive().default(30),
  SOCKET_MAKSIMALNO_AKTIVNIH_VEZA: z.coerce.number().int().positive().default(1_000),
  SOCKET_MAKSIMALNO_PRIVATNIH_SOBA: z.coerce.number().int().positive().default(100),
  SOCKET_MAKSIMALNO_AKTIVNIH_PARTIJA: z.coerce.number().int().positive().default(500),
  SOCKET_PROZOR_DOGADAJA_MS: z.coerce.number().int().positive().default(60_000),
  SOCKET_DOGADAJI_PO_PROZORU: z.coerce.number().int().positive().default(30),
  ADMIN_TAJNI_KLJUC: z.string().default(''),
  SIMULACIJA_ADRESA: z.string().url().default('http://localhost:3000'),
  VERZIJA: z.string().default('lokalno'),
  DIGEST: z.string().default('lokalno'),
  POSLUZUJ_WEB: z.enum(['true', 'false']).default('false'),
});

export const konfiguracija = shemaKonfiguracije.parse(process.env);

if (konfiguracija.NODE_ENV === 'staging' || konfiguracija.NODE_ENV === 'production') {
  if (konfiguracija.SESIJA_TAJNA === 'promijeni-me') {
    throw new Error('SESIJA_TAJNA mora biti promijenjena izvan razvoja i testiranja.');
  }
  if (konfiguracija.ONEMOGUCI_TIMER_POTEZA === 'true') {
    throw new Error('ONEMOGUCI_TIMER_POTEZA ne smije biti true izvan razvoja i testiranja.');
  }
  if (konfiguracija.TOLERANCIJA_PREKIDA_MS !== 10_000) {
    throw new Error('TOLERANCIJA_PREKIDA_MS mora biti 10000 izvan razvoja i testiranja.');
  }
  if (!konfiguracija.EMAIL_API_KLJUC) {
    throw new Error('EMAIL_API_KLJUC mora biti postavljen izvan razvoja i testiranja.');
  }
  if (konfiguracija.JAVNA_ADRESA.startsWith('http://')) {
    throw new Error('JAVNA_ADRESA mora koristiti HTTPS izvan razvoja i testiranja.');
  }
}
