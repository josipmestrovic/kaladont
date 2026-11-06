/**
 * Operativni status minimalne analitike (bez zasebnog workera).
 */
import { max, min, sql, count } from 'drizzle-orm';
import { baza } from '../baza/klijent.js';
import { analitikaIgre, analitikaOtvaranja } from '../baza/shema.js';
import { ANALITIKA_VREMENSKA_ZONA } from './otvaranja.js';

export async function dohvatiStatusAnalitike() {
  const [otvaranja] = await baza
    .select({
      najstarije: min(analitikaOtvaranja.dodijeljenoU),
      najnovije: max(analitikaOtvaranja.dodijeljenoU),
      otvoreni: sql<number>`count(*) filter (where ${analitikaOtvaranja.status} = 'otvoren')::int`,
      nepotpuni: sql<number>`count(*) filter (where ${analitikaOtvaranja.status} = 'nepotpuno')::int`,
      ukupno: count(),
    })
    .from(analitikaOtvaranja);

  const [igre] = await baza
    .select({
      najstarije: min(analitikaIgre.pocetakU),
      najnovije: max(sql`coalesce(${analitikaIgre.krajU}, ${analitikaIgre.pocetakU})`),
      bezIshoda: sql<number>`count(*) filter (where ${analitikaIgre.ishod} is null)::int`,
      ukupno: count(),
    })
    .from(analitikaIgre);

  const kandidati = [otvaranja?.najstarije, igre?.najstarije].filter((d): d is Date => Boolean(d));
  const najnoviji = [otvaranja?.najnovije, igre?.najnovije].filter((d): d is Date => Boolean(d));
  const mjerenjeOd = kandidati.length === 0 ? null : new Date(Math.min(...kandidati.map((d) => d.getTime())));
  const zadnjiZapisU = najnoviji.length === 0 ? null : new Date(Math.max(...najnoviji.map((d) => d.getTime())));

  return {
    vremenskaZona: ANALITIKA_VREMENSKA_ZONA,
    mjerenjeOd: mjerenjeOd?.toISOString() ?? null,
    zadnjiZapisU: zadnjiZapisU?.toISOString() ?? null,
    imaMjerenja: mjerenjeOd !== null,
    otvaranja: {
      ukupno: Number(otvaranja?.ukupno ?? 0),
      otvoreni: otvaranja?.otvoreni ?? 0,
      nepotpuni: otvaranja?.nepotpuni ?? 0,
    },
    igre: {
      ukupno: Number(igre?.ukupno ?? 0),
      bezIshoda: igre?.bezIshoda ?? 0,
    },
    napomena:
      'Minimalni slice: početne riječi/rani incidenti, dnevne igre, omjer gost/reg i 2+ igre. Nema Umamija, konverzije 7 dana, misija ni workera.',
  };
}
