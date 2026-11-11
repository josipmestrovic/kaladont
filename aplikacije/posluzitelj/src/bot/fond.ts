/**
 * Fond javnih botova (ADR-017): jedan identitet ima najviše jednu rezervaciju ili partiju.
 * Generacija štiti noviju rezervaciju od zakašnjelog čišćenja starije.
 */
import type { AvatarConfigV1 } from 'zajednicko';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import type { StavkaReda } from '../red/red-cekanja.js';
import { baza } from '../baza/klijent.js';
import { botovi, igraci, nizoviPobjedaIgraca } from '../baza/shema.js';
import { promijesajNiz } from '../igra/raspored-sjedala.js';
import { randomInt } from 'node:crypto';
import { ZADANA_KONFIGURACIJA_BOTA, type KonfiguracijaBota } from './konfiguracija-bota.js';

/** Aktivni javni botovi s trenutačnim agregatima (rang i razina u čekaonici). */
export async function ucitajIdentiteteBotova(igracIdovi?: readonly string[], ukljuciNeaktivne = false): Promise<IdentitetBota[]> {
  if (igracIdovi?.length === 0) return [];
  const retci = await baza.select({
    igracId: igraci.id,
    kljucSeeda: botovi.kljucSeeda,
    tip: botovi.tip,
    aktivan: botovi.aktivan,
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
    .where(and(
      ukljuciNeaktivne ? undefined : eq(botovi.aktivan, true),
      // Aktivni fond više ne uključuje gost-botove (povijesni tip='gost' ostaje u bazi).
      ukljuciNeaktivne ? undefined : eq(botovi.tip, 'imenovani'),
      eq(igraci.upravljac, 'bot'),
      isNull(igraci.obrisanAt),
      igracIdovi ? inArray(igraci.id, [...igracIdovi]) : undefined,
    ));
  const nizovi = retci.length ? await baza.select().from(nizoviPobjedaIgraca).where(inArray(nizoviPobjedaIgraca.igracId, retci.map((redak) => redak.igracId))) : [];
  const poIgracu = new Map<string, { dva: number; cetiri: number }>();
  for (const niz of nizovi) {
    const stanje = poIgracu.get(niz.igracId) ?? { dva: 0, cetiri: 0 };
    if (niz.mod === 'dva_igraca') stanje.dva = niz.trenutniNiz;
    else stanje.cetiri = niz.trenutniNiz;
    poIgracu.set(niz.igracId, stanje);
  }
  return retci.map((redak) => ({ ...redak, avatarConfig: redak.avatarConfig as AvatarConfigV1 | null, trenutniNiz1v1: poIgracu.get(redak.igracId)?.dva ?? 0, trenutniNiz4p: poIgracu.get(redak.igracId)?.cetiri ?? 0 }));
}

export interface IdentitetBota {
  igracId: string;
  kljucSeeda?: string;
  tip?: 'imenovani' | 'gost';
  aktivan?: boolean;
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
  trenutniNiz1v1?: number;
  trenutniNiz4p?: number;
}

export type StanjeRezervacije = 'rezerviran' | 'pokretanje' | 'u_partiji';

export interface Rezervacija {
  igracId: string;
  generacija: number;
  stanje: StanjeRezervacije;
  grupaId: string;
  rezerviranoU: number;
  stanjeOd: number;
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
  private readonly aktivni = new Set<string>();
  private readonly neaktualni = new Set<string>();
  private readonly osvjezavanje = new Map<string, number>();
  private generacijaOsvjezavanja = 0;
  private readonly nedavniProtivnici = new Map<string, { botovi: string[]; azuriranoU: number }>();
  private readonly zadnjeAktivnosti = new Map<string, number>();
  private readonly greskeProfila = new Set<string>();
  private vrecica: string[] = [];
  private zadnjiIzvuceni: string | null = null;
  private sljedecaGeneracija = 1;
  private brojIscrpljenja = 0;

  constructor(
    identiteti: readonly IdentitetBota[],
    private readonly sada: () => number = Date.now,
    private readonly slucajniIndeks: (gornjaGranica: number) => number = randomInt,
    private readonly dohvatiKonfiguraciju: () => KonfiguracijaBota = () => ZADANA_KONFIGURACIJA_BOTA,
  ) {
    this.postaviIdentitete(identiteti);
  }

  postaviIdentitete(identiteti: readonly IdentitetBota[]): void {
    const novi = identiteti.filter((identitet) => identitet.aktivan !== false && !this.aktivni.has(identitet.igracId)).map((identitet) => identitet.igracId);
    this.aktivni.clear();
    for (const identitet of identiteti) if (identitet.aktivan !== false) this.aktivni.add(identitet.igracId);
    for (const identitet of identiteti) {
      this.identiteti.set(identitet.igracId, identitet);
      this.zadnjeAktivnosti.set(identitet.igracId, this.zadnjeAktivnosti.get(identitet.igracId) ?? this.sada());
    }
    this.vrecica = this.vrecica.filter((igracId) => this.aktivni.has(igracId));
    this.vrecica.push(...promijesajNiz(novi, this.slucajniIndeks));
  }

  async osvjeziProfile(igracIdovi: readonly string[], ucitaj: (idovi: readonly string[]) => Promise<IdentitetBota[]>): Promise<void> {
    const generacija = ++this.generacijaOsvjezavanja;
    for (const igracId of igracIdovi) {
      this.neaktualni.add(igracId);
      this.osvjezavanje.set(igracId, generacija);
      this.greskeProfila.delete(igracId);
      this.zadnjeAktivnosti.set(igracId, this.sada());
    }
    let profili: IdentitetBota[];
    try {
      profili = await ucitaj(igracIdovi);
    } catch (greska) {
      for (const igracId of igracIdovi) {
        if (this.osvjezavanje.get(igracId) === generacija) {
          this.greskeProfila.add(igracId);
          this.zadnjeAktivnosti.set(igracId, this.sada());
        }
      }
      throw greska;
    }
    const poId = new Map(profili.map((profil) => [profil.igracId, profil]));
    for (const igracId of igracIdovi) {
      if (this.osvjezavanje.get(igracId) !== generacija) continue;
      const profil = poId.get(igracId);
      if (profil) this.identiteti.set(igracId, profil);
      else this.aktivni.delete(igracId);
      this.neaktualni.delete(igracId);
      this.osvjezavanje.delete(igracId);
      this.greskeProfila.delete(igracId);
      this.zadnjeAktivnosti.set(igracId, this.sada());
    }
    this.vrecica = this.vrecica.filter((igracId) => this.aktivni.has(igracId));
  }

  /** Izvlačenje i rezervacija zajedničkog fonda obavljaju se sinkrono. */
  rezerviraj(grupaId: string, ljudi: readonly string[] = []): Rezervacija | null {
    if (this.rezervacije.size >= this.dohvatiKonfiguraciju().maksimalnoAktivnihBotova) {
      this.brojIscrpljenja += 1;
      return null;
    }
    if (this.vrecica.length === 0) {
      this.vrecica = promijesajNiz([...this.aktivni], this.slucajniIndeks);
    }
    let slobodni = this.vrecica.filter((igracId) => !this.rezervacije.has(igracId) && !this.neaktualni.has(igracId));
    if (slobodni.length === 0) slobodni = promijesajNiz([...this.aktivni].filter((igracId) => !this.rezervacije.has(igracId) && !this.neaktualni.has(igracId)), this.slucajniIndeks);
    const sada = this.sada();
    for (const [igracId, povijest] of this.nedavniProtivnici) {
      if (sada - povijest.azuriranoU >= this.dohvatiKonfiguraciju().vijekNedavnihProtivnikaMs) this.nedavniProtivnici.delete(igracId);
    }
    const susreti = (kandidat: string) => ljudi.reduce((broj, covjek) => broj + (this.nedavniProtivnici.get(covjek)?.botovi.includes(kandidat) ? 1 : 0), 0);
    const bezPonavljanja = slobodni.filter((kandidat) => kandidat !== this.zadnjiIzvuceni);
    const izbor = bezPonavljanja.length ? bezPonavljanja : slobodni;
    let igracId = izbor[0];
    for (const kandidat of izbor) {
      if (igracId === undefined || susreti(kandidat) < susreti(igracId)) igracId = kandidat;
    }
    if (!igracId) {
      this.brojIscrpljenja += 1;
      return null;
    }
    const mjesto = this.vrecica.indexOf(igracId);
    if (mjesto >= 0) this.vrecica.splice(mjesto, 1);
    const rezervacija: Rezervacija = {
      igracId,
      generacija: this.sljedecaGeneracija++,
      stanje: 'rezerviran',
      grupaId,
      rezerviranoU: this.sada(),
      stanjeOd: this.sada(),
    };
    this.rezervacije.set(igracId, rezervacija);
    this.zadnjeAktivnosti.set(igracId, rezervacija.rezerviranoU);
    this.zadnjiIzvuceni = igracId;
    return rezervacija;
  }

  zapamtiProtivnike(stol: readonly Pick<StavkaReda, 'igracId' | 'upravljac'>[]): void {
    const konfiguracija = this.dohvatiKonfiguraciju();
    if (konfiguracija.maksimalnoZapisaProtivnika === 0) return;
    const botovi = stol.filter((stavka) => stavka.upravljac === 'bot').map((stavka) => stavka.igracId);
    if (!botovi.length) return;
    for (const covjek of stol.filter((stavka) => stavka.upravljac !== 'bot')) {
      const prethodni = this.nedavniProtivnici.get(covjek.igracId)?.botovi ?? [];
      this.nedavniProtivnici.delete(covjek.igracId);
      this.nedavniProtivnici.set(covjek.igracId, { botovi: [...new Set([...botovi, ...prethodni])].slice(0, konfiguracija.brojNedavnihProtivnika), azuriranoU: this.sada() });
      while (this.nedavniProtivnici.size > konfiguracija.maksimalnoZapisaProtivnika) {
        const najstariji = this.nedavniProtivnici.keys().next().value;
        if (najstariji !== undefined) this.nedavniProtivnici.delete(najstariji);
      }
    }
  }

  /** Prelazak u sljedeće stanje vrijedi samo za istu generaciju. */
  oznaci(rezervacija: Pick<Rezervacija, 'igracId' | 'generacija'>, stanje: StanjeRezervacije): boolean {
    const trenutna = this.rezervacije.get(rezervacija.igracId);
    if (!trenutna || trenutna.generacija !== rezervacija.generacija) return false;
    if (trenutna.stanje !== stanje) {
      trenutna.stanje = stanje;
      trenutna.stanjeOd = this.sada();
      this.zadnjeAktivnosti.set(rezervacija.igracId, trenutna.stanjeOd);
    }
    return true;
  }

  oslobodi(rezervacija: Pick<Rezervacija, 'igracId' | 'generacija'>): boolean {
    const trenutna = this.rezervacije.get(rezervacija.igracId);
    if (!trenutna || trenutna.generacija !== rezervacija.generacija) return false;
    this.rezervacije.delete(rezervacija.igracId);
    this.zadnjeAktivnosti.set(rezervacija.igracId, this.sada());
    return true;
  }

  oslobodiGrupu(grupaId: string): void {
    for (const rezervacija of [...this.rezervacije.values()]) {
      if (rezervacija.grupaId === grupaId && rezervacija.stanje === 'rezerviran') this.oslobodi(rezervacija);
    }
  }

  /** Bot se oslobađa tek kad motor više ne drži njegovu partiju (rezultat spremljen ili poništen). */
  oslobodiZavrsene(botJeZauzet: (igracId: string) => boolean): number {
    let oslobodeno = 0;
    for (const rezervacija of [...this.rezervacije.values()]) {
      if (rezervacija.stanje !== 'u_partiji' || botJeZauzet(rezervacija.igracId)) continue;
      this.oslobodi(rezervacija);
      oslobodeno += 1;
    }
    return oslobodeno;
  }

  rezervacijaZa(igracId: string): Rezervacija | undefined {
    return this.rezervacije.get(igracId);
  }

  pregled() {
    return [...this.identiteti.values()].map((identitet) => ({
      igracId: identitet.igracId,
      kljucSeeda: identitet.kljucSeeda ?? null,
      tip: identitet.tip ?? 'imenovani',
      nadimak: identitet.nadimak,
      aktivan: this.aktivni.has(identitet.igracId),
      profilAktualan: !this.neaktualni.has(identitet.igracId),
      greskaProfila: this.greskeProfila.has(identitet.igracId),
      osvjezavanjeUTijeku: this.osvjezavanje.has(identitet.igracId) && !this.greskeProfila.has(identitet.igracId),
      zadnjaAktivnostMs: this.zadnjeAktivnosti.get(identitet.igracId) ?? null,
      rezervacija: this.rezervacije.has(identitet.igracId) ? { ...this.rezervacije.get(identitet.igracId)! } : null,
    }));
  }

  jeBot(igracId: string): boolean {
    return this.identiteti.has(igracId);
  }

  jeAktivan(igracId: string): boolean {
    return this.aktivni.has(igracId);
  }

  zabiljeziAktivnost(igracId: string): void {
    if (this.identiteti.has(igracId)) this.zadnjeAktivnosti.set(igracId, this.sada());
  }

  stavkaReda(igracId: string): StavkaReda {
    const identitet = this.identiteti.get(igracId);
    if (!identitet) throw new Error(`Bot ${igracId} nije u fondu.`);
    const gost = identitet.tip === 'gost';
    return {
      ...identitet,
      vrsta: gost ? 'gost' : 'registriran',
      upravljac: 'bot',
      ...(gost ? { odigrane: 0, pobjede: 0, bodoviUkupno: 0, odigrane1v1: 0, pobjede1v1: 0, bodovi1v1: 0, iskustvoUkupno: 0 } : {}),
      trenutniNiz4p: gost ? 0 : identitet.trenutniNiz4p ?? 0,
      trenutniNiz1v1: gost ? 0 : identitet.trenutniNiz1v1 ?? 0,
      usaoU: this.rezervacije.get(igracId)?.rezerviranoU ?? this.sada(),
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
      ukupno: this.aktivni.size,
      slobodni: [...this.aktivni].filter((igracId) => !this.rezervacije.has(igracId) && !this.neaktualni.has(igracId)).length,
      rezervirani,
      uPartiji,
      iscrpljenja: this.brojIscrpljenja,
    };
  }
}
