import { and, eq, notInArray, sql } from 'drizzle-orm';
import { baza, zatvoriBazu } from '../baza/klijent.js';
import { rijeci } from '../baza/shema.js';

// Svaki prefiks koji se pojavi kao nastavak mora imati ≥2 ne-ka odgovora,
// inače trening e2e/unit testovi padaju kad je početna riječ jedini ne-ka kandidat.
//
// Mrtvi nastavci (*aax): ništa ne počinje s ax, pa motor-partije test mrtvih slova
// uvijek ima kandidata. Duljina ≥4 i frekvencija 0 → bot ih „ne zna” (ne igra ih
// dok ima živih alternativa). Ne mogu biti početna riječ (nema odgovora).
const ziveRijeci = [
  'baba',
  'bala',
  'baka',
  'kapa',
  'kara',
  'raka',
  'rasa',
  'pala',
  'papa',
  'lala',
  'lama',
  'laka',
  'mama',
  'masa',
  'sala',
  'sapa',
  'apa',
] as const;

const mrtveRijeci = ['baax', 'kaax', 'raax', 'paax', 'laax', 'maax', 'saax'] as const;

function grafemiRijeci(rijec: string): { prvaDva: string; zadnjaDva: string } {
  return {
    prvaDva: rijec.slice(0, 2),
    zadnjaDva: rijec.slice(-2),
  };
}

async function ucitajFixture(): Promise<void> {
  const redci = [
    ...ziveRijeci.map((rijec) => {
      const { prvaDva, zadnjaDva } = grafemiRijeci(rijec);
      return {
        rijec,
        prvaDva,
        zadnjaDva,
        vrste: ['imenica'],
        grupe: [`imenica:${rijec}`],
        // ≥ prag uobičajene (100) da botovi u CI biraju ove riječi kao poznate/poželjne.
        frekvencija: 100,
        aktivna: true,
        napomena: 'Sintetički CI fixture; nije stvarni rječnik.',
      };
    }),
    ...mrtveRijeci.map((rijec) => {
      const { prvaDva, zadnjaDva } = grafemiRijeci(rijec);
      return {
        rijec,
        prvaDva,
        zadnjaDva,
        vrste: ['imenica'],
        grupe: [`imenica:${rijec}`],
        frekvencija: 0,
        aktivna: true,
        napomena: 'Sintetički CI fixture; nije stvarni rječnik.',
      };
    }),
  ];

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

  // Deaktiviraj starije CI mostove (bax/qax/…) ako su ostali u bazi iz prethodnog loada.
  await baza
    .update(rijeci)
    .set({ aktivna: false })
    .where(
      and(
        eq(rijeci.napomena, 'Sintetički CI fixture; nije stvarni rječnik.'),
        notInArray(
          rijeci.rijec,
          redci.map((redak) => redak.rijec),
        ),
      ),
    );

  await zatvoriBazu();
  console.log(`CI fixture učitan: ${redci.length} riječi.`);
}

ucitajFixture().catch((greska) => {
  console.error('Učitavanje CI fixturea nije uspjelo:', greska);
  process.exitCode = 1;
});
