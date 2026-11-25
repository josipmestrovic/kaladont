import { describe, expect, it } from 'vitest';
import {
  dohvatiIshodNaredbe,
  MAKS_CACHE_ISHODA_PO_IGRACU,
  potvrdaIzRezultataNaredbe,
  stvoriCacheIshodaNaredbi,
  zapamtiIshodNaredbe,
} from '../src/igra/naredbe-poteza.js';

describe('naredbe-poteza cache', () => {
  it('B01: duplikat istog zahtjeva vraća isti ishod', () => {
    const cache = stvoriCacheIshodaNaredbi();
    const kljuc = {
      requestId: '11111111-1111-4111-8111-111111111111',
      igracId: 'igrac',
      vrsta: 'rijec' as const,
      turnToken: 'tok',
      rijec: 'auto',
    };
    const potvrda = potvrdaIzRezultataNaredbe(
      { partijaId: 'p1', requestId: kljuc.requestId, turnToken: 'tok', verzijaStanja: 2 },
      { ishod: 'prihvacen' },
    );
    zapamtiIshodNaredbe(cache, kljuc, potvrda);
    const hit = dohvatiIshodNaredbe(cache, kljuc);
    expect(hit).toEqual({ vrsta: 'isti', potvrda });
  });

  it('B02: isti ID s drugom riječi je konflikt', () => {
    const cache = stvoriCacheIshodaNaredbi();
    const requestId = '11111111-1111-4111-8111-111111111111';
    zapamtiIshodNaredbe(
      cache,
      { requestId, igracId: 'igrac', vrsta: 'rijec', turnToken: 'tok', rijec: 'auto' },
      potvrdaIzRezultataNaredbe(
        { partijaId: 'p1', requestId, turnToken: 'tok', verzijaStanja: 1 },
        { ishod: 'prihvacen' },
      ),
    );
    expect(
      dohvatiIshodNaredbe(cache, {
        requestId,
        igracId: 'igrac',
        vrsta: 'rijec',
        turnToken: 'tok',
        rijec: 'brod',
      }),
    ).toEqual({ vrsta: 'konflikt' });
  });

  it('ograničava cache na 64 zapisa po igraču', () => {
    const cache = stvoriCacheIshodaNaredbi();
    for (let i = 0; i < MAKS_CACHE_ISHODA_PO_IGRACU + 5; i += 1) {
      const requestId = `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
      zapamtiIshodNaredbe(
        cache,
        { requestId, igracId: 'igrac', vrsta: 'rijec', turnToken: 't', rijec: `r${i}` },
        potvrdaIzRezultataNaredbe(
          { partijaId: 'p', requestId, turnToken: 't', verzijaStanja: i },
          { ishod: 'prihvacen' },
        ),
      );
    }
    expect(cache.get('igrac')).toHaveLength(MAKS_CACHE_ISHODA_PO_IGRACU);
  });
});
