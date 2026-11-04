export type VrstaPohvaleIgre = 'najduzi_niz' | 'najvise_xp';

export type PohvalaIgre = {
  vrsta: VrstaPohvaleIgre;
  vrijednost: number;
  dijeljenoPrvoMjesto: boolean;
};

export type SudionikZaPohvalu = {
  igracId: string;
  upravljac: 'covjek' | 'bot';
  najduziStreak: number;
  finalniBrutoXp: number;
};

export type PohvalePoIgracu = Map<string, PohvalaIgre[]>;

function metrika(sudionik: SudionikZaPohvalu, vrsta: VrstaPohvaleIgre): number {
  return vrsta === 'najduzi_niz' ? sudionik.najduziStreak : sudionik.finalniBrutoXp;
}

type PobjednikPohvale = PohvalaIgre & { igracId: string };

function odrediPobjednikeZaVrstu(
  sudionici: readonly SudionikZaPohvalu[],
  vrsta: VrstaPohvaleIgre,
): PobjednikPohvale[] {
  if (sudionici.length === 0) return [];
  if (!sudionici.some((s) => s.upravljac === 'covjek')) return [];

  const maksimum = Math.max(...sudionici.map((s) => metrika(s, vrsta)));
  if (maksimum <= 0) return [];

  const naVrhu = sudionici.filter((s) => metrika(s, vrsta) === maksimum);
  const ljudi = naVrhu.filter((s) => s.upravljac === 'covjek');
  if (ljudi.length === 0) return [];

  const dijeljenoPrvoMjesto = naVrhu.length > 1;
  return ljudi.map((s) => ({
    igracId: s.igracId,
    vrsta,
    vrijednost: maksimum,
    dijeljenoPrvoMjesto,
  }));
}

/** Deterministički određuje usporedne pohvale za javnu igru. Botovi ulaze u max, nagrada ide samo ljudima. */
export function odrediPohvaleIgre(sudionici: readonly SudionikZaPohvalu[]): PohvalePoIgracu {
  const rezultat: PohvalePoIgracu = new Map();
  const dodaj = (pobjede: ReturnType<typeof odrediPobjednikeZaVrstu>) => {
    for (const p of pobjede) {
      const postojece = rezultat.get(p.igracId) ?? [];
      postojece.push({
        vrsta: p.vrsta,
        vrijednost: p.vrijednost,
        dijeljenoPrvoMjesto: p.dijeljenoPrvoMjesto,
      });
      rezultat.set(p.igracId, postojece);
    }
  };

  dodaj(odrediPobjednikeZaVrstu(sudionici, 'najduzi_niz'));
  dodaj(odrediPobjednikeZaVrstu(sudionici, 'najvise_xp'));
  return rezultat;
}
