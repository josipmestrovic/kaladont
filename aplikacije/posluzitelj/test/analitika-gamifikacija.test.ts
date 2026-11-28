/**
 * Integracijski testovi gamifikacije (zahtijevaju BAZA_URL + ANALITIKA_U_TESTU).
 * Ne pokretati prema razvojnoj bazi — namijenjeni izoliranom CI / lokalnoj testnoj bazi.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { agregirajGamifikaciju } from '../src/analitika/gamifikacija.js';
import { danasZagrebIso, pocetakDanaZagrebUtc } from '../src/analitika/otvaranja.js';
import { baza } from '../src/baza/klijent.js';
import { dodjeleMisija, doprinosiMisijama, igraci, nagradeMisija } from '../src/baza/shema.js';

describe('analitika gamifikacije — agregat', () => {
  const prethodniFlag = process.env.ANALITIKA_U_TESTU;
  process.env.ANALITIKA_U_TESTU = '1';

  afterAll(() => {
    if (prethodniFlag === undefined) delete process.env.ANALITIKA_U_TESTU;
    else process.env.ANALITIKA_U_TESTU = prethodniFlag;
  });

  it('prazan raspon / daleko u budućnosti vraća nulte metrike razdoblja', async () => {
    const daleko = '2099-09-01';
    const agregat = await agregirajGamifikaciju({ odDan: daleko, doDan: daleko });
    expect(agregat.razdoblje.misije.dnevne.dodijeljene).toBe(0);
    expect(agregat.razdoblje.misije.tjedne.dodijeljene).toBe(0);
    expect(agregat.razdoblje.xpMisija.brojNagrada).toBe(0);
    expect(agregat.razdoblje.xpIzazova.prviUspjesi).toBe(0);
    expect(agregat.razdoblje.zamjene.ukupno).toBe(0);
    expect(agregat.trenutacniPresjek.oznaka).toBe('trenutacno');
    expect(agregat.vremenskaZona).toBe('Europe/Zagreb');
  });

  it('trenutačni presjek postoji neovisno o praznom razdoblju', async () => {
    const agregat = await agregirajGamifikaciju({
      odDan: '2099-09-01',
      doDan: '2099-09-01',
    });
    expect(agregat.trenutacniPresjek.bazaIgraca).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(agregat.trenutacniPresjek.xpRazine.poRasponu)).toBe(true);
    expect(Array.isArray(agregat.trenutacniPresjek.dostignuca.poDostignucu)).toBe(true);
    // Stabilan smoke: danasZagrebIso ne ovisi o UUID-u.
    expect(danasZagrebIso()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(randomUUID()).toBeTruthy();
  });

  it('privatni kontekst ne vraća doprinose i nagrade drugih konteksta', async () => {
    const igracId = randomUUID();
    const dodjelaId = randomUUID();
    const dan = danasZagrebIso();
    const uRasponu = new Date(pocetakDanaZagrebUtc(dan).getTime() + 12 * 3_600_000);

    await baza.insert(igraci).values({
      id: igracId,
      vrsta: 'registriran',
      upravljac: 'covjek',
      nadimak: `gami-priv-${igracId.slice(0, 8)}`,
    });
    await baza.insert(dodjeleMisija).values({
      id: dodjelaId,
      igracId,
      vrsta: 'dnevna',
      slot: 1,
      predlozakId: 'D01',
      verzijaDefinicije: 1,
      snapshot: { naziv: 'test privatni filter' },
      napredak: 0,
      cilj: 1,
      status: 'aktivna',
      dostupnaOd: uRasponu,
    });
    await baza.insert(doprinosiMisijama).values([
      {
        dodjelaId,
        igracId,
        kontekstIzvora: 'javna',
        izvorId: randomUUID(),
        delta: {},
        stvorenoU: uRasponu,
      },
      {
        dodjelaId,
        igracId,
        kontekstIzvora: 'trening',
        izvorId: randomUUID(),
        delta: {},
        stvorenoU: uRasponu,
      },
    ]);
    await baza.insert(nagradeMisija).values({
      dodjelaId,
      igracId,
      xpNominalno: 40,
      xpStvarno: 40,
      kontekstIzvora: 'javna',
      izvorId: randomUUID(),
      dodijeljenaU: uRasponu,
    });

    try {
      const privatna = await agregirajGamifikaciju({ odDan: dan, doDan: dan, kontekst: 'privatna' });
      expect(privatna.razdoblje.doprinosiINagradeMisija.dostupno).toBe(false);
      expect(privatna.razdoblje.doprinosi.javna.doprinosi).toBe(0);
      expect(privatna.razdoblje.doprinosi.trening.doprinosi).toBe(0);
      expect(privatna.razdoblje.doprinosi.izazov.doprinosi).toBe(0);
      expect(privatna.razdoblje.xpMisija.brojNagrada).toBe(0);
      expect(privatna.razdoblje.xpMisija.ukupnoStvarno).toBe(0);

      const javna = await agregirajGamifikaciju({ odDan: dan, doDan: dan, kontekst: 'javna' });
      expect(javna.razdoblje.doprinosiINagradeMisija.dostupno).toBe(true);
      expect(javna.razdoblje.doprinosi.javna.doprinosi).toBeGreaterThanOrEqual(1);
      expect(javna.razdoblje.doprinosi.trening.doprinosi).toBe(0);
      expect(javna.razdoblje.xpMisija.brojNagrada).toBeGreaterThanOrEqual(1);
      expect(javna.razdoblje.xpMisija.ukupnoStvarno).toBeGreaterThanOrEqual(40);
    } finally {
      await baza.delete(nagradeMisija).where(eq(nagradeMisija.dodjelaId, dodjelaId));
      await baza.delete(doprinosiMisijama).where(eq(doprinosiMisijama.dodjelaId, dodjelaId));
      await baza.delete(dodjeleMisija).where(eq(dodjeleMisija.id, dodjelaId));
      await baza.delete(igraci).where(eq(igraci.id, igracId));
    }
  });
});
