/**
 * Spaja RedCekanja na Socket.IO evente (red:udji, red:izadji, red:stanje).
 * RS-16: heartbeat/disconnect uklanja igrača iz reda u real-timeu.
 * RS-17: sastavljanje stola je atomarno (RedCekanja.pokusajSastaviStol).
 */
import type { StanjeReda } from 'zajednicko';
import { izracunajRang, stanjeIskustva } from 'zajednicko';
import type { KaladontIo } from '../server.js';
import { RedCekanja, prvaCetvorica, prviPar, type StavkaReda } from './red-cekanja.js';
import { dohvatiProsjekCekanjaSek } from './prosjek-cekanja.js';

const SOBA_REDA_4P = 'red-cekanja-4p';
const SOBA_REDA_1V1 = 'red-cekanja-1v1';

export function registrirajRedCekanja(
  io: KaladontIo,
  naStolSastavljen: (stol: StavkaReda[], mod: 'cetiri_igraca' | 'dva_igraca') => void,
  igracImaAktivnuPartiju: (igracId: string) => boolean,
): { ukloniIzReda: (igracId: string) => void } {
  const red4p = new RedCekanja(prvaCetvorica);
  const red1v1 = new RedCekanja(prviPar);

  function izracunajStanje(mojIgracId: string, mod: 'cetiri_igraca' | 'dva_igraca'): StanjeReda {
    const red = mod === 'dva_igraca' ? red1v1 : red4p;
    const maks = mod === 'dva_igraca' ? 2 : 4;
    const stavke = red.stanje();
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
        avatarId: stavka.avatarId,
        rang: rang === 'Piskaralo' ? null : rang,
        razina: stanjeIskustva(stavka.iskustvoUkupno ?? 0).razina,
        odigrane,
        prosjekBodova,
        postotakPobjeda: odigrane > 0 ? (pobjede / odigrane) * 100 : 0,
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
    red4p.izadji(igracId);
    red1v1.izadji(igracId);
  }

  io.on('connection', (socket) => {
    socket.on('red:stanje', (payload) => {
      const mod: 'cetiri_igraca' | 'dva_igraca' =
        payload?.mod === 'dva_igraca' ? 'dva_igraca' : 'cetiri_igraca';
      socket.emit('red:stanje', izracunajStanje(socket.data.igracId, mod));
    });

    socket.on('red:udji', (payload) => {
      const mod: 'cetiri_igraca' | 'dva_igraca' =
        payload?.mod === 'dva_igraca' ? 'dva_igraca' : 'cetiri_igraca';
      const sobaZaUlaz = mod === 'dva_igraca' ? SOBA_REDA_1V1 : SOBA_REDA_4P;
      const suprotnaSoba = mod === 'dva_igraca' ? SOBA_REDA_4P : SOBA_REDA_1V1;
      const red = mod === 'dva_igraca' ? red1v1 : red4p;

      if (igracImaAktivnuPartiju(socket.data.igracId)) return;

      socket.leave(suprotnaSoba);
      socket.join(sobaZaUlaz);

      if (red.stanje().some((s) => s.igracId === socket.data.igracId)) {
        socket.emit('red:stanje', izracunajStanje(socket.data.igracId, mod));
        return;
      }

      ukloniIzSvihRedova(socket.data.igracId);

      red.udji({
        igracId: socket.data.igracId,
        vrsta: socket.data.vrsta,
        nadimak: socket.data.nadimak,
        avatarId: socket.data.avatarId,
        odigrane: socket.data.odigrane ?? 0,
        pobjede: socket.data.pobjede ?? 0,
        bodoviUkupno: socket.data.bodoviUkupno ?? 0,
        odigrane1v1: socket.data.odigrane1v1 ?? 0,
        pobjede1v1: socket.data.pobjede1v1 ?? 0,
        bodovi1v1: socket.data.bodovi1v1 ?? 0,
        iskustvoUkupno: socket.data.iskustvoUkupno ?? 0,
        usaoU: Date.now(),
      });
      posaljiStanje(mod);

      const stol = red.pokusajSastaviStol();
      if (stol) {
        naStolSastavljen(stol, mod);
        posaljiStanje(mod);
      }
    });

    socket.on('red:izadji', () => {
      ukloniIzSvihRedova(socket.data.igracId);
      socket.leave(SOBA_REDA_4P);
      socket.leave(SOBA_REDA_1V1);
      posaljiStanje('cetiri_igraca');
      posaljiStanje('dva_igraca');
    });

    socket.on('disconnect', () => {
      ukloniIzSvihRedova(socket.data.igracId);
      posaljiStanje('cetiri_igraca');
      posaljiStanje('dva_igraca');
    });
  });

  return {
    ukloniIzReda: (igracId: string) => {
      ukloniIzSvihRedova(igracId);
      posaljiStanje('cetiri_igraca');
      posaljiStanje('dva_igraca');
    },
  };
}
