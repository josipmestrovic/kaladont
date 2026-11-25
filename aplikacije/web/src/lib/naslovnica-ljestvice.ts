/**
 * Tekstovi statusa navigacijske stavke Ljestvice (desktop / mobitel).
 */
import type { MetrikaLjestvice, RazdobljeLjestvice, StatusSazetkaLjestvice } from 'zajednicko';

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
}

function oznakaNiza(metrika: MetrikaLjestvice, kratki: boolean): string {
  if (metrika !== 'niz_pobjeda') return '';
  return kratki ? ' · niz' : ' ljestvici niza pobjeda';
}

export function tekstSazetkaLjestvice(status: StatusSazetkaLjestvice): TekstSazetkaLjestvice | null {
  if (status.vrsta === 'neutralan') return null;

  if (status.vrsta === 'nedostaje') {
    const oblik = oblikTroboja(status.nedostajeIgara);
    return {
      kratki: `Još ${status.nedostajeIgara} ${oblik}`,
      puni: `Još ${status.nedostajeIgara} ${oblik} do poretka`,
      aria: `Još ${status.nedostajeIgara} ${oblik} do ulaska u poredak`,
    };
  }

  if (status.vrsta === 'nema_rezultata') {
    if (status.metrika === 'niz_pobjeda') {
      return {
        kratki: 'Za niz treba pobjeda',
        puni: 'Za niz treba pobjeda',
        aria: 'Za ulazak na ljestvicu niza pobjeda treba barem jedna pobjeda',
      };
    }
    return null;
  }

  const razdobljeKratko = NAZIV_RAZDOBLJA_KRATKI[status.razdoblje];
  const razdobljePuno = NAZIV_RAZDOBLJA_PUNI[status.razdoblje];
  const jeNiz = status.metrika === 'niz_pobjeda';

  return {
    kratki: `${status.mjesto}. ${razdobljeKratko}${oznakaNiza(status.metrika, true)}`,
    puni: jeNiz
      ? `Trenutno si ${status.mjesto}. na ${razdobljePuno} ljestvici niza pobjeda`
      : `Trenutno si ${status.mjesto}. na ${razdobljePuno}`,
    aria: jeNiz
      ? `Trenutno si ${status.mjesto}. na ${razdobljePuno} ljestvici niza pobjeda`
      : `Trenutno si ${status.mjesto}. na ${razdobljePuno} ljestvici`,
  };
}
