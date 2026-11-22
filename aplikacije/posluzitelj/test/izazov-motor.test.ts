/**
 * PR03: evaluacija ciljeva, timer Izazova, rani stop, CAS idempotencija.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import {
  definicijaIzazova,
  type KrajPartije,
  type PocetakPartije,
  type PravilnikPartije,
  type RundaOtvorena,
  type StanjePartije,
} from 'zajednicko';
import { izgradiPosluzitelj, type Posluzitelj } from '../src/server.js';
import { baza } from '../src/baza/klijent.js';
import { igraci, pokusajiIzazova } from '../src/baza/shema.js';
import { stvoriGostSesiju } from '../src/racuni/sesije.js';
import { stvoriKontroliraniSat } from '../src/igra/sat.js';
import {
  azurirajCinjenicePrihvacenomRijeci,
  evaluirajNapredak,
  jePravaPogreskaPoteza,
  odlukaNakonKrajaIgre,
  odlukaNakonOdbijenogPoteza,
  prazneCinjenice,
} from '../src/izazovi/evaluacija.js';
import { umetniRezerviraniPokusaj, dohvatiPokusajPoId } from '../src/izazovi/pohrana.js';
import { zavrsiPokusajIzazova, ODGODA_REZULTATA_IZAZOVA_MS } from '../src/izazovi/zavrsetak.js';

describe('Izazov PR03 — evaluacija (čista)', () => {
  it('prava pogreška lomi bezPogreske; tehnički kod ne', () => {
    expect(jePravaPogreskaPoteza('RIJEC_NE_POSTOJI')).toBe(true);
    expect(jePravaPogreskaPoteza('STARI_TURN_TOKEN')).toBe(false);

    const stop = odlukaNakonOdbijenogPoteza({
      ciljevi: { bezPogreske: true },
      cinjenice: prazneCinjenice(),
      kod: 'RIJEC_NE_POSTOJI',
    });
    expect(stop.stop).toBe(true);
    if (stop.stop) expect(stop.razlog).toBe('nevaljana_rijec');

    const neStop = odlukaNakonOdbijenogPoteza({
      ciljevi: { bezPogreske: true },
      cinjenice: prazneCinjenice(),
      kod: 'NIJE_TVOJ_POTEZ',
    });
    expect(neStop.stop).toBe(false);
  });

  it('cilj usred igre ne završava; pobjeda + cilj = uspjeh; pobjeda bez cilja = cilj_neispunjen', () => {
    let c = prazneCinjenice();
    c = azurirajCinjenicePrihvacenomRijeci(c, { brojGrafema: 12, frekvencija: 5 });
    const napredak = evaluirajNapredak({ dugeRijeci: 1, rijetkeRijeci: 1 }, c);
    expect(napredak.sviCiljeviIspunjeni).toBe(true);

    const uspjeh = odlukaNakonKrajaIgre({
      ciljevi: { dugeRijeci: 1 },
      cinjenice: c,
      covjekPobijedio: true,
    });
    expect(uspjeh.status).toBe('uspjeh');

    const neuspjeh = odlukaNakonKrajaIgre({
      ciljevi: { dugeRijeci: 3 },
      cinjenice: c,
      covjekPobijedio: true,
    });
    expect(neuspjeh.status).toBe('neuspjeh');
    expect(neuspjeh.razlog).toBe('cilj_neispunjen');
    expect(neuspjeh.gameWon).toBe(true);

    const elim = odlukaNakonKrajaIgre({
      ciljevi: {},
      cinjenice: c,
      covjekPobijedio: false,
    });
    expect(elim.razlog).toBe('eliminiran');
  });

  it('parametrizirano: pravilnici × formati × timer iz kataloga', () => {
    const uzorci = [
      definicijaIzazova('IZ-L1-DV-01'),
      definicijaIzazova('IZ-L1-DV-03'),
      definicijaIzazova('IZ-L1-TR-02'),
      definicijaIzazova('IZ-L1-CE-03'),
      definicijaIzazova('IZ-L1-DV-04'),
      definicijaIzazova('IZ-L4-CE-05'),
    ] as const;
    for (const d of uzorci) {
      expect([2, 3, 4]).toContain(d.brojIgraca);
      expect(['klasicni', 'ka_zna', 'dokazi_nastavak']).toContain(d.pravila);
      expect([15_000, 30_000]).toContain(d.turnDurationMs);
      const napredak = evaluirajNapredak(d.ciljevi, prazneCinjenice());
      expect(typeof napredak.sviCiljeviIspunjeni).toBe('boolean');
    }
  });
});

describe('Izazov PR03 — CAS završetak', () => {
  const zaBrisanje: string[] = [];

  afterAll(async () => {
    for (const id of zaBrisanje) {
      await baza.delete(pokusajiIzazova).where(eq(pokusajiIzazova.igracId, id));
      await baza.delete(igraci).where(eq(igraci.id, id));
    }
  });

  it('dvostruki završetak je idempotentan; resultsVisibleAt = terminalAt + 8s', async () => {
    const gost = await stvoriGostSesiju();
    zaBrisanje.push(gost.igracId);
    const pokusaj = await umetniRezerviraniPokusaj({
      igracId: gost.igracId,
      requestId: randomUUID(),
      definicija: definicijaIzazova('IZ-L1-DV-01'),
      accountTypeAtStart: 'gost',
      seed: 'cas',
    });
    await baza.update(pokusajiIzazova).set({ status: 'u_tijeku' }).where(eq(pokusajiIzazova.id, pokusaj.id));

    const terminalAt = new Date('2026-11-20T12:00:00.000Z');
    const prvi = await zavrsiPokusajIzazova({
      attemptId: pokusaj.id,
      status: 'neuspjeh',
      razlog: 'eliminiran',
      metrics: {
        dugeRijeci: 0,
        rijetkeRijeci: 0,
        uspjesniDokazi: 0,
        imaPravuPogresku: false,
        prihvaceneRijeci: 0,
        goalProgress: evaluirajNapredak({}, prazneCinjenice()),
      },
      gameWon: false,
      terminalAt,
    });
    expect(prvi?.redak.status).toBe('neuspjeh');
    expect(prvi?.redak.resultsVisibleAt?.getTime()).toBe(terminalAt.getTime() + ODGODA_REZULTATA_IZAZOVA_MS);
    expect(prvi?.settlement.settlementState).toBe('spremljeno');

    const drugi = await zavrsiPokusajIzazova({
      attemptId: pokusaj.id,
      status: 'uspjeh',
      metrics: {},
      gameWon: true,
      terminalAt: new Date(),
    });
    expect(drugi?.redak.status).toBe('neuspjeh');
    expect(drugi?.redak.id).toBe(prvi?.redak.id);
  });
});

describe('Izazov PR03 — motor start, timer, rani stop', () => {
  let posluzitelj: Posluzitelj;
  let adresa: string;
  const igraciZaBrisanje: string[] = [];
  const sat = stvoriKontroliraniSat(Date.now());

  beforeAll(async () => {
    posluzitelj = await izgradiPosluzitelj({
      socketOgranicenja: { handshakePoIpMinuti: 1_000 },
      postavkeMotora: {
        sat,
        // Globalni override isključen — Izazov mora i dalje imati stolni timer.
        timerOnemogucen: true,
        trajanjePotezaMs: 60_000,
        odgodaPocetkaPartijeMs: 0,
        trajanjeIzboraSustavaMs: 0,
        tolerancijaPrekidaMs: 10_000,
      },
    });
    await posluzitelj.app.listen({ port: 0, host: '127.0.0.1' });
    const podaci = posluzitelj.app.server.address();
    adresa = `http://127.0.0.1:${typeof podaci === 'object' && podaci ? podaci.port : 0}`;
  });

  afterAll(async () => {
    await posluzitelj.zaustavi();
    for (const id of igraciZaBrisanje) {
      await baza.delete(pokusajiIzazova).where(eq(pokusajiIzazova.igracId, id));
      await baza.delete(igraci).where(eq(igraci.id, id));
    }
  });

  function spoji(token: string): Promise<ClientSocket> {
    return new Promise((resolve, reject) => {
      const socket = ioClient(adresa, { auth: { token }, forceNew: true });
      socket.once('connect', () => resolve(socket));
      socket.once('connect_error', reject);
    });
  }

  function cekaj<T>(socket: ClientSocket, dogadaj: string, filter: (p: T) => boolean = () => true, timeoutMs = 15_000): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Nema ${dogadaj}`)), timeoutMs);
      const slusac = (payload: T) => {
        if (!filter(payload)) return;
        clearTimeout(timer);
        socket.off(dogadaj, slusac);
        resolve(payload);
      };
      socket.on(dogadaj, slusac);
    });
  }

  async function pokreniIzazov(challengeId: 'IZ-L1-DV-01' | 'IZ-L1-DV-03' | 'IZ-L1-TR-02' = 'IZ-L1-DV-01'): Promise<{
    socket: ClientSocket;
    igracId: string;
    attemptId: string;
    partijaId: string;
    pocetak: PocetakPartije;
    runda: RundaOtvorena;
  }> {
    const gost = await stvoriGostSesiju();
    igraciZaBrisanje.push(gost.igracId);
    const socket = await spoji(gost.token);
    const definicija = definicijaIzazova(challengeId);
    const pokusaj = await umetniRezerviraniPokusaj({
      igracId: gost.igracId,
      requestId: randomUUID(),
      definicija,
      accountTypeAtStart: 'gost',
      seed: 'motor',
    });

    const pocetakPromise = cekaj<PocetakPartije>(socket, 'partija:pocetak');
    const rundaPromise = cekaj<RundaOtvorena>(socket, 'partija:runda-otvorena');
    const motor = await posluzitelj.voditeljIzazova!.pokreniPartiju({
      attemptId: pokusaj.id,
      igracId: gost.igracId,
      challengeId,
    });
    expect(motor.ok).toBe(true);
    if (!motor.ok) throw new Error(motor.razlog);
    sat.unaprijedi(1);
    const pocetak = await pocetakPromise;
    const runda = await rundaPromise;
    return {
      socket,
      igracId: gost.igracId,
      attemptId: pokusaj.id,
      partijaId: motor.partijaId,
      pocetak,
      runda,
    };
  }

  it('start: kontekst izazov, timer 30s unatoč timerOnemogucen, status u_tijeku', async () => {
    const { socket, attemptId, pocetak, runda } = await pokreniIzazov('IZ-L1-DV-01');
    try {
      expect(pocetak.kontekst).toBe('izazov');
      expect(pocetak.trajanjePotezaSek).toBe(30);
      expect(pocetak.izazov?.humanTurnDurationMs).toBe(30_000);
      expect(pocetak.izazov?.botTurnDurationMs).toBe(30_000);
      expect(runda.istekPotezaIso).not.toBe('');
      const rokMs = new Date(runda.istekPotezaIso).getTime() - sat.sada();
      expect(rokMs).toBeGreaterThanOrEqual(29_000);
      expect(rokMs).toBeLessThanOrEqual(30_000);

      const redak = await dohvatiPokusajPoId(attemptId);
      expect(redak?.status).toBe('u_tijeku');
      expect(redak?.partijaId).toBe(pocetak.partijaId);

      const stanjePromise = cekaj<StanjePartije>(socket, 'partija:stanje');
      socket.emit('partija:stanje');
      const stanje = await stanjePromise;
      expect(stanje.goalProgress).toBeTruthy();
      expect(stanje.trajanjePotezaSek).toBe(30);
      expect(stanje.izazov?.challengeId).toBe('IZ-L1-DV-01');
    } finally {
      socket.disconnect();
    }
  });

  it('brzi: ljudski rok 15s u meta; bot rok 30s', async () => {
    const { socket, pocetak, runda, igracId } = await pokreniIzazov('IZ-L1-TR-02');
    try {
      expect(pocetak.izazov?.humanTurnDurationMs).toBe(15_000);
      expect(pocetak.izazov?.botTurnDurationMs).toBe(30_000);
      if (runda.naPotezuId === igracId) {
        expect(runda.trajanjePotezaSek).toBe(15);
        const rokMs = new Date(runda.istekPotezaIso).getTime() - sat.sada();
        expect(rokMs).toBeGreaterThanOrEqual(14_900);
        expect(rokMs).toBeLessThanOrEqual(15_000);
      } else {
        expect(runda.trajanjePotezaSek).toBe(30);
      }
    } finally {
      socket.disconnect();
    }
  });

  it('fake clock: ljudski rok ≈ 15 s; deadline eliminira čovjeka na potezu', async () => {
    const { socket, igracId, runda } = await pokreniIzazov('IZ-L1-TR-02');
    try {
      expect(runda.istekPotezaIso).not.toBe('');
      const preostalo = new Date(runda.istekPotezaIso).getTime() - sat.sada();
      if (runda.naPotezuId !== igracId) {
        // Bot na potezu — efektivni rok 30 s (per-seat politika).
        expect(preostalo).toBeGreaterThanOrEqual(29_000);
        expect(preostalo).toBeLessThanOrEqual(30_000);
        expect(runda.trajanjePotezaSek).toBe(30);
        return;
      }

      expect(preostalo).toBeGreaterThanOrEqual(14_900);
      expect(preostalo).toBeLessThanOrEqual(15_000);

      const elimPromise = cekaj<{ igracId: string; razlog: string }>(
        socket,
        'partija:eliminacija',
        (e) => e.igracId === igracId,
        20_000,
      );
      sat.unaprijedi(preostalo - 1);
      await new Promise((r) => setImmediate(r));
      const stanjePrije = await new Promise<StanjePartije>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('stanje')), 3_000);
        socket.once('partija:stanje', (p: StanjePartije) => {
          clearTimeout(t);
          resolve(p);
        });
        socket.emit('partija:stanje');
      });
      expect(stanjePrije.zavrsena).toBe(false);

      sat.unaprijedi(2);
      const elim = await elimPromise;
      expect(elim.razlog).toBe('istek');
    } finally {
      socket.disconnect();
    }
  });

  it('bez-pogreške: prava pogreška odmah terminalira pokušaj', async () => {
    const { socket, igracId, attemptId, runda } = await pokreniIzazov('IZ-L1-DV-03');
    try {
      if (runda.naPotezuId !== igracId) {
        // Raspored bez našeg poteza — potvrdi da je igra živa; evaluator je pokriven unit testom.
        expect((await dohvatiPokusajPoId(attemptId))?.status).toBe('u_tijeku');
        return;
      }

      const krajPromise = cekaj<KrajPartije>(socket, 'partija:kraj', () => true, 20_000);
      socket.emit('potez:rijec', { rijec: 'xxxxxxnepostoji', turnToken: runda.turnToken });
      await krajPromise;

      let redak = await dohvatiPokusajPoId(attemptId);
      for (let i = 0; i < 40 && (redak?.status === 'u_tijeku' || redak?.status === 'rezerviran'); i += 1) {
        await new Promise((r) => setTimeout(r, 50));
        redak = await dohvatiPokusajPoId(attemptId);
      }
      expect(redak?.status).toBe('neuspjeh');
      expect(redak?.reason).toBe('nevaljana_rijec');
    } finally {
      socket.disconnect();
    }
  });

  it('rani stop: čovjek napušta → kraj igre bez bot-vs-bot; CAS odustao', async () => {
    const { socket, igracId, attemptId } = await pokreniIzazov('IZ-L1-DV-01');
    try {
      const krajPromise = cekaj<KrajPartije>(socket, 'partija:kraj', () => true, 20_000);
      socket.emit('partija:izadji');
      const kraj = await krajPromise;
      expect(kraj.kontekst).toBe('izazov');
      expect(kraj.plasmani.find((p) => p.plasman === 1)?.igracId).not.toBe(igracId);

      let redak = await dohvatiPokusajPoId(attemptId);
      for (let i = 0; i < 40 && redak?.status === 'u_tijeku'; i += 1) {
        await new Promise((r) => setTimeout(r, 50));
        redak = await dohvatiPokusajPoId(attemptId);
      }
      expect(redak?.status).toBe('neuspjeh');
      expect(redak?.reason).toBe('odustao');
      expect(redak?.gameWon).toBe(false);
    } finally {
      socket.disconnect();
    }
  });

  it('rani stop: ne-znam na potezu → eliminiran', async () => {
    const { socket, igracId, attemptId, runda } = await pokreniIzazov('IZ-L1-DV-01');
    try {
      if (runda.naPotezuId !== igracId) {
        expect((await dohvatiPokusajPoId(attemptId))?.status).toBe('u_tijeku');
        return;
      }
      const krajPromise = cekaj<KrajPartije>(socket, 'partija:kraj', () => true, 20_000);
      socket.emit('potez:ne-znam', { turnToken: runda.turnToken });
      await krajPromise;

      let redak = await dohvatiPokusajPoId(attemptId);
      for (let i = 0; i < 40 && redak?.status === 'u_tijeku'; i += 1) {
        await new Promise((r) => setTimeout(r, 50));
        redak = await dohvatiPokusajPoId(attemptId);
      }
      expect(redak?.status).toBe('neuspjeh');
      expect(redak?.reason).toBe('eliminiran');
    } finally {
      socket.disconnect();
    }
  });
});

describe('Izazov PR03 — parametrizirani start (uzorak pravilnika/formata)', () => {
  let posluzitelj: Posluzitelj;
  const igraciZaBrisanje: string[] = [];

  beforeAll(async () => {
    posluzitelj = await izgradiPosluzitelj({
      socketOgranicenja: { handshakePoIpMinuti: 1_000 },
      postavkeMotora: {
        timerOnemogucen: true,
        odgodaPocetkaPartijeMs: 0,
        trajanjeIzboraSustavaMs: 0,
      },
    });
    await posluzitelj.app.listen({ port: 0, host: '127.0.0.1' });
  });

  afterAll(async () => {
    await posluzitelj.zaustavi();
    for (const id of igraciZaBrisanje) {
      await baza.delete(pokusajiIzazova).where(eq(pokusajiIzazova.igracId, id));
      await baza.delete(igraci).where(eq(igraci.id, id));
    }
  });

  const uzorak: { id: 'IZ-L1-DV-01' | 'IZ-L1-TR-01' | 'IZ-L1-CE-01' | 'IZ-L1-TR-04' | 'IZ-L1-TR-02' | 'IZ-L1-DV-04'; pravila: PravilnikPartije; broj: 2 | 3 | 4; sek: 15 | 30 }[] = [
    { id: 'IZ-L1-DV-01', pravila: 'klasicni', broj: 2, sek: 30 },
    { id: 'IZ-L1-TR-01', pravila: 'klasicni', broj: 3, sek: 30 },
    { id: 'IZ-L1-CE-01', pravila: 'klasicni', broj: 4, sek: 30 },
    { id: 'IZ-L1-TR-04', pravila: 'dokazi_nastavak', broj: 3, sek: 30 },
    { id: 'IZ-L1-TR-02', pravila: 'klasicni', broj: 3, sek: 15 },
    { id: 'IZ-L1-DV-04', pravila: 'dokazi_nastavak', broj: 2, sek: 30 },
  ];

  it.each(uzorak)('$id: $pravila / $broj igrača / $sek s', async ({ id, pravila, broj, sek }) => {
    const gost = await stvoriGostSesiju();
    igraciZaBrisanje.push(gost.igracId);
    const adresaPodaci = posluzitelj.app.server.address();
    const adresa = `http://127.0.0.1:${typeof adresaPodaci === 'object' && adresaPodaci ? adresaPodaci.port : 0}`;
    const socket = await new Promise<ClientSocket>((resolve, reject) => {
      const s = ioClient(adresa, { auth: { token: gost.token }, forceNew: true });
      s.once('connect', () => resolve(s));
      s.once('connect_error', reject);
    });
    try {
      const definicija = definicijaIzazova(id);
      expect(definicija.pravila).toBe(pravila);
      expect(definicija.brojIgraca).toBe(broj);
      expect(definicija.turnDurationMs).toBe(sek * 1000);

      const pokusaj = await umetniRezerviraniPokusaj({
        igracId: gost.igracId,
        requestId: randomUUID(),
        definicija,
        accountTypeAtStart: 'gost',
        seed: id,
      });
      const pocetakPromise = new Promise<PocetakPartije>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error('pocetak')), 10_000);
        socket.once('partija:pocetak', (p: PocetakPartije) => {
          clearTimeout(t);
          resolve(p);
        });
      });
      const motor = await posluzitelj.voditeljIzazova!.pokreniPartiju({
        attemptId: pokusaj.id,
        igracId: gost.igracId,
        challengeId: id,
      });
      expect(motor.ok).toBe(true);
      const pocetak = await pocetakPromise;
      expect(pocetak.pravila).toBe(pravila);
      expect(pocetak.sjedala).toHaveLength(broj);
      expect(pocetak.izazov?.humanTurnDurationMs).toBe(sek * 1000);
      expect(pocetak.izazov?.botTurnDurationMs).toBe(30_000);
      // Živi trajanjePotezaSek = rok aktivnog sjedala (čovjek sek ili bot 30).
      expect([sek, 30]).toContain(pocetak.trajanjePotezaSek);
      expect(pocetak.sjedala.filter((s) => s.jeBot)).toHaveLength(broj - 1);
    } finally {
      socket.disconnect();
    }
  });
});
