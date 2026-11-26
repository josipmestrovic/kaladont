/**
 * Vremenske ljestvice Troboja: jedan izračun poretka po (mod, metrika, razdoblje).
 * Poredak se drži u memoriji kratko (najviše do kraja razdoblja).
 */
import { sql, type SQL } from 'drizzle-orm';
import {
  graniceRazdoblja,
  minimumIgaraZaRazdoblje,
  minimumPrihvacenihPotezaZaRazdoblje,
  RAZDOBLJA_LJESTVICA,
  type AvatarConfigV1,
  type MetrikaVremenskaLjestvice,
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
  /** Valjani prihvaćeni potezi (brzina); inače 0. */
  prihvaceniPotezi: number;
  nepotpuno: boolean;
  vrijednost: VrijednostLjestvice;
  imaRezultat: boolean;
  mjesto: number | null;
  avatarId: number;
  avatarConfig: AvatarConfigV1 | null;
  avatarRevision: number;
}

export interface Poredak {
  /** Samo rangirani, poredani po mjestu (indeks + 1 = mjesto). */
  rangirani: StavkaPoretka[];
  /** Svi igrači s barem jednom igrom u obuhvatu, za statuse nerangiranih. */
  poIgracu: Map<string, StavkaPoretka>;
  minimumIgara: number;
  minimumPoteza: number | null;
}

interface RedakUpita extends Record<string, unknown> {
  igrac_id: string;
  nadimak: string;
  vrsta: 'gost' | 'registriran' | 'admin';
  igre: number;
  zbroj_bodova: number;
  niz: number;
  najbolji_niz_rijeci: number;
  prihvaceni_potezi: number;
  trajanje_ms: number;
  nepotpuno: boolean;
  mjesto: number | null;
  avatar_id: number;
  avatar_config: AvatarConfigV1 | null;
  avatar_revision: number;
}

type DefinicijaVremenske = {
  vrijednost: SQL;
  ostvareno: SQL;
  imaRezultat: SQL;
  smjer: 'desc' | 'asc';
  /** Dodatni ORDER BY izrazi nakon sort_vrijednost (prije igre / id). */
  dodatniRedoslijed: SQL;
};

/** Sortni izraz i uvjet rezultata; samo serverska mapa, nikad iz upita korisnika. */
const DEFINICIJE_VREMENSKIH: Record<MetrikaVremenskaLjestvice, DefinicijaVremenske> = {
  prosjek_bodova: {
    vrijednost: sql`a.zbroj_bodova::numeric(80, 40) / a.igre`,
    ostvareno: sql`a.zadnji_kraj`,
    imaRezultat: sql`true`,
    smjer: 'desc',
    /** U vanjskom ORDER BY alias je `k` (kandidati). */
    dodatniRedoslijed: sql`k.igre desc`,
  },
  niz_pobjeda: {
    vrijednost: sql`coalesce(n.duljina, 0)::numeric`,
    ostvareno: sql`n.ostvareno_u`,
    imaRezultat: sql`coalesce(n.duljina, 0) > 0`,
    smjer: 'desc',
    dodatniRedoslijed: sql`k.igre desc`,
  },
  najbrzi_igraci: {
    // Ponderirani prosjek: ukupno trajanje / ukupni potezi (ne prosjek prosjeka).
    vrijednost: sql`(a.trajanje_ms::numeric(80, 40) / nullif(a.prihvaceni_potezi, 0))`,
    ostvareno: sql`a.zadnji_kraj`,
    imaRezultat: sql`a.prihvaceni_potezi > 0 and a.trajanje_ms >= 0`,
    smjer: 'asc',
    dodatniRedoslijed: sql`k.prihvaceni_potezi desc, k.igre desc`,
  },
  niz_rijeci: {
    vrijednost: sql`coalesce(a.najbolji_niz_rijeci, 0)::numeric`,
    ostvareno: sql`nr.ostvareno_u`,
    imaRezultat: sql`coalesce(a.najbolji_niz_rijeci, 0) > 0`,
    smjer: 'desc',
    dodatniRedoslijed: sql`k.igre desc`,
  },
};

function upitPoretka(
  mod: ModPartije,
  metrika: MetrikaVremenskaLjestvice,
  od: Date,
  doTrenutka: Date,
  minimumIgara: number,
  minimumPoteza: number | null,
): SQL {
  const definicija = DEFINICIJE_VREMENSKIH[metrika];
  const redoslijedVrijednosti = definicija.smjer === 'asc'
    ? sql`k.sort_vrijednost asc`
    : sql`k.sort_vrijednost desc`;
  const uvjetPoteza = metrika === 'najbrzi_igraci' && minimumPoteza !== null
    ? sql`and a.prihvaceni_potezi >= ${minimumPoteza}`
    : sql``;
  // Za brzinu brojimo samo partije s pouzdanim agregatom (metrike_verzija = 1, >0 poteza).
  const filtreBrzine = metrika === 'najbrzi_igraci'
    ? sql`and s.metrike_verzija = 1 and s.prihvacene_rijeci > 0 and s.trajanje_prihvacenih_ms is not null and s.trajanje_prihvacenih_ms >= 0`
    : sql``;

  return sql`
    with igre as (
      select s.igrac_id, p.id as partija_id, p.pocetak, p.kraj, s.bodovi, s.plasman,
        s.metrike_verzija, s.prihvacene_rijeci, s.trajanje_prihvacenih_ms, s.najduzi_niz_rijeci
      from partije p
      join sudionici_partije s on s.partija_id = p.id
      join igraci i on i.id = s.igrac_id
      where p.status = 'zavrsena' and p.mod = ${mod}
        and p.kraj >= ${od.toISOString()}::timestamptz and p.kraj < ${doTrenutka.toISOString()}::timestamptz
        and i.obrisan_at is null
        and i.upravljac = 'covjek'
        and not exists (
          select 1 from obracuni_partija o
          where o.partija_id = p.id and o.vrsta = 'privatna_gamifikacija'
        )
        ${filtreBrzine}
    ),
    agregati as (
      select igrac_id,
        count(*)::int as igre,
        coalesce(sum(bodovi), 0)::int as zbroj_bodova,
        max(kraj) as zadnji_kraj,
        bool_or(plasman is null) as nepotpuno,
        coalesce(sum(case
          when metrike_verzija = 1 and prihvacene_rijeci > 0 then prihvacene_rijeci
          else 0
        end), 0)::int as prihvaceni_potezi,
        coalesce(sum(case
          when metrike_verzija = 1 and prihvacene_rijeci > 0 then trajanje_prihvacenih_ms
          else 0
        end), 0)::bigint as trajanje_ms,
        max(case when metrike_verzija = 1 then najduzi_niz_rijeci else null end)::int as najbolji_niz_rijeci
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
    niz_rijeci_ostvarenje as (
      select distinct on (igrac_id) igrac_id, kraj as ostvareno_u
      from igre
      where metrike_verzija = 1 and najduzi_niz_rijeci is not null and najduzi_niz_rijeci > 0
      order by igrac_id, najduzi_niz_rijeci desc, kraj asc
    ),
    kandidati as (
      select a.igrac_id, a.igre, a.zbroj_bodova, a.nepotpuno,
        coalesce(n.duljina, 0)::int as niz,
        coalesce(a.najbolji_niz_rijeci, 0)::int as najbolji_niz_rijeci,
        a.prihvaceni_potezi, a.trajanje_ms,
        ${definicija.vrijednost} as sort_vrijednost,
        ${definicija.ostvareno} as ostvareno_u,
        (a.igre >= ${minimumIgara} and not a.nepotpuno and ${definicija.imaRezultat} ${uvjetPoteza}) as kvalificiran
      from agregati a
      left join najbolji_niz n on n.igrac_id = a.igrac_id
      left join niz_rijeci_ostvarenje nr on nr.igrac_id = a.igrac_id
    )
    select k.igrac_id, i.nadimak, i.vrsta, k.igre, k.zbroj_bodova, k.niz, k.najbolji_niz_rijeci,
      k.prihvaceni_potezi, k.trajanje_ms, k.nepotpuno,
      i.avatar_id, i.avatar_config, i.avatar_revision,
      (case when k.kvalificiran then row_number() over (
        partition by k.kvalificiran
        order by ${redoslijedVrijednosti}, ${definicija.dodatniRedoslijed}, k.ostvareno_u asc, k.igrac_id asc
      ) end)::int as mjesto
    from kandidati k
    join igraci i on i.id = k.igrac_id
  `;
}

function uStavku(metrika: MetrikaVremenskaLjestvice, redak: RedakUpita): StavkaPoretka {
  let vrijednost: VrijednostLjestvice;
  let imaRezultat: boolean;
  if (metrika === 'prosjek_bodova') {
    vrijednost = {
      vrsta: 'prosjek_bodova',
      prosjek: redak.igre > 0 ? redak.zbroj_bodova / redak.igre : 0,
      bodoviUkupno: redak.zbroj_bodova,
    };
    imaRezultat = true;
  } else if (metrika === 'niz_pobjeda') {
    vrijednost = { vrsta: 'niz_pobjeda', broj: redak.niz };
    imaRezultat = redak.niz > 0;
  } else if (metrika === 'najbrzi_igraci') {
    const prosjekMs = redak.prihvaceni_potezi > 0 ? Number(redak.trajanje_ms) / redak.prihvaceni_potezi : 0;
    vrijednost = {
      vrsta: 'prosjek_brzine',
      prosjekMs,
      prihvaceniPotezi: redak.prihvaceni_potezi,
    };
    imaRezultat = redak.prihvaceni_potezi > 0;
  } else {
    const broj = Number(redak.najbolji_niz_rijeci ?? 0);
    vrijednost = { vrsta: 'niz_rijeci', broj };
    imaRezultat = broj > 0;
  }

  return {
    igracId: redak.igrac_id,
    nadimak: redak.nadimak,
    jeJavanProfil: redak.vrsta !== 'gost',
    odigraneIgre: redak.igre,
    prihvaceniPotezi: Number(redak.prihvaceni_potezi ?? 0),
    nepotpuno: redak.nepotpuno,
    vrijednost,
    imaRezultat,
    mjesto: redak.mjesto,
    avatarId: Number(redak.avatar_id ?? 0),
    avatarConfig: redak.avatar_config ?? null,
    avatarRevision: Number(redak.avatar_revision ?? 0),
  };
}

/** Isti SQL kao javni prikaz. `izvrsitelj` je transakcija kad snimka mora vidjeti još necommitani rezultat. */
export interface IzvrsiteljPoretka {
  execute(upit: SQL): Promise<Iterable<RedakUpita>>;
}

export async function izracunajPoredak(
  mod: ModPartije,
  metrika: MetrikaVremenskaLjestvice,
  razdoblje: RazdobljeLjestvice,
  od: Date,
  doTrenutka: Date,
  izvrsitelj?: IzvrsiteljPoretka,
): Promise<Poredak> {
  const minimumIgara = minimumIgaraZaRazdoblje(razdoblje);
  const minimumPoteza = metrika === 'najbrzi_igraci' ? minimumPrihvacenihPotezaZaRazdoblje(razdoblje) : null;
  const izvor = izvrsitelj ?? (baza as unknown as IzvrsiteljPoretka);
  const redci = await izvor.execute(upitPoretka(mod, metrika, od, doTrenutka, minimumIgara, minimumPoteza));
  const poIgracu = new Map<string, StavkaPoretka>();
  const rangirani: StavkaPoretka[] = [];
  for (const redak of redci) {
    const stavka = uStavku(metrika, redak);
    poIgracu.set(stavka.igracId, stavka);
    if (stavka.mjesto !== null) rangirani.push(stavka);
  }
  rangirani.sort((a, b) => a.mjesto! - b.mjesto!);
  return { rangirani, poIgracu, minimumIgara, minimumPoteza };
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
  metrika: MetrikaVremenskaLjestvice,
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
  const minimumPoteza = poredak.minimumPoteza;
  const prazno = {
    mjesto: null as number | null,
    odigraneIgre: null as number | null,
    minimumIgara,
    nedostajeIgara: null as number | null,
    prihvaceniPotezi: null as number | null,
    minimumPoteza,
    nedostajePoteza: null as number | null,
  };
  if (!igracId) return { status: 'prijava_potrebna', ...prazno };
  const stavka = poredak.poIgracu.get(igracId);
  if (!stavka) {
    return {
      status: 'nije_igrano',
      ...prazno,
      odigraneIgre: 0,
      nedostajeIgara: minimumIgara,
      prihvaceniPotezi: 0,
      nedostajePoteza: minimumPoteza,
    };
  }
  const osnova = {
    minimumIgara,
    odigraneIgre: stavka.odigraneIgre,
    prihvaceniPotezi: stavka.prihvaceniPotezi,
    minimumPoteza,
    nedostajePoteza: minimumPoteza !== null
      ? Math.max(0, minimumPoteza - stavka.prihvaceniPotezi)
      : null,
  };
  if (stavka.odigraneIgre < minimumIgara) {
    return {
      status: 'nedovoljan_broj_igara',
      mjesto: null,
      ...osnova,
      nedostajeIgara: minimumIgara - stavka.odigraneIgre,
    };
  }
  if (minimumPoteza !== null && stavka.prihvaceniPotezi < minimumPoteza) {
    return {
      status: 'nedovoljan_broj_poteza',
      mjesto: null,
      ...osnova,
      nedostajeIgara: 0,
      nedostajePoteza: minimumPoteza - stavka.prihvaceniPotezi,
    };
  }
  if (stavka.nepotpuno) return { status: 'podaci_nepotpuni', mjesto: null, ...osnova, nedostajeIgara: 0 };
  if (!stavka.imaRezultat || stavka.mjesto === null) {
    return { status: 'nema_rezultata', mjesto: null, ...osnova, nedostajeIgara: 0 };
  }
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
