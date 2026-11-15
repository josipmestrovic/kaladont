import type { AvatarConfigV1, PravilnikPartije } from 'zajednicko';

/**
 * Red čekanja u memoriji - sučelje strategije uparivanja (ADR-008: MVP = prva 4).
 */
export interface StavkaReda {
  igracId: string;
  vrsta: 'gost' | 'registriran' | 'admin';
  /** Tko upravlja identitetom; izostanak znači čovjek (ADR-017). */
  upravljac?: 'covjek' | 'bot';
  nadimak: string;
  avatarId: number;
  avatarConfig: AvatarConfigV1 | null;
  avatarRevision: number;
  odigrane: number;
  pobjede: number;
  bodoviUkupno: number;
  odigrane1v1?: number;
  pobjede1v1?: number;
  bodovi1v1?: number;
  odigrane3p?: number;
  pobjede3p?: number;
  bodovi3p?: number;
  /** PR09: univerzalni rang (ne ovisi o modu reda). */
  rangBrojPartija?: number;
  rangSumaJedinica?: number;
  iskustvoUkupno?: number;
  trenutniNiz4p?: number;
  trenutniNiz1v1?: number;
  trenutniNiz3p?: number;
  usaoU: number;
  /** UI odabir pravilnika; izostanak = ka_zna. */
  odabranaPravila?: PravilnikPartije;
}

export interface StrategijaUparivanja {
  /** Vraća igrače za novi stol kad je red spreman, inače null. */
  pokusajSastaviStol(red: readonly StavkaReda[]): StavkaReda[] | null;
}

/** Uzmi prvih N ljudi iz FIFO reda (prioritet ulaska). */
export function prvihN(n: 2 | 3 | 4): StrategijaUparivanja {
  return {
    pokusajSastaviStol(red) {
      if (red.length < n) return null;
      return red.slice(0, n);
    },
  };
}

/** MVP strategija: prva četvorica koja su ušla u red. */
export const prvaCetvorica: StrategijaUparivanja = prvihN(4);

/** 1v1 strategija: prvi par koji je ušao u red. */
export const prviPar: StrategijaUparivanja = prvihN(2);

/** Troboj: prva trojica. */
export const prvaTrojica: StrategijaUparivanja = prvihN(3);

export class RedCekanja {
  private stavke: StavkaReda[] = [];

  constructor(private readonly strategija: StrategijaUparivanja = prvaCetvorica) {}

  udji(stavka: StavkaReda): void {
    if (this.stavke.some((s) => s.igracId === stavka.igracId)) return;
    this.stavke.push(stavka);
  }

  izadji(igracId: string): void {
    this.stavke = this.stavke.filter((s) => s.igracId !== igracId);
  }

  stanje(): readonly StavkaReda[] {
    return this.stavke;
  }

  pokusajSastaviStol(): StavkaReda[] | null {
    const stol = this.strategija.pokusajSastaviStol(this.stavke);
    if (stol) {
      const idovi = new Set(stol.map((s) => s.igracId));
      this.stavke = this.stavke.filter((s) => !idovi.has(s.igracId));
    }
    return stol;
  }
}
