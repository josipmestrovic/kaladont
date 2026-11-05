import { zatvoriBazu } from '../baza/klijent.js';
import { dodijeliAdmina } from '../operacije/dodijeli-admina.js';

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
  const ishod = await dodijeliAdmina(opcije.email, opcije.potvrdi);
  console.log(`Dodjela admina: ${ishod}.`);
  if (ishod !== 'dodijeljen' && ishod !== 'vec-admin') {
    process.exitCode = 1;
  }
}

glavno()
  .catch((greska: unknown) => {
    console.error(greska instanceof Error ? greska.message : 'Dodjela admina nije uspjela.');
    process.exitCode = 1;
  })
  .finally(() => zatvoriBazu());
