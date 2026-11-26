/**
 * Tekstovi statusa navigacijske stavke Ljestvice (ispod naslova, kao opis ostalih kartica).
 */
import {
  putanjaLjestvice,
  REGISTAR_METRIKA_LJESTVICA,
  type MetrikaLjestvice,
  type RazdobljeLjestvice,
  type StatusSazetkaLjestvice,
} from 'zajednicko';

const NAZIV_RAZDOBLJA_KRATKI: Record<RazdobljeLjestvice, string> = {
  dnevno: 'dnevno',
  tjedno: 'tjedno',
  mjesecno: 'mjesečno',
  godisnje: 'godišnje',
  svih_vremena: 'svih vremena',
};

export function oblikTroboja(broj: number): string {
  const zadnjeDvije = broj % 100;
  const zadnja = broj % 10;
  if (zadnja === 1 && zadnjeDvije !== 11) return 'brza igra';
  if (zadnja >= 2 && zadnja <= 4 && (zadnjeDvije < 12 || zadnjeDvije > 14)) return 'brze igre';
  return 'brzih igara';
}

export function oblikEliminacija(broj: number): string {
  const zadnjeDvije = broj % 100;
  const zadnja = broj % 10;
  if (zadnja === 1 && zadnjeDvije !== 11) return 'eliminacija';
  if (zadnja >= 2 && zadnja <= 4 && (zadnjeDvije < 12 || zadnjeDvije > 14)) return 'eliminacije';
  return 'eliminacija';
}

export interface TekstSazetkaLjestvice {
  /** Cijeli red ispod naslova „Ljestvice” (za a11y / testove). */
  opis: string;
  /** Rangirani dio za vizualni naglasak, npr. „1. mjesto”. */
  rang: string;
  /** Ostatak opisa nakon ranga, uključujući „ · ”. */
  ostatak: string;
  aria: string;
  href: string;
}

function opisRangiranog(
  metrika: MetrikaLjestvice,
  mjesto: number,
  razdoblje: RazdobljeLjestvice | null,
): TekstSazetkaLjestvice {
  const href = putanjaLjestvice(metrika, razdoblje);
  const naziv = REGISTAR_METRIKA_LJESTVICA[metrika].naziv;
  const razdobljeDodatak =
    razdoblje && razdoblje !== 'svih_vremena' ? ` · ${NAZIV_RAZDOBLJA_KRATKI[razdoblje]}` : '';
  const rang = `${mjesto}. mjesto`;
  const ostatak = ` · ${naziv}${razdobljeDodatak}`;
  return {
    opis: `${rang}${ostatak}`,
    rang,
    ostatak,
    aria: `Trenutno si ${mjesto}. na ljestvici ${naziv}${razdobljeDodatak}`,
    href,
  };
}

/** Samo rangirani sažetak (najniže mjesto); inače `null` → default opis na kartici. */
export function tekstSazetkaLjestvice(status: StatusSazetkaLjestvice): TekstSazetkaLjestvice | null {
  if (status.vrsta !== 'rangiran') return null;
  return opisRangiranog(status.metrika, status.mjesto, status.razdoblje);
}
