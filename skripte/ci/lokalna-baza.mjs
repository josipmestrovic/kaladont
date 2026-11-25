/**
 * Sigurna lokalna CI baza: validacija URL-a, lifecycle privremenih baza, cleanup.
 * Ne čita root .env i ne stvara privilegirane uloge.
 */
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';

export const CI_ULOGA = 'kaladont_ci_local';
export const CI_PREFIKS_BAZE = 'kaladont_ci_local_';
export const ZABRANJENA_IMENA_BAZA = new Set([
  'kaladont_dev',
  'kaladont',
  'kaladont_prod',
  'kaladont_staging',
  'postgres',
  'template0',
  'template1',
]);

const DOPUSTENI_HOSTOVI = new Set(['127.0.0.1', 'localhost', '::1']);
const MAX_IDENT_DULJINA = 63;

/**
 * @typedef {{
 *   protocol: string,
 *   username: string,
 *   password: string,
 *   hostname: string,
 *   port: string,
 *   database: string,
 *   hrefBezLozinke: string,
 * }} ParsiraniUrl
 */

/**
 * @param {string} sirovo
 * @returns {ParsiraniUrl}
 */
export function parsirajPostgresUrl(sirovo) {
  if (typeof sirovo !== 'string' || !sirovo.trim()) {
    throw new Error('PostgreSQL URL nije postavljen.');
  }
  let url;
  try {
    url = new URL(sirovo.trim());
  } catch {
    throw new Error('PostgreSQL URL nije valjan (parsiranje nije uspjelo).');
  }
  if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:') {
    throw new Error(`Nedozvoljen protokol: ${url.protocol}`);
  }
  if (url.search && url.search.length > 1) {
    const parametri = [...url.searchParams.keys()];
    const sumnjivi = parametri.filter((k) =>
      /host|socket|port|dbname|database|user|password|options/i.test(k),
    );
    if (sumnjivi.length > 0) {
      throw new Error(`Nedozvoljeni query parametri: ${sumnjivi.join(', ')}`);
    }
  }
  const hostname = url.hostname.toLowerCase();
  if (!DOPUSTENI_HOSTOVI.has(hostname)) {
    throw new Error(`Nedozvoljen host: ${hostname} (samo loopback).`);
  }
  const username = decodeURIComponent(url.username || '');
  const database = decodeURIComponent((url.pathname || '/').replace(/^\//, ''));
  if (!username) {
    throw new Error('URL mora sadržavati korisničko ime.');
  }
  if (!database) {
    throw new Error('URL mora sadržavati ime baze (maintenance).');
  }
  if (ZABRANJENA_IMENA_BAZA.has(database) && database !== 'postgres') {
    throw new Error(`Maintenance baza ne smije biti ${database}.`);
  }
  const hrefBezLozinke = `${url.protocol}//${username}@${url.hostname}${url.port ? `:${url.port}` : ''}/${database}`;
  return {
    protocol: url.protocol,
    username,
    password: decodeURIComponent(url.password || ''),
    hostname: url.hostname,
    port: url.port || '5432',
    database,
    hrefBezLozinke,
  };
}

/**
 * @param {string} sirovo
 * @param {{ dozvoljenaUloga?: string }} [opcije]
 */
export function validirajCiMaintenanceUrl(sirovo, opcije = {}) {
  const dozvoljenaUloga = opcije.dozvoljenaUloga ?? CI_ULOGA;
  const parsiran = parsirajPostgresUrl(sirovo);
  if (parsiran.username !== dozvoljenaUloga) {
    throw new Error(
      `CI uloga mora biti ${dozvoljenaUloga}, dobiveno: ${parsiran.username}`,
    );
  }
  if (parsiran.database !== 'postgres') {
    throw new Error(
      `Maintenance baza mora biti postgres, dobiveno: ${parsiran.database}`,
    );
  }
  return parsiran;
}

/**
 * @param {string} faza  npr. kod | e2e | upgrade
 * @param {string} runId
 */
export function generirajImeBaze(faza, runId) {
  const cistaFaza = String(faza).replace(/[^a-z0-9_]/gi, '').toLowerCase() || 'faza';
  const cistiRun = String(runId).replace(/[^a-z0-9]/gi, '').toLowerCase();
  if (!cistiRun) {
    throw new Error('runId nije valjan.');
  }
  let ime = `${CI_PREFIKS_BAZE}${cistaFaza}_${cistiRun}`;
  if (ime.length > MAX_IDENT_DULJINA) {
    ime = ime.slice(0, MAX_IDENT_DULJINA);
  }
  if (!/^[a-z][a-z0-9_]*$/.test(ime)) {
    throw new Error(`Generirano ime baze nije valjano: ${ime}`);
  }
  if (ZABRANJENA_IMENA_BAZA.has(ime) || !ime.startsWith(CI_PREFIKS_BAZE)) {
    throw new Error(`Ime baze nije u dozvoljenom prefiksu: ${ime}`);
  }
  return ime;
}

/**
 * @param {ParsiraniUrl} maintenance
 * @param {string} imeBaze
 */
export function urlZaBazu(maintenance, imeBaze) {
  if (!imeBaze.startsWith(CI_PREFIKS_BAZE) || ZABRANJENA_IMENA_BAZA.has(imeBaze)) {
    throw new Error(`Nedozvoljeno ime testne baze: ${imeBaze}`);
  }
  const auth = `${encodeURIComponent(maintenance.username)}:${encodeURIComponent(maintenance.password)}`;
  return `${maintenance.protocol}//${auth}@${maintenance.hostname}:${maintenance.port}/${imeBaze}`;
}

export function noviRunId() {
  return `${Date.now().toString(36)}${randomBytes(4).toString('hex')}`;
}

/**
 * @param {string} rootDir
 * @param {NodeJS.ProcessEnv} [env]
 */
export function ucitajCiDbUrl(rootDir, env = process.env) {
  const izEnv = env.KALADONT_CI_DB_URL?.trim();
  if (izEnv) {
    return { izvor: 'env', url: izEnv };
  }
  const putanja = path.join(rootDir, '.env.ci-local');
  if (!fs.existsSync(putanja)) {
    throw new Error(
      'Nedostaje KALADONT_CI_DB_URL i .env.ci-local. Vidi .env.ci-local.primjer.',
    );
  }
  const sadrzaj = fs.readFileSync(putanja, 'utf8');
  for (const linija of sadrzaj.split(/\r?\n/)) {
    const trim = linija.trim();
    if (!trim || trim.startsWith('#')) continue;
    const m = /^KALADONT_CI_DB_URL\s*=\s*(.*)$/.exec(trim);
    if (m) {
      let v = m[1].trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (!v) {
        throw new Error('.env.ci-local ima prazan KALADONT_CI_DB_URL.');
      }
      return { izvor: 'datoteka', url: v };
    }
  }
  throw new Error('.env.ci-local ne sadrži KALADONT_CI_DB_URL.');
}

/**
 * @param {string} ident
 */
export function quoteIdent(ident) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(ident)) {
    throw new Error(`Neispravan SQL identifikator: ${ident}`);
  }
  return `"${ident}"`;
}

/**
 * @param {string} maintenanceUrl
 * @param {string} imeBaze
 * @param {{ runId: string, vlasnik: string }} meta
 */
export async function stvoriPrivremenuBazu(maintenanceUrl, imeBaze, meta) {
  const maintenance = validirajCiMaintenanceUrl(maintenanceUrl);
  if (meta.vlasnik !== maintenance.username) {
    throw new Error('Vlasnik baze ne odgovara CI ulozi iz URL-a.');
  }
  if (!imeBaze.includes(meta.runId.replace(/[^a-z0-9]/gi, '').toLowerCase().slice(0, 8))) {
    // runId je ugrađen u ime putem generirajImeBaze; dodatna provjera prefiksa
  }
  if (!imeBaze.startsWith(CI_PREFIKS_BAZE)) {
    throw new Error(`Ime nije CI prefiks: ${imeBaze}`);
  }

  const sql = postgres(maintenanceUrl, { max: 1 });
  try {
    const postoji = await sql`
      SELECT 1 AS ok FROM pg_database WHERE datname = ${imeBaze}
    `;
    if (postoji.length > 0) {
      throw new Error(
        `Baza ${imeBaze} već postoji — ne preuzimam niti brišem tuđu bazu.`,
      );
    }
    await sql.unsafe(`CREATE DATABASE ${quoteIdent(imeBaze)} OWNER ${quoteIdent(meta.vlasnik)}`);
    return urlZaBazu(maintenance, imeBaze);
  } finally {
    await sql.end({ timeout: 5 });
  }
}

/**
 * @param {string} maintenanceUrl
 * @param {string} imeBaze
 * @param {{ runId: string, vlasnik: string }} meta
 */
export async function obrisiPrivremenuBazu(maintenanceUrl, imeBaze, meta) {
  const maintenance = validirajCiMaintenanceUrl(maintenanceUrl);
  if (!imeBaze.startsWith(CI_PREFIKS_BAZE) || ZABRANJENA_IMENA_BAZA.has(imeBaze)) {
    throw new Error(`Odbijen DROP — ime nije vlastita CI baza: ${imeBaze}`);
  }
  if (meta.vlasnik !== maintenance.username) {
    throw new Error('Odbijen DROP — vlasnik se ne podudara.');
  }
  const ocekivaniFragment = String(meta.runId).replace(/[^a-z0-9]/gi, '').toLowerCase();
  if (!imeBaze.includes(ocekivaniFragment.slice(0, Math.min(8, ocekivaniFragment.length)))) {
    throw new Error(`Odbijen DROP — baza ${imeBaze} ne pripada runu ${meta.runId}.`);
  }

  const sql = postgres(maintenanceUrl, { max: 1 });
  try {
    const redovi = await sql`
      SELECT d.datname, pg_catalog.pg_get_userbyid(d.datdba) AS owner
      FROM pg_database d
      WHERE d.datname = ${imeBaze}
    `;
    if (redovi.length === 0) {
      return { obrisano: false, razlog: 'ne postoji' };
    }
    if (redovi[0].owner !== meta.vlasnik) {
      throw new Error(
        `Odbijen DROP — vlasnik u PG je ${redovi[0].owner}, očekivano ${meta.vlasnik}.`,
      );
    }
    await sql`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = ${imeBaze} AND pid <> pg_backend_pid()
    `;
    await sql.unsafe(`DROP DATABASE ${quoteIdent(imeBaze)}`);
    return { obrisano: true };
  } finally {
    await sql.end({ timeout: 5 });
  }
}

/**
 * @param {string} maintenanceUrl
 */
export async function provjeriPostgresMajor(maintenanceUrl) {
  validirajCiMaintenanceUrl(maintenanceUrl);
  const sql = postgres(maintenanceUrl, { max: 1 });
  try {
    const redovi = await sql`SHOW server_version_num`;
    const num = Number(redovi[0]?.server_version_num);
    const major = Math.floor(num / 10000);
    return { major, server_version_num: num };
  } finally {
    await sql.end({ timeout: 5 });
  }
}

/**
 * @param {number} port
 * @param {string} [host]
 */
export function portZauzet(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      resolve(false);
    });
  });
}

/**
 * @param {string} rootDir
 * @param {string} runId
 */
export function putanjaLocka(rootDir, runId) {
  return path.join(rootDir, 'test-results', 'lokalni-ci', `.lock-${runId}`);
}

export function putanjaGlobalnogLocka(rootDir) {
  return path.join(rootDir, 'test-results', 'lokalni-ci', '.lock');
}

/**
 * @param {string} rootDir
 * @param {string} runId
 */
export function zauzmiLock(rootDir, runId) {
  const dir = path.join(rootDir, 'test-results', 'lokalni-ci');
  fs.mkdirSync(dir, { recursive: true });
  const lock = putanjaGlobalnogLocka(rootDir);
  if (fs.existsSync(lock)) {
    let stari;
    try {
      stari = JSON.parse(fs.readFileSync(lock, 'utf8'));
    } catch {
      stari = null;
    }
    if (stari?.pid && processUZivotu(stari.pid)) {
      throw new Error(
        `Lokalni CI već radi (pid ${stari.pid}, run ${stari.runId}). Pričekaj ili ukloni ${lock} tek nakon što potvrdiš da proces ne živi.`,
      );
    }
    fs.unlinkSync(lock);
  }
  const sadrzaj = JSON.stringify({ pid: process.pid, runId, startedAt: new Date().toISOString() });
  fs.writeFileSync(lock, sadrzaj, { flag: 'wx' });
  return lock;
}

/**
 * @param {string} rootDir
 * @param {string} runId
 */
export function oslobodiLock(rootDir, runId) {
  const lock = putanjaGlobalnogLocka(rootDir);
  if (!fs.existsSync(lock)) return;
  try {
    const stari = JSON.parse(fs.readFileSync(lock, 'utf8'));
    if (stari.runId === runId && stari.pid === process.pid) {
      fs.unlinkSync(lock);
    }
  } catch {
    // ignore
  }
}

function processUZivotu(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Redakcija URL-a za logove. */
export function redaktirajUrl(url) {
  try {
    const u = new URL(url);
    if (u.password) u.password = '***';
    return u.toString();
  } catch {
    return '[nevaljan-url]';
  }
}

export function redaktirajTekst(tekst) {
  return String(tekst).replace(
    /(postgres(?:ql)?:\/\/[^:\s]+:)([^@\s]+)(@)/gi,
    '$1***$3',
  );
}

export function korijenRepozitorija() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
}
