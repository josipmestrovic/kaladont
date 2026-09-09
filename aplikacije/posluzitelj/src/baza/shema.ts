/**
 * Drizzle shema prema docs/03-arhitektura/model-podataka.md.
 * Nazivi tablica/stupaca: hrvatski, bez dijakritika, snake_case.
 */
import {
  bigint,
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const vrstaIgraca = pgEnum('vrsta_igraca', ['gost', 'registriran', 'admin']);
export const statusPartije = pgEnum('status_partije', ['u_tijeku', 'zavrsena', 'ponistena']);
export const nacinIspadanja = pgEnum('nacin_ispadanja', [
  'ne_znam',
  'istek',
  'mrtva_slova',
  'prekid',
  'pobjednik',
  'kaladont',
]);
export const vrstaPoteza = pgEnum('vrsta_poteza', [
  'rijec',
  'ne_znam',
  'istek',
  'prekid',
  'auto_kraj',
  'kaladont',
  'sustav_rijec',
]);
export const statusPrijave = pgEnum('status_prijave', ['nova', 'pregledana', 'rijesena']);
export const akcijaIzmjeneRjecnika = pgEnum('akcija_izmjene_rjecnika', [
  'dodana',
  'uklonjena',
  'vracena',
]);

export const igraci = pgTable('igraci', {
  id: uuid('id').primaryKey().defaultRandom(),
  vrsta: vrstaIgraca('vrsta').notNull().default('gost'),
  nadimak: text('nadimak').notNull(),
  avatarId: smallint('avatar_id').notNull().default(0),
  email: text('email'),
  lozinkaHash: text('lozinka_hash'),
  emailPotvrdjen: boolean('email_potvrdjen').notNull().default(false),
  odigrane: integer('odigrane').notNull().default(0),
  pobjede: integer('pobjede').notNull().default(0),
  eliminacijeUkupno: integer('eliminacije_ukupno').notNull().default(0),
  bodoviUkupno: integer('bodovi_ukupno').notNull().default(0),
  stvoren: timestamp('stvoren', { withTimezone: true }).notNull().defaultNow(),
  zadnjaAktivnost: timestamp('zadnja_aktivnost', { withTimezone: true }).notNull().defaultNow(),
});

export const partije = pgTable('partije', {
  id: uuid('id').primaryKey().defaultRandom(),
  pocetak: timestamp('pocetak', { withTimezone: true }).notNull().defaultNow(),
  kraj: timestamp('kraj', { withTimezone: true }),
  status: statusPartije('status').notNull().default('u_tijeku'),
  pobjednikId: uuid('pobjednik_id').references(() => igraci.id),
});

export const sudioniciPartije = pgTable(
  'sudionici_partije',
  {
    partijaId: uuid('partija_id')
      .notNull()
      .references(() => partije.id),
    igracId: uuid('igrac_id')
      .notNull()
      .references(() => igraci.id),
    sjedalo: smallint('sjedalo').notNull(),
    plasman: smallint('plasman'),
    bodovi: smallint('bodovi').notNull().default(0),
    eliminacije: smallint('eliminacije').notNull().default(0),
    nacinIspadanja: nacinIspadanja('nacin_ispadanja'),
    cekanjeMs: integer('cekanje_ms').notNull().default(0),
  },
  (tablica) => [primaryKey({ columns: [tablica.partijaId, tablica.igracId] })],
);

export const potezi = pgTable('potezi', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  partijaId: uuid('partija_id')
    .notNull()
    .references(() => partije.id),
  runda: smallint('runda').notNull(),
  redniBroj: smallint('redni_broj').notNull(),
  igracId: uuid('igrac_id').references(() => igraci.id), // null = sustavski potez (auto-odabrana rijec nakon kaladont efekta)
  vrsta: vrstaPoteza('vrsta').notNull(),
  rijec: text('rijec'),
  trazenaSlova: text('trazena_slova'),
  trajanjeMs: integer('trajanje_ms').notNull().default(0),
  vrijeme: timestamp('vrijeme', { withTimezone: true }).notNull().defaultNow(),
});

export const rijeci = pgTable(
  'rijeci',
  {
    rijec: text('rijec').primaryKey(),
    prvaDva: text('prva_dva').notNull(),
    zadnjaDva: text('zadnja_dva').notNull(),
    // ADR-013: kategorije oblika i leksemske grupe (vrsta:lema[:stupanj]) - oblik moze imati vise
    vrste: text('vrste').array().notNull().default(['imenica']),
    grupe: text('grupe').array().notNull().default([]),
    frekvencija: integer('frekvencija').notNull().default(0),
    aktivna: boolean('aktivna').notNull().default(true),
    dodana: timestamp('dodana', { withTimezone: true }).notNull().defaultNow(),
    napomena: text('napomena'),
  },
  (tablica) => [
    // model-podataka.md: trazenje nastavaka i analiza klopki - igra ih ne koristi (ADR-007, radi iz memorije)
    index('idx_rijeci_prva_dva').on(tablica.prvaDva).where(sql`aktivna`),
    index('idx_rijeci_zadnja_dva').on(tablica.zadnjaDva).where(sql`aktivna`),
  ],
);

export const prijave = pgTable('prijave', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  partijaId: uuid('partija_id')
    .notNull()
    .references(() => partije.id),
  potezId: bigint('potez_id', { mode: 'number' }).references(() => potezi.id),
  igracId: uuid('igrac_id')
    .notNull()
    .references(() => igraci.id),
  poruka: text('poruka').notNull(),
  status: statusPrijave('status').notNull().default('nova'),
  vrijeme: timestamp('vrijeme', { withTimezone: true }).notNull().defaultNow(),
  rijesioId: uuid('rijesio_id').references(() => igraci.id),
  napomenaAdmina: text('napomena_admina'),
});

export const izmjeneRjecnika = pgTable('izmjene_rjecnika', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  rijec: text('rijec').notNull(),
  akcija: akcijaIzmjeneRjecnika('akcija').notNull(),
  razlog: text('razlog').notNull(),
  prijavaId: integer('prijava_id').references(() => prijave.id),
  adminId: uuid('admin_id').references(() => igraci.id),
  vrijeme: timestamp('vrijeme', { withTimezone: true }).notNull().defaultNow(),
});
