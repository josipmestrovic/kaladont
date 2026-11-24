/**
 * Socket ulaz za rezervaciju Izazova (obrazac kao trening:zapocni).
 */
import { z } from 'zod';
import { ID_OVI_IZAZOVA, type KodGreske, type PotvrdaIzazova } from 'zajednicko';
import type { KaladontIo, KaladontSocket } from '../server.js';
import { omotajSocketHandler, type ZapisSocketHandlerGreske } from '../sigurnost/socket-handler.js';
import type { ProvjeriOgranicenjeDogadaja } from '../sigurnost/socket-ogranicenja.js';
import { potvrdaIzRezultata, rezervirajPokusajIzazova, type PokreniPartijuIzazova } from './servis.js';

const ShemaIzazovZapocni = z.object({
  challengeId: z.enum(ID_OVI_IZAZOVA as unknown as [string, ...string[]]),
  requestId: z.string().min(8).max(128),
}).strict();

export interface OpcijeServisaIzazova {
  omogucen: () => boolean;
  igracImaAktivnuPartiju: (igracId: string) => boolean;
  igracImaPrivatnuSobu: (igracId: string) => boolean;
  ukloniIzJavnogReda: (igracId: string) => void;
  provjeriDogadaj: ProvjeriOgranicenjeDogadaja;
  zapisSocketHandlerGreske: ZapisSocketHandlerGreske;
  pokreniPartiju?: PokreniPartijuIzazova;
}

export interface BrojaciIzazova {
  rezervacije: number;
  odbijeni: number;
  tehnicki: number;
}

export function registrirajIzazovSocket(io: KaladontIo, opcije: OpcijeServisaIzazova): { brojaci: BrojaciIzazova } {
  const brojaci: BrojaciIzazova = { rezervacije: 0, odbijeni: 0, tehnicki: 0 };

  function odbij(socket: KaladontSocket, potvrda: PotvrdaIzazova | undefined, kod: KodGreske, poruka: string): void {
    brojaci.odbijeni += 1;
    socket.emit('greska', { kod, poruka });
    potvrda?.({ rezerviran: false, kod, poruka });
  }

  io.on('connection', (socket) => {
    socket.on('izazov:zapocni', omotajSocketHandler(socket, 'izazov:zapocni', opcije.zapisSocketHandlerGreske, async (...argumenti: unknown[]) => {
      const [prvi, drugi, ...dodatni] = argumenti;
      const potvrda = typeof drugi === 'function'
        ? drugi as PotvrdaIzazova
        : typeof prvi === 'function'
          ? prvi as PotvrdaIzazova
          : undefined;
      const payload = typeof prvi === 'function' ? undefined : prvi;
      const parse = ShemaIzazovZapocni.safeParse(payload);
      const neispravno = !parse.success || dodatni.length > 0 || typeof prvi === 'function';
      if (neispravno) {
        odbij(socket, potvrda, 'NEVALJAN_PAYLOAD', 'Poslana poruka nije ispravna.');
        return;
      }
      if (!opcije.provjeriDogadaj(socket.data.igracId, 'izazov:zapocni')) {
        potvrda?.({ rezerviran: false, kod: 'PREBRZO', poruka: 'Previše zahtjeva. Pričekaj trenutak.' });
        return;
      }
      if (!opcije.omogucen()) {
        odbij(socket, potvrda, 'IZAZOV_NEDOSTUPAN', 'Izazov trenutačno nije dostupan.');
        return;
      }
      if (opcije.igracImaAktivnuPartiju(socket.data.igracId)) {
        odbij(socket, potvrda, 'VEC_U_PARTIJI', 'Već si u igri. Završi je prije Izazova.');
        return;
      }
      if (opcije.igracImaPrivatnuSobu(socket.data.igracId)) {
        odbij(socket, potvrda, 'VEC_U_SOBI', 'Napusti privatnu sobu prije Izazova.');
        return;
      }
      opcije.ukloniIzJavnogReda(socket.data.igracId);

      try {
        const rezultat = await rezervirajPokusajIzazova({
          igracId: socket.data.igracId,
          vrsta: socket.data.vrsta,
          challengeId: parse.data.challengeId,
          requestId: parse.data.requestId,
          omogucen: true,
          pokreniPartiju: opcije.pokreniPartiju,
        });
        const potvrdaPayload = potvrdaIzRezultata(rezultat);
        if (!rezultat.ok) {
          brojaci.odbijeni += 1;
          socket.emit('greska', { kod: rezultat.kod, poruka: rezultat.poruka });
          potvrda?.(potvrdaPayload);
          return;
        }
        if (!rezultat.pokrenut && rezultat.pokusaj.status === 'tehnicki_prekinuto') {
          brojaci.tehnicki += 1;
        } else {
          brojaci.rezervacije += 1;
        }
        potvrda?.(potvrdaPayload);
      } catch (greska: unknown) {
        console.error('Neuspjela rezervacija Izazova:', greska);
        odbij(socket, potvrda, 'INTERNA', 'Izazov nije moguće pokrenuti. Pokušaj ponovno.');
      }
    }));
  });

  return { brojaci };
}
