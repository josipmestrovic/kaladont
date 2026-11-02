import { sql } from 'drizzle-orm';
import { baza, zatvoriBazu } from '../baza/klijent.js';
import { rijeci } from '../baza/shema.js';

// Svaki prefiks koji se pojavi kao nastavak mora imati ≥2 ne-ka odgovora,
// inače trening e2e/unit testovi padaju kad je početna riječ jedini ne-ka kandidat.
//
// Mrtvi nastavci: most *qa (živi, vodi na qax) + qax (mrtav, ništa ne počinje s xx).
// Ne stavljati mrtve riječi izravno na ba/la/ka/... — load smoke nasumice ih bira i
// partije završe bez mjerenih poteza / s kratkim mrtva-slova lancom.
const rijeciZaCi = [
  'baba',
  'bala',
  'baka',
  'baqa',
  'kapa',
  'kara',
  'kaqa',
  'raka',
  'rasa',
  'raqa',
  'pala',
  'papa',
  'paqa',
  'lala',
  'lama',
  'laka',
  'laqa',
  'mama',
  'masa',
  'maqa',
  'sala',
  'sapa',
  'saqa',
  'apa',
  'qax',
];

function grafemiRijeci(rijec: string): { prvaDva: string; zadnjaDva: string } {
  return {
    prvaDva: rijec.slice(0, 2),
    zadnjaDva: rijec.slice(-2),
  };
}

async function ucitajFixture(): Promise<void> {
  const redci = rijeciZaCi.map((rijec) => {
    const { prvaDva, zadnjaDva } = grafemiRijeci(rijec);
    return {
      rijec,
      prvaDva,
      zadnjaDva,
      vrste: ['imenica'],
      grupe: [`imenica:${rijec}`],
      frekvencija: 1,
      aktivna: true,
      napomena: 'Sintetički CI fixture; nije stvarni rječnik.',
    };
  });

  await baza
    .insert(rijeci)
    .values(redci)
    .onConflictDoUpdate({
      target: rijeci.rijec,
      set: {
        prvaDva: sql`excluded.prva_dva`,
        zadnjaDva: sql`excluded.zadnja_dva`,
        vrste: sql`excluded.vrste`,
        grupe: sql`excluded.grupe`,
        frekvencija: sql`excluded.frekvencija`,
        aktivna: true,
      },
    });

  await zatvoriBazu();
  console.log(`CI fixture učitan: ${redci.length} riječi.`);
}

ucitajFixture().catch((greska) => {
  console.error('Učitavanje CI fixturea nije uspjelo:', greska);
  process.exitCode = 1;
});
