/**
 * Cooperative raspoređivač za botov odabir (Botovi V8 commit 02).
 * Jedan pump, zajednički budžet; početak i predaja između blokova = setImmediate (ne microtask),
 * kako bi Socket.IO mogao flushati potez:prihvacen/stanje prije CPU-a odabira.
 */

/** Pregledani zapisi rječnika između predaja kontrole. */
export const CHECKPOINT_ZAPISA = 256;

/** Ciljani CPU budžet jednog pump bloka (ms); nije real-time jamstvo. */
export const BUDZET_BLOKA_MS = 5;

export function predajSetImmediate(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

export type PosaoPumpa = {
  id: number;
  korak: () => Promise<'nastavi' | 'gotovo' | 'odustani'>;
};

/**
 * Jedan zajednički pump za sve aktivne bot-poslove.
 * Round-robin; nakon budžeta ili CHECKPOINT-a vraća kontrolu event loopu.
 */
export class RasporedjivacOdziva {
  private readonly red: PosaoPumpa[] = [];
  private pumpAktivan = false;
  private generacija = 0;
  private readonly predaj: () => Promise<void>;
  private readonly sada: () => number;

  constructor(opcije: { predaj?: () => Promise<void>; sada?: () => number } = {}) {
    this.predaj = opcije.predaj ?? predajSetImmediate;
    this.sada = opcije.sada ?? Date.now;
  }

  /** Registrira posao; vraća id za otkazivanje. */
  prijavi(korak: PosaoPumpa['korak']): number {
    const id = ++this.generacija;
    this.red.push({ id, korak });
    this.pokreniPump();
    return id;
  }

  otkazi(id: number): void {
    const i = this.red.findIndex((p) => p.id === id);
    if (i >= 0) this.red.splice(i, 1);
  }

  brojAktivnih(): number {
    return this.red.length;
  }

  private pokreniPump(): void {
    if (this.pumpAktivan) return;
    // Označi aktivnim prije setImmediate — drugi prijavi ne zakazuje drugi pump.
    this.pumpAktivan = true;
    // Macrotask: prijavi() samo enqueua; prvi korak / odabir kreće tek nakon predaje event loopu.
    setImmediate(() => {
      void this.pump();
    });
  }

  private async pump(): Promise<void> {
    try {
      while (this.red.length > 0) {
        const pocetak = this.sada();
        let i = 0;
        while (i < this.red.length) {
          const posao = this.red[i]!;
          let ishod: 'nastavi' | 'gotovo' | 'odustani';
          try {
            ishod = await posao.korak();
          } catch {
            ishod = 'odustani';
          }
          // Nakon awaita indeks može biti pomaknut (otkazi drugog/ovog posla).
          const josIndex = this.red.findIndex((p) => p.id === posao.id);
          if (josIndex < 0) {
            // Već uklonjen tijekom koraka — ne spliceaj sljedeći posao.
            continue;
          }
          if (ishod !== 'nastavi') {
            this.red.splice(josIndex, 1);
            i = josIndex;
            continue;
          }
          i = josIndex + 1;
          // Jedan korak po poslu pa predaja ako je budžet potrošen (ili sat ne napreduje).
          if (this.sada() - pocetak >= BUDZET_BLOKA_MS) break;
        }
        if (this.red.length > 0) await this.predaj();
      }
    } finally {
      this.pumpAktivan = false;
      if (this.red.length > 0) this.pokreniPump();
    }
  }
}
