import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { Server as SocketIoServer, type Socket } from 'socket.io';
import type { DogadajiKlijentPoslužitelj, DogadajiPosluziteljKlijent } from 'zajednicko';
import { ucitajRjecnik } from './rjecnik/ucitaj.js';
import { jeValjaniToken, razrijesiIdentitet, RegistarVeza } from './identitet/identitet.js';
import { registrirajRedCekanja } from './red/servis-reda.js';
import { osvjeziProsjekCekanja } from './red/prosjek-cekanja.js';
import { stvoriUpraviteljPartija } from './igra/motor-partije.js';
import { registrirajRacuneRute } from './racuni/rute.js';
import { registrirajProfilRute } from './profil/rute.js';
import { registrirajPrijaveRute } from './prijave/rute.js';
import { registrirajAdminRute } from './admin/rute.js';
import { registrirajRjecnikRute } from './rjecnik/rute.js';

export interface PodaciSocketa {
  igracId: string;
  nadimak: string;
  avatarId: number;
  odigrane: number;
  pobjede: number;
  bodoviUkupno: number;
}

export type KaladontIo = SocketIoServer<
  DogadajiKlijentPoslužitelj,
  DogadajiPosluziteljKlijent,
  Record<string, never>,
  PodaciSocketa
>;

export type KaladontSocket = Socket<
  DogadajiKlijentPoslužitelj,
  DogadajiPosluziteljKlijent,
  Record<string, never>,
  PodaciSocketa
>;

export interface Posluzitelj {
  app: FastifyInstance;
  io: KaladontIo;
}

/** Izgrađuje Fastify + Socket.IO instancu (bez pokretanja listen-a) - koristi ga i index.ts i testovi. */
export async function izgradiPosluzitelj(): Promise<Posluzitelj> {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true, credentials: true });
  await app.register(cookie);
  await app.register(rateLimit, { max: 100, timeWindow: '1 minute' });
  await registrirajRacuneRute(app);

  const rjecnik = await ucitajRjecnik();
  app.log.info(`Rječnik učitan: ${rjecnik.brojRijeci()} riječi`);

  await registrirajProfilRute(app);
  await registrirajPrijaveRute(app);
  await registrirajAdminRute(app, rjecnik);
  await registrirajRjecnikRute(app, rjecnik);

  app.get('/zdravlje', async () => ({
    ok: true,
    brojRijeci: rjecnik.brojRijeci(),
  }));

  await app.ready();

  await osvjeziProsjekCekanja();

  const io: KaladontIo = new SocketIoServer(app.server, {
    cors: { origin: true },
  });

  const registarVeza = new RegistarVeza();
  const upravitelj = stvoriUpraviteljPartija(io, rjecnik);

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!jeValjaniToken(token)) {
      next(new Error('Nevaljan token'));
      return;
    }
    try {
      const identitet = await razrijesiIdentitet(token);
      socket.data.igracId = identitet.igracId;
      socket.data.nadimak = identitet.nadimak;
      socket.data.avatarId = identitet.avatarId;
      socket.data.odigrane = identitet.odigrane;
      socket.data.pobjede = identitet.pobjede;
      socket.data.bodoviUkupno = identitet.bodoviUkupno;
      next();
    } catch (greska) {
      const poruka = greska instanceof Error ? greska.message : 'Interna greška';
      next(new Error(poruka));
    }
  });

  io.on('connection', (socket) => {
    const { igracId, nadimak } = socket.data;

    // RS-18: jedna aktivna veza po identitetu - stara veza se odjavljuje
    const staraSocketId = registarVeza.zamijeni(igracId, socket.id);
    if (staraSocketId) {
      io.sockets.sockets.get(staraSocketId)?.disconnect(true);
    }

    app.log.info(`Spojen igrač ${nadimak} (${igracId})`);

    upravitelj.registrirajHandlere(socket);

    socket.on('disconnect', () => {
      registarVeza.ukloni(igracId, socket.id);
    });
  });

  registrirajRedCekanja(io, (stol) => {
    upravitelj.zapocniPartiju(stol);
    void osvjeziProsjekCekanja();
  });

  return { app, io };
}
