export interface SocketHandlerGreska {
  dogadaj: string;
  socketId: string;
  tipGreske: string;
}

export interface SocketHandlerOdrediste {
  id: string;
  connected: boolean;
  emit: (dogadaj: 'greska', payload: { kod: 'INTERNA'; poruka: string }) => unknown;
  disconnect: (zatvoriTransport?: boolean) => unknown;
}

export type ZapisSocketHandlerGreske = (greska: SocketHandlerGreska) => void;

export function omotajSocketHandler(
  socket: SocketHandlerOdrediste,
  dogadaj: string,
  zapisGreske: ZapisSocketHandlerGreske,
  handler: (...argumenti: unknown[]) => unknown,
): (...argumenti: unknown[]) => void {
  function obradiGresku(greska: unknown): void {
    zapisGreske({
      dogadaj,
      socketId: socket.id,
      tipGreske: greska instanceof Error ? greska.name : typeof greska,
    });
    if (socket.connected) {
      socket.emit('greska', { kod: 'INTERNA', poruka: 'Događaj nije obrađen. Pokušaj ponovno.' });
      socket.disconnect(true);
    }
  }

  return (...argumenti: unknown[]) => {
    try {
      const rezultat = handler(...argumenti);
      if (rezultat !== null && (typeof rezultat === 'object' || typeof rezultat === 'function')) {
        const then = (rezultat as { then?: unknown }).then;
        if (typeof then === 'function') void Promise.resolve(rezultat).catch(obradiGresku);
      }
    } catch (greska) {
      obradiGresku(greska);
    }
  };
}