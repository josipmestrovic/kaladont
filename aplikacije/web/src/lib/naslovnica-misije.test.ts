import { describe, expect, it } from 'vitest';
import type { MisijaDto, StanjeMisijaDto } from 'zajednicko';
import {
  ariaBadgaMisija,
  izracunajAktivneMisije,
  natpisBadgaMisija,
} from './naslovnica-misije.js';

function misija(status: 'aktivna' | 'dovrsena', id: string): MisijaDto {
  return { status, dodjelaId: id } as MisijaDto;
}

function stub(opcije: {
  dnevne?: number;
  tjedneAktivne?: number;
  tjedneDovrsene?: number;
}): StanjeMisijaDto {
  return {
    dnevne: {
      aktivne: Array.from({ length: opcije.dnevne ?? 0 }, (_, i) => misija('aktivna', `d-${i}`)),
    },
    tjedne: {
      misije: [
        ...Array.from({ length: opcije.tjedneAktivne ?? 0 }, (_, i) => misija('aktivna', `t-a-${i}`)),
        ...Array.from({ length: opcije.tjedneDovrsene ?? 0 }, (_, i) =>
          misija('dovrsena', `t-d-${i}`),
        ),
      ],
    },
  } as StanjeMisijaDto;
}

describe('izracunajAktivneMisije', () => {
  it('broji dnevne i samo aktivne tjedne', () => {
    const prikaz = izracunajAktivneMisije(
      stub({ dnevne: 2, tjedneAktivne: 1, tjedneDovrsene: 2 }),
    );
    expect(prikaz).toEqual({ dnevneAktivne: 2, tjedneAktivne: 1, ukupnoAktivnih: 3 });
  });
});

describe('natpisBadgaMisija', () => {
  it('skriva badge bez aktivnih', () => {
    expect(natpisBadgaMisija({ dnevneAktivne: 0, tjedneAktivne: 0, ukupnoAktivnih: 0 })).toBeNull();
  });

  it('prikazuje dnevne·tjedne', () => {
    expect(natpisBadgaMisija({ dnevneAktivne: 2, tjedneAktivne: 1, ukupnoAktivnih: 3 })).toBe('2·1');
  });
});

describe('ariaBadgaMisija', () => {
  it('opisuje brojeve', () => {
    expect(ariaBadgaMisija({ dnevneAktivne: 2, tjedneAktivne: 1, ukupnoAktivnih: 3 })).toBe(
      '2 dnevnih i 1 tjednih aktivnih misija',
    );
  });
});
