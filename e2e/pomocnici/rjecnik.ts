import postgres from 'postgres';

const BAZA_URL =
  process.env.BAZA_URL ?? 'postgresql://kaladont:kaladont@localhost:5432/kaladont_dev';

type Sql = ReturnType<typeof postgres>;

type Kandidat = { rijec: string; grupe: string[]; zadnja_dva: string };

function jeIgriva(kandidat: Kandidat, potrosene: ReadonlySet<string>): boolean {
  return kandidat.grupe.every((grupa) => !potrosene.has(grupa));
}

function uzGrupe(potrosene: ReadonlySet<string>, grupe: readonly string[]): Set<string> {
  const novo = new Set(potrosene);
  for (const grupa of grupe) novo.add(grupa);
  return novo;
}

async function kandidatiNaPrefiks(sql: Sql, prefiks: string, limit: number): Promise<Kandidat[]> {
  return sql<Kandidat[]>`
    select rijec, grupe, zadnja_dva
    from rijeci
    where aktivna and prva_dva = ${prefiks}
      and char_length(rijec) > char_length(prva_dva)
    order by rijec
    limit ${limit}
  `;
}

async function imaZivNastavak(
  sql: Sql,
  kandidat: Kandidat,
  potrosene: ReadonlySet<string>,
): Promise<boolean> {
  const nakon = uzGrupe(potrosene, kandidat.grupe);
  const nastavci = await kandidatiNaPrefiks(sql, kandidat.zadnja_dva, 50);
  return nastavci.some((n) => n.rijec !== kandidat.rijec && jeIgriva(n, nakon));
}

async function grupeRijeci(sql: Sql, rijec: string): Promise<string[]> {
  const redovi = await sql<{ grupe: string[] }[]>`
    select grupe from rijeci where rijec = ${rijec} limit 1
  `;
  return redovi[0]?.grupe ?? [];
}

/**
 * Igračka riječ na prefiks s živim nastavkom.
 * `potroseneRijeci` — sve već odigrane (sustavska + igračke); grupe se unije.
 */
export async function pronadjiIgrivuRijec(
  prefiks: string,
  ...potroseneRijeci: string[]
): Promise<string> {
  if (potroseneRijeci.length === 0) {
    throw new Error('pronadjiIgrivuRijec treba barem jednu potrošenu riječ za grupe.');
  }
  const sql = postgres(BAZA_URL, { max: 1 });
  try {
    const potrosene = [...new Set(potroseneRijeci)];
    const redovi = await sql<{ rijec: string }[]>`
      with potroseno as (
        select coalesce(array_agg(distinct g), '{}'::text[]) as grupe
        from rijeci r
        cross join lateral unnest(r.grupe) as g
        where r.rijec = any(${potrosene})
      )
      select kandidat.rijec from rijeci kandidat, potroseno
      where kandidat.aktivna and kandidat.prva_dva = ${prefiks}
        and char_length(kandidat.rijec) > char_length(kandidat.prva_dva)
        and kandidat.zadnja_dva <> 'ka'
        and not (kandidat.grupe && potroseno.grupe)
        and exists (
          select 1 from rijeci nastavak
          where nastavak.aktivna and nastavak.prva_dva = kandidat.zadnja_dva
            and not (nastavak.grupe && (potroseno.grupe || kandidat.grupe))
        )
      order by kandidat.rijec limit 1
    `;
    const rijec = redovi[0]?.rijec;
    if (!rijec) {
      throw new Error(
        `Nema igrive riječi na prefiks „${prefiks}” (potrošeno: ${potrosene.join(', ')}).`,
      );
    }
    return rijec;
  } finally {
    await sql.end({ timeout: 5 });
  }
}

/**
 * BFS lanac živih riječi do riječi koja završava na „ka” (kao motor-partije PR04).
 * Potrebno za E2E kaladont na troje — sustav bira početnu riječ.
 */
export async function pronadjiLanacDoKa(
  prefiks: string,
  pocetnaRijec: string,
): Promise<string[]> {
  const sql = postgres(BAZA_URL, { max: 1 });
  try {
    const pocetne = await grupeRijeci(sql, pocetnaRijec);
    interface Cvor {
      prefiks: string;
      put: string[];
      potrosene: Set<string>;
    }
    let razina: Cvor[] = [{ prefiks, put: [], potrosene: new Set(pocetne) }];
    const posjeceniPrefiksi = new Set([prefiks]);

    for (let dubina = 0; dubina < 6 && razina.length > 0; dubina += 1) {
      const sljedecaRazina: Cvor[] = [];
      for (const cvor of razina) {
        const kaKandidati = await sql<Kandidat[]>`
          select rijec, grupe, zadnja_dva
          from rijeci
          where aktivna and prva_dva = ${cvor.prefiks} and zadnja_dva = 'ka'
          order by rijec
          limit 50
        `;
        for (const kandidat of kaKandidati) {
          if (jeIgriva(kandidat, cvor.potrosene) && (await imaZivNastavak(sql, kandidat, cvor.potrosene))) {
            return [...cvor.put, kandidat.rijec];
          }
        }

        const rezultati = await kandidatiNaPrefiks(sql, cvor.prefiks, 400);
        const kandidati = rezultati.filter(
          (k) => jeIgriva(k, cvor.potrosene) && !cvor.put.includes(k.rijec),
        );

        for (const kandidat of kandidati.slice(0, 40)) {
          const noviPrefiks = kandidat.zadnja_dva;
          if (posjeceniPrefiksi.has(noviPrefiks)) continue;
          if (!(await imaZivNastavak(sql, kandidat, cvor.potrosene))) continue;
          posjeceniPrefiksi.add(noviPrefiks);
          sljedecaRazina.push({
            prefiks: noviPrefiks,
            put: [...cvor.put, kandidat.rijec],
            potrosene: uzGrupe(cvor.potrosene, kandidat.grupe),
          });
        }
      }
      razina = sljedecaRazina;
    }
    throw new Error(`Nema lanca do „ka” za prefiks „${prefiks}” (početna: ${pocetnaRijec}).`);
  } finally {
    await sql.end({ timeout: 5 });
  }
}
