import { describe, expect, it } from 'vitest';
import type { MisijaDto, StanjeMisijaDto } from 'zajednicko';
import {
  dostupniXp,
  dnevniBrojac,
  formatirajXp,
  hrBrojOblik,
  oznakaVrsteMisije,
  relativnoDo,
  tekstSlobodnihMjesta,
  tekstZamjenaPreostalo,
  tjedniBrojac,
} from './misije-prikaz.js';

function misija(
  dijelovi: Partial<MisijaDto> & { status: 'aktivna' | 'dovrsena'; dodjelaId: string },
): MisijaDto {
  return {
    xpNagrada: 200,
    ...dijelovi,
  } as MisijaDto;
}

function stub(opcije: {
  dnevneAktivne?: Array<Partial<MisijaDto> & { dodjelaId: string }>;
  danasDovrsene?: Array<Partial<MisijaDto> & { dodjelaId: string }>;
  tjedne?: Array<Partial<MisijaDto> & { status: 'aktivna' | 'dovrsena'; dodjelaId: string }>;
}): StanjeMisijaDto {
  return {
    dnevne: {
      aktivne: (opcije.dnevneAktivne ?? []).map((m) =>
        misija({ status: 'aktivna', xpNagrada: 200, ...m }),
      ),
      danasDovrsene: (opcije.danasDovrsene ?? []).map((m) =>
        misija({ status: 'dovrsena', xpNagrada: 200, ...m }),
      ),
    },
    tjedne: {
      misije: (opcije.tjedne ?? []).map((m) =>
        misija({ xpNagrada: 2000, ...m }),
      ),
    },
  } as StanjeMisijaDto;
}

describe('dostupniXp', () => {
  it('zbraja samo aktivne nedovršene', () => {
    const stanje = stub({
      dnevneAktivne: [{ dodjelaId: 'd1', xpNagrada: 200 }],
      danasDovrsene: [{ dodjelaId: 'd-done', xpNagrada: 200 }],
      tjedne: [
        { dodjelaId: 't1', status: 'aktivna', xpNagrada: 2000 },
        { dodjelaId: 't2', status: 'dovrsena', xpNagrada: 2000 },
        { dodjelaId: 't3', status: 'aktivna', xpNagrada: 2000 },
      ],
    });
    expect(dostupniXp(stanje)).toBe(4200);
  });

  it('vraća 0 kad nema aktivnih', () => {
    expect(dostupniXp(stub({}))).toBe(0);
  });
});

describe('dnevniBrojac', () => {
  it('prazan dan je 0/1', () => {
    expect(dnevniBrojac(stub({}))).toEqual({ zavrseno: 0, ukupno: 1 });
  });

  it('jedna aktivna bez dovršenih je 0/1', () => {
    expect(
      dnevniBrojac(stub({ dnevneAktivne: [{ dodjelaId: 'd1' }] })),
    ).toEqual({ zavrseno: 0, ukupno: 1 });
  });

  it('tri aktivne su 0/3', () => {
    expect(
      dnevniBrojac(
        stub({
          dnevneAktivne: [
            { dodjelaId: 'd1' },
            { dodjelaId: 'd2' },
            { dodjelaId: 'd3' },
          ],
        }),
      ),
    ).toEqual({ zavrseno: 0, ukupno: 3 });
  });

  it('dovršene danas i preostale aktivne zbraja u nazivnik', () => {
    expect(
      dnevniBrojac(
        stub({
          dnevneAktivne: [{ dodjelaId: 'd1' }],
          danasDovrsene: [{ dodjelaId: 'done1' }, { dodjelaId: 'done2' }],
        }),
      ),
    ).toEqual({ zavrseno: 2, ukupno: 3 });
  });
});

describe('tjedniBrojac', () => {
  it('broji dovršene od tri', () => {
    expect(
      tjedniBrojac(
        stub({
          tjedne: [
            { dodjelaId: 't1', status: 'aktivna' },
            { dodjelaId: 't2', status: 'dovrsena' },
            { dodjelaId: 't3', status: 'aktivna' },
          ],
        }),
      ),
    ).toEqual({ zavrseno: 1, ukupno: 3 });
  });
});

describe('formatirajXp', () => {
  it('koristi hr-HR separator', () => {
    expect(formatirajXp(2000)).toBe('2.000');
    expect(formatirajXp(200)).toBe('200');
  });
});

describe('oznakaVrsteMisije', () => {
  it('vraća velika slova', () => {
    expect(oznakaVrsteMisije('dnevna')).toBe('DNEVNA');
    expect(oznakaVrsteMisije('tjedna')).toBe('TJEDNA');
  });
});

describe('tekstZamjenaPreostalo', () => {
  it('gramatika za 0, 1 i više', () => {
    expect(tekstZamjenaPreostalo(0)).toBe('Nema dostupnih zamjena');
    expect(tekstZamjenaPreostalo(1)).toBe('Dostupna 1 zamjena');
    expect(tekstZamjenaPreostalo(2)).toBe('Dostupne 2 zamjene');
  });
});

describe('tekstSlobodnihMjesta', () => {
  it('gramatika za slobodna mjesta', () => {
    expect(tekstSlobodnihMjesta(0)).toBe('0 slobodnih mjesta');
    expect(tekstSlobodnihMjesta(1)).toBe('1 slobodno mjesto');
    expect(tekstSlobodnihMjesta(2)).toBe('2 slobodna mjesta');
    expect(tekstSlobodnihMjesta(5)).toBe('5 slobodnih mjesta');
  });
});

describe('hrBrojOblik', () => {
  it('ispravno sklanja sate uključujući 21–23', () => {
    expect(hrBrojOblik(1, 'sat', 'sata', 'sati')).toBe('1 sat');
    expect(hrBrojOblik(2, 'sat', 'sata', 'sati')).toBe('2 sata');
    expect(hrBrojOblik(5, 'sat', 'sata', 'sati')).toBe('5 sati');
    expect(hrBrojOblik(11, 'sat', 'sata', 'sati')).toBe('11 sati');
    expect(hrBrojOblik(21, 'sat', 'sata', 'sati')).toBe('21 sat');
    expect(hrBrojOblik(22, 'sat', 'sata', 'sati')).toBe('22 sata');
    expect(hrBrojOblik(23, 'sat', 'sata', 'sati')).toBe('23 sata');
  });
});

describe('relativnoDo', () => {
  const baza = new Date('2026-11-25T12:00:00.000Z');

  it('manje od minute', () => {
    expect(relativnoDo(new Date(baza.getTime() + 30_000).toISOString(), baza)).toBe(
      'za manje od minute',
    );
  });

  it('sati i minute', () => {
    expect(relativnoDo(new Date(baza.getTime() + (9 * 60 + 10) * 60_000).toISOString(), baza)).toBe(
      'za 9 h 10 min',
    );
  });

  it('dani i sati', () => {
    expect(
      relativnoDo(new Date(baza.getTime() + (4 * 24 + 9) * 60 * 60_000).toISOString(), baza),
    ).toBe('za 4 dana i 9 sati');
  });

  it('1 dan i 22 sata (ne sati)', () => {
    expect(
      relativnoDo(new Date(baza.getTime() + (1 * 24 + 22) * 60 * 60_000).toISOString(), baza),
    ).toBe('za 1 dan i 22 sata');
  });

  it('prošlo vrijeme ne ide u negativno', () => {
    expect(relativnoDo(new Date(baza.getTime() - 60_000).toISOString(), baza)).toBe(
      'za manje od minute',
    );
  });
});
