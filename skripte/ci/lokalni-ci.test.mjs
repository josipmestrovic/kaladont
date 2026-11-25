import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CI_ULOGA,
  generirajImeBaze,
  parsirajPostgresUrl,
  redaktirajTekst,
  redaktirajUrl,
  urlZaBazu,
  validirajCiMaintenanceUrl,
} from './lokalna-baza.mjs';
import {
  parsirajArgumente,
  sastaviTestniEnv,
  validirajE2eArgumente,
} from './lokalni-ci.mjs';

describe('lokalna-baza URL zaštite', () => {
  it('U01: ispravan lokalni URL i CI uloga generira ime baze', () => {
    const url =
      'postgresql://kaladont_ci_local:tajna@127.0.0.1:5432/postgres';
    const p = validirajCiMaintenanceUrl(url);
    assert.equal(p.username, CI_ULOGA);
    const ime = generirajImeBaze('kod', 'abc123def');
    assert.match(ime, /^kaladont_ci_local_kod_/);
    const testUrl = urlZaBazu(p, ime);
    assert.match(testUrl, new RegExp(`/${ime}$`));
    assert.doesNotMatch(testUrl, /kaladont_dev/);
  });

  it('U02: odbija kaladont_dev, staging, vanjski host, query override', () => {
    assert.throws(() =>
      validirajCiMaintenanceUrl(
        'postgresql://kaladont_ci_local:x@127.0.0.1:5432/kaladont_dev',
      ),
    );
    assert.throws(() =>
      parsirajPostgresUrl('postgresql://kaladont:x@staging.example:5432/db'),
    );
    assert.throws(() =>
      parsirajPostgresUrl('postgresql://kaladont_ci_local:x@8.8.8.8:5432/postgres'),
    );
    assert.throws(() =>
      parsirajPostgresUrl(
        'postgresql://kaladont_ci_local:x@127.0.0.1:5432/postgres?host=/tmp',
      ),
    );
    assert.throws(() =>
      validirajCiMaintenanceUrl('postgresql://kaladont:x@127.0.0.1:5432/postgres'),
    );
  });

  it('U03: sastaviTestniEnv forsira oba URL-a i skip dotenv', () => {
    const env = sastaviTestniEnv(
      {
        BAZA_URL: 'postgresql://prod@evil/db',
        BAZA_URL_MIGRACIJE: 'postgresql://prod@evil/migrate',
        EMAIL_API_KLJUC: 'stvarni-kljuc',
        PATH: '/usr/bin',
      },
      {
        BAZA_URL: 'postgresql://kaladont_ci_local:x@127.0.0.1:5432/kaladont_ci_local_kod_x',
        BAZA_URL_MIGRACIJE:
          'postgresql://kaladont_ci_local:x@127.0.0.1:5432/kaladont_ci_local_kod_x',
      },
    );
    assert.equal(env.KALADONT_PRESKOCI_DOTENV, '1');
    assert.equal(env.BAZA_URL, env.BAZA_URL_MIGRACIJE);
    assert.equal(env.EMAIL_API_KLJUC, '');
    assert.ok(env.PATH);
    assert.doesNotMatch(env.BAZA_URL_MIGRACIJE, /evil|prod/);
  });

  it('U05: urlZaBazu odbija zabranjena imena', () => {
    const p = validirajCiMaintenanceUrl(
      'postgresql://kaladont_ci_local:x@127.0.0.1:5432/postgres',
    );
    assert.throws(() => urlZaBazu(p, 'kaladont_dev'));
    assert.throws(() => urlZaBazu(p, 'postgres'));
  });

  it('U11: redakcija skriva lozinku', () => {
    const u =
      'postgresql://kaladont_ci_local:super-tajna@127.0.0.1:5432/postgres';
    assert.equal(redaktirajUrl(u).includes('super-tajna'), false);
    assert.equal(redaktirajTekst(`err ${u}`).includes('super-tajna'), false);
  });
});

describe('lokalni-ci CLI', () => {
  it('U08: parsira profil i ostatak s putanjama', () => {
    const p = parsirajArgumente([
      'e2e',
      'e2e/izazovi.spec.ts',
      '--project=desktop-chrome',
    ]);
    assert.equal(p.profil, 'e2e');
    assert.deepEqual(p.ostatak, [
      'e2e/izazovi.spec.ts',
      '--project=desktop-chrome',
    ]);
  });

  it('U09: odbija nedopuštene E2E flagove i --pass-with-no-tests', () => {
    assert.throws(() =>
      validirajE2eArgumente(['--config=other.ts'], { puniSuite: false }),
    );
    assert.throws(() =>
      validirajE2eArgumente(['--pass-with-no-tests'], { puniSuite: false }),
    );
    assert.throws(() =>
      validirajE2eArgumente(['--project=desktop-chrome'], { puniSuite: true }),
    );
    assert.deepEqual(
      validirajE2eArgumente(['e2e/x.spec.ts', '--project=desktop-chrome'], {
        puniSuite: false,
      }),
      ['e2e/x.spec.ts', '--project=desktop-chrome'],
    );
  });

  it('U14: profil brzi ne zahtijeva DB u parseru', () => {
    const p = parsirajArgumente(['brzi']);
    assert.equal(p.profil, 'brzi');
    assert.equal(p.ostatak.length, 0);
  });

  it('U07-ish: nepoznat profil baca grešku', () => {
    assert.throws(() => parsirajArgumente(['nepoznat']));
  });
});
