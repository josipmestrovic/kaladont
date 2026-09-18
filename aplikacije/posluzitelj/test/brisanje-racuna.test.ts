import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import { io as ioClient } from 'socket.io-client';
import { izgradiPosluzitelj } from '../src/server.js';
import { baza } from '../src/baza/klijent.js';
import { igraci, sesije, statistikeRijeciIgraca } from '../src/baza/shema.js';
import { izdajSesiju } from '../src/racuni/sesije.js';
import { obrisiRacun } from '../src/racuni/brisanje.js';

const EMAIL = `brisanje-${Date.now()}@example.com`;
const LOZINKA = 'lozinka123';
let app: FastifyInstance;
let adresa: string;
let igracId: string;
let sesijskiToken: string;

beforeAll(async () => {
  ({ app } = await izgradiPosluzitelj());
  await app.listen({ port: 0, host: '127.0.0.1' });
  const podaci = app.server.address();
  const port = typeof podaci === 'object' && podaci ? podaci.port : 0;
  adresa = `http://127.0.0.1:${port}`;

  const [igrac] = await baza
    .insert(igraci)
    .values({ vrsta: 'registriran', nadimak: 'Brisanje Test', email: EMAIL, lozinkaHash: LOZINKA })
    .returning({ id: igraci.id });
  igracId = igrac!.id;
  const sesija = await izdajSesiju(igracId);
  sesijskiToken = sesija.token;
  await baza.insert(statistikeRijeciIgraca).values({ igracId, mod: 'cetiri_igraca' });
});

afterAll(async () => {
  await baza.delete(igraci).where(eq(igraci.id, igracId));
  await app.close();
});

describe('ručno brisanje računa', () => {
  it('zahtijeva eksplicitnu potvrdu', async () => {
    await expect(obrisiRacun(EMAIL, false)).rejects.toThrow('Brisanje nije potvrđeno');
  });

  it('uklanja privatne podatke, zadržava neutralni zapis i odbija auth', async () => {
    const ishod = await obrisiRacun(EMAIL, true);
    expect(ishod).toBe('obrisan');

    const [igrac] = await baza.select().from(igraci).where(eq(igraci.id, igracId));
    expect(igrac?.obrisanAt).toBeInstanceOf(Date);
    expect(igrac?.nadimak).toBe('Obrisani igrač');
    expect(igrac?.email).toBeNull();
    expect(igrac?.lozinkaHash).toBeNull();
    expect(await baza.select().from(sesije).where(eq(sesije.igracId, igracId))).toHaveLength(0);
    expect(await baza.select().from(statistikeRijeciIgraca).where(eq(statistikeRijeciIgraca.igracId, igracId))).toHaveLength(0);

    const profil = await fetch(`${adresa}/api/profil`, {
      headers: { authorization: `Bearer ${sesijskiToken}` },
    });
    expect(profil.status).toBe(401);

    await expect(
      new Promise((resolve, reject) => {
        const socket = ioClient(adresa, { auth: { token: sesijskiToken }, forceNew: true, reconnection: false });
        socket.on('connect', () => reject(new Error('obrisani račun se ne smije spojiti')));
        socket.on('connect_error', (greska) => {
          socket.disconnect();
          resolve(greska);
        });
      }),
    ).resolves.toBeDefined();
  });

  it('ponovljeno brisanje je idempotentno', async () => {
    expect(await obrisiRacun(EMAIL, true)).toBe('nije-pronaden');
  });
});
