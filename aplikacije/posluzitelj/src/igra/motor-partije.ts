/**
 * Motor jedne partije - stanje stola u memoriji (pregled-arhitekture.md: engine partije).
 * Server je jedini autoritet; poslužitelj je sat (RS-14).
 */
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
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
const TRAJANJE_IZBORA_SUSTAVA_MS = 5_000;
// Namjerno NIJE vezano uz ONEMOGUCI_TIMER_POTEZA: countdown u čekaonici je UX značajka koja mora
// raditi i u razvoju s isključenim timerom poteza. Testovi je nuliraju kroz env.
const ODGODA_POCETKA_PARTIJE_MS = Number(process.env.ODGODA_POCETKA_PARTIJE_MS ?? 10_000);
const ZADRZAVANJE_SOBE_NAKON_KRAJA_MS = 15_000; // reakcije rade dok igrači gledaju sažetak partije
const SOBA_PARTIJE = (partijaId: string) => `partija:${partijaId}`;

export interface SudionikPartije {
  igracId: string;
  nadimak: string;
  rang: string | null;
  avatarId: number;
  sjedalo: number;
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
  zavrsena: boolean;
}

export function stvoriUpraviteljPartija(io: KaladontIo, rjecnik: RjecnikSucelje) {
  // SAMO za lokalno testiranje (docs/06-razvoj/postavljanje-okoline.md) - u produkciji mora biti iskljuceno/nepostavljeno
  const timerOnemogucen = process.env.ONEMOGUCI_TIMER_POTEZA === 'true';

  const partije = new Map<string, StanjeStola>();
  const partijaPoIgracu = new Map<string, string>(); // igracId -> partijaId
  const zadnjiPotezi = new Map<string, number[]>(); // socketId -> vremena pokušaja (RS-23)
  const zadnjaReakcija = new Map<string, number>(); // socketId -> zadnje vrijeme reakcije (RS-22)
  const zadnjiRazlogEliminacije = new Map<string, RazlogEliminacije>(); // "partijaId:igracId" -> razlog

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
    }, TRAJANJE_POTEZA_MS);
  }

  function istekPotezaIso(stanje: StanjeStola): string {
    return new Date(stanje.vrijemePocetkaPotezaMs + TRAJANJE_POTEZA_MS).toISOString();
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
      const socket = dohvatiSocket(s.igracId);
      socket?.leave('red-cekanja');
      socket?.join(SOBA_PARTIJE(partijaId));
    }
    for (const s of sudionici) {
      dohvatiSocket(s.igracId)?.emit('partija:pocetak', { ...poruka, mojIgracId: s.igracId });
    }
    // 1. runda preskače „sustav bira riječ“ — čekaonica već odbrojava do pocetakIso.
    // Ceka upis partije u bazu (FK potezi -> partije) prije nego sto sustav zapise prvu automatsku rijec.
    void upisPocetkaPromise.then(() => {
      if (stanje.zavrsena || stanje.izborHandle) return;
      const preostaloMs = Math.max(0, new Date(pocetakIso).getTime() - Date.now());
      stanje.izborHandle = setTimeout(() => objaviRijecSustava(stanje, null), preostaloMs);
    });
  }

  function dohvatiSocket(igracId: string) {
    for (const [, socket] of io.sockets.sockets) {
      if (socket.data.igracId === igracId) return socket;
    }
    return null;
  }

  function zakljuciPartiju(stanje: StanjeStola): void {
    stanje.zavrsena = true;
    if (stanje.timerHandle) clearTimeout(stanje.timerHandle);
    if (stanje.izborHandle) clearTimeout(stanje.izborHandle);

    // eliminirani[0] je prvi ispao (4. mjesto), zadnji preostali (aktivni) je pobjednik (1. mjesto)
    const pobjednikId = [...stanje.aktivni][0]!;
    const redoslijedOdPobjednika = [pobjednikId, ...[...stanje.eliminirani].reverse()];

    const plasmani = redoslijedOdPobjednika.map((igracId, indeks) => {
      const plasman = (indeks + 1) as 1 | 2 | 3 | 4;
      const eliminacije = stanje.eliminacijeBrojac.get(igracId) ?? 0;
      return { igracId, plasman, bodovi: izracunajBodove({ plasman, eliminacije }), eliminacije };
    });

    // Soba i mapiranja žive još kratko da reakcije rade tijekom sažetka; guard štiti novu partiju istog igrača.
    setTimeout(() => {
      for (const s of stanje.sudionici) {
        if (partijaPoIgracu.get(s.igracId) === stanje.partijaId) partijaPoIgracu.delete(s.igracId);
      }
      partije.delete(stanje.partijaId);
    }, ZADRZAVANJE_SOBE_NAKON_KRAJA_MS).unref();

    void zakljuciPartijuUBazi(
      stanje.partijaId,
      pobjednikId,
      plasmani.map((p) => ({
        igracId: p.igracId,
        plasman: p.plasman,
        bodovi: p.bodovi,
        eliminacije: p.eliminacije,
        nacinIspadanja: p.plasman === 1 ? 'pobjednik' : nacinIspadanjaZaIgraca(stanje, p.igracId),
      })),
    )
      .then((agregati) => {
        for (const p of plasmani) {
          const agregat = agregati.get(p.igracId);
          const prosjek = agregat && agregat.odigrane > 0 ? agregat.bodoviUkupno / agregat.odigrane : 0;
          const poruka: KrajPartije = { plasmani, mojNoviProsjek: prosjek, mojRang: null };
          dohvatiSocket(p.igracId)?.emit('partija:kraj', poruka);
        }
      })
      .catch((greska) => console.error('Neuspio zaključak partije u bazi:', greska));
  }

  function nacinIspadanjaZaIgraca(
    stanje: StanjeStola,
    igracId: string,
  ): 'ne_znam' | 'istek' | 'mrtva_slova' | 'prekid' | 'kaladont' {
    const razlog = zadnjiRazlogEliminacije.get(`${stanje.partijaId}:${igracId}`);
    if (razlog === 'ne_znam' || razlog === 'istek' || razlog === 'prekid' || razlog === 'kaladont') return razlog;
    return 'mrtva_slova';
  }

  /**
   * Otvaranje runde (1. runda, nakon eliminacije ili kaladont-efekta): sustav - ne igrac - bira
   * rijec, sprjecavajuci namjestanje ishoda odabirom "zamke" za konkretnog protivnika.
   * Prikazuje se 5s ekran igracima dok sustav "razmislja", pa tek onda kreće potez i 30s timer.
   * napadac = igrac nakon kojeg sustav preuzima red (null za 1. rundu partije).
   */
  function zapocniIzborRijeciSustava(stanje: StanjeStola, napadac: string | null): void {
    if (stanje.izborHandle) clearTimeout(stanje.izborHandle); // moze se dogoditi ako netko napusti partiju dok sustav vec bira
    stanje.izborUToku = true;
    stanje.napadacId = null;
    const trajanje = timerOnemogucen ? 0 : TRAJANJE_IZBORA_SUSTAVA_MS;
    stanje.istekIzboraIso = new Date(Date.now() + trajanje).toISOString();
    const poruka: SustavBiraRijec = { istekIzboraIso: stanje.istekIzboraIso };
    io.to(SOBA_PARTIJE(stanje.partijaId)).emit('partija:sustav-bira-rijec', poruka);
    stanje.izborHandle = setTimeout(() => objaviRijecSustava(stanje, napadac), trajanje);
  }

  function objaviRijecSustava(stanje: StanjeStola, napadac: string | null): void {
    stanje.izborHandle = null;
    const autoRijec = rjecnik.nasumicnaValjanaRijec(stanje.iskoristeneGrupe);
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

  function eliminirajIgraca(stanje: StanjeStola, igracId: string, razlog: RazlogEliminacije): void {
    if (stanje.zavrsena || !stanje.aktivni.has(igracId)) return;

    stanje.aktivni.delete(igracId);
    stanje.eliminirani.push(igracId);
    zadnjiRazlogEliminacije.set(`${stanje.partijaId}:${igracId}`, razlog);

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
    const jeSamoeliminacijaIzvanPoteza = razlog === 'prekid' && igracId !== stanje.naPotezuId; // RS-10
    const napadac = jeSamoeliminacijaIzvanPoteza ? null : stanje.napadacId;
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
      // RS-10: krug se nastavlja, naPotezuId nije diran jer eliminirani nije bio na potezu
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

    stanje.aktivni.delete(prethodniId);
    stanje.eliminirani.push(prethodniId);
    zadnjiRazlogEliminacije.set(`${stanje.partijaId}:${prethodniId}`, 'kaladont');
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
    io.to(SOBA_PARTIJE(stanje.partijaId)).emit('partija:eliminacija', porukaElim);

    if (stanje.aktivni.size <= 1) {
      zakljuciPartiju(stanje);
      return;
    }

    zapocniIzborRijeciSustava(stanje, sayerId);
  }

  function jePrebrzo(socketId: string): boolean {
    const sada = Date.now();
    const povijest = (zadnjiPotezi.get(socketId) ?? []).filter((t) => sada - t < 1000);
    povijest.push(sada);
    zadnjiPotezi.set(socketId, povijest);
    return povijest.length > 3;
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

      if (jePrebrzo(socket.id)) {
        socket.emit('greska', { kod: 'PREBRZO', poruka: PORUKE.prebrzo });
        return;
      }
      if (stanje.naPotezuId !== socket.data.igracId) {
        socket.emit('potez:odbijen', { kod: 'NIJE_TVOJ_POTEZ', poruka: PORUKE.nijeTvojPotez });
        return;
      }
      if (stanje.izborUToku) return; // sustav trenutno bira rijec - potez se ne moze poslati

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

      const partijaId = partijaPoIgracu.get(socket.data.igracId);
      if (!partijaId) return;
      const sada = Date.now();
      const zadnja = zadnjaReakcija.get(socket.id) ?? 0;
      if (sada - zadnja < 2000) return; // RS-22: tiho ignoriraj
      zadnjaReakcija.set(socket.id, sada);
      io.to(SOBA_PARTIJE(partijaId)).emit('reakcija:nova', { igracId: socket.data.igracId, poruka });
    });

    socket.on('partija:izadji', () => {
      const partijaId = partijaPoIgracu.get(socket.data.igracId);
      const stanje = partijaId ? partije.get(partijaId) : undefined;
      if (!stanje || stanje.zavrsena) return;
      const razlog: RazlogEliminacije = 'prekid';
      eliminirajIgraca(stanje, socket.data.igracId, razlog);
    });

    socket.on('disconnect', () => {
      const partijaId = partijaPoIgracu.get(socket.data.igracId);
      const stanje = partijaId ? partije.get(partijaId) : undefined;
      if (!stanje || stanje.zavrsena) return;
      eliminirajIgraca(stanje, socket.data.igracId, 'prekid');
    });
  }

  return { zapocniPartiju, registrirajHandlere, nadimak };
}
