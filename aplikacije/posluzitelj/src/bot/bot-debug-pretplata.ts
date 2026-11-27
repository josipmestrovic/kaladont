/**
 * Memorijska pretplata na staging bot debug po partiji.
 * Emit samo pretplatnicima te partije; produkcija ne alocira.
 */
import type { BotDebugZapis, KontekstPartije } from 'zajednicko';

export type BotDebugEmitFn = (igracId: string, zapis: BotDebugZapis) => void;

const DOPUSTENI_KONTEKSTI: ReadonlySet<KontekstPartije> = new Set(['javna', 'trening', 'izazov']);

export function botDebugKontekstDopusten(kontekst: KontekstPartije): boolean {
  return DOPUSTENI_KONTEKSTI.has(kontekst);
}

export class BotDebugPretplate {
  private readonly poPartiji = new Map<string, Set<string>>();
  private readonly partijaPoIgracu = new Map<string, string>();

  constructor(
    private readonly okruzenje: string,
    private readonly emit: BotDebugEmitFn,
    private readonly jeSudionik: (partijaId: string, igracId: string) => boolean,
  ) {}

  get stagingAktivan(): boolean {
    return this.okruzenje === 'staging';
  }

  imaPretplatnika(partijaId: string): boolean {
    if (!this.stagingAktivan) return false;
    const skup = this.poPartiji.get(partijaId);
    return !!skup && skup.size > 0;
  }

  pretplati(partijaId: string, igracId: string, kontekst: KontekstPartije | null): boolean {
    if (!this.stagingAktivan) return false;
    if (!kontekst || !botDebugKontekstDopusten(kontekst)) return false;
    if (!this.jeSudionik(partijaId, igracId)) return false;
    const stara = this.partijaPoIgracu.get(igracId);
    if (stara && stara !== partijaId) this.otkazi(stara, igracId);
    let skup = this.poPartiji.get(partijaId);
    if (!skup) {
      skup = new Set();
      this.poPartiji.set(partijaId, skup);
    }
    skup.add(igracId);
    this.partijaPoIgracu.set(igracId, partijaId);
    return true;
  }

  otkazi(partijaId: string, igracId: string): void {
    const skup = this.poPartiji.get(partijaId);
    if (skup) {
      skup.delete(igracId);
      if (skup.size === 0) this.poPartiji.delete(partijaId);
    }
    if (this.partijaPoIgracu.get(igracId) === partijaId) {
      this.partijaPoIgracu.delete(igracId);
    }
  }

  otkaziIgraca(igracId: string): void {
    const partijaId = this.partijaPoIgracu.get(igracId);
    if (partijaId) this.otkazi(partijaId, igracId);
  }

  ocistiPartiju(partijaId: string): void {
    const skup = this.poPartiji.get(partijaId);
    if (!skup) return;
    for (const igracId of skup) {
      if (this.partijaPoIgracu.get(igracId) === partijaId) {
        this.partijaPoIgracu.delete(igracId);
      }
    }
    this.poPartiji.delete(partijaId);
  }

  objavi(partijaId: string, zapis: BotDebugZapis): void {
    if (!this.stagingAktivan) return;
    const skup = this.poPartiji.get(partijaId);
    if (!skup || skup.size === 0) return;
    for (const igracId of [...skup]) {
      if (!this.jeSudionik(partijaId, igracId)) {
        this.otkazi(partijaId, igracId);
        continue;
      }
      try {
        this.emit(igracId, zapis);
      } catch {
        // Debug kvar ne smije dirati igru.
      }
    }
  }
}
