/**
 * Injektabilni sat za motor partije — stvarno vrijeme u produkciji,
 * kontrolirani sat u testovima roka (bez Vitest fake timera na socket/DB).
 */

export interface SatHandle {
  id: number;
  unref(): void;
}

export interface Sat {
  sada(): number;
  zakazi(fn: () => void, odmakMs: number): SatHandle;
  otkazi(handle: SatHandle | null | undefined): void;
}

export function stvoriStvarniSat(): Sat {
  return {
    sada: () => Date.now(),
    zakazi(fn, odmakMs) {
      const tajmer = setTimeout(fn, odmakMs);
      return {
        id: tajmer as unknown as number,
        unref() {
          tajmer.unref();
        },
      };
    },
    otkazi(handle) {
      if (!handle) return;
      clearTimeout(handle.id as unknown as NodeJS.Timeout);
    },
  };
}

export interface KontroliraniSat extends Sat {
  unaprijedi(ms: number): void;
  postavi(ms: number): void;
}

export function stvoriKontroliraniSat(pocetakMs = Date.now()): KontroliraniSat {
  let sadaMs = pocetakMs;
  let sljedeciId = 1;
  const tajmeri = new Map<number, { kada: number; fn: () => void }>();

  const isprazniDosle = () => {
    for (;;) {
      let najraniji: { id: number; kada: number; fn: () => void } | null = null;
      for (const [id, tajmer] of tajmeri) {
        if (tajmer.kada > sadaMs) continue;
        if (!najraniji || tajmer.kada < najraniji.kada || (tajmer.kada === najraniji.kada && id < najraniji.id)) {
          najraniji = { id, kada: tajmer.kada, fn: tajmer.fn };
        }
      }
      if (!najraniji) break;
      tajmeri.delete(najraniji.id);
      najraniji.fn();
    }
  };

  return {
    sada: () => sadaMs,
    zakazi(fn, odmakMs) {
      const id = sljedeciId;
      sljedeciId += 1;
      const kada = sadaMs + Math.max(0, odmakMs);
      tajmeri.set(id, { kada, fn });
      // Odmak 0 mora pasti odmah (kao setTimeout(_, 0)), inače testovi čekaju rundu zauvijek.
      if (kada <= sadaMs) isprazniDosle();
      return {
        id,
        unref() {
          /* kontrolirani sat ne drži event loop */
        },
      };
    },
    otkazi(handle) {
      if (!handle) return;
      tajmeri.delete(handle.id);
    },
    unaprijedi(ms) {
      if (ms < 0) throw new Error('unaprijedi ne prima negativan odmak');
      sadaMs += ms;
      isprazniDosle();
    },
    postavi(ms) {
      sadaMs = ms;
      isprazniDosle();
    },
  };
}
