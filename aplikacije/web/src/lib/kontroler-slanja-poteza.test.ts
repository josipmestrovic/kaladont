import { describe, expect, it, vi } from 'vitest';
import {
  PORUKA_NEPOZNAT_ISHOD,
  stvoriKontrolerSlanjaPoteza,
} from './kontroler-slanja-poteza.js';

function stvoriSFakeTimeoutom() {
  const handlovi = new Map<number, () => void>();
  let sljedeci = 1;
  const kontroler = stvoriKontrolerSlanjaPoteza({
    trajanjeCekanjaMs: 5_000,
    timeoutApi: {
      postavi: (fn) => {
        const id = sljedeci++;
        handlovi.set(id, fn);
        return id as unknown as ReturnType<typeof setTimeout>;
      },
      ponisti: (id) => {
        handlovi.delete(id as unknown as number);
      },
    },
  });
  return {
    kontroler,
    okiniTimeout: () => {
      for (const [id, fn] of [...handlovi.entries()]) {
        handlovi.delete(id);
        fn();
      }
    },
    brojAktivnihTimeoutova: () => handlovi.size,
  };
}

describe('kontroler-slanja-poteza', () => {
  it('A01: prihvaćen potez čisti timeout i ne ostavlja lažnu grešku', () => {
    const { kontroler, brojAktivnihTimeoutova } = stvoriSFakeTimeoutom();
    const zahtjev = kontroler.pokreniZahtjev({
      partijaId: 'p1',
      turnToken: 't1',
      vrsta: 'rijec',
      rijec: 'auto',
      requestId: 'r1',
    });
    expect(zahtjev?.status).toBe('slanje');
    expect(kontroler.slanjeUTijeku()).toBe(true);

    expect(kontroler.zavrsiZahtjev('prihvacen', { requestId: 'r1' })).toBe(true);
    expect(kontroler.dohvatiAktivni()?.status).toBe('prihvacen');
    expect(brojAktivnihTimeoutova()).toBe(0);
    expect(kontroler.porukaStatusa()).toBeNull();
  });

  it('A02: snimka istog reda ne otključava novi submit', () => {
    const { kontroler } = stvoriSFakeTimeoutom();
    kontroler.pokreniZahtjev({
      partijaId: 'p1',
      turnToken: 't1',
      vrsta: 'rijec',
      rijec: 'auto',
      requestId: 'r1',
    });
    kontroler.snimkaIstogReda('p1', 't1');
    expect(kontroler.dohvatiAktivni()?.status).toBe('slanje');
    expect(kontroler.mozePokrenuti()).toBe(false);
    expect(
      kontroler.pokreniZahtjev({
        partijaId: 'p1',
        turnToken: 't1',
        vrsta: 'rijec',
        rijec: 'brod',
        requestId: 'r2',
      }),
    ).toBeNull();
  });

  it('A03: stari timeout A ne dira zahtjev B', () => {
    const handlovi = new Map<number, () => void>();
    let sljedeci = 1;
    const kontroler = stvoriKontrolerSlanjaPoteza({
      trajanjeCekanjaMs: 5_000,
      timeoutApi: {
        postavi: (fn) => {
          const id = sljedeci++;
          handlovi.set(id, fn);
          return id as unknown as ReturnType<typeof setTimeout>;
        },
        ponisti: (id) => {
          handlovi.delete(id as unknown as number);
        },
      },
    });

    kontroler.pokreniZahtjev({
      partijaId: 'p1',
      turnToken: 't1',
      vrsta: 'rijec',
      rijec: 'auto',
      requestId: 'A',
    });
    const timeoutA = [...handlovi.values()][0];
    expect(timeoutA).toBeTypeOf('function');

    kontroler.zavrsiZahtjev('prihvacen', { requestId: 'A' });
    kontroler.pokreniZahtjev({
      partijaId: 'p1',
      turnToken: 't2',
      vrsta: 'rijec',
      rijec: 'brod',
      requestId: 'B',
    });
    expect(kontroler.dohvatiAktivni()?.requestId).toBe('B');

    // Zastarjeli callback A
    timeoutA!();
    expect(kontroler.dohvatiAktivni()?.requestId).toBe('B');
    expect(kontroler.dohvatiAktivni()?.status).toBe('slanje');
  });

  it('A04: timeout prelazi u nepoznat_ishod bez lažnog odbijanja', () => {
    const { kontroler, okiniTimeout } = stvoriSFakeTimeoutom();
    kontroler.pokreniZahtjev({
      partijaId: 'p1',
      turnToken: 't1',
      vrsta: 'rijec',
      rijec: 'auto',
      requestId: 'r1',
    });
    okiniTimeout();
    expect(kontroler.dohvatiAktivni()?.status).toBe('nepoznat_ishod');
    expect(kontroler.porukaStatusa()).toBe(PORUKA_NEPOZNAT_ISHOD);
    expect(kontroler.mozePokrenuti()).toBe(false);
  });

  it('A05: Enter/klik tijekom slanja ne pokreće drugi zahtjev', () => {
    const { kontroler } = stvoriSFakeTimeoutom();
    expect(
      kontroler.pokreniZahtjev({
        partijaId: 'p1',
        turnToken: 't1',
        vrsta: 'rijec',
        rijec: 'auto',
        requestId: 'r1',
      }),
    ).not.toBeNull();
    expect(
      kontroler.pokreniZahtjev({
        partijaId: 'p1',
        turnToken: 't1',
        vrsta: 'ne-znam',
        requestId: 'r2',
      }),
    ).toBeNull();
    expect(kontroler.dohvatiAktivni()?.requestId).toBe('r1');
  });

  it('A06: cleanup na odlasku je idempotentan i sprječava naknadni utjecaj', () => {
    const { kontroler, okiniTimeout } = stvoriSFakeTimeoutom();
    kontroler.pokreniZahtjev({
      partijaId: 'p1',
      turnToken: 't1',
      vrsta: 'rijec',
      rijec: 'auto',
      requestId: 'r1',
    });
    kontroler.ocisti();
    expect(kontroler.dohvatiAktivni()).toBeNull();
    kontroler.ocisti();
    okiniTimeout();
    expect(kontroler.dohvatiAktivni()).toBeNull();
    expect(kontroler.zavrsiZahtjev('prihvacen', { requestId: 'r1' })).toBe(false);
  });

  it('zavrsiZahtjev ignorira tuđi requestId', () => {
    const { kontroler } = stvoriSFakeTimeoutom();
    kontroler.pokreniZahtjev({
      partijaId: 'p1',
      turnToken: 't1',
      vrsta: 'rijec',
      requestId: 'r1',
    });
    expect(kontroler.zavrsiZahtjev('odbijen', { requestId: 'drugi' })).toBe(false);
    expect(kontroler.dohvatiAktivni()?.status).toBe('slanje');
  });

  it('promjena tokena prebacuje slanje u nepoznat_ishod', () => {
    const { kontroler, brojAktivnihTimeoutova } = stvoriSFakeTimeoutom();
    kontroler.pokreniZahtjev({
      partijaId: 'p1',
      turnToken: 't1',
      vrsta: 'rijec',
      requestId: 'r1',
    });
    kontroler.obavijestiPromjenuReda('p1', 't2');
    expect(kontroler.dohvatiAktivni()?.status).toBe('nepoznat_ishod');
    expect(brojAktivnihTimeoutova()).toBe(0);
  });
});
