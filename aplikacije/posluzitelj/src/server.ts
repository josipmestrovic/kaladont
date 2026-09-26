import Fastify, { type FastifyInstance } from 'fastify';
import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { eq, sql } from 'drizzle-orm';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { Server as SocketIoServer, type Socket } from 'socket.io';
import { razinaVatre, validirajAvatarConfig, type AvatarConfigV1, type DogadajiKlijentPoslužitelj, type DogadajiPosluziteljKlijent, type KodRazlogaVeze } from 'zajednicko';
import { ucitajRjecnik } from './rjecnik/ucitaj.js';
import { jeValjaniToken, razrijesiIdentitet, RegistarVeza } from './identitet/identitet.js';
import { registrirajRedCekanja } from './red/servis-reda.js';
import { registrirajPrivatneSobe } from './soba/servis-soba.js';
import { osvjeziProsjekCekanja } from './red/prosjek-cekanja.js';
import { stvoriUpraviteljPartija } from './igra/motor-partije.js';
import {
  registrirajRacuneRute,
  registrirajStariLinkPotvrdeEmaila,
  type OpcijeAuthRateLimita,
} from './racuni/rute.js';
import { registrirajProfilRute } from './profil/rute.js';
import { registrirajPrijaveRute } from './prijave/rute.js';
import { registrirajAdminRute } from './admin/rute.js';
import { registrirajRjecnikRute } from './rjecnik/rute.js';
import { registrirajPovratneInformacijeRute } from './povratne-informacije/rute.js';
import { konfiguracija } from './konfiguracija.js';
import { baza } from './baza/klijent.js';
import {
  jeDopustenOrigin,
  jePouzdaniProxy,
  stvoriCorsOrigin,
  type Okruzenje,
} from './sigurnost/origin.js';
import type { PostavkeMotoraPartije } from './igra/motor-partije.js';
import { OgranicivacDogadaja, type PostavkeSocketOgranicenja } from './sigurnost/socket-ogranicenja.js';
import { ponistiPartijeUTijekuUBazi } from './igra/upis-partije.js';
import { ocistiIstekleNepotvrdjeneRacune } from './racuni/ciscenje-nepotvrdjenih.js';
import { nizoviPobjedaIgraca } from './baza/shema.js';

export interface PodaciSocketa {
  igracId: string;
  sesijaId?: string;
  vrsta: 'gost' | 'registriran' | 'admin';
  nadimak: string;
  avatarId: number;
  avatarConfig: AvatarConfigV1 | null;
  avatarRevision: number;
  odigrane: number;
  pobjede: number;
  bodoviUkupno: number;
  odigrane1v1: number;
  pobjede1v1: number;
  bodovi1v1: number;
  iskustvoUkupno: number;
  emailPotvrdjen: boolean;
  trenutniNiz4p: number;
  trenutniNiz1v1: number;
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
  zaustavi: () => Promise<void>;
}

export interface OpcijePosluzitelja {
  postavkeMotora?: PostavkeMotoraPartije;
  okruzenjeSigurnosti?: Okruzenje;
  authRateLimit?: Partial<OpcijeAuthRateLimita>;
  socketOgranicenja?: Partial<PostavkeSocketOgranicenja>;
}

/** Izgrađuje Fastify + Socket.IO instancu (bez pokretanja listen-a) - koristi ga i index.ts i testovi. */
export async function izgradiPosluzitelj(opcije: OpcijePosluzitelja = {}): Promise<Posluzitelj> {
  const okruzenjeSigurnosti = opcije.okruzenjeSigurnosti ?? konfiguracija.NODE_ENV;
  const javnaAdresaOrigin = new URL(konfiguracija.JAVNA_ADRESA).origin;
  const authRateLimit: OpcijeAuthRateLimita = {
    omogucen: okruzenjeSigurnosti === 'staging' || okruzenjeSigurnosti === 'production',
    ...opcije.authRateLimit,
  };
  const corsOrigin = stvoriCorsOrigin(okruzenjeSigurnosti, javnaAdresaOrigin);
  const socketOgranicenja: PostavkeSocketOgranicenja = {
    handshakePoIpMinuti: konfiguracija.SOCKET_HANDSHAKE_PO_IP_MINUTI,
    maksimalnoAktivnihVeza: konfiguracija.SOCKET_MAKSIMALNO_AKTIVNIH_VEZA,
    maksimalnoPrivatnihSoba: konfiguracija.SOCKET_MAKSIMALNO_PRIVATNIH_SOBA,
    maksimalnoAktivnihPartija: konfiguracija.SOCKET_MAKSIMALNO_AKTIVNIH_PARTIJA,
    prozorDogadajaMs: konfiguracija.SOCKET_PROZOR_DOGADAJA_MS,
    dogadajiPoProzoru: konfiguracija.SOCKET_DOGADAJI_PO_PROZORU,
    ...opcije.socketOgranicenja,
  };
  const ogranicivacHandshaka = new OgranicivacDogadaja(60_000);
  const ogranicivacHttpDokumenata = new OgranicivacDogadaja(60_000);
  const ogranicivacDogadaja = new OgranicivacDogadaja(socketOgranicenja.prozorDogadajaMs);
  const provjeriDogadaj = (igracId: string, dogadaj: string): boolean =>
    ogranicivacDogadaja.dopusti(`${igracId}:${dogadaj}`, socketOgranicenja.dogadajiPoProzoru);
  const app = Fastify({ logger: true, trustProxy: jePouzdaniProxy(okruzenjeSigurnosti) });
  await app.register(cors, { origin: corsOrigin, credentials: true });
  await app.register(cookie);
  await app.register(rateLimit, { max: 150, timeWindow: '1 minute' });
  let opozoviSocketSesije: (sesijaId: string) => void = () => {};
  const rjecnik = await ucitajRjecnik();
  app.log.info(`Rječnik učitan: ${rjecnik.brojRijeci()} riječi`);

  await app.register(
    async (apiApp) => {
      await registrirajRacuneRute(apiApp, authRateLimit, {
        naSesijaOpozvana: (sesijaId) => opozoviSocketSesije(sesijaId),
      });
      await registrirajProfilRute(apiApp, rjecnik);
      await registrirajPrijaveRute(apiApp);
      await registrirajPovratneInformacijeRute(apiApp);
      await registrirajAdminRute(apiApp, rjecnik);
      await registrirajRjecnikRute(apiApp, rjecnik);
    },
    { prefix: '/api' },
  );
  registrirajStariLinkPotvrdeEmaila(app);

  app.route({
    method: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    url: '/api',
    handler: async (_zahtjev, odgovor) => odgovor.code(404).send({ ok: false, greska: 'API ruta ne postoji.' }),
  });
  app.route({
    method: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    url: '/api/*',
    handler: async (_zahtjev, odgovor) => odgovor.code(404).send({ ok: false, greska: 'API ruta ne postoji.' }),
  });

  if (konfiguracija.NODE_ENV === 'staging' || konfiguracija.NODE_ENV === 'production' || konfiguracija.POSLUZUJ_WEB === 'true') {
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

    app.get('/zvukovi/*', { config: { rateLimit: false } }, async (zahtjev, odgovor) => {
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
      config: { rateLimit: false },
      handler: async (zahtjev, odgovor) => {
        const prihvat = zahtjev.headers.accept;
        const traziDokument = typeof prihvat === 'string' && prihvat.includes('text/html');
        if (traziDokument) {
          const proslijedeniIp = zahtjev.headers['x-forwarded-for'];
          const ip = (Array.isArray(proslijedeniIp) ? proslijedeniIp[0] : proslijedeniIp)?.split(',')[0]?.trim()
            ?? zahtjev.socket.remoteAddress
            ?? 'nepoznat';
          const dopusten = ogranicivacHttpDokumenata.dopusti(`ip:${ip}`, konfiguracija.HTTP_DOKUMENTI_PO_IP_MINUTI);
          if (!dopusten) {
            odgovor.header('retry-after', '60');
            return odgovor.code(429).send({ ok: false, greska: 'Previše zahtjeva za stranice. Pokušaj ponovno za minutu.' });
          }
        }
        odgovor.hijack();
        await handler(zahtjev.raw, odgovor.raw);
      },
    });
  }

  const io: KaladontIo = new SocketIoServer(app.server, {
    cors: { origin: corsOrigin, credentials: true },
    allowRequest: (zahtjev, povratniPoziv) => {
      const originDopusten = jeDopustenOrigin(okruzenjeSigurnosti, zahtjev.headers.origin, javnaAdresaOrigin);
      const proslijedeniIp = zahtjev.headers['x-forwarded-for'];
      const ip = (Array.isArray(proslijedeniIp) ? proslijedeniIp[0] : proslijedeniIp)?.split(',')[0]?.trim()
        ?? zahtjev.socket.remoteAddress
        ?? 'nepoznat';
      const handshakeDopusten = ogranicivacHandshaka.dopusti(`ip:${ip}`, socketOgranicenja.handshakePoIpMinuti);
      const vezaDopustena = io.sockets.sockets.size < socketOgranicenja.maksimalnoAktivnihVeza;
      povratniPoziv(null, originDopusten && handshakeDopusten && vezaDopustena);
    },
  });

  const registarVeza = new RegistarVeza();
  const igracMozeIgrati = (socket: KaladontSocket): boolean =>
    socket.data.vrsta === 'gost' || socket.data.emailPotvrdjen;

  opozoviSocketSesije = (sesijaId) => {
    for (const socket of io.sockets.sockets.values()) {
      if (socket.data.sesijaId === sesijaId) {
        socket.emit('veza:zatvorena', { kod: 'SESIJA_ISTEKLA', poruka: 'Sesija je istekla ili je opozvana.' });
        socket.disconnect(true);
      }
    }
  };

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
    {
      ...opcije.postavkeMotora,
      maksimalnoAktivnihPartija: socketOgranicenja.maksimalnoAktivnihPartija,
      provjeriDogadaj,
      naPartijaZavrsila: (partijaId) => {
        sobaServis?.naPartijaZavrsila(partijaId);
      },
      naPrivatnaPartijaZavrsila: (kodSobe, partijaId, pobjednikId, rezultati) => {
        sobaServis?.registrirajRezultatPartije(kodSobe, partijaId, pobjednikId, rezultati);
      },
    },
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
    const memorija = process.memoryUsage();
    const tijelo = {
      ok: spreman,
      baza: bazaDostupna ? 'dostupna' : 'nedostupna',
      brojRijeci,
      aktivnePartije: upravitelj.brojAktivnihPartija(),
      aktivneVeze: io.sockets.sockets.size,
      rssBajtovi: memorija.rss,
      heapUsedBajtovi: memorija.heapUsed,
      heapTotalBajtovi: memorija.heapTotal,
      uptimeSekunde: Math.floor(process.uptime()),
      verzija: konfiguracija.VERZIJA,
      digest: konfiguracija.DIGEST,
    };

    return odgovor.code(spreman ? 200 : 503).send(tijelo);
  });

  await app.ready();

  await osvjeziProsjekCekanja();
  void ocistiIstekleNepotvrdjeneRacune().then((broj) => {
    if (broj > 0) app.log.info({ broj }, 'Obrisani su istekli nepotvrđeni računi');
  }).catch((greska) => app.log.error({ greska }, 'Čišćenje nepotvrđenih računa nije uspjelo'));
  const cistacNepotvrdjenih = setInterval(() => {
    void ocistiIstekleNepotvrdjeneRacune().catch((greska) => app.log.error({ greska }, 'Čišćenje nepotvrđenih računa nije uspjelo'));
  }, 24 * 60 * 60 * 1000);
  cistacNepotvrdjenih.unref();

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!jeValjaniToken(token)) {
      const pogreska = new Error('Nevaljan token') as Error & { data?: { kod: KodRazlogaVeze } };
      pogreska.data = { kod: 'NEVALJAN_TOKEN' };
      next(pogreska);
      return;
    }
    try {
      const identitet = await razrijesiIdentitet(token);
      socket.data.igracId = identitet.igracId;
      socket.data.sesijaId = identitet.sesijaId;
      socket.data.vrsta = identitet.vrsta;
      socket.data.nadimak = identitet.nadimak;
      socket.data.avatarId = identitet.avatarId;
      socket.data.avatarConfig = identitet.avatarConfig;
      socket.data.avatarRevision = identitet.avatarRevision;
      socket.data.odigrane = identitet.odigrane;
      socket.data.pobjede = identitet.pobjede;
      socket.data.bodoviUkupno = identitet.bodoviUkupno;
      socket.data.odigrane1v1 = identitet.odigrane1v1;
      socket.data.pobjede1v1 = identitet.pobjede1v1;
      socket.data.bodovi1v1 = identitet.bodovi1v1;
      socket.data.iskustvoUkupno = identitet.iskustvoUkupno;
      socket.data.emailPotvrdjen = identitet.emailPotvrdjen;
      const nizovi = await baza.select({ mod: nizoviPobjedaIgraca.mod, trenutniNiz: nizoviPobjedaIgraca.trenutniNiz })
        .from(nizoviPobjedaIgraca).where(eq(nizoviPobjedaIgraca.igracId, identitet.igracId));
      socket.data.trenutniNiz4p = nizovi.find((niz) => niz.mod === 'cetiri_igraca')?.trenutniNiz ?? 0;
      socket.data.trenutniNiz1v1 = nizovi.find((niz) => niz.mod === 'dva_igraca')?.trenutniNiz ?? 0;
      next();
    } catch (greska) {
      const poruka = greska instanceof Error ? greska.message : 'Interna greška';
      const kod: KodRazlogaVeze = poruka.includes('istekao') || poruka.includes('sesija')
        ? 'SESIJA_ISTEKLA'
        : 'NEVALJAN_TOKEN';
      const pogreska = new Error(poruka) as Error & { data?: { kod: KodRazlogaVeze } };
      pogreska.data = { kod };
      next(pogreska);
    }
  });

  io.on('connection', (socket) => {
    const { igracId, nadimak } = socket.data;

    socket.on('igrac:avatar-azuriraj', (payload) => {
      if (!validirajAvatarConfig(payload?.avatarConfig) || !Number.isInteger(payload.avatarRevision)) return;
      if (payload.avatarRevision <= socket.data.avatarRevision) return;
      socket.data.avatarConfig = payload.avatarConfig;
      socket.data.avatarRevision = payload.avatarRevision;
    });

    // RS-18: jedna aktivna veza po identitetu - stara veza se odjavljuje
    const staraSocketId = registarVeza.zamijeni(igracId, socket.id);
    if (staraSocketId) {
      const staraVeza = io.sockets.sockets.get(staraSocketId);
      staraVeza?.emit('veza:zatvorena', { kod: 'DRUGA_KARTICA', poruka: 'Ova je veza zatvorena jer je isti identitet otvorio drugu karticu.' });
      staraVeza?.disconnect(true);
    }

    app.log.info(`Spojen igrač ${nadimak} (${igracId})`);

    upravitelj.registrirajHandlere(socket);

    socket.on('disconnect', () => {
      registarVeza.ukloni(igracId, socket.id);
    });
  });

  let igracImaPrivatnuSobu: (igracId: string) => boolean = () => false;
  const redServis = registrirajRedCekanja(
    io,
    async (stol, mod) => {
      await upravitelj.zapocniPartiju(stol, mod);
      void osvjeziProsjekCekanja();
    },
    upravitelj.imaAktivnuPartiju,
    (igracId) => igracImaPrivatnuSobu(igracId),
    () => upravitelj.mozePokrenutiPartiju() && upravitelj.brojAktivnihPartija() < socketOgranicenja.maksimalnoAktivnihPartija,
    igracMozeIgrati,
    provjeriDogadaj,
  );

  const sobaServis = registrirajPrivatneSobe(io, (sudionici, postavke, kodSobe) =>
    upravitelj.zapocniPrivatnuPartiju(sudionici, postavke, kodSobe),
    {
      maksimalnoSoba: socketOgranicenja.maksimalnoPrivatnihSoba,
      maksimalnoAktivnihPartija: socketOgranicenja.maksimalnoAktivnihPartija,
      brojAktivnihPartija: () => upravitelj.brojAktivnihPartija(),
      mozeStvoritiPartiju: upravitelj.mozePokrenutiPartiju,
      provjeriDogadaj,
      igracImaAktivnuPartiju: upravitelj.imaAktivnuPartiju,
      igracMozeIgrati,
      ukloniIzJavnogReda: redServis.ukloniIzReda,
    },
  );
  igracImaPrivatnuSobu = sobaServis.imaPrivatnuSobu;

  await ponistiPartijeUTijekuUBazi();

  let zatvoreno = false;
  const zaustavi = async () => {
    if (zatvoreno) return;
    zatvoreno = true;
    clearInterval(cistacNepotvrdjenih);
    await upravitelj.zaustavi();
    await new Promise<void>((resolve) => io.close(() => resolve()));
    await app.close();
  };

  return { app, io, zaustavi };
}
