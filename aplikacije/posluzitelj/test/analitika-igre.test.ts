import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { agregirajDnevneIgre, mapirajVrstuRacuna, upsertKrajIgre, upsertPocetakIgre } from '../src/analitika/igre.js';
import { danasZagrebIso } from '../src/analitika/otvaranja.js';

describe('analitika igre', () => {
  it('mapira admina kao registriranog', () => {
    expect(mapirajVrstuRacuna('admin')).toBe('registriran');
    expect(mapirajVrstuRacuna('gost')).toBe('gost');
  });

  it('računa G1/G2, omjer gost/reg i postotak 2+ igara', async () => {
    const dan = danasZagrebIso();
    const sada = new Date();
    const igracA = randomUUID();
    const igracB = randomUUID();
    const igracC = randomUUID();
    const igracD = randomUUID();
    const igra1 = randomUUID();
    const igra2 = randomUUID();
    const igra3 = randomUUID();

    await upsertPocetakIgre({
      igraId: igra1,
      kontekst: 'javna',
      mod: 'cetiri_igraca',
      pocetakU: sada,
      sudionici: [
        { igracId: igracA, vrstaRacunaNaPocetku: 'gost' },
        { igracId: igracB, vrstaRacunaNaPocetku: 'gost' },
        { igracId: igracC, vrstaRacunaNaPocetku: 'registriran' },
        { igracId: igracD, vrstaRacunaNaPocetku: 'registriran' },
      ],
    });
    await upsertKrajIgre(igra1, sada, 'zavrsena');

    await upsertPocetakIgre({
      igraId: igra2,
      kontekst: 'javna',
      mod: 'dva_igraca',
      pocetakU: sada,
      sudionici: [{ igracId: igracA, vrstaRacunaNaPocetku: 'gost' }],
    });
    await upsertKrajIgre(igra2, sada, 'zavrsena');

    await upsertPocetakIgre({
      igraId: igra3,
      kontekst: 'trening',
      mod: 'dva_igraca',
      pocetakU: sada,
      sudionici: [{ igracId: igracB, vrstaRacunaNaPocetku: 'gost' }],
    });
    await upsertKrajIgre(igra3, sada, 'zavrsena');

    const sve = await agregirajDnevneIgre({ odDan: dan, doDan: dan });
    const danRed = sve.dani.find((d) => d.dan === dan);
    expect(danRed?.zapocete).toBeGreaterThanOrEqual(3);
    expect(danRed?.zavrsene).toBeGreaterThanOrEqual(3);

    // A ima 2 igre → ulazi u 2+; B,C,D imaju po 1 u “sve” kontekstu uz A → barem 1 s 2+
    expect(sve.ljudi.igraci).toBeGreaterThanOrEqual(4);
    expect(sve.ljudi.igraciS2Plus).toBeGreaterThanOrEqual(1);
    expect(sve.ljudi.postotakGost).not.toBeNull();
    expect(sve.ljudi.postotakRegistriran).not.toBeNull();

    const samoJedan = await agregirajDnevneIgre({ odDan: dan, doDan: dan, kontekst: 'javna' });
    // U javnim: A=2, B=1, C=1, D=1 → 25% s 2+
    expect(samoJedan.ljudi.igraci).toBeGreaterThanOrEqual(4);
    expect(samoJedan.ljudi.igraciS2Plus).toBeGreaterThanOrEqual(1);
  });
});
