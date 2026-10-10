/**
 * Bot kontroler (ADR-017): sluša promjene poteza iz motora i za bota na potezu planira
 * točno jednu akciju po (partijaId, igracId, turnToken). Pri buđenju sve ponovno provjerava.
 */
import type { DogadajPoteza, RezultatNaredbe } from '../igra/politika-ucinka.js';
import type { RjecnikUMemoriji } from '../rjecnik/ucitaj.js';
import type { KonfiguracijaBota } from './konfiguracija-bota.js';
import { odaberiPotez, stvoriStanjeBota, trajanjeRazmisljanjaMs, type OdlukaBota, type Rng, type StanjeBotaUPartiji } from './odabir-rijeci.js';

export type NaredbaBota =
  | { vrsta: 'rijec'; rijec: string; turnToken: string }
  | { vrsta: 'odustani'; turnToken: string };

export interface OvisnostiBotKontrolera {
  rjecnik: Pick<RjecnikUMemoriji, 'igriviKandidati' | 'grupeZa' | 'verzijaRjecnika'> & { frekvencijaZa(rijec: string): number | null };
  izvrsiNaredbu: (partijaId: string, igracId: string, naredba: NaredbaBota) => RezultatNaredbe;
  konfiguracija: KonfiguracijaBota;
  rng?: Rng;
  sada?: () => number;
  zakazi?: (posao: () => void, ms: number) => NodeJS.Timeout;
  otkazi?: (handle: NodeJS.Timeout) => void;
  zapisi?: (poruka: string, podaci: Record<string, unknown>) => void;
  oznaciNamjerniIstek?: (partijaId: string, igracId: string, turnToken: string) => boolean;
}

export interface BrojaciBota {
  planirano: number;
  odigranihRijeci: number;
  namjernihPropusta: number;
  bezRijeci: number;
  zastarjelo: number;
  tehnickeGreske: number;
  namjernihCekanjaIsteka: number;
}

interface PlaniranaAkcija {
  handle: NodeJS.Timeout;
  igracId: string;
  turnToken: string;
}

export class BotKontroler {
  private readonly stanjaPoPartiji = new Map<string, Map<string, StanjeBotaUPartiji>>();
  private readonly planirano = new Map<string, PlaniranaAkcija>();
  private readonly namjerniIsteci = new Map<string, string>();
  private readonly rng: Rng;
  private readonly sada: () => number;
  private readonly zakazi: (posao: () => void, ms: number) => NodeJS.Timeout;
  private readonly otkazi: (handle: NodeJS.Timeout) => void;
  private readonly zapisi: (poruka: string, podaci: Record<string, unknown>) => void;
  private zaustavljen = false;
  readonly brojaci: BrojaciBota = { planirano: 0, odigranihRijeci: 0, namjernihPropusta: 0, bezRijeci: 0, zastarjelo: 0, tehnickeGreske: 0, namjernihCekanjaIsteka: 0 };

  constructor(private readonly ovisnosti: OvisnostiBotKontrolera) {
    this.rng = ovisnosti.rng ?? Math.random;
    this.sada = ovisnosti.sada ?? Date.now;
    this.zakazi = ovisnosti.zakazi ?? ((posao, ms) => setTimeout(posao, ms));
    this.otkazi = ovisnosti.otkazi ?? ((handle) => clearTimeout(handle));
    this.zapisi = ovisnosti.zapisi ?? (() => undefined);
  }

  naPromjenuPoteza(dogadaj: DogadajPoteza): void {
    const prethodniPlan = this.planirano.get(dogadaj.partijaId);
    if (!dogadaj.zavrsena && !dogadaj.izborUToku && (prethodniPlan?.turnToken === dogadaj.turnToken || this.namjerniIsteci.get(dogadaj.partijaId) === dogadaj.turnToken)) return;
    this.otkaziPlan(dogadaj.partijaId);
    this.namjerniIsteci.delete(dogadaj.partijaId);
    if (this.zaustavljen) return;
    if (dogadaj.zavrsena) {
      this.stanjaPoPartiji.delete(dogadaj.partijaId);
      return;
    }
    if (dogadaj.izborUToku || !dogadaj.naPotezuId || !dogadaj.trazenaSlova) return;
    const sudionik = dogadaj.sudionici.find((s) => s.igracId === dogadaj.naPotezuId);
    if (!sudionik || sudionik.upravljac !== 'bot' || !sudionik.aktivan) return;

    if (dogadaj.kontekst === 'javna' && dogadaj.istekPotezaMs !== null && dogadaj.istekPotezaMs > this.sada() && this.rng() < this.ovisnosti.konfiguracija.vjerojatnostIsteka && this.ovisnosti.oznaciNamjerniIstek?.(dogadaj.partijaId, sudionik.igracId, dogadaj.turnToken)) {
      this.namjerniIsteci.set(dogadaj.partijaId, dogadaj.turnToken);
      this.brojaci.namjernihCekanjaIsteka += 1;
      return;
    }

    const stanjeBota = this.stanjeBota(dogadaj.partijaId, sudionik.igracId);
    const odluka = this.odluci(dogadaj, stanjeBota);
    const rok = dogadaj.istekPotezaMs === null ? null : Math.max(0, dogadaj.istekPotezaMs - this.sada());
    const odgoda = trajanjeRazmisljanjaMs(rok, this.ovisnosti.konfiguracija, this.rng, dogadaj.kontekst);
    const verzijaRjecnika = this.ovisnosti.rjecnik.verzijaRjecnika();
    const turnToken = dogadaj.turnToken;
    const handle = this.zakazi(() => {
      const plan = this.planirano.get(dogadaj.partijaId);
      if (!plan || plan.turnToken !== turnToken || plan.igracId !== sudionik.igracId) {
        this.brojaci.zastarjelo += 1;
        return;
      }
      this.planirano.delete(dogadaj.partijaId);
      const svjezaOdluka = this.ovisnosti.rjecnik.verzijaRjecnika() === verzijaRjecnika ? odluka : this.odluci(dogadaj, stanjeBota);
      this.izvrsi(dogadaj, sudionik.igracId, turnToken, svjezaOdluka, stanjeBota, true);
    }, odgoda);
    this.planirano.set(dogadaj.partijaId, { handle, igracId: sudionik.igracId, turnToken });
    this.brojaci.planirano += 1;
  }

  zaustavi(): void {
    this.zaustavljen = true;
    for (const partijaId of [...this.planirano.keys()]) this.otkaziPlan(partijaId);
    this.stanjaPoPartiji.clear();
    this.namjerniIsteci.clear();
  }

  brojPlaniranih(): number {
    return this.planirano.size;
  }

  private odluci(dogadaj: DogadajPoteza, stanjeBota: StanjeBotaUPartiji): OdlukaBota {
    return odaberiPotez({
      trazenaSlova: dogadaj.trazenaSlova!,
      kandidati: this.ovisnosti.rjecnik.igriviKandidati(dogadaj.trazenaSlova!, dogadaj.iskoristeneGrupe, dogadaj.dopusteneVrste),
      frekvencijaZa: (rijec) => this.ovisnosti.rjecnik.frekvencijaZa(rijec),
      grupeZa: (rijec) => this.ovisnosti.rjecnik.grupeZa(rijec),
    }, stanjeBota, this.ovisnosti.konfiguracija, this.rng);
  }

  private izvrsi(
    dogadaj: DogadajPoteza,
    igracId: string,
    turnToken: string,
    odluka: OdlukaBota,
    stanjeBota: StanjeBotaUPartiji,
    smijePonoviti: boolean,
  ): void {
    const naredba: NaredbaBota = odluka.vrsta === 'rijec'
      ? { vrsta: 'rijec', rijec: odluka.rijec, turnToken }
      : { vrsta: 'odustani', turnToken };
    let rezultat: RezultatNaredbe;
    try {
      rezultat = this.ovisnosti.izvrsiNaredbu(dogadaj.partijaId, igracId, naredba);
    } catch (greska) {
      this.brojaci.tehnickeGreske += 1;
      this.zapisi('Naredba bota bacila je pogrešku', { partijaId: dogadaj.partijaId, igracId, greska: greska instanceof Error ? greska.message : String(greska) });
      return;
    }
    if (rezultat.ishod === 'prihvacen') {
      if (odluka.vrsta === 'rijec') this.brojaci.odigranihRijeci += 1;
      else if (odluka.razlog === 'namjerni_propust') this.brojaci.namjernihPropusta += 1;
      else this.brojaci.bezRijeci += 1;
      return;
    }
    if (rezultat.ishod === 'ignoriran') {
      this.brojaci.zastarjelo += 1;
      return;
    }
    if (rezultat.kod === 'STARI_TURN_TOKEN' || rezultat.kod === 'NIJE_TVOJ_POTEZ' || rezultat.kod === 'SUSTAV_BIRA_RIJEC') {
      this.brojaci.zastarjelo += 1;
      return;
    }
    // Riječ odbijena iako je bila igriva: rječnik se promijenio ili je indeks neusklađen. Tehnički kvar, ne „ljudski” propust.
    this.brojaci.tehnickeGreske += 1;
    this.zapisi('Botova riječ odbijena', { partijaId: dogadaj.partijaId, igracId, kod: rezultat.kod, rijec: odluka.vrsta === 'rijec' ? odluka.rijec : null });
    if (smijePonoviti && odluka.vrsta === 'rijec') {
      this.izvrsi(dogadaj, igracId, turnToken, this.odluci(dogadaj, stanjeBota), stanjeBota, false);
      return;
    }
    if (odluka.vrsta === 'rijec') this.ovisnosti.izvrsiNaredbu(dogadaj.partijaId, igracId, { vrsta: 'odustani', turnToken });
  }

  private stanjeBota(partijaId: string, igracId: string): StanjeBotaUPartiji {
    let poIgracu = this.stanjaPoPartiji.get(partijaId);
    if (!poIgracu) {
      poIgracu = new Map();
      this.stanjaPoPartiji.set(partijaId, poIgracu);
    }
    let stanje = poIgracu.get(igracId);
    if (!stanje) {
      stanje = stvoriStanjeBota(this.ovisnosti.konfiguracija, this.rng);
      poIgracu.set(igracId, stanje);
    }
    return stanje;
  }

  private otkaziPlan(partijaId: string): void {
    const plan = this.planirano.get(partijaId);
    if (!plan) return;
    this.otkazi(plan.handle);
    this.planirano.delete(partijaId);
  }
}
