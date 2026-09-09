/**
 * Prosjek čekanja zadnjih 100 završenih partija, keširan u memoriji (model-podataka.md).
 * Osvježava se pri startu poslužitelja i pri početku svake nove partije.
 */
import { sql } from 'drizzle-orm';
import { baza } from '../baza/klijent.js';

let kesiranProsjekSek = 0;

export function dohvatiProsjekCekanjaSek(): number {
  return kesiranProsjekSek;
}

export async function osvjeziProsjekCekanja(): Promise<void> {
  const rezultat = await baza.execute<{ prosjek_ms: string | null }>(sql`
    SELECT AVG(sp.cekanje_ms) AS prosjek_ms
    FROM sudionici_partije sp
    WHERE sp.partija_id IN (
      SELECT id FROM partije WHERE status = 'zavrsena' ORDER BY kraj DESC LIMIT 100
    )
  `);
  const prosjekMs = Number(rezultat[0]?.prosjek_ms ?? 0);
  kesiranProsjekSek = Math.round(prosjekMs / 1000);
}
