/** Tipovi i predlošci za trajni sandučic (mailbox) igrača. */

export const TIP_SANDUCIC_TEST = 'test' as const;
export const TIP_SANDUCIC_DOBRODOSLICA = 'dobrodoslica' as const;
export const TIP_SANDUCIC_EMAIL_POTVRDEN = 'email_potvrden' as const;
export const TIP_SANDUCIC_PRVA_IGRA = 'prva_igra' as const;
export const TIP_SANDUCIC_FEEDBACK = 'feedback' as const;
export const TIP_SANDUCIC_PRIJAVA_RIJEC_DODANA = 'prijava_rijec_dodana' as const;
export const TIP_SANDUCIC_PRIJAVA_RIJEC_UKLONJENA = 'prijava_rijec_uklonjena' as const;
export const TIP_SANDUCIC_PRIJAVA_IGRACA_UVAZENA = 'prijava_igraca_uvazena' as const;

export const KLJUC_PREKRETNICE_PRVA_IGRA = 'prva_igra' as const;

export type TipSanducicPoruke =
  | typeof TIP_SANDUCIC_TEST
  | typeof TIP_SANDUCIC_DOBRODOSLICA
  | typeof TIP_SANDUCIC_EMAIL_POTVRDEN
  | typeof TIP_SANDUCIC_PRVA_IGRA
  | typeof TIP_SANDUCIC_FEEDBACK
  | typeof TIP_SANDUCIC_PRIJAVA_RIJEC_DODANA
  | typeof TIP_SANDUCIC_PRIJAVA_RIJEC_UKLONJENA
  | typeof TIP_SANDUCIC_PRIJAVA_IGRACA_UVAZENA
  | (string & {});

export interface SanducicPorukaSazetak {
  id: string;
  tip: string;
  naslov: string;
  stvorenaAt: string;
  procitano: boolean;
}

export interface SanducicPorukaDetalj extends SanducicPorukaSazetak {
  tekst: string;
  podaci: Record<string, unknown>;
  poveznica: string | null;
}

export interface SanducicSazetakOdgovor {
  ok: true;
  brojNeprocitanih: number;
  zaNajavu: SanducicPorukaSazetak[];
}

export interface SanducicPromjena {
  /** Signal da klijent osvježi sažetak; bez privatnog sadržaja. */
  razlog: 'nova' | 'stanje';
}

export function hrvatskiBrojObavijesti(n: number): string {
  if (n === 1) return '1 novu obavijest';
  if (n >= 2 && n <= 4) return `${n} nove obavijesti`;
  return `${n} novih obavijesti`;
}

export function tekstSanducicToasta(broj: number): string {
  return `Imaš ${hrvatskiBrojObavijesti(broj)}.`;
}

export function tekstZavrsnogSazetka(broj: number): string {
  return `Imaš ${hrvatskiBrojObavijesti(broj)}`;
}

function tekstPolje(podaci: Record<string, unknown>, kljuc: string): string {
  const vrijednost = podaci[kljuc];
  return typeof vrijednost === 'string' ? vrijednost : '';
}

type Predlozak = {
  naslov: string;
  tekst: (podaci: Record<string, unknown>) => string;
  poveznica: (podaci: Record<string, unknown>) => string | null;
};

const PREDLOSCI: Record<string, Predlozak> = {
  [TIP_SANDUCIC_TEST]: {
    naslov: 'Testna obavijest',
    tekst: (podaci) => (typeof podaci.tekst === 'string' && podaci.tekst.trim()
      ? podaci.tekst
      : 'Ovo je testna poruka sandučica.'),
    poveznica: () => null,
  },
  [TIP_SANDUCIC_DOBRODOSLICA]: {
    naslov: 'Dobrodošao/la u Kaladont!',
    tekst: (podaci) => {
      if (podaci.emailPotvrdjen === true) {
        return 'Hvala na registraciji! Email je potvrđen — možeš igrati. Uživaj! :)';
      }
      const email = tekstPolje(podaci, 'email') || 'tvoju adresu';
      return `Hvala na registraciji! Još samo potvrdi email: ${email}. Pogrešna adresa? Promijeni je ili zatraži novu potvrdu.`;
    },
    poveznica: (podaci) => (podaci.emailPotvrdjen === true ? null : '/potvrdi-email'),
  },
  [TIP_SANDUCIC_EMAIL_POTVRDEN]: {
    naslov: 'Email je potvrđen',
    tekst: () => 'Email je uspješno potvrđen i sada možeš igrati! Uživaj i sretno! :)',
    poveznica: () => null,
  },
  [TIP_SANDUCIC_PRVA_IGRA]: {
    naslov: 'Hvala što igraš!',
    tekst: () => 'Kaladont je u ranom razvoju pa su greške moguće. Podijeli mišljenje i prijavljuj sporne riječi — svaka pomoć nam puno znači! :)',
    poveznica: (podaci) => (podaci.gost === true ? '/registracija' : '/povratne-informacije'),
  },
  [TIP_SANDUCIC_FEEDBACK]: {
    naslov: 'Hvala na mišljenju!',
    tekst: () => 'Hvala što pomažeš poboljšati Kaladont! :)',
    poveznica: () => null,
  },
  [TIP_SANDUCIC_PRIJAVA_RIJEC_DODANA]: {
    naslov: 'Riječ je dodana',
    tekst: (podaci) => {
      const rijec = tekstPolje(podaci, 'rijec') || 'prijavljena riječ';
      return `Riječ „${rijec}” koju si prijavio/la dodana je u rječnik. Hvala na pomoći! :)`;
    },
    poveznica: () => null,
  },
  [TIP_SANDUCIC_PRIJAVA_RIJEC_UKLONJENA]: {
    naslov: 'Riječ je uklonjena',
    tekst: (podaci) => {
      const rijec = tekstPolje(podaci, 'rijec') || 'prijavljena riječ';
      return `Riječ „${rijec}” koju si prijavio/la uklonjena je iz rječnika. Hvala na pomoći! :)`;
    },
    poveznica: () => null,
  },
  [TIP_SANDUCIC_PRIJAVA_IGRACA_UVAZENA]: {
    naslov: 'Prijava je uvažena',
    tekst: (podaci) => (podaci.razlog === 'pogrdan_nadimak'
      ? 'Tvoja prijava za vulgarni nadimak je uvažena. Hvala ti što pomažeš poboljšati Kaladont! :)'
      : 'Tvoja prijava igrača je uvažena. Hvala ti što pomažeš poboljšati Kaladont! :)'),
    poveznica: () => null,
  },
};

export function renderirajSanducicPoruku(
  tip: string,
  podaci: Record<string, unknown> = {},
): { naslov: string; tekst: string; poveznica: string | null } {
  const predlozak = PREDLOSCI[tip] ?? {
    naslov: 'Obavijest',
    tekst: () => 'Nova obavijest u sandučicu.',
    poveznica: () => null,
  };
  return {
    naslov: predlozak.naslov,
    tekst: predlozak.tekst(podaci),
    poveznica: predlozak.poveznica(podaci),
  };
}
