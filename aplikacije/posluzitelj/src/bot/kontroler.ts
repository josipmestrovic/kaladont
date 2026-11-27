/**
 * Bot kontroler (ADR-017): sluša promjene poteza iz motora i za bota na potezu planira
 * točno jednu akciju po (partijaId, igracId, turnToken). Pri buđenju sve ponovno provjerava.
 *
 * PR01: fiksni tempo ~4 s (±jitter), obvezne reakcije u svim kontekstima, presentation RNG
 * odvojen od odluke o riječi; bez namjernog izostanka.
 * PR07: odaberiPotez dobiva pravilnik + broj aktivnih; čekač dokaza ne dobiva reakciju ispadanja.
 */
import type { BrzaPoruka, KontekstPartije, ProfilBotaIzazova } from 'zajednicko';
import type { DogadajPoteza, RezultatNaredbe } from '../igra/politika-ucinka.js';
import type { RjecnikUMemoriji } from '../rjecnik/ucitaj.js';
import type { KonfiguracijaBota } from './konfiguracija-bota.js';
import {
  BOT_POTEZ_BEZ_ROKA_MS,
  odaberiPotezNastavivo,
  odgodaBezRokaMs,
  potpisPotrosenihGrupa,
  PredmemorijaLegalnosti,
  stvoriStanjeBota,
  trajanjeRazmisljanjaMs,
  type OdlukaBota,
  type Rng,
  type StanjeBotaUPartiji,
} from './odabir-rijeci.js';
import { stvoriBotDebugTrag, type BotDebugTrag } from './bot-debug-trag.js';
import type { BotDebugPretplate } from './bot-debug-pretplata.js';
import { POLUGE_PROFILA_BOTA } from './profili-bota.js';
import {
  igriviKandidatiIzRepertoara,
  poznatiNastavciIzRepertoara,
  poznatiNastavciNastavivo,
  type SnimkaRepertoara,
} from './repertoar.js';
import {
  RasporedjivacOdziva,
  predajSetImmediate,
  type KontekstPosla,
} from './raspored-odziva.js';
import {
  odaberiReakcijuNaPocetku,
  odaberiReakcijuPriEliminacijiProtivnika,
  odaberiReakcijuPriIspadanju,
  odgodaBravoNakonNeZnamMs,
  odgodaPocetnogPozdravaMs,
  odgodaReakcijeMs,
} from './reakcije.js';

export type NaredbaBota =
  | { vrsta: 'rijec'; rijec: string; turnToken: string }
  | { vrsta: 'odustani'; turnToken: string };

/** Brza igra (javna): nakon toliko bot-duel poteza sljedeći bot forsira „Ne znam”. */
export const MAKS_POTEZA_BOT_DUELA_BRZA = 10;

/**
 * Koliko puta smijemo ponovno računati odluku zbog promjene verzije rječnika
 * unutar istog plana (sprječava beskonačni refresh loop).
 */
export const MAKS_OSVJEZAVANJA_VERZIJE_RJECNIKA = 2;

/** Namjerno / forsiranje „Ne znam” ostaje važeće i nakon refresh-a rječnika. */
function zadrziOdustaniPriPromjeniVerzije(odluka: OdlukaBota): boolean {
  if (odluka.vrsta !== 'odustani') return false;
  return odluka.razlog === 'namjerni_propust' || odluka.razlogInterni === 'bot_duel_limit';
}

export interface OvisnostiBotKontrolera {
  rjecnik: Pick<
    RjecnikUMemoriji,
    | 'igriviKandidati'
    | 'grupeZa'
    | 'verzijaRjecnika'
    | 'imaSlobodnuRijecNa'
    | 'imaSlobodnuRijecNaNastavivo'
    | 'repertoarBotova'
    | 'pooloviBotova'
    | 'jeIgrivaRijec'
  > & {
    frekvencijaZa(rijec: string): number | null;
  };
  rasporedOdziva?: RasporedjivacOdziva;
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
  /** Predaja event loopa tijekom nastavivog odabira (testovi mogu ubrizgati brojač). */
  predajKontrolu?: () => Promise<void>;
  zapisi?: (poruka: string, podaci: Record<string, unknown>) => void;
  dohvatiPotez?: (partijaId: string) => DogadajPoteza | null;
  prekiniZbogGreske?: (partijaId: string, igracId: string, turnToken: string) => void;
  naAktivnost?: (igracId: string) => void;
  /** NODE_ENV; staging uključuje QA tempo bez roka (3 s / 0,2 s). */
  okruzenje?: string;
  dohvatiNadimak?: (partijaId: string, igracId: string) => string;
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
  handle: NodeJS.Timeout | null;
  igracId: string;
  turnToken: string;
  izvrsitiUMs: number;
  /** null dok odluka još nije izračunata. */
  vrsta: 'rijec' | 'odustani' | 'oporavak' | null;
  /** Generacija posla — stari async rezultat ne smije dira noviji plan. */
  generacija: number;
  odluka?: OdlukaBota;
  odgodaIstekla?: boolean;
  snimkaGrupa?: ReadonlySet<string>;
  verzijaRjecnika?: number;
  /** Broj ponovnih izračuna zbog mismatcha verzije rječnika u ovom planu. */
  brojOsvjezavanjaVerzije?: number;
  /** Greška nastavivog odabira prije isteka odgode — obrada tek kad odgoda istekne. */
  greskaOdabira?: unknown;
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
  private readonly raspored: RasporedjivacOdziva;
  private readonly posloviRasporeda = new Map<string, number>();
  private readonly poslaniPozdravi = new Map<string, Set<string>>();
  /** Javna: pozdravi čekaju otvaranje 1. runde (stol), ne najavu u čekaonici. */
  private readonly cekajuciPozdraviJavne = new Map<string, readonly string[]>();
  private readonly poslaneEliminacijskeReakcije = new Set<string>();
  /** Sljedeći trenutak (ms) kad igrač smije novu reakciju zbog RS-22 (2 s). */
  private readonly sljedecaReakcijaMs = new Map<string, number>();
  /**
   * Javna partija s točno 2 aktivna bota (bez aktivnog čovjeka): broj planiranih poteza
   * od ulaska u bot-duel. Na 11. potezu forsira se „Ne znam” da se partija zatvori.
   */
  private readonly poteziBotDuela = new Map<string, { brojac: number; zadnjiToken: string }>();
  private readonly rng: Rng;
  private readonly rngPrezentacije: Rng;
  private readonly sada: () => number;
  private readonly zakazi: (posao: () => void, ms: number) => NodeJS.Timeout;
  private readonly otkazi: (handle: NodeJS.Timeout) => void;
  private readonly predajKontrolu: () => Promise<void>;
  private readonly zapisi: (poruka: string, podaci: Record<string, unknown>) => void;
  private readonly okruzenje: string;
  /** Aktivan debug trag po partiji+turnToken (oporavci dijele isti trag). */
  private readonly debugTragovi = new Map<string, BotDebugTrag>();
  private botDebugPretplate: BotDebugPretplate | null = null;
  private zaustavljen = false;
  private generacijaPosla = 0;
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
    this.raspored = ovisnosti.rasporedOdziva ?? new RasporedjivacOdziva();
    this.predajKontrolu = ovisnosti.predajKontrolu ?? predajSetImmediate;
    this.zapisi = ovisnosti.zapisi ?? (() => undefined);
    this.okruzenje = ovisnosti.okruzenje ?? process.env.NODE_ENV ?? 'development';
  }

  /**
   * Eksplicitni snapshot za Trening/Izazov — mora biti prije prvog događaja poteza.
   * Javna/privatna bez ovoga i dalje kloniraju globalni ovisnosti.konfiguracija.
   */
  postaviKonfiguracijuPartije(partijaId: string, konfiguracija: KonfiguracijaBota): void {
    this.konfiguracijePartija.set(partijaId, structuredClone(konfiguracija));
  }

  /** Test / dijagnostika: aktivni snapshot ili null. */
  dohvatiKonfiguracijuPartije(partijaId: string): KonfiguracijaBota | null {
    const snimka = this.konfiguracijePartija.get(partijaId);
    return snimka ? structuredClone(snimka) : null;
  }

  /** Staging: veže pretplate nakon što motor postoji (izbjegava kružnu ovisnost). */
  postaviBotDebugPretplate(pretplate: BotDebugPretplate | null): void {
    this.botDebugPretplate = pretplate;
  }

  private osigurajKonfiguracijuPartije(partijaId: string): KonfiguracijaBota {
    const postoji = this.konfiguracijePartija.get(partijaId);
    if (postoji) return postoji;
    const snimka = structuredClone(this.ovisnosti.konfiguracija);
    this.konfiguracijePartija.set(partijaId, snimka);
    return snimka;
  }

  naPromjenuPoteza(dogadaj: DogadajPoteza): void {
    if (this.zaustavljen) return;
    this.aktualniPotezi.set(dogadaj.partijaId, dogadaj);
    try {
      if (!dogadaj.zavrsena) this.osigurajKonfiguracijuPartije(dogadaj.partijaId);
      if (
        dogadaj.kontekst === 'javna'
        && !dogadaj.zavrsena
        && !dogadaj.izborUToku
        && this.cekajuciPozdraviJavne.has(dogadaj.partijaId)
      ) {
        const botIds = this.cekajuciPozdraviJavne.get(dogadaj.partijaId) ?? [];
        this.cekajuciPozdraviJavne.delete(dogadaj.partijaId);
        this.zakaziPocetnePozdrave(dogadaj.partijaId, 'javna', botIds);
      }
      this.planiraj(dogadaj);
    } catch (greska) {
      this.oporavi(dogadaj, dogadaj.naPotezuId, 0, new Set(), greska);
    }
  }

  /** Svaki bot pozdravi jednom na početku (javna, privatna). Trening/Izazov bez početnih pozdrava. */
  naPocetakPartije(partijaId: string, kontekst: DogadajPoteza['kontekst'], botIds: readonly string[]): void {
    if (this.zaustavljen || !this.ovisnosti.posaljiReakciju || botIds.length === 0) return;
    if (kontekst === 'trening' || kontekst === 'izazov') return;
    this.osigurajKonfiguracijuPartije(partijaId);
    if (kontekst === 'javna') {
      // Sidro = otvaranje 1. runde (vidljiv stol), ne najava u čekaonici.
      this.cekajuciPozdraviJavne.set(partijaId, [...botIds]);
      return;
    }
    this.zakaziPocetnePozdrave(partijaId, kontekst, botIds);
  }

  private zakaziPocetnePozdrave(
    partijaId: string,
    kontekst: KontekstPartije,
    botIds: readonly string[],
  ): void {
    let indeks = 0;
    for (const igracId of botIds) {
      const poslani = this.poslaniPozdravi.get(partijaId) ?? new Set<string>();
      if (poslani.has(igracId)) continue;
      poslani.add(igracId);
      this.poslaniPozdravi.set(partijaId, poslani);
      const poruka = odaberiReakcijuNaPocetku(this.rngPrezentacije);
      const odgodaMs = odgodaPocetnogPozdravaMs(kontekst, indeks, this.rngPrezentacije);
      this.zakaziReakciju(partijaId, igracId, poruka, odgodaMs);
      indeks += 1;
    }
  }

  /**
   * Eliminator (sorry-pool) i žrtva-bot (bravo-pool) kad postoji zaslužni protivnik.
   * Samoeliminacija / prekid bez bodZa → tišina za žrtvu.
   * Kod „Ne znam” bravo žrtve kasni dok klijent ne skine tužnu reakciju s istog sjedala.
   */
  naEliminaciju(
    partijaId: string,
    kontekst: DogadajPoteza['kontekst'],
    zrtvaId: string,
    bodZaId: string | null,
    sudionici: readonly { igracId: string; upravljac: 'covjek' | 'bot' }[],
    eliminacijaId: string,
    razlog?: string,
  ): void {
    void kontekst;
    if (this.zaustavljen || !this.ovisnosti.posaljiReakciju) return;
    this.osigurajKonfiguracijuPartije(partijaId);
    const jeBot = (igracId: string | null) => Boolean(igracId && sudionici.some((s) => s.igracId === igracId && s.upravljac === 'bot'));
    const snimka = this.aktualniPotezi.get(partijaId);
    if (snimka?.dokaz?.cekateljId === zrtvaId) {
      this.aktualniPotezi.set(partijaId, { ...snimka, dokaz: null });
    }
    if (jeBot(bodZaId) && bodZaId) {
      this.zakaziEliminacijskuReakciju(partijaId, bodZaId, eliminacijaId, 'sorry', odaberiReakcijuPriEliminacijiProtivnika(this.rngPrezentacije));
    }
    if (jeBot(zrtvaId) && bodZaId) {
      const konfiguracija = this.konfiguracijePartija.get(partijaId) ?? this.ovisnosti.konfiguracija;
      const bravoOdgoda = razlog === 'ne_znam'
        ? odgodaBravoNakonNeZnamMs(this.rngPrezentacije, konfiguracija)
        : undefined;
      this.zakaziEliminacijskuReakciju(
        partijaId,
        zrtvaId,
        eliminacijaId,
        'bravo',
        odaberiReakcijuPriIspadanju(this.rngPrezentacije),
        bravoOdgoda,
      );
    }
  }

  private zakaziEliminacijskuReakciju(
    partijaId: string,
    igracId: string,
    eliminacijaId: string,
    kategorija: Exclude<KategorijaReakcije, 'pozdrav'>,
    poruka: BrzaPoruka,
    fiksnaOdgodaMs?: number,
  ): void {
    const kljuc = `${partijaId}:${eliminacijaId}:${igracId}:${kategorija}`;
    if (this.poslaneEliminacijskeReakcije.has(kljuc)) return;
    this.poslaneEliminacijskeReakcije.add(kljuc);
    this.zakaziReakciju(partijaId, igracId, poruka, fiksnaOdgodaMs);
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
      this.poteziBotDuela.delete(dogadaj.partijaId);
      this.poslaniPozdravi.delete(dogadaj.partijaId);
      this.cekajuciPozdraviJavne.delete(dogadaj.partijaId);
      this.ocistiEliminacijskeKljuceve(dogadaj.partijaId);
      this.ocistiDebugTragovePartije(dogadaj.partijaId);
      // Zakazane reakcije smiju se još izvršiti nakon kraja; ne otkazujemo ih ovdje.
      return;
    }
    // Novi token (i kad je na redu čovjek) oslobađa cache prethodnog poteza.
    this.predmemorijaZa(dogadaj.partijaId).uskladiKontekst(dogadaj.turnToken, this.ovisnosti.rjecnik.verzijaRjecnika());
    if (dogadaj.izborUToku || !dogadaj.naPotezuId || !dogadaj.trazenaSlova) return;
    const sudionik = dogadaj.sudionici.find((s) => s.igracId === dogadaj.naPotezuId);
    if (!sudionik || sudionik.upravljac !== 'bot' || !sudionik.aktivan) return;
    if (dogadaj.istekPotezaMs !== null && dogadaj.istekPotezaMs <= this.sada()) return;

    const stanjeBota = this.stanjeBota(dogadaj.partijaId, sudionik.igracId);
    if (stanjeBota.zadnjiToken !== dogadaj.turnToken) {
      stanjeBota.brojPoteza += 1;
      stanjeBota.zadnjiToken = dogadaj.turnToken;
    }

    // Računanje tijekom prozora razmišljanja. Rasporedjivac odgađa prvi korak (setImmediate),
    // pa Socket.IO može flushati potez:prihvacen/stanje prije CPU-a odabira.
    const rok = dogadaj.istekPotezaMs === null ? null : Math.max(0, dogadaj.istekPotezaMs - this.sada());
    const imaAktivnogCovjeka = dogadaj.sudionici.some((s) => s.upravljac === 'covjek' && s.aktivan);
    const izracunataOdgoda = trajanjeRazmisljanjaMs(rok, stanjeBota.konfiguracija, this.rngPrezentacije, dogadaj.kontekst, {
      punoTrajanjeMs: dogadaj.trajanjePotezaMs,
      protekloMs: Math.max(0, this.sada() - dogadaj.pocetakPotezaMs),
    });
    // Javna bot-only završnica: i uz aktivan timer ubrzaj na ~200 ms (gledatelji ne čekaju normalni tempo).
    const odgoda = rok === null
      ? odgodaBezRokaMs(izracunataOdgoda, {
        kontekst: dogadaj.kontekst,
        imaAktivnogCovjeka,
        okruzenje: this.okruzenje,
      })
      : dogadaj.kontekst === 'javna' && !imaAktivnogCovjeka
        ? Math.min(izracunataOdgoda, BOT_POTEZ_BEZ_ROKA_MS)
        : izracunataOdgoda;
    const turnToken = dogadaj.turnToken;
    const generacija = ++this.generacijaPosla;
    const snimkaGrupa: ReadonlySet<string> = new Set(dogadaj.iskoristeneGrupe);
    const verzijaRjecnika = this.ovisnosti.rjecnik.verzijaRjecnika();

    const handle = this.zakazi(() => {
      const plan = this.planirano.get(dogadaj.partijaId);
      if (!plan || plan.generacija !== generacija || plan.turnToken !== turnToken || plan.igracId !== sudionik.igracId) {
        this.brojaci.zastarjelo += 1;
        return;
      }
      plan.odgodaIstekla = true;
      plan.handle = null;
      try {
        this.pokusajIzvrsitiPlan(dogadaj.partijaId, dogadaj, sudionik.igracId, stanjeBota);
      } catch (greska) {
        this.planirano.delete(dogadaj.partijaId);
        this.oporavi(dogadaj, sudionik.igracId, 0, new Set(), greska);
      }
    }, odgoda);

    this.planirano.set(dogadaj.partijaId, {
      handle,
      igracId: sudionik.igracId,
      turnToken,
      izvrsitiUMs: this.sada() + odgoda,
      vrsta: null,
      generacija,
      snimkaGrupa,
      verzijaRjecnika,
      odgodaIstekla: false,
    });
    this.ovisnosti.naAktivnost?.(sudionik.igracId);
    this.brojaci.planirano += 1;

    // Registriraj nastavivi izračun (overlap s odgodom razmišljanja; prvi korak nakon setImmediate).
    this.zakaziIzracunPlanNastavivo(dogadaj.partijaId, dogadaj, sudionik.igracId, stanjeBota, generacija, snimkaGrupa);
  }

  private jeAktualanPlan(partijaId: string, generacija: number, turnToken: string, igracId: string): boolean {
    if (this.zaustavljen) return false;
    const plan = this.planirano.get(partijaId);
    return !!plan && plan.generacija === generacija && plan.turnToken === turnToken && plan.igracId === igracId;
  }

  private zakaziIzracunPlanNastavivo(
    partijaId: string,
    dogadaj: DogadajPoteza,
    igracId: string,
    stanjeBota: StanjeBotaUPartiji,
    generacija: number,
    snimkaGrupa: ReadonlySet<string>,
  ): void {
    const postojeci = this.posloviRasporeda.get(partijaId);
    if (postojeci !== undefined) this.raspored.otkazi(postojeci);
    const aktivan = () => this.jeAktualanPlan(partijaId, generacija, dogadaj.turnToken, igracId);
    const id = this.raspored.prijavi(async ({ predaj }: KontekstPosla) => {
      if (!aktivan()) return 'odustani';
      try {
        // Verzija na početku izračuna — ne na kraju (inače refresh tijekom rada izgleda kao match).
        const verzijaZaOdluku = this.ovisnosti.rjecnik.verzijaRjecnika();
        // Scheduler-owned predaj: RR sliceovi između partija; event loop yield radi pump.
        const odluka = await this.odluciNastavivo(dogadaj, stanjeBota, snimkaGrupa, aktivan, new Set(), predaj);
        if (!aktivan()) return 'odustani';
        const plan = this.planirano.get(partijaId);
        if (!plan || plan.generacija !== generacija) return 'odustani';
        if (odluka) {
          plan.odluka = odluka;
          plan.vrsta = odluka.vrsta;
          plan.verzijaRjecnika = verzijaZaOdluku;
        }
        this.pokusajIzvrsitiPlan(partijaId, dogadaj, igracId, stanjeBota);
        return 'gotovo';
      } catch (greska) {
        if (!aktivan()) return 'odustani';
        const plan = this.planirano.get(partijaId);
        if (plan) {
          plan.greskaOdabira = greska;
          this.posloviRasporeda.delete(partijaId);
          if (plan.odgodaIstekla) {
            this.pokusajIzvrsitiPlan(partijaId, dogadaj, igracId, stanjeBota);
          }
        }
        return 'odustani';
      }
    });
    this.posloviRasporeda.set(partijaId, id);
  }

  private pokusajIzvrsitiPlan(
    partijaId: string,
    dogadaj: DogadajPoteza,
    igracId: string,
    stanjeBota: StanjeBotaUPartiji,
  ): void {
    const plan = this.planirano.get(partijaId);
    const snimka = this.aktualniPotezi.get(partijaId);
    const dogadajAktualni = snimka && plan && snimka.turnToken === plan.turnToken ? snimka : dogadaj;
    if (!plan || !plan.odgodaIstekla) return;
    const aktualniRano = this.aktualni(dogadajAktualni, igracId);
    if (!aktualniRano || aktualniRano.turnToken !== plan.turnToken) {
      this.brojaci.zastarjelo += 1;
      this.posloviRasporeda.delete(partijaId);
      this.planirano.delete(partijaId);
      return;
    }
    if (!plan.odluka) {
      if (plan.greskaOdabira) {
        this.posloviRasporeda.delete(partijaId);
        this.planirano.delete(partijaId);
        this.oporavi(dogadajAktualni, igracId, 0, new Set(), plan.greskaOdabira);
      }
      return;
    }
    const turnToken = plan.turnToken;
    const odluka = plan.odluka;
    const verzijaPriPlanu = plan.verzijaRjecnika;
    const snimkaGrupaPlan = plan.snimkaGrupa;
    const generacijaPlan = plan.generacija;
    if (this.zaustavljen) {
      this.posloviRasporeda.delete(partijaId);
      this.planirano.delete(partijaId);
      this.brojaci.zastarjelo += 1;
      return;
    }
    try {
      const aktualni = this.aktualni(dogadajAktualni, igracId);
      if (!aktualni || aktualni.turnToken !== turnToken) {
        this.posloviRasporeda.delete(partijaId);
        this.planirano.delete(partijaId);
        this.brojaci.zastarjelo += 1;
        return;
      }
      if (verzijaPriPlanu !== undefined && this.ovisnosti.rjecnik.verzijaRjecnika() !== verzijaPriPlanu) {
        // namjerni_propust / bot_duel_limit: zadrži odluku. nema_rijeci i rijec: osvježi.
        if (zadrziOdustaniPriPromjeniVerzije(odluka)) {
          this.posloviRasporeda.delete(partijaId);
          this.planirano.delete(partijaId);
          this.izvrsi(aktualni, igracId, turnToken, odluka, 0, new Set());
          return;
        }
        const brojOsvjezavanja = (plan.brojOsvjezavanjaVerzije ?? 0) + 1;
        if (brojOsvjezavanja > MAKS_OSVJEZAVANJA_VERZIJE_RJECNIKA) {
          this.posloviRasporeda.delete(partijaId);
          this.planirano.delete(partijaId);
          this.izvrsi(aktualni, igracId, turnToken, odluka, 0, new Set());
          return;
        }
        plan.brojOsvjezavanjaVerzije = brojOsvjezavanja;
        plan.odluka = undefined;
        plan.vrsta = null;
        plan.verzijaRjecnika = undefined;
        // Očisti predmemoriranu odluku istog tokena da odluciNastavivo ne vrati stale nema_rijeci.
        const predmemorirana = this.odluke.get(partijaId);
        if (
          predmemorirana?.turnToken === turnToken
          && !(predmemorirana.odluka.vrsta === 'odustani' && zadrziOdustaniPriPromjeniVerzije(predmemorirana.odluka))
        ) {
          this.odluke.delete(partijaId);
        }
        this.zakaziIzracunPlanNastavivo(
          partijaId,
          dogadajAktualni,
          igracId,
          stanjeBota,
          generacijaPlan,
          snimkaGrupaPlan ?? dogadajAktualni.iskoristeneGrupe,
        );
        return;
      }
      this.posloviRasporeda.delete(partijaId);
      this.planirano.delete(partijaId);
      this.izvrsi(aktualni, igracId, turnToken, odluka, 0, new Set());
    } catch (greska) {
      this.posloviRasporeda.delete(partijaId);
      this.planirano.delete(partijaId);
      this.oporavi(dogadajAktualni, igracId, 0, new Set(), greska);
    }
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
    this.cekajuciPozdraviJavne.clear();
    this.poslaneEliminacijskeReakcije.clear();
    this.sljedecaReakcijaMs.clear();
    this.poteziBotDuela.clear();
    this.debugTragovi.clear();
  }

  /** Javna Brza igra: točno 2 aktivna bota, bez aktivnog čovjeka. */
  private jeBotDuelBrzeIgre(dogadaj: DogadajPoteza): boolean {
    if (dogadaj.kontekst !== 'javna') return false;
    const aktivni = dogadaj.sudionici.filter((s) => s.aktivan);
    return aktivni.length === 2 && aktivni.every((s) => s.upravljac === 'bot');
  }

  /** Broji poteze bot-duela jednom po turnTokenu; vraća true kad treba forsirati „Ne znam”. */
  private azurirajBotDuelIForsiraj(dogadaj: DogadajPoteza): boolean {
    if (!this.jeBotDuelBrzeIgre(dogadaj)) {
      this.poteziBotDuela.delete(dogadaj.partijaId);
      return false;
    }
    let stanje = this.poteziBotDuela.get(dogadaj.partijaId);
    if (!stanje) {
      stanje = { brojac: 0, zadnjiToken: '' };
      this.poteziBotDuela.set(dogadaj.partijaId, stanje);
    }
    if (stanje.zadnjiToken !== dogadaj.turnToken) {
      stanje.brojac += 1;
      stanje.zadnjiToken = dogadaj.turnToken;
    }
    return stanje.brojac > MAKS_POTEZA_BOT_DUELA_BRZA;
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

  private snimkaRepertoara(): SnimkaRepertoara {
    return this.ovisnosti.rjecnik.repertoarBotova();
  }

  /**
   * Sinkroni snapshot kandidata — može sam premašiti BUDZET_SLICE_MS na velikom prefiksu.
   * Isto vrijedi za klasificirajPoznatiSkup u odabiru; sken rječnika nije u ovom commitu.
   */
  private kandidatiZaPotez(
    trazenaSlova: string,
    iskoristene: ReadonlySet<string>,
    dopusteneVrste?: DogadajPoteza['dopusteneVrste'],
  ): string[] {
    const snimka = this.snimkaRepertoara();
    const rjecnik = this.ovisnosti.rjecnik;
    const provjeri = (rijec: string) => rjecnik.jeIgrivaRijec(rijec, iskoristene, dopusteneVrste);
    return [...igriviKandidatiIzRepertoara(snimka, trazenaSlova, provjeri)];
  }

  private poznatiNastavciIterator(
    prefiks: string,
    potrosene: ReadonlySet<string>,
    dopusteneVrste: DogadajPoteza['dopusteneVrste'],
    aktivan: () => boolean,
    predaj: () => Promise<void>,
  ): AsyncIterable<string> {
    const snimka = this.snimkaRepertoara();
    const rjecnik = this.ovisnosti.rjecnik;
    const provjeri = (rijec: string) => rjecnik.jeIgrivaRijec(rijec, potrosene, dopusteneVrste);
    return poznatiNastavciNastavivo(snimka, prefiks, provjeri, predaj, aktivan);
  }

  private predmemorijaZa(partijaId: string): PredmemorijaLegalnosti {
    let predmemorija = this.predmemorije.get(partijaId);
    if (!predmemorija) {
      predmemorija = new PredmemorijaLegalnosti();
      this.predmemorije.set(partijaId, predmemorija);
    }
    return predmemorija;
  }

  private zabiljeziOdluku(odluka: OdlukaBota, stanjeBota: StanjeBotaUPartiji, turnToken: string, verzijaRjecnika: number, partijaId: string): void {
    if (odluka.vrsta === 'rijec' && odluka.propustKa) this.brojaci.propustPrimljenogKa += 1;
    if (odluka.vrsta === 'rijec' && odluka.izPoola) this.brojaci.taktickihPoteza += 1;
    if (odluka.vrsta === 'rijec' && odluka.izborKa && stanjeBota.zadnjiTokenKa !== turnToken) {
      stanjeBota.zadnjiTokenKa = turnToken;
      if (odluka.izborKa === 'dobrovoljni') this.brojaci.dobrovoljniKa += 1;
      else this.brojaci.prisilniKa += 1;
    }
    this.odluke.set(partijaId, { turnToken, odluka, verzijaRjecnika });
  }

  private kljucDebugTraga(partijaId: string, turnToken: string): string {
    return `${partijaId}:${turnToken}`;
  }

  private ocistiDebugTragovePartije(partijaId: string): void {
    const prefiks = `${partijaId}:`;
    for (const kljuc of [...this.debugTragovi.keys()]) {
      if (kljuc.startsWith(prefiks)) this.debugTragovi.delete(kljuc);
    }
  }

  private osigurajDebugTrag(dogadaj: DogadajPoteza, oporavak: boolean): BotDebugTrag {
    const kljuc = this.kljucDebugTraga(dogadaj.partijaId, dogadaj.turnToken);
    const postojeci = this.debugTragovi.get(kljuc);
    if (postojeci) {
      if (oporavak && postojeci.aktivan) postojeci.zapisiPosebno('oporavak');
      return postojeci;
    }
    const ukljuci = !!this.botDebugPretplate?.imaPretplatnika(dogadaj.partijaId)
      && dogadaj.kontekst !== 'privatna';
    const trag = stvoriBotDebugTrag(ukljuci);
    // Ne-op tragove ne držimo u mapi (produkcija / bez pretplatnika).
    if (trag.aktivan) this.debugTragovi.set(kljuc, trag);
    if (oporavak && trag.aktivan) trag.zapisiPosebno('oporavak');
    return trag;
  }

  private profilZaKonfig(konfig: KonfiguracijaBota): ProfilBotaIzazova {
    for (const [id, poluge] of Object.entries(POLUGE_PROFILA_BOTA) as Array<[ProfilBotaIzazova, typeof POLUGE_PROFILA_BOTA[ProfilBotaIzazova]]>) {
      if (
        poluge.vjerojatnostAgresivnosti === konfig.vjerojatnostAgresivnosti
        && poluge.vjerojatnostShielda === konfig.vjerojatnostShielda
        && poluge.prioritetPoolova === konfig.prioritetPoolova
      ) {
        return id;
      }
    }
    return 'iskusni';
  }

  private objaviDebugZapis(
    dogadaj: DogadajPoteza,
    igracId: string,
    trag: BotDebugTrag,
    pokusaj: number,
  ): void {
    try {
      const pretplate = this.botDebugPretplate;
      if (!pretplate || !trag.aktivan) return;
      const poolovi = this.ovisnosti.rjecnik.pooloviBotova();
      const zapis = trag.izgradiZapis({
        partijaId: dogadaj.partijaId,
        igracId,
        nadimak: this.ovisnosti.dohvatiNadimak?.(dogadaj.partijaId, igracId) ?? igracId,
        profil: this.profilZaKonfig(this.osigurajKonfiguracijuPartije(dogadaj.partijaId)),
        redniBrojPoteza: this.stanjeBota(dogadaj.partijaId, igracId).brojPoteza,
        turnToken: dogadaj.turnToken,
        brojAktivnih: dogadaj.sudionici.filter((s) => s.aktivan).length,
        trazenaSlova: dogadaj.trazenaSlova ?? '',
        verzijaRjecnika: this.ovisnosti.rjecnik.verzijaRjecnika(),
        generacijaPoolova: poolovi.generacija,
        pokusaj,
      });
      if (zapis) pretplate.objavi(dogadaj.partijaId, zapis);
    } catch (greska) {
      this.zapisi('Bot debug emit nije uspio', {
        partijaId: dogadaj.partijaId,
        greska: greska instanceof Error ? greska.message : String(greska),
      });
    }
  }

  private async odluciNastavivo(
    dogadaj: DogadajPoteza,
    stanjeBota: StanjeBotaUPartiji,
    snimkaGrupa: ReadonlySet<string>,
    aktivan: () => boolean,
    odbijene: ReadonlySet<string> = new Set(),
    predaj: () => Promise<void> = this.predajKontrolu,
    kandidatiPretpostavljeni?: readonly string[],
  ): Promise<OdlukaBota | null> {
    if (!aktivan()) return null;
    const verzijaRjecnika = this.ovisnosti.rjecnik.verzijaRjecnika();
    const prethodna = this.odluke.get(dogadaj.partijaId);
    const ista = prethodna?.turnToken === dogadaj.turnToken ? prethodna : undefined;
    const trag = this.osigurajDebugTrag(dogadaj, ista !== undefined && odbijene.size > 0);
    const t0 = this.sada();
    if (ista?.odluka.vrsta === 'odustani' && zadrziOdustaniPriPromjeniVerzije(ista.odluka)) {
      return ista.odluka;
    }
    if (this.azurirajBotDuelIForsiraj(dogadaj) && dogadaj.trazenaSlova !== 'ka') {
      const forsiran: OdlukaBota = {
        vrsta: 'odustani',
        razlog: 'namjerni_propust',
        razlogInterni: 'bot_duel_limit',
      };
      trag.zapisiPosebno('bot_duel_limit');
      trag.zapisiTrajanjeIzracuna(this.sada() - t0);
      this.zabiljeziOdluku(forsiran, stanjeBota, dogadaj.turnToken, verzijaRjecnika, dogadaj.partijaId);
      return forsiran;
    }
    // nema_rijeci: samo uz istu verziju rječnika — inače ponovni izračun (nova riječ nakon refresh-a).
    if (ista?.odluka.vrsta === 'odustani' && ista.verzijaRjecnika === verzijaRjecnika) return ista.odluka;
    if (ista?.odluka.vrsta === 'rijec' && !odbijene.has(ista.odluka.rijec) && ista.verzijaRjecnika === verzijaRjecnika) return ista.odluka;
    if (ista && ista.verzijaRjecnika !== verzijaRjecnika && trag.aktivan) {
      trag.zapisiPosebno('ponovni_izracun_rjecnika');
    }
    if (dogadaj.trazenaSlova === 'ka' && !odbijene.has('kaladont')) {
      stanjeBota.brojKandidata = 1;
      const kaladont: OdlukaBota = { vrsta: 'rijec', rijec: 'kaladont', kategorija: 'kaladont' };
      trag.zapisiPosebno('primljeni_ka');
      trag.zapisiIzvor('kaladont', 'kaladont');
      trag.zapisiTrajanjeIzracuna(this.sada() - t0);
      this.zabiljeziOdluku(kaladont, stanjeBota, dogadaj.turnToken, verzijaRjecnika, dogadaj.partijaId);
      return kaladont;
    }
    if (dogadaj.trazenaSlova === 'ka' && odbijene.has('kaladont')) {
      const odustani: OdlukaBota = { vrsta: 'odustani', razlog: 'nema_rijeci' };
      trag.zapisiPosebno('nema_rijeci');
      trag.zapisiTrajanjeIzracuna(this.sada() - t0);
      this.zabiljeziOdluku(odustani, stanjeBota, dogadaj.turnToken, verzijaRjecnika, dogadaj.partijaId);
      return odustani;
    }
    const kandidati = kandidatiPretpostavljeni
      ? [...kandidatiPretpostavljeni]
      : this.kandidatiZaPotez(dogadaj.trazenaSlova!, snimkaGrupa, dogadaj.dopusteneVrste).filter((rijec) => !odbijene.has(rijec));
    if (ista?.odluka.vrsta === 'rijec' && !odbijene.has(ista.odluka.rijec) && (kandidati.includes(ista.odluka.rijec) || dogadaj.trazenaSlova === 'ka')) {
      ista.verzijaRjecnika = verzijaRjecnika;
      return ista.odluka;
    }
    if (!aktivan()) return null;
    const predmemorija = this.predmemorijaZa(dogadaj.partijaId);
    predmemorija.uskladiKontekst(dogadaj.turnToken, verzijaRjecnika, potpisPotrosenihGrupa(snimkaGrupa));
    const rjecnik = this.ovisnosti.rjecnik;
    const dopusteneVrste = dogadaj.dopusteneVrste;
    const odluka = await odaberiPotezNastavivo({
      trazenaSlova: dogadaj.trazenaSlova!,
      kandidati,
      frekvencijaZa: (rijec) => rjecnik.frekvencijaZa(rijec),
      grupeZa: (rijec) => rjecnik.grupeZa(rijec),
      turnToken: dogadaj.turnToken,
      oporavak: ista !== undefined,
      pravila: dogadaj.pravila ?? 'klasicni',
      faza: dogadaj.faza ?? 'obican_potez',
      brojAktivnih: dogadaj.sudionici.filter((s) => s.aktivan).length,
      iskoristeneGrupe: snimkaGrupa,
      dopusteneVrste,
      imaSlobodnuRijecNa: (prefiks, potrosene, vrste) =>
        rjecnik.imaSlobodnuRijecNa(prefiks, potrosene, vrste),
      imaSlobodnuRijecNaNastavivo: (prefiks, potrosene, predajFn, aktivanFn, vrste) =>
        rjecnik.imaSlobodnuRijecNaNastavivo(prefiks, potrosene, predajFn, aktivanFn, vrste),
      dohvatiVerzijuRjecnika: () => rjecnik.verzijaRjecnika(),
      poznatiKandidatiNa: (prefiks, potrosene) => {
        const snimka = this.snimkaRepertoara();
        const provjeri = (rijec: string) => rjecnik.jeIgrivaRijec(rijec, potrosene, dopusteneVrste);
        return poznatiNastavciIzRepertoara(snimka, prefiks, provjeri);
      },
      poznatiKandidatiNaNastavivo: (prefiks, potrosene) =>
        this.poznatiNastavciIterator(prefiks, potrosene, dopusteneVrste, aktivan, predaj),
      poolovi: rjecnik.pooloviBotova(),
      jeIgrivaRijec: (rijec, potrosene, vrste) => rjecnik.jeIgrivaRijec(rijec, potrosene, vrste),
      odbijeneRijeci: odbijene,
      predmemorija,
      verzijaRjecnika,
      debugTrag: trag.aktivan ? trag : undefined,
    }, stanjeBota, stanjeBota.konfiguracija, this.rng, predaj, aktivan);
    trag.zapisiTrajanjeIzracuna(this.sada() - t0);
    if (!odluka || !aktivan()) {
      if (!odluka && trag.aktivan) {
        trag.zapisiPosebno('otkazan_zastarjeli');
        trag.zapisiIshod('otkazan');
      }
      return odluka;
    }
    this.zabiljeziOdluku(odluka, stanjeBota, dogadaj.turnToken, verzijaRjecnika, dogadaj.partijaId);
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
    const trag = this.debugTragovi.get(this.kljucDebugTraga(dogadaj.partijaId, turnToken));
    if (rezultat.ishod === 'prihvacen') {
      this.ovisnosti.naAktivnost?.(igracId);
      if (this.aktualniPotezi.has(dogadaj.partijaId)) this.dovrseniTokeni.set(dogadaj.partijaId, turnToken);
      if (odluka.vrsta === 'rijec') this.brojaci.odigranihRijeci += 1;
      else if (odluka.razlog === 'namjerni_propust') this.brojaci.namjernihPropusta += 1;
      else this.brojaci.bezRijeci += 1;
      if (trag) {
        trag.zapisiIshod(odluka.vrsta === 'odustani' ? 'odustani' : 'prihvacen');
        this.objaviDebugZapis(dogadaj, igracId, trag, pokusaj);
        this.debugTragovi.delete(this.kljucDebugTraga(dogadaj.partijaId, turnToken));
      }
      return;
    }
    if (rezultat.ishod === 'ignoriran') {
      this.brojaci.zastarjelo += 1;
      if (trag) {
        trag.zapisiIshod('ignoriran');
        trag.zapisiPosebno('otkazan_zastarjeli');
        this.objaviDebugZapis(dogadaj, igracId, trag, pokusaj);
        this.debugTragovi.delete(this.kljucDebugTraga(dogadaj.partijaId, turnToken));
      }
      return;
    }
    if (rezultat.kod === 'STARI_TURN_TOKEN' || rezultat.kod === 'NIJE_TVOJ_POTEZ' || rezultat.kod === 'SUSTAV_BIRA_RIJEC') {
      this.brojaci.zastarjelo += 1;
      if (trag) {
        trag.zapisiIshod('otkazan');
        trag.zapisiPosebno('otkazan_zastarjeli');
        this.objaviDebugZapis(dogadaj, igracId, trag, pokusaj);
        this.debugTragovi.delete(this.kljucDebugTraga(dogadaj.partijaId, turnToken));
      }
      return;
    }
    if (trag) {
      trag.zapisiIshod('odbijen');
      this.objaviDebugZapis(dogadaj, igracId, trag, pokusaj);
      // Zadrži trag za oporavak istog tokena (novi pokušaj se dodaje).
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
      const generacija = plan.generacija;
      const svjezi = this.aktualni(dogadaj, igracId);
      if (!svjezi) {
        this.planirano.delete(dogadaj.partijaId);
        return;
      }
      void this.pokreniOporavakNastavivo(dogadaj.partijaId, svjezi, igracId, pokusaj + 1, odbijene, generacija);
    };
    try {
      const odmak = konfiguracija.odmaciOporavkaBotaMs[pokusaj] ?? konfiguracija.odmaciOporavkaBotaMs.at(-1) ?? 100;
      const odgoda = Math.min(odmak, preostalo - 150);
      const handle = this.zakazi(posao, odgoda);
      this.planirano.set(dogadaj.partijaId, {
        handle,
        igracId,
        turnToken: dogadaj.turnToken,
        izvrsitiUMs: this.sada() + odgoda,
        vrsta: 'oporavak',
        generacija: ++this.generacijaPosla,
        odgodaIstekla: true,
      });
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

  private async pokreniOporavakNastavivo(
    partijaId: string,
    dogadaj: DogadajPoteza,
    igracId: string,
    pokusaj: number,
    odbijene: Set<string>,
    generacijaOporavka?: number,
  ): Promise<void> {
    const stanjeBota = this.stanjeBota(partijaId, igracId);
    const generacija = generacijaOporavka ?? ++this.generacijaPosla;
    const aktivan = () => this.jeAktualanPlan(partijaId, generacija, dogadaj.turnToken, igracId);

    const postojeci = this.posloviRasporeda.get(partijaId);
    if (postojeci !== undefined) this.raspored.otkazi(postojeci);

    const id = this.raspored.prijavi(async ({ predaj }: KontekstPosla) => {
      if (!aktivan()) return 'odustani';
      try {
        if (dogadaj.trazenaSlova === 'ka' && odbijene.has('kaladont')) {
          if (!aktivan()) return 'odustani';
          this.izvrsi(
            dogadaj,
            igracId,
            dogadaj.turnToken,
            { vrsta: 'odustani', razlog: 'nema_rijeci' },
            pokusaj,
            odbijene,
          );
          return 'gotovo';
        }
        const preskociSkupljanje = dogadaj.trazenaSlova === 'ka' && !odbijene.has('kaladont');
        let odluka: OdlukaBota | null;
        if (preskociSkupljanje) {
          odluka = await this.odluciNastavivo(
            dogadaj,
            stanjeBota,
            dogadaj.iskoristeneGrupe,
            aktivan,
            odbijene,
            predaj,
          );
        } else {
          // Prikupljanje unutar raspoređivača (zajednički CPU budžet / RR).
          // Prazan obični repertoar ≠ odmah odustani: poolovi mogu imati legalne kandidate.
          const kandidati = this.kandidatiZaPotez(
            dogadaj.trazenaSlova!,
            dogadaj.iskoristeneGrupe,
            dogadaj.dopusteneVrste,
          ).filter((rijec) => !odbijene.has(rijec));
          odluka = await this.odluciNastavivo(
            dogadaj,
            stanjeBota,
            dogadaj.iskoristeneGrupe,
            aktivan,
            odbijene,
            predaj,
            kandidati,
          );
        }
        if (!odluka || !aktivan()) return 'odustani';
        this.izvrsi(dogadaj, igracId, dogadaj.turnToken, odluka, pokusaj, odbijene);
        return 'gotovo';
      } catch (novaGreska) {
        if (!aktivan()) return 'odustani';
        this.oporaviNastavivo(dogadaj, igracId, pokusaj, odbijene, novaGreska);
        return 'odustani';
      } finally {
        // Ne briši noviji handle ako je izvrsi sinkrono registrirao novi posao.
        if (this.posloviRasporeda.get(partijaId) === id) {
          this.posloviRasporeda.delete(partijaId);
        }
        const plan = this.planirano.get(partijaId);
        if (plan?.generacija === generacija && plan.vrsta === 'oporavak') {
          this.planirano.delete(partijaId);
        }
      }
    });
    this.posloviRasporeda.set(partijaId, id);
  }

  private oporaviNastavivo(
    dogadaj: DogadajPoteza,
    igracId: string | null,
    pokusaj: number,
    odbijene: Set<string>,
    greska: unknown,
  ): void {
    this.oporavi(dogadaj, igracId, pokusaj, odbijene, greska);
  }

  private otkaziPlan(partijaId: string): void {
    const plan = this.planirano.get(partijaId);
    if (!plan) return;
    if (plan.handle) this.otkazi(plan.handle);
    const posaoId = this.posloviRasporeda.get(partijaId);
    if (posaoId !== undefined) {
      this.raspored.otkazi(posaoId);
      this.posloviRasporeda.delete(partijaId);
    }
    this.planirano.delete(partijaId);
  }

  private kljucReakcijeIgraca(partijaId: string, igracId: string): string {
    return `${partijaId}:${igracId}`;
  }

  private zakaziReakciju(
    partijaId: string,
    igracId: string,
    poruka: BrzaPoruka,
    fiksnaOdgodaMs?: number,
  ): void {
    if (!this.ovisnosti.posaljiReakciju) return;
    const konfiguracija = this.konfiguracijePartija.get(partijaId) ?? this.ovisnosti.konfiguracija;
    const sada = this.sada();
    const kljucIgraca = this.kljucReakcijeIgraca(partijaId, igracId);
    const sljedeca = this.sljedecaReakcijaMs.get(kljucIgraca) ?? 0;
    const bazaOdgode = fiksnaOdgodaMs ?? odgodaReakcijeMs(this.rngPrezentacije, konfiguracija);
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
