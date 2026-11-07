/** Kolekcionarske razine — zajednički pragovi za profil, motor i sandučic. */

export const PRAGOVI_KOLEKCIONARSKE_RAZINE = [
  { prag: 0, naziv: 'Početnik' },
  { prag: 10, naziv: 'Prvi koraci' },
  { prag: 25, naziv: 'Sakupljač' },
  { prag: 50, naziv: 'Tragač' },
  { prag: 100, naziv: 'Poznavatelj' },
  { prag: 250, naziv: 'Lovac na riječi' },
  { prag: 500, naziv: 'Kolekcionar' },
  { prag: 1_000, naziv: 'Veliki kolekcionar' },
  { prag: 2_500, naziv: 'Majstor riječi' },
  { prag: 10_000, naziv: 'Legenda rječnika' },
] as const;

export type KolekcionarskaRazina = (typeof PRAGOVI_KOLEKCIONARSKE_RAZINE)[number];

export function kolekcionarskaRazina(ukupnoOtkljucano: number): KolekcionarskaRazina {
  let trenutna: KolekcionarskaRazina = PRAGOVI_KOLEKCIONARSKE_RAZINE[0]!;
  for (const prag of PRAGOVI_KOLEKCIONARSKE_RAZINE) {
    if (ukupnoOtkljucano >= prag.prag) trenutna = prag;
  }
  return trenutna;
}

/** Pragovi (isključujući 0) koje je igrač novo dosegao između prije i poslije. */
export function noviKolekcionarskiPragovi(brojPrije: number, brojPoslije: number): KolekcionarskaRazina[] {
  if (brojPoslije <= brojPrije) return [];
  return PRAGOVI_KOLEKCIONARSKE_RAZINE.filter(
    (prag) => prag.prag > 0 && brojPrije < prag.prag && brojPoslije >= prag.prag,
  );
}
