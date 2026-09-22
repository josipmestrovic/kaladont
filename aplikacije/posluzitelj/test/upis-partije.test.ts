import { afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { izracunajRazinuDostignuca, dohvatiDefinicijuDostignuca } from 'zajednicko';
import { baza } from '../src/baza/klijent.js';
import { dostignucaIgraca, dnkStatistikeIgraca, igraci, napredakDostignucaIgraca, obracuniPartija, partije, statistikeRijeciIgraca, sudioniciPartije } from '../src/baza/shema.js';
import { ponistiPartijeUTijekuUBazi, zakljuciPartijuUBazi } from '../src/igra/upis-partije.js';

describe('upis partije i javne pobjede', () => {
  const igracId = randomUUID();
  const obracuniZaBrisanje: string[] = [];

  afterEach(async () => {
    for (const partijaId of obracuniZaBrisanje.splice(0)) {
      await baza.delete(obracuniPartija).where(eq(obracuniPartija.partijaId, partijaId));
    }
    await baza.delete(sudioniciPartije).where(eq(sudioniciPartije.igracId, igracId));
    await baza.delete(partije).where(eq(partije.pobjednikId, igracId));
    await baza.delete(igraci).where(eq(igraci.id, igracId));
  });

  it('povećava javne pobjede jednom po partiji i dodjeljuje ispravnu razinu', async () => {
    await baza.insert(igraci).values({ id: igracId, vrsta: 'registriran', nadimak: 'Test Pobjednik' });

    for (let brojPartije = 0; brojPartije < 5; brojPartije += 1) {
      const partijaId = randomUUID();
      obracuniZaBrisanje.push(partijaId);
      await baza.insert(partije).values({ id: partijaId, mod: 'cetiri_igraca', status: 'u_tijeku' });
      await baza.insert(sudioniciPartije).values({ partijaId, igracId, sjedalo: 0 });

      const zavrsniRezultati = [{ igracId, plasman: 1 as const, bodovi: 3, eliminacije: 0, iskustvo: 0, nacinIspadanja: 'pobjednik' as const }];
      const napredak = new Map([[igracId, { delta: {} }]]);
      await Promise.all([
        zakljuciPartijuUBazi(partijaId, igracId, zavrsniRezultati, 'cetiri_igraca', new Map(), false, napredak),
        zakljuciPartijuUBazi(partijaId, igracId, zavrsniRezultati, 'cetiri_igraca', new Map(), false, napredak),
      ]);
      await zakljuciPartijuUBazi(
        partijaId,
        igracId,
        zavrsniRezultati,
        'cetiri_igraca',
        new Map(),
        false,
        napredak,
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

  it('privatnu gamifikaciju obračunava samo jednom', async () => {
    await baza.insert(igraci).values({ id: igracId, vrsta: 'registriran', nadimak: 'Privatni Idempotentni Test' });
    const partijaId = randomUUID();
    obracuniZaBrisanje.push(partijaId);
    const rezultati = [{ igracId, plasman: 1 as const, bodovi: 2, eliminacije: 0, iskustvo: 0, nacinIspadanja: 'pobjednik' as const }];
    const napredak = new Map([[igracId, { delta: { kaladontIzvedbe: 1 } }]]);

    await Promise.all([
      zakljuciPartijuUBazi(partijaId, igracId, rezultati, 'cetiri_igraca', new Map(), true, napredak),
      zakljuciPartijuUBazi(partijaId, igracId, rezultati, 'cetiri_igraca', new Map(), true, napredak),
    ]);

    const [stanje] = await baza
      .select({ kaladontIzvedbe: napredakDostignucaIgraca.kaladontIzvedbe })
      .from(napredakDostignucaIgraca)
      .where(eq(napredakDostignucaIgraca.igracId, igracId));
    const obracuni = await baza.select().from(obracuniPartija).where(eq(obracuniPartija.partijaId, partijaId));
    expect(stanje?.kaladontIzvedbe).toBe(1);
    expect(obracuni).toHaveLength(1);
  });

  it('pri oporavku označava nezavršenu partiju kao poništenu', async () => {
    const partijaId = randomUUID();
    await baza.insert(partije).values({ id: partijaId, mod: 'cetiri_igraca', status: 'u_tijeku' });
    const brojPonistenih = await ponistiPartijeUTijekuUBazi([partijaId]);
    const [partija] = await baza.select({ status: partije.status }).from(partije).where(eq(partije.id, partijaId));

    expect(brojPonistenih).toBe(1);
    expect(partija?.status).toBe('ponistena');
    await baza.delete(partije).where(eq(partije.id, partijaId));
  });
});