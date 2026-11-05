import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { ID_DOSTIGNUCA_STALNO_SI_TU } from 'zajednicko';
import { izgradiPosluzitelj } from '../src/server.js';
import { baza } from '../src/baza/klijent.js';
import {
  aktivnostIgracaDani,
  dostignucaIgraca,
  igraci,
  nizAktivnostiIgraca,
} from '../src/baza/shema.js';
import { zabiljeziAktivniDan } from '../src/racuni/aktivnost-dana.js';
import { obrisiRacunPoId } from '../src/racuni/brisanje.js';

let app: FastifyInstance;
let adresa: string;
const emailovi: string[] = [];

beforeAll(async () => {
  ({ app } = await izgradiPosluzitelj());
  await app.listen({ port: 0, host: '127.0.0.1' });
  const podaci = app.server.address();
  adresa = `http://127.0.0.1:${typeof podaci === 'object' && podaci ? podaci.port : 0}`;
}, 60_000);

afterAll(async () => {
  if (app) await app.close();
});

afterEach(async () => {
  for (const email of emailovi.splice(0)) {
    const [igrac] = await baza.select({ id: igraci.id }).from(igraci).where(eq(igraci.email, email));
    if (!igrac) continue;
    await baza.delete(aktivnostIgracaDani).where(eq(aktivnostIgracaDani.igracId, igrac.id));
    await baza.delete(nizAktivnostiIgraca).where(eq(nizAktivnostiIgraca.igracId, igrac.id));
    await baza.delete(dostignucaIgraca).where(eq(dostignucaIgraca.igracId, igrac.id));
    await baza.delete(igraci).where(eq(igraci.id, igrac.id));
  }
});

async function registriraj(nadimak = 'Aktivni'): Promise<{ token: string; igracId: string; email: string }> {
  const email = `aktivnost-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  emailovi.push(email);
  const odgovor = await fetch(`${adresa}/api/racuni/registracija`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, lozinka: 'lozinka123', nadimak }),
  });
  expect(odgovor.status).toBe(200);
  const tijelo = (await odgovor.json()) as { sesijskiToken: string; igracId: string };
  return { token: tijelo.sesijskiToken, igracId: tijelo.igracId, email };
}

describe('POST /racuni/aktivnost-dana', () => {
  it('S05-D01/D02: prva aktivnost upisuje dan; ponavljanja su no-op', async () => {
    const { token, igracId } = await registriraj();
    const prvi = await fetch(`${adresa}/api/racuni/aktivnost-dana`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: '{}',
    });
    expect(prvi.status).toBe(200);
    const tijelo1 = (await prvi.json()) as { trenutniNiz: number; najboljiNiz: number; novootkljucanaRazina: number | null };
    expect(tijelo1.trenutniNiz).toBe(1);
    expect(tijelo1.najboljiNiz).toBe(1);
    expect(tijelo1.novootkljucanaRazina).toBeNull();

    const ponavljanja = await Promise.all(
      Array.from({ length: 20 }, () =>
        fetch(`${adresa}/api/racuni/aktivnost-dana`, {
          method: 'POST',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: '{}',
        }),
      ),
    );
    expect(ponavljanja.every((o) => o.status === 200)).toBe(true);
    const dani = await baza.select().from(aktivnostIgracaDani).where(eq(aktivnostIgracaDani.igracId, igracId));
    expect(dani).toHaveLength(1);
  });

  it('S05-D03: paralelni zahtjevi daju jedan dan', async () => {
    const { token, igracId } = await registriraj('Paralel');
    const odgovori = await Promise.all(
      Array.from({ length: 8 }, () =>
        fetch(`${adresa}/api/racuni/aktivnost-dana`, {
          method: 'POST',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: '{}',
        }),
      ),
    );
    expect(odgovori.every((o) => o.status === 200)).toBe(true);
    const dani = await baza.select().from(aktivnostIgracaDani).where(eq(aktivnostIgracaDani.igracId, igracId));
    expect(dani).toHaveLength(1);
    const tijela = await Promise.all(odgovori.map((o) => o.json() as Promise<{ trenutniNiz: number; novootkljucanaRazina: number | null }>));
    expect(tijela.every((t) => t.trenutniNiz === 1)).toBe(true);
    expect(tijela.filter((t) => t.novootkljucanaRazina !== null)).toHaveLength(0);
  });

  it('S05-D06: drugi uzastopni dan otključava razinu 1', async () => {
    const { igracId } = await registriraj('Prag');
    await zabiljeziAktivniDan(igracId, { sada: () => new Date('2026-11-01T12:00:00.000Z') });
    const drugi = await zabiljeziAktivniDan(igracId, { sada: () => new Date('2026-11-02T12:00:00.000Z') });
    expect(drugi.trenutniNiz).toBe(2);
    expect(drugi.najboljiNiz).toBe(2);
    expect(drugi.razinaDostignuca).toBe(1);
    expect(drugi.novootkljucanaRazina).toBe(1);

    const [zapis] = await baza
      .select()
      .from(dostignucaIgraca)
      .where(and(
        eq(dostignucaIgraca.igracId, igracId),
        eq(dostignucaIgraca.dostignuceId, ID_DOSTIGNUCA_STALNO_SI_TU),
      ));
    expect(zapis?.razina).toBe(1);

    const retry = await zabiljeziAktivniDan(igracId, { sada: () => new Date('2026-11-02T18:00:00.000Z') });
    expect(retry.novootkljucanaRazina).toBeNull();
  });

  it('S05-D09: gost dobiva 401', async () => {
    const gost = await fetch(`${adresa}/api/racuni/gost-sesija`, { method: 'POST' });
    const { token } = (await gost.json()) as { token: string };
    const odgovor = await fetch(`${adresa}/api/racuni/aktivnost-dana`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: '{}',
    });
    expect(odgovor.status).toBe(401);
  });

  it('S05-D11: bot s registriranim računom je odbijen', async () => {
    const { token, igracId } = await registriraj('BotRacun');
    await baza.update(igraci).set({ upravljac: 'bot' }).where(eq(igraci.id, igracId));
    const odgovor = await fetch(`${adresa}/api/racuni/aktivnost-dana`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: '{}',
    });
    expect(odgovor.status).toBe(403);
    expect(await baza.select().from(aktivnostIgracaDani).where(eq(aktivnostIgracaDani.igracId, igracId))).toHaveLength(0);
  });

  it('S05-D17: soft-delete čisti evidenciju aktivnosti', async () => {
    const { igracId } = await registriraj('Brisi');
    await zabiljeziAktivniDan(igracId, { sada: () => new Date('2026-11-01T12:00:00.000Z') });
    expect(await baza.select().from(aktivnostIgracaDani).where(eq(aktivnostIgracaDani.igracId, igracId))).toHaveLength(1);

    expect(await obrisiRacunPoId(igracId)).toBe('obrisan');
    expect(await baza.select().from(aktivnostIgracaDani).where(eq(aktivnostIgracaDani.igracId, igracId))).toHaveLength(0);
    expect(await baza.select().from(nizAktivnostiIgraca).where(eq(nizAktivnostiIgraca.igracId, igracId))).toHaveLength(0);
  });

  it('vlastiti profil uključuje aktivnostDana', async () => {
    const { token, igracId } = await registriraj('Profil');
    await zabiljeziAktivniDan(igracId, { sada: () => new Date('2026-11-03T12:00:00.000Z') });
    await zabiljeziAktivniDan(igracId, { sada: () => new Date('2026-11-04T12:00:00.000Z') });

    const odgovor = await fetch(`${adresa}/api/profil`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(odgovor.status).toBe(200);
    const tijelo = (await odgovor.json()) as {
      aktivnostDana?: { trenutniNiz: number; najboljiNiz: number };
      dostignuca: { dostignuca: { id: string; razina: number; vrijednost: number }[] };
    };
    expect(tijelo.aktivnostDana).toEqual(expect.objectContaining({ trenutniNiz: 2, najboljiNiz: 2 }));
    const stalno = tijelo.dostignuca.dostignuca.find((d) => d.id === ID_DOSTIGNUCA_STALNO_SI_TU);
    expect(stalno?.razina).toBe(1);
    expect(stalno?.vrijednost).toBe(2);
  });
});
