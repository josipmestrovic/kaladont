import { describe, expect, it, vi } from 'vitest';
import type { DogadajPoteza, RezultatNaredbe } from '../src/igra/politika-ucinka.js';
import { BotKontroler } from '../src/bot/kontroler.js';
import { ZADANA_KONFIGURACIJA_BOTA, ucitajKonfiguracijuBota, type KonfiguracijaBota } from '../src/bot/konfiguracija-bota.js';
import { Vrecica, odaberiPotez, stvoriStanjeBota, trajanjeRazmisljanjaMs } from '../src/bot/odabir-rijeci.js';

/** Deterministički RNG (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function laznaRijec(rijeci: Record<string, { frekvencija: number; grupe: string[] }>) {
  return {
    frekvencijaZa: (rijec: string) => rijeci[rijec]?.frekvencija ?? null,
    grupeZa: (rijec: string) => rijeci[rijec]?.grupe ?? [],
  };
}

const konfigBezPropusta: KonfiguracijaBota = { ...ZADANA_KONFIGURACIJA_BOTA, vjerojatnostOstavljanjaKa: 0, vjerojatnostPropusta: 0, vjerojatnostIsteka: 0 };

describe('vrećica', () => {
  it('poštuje udjele kroz jedan ciklus i puni se iznova', () => {
    const vrecica = new Vrecica([{ vrijednost: 'a', udio: 80 }, { vrijednost: 'b', udio: 20 }], rng(1));
    const brojac = { a: 0, b: 0 };
    for (let i = 0; i < 100; i += 1) brojac[vrecica.izvuci() as 'a' | 'b'] += 1;
    expect(brojac).toEqual({ a: 80, b: 20 });
    expect(['a', 'b']).toContain(vrecica.izvuci());
  });
});

describe('odabir riječi bota', () => {
  const rjecnik = laznaRijec({
    maslac: { frekvencija: 500, grupe: ['imenica:maslac'] },
    masa: { frekvencija: 900, grupe: ['imenica:masa'] },
    mast: { frekvencija: 300, grupe: ['imenica:mast'] },
    mastilo: { frekvencija: 20, grupe: ['imenica:mastilo'] },
    mastodont: { frekvencija: 0, grupe: ['imenica:mastodont'] },
    maska: { frekvencija: 400, grupe: ['imenica:maska'] },
  });

  it('ne bira rijetke oblike kada postoje popularne osnovne imenice', () => {
    const r = rng(7);
    const stanje = stvoriStanjeBota(konfigBezPropusta, r);
    const odabrane = new Set<string>();
    for (let i = 0; i < 400; i += 1) {
      const odluka = odaberiPotez({ trazenaSlova: 'ma', kandidati: ['maslac', 'masa', 'mast', 'mastilo', 'mastodont'], ...rjecnik }, stanje, konfigBezPropusta, r);
      if (odluka.vrsta === 'rijec') odabrane.add(odluka.rijec);
    }
    expect(odabrane).not.toContain('mastodont');
    expect(odabrane).not.toContain('mastilo');
    expect(odabrane).not.toContain('mast');
    expect(odabrane).toEqual(new Set(['masa', 'maslac']));
  });

  it('isti RNG daje isti izbor neovisno o protivnikovim nastavcima (nenapadačka politika)', () => {
    const kandidati = ['maslac', 'masa', 'mast'];
    const prvi = odaberiPotez({ trazenaSlova: 'ma', kandidati, ...rjecnik }, stvoriStanjeBota(konfigBezPropusta, rng(3)), konfigBezPropusta, rng(3));
    const drugiRjecnik = { ...rjecnik, imaSlobodnuRijecNa: () => false };
    const drugi = odaberiPotez({ trazenaSlova: 'ma', kandidati, ...drugiRjecnik }, stvoriStanjeBota(konfigBezPropusta, rng(3)), konfigBezPropusta, rng(3));
    expect(drugi).toEqual(prvi);
  });

  it('propust vrijedi po fallback potezu, ali ne kad postoji poželjan čest oblik', () => {
    const konfig: KonfiguracijaBota = { ...konfigBezPropusta, vjerojatnostPropusta: 1 };
    const stanje = stvoriStanjeBota(konfig, rng(5));
    const lak = odaberiPotez({ trazenaSlova: 'ma', kandidati: ['maslac', 'masa', 'mast'], ...rjecnik }, stanje, konfig, rng(5));
    expect(lak.vrsta).toBe('rijec');
    const tezak = odaberiPotez({ trazenaSlova: 'ma', kandidati: ['mastodont'], ...rjecnik }, stanje, konfig, rng(5));
    expect(tezak).toEqual({ vrsta: 'odustani', razlog: 'namjerni_propust' });
    const ponovo = odaberiPotez({ trazenaSlova: 'ma', kandidati: ['mastodont'], ...rjecnik }, stanje, konfig, rng(5));
    expect(ponovo).toEqual({ vrsta: 'odustani', razlog: 'namjerni_propust' });
  });

  it('među čestim osnovnim oblicima bira 90 imenica i 10 glagola/pridjeva u ciklusu', () => {
    const rijeci = laznaRijec({
      masa: { frekvencija: 900, grupe: ['imenica:masa'] },
      mazati: { frekvencija: 600, grupe: ['glagol:mazati'] },
      malen: { frekvencija: 500, grupe: ['pridjev:malen'] },
      masama: { frekvencija: 1000, grupe: ['imenica:masa'] },
    });
    const generator = rng(42);
    const stanje = stvoriStanjeBota(konfigBezPropusta, generator);
    let imenice = 0;
    for (let indeks = 0; indeks < 100; indeks += 1) {
      const odluka = odaberiPotez({ trazenaSlova: 'ma', kandidati: ['masa', 'mazati', 'malen', 'masama'], ...rijeci }, stanje, konfigBezPropusta, generator);
      expect(odluka.vrsta).toBe('rijec');
      if (odluka.vrsta === 'rijec') {
        expect(odluka.rijec).not.toBe('masama');
        if (odluka.rijec === 'masa') imenice += 1;
      }
    }
    expect(imenice).toBe(90);
  });

  it('bez ijednog kandidata odustaje bez propusta', () => {
    const odluka = odaberiPotez({ trazenaSlova: 'xy', kandidati: [], ...rjecnik }, stvoriStanjeBota(konfigBezPropusta, rng(1)), konfigBezPropusta, rng(1));
    expect(odluka).toEqual({ vrsta: 'odustani', razlog: 'nema_rijeci' });
  });

  it('na primljeni KA igra kaladont', () => {
    const odluka = odaberiPotez({ trazenaSlova: 'ka', kandidati: ['kamen'], ...rjecnik }, stvoriStanjeBota(konfigBezPropusta, rng(1)), konfigBezPropusta, rng(1));
    expect(odluka).toEqual({ vrsta: 'rijec', rijec: 'kaladont', kategorija: 'kaladont' });
  });

  it('riječ na „ka” izbjegava kad postoji druga, ali je odigra ako je jedina', () => {
    const r = rng(11);
    const stanje = stvoriStanjeBota(konfigBezPropusta, r);
    for (let i = 0; i < 200; i += 1) {
      const odluka = odaberiPotez({ trazenaSlova: 'ma', kandidati: ['maska', 'masa'], ...rjecnik }, stanje, konfigBezPropusta, r);
      expect(odluka).toEqual({ vrsta: 'rijec', rijec: 'masa', kategorija: 'uobicajena' });
    }
    const jedina = odaberiPotez({ trazenaSlova: 'ma', kandidati: ['maska'], ...rjecnik }, stanje, konfigBezPropusta, r);
    expect(jedina).toEqual({ vrsta: 'rijec', rijec: 'maska', kategorija: 'uobicajena' });
  });

  it('prazna kategorija se preraspodjeljuje među nepraznima', () => {
    const r = rng(2);
    const stanje = stvoriStanjeBota(konfigBezPropusta, r);
    for (let i = 0; i < 150; i += 1) {
      const odluka = odaberiPotez({ trazenaSlova: 'ma', kandidati: ['mastodont'], ...rjecnik }, stanje, konfigBezPropusta, r);
      expect(odluka).toEqual({ vrsta: 'rijec', rijec: 'mastodont', kategorija: 'rijetka' });
    }
  });

  it('vrijeme razmišljanja nikad ne prelazi rok minus marginu', () => {
    const r = rng(9);
    for (let i = 0; i < 100; i += 1) {
      const ms = trajanjeRazmisljanjaMs(30_000, ZADANA_KONFIGURACIJA_BOTA, r);
      expect(ms).toBeLessThanOrEqual(28_500);
      expect(ms).toBeGreaterThanOrEqual(800);
    }
    expect(trajanjeRazmisljanjaMs(2_000, ZADANA_KONFIGURACIJA_BOTA, r)).toBeLessThanOrEqual(500);
    expect(trajanjeRazmisljanjaMs(null, ZADANA_KONFIGURACIJA_BOTA, () => 0)).toBe(5_000);
    expect(trajanjeRazmisljanjaMs(30_000, ZADANA_KONFIGURACIJA_BOTA, () => 1)).toBe(14_000);
    expect(trajanjeRazmisljanjaMs(30_000, ZADANA_KONFIGURACIJA_BOTA, r, 'trening')).toBe(3_000);
  });

  it('konfiguracija iz okoline mijenja samo valjane postotke', () => {
    const konfig = ucitajKonfiguracijuBota({ BOT_VJEROJATNOST_NE_ZNAM: '0.5', BOT_VJEROJATNOST_KA: 'abc', BOT_VJEROJATNOST_ISTEKA: '2' } as NodeJS.ProcessEnv);
    expect(konfig.vjerojatnostPropusta).toBe(0.5);
    expect(konfig.vjerojatnostOstavljanjaKa).toBe(0.05);
    expect(konfig.vjerojatnostIsteka).toBe(0.005);
  });
});

describe('bot kontroler', () => {
  function dogadaj(preko: Partial<DogadajPoteza> = {}): DogadajPoteza {
    return {
      partijaId: 'p1',
      kontekst: 'javna',
      zavrsena: false,
      izborUToku: false,
      naPotezuId: 'bot',
      turnToken: 't1',
      trazenaSlova: 'ma',
      zadnjaRijec: 'kuma',
      istekPotezaMs: 30_000,
      iskoristeneGrupe: new Set(),
      sudionici: [{ igracId: 'covjek', upravljac: 'covjek', aktivan: true }, { igracId: 'bot', upravljac: 'bot', aktivan: true }],
      ...preko,
    };
  }

  function stvori(izvrsi: (p: string, i: string, n: unknown) => RezultatNaredbe, verzija = () => 1, konfiguracija = konfigBezPropusta) {
    const timeri: { posao: () => void; ms: number }[] = [];
    const kontroler = new BotKontroler({
      rjecnik: {
        igriviKandidati: () => ['masa', 'mast'],
        frekvencijaZa: () => 500,
        grupeZa: (r) => [`imenica:${r}`],
        verzijaRjecnika: verzija,
      },
      izvrsiNaredbu: izvrsi as never,
      konfiguracija,
      oznaciNamjerniIstek: () => true,
      rng: rng(4),
      sada: () => 0,
      zakazi: (posao, ms) => {
        timeri.push({ posao, ms });
        return timeri.length as unknown as NodeJS.Timeout;
      },
      otkazi: (handle) => { timeri.splice((handle as unknown as number) - 1, 1, { posao: () => undefined, ms: -1 }); },
    });
    return { kontroler, timeri };
  }

  it('planira jednu akciju za bota na potezu i izvršava je s istim tokenom', () => {
    const izvrsi = vi.fn(() => ({ ishod: 'prihvacen' }) as RezultatNaredbe);
    const { kontroler, timeri } = stvori(izvrsi);
    kontroler.naPromjenuPoteza(dogadaj());
    expect(timeri).toHaveLength(1);
    expect(timeri[0]!.ms).toBeLessThanOrEqual(28_500);
    timeri[0]!.posao();
    expect(izvrsi).toHaveBeenCalledWith('p1', 'bot', expect.objectContaining({ vrsta: 'rijec', turnToken: 't1' }));
    expect(kontroler.brojaci.odigranihRijeci).toBe(1);
  });

  it('trening uvijek planira 3 s i ne može namjerno čekati istek', () => {
    const { kontroler, timeri } = stvori(() => ({ ishod: 'prihvacen' }), () => 1, { ...konfigBezPropusta, vjerojatnostIsteka: 1 });
    kontroler.naPromjenuPoteza(dogadaj({ kontekst: 'trening' }));
    expect(timeri[0]!.ms).toBe(3_000);
    expect(kontroler.brojaci.namjernihCekanjaIsteka).toBe(0);
  });

  it('javni namjerni istek ne igra potez i odluka vrijedi samo jednom za token', () => {
    const izvrsi = vi.fn(() => ({ ishod: 'prihvacen' }) as RezultatNaredbe);
    const { kontroler, timeri } = stvori(izvrsi, () => 1, { ...konfigBezPropusta, vjerojatnostIsteka: 1 });
    kontroler.naPromjenuPoteza(dogadaj());
    kontroler.naPromjenuPoteza(dogadaj());
    expect(timeri).toHaveLength(0);
    expect(izvrsi).not.toHaveBeenCalled();
    expect(kontroler.brojaci.namjernihCekanjaIsteka).toBe(1);
    kontroler.naPromjenuPoteza(dogadaj({ turnToken: 't2' }));
    expect(kontroler.brojaci.namjernihCekanjaIsteka).toBe(2);
  });

  it('već propušten rok ne označava kao namjerni istek', () => {
    const { kontroler } = stvori(() => ({ ishod: 'prihvacen' }), () => 1, { ...konfigBezPropusta, vjerojatnostIsteka: 1 });
    kontroler.naPromjenuPoteza(dogadaj({ istekPotezaMs: -1 }));
    expect(kontroler.brojaci.namjernihCekanjaIsteka).toBe(0);
  });

  it('ne planira za čovjeka, tijekom izbora sustava ni nakon kraja', () => {
    const izvrsi = vi.fn(() => ({ ishod: 'prihvacen' }) as RezultatNaredbe);
    const { kontroler, timeri } = stvori(izvrsi);
    kontroler.naPromjenuPoteza(dogadaj({ naPotezuId: 'covjek' }));
    kontroler.naPromjenuPoteza(dogadaj({ izborUToku: true }));
    kontroler.naPromjenuPoteza(dogadaj({ zavrsena: true, naPotezuId: null }));
    expect(timeri).toHaveLength(0);
  });

  it('promjena poteza otkazuje stari plan; zakašnjeli callback ne igra sa starim tokenom', () => {
    const izvrsi = vi.fn(() => ({ ishod: 'prihvacen' }) as RezultatNaredbe);
    const { kontroler, timeri } = stvori(izvrsi);
    kontroler.naPromjenuPoteza(dogadaj({ turnToken: 't1' }));
    const stariPosao = timeri[0]!.posao;
    kontroler.naPromjenuPoteza(dogadaj({ turnToken: 't2' }));
    stariPosao();
    expect(izvrsi).not.toHaveBeenCalled();
    timeri[1]!.posao();
    expect(izvrsi).toHaveBeenCalledTimes(1);
    expect(izvrsi).toHaveBeenCalledWith('p1', 'bot', expect.objectContaining({ turnToken: 't2' }));
  });

  it('promjena rječnika tijekom čekanja ponovno bira riječ, a odbijena riječ se broji kao tehnička greška', () => {
    let verzija = 1;
    const izvrsi = vi.fn((_p: string, _i: string, n: { vrsta: string }) => (n.vrsta === 'rijec' ? { ishod: 'odbijen', kod: 'RIJEC_NE_POSTOJI', poruka: '' } : { ishod: 'prihvacen' }) as RezultatNaredbe);
    const { kontroler, timeri } = stvori(izvrsi, () => verzija);
    kontroler.naPromjenuPoteza(dogadaj());
    verzija = 2;
    timeri[0]!.posao();
    expect(izvrsi.mock.calls.map(([, , n]) => n.vrsta)).toEqual(['rijec', 'rijec', 'odustani']);
    expect(kontroler.brojaci.tehnickeGreske).toBe(2);
    expect(kontroler.brojaci.namjernihPropusta).toBe(0);
  });

  it('zaustavljanje otkazuje sve planove', () => {
    const { kontroler, timeri } = stvori(() => ({ ishod: 'prihvacen' }));
    kontroler.naPromjenuPoteza(dogadaj());
    kontroler.zaustavi();
    expect(kontroler.brojPlaniranih()).toBe(0);
    expect(timeri[0]!.ms).toBe(-1);
  });
});
