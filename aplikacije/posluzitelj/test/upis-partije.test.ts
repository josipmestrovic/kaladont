import { afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { izracunajRazinuDostignuca, dohvatiDefinicijuDostignuca } from 'zajednicko';
import { baza } from '../src/baza/klijent.js';
import { dostignucaIgraca, dnkStatistikeIgraca, igraci, napredakDostignucaIgraca, partije, statistikeRijeciIgraca, sudioniciPartije } from '../src/baza/shema.js';
import { zakljuciPartijuUBazi } from '../src/igra/upis-partije.js';

describe('upis partije i javne pobjede', () => {
  const igracId = randomUUID();

  afterEach(async () => {
    await baza.delete(sudioniciPartije).where(eq(sudioniciPartije.igracId, igracId));
    await baza.delete(partije).where(eq(partije.pobjednikId, igracId));
    await baza.delete(igraci).where(eq(igraci.id, igracId));
  });

  it('povećava javne pobjede jednom po partiji i dodjeljuje ispravnu razinu', async () => {
    await baza.insert(igraci).values({ id: igracId, vrsta: 'registriran', nadimak: 'Test Pobjednik' });

    for (let brojPartije = 0; brojPartije < 5; brojPartije += 1) {
      const partijaId = randomUUID();
      await baza.insert(partije).values({ id: partijaId, mod: 'cetiri_igraca', status: 'u_tijeku' });
      await baza.insert(sudioniciPartije).values({ partijaId, igracId, sjedalo: 0 });

      await zakljuciPartijuUBazi(
        partijaId,
        igracId,
        [{ igracId, plasman: 1, bodovi: 3, eliminacije: 0, iskustvo: 0, nacinIspadanja: 'pobjednik' }],
        'cetiri_igraca',
        new Map(),
        false,
        new Map([[igracId, { delta: {} }]]),
      );
    }

    const [igrac] = await baza.select({ pobjede: igraci.pobjede }).from(igraci).where(eq(igraci.id, igracId));
    const [napredak] = await baza
      .select({ javnePobjede: napredakDostignucaIgraca.javnePobjede })
      .from(napredakDostignucaIgraca)
      .where(eq(napredakDostignucaIgraca.igracId, igracId));
    const [dostignuce] = await baza
      .select({ razina: dostignucaIgraca.razina })
      .from(dostignucaIgraca)
      .where(and(eq(dostignucaIgraca.igracId, igracId), eq(dostignucaIgraca.dostignuceId, 'zavrsna_rijec')));

    const definicija = dohvatiDefinicijuDostignuca('zavrsna_rijec')!;
    expect(igrac?.pobjede).toBe(5);
    expect(napredak?.javnePobjede).toBe(5);
    expect(dostignuce?.razina).toBe(izracunajRazinuDostignuca(definicija, 5));
    expect(dostignuce?.razina).toBe(2);
  });

  it('privatna partija ne zapisuje statistiku javnog moda', async () => {
    await baza.insert(igraci).values({ id: igracId, vrsta: 'registriran', nadimak: 'Privatni Test' });

    await zakljuciPartijuUBazi(
      randomUUID(),
      igracId,
      [{ igracId, plasman: 1, bodovi: 2, eliminacije: 0, iskustvo: 0, nacinIspadanja: 'pobjednik' }],
      'cetiri_igraca',
      new Map([[igracId, {
        igracId,
        grupe: [],
        otkljucaneRijeci: [],
        prihvaceniPotezi: 3,
        ukupnoTrajanjePrihvaceniPoteziMs: 3_000,
        najduziStreak: 3,
        otkriveneJakoRijetkeGrupe: 0,
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
      true,
      new Map(),
    );

    expect(await baza.select().from(statistikeRijeciIgraca).where(eq(statistikeRijeciIgraca.igracId, igracId))).toHaveLength(0);
    expect(await baza.select().from(dnkStatistikeIgraca).where(eq(dnkStatistikeIgraca.igracId, igracId))).toHaveLength(0);
  });
});