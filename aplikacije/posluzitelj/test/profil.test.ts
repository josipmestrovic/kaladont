import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { eq, inArray } from 'drizzle-orm';
import { validirajAvatarConfig, ZADANI_AVATAR_CONFIG, type AvatarConfigV1 } from 'zajednicko';
import { izgradiPosluzitelj } from '../src/server.js';
import { baza } from '../src/baza/klijent.js';
import { botovi, dnkStatistikeIgraca, igraci, obracuniPartija, osobniRekordiIgraca, partije, potezi, statistikeRijeciIgraca, sudioniciPartije } from '../src/baza/shema.js';
import { zakljuciPartijuUBazi } from '../src/igra/upis-partije.js';
import { ocistiMemorijuTopRijeci } from '../src/profil/rute.js';
import { hashAvataraConfig } from '../src/avatar/hash.js';
import { konfiguracija } from '../src/konfiguracija.js';

let app: FastifyInstance;
let adresa: string;

const NASUMICNI_SUFIKS = Array.from({ length: 6 }, () =>
  String.fromCharCode(97 + Math.floor(Math.random() * 26)),
).join('');
const EMAIL = `profil-${NASUMICNI_SUFIKS}@example.com`;
const LOZINKA = 'lozinka123';

beforeAll(async () => {
  ({ app } = await izgradiPosluzitelj());
  await app.listen({ port: 0, host: '127.0.0.1' });
  const podaci = app.server.address();
  const port = typeof podaci === 'object' && podaci ? podaci.port : 0;
  adresa = `http://127.0.0.1:${port}`;
});

afterEach(async () => {
  const [igrac] = await baza.select({ id: igraci.id }).from(igraci).where(eq(igraci.email, EMAIL));
  if (igrac) {
    await baza.delete(sudioniciPartije).where(eq(sudioniciPartije.igracId, igrac.id));
    await baza.delete(partije).where(eq(partije.pobjednikId, igrac.id));
    await baza.delete(dnkStatistikeIgraca).where(eq(dnkStatistikeIgraca.igracId, igrac.id));
    await baza.delete(statistikeRijeciIgraca).where(eq(statistikeRijeciIgraca.igracId, igrac.id));
    await baza.delete(osobniRekordiIgraca).where(eq(osobniRekordiIgraca.igracId, igrac.id));
  }
  await baza.delete(igraci).where(eq(igraci.email, EMAIL));
});

afterAll(async () => {
  await app.close();
});

/** Umeće gost-zapis izravno u bazu (bez Socket.IO handshakea) za testiranje REST ruta. */
async function stvoriGosta(): Promise<{ token: string; id: string }> {
  const odgovor = await fetch(`${adresa}/api/racuni/gost-sesija`, { method: 'POST' });
  const podaci = (await odgovor.json()) as { token: string; igracId: string };
  return { token: podaci.token, id: podaci.igracId };
}

describe('GET /profil', () => {
  it('odbija neprijavljeni zahtjev', async () => {
    const odgovor = await fetch(`${adresa}/api/profil`);
    expect(odgovor.status).toBe(401);
  });

  it('vraća vlastite agregate i rang za prijavljenog korisnika', async () => {
    const registracija = await fetch(`${adresa}/api/racuni/registracija`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, lozinka: LOZINKA, potvrdaDob16: true, prihvacamUvjete: true }),
    });
    const { sesijskiToken, igracId } = (await registracija.json()) as { sesijskiToken: string; igracId: string };

    const odgovor = await fetch(`${adresa}/api/profil`, {
      headers: { authorization: `Bearer ${sesijskiToken}` },
    });
    expect(odgovor.status).toBe(200);
    const tijelo = (await odgovor.json()) as {
      ok: boolean;
      rang: string;
      odigrane: number;
      email?: string;
      iskustvo: { razina: number; ukupno: number; uRazini: number; doIduce: number | null };
      osobniRekordi: {
        najboljiNizPobjeda: number;
        nizPrihvacenihRijeci: number;
        najduzaRijec: string | null;
        najduzaRijecGrafemi: number;
        najbrziPrihvaceniPotezMs: number | null;
      };
      napredakIzazova: {
        trenutniLevel: number;
        zavrseniIzazovi: number;
        zvjezdice: number;
        napredakDoSljedeceg: { zavrseno: number; ukupno: number } | null;
      };
    };
    expect(tijelo.ok).toBe(true);
    expect(tijelo.odigrane).toBe(0);
    expect(tijelo.rang).toBe('Piskaralo');
    expect(tijelo.iskustvo).toEqual({ razina: 1, ukupno: 0, uRazini: 0, doIduce: 100 });
    expect(tijelo.osobniRekordi).toEqual({
      najboljiNizPobjeda: 0,
      nizPrihvacenihRijeci: 0,
      najduzaRijec: null,
      najduzaRijecGrafemi: 0,
      najbrziPrihvaceniPotezMs: null,
    });
    expect(tijelo.napredakIzazova.trenutniLevel).toBe(1);
    expect(tijelo.napredakIzazova.zavrseniIzazovi).toBe(0);
    expect(tijelo.napredakIzazova.zvjezdice).toBe(0);

    const nedavno = await fetch(`${adresa}/api/profil/kolekcija/nedavno`, {
      headers: { authorization: `Bearer ${sesijskiToken}` },
    });
    expect(nedavno.status).toBe(200);
    const nedavnoTijelo = (await nedavno.json()) as { ok: boolean; rijeci: unknown[] };
    expect(nedavnoTijelo.ok).toBe(true);
    expect(nedavnoTijelo.rijeci).toEqual([]);

    const javni = await fetch(`${adresa}/api/profil/javni/${igracId}`);
    expect(javni.status).toBe(200);
    const javniTijelo = (await javni.json()) as {
      ok: boolean;
      email?: string;
      osobniRekordi?: unknown;
      napredakIzazova?: { zavrseniIzazovi: number };
      aktivniPokusaj?: unknown;
    };
    expect(javniTijelo.ok).toBe(true);
    expect(javniTijelo.email).toBeUndefined();
    expect(javniTijelo.osobniRekordi).toBeTruthy();
    expect(javniTijelo.napredakIzazova?.zavrseniIzazovi).toBe(0);
    expect(javniTijelo.aktivniPokusaj).toBeUndefined();
  });

  it('klasificira stil prema eliminacijama po partiji u oba načina', async () => {
    const registracija = await fetch(`${adresa}/api/racuni/registracija`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, lozinka: LOZINKA, potvrdaDob16: true, prihvacamUvjete: true }),
    });
    const { igracId, sesijskiToken } = (await registracija.json()) as { igracId: string; sesijskiToken: string };

    const slucajevi = [
      { odigrane: 0, eliminacijeUkupno: 0, odigrane1v1: 0, eliminacije1v1: 0, stil: 'neodređen' },
      { odigrane: 4, eliminacijeUkupno: 1, odigrane1v1: 1, eliminacije1v1: 0, stil: 'uravnotežen' },
      { odigrane: 4, eliminacijeUkupno: 3, odigrane1v1: 1, eliminacije1v1: 1, stil: 'uravnotežen' },
      { odigrane: 4, eliminacijeUkupno: 4, odigrane1v1: 2, eliminacije1v1: 1, stil: 'agresivan' },
      { odigrane: 5, eliminacijeUkupno: 0, odigrane1v1: 1, eliminacije1v1: 1, stil: 'dobrica' },
    ] as const;

    for (const slucaj of slucajevi) {
      await baza.update(igraci).set({
        odigrane: slucaj.odigrane,
        eliminacijeUkupno: slucaj.eliminacijeUkupno,
        odigrane1v1: slucaj.odigrane1v1,
        eliminacije1v1: slucaj.eliminacije1v1,
      }).where(eq(igraci.id, igracId));

      const odgovor = await fetch(`${adresa}/api/profil`, {
        headers: { authorization: `Bearer ${sesijskiToken}` },
      });
      const tijelo = (await odgovor.json()) as { stilIgre: string };
      expect(tijelo.stilIgre).toBe(slucaj.stil);
    }
  });

  it('dopušta pregled aktivnosti samo administratoru', async () => {
    const registracija = await fetch(`${adresa}/api/racuni/registracija`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, lozinka: LOZINKA, potvrdaDob16: true, prihvacamUvjete: true }),
    });
    const { igracId, sesijskiToken } = (await registracija.json()) as { igracId: string; sesijskiToken: string };
    const headers = { authorization: `Bearer ${sesijskiToken}` };

    const javniProfil = await fetch(`${adresa}/api/profil/javni/${igracId}`, { headers });
    expect((await javniProfil.json()).mozeVidjetiAktivnost).toBe(false);
    expect((await fetch(`${adresa}/api/aktivnost/${igracId}`, { headers })).status).toBe(403);
    expect((await fetch(`${adresa}/api/povijest/${igracId}`, { headers })).status).toBe(403);

    await baza.update(igraci).set({ vrsta: 'admin' }).where(eq(igraci.id, igracId));

    const javniProfilAdmina = await fetch(`${adresa}/api/profil/javni/${igracId}`, { headers });
    expect((await javniProfilAdmina.json()).mozeVidjetiAktivnost).toBe(true);
    expect((await fetch(`${adresa}/api/aktivnost/${igracId}`, { headers })).status).toBe(200);
    expect((await fetch(`${adresa}/api/povijest/${igracId}`, { headers })).status).toBe(200);
  });

});

describe('GET /aktivnost i /povijest', () => {
  it('dopušta pregled aktivnosti samo administratoru', async () => {
    const registracija = await fetch(`${adresa}/api/racuni/registracija`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, lozinka: LOZINKA, potvrdaDob16: true, prihvacamUvjete: true }),
    });
    const { igracId, sesijskiToken } = (await registracija.json()) as { igracId: string; sesijskiToken: string };
    const headers = { authorization: `Bearer ${sesijskiToken}` };

    expect((await fetch(`${adresa}/api/aktivnost/${igracId}`)).status).toBe(401);
    expect((await fetch(`${adresa}/api/povijest/${igracId}`)).status).toBe(401);

    const javniProfil = await fetch(`${adresa}/api/profil/javni/${igracId}`, { headers });
    expect((await javniProfil.json()).mozeVidjetiAktivnost).toBe(false);
    expect((await fetch(`${adresa}/api/aktivnost/${igracId}`, { headers })).status).toBe(403);
    expect((await fetch(`${adresa}/api/povijest/${igracId}`, { headers })).status).toBe(403);

    await baza.update(igraci).set({ vrsta: 'admin' }).where(eq(igraci.id, igracId));

    const javniProfilAdmina = await fetch(`${adresa}/api/profil/javni/${igracId}`, { headers });
    expect((await javniProfilAdmina.json()).mozeVidjetiAktivnost).toBe(true);
    const aktivnost = await fetch(`${adresa}/api/aktivnost/${igracId}`, { headers });
    const povijest = await fetch(`${adresa}/api/povijest/${igracId}`, { headers });
    expect(aktivnost.status).toBe(200);
    expect(povijest.status).toBe(200);
    expect((await aktivnost.json()).aktivnost).toEqual([]);
    expect((await povijest.json()).partije).toEqual([]);
  });
});

describe('GET /ljestvica', () => {
  it('vraća listu (javno, bez prijave)', async () => {
    const odgovor = await fetch(`${adresa}/api/ljestvica`);
    expect(odgovor.status).toBe(200);
    const tijelo = (await odgovor.json()) as { ok: boolean; ljestvica: unknown[] };
    expect(tijelo.ok).toBe(true);
    expect(Array.isArray(tijelo.ljestvica)).toBe(true);
  });

  it('prikazuje univerzalni rang na legacy ljestvici (PR09)', async () => {
    const registracija = await fetch(`${adresa}/api/racuni/registracija`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, lozinka: LOZINKA, potvrdaDob16: true, prihvacamUvjete: true }),
    });
    const { igracId, sesijskiToken } = (await registracija.json()) as { igracId: string; sesijskiToken: string };
    // PR11 legacy min = 5; formatni brojači kvalifikuju za listu; naslovni rang = univerzalni agregat.
    // Učinak 178 × 10 partija × 2520 jedinica = prag Kaladonta.
    await baza
      .update(igraci)
      .set({
        odigrane1v1: 5,
        bodovi1v1: 5,
        rangBrojPartija: 10,
        rangSumaJedinica: 178 * 10 * 2520,
      })
      .where(eq(igraci.id, igracId));

    const odgovor = await fetch(`${adresa}/api/ljestvica?mod=dva_igraca&limit=100`, {
      headers: { authorization: `Bearer ${sesijskiToken}` },
    });
    const tijelo = (await odgovor.json()) as {
      mojeMjesto: { rang: string } | null;
      ljestvica: { igracId: string; rang: string }[];
    };

    expect(odgovor.status).toBe(200);
    expect(tijelo.ljestvica.find((redak) => redak.igracId === igracId)?.rang).toBe('Kaladont');
    expect(tijelo.mojeMjesto?.rang).toBe('Kaladont');
  });

  it('zadržava isti DNK u završnom rezultatu i nakon ponovnog učitavanja profila', async () => {
    const registracija = await fetch(`${adresa}/api/racuni/registracija`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, lozinka: LOZINKA, potvrdaDob16: true, prihvacamUvjete: true }),
    });
    const { igracId, sesijskiToken } = (await registracija.json()) as { igracId: string; sesijskiToken: string };
    const partijaId = randomUUID();
    await baza.insert(partije).values({ id: partijaId, mod: 'cetiri_igraca', status: 'u_tijeku' });
    await baza.insert(sudioniciPartije).values({ partijaId, igracId, sjedalo: 0 });

    const agregati = await zakljuciPartijuUBazi(
      partijaId,
      igracId,
      [{ igracId, plasman: 1, bodovi: 3, eliminacije: 0, iskustvo: 0, nacinIspadanja: 'pobjednik' }],
      'cetiri_igraca',
      new Map([[igracId, {
        igracId,
        grupe: [],
        otkljucaneRijeci: [],
        prihvaceniPotezi: 3,
        ukupnoTrajanjePrihvaceniPoteziMs: 3_000,
        najduziStreak: 3,
        otkriveneJakoRijetkeGrupe: 1,
        otkriveneSrednjeRijetkeGrupe: 0,
        otkriveneRijetkeGrupe: 0,
        upisaneDugeRijeci: 1,
        upisaneSrednjeDugeRijeci: 0,
        upisaneJakoDugeRijeci: 0,
        najduzaRijec: null,
        najduzaRijecGrafemi: 0,
        najrjedaRijec: null,
        najrjedaRijecFrekvencija: null,
        najrjedaTier: null,
      }]]),
      false,
      new Map(),
    );
    const dnkNakonPartije = agregati.get(igracId)?.dnkPoslije;

    const odgovor = await fetch(`${adresa}/api/profil`, {
      headers: { authorization: `Bearer ${sesijskiToken}` },
    });
    const tijelo = (await odgovor.json()) as {
      dnk: { osi: unknown[]; odigrano: number };
      odigraneJavne?: number;
      formati?: { cetiri_igraca: { odigrane: number }; dva_igraca: { odigrane: number }; tri_igraca: { odigrane: number } };
    };

    expect(odgovor.status).toBe(200);
    expect(dnkNakonPartije).toBeDefined();
    // PR10: jedan zajednički dnk; osi s API-ja === dnkPoslije nakon partije.
    expect(tijelo.dnk.osi).toEqual(dnkNakonPartije);
    expect(tijelo.odigraneJavne).toBe(tijelo.dnk.odigrano);
    expect(tijelo.formati?.cetiri_igraca.odigrane).toBeGreaterThanOrEqual(1);
  });
});

describe('GET /aktivnost/:igracId i /partije/:partijaId/plasmani', () => {
  it('vraća javni plasman, filtrira mod i izuzima privatnu gamifikaciju', async () => {
    const registracija = await fetch(`${adresa}/api/racuni/registracija`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, lozinka: LOZINKA, potvrdaDob16: true, prihvacamUvjete: true }),
    });
    const { igracId, sesijskiToken } = (await registracija.json()) as { igracId: string; sesijskiToken: string };
    await baza.update(igraci).set({ vrsta: 'admin' }).where(eq(igraci.id, igracId));
    const javnaPartijaId = randomUUID();
    const privatnaPartijaId = randomUUID();
    const kraj = new Date();
    await baza.insert(partije).values([
      { id: javnaPartijaId, mod: 'dva_igraca', pravila: 'klasicni', status: 'zavrsena', pocetak: new Date(kraj.getTime() - 1_000), kraj, pobjednikId: igracId },
      { id: privatnaPartijaId, mod: 'cetiri_igraca', status: 'zavrsena', pocetak: new Date(kraj.getTime() - 2_000), kraj, pobjednikId: igracId },
    ]);
    await baza.insert(sudioniciPartije).values([
      { partijaId: javnaPartijaId, igracId, nadimak: 'Povijesni Nadimak', sjedalo: 0, plasman: 1, bodovi: 2, eliminacije: 0, nacinIspadanja: 'pobjednik' },
      { partijaId: privatnaPartijaId, igracId, nadimak: 'Povijesni Nadimak', sjedalo: 0, plasman: 1, bodovi: 2, eliminacije: 0, nacinIspadanja: 'pobjednik' },
    ]);
    await baza.insert(obracuniPartija).values({ partijaId: privatnaPartijaId, vrsta: 'privatna_gamifikacija' });

    const aktivnostOdgovor = await fetch(`${adresa}/api/aktivnost/${igracId}?mod=dva_igraca&limit=20`, {
      headers: { authorization: `Bearer ${sesijskiToken}` },
    });
    const aktivnost = (await aktivnostOdgovor.json()) as { aktivnost: { partijaId: string; mod: string; plasman: number }[] };
    expect(aktivnostOdgovor.status).toBe(200);
    expect(aktivnost.aktivnost).toEqual(expect.arrayContaining([expect.objectContaining({ partijaId: javnaPartijaId, mod: 'dva_igraca', plasman: 1 })]));
    expect(aktivnost.aktivnost.some((stavka) => stavka.partijaId === privatnaPartijaId)).toBe(false);

    const arhivaOdgovor = await fetch(`${adresa}/api/partije/${javnaPartijaId}/plasmani`);
    const arhiva = (await arhivaOdgovor.json()) as { partija: { pravila: string; plasmani: { igracId: string; nadimak: string; plasman: number; bodovi: number }[] } };
    expect(arhivaOdgovor.status).toBe(200);
    expect(arhiva.partija.pravila).toBe('klasicni');
    expect(arhiva.partija.plasmani).toEqual([{ igracId, nadimak: 'Povijesni Nadimak', plasman: 1, bodovi: 2, eliminacije: 0, nacinIspadanja: 'pobjednik', javniProfil: true, jeBot: false }]);
  });

  it('vraća pravila za sva tri pravilnika', async () => {
    const registracija = await fetch(`${adresa}/api/racuni/registracija`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, lozinka: LOZINKA, potvrdaDob16: true, prihvacamUvjete: true }),
    });
    const { igracId } = (await registracija.json()) as { igracId: string };
    const kraj = new Date();
    const pravilnici = ['klasicni', 'ka_zna', 'dokazi_nastavak'] as const;
    const partijaIds = Object.fromEntries(pravilnici.map((p) => [p, randomUUID()])) as Record<(typeof pravilnici)[number], string>;

    await baza.insert(partije).values(
      pravilnici.map((pravila, i) => ({
        id: partijaIds[pravila],
        mod: 'dva_igraca' as const,
        pravila,
        status: 'zavrsena' as const,
        pocetak: new Date(kraj.getTime() - (i + 1) * 1_000),
        kraj,
        pobjednikId: igracId,
      })),
    );
    await baza.insert(sudioniciPartije).values(
      pravilnici.map((pravila) => ({
        partijaId: partijaIds[pravila],
        igracId,
        nadimak: 'Arhiva Pravilnik',
        sjedalo: 0,
        plasman: 1,
        bodovi: 2,
        eliminacije: 0,
        nacinIspadanja: 'pobjednik' as const,
      })),
    );

    for (const pravila of pravilnici) {
      const odgovor = await fetch(`${adresa}/api/partije/${partijaIds[pravila]}/plasmani`);
      const tijelo = (await odgovor.json()) as { partija: { pravila: string } };
      expect(odgovor.status).toBe(200);
      expect(tijelo.partija.pravila).toBe(pravila);
    }
  });
});

describe('GET /partije/:partijaId/potezi', () => {
  it('vraća paginirani oblik i metapodatke za nepostojeću partiju', async () => {
    const odgovor = await fetch(`${adresa}/api/partije/${randomUUID()}/potezi?limit=9999`);
    expect(odgovor.status).toBe(200);
    const tijelo = (await odgovor.json()) as {
      potezi: unknown[];
      limit: number;
      imaJos: boolean;
    };
    expect(tijelo.potezi).toEqual([]);
    expect(tijelo.limit).toBe(500);
    expect(tijelo.imaJos).toBe(false);
  });

  it('smjer=desc vraća najnovije prvo i cursor za starije stranice', async () => {
    const gost = await stvoriGosta();
    const partijaId = randomUUID();
    try {
      await baza.insert(partije).values({ id: partijaId, mod: 'dva_igraca', status: 'u_tijeku' });
      await baza.insert(sudioniciPartije).values({ partijaId, igracId: gost.id, sjedalo: 0 });
      await baza.insert(potezi).values(
        Array.from({ length: 5 }, (_, indeks) => ({
          partijaId,
          runda: 1,
          redniBroj: indeks + 1,
          igracId: gost.id,
          vrsta: 'rijec' as const,
          rijec: `desc${indeks + 1}`,
          trazenaSlova: 'de',
          trajanjeMs: 100,
        })),
      );

      const prva = await fetch(`${adresa}/api/partije/${partijaId}/potezi?limit=2&smjer=desc`);
      expect(prva.status).toBe(200);
      const tijelo1 = (await prva.json()) as {
        potezi: { redniBroj: number; rijec: string | null }[];
        imaJos: boolean;
        sljedeciCursor: string | null;
      };
      expect(tijelo1.potezi.map((potez) => potez.rijec)).toEqual(['desc5', 'desc4']);
      expect(tijelo1.imaJos).toBe(true);
      expect(tijelo1.sljedeciCursor).toBeTruthy();

      const druga = await fetch(
        `${adresa}/api/partije/${partijaId}/potezi?limit=2&smjer=desc&cursor=${encodeURIComponent(tijelo1.sljedeciCursor!)}`,
      );
      expect(druga.status).toBe(200);
      const tijelo2 = (await druga.json()) as {
        potezi: { rijec: string | null }[];
        imaJos: boolean;
      };
      expect(tijelo2.potezi.map((potez) => potez.rijec)).toEqual(['desc3', 'desc2']);
      expect(tijelo2.imaJos).toBe(true);
    } finally {
      await baza.delete(potezi).where(eq(potezi.partijaId, partijaId));
      await baza.delete(sudioniciPartije).where(eq(sudioniciPartije.partijaId, partijaId));
      await baza.delete(partije).where(eq(partije.id, partijaId));
      await baza.delete(igraci).where(eq(igraci.id, gost.id));
    }
  });
});

describe('PUT /profil/avatar', () => {
  it('odbija neidentificirani zahtjev', async () => {
    const odgovor = await fetch(`${adresa}/api/profil/avatar`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ avatarId: 1 }),
    });
    expect(odgovor.status).toBe(401);
  });

  it('odbija gostu uređivanje avatara', async () => {
    const gost = await stvoriGosta();
    try {
      const odgovor = await fetch(`${adresa}/api/profil/avatar`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${gost.token}` },
        body: JSON.stringify({ avatarConfig: ZADANI_AVATAR_CONFIG }),
      });
      expect(odgovor.status).toBe(401);
    } finally {
      await baza.delete(igraci).where(eq(igraci.id, gost.id));
    }
  });

  it('gost sesija odmah ima zadani avatarConfig', async () => {
    const gost = await stvoriGosta();
    try {
      const odgovor = await fetch(`${adresa}/api/profil`, {
        headers: { authorization: `Bearer ${gost.token}` },
      });
      expect(odgovor.status).toBe(200);
      const tijelo = (await odgovor.json()) as { avatarConfig: unknown };
      expect(validirajAvatarConfig(tijelo.avatarConfig)).toBe(true);
      expect(tijelo.avatarConfig).toEqual(ZADANI_AVATAR_CONFIG);
    } finally {
      await baza.delete(igraci).where(eq(igraci.id, gost.id));
    }
  });

  it('dopušta registriranom spremanje konfiguracije avatara', async () => {
    const registracija = await fetch(`${adresa}/api/racuni/registracija`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, lozinka: LOZINKA, potvrdaDob16: true, prihvacamUvjete: true }),
    });
    const { sesijskiToken } = (await registracija.json()) as { sesijskiToken: string };

    const odgovor = await fetch(`${adresa}/api/profil/avatar`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${sesijskiToken}` },
      body: JSON.stringify({ avatarConfig: ZADANI_AVATAR_CONFIG }),
    });
    expect(odgovor.status).toBe(200);
    const tijelo = (await odgovor.json()) as { ok: boolean; avatarConfig: unknown; avatarSlikaHash: string | null };
    expect(tijelo.ok).toBe(true);
    expect(validirajAvatarConfig(tijelo.avatarConfig)).toBe(true);
    expect(tijelo.avatarSlikaHash).toMatch(/^[a-f0-9]{64}$/);
    const slika = await fetch(`${adresa}/avatari/g/${tijelo.avatarSlikaHash}/64.webp`);
    expect(slika.status).toBe(200);
    expect(slika.headers.get('content-type')).toContain('image/webp');
    expect(slika.headers.get('cache-control')).toContain('immutable');
    const kriva = await fetch(`${adresa}/avatari/g/${'a'.repeat(64)}/999.webp`);
    expect(kriva.status).toBe(404);
  });

  it('postojećem korisniku s avatarConfig u bazi osigurava WebP na GET /profil', async () => {
    const registracija = await fetch(`${adresa}/api/racuni/registracija`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, lozinka: LOZINKA, potvrdaDob16: true, prihvacamUvjete: true }),
    });
    const { sesijskiToken, igracId } = (await registracija.json()) as { sesijskiToken: string; igracId: string };

    const postojećiConfig: AvatarConfigV1 = {
      ...ZADANI_AVATAR_CONFIG,
      colors: { ...ZADANI_AVATAR_CONFIG.colors, skin: '#F1B28D' },
    };
    const hash = hashAvataraConfig(postojećiConfig);
    await rm(path.join(konfiguracija.AVATARI_GENERIRANI_DIR, hash), { recursive: true, force: true });
    await baza.update(igraci).set({ avatarConfig: postojećiConfig }).where(eq(igraci.id, igracId));

    const profil = await fetch(`${adresa}/api/profil`, {
      headers: { authorization: `Bearer ${sesijskiToken}` },
    });
    expect(profil.status).toBe(200);
    const tijelo = (await profil.json()) as { avatarSlikaHash: string | null };
    expect(tijelo.avatarSlikaHash).toBe(hash);

    const slika = await fetch(`${adresa}/avatari/g/${hash}/128.webp`);
    expect(slika.status).toBe(200);
    expect(slika.headers.get('content-type')).toContain('image/webp');
    expect(slika.headers.get('cache-control')).toContain('immutable');
    const bajtovi = Buffer.from(await slika.arrayBuffer());
    expect(bajtovi.subarray(0, 4).toString('ascii')).toBe('RIFF');
    expect(bajtovi.subarray(8, 12).toString('ascii')).toBe('WEBP');
  });

  it('promjena avatara daje novi hash i WebP', async () => {
    const registracija = await fetch(`${adresa}/api/racuni/registracija`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, lozinka: LOZINKA, potvrdaDob16: true, prihvacamUvjete: true }),
    });
    const { sesijskiToken } = (await registracija.json()) as { sesijskiToken: string };

    const prvi: AvatarConfigV1 = {
      ...ZADANI_AVATAR_CONFIG,
      colors: { ...ZADANI_AVATAR_CONFIG.colors, hair: '#B97945' },
    };
    const drugi: AvatarConfigV1 = {
      ...ZADANI_AVATAR_CONFIG,
      colors: { ...ZADANI_AVATAR_CONFIG.colors, hair: '#E77979' },
    };

    const spremi = async (avatarConfig: AvatarConfigV1) => {
      const odgovor = await fetch(`${adresa}/api/profil/avatar`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${sesijskiToken}` },
        body: JSON.stringify({ avatarConfig }),
      });
      expect(odgovor.status).toBe(200);
      return (await odgovor.json()) as { avatarSlikaHash: string };
    };

    const prviOdgovor = await spremi(prvi);
    const drugiOdgovor = await spremi(drugi);
    expect(prviOdgovor.avatarSlikaHash).toMatch(/^[a-f0-9]{64}$/);
    expect(drugiOdgovor.avatarSlikaHash).toMatch(/^[a-f0-9]{64}$/);
    expect(drugiOdgovor.avatarSlikaHash).not.toBe(prviOdgovor.avatarSlikaHash);

    for (const hash of [prviOdgovor.avatarSlikaHash, drugiOdgovor.avatarSlikaHash]) {
      const slika = await fetch(`${adresa}/avatari/g/${hash}/64.webp`);
      expect(slika.status).toBe(200);
      expect(slika.headers.get('content-type')).toContain('image/webp');
      const bajtovi = Buffer.from(await slika.arrayBuffer());
      expect(bajtovi.subarray(8, 12).toString('ascii')).toBe('WEBP');
    }
  });

  it('odbija avatarId izvan raspona', async () => {
    const registracija = await fetch(`${adresa}/api/racuni/registracija`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: EMAIL, lozinka: LOZINKA, potvrdaDob16: true, prihvacamUvjete: true }),
    });
    const { sesijskiToken } = (await registracija.json()) as { sesijskiToken: string };

    const odgovor = await fetch(`${adresa}/api/profil/avatar`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${sesijskiToken}` },
      body: JSON.stringify({ avatarId: 999 }),
    });
    expect(odgovor.status).toBe(400);
  });
});

describe('PUT /profil/nadimak', () => {
  it('odbija neidentificirani zahtjev', async () => {
    const odgovor = await fetch(`${adresa}/api/profil/nadimak`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nadimak: 'Ana' }),
    });
    expect(odgovor.status).toBe(401);
  });

  it('dopušta gostu da postavi ime (onboarding)', async () => {
    const gost = await stvoriGosta();
    try {
      const odgovor = await fetch(`${adresa}/api/profil/nadimak`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${gost.token}` },
        body: JSON.stringify({ nadimak: 'Ana' }),
      });
      expect(odgovor.status).toBe(200);
      const tijelo = (await odgovor.json()) as { ok: boolean; nadimak: string };
      expect(tijelo.nadimak).toBe('Ana');
    } finally {
      await baza.delete(igraci).where(eq(igraci.id, gost.id));
    }
  });

  it('odbija ime kraće od 2 znaka', async () => {
    const gost = await stvoriGosta();
    try {
      const odgovor = await fetch(`${adresa}/api/profil/nadimak`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${gost.token}` },
        body: JSON.stringify({ nadimak: 'An' }),
      });
      expect(odgovor.status).toBe(400);
    } finally {
      await baza.delete(igraci).where(eq(igraci.id, gost.id));
    }
  });

  it('odbija ime dulje od 20 znakova', async () => {
    const gost = await stvoriGosta();
    try {
      const odgovor = await fetch(`${adresa}/api/profil/nadimak`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${gost.token}` },
        body: JSON.stringify({ nadimak: 'A'.repeat(13) }),
      });
      expect(odgovor.status).toBe(400);
    } finally {
      await baza.delete(igraci).where(eq(igraci.id, gost.id));
    }
  });
});

describe('GET /rijeci/top', () => {
  const partijaIds: string[] = [];
  const igracIds: string[] = [];

  afterEach(async () => {
    if (partijaIds.length) {
      await baza.delete(potezi).where(inArray(potezi.partijaId, partijaIds));
      await baza.delete(obracuniPartija).where(inArray(obracuniPartija.partijaId, partijaIds));
      await baza.delete(sudioniciPartije).where(inArray(sudioniciPartije.partijaId, partijaIds));
      await baza.delete(partije).where(inArray(partije.id, partijaIds));
      partijaIds.length = 0;
    }
    if (igracIds.length) {
      await baza.delete(botovi).where(inArray(botovi.igracId, igracIds));
      await baza.delete(igraci).where(inArray(igraci.id, igracIds));
      igracIds.length = 0;
    }
    ocistiMemorijuTopRijeci();
  });

  async function noviIgrac(upravljac: 'covjek' | 'bot' = 'covjek'): Promise<string> {
    const id = randomUUID();
    igracIds.push(id);
    await baza.insert(igraci).values({
      id,
      vrsta: 'registriran',
      upravljac,
      nadimak: `Top${id.slice(0, 8)}`,
      emailPotvrdjen: true,
    });
    if (upravljac === 'bot') {
      await baza.insert(botovi).values({ igracId: id, kljucSeeda: `test-top-${id}` });
    }
    return id;
  }

  async function partijaSPotezima(opcije: {
    igracId: string;
    rijec: string;
    brojPoteza?: number;
    status?: 'zavrsena' | 'u_tijeku' | 'ponistena';
    privatna?: boolean;
  }): Promise<void> {
    const id = randomUUID();
    partijaIds.push(id);
    await baza.insert(partije).values({
      id,
      mod: 'cetiri_igraca',
      status: opcije.status ?? 'zavrsena',
      kraj: opcije.status === 'u_tijeku' ? null : new Date(),
    });
    await baza.insert(sudioniciPartije).values({ partijaId: id, igracId: opcije.igracId, sjedalo: 0 });
    const broj = opcije.brojPoteza ?? 1;
    await baza.insert(potezi).values(
      Array.from({ length: broj }, (_, indeks) => ({
        partijaId: id,
        runda: 1,
        redniBroj: indeks + 1,
        igracId: opcije.igracId,
        vrsta: 'rijec' as const,
        rijec: opcije.rijec,
        trazenaSlova: opcije.rijec.slice(0, 2),
        trajanjeMs: 100,
      })),
    );
    if (opcije.privatna) {
      await baza.insert(obracuniPartija).values({ partijaId: id, vrsta: 'privatna_gamifikacija' });
    }
  }

  it('broji samo ljudske riječi iz završenih javnih igara', async () => {
    const sufiks = randomUUID().slice(0, 8);
    const javna = `javna${sufiks}`;
    const privatna = `priv${sufiks}`;
    const botova = `bot${sufiks}`;
    const ponistena = `pon${sufiks}`;

    const covjek = await noviIgrac('covjek');
    const bot = await noviIgrac('bot');
    // Dovoljno upotreba da jedinstvena riječ uđe u top 100 čak i uz postojeće podatke.
    await partijaSPotezima({ igracId: covjek, rijec: javna, brojPoteza: 500 });
    await partijaSPotezima({ igracId: covjek, rijec: privatna, brojPoteza: 500, privatna: true });
    await partijaSPotezima({ igracId: bot, rijec: botova, brojPoteza: 500 });
    await partijaSPotezima({ igracId: covjek, rijec: ponistena, brojPoteza: 500, status: 'ponistena' });

    ocistiMemorijuTopRijeci();
    const odgovor = await fetch(`${adresa}/api/rijeci/top?limit=100`);
    expect(odgovor.status).toBe(200);
    const tijelo = (await odgovor.json()) as {
      ok: boolean;
      rijeci: { rijec: string; brojUpotreba: number }[];
    };
    expect(tijelo.ok).toBe(true);
    const poRijeci = new Map(tijelo.rijeci.map((redak) => [redak.rijec, redak]));
    expect(poRijeci.get(javna)?.brojUpotreba).toBe(500);
    expect(poRijeci.has(privatna)).toBe(false);
    expect(poRijeci.has(botova)).toBe(false);
    expect(poRijeci.has(ponistena)).toBe(false);
  });
});
