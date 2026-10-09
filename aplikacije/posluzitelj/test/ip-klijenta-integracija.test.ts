import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { io as ioClient, type Socket as ClientSocket } from 'socket.io-client';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { izgradiPosluzitelj } from '../src/server.js';

let app: FastifyInstance;
let adresa: string;

beforeAll(async () => {
  ({ app } = await izgradiPosluzitelj({
    okruzenjeSigurnosti: 'test',
    socketOgranicenja: { handshakePoIpMinuti: 1 },
  }));
  await app.listen({ port: 0, host: '127.0.0.1' });
  const socketAdresa = app.server.address();
  const port = typeof socketAdresa === 'object' && socketAdresa ? socketAdresa.port : 0;
  adresa = `http://127.0.0.1:${port}`;
}, 120_000);

afterAll(async () => {
  await app.close();
});

function spojiSe(ipZaglavlja: string): Promise<ClientSocket> {
  return new Promise((resolve, reject) => {
    const socket = ioClient(adresa, {
      auth: { token: `gost.${randomUUID().replaceAll('-', '')}` },
      extraHeaders: {
        'x-forwarded-for': ipZaglavlja,
        'x-kaladont-ip-klijenta': ipZaglavlja,
      },
      forceNew: true,
      reconnection: false,
      transports: ['websocket'],
      timeout: 2_000,
    });
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', (greska) => {
      socket.disconnect();
      reject(greska);
    });
  });
}

describe('određivanje IP-a na izravnom Socket.IO ulazu', () => {
  it('ne dopušta zaobići ograničenje lažiranjem proslijeđenih IP zaglavlja', async () => {
    const prvi = await spojiSe('203.0.113.10');
    try {
      await expect(spojiSe('203.0.113.11')).rejects.toThrow();
    } finally {
      prvi.disconnect();
    }
  });
});
