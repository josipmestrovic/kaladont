import { describe, expect, it, vi } from 'vitest';
import type { DogadajPoteza, RezultatNaredbe } from '../src/igra/politika-ucinka.js';
import { BotKontroler, MAKS_POTEZA_BOT_DUELA_BRZA } from '../src/bot/kontroler.js';
import { izgradiSnimkuPoolova } from '../src/bot/poolovi-indeks.js';
import { RasporedjivacOdziva } from '../src/bot/raspored-odziva.js';
import { igriviKandidatiIzRepertoara, izgradiRepertoarBotova, RADNI_UZORAK_PO_POTEZU, type SnimkaRepertoara } from '../src/bot/repertoar.js';
import { ShemaKonfiguracijeBota, VERZIJA_BOT_POLITIKE, ZADANA_KONFIGURACIJA_BOTA, ucitajKonfiguracijuBota, type KonfiguracijaBota } from '../src/bot/konfiguracija-bota.js';
import { BOT_POTEZ_BEZ_ROKA_MS, PredmemorijaLegalnosti, STAGING_BOT_POTEZ_S_LJUDIMA_MS, SlozeneIskoristeneGrupe, Vrecica, analizirajNastavak, klasificirajPoznatiSkup, odlukaAgresivnostiZaToken, odlukaShieldaZaToken, odaberiPotez, odaberiPotezNastavivo, odgodaBezRokaMs, oprezKa, politikaKa, stvoriStanjeBota, trajanjeRazmisljanjaMs, uzorkujPonderirano } from '../src/bot/odabir-rijeci.js';
import { parsajSpremljenuKonfiguraciju } from '../src/bot/trajne-postavke.js';
import { razrijesiProfilBota } from '../src/bot/profili-bota.js';
import { BROJ_GOSTIJU_FONDA_V5, BROJ_IMENOVANIH_FONDA_V5, CILJ_AKTIVNIH_FONDA_V5, NADIMCI_POCETNOG_FONDA_V5 } from '../src/bot/nadimci.js';
import { stavkeZamjeneFondaBotova } from '../src/bot/servis-identiteta.js';
import { dopustenoBotova, pragoviPopuneZaOkruzenje } from '../src/red/raspored-popune.js';
import { jeValjanNadimak, KLJUCEVI_JAVNOG_REDA, kanonskaPravilaZaKljuc } from 'zajednicko';

describe('botovi samo Klasični (assign)', () => {
  it('katalog i dalje ima 8 ključeva; bot-popuna samo uz klasicni', () => {
    expect(KLJUCEVI_JAVNOG_REDA).toHaveLength(8);
    const klasicni = KLJUCEVI_JAVNOG_REDA.filter((k) => kanonskaPravilaZaKljuc(k).pravila === 'klasicni');
    const neklasicni = KLJUCEVI_JAVNOG_REDA.filter((k) => kanonskaPravilaZaKljuc(k).pravila !== 'klasicni');
    expect(klasicni.length).toBeGreaterThan(0);
    expect(neklasicni.length).toBeGreaterThan(0);
    // servis-reda.stvoriPopunu: return null kad nije klasicni
    for (const kljuc of neklasicni) {
      expect(kanonskaPravilaZaKljuc(kljuc).pravila === 'klasicni').toBe(false);
    }
  });
});

describe('lokalni tempo javnih botova', () => {
  it('u development ubrzava samo popunu; potez ostaje ~4 s', () => {
    const konfiguracija = ucitajKonfiguracijuBota({ NODE_ENV: 'development', BOT_VJEROJATNOST_ISTEKA: '1' });
    const pragovi = pragoviPopuneZaOkruzenje('development');
    for (const mod of ['dva_igraca', 'tri_igraca', 'cetiri_igraca'] as const) {
      expect(dopustenoBotova(0, 999, pragovi[mod])).toBe(0);
      expect(dopustenoBotova(0, 1_000, pragovi[mod])).toBe(mod === 'dva_igraca' ? 1 : mod === 'tri_igraca' ? 2 : 3);
    }
    expect(konfiguracija.brziRazvoj).toBe(true);
    expect(konfiguracija.trajanjePotezaBotaMs).toBe(4_000);
    for (const kontekst of ['javna', 'trening'] as const) {
      const ms = trajanjeRazmisljanjaMs(30_000, konfiguracija, () => 0.5, kontekst, { punoTrajanjeMs: 30_000, protekloMs: 0 });
      expect(ms).toBeGreaterThanOrEqual(3_700);
      expect(ms).toBeLessThanOrEqual(4_300);
    }
  });

  it.each(['test', 'staging', 'production'])('ne ubrzava okruženje %s', (okruzenje) => {
    const konfiguracija = ucitajKonfiguracijuBota({ NODE_ENV: okruzenje });
    expect(konfiguracija.brziRazvoj).toBe(false);
    expect(konfiguracija.trajanjePotezaBotaMs).toBe(4_000);
    expect(pragoviPopuneZaOkruzenje(okruzenje)).toEqual({
      dva_igraca: [30_000],
      tri_igraca: [10_000, 20_000],
      cetiri_igraca: [20_000, 30_000, 40_000],
    });
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

const konfigBezPropusta: KonfiguracijaBota = {
  ...ZADANA_KONFIGURACIJA_BOTA,
  vjerojatnostNeznanjaUMalomSkupu: 0,
  vjerojatnostAgresivnosti: 0,
  vjerojatnostShielda: 0,
};

const PRAZNI_POOLOVI = izgradiSnimkuPoolova({ clanovi: [], jeAktivnaURjecnika: () => true, verzijaRjecnika: 1, generacija: 1 });

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

  it('ista procjena nastavka za čovjeka i bota (isti ulazi → ista odluka)', () => {
    const kandidati = ['maslac', 'masa', 'mast'];
    const ulaz = {
      trazenaSlova: 'ma',
      kandidati,
      ...rjecnik,
      pravila: 'klasicni' as const,
      brojAktivnih: 2,
      imaSlobodnuRijecNa: () => true,
      poznatiKandidatiNa: () => ['lampa'],
    };
    const prvi = odaberiPotez(ulaz, stvoriStanjeBota(konfigBezPropusta, rng(3)), konfigBezPropusta, rng(3));
    const drugi = odaberiPotez(ulaz, stvoriStanjeBota(konfigBezPropusta, rng(3)), konfigBezPropusta, rng(3));
    expect(drugi).toEqual(prvi);
  });

  it('mali poznati skup: 10 % neznanja po tokenu; dovoljan skup uvijek igra', () => {
    const konfig: KonfiguracijaBota = { ...konfigBezPropusta, vjerojatnostNeznanjaUMalomSkupu: 1 };
    const stanje = stvoriStanjeBota(konfig, rng(5));
    const dovoljan = odaberiPotez({ trazenaSlova: 'ma', kandidati: ['maslac', 'masa', 'mast', 'maska'], ...rjecnik, turnToken: 't-dovoljan' }, stanje, konfig, () => 0);
    expect(dovoljan.vrsta).toBe('rijec');
    const mali = odaberiPotez({ trazenaSlova: 'ma', kandidati: ['mastilo'], ...rjecnik, turnToken: 't-mali' }, stanje, konfig, () => 0);
    expect(mali).toEqual({ vrsta: 'odustani', razlog: 'namjerni_propust' });
    const istiToken = odaberiPotez({ trazenaSlova: 'ma', kandidati: ['mastilo'], ...rjecnik, turnToken: 't-mali', oporavak: true }, stanje, konfig, () => 0.99);
    expect(istiToken).toEqual({ vrsta: 'odustani', razlog: 'namjerni_propust' });
    const prazan = odaberiPotez({ trazenaSlova: 'ma', kandidati: ['mastodont'], ...rjecnik, turnToken: 't-prazan' }, stanje, konfig, () => 0);
    expect(prazan).toEqual({ vrsta: 'odustani', razlog: 'nema_rijeci' });
  });

  it('deset padeža jednog leksema broji se kao jedna opcija', () => {
    const padezi = Object.fromEntries(
      Array.from({ length: 10 }, (_, i) => [`masa${i}`, { frekvencija: 50, grupe: ['imenica:masa'] }]),
    );
    const rijeci = laznaRijec(padezi);
    const klasifikacija = klasificirajPoznatiSkup(Object.keys(padezi), rijeci.frekvencijaZa, rijeci.grupeZa, konfigBezPropusta);
    expect(klasifikacija.brojNeovisnih).toBe(1);
    expect(klasifikacija.vrsta).toBe('mali');
  });

  it('česta fleksija kasnije u istoj grupi čini skup dovoljnim', () => {
    const rijeci = laznaRijec({
      mase: { frekvencija: 40, grupe: ['imenica:masa'] },
      masa: { frekvencija: 900, grupe: ['imenica:masa'] },
    });
    const klasifikacija = klasificirajPoznatiSkup(['mase', 'masa'], rijeci.frekvencijaZa, rijeci.grupeZa, konfigBezPropusta);
    expect(klasifikacija.brojNeovisnih).toBe(1);
    expect(klasifikacija.imaCestu).toBe(true);
    expect(klasifikacija.vrsta).toBe('dovoljan');
  });

  it('shield u dvoboju: preferira sigurnu riječ pred čestom na KA', () => {
    const rijeci = laznaRijec({
      magla: { frekvencija: 200, grupe: ['imenica:magla'] },
      marka: { frekvencija: 900, grupe: ['imenica:marka'] },
    });
    const konfig: KonfiguracijaBota = { ...konfigBezPropusta, vjerojatnostShielda: 1 };
    const poolovi = izgradiSnimkuPoolova({
      clanovi: [{ rijec: 'lampa', kategorija: 'pool_1', stanje: 'razrijeseno' }],
      jeAktivnaURjecnika: () => true,
      verzijaRjecnika: 1,
      generacija: 1,
    });
    const odabrane = new Set<string>();
    const r = rng(11);
    const stanje = stvoriStanjeBota(konfig, r);
    for (let i = 0; i < 40; i += 1) {
      const odluka = odaberiPotez({
        trazenaSlova: 'ma',
        kandidati: ['magla', 'marka'],
        ...rijeci,
        pravila: 'klasicni',
        brojAktivnih: 2,
        iskoristeneGrupe: new Set(),
        poolovi,
        jeIgrivaRijec: (rijec) => ['magla', 'marka', 'lampa', 'kaladont'].includes(rijec),
        turnToken: `t-duel-${i}`,
      }, stanje, konfig, () => 0);
      if (odluka.vrsta === 'rijec') odabrane.add(odluka.rijec);
    }
    expect(odabrane.has('magla')).toBe(true);
    expect(odabrane.has('marka')).toBe(false);
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

  it('na primljeni KA igra kaladont (bez propusta)', () => {
    const odluka = odaberiPotez({ trazenaSlova: 'ka', kandidati: ['kamen'], ...rjecnik }, stvoriStanjeBota(konfigBezPropusta, rng(1)), konfigBezPropusta, rng(1));
    expect(odluka).toEqual({ vrsta: 'rijec', rijec: 'kaladont', kategorija: 'kaladont' });
  });

  it('primljeni KA u malom skupu s neznanjem i dalje igra kaladont', () => {
    const rijeci = laznaRijec({ kamenčić: { frekvencija: 20, grupe: ['imenica:kamenčić'] } });
    const konfig: KonfiguracijaBota = {
      ...konfigBezPropusta,
      vjerojatnostNeznanjaUMalomSkupu: 1,
    };
    const stanje = stvoriStanjeBota(konfig, rng(1));
    const odluka = odaberiPotez({ trazenaSlova: 'ka', kandidati: ['kamenčić'], ...rijeci, turnToken: 't-ka' }, stanje, konfig, () => 0);
    expect(odluka).toEqual({ vrsta: 'rijec', rijec: 'kaladont', kategorija: 'kaladont' });
  });

  it('među magla/mačka/makroekonomist preferira maglu i ne bira jako rijetko', () => {
    const rijeci = laznaRijec({
      magla: { frekvencija: 900, grupe: ['imenica:magla'] },
      mačka: { frekvencija: 800, grupe: ['imenica:mačka'] },
      makroekonomist: { frekvencija: 0, grupe: ['imenica:makroekonomist'] },
    });
    const brojac: Record<string, number> = { magla: 0, mačka: 0, makroekonomist: 0 };
    const r = rng(99);
    const stanje = stvoriStanjeBota(konfigBezPropusta, r);
    for (let i = 0; i < 2_000; i += 1) {
      const odluka = odaberiPotez({ trazenaSlova: 'ma', kandidati: ['magla', 'mačka', 'makroekonomist'], ...rijeci }, stanje, konfigBezPropusta, r);
      expect(odluka.vrsta).toBe('rijec');
      if (odluka.vrsta === 'rijec') brojac[odluka.rijec] = (brojac[odluka.rijec] ?? 0) + 1;
    }
    expect(brojac.makroekonomist ?? 0).toBe(0);
    expect(brojac.magla).toBeGreaterThan(900);
    expect(brojac.magla).toBeGreaterThan(brojac.mačka ?? 0);
  });

  it('samo mačka poznata → odigra je; samo stručne → odustani', () => {
    const rijeci = laznaRijec({
      mačka: { frekvencija: 800, grupe: ['imenica:mačka'] },
      makroekonomist: { frekvencija: 0, grupe: ['imenica:makroekonomist'] },
    });
    const samoMacka = odaberiPotez({ trazenaSlova: 'ma', kandidati: ['mačka'], ...rijeci }, stvoriStanjeBota(konfigBezPropusta, rng(1)), konfigBezPropusta, rng(1));
    expect(samoMacka).toMatchObject({ vrsta: 'rijec', rijec: 'mačka', izborKa: 'prisilni' });
    const samoStrucne = odaberiPotez({ trazenaSlova: 'ma', kandidati: ['makroekonomist'], ...rijeci }, stvoriStanjeBota(konfigBezPropusta, rng(2)), konfigBezPropusta, rng(2));
    expect(samoStrucne).toEqual({ vrsta: 'odustani', razlog: 'nema_rijeci' });
  });

  it('objedinjena analiza nastavka: jedan iterator po pozivu, rani izlaz kad je popunjen budžet čestih', () => {
    let skenirano = 0;
    const poznatiKandidatiNa = () => ({
      *[Symbol.iterator](): Generator<string> {
        for (let i = 0; i < 10_000; i += 1) {
          skenirano += 1;
          yield `ce${i}`;
          if (skenirano >= 8) return;
        }
      },
    });
    const predmemorija = new PredmemorijaLegalnosti();
    predmemorija.uskladiKontekst('t-unified', 1);
    const ulaz = {
      frekvencijaZa: (r: string) => (r.startsWith('ce') ? 800 : 500),
      grupeZa: (r: string) => [`imenica:${r}`],
      pravila: 'klasicni' as const,
      iskoristeneGrupe: new Set<string>(),
      imaSlobodnuRijecNa: () => true,
      poznatiKandidatiNa,
      predmemorija,
    };
    const analiza = analizirajNastavak('masa', ulaz, new Set(), konfigBezPropusta);
    expect(analiza.ishod).toBe('poznat');
    expect(skenirano).toBeLessThanOrEqual(8);
    expect(predmemorija.brojZapisa()).toBeGreaterThan(0);
  });

  it('predmemorija se čisti na novi token; različite hipotetske grupe ne dijele ključ', () => {
    const pred = new PredmemorijaLegalnosti();
    pred.uskladiKontekst('t1', 1);
    let izracuna = 0;
    const kljucA = 'klasicni||sa|["imenica:masa"]|';
    const kljucB = 'klasicni||sa|["imenica:mast"]|';
    expect(pred.dohvatiIliIzracunaj(kljucA, () => { izracuna += 1; return { ishod: 'poznat', cestihNeovisnih: 1 }; }))
      .toEqual({ ishod: 'poznat', cestihNeovisnih: 1 });
    expect(pred.dohvatiIliIzracunaj(kljucA, () => { izracuna += 1; return { ishod: 'mrtvo' }; }))
      .toEqual({ ishod: 'poznat', cestihNeovisnih: 1 });
    expect(pred.dohvatiIliIzracunaj(kljucB, () => { izracuna += 1; return { ishod: 'mrtvo' }; }))
      .toEqual({ ishod: 'mrtvo' });
    expect(izracuna).toBe(2);
    pred.uskladiKontekst('t2', 1);
    expect(pred.brojZapisa()).toBe(0);
    expect(pred.dohvatiIliIzracunaj(kljucA, () => { izracuna += 1; return { ishod: 'mrtvo' }; }))
      .toEqual({ ishod: 'mrtvo' });
    expect(izracuna).toBe(3);
  });

  it('analizirajNastavak: cache hit preskače drugi prolaz repertoara', () => {
    let prolaz = 0;
    const pred = new PredmemorijaLegalnosti();
    pred.uskladiKontekst('t-cache', 1);
    const baza = {
      frekvencijaZa: () => 800,
      grupeZa: (r: string) => [`imenica:${r}`],
      pravila: 'klasicni' as const,
      iskoristeneGrupe: new Set<string>(),
      poznatiKandidatiNa: () => {
        prolaz += 1;
        return ['lampa'];
      },
      predmemorija: pred,
    };
    analizirajNastavak('masa', baza, new Set(), konfigBezPropusta);
    analizirajNastavak('masa', baza, new Set(), konfigBezPropusta);
    expect(prolaz).toBe(1);
  });

  it('SlozeneIskoristeneGrupe has gleda bazu i dodatak bez kopije Set-a', () => {
    const baza = new Set(['imenica:masa', 'imenica:mast']);
    const slozene = new SlozeneIskoristeneGrupe(baza, ['imenica:magla']);
    expect(slozene.has('imenica:masa')).toBe(true);
    expect(slozene.has('imenica:magla')).toBe(true);
    expect(slozene.has('imenica:xx')).toBe(false);
    expect(slozene.size).toBe(3);
    expect(baza.size).toBe(2);
  });

  it('neznanje, agresivnost i shield drže samo aktualni token', () => {
    const konfig: KonfiguracijaBota = {
      ...konfigBezPropusta,
      vjerojatnostNeznanjaUMalomSkupu: 1,
      vjerojatnostAgresivnosti: 1,
      vjerojatnostShielda: 1,
    };
    const stanje = stvoriStanjeBota(konfig, rng(5));
    odaberiPotez({
      trazenaSlova: 'ma',
      kandidati: ['mastilo'],
      ...rjecnik,
      turnToken: 't-a',
      brojAktivnih: 2,
      poolovi: PRAZNI_POOLOVI,
    }, stanje, konfig, () => 0);
    expect([...stanje.neznanjePoTokenu.keys()]).toEqual(['t-a']);
    odaberiPotez({
      trazenaSlova: 'ma',
      kandidati: ['masa', 'mast', 'maslac', 'maska'],
      ...rjecnik,
      turnToken: 't-b',
      brojAktivnih: 2,
      iskoristeneGrupe: new Set(),
      poolovi: PRAZNI_POOLOVI,
    }, stanje, konfig, () => 0);
    expect([...stanje.agresivnostPoTokenu.keys()]).toEqual(['t-b']);
    expect([...stanje.shieldPoTokenu.keys()]).toEqual(['t-b']);
    expect(stanje.neznanjePoTokenu.has('t-a')).toBe(false);
  });

  it('bez shielda „ka” može ući u uzorak kad postoji druga riječ', () => {
    const r = rng(11);
    const stanje = stvoriStanjeBota(konfigBezPropusta, r);
  const odabrane = new Set<string>();
    for (let i = 0; i < 40; i += 1) {
      const odluka = odaberiPotez({
        trazenaSlova: 'ma',
        kandidati: ['maska', 'masa'],
        ...rjecnik,
        brojAktivnih: 2,
        turnToken: `t-ka-${i}`,
      }, stanje, konfigBezPropusta, r);
      if (odluka.vrsta === 'rijec') odabrane.add(odluka.rijec);
    }
    expect(odabrane.has('masa')).toBe(true);
    expect(odabrane.has('maska')).toBe(true);
    const jedina = odaberiPotez({ trazenaSlova: 'ma', kandidati: ['maska'], ...rjecnik }, stanje, konfigBezPropusta, r);
    expect(jedina).toMatchObject({ vrsta: 'rijec', rijec: 'maska', kategorija: 'uobicajena', izborKa: 'prisilni' });
  });

  it('srednje rijetke poznate riječi ostaju dostupne kad nema uobičajenih', () => {
    const rijeci = laznaRijec({ mastilo: { frekvencija: 20, grupe: ['imenica:mastilo'] } });
    const r = rng(2);
    const stanje = stvoriStanjeBota(konfigBezPropusta, r);
    for (let i = 0; i < 50; i += 1) {
      const odluka = odaberiPotez({ trazenaSlova: 'ma', kandidati: ['mastilo'], ...rijeci }, stanje, konfigBezPropusta, r);
      expect(odluka).toEqual({ vrsta: 'rijec', rijec: 'mastilo', kategorija: 'srednja' });
    }
  });

  // --- PR07: pravilnik + broj aktivnih mijenjaju politiku „ka” ---

  it('politikaKa: agresivni od 3 aktivnih, inače oprezni', () => {
    expect(politikaKa(3)).toBe('agresivni');
    expect(politikaKa(2)).toBe('oprezni');
    expect(politikaKa()).toBe('oprezni');
    expect(oprezKa(3)).toBe(false);
    expect(oprezKa(2)).toBe(true);
    expect(oprezKa()).toBe(true);
  });

  it('PR07 Klasični s 3 aktivna: riječ na „ka” ulazi u pool (agresivni)', () => {
    const rijeci = laznaRijec({
      masa: { frekvencija: 900, grupe: ['imenica:masa'] },
      maska: { frekvencija: 900, grupe: ['imenica:maska'] },
    });
    // Jednaki ponderi + RNG koji bira drugi kandidat → maska mora biti dostupna (bez 1,5 % filtera).
    let brojMaska = 0;
    for (let seed = 1; seed <= 40; seed += 1) {
      const odluka = odaberiPotez({
        trazenaSlova: 'ma',
        kandidati: ['masa', 'maska'],
        ...rijeci,
        pravila: 'klasicni',
        brojAktivnih: 3,
      }, stvoriStanjeBota(konfigBezPropusta, rng(seed)), konfigBezPropusta, rng(seed));
      if (odluka.vrsta === 'rijec' && odluka.rijec === 'maska') brojMaska += 1;
    }
    expect(brojMaska).toBeGreaterThan(0);
  });

  it('PR07 Klasični s 2 aktivna: bez shielda obje riječi mogu ući u uzorak', () => {
    const odluke: string[] = [];
    for (let seed = 1; seed <= 30; seed += 1) {
      const odluka = odaberiPotez({
        trazenaSlova: 'ma',
        kandidati: ['masa', 'maska'],
        ...rjecnik,
        pravila: 'klasicni',
        brojAktivnih: 2,
        turnToken: `t-dvoboj-${seed}`,
      }, stvoriStanjeBota(konfigBezPropusta, rng(seed)), konfigBezPropusta, rng(seed));
      if (odluka.vrsta === 'rijec') odluke.push(odluka.rijec);
    }
    expect(odluke.some((rijec) => rijec === 'maska')).toBe(true);
  });

  it('PR07 Klasični ≥3 na primljeni „ka” uvijek igra kaladont', () => {
    const odluka = odaberiPotez({
      trazenaSlova: 'ka',
      kandidati: ['kava', 'kamen'],
      ...laznaRijec({ kava: { frekvencija: 500, grupe: ['imenica:kava'] }, kamen: { frekvencija: 500, grupe: ['imenica:kamen'] } }),
      pravila: 'klasicni',
      brojAktivnih: 3,
    }, stvoriStanjeBota(konfigBezPropusta, rng(1)), konfigBezPropusta, () => 0);
    expect(odluka).toMatchObject({ vrsta: 'rijec', rijec: 'kaladont' });
  });

  it('PR07 bez polja pravila/faze: default 2 aktivna, politikaKa i dalje oprezni', () => {
    const odluke: string[] = [];
    for (let seed = 1; seed <= 20; seed += 1) {
      const odluka = odaberiPotez({
        trazenaSlova: 'ma',
        kandidati: ['masa', 'maska'],
        ...rjecnik,
        turnToken: `t-def-${seed}`,
      }, stvoriStanjeBota(konfigBezPropusta, rng(seed)), konfigBezPropusta, rng(seed));
      if (odluka.vrsta === 'rijec') odluke.push(odluka.rijec);
    }
    expect(odluke.length).toBeGreaterThan(0);
    expect(politikaKa()).toBe('oprezni');
  });

  it('shield se aktivira samo kod 2 aktivnih; agresivnost ne ovisi o broju', () => {
    const konfig: KonfiguracijaBota = { ...konfigBezPropusta, vjerojatnostAgresivnosti: 1, vjerojatnostShielda: 1 };
    const stanjeDva = stvoriStanjeBota(konfig, () => 0);
    odaberiPotez({
      trazenaSlova: 'ma',
      kandidati: ['masa'],
      ...rjecnik,
      brojAktivnih: 2,
      turnToken: 't-s-2',
      poolovi: PRAZNI_POOLOVI,
    }, stanjeDva, konfig, () => 0);
    expect(odlukaShieldaZaToken(stanjeDva, 't-s-2', 1, () => 0)).toBe(true);
    const stanjeTri = stvoriStanjeBota(konfig, () => 0);
    odaberiPotez({
      trazenaSlova: 'ma',
      kandidati: ['masa'],
      ...rjecnik,
      brojAktivnih: 3,
      turnToken: 't-s-3',
      poolovi: PRAZNI_POOLOVI,
    }, stanjeTri, konfig, () => 0);
    expect(stanjeTri.shieldPoTokenu.has('t-s-3')).toBe(false);
    expect(odlukaAgresivnostiZaToken(stanjeTri, 't-s-3', 1, () => 0)).toBe(true);
  });

  it('PR07 politika ne ovisi o tome je li sljedeći čovjek ili bot (isti ulazi → ista odluka)', () => {
    const ulaz = {
      trazenaSlova: 'ma',
      kandidati: ['masa', 'maska', 'mast'],
      ...rjecnik,
      pravila: 'klasicni' as const,
      brojAktivnih: 3,
      turnToken: 't-isti',
    };
    const a = odaberiPotez(ulaz, stvoriStanjeBota(konfigBezPropusta, rng(11)), konfigBezPropusta, rng(11));
    const b = odaberiPotez(ulaz, stvoriStanjeBota(konfigBezPropusta, rng(11)), konfigBezPropusta, rng(11));
    expect(a).toEqual(b);
  });

  // --- Commit 06: bez obveznog duel filtra; skupe provjere samo u taktici ---

  it('mrtvi završetak više nije izbačen obveznim duel filtrom (običan potez)', () => {
    let pozivaNastavak = 0;
    let pozivaIndeks = 0;
    const rijeci = laznaRijec({
      masa: { frekvencija: 500, grupe: ['imenica:masa'] },
      mast: { frekvencija: 400, grupe: ['imenica:mast'] },
    });
    const odabrane = new Set<string>();
    const r = rng(19);
    const stanje = stvoriStanjeBota(konfigBezPropusta, r);
    for (let i = 0; i < 30; i += 1) {
      const odluka = odaberiPotez({
        trazenaSlova: 'ma',
        kandidati: ['masa', 'mast'],
        ...rijeci,
        pravila: 'klasicni',
        brojAktivnih: 2,
        iskoristeneGrupe: new Set(),
        // „sa” mrtvo, „st” živo — bez self-elim filtera masa i dalje smije ući u pool.
        imaSlobodnuRijecNa: (prefiks) => {
          pozivaIndeks += 1;
          return prefiks === 'st';
        },
        poznatiKandidatiNa: (prefiks) => {
          pozivaNastavak += 1;
          return prefiks === 'st' ? ['stol'] : [];
        },
        turnToken: `t-mrtvi-${i}`,
      }, stanje, konfigBezPropusta, r);
      if (odluka.vrsta === 'rijec') odabrane.add(odluka.rijec);
    }
    expect(odabrane.has('masa')).toBe(true);
    expect(pozivaNastavak).toBe(0);
    expect(pozivaIndeks).toBe(0);
  });

  it('običan potez: 0 % agresivnosti ne skenira poolove', () => {
    const kandidati = Array.from({ length: 40 }, (_, i) => `ma${String(i).padStart(2, '0')}`);
    let poolSken = 0;
    const poolovi = izgradiSnimkuPoolova({
      clanovi: [{ rijec: 'marmor', kategorija: 'pool_1', stanje: 'razrijeseno' }],
      jeAktivnaURjecnika: () => true,
      verzijaRjecnika: 1,
      generacija: 1,
    });
    const obicna = odaberiPotez(
      {
        trazenaSlova: 'ma',
        kandidati,
        frekvencijaZa: () => 500,
        grupeZa: (r) => [`imenica:${r}`],
        pravila: 'klasicni',
        brojAktivnih: 2,
        turnToken: 't-obicna',
        poolovi,
        jeIgrivaRijec: (r) => {
          poolSken += 1;
          return kandidati.includes(r) || r === 'marmor';
        },
      },
      stvoriStanjeBota(konfigBezPropusta, rng(1)),
      konfigBezPropusta,
      rng(1),
    );
    expect(obicna.vrsta).toBe('rijec');
    expect(obicna.vrsta === 'rijec' && obicna.izPoola).not.toBe(true);
    expect(poolSken).toBe(0);
  });

  it('veliki prefiks: uzorak ostaje ograničen na RADNI_UZORAK_PO_POTEZU', () => {
    const kandidati = Array.from({ length: 400 }, (_, i) => `xx${String(i).padStart(3, '0')}`);
    const odluka = odaberiPotez({
      trazenaSlova: 'xx',
      kandidati,
      frekvencijaZa: () => 200,
      grupeZa: (r) => [`imenica:${r}`],
      pravila: 'klasicni',
      brojAktivnih: 4,
      turnToken: 't-veliki',
    }, stvoriStanjeBota(konfigBezPropusta, rng(3)), konfigBezPropusta, rng(3));
    expect(odluka.vrsta).toBe('rijec');
    expect(kandidati.length).toBeGreaterThan(RADNI_UZORAK_PO_POTEZU);
  });

  it('rezervni repertoar radi kad je glavni iscrpljen', () => {
    const snimka: SnimkaRepertoara = {
      generacija: 1,
      poPrefiksu: new Map([
        ['re', { glavni: [], rezerva: ['reka', 'repa'] }],
      ]),
    };
    const igrivi = [...igriviKandidatiIzRepertoara(snimka, 're', () => true)];
    expect(igrivi).toEqual(['reka', 'repa']);
    const odluka = odaberiPotez({
      trazenaSlova: 're',
      kandidati: igrivi,
      frekvencijaZa: () => 300,
      grupeZa: (r) => [`imenica:${r}`],
      pravila: 'klasicni',
      brojAktivnih: 2,
      turnToken: 't-rezerva',
    }, stvoriStanjeBota(konfigBezPropusta, rng(4)), konfigBezPropusta, rng(4));
    expect(odluka.vrsta).toBe('rijec');
    if (odluka.vrsta === 'rijec') expect(['reka', 'repa']).toContain(odluka.rijec);
  });

  it('ograničenje uzorka ne uzrokuje nepotrebno odustajanje', () => {
    const kandidati = Array.from({ length: 250 }, (_, i) => `ab${String(i).padStart(3, '0')}`);
    const odluka = odaberiPotez({
      trazenaSlova: 'ab',
      kandidati,
      frekvencijaZa: () => 100,
      grupeZa: (r) => [`imenica:${r}`],
      pravila: 'klasicni',
      brojAktivnih: 2,
      turnToken: 't-uzorak',
    }, stvoriStanjeBota(konfigBezPropusta, rng(5)), konfigBezPropusta, rng(5));
    expect(odluka.vrsta).toBe('rijec');
    expect(kandidati.length).toBeGreaterThan(RADNI_UZORAK_PO_POTEZU);
  });

  it('sinkroni i nastavivi odabir ostaju usklađeni bez self-elim filtra', async () => {
    const ulaz = {
      trazenaSlova: 'ma' as const,
      kandidati: ['masa', 'mast', 'maslac', 'maska'],
      ...rjecnik,
      pravila: 'klasicni' as const,
      brojAktivnih: 2,
      iskoristeneGrupe: new Set<string>(),
      imaSlobodnuRijecNa: () => false,
      poznatiKandidatiNa: () => [] as string[],
      turnToken: 't-sync-async',
    };
    const a = odaberiPotez(ulaz, stvoriStanjeBota(konfigBezPropusta, rng(8)), konfigBezPropusta, rng(8));
    const b = await odaberiPotezNastavivo(
      {
        ...ulaz,
        poznatiKandidatiNaNastavivo: async function* () { /* prazno — mrtvi nastavci */ },
      },
      stvoriStanjeBota(konfigBezPropusta, rng(8)),
      konfigBezPropusta,
      rng(8),
      async () => undefined,
      () => true,
    );
    expect(b).toEqual(a);
    expect(a.vrsta).toBe('rijec');
  });

  it('dvoboj/troboj/četveroboj: brojAktivnih mijenja situacijsku politiku ostavljanja, ne primljenog „ka”', () => {
    expect(politikaKa(2)).toBe('oprezni');
    expect(politikaKa(3)).toBe('agresivni');
    expect(politikaKa(4)).toBe('agresivni');
    const rijeci = laznaRijec({ kamen: { frekvencija: 500, grupe: ['imenica:kamen'] } });
    for (const n of [2, 3, 4] as const) {
      const odluka = odaberiPotez({
        trazenaSlova: 'ka',
        kandidati: ['kamen'],
        ...rijeci,
        brojAktivnih: n,
        turnToken: `t-ka-${n}`,
      }, stvoriStanjeBota(konfigBezPropusta, rng(n)), konfigBezPropusta, () => 0);
      expect(odluka).toMatchObject({ vrsta: 'rijec', rijec: 'kaladont', kategorija: 'kaladont' });
    }
  });

  it('s 3 aktivna „ka” ulazi u uzorak; shield u dvoboju pomaže izbjeći prijetnju', () => {
    const agresivni: string[] = [];
    for (let seed = 1; seed <= 40; seed += 1) {
      const odluka = odaberiPotez({
        trazenaSlova: 'ma',
        kandidati: ['masa', 'maska'],
        ...rjecnik,
        brojAktivnih: 3,
        turnToken: `t-3-${seed}`,
      }, stvoriStanjeBota(konfigBezPropusta, rng(seed)), konfigBezPropusta, rng(seed));
      if (odluka.vrsta === 'rijec') agresivni.push(odluka.rijec);
    }
    expect(agresivni.some((r) => r === 'maska')).toBe(true);
    const konfigShield: KonfiguracijaBota = { ...konfigBezPropusta, vjerojatnostShielda: 1 };
    const poolovi = izgradiSnimkuPoolova({
      clanovi: [{ rijec: 'sama', kategorija: 'pool_1', stanje: 'razrijeseno' }],
      jeAktivnaURjecnika: () => true,
      verzijaRjecnika: 1,
      generacija: 1,
    });
    const dvoboj: string[] = [];
    for (let seed = 1; seed <= 30; seed += 1) {
      const odluka = odaberiPotez({
        trazenaSlova: 'ma',
        kandidati: ['masa', 'maska'],
        ...rjecnik,
        brojAktivnih: 2,
        turnToken: `t-2-${seed}`,
        poolovi,
        jeIgrivaRijec: (r) => ['masa', 'maska', 'sama', 'kaladont'].includes(r),
      }, stvoriStanjeBota(konfigShield, () => 0), konfigShield, () => 0);
      if (odluka.vrsta === 'rijec') dvoboj.push(odluka.rijec);
    }
    expect(dvoboj.every((r) => r === 'masa')).toBe(true);
  });

  it('vrijeme razmišljanja je ~4 s ±jitter i nikad ne prelazi rok minus marginu', () => {
    const r = rng(9);
    for (let i = 0; i < 100; i += 1) {
      const ms = trajanjeRazmisljanjaMs(30_000, ZADANA_KONFIGURACIJA_BOTA, r, 'javna', { punoTrajanjeMs: 30_000, protekloMs: 0 });
      expect(ms).toBeLessThanOrEqual(4_300);
      expect(ms).toBeGreaterThanOrEqual(3_700);
    }
    expect(trajanjeRazmisljanjaMs(2_000, ZADANA_KONFIGURACIJA_BOTA, r)).toBeLessThanOrEqual(1_850);
    // rng=0 → jitter = -300
    expect(trajanjeRazmisljanjaMs(null, ZADANA_KONFIGURACIJA_BOTA, () => 0)).toBe(3_700);
    // rng ≈ 1 → gornji rub jittera
    expect(trajanjeRazmisljanjaMs(null, ZADANA_KONFIGURACIJA_BOTA, () => 0.999)).toBe(4_300);
    expect(trajanjeRazmisljanjaMs(30_000, ZADANA_KONFIGURACIJA_BOTA, () => 0.5, 'trening', { punoTrajanjeMs: 30_000, protekloMs: 0 })).toBe(4_000);
  });

  it('identitet i duljina riječi ne mijenjaju fiksni tempo', () => {
    const a = trajanjeRazmisljanjaMs(30_000, ZADANA_KONFIGURACIJA_BOTA, () => 0.5, 'javna', { punoTrajanjeMs: 30_000, protekloMs: 0 });
    const b = trajanjeRazmisljanjaMs(30_000, ZADANA_KONFIGURACIJA_BOTA, () => 0.5, 'trening', { punoTrajanjeMs: 30_000, protekloMs: 0 });
    expect(a).toBe(4_000);
    expect(b).toBe(4_000);
  });

  it('QA #100: bez roka na stagingu 3 s s ljudima, 0,2 s bez njih; CI ostaje brz', () => {
    expect(odgodaBezRokaMs(4_000, { kontekst: 'javna', imaAktivnogCovjeka: true, okruzenje: 'staging' })).toBe(STAGING_BOT_POTEZ_S_LJUDIMA_MS);
    expect(odgodaBezRokaMs(4_000, { kontekst: 'trening', imaAktivnogCovjeka: true, okruzenje: 'staging' })).toBe(STAGING_BOT_POTEZ_S_LJUDIMA_MS);
    expect(odgodaBezRokaMs(4_000, { kontekst: 'javna', imaAktivnogCovjeka: false, okruzenje: 'staging' })).toBe(BOT_POTEZ_BEZ_ROKA_MS);
    expect(odgodaBezRokaMs(4_000, { kontekst: 'javna', imaAktivnogCovjeka: true, okruzenje: 'test' })).toBe(BOT_POTEZ_BEZ_ROKA_MS);
    expect(odgodaBezRokaMs(4_000, { kontekst: 'trening', imaAktivnogCovjeka: true, okruzenje: 'test' })).toBe(4_000);
  });

  it('konfiguracija iz okoline mijenja samo valjane postotke', () => {
    const konfig = ucitajKonfiguracijuBota({
      BOT_NEZNANJE_U_MALOM_SKUPU: '0.5',
      BOT_VJEROJATNOST_AGRESIVNOSTI: '0.4',
      BOT_VJEROJATNOST_SHIELDA: '0.55',
      BOT_VJEROJATNOST_TAKTICKOG_POTEZA: '0.99',
      BOT_VJEROJATNOST_KA: 'abc',
      BOT_NEZNANJE_PO_SUDJELOVANJU: '0.9',
    } as NodeJS.ProcessEnv);
    expect(konfig.vjerojatnostNeznanjaUMalomSkupu).toBe(0.5);
    expect(konfig.vjerojatnostAgresivnosti).toBe(0.4);
    expect(konfig.vjerojatnostShielda).toBe(0.55);
    const parsano = parsajSpremljenuKonfiguraciju({
      ...ZADANA_KONFIGURACIJA_BOTA,
      vjerojatnostPropustaKa: 0.99,
      vjerojatnostOstavljanjaKa: 0.99,
    });
    expect('vjerojatnostPropustaKa' in parsano).toBe(false);
    expect('vjerojatnostOstavljanjaKa' in parsano).toBe(false);
  });

  it('fond v5 ima 46 imenovanih bez gostiju', () => {
    expect(NADIMCI_POCETNOG_FONDA_V5).toHaveLength(BROJ_IMENOVANIH_FONDA_V5);
    expect(NADIMCI_POCETNOG_FONDA_V5.every(({ nadimak }) => jeValjanNadimak(nadimak))).toBe(true);
    const stavke = stavkeZamjeneFondaBotova();
    expect(stavke).toHaveLength(CILJ_AKTIVNIH_FONDA_V5);
    expect(stavke.filter((s) => s.tip === 'imenovani')).toHaveLength(BROJ_IMENOVANIH_FONDA_V5);
    expect(stavke.filter((s) => s.tip === 'gost')).toHaveLength(BROJ_GOSTIJU_FONDA_V5);
    expect(stavke.every((s) => s.kljucSeeda.startsWith('bot-v5-'))).toBe(true);
    expect(stavke[0]?.kljucSeeda).toBe('bot-v5-imenovani-001');
    expect(stavke[0]?.nadimak).toBe('BOTINA');
  });

  it('zakašnjeli događaj oduzima proteklo vrijeme od fiksnog cilja', () => {
    const puni = trajanjeRazmisljanjaMs(30_000, konfigBezPropusta, () => 0.5, 'javna', { punoTrajanjeMs: 30_000, protekloMs: 0 });
    expect(puni).toBe(4_000);
    expect(trajanjeRazmisljanjaMs(25_000, konfigBezPropusta, () => 0.5, 'javna', { punoTrajanjeMs: 30_000, protekloMs: 1_200 })).toBe(2_800);
    expect(trajanjeRazmisljanjaMs(10_000, konfigBezPropusta, () => 0.5, 'javna', { punoTrajanjeMs: 30_000, protekloMs: 20_000 })).toBe(0);
    // Kratki preostali rok ima prednost nad ciljem 4 s.
    expect(trajanjeRazmisljanjaMs(2_000, konfigBezPropusta, () => 0.5, 'javna', { punoTrajanjeMs: 30_000, protekloMs: 0 })).toBeLessThanOrEqual(1_850);
  });

  it('stari env postotci ne dobivaju tiho novo značenje', () => {
    const konfiguracija = ucitajKonfiguracijuBota({ BOT_VJEROJATNOST_NE_ZNAM: '1', BOT_NEZNANJE_PO_SUDJELOVANJU: '1', BOT_VJEROJATNOST_ISTEKA: '1' });
    expect(konfiguracija.vjerojatnostNeznanjaUMalomSkupu).toBe(0.1);
  });

  it('migracija odbacuje zastarjela Dokaži polja iz starog JSON-a', () => {
    const stari = {
      ...ZADANA_KONFIGURACIJA_BOTA,
      dokaziBudzetDetaljneProvjere: 20,
      dokaziBudzetDodatneProvjere: 15,
      vjerojatnostDokaziPreskokaPotvrde: 0.5,
      dokaziFaktorPropusaPotvrde: 0.8,
    };
    const parsano = parsajSpremljenuKonfiguraciju(stari);
    expect('dokaziBudzetDetaljneProvjere' in parsano).toBe(false);
    expect('dokaziBudzetDodatneProvjere' in parsano).toBe(false);
    expect('vjerojatnostDokaziPreskokaPotvrde' in parsano).toBe(false);
    expect('dokaziFaktorPropusaPotvrde' in parsano).toBe(false);
  });

  it('migracija v5→v6 odbacuje neznanje po sudjelovanju i daje kontekstualne parametre', () => {
    const stara = {
      ...ZADANA_KONFIGURACIJA_BOTA,
      verzija: 5,
      vjerojatnostNeznanjaPoSudjelovanju: 1,
      rasponTeskogPotezaNeznanja: [1, 3],
      vjerojatnostIzostankaPoSudjelovanju: 1,
      botoviDvoboj: true,
    };
    const parsano = parsajSpremljenuKonfiguraciju(stara);
    expect(parsano.verzija).toBe(VERZIJA_BOT_POLITIKE);
    expect(parsano.vjerojatnostNeznanjaUMalomSkupu).toBe(0.1);
    expect(parsano.vjerojatnostAgresivnosti).toBe(0.3);
    expect(parsano.vjerojatnostShielda).toBe(0.3);
    expect('vjerojatnostTaktickogPoteza' in parsano).toBe(false);
    expect(parsano.botoviDvoboj).toBe(true);
    expect('vjerojatnostNeznanjaPoSudjelovanju' in parsano).toBe(false);
    expect('rasponTeskogPotezaNeznanja' in parsano).toBe(false);
  });
});

describe('Botovi V8 Commit 07 — KA bez vjerojatnosti', () => {
  const profili = ['pocetnik', 'iskusni', 'majstor', 'velemajstor'] as const;

  it.each(profili.flatMap((profileId) => ([2, 4] as const).map((brojAktivnih) => ({ profileId, brojAktivnih }))))(
    'profil $profileId na primljeni „ka” → kaladont (aktivnih=$brojAktivnih)',
    ({ profileId, brojAktivnih }) => {
      const { konfiguracija } = razrijesiProfilBota(profileId);
      const odluka = odaberiPotez({
        trazenaSlova: 'ka',
        kandidati: ['kava', 'kamen'],
        ...laznaRijec({ kava: { frekvencija: 500, grupe: ['imenica:kava'] }, kamen: { frekvencija: 600, grupe: ['imenica:kamen'] } }),
        brojAktivnih,
      }, stvoriStanjeBota(konfiguracija, rng(1)), konfiguracija, () => 0);
      expect(odluka).toEqual({ vrsta: 'rijec', rijec: 'kaladont', kategorija: 'kaladont' });
    },
  );

  it('shield u dvoboju: masa+maska → masa; samo maska → prisilni', () => {
    const konfig: KonfiguracijaBota = { ...konfigBezPropusta, vjerojatnostShielda: 1 };
    const poolovi = izgradiSnimkuPoolova({
      clanovi: [{ rijec: 'sama', kategorija: 'pool_1', stanje: 'razrijeseno' }],
      jeAktivnaURjecnika: () => true,
      verzijaRjecnika: 1,
      generacija: 1,
    });
    const stanje = stvoriStanjeBota(konfig, () => 0);
    for (let i = 0; i < 30; i += 1) {
      expect(odaberiPotez({
        trazenaSlova: 'ma',
        kandidati: ['masa', 'maska'],
        ...laznaRijec({
          masa: { frekvencija: 900, grupe: ['imenica:masa'] },
          maska: { frekvencija: 900, grupe: ['imenica:maska'] },
        }),
        brojAktivnih: 2,
        turnToken: `t-sh-${i}`,
        poolovi,
        jeIgrivaRijec: (r) => ['masa', 'maska', 'sama', 'kaladont'].includes(r),
      }, stanje, konfig, () => 0)).toEqual({ vrsta: 'rijec', rijec: 'masa', kategorija: 'uobicajena' });
    }
    const prisilni = odaberiPotez({
      trazenaSlova: 'ma',
      kandidati: ['maska'],
      ...laznaRijec({ maska: { frekvencija: 900, grupe: ['imenica:maska'] } }),
      brojAktivnih: 2,
    }, stvoriStanjeBota(konfigBezPropusta, rng(1)), konfigBezPropusta, rng(1));
    expect(prisilni).toMatchObject({ vrsta: 'rijec', rijec: 'maska', izborKa: 'prisilni' });
  });

  it('uzorkujPonderirano: veličina, jedinstvenost i O(n) frekvencijaZa', () => {
    const kandidati = Array.from({ length: 200 }, (_, i) => `ab${String(i).padStart(3, '0')}`);
    let pozivi = 0;
    const frekvencijaZa = (rijec: string) => {
      pozivi += 1;
      return 100 + (rijec.charCodeAt(2) ?? 0);
    };
    const uzorak = uzorkujPonderirano(kandidati, 100, frekvencijaZa, rng(5), konfigBezPropusta);
    expect(uzorak).toHaveLength(100);
    expect(new Set(uzorak).size).toBe(100);
    expect(pozivi).toBeLessThanOrEqual(220);
    expect(pozivi).toBeGreaterThanOrEqual(180);
  });

  it('sinkroni i nastavivi odabir ostaju usklađeni na istom seedu', async () => {
    const ulaz = {
      trazenaSlova: 'ma' as const,
      kandidati: ['masa', 'mast', 'maslac', 'maska'],
      ...laznaRijec({
        maslac: { frekvencija: 500, grupe: ['imenica:maslac'] },
        masa: { frekvencija: 900, grupe: ['imenica:masa'] },
        mast: { frekvencija: 300, grupe: ['imenica:mast'] },
        maska: { frekvencija: 400, grupe: ['imenica:maska'] },
      }),
      pravila: 'klasicni' as const,
      brojAktivnih: 2,
      iskoristeneGrupe: new Set<string>(),
      imaSlobodnuRijecNa: () => false,
      poznatiKandidatiNa: () => [] as string[],
      turnToken: 't-c07-sync',
    };
    const a = odaberiPotez(ulaz, stvoriStanjeBota(konfigBezPropusta, rng(8)), konfigBezPropusta, rng(8));
    const b = await odaberiPotezNastavivo(
      { ...ulaz, poznatiKandidatiNaNastavivo: async function* () { /* prazno */ } },
      stvoriStanjeBota(konfigBezPropusta, rng(8)),
      konfigBezPropusta,
      rng(8),
      async () => undefined,
      () => true,
    );
    expect(b).toEqual(a);
  });

  it('migracija stripa vjerojatnostPropustaKa i vjerojatnostOstavljanjaKa', () => {
    const parsano = parsajSpremljenuKonfiguraciju({
      ...ZADANA_KONFIGURACIJA_BOTA,
      vjerojatnostPropustaKa: 1,
      vjerojatnostOstavljanjaKa: 1,
    });
    expect('vjerojatnostPropustaKa' in parsano).toBe(false);
    expect('vjerojatnostOstavljanjaKa' in parsano).toBe(false);
    expect(parsano.verzija).toBe(VERZIJA_BOT_POLITIKE);
  });
});

describe('Botovi V8 Commit 10 — agresivnost i shield', () => {
  it('agresivnost bira iz poola po prioritetu p2_p1', () => {
    const konfig: KonfiguracijaBota = { ...konfigBezPropusta, vjerojatnostAgresivnosti: 1, prioritetPoolova: 'p2_p1' };
    const poolovi = izgradiSnimkuPoolova({
      clanovi: [
        { rijec: 'marmor', kategorija: 'pool_1', stanje: 'razrijeseno' },
        { rijec: 'madrac', kategorija: 'pool_2', stanje: 'razrijeseno' },
      ],
      jeAktivnaURjecnika: () => true,
      verzijaRjecnika: 1,
      generacija: 1,
    });
    const odluka = odaberiPotez({
      trazenaSlova: 'ma',
      kandidati: ['masa', 'mast'],
      frekvencijaZa: (r) => (r === 'madrac' || r === 'marmor' ? 50 : 900),
      grupeZa: (r) => [`imenica:${r}`],
      brojAktivnih: 3,
      turnToken: 't-pool-p2',
      poolovi,
      jeIgrivaRijec: (r) => ['masa', 'mast', 'marmor', 'madrac'].includes(r),
    }, stvoriStanjeBota(konfig, () => 0.5), konfig, () => 0.5);
    expect(odluka).toMatchObject({ vrsta: 'rijec', rijec: 'madrac', izPoola: true });
  });

  it('pool odabir isključuje odbijene riječi', () => {
    const konfig: KonfiguracijaBota = { ...konfigBezPropusta, vjerojatnostAgresivnosti: 1, prioritetPoolova: 'p2_p1' };
    const poolovi = izgradiSnimkuPoolova({
      clanovi: [
        { rijec: 'marmor', kategorija: 'pool_1', stanje: 'razrijeseno' },
        { rijec: 'madrac', kategorija: 'pool_2', stanje: 'razrijeseno' },
      ],
      jeAktivnaURjecnika: () => true,
      verzijaRjecnika: 1,
      generacija: 1,
    });
    const odluka = odaberiPotez({
      trazenaSlova: 'ma',
      kandidati: ['masa', 'mast'],
      frekvencijaZa: (r) => (r === 'madrac' || r === 'marmor' ? 50 : 900),
      grupeZa: (r) => [`imenica:${r}`],
      brojAktivnih: 3,
      turnToken: 't-pool-odb',
      poolovi,
      odbijeneRijeci: new Set(['madrac']),
      jeIgrivaRijec: (r) => ['masa', 'mast', 'marmor', 'madrac'].includes(r),
    }, stvoriStanjeBota(konfig, () => 0.5), konfig, () => 0.5);
    expect(odluka).toMatchObject({ vrsta: 'rijec', rijec: 'marmor', izPoola: true });
  });

  it('članovi poola isključeni su iz običnog uzorka', () => {
    const konfig: KonfiguracijaBota = { ...konfigBezPropusta, vjerojatnostAgresivnosti: 0 };
    const poolovi = izgradiSnimkuPoolova({
      clanovi: [{ rijec: 'masa', kategorija: 'pool_1', stanje: 'razrijeseno' }],
      jeAktivnaURjecnika: () => true,
      verzijaRjecnika: 1,
      generacija: 1,
    });
    const odluka = odaberiPotez({
      trazenaSlova: 'ma',
      kandidati: ['masa', 'mast'],
      frekvencijaZa: () => 500,
      grupeZa: (r) => [`imenica:${r}`],
      brojAktivnih: 2,
      turnToken: 't-excl',
      poolovi,
    }, stvoriStanjeBota(konfig, rng(2)), konfig, rng(2));
    expect(odluka.vrsta).toBe('rijec');
    if (odluka.vrsta === 'rijec') expect(odluka.rijec).toBe('mast');
  });

  it('oporavak ne mijenja odluku agresivnosti po tokenu', () => {
    const konfig: KonfiguracijaBota = { ...konfigBezPropusta, vjerojatnostAgresivnosti: 0.5 };
    const stanje = stvoriStanjeBota(konfig, () => 0.2);
    odaberiPotez({
      trazenaSlova: 'ma',
      kandidati: ['masa'],
      frekvencijaZa: () => 500,
      grupeZa: (r) => [`imenica:${r}`],
      turnToken: 't-op',
      brojAktivnih: 2,
      poolovi: PRAZNI_POOLOVI,
    }, stanje, konfig, () => 0.2);
    const prije = odlukaAgresivnostiZaToken(stanje, 't-op', 0.5, () => 0.99);
    const poslije = odaberiPotez({
      trazenaSlova: 'ma',
      kandidati: ['masa'],
      frekvencijaZa: () => 500,
      grupeZa: (r) => [`imenica:${r}`],
      turnToken: 't-op',
      oporavak: true,
      brojAktivnih: 2,
      poolovi: PRAZNI_POOLOVI,
    }, stanje, konfig, () => 0.99);
    expect(poslije.vrsta).toBe('rijec');
    expect(odlukaAgresivnostiZaToken(stanje, 't-op', 0.5, () => 0.99)).toBe(prije);
  });
});

describe('Botovi V8 — Shield prioritet i oporavak', () => {
  const igrive = (...rijeci: string[]) => (r: string) => rijeci.includes(r);
  const grupe = (r: string) => [`imenica:${r}`];
  const frek = () => 500;

  function snimkaPoolova(clanovi: Array<{ rijec: string; kategorija: 'pool_1' | 'pool_2' }>) {
    return izgradiSnimkuPoolova({
      clanovi: clanovi.map((c) => ({ ...c, stanje: 'razrijeseno' as const })),
      jeAktivnaURjecnika: () => true,
      verzijaRjecnika: 1,
      generacija: 1,
    });
  }

  it('oba poola sigurna + Shield: bira samo prioritetni (p2_p1 → P2)', () => {
    const konfig: KonfiguracijaBota = {
      ...konfigBezPropusta,
      vjerojatnostAgresivnosti: 1,
      vjerojatnostShielda: 1,
      prioritetPoolova: 'p2_p1',
    };
    // marmor/madrac ne završavaju na ka i nema Pool1 na njihovim nastavcima → sigurni
    const poolovi = snimkaPoolova([
      { rijec: 'marmor', kategorija: 'pool_1' },
      { rijec: 'madrac', kategorija: 'pool_2' },
    ]);
    const odluka = odaberiPotez({
      trazenaSlova: 'ma',
      kandidati: ['masa'],
      frekvencijaZa: frek,
      grupeZa: grupe,
      brojAktivnih: 2,
      turnToken: 't-sig-oba',
      pravila: 'klasicni',
      poolovi,
      jeIgrivaRijec: igrive('masa', 'marmor', 'madrac'),
    }, stvoriStanjeBota(konfig, () => 0), konfig, () => 0);
    expect(odluka).toMatchObject({ vrsta: 'rijec', rijec: 'madrac', izPoola: true });
  });

  it('oba poola sigurna + Shield + p1_p2: bira P1', () => {
    const konfig: KonfiguracijaBota = {
      ...konfigBezPropusta,
      vjerojatnostAgresivnosti: 1,
      vjerojatnostShielda: 1,
      prioritetPoolova: 'p1_p2',
    };
    const poolovi = snimkaPoolova([
      { rijec: 'marmor', kategorija: 'pool_1' },
      { rijec: 'madrac', kategorija: 'pool_2' },
    ]);
    const odluka = odaberiPotez({
      trazenaSlova: 'ma',
      kandidati: ['masa'],
      frekvencijaZa: frek,
      grupeZa: grupe,
      brojAktivnih: 2,
      turnToken: 't-sig-p1',
      pravila: 'klasicni',
      poolovi,
      jeIgrivaRijec: igrive('masa', 'marmor', 'madrac'),
    }, stvoriStanjeBota(konfig, () => 0), konfig, () => 0);
    expect(odluka).toMatchObject({ vrsta: 'rijec', rijec: 'marmor', izPoola: true });
  });

  it('prioritetni rizičan, sekundarni siguran → sekundarni', () => {
    const konfig: KonfiguracijaBota = {
      ...konfigBezPropusta,
      vjerojatnostAgresivnosti: 1,
      vjerojatnostShielda: 1,
      prioritetPoolova: 'p2_p1',
    };
    // maska (P2) završava na ka → rizična; marmor (P1) sigurna
    const poolovi = snimkaPoolova([
      { rijec: 'marmor', kategorija: 'pool_1' },
      { rijec: 'maska', kategorija: 'pool_2' },
    ]);
    const odluka = odaberiPotez({
      trazenaSlova: 'ma',
      kandidati: ['masa'],
      frekvencijaZa: frek,
      grupeZa: grupe,
      brojAktivnih: 2,
      turnToken: 't-prio-riz',
      pravila: 'klasicni',
      poolovi,
      jeIgrivaRijec: igrive('masa', 'marmor', 'maska'),
    }, stvoriStanjeBota(konfig, () => 0), konfig, () => 0);
    expect(odluka).toMatchObject({ vrsta: 'rijec', rijec: 'marmor', izPoola: true });
  });

  it('oba poola rizična, obična sigurna → obična', () => {
    const konfig: KonfiguracijaBota = {
      ...konfigBezPropusta,
      vjerojatnostAgresivnosti: 1,
      vjerojatnostShielda: 1,
      prioritetPoolova: 'p2_p1',
    };
    const poolovi = snimkaPoolova([
      { rijec: 'marka', kategorija: 'pool_1' },
      { rijec: 'maska', kategorija: 'pool_2' },
    ]);
    const odluka = odaberiPotez({
      trazenaSlova: 'ma',
      kandidati: ['masa'],
      frekvencijaZa: frek,
      grupeZa: grupe,
      brojAktivnih: 2,
      turnToken: 't-obic-sig',
      pravila: 'klasicni',
      poolovi,
      jeIgrivaRijec: igrive('masa', 'marka', 'maska'),
    }, stvoriStanjeBota(konfig, () => 0), konfig, () => 0);
    expect(odluka).toMatchObject({ vrsta: 'rijec', rijec: 'masa' });
    if (odluka.vrsta === 'rijec') expect(odluka.izPoola).not.toBe(true);
  });

  it('sve dostupne riječi rizične → ipak igra, ne odustaje', () => {
    const konfig: KonfiguracijaBota = {
      ...konfigBezPropusta,
      vjerojatnostAgresivnosti: 1,
      vjerojatnostShielda: 1,
      prioritetPoolova: 'p1_p2',
    };
    const poolovi = snimkaPoolova([
      { rijec: 'marka', kategorija: 'pool_1' },
      { rijec: 'maska', kategorija: 'pool_2' },
    ]);
    const odluka = odaberiPotez({
      trazenaSlova: 'ma',
      kandidati: ['matka'],
      frekvencijaZa: frek,
      grupeZa: grupe,
      brojAktivnih: 2,
      turnToken: 't-sve-riz',
      pravila: 'klasicni',
      poolovi,
      jeIgrivaRijec: igrive('matka', 'marka', 'maska'),
    }, stvoriStanjeBota(konfig, () => 0), konfig, () => 0);
    expect(odluka.vrsta).toBe('rijec');
    if (odluka.vrsta === 'rijec') expect(['marka', 'maska', 'matka']).toContain(odluka.rijec);
  });

  it('neuspješan roll agresivnosti + Shield ne dira napadačke poolove', () => {
    const konfig: KonfiguracijaBota = {
      ...konfigBezPropusta,
      vjerojatnostAgresivnosti: 0,
      vjerojatnostShielda: 1,
      prioritetPoolova: 'p2_p1',
    };
    const poolovi = snimkaPoolova([
      { rijec: 'madrac', kategorija: 'pool_2' },
    ]);
    const odluka = odaberiPotez({
      trazenaSlova: 'ma',
      kandidati: ['masa'],
      frekvencijaZa: frek,
      grupeZa: grupe,
      brojAktivnih: 2,
      turnToken: 't-bez-agg',
      pravila: 'klasicni',
      poolovi,
      jeIgrivaRijec: igrive('masa', 'madrac'),
    }, stvoriStanjeBota(konfig, () => 0), konfig, () => 0);
    expect(odluka).toMatchObject({ vrsta: 'rijec', rijec: 'masa' });
    if (odluka.vrsta === 'rijec') expect(odluka.izPoola).not.toBe(true);
  });

  it('odbijena pool riječ + prazan obični + druga legalna u poolu', () => {
    const konfig: KonfiguracijaBota = {
      ...konfigBezPropusta,
      vjerojatnostAgresivnosti: 1,
      vjerojatnostShielda: 0,
      prioritetPoolova: 'p2_p1',
    };
    const poolovi = snimkaPoolova([
      { rijec: 'marmor', kategorija: 'pool_1' },
      { rijec: 'madrac', kategorija: 'pool_2' },
    ]);
    const odluka = odaberiPotez({
      trazenaSlova: 'ma',
      kandidati: [],
      frekvencijaZa: frek,
      grupeZa: grupe,
      brojAktivnih: 3,
      turnToken: 't-odb-praz',
      poolovi,
      odbijeneRijeci: new Set(['madrac']),
      jeIgrivaRijec: igrive('marmor', 'madrac'),
    }, stvoriStanjeBota(konfig, () => 0.5), konfig, () => 0.5);
    expect(odluka).toMatchObject({ vrsta: 'rijec', rijec: 'marmor', izPoola: true });
  });

  it('završetak ka = Shield prijetnja i kad jeIgriva(kaladont) vraća false', () => {
    const konfig: KonfiguracijaBota = {
      ...konfigBezPropusta,
      vjerojatnostAgresivnosti: 0,
      vjerojatnostShielda: 1,
    };
    const odluka = odaberiPotez({
      trazenaSlova: 'ma',
      kandidati: ['masa', 'maska'],
      frekvencijaZa: (r) => (r === 'maska' ? 900 : 100),
      grupeZa: grupe,
      brojAktivnih: 2,
      turnToken: 't-ka-motor',
      pravila: 'klasicni',
      poolovi: PRAZNI_POOLOVI,
      // namjerno: kaladont nije u rječniku / nije igriv
      jeIgrivaRijec: (r) => r === 'masa' || r === 'maska',
    }, stvoriStanjeBota(konfig, () => 0), konfig, () => 0);
    expect(odluka).toMatchObject({ vrsta: 'rijec', rijec: 'masa' });
  });

  it('sinkroni i nastavivi selektor daju isti ishod na fiksturi prioriteta', async () => {
    const konfig: KonfiguracijaBota = {
      ...konfigBezPropusta,
      vjerojatnostAgresivnosti: 1,
      vjerojatnostShielda: 1,
      prioritetPoolova: 'p2_p1',
    };
    const poolovi = snimkaPoolova([
      { rijec: 'marmor', kategorija: 'pool_1' },
      { rijec: 'madrac', kategorija: 'pool_2' },
    ]);
    const ulaz = {
      trazenaSlova: 'ma',
      kandidati: ['masa'],
      frekvencijaZa: frek,
      grupeZa: grupe,
      brojAktivnih: 2,
      turnToken: 't-eq-prio',
      pravila: 'klasicni' as const,
      poolovi,
      jeIgrivaRijec: igrive('masa', 'marmor', 'madrac'),
      poznatiKandidatiNaNastavivo: async function* () {
        yield 'masa';
      },
    };
    const a = odaberiPotez(ulaz, stvoriStanjeBota(konfig, () => 0), konfig, () => 0);
    const b = await odaberiPotezNastavivo(
      { ...ulaz, turnToken: 't-eq-prio-n' },
      stvoriStanjeBota(konfig, () => 0),
      konfig,
      () => 0,
      async () => undefined,
      () => true,
    );
    expect(a).toMatchObject({ vrsta: 'rijec', rijec: 'madrac', izPoola: true });
    expect(b).toMatchObject({ vrsta: 'rijec', rijec: 'madrac', izPoola: true });
  });
});

describe('validacija admin postavki bota', () => {
  it('prihvaća zadane postavke i odbija nepoznate ključeve', () => {
    expect(ShemaKonfiguracijeBota.safeParse(ZADANA_KONFIGURACIJA_BOTA).success).toBe(true);
    expect(ShemaKonfiguracijeBota.safeParse({ ...ZADANA_KONFIGURACIJA_BOTA, tajna: 'ne' }).success).toBe(false);
  });

  it.each([
    { vjerojatnostNeznanjaUMalomSkupu: NaN },
    { vjerojatnostAgresivnosti: Infinity },
    { pragFrekvencije: { uobicajena: 10, srednja: 100 } },
    { jitterPotezaBotaMs: 5_000 },
    { maksimalnoOpcijaMalogSkupa: 0 },
    { prioritetPoolova: 'p3_p1' },
    { pragoviPopuneMs: { dva_igraca: [3_000], tri_igraca: [10_000, 20_000], cetiri_igraca: [40_000, 30_000, 20_000] } },
    { odstupanjaPopuneMs: { dva_igraca: [4_000], tri_igraca: [0], cetiri_igraca: [3_000, 3_000, 3_000] } },
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

  async function dovršiAsyncOdluku() {
    for (let i = 0; i < 24; i += 1) {
      await new Promise((r) => setImmediate(r));
    }
  }

  function mockRjecnikZaKontroler(verzija = () => 1) {
    const kandidati = ['masa', 'mast'];
    const snimka = izgradiRepertoarBotova({
      prefiksi: () => ['ma'].values(),
      rijeciNaPrefiksu: () => kandidati,
      frekvencijaZa: () => 500,
      grupeZa: (r) => [`imenica:${r}`],
      jeOsnovniOblik: () => true,
      jePostojecaRijec: (r) => kandidati.includes(r),
    }, verzija());
    return {
      igriviKandidati: function* () {
        yield* kandidati;
      },
      frekvencijaZa: () => 500,
      grupeZa: (r: string) => [`imenica:${r}`],
      verzijaRjecnika: verzija,
      imaSlobodnuRijecNa: () => true,
      jeIgrivaRijec: (r: string) => kandidati.includes(r),
      repertoarBotova: () => snimka,
      pooloviBotova: () => PRAZNI_POOLOVI,
    };
  }

  function stvori(izvrsi: (p: string, i: string, n: unknown) => RezultatNaredbe, verzija = () => 1, konfiguracija = konfigBezPropusta, dodatno: Partial<import('../src/bot/kontroler.js').OvisnostiBotKontrolera> = {}) {
    const timeri: { posao: () => void; ms: number }[] = [];
    const prekini = vi.fn();
    let satRasporeda = 0;
    const raspored = new RasporedjivacOdziva({
      predaj: async () => undefined,
      // Monotoni sat — inače budžet 0 ms drži posao u beskonačnom 'nastavi' krugu.
      sada: () => { satRasporeda += 1; return satRasporeda; },
    });
    const kontroler = new BotKontroler({
      rjecnik: mockRjecnikZaKontroler(verzija),
      predajKontrolu: async () => undefined,
      rasporedOdziva: raspored,
      izvrsiNaredbu: izvrsi as never,
      konfiguracija,
      rng: rng(4),
      rngPrezentacije: () => 0.5,
      sada: () => 0,
      zakazi: (posao, ms) => {
        timeri.push({ posao, ms });
        return timeri.length as unknown as NodeJS.Timeout;
      },
      otkazi: (handle) => { timeri.splice((handle as unknown as number) - 1, 1, { posao: () => undefined, ms: -1 }); },
      prekiniZbogGreske: prekini,
      ...dodatno,
    });
    async function odgubi(indeks = 0) {
      timeri[indeks]?.posao();
      for (let i = 0; i < 40 && raspored.brojAktivnih() > 0; i += 1) {
        await dovršiAsyncOdluku();
      }
      await dovršiAsyncOdluku();
    }
    return { kontroler, timeri, prekini, odgubi, raspored };
  }

  it('planira jednu akciju za bota na potezu i izvršava je s istim tokenom', async () => {
    const izvrsi = vi.fn(() => ({ ishod: 'prihvacen' }) as RezultatNaredbe);
    const { kontroler, timeri } = stvori(izvrsi);
    kontroler.naPromjenuPoteza(dogadaj());
    expect(timeri).toHaveLength(1);
    expect(timeri[0]!.ms).toBe(4_000);
    timeri[0]!.posao();
    await dovršiAsyncOdluku();
    expect(izvrsi).toHaveBeenCalledWith('p1', 'bot', expect.objectContaining({ vrsta: 'rijec', turnToken: 't1' }));
    expect(kontroler.brojaci.odigranihRijeci).toBe(1);
  });

  it('trening koristi isti ~4 s tempo i nikad ne čeka namjerni istek', () => {
    const { kontroler, timeri } = stvori(() => ({ ishod: 'prihvacen' }));
    kontroler.naPromjenuPoteza(dogadaj({ kontekst: 'trening' }));
    expect(timeri[0]!.ms).toBe(4_000);
    expect(kontroler.brojaci.namjernihCekanjaIsteka).toBe(0);
  });

  it('QA #100 staging: bez roka bot čeka 3 s s ljudima, 0,2 s kad ostanu samo botovi', () => {
    const { kontroler: sLjudima, timeri: timeriLjudi } = stvori(() => ({ ishod: 'prihvacen' }), () => 1, konfigBezPropusta, { okruzenje: 'staging' });
    sLjudima.naPromjenuPoteza(dogadaj({ istekPotezaMs: null }));
    expect(timeriLjudi[0]!.ms).toBe(STAGING_BOT_POTEZ_S_LJUDIMA_MS);

    const { kontroler: bezLjudi, timeri: timeriBotovi } = stvori(() => ({ ishod: 'prihvacen' }), () => 1, konfigBezPropusta, { okruzenje: 'staging' });
    bezLjudi.naPromjenuPoteza(dogadaj({
      istekPotezaMs: null,
      sudionici: [
        { igracId: 'covjek', upravljac: 'covjek', aktivan: false },
        { igracId: 'bot', upravljac: 'bot', aktivan: true },
        { igracId: 'bot2', upravljac: 'bot', aktivan: true },
      ],
    }));
    expect(timeriBotovi[0]!.ms).toBe(BOT_POTEZ_BEZ_ROKA_MS);
  });

  it('bez roka izvan staginga ostaje 0,2 s (CI / privatno)', () => {
    const { kontroler, timeri } = stvori(() => ({ ishod: 'prihvacen' }), () => 1, konfigBezPropusta, { okruzenje: 'test' });
    kontroler.naPromjenuPoteza(dogadaj({ istekPotezaMs: null }));
    expect(timeri[0]!.ms).toBe(BOT_POTEZ_BEZ_ROKA_MS);
  });

  it('javna bot-only uz aktivan timer ubrzava odgodu na ≤ 200 ms', () => {
    const { kontroler, timeri } = stvori(() => ({ ishod: 'prihvacen' }), () => 1, konfigBezPropusta);
    kontroler.naPromjenuPoteza(dogadaj({
      sudionici: [
        { igracId: 'covjek', upravljac: 'covjek', aktivan: false },
        { igracId: 'bot', upravljac: 'bot', aktivan: true },
        { igracId: 'bot2', upravljac: 'bot', aktivan: true },
      ],
    }));
    expect(timeri[0]!.ms).toBeLessThanOrEqual(BOT_POTEZ_BEZ_ROKA_MS);
  });

  it('javna bot-duel nakon 10 poteza forsira Ne znam', async () => {
    const sudionici = [
      { igracId: 'covjek', upravljac: 'covjek' as const, aktivan: false },
      { igracId: 'bot', upravljac: 'bot' as const, aktivan: true },
      { igracId: 'bot2', upravljac: 'bot' as const, aktivan: true },
    ];
    const izvrsi = vi.fn(() => ({ ishod: 'prihvacen' }) as RezultatNaredbe);
    const { kontroler, timeri, odgubi } = stvori(izvrsi, () => 1, konfigBezPropusta);
    for (let i = 1; i <= MAKS_POTEZA_BOT_DUELA_BRZA; i += 1) {
      const naPotezuId = i % 2 === 1 ? 'bot' : 'bot2';
      kontroler.naPromjenuPoteza(dogadaj({ turnToken: `t${i}`, naPotezuId, sudionici }));
      const indeks = timeri.findLastIndex((t) => t.ms !== -1);
      expect(indeks).toBeGreaterThanOrEqual(0);
      await odgubi(indeks);
    }
    expect(izvrsi).toHaveBeenCalledTimes(MAKS_POTEZA_BOT_DUELA_BRZA);
    expect(izvrsi.mock.calls.every(([, , n]) => (n as { vrsta: string }).vrsta === 'rijec')).toBe(true);

    kontroler.naPromjenuPoteza(dogadaj({
      turnToken: `t${MAKS_POTEZA_BOT_DUELA_BRZA + 1}`,
      naPotezuId: 'bot',
      sudionici,
    }));
    const indeksForsiranog = timeri.findLastIndex((t) => t.ms !== -1);
    await odgubi(indeksForsiranog);
    expect(izvrsi).toHaveBeenCalledTimes(MAKS_POTEZA_BOT_DUELA_BRZA + 1);
    expect(izvrsi.mock.calls.at(-1)?.[2]).toEqual(expect.objectContaining({
      vrsta: 'odustani',
      turnToken: `t${MAKS_POTEZA_BOT_DUELA_BRZA + 1}`,
    }));
    expect(kontroler.brojaci.namjernihPropusta).toBe(1);
    kontroler.zaustavi();
  });

  it('isti token se ne planira dvaput; novi token dobiva novi plan', () => {
    const izvrsi = vi.fn(() => ({ ishod: 'prihvacen' }) as RezultatNaredbe);
    const { kontroler, timeri } = stvori(izvrsi);
    kontroler.naPromjenuPoteza(dogadaj());
    kontroler.naPromjenuPoteza(dogadaj());
    expect(timeri).toHaveLength(1);
    kontroler.naPromjenuPoteza(dogadaj({ turnToken: 't2' }));
    expect(timeri).toHaveLength(2);
    expect(timeri[1]!.ms).toBe(4_000);
  });

  it('već propušten rok ne planira akciju', () => {
    const { kontroler, timeri } = stvori(() => ({ ishod: 'prihvacen' }));
    kontroler.naPromjenuPoteza(dogadaj({ istekPotezaMs: -1 }));
    expect(timeri).toHaveLength(0);
  });

  it('zakašnjeli callback nakon isteka roka ne šalje naredbu', () => {
    let sada = 0;
    const izvrsi = vi.fn(() => ({ ishod: 'prihvacen' }) as RezultatNaredbe);
    const { kontroler, timeri } = stvori(izvrsi, () => 1, konfigBezPropusta, { sada: () => sada });
    kontroler.naPromjenuPoteza(dogadaj());
    const plan = kontroler.pregledPlanova()[0];
    // Odluka se računa tek u callbacku — do tada vrsta plana je null.
    expect(plan?.vrsta).toBeNull();
    expect(plan?.izvrsitiUMs).toBe(timeri[0]!.ms);
    sada = 30_001;
    timeri[0]!.posao();
    expect(izvrsi).not.toHaveBeenCalled();
    expect(kontroler.brojaci.zastarjelo).toBe(1);
    kontroler.zaustavi();
  });

  it('planiraj ne izvršava naredbu sinkrono (odgoda prije izvrsi)', async () => {
    const izvrsi = vi.fn(() => ({ ishod: 'prihvacen' }) as RezultatNaredbe);
    const { kontroler, odgubi } = stvori(izvrsi);
    kontroler.naPromjenuPoteza(dogadaj());
    expect(izvrsi).not.toHaveBeenCalled();
    expect(kontroler.pregledPlanova()[0]?.vrsta).toBeNull();
    await odgubi(0);
    expect(izvrsi).toHaveBeenCalled();
    kontroler.zaustavi();
  });

  it('naPromjenuPoteza ne pokreće odabir sinkrono; posao čeka setImmediate', async () => {
    const izvrsi = vi.fn(() => ({ ishod: 'prihvacen' }) as RezultatNaredbe);
    const { kontroler, raspored } = stvori(izvrsi);
    kontroler.naPromjenuPoteza(dogadaj());
    expect(raspored.brojAktivnih()).toBe(1);
    expect(kontroler.pregledPlanova()[0]?.vrsta).toBeNull();
    expect(izvrsi).not.toHaveBeenCalled();
    // Bez setImmediate odluka još nije spremna.
    expect(kontroler.pregledPlanova()[0]?.vrsta).toBeNull();
    await dovršiAsyncOdluku();
    expect(kontroler.pregledPlanova()[0]?.vrsta).toBe('rijec');
    expect(izvrsi).not.toHaveBeenCalled();
    kontroler.zaustavi();
  });

  it('odluka spremna prije odgode ne zove izvrsi dok timer ne istekne', async () => {
    const izvrsi = vi.fn(() => ({ ishod: 'prihvacen' }) as RezultatNaredbe);
    const { kontroler, timeri } = stvori(izvrsi);
    kontroler.naPromjenuPoteza(dogadaj());
    await dovršiAsyncOdluku();
    expect(kontroler.pregledPlanova()[0]?.vrsta).toBe('rijec');
    expect(izvrsi).not.toHaveBeenCalled();
    expect(timeri[0]!.ms).toBe(4_000);
    timeri[0]!.posao();
    expect(izvrsi).toHaveBeenCalledTimes(1);
    kontroler.zaustavi();
  });

  it('zaustavi tijekom računanja ne proizvodi potez', async () => {
    const izvrsi = vi.fn(() => ({ ishod: 'prihvacen' }) as RezultatNaredbe);
    const { kontroler, timeri } = stvori(izvrsi);
    kontroler.naPromjenuPoteza(dogadaj());
    kontroler.zaustavi();
    await dovršiAsyncOdluku();
    for (const t of timeri) t.posao();
    await dovršiAsyncOdluku();
    expect(izvrsi).not.toHaveBeenCalled();
  });

  it('novi token otkazuje zastarjeli nastavivi posao (generacija)', async () => {
    let predaja = 0;
    const izvrsi = vi.fn(() => ({ ishod: 'prihvacen' }) as RezultatNaredbe);
    const { kontroler, timeri, raspored } = stvori(izvrsi, () => 1, konfigBezPropusta, {
      predajKontrolu: async () => { predaja += 1; },
    });
    kontroler.naPromjenuPoteza(dogadaj({ turnToken: 't1' }));
    const stariPosao = timeri[0]!.posao;
    kontroler.naPromjenuPoteza(dogadaj({ turnToken: 't2' }));
    expect(timeri.length).toBeGreaterThanOrEqual(2);
    // Stari callback ne smije igrati.
    stariPosao();
    await dovršiAsyncOdluku();
    expect(izvrsi).not.toHaveBeenCalled();
    expect(kontroler.brojaci.zastarjelo).toBeGreaterThanOrEqual(1);
    kontroler.naPromjenuPoteza(dogadaj({ turnToken: 't3' }));
    const indeksNovog = timeri.findLastIndex((t) => t.ms === 4_000);
    expect(indeksNovog).toBeGreaterThanOrEqual(0);
    timeri[indeksNovog]!.posao();
    for (let k = 0; k < 80 && raspored.brojAktivnih() > 0; k += 1) await dovršiAsyncOdluku();
    expect(izvrsi).toHaveBeenCalledWith('p1', 'bot', expect.objectContaining({ turnToken: 't3' }));
    expect(predaja).toBeGreaterThanOrEqual(0);
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

  it('promjena poteza otkazuje stari plan; zakašnjeli callback ne igra sa starim tokenom', async () => {
    const izvrsi = vi.fn(() => ({ ishod: 'prihvacen' }) as RezultatNaredbe);
    const { kontroler, timeri, odgubi } = stvori(izvrsi);
    kontroler.naPromjenuPoteza(dogadaj({ turnToken: 't1' }));
    const stariPosao = timeri[0]!.posao;
    kontroler.naPromjenuPoteza(dogadaj({ turnToken: 't2' }));
    stariPosao();
    await dovršiAsyncOdluku();
    expect(izvrsi).not.toHaveBeenCalled();
    expect(kontroler.brojaci.zastarjelo).toBeGreaterThanOrEqual(1);
    kontroler.naPromjenuPoteza(dogadaj({ turnToken: 't3' }));
    const indeksNovog = timeri.findLastIndex((t) => t.ms === 4_000);
    expect(indeksNovog).toBeGreaterThanOrEqual(0);
    await odgubi(indeksNovog);
    expect(izvrsi).toHaveBeenCalledTimes(1);
    expect(izvrsi).toHaveBeenCalledWith('p1', 'bot', expect.objectContaining({ turnToken: 't3' }));
  });

  it('promjena rječnika tijekom čekanja ponovno bira riječ, a odbijena riječ se broji kao tehnička greška', async () => {
    let verzija = 1;
    const izvrsi = vi.fn((...args: [string, string, { vrsta: string }]) => {
      const n = args[2];
      return (n.vrsta === 'rijec' ? { ishod: 'odbijen', kod: 'RIJEC_NE_POSTOJI', poruka: '' } : { ishod: 'prihvacen' }) as RezultatNaredbe;
    });
    const { kontroler, timeri, prekini, odgubi } = stvori(izvrsi, () => verzija);
    kontroler.naPromjenuPoteza(dogadaj());
    verzija = 2;
    await odgubi(0);
    await odgubi(1);
    await odgubi(2);
    // Dvije odbijene riječi iz repertoara, zatim prazan skup → normalan odustanak (ne prekini).
    expect(izvrsi.mock.calls.map(([, , n]) => n.vrsta)).toEqual(['rijec', 'rijec', 'odustani']);
    expect(kontroler.brojaci.tehnickeGreske).toBe(2);
    expect(prekini).not.toHaveBeenCalled();
    expect(kontroler.brojaci.bezRijeci).toBe(1);
    expect(kontroler.brojaci.namjernihPropusta).toBe(0);
    void timeri;
  });

  it('jednokratna iznimka naredbe se oporavi i isti token ne izvršava ponovno', async () => {
    const izvrsi = vi.fn().mockImplementationOnce(() => { throw new Error('Privremeni kvar'); }).mockReturnValue({ ishod: 'prihvacen' });
    const { kontroler, timeri, prekini, odgubi } = stvori(izvrsi);
    kontroler.naPromjenuPoteza(dogadaj());
    await odgubi(0);
    await dovršiAsyncOdluku();
    kontroler.naPromjenuPoteza(dogadaj());
    expect(timeri.length).toBeGreaterThanOrEqual(2);
    await odgubi(1);
    await dovršiAsyncOdluku();
    kontroler.naPromjenuPoteza(dogadaj());
    expect(izvrsi).toHaveBeenCalledTimes(2);
    expect(izvrsi.mock.calls[1]).toEqual(izvrsi.mock.calls[0]);
    expect(prekini).not.toHaveBeenCalled();
    expect(kontroler.brojaci.odigranihRijeci).toBe(1);
  });

  it('oporavak finally ne briše noviji posao iste partije', async () => {
    let aktualni = dogadaj({ turnToken: 't1' });
    let prviPokusaj = true;
    let kontrolerRef: BotKontroler | null = null;
    let zadrziNoviPosao = false;
    let pustiNoviPosao: (() => void) | null = null;
    const izvrsi = vi.fn(() => {
      if (prviPokusaj) {
        prviPokusaj = false;
        throw new Error('Privremeni kvar za oporavak');
      }
      // Uspješan oporavak: motor sinkrono javlja novi potez (novi bot-posao) prije finally starog.
      zadrziNoviPosao = true;
      aktualni = dogadaj({ turnToken: 't2' });
      kontrolerRef!.naPromjenuPoteza(aktualni);
      return { ishod: 'prihvacen' } as RezultatNaredbe;
    });
    const timeri: { posao: () => void; ms: number }[] = [];
    let satRasporeda = 0;
    const raspored = new RasporedjivacOdziva({
      predaj: async () => undefined,
      sada: () => { satRasporeda += 1; return satRasporeda; },
    });
    // Drži t2 u redu dok ne provjerimo otkazivost nakon finally starog posla.
    const izvorniPrijavi = raspored.prijavi.bind(raspored);
    raspored.prijavi = (run) => izvorniPrijavi(async (ctx) => {
      if (zadrziNoviPosao) {
        await new Promise<void>((resolve) => { pustiNoviPosao = resolve; });
        return 'odustani';
      }
      return run(ctx);
    });
    const kontroler = new BotKontroler({
      rjecnik: mockRjecnikZaKontroler(() => 1),
      predajKontrolu: async () => undefined,
      rasporedOdziva: raspored,
      izvrsiNaredbu: izvrsi as never,
      konfiguracija: konfigBezPropusta,
      rng: rng(4),
      rngPrezentacije: () => 0.5,
      sada: () => 0,
      zakazi: (posao, ms) => {
        timeri.push({ posao, ms });
        return timeri.length as unknown as NodeJS.Timeout;
      },
      otkazi: (handle) => { timeri.splice((handle as unknown as number) - 1, 1, { posao: () => undefined, ms: -1 }); },
      dohvatiPotez: () => aktualni,
    });
    kontrolerRef = kontroler;
    kontroler.naPromjenuPoteza(aktualni);
    timeri[0]!.posao(); // thinking → kvar → zakazan oporavak
    for (let i = 0; i < 40 && raspored.brojAktivnih() > 0; i += 1) await dovršiAsyncOdluku();
    await dovršiAsyncOdluku();
    const idxOporavak = timeri.findIndex((t, i) => i > 0 && t.ms >= 0);
    expect(idxOporavak).toBeGreaterThanOrEqual(0);
    timeri[idxOporavak]!.posao(); // oporavak uspije + sinkroni t2
    for (let i = 0; i < 40; i += 1) {
      await dovršiAsyncOdluku();
      if (zadrziNoviPosao && raspored.brojAktivnih() >= 1) break;
    }
    expect(izvrsi).toHaveBeenCalledWith('p1', 'bot', expect.objectContaining({ turnToken: 't1' }));
    expect(raspored.brojAktivnih()).toBeGreaterThanOrEqual(1);
    // Unconditional finally bi obrisao handle → zaustavi ne bi mogao otkazati orphan.
    kontroler.zaustavi();
    expect(raspored.brojAktivnih()).toBe(0);
    pustiNoviPosao?.();
  });

  it('promjena rječnika čuva već odabrano neznanje za isti token', async () => {
    let verzija = 1;
    let kandidati = ['masa'];
    let frekvencija = 1;
    const izvrsi = vi.fn(() => ({ ishod: 'prihvacen' }) as RezultatNaredbe);
    const bazni = mockRjecnikZaKontroler(() => verzija);
    const { kontroler, odgubi } = stvori(izvrsi, () => verzija, {
      ...konfigBezPropusta, vjerojatnostNeznanjaUMalomSkupu: 1,
    }, {
      rjecnik: {
        ...bazni,
        frekvencijaZa: () => frekvencija,
        jeIgrivaRijec: (r: string) => kandidati.includes(r),
        repertoarBotova: () => izgradiRepertoarBotova({
          prefiksi: () => ['ma'].values(),
          rijeciNaPrefiksu: () => kandidati,
          frekvencijaZa: () => frekvencija,
          grupeZa: (r) => [`imenica:${r}`],
          jeOsnovniOblik: () => true,
          jePostojecaRijec: (r) => kandidati.includes(r),
        }, verzija),
      },
    });
    kontroler.naPromjenuPoteza(dogadaj());
    verzija = 2;
    await odgubi(0);
    expect(izvrsi).toHaveBeenCalledWith('p1', 'bot', { vrsta: 'odustani', turnToken: 't1' });
    expect(kontroler.brojaci.namjernihPropusta).toBe(1);
    kandidati = ['masa', 'mast', 'maslac', 'maska'];
    frekvencija = 500;
    kontroler.naPromjenuPoteza(dogadaj({ turnToken: 't2' }));
    await odgubi(1);
    expect(izvrsi).toHaveBeenLastCalledWith('p1', 'bot', expect.objectContaining({ vrsta: 'rijec', turnToken: 't2' }));
    kontroler.zaustavi();
  });

  it('nema_rijeci + nova verzija rječnika s legalnom riječi → ponovni izračun, ne stale odustani', async () => {
    let verzija = 1;
    let kandidati: string[] = [];
    const izvrsi = vi.fn(() => ({ ishod: 'prihvacen' }) as RezultatNaredbe);
    const { kontroler, odgubi } = stvori(izvrsi, () => verzija, konfigBezPropusta, {
      rjecnik: {
        igriviKandidati: function* () {
          yield* kandidati;
        },
        frekvencijaZa: () => 500,
        grupeZa: (r: string) => [`imenica:${r}`],
        verzijaRjecnika: () => verzija,
        imaSlobodnuRijecNa: () => kandidati.length > 0,
        jeIgrivaRijec: (r: string) => kandidati.includes(r),
        repertoarBotova: () => izgradiRepertoarBotova({
          prefiksi: () => ['ma'].values(),
          rijeciNaPrefiksu: () => kandidati,
          frekvencijaZa: () => 500,
          grupeZa: (r) => [`imenica:${r}`],
          jeOsnovniOblik: () => true,
          jePostojecaRijec: (r) => kandidati.includes(r),
        }, verzija),
        pooloviBotova: () => PRAZNI_POOLOVI,
      },
    });
    kontroler.naPromjenuPoteza(dogadaj());
    // Odluka nema_rijeci spremna; prije izvršenja refresh + nova riječ.
    await dovršiAsyncOdluku();
    for (let i = 0; i < 40; i += 1) await dovršiAsyncOdluku();
    verzija = 2;
    kandidati = ['mama'];
    await odgubi(0);
    expect(izvrsi).toHaveBeenCalledTimes(1);
    expect(izvrsi).toHaveBeenCalledWith('p1', 'bot', expect.objectContaining({
      vrsta: 'rijec',
      rijec: 'mama',
      turnToken: 't1',
    }));
    expect(kontroler.brojaci.bezRijeci).toBe(0);
    kontroler.zaustavi();
  });

  it('nema_rijeci bez nove riječi nakon verzije i dalje odustaje', async () => {
    let verzija = 1;
    const kandidati: string[] = [];
    const izvrsi = vi.fn(() => ({ ishod: 'prihvacen' }) as RezultatNaredbe);
    const { kontroler, odgubi } = stvori(izvrsi, () => verzija, konfigBezPropusta, {
      rjecnik: {
        igriviKandidati: function* () {
          yield* kandidati;
        },
        frekvencijaZa: () => 500,
        grupeZa: (r: string) => [`imenica:${r}`],
        verzijaRjecnika: () => verzija,
        imaSlobodnuRijecNa: () => false,
        jeIgrivaRijec: () => false,
        repertoarBotova: () => izgradiRepertoarBotova({
          prefiksi: () => ['ma'].values(),
          rijeciNaPrefiksu: () => kandidati,
          frekvencijaZa: () => 500,
          grupeZa: (r) => [`imenica:${r}`],
          jeOsnovniOblik: () => true,
          jePostojecaRijec: () => false,
        }, verzija),
        pooloviBotova: () => PRAZNI_POOLOVI,
      },
    });
    kontroler.naPromjenuPoteza(dogadaj());
    await dovršiAsyncOdluku();
    for (let i = 0; i < 40; i += 1) await dovršiAsyncOdluku();
    verzija = 2;
    await odgubi(0);
    expect(izvrsi).toHaveBeenCalledWith('p1', 'bot', { vrsta: 'odustani', turnToken: 't1' });
    expect(kontroler.brojaci.bezRijeci).toBe(1);
    kontroler.zaustavi();
  });

  it('novi bot na potezu koristi snapshot cijele partije, a nova partija nove postavke', () => {
    const konfiguracija = structuredClone(konfigBezPropusta);
    const { kontroler, timeri } = stvori(() => ({ ishod: 'prihvacen' }), () => 1, konfiguracija);
    kontroler.naPromjenuPoteza(dogadaj({ naPotezuId: 'covjek' }));
    konfiguracija.trajanjePotezaBotaMs = 2_000;
    konfiguracija.jitterPotezaBotaMs = 0;
    kontroler.naPromjenuPoteza(dogadaj());
    expect(timeri[0]!.ms).toBe(4_000); // snapshot još drži stare postavke
    kontroler.naPromjenuPoteza(dogadaj({ partijaId: 'p2' }));
    expect(timeri[1]!.ms).toBe(2_000); // nova partija uzima nove postavke
    kontroler.zaustavi();
  });

  it('iznimka odabira ima dva oporavka i prekida trening bez lažne predaje', async () => {
    const izvrsi = vi.fn(() => ({ ishod: 'prihvacen' }) as RezultatNaredbe);
    const bazni = mockRjecnikZaKontroler();
    const { kontroler, odgubi, prekini } = stvori(izvrsi, () => 1, konfigBezPropusta, {
      rjecnik: {
        ...bazni,
        repertoarBotova: () => { throw new Error('Kvar odabira'); },
      },
    });
    kontroler.naPromjenuPoteza(dogadaj({ kontekst: 'trening', istekPotezaMs: null }));
    // 0: odgođeni odluci, 1–2: oporavci (maks. 2) → prekid
    await odgubi(0);
    await odgubi(1);
    await odgubi(2);
    expect(prekini).toHaveBeenCalledExactlyOnceWith('p1', 'bot', 't1');
    expect(kontroler.brojaci.tehnickeGreske).toBe(3);
    expect(izvrsi).not.toHaveBeenCalled();
  });

  it('iznimka nakon promjene tokena ne ponavlja mogući već izvršeni potez', async () => {
    let aktualni = dogadaj();
    const izvrsi = vi.fn(() => {
      aktualni = dogadaj({ turnToken: 't2', naPotezuId: 'covjek' });
      throw new Error('Greška nakon promjene poteza');
    });
    const { kontroler, timeri, prekini, odgubi } = stvori(izvrsi, () => 1, konfigBezPropusta, { dohvatiPotez: () => aktualni });
    kontroler.naPromjenuPoteza(aktualni);
    await odgubi(0);
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

  // --- PR07: čekač dokaza, dvostruki broadcast ---

  it('PR07 dvostruki naPromjenuPoteza istog tokena planira jednom', () => {
    const izvrsi = vi.fn(() => ({ ishod: 'prihvacen' }) as RezultatNaredbe);
    const { kontroler, timeri } = stvori(izvrsi);
    kontroler.naPromjenuPoteza(dogadaj({ turnToken: 't-dupli' }));
    kontroler.naPromjenuPoteza(dogadaj({ turnToken: 't-dupli' }));
    expect(timeri).toHaveLength(1);
    expect(kontroler.brojaci.planirano).toBe(1);
  });

  it('PR07 bot-čekač nije na potezu — ne planira dok dokaz traje', () => {
    const izvrsi = vi.fn(() => ({ ishod: 'prihvacen' }) as RezultatNaredbe);
    const { kontroler, timeri } = stvori(izvrsi);
    kontroler.naPromjenuPoteza(dogadaj({
      naPotezuId: 'covjek',
      faza: 'dokaz_nastavka',
      pravila: 'klasicni',
      dokaz: { autorId: 'covjek', cekateljId: 'bot', cekateljVecIspao: false },
      sudionici: [
        { igracId: 'covjek', upravljac: 'covjek', aktivan: true },
        { igracId: 'bot', upravljac: 'bot', aktivan: true },
      ],
    }));
    expect(timeri).toHaveLength(0);
    expect(izvrsi).not.toHaveBeenCalled();
  });

  it('PR07 naEliminaciju šalje reakciju žrtve i kad snimka još drži zastarjeli dokaz (Bugbot)', () => {
    // Motor nullira stanje.dokaz pa zove eliminirajIgraca bez objave — lokalna snimka zastarjela.
    const posaljiReakciju = vi.fn(() => true);
    const { kontroler, timeri } = stvori(() => ({ ishod: 'prihvacen' }), () => 1, konfigBezPropusta, {
      posaljiReakciju,
      rng: () => 0,
      rngPrezentacije: () => 0,
    });
    kontroler.naPromjenuPoteza(dogadaj({
      naPotezuId: 'covjek',
      faza: 'dokaz_nastavka',
      pravila: 'klasicni',
      dokaz: { autorId: 'covjek', cekateljId: 'bot', cekateljVecIspao: false },
    }));
    // Potvrđena eliminacija čekača (uspješan dokaz) — mora proći reakcija unatoč zastarjeloj snimci.
    kontroler.naEliminaciju(
      'p1',
      'javna',
      'bot',
      'covjek',
      [
        { igracId: 'covjek', upravljac: 'covjek' },
        { igracId: 'bot', upravljac: 'bot' },
      ],
      'p1:1',
    );
    const reakcije = timeri.filter((t) => t.ms >= 2_000);
    expect(reakcije.length).toBeGreaterThanOrEqual(1);
    for (const t of reakcije) t.posao();
    expect(posaljiReakciju).toHaveBeenCalledWith('p1', 'bot', expect.any(String));
  });

  it('PR07 naEliminaciju šalje reakciju žrtve kad dokaz nije u snimci', () => {
    const posaljiReakciju = vi.fn(() => true);
    const { kontroler, timeri } = stvori(() => ({ ishod: 'prihvacen' }), () => 1, konfigBezPropusta, {
      posaljiReakciju,
      rng: () => 0,
      rngPrezentacije: () => 0,
    });
    kontroler.naPromjenuPoteza(dogadaj({ naPotezuId: 'covjek', dokaz: null }));
    kontroler.naEliminaciju(
      'p1',
      'javna',
      'bot',
      'covjek',
      [
        { igracId: 'covjek', upravljac: 'covjek' },
        { igracId: 'bot', upravljac: 'bot' },
      ],
      'p1:1',
    );
    const reakcije = timeri.filter((t) => t.ms >= 2_000);
    expect(reakcije.length).toBeGreaterThanOrEqual(1);
    for (const t of reakcije) t.posao();
    expect(posaljiReakciju).toHaveBeenCalledWith('p1', 'bot', expect.any(String));
  });

  it('PR07 Klasični Troboj: kontroler prosljeđuje broj aktivnih — na primljeni ka uvijek kaladont', async () => {
    const izvrsi = vi.fn(() => ({ ishod: 'prihvacen' }) as RezultatNaredbe);
    const kandidati = ['kava'];
    const snimka = izgradiRepertoarBotova({
      prefiksi: () => ['ka'].values(),
      rijeciNaPrefiksu: () => kandidati,
      frekvencijaZa: () => 500,
      grupeZa: (r) => [`imenica:${r}`],
      jeOsnovniOblik: () => true,
      jePostojecaRijec: (r) => kandidati.includes(r),
    }, 1);
    const { kontroler, odgubi } = stvori(izvrsi, () => 1, konfigBezPropusta, {
      rjecnik: {
        igriviKandidati: function* () { yield* kandidati; },
        frekvencijaZa: () => 500,
        grupeZa: (r) => [`imenica:${r}`],
        verzijaRjecnika: () => 1,
        imaSlobodnuRijecNa: () => true,
        jeIgrivaRijec: (r: string) => kandidati.includes(r),
        repertoarBotova: () => snimka,
      },
    });
    kontroler.naPromjenuPoteza(dogadaj({
      trazenaSlova: 'ka',
      pravila: 'klasicni',
      faza: 'obican_potez',
      sudionici: [
        { igracId: 'covjek', upravljac: 'covjek', aktivan: true },
        { igracId: 'bot', upravljac: 'bot', aktivan: true },
        { igracId: 'bot2', upravljac: 'bot', aktivan: true },
      ],
    }));
    await odgubi(0);
    expect(izvrsi).toHaveBeenCalledWith('p1', 'bot', { vrsta: 'rijec', rijec: 'kaladont', turnToken: 't1' });
  });

  it('Commit 07: bot-duel nakon 10 poteza na „ka” igra kaladont, ne bot_duel_limit', async () => {
    const sudionici = [
      { igracId: 'covjek', upravljac: 'covjek' as const, aktivan: false },
      { igracId: 'bot', upravljac: 'bot' as const, aktivan: true },
      { igracId: 'bot2', upravljac: 'bot' as const, aktivan: true },
    ];
    const izvrsi = vi.fn(() => ({ ishod: 'prihvacen' }) as RezultatNaredbe);
    const { kontroler, timeri, odgubi } = stvori(izvrsi, () => 1, konfigBezPropusta);
    for (let i = 1; i <= MAKS_POTEZA_BOT_DUELA_BRZA; i += 1) {
      const naPotezuId = i % 2 === 1 ? 'bot' : 'bot2';
      kontroler.naPromjenuPoteza(dogadaj({ turnToken: `t${i}`, naPotezuId, sudionici }));
      const indeks = timeri.findLastIndex((t) => t.ms !== -1);
      await odgubi(indeks);
    }
    kontroler.naPromjenuPoteza(dogadaj({
      turnToken: `t${MAKS_POTEZA_BOT_DUELA_BRZA + 1}`,
      naPotezuId: 'bot',
      trazenaSlova: 'ka',
      sudionici,
    }));
    const indeksKa = timeri.findLastIndex((t) => t.ms !== -1);
    await odgubi(indeksKa);
    expect(izvrsi.mock.calls.at(-1)?.[2]).toEqual(expect.objectContaining({
      vrsta: 'rijec',
      rijec: 'kaladont',
      turnToken: `t${MAKS_POTEZA_BOT_DUELA_BRZA + 1}`,
    }));
    kontroler.zaustavi();
  });

  it('Commit 07: brzi put na „ka” ne skuplja kandidate iz rječnika', async () => {
    const izvrsi = vi.fn(() => ({ ishod: 'prihvacen' }) as RezultatNaredbe);
    const { kontroler, odgubi } = stvori(izvrsi, () => 1, konfigBezPropusta);
    const kontrolerInterni = kontroler as unknown as { kandidatiZaPotez: (...args: unknown[]) => string[] };
    const spyKandidati = vi.spyOn(kontrolerInterni, 'kandidatiZaPotez');
    kontroler.naPromjenuPoteza(dogadaj({ trazenaSlova: 'ka' }));
    await odgubi(0);
    expect(spyKandidati).not.toHaveBeenCalled();
    expect(izvrsi).toHaveBeenCalledWith('p1', 'bot', expect.objectContaining({ vrsta: 'rijec', rijec: 'kaladont' }));
    spyKandidati.mockRestore();
  });

  it('Commit 08: odbijeni kaladont na „ka” → oporavak šalje odustani, ne ponavlja kaladont', async () => {
    const izvrsi = vi.fn((...args: [string, string, { vrsta: string; rijec?: string }]) => {
      const n = args[2];
      if (n.vrsta === 'rijec' && n.rijec === 'kaladont') {
        return { ishod: 'odbijen', kod: 'RIJEC_NE_POSTOJI', poruka: '' } as RezultatNaredbe;
      }
      return { ishod: 'prihvacen' } as RezultatNaredbe;
    });
    const { kontroler, odgubi } = stvori(izvrsi, () => 1, konfigBezPropusta);
    kontroler.naPromjenuPoteza(dogadaj({ trazenaSlova: 'ka', turnToken: 't-ka-odbij' }));
    await odgubi(0);
    await odgubi(1);
    const pozivi = izvrsi.mock.calls.map(([, , n]) => n);
    expect(pozivi).toHaveLength(2);
    expect(pozivi[0]).toEqual(expect.objectContaining({ vrsta: 'rijec', rijec: 'kaladont', turnToken: 't-ka-odbij' }));
    expect(pozivi[1]).toEqual(expect.objectContaining({ vrsta: 'odustani', turnToken: 't-ka-odbij' }));
    expect(pozivi.filter((n) => n.vrsta === 'rijec' && n.rijec === 'kaladont')).toHaveLength(1);
    kontroler.zaustavi();
  });
});
