import { describe, expect, it, vi } from 'vitest';
import type { RezultatPokretanja } from '../src/igra/politika-ucinka.js';
import { FondBotova, type IdentitetBota } from '../src/bot/fond.js';
import { RedCekanja, prvaCetvorica, prviPar, type StavkaReda } from '../src/red/red-cekanja.js';
import { PRAGOVI_POPUNE_MS, PopunaReda, dopustenoBotova, sljedeciPragMs } from '../src/red/raspored-popune.js';
import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { io as spojiSocket, type Socket } from 'socket.io-client';
import { registrirajRedCekanja } from '../src/red/servis-reda.js';
import type { KaladontIo } from '../src/server.js';
import type { StanjeReda } from 'zajednicko';

describe('povrat namjere reda nakon neuspjelog početka', () => {
  it.each([false, true])('povrat nakon izlaska iz socket sobe, dobrovoljni izlazak=%s', async (izlazi) => {
    const http = createServer();
    const io = new Server(http);
    const klijenti: Socket[] = [];
    let dovrsiPokusaj: (rezultat: RezultatPokretanja) => void = () => undefined;
    const pocetci: StavkaReda[][] = [];
    let oznaciPocetak: () => void = () => undefined;
    const zapoceo = new Promise<void>((resolve) => { oznaciPocetak = resolve; });
    io.on('connection', (socket) => {
      socket.data = { igracId: socket.id, vrsta: 'gost', nadimak: 'Gost', avatarId: 0, avatarConfig: null, avatarRevision: 0 };
    });
    const servis = registrirajRedCekanja(io as unknown as KaladontIo, (stol) => {
      pocetci.push(stol);
      for (const socket of io.sockets.sockets.values()) socket.leave('red-cekanja-1v1');
      oznaciPocetak();
      return new Promise<RezultatPokretanja>((resolve) => { dovrsiPokusaj = resolve; });
    }, () => false, () => false, () => true, async () => null, () => true, () => undefined);
    try {
      await new Promise<void>((resolve) => http.listen(0, '127.0.0.1', resolve));
      const podaci = http.address();
      const adresa = `http://127.0.0.1:${typeof podaci === 'object' && podaci ? podaci.port : 0}`;
      for (let indeks = 0; indeks < 2; indeks += 1) {
        const socket = spojiSocket(adresa, { forceNew: true });
        await new Promise<void>((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
        klijenti.push(socket);
        await new Promise<StanjeReda>((resolve) => socket.emit('red:udji', { mod: 'dva_igraca' }, resolve));
      }
      await zapoceo;
      const prvi = klijenti[0]!;
      const stanjeNakon = new Promise<StanjeReda>((resolve) => prvi.once('red:stanje', resolve));
      if (izlazi) {
        const potvrdaIzlaska = new Promise<void>((resolve) => io.sockets.sockets.get(prvi.id!)!.once('red:izadji', resolve));
        prvi.emit('red:izadji');
        await potvrdaIzlaska;
      }
      const drugiStanje = new Promise<StanjeReda>((resolve) => {
        const slusaj = (stanje: StanjeReda) => {
          if (stanje.mjesta.filter(Boolean).length !== (izlazi ? 1 : 2)) return;
          klijenti[1]!.off('red:stanje', slusaj);
          resolve(stanje);
        };
        klijenti[1]!.on('red:stanje', slusaj);
      });
      dovrsiPokusaj('greska');
      const stanje = await (izlazi ? drugiStanje : stanjeNakon);
      expect(stanje.mjesta.filter(Boolean)).toHaveLength(izlazi ? 1 : 2);
      expect(io.sockets.sockets.get(prvi.id!)?.rooms.has('red-cekanja-1v1')).toBe(!izlazi);
      if (!izlazi) {
        const ponovniPocetak = new Promise<void>((resolve) => { oznaciPocetak = resolve; });
        await ponovniPocetak;
        expect(pocetci).toHaveLength(2);
        expect(pocetci[1]!.map((stavka) => stavka.usaoU)).toEqual(pocetci[0]!.map((stavka) => stavka.usaoU));
      }
    } finally {
      servis.zaustaviPopunu();
      for (const socket of klijenti) socket.disconnect();
      await new Promise<void>((resolve) => io.close(() => resolve()));
    }
  });
});

function identiteti(broj: number): IdentitetBota[] {
  return Array.from({ length: broj }, (_, i) => ({
    igracId: `bot-${i}`, nadimak: `Bot${i}`, avatarId: 0, avatarConfig: null, avatarRevision: 0,
    odigrane: 0, pobjede: 0, bodoviUkupno: 0, odigrane1v1: 0, pobjede1v1: 0, bodovi1v1: 0, iskustvoUkupno: 0,
  }));
}

function covjek(id: string, usaoU: number): StavkaReda {
  return {
    igracId: id, vrsta: 'gost', nadimak: id, avatarId: 0, avatarConfig: null, avatarRevision: 0,
    odigrane: 0, pobjede: 0, bodoviUkupno: 0, usaoU,
  };
}

interface Okolina {
  sada: number;
  red: RedCekanja;
  fond: FondBotova;
  popuna: PopunaReda;
  pokrenuti: StavkaReda[][];
  zauzeti: Set<string>;
  rezultat: RezultatPokretanja;
  omogucena: boolean;
  timeri: { posao: () => void; u: number }[];
  tik: (ms: number) => Promise<void>;
}

function okolina(mod: 'dva_igraca' | 'cetiri_igraca', brojBotova = 5): Okolina {
  const okolis: Okolina = {
    sada: 100_000,
    red: new RedCekanja(mod === 'dva_igraca' ? prviPar : prvaCetvorica),
    fond: null as unknown as FondBotova,
    popuna: null as unknown as PopunaReda,
    pokrenuti: [],
    zauzeti: new Set(),
    rezultat: 'pokrenuta',
    omogucena: true,
    timeri: [],
    tik: async () => undefined,
  };
  okolis.fond = new FondBotova(identiteti(brojBotova), () => okolis.sada);
  okolis.popuna = new PopunaReda({
    red: okolis.red,
    fond: okolis.fond,
    velicinaStola: mod === 'dva_igraca' ? 2 : 4,
    pragoviMs: PRAGOVI_POPUNE_MS[mod],
    omogucena: () => okolis.omogucena,
    pokreniStol: async (stol) => {
      okolis.pokrenuti.push(stol);
      for (const s of stol) if (s.upravljac === 'bot') okolis.zauzeti.add(s.igracId);
      return okolis.rezultat;
    },
    botJeZauzet: (id) => okolis.zauzeti.has(id),
    sada: () => okolis.sada,
    zakazi: (posao, ms) => {
      const stavka = { posao, u: okolis.sada + ms };
      okolis.timeri.push(stavka);
      return stavka as unknown as NodeJS.Timeout;
    },
    otkazi: (handle) => {
      const indeks = okolis.timeri.indexOf(handle as unknown as Okolina['timeri'][number]);
      if (indeks >= 0) okolis.timeri.splice(indeks, 1);
    },
  });
  okolis.tik = async (ms: number) => {
    const cilj = okolis.sada + ms;
    for (;;) {
      const sljedeci = [...okolis.timeri].sort((a, b) => a.u - b.u)[0];
      if (!sljedeci || sljedeci.u > cilj) break;
      okolis.sada = sljedeci.u;
      okolis.timeri.splice(okolis.timeri.indexOf(sljedeci), 1);
      sljedeci.posao();
      await Promise.resolve();
      await Promise.resolve();
    }
    okolis.sada = cilj;
    await Promise.resolve();
  };
  return okolis;
}

describe('pragovi popune', () => {
  it('odstupanje se izvlači samo jednom po epizodi čekanja', () => {
    const red = new RedCekanja(prvaCetvorica);
    const fond = new FondBotova(identiteti(5));
    let sada = 0;
    const generator = vi.fn(() => 1);
    let pragovi = [20_000, 30_000, 40_000];
    const popuna = new PopunaReda({
      red, fond, velicinaStola: 4, pragoviMs: [20_000, 30_000, 40_000], odstupanjaMs: [3_000, 3_000, 3_000],
      rng: generator, sada: () => sada, omogucena: () => true,
      dohvatiRaspored: () => ({ pragoviMs: pragovi, odstupanjaMs: [3_000, 3_000, 3_000] }),
      pokreniStol: async () => 'pokrenuta', botJeZauzet: () => false,
      zakazi: () => 1 as unknown as NodeJS.Timeout, otkazi: () => undefined,
    });
    red.udji(covjek('h1', 0));
    popuna.osvjezi();
    pragovi = [5_000, 10_000, 15_000];
    sada = 22_999;
    popuna.osvjezi();
    expect(popuna.rezerviraniBotovi()).toHaveLength(0);
    sada = 23_000;
    popuna.osvjezi();
    expect(popuna.rezerviraniBotovi()).toHaveLength(1);
    red.udji(covjek('h2', 10_000));
    red.izadji('h1');
    popuna.osvjezi();
    expect(generator).toHaveBeenCalledTimes(3);
    expect(popuna.rezerviraniBotovi()).toHaveLength(0);
    red.izadji('h2');
    popuna.osvjezi();
    red.udji(covjek('h3', sada));
    popuna.osvjezi();
    expect(generator).toHaveBeenCalledTimes(6);
    sada += 8_000;
    popuna.osvjezi();
    expect(popuna.rezerviraniBotovi()).toHaveLength(1);
    popuna.zaustavi();
  });

  it('dopušta 0/1/2/3 bota točno na granicama', () => {
    const pragovi = PRAGOVI_POPUNE_MS.cetiri_igraca;
    expect(dopustenoBotova(0, 19_999, pragovi)).toBe(0);
    expect(dopustenoBotova(0, 20_000, pragovi)).toBe(1);
    expect(dopustenoBotova(0, 29_999, pragovi)).toBe(1);
    expect(dopustenoBotova(0, 30_000, pragovi)).toBe(2);
    expect(dopustenoBotova(0, 39_999, pragovi)).toBe(2);
    expect(dopustenoBotova(0, 40_000, pragovi)).toBe(3);
    expect(sljedeciPragMs(0, 5_000, pragovi)).toBe(15_000);
    expect(sljedeciPragMs(0, 40_000, pragovi)).toBeNull();
    expect(dopustenoBotova(0, 29_999, PRAGOVI_POPUNE_MS.dva_igraca)).toBe(0);
    expect(dopustenoBotova(0, 30_000, PRAGOVI_POPUNE_MS.dva_igraca)).toBe(1);
  });
});

describe('popuna reda', () => {
  it('dvoboj: jedan čovjek dobiva bota točno na 30 s, ne prije', async () => {
    const o = okolina('dva_igraca');
    o.red.udji(covjek('h1', o.sada));
    o.popuna.osvjezi();
    await o.tik(29_999);
    expect(o.pokrenuti).toHaveLength(0);
    await o.tik(1);
    expect(o.pokrenuti).toHaveLength(1);
    expect(o.pokrenuti[0]!.map((s) => s.upravljac ?? 'covjek')).toEqual(['covjek', 'bot']);
    expect(o.red.stanje()).toHaveLength(0);
    expect(o.fond.stanje()).toMatchObject({ uPartiji: 1, slobodni: 4 });
  });

  it('dvoboj: drugi čovjek prije pokretanja oslobađa rezerviranog bota', async () => {
    const o = okolina('dva_igraca');
    o.red.udji(covjek('h1', o.sada));
    o.popuna.osvjezi();
    await o.tik(20_000);
    o.red.udji(covjek('h2', o.sada));
    const stol = o.red.pokusajSastaviStol();
    expect(stol?.map((s) => s.igracId)).toEqual(['h1', 'h2']);
    o.popuna.osvjezi();
    await o.tik(20_000);
    expect(o.pokrenuti).toHaveLength(0);
    expect(o.fond.stanje().slobodni).toBe(5);
    expect(o.timeri).toHaveLength(0);
  });

  it('četveroboj: jedan čovjek dobiva botove na 20/30/40 s i prikazuje ih u čekaonici', async () => {
    const o = okolina('cetiri_igraca');
    o.red.udji(covjek('h1', o.sada));
    o.popuna.osvjezi();
    await o.tik(20_000);
    expect(o.popuna.rezerviraniBotovi()).toHaveLength(1);
    await o.tik(10_000);
    expect(o.popuna.rezerviraniBotovi()).toHaveLength(2);
    expect(o.pokrenuti).toHaveLength(0);
    await o.tik(10_000);
    expect(o.pokrenuti).toHaveLength(1);
    expect(o.pokrenuti[0]!.filter((s) => s.upravljac === 'bot')).toHaveLength(3);
  });

  it('četveroboj: tri čovjeka dobivaju jednog bota na 20 s; dolazak novog čovjeka ne resetira', async () => {
    const o = okolina('cetiri_igraca');
    o.red.udji(covjek('h1', o.sada));
    o.popuna.osvjezi();
    await o.tik(15_000);
    o.red.udji(covjek('h2', o.sada));
    o.red.udji(covjek('h3', o.sada));
    o.popuna.osvjezi();
    await o.tik(5_000);
    expect(o.pokrenuti).toHaveLength(1);
    expect(o.pokrenuti[0]!.filter((s) => s.upravljac === 'bot')).toHaveLength(1);
    expect(o.pokrenuti[0]!.map((s) => s.igracId).slice(0, 3)).toEqual(['h1', 'h2', 'h3']);
  });

  it('izlazak najstarijeg čovjeka ponovno računa rokove i oslobađa višak', async () => {
    const o = okolina('cetiri_igraca');
    o.red.udji(covjek('h1', o.sada));
    o.popuna.osvjezi();
    await o.tik(10_000);
    o.red.udji(covjek('h2', o.sada));
    o.popuna.osvjezi();
    await o.tik(15_000);
    // h1 čeka 25 s: jedan bot rezerviran, partija još ne kreće (2 ljudi + 1 bot).
    expect(o.popuna.rezerviraniBotovi()).toHaveLength(1);
    expect(o.pokrenuti).toHaveLength(0);
    o.red.izadji('h1');
    o.popuna.osvjezi();
    // h2 čeka tek 15 s: nijedan prag nije dosegnut, višak oslobođen.
    expect(o.popuna.rezerviraniBotovi()).toHaveLength(0);
    await o.tik(5_000);
    expect(o.popuna.rezerviraniBotovi()).toHaveLength(1);
    o.red.izadji('h2');
    o.popuna.osvjezi();
    expect(o.popuna.rezerviraniBotovi()).toHaveLength(0);
    expect(o.fond.stanje().slobodni).toBe(5);
  });

  it('iscrpljen fond čeka i nastavlja kad se bot oslobodi nakon partije', async () => {
    const o = okolina('dva_igraca', 1);
    o.red.udji(covjek('h1', o.sada));
    o.popuna.osvjezi();
    await o.tik(30_000);
    expect(o.pokrenuti).toHaveLength(1);
    o.red.udji(covjek('h2', o.sada));
    o.popuna.osvjezi();
    await o.tik(30_000);
    expect(o.pokrenuti).toHaveLength(1);
    expect(o.fond.stanje().iscrpljenja).toBeGreaterThan(0);
    o.zauzeti.clear();
    o.popuna.osvjezi();
    await Promise.resolve();
    expect(o.pokrenuti).toHaveLength(2);
  });

  it('neuspjelo pokretanje oslobađa botove, a čovjek ostaje izvan reda samo dok ga servis ne vrati', async () => {
    const o = okolina('dva_igraca');
    o.rezultat = 'greska';
    o.red.udji(covjek('h1', o.sada));
    o.popuna.osvjezi();
    await o.tik(30_000);
    expect(o.pokrenuti).toHaveLength(1);
    expect(o.fond.stanje().slobodni).toBe(5);
  });

  it('isključena zastavica ne rezervira botove ni ne pokreće partiju', async () => {
    const o = okolina('dva_igraca');
    o.omogucena = false;
    o.red.udji(covjek('h1', o.sada));
    o.popuna.osvjezi();
    await o.tik(60_000);
    expect(o.pokrenuti).toHaveLength(0);
    expect(o.fond.stanje().slobodni).toBe(5);
  });

  it('bez čovjeka nikad ne nastaje partija', async () => {
    const o = okolina('cetiri_igraca');
    const naPromjenu = vi.fn();
    o.popuna.osvjezi();
    await o.tik(60_000);
    expect(o.pokrenuti).toHaveLength(0);
    expect(naPromjenu).not.toHaveBeenCalled();
  });
});
