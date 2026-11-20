/**
 * PR04: settlement XP, Izazivač, misije, idempotencija, cap, gost.
 */
import { afterAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import {
  DEFINICIJE_MISIJA,
  ID_DOSTIGNUCA_IZAZIVAC,
  MAKSIMALNO_ISKUSTVO,
  definicijaIzazova,
  stanjeIskustva,
} from 'zajednicko';
import { baza } from '../src/baza/klijent.js';
import {
  dodjeleMisija,
  dostignucaIgraca,
  igraci,
  ishodiMisijaIgara,
  napredakDostignucaIgraca,
  pokusajiIzazova,
  zavrseciIzazova,
} from '../src/baza/shema.js';
import {
  izazovKvalificiraZaMisiju,
  obracunajSettlementIzazova,
} from '../src/izazovi/obracun.js';
import { evaluirajNapredak, prazneCinjenice } from '../src/izazovi/evaluacija.js';
import { umetniRezerviraniPokusaj } from '../src/izazovi/pohrana.js';
import { zavrsiPokusajIzazova } from '../src/izazovi/zavrsetak.js';
import { osigurajStanjeMisija } from '../src/misije/stanje.js';
import { PRIHVAT_UVJETA_ZA_TEST } from './pomocnici/uvjeti.js';

const zaBrisanje: string[] = [];

afterAll(async () => {
  for (const id of zaBrisanje) {
    await baza.delete(ishodiMisijaIgara).where(eq(ishodiMisijaIgara.igracId, id));
    await baza.delete(zavrseciIzazova).where(eq(zavrseciIzazova.igracId, id));
    await baza.delete(pokusajiIzazova).where(eq(pokusajiIzazova.igracId, id));
    await baza.delete(dostignucaIgraca).where(eq(dostignucaIgraca.igracId, id));
    await baza.delete(napredakDostignucaIgraca).where(eq(napredakDostignucaIgraca.igracId, id));
    await baza.delete(igraci).where(eq(igraci.id, id));
  }
});

async function noviIgrac(opcije: {
  vrsta?: 'gost' | 'registriran';
  iskustvoUkupno?: number;
} = {}): Promise<string> {
  const id = randomUUID();
  zaBrisanje.push(id);
  const vrsta = opcije.vrsta ?? 'registriran';
  await baza.insert(igraci).values({
    id,
    vrsta,
    nadimak: `Iz${id.slice(0, 6)}`,
    ...(vrsta === 'registriran'
      ? {
        email: `izazov-pr04-${id.slice(0, 8)}@example.com`,
        emailPotvrdjen: true,
        ...PRIHVAT_UVJETA_ZA_TEST,
      }
      : {}),
    iskustvoUkupno: opcije.iskustvoUkupno ?? 0,
  });
  return id;
}

async function pripremiPokusaj(igracId: string, challengeId: 'IZ01' | 'IZ02' = 'IZ01') {
  const pokusaj = await umetniRezerviraniPokusaj({
    igracId,
    requestId: randomUUID(),
    definicija: definicijaIzazova(challengeId),
    accountTypeAtStart: 'gost',
    seed: 'pr04',
  });
  await baza.update(pokusajiIzazova).set({ status: 'u_tijeku' }).where(eq(pokusajiIzazova.id, pokusaj.id));
  return pokusaj;
}

function metrikeUspjeh(prihvaceneRijeci = 1) {
  return {
    dugeRijeci: 0,
    rijetkeRijeci: 0,
    uspjesniDokazi: 0,
    imaPravuPogresku: false,
    prihvaceneRijeci,
    goalProgress: evaluirajNapredak({}, prazneCinjenice()),
  };
}

describe('Izazov PR04 — kvalifikacija misija', () => {
  it('broji uspjeh i igrački neuspjeh uz riječ; ne broji odustao/prekid/bez riječi', () => {
    expect(izazovKvalificiraZaMisiju({ status: 'uspjeh', reason: null, prihvaceneRijeci: 1 })).toBe(true);
    expect(izazovKvalificiraZaMisiju({
      status: 'neuspjeh',
      reason: 'cilj_neispunjen',
      prihvaceneRijeci: 2,
    })).toBe(true);
    expect(izazovKvalificiraZaMisiju({
      status: 'neuspjeh',
      reason: 'eliminiran',
      prihvaceneRijeci: 1,
    })).toBe(true);
    expect(izazovKvalificiraZaMisiju({
      status: 'neuspjeh',
      reason: 'odustao',
      prihvaceneRijeci: 5,
    })).toBe(false);
    expect(izazovKvalificiraZaMisiju({
      status: 'neuspjeh',
      reason: 'prekid_veze',
      prihvaceneRijeci: 5,
    })).toBe(false);
    expect(izazovKvalificiraZaMisiju({
      status: 'neuspjeh',
      reason: 'eliminiran',
      prihvaceneRijeci: 0,
    })).toBe(false);
    expect(izazovKvalificiraZaMisiju({
      status: 'tehnicki_prekinuto',
      reason: null,
      prihvaceneRijeci: 3,
    })).toBe(false);
  });
});

describe('Izazov PR04 — settlement XP i Izazivač', () => {
  it('prvi uspjeh daje kampanjski XP i Izazivač ★; retry ne duplira', async () => {
    const igracId = await noviIgrac({ vrsta: 'gost' });
    const pokusaj = await pripremiPokusaj(igracId, 'IZ01');
    const prvi = await zavrsiPokusajIzazova({
      attemptId: pokusaj.id,
      status: 'uspjeh',
      metrics: metrikeUspjeh(1),
      gameWon: true,
    });
    expect(prvi?.settlement.firstCompletion).toBe(true);
    expect(prvi?.settlement.challengeXp).toEqual({ nominal: 100, awarded: 100 });
    expect(prvi?.settlement.izazivac.zvjezdice).toBe(1);
    expect(prvi?.settlement.izazivac.novaRazina).toBe(1);
    expect(prvi?.settlement.settlementState).toBe('spremljeno');

    const [igrac] = await baza.select({
      iskustvoUkupno: igraci.iskustvoUkupno,
      rangSumaJedinica: igraci.rangSumaJedinica,
      rangBrojPartija: igraci.rangBrojPartija,
    }).from(igraci).where(eq(igraci.id, igracId));
    expect(igrac?.iskustvoUkupno).toBe(100);
    expect(igrac?.rangSumaJedinica).toBe(0);
    expect(igrac?.rangBrojPartija).toBe(0);

    const [zv] = await baza.select().from(dostignucaIgraca).where(and(
      eq(dostignucaIgraca.igracId, igracId),
      eq(dostignucaIgraca.dostignuceId, ID_DOSTIGNUCA_IZAZIVAC),
    ));
    expect(zv?.razina).toBe(1);

    const drugi = await zavrsiPokusajIzazova({
      attemptId: pokusaj.id,
      status: 'uspjeh',
      metrics: metrikeUspjeh(1),
      gameWon: true,
    });
    expect(drugi?.settlement.firstCompletion).toBe(true);
    expect(drugi?.settlement.challengeXp.awarded).toBe(100);

    const [ponovo] = await baza.select({ iskustvoUkupno: igraci.iskustvoUkupno }).from(igraci).where(eq(igraci.id, igracId));
    expect(ponovo?.iskustvoUkupno).toBe(100);

    const zavrseci = await baza.select().from(zavrseciIzazova).where(eq(zavrseciIzazova.igracId, igracId));
    expect(zavrseci).toHaveLength(1);
  });

  it('paralelni uspjesi iste razine → jedna nagrada', async () => {
    const igracId = await noviIgrac({ vrsta: 'gost' });
    const a = await pripremiPokusaj(igracId, 'IZ01');
    // Drugi aktivni pokušaj nije moguć u DB — simuliraj dva terminalna reda ručno nije;
    // umjesto toga dva paralelna zavrsi na istom attemptu (CAS + settlement race).
    const [r1, r2] = await Promise.all([
      zavrsiPokusajIzazova({
        attemptId: a.id,
        status: 'uspjeh',
        metrics: metrikeUspjeh(1),
        gameWon: true,
      }),
      zavrsiPokusajIzazova({
        attemptId: a.id,
        status: 'uspjeh',
        metrics: metrikeUspjeh(1),
        gameWon: true,
      }),
    ]);
    expect(r1 && r2).toBeTruthy();
    const zavrseci = await baza.select().from(zavrseciIzazova).where(eq(zavrseciIzazova.igracId, igracId));
    expect(zavrseci).toHaveLength(1);
    const [igrac] = await baza.select({ iskustvoUkupno: igraci.iskustvoUkupno }).from(igraci).where(eq(igraci.id, igracId));
    expect(igrac?.iskustvoUkupno).toBe(100);
  });

  it('dva uspjeha iste razine na različitim attemptima → jedna nagrada', async () => {
    const igracId = await noviIgrac({ vrsta: 'gost' });
    const prvi = await pripremiPokusaj(igracId, 'IZ01');
    await zavrsiPokusajIzazova({
      attemptId: prvi.id,
      status: 'uspjeh',
      metrics: metrikeUspjeh(1),
      gameWon: true,
    });

    const drugi = await umetniRezerviraniPokusaj({
      igracId,
      requestId: randomUUID(),
      definicija: definicijaIzazova('IZ01'),
      accountTypeAtStart: 'gost',
      seed: 'pr04-b',
    });
    await baza.update(pokusajiIzazova).set({ status: 'u_tijeku' }).where(eq(pokusajiIzazova.id, drugi.id));
    const ishod = await zavrsiPokusajIzazova({
      attemptId: drugi.id,
      status: 'uspjeh',
      metrics: metrikeUspjeh(1),
      gameWon: true,
    });
    expect(ishod?.settlement.firstCompletion).toBe(false);
    expect(ishod?.settlement.challengeXp.awarded).toBe(0);
    const [igrac] = await baza.select({ iskustvoUkupno: igraci.iskustvoUkupno }).from(igraci).where(eq(igraci.id, igracId));
    expect(igrac?.iskustvoUkupno).toBe(100);
  });

  it('nova definitionVersion ne resetira nagradu', async () => {
    const igracId = await noviIgrac({ vrsta: 'gost' });
    const prvi = await pripremiPokusaj(igracId, 'IZ01');
    await zavrsiPokusajIzazova({
      attemptId: prvi.id,
      status: 'uspjeh',
      metrics: metrikeUspjeh(1),
      gameWon: true,
    });

    const drugi = await umetniRezerviraniPokusaj({
      igracId,
      requestId: randomUUID(),
      definicija: { ...definicijaIzazova('IZ01') },
      accountTypeAtStart: 'gost',
      seed: 'pr04-v2',
    });
    await baza.update(pokusajiIzazova).set({
      status: 'u_tijeku',
      definitionVersion: 999,
    }).where(eq(pokusajiIzazova.id, drugi.id));
    const ishod = await zavrsiPokusajIzazova({
      attemptId: drugi.id,
      status: 'uspjeh',
      metrics: metrikeUspjeh(1),
      gameWon: true,
    });
    expect(ishod?.settlement.firstCompletion).toBe(false);
    expect(ishod?.settlement.challengeXp.awarded).toBe(0);
    const zavrseci = await baza.select().from(zavrseciIzazova).where(eq(zavrseciIzazova.igracId, igracId));
    expect(zavrseci).toHaveLength(1);
  });

  it('cap LVL100: awarded < nominal', async () => {
    const igracId = await noviIgrac({
      vrsta: 'gost',
      iskustvoUkupno: MAKSIMALNO_ISKUSTVO - 40,
    });
    const pokusaj = await pripremiPokusaj(igracId, 'IZ01');
    const ishod = await zavrsiPokusajIzazova({
      attemptId: pokusaj.id,
      status: 'uspjeh',
      metrics: metrikeUspjeh(1),
      gameWon: true,
    });
    expect(ishod?.settlement.challengeXp).toEqual({ nominal: 100, awarded: 40 });
    const [igrac] = await baza.select({ iskustvoUkupno: igraci.iskustvoUkupno }).from(igraci).where(eq(igraci.id, igracId));
    expect(igrac?.iskustvoUkupno).toBe(MAKSIMALNO_ISKUSTVO);
    expect(stanjeIskustva(igrac!.iskustvoUkupno).razina).toBe(100);
  });

  it('pobjeda bez cilja (cilj_neispunjen) → nema kampanjskog XP; misija može', async () => {
    const igracId = await noviIgrac({ vrsta: 'registriran' });
    const sada = new Date('2026-11-20T12:00:00+01:00');
    await baza.transaction((tx) => osigurajStanjeMisija(tx, igracId, { sada: () => sada, rng: () => 0.42 }));
    await forsiraD25(igracId);

    const pokusaj = await pripremiPokusaj(igracId, 'IZ01');
    const ishod = await zavrsiPokusajIzazova({
      attemptId: pokusaj.id,
      status: 'neuspjeh',
      razlog: 'cilj_neispunjen',
      metrics: metrikeUspjeh(2),
      gameWon: true,
    });
    expect(ishod?.settlement.firstCompletion).toBe(false);
    expect(ishod?.settlement.challengeXp.awarded).toBe(0);
    expect(ishod?.settlement.missionXp.nominal).toBeGreaterThanOrEqual(0);
    expect(ishod?.settlement.ishodMisija?.promjeneMisija.some((p) => p.predlozakId === 'D25')).toBe(true);

    const zavrseci = await baza.select().from(zavrseciIzazova).where(eq(zavrseciIzazova.igracId, igracId));
    expect(zavrseci).toHaveLength(0);
    const [igrac] = await baza.select({
      iskustvoUkupno: igraci.iskustvoUkupno,
      rangSumaJedinica: igraci.rangSumaJedinica,
    }).from(igraci).where(eq(igraci.id, igracId));
    expect(igrac?.rangSumaJedinica).toBe(0);
  });

  it('poraz bez riječi / odustao → bez misije', async () => {
    const igracId = await noviIgrac({ vrsta: 'registriran' });
    const sada = new Date('2026-11-20T12:00:00+01:00');
    await baza.transaction((tx) => osigurajStanjeMisija(tx, igracId, { sada: () => sada, rng: () => 0.42 }));
    await forsiraD25(igracId);

    const bezRijeci = await pripremiPokusaj(igracId, 'IZ01');
    const a = await zavrsiPokusajIzazova({
      attemptId: bezRijeci.id,
      status: 'neuspjeh',
      razlog: 'eliminiran',
      metrics: metrikeUspjeh(0),
      gameWon: false,
    });
    expect(a?.settlement.ishodMisija).toBeNull();
    expect(a?.settlement.missionXp.awarded).toBe(0);

    const odustao = await umetniRezerviraniPokusaj({
      igracId,
      requestId: randomUUID(),
      definicija: definicijaIzazova('IZ01'),
      accountTypeAtStart: 'gost',
      seed: 'odustao',
    });
    await baza.update(pokusajiIzazova).set({ status: 'u_tijeku' }).where(eq(pokusajiIzazova.id, odustao.id));
    const b = await zavrsiPokusajIzazova({
      attemptId: odustao.id,
      status: 'neuspjeh',
      razlog: 'odustao',
      metrics: metrikeUspjeh(3),
      gameWon: false,
    });
    expect(b?.settlement.ishodMisija).toBeNull();
  });

  it('gost→registracija ne duplira XP', async () => {
    const igracId = await noviIgrac({ vrsta: 'gost' });
    const pokusaj = await pripremiPokusaj(igracId, 'IZ01');
    await zavrsiPokusajIzazova({
      attemptId: pokusaj.id,
      status: 'uspjeh',
      metrics: metrikeUspjeh(1),
      gameWon: true,
    });
    await baza.update(igraci).set({
      vrsta: 'registriran',
      email: `gost-reg-${igracId.slice(0, 8)}@example.com`,
      emailPotvrdjen: true,
      ...PRIHVAT_UVJETA_ZA_TEST,
    }).where(eq(igraci.id, igracId));

    const ponovo = await obracunajSettlementIzazova(
      (await baza.select().from(pokusajiIzazova).where(eq(pokusajiIzazova.id, pokusaj.id)))[0]!,
    );
    expect(ponovo.challengeXp.awarded).toBe(100);
    const [igrac] = await baza.select({ iskustvoUkupno: igraci.iskustvoUkupno }).from(igraci).where(eq(igraci.id, igracId));
    expect(igrac?.iskustvoUkupno).toBe(100);
  });

  it('tehnicki_prekinuto ne dira XP ni settlement', async () => {
    const igracId = await noviIgrac({ vrsta: 'gost' });
    const pokusaj = await pripremiPokusaj(igracId, 'IZ01');
    const ishod = await zavrsiPokusajIzazova({
      attemptId: pokusaj.id,
      status: 'tehnicki_prekinuto',
      metrics: metrikeUspjeh(1),
      gameWon: null,
    });
    expect(ishod?.settlement.settlementState).toBe('nije_potrebno');
    expect(ishod?.redak.settlementState).toBe('nije_potrebno');
    const [igrac] = await baza.select({ iskustvoUkupno: igraci.iskustvoUkupno }).from(igraci).where(eq(igraci.id, igracId));
    expect(igrac?.iskustvoUkupno).toBe(0);
  });
});

async function forsiraD25(igracId: string) {
  const d25 = DEFINICIJE_MISIJA.find((d) => d.predlozakId === 'D25')!;
  await baza.transaction(async (tx) => {
    const [aktivna] = await tx.select().from(dodjeleMisija).where(and(
      eq(dodjeleMisija.igracId, igracId),
      eq(dodjeleMisija.vrsta, 'dnevna'),
      eq(dodjeleMisija.status, 'aktivna'),
    ));
    if (!aktivna) return;
    await tx.update(dodjeleMisija).set({
      predlozakId: 'D25',
      cilj: d25.cilj,
      napredak: 0,
      snapshot: {
        predlozakId: 'D25',
        verzijaDefinicije: 1,
        naziv: d25.naziv,
        opis: d25.opis,
        metrika: d25.metrika,
        cilj: d25.cilj,
        pragMetrike: null,
        podciljevi: null,
        xp: d25.xp,
        obitelj: d25.obitelj,
        zahtjevnija: false,
        kontekst: 'izazov',
        mod: 'oba',
      },
    }).where(eq(dodjeleMisija.id, aktivna.id));
  });
}
