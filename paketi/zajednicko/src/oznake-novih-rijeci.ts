import type { TierDuljineIskustva, TierRijetkostiIskustva } from './iskustvo.js';
import { osnovnaRijecIzGrupe } from './pravila.js';

export interface OznakeNoveRijeci {
  osnovnaRijec: string;
  /** Oblik koji je otključao stavku; null ako je jednak osnovnoj riječi. */
  odigraniOblik: string | null;
  duljina: TierDuljineIskustva | null;
  rijetkost: TierRijetkostiIskustva | null;
}

export interface UlazOtkljucanjaZaOznake {
  grupa: string;
  odigraniOblik: string;
  duljina: TierDuljineIskustva | null;
  rijetkost: TierRijetkostiIskustva | null;
}

export function nazivOznakeDuljine(tier: TierDuljineIskustva | null | undefined): string | null {
  if (tier === 'jako_duga') return 'Jako duga riječ';
  if (tier === 'srednje_duga') return 'Srednje duga riječ';
  if (tier === 'duga') return 'Duga riječ';
  return null;
}

export function nazivOznakeRijetkosti(tier: TierRijetkostiIskustva | null | undefined): string | null {
  if (tier === 'jako_rijetka') return 'Jako rijetka riječ';
  if (tier === 'srednje_rijetka') return 'Srednje rijetka riječ';
  if (tier === 'rijetka') return 'Rijetka riječ';
  return null;
}

/**
 * Projekcija oznaka za završni modal: jedna stavka po osnovnoj riječi,
 * first-wins prema redoslijedu ulaza (prvi oblik koji je otključao).
 */
export function projektirajOznakeNovihRijeci(ulazi: readonly UlazOtkljucanjaZaOznake[]): OznakeNoveRijeci[] {
  const vidjene = new Set<string>();
  const rezultat: OznakeNoveRijeci[] = [];
  for (const ulaz of ulazi) {
    const osnovnaRijec = osnovnaRijecIzGrupe(ulaz.grupa);
    if (vidjene.has(osnovnaRijec)) continue;
    vidjene.add(osnovnaRijec);
    const oblik = ulaz.odigraniOblik;
    rezultat.push({
      osnovnaRijec,
      odigraniOblik: oblik && oblik !== osnovnaRijec ? oblik : null,
      duljina: ulaz.duljina,
      rijetkost: ulaz.rijetkost,
    });
  }
  return rezultat;
}
