import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import {
  TIP_SANDUCIC_DOBRODOSLICA,
  TIP_SANDUCIC_EMAIL_POTVRDEN,
  TIP_SANDUCIC_FEEDBACK,
  TIP_SANDUCIC_FORMA_10,
  TIP_SANDUCIC_GOST_SAZETAK_5,
  TIP_SANDUCIC_NOVA_KOLEKCIONARSKA_RAZINA,
  TIP_SANDUCIC_NOVA_XP_RAZINA,
  TIP_SANDUCIC_NOVA_ZVJEZDICA,
  TIP_SANDUCIC_PROMJENA_RANGA,
  TIP_SANDUCIC_PRVA_IGRA,
  TIP_SANDUCIC_TEST,
} from 'zajednicko';
import { izgradiPosluzitelj } from '../src/server.js';
import { baza } from '../src/baza/klijent.js';
import { igraci, sanducicPoruke, sanducicPrekretnice } from '../src/baza/shema.js';
import { izdajSesiju, stvoriGostSesiju } from '../src/racuni/sesije.js';
import { obrisiRacun } from '../src/racuni/brisanje.js';
import { ocistiStareSanducicPoruke, ROK_SANDUCIC_PORUKE_MS } from '../src/sanducic/ciscenje.js';
import {
  mozdaObavijestiPrvuIgru,
  obradiDovrsenuIgruSanducic,
  stvoriDobrodoslicu,
  stvoriPorukeKolekcije,
  stvoriPorukeXpRazina,
  stvoriPorukeZvjezdica,
  stvoriPorukuForme10,
  stvoriPorukuGostSazetak,
  stvoriPorukuPotvrdeEmaila,
  stvoriPorukuPromjeneRanga,
} from '../src/sanducic/okidaci.js';
import {
  dohvatiSazetak,
  oznaciProcitane,
  oznaciSveProcitane,
  potvrdiNajavu,
  stvoriPoruku,
} from '../src/sanducic/servis.js';

const igraciZaBrisanje: string[] = [];
let app: FastifyInstance;
let adresa: string;

async function noviIgrac(vrsta: 'gost' | 'registriran' = 'registriran'): Promise<{ id: string; token: string; email?: string }> {
  if (vrsta === 'gost') {
    const gost = await stvoriGostSesiju();
    igraciZaBrisanje.push(gost.igracId);
    return { id: gost.igracId, token: gost.token };
  }
  const id = randomUUID();
  igraciZaBrisanje.push(id);
  const email = `sanducic-${id}@example.com`;
  await baza.insert(igraci).values({
    id,
    vrsta: 'registriran',
    nadimak: `Sand ${id.slice(0, 6)}`,
    email,
    lozinkaHash: 'lozinka123',
    emailPotvrdjen: true,
  });
  const sesija = await izdajSesiju(id);
  return { id, token: sesija.token, email };
}

beforeAll(async () => {
  ({ app } = await izgradiPosluzitelj());
  await app.listen({ port: 0, host: '127.0.0.1' });
  const podaci = app.server.address();
  const port = typeof podaci === 'object' && podaci ? podaci.port : 0;
  adresa = `http://127.0.0.1:${port}`;
});

afterEach(async () => {
  if (igraciZaBrisanje.length === 0) return;
  for (const id of igraciZaBrisanje.splice(0)) {
    await baza.delete(sanducicPoruke).where(eq(sanducicPoruke.igracId, id));
    await baza.delete(sanducicPrekretnice).where(eq(sanducicPrekretnice.igracId, id));
    await baza.delete(igraci).where(eq(igraci.id, id));
  }
});

afterAll(async () => {
  await app.close();
});

describe('sandučic', () => {
  it('deduplicira po (igrac, ključ)', async () => {
    const igrac = await noviIgrac();
    const prva = await stvoriPoruku({
      igracId: igrac.id,
      tip: TIP_SANDUCIC_TEST,
      deduplikacijskiKljuc: 'test:jedan',
      podaci: { tekst: 'Prva' },
    });
    const druga = await stvoriPoruku({
      igracId: igrac.id,
      tip: TIP_SANDUCIC_TEST,
      deduplikacijskiKljuc: 'test:jedan',
      podaci: { tekst: 'Druga' },
    });
    expect(prva?.id).toBeTruthy();
    expect(druga).toBeNull();
    const redovi = await baza.select().from(sanducicPoruke).where(eq(sanducicPoruke.igracId, igrac.id));
    expect(redovi).toHaveLength(1);
  });

  it('razlikuje najavu od čitanja', async () => {
    const igrac = await noviIgrac();
    const poruka = await stvoriPoruku({
      igracId: igrac.id,
      tip: TIP_SANDUCIC_TEST,
      deduplikacijskiKljuc: 'test:najava',
    });
    expect(poruka).toBeTruthy();

    let sazetak = await dohvatiSazetak(igrac.id);
    expect(sazetak.brojNeprocitanih).toBe(1);
    expect(sazetak.zaNajavu.map((p) => p.id)).toEqual([poruka!.id]);

    await potvrdiNajavu(igrac.id, [poruka!.id]);
    sazetak = await dohvatiSazetak(igrac.id);
    expect(sazetak.brojNeprocitanih).toBe(1);
    expect(sazetak.zaNajavu).toHaveLength(0);

    await oznaciProcitane(igrac.id, [poruka!.id]);
    sazetak = await dohvatiSazetak(igrac.id);
    expect(sazetak.brojNeprocitanih).toBe(0);
  });

  it('oznaciSve ne gutaju poruke stvorene nakon granice', async () => {
    const igrac = await noviIgrac();
    const stara = await stvoriPoruku({
      igracId: igrac.id,
      tip: TIP_SANDUCIC_TEST,
      deduplikacijskiKljuc: 'test:stara',
      stvorenaAt: new Date('2026-11-07T10:00:00.000Z'),
    });
    const granica = new Date('2026-11-07T10:00:30.000Z');
    const nova = await stvoriPoruku({
      igracId: igrac.id,
      tip: TIP_SANDUCIC_TEST,
      deduplikacijskiKljuc: 'test:nova',
      stvorenaAt: new Date('2026-11-07T10:01:00.000Z'),
    });
    const broj = await oznaciSveProcitane(igrac.id, granica);
    expect(broj).toBe(1);

    const sazetak = await dohvatiSazetak(igrac.id);
    expect(sazetak.brojNeprocitanih).toBe(1);
    expect(sazetak.zaNajavu.map((p) => p.id)).toEqual([nova!.id]);
    expect(stara).toBeTruthy();
  });

  it('gost može čitati vlastiti sandučic, tuđi ID je 404', async () => {
    const gost = await noviIgrac('gost');
    const drugi = await noviIgrac('gost');
    const poruka = await stvoriPoruku({
      igracId: gost.id,
      tip: TIP_SANDUCIC_TEST,
      deduplikacijskiKljuc: 'test:gost',
    });
    const tuda = await stvoriPoruku({
      igracId: drugi.id,
      tip: TIP_SANDUCIC_TEST,
      deduplikacijskiKljuc: 'test:tuda',
    });

    const sazetak = await fetch(`${adresa}/api/sanducic/sazetak`, {
      headers: { authorization: `Bearer ${gost.token}` },
    });
    expect(sazetak.status).toBe(200);
    const tijelo = await sazetak.json() as { brojNeprocitanih: number };
    expect(tijelo.brojNeprocitanih).toBe(1);

    const tudaDetalj = await fetch(`${adresa}/api/sanducic/${tuda!.id}`, {
      headers: { authorization: `Bearer ${gost.token}` },
    });
    expect(tudaDetalj.status).toBe(404);

    const vlastita = await fetch(`${adresa}/api/sanducic/${poruka!.id}`, {
      headers: { authorization: `Bearer ${gost.token}` },
    });
    expect(vlastita.status).toBe(200);
  });

  it('briše poruke starije od 3 dana', async () => {
    const igrac = await noviIgrac();
    const sada = new Date('2026-11-07T12:00:00.000Z');
    await stvoriPoruku({
      igracId: igrac.id,
      tip: TIP_SANDUCIC_TEST,
      deduplikacijskiKljuc: 'test:stara-3d',
      stvorenaAt: new Date(sada.getTime() - ROK_SANDUCIC_PORUKE_MS - 60_000),
    });
    await stvoriPoruku({
      igracId: igrac.id,
      tip: TIP_SANDUCIC_TEST,
      deduplikacijskiKljuc: 'test:svjeza',
      stvorenaAt: sada,
    });
    const obrisano = await ocistiStareSanducicPoruke(sada);
    expect(obrisano).toBe(1);
    const preostale = await baza.select().from(sanducicPoruke).where(eq(sanducicPoruke.igracId, igrac.id));
    expect(preostale).toHaveLength(1);
    expect(preostale[0]?.deduplikacijskiKljuc).toBe('test:svjeza');
  });

  it('soft-delete uklanja sandučic poruke', async () => {
    const igrac = await noviIgrac('registriran');
    await stvoriPoruku({
      igracId: igrac.id,
      tip: TIP_SANDUCIC_TEST,
      deduplikacijskiKljuc: 'test:brisanje',
    });
    expect(await obrisiRacun(igrac.email!, true)).toBe('obrisan');
    const preostale = await baza.select().from(sanducicPoruke).where(eq(sanducicPoruke.igracId, igrac.id));
    expect(preostale).toHaveLength(0);
  });

  it('dobrodošlica i potvrda emaila su jednokratne; patchira CTA', async () => {
    const igrac = await noviIgrac();
    await stvoriDobrodoslicu(igrac.id, igrac.email!);
    await stvoriDobrodoslicu(igrac.id, igrac.email!);
    let redovi = await baza.select().from(sanducicPoruke).where(eq(sanducicPoruke.igracId, igrac.id));
    expect(redovi.filter((r) => r.tip === TIP_SANDUCIC_DOBRODOSLICA)).toHaveLength(1);

    await stvoriPorukuPotvrdeEmaila(igrac.id);
    await stvoriPorukuPotvrdeEmaila(igrac.id);
    redovi = await baza.select().from(sanducicPoruke).where(eq(sanducicPoruke.igracId, igrac.id));
    expect(redovi.filter((r) => r.tip === TIP_SANDUCIC_EMAIL_POTVRDEN)).toHaveLength(1);
    const dobrodoslica = redovi.find((r) => r.tip === TIP_SANDUCIC_DOBRODOSLICA);
    expect(dobrodoslica?.podaci?.emailPotvrdjen).toBe(true);
  });

  it('prva igra jednom; baseline prekretnica blokira poruku; bot ne dobiva', async () => {
    const igrac = await noviIgrac();
    await mozdaObavijestiPrvuIgru({
      igracId: igrac.id,
      jeGost: false,
      jeBot: false,
      izvorId: randomUUID(),
      kontekst: 'javna',
      mod: 'dva_igraca',
    });
    await mozdaObavijestiPrvuIgru({
      igracId: igrac.id,
      jeGost: false,
      jeBot: false,
      izvorId: randomUUID(),
      kontekst: 'privatna',
    });
    let poruke = await baza.select().from(sanducicPoruke).where(eq(sanducicPoruke.igracId, igrac.id));
    expect(poruke.filter((r) => r.tip === TIP_SANDUCIC_PRVA_IGRA)).toHaveLength(1);

    const baseline = await noviIgrac();
    await baza.insert(sanducicPrekretnice).values({ igracId: baseline.id, kljuc: 'prva_igra' });
    await mozdaObavijestiPrvuIgru({
      igracId: baseline.id,
      jeGost: false,
      jeBot: false,
      izvorId: randomUUID(),
      kontekst: 'trening',
    });
    poruke = await baza.select().from(sanducicPoruke).where(eq(sanducicPoruke.igracId, baseline.id));
    expect(poruke.filter((r) => r.tip === TIP_SANDUCIC_PRVA_IGRA)).toHaveLength(0);

    const botId = randomUUID();
    igraciZaBrisanje.push(botId);
    await baza.insert(igraci).values({
      id: botId,
      vrsta: 'registriran',
      upravljac: 'bot',
      nadimak: `Bot ${botId.slice(0, 6)}`,
    });
    await mozdaObavijestiPrvuIgru({
      igracId: botId,
      jeGost: false,
      jeBot: true,
      izvorId: randomUUID(),
      kontekst: 'javna',
    });
    poruke = await baza.select().from(sanducicPoruke).where(eq(sanducicPoruke.igracId, botId));
    expect(poruke).toHaveLength(0);
  });

  it('gost zadržava sandučic poruke nakon registracije istog ID-a', async () => {
    const gost = await noviIgrac('gost');
    await stvoriPoruku({
      igracId: gost.id,
      tip: TIP_SANDUCIC_TEST,
      deduplikacijskiKljuc: 'test:prije-rega',
    });
    await stvoriPoruku({
      igracId: gost.id,
      tip: TIP_SANDUCIC_PRVA_IGRA,
      deduplikacijskiKljuc: 'prva_igra',
      podaci: { gost: true },
    });
    const email = `reg-${gost.id}@example.com`;
    await baza.update(igraci).set({
      vrsta: 'registriran',
      email,
      lozinkaHash: 'lozinka123',
      emailPotvrdjen: false,
    }).where(eq(igraci.id, gost.id));
    await stvoriDobrodoslicu(gost.id, email);

    const redovi = await baza.select().from(sanducicPoruke).where(eq(sanducicPoruke.igracId, gost.id));
    expect(redovi.map((r) => r.deduplikacijskiKljuc).sort()).toEqual(['dobrodoslica', 'prva_igra', 'test:prije-rega']);
    expect(redovi.find((r) => r.tip === TIP_SANDUCIC_PRVA_IGRA)?.podaci?.gost).toBe(false);
  });

  it('HTTP feedback stvara zahvalu u sandučicu', async () => {
    const igrac = await noviIgrac();
    const odgovor = await fetch(`${adresa}/api/povratne-informacije`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${igrac.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ poruka: 'Ovo je dovoljno duga povratna informacija za test.' }),
    });
    expect(odgovor.status).toBe(200);
    const redovi = await baza.select().from(sanducicPoruke).where(eq(sanducicPoruke.igracId, igrac.id));
    expect(redovi.some((r) => r.tip === TIP_SANDUCIC_FEEDBACK)).toBe(true);
  });

  it('PR3: XP/zvjezdica/kolekcija dedupe + lazy baseline; rang po partiji', async () => {
    const igrac = await noviIgrac();
    const baseline = await noviIgrac();
    await baza.transaction(async (tx) => {
      const xpPrvi = await stvoriPorukeXpRazina({
        igracId: igrac.id,
        razinaPrije: 1,
        razinaPoslije: 3,
        tx,
      });
      expect(xpPrvi).toBe(2);
      const xpPonovo = await stvoriPorukeXpRazina({
        igracId: igrac.id,
        razinaPrije: 1,
        razinaPoslije: 3,
        tx,
      });
      expect(xpPonovo).toBe(0);

      const xpBaseline = await stvoriPorukeXpRazina({
        igracId: baseline.id,
        razinaPrije: 5,
        razinaPoslije: 6,
        tx,
      });
      expect(xpBaseline).toBe(1);
      const prekretnice = await tx.select().from(sanducicPrekretnice).where(eq(sanducicPrekretnice.igracId, baseline.id));
      expect(prekretnice.some((r) => r.kljuc === 'xp_razina:5')).toBe(true);
      expect(prekretnice.some((r) => r.kljuc === 'xp_razina:6')).toBe(true);

      const zvijezde = await stvoriPorukeZvjezdica({
        igracId: igrac.id,
        dostignuceId: 'zagrijan',
        staraRazina: 0,
        novaRazina: 2,
        tx,
      });
      expect(zvijezde).toBe(2);
      const zvijezdePonovo = await stvoriPorukeZvjezdica({
        igracId: igrac.id,
        dostignuceId: 'zagrijan',
        staraRazina: 0,
        novaRazina: 2,
        tx,
      });
      expect(zvijezdePonovo).toBe(0);

      const kolekcija = await stvoriPorukeKolekcije({
        igracId: igrac.id,
        brojPrije: 9,
        brojPoslije: 10,
        tx,
      });
      expect(kolekcija).toBe(1);
      const kolekcijaPonovo = await stvoriPorukeKolekcije({
        igracId: igrac.id,
        brojPrije: 9,
        brojPoslije: 10,
        tx,
      });
      expect(kolekcijaPonovo).toBe(0);

      const partijaId = randomUUID();
      const rang = await stvoriPorukuPromjeneRanga({
        igracId: igrac.id,
        mod: 'dva_igraca',
        rangPrije: 'Početnik',
        rangPoslije: 'Piskaralo',
        napredak: true,
        tx,
        izvorId: partijaId,
      });
      expect(rang).toBe(true);
      const rangPonovo = await stvoriPorukuPromjeneRanga({
        igracId: igrac.id,
        mod: 'dva_igraca',
        rangPrije: 'Početnik',
        rangPoslije: 'Piskaralo',
        napredak: true,
        tx,
        izvorId: partijaId,
      });
      expect(rangPonovo).toBe(false);
    });

    const redovi = await baza.select().from(sanducicPoruke).where(eq(sanducicPoruke.igracId, igrac.id));
    expect(redovi.filter((r) => r.tip === TIP_SANDUCIC_NOVA_XP_RAZINA)).toHaveLength(2);
    expect(redovi.filter((r) => r.tip === TIP_SANDUCIC_NOVA_ZVJEZDICA)).toHaveLength(2);
    expect(redovi.filter((r) => r.tip === TIP_SANDUCIC_NOVA_KOLEKCIONARSKA_RAZINA)).toHaveLength(1);
    expect(redovi.filter((r) => r.tip === TIP_SANDUCIC_PROMJENA_RANGA)).toHaveLength(1);
  });

  it('PR4: forma_10 na 10/20, baseline nižih pragova, dedupe', async () => {
    const igrac = await noviIgrac();
    await baza.transaction(async (tx) => {
      expect(await stvoriPorukuForme10({
        igracId: igrac.id,
        mod: 'dva_igraca',
        odigraneNakon: 9,
        nazivForme: 'Prolazna',
        pobjede: 2,
        trenutniNiz: 0,
        tx,
        izvorId: randomUUID(),
      })).toBe(false);

      expect(await stvoriPorukuForme10({
        igracId: igrac.id,
        mod: 'dva_igraca',
        odigraneNakon: 10,
        nazivForme: 'Dobra',
        pobjede: 4,
        trenutniNiz: 2,
        tx,
        izvorId: randomUUID(),
      })).toBe(true);

      expect(await stvoriPorukuForme10({
        igracId: igrac.id,
        mod: 'dva_igraca',
        odigraneNakon: 11,
        nazivForme: 'Dobra',
        pobjede: 4,
        trenutniNiz: 1,
        tx,
        izvorId: randomUUID(),
      })).toBe(false);

      expect(await stvoriPorukuForme10({
        igracId: igrac.id,
        mod: 'dva_igraca',
        odigraneNakon: 20,
        nazivForme: 'Odlična',
        pobjede: 6,
        trenutniNiz: 3,
        tx,
        izvorId: randomUUID(),
      })).toBe(true);

      expect(await stvoriPorukuForme10({
        igracId: igrac.id,
        mod: 'dva_igraca',
        odigraneNakon: 20,
        nazivForme: 'Odlična',
        pobjede: 6,
        trenutniNiz: 3,
        tx,
        izvorId: randomUUID(),
      })).toBe(false);

      // Četveroboj zasebno; snapshot forme po prosjeku bodova (naziv u podacima).
      expect(await stvoriPorukuForme10({
        igracId: igrac.id,
        mod: 'cetiri_igraca',
        odigraneNakon: 10,
        nazivForme: 'Dobra',
        pobjede: 1,
        trenutniNiz: 0,
        tx,
        izvorId: randomUUID(),
      })).toBe(true);
    });

    const redovi = await baza.select().from(sanducicPoruke).where(eq(sanducicPoruke.igracId, igrac.id));
    const forme = redovi.filter((r) => r.tip === TIP_SANDUCIC_FORMA_10);
    expect(forme).toHaveLength(3);
    expect(forme.find((r) => r.deduplikacijskiKljuc === 'forma_10:dva_igraca:10')?.podaci?.pobjede).toBe(4);
    expect(forme.find((r) => r.deduplikacijskiKljuc === 'forma_10:dva_igraca:20')?.podaci?.nazivForme).toBe('Odlična');
  });

  it('PR4: gost_sazetak_5 na 5/10; registrirani i bot ne; trening claim', async () => {
    const gost = await noviIgrac('gost');
    const reg = await noviIgrac('registriran');

    await baza.transaction(async (tx) => {
      expect(await stvoriPorukuGostSazetak({
        igracId: gost.id,
        jeGost: true,
        dovrseneNakon: 4,
        tx,
        izvorTip: 'trening',
        izvorId: randomUUID(),
      })).toBe(false);

      expect(await stvoriPorukuGostSazetak({
        igracId: gost.id,
        jeGost: true,
        dovrseneNakon: 5,
        tx,
        izvorTip: 'trening',
        izvorId: randomUUID(),
      })).toBe(true);

      expect(await stvoriPorukuGostSazetak({
        igracId: gost.id,
        jeGost: true,
        dovrseneNakon: 10,
        tx,
        izvorTip: 'javna',
        izvorId: randomUUID(),
      })).toBe(true);

      expect(await stvoriPorukuGostSazetak({
        igracId: reg.id,
        jeGost: false,
        dovrseneNakon: 5,
        tx,
        izvorTip: 'trening',
        izvorId: randomUUID(),
      })).toBe(false);
    });

    const treningId = randomUUID();
    expect(await obradiDovrsenuIgruSanducic({
      igracId: gost.id,
      jeBot: false,
      izvorTip: 'trening',
      izvorId: treningId,
    })).toBe(false); // 6. igra — nije prag
    const [nakon] = await baza.select({ dovrseneIgre: igraci.dovrseneIgre }).from(igraci).where(eq(igraci.id, gost.id));
    expect(nakon?.dovrseneIgre).toBe(1);
    expect(await obradiDovrsenuIgruSanducic({
      igracId: gost.id,
      jeBot: false,
      izvorTip: 'trening',
      izvorId: treningId,
    })).toBe(false); // retry claim
    const [nakonRetry] = await baza.select({ dovrseneIgre: igraci.dovrseneIgre }).from(igraci).where(eq(igraci.id, gost.id));
    expect(nakonRetry?.dovrseneIgre).toBe(1);

    expect(await obradiDovrsenuIgruSanducic({
      igracId: gost.id,
      jeBot: true,
      izvorTip: 'trening',
      izvorId: randomUUID(),
    })).toBe(false);

    await stvoriDobrodoslicu(gost.id, `gost-reg-${gost.id}@example.com`);
    const gostPoruke = await baza.select().from(sanducicPoruke).where(eq(sanducicPoruke.igracId, gost.id));
    const sazeci = gostPoruke.filter((r) => r.tip === TIP_SANDUCIC_GOST_SAZETAK_5);
    expect(sazeci.length).toBeGreaterThanOrEqual(2);
    expect(sazeci.every((r) => r.podaci?.registriran === true)).toBe(true);
  });
});
