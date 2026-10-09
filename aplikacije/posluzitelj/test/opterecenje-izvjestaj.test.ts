import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PassThrough } from 'node:stream';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { odobriRazinuPokusa, zabiljeziRezultatStagingTesta } from '../src/cli/opterecenje-postavke.js';
import { prikaziStatusPokusa } from '../src/cli/opterecenje-status.js';
import { finalizirajIzvjestaj, formatirajNapredak, formatirajSazetak, spremiIzvjestaj, type IzvjestajPokusa } from '../src/cli/opterecenje-izvjestaj.js';

const izvjestaj: IzvjestajPokusa = {
  verzijaFormata: 1, runId: 'test', vrijeme: new Date().toISOString(), cilj: 'http://localhost:3000',
  razina: 13, lokalniSmoke: true, pokrenuto: true, profilId: 'smoke', digest: 'lokalno',
  ishod: 'PASS', razlog: null, provjere: { p95Potez: true }, upozorenja: [],
};

describe('izvještaj opterećenja', () => {
  it('sažetak predtesta popune prikazuje vremena i sastav umjesto metrika miješanog testa', () => {
    const tekst = formatirajSazetak({
      ...izvjestaj, vrsta: 'popuna', razina: 2, sljedecaRazina: null, zakljuceno: true,
      provjere: { cekanjeDvoboja: true, sastavCetveroboja: false },
      popuna: {
        brojPoModu: 1, pokrenutePartije: 2, zavrsenePartije: 2,
        cekanjeDvobojaMs: { min: 30_070, max: 30_070 }, cekanjeCetverobojaMs: { min: 40_030, max: 40_030 },
        fondSlobodniPocetak: 40, fondSlobodniKraj: 40, botoviUPartijiKraj: 0, iscrpljenjaDelta: 0, istekBotovaDelta: 0, tehnickeGreskeBotovaDelta: 0,
        mjerenja: [{ mod: 'cetiri_igraca', cekanjeMs: 40_030, brojBotova: 3, rezervacijeMs: [20_010, 30_000], potezaBota: 49, zavrsena: true }],
        greskeGeneratora: [],
      },
    });
    expect(tekst).toContain('PREDTEST POPUNE PROŠAO');
    expect(tekst).toContain('četveroboj: početak 40,03 s, botova 3, rezervacije 20,01 s, 30 s');
    expect(tekst).toContain('NEUSPJEH: Četveroboj: točno 3 bota');
    expect(tekst).toContain('ne otključava razine miješanog testa');
    expect(tekst).not.toContain('Stvarno držanje');
    expect(tekst).not.toContain('Sljedeća moguća razina');
  });

  it('CLI odbija neinteraktivni staging prije snimke i mrežne pripreme', () => {
    const rezultat = spawnSync(process.execPath, [
      '--import', 'tsx', 'src/cli/opterecenje-mijesano.ts', '--adresa=https://staging.kaladont.hr',
      '--klijenti=100', '--trajanje-ms=600000', `--rjecnik-snimka=${path.join(tmpdir(), 'nepostojeca-snimka.jsonl.gz')}`,
    ], { cwd: fileURLToPath(new URL('../', import.meta.url)), encoding: 'utf8', timeout: 10_000 });
    expect(rezultat.status).toBe(130);
    expect(rezultat.stderr).toContain('priprema nije kontaktirala staging');
    expect(rezultat.stdout).not.toContain('Rampa');
  });
  it.each([100, 10_000])('status potvrđuje samu dovršenu razinu %i', async (razina) => {
    const direktorij = await mkdtemp(path.join(tmpdir(), 'status-staging-test-'));
    const runId = randomUUID();
    const zapis = { ...izvjestaj, runId, razina, lokalniSmoke: false, cilj: 'https://staging.kaladont.hr', profilId: 'mijesani-test', zakljuceno: true };
    const redci: string[] = [];
    try {
      await spremiIzvjestaj(zapis, path.join(direktorij, runId));
      await zabiljeziRezultatStagingTesta(zapis.cilj, razina, 'PASS', path.join(direktorij, 'potvrde'), Date.now(), zapis.profilId, zapis.digest,
        { runId, izvjestajPutanja: path.join(direktorij, runId, 'rezultat.json') });
      await prikaziStatusPokusa(direktorij, (tekst) => redci.push(tekst));
      expect(redci.join('\n')).toContain(`Najviša važeća potvrda ovog profila: ${razina}`);
      expect(redci.join('\n')).toContain(razina === 100 ? 'POKRENI 500' : 'Dosegnuta je posljednja razina 10000');
    } finally { await rm(direktorij, { recursive: true, force: true }); }
  });
  it('ne koristi nedovršen zapis kao dokaz prolaza', async () => {
    const direktorij = await mkdtemp(path.join(tmpdir(), 'status-nedovrsen-'));
    const runId = randomUUID();
    const redci: string[] = [];
    try {
      await spremiIzvjestaj({ ...izvjestaj, runId, zakljuceno: false }, path.join(direktorij, runId));
      await prikaziStatusPokusa(direktorij, (tekst) => redci.push(tekst));
      expect(redci.join('\n')).toContain('NEDOVRŠEN ZAPIS');
      expect(redci.join('\n')).not.toContain('TEST PROŠAO');
    } finally { await rm(direktorij, { recursive: true, force: true }); }
  });
  it('pregled lokalnih pokusa ne kontaktira mrežu niti izdaje staging odobrenje', async () => {
    const direktorij = await mkdtemp(path.join(tmpdir(), 'status-test-'));
    const runId = randomUUID();
    const mreza = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Mreža nije dopuštena.'));
    const redci: string[] = [];
    try {
      await spremiIzvjestaj({ ...izvjestaj, runId, zakljuceno: true }, path.join(direktorij, runId));
      await prikaziStatusPokusa(direktorij, (tekst) => redci.push(tekst));
      expect(redci.join('\n')).toContain('Lokalni smoke ne otključava staging');
      expect(mreza).not.toHaveBeenCalled();
    } finally { mreza.mockRestore(); await rm(direktorij, { recursive: true, force: true }); }
  });
  it.each(['', 'DA', 'POKRENI 1000', ' POKRENI 500'])('ne pokreće provjere ni opterećenje za unos %s', async (unos) => {
    const ulaz = Object.assign(new PassThrough(), { isTTY: true });
    const ponovnoProvjeri = vi.fn(async () => undefined);
    const odobrenje = odobriRazinuPokusa(500, ponovnoProvjeri, { ulaz, izlaz: new PassThrough() });
    ulaz.end(`${unos}\n`);
    await expect(odobrenje).rejects.toThrow();
    expect(ponovnoProvjeri).not.toHaveBeenCalled();
  });
  it('traži točnu potvrdu i prije nastavka ponovno provjerava uvjete', async () => {
    const ulaz = Object.assign(new PassThrough(), { isTTY: true });
    const ponovnoProvjeri = vi.fn(async () => undefined);
    const odobrenje = odobriRazinuPokusa(500, ponovnoProvjeri, { ulaz, izlaz: new PassThrough() });
    expect(ponovnoProvjeri).not.toHaveBeenCalled();
    ulaz.end('POKRENI 500\n');
    await odobrenje;
    expect(ponovnoProvjeri).toHaveBeenCalledOnce();
  });
  it('otkazuje na EOF, neinteraktivni ulaz i prekid', async () => {
    const ponovnoProvjeri = vi.fn(async () => undefined);
    const ulaz = Object.assign(new PassThrough(), { isTTY: true });
    const odobrenje = odobriRazinuPokusa(100, ponovnoProvjeri, { ulaz, izlaz: new PassThrough() });
    ulaz.end();
    await expect(odobrenje).rejects.toThrow();
    await expect(odobriRazinuPokusa(100, ponovnoProvjeri, { ulaz: new PassThrough() })).rejects.toThrow('interaktivni');
    const kontroler = new AbortController();
    const prekinuto = odobriRazinuPokusa(100, ponovnoProvjeri, {
      ulaz: Object.assign(new PassThrough(), { isTTY: true }), izlaz: new PassThrough(), signal: kontroler.signal,
    });
    kontroler.abort();
    await expect(prekinuto).rejects.toThrow();
    expect(ponovnoProvjeri).not.toHaveBeenCalled();
  });
  it('prikazuje hrvatski ishod i nedostupno mjerenje umjesto nule', () => {
    expect(formatirajSazetak(izvjestaj)).toContain('TEST PROŠAO');
    expect(formatirajSazetak(izvjestaj)).toContain('nije dostupno');
    expect(formatirajSazetak({ ...izvjestaj, ishod: 'FAIL' })).toContain('NIJE PROŠAO');
  });
  it('razlikuje nepokrenutu pripremu od pada testa', () => {
    const tekst = formatirajSazetak({ ...izvjestaj, pokrenuto: false, ishod: 'FAIL' });
    expect(tekst).toContain('PRIPREMA NIJE USPJELA');
    expect(tekst).toContain('Prethodne potvrde nisu poništene');
    expect(tekst).not.toContain('TEST NIJE PROŠAO');
  });
  it('ponovna provjera nakon odobrenja mora uspjeti prije leasea i generatora', async () => {
    const ulaz = Object.assign(new PassThrough(), { isTTY: true });
    const lease = vi.fn();
    const generator = vi.fn();
    const pokretanje = (async () => {
      await odobriRazinuPokusa(100, async () => { throw new Error('Digest je promijenjen.'); }, { ulaz, izlaz: new PassThrough() });
      lease(); generator();
    })();
    expect(lease).not.toHaveBeenCalled();
    expect(generator).not.toHaveBeenCalled();
    ulaz.end('POKRENI 100\n');
    await expect(pokretanje).rejects.toThrow('Digest');
    expect(lease).not.toHaveBeenCalled();
    expect(generator).not.toHaveBeenCalled();
  });
  it('razdvaja veze, aktivne igrače i planirani HTTP te upozorava na stari health', () => {
    const tekst = formatirajNapredak({
      faza: 'Mjerenje', protekloMs: 90_000, preostaloMs: null, ciljaniIgraci: 70, planiraniHttp: 30,
      healthStarostMs: 20_000, zavrsenePoVrsti: { dvoboj: 1, javni_cetveroboj: 2, privatni_cetveroboj: 3 },
      botovi: { spojeni: 70, aktivniIgraci: 40, aktivnePartije: 10, zavrsenePartije: 6, tehnickeGreske: 0,
        neocekivaniPrekidi: 0, poStanjima: { red: 10, ispao: 15, rezultati: 5 } },
    });
    expect(tekst).toContain('Veze 70/70; aktivni sudionici 40');
    expect(tekst).toContain('HTTP: planirano 30');
    expect(tekst).toContain('(zastario)');
    expect(tekst).toContain('preostalo u fazi: nije dostupno');
  });
  it('uklanja kontrolne znakove i ne ispisuje NaN kao mjerenje', () => {
    const tekst = formatirajSazetak({ ...izvjestaj, razlog: '\u001b[31mgreška\nredak', http: { p95Ms: NaN } });
    expect(tekst).not.toContain('\u001b');
    expect(tekst).not.toContain('NaN');
    expect(tekst).toContain('greška redak');
  });
  it('pri trajnoj pogrešci zapisa odbija finalizaciju i ne izdaje PASS', async () => {
    const potvrde: string[] = [];
    await expect(finalizirajIzvjestaj(izvjestaj, {
      signal: new AbortController().signal,
      spremi: async () => { throw new Error('disk'); },
      potvrdi: async (zapis) => { potvrde.push(zapis.ishod); },
    })).rejects.toThrow('disk');
    expect(potvrde).toEqual(['FAIL']);
  });
  it('poništava potvrdu pri kasnom prekidu nakon završnog zapisa', async () => {
    const kontroler = new AbortController();
    const potvrde: string[] = [];
    let brojZapisa = 0;
    let ishod = '';
    const rezultat = await finalizirajIzvjestaj(izvjestaj, {
      signal: kontroler.signal,
      spremi: async (zapis) => { ishod = zapis.ishod; if (++brojZapisa === 2) kontroler.abort(); },
      potvrdi: async (zapis) => { potvrde.push(zapis.ishod); },
    });
    expect(rezultat.ishod).toBe('ABORTED');
    expect(potvrde.at(-1)).toBe('ABORTED');
    expect(ishod).toBe('ABORTED');
  });
  it('sprema dosljedni TXT i JSON', async () => {
    const direktorij = await mkdtemp(path.join(tmpdir(), 'izvjestaj-test-'));
    try {
      await spremiIzvjestaj(izvjestaj, direktorij);
      expect(JSON.parse(await readFile(path.join(direktorij, 'rezultat.json'), 'utf8')).ishod).toBe('PASS');
      expect(await readFile(path.join(direktorij, 'sazetak.txt'), 'utf8')).toContain('TEST PROŠAO');
    } finally { await rm(direktorij, { recursive: true, force: true }); }
  });
  it('poništava PASS ako prekid stigne tijekom potvrde', async () => {
    const kontroler = new AbortController();
    const potvrde: string[] = [];
    let zadnjiZapis = '';
    const rezultat = await finalizirajIzvjestaj(izvjestaj, {
      signal: kontroler.signal,
      spremi: async (zapis) => { zadnjiZapis = zapis.ishod; },
      potvrdi: async (zapis) => { potvrde.push(zapis.ishod); kontroler.abort(); },
    });
    expect(rezultat.ishod).toBe('ABORTED');
    expect(zadnjiZapis).toBe('ABORTED');
    expect(potvrde.at(-1)).toBe('ABORTED');
  });
  it('ne otključava razinu ako zapis izvještaja ne uspije', async () => {
    let prvi = true;
    const potvrde: string[] = [];
    const rezultat = await finalizirajIzvjestaj(izvjestaj, {
      signal: new AbortController().signal,
      spremi: async () => { if (prvi) { prvi = false; throw new Error('disk'); } },
      potvrdi: async (zapis) => { potvrde.push(zapis.ishod); },
    });
    expect(rezultat.ishod).toBe('FAIL');
    expect(potvrde).toEqual(['FAIL']);
  });
  it('pogreška čišćenja daje isti FAIL u TXT-u, JSON-u i potvrdi', async () => {
    const direktorij = await mkdtemp(path.join(tmpdir(), 'ciscenje-test-'));
    const potvrde: string[] = [];
    try {
      const rezultat = await finalizirajIzvjestaj(izvjestaj, {
        signal: new AbortController().signal,
        greskeCiscenja: ['Staging lease: oslobađanje nije uspjelo.'],
        spremi: async (zapis) => spremiIzvjestaj(zapis, direktorij),
        potvrdi: async (zapis) => { potvrde.push(zapis.ishod); },
      });
      expect(rezultat.ishod).toBe('FAIL');
      expect(JSON.parse(await readFile(path.join(direktorij, 'rezultat.json'), 'utf8')).ishod).toBe('FAIL');
      expect(await readFile(path.join(direktorij, 'sazetak.txt'), 'utf8')).toContain('TEST NIJE PROŠAO');
      expect(potvrde).toEqual(['FAIL']);
    } finally { await rm(direktorij, { recursive: true, force: true }); }
  });
});