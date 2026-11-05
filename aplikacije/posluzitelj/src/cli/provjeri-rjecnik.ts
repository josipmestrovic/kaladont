import { zatvoriBazu } from '../baza/klijent.js';
import { stanjeRjecnika } from '../operacije/rjecnik-bootstrap.js';

async function glavno(): Promise<void> {
  const stanje = await stanjeRjecnika();
  console.log(`Rječnik: ${stanje.broj} riječi (prag ${stanje.prag}).`);
  if (!stanje.dovoljan) {
    process.exitCode = 2;
    console.error('Rječnik je prazan ili djelomičan — potreban je uvoz hrLexa.');
  }
}

glavno()
  .catch((greska: unknown) => {
    console.error(greska instanceof Error ? greska.message : greska);
    process.exitCode = 1;
  })
  .finally(() => zatvoriBazu());
