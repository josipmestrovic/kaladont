/** Tipovi i predlošci za trajni sandučic (mailbox) igrača. */

export const TIP_SANDUCIC_TEST = 'test' as const;

export type TipSanducicPoruke = typeof TIP_SANDUCIC_TEST | (string & {});

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
