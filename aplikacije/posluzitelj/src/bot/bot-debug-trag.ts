/**
 * Staging-only trag odluke bota. No-op tvornica za produkciju / bez pretplatnika.
 * Ne utječe na politiku odabira ni na RNG redoslijed.
 */
import type {
  BotDebugIzvorRijeci,
  BotDebugKandidatDetalj,
  BotDebugPoolSloj,
  BotDebugRazlogPreskoka,
  BotDebugStatusPoola,
  BotDebugZapis,
} from 'zajednicko';
import type { PrioritetPoolova } from './konfiguracija-bota.js';
import type { KategorijaPoola } from './poolovi.js';

export const BOT_DEBUG_LIMIT_DETALJA = 20;

export interface BotDebugTrag {
  readonly aktivan: boolean;
  zapisiAgresivnost(ulaz: {
    vjerojatnost: number;
    aktivirana: boolean;
    roll?: number;
    prioritet: PrioritetPoolova;
  }): void;
  zapisiShield(ulaz: {
    vjerojatnost: number;
    primjenjiv: boolean;
    aktiviran: boolean;
    roll?: number;
  }): void;
  zapisiPool(ulaz: {
    pool: KategorijaPoola;
    status: BotDebugStatusPoola;
    pregledano: number;
    legalnih: number;
    sigurnih: number;
    rizicnih: number;
    detalji?: BotDebugKandidatDetalj[];
    poruka: string;
  }): void;
  zapisiPreskok(rijec: string, razlog: BotDebugRazlogPreskoka, prijetnja?: string): void;
  zapisiShieldUtjecaj(ulaz: {
    utjecao: boolean;
    sigurnih: number;
    rizicnih: number;
    rizicniDetalji?: BotDebugKandidatDetalj[];
    rizicniFallback: boolean;
    poruka: string;
  }): void;
  zapisiIzvor(izvor: BotDebugIzvorRijeci, rijec?: string): void;
  zapisiPrelazak(razlog: string): void;
  zapisiPosebno(odluka: NonNullable<BotDebugZapis['posebnaOdluka']>): void;
  zapisiTrajanjeIzracuna(ms: number): void;
  zapisiIshod(ishod: NonNullable<BotDebugZapis['rezultat']['ishodMotora']>, eliminacija?: boolean): void;
  izgradiZapis(meta: {
    partijaId: string;
    igracId: string;
    nadimak: string;
    profil: string;
    redniBrojPoteza: number;
    turnToken: string;
    brojAktivnih: number;
    trazenaSlova: string;
    verzijaRjecnika?: number;
    generacijaPoolova?: number;
    pokusaj: number;
  }): BotDebugZapis | null;
}

class AktivanBotDebugTrag implements BotDebugTrag {
  readonly aktivan = true;
  private agresivnost: BotDebugZapis['agresivnost'] = {
    vjerojatnost: 0,
    aktivirana: false,
    prioritet: 'p2_p1',
    poolovi: [],
  };
  private shield: BotDebugZapis['shield'] = {
    vjerojatnost: 0,
    primjenjiv: false,
    aktiviran: false,
    utjecao: false,
    sigurnih: 0,
    rizicnih: 0,
    rizicniDetalji: [],
    rizicniFallback: false,
    poruke: [],
  };
  private izvor?: BotDebugIzvorRijeci;
  private rijec?: string;
  private posebna?: BotDebugZapis['posebnaOdluka'];
  private trajanjeIzracunaMs?: number;
  private ishod?: BotDebugZapis['rezultat']['ishodMotora'];
  private eliminacija?: boolean;
  private readonly linije: string[] = [];
  private readonly preskoci: BotDebugKandidatDetalj[] = [];

  zapisiAgresivnost(ulaz: {
    vjerojatnost: number;
    aktivirana: boolean;
    roll?: number;
    prioritet: PrioritetPoolova;
  }): void {
    this.agresivnost = {
      ...this.agresivnost,
      vjerojatnost: ulaz.vjerojatnost,
      aktivirana: ulaz.aktivirana,
      roll: ulaz.roll,
      prioritet: ulaz.prioritet,
    };
    const pct = Math.round(ulaz.vjerojatnost * 100);
    this.linije.push(
      ulaz.aktivirana
        ? `Agresivnost ${pct} % — aktivirana.`
        : `Agresivnost ${pct} % — nije aktivirana.`,
    );
  }

  zapisiShield(ulaz: {
    vjerojatnost: number;
    primjenjiv: boolean;
    aktiviran: boolean;
    roll?: number;
  }): void {
    this.shield = {
      ...this.shield,
      vjerojatnost: ulaz.vjerojatnost,
      primjenjiv: ulaz.primjenjiv,
      aktiviran: ulaz.aktiviran,
      roll: ulaz.roll,
    };
    const pct = Math.round(ulaz.vjerojatnost * 100);
    if (!ulaz.primjenjiv) {
      this.linije.push(`Shield nije primjenjiv — više od 2 aktivna igrača.`);
    } else {
      this.linije.push(
        ulaz.aktiviran ? `Shield ${pct} % — aktiviran.` : `Shield ${pct} % — nije aktiviran.`,
      );
    }
  }

  zapisiPool(ulaz: {
    pool: KategorijaPoola;
    status: BotDebugStatusPoola;
    pregledano: number;
    legalnih: number;
    sigurnih: number;
    rizicnih: number;
    detalji?: BotDebugKandidatDetalj[];
    poruka: string;
  }): void {
    const sloj: BotDebugPoolSloj = {
      pool: ulaz.pool,
      status: ulaz.status,
      pregledano: ulaz.pregledano,
      legalnih: ulaz.legalnih,
      sigurnih: ulaz.sigurnih,
      rizicnih: ulaz.rizicnih,
      detalji: (ulaz.detalji ?? []).slice(0, BOT_DEBUG_LIMIT_DETALJA),
      poruka: ulaz.poruka,
    };
    this.agresivnost.poolovi.push(sloj);
    this.linije.push(ulaz.poruka);
  }

  zapisiPreskok(rijec: string, razlog: BotDebugRazlogPreskoka, prijetnja?: string): void {
    if (this.preskoci.length < BOT_DEBUG_LIMIT_DETALJA) {
      this.preskoci.push({ rijec, razlog, prijetnja });
    }
  }

  zapisiShieldUtjecaj(ulaz: {
    utjecao: boolean;
    sigurnih: number;
    rizicnih: number;
    rizicniDetalji?: BotDebugKandidatDetalj[];
    rizicniFallback: boolean;
    poruka: string;
  }): void {
    this.shield.utjecao = ulaz.utjecao;
    this.shield.sigurnih = ulaz.sigurnih;
    this.shield.rizicnih = ulaz.rizicnih;
    this.shield.rizicniFallback = ulaz.rizicniFallback;
    if (ulaz.rizicniDetalji) {
      this.shield.rizicniDetalji = ulaz.rizicniDetalji.slice(0, BOT_DEBUG_LIMIT_DETALJA);
    }
    this.shield.poruke.push(ulaz.poruka);
    this.linije.push(ulaz.poruka);
  }

  zapisiIzvor(izvor: BotDebugIzvorRijeci, rijec?: string): void {
    this.izvor = izvor;
    if (rijec) {
      this.rijec = rijec;
      this.agresivnost.odabrana = rijec;
      this.linije.push(`Odabrana riječ: ${rijec} (${oznakaIzvora(izvor)}).`);
    }
  }

  zapisiPrelazak(razlog: string): void {
    this.agresivnost.razlogPrelaska = razlog;
    this.linije.push(razlog);
  }

  zapisiPosebno(odluka: NonNullable<BotDebugZapis['posebnaOdluka']>): void {
    this.posebna = odluka;
    this.linije.push(`Posebna odluka: ${odluka}.`);
  }

  zapisiTrajanjeIzracuna(ms: number): void {
    this.trajanjeIzracunaMs = Math.max(0, Math.round(ms));
  }

  zapisiIshod(ishod: NonNullable<BotDebugZapis['rezultat']['ishodMotora']>, eliminacija?: boolean): void {
    this.ishod = ishod;
    if (eliminacija !== undefined) this.eliminacija = eliminacija;
  }

  izgradiZapis(meta: {
    partijaId: string;
    igracId: string;
    nadimak: string;
    profil: string;
    redniBrojPoteza: number;
    turnToken: string;
    brojAktivnih: number;
    trazenaSlova: string;
    verzijaRjecnika?: number;
    generacijaPoolova?: number;
    pokusaj: number;
  }): BotDebugZapis {
    return {
      verzija: 1,
      ...meta,
      agresivnost: this.agresivnost,
      shield: this.shield,
      posebnaOdluka: this.posebna,
      rezultat: {
        rijec: this.rijec,
        izvor: this.izvor,
        ishodMotora: this.ishod,
        eliminacija: this.eliminacija,
        trajanjeIzracunaMs: this.trajanjeIzracunaMs,
      },
      linije: [...this.linije],
    };
  }
}

class NoopBotDebugTrag implements BotDebugTrag {
  readonly aktivan = false;
  zapisiAgresivnost(): void {}
  zapisiShield(): void {}
  zapisiPool(): void {}
  zapisiPreskok(): void {}
  zapisiShieldUtjecaj(): void {}
  zapisiIzvor(): void {}
  zapisiPrelazak(): void {}
  zapisiPosebno(): void {}
  zapisiTrajanjeIzracuna(): void {}
  zapisiIshod(): void {}
  izgradiZapis(): null {
    return null;
  }
}

const NOOP = new NoopBotDebugTrag();

export function stvoriBotDebugTrag(ukljuci: boolean): BotDebugTrag {
  return ukljuci ? new AktivanBotDebugTrag() : NOOP;
}

export function noopBotDebugTrag(): BotDebugTrag {
  return NOOP;
}

function oznakaIzvora(izvor: BotDebugIzvorRijeci): string {
  switch (izvor) {
    case 'pool_1':
      return 'Pool 1';
    case 'pool_2':
      return 'Pool 2';
    case 'obicni':
      return 'obični repertoar';
    case 'kaladont':
      return 'Kaladont';
    default:
      return izvor;
  }
}

export function oznakaPoola(pool: KategorijaPoola): string {
  return pool === 'pool_1' ? 'Pool 1' : 'Pool 2';
}
