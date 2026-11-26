import { count, eq, sql } from 'drizzle-orm';
import { konfiguracija } from '../konfiguracija.js';
import { baza, zatvoriBazu } from '../baza/klijent.js';
import { igraci, partije, postavkeBotova, sudioniciPartije } from '../baza/shema.js';
import {
  jeFondBotovaV5Primijenjen,
  pregledZamjeneFondaBotova,
  zamijeniFondBotova,
} from '../bot/servis-identiteta.js';
import { ZADANA_KONFIGURACIJA_BOTA } from '../bot/konfiguracija-bota.js';
import { parsajSpremljenuKonfiguraciju } from '../bot/trajne-postavke.js';

async function ocistiZaostalePartije(): Promise<number> {
  const ociscene = await baza.update(partije)
    .set({ status: 'ponistena', kraj: sql`coalesce(${partije.kraj}, now())` })
    .where(eq(partije.status, 'u_tijeku'))
    .returning({ id: partije.id });
  return ociscene.length;
}

async function glavno(): Promise<void> {
  const primijeni = process.argv.includes('--primijeni=DA');
  const odrzavanjeProdukcije = process.argv.includes('--odrzavanje-produkcije=DA');
  const ocistiZaostale = process.argv.includes('--ocisti-zaostale-partije=DA');
  if (konfiguracija.NODE_ENV === 'production' && !odrzavanjeProdukcije) {
    throw new Error('Zamjena botova u produkciji traži --odrzavanje-produkcije=DA (samo tijekom održavanja).');
  }

  if (await jeFondBotovaV5Primijenjen()) {
    console.log('Fond botova V5 već je primijenjen — preskačem zamjenu.');
    return;
  }

  const pregled = await pregledZamjeneFondaBotova();
  console.log(`Pregled fonda: ${JSON.stringify(pregled)}`);
  if (!primijeni) {
    console.log('Samo pregled. Za primjenu: --primijeni=DA --posluzitelj-zaustavljen=DA (u produkciji i --odrzavanje-produkcije=DA).');
    return;
  }
  if (konfiguracija.BOTOVI_DVOBOJ === 'true' || konfiguracija.BOTOVI_TROBOJ === 'true' || konfiguracija.BOTOVI_CETVEROBOJ === 'true') {
    throw new Error('Prije zamjene isključi BOTOVI_DVOBOJ, BOTOVI_TROBOJ i BOTOVI_CETVEROBOJ te zaustavi poslužitelj.');
  }
  if (konfiguracija.TRENING_OMOGUCEN === 'true' || !process.argv.includes('--posluzitelj-zaustavljen=DA')) {
    throw new Error('Prije zamjene isključi TRENING_OMOGUCEN, ugasi poslužitelj i potvrdi --posluzitelj-zaustavljen=DA.');
  }

  const [aktivnePartije] = await baza.select({ broj: count() }).from(partije)
    .innerJoin(sudioniciPartije, eq(sudioniciPartije.partijaId, partije.id))
    .innerJoin(igraci, eq(igraci.id, sudioniciPartije.igracId))
    .where(eq(partije.status, 'u_tijeku'));
  const brojAktivnih = Number(aktivnePartije?.broj ?? 0);
  if (brojAktivnih > 0) {
    if (!ocistiZaostale) {
      throw new Error('Postoje spremljene aktivne partije. Pričekaj završetak, ili uz zaustavljen poslužitelj koristi --ocisti-zaostale-partije=DA.');
    }
    const ocisceno = await ocistiZaostalePartije();
    console.log(`Očišćeno zaostalih partija u_tijeku: ${ocisceno}`);
  }

  const [trajni] = await baza.select({ konfiguracija: postavkeBotova.konfiguracija }).from(postavkeBotova).where(eq(postavkeBotova.id, 1));
  const aktivniLimit = trajni
    ? parsajSpremljenuKonfiguraciju(trajni.konfiguracija).maksimalnoAktivnihBotova
    : ZADANA_KONFIGURACIJA_BOTA.maksimalnoAktivnihBotova;
  const rezultat = await zamijeniFondBotova(null, aktivniLimit);
  console.log(`Zamjena završena: ${JSON.stringify(rezultat)}`);
}

const ulaznaPutanja = process.argv[1]?.replace(/\\/g, '/') ?? '';
const pokrenutIzravno = ulaznaPutanja.endsWith('/cli/zamijeni-fond-botova.ts')
  || ulaznaPutanja.endsWith('/cli/zamijeni-fond-botova.js');
if (pokrenutIzravno) {
  glavno().catch((pogreska: unknown) => {
    console.error(pogreska instanceof Error ? pogreska.message : String(pogreska));
    process.exitCode = 1;
  }).finally(() => zatvoriBazu());
}
