import { describe, expect, it } from 'vitest';
import { BROJ_AKTIVNIH_IZAZOVA, type OdgovorKatalogaIzazova } from 'zajednicko';
import { defaultOpisIzazova, izracunajPrikazIzazova } from './naslovnica-izazovi.js';

function odgovor(zavrseno: number, ukupno = BROJ_AKTIVNIH_IZAZOVA): OdgovorKatalogaIzazova {
  return {
    ok: true,
    omogucen: true,
    definitionVersion: 3,
    katalog: Array.from({ length: ukupno }, (_, i) => ({ id: `IZ-${i}` })) as OdgovorKatalogaIzazova['katalog'],
    napredak: {
      zavrseniChallengeIds: [],
      aktivniPokusaj: null,
      izazivacZvjezdice: 0,
      leveli: [
        {
          level: 1,
          naziv: 'L1',
          profileId: 'pocetnik',
          zavrseno,
          ukupno: 15,
          status: 'dostupan',
          formati: [],
        },
      ],
    },
  };
}

describe('naslovnica-izazovi', () => {
  it('default opis koristi lagani broj', () => {
    expect(defaultOpisIzazova()).toBe(`Svladavaj ${BROJ_AKTIVNIH_IZAZOVA} sve težih izazova.`);
  });

  it('pri 0 završenih nema trake', () => {
    expect(izracunajPrikazIzazova(odgovor(0))).toEqual({
      vrsta: 'default',
      opis: defaultOpisIzazova(),
    });
  });

  it('pri djelomičnom napretku prikazuje traku', () => {
    const prikaz = izracunajPrikazIzazova(odgovor(15));
    expect(prikaz).toMatchObject({
      vrsta: 'napredak',
      opis: 'Nastavi tamo gdje si stao.',
      zavrseno: 15,
      ukupno: BROJ_AKTIVNIH_IZAZOVA,
    });
  });

  it('pri grešci ili isključenom katalogu ostaje default', () => {
    expect(izracunajPrikazIzazova(null).vrsta).toBe('default');
    expect(izracunajPrikazIzazova({ ...odgovor(10), omogucen: false }).vrsta).toBe('default');
  });
});
