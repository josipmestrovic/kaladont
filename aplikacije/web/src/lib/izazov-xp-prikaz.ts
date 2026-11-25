/**
 * Normalizacija XP-a za završni ekran Izazova.
 * Word XP je u mojeIskustvo; ukupnoIskustvo.ukupnoXpStvarno = challenge + misije (ne word).
 */
import type { KrajPartije, StanjeIskustva, UkupnoIskustvoIshoda } from 'zajednicko';

export type IzazovXpPrikaz = {
  xpIgre: number;
  xpIzazova: number;
  xpIzazovaNominal: number;
  xpMisija: number;
  xpMisijaNominal: number;
  ukupno: number;
  /** Konačni snapshot nakon svih potvrđenih nagrada; null ako nije pouzdan. */
  konacno: StanjeIskustva | null;
  prije: StanjeIskustva | null;
  pending: boolean;
  firstCompletion: boolean | null;
};

export function izazovXpPrikaz(kraj: KrajPartije): IzazovXpPrikaz {
  const settlement = kraj.izazovSettlement ?? null;
  const pending = settlement?.settlementState === 'spremanje_u_tijeku';

  const xpIgre = Math.max(0, kraj.mojeIskustvo?.osvojenoIskustvo ?? 0);

  const xpIzazova = Math.max(0, settlement?.challengeXp.awarded ?? 0);
  const xpIzazovaNominal = Math.max(0, settlement?.challengeXp.nominal ?? 0);

  // Misije: settlement.awarded ili ukupno.misijski — jedan put (isti iznos).
  const xpMisijaSettlement = settlement?.missionXp.awarded;
  const xpMisijaUkupno = kraj.ukupnoIskustvo?.misijskiXpStvarno;
  const xpMisija =
    xpMisijaSettlement != null && xpMisijaSettlement > 0
      ? xpMisijaSettlement
      : Math.max(0, xpMisijaUkupno ?? 0);
  const xpMisijaNominal = Math.max(
    0,
    settlement?.missionXp.nominal ?? kraj.ukupnoIskustvo?.misijskiXpNominalno ?? 0,
  );

  const ukupno = xpIgre + xpIzazova + xpMisija;

  const ukupnoIskustvo: UkupnoIskustvoIshoda | null | undefined = kraj.ukupnoIskustvo;
  const konacno = ukupnoIskustvo?.poslije ?? null;
  const prije = ukupnoIskustvo?.prije ?? kraj.mojeIskustvo?.prije ?? null;

  return {
    xpIgre,
    xpIzazova,
    xpIzazovaNominal,
    xpMisija,
    xpMisijaNominal,
    ukupno,
    konacno,
    prije,
    pending,
    firstCompletion: settlement ? settlement.firstCompletion : null,
  };
}
