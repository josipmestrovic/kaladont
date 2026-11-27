/**
 * Cooperative raspoređivač za botov odabir (Botovi V8 commit 03).
 * Jedan pump, zajednički CPU budžet, stvarni round-robin sliceova.
 * Početak pumpa i predaja event loopu = setImmediate (ne microtask).
 * ctx.predaj() parkira posao i prepušta sljedeći u redu — ne samo event loop.
 */

import { performance } from 'node:perf_hooks';

/** Pregledani zapisi repertoara/rječnika između predaja kontrole. */
export const CHECKPOINT_ZAPISA = 256;

/** Ciljani zajednički CPU budžet jednog pump bloka (ms); nije real-time jamstvo. */
export const BUDZET_BLOKA_MS = 5;

/** Ciljani budžet jednog posla prije forsiranog predaj (ms); checkpoint i dalje po zapisima. */
export const BUDZET_SLICE_MS = 2;

export function predajSetImmediate(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

export type KontekstPosla = {
  /** Parkira posao i prepušta raspoređivaču; nastavlja kad ponovno dođe na red. */
  predaj: () => Promise<void>;
};

export type RunPosla = (ctx: KontekstPosla) => Promise<'gotovo' | 'odustani'>;

type PosaoPumpa = {
  id: number;
  run: RunPosla;
  pokrenut: boolean;
  otkazan: boolean;
  /** Resolve za nastavak nakon parkiranog predaj. */
  nastaviPark: (() => void) | null;
  /** Resolve kad slice završi (predaj pozvan) — signal pumpi. */
  krajSlicea: (() => void) | null;
  /** Promise završetka run-a. */
  zavrsetak: Promise<'gotovo' | 'odustani'> | null;
};

/**
 * Jedan zajednički pump za sve aktivne bot-poslove.
 * Round-robin po sliceovima; nakon zajedničkog budžeta vraća kontrolu event loopu.
 */
export class RasporedjivacOdziva {
  private readonly red: PosaoPumpa[] = [];
  private pumpAktivan = false;
  private generacija = 0;
  private readonly predajEventLoop: () => Promise<void>;
  private readonly sada: () => number;

  constructor(opcije: { predaj?: () => Promise<void>; sada?: () => number } = {}) {
    this.predajEventLoop = opcije.predaj ?? predajSetImmediate;
    this.sada = opcije.sada ?? (() => performance.now());
  }

  /** Registrira posao; vraća id za otkazivanje. */
  prijavi(run: RunPosla): number {
    const id = ++this.generacija;
    this.red.push({
      id,
      run,
      pokrenut: false,
      otkazan: false,
      nastaviPark: null,
      krajSlicea: null,
      zavrsetak: null,
    });
    this.pokreniPump();
    return id;
  }

  otkazi(id: number): void {
    const i = this.red.findIndex((p) => p.id === id);
    if (i < 0) return;
    const posao = this.red[i]!;
    posao.otkazan = true;
    this.red.splice(i, 1);
    // Odblokiraj parkirani predaj da Promise ne curi; run treba završiti preko aktivan()/gotovo.
    const nastavi = posao.nastaviPark;
    posao.nastaviPark = null;
    if (nastavi) nastavi();
    // Ako čekamo slice signal a job je otkazan prije predaj — odblokiraj race.
    const kraj = posao.krajSlicea;
    posao.krajSlicea = null;
    if (kraj) kraj();
  }

  brojAktivnih(): number {
    return this.red.length;
  }

  private pokreniPump(): void {
    if (this.pumpAktivan) return;
    this.pumpAktivan = true;
    setImmediate(() => {
      void this.pump();
    });
  }

  private izradiKontekst(posao: PosaoPumpa): KontekstPosla {
    return {
      predaj: () => {
        if (posao.otkazan) return Promise.resolve();
        return new Promise<void>((resolve) => {
          posao.nastaviPark = resolve;
          const kraj = posao.krajSlicea;
          posao.krajSlicea = null;
          if (kraj) kraj();
        });
      },
    };
  }

  private async izvrsiSlice(posao: PosaoPumpa): Promise<'gotovo' | 'odustani' | 'nastavi'> {
    if (posao.otkazan) return 'odustani';

    if (!posao.pokrenut) {
      posao.pokrenut = true;
      const ctx = this.izradiKontekst(posao);
      // Završetak se rješava kroz zavrsetak Promise (ne kroz krajSlicea) —
      // inače race može proglasiti 'slice' i ostaviti gotov posao u redu.
      posao.zavrsetak = Promise.resolve()
        .then(() => posao.run(ctx))
        .catch(() => 'odustani' as const);
    } else if (posao.nastaviPark) {
      const nastavi = posao.nastaviPark;
      posao.nastaviPark = null;
      nastavi();
    } else if (posao.zavrsetak) {
      // Još radi sinkrono unutar slicea — čekaj završetak ili sljedeći predaj.
    } else {
      return 'odustani';
    }

    const slicePromise = new Promise<void>((resolve) => {
      posao.krajSlicea = resolve;
    });

    const zavrsetak = posao.zavrsetak!;
    const pobjednik = await Promise.race([
      zavrsetak.then((ishod) => ({ vrsta: 'gotovo' as const, ishod })),
      slicePromise.then(() => ({ vrsta: 'slice' as const })),
    ]);

    if (pobjednik.vrsta === 'gotovo') {
      posao.krajSlicea = null;
      return pobjednik.ishod === 'gotovo' ? 'gotovo' : 'odustani';
    }
    // Slice signal — ako je run već gotov u istom ticku, preferiraj završetak.
    const odmah = await Promise.race([
      zavrsetak.then((ishod) => ({ vrsta: 'gotovo' as const, ishod })),
      Promise.resolve({ vrsta: 'slice' as const }),
    ]);
    if (odmah.vrsta === 'gotovo') {
      return odmah.ishod === 'gotovo' ? 'gotovo' : 'odustani';
    }
    if (posao.otkazan) return 'odustani';
    return 'nastavi';
  }

  private async pump(): Promise<void> {
    try {
      while (this.red.length > 0) {
        const pocetak = this.sada();
        let i = 0;
        while (i < this.red.length) {
          const posao = this.red[i]!;
          let ishod: 'gotovo' | 'odustani' | 'nastavi';
          try {
            ishod = await this.izvrsiSlice(posao);
          } catch {
            ishod = 'odustani';
          }
          const josIndex = this.red.findIndex((p) => p.id === posao.id);
          if (josIndex < 0) {
            continue;
          }
          if (ishod !== 'nastavi') {
            this.red.splice(josIndex, 1);
            i = josIndex;
            continue;
          }
          // Premjesti na kraj — inače budžet-break uvijek kreće od i=0 i izgladnuje ostale.
          if (josIndex !== this.red.length - 1) {
            const [p] = this.red.splice(josIndex, 1);
            this.red.push(p!);
            i = josIndex;
          } else {
            i = josIndex + 1;
          }
          if (this.sada() - pocetak >= BUDZET_BLOKA_MS) break;
        }
        if (this.red.length > 0) await this.predajEventLoop();
      }
    } finally {
      this.pumpAktivan = false;
      if (this.red.length > 0) this.pokreniPump();
    }
  }
}
