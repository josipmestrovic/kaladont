/**
 * Red čekanja u memoriji - sučelje strategije uparivanja (ADR-008: MVP = prva 4).
 */
export interface StavkaReda {
  igracId: string;
  nadimak: string;
  avatarId: number;
  odigrane: number;
  pobjede: number;
  bodoviUkupno: number;
  usaoU: number;
}

export interface StrategijaUparivanja {
  /** Vraća 4 igrača za novi stol kad je red spreman, inače null. */
  pokusajSastaviStol(red: readonly StavkaReda[]): StavkaReda[] | null;
}

/** MVP strategija: prva četvorica koja su ušla u red. */
export const prvaCetvorica: StrategijaUparivanja = {
  pokusajSastaviStol(red) {
    if (red.length < 4) return null;
    return red.slice(0, 4);
  },
};

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
