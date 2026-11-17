import postgres from 'postgres';

const BAZA_URL =
  process.env.BAZA_URL ?? 'postgresql://kaladont:kaladont@localhost:5432/kaladont_dev';

/** Igračka riječ na prefiks s živim nastavkom (isti kriterij kao privatne-sobe PR08). */
export async function pronadjiIgrivuRijec(prefiks: string, pocetnaRijec: string): Promise<string> {
  const sql = postgres(BAZA_URL, { max: 1 });
  try {
    const redovi = await sql<{ rijec: string }[]>`
      select kandidat.rijec from rijeci kandidat
      join rijeci pocetna on pocetna.rijec = ${pocetnaRijec}
      where kandidat.aktivna and kandidat.prva_dva = ${prefiks}
        and char_length(kandidat.rijec) > char_length(kandidat.prva_dva)
        and kandidat.zadnja_dva <> 'ka'
        and not (kandidat.grupe && pocetna.grupe)
        and exists (
          select 1 from rijeci nastavak
          where nastavak.aktivna and nastavak.prva_dva = kandidat.zadnja_dva
            and not (nastavak.grupe && (pocetna.grupe || kandidat.grupe))
        )
      order by kandidat.rijec limit 1
    `;
    const rijec = redovi[0]?.rijec;
    if (!rijec) {
      throw new Error(`Nema igrive riječi na prefiks „${prefiks}” (početna: ${pocetnaRijec}).`);
    }
    return rijec;
  } finally {
    await sql.end({ timeout: 5 });
  }
}
