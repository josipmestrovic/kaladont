import { izgradiPosluzitelj } from '../../src/server.js';

async function pokreni(): Promise<void> {
  const posluzitelj = await izgradiPosluzitelj({
    postavkeMotora: { timerOnemogucen: true },
    socketOgranicenja: { dogadajiPoProzoru: 1, handshakePoIpMinuti: 1_000 },
  });
  await posluzitelj.app.listen({ port: 0, host: '127.0.0.1' });
  const adresa = posluzitelj.app.server.address();
  const port = typeof adresa === 'object' && adresa ? adresa.port : 0;

  if (!process.send) throw new Error('IPC kanal nije dostupan.');
  process.send({ vrsta: 'spreman', port });

  process.on('message', (poruka: unknown) => {
    if (typeof poruka !== 'object' || poruka === null || !('vrsta' in poruka) || poruka.vrsta !== 'zaustavi') return;
    void posluzitelj.zaustavi().then(() => {
      process.send?.({ vrsta: 'zaustavljen' });
      process.disconnect();
      process.exit(0);
    }).catch(() => {
      process.exitCode = 1;
      process.disconnect();
      process.exit(1);
    });
  });
}

void pokreni().catch(() => {
  process.send?.({ vrsta: 'greska-pokretanja' });
  process.exitCode = 1;
  process.disconnect();
});
