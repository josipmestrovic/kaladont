import { createHash } from 'node:crypto';
import { mkdir, open, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const STAGING_HOST = 'staging.kaladont.hr';
const PRODUKCIJSKI_HOST = 'kaladont.hr';
const RAZINE_KLIJENATA = new Set([100, 500, 1_000, 10_000]);
const NIZ_RAZINA_KLIJENATA = [100, 500, 1_000, 10_000] as const;
const TRAJANJE_POTVRDE_MS = 7 * 24 * 60 * 60 * 1_000;
export const MAKS_TRAJANJE_STAGING_TESTA_MS = 2 * 60 * 60 * 1_000;
export const MIN_TRAJANJE_STAGING_TESTA_MS = 60_000;
export const MAKS_VELICINA_VALA_STAGING = 100;
export const MIN_RAZMAK_VALA_STAGING_MS = 1_000;
export const MAKS_RAZMAK_VALA_STAGING_MS = 60_000;

export interface ZahtjevStagingTesta {
  adresa: string;
  brojKorisnika: number;
  trajanjeMs: number;
  potvrdaDesetTisuca: string | undefined;
}

export function validirajAdresuStaginga(adresa: string): URL {
  let url: URL;
  try {
    url = new URL(adresa);
  } catch {
    throw new Error('Adresa testa nije valjana.');
  }

  if (
    url.protocol !== 'https:' ||
    url.hostname !== STAGING_HOST ||
    url.port !== '' ||
    url.username !== '' ||
    url.password !== '' ||
    url.pathname !== '/' ||
    url.search !== '' ||
    url.hash !== ''
  ) {
    throw new Error(`Test opterećenja dopušten je samo na https://${STAGING_HOST}.`);
  }

  return url;
}

export function odbijProdukcijskuAdresu(adresa: string): void {
  let url: URL;
  try {
    url = new URL(adresa);
  } catch {
    return;
  }

  if (url.hostname === PRODUKCIJSKI_HOST || url.hostname.endsWith(`.${PRODUKCIJSKI_HOST}`)) {
    throw new Error('Test opterećenja prema produkciji nije dopušten.');
  }
}

export function provjeriNacinPokretanja(adresa: string, stagingTest: boolean): void {
  let url: URL;
  try {
    url = new URL(adresa);
  } catch {
    return;
  }

  if (url.hostname === STAGING_HOST && !stagingTest) {
    throw new Error('Za staging koristi zasebnu naredbu test:opterecenje.');
  }
}

export function provjeriScenarijStagingTesta(scenarij: string): void {
  if (scenarij !== 'veze') {
    throw new Error('Ova ručna inačica podržava samo scenarij veze.');
  }
}

export function validirajZahtjevStagingTesta(zahtjev: ZahtjevStagingTesta): URL {
  const url = validirajAdresuStaginga(zahtjev.adresa);

  if (!RAZINE_KLIJENATA.has(zahtjev.brojKorisnika)) {
    throw new Error('Broj korisnika mora biti 100, 500, 1000 ili 10000.');
  }
  if (
    !Number.isInteger(zahtjev.trajanjeMs) ||
    zahtjev.trajanjeMs < MIN_TRAJANJE_STAGING_TESTA_MS ||
    zahtjev.trajanjeMs > MAKS_TRAJANJE_STAGING_TESTA_MS
  ) {
    throw new Error('Trajanje mora biti između 1 minute i 2 sata.');
  }
  if (zahtjev.brojKorisnika === 10_000 && zahtjev.potvrdaDesetTisuca !== 'DA') {
    throw new Error('Za 10000 korisnika dodaj --potvrdi-10000=DA.');
  }

  return url;
}

export async function zakljucajStagingTest(
  adresa: string,
  direktorij = tmpdir(),
): Promise<() => Promise<void>> {
  const cilj = validirajAdresuStaginga(adresa).origin;
  const hash = createHash('sha256').update(cilj).digest('hex').slice(0, 16);
  const putanja = path.join(direktorij, `kaladont-opterecenje-${hash}.lock`);

  for (let pokusaj = 0; pokusaj < 2; pokusaj += 1) {
    try {
      const datoteka = await open(putanja, 'wx', 0o600);
      try {
        await datoteka.writeFile(JSON.stringify({ pid: process.pid, pokrenutoU: Date.now() }));
      } catch (greska) {
        await datoteka.close();
        await unlink(putanja).catch(() => undefined);
        throw greska;
      }
      return async () => {
        await datoteka.close();
        await unlink(putanja).catch(() => undefined);
      };
    } catch (greska) {
      if ((greska as NodeJS.ErrnoException).code !== 'EEXIST') throw greska;
      if (!(await jeZakljucavanjeZastarjelo(putanja))) {
        throw new Error('Već je pokrenut test opterećenja za staging.');
      }
      await unlink(putanja).catch(() => undefined);
    }
  }

  throw new Error('Nije moguće preuzeti zaključavanje staging testa.');
}

async function jeZakljucavanjeZastarjelo(putanja: string): Promise<boolean> {
  try {
    const zapis = JSON.parse(await readFile(putanja, 'utf8')) as { pid?: number };
    if (!Number.isInteger(zapis.pid) || !zapis.pid) return Date.now() - (await stat(putanja)).mtimeMs > 60_000;
    try {
      process.kill(zapis.pid, 0);
      return false;
    } catch (greska) {
      return (greska as NodeJS.ErrnoException).code === 'ESRCH';
    }
  } catch {
    try {
      return Date.now() - (await stat(putanja)).mtimeMs > 60_000;
    } catch {
      return true;
    }
  }
}

export function provjeriRampuStagingTesta(velicinaVala: number, razmakValaMs: number): void {
  if (
    !Number.isInteger(velicinaVala) ||
    velicinaVala < 1 ||
    velicinaVala > MAKS_VELICINA_VALA_STAGING ||
    !Number.isSafeInteger(razmakValaMs) ||
    razmakValaMs < MIN_RAZMAK_VALA_STAGING_MS ||
    razmakValaMs > MAKS_RAZMAK_VALA_STAGING_MS
  ) {
    throw new Error('Staging val je ograničen na 100 klijenata, a razmak mora biti od 1000 do 60000 ms.');
  }
}

export async function provjeriPrethodnuRazinuStagingTesta(
  adresa: string,
  brojKorisnika: number,
  direktorij = path.join(tmpdir(), 'kaladont-potvrde-testova'),
  sada = Date.now(),
): Promise<void> {
  const indeks = NIZ_RAZINA_KLIJENATA.indexOf(brojKorisnika as (typeof NIZ_RAZINA_KLIJENATA)[number]);
  if (indeks <= 0) return;

  const prethodnaRazina = NIZ_RAZINA_KLIJENATA[indeks - 1]!;
  const putanja = putanjaPotvrde(adresa, prethodnaRazina, direktorij);
  try {
    const potvrda = JSON.parse(await readFile(putanja, 'utf8')) as { zavrsenoU?: number };
    if (
      !Number.isSafeInteger(potvrda.zavrsenoU) ||
      sada - potvrda.zavrsenoU! < 0 ||
      sada - potvrda.zavrsenoU! > TRAJANJE_POTVRDE_MS
    ) {
      throw new Error();
    }
  } catch {
    throw new Error(`Prije razine ${brojKorisnika} potreban je uspješan test od ${prethodnaRazina} korisnika u zadnjih 7 dana.`);
  }
}

export async function zabiljeziRezultatStagingTesta(
  adresa: string,
  brojKorisnika: number,
  prosao: boolean,
  direktorij = path.join(tmpdir(), 'kaladont-potvrde-testova'),
  sada = Date.now(),
): Promise<void> {
  const indeks = NIZ_RAZINA_KLIJENATA.indexOf(brojKorisnika as (typeof NIZ_RAZINA_KLIJENATA)[number]);
  if (indeks < 0) return;

  await mkdir(direktorij, { recursive: true, mode: 0o700 });
  for (const razina of NIZ_RAZINA_KLIJENATA.slice(indeks)) {
    await unlink(putanjaPotvrde(adresa, razina, direktorij)).catch(() => undefined);
  }
  if (prosao) {
    await writeFile(putanjaPotvrde(adresa, brojKorisnika, direktorij), JSON.stringify({ zavrsenoU: sada }), {
      mode: 0o600,
    });
  }
}

function putanjaPotvrde(adresa: string, brojKorisnika: number, direktorij: string): string {
  const cilj = validirajAdresuStaginga(adresa).origin;
  const hash = createHash('sha256').update(cilj).digest('hex').slice(0, 16);
  return path.join(direktorij, `kaladont-staging-${hash}-${brojKorisnika}.json`);
}