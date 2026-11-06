import { eq, sql } from 'drizzle-orm';
import { baza } from '../baza/klijent.js';
import { dodjeleMisija } from '../baza/shema.js';
import { priznajDovrsenuMisiju, priznajPrivatnika, priznajTjedniPaketAkoKompletan } from './dodjela.js';

export interface IshodBackfillaD01 {
  misije: number;
  paketi: number;
  privatne: number;
}

/**
 * Jednokratno, idempotentno priznavanje D01 iz postojećih dovršenih misija,
 * potpunih tjednih paketa i privatnih igara s barem jednom prihvaćenom riječi.
 * Namjerni prekid (potez vrste `prekid`) ne ulazi u Privatnika.
 */
export async function backfillDostignucaD01(): Promise<IshodBackfillaD01> {
  const dovrsene = await baza.select({
    id: dodjeleMisija.id,
    igracId: dodjeleMisija.igracId,
    vrsta: dodjeleMisija.vrsta,
    ciklusId: dodjeleMisija.ciklusId,
    zavrsenaU: dodjeleMisija.zavrsenaU,
  }).from(dodjeleMisija).where(eq(dodjeleMisija.status, 'dovrsena'));

  let misije = 0;
  let paketi = 0;
  const ciklusi = new Map<string, { igracId: string; ciklusId: string; zavrsenoU: Date }>();

  for (const red of dovrsene) {
    const zavrsenoU = red.zavrsenaU ?? new Date();
    const ishod = await baza.transaction((tx) => priznajDovrsenuMisiju(tx, {
      igracId: red.igracId,
      dodjelaId: red.id,
      zavrsenoU,
    }));
    if (ishod.doprinosUmetnut) misije += 1;
    if (red.vrsta === 'tjedna' && red.ciklusId) {
      const postojeci = ciklusi.get(red.ciklusId);
      const zavrsenoPaketa = !postojeci || zavrsenoU.getTime() > postojeci.zavrsenoU.getTime() ? zavrsenoU : postojeci.zavrsenoU;
      ciklusi.set(red.ciklusId, { igracId: red.igracId, ciklusId: red.ciklusId, zavrsenoU: zavrsenoPaketa });
    }
  }

  for (const ciklus of ciklusi.values()) {
    const ishod = await baza.transaction((tx) => priznajTjedniPaketAkoKompletan(tx, ciklus));
    if (ishod.doprinosUmetnut) paketi += 1;
  }

  const privatneIgre = await baza.execute<{ igrac_id: string; partija_id: string }>(sql`
    select p.igrac_id, p.partija_id
    from potezi p
    join obracuni_partija o on o.partija_id = p.partija_id and o.vrsta = 'privatna_gamifikacija'
    join igraci i on i.id = p.igrac_id
    where p.vrsta = 'rijec'
      and p.igrac_id is not null
      and i.upravljac = 'covjek'
      and i.vrsta in ('registriran', 'admin')
      and i.obrisan_at is null
    group by p.igrac_id, p.partija_id
    having count(*) >= 1
      and not exists (
        select 1 from potezi x
        where x.partija_id = p.partija_id
          and x.igrac_id = p.igrac_id
          and x.vrsta = 'prekid'
      )
  `);

  let privatne = 0;
  for (const red of privatneIgre) {
    const ishod = await baza.transaction((tx) => priznajPrivatnika(tx, {
      igracId: red.igrac_id,
      partijaId: red.partija_id,
      zavrsenoU: new Date(),
    }));
    if (ishod.doprinosUmetnut) privatne += 1;
  }

  return { misije, paketi, privatne };
}
