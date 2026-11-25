/** Pomoćne funkcije za prikaz stranice Misije (bez side-effecta). */
import type { MisijaDto, StanjeMisijaDto, VrstaMisije } from 'zajednicko';

export type BrojacMisija = { zavrseno: number; ukupno: number };

function jeNedovrsena(misija: MisijaDto): boolean {
  return misija.status === 'aktivna';
}

/** Zbroj XP nagrada aktivnih nedovršenih misija. */
export function dostupniXp(stanje: StanjeMisijaDto): number {
  const dnevne = stanje.dnevne.aktivne.filter(jeNedovrsena).reduce((s, m) => s + m.xpNagrada, 0);
  const tjedne = stanje.tjedne.misije.filter(jeNedovrsena).reduce((s, m) => s + m.xpNagrada, 0);
  return dnevne + tjedne;
}

/**
 * Danas završeno / (dovršene danas + aktivne), uz min. nazivnik 1
 * kad nema ništa (prazan dan čeka ponoć → 0/1).
 */
export function dnevniBrojac(stanje: StanjeMisijaDto): BrojacMisija {
  const zavrseno = stanje.dnevne.danasDovrsene.length;
  const aktivne = stanje.dnevne.aktivne.length;
  return { zavrseno, ukupno: Math.max(1, zavrseno + aktivne) };
}

/** Dovršene tjedne / 3. */
export function tjedniBrojac(stanje: StanjeMisijaDto): BrojacMisija {
  const zavrseno = stanje.tjedne.misije.filter((m) => m.status === 'dovrsena').length;
  return { zavrseno, ukupno: 3 };
}

export function formatirajXp(n: number): string {
  return n.toLocaleString('hr-HR');
}

export function oznakaVrsteMisije(vrsta: VrstaMisije): string {
  return vrsta === 'dnevna' ? 'DNEVNA' : 'TJEDNA';
}

/** Hrvatska gramatika za preostale zamjene (0–1 u praksi). */
export function tekstZamjenaPreostalo(preostalo: number): string {
  if (preostalo <= 0) return 'Nema dostupnih zamjena';
  if (preostalo === 1) return 'Dostupna 1 zamjena';
  return `Dostupne ${preostalo} zamjene`;
}

/**
 * Relativno vrijeme do budućeg ISO trenutka (HR).
 * Primjeri: „za manje od minute”, „za 9 h 10 min”, „za 4 dana i 9 sati”.
 */
export function relativnoDo(iso: string, sada = new Date()): string {
  const cilj = new Date(iso);
  if (Number.isNaN(cilj.getTime())) return iso;

  const ms = cilj.getTime() - sada.getTime();
  if (ms <= 0) return 'za manje od minute';

  const ukupnoMin = Math.floor(ms / 60_000);
  if (ukupnoMin < 1) return 'za manje od minute';

  const dani = Math.floor(ukupnoMin / (60 * 24));
  const sati = Math.floor((ukupnoMin % (60 * 24)) / 60);
  const minute = ukupnoMin % 60;

  if (dani >= 1) {
    const danTekst = dani === 1 ? '1 dan' : `${dani} dana`;
    if (sati <= 0) return `za ${danTekst}`;
    const satTekst = sati === 1 ? '1 sat' : sati >= 2 && sati <= 4 ? `${sati} sata` : `${sati} sati`;
    return `za ${danTekst} i ${satTekst}`;
  }

  if (sati >= 1) {
    if (minute <= 0) {
      if (sati === 1) return 'za 1 h';
      return `za ${sati} h`;
    }
    return `za ${sati} h ${minute} min`;
  }

  return `za ${minute} min`;
}

export function tekstSlobodnihMjesta(broj: number): string {
  if (broj <= 0) return '0 slobodnih mjesta';
  if (broj === 1) return '1 slobodno mjesto';
  if (broj >= 2 && broj <= 4) return `${broj} slobodna mjesta`;
  return `${broj} slobodnih mjesta`;
}
