/**
 * Vremenske ljestvice: jedan izračun poretka po (mod, metrika, razdoblje) koji dijele tablica, „Oko mene" i pozicije.
 * Poredak se drži u memoriji kratko (najviše do kraja razdoblja), pa baza ne računa za svakog posjetitelja.
 */
import { sql, type SQL } from 'drizzle-orm';
import {
  graniceRazdoblja,
  minimumIgaraZaRazdoblje,
  RAZDOBLJA_LJESTVICA,
  type MetrikaLjestvice,
  type ModPartije,
  type PozicijaNaLjestvici,
  type RazdobljeLjestvice,
  type VrijednostLjestvice,
} from 'zajednicko';
import { baza } from '../baza/klijent.js';

export const TRAJANJE_PRIVREMENE_MEMORIJE_MS = 30_000;

export interface StavkaPoretka {
  igracId: string;
  nadimak: string;
  jeJavanProfil: boolean;
  odigraneIgre: number;
  nepotpuno: boolean;
  vrijednost: VrijednostLjestvice;
  imaRezultat: boolean;
  mjesto: number | null;
}

export interface Poredak {
  /** Samo rangirani, poredani po mjestu (indeks + 1 = mjesto). */
  rangirani: StavkaPoretka[];
  /** Svi igrači s barem jednom igrom u obuhvatu, za statuse nerangiranih. */
  poIgracu: Map<string, StavkaPoretka>;
  minimumIgara: number;
}

interface RedakUpita extends Record<string, unknown> {
  igrac_id: string;
  nadimak: string;
  vrsta: 'gost' | 'registriran' | 'admin';
  igre: number;
  zbroj_bodova: number;
  niz: number;
  nepotpuno: boolean;
  mjesto: number | null;
}

/** Sortni izraz i uvjet rezultata po metrici; samo serverska mapa, nikad iz upita korisnika. */
const DEFINICIJE_METRIKA: Record<MetrikaLjestvice, { vrijednost: SQL; ostvareno: SQL; imaRezultat: SQL }> = {
  prosjek_bodova: {
    vrijednost: sql`a.zbroj_bodova::numeric(80, 40) / a.igre`,
    ostvareno: sql`a.zadnji_kraj`,
    imaRezultat: sql`true`,
  },
  niz_pobjeda: {
    vrijednost: sql`coalesce(n.duljina, 0)::numeric`,
    ostvareno: sql`n.ostvareno_u`,
    imaRezultat: sql`coalesce(n.duljina, 0) > 0`,
  },
};

function upitPoretka(mod: ModPartije, metrika: MetrikaLjestvice, od: Date, doTrenutka: Date, minimum: number): SQL {
  const definicija = DEFINICIJE_METRIKA[metrika];
  return sql`
    with igre as (
      select s.igrac_id, p.id as partija_id, p.pocetak, p.kraj, s.bodovi, s.plasman
      from partije p
      join sudionici_partije s on s.partija_id = p.id
      join igraci i on i.id = s.igrac_id
      where p.status = 'zavrsena' and p.mod = ${mod}
        and p.kraj >= ${od.toISOString()}::timestamptz and p.kraj < ${doTrenutka.toISOString()}::timestamptz
        and i.obrisan_at is null
    ),
    agregati as (
      select igrac_id, count(*)::int as igre, coalesce(sum(bodovi), 0)::int as zbroj_bodova,
        max(kraj) as zadnji_kraj, bool_or(plasman is null) as nepotpuno
      from igre
      group by igrac_id
    ),
    sekvenca as (
      select igrac_id, kraj, plasman,
        sum(case when plasman = 1 then 0 else 1 end) over (
          partition by igrac_id order by pocetak, partija_id
          rows between unbounded preceding and current row
        ) as blok
      from igre
    ),
    blokovi as (
      select igrac_id, blok, count(*)::int as duljina, max(kraj) as ostvareno_u
      from sekvenca where plasman = 1
      group by igrac_id, blok
    ),
    najbolji_niz as (
      select distinct on (igrac_id) igrac_id, duljina, ostvareno_u
      from blokovi
      order by igrac_id, duljina desc, ostvareno_u asc
    ),
    kandidati as (
      select a.igrac_id, a.igre, a.zbroj_bodova, a.nepotpuno, coalesce(n.duljina, 0)::int as niz,
        ${definicija.vrijednost} as sort_vrijednost,
        ${definicija.ostvareno} as ostvareno_u,
        (a.igre >= ${minimum} and not a.nepotpuno and ${definicija.imaRezultat}) as kvalificiran
      from agregati a
      left join najbolji_niz n on n.igrac_id = a.igrac_id
    )
    select k.igrac_id, i.nadimak, i.vrsta, k.igre, k.zbroj_bodova, k.niz, k.nepotpuno,
      (case when k.kvalificiran then row_number() over (
        partition by k.kvalificiran
        order by k.sort_vrijednost desc, k.igre desc, k.ostvareno_u asc, k.igrac_id asc
      ) end)::int as mjesto
    from kandidati k
    join igraci i on i.id = k.igrac_id
  `;
}

function uStavku(metrika: MetrikaLjestvice, redak: RedakUpita): StavkaPoretka {
  const vrijednost: VrijednostLjestvice = metrika === 'prosjek_bodova'
    ? { vrsta: 'prosjek_bodova', prosjek: redak.igre > 0 ? redak.zbroj_bodova / redak.igre : 0, bodoviUkupno: redak.zbroj_bodova }
    : { vrsta: 'niz_pobjeda', broj: redak.niz };
  return {
    igracId: redak.igrac_id,
    nadimak: redak.nadimak,
    jeJavanProfil: redak.vrsta !== 'gost',
    odigraneIgre: redak.igre,
    nepotpuno: redak.nepotpuno,
    vrijednost,
    imaRezultat: metrika === 'prosjek_bodova' || redak.niz > 0,
    mjesto: redak.mjesto,
  };
}

export async function izracunajPoredak(
  mod: ModPartije,
  metrika: MetrikaLjestvice,
  razdoblje: RazdobljeLjestvice,
  od: Date,
  doTrenutka: Date,
): Promise<Poredak> {
  const minimumIgara = minimumIgaraZaRazdoblje(razdoblje);
  const redci = await baza.execute<RedakUpita>(upitPoretka(mod, metrika, od, doTrenutka, minimumIgara));
  const poIgracu = new Map<string, StavkaPoretka>();
  const rangirani: StavkaPoretka[] = [];
  for (const redak of redci) {
    const stavka = uStavku(metrika, redak);
    poIgracu.set(stavka.igracId, stavka);
    if (stavka.mjesto !== null) rangirani.push(stavka);
  }
  rangirani.sort((a, b) => a.mjesto! - b.mjesto!);
  return { rangirani, poIgracu, minimumIgara };
}

interface ZapisMemorije {
  istice: number;
  poredak: Promise<Poredak>;
}

const privremenaMemorija = new Map<string, ZapisMemorije>();

export function ocistiMemorijuLjestvica(): void {
  privremenaMemorija.clear();
}

/** Isti ključ = isti obuhvat; istovremeni zahtjevi dijele jedan upit. */
export function dohvatiPoredak(
  mod: ModPartije,
  metrika: MetrikaLjestvice,
  razdoblje: RazdobljeLjestvice,
  od: Date,
  doTrenutka: Date,
  sada: Date,
): Promise<Poredak> {
  const sadaMs = sada.getTime();
  for (const [kljuc, zapis] of privremenaMemorija) {
    if (zapis.istice <= sadaMs) privremenaMemorija.delete(kljuc);
  }
  const kljuc = `${mod}|${metrika}|${razdoblje}|${od.toISOString()}|${doTrenutka.toISOString()}`;
  const postojeci = privremenaMemorija.get(kljuc);
  if (postojeci) return postojeci.poredak;

  const poredak = izracunajPoredak(mod, metrika, razdoblje, od, doTrenutka);
  privremenaMemorija.set(kljuc, {
    istice: Math.min(sadaMs + TRAJANJE_PRIVREMENE_MEMORIJE_MS, doTrenutka.getTime()),
    poredak,
  });
  poredak.catch(() => privremenaMemorija.delete(kljuc));
  return poredak;
}

export function pozicijaIgraca(poredak: Poredak, igracId: string | null): PozicijaNaLjestvici {
  const minimumIgara = poredak.minimumIgara;
  const prazno = { mjesto: null, odigraneIgre: null, minimumIgara, nedostajeIgara: null };
  if (!igracId) return { status: 'prijava_potrebna', ...prazno };
  const stavka = poredak.poIgracu.get(igracId);
  if (!stavka) return { status: 'nije_igrano', ...prazno, odigraneIgre: 0, nedostajeIgara: minimumIgara };
  const osnova = { minimumIgara, odigraneIgre: stavka.odigraneIgre };
  if (stavka.odigraneIgre < minimumIgara) {
    return { status: 'nedovoljan_broj_igara', mjesto: null, ...osnova, nedostajeIgara: minimumIgara - stavka.odigraneIgre };
  }
  if (stavka.nepotpuno) return { status: 'podaci_nepotpuni', mjesto: null, ...osnova, nedostajeIgara: 0 };
  if (!stavka.imaRezultat || stavka.mjesto === null) return { status: 'nema_rezultata', mjesto: null, ...osnova, nedostajeIgara: 0 };
  return { status: 'rangiran', mjesto: stavka.mjesto, ...osnova, nedostajeIgara: 0 };
}

export interface ObuhvatRazdoblja {
  razdoblje: RazdobljeLjestvice;
  od: Date;
  do: Date | null;
  zakljucano: boolean;
  otkljucavaSe: Date | null;
  /** Gornja granica upita: kraj razdoblja ili trenutak izračuna za svih vremena. */
  doUpita: Date;
}

export function obuhvatiRazdoblja(sada: Date, pocetakPracenja: Date): Record<RazdobljeLjestvice, ObuhvatRazdoblja> {
  return Object.fromEntries(RAZDOBLJA_LJESTVICA.map((razdoblje) => {
    const granice = graniceRazdoblja(razdoblje, sada, pocetakPracenja);
    return [razdoblje, {
      razdoblje,
      ...granice,
      // Svih vremena: rez na minutu da cache ključ ne bude jedinstven za svaki zahtjev.
      doUpita: granice.do ?? new Date(Math.floor(sada.getTime() / 60_000) * 60_000 + 60_000),
    }];
  })) as Record<RazdobljeLjestvice, ObuhvatRazdoblja>;
}
