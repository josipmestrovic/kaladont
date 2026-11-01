/**
 * Spaja RedCekanja na Socket.IO evente (red:udji, red:izadji, red:stanje).
 * RS-16: heartbeat/disconnect uklanja igrača iz reda u real-timeu.
 * RS-17: sastavljanje stola je atomarno (RedCekanja.pokusajSastaviStol).
 */
import type { StanjeReda } from 'zajednicko';
import { izracunajRang, razinaVatre, stanjeIskustva } from 'zajednicko';
import { z } from 'zod';
import type { KaladontIo } from '../server.js';
import { RedCekanja, prvaCetvorica, prviPar, type StavkaReda } from './red-cekanja.js';
import { dohvatiProsjekCekanjaSek } from './prosjek-cekanja.js';
import type { ProvjeriOgranicenjeDogadaja } from '../sigurnost/socket-ogranicenja.js';
import { omotajSocketHandler, type ZapisSocketHandlerGreske } from '../sigurnost/socket-handler.js';
import type { RezultatPokretanja } from '../igra/politika-ucinka.js';
import { PRAGOVI_POPUNE_MS, PopunaReda } from './raspored-popune.js';
import type { FondBotova } from '../bot/fond.js';

const SOBA_REDA_4P = 'red-cekanja-4p';
const SOBA_REDA_1V1 = 'red-cekanja-1v1';
const ShemaPayloadReda = z.object({ mod: z.enum(['cetiri_igraca', 'dva_igraca']).optional() }).strict().optional();
const PORUKA_NEVALJANOG_PAYLOADA = 'Poslana poruka nije ispravna.';

export interface OpcijePopuneReda {
  fond: FondBotova;
  omogucena: (mod: 'cetiri_igraca' | 'dva_igraca') => boolean;
  botJeZauzet: (igracId: string) => boolean;
  sada?: () => number;
  /** Samo za testove: kraći pragovi od produkcijskih 30 / 20-30-40 s. */
  pragoviMs?: Partial<Record<'cetiri_igraca' | 'dva_igraca', readonly number[]>>;
  odstupanjaMs?: Partial<Record<'cetiri_igraca' | 'dva_igraca', readonly number[]>>;
  dohvatiRaspored?: (mod: 'cetiri_igraca' | 'dva_igraca') => { pragoviMs: readonly number[]; odstupanjaMs?: readonly number[] };
  dohvatiOdmaciNeuspjelogPokretanja?: () => readonly number[];
}

export function registrirajRedCekanja(
  io: KaladontIo,
  naStolSastavljen: (stol: StavkaReda[], mod: 'cetiri_igraca' | 'dva_igraca') => Promise<RezultatPokretanja | void> | RezultatPokretanja | void,
  igracImaAktivnuPartiju: (igracId: string) => boolean,
  igracImaPrivatnuSobu: (igracId: string) => boolean,
  mozeStvoritiPartiju: () => boolean,
  igracMozeIgrati: (socket: import('../server.js').KaladontSocket) => boolean,
  provjeriDogadaj: ProvjeriOgranicenjeDogadaja,
  zapisSocketHandlerGreske: ZapisSocketHandlerGreske,
  popunaOpcije?: OpcijePopuneReda,
): { ukloniIzReda: (igracId: string) => void; osvjeziPopunu: () => void; zaustaviPopunu: () => void } {
  const red4p = new RedCekanja(prvaCetvorica);
  const red1v1 = new RedCekanja(prviPar);
  const namjere = new Map<string, { mod: 'cetiri_igraca' | 'dva_igraca'; generacija: number }>();
  let generacijaUlaska = 0;
  let zaustavljen = false;
  const ponavljanja = new Map<'cetiri_igraca' | 'dva_igraca', NodeJS.Timeout>();
  const greskePokretanja = new Map<'cetiri_igraca' | 'dva_igraca', number>();

  function stvoriPopunu(mod: 'cetiri_igraca' | 'dva_igraca'): PopunaReda | null {
    if (!popunaOpcije) return null;
    return new PopunaReda({
      red: mod === 'dva_igraca' ? red1v1 : red4p,
      fond: popunaOpcije.fond,
      velicinaStola: mod === 'dva_igraca' ? 2 : 4,
      pragoviMs: popunaOpcije.pragoviMs?.[mod] ?? PRAGOVI_POPUNE_MS[mod],
      odstupanjaMs: popunaOpcije.odstupanjaMs?.[mod],
      dohvatiRaspored: popunaOpcije.dohvatiRaspored ? () => popunaOpcije.dohvatiRaspored!(mod) : undefined,
      omogucena: () => !zaustavljen && !ponavljanja.has(mod) && popunaOpcije.omogucena(mod) && mozeStvoritiPartiju(),
      pokreniStol: (stol) => pokreniStolSRezultatom(stol, mod),
      botJeZauzet: popunaOpcije.botJeZauzet,
      naPromjenu: () => posaljiStanje(mod),
      sada: popunaOpcije.sada,
    });
  }
  const popuna4p = stvoriPopunu('cetiri_igraca');
  const popuna1v1 = stvoriPopunu('dva_igraca');
  const popunaZa = (mod: 'cetiri_igraca' | 'dva_igraca') => (mod === 'dva_igraca' ? popuna1v1 : popuna4p);

  function izracunajStanje(mojIgracId: string, mod: 'cetiri_igraca' | 'dva_igraca'): StanjeReda {
    const red = mod === 'dva_igraca' ? red1v1 : red4p;
    const maks = mod === 'dva_igraca' ? 2 : 4;
    // Rezervirani botovi prikazuju se kao sudionici koji čekaju; rokove i dalje određuje poslužitelj.
    const stavke = [...red.stanje(), ...(popunaZa(mod)?.rezerviraniBotovi() ?? [])];
    const mjesta: StanjeReda['mjesta'] = Array.from({ length: maks }, () => null);

    stavke.slice(0, maks).forEach((stavka, indeks) => {
      const odigrane = mod === 'dva_igraca' ? (stavka.odigrane1v1 ?? 0) : stavka.odigrane;
      const pobjede = mod === 'dva_igraca' ? (stavka.pobjede1v1 ?? 0) : stavka.pobjede;
      const bodoviUkupno = mod === 'dva_igraca' ? (stavka.bodovi1v1 ?? 0) : stavka.bodoviUkupno;

      const prosjekBodova = odigrane > 0 ? bodoviUkupno / odigrane : 0;
      const rang = izracunajRang(odigrane, prosjekBodova, mod);

      mjesta[indeks] = {
        igracId: stavka.igracId,
        nadimak: stavka.nadimak,
        jeGost: stavka.vrsta === 'gost',
        avatarId: stavka.avatarId,
        avatarConfig: stavka.avatarConfig,
        avatarRevision: stavka.avatarRevision,
        rang: rang === 'Piskaralo' ? null : rang,
        razina: stanjeIskustva(stavka.iskustvoUkupno ?? 0).razina,
        odigrane,
        prosjekBodova,
        postotakPobjeda: odigrane > 0 ? (pobjede / odigrane) * 100 : 0,
        trenutniNiz: mod === 'dva_igraca' ? (stavka.trenutniNiz1v1 ?? 0) : (stavka.trenutniNiz4p ?? 0),
        razinaVatre: razinaVatre(mod === 'dva_igraca' ? (stavka.trenutniNiz1v1 ?? 0) : (stavka.trenutniNiz4p ?? 0), mod),
      };
    });
    return { mojIgracId, mod, mjesta, prosjekCekanjaSek: dohvatiProsjekCekanjaSek() };
  }

  function posaljiStanje(mod: 'cetiri_igraca' | 'dva_igraca'): void {
    const sobaSve = mod === 'dva_igraca' ? SOBA_REDA_1V1 : SOBA_REDA_4P;
    const socketIdovi = io.sockets.adapter.rooms.get(sobaSve);
    if (!socketIdovi) return;
    for (const socketId of socketIdovi) {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) socket.emit('red:stanje', izracunajStanje(socket.data.igracId, mod));
    }
  }

  function ukloniIzSvihRedova(igracId: string) {
    namjere.delete(igracId);
    red4p.izadji(igracId);
    red1v1.izadji(igracId);
  }

  /** Nakon neuspjelog starta vraća samo ljude koji još čekaju isti način; zadržava izvorni usaoU. */
  function vratiURed(stol: readonly StavkaReda[], mod: 'cetiri_igraca' | 'dva_igraca', generacije: ReadonlyMap<string, number>): void {
    const red = mod === 'dva_igraca' ? red1v1 : red4p;
    const soba = mod === 'dva_igraca' ? SOBA_REDA_1V1 : SOBA_REDA_4P;
    for (const stavka of stol) {
      if (stavka.upravljac === 'bot') continue;
      const namjera = namjere.get(stavka.igracId);
      const socket = [...io.sockets.sockets.values()].find((veza) => veza.connected && veza.data.igracId === stavka.igracId);
      if (!zaustavljen && socket && namjera?.mod === mod && namjera.generacija === generacije.get(stavka.igracId) && !igracImaAktivnuPartiju(stavka.igracId) && !igracImaPrivatnuSobu(stavka.igracId)) {
        socket.join(soba);
        red.udji(stavka);
      }
    }
  }

  function pokreniStolSRezultatom(stol: StavkaReda[], mod: 'cetiri_igraca' | 'dva_igraca'): Promise<RezultatPokretanja> {
    const generacije = new Map(stol.filter((stavka) => stavka.upravljac !== 'bot').map((stavka) => [stavka.igracId, namjere.get(stavka.igracId)?.generacija ?? -1]));
    const obradiNeuspjeh = () => {
      vratiURed(stol, mod, generacije);
      if (zaustavljen || ponavljanja.has(mod)) return;
      const broj = (greskePokretanja.get(mod) ?? 0) + 1;
      greskePokretanja.set(mod, broj);
      const odmaci = popunaOpcije?.dohvatiOdmaciNeuspjelogPokretanja?.() ?? [1_000, 2_000, 4_000, 5_000];
      const odmak = odmaci[Math.min(broj - 1, odmaci.length - 1)] ?? 5_000;
      const timer = setTimeout(() => {
        ponavljanja.delete(mod);
        if (zaustavljen) return;
        const red = mod === 'dva_igraca' ? red1v1 : red4p;
        const noviStol = red.pokusajSastaviStol();
        if (noviStol) pokreniStol(noviStol, mod);
        else popunaZa(mod)?.osvjezi();
      }, odmak);
      timer.unref();
      ponavljanja.set(mod, timer);
    };
    return Promise.resolve()
      .then(() => naStolSastavljen(stol, mod))
      .then((rezultat) => {
        const konacni: RezultatPokretanja = rezultat ?? 'pokrenuta';
        if (konacni !== 'pokrenuta') obradiNeuspjeh();
        else {
          popunaOpcije?.fond.zapamtiProtivnike(stol);
          greskePokretanja.delete(mod);
          for (const [igracId, generacija] of generacije) {
            if (namjere.get(igracId)?.generacija === generacija) namjere.delete(igracId);
          }
        }
        return konacni;
      }, (greska: unknown) => {
        console.error('Neuspjelo pokretanje partije:', greska);
        obradiNeuspjeh();
        return 'greska' as const;
      })
      .finally(() => posaljiStanje(mod));
  }

  function pokreniStol(stol: StavkaReda[], mod: 'cetiri_igraca' | 'dva_igraca'): void {
    void pokreniStolSRezultatom(stol, mod).finally(() => popunaZa(mod)?.osvjezi());
  }

  io.on('connection', (socket) => {
    socket.on('red:stanje', omotajSocketHandler(socket, 'red:stanje', zapisSocketHandlerGreske, (payload: unknown, ...dodatniArgumenti: unknown[]) => {
      const rezultat = ShemaPayloadReda.safeParse(payload);
      if (!rezultat.success || dodatniArgumenti.length > 0) {
        socket.emit('greska', { kod: 'NEVALJAN_PAYLOAD', poruka: PORUKA_NEVALJANOG_PAYLOADA });
        return;
      }
      if (!provjeriDogadaj(socket.data.igracId, 'red:stanje')) return;
      const mod: 'cetiri_igraca' | 'dva_igraca' = rezultat.data?.mod === 'dva_igraca' ? 'dva_igraca' : 'cetiri_igraca';
      socket.emit('red:stanje', izracunajStanje(socket.data.igracId, mod));
    }));

    socket.on('red:udji', omotajSocketHandler(socket, 'red:udji', zapisSocketHandlerGreske, (...argumenti: unknown[]) => {
      const [payload, mogucaPotvrda, ...dodatniArgumenti] = argumenti;
      const rezultat = ShemaPayloadReda.safeParse(payload);
      const potvrda = typeof mogucaPotvrda === 'function'
        ? mogucaPotvrda as (stanje: StanjeReda | null) => void
        : undefined;
      if (!rezultat.success || dodatniArgumenti.length > 0 || (mogucaPotvrda !== undefined && !potvrda)) {
        socket.emit('greska', { kod: 'NEVALJAN_PAYLOAD', poruka: PORUKA_NEVALJANOG_PAYLOADA });
        return;
      }
      if (!provjeriDogadaj(socket.data.igracId, 'red:udji')) {
        potvrda?.(null);
        return;
      }
      if (!igracMozeIgrati(socket)) {
        socket.emit('greska', { kod: 'EMAIL_NIJE_POTVRDEN', poruka: 'Potvrdi email adresu prije ulaska u partiju.' });
        potvrda?.(null);
        return;
      }
      const mod: 'cetiri_igraca' | 'dva_igraca' = rezultat.data?.mod === 'dva_igraca' ? 'dva_igraca' : 'cetiri_igraca';
      const sobaZaUlaz = mod === 'dva_igraca' ? SOBA_REDA_1V1 : SOBA_REDA_4P;
      const suprotnaSoba = mod === 'dva_igraca' ? SOBA_REDA_4P : SOBA_REDA_1V1;
      const red = mod === 'dva_igraca' ? red1v1 : red4p;

      if (igracImaAktivnuPartiju(socket.data.igracId)) {
        potvrda?.(null);
        return;
      }

      if (igracImaPrivatnuSobu(socket.data.igracId)) {
        potvrda?.(null);
        return;
      }

      if (!mozeStvoritiPartiju()) {
        potvrda?.(null);
        return;
      }

      socket.leave(suprotnaSoba);
      socket.join(sobaZaUlaz);

      if (red.stanje().some((s) => s.igracId === socket.data.igracId)) {
        potvrda?.(izracunajStanje(socket.data.igracId, mod));
        return;
      }

      ukloniIzSvihRedova(socket.data.igracId);
      namjere.set(socket.data.igracId, { mod, generacija: ++generacijaUlaska });

      red.udji({
        igracId: socket.data.igracId,
        vrsta: socket.data.vrsta,
        nadimak: socket.data.nadimak,
        avatarId: socket.data.avatarId,
        avatarConfig: socket.data.avatarConfig,
        avatarRevision: socket.data.avatarRevision,
        odigrane: socket.data.odigrane ?? 0,
        pobjede: socket.data.pobjede ?? 0,
        bodoviUkupno: socket.data.bodoviUkupno ?? 0,
        odigrane1v1: socket.data.odigrane1v1 ?? 0,
        pobjede1v1: socket.data.pobjede1v1 ?? 0,
        bodovi1v1: socket.data.bodovi1v1 ?? 0,
        iskustvoUkupno: socket.data.iskustvoUkupno ?? 0,
        trenutniNiz4p: socket.data.trenutniNiz4p ?? 0,
        trenutniNiz1v1: socket.data.trenutniNiz1v1 ?? 0,
        usaoU: Date.now(),
      });
      potvrda?.(izracunajStanje(socket.data.igracId, mod));
      posaljiStanje(mod);

      const stol = ponavljanja.has(mod) ? null : red.pokusajSastaviStol();
      if (stol) pokreniStol(stol, mod);
      else popunaZa(mod)?.osvjezi();
    }));

    socket.on('red:izadji', omotajSocketHandler(socket, 'red:izadji', zapisSocketHandlerGreske, (...argumenti: unknown[]) => {
      if (argumenti.length > 0) {
        socket.emit('greska', { kod: 'NEVALJAN_PAYLOAD', poruka: PORUKA_NEVALJANOG_PAYLOADA });
        return;
      }
      if (!provjeriDogadaj(socket.data.igracId, 'red:izadji')) return;
      ukloniIzSvihRedova(socket.data.igracId);
      socket.leave(SOBA_REDA_4P);
      socket.leave(SOBA_REDA_1V1);
      popuna4p?.osvjezi();
      popuna1v1?.osvjezi();
      posaljiStanje('cetiri_igraca');
      posaljiStanje('dva_igraca');
    }));

    socket.on('disconnect', omotajSocketHandler(socket, 'disconnect', zapisSocketHandlerGreske, () => {
      ukloniIzSvihRedova(socket.data.igracId);
      popuna4p?.osvjezi();
      popuna1v1?.osvjezi();
      posaljiStanje('cetiri_igraca');
      posaljiStanje('dva_igraca');
    }));
  });

  return {
    ukloniIzReda: (igracId: string) => {
      ukloniIzSvihRedova(igracId);
      popuna4p?.osvjezi();
      popuna1v1?.osvjezi();
      for (const socket of io.sockets.sockets.values()) {
        if (socket.data.igracId === igracId) {
          socket.leave(SOBA_REDA_4P);
          socket.leave(SOBA_REDA_1V1);
        }
      }
      posaljiStanje('cetiri_igraca');
      posaljiStanje('dva_igraca');
    },
    osvjeziPopunu: () => {
      popuna4p?.osvjezi();
      popuna1v1?.osvjezi();
    },
    zaustaviPopunu: () => {
      zaustavljen = true;
      for (const timer of ponavljanja.values()) clearTimeout(timer);
      ponavljanja.clear();
      namjere.clear();
      greskePokretanja.clear();
      popuna4p?.zaustavi();
      popuna1v1?.zaustavi();
    },
  };
}
