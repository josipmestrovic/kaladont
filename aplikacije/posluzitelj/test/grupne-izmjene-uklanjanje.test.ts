import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { baza } from '../src/baza/klijent.js';
import {
  igraci,
  izmjeneRjecnika,
  operacijeRjecnika,
  partije,
  prijave,
  rijeci,
} from '../src/baza/shema.js';
import { potvrdiIspravakRjecnika } from '../src/dostignuca/potvrde-prijava.js';
import {
  izracunajPregledUklanjanja,
  potvrdiGrupnoUklanjanje,
} from '../src/rjecnik/grupne-izmjene.js';

const HR = 'abcdefghijklmnoprstuvz';
const SUFIKS = Array.from({ length: 6 }, () => HR[Math.floor(Math.random() * HR.length)]!).join('');
const GRUPA = `imenica:casting${SUFIKS}`;
const OBLICI = [
  `casting${SUFIKS}`,
  `castinga${SUFIKS}`,
  `castingu${SUFIKS}`,
  `castingom${SUFIKS}`,
] as const;
const HOMO_A = `homo${SUFIKS}a`;
const HOMO_B = `homo${SUFIKS}b`;
const HOMO_AB = `homo${SUFIKS}ab`;
const HOMO_C = `homo${SUFIKS}c`;
const GRUPA_A = `imenica:grpa${SUFIKS}`;
const GRUPA_B = `imenica:grpb${SUFIKS}`;
const GRUPA_C = `imenica:grpc${SUFIKS}`;

const rijeciZaBrisanje: string[] = [];
const igraciZaBrisanje: string[] = [];
const partijeZaBrisanje: string[] = [];
const prijaveZaBrisanje: number[] = [];
const operacijeZaBrisanje: string[] = [];

afterEach(async () => {
  const sve = [...OBLICI, HOMO_A, HOMO_B, HOMO_AB, HOMO_C, ...rijeciZaBrisanje.splice(0)];
  await baza.delete(izmjeneRjecnika).where(inArray(izmjeneRjecnika.rijec, sve));
  if (operacijeZaBrisanje.length) {
    await baza.delete(operacijeRjecnika).where(inArray(operacijeRjecnika.kljuc, operacijeZaBrisanje.splice(0)));
  }
  if (prijaveZaBrisanje.length) {
    await baza.delete(prijave).where(inArray(prijave.id, prijaveZaBrisanje.splice(0)));
  }
  await baza.delete(rijeci).where(inArray(rijeci.rijec, sve));
  if (partijeZaBrisanje.length) {
    await baza.delete(partije).where(inArray(partije.id, partijeZaBrisanje.splice(0)));
  }
  if (igraciZaBrisanje.length) {
    await baza.delete(igraci).where(inArray(igraci.id, igraciZaBrisanje.splice(0)));
  }
});

async function ubaciOblik(rijec: string, grupe: string[], aktivna = true) {
  rijeciZaBrisanje.push(rijec);
  await baza.insert(rijeci).values({
    rijec,
    prvaDva: rijec.slice(0, 2),
    zadnjaDva: rijec.slice(-2),
    vrste: ['imenica'],
    grupe,
    frekvencija: 10,
    aktivna,
  }).onConflictDoNothing();
}

async function noviAdmin(): Promise<string> {
  const id = randomUUID();
  igraciZaBrisanje.push(id);
  await baza.insert(igraci).values({
    id,
    vrsta: 'admin',
    upravljac: 'covjek',
    nadimak: `adm${SUFIKS}`,
    email: `adm-${id}@example.com`,
  });
  return id;
}

describe('grupno uklanjanje (#75)', () => {
  it('castinga i castingu daju isti obuhvat cijele grupe', async () => {
    for (const oblik of OBLICI) await ubaciOblik(oblik, [GRUPA]);
    const p1 = await izracunajPregledUklanjanja(baza, OBLICI[1]!);
    const p2 = await izracunajPregledUklanjanja(baza, OBLICI[2]!);
    expect(p1.brojAktivnih).toBe(4);
    expect(p2.brojAktivnih).toBe(4);
    expect(p1.izvorniKljucevi).toEqual(p2.izvorniKljucevi);
    expect(p1.oblici.map((o) => o.rijec).sort()).toEqual([...OBLICI].sort());
    expect(p2.oblici.map((o) => o.rijec).sort()).toEqual([...OBLICI].sort());
  });

  it('homograf: A∪B ulaze, samo C ostaje', async () => {
    await ubaciOblik(HOMO_A, [GRUPA_A]);
    await ubaciOblik(HOMO_B, [GRUPA_B]);
    await ubaciOblik(HOMO_AB, [GRUPA_A, GRUPA_B]);
    await ubaciOblik(HOMO_C, [GRUPA_C]);
    // Izvor u A i B
    await baza.update(rijeci).set({ grupe: [GRUPA_A, GRUPA_B] }).where(eq(rijeci.rijec, HOMO_AB));

    const pregled = await izracunajPregledUklanjanja(baza, HOMO_AB);
    const popis = pregled.oblici.map((o) => o.rijec).sort();
    expect(popis).toEqual([HOMO_A, HOMO_AB, HOMO_B].sort());
    expect(popis).not.toContain(HOMO_C);

    const adminId = await noviAdmin();
    const kljuc = `test-homo-${randomUUID()}`;
    operacijeZaBrisanje.push(kljuc);
    const rezultat = await potvrdiGrupnoUklanjanje({
      adminId,
      otisak: pregled.otisak,
      kljucOperacije: kljuc,
      rijec: HOMO_AB,
      razlog: 'test homograf',
    });
    expect(rezultat.ok).toBe(true);
    if (!rezultat.ok) return;
    expect(rezultat.ishod.brojPromjena).toBe(3);

    const stanja = await baza.select().from(rijeci).where(inArray(rijeci.rijec, [HOMO_A, HOMO_B, HOMO_AB, HOMO_C]));
    for (const red of stanja) {
      if (red.rijec === HOMO_C) expect(red.aktivna).toBe(true);
      else expect(red.aktivna).toBe(false);
    }
  });

  it('409 na zastarjeli otisak; retry s istim ključem vraća isti ishod', async () => {
    for (const oblik of OBLICI) await ubaciOblik(oblik, [GRUPA]);
    const pregled = await izracunajPregledUklanjanja(baza, OBLICI[2]!);
    const adminId = await noviAdmin();
    const kljuc = `test-retry-${randomUUID()}`;
    operacijeZaBrisanje.push(kljuc);

    const lose = await potvrdiGrupnoUklanjanje({
      adminId,
      otisak: '0'.repeat(64),
      kljucOperacije: kljuc,
      rijec: OBLICI[2],
      razlog: 'test',
    });
    expect(lose.ok).toBe(false);
    if (lose.ok) return;
    expect(lose.status).toBe(409);
    expect(lose.kod).toBe('zastarjeli_pregled');

    const prvo = await potvrdiGrupnoUklanjanje({
      adminId,
      otisak: pregled.otisak,
      kljucOperacije: kljuc,
      rijec: OBLICI[2],
      razlog: 'test',
    });
    expect(prvo.ok).toBe(true);
    if (!prvo.ok) return;

    const ponovo = await potvrdiGrupnoUklanjanje({
      adminId,
      otisak: pregled.otisak,
      kljucOperacije: kljuc,
      rijec: OBLICI[2],
      razlog: 'test',
    });
    expect(ponovo.ok).toBe(true);
    if (!ponovo.ok) return;
    expect(ponovo.ishod.operacijaId).toBe(prvo.ishod.operacijaId);
    expect(ponovo.ishod.brojPromjena).toBe(prvo.ishod.brojPromjena);
  });

  it('prijava za castingu deaktivira cijelu grupu', async () => {
    for (const oblik of OBLICI) await ubaciOblik(oblik, [GRUPA]);
    const adminId = await noviAdmin();
    const igracId = randomUUID();
    igraciZaBrisanje.push(igracId);
    await baza.insert(igraci).values({
      id: igracId,
      vrsta: 'registriran',
      upravljac: 'covjek',
      nadimak: `igr${SUFIKS}`,
      email: `igr-${igracId}@example.com`,
    });
    const partijaId = randomUUID();
    partijeZaBrisanje.push(partijaId);
    await baza.insert(partije).values({
      id: partijaId,
      mod: 'cetiri_igraca',
      status: 'u_tijeku',
      pocetak: new Date(),
    });
    const [prijava] = await baza.insert(prijave).values({
      partijaId,
      igracId,
      tip: 'za_brisanje',
      rijec: OBLICI[2],
      poruka: 'test',
    }).returning({ id: prijave.id });
    prijaveZaBrisanje.push(prijava!.id);

    const pregled = await izracunajPregledUklanjanja(baza, OBLICI[2]!);
    const kljuc = `test-prijava-${randomUUID()}`;
    operacijeZaBrisanje.push(kljuc);
    const rezultat = await potvrdiIspravakRjecnika({
      prijavaId: prijava!.id,
      adminId,
      smjer: 'deaktiviraj',
      otisak: pregled.otisak,
      kljucOperacije: kljuc,
    });
    expect(rezultat.ok).toBe(true);
    if (!rezultat.ok) return;
    expect(rezultat.promjena).toBe('deaktivirana');
    expect(rezultat.brojPromjena).toBe(4);
    expect(rezultat.deaktivirane?.sort()).toEqual([...OBLICI].sort());
  });
});
