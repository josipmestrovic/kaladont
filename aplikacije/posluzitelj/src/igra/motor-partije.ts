/**
 * Motor jedne partije - stanje stola u memoriji (pregled-arhitekture.md: engine partije).
 * Server je jedini autoritet; poslužitelj je sat (RS-14).
 */
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { inArray } from 'drizzle-orm';
import { konfiguracija } from '../konfiguracija.js';
import {
  validirajPotez,
  odrediRazlogMrtvihSlova,
  izracunajBodove,
  izracunajRang,
  stanjeIskustva,
  grafemi,
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
  ISKUSTVO_PRIHVACENA_RIJEC,
  ISKUSTVO_KALADONT,
  ISKUSTVO_ELIMINACIJA,
  ISKUSTVO_POBJEDA,
  MAKSIMALNO_ISKUSTVO,
  type StavkaIskustva,
  type RjecnikSucelje,
  type RazlogEliminacije,
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
} from 'zajednicko';
import type { KaladontIo, KaladontSocket } from '../server.js';
import { baza } from '../baza/klijent.js';
import { igraci, otkljucaneGrupeIgraca } from '../baza/shema.js';
import type { StavkaReda } from '../red/red-cekanja.js';
import { ponistiPartijeUTijekuUBazi, zapisiPocetakPartije, zapisiPotez, zakljuciPartijuUBazi, type ZapisStatistikeRijeci } from './upis-partije.js';
import type { ProvjeriOgranicenjeDogadaja } from '../sigurnost/socket-ogranicenja.js';

const ShemaPotezRijec = z.object({ rijec: z.string().min(1).max(50) });
const ShemaReakcija = z.object({ poruka: z.enum(['pozdrav', 'sorry', 'dobro-odigrano', 'najjaci']) });

const TRAJANJE_POTEZA_MS = 30_000;
const TRAJANJE_IZBORA_SUSTAVA_MS = 10_000;
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
  nadimak: string;
  rang: string | null;
  avatarId: number;
  avatarConfig: import('zajednicko').AvatarConfigV1 | null;
  avatarRevision: number;
  sjedalo: number;
  razina: number;
}

export interface AktivneVezeIgraca {
  dohvatiSocket(igracId: string): KaladontSocket | undefined;
  jeAktivnaVeza(igracId: string, socketId: string): boolean;
}

export interface PostavkeMotoraPartije {
  timerOnemogucen?: boolean;
  trajanjePotezaMs?: number;
  tolerancijaPrekidaMs?: number;
  odgodaObradePrekidaMs?: number;
  zadrzavanjeSobeNakonKrajaMs?: number;
  maksimalnoAktivnihPartija?: number;
  provjeriDogadaj?: ProvjeriOgranicenjeDogadaja;
  naPartijaZavrsila?: (partijaId: string) => void;
  naPrivatnaPartijaZavrsila?: (kodSobe: string, pobjednikId: string, rezultati: { igracId: string; bodovi: number }[]) => void;
}

interface PrekidUTijeku {
  timerHandle: NodeJS.Timeout;
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
  najduzaRijec: string | null;
  najduzaRijecGrafemi: number;
  najrjedaRijec: string | null;
  najrjedaRijecFrekvencija: number | null;
  najrjedaTier: number | null;
}

interface StanjeStola {
  partijaId: string;
  mod: 'cetiri_igraca' | 'dva_igraca';
  sudionici: SudionikPartije[]; // svi 4 ili 2, fiksni redoslijed po sjedalu
  aktivni: Set<string>;
  eliminirani: string[]; // redoslijed ispadanja - prvi ispali je na indeksu 0
  naPotezuId: string;
  napadacId: string | null; // autor zadnje prihvaćene riječi - dobiva bod ako netko ispadne; null dok sustav "drži" rijec
  trazenaSlova: string | null;
  zadnjaRijec: string | null; // zadnja izgovorena/dodijeljena riječ - za obrazloženje eliminacije mrtvim slovima
  zadnjaRijecIgracId: string | null;
  zadnjaRijecVrsta: 'rijec' | 'sustav_rijec' | null;
  iskoristeneGrupe: Set<string>; // potrošene leksemske grupe (RS-28/RS-29)
  potrosioGrupu: Map<string, string>; // grupa -> oblik koji ju je potrošio (za poruku odbijanja)
  brojOdigranih: number; // broj prihvaćenih riječi (uključivo sustavske) - za brojIskoristenih u payloadu
  runda: number;
  redniBroj: number;
  vrijemePocetkaPotezaMs: number;
  timerHandle: NodeJS.Timeout | null;
  izborUToku: boolean; // true dok sustav bira rijec za otvaranje runde (RS: nitko ne moze igrati)
  izborHandle: NodeJS.Timeout | null;
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
  noveGrupeSNagradom: Map<string, Map<string, number | null>>;
  streakovi: Map<string, number>;
  statistikeRijeci: Map<string, StatistikaRijeciPartije>;
  iskustvoPrije: Map<string, number>;
  stavkeIskustva: Map<string, StavkaIskustva[]>;
  napredakDostignuca: Map<string, DeltaNapretkaDostignuca>;
  statusSpremanja: 'nije_zavrsena' | 'spremanje_rezultata' | 'rezultati_spremljeni';
  brojPokusajaSpremanja: number;
  retrySpremanjaHandle: NodeJS.Timeout | null;
  zavrsnoSpremanje: (() => Promise<void>) | null;
}

export function stvoriUpraviteljPartija(
  io: KaladontIo,
  rjecnik: RjecnikSucelje,
  aktivneVeze: AktivneVezeIgraca,
  postavke: PostavkeMotoraPartije = {},
) {
  // SAMO za lokalno testiranje (docs/06-razvoj/postavljanje-okoline.md) - u produkciji mora biti iskljuceno/nepostavljeno
  const timerOnemogucen = postavke.timerOnemogucen ?? konfiguracija.ONEMOGUCI_TIMER_POTEZA === 'true';
  const trajanjePotezaMs = postavke.trajanjePotezaMs ?? TRAJANJE_POTEZA_MS;
  const tolerancijaPrekidaMs = postavke.tolerancijaPrekidaMs ?? konfiguracija.TOLERANCIJA_PREKIDA_MS;
  const odgodaObradePrekidaMs = postavke.odgodaObradePrekidaMs ?? 0;
  const zadrzavanjeSobeNakonKrajaMs = postavke.zadrzavanjeSobeNakonKrajaMs ?? ZADRZAVANJE_SOBE_NAKON_KRAJA_MS;
  const maksimalnoAktivnihPartija = postavke.maksimalnoAktivnihPartija ?? Number.POSITIVE_INFINITY;
  const provjeriDogadaj = postavke.provjeriDogadaj ?? (() => true);

  const partije = new Map<string, StanjeStola>();
  const partijaPoIgracu = new Map<string, string>(); // igracId -> partijaId
  let zaustavljanje = false;

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

  async function ucitajIskustvo(igraciPartije: readonly SudionikPartije[]): Promise<Map<string, number>> {
    const igracIds = igraciPartije.map((igrac) => igrac.igracId);
    const retci = igracIds.length === 0 ? [] : await baza
      .select({ id: igraci.id, iskustvoUkupno: igraci.iskustvoUkupno })
      .from(igraci)
      .where(inArray(igraci.id, igracIds));
    return new Map(retci.map((igrac) => [igrac.id, igrac.iskustvoUkupno]));
  }

  function dodajStavkuIskustva(stanje: StanjeStola, igracId: string, stavka: StavkaIskustva): void {
    if (stanje.jePrivatna) return;
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
    const sudionik = stanje.sudionici.find((s) => s.igracId === igracId);
    if (!sudionik || sudionik.vrsta === 'gost') return;
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
  }

  function nadimak(stanje: StanjeStola, igracId: string): string {
    return stanje.sudionici.find((s) => s.igracId === igracId)?.nadimak ?? '???';
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

  function postaviTimer(stanje: StanjeStola): void {
    if (stanje.timerHandle) clearTimeout(stanje.timerHandle);
    stanje.vrijemePocetkaPotezaMs = Date.now();
    const trajanjeMs =
      stanje.trajanjePotezaSek !== undefined
        ? stanje.trajanjePotezaSek * 1000
        : trajanjePotezaMs;

    if (timerOnemogucen || trajanjeMs <= 0) {
      stanje.timerHandle = null;
      return;
    }
    stanje.timerHandle = setTimeout(() => {
      eliminirajIgraca(stanje, stanje.naPotezuId, 'istek');
    }, trajanjeMs);
  }

  function istekPotezaIso(stanje: StanjeStola): string {
    const trajanjeMs =
      stanje.trajanjePotezaSek !== undefined
        ? stanje.trajanjePotezaSek * 1000
        : trajanjePotezaMs;
    if (trajanjeMs <= 0) return '';
    return new Date(stanje.vrijemePocetkaPotezaMs + trajanjeMs).toISOString();
  }

  function posaljiStanje(socket: KaladontSocket): void {
    const partijaId = partijaPoIgracu.get(socket.data.igracId);
    const stanje = partijaId ? partije.get(partijaId) : undefined;
    if (!stanje) return;

    const poruka: StanjePartije = {
      partijaId: stanje.partijaId,
      mojIgracId: socket.data.igracId,
      sjedala: stanje.sudionici.map(({ igracId, nadimak, avatarId, avatarConfig, avatarRevision, rang, razina }) => ({ igracId, nadimak, avatarId, avatarConfig, avatarRevision, rang, razina })),
      naPotezuId: stanje.naPotezuId,
      trazenaSlova: stanje.trazenaSlova,
      istekPotezaIso: istekPotezaIso(stanje),
      serverVrijemeIso: new Date().toISOString(),
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
      jePrivatna: stanje.jePrivatna,
      kodSobe: stanje.kodSobe,
      trajanjePotezaSek: stanje.trajanjePotezaSek,
      dopusteneVrste: stanje.dopusteneVrste ? [...stanje.dopusteneVrste] : undefined,
      statusSpremanja: stanje.statusSpremanja,
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
    const aktivnePartije = [...partije.values()].filter((stanje) =>
      !stanje.zavrsena || stanje.statusSpremanja === 'spremanje_rezultata');
    const partijaIdovi = aktivnePartije.map((stanje) => stanje.partijaId);
    for (const stanje of aktivnePartije) {
      stanje.zavrsena = true;
      if (stanje.timerHandle) clearTimeout(stanje.timerHandle);
      if (stanje.izborHandle) clearTimeout(stanje.izborHandle);
      if (stanje.retrySpremanjaHandle) clearTimeout(stanje.retrySpremanjaHandle);
      for (const prekid of stanje.prekidiUTijeku.values()) clearTimeout(prekid.timerHandle);
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
    setTimeout(() => {
      if (stanje.retrySpremanjaHandle) clearTimeout(stanje.retrySpremanjaHandle);
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
    stanje.statusSpremanja = 'spremanje_rezultata';
    stanje.zavrsnoSpremanje = upis;
    stanje.brojPokusajaSpremanja = 0;
    emitirajSpremanjeRezultata(stanje);

    const pokusaj = () => {
      if (stanje.statusSpremanja === 'rezultati_spremljeni') return;
      stanje.brojPokusajaSpremanja += 1;
      void upis().then(() => {
        if (stanje.statusSpremanja === 'rezultati_spremljeni') return;
        stanje.statusSpremanja = 'rezultati_spremljeni';
        stanje.zavrsnoSpremanje = null;
        stanje.retrySpremanjaHandle = null;
        nakonUspjeha();
      }).catch((greska) => {
        console.error(`Neuspio završni upis partije ${stanje.partijaId} (pokušaj ${stanje.brojPokusajaSpremanja}):`, greska);
        emitirajSpremanjeRezultata(stanje);
        const odmak = Math.min(
          POCETNI_ODMAK_RETRYJA_REZULTATA_MS * 2 ** (stanje.brojPokusajaSpremanja - 1),
          MAKSIMALNI_ODMAK_RETRYJA_REZULTATA_MS,
        );
        stanje.retrySpremanjaHandle = setTimeout(pokusaj, odmak);
        stanje.retrySpremanjaHandle.unref();
      });
    };

    pokusaj();
  }

  function zapocniPartiju(
    sudioniciUlaz: StavkaReda[],
    mod: 'cetiri_igraca' | 'dva_igraca' = 'cetiri_igraca',
  ): Promise<void> {
    if (zaustavljanje || partije.size >= maksimalnoAktivnihPartija) return Promise.resolve();
    const izmjesano = [...sudioniciUlaz].sort(() => Math.random() - 0.5);
    const sudionici: SudionikPartije[] = izmjesano.map((s, sjedalo) => {
      const odigrane = mod === 'dva_igraca' ? (s.odigrane1v1 ?? 0) : s.odigrane;
      const bodoviUkupno = mod === 'dva_igraca' ? (s.bodovi1v1 ?? 0) : s.bodoviUkupno;
      const prosjekBodova = odigrane > 0 ? bodoviUkupno / odigrane : 0;
      const rang = izracunajRang(odigrane, prosjekBodova, mod);
      return {
        igracId: s.igracId,
        vrsta: s.vrsta,
        nadimak: s.nadimak,
        avatarId: s.avatarId,
        avatarConfig: s.avatarConfig,
        avatarRevision: s.avatarRevision,
        rang: rang === 'Piskaralo' ? null : rang,
        sjedalo,
        razina: stanjeIskustva(s.iskustvoUkupno ?? 0).razina,
      };
    });
    const partijaId = randomUUID();
    const prviIgracId = sudionici[0]!.igracId;
    let pocetakIso = '';

    const stanje: StanjeStola = {
      partijaId,
      mod,
      sudionici,
      aktivni: new Set(sudionici.map((s) => s.igracId)),
      eliminirani: [],
      naPotezuId: prviIgracId,
      napadacId: null,
      trazenaSlova: null,
      zadnjaRijec: null,
      zadnjaRijecIgracId: null,
      zadnjaRijecVrsta: null,
      iskoristeneGrupe: new Set(),
      potrosioGrupu: new Map(),
      brojOdigranih: 0,
      runda: 0,
      redniBroj: 0,
      vrijemePocetkaPotezaMs: Date.now(),
      timerHandle: null,
      izborUToku: true, // do prve riječi sustava potezi nisu mogući
      izborHandle: null,
      istekIzboraIso: pocetakIso,
      eliminacije: [],
      eliminacijeBrojac: new Map(),
      zadnjiPotezi: new Map(),
      zadnjeReakcije: new Map(),
      grupeSNagradom: new Map(sudionici.map((s) => [s.igracId, new Map<string, number | null>()])),
      noveGrupeSNagradom: new Map(sudionici.map((s) => [s.igracId, new Map<string, number | null>()])),
      streakovi: new Map(sudionici.map((s) => [s.igracId, 0])),
      statistikeRijeci: new Map(sudionici.map((s) => [s.igracId, novaStatistikaRijeci()])),
      iskustvoPrije: new Map(sudionici.map((s) => [s.igracId, 0])),
      stavkeIskustva: new Map(sudionici.map((s) => [s.igracId, []])),
      napredakDostignuca: new Map(sudionici.map((s) => [s.igracId, {}])),
      statusSpremanja: 'nije_zavrsena',
      brojPokusajaSpremanja: 0,
      retrySpremanjaHandle: null,
      zavrsnoSpremanje: null,
      razloziEliminacije: new Map(),
      prekidiUTijeku: new Map(),
      obradaPrekidaZakazana: false,
      rezultatiKraja: new Map(),
      zavrsena: false,
    };

    partije.set(partijaId, stanje);
    for (const s of sudionici) partijaPoIgracu.set(s.igracId, partijaId);

    for (const s of sudionici) {
      const socket = aktivneVeze.dohvatiSocket(s.igracId);
      socket?.leave('red-cekanja-4p');
      socket?.leave('red-cekanja-1v1');
      socket?.join(SOBA_PARTIJE(partijaId));
    }
    const cekanjeMsPoIgracu = new Map(izmjesano.map((s) => [s.igracId, Date.now() - s.usaoU]));
    const upisPocetkaPromise = zapisiPocetakPartije(partijaId, sudionici, cekanjeMsPoIgracu, mod);
    // Igrači dobivaju countdown tek kad je poslužitelj spreman objaviti prvu rundu.
    return Promise.all([
      upisPocetkaPromise,
      ucitajOtkljucaneGrupe(sudionici).catch((greska) => {
        console.error('Neuspjelo učitavanje otključanih grupa:', greska);
        return new Map(sudionici.map((s) => [s.igracId, new Map<string, number | null>()]));
      }),
      ucitajIskustvo(sudionici).catch((greska) => {
        console.error('Neuspjelo učitavanje iskustva:', greska);
        return new Map(sudionici.map((s) => [s.igracId, 0]));
      }),
    ]).then(([, grupe, iskustvo]) => {
      stanje.grupeSNagradom = grupe;
      stanje.noveGrupeSNagradom = new Map(sudionici.map((s) => [s.igracId, new Map<string, number | null>()]));
      stanje.iskustvoPrije = iskustvo;
      if (stanje.zavrsena || stanje.izborHandle) return;
      pocetakIso = new Date(Date.now() + ODGODA_POCETKA_PARTIJE_MS).toISOString();
      stanje.istekIzboraIso = pocetakIso;
      const poruka: Omit<PocetakPartije, 'mojIgracId'> = {
        partijaId,
        pocetakIso,
        sjedala: sudionici.map((s) => ({ igracId: s.igracId, nadimak: s.nadimak, avatarId: s.avatarId, avatarConfig: s.avatarConfig, avatarRevision: s.avatarRevision, rang: s.rang, razina: s.razina })),
        mod,
      };
      for (const s of sudionici) {
        aktivneVeze.dohvatiSocket(s.igracId)?.emit('partija:pocetak', { ...poruka, mojIgracId: s.igracId });
      }
      stanje.izborHandle = setTimeout(() => objaviRijecSustava(stanje, null), ODGODA_POCETKA_PARTIJE_MS);
    }).catch((greska) => {
      if (stanje.izborHandle) clearTimeout(stanje.izborHandle);
      if (stanje.timerHandle) clearTimeout(stanje.timerHandle);
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
      throw greska;
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

  function spremiPotezAkoTreba(stanje: StanjeStola, zapis: Omit<import('./upis-partije.js').ZapisPoteza, 'partijaId'>) {
    if (!stanje.jePrivatna) {
      zapisiPotez({ partijaId: stanje.partijaId, ...zapis });
    }
  }

  function zakljuciPartiju(stanje: StanjeStola): void {
    stanje.zavrsena = true;
    if (stanje.timerHandle) clearTimeout(stanje.timerHandle);
    if (stanje.izborHandle) clearTimeout(stanje.izborHandle);
    for (const prekid of stanje.prekidiUTijeku.values()) clearTimeout(prekid.timerHandle);
    stanje.prekidiUTijeku.clear();

    // eliminirani[0] je prvi ispao (npr. 4. mjesto), zadnji preostali (aktivni) je pobjednik (1. mjesto)
    const pobjednikId = [...stanje.aktivni][0]!;
    const redoslijedOdPobjednika = [pobjednikId, ...[...stanje.eliminirani].reverse()];

    const plasmani = redoslijedOdPobjednika.map((igracId, indeks) => {
      const plasman = indeks + 1;
      const eliminacije = stanje.eliminacijeBrojac.get(igracId) ?? 0;
      let bodovi = 0;

      if (stanje.jePrivatna) {
        const pobjednikBodova = 2;
        const elimBod = stanje.postavkePrivatneSobe?.eliminacijskiBodovi ? eliminacije : 0;
        bodovi = (plasman === 1 ? pobjednikBodova : 0) + elimBod;
      } else {
        bodovi = izracunajBodove({ plasman: plasman as 1 | 2 | 3 | 4, eliminacije }, stanje.mod);
      }

      return { igracId, plasman, bodovi, eliminacije };
    });

    stanje.zadnjiPotezi.clear();
    stanje.zadnjeReakcije.clear();

    if (stanje.jePrivatna) {
      if (stanje.kodSobe) {
        postavke.naPrivatnaPartijaZavrsila?.(stanje.kodSobe, pobjednikId, plasmani);
      }
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
        nacinIspadanja: 'pobjednik' as const,
      }));
      pokreniSpremanjeRezultata(
        stanje,
        () => zakljuciPartijuUBazi(stanje.partijaId, pobjednikId, privatniRezultati, stanje.mod, privatneStatistike, true, new Map(
          [...stanje.napredakDostignuca].map(([igracId, delta]) => [igracId, { delta }]),
        )).then((agregati) => {
          for (const p of plasmani) {
            const poruka: KrajPartije = {
              partijaId: stanje.partijaId,
              plasmani,
              mojNoviProsjek: 0,
              mojRang: null,
              mojeIskustvo: null,
              // Privatne partije ne ulaze u javnu ocjenu igre ni XP bonus ocjene.
              mojaOcjenaIgre: null,
              bonusOcjenaIgre: 0,
              novaDostignuca: agregati.get(p.igracId)?.novaDostignuca ?? [],
              jePrivatna: true,
              kodSobe: stanje.kodSobe,
            };
            stanje.rezultatiKraja.set(p.igracId, poruka);
            if (partijaPoIgracu.get(p.igracId) === stanje.partijaId) {
              aktivneVeze.dohvatiSocket(p.igracId)?.emit('partija:kraj', poruka);
            }
          }
        }),
        () => {
          postavke.naPrivatnaPartijaZavrsila?.(stanje.kodSobe!, pobjednikId, plasmani);
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
        najduzaRijec: statistika.najduzaRijec,
        najduzaRijecGrafemi: statistika.najduzaRijecGrafemi,
        najrjedaRijec: statistika.najrjedaRijec,
        najrjedaRijecFrekvencija: statistika.najrjedaRijecFrekvencija,
        najrjedaTier: statistika.najrjedaTier,
      }]),
    );

    pokreniSpremanjeRezultata(
      stanje,
      () => zakljuciPartijuUBazi(stanje.partijaId, pobjednikId, rezultatiZaUpis, stanje.mod, statistike, false, new Map(
        [...stanje.napredakDostignuca].map(([igracId, delta]) => [igracId, { delta }]),
      )).then((agregati) => {
        for (const p of plasmani) {
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
          }
          const poruka: KrajPartije = {
            partijaId: stanje.partijaId,
            plasmani,
            mojNoviProsjek: prosjek,
            mojRang: null,
            mojeIskustvo: (() => {
              const obracun = obracuniIskustva.get(p.igracId);
              const bonusPostotak = agregat?.bonusOcjenaIgre ?? 0;
              if (!obracun || bonusPostotak === 0) return obracun ?? null;
              const bonus = Math.round(obracun.osvojenoIskustvo * bonusPostotak / 100);
              obracun.stavke.push({ vrsta: 'streak', naziv: `Ocjena igre +${bonusPostotak}%`, kolicina: 1, poStavci: null, iskustvo: bonus });
              obracun.brutoIskustvo += bonus;
              obracun.osvojenoIskustvo = Math.min(obracun.osvojenoIskustvo + bonus, MAKSIMALNO_ISKUSTVO - obracun.prije.ukupno);
              obracun.poslije = stanjeIskustva(obracun.prije.ukupno + obracun.osvojenoIskustvo);
              return obracun;
            })(),
            mojaOcjenaIgre: agregat?.ocjenaIgre ?? null,
            bonusOcjenaIgre: agregat?.bonusOcjenaIgre ?? 0,
            novaDostignuca: agregat?.novaDostignuca ?? [],
            mojDnk: agregat ? {
              odigrano: agregat.odigrane,
              preostaloDoOtkljucavanja: Math.max(0, 10 - agregat.odigrane),
              otkljucan: agregat.odigrane >= 10,
              upravoOtkljucan: agregat.odigrane === 10,
              prije: agregat.dnkPrije,
              poslije: agregat.dnkPoslije,
            } : undefined,
            mod: stanje.mod,
          };
          stanje.rezultatiKraja.set(p.igracId, poruka);
          if (partijaPoIgracu.get(p.igracId) === stanje.partijaId) {
            aktivneVeze.dohvatiSocket(p.igracId)?.emit('partija:kraj', poruka);
          }
        }
      }),
      () => {
        postavke.naPartijaZavrsila?.(stanje.partijaId);
        zakaziBrisanjeNakonSpremanja(stanje);
      },
    );
  }

  function nacinIspadanjaZaIgraca(
    stanje: StanjeStola,
    igracId: string,
  ): 'ne_znam' | 'istek' | 'mrtva_slova' | 'prekid' | 'kaladont' {
    const razlog = stanje.razloziEliminacije.get(igracId);
    if (razlog === 'ne_znam' || razlog === 'istek' || razlog === 'prekid' || razlog === 'kaladont') return razlog;
    return 'mrtva_slova';
  }

  /**
   * Otvaranje runde (1. runda, nakon eliminacije ili kaladont-efekta): sustav - ne igrac - bira
   * rijec, sprjecavajuci namjestanje ishoda odabirom "zamke" za konkretnog protivnika.
   * Prikazuje se 10s ekran igracima dok sustav "razmislja" (dovoljno da procitaju razlog eliminacije), pa tek onda kreće potez i 30s timer.
   * napadac = igrac nakon kojeg sustav preuzima red (null za 1. rundu partije).
   */
  function zapocniIzborRijeciSustava(stanje: StanjeStola, napadac: string | null): void {
    if (stanje.izborHandle) clearTimeout(stanje.izborHandle); // moze se dogoditi ako netko napusti partiju dok sustav vec bira
    stanje.izborUToku = true;
    stanje.napadacId = null;
    const trajanje = konfiguracija.NODE_ENV === 'test' ? 0 : TRAJANJE_IZBORA_SUSTAVA_MS;
    stanje.istekIzboraIso = new Date(Date.now() + trajanje).toISOString();
    const poruka: SustavBiraRijec = { istekIzboraIso: stanje.istekIzboraIso };
    io.to(SOBA_PARTIJE(stanje.partijaId)).emit('partija:sustav-bira-rijec', poruka);
    stanje.izborHandle = setTimeout(() => objaviRijecSustava(stanje, napadac), trajanje);
  }

  function objaviRijecSustava(stanje: StanjeStola, napadac: string | null): void {
    stanje.izborHandle = null;
    const autoRijec = rjecnik.nasumicnaPocetnaRijec(stanje.iskoristeneGrupe, stanje.dopusteneVrste);
    if (!autoRijec) {
      // ekstremni rubni slucaj (rjecnik iscrpljen) - sigurnosno zavrsi partiju
      zakljuciPartiju(stanje);
      return;
    }

    stanje.runda += 1;
    potrosiGrupe(stanje, autoRijec);
    const trazenaSlova = zadnjaDva(autoRijec);
    const naPotezu = napadac ? (sljedeciAktivni(stanje, napadac) ?? napadac) : stanje.naPotezuId;

    stanje.naPotezuId = naPotezu;
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
      istekPotezaIso: istekPotezaIso(stanje),
      serverVrijemeIso: new Date().toISOString(),
      runda: stanje.runda,
    };
    io.to(SOBA_PARTIJE(stanje.partijaId)).emit('partija:runda-otvorena', poruka);
  }

  function eliminirajIgraca(
    stanje: StanjeStola,
    igracId: string,
    razlog: RazlogEliminacije,
    kontekstPrekida?: Pick<PrekidUTijeku, 'bioNaPotezu' | 'napadacId'>,
  ): void {
    if (stanje.zavrsena || !stanje.aktivni.has(igracId)) return;

    ponistiCekanjePovratka(stanje, igracId);
    stanje.zadnjiPotezi.delete(igracId);

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
      trajanjeMs: razlog.startsWith('mrtva_slova') ? 0 : Date.now() - stanje.vrijemePocetkaPotezaMs,
    });

    // napadac nikad nije sam eliminirani igrac (npr. otvarač runde koji istekne prije ijedne riječi)
    const bioNaPotezuKodPrekida = kontekstPrekida?.bioNaPotezu ?? igracId === stanje.naPotezuId;
    const jeSamoeliminacijaIzvanPoteza = razlog === 'prekid' && !bioNaPotezuKodPrekida; // RS-10
    const napadac = jeSamoeliminacijaIzvanPoteza
      ? null
      : razlog === 'prekid' && kontekstPrekida
        ? kontekstPrekida.napadacId
        : stanje.napadacId;
    const stavkaEliminacije = !stanje.jePrivatna && napadac
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
    io.to(SOBA_PARTIJE(stanje.partijaId)).emit('partija:eliminacija', poruka);

    if (!stanje.jePrivatna && razlog !== 'prekid') {
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
        if (!stanje.izborUToku) postaviTimer(stanje);
        posaljiStanjeSvima(stanje);
      }
      return;
    }

    if (jeSamoeliminacijaIzvanPoteza) {
      // Tijekom tolerancije red je mogao doći do odspojenog igrača. Preskoči ga bez boda i nove runde.
      if (stanje.naPotezuId === igracId) {
        const sljedeci = sljedeciAktivni(stanje, igracId);
        if (sljedeci) {
          stanje.naPotezuId = sljedeci;
          if (!stanje.izborUToku) postaviTimer(stanje);
          posaljiStanjeSvima(stanje);
        }
      }
      return;
    }

    const noviOtvarac = razlog.startsWith('mrtva_slova') && napadac
      ? (sljedeciAktivni(stanje, napadac) ?? napadac)
      : (napadac ?? [...stanje.aktivni][0]!);
    zapocniIzborRijeciSustava(stanje, noviOtvarac);
  }

  function obradiPrihvacenPotez(
    stanje: StanjeStola,
    igracId: string,
    rijecNormalizirana: string,
    izvorniSocket?: KaladontSocket,
  ): void {
    const trazenaSlovaZaOvajPotez = stanje.trazenaSlova!;
    const trajanjeMs = Date.now() - stanje.vrijemePocetkaPotezaMs;
    const prethodniNapadacId = stanje.napadacId;
    const gamifikacijaAktivna = true;
    const trenutniStreak = gamifikacijaAktivna ? (stanje.streakovi.get(igracId) ?? 0) + 1 : 0;
    if (gamifikacijaAktivna) stanje.streakovi.set(igracId, trenutniStreak);
    const statistikaPoteza = stanje.statistikeRijeci.get(igracId)!;
    statistikaPoteza.prihvaceniPotezi += 1;
    statistikaPoteza.ukupnoTrajanjePrihvaceniPoteziMs += Math.max(0, trajanjeMs);
    const grupe = rjecnik.grupeZa(rijecNormalizirana);
    const frekvencija = rjecnik.frekvencijaZa?.(rijecNormalizirana);
    const grupeIgraca = stanje.grupeSNagradom.get(igracId) ?? new Map<string, number | null>();
    stanje.grupeSNagradom.set(igracId, grupeIgraca);
    const noveGrupe = grupe.filter((grupa) => !grupeIgraca.has(grupa));
    const stavkePotezaIskustva: StavkaIskustva[] = [];
    let nagrada: PrihvacenPotez['nagrada'] = null;
    if (gamifikacijaAktivna) {
      const statistika = stanje.statistikeRijeci.get(igracId)!;
      const brojGrafema = grafemi(rijecNormalizirana).length;
      statistika.najduziStreak = Math.max(statistika.najduziStreak, trenutniStreak);
      if (brojGrafema >= PRAGOVI_DULJINE.jakoDuga) statistika.upisaneJakoDugeRijeci += 1;
      else if (brojGrafema >= PRAGOVI_DULJINE.srednjeDuga) statistika.upisaneSrednjeDugeRijeci += 1;
      else if (brojGrafema >= PRAGOVI_DULJINE.duga) statistika.upisaneDugeRijeci += 1;
      if (brojGrafema > statistika.najduzaRijecGrafemi) {
        statistika.najduzaRijec = rijecNormalizirana;
        statistika.najduzaRijecGrafemi = brojGrafema;
      }
      if (frekvencija !== undefined && frekvencija !== null) {
        const tier = frekvencija === 0 && brojGrafema >= 4 ? 0 : frekvencija <= 9 ? 1 : frekvencija <= 99 ? 2 : null;
        const grupeZaStatistiku = tier === 0 ? statistika.otkriveneJakoRijetkeGrupe : tier === 1 ? statistika.otkriveneSrednjeRijetkeGrupe : tier === 2 ? statistika.otkriveneRijetkeGrupe : null;
        if (tier !== null && grupeZaStatistiku) {
          for (const grupa of noveGrupe) grupeZaStatistiku.add(grupa);
          if (statistika.najrjedaTier === null || tier <= statistika.najrjedaTier) {
            statistika.najrjedaTier = Math.min(statistika.najrjedaTier ?? tier, tier);
            statistika.najrjedaRijec = rijecNormalizirana;
            statistika.najrjedaRijecFrekvencija = frekvencija;
          }
        }
      }
      const rijecJeDuga = brojGrafema >= PRAGOVI_DULJINE.duga;
      const rijetkaTier = frekvencija === 0 && brojGrafema >= 4 ? 0 : typeof frekvencija === 'number' && frekvencija <= 9 ? 1 : typeof frekvencija === 'number' && frekvencija <= 99 ? 2 : null;
      if (rijecJeDuga || rijetkaTier !== null) {
        const postojeca = statistika.otkljucaneRijeci.get(rijecNormalizirana);
        statistika.otkljucaneRijeci.set(rijecNormalizirana, {
          jakoDuga: Boolean(postojeca?.jakoDuga || brojGrafema >= PRAGOVI_DULJINE.jakoDuga),
          jakoRijetka: Boolean(postojeca?.jakoRijetka || rijetkaTier === 0),
          dugaTier: brojGrafema >= 15 ? 2 : brojGrafema >= 12 ? 1 : brojGrafema >= 10 ? 0 : postojeca?.dugaTier ?? null,
          rijetkaTier: rijetkaTier ?? postojeca?.rijetkaTier ?? null,
        });
      }
      nagrada = frekvencija === undefined || frekvencija === null
        ? null
        : izracunajNagraduZaRijec(rijecNormalizirana, frekvencija, grupe, new Set(grupeIgraca.keys()));
      if (nagrada) {
        const tier = frekvencija === 0 && brojGrafema >= 4 ? 0 : typeof frekvencija === 'number' && frekvencija <= 9 ? 1 : typeof frekvencija === 'number' && frekvencija <= 99 ? 2 : null;
        const noveGrupeSNagradom = stanje.noveGrupeSNagradom.get(igracId) ?? new Map<string, number | null>();
        for (const grupa of noveGrupe) {
          grupeIgraca.set(grupa, tier);
          noveGrupeSNagradom.set(grupa, tier);
        }
        stanje.noveGrupeSNagradom.set(igracId, noveGrupeSNagradom);
        const brojOtkljucanih = [...grupeIgraca.values()].filter((vrijednost) => vrijednost !== null).length;
        nagrada.otkljucano = brojOtkljucanih;
        nagrada.ukupno = nagrada.kategorija === 'rijetke'
          ? rjecnik.ciljeviRijeci?.().rijetke.ukupno ?? null
          : rjecnik.ciljeviRijeci?.().duge.ukupno ?? null;
      }
    }

    if (!stanje.jePrivatna) {
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

    potrosiGrupe(stanje, rijecNormalizirana);
    stanje.redniBroj += 1;
    stanje.napadacId = igracId;
    stanje.zadnjaRijec = rijecNormalizirana;
    stanje.zadnjaRijecIgracId = igracId;
    stanje.zadnjaRijecVrsta = 'rijec';

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
      dodajNapredakDostignuca(stanje, igracId, { kaladontIzvedbe: 1 });
      const sljedeci = sljedeciAktivni(stanje, igracId) ?? igracId;
      emitirajPrihvacenPotezSvima(stanje, {
        igracId,
        rijec: rijecNormalizirana,
        trazenaSlova: stanje.trazenaSlova!,
        sljedeciId: sljedeci,
        istekPotezaIso: '',
        serverVrijemeIso: new Date().toISOString(),
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
      const sljedeci = sljedeciAktivni(stanje, igracId);
      stanje.trazenaSlova = novaTrazenaSlova;
      if (sljedeci) {
        stanje.naPotezuId = sljedeci;
        emitirajPrihvacenPotezSvima(stanje, {
          igracId,
          rijec: rijecNormalizirana,
          trazenaSlova: novaTrazenaSlova,
          sljedeciId: sljedeci,
          istekPotezaIso: '',
          serverVrijemeIso: new Date().toISOString(),
          brojIskoristenih: stanje.brojOdigranih,
          streak: trenutniStreak,
          nagrada,
          iskustvo: stavkePotezaIskustva,
        }, izvorniSocket);
        posaljiStanjeSvima(stanje);
      }
      if (sljedeci) eliminirajIgraca(stanje, sljedeci, razlogMrtvihSlova);
      return;
    }

    const sljedeci = sljedeciAktivni(stanje, igracId);
    if (!sljedeci) return; // ne bi se smjelo dogoditi dok je aktivnih > 1
    stanje.naPotezuId = sljedeci;
    stanje.trazenaSlova = novaTrazenaSlova;
    postaviTimer(stanje);

    const poruka: PrihvacenPotez = {
      igracId,
      rijec: rijecNormalizirana,
      trazenaSlova: novaTrazenaSlova,
      sljedeciId: sljedeci,
      istekPotezaIso: istekPotezaIso(stanje),
      serverVrijemeIso: new Date().toISOString(),
      brojIskoristenih: stanje.brojOdigranih,
      streak: trenutniStreak,
      nagrada,
      iskustvo: stavkePotezaIskustva,
    };
    emitirajPrihvacenPotezSvima(stanje, poruka, izvorniSocket);
    if (!stanje.prekidiUTijeku.has(sljedeci)) posaljiStanjeSvima(stanje);
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
    const stavkaEliminacije = stanje.jePrivatna
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

    if (stanje.aktivni.size <= 1) {
      zakljuciPartiju(stanje);
      return;
    }

    zapocniIzborRijeciSustava(stanje, sayerId);
  }

  function jePrebrzo(stanje: StanjeStola, igracId: string): boolean {
    const sada = Date.now();
    const povijest = (stanje.zadnjiPotezi.get(igracId) ?? []).filter((t) => sada - t < 1000);
    if (povijest.length >= 3) {
      stanje.zadnjiPotezi.set(igracId, povijest);
      return true;
    }
    povijest.push(sada);
    stanje.zadnjiPotezi.set(igracId, povijest);
    return false;
  }

  function ponistiCekanjePovratka(stanje: StanjeStola, igracId: string): void {
    const prekid = stanje.prekidiUTijeku.get(igracId);
    if (!prekid) return;
    clearTimeout(prekid.timerHandle);
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
    const poslaniSocketi = new Set<string>();
    if (izvorniSocket) {
      izvorniSocket.emit('potez:prihvacen', poruka);
      poslaniSocketi.add(izvorniSocket.id);
    }
    for (const sudionik of stanje.sudionici) {
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

    const sada = Date.now();
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
      clearTimeout(prekid.timerHandle);
      eliminirajIgraca(stanje, igracId, 'prekid', prekid);
    }
  }

  function zakaziObraduIsteklihPrekida(stanje: StanjeStola): void {
    if (stanje.obradaPrekidaZakazana || stanje.zavrsena) return;
    stanje.obradaPrekidaZakazana = true;
    const handle = odgodaObradePrekidaMs > 0
      ? setTimeout(() => obradiIsteklePrekide(stanje), odgodaObradePrekidaMs)
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
    const istekMs = Date.now() + tolerancijaPrekidaMs;
    const timerHandle = setTimeout(() => zakaziObraduIsteklihPrekida(stanje), tolerancijaPrekidaMs);
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
    }
    const rezultatKraja = stanje.rezultatiKraja.get(igracId);
    if (rezultatKraja) socket.emit('partija:kraj', rezultatKraja);
  }

  function registrirajHandlere(socket: KaladontSocket): void {
    socket.on('partija:stanje', () => {
      if (provjeriDogadaj(socket.data.igracId, 'partija:stanje')) posaljiStanje(socket);
    });

    socket.on('potez:rijec', (payload) => {
      if (!provjeriDogadaj(socket.data.igracId, 'potez:rijec')) return;
      const rezultatSheme = ShemaPotezRijec.safeParse(payload);
      if (!rezultatSheme.success) return; // neispravan payload - tiho ignoriraj (server ne vjeruje nikome)
      const { rijec } = rezultatSheme.data;

      const partijaId = partijaPoIgracu.get(socket.data.igracId);
      const stanje = partijaId ? partije.get(partijaId) : undefined;
      if (!stanje || stanje.zavrsena) return;

      if (jePrebrzo(stanje, socket.data.igracId)) {
        socket.emit('greska', { kod: 'PREBRZO', poruka: PORUKE.prebrzo });
        return;
      }
      if (stanje.naPotezuId !== socket.data.igracId) {
        socket.emit('potez:odbijen', { kod: 'NIJE_TVOJ_POTEZ', poruka: PORUKE.nijeTvojPotez });
        return;
      }
      if (stanje.izborUToku) {
        socket.emit('potez:odbijen', { kod: 'SUSTAV_BIRA_RIJEC', poruka: PORUKE.sustavBiraRijec });
        return;
      }

      const rijecNormalizirana = rijec.normalize('NFC').trim().toLowerCase();
      const trazenaSlova = stanje.trazenaSlova!;

      const rezultat = validirajPotez({
        rijec,
        trazenaSlova,
        iskoristeneGrupe: stanje.iskoristeneGrupe,
        potrosioGrupu: stanje.potrosioGrupu,
        dopusteneVrste: stanje.dopusteneVrste,
        rjecnik,
      });

      if (!rezultat.valjano) {
        stanje.streakovi.set(socket.data.igracId, 0);
        socket.emit('potez:odbijen', { kod: rezultat.kod!, poruka: rezultat.poruka! });
        return;
      }

      try {
        obradiPrihvacenPotez(stanje, socket.data.igracId, rijecNormalizirana, socket);
      } catch (greska) {
        console.error('Neuspjela obrada prihvaćenog poteza:', { rijec: rijecNormalizirana, greska });
        stanje.streakovi.set(socket.data.igracId, 0);
        socket.emit('greska', { kod: 'INTERNA', poruka: 'Potez nije obrađen. Pokušaj ponovno.' });
      }
    });

    socket.on('potez:ne-znam', () => {
      if (!provjeriDogadaj(socket.data.igracId, 'potez:ne-znam')) return;
      const partijaId = partijaPoIgracu.get(socket.data.igracId);
      const stanje = partijaId ? partije.get(partijaId) : undefined;
      if (!stanje || stanje.zavrsena || stanje.izborUToku || stanje.naPotezuId !== socket.data.igracId) return;
      eliminirajIgraca(stanje, socket.data.igracId, 'ne_znam');
    });

    socket.on('reakcija:posalji', (payload) => {
      if (!provjeriDogadaj(socket.data.igracId, 'reakcija:posalji')) return;
      const rezultatSheme = ShemaReakcija.safeParse(payload);
      if (!rezultatSheme.success) return;
      const { poruka } = rezultatSheme.data;

      const stanje = dohvatiPartijuZaSocket(socket);
      if (!stanje || stanje.zavrsena) return;
      const sada = Date.now();
      const zadnja = stanje.zadnjeReakcije.get(socket.data.igracId) ?? 0;
      if (sada - zadnja < 2000) return; // RS-22: tiho ignoriraj
      stanje.zadnjeReakcije.set(socket.data.igracId, sada);
      io.to(SOBA_PARTIJE(stanje.partijaId)).emit('reakcija:nova', { igracId: socket.data.igracId, poruka });
    });

    socket.on('partija:izadji', () => {
      if (!provjeriDogadaj(socket.data.igracId, 'partija:izadji')) return;
      const partijaId = partijaPoIgracu.get(socket.data.igracId);
      const stanje = partijaId ? partije.get(partijaId) : undefined;
      if (!stanje) return;

      if (!stanje.zavrsena && stanje.aktivni.has(socket.data.igracId)) {
        eliminirajIgraca(stanje, socket.data.igracId, 'prekid');
      }

      socket.leave(SOBA_PARTIJE(stanje.partijaId));
      if (partijaPoIgracu.get(socket.data.igracId) === stanje.partijaId) {
        partijaPoIgracu.delete(socket.data.igracId);
      }
    });

    socket.on('disconnect', () => {
      pokreniCekanjePovratka(socket);
    });

    obnoviVezuPartije(socket);
  }

  function zapocniPrivatnuPartiju(
    sudioniciUlaz: StavkaReda[],
    postavkeSobe: PostavkePrivatneSobe,
    kodSobe: string,
  ): string {
    if (zaustavljanje || partije.size >= maksimalnoAktivnihPartija) return '';
    const sudionici: SudionikPartije[] = sudioniciUlaz.map((s, sjedalo) => {
      const prosjekBodova = s.odigrane > 0 ? s.bodoviUkupno / s.odigrane : 0;
      const rang = izracunajRang(s.odigrane, prosjekBodova);
      return {
        igracId: s.igracId,
        vrsta: s.vrsta,
        nadimak: s.nadimak,
        avatarId: s.avatarId,
        avatarConfig: s.avatarConfig,
        avatarRevision: s.avatarRevision,
        rang: rang === 'Piskaralo' ? null : rang,
        sjedalo,
        razina: stanjeIskustva(s.iskustvoUkupno ?? 0).razina,
      };
    });
    const partijaId = randomUUID();
    const prviIgracId = sudionici[0]!.igracId;
      const odgodaMs = ODGODA_POCETKA_PRIVATNE_PARTIJE_MS;
    const pocetakIso = new Date(Date.now() + odgodaMs).toISOString();

    const stanje: StanjeStola = {
      partijaId,
      mod: 'cetiri_igraca',
      sudionici,
      aktivni: new Set(sudionici.map((s) => s.igracId)),
      eliminirani: [],
      naPotezuId: prviIgracId,
      napadacId: null,
      trazenaSlova: null,
      zadnjaRijec: null,
      zadnjaRijecIgracId: null,
      zadnjaRijecVrsta: null,
      iskoristeneGrupe: new Set(),
      potrosioGrupu: new Map(),
      brojOdigranih: 0,
      runda: 0,
      redniBroj: 0,
      vrijemePocetkaPotezaMs: Date.now(),
      timerHandle: null,
      izborUToku: true,
      izborHandle: null,
      istekIzboraIso: pocetakIso,
      eliminacije: [],
      eliminacijeBrojac: new Map(),
      zadnjiPotezi: new Map(),
      zadnjeReakcije: new Map(),
      grupeSNagradom: new Map(sudionici.map((s) => [s.igracId, new Map<string, number | null>()])),
      noveGrupeSNagradom: new Map(sudionici.map((s) => [s.igracId, new Map<string, number | null>()])),
      streakovi: new Map(sudionici.map((s) => [s.igracId, 0])),
      statistikeRijeci: new Map(sudionici.map((s) => [s.igracId, novaStatistikaRijeci()])),
      iskustvoPrije: new Map(sudionici.map((s) => [s.igracId, 0])),
      stavkeIskustva: new Map(sudionici.map((s) => [s.igracId, []])),
      napredakDostignuca: new Map(sudionici.map((s) => [s.igracId, {}])),
      statusSpremanja: 'nije_zavrsena',
      brojPokusajaSpremanja: 0,
      retrySpremanjaHandle: null,
      zavrsnoSpremanje: null,
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

    const poruka: Omit<PocetakPartije, 'mojIgracId'> = {
      partijaId,
      pocetakIso,
      sjedala: sudionici.map((s) => ({ igracId: s.igracId, nadimak: s.nadimak, avatarId: s.avatarId, avatarConfig: s.avatarConfig, avatarRevision: s.avatarRevision, rang: s.rang, razina: s.razina })),
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

    void ucitajOtkljucaneGrupe(sudionici).then((grupe) => {
      stanje.grupeSNagradom = grupe;
      const preostaloMs = Math.max(0, new Date(pocetakIso).getTime() - Date.now());
      stanje.izborHandle = setTimeout(() => objaviRijecSustava(stanje, null), preostaloMs);
    });

    return partijaId;
  }

  return {
    zapocniPartiju,
    zapocniPrivatnuPartiju,
    registrirajHandlere,
    zaustavi,
    mozePokrenutiPartiju: () => !zaustavljanje,
    nadimak,
    imaAktivnuPartiju: (igracId: string) => {
      const partijaId = partijaPoIgracu.get(igracId);
      const stanje = partijaId ? partije.get(partijaId) : undefined;
      return Boolean(stanje && !stanje.zavrsena);
    },
    brojAktivnihPartija: () => partije.size,
  };
}
