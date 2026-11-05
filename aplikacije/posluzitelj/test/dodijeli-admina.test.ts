import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq, inArray } from 'drizzle-orm';
import { baza } from '../src/baza/klijent.js';
import { igraci } from '../src/baza/shema.js';
import { dodijeliAdmina } from '../src/operacije/dodijeli-admina.js';
import { PRAG_PUNOG_RJECNIKA, stanjeRjecnika } from '../src/operacije/rjecnik-bootstrap.js';

const PREFIKS = `admin-cli-${Date.now()}`;
const stvoreni: string[] = [];
let privremenoDegradirani: string[] = [];

async function stvoriIgraca(opcije: {
  email: string;
  emailPotvrdjen?: boolean;
  upravljac?: 'covjek' | 'bot';
  vrsta?: 'gost' | 'registriran' | 'admin';
  obrisan?: boolean;
}): Promise<string> {
  const [igrac] = await baza
    .insert(igraci)
    .values({
      vrsta: opcije.vrsta ?? 'registriran',
      upravljac: opcije.upravljac ?? 'covjek',
      nadimak: opcije.email.slice(0, 20),
      email: opcije.email,
      lozinkaHash: 'x',
      emailPotvrdjen: opcije.emailPotvrdjen ?? true,
      obrisanAt: opcije.obrisan ? new Date() : null,
    })
    .returning({ id: igraci.id });
  return igrac!.id;
}

beforeAll(async () => {
  const admini = await baza.select({ id: igraci.id }).from(igraci).where(eq(igraci.vrsta, 'admin'));
  privremenoDegradirani = admini.map((red) => red.id);
  if (privremenoDegradirani.length > 0) {
    await baza
      .update(igraci)
      .set({ vrsta: 'registriran' })
      .where(inArray(igraci.id, privremenoDegradirani));
  }
});

afterAll(async () => {
  for (const id of stvoreni) {
    await baza.delete(igraci).where(eq(igraci.id, id));
  }
  if (privremenoDegradirani.length > 0) {
    await baza
      .update(igraci)
      .set({ vrsta: 'admin' })
      .where(inArray(igraci.id, privremenoDegradirani));
  }
});

describe('dodijeliAdmina', () => {
  it('zahtijeva --potvrdi', async () => {
    await expect(dodijeliAdmina(`${PREFIKS}@example.com`, false)).rejects.toThrow(/potvrđena|potvrdi/i);
  });

  it('dodjeljuje prvom potvrđenom ljudskom računu i ostaje idempotentan', async () => {
    const email = `${PREFIKS}-ok@example.com`;
    const id = await stvoriIgraca({ email });
    stvoreni.push(id);

    expect(await dodijeliAdmina(email, true)).toBe('dodijeljen');
    const [red] = await baza.select({ vrsta: igraci.vrsta }).from(igraci).where(eq(igraci.id, id));
    expect(red?.vrsta).toBe('admin');
    expect(await dodijeliAdmina(email, true)).toBe('vec-admin');
  });

  it('odbija nepotvrđen email, bota, obrisanog, nepoznatog i drugog admina', async () => {
    const nepotvrdjenId = await stvoriIgraca({
      email: `${PREFIKS}-nepotvrdjen@example.com`,
      emailPotvrdjen: false,
    });
    const botId = await stvoriIgraca({
      email: `${PREFIKS}-bot@example.com`,
      upravljac: 'bot',
    });
    const obrisanId = await stvoriIgraca({
      email: `${PREFIKS}-obrisan@example.com`,
      obrisan: true,
    });
    const drugiId = await stvoriIgraca({ email: `${PREFIKS}-drugi@example.com` });
    stvoreni.push(nepotvrdjenId, botId, obrisanId, drugiId);

    expect(await dodijeliAdmina(`${PREFIKS}-nepotvrdjen@example.com`, true)).toBe('email-nije-potvrdjen');
    expect(await dodijeliAdmina(`${PREFIKS}-bot@example.com`, true)).toBe('nije-covjek');
    expect(await dodijeliAdmina(`${PREFIKS}-obrisan@example.com`, true)).toBe('obrisan');
    expect(await dodijeliAdmina(`${PREFIKS}-nepoznat@example.com`, true)).toBe('nije-pronaden');
    expect(await dodijeliAdmina(`${PREFIKS}-drugi@example.com`, true)).toBe('postoji-drugi-admin');
  });
});

describe('stanjeRjecnika', () => {
  it('računa dovoljan prema fiksiranom pragu punog hrLexa', async () => {
    const stanje = await stanjeRjecnika();
    expect(stanje.prag).toBe(PRAG_PUNOG_RJECNIKA);
    expect(stanje.broj).toBeGreaterThanOrEqual(0);
    expect(stanje.dovoljan).toBe(stanje.broj >= PRAG_PUNOG_RJECNIKA);
  });
});
