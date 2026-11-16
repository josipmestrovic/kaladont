import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { inArray } from 'drizzle-orm';
import { baza } from '../src/baza/klijent.js';
import {
  igraci,
  izmjeneRjecnika,
  operacijeRjecnika,
  rijeci,
} from '../src/baza/shema.js';
import {
  izracunajPregledDodavanja,
  potvrdiGrupnoDodavanje,
} from '../src/rjecnik/grupne-izmjene.js';

const HR = 'abcdefghijklmnoprstuvz';
const SUFIKS = Array.from({ length: 6 }, () => HR[Math.floor(Math.random() * HR.length)]!).join('');
const LEMA = `lemdod${SUFIKS}`;
const GRUPA = `imenica:${LEMA}`;
const OBLICI = [
  `lemdod${SUFIKS}`,
  `lemdoda${SUFIKS}`,
  `lemdodu${SUFIKS}`,
] as const;
const POSTOJECI = `lemdodim${SUFIKS}`;

const rijeciZaBrisanje: string[] = [];
const igraciZaBrisanje: string[] = [];
const operacijeZaBrisanje: string[] = [];

afterEach(async () => {
  const sve = [...OBLICI, POSTOJECI, ...rijeciZaBrisanje.splice(0)];
  await baza.delete(izmjeneRjecnika).where(inArray(izmjeneRjecnika.rijec, sve));
  if (operacijeZaBrisanje.length) {
    await baza.delete(operacijeRjecnika).where(inArray(operacijeRjecnika.kljuc, operacijeZaBrisanje.splice(0)));
  }
  await baza.delete(rijeci).where(inArray(rijeci.rijec, sve));
  if (igraciZaBrisanje.length) {
    await baza.delete(igraci).where(inArray(igraci.id, igraciZaBrisanje.splice(0)));
  }
});

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

describe('grupno dodavanje (#89)', () => {
  it('dodaje sve oblike iste leme; postojeći zadržava frekvenciju 37', async () => {
    rijeciZaBrisanje.push(POSTOJECI);
    await baza.insert(rijeci).values({
      rijec: POSTOJECI,
      prvaDva: POSTOJECI.slice(0, 2),
      zadnjaDva: POSTOJECI.slice(-2),
      vrste: ['imenica'],
      grupe: [GRUPA],
      frekvencija: 37,
      aktivna: true,
    });

    const pregled = await izracunajPregledDodavanja(baza, {
      izvornaRijec: OBLICI[0]!,
      vrsta: 'imenica',
      lema: LEMA,
      dodatniOblici: [
        { rijec: OBLICI[1]! },
        { rijec: OBLICI[2]! },
        { rijec: POSTOJECI },
      ],
    });
    expect(pregled.brojOblici).toBe(4);
    expect(pregled.kljucGrupe).toBe(GRUPA);

    const adminId = await noviAdmin();
    const kljuc = `test-dodaj-${randomUUID()}`;
    operacijeZaBrisanje.push(kljuc);
    const rezultat = await potvrdiGrupnoDodavanje({
      adminId,
      otisak: pregled.otisak,
      kljucOperacije: kljuc,
      izvornaRijec: OBLICI[0]!,
      vrsta: 'imenica',
      lema: LEMA,
      dodatniOblici: [
        { rijec: OBLICI[1]! },
        { rijec: OBLICI[2]! },
        { rijec: POSTOJECI },
      ],
      potvrdiPreklapanja: false,
    });
    expect(rezultat.ok).toBe(true);
    if (!rezultat.ok) return;
    expect(rezultat.ishod.brojPromjena).toBeGreaterThanOrEqual(3);

    const stanja = await baza.select().from(rijeci).where(inArray(rijeci.rijec, [...OBLICI, POSTOJECI]));
    expect(stanja).toHaveLength(4);
    for (const red of stanja) {
      expect(red.aktivna).toBe(true);
      expect(red.grupe).toContain(GRUPA);
    }
    const postojeci = stanja.find((r) => r.rijec === POSTOJECI);
    expect(postojeci?.frekvencija).toBe(37);
    expect(postojeci?.rucnaFrekvencija).toBeNull();
  });
});