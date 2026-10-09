/**
 * Popuna javnog reda botovima (ADR-017, docs/02-pravila-igre/botovi.md).
 * Polazište je `usaoU` najstarijeg čovjeka; pragovi su kumulativni (1/2/3 bota), ograničeni
 * praznim mjestima i fondom. Nova partija nikad ne nastaje bez barem jednog čovjeka.
 */
import type { RezultatPokretanja } from '../igra/politika-ucinka.js';
import type { FondBotova, Rezervacija } from '../bot/fond.js';
import type { RedCekanja, StavkaReda } from './red-cekanja.js';

export const PRAGOVI_POPUNE_MS: Record<'dva_igraca' | 'cetiri_igraca', readonly number[]> = {
  dva_igraca: [30_000],
  cetiri_igraca: [20_000, 30_000, 40_000],
};

export function dopustenoBotova(najstarijiUsaoU: number, sada: number, pragovi: readonly number[]): number {
  const proteklo = sada - najstarijiUsaoU;
  return pragovi.filter((prag) => proteklo >= prag).length;
}

export function sljedeciPragMs(najstarijiUsaoU: number, sada: number, pragovi: readonly number[]): number | null {
  const proteklo = sada - najstarijiUsaoU;
  const prag = pragovi.find((kandidat) => kandidat > proteklo);
  return prag === undefined ? null : najstarijiUsaoU + prag - sada;
}

export interface OvisnostiPopune {
  red: RedCekanja;
  fond: FondBotova;
  velicinaStola: number;
  pragoviMs: readonly number[];
  omogucena: () => boolean;
  /** Pokreće stol ljudi + botova; vraća rezultat motora. */
  pokreniStol: (stol: StavkaReda[]) => Promise<RezultatPokretanja>;
  /** Bot je još vezan uz partiju (igra ili se rezultat sprema). */
  botJeZauzet: (igracId: string) => boolean;
  naPromjenu?: () => void;
  sada?: () => number;
  zakazi?: (posao: () => void, ms: number) => NodeJS.Timeout;
  otkazi?: (handle: NodeJS.Timeout) => void;
}

export class PopunaReda {
  private rezervacije: Rezervacija[] = [];
  private timer: NodeJS.Timeout | null = null;
  private pokretanjeUTijeku = false;
  private readonly grupaId: string;
  private readonly sada: () => number;
  private readonly zakazi: (posao: () => void, ms: number) => NodeJS.Timeout;
  private readonly otkazi: (handle: NodeJS.Timeout) => void;
  private brojacGrupa = 0;

  constructor(private readonly ovisnosti: OvisnostiPopune) {
    this.grupaId = `popuna-${ovisnosti.velicinaStola}`;
    this.sada = ovisnosti.sada ?? Date.now;
    this.zakazi = ovisnosti.zakazi ?? ((posao, ms) => setTimeout(posao, ms));
    this.otkazi = ovisnosti.otkazi ?? ((handle) => clearTimeout(handle));
  }

  /** Rezervirani botovi kao sudionici koji čekaju, za prikaz u čekaonici. */
  rezerviraniBotovi(): StavkaReda[] {
    return this.rezervacije.map((rezervacija) => this.ovisnosti.fond.stavkaReda(rezervacija.igracId));
  }

  /** Ponovno izračunaj rokove i rezervacije; zvati pri ulasku, izlasku, isteku praga i oslobađanju bota. */
  osvjezi(): void {
    this.otkaziTimer();
    this.oslobodiZauzeteNakonPartije();
    if (this.pokretanjeUTijeku) return;
    const ljudi = this.ovisnosti.red.stanje().filter((stavka) => stavka.upravljac !== 'bot');
    if (ljudi.length === 0 || !this.ovisnosti.omogucena()) {
      this.oslobodiSve();
      this.ovisnosti.naPromjenu?.();
      return;
    }

    const sada = this.sada();
    const najstariji = Math.min(...ljudi.map((stavka) => stavka.usaoU));
    const nedostaje = Math.max(0, this.ovisnosti.velicinaStola - ljudi.length);
    const dopusteno = Math.min(nedostaje, dopustenoBotova(najstariji, sada, this.ovisnosti.pragoviMs));

    while (this.rezervacije.length > dopusteno) {
      const visak = this.rezervacije.pop()!;
      this.ovisnosti.fond.oslobodi(visak);
    }
    while (this.rezervacije.length < dopusteno) {
      const rezervacija = this.ovisnosti.fond.rezerviraj(this.grupaId);
      if (!rezervacija) break; // fond iscrpljen: čeka se čovjek ili oslobađanje bota
      this.rezervacije.push(rezervacija);
    }

    if (this.rezervacije.length > 0 && ljudi.length + this.rezervacije.length >= this.ovisnosti.velicinaStola) {
      this.pokreni(ljudi.slice(0, this.ovisnosti.velicinaStola - this.rezervacije.length));
      return;
    }

    const zaKoliko = sljedeciPragMs(najstariji, sada, this.ovisnosti.pragoviMs);
    if (zaKoliko !== null && dopusteno < nedostaje) {
      this.timer = this.zakazi(() => {
        this.timer = null;
        this.osvjezi();
      }, Math.max(0, zaKoliko));
    }
    this.ovisnosti.naPromjenu?.();
  }

  zaustavi(): void {
    this.otkaziTimer();
    this.oslobodiSve();
  }

  private pokreni(ljudi: StavkaReda[]): void {
    const rezervacije = this.rezervacije;
    this.rezervacije = [];
    this.brojacGrupa += 1;
    for (const covjek of ljudi) this.ovisnosti.red.izadji(covjek.igracId);
    for (const rezervacija of rezervacije) this.ovisnosti.fond.oznaci(rezervacija, 'pokretanje');
    const stol = [...ljudi, ...rezervacije.map((rezervacija) => this.ovisnosti.fond.stavkaReda(rezervacija.igracId))];
    this.pokretanjeUTijeku = true;
    this.ovisnosti.naPromjenu?.();
    void this.ovisnosti.pokreniStol(stol)
      .then((rezultat) => {
        if (rezultat === 'pokrenuta') {
          for (const rezervacija of rezervacije) this.ovisnosti.fond.oznaci(rezervacija, 'u_partiji');
        } else {
          for (const rezervacija of rezervacije) this.ovisnosti.fond.oslobodi(rezervacija);
        }
      }, () => {
        for (const rezervacija of rezervacije) this.ovisnosti.fond.oslobodi(rezervacija);
      })
      .finally(() => {
        this.pokretanjeUTijeku = false;
        this.osvjezi();
      });
  }

  private oslobodiZauzeteNakonPartije(): void {
    this.ovisnosti.fond.oslobodiZavrsene(this.ovisnosti.botJeZauzet);
  }

  private oslobodiSve(): void {
    for (const rezervacija of this.rezervacije) this.ovisnosti.fond.oslobodi(rezervacija);
    this.rezervacije = [];
  }

  private otkaziTimer(): void {
    if (!this.timer) return;
    this.otkazi(this.timer);
    this.timer = null;
  }
}
