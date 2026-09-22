/**
 * Fastify rute za profil, ljestvicu i povijest partija (javno čitljivi agregati).
 */
import type { FastifyInstance } from 'fastify';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { and, asc, desc, eq, gte, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  DEFINICIJE_DOSTIGNUCA,
  validirajAvatarConfig,
  izracunajRang,
  izracunajRazinuDostignuca,
  stanjeIskustva,
} from 'zajednicko';
import { baza } from '../baza/klijent.js';
import {
  dostignucaIgraca,
  dnkStatistikeIgraca,
  igraci,
  napredakDostignucaIgraca,
  otkljucaneRijeciIgraca,
  partije,
  potezi,
  statistikeRijeciIgraca,
  sudioniciPartije,
} from '../baza/shema.js';
import { BROJ_AVATARA } from '../identitet/identitet.js';
import type { RjecnikUMemoriji } from '../rjecnik/ucitaj.js';
import { porukaPotvrdeEmaila, posaljiEmail } from '../email.js';
import { konfiguracija } from '../konfiguracija.js';
import { izdajTokenPotvrdeEmaila } from '../racuni/tokeni.js';
import { izracunajDnk } from '../igra/izracun-dnk.js';
import {
  pokusajIdentifikaciju,
  zahtijevajIdentifikaciju,
  zahtijevajPrijavu,
  type ZahtjevSIgracem,
} from '../racuni/autentikacija.js';
import { MAKSIMALNA_DULJINA_NADIMKA, MINIMALNA_DULJINA_NADIMKA, PORUKA_NEVALJANOG_NADIMKA, UZORAK_NADIMKA } from 'zajednicko';

const ShemaAvatar = z.object({
  avatarId: z
    .number()
    .int()
    .min(0)
    .max(BROJ_AVATARA - 1),
});
const ShemaNadimak = z.object({ nadimak: z.string().min(MINIMALNA_DULJINA_NADIMKA, PORUKA_NEVALJANOG_NADIMKA).max(MAKSIMALNA_DULJINA_NADIMKA, PORUKA_NEVALJANOG_NADIMKA).regex(UZORAK_NADIMKA, PORUKA_NEVALJANOG_NADIMKA) });
const ShemaLimit = z.object({
  limit: z.coerce
    .number()
    .int()
    .refine((n) => n === 10 || n === 100, 'limit mora biti 10 ili 100')
    .optional(),
});
const ShemaEmail = z.object({ noviEmail: z.string().email(), lozinka: z.string().min(1) });
const ShemaLozinka = z.object({
  trenutnaLozinka: z.string().min(1),
  novaLozinka: z.string().min(8),
});

const MAKSIMALNO_OTKLJUCANIH_RIJECI_PO_KATEGORIJI = 200;
const MAKSIMALNO_POTEZA_PO_STRANICI = 500;
const ZIVOTNI_VIJEK_TOP_RIJECI_MS = 30_000;
const MAKSIMALNO_PARTIJA_PO_STRANICI = 50;
const MAKSIMALNO_RIJECI_PO_STRANICI = 50;

type TopRijeciCache = {
  stvoreno: number;
  ukupnoPartija: number;
  retci: { rijec: string | null; brojUpotreba: number; brojPartija: number }[];
};

let topRijeciCache: TopRijeciCache | null = null;

type CursorPovijestiPartija = { pocetak: string; partijaId: string };
type CursorRijeci = { rijec: string };
const KATEGORIJE_RIJECI = ['duge', 'srednjeDuge', 'jakoDuge', 'rijetke', 'srednjeRijetke', 'jakoRijetke'] as const;
type KategorijaRijeci = (typeof KATEGORIJE_RIJECI)[number];

function kodirajCursor<T>(vrijednost: T): string {
  return Buffer.from(JSON.stringify(vrijednost), 'utf8').toString('base64url');
}

function dekodirajCursor<T>(vrijednost: string | undefined): T | null {
  if (!vrijednost) return null;
  try {
    return JSON.parse(Buffer.from(vrijednost, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}

function normalizirajEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function dohvatiTopRijeci(): Promise<TopRijeciCache> {
  const sada = Date.now();
  if (topRijeciCache && sada - topRijeciCache.stvoreno < ZIVOTNI_VIJEK_TOP_RIJECI_MS) {
    return topRijeciCache;
  }

  const [[redakUkupno], retci] = await Promise.all([
    baza.select({ ukupnoPartija: sql<number>`count(*)::int` }).from(partije),
    baza
      .select({
        rijec: potezi.rijec,
        brojUpotreba: sql<number>`count(*)::int`,
        brojPartija: sql<number>`count(distinct ${potezi.partijaId})::int`,
      })
      .from(potezi)
      .where(sql`${potezi.vrsta} = 'rijec' and ${potezi.rijec} is not null`)
      .groupBy(potezi.rijec)
      .orderBy(desc(sql`count(*)`), asc(potezi.rijec))
      .limit(100),
  ]);

  topRijeciCache = {
    stvoreno: sada,
    ukupnoPartija: redakUkupno?.ukupnoPartija ?? 0,
    retci,
  };
  return topRijeciCache;
}

function prosjekBodova(bodoviUkupno: number, odigrane: number): number {
  return odigrane > 0 ? bodoviUkupno / odigrane : 0;
}

function stilIgre(
  odigrane: number,
  eliminacije: number,
): 'agresivan' | 'uravnotežen' | 'pacifist' | 'neodređen' {
  if (odigrane === 0) return 'neodređen';
  const eliminacijePoPartiji = odigrane > 0 ? eliminacije / odigrane : 0;
  if (eliminacijePoPartiji > 0.4) return 'agresivan';
  if (eliminacijePoPartiji >= 0.2) return 'uravnotežen';
  return 'pacifist';
}

async function dohvatiStatistiku(igracId: string, mod: 'cetiri_igraca' | 'dva_igraca') {
  const [statistika] = await baza
    .select()
    .from(statistikeRijeciIgraca)
    .where(
      sql`${statistikeRijeciIgraca.igracId} = ${igracId} and ${statistikeRijeciIgraca.mod} = ${mod}`,
    )
    .limit(1);
  return statistika ?? null;
}

async function dohvatiDnkStatistiku(igracId: string, mod: 'cetiri_igraca' | 'dva_igraca') {
  const [statistika] = await baza
    .select()
    .from(dnkStatistikeIgraca)
    .where(sql`${dnkStatistikeIgraca.igracId} = ${igracId} and ${dnkStatistikeIgraca.mod} = ${mod}`)
    .limit(1);
  return statistika ?? null;
}

function prosjecnaOcjena(
  statistika: Awaited<ReturnType<typeof dohvatiDnkStatistiku>> | null,
): number | null {
  if (!statistika || statistika.brojOcjenaIgre === 0) return null;
  return statistika.zbrojOcjenaIgre / statistika.brojOcjenaIgre;
}

async function dohvatiOtkljucaneRijeci(igracId: string) {
  const [duge, srednjeDuge, jakoDuge, rijetke, srednjeRijetke, jakoRijetke] = await Promise.all([
    dohvatiRijeciPoTieru(igracId, otkljucaneRijeciIgraca.dugaTier, 0),
    dohvatiRijeciPoTieru(igracId, otkljucaneRijeciIgraca.dugaTier, 1),
    dohvatiRijeciPoTieru(igracId, otkljucaneRijeciIgraca.dugaTier, 2),
    dohvatiRijeciPoTieru(igracId, otkljucaneRijeciIgraca.rijetkaTier, 2),
    dohvatiRijeciPoTieru(igracId, otkljucaneRijeciIgraca.rijetkaTier, 1),
    dohvatiRijeciPoTieru(igracId, otkljucaneRijeciIgraca.rijetkaTier, 0),
  ]);
  return {
    duge,
    srednjeDuge,
    jakoDuge,
    rijetke,
    srednjeRijetke,
    jakoRijetke,
  };
}

function stupacZaKategoriju(kategorija: KategorijaRijeci) {
  return kategorija === 'duge' || kategorija === 'srednjeDuge' || kategorija === 'jakoDuge'
    ? otkljucaneRijeciIgraca.dugaTier
    : otkljucaneRijeciIgraca.rijetkaTier;
}

function tierZaKategoriju(kategorija: KategorijaRijeci): number {
  return kategorija === 'duge' ? 0
    : kategorija === 'srednjeDuge' ? 1
      : kategorija === 'jakoDuge' ? 2
        : kategorija === 'rijetke' ? 2
          : kategorija === 'srednjeRijetke' ? 1
            : 0;
}

async function dohvatiStranicuRijeci(igracId: string, kategorija: KategorijaRijeci, limit: number, cursor: CursorRijeci | null) {
  const stupac = stupacZaKategoriju(kategorija);
  const uvjet = and(
    eq(otkljucaneRijeciIgraca.igracId, igracId),
    eq(stupac, tierZaKategoriju(kategorija)),
    ...(cursor ? [sql`${otkljucaneRijeciIgraca.rijec} > ${cursor.rijec}`] : []),
  );
  const retci = await baza
    .select({ rijec: otkljucaneRijeciIgraca.rijec })
    .from(otkljucaneRijeciIgraca)
    .where(uvjet)
    .orderBy(asc(otkljucaneRijeciIgraca.rijec))
    .limit(limit + 1);
  const imaJos = retci.length > limit;
  const rijeciZaOdgovor = imaJos ? retci.slice(0, limit) : retci;
  const zadnja = rijeciZaOdgovor.at(-1);
  return {
    rijeci: rijeciZaOdgovor.map((redak) => redak.rijec),
    imaJos,
    sljedeciCursor: imaJos && zadnja ? kodirajCursor({ rijec: zadnja.rijec }) : null,
  };
}

async function dohvatiRijeciPoTieru(
  igracId: string,
  stupac: typeof otkljucaneRijeciIgraca.dugaTier | typeof otkljucaneRijeciIgraca.rijetkaTier,
  tier: number,
): Promise<string[]> {
  const retci = await baza
    .select({ rijec: otkljucaneRijeciIgraca.rijec })
    .from(otkljucaneRijeciIgraca)
    .where(and(eq(otkljucaneRijeciIgraca.igracId, igracId), eq(stupac, tier)))
    .orderBy(asc(otkljucaneRijeciIgraca.rijec))
    .limit(MAKSIMALNO_OTKLJUCANIH_RIJECI_PO_KATEGORIJI);
  return retci.map((redak) => redak.rijec);
}

function javnaStatistika(statistika: Awaited<ReturnType<typeof dohvatiStatistiku>>) {
  if (!statistika) return null;
  return {
    najduziStreak: statistika.najduziStreak,
    otkriveneJakoRijetkeGrupe: statistika.otkriveneJakoRijetkeGrupe,
    otkriveneSrednjeRijetkeGrupe: statistika.otkriveneSrednjeRijetkeGrupe,
    otkriveneRijetkeGrupe: statistika.otkriveneRijetkeGrupe,
    upisaneDugeRijeci: statistika.upisaneDugeRijeci,
    upisaneSrednjeDugeRijeci: statistika.upisaneSrednjeDugeRijeci,
    upisaneJakoDugeRijeci: statistika.upisaneJakoDugeRijeci,
    najduzaRijec: statistika.najduzaRijec,
    najduzaRijecGrafemi: statistika.najduzaRijecGrafemi,
    najrjedaRijec: statistika.najrjedaRijec,
    najrjedaRijecFrekvencija: statistika.najrjedaRijecFrekvencija,
  };
}

function izracunajDnkProfil(
  igrac: {
    odigrane: number;
    odigrane1v1: number;
    bodoviUkupno: number;
    bodovi1v1: number;
    eliminacijeUkupno: number;
    eliminacije1v1: number;
  },
  dnkStatistika: Awaited<ReturnType<typeof dohvatiDnkStatistiku>> | null,
  mod: 'cetiri_igraca' | 'dva_igraca',
) {
  const odigrano = mod === 'dva_igraca' ? igrac.odigrane1v1 : igrac.odigrane;
  const bodovi = mod === 'dva_igraca' ? igrac.bodovi1v1 : igrac.bodoviUkupno;
  const eliminacije = mod === 'dva_igraca' ? igrac.eliminacije1v1 : igrac.eliminacijeUkupno;
  const eliminacijePoPartiji = odigrano > 0 ? eliminacije / odigrano : 0;
  const dnkPodaci = {
    odigrane: odigrano,
    bodovi,
    eliminacije,
    prihvaceniPotezi: dnkStatistika?.prihvaceniPotezi ?? 0,
    ukupnoTrajanjePrihvaceniPoteziMs: dnkStatistika?.ukupnoTrajanjePrihvaceniPoteziMs ?? 0,
    najduziStreak: dnkStatistika?.najduziStreak ?? 0,
    dugeRijeci: dnkStatistika?.dugeRijeci ?? 0,
    srednjeDugeRijeci: dnkStatistika?.srednjeDugeRijeci ?? 0,
    jakoDugeRijeci: dnkStatistika?.jakoDugeRijeci ?? 0,
    rijetkeRijeci: dnkStatistika?.rijetkeRijeci ?? 0,
    srednjeRijetkeRijeci: dnkStatistika?.srednjeRijetkeRijeci ?? 0,
    jakoRijetkeRijeci: dnkStatistika?.jakoRijetkeRijeci ?? 0,
  };
  const profil = { osi: izracunajDnk(dnkPodaci, mod) };
  const prosjekPrihvacenogPotezaMs = dnkPodaci.prihvaceniPotezi > 0
    ? dnkPodaci.ukupnoTrajanjePrihvaceniPoteziMs / dnkPodaci.prihvaceniPotezi
    : 0;

  return {
    ...profil,
    odigrano,
    preostaloDoOtkljucavanja: Math.max(0, 10 - odigrano),
    metrike: {
      eliminacijePoPartiji,
      nizPrihvacenihRijeci: dnkPodaci.najduziStreak,
      prosjekPrihvacenogPotezaMs,
      dugeRijeciPoPartiji: odigrano > 0
        ? (dnkPodaci.dugeRijeci + dnkPodaci.srednjeDugeRijeci + dnkPodaci.jakoDugeRijeci) / odigrano
        : 0,
      rijetkeRijeciPoPartiji: odigrano > 0
        ? (dnkPodaci.rijetkeRijeci + dnkPodaci.srednjeRijetkeRijeci + dnkPodaci.jakoRijetkeRijeci) / odigrano
        : 0,
    },
  };
}

async function dohvatiDostignucaZaIgraca(igracId: string, iskustvoUkupno: number) {
  const [napredak, otkljucana] = await Promise.all([
    baza
      .select()
      .from(napredakDostignucaIgraca)
      .where(eq(napredakDostignucaIgraca.igracId, igracId))
      .limit(1),
    baza.select().from(dostignucaIgraca).where(eq(dostignucaIgraca.igracId, igracId)),
  ]);
  const brojac = napredak[0];
  const razinaIskustva = stanjeIskustva(iskustvoUkupno).razina;
  const razine = new Map(otkljucana.map((redak) => [redak.dostignuceId, redak.razina]));
  const dostignuca = DEFINICIJE_DOSTIGNUCA.map((definicija) => {
    const vrijednost =
      definicija.brojac === 'razina' ? razinaIskustva : Number(brojac?.[definicija.brojac] ?? 0);
    const izracunataRazina = izracunajRazinuDostignuca(definicija, vrijednost);
    const razina = Math.max(razine.get(definicija.id) ?? 0, izracunataRazina);
    return { ...definicija, razina, vrijednost, sljedeciPrag: definicija.pragovi[razina] ?? null };
  });
  return {
    ukupnoZvjezdica: dostignuca.reduce((zbroj, dostignuce) => zbroj + dostignuce.razina, 0),
    ukupnoOtkljucanih: dostignuca.filter((dostignuce) => dostignuce.razina > 0).length,
    maksimalnoZvjezdica: DEFINICIJE_DOSTIGNUCA.reduce(
      (zbroj, definicija) => zbroj + definicija.pragovi.length,
      0,
    ),
    dostignuca,
  };
}

export async function registrirajProfilRute(
  app: FastifyInstance,
  rjecnik: RjecnikUMemoriji,
): Promise<void> {
  const dohvatiKategoriju = (vrijednost: string | undefined): KategorijaRijeci | null =>
    KATEGORIJE_RIJECI.includes(vrijednost as KategorijaRijeci) ? vrijednost as KategorijaRijeci : null;

  app.get<{ Querystring: { kategorija?: string; limit?: string; cursor?: string } }>(
    '/profil/rijeci',
    { preHandler: zahtijevajPrijavu },
    async (zahtjev, odgovor) => {
      const igrac = (zahtjev as ZahtjevSIgracem).igrac!;
      const kategorija = dohvatiKategoriju(zahtjev.query.kategorija);
      if (!kategorija) return odgovor.code(400).send({ ok: false, greska: 'Neispravna kategorija riječi.' });
      const limit = Math.min(Math.max(parseInt(zahtjev.query.limit ?? '50', 10) || 50, 1), MAKSIMALNO_RIJECI_PO_STRANICI);
      const cursor = dekodirajCursor<CursorRijeci>(zahtjev.query.cursor);
      if (zahtjev.query.cursor && !cursor?.rijec) return odgovor.code(400).send({ ok: false, greska: 'Neispravan cursor riječi.' });
      return { ok: true, kategorija, ...(await dohvatiStranicuRijeci(igrac.id, kategorija, limit, cursor)) };
    },
  );

  app.get<{ Params: { igracId: string }; Querystring: { kategorija?: string; limit?: string; cursor?: string } }>(
    '/profil/javni/:igracId/rijeci',
    async (zahtjev, odgovor) => {
      const kategorija = dohvatiKategoriju(zahtjev.query.kategorija);
      if (!kategorija) return odgovor.code(400).send({ ok: false, greska: 'Neispravna kategorija riječi.' });
      const [igrac] = await baza.select({ id: igraci.id }).from(igraci).where(and(
        eq(igraci.id, zahtjev.params.igracId),
        sql`${igraci.vrsta} in ('registriran', 'admin')`,
        isNull(igraci.obrisanAt),
      )).limit(1);
      if (!igrac) return odgovor.code(404).send({ ok: false, greska: 'Profil nije pronađen.' });
      const limit = Math.min(Math.max(parseInt(zahtjev.query.limit ?? '50', 10) || 50, 1), MAKSIMALNO_RIJECI_PO_STRANICI);
      const cursor = dekodirajCursor<CursorRijeci>(zahtjev.query.cursor);
      if (zahtjev.query.cursor && !cursor?.rijec) return odgovor.code(400).send({ ok: false, greska: 'Neispravan cursor riječi.' });
      return { ok: true, kategorija, ...(await dohvatiStranicuRijeci(igrac.id, kategorija, limit, cursor)) };
    },
  );

  app.get('/dostignuca', { preHandler: zahtijevajPrijavu }, async (zahtjev) => {
    const igrac = (zahtjev as ZahtjevSIgracem).igrac!;
    return { ok: true, ...(await dohvatiDostignucaZaIgraca(igrac.id, igrac.iskustvoUkupno)) };
  });

  app.get('/profil', { preHandler: zahtijevajIdentifikaciju }, async (zahtjev) => {
    const igrac = (zahtjev as ZahtjevSIgracem).igrac!;
    const statistikaRijeci = await dohvatiStatistiku(igrac.id, 'cetiri_igraca');
    const [dnkCetiri, dnkDva] = await Promise.all([
      dohvatiDnkStatistiku(igrac.id, 'cetiri_igraca'),
      dohvatiDnkStatistiku(igrac.id, 'dva_igraca'),
    ]);
    const prosjek4p = prosjekBodova(igrac.bodoviUkupno, igrac.odigrane);
    const prosjek1v1 = prosjekBodova(igrac.bodovi1v1, igrac.odigrane1v1);
    const stil = stilIgre(
      igrac.odigrane + igrac.odigrane1v1,
      igrac.eliminacijeUkupno + igrac.eliminacije1v1,
    );
    const dostignuca = await dohvatiDostignucaZaIgraca(igrac.id, igrac.iskustvoUkupno);
    return {
      ok: true,
      igracId: igrac.id,
      nadimak: igrac.nadimak,
      vrsta: igrac.vrsta,
      avatarId: igrac.avatarId,
      avatarConfig: igrac.vrsta === 'gost' ? null : igrac.avatarConfig,
      avatarRevision: igrac.avatarRevision,
      email: igrac.email,
      emailPotvrdjen: igrac.emailPotvrdjen,
      odigrane: igrac.odigrane,
      pobjede: igrac.pobjede,
      eliminacijeUkupno: igrac.eliminacijeUkupno,
      bodoviUkupno: igrac.bodoviUkupno,
      prosjekBodova: prosjek4p,
      rang: izracunajRang(igrac.odigrane, prosjek4p, 'cetiri_igraca'),
      odigrane1v1: igrac.odigrane1v1,
      pobjede1v1: igrac.pobjede1v1,
      eliminacije1v1: igrac.eliminacije1v1,
      bodovi1v1: igrac.bodovi1v1,
      prosjekBodova1v1: prosjek1v1,
      rang1v1: izracunajRang(igrac.odigrane1v1, prosjek1v1, 'dva_igraca'),
      dnk: {
        cetiriIgraca: izracunajDnkProfil(igrac, dnkCetiri, 'cetiri_igraca'),
        dvaIgraca: izracunajDnkProfil(igrac, dnkDva, 'dva_igraca'),
      },
      prosjecnaOcjenaIgre: prosjecnaOcjena(dnkCetiri) ?? prosjecnaOcjena(dnkDva),
      iskustvo: stanjeIskustva(igrac.iskustvoUkupno),
      stilIgre: stil,
      stvoren: igrac.stvoren,
      statistikaRijeci: javnaStatistika(statistikaRijeci),
      ciljeviRijeci: rjecnik.ciljeviRijeci(),
      dostignuca,
    };
  });

  app.get<{ Params: { igracId: string } }>('/profil/javni/:igracId', async (zahtjev, odgovor) => {
    const [igrac] = await baza
      .select()
      .from(igraci)
      .where(
        sql`${igraci.id} = ${zahtjev.params.igracId} and ${igraci.vrsta} in ('registriran', 'admin') and ${igraci.obrisanAt} is null`,
      )
      .limit(1);
    if (!igrac) return odgovor.code(404).send({ ok: false, greska: 'Profil nije pronađen.' });

    const statistikaRijeci = await dohvatiStatistiku(igrac.id, 'cetiri_igraca');
    const [dnkCetiri, dnkDva] = await Promise.all([
      dohvatiDnkStatistiku(igrac.id, 'cetiri_igraca'),
      dohvatiDnkStatistiku(igrac.id, 'dva_igraca'),
    ]);
    const prosjek4p = prosjekBodova(igrac.bodoviUkupno, igrac.odigrane);
    const prosjek1v1 = prosjekBodova(igrac.bodovi1v1, igrac.odigrane1v1);
    const stil = stilIgre(
      igrac.odigrane + igrac.odigrane1v1,
      igrac.eliminacijeUkupno + igrac.eliminacije1v1,
    );
    const dostignuca = await dohvatiDostignucaZaIgraca(igrac.id, igrac.iskustvoUkupno);
    return {
      ok: true,
      igracId: igrac.id,
      nadimak: igrac.nadimak,
      avatarId: igrac.avatarId,
      avatarConfig: igrac.avatarConfig,
      avatarRevision: igrac.avatarRevision,
      odigrane: igrac.odigrane,
      pobjede: igrac.pobjede,
      eliminacijeUkupno: igrac.eliminacijeUkupno,
      bodoviUkupno: igrac.bodoviUkupno,
      prosjekBodova: prosjek4p,
      rang: izracunajRang(igrac.odigrane, prosjek4p, 'cetiri_igraca'),
      odigrane1v1: igrac.odigrane1v1,
      pobjede1v1: igrac.pobjede1v1,
      eliminacije1v1: igrac.eliminacije1v1,
      bodovi1v1: igrac.bodovi1v1,
      prosjekBodova1v1: prosjek1v1,
      rang1v1: izracunajRang(igrac.odigrane1v1, prosjek1v1, 'dva_igraca'),
      dnk: {
        cetiriIgraca: izracunajDnkProfil(igrac, dnkCetiri, 'cetiri_igraca'),
        dvaIgraca: izracunajDnkProfil(igrac, dnkDva, 'dva_igraca'),
      },
      prosjecnaOcjenaIgre: prosjecnaOcjena(dnkCetiri) ?? prosjecnaOcjena(dnkDva),
      iskustvo: stanjeIskustva(igrac.iskustvoUkupno),
      stilIgre: stil,
      statistikaRijeci: javnaStatistika(statistikaRijeci),
      ciljeviRijeci: rjecnik.ciljeviRijeci(),
      dostignuca,
    };
  });

  // Onboarding dopušta i gostima da odaberu avatar (jednokratno, prvi ulazak - dobrodoslica/+page.svelte)
  app.put('/profil/avatar', { preHandler: zahtijevajIdentifikaciju }, async (zahtjev, odgovor) => {
    const igrac = (zahtjev as ZahtjevSIgracem).igrac!;
    const tijelo = zahtjev.body as unknown;
    if (typeof tijelo === 'object' && tijelo !== null && 'avatarConfig' in tijelo) {
      if (igrac.vrsta === 'gost' || !validirajAvatarConfig((tijelo as { avatarConfig?: unknown }).avatarConfig)) {
        return odgovor.code(400).send({ ok: false, greska: 'Neispravna konfiguracija avatara.' });
      }
      const konfiguracija = (tijelo as { avatarConfig: unknown }).avatarConfig;
      const [azurirani] = await baza
        .update(igraci)
        .set({ avatarConfig: konfiguracija, avatarRevision: sql`${igraci.avatarRevision} + 1` })
        .where(eq(igraci.id, igrac.id))
        .returning({ avatarConfig: igraci.avatarConfig, avatarRevision: igraci.avatarRevision });
      return { ok: true, avatarConfig: azurirani?.avatarConfig ?? konfiguracija, avatarRevision: azurirani?.avatarRevision ?? igrac.avatarRevision + 1 };
    }

    const rezultat = ShemaAvatar.safeParse(tijelo);
    if (!rezultat.success) return odgovor.code(400).send({ ok: false, greska: 'Neispravan avatarId.' });
    await baza.update(igraci).set({ avatarId: rezultat.data.avatarId }).where(eq(igraci.id, igrac.id));
    return { ok: true, avatarId: rezultat.data.avatarId };
  });

  app.put('/profil/nadimak', { preHandler: zahtijevajIdentifikaciju }, async (zahtjev, odgovor) => {
    const rezultat = ShemaNadimak.safeParse(zahtjev.body);
    if (!rezultat.success) {
      return odgovor.code(400).send({ ok: false, greska: rezultat.error.issues[0]?.message ?? PORUKA_NEVALJANOG_NADIMKA });
    }
    const igrac = (zahtjev as ZahtjevSIgracem).igrac!;
    await baza
      .update(igraci)
      .set({ nadimak: rezultat.data.nadimak })
      .where(eq(igraci.id, igrac.id));
    return { ok: true, nadimak: rezultat.data.nadimak };
  });

  app.put('/profil/email', { preHandler: zahtijevajPrijavu }, async (zahtjev, odgovor) => {
    const rezultat = ShemaEmail.safeParse(zahtjev.body);
    if (!rezultat.success) {
      return odgovor.code(400).send({ ok: false, greska: 'Neispravni podaci.' });
    }
    const igrac = (zahtjev as ZahtjevSIgracem).igrac!;
    if (!igrac.lozinkaHash || !(await argonVerify(igrac.lozinkaHash, rezultat.data.lozinka))) {
      return odgovor.code(401).send({ ok: false, greska: 'Pogre\u0161na lozinka.' });
    }
    const normaliziraniEmail = normalizirajEmail(rezultat.data.noviEmail);
    const [postojeci] = await baza
      .select()
      .from(igraci)
      .where(sql`lower(${igraci.email}) = ${normaliziraniEmail}`)
      .limit(1);
    if (postojeci && postojeci.id !== igrac.id) {
      return odgovor
        .code(409)
        .send({ ok: false, greska: 'Ta email adresa je ve\u0107 registrirana.' });
    }
    await baza
      .update(igraci)
      .set({ email: normaliziraniEmail, emailPotvrdjen: false })
      .where(eq(igraci.id, igrac.id));
    const tokenPotvrde = izdajTokenPotvrdeEmaila(igrac.id);
    const poveznica = new URL(
      `/potvrda-emaila?token=${tokenPotvrde}`,
      konfiguracija.JAVNA_ADRESA,
    ).toString();
    await posaljiEmail(app.log, normaliziraniEmail, porukaPotvrdeEmaila(poveznica, true));
    return { ok: true };
  });

  app.put('/profil/lozinka', { preHandler: zahtijevajPrijavu }, async (zahtjev, odgovor) => {
    const rezultat = ShemaLozinka.safeParse(zahtjev.body);
    if (!rezultat.success) {
      return odgovor.code(400).send({ ok: false, greska: 'Neispravni podaci.' });
    }
    const igrac = (zahtjev as ZahtjevSIgracem).igrac!;
    if (
      !igrac.lozinkaHash ||
      !(await argonVerify(igrac.lozinkaHash, rezultat.data.trenutnaLozinka))
    ) {
      return odgovor.code(401).send({ ok: false, greska: 'Pogre\u0161na trenutna lozinka.' });
    }
    const lozinkaHash = await argonHash(rezultat.data.novaLozinka);
    await baza.update(igraci).set({ lozinkaHash }).where(eq(igraci.id, igrac.id));
    return { ok: true };
  });

  app.get<{ Querystring: { limit?: string; mod?: string } }>(
    '/ljestvica',
    { preHandler: pokusajIdentifikaciju },
    async (zahtjev) => {
      const rezultatLimita = ShemaLimit.safeParse(zahtjev.query);
      const limit = rezultatLimita.success ? (rezultatLimita.data.limit ?? 10) : 10;
      const je1v1 = zahtjev.query.mod === 'dva_igraca' || zahtjev.query.mod === '1v1';

      const colOdigrane = je1v1 ? igraci.odigrane1v1 : igraci.odigrane;
      const colBodovi = je1v1 ? igraci.bodovi1v1 : igraci.bodoviUkupno;

      const kandidati = await baza
        .select()
        .from(igraci)
        .where(and(gte(colOdigrane, 10), isNull(igraci.obrisanAt)))
        .orderBy(desc(sql`${colBodovi}::float / ${colOdigrane}`))
        .limit(limit);

      const ljestvica = kandidati.map((igrac, indeks) => {
        const odig = je1v1 ? igrac.odigrane1v1 : igrac.odigrane;
        const bod = je1v1 ? igrac.bodovi1v1 : igrac.bodoviUkupno;
        const pobj = je1v1 ? igrac.pobjede1v1 : igrac.pobjede;
        const prosjek = prosjekBodova(bod, odig);

        return {
          mjesto: indeks + 1,
          igracId: igrac.id,
          jeJavan: igrac.vrsta !== 'gost',
          nadimak: igrac.nadimak,
          rang: izracunajRang(odig, prosjek, je1v1 ? 'dva_igraca' : 'cetiri_igraca'),
          prosjekBodova: prosjek,
          odigrane: odig,
          postotakPobjeda: odig > 0 ? (pobj / odig) * 100 : 0,
        };
      });

      let mojeMjesto: (typeof ljestvica)[number] | null = null;
      const igrac = (zahtjev as ZahtjevSIgracem).igrac;
      if (igrac) {
        const odigMoj = je1v1 ? igrac.odigrane1v1 : igrac.odigrane;
        const bodMoj = je1v1 ? igrac.bodovi1v1 : igrac.bodoviUkupno;
        const pobjMoj = je1v1 ? igrac.pobjede1v1 : igrac.pobjede;

        if (odigMoj >= 10) {
          const prosjekMoj = prosjekBodova(bodMoj, odigMoj);
          const [redakBoljih] = await baza
            .select({ boljihOdMene: sql<number>`count(*)::int` })
            .from(igraci)
            .where(
              sql`${colOdigrane} >= 10 and ${colBodovi}::float / ${colOdigrane} > ${prosjekMoj}`,
            );
          mojeMjesto = {
            mjesto: (redakBoljih?.boljihOdMene ?? 0) + 1,
            igracId: igrac.id,
            jeJavan: igrac.vrsta !== 'gost',
            nadimak: igrac.nadimak,
            rang: izracunajRang(odigMoj, prosjekMoj, je1v1 ? 'dva_igraca' : 'cetiri_igraca'),
            prosjekBodova: prosjekMoj,
            odigrane: odigMoj,
            postotakPobjeda: (pobjMoj / odigMoj) * 100,
          };
        }
      }

      return { ok: true, ljestvica, mojeMjesto };
    },
  );

  app.get<{ Querystring: { limit?: string } }>('/rijeci/top', async (zahtjev) => {
    const rezultatLimita = ShemaLimit.safeParse(zahtjev.query);
    const limit = rezultatLimita.success ? (rezultatLimita.data.limit ?? 10) : 10;
    const { retci, ukupnoPartija } = await dohvatiTopRijeci();

    return {
      ok: true,
      rijeci: retci.map((redak, indeks) => ({
        mjesto: indeks + 1,
        rijec: redak.rijec,
        brojUpotreba: redak.brojUpotreba,
        postotakPartija: ukupnoPartija > 0 ? (redak.brojPartija / ukupnoPartija) * 100 : 0,
      })),
    };
  });

  app.get<{ Params: { igracId: string }; Querystring: { limit?: string; cursor?: string } }>(
    '/povijest/:igracId',
    async (zahtjev, odgovor) => {
      const limit = Math.min(Math.max(parseInt(zahtjev.query.limit ?? '20', 10) || 20, 1), MAKSIMALNO_PARTIJA_PO_STRANICI);
      const cursor = dekodirajCursor<CursorPovijestiPartija>(zahtjev.query.cursor);
      if (zahtjev.query.cursor && (!cursor?.pocetak || !cursor.partijaId || Number.isNaN(Date.parse(cursor.pocetak)))) {
        return odgovor.code(400).send({ ok: false, greska: 'Neispravan cursor povijesti.' });
      }

      const uvjetIgraca = eq(sudioniciPartije.igracId, zahtjev.params.igracId);
      const uvjetCursora = cursor
        ? sql`(${partije.pocetak} < ${new Date(cursor.pocetak)} OR (${partije.pocetak} = ${new Date(cursor.pocetak)} AND ${sudioniciPartije.partijaId} < ${cursor.partijaId}))`
        : undefined;

      const retci = await baza
        .select({
          partijaId: sudioniciPartije.partijaId,
          plasman: sudioniciPartije.plasman,
          bodovi: sudioniciPartije.bodovi,
          eliminacije: sudioniciPartije.eliminacije,
          nacinIspadanja: sudioniciPartije.nacinIspadanja,
          pocetak: partije.pocetak,
          kraj: partije.kraj,
        })
        .from(sudioniciPartije)
        .innerJoin(partije, eq(partije.id, sudioniciPartije.partijaId))
        .where(uvjetCursora ? and(uvjetIgraca, uvjetCursora) : uvjetIgraca)
        .orderBy(desc(partije.pocetak), desc(sudioniciPartije.partijaId))
        .limit(limit + 1);

      const imaJos = retci.length > limit;
      const partijeZaOdgovor = imaJos ? retci.slice(0, limit) : retci;
      const zadnja = partijeZaOdgovor.at(-1);

      return {
        ok: true,
        partije: partijeZaOdgovor,
        imaJos,
        sljedeciCursor: imaJos && zadnja ? kodirajCursor({ pocetak: new Date(zadnja.pocetak).toISOString(), partijaId: zadnja.partijaId }) : null,
      };
    },
  );

  app.get<{ Params: { partijaId: string }; Querystring: { limit?: string; cursor?: string } }>(
    '/partije/:partijaId/potezi',
    async (zahtjev, odgovor) => {
      const limit = Math.min(Math.max(parseInt(zahtjev.query.limit ?? '100', 10) || 100, 1), MAKSIMALNO_POTEZA_PO_STRANICI);
      const cursor = dekodirajCursor<{ redniBroj: number; id: number }>(zahtjev.query.cursor);
      if (zahtjev.query.cursor && (!cursor || !Number.isInteger(cursor.redniBroj) || !Number.isSafeInteger(cursor.id))) {
        return odgovor.code(400).send({ ok: false, greska: 'Neispravan cursor poteza.' });
      }
      const osnovniUvjet = eq(potezi.partijaId, zahtjev.params.partijaId);
      const uvjetCursora = cursor
        ? sql`(${potezi.redniBroj} > ${cursor.redniBroj} OR (${potezi.redniBroj} = ${cursor.redniBroj} AND ${potezi.id} > ${cursor.id}))`
        : undefined;

      const retci = await baza
        .select()
        .from(potezi)
        .where(uvjetCursora ? and(osnovniUvjet, uvjetCursora) : osnovniUvjet)
        .orderBy(asc(potezi.redniBroj), asc(potezi.id))
        .limit(limit + 1);
      const imaJos = retci.length > limit;
      const poteziZaOdgovor = imaJos ? retci.slice(0, limit) : retci;
      const zadnji = poteziZaOdgovor.at(-1);

      return {
        ok: true,
        potezi: poteziZaOdgovor,
        limit,
        imaJos,
        sljedeciCursor: imaJos && zadnji ? kodirajCursor({ redniBroj: zadnji.redniBroj, id: zadnji.id }) : null,
      };
    },
  );
}
