import { sql } from 'drizzle-orm';
import { baza, zatvoriBazu } from '../baza/klijent.js';
import { rijeci } from '../baza/shema.js';

const rijeciZaCi = [
  'baba',
  'baka',
  'kapa',
  'kara',
  'raka',
  'pala',
  'papa',
  'lala',
  'laka',
  'mama',
  'masa',
  'sala',
  'sapa',
  'apa',
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