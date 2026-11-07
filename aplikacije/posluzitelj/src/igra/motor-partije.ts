/**
 * Motor jedne partije - stanje stola u memoriji (pregled-arhitekture.md: engine partije).
 * Server je jedini autoritet; poslužitelj je sat (RS-14).
 */
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { omotajSocketHandler, type ZapisSocketHandlerGreske } from '../sigurnost/socket-handler.js';
import { and, eq, inArray } from 'drizzle-orm';
import { konfiguracija } from '../konfiguracija.js';
import { promijesajNiz } from './raspored-sjedala.js';
import {
  validirajPotez,
  odrediRazlogMrtvihSlova,
  izracunajBodove,
  izracunajRang,
  stanjeIskustva,
  grafemi,
  prvaDva,
  PRAGOVI_DULJINE,
  zadnjaDva,
  PORUKE,
  RIJECI_KALADONT,
  izracunajNagraduZaRijec,
  izracunajObracunIskustva,
  iskustvoZaDuljinu,
  iskustvoZaRijetkost,
  tierDuljineIskustva,
  tierRijetkostiIskustva,
  projektirajOznakeNovihRijeci,
  type TierDuljineIskustva,
  type TierRijetkostiIskustva,
  ISKUSTVO_PRIHVACENA_RIJEC,
  ISKUSTVO_KALADONT,
  ISKUSTVO_ELIMINACIJA,
  ISKUSTVO_POBJEDA,
  MAKSIMALNO_ISKUSTVO,
  DEFINICIJE_DOSTIGNUCA,
  izracunajNovaDostignuca,
  razinaVatre,
  type StavkaIskustva,
  type RjecnikSucelje,
  type RazlogEliminacije,
  type NacinIspadanja,
  kolekcijskiKljucGrupe,
  kolekcionarskaRazina,
  PRAGOVI_KOLEKCIONARSKE_RAZINE,
  osnovnaRijecIzGrupe,
  type PocetakPartije,
  type PrihvacenPotez,
  type Eliminacija,
  type KrajPartije,
  type SustavBiraRijec,
  type RundaOtvorena,
  type StanjePartije,
  type PostavkePrivatneSobe,
  type VrstaRijeci,
  type DeltaNapretkaDostignuca,
  type KontekstPartije,
  type BrzaPoruka,
  type IzvorPocetneRijeci,
} from 'zajednicko';
import type { KaladontIo, KaladontSocket } from '../server.js';
import { baza } from '../baza/klijent.js';
import { igraci, napredakDostignucaIgraca, otkljucaneGrupeIgraca, otkljucaneRijeciIgraca } from '../baza/shema.js';
import type { StavkaReda } from '../red/red-cekanja.js';
import { osigurajUpisePoteza, ponistiPartijeUTijekuUBazi, spremiRaniPorazUBazi, zapisiPocetakPartije, zapisiPotez, zakljuciPartijuUBazi, type ZapisPoteza, type ZapisStatistikeRijeci } from './upis-partije.js';
import type { ProvjeriOgranicenjeDogadaja } from '../sigurnost/socket-ogranicenja.js';
import { politikaZaKontekst, type DogadajPoteza, type PolitikaUcinkaPartije, type RezultatNaredbe, type RezultatPokretanja } from './politika-ucinka.js';
import { zabiljeziPobjeduTreninga } from '../trening/upis-napretka.js';
import { mozdaObavijestiPrvuIgru } from '../sanducic/okidaci.js';
import { izracunajRokoveNeaktivnostiTreninga, stanjeNeaktivnostiTreninga, ZADANI_ROKOVI_NEAKTIVNOSTI_TRENINGA } from '../trening/neaktivnost.js';
import { stvoriStvarniSat, type Sat, type SatHandle } from './sat.js';
import {
  zabiljeziOtvaranjeAnalitike,
  type IzvorOtvaranjaAnalitike,
  type StatusOtvaranjaAnalitike,
  type UpravljacOtvaranjaAnalitike,
} from '../analitika/otvaranja.js';
import { mapirajVrstuRacuna, zabiljeziKrajIgre, zabiljeziPocetakIgre } from '../analitika/igre.js';

const ShemaPotezRijec = z.object({ rijec: z.string().min(1).max(50), turnToken: z.string().min(1).max(64).optional() }).strict();
const ShemaNeznam = z.object({ turnToken: z.string().min(1).max(64).optional() }).strict().optional();
const ShemaTreningNastavi = z.object({}).strict();
const ShemaReakcija = z.object({ poruka: z.enum(['pozdrav', 'sorry', 'dobro-odigrano', 'najjaci']) }).strict();

const TRAJANJE_POTEZA_MS = konfiguracija.TRAJANJE_POTEZA_MS;
const TRAJANJE_IZBORA_SUSTAVA_MS = 8_000;
const PROZOR_ISTODOBNIH_PREKIDA_MS = 25;
// UX ekran mora trajati 5 s u razvoju, stagingu i produkciji. Samo testno okruženje
// preskače čekanje kako integracijski testovi ne bi čekali stvarno vrijeme.
const ODGODA_POCETKA_PARTIJE_MS = konfiguracija.ODGODA_POCETKA_PARTIJE_MS;
const ODGODA_POCETKA_PRIVATNE_PARTIJE_MS = 0;
const ZADRZAVANJE_SOBE_NAKON_KRAJA_MS = 15_000; // reakcije rade dok igrači gledaju sažetak partije
const POCETNI_ODMAK_RETRYJA_REZULTATA_MS = 1_000;
const MAKSIMALNI_ODMAK_RETRYJA_REZULTATA_MS = 30_000;
const SOBA_PARTIJE = (partijaId: string) => `partija:${partijaId}`;

export interface SudionikPartije {
  igracId: string;
  vrsta: 'gost' | 'registriran' | 'admin';
  upravljac: 'covjek' | 'bot';
  nadimak: string;
  rang: string | null;
  avatarId: number;
  avatarConfig: import('zajednicko').AvatarConfigV1 | null;
  avatarRevision: number;
  sjedalo: number;
  razina: number;
  trenutniNiz: number;
  razinaVatre: 0 | 1 | 2 | 3;
}

export interface AktivneVezeIgraca {
  dohvatiSocket(igracId: string): KaladontSocket | undefined;
  jeAktivnaVeza(igracId: string, socketId: string): boolean;
}

export interface PostavkeMotoraPartije {
  sat?: Sat;
  timerOnemogucen?: boolean;
  trajanjePotezaMs?: number;
  trajanjeIzboraSustavaMs?: number;
  odgodaPocetkaPartijeMs?: number;
  tolerancijaPrekidaMs?: number;
  odgodaObradePrekidaMs?: number;
  zadrzavanjeSobeNakonKrajaMs?: number;
  maksimalnoAktivnihPartija?: number;
  provjeriDogadaj?: ProvjeriOgranicenjeDogadaja;
  zapisSocketHandlerGreske?: ZapisSocketHandlerGreske;
  naPartijaZavrsila?: (partijaId: string) => void;
  naPrivatnaPartijaZavrsila?: (kodSobe: string, partijaId: string, pobjednikId: string, rezultati: { igracId: string; bodovi: number }[]) => void;
  /** Poziva se pri svakoj promjeni poteza, otvaranju runde i kraju; koristi ga bot kontroler. */
  naPromjenuPoteza?: (dogadaj: DogadajPoteza) => void;
  /** Javni početak partije: bot kontroler može zakazati pozdrave. */
  naPocetakPartijeZaBotove?: (partijaId: string, kontekst: KontekstPartije, botIds: readonly string[]) => void;
  /** Nakon eliminacije: bot kontroler može zakazati sorry / bravo / hvala. */
  naEliminacijuZaBotove?: (
    partijaId: string,
    kontekst: KontekstPartije,
    zrtvaId: string,
    bodZaId: string | null,
    sudionici: readonly { igracId: string; upravljac: 'covjek' | 'bot' }[],
  ) => void;
  maksimalnoAktivnihTreninga?: number;
  dohvatiRokoveNeaktivnostiTreninga?: () => { upozorenjeMs: number; zatvaranjeMs: number };
}

interface PrekidUTijeku {
  timerHandle: SatHandle;
  istekMs: number;
  bioNaPotezu: boolean;
  napadacId: string | null;
}

interface StatistikaRijeciPartije {
  prihvaceniPotezi: number;
  ukupnoTrajanjePrihvaceniPoteziMs: number;
  otkljucaneRijeci: Map<string, { jakoDuga: boolean; jakoRijetka: boolean; dugaTier: number | null; rijetkaTier: number | null }>;
  najduziStreak: number;
  otkriveneJakoRijetkeGrupe: Set<string>;
  otkriveneSrednjeRijetkeGrupe: Set<string>;
  otkriveneRijetkeGrupe: Set<string>;
  upisaneDugeRijeci: number;
  upisaneSrednjeDugeRijeci: number;
  upisaneJakoDugeRijeci: number;
  /** Prihvaćeni oblici bilo kojeg tiera rijetkosti (za misije, ne grupe). */
  prihvaceneRijetkeRijeci: number;
  prihvaceneJakoRijetkeRijeci: number;
  dugeIRijetkeRijeci: number;
  /** Pravi pogrešni unosi koji lome niz. 0 je poznata nula, ne nepoznato. */
  pogresniUnosi: number;
  /** Jedinstveni normalizirani oblici koji su u ovom potezu bili i dugi i rijetki. */
  kvalificiraneDugeRijetkeRijeci: Set<string>;
  razlicitiPoceci: Set<string>;
  najduzaRijec: string | null;
  najduzaRijecGrafemi: number;
  najrjedaRijec: string | null;
  najrjedaRijecFrekvencija: number | null;
  najrjedaTier: number | null;
}

interface MetapodatakOtkljucanjaKolekcije {
  odigraniOblik: string;
  duljina: TierDuljineIskustva | null;
  rijetkost: TierRijetkostiIskustva | null;
}

interface StanjeStola {
  partijaId: string;
  pocetakPartijeMs: number;
  mod: 'cetiri_igraca' | 'dva_igraca';
  kontekst: KontekstPartije;
  politika: PolitikaUcinkaPartije;
  sudionici: SudionikPartije[]; // svi 4 ili 2, fiksni redoslijed po sjedalu
  aktivni: Set<string>;
  eliminirani: string[]; // redoslijed ispadanja - prvi ispali je na indeksu 0
  turnToken: string;
  naPotezuId: string;
  napadacId: string | null; // autor zadnje prihvaćene riječi - dobiva bod ako netko ispadne; null dok sustav "drži" rijec
  trazenaSlova: string | null;
  zadnjaRijec: string | null; // zadnja izgovorena/dodijeljena riječ - za obrazloženje eliminacije mrtvim slovima
  zadnjaRijecIgracId: string | null;
  zadnjaRijecVrsta: 'rijec' | 'sustav_rijec' | null;
  /** Izvor zadnje sustavske početne riječi; `nema_kandidata` kad odabir nije uspio. */
  zadnjiIzvorPocetne: IzvorPocetneRijeci | 'nema_kandidata' | null;
  /** Brojač sustavskih otvaranja u ovoj igri (za analitiku). */
  analitikaOtvaranjaRedni: number;
  /** Otvoreni prozor prva dva odgovora; null kad nema aktivnog mjerenja. */
  analitikaProzor: {
    redniBroj: number;
    brojOdgovora: number;
    odgovor1: string | null;
    odgovor2: string | null;
    sustavskaRijec: string | null;
    izvor: IzvorOtvaranjaAnalitike;
    status: StatusOtvaranjaAnalitike;
    dodijeljenoU: Date;
  } | null;
  iskoristeneGrupe: Set<string>; // potrošene leksemske grupe (RS-28/RS-29)
  potrosioGrupu: Map<string, string>; // grupa -> oblik koji ju je potrošio (za poruku odbijanja)
  brojOdigranih: number; // broj prihvaćenih riječi (uključivo sustavske) - za brojIskoristenih u payloadu
  runda: number;
  redniBroj: number;
  vrijemePocetkaPotezaMs: number;
  timerHandle: SatHandle | null;
  izborUToku: boolean; // true dok sustav bira rijec za otvaranje runde (RS: nitko ne moze igrati)
  izborHandle: SatHandle | null;
  istekIzboraIso: string | null;
  eliminacije: Eliminacija[];
  eliminacijeBrojac: Map<string, number>;
  zadnjiPotezi: Map<string, number[]>;
  zadnjeReakcije: Map<string, number>;
  razloziEliminacije: Map<string, RazlogEliminacije>;
  prekidiUTijeku: Map<string, PrekidUTijeku>;
  obradaPrekidaZakazana: boolean;
  rezultatiKraja: Map<string, KrajPartije>;
  zavrsena: boolean;
  jePrivatna?: boolean;
  kodSobe?: string;
  trajanjePotezaSek?: number;
  dopusteneVrste?: ReadonlySet<VrstaRijeci>;
  postavkePrivatneSobe?: PostavkePrivatneSobe;
  grupeSNagradom: Map<string, Map<string, number | null>>;
  grupeZaDostignuca: Map<string, Set<string>>;
  pocetneKolekcijskeGrupe: Map<string, Set<string>>;
  noveGrupeSNagradom: Map<string, Map<string, number | null>>;
  /** Nova kolekcijska grupa → metapodatak odigranog oblika koji ju je otključao (first-wins). */
  noveGrupeKolekcije: Map<string, Map<string, MetapodatakOtkljucanjaKolekcije>>;
  streakovi: Map<string, number>;
  statistikeRijeci: Map<string, StatistikaRijeciPartije>;
  iskustvoPrije: Map<string, number>;
  stavkeIskustva: Map<string, StavkaIskustva[]>;
  napredakDostignuca: Map<string, DeltaNapretkaDostignuca>;
  napredakDostignucaPrije: Map<string, Record<string, number>>;
  najavljenaDostignuca: Map<string, Set<string>>;
  statusSpremanja: 'nije_zavrsena' | 'spremanje_rezultata' | 'rezultati_spremljeni';
  brojPokusajaSpremanja: number;
  retrySpremanjaHandle: SatHandle | null;
  zavrsnoSpremanje: (() => Promise<void>) | null;
  ponoviZavrsnoSpremanje: (() => void) | null;
  /** In-flight fire-and-forget upisi tijekom igre (čekaju se na kraju). */
  upisiPotezaUTijeku: Promise<void>[];
  /** Payloadi poteza; `uspio` omogućuje da završni tok retrya samo neuspjelo. */
  zapisiPotezaZaOsigurati: { zapis: ZapisPoteza; uspio: boolean }[];
  /** Retryable upis početka partije; null ako politika ne zapisuje povijest. */
  osigurajPocetakPartije: (() => Promise<void>) | null;
  treningNeaktivnost: { upozorenjeIso: string; zatvaraIso: string; upozorenje: boolean } | null;
  treningRokovi: { upozorenjeMs: number; zatvaranjeMs: number } | null;
  treningGeneration: number;
  treningUpozorenjeHandle: SatHandle | null;
  treningZatvaranjeHandle: SatHandle | null;
}

export function stvoriUpraviteljPartija(
  io: KaladontIo,
  rjecnik: RjecnikSucelje,
  aktivneVeze: AktivneVezeIgraca,
  postavke: PostavkeMotoraPartije = {},
) {
  const sat = postavke.sat ?? stvoriStvarniSat();
  // SAMO za lokalno testiranje (docs/06-razvoj/postavljanje-okoline.md) - u produkciji mora biti iskljuceno/nepostavljeno
  const timerOnemogucen = postavke.timerOnemogucen ?? konfiguracija.ONEMOGUCI_TIMER_POTEZA === 'true';
  const trajanjePotezaMs = postavke.trajanjePotezaMs ?? TRAJANJE_POTEZA_MS;
  const tolerancijaPrekidaMs = postavke.tolerancijaPrekidaMs ?? konfiguracija.TOLERANCIJA_PREKIDA_MS;
  const odgodaObradePrekidaMs = postavke.odgodaObradePrekidaMs ?? 0;
  const zadrzavanjeSobeNakonKrajaMs = postavke.zadrzavanjeSobeNakonKrajaMs ?? ZADRZAVANJE_SOBE_NAKON_KRAJA_MS;
  const maksimalnoAktivnihPartija = postavke.maksimalnoAktivnihPartija ?? Number.POSITIVE_INFINITY;
  const maksimalnoAktivnihTreninga = postavke.maksimalnoAktivnihTreninga ?? Number.POSITIVE_INFINITY;
  const provjeriDogadaj = postavke.provjeriDogadaj ?? (() => true);
  const zapisSocketHandlerGreske = postavke.zapisSocketHandlerGreske ?? ((greska) => console.error('Neobrađena pogreška u Socket.IO handleru:', greska));

  const partije = new Map<string, StanjeStola>();
  const partijaPoIgracu = new Map<string, string>(); // igracId -> partijaId
  let zaustavljanje = false;
  let brojIstekaBota = 0;
  let brojNamjernihIstekaBota = 0;
  const namjerniIsteciBotova = new Map<string, { igracId: string; turnToken: string }>();

  function oznaciNamjerniIstek(partijaId: string, igracId: string, turnToken: string): boolean {
    const stanje = partije.get(partijaId);
    if (!stanje || stanje.zavrsena || stanje.izborUToku || stanje.kontekst !== 'javna' || stanje.turnToken !== turnToken || stanje.naPotezuId !== igracId || !stanje.aktivni.has(igracId) || stanje.sudionici.find((sudionik) => sudionik.igracId === igracId)?.upravljac !== 'bot') return false;
    namjerniIsteciBotova.set(partijaId, { igracId, turnToken });
    return true;
  }

  function snimkaPoteza(stanje: StanjeStola): import('./politika-ucinka.js').DogadajPoteza {
    const trajanjeMs = stanje.trajanjePotezaSek !== undefined ? stanje.trajanjePotezaSek * 1000 : trajanjePotezaMs;
    const imaTimer = !timerOnemogucen && trajanjeMs > 0 && !stanje.izborUToku && !stanje.zavrsena;
    return {
        partijaId: stanje.partijaId,
        kontekst: stanje.kontekst,
        zavrsena: stanje.zavrsena,
        izborUToku: stanje.izborUToku,
        naPotezuId: stanje.zavrsena ? null : stanje.naPotezuId,
        turnToken: stanje.turnToken,
        trazenaSlova: stanje.trazenaSlova,
        zadnjaRijec: stanje.zadnjaRijec,
        istekPotezaMs: imaTimer ? stanje.vrijemePocetkaPotezaMs + trajanjeMs : null,
        pocetakPotezaMs: stanje.vrijemePocetkaPotezaMs,
        trajanjePotezaMs: trajanjeMs,
        iskoristeneGrupe: stanje.iskoristeneGrupe,
        dopusteneVrste: stanje.dopusteneVrste,
        sudionici: stanje.sudionici.map((s) => ({ igracId: s.igracId, upravljac: s.upravljac, aktivan: stanje.aktivni.has(s.igracId) })),
      };
  }

  function objaviPromjenuPoteza(stanje: StanjeStola): void {
    if (!postavke.naPromjenuPoteza) return;
    try {
      postavke.naPromjenuPoteza(snimkaPoteza(stanje));
    } catch (greska) {
      console.error('Promatrač poteza bacio je pogrešku:', greska);
    }
  }

  function brojAktivnihTreninga(): number {
    let broj = 0;
    for (const stanje of partije.values()) if (stanje.kontekst === 'trening' && !stanje.zavrsena) broj += 1;
    return broj;
  }

  function prekiniZbogGreskeBota(partijaId: string, igracId: string, turnToken: string): void {
    const stanje = partije.get(partijaId);
    if (!stanje || stanje.zavrsena || stanje.izborUToku || stanje.turnToken !== turnToken || stanje.naPotezuId !== igracId || !stanje.aktivni.has(igracId) || stanje.sudionici.find((sudionik) => sudionik.igracId === igracId)?.upravljac !== 'bot') return;
    ponistiStol(stanje, 'Igra je prekinuta zbog tehničke pogreške. Pobjeda i rezultat nisu dodijeljeni.');
  }

  function prekiniPrazanPocetak(stanje: StanjeStola, odlaziIgracId?: string): boolean {
    if (stanje.zavrsena || stanje.runda !== 0 || stanje.kontekst !== 'javna' || !stanje.sudionici.some((sudionik) => sudionik.upravljac === 'bot')) return false;
    const imaCovjeka = stanje.sudionici.some((sudionik) => sudionik.upravljac === 'covjek' && sudionik.igracId !== odlaziIgracId && stanje.aktivni.has(sudionik.igracId) && aktivneVeze.dohvatiSocket(sudionik.igracId)?.connected);
    if (imaCovjeka) return false;
    ponistiStol(stanje, 'Igra nije započela jer su svi igrači izašli. Rezultat nije dodijeljen.');
    return true;
  }

  function zabiljeziAnalitikuPocetka(stanje: StanjeStola): void {
    zabiljeziPocetakIgre({
      igraId: stanje.partijaId,
      kontekst: stanje.kontekst,
      mod: stanje.mod,
      pocetakU: new Date(stanje.pocetakPartijeMs),
      sudionici: stanje.sudionici
        .filter((s) => s.upravljac === 'covjek')
        .map((s) => ({
          igracId: s.igracId,
          vrstaRacunaNaPocetku: mapirajVrstuRacuna(s.vrsta),
        })),
    });
  }

  function metaKrajaAnalitike(stanje: StanjeStola) {
    return {
      kontekst: stanje.kontekst,
      mod: stanje.mod,
      pocetakU: new Date(stanje.pocetakPartijeMs),
    };
  }

  function zatvoriAnalitikaProzorNepotpuno(stanje: StanjeStola): void {
    const prozor = stanje.analitikaProzor;
    if (!prozor || prozor.status !== 'otvoren') return;
    syncAnalitikaProzor(stanje, { status: 'nepotpuno', zatvorenoU: new Date(sat.sada()) });
    stanje.analitikaProzor = null;
  }

  function ponistiStol(stanje: StanjeStola, poruka: string): void {
    if (stanje.zavrsena) return;
    const partijaId = stanje.partijaId;
    stanje.zavrsena = true;
    zatvoriAnalitikaProzorNepotpuno(stanje);
    zabiljeziKrajIgre(partijaId, new Date(sat.sada()), 'prekinuta', metaKrajaAnalitike(stanje));
    namjerniIsteciBotova.delete(partijaId);
    if (stanje.timerHandle) sat.otkazi(stanje.timerHandle);
    if (stanje.izborHandle) sat.otkazi(stanje.izborHandle);
    if (stanje.treningUpozorenjeHandle) sat.otkazi(stanje.treningUpozorenjeHandle);
    if (stanje.treningZatvaranjeHandle) sat.otkazi(stanje.treningZatvaranjeHandle);
    for (const prekid of stanje.prekidiUTijeku.values()) sat.otkazi(prekid.timerHandle);
    stanje.prekidiUTijeku.clear();
    objaviPromjenuPoteza(stanje);
    const dovrsi = () => {
      for (const sudionik of stanje.sudionici) {
        if (partijaPoIgracu.get(sudionik.igracId) === partijaId) partijaPoIgracu.delete(sudionik.igracId);
      }
      partije.delete(partijaId);
      postavke.naPartijaZavrsila?.(partijaId);
    };
    if (stanje.politika.zapisujePovijest) {
      pokreniSpremanjeRezultata(stanje, async () => { await ponistiPartijeUTijekuUBazi([partijaId]); }, dovrsi);
    } else {
      stanje.statusSpremanja = 'rezultati_spremljeni';
      dovrsi();
    }
    for (const sudionik of stanje.sudionici) {
      const socket = aktivneVeze.dohvatiSocket(sudionik.igracId);
      socket?.emit('partija:ponistena', { partijaId, poruka });
      socket?.leave(SOBA_PARTIJE(partijaId));
    }
  }

  function zakaziNeaktivnostTreninga(stanje: StanjeStola, aktivnostMs = sat.sada()): void {
    if (stanje.treningUpozorenjeHandle) sat.otkazi(stanje.treningUpozorenjeHandle);
    if (stanje.treningZatvaranjeHandle) sat.otkazi(stanje.treningZatvaranjeHandle);
    if (stanje.kontekst !== 'trening' || stanje.zavrsena) return;
    const rokovi = stanje.treningRokovi ??= structuredClone(postavke.dohvatiRokoveNeaktivnostiTreninga?.() ?? ZADANI_ROKOVI_NEAKTIVNOSTI_TRENINGA);
    const generacija = ++stanje.treningGeneration;
    const rok = izracunajRokoveNeaktivnostiTreninga(aktivnostMs, rokovi);
    const upozorenjeMs = rok.upozorenjeMs;
    const zatvaraMs = rok.zatvaranjeMs;
    stanje.treningNeaktivnost = { upozorenjeIso: new Date(upozorenjeMs).toISOString(), zatvaraIso: new Date(zatvaraMs).toISOString(), upozorenje: false };
    const igrac = stanje.sudionici.find((sudionik) => sudionik.upravljac === 'covjek');
    stanje.treningUpozorenjeHandle = sat.zakazi(() => {
      if (stanje.zavrsena || stanje.treningGeneration !== generacija || !stanje.treningNeaktivnost || stanjeNeaktivnostiTreninga(aktivnostMs, sat.sada(), rokovi) !== 'upozorenje') return;
      stanje.treningNeaktivnost.upozorenje = true;
      if (igrac) aktivneVeze.dohvatiSocket(igrac.igracId)?.emit('trening:neaktivnost', { partijaId: stanje.partijaId, ...stanje.treningNeaktivnost });
    }, Math.max(0, upozorenjeMs - sat.sada()));
    stanje.treningUpozorenjeHandle.unref();
    const zatvoriAkoIsteko = () => {
      if (stanje.zavrsena || stanje.treningGeneration !== generacija || stanjeNeaktivnostiTreninga(aktivnostMs, sat.sada(), rokovi) !== 'isteklo') return;
      ponistiStol(stanje, 'Trening je zatvoren nakon pet minuta neaktivnosti.');
    };
    stanje.treningZatvaranjeHandle = sat.zakazi(zatvoriAkoIsteko, Math.max(0, zatvaraMs - sat.sada()));
    stanje.treningZatvaranjeHandle.unref();
    if (igrac) aktivneVeze.dohvatiSocket(igrac.igracId)?.emit('trening:neaktivnost', { partijaId: stanje.partijaId, ...stanje.treningNeaktivnost });
  }

  async function ucitajOtkljucaneGrupe(igraci: readonly SudionikPartije[]): Promise<Map<string, Map<string, number | null>>> {
    const igracIds = igraci.map((igrac) => igrac.igracId);
    const retci = igracIds.length === 0
      ? []
      : await baza.select({ igracId: otkljucaneGrupeIgraca.igracId, grupa: otkljucaneGrupeIgraca.grupa, tier: otkljucaneGrupeIgraca.tier })
        .from(otkljucaneGrupeIgraca)
        .where(inArray(otkljucaneGrupeIgraca.igracId, igracIds));
    const rezultat = new Map(igracIds.map((igracId) => [igracId, new Map<string, number | null>()]));
    for (const redak of retci) rezultat.get(redak.igracId)?.set(redak.grupa, redak.tier);
    return rezultat;
  }

  async function ucitajGrupeZaDostignuca(igraciPartije: readonly SudionikPartije[]): Promise<Map<string, Set<string>>> {
    const igracIds = igraciPartije.filter((igrac) => igrac.upravljac === 'covjek').map((igrac) => igrac.igracId);
    const retci = igracIds.length ? await baza.select({ igracId: otkljucaneGrupeIgraca.igracId, grupa: otkljucaneGrupeIgraca.grupa })
      .from(otkljucaneGrupeIgraca)
      .where(and(inArray(otkljucaneGrupeIgraca.igracId, igracIds), eq(otkljucaneGrupeIgraca.zaDostignuca, true))) : [];
    const rezultat = new Map(igraciPartije.map((igrac) => [igrac.igracId, new Set<string>()]));
    for (const redak of retci) rezultat.get(redak.igracId)?.add(redak.grupa);
    return rezultat;
  }

  async function ucitajOtkljucaneOblike(igraciPartije: readonly SudionikPartije[]): Promise<Map<string, { rijec: string; jakoDuga: boolean; jakoRijetka: boolean; dugaTier: number | null; rijetkaTier: number | null }[]>> {
    const igracIds = igraciPartije.map((igrac) => igrac.igracId);
    const retci = igracIds.length === 0 ? [] : await baza.select({
      igracId: otkljucaneRijeciIgraca.igracId,
      rijec: otkljucaneRijeciIgraca.rijec,
      jakoDuga: otkljucaneRijeciIgraca.jakoDuga,
      jakoRijetka: otkljucaneRijeciIgraca.jakoRijetka,
      dugaTier: otkljucaneRijeciIgraca.dugaTier,
      rijetkaTier: otkljucaneRijeciIgraca.rijetkaTier,
    }).from(otkljucaneRijeciIgraca).where(inArray(otkljucaneRijeciIgraca.igracId, igracIds));
    const rezultat = new Map(igracIds.map((igracId) => [igracId, [] as { rijec: string; jakoDuga: boolean; jakoRijetka: boolean; dugaTier: number | null; rijetkaTier: number | null }[]]));
    for (const redak of retci) rezultat.get(redak.igracId)?.push(redak);
    return rezultat;
  }

  async function ucitajIskustvo(igraciPartije: readonly SudionikPartije[]): Promise<Map<string, number>> {
    const igracIds = igraciPartije.map((igrac) => igrac.igracId);
    const retci = igracIds.length === 0 ? [] : await baza
      .select({ id: igraci.id, iskustvoUkupno: igraci.iskustvoUkupno })
      .from(igraci)
      .where(inArray(igraci.id, igracIds));
    return new Map(retci.map((igrac) => [igrac.id, igrac.iskustvoUkupno]));
  }

  async function ucitajNapredakDostignuca(igraciPartije: readonly SudionikPartije[]): Promise<Map<string, Record<string, number>>> {
    const igracIds = igraciPartije.filter((igrac) => igrac.upravljac === 'covjek').map((igrac) => igrac.igracId);
    const retci = igracIds.length === 0 ? [] : await baza
      .select()
      .from(napredakDostignucaIgraca)
      .where(inArray(napredakDostignucaIgraca.igracId, igracIds));
    const rezultat = new Map(igraciPartije.map((igrac) => [igrac.igracId, {} as Record<string, number>]));
    for (const redak of retci) {
      rezultat.set(redak.igracId, {
        valjaniPoteziUkupno: redak.valjaniPoteziUkupno,
        rijetkeLeksemskeGrupe: redak.rijetkeLeksemskeGrupe,
        dugeRijeci: redak.dugeRijeci,
        najduziStreak: redak.najduziStreak,
        kaladontIzvedbe: redak.kaladontIzvedbe,
        kaladontZrtve: redak.kaladontZrtve,
        izazvaneEliminacije: redak.izazvaneEliminacije,
        mrtvaSlovaEliminacije: redak.mrtvaSlovaEliminacije,
        javnePobjede: redak.javnePobjede,
        treningPobjede: redak.treningPobjede,
        povratneInformacije: redak.povratneInformacije,
        pohvaleNizUkupno: redak.pohvaleNizUkupno,
        pohvaleXpUkupno: redak.pohvaleXpUkupno,
      });
    }
    return rezultat;
  }

  function dodajStavkuIskustva(stanje: StanjeStola, igracId: string, stavka: StavkaIskustva): void {
    if (!stanje.politika.dajeNapredak) return;
    const postojece = stanje.stavkeIskustva.get(igracId) ?? [];
    const ista = postojece.find((postojeca) => postojeca.vrsta === stavka.vrsta && postojeca.naziv === stavka.naziv && postojeca.poStavci === stavka.poStavci);
    if (ista) {
      ista.kolicina += stavka.kolicina;
      ista.iskustvo += stavka.iskustvo;
    } else {
      postojece.push({ ...stavka });
    }
    stanje.stavkeIskustva.set(igracId, postojece);
  }

  function dodajNapredakDostignuca(stanje: StanjeStola, igracId: string, napredak: DeltaNapretkaDostignuca): void {
    if (!stanje.politika.dajeDostignucaIKolekcije) return;
    const sudionik = stanje.sudionici.find((s) => s.igracId === igracId);
    if (!sudionik || sudionik.upravljac !== 'covjek') return;
    const postojeci = stanje.napredakDostignuca.get(igracId) ?? {};
    for (const [kljuc, vrijednost] of Object.entries(napredak) as [keyof DeltaNapretkaDostignuca, number | undefined][]) {
      if (vrijednost === undefined) continue;
      if (kljuc === 'najduziStreak') {
        postojeci[kljuc] = Math.max(postojeci[kljuc] ?? 0, vrijednost);
      } else {
        postojeci[kljuc] = (postojeci[kljuc] ?? 0) + vrijednost;
      }
    }
    stanje.napredakDostignuca.set(igracId, postojeci);
    najaviNovaDostignuca(stanje, igracId);
  }

  function najaviNovaDostignuca(stanje: StanjeStola, igracId: string): void {
    if (!stanje.politika.dajeDostignucaIKolekcije) return;
    if (stanje.sudionici.find((s) => s.igracId === igracId)?.upravljac !== 'covjek') return;
    const prije = stanje.napredakDostignucaPrije.get(igracId) ?? {};
    const delta = stanje.napredakDostignuca.get(igracId) ?? {};
    const razinaIskustva = stanje.sudionici.find((s) => s.igracId === igracId)?.razina ?? 0;
    const vecNajavljena = stanje.najavljenaDostignuca.get(igracId) ?? new Set<string>();
    const nova = izracunajNovaDostignuca(prije, delta, razinaIskustva, Boolean(stanje.jePrivatna))
      .filter((dostignuce) => !vecNajavljena.has(`${dostignuce.id}:${dostignuce.novaRazina}`));
    if (nova.length === 0) return;
    for (const dostignuce of nova) vecNajavljena.add(`${dostignuce.id}:${dostignuce.novaRazina}`);
    stanje.najavljenaDostignuca.set(igracId, vecNajavljena);
    aktivneVeze.dohvatiSocket(igracId)?.emit('dostignuce:otkljucano', {
      partijaId: stanje.partijaId,
      dostignuca: nova.map((dostignuce) => ({
        id: dostignuce.id,
        naziv: DEFINICIJE_DOSTIGNUCA.find((definicija) => definicija.id === dostignuce.id)?.naziv ?? dostignuce.id,
        novaRazina: dostignuce.novaRazina,
        maksimalnaRazina: dostignuce.maksimalnaRazina,
      })),
    });
  }

  function nadimak(stanje: StanjeStola, igracId: string): string {
    return stanje.sudionici.find((s) => s.igracId === igracId)?.nadimak ?? '???';
  }

  function kolekcijaZaKraj(stanje: StanjeStola, igracId: string): NonNullable<KrajPartije['kolekcija']> {
    const pocetniKljuc = stanje.pocetneKolekcijskeGrupe.get(igracId) ?? new Set<string>();
    const trenutneGrupe = stanje.grupeSNagradom.get(igracId) ?? new Map<string, number | null>();
    const noveGrupe = stanje.noveGrupeKolekcije.get(igracId) ?? new Map<string, MetapodatakOtkljucanjaKolekcije>();
    const trenutniKljuc = new Set([...trenutneGrupe.keys()].map(kolekcijskiKljucGrupe));
    const novePoVrsti = new Map<string, Set<string>>();
    const noveRijeciPoVrsti = new Map<string, Set<string>>();
    const ulaziOznaka: { grupa: string; odigraniOblik: string; duljina: TierDuljineIskustva | null; rijetkost: TierRijetkostiIskustva | null }[] = [];
    for (const [grupa, meta] of noveGrupe) {
      const kljuc = kolekcijskiKljucGrupe(grupa);
      if (pocetniKljuc.has(kljuc)) continue;
      const vrsta = kljuc.split(':')[0] ?? 'ostalo';
      const kljucevi = novePoVrsti.get(vrsta) ?? new Set<string>();
      kljucevi.add(kljuc);
      novePoVrsti.set(vrsta, kljucevi);
      const rijeci = noveRijeciPoVrsti.get(vrsta) ?? new Set<string>();
      rijeci.add(osnovnaRijecIzGrupe(grupa));
      noveRijeciPoVrsti.set(vrsta, rijeci);
      ulaziOznaka.push({
        grupa,
        odigraniOblik: meta.odigraniOblik,
        duljina: meta.duljina,
        rijetkost: meta.rijetkost,
      });
    }
    const ukupnoOtkljucano = trenutniKljuc.size;
    const trenutna = kolekcionarskaRazina(ukupnoOtkljucano);
    const sljedeci = PRAGOVI_KOLEKCIONARSKE_RAZINE.find((prag) => prag.prag > ukupnoOtkljucano) ?? null;
    const dodaneKategorije = [...novePoVrsti.entries()]
      .filter(([vrsta]) => vrsta !== 'pridjev' && vrsta !== 'prilog')
      .map(([vrsta, kljucevi]) => ({ vrsta, broj: kljucevi.size, rijeci: [...(noveRijeciPoVrsti.get(vrsta) ?? [])].sort((a, b) => a.localeCompare(b, 'hr')) }))
      .concat([{ vrsta: 'pridjev_prilog', broj: (novePoVrsti.get('pridjev')?.size ?? 0) + (novePoVrsti.get('prilog')?.size ?? 0), rijeci: [...new Set([...(noveRijeciPoVrsti.get('pridjev') ?? []), ...(noveRijeciPoVrsti.get('prilog') ?? [])])].sort((a, b) => a.localeCompare(b, 'hr')) }])
      .filter((stavka) => stavka.broj > 0) as NonNullable<KrajPartije['kolekcija']>['dodaneKategorije'];
    const oznakeNovihRijeci = projektirajOznakeNovihRijeci(ulaziOznaka);
    return {
      dodaneKategorije,
      oznakeNovihRijeci: oznakeNovihRijeci.length > 0 ? oznakeNovihRijeci : undefined,
      ukupnoOtkljucano,
      ukupnoDostupno: rjecnik.brojKolekcijskihGrupa?.() ?? ukupnoOtkljucano,
      trenutnaRazina: trenutna.naziv,
      sljedecaRazina: sljedeci?.naziv ?? null,
      doSljedece: sljedeci ? sljedeci.prag - ukupnoOtkljucano : null,
    };
  }

  function novaStatistikaRijeci(): StatistikaRijeciPartije {
    return {
      prihvaceniPotezi: 0,
      ukupnoTrajanjePrihvaceniPoteziMs: 0,
        otkljucaneRijeci: new Map<string, { jakoDuga: boolean; jakoRijetka: boolean; dugaTier: number | null; rijetkaTier: number | null }>(),
      najduziStreak: 0,
      otkriveneJakoRijetkeGrupe: new Set(),
      otkriveneSrednjeRijetkeGrupe: new Set(),
      otkriveneRijetkeGrupe: new Set(),
      upisaneDugeRijeci: 0,
      upisaneSrednjeDugeRijeci: 0,
      upisaneJakoDugeRijeci: 0,
      prihvaceneRijetkeRijeci: 0,
      prihvaceneJakoRijetkeRijeci: 0,
      dugeIRijetkeRijeci: 0,
      pogresniUnosi: 0,
      kvalificiraneDugeRijetkeRijeci: new Set(),
      razlicitiPoceci: new Set(),
      najduzaRijec: null,
      najduzaRijecGrafemi: 0,
      najrjedaRijec: null,
      najrjedaRijecFrekvencija: null,
      najrjedaTier: null,
    };
  }

  function sljedeciAktivni(stanje: StanjeStola, trenutniId: string): string | null {
    const poredak = stanje.sudionici.map((s) => s.igracId);
    const pocetniIndeks = poredak.indexOf(trenutniId);
    for (let pomak = 1; pomak <= poredak.length; pomak += 1) {
      const kandidat = poredak[(pocetniIndeks + pomak) % poredak.length]!;
      if (stanje.aktivni.has(kandidat)) return kandidat;
    }
    return null;
  }

  /** Prihvaćena riječ troši SVE svoje leksemske grupe (RS-29); kaladont/kalodont ništa ne troše. */
  function potrosiGrupe(stanje: StanjeStola, rijec: string): void {
    stanje.brojOdigranih += 1;
    if (RIJECI_KALADONT.has(rijec)) return;
    for (const grupa of rjecnik.grupeZa(rijec)) {
      stanje.iskoristeneGrupe.add(grupa);
      if (!stanje.potrosioGrupu.has(grupa)) stanje.potrosioGrupu.set(grupa, rijec);
    }
  }

  function noviTurnToken(stanje: StanjeStola): string {
    namjerniIsteciBotova.delete(stanje.partijaId);
    stanje.turnToken = randomUUID();
    return stanje.turnToken;
  }

  function postaviTimer(stanje: StanjeStola): void {
    if (stanje.timerHandle) sat.otkazi(stanje.timerHandle);
    stanje.vrijemePocetkaPotezaMs = sat.sada();
    const trajanjeMs =
      stanje.trajanjePotezaSek !== undefined
        ? stanje.trajanjePotezaSek * 1000
        : trajanjePotezaMs;

    if (timerOnemogucen || trajanjeMs <= 0) {
      stanje.timerHandle = null;
      return;
    }
    const token = stanje.turnToken;
    stanje.timerHandle = sat.zakazi(() => {
      if (stanje.zavrsena || stanje.izborUToku || stanje.turnToken !== token) return;
      eliminirajIgraca(stanje, stanje.naPotezuId, 'istek');
    }, trajanjeMs);
  }

  function istekPotezaIso(stanje: StanjeStola): string {
    const trajanjeMs =
      stanje.trajanjePotezaSek !== undefined
        ? stanje.trajanjePotezaSek * 1000
        : trajanjePotezaMs;
    // Tijekom izbora riječi / isključenog timera nema "živog" poteza — prazan istek
    // sprječava klijente da mountaju formu između eliminacije i nove runde.
    if (timerOnemogucen || stanje.izborUToku || stanje.zavrsena || trajanjeMs <= 0) return '';
    return new Date(stanje.vrijemePocetkaPotezaMs + trajanjeMs).toISOString();
  }

  function posaljiStanje(socket: KaladontSocket): void {
    const partijaId = partijaPoIgracu.get(socket.data.igracId);
    const stanje = partijaId ? partije.get(partijaId) : undefined;
    if (!stanje) return;

    const poruka: StanjePartije = {
      partijaId: stanje.partijaId,
      mojIgracId: socket.data.igracId,
      sjedala: stanje.sudionici.map(({ igracId, vrsta, nadimak, avatarId, avatarConfig, avatarRevision, rang, razina, trenutniNiz, razinaVatre }) => ({ igracId, nadimak, jeGost: vrsta === 'gost', avatarId, avatarConfig, avatarRevision, rang, razina, trenutniNiz, razinaVatre })),
      turnToken: stanje.turnToken,
      naPotezuId: stanje.naPotezuId,
      trazenaSlova: stanje.trazenaSlova,
      istekPotezaIso: istekPotezaIso(stanje),
      serverVrijemeIso: new Date(sat.sada()).toISOString(),
      runda: stanje.runda,
      brojIskoristenih: stanje.brojOdigranih,
      eliminacije: stanje.eliminacije,
      sustavBiraRijec: stanje.izborUToku,
      istekIzboraIso: stanje.istekIzboraIso,
      zadnjaRijec: stanje.zadnjaRijec,
      zadnjaRijecIgracId: stanje.zadnjaRijecIgracId,
      zadnjaRijecVrsta: stanje.zadnjaRijecVrsta,
      zavrsena: stanje.zavrsena,
      mod: stanje.mod,
      kontekst: stanje.kontekst,
      jePrivatna: stanje.jePrivatna,
      kodSobe: stanje.kodSobe,
      trajanjePotezaSek: stanje.trajanjePotezaSek,
      dopusteneVrste: stanje.dopusteneVrste ? [...stanje.dopusteneVrste] : undefined,
      statusSpremanja: stanje.statusSpremanja,
      ...(stanje.treningNeaktivnost && stanje.kontekst === 'trening' ? { treningNeaktivnost: { ...stanje.treningNeaktivnost } } : {}),
    };
    socket.emit('partija:stanje', poruka);
  }

  function emitirajSpremanjeRezultata(stanje: StanjeStola): void {
    const poruka = {
      partijaId: stanje.partijaId,
      poruka: 'Partija je završila. Konačni rezultat se još sprema, pokušavamo ponovno.',
    };
    for (const sudionik of stanje.sudionici) {
      aktivneVeze.dohvatiSocket(sudionik.igracId)?.emit('partija:spremanje-rezultata', poruka);
    }
  }

  async function zaustavi(): Promise<void> {
    if (zaustavljanje) return;
    zaustavljanje = true;
    namjerniIsteciBotova.clear();
    const aktivnePartije = [...partije.values()].filter((stanje) =>
      !stanje.zavrsena || stanje.statusSpremanja === 'spremanje_rezultata');
    const partijaIdovi = aktivnePartije.filter((stanje) => stanje.politika.zapisujePovijest).map((stanje) => stanje.partijaId);
    for (const stanje of aktivnePartije) {
      const vecZavrsena = stanje.zavrsena;
      stanje.zavrsena = true;
      if (!vecZavrsena) {
        zatvoriAnalitikaProzorNepotpuno(stanje);
        zabiljeziKrajIgre(stanje.partijaId, new Date(sat.sada()), 'prekinuta', metaKrajaAnalitike(stanje));
      }
      if (stanje.timerHandle) sat.otkazi(stanje.timerHandle);
      if (stanje.izborHandle) sat.otkazi(stanje.izborHandle);
      if (stanje.treningUpozorenjeHandle) sat.otkazi(stanje.treningUpozorenjeHandle);
      if (stanje.treningZatvaranjeHandle) sat.otkazi(stanje.treningZatvaranjeHandle);
      if (stanje.retrySpremanjaHandle) sat.otkazi(stanje.retrySpremanjaHandle);
      for (const prekid of stanje.prekidiUTijeku.values()) sat.otkazi(prekid.timerHandle);
      objaviPromjenuPoteza(stanje);
      for (const sudionik of stanje.sudionici) {
        aktivneVeze.dohvatiSocket(sudionik.igracId)?.emit('partija:ponistena', {
          partijaId: stanje.partijaId,
          poruka: 'Partija je prekinuta zbog gašenja poslužitelja. Rezultat nije dodijeljen.',
        });
        aktivneVeze.dohvatiSocket(sudionik.igracId)?.leave(SOBA_PARTIJE(stanje.partijaId));
        if (partijaPoIgracu.get(sudionik.igracId) === stanje.partijaId) partijaPoIgracu.delete(sudionik.igracId);
      }
      partije.delete(stanje.partijaId);
    }
    await ponistiPartijeUTijekuUBazi(partijaIdovi);
  }

  function zakaziBrisanjeNakonSpremanja(stanje: StanjeStola): void {
    namjerniIsteciBotova.delete(stanje.partijaId);
    sat.zakazi(() => {
      if (stanje.retrySpremanjaHandle) sat.otkazi(stanje.retrySpremanjaHandle);
      for (const s of stanje.sudionici) {
        aktivneVeze.dohvatiSocket(s.igracId)?.leave(SOBA_PARTIJE(stanje.partijaId));
        if (partijaPoIgracu.get(s.igracId) === stanje.partijaId) partijaPoIgracu.delete(s.igracId);
      }
      partije.delete(stanje.partijaId);
    }, zadrzavanjeSobeNakonKrajaMs).unref();
  }

  function pokreniSpremanjeRezultata(
    stanje: StanjeStola,
    upis: () => Promise<void>,
    nakonUspjeha: () => void,
  ): void {
    if (stanje.statusSpremanja !== 'nije_zavrsena') return;

    stanje.statusSpremanja = 'spremanje_rezultata';
    const upisSaCekanjemPoteza = async () => {
      // Najprije osiguraj redak partije — inače in-flight / retry upisi poteza padaju na FK.
      if (stanje.osigurajPocetakPartije) await stanje.osigurajPocetakPartije();
      // Kratko pričekaj in-flight (ne blokiraj zauvijek ako neki upis visi),
      // zatim idempotentno upiši samo one koji još nisu uspjeli.
      await Promise.race([
        Promise.allSettled(stanje.upisiPotezaUTijeku),
        new Promise<void>((resolve) => {
          const h = sat.zakazi(resolve, 2_000);
          h.unref();
        }),
      ]);
      const nedostaju = stanje.zapisiPotezaZaOsigurati.filter((stavka) => !stavka.uspio);
      if (nedostaju.length > 0) {
        await osigurajUpisePoteza(nedostaju.map((stavka) => stavka.zapis));
        for (const stavka of nedostaju) stavka.uspio = true;
      }
      await upis();
    };
    stanje.zavrsnoSpremanje = upisSaCekanjemPoteza;
    stanje.brojPokusajaSpremanja = 0;
    emitirajSpremanjeRezultata(stanje);

    // Handle označava samo čekanje backoffa. Dok traje upis mora biti null, inače
    // reconnect otkaže "timer" i pokrene drugi pokusaj preko većeg upisa u tijeku.
    let upisUTijeku = false;

    const pokusaj = () => {
      if (stanje.statusSpremanja === 'rezultati_spremljeni' || upisUTijeku) return;
      if (stanje.retrySpremanjaHandle) {
        sat.otkazi(stanje.retrySpremanjaHandle);
        stanje.retrySpremanjaHandle = null;
      }
      upisUTijeku = true;
      stanje.brojPokusajaSpremanja += 1;
      void upisSaCekanjemPoteza().then(() => {
        upisUTijeku = false;
        if (stanje.statusSpremanja === 'rezultati_spremljeni') return;
        stanje.statusSpremanja = 'rezultati_spremljeni';
        stanje.zavrsnoSpremanje = null;
        stanje.ponoviZavrsnoSpremanje = null;
        stanje.retrySpremanjaHandle = null;
        nakonUspjeha();
      }).catch((greska) => {
        upisUTijeku = false;
        console.error(`Neuspio završni upis partije ${stanje.partijaId} (pokušaj ${stanje.brojPokusajaSpremanja}):`, greska);
        if (stanje.statusSpremanja === 'rezultati_spremljeni') return;
        emitirajSpremanjeRezultata(stanje);
        const odmak = Math.min(
          POCETNI_ODMAK_RETRYJA_REZULTATA_MS * 2 ** (stanje.brojPokusajaSpremanja - 1),
          MAKSIMALNI_ODMAK_RETRYJA_REZULTATA_MS,
        );
        stanje.retrySpremanjaHandle = sat.zakazi(pokusaj, odmak);
        stanje.retrySpremanjaHandle.unref();
      });
    };

    stanje.ponoviZavrsnoSpremanje = pokusaj;
    pokusaj();
  }

  function zapocniPartiju(
    sudioniciUlaz: StavkaReda[],
    mod: 'cetiri_igraca' | 'dva_igraca' = 'cetiri_igraca',
    opcije: { kontekst?: 'javna' | 'trening' } = {},
  ): Promise<RezultatPokretanja> {
    const kontekst = opcije.kontekst ?? 'javna';
    if (zaustavljanje) return Promise.resolve('zaustavljanje');
    if (partije.size >= maksimalnoAktivnihPartija) return Promise.resolve('limit');
    if (kontekst === 'trening' && brojAktivnihTreninga() >= maksimalnoAktivnihTreninga) return Promise.resolve('limit');
    const politika = politikaZaKontekst(kontekst);
    const izmjesano = promijesajNiz(sudioniciUlaz);
    const sudionici: SudionikPartije[] = izmjesano.map((s, sjedalo) => {
      const odigrane = mod === 'dva_igraca' ? (s.odigrane1v1 ?? 0) : s.odigrane;
      const bodoviUkupno = mod === 'dva_igraca' ? (s.bodovi1v1 ?? 0) : s.bodoviUkupno;
      const prosjekBodova = odigrane > 0 ? bodoviUkupno / odigrane : 0;
      const rang = izracunajRang(odigrane, prosjekBodova, mod);
      return {
        igracId: s.igracId,
        vrsta: s.vrsta,
        upravljac: s.upravljac ?? 'covjek',
        nadimak: s.nadimak,
        avatarId: s.avatarId,
        avatarConfig: s.avatarConfig,
        avatarRevision: s.avatarRevision,
        rang: rang === 'Piskaralo' ? null : rang,
        sjedalo,
        razina: stanjeIskustva(s.iskustvoUkupno ?? 0).razina,
        trenutniNiz: mod === 'dva_igraca' ? (s.trenutniNiz1v1 ?? 0) : (s.trenutniNiz4p ?? 0),
        razinaVatre: razinaVatre(mod === 'dva_igraca' ? (s.trenutniNiz1v1 ?? 0) : (s.trenutniNiz4p ?? 0), mod),
      };
    });
    const partijaId = randomUUID();
    const prviIgracId = sudionici[0]!.igracId;
    let pocetakIso = '';

    const stanje: StanjeStola = {
      partijaId,
      pocetakPartijeMs: sat.sada(),
      mod,
      kontekst,
      politika,
      trajanjePotezaSek: kontekst === 'trening' ? 0 : undefined,
      sudionici,
      aktivni: new Set(sudionici.map((s) => s.igracId)),
      eliminirani: [],
      turnToken: randomUUID(),
      naPotezuId: prviIgracId,
      napadacId: null,
      trazenaSlova: null,
      zadnjaRijec: null,
      zadnjaRijecIgracId: null,
      zadnjaRijecVrsta: null,
      zadnjiIzvorPocetne: null,
      analitikaOtvaranjaRedni: 0,
      analitikaProzor: null,
      iskoristeneGrupe: new Set(),
      potrosioGrupu: new Map(),
      brojOdigranih: 0,
      runda: 0,
      redniBroj: 0,
      vrijemePocetkaPotezaMs: sat.sada(),
      timerHandle: null,
      izborUToku: true, // do prve riječi sustava potezi nisu mogući
      izborHandle: null,
      istekIzboraIso: pocetakIso,
      eliminacije: [],
      eliminacijeBrojac: new Map(),
      zadnjiPotezi: new Map(),
      zadnjeReakcije: new Map(),
      grupeSNagradom: new Map(sudionici.map((s) => [s.igracId, new Map<string, number | null>()])),
      grupeZaDostignuca: new Map(sudionici.map((s) => [s.igracId, new Set<string>()])),
      pocetneKolekcijskeGrupe: new Map(sudionici.map((s) => [s.igracId, new Set<string>()])),
      noveGrupeSNagradom: new Map(sudionici.map((s) => [s.igracId, new Map<string, number | null>()])),
      noveGrupeKolekcije: new Map(sudionici.map((s) => [s.igracId, new Map<string, MetapodatakOtkljucanjaKolekcije>()])),
      streakovi: new Map(sudionici.map((s) => [s.igracId, 0])),
      statistikeRijeci: new Map(sudionici.map((s) => [s.igracId, novaStatistikaRijeci()])),
      iskustvoPrije: new Map(sudionici.map((s) => [s.igracId, 0])),
      stavkeIskustva: new Map(sudionici.map((s) => [s.igracId, []])),
      napredakDostignuca: new Map(sudionici.map((s) => [s.igracId, {}])),
      napredakDostignucaPrije: new Map(sudionici.map((s) => [s.igracId, { razina: s.razina }])),
      najavljenaDostignuca: new Map(sudionici.map((s) => [s.igracId, new Set<string>()])),
      statusSpremanja: 'nije_zavrsena',
      brojPokusajaSpremanja: 0,
      retrySpremanjaHandle: null,
      zavrsnoSpremanje: null,
      ponoviZavrsnoSpremanje: null,
      upisiPotezaUTijeku: [],
      zapisiPotezaZaOsigurati: [],
      osigurajPocetakPartije: null,
      treningNeaktivnost: null,
      treningRokovi: null,
      treningGeneration: 0,
      treningUpozorenjeHandle: null,
      treningZatvaranjeHandle: null,
      razloziEliminacije: new Map(),
      prekidiUTijeku: new Map(),
      obradaPrekidaZakazana: false,
      rezultatiKraja: new Map(),
      zavrsena: false,
    };

    partije.set(partijaId, stanje);
    if (kontekst === 'trening') zakaziNeaktivnostTreninga(stanje);
    for (const s of sudionici) partijaPoIgracu.set(s.igracId, partijaId);

    for (const s of sudionici) {
      const socket = aktivneVeze.dohvatiSocket(s.igracId);
      socket?.leave('red-cekanja-4p');
      socket?.leave('red-cekanja-1v1');
      socket?.join(SOBA_PARTIJE(partijaId));
    }
    // Čekanje se mjeri samo ljudima; botov ulazak u stol nije čekanje.
    const cekanjeMsPoIgracu = new Map(izmjesano.map((s) => [s.igracId, s.upravljac === 'bot' ? 0 : sat.sada() - s.usaoU]));
    const ljudi = sudionici.filter((s) => s.upravljac === 'covjek');
    // Javni botovi imaju redak u bazi; privremeno Računalo u treningu nema ništa.
    const sudioniciUBazi = politika.zapisujePovijest ? sudionici : [];
    const praznaMapa = <T,>(vrijednost: () => T) => new Map(sudionici.map((s) => [s.igracId, vrijednost()]));
    // Trening ništa ne čita ni ne piše; računalni protivnik nema redak u bazi.
    const upisPocetkaPromise = politika.zapisujePovijest
      ? (() => {
        let pocetakUspio = false;
        const osiguraj = async () => {
          if (pocetakUspio) return;
          await zapisiPocetakPartije(partijaId, sudionici, cekanjeMsPoIgracu, mod, sudionici.length - ljudi.length);
          pocetakUspio = true;
        };
        stanje.osigurajPocetakPartije = osiguraj;
        return osiguraj();
      })()
      : Promise.resolve();
    // Čekanje in-flight ne smije progutati grešku starta za Promise.all ispod;
    // završni tok ponovno zove osigurajPocetakPartije samo ako prvi pokušaj nije uspio.
    stanje.upisiPotezaUTijeku.push(upisPocetkaPromise.catch(() => undefined));
    const sudioniciZaKolekciju = politika.zapisujeKolekcijuTreninga
      ? sudionici.filter((sudionik) => sudionik.upravljac === 'covjek' && sudionik.vrsta === 'registriran')
      : sudioniciUBazi;
    const ucitajIliPrazno = <T,>(ucitaj: () => Promise<Map<string, T>>, prazno: () => T, opis: string, dopusteno = politika.dajeDostignucaIKolekcije || politika.dajeNapredak) =>
      dopusteno
        ? ucitaj().catch((greska) => {
          console.error(`Neuspjelo učitavanje ${opis}:`, greska);
          return praznaMapa(prazno);
        })
        : Promise.resolve(praznaMapa(prazno));
    // Igrači dobivaju countdown tek kad je poslužitelj spreman objaviti prvu rundu.
    const grupeDostignucaPromise = politika.dajeDostignucaIKolekcije
      ? ucitajGrupeZaDostignuca(sudioniciUBazi).catch((greska) => {
        console.error('Neuspjelo učitavanje grupa za dostignuća:', greska);
        return new Map(sudionici.map((igrac) => [igrac.igracId, new Set<string>()]));
      })
      : Promise.resolve(new Map(sudionici.map((igrac) => [igrac.igracId, new Set<string>()])));
    return Promise.all([
      upisPocetkaPromise,
      ucitajIliPrazno(() => ucitajOtkljucaneGrupe(sudioniciZaKolekciju), () => new Map<string, number | null>(), 'otključanih grupa', politika.zapisujeKolekcijuTreninga || politika.dajeDostignucaIKolekcije),
      ucitajIliPrazno(() => ucitajOtkljucaneOblike(sudioniciUBazi), () => [] as { rijec: string; jakoDuga: boolean; jakoRijetka: boolean; dugaTier: number | null; rijetkaTier: number | null }[], 'otključanih oblika'),
      ucitajIliPrazno(() => ucitajIskustvo(sudioniciUBazi), () => 0, 'iskustva'),
      ucitajIliPrazno(() => ucitajNapredakDostignuca(sudioniciUBazi), () => ({}) as Record<string, number>, 'napretka dostignuća'),
      grupeDostignucaPromise,
    ]).then(([, grupe, oblici, iskustvo, napredak, grupeDostignuca]) => {
      stanje.grupeSNagradom = new Map(sudionici.map((s) => [s.igracId, grupe.get(s.igracId) ?? new Map<string, number | null>()]));
      stanje.grupeZaDostignuca = grupeDostignuca;
      stanje.pocetneKolekcijskeGrupe = new Map([...stanje.grupeSNagradom].map(([igracId, mape]) => [igracId, new Set([...mape.keys()].map(kolekcijskiKljucGrupe))]));
      stanje.noveGrupeSNagradom = praznaMapa(() => new Map<string, number | null>());
      stanje.noveGrupeKolekcije = praznaMapa(() => new Map<string, MetapodatakOtkljucanjaKolekcije>());
      for (const sudionik of sudionici) {
        for (const oblik of oblici.get(sudionik.igracId) ?? []) {
          stanje.statistikeRijeci.get(sudionik.igracId)?.otkljucaneRijeci.set(oblik.rijec, oblik);
        }
      }
      stanje.iskustvoPrije = new Map(sudionici.map((s) => [s.igracId, iskustvo.get(s.igracId) ?? 0]));
      stanje.napredakDostignucaPrije = new Map(sudionici.map((s) => [s.igracId, { ...(napredak.get(s.igracId) ?? {}), razina: s.razina }]));
      if (stanje.zavrsena || prekiniPrazanPocetak(stanje)) return 'zaustavljanje' as const;
      if (stanje.izborHandle) return 'pokrenuta' as const;
      const odgodaPocetka = postavke.odgodaPocetkaPartijeMs ?? ODGODA_POCETKA_PARTIJE_MS;
      pocetakIso = new Date(sat.sada() + odgodaPocetka).toISOString();
      stanje.istekIzboraIso = pocetakIso;
      const poruka: Omit<PocetakPartije, 'mojIgracId'> = {
        partijaId,
        pocetakIso,
        sjedala: sudionici.map((s) => ({ igracId: s.igracId, nadimak: s.nadimak, jeGost: s.vrsta === 'gost', avatarId: s.avatarId, avatarConfig: s.avatarConfig, avatarRevision: s.avatarRevision, rang: s.rang, razina: s.razina, trenutniNiz: s.trenutniNiz, razinaVatre: s.razinaVatre })),
        mod,
        kontekst,
      };
      for (const s of sudionici) {
        aktivneVeze.dohvatiSocket(s.igracId)?.emit('partija:pocetak', { ...poruka, mojIgracId: s.igracId });
      }
      postavke.naPocetakPartijeZaBotove?.(
        partijaId,
        kontekst,
        sudionici.filter((s) => s.upravljac === 'bot').map((s) => s.igracId),
      );
      zabiljeziAnalitikuPocetka(stanje);
      stanje.izborHandle = sat.zakazi(() => objaviRijecSustava(stanje, null), odgodaPocetka);
      return 'pokrenuta' as const;
    }).catch((greska) => {
      console.error(`Neuspjelo pokretanje partije ${partijaId}:`, greska);
      if (stanje.izborHandle) sat.otkazi(stanje.izborHandle);
      if (stanje.timerHandle) sat.otkazi(stanje.timerHandle);
      partije.delete(partijaId);
      for (const sudionik of sudionici) {
        if (partijaPoIgracu.get(sudionik.igracId) === partijaId) partijaPoIgracu.delete(sudionik.igracId);
        const socket = aktivneVeze.dohvatiSocket(sudionik.igracId);
        socket?.leave(SOBA_PARTIJE(partijaId));
        socket?.emit('greska', {
          kod: 'UPIS_PARTIJE_NEUSPJEO',
          poruka: 'Partiju nije moguće pokrenuti zbog pogreške pri spremanju. Pokušaj ponovno.',
        });
      }
      return 'greska' as const;
    });
  }

  function dohvatiPartijuZaSocket(socket: KaladontSocket): StanjeStola | undefined {
    const mapiranaPartija = partijaPoIgracu.get(socket.data.igracId);
    if (mapiranaPartija) {
      const stanje = partije.get(mapiranaPartija);
      if (stanje) return stanje;
    }

    for (const soba of socket.rooms) {
      if (!soba.startsWith('partija:')) continue;
      const stanje = partije.get(soba.slice('partija:'.length));
      if (stanje) return stanje;
    }
    return undefined;
  }

  function spremiPotezAkoTreba(stanje: StanjeStola, zapis: Omit<ZapisPoteza, 'partijaId'>) {
    if (!stanje.politika.zapisujePovijest) return;
    const potpuni: ZapisPoteza = { partijaId: stanje.partijaId, ...zapis };
    const stavka = { zapis: potpuni, uspio: false };
    stanje.zapisiPotezaZaOsigurati.push(stavka);
    // Fire-and-forget: grešku bilježi zapisiPotez; završni tok retrya samo !uspio.
    stanje.upisiPotezaUTijeku.push(
      zapisiPotez(potpuni).then(() => { stavka.uspio = true; }).catch(() => undefined),
    );
  }

  function zakljuciPartiju(stanje: StanjeStola): void {
    stanje.zavrsena = true;
    zatvoriAnalitikaProzorNepotpuno(stanje);
    zabiljeziKrajIgre(stanje.partijaId, new Date(sat.sada()), 'zavrsena', metaKrajaAnalitike(stanje));
    if (stanje.treningUpozorenjeHandle) sat.otkazi(stanje.treningUpozorenjeHandle);
    if (stanje.treningZatvaranjeHandle) sat.otkazi(stanje.treningZatvaranjeHandle);
    // Retry preko ponoći ne smije premjestiti igru u drugi dan ljestvice.
    const zavrsenoU = new Date(sat.sada());
    const prikazRezultataOdIso = new Date(zavrsenoU.getTime() + 8_000).toISOString();
    if (stanje.timerHandle) sat.otkazi(stanje.timerHandle);
    if (stanje.izborHandle) sat.otkazi(stanje.izborHandle);
    for (const prekid of stanje.prekidiUTijeku.values()) sat.otkazi(prekid.timerHandle);
    stanje.prekidiUTijeku.clear();
    objaviPromjenuPoteza(stanje);

    // eliminirani[0] je prvi ispao (npr. 4. mjesto), zadnji preostali (aktivni) je pobjednik (1. mjesto)
    const pobjednikId = [...stanje.aktivni][0]!;
    const redoslijedOdPobjednika = [pobjednikId, ...[...stanje.eliminirani].reverse()];

    const plasmani = redoslijedOdPobjednika.map((igracId, indeks) => {
      const plasman = indeks + 1;
      const eliminacije = stanje.eliminacijeBrojac.get(igracId) ?? 0;
      let bodovi = 0;

      if (stanje.kontekst === 'trening') {
        bodovi = 0;
      } else if (stanje.jePrivatna) {
        const pobjednikBodova = 2;
        const elimBod = stanje.postavkePrivatneSobe?.eliminacijskiBodovi ? eliminacije : 0;
        bodovi = (plasman === 1 ? pobjednikBodova : 0) + elimBod;
      } else {
        bodovi = izracunajBodove({ plasman: plasman as 1 | 2 | 3 | 4, eliminacije }, stanje.mod);
      }

      return {
        igracId,
        nadimak: stanje.sudionici.find((sudionik) => sudionik.igracId === igracId)?.nadimak ?? 'Nepoznati igrač',
        plasman: plasman as 1 | 2 | 3 | 4,
        bodovi,
        eliminacije,
        nacinIspadanja: (plasman === 1 ? 'pobjednik' : nacinIspadanjaZaIgraca(stanje, igracId)) as NacinIspadanja,
      };
    });

    stanje.zadnjiPotezi.clear();
    stanje.zadnjeReakcije.clear();

    if (stanje.kontekst === 'trening') {
      const pobjednik = stanje.sudionici.find((sudionik) => sudionik.igracId === pobjednikId);
      const zavrsenoU = new Date(prikazRezultataOdIso);
      pokreniSpremanjeRezultata(
        stanje,
        async () => {
          type NagradaTreninga = Awaited<ReturnType<typeof zabiljeziPobjeduTreninga>>;
          let nagrada: NagradaTreninga = null;
          if (pobjednik?.upravljac === 'covjek') {
            try {
              const statistika = stanje.statistikeRijeci.get(pobjednikId);
              nagrada = await zabiljeziPobjeduTreninga(stanje.partijaId, pobjednikId, zavrsenoU, {
                mod: stanje.mod,
                plasman: 1,
                nacinIspadanja: 'pobjednik',
                prihvaceneRijeci: statistika?.prihvaceniPotezi ?? 0,
                najduziNiz: statistika?.najduziStreak ?? 0,
              });
            } catch (greska) {
              aktivneVeze.dohvatiSocket(pobjednikId)?.emit('greska', {
                kod: 'INTERNA',
                poruka: 'Pobjeda je završena, ali napredak nije spremljen. Pokušaj ponovno.',
              });
              throw greska;
            }
          }
          await obavijestiPrvuIgruSudionicima(stanje, 'trening');
          for (const p of plasmani) {
            const ishod = p.igracId === pobjednikId ? nagrada?.ishodMisija : null;
            const novaDostignuca = [
              ...(p.igracId === pobjednikId && nagrada?.novaRazina
                ? [{ id: 'zagrijan', novaRazina: nagrada.novaRazina, maksimalnaRazina: nagrada.maksimalnaRazina }]
                : []),
              ...(ishod?.novaDostignuca ?? []),
            ];
            const poId = new Map(novaDostignuca.map((d) => [d.id, d]));
            const poruka: KrajPartije = {
              partijaId: stanje.partijaId,
              prikazRezultataOdIso,
              plasmani,
              mojNoviProsjek: 0,
              mojRang: null,
              mojeIskustvo: null,
              mojaOcjenaIgre: null,
              bonusOcjenaIgre: 0,
              novaDostignuca: [...poId.values()],
              promjeneMisija: ishod?.promjeneMisija,
              ukupnoIskustvo: ishod?.ukupnoIskustvo,
              misijeStanjeVerzija: ishod?.misijeStanjeVerzija,
              mod: stanje.mod,
              kontekst: 'trening',
            };
            stanje.rezultatiKraja.set(p.igracId, poruka);
            // izadji može obrisati mapiranje prije ovog async upisa; i dalje pošalji kraj
            // dok igrač nije u drugoj partiji.
            const trenutnaPartija = partijaPoIgracu.get(p.igracId);
            if (trenutnaPartija === stanje.partijaId || trenutnaPartija === undefined) {
              aktivneVeze.dohvatiSocket(p.igracId)?.emit('partija:kraj', poruka);
            }
          }
        },
        () => {
          postavke.naPartijaZavrsila?.(stanje.partijaId);
          zakaziBrisanjeNakonSpremanja(stanje);
        },
      );
      return;
    }

    if (stanje.jePrivatna) {
      const privatneStatistike = new Map<string, ZapisStatistikeRijeci>(
        [...stanje.statistikeRijeci].map(([igracId, statistika]) => [igracId, {
          igracId,
          prihvaceniPotezi: statistika.prihvaceniPotezi,
          ukupnoTrajanjePrihvaceniPoteziMs: statistika.ukupnoTrajanjePrihvaceniPoteziMs,
          grupe: [...(stanje.noveGrupeSNagradom.get(igracId) ?? [])].map(([grupa, tier]) => ({ grupa, tier })),
          otkljucaneRijeci: [...statistika.otkljucaneRijeci].map(([rijec, oznake]) => ({ rijec, ...oznake })),
          najduziStreak: statistika.najduziStreak,
          otkriveneJakoRijetkeGrupe: statistika.otkriveneJakoRijetkeGrupe.size,
          otkriveneSrednjeRijetkeGrupe: statistika.otkriveneSrednjeRijetkeGrupe.size,
          otkriveneRijetkeGrupe: statistika.otkriveneRijetkeGrupe.size,
          upisaneDugeRijeci: statistika.upisaneDugeRijeci,
          upisaneSrednjeDugeRijeci: statistika.upisaneSrednjeDugeRijeci,
          upisaneJakoDugeRijeci: statistika.upisaneJakoDugeRijeci,
          prihvaceneRijetkeRijeci: statistika.prihvaceneRijetkeRijeci,
          prihvaceneJakoRijetkeRijeci: statistika.prihvaceneJakoRijetkeRijeci,
          dugeIRijetkeRijeci: statistika.dugeIRijetkeRijeci,
          pogresniUnosi: statistika.pogresniUnosi,
          dugeRijetkeRijeci: [...statistika.kvalificiraneDugeRijetkeRijeci],
          razlicitiPoceci: [...statistika.razlicitiPoceci],
          najduzaRijec: statistika.najduzaRijec,
          najduzaRijecGrafemi: statistika.najduzaRijecGrafemi,
          najrjedaRijec: statistika.najrjedaRijec,
          najrjedaRijecFrekvencija: statistika.najrjedaRijecFrekvencija,
          najrjedaTier: statistika.najrjedaTier,
        }]),
      );
      const privatniRezultati = plasmani.map((p) => ({
        igracId: p.igracId,
        plasman: p.plasman as 1 | 2 | 3 | 4,
        bodovi: 0,
        eliminacije: 0,
        iskustvo: 0,
        nacinIspadanja: p.plasman === 1 ? ('pobjednik' as const) : nacinIspadanjaZaIgraca(stanje, p.igracId),
      }));
      pokreniSpremanjeRezultata(
        stanje,
        () => zakljuciPartijuUBazi(stanje.partijaId, pobjednikId, privatniRezultati, stanje.mod, privatneStatistike, true, new Map(
          [...stanje.napredakDostignuca].map(([igracId, delta]) => [igracId, { delta }]),
        )).then(async (agregati) => {
          await obavijestiPrvuIgruSudionicima(stanje, 'privatna');
          if (stanje.kodSobe) {
            postavke.naPrivatnaPartijaZavrsila?.(stanje.kodSobe, stanje.partijaId, pobjednikId, plasmani);
          }
          for (const p of plasmani) {
            const poruka: KrajPartije = {
              partijaId: stanje.partijaId,
              prikazRezultataOdIso,
              plasmani,
              mojNoviProsjek: 0,
              mojRang: null,
              mojeIskustvo: null,
              // Privatne partije ne ulaze u javnu ocjenu igre ni XP bonus ocjene.
              mojaOcjenaIgre: null,
              bonusOcjenaIgre: 0,
              novaDostignuca: agregati.get(p.igracId)?.novaDostignuca ?? [],
              kolekcija: kolekcijaZaKraj(stanje, p.igracId),
              kontekst: 'privatna',
              jePrivatna: true,
              kodSobe: stanje.kodSobe,
            };
            stanje.rezultatiKraja.set(p.igracId, poruka);
            // izadji može obrisati mapiranje prije ovog async upisa; i dalje pošalji kraj
            // dok igrač nije u drugoj partiji.
            const trenutnaPartija = partijaPoIgracu.get(p.igracId);
            if (trenutnaPartija === stanje.partijaId || trenutnaPartija === undefined) {
              aktivneVeze.dohvatiSocket(p.igracId)?.emit('partija:kraj', poruka);
            }
          }
        }),
      () => {
        postavke.naPartijaZavrsila?.(stanje.partijaId);
        zakaziBrisanjeNakonSpremanja(stanje);
      },
      );
      return;
    }

    dodajStavkuIskustva(stanje, pobjednikId, { vrsta: 'pobjeda', naziv: 'Pobjeda', kolicina: 1, poStavci: ISKUSTVO_POBJEDA, iskustvo: ISKUSTVO_POBJEDA });
    const obracuniIskustva = new Map<string, ReturnType<typeof izracunajObracunIskustva>>();
    const rezultatiZaUpis = plasmani.map((p) => {
      const nacinIspadanja = p.plasman === 1 ? ('pobjednik' as const) : nacinIspadanjaZaIgraca(stanje, p.igracId);
      const obracun = nacinIspadanja === 'prekid'
        ? izracunajObracunIskustva(stanje.iskustvoPrije.get(p.igracId) ?? 0, [], 0)
        : izracunajObracunIskustva(stanje.iskustvoPrije.get(p.igracId) ?? 0, stanje.stavkeIskustva.get(p.igracId) ?? [], stanje.statistikeRijeci.get(p.igracId)?.najduziStreak ?? 0);
      obracuniIskustva.set(p.igracId, obracun);
      return { igracId: p.igracId, plasman: p.plasman as 1 | 2 | 3 | 4, bodovi: p.bodovi, eliminacije: p.eliminacije, iskustvo: obracun.osvojenoIskustvo, nacinIspadanja };
    });
    stanje.razloziEliminacije.clear();

    const statistike = new Map<string, ZapisStatistikeRijeci>(
      [...stanje.statistikeRijeci].map(([igracId, statistika]) => [igracId, {
        igracId,
        prihvaceniPotezi: statistika.prihvaceniPotezi,
        ukupnoTrajanjePrihvaceniPoteziMs: statistika.ukupnoTrajanjePrihvaceniPoteziMs,
        grupe: [...(stanje.noveGrupeSNagradom.get(igracId) ?? [])].map(([grupa, tier]) => ({ grupa, tier })),
        otkljucaneRijeci: [...statistika.otkljucaneRijeci].map(([rijec, oznake]) => ({ rijec, ...oznake })),
        najduziStreak: statistika.najduziStreak,
        otkriveneJakoRijetkeGrupe: statistika.otkriveneJakoRijetkeGrupe.size,
        otkriveneSrednjeRijetkeGrupe: statistika.otkriveneSrednjeRijetkeGrupe.size,
        otkriveneRijetkeGrupe: statistika.otkriveneRijetkeGrupe.size,
        upisaneDugeRijeci: statistika.upisaneDugeRijeci,
        upisaneSrednjeDugeRijeci: statistika.upisaneSrednjeDugeRijeci,
        upisaneJakoDugeRijeci: statistika.upisaneJakoDugeRijeci,
        prihvaceneRijetkeRijeci: statistika.prihvaceneRijetkeRijeci,
        prihvaceneJakoRijetkeRijeci: statistika.prihvaceneJakoRijetkeRijeci,
        dugeIRijetkeRijeci: statistika.dugeIRijetkeRijeci,
        pogresniUnosi: statistika.pogresniUnosi,
        dugeRijetkeRijeci: [...statistika.kvalificiraneDugeRijetkeRijeci],
        razlicitiPoceci: [...statistika.razlicitiPoceci],
        najduzaRijec: statistika.najduzaRijec,
        najduzaRijecGrafemi: statistika.najduzaRijecGrafemi,
        najrjedaRijec: statistika.najrjedaRijec,
        najrjedaRijecFrekvencija: statistika.najrjedaRijecFrekvencija,
        najrjedaTier: statistika.najrjedaTier,
      }]),
    );

    const osnovniBrutoPoIgracu = new Map(
      [...obracuniIskustva].map(([igracId, obracun]) => [igracId, obracun.brutoIskustvo]),
    );

    pokreniSpremanjeRezultata(
      stanje,
      () => zakljuciPartijuUBazi(stanje.partijaId, pobjednikId, rezultatiZaUpis, stanje.mod, statistike, false, new Map(
        [...stanje.napredakDostignuca].map(([igracId, delta]) => [igracId, { delta }]),
      ), zavrsenoU, osnovniBrutoPoIgracu).then(async (agregati) => {
        await obavijestiPrvuIgruSudionicima(stanje, 'javna');
        const plasmaniSOcjenama = plasmani.map((p) => ({
          ...p,
          ocjenaIgre: agregati.get(p.igracId)?.ocjenaIgre ?? null,
        }));
        for (const p of plasmaniSOcjenama) {
          const agregat = agregati.get(p.igracId);
          const prosjek = agregat && agregat.odigrane > 0 ? agregat.bodoviUkupno / agregat.odigrane : 0;
          const socket = aktivneVeze.dohvatiSocket(p.igracId);
          if (agregat && socket) {
            if (stanje.mod === 'dva_igraca') {
              socket.data.odigrane1v1 = agregat.odigrane;
              socket.data.pobjede1v1 = agregat.pobjede;
              socket.data.bodovi1v1 = agregat.bodoviUkupno;
            } else {
              socket.data.odigrane = agregat.odigrane;
              socket.data.pobjede = agregat.pobjede;
              socket.data.bodoviUkupno = agregat.bodoviUkupno;
            }
            if (stanje.mod === 'dva_igraca') socket.data.trenutniNiz1v1 = agregat.nizPoslije;
            else socket.data.trenutniNiz4p = agregat.nizPoslije;
          }
          const poruka: KrajPartije = {
            partijaId: stanje.partijaId,
            prikazRezultataOdIso,
            plasmani: plasmaniSOcjenama,
            mojNoviProsjek: prosjek,
            mojRang: null,
            mojeIskustvo: (() => {
              const obracun = obracuniIskustva.get(p.igracId);
              if (!obracun) return null;
              const bonusNiza = agregat?.bonusPobjednickogNizaXp ?? 0;
              if (bonusNiza > 0) {
                obracun.stavke.push({ vrsta: 'pobjednicki_niz', naziv: `Pobjednički niz +${agregat?.bonusPobjednickogNizaPostotak ?? 0} %`, kolicina: 1, poStavci: null, iskustvo: bonusNiza });
                obracun.brutoIskustvo += bonusNiza;
                obracun.osvojenoIskustvo = Math.min(obracun.osvojenoIskustvo + bonusNiza, MAKSIMALNO_ISKUSTVO - obracun.prije.ukupno);
              }
              const bonusPostotak = agregat?.bonusOcjenaIgre ?? 0;
              if (bonusPostotak > 0) {
                const bonus = Math.round(obracun.osvojenoIskustvo * bonusPostotak / 100);
                obracun.stavke.push({ vrsta: 'streak', naziv: `Ocjena igre +${bonusPostotak} %`, kolicina: 1, poStavci: null, iskustvo: bonus });
                obracun.brutoIskustvo += bonus;
                obracun.osvojenoIskustvo = Math.min(obracun.osvojenoIskustvo + bonus, MAKSIMALNO_ISKUSTVO - obracun.prije.ukupno);
              }
              obracun.poslije = stanjeIskustva(obracun.prije.ukupno + obracun.osvojenoIskustvo);
              return obracun;
            })(),
            mojaOcjenaIgre: agregat?.ocjenaIgre ?? null,
            bonusOcjenaIgre: agregat?.bonusOcjenaIgre ?? 0,
            novaDostignuca: agregat?.novaDostignuca ?? [],
            pohvale: agregat?.pohvale?.length ? agregat.pohvale : undefined,
            mojaForma: agregat?.forma ?? undefined,
            mojNiz: agregat ? { prije: agregat.nizPrije, poslije: agregat.nizPoslije, najbolji: agregat.najboljiNiz } : undefined,
            kolekcija: kolekcijaZaKraj(stanje, p.igracId),
            mojDnk: agregat ? {
              odigrano: agregat.odigrane,
              preostaloDoOtkljucavanja: Math.max(0, 10 - agregat.odigrane),
              otkljucan: agregat.odigrane >= 10,
              upravoOtkljucan: agregat.odigrane === 10,
              prije: agregat.dnkPrije,
              poslije: agregat.dnkPoslije,
            } : undefined,
            promjeneMisija: agregat?.promjeneMisija,
            ukupnoIskustvo: agregat?.ukupnoIskustvo,
            misijeStanjeVerzija: agregat?.misijeStanjeVerzija,
            mod: stanje.mod,
            kontekst: 'javna',
          };
          stanje.rezultatiKraja.set(p.igracId, poruka);
          // izadji može obrisati mapiranje prije ovog async upisa; i dalje pošalji kraj
          // dok igrač nije u drugoj partiji.
          const trenutnaPartija = partijaPoIgracu.get(p.igracId);
          if (trenutnaPartija === stanje.partijaId || trenutnaPartija === undefined) {
            socket?.emit('partija:kraj', poruka);
          }
        }
      }),
      () => {
        postavke.naPartijaZavrsila?.(stanje.partijaId);
        zakaziBrisanjeNakonSpremanja(stanje);
      },
    );
  }

  async function obavijestiPrvuIgruSudionicima(
    stanje: StanjeStola,
    kontekst: 'javna' | 'privatna' | 'trening',
  ): Promise<void> {
    try {
      await Promise.all(stanje.sudionici.map((sudionik) => mozdaObavijestiPrvuIgru({
        igracId: sudionik.igracId,
        jeGost: sudionik.vrsta === 'gost',
        jeBot: sudionik.upravljac === 'bot',
        izvorId: stanje.partijaId,
        kontekst,
        mod: stanje.mod,
      })));
    } catch (greska) {
      // Sandučic ne smije blokirati partija:kraj ni retry spremanja rezultata.
      console.error('sanducic:prva_igra nije uspjela', {
        partijaId: stanje.partijaId,
        kontekst,
        greska,
      });
    }
  }

  function nacinIspadanjaZaIgraca(
    stanje: StanjeStola,
    igracId: string,
  ): 'ne_znam' | 'istek' | 'mrtva_slova' | 'prekid' | 'kaladont' {
    const razlog = stanje.razloziEliminacije.get(igracId);
    if (razlog === 'ne_znam' || razlog === 'istek' || razlog === 'prekid' || razlog === 'kaladont') return razlog;
    return 'mrtva_slova';
  }

  function upravljacZaAnalitiku(stanje: StanjeStola, igracId: string | null | undefined): UpravljacOtvaranjaAnalitike | null {
    if (!igracId) return null;
    return stanje.sudionici.find((s) => s.igracId === igracId)?.upravljac ?? null;
  }

  function syncAnalitikaProzor(
    stanje: StanjeStola,
    dodatak: {
      status?: StatusOtvaranjaAnalitike;
      zatvorenoU?: Date | null;
      incidentPozicija?: 1 | 2 | null;
      incidentRijecUzrok?: string | null;
      incidentRazlog?: string | null;
      incidentAutorUpravljac?: UpravljacOtvaranjaAnalitike | null;
      incidentZrtvaUpravljac?: UpravljacOtvaranjaAnalitike | null;
    } = {},
  ): void {
    const prozor = stanje.analitikaProzor;
    if (!prozor) return;
    if (dodatak.status) prozor.status = dodatak.status;
    zabiljeziOtvaranjeAnalitike({
      igraId: stanje.partijaId,
      redniBrojOtvaranja: prozor.redniBroj,
      kontekst: stanje.kontekst,
      mod: stanje.mod,
      brojSudionika: stanje.sudionici.length,
      sustavskaRijec: prozor.sustavskaRijec,
      izvor: prozor.izvor,
      brojOdgovora: prozor.brojOdgovora,
      odgovor1: prozor.odgovor1,
      odgovor2: prozor.odgovor2,
      status: prozor.status,
      incidentPozicija: dodatak.incidentPozicija ?? null,
      incidentRijecUzrok: dodatak.incidentRijecUzrok ?? null,
      incidentRazlog: dodatak.incidentRazlog ?? null,
      incidentAutorUpravljac: dodatak.incidentAutorUpravljac ?? null,
      incidentZrtvaUpravljac: dodatak.incidentZrtvaUpravljac ?? null,
      dodijeljenoU: prozor.dodijeljenoU,
      zatvorenoU: dodatak.zatvorenoU ?? null,
    });
  }

  function otvoriAnalitikaProzor(
    stanje: StanjeStola,
    izvor: IzvorOtvaranjaAnalitike,
    sustavskaRijec: string | null,
    status: StatusOtvaranjaAnalitike = 'otvoren',
  ): void {
    if (stanje.analitikaProzor?.status === 'otvoren') {
      syncAnalitikaProzor(stanje, { status: 'nepotpuno', zatvorenoU: new Date(sat.sada()) });
    }
    stanje.analitikaOtvaranjaRedni += 1;
    stanje.analitikaProzor = {
      redniBroj: stanje.analitikaOtvaranjaRedni,
      brojOdgovora: 0,
      odgovor1: null,
      odgovor2: null,
      sustavskaRijec,
      izvor,
      status,
      dodijeljenoU: new Date(sat.sada()),
    };
    syncAnalitikaProzor(stanje, {
      status,
      zatvorenoU: status === 'otvoren' ? null : new Date(sat.sada()),
    });
    if (status !== 'otvoren') stanje.analitikaProzor = null;
  }

  function zabiljeziAnalitikaOdgovor(stanje: StanjeStola, rijec: string): void {
    const prozor = stanje.analitikaProzor;
    if (!prozor || prozor.status !== 'otvoren' || prozor.brojOdgovora >= 2) return;
    prozor.brojOdgovora += 1;
    if (prozor.brojOdgovora === 1) prozor.odgovor1 = rijec;
    else prozor.odgovor2 = rijec;
  }

  function zatvoriAnalitikaProzorDrugim(stanje: StanjeStola): void {
    const prozor = stanje.analitikaProzor;
    if (!prozor || prozor.status !== 'otvoren') return;
    syncAnalitikaProzor(stanje, { status: 'zatvoren_drugim', zatvorenoU: new Date(sat.sada()) });
    stanje.analitikaProzor = null;
  }

  function zatvoriAnalitikaProzorRanimIncidentom(
    stanje: StanjeStola,
    razlog: string,
    autorId: string | null,
    zrtvaId: string,
  ): void {
    const prozor = stanje.analitikaProzor;
    if (!prozor || prozor.status !== 'otvoren') return;
    if (prozor.brojOdgovora !== 1 && prozor.brojOdgovora !== 2) return;
    const pozicija = prozor.brojOdgovora as 1 | 2;
    syncAnalitikaProzor(stanje, {
      status: 'rani_incident',
      zatvorenoU: new Date(sat.sada()),
      incidentPozicija: pozicija,
      incidentRijecUzrok: pozicija === 1 ? prozor.odgovor1 : prozor.odgovor2,
      incidentRazlog: razlog,
      incidentAutorUpravljac: upravljacZaAnalitiku(stanje, autorId),
      incidentZrtvaUpravljac: upravljacZaAnalitiku(stanje, zrtvaId),
    });
    stanje.analitikaProzor = null;
  }

  function mozdaZatvoriAnalitikaProzorDvaOdgovora(stanje: StanjeStola): void {
    const prozor = stanje.analitikaProzor;
    if (!prozor || prozor.status !== 'otvoren' || prozor.brojOdgovora !== 2) return;
    syncAnalitikaProzor(stanje, { status: 'dva_odgovora_ok', zatvorenoU: new Date(sat.sada()) });
    stanje.analitikaProzor = null;
  }

  /**
   * Otvaranje runde (1. runda, nakon eliminacije ili kaladont-efekta): sustav - ne igrac - bira
   * rijec, sprjecavajuci namjestanje ishoda odabirom "zamke" za konkretnog protivnika.
  * Prijelaz od 8s ostavlja vrijeme za razlog eliminacije; timer poteza kreće nakon dodjele riječi.
   * napadac = igrac nakon kojeg sustav preuzima red (null za 1. rundu partije).
   */
  function zapocniIzborRijeciSustava(stanje: StanjeStola, napadac: string | null): void {
    const izvorniRok = stanje.izborUToku ? stanje.istekIzboraIso : null;
    const trajanje = postavke.trajanjeIzboraSustavaMs ?? (konfiguracija.NODE_ENV === 'test' ? 0 : TRAJANJE_IZBORA_SUSTAVA_MS);
    if (stanje.timerHandle) sat.otkazi(stanje.timerHandle);
    stanje.timerHandle = null;
    if (stanje.izborHandle) sat.otkazi(stanje.izborHandle); // moze se dogoditi ako netko napusti partiju dok sustav vec bira
    stanje.izborUToku = true;
    stanje.napadacId = null;
    stanje.istekIzboraIso = izvorniRok || new Date(sat.sada() + trajanje).toISOString();
    const poruka: SustavBiraRijec = { istekIzboraIso: stanje.istekIzboraIso };
    io.to(SOBA_PARTIJE(stanje.partijaId)).emit('partija:sustav-bira-rijec', poruka);
    stanje.izborHandle = sat.zakazi(() => objaviRijecSustava(stanje, napadac), Math.max(0, Date.parse(stanje.istekIzboraIso) - sat.sada()));
    objaviPromjenuPoteza(stanje);
  }

  function objaviRijecSustava(stanje: StanjeStola, napadac: string | null): void {
    if (stanje.zavrsena || prekiniPrazanPocetak(stanje)) return;
    stanje.izborHandle = null;
    const odabir = rjecnik.nasumicnaPocetnaRijec(stanje.iskoristeneGrupe, stanje.dopusteneVrste);
    if (!odabir) {
      stanje.zadnjiIzvorPocetne = 'nema_kandidata';
      otvoriAnalitikaProzor(stanje, 'nema_kandidata', null, 'zatvoren_drugim');
      // Rječnik iscrpljen: zakljuciPartiju očekuje ≤1 aktivnog. Ostale rangiraj kao
      // mrtva_slova_iskoristeno (bez nove runde), inače CI/simulacija ostane bez partija:kraj.
      const preostali = [...stanje.aktivni];
      for (let i = 1; i < preostali.length; i += 1) {
        const igracId = preostali[i]!;
        stanje.aktivni.delete(igracId);
        stanje.eliminirani.push(igracId);
        stanje.razloziEliminacije.set(igracId, 'mrtva_slova_iskoristeno');
        const plasman = stanje.aktivni.size + 1;
        const porukaElim: Eliminacija = {
          igracId,
          plasman,
          razlog: 'mrtva_slova_iskoristeno',
          bodZa: null,
          slova: null,
          rijecUzrok: null,
          iskustvo: null,
        };
        stanje.eliminacije.push(porukaElim);
        io.to(SOBA_PARTIJE(stanje.partijaId)).emit('partija:eliminacija', porukaElim);
      }
      zakljuciPartiju(stanje);
      return;
    }

    const autoRijec = odabir.rijec;
    stanje.zadnjiIzvorPocetne = odabir.izvor;
    otvoriAnalitikaProzor(stanje, odabir.izvor, autoRijec, 'otvoren');
    stanje.runda += 1;
    potrosiGrupe(stanje, autoRijec);
    const trazenaSlova = zadnjaDva(autoRijec);
    const naPotezu = napadac ? (sljedeciAktivni(stanje, napadac) ?? napadac) : stanje.naPotezuId;

    stanje.naPotezuId = naPotezu;
    noviTurnToken(stanje);
    stanje.trazenaSlova = trazenaSlova;
    stanje.zadnjaRijec = autoRijec;
    stanje.zadnjaRijecIgracId = null;
    stanje.zadnjaRijecVrsta = 'sustav_rijec';
    stanje.izborUToku = false;
    stanje.istekIzboraIso = null;

    stanje.redniBroj += 1;
    spremiPotezAkoTreba(stanje, {
      runda: stanje.runda,
      redniBroj: stanje.redniBroj,
      igracId: null,
      vrsta: 'sustav_rijec',
      rijec: autoRijec,
      trazenaSlova: null,
      trajanjeMs: 0,
    });

    postaviTimer(stanje);
    const poruka: RundaOtvorena = {
      rijec: autoRijec,
      trazenaSlova,
      naPotezuId: naPotezu,
      turnToken: stanje.turnToken,
      istekPotezaIso: istekPotezaIso(stanje),
      serverVrijemeIso: new Date(sat.sada()).toISOString(),
      runda: stanje.runda,
    };
    io.to(SOBA_PARTIJE(stanje.partijaId)).emit('partija:runda-otvorena', poruka);
    objaviPromjenuPoteza(stanje);
  }

  function eliminirajIgraca(
    stanje: StanjeStola,
    igracId: string,
    razlog: RazlogEliminacije,
    kontekstPrekida?: Pick<PrekidUTijeku, 'bioNaPotezu' | 'napadacId'>,
  ): void {
    if (stanje.zavrsena || !stanje.aktivni.has(igracId)) return;

    // Rani incident mrtvih slova zatvara se u obradi poteza prije ovog poziva.
    if (!razlog.startsWith('mrtva_slova')) zatvoriAnalitikaProzorDrugim(stanje);

    ponistiCekanjePovratka(stanje, igracId);
    stanje.zadnjiPotezi.delete(igracId);
    if (razlog === 'istek' && stanje.sudionici.find((s) => s.igracId === igracId)?.upravljac === 'bot') {
      brojIstekaBota += 1;
      const plan = namjerniIsteciBotova.get(stanje.partijaId);
      if (plan?.igracId === igracId && plan.turnToken === stanje.turnToken) brojNamjernihIstekaBota += 1;
    }
    if (namjerniIsteciBotova.get(stanje.partijaId)?.igracId === igracId) namjerniIsteciBotova.delete(stanje.partijaId);

    stanje.aktivni.delete(igracId);
    stanje.eliminirani.push(igracId);
    stanje.razloziEliminacije.set(igracId, razlog);

    stanje.redniBroj += 1;
    spremiPotezAkoTreba(stanje, {
      runda: stanje.runda,
      redniBroj: stanje.redniBroj,
      igracId,
      vrsta: razlog.startsWith('mrtva_slova') ? 'auto_kraj' : (razlog as 'ne_znam' | 'istek' | 'prekid'),
      rijec: null,
      trazenaSlova: stanje.trazenaSlova,
      trajanjeMs: razlog.startsWith('mrtva_slova') ? 0 : sat.sada() - stanje.vrijemePocetkaPotezaMs,
    });

    // napadac nikad nije sam eliminirani igrac (npr. otvarač runde koji istekne prije ijedne riječi)
    const bioNaPotezuKodPrekida = kontekstPrekida?.bioNaPotezu ?? igracId === stanje.naPotezuId;
    const jeSamoeliminacijaIzvanPoteza = razlog === 'prekid' && !bioNaPotezuKodPrekida; // RS-10
    const napadac = jeSamoeliminacijaIzvanPoteza
      ? null
      : razlog === 'prekid' && kontekstPrekida
        ? kontekstPrekida.napadacId
        : stanje.napadacId;
    const stavkaEliminacije = stanje.politika.dajeNapredak && napadac
      ? { vrsta: 'eliminacije' as const, naziv: 'Eliminacija', kolicina: 1, poStavci: ISKUSTVO_ELIMINACIJA, iskustvo: ISKUSTVO_ELIMINACIJA }
      : null;
    if (napadac) {
      stanje.eliminacijeBrojac.set(napadac, (stanje.eliminacijeBrojac.get(napadac) ?? 0) + 1);
      dodajNapredakDostignuca(stanje, napadac, {
        izazvaneEliminacije: 1,
        ...(razlog.startsWith('mrtva_slova') ? { mrtvaSlovaEliminacije: 1 } : {}),
      });
      dodajStavkuIskustva(stanje, napadac, stavkaEliminacije!);
    }

    const plasman = stanje.aktivni.size + 1;
    const poruka: Eliminacija = {
      igracId,
      plasman,
      razlog,
      bodZa: napadac,
        slova: razlog.startsWith('mrtva_slova') ? stanje.trazenaSlova : null,
      rijecUzrok: razlog.startsWith('mrtva_slova') ? stanje.zadnjaRijec : null,
      iskustvo: stavkaEliminacije,
    };
    stanje.eliminacije.push(poruka);
    if (stanje.politika.dajeNapredak) {
      const nacinIspadanja = razlog.startsWith('mrtva_slova') ? 'mrtva_slova' : razlog as 'ne_znam' | 'istek' | 'prekid' | 'kaladont';
      void spremiRaniPorazUBazi({
        partijaId: stanje.partijaId,
        igracId,
        mod: stanje.mod,
        plasman: plasman as 1 | 2 | 3 | 4,
        bodovi: izracunajBodove({ plasman: plasman as 1 | 2 | 3 | 4, eliminacije: stanje.eliminacijeBrojac.get(igracId) ?? 0 }, stanje.mod),
        eliminacije: stanje.eliminacijeBrojac.get(igracId) ?? 0,
        nacinIspadanja,
      });
    }
    io.to(SOBA_PARTIJE(stanje.partijaId)).emit('partija:eliminacija', poruka);
    postavke.naEliminacijuZaBotove?.(
      stanje.partijaId,
      stanje.kontekst,
      igracId,
      napadac,
      stanje.sudionici.map((s) => ({ igracId: s.igracId, upravljac: s.upravljac })),
    );

    if (stanje.politika.dajeNapredak && razlog !== 'prekid') {
      const obracun = izracunajObracunIskustva(
        stanje.iskustvoPrije.get(igracId) ?? 0,
        stanje.stavkeIskustva.get(igracId) ?? [],
        stanje.statistikeRijeci.get(igracId)?.najduziStreak ?? 0,
      );
      aktivneVeze.dohvatiSocket(igracId)?.emit('iskustvo:obracun', { partijaId: stanje.partijaId, mojeIskustvo: obracun });
    }

    if (stanje.aktivni.size <= 1) {
      zakljuciPartiju(stanje);
      return;
    }

    if (razlog === 'prekid' && stanje.naPotezuId === igracId) {
      // Ako je odspojeni igrač bio na potezu, preskoči ga i nastavi red bez nove runde.
      const sljedeci = sljedeciAktivni(stanje, igracId);
      if (sljedeci) {
        stanje.naPotezuId = sljedeci;
        noviTurnToken(stanje);
        if (!stanje.izborUToku) postaviTimer(stanje);
        posaljiStanjeSvima(stanje);
        objaviPromjenuPoteza(stanje);
      }
      return;
    }

    if (jeSamoeliminacijaIzvanPoteza) {
      // Tijekom tolerancije red je mogao doći do odspojenog igrača. Preskoči ga bez boda i nove runde.
      if (stanje.naPotezuId === igracId) {
        const sljedeci = sljedeciAktivni(stanje, igracId);
        if (sljedeci) {
          stanje.naPotezuId = sljedeci;
          noviTurnToken(stanje);
          if (!stanje.izborUToku) postaviTimer(stanje);
          posaljiStanjeSvima(stanje);
          objaviPromjenuPoteza(stanje);
        }
      }
      return;
    }

    // Anchor za objaviRijecSustava: autor riječi ili eliminirani (bez napadača).
    // Ne pre-advancati za mrtva_slova — objaviRijecSustava već radi jedan sljedeciAktivni.
    const noviOtvarac = napadac ?? igracId;
    // Ne dodjeljuj novi aktivni potez prije izbora riječi — inače sljedeći (često
    // napadač) dobije formu na ~trenutak, pa se UI čini zamrznutim / neupotrebljivim.
    if (stanje.timerHandle) {
      sat.otkazi(stanje.timerHandle);
      stanje.timerHandle = null;
    }
    zapocniIzborRijeciSustava(stanje, noviOtvarac);
  }

  function obradiPrihvacenPotez(
    stanje: StanjeStola,
    igracId: string,
    rijecNormalizirana: string,
    izvorniSocket?: KaladontSocket,
  ): void {
    const trazenaSlovaZaOvajPotez = stanje.trazenaSlova!;
    const trajanjeMs = sat.sada() - stanje.vrijemePocetkaPotezaMs;
    const prethodniNapadacId = stanje.napadacId;
    const sudionik = stanje.sudionici.find((stavka) => stavka.igracId === igracId);
    const gamifikacijaAktivna = stanje.politika.dajeDostignucaIKolekcije;
    const kolekcijaAktivna = gamifikacijaAktivna || (stanje.politika.zapisujeKolekcijuTreninga && sudionik?.upravljac === 'covjek');
    const trenutniStreak = gamifikacijaAktivna ? (stanje.streakovi.get(igracId) ?? 0) + 1 : 0;
    if (stanje.kontekst === 'trening' && sudionik?.upravljac === 'covjek') zakaziNeaktivnostTreninga(stanje);
    if (gamifikacijaAktivna) stanje.streakovi.set(igracId, trenutniStreak);
    const statistikaPoteza = stanje.statistikeRijeci.get(igracId)!;
    statistikaPoteza.prihvaceniPotezi += 1;
    statistikaPoteza.ukupnoTrajanjePrihvaceniPoteziMs += Math.max(0, trajanjeMs);
    const grupe = rjecnik.grupeZa(rijecNormalizirana);
    const frekvencija = rjecnik.frekvencijaZa?.(rijecNormalizirana);
    const grupeIgraca = stanje.grupeSNagradom.get(igracId) ?? new Map<string, number | null>();
    stanje.grupeSNagradom.set(igracId, grupeIgraca);
    const kolekcijskeGrupePrije = new Set([...grupeIgraca.keys()].map(kolekcijskiKljucGrupe));
    const noveGrupe = kolekcijaAktivna ? grupe.filter((grupa) => !grupeIgraca.has(grupa)) : [];
    const grupeZaDostignucaIgraca = stanje.grupeZaDostignuca.get(igracId) ?? new Set<string>();
    const noveGrupeZaDostignuca = gamifikacijaAktivna ? grupe.filter((grupa) => !grupeZaDostignucaIgraca.has(grupa)) : [];
    const brojGrafema = grafemi(rijecNormalizirana).length;
    const rijetkaTier = frekvencija === 0 && brojGrafema >= 4 ? 0 : typeof frekvencija === 'number' && frekvencija <= 9 ? 1 : typeof frekvencija === 'number' && frekvencija <= 99 ? 2 : null;
    for (const grupa of noveGrupe) grupeIgraca.set(grupa, rijetkaTier);
    const duljinaZaOznaku = tierDuljineIskustva(rijecNormalizirana);
    const rijetkostZaOznaku = tierRijetkostiIskustva(frekvencija, brojGrafema);
    const noveGrupeKolekcije = stanje.noveGrupeKolekcije.get(igracId) ?? new Map<string, MetapodatakOtkljucanjaKolekcije>();
    for (const grupa of noveGrupe) {
      if (noveGrupeKolekcije.has(grupa)) continue;
      noveGrupeKolekcije.set(grupa, {
        odigraniOblik: rijecNormalizirana,
        duljina: duljinaZaOznaku,
        rijetkost: rijetkostZaOznaku,
      });
    }
    if (kolekcijaAktivna) stanje.noveGrupeKolekcije.set(igracId, noveGrupeKolekcije);
    const noveOsnovneRijeci = [...new Set(noveGrupe
      .filter((grupa) => !kolekcijskeGrupePrije.has(kolekcijskiKljucGrupe(grupa)))
      .map(osnovnaRijecIzGrupe))];
    const stavkePotezaIskustva: StavkaIskustva[] = [];
    let noviDugiOblik = false;
    let noviRijetkiOblik = false;
    let nagrada: PrihvacenPotez['nagrada'] = null;
    if (gamifikacijaAktivna) {
      const statistika = stanje.statistikeRijeci.get(igracId)!;
      statistika.najduziStreak = Math.max(statistika.najduziStreak, trenutniStreak);
      if (brojGrafema >= PRAGOVI_DULJINE.jakoDuga) statistika.upisaneJakoDugeRijeci += 1;
      else if (brojGrafema >= PRAGOVI_DULJINE.srednjeDuga) statistika.upisaneSrednjeDugeRijeci += 1;
      else if (brojGrafema >= PRAGOVI_DULJINE.duga) statistika.upisaneDugeRijeci += 1;
      if (brojGrafema > statistika.najduzaRijecGrafemi) {
        statistika.najduzaRijec = rijecNormalizirana;
        statistika.najduzaRijecGrafemi = brojGrafema;
      }
      const pocetak = prvaDva(rijecNormalizirana);
      if (pocetak.length > 0) statistika.razlicitiPoceci.add(pocetak);
      if (frekvencija !== undefined && frekvencija !== null) {
        const tier = frekvencija === 0 && brojGrafema >= 4 ? 0 : frekvencija <= 9 ? 1 : frekvencija <= 99 ? 2 : null;
        if (tier !== null) {
          statistika.prihvaceneRijetkeRijeci += 1;
          if (tier === 0) statistika.prihvaceneJakoRijetkeRijeci += 1;
          if (brojGrafema >= PRAGOVI_DULJINE.duga) statistika.dugeIRijetkeRijeci += 1;
        }
        // Rijetka grdosija: isti prihvaćeni potez je dugačak i bilo kojeg tiera rijetkosti, uključujući 0.
        // Provjera je !== null (tier 0 nije truthy). Skup oblika ide u završni obračun, ne u brojač usred igre.
        // Isti normalizirani oblik ne ulazi dvaput. Ne uključuje bota, gosta, trening ni sustavsku početnu riječ.
        if (
          sudionik?.upravljac === 'covjek'
          && (sudionik.vrsta === 'registriran' || sudionik.vrsta === 'admin')
          && stanje.kontekst !== 'trening'
          && brojGrafema >= PRAGOVI_DULJINE.duga
          && tier !== null
        ) {
          statistika.kvalificiraneDugeRijetkeRijeci.add(rijecNormalizirana);
        }
        const grupeZaStatistiku = tier === 0 ? statistika.otkriveneJakoRijetkeGrupe : tier === 1 ? statistika.otkriveneSrednjeRijetkeGrupe : tier === 2 ? statistika.otkriveneRijetkeGrupe : null;
        if (tier !== null && grupeZaStatistiku) {
          for (const grupa of noveGrupeZaDostignuca) grupeZaStatistiku.add(grupa);
          if (statistika.najrjedaTier === null || tier <= statistika.najrjedaTier) {
            statistika.najrjedaTier = Math.min(statistika.najrjedaTier ?? tier, tier);
            statistika.najrjedaRijec = rijecNormalizirana;
            statistika.najrjedaRijecFrekvencija = frekvencija;
          }
        }
      }
      const rijecJeDuga = brojGrafema >= PRAGOVI_DULJINE.duga;
      for (const grupa of noveGrupeZaDostignuca) grupeZaDostignucaIgraca.add(grupa);
      stanje.grupeZaDostignuca.set(igracId, grupeZaDostignucaIgraca);
      const grupeZaZapis = stanje.noveGrupeSNagradom.get(igracId) ?? new Map<string, number | null>();
      for (const grupa of noveGrupeZaDostignuca) grupeZaZapis.set(grupa, rijetkaTier);
      stanje.noveGrupeSNagradom.set(igracId, grupeZaZapis);
      dodajNapredakDostignuca(stanje, igracId, {
        dugeRijeci: rijecJeDuga ? 1 : 0,
        rijetkeLeksemskeGrupe: rijetkaTier === null ? 0 : noveGrupeZaDostignuca.length,
        najduziStreak: trenutniStreak,
      });
      if (rijecJeDuga || rijetkaTier !== null) {
        const postojeca = statistika.otkljucaneRijeci.get(rijecNormalizirana);
        noviDugiOblik = rijecJeDuga && (postojeca?.dugaTier === undefined || postojeca.dugaTier === null);
        noviRijetkiOblik = rijetkaTier !== null && (postojeca?.rijetkaTier === undefined || postojeca.rijetkaTier === null);
        statistika.otkljucaneRijeci.set(rijecNormalizirana, {
          jakoDuga: Boolean(postojeca?.jakoDuga || brojGrafema >= PRAGOVI_DULJINE.jakoDuga),
          jakoRijetka: Boolean(postojeca?.jakoRijetka || rijetkaTier === 0),
          dugaTier: brojGrafema >= 15 ? 2 : brojGrafema >= 12 ? 1 : brojGrafema >= 10 ? 0 : postojeca?.dugaTier ?? null,
          rijetkaTier: rijetkaTier ?? postojeca?.rijetkaTier ?? null,
        });
      }
    }

    if (kolekcijaAktivna && typeof frekvencija === 'number') {
      nagrada = izracunajNagraduZaRijec(rijecNormalizirana, frekvencija, grupe, new Set(grupeIgraca.keys()));
      if (nagrada) {
        nagrada.otkljucano = [...grupeIgraca.values()].filter((vrijednost) => vrijednost !== null).length;
        nagrada.ukupno = nagrada.kategorija === 'rijetke'
          ? rjecnik.ciljeviRijeci?.().rijetke.ukupno ?? null
          : rjecnik.ciljeviRijeci?.().duge.ukupno ?? null;
      }
    }

    if (stanje.politika.dajeNapredak) {
      if (RIJECI_KALADONT.has(rijecNormalizirana)) {
        const stavka = { vrsta: 'kaladont' as const, naziv: 'Kaladont', kolicina: 1, poStavci: ISKUSTVO_KALADONT, iskustvo: ISKUSTVO_KALADONT };
        dodajStavkuIskustva(stanje, igracId, stavka);
        stavkePotezaIskustva.push(stavka);
      } else {
        const brojGrafema = grafemi(rijecNormalizirana).length;
        const potez = { vrsta: 'potezi' as const, naziv: 'Pogođena riječ', kolicina: 1, poStavci: ISKUSTVO_PRIHVACENA_RIJEC, iskustvo: ISKUSTVO_PRIHVACENA_RIJEC };
        dodajStavkuIskustva(stanje, igracId, potez);
        stavkePotezaIskustva.push(potez);
        const duljina = tierDuljineIskustva(rijecNormalizirana);
        const iskustvoDuljine = iskustvoZaDuljinu(duljina);
        if (duljina) {
          const stavka = { vrsta: 'duge_rijeci' as const, naziv: duljina === 'jako_duga' ? 'Jako duga riječ' : duljina === 'srednje_duga' ? 'Srednje duga riječ' : 'Duga riječ', kolicina: 1, poStavci: iskustvoDuljine, iskustvo: iskustvoDuljine };
          dodajStavkuIskustva(stanje, igracId, stavka);
          stavkePotezaIskustva.push(stavka);
        }
        const rijetkost = tierRijetkostiIskustva(frekvencija, brojGrafema);
        const iskustvoRijetkosti = iskustvoZaRijetkost(rijetkost);
        if (rijetkost) {
          const stavka = { vrsta: 'rijetke_rijeci' as const, naziv: rijetkost === 'jako_rijetka' ? 'Jako rijetka riječ' : rijetkost === 'srednje_rijetka' ? 'Srednje rijetka riječ' : 'Rijetka riječ', kolicina: 1, poStavci: iskustvoRijetkosti, iskustvo: iskustvoRijetkosti };
          dodajStavkuIskustva(stanje, igracId, stavka);
          stavkePotezaIskustva.push(stavka);
        }
      }
    }

    const brojGrafemaOblika = grafemi(rijecNormalizirana).length;
    const dugaKategorija = brojGrafemaOblika >= PRAGOVI_DULJINE.jakoDuga
      ? 'jako_duga'
      : brojGrafemaOblika >= PRAGOVI_DULJINE.srednjeDuga
        ? 'srednje_duga'
        : brojGrafemaOblika >= PRAGOVI_DULJINE.duga ? 'duga' : null;
    const rijetkaKategorija = frekvencija === undefined || frekvencija === null
      ? null
      : frekvencija === 0 && brojGrafemaOblika >= 4
        ? 'jako_rijetka'
        : frekvencija <= 9
          ? 'srednje_rijetka'
          : frekvencija <= 99 ? 'rijetka' : null;
    if (gamifikacijaAktivna && (noveOsnovneRijeci.length > 0 || dugaKategorija || rijetkaKategorija)) {
      izvorniSocket?.emit('rijec:otkljucana', {
        partijaId: stanje.partijaId,
        oblik: rijecNormalizirana,
        osnovneRijeci: noveOsnovneRijeci,
        novaOsnovnaRijec: noveOsnovneRijeci.length > 0,
        dugaKategorija,
        rijetkaKategorija,
        noviDugiOblik,
        noviRijetkiOblik,
        iskustvo: stavkePotezaIskustva,
      });
    }

    potrosiGrupe(stanje, rijecNormalizirana);
    stanje.redniBroj += 1;
    stanje.napadacId = igracId;
    stanje.zadnjaRijec = rijecNormalizirana;
    stanje.zadnjaRijecIgracId = igracId;
    stanje.zadnjaRijecVrsta = 'rijec';
    zabiljeziAnalitikaOdgovor(stanje, rijecNormalizirana);

    spremiPotezAkoTreba(stanje, {
      runda: stanje.runda,
      redniBroj: stanje.redniBroj,
      igracId,
      vrsta: 'rijec',
      rijec: rijecNormalizirana,
      trazenaSlova: trazenaSlovaZaOvajPotez,
      trajanjeMs,
    });

    // Kaladont/kalodont: eliminira se onaj tko je omogucio "ka" otvaranje, ne sljedeci igrac (pravila-igre.md)
    if (RIJECI_KALADONT.has(rijecNormalizirana)) {
      zatvoriAnalitikaProzorDrugim(stanje);
      dodajNapredakDostignuca(stanje, igracId, { kaladontIzvedbe: 1 });
      const sljedeci = sljedeciAktivni(stanje, igracId) ?? igracId;
      emitirajPrihvacenPotezSvima(stanje, {
        igracId,
        rijec: rijecNormalizirana,
        trazenaSlova: stanje.trazenaSlova!,
        sljedeciId: sljedeci,
        turnToken: stanje.turnToken,
        istekPotezaIso: '',
        serverVrijemeIso: new Date(sat.sada()).toISOString(),
        brojIskoristenih: stanje.brojOdigranih,
        streak: trenutniStreak,
        nagrada,
        iskustvo: stavkePotezaIskustva,
      }, izvorniSocket);
      obradiKaladontEfekt(stanje, igracId, prethodniNapadacId);
      return;
    }

    const novaTrazenaSlova = zadnjaDva(rijecNormalizirana);
    const razlogMrtvihSlova = odrediRazlogMrtvihSlova(
      novaTrazenaSlova,
      stanje.iskoristeneGrupe,
      rjecnik,
      stanje.dopusteneVrste,
    );

    if (razlogMrtvihSlova) {
      const zrtva = sljedeciAktivni(stanje, igracId);
      stanje.trazenaSlova = novaTrazenaSlova;
      // Ne stavljaj žrtvu na potez i ne šalji stanje s aktivnim redom — odmah slijedi
      // eliminacija i 8 s izbora riječi; inače se eliminatoru/sljedećem otvori forma.
      if (zrtva) {
        if (stanje.analitikaProzor && (stanje.analitikaProzor.brojOdgovora === 1 || stanje.analitikaProzor.brojOdgovora === 2)) {
          zatvoriAnalitikaProzorRanimIncidentom(stanje, razlogMrtvihSlova, igracId, zrtva);
        } else {
          zatvoriAnalitikaProzorDrugim(stanje);
        }
        emitirajPrihvacenPotezSvima(stanje, {
          igracId,
          rijec: rijecNormalizirana,
          trazenaSlova: novaTrazenaSlova,
          sljedeciId: zrtva,
          turnToken: stanje.turnToken,
          istekPotezaIso: '',
          serverVrijemeIso: new Date(sat.sada()).toISOString(),
          brojIskoristenih: stanje.brojOdigranih,
          streak: trenutniStreak,
          nagrada,
          iskustvo: stavkePotezaIskustva,
        }, izvorniSocket);
        eliminirajIgraca(stanje, zrtva, razlogMrtvihSlova);
      }
      return;
    }

    mozdaZatvoriAnalitikaProzorDvaOdgovora(stanje);

    const sljedeci = sljedeciAktivni(stanje, igracId);
    if (!sljedeci) return; // ne bi se smjelo dogoditi dok je aktivnih > 1
    stanje.naPotezuId = sljedeci;
    noviTurnToken(stanje);
    stanje.trazenaSlova = novaTrazenaSlova;
    postaviTimer(stanje);

    const poruka: PrihvacenPotez = {
      igracId,
      rijec: rijecNormalizirana,
      trazenaSlova: novaTrazenaSlova,
      sljedeciId: sljedeci,
      turnToken: stanje.turnToken,
      istekPotezaIso: istekPotezaIso(stanje),
      serverVrijemeIso: new Date(sat.sada()).toISOString(),
      brojIskoristenih: stanje.brojOdigranih,
      streak: trenutniStreak,
      nagrada,
      iskustvo: stavkePotezaIskustva,
    };
    emitirajPrihvacenPotezSvima(stanje, poruka, izvorniSocket);
    if (!stanje.prekidiUTijeku.has(sljedeci)) posaljiStanjeSvima(stanje);
    objaviPromjenuPoteza(stanje);
  }

  /**
   * Igrac je izgovorio "kaladont"/"kalodont": eliminira se prethodniId (tko je omogucio "ka"),
   * bod ide sayerId. Ako je preostao samo sayer, partija zavrsava. Inace sustav bira novu rijec
   * i red ide na sljedeceg aktivnog nakon sayera. Ako je "ka" omogucila rijec sustava (nitko nije
   * kriv), preskace se eliminacija i samo se otvara nova runda.
   */
  function obradiKaladontEfekt(stanje: StanjeStola, sayerId: string, prethodniId: string | null): void {
    if (!prethodniId) {
      zapocniIzborRijeciSustava(stanje, sayerId);
      return;
    }

    ponistiCekanjePovratka(stanje, prethodniId);
    stanje.aktivni.delete(prethodniId);
    stanje.eliminirani.push(prethodniId);
    stanje.razloziEliminacije.set(prethodniId, 'kaladont');
    dodajNapredakDostignuca(stanje, prethodniId, { kaladontZrtve: 1 });
    stanje.eliminacijeBrojac.set(sayerId, (stanje.eliminacijeBrojac.get(sayerId) ?? 0) + 1);
    const stavkaEliminacije = !stanje.politika.dajeNapredak
      ? null
      : { vrsta: 'eliminacije' as const, naziv: 'Eliminacija', kolicina: 1, poStavci: ISKUSTVO_ELIMINACIJA, iskustvo: ISKUSTVO_ELIMINACIJA };
    if (stavkaEliminacije) dodajStavkuIskustva(stanje, sayerId, stavkaEliminacije);

    stanje.redniBroj += 1;
    spremiPotezAkoTreba(stanje, {
      runda: stanje.runda,
      redniBroj: stanje.redniBroj,
      igracId: prethodniId,
      vrsta: 'kaladont',
      rijec: null,
      trazenaSlova: stanje.trazenaSlova,
      trajanjeMs: 0,
    });

    const plasman = stanje.aktivni.size + 1;
    const porukaElim: Eliminacija = {
      igracId: prethodniId,
      plasman,
      razlog: 'kaladont',
      bodZa: sayerId,
      slova: null,
      rijecUzrok: stanje.zadnjaRijec,
      iskustvo: stavkaEliminacije,
    };
    stanje.eliminacije.push(porukaElim);
    io.to(SOBA_PARTIJE(stanje.partijaId)).emit('partija:eliminacija', porukaElim);

    if (stanje.politika.dajeNapredak) {
      const obracun = izracunajObracunIskustva(
        stanje.iskustvoPrije.get(prethodniId) ?? 0,
        stanje.stavkeIskustva.get(prethodniId) ?? [],
        stanje.statistikeRijeci.get(prethodniId)?.najduziStreak ?? 0,
      );
      aktivneVeze.dohvatiSocket(prethodniId)?.emit('iskustvo:obracun', { partijaId: stanje.partijaId, mojeIskustvo: obracun });
    }

    if (stanje.aktivni.size <= 1) {
      zakljuciPartiju(stanje);
      return;
    }

    if (stanje.timerHandle) {
      sat.otkazi(stanje.timerHandle);
      stanje.timerHandle = null;
    }
    zapocniIzborRijeciSustava(stanje, sayerId);
  }

  function jePrebrzo(stanje: StanjeStola, igracId: string): boolean {
    const sada = sat.sada();
    const povijest = (stanje.zadnjiPotezi.get(igracId) ?? []).filter((t) => sada - t < 1000);
    if (povijest.length >= 3) {
      stanje.zadnjiPotezi.set(igracId, povijest);
      return true;
    }
    povijest.push(sada);
    stanje.zadnjiPotezi.set(igracId, povijest);
    return false;
  }

  /** Autoritativna naredba poteza; identitet dolazi iz provjerenog izvora (socket sesija ili bot kontroler). */
  function odigrajRijec(
    stanje: StanjeStola,
    igracId: string,
    rijec: string,
    turnToken: string | undefined,
    izvorniSocket?: KaladontSocket,
  ): RezultatNaredbe {
    if (stanje.zavrsena) return { ishod: 'ignoriran', razlog: 'zavrsena' };
    if (!stanje.aktivni.has(igracId)) return { ishod: 'ignoriran', razlog: 'nije_sudionik' };
    if (turnToken && turnToken !== stanje.turnToken) {
      return { ishod: 'odbijen', kod: 'STARI_TURN_TOKEN', poruka: 'Potez je zastario. Osvježi stanje i pokušaj ponovno.' };
    }
    if (stanje.naPotezuId !== igracId) return { ishod: 'odbijen', kod: 'NIJE_TVOJ_POTEZ', poruka: PORUKE.nijeTvojPotez };
    if (stanje.izborUToku) return { ishod: 'odbijen', kod: 'SUSTAV_BIRA_RIJEC', poruka: PORUKE.sustavBiraRijec };

    const rijecNormalizirana = rijec.normalize('NFC').trim().toLowerCase();
    const rezultat = validirajPotez({
      rijec,
      trazenaSlova: stanje.trazenaSlova!,
      iskoristeneGrupe: stanje.iskoristeneGrupe,
      potrosioGrupu: stanje.potrosioGrupu,
      dopusteneVrste: stanje.dopusteneVrste,
      rjecnik,
    });
    if (!rezultat.valjano) {
      stanje.streakovi.set(igracId, 0);
      // Čista petica: pravi pogrešan unos koji lomi niz.
      // Broje se: RIJEC_NE_POSTOJI, VLASTITO_IME, KRIVA_SLOVA, RIJEC_ISKORISTENA,
      // NEDOPUSTENA_VRSTA, NIJE_OSNOVNI_OBLIK, PREKRATKA_RIJEC.
      // Ne broje se (vraćaju se prije ove provjere): STARI_TURN_TOKEN, NIJE_TVOJ_POTEZ,
      // SUSTAV_BIRA_RIJEC, PREBRZO, NEVALJAN_PAYLOAD i tehničke greške.
      const statistika = stanje.statistikeRijeci.get(igracId);
      if (statistika) statistika.pogresniUnosi += 1;
      return { ishod: 'odbijen', kod: rezultat.kod!, poruka: rezultat.poruka! };
    }
    obradiPrihvacenPotez(stanje, igracId, rijecNormalizirana, izvorniSocket);
    return { ishod: 'prihvacen' };
  }

  function odustani(stanje: StanjeStola, igracId: string, turnToken: string | undefined): RezultatNaredbe {
    if (stanje.zavrsena) return { ishod: 'ignoriran', razlog: 'zavrsena' };
    if (!stanje.aktivni.has(igracId)) return { ishod: 'ignoriran', razlog: 'nije_sudionik' };
    if (turnToken && turnToken !== stanje.turnToken) {
      return { ishod: 'odbijen', kod: 'STARI_TURN_TOKEN', poruka: 'Potez je zastario. Osvježi stanje i pokušaj ponovno.' };
    }
    if (stanje.izborUToku) return { ishod: 'ignoriran', razlog: 'sustav_bira' };
    if (stanje.naPotezuId !== igracId) return { ishod: 'ignoriran', razlog: 'nije_na_potezu' };
    eliminirajIgraca(stanje, igracId, 'ne_znam');
    return { ishod: 'prihvacen' };
  }

  /** Interni ulaz za bot kontroler: dopušten samo za sudionike kojima upravlja bot. */
  function naredbaBota(
    partijaId: string,
    igracId: string,
    naredba: { vrsta: 'rijec'; rijec: string; turnToken: string } | { vrsta: 'odustani'; turnToken: string },
  ): RezultatNaredbe {
    const stanje = partije.get(partijaId);
    if (!stanje) return { ishod: 'ignoriran', razlog: 'nema_partije' };
    const sudionik = stanje.sudionici.find((s) => s.igracId === igracId);
    if (!sudionik || sudionik.upravljac !== 'bot') return { ishod: 'ignoriran', razlog: 'nije_sudionik' };
    return naredba.vrsta === 'rijec'
      ? odigrajRijec(stanje, igracId, naredba.rijec, naredba.turnToken)
      : odustani(stanje, igracId, naredba.turnToken);
  }

  function ponistiCekanjePovratka(stanje: StanjeStola, igracId: string): void {
    const prekid = stanje.prekidiUTijeku.get(igracId);
    if (!prekid) return;
    sat.otkazi(prekid.timerHandle);
    stanje.prekidiUTijeku.delete(igracId);
  }

  function posaljiStanjeSvima(stanje: StanjeStola): void {
    for (const sudionik of stanje.sudionici) {
      const socket = aktivneVeze.dohvatiSocket(sudionik.igracId);
      if (socket) posaljiStanje(socket);
    }
  }

  function emitirajPrihvacenPotezSvima(
    stanje: StanjeStola,
    poruka: PrihvacenPotez,
    izvorniSocket?: KaladontSocket,
  ): void {
    // Nakon reconnecta socket može kratko biti izvan rooma; autor ipak mora dobiti potvrdu.
    // Igrači koji su dobrovoljno izašli (nema ih u partijaPoIgracu) ne primaju više poteze —
    // inače im klijent i dalje svira promjena-reda / tvoj-red nakon goto('/').
    const poslaniSocketi = new Set<string>();
    if (izvorniSocket) {
      izvorniSocket.emit('potez:prihvacen', poruka);
      poslaniSocketi.add(izvorniSocket.id);
    }
    for (const sudionik of stanje.sudionici) {
      if (partijaPoIgracu.get(sudionik.igracId) !== stanje.partijaId) continue;
      const socket = aktivneVeze.dohvatiSocket(sudionik.igracId);
      if (socket && !poslaniSocketi.has(socket.id)) {
        socket.emit('potez:prihvacen', poruka);
        poslaniSocketi.add(socket.id);
      }
    }
  }

  function obradiIsteklePrekide(stanje: StanjeStola): void {
    stanje.obradaPrekidaZakazana = false;
    if (stanje.zavrsena) return;

    const sada = sat.sada();
    const istekliPoRoku = [...stanje.prekidiUTijeku.entries()]
      .filter(([, prekid]) => prekid.istekMs <= sada)
      .sort(([, prvi], [, drugi]) => prvi.istekMs - drugi.istekMs);
    const istekli: typeof istekliPoRoku = [];

    for (let indeks = 0; indeks < istekliPoRoku.length; ) {
      const pocetakVala = istekliPoRoku[indeks]![1].istekMs;
      const val: typeof istekliPoRoku = [];
      while (
        indeks < istekliPoRoku.length &&
        istekliPoRoku[indeks]![1].istekMs - pocetakVala <= PROZOR_ISTODOBNIH_PREKIDA_MS
      ) {
        val.push(istekliPoRoku[indeks]!);
        indeks += 1;
      }
      val.sort(([prviId, prvi], [drugiId, drugi]) => {
        if (prvi.bioNaPotezu !== drugi.bioNaPotezu) return prvi.bioNaPotezu ? -1 : 1;
        const prviIndeks = stanje.sudionici.findIndex((sudionik) => sudionik.igracId === prviId);
        const drugiIndeks = stanje.sudionici.findIndex((sudionik) => sudionik.igracId === drugiId);
        return prviIndeks - drugiIndeks;
      });
      istekli.push(...val);
    }

    for (const [igracId, prekid] of istekli) {
      if (stanje.prekidiUTijeku.get(igracId) !== prekid) continue;
      stanje.prekidiUTijeku.delete(igracId);
      sat.otkazi(prekid.timerHandle);
      eliminirajIgraca(stanje, igracId, 'prekid', prekid);
    }
  }

  function zakaziObraduIsteklihPrekida(stanje: StanjeStola): void {
    if (stanje.obradaPrekidaZakazana || stanje.zavrsena) return;
    stanje.obradaPrekidaZakazana = true;
    const handle = odgodaObradePrekidaMs > 0
      ? sat.zakazi(() => obradiIsteklePrekide(stanje), odgodaObradePrekidaMs)
      : setImmediate(() => obradiIsteklePrekide(stanje));
    handle.unref();
  }

  function pokreniCekanjePovratka(socket: KaladontSocket): void {
    const igracId = socket.data.igracId;
    if (!aktivneVeze.jeAktivnaVeza(igracId, socket.id)) return;

    const partijaId = partijaPoIgracu.get(igracId);
    const stanje = partijaId ? partije.get(partijaId) : undefined;
    if (!stanje || stanje.zavrsena || !stanje.aktivni.has(igracId)) return;

    ponistiCekanjePovratka(stanje, igracId);
    const istekMs = sat.sada() + tolerancijaPrekidaMs;
    const timerHandle = sat.zakazi(() => zakaziObraduIsteklihPrekida(stanje), tolerancijaPrekidaMs);
    timerHandle.unref();
    stanje.prekidiUTijeku.set(igracId, {
      timerHandle,
      istekMs,
      bioNaPotezu: !stanje.izborUToku && stanje.naPotezuId === igracId,
      napadacId: stanje.napadacId,
    });
  }

  function obnoviVezuPartije(socket: KaladontSocket): void {
    const igracId = socket.data.igracId;
    const partijaId = partijaPoIgracu.get(igracId);
    const stanje = partijaId ? partije.get(partijaId) : undefined;
    if (!stanje) return;

    obradiIsteklePrekide(stanje);
    ponistiCekanjePovratka(stanje, igracId);
    socket.join(SOBA_PARTIJE(stanje.partijaId));
    posaljiStanje(socket);
    if (stanje.statusSpremanja === 'spremanje_rezultata') {
      socket.emit('partija:spremanje-rezultata', {
        partijaId: stanje.partijaId,
        poruka: 'Partija je završila. Konačni rezultat se još sprema, pokušavamo ponovno.',
      });
      // Reconnect: retrySpremanjaHandle postoji samo dok čekamo backoff (ne dok traje upis).
      if (stanje.ponoviZavrsnoSpremanje && stanje.retrySpremanjaHandle) {
        sat.otkazi(stanje.retrySpremanjaHandle);
        stanje.retrySpremanjaHandle = null;
        stanje.ponoviZavrsnoSpremanje();
      }
    }
    const rezultatKraja = stanje.rezultatiKraja.get(igracId);
    if (rezultatKraja) socket.emit('partija:kraj', rezultatKraja);
  }

  function registrirajHandlere(socket: KaladontSocket): void {
    socket.on('trening:nastavi', omotajSocketHandler(socket, 'trening:nastavi', zapisSocketHandlerGreske, (payload: unknown, ...dodatniArgumenti: unknown[]) => {
      if (!ShemaTreningNastavi.safeParse(payload).success || dodatniArgumenti.length > 0) {
        socket.emit('greska', { kod: 'NEVALJAN_PAYLOAD', poruka: 'Poslana poruka nije ispravna.' });
        return;
      }
      if (!provjeriDogadaj(socket.data.igracId, 'trening:nastavi')) return;
      const partijaId = partijaPoIgracu.get(socket.data.igracId);
      const stanje = partijaId ? partije.get(partijaId) : undefined;
      const sudionik = stanje?.sudionici.find((stavka) => stavka.igracId === socket.data.igracId);
      if (!stanje || stanje.kontekst !== 'trening' || stanje.zavrsena || !sudionik || sudionik.upravljac !== 'covjek' || !stanje.aktivni.has(socket.data.igracId)) return;
      zakaziNeaktivnostTreninga(stanje);
    }));

    socket.on('partija:stanje', omotajSocketHandler(socket, 'partija:stanje', zapisSocketHandlerGreske, (...argumenti: unknown[]) => {
      if (argumenti.length > 0) {
        socket.emit('greska', { kod: 'NEVALJAN_PAYLOAD', poruka: 'Poslana poruka nije ispravna.' });
        return;
      }
      if (provjeriDogadaj(socket.data.igracId, 'partija:stanje')) posaljiStanje(socket);
    }));

    socket.on('potez:rijec', omotajSocketHandler(socket, 'potez:rijec', zapisSocketHandlerGreske, (payload: unknown, ...dodatniArgumenti: unknown[]) => {
      const rezultatSheme = ShemaPotezRijec.safeParse(payload);
      if (!rezultatSheme.success || dodatniArgumenti.length > 0) {
        socket.emit('greska', { kod: 'NEVALJAN_PAYLOAD', poruka: 'Poslana poruka nije ispravna.' });
        return;
      }
      if (!provjeriDogadaj(socket.data.igracId, 'potez:rijec')) return;
      const { rijec, turnToken } = rezultatSheme.data;

      const partijaId = partijaPoIgracu.get(socket.data.igracId);
      const stanje = partijaId ? partije.get(partijaId) : undefined;
      if (!stanje || stanje.zavrsena) return;

      if (turnToken && turnToken !== stanje.turnToken) {
        socket.emit('potez:odbijen', { kod: 'STARI_TURN_TOKEN', poruka: 'Potez je zastario. Osvježi stanje i pokušaj ponovno.' });
        return;
      }
      if (jePrebrzo(stanje, socket.data.igracId)) {
        socket.emit('greska', { kod: 'PREBRZO', poruka: PORUKE.prebrzo });
        return;
      }
      const rezultat = odigrajRijec(stanje, socket.data.igracId, rijec, turnToken, socket);
      if (rezultat.ishod === 'odbijen') socket.emit('potez:odbijen', { kod: rezultat.kod, poruka: rezultat.poruka });
    }));

    socket.on('potez:ne-znam', omotajSocketHandler(socket, 'potez:ne-znam', zapisSocketHandlerGreske, (payload: unknown, ...dodatniArgumenti: unknown[]) => {
      const rezultatSheme = ShemaNeznam.safeParse(payload);
      if (!rezultatSheme.success || dodatniArgumenti.length > 0) {
        socket.emit('greska', { kod: 'NEVALJAN_PAYLOAD', poruka: 'Poslana poruka nije ispravna.' });
        return;
      }
      if (!provjeriDogadaj(socket.data.igracId, 'potez:ne-znam')) return;
      const partijaId = partijaPoIgracu.get(socket.data.igracId);
      const stanje = partijaId ? partije.get(partijaId) : undefined;
      if (!stanje || stanje.zavrsena) return;
      const turnToken = rezultatSheme.data?.turnToken;
      const rezultat = odustani(stanje, socket.data.igracId, turnToken);
      if (rezultat.ishod === 'odbijen') socket.emit('potez:odbijen', { kod: rezultat.kod, poruka: rezultat.poruka });
    }));

    socket.on('reakcija:posalji', omotajSocketHandler(socket, 'reakcija:posalji', zapisSocketHandlerGreske, (payload: unknown, ...dodatniArgumenti: unknown[]) => {
      const rezultatSheme = ShemaReakcija.safeParse(payload);
      if (!rezultatSheme.success || dodatniArgumenti.length > 0) {
        socket.emit('greska', { kod: 'NEVALJAN_PAYLOAD', poruka: 'Poslana poruka nije ispravna.' });
        return;
      }
      if (!provjeriDogadaj(socket.data.igracId, 'reakcija:posalji')) return;
      const { poruka } = rezultatSheme.data;

      const stanje = dohvatiPartijuZaSocket(socket);
      if (!stanje || stanje.zavrsena) return;
      const sada = sat.sada();
      const zadnja = stanje.zadnjeReakcije.get(socket.data.igracId) ?? 0;
      if (sada - zadnja < 2000) return; // RS-22: tiho ignoriraj
      stanje.zadnjeReakcije.set(socket.data.igracId, sada);
      io.to(SOBA_PARTIJE(stanje.partijaId)).emit('reakcija:nova', { igracId: socket.data.igracId, poruka });
    }));

    socket.on('partija:izadji', omotajSocketHandler(socket, 'partija:izadji', zapisSocketHandlerGreske, (...argumenti: unknown[]) => {
      if (argumenti.length > 0) {
        socket.emit('greska', { kod: 'NEVALJAN_PAYLOAD', poruka: 'Poslana poruka nije ispravna.' });
        return;
      }
      if (!provjeriDogadaj(socket.data.igracId, 'partija:izadji')) return;
      const partijaId = partijaPoIgracu.get(socket.data.igracId);
      const stanje = partijaId ? partije.get(partijaId) : undefined;
      if (!stanje) return;

      if (prekiniPrazanPocetak(stanje, socket.data.igracId)) return;
      if (!stanje.zavrsena && stanje.aktivni.has(socket.data.igracId)) {
        eliminirajIgraca(stanje, socket.data.igracId, 'prekid');
      }

      socket.leave(SOBA_PARTIJE(stanje.partijaId));
      if (partijaPoIgracu.get(socket.data.igracId) === stanje.partijaId) {
        partijaPoIgracu.delete(socket.data.igracId);
      }
    }));

    socket.on('disconnect', omotajSocketHandler(socket, 'disconnect', zapisSocketHandlerGreske, () => {
      const stav = dohvatiPartijuZaSocket(socket);
      if (stav && prekiniPrazanPocetak(stav, socket.data.igracId)) return;
      pokreniCekanjePovratka(socket);
    }));

    obnoviVezuPartije(socket);
  }

  function zapocniPrivatnuPartiju(
    sudioniciUlaz: StavkaReda[],
    postavkeSobe: PostavkePrivatneSobe,
    kodSobe: string,
  ): string {
    if (zaustavljanje || partije.size >= maksimalnoAktivnihPartija) return '';
    const izmjesano = promijesajNiz(sudioniciUlaz);
    const sudionici: SudionikPartije[] = izmjesano.map((s, sjedalo) => {
      const prosjekBodova = s.odigrane > 0 ? s.bodoviUkupno / s.odigrane : 0;
      const rang = izracunajRang(s.odigrane, prosjekBodova);
      return {
        igracId: s.igracId,
        vrsta: s.vrsta,
        upravljac: s.upravljac ?? 'covjek',
        nadimak: s.nadimak,
        avatarId: s.avatarId,
        avatarConfig: s.avatarConfig,
        avatarRevision: s.avatarRevision,
        rang: rang === 'Piskaralo' ? null : rang,
        sjedalo,
        razina: stanjeIskustva(s.iskustvoUkupno ?? 0).razina,
        trenutniNiz: 0,
        razinaVatre: 0,
      };
    });
    const partijaId = randomUUID();
    const prviIgracId = sudionici[0]!.igracId;
      const odgodaMs = ODGODA_POCETKA_PRIVATNE_PARTIJE_MS;
    const pocetakIso = new Date(sat.sada() + odgodaMs).toISOString();

    const stanje: StanjeStola = {
      partijaId,
      pocetakPartijeMs: sat.sada(),
      mod: 'cetiri_igraca',
      kontekst: 'privatna',
      politika: politikaZaKontekst('privatna'),
      sudionici,
      aktivni: new Set(sudionici.map((s) => s.igracId)),
      eliminirani: [],
      turnToken: randomUUID(),
      naPotezuId: prviIgracId,
      napadacId: null,
      trazenaSlova: null,
      zadnjaRijec: null,
      zadnjaRijecIgracId: null,
      zadnjaRijecVrsta: null,
      zadnjiIzvorPocetne: null,
      analitikaOtvaranjaRedni: 0,
      analitikaProzor: null,
      iskoristeneGrupe: new Set(),
      potrosioGrupu: new Map(),
      brojOdigranih: 0,
      runda: 0,
      redniBroj: 0,
      vrijemePocetkaPotezaMs: sat.sada(),
      timerHandle: null,
      izborUToku: true,
      izborHandle: null,
      istekIzboraIso: pocetakIso,
      eliminacije: [],
      eliminacijeBrojac: new Map(),
      zadnjiPotezi: new Map(),
      zadnjeReakcije: new Map(),
      grupeSNagradom: new Map(sudionici.map((s) => [s.igracId, new Map<string, number | null>()])),
      grupeZaDostignuca: new Map(sudionici.map((s) => [s.igracId, new Set<string>()])),
      pocetneKolekcijskeGrupe: new Map(sudionici.map((s) => [s.igracId, new Set<string>()])),
      noveGrupeSNagradom: new Map(sudionici.map((s) => [s.igracId, new Map<string, number | null>()])),
      noveGrupeKolekcije: new Map(sudionici.map((s) => [s.igracId, new Map<string, MetapodatakOtkljucanjaKolekcije>()])),
      streakovi: new Map(sudionici.map((s) => [s.igracId, 0])),
      statistikeRijeci: new Map(sudionici.map((s) => [s.igracId, novaStatistikaRijeci()])),
      iskustvoPrije: new Map(sudionici.map((s) => [s.igracId, 0])),
      stavkeIskustva: new Map(sudionici.map((s) => [s.igracId, []])),
      napredakDostignuca: new Map(sudionici.map((s) => [s.igracId, {}])),
      napredakDostignucaPrije: new Map(sudionici.map((s) => [s.igracId, { razina: s.razina }])),
      najavljenaDostignuca: new Map(sudionici.map((s) => [s.igracId, new Set<string>()])),
      statusSpremanja: 'nije_zavrsena',
      brojPokusajaSpremanja: 0,
      retrySpremanjaHandle: null,
      zavrsnoSpremanje: null,
      ponoviZavrsnoSpremanje: null,
      upisiPotezaUTijeku: [],
      zapisiPotezaZaOsigurati: [],
      osigurajPocetakPartije: null,
      treningNeaktivnost: null,
      treningRokovi: null,
      treningGeneration: 0,
      treningUpozorenjeHandle: null,
      treningZatvaranjeHandle: null,
      razloziEliminacije: new Map(),
      prekidiUTijeku: new Map(),
      obradaPrekidaZakazana: false,
      rezultatiKraja: new Map(),
      zavrsena: false,
      jePrivatna: true,
      kodSobe,
      trajanjePotezaSek: postavkeSobe.trajanjePotezaSek,
      dopusteneVrste: new Set(postavkeSobe.dopusteneVrste),
      postavkePrivatneSobe: postavkeSobe,
    };

    partije.set(partijaId, stanje);
    for (const s of sudionici) partijaPoIgracu.set(s.igracId, partijaId);
    let pocetakPrivatneUspio = false;
    const osigurajPocetakPrivatne = async () => {
      if (pocetakPrivatneUspio) return;
      await zapisiPocetakPartije(
        partijaId,
        sudionici,
        new Map(sudionici.map((s) => [s.igracId, 0])),
        'cetiri_igraca',
      );
      pocetakPrivatneUspio = true;
    };
    stanje.osigurajPocetakPartije = osigurajPocetakPrivatne;
    const upisPocetkaPrivatnePartije = osigurajPocetakPrivatne();
    stanje.upisiPotezaUTijeku.push(upisPocetkaPrivatnePartije.catch(() => undefined));

    const poruka: Omit<PocetakPartije, 'mojIgracId'> = {
      partijaId,
      pocetakIso,
      sjedala: sudionici.map((s) => ({ igracId: s.igracId, nadimak: s.nadimak, jeGost: s.vrsta === 'gost', avatarId: s.avatarId, avatarConfig: s.avatarConfig, avatarRevision: s.avatarRevision, rang: s.rang, razina: s.razina, trenutniNiz: s.trenutniNiz, razinaVatre: s.razinaVatre })),
      kontekst: 'privatna',
      jePrivatna: true,
      kodSobe,
    };

    for (const s of sudionici) {
      const socket = aktivneVeze.dohvatiSocket(s.igracId);
      socket?.join(SOBA_PARTIJE(partijaId));
    }
    for (const s of sudionici) {
      aktivneVeze.dohvatiSocket(s.igracId)?.emit('partija:pocetak', { ...poruka, mojIgracId: s.igracId });
    }
    zabiljeziAnalitikuPocetka(stanje);

    void Promise.all([upisPocetkaPrivatnePartije, ucitajOtkljucaneGrupe(sudionici), ucitajGrupeZaDostignuca(sudionici)]).then(([, grupe, grupeDostignuca]) => {
      stanje.grupeSNagradom = grupe;
      stanje.grupeZaDostignuca = grupeDostignuca;
      stanje.pocetneKolekcijskeGrupe = new Map([...grupe].map(([igracId, mape]) => [igracId, new Set([...mape.keys()].map(kolekcijskiKljucGrupe))]));
      const preostaloMs = Math.max(0, new Date(pocetakIso).getTime() - sat.sada());
      stanje.izborHandle = sat.zakazi(() => objaviRijecSustava(stanje, null), preostaloMs);
    }).catch((greska) => console.error('Neuspio pripremiti privatnu partiju:', greska));

    return partijaId;
  }

  return {
    zapocniPartiju,
    zapocniPrivatnuPartiju,
    registrirajHandlere,
    zaustavi,
    naredbaBota,
    mozePokrenutiPartiju: () => !zaustavljanje,
    nadimak,
    imaAktivnuPartiju: (igracId: string) => {
      const partijaId = partijaPoIgracu.get(igracId);
      const stanje = partijaId ? partije.get(partijaId) : undefined;
      return Boolean(stanje && !stanje.zavrsena);
    },
    /** Istina dok partija traje ili se njezin rezultat još sprema; fond botova tek tada oslobađa identitet. */
    imaNezavrsenuObradu: (igracId: string) => {
      const partijaId = partijaPoIgracu.get(igracId);
      const stanje = partijaId ? partije.get(partijaId) : undefined;
      return Boolean(stanje && (!stanje.zavrsena || stanje.statusSpremanja !== 'rezultati_spremljeni'));
    },
    brojAktivnihPartija: () => partije.size,
    brojAktivnihTreninga,
    brojIstekaBota: () => brojIstekaBota,
    brojNamjernihIstekaBota: () => brojNamjernihIstekaBota,
    botoviPartije: (partijaId: string) => partije.get(partijaId)?.sudionici.filter((sudionik) => sudionik.upravljac === 'bot').map((sudionik) => sudionik.igracId) ?? [],
    pregledBotova: () => [...partije.values()].filter((stanje) => !stanje.zavrsena || stanje.statusSpremanja !== 'rezultati_spremljeni').flatMap((stanje) => stanje.sudionici.filter((sudionik) => sudionik.upravljac === 'bot').map((sudionik) => ({
      igracId: sudionik.igracId,
      partijaId: stanje.partijaId,
      mod: stanje.mod,
      kontekst: stanje.kontekst,
      pocetakPartijeMs: stanje.pocetakPartijeMs,
      aktivan: stanje.aktivni.has(sudionik.igracId),
      naPotezu: !stanje.zavrsena && !stanje.izborUToku && stanje.naPotezuId === sudionik.igracId,
      status: stanje.zavrsena ? stanje.statusSpremanja : stanje.runda === 0 ? 'pokretanje' : stanje.izborUToku ? 'izbor_rijeci' : 'u_partiji',
    }))),
    oznaciNamjerniIstek,
    dohvatiPotez: (partijaId: string) => {
      const stanje = partije.get(partijaId);
      return stanje ? snimkaPoteza(stanje) : null;
    },
    prekiniZbogGreskeBota,
    /** Interni ulaz za bot kontroler; poštuje RS-22 cooldown, dopušta i kratko nakon kraja dok soba živi. */
    posaljiReakcijuSudionika(partijaId: string, igracId: string, poruka: BrzaPoruka): boolean {
      const stanje = partije.get(partijaId);
      if (!stanje || !stanje.sudionici.some((s) => s.igracId === igracId)) return false;
      const sada = sat.sada();
      const zadnja = stanje.zadnjeReakcije.get(igracId) ?? 0;
      if (sada - zadnja < 2000) return false;
      stanje.zadnjeReakcije.set(igracId, sada);
      io.to(SOBA_PARTIJE(stanje.partijaId)).emit('reakcija:nova', { igracId, poruka });
      return true;
    },
  };
}
