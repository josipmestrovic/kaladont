/**
 * Bot kontroler (ADR-017): sluša promjene poteza iz motora i za bota na potezu planira
 * točno jednu akciju po (partijaId, igracId, turnToken). Pri buđenju sve ponovno provjerava.
 *
 * PR01: fiksni tempo ~4 s (±jitter), obvezne reakcije u svim kontekstima, presentation RNG
 * odvojen od odluke o riječi; bez namjernog izostanka.
 * PR07: odaberiPotez dobiva pravilnik + broj aktivnih; čekač dokaza ne dobiva reakciju ispadanja.
 */
import type { BrzaPoruka } from 'zajednicko';
import type { DogadajPoteza, RezultatNaredbe } from '../igra/politika-ucinka.js';
import type { RjecnikUMemoriji } from '../rjecnik/ucitaj.js';
import type { KonfiguracijaBota } from './konfiguracija-bota.js';
import {
  jeNepoznataBotu,
  odaberiPotez,
  odgodaBezRokaMs,
  PredmemorijaLegalnosti,
  stvoriStanjeBota,
  trajanjeRazmisljanjaMs,
  type OdlukaBota,
  type Rng,
  type StanjeBotaUPartiji,
} from './odabir-rijeci.js';
import {
  odaberiReakcijuNaPocetku,
  odaberiReakcijuPriEliminacijiProtivnika,
  odaberiReakcijuPriIspadanju,
  odgodaReakcijeMs,
} from './reakcije.js';

export type NaredbaBota =
  | { vrsta: 'rijec'; rijec: string; turnToken: string }
  | { vrsta: 'odustani'; turnToken: string };

export interface OvisnostiBotKontrolera {
  rjecnik: Pick<RjecnikUMemoriji, 'igriviKandidati' | 'grupeZa' | 'verzijaRjecnika' | 'imaSlobodnuRijecNa'> & {
    frekvencijaZa(rijec: string): number | null;
  };
  izvrsiNaredbu: (partijaId: string, igracId: string, naredba: NaredbaBota) => RezultatNaredbe;
  posaljiReakciju?: (partijaId: string, igracId: string, poruka: BrzaPoruka) => boolean;
  konfiguracija: KonfiguracijaBota;
  /** Decision RNG — samo odabir riječi / neznanje. */
  rng?: Rng;
  /** Presentation RNG — tempo jitter, pool reakcija, odgoda reakcije. */
  rngPrezentacije?: Rng;
  sada?: () => number;
  zakazi?: (posao: () => void, ms: number) => NodeJS.Timeout;
  otkazi?: (handle: NodeJS.Timeout) => void;
  zapisi?: (poruka: string, podaci: Record<string, unknown>) => void;
  dohvatiPotez?: (partijaId: string) => DogadajPoteza | null;
  prekiniZbogGreske?: (partijaId: string, igracId: string, turnToken: string) => void;
  naAktivnost?: (igracId: string) => void;
  /** NODE_ENV; staging uključuje QA tempo bez roka (3 s / 0,2 s). */
  okruzenje?: string;
}

export interface BrojaciBota {
  planirano: number;
  odigranihRijeci: number;
  namjernihPropusta: number;
  bezRijeci: number;
  zastarjelo: number;
  tehnickeGreske: number;
  /** Zadržano radi health kompatibilnosti; namjerni istek više ne postoji. */
  namjernihCekanjaIsteka: number;
  dobrovoljniKa: number;
  prisilniKa: number;
  propustPrimljenogKa: number;
  reakcijaPoslano: number;
  taktickihPoteza: number;
}

interface PlaniranaAkcija {
  handle: NodeJS.Timeout;
  igracId: string;
  turnToken: string;
  izvrsitiUMs: number;
  vrsta: 'rijec' | 'odustani' | 'oporavak';
}

type KategorijaReakcije = 'pozdrav' | 'sorry' | 'bravo';

export class BotKontroler {
  private readonly stanjaPoPartiji = new Map<string, Map<string, StanjeBotaUPartiji>>();
  private readonly planirano = new Map<string, PlaniranaAkcija>();
  private readonly aktualniPotezi = new Map<string, DogadajPoteza>();
  private readonly dovrseniTokeni = new Map<string, string>();
  private readonly greskePoBotu = new Map<string, { broj: number; posljednja: string; vrijemeMs: number }>();
  private readonly konfiguracijePartija = new Map<string, KonfiguracijaBota>();
  private readonly odluke = new Map<string, { turnToken: string; odluka: OdlukaBota; verzijaRjecnika: number }>();
  private readonly predmemorije = new Map<string, PredmemorijaLegalnosti>();
  private readonly zakazaneReakcije = new Map<string, NodeJS.Timeout[]>();
  private readonly poslaniPozdravi = new Map<string, Set<string>>();
  private readonly poslaneEliminacijskeReakcije = new Set<string>();
  /** Sljedeći trenutak (ms) kad igrač smije novu reakciju zbog RS-22 (2 s). */
  private readonly sljedecaReakcijaMs = new Map<string, number>();
  private readonly rng: Rng;
  private readonly rngPrezentacije: Rng;
  private readonly sada: () => number;
  private readonly zakazi: (posao: () => void, ms: number) => NodeJS.Timeout;
  private readonly otkazi: (handle: NodeJS.Timeout) => void;
  private readonly zapisi: (poruka: string, podaci: Record<string, unknown>) => void;
  private readonly okruzenje: string;
  private zaustavljen = false;
  readonly brojaci: BrojaciBota = {
    planirano: 0,
    odigranihRijeci: 0,
    namjernihPropusta: 0,
    bezRijeci: 0,
    zastarjelo: 0,
    tehnickeGreske: 0,
    namjernihCekanjaIsteka: 0,
    dobrovoljniKa: 0,
    prisilniKa: 0,
    propustPrimljenogKa: 0,
    reakcijaPoslano: 0,
    taktickihPoteza: 0,
  };

  constructor(private readonly ovisnosti: OvisnostiBotKontrolera) {
    this.rng = ovisnosti.rng ?? Math.random;
    this.rngPrezentacije = ovisnosti.rngPrezentacije ?? Math.random;
    this.sada = ovisnosti.sada ?? Date.now;
    this.zakazi = ovisnosti.zakazi ?? ((posao, ms) => setTimeout(posao, ms));
    this.otkazi = ovisnosti.otkazi ?? ((handle) => clearTimeout(handle));
    this.zapisi = ovisnosti.zapisi ?? (() => undefined);
    this.okruzenje = ovisnosti.okruzenje ?? process.env.NODE_ENV ?? 'development';
  }

  naPromjenuPoteza(dogadaj: DogadajPoteza): void {
    if (this.zaustavljen) return;
    this.aktualniPotezi.set(dogadaj.partijaId, dogadaj);
    try {
      if (!dogadaj.zavrsena && !this.konfiguracijePartija.has(dogadaj.partijaId)) {
        this.konfiguracijePartija.set(dogadaj.partijaId, structuredClone(this.ovisnosti.konfiguracija));
      }
      this.planiraj(dogadaj);
    } catch (greska) {
      this.oporavi(dogadaj, dogadaj.naPotezuId, 0, new Set(), greska);
    }
  }

  /** Svaki bot pozdravi jednom na početku (javna, privatna, trening). */
  naPocetakPartije(partijaId: string, kontekst: DogadajPoteza['kontekst'], botIds: readonly string[]): void {
    void kontekst;
    if (this.zaustavljen || !this.ovisnosti.posaljiReakciju || botIds.length === 0) return;
    if (!this.konfiguracijePartija.has(partijaId)) {
      this.konfiguracijePartija.set(partijaId, structuredClone(this.ovisnosti.konfiguracija));
    }
    for (const igracId of botIds) {
      const poslani = this.poslaniPozdravi.get(partijaId) ?? new Set<string>();
      if (poslani.has(igracId)) continue;
      poslani.add(igracId);
      this.poslaniPozdravi.set(partijaId, poslani);
      const poruka = odaberiReakcijuNaPocetku(this.rngPrezentacije);
      this.zakaziReakciju(partijaId, igracId, poruka);
    }
  }

  /**
   * Eliminator (sorry-pool) i žrtva-bot (bravo-pool) kad postoji zaslužni protivnik.
   * Samoeliminacija / prekid bez bodZa → tišina za žrtvu.
   */
  naEliminaciju(
    partijaId: string,
    kontekst: DogadajPoteza['kontekst'],
    zrtvaId: string,
    bodZaId: string | null,
    sudionici: readonly { igracId: string; upravljac: 'covjek' | 'bot' }[],
    eliminacijaId: string,
  ): void {
    void kontekst;
    if (this.zaustavljen || !this.ovisnosti.posaljiReakciju) return;
    if (!this.konfiguracijePartija.has(partijaId)) {
      this.konfiguracijePartija.set(partijaId, structuredClone(this.ovisnosti.konfiguracija));
    }
    const jeBot = (igracId: string | null) => Boolean(igracId && sudionici.some((s) => s.igracId === igracId && s.upravljac === 'bot'));
    const snimka = this.aktualniPotezi.get(partijaId);
    if (snimka?.dokaz?.cekateljId === zrtvaId) {
      this.aktualniPotezi.set(partijaId, { ...snimka, dokaz: null });
    }
    if (jeBot(bodZaId) && bodZaId) {
      this.zakaziEliminacijskuReakciju(partijaId, bodZaId, eliminacijaId, 'sorry', odaberiReakcijuPriEliminacijiProtivnika(this.rngPrezentacije));
    }
    if (jeBot(zrtvaId) && bodZaId) {
      this.zakaziEliminacijskuReakciju(partijaId, zrtvaId, eliminacijaId, 'bravo', odaberiReakcijuPriIspadanju(this.rngPrezentacije));
    }
  }

  private zakaziEliminacijskuReakciju(
    partijaId: string,
    igracId: string,
    eliminacijaId: string,
    kategorija: Exclude<KategorijaReakcije, 'pozdrav'>,
    poruka: BrzaPoruka,
  ): void {
    const kljuc = `${partijaId}:${eliminacijaId}:${igracId}:${kategorija}`;
    if (this.poslaneEliminacijskeReakcije.has(kljuc)) return;
    this.poslaneEliminacijskeReakcije.add(kljuc);
    this.zakaziReakciju(partijaId, igracId, poruka);
  }

  private planiraj(dogadaj: DogadajPoteza): void {
    const prethodniPlan = this.planirano.get(dogadaj.partijaId);
    if (!dogadaj.zavrsena && !dogadaj.izborUToku && (prethodniPlan?.turnToken === dogadaj.turnToken || this.dovrseniTokeni.get(dogadaj.partijaId) === dogadaj.turnToken)) return;
    this.otkaziPlan(dogadaj.partijaId);
    if (this.zaustavljen) return;
    if (dogadaj.zavrsena) {
      this.stanjaPoPartiji.delete(dogadaj.partijaId);
      this.aktualniPotezi.delete(dogadaj.partijaId);
      this.dovrseniTokeni.delete(dogadaj.partijaId);
      this.konfiguracijePartija.delete(dogadaj.partijaId);
      this.odluke.delete(dogadaj.partijaId);
      this.predmemorije.delete(dogadaj.partijaId);
      this.poslaniPozdravi.delete(dogadaj.partijaId);
      this.ocistiEliminacijskeKljuceve(dogadaj.partijaId);
      // Zakazane reakcije smiju se još izvršiti nakon kraja; ne otkazujemo ih ovdje.
      return;
    }
    if (dogadaj.izborUToku || !dogadaj.naPotezuId || !dogadaj.trazenaSlova) return;
    const sudionik = dogadaj.sudionici.find((s) => s.igracId === dogadaj.naPotezuId);
    if (!sudionik || sudionik.upravljac !== 'bot' || !sudionik.aktivan) return;
    if (dogadaj.istekPotezaMs !== null && dogadaj.istekPotezaMs <= this.sada()) return;

    const stanjeBota = this.stanjeBota(dogadaj.partijaId, sudionik.igracId);
    if (stanjeBota.zadnjiToken !== dogadaj.turnToken) {
      stanjeBota.brojPoteza += 1;
      stanjeBota.zadnjiToken = dogadaj.turnToken;
    }

    const odluka = this.odluci(dogadaj, stanjeBota);
    const rok = dogadaj.istekPotezaMs === null ? null : Math.max(0, dogadaj.istekPotezaMs - this.sada());
    const izracunataOdgoda = trajanjeRazmisljanjaMs(rok, stanjeBota.konfiguracija, this.rngPrezentacije, dogadaj.kontekst, {
      punoTrajanjeMs: dogadaj.trajanjePotezaMs,
      protekloMs: Math.max(0, this.sada() - dogadaj.pocetakPotezaMs),
    });
    // Bez roka: staging QA 3 s s ljudima / 0,2 s bez njih; CI i privatno bez tajmera ostaju brzi.
    const odgoda = rok === null
      ? odgodaBezRokaMs(izracunataOdgoda, {
        kontekst: dogadaj.kontekst,
        imaAktivnogCovjeka: dogadaj.sudionici.some((s) => s.upravljac === 'covjek' && s.aktivan),
        okruzenje: this.okruzenje,
      })
      : izracunataOdgoda;
    const verzijaRjecnika = this.ovisnosti.rjecnik.verzijaRjecnika();
    const turnToken = dogadaj.turnToken;
    const handle = this.zakazi(() => {
      const plan = this.planirano.get(dogadaj.partijaId);
      if (!plan || plan.turnToken !== turnToken || plan.igracId !== sudionik.igracId) {
        this.brojaci.zastarjelo += 1;
        return;
      }
      this.planirano.delete(dogadaj.partijaId);
      try {
        const aktualni = this.aktualni(dogadaj, sudionik.igracId);
        if (!aktualni) { this.brojaci.zastarjelo += 1; return; }
        const svjezaOdluka = this.ovisnosti.rjecnik.verzijaRjecnika() === verzijaRjecnika ? odluka : this.odluci(aktualni, stanjeBota);
        this.izvrsi(aktualni, sudionik.igracId, turnToken, svjezaOdluka, 0, new Set());
      } catch (greska) {
        this.oporavi(dogadaj, sudionik.igracId, 0, new Set(), greska);
      }
    }, odgoda);
    this.planirano.set(dogadaj.partijaId, { handle, igracId: sudionik.igracId, turnToken, izvrsitiUMs: this.sada() + odgoda, vrsta: odluka.vrsta });
    this.ovisnosti.naAktivnost?.(sudionik.igracId);
    this.brojaci.planirano += 1;
  }

  zaustavi(): void {
    this.zaustavljen = true;
    for (const partijaId of [...this.planirano.keys()]) this.otkaziPlan(partijaId);
    for (const partijaId of [...this.zakazaneReakcije.keys()]) this.otkaziReakcije(partijaId);
    this.stanjaPoPartiji.clear();
    this.aktualniPotezi.clear();
    this.dovrseniTokeni.clear();
    this.konfiguracijePartija.clear();
    this.odluke.clear();
    this.predmemorije.clear();
    this.poslaniPozdravi.clear();
    this.poslaneEliminacijskeReakcije.clear();
    this.sljedecaReakcijaMs.clear();
  }

  brojPlaniranih(): number {
    return this.planirano.size;
  }

  pregledPlanova() {
    return [...this.aktualniPotezi.values()].flatMap((dogadaj) => {
      if (dogadaj.zavrsena || dogadaj.izborUToku || !dogadaj.naPotezuId || !dogadaj.sudionici.some((sudionik) => sudionik.igracId === dogadaj.naPotezuId && sudionik.upravljac === 'bot')) return [];
      const plan = this.planirano.get(dogadaj.partijaId);
      return [{
        partijaId: dogadaj.partijaId,
        igracId: dogadaj.naPotezuId,
        vrsta: plan?.vrsta ?? null,
        izvrsitiUMs: plan?.izvrsitiUMs ?? null,
        istekPotezaMs: dogadaj.istekPotezaMs,
        verzijaPolitike: this.konfiguracijePartija.get(dogadaj.partijaId)?.verzija ?? null,
      }];
    });
  }

  pregledGresaka() {
    return new Map([...this.greskePoBotu].map(([igracId, greska]) => [igracId, { ...greska }]));
  }

  private predmemorijaZa(partijaId: string): PredmemorijaLegalnosti {
    let predmemorija = this.predmemorije.get(partijaId);
    if (!predmemorija) {
      predmemorija = new PredmemorijaLegalnosti();
      this.predmemorije.set(partijaId, predmemorija);
    }
    return predmemorija;
  }

  private odluci(dogadaj: DogadajPoteza, stanjeBota: StanjeBotaUPartiji, odbijene: ReadonlySet<string> = new Set(), oporavak = false): OdlukaBota {
    const prethodna = this.odluke.get(dogadaj.partijaId);
    const ista = prethodna?.turnToken === dogadaj.turnToken ? prethodna : undefined;
    if (ista?.odluka.vrsta === 'odustani') return ista.odluka;
    const verzijaRjecnika = this.ovisnosti.rjecnik.verzijaRjecnika();
    if (ista?.odluka.vrsta === 'rijec' && !odbijene.has(ista.odluka.rijec) && ista.verzijaRjecnika === verzijaRjecnika) return ista.odluka;
    const kandidati = [...this.ovisnosti.rjecnik.igriviKandidati(dogadaj.trazenaSlova!, dogadaj.iskoristeneGrupe, dogadaj.dopusteneVrste)].filter((rijec) => !odbijene.has(rijec));
    if (ista?.odluka.vrsta === 'rijec' && !odbijene.has(ista.odluka.rijec) && (kandidati.includes(ista.odluka.rijec) || dogadaj.trazenaSlova === 'ka')) {
      ista.verzijaRjecnika = verzijaRjecnika;
      return ista.odluka;
    }
    const predmemorija = this.predmemorijaZa(dogadaj.partijaId);
    predmemorija.uskladiVerziju(verzijaRjecnika);
    const verzijaPotrosenih = `${dogadaj.iskoristeneGrupe.size}:${[...dogadaj.iskoristeneGrupe].slice(0, 32).sort().join(',')}`;
    const odluka = odaberiPotez({
      trazenaSlova: dogadaj.trazenaSlova!,
      kandidati,
      frekvencijaZa: (rijec) => this.ovisnosti.rjecnik.frekvencijaZa(rijec),
      grupeZa: (rijec) => this.ovisnosti.rjecnik.grupeZa(rijec),
      turnToken: dogadaj.turnToken,
      oporavak: oporavak || ista !== undefined,
      pravila: dogadaj.pravila ?? 'ka_zna',
      faza: dogadaj.faza ?? 'obican_potez',
      brojAktivnih: dogadaj.sudionici.filter((s) => s.aktivan).length,
      iskoristeneGrupe: dogadaj.iskoristeneGrupe,
      dopusteneVrste: dogadaj.dopusteneVrste,
      imaSlobodnuRijecNa: (prefiks, iskoristene, dopusteneVrste) =>
        this.ovisnosti.rjecnik.imaSlobodnuRijecNa(prefiks, iskoristene, dopusteneVrste),
      poznatiKandidatiNa: (prefiks, iskoristene) => {
        const frekvencijaZa = (rijec: string) => this.ovisnosti.rjecnik.frekvencijaZa(rijec);
        return [...this.ovisnosti.rjecnik.igriviKandidati(prefiks, iskoristene, dogadaj.dopusteneVrste)]
          .filter((rijec) => !jeNepoznataBotu(rijec, frekvencijaZa(rijec)));
      },
      predmemorija,
      verzijaRjecnika,
      verzijaPotrosenih,
    }, stanjeBota, stanjeBota.konfiguracija, this.rng);
    if (odluka.vrsta === 'rijec' && odluka.propustKa) this.brojaci.propustPrimljenogKa += 1;
    if (odluka.vrsta === 'rijec' && odluka.takticki) this.brojaci.taktickihPoteza += 1;
    if (odluka.vrsta === 'rijec' && odluka.izborKa && stanjeBota.zadnjiTokenKa !== dogadaj.turnToken) {
      stanjeBota.zadnjiTokenKa = dogadaj.turnToken;
      if (odluka.izborKa === 'dobrovoljni') this.brojaci.dobrovoljniKa += 1;
      else this.brojaci.prisilniKa += 1;
    }
    this.odluke.set(dogadaj.partijaId, { turnToken: dogadaj.turnToken, odluka, verzijaRjecnika });
    return odluka;
  }

  private izvrsi(
    dogadaj: DogadajPoteza,
    igracId: string,
    turnToken: string,
    odluka: OdlukaBota,
    pokusaj: number,
    odbijene: Set<string>,
  ): void {
    const naredba: NaredbaBota = odluka.vrsta === 'rijec'
      ? { vrsta: 'rijec', rijec: odluka.rijec, turnToken }
      : { vrsta: 'odustani', turnToken };
    let rezultat: RezultatNaredbe;
    try {
      rezultat = this.ovisnosti.izvrsiNaredbu(dogadaj.partijaId, igracId, naredba);
    } catch (greska) {
      this.oporavi(dogadaj, igracId, pokusaj, odbijene, greska);
      return;
    }
    if (rezultat.ishod === 'prihvacen') {
      this.ovisnosti.naAktivnost?.(igracId);
      if (this.aktualniPotezi.has(dogadaj.partijaId)) this.dovrseniTokeni.set(dogadaj.partijaId, turnToken);
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
    if (odluka.vrsta === 'rijec') odbijene.add(odluka.rijec);
    this.oporavi(dogadaj, igracId, pokusaj, odbijene, new Error(`Botova naredba odbijena: ${rezultat.kod}`));
  }

  private aktualni(dogadaj: DogadajPoteza, igracId: string): DogadajPoteza | null {
    const aktualni = this.ovisnosti.dohvatiPotez ? this.ovisnosti.dohvatiPotez(dogadaj.partijaId) : this.aktualniPotezi.get(dogadaj.partijaId);
    if (this.zaustavljen || !aktualni || aktualni.zavrsena || aktualni.izborUToku || aktualni.turnToken !== dogadaj.turnToken || aktualni.naPotezuId !== igracId || !aktualni.sudionici.some((sudionik) => sudionik.igracId === igracId && sudionik.upravljac === 'bot' && sudionik.aktivan)) return null;
    if (aktualni.istekPotezaMs !== null && aktualni.istekPotezaMs <= this.sada()) return null;
    return aktualni;
  }

  private oporavi(dogadaj: DogadajPoteza, igracId: string | null, pokusaj: number, odbijene: Set<string>, greska: unknown): void {
    this.brojaci.tehnickeGreske += 1;
    if (igracId) {
      const prethodna = this.greskePoBotu.get(igracId);
      this.greskePoBotu.set(igracId, {
        broj: (prethodna?.broj ?? 0) + 1,
        posljednja: greska instanceof Error ? greska.name.slice(0, 80) : 'nepoznata pogreška',
        vrijemeMs: this.sada(),
      });
      while (this.greskePoBotu.size > 100) {
        const najstariji = this.greskePoBotu.keys().next().value;
        if (najstariji === undefined) break;
        this.greskePoBotu.delete(najstariji);
      }
    }
    this.zapisi('Tehnička pogreška bota', { partijaId: dogadaj.partijaId, igracId, pokusaj, greska: greska instanceof Error ? greska.message : String(greska) });
    if (!igracId) return;
    const aktualni = this.aktualni(dogadaj, igracId);
    if (!aktualni) return;
    const preostalo = aktualni.istekPotezaMs === null ? Infinity : aktualni.istekPotezaMs - this.sada();
    const konfiguracija = this.konfiguracijePartija.get(dogadaj.partijaId) ?? this.ovisnosti.konfiguracija;
    if (pokusaj >= konfiguracija.maksimalnoOporavakaBota || preostalo <= 150) {
      this.dovrseniTokeni.set(dogadaj.partijaId, dogadaj.turnToken);
      this.ovisnosti.prekiniZbogGreske?.(dogadaj.partijaId, igracId, dogadaj.turnToken);
      return;
    }
    const posao = () => {
      const plan = this.planirano.get(dogadaj.partijaId);
      if (!plan || plan.turnToken !== dogadaj.turnToken || plan.igracId !== igracId) return;
      this.planirano.delete(dogadaj.partijaId);
      const svjezi = this.aktualni(dogadaj, igracId);
      if (!svjezi) return;
      try {
        const kandidati = [...this.ovisnosti.rjecnik.igriviKandidati(svjezi.trazenaSlova!, svjezi.iskoristeneGrupe, svjezi.dopusteneVrste)].filter((rijec) => !odbijene.has(rijec));
        if (kandidati.length === 0 && svjezi.trazenaSlova?.toLowerCase() !== 'ka') throw new Error('Nema preostalih kandidata tijekom tehničkog oporavka');
        const odluka = this.odluci(svjezi, this.stanjeBota(dogadaj.partijaId, igracId), odbijene, true);
        this.izvrsi(svjezi, igracId, dogadaj.turnToken, odluka, pokusaj + 1, odbijene);
      } catch (novaGreska) {
        this.oporavi(svjezi, igracId, pokusaj + 1, odbijene, novaGreska);
      }
    };
    try {
      const odmak = konfiguracija.odmaciOporavkaBotaMs[pokusaj] ?? konfiguracija.odmaciOporavkaBotaMs.at(-1) ?? 100;
      const odgoda = Math.min(odmak, preostalo - 150);
      const handle = this.zakazi(posao, odgoda);
      this.planirano.set(dogadaj.partijaId, { handle, igracId, turnToken: dogadaj.turnToken, izvrsitiUMs: this.sada() + odgoda, vrsta: 'oporavak' });
    } catch (greskaPlaniranja) {
      this.brojaci.tehnickeGreske += 1;
      this.zapisi('Nije moguće zakazati oporavak bota', { partijaId: dogadaj.partijaId, igracId, greska: greskaPlaniranja instanceof Error ? greskaPlaniranja.message : String(greskaPlaniranja) });
      this.dovrseniTokeni.set(dogadaj.partijaId, dogadaj.turnToken);
      this.ovisnosti.prekiniZbogGreske?.(dogadaj.partijaId, igracId, dogadaj.turnToken);
    }
  }

  private stanjeBota(partijaId: string, igracId: string): StanjeBotaUPartiji {
    let poIgracu = this.stanjaPoPartiji.get(partijaId);
    if (!poIgracu) {
      poIgracu = new Map();
      this.stanjaPoPartiji.set(partijaId, poIgracu);
    }
    let stanje = poIgracu.get(igracId);
    if (!stanje) {
      stanje = stvoriStanjeBota(this.konfiguracijePartija.get(partijaId) ?? this.ovisnosti.konfiguracija, this.rng);
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

  private kljucReakcijeIgraca(partijaId: string, igracId: string): string {
    return `${partijaId}:${igracId}`;
  }

  private zakaziReakciju(partijaId: string, igracId: string, poruka: BrzaPoruka): void {
    if (!this.ovisnosti.posaljiReakciju) return;
    const konfiguracija = this.konfiguracijePartija.get(partijaId) ?? this.ovisnosti.konfiguracija;
    const sada = this.sada();
    const kljucIgraca = this.kljucReakcijeIgraca(partijaId, igracId);
    const sljedeca = this.sljedecaReakcijaMs.get(kljucIgraca) ?? 0;
    const bazaOdgode = odgodaReakcijeMs(this.rngPrezentacije, konfiguracija);
    const cilj = Math.max(sada + bazaOdgode, sljedeca);
    const odgoda = Math.max(0, cilj - sada);
    // Rezerviraj slot unaprijed (+mala margina zbog setTimeout kašnjenja); nakon uspješnog emit-a usklađujemo.
    this.sljedecaReakcijaMs.set(kljucIgraca, cilj + 2_050);

    const ukloniHandle = (handle: NodeJS.Timeout) => {
      const red = this.zakazaneReakcije.get(partijaId);
      if (!red) return;
      const indeks = red.indexOf(handle);
      if (indeks >= 0) red.splice(indeks, 1);
      if (red.length === 0) this.zakazaneReakcije.delete(partijaId);
    };

    const pokusajPoslati = (preostaliPokusaji: number) => {
      if (this.zaustavljen) return;
      const uspjeh = this.ovisnosti.posaljiReakciju?.(partijaId, igracId, poruka);
      if (uspjeh) {
        this.brojaci.reakcijaPoslano += 1;
        this.sljedecaReakcijaMs.set(kljucIgraca, this.sada() + 2_000);
        return;
      }
      if (preostaliPokusaji <= 0) return;
      // Motor je odbio zbog RS-22 — ponovi nakon punog cooldowna.
      const retryHandle = this.zakazi(() => {
        ukloniHandle(retryHandle);
        pokusajPoslati(preostaliPokusaji - 1);
      }, 2_000);
      const red = this.zakazaneReakcije.get(partijaId) ?? [];
      red.push(retryHandle);
      this.zakazaneReakcije.set(partijaId, red);
      this.sljedecaReakcijaMs.set(kljucIgraca, this.sada() + 4_050);
    };

    const handle = this.zakazi(() => {
      ukloniHandle(handle);
      pokusajPoslati(1);
    }, odgoda);
    const red = this.zakazaneReakcije.get(partijaId) ?? [];
    red.push(handle);
    this.zakazaneReakcije.set(partijaId, red);
  }

  private otkaziReakcije(partijaId: string): void {
    const red = this.zakazaneReakcije.get(partijaId);
    if (!red) return;
    for (const handle of red) this.otkazi(handle);
    this.zakazaneReakcije.delete(partijaId);
  }

  private ocistiEliminacijskeKljuceve(partijaId: string): void {
    const prefiks = `${partijaId}:`;
    for (const kljuc of [...this.poslaneEliminacijskeReakcije]) {
      if (kljuc.startsWith(prefiks)) this.poslaneEliminacijskeReakcije.delete(kljuc);
    }
    for (const kljuc of [...this.sljedecaReakcijaMs.keys()]) {
      if (kljuc.startsWith(prefiks)) this.sljedecaReakcijaMs.delete(kljuc);
    }
  }
}
