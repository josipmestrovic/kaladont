/**
 * Admin statistika čekanja i botova (ADR-017): mjeri se čekanje ljudi po partiji i broj botova
 * za stolom kako bi se pragovi i fond mogli podešavati na temelju stvarnih podataka.
 */
import { sql } from 'drizzle-orm';
import { baza } from '../baza/klijent.js';

export interface RedakCekanjaPoDanu extends Record<string, unknown> {
  dan: string;
  mod: 'cetiri_igraca' | 'dva_igraca';
  partije: number;
  prosjekCekanjaMs: number | null;
  medijanCekanjaMs: number | null;
  p95CekanjaMs: number | null;
  partijeBezBotova: number;
  partijeSJednimBotom: number;
  partijeSDvaBota: number;
  partijeSTriBota: number;
}

export interface RedakPobjedaPoSastavu extends Record<string, unknown> {
  mod: 'cetiri_igraca' | 'dva_igraca';
  brojBotova: number;
  partije: number;
  pobjedeLjudi: number;
  udioPobjedaLjudi: number | null;
}

export interface RedakEliminacijaBotova extends Record<string, unknown> {
  nacinIspadanja: string;
  broj: number;
}

export interface StatistikaCekanja {
  dani: number;
  poDanu: RedakCekanjaPoDanu[];
  pobjedePoSastavu: RedakPobjedaPoSastavu[];
  eliminacijeBotova: RedakEliminacijaBotova[];
}

export async function izracunajStatistikuCekanja(dani: number, sada = new Date()): Promise<StatistikaCekanja> {
  const od = new Date(sada.getTime() - dani * 24 * 60 * 60 * 1_000);
  const poDanu = await baza.execute<RedakCekanjaPoDanu>(sql`
    with ljudi as (
      select p.id as partija_id, p.mod, p.broj_botova, date_trunc('day', p.pocetak)::date::text as dan, s.cekanje_ms
      from partije p
      join sudionici_partije s on s.partija_id = p.id
      join igraci i on i.id = s.igrac_id
      where p.status = 'zavrsena' and p.pocetak >= ${od.toISOString()}::timestamptz and p.pocetak < ${sada.toISOString()}::timestamptz
        and i.upravljac = 'covjek'
    ),
    po_partiji as (
      select partija_id, mod, broj_botova, dan, max(cekanje_ms) as cekanje_ms
      from ljudi group by partija_id, mod, broj_botova, dan
    )
    select dan, mod,
      count(*)::int as "partije",
      round(avg(cekanje_ms))::int as "prosjekCekanjaMs",
      round(percentile_cont(0.5) within group (order by cekanje_ms))::int as "medijanCekanjaMs",
      round(percentile_cont(0.95) within group (order by cekanje_ms))::int as "p95CekanjaMs",
      count(*) filter (where broj_botova = 0)::int as "partijeBezBotova",
      count(*) filter (where broj_botova = 1)::int as "partijeSJednimBotom",
      count(*) filter (where broj_botova = 2)::int as "partijeSDvaBota",
      count(*) filter (where broj_botova >= 3)::int as "partijeSTriBota"
    from po_partiji
    group by dan, mod
    order by dan desc, mod
  `);
  const pobjedePoSastavu = await baza.execute<RedakPobjedaPoSastavu>(sql`
    select p.mod, p.broj_botova as "brojBotova",
      count(*)::int as "partije",
      count(*) filter (where i.upravljac = 'covjek')::int as "pobjedeLjudi",
      case when count(*) > 0 then round(count(*) filter (where i.upravljac = 'covjek')::numeric / count(*), 3)::float else null end as "udioPobjedaLjudi"
    from partije p
    left join igraci i on i.id = p.pobjednik_id
    where p.status = 'zavrsena' and p.pocetak >= ${od.toISOString()}::timestamptz and p.pocetak < ${sada.toISOString()}::timestamptz
    group by p.mod, p.broj_botova
    order by p.mod, p.broj_botova
  `);
  const eliminacijeBotova = await baza.execute<RedakEliminacijaBotova>(sql`
    select coalesce(s.nacin_ispadanja::text, 'nepoznato') as "nacinIspadanja", count(*)::int as "broj"
    from sudionici_partije s
    join igraci i on i.id = s.igrac_id
    join partije p on p.id = s.partija_id
    where i.upravljac = 'bot' and p.status = 'zavrsena' and p.pocetak >= ${od.toISOString()}::timestamptz and p.pocetak < ${sada.toISOString()}::timestamptz
    group by s.nacin_ispadanja
    order by "broj" desc
  `);
  return {
    dani,
    poDanu: [...poDanu],
    pobjedePoSastavu: [...pobjedePoSastavu],
    eliminacijeBotova: [...eliminacijeBotova],
  };
}
