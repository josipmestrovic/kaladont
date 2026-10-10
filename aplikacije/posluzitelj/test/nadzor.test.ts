import { describe, expect, it } from 'vitest';
import { MAKS_POVIJESTI, MetrikeNadzora } from '../src/nadzor/metrike.js';
import { AlarmiNadzora } from '../src/nadzor/alarmi.js';

const igra = { veze: 0, partije: 0, treninzi: 0, slobodniBotovi: 40, botoviUPartiji: 0, isteciBotova: 0, greskeBotova: 0 };

describe('metrike nadzora', () => {
  it('agregira HTTP i Socket.IO te ograničava povijest', () => {
    const metrike = new MetrikeNadzora();
    metrike.zabiljeziHttp(200, 10);
    metrike.zabiljeziHttp(503, 100);
    metrike.zabiljeziPrihvat(true, false, true);
    metrike.zabiljeziAutorizaciju(true, 20);
    metrike.zabiljeziBazu(true, 2);
    const prvi = metrike.uzorkuj(igra, 21);
    expect(prvi.http).toEqual({ zahtjevi: 2, greske4xx: 0, greske5xx: 1, p95Ms: 100 });
    expect(prvi.socket).toMatchObject({ pokusaji: 1, odbijeni: 1, odbijeniIp: 1, autorizirani: 1, p95AutorizacijeMs: 20 });
    expect(metrike.uzorkuj(igra, 20).http.zahtjevi).toBe(0);
    for (let indeks = 0; indeks < 200; indeks += 1) metrike.uzorkuj(igra, 20);
    expect(metrike.dohvatiPovijest()).toHaveLength(MAKS_POVIJESTI);
    expect(metrike.dohvatiTrenutno()?.baza.dostupna).toBe(true);
  });

  it('računa CPU delta na jednom jezgru i ne dopušta mutaciju povijesti', () => {
    const metrike = new MetrikeNadzora();
    metrike.uzorkuj(igra, 0, { user: 0, system: 0 }, 1000);
    expect(metrike.uzorkuj(igra, 0, { user: 500_000, system: 0 }, 2000).cpuPostotak).toBe(50);
    const povijest = metrike.dohvatiPovijest();
    povijest[0]!.igra.veze = 999;
    expect(metrike.dohvatiPovijest()[0]!.igra.veze).toBe(0);
  });
});

describe('email alarmi', () => {
  const pragovi = { cpuPostotak: 90, rssMiB: 1024, eventLoopMs: 100, httpMs: 1000 };
  it('probno slanje je izričito, ograničeno na minutu i prestaje nakon zatvaranja', async () => {
    let broj = 0;
    const alarmi = new AlarmiNadzora(true, pragovi, async () => { broj += 1; return true; }, 0);
    expect(await alarmi.posaljiProbnu(1000)).toBe(true);
    await expect(alarmi.posaljiProbnu(2000)).rejects.toThrow('Pričekaj');
    expect(await alarmi.posaljiProbnu(61_001)).toBe(true);
    alarmi.zaustavi();
    await expect(alarmi.posaljiProbnu(121_002)).rejects.toThrow();
    expect(broj).toBe(2);
  });

  it('alarmi latencije koriste dovoljno prometa i trajno spore intervale', async () => {
    const alarmi = new AlarmiNadzora(false, pragovi, async () => true, 0);
    const metrike = new MetrikeNadzora();
    for (let sada = 60_000; sada <= 250_000; sada += 5_000) {
      for (let indeks = 0; indeks < 4; indeks += 1) metrike.zabiljeziHttp(200, 2000);
      metrike.uzorkuj(igra, 0, undefined, undefined, undefined, sada);
      await alarmi.provjeri(metrike.dohvatiPovijest(), sada);
    }
    expect(alarmi.dohvatiStanja().find((stanje) => stanje.kljuc === 'http-latencija')?.aktivan).toBe(true);
  });
  it('čeka trajnu degradaciju, ograničava ponavljanje i šalje oporavak', async () => {
    const poruke: string[] = [];
    const alarmi = new AlarmiNadzora(true, pragovi, async (_predmet, tekst) => { poruke.push(tekst); return true; }, 0);
    const metrike = new MetrikeNadzora();
    for (let sada = 0; sada <= 200_000; sada += 5_000) {
      metrike.uzorkuj(igra, 200, undefined, undefined, undefined, sada);
      await alarmi.provjeri(metrike.dohvatiPovijest(), sada);
    }
    expect(poruke).toHaveLength(1);
    expect(poruke[0]).toContain('ALARM: Event-loop');
    metrike.uzorkuj(igra, 20, undefined, undefined, undefined, 250_000);
    await alarmi.provjeri(metrike.dohvatiPovijest(), 250_000);
    expect(poruke.at(-1)).toContain('OPORAVAK: Event-loop');
  });

  it('ne šalje kad je isključeno ili HTTP ima premalo prometa', async () => {
    let broj = 0;
    const alarmi = new AlarmiNadzora(false, pragovi, async () => { broj += 1; return true; }, 0);
    const metrike = new MetrikeNadzora();
    for (let sada = 60_000; sada <= 250_000; sada += 5_000) {
      metrike.zabiljeziHttp(503, 2000);
      metrike.uzorkuj(igra, 200, undefined, undefined, undefined, sada);
      await alarmi.provjeri(metrike.dohvatiPovijest(), sada);
    }
    expect(broj).toBe(0);
    expect(alarmi.dohvatiStanja().find((stanje) => stanje.kljuc === 'http-greske')?.aktivan).toBe(false);
    await expect(alarmi.posaljiProbnu()).rejects.toThrow('nisu uključeni');
  });

  it('DB broji samo nove neuspjele provjere i ne označava neuspješno slanje dostavljenim', async () => {
    let broj = 0;
    const alarmi = new AlarmiNadzora(true, pragovi, async () => { broj += 1; return false; }, 0);
    const metrike = new MetrikeNadzora();
    metrike.zabiljeziBazu(false, 2, 60_000);
    metrike.uzorkuj(igra, 0, undefined, undefined, undefined, 60_000);
    await alarmi.provjeri(metrike.dohvatiPovijest(), 60_000);
    await alarmi.provjeri(metrike.dohvatiPovijest(), 65_000);
    expect(broj).toBe(0);
    metrike.zabiljeziBazu(false, 2, 70_000);
    metrike.uzorkuj(igra, 0, undefined, undefined, undefined, 70_000);
    await alarmi.provjeri(metrike.dohvatiPovijest(), 70_000);
    expect(broj).toBe(1);
    expect(alarmi.dohvatiStanja().find((stanje) => stanje.kljuc === 'baza')).toMatchObject({ aktivan: true, greskaSlanja: true, zadnjaObavijest: null });
    await alarmi.provjeri(metrike.dohvatiPovijest(), 75_000);
    expect(broj).toBe(1);
  });
});