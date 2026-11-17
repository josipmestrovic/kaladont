import { describe, expect, it } from 'vitest';
import sirovaIzdanja from './izdanja.json';
import {
  IZDANJA,
  NAJNOVIJE_IZDANJE,
  formatirajDatumHr,
  pripremiIzdanja,
  urlIzdanja,
} from './izdanja.js';

// Testovi logike rade nad sintetičkim podacima: PR na dan izdanja mijenja samo
// datum u izdanja.json i ne smije tražiti izmjenu testova.
function zapis(objavljeno: string | null, dodatno: Record<string, unknown> = {}) {
  return { objavljeno, naslov: 'Naslov izdanja', stavke: ['Prva stavka'], ...dodatno };
}

describe('formatirajDatumHr', () => {
  it('ispisuje hrvatski datum bez vodećih nula', () => {
    expect(formatirajDatumHr('2026-11-23')).toBe('23. 11. 2026.');
    expect(formatirajDatumHr('2026-12-05')).toBe('5. 12. 2026.');
    expect(formatirajDatumHr('2027-01-12')).toBe('12. 1. 2027.');
  });

  it('odbija krivi oblik i nepostojeći datum', () => {
    for (const neispravan of ['23. 11. 2026.', '2026-1-5', '2026-02-30', '2026-13-01', '2026-11-23T10:00']) {
      expect(() => formatirajDatumHr(neispravan), neispravan).toThrow(/Neispravan datum/);
    }
    expect(formatirajDatumHr('2028-02-29')).toBe('29. 2. 2028.');
    expect(() => formatirajDatumHr('2027-02-29')).toThrow(/Neispravan datum/);
  });
});

describe('pripremiIzdanja', () => {
  it('izbacuje nacrte', () => {
    const izdanja = pripremiIzdanja([zapis(null, { naslov: 'Nacrt' }), zapis('2026-11-14')]);
    expect(izdanja.map((izdanje) => izdanje.id)).toEqual(['2026-11-14']);
    expect(izdanja.some((izdanje) => izdanje.naslov === 'Nacrt')).toBe(false);
  });

  it('vraća prazan popis kad postoje samo nacrti', () => {
    expect(pripremiIzdanja([zapis(null)])).toEqual([]);
    expect(pripremiIzdanja([])).toEqual([]);
  });

  it('sortira silazno po datumu bez obzira na redoslijed u datoteci', () => {
    const izdanja = pripremiIzdanja([zapis('2026-11-14'), zapis('2027-01-12'), zapis('2026-12-05')]);
    expect(izdanja.map((izdanje) => izdanje.id)).toEqual(['2027-01-12', '2026-12-05', '2026-11-14']);
  });

  it('izvodi sidro, oznaku i hrvatski datum iz datuma objave', () => {
    const [izdanje] = pripremiIzdanja([
      { objavljeno: '2026-12-05', naslov: 'Zimsko izdanje', stavke: ['Prva', 'Druga'] },
    ]);
    expect(izdanje).toEqual({
      id: '2026-12-05',
      objavljeno: '2026-12-05',
      nastavak: 0,
      naslov: 'Zimsko izdanje',
      stavke: ['Prva', 'Druga'],
      sidro: 'izdanje-2026-12-05',
      oznaka: 'v2026.12.05',
      datumHr: '5. 12. 2026.',
    });
  });

  it('podržava više izdanja istoga dana s jedinstvenim sidrima', () => {
    const izdanja = pripremiIzdanja([
      zapis('2026-11-23'),
      zapis('2026-11-23', { nastavak: 2 }),
      zapis('2026-11-23', { nastavak: 1 }),
      zapis('2026-11-14'),
    ]);
    expect(izdanja.map((izdanje) => izdanje.id)).toEqual([
      '2026-11-23-2',
      '2026-11-23-1',
      '2026-11-23',
      '2026-11-14',
    ]);
    expect(izdanja.map((izdanje) => izdanje.sidro)).toEqual([
      'izdanje-2026-11-23-2',
      'izdanje-2026-11-23-1',
      'izdanje-2026-11-23',
      'izdanje-2026-11-14',
    ]);
    expect(izdanja.map((izdanje) => izdanje.oznaka)).toEqual([
      'v2026.11.23.2',
      'v2026.11.23.1',
      'v2026.11.23',
      'v2026.11.14',
    ]);
    expect(new Set(izdanja.map((izdanje) => izdanje.datumHr))).toEqual(
      new Set(['23. 11. 2026.', '14. 11. 2026.']),
    );
  });

  it('odbija neispravne podatke jasnom greškom', () => {
    const slucajevi: [string, unknown, RegExp][] = [
      ['nije polje', { objavljeno: '2026-11-14' }, /polje zapisa/],
      ['zapis nije objekt', ['2026-11-14'], /mora biti objekt/],
      ['objavljeno nedostaje', [{ naslov: 'Naslov', stavke: ['Stavka'] }], /objavljeno mora biti/],
      ['krivi oblik datuma', [zapis('14. 11. 2026.')], /objavljeno mora biti/],
      ['nepostojeći datum', [zapis('2026-02-30')], /objavljeno mora biti/],
      ['datum kao broj', [zapis(null, { objavljeno: 20261114 })], /objavljeno mora biti/],
      ['dvostruki datum', [zapis('2026-11-14'), zapis('2026-11-14')], /isti datum i nastavak/],
      [
        'dvostruki nastavak',
        [zapis('2026-11-14'), zapis('2026-11-14', { nastavak: 1 }), zapis('2026-11-14', { nastavak: 1 })],
        /isti datum i nastavak/,
      ],
      ['nastavak na nacrtu', [zapis(null, { nastavak: 1 })], /nacrt ne smije imati nastavak/],
      ['nastavak nula', [zapis('2026-11-14', { nastavak: 0 })], /cijeli broj veći od 0/],
      ['nastavak decimalan', [zapis('2026-11-14', { nastavak: 1.5 })], /cijeli broj veći od 0/],
      ['nastavak kao tekst', [zapis('2026-11-14', { nastavak: '1' })], /cijeli broj veći od 0/],
      ['nastavak bez prvog izdanja dana', [zapis('2026-11-14', { nastavak: 1 })], /nedostaje izdanje 2026-11-14/],
      [
        'preskočen nastavak',
        [zapis('2026-11-14'), zapis('2026-11-14', { nastavak: 2 })],
        /nedostaje izdanje 2026-11-14-1/,
      ],
      ['prazan naslov', [zapis('2026-11-14', { naslov: '  ' })], /naslov mora biti/],
      ['višeredni naslov', [zapis('2026-11-14', { naslov: 'Prvi\nDrugi' })], /naslov mora biti/],
      ['naslov nije tekst', [zapis('2026-11-14', { naslov: 7 })], /naslov mora biti/],
      ['bez stavki', [zapis('2026-11-14', { stavke: [] })], /stavke moraju biti/],
      ['prazna stavka', [zapis('2026-11-14', { stavke: ['Prva', ' '] })], /stavke moraju biti/],
      ['stavke nisu polje', [zapis('2026-11-14', { stavke: 'Prva' })], /stavke moraju biti/],
      ['nepoznato polje', [zapis('2026-11-14', { redniBroj: 1 })], /nepoznata polja: redniBroj/],
      ['neispravan nacrt', [zapis(null, { stavke: [] })], /stavke moraju biti/],
    ];
    for (const [naziv, podaci, poruka] of slucajevi) {
      expect(() => pripremiIzdanja(podaci), naziv).toThrow(poruka);
    }
  });
});

describe('urlIzdanja', () => {
  it('vodi na sidro zapisa na stranici Novosti', () => {
    const [drugo, prvo] = pripremiIzdanja([zapis('2026-11-23'), zapis('2026-11-23', { nastavak: 1 })]);
    expect(urlIzdanja(prvo)).toBe('/novosti#izdanje-2026-11-23');
    expect(urlIzdanja(drugo)).toBe('/novosti#izdanje-2026-11-23-1');
  });
});

describe('stvarni podaci izdanja', () => {
  it('sadrže barem jedno objavljeno izdanje i nijedan nacrt', () => {
    const brojDatiranih = sirovaIzdanja.filter((sirovo) => sirovo.objavljeno !== null).length;
    expect(IZDANJA.length).toBeGreaterThan(0);
    expect(IZDANJA).toHaveLength(brojDatiranih);
    for (const izdanje of IZDANJA) {
      expect(izdanje.objavljeno).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('najnovije izdanje je prvo, a sidra i oznake su jedinstveni', () => {
    expect(NAJNOVIJE_IZDANJE).toBe(IZDANJA[0]);
    const kljucevi = IZDANJA.map((izdanje) => `${izdanje.objavljeno}#${String(izdanje.nastavak).padStart(4, '0')}`);
    expect(kljucevi).toEqual([...kljucevi].sort().reverse());
    expect(new Set(IZDANJA.map((izdanje) => izdanje.sidro)).size).toBe(IZDANJA.length);
    expect(new Set(IZDANJA.map((izdanje) => izdanje.oznaka)).size).toBe(IZDANJA.length);
  });
});
