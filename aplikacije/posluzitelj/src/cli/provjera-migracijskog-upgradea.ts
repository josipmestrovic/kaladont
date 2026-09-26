import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

const argumenti = new Map(
  process.argv.slice(2).map((argument) => {
    const [naziv, ...ostatak] = argument.replace(/^--/, '').split('=');
    return [naziv, ostatak.join('=')] as const;
  }),
);

function brojArgumenta(naziv: string, zadano: number): number {
  const sirovo = argumenti.get(naziv);
  const vrijednost = sirovo === undefined ? zadano : Number(sirovo);
  if (!Number.isInteger(vrijednost) || vrijednost < 1) {
    throw new Error(`--${naziv} mora biti cijeli broj >= 1.`);
  }
  return vrijednost;
}

function podijeliSql(sadrzaj: string): string[] {
  return sadrzaj
    .split(/-->\s*statement-breakpoint/g)
    .map((naredba) => naredba.trim())
    .filter(Boolean);
}

async function dohvatiMigracije(direktorij: string): Promise<string[]> {
  const datoteke = await fs.readdir(direktorij);
  return datoteke
    .filter((datoteka) => datoteka.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b, 'hr'));
}

async function primijeniMigraciju(
  veza: postgres.Sql,
  direktorij: string,
  datoteka: string,
): Promise<void> {
  const sadrzaj = await fs.readFile(path.join(direktorij, datoteka), 'utf8');
  for (const naredba of podijeliSql(sadrzaj)) {
    await veza.unsafe(naredba);
  }
}

async function posijPostojecePodatke(veza: postgres.Sql): Promise<void> {
  await veza.unsafe(`
    INSERT INTO igraci (id, vrsta, nadimak, email, email_potvrdjen, odigrane, pobjede, iskustvo_ukupno)
    VALUES ('00000000-0000-4000-8000-000000000101', 'registriran', 'Upgrade Test', 'upgrade-test@example.com', true, 7, 3, 420);
  `);
  await veza.unsafe(`
    INSERT INTO sesije (id, igrac_id, token_hash, istek)
    VALUES ('00000000-0000-4000-8000-000000000201', '00000000-0000-4000-8000-000000000101', repeat('a', 64), now() + interval '1 day');
  `);
  await veza.unsafe(`
    INSERT INTO partije (id, mod, status, pobjednik_id)
    VALUES ('00000000-0000-4000-8000-000000000301', 'cetiri_igraca', 'zavrsena', '00000000-0000-4000-8000-000000000101');
  `);
  await veza.unsafe(`
    INSERT INTO sudionici_partije (partija_id, igrac_id, sjedalo, plasman, bodovi, eliminacije, iskustvo, nacin_ispadanja, cekanje_ms)
    VALUES ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000101', 0, 1, 7, 3, 120, 'pobjednik', 250);
  `);
  await veza.unsafe(`
    INSERT INTO potezi (partija_id, runda, redni_broj, igrac_id, vrsta, rijec, trazena_slova, trajanje_ms)
    VALUES ('00000000-0000-4000-8000-000000000301', 1, 1, '00000000-0000-4000-8000-000000000101', 'rijec', 'mama', 'ma', 800);
  `);
  await veza.unsafe(`
    INSERT INTO prijave (partija_id, igrac_id, poruka)
    VALUES ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000101', 'Sintetička prijava za migracijski upgrade test.');
  `);
}

async function provjeriPodatke(veza: postgres.Sql): Promise<void> {
  const [igrac] = await veza.unsafe<
    {
      nadimak: string;
      email: string;
      email_na_cekanju: string | null;
      email_potvrda_zatrazen_at: Date | null;
      email_potvrda_poslana_at: Date | null;
      iskustvo_ukupno: number;
      registriran_at: Date | null;
    }[]
  >(`
    SELECT nadimak, email, email_na_cekanju, email_potvrda_zatrazen_at, email_potvrda_poslana_at, iskustvo_ukupno, registriran_at
    FROM igraci
    WHERE id = '00000000-0000-4000-8000-000000000101';
  `);
  if (!igrac) throw new Error('Sintetički igrač nije očuvan nakon migracija.');
  if (
    igrac.nadimak !== 'Upgrade Test' ||
    igrac.email !== 'upgrade-test@example.com' ||
    igrac.iskustvo_ukupno !== 420
  ) {
    throw new Error('Podaci sintetičkog igrača promijenjeni su tijekom migracija.');
  }
  if (
    igrac.email_na_cekanju !== null ||
    igrac.email_potvrda_zatrazen_at !== null ||
    igrac.email_potvrda_poslana_at !== null
  ) {
    throw new Error('Novi email stupci nemaju očekivane početne vrijednosti.');
  }
  if (igrac.registriran_at !== null) {
    throw new Error('Migracija je izvela datum registracije za postojeći račun.');
  }

  const [brojevi] = await veza.unsafe<
    {
      sesije: number;
      partije: number;
      sudionici: number;
      potezi: number;
      prijave: number;
    }[]
  >(`
    SELECT
      (SELECT count(*)::int FROM sesije WHERE igrac_id = '00000000-0000-4000-8000-000000000101') AS sesije,
      (SELECT count(*)::int FROM partije WHERE id = '00000000-0000-4000-8000-000000000301') AS partije,
      (SELECT count(*)::int FROM sudionici_partije WHERE igrac_id = '00000000-0000-4000-8000-000000000101') AS sudionici,
      (SELECT count(*)::int FROM potezi WHERE igrac_id = '00000000-0000-4000-8000-000000000101') AS potezi,
      (SELECT count(*)::int FROM prijave WHERE igrac_id = '00000000-0000-4000-8000-000000000101') AS prijave;
  `);
  if (
    !brojevi ||
    brojevi.sesije !== 1 ||
    brojevi.partije !== 1 ||
    brojevi.sudionici !== 1 ||
    brojevi.potezi !== 1 ||
    brojevi.prijave !== 1
  ) {
    throw new Error('Nisu očuvani svi sintetički povezani zapisi.');
  }

  const [indeks] = await veza.unsafe<{ postoji: boolean }[]>(`
    SELECT EXISTS (
      SELECT 1 FROM pg_indexes WHERE tablename = 'prijave' AND indexname = 'idx_prijave_igrac_id_partija_id_vrijeme'
    ) AS postoji;
  `);
  if (!indeks?.postoji) throw new Error('Očekivani indeks prijava nije nastao nakon migracije.');
}

async function glavno(): Promise<void> {
  if (!process.env.BAZA_URL) throw new Error('BAZA_URL nije postavljen.');

  const brojZadnjihMigracija = brojArgumenta('zadnje', 2);
  const direktorijMigracija = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../baza/migracije',
  );
  const migracije = await dohvatiMigracije(direktorijMigracija);
  if (migracije.length <= brojZadnjihMigracija) {
    throw new Error('Nema dovoljno migracija za upgrade test.');
  }

  const baseline = migracije.slice(0, -brojZadnjihMigracija);
  const kandidati = migracije.slice(-brojZadnjihMigracija);
  const veza = postgres(process.env.BAZA_URL, { max: 1 });

  try {
    for (const migracija of baseline)
      await primijeniMigraciju(veza, direktorijMigracija, migracija);
    await posijPostojecePodatke(veza);
    for (const migracija of kandidati)
      await primijeniMigraciju(veza, direktorijMigracija, migracija);
    await provjeriPodatke(veza);
    console.log(
      `Migracijski upgrade test prošao. Baseline=${baseline.length}, kandidati=${kandidati.join(',')}`,
    );
  } finally {
    await veza.end();
  }
}

glavno().catch((greska) => {
  console.error(greska instanceof Error ? greska.message : greska);
  process.exitCode = 1;
});
