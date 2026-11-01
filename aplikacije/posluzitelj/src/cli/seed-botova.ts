/**
 * Idempotentan seed javnih bot identiteta (ADR-017).
 *   pnpm --filter posluzitelj seed-botova -- --broj=40
 * Ponovno pokretanje ne mijenja postojeće botove, ne resetira statistiku i ne dira ljudske račune.
 */
import { zatvoriBazu } from '../baza/klijent.js';
import { dohvatiLimitAktivnihBotova, stvoriBotovePoKljucima } from '../bot/servis-identiteta.js';

export const MAKSIMALNO_BOTOVA = 100;

export function kljucSeedaBota(redni: number): string {
  return `bot-${String(redni).padStart(3, '0')}`;
}

export async function seedBotova(broj: number): Promise<{ stvoreno: number; postojalo: number }> {
  if (!Number.isInteger(broj) || broj < 1 || broj > MAKSIMALNO_BOTOVA) {
    throw new Error(`--broj mora biti cijeli broj od 1 do ${MAKSIMALNO_BOTOVA}.`);
  }
  const limit = await dohvatiLimitAktivnihBotova();
  const rezultat = await stvoriBotovePoKljucima(Array.from({ length: broj }, (_, indeks) => ({ kljucSeeda: kljucSeedaBota(indeks + 1), tip: 'imenovani' as const })), null, limit);
  return { stvoreno: rezultat.stvoreno.length, postojalo: rezultat.postojalo };
}

const jePokrenutIzravno = process.argv[1]?.replace(/\\/g, '/').endsWith('/cli/seed-botova.ts');
if (jePokrenutIzravno) {
  const argument = process.argv.find((a) => a.startsWith('--broj='));
  const broj = Number(argument?.slice('--broj='.length) ?? 40);
  seedBotova(broj)
    .then(({ stvoreno, postojalo }) => {
      console.log(`Botovi: stvoreno ${stvoreno}, već postojalo ${postojalo}.`);
    })
    .catch((greska: unknown) => {
      console.error(greska instanceof Error ? greska.message : String(greska));
      process.exitCode = 1;
    })
    .finally(() => zatvoriBazu());
}
