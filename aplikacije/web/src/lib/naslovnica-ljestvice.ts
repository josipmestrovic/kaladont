/**
 * Tekstovi statusa navigacijske stavke Ljestvice (desktop / mobitel).
 */
import {
  putanjaLjestvice,
  REGISTAR_METRIKA_LJESTVICA,
  type MetrikaLjestvice,
  type RazdobljeLjestvice,
  type StatusSazetkaLjestvice,
} from 'zajednicko';

const NAZIV_RAZDOBLJA_PUNI: Record<RazdobljeLjestvice, string> = {
  dnevno: 'dnevnoj',
  tjedno: 'tjednoj',
  mjesecno: 'mjesečnoj',
  godisnje: 'godišnjoj',
  svih_vremena: 'ljestvici svih vremena',
};

const NAZIV_RAZDOBLJA_KRATKI: Record<RazdobljeLjestvice, string> = {
  dnevno: 'dnevno',
  tjedno: 'tjedno',
  mjesecno: 'mjesečno',
  godisnje: 'godišnje',
  svih_vremena: 'svih vremena',
};

const NAZIV_RAZDOBLJA_OVOG: Record<Exclude<RazdobljeLjestvice, 'svih_vremena'>, string> = {
  dnevno: 'ovog dana',
  tjedno: 'ovog tjedna',
  mjesecno: 'ovog mjeseca',
  godisnje: 'ove godine',
};

export function oblikTroboja(broj: number): string {
  const zadnjeDvije = broj % 100;
  const zadnja = broj % 10;
  if (zadnja === 1 && zadnjeDvije !== 11) return 'troboj';
  if (zadnja >= 2 && zadnja <= 4 && (zadnjeDvije < 12 || zadnjeDvije > 14)) return 'troboja';
  return 'troboja';
}

export function oblikEliminacija(broj: number): string {
  const zadnjeDvije = broj % 100;
  const zadnja = broj % 10;
  if (zadnja === 1 && zadnjeDvije !== 11) return 'eliminacija';
  if (zadnja >= 2 && zadnja <= 4 && (zadnjeDvije < 12 || zadnjeDvije > 14)) return 'eliminacije';
  return 'eliminacija';
}

export interface TekstSazetkaLjestvice {
  kratki: string;
  puni: string;
  aria: string;
  href: string;
}

function tekstRangiranog(metrika: MetrikaLjestvice, mjesto: number, razdoblje: RazdobljeLjestvice | null): TekstSazetkaLjestvice {
  const href = putanjaLjestvice(metrika, razdoblje);
  if (metrika === 'kolekcija') {
    return {
      kratki: `${mjesto}. među kolekcionarima`,
      puni: `${mjesto}. među kolekcionarima`,
      aria: `Trenutno si ${mjesto}. među kolekcionarima`,
      href,
    };
  }
  if (metrika === 'izazovi') {
    return {
      kratki: `${mjesto}. među izazivačima`,
      puni: `${mjesto}. među izazivačima`,
      aria: `Trenutno si ${mjesto}. među izazivačima`,
      href,
    };
  }
  if (metrika === 'iskustvo') {
    return {
      kratki: `${mjesto}. po iskustvu`,
      puni: `${mjesto}. po iskustvu`,
      aria: `Trenutno si ${mjesto}. po iskustvu`,
      href,
    };
  }
  if (metrika === 'dostignuca') {
    return {
      kratki: `${mjesto}. po dostignućima`,
      puni: `${mjesto}. po dostignućima`,
      aria: `Trenutno si ${mjesto}. po dostignućima`,
      href,
    };
  }
  if (metrika === 'najbrzi_igraci' && razdoblje && razdoblje !== 'svih_vremena') {
    const ovog = NAZIV_RAZDOBLJA_OVOG[razdoblje];
    return {
      kratki: `${mjesto}. najbrži · ${NAZIV_RAZDOBLJA_KRATKI[razdoblje]}`,
      puni: `${mjesto}. najbrži igrač ${ovog}`,
      aria: `Trenutno si ${mjesto}. najbrži igrač ${ovog}`,
      href,
    };
  }
  if (metrika === 'niz_rijeci' && razdoblje) {
    return {
      kratki: `${mjesto}. ${NAZIV_RAZDOBLJA_KRATKI[razdoblje]} · Niz riječi`,
      puni: `${mjesto}. ${NAZIV_RAZDOBLJA_KRATKI[razdoblje]} · Niz riječi`,
      aria: `Trenutno si ${mjesto}. na ${NAZIV_RAZDOBLJA_PUNI[razdoblje]} ljestvici niza riječi`,
      href,
    };
  }
  if (metrika === 'niz_pobjeda' && razdoblje) {
    return {
      kratki: `${mjesto}. ${NAZIV_RAZDOBLJA_KRATKI[razdoblje]} · Niz pobjeda`,
      puni: `Trenutno si ${mjesto}. na ${NAZIV_RAZDOBLJA_PUNI[razdoblje]} ljestvici niza pobjeda`,
      aria: `Trenutno si ${mjesto}. na ${NAZIV_RAZDOBLJA_PUNI[razdoblje]} ljestvici niza pobjeda`,
      href,
    };
  }
  if (razdoblje) {
    return {
      kratki: `${mjesto}. ${NAZIV_RAZDOBLJA_KRATKI[razdoblje]}`,
      puni: `Trenutno si ${mjesto}. na ${NAZIV_RAZDOBLJA_PUNI[razdoblje]}`,
      aria: `Trenutno si ${mjesto}. na ${NAZIV_RAZDOBLJA_PUNI[razdoblje]} ljestvici`,
      href,
    };
  }
  const naziv = REGISTAR_METRIKA_LJESTVICA[metrika].naziv;
  return {
    kratki: `${mjesto}. · ${naziv}`,
    puni: `${mjesto}. na ljestvici: ${naziv}`,
    aria: `Trenutno si ${mjesto}. na ljestvici ${naziv}`,
    href,
  };
}

export function tekstSazetkaLjestvice(status: StatusSazetkaLjestvice): TekstSazetkaLjestvice | null {
  if (status.vrsta === 'neutralan') return null;

  if (status.vrsta === 'nedostaje') {
    const oblik = oblikTroboja(status.nedostajeIgara);
    const href = putanjaLjestvice(status.metrika, status.razdoblje);
    return {
      kratki: `Još ${status.nedostajeIgara} ${oblik}`,
      puni: `Još ${status.nedostajeIgara} ${oblik} do poretka`,
      aria: `Još ${status.nedostajeIgara} ${oblik} do ulaska u poredak`,
      href,
    };
  }

  if (status.vrsta === 'nema_rezultata') {
    const href = putanjaLjestvice(status.metrika, status.razdoblje);
    if (status.metrika === 'niz_pobjeda') {
      return {
        kratki: 'Za niz treba pobjeda',
        puni: 'Za niz treba pobjeda',
        aria: 'Za ulazak na ljestvicu niza pobjeda treba barem jedna pobjeda',
        href,
      };
    }
    return null;
  }

  return tekstRangiranog(status.metrika, status.mjesto, status.razdoblje);
}
