/**
 * Sažetak bot analitike na kraju igre — samo stvarno evidentirane eliminacije.
 * Fiktivni unos u `eliminirani` (rani stop / završni plasman) ne ulazi u brojače.
 */
import type { RazlogEliminacije } from 'zajednicko';
import type { BrojaciEliminacijaAnalitike } from '../baza/shema.js';
import type { SnimkaBotovaPocetka, VrstaPobjednikaAnalitike } from './igre.js';

export type RazlogEliminacijeAnalitike = keyof BrojaciEliminacijaAnalitike;

export function prazniBrojaciEliminacijaSazetak(): BrojaciEliminacijaAnalitike {
  return {
    ne_znam: 0,
    istek: 0,
    mrtva_slova: 0,
    prekid: 0,
    kaladont: 0,
    nepoznato: 0,
  };
}

/** Mapira kanonski razlog eliminacije u JSONB brojač; bez izmišljanja mrtvih slova. */
export function mapirajRazlogEliminacijeZaAnalitiku(
  razlog: RazlogEliminacije,
): RazlogEliminacijeAnalitike {
  if (razlog === 'ne_znam' || razlog === 'istek' || razlog === 'prekid' || razlog === 'kaladont') {
    return razlog;
  }
  if (razlog === 'mrtva_slova_baza' || razlog === 'mrtva_slova_iskoristeno') {
    return 'mrtva_slova';
  }
  return 'nepoznato';
}

export interface UlazSazetkaBotAnalitike {
  ishod: 'zavrsena' | 'prekinuta' | 'nepotpuno';
  analitikaBotSnimka: SnimkaBotovaPocetka;
  aktivni: ReadonlySet<string> | Iterable<string>;
  sudionici: readonly { igracId: string; upravljac: string }[];
  /** Samo stvarne eliminacije — ne fiktivni plasmani iz `sabijPreostaleZaRaniStop`. */
  razloziEliminacije: ReadonlyMap<string, RazlogEliminacije>;
}

export function sazetakBotAnalitikeIzStanja(ulaz: UlazSazetkaBotAnalitike) {
  const eliminacijeLjudi = prazniBrojaciEliminacijaSazetak();
  const eliminacijeBotova = prazniBrojaciEliminacijaSazetak();

  for (const [igracId, razlog] of ulaz.razloziEliminacije) {
    const sudionik = ulaz.sudionici.find((s) => s.igracId === igracId);
    if (!sudionik) continue;
    const brojac = sudionik.upravljac === 'bot' ? eliminacijeBotova : eliminacijeLjudi;
    brojac[mapirajRazlogEliminacijeZaAnalitiku(razlog)] += 1;
  }

  let vrstaPobjednika: VrstaPobjednikaAnalitike | null = null;
  if (ulaz.ishod === 'zavrsena') {
    const pobjednikId = [...ulaz.aktivni][0];
    const pobjednik = pobjednikId
      ? ulaz.sudionici.find((s) => s.igracId === pobjednikId)
      : undefined;
    if (pobjednik?.upravljac === 'bot' || pobjednik?.upravljac === 'covjek') {
      vrstaPobjednika = pobjednik.upravljac;
    }
  }

  return {
    botovi: ulaz.analitikaBotSnimka,
    vrstaPobjednika,
    eliminacijeLjudi,
    eliminacijeBotova,
  };
}
