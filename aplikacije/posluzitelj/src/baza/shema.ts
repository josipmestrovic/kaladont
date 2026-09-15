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
export const modPartije = pgEnum('mod_partije', ['cetiri_igraca', 'dva_igraca']);
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
  odigrane1v1: integer('odigrane_1v1').notNull().default(0),
  pobjede1v1: integer('pobjede_1v1').notNull().default(0),
  eliminacije1v1: integer('eliminacije_1v1').notNull().default(0),
  bodovi1v1: integer('bodovi_1v1').notNull().default(0),
  iskustvoUkupno: integer('iskustvo_ukupno').notNull().default(0),
  stvoren: timestamp('stvoren', { withTimezone: true }).notNull().defaultNow(),
  zadnjaAktivnost: timestamp('zadnja_aktivnost', { withTimezone: true }).notNull().defaultNow(),
});

export const statistikeRijeciIgraca = pgTable(
  'statistike_rijeci_igraca',
  {
    igracId: uuid('igrac_id').notNull().references(() => igraci.id),
    mod: modPartije('mod').notNull(),
    najduziStreak: integer('najduzi_streak').notNull().default(0),
    otkriveneJakoRijetkeGrupe: integer('otkrivene_jako_rijetke_grupe').notNull().default(0),
    otkriveneSrednjeRijetkeGrupe: integer('otkrivene_srednje_rijetke_grupe').notNull().default(0),
    otkriveneRijetkeGrupe: integer('otkrivene_rijetke_grupe').notNull().default(0),
    upisaneDugeRijeci: integer('upisane_duge_rijeci').notNull().default(0),
    upisaneSrednjeDugeRijeci: integer('upisane_srednje_duge_rijeci').notNull().default(0),
    upisaneJakoDugeRijeci: integer('upisane_jako_duge_rijeci').notNull().default(0),
    najduzaRijec: text('najduza_rijec'),
    najduzaRijecGrafemi: integer('najduza_rijec_grafemi').notNull().default(0),
    najrjedaRijec: text('najrjeda_rijec'),
    najrjedaRijecFrekvencija: integer('najrjeda_rijec_frekvencija'),
    najrjedaTier: smallint('najrjeda_tier'),
  },
  (tablica) => [primaryKey({ columns: [tablica.igracId, tablica.mod] })],
);

export const dnkStatistikeIgraca = pgTable(
  'dnk_statistike_igraca',
  {
    igracId: uuid('igrac_id').notNull().references(() => igraci.id),
    mod: modPartije('mod').notNull(),
    prihvaceniPotezi: integer('prihvaceni_potezi').notNull().default(0),
    ukupnoTrajanjePrihvaceniPoteziMs: integer('ukupno_trajanje_prihvacenih_poteza_ms').notNull().default(0),
    najduziStreak: integer('najduzi_streak').notNull().default(0),
    dugeRijeci: integer('duge_rijeci').notNull().default(0),
    srednjeDugeRijeci: integer('srednje_duge_rijeci').notNull().default(0),
    jakoDugeRijeci: integer('jako_duge_rijeci').notNull().default(0),
    rijetkeRijeci: integer('rijetke_rijeci').notNull().default(0),
    srednjeRijetkeRijeci: integer('srednje_rijetke_rijeci').notNull().default(0),
    jakoRijetkeRijeci: integer('jako_rijetke_rijeci').notNull().default(0),
    otkljucanAt: timestamp('otkljucan_at', { withTimezone: true }),
  },
  (tablica) => [primaryKey({ columns: [tablica.igracId, tablica.mod] })],
);

export const otkljucaneGrupeIgraca = pgTable(
  'otkljucane_grupe_igraca',
  {
    igracId: uuid('igrac_id').notNull().references(() => igraci.id),
    grupa: text('grupa').notNull(),
    tier: smallint('tier'),
    otkljucano: timestamp('otkljucano', { withTimezone: true }).notNull().defaultNow(),
  },
  (tablica) => [primaryKey({ columns: [tablica.igracId, tablica.grupa] })],
);

export const otkljucaneRijeciIgraca = pgTable(
  'otkljucane_rijeci_igraca',
  {
    igracId: uuid('igrac_id').notNull().references(() => igraci.id),
    rijec: text('rijec').notNull(),
    dugaTier: smallint('duga_tier'),
    rijetkaTier: smallint('rijetka_tier'),
    jakoDuga: boolean('jako_duga').notNull().default(false),
    jakoRijetka: boolean('jako_rijetka').notNull().default(false),
    otkljucano: timestamp('otkljucano', { withTimezone: true }).notNull().defaultNow(),
  },
  (tablica) => [primaryKey({ columns: [tablica.igracId, tablica.rijec] })],
);

export const napredakDostignucaIgraca = pgTable('napredak_dostignuca_igraca', {
  igracId: uuid('igrac_id').notNull().references(() => igraci.id, { onDelete: 'cascade' }),
  valjaniPoteziUkupno: integer('valjani_potezi_ukupno').notNull().default(0),
  rang: integer('rang').notNull().default(0),
  rijetkeLeksemskeGrupe: integer('rijetke_leksemske_grupe').notNull().default(0),
  dugeRijeci: integer('duge_rijeci').notNull().default(0),
  najduziStreak: integer('najduzi_streak').notNull().default(0),
  kaladontIzvedbe: integer('kaladont_izvedbe').notNull().default(0),
  kaladontZrtve: integer('kaladont_zrtve').notNull().default(0),
  izazvaneEliminacije: integer('izazvane_eliminacije').notNull().default(0),
  mrtvaSlovaEliminacije: integer('mrtva_slova_eliminacije').notNull().default(0),
  javnePobjede: integer('javne_pobjede').notNull().default(0),
  azurirano: timestamp('azurirano', { withTimezone: true }).notNull().defaultNow(),
}, (tablica) => [primaryKey({ columns: [tablica.igracId] })]);

export const dostignucaIgraca = pgTable('dostignuca_igraca', {
  igracId: uuid('igrac_id').notNull().references(() => igraci.id, { onDelete: 'cascade' }),
  dostignuceId: text('dostignuce_id').notNull(),
  razina: smallint('razina').notNull().default(0),
  prvoOtkljucano: timestamp('prvo_otkljucano', { withTimezone: true }),
  zadnjeOtkljucavanje: timestamp('zadnje_otkljucavanje', { withTimezone: true }),
}, (tablica) => [primaryKey({ columns: [tablica.igracId, tablica.dostignuceId] })]);

export const partije = pgTable('partije', {
  id: uuid('id').primaryKey().defaultRandom(),
  mod: modPartije('mod').notNull().default('cetiri_igraca'),
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
    iskustvo: integer('iskustvo').notNull().default(0),
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
