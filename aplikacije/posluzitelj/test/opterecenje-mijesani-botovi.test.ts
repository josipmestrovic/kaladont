import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import { izradiGrupuBotova, SimulatorMijesanihBotova } from '../src/cli/opterecenje-mijesani-botovi.js';
import type { SnimkaRjecnika } from '../src/cli/opterecenje-rjecnik.js';

vi.mock('socket.io-client', () => ({ io: vi.fn() }));

let odgovor: 'pocetak' | 'pogresni-mod' | 'odbijen' | 'nema' = 'pocetak';
let redniSocket = 0;

class TestniSocket extends EventEmitter {
  connected = true;
  io = { engine: { transport: { name: 'websocket' } } };
  readonly igracId = `igrac-${++redniSocket}`;

  override emit(dogadaj: string, ...argumenti: unknown[]): boolean {
    if (dogadaj === 'red:udji') {
      queueMicrotask(() => {
        if (odgovor === 'odbijen') {
          (argumenti[1] as (stanje: null) => void)(null);
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
    super.emit('connect');
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
  vi.mocked(io).mockClear();
  vi.mocked(io).mockImplementation(() => {
    const socket = new TestniSocket();
    queueMicrotask(() => socket.spoji());
    return socket as unknown as Socket;
  });
});

describe('potvrda ulaska virtualnog igrača u javni red', () => {
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