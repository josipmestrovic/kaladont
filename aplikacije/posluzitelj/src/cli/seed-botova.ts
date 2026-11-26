/**
 * Idempotentan seed javnih bot identiteta iz odobrenog V5 kataloga.
 *   pnpm --filter posluzitelj seed-botova -- --broj=46
 * Ne stvara generička imena; koristi bot-v5-imenovani-* ključeve.
 */
import { zatvoriBazu } from '../baza/klijent.js';
import { CILJ_AKTIVNIH_FONDA_V5 } from '../bot/nadimci.js';
import { dohvatiLimitAktivnihBotova, stavkeZamjeneFondaBotova, stvoriBotovePoKljucima } from '../bot/servis-identiteta.js';

export const MAKSIMALNO_BOTOVA = 100;

export function kljucSeedaBota(redni: number): string {
  return `bot-v5-imenovani-${String(redni).padStart(3, '0')}`;
}

export async function seedBotova(broj: number): Promise<{ stvoreno: number; postojalo: number }> {
  if (!Number.isInteger(broj) || broj < 1 || broj > MAKSIMALNO_BOTOVA) {
    throw new Error(`--broj mora biti cijeli broj od 1 do ${MAKSIMALNO_BOTOVA}.`);
  }
  if (broj > CILJ_AKTIVNIH_FONDA_V5) {
    throw new Error(`Seed V5 dopušta najviše ${CILJ_AKTIVNIH_FONDA_V5} botova iz odobrenog kataloga.`);
  }
  const limit = await dohvatiLimitAktivnihBotova();
  const stavke = stavkeZamjeneFondaBotova().slice(0, broj);
  const rezultat = await stvoriBotovePoKljucima(stavke, null, limit);
  return { stvoreno: rezultat.stvoreno.length, postojalo: rezultat.postojalo };
}

const ulaznaPutanja = process.argv[1]?.replace(/\\/g, '/') ?? '';
const jePokrenutIzravno = ulaznaPutanja.endsWith('/cli/seed-botova.ts')
  || ulaznaPutanja.endsWith('/cli/seed-botova.js');
if (jePokrenutIzravno) {
  const argument = process.argv.find((a) => a.startsWith('--broj='));
  const broj = Number(argument?.slice('--broj='.length) ?? CILJ_AKTIVNIH_FONDA_V5);
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
