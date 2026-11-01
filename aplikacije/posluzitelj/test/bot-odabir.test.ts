import { describe, expect, it, vi } from 'vitest';
import type { DogadajPoteza, RezultatNaredbe } from '../src/igra/politika-ucinka.js';
import { BotKontroler } from '../src/bot/kontroler.js';
import { ShemaKonfiguracijeBota, ZADANA_KONFIGURACIJA_BOTA, ucitajKonfiguracijuBota, type KonfiguracijaBota } from '../src/bot/konfiguracija-bota.js';
import { Vrecica, koeficijentTempaBota, odaberiPotez, stvoriStanjeBota, trajanjeRazmisljanjaMs } from '../src/bot/odabir-rijeci.js';
import { dopustenoBotova, pragoviPopuneZaOkruzenje } from '../src/red/raspored-popune.js';

describe('lokalni tempo javnih botova', () => {
  it('u development puni oba reda na 1 s i igra na 2 s, bez promjene treninga', () => {
    const konfiguracija = ucitajKonfiguracijuBota({ NODE_ENV: 'development', BOT_VJEROJATNOST_ISTEKA: '1' });
    const pragovi = pragoviPopuneZaOkruzenje('development');
    for (const mod of ['dva_igraca', 'cetiri_igraca'] as const) {
      expect(dopustenoBotova(0, 999, pragovi[mod])).toBe(0);
      expect(dopustenoBotova(0, 1_000, pragovi[mod])).toBe(mod === 'dva_igraca' ? 1 : 3);
    }
    for (const nasumicno of [0, 0.5, 1]) {
      expect(trajanjeRazmisljanjaMs(5_000, konfiguracija, () => nasumicno, 'javna')).toBe(2_000);
      expect(trajanjeRazmisljanjaMs(null, konfiguracija, () => nasumicno, 'trening')).toBe(1_000 + 2_000 * nasumicno);
    }
    expect(konfiguracija.vjerojatnostIzostankaPoSudjelovanju).toBe(0);
  });

  it.each(['test', 'staging', 'production'])('ne ubrzava okruženje %s', (okruzenje) => {
    const konfiguracija = ucitajKonfiguracijuBota({ NODE_ENV: okruzenje });
    expect(konfiguracija.brziRazvoj).toBe(false);
    expect(konfiguracija.rasponSporih).toEqual([0.55, 0.85]);
    expect(konfiguracija.vjerojatnostIzostankaPoSudjelovanju).toBe(0.02);
    expect(pragoviPopuneZaOkruzenje(okruzenje)).toEqual({ dva_igraca: [30_000], cetiri_igraca: [20_000, 30_000, 40_000] });
  });
});

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

const konfigBezPropusta: KonfiguracijaBota = { ...ZADANA_KONFIGURACIJA_BOTA, vjerojatnostOstavljanjaKa: 0, vjerojatnostNeznanjaPoSudjelovanju: 0, vjerojatnostIzostankaPoSudjelovanju: 0 };

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
    expect(odabrane).toEqual(new Set(['masa', 'maslac', 'mast']));
  });

  it('isti RNG daje isti izbor neovisno o protivnikovim nastavcima (nenapadačka politika)', () => {
    const kandidati = ['maslac', 'masa', 'mast'];
    const prvi = odaberiPotez({ trazenaSlova: 'ma', kandidati, ...rjecnik }, stvoriStanjeBota(konfigBezPropusta, rng(3)), konfigBezPropusta, rng(3));
    const drugiRjecnik = { ...rjecnik, imaSlobodnuRijecNa: () => false };
    const drugi = odaberiPotez({ trazenaSlova: 'ma', kandidati, ...drugiRjecnik }, stvoriStanjeBota(konfigBezPropusta, rng(3)), konfigBezPropusta, rng(3));
    expect(drugi).toEqual(prvi);
  });

  it('neznanje se troši jednom na teškom potezu, ali ne kad postoji poželjan oblik', () => {
    const konfig: KonfiguracijaBota = { ...konfigBezPropusta, vjerojatnostNeznanjaPoSudjelovanju: 1, rasponTeskogPotezaNeznanja: [1, 1] };
    const stanje = stvoriStanjeBota(konfig, rng(5));
    const lak = odaberiPotez({ trazenaSlova: 'ma', kandidati: ['maslac', 'masa', 'mast'], ...rjecnik }, stanje, konfig, rng(5));
    expect(lak.vrsta).toBe('rijec');
    const tezak = odaberiPotez({ trazenaSlova: 'ma', kandidati: ['mastodont'], ...rjecnik }, stanje, konfig, rng(5));
    expect(tezak).toEqual({ vrsta: 'odustani', razlog: 'namjerni_propust' });
    const ponovo = odaberiPotez({ trazenaSlova: 'ma', kandidati: ['mastodont'], ...rjecnik }, stanje, konfig, rng(5));
    expect(ponovo).toMatchObject({ vrsta: 'rijec', rijec: 'mastodont' });
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
    expect(jedina).toMatchObject({ vrsta: 'rijec', rijec: 'maska', kategorija: 'uobicajena', izborKa: 'prisilni' });
  });

  it('prazna kategorija se preraspodjeljuje među nepraznima', () => {
    const r = rng(2);
    const stanje = stvoriStanjeBota(konfigBezPropusta, r);
    for (let i = 0; i < 150; i += 1) {
      const odluka = odaberiPotez({ trazenaSlova: 'ma', kandidati: ['mastodont'], ...rjecnik }, stanje, konfigBezPropusta, r);
      expect(odluka).toEqual({ vrsta: 'rijec', rijec: 'mastodont', kategorija: 'rijetka' });
    }
  });

  it('KA izbor 100 % ne gubi kandidata zbog niže frekvencije', () => {
    const konfiguracija = { ...konfigBezPropusta, vjerojatnostOstavljanjaKa: 1 };
    const odluka = odaberiPotez({ trazenaSlova: 'ma', kandidati: ['masa', 'maska'], ...rjecnik }, stvoriStanjeBota(konfiguracija, rng(1)), konfiguracija, rng(2));
    expect(odluka).toMatchObject({ vrsta: 'rijec', rijec: 'maska', izborKa: 'dobrovoljni' });
    const bezKA = { ...konfiguracija, vjerojatnostOstavljanjaKa: 0 };
    expect(odaberiPotez({ trazenaSlova: 'ma', kandidati: ['masa', 'maska'], ...rjecnik }, stvoriStanjeBota(bezKA, rng(1)), bezKA, () => 0)).toMatchObject({ vrsta: 'rijec', rijec: 'masa' });
  });

  it('vrijeme razmišljanja nikad ne prelazi rok minus marginu', () => {
    const r = rng(9);
    for (let i = 0; i < 100; i += 1) {
      const ms = trajanjeRazmisljanjaMs(30_000, ZADANA_KONFIGURACIJA_BOTA, r);
      expect(ms).toBeLessThanOrEqual(28_500);
      expect(ms).toBeGreaterThanOrEqual(800);
    }
    expect(trajanjeRazmisljanjaMs(2_000, ZADANA_KONFIGURACIJA_BOTA, r)).toBeLessThanOrEqual(1_850);
    expect(trajanjeRazmisljanjaMs(null, ZADANA_KONFIGURACIJA_BOTA, () => 0)).toBe(2_400);
    expect(trajanjeRazmisljanjaMs(30_000, ZADANA_KONFIGURACIJA_BOTA, () => 1)).toBe(25_500);
    expect(trajanjeRazmisljanjaMs(30_000, ZADANA_KONFIGURACIJA_BOTA, r, 'trening')).toBeGreaterThanOrEqual(1_000);
  });

  it('težina prefiksa s malim brojem kandidata blago usporava javni odgovor', () => {
    const rngZaOba = () => 0.5;
    const puno = trajanjeRazmisljanjaMs(30_000, ZADANA_KONFIGURACIJA_BOTA, rngZaOba, 'javna', { punoTrajanjeMs: 30_000, protekloMs: 0, brojKandidata: 8 });
    const malo = trajanjeRazmisljanjaMs(30_000, ZADANA_KONFIGURACIJA_BOTA, rngZaOba, 'javna', { punoTrajanjeMs: 30_000, protekloMs: 0, brojKandidata: 1 });
    expect(malo).toBeGreaterThan(puno);
    expect(malo).toBeLessThanOrEqual(25_500);
  });

  it('konfiguracija iz okoline mijenja samo valjane postotke', () => {
    const konfig = ucitajKonfiguracijuBota({ BOT_NEZNANJE_PO_SUDJELOVANJU: '0.5', BOT_VJEROJATNOST_KA: 'abc', BOT_IZOSTANAK_PO_SUDJELOVANJU: '2' } as NodeJS.ProcessEnv);
    expect(konfig.vjerojatnostNeznanjaPoSudjelovanju).toBe(0.5);
    expect(konfig.vjerojatnostOstavljanjaKa).toBe(0.05);
    expect(konfig.vjerojatnostIzostankaPoSudjelovanju).toBe(0.02);
  });

  it('tempo je proporcionalan punom potezu, a zakašnjeli događaj ne dobiva novi rok', () => {
    const trideset = trajanjeRazmisljanjaMs(30_000, konfigBezPropusta, () => 0.5, 'javna', { punoTrajanjeMs: 30_000, protekloMs: 0 });
    const petnaest = trajanjeRazmisljanjaMs(15_000, konfigBezPropusta, () => 0.5, 'javna', { punoTrajanjeMs: 15_000, protekloMs: 0 });
    expect(petnaest).toBe(trideset / 2);
    expect(trajanjeRazmisljanjaMs(25_000, konfigBezPropusta, () => 0.5, 'javna', { punoTrajanjeMs: 30_000, protekloMs: 5_000 })).toBe(trideset - 5_000);
    expect(trajanjeRazmisljanjaMs(10_000, konfigBezPropusta, () => 0.5, 'javna', { punoTrajanjeMs: 30_000, protekloMs: 20_000 })).toBe(0);
    expect(trajanjeRazmisljanjaMs(30_000, konfigBezPropusta, () => 0.9, 'javna', { punoTrajanjeMs: 30_000, protekloMs: 0, primljeniKa: true })).toBeLessThanOrEqual(6_000);
    expect(koeficijentTempaBota('bot-1')).toBe(koeficijentTempaBota('bot-1'));
    expect(koeficijentTempaBota('bot-1')).toBeGreaterThanOrEqual(0.9);
    expect(koeficijentTempaBota('bot-1')).toBeLessThanOrEqual(1.1);
  });

  it('stari env postotci ne dobivaju tiho novo značenje', () => {
    const konfiguracija = ucitajKonfiguracijuBota({ BOT_VJEROJATNOST_NE_ZNAM: '1', BOT_VJEROJATNOST_ISTEKA: '1' });
    expect(konfiguracija.vjerojatnostNeznanjaPoSudjelovanju).toBe(0.2);
    expect(konfiguracija.vjerojatnostIzostankaPoSudjelovanju).toBe(0.02);
  });
});

describe('validacija admin postavki bota', () => {
  it('prihvaća zadane postavke i odbija nepoznate ključeve', () => {
    expect(ShemaKonfiguracijeBota.safeParse(ZADANA_KONFIGURACIJA_BOTA).success).toBe(true);
    expect(ShemaKonfiguracijeBota.safeParse({ ...ZADANA_KONFIGURACIJA_BOTA, tajna: 'ne' }).success).toBe(false);
  });

  it.each([
    { udioBrzih: 0.6, udioUobicajenih: 0.6 },
    { vjerojatnostNeznanjaPoSudjelovanju: NaN },
    { vjerojatnostOstavljanjaKa: Infinity },
    { treningRazmisljanjeMinMs: 4_000, treningRazmisljanjeMaksMs: 3_000 },
    { pragFrekvencije: { uobicajena: 10, srednja: 100 } },
    { rasponPotezaIzostanka: [12, 2] },
    { rasponBrzih: [0.08, 0.6] },
    { pragoviPopuneMs: { dva_igraca: [3_000], cetiri_igraca: [40_000, 30_000, 20_000] } },
    { odstupanjaPopuneMs: { dva_igraca: [4_000], cetiri_igraca: [3_000] } },
  ])('odbija nevaljanu kombinaciju %j', (izmjena) => {
    expect(ShemaKonfiguracijeBota.safeParse({ ...ZADANA_KONFIGURACIJA_BOTA, ...izmjena }).success).toBe(false);
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
      pocetakPotezaMs: 0,
      trajanjePotezaMs: 30_000,
      iskoristeneGrupe: new Set(),
      sudionici: [{ igracId: 'covjek', upravljac: 'covjek', aktivan: true }, { igracId: 'bot', upravljac: 'bot', aktivan: true }],
      ...preko,
    };
  }

  function stvori(izvrsi: (p: string, i: string, n: unknown) => RezultatNaredbe, verzija = () => 1, konfiguracija = konfigBezPropusta, dodatno: Partial<import('../src/bot/kontroler.js').OvisnostiBotKontrolera> = {}) {
    const timeri: { posao: () => void; ms: number }[] = [];
    const prekini = vi.fn();
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
      prekiniZbogGreske: prekini,
      ...dodatno,
    });
    return { kontroler, timeri, prekini };
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

  it('trening planira 1–3 s i ne može namjerno čekati istek', () => {
    const { kontroler, timeri } = stvori(() => ({ ishod: 'prihvacen' }), () => 1, { ...konfigBezPropusta, vjerojatnostIzostankaPoSudjelovanju: 1, rasponPotezaIzostanka: [1, 1] });
    kontroler.naPromjenuPoteza(dogadaj({ kontekst: 'trening' }));
    expect(timeri[0]!.ms).toBeGreaterThanOrEqual(1_000);
    expect(timeri[0]!.ms).toBeLessThanOrEqual(3_000);
    expect(kontroler.brojaci.namjernihCekanjaIsteka).toBe(0);
  });

  it('javni namjerni istek ne igra potez i odluka vrijedi samo jednom za token', () => {
    const izvrsi = vi.fn(() => ({ ishod: 'prihvacen' }) as RezultatNaredbe);
    const { kontroler, timeri } = stvori(izvrsi, () => 1, { ...konfigBezPropusta, vjerojatnostIzostankaPoSudjelovanju: 1, rasponPotezaIzostanka: [1, 1] });
    kontroler.naPromjenuPoteza(dogadaj());
    kontroler.naPromjenuPoteza(dogadaj());
    expect(timeri).toHaveLength(0);
    expect(izvrsi).not.toHaveBeenCalled();
    expect(kontroler.brojaci.namjernihCekanjaIsteka).toBe(1);
    kontroler.naPromjenuPoteza(dogadaj({ turnToken: 't2' }));
    expect(kontroler.brojaci.namjernihCekanjaIsteka).toBe(1);
    expect(timeri).toHaveLength(1);
  });

  it('već propušten rok ne označava kao namjerni istek', () => {
    const { kontroler, timeri } = stvori(() => ({ ishod: 'prihvacen' }), () => 1, { ...konfigBezPropusta, vjerojatnostIzostankaPoSudjelovanju: 1, rasponPotezaIzostanka: [1, 1] });
    kontroler.naPromjenuPoteza(dogadaj({ istekPotezaMs: -1 }));
    expect(kontroler.brojaci.namjernihCekanjaIsteka).toBe(0);
    expect(timeri).toHaveLength(0);
  });

  it('zakašnjeli callback nakon isteka roka ne šalje naredbu', () => {
    let sada = 0;
    const izvrsi = vi.fn(() => ({ ishod: 'prihvacen' }) as RezultatNaredbe);
    const { kontroler, timeri } = stvori(izvrsi, () => 1, konfigBezPropusta, { sada: () => sada });
    kontroler.naPromjenuPoteza(dogadaj());
    const plan = kontroler.pregledPlanova()[0];
    expect(plan?.vrsta).toBe('rijec');
    expect(plan?.izvrsitiUMs).toBe(timeri[0]!.ms);
    sada = 30_001;
    timeri[0]!.posao();
    expect(izvrsi).not.toHaveBeenCalled();
    expect(kontroler.brojaci.zastarjelo).toBe(1);
    kontroler.zaustavi();
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
    const { kontroler, timeri, prekini } = stvori(izvrsi, () => verzija);
    kontroler.naPromjenuPoteza(dogadaj());
    verzija = 2;
    timeri[0]!.posao();
    timeri[1]!.posao();
    timeri[2]!.posao();
    expect(izvrsi.mock.calls.map(([, , n]) => n.vrsta)).toEqual(['rijec', 'rijec']);
    expect(kontroler.brojaci.tehnickeGreske).toBe(3);
    expect(prekini).toHaveBeenCalledExactlyOnceWith('p1', 'bot', 't1');
    expect(kontroler.brojaci.namjernihPropusta).toBe(0);
  });

  it('jednokratna iznimka naredbe se oporavi i isti token ne izvršava ponovno', () => {
    const izvrsi = vi.fn().mockImplementationOnce(() => { throw new Error('Privremeni kvar'); }).mockReturnValue({ ishod: 'prihvacen' });
    const { kontroler, timeri, prekini } = stvori(izvrsi);
    kontroler.naPromjenuPoteza(dogadaj());
    timeri[0]!.posao();
    kontroler.naPromjenuPoteza(dogadaj());
    expect(timeri).toHaveLength(2);
    timeri[1]!.posao();
    kontroler.naPromjenuPoteza(dogadaj());
    expect(izvrsi).toHaveBeenCalledTimes(2);
    expect(izvrsi.mock.calls[1]).toEqual(izvrsi.mock.calls[0]);
    expect(prekini).not.toHaveBeenCalled();
    expect(kontroler.brojaci.odigranihRijeci).toBe(1);
  });

  it('promjena rječnika čuva već odabrano neznanje za isti token', () => {
    let verzija = 1;
    const izvrsi = vi.fn(() => ({ ishod: 'prihvacen' }) as RezultatNaredbe);
    const { kontroler, timeri } = stvori(izvrsi, () => verzija, {
      ...konfigBezPropusta, vjerojatnostNeznanjaPoSudjelovanju: 1, rasponTeskogPotezaNeznanja: [1, 1],
    }, {
      rjecnik: { igriviKandidati: () => ['masa'], frekvencijaZa: () => 1, grupeZa: () => ['imenica:masa'], verzijaRjecnika: () => verzija },
    });
    kontroler.naPromjenuPoteza(dogadaj());
    verzija = 2;
    timeri[0]!.posao();
    expect(izvrsi).toHaveBeenCalledWith('p1', 'bot', { vrsta: 'odustani', turnToken: 't1' });
    expect(kontroler.brojaci.namjernihPropusta).toBe(1);
    kontroler.naPromjenuPoteza(dogadaj({ turnToken: 't2' }));
    timeri[1]!.posao();
    expect(izvrsi).toHaveBeenLastCalledWith('p1', 'bot', expect.objectContaining({ vrsta: 'rijec' }));
    kontroler.zaustavi();
  });

  it('novi bot na potezu koristi snapshot cijele partije, a nova partija nove postavke', () => {
    const konfiguracija = structuredClone(konfigBezPropusta);
    const { kontroler, timeri } = stvori(() => ({ ishod: 'prihvacen' }), () => 1, konfiguracija);
    kontroler.naPromjenuPoteza(dogadaj({ naPotezuId: 'covjek' }));
    konfiguracija.brziRazvoj = true;
    kontroler.naPromjenuPoteza(dogadaj());
    expect(timeri[0]!.ms).not.toBe(2_000);
    kontroler.naPromjenuPoteza(dogadaj({ partijaId: 'p2' }));
    expect(timeri[1]!.ms).toBe(2_000);
    kontroler.zaustavi();
  });

  it('iznimka odabira ima dva oporavka i prekida trening bez lažne predaje', () => {
    const izvrsi = vi.fn(() => ({ ishod: 'prihvacen' }) as RezultatNaredbe);
    const { kontroler, timeri, prekini } = stvori(izvrsi, () => 1, konfigBezPropusta, {
      rjecnik: {
        igriviKandidati: () => { throw new Error('Kvar odabira'); },
        frekvencijaZa: () => 500,
        grupeZa: (rijec) => [`imenica:${rijec}`],
        verzijaRjecnika: () => 1,
      },
    });
    kontroler.naPromjenuPoteza(dogadaj({ kontekst: 'trening', istekPotezaMs: null }));
    timeri[0]!.posao();
    timeri[1]!.posao();
    expect(prekini).toHaveBeenCalledExactlyOnceWith('p1', 'bot', 't1');
    expect(kontroler.brojaci.tehnickeGreske).toBe(3);
    expect(izvrsi).not.toHaveBeenCalled();
  });

  it('iznimka nakon promjene tokena ne ponavlja mogući već izvršeni potez', () => {
    let aktualni = dogadaj();
    const izvrsi = vi.fn(() => {
      aktualni = dogadaj({ turnToken: 't2', naPotezuId: 'covjek' });
      throw new Error('Greška nakon promjene poteza');
    });
    const { kontroler, timeri, prekini } = stvori(izvrsi, () => 1, konfigBezPropusta, { dohvatiPotez: () => aktualni });
    kontroler.naPromjenuPoteza(aktualni);
    timeri[0]!.posao();
    expect(timeri).toHaveLength(1);
    expect(prekini).not.toHaveBeenCalled();
    expect(izvrsi).toHaveBeenCalledTimes(1);
  });

  it('zaustavljanje otkazuje sve planove', () => {
    const { kontroler, timeri } = stvori(() => ({ ishod: 'prihvacen' }));
    kontroler.naPromjenuPoteza(dogadaj());
    kontroler.zaustavi();
    expect(kontroler.brojPlaniranih()).toBe(0);
    expect(timeri[0]!.ms).toBe(-1);
  });
});
