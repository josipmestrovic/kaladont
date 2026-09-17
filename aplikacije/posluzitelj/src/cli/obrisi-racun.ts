import { zatvoriBazu } from '../baza/klijent.js';
import { obrisiRacun } from '../racuni/brisanje.js';

interface Opcije {
  email: string;
  potvrdi: boolean;
}

export function procitajOpcije(argumenti: readonly string[]): Opcije {
  const email = argumenti.find((argument) => argument.startsWith('--email='))?.slice('--email='.length);
  return { email: email?.trim().toLowerCase() ?? '', potvrdi: argumenti.includes('--potvrdi') };
}

async function glavno(): Promise<void> {
  const opcije = procitajOpcije(process.argv.slice(2));
  const ishod = await obrisiRacun(opcije.email, opcije.potvrdi);
  console.log(`Brisanje računa: ${ishod}.`);
}

glavno()
  .catch((greska: unknown) => {
    console.error(greska instanceof Error ? greska.message : 'Brisanje računa nije uspjelo.');
    process.exitCode = 1;
  })
  .finally(() => zatvoriBazu());