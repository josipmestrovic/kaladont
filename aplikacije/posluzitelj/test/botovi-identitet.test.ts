import { afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { validirajAvatarConfig, nasumicnaKonfiguracijaAvatara } from 'zajednicko';
import { baza } from '../src/baza/klijent.js';
import { botovi, igraci, partije, sudioniciPartije } from '../src/baza/shema.js';
import { izdajSesiju } from '../src/racuni/sesije.js';
import { razrijesiIdentitet } from '../src/identitet/identitet.js';
import { izracunajPoredak } from '../src/ljestvice/servis.js';
import { FondBotova, type IdentitetBota } from '../src/bot/fond.js';
import { kljucSeedaBota } from '../src/cli/seed-botova.js';
import { NADIMCI_BOTOVA } from '../src/bot/nadimci.js';
import { MAKSIMALNA_DULJINA_NADIMKA, MINIMALNA_DULJINA_NADIMKA, UZORAK_NADIMKA } from 'zajednicko';

const stvoreniIgraci: string[] = [];
const stvorenePartije: string[] = [];

afterAll(async () => {
  if (stvorenePartije.length) {
    await baza.delete(sudioniciPartije).where(inArray(sudioniciPartije.partijaId, stvorenePartije));
    await baza.delete(partije).where(inArray(partije.id, stvorenePartije));
  }
  if (stvoreniIgraci.length) {
    await baza.delete(botovi).where(inArray(botovi.igracId, stvoreniIgraci));
    await baza.delete(igraci).where(inArray(igraci.id, stvoreniIgraci));
  }
});

async function noviBot(nadimak = `Bot${randomUUID().slice(0, 6)}`): Promise<string> {
  const id = randomUUID();
  stvoreniIgraci.push(id);
  await baza.insert(igraci).values({ id, vrsta: 'registriran', upravljac: 'bot', nadimak, emailPotvrdjen: true });
  await baza.insert(botovi).values({ igracId: id, kljucSeeda: `test-${id}` });
  return id;
}

async function noviCovjek(nadimak: string): Promise<string> {
  const id = randomUUID();
  stvoreniIgraci.push(id);
  await baza.insert(igraci).values({ id, vrsta: 'registriran', nadimak });
  return id;
}

describe('bot identitet', () => {
  it('ne može dobiti sesiju ni razriješiti identitet', async () => {
    const botId = await noviBot();
    await expect(izdajSesiju(botId)).rejects.toThrow('nije moguće izdati sesiju');
    const covjekId = await noviCovjek(`Covjek${randomUUID().slice(0, 6)}`);
    const sesija = await izdajSesiju(covjekId);
    await expect(razrijesiIdentitet(sesija.token)).resolves.toMatchObject({ igracId: covjekId });
    // Ručno „ukradena” sesija upisana na bota ne smije proći ni kroz socket razrješenje.
    await baza.update(igraci).set({ upravljac: 'bot' }).where(eq(igraci.id, covjekId));
    await expect(razrijesiIdentitet(sesija.token)).rejects.toThrow();
  });

  it('ne pojavljuje se na ljestvici iako ima završene partije', async () => {
    const OD = new Date('2002-03-05T23:00:00Z');
    const DO = new Date('2002-03-12T23:00:00Z');
    const botId = await noviBot();
    const covjekId = await noviCovjek(`Lj${randomUUID().slice(0, 6)}`);
    for (let i = 0; i < 6; i += 1) {
      const id = randomUUID();
      stvorenePartije.push(id);
      const pocetak = new Date(OD.getTime() + (i + 1) * 60_000);
      await baza.insert(partije).values({ id, mod: 'dva_igraca', status: 'zavrsena', pocetak, kraj: new Date(pocetak.getTime() + 30_000), brojBotova: 1 });
      await baza.insert(sudioniciPartije).values([
        { partijaId: id, igracId: botId, sjedalo: 0, plasman: 1, bodovi: 4 },
        { partijaId: id, igracId: covjekId, sjedalo: 1, plasman: 2, bodovi: 1 },
      ]);
    }
    const poredak = await izracunajPoredak('dva_igraca', 'prosjek_bodova', 'tjedno', OD, DO);
    const idovi = [...poredak.poIgracu.keys()];
    expect(idovi).toContain(covjekId);
    expect(idovi).not.toContain(botId);
  });
});

describe('seed botova', () => {
  it('fond nadimaka poštuje pravila nadimka i nema duplikata', () => {
    expect(new Set(NADIMCI_BOTOVA.map((n) => n.toLowerCase())).size).toBe(NADIMCI_BOTOVA.length);
    expect(NADIMCI_BOTOVA.length).toBeGreaterThanOrEqual(100);
    for (const nadimak of NADIMCI_BOTOVA) {
      expect(UZORAK_NADIMKA.test(nadimak)).toBe(true);
      expect(nadimak.length).toBeGreaterThanOrEqual(MINIMALNA_DULJINA_NADIMKA);
      expect(nadimak.length).toBeLessThanOrEqual(MAKSIMALNA_DULJINA_NADIMKA);
    }
    expect(kljucSeedaBota(7)).toBe('bot-007');
  });

  it('nasumična konfiguracija avatara je valjana i ponovljiva uz isti RNG', () => {
    const rng = (seed: number) => () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const prva = nasumicnaKonfiguracijaAvatara(rng(42));
    const druga = nasumicnaKonfiguracijaAvatara(rng(42));
    expect(validirajAvatarConfig(prva)).toBe(true);
    expect(druga).toEqual(prva);
    if (prva.parts.ears === 'detached') expect(prva.parts.earrings).toBeNull();
  });
});

describe('fond botova', () => {
  const identiteti: IdentitetBota[] = ['a', 'b'].map((id) => ({
    igracId: id, nadimak: id, avatarId: 0, avatarConfig: null, avatarRevision: 0,
    odigrane: 0, pobjede: 0, bodoviUkupno: 0, odigrane1v1: 0, pobjede1v1: 0, bodovi1v1: 0, iskustvoUkupno: 0,
  }));

  it('jedan identitet ima najviše jednu rezervaciju; iscrpljen fond vraća null', () => {
    let sada = 1_000;
    const fond = new FondBotova(identiteti, () => sada);
    const prva = fond.rezerviraj('g1')!;
    sada += 10;
    const druga = fond.rezerviraj('g1')!;
    expect(new Set([prva.igracId, druga.igracId]).size).toBe(2);
    expect(fond.rezerviraj('g2')).toBeNull();
    expect(fond.stanje()).toMatchObject({ ukupno: 2, slobodni: 0, rezervirani: 2, iscrpljenja: 1 });
  });

  it('zakašnjelo oslobađanje stare generacije ne dira novu rezervaciju', () => {
    const fond = new FondBotova(identiteti.slice(0, 1));
    const stara = fond.rezerviraj('g1')!;
    expect(fond.oslobodi(stara)).toBe(true);
    const nova = fond.rezerviraj('g2')!;
    expect(nova.generacija).toBeGreaterThan(stara.generacija);
    expect(fond.oslobodi(stara)).toBe(false);
    expect(fond.oznaci(stara, 'u_partiji')).toBe(false);
    expect(fond.rezervacijaZa('a')?.generacija).toBe(nova.generacija);
    expect(fond.oznaci(nova, 'u_partiji')).toBe(true);
    fond.oslobodiGrupu('g2');
    expect(fond.rezervacijaZa('a')?.stanje).toBe('u_partiji');
  });

  it('bira najdulje neiskorišten identitet i gradi stavku reda kao bota', () => {
    let sada = 0;
    const fond = new FondBotova(identiteti, () => sada);
    const prva = fond.rezerviraj('g1')!;
    fond.oslobodi(prva);
    sada = 50;
    const druga = fond.rezerviraj('g2')!;
    expect(druga.igracId).not.toBe(prva.igracId);
    const stavka = fond.stavkaReda(druga.igracId);
    expect(stavka).toMatchObject({ upravljac: 'bot', vrsta: 'registriran', usaoU: 50 });
  });
});
