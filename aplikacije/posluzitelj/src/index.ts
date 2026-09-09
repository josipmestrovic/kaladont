import path from 'node:path';
import { config } from 'dotenv';
import { izgradiPosluzitelj } from './server.js';

config({ path: path.resolve(process.cwd(), '../../.env') });

const PORT = Number(process.env.PORT ?? 3000);

async function pokreni() {
  const { app } = await izgradiPosluzitelj();
  await app.listen({ port: PORT, host: '0.0.0.0' });
  app.log.info(`Poslužitelj sluša na http://localhost:${PORT}`);
}

pokreni().catch((greska) => {
  console.error('Neuspjelo pokretanje poslužitelja:', greska);
  process.exit(1);
});
