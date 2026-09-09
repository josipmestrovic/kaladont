import { konfiguracija } from './konfiguracija.js';
import { izgradiPosluzitelj } from './server.js';

async function pokreni() {
  const { app } = await izgradiPosluzitelj();
  await app.listen({ port: konfiguracija.PORT, host: '0.0.0.0' });
  app.log.info(`Poslužitelj sluša na http://localhost:${konfiguracija.PORT}`);
}

pokreni().catch((greska) => {
  console.error('Neuspjelo pokretanje poslužitelja:', greska);
  process.exit(1);
});
