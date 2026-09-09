import { io, type Socket } from 'socket.io-client';
import type { DogadajiKlijentPoslužitelj, DogadajiPosluziteljKlijent } from 'zajednicko';
import { ADRESA_POSLUZITELJA } from './konfiguracija.js';
import { dohvatiAuthToken } from './identitet.js';

export type KaladontSocket = Socket<DogadajiPosluziteljKlijent, DogadajiKlijentPoslužitelj>;

let socket: KaladontSocket | null = null;

/** Jedinstvena Socket.IO veza prema poslužitelju (jedna aktivna veza po identitetu). */
export function dohvatiSocket(): KaladontSocket {
  if (!socket) {
    socket = io(ADRESA_POSLUZITELJA, { auth: { token: dohvatiAuthToken() } });
  }
  return socket;
}
