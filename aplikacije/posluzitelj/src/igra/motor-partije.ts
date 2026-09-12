/**
 * Motor jedne partije - stanje stola u memoriji (pregled-arhitekture.md: engine partije).
 * Server je jedini autoritet; poslužitelj je sat (RS-14).
 */
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { konfiguracija } from '../konfiguracija.js';
import {
  validirajPotez,
  odrediRazlogMrtvihSlova,
  izracunajBodove,
  izracunajRang,
  zadnjaDva,
  PORUKE,
  RIJECI_KALADONT,
  type RjecnikSucelje,
  type RazlogEliminacije,
  type PocetakPartije,
  type PrihvacenPotez,
  type Eliminacija,
  type KrajPartije,
  type SustavBiraRijec,
  type RundaOtvorena,
  type StanjePartije,
} from 'zajednicko';
import type { KaladontIo, KaladontSocket } from '../server.js';
import type { StavkaReda } from '../red/red-cekanja.js';
import { zapisiPocetakPartije, zapisiPotez, zakljuciPartijuUBazi } from './upis-partije.js';

const ShemaPotezRijec = z.object({ rijec: z.string().min(1).max(50) });
const ShemaReakcija = z.object({ poruka: z.enum(['pozdrav', 'sorry', 'dobro-odigrano', 'najjaci']) });

const TRAJANJE_POTEZA_MS = 30_000;
const TRAJANJE_IZBORA_SUSTAVA_MS = 10_000;
const PROZOR_ISTODOBNIH_PREKIDA_MS = 25;
// UX ekran mora trajati 5 s u razvoju, stagingu i produkciji. Samo testno okruženje
// preskače čekanje kako integracijski testovi ne bi čekali stvarno vrijeme.
const ODGODA_POCETKA_PARTIJE_MS = konfiguracija.ODGODA_POCETKA_PARTIJE_MS;
const ZADRZAVANJE_SOBE_NAKON_KRAJA_MS = 15_000; // reakcije rade dok igrači gledaju sažetak partije
const SOBA_PARTIJE = (partijaId: string) => `partija:${partijaId}`;

export interface SudionikPartije {
  igracId: string;
  nadimak: string;
  rang: string | null;
  avatarId: number;
  sjedalo: number;
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
}

interface PrekidUTijeku {
  timerHandle: NodeJS.Timeout;
  istekMs: number;
  bioNaPotezu: boolean;
  napadacId: string | null;
}

interface StanjeStola {
  partijaId: string;
  sudionici: SudionikPartije[]; // svi 4, fiksni redoslijed po sjedalu
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

  const partije = new Map<string, StanjeStola>();
  const partijaPoIgracu = new Map<string, string>(); // igracId -> partijaId

  function nadimak(stanje: StanjeStola, igracId: string): string {
    return stanje.sudionici.find((s) => s.igracId === igracId)?.nadimak ?? '???';
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
    if (timerOnemogucen) {
      stanje.timerHandle = null;
      return;
    }
    stanje.timerHandle = setTimeout(() => {
      eliminirajIgraca(stanje, stanje.naPotezuId, 'istek');
    }, trajanjePotezaMs);
  }

  function istekPotezaIso(stanje: StanjeStola): string {
    return new Date(stanje.vrijemePocetkaPotezaMs + trajanjePotezaMs).toISOString();
  }

  function posaljiStanje(socket: KaladontSocket): void {
    const partijaId = partijaPoIgracu.get(socket.data.igracId);
    const stanje = partijaId ? partije.get(partijaId) : undefined;
    if (!stanje) return;

    const poruka: StanjePartije = {
      partijaId: stanje.partijaId,
      mojIgracId: socket.data.igracId,
      sjedala: stanje.sudionici.map(({ igracId, nadimak, avatarId, rang }) => ({ igracId, nadimak, avatarId, rang })),
      naPotezuId: stanje.naPotezuId,
      trazenaSlova: stanje.trazenaSlova,
      istekPotezaIso: istekPotezaIso(stanje),
      runda: stanje.runda,
      brojIskoristenih: stanje.brojOdigranih,
      eliminacije: stanje.eliminacije,
      sustavBiraRijec: stanje.izborUToku,
      istekIzboraIso: stanje.istekIzboraIso,
      zadnjaRijec: stanje.zadnjaRijec,
      zadnjaRijecIgracId: stanje.zadnjaRijecIgracId,
      zadnjaRijecVrsta: stanje.zadnjaRijecVrsta,
      zavrsena: stanje.zavrsena,
    };
    socket.emit('partija:stanje', poruka);
  }

  function zapocniPartiju(sudioniciUlaz: StavkaReda[]): void {
    const izmjesano = [...sudioniciUlaz].sort(() => Math.random() - 0.5);
    const sudionici: SudionikPartije[] = izmjesano.map((s, sjedalo) => {
      const prosjekBodova = s.odigrane > 0 ? s.bodoviUkupno / s.odigrane : 0;
      const rang = izracunajRang(s.odigrane, prosjekBodova);
      return {
        igracId: s.igracId,
        nadimak: s.nadimak,
        avatarId: s.avatarId,
        rang: rang === 'Piskaralo' ? null : rang,
        sjedalo,
      };
    });
    const partijaId = randomUUID();
    const prviIgracId = sudionici[0]!.igracId;
    const odgodaMs = ODGODA_POCETKA_PARTIJE_MS;
    const pocetakIso = new Date(Date.now() + odgodaMs).toISOString();

    const stanje: StanjeStola = {
      partijaId,
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
      razloziEliminacije: new Map(),
      prekidiUTijeku: new Map(),
      obradaPrekidaZakazana: false,
      rezultatiKraja: new Map(),
      zavrsena: false,
    };

    partije.set(partijaId, stanje);
    for (const s of sudionici) partijaPoIgracu.set(s.igracId, partijaId);

    const cekanjeMsPoIgracu = new Map(izmjesano.map((s) => [s.igracId, Date.now() - s.usaoU]));
    const upisPocetkaPromise = zapisiPocetakPartije(partijaId, sudionici, cekanjeMsPoIgracu);

    const poruka: Omit<PocetakPartije, 'mojIgracId'> = {
      partijaId,
      pocetakIso,
      sjedala: sudionici.map((s) => ({ igracId: s.igracId, nadimak: s.nadimak, avatarId: s.avatarId, rang: s.rang })),
    };

    for (const s of sudionici) {
      const socket = aktivneVeze.dohvatiSocket(s.igracId);
      socket?.leave('red-cekanja');
      socket?.join(SOBA_PARTIJE(partijaId));
    }
    for (const s of sudionici) {
      aktivneVeze.dohvatiSocket(s.igracId)?.emit('partija:pocetak', { ...poruka, mojIgracId: s.igracId });
    }
    // 1. runda preskače „sustav bira riječ“ — čekaonica već odbrojava do pocetakIso.
    // Ceka upis partije u bazu (FK potezi -> partije) prije nego sto sustav zapise prvu automatsku rijec.
    void upisPocetkaPromise.then(() => {
      if (stanje.zavrsena || stanje.izborHandle) return;
      const preostaloMs = Math.max(0, new Date(pocetakIso).getTime() - Date.now());
      stanje.izborHandle = setTimeout(() => objaviRijecSustava(stanje, null), preostaloMs);
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

  function zakljuciPartiju(stanje: StanjeStola): void {
    stanje.zavrsena = true;
    if (stanje.timerHandle) clearTimeout(stanje.timerHandle);
    if (stanje.izborHandle) clearTimeout(stanje.izborHandle);
    for (const prekid of stanje.prekidiUTijeku.values()) clearTimeout(prekid.timerHandle);
    stanje.prekidiUTijeku.clear();

    // eliminirani[0] je prvi ispao (4. mjesto), zadnji preostali (aktivni) je pobjednik (1. mjesto)
    const pobjednikId = [...stanje.aktivni][0]!;
    const redoslijedOdPobjednika = [pobjednikId, ...[...stanje.eliminirani].reverse()];

    const plasmani = redoslijedOdPobjednika.map((igracId, indeks) => {
      const plasman = (indeks + 1) as 1 | 2 | 3 | 4;
      const eliminacije = stanje.eliminacijeBrojac.get(igracId) ?? 0;
      return { igracId, plasman, bodovi: izracunajBodove({ plasman, eliminacije }), eliminacije };
    });
    const rezultatiZaUpis = plasmani.map((p) => ({
      igracId: p.igracId,
      plasman: p.plasman,
      bodovi: p.bodovi,
      eliminacije: p.eliminacije,
      nacinIspadanja: p.plasman === 1 ? ('pobjednik' as const) : nacinIspadanjaZaIgraca(stanje, p.igracId),
    }));

    stanje.zadnjiPotezi.clear();
    stanje.zadnjeReakcije.clear();
    stanje.razloziEliminacije.clear();

    // Soba i mapiranja žive još kratko da reakcije rade tijekom sažetka; guard štiti novu partiju istog igrača.
    setTimeout(() => {
      for (const s of stanje.sudionici) {
        if (partijaPoIgracu.get(s.igracId) === stanje.partijaId) partijaPoIgracu.delete(s.igracId);
      }
      partije.delete(stanje.partijaId);
    }, ZADRZAVANJE_SOBE_NAKON_KRAJA_MS).unref();

    void zakljuciPartijuUBazi(stanje.partijaId, pobjednikId, rezultatiZaUpis)
      .then((agregati) => {
        for (const p of plasmani) {
          const agregat = agregati.get(p.igracId);
          const prosjek = agregat && agregat.odigrane > 0 ? agregat.bodoviUkupno / agregat.odigrane : 0;
          const poruka: KrajPartije = {
            partijaId: stanje.partijaId,
            plasmani,
            mojNoviProsjek: prosjek,
            mojRang: null,
          };
          stanje.rezultatiKraja.set(p.igracId, poruka);
          if (partijaPoIgracu.get(p.igracId) === stanje.partijaId) {
            aktivneVeze.dohvatiSocket(p.igracId)?.emit('partija:kraj', poruka);
          }
        }
      })
      .catch((greska) => console.error('Neuspio zaključak partije u bazi:', greska));
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
    const autoRijec = rjecnik.nasumicnaPocetnaImenickaRijec(stanje.iskoristeneGrupe);
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
    zapisiPotez({
      partijaId: stanje.partijaId,
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
    zapisiPotez({
      partijaId: stanje.partijaId,
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
    if (napadac) {
      stanje.eliminacijeBrojac.set(napadac, (stanje.eliminacijeBrojac.get(napadac) ?? 0) + 1);
    }

    const plasman = (stanje.aktivni.size + 1) as 2 | 3 | 4;
    const poruka: Eliminacija = {
      igracId,
      plasman,
      razlog,
      bodZa: napadac,
      slova: razlog.startsWith('mrtva_slova') ? stanje.trazenaSlova : null,
      rijecUzrok: razlog.startsWith('mrtva_slova') ? stanje.zadnjaRijec : null,
    };
    stanje.eliminacije.push(poruka);
    io.to(SOBA_PARTIJE(stanje.partijaId)).emit('partija:eliminacija', poruka);

    if (stanje.aktivni.size <= 1) {
      zakljuciPartiju(stanje);
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

  function obradiPrihvacenPotez(stanje: StanjeStola, igracId: string, rijecNormalizirana: string): void {
    const trazenaSlovaZaOvajPotez = stanje.trazenaSlova!;
    const trajanjeMs = Date.now() - stanje.vrijemePocetkaPotezaMs;
    const prethodniNapadacId = stanje.napadacId;

    potrosiGrupe(stanje, rijecNormalizirana);
    stanje.redniBroj += 1;
    stanje.napadacId = igracId;
    stanje.zadnjaRijec = rijecNormalizirana;
    stanje.zadnjaRijecIgracId = igracId;
    stanje.zadnjaRijecVrsta = 'rijec';

    zapisiPotez({
      partijaId: stanje.partijaId,
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
      obradiKaladontEfekt(stanje, igracId, prethodniNapadacId);
      return;
    }

    const novaTrazenaSlova = zadnjaDva(rijecNormalizirana);
    const razlogMrtvihSlova = odrediRazlogMrtvihSlova(novaTrazenaSlova, stanje.iskoristeneGrupe, rjecnik);

    if (razlogMrtvihSlova) {
      const sljedeci = sljedeciAktivni(stanje, igracId);
      stanje.trazenaSlova = novaTrazenaSlova;
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
      brojIskoristenih: stanje.brojOdigranih,
    };
    io.to(SOBA_PARTIJE(stanje.partijaId)).emit('potez:prihvacen', poruka);
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
    stanje.eliminacijeBrojac.set(sayerId, (stanje.eliminacijeBrojac.get(sayerId) ?? 0) + 1);

    stanje.redniBroj += 1;
    zapisiPotez({
      partijaId: stanje.partijaId,
      runda: stanje.runda,
      redniBroj: stanje.redniBroj,
      igracId: prethodniId,
      vrsta: 'kaladont',
      rijec: null,
      trazenaSlova: stanje.trazenaSlova,
      trajanjeMs: 0,
    });

    const plasman = (stanje.aktivni.size + 1) as 2 | 3 | 4;
    const porukaElim: Eliminacija = {
      igracId: prethodniId,
      plasman,
      razlog: 'kaladont',
      bodZa: sayerId,
      slova: null,
      rijecUzrok: stanje.zadnjaRijec,
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
    const rezultatKraja = stanje.rezultatiKraja.get(igracId);
    if (rezultatKraja) socket.emit('partija:kraj', rezultatKraja);
  }

  function registrirajHandlere(socket: KaladontSocket): void {
    socket.on('partija:stanje', () => posaljiStanje(socket));

    socket.on('potez:rijec', (payload) => {
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
        rjecnik,
      });

      if (!rezultat.valjano) {
        socket.emit('potez:odbijen', { kod: rezultat.kod!, poruka: rezultat.poruka! });
        return;
      }

      obradiPrihvacenPotez(stanje, socket.data.igracId, rijecNormalizirana);
    });

    socket.on('potez:ne-znam', () => {
      const partijaId = partijaPoIgracu.get(socket.data.igracId);
      const stanje = partijaId ? partije.get(partijaId) : undefined;
      if (!stanje || stanje.zavrsena || stanje.izborUToku || stanje.naPotezuId !== socket.data.igracId) return;
      eliminirajIgraca(stanje, socket.data.igracId, 'ne_znam');
    });

    socket.on('reakcija:posalji', (payload) => {
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

  return {
    zapocniPartiju,
    registrirajHandlere,
    nadimak,
    imaAktivnuPartiju: (igracId: string) => {
      const partijaId = partijaPoIgracu.get(igracId);
      const stanje = partijaId ? partije.get(partijaId) : undefined;
      return Boolean(stanje && !stanje.zavrsena);
    },
    brojAktivnihPartija: () => partije.size,
  };
}
