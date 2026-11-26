/** Formatiranje XP sažetka na naslovnici. */
import type { ProfilIskustvo } from '$lib/profil-resurs.js';

const formatBroja = new Intl.NumberFormat('hr-HR');

export type PrikazXpSazetka =
  | { vrsta: 'neutralan'; natpis: string }
  | {
      vrsta: 'napredak';
      rang: string;
      razina: number;
      uRaziniTekst: string;
      doIduceTekst: string | null;
      postotak: number | null;
      maksimalna: boolean;
    };

/** Jedinstveni CTA tekst za gosta na naslovnici. */
export function tekstRegistracijeGosta(): string {
  return 'Sačuvaj napredak.';
}

export function gostImaXp(iskustvo: ProfilIskustvo | undefined): boolean {
  if (!iskustvo) return false;
  return (
    (Number.isFinite(iskustvo.ukupno) && iskustvo.ukupno > 0) ||
    (Number.isFinite(iskustvo.uRazini) && iskustvo.uRazini > 0)
  );
}

export function postotakXpTrake(iskustvo: ProfilIskustvo): number | null {
  if (iskustvo.doIduce === null) return 100;
  if (!(iskustvo.doIduce > 0)) return null;
  return Math.min(100, Math.max(0, (100 * iskustvo.uRazini) / iskustvo.doIduce));
}

export function izracunajPrikazXp(
  profil: { rang: string | null; iskustvo?: ProfilIskustvo } | null,
  status: 'prazno' | 'ucitavanje' | 'spreman' | 'greska',
): PrikazXpSazetka {
  if (!profil?.iskustvo || status === 'prazno' || status === 'ucitavanje' || status === 'greska') {
    return { vrsta: 'neutralan', natpis: 'Moj napredak' };
  }

  const iskustvo = profil.iskustvo;
  if (
    typeof iskustvo.razina !== 'number' ||
    !Number.isFinite(iskustvo.razina) ||
    typeof iskustvo.uRazini !== 'number' ||
    !Number.isFinite(iskustvo.uRazini)
  ) {
    return { vrsta: 'neutralan', natpis: 'Moj napredak' };
  }

  const maksimalna = iskustvo.doIduce === null;
  const postotak = postotakXpTrake(iskustvo);

  return {
    vrsta: 'napredak',
    rang: profil.rang?.trim() || 'Piskaralo',
    razina: iskustvo.razina,
    uRaziniTekst: formatBroja.format(iskustvo.uRazini),
    doIduceTekst: maksimalna || iskustvo.doIduce === null ? null : formatBroja.format(iskustvo.doIduce),
    postotak,
    maksimalna,
  };
}
