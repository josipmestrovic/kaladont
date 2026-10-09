/**
 * Fond javnih botova (ADR-017): jedan identitet ima najviše jednu rezervaciju ili partiju.
 * Generacija štiti noviju rezervaciju od zakašnjelog čišćenja starije.
 */
import type { AvatarConfigV1 } from 'zajednicko';
import { and, eq, isNull } from 'drizzle-orm';
import type { StavkaReda } from '../red/red-cekanja.js';
import { baza } from '../baza/klijent.js';
import { botovi, igraci } from '../baza/shema.js';

/** Aktivni javni botovi s trenutačnim agregatima (rang i razina u čekaonici). */
export async function ucitajIdentiteteBotova(): Promise<IdentitetBota[]> {
  const retci = await baza.select({
    igracId: igraci.id,
    nadimak: igraci.nadimak,
    avatarId: igraci.avatarId,
    avatarConfig: igraci.avatarConfig,
    avatarRevision: igraci.avatarRevision,
    odigrane: igraci.odigrane,
    pobjede: igraci.pobjede,
    bodoviUkupno: igraci.bodoviUkupno,
    odigrane1v1: igraci.odigrane1v1,
    pobjede1v1: igraci.pobjede1v1,
    bodovi1v1: igraci.bodovi1v1,
    iskustvoUkupno: igraci.iskustvoUkupno,
  }).from(botovi)
    .innerJoin(igraci, eq(igraci.id, botovi.igracId))
    .where(and(eq(botovi.aktivan, true), eq(igraci.upravljac, 'bot'), isNull(igraci.obrisanAt)));
  return retci.map((redak) => ({ ...redak, avatarConfig: redak.avatarConfig as AvatarConfigV1 | null }));
}

export interface IdentitetBota {
  igracId: string;
  nadimak: string;
  avatarId: number;
  avatarConfig: AvatarConfigV1 | null;
  avatarRevision: number;
  odigrane: number;
  pobjede: number;
  bodoviUkupno: number;
  odigrane1v1: number;
  pobjede1v1: number;
  bodovi1v1: number;
  iskustvoUkupno: number;
}

export type StanjeRezervacije = 'rezerviran' | 'pokretanje' | 'u_partiji';

export interface Rezervacija {
  igracId: string;
  generacija: number;
  stanje: StanjeRezervacije;
  grupaId: string;
  rezerviranoU: number;
}

export interface StanjeFonda {
  ukupno: number;
  slobodni: number;
  rezervirani: number;
  uPartiji: number;
  iscrpljenja: number;
}

export class FondBotova {
  private readonly identiteti = new Map<string, IdentitetBota>();
  private readonly rezervacije = new Map<string, Rezervacija>();
  private readonly zadnjaUporaba = new Map<string, number>();
  private sljedecaGeneracija = 1;
  private brojIscrpljenja = 0;

  constructor(
    identiteti: readonly IdentitetBota[],
    private readonly sada: () => number = Date.now,
  ) {
    for (const identitet of identiteti) this.identiteti.set(identitet.igracId, identitet);
  }

  postaviIdentitete(identiteti: readonly IdentitetBota[]): void {
    this.identiteti.clear();
    for (const identitet of identiteti) this.identiteti.set(identitet.igracId, identitet);
  }

  /** Rezervira najdulje neiskorišten slobodan identitet; null kad je fond iscrpljen. */
  rezerviraj(grupaId: string): Rezervacija | null {
    let kandidat: IdentitetBota | null = null;
    let najstarija = Number.POSITIVE_INFINITY;
    for (const identitet of this.identiteti.values()) {
      if (this.rezervacije.has(identitet.igracId)) continue;
      const uporaba = this.zadnjaUporaba.get(identitet.igracId) ?? -1;
      if (uporaba < najstarija) {
        najstarija = uporaba;
        kandidat = identitet;
      }
    }
    if (!kandidat) {
      this.brojIscrpljenja += 1;
      return null;
    }
    const rezervacija: Rezervacija = {
      igracId: kandidat.igracId,
      generacija: this.sljedecaGeneracija++,
      stanje: 'rezerviran',
      grupaId,
      rezerviranoU: this.sada(),
    };
    this.rezervacije.set(kandidat.igracId, rezervacija);
    this.zadnjaUporaba.set(kandidat.igracId, rezervacija.rezerviranoU);
    return rezervacija;
  }

  /** Prelazak u sljedeće stanje vrijedi samo za istu generaciju. */
  oznaci(rezervacija: Pick<Rezervacija, 'igracId' | 'generacija'>, stanje: StanjeRezervacije): boolean {
    const trenutna = this.rezervacije.get(rezervacija.igracId);
    if (!trenutna || trenutna.generacija !== rezervacija.generacija) return false;
    trenutna.stanje = stanje;
    return true;
  }

  oslobodi(rezervacija: Pick<Rezervacija, 'igracId' | 'generacija'>): boolean {
    const trenutna = this.rezervacije.get(rezervacija.igracId);
    if (!trenutna || trenutna.generacija !== rezervacija.generacija) return false;
    this.rezervacije.delete(rezervacija.igracId);
    return true;
  }

  oslobodiGrupu(grupaId: string): void {
    for (const rezervacija of [...this.rezervacije.values()]) {
      if (rezervacija.grupaId === grupaId && rezervacija.stanje === 'rezerviran') this.rezervacije.delete(rezervacija.igracId);
    }
  }

  /** Bot se oslobađa tek kad motor više ne drži njegovu partiju (rezultat spremljen ili poništen). */
  oslobodiZavrsene(botJeZauzet: (igracId: string) => boolean): number {
    let oslobodeno = 0;
    for (const rezervacija of [...this.rezervacije.values()]) {
      if (rezervacija.stanje !== 'u_partiji' || botJeZauzet(rezervacija.igracId)) continue;
      this.rezervacije.delete(rezervacija.igracId);
      oslobodeno += 1;
    }
    return oslobodeno;
  }

  rezervacijaZa(igracId: string): Rezervacija | undefined {
    return this.rezervacije.get(igracId);
  }

  jeBot(igracId: string): boolean {
    return this.identiteti.has(igracId);
  }

  stavkaReda(igracId: string): StavkaReda {
    const identitet = this.identiteti.get(igracId);
    if (!identitet) throw new Error(`Bot ${igracId} nije u fondu.`);
    return {
      ...identitet,
      vrsta: 'registriran',
      upravljac: 'bot',
      trenutniNiz4p: 0,
      trenutniNiz1v1: 0,
      usaoU: this.sada(),
    };
  }

  stanje(): StanjeFonda {
    let rezervirani = 0;
    let uPartiji = 0;
    for (const rezervacija of this.rezervacije.values()) {
      if (rezervacija.stanje === 'u_partiji') uPartiji += 1;
      else rezervirani += 1;
    }
    return {
      ukupno: this.identiteti.size,
      slobodni: this.identiteti.size - this.rezervacije.size,
      rezervirani,
      uPartiji,
      iscrpljenja: this.brojIscrpljenja,
    };
  }
}
