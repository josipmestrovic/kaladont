#!/usr/bin/env node
/**
 * Lokalni CI orkestrator — profili brzi / test / e2e / lokalni / puni.
 * Bez Dockera; izolirane privremene PostgreSQL baze; Windows-first.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
import {
  CI_ULOGA,
  generirajImeBaze,
  korijenRepozitorija,
  noviRunId,
  obrisiPrivremenuBazu,
  oslobodiLock,
  portZauzet,
  provjeriPostgresMajor,
  redaktirajTekst,
  redaktirajUrl,
  stvoriPrivremenuBazu,
  ucitajCiDbUrl,
  validirajCiMaintenanceUrl,
  zauzmiLock,
} from './lokalna-baza.mjs';

const PROFILI = new Set(['brzi', 'test', 'e2e', 'lokalni', 'puni']);
const STATUS = {
  PROSLO: 'PROŠLO',
  PALO: 'PALO',
  BLOKIRANO: 'BLOKIRANO',
  NIJE_POKRENUTO: 'NIJE POKRENUTO',
  NIJE_PRIMJENJIVO: 'NIJE PRIMJENJIVO',
};

const ZABRANJENI_E2E_FLAGOVI = new Set([
  '--config',
  '-c',
  '--pass-with-no-tests',
  '--ui',
  '--debug',
  '--headed',
]);

const ZABRANJENI_PUNI_E2E_FLAGOVI = new Set([
  '--grep',
  '-g',
  '--grep-invert',
  '--project',
  '--shard',
  '--max-failures',
  '--last-failed',
  '--only-changed',
]);

/** @typedef {{ naziv: string, status: string, trajanjeMs: number, detalj?: string }} Korak */

function ispisiPomoc() {
  console.log(`Lokalni CI — Kaladont

Upotreba:
  pnpm ci:brzi
  pnpm ci:test -- <vitest filter>     # filter obavezan
  pnpm ci:e2e -- [playwright args]   # bez args = puni suite
  pnpm ci:lokalni
  pnpm ci:puni
  pnpm ci:lokalni -- --provjera      # samo preduvjeti, bez mutacija

Statusi: PROŠLO | PALO | BLOKIRANO | NIJE POKRENUTO | NIJE PRIMJENJIVO
`);
}

/**
 * @param {string[]} argv
 */
export function parsirajArgumente(argv) {
  const args = [...argv];
  let profil = 'lokalni';
  let provjera = false;
  if (args[0] && !args[0].startsWith('-')) {
    profil = args.shift();
  }
  if (!PROFILI.has(profil)) {
    throw new Error(`Nepoznat profil: ${profil}. Dopušteno: ${[...PROFILI].join(', ')}`);
  }
  const filtered = [];
  for (const a of args) {
    if (a === '--provjera' || a === '--help' || a === '-h') {
      if (a === '--help' || a === '-h') return { profil, provjera, help: true, ostatak: [] };
      provjera = true;
      continue;
    }
    filtered.push(a);
  }
  return { profil, provjera, help: false, ostatak: filtered };
}

/**
 * @param {string[]} args
 * @param {{ puniSuite: boolean }} opcije
 */
export function validirajE2eArgumente(args, opcije) {
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    const kljuc = a.includes('=') ? a.slice(0, a.indexOf('=')) : a;
    if (ZABRANJENI_E2E_FLAGOVI.has(kljuc)) {
      throw new Error(`E2E argument nije dopušten u lokalnom CI-ju: ${kljuc}`);
    }
    if (opcije.puniSuite && ZABRANJENI_PUNI_E2E_FLAGOVI.has(kljuc)) {
      throw new Error(`U punom E2E profilu nije dopušteno skraćivanje suitea: ${kljuc}`);
    }
  }
  return args;
}

/**
 * @param {NodeJS.ProcessEnv} baza
 * @param {Record<string, string | undefined>} dodatno
 */
export function sastaviTestniEnv(baza, dodatno) {
  const cist = { ...baza };
  // Ukloni naslijeđene aplikacijske tajne; zadrži OS/Path.
  const ukloni = [
    'BAZA_URL',
    'BAZA_URL_MIGRACIJE',
    'BAZA_APP_LOZINKA',
    'EMAIL_API_KLJUC',
    'SESIJA_TAJNA',
    'ADMIN_TAJNI_KLJUC',
    'UMAMI_URL',
    'UMAMI_WEBSITE_ID',
    'PUBLIC_UMAMI_URL',
    'PUBLIC_UMAMI_WEBSITE_ID',
    'STAGING_PRISTUP_SIFRA',
    'PW_TEST_CONNECT_WS_ENDPOINT',
    'PLAYWRIGHT_BROWSERS_PATH',
  ];
  for (const k of ukloni) {
    delete cist[k];
  }
  Object.assign(cist, {
    KALADONT_PRESKOCI_DOTENV: '1',
    KALADONT_LOKALNI_CI: '1',
    NODE_ENV: 'test',
    SESIJA_TAJNA: 'lokalni-ci-sesija-tajna',
    EMAIL_API_KLJUC: '',
    DEV_MAIL: 'dev@example.com',
    NADZOR_EMAIL_OMOGUCEN: 'false',
    UMAMI_URL: '',
    UMAMI_WEBSITE_ID: '',
    PUBLIC_UMAMI_URL: '',
    PUBLIC_UMAMI_WEBSITE_ID: '',
    ADMIN_TAJNI_KLJUC: 'lokalni-ci-admin-tajna',
    ODGODA_POCETKA_PARTIJE_MS: '0',
    JAVNA_ADRESA: 'http://127.0.0.1:3001',
    ...dodatno,
  });
  return cist;
}

/**
 * @param {string} root
 * @param {string[]} pnpmArgs
 * @param {NodeJS.ProcessEnv} env
 * @param {{ cwd?: string }} [opcije]
 */
function pronadjiPnpmCli() {
  const kandidati = [];
  try {
    kandidati.push(path.join(path.dirname(require.resolve('pnpm/package.json')), 'bin', 'pnpm.cjs'));
  } catch {
    // nije lokalna ovisnost
  }
  if (process.env.PNPM_HOME) {
    kandidati.push(path.join(process.env.PNPM_HOME, 'pnpm.cjs'));
  }
  // npm global (Windows tipično Roaming/npm/node_modules/pnpm)
  const npmGlobal = process.env.APPDATA
    ? path.join(process.env.APPDATA, 'npm', 'node_modules', 'pnpm', 'bin', 'pnpm.cjs')
    : null;
  if (npmGlobal) kandidati.push(npmGlobal);
  for (const k of kandidati) {
    if (k && fs.existsSync(k)) return k;
  }
  return null;
}

function pokreniPnpm(root, pnpmArgs, env, opcije = {}) {
  return new Promise((resolve, reject) => {
    const pnpmCli = pronadjiPnpmCli();
    const dijete = pnpmCli
      ? spawn(process.execPath, [pnpmCli, ...pnpmArgs], {
          cwd: opcije.cwd ?? root,
          env,
          stdio: ['ignore', 'pipe', 'pipe'],
          windowsHide: true,
        })
      : spawn(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', pnpmArgs, {
          cwd: opcije.cwd ?? root,
          env,
          stdio: ['ignore', 'pipe', 'pipe'],
          shell: process.platform === 'win32',
          windowsHide: true,
        });
    let stdout = '';
    let stderr = '';
    dijete.stdout.on('data', (d) => {
      const t = d.toString();
      stdout += t;
      process.stdout.write(redaktirajTekst(t));
    });
    dijete.stderr.on('data', (d) => {
      const t = d.toString();
      stderr += t;
      process.stderr.write(redaktirajTekst(t));
    });
    dijete.on('error', reject);
    dijete.on('close', (kod, signal) => {
      resolve({ kod: kod ?? 1, signal, stdout, stderr });
    });
  });
}

/**
 * @param {string} root
 * @param {string[]} args
 * @param {NodeJS.ProcessEnv} env
 */
function pokreniPlaywright(root, args, env) {
  return pokreniPnpm(root, ['exec', 'playwright', 'test', ...args], env);
}

/**
 * @param {string} root
 * @param {string[]} args
 * @param {NodeJS.ProcessEnv} env
 */
function pokreniBash(root, args, env) {
  return new Promise((resolve, reject) => {
    const bash =
      process.platform === 'win32'
        ? 'C:\\Program Files\\Git\\bin\\bash.exe'
        : 'bash';
    const dijete = spawn(bash, args, {
      cwd: root,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    dijete.stdout.on('data', (d) => {
      const t = d.toString();
      stdout += t;
      process.stdout.write(redaktirajTekst(t));
    });
    dijete.stderr.on('data', (d) => {
      const t = d.toString();
      stderr += t;
      process.stderr.write(redaktirajTekst(t));
    });
    dijete.on('error', (e) => reject(e));
    dijete.on('close', (kod) => resolve({ kod: kod ?? 1, stdout, stderr }));
  });
}

function postojiNaredba(ime) {
  return new Promise((resolve) => {
    const jeWin = process.platform === 'win32';
    const dijete = spawn(jeWin ? 'where.exe' : 'which', [ime], {
      stdio: 'ignore',
      shell: false,
      windowsHide: true,
    });
    dijete.on('error', () => resolve(false));
    dijete.on('close', (kod) => resolve(kod === 0));
  });
}

/**
 * @param {Korak[]} koraci
 * @param {string} naziv
 * @param {() => Promise<{ status: string, detalj?: string }>} fn
 */
async function izvrsiKorak(koraci, naziv, fn) {
  const t0 = Date.now();
  process.stdout.write(`\n── ${naziv} ──\n`);
  try {
    const r = await fn();
    const korak = {
      naziv,
      status: r.status,
      trajanjeMs: Date.now() - t0,
      detalj: r.detalj,
    };
    koraci.push(korak);
    console.log(
      `← ${naziv}: ${korak.status} (${(korak.trajanjeMs / 1000).toFixed(1)} s)${r.detalj ? ` — ${r.detalj}` : ''}`,
    );
    return korak;
  } catch (e) {
    const poruka = e instanceof Error ? e.message : String(e);
    const korak = {
      naziv,
      status: STATUS.PALO,
      trajanjeMs: Date.now() - t0,
      detalj: poruka,
    };
    koraci.push(korak);
    console.error(`← ${naziv}: ${STATUS.PALO} — ${redaktirajTekst(poruka)}`);
    return korak;
  }
}

/**
 * @param {{
 *   root: string,
 *   profil: string,
 *   runId: string,
 *   koraci: Korak[],
 *   sha: string,
 *   stablo: string,
 * }} ctx
 */
function zapisiSazetak(ctx) {
  const dir = path.join(ctx.root, 'test-results', 'lokalni-ci', ctx.runId);
  fs.mkdirSync(dir, { recursive: true });
  // NIJE POKRENUTO nakon pada je očekivano — rezultat je PALO ako ima PALO/BLOKIRANO
  const blokiran = ctx.koraci.some((k) => k.status === STATUS.BLOKIRANO);
  const pao = ctx.koraci.some((k) => k.status === STATUS.PALO);
  const rezultat = pao ? STATUS.PALO : blokiran ? STATUS.BLOKIRANO : STATUS.PROSLO;
  const linije = [
    `Lokalni CI | profil: ${ctx.profil} | SHA: ${ctx.sha} | radno stablo: ${ctx.stablo}`,
    ...ctx.koraci.map((k) => {
      const sec = (k.trajanjeMs / 1000).toFixed(0).padStart(5);
      return `  ${k.naziv.padEnd(28)} ${k.status.padEnd(14)} ${sec} s${k.detalj ? `  ${k.detalj}` : ''}`;
    }),
    `REZULTAT: ${rezultat} | izlazni kod: ${rezultat === STATUS.PROSLO ? 0 : 1}`,
  ];
  const txt = linije.join('\n') + '\n';
  fs.writeFileSync(path.join(dir, 'sazetak.txt'), txt, 'utf8');
  fs.writeFileSync(
    path.join(dir, 'sazetak.json'),
    JSON.stringify(
      {
        profil: ctx.profil,
        runId: ctx.runId,
        sha: ctx.sha,
        stablo: ctx.stablo,
        rezultat,
        koraci: ctx.koraci,
      },
      null,
      2,
    ),
    'utf8',
  );
  console.log(`\n${txt}`);
  console.log(`Izvještaj: ${path.join(dir, 'sazetak.txt')}`);
  return { rezultat, dir };
}

async function gitShaAsync(root) {
  const r = await new Promise((resolve) => {
    const d = spawn('git', ['rev-parse', '--short', 'HEAD'], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    });
    let o = '';
    d.stdout.on('data', (x) => {
      o += x;
    });
    d.on('close', () => resolve(o.trim() || 'nepoznat'));
    d.on('error', () => resolve('nepoznat'));
  });
  return r;
}

async function gitStablo(root) {
  return new Promise((resolve) => {
    const d = spawn('git', ['status', '--porcelain'], {
      cwd: root,
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    });
    let o = '';
    d.stdout.on('data', (x) => {
      o += x;
    });
    d.on('close', () => resolve(o.trim() ? 'prljavo' : 'čisto'));
    d.on('error', () => resolve('nepoznato'));
  });
}

/**
 * @param {string} root
 * @param {string} maintenanceUrl
 * @param {string} runId
 * @param {string} faza
 * @param {Korak[]} koraci
 */
async function pripremiBazu(root, maintenanceUrl, runId, faza, koraci) {
  const ime = generirajImeBaze(faza, runId);
  /** @type {string | null} */
  let url = null;
  const korak = await izvrsiKorak(koraci, `Priprema baze ${faza}`, async () => {
    url = await stvoriPrivremenuBazu(maintenanceUrl, ime, {
      runId,
      vlasnik: CI_ULOGA,
    });
    return { status: STATUS.PROSLO, detalj: ime };
  });
  if (korak.status !== STATUS.PROSLO || !url) {
    return { ok: false, ime, url: null };
  }
  return { ok: true, ime, url };
}

/**
 * @param {string} root
 * @param {string} bazaUrl
 * @param {NodeJS.ProcessEnv} bazniEnv
 * @param {Korak[]} koraci
 * @param {string} oznaka
 */
async function migracijeIFixture(root, bazaUrl, bazniEnv, koraci, oznaka) {
  const env = sastaviTestniEnv(bazniEnv, {
    BAZA_URL: bazaUrl,
    BAZA_URL_MIGRACIJE: bazaUrl,
  });
  let k = await izvrsiKorak(koraci, `${oznaka}: shared build`, async () => {
    const r = await pokreniPnpm(root, ['--filter', 'zajednicko', 'build'], env);
    return { status: r.kod === 0 ? STATUS.PROSLO : STATUS.PALO, detalj: `exit ${r.kod}` };
  });
  if (k.status !== STATUS.PROSLO) return false;

  k = await izvrsiKorak(koraci, `${oznaka}: migracije`, async () => {
    const r = await pokreniPnpm(root, ['--filter', 'posluzitelj', 'migracije'], env);
    return { status: r.kod === 0 ? STATUS.PROSLO : STATUS.PALO, detalj: `exit ${r.kod}` };
  });
  if (k.status !== STATUS.PROSLO) return false;

  k = await izvrsiKorak(koraci, `${oznaka}: ci-fixture`, async () => {
    const r = await pokreniPnpm(root, ['--filter', 'posluzitelj', 'ci-fixture'], env);
    return { status: r.kod === 0 ? STATUS.PROSLO : STATUS.PALO, detalj: `exit ${r.kod}` };
  });
  return k.status === STATUS.PROSLO;
}

async function main() {
  const rawArgs = process.argv.slice(2);
  let parsiran;
  try {
    parsiran = parsirajArgumente(rawArgs);
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
    return;
  }
  if (parsiran.help) {
    ispisiPomoc();
    return;
  }

  const root = korijenRepozitorija();
  const runId = noviRunId();
  const koraci = /** @type {Korak[]} */ ([]);
  /** @type {string[]} */
  const stvoreneBaze = [];
  let maintenanceUrl = '';
  let lockZauzet = false;
  const tStart = Date.now();

  const cleanup = async () => {
    for (const ime of [...stvoreneBaze].reverse()) {
      try {
        if (maintenanceUrl) {
          await obrisiPrivremenuBazu(maintenanceUrl, ime, {
            runId,
            vlasnik: CI_ULOGA,
          });
          console.log(`Obrisana baza ${ime}`);
        }
      } catch (e) {
        console.error(
          `Cleanup baze ${ime} nije uspio: ${redaktirajTekst(e instanceof Error ? e.message : String(e))}. Obriši ručno ako treba.`,
        );
      }
    }
    if (lockZauzet) oslobodiLock(root, runId);
  };

  const naSignal = async () => {
    console.error('\nPrekid — čišćenje…');
    await cleanup();
    process.exit(1);
  };
  process.on('SIGINT', () => {
    void naSignal();
  });
  process.on('SIGTERM', () => {
    void naSignal();
  });

  try {
    const sha = await gitShaAsync(root);
    const stablo = await gitStablo(root);
    console.log(
      `Lokalni CI | profil: ${parsiran.profil} | run: ${runId} | SHA: ${sha} | stablo: ${stablo}`,
    );

    // Preflight verzije
    await izvrsiKorak(koraci, 'Preflight Node/pnpm', async () => {
      const major = Number(process.versions.node.split('.')[0]);
      if (major < 22) {
        return { status: STATUS.BLOKIRANO, detalj: `Node ${process.version}, treba >=22` };
      }
      return { status: STATUS.PROSLO, detalj: `Node ${process.version}` };
    });
    if (koraci.at(-1)?.status === STATUS.BLOKIRANO) {
      zapisiSazetak({ root, profil: parsiran.profil, runId, koraci, sha, stablo });
      process.exitCode = 1;
      return;
    }

    const trebaBazu = parsiran.profil !== 'brzi';
    const trebaE2e =
      parsiran.profil === 'e2e' ||
      parsiran.profil === 'lokalni' ||
      parsiran.profil === 'puni';
    const trebaPortove = trebaE2e && !parsiran.provjera;

    if (trebaBazu || parsiran.provjera) {
      await izvrsiKorak(koraci, 'Preflight CI DB URL', async () => {
        const { url, izvor } = ucitajCiDbUrl(root);
        validirajCiMaintenanceUrl(url);
        maintenanceUrl = url;
        return {
          status: STATUS.PROSLO,
          detalj: `${izvor}: ${redaktirajUrl(url)}`,
        };
      });
      if (koraci.at(-1)?.status !== STATUS.PROSLO) {
        zapisiSazetak({ root, profil: parsiran.profil, runId, koraci, sha, stablo });
        process.exitCode = 1;
        return;
      }

      await izvrsiKorak(koraci, 'Preflight PostgreSQL', async () => {
        const { major } = await provjeriPostgresMajor(maintenanceUrl);
        if (major !== 16) {
          return {
            status: STATUS.BLOKIRANO,
            detalj: `PostgreSQL major ${major}, CI koristi 16`,
          };
        }
        return { status: STATUS.PROSLO, detalj: `major ${major}` };
      });
      if (koraci.at(-1)?.status !== STATUS.PROSLO) {
        zapisiSazetak({ root, profil: parsiran.profil, runId, koraci, sha, stablo });
        process.exitCode = 1;
        return;
      }
    }

    if (trebaPortove) {
      await izvrsiKorak(koraci, 'Preflight portovi 3001/5174', async () => {
        const z1 = await portZauzet(3001);
        const z2 = await portZauzet(5174);
        if (z1 || z2) {
          return {
            status: STATUS.BLOKIRANO,
            detalj: `Zauzeto: ${[z1 ? '3001' : null, z2 ? '5174' : null].filter(Boolean).join(', ')}. Ne diram 3000/5173.`,
          };
        }
        return { status: STATUS.PROSLO };
      });
      if (koraci.at(-1)?.status !== STATUS.PROSLO) {
        zapisiSazetak({ root, profil: parsiran.profil, runId, koraci, sha, stablo });
        process.exitCode = 1;
        return;
      }
    }

    if (parsiran.provjera) {
      await izvrsiKorak(koraci, 'Plan koraka', async () => {
        return {
          status: STATUS.PROSLO,
          detalj: `Profil ${parsiran.profil} — bez mutacija`,
        };
      });
      zapisiSazetak({ root, profil: parsiran.profil, runId, koraci, sha, stablo });
      return;
    }

    try {
      zauzmiLock(root, runId);
      lockZauzet = true;
    } catch (e) {
      await izvrsiKorak(koraci, 'Lock', async () => ({
        status: STATUS.BLOKIRANO,
        detalj: e instanceof Error ? e.message : String(e),
      }));
      zapisiSazetak({ root, profil: parsiran.profil, runId, koraci, sha, stablo });
      process.exitCode = 1;
      return;
    }

    const bazniEnv = process.env;

    // ——— brzi ———
    if (parsiran.profil === 'brzi') {
      const env = sastaviTestniEnv(bazniEnv, {});
      for (const [naziv, args] of [
        ['Shared build', ['--filter', 'zajednicko', 'build']],
        ['Lint', ['lint']],
        ['Web check', ['--filter', 'web', 'check']],
        ['Poslužitelj build', ['--filter', 'posluzitelj', 'build']],
      ]) {
        const k = await izvrsiKorak(koraci, naziv, async () => {
          const r = await pokreniPnpm(root, args, env);
          return { status: r.kod === 0 ? STATUS.PROSLO : STATUS.PALO, detalj: `exit ${r.kod}` };
        });
        if (k.status !== STATUS.PROSLO) break;
      }
      const { rezultat } = zapisiSazetak({
        root,
        profil: parsiran.profil,
        runId,
        koraci,
        sha,
        stablo,
      });
      process.exitCode = rezultat === STATUS.PROSLO ? 0 : 1;
      await cleanup();
      return;
    }

    // ——— test (ciljani) ———
    if (parsiran.profil === 'test') {
      if (parsiran.ostatak.length === 0) {
        await izvrsiKorak(koraci, 'Filter', async () => ({
          status: STATUS.BLOKIRANO,
          detalj: 'ci:test zahtijeva filter, npr. pnpm ci:test -- test/motor-partije.test.ts',
        }));
        zapisiSazetak({ root, profil: parsiran.profil, runId, koraci, sha, stablo });
        process.exitCode = 1;
        await cleanup();
        return;
      }
      const priprema = await pripremiBazu(root, maintenanceUrl, runId, 'kod', koraci);
      if (!priprema.ok || !priprema.url) {
        zapisiSazetak({ root, profil: parsiran.profil, runId, koraci, sha, stablo });
        process.exitCode = 1;
        await cleanup();
        return;
      }
      stvoreneBaze.push(priprema.ime);
      const okPrep = await migracijeIFixture(root, priprema.url, bazniEnv, koraci, 'kod');
      if (!okPrep) {
        zapisiSazetak({ root, profil: parsiran.profil, runId, koraci, sha, stablo });
        process.exitCode = 1;
        await cleanup();
        return;
      }
      const env = sastaviTestniEnv(bazniEnv, {
        BAZA_URL: priprema.url,
        BAZA_URL_MIGRACIJE: priprema.url,
      });
      await izvrsiKorak(koraci, 'Vitest (ciljani)', async () => {
        const r = await pokreniPnpm(
          root,
          ['--filter', 'posluzitelj', 'test', '--', ...parsiran.ostatak],
          env,
        );
        return { status: r.kod === 0 ? STATUS.PROSLO : STATUS.PALO, detalj: `exit ${r.kod}` };
      });
      const { rezultat } = zapisiSazetak({
        root,
        profil: parsiran.profil,
        runId,
        koraci,
        sha,
        stablo,
      });
      process.exitCode = rezultat === STATUS.PROSLO ? 0 : 1;
      await cleanup();
      return;
    }

    // zajednički: lokalni / puni / e2e
    let kodUrl = null;
    let e2eUrl = null;

    if (parsiran.profil === 'lokalni' || parsiran.profil === 'puni') {
      await izvrsiKorak(koraci, 'Frozen install', async () => {
        const r = await pokreniPnpm(root, ['install', '--frozen-lockfile'], sastaviTestniEnv(bazniEnv, {
          NODE_ENV: 'development',
        }));
        return { status: r.kod === 0 ? STATUS.PROSLO : STATUS.PALO, detalj: `exit ${r.kod}` };
      });
      if (koraci.at(-1)?.status !== STATUS.PROSLO) {
        zapisiSazetak({ root, profil: parsiran.profil, runId, koraci, sha, stablo });
        process.exitCode = 1;
        await cleanup();
        return;
      }

      // Dodatne operativne provjere prije dugog E2E (za puni)
      if (parsiran.profil === 'puni') {
        const upgradePriprema = await pripremiBazu(
          root,
          maintenanceUrl,
          runId,
          'upgrade',
          koraci,
        );
        if (upgradePriprema.ok && upgradePriprema.url) {
          stvoreneBaze.push(upgradePriprema.ime);
          const envUp = sastaviTestniEnv(bazniEnv, {
            BAZA_URL: upgradePriprema.url,
            BAZA_URL_MIGRACIJE: upgradePriprema.url,
          });
          await izvrsiKorak(koraci, 'Migracije upgrade-test', async () => {
            const r = await pokreniPnpm(
              root,
              ['--filter', 'posluzitelj', 'migracije:upgrade-test', '--', '--zadnje=2'],
              envUp,
            );
            return { status: r.kod === 0 ? STATUS.PROSLO : STATUS.PALO, detalj: `exit ${r.kod}` };
          });
        }

        await izvrsiKorak(koraci, 'pnpm audit critical', async () => {
          const r = await pokreniPnpm(root, ['audit', '--audit-level', 'critical'], bazniEnv);
          return { status: r.kod === 0 ? STATUS.PROSLO : STATUS.PALO, detalj: `exit ${r.kod}` };
        });

        const imaBash = fs.existsSync('C:\\Program Files\\Git\\bin\\bash.exe') || (await postojiNaredba('bash'));
        const imaJq = await postojiNaredba('jq');
        if (!imaBash || !imaJq) {
          await izvrsiKorak(koraci, 'Backup/izdanja shell testovi', async () => ({
            status: STATUS.BLOKIRANO,
            detalj: `Nedostaje ${!imaBash ? 'bash' : 'jq'}`,
          }));
        } else {
          await izvrsiKorak(koraci, 'Backup testovi', async () => {
            const r = await pokreniBash(root, ['skripte/testovi/backup/pokreni.sh'], bazniEnv);
            return { status: r.kod === 0 ? STATUS.PROSLO : STATUS.PALO, detalj: `exit ${r.kod}` };
          });
          await izvrsiKorak(koraci, 'Izdanja testovi', async () => {
            const r = await pokreniBash(root, ['skripte/testovi/izdanja/pokreni.sh'], bazniEnv);
            return { status: r.kod === 0 ? STATUS.PROSLO : STATUS.PALO, detalj: `exit ${r.kod}` };
          });
        }

        const imaActionlint = await postojiNaredba('actionlint');
        if (!imaActionlint) {
          await izvrsiKorak(koraci, 'actionlint', async () => ({
            status: STATUS.BLOKIRANO,
            detalj: 'actionlint nije u PATH (GitHub CI pin 1.7.12 ostaje autoritet)',
          }));
        } else {
          await izvrsiKorak(koraci, 'actionlint', async () => {
            const r = await new Promise((resolve, reject) => {
              const d = spawn('actionlint', ['-color', '-shellcheck='], {
                cwd: root,
                stdio: ['ignore', 'pipe', 'pipe'],
                windowsHide: true,
              });
              let out = '';
              d.stdout.on('data', (x) => {
                out += x;
                process.stdout.write(x);
              });
              d.stderr.on('data', (x) => {
                out += x;
                process.stderr.write(x);
              });
              d.on('error', reject);
              d.on('close', (kod) => resolve({ kod: kod ?? 1, out }));
            });
            return { status: r.kod === 0 ? STATUS.PROSLO : STATUS.PALO, detalj: `exit ${r.kod}` };
          });
        }

        await izvrsiKorak(koraci, 'Docker image smoke', async () => ({
          status: STATUS.NIJE_PRIMJENJIVO,
          detalj: 'NIJE POKRENUTO — GitHub CI',
        }));
        // Popravi status label for report clarity
        koraci[koraci.length - 1].status = STATUS.NIJE_POKRENUTO;
        koraci[koraci.length - 1].detalj = 'GitHub CI';
      }

      const kodPriprema = await pripremiBazu(root, maintenanceUrl, runId, 'kod', koraci);
      if (!kodPriprema.ok || !kodPriprema.url) {
        zapisiSazetak({ root, profil: parsiran.profil, runId, koraci, sha, stablo });
        process.exitCode = 1;
        await cleanup();
        return;
      }
      stvoreneBaze.push(kodPriprema.ime);
      kodUrl = kodPriprema.url;
      const okPrep = await migracijeIFixture(root, kodUrl, bazniEnv, koraci, 'kod');
      if (!okPrep) {
        zapisiSazetak({ root, profil: parsiran.profil, runId, koraci, sha, stablo });
        process.exitCode = 1;
        await cleanup();
        return;
      }

      const envKod = sastaviTestniEnv(bazniEnv, {
        BAZA_URL: kodUrl,
        BAZA_URL_MIGRACIJE: kodUrl,
      });

      for (const [naziv, args] of [
        ['Lint', ['lint']],
        ['Vitest (svi paketi)', ['test']],
        ['Web check', ['--filter', 'web', 'check']],
        ['Build', ['build']],
      ]) {
        const k = await izvrsiKorak(koraci, naziv, async () => {
          const r = await pokreniPnpm(root, args, envKod);
          return { status: r.kod === 0 ? STATUS.PROSLO : STATUS.PALO, detalj: `exit ${r.kod}` };
        });
        if (k.status !== STATUS.PROSLO) {
          zapisiSazetak({ root, profil: parsiran.profil, runId, koraci, sha, stablo });
          process.exitCode = 1;
          await cleanup();
          return;
        }
      }
    }

    // E2E faza
    if (trebaE2e) {
      let e2eArgs;
      try {
        const puniSuite =
          parsiran.profil !== 'e2e' || parsiran.ostatak.length === 0;
        e2eArgs = validirajE2eArgumente(parsiran.ostatak, { puniSuite });
      } catch (e) {
        await izvrsiKorak(koraci, 'E2E argumenti', async () => ({
          status: STATUS.PALO,
          detalj: e instanceof Error ? e.message : String(e),
        }));
        zapisiSazetak({ root, profil: parsiran.profil, runId, koraci, sha, stablo });
        process.exitCode = 1;
        await cleanup();
        return;
      }

      const e2ePriprema = await pripremiBazu(root, maintenanceUrl, runId, 'e2e', koraci);
      if (!e2ePriprema.ok || !e2ePriprema.url) {
        zapisiSazetak({ root, profil: parsiran.profil, runId, koraci, sha, stablo });
        process.exitCode = 1;
        await cleanup();
        return;
      }
      stvoreneBaze.push(e2ePriprema.ime);
      e2eUrl = e2ePriprema.url;
      const okE2ePrep = await migracijeIFixture(root, e2eUrl, bazniEnv, koraci, 'e2e');
      if (!okE2ePrep) {
        zapisiSazetak({ root, profil: parsiran.profil, runId, koraci, sha, stablo });
        process.exitCode = 1;
        await cleanup();
        return;
      }

      const envE2e = sastaviTestniEnv(bazniEnv, {
        CI: 'true',
        BAZA_URL: e2eUrl,
        BAZA_URL_MIGRACIJE: e2eUrl,
        TOLERANCIJA_PREKIDA_MS: '10000',
      });

      const pwArgs =
        e2eArgs.length === 0
          ? [
              '--config=playwright.config.ts',
              '--workers=1',
              '--retries=1',
              '--fail-on-flaky-tests',
              '--reporter=list',
            ]
          : ['--config=playwright.config.ts', '--workers=1', ...e2eArgs];

      await izvrsiKorak(koraci, 'Playwright', async () => {
        const r = await pokreniPlaywright(root, pwArgs, envE2e);
        return { status: r.kod === 0 ? STATUS.PROSLO : STATUS.PALO, detalj: `exit ${r.kod}` };
      });
    }

    // Za puni: ako je bilo BLOKIRANO (actionlint), rezultat nije čist prolaz
    const { rezultat } = zapisiSazetak({
      root,
      profil: parsiran.profil,
      runId,
      koraci,
      sha,
      stablo,
    });
    console.log(`Ukupno: ${((Date.now() - tStart) / 1000).toFixed(1)} s`);
    process.exitCode = rezultat === STATUS.PROSLO ? 0 : 1;
    await cleanup();
  } catch (e) {
    console.error(redaktirajTekst(e instanceof Error ? e.stack || e.message : String(e)));
    process.exitCode = 1;
    await cleanup();
  }
}

if (
  process.argv[1] &&
  path.resolve(fileURLToPath(import.meta.url)) === path.resolve(process.argv[1])
) {
  void main();
}
