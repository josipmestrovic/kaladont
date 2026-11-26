/**
 * Kumulativne ljestvice ukupnog napretka (XP, kolekcija, izazovi, dostignuća).
 * Cache 60 s; personalizacija se primjenjuje nakon zajedničkog poretka.
 */
import { and, eq, gt, inArray, isNull } from 'drizzle-orm';
import {
  BROJ_AKTIVNIH_IZAZOVA,
  brojKolekcijskihJedinica,
  ID_OVI_IZAZOVA,
  izgradiAgregateLevela,
  izracunajSazetakZvjezdicaDostignuca,
  NAZIVI_LEVELA_IZAZOVA,
  stanjeIskustva,
  type AvatarConfigV1,
  type MetrikaNapretkaLjestvice,
  type PozicijaNaLjestvici,
  type VrijednostLjestvice,
} from 'zajednicko';
import { baza } from '../baza/klijent.js';
import {
  dostignucaIgraca,
  igraci,
  napredakDostignucaIgraca,
  nizAktivnostiIgraca,
  otkljucaneGrupeIgraca,
  zavrseciIzazova,
} from '../baza/shema.js';
import { konfiguracija } from '../konfiguracija.js';
import type { Poredak, StavkaPoretka } from './servis.js';

export const TRAJANJE_MEMORIJE_NAPRETKA_MS = 60_000;

const AKTIVNI_IZAZOVI = new Set<string>(ID_OVI_IZAZOVA);

interface IdentitetIgraca {
  id: string;
  nadimak: string;
  vrsta: 'gost' | 'registriran' | 'admin';
  avatarId: number;
  avatarConfig: AvatarConfigV1 | null;
  avatarRevision: number;
  iskustvoUkupno: number;
}

function uStavkuIdentiteta(
  igrac: IdentitetIgraca,
  vrijednost: VrijednostLjestvice,
  mjesto: number | null,
): StavkaPoretka {
  return {
    igracId: igrac.id,
    nadimak: igrac.nadimak,
    jeJavanProfil: igrac.vrsta !== 'gost',
    odigraneIgre: 0,
    prihvaceniPotezi: 0,
    nepotpuno: false,
    vrijednost,
    imaRezultat: true,
    mjesto,
    avatarId: igrac.avatarId,
    avatarConfig: igrac.avatarConfig,
    avatarRevision: igrac.avatarRevision,
  };
}

function poredaj(
  kandidati: Array<{ igrac: IdentitetIgraca; vrijednost: VrijednostLjestvice; kljucevi: number[] }>,
): Poredak {
  kandidati.sort((a, b) => {
    for (let i = 0; i < Math.max(a.kljucevi.length, b.kljucevi.length); i += 1) {
      const diff = (a.kljucevi[i] ?? 0) - (b.kljucevi[i] ?? 0);
      if (diff !== 0) return diff;
    }
    return a.igrac.id.localeCompare(b.igrac.id);
  });
  const rangirani: StavkaPoretka[] = [];
  const poIgracu = new Map<string, StavkaPoretka>();
  kandidati.forEach((k, indeks) => {
    const stavka = uStavkuIdentiteta(k.igrac, k.vrijednost, indeks + 1);
    rangirani.push(stavka);
    poIgracu.set(stavka.igracId, stavka);
  });
  return { rangirani, poIgracu, minimumIgara: 0, minimumPoteza: null };
}

async function dohvatiIdentitete(ids?: string[]): Promise<Map<string, IdentitetIgraca>> {
  const uvjeti = [
    isNull(igraci.obrisanAt),
    eq(igraci.upravljac, 'covjek'),
    inArray(igraci.vrsta, ['gost', 'registriran', 'admin']),
  ];
  if (ids && ids.length > 0) uvjeti.push(inArray(igraci.id, ids));
  const redovi = await baza
    .select({
      id: igraci.id,
      nadimak: igraci.nadimak,
      vrsta: igraci.vrsta,
      avatarId: igraci.avatarId,
      avatarConfig: igraci.avatarConfig,
      avatarRevision: igraci.avatarRevision,
      iskustvoUkupno: igraci.iskustvoUkupno,
    })
    .from(igraci)
    .where(and(...uvjeti));
  return new Map(redovi.map((r) => [r.id, {
    id: r.id,
    nadimak: r.nadimak,
    vrsta: r.vrsta as IdentitetIgraca['vrsta'],
    avatarId: r.avatarId,
    avatarConfig: r.avatarConfig as AvatarConfigV1 | null,
    avatarRevision: r.avatarRevision,
    iskustvoUkupno: r.iskustvoUkupno,
  } satisfies IdentitetIgraca]));
}

async function izracunajIskustvo(): Promise<Poredak> {
  const redovi = await baza
    .select({
      id: igraci.id,
      nadimak: igraci.nadimak,
      vrsta: igraci.vrsta,
      avatarId: igraci.avatarId,
      avatarConfig: igraci.avatarConfig,
      avatarRevision: igraci.avatarRevision,
      iskustvoUkupno: igraci.iskustvoUkupno,
    })
    .from(igraci)
    .where(and(
      isNull(igraci.obrisanAt),
      eq(igraci.upravljac, 'covjek'),
      inArray(igraci.vrsta, ['gost', 'registriran', 'admin']),
      gt(igraci.iskustvoUkupno, 0),
    ));
  const kandidati = redovi.map((r) => {
    const igrac: IdentitetIgraca = {
      id: r.id,
      nadimak: r.nadimak,
      vrsta: r.vrsta as IdentitetIgraca['vrsta'],
      avatarId: r.avatarId,
      avatarConfig: r.avatarConfig as AvatarConfigV1 | null,
      avatarRevision: r.avatarRevision,
      iskustvoUkupno: r.iskustvoUkupno,
    };
    return {
      igrac,
      vrijednost: {
        vrsta: 'iskustvo' as const,
        iskustvoUkupno: r.iskustvoUkupno,
        razina: stanjeIskustva(r.iskustvoUkupno).razina,
      },
      // DESC: negativni ključ
      kljucevi: [-r.iskustvoUkupno],
    };
  });
  return poredaj(kandidati);
}

async function izracunajKolekciju(): Promise<Poredak> {
  const dopustiVlastitaImena = konfiguracija.DOPUSTI_VLASTITA_IMENA === 'true';
  const redovi = await baza
    .select({
      igracId: otkljucaneGrupeIgraca.igracId,
      grupa: otkljucaneGrupeIgraca.grupa,
    })
    .from(otkljucaneGrupeIgraca)
    .innerJoin(igraci, eq(igraci.id, otkljucaneGrupeIgraca.igracId))
    .where(and(
      isNull(igraci.obrisanAt),
      eq(igraci.upravljac, 'covjek'),
      inArray(igraci.vrsta, ['gost', 'registriran', 'admin']),
    ));

  const grupePoIgracu = new Map<string, string[]>();
  for (const redak of redovi) {
    const lista = grupePoIgracu.get(redak.igracId) ?? [];
    lista.push(redak.grupa);
    grupePoIgracu.set(redak.igracId, lista);
  }

  const brojevi = [...grupePoIgracu.entries()]
    .map(([igracId, grupe]) => ({
      igracId,
      broj: brojKolekcijskihJedinica(grupe, { dopustiVlastitaImena }),
    }))
    .filter((x) => x.broj > 0);

  const identiteti = await dohvatiIdentitete(brojevi.map((x) => x.igracId));
  const kandidati = brojevi.flatMap(({ igracId, broj }) => {
    const igrac = identiteti.get(igracId);
    if (!igrac) return [];
    return [{
      igrac,
      vrijednost: { vrsta: 'kolekcija' as const, broj },
      kljucevi: [-broj],
    }];
  });
  return poredaj(kandidati);
}

function nazivLevelaIzazivaca(zavrseni: ReadonlySet<string>): string | null {
  if (zavrseni.size === 0) return null;
  const leveli = izgradiAgregateLevela(zavrseni);
  let trenutni = 1 as 1 | 2 | 3 | 4;
  for (const L of leveli) {
    if (L.status === 'zavrsen') {
      trenutni = L.level as 1 | 2 | 3 | 4;
      continue;
    }
    if (L.status === 'dostupan') {
      trenutni = L.level as 1 | 2 | 3 | 4;
      break;
    }
    break;
  }
  if (leveli.every((L) => L.status === 'zavrsen')) {
    trenutni = (leveli.at(-1)?.level ?? 1) as 1 | 2 | 3 | 4;
  }
  return NAZIVI_LEVELA_IZAZOVA[trenutni];
}

async function izracunajIzazove(): Promise<Poredak> {
  const redovi = await baza
    .select({
      igracId: zavrseciIzazova.igracId,
      challengeId: zavrseciIzazova.challengeId,
      vrijeme: zavrseciIzazova.vrijeme,
    })
    .from(zavrseciIzazova)
    .innerJoin(igraci, eq(igraci.id, zavrseciIzazova.igracId))
    .where(and(
      isNull(igraci.obrisanAt),
      eq(igraci.upravljac, 'covjek'),
      inArray(igraci.vrsta, ['gost', 'registriran', 'admin']),
    ));

  const poIgracu = new Map<string, { ids: Set<string>; zadnjiPrvi: number }>();
  for (const redak of redovi) {
    if (!AKTIVNI_IZAZOVI.has(redak.challengeId)) continue;
    const zapis = poIgracu.get(redak.igracId) ?? { ids: new Set<string>(), zadnjiPrvi: 0 };
    zapis.ids.add(redak.challengeId);
    const ms = redak.vrijeme.getTime();
    if (ms > zapis.zadnjiPrvi) zapis.zadnjiPrvi = ms;
    poIgracu.set(redak.igracId, zapis);
  }

  const aktivni = [...poIgracu.entries()].filter(([, v]) => v.ids.size > 0);
  const identiteti = await dohvatiIdentitete(aktivni.map(([id]) => id));
  const ukupno = BROJ_AKTIVNIH_IZAZOVA;
  const kandidati = aktivni.flatMap(([igracId, podatak]) => {
    const igrac = identiteti.get(igracId);
    if (!igrac) return [];
    const zavrseno = podatak.ids.size;
    return [{
      igrac,
      vrijednost: {
        vrsta: 'izazovi' as const,
        zavrseno,
        ukupno,
        nazivLevela: nazivLevelaIzazivaca(podatak.ids),
      },
      // Više završenih, zatim raniji posljednji prvi završetak
      kljucevi: [-zavrseno, podatak.zadnjiPrvi],
    }];
  });
  return poredaj(kandidati);
}

async function izracunajDostignuca(): Promise<Poredak> {
  const [sviIgraci, napreci, otkljucana, nizovi] = await Promise.all([
    baza.select({
      id: igraci.id,
      nadimak: igraci.nadimak,
      vrsta: igraci.vrsta,
      avatarId: igraci.avatarId,
      avatarConfig: igraci.avatarConfig,
      avatarRevision: igraci.avatarRevision,
      iskustvoUkupno: igraci.iskustvoUkupno,
    }).from(igraci).where(and(
      isNull(igraci.obrisanAt),
      eq(igraci.upravljac, 'covjek'),
      inArray(igraci.vrsta, ['gost', 'registriran', 'admin']),
    )),
    baza.select().from(napredakDostignucaIgraca),
    baza.select({
      igracId: dostignucaIgraca.igracId,
      dostignuceId: dostignucaIgraca.dostignuceId,
      razina: dostignucaIgraca.razina,
    }).from(dostignucaIgraca),
    baza.select({
      igracId: nizAktivnostiIgraca.igracId,
      najboljiNiz: nizAktivnostiIgraca.najboljiNiz,
    }).from(nizAktivnostiIgraca),
  ]);

  const napredakPoIgracu = new Map(napreci.map((n) => [n.igracId, n]));
  const razinePoIgracu = new Map<string, Map<string, number>>();
  for (const redak of otkljucana) {
    const mapa = razinePoIgracu.get(redak.igracId) ?? new Map<string, number>();
    mapa.set(redak.dostignuceId, redak.razina);
    razinePoIgracu.set(redak.igracId, mapa);
  }
  const nizPoIgracu = new Map(nizovi.map((n) => [n.igracId, n.najboljiNiz]));

  const kandidati = sviIgraci.flatMap((r) => {
    const brojac = napredakPoIgracu.get(r.id);
    const sazetak = izracunajSazetakZvjezdicaDostignuca({
      iskustvoUkupno: r.iskustvoUkupno,
      najboljiNizAktivnosti: nizPoIgracu.get(r.id) ?? 0,
      spremljeneRazine: razinePoIgracu.get(r.id) ?? new Map(),
      brojac: brojac ?? null,
    });
    if (sazetak.ukupnoZvjezdica <= 0) return [];
    const igrac: IdentitetIgraca = {
      id: r.id,
      nadimak: r.nadimak,
      vrsta: r.vrsta as IdentitetIgraca['vrsta'],
      avatarId: r.avatarId,
      avatarConfig: r.avatarConfig as AvatarConfigV1 | null,
      avatarRevision: r.avatarRevision,
      iskustvoUkupno: r.iskustvoUkupno,
    };
    return [{
      igrac,
      vrijednost: {
        vrsta: 'dostignuca' as const,
        zvjezdice: sazetak.ukupnoZvjezdica,
        otkljucano: sazetak.ukupnoOtkljucanih,
      },
      kljucevi: [-sazetak.ukupnoZvjezdica, -sazetak.ukupnoOtkljucanih],
    }];
  });
  return poredaj(kandidati);
}

export async function izracunajPoredakNapretka(metrika: MetrikaNapretkaLjestvice): Promise<Poredak> {
  if (metrika === 'iskustvo') return izracunajIskustvo();
  if (metrika === 'kolekcija') return izracunajKolekciju();
  if (metrika === 'izazovi') return izracunajIzazove();
  return izracunajDostignuca();
}

interface ZapisMemorije {
  istice: number;
  poredak: Promise<Poredak>;
}

const memorija = new Map<string, ZapisMemorije>();

export function ocistiMemorijuNapretka(): void {
  memorija.clear();
}

export function dohvatiPoredakNapretka(metrika: MetrikaNapretkaLjestvice, sada: Date): Promise<Poredak> {
  const sadaMs = sada.getTime();
  for (const [kljuc, zapis] of memorija) {
    if (zapis.istice <= sadaMs) memorija.delete(kljuc);
  }
  const kljuc = `napredak|${metrika}`;
  const postojeci = memorija.get(kljuc);
  if (postojeci) return postojeci.poredak;

  const poredak = izracunajPoredakNapretka(metrika);
  memorija.set(kljuc, { istice: sadaMs + TRAJANJE_MEMORIJE_NAPRETKA_MS, poredak });
  poredak.catch(() => memorija.delete(kljuc));
  return poredak;
}

export function pozicijaNapretka(poredak: Poredak, igracId: string | null): PozicijaNaLjestvici {
  const prazno = {
    mjesto: null as number | null,
    odigraneIgre: null as number | null,
    minimumIgara: 0,
    nedostajeIgara: null as number | null,
  };
  if (!igracId) return { status: 'prijava_potrebna', ...prazno };
  const stavka = poredak.poIgracu.get(igracId);
  if (!stavka || stavka.mjesto === null) {
    return { status: 'nema_rezultata', ...prazno, odigraneIgre: 0, nedostajeIgara: 0 };
  }
  return {
    status: 'rangiran',
    mjesto: stavka.mjesto,
    odigraneIgre: stavka.odigraneIgre,
    minimumIgara: 0,
    nedostajeIgara: 0,
  };
}
