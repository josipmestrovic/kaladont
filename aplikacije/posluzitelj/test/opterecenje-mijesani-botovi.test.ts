import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { izradiGrupuBotova, SimulatorMijesanihBotova } from '../src/cli/opterecenje-mijesani-botovi.js';
import type { SnimkaRjecnika } from '../src/cli/opterecenje-rjecnik.js';

vi.mock('socket.io-client', () => ({ io: vi.fn() }));

let odgovor: 'pocetak' | 'pogresni-mod' | 'odbijen' | 'nema' | 'potvrda' = 'pocetak';
let redniSocket = 0;
let greskaVeze: (Error & { description?: unknown }) | undefined;
let otvoriTransport = false;

class TestniSocket extends EventEmitter {
  connected = true;
  io = Object.assign(new EventEmitter(), { engine: { transport: { name: 'websocket' } } });
  readonly igracId = `igrac-${++redniSocket}`;

  override emit(dogadaj: string, ...argumenti: unknown[]): boolean {
    if (dogadaj === 'red:udji') {
      queueMicrotask(() => {
        if (odgovor === 'odbijen') {
          (argumenti[1] as (stanje: null) => void)(null);
        } else if (odgovor === 'potvrda') {
          (argumenti[1] as (stanje: object) => void)({ mod: 'dva_igraca', mojIgracId: this.igracId, mjesta: [] });
        } else if (odgovor !== 'nema') {
          super.emit('partija:pocetak', {
            partijaId: 'test-partija',
            mojIgracId: this.igracId,
            kontekst: 'javna',
            mod: odgovor === 'pocetak' ? 'dva_igraca' : 'cetiri_igraca',
            sjedala: [{ igracId: 'igrac-1' }, { igracId: 'igrac-2' }],
          });
        }
      });
    }
    return true;
  }

  disconnect(): void {
    this.connected = false;
  }

  spoji(): void {
    if (otvoriTransport) this.io.emit('open');
    if (greskaVeze) super.emit('connect_error', greskaVeze);
    else super.emit('connect');
  }
}

const rjecnik: SnimkaRjecnika = {
  brojRijeci: 0,
  sha256: 'test',
  grupeZaRijec: () => [],
  nasumicnaRijec: async () => null,
};

beforeEach(() => {
  redniSocket = 0;
  odgovor = 'pocetak';
  greskaVeze = undefined;
  otvoriTransport = false;
  vi.mocked(io).mockClear();
  vi.mocked(io).mockImplementation(() => {
    const socket = new TestniSocket();
    queueMicrotask(() => socket.spoji());
    return socket as unknown as Socket;
  });
});

describe('potvrda ulaska virtualnog igrača u javni red', () => {
  it.each([false, true])('razlikuje fazu timeouta kad je transport otvoren=%s', async (transportOtvoren) => {
    greskaVeze = new Error('timeout');
    otvoriTransport = transportOtvoren;
    const prekid = new AbortController();
    const simulator = new SimulatorMijesanihBotova({
      adresa: 'http://localhost:3000', timeoutMs: 50,
      cekanjePotezaMinMs: 1, cekanjePotezaMaksMs: 1, maksPotezaPoPartiji: 1,
    }, rjecnik, () => prekid.abort());
    try {
      await expect(simulator.pokreniGrupu(izradiGrupuBotova('dvoboj'), prekid.signal))
        .rejects.toThrow(transportOtvoren ? 'faza=Socket.IO autorizacija' : 'faza=Engine.IO handshake');
    } finally {
      await simulator.zatvori();
    }
  });

  it('ne broji čekanje u redu od stvaranja grupe prije duge rampe', async () => {
    const sat = vi.spyOn(performance, 'now').mockReturnValue(1_000);
    const grupa = izradiGrupuBotova('dvoboj');
    sat.mockReturnValue(62_001);
    const prekid = new AbortController();
    const simulator = new SimulatorMijesanihBotova({
      adresa: 'http://localhost:3000', timeoutMs: 50,
      cekanjePotezaMinMs: 1, cekanjePotezaMaksMs: 1, maksPotezaPoPartiji: 1,
    }, rjecnik, () => prekid.abort());
    vi.mocked(io).mockImplementation(() => {
      const socket = new TestniSocket();
      queueMicrotask(() => {
        socket.spoji();
        queueMicrotask(() => simulator.uzorak());
      });
      return socket as unknown as Socket;
    });
    try {
      await expect(simulator.pokreniGrupu(grupa, prekid.signal)).resolves.toBeUndefined();
      expect(prekid.signal.aborted).toBe(false);
    } finally {
      sat.mockRestore();
      await simulator.zatvori();
    }
  });

  it('i dalje prekida stvarno predugo čekanje u redu', async () => {
    const sat = vi.spyOn(performance, 'now').mockReturnValue(1_000);
    odgovor = 'potvrda';
    const prekid = new AbortController();
    const prekini = vi.fn(() => prekid.abort());
    const simulator = new SimulatorMijesanihBotova({
      adresa: 'http://localhost:3000', timeoutMs: 50,
      cekanjePotezaMinMs: 1, cekanjePotezaMaksMs: 1, maksPotezaPoPartiji: 1,
    }, rjecnik, prekini);
    try {
      await simulator.pokreniGrupu(izradiGrupuBotova('dvoboj'), prekid.signal);
      sat.mockReturnValue(62_001);
      simulator.uzorak();
      expect(prekini).toHaveBeenCalledWith(expect.stringContaining('Virtualni igrač čeka dulje od 60 sekundi'));
    } finally {
      sat.mockRestore();
      await simulator.zatvori();
    }
  });

  it.each([
    new Error('Unexpected server response: 403'),
    { error: new Error('Unexpected server response: 403') },
  ])('zadržava stvarni razlog neuspjelog handshakea u poruci i izvještaju (%j)', async (description) => {
    greskaVeze = Object.assign(new Error('websocket error'), {
      description,
    });
    const prekid = new AbortController();
    const simulator = new SimulatorMijesanihBotova({
      adresa: 'http://localhost:3000', timeoutMs: 50,
      cekanjePotezaMinMs: 1, cekanjePotezaMaksMs: 1, maksPotezaPoPartiji: 1,
    }, rjecnik, () => prekid.abort());
    try {
      await expect(simulator.pokreniGrupu(izradiGrupuBotova('dvoboj'), prekid.signal))
        .rejects.toThrow('websocket error; Unexpected server response: 403');
      expect(simulator.sazetak().greske).toEqual(expect.arrayContaining([expect.stringContaining('websocket error; Unexpected server response: 403')]));
      expect(simulator.sazetak().brojTehnickihGresaka).toBe(2);
    } finally {
      await simulator.zatvori();
    }
  });

  it.each([undefined, 'websocket'] as const)('odabire transport %s bez promjene zadane putanje', async (transport) => {
    const prekid = new AbortController();
    const simulator = new SimulatorMijesanihBotova({
      adresa: 'http://localhost:3000', timeoutMs: 50,
      cekanjePotezaMinMs: 1, cekanjePotezaMaksMs: 1, maksPotezaPoPartiji: 1,
      transport,
    }, rjecnik, () => prekid.abort());
    try {
      await simulator.pokreniGrupu(izradiGrupuBotova('dvoboj'), prekid.signal);
      expect(io).toHaveBeenCalledWith('http://localhost:3000', expect.objectContaining({
        transports: transport === 'websocket' ? ['websocket'] : ['polling', 'websocket'],
      }));
    } finally {
      await simulator.zatvori();
    }
  });

  it.each(['pocetak', 'pogresni-mod', 'odbijen', 'nema'] as const)('%s', async (vrstaOdgovora) => {
    odgovor = vrstaOdgovora;
    const prekid = new AbortController();
    const simulator = new SimulatorMijesanihBotova({
      adresa: 'http://localhost:3000', timeoutMs: 50,
      cekanjePotezaMinMs: 1, cekanjePotezaMaksMs: 1, maksPotezaPoPartiji: 1,
    }, rjecnik, () => prekid.abort());
    try {
      const pokretanje = simulator.pokreniGrupu(izradiGrupuBotova('dvoboj'), prekid.signal);
      if (vrstaOdgovora === 'pocetak') {
        await expect(pokretanje).resolves.toBeUndefined();
        expect(simulator.uzorak().aktivnePartije).toBe(1);
      } else if (vrstaOdgovora === 'odbijen') {
        await expect(pokretanje).rejects.toThrow('odbio ulazak');
      } else {
        await expect(pokretanje).rejects.toThrow('Ulazak bota u javni red nije potvrđen:');
      }
    } finally {
      await simulator.zatvori();
    }
  });
});