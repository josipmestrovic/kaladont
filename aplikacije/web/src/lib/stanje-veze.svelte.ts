import type { SpremnostPartije } from './spremnost-partije.js';

export type StanjeVeze = 'nepoznato' | 'spremno' | 'prekid' | 'ponovno_spajanje' | 'sesija_istekla' | 'druga_kartica' | 'rucno_iskljuceno';

export interface StanjeSocketVeze {
  stanje: StanjeVeze;
  kod: string | null;
  poruka: string | null;
  brojPokusaja: number;
  zadnjaPromjenaMs: number;
  partijaNedostupna: boolean;
  /** Banner „Sesija je istekla” nakon oporavka u gosta — odvojeno od stanja veze (spremno). */
  obavijestIstekaSesije: boolean;
  /** #142 D: spremnost partije, odvojeno od socket connect. */
  spremnostPartije: SpremnostPartije;
}

export const stanjeVeze = $state<StanjeSocketVeze>({
  stanje: 'nepoznato',
  kod: null,
  poruka: null,
  brojPokusaja: 0,
  zadnjaPromjenaMs: Date.now(),
  partijaNedostupna: false,
  obavijestIstekaSesije: false,
  spremnostPartije: 'spremna',
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
  if (stanjeVeze.spremnostPartije !== 'sinkronizacija') {
    stanjeVeze.spremnostPartije = 'spremna';
  }
}

export function postaviSpremnostPartije(spremnost: SpremnostPartije): void {
  stanjeVeze.spremnostPartije = spremnost;
  if (spremnost === 'nedostupna') stanjeVeze.partijaNedostupna = true;
  if (spremnost === 'spremna') stanjeVeze.partijaNedostupna = false;
}
