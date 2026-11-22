import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { DefinicijaMisije, StanjeMisijaDto } from 'zajednicko';
import { DEFINICIJE_MISIJA } from 'zajednicko';
import { izgradiPosluzitelj } from '../src/server.js';
import { baza } from '../src/baza/klijent.js';
import {
  ciklusiTjednihMisija,
  dodjeleMisija,
  doprinosiMisijama,
  dotokDnevnihMisija,
  igraci,
  ishodiMisijaIgara,
  nagradeMisija,
  stanjeMisijaIgraca,
  zamjeneMisija,
} from '../src/baza/shema.js';
import { izgradiStanjeMisijaDto, oznaciPregledMisija } from '../src/misije/dto.js';
import { obracunajMisijeZaIgraca } from '../src/misije/obracun.js';
import { osigurajStanjeMisija } from '../src/misije/stanje.js';
import { zamijeniMisiju } from '../src/misije/zamjena.js';

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
    await ocistiMisije(igrac.id);
    await baza.delete(igraci).where(eq(igraci.id, igrac.id));
  }
});

async function ocistiMisije(igracId: string) {
  await baza.delete(doprinosiMisijama).where(eq(doprinosiMisijama.igracId, igracId));
  await baza.delete(nagradeMisija).where(eq(nagradeMisija.igracId, igracId));
  await baza.delete(ishodiMisijaIgara).where(eq(ishodiMisijaIgara.igracId, igracId));
  await baza.delete(zamjeneMisija).where(eq(zamjeneMisija.igracId, igracId));
  await baza.delete(dodjeleMisija).where(eq(dodjeleMisija.igracId, igracId));
  await baza.delete(dotokDnevnihMisija).where(eq(dotokDnevnihMisija.igracId, igracId));
  await baza.delete(ciklusiTjednihMisija).where(eq(ciklusiTjednihMisija.igracId, igracId));
  await baza.delete(stanjeMisijaIgraca).where(eq(stanjeMisijaIgraca.igracId, igracId));
}

async function registriraj(): Promise<{ token: string; igracId: string; email: string }> {
  const email = `misije-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  emailovi.push(email);
  const odgovor = await fetch(`${adresa}/api/racuni/registracija`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, lozinka: 'lozinka123', potvrdaDob16: true, prihvacamUvjete: true, nadimak: 'MisIgrac' }),
  });
  expect(odgovor.status).toBe(200);
  const tijelo = (await odgovor.json()) as { sesijskiToken: string; igracId: string };
  return { token: tijelo.sesijskiToken, igracId: tijelo.igracId, email };
}

function fiksniRng(seed = 0.42): () => number {
  let x = seed;
  return () => {
    x = (x * 1.7 + 0.13) % 1;
    return x;
  };
}

describe('misije API i stanje', () => {
  it('gost dobiva 403 REGISTRACIJA_POTREBNA', async () => {
    const gost = await fetch(`${adresa}/api/racuni/gost-sesija`, { method: 'POST' });
    const { token } = (await gost.json()) as { token: string };
    const odgovor = await fetch(`${adresa}/api/misije`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(odgovor.status).toBe(403);
    expect(await odgovor.json()).toEqual(expect.objectContaining({
      ok: false,
      kod: 'REGISTRACIJA_POTREBNA',
    }));
  });

  it('prvi GET daje 1 dnevnu i 3 tjedne te novosti', async () => {
    const { token } = await registriraj();
    const odgovor = await fetch(`${adresa}/api/misije`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(odgovor.status).toBe(200);
    const stanje = (await odgovor.json()) as StanjeMisijaDto;
    expect(stanje.ok).toBe(true);
    expect(stanje.dnevne.aktivne).toHaveLength(1);
    expect(stanje.tjedne.misije).toHaveLength(3);
    expect(stanje.novosti.dnevne).toBe(true);
    expect(stanje.novosti.tjedne).toBe(true);
    expect(stanje.zamjene.dnevna.preostalo).toBe(1);
    expect(stanje.zamjene.tjedna.preostalo).toBe(1);
  });

  it('pregled gasi novosti redom daily pa weekly', async () => {
    const { token } = await registriraj();
    await fetch(`${adresa}/api/misije`, { headers: { authorization: `Bearer ${token}` } });

    const dnevni = await fetch(`${adresa}/api/misije/pregled`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ skupina: 'dnevna' }),
    });
    expect(dnevni.status).toBe(200);
    const nakonDnevnih = (await dnevni.json()) as StanjeMisijaDto;
    expect(nakonDnevnih.novosti.dnevne).toBe(false);
    expect(nakonDnevnih.novosti.tjedne).toBe(true);

    const tjedni = await fetch(`${adresa}/api/misije/pregled`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ skupina: 'tjedna' }),
    });
    const nakonTjednih = (await tjedni.json()) as StanjeMisijaDto;
    expect(nakonTjednih.novosti.tjedne).toBe(false);
  });

  it('dotok 0..3: odsutnost dodaje do tri, puna zaliha preskače', async () => {
    const { igracId } = await registriraj();
    const start = new Date('2026-11-02T11:00:00+01:00');
    await baza.transaction(async (tx) => {
      await osigurajStanjeMisija(tx, igracId, { sada: () => start, rng: fiksniRng() });
    });

    let aktivne = await baza.select().from(dodjeleMisija).where(and(
      eq(dodjeleMisija.igracId, igracId),
      eq(dodjeleMisija.vrsta, 'dnevna'),
      eq(dodjeleMisija.status, 'aktivna'),
    ));
    expect(aktivne).toHaveLength(1);

    const dan2 = new Date('2026-11-03T11:00:00+01:00');
    await baza.transaction(async (tx) => {
      await osigurajStanjeMisija(tx, igracId, { sada: () => dan2, rng: fiksniRng(0.2) });
    });
    aktivne = await baza.select().from(dodjeleMisija).where(and(
      eq(dodjeleMisija.igracId, igracId),
      eq(dodjeleMisija.vrsta, 'dnevna'),
      eq(dodjeleMisija.status, 'aktivna'),
    ));
    expect(aktivne).toHaveLength(2);

    const dan3 = new Date('2026-11-04T11:00:00+01:00');
    await baza.transaction(async (tx) => {
      await osigurajStanjeMisija(tx, igracId, { sada: () => dan3, rng: fiksniRng(0.3) });
    });
    aktivne = await baza.select().from(dodjeleMisija).where(and(
      eq(dodjeleMisija.igracId, igracId),
      eq(dodjeleMisija.vrsta, 'dnevna'),
      eq(dodjeleMisija.status, 'aktivna'),
    ));
    expect(aktivne).toHaveLength(3);

    const dan4 = new Date('2026-11-05T11:00:00+01:00');
    await baza.transaction(async (tx) => {
      await osigurajStanjeMisija(tx, igracId, { sada: () => dan4, rng: fiksniRng(0.4) });
    });
    aktivne = await baza.select().from(dodjeleMisija).where(and(
      eq(dodjeleMisija.igracId, igracId),
      eq(dodjeleMisija.vrsta, 'dnevna'),
      eq(dodjeleMisija.status, 'aktivna'),
    ));
    expect(aktivne).toHaveLength(3);

    const [preskoceno] = await baza.select().from(dotokDnevnihMisija).where(and(
      eq(dotokDnevnihMisija.igracId, igracId),
      eq(dotokDnevnihMisija.lokalniDatum, '2026-11-05'),
    ));
    expect(preskoceno?.status).toBe('preskoceno');
  });

  it('tjedni rollover ističe stare tjedne, dnevne preživljavaju', async () => {
    const { igracId } = await registriraj();
    const utorak = new Date('2026-11-03T12:00:00+01:00');
    await baza.transaction(async (tx) => {
      await osigurajStanjeMisija(tx, igracId, { sada: () => utorak, rng: fiksniRng() });
    });
    const dnevnePrije = await baza.select().from(dodjeleMisija).where(and(
      eq(dodjeleMisija.igracId, igracId),
      eq(dodjeleMisija.vrsta, 'dnevna'),
      eq(dodjeleMisija.status, 'aktivna'),
    ));
    expect(dnevnePrije.length).toBeGreaterThanOrEqual(1);
    const tjednePrije = await baza.select().from(dodjeleMisija).where(and(
      eq(dodjeleMisija.igracId, igracId),
      eq(dodjeleMisija.vrsta, 'tjedna'),
      eq(dodjeleMisija.status, 'aktivna'),
    ));
    expect(tjednePrije).toHaveLength(3);

    const iduciUtorak = new Date('2026-11-10T12:00:00+01:00');
    await baza.transaction(async (tx) => {
      await osigurajStanjeMisija(tx, igracId, { sada: () => iduciUtorak, rng: fiksniRng(0.55) });
    });

    const dnevnePoslije = await baza.select().from(dodjeleMisija).where(and(
      eq(dodjeleMisija.igracId, igracId),
      eq(dodjeleMisija.vrsta, 'dnevna'),
      eq(dodjeleMisija.status, 'aktivna'),
    ));
    // Dnevne preživljavaju tjedni rollover (catch-up može dodati nove do kapaciteta 3).
    const idjeviPoslije = new Set(dnevnePoslije.map((d) => d.id));
    for (const stara of dnevnePrije) expect(idjeviPoslije.has(stara.id)).toBe(true);
    expect(dnevnePoslije.length).toBeGreaterThanOrEqual(dnevnePrije.length);
    expect(dnevnePoslije.length).toBeLessThanOrEqual(3);

    const istekle = await baza.select().from(dodjeleMisija).where(and(
      eq(dodjeleMisija.igracId, igracId),
      eq(dodjeleMisija.vrsta, 'tjedna'),
      eq(dodjeleMisija.status, 'istekla'),
    ));
    expect(istekle).toHaveLength(3);

    const noveTjedne = await baza.select().from(dodjeleMisija).where(and(
      eq(dodjeleMisija.igracId, igracId),
      eq(dodjeleMisija.vrsta, 'tjedna'),
      eq(dodjeleMisija.status, 'aktivna'),
    ));
    expect(noveTjedne).toHaveLength(3);
    expect(noveTjedne.map((d) => d.id).sort()).not.toEqual(tjednePrije.map((d) => d.id).sort());
  });

  it('zamjena kvota + idempotency', async () => {
    const { token, igracId } = await registriraj();
    const prvi = await fetch(`${adresa}/api/misije`, { headers: { authorization: `Bearer ${token}` } });
    const stanje = (await prvi.json()) as StanjeMisijaDto;
    const dnevna = stanje.dnevne.aktivne[0]!;
    const key = randomUUID();

    const zamjena = await fetch(`${adresa}/api/misije/${dnevna.dodjelaId}/zamijeni`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'idempotency-key': key,
      },
      body: JSON.stringify({ idempotencyKey: key }),
    });
    expect(zamjena.status).toBe(200);
    const nakon = (await zamjena.json()) as StanjeMisijaDto;
    expect(nakon.dnevne.aktivne).toHaveLength(1);
    expect(nakon.dnevne.aktivne[0]!.dodjelaId).not.toBe(dnevna.dodjelaId);
    expect(nakon.zamjene.dnevna.preostalo).toBe(0);

    const ponovljeno = await fetch(`${adresa}/api/misije/${dnevna.dodjelaId}/zamijeni`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'idempotency-key': key,
      },
      body: JSON.stringify({ idempotencyKey: key }),
    });
    expect(ponovljeno.status).toBe(200);
    const idem = (await ponovljeno.json()) as StanjeMisijaDto;
    expect(idem.dnevne.aktivne[0]!.dodjelaId).toBe(nakon.dnevne.aktivne[0]!.dodjelaId);

    const key2 = randomUUID();
    const druga = await fetch(`${adresa}/api/misije/${nakon.dnevne.aktivne[0]!.dodjelaId}/zamijeni`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'idempotency-key': key2,
      },
      body: JSON.stringify({ idempotencyKey: key2 }),
    });
    expect(druga.status).toBe(409);
    expect(await druga.json()).toEqual(expect.objectContaining({ kod: 'ZAMJENA_ISKORISTENA' }));
    void igracId;
  });

  it('javni TX i trening ishod/retry su idempotentni', async () => {
    const { igracId } = await registriraj();
    const sada = new Date('2026-11-04T15:00:00+01:00');
    await baza.transaction(async (tx) => {
      await osigurajStanjeMisija(tx, igracId, { sada: () => sada, rng: fiksniRng() });
      // forsira D01 (partije) kao aktivnu dnevnu radi predvidljivog napretka
      const [aktivna] = await tx.select().from(dodjeleMisija).where(and(
        eq(dodjeleMisija.igracId, igracId),
        eq(dodjeleMisija.vrsta, 'dnevna'),
        eq(dodjeleMisija.status, 'aktivna'),
      ));
      if (aktivna) {
        const d01 = DEFINICIJE_MISIJA.find((d) => d.predlozakId === 'D01')!;
        await tx.update(dodjeleMisija).set({
          predlozakId: 'D01',
          cilj: d01.cilj,
          napredak: 0,
          snapshot: {
            predlozakId: 'D01',
            verzijaDefinicije: 1,
            naziv: d01.naziv,
            opis: d01.opis,
            metrika: d01.metrika,
            cilj: d01.cilj,
            pragMetrike: null,
            podciljevi: null,
            xp: d01.xp,
            obitelj: d01.obitelj,
            zahtjevnija: false,
            kontekst: 'javna',
            mod: 'oba',
          },
        }).where(eq(dodjeleMisija.id, aktivna.id));
      }
    });

    const izvorId = randomUUID();
    const metrike = {
      izvorId,
      kontekst: 'javna' as const,
      mod: 'dva_igraca' as const,
      igracId,
      zavrsenoU: sada,
      plasman: 2,
      nacinIspadanja: 'poraz',
      prihvaceneRijeci: 4,
      najduziNiz: 2,
      dugeRijeci: 0,
      jakoDugeRijeci: 0,
      rijetkeRijeci: 0,
      jakoRijetkeRijeci: 0,
      dugeIRijetkeRijeci: 0,
      eliminacije: 0,
      kaladontIzvedbe: 0,
      razlicitiPoceci: ['ba', 'ka'],
      pravila: 'ka_zna' as const,
      odabranaPravila: 'ka_zna' as const,
      spojeniDvoboj: false,
      uspjesniDokazi: 0,
      kaladontSljedeciUzTriPlus: 0,
    };

    const prvi = await baza.transaction((tx) =>
      obracunajMisijeZaIgraca(tx, metrike, 100, 50, { sada: () => sada, rng: fiksniRng() }),
    );
    const drugi = await baza.transaction((tx) =>
      obracunajMisijeZaIgraca(tx, metrike, 100, 50, { sada: () => sada, rng: fiksniRng() }),
    );
    expect({
      promjeneMisija: drugi.promjeneMisija,
      ukupnoIskustvo: drugi.ukupnoIskustvo,
      misijeStanjeVerzija: drugi.misijeStanjeVerzija,
      novaDostignuca: drugi.novaDostignuca,
    }).toEqual({
      promjeneMisija: prvi.promjeneMisija,
      ukupnoIskustvo: prvi.ukupnoIskustvo,
      misijeStanjeVerzija: prvi.misijeStanjeVerzija,
      novaDostignuca: prvi.novaDostignuca,
    });
    expect(drugi.noveObavijesti ?? []).toEqual([]);
    expect(prvi.promjeneMisija.some((p) => p.predlozakId === 'D01' && p.poslije >= 1)).toBe(true);

    const treningId = randomUUID();
    await baza.transaction(async (tx) => {
      const [aktivna] = await tx.select().from(dodjeleMisija).where(and(
        eq(dodjeleMisija.igracId, igracId),
        eq(dodjeleMisija.vrsta, 'dnevna'),
        eq(dodjeleMisija.status, 'aktivna'),
      ));
      const d10 = DEFINICIJE_MISIJA.find((d) => d.predlozakId === 'D10')!;
      if (aktivna) {
        await tx.update(dodjeleMisija).set({
          predlozakId: 'D10',
          cilj: d10.cilj,
          napredak: 0,
          snapshot: {
            predlozakId: 'D10',
            verzijaDefinicije: 1,
            naziv: d10.naziv,
            opis: d10.opis,
            metrika: d10.metrika,
            cilj: d10.cilj,
            pragMetrike: null,
            podciljevi: null,
            xp: d10.xp,
            obitelj: d10.obitelj,
            zahtjevnija: false,
            kontekst: 'trening',
            mod: 'dva_igraca',
          },
        }).where(eq(dodjeleMisija.id, aktivna.id));
      }
    });

    const treningMetrike = {
      ...metrike,
      izvorId: treningId,
      kontekst: 'trening' as const,
      plasman: 1,
    };
    const t1 = await baza.transaction((tx) =>
      obracunajMisijeZaIgraca(tx, treningMetrike, 120, 100, { sada: () => sada, rng: fiksniRng() }),
    );
    const t2 = await baza.transaction((tx) =>
      obracunajMisijeZaIgraca(tx, treningMetrike, 120, 100, { sada: () => sada, rng: fiksniRng() }),
    );
    expect({
      promjeneMisija: t2.promjeneMisija,
      ukupnoIskustvo: t2.ukupnoIskustvo,
      misijeStanjeVerzija: t2.misijeStanjeVerzija,
      novaDostignuca: t2.novaDostignuca,
    }).toEqual({
      promjeneMisija: t1.promjeneMisija,
      ukupnoIskustvo: t1.ukupnoIskustvo,
      misijeStanjeVerzija: t1.misijeStanjeVerzija,
      novaDostignuca: t1.novaDostignuca,
    });
    expect(t2.noveObavijesti ?? []).toEqual([]);
    expect(t1.promjeneMisija.some((p) => p.predlozakId === 'D10' && p.upravoDovrsena)).toBe(true);
  });

  it('paralelni first-init daje točno 1 aktivnu dnevnu', async () => {
    const { igracId } = await registriraj();
    const sada = new Date('2026-11-04T12:00:00+01:00');
    await Promise.all([
      baza.transaction((tx) => osigurajStanjeMisija(tx, igracId, { sada: () => sada, rng: fiksniRng() })),
      baza.transaction((tx) => osigurajStanjeMisija(tx, igracId, { sada: () => sada, rng: fiksniRng(0.3) })),
    ]);
    const aktivne = await baza.select().from(dodjeleMisija).where(and(
      eq(dodjeleMisija.igracId, igracId),
      eq(dodjeleMisija.vrsta, 'dnevna'),
      eq(dodjeleMisija.status, 'aktivna'),
    ));
    expect(aktivne).toHaveLength(1);
  });

  it('obračun napreduje istekla tjednu ako je igra završila prije isteka', async () => {
    const { igracId } = await registriraj();
    const utorak = new Date('2026-11-03T12:00:00+01:00');
    const nedjelja = new Date('2026-11-08T18:00:00+01:00');
    const iduciUtorak = new Date('2026-11-10T12:00:00+01:00');

    let tjednaId = '';
    await baza.transaction(async (tx) => {
      await osigurajStanjeMisija(tx, igracId, { sada: () => utorak, rng: fiksniRng() });
      const tjedne = await tx.select().from(dodjeleMisija).where(and(
        eq(dodjeleMisija.igracId, igracId),
        eq(dodjeleMisija.vrsta, 'tjedna'),
        eq(dodjeleMisija.status, 'aktivna'),
      ));
      expect(tjedne.length).toBeGreaterThan(0);
      const aktivnaPartija = (predlozakId: string) => {
        const d = DEFINICIJE_MISIJA.find((x) => x.predlozakId === predlozakId);
        return d?.vrsta === 'tjedna' && d.aktivna && d.metrika === 'partije' ? d : undefined;
      };
      // Preferiraj već dodijeljenu aktivnu partije-misiju (uq po predlošku u ciklusu).
      const postojeca = tjedne.find((t) => aktivnaPartija(t.predlozakId));
      const zauzeti = new Set(tjedne.map((t) => t.predlozakId));
      const ciljna = postojeca
        ? aktivnaPartija(postojeca.predlozakId)!
        : DEFINICIJE_MISIJA.find((d) =>
          d.vrsta === 'tjedna' && d.aktivna && d.metrika === 'partije' && !zauzeti.has(d.predlozakId),
        );
      expect(ciljna).toBeDefined();
      const tjedna = postojeca ?? tjedne[0]!;
      tjednaId = tjedna.id;
      await tx.update(dodjeleMisija).set({
        predlozakId: ciljna!.predlozakId,
        cilj: ciljna!.cilj,
        napredak: 0,
        snapshot: {
          predlozakId: ciljna!.predlozakId,
          verzijaDefinicije: 1,
          naziv: ciljna!.naziv,
          opis: ciljna!.opis,
          metrika: ciljna!.metrika,
          cilj: ciljna!.cilj,
          pragMetrike: null,
          podciljevi: null,
          xp: ciljna!.xp,
          obitelj: ciljna!.obitelj,
          zahtjevnija: false,
          kontekst: 'javna',
          mod: 'oba',
        },
      }).where(eq(dodjeleMisija.id, tjednaId));
    });

    // Ponavljanje u novom tjednu označava staru tjednu kao istekla (kao GET u ponedjeljak).
    await baza.transaction(async (tx) => {
      await osigurajStanjeMisija(tx, igracId, { sada: () => iduciUtorak, rng: fiksniRng(0.55) });
    });
    const [istekla] = await baza.select().from(dodjeleMisija).where(eq(dodjeleMisija.id, tjednaId));
    expect(istekla?.status).toBe('istekla');

    const metrike = {
      izvorId: randomUUID(),
      kontekst: 'javna' as const,
      mod: 'tri_igraca' as const,
      igracId,
      zavrsenoU: nedjelja,
      plasman: 2,
      nacinIspadanja: 'poraz',
      prihvaceneRijeci: 4,
      najduziNiz: 2,
      dugeRijeci: 0,
      jakoDugeRijeci: 0,
      rijetkeRijeci: 0,
      jakoRijetkeRijeci: 0,
      dugeIRijetkeRijeci: 0,
      eliminacije: 0,
      kaladontIzvedbe: 0,
      razlicitiPoceci: ['ba', 'ka'],
      pravila: 'ka_zna' as const,
      odabranaPravila: 'ka_zna' as const,
      spojeniDvoboj: false,
      uspjesniDokazi: 0,
      kaladontSljedeciUzTriPlus: 0,
    };

    const ishod = await baza.transaction((tx) =>
      obracunajMisijeZaIgraca(tx, metrike, 100, 50, { sada: () => nedjelja, rng: fiksniRng() }),
    );
    expect(ishod.promjeneMisija.some((p) => p.dodjelaId === tjednaId && p.poslije > 0)).toBe(true);

    const [nakon] = await baza.select().from(dodjeleMisija).where(eq(dodjeleMisija.id, tjednaId));
    expect(nakon!.napredak).toBeGreaterThan(0);
    expect(['istekla', 'dovrsena']).toContain(nakon!.status);
  });

  it('Brza igra: deaktivirane D22/W22 ne napreduju u obračunu', async () => {
    const { igracId } = await registriraj();
    const sada = new Date('2026-11-04T12:00:00+01:00');
    let d22Id = '';
    let w22Id = '';
    await baza.transaction(async (tx) => {
      await osigurajStanjeMisija(tx, igracId, { sada: () => sada, rng: fiksniRng() });
      const [dnevna] = await tx.select().from(dodjeleMisija).where(and(
        eq(dodjeleMisija.igracId, igracId),
        eq(dodjeleMisija.vrsta, 'dnevna'),
        eq(dodjeleMisija.status, 'aktivna'),
      ));
      const [tjedna] = await tx.select().from(dodjeleMisija).where(and(
        eq(dodjeleMisija.igracId, igracId),
        eq(dodjeleMisija.vrsta, 'tjedna'),
        eq(dodjeleMisija.status, 'aktivna'),
      ));
      expect(dnevna && tjedna).toBeTruthy();
      d22Id = dnevna!.id;
      w22Id = tjedna!.id;
      const d22 = DEFINICIJE_MISIJA.find((d) => d.predlozakId === 'D22')!;
      const w22 = DEFINICIJE_MISIJA.find((d) => d.predlozakId === 'W22')!;
      await tx.update(dodjeleMisija).set({
        predlozakId: 'D22',
        cilj: d22.cilj,
        napredak: 0,
        snapshot: {
          predlozakId: d22.predlozakId,
          verzijaDefinicije: 1,
          naziv: d22.naziv,
          opis: d22.opis,
          metrika: d22.metrika,
          cilj: d22.cilj,
          pragMetrike: null,
          podciljevi: null,
          xp: d22.xp,
          obitelj: d22.obitelj,
          zahtjevnija: false,
          kontekst: 'javna',
          mod: 'oba',
          modovi: null,
          pravilnik: 'dokazi_nastavak',
        },
      }).where(eq(dodjeleMisija.id, d22Id));
      await tx.update(dodjeleMisija).set({
        predlozakId: 'W22',
        cilj: w22.cilj,
        napredak: 0,
        snapshot: {
          predlozakId: w22.predlozakId,
          verzijaDefinicije: 1,
          naziv: w22.naziv,
          opis: w22.opis,
          metrika: w22.metrika,
          cilj: w22.cilj,
          pragMetrike: null,
          podciljevi: null,
          xp: w22.xp,
          obitelj: w22.obitelj,
          zahtjevnija: true,
          kontekst: 'javna',
          mod: 'oba',
          modovi: null,
          pravilnik: null,
        },
      }).where(eq(dodjeleMisija.id, w22Id));
    });

    const izvorId = randomUUID();
    const metrike = {
      izvorId,
      kontekst: 'javna' as const,
      mod: 'tri_igraca' as const,
      igracId,
      zavrsenoU: sada,
      plasman: 2,
      nacinIspadanja: 'ne_znam',
      prihvaceneRijeci: 3,
      najduziNiz: 2,
      dugeRijeci: 0,
      jakoDugeRijeci: 0,
      rijetkeRijeci: 0,
      jakoRijetkeRijeci: 0,
      dugeIRijetkeRijeci: 0,
      eliminacije: 0,
      kaladontIzvedbe: 0,
      razlicitiPoceci: ['ce'],
      pravila: 'dokazi_nastavak' as const,
      odabranaPravila: 'dokazi_nastavak' as const,
      spojeniDvoboj: false,
      uspjesniDokazi: 2,
      kaladontSljedeciUzTriPlus: 0,
    };

    const prvi = await baza.transaction((tx) =>
      obracunajMisijeZaIgraca(tx, metrike, 100, 50, { sada: () => sada, rng: fiksniRng() }),
    );
    expect(prvi.promjeneMisija.some((p) => p.predlozakId === 'D22')).toBe(false);
    expect(prvi.promjeneMisija.some((p) => p.predlozakId === 'W22')).toBe(false);
  });

  it('sistemska zamjena deaktivirane aktivne misije ne troši ručnu kvotu', async () => {
    const { igracId } = await registriraj();
    await baza.transaction(async (tx) => {
      const stanje = await izgradiStanjeMisijaDto(tx, igracId);
      const dnevna = stanje.dnevne.aktivne[0]!;
      await tx.update(dodjeleMisija).set({ predlozakId: 'D07' }).where(eq(dodjeleMisija.id, dnevna.dodjelaId));
      const poslije = await izgradiStanjeMisijaDto(tx, igracId);
      expect(poslije.dnevne.aktivne.every((m) => m.predlozakId !== 'D07')).toBe(true);
      expect(poslije.dnevne.aktivne).toHaveLength(stanje.dnevne.aktivne.length);
      expect(poslije.zamjene.dnevna.preostalo).toBe(1);
    });
  });

  it('soft-delete: neaktivna definicija se ne bira za nove dodjele', async () => {
    const { odaberiZamjenu } = await import('../src/misije/generator.js');
    const iskljucena: DefinicijaMisije = {
      ...DEFINICIJE_MISIJA.find((d) => d.predlozakId === 'D01')!,
      aktivna: false,
    };
    // Katalog u generatoru čita DEFINICIJE_MISIJA; soft-delete polje filtrira kandidata.
    // Provjeri da filter `aktivna` postoji: zamjena s praznim ostalim i zabranjenim setom
    // i dalje vraća samo aktivne predloške.
    const zamjena = odaberiZamjenu(
      'dnevna',
      [],
      new Date('2026-11-04T12:00:00Z'),
      () => 0.2,
      new Set([iskljucena.predlozakId]),
    );
    expect(zamjena).not.toBeNull();
    expect(zamjena!.aktivna).toBe(true);
    expect(zamjena!.predlozakId).not.toBe('D01');
  });
});

describe('misije pomoćne funkcije u TX', () => {
  it('oznaciPregledMisija ažurira stanje', async () => {
    const { igracId } = await registriraj();
    await baza.transaction(async (tx) => {
      const prije = await izgradiStanjeMisijaDto(tx, igracId);
      expect(prije.novosti.dnevne).toBe(true);
      const poslije = await oznaciPregledMisija(tx, igracId, 'dnevna');
      expect(poslije.novosti.dnevne).toBe(false);
    });
  });

  it('zamijeniMisiju poštuje kvotu u istoj TX', async () => {
    const { igracId } = await registriraj();
    await baza.transaction(async (tx) => {
      const stanje = await izgradiStanjeMisijaDto(tx, igracId);
      const id = stanje.dnevne.aktivne[0]!.dodjelaId;
      const r1 = await zamijeniMisiju(tx, igracId, id, randomUUID());
      expect(r1.ok).toBe(true);
      if (!r1.ok) return;
      const novaId = r1.stanje.dnevne.aktivne[0]!.dodjelaId;
      const r2 = await zamijeniMisiju(tx, igracId, novaId, randomUUID());
      expect(r2.ok).toBe(false);
      if (!r2.ok) expect(r2.greska.kod).toBe('ZAMJENA_ISKORISTENA');
    });
  });
});
