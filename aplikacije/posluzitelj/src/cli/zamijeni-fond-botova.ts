import { count, eq } from 'drizzle-orm';
import { konfiguracija } from '../konfiguracija.js';
import { baza, zatvoriBazu } from '../baza/klijent.js';
import { igraci, partije, postavkeBotova, sudioniciPartije } from '../baza/shema.js';
import { pregledZamjeneFondaBotova, zamijeniFondBotova } from '../bot/servis-identiteta.js';
import { ShemaKonfiguracijeBota, ZADANA_KONFIGURACIJA_BOTA } from '../bot/konfiguracija-bota.js';

async function glavno(): Promise<void> {
  const primijeni = process.argv.includes('--primijeni=DA');
  const odrzavanjeProdukcije = process.argv.includes('--odrzavanje-produkcije=DA');
  if (konfiguracija.NODE_ENV === 'production' && !odrzavanjeProdukcije) {
    throw new Error('Zamjena botova u produkciji traži --odrzavanje-produkcije=DA (samo tijekom održavanja).');
  }
  const pregled = await pregledZamjeneFondaBotova();
  console.log(`Pregled fonda: ${JSON.stringify(pregled)}`);
  if (!primijeni) {
    console.log('Samo pregled. Za primjenu: --primijeni=DA --posluzitelj-zaustavljen=DA (u produkciji i --odrzavanje-produkcije=DA).');
    return;
  }
  if (konfiguracija.BOTOVI_DVOBOJ === 'true' || konfiguracija.BOTOVI_CETVEROBOJ === 'true') {
    throw new Error('Prije zamjene isključi BOTOVI_DVOBOJ i BOTOVI_CETVEROBOJ te zaustavi poslužitelj.');
  }
  if (konfiguracija.TRENING_OMOGUCEN === 'true' || !process.argv.includes('--posluzitelj-zaustavljen=DA')) {
    throw new Error('Prije zamjene isključi TRENING_OMOGUCEN, ugasi poslužitelj i potvrdi --posluzitelj-zaustavljen=DA.');
  }
  const [aktivnePartije] = await baza.select({ broj: count() }).from(partije)
    .innerJoin(sudioniciPartije, eq(sudioniciPartije.partijaId, partije.id))
    .innerJoin(igraci, eq(igraci.id, sudioniciPartije.igracId))
    .where(eq(partije.status, 'u_tijeku'));
  if (Number(aktivnePartije?.broj ?? 0) > 0) throw new Error('Postoje spremljene aktivne partije. Pričekaj završetak i ponovi pregled.');
  const [trajni] = await baza.select({ konfiguracija: postavkeBotova.konfiguracija }).from(postavkeBotova).where(eq(postavkeBotova.id, 1));
  const aktivniLimit = trajni
    ? ShemaKonfiguracijeBota.parse({ ...ZADANA_KONFIGURACIJA_BOTA, ...(trajni.konfiguracija as object) }).maksimalnoAktivnihBotova
    : ZADANA_KONFIGURACIJA_BOTA.maksimalnoAktivnihBotova;
  const rezultat = await zamijeniFondBotova(null, aktivniLimit);
  console.log(`Zamjena završena: ${JSON.stringify(rezultat)}`);
}

const pokrenutIzravno = process.argv[1]?.replace(/\\/g, '/').endsWith('/cli/zamijeni-fond-botova.ts');
if (pokrenutIzravno) {
  glavno().catch((pogreska: unknown) => {
    console.error(pogreska instanceof Error ? pogreska.message : String(pogreska));
    process.exitCode = 1;
  }).finally(() => zatvoriBazu());
}