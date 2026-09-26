/**
 * Drizzle shema prema docs/03-arhitektura/model-podataka.md.
 * Nazivi tablica/stupaca: hrvatski, bez dijakritika, snake_case.
 */
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
  uniqueIndex,
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
export const statusPovratneInformacije = pgEnum('status_povratne_informacije', ['nova', 'pregledana', 'arhivirana']);
export const akcijaIzmjeneRjecnika = pgEnum('akcija_izmjene_rjecnika', [
  'dodana',
  'uklonjena',
  'vracena',
]);
export const vrstaObracunaPartije = pgEnum('vrsta_obracuna_partije', [
  'javna_partija',
  'privatna_gamifikacija',
]);

export const igraci = pgTable('igraci', {
  id: uuid('id').primaryKey().defaultRandom(),
  vrsta: vrstaIgraca('vrsta').notNull().default('gost'),
  nadimak: text('nadimak').notNull(),
  avatarId: smallint('avatar_id').notNull().default(0),
  avatarConfig: jsonb('avatar_config'),
  avatarRevision: integer('avatar_revision').notNull().default(0),
  email: text('email'),
  emailNaCekanju: text('email_na_cekanju'),
  lozinkaHash: text('lozinka_hash'),
  emailPotvrdjen: boolean('email_potvrdjen').notNull().default(false),
  emailPotvrdaZatrazenAt: timestamp('email_potvrda_zatrazen_at', { withTimezone: true }),
  emailPotvrdaPoslanaAt: timestamp('email_potvrda_poslana_at', { withTimezone: true }),
  obrisanAt: timestamp('obrisan_at', { withTimezone: true }),
  registriranAt: timestamp('registriran_at', { withTimezone: true }),
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
}, (tablica) => [
  uniqueIndex('uq_igraci_email_lower').on(sql`lower(${tablica.email})`).where(sql`${tablica.email} is not null`),
]);

export const sesije = pgTable(
  'sesije',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    igracId: uuid('igrac_id')
      .notNull()
      .references(() => igraci.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    stvorena: timestamp('stvorena', { withTimezone: true }).notNull().defaultNow(),
    istek: timestamp('istek', { withTimezone: true }).notNull(),
  },
  (tablica) => [index('idx_sesije_igrac_id').on(tablica.igracId), index('idx_sesije_istek').on(tablica.istek)],
);

export const nizoviPobjedaIgraca = pgTable(
  'nizovi_pobjeda_igraca',
  {
    igracId: uuid('igrac_id').notNull().references(() => igraci.id, { onDelete: 'cascade' }),
    mod: modPartije('mod').notNull(),
    trenutniNiz: integer('trenutni_niz').notNull().default(0),
    najboljiNiz: integer('najbolji_niz').notNull().default(0),
    zadnjaObradenaPartijaId: uuid('zadnja_obradena_partija_id'),
    azurirano: timestamp('azurirano', { withTimezone: true }).notNull().defaultNow(),
  },
  (tablica) => [
    primaryKey({ columns: [tablica.igracId, tablica.mod] }),
    index('idx_nizovi_pobjeda_zadnja_partija').on(tablica.zadnjaObradenaPartijaId),
  ],
);

export const rezultatiFormeIgraca = pgTable(
  'rezultati_forme_igraca',
  {
    igracId: uuid('igrac_id').notNull().references(() => igraci.id, { onDelete: 'cascade' }),
    partijaId: uuid('partija_id').notNull(),
    mod: modPartije('mod').notNull(),
    zavrseno: timestamp('zavrseno', { withTimezone: true }).notNull().defaultNow(),
    plasman: smallint('plasman').notNull(),
    bodovi: smallint('bodovi').notNull(),
    eliminacije: smallint('eliminacije').notNull(),
  },
  (tablica) => [
    primaryKey({ columns: [tablica.igracId, tablica.partijaId] }),
    index('idx_rezultati_forme_igraca_mod_zavrseno').on(tablica.igracId, tablica.mod, tablica.zavrseno),
  ],
);

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
    zbrojOcjenaIgre: integer('zbroj_ocjena_igre').notNull().default(0),
    brojOcjenaIgre: integer('broj_ocjena_igre').notNull().default(0),
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
  (tablica) => [
    primaryKey({ columns: [tablica.igracId, tablica.rijec] }),
    index('idx_otkljucane_rijeci_igraca_duga').on(tablica.igracId, tablica.dugaTier, tablica.rijec),
    index('idx_otkljucane_rijeci_igraca_rijetka').on(tablica.igracId, tablica.rijetkaTier, tablica.rijec),
  ],
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
  povratneInformacije: integer('povratne_informacije').notNull().default(0),
  anketaIspunjena: boolean('anketa_ispunjena').notNull().default(false),
  azurirano: timestamp('azurirano', { withTimezone: true }).notNull().defaultNow(),
}, (tablica) => [primaryKey({ columns: [tablica.igracId] })]);

export const povratneInformacije = pgTable('povratne_informacije', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  igracId: uuid('igrac_id').notNull().references(() => igraci.id, { onDelete: 'cascade' }),
  poruka: text('poruka').notNull(),
  pravila: smallint('pravila'),
  rjecnik: smallint('rjecnik'),
  vrijemePoteza: smallint('vrijeme_poteza'),
  snalazenjeUAplikaciji: smallint('snalazenje_u_aplikaciji'),
  brzinaUcitavanja: smallint('brzina_ucitavanja'),
  gamifikacija: smallint('gamifikacija'),
  status: statusPovratneInformacije('status').notNull().default('nova'),
  vrijeme: timestamp('vrijeme', { withTimezone: true }).notNull().defaultNow(),
  pregledaoId: uuid('pregledao_id').references(() => igraci.id),
  pregledano: timestamp('pregledano', { withTimezone: true }),
}, (tablica) => [
  index('idx_povratne_informacije_vrijeme').on(tablica.vrijeme),
  index('idx_povratne_informacije_status').on(tablica.status),
]);

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

/** Idempotency ključ završnog obračuna; privatne partije nemaju red u `partije`. */
export const obracuniPartija = pgTable('obracuni_partija', {
  partijaId: uuid('partija_id').notNull(),
  vrsta: vrstaObracunaPartije('vrsta').notNull(),
  stvoren: timestamp('stvoren', { withTimezone: true }).notNull().defaultNow(),
}, (tablica) => [primaryKey({ columns: [tablica.partijaId, tablica.vrsta] })]);

export const sudioniciPartije = pgTable(
  'sudionici_partije',
  {
    partijaId: uuid('partija_id')
      .notNull()
      .references(() => partije.id),
    igracId: uuid('igrac_id')
      .notNull()
      .references(() => igraci.id),
    nadimak: text('nadimak').notNull().default('Gost'),
    sjedalo: smallint('sjedalo').notNull(),
    plasman: smallint('plasman'),
    bodovi: smallint('bodovi').notNull().default(0),
    eliminacije: smallint('eliminacije').notNull().default(0),
    iskustvo: integer('iskustvo').notNull().default(0),
    nacinIspadanja: nacinIspadanja('nacin_ispadanja'),
    cekanjeMs: integer('cekanje_ms').notNull().default(0),
  },
  (tablica) => [
    primaryKey({ columns: [tablica.partijaId, tablica.igracId] }),
    index('idx_sudionici_partije_igrac_id_partija_id').on(tablica.igracId, tablica.partijaId),
  ],
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
}, (tablica) => [
  index('idx_potezi_partija_id_redni_broj').on(tablica.partijaId, tablica.redniBroj),
]);

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

export const vlastitaImena = pgTable('vlastita_imena', {
  rijec: text('rijec').primaryKey(),
  leme: text('leme').array().notNull().default([]),
  frekvencija: integer('frekvencija').notNull().default(0),
});

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
}, (tablica) => [
  index('idx_prijave_igrac_id_partija_id_vrijeme').on(tablica.igracId, tablica.partijaId, tablica.vrijeme),
  uniqueIndex('uq_prijave_igrac_partija_potez').on(tablica.igracId, tablica.partijaId, tablica.potezId),
]);

export const prijaveIgraca = pgTable('prijave_igraca', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  partijaId: uuid('partija_id').notNull().references(() => partije.id),
  prijaviteljId: uuid('prijavitelj_id').notNull().references(() => igraci.id),
  prijavljeniIgracId: uuid('prijavljeni_igrac_id').notNull().references(() => igraci.id),
  razlog: text('razlog').notNull(),
  poruka: text('poruka').notNull(),
  status: statusPrijave('status').notNull().default('nova'),
  vrijeme: timestamp('vrijeme', { withTimezone: true }).notNull().defaultNow(),
  rijesioId: uuid('rijesio_id').references(() => igraci.id),
  napomenaAdmina: text('napomena_admina'),
}, (tablica) => [
  index('idx_prijave_igraca_vrijeme').on(tablica.vrijeme),
  uniqueIndex('uq_prijave_igraca_partija_prijavitelj_igrac').on(tablica.partijaId, tablica.prijaviteljId, tablica.prijavljeniIgracId),
]);

export const izmjeneRjecnika = pgTable('izmjene_rjecnika', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  rijec: text('rijec').notNull(),
  akcija: akcijaIzmjeneRjecnika('akcija').notNull(),
  razlog: text('razlog').notNull(),
  prijavaId: integer('prijava_id').references(() => prijave.id),
  adminId: uuid('admin_id').references(() => igraci.id),
  vrijeme: timestamp('vrijeme', { withTimezone: true }).notNull().defaultNow(),
});
