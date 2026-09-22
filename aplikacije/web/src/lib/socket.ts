import { io, type Socket } from 'socket.io-client';
import type { DogadajiKlijentPoslužitelj, DogadajiPosluziteljKlijent } from 'zajednicko';
import { ADRESA_POSLUZITELJA } from './konfiguracija.js';
import { dohvatiAuthToken } from './identitet.js';
export { dohvatiStanjeVeze } from './stanje-veze.svelte.js';
export { oznaciPartijuDostupnom } from './stanje-veze.svelte.js';
export type { StanjeSocketVeze, StanjeVeze } from './stanje-veze.svelte.js';
import {
  postaviStanjeVeze,
  stanjeVeze,
} from './stanje-veze.svelte.js';

export type KaladontSocket = Socket<DogadajiPosluziteljKlijent, DogadajiKlijentPoslužitelj>;

let socket: KaladontSocket | null = null;
let slusateljiPostavljeni = false;

function kodIzGreske(greska: Error & { data?: { kod?: string } }): string | null {
  return greska.data?.kod ?? (greska.message.includes('sesija') || greska.message.includes('istekao') ? 'SESIJA_ISTEKLA' : null);
}

function postaviSlusatelje(aktivniSocket: KaladontSocket): void {
  if (slusateljiPostavljeni) return;
  slusateljiPostavljeni = true;
  aktivniSocket.io.on('reconnect_attempt', () => {
    stanjeVeze.brojPokusaja += 1;
    postaviStanjeVeze('ponovno_spajanje');
  });
  aktivniSocket.io.on('reconnect', () => postaviStanjeVeze('spremno'));
  aktivniSocket.io.on('reconnect_error', (greska: Error) => {
    const kod = kodIzGreske(greska as Error & { data?: { kod?: string } });
    if (kod === 'SESIJA_ISTEKLA' || kod === 'NEVALJAN_TOKEN') {
      aktivniSocket.io.reconnection(false);
      postaviStanjeVeze('sesija_istekla', kod, greska.message);
    } else {
      postaviStanjeVeze('ponovno_spajanje', kod, greska.message);
    }
  });
  aktivniSocket.io.on('reconnect_failed', () => postaviStanjeVeze('prekid', 'RECONNECT_NEUSPJEO'));
  aktivniSocket.on('connect', () => {
    stanjeVeze.brojPokusaja = 0;
    postaviStanjeVeze('spremno');
  });
  aktivniSocket.on('veza:zatvorena', (p) => {
    if (p.kod === 'DRUGA_KARTICA') postaviStanjeVeze('druga_kartica', p.kod, p.poruka);
    if (p.kod === 'SESIJA_ISTEKLA') postaviStanjeVeze('sesija_istekla', p.kod, p.poruka);
  });
  aktivniSocket.on('disconnect', (razlog) => {
    if (razlog === 'io client disconnect') {
      postaviStanjeVeze('rucno_iskljuceno');
    } else if (stanjeVeze.stanje !== 'sesija_istekla' && stanjeVeze.stanje !== 'druga_kartica') {
      postaviStanjeVeze('prekid', razlog);
    }
  });
  aktivniSocket.on('connect_error', (greska: Error & { data?: { kod?: string } }) => {
    const kod = kodIzGreske(greska);
    if (kod === 'DRUGA_KARTICA') postaviStanjeVeze('druga_kartica', kod, greska.message);
    else if (kod === 'SESIJA_ISTEKLA' || kod === 'NEVALJAN_TOKEN') {
      aktivniSocket.io.reconnection(false);
      postaviStanjeVeze('sesija_istekla', kod, greska.message);
    } else postaviStanjeVeze('ponovno_spajanje', kod, greska.message);
  });
}

/** Jedinstvena Socket.IO veza prema poslužitelju (jedna aktivna veza po identitetu). */
export function dohvatiSocket(): KaladontSocket {
  if (!socket) {
    socket = io(ADRESA_POSLUZITELJA, {
      auth: { token: dohvatiAuthToken() },
      transports: ['polling', 'websocket'],
    });
    postaviSlusatelje(socket);
  }
  return socket;
}

/** Ponovno spaja postojeću vezu kako bi poslužitelj učitao svježi token i profilne podatke. */
export async function osvjeziSocketIdentitet(): Promise<void> {
  const aktivniSocket = dohvatiSocket();
  aktivniSocket.io.reconnection(true);
  postaviStanjeVeze('ponovno_spajanje');
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

export function oznaciNamjernoIskljucenje(): void {
  postaviStanjeVeze('rucno_iskljuceno');
}

