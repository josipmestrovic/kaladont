import { KLJUC_PREKRETNICE_PRVA_IGRA } from 'zajednicko';
import { baza } from '../baza/klijent.js';
import { sanducicPrekretnice } from '../baza/shema.js';
import type { MisijeTx } from '../misije/tipovi.js';

export type TxSanducic = MisijeTx;
type DbZaPrekretnicu = typeof baza | TxSanducic;

/** Idempotentno označi prag; `true` samo na prvi uspješan insert. */
export async function pokusajOstvaritiPrekretnicu(
  igracId: string,
  kljuc: string,
  tx: DbZaPrekretnicu = baza,
): Promise<boolean> {
  const [red] = await tx
    .insert(sanducicPrekretnice)
    .values({ igracId, kljuc })
    .onConflictDoNothing({
      target: [sanducicPrekretnice.igracId, sanducicPrekretnice.kljuc],
    })
    .returning({ igracId: sanducicPrekretnice.igracId });
  return red != null;
}

export async function pokusajOstvaritiPrvuIgru(
  igracId: string,
  tx: DbZaPrekretnicu = baza,
): Promise<boolean> {
  return pokusajOstvaritiPrekretnicu(igracId, KLJUC_PREKRETNICE_PRVA_IGRA, tx);
}
