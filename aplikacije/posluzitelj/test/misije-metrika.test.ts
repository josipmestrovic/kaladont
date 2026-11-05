import { describe, expect, it } from 'vitest';
import { definicijaMisije, type MetrikeMisijaIgre } from 'zajednicko';
import { primijeniMetrikuNaDodjelu } from '../src/misije/metrika.js';
import { snapshotIzDefinicije } from '../src/misije/generator.js';

function bazaMetrike(overrides: Partial<MetrikeMisijaIgre> = {}): MetrikeMisijaIgre {
  return {
    izvorId: '00000000-0000-4000-8000-000000000001',
    kontekst: 'javna',
    mod: 'cetiri_igraca',
    igracId: '00000000-0000-4000-8000-000000000002',
    zavrsenoU: new Date('2026-11-04T12:00:00Z'),
    plasman: 2,
    nacinIspadanja: 'ne_znam',
    prihvaceneRijeci: 5,
    najduziNiz: 5,
    dugeRijeci: 1,
    jakoDugeRijeci: 0,
    rijetkeRijeci: 1,
    jakoRijetkeRijeci: 0,
    dugeIRijetkeRijeci: 1,
    eliminacije: 0,
    kaladontIzvedbe: 0,
    razlicitiPoceci: ['ka'],
    ...overrides,
  };
}

describe('metrike misija', () => {
  it('D17 traži dugu i rijetku u istom potezu (brojač dugeIRijetke)', () => {
    const d = definicijaMisije('D17')!;
    const r1 = primijeniMetrikuNaDodjelu({
      predlozakId: 'D17',
      snapshot: snapshotIzDefinicije(d),
      napredak: 0,
      podstanje: {},
      metrike: bazaMetrike({ dugeIRijetkeRijeci: 0, dugeRijeci: 1, rijetkeRijeci: 1 }),
    });
    expect(r1.noviNapredak).toBe(0);

    const r2 = primijeniMetrikuNaDodjelu({
      predlozakId: 'D17',
      snapshot: snapshotIzDefinicije(d),
      napredak: 0,
      podstanje: {},
      metrike: bazaMetrike({ dugeIRijetkeRijeci: 1 }),
    });
    expect(r2.noviNapredak).toBe(1);
  });

  it('W03 broji partije s nizom ≥5, ne zbraja nizove', () => {
    const d = definicijaMisije('W03')!;
    const r = primijeniMetrikuNaDodjelu({
      predlozakId: 'W03',
      snapshot: snapshotIzDefinicije(d),
      napredak: 1,
      podstanje: {},
      metrike: bazaMetrike({ najduziNiz: 10 }),
    });
    expect(r.noviNapredak).toBe(2);
  });

  it('D19 prihvaća plasman 2 u Četveroboju', () => {
    const d = definicijaMisije('D19')!;
    const r = primijeniMetrikuNaDodjelu({
      predlozakId: 'D19',
      snapshot: snapshotIzDefinicije(d),
      napredak: 0,
      podstanje: {},
      metrike: bazaMetrike({ plasman: 2, mod: 'cetiri_igraca' }),
    });
    expect(r.noviNapredak).toBe(1);
  });

  it('trening ne pomiče javnu D09', () => {
    const d = definicijaMisije('D09')!;
    const r = primijeniMetrikuNaDodjelu({
      predlozakId: 'D09',
      snapshot: snapshotIzDefinicije(d),
      napredak: 0,
      podstanje: {},
      metrike: bazaMetrike({ kontekst: 'trening', mod: 'dva_igraca', plasman: 1 }),
    });
    expect(r.noviNapredak).toBe(0);
  });
});
