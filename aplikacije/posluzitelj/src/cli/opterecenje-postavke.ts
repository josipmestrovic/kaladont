import { createHash } from 'node:crypto';
import { mkdir, open, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';
import { korijenIzvjestaja } from './opterecenje-izvjestaj.js';

export class OtkazanoPokretanje extends Error {}

export async function odobriRazinuPokusa(
  razina: number,
  ponovnoProvjeri: () => Promise<void>,
  opcije: {
    ulaz?: Readable & { isTTY?: boolean };
    izlaz?: Writable;
    signal?: AbortSignal;
  } = {},
): Promise<void> {
  const ulaz = opcije.ulaz ?? process.stdin;
  const izlaz = opcije.izlaz ?? process.stdout;
  if (!ulaz.isTTY) throw new OtkazanoPokretanje('Staging zahtijeva interaktivni terminal; nema automatske potvrde.');
  const fraza = `POKRENI ${razina}`;
  await new Promise<void>((resolve, reject) => {
    const sucelje = createInterface({ input: ulaz, output: izlaz, terminal: false });
    let dovrseno = false;
    const zavrsi = (razlog?: string) => {
      if (dovrseno) return;
      dovrseno = true;
      process.off('SIGINT', prekini);
      process.off('SIGTERM', prekini);
      opcije.signal?.removeEventListener('abort', prekini);
      sucelje.close();
      ulaz.pause();
      if (razlog) reject(new OtkazanoPokretanje(razlog));
      else resolve();
    };
    const prekini = () => zavrsi('Pokretanje je otkazano prije opterećenja.');
    sucelje.once('line', (unos) => zavrsi(unos === fraza ? undefined : 'Potvrda nije točna. Opterećenje nije pokrenuto.'));
    sucelje.once('close', () => zavrsi('Ulaz je zatvoren. Opterećenje nije pokrenuto.'));
    sucelje.once('error', () => zavrsi('Ulaz nije dostupan. Opterećenje nije pokrenuto.'));
    process.on('SIGINT', prekini);
    process.on('SIGTERM', prekini);
    opcije.signal?.addEventListener('abort', prekini, { once: true });
    if (opcije.signal?.aborted) prekini();
    else izlaz.write(`Čeka potvrdu. Upiši točno ${fraza} i pritisni Enter: `);
  });
  await ponovnoProvjeri();
}

const STAGING_HOST = 'staging.kaladont.hr';
const PRODUKCIJSKI_HOST = 'kaladont.hr';
const RAZINE_KLIJENATA = new Set([100, 500, 1_000, 2_000, 5_000, 10_000]);
const NIZ_RAZINA_KLIJENATA = [100, 500, 1_000, 2_000, 5_000, 10_000] as const;
const TRAJANJE_POTVRDE_MS = 7 * 24 * 60 * 60 * 1_000;

export interface PodaciPotvrdePokusa {
  runId: string;
  izvjestajPutanja: string;
}

export interface PotvrdaPokusa extends PodaciPotvrdePokusa {
  verzijaPotvrde: 2;
  zavrsenoU: number;
  adresa: string;
  brojKorisnika: number;
  profilId: string;
  digest: string;
}

export function direktorijPotvrda(): string {
  return path.join(korijenIzvjestaja(), 'potvrde');
}

export function sljedecaRazina(brojKorisnika: number): number | null {
  const indeks = NIZ_RAZINA_KLIJENATA.findIndex((razina) => razina === brojKorisnika);
  return indeks < 0 ? null : NIZ_RAZINA_KLIJENATA[indeks + 1] ?? null;
}
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

export interface UlazStagingTesta {
  adresa: string | undefined;
  brojKorisnika: number | undefined;
  trajanjeMs: number | undefined;
  scenarij: string;
  velicinaVala: number;
  razmakValaMs: number;
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

export function validirajCiljPokretanja(adresa: string, stagingTest: boolean): URL {
  if (stagingTest) return validirajAdresuStaginga(adresa);

  odbijProdukcijskuAdresu(adresa);
  provjeriNacinPokretanja(adresa, false);
  return new URL(adresa);
}

export function provjeriScenarijStagingTesta(scenarij: string): void {
  if (scenarij !== 'veze') {
    throw new Error('Ova ručna inačica podržava samo scenarij veze.');
  }
}

export function validirajZahtjevStagingTesta(zahtjev: ZahtjevStagingTesta): URL {
  const url = validirajAdresuStaginga(zahtjev.adresa);

  if (!RAZINE_KLIJENATA.has(zahtjev.brojKorisnika)) {
    throw new Error('Broj korisnika mora biti 100, 500, 1000, 2000, 5000 ili 10000.');
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

export function validirajUlazStagingTesta(ulaz: UlazStagingTesta): URL {
  if (ulaz.adresa === undefined || ulaz.brojKorisnika === undefined || ulaz.trajanjeMs === undefined) {
    throw new Error('Staging test zahtijeva --adresa, --klijenti i --trajanje-ms.');
  }

  const url = validirajCiljPokretanja(ulaz.adresa, true);
  provjeriScenarijStagingTesta(ulaz.scenarij);
  provjeriRampuStagingTesta(ulaz.velicinaVala, ulaz.razmakValaMs);
  validirajZahtjevStagingTesta({
    adresa: url.href,
    brojKorisnika: ulaz.brojKorisnika,
    trajanjeMs: ulaz.trajanjeMs,
    potvrdaDesetTisuca: ulaz.potvrdaDesetTisuca,
  });
  return url;
}

export function validirajUlazMijesanogTesta(
  ulaz: Omit<UlazStagingTesta, 'scenarij'>,
): URL {
  if (ulaz.adresa === undefined || ulaz.brojKorisnika === undefined || ulaz.trajanjeMs === undefined) {
    throw new Error('Miješani staging test zahtijeva --adresa, --klijenti i --trajanje-ms.');
  }

  const url = validirajCiljPokretanja(ulaz.adresa, true);
  provjeriRampuStagingTesta(ulaz.velicinaVala, ulaz.razmakValaMs);
  validirajZahtjevStagingTesta({
    adresa: url.href,
    brojKorisnika: ulaz.brojKorisnika,
    trajanjeMs: ulaz.trajanjeMs,
    potvrdaDesetTisuca: ulaz.potvrdaDesetTisuca,
  });
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
  direktorij = direktorijPotvrda(),
  sada = Date.now(),
  profilId = 'veze-v1',
  digest = 'nepoznat',
): Promise<PotvrdaPokusa | undefined> {
  const indeks = NIZ_RAZINA_KLIJENATA.indexOf(brojKorisnika as (typeof NIZ_RAZINA_KLIJENATA)[number]);
  if (indeks <= 0) return;

  const prethodnaRazina = NIZ_RAZINA_KLIJENATA[indeks - 1]!;
  try {
    return await provjeriPotvrduRazine(adresa, prethodnaRazina, direktorij, sada, profilId, digest);
  } catch (greska) {
    throw new Error(`Prije razine ${brojKorisnika} potreban je uspješan test od ${prethodnaRazina} korisnika u zadnjih 7 dana. ${greska instanceof Error ? greska.message : ''}`);
  }
}

export async function provjeriPotvrduRazine(
  adresa: string,
  brojKorisnika: number,
  direktorij = direktorijPotvrda(),
  sada = Date.now(),
  profilId = 'veze-v1',
  digest = 'nepoznat',
): Promise<PotvrdaPokusa | undefined> {
  const putanja = putanjaPotvrde(adresa, brojKorisnika, direktorij, profilId, digest);
  try {
    const potvrda = JSON.parse(await readFile(putanja, 'utf8')) as Partial<PotvrdaPokusa>;
    if (
      !Number.isSafeInteger(potvrda.zavrsenoU) ||
      sada - potvrda.zavrsenoU! < 0 ||
      sada - potvrda.zavrsenoU! > TRAJANJE_POTVRDE_MS
    ) {
      throw new Error('Potvrda je istekla ili ima nevaljano vrijeme.');
    }
    if (profilId.startsWith('mijesani-')) {
      if (potvrda.verzijaPotvrde !== 2 || potvrda.adresa !== adresa ||
          potvrda.brojKorisnika !== brojKorisnika || potvrda.profilId !== profilId ||
          potvrda.digest !== digest || typeof potvrda.runId !== 'string' ||
          typeof potvrda.izvjestajPutanja !== 'string') throw new Error('Potvrda nije potpuna.');
      const izvjestaj = JSON.parse(await readFile(potvrda.izvjestajPutanja, 'utf8')) as Record<string, unknown>;
      if (izvjestaj.verzijaFormata !== 1 || izvjestaj.zakljuceno !== true || izvjestaj.ishod !== 'PASS' ||
          izvjestaj.runId !== potvrda.runId || izvjestaj.cilj !== adresa ||
          izvjestaj.razina !== brojKorisnika || izvjestaj.profilId !== profilId ||
          izvjestaj.digest !== digest || izvjestaj.lokalniSmoke !== false || izvjestaj.pokrenuto !== true) throw new Error('Izvještaj ne potvrđuje prolaz.');
      return potvrda as PotvrdaPokusa;
    }
  } catch (greska) {
    throw new Error(`Nema valjane potvrde razine ${brojKorisnika}. ${(greska as NodeJS.ErrnoException).code === 'ENOENT' ? 'Nedostaje potvrda ili povezani izvještaj.' : greska instanceof Error ? greska.message : 'Nepotpun zapis.'}`);
  }
}

export async function zabiljeziRezultatStagingTesta(
  adresa: string,
  brojKorisnika: number,
  ishod: 'PASS' | 'FAIL' | 'ABORTED',
  direktorij = direktorijPotvrda(),
  sada = Date.now(),
  profilId = 'veze-v1',
  digest = 'nepoznat',
  podaci?: PodaciPotvrdePokusa,
): Promise<void> {
  const indeks = NIZ_RAZINA_KLIJENATA.indexOf(brojKorisnika as (typeof NIZ_RAZINA_KLIJENATA)[number]);
  if (indeks < 0) return;

  await mkdir(direktorij, { recursive: true, mode: 0o700 });
  for (const razina of NIZ_RAZINA_KLIJENATA.slice(indeks)) {
    await unlink(putanjaPotvrde(adresa, razina, direktorij, profilId, digest)).catch((greska: NodeJS.ErrnoException) => {
      if (greska.code !== 'ENOENT') throw greska;
    });
  }
  if (ishod === 'PASS') {
    if (profilId.startsWith('mijesani-') && !podaci) throw new Error('Potvrda miješanog testa zahtijeva runId i dovršeni izvještaj.');
    const potvrda = podaci
      ? { ...podaci, verzijaPotvrde: 2, zavrsenoU: sada, adresa, brojKorisnika, profilId, digest }
      : { zavrsenoU: sada };
    await writeFile(putanjaPotvrde(adresa, brojKorisnika, direktorij, profilId, digest), JSON.stringify(potvrda), {
      mode: 0o600,
    });
  }
}

function putanjaPotvrde(
  adresa: string,
  brojKorisnika: number,
  direktorij: string,
  profilId: string,
  digest: string,
): string {
  const cilj = validirajAdresuStaginga(adresa).origin;
  const hash = createHash('sha256').update(`${cilj}\n${profilId}\n${digest}`).digest('hex').slice(0, 16);
  return path.join(direktorij, `kaladont-staging-${hash}-${brojKorisnika}.json`);
}

export interface UlazOcjeneVeza {
  brojCiljanihKlijenata: number;
  brojObradenihPokusaja: number;
  brojUspjesnihSpajanja: number;
  brojGresaka: number;
  najmanjeAktivnihVeza: number;
  trajanjeDrzanjaMs: number;
  ciljanoDrzanjeMs: number;
  maksStopaGresaka: number;
}

export function ocijeniOdrzaneVeze(ulaz: UlazOcjeneVeza) {
  const dopusteneGreske = Math.floor(ulaz.brojCiljanihKlijenata * ulaz.maksStopaGresaka);
  const najmanjePotrebnoAktivnih = Math.ceil(
    ulaz.brojCiljanihKlijenata * (1 - ulaz.maksStopaGresaka),
  );
  const stopaGresaka = ulaz.brojGresaka / Math.max(1, ulaz.brojCiljanihKlijenata);
  const provjere = {
    sviPokusajiZavrseni: ulaz.brojObradenihPokusaja === ulaz.brojCiljanihKlijenata,
    stopaGresaka: ulaz.brojGresaka <= dopusteneGreske,
    odrzaneVeze: ulaz.najmanjeAktivnihVeza >= najmanjePotrebnoAktivnih,
    punoTrajanje: ulaz.ciljanoDrzanjeMs > 0 && ulaz.trajanjeDrzanjaMs >= ulaz.ciljanoDrzanjeMs,
  };

  return {
    prolaz: Object.values(provjere).every(Boolean),
    stopaGresaka,
    dopusteneGreske,
    najmanjePotrebnoAktivnih,
    provjere,
  };
}

export interface RaspodjelaMijesanogTesta {
  ukupnoKorisnika: number;
  brojPosjetitelja: number;
  brojIgraca: number;
  brojIgracaDvoboja: number;
  brojIgracaJavnogCetveroboja: number;
  brojIgracaPrivatnogCetveroboja: number;
  /** VU-ovi koji ciklički igraju Zagrijavanje; svaki drži jednog računalnog protivnika aktivnim. */
  brojIgracaTreninga: number;
  brojDvoboja: number;
  brojJavnihPartija: number;
  brojPrivatnihSoba: number;
  brojTreninga: number;
}

/** 100 istodobnih treninga na 10.000 korisnika; manje razine proporcionalno, najmanje 1. */
export const CILJANI_TRENINZI_NA_10K = 100;

export function rasporediMijesaniTest(ukupnoKorisnika: number): RaspodjelaMijesanogTesta {
  if (!Number.isSafeInteger(ukupnoKorisnika) || !RAZINE_KLIJENATA.has(ukupnoKorisnika)) {
    throw new Error('Broj korisnika mora biti 100, 500, 1000, 2000, 5000 ili 10000.');
  }

  const brojPosjetitelja = Math.round(ukupnoKorisnika * 0.3);
  const brojIgraca = ukupnoKorisnika - brojPosjetitelja;
  const osnovniTreninzi = Math.max(1, Math.min(CILJANI_TRENINZI_NA_10K, Math.round(brojIgraca * CILJANI_TRENINZI_NA_10K / 7_000)));
  // Ostatak mora biti paran da stane u dvoboje i četveroboje; višak ide u trening.
  const brojTreninga = (brojIgraca - osnovniTreninzi) % 2 === 0 ? osnovniTreninzi : osnovniTreninzi + 1;
  const brojIgracaPartija = brojIgraca - brojTreninga;
  const ciljaniDvoboj = brojIgracaPartija * 0.45;
  const ciljaniJavniCetveroboj = brojIgracaPartija * 0.45;
  const ciljaniPrivatniCetveroboj = brojIgracaPartija * 0.1;
  let najbolji: { dvoboj: number; javni: number; privatni: number; odstupanje: number } | undefined;

  for (let dvoboj = 0; dvoboj <= brojIgracaPartija; dvoboj += 2) {
    for (let javni = 0; javni <= brojIgracaPartija - dvoboj; javni += 4) {
      const privatni = brojIgracaPartija - dvoboj - javni;
      if (privatni % 4 !== 0) continue;
      const odstupanje =
        (dvoboj - ciljaniDvoboj) ** 2 +
        (javni - ciljaniJavniCetveroboj) ** 2 +
        (privatni - ciljaniPrivatniCetveroboj) ** 2;
      if (
        !najbolji ||
        odstupanje < najbolji.odstupanje ||
        (odstupanje === najbolji.odstupanje && dvoboj > najbolji.dvoboj)
      ) {
        najbolji = { dvoboj, javni, privatni, odstupanje };
      }
    }
  }

  if (!najbolji) throw new Error('Nije moguće rasporediti korisnike u potpune partije.');
  return {
    ukupnoKorisnika,
    brojPosjetitelja,
    brojIgraca,
    brojIgracaDvoboja: najbolji.dvoboj,
    brojIgracaJavnogCetveroboja: najbolji.javni,
    brojIgracaPrivatnogCetveroboja: najbolji.privatni,
    brojIgracaTreninga: brojTreninga,
    brojDvoboja: najbolji.dvoboj / 2,
    brojJavnihPartija: najbolji.javni / 4,
    brojPrivatnihSoba: najbolji.privatni / 4,
    brojTreninga,
  };
}

export const RASPODJELA_LOKALNOG_SMOKE = {
  ukupnoKorisnika: 14,
  brojPosjetitelja: 3,
  brojIgraca: 11,
  brojIgracaDvoboja: 2,
  brojIgracaJavnogCetveroboja: 4,
  brojIgracaPrivatnogCetveroboja: 4,
  brojIgracaTreninga: 1,
  brojDvoboja: 1,
  brojJavnihPartija: 1,
  brojPrivatnihSoba: 1,
  brojTreninga: 1,
} satisfies RaspodjelaMijesanogTesta;

export function validirajAdresuLokalnogTesta(adresa: string): URL {
  let url: URL;
  try {
    url = new URL(adresa);
  } catch {
    throw new Error('Lokalna adresa testa nije valjana.');
  }
  if (
    url.protocol !== 'http:' ||
    !['localhost', '127.0.0.1'].includes(url.hostname) ||
    url.port !== '3000' ||
    url.username !== '' ||
    url.password !== '' ||
    url.pathname !== '/' ||
    url.search !== '' ||
    url.hash !== ''
  ) {
    throw new Error('Lokalni smoke dopušten je samo na http://localhost:3000 ili http://127.0.0.1:3000.');
  }
  return url;
}

export function validirajAdresuLokalnogWeba(adresa: string): URL {
  let url: URL;
  try {
    url = new URL(adresa);
  } catch {
    throw new Error('Lokalna web adresa testa nije valjana.');
  }
  if (
    url.protocol !== 'http:' ||
    !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
    !['5173', '5174'].includes(url.port) ||
    url.username !== '' ||
    url.password !== '' ||
    url.pathname !== '/' ||
    url.search !== '' ||
    url.hash !== ''
  ) {
    throw new Error('Lokalni web smoke dopušten je samo na localhost:5173 ili localhost:5174.');
  }
  return url;
}

export function validirajTrajanjeLokalnogSmokea(trajanjeMs: number): void {
  if (!Number.isSafeInteger(trajanjeMs) || trajanjeMs < 15_000 || trajanjeMs > 120_000) {
    throw new Error('Lokalni smoke može trajati od 15 sekundi do 2 minute.');
  }
}