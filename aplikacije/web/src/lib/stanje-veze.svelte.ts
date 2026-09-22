export type StanjeVeze = 'nepoznato' | 'spremno' | 'prekid' | 'ponovno_spajanje' | 'sesija_istekla' | 'druga_kartica' | 'rucno_iskljuceno';

export interface StanjeSocketVeze {
  stanje: StanjeVeze;
  kod: string | null;
  poruka: string | null;
  brojPokusaja: number;
  zadnjaPromjenaMs: number;
  partijaNedostupna: boolean;
}

export const stanjeVeze = $state<StanjeSocketVeze>({
  stanje: 'nepoznato',
  kod: null,
  poruka: null,
  brojPokusaja: 0,
  zadnjaPromjenaMs: Date.now(),
  partijaNedostupna: false,
});

export function postaviStanjeVeze(stanje: StanjeVeze, kod: string | null = null, poruka: string | null = null): void {
  stanjeVeze.stanje = stanje;
  stanjeVeze.kod = kod;
  stanjeVeze.poruka = poruka;
  stanjeVeze.zadnjaPromjenaMs = Date.now();
}

export function dohvatiStanjeVeze(): StanjeSocketVeze {
  return stanjeVeze;
}

export function oznaciPartijuDostupnom(): void {
  stanjeVeze.partijaNedostupna = false;
}
