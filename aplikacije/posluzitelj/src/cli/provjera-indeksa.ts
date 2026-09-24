import postgres from 'postgres';
import { konfiguracija } from '../konfiguracija.js';

const sql = postgres(konfiguracija.BAZA_URL);
type IzvrsiteljUpita = Pick<typeof sql, 'unsafe'>;

async function objasni(
  transakcija: IzvrsiteljUpita,
  naslov: string,
  upit: string,
): Promise<void> {
  const retci = await transakcija.unsafe<{ 'QUERY PLAN': string }[]>(`EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) ${upit}`);
  console.log(`\n=== ${naslov} ===`);
  console.log(retci.map((redak) => redak['QUERY PLAN']).join('\n'));
}

async function glavno(): Promise<void> {
  await sql.begin(async (transakcija) => {
    await transakcija.unsafe(`
      CREATE TEMP TABLE perf_igraci (
        id uuid PRIMARY KEY,
        email text
      ) ON COMMIT DROP;
      CREATE TEMP TABLE perf_partije (
        id uuid PRIMARY KEY,
        pocetak timestamptz NOT NULL
      ) ON COMMIT DROP;
      CREATE TEMP TABLE perf_sudionici_partije (
        partija_id uuid NOT NULL,
        igrac_id uuid NOT NULL
      ) ON COMMIT DROP;
      CREATE TEMP TABLE perf_potezi (
        id bigint GENERATED ALWAYS AS IDENTITY,
        partija_id uuid NOT NULL,
        redni_broj smallint NOT NULL
      ) ON COMMIT DROP;

      INSERT INTO perf_igraci (id, email)
      SELECT md5(g::text)::uuid, 'igrac-' || g || '@example.com'
      FROM generate_series(1, 50000) AS g;
      INSERT INTO perf_partije (id, pocetak)
      SELECT md5(('partija-' || g)::text)::uuid, now() - (g || ' minutes')::interval
      FROM generate_series(1, 100000) AS g;
      INSERT INTO perf_sudionici_partije (partija_id, igrac_id)
      SELECT md5(('partija-' || partija)::text)::uuid, md5((((partija - 1) % 50000) + igrac)::text)::uuid
      FROM generate_series(1, 100000) AS partija
      CROSS JOIN generate_series(1, 4) AS igrac;
      INSERT INTO perf_potezi (partija_id, redni_broj)
      SELECT md5(('partija-' || partija)::text)::uuid, redni_broj
      FROM generate_series(1, 100000) AS partija
      CROSS JOIN generate_series(1, 8) AS redni_broj;

      CREATE UNIQUE INDEX perf_uq_igraci_email_lower
        ON perf_igraci (lower(email))
        WHERE email IS NOT NULL;
      CREATE INDEX perf_idx_sudionici_igrac_id_partija_id
        ON perf_sudionici_partije (igrac_id, partija_id);
      CREATE INDEX perf_idx_potezi_partija_id_redni_broj
        ON perf_potezi (partija_id, redni_broj);
      ANALYZE perf_igraci;
      ANALYZE perf_partije;
      ANALYZE perf_sudionici_partije;
      ANALYZE perf_potezi;
    `);

    await objasni(
      transakcija,
      'Email pretraga',
      `SELECT id FROM perf_igraci WHERE lower(email) = lower('igrac-42424@example.com')`,
    );
    await objasni(
      transakcija,
      'Povijest po igracu',
      `SELECT sp.partija_id, p.pocetak
       FROM perf_sudionici_partije sp
       INNER JOIN perf_partije p ON p.id = sp.partija_id
      WHERE sp.igrac_id = md5('1')::uuid
       ORDER BY p.pocetak DESC
       LIMIT 10 OFFSET 0`,
    );
    await objasni(
      transakcija,
      'Potezi po partiji i rednom broju',
      `SELECT id, partija_id, redni_broj
       FROM perf_potezi
       WHERE partija_id = md5('partija-42424')::uuid
       ORDER BY redni_broj`,
    );
  });
}

glavno().catch((greska: unknown) => {
  console.error('Provjera indeksa nije uspjela:', greska);
  process.exitCode = 1;
}).finally(async () => {
  await sql.end();
});
