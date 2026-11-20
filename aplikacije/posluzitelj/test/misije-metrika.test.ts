import { describe, expect, it } from 'vitest';
import { DEFINICIJE_MISIJA, definicijaMisije, type MetrikeMisijaIgre } from 'zajednicko';
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
    // PR12 obavezna polja — default KA-ZNA / nespojeni stol.
    pravila: 'ka_zna',
    odabranaPravila: 'ka_zna',
    spojeniDvoboj: false,
    uspjesniDokazi: 0,
    kaladontSljedeciUzTriPlus: 0,
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

describe('PR12 — osam novih predložaka', () => {
  it('pool ima 25 dnevnih i 25 tjednih (PR04 D25/W25)', () => {
    expect(DEFINICIJE_MISIJA.filter((d) => d.vrsta === 'dnevna' && d.aktivna)).toHaveLength(25);
    expect(DEFINICIJE_MISIJA.filter((d) => d.vrsta === 'tjedna' && d.aktivna)).toHaveLength(25);
  });

  it('copy nikad ne koristi riječ partija', () => {
    for (const id of ['D21', 'D22', 'D23', 'D24', 'W21', 'W22', 'W23', 'W24'] as const) {
      const d = definicijaMisije(id)!;
      expect(d.opis.toLowerCase()).not.toMatch(/partij/);
      expect(d.naziv.toLowerCase()).not.toMatch(/partij/);
    }
  });

  // --- D21 ---
  it('D21+: javni Troboj s riječju', () => {
    const d = definicijaMisije('D21')!;
    const r = primijeniMetrikuNaDodjelu({
      predlozakId: 'D21',
      snapshot: snapshotIzDefinicije(d),
      napredak: 0,
      podstanje: {},
      metrike: bazaMetrike({ mod: 'tri_igraca', prihvaceneRijeci: 1 }),
    });
    expect(r.noviNapredak).toBe(1);
  });

  it('D21−: Četveroboj ne broji', () => {
    const d = definicijaMisije('D21')!;
    const r = primijeniMetrikuNaDodjelu({
      predlozakId: 'D21',
      snapshot: snapshotIzDefinicije(d),
      napredak: 0,
      podstanje: {},
      metrike: bazaMetrike({ mod: 'cetiri_igraca', prihvaceneRijeci: 2 }),
    });
    expect(r.noviNapredak).toBe(0);
  });

  // --- W21 ---
  it('W21+: pobjeda Troboj; na cilju 3/3', () => {
    const d = definicijaMisije('W21')!;
    const snap = snapshotIzDefinicije(d);
    const r1 = primijeniMetrikuNaDodjelu({
      predlozakId: 'W21',
      snapshot: snap,
      napredak: 2,
      podstanje: {},
      metrike: bazaMetrike({ mod: 'tri_igraca', plasman: 1, prihvaceneRijeci: 1 }),
    });
    expect(r1.noviNapredak).toBe(3);
  });

  it('W21−: poraz Troboj', () => {
    const d = definicijaMisije('W21')!;
    const r = primijeniMetrikuNaDodjelu({
      predlozakId: 'W21',
      snapshot: snapshotIzDefinicije(d),
      napredak: 1,
      podstanje: {},
      metrike: bazaMetrike({ mod: 'tri_igraca', plasman: 2, prihvaceneRijeci: 1 }),
    });
    expect(r.noviNapredak).toBe(1);
  });

  // --- D22 ---
  it('D22+: 3 riječi u jednoj dokaz-igri', () => {
    const d = definicijaMisije('D22')!;
    const r = primijeniMetrikuNaDodjelu({
      predlozakId: 'D22',
      snapshot: snapshotIzDefinicije(d),
      napredak: 0,
      podstanje: {},
      metrike: bazaMetrike({
        pravila: 'dokazi_nastavak',
        odabranaPravila: 'dokazi_nastavak',
        prihvaceneRijeci: 3,
      }),
    });
    expect(r.noviNapredak).toBe(3);
  });

  it('D22−: max u jednoj igri — 2 jučer + 1 danas ≠ dovršeno', () => {
    // HINT: rijeci_u_partiji_max uzima Math.max(napredak, prihvacene); zbroj između igara ne postoji.
    const d = definicijaMisije('D22')!;
    const snap = snapshotIzDefinicije(d);
    const jucer = primijeniMetrikuNaDodjelu({
      predlozakId: 'D22',
      snapshot: snap,
      napredak: 0,
      podstanje: {},
      metrike: bazaMetrike({
        pravila: 'dokazi_nastavak',
        odabranaPravila: 'dokazi_nastavak',
        prihvaceneRijeci: 2,
      }),
    });
    expect(jucer.noviNapredak).toBe(2);
    const danas = primijeniMetrikuNaDodjelu({
      predlozakId: 'D22',
      snapshot: snap,
      napredak: jucer.noviNapredak,
      podstanje: {},
      metrike: bazaMetrike({
        pravila: 'dokazi_nastavak',
        odabranaPravila: 'dokazi_nastavak',
        prihvaceneRijeci: 1,
      }),
    });
    expect(danas.noviNapredak).toBe(2);
  });

  // --- W22 ---
  it('W22+: jedan dokaz → +1; dva dokaza u istoj igri i dalje +1', () => {
    const d = definicijaMisije('W22')!;
    const snap = snapshotIzDefinicije(d);
    const r1 = primijeniMetrikuNaDodjelu({
      predlozakId: 'W22',
      snapshot: snap,
      napredak: 0,
      podstanje: {},
      metrike: bazaMetrike({ uspjesniDokazi: 2, prihvaceneRijeci: 2 }),
    });
    expect(r1.noviNapredak).toBe(1);
  });

  it('W22−: bez dokaza', () => {
    const d = definicijaMisije('W22')!;
    const r = primijeniMetrikuNaDodjelu({
      predlozakId: 'W22',
      snapshot: snapshotIzDefinicije(d),
      napredak: 0,
      podstanje: {},
      metrike: bazaMetrike({ uspjesniDokazi: 0, prihvaceneRijeci: 3 }),
    });
    expect(r.noviNapredak).toBe(0);
  });

  // --- D23 ---
  it('D23+: klasični Troboj', () => {
    const d = definicijaMisije('D23')!;
    const r = primijeniMetrikuNaDodjelu({
      predlozakId: 'D23',
      snapshot: snapshotIzDefinicije(d),
      napredak: 0,
      podstanje: {},
      metrike: bazaMetrike({
        mod: 'tri_igraca',
        pravila: 'klasicni',
        odabranaPravila: 'klasicni',
        prihvaceneRijeci: 1,
      }),
    });
    expect(r.noviNapredak).toBe(1);
  });

  it('D23−: klasični Dvoboj ne broji', () => {
    const d = definicijaMisije('D23')!;
    const r = primijeniMetrikuNaDodjelu({
      predlozakId: 'D23',
      snapshot: snapshotIzDefinicije(d),
      napredak: 0,
      podstanje: {},
      metrike: bazaMetrike({
        mod: 'dva_igraca',
        pravila: 'klasicni',
        odabranaPravila: 'klasicni',
        prihvaceneRijeci: 2,
      }),
    });
    expect(r.noviNapredak).toBe(0);
  });

  // --- W23 ---
  it('W23+: kaladont sljedeći uz ≥3 aktivna', () => {
    const d = definicijaMisije('W23')!;
    const r = primijeniMetrikuNaDodjelu({
      predlozakId: 'W23',
      snapshot: snapshotIzDefinicije(d),
      napredak: 0,
      podstanje: {},
      metrike: bazaMetrike({
        pravila: 'klasicni',
        odabranaPravila: 'klasicni',
        kaladontSljedeciUzTriPlus: 1,
        prihvaceneRijeci: 1,
      }),
    });
    expect(r.noviNapredak).toBe(1);
  });

  it('W23−: kad ostanu dvoje (brojač 0) ili pogrešan pravilnik', () => {
    const d = definicijaMisije('W23')!;
    const snap = snapshotIzDefinicije(d);
    const bezBrojaca = primijeniMetrikuNaDodjelu({
      predlozakId: 'W23',
      snapshot: snap,
      napredak: 0,
      podstanje: {},
      metrike: bazaMetrike({
        pravila: 'klasicni',
        odabranaPravila: 'klasicni',
        kaladontSljedeciUzTriPlus: 0,
        kaladontIzvedbe: 1,
        prihvaceneRijeci: 1,
      }),
    });
    expect(bezBrojaca.noviNapredak).toBe(0);

    const kriviPravilnik = primijeniMetrikuNaDodjelu({
      predlozakId: 'W23',
      snapshot: snap,
      napredak: 0,
      podstanje: {},
      metrike: bazaMetrike({
        pravila: 'ka_zna',
        odabranaPravila: 'ka_zna',
        kaladontSljedeciUzTriPlus: 2,
        prihvaceneRijeci: 1,
      }),
    });
    expect(kriviPravilnik.noviNapredak).toBe(0);
  });

  // --- D24 / W24 spojeni Dvoboj ---
  it('D24+: spojeni Dvoboj — KA-ZNA odabir broji riječi', () => {
    const d = definicijaMisije('D24')!;
    const r = primijeniMetrikuNaDodjelu({
      predlozakId: 'D24',
      snapshot: snapshotIzDefinicije(d),
      napredak: 0,
      podstanje: {},
      metrike: bazaMetrike({
        mod: 'dva_igraca',
        pravila: 'ka_zna',
        odabranaPravila: 'ka_zna',
        spojeniDvoboj: true,
        prihvaceneRijeci: 4,
      }),
    });
    expect(r.noviNapredak).toBe(4);
  });

  it('D24−: spojeni Dvoboj — Klasični odabir ne broji', () => {
    const d = definicijaMisije('D24')!;
    const r = primijeniMetrikuNaDodjelu({
      predlozakId: 'D24',
      snapshot: snapshotIzDefinicije(d),
      napredak: 0,
      podstanje: {},
      metrike: bazaMetrike({
        mod: 'dva_igraca',
        pravila: 'ka_zna',
        odabranaPravila: 'klasicni',
        spojeniDvoboj: true,
        prihvaceneRijeci: 4,
      }),
    });
    expect(r.noviNapredak).toBe(0);
  });

  it('W24+: pobjeda s odabirom KA-ZNA', () => {
    const d = definicijaMisije('W24')!;
    const r = primijeniMetrikuNaDodjelu({
      predlozakId: 'W24',
      snapshot: snapshotIzDefinicije(d),
      napredak: 4,
      podstanje: {},
      metrike: bazaMetrike({
        mod: 'dva_igraca',
        pravila: 'ka_zna',
        odabranaPravila: 'ka_zna',
        spojeniDvoboj: true,
        plasman: 1,
        prihvaceneRijeci: 1,
      }),
    });
    expect(r.noviNapredak).toBe(5);
  });

  it('W24−: pobjeda s odabirom Klasični na spojenom stolu', () => {
    const d = definicijaMisije('W24')!;
    const r = primijeniMetrikuNaDodjelu({
      predlozakId: 'W24',
      snapshot: snapshotIzDefinicije(d),
      napredak: 0,
      podstanje: {},
      metrike: bazaMetrike({
        mod: 'dva_igraca',
        pravila: 'ka_zna',
        odabranaPravila: 'klasicni',
        spojeniDvoboj: true,
        plasman: 1,
        prihvaceneRijeci: 2,
      }),
    });
    expect(r.noviNapredak).toBe(0);
  });

  it('mod=oba stari snapshot + Troboj napreduje D01; D12 podciljevi ne', () => {
    const d01 = definicijaMisije('D01')!;
    const r01 = primijeniMetrikuNaDodjelu({
      predlozakId: 'D01',
      snapshot: snapshotIzDefinicije(d01),
      napredak: 0,
      podstanje: {},
      metrike: bazaMetrike({ mod: 'tri_igraca', prihvaceneRijeci: 1 }),
    });
    expect(r01.noviNapredak).toBe(1);

    const d12 = definicijaMisije('D12')!;
    const r12 = primijeniMetrikuNaDodjelu({
      predlozakId: 'D12',
      snapshot: snapshotIzDefinicije(d12),
      napredak: 0,
      podstanje: { podciljevi: {} },
      metrike: bazaMetrike({ mod: 'tri_igraca', prihvaceneRijeci: 1 }),
    });
    expect(r12.noviNapredak).toBe(0);
    expect(r12.novoPodstanje.podciljevi?.tri_igraca).toBeUndefined();
  });

  it('trening ne pomiče D21', () => {
    const d = definicijaMisije('D21')!;
    const r = primijeniMetrikuNaDodjelu({
      predlozakId: 'D21',
      snapshot: snapshotIzDefinicije(d),
      napredak: 0,
      podstanje: {},
      metrike: bazaMetrike({
        kontekst: 'trening',
        mod: 'tri_igraca',
        prihvaceneRijeci: 2,
      }),
    });
    expect(r.noviNapredak).toBe(0);
  });
});

describe('PR04 — Izazov misije', () => {
  it('D25 broji izazov pokušaj; javna ne pomiče', () => {
    const d = definicijaMisije('D25')!;
    expect(d.kontekst).toBe('izazov');
    expect(d.metrika).toBe('izazov_pokusaji');
    const ok = primijeniMetrikuNaDodjelu({
      predlozakId: 'D25',
      snapshot: snapshotIzDefinicije(d),
      napredak: 0,
      podstanje: {},
      metrike: bazaMetrike({ kontekst: 'izazov', mod: 'dva_igraca', prihvaceneRijeci: 1 }),
    });
    expect(ok.noviNapredak).toBe(1);
    const skip = primijeniMetrikuNaDodjelu({
      predlozakId: 'D25',
      snapshot: snapshotIzDefinicije(d),
      napredak: 0,
      podstanje: {},
      metrike: bazaMetrike({ kontekst: 'javna', prihvaceneRijeci: 3 }),
    });
    expect(skip.noviNapredak).toBe(0);
  });
});
