/**
 * Fastify rute za profil, ljestvicu i povijest partija (javno čitljivi agregati).
 */
import type { FastifyInstance } from 'fastify';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { and, asc, desc, eq, gte, isNull, notExists, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  DEFINICIJE_DOSTIGNUCA,
  validirajAvatarConfig,
  izracunajRang,
  izracunajRazinuDostignuca,
  jeDostignuceNovo,
  kolekcijskiKljucGrupe,
  osnovnaRijecIzGrupe,
  stanjeIskustva,
  bonusPobjednickogNiza,
  BROJ_PARTIJA_ZA_KALIBRACIJU,
  izracunajFormu,
  jeDnkOtkljucan,
  razinaVatre,
  sastaviKaladontCv,
  datumZagrebacki,
  type DnkProfil,
  type CvDnkStatistika,
  type CvPodaciIgraca,
} from 'zajednicko';
import { baza } from '../baza/klijent.js';
import {
  dostignucaIgraca,
  dnkStatistikeIgraca,
  igraci,
  napredakDostignucaIgraca,
  obracuniPartija,
  otkljucaneGrupeIgraca,
  otkljucaneRijeciIgraca,
  partije,
  potezi,
  nizoviPobjedaIgraca,
  rezultatiFormeIgraca,
  statistikeRijeciIgraca,
  sudioniciPartije,
} from '../baza/shema.js';
import { BROJ_AVATARA } from '../identitet/identitet.js';
import type { RjecnikUMemoriji } from '../rjecnik/ucitaj.js';
import { porukaPotvrdeEmaila, pokusajPoslatiEmail } from '../email.js';
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

const MAKSIMALNO_POTEZA_PO_STRANICI = 500;
const ZIVOTNI_VIJEK_TOP_RIJECI_MS = 30_000;
const MAKSIMALNO_PARTIJA_PO_STRANICI = 20;
const MAKSIMALNO_RIJECI_PO_STRANICI = 50;
const PRAGOVI_KOLEKCIONARSKE_RAZINE = [
  { prag: 0, naziv: 'Početnik' },
  { prag: 10, naziv: 'Prvi koraci' },
  { prag: 25, naziv: 'Sakupljač' },
  { prag: 50, naziv: 'Tragač' },
  { prag: 100, naziv: 'Poznavatelj' },
  { prag: 250, naziv: 'Lovac na riječi' },
  { prag: 500, naziv: 'Kolekcionar' },
  { prag: 1_000, naziv: 'Veliki kolekcionar' },
  { prag: 2_500, naziv: 'Majstor riječi' },
  { prag: 10_000, naziv: 'Legenda rječnika' },
] as const;

type TopRijeciCache = {
  stvoreno: number;
  ukupnoPartija: number;
  retci: { rijec: string | null; brojUpotreba: number; brojPartija: number }[];
};

let topRijeciCache: TopRijeciCache | null = null;

type CursorPovijestiPartija = { kraj: string; partijaId: string };
type CursorRijeci = { rijec: string };
const KATEGORIJE_RIJECI = ['duge', 'srednjeDuge', 'jakoDuge', 'rijetke', 'srednjeRijetke', 'jakoRijetke'] as const;
type KategorijaRijeci = (typeof KATEGORIJE_RIJECI)[number];
const KATEGORIJE_KOLEKCIJE = ['osnovne', 'vlastita_imena', 'duge', 'srednjeDuge', 'jakoDuge', 'rijetke', 'srednjeRijetke', 'jakoRijetke', ...['imenica', 'glagol', 'pridjev_prilog', 'zamjenica', 'broj', 'prijedlog', 'veznik', 'cestica', 'uzvik']] as const;
type KategorijaKolekcije = (typeof KATEGORIJE_KOLEKCIJE)[number];

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

async function dohvatiFormu(igracId: string, mod: 'cetiri_igraca' | 'dva_igraca') {
  const rezultati = await baza.select({
    partijaId: rezultatiFormeIgraca.partijaId,
    kraj: rezultatiFormeIgraca.zavrseno,
    plasman: rezultatiFormeIgraca.plasman,
    bodovi: rezultatiFormeIgraca.bodovi,
    eliminacije: rezultatiFormeIgraca.eliminacije,
  }).from(rezultatiFormeIgraca).where(and(
    eq(rezultatiFormeIgraca.igracId, igracId),
    eq(rezultatiFormeIgraca.mod, mod),
  )).orderBy(desc(rezultatiFormeIgraca.zavrseno), desc(rezultatiFormeIgraca.partijaId)).limit(20);
  const rezultatiZaFormu = rezultati.map((rezultat) => ({ ...rezultat, kraj: rezultat.kraj.toISOString() }));
  const forma = izracunajFormu(rezultatiZaFormu, mod);
  const [niz] = await baza.select({
    trenutniNiz: nizoviPobjedaIgraca.trenutniNiz,
    najboljiNiz: nizoviPobjedaIgraca.najboljiNiz,
  }).from(nizoviPobjedaIgraca).where(and(
    eq(nizoviPobjedaIgraca.igracId, igracId),
    eq(nizoviPobjedaIgraca.mod, mod),
  )).limit(1);
  const trenutniNiz = niz?.trenutniNiz ?? 0;
  return {
    ...forma,
    trenutniNiz,
    najboljiNiz: niz?.najboljiNiz ?? 0,
    razinaVatre: razinaVatre(trenutniNiz, mod),
    sljedeciBonusPostotak: bonusPobjednickogNiza(trenutniNiz + 1, mod),
  };
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

async function dohvatiStranicuKolekcije(igracId: string, kategorija: KategorijaKolekcije, limit: number, cursor: CursorRijeci | null) {
  if (KATEGORIJE_RIJECI.includes(kategorija as KategorijaRijeci)) {
    return dohvatiStranicuRijeci(igracId, kategorija as KategorijaRijeci, limit, cursor);
  }
  if (kategorija !== 'osnovne' && kategorija !== 'vlastita_imena' && !['imenica', 'glagol', 'pridjev_prilog', 'zamjenica', 'broj', 'prijedlog', 'veznik', 'cestica', 'uzvik'].includes(kategorija)) {
    return { rijeci: [], imaJos: false, sljedeciCursor: null };
  }
  if (kategorija === 'osnovne' || kategorija === 'vlastita_imena' || kategorija === 'imenica' || kategorija === 'glagol' || kategorija === 'pridjev_prilog' || kategorija === 'zamjenica' || kategorija === 'broj' || kategorija === 'prijedlog' || kategorija === 'veznik' || kategorija === 'cestica' || kategorija === 'uzvik') {
    const retci = await baza.select({ grupa: otkljucaneGrupeIgraca.grupa }).from(otkljucaneGrupeIgraca).where(eq(otkljucaneGrupeIgraca.igracId, igracId));
    const rijeci = [...new Map(retci
      .map((redak) => ({ grupa: kolekcijskiKljucGrupe(redak.grupa), osnovnaRijec: osnovnaRijecIzGrupe(redak.grupa) }))
      .filter((redak) => kategorija === 'osnovne' || (kategorija === 'vlastita_imena' ? redak.grupa.startsWith('vlastito_ime:') : kategorija === 'pridjev_prilog' ? redak.grupa.startsWith('pridjev:') || redak.grupa.startsWith('prilog:') : redak.grupa.startsWith(`${kategorija}:`)))
      .map((redak) => [redak.grupa, redak.osnovnaRijec] as const))]
      .sort((a, b) => a[1].localeCompare(b[1], 'hr'))
      .filter(([, rijec]) => !cursor || rijec > cursor.rijec);
    const stranica = rijeci.slice(0, limit + 1);
    const imaJos = stranica.length > limit;
    const prikazane = imaJos ? stranica.slice(0, limit) : stranica;
    return { rijeci: prikazane.map(([, rijec]) => rijec), imaJos, sljedeciCursor: imaJos && prikazane.at(-1) ? kodirajCursor({ rijec: prikazane.at(-1)![1] }) : null };
  }
  return { rijeci: [], imaJos: false, sljedeciCursor: null };
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

function kolekcionarskaRazina(otkljucano: number, ukupno: number) {
  let trenutna: (typeof PRAGOVI_KOLEKCIONARSKE_RAZINE)[number] = PRAGOVI_KOLEKCIONARSKE_RAZINE[0]!;
  for (const prag of PRAGOVI_KOLEKCIONARSKE_RAZINE) {
    if (otkljucano >= prag.prag) trenutna = prag;
  }
  const sljedeci = PRAGOVI_KOLEKCIONARSKE_RAZINE.find((prag) => prag.prag > otkljucano) ?? null;
  return {
    naziv: trenutna.naziv,
    prag: trenutna.prag,
    sljedeciNaziv: sljedeci?.naziv ?? null,
    sljedeciPrag: sljedeci?.prag ?? null,
    doSljedece: sljedeci ? sljedeci.prag - otkljucano : null,
    ukupno,
  };
}

async function dohvatiKolekciju(igracId: string, rjecnik: RjecnikUMemoriji) {
  const [grupe, oblici] = await Promise.all([
    baza.select({ grupa: otkljucaneGrupeIgraca.grupa }).from(otkljucaneGrupeIgraca).where(eq(otkljucaneGrupeIgraca.igracId, igracId)),
    baza.select({ rijec: otkljucaneRijeciIgraca.rijec, dugaTier: otkljucaneRijeciIgraca.dugaTier, rijetkaTier: otkljucaneRijeciIgraca.rijetkaTier }).from(otkljucaneRijeciIgraca).where(eq(otkljucaneRijeciIgraca.igracId, igracId)),
  ]);
  const kolekcijske = new Map<string, { osnovnaRijec: string; vrste: Set<string> }>();
  for (const redak of grupe) {
    const kljuc = kolekcijskiKljucGrupe(redak.grupa);
    const vrsta = kljuc.split(':')[0] ?? 'ostalo';
    const postojeca = kolekcijske.get(kljuc) ?? { osnovnaRijec: osnovnaRijecIzGrupe(redak.grupa), vrste: new Set<string>() };
    postojeca.vrste.add(vrsta);
    kolekcijske.set(kljuc, postojeca);
  }
  const poVrsti = new Map<string, number>();
  for (const redak of kolekcijske.values()) for (const vrsta of redak.vrste) poVrsti.set(vrsta, (poVrsti.get(vrsta) ?? 0) + 1);
  const obliciDugiPoTieru = [0, 0, 0];
  const obliciRijetkiPoTieru = [0, 0, 0];
  for (const redak of oblici) {
    if (redak.dugaTier !== null) obliciDugiPoTieru[redak.dugaTier] = (obliciDugiPoTieru[redak.dugaTier] ?? 0) + 1;
    if (redak.rijetkaTier !== null) obliciRijetkiPoTieru[redak.rijetkaTier] = (obliciRijetkiPoTieru[redak.rijetkaTier] ?? 0) + 1;
  }
  const obliciDugi = obliciDugiPoTieru.reduce((zbroj, broj) => zbroj + broj, 0);
  const obliciRijetki = obliciRijetkiPoTieru.reduce((zbroj, broj) => zbroj + broj, 0);
  const ukupno = kolekcijske.size;
  return {
    ukupnoOtkljucano: ukupno,
    ukupnoDostupno: rjecnik.brojKolekcijskihGrupa(),
    kolekcionarskaRazina: kolekcionarskaRazina(ukupno, rjecnik.brojKolekcijskihGrupa()),
    posebneKategorije: {
      duge: { otkljucano: obliciDugi, ukupno: rjecnik.brojDugihOblika(), otkljucanoPoTieru: obliciDugiPoTieru, ukupnoPoTieru: rjecnik.brojDugihOblikaPoTieru() },
      rijetke: { otkljucano: obliciRijetki, ukupno: rjecnik.brojRijetkihOblika(), otkljucanoPoTieru: obliciRijetkiPoTieru, ukupnoPoTieru: rjecnik.brojRijetkihOblikaPoTieru() },
      vlastitaImena: { otkljucano: poVrsti.get('vlastito_ime') ?? 0, ukupno: rjecnik.brojKolekcijskihGrupaPoVrsti().get('vlastito_ime') ?? 0 },
    },
    kategorije: [...rjecnik.brojKolekcijskihGrupaPoVrsti()]
      .filter(([vrsta]) => vrsta !== 'vlastito_ime')
      .filter(([vrsta]) => vrsta !== 'pridjev' && vrsta !== 'prilog')
      .map(([vrsta, broj]) => ({ vrsta: vrsta as string, otkljucano: poVrsti.get(vrsta) ?? 0, ukupno: broj }))
      .concat([{
        vrsta: 'pridjev_prilog',
        otkljucano: (poVrsti.get('pridjev') ?? 0) + (poVrsti.get('prilog') ?? 0),
        ukupno: rjecnik.brojKolekcijskihGrupaZaVrste(['pridjev', 'prilog']),
      }, {
        vrsta: 'vlastita_imena',
        otkljucano: poVrsti.get('vlastito_ime') ?? 0,
        ukupno: rjecnik.brojKolekcijskihGrupaPoVrsti().get('vlastito_ime') ?? 0,
      }]).sort((prva, druga) => druga.ukupno - prva.ukupno),
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
): DnkProfil & { metrike: {
  eliminacijePoPartiji: number;
  nizPrihvacenihRijeci: number;
  prosjekPrihvacenogPotezaMs: number;
  dugeRijeciPoPartiji: number;
  rijetkeRijeciPoPartiji: number;
} } {
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
  const profil: DnkProfil = {
    mod,
    otkljucan: jeDnkOtkljucan(odigrano),
    odigrano,
    preostaloDoOtkljucavanja: Math.max(0, BROJ_PARTIJA_ZA_KALIBRACIJU - odigrano),
    osi: izracunajDnk(dnkPodaci, mod),
  };
  const prosjekPrihvacenogPotezaMs = dnkPodaci.prihvaceniPotezi > 0
    ? dnkPodaci.ukupnoTrajanjePrihvaceniPoteziMs / dnkPodaci.prihvaceniPotezi
    : 0;

  return {
    ...profil,
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
    const zapis = otkljucana.find((redak) => redak.dostignuceId === definicija.id);
    return {
      ...definicija,
      razina,
      vrijednost,
      sljedeciPrag: definicija.pragovi[razina] ?? null,
      novo: razina > 0 && jeDostignuceNovo(zapis?.zadnjeOtkljucavanje ?? null),
    };
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

function cvDnkStatistika(
  statistika: Awaited<ReturnType<typeof dohvatiDnkStatistiku>> | null,
  profil: DnkProfil & { metrike: { eliminacijePoPartiji: number; nizPrihvacenihRijeci: number; prosjekPrihvacenogPotezaMs: number; dugeRijeciPoPartiji: number; rijetkeRijeciPoPartiji: number } },
): CvDnkStatistika | null {
  if (!statistika) return null;
  return {
    prihvaceniPotezi: statistika.prihvaceniPotezi,
    ukupnoTrajanjePrihvaceniPoteziMs: statistika.ukupnoTrajanjePrihvaceniPoteziMs,
    najduziStreak: statistika.najduziStreak,
    dugeRijeci: statistika.dugeRijeci,
    srednjeDugeRijeci: statistika.srednjeDugeRijeci,
    jakoDugeRijeci: statistika.jakoDugeRijeci,
    rijetkeRijeci: statistika.rijetkeRijeci,
    srednjeRijetkeRijeci: statistika.srednjeRijetkeRijeci,
    jakoRijetkeRijeci: statistika.jakoRijetkeRijeci,
    osi: profil.osi.map((os) => ({ kljuc: os.kljuc, vrijednost: os.vrijednost })),
  };
}

function cvModPodaci(
  igrac: typeof igraci.$inferSelect,
  mod: 'cetiri_igraca' | 'dva_igraca',
  dnkStatistika: Awaited<ReturnType<typeof dohvatiDnkStatistiku>> | null,
  profilDnk: DnkProfil & { metrike: { eliminacijePoPartiji: number; nizPrihvacenihRijeci: number; prosjekPrihvacenogPotezaMs: number; dugeRijeciPoPartiji: number; rijetkeRijeciPoPartiji: number } },
  statistikaRijeci: Awaited<ReturnType<typeof dohvatiStatistiku>> | null,
) {
  const jeDvoboj = mod === 'dva_igraca';
  return {
    odigrane: jeDvoboj ? igrac.odigrane1v1 : igrac.odigrane,
    pobjede: jeDvoboj ? igrac.pobjede1v1 : igrac.pobjede,
    bodoviUkupno: jeDvoboj ? igrac.bodovi1v1 : igrac.bodoviUkupno,
    eliminacijeUkupno: jeDvoboj ? igrac.eliminacije1v1 : igrac.eliminacijeUkupno,
    dnk: cvDnkStatistika(dnkStatistika, profilDnk),
    statistikaRijeci: statistikaRijeci
      ? {
        najduzaRijec: statistikaRijeci.najduzaRijec,
        najduzaRijecGrafemi: statistikaRijeci.najduzaRijecGrafemi,
        najrjedaRijec: statistikaRijeci.najrjedaRijec,
      }
      : null,
  };
}

function sastaviCvZaRegistriranog(
  igrac: typeof igraci.$inferSelect,
  dnkCetiri: Awaited<ReturnType<typeof dohvatiDnkStatistiku>> | null,
  dnkDva: Awaited<ReturnType<typeof dohvatiDnkStatistiku>> | null,
  profilDnkCetiri: DnkProfil & { metrike: { eliminacijePoPartiji: number; nizPrihvacenihRijeci: number; prosjekPrihvacenogPotezaMs: number; dugeRijeciPoPartiji: number; rijetkeRijeciPoPartiji: number } },
  profilDnkDva: DnkProfil & { metrike: { eliminacijePoPartiji: number; nizPrihvacenihRijeci: number; prosjekPrihvacenogPotezaMs: number; dugeRijeciPoPartiji: number; rijetkeRijeciPoPartiji: number } },
  statistikaCetiri: Awaited<ReturnType<typeof dohvatiStatistiku>> | null,
  statistikaDva: Awaited<ReturnType<typeof dohvatiStatistiku>> | null,
  dostignuca: Awaited<ReturnType<typeof dohvatiDostignucaZaIgraca>>,
): CvPodaciIgraca {
  const referentniDatum = datumZagrebacki(new Date());
  if (!referentniDatum) throw new Error('Nije moguće odrediti zagrebački datum.');
  return {
    igracId: igrac.id,
    nadimak: igrac.nadimak,
    iskustvoUkupno: igrac.iskustvoUkupno,
    stvoren: igrac.stvoren,
    registriranAt: igrac.registriranAt,
    referentniDatum,
    dvaIgraca: cvModPodaci(igrac, 'dva_igraca', dnkDva, profilDnkDva, statistikaDva),
    cetiriIgraca: cvModPodaci(igrac, 'cetiri_igraca', dnkCetiri, profilDnkCetiri, statistikaCetiri),
    dostignuca: dostignuca.dostignuca.map(({ id, razina }) => ({ id, razina })),
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

  app.get('/profil/kolekcija', { preHandler: zahtijevajIdentifikaciju }, async (zahtjev) => {
    const igrac = (zahtjev as ZahtjevSIgracem).igrac!;
    return { ok: true, ...(await dohvatiKolekciju(igrac.id, rjecnik)) };
  });

  app.get<{ Params: { igracId: string } }>('/profil/javni/:igracId/kolekcija', async (zahtjev, odgovor) => {
    const [igrac] = await baza.select({ id: igraci.id }).from(igraci).where(and(
      eq(igraci.id, zahtjev.params.igracId),
      sql`${igraci.vrsta} in ('registriran', 'admin')`,
      isNull(igraci.obrisanAt),
    )).limit(1);
    if (!igrac) return odgovor.code(404).send({ ok: false, greska: 'Profil nije pronađen.' });
    return { ok: true, ...(await dohvatiKolekciju(igrac.id, rjecnik)) };
  });

  const registrirajKolekcijaRijeciRutu = (putanja: '/profil/kolekcija/rijeci' | '/profil/javni/:igracId/kolekcija/rijeci') => {
    app.get<{ Params: { igracId?: string }; Querystring: { kategorija?: string; limit?: string; cursor?: string } }>(putanja, putanja === '/profil/kolekcija/rijeci' ? { preHandler: zahtijevajIdentifikaciju } : {}, async (zahtjev, odgovor) => {
      const igracId = zahtjev.params.igracId ?? (zahtjev as ZahtjevSIgracem).igrac?.id;
      const kategorija = KATEGORIJE_KOLEKCIJE.includes(zahtjev.query.kategorija as KategorijaKolekcije) ? zahtjev.query.kategorija as KategorijaKolekcije : null;
      if (!igracId || !kategorija) return odgovor.code(400).send({ ok: false, greska: 'Neispravna kategorija kolekcije.' });
      const limit = Math.min(Math.max(parseInt(zahtjev.query.limit ?? '20', 10) || 20, 1), 50);
      const cursor = dekodirajCursor<CursorRijeci>(zahtjev.query.cursor);
      if (zahtjev.query.cursor && !cursor?.rijec) return odgovor.code(400).send({ ok: false, greska: 'Neispravan cursor kolekcije.' });
      return { ok: true, kategorija, ...(await dohvatiStranicuKolekcije(igracId, kategorija, limit, cursor)) };
    });
  };
  registrirajKolekcijaRijeciRutu('/profil/kolekcija/rijeci');
  registrirajKolekcijaRijeciRutu('/profil/javni/:igracId/kolekcija/rijeci');

  app.get('/profil', { preHandler: zahtijevajIdentifikaciju }, async (zahtjev) => {
    const igrac = (zahtjev as ZahtjevSIgracem).igrac!;
    const [statistikaCetiri, statistikaDva] = await Promise.all([
      dohvatiStatistiku(igrac.id, 'cetiri_igraca'),
      dohvatiStatistiku(igrac.id, 'dva_igraca'),
    ]);
    const [dnkCetiri, dnkDva] = await Promise.all([
      dohvatiDnkStatistiku(igrac.id, 'cetiri_igraca'),
      dohvatiDnkStatistiku(igrac.id, 'dva_igraca'),
    ]);
    const [formaCetiri, formaDva] = await Promise.all([
      dohvatiFormu(igrac.id, 'cetiri_igraca'),
      dohvatiFormu(igrac.id, 'dva_igraca'),
    ]);
    const prosjek4p = prosjekBodova(igrac.bodoviUkupno, igrac.odigrane);
    const prosjek1v1 = prosjekBodova(igrac.bodovi1v1, igrac.odigrane1v1);
    const stil = stilIgre(
      igrac.odigrane + igrac.odigrane1v1,
      igrac.eliminacijeUkupno + igrac.eliminacije1v1,
    );
    const dostignuca = await dohvatiDostignucaZaIgraca(igrac.id, igrac.iskustvoUkupno);
    const profilDnkCetiri = izracunajDnkProfil(igrac, dnkCetiri, 'cetiri_igraca');
    const profilDnkDva = izracunajDnkProfil(igrac, dnkDva, 'dva_igraca');
    const kaladontCv = igrac.vrsta === 'gost'
      ? null
      : sastaviKaladontCv(sastaviCvZaRegistriranog(
        igrac,
        dnkCetiri,
        dnkDva,
        profilDnkCetiri,
        profilDnkDva,
        statistikaCetiri,
        statistikaDva,
        dostignuca,
      ));
    return {
      ok: true,
      igracId: igrac.id,
      nadimak: igrac.nadimak,
      vrsta: igrac.vrsta,
      avatarId: igrac.avatarId,
      avatarConfig: igrac.vrsta === 'gost' ? null : igrac.avatarConfig,
      avatarRevision: igrac.avatarRevision,
      email: igrac.email,
      emailNaCekanju: igrac.emailNaCekanju,
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
        cetiriIgraca: profilDnkCetiri,
        dvaIgraca: profilDnkDva,
      },
      forma: { cetiriIgraca: formaCetiri, dvaIgraca: formaDva },
      prosjecnaOcjenaIgre: prosjecnaOcjena(dnkCetiri) ?? prosjecnaOcjena(dnkDva),
      iskustvo: stanjeIskustva(igrac.iskustvoUkupno),
      stilIgre: stil,
      stvoren: igrac.stvoren,
      statistikaRijeci: javnaStatistika(statistikaCetiri),
      ciljeviRijeci: rjecnik.ciljeviRijeci(),
      dostignuca,
      kaladontCv,
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

    const [statistikaCetiri, statistikaDva] = await Promise.all([
      dohvatiStatistiku(igrac.id, 'cetiri_igraca'),
      dohvatiStatistiku(igrac.id, 'dva_igraca'),
    ]);
    const [dnkCetiri, dnkDva] = await Promise.all([
      dohvatiDnkStatistiku(igrac.id, 'cetiri_igraca'),
      dohvatiDnkStatistiku(igrac.id, 'dva_igraca'),
    ]);
    const [formaCetiri, formaDva] = await Promise.all([
      dohvatiFormu(igrac.id, 'cetiri_igraca'),
      dohvatiFormu(igrac.id, 'dva_igraca'),
    ]);
    const prosjek4p = prosjekBodova(igrac.bodoviUkupno, igrac.odigrane);
    const prosjek1v1 = prosjekBodova(igrac.bodovi1v1, igrac.odigrane1v1);
    const stil = stilIgre(
      igrac.odigrane + igrac.odigrane1v1,
      igrac.eliminacijeUkupno + igrac.eliminacije1v1,
    );
    const dostignuca = await dohvatiDostignucaZaIgraca(igrac.id, igrac.iskustvoUkupno);
    const profilDnkCetiri = izracunajDnkProfil(igrac, dnkCetiri, 'cetiri_igraca');
    const profilDnkDva = izracunajDnkProfil(igrac, dnkDva, 'dva_igraca');
    const kaladontCv = sastaviKaladontCv(sastaviCvZaRegistriranog(
      igrac,
      dnkCetiri,
      dnkDva,
      profilDnkCetiri,
      profilDnkDva,
      statistikaCetiri,
      statistikaDva,
      dostignuca,
    ));
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
        cetiriIgraca: profilDnkCetiri,
        dvaIgraca: profilDnkDva,
      },
      forma: { cetiriIgraca: formaCetiri, dvaIgraca: formaDva },
      prosjecnaOcjenaIgre: prosjecnaOcjena(dnkCetiri) ?? prosjecnaOcjena(dnkDva),
      iskustvo: stanjeIskustva(igrac.iskustvoUkupno),
      stilIgre: stil,
      statistikaRijeci: javnaStatistika(statistikaCetiri),
      ciljeviRijeci: rjecnik.ciljeviRijeci(),
      dostignuca,
      kaladontCv,
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
      .where(sql`lower(${igraci.email}) = ${normaliziraniEmail} or lower(${igraci.emailNaCekanju}) = ${normaliziraniEmail}`)
      .limit(1);
    if (postojeci && postojeci.id !== igrac.id) {
      return odgovor
        .code(409)
        .send({ ok: false, greska: 'Ta email adresa je ve\u0107 registrirana.' });
    }
    const jePotvrden = igrac.emailPotvrdjen;
    await baza
      .update(igraci)
      .set(jePotvrden
        ? { emailNaCekanju: normaliziraniEmail, emailPotvrdaZatrazenAt: new Date(), emailPotvrdaPoslanaAt: null }
        : { email: normaliziraniEmail, emailPotvrdaZatrazenAt: new Date(), emailPotvrdaPoslanaAt: null })
      .where(eq(igraci.id, igrac.id));
    const tokenPotvrde = izdajTokenPotvrdeEmaila(igrac.id, normaliziraniEmail);
    const poveznica = new URL(
      `/potvrda-emaila?token=${tokenPotvrde}`,
      konfiguracija.JAVNA_ADRESA,
    ).toString();
    await pokusajPoslatiEmail(app.log, normaliziraniEmail, porukaPotvrdeEmaila(poveznica, true), `promjena-emaila:${igrac.id}`);
    await baza.update(igraci).set({ emailPotvrdaPoslanaAt: new Date() }).where(eq(igraci.id, igrac.id));
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
      rijeci: retci.slice(0, limit).map((redak, indeks) => ({
        mjesto: indeks + 1,
        rijec: redak.rijec,
        brojUpotreba: redak.brojUpotreba,
        postotakPartija: ukupnoPartija > 0 ? (redak.brojPartija / ukupnoPartija) * 100 : 0,
      })),
    };
  });

  const dohvatiAktivnost = async (
    igracId: string,
    mod: 'cetiri_igraca' | 'dva_igraca' | undefined,
    limitUlaz: string | undefined,
    cursorUlaz: string | undefined,
    odgovor: { code: (status: number) => { send: (tijelo: unknown) => unknown } },
  ) => {
    const limit = Math.min(Math.max(parseInt(limitUlaz ?? '20', 10) || 20, 1), MAKSIMALNO_PARTIJA_PO_STRANICI);
    const cursor = dekodirajCursor<CursorPovijestiPartija>(cursorUlaz);
    if (cursorUlaz && (!cursor?.kraj || !cursor.partijaId || Number.isNaN(Date.parse(cursor.kraj)))) {
      return odgovor.code(400).send({ ok: false, greska: 'Neispravan cursor aktivnosti.' });
    }
    const uvjeti = [
      eq(sudioniciPartije.igracId, igracId),
      eq(partije.status, 'zavrsena'),
      notExists(
        baza.select({ partijaId: obracuniPartija.partijaId })
          .from(obracuniPartija)
          .where(and(eq(obracuniPartija.partijaId, partije.id), eq(obracuniPartija.vrsta, 'privatna_gamifikacija'))),
      ),
      ...(mod ? [eq(partije.mod, mod)] : []),
      ...(cursor ? [sql`(${partije.kraj} < ${new Date(cursor.kraj)} OR (${partije.kraj} = ${new Date(cursor.kraj)} AND ${partije.id} < ${cursor.partijaId}))`] : []),
    ];
    const retci = await baza
      .select({
        partijaId: partije.id,
        mod: partije.mod,
        plasman: sudioniciPartije.plasman,
        bodovi: sudioniciPartije.bodovi,
        eliminacije: sudioniciPartije.eliminacije,
        pocetak: partije.pocetak,
        kraj: partije.kraj,
      })
      .from(sudioniciPartije)
      .innerJoin(partije, eq(partije.id, sudioniciPartije.partijaId))
      .where(and(...uvjeti))
      .orderBy(desc(partije.kraj), desc(partije.id))
      .limit(limit + 1);
    const imaJos = retci.length > limit;
    const aktivnost = (imaJos ? retci.slice(0, limit) : retci).map((redak) => ({
      ...redak,
      plasman: redak.plasman ?? 0,
      kraj: redak.kraj?.toISOString() ?? redak.pocetak.toISOString(),
    }));
    const zadnja = aktivnost.at(-1);
    return {
      ok: true,
      aktivnost,
      imaJos,
      sljedeciCursor: imaJos && zadnja ? kodirajCursor({ kraj: zadnja.kraj, partijaId: zadnja.partijaId }) : null,
    };
  };

  const registrirajAktivnostRutu = (putanja: '/aktivnost/:igracId' | '/povijest/:igracId') => {
    app.get<{ Params: { igracId: string }; Querystring: { limit?: string; cursor?: string; mod?: string } }>(putanja, async (zahtjev, odgovor) => {
      const mod = zahtjev.query.mod === 'cetiri_igraca' || zahtjev.query.mod === 'dva_igraca' ? zahtjev.query.mod : undefined;
      const rezultat = await dohvatiAktivnost(zahtjev.params.igracId, mod, zahtjev.query.limit, zahtjev.query.cursor, odgovor);
      if (putanja === '/povijest/:igracId' && typeof rezultat === 'object' && rezultat !== null && 'aktivnost' in rezultat) {
        return { ...rezultat, partije: rezultat.aktivnost };
      }
      return rezultat;
    });
  };
  registrirajAktivnostRutu('/aktivnost/:igracId');
  registrirajAktivnostRutu('/povijest/:igracId');

  app.get<{ Params: { partijaId: string } }>('/partije/:partijaId/plasmani', async (zahtjev, odgovor) => {
    const [partija] = await baza
      .select({ id: partije.id, mod: partije.mod, pocetak: partije.pocetak, kraj: partije.kraj })
      .from(partije)
      .where(and(
        eq(partije.id, zahtjev.params.partijaId),
        eq(partije.status, 'zavrsena'),
        notExists(
          baza.select({ partijaId: obracuniPartija.partijaId })
            .from(obracuniPartija)
            .where(and(eq(obracuniPartija.partijaId, partije.id), eq(obracuniPartija.vrsta, 'privatna_gamifikacija'))),
        ),
      ))
      .limit(1);
    if (!partija || !partija.kraj) return odgovor.code(404).send({ ok: false, greska: 'Arhiva javne partije nije pronađena.' });
    const retci = await baza
      .select({
        igracId: sudioniciPartije.igracId,
        nadimak: sql<string>`case when ${igraci.vrsta} = 'gost' then 'Gost' when ${sudioniciPartije.nadimak} = 'Nepoznati igrač' then ${igraci.nadimak} else ${sudioniciPartije.nadimak} end`,
        plasman: sudioniciPartije.plasman,
        bodovi: sudioniciPartije.bodovi,
        eliminacije: sudioniciPartije.eliminacije,
        nacinIspadanja: sudioniciPartije.nacinIspadanja,
        javniProfil: sql<boolean>`${igraci.vrsta} in ('registriran', 'admin') and ${igraci.obrisanAt} is null`,
      })
      .from(sudioniciPartije)
      .innerJoin(igraci, eq(igraci.id, sudioniciPartije.igracId))
      .where(eq(sudioniciPartije.partijaId, partija.id))
      .orderBy(asc(sudioniciPartije.plasman));
    return {
      ok: true,
      partija: {
        partijaId: partija.id,
        mod: partija.mod,
        pocetak: partija.pocetak.toISOString(),
        kraj: partija.kraj.toISOString(),
        plasmani: retci.map((redak) => ({ ...redak, plasman: redak.plasman ?? 0 })),
      },
    };
  });

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
