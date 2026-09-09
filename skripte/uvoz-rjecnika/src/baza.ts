/**
 * Vlastiti minimalni DB klijent za uvoznu skriptu - ne smije ovisiti o aplikacije/posluzitelj
 * (dijagram ovisnosti u struktura-repozitorija.md: skripte -> zajednicko, ništa drugo).
 */
import path from 'node:path';
import { config } from 'dotenv';
import { boolean, integer, pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

config({ path: path.resolve(process.cwd(), '../../.env') });

if (!process.env.BAZA_URL) {
  throw new Error('BAZA_URL nije postavljen (vidi .env.primjer)');
}

export const akcijaIzmjeneRjecnika = pgEnum('akcija_izmjene_rjecnika', [
  'dodana',
  'uklonjena',
  'vracena',
]);

export const rijeci = pgTable('rijeci', {
  rijec: text('rijec').primaryKey(),
  prvaDva: text('prva_dva').notNull(),
  zadnjaDva: text('zadnja_dva').notNull(),
  // ADR-013: kategorije oblika i leksemske grupe (vrsta:lema[:stupanj])
  vrste: text('vrste').array().notNull().default(['imenica']),
  grupe: text('grupe').array().notNull().default([]),
  frekvencija: integer('frekvencija').notNull().default(0),
  aktivna: boolean('aktivna').notNull().default(true),
  dodana: timestamp('dodana', { withTimezone: true }).notNull().defaultNow(),
  napomena: text('napomena'),
});

export const izmjeneRjecnika = pgTable('izmjene_rjecnika', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  rijec: text('rijec').notNull(),
  akcija: akcijaIzmjeneRjecnika('akcija').notNull(),
  razlog: text('razlog').notNull(),
  prijavaId: integer('prijava_id'),
  adminId: uuid('admin_id'),
  vrijeme: timestamp('vrijeme', { withTimezone: true }).notNull().defaultNow(),
});

const klijent = postgres(process.env.BAZA_URL);
export const baza = drizzle(klijent);
