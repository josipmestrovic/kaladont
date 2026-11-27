/**
 * Idempotentan seed taktičkih poolova riječi (Botovi V8 C09).
 *   pnpm --filter posluzitelj seed-bot-poolova
 */
import { baza, zatvoriBazu } from '../baza/klijent.js';
import { seedajPooloveAkoTreba } from '../bot/poolovi-trajno.js';

export async function seedBotPoolova(): Promise<{ preskoceno: boolean; uneseno?: number }> {
  const rezultat = await seedajPooloveAkoTreba(baza);
  if (rezultat.preskoceno) return { preskoceno: true };
  return { preskoceno: false, uneseno: rezultat.uneseno };
}

const ulaznaPutanja = process.argv[1]?.replace(/\\/g, '/') ?? '';
const jePokrenutIzravno = ulaznaPutanja.endsWith('/cli/seed-bot-poolova.ts')
  || ulaznaPutanja.endsWith('/cli/seed-bot-poolova.js');
if (jePokrenutIzravno) {
  seedBotPoolova()
    .then((rezultat) => {
      if (rezultat.preskoceno) {
        console.log('Taktički poolovi: seed već primijenjen, preskočeno.');
      } else {
        console.log(`Taktički poolovi: pokušano umetnuti ${rezultat.uneseno} redova.`);
      }
    })
    .catch((greska: unknown) => {
      console.error(greska instanceof Error ? greska.message : String(greska));
      process.exitCode = 1;
    })
    .finally(() => zatvoriBazu());
}