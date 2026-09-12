import Fastify, { type FastifyInstance } from 'fastify';
import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { sql } from 'drizzle-orm';
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
import { konfiguracija } from './konfiguracija.js';
import { baza } from './baza/klijent.js';
import type { PostavkeMotoraPartije } from './igra/motor-partije.js';

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

export interface OpcijePosluzitelja {
  postavkeMotora?: PostavkeMotoraPartije;
}

/** Izgrađuje Fastify + Socket.IO instancu (bez pokretanja listen-a) - koristi ga i index.ts i testovi. */
export async function izgradiPosluzitelj(opcije: OpcijePosluzitelja = {}): Promise<Posluzitelj> {
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

  if (konfiguracija.NODE_ENV === 'staging' || konfiguracija.NODE_ENV === 'production') {
    const direktorijServera = path.dirname(fileURLToPath(import.meta.url));
    const mogucePutanjeWebHandlera = [
      path.resolve(direktorijServera, '../web/build/handler.js'),
      path.resolve(direktorijServera, '../../web/build/handler.js'),
    ];
    const putanjaWebHandlera = mogucePutanjeWebHandlera.find((putanja) => existsSync(putanja));

    if (!putanjaWebHandlera) {
      throw new Error(`SvelteKit handler nije pronađen: ${mogucePutanjeWebHandlera.join(', ')}`);
    }

    const { handler } = await import(pathToFileURL(putanjaWebHandlera).href);

    // Zvukovi nisu sadrzajno hashani kao _app/immutable - adapter-node im ne daje dugotrajni cache,
    // pa ih serviramo posebno prije SvelteKit catch-alla (samo staging/produkcija, dev koristi Vite).
    const direktorijZvukova = path.join(path.dirname(putanjaWebHandlera), 'client', 'zvukovi');
    const MIME_ZVUKOVA: Record<string, string> = { '.wav': 'audio/wav', '.mp3': 'audio/mpeg' };

    app.get('/zvukovi/*', async (zahtjev, odgovor) => {
      const trazenaPutanja = (zahtjev.params as { '*': string })['*'];
      const puniPuta = path.join(direktorijZvukova, trazenaPutanja);
      if (!puniPuta.startsWith(direktorijZvukova) || !existsSync(puniPuta)) {
        return odgovor.code(404).send();
      }
      const mime = MIME_ZVUKOVA[path.extname(puniPuta)] ?? 'application/octet-stream';
      odgovor.header('cache-control', 'public, max-age=31536000, immutable').type(mime);
      return odgovor.send(createReadStream(puniPuta));
    });

    app.route({
      method: ['GET', 'HEAD'],
      url: '/*',
      handler: async (zahtjev, odgovor) => {
        odgovor.hijack();
        await handler(zahtjev.raw, odgovor.raw);
      },
    });
  }

  const io: KaladontIo = new SocketIoServer(app.server, {
    cors: { origin: true },
  });

  const registarVeza = new RegistarVeza();
  const upravitelj = stvoriUpraviteljPartija(
    io,
    rjecnik,
    {
      dohvatiSocket: (igracId) => {
        const socketId = registarVeza.dohvatiSocketId(igracId);
        return socketId ? io.sockets.sockets.get(socketId) : undefined;
      },
      jeAktivnaVeza: (igracId, socketId) => registarVeza.dohvatiSocketId(igracId) === socketId,
    },
    opcije.postavkeMotora,
  );

  app.get('/zdravlje', async (_zahtjev, odgovor) => {
    let bazaDostupna = true;
    try {
      await baza.execute(sql`select 1`);
    } catch (greska) {
      bazaDostupna = false;
      app.log.warn({ greska }, 'Provjera baze za health nije uspjela');
    }

    const brojRijeci = rjecnik.brojRijeci();
    const spreman = bazaDostupna && brojRijeci > 0;
    const tijelo = {
      ok: spreman,
      baza: bazaDostupna ? 'dostupna' : 'nedostupna',
      brojRijeci,
      aktivnePartije: upravitelj.brojAktivnihPartija(),
      uptimeSekunde: Math.floor(process.uptime()),
      verzija: konfiguracija.VERZIJA,
      digest: konfiguracija.DIGEST,
    };

    return odgovor.code(spreman ? 200 : 503).send(tijelo);
  });

  await app.ready();

  await osvjeziProsjekCekanja();

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
  }, upravitelj.imaAktivnuPartiju);

  return { app, io };
}
