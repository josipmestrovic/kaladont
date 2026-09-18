import { io, type Socket } from 'socket.io-client';
import type { DogadajiKlijentPoslužitelj, DogadajiPosluziteljKlijent } from 'zajednicko';
import { ADRESA_POSLUZITELJA } from './konfiguracija.js';
import { dohvatiAuthToken } from './identitet.js';

export type KaladontSocket = Socket<DogadajiPosluziteljKlijent, DogadajiKlijentPoslužitelj>;

let socket: KaladontSocket | null = null;

/** Jedinstvena Socket.IO veza prema poslužitelju (jedna aktivna veza po identitetu). */
export function dohvatiSocket(): KaladontSocket {
  if (!socket) {
    socket = io(ADRESA_POSLUZITELJA, {
      auth: { token: dohvatiAuthToken() },
      transports: ['polling', 'websocket'],
    });
  }
  return socket;
}

/** Ponovno spaja postojeću vezu kako bi poslužitelj učitao svježi token i profilne podatke. */
export async function osvjeziSocketIdentitet(): Promise<void> {
  const aktivniSocket = dohvatiSocket();
  aktivniSocket.auth = { token: dohvatiAuthToken() };

  if (aktivniSocket.connected) aktivniSocket.disconnect();

  await new Promise<void>((resolve, reject) => {
    const priSpajanju = () => {
      ocisti();
      resolve();
    };
    const priGresci = (greska: Error) => {
      ocisti();
      reject(greska);
    };
    const ocisti = () => {
      aktivniSocket.off('connect', priSpajanju);
      aktivniSocket.off('connect_error', priGresci);
    };

    aktivniSocket.once('connect', priSpajanju);
    aktivniSocket.once('connect_error', priGresci);
    aktivniSocket.connect();
  });
}
