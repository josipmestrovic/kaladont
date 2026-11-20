import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import type { OdgovorKatalogaIzazova, PotvrdaIzazova } from 'zajednicko';
import { izgradiPosluzitelj, type Posluzitelj } from '../src/server.js';
import { baza } from '../src/baza/klijent.js';
import { igraci, pokusajiIzazova, zavrseciIzazova } from '../src/baza/shema.js';
import { stvoriGostSesiju } from '../src/racuni/sesije.js';
import {
  dohvatiPokusajPoId,
  izgradiOdgovorKataloga,
  ocistiStareGostIzazove,
  umetniRezerviraniPokusaj,
} from '../src/izazovi/pohrana.js';
import { rezervirajPokusajIzazova, stubPokreniPartijuIzazova } from '../src/izazovi/servis.js';
import { definicijaIzazova } from 'zajednicko';

let posluzitelj: Posluzitelj;
let adresa: string;
const igraciZaBrisanje: string[] = [];

beforeAll(async () => {
  posluzitelj = await izgradiPosluzitelj({
    socketOgranicenja: { handshakePoIpMinuti: 1_000 },
  });
  await posluzitelj.app.listen({ port: 0, host: '127.0.0.1' });
  const podaci = posluzitelj.app.server.address();
  adresa = `http://127.0.0.1:${typeof podaci === 'object' && podaci ? podaci.port : 0}`;
});

afterAll(async () => {
  await posluzitelj.zaustavi();
  for (const igracId of igraciZaBrisanje) {
    await baza.delete(zavrseciIzazova).where(eq(zavrseciIzazova.igracId, igracId));
    await baza.delete(pokusajiIzazova).where(eq(pokusajiIzazova.igracId, igracId));
    await baza.delete(igraci).where(eq(igraci.id, igracId));
  }
});

function spoji(token: string): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(adresa, { auth: { token }, forceNew: true });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', reject);
  });
}

async function noviGost(): Promise<{ igracId: string; token: string }> {
  const gost = await stvoriGostSesiju();
  igraciZaBrisanje.push(gost.igracId);
  return gost;
}

describe('Izazov PR01 — servis rezervacije', () => {
  it('flag off odbija start', async () => {
    const gost = await noviGost();
    const rezultat = await rezervirajPokusajIzazova({
      igracId: gost.igracId,
      vrsta: 'gost',
      challengeId: 'IZ01',
      requestId: randomUUID(),
      omogucen: false,
    });
    expect(rezultat.ok).toBe(false);
    if (!rezultat.ok) expect(rezultat.kod).toBe('IZAZOV_NEDOSTUPAN');
  });

  it('zaključana razina odbijena; IZ01 dostupan', async () => {
    const gost = await noviGost();
    const zakljucan = await rezervirajPokusajIzazova({
      igracId: gost.igracId,
      vrsta: 'gost',
      challengeId: 'IZ24',
      requestId: randomUUID(),
      omogucen: true,
    });
    expect(zakljucan.ok).toBe(false);
    if (!zakljucan.ok) expect(zakljucan.kod).toBe('IZAZOV_ZAKLJUCAN');

    const ok = await rezervirajPokusajIzazova({
      igracId: gost.igracId,
      vrsta: 'gost',
      challengeId: 'IZ01',
      requestId: randomUUID(),
      omogucen: true,
    });
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.pokrenut).toBe(false);
      expect(ok.pokusaj.status).toBe('tehnicki_prekinuto');
      expect(ok.pokusaj.accountTypeAtStart).toBe('gost');
    }
  });

  it('isti requestId vraća isti pokušaj; drugi requestId uz aktivan status nije moguć nakon tehnickog', async () => {
    const gost = await noviGost();
    const requestId = randomUUID();
    const prvi = await rezervirajPokusajIzazova({
      igracId: gost.igracId,
      vrsta: 'gost',
      challengeId: 'IZ01',
      requestId,
      omogucen: true,
      pokreniPartiju: async () => ({ ok: true, partijaId: randomUUID() }),
    });
    expect(prvi.ok).toBe(true);
    if (!prvi.ok) return;

    // Stub koji „uspije” ne ažurira status na u_tijeku u PR01 — simuliraj aktivni red.
    await baza.update(pokusajiIzazova).set({
      status: 'u_tijeku',
      partijaId: prvi.partijaId,
    }).where(eq(pokusajiIzazova.id, prvi.pokusaj.id));

    const ponovno = await rezervirajPokusajIzazova({
      igracId: gost.igracId,
      vrsta: 'gost',
      challengeId: 'IZ01',
      requestId,
      omogucen: true,
    });
    expect(ponovno.ok).toBe(true);
    if (ponovno.ok) expect(ponovno.pokusaj.id).toBe(prvi.pokusaj.id);

    const drugi = await rezervirajPokusajIzazova({
      igracId: gost.igracId,
      vrsta: 'gost',
      challengeId: 'IZ01',
      requestId: randomUUID(),
      omogucen: true,
    });
    expect(drugi.ok).toBe(false);
    if (!drugi.ok) expect(drugi.kod).toBe('IZAZOV_AKTIVAN');
  });

  it('bacanje u pokreniPartiju označava tehnicki_prekinuto i otključava igrača', async () => {
    const gost = await noviGost();
    const pad = await rezervirajPokusajIzazova({
      igracId: gost.igracId,
      vrsta: 'gost',
      challengeId: 'IZ01',
      requestId: randomUUID(),
      omogucen: true,
      pokreniPartiju: async () => {
        throw new Error('simulirani pad motora');
      },
    });
    expect(pad.ok).toBe(true);
    if (!pad.ok) return;
    expect(pad.pokrenut).toBe(false);
    expect(pad.pokusaj.status).toBe('tehnicki_prekinuto');

    const ponovni = await rezervirajPokusajIzazova({
      igracId: gost.igracId,
      vrsta: 'gost',
      challengeId: 'IZ01',
      requestId: randomUUID(),
      omogucen: true,
    });
    expect(ponovni.ok).toBe(true);
    if (ponovni.ok) expect(ponovni.pokusaj.status).toBe('tehnicki_prekinuto');
  });

  it('klijentski XP/profil u payloadu nije dio ugovora — server koristi katalog', async () => {
    const gost = await noviGost();
    const rezultat = await rezervirajPokusajIzazova({
      igracId: gost.igracId,
      vrsta: 'gost',
      challengeId: 'IZ01',
      requestId: randomUUID(),
      omogucen: true,
    });
    expect(rezultat.ok).toBe(true);
    if (!rezultat.ok) return;
    const snapshot = rezultat.pokusaj.snapshot as { xp: number; profileId: string; botProfileVersion: number };
    expect(snapshot.xp).toBe(definicijaIzazova('IZ01').xp);
    expect(snapshot.profileId).toBe('pocetnik');
    expect(snapshot.botProfileVersion).toBe(1);
    expect(rezultat.pokusaj.botProfileVersion).toBe(1);
  });

  it('gost vidi puni katalog; IZ24 zaključan', async () => {
    const gost = await noviGost();
    const odgovor = await izgradiOdgovorKataloga(gost.igracId, true);
    expect(odgovor.katalog).toHaveLength(24);
    const iz24 = odgovor.katalog.find((s) => s.id === 'IZ24');
    expect(iz24?.status).toBe('zakljucan');
    expect(iz24?.blockingChallengeId).toBe('IZ23');
    expect(iz24?.naziv).toBe('Završni ispit');
  });

  it('registracija istog ID-a čuva završetke', async () => {
    const gost = await noviGost();
    const pokusaj = await umetniRezerviraniPokusaj({
      igracId: gost.igracId,
      requestId: randomUUID(),
      definicija: definicijaIzazova('IZ01'),
      accountTypeAtStart: 'gost',
      seed: 'test',
    });
    await baza.update(pokusajiIzazova).set({
      status: 'uspjeh',
      terminalAt: new Date(),
      gameWon: true,
    }).where(eq(pokusajiIzazova.id, pokusaj.id));
    await baza.insert(zavrseciIzazova).values({
      igracId: gost.igracId,
      challengeId: 'IZ01',
      firstSuccessAttemptId: pokusaj.id,
      vrijeme: new Date(),
      nominalXp: 100,
      awardedXp: 100,
      rewardEpoch: 1,
    });

    await baza.update(igraci).set({
      vrsta: 'registriran',
      email: `izazov-${gost.igracId.slice(0, 8)}@test.local`,
      emailPotvrdjen: true,
      nadimak: `Igr${gost.igracId.slice(0, 6)}`,
    }).where(eq(igraci.id, gost.igracId));

    const katalog = await izgradiOdgovorKataloga(gost.igracId, true);
    expect(katalog.napredak.zavrseniChallengeIds).toContain('IZ01');
    const stavka = katalog.katalog.find((s) => s.id === 'IZ01');
    expect(stavka?.status).toBe('zavrsen');
    expect(stavka?.xpOsvojen).toBe(true);
    expect(katalog.katalog.find((s) => s.id === 'IZ02')?.status).toBe('dostupan');
  });

  it('tuđi attempt nije dostupan vlasniku drugog računa', async () => {
    const a = await noviGost();
    const b = await noviGost();
    const rezervacija = await rezervirajPokusajIzazova({
      igracId: a.igracId,
      vrsta: 'gost',
      challengeId: 'IZ01',
      requestId: randomUUID(),
      omogucen: true,
    });
    expect(rezervacija.ok).toBe(true);
    if (!rezervacija.ok) return;

    const svoj = await posluzitelj.app.inject({
      method: 'GET',
      url: `/api/izazovi/pokusaji/${rezervacija.pokusaj.id}`,
      headers: { authorization: `Bearer ${a.token}` },
    });
    expect(svoj.statusCode).toBe(200);

    const tudj = await posluzitelj.app.inject({
      method: 'GET',
      url: `/api/izazovi/pokusaji/${rezervacija.pokusaj.id}`,
      headers: { authorization: `Bearer ${b.token}` },
    });
    expect(tudj.statusCode).toBe(403);
  });

  it('GET /api/izazovi vraća katalog gostu', async () => {
    const gost = await noviGost();
    const odgovor = await posluzitelj.app.inject({
      method: 'GET',
      url: '/api/izazovi',
      headers: { authorization: `Bearer ${gost.token}` },
    });
    expect(odgovor.statusCode).toBe(200);
    const tijelo = odgovor.json<OdgovorKatalogaIzazova>();
    expect(tijelo.ok).toBe(true);
    expect(tijelo.katalog).toHaveLength(24);
    // Default env flag je false
    expect(tijelo.omogucen).toBe(false);
  });

  it('socket izazov:zapocni s flagom off vraća IZAZOV_NEDOSTUPAN', async () => {
    const gost = await noviGost();
    const socket = await spoji(gost.token);
    const ishod = await new Promise<Parameters<PotvrdaIzazova>[0]>((resolve) => {
      socket.emit('izazov:zapocni', { challengeId: 'IZ01', requestId: randomUUID() }, resolve);
    });
    socket.close();
    expect(ishod.rezerviran).toBe(false);
    if (!ishod.rezerviran) expect(ishod.kod).toBe('IZAZOV_NEDOSTUPAN');
  });

  it('stubPokreniPartijuIzazova označava motor nije spojen', async () => {
    const rezultat = await stubPokreniPartijuIzazova({
      attemptId: randomUUID(),
      igracId: randomUUID(),
      challengeId: 'IZ01',
    });
    expect(rezultat.ok).toBe(false);
  });

  it('cleanup gostujućih podataka ne briše igraci', async () => {
    const gost = await noviGost();
    const pokusaj = await umetniRezerviraniPokusaj({
      igracId: gost.igracId,
      requestId: randomUUID(),
      definicija: definicijaIzazova('IZ01'),
      accountTypeAtStart: 'gost',
      seed: 'cleanup',
    });
    const staro = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
    await baza.update(pokusajiIzazova).set({
      status: 'tehnicki_prekinuto',
      terminalAt: staro,
    }).where(eq(pokusajiIzazova.id, pokusaj.id));
    await baza.update(igraci).set({ zadnjaAktivnost: staro }).where(eq(igraci.id, gost.igracId));

    const broj = await ocistiStareGostIzazove();
    expect(broj.pokusaji).toBeGreaterThanOrEqual(1);
    const [igrac] = await baza.select().from(igraci).where(eq(igraci.id, gost.igracId)).limit(1);
    expect(igrac).toBeTruthy();
    expect(await dohvatiPokusajPoId(pokusaj.id)).toBeNull();
  });
});
