/**
 * Spaja RedCekanja na Socket.IO evente (red:udji, red:izadji, red:stanje).
 * RS-16: heartbeat/disconnect uklanja igrača iz reda u real-timeu.
 * RS-17: sastavljanje stola je atomarno (RedCekanja.pokusajSastaviStol).
 */
import type { StanjeReda } from 'zajednicko';
import { izracunajRang } from 'zajednicko';
import type { KaladontIo } from '../server.js';
import { RedCekanja, type StavkaReda } from './red-cekanja.js';
import { dohvatiProsjekCekanjaSek } from './prosjek-cekanja.js';

const SOBA_REDA = 'red-cekanja';

export function registrirajRedCekanja(
  io: KaladontIo,
  naStolSastavljen: (stol: StavkaReda[]) => void,
  igracImaAktivnuPartiju: (igracId: string) => boolean,
): { ukloniIzReda: (igracId: string) => void } {
  const red = new RedCekanja();

  function izracunajStanje(mojIgracId: string): StanjeReda {
    const stavke = red.stanje();
    const mjesta: StanjeReda['mjesta'] = [null, null, null, null];
    stavke.slice(0, 4).forEach((stavka, indeks) => {
      const prosjekBodova = stavka.odigrane > 0 ? stavka.bodoviUkupno / stavka.odigrane : 0;
      const rang = izracunajRang(stavka.odigrane, prosjekBodova);
      mjesta[indeks] = {
        igracId: stavka.igracId,
        nadimak: stavka.nadimak,
        avatarId: stavka.avatarId,
        rang: rang === 'Piskaralo' ? null : rang,
        prosjekBodova,
        postotakPobjeda: stavka.odigrane > 0 ? (stavka.pobjede / stavka.odigrane) * 100 : 0,
      };
    });
    return { mojIgracId, mjesta, prosjekCekanjaSek: dohvatiProsjekCekanjaSek() };
  }

  function posaljiStanje(): void {
    const socketIdovi = io.sockets.adapter.rooms.get(SOBA_REDA);
    if (!socketIdovi) return;
    for (const socketId of socketIdovi) {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) socket.emit('red:stanje', izracunajStanje(socket.data.igracId));
    }
  }

  io.on('connection', (socket) => {
    socket.on('red:udji', () => {
      if (igracImaAktivnuPartiju(socket.data.igracId)) return;
      if (red.stanje().some((s) => s.igracId === socket.data.igracId)) {
        socket.join(SOBA_REDA);
        socket.emit('red:stanje', izracunajStanje(socket.data.igracId));
        return;
      }

      socket.join(SOBA_REDA);
      red.udji({
        igracId: socket.data.igracId,
        nadimak: socket.data.nadimak,
        avatarId: socket.data.avatarId,
        odigrane: socket.data.odigrane,
        pobjede: socket.data.pobjede,
        bodoviUkupno: socket.data.bodoviUkupno,
        usaoU: Date.now(),
      });
      posaljiStanje();

      const stol = red.pokusajSastaviStol();
      if (stol) {
        naStolSastavljen(stol);
        posaljiStanje();
      }
    });

    socket.on('red:izadji', () => {
      red.izadji(socket.data.igracId);
      socket.leave(SOBA_REDA);
      posaljiStanje();
    });

    socket.on('disconnect', () => {
      red.izadji(socket.data.igracId);
      posaljiStanje();
    });
  });

  return { ukloniIzReda: (igracId: string) => red.izadji(igracId) };
}
