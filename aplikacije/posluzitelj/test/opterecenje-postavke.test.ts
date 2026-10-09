import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  MAKS_TRAJANJE_STAGING_TESTA_MS,
  MAKS_VELICINA_VALA_STAGING,
  MAKS_RAZMAK_VALA_STAGING_MS,
  MIN_RAZMAK_VALA_STAGING_MS,
  MIN_TRAJANJE_STAGING_TESTA_MS,
  RASPODJELA_LOKALNOG_SMOKE,
  ocijeniOdrzaneVeze,
  odbijProdukcijskuAdresu,
  provjeriNacinPokretanja,
  provjeriPrethodnuRazinuStagingTesta,
  provjeriRampuStagingTesta,
  provjeriScenarijStagingTesta,
  rasporediMijesaniTest,
  validirajAdresuStaginga,
  validirajAdresuLokalnogTesta,
  validirajAdresuLokalnogWeba,
  validirajTrajanjeLokalnogSmokea,
  validirajCiljPokretanja,
  validirajUlazMijesanogTesta,
  validirajUlazStagingTesta,
  validirajZahtjevStagingTesta,
  validirajPreskakanjePrethodneRazine,
  validirajTransportOpterecenja,
  zakljucajStagingTest,
  zabiljeziRezultatStagingTesta,
} from '../src/cli/opterecenje-postavke.js';

describe('validirajAdresuStaginga', () => {
  it('prihvaća samo korijensku HTTPS adresu staginga', () => {
    expect(validirajAdresuStaginga('https://staging.kaladont.hr').origin).toBe(
      'https://staging.kaladont.hr',
    );
  });

  it.each([
    'http://staging.kaladont.hr',
    'https://kaladont.hr',
    'https://drugi.staging.kaladont.hr',
    'https://staging.kaladont.hr:8443',
    'https://staging.kaladont.hr/putanja',
    'https://staging.kaladont.hr/?test=1',
    'https://korisnik@staging.kaladont.hr',
    'nije-adresa',
  ])('odbija adresu %s', (adresa) => {
    expect(() => validirajAdresuStaginga(adresa)).toThrow();
  });

  it.each(['https://kaladont.hr', 'https://www.kaladont.hr'])('odbija produkciju %s', (adresa) => {
    expect(() => odbijProdukcijskuAdresu(adresa)).toThrow();
  });

  it('u ručnom načinu prihvaća staging, ali u starom načinu blokira staging i produkciju', () => {
    expect(validirajCiljPokretanja('https://staging.kaladont.hr', true).hostname).toBe('staging.kaladont.hr');
    expect(() => validirajCiljPokretanja('https://staging.kaladont.hr', false)).toThrow();
    expect(() => validirajCiljPokretanja('https://kaladont.hr', false)).toThrow();
    expect(() => validirajCiljPokretanja('https://sub.kaladont.hr', false)).toThrow();
    expect(() => validirajCiljPokretanja('https://example.com', true)).toThrow();
  });

  it('zahtijeva zasebnu naredbu za staging i zasad dopušta samo veze', () => {
    expect(() => provjeriNacinPokretanja('https://staging.kaladont.hr', false)).toThrow();
    expect(() => provjeriNacinPokretanja('https://staging.kaladont.hr', true)).not.toThrow();
    expect(() => provjeriScenarijStagingTesta('veze')).not.toThrow();
    expect(() => provjeriScenarijStagingTesta('igra')).toThrow();
  });

  it('validira cijeli staging ulaz bez pokretanja mrežnog zahtjeva', () => {
    const ulaz = {
      adresa: 'https://staging.kaladont.hr',
      brojKorisnika: 500,
      trajanjeMs: 60_000,
      scenarij: 'veze',
      velicinaVala: 10,
      razmakValaMs: 1_000,
      potvrdaDesetTisuca: undefined,
    };
    expect(validirajUlazStagingTesta(ulaz).hostname).toBe('staging.kaladont.hr');
    expect(() => validirajUlazStagingTesta({ ...ulaz, adresa: 'https://kaladont.hr' })).toThrow();
    expect(() => validirajUlazStagingTesta({ ...ulaz, brojKorisnika: undefined })).toThrow();
    expect(() => validirajUlazStagingTesta({ ...ulaz, scenarij: 'igra' })).toThrow();
    expect(() => validirajUlazStagingTesta({ ...ulaz, velicinaVala: 101 })).toThrow();
  });

  it('validira ulaz miješanog staging testa neovisno o osnovnom testu veza', () => {
    const ulaz = {
      adresa: 'https://staging.kaladont.hr',
      brojKorisnika: 100,
      trajanjeMs: 60_000,
      velicinaVala: 10,
      razmakValaMs: 1_000,
      potvrdaDesetTisuca: undefined,
    };
    expect(validirajUlazMijesanogTesta(ulaz).hostname).toBe('staging.kaladont.hr');
    expect(() => validirajUlazMijesanogTesta({ ...ulaz, adresa: 'https://kaladont.hr' })).toThrow();
  });

  it('ograničava lokalni smoke na localhost i fiksnih 14 virtualnih korisnika', () => {
    expect(validirajAdresuLokalnogTesta('http://localhost:3000').hostname).toBe('localhost');
    expect(validirajAdresuLokalnogTesta('http://127.0.0.1:3000').hostname).toBe('127.0.0.1');
    expect(validirajAdresuLokalnogWeba('http://localhost:5173').port).toBe('5173');
    expect(validirajAdresuLokalnogWeba('http://127.0.0.1:5174').port).toBe('5174');
    expect(validirajAdresuLokalnogWeba('http://[::1]:5173').hostname).toBe('[::1]');
    expect(() => validirajAdresuLokalnogWeba('http://localhost:3000')).toThrow();
    expect(() => validirajAdresuLokalnogTesta('https://staging.kaladont.hr')).toThrow();
    expect(() => validirajAdresuLokalnogTesta('http://example.com:3000')).toThrow();
    expect(RASPODJELA_LOKALNOG_SMOKE.ukupnoKorisnika).toBe(14);
    expect(RASPODJELA_LOKALNOG_SMOKE.brojIgraca).toBe(11);
    expect(RASPODJELA_LOKALNOG_SMOKE.brojPosjetitelja).toBe(3);
    expect(() => validirajTrajanjeLokalnogSmokea(15_000)).not.toThrow();
    expect(() => validirajTrajanjeLokalnogSmokea(120_000)).not.toThrow();
    expect(() => validirajTrajanjeLokalnogSmokea(14_999)).toThrow();
    expect(() => validirajTrajanjeLokalnogSmokea(120_001)).toThrow();
  });

  it('ograničava staging rampu na najviše 100 klijenata u sekundi', () => {
    expect(() => provjeriRampuStagingTesta(10, 1_000)).not.toThrow();
    expect(() => provjeriRampuStagingTesta(MAKS_VELICINA_VALA_STAGING, MIN_RAZMAK_VALA_STAGING_MS)).not.toThrow();
    expect(() => provjeriRampuStagingTesta(MAKS_VELICINA_VALA_STAGING + 1, 1_000)).toThrow();
    expect(() => provjeriRampuStagingTesta(10, MIN_RAZMAK_VALA_STAGING_MS - 1)).toThrow();
    expect(() => provjeriRampuStagingTesta(10, MAKS_RAZMAK_VALA_STAGING_MS + 1)).toThrow();
    expect(() => provjeriRampuStagingTesta(10, 2 ** 31)).toThrow();
  });

  it('zahtijeva dogovorenu razinu, trajanje i dodatnu potvrdu za 10000 korisnika', () => {
    const zahtjev = {
      adresa: 'https://staging.kaladont.hr',
      brojKorisnika: 1_000,
      trajanjeMs: 60_000,
      potvrdaDesetTisuca: undefined,
    };
    expect(validirajZahtjevStagingTesta(zahtjev).hostname).toBe('staging.kaladont.hr');
    expect(() => validirajZahtjevStagingTesta({ ...zahtjev, brojKorisnika: 99 })).toThrow();
    expect(() => validirajZahtjevStagingTesta({ ...zahtjev, trajanjeMs: MIN_TRAJANJE_STAGING_TESTA_MS - 1 })).toThrow();
    expect(() => validirajZahtjevStagingTesta({ ...zahtjev, trajanjeMs: MAKS_TRAJANJE_STAGING_TESTA_MS + 1 })).toThrow();
    expect(() => validirajZahtjevStagingTesta({ ...zahtjev, brojKorisnika: 10_000 })).toThrow();
    expect(() => validirajZahtjevStagingTesta({
      ...zahtjev,
      brojKorisnika: 10_000,
      potvrdaDesetTisuca: 'DA',
    })).not.toThrow();
  });

  it('sprječava paralelni test istog staginga i oslobađa zaključavanje', async () => {
    const direktorij = await mkdtemp(path.join(tmpdir(), 'kaladont-opterecenje-'));
    try {
      const oslobodi = await zakljucajStagingTest('https://staging.kaladont.hr', direktorij);
      await expect(zakljucajStagingTest('https://staging.kaladont.hr', direktorij)).rejects.toThrow(
        'Već je pokrenut test opterećenja za staging.',
      );
      await oslobodi();
      const oslobodiPonovno = await zakljucajStagingTest('https://staging.kaladont.hr', direktorij);
      await oslobodiPonovno();
    } finally {
      await rm(direktorij, { recursive: true, force: true });
    }
  });

  it('prihvaća override samo uz izričito DA i samo za staging', () => {
    expect(validirajTransportOpterecenja(undefined)).toBe('polling-websocket');
    expect(validirajTransportOpterecenja('polling-websocket')).toBe('polling-websocket');
    expect(validirajTransportOpterecenja('websocket')).toBe('websocket');
    expect(() => validirajTransportOpterecenja('nepoznat')).toThrow();
    expect(validirajPreskakanjePrethodneRazine(undefined, false)).toBe(false);
    expect(validirajPreskakanjePrethodneRazine('DA', false)).toBe(true);
    expect(() => validirajPreskakanjePrethodneRazine('', false)).toThrow();
    expect(() => validirajPreskakanjePrethodneRazine('NE', false)).toThrow();
    expect(() => validirajPreskakanjePrethodneRazine('DA', true)).toThrow();
  });

  it('ručno preskače prethodnu razinu bez pisanja potvrde ili izmjene ranijeg FAIL-a', async () => {
    const direktorij = await mkdtemp(path.join(tmpdir(), 'kaladont-override-'));
    const putanja = path.join(direktorij, 'raniji-izvjestaj.json');
    const ranijiIzvjestaj = JSON.stringify({ ishod: 'FAIL', razina: 100 });
    try {
      await writeFile(putanja, ranijiIzvjestaj);
      await expect(provjeriPrethodnuRazinuStagingTesta('https://staging.kaladont.hr', 500, direktorij, Date.now(), 'mijesani-test', 'digest')).rejects.toThrow();
      await expect(provjeriPrethodnuRazinuStagingTesta('https://staging.kaladont.hr', 500, direktorij, Date.now(), 'mijesani-test', 'digest', true)).resolves.toBeUndefined();
      await expect(provjeriPrethodnuRazinuStagingTesta('https://kaladont.hr', 500, direktorij, Date.now(), 'mijesani-test', 'digest', true)).rejects.toThrow();
      expect(await readdir(direktorij)).toEqual(['raniji-izvjestaj.json']);
      expect(await readFile(putanja, 'utf8')).toBe(ranijiIzvjestaj);
    } finally {
      await rm(direktorij, { recursive: true, force: true });
    }
  });

  it('zahtijeva i bilježi uspješne razine prije prelaska na veću', async () => {
    const direktorij = await mkdtemp(path.join(tmpdir(), 'kaladont-potvrde-testova-'));
    const adresa = 'https://staging.kaladont.hr';
    const sada = Date.now();
    try {
      await expect(provjeriPrethodnuRazinuStagingTesta(adresa, 500, direktorij, sada)).rejects.toThrow();
      await zabiljeziRezultatStagingTesta(adresa, 100, 'PASS', direktorij, sada);
      await expect(provjeriPrethodnuRazinuStagingTesta(adresa, 500, direktorij, sada)).resolves.toBeUndefined();
      await zabiljeziRezultatStagingTesta(adresa, 500, 'FAIL', direktorij, sada);
      await expect(provjeriPrethodnuRazinuStagingTesta(adresa, 1_000, direktorij, sada)).rejects.toThrow();
      await zabiljeziRezultatStagingTesta(adresa, 500, 'PASS', direktorij, sada);
      await expect(provjeriPrethodnuRazinuStagingTesta(adresa, 1_000, direktorij, sada)).resolves.toBeUndefined();
      await expect(provjeriPrethodnuRazinuStagingTesta(adresa, 10_000, direktorij, sada)).rejects.toThrow();
      await zabiljeziRezultatStagingTesta(adresa, 1_000, 'ABORTED', direktorij, sada);
      await expect(provjeriPrethodnuRazinuStagingTesta(adresa, 2_000, direktorij, sada)).rejects.toThrow();
      await zabiljeziRezultatStagingTesta(adresa, 100, 'PASS', direktorij, sada, 'veze-v1', 'digest-a');
      await expect(provjeriPrethodnuRazinuStagingTesta(adresa, 500, direktorij, sada, 'mijesano-v1', 'digest-a')).rejects.toThrow();
      await expect(provjeriPrethodnuRazinuStagingTesta(adresa, 500, direktorij, sada, 'veze-v1', 'digest-b')).rejects.toThrow();
    } finally {
      await rm(direktorij, { recursive: true, force: true });
    }
  });

  it('ne prolazi test veza ako se ciljano opterećenje ne održi cijelo vrijeme', () => {
    const ulaz = {
      brojCiljanihKlijenata: 100,
      brojObradenihPokusaja: 100,
      brojUspjesnihSpajanja: 100,
      brojGresaka: 0,
      najmanjeAktivnihVeza: 100,
      trajanjeDrzanjaMs: 60_000,
      ciljanoDrzanjeMs: 60_000,
      maksStopaGresaka: 0.005,
    };
    expect(ocijeniOdrzaneVeze(ulaz).prolaz).toBe(true);
    expect(ocijeniOdrzaneVeze({ ...ulaz, brojObradenihPokusaja: 99 }).prolaz).toBe(false);
    expect(ocijeniOdrzaneVeze({ ...ulaz, najmanjeAktivnihVeza: 0 }).prolaz).toBe(false);
    expect(ocijeniOdrzaneVeze({ ...ulaz, trajanjeDrzanjaMs: 10_000 }).prolaz).toBe(false);
    expect(ocijeniOdrzaneVeze({ ...ulaz, ciljanoDrzanjeMs: 0 }).prolaz).toBe(false);
  });

  it('veže miješani prolaz uz konkretan izvještaj i odbija njegov kasniji prekid', async () => {
    const direktorij = await mkdtemp(path.join(tmpdir(), 'potvrda-izvjestaj-'));
    const adresa = 'https://staging.kaladont.hr';
    const profilId = 'mijesani-test';
    const izvjestajPutanja = path.join(direktorij, 'rezultat.json');
    const izvjestaj = { verzijaFormata: 1, zakljuceno: true, pokrenuto: true, ishod: 'PASS', runId: 'pokus', cilj: adresa, razina: 100, profilId, digest: 'digest', lokalniSmoke: false };
    try {
      await expect(zabiljeziRezultatStagingTesta(adresa, 100, 'PASS', direktorij, Date.now(), profilId, 'digest')).rejects.toThrow();
      await writeFile(izvjestajPutanja, JSON.stringify(izvjestaj));
      await zabiljeziRezultatStagingTesta(adresa, 100, 'PASS', direktorij, Date.now(), profilId, 'digest', { runId: 'pokus', izvjestajPutanja });
      expect((await provjeriPrethodnuRazinuStagingTesta(adresa, 500, direktorij, Date.now(), profilId, 'digest'))?.runId).toBe('pokus');
      await writeFile(izvjestajPutanja, JSON.stringify({ ...izvjestaj, zakljuceno: false }));
      await expect(provjeriPrethodnuRazinuStagingTesta(adresa, 500, direktorij, Date.now(), profilId, 'digest')).rejects.toThrow();
      await writeFile(izvjestajPutanja, JSON.stringify({ ...izvjestaj, ishod: 'ABORTED' }));
      await expect(provjeriPrethodnuRazinuStagingTesta(adresa, 500, direktorij, Date.now(), profilId, 'digest')).rejects.toThrow();
    } finally { await rm(direktorij, { recursive: true, force: true }); }
  });

  it('raspoređuje sve korisnike u cjelovite grupe partija i treninge', () => {
    const ocekivaniTreninzi: Record<number, number> = { 100: 2, 500: 6, 1_000: 10, 2_000: 20, 5_000: 50, 10_000: 100 };
    for (const razina of [100, 500, 1_000, 2_000, 5_000, 10_000]) {
      const raspodjela = rasporediMijesaniTest(razina);
      expect(raspodjela.brojIgraca + raspodjela.brojPosjetitelja).toBe(razina);
      expect(raspodjela.brojIgracaDvoboja % 2).toBe(0);
      expect(raspodjela.brojIgracaJavnogCetveroboja % 4).toBe(0);
      expect(raspodjela.brojIgracaPrivatnogCetveroboja % 4).toBe(0);
      expect(raspodjela.brojTreninga).toBe(ocekivaniTreninzi[razina]);
      expect(raspodjela.brojIgracaTreninga).toBe(raspodjela.brojTreninga);
      expect(
        raspodjela.brojIgracaDvoboja +
          raspodjela.brojIgracaJavnogCetveroboja +
          raspodjela.brojIgracaPrivatnogCetveroboja +
          raspodjela.brojIgracaTreninga,
      ).toBe(raspodjela.brojIgraca);
    }

    expect(rasporediMijesaniTest(10_000)).toMatchObject({
      brojPosjetitelja: 3_000,
      brojIgraca: 7_000,
      brojIgracaTreninga: 100,
      brojTreninga: 100,
    });
    const deset = rasporediMijesaniTest(10_000);
    expect(deset.brojIgracaDvoboja).toBeGreaterThanOrEqual(3_100);
    expect(deset.brojIgracaPrivatnogCetveroboja).toBeGreaterThanOrEqual(680);
    expect(RASPODJELA_LOKALNOG_SMOKE.brojTreninga).toBe(1);
  });
});