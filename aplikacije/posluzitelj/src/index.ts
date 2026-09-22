import { konfiguracija } from './konfiguracija.js';
import { izgradiPosluzitelj } from './server.js';

async function pokreni() {
  const posluzitelj = await izgradiPosluzitelj();
  const { app } = posluzitelj;
  let zaustavljanje = false;
  const ugasi = async (signal: string) => {
    if (zaustavljanje) return;
    zaustavljanje = true;
    app.log.info(`Primljen ${signal}, prekidam aktivne partije i zatvaram poslužitelj.`);
    await posluzitelj.zaustavi();
  };
  process.once('SIGINT', () => void ugasi('SIGINT'));
  process.once('SIGTERM', () => void ugasi('SIGTERM'));
  await app.listen({ port: konfiguracija.PORT, host: '0.0.0.0' });
  app.log.info(`Poslužitelj sluša na http://localhost:${konfiguracija.PORT}`);
}

pokreni().catch((greska) => {
  console.error('Neuspjelo pokretanje poslužitelja:', greska);
  process.exit(1);
});
