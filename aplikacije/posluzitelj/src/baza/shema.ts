/**
 * Drizzle shema prema docs/03-arhitektura/model-podataka.md.
 * Nazivi tablica/stupaca: hrvatski, bez dijakritika, snake_case.
 */
import {
  bigint,
  boolean,
  check,
  date,
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
  unique,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { KonfiguracijaBota } from '../bot/konfiguracija-bota.js';

export const vrstaIgraca = pgEnum('vrsta_igraca', ['gost', 'registriran', 'admin']);
/** Tko upravlja identitetom (ADR-017); odvojeno od prava prijave i uloge. */
export const upravljacIgraca = pgEnum('upravljac_igraca', ['covjek', 'bot']);
export const tipPrezentacijeBota = pgEnum('tip_prezentacije_bota', ['imenovani', 'gost']);
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
export const tipPrijaveRijeci = pgEnum('tip_prijave_rijeci', ['za_brisanje', 'za_dodavanje']);
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
export const vrstaPohvaleIgre = pgEnum('vrsta_pohvale_igre', ['najduzi_niz', 'najvise_xp']);
export const vrstaMisije = pgEnum('vrsta_misije', ['dnevna', 'tjedna']);
export const statusDodjeleMisije = pgEnum('status_dodjele_misije', ['aktivna', 'dovrsena', 'zamijenjena', 'istekla']);
export const statusDotokaDnevneMisije = pgEnum('status_dotoka_dnevne_misije', ['dodijeljeno', 'preskoceno']);
export const kontekstIzvoraMisije = pgEnum('kontekst_izvora_misije', ['javna', 'trening']);

export const igraci = pgTable('igraci', {
  id: uuid('id').primaryKey().defaultRandom(),
  vrsta: vrstaIgraca('vrsta').notNull().default('gost'),
  upravljac: upravljacIgraca('upravljac').notNull().default('covjek'),
  nadimak: text('nadimak').notNull(),
  avatarId: smallint('avatar_id').notNull().default(0),
  avatarConfig: jsonb('avatar_config'),
  avatarRevision: integer('avatar_revision').notNull().default(0),
  email: text('email'),
  emailNaCekanju: text('email_na_cekanju'),
  lozinkaHash: text('lozinka_hash'),
  /** Brojač jednokratnih reset tokena; uspješan reset atomski povećava vrijednost. */
  resetLozinkeVerzija: integer('reset_lozinke_verzija').notNull().default(0),
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
    zaDostignuca: boolean('za_dostignuca').notNull().default(true),
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
  treningPobjede: integer('trening_pobjede').notNull().default(0),
  pohvaleNizUkupno: integer('pohvale_niz_ukupno').notNull().default(0),
  pohvaleXpUkupno: integer('pohvale_xp_ukupno').notNull().default(0),
  dovrseneMisije: integer('dovrsene_misije').notNull().default(0),
  privatneIgre: integer('privatne_igre').notNull().default(0),
  tjedniPaketi: integer('tjedni_paketi').notNull().default(0),
  dvostrukeKrune: integer('dvostruke_krune').notNull().default(0),
  cistePetice: integer('ciste_petice').notNull().default(0),
  svePohvale: integer('sve_pohvale').notNull().default(0),
  rijetkeGrdosije: integer('rijetke_grdosije').notNull().default(0),
  dnevneDesetke: integer('dnevne_desetke').notNull().default(0),
  tjedneElite: integer('tjedne_elite').notNull().default(0),
  mjesecneElite: integer('mjesecne_elite').notNull().default(0),
  naDvijeFronte: integer('na_dvije_fronte').notNull().default(0),
  jezicniDetektivi: integer('jezicni_detektivi').notNull().default(0),
  cinkarosi: integer('cinkarosi').notNull().default(0),
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

/** Konfiguracija javnog bota (ADR-017); identitet i statistika žive u `igraci`. */
export const postavkeBotova = pgTable('postavke_botova', {
  id: smallint('id').primaryKey().default(1),
  revizija: integer('revizija').notNull(),
  konfiguracija: jsonb('konfiguracija').$type<KonfiguracijaBota>().notNull(),
  azuriraoId: uuid('azurirao_id').references(() => igraci.id, { onDelete: 'set null' }),
  azurirano: timestamp('azurirano', { withTimezone: true }).notNull().defaultNow(),
}, (tablica) => [
  check('postavke_botova_jedan_zapis', sql`${tablica.id} = 1`),
  check('postavke_botova_pozitivna_revizija', sql`${tablica.revizija} > 0`),
]);

export const izmjenePostavkiBotova = pgTable('izmjene_postavki_botova', {
  revizija: integer('revizija').primaryKey(),
  konfiguracija: jsonb('konfiguracija').$type<KonfiguracijaBota>().notNull(),
  adminId: uuid('admin_id').references(() => igraci.id, { onDelete: 'set null' }),
  vrijeme: timestamp('vrijeme', { withTimezone: true }).notNull().defaultNow(),
});

export const izmjeneBotova = pgTable('izmjene_botova', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  botId: uuid('bot_id').references(() => igraci.id, { onDelete: 'set null' }),
  kljucSeeda: text('kljuc_seeda').notNull(),
  akcija: text('akcija').notNull(),
  aktivanPrije: boolean('aktivan_prije'),
  aktivanPoslije: boolean('aktivan_poslije'),
  adminId: uuid('admin_id').references(() => igraci.id, { onDelete: 'set null' }),
  vrijeme: timestamp('vrijeme', { withTimezone: true }).notNull().defaultNow(),
}, (tablica) => [
  check('izmjene_botova_akcija_dopustena', sql`${tablica.akcija} in ('stvoren', 'aktiviran', 'deaktiviran')`),
]);

export const treningRijeciIgraca = pgTable('trening_rijeci_igraca', {
  igracId: uuid('igrac_id').notNull().references(() => igraci.id, { onDelete: 'cascade' }),
  rijec: text('rijec').notNull(),
  prvoTreningId: uuid('prvo_trening_id').notNull(),
  otkljucano: timestamp('otkljucano', { withTimezone: true }).notNull().defaultNow(),
}, (tablica) => [
  primaryKey({ columns: [tablica.igracId, tablica.rijec] }),
  index('idx_trening_rijeci_igraca_rijec').on(tablica.igracId, tablica.rijec),
]);

export const pobjedeTreninga = pgTable('pobjede_treninga', {
  treningId: uuid('trening_id').primaryKey(),
  igracId: uuid('igrac_id').notNull().references(() => igraci.id, { onDelete: 'cascade' }),
  zavrseno: timestamp('zavrseno', { withTimezone: true }).notNull().defaultNow(),
}, (tablica) => [index('idx_pobjede_treninga_igrac_id').on(tablica.igracId, tablica.zavrseno)]);

export const botovi = pgTable('botovi', {
  igracId: uuid('igrac_id').primaryKey().references(() => igraci.id),
  kljucSeeda: text('kljuc_seeda').notNull(),
  tip: tipPrezentacijeBota('tip').notNull().default('imenovani'),
  aktivan: boolean('aktivan').notNull().default(true),
  verzijaProfila: smallint('verzija_profila').notNull().default(1),
  stvoren: timestamp('stvoren', { withTimezone: true }).notNull().defaultNow(),
}, (tablica) => [uniqueIndex('uq_botovi_kljuc_seeda').on(tablica.kljucSeeda)]);

export const partije = pgTable('partije', {
  id: uuid('id').primaryKey().defaultRandom(),
  mod: modPartije('mod').notNull().default('cetiri_igraca'),
  pocetak: timestamp('pocetak', { withTimezone: true }).notNull().defaultNow(),
  kraj: timestamp('kraj', { withTimezone: true }),
  status: statusPartije('status').notNull().default('u_tijeku'),
  pobjednikId: uuid('pobjednik_id').references(() => igraci.id),
  /** Koliko je mjesta za stolom popunio bot (ADR-017); za statistiku čekanja. */
  brojBotova: smallint('broj_botova').notNull().default(0),
}, (tablica) => [
  index('idx_partije_zavrsene_mod_kraj')
    .on(tablica.mod, tablica.kraj, tablica.id)
    .where(sql`${tablica.status} = 'zavrsena'`),
]);

/** Idempotency ključ završnog obračuna; privatne partije nemaju red u `partije`. */
export const obracuniPartija = pgTable('obracuni_partija', {
  partijaId: uuid('partija_id').notNull(),
  vrsta: vrstaObracunaPartije('vrsta').notNull(),
  stvoren: timestamp('stvoren', { withTimezone: true }).notNull().defaultNow(),
}, (tablica) => [primaryKey({ columns: [tablica.partijaId, tablica.vrsta] })]);

/** Audit usporednih pohvala javne igre; UNIQUE sprječava dvostruko uvećanje brojača. */
export const pohvaleIgre = pgTable(
  'pohvale_igre',
  {
    igraId: uuid('igra_id')
      .notNull()
      .references(() => partije.id, { onDelete: 'cascade' }),
    igracId: uuid('igrac_id')
      .notNull()
      .references(() => igraci.id, { onDelete: 'cascade' }),
    vrsta: vrstaPohvaleIgre('vrsta').notNull(),
    vrijednost: integer('vrijednost').notNull(),
    stvoreno: timestamp('stvoreno', { withTimezone: true }).notNull().defaultNow(),
  },
  (tablica) => [
    primaryKey({ columns: [tablica.igraId, tablica.igracId, tablica.vrsta] }),
    index('idx_pohvale_igre_igrac').on(tablica.igracId, tablica.stvoreno),
  ],
);

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
    // NULL = sažetak nije zabilježen (stare igre); 1 = svi stupci ispod su pouzdani.
    metrikeVerzija: smallint('metrike_verzija'),
    prihvaceneRijeci: integer('prihvacene_rijeci'),
    trajanjePrihvacenihMs: bigint('trajanje_prihvacenih_ms', { mode: 'number' }),
    najduziNizRijeci: integer('najduzi_niz_rijeci'),
    najduzaRijec: text('najduza_rijec'),
    najduzaRijecGrafemi: integer('najduza_rijec_grafemi'),
    // NULL = nepoznato (igre prije D02); 0 = igrač nije imao pravi pogrešan unos.
    pogresniUnosi: integer('pogresni_unosi'),
  },
  (tablica) => [
    primaryKey({ columns: [tablica.partijaId, tablica.igracId] }),
    index('idx_sudionici_partije_igrac_id_partija_id').on(tablica.igracId, tablica.partijaId),
    check('chk_sudionici_pogresni_unosi', sql`${tablica.pogresniUnosi} is null or ${tablica.pogresniUnosi} >= 0`),
    check('chk_sudionici_metrike_v1', sql`${tablica.metrikeVerzija} is null or (
      ${tablica.metrikeVerzija} = 1
      and ${tablica.prihvaceneRijeci} is not null
      and ${tablica.trajanjePrihvacenihMs} is not null
      and ${tablica.najduziNizRijeci} is not null
      and ${tablica.prihvaceneRijeci} >= 0
      and ${tablica.trajanjePrihvacenihMs} >= 0
      and ${tablica.najduziNizRijeci} >= 0
      and ${tablica.najduziNizRijeci} <= ${tablica.prihvaceneRijeci}
      and (
        (${tablica.prihvaceneRijeci} = 0 and ${tablica.trajanjePrihvacenihMs} = 0 and ${tablica.najduziNizRijeci} = 0
          and ${tablica.najduzaRijec} is null and ${tablica.najduzaRijecGrafemi} is null)
        or (${tablica.prihvaceneRijeci} > 0 and ${tablica.najduziNizRijeci} >= 1
          and ${tablica.najduzaRijec} is not null and ${tablica.najduzaRijecGrafemi} > 0)
      )
    )`),
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
  uniqueIndex('uq_potezi_partija_id_redni_broj').on(tablica.partijaId, tablica.redniBroj),
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
  tip: tipPrijaveRijeci('tip').notNull().default('za_brisanje'),
  rijec: text('rijec').notNull().default(''),
  poruka: text('poruka').notNull(),
  status: statusPrijave('status').notNull().default('nova'),
  vrijeme: timestamp('vrijeme', { withTimezone: true }).notNull().defaultNow(),
  rijesioId: uuid('rijesio_id').references(() => igraci.id),
  napomenaAdmina: text('napomena_admina'),
  /** Prihvaćena izmjena rječnika. Null dok je status samo pregledana/riješena bez stvarne promjene. */
  potvrdenaAkcija: text('potvrdena_akcija'),
  izmjenaRjecnikaId: integer('izmjena_rjecnika_id'),
}, (tablica) => [
  index('idx_prijave_igrac_id_partija_id_vrijeme').on(tablica.igracId, tablica.partijaId, tablica.vrijeme),
  index('idx_prijave_otvorene_rijec').on(tablica.tip, tablica.rijec).where(sql`${tablica.potvrdenaAkcija} is null and ${tablica.status} in ('nova', 'pregledana')`),
  check('chk_prijave_potvrdena_akcija', sql`${tablica.potvrdenaAkcija} is null or ${tablica.potvrdenaAkcija} in ('dodana', 'reaktivirana', 'deaktivirana')`),
  uniqueIndex('uq_prijave_brisanje_igrac_partija_potez')
    .on(tablica.igracId, tablica.partijaId, tablica.potezId)
    .where(sql`${tablica.tip} = 'za_brisanje'`),
  uniqueIndex('uq_prijave_dodavanje_igrac_partija_rijec')
    .on(tablica.igracId, tablica.partijaId, tablica.rijec)
    .where(sql`${tablica.tip} = 'za_dodavanje'`),
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
  /** Prihvaćena posljedica prijave. Null ostaje i kad je status riješena bez brisanja. */
  potvrdenaAkcija: text('potvrdena_akcija'),
  /** Razlog koji je administrator potvrdio, odvojen od statusa riješena. */
  potvrdeniRazlog: text('potvrdeni_razlog'),
}, (tablica) => [
  index('idx_prijave_igraca_vrijeme').on(tablica.vrijeme),
  index('idx_prijave_igraca_otvorene_pogrdne').on(tablica.prijavljeniIgracId).where(sql`${tablica.potvrdenaAkcija} is null and ${tablica.razlog} = 'pogrdan_nadimak'`),
  uniqueIndex('uq_prijave_igraca_partija_prijavitelj_igrac').on(tablica.partijaId, tablica.prijaviteljId, tablica.prijavljeniIgracId),
  check('chk_prijave_igraca_potvrdena_akcija', sql`${tablica.potvrdenaAkcija} is null or ${tablica.potvrdenaAkcija} = 'soft_brisanje'`),
  check('chk_prijave_igraca_potvrdeni_razlog', sql`${tablica.potvrdeniRazlog} is null or ${tablica.potvrdeniRazlog} in ('pogrdan_nadimak', 'neprimjereno_ponasanje', 'drugo')`),
  check('chk_prijave_igraca_potvrda_par', sql`(${tablica.potvrdenaAkcija} is null and ${tablica.potvrdeniRazlog} is null) or (${tablica.potvrdenaAkcija} is not null and ${tablica.potvrdeniRazlog} is not null)`),
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

/** Osobno stanje sustava misija; zaključava se pri dotoku/zamjeni/obračunu. */
export const stanjeMisijaIgraca = pgTable('stanje_misija_igraca', {
  igracId: uuid('igrac_id').primaryKey().references(() => igraci.id, { onDelete: 'cascade' }),
  inicijaliziranoU: timestamp('inicijalizirano_u', { withTimezone: true }).notNull(),
  zadnjiObradjeniDnevniDatum: date('zadnji_obradeni_dnevni_datum').notNull(),
  verzijaStanja: integer('verzija_stanja').notNull().default(1),
  zadnjiPregledDnevnihU: timestamp('zadnji_pregled_dnevnih_u', { withTimezone: true }),
  zadnjiPregledTjednihU: timestamp('zadnji_pregled_tjednih_u', { withTimezone: true }),
});

export const dotokDnevnihMisija = pgTable('dotok_dnevnih_misija', {
  id: uuid('id').primaryKey().defaultRandom(),
  igracId: uuid('igrac_id').notNull().references(() => igraci.id, { onDelete: 'cascade' }),
  lokalniDatum: date('lokalni_datum').notNull(),
  status: statusDotokaDnevneMisije('status').notNull(),
  stvorenoU: timestamp('stvoreno_u', { withTimezone: true }).notNull().defaultNow(),
}, (tablica) => [
  uniqueIndex('uq_dotok_dnevnih_misija_igrac_datum').on(tablica.igracId, tablica.lokalniDatum),
]);

export const ciklusiTjednihMisija = pgTable('ciklusi_tjednih_misija', {
  id: uuid('id').primaryKey().defaultRandom(),
  igracId: uuid('igrac_id').notNull().references(() => igraci.id, { onDelete: 'cascade' }),
  periodOd: timestamp('period_od', { withTimezone: true }).notNull(),
  periodDo: timestamp('period_do', { withTimezone: true }).notNull(),
  stvorenoU: timestamp('stvoreno_u', { withTimezone: true }).notNull().defaultNow(),
}, (tablica) => [
  uniqueIndex('uq_ciklusi_tjednih_misija_igrac_period').on(tablica.igracId, tablica.periodOd),
  check('chk_ciklusi_tjednih_period', sql`${tablica.periodOd} < ${tablica.periodDo}`),
]);

export const dodjeleMisija = pgTable('dodjele_misija', {
  id: uuid('id').primaryKey().defaultRandom(),
  igracId: uuid('igrac_id').notNull().references(() => igraci.id, { onDelete: 'cascade' }),
  vrsta: vrstaMisije('vrsta').notNull(),
  slot: smallint('slot').notNull(),
  ciklusId: uuid('ciklus_id').references(() => ciklusiTjednihMisija.id, { onDelete: 'cascade' }),
  predlozakId: text('predlozak_id').notNull(),
  verzijaDefinicije: integer('verzija_definicije').notNull(),
  snapshot: jsonb('snapshot').notNull(),
  napredak: integer('napredak').notNull().default(0),
  cilj: integer('cilj').notNull(),
  podstanje: jsonb('podstanje').notNull().default({}),
  status: statusDodjeleMisije('status').notNull().default('aktivna'),
  dostupnaOd: timestamp('dostupna_od', { withTimezone: true }).notNull(),
  zavrsenaU: timestamp('zavrsena_u', { withTimezone: true }),
  istjeceU: timestamp('istjece_u', { withTimezone: true }),
  stvorenoU: timestamp('stvoreno_u', { withTimezone: true }).notNull().defaultNow(),
}, (tablica) => [
  check('chk_dodjele_misija_slot', sql`${tablica.slot} between 1 and 3`),
  check('chk_dodjele_misija_napredak', sql`${tablica.napredak} >= 0 and ${tablica.napredak} <= ${tablica.cilj}`),
  check('chk_dodjele_misija_cilj', sql`${tablica.cilj} > 0`),
  check('chk_dodjele_misija_dnevni_istek', sql`(${tablica.vrsta} = 'dnevna' and ${tablica.istjeceU} is null) or ${tablica.vrsta} = 'tjedna'`),
  check('chk_dodjele_misija_tjedni_ciklus', sql`(${tablica.vrsta} = 'tjedna' and ${tablica.ciklusId} is not null) or (${tablica.vrsta} = 'dnevna' and ${tablica.ciklusId} is null)`),
  uniqueIndex('uq_dodjele_dnevna_aktivna_slot')
    .on(tablica.igracId, tablica.slot)
    .where(sql`${tablica.vrsta} = 'dnevna' and ${tablica.status} = 'aktivna'`),
  uniqueIndex('uq_dodjele_tjedna_trenutna_slot')
    .on(tablica.ciklusId, tablica.slot)
    .where(sql`${tablica.vrsta} = 'tjedna' and ${tablica.status} in ('aktivna', 'dovrsena')`),
  uniqueIndex('uq_dodjele_dnevna_aktivna_predlozak')
    .on(tablica.igracId, tablica.predlozakId)
    .where(sql`${tablica.vrsta} = 'dnevna' and ${tablica.status} = 'aktivna'`),
  uniqueIndex('uq_dodjele_tjedna_ciklus_predlozak')
    .on(tablica.ciklusId, tablica.predlozakId)
    .where(sql`${tablica.vrsta} = 'tjedna' and ${tablica.status} in ('aktivna', 'dovrsena', 'zamijenjena')`),
  index('idx_dodjele_misija_igrac_vrsta_status').on(tablica.igracId, tablica.vrsta, tablica.status),
]);

export const zamjeneMisija = pgTable('zamjene_misija', {
  id: uuid('id').primaryKey().defaultRandom(),
  igracId: uuid('igrac_id').notNull().references(() => igraci.id, { onDelete: 'cascade' }),
  vrsta: vrstaMisije('vrsta').notNull(),
  zagrebackiDatum: date('zagrebacki_datum').notNull(),
  staraDodjelaId: uuid('stara_dodjela_id').notNull().references(() => dodjeleMisija.id, { onDelete: 'cascade' }),
  novaDodjelaId: uuid('nova_dodjela_id').notNull().references(() => dodjeleMisija.id, { onDelete: 'cascade' }),
  idempotencyKey: text('idempotency_key').notNull(),
  stvorenoU: timestamp('stvoreno_u', { withTimezone: true }).notNull().defaultNow(),
}, (tablica) => [
  uniqueIndex('uq_zamjene_misija_kvota').on(tablica.igracId, tablica.vrsta, tablica.zagrebackiDatum),
  uniqueIndex('uq_zamjene_misija_idempotency').on(tablica.igracId, tablica.idempotencyKey),
]);

export const doprinosiMisijama = pgTable('doprinosi_misijama', {
  id: uuid('id').primaryKey().defaultRandom(),
  dodjelaId: uuid('dodjela_id').notNull().references(() => dodjeleMisija.id, { onDelete: 'cascade' }),
  igracId: uuid('igrac_id').notNull().references(() => igraci.id, { onDelete: 'cascade' }),
  kontekstIzvora: kontekstIzvoraMisije('kontekst_izvora').notNull(),
  izvorId: uuid('izvor_id').notNull(),
  delta: jsonb('delta').notNull(),
  stvorenoU: timestamp('stvoreno_u', { withTimezone: true }).notNull().defaultNow(),
}, (tablica) => [
  uniqueIndex('uq_doprinosi_misijama_dodjela_izvor').on(tablica.dodjelaId, tablica.kontekstIzvora, tablica.izvorId),
  index('idx_doprinosi_misijama_izvor').on(tablica.igracId, tablica.kontekstIzvora, tablica.izvorId),
]);

export const nagradeMisija = pgTable('nagrade_misija', {
  dodjelaId: uuid('dodjela_id').primaryKey().references(() => dodjeleMisija.id, { onDelete: 'cascade' }),
  igracId: uuid('igrac_id').notNull().references(() => igraci.id, { onDelete: 'cascade' }),
  xpNominalno: integer('xp_nominalno').notNull(),
  xpStvarno: integer('xp_stvarno').notNull(),
  kontekstIzvora: kontekstIzvoraMisije('kontekst_izvora').notNull(),
  izvorId: uuid('izvor_id').notNull(),
  dodijeljenaU: timestamp('dodijeljena_u', { withTimezone: true }).notNull(),
}, (tablica) => [
  check('chk_nagrade_misija_xp', sql`${tablica.xpNominalno} >= 0 and ${tablica.xpStvarno} >= 0 and ${tablica.xpStvarno} <= ${tablica.xpNominalno}`),
  index('idx_nagrade_misija_igrac').on(tablica.igracId, tablica.dodijeljenaU),
]);

/** Idempotentni dokaz dovršene misije za „Čovjek na misiji”. */
export const dokaziDostignucaMisija = pgTable('dokazi_dostignuca_misija', {
  igracId: uuid('igrac_id').notNull().references(() => igraci.id, { onDelete: 'cascade' }),
  dodjelaId: uuid('dodjela_id').notNull().references(() => dodjeleMisija.id, { onDelete: 'cascade' }),
}, (tablica) => [
  primaryKey({ columns: [tablica.igracId, tablica.dodjelaId] }),
]);

/** Idempotentni dokaz završene privatne igre za „Privatnik”. */
export const dokaziDostignucaPrivatnik = pgTable('dokazi_dostignuca_privatnik', {
  igracId: uuid('igrac_id').notNull().references(() => igraci.id, { onDelete: 'cascade' }),
  partijaId: uuid('partija_id').notNull().references(() => partije.id, { onDelete: 'cascade' }),
}, (tablica) => [
  primaryKey({ columns: [tablica.igracId, tablica.partijaId] }),
]);

/** Idempotentni dokaz potpunog tjednog paketa za „Tjedan pod kontrolom”. */
export const dokaziDostignucaTjedniPaket = pgTable('dokazi_dostignuca_tjedni_paket', {
  igracId: uuid('igrac_id').notNull().references(() => igraci.id, { onDelete: 'cascade' }),
  ciklusId: uuid('ciklus_id').notNull().references(() => ciklusiTjednihMisija.id, { onDelete: 'cascade' }),
}, (tablica) => [
  primaryKey({ columns: [tablica.igracId, tablica.ciklusId] }),
]);

/** Javna pobjeda jednog moda na lokalni dan (Europe/Zagreb). Jedinstveno po igraču, datumu i modu. */
export const evidencijaDnevnihPobjedaModova = pgTable('evidencija_dnevnih_pobjeda_modova', {
  igracId: uuid('igrac_id').notNull().references(() => igraci.id, { onDelete: 'cascade' }),
  lokalniDatum: date('lokalni_datum').notNull(),
  mod: modPartije('mod').notNull(),
}, (tablica) => [
  primaryKey({ columns: [tablica.igracId, tablica.lokalniDatum, tablica.mod] }),
]);

/** Dan u kojem su prisutne pobjede oba moda — jedan doprinos „Dvostrukoj kruni”. */
export const dokaziDostignucaDvostrukaKruna = pgTable('dokazi_dostignuca_dvostruka_kruna', {
  igracId: uuid('igrac_id').notNull().references(() => igraci.id, { onDelete: 'cascade' }),
  lokalniDatum: date('lokalni_datum').notNull(),
}, (tablica) => [
  primaryKey({ columns: [tablica.igracId, tablica.lokalniDatum] }),
]);

/** Javna pobjeda bez pravog pogrešnog unosa i s barem pet riječi. */
export const dokaziDostignucaCistaPetica = pgTable('dokazi_dostignuca_cista_petica', {
  igracId: uuid('igrac_id').notNull().references(() => igraci.id, { onDelete: 'cascade' }),
  partijaId: uuid('partija_id').notNull().references(() => partije.id, { onDelete: 'cascade' }),
}, (tablica) => [
  primaryKey({ columns: [tablica.igracId, tablica.partijaId] }),
]);

/** Ista javna igra donijela je i najdulji niz i najviše XP-a. */
export const dokaziDostignucaSvePohvale = pgTable('dokazi_dostignuca_sve_pohvale', {
  igracId: uuid('igrac_id').notNull().references(() => igraci.id, { onDelete: 'cascade' }),
  partijaId: uuid('partija_id').notNull().references(() => partije.id, { onDelete: 'cascade' }),
}, (tablica) => [
  primaryKey({ columns: [tablica.igracId, tablica.partijaId] }),
]);

/** Jedinstveni normalizirani oblik (NFC, trim, mala slova) koji je bio i dug i rijedak. */
export const dokaziDostignucaRijetkaGrdosija = pgTable('dokazi_dostignuca_rijetka_grdosija', {
  igracId: uuid('igrac_id').notNull().references(() => igraci.id, { onDelete: 'cascade' }),
  normaliziraniOblik: text('normalizirani_oblik').notNull(),
}, (tablica) => [
  primaryKey({ columns: [tablica.igracId, tablica.normaliziraniOblik] }),
]);

/**
 * Prvi ulazak u Top 10 jednog moda i kalendarskog razdoblja.
 * `obradjeno_u` je trajni red: null znači da nagrada još nije provedena.
 */
export const dokaziTop10Ulazaka = pgTable('dokazi_top10_ulazaka', {
  igracId: uuid('igrac_id').notNull().references(() => igraci.id, { onDelete: 'cascade' }),
  vrstaRazdoblja: text('vrsta_razdoblja').notNull(),
  kalendarskiPocetak: timestamp('kalendarski_pocetak', { withTimezone: true }).notNull(),
  mod: modPartije('mod').notNull(),
  metrika: text('metrika').notNull(),
  mjesto: smallint('mjesto').notNull(),
  opazenoU: timestamp('opazeno_u', { withTimezone: true }).notNull(),
  izvor: text('izvor').notNull(),
  izvorPartijaId: uuid('izvor_partija_id').references(() => partije.id, { onDelete: 'set null' }),
  obradjenoU: timestamp('obradjeno_u', { withTimezone: true }),
}, (tablica) => [
  primaryKey({ name: 'dokazi_top10_ulazaka_pk', columns: [tablica.igracId, tablica.vrstaRazdoblja, tablica.kalendarskiPocetak, tablica.mod] }),
  check('chk_dokazi_top10_ulazaka_vrsta', sql`${tablica.vrstaRazdoblja} in ('dnevno', 'tjedno', 'mjesecno')`),
  check('chk_dokazi_top10_ulazaka_metrika', sql`${tablica.metrika} in ('prosjek_bodova', 'niz_pobjeda')`),
  check('chk_dokazi_top10_ulazaka_mjesto', sql`${tablica.mjesto} between 1 and 10`),
  check('chk_dokazi_top10_ulazaka_izvor', sql`${tablica.izvor} in ('partija', 'brisanje')`),
  index('idx_dokazi_top10_ulazaka_neobradeni').on(tablica.igracId).where(sql`${tablica.obradjenoU} is null`),
  index('idx_dokazi_top10_ulazaka_partija').on(tablica.izvorPartijaId).where(sql`${tablica.obradjenoU} is null and ${tablica.izvorPartijaId} is not null`),
]);

/** Jedan doprinos Dnevnoj desetki, Tjednoj eliti ili Mjesečnoj eliti po kalendarskom početku. */
export const dokaziDostignucaTop10 = pgTable('dokazi_dostignuca_top10', {
  igracId: uuid('igrac_id').notNull().references(() => igraci.id, { onDelete: 'cascade' }),
  dostignuceId: text('dostignuce_id').notNull(),
  kalendarskiPocetak: timestamp('kalendarski_pocetak', { withTimezone: true }).notNull(),
}, (tablica) => [
  primaryKey({ name: 'dokazi_dostignuca_top10_pk', columns: [tablica.igracId, tablica.dostignuceId, tablica.kalendarskiPocetak] }),
  check('chk_dokazi_dostignuca_top10_id', sql`${tablica.dostignuceId} in ('dnevna_desetka', 'tjedna_elita', 'mjesecna_elita')`),
]);

/** Par Top 10 u oba moda za istu vrstu i kalendarski početak razdoblja. */
export const dokaziDostignucaNaDvijeFronte = pgTable('dokazi_dostignuca_na_dvije_fronte', {
  igracId: uuid('igrac_id').notNull().references(() => igraci.id, { onDelete: 'cascade' }),
  vrstaRazdoblja: text('vrsta_razdoblja').notNull(),
  kalendarskiPocetak: timestamp('kalendarski_pocetak', { withTimezone: true }).notNull(),
}, (tablica) => [
  primaryKey({ name: 'dokazi_dostignuca_na_dvije_fronte_pk', columns: [tablica.igracId, tablica.vrstaRazdoblja, tablica.kalendarskiPocetak] }),
  check('chk_dokazi_na_dvije_fronte_vrsta', sql`${tablica.vrstaRazdoblja} in ('dnevno', 'tjedno', 'mjesecno')`),
]);

/** Jedan životni doprinos Jezičnom detektivu po prijavitelju i normaliziranoj riječi. */
export const dokaziDostignucaJezicniDetektiv = pgTable('dokazi_dostignuca_jezicni_detektiv', {
  igracId: uuid('igrac_id').notNull().references(() => igraci.id, { onDelete: 'cascade' }),
  normaliziranaRijec: text('normalizirana_rijec').notNull(),
}, (tablica) => [
  primaryKey({ name: 'dokazi_dostignuca_jezicni_detektiv_pk', columns: [tablica.igracId, tablica.normaliziranaRijec] }),
  check('chk_dokazi_jezicni_detektiv_rijec', sql`char_length(${tablica.normaliziranaRijec}) >= 2`),
]);

/**
 * Jedan životni doprinos Cinkarošu po prijavitelju i prijavljenom računu.
 * Brisanje prijavljenog računa ne smije obrisati tuđi dokaz (nema cascade na prijavljenog).
 */
export const dokaziDostignucaCinkaros = pgTable('dokazi_dostignuca_cinkaros', {
  igracId: uuid('igrac_id').notNull().references(() => igraci.id, { onDelete: 'cascade' }),
  prijavljeniIgracId: uuid('prijavljeni_igrac_id').notNull().references(() => igraci.id),
}, (tablica) => [
  primaryKey({ name: 'dokazi_dostignuca_cinkaros_pk', columns: [tablica.igracId, tablica.prijavljeniIgracId] }),
  check('chk_dokazi_cinkaros_nije_samoprijava', sql`${tablica.igracId} <> ${tablica.prijavljeniIgracId}`),
]);

/** Trajne osobne obavijesti (seed za kasniji sandučić). Neprikazane čeka klijent. */
export const obavijestiIgraca = pgTable('obavijesti_igraca', {
  id: uuid('id').primaryKey().defaultRandom(),
  igracId: uuid('igrac_id').notNull().references(() => igraci.id, { onDelete: 'cascade' }),
  vrsta: text('vrsta').notNull(),
  dostignuceId: text('dostignuce_id'),
  novaRazina: smallint('nova_razina'),
  maksimalnaRazina: smallint('maksimalna_razina'),
  izvor: text('izvor'),
  kontekst: jsonb('kontekst').$type<Record<string, unknown> | null>(),
  stvorenoU: timestamp('stvoreno_u', { withTimezone: true }).notNull().defaultNow(),
  prikazanoU: timestamp('prikazano_u', { withTimezone: true }),
}, (tablica) => [
  unique('uq_obavijesti_igraca_dostignuce_razina').on(tablica.igracId, tablica.dostignuceId, tablica.novaRazina),
  index('idx_obavijesti_igraca_neprikazane').on(tablica.igracId).where(sql`${tablica.prikazanoU} is null`),
]);

export const ishodiMisijaIgara = pgTable('ishodi_misija_igara', {
  id: uuid('id').primaryKey().defaultRandom(),
  igracId: uuid('igrac_id').notNull().references(() => igraci.id, { onDelete: 'cascade' }),
  kontekstIzvora: kontekstIzvoraMisije('kontekst_izvora').notNull(),
  izvorId: uuid('izvor_id').notNull(),
  zavrsenoU: timestamp('zavrseno_u', { withTimezone: true }).notNull(),
  payload: jsonb('payload').notNull(),
  stvorenoU: timestamp('stvoreno_u', { withTimezone: true }).notNull().defaultNow(),
}, (tablica) => [
  uniqueIndex('uq_ishodi_misija_igara_izvor').on(tablica.igracId, tablica.kontekstIzvora, tablica.izvorId),
]);

/** Jedan valjani aktivni dan po registriranom igraču (audit / idempotentnost). */
export const aktivnostIgracaDani = pgTable('aktivnost_igraca_dani', {
  igracId: uuid('igrac_id').notNull().references(() => igraci.id, { onDelete: 'cascade' }),
  lokalniDatum: date('lokalni_datum').notNull(),
  zabiljezenAt: timestamp('zabiljezen_at', { withTimezone: true }).notNull().defaultNow(),
}, (tablica) => [
  primaryKey({ columns: [tablica.igracId, tablica.lokalniDatum] }),
]);

/** Agregat trenutačnog i najboljeg niza aktivnih dana. */
export const nizAktivnostiIgraca = pgTable('niz_aktivnosti_igraca', {
  igracId: uuid('igrac_id').primaryKey().references(() => igraci.id, { onDelete: 'cascade' }),
  zadnjiAktivniDatum: date('zadnji_aktivni_datum').notNull(),
  trenutniNiz: integer('trenutni_niz').notNull(),
  najboljiNiz: integer('najbolji_niz').notNull(),
  azuriranoAt: timestamp('azurirano_at', { withTimezone: true }).notNull().defaultNow(),
}, (tablica) => [
  check('chk_niz_aktivnosti_trenutni', sql`${tablica.trenutniNiz} >= 1`),
  check('chk_niz_aktivnosti_najbolji', sql`${tablica.najboljiNiz} >= ${tablica.trenutniNiz}`),
]);

export const kontekstAnalitike = pgEnum('kontekst_analitike', ['javna', 'privatna', 'trening']);
export const izvorPocetneAnalitike = pgEnum('izvor_pocetne_analitike', [
  'sigurni_skup',
  'rezervni_odabir',
  'nema_kandidata',
]);
export const statusOtvaranjaAnalitike = pgEnum('status_otvaranja_analitike', [
  'otvoren',
  'dva_odgovora_ok',
  'rani_incident',
  'zatvoren_drugim',
  'nepotpuno',
]);
export const upravljacAnalitike = pgEnum('upravljac_analitike', ['covjek', 'bot']);

/** Prozor prva dva odgovora nakon sustavske početne riječi (minimalna analitika). */
export const analitikaOtvaranja = pgTable('analitika_otvaranja', {
  id: uuid('id').primaryKey().defaultRandom(),
  igraId: uuid('igra_id').notNull(),
  redniBrojOtvaranja: integer('redni_broj_otvaranja').notNull(),
  kontekst: kontekstAnalitike('kontekst').notNull(),
  mod: modPartije('mod').notNull(),
  brojSudionika: smallint('broj_sudionika').notNull(),
  sustavskaRijec: text('sustavska_rijec'),
  izvor: izvorPocetneAnalitike('izvor').notNull(),
  brojOdgovora: smallint('broj_odgovora').notNull().default(0),
  odgovor1: text('odgovor_1'),
  odgovor2: text('odgovor_2'),
  status: statusOtvaranjaAnalitike('status').notNull().default('otvoren'),
  incidentPozicija: smallint('incident_pozicija'),
  incidentRijecUzrok: text('incident_rijec_uzrok'),
  incidentRazlog: text('incident_razlog'),
  incidentAutorUpravljac: upravljacAnalitike('incident_autor_upravljac'),
  incidentZrtvaUpravljac: upravljacAnalitike('incident_zrtva_upravljac'),
  dodijeljenoU: timestamp('dodijeljeno_u', { withTimezone: true }).notNull(),
  zatvorenoU: timestamp('zatvoreno_u', { withTimezone: true }),
  verzijaAplikacije: text('verzija_aplikacije'),
}, (tablica) => [
  uniqueIndex('uq_analitika_otvaranja_igra_redni').on(tablica.igraId, tablica.redniBrojOtvaranja),
  index('idx_analitika_otvaranja_dodijeljeno').on(tablica.dodijeljenoU, tablica.kontekst),
  index('idx_analitika_otvaranja_status').on(tablica.status, tablica.dodijeljenoU),
  check('chk_analitika_otvaranja_broj_odgovora', sql`${tablica.brojOdgovora} >= 0 and ${tablica.brojOdgovora} <= 2`),
  check(
    'chk_analitika_otvaranja_incident_pozicija',
    sql`${tablica.incidentPozicija} is null or ${tablica.incidentPozicija} in (1, 2)`,
  ),
]);

export const ishodAnalitikeIgre = pgEnum('ishod_analitike_igre', ['zavrsena', 'prekinuta', 'nepotpuno']);
export const vrstaRacunaAnalitike = pgEnum('vrsta_racuna_analitike', ['gost', 'registriran']);

export const analitikaIgre = pgTable('analitika_igre', {
  igraId: uuid('igra_id').primaryKey(),
  kontekst: kontekstAnalitike('kontekst').notNull(),
  mod: modPartije('mod').notNull(),
  pocetakU: timestamp('pocetak_u', { withTimezone: true }).notNull(),
  krajU: timestamp('kraj_u', { withTimezone: true }),
  ishod: ishodAnalitikeIgre('ishod'),
}, (tablica) => [
  index('idx_analitika_igre_pocetak').on(tablica.pocetakU, tablica.kontekst),
  index('idx_analitika_igre_kraj').on(tablica.krajU, tablica.ishod, tablica.kontekst),
]);

export const analitikaSudjelovanja = pgTable('analitika_sudjelovanja', {
  igraId: uuid('igra_id').notNull().references(() => analitikaIgre.igraId, { onDelete: 'cascade' }),
  igracId: uuid('igrac_id').notNull(),
  vrstaRacunaNaPocetku: vrstaRacunaAnalitike('vrsta_racuna_na_pocetku').notNull(),
}, (tablica) => [
  primaryKey({ columns: [tablica.igraId, tablica.igracId] }),
  index('idx_analitika_sudjelovanja_igrac').on(tablica.igracId),
]);
