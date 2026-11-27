import { describe, expect, it } from 'vitest';
import { izgradiSnimkuPoolova } from '../src/bot/poolovi-indeks.js';
import { BotDebugPretplate, botDebugKontekstDopusten } from '../src/bot/bot-debug-pretplata.js';
import { stvoriBotDebugTrag } from '../src/bot/bot-debug-trag.js';
import {
  odaberiPotez,
  odlukaAgresivnostiZaToken,
  odlukaShieldaZaToken,
  stvoriStanjeBota,
} from '../src/bot/odabir-rijeci.js';
import { ZADANA_KONFIGURACIJA_BOTA, type KonfiguracijaBota } from '../src/bot/konfiguracija-bota.js';
import { konfiguracijaZaJavnuBrzu, POLUGE_PROFILA_BOTA } from '../src/bot/profili-bota.js';
import type { BotDebugZapis } from 'zajednicko';

const konfigBazni: KonfiguracijaBota = {
  ...ZADANA_KONFIGURACIJA_BOTA,
  vjerojatnostNeznanjaUMalomSkupu: 0,
};

describe('Bot debug — profil Iskusni', () => {
  it('Iskusni ima Shield 60 %', () => {
    expect(POLUGE_PROFILA_BOTA.iskusni.vjerojatnostShielda).toBe(0.6);
  });

  it('Brza igra koristi ažurirani Iskusni profil', () => {
    const brza = konfiguracijaZaJavnuBrzu();
    expect(brza.vjerojatnostAgresivnosti).toBe(0.3);
    expect(brza.vjerojatnostShielda).toBe(0.6);
    expect(brza.prioritetPoolova).toBe('p2_p1');
  });
});

describe('Bot debug — pretplata i gate', () => {
  it('kontekst privatna nije dopušten; javna/trening/izazov jesu', () => {
    expect(botDebugKontekstDopusten('privatna')).toBe(false);
    expect(botDebugKontekstDopusten('javna')).toBe(true);
    expect(botDebugKontekstDopusten('trening')).toBe(true);
    expect(botDebugKontekstDopusten('izazov')).toBe(true);
  });

  it('produkcija ne prima pretplate niti šalje zapise', () => {
    const emitani: Array<{ igracId: string; zapis: BotDebugZapis }> = [];
    const pretplate = new BotDebugPretplate(
      'production',
      (igracId, zapis) => emitani.push({ igracId, zapis }),
      () => true,
    );
    expect(pretplate.stagingAktivan).toBe(false);
    expect(pretplate.pretplati('p1', 'u1', 'javna')).toBe(false);
    expect(pretplate.imaPretplatnika('p1')).toBe(false);
    pretplate.objavi('p1', {
      verzija: 1,
      partijaId: 'p1',
      igracId: 'bot1',
      nadimak: 'Bot',
      profil: 'iskusni',
      redniBrojPoteza: 1,
      turnToken: 't1',
      brojAktivnih: 2,
      trazenaSlova: 'ma',
      agresivnost: { vjerojatnost: 0.3, aktivirana: false, prioritet: 'p2_p1', poolovi: [] },
      shield: {
        vjerojatnost: 0.6,
        primjenjiv: true,
        aktiviran: false,
        utjecao: false,
        sigurnih: 0,
        rizicnih: 0,
        rizicniDetalji: [],
        rizicniFallback: false,
        poruke: [],
      },
      rezultat: {},
      pokusaj: 0,
      linije: [],
    });
    expect(emitani).toHaveLength(0);
  });

  it('staging pretplata samo za sudionika; tuđa partija ne prima emit', () => {
    const emitani: string[] = [];
    const pretplate = new BotDebugPretplate(
      'staging',
      (igracId) => emitani.push(igracId),
      (partijaId, igracId) => partijaId === 'p-ok' && igracId === 'covjek-1',
    );
    expect(pretplate.pretplati('p-tudja', 'covjek-1', 'javna')).toBe(false);
    expect(pretplate.pretplati('p-ok', 'covjek-1', 'javna')).toBe(true);
    expect(pretplate.imaPretplatnika('p-ok')).toBe(true);
    pretplate.objavi('p-ok', {
      verzija: 1,
      partijaId: 'p-ok',
      igracId: 'bot1',
      nadimak: 'Bot',
      profil: 'iskusni',
      redniBrojPoteza: 1,
      turnToken: 't1',
      brojAktivnih: 2,
      trazenaSlova: 'ma',
      agresivnost: { vjerojatnost: 0.3, aktivirana: true, prioritet: 'p2_p1', poolovi: [] },
      shield: {
        vjerojatnost: 0.6,
        primjenjiv: true,
        aktiviran: true,
        utjecao: false,
        sigurnih: 0,
        rizicnih: 0,
        rizicniDetalji: [],
        rizicniFallback: false,
        poruke: [],
      },
      rezultat: {},
      pokusaj: 0,
      linije: ['test'],
    });
    expect(emitani).toEqual(['covjek-1']);
    emitani.length = 0;
    pretplate.objavi('p-tudja', {
      verzija: 1,
      partijaId: 'p-tudja',
      igracId: 'bot1',
      nadimak: 'Bot',
      profil: 'iskusni',
      redniBrojPoteza: 1,
      turnToken: 't2',
      brojAktivnih: 2,
      trazenaSlova: 'ma',
      agresivnost: { vjerojatnost: 0.3, aktivirana: false, prioritet: 'p2_p1', poolovi: [] },
      shield: {
        vjerojatnost: 0.6,
        primjenjiv: true,
        aktiviran: false,
        utjecao: false,
        sigurnih: 0,
        rizicnih: 0,
        rizicniDetalji: [],
        rizicniFallback: false,
        poruke: [],
      },
      rezultat: {},
      pokusaj: 0,
      linije: [],
    });
    expect(emitani).toHaveLength(0);
  });
});

describe('Bot debug — odabir instrumentacija', () => {
  const poolovi = izgradiSnimkuPoolova({
    clanovi: [
      { rijec: 'marmor', kategorija: 'pool_1', stanje: 'razrijeseno' },
      { rijec: 'madrac', kategorija: 'pool_2', stanje: 'razrijeseno' },
    ],
    jeAktivnaURjecnika: () => true,
    verzijaRjecnika: 1,
    generacija: 7,
  });
  const igrive = (...rijeci: string[]) => (r: string) => rijeci.includes(r);

  it('izvor razlikuje Pool 2 i Pool 1 po prioritetu', () => {
    const konfig: KonfiguracijaBota = {
      ...konfigBazni,
      vjerojatnostAgresivnosti: 1,
      vjerojatnostShielda: 0,
      prioritetPoolova: 'p2_p1',
    };
    const trag = stvoriBotDebugTrag(true);
    const odluka = odaberiPotez({
      trazenaSlova: 'ma',
      kandidati: ['masa'],
      frekvencijaZa: () => 500,
      grupeZa: (r) => [`imenica:${r}`],
      brojAktivnih: 3,
      turnToken: 't-izvor',
      poolovi,
      jeIgrivaRijec: igrive('masa', 'marmor', 'madrac'),
      debugTrag: trag,
    }, stvoriStanjeBota(konfig, () => 0), konfig, () => 0);
    expect(odluka).toMatchObject({ vrsta: 'rijec', rijec: 'madrac', izPoola: true });
    const zapis = trag.izgradiZapis({
      partijaId: 'p',
      igracId: 'b',
      nadimak: 'Bot',
      profil: 'iskusni',
      redniBrojPoteza: 1,
      turnToken: 't-izvor',
      brojAktivnih: 3,
      trazenaSlova: 'ma',
      pokusaj: 0,
    });
    expect(zapis?.rezultat.izvor).toBe('pool_2');
    expect(zapis?.agresivnost.poolovi.some((p) => p.pool === 'pool_1' && p.status === 'nije_razmatran')).toBe(true);
  });

  it('Shield pri 3 aktivna nije primjenjiv', () => {
    const konfig: KonfiguracijaBota = {
      ...konfigBazni,
      vjerojatnostAgresivnosti: 0,
      vjerojatnostShielda: 1,
    };
    const trag = stvoriBotDebugTrag(true);
    odaberiPotez({
      trazenaSlova: 'ma',
      kandidati: ['masa', 'maska'],
      frekvencijaZa: (r) => (r === 'maska' ? 900 : 100),
      grupeZa: (r) => [`imenica:${r}`],
      brojAktivnih: 3,
      turnToken: 't-sh3',
      pravila: 'klasicni',
      poolovi: izgradiSnimkuPoolova({ clanovi: [], jeAktivnaURjecnika: () => true, verzijaRjecnika: 1, generacija: 1 }),
      jeIgrivaRijec: igrive('masa', 'maska'),
      debugTrag: trag,
    }, stvoriStanjeBota(konfig, () => 0), konfig, () => 0);
    const zapis = trag.izgradiZapis({
      partijaId: 'p',
      igracId: 'b',
      nadimak: 'Bot',
      profil: 'iskusni',
      redniBrojPoteza: 1,
      turnToken: 't-sh3',
      brojAktivnih: 3,
      trazenaSlova: 'ma',
      pokusaj: 0,
    });
    expect(zapis?.shield.primjenjiv).toBe(false);
    expect(zapis?.shield.aktiviran).toBe(false);
    expect(zapis?.linije.some((l) => l.includes('nije primjenjiv'))).toBe(true);
  });

  it('Shield pri 2 aktivna bilježi stvarnu odluku', () => {
    const konfig: KonfiguracijaBota = {
      ...konfigBazni,
      vjerojatnostAgresivnosti: 0,
      vjerojatnostShielda: 1,
    };
    const trag = stvoriBotDebugTrag(true);
    const odluka = odaberiPotez({
      trazenaSlova: 'ma',
      kandidati: ['masa', 'maska'],
      frekvencijaZa: (r) => (r === 'maska' ? 900 : 100),
      grupeZa: (r) => [`imenica:${r}`],
      brojAktivnih: 2,
      turnToken: 't-sh2',
      pravila: 'klasicni',
      poolovi: izgradiSnimkuPoolova({ clanovi: [], jeAktivnaURjecnika: () => true, verzijaRjecnika: 1, generacija: 1 }),
      jeIgrivaRijec: igrive('masa', 'maska'),
      debugTrag: trag,
    }, stvoriStanjeBota(konfig, () => 0), konfig, () => 0);
    expect(odluka).toMatchObject({ vrsta: 'rijec', rijec: 'masa' });
    const zapis = trag.izgradiZapis({
      partijaId: 'p',
      igracId: 'b',
      nadimak: 'Bot',
      profil: 'iskusni',
      redniBrojPoteza: 1,
      turnToken: 't-sh2',
      brojAktivnih: 2,
      trazenaSlova: 'ma',
      pokusaj: 0,
    });
    expect(zapis?.shield.primjenjiv).toBe(true);
    expect(zapis?.shield.aktiviran).toBe(true);
  });

  it('prazni poolovi pri agresivnosti bilježe stvarni fallback', () => {
    const konfig: KonfiguracijaBota = {
      ...konfigBazni,
      vjerojatnostAgresivnosti: 1,
      vjerojatnostShielda: 0,
      prioritetPoolova: 'p1_p2',
    };
    const prazni = izgradiSnimkuPoolova({
      clanovi: [],
      jeAktivnaURjecnika: () => true,
      verzijaRjecnika: 1,
      generacija: 1,
    });
    const trag = stvoriBotDebugTrag(true);
    const odluka = odaberiPotez({
      trazenaSlova: 'ma',
      kandidati: ['masa'],
      frekvencijaZa: () => 500,
      grupeZa: (r) => [`imenica:${r}`],
      brojAktivnih: 3,
      turnToken: 't-praz',
      poolovi: prazni,
      jeIgrivaRijec: igrive('masa'),
      debugTrag: trag,
    }, stvoriStanjeBota(konfig, () => 0), konfig, () => 0);
    expect(odluka).toMatchObject({ vrsta: 'rijec', rijec: 'masa' });
    const zapis = trag.izgradiZapis({
      partijaId: 'p',
      igracId: 'b',
      nadimak: 'Bot',
      profil: 'iskusni',
      redniBrojPoteza: 1,
      turnToken: 't-praz',
      brojAktivnih: 3,
      trazenaSlova: 'ma',
      pokusaj: 0,
    });
    expect(zapis?.rezultat.izvor).toBe('obicni');
    expect(zapis?.agresivnost.razlogPrelaska ?? zapis?.linije.join(' ')).toMatch(/obični|prazn/i);
  });

  it('oporavak ne generira novi agresivnost/shield roll', () => {
    const konfig: KonfiguracijaBota = {
      ...konfigBazni,
      vjerojatnostAgresivnosti: 0.5,
      vjerojatnostShielda: 0.5,
    };
    const stanje = stvoriStanjeBota(konfig, () => 0.2);
    odaberiPotez({
      trazenaSlova: 'ma',
      kandidati: ['masa'],
      frekvencijaZa: () => 500,
      grupeZa: (r) => [`imenica:${r}`],
      brojAktivnih: 2,
      turnToken: 't-op-roll',
      poolovi: izgradiSnimkuPoolova({ clanovi: [], jeAktivnaURjecnika: () => true, verzijaRjecnika: 1, generacija: 1 }),
    }, stanje, konfig, () => 0.2);
    const agg = odlukaAgresivnostiZaToken(stanje, 't-op-roll', 0.5, () => 0.99);
    const sh = odlukaShieldaZaToken(stanje, 't-op-roll', 0.5, () => 0.99);
    const rollAgg = stanje.agresivnostRollPoTokenu.get('t-op-roll');
    const rollSh = stanje.shieldRollPoTokenu.get('t-op-roll');
    odaberiPotez({
      trazenaSlova: 'ma',
      kandidati: ['masa'],
      frekvencijaZa: () => 500,
      grupeZa: (r) => [`imenica:${r}`],
      brojAktivnih: 2,
      turnToken: 't-op-roll',
      oporavak: true,
      poolovi: izgradiSnimkuPoolova({ clanovi: [], jeAktivnaURjecnika: () => true, verzijaRjecnika: 1, generacija: 1 }),
    }, stanje, konfig, () => 0.99);
    expect(odlukaAgresivnostiZaToken(stanje, 't-op-roll', 0.5, () => 0.99)).toBe(agg);
    expect(odlukaShieldaZaToken(stanje, 't-op-roll', 0.5, () => 0.99)).toBe(sh);
    expect(stanje.agresivnostRollPoTokenu.get('t-op-roll')).toBe(rollAgg);
    expect(stanje.shieldRollPoTokenu.get('t-op-roll')).toBe(rollSh);
  });

  it('debug uključen i isključen daju istu odluku uz isti RNG', () => {
    const konfig: KonfiguracijaBota = {
      ...konfigBazni,
      vjerojatnostAgresivnosti: 1,
      vjerojatnostShielda: 1,
      prioritetPoolova: 'p2_p1',
    };
    const ulaz = {
      trazenaSlova: 'ma',
      kandidati: ['masa'],
      frekvencijaZa: () => 500 as number | null,
      grupeZa: (r: string) => [`imenica:${r}`],
      brojAktivnih: 2,
      turnToken: 't-eq',
      pravila: 'klasicni' as const,
      poolovi,
      jeIgrivaRijec: igrive('masa', 'marmor', 'madrac'),
    };
    const a = odaberiPotez(ulaz, stvoriStanjeBota(konfig, () => 0), konfig, () => 0);
    const trag = stvoriBotDebugTrag(true);
    const b = odaberiPotez(
      { ...ulaz, turnToken: 't-eq-2', debugTrag: trag },
      stvoriStanjeBota(konfig, () => 0),
      konfig,
      () => 0,
    );
    expect(a).toEqual(b);
  });

  it('noop trag ne alocira zapis', () => {
    const trag = stvoriBotDebugTrag(false);
    expect(trag.aktivan).toBe(false);
    trag.zapisiIzvor('obicni', 'masa');
    expect(trag.izgradiZapis({
      partijaId: 'p',
      igracId: 'b',
      nadimak: 'Bot',
      profil: 'iskusni',
      redniBrojPoteza: 1,
      turnToken: 't',
      brojAktivnih: 2,
      trazenaSlova: 'ma',
      pokusaj: 0,
    })).toBeNull();
  });

  it('preskoci kandidata ulaze u emit zapis', () => {
    const trag = stvoriBotDebugTrag(true);
    trag.zapisiPreskok('madrac', 'odbijena_motorom');
    trag.zapisiPreskok('xyz', 'nelegalan');
    const zapis = trag.izgradiZapis({
      partijaId: 'p',
      igracId: 'b',
      nadimak: 'Bot',
      profil: 'iskusni',
      redniBrojPoteza: 1,
      turnToken: 't-pres',
      brojAktivnih: 2,
      trazenaSlova: 'ma',
      pokusaj: 0,
    });
    expect(zapis?.preskoci).toEqual([
      { rijec: 'madrac', razlog: 'odbijena_motorom' },
      { rijec: 'xyz', razlog: 'nelegalan' },
    ]);
  });
});
