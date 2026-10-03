import { describe, expect, it, vi } from 'vitest';
import { omotajSocketHandler, type SocketHandlerGreska } from '../src/sigurnost/socket-handler.js';

function napraviSocket() {
  const greske: { kod: 'INTERNA'; poruka: string }[] = [];
  const disconnect = vi.fn();
  const socket = {
    id: 'socket-test',
    connected: true,
    emit: (_dogadaj: 'greska', payload: { kod: 'INTERNA'; poruka: string }) => greske.push(payload),
    disconnect,
  };
  return { socket, greske, disconnect };
}

describe('omotajSocketHandler', () => {
  it('hvata sinkronu iznimku i bilježi samo event, socket ID i tip', () => {
    const { socket, greske, disconnect } = napraviSocket();
    const zapis = vi.fn<(greska: SocketHandlerGreska) => void>();
    const handler = omotajSocketHandler(socket, 'red:udji', zapis, () => {
      throw new Error('sirovi token ne smije u log');
    });

    handler({ token: 'tajna-vrijednost' });

    expect(zapis).toHaveBeenCalledWith({ dogadaj: 'red:udji', socketId: 'socket-test', tipGreske: 'Error' });
    expect(JSON.stringify(zapis.mock.calls)).not.toContain('tajna-vrijednost');
    expect(greske).toEqual([{ kod: 'INTERNA', poruka: 'Događaj nije obrađen. Pokušaj ponovno.' }]);
    expect(disconnect).toHaveBeenCalledWith(true);
  });

  it('hvata odbijeni Promise bez neobrađene rejection', async () => {
    const { socket, greske, disconnect } = napraviSocket();
    const zapis = vi.fn<(greska: SocketHandlerGreska) => void>();
    const handler = omotajSocketHandler(socket, 'soba:stvori', zapis, async () => {
      throw new TypeError('podatak');
    });

    handler();
    await vi.waitFor(() => expect(zapis).toHaveBeenCalledOnce());

    expect(zapis).toHaveBeenCalledWith({ dogadaj: 'soba:stvori', socketId: 'socket-test', tipGreske: 'TypeError' });
    expect(greske).toHaveLength(1);
    expect(disconnect).toHaveBeenCalledWith(true);
  });

  it('ne šalje grešku preko zatvorene veze', () => {
    const { socket, greske, disconnect } = napraviSocket();
    socket.connected = false;
    const zapis = vi.fn<(greska: SocketHandlerGreska) => void>();
    const handler = omotajSocketHandler(socket, 'potez:rijec', zapis, () => {
      throw new Error('test');
    });

    handler();

    expect(zapis).toHaveBeenCalledOnce();
    expect(greske).toHaveLength(0);
    expect(disconnect).not.toHaveBeenCalled();
  });
});