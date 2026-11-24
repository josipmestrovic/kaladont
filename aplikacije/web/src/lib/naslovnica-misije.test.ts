import { describe, expect, it } from 'vitest';
import type { MisijaDto, StanjeMisijaDto } from 'zajednicko';
import {
  ariaBadgaMisija,
  izracunajAktivneMisije,
  labelaAktivnihMisija,
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
  it('ne koristi broj aktivnih kao notifikacijski badge', () => {
    expect(natpisBadgaMisija({ dnevneAktivne: 0, tjedneAktivne: 0, ukupnoAktivnih: 0 })).toBeNull();
    expect(natpisBadgaMisija({ dnevneAktivne: 2, tjedneAktivne: 1, ukupnoAktivnih: 3 })).toBeNull();
  });
});

describe('labelaAktivnihMisija', () => {
  it('formatira podnaslov', () => {
    expect(labelaAktivnihMisija({ dnevneAktivne: 0, tjedneAktivne: 0, ukupnoAktivnih: 0 })).toBe(
      '0 aktivnih',
    );
    expect(labelaAktivnihMisija({ dnevneAktivne: 1, tjedneAktivne: 0, ukupnoAktivnih: 1 })).toBe(
      '1 aktivna',
    );
    expect(labelaAktivnihMisija({ dnevneAktivne: 2, tjedneAktivne: 1, ukupnoAktivnih: 3 })).toBe(
      '3 aktivne',
    );
  });
});

describe('ariaBadgaMisija', () => {
  it('opisuje ukupan broj', () => {
    expect(ariaBadgaMisija({ dnevneAktivne: 2, tjedneAktivne: 1, ukupnoAktivnih: 3 })).toBe(
      '3 aktivne misije',
    );
  });
});
