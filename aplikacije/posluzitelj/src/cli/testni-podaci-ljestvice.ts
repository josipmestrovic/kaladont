import { and, asc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import { grafemi, izracunajBodove, izracunajRang, PRAGOVI_DULJINE, tierRijetkostiIskustva } from 'zajednicko';
import { baza, zatvoriBazu } from '../baza/klijent.js';
import {
  dnkStatistikeIgraca,
  igraci,
  nizoviPobjedaIgraca,
  otkljucaneGrupeIgraca,
  otkljucaneRijeciIgraca,
  partije,
  rijeci,
  statistikeRijeciIgraca,
  sudioniciPartije,
} from '../baza/shema.js';
import { konfiguracija } from '../konfiguracija.js';

const BROJ_IGRACA = 500;
const BROJ_PARTIJA = 10_000;
const BROJ_DVOBOJA = 2_500;
const PREFIKS_NADIMKA = 'Testni igrač ';
const SJEME = 0x4b414c41;
const VELICINA_GRUPE = 4_000;
const VELICINA_UPITA = 500;

type Plasman = 1 | 2 | 3 | 4;

interface TestniIgrac {
  id: string;
  nadimak: string;
  snaga: number;
  odigrane: number;
  pobjede: number;
  eliminacijeUkupno: number;
  bodoviUkupno: number;
  odigrane1v1: number;
  pobjede1v1: number;
  eliminacije1v1: number;
  bodovi1v1: number;
  trenutniNiz4p: number;
  najboljiNiz4p: number;
  trenutniNiz1v1: number;
  najboljiNiz1v1: number;
  stvoren: Date | null;
  zadnjaAktivnost: Date | null;
}

interface KandidatRijeci {
  rijec: string;
  frekvencija: number;
  grupe: string[];
  brojGrafema: number;
  dugaTier: number | null;
  rijetkaTier: number | null;
}

interface DodatniTestniPodaci {
  dnk: (typeof dnkStatistikeIgraca.$inferInsert)[];
  statistikeRijeci: (typeof statistikeRijeciIgraca.$inferInsert)[];
  otkljucaneRijeci: (typeof otkljucaneRijeciIgraca.$inferInsert)[];
  otkljucaneGrupe: (typeof otkljucaneGrupeIgraca.$inferInsert)[];
  nizoviPobjeda: (typeof nizoviPobjedaIgraca.$inferInsert)[];
}

function uuidTestnihPodataka(prostor: 'igrac' | 'partija' | 'dvoboj', redniBroj: number): string {
  const prostorId = prostor === 'igrac' ? '0000' : prostor === 'partija' ? '0001' : '0002';
  return `00000000-${prostorId}-4000-8000-${redniBroj.toString(16).padStart(12, '0')}`;
}

function napraviGenerator(): () => number {
  let stanje = SJEME;
  return () => {
    stanje = (stanje + 0x6d2b79f5) | 0;
    let vrijednost = Math.imul(stanje ^ (stanje >>> 15), 1 | stanje);
    vrijednost ^= vrijednost + Math.imul(vrijednost ^ (vrijednost >>> 7), 61 | vrijednost);
    return ((vrijednost ^ (vrijednost >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function podijeli<T>(vrijednosti: T[], velicina: number): T[][] {
  const grupe: T[][] = [];
  for (let indeks = 0; indeks < vrijednosti.length; indeks += velicina) {
    grupe.push(vrijednosti.slice(indeks, indeks + velicina));
  }
  return grupe;
}

function provjeriLokalnuBazu(): void {
  const adresa = new URL(konfiguracija.BAZA_URL);
  const lokalniNazivnik = adresa.hostname.replace(/^\[|\]$/g, '');
  const lokalniNazivnici = new Set(['localhost', '127.0.0.1', '::1']);

  if (konfiguracija.NODE_ENV !== 'development' || !lokalniNazivnici.has(lokalniNazivnik)) {
    throw new Error('Testni podaci smiju se upisivati samo u razvojnu bazu na lokalnom računalu.');
  }
}

function tierDuljine(brojGrafema: number): number | null {
  if (brojGrafema >= PRAGOVI_DULJINE.jakoDuga) return 2;
  if (brojGrafema >= PRAGOVI_DULJINE.srednjeDuga) return 1;
  if (brojGrafema >= PRAGOVI_DULJINE.duga) return 0;
  return null;
}

function tierRijetkostiKolekcije(frekvencija: number, brojGrafema: number): number | null {
  const tier = tierRijetkostiIskustva(frekvencija, brojGrafema);
  if (tier === 'jako_rijetka') return 2;
  if (tier === 'srednje_rijetka') return 1;
  if (tier === 'rijetka') return 0;
  return null;
}

function napraviKandidate(redci: { rijec: string; frekvencija: number; grupe: string[] }[]): KandidatRijeci[] {
  return redci.map((redak) => {
    const brojGrafema = grafemi(redak.rijec).length;
    return {
      ...redak,
      brojGrafema,
      dugaTier: tierDuljine(brojGrafema),
      rijetkaTier: tierRijetkostiKolekcije(redak.frekvencija, brojGrafema),
    };
  }).filter((redak) => redak.grupe.length > 0);
}

async function dohvatiKandidateRijeci(): Promise<Map<string, KandidatRijeci[]>> {
  const osnovniOdabir = { rijec: rijeci.rijec, frekvencija: rijeci.frekvencija, grupe: rijeci.grupe };
  const uvjetAktivna = eq(rijeci.aktivna, true);
  const uvjetImaGrupe = sql`cardinality(${rijeci.grupe}) > 0`;
  const [dugeKandidate, jakoDugeKandidate, rijetkeKandidate, srednjeRijetkeKandidate, jakoRijetkeKandidate] = await Promise.all([
    baza.select(osnovniOdabir).from(rijeci).where(and(
      uvjetAktivna,
      uvjetImaGrupe,
      sql`char_length(${rijeci.rijec}) between 10 and 20`,
    )).orderBy(asc(rijeci.rijec)).limit(10_000),
    baza.select(osnovniOdabir).from(rijeci).where(and(
      uvjetAktivna,
      uvjetImaGrupe,
      sql`char_length(${rijeci.rijec}) >= 15`,
    )).orderBy(asc(rijeci.rijec)).limit(20_000),
    baza.select(osnovniOdabir).from(rijeci).where(and(
      uvjetAktivna,
      uvjetImaGrupe,
      gte(rijeci.frekvencija, 10),
      lte(rijeci.frekvencija, 99),
    )).orderBy(asc(rijeci.rijec)).limit(5_000),
    baza.select(osnovniOdabir).from(rijeci).where(and(
      uvjetAktivna,
      uvjetImaGrupe,
      gte(rijeci.frekvencija, 1),
      lte(rijeci.frekvencija, 9),
    )).orderBy(asc(rijeci.rijec)).limit(5_000),
    baza.select(osnovniOdabir).from(rijeci).where(and(
      uvjetAktivna,
      uvjetImaGrupe,
      eq(rijeci.frekvencija, 0),
    )).orderBy(asc(rijeci.rijec)).limit(5_000),
  ]);
  const kandidatiPoKategoriji = new Map<string, KandidatRijeci[]>([
    ['duge', napraviKandidate(dugeKandidate).filter((rijec) => rijec.dugaTier === 0)],
    ['srednjeDuge', napraviKandidate(dugeKandidate).filter((rijec) => rijec.dugaTier === 1)],
    ['jakoDuge', napraviKandidate(jakoDugeKandidate).filter((rijec) => rijec.dugaTier === 2)],
    ['rijetke', napraviKandidate(rijetkeKandidate).filter((rijec) => rijec.rijetkaTier === 0)],
    ['srednjeRijetke', napraviKandidate(srednjeRijetkeKandidate).filter((rijec) => rijec.rijetkaTier === 1)],
    ['jakoRijetke', napraviKandidate(jakoRijetkeKandidate).filter((rijec) => rijec.rijetkaTier === 2)],
  ]);

  const prazneKategorije = [...kandidatiPoKategoriji]
    .filter(([, kandidati]) => kandidati.length === 0)
    .map(([kategorija]) => kategorija);
  if (prazneKategorije.length > 0) {
    throw new Error(`Lokalni rječnik nema aktivnih riječi za kategorije: ${prazneKategorije.join(', ')}.`);
  }
  return kandidatiPoKategoriji;
}

function napraviDodatneTestnePodatke(
  igraciPodaci: TestniIgrac[],
  kandidati: Map<string, KandidatRijeci[]>,
): DodatniTestniPodaci {
  const dnk: DodatniTestniPodaci['dnk'] = [];
  const statistikeRijeci: DodatniTestniPodaci['statistikeRijeci'] = [];
  const otkljucaneRijeci: DodatniTestniPodaci['otkljucaneRijeci'] = [];
  const otkljucaneGrupe: DodatniTestniPodaci['otkljucaneGrupe'] = [];
  const nizoviPobjeda: DodatniTestniPodaci['nizoviPobjeda'] = [];
  const kategorije = [
    ['duge', 0],
    ['srednjeDuge', 1],
    ['jakoDuge', 2],
    ['rijetke', 3],
    ['srednjeRijetke', 4],
    ['jakoRijetke', 5],
  ] as const;

  for (const igrac of igraciPodaci) {
    const indeks = igrac.snaga;
    const prihvaceniPotezi = igrac.odigrane * (14 + (indeks % 11));
    const prosjekPotezaMs = 550 + ((BROJ_IGRACA - 1 - indeks) * 8) + ((indeks * 47) % 450);
    const najduziStreak = 4 + ((indeks * 7) % 24);
    const dugeRijeci = igrac.odigrane * (1 + (indeks % 3));
    const srednjeDugeRijeci = Math.floor(igrac.odigrane * ((indeks % 5) / 5));
    const jakoDugeRijeci = Math.floor(igrac.odigrane * ((indeks % 13) / 13));
    const rijetkeRijeci = igrac.odigrane * (1 + (indeks % 2));
    const srednjeRijetkeRijeci = Math.floor(igrac.odigrane * ((indeks % 4) / 4));
    const jakoRijetkeRijeci = Math.floor(igrac.odigrane * ((indeks % 11) / 11));
    const odabraneRijeci = new Map<string, KandidatRijeci>();
    const grupeIgraca = new Map<string, number | null>();

    for (const [kategorija, pomak] of kategorije) {
      const kandidatiKategorije = kandidati.get(kategorija)!;
      const rijec = kandidatiKategorije[(indeks * 37 + pomak * 101) % kandidatiKategorije.length]!;
      odabraneRijeci.set(rijec.rijec, rijec);
      const tierZaGrupu = rijec.rijetkaTier === null ? null : 2 - rijec.rijetkaTier;
      for (const grupa of rijec.grupe) {
        const postojeciTier = grupeIgraca.get(grupa);
        grupeIgraca.set(grupa, postojeciTier === undefined || (tierZaGrupu !== null && tierZaGrupu < (postojeciTier ?? Infinity))
          ? tierZaGrupu
          : postojeciTier);
      }
    }

    const rijecNajduza = kandidati.get('jakoDuge')![(indeks * 37 + 202) % kandidati.get('jakoDuge')!.length]!;
    const rijecNajrjeda = kandidati.get('jakoRijetke')![(indeks * 37 + 505) % kandidati.get('jakoRijetke')!.length]!;
    const otkljucano = igrac.stvoren ?? new Date();

    dnk.push({
      igracId: igrac.id,
      mod: 'cetiri_igraca',
      prihvaceniPotezi,
      ukupnoTrajanjePrihvaceniPoteziMs: prihvaceniPotezi * prosjekPotezaMs,
      najduziStreak,
      dugeRijeci,
      srednjeDugeRijeci,
      jakoDugeRijeci,
      rijetkeRijeci,
      srednjeRijetkeRijeci,
      jakoRijetkeRijeci,
      zbrojOcjenaIgre: 0,
      brojOcjenaIgre: 0,
      otkljucanAt: otkljucano,
    });
    dnk.push({
      igracId: igrac.id,
      mod: 'dva_igraca',
      prihvaceniPotezi: igrac.odigrane1v1 * (12 + (indeks % 9)),
      ukupnoTrajanjePrihvaceniPoteziMs: igrac.odigrane1v1 * (prosjekPotezaMs + 350),
      najduziStreak: 2 + ((indeks * 11) % 18),
      dugeRijeci: igrac.odigrane1v1 * (1 + (indeks % 2)),
      srednjeDugeRijeci: Math.floor(igrac.odigrane1v1 * ((indeks % 5) / 5)),
      jakoDugeRijeci: Math.floor(igrac.odigrane1v1 * ((indeks % 13) / 13)),
      rijetkeRijeci: igrac.odigrane1v1 * (1 + (indeks % 2)),
      srednjeRijetkeRijeci: Math.floor(igrac.odigrane1v1 * ((indeks % 4) / 4)),
      jakoRijetkeRijeci: Math.floor(igrac.odigrane1v1 * ((indeks % 11) / 11)),
      zbrojOcjenaIgre: 0,
      brojOcjenaIgre: 0,
      otkljucanAt: otkljucano,
    });
    statistikeRijeci.push({
      igracId: igrac.id,
      mod: 'cetiri_igraca',
      najduziStreak,
      otkriveneJakoRijetkeGrupe: jakoRijetkeRijeci,
      otkriveneSrednjeRijetkeGrupe: srednjeRijetkeRijeci,
      otkriveneRijetkeGrupe: rijetkeRijeci,
      upisaneDugeRijeci: dugeRijeci,
      upisaneSrednjeDugeRijeci: srednjeDugeRijeci,
      upisaneJakoDugeRijeci: jakoDugeRijeci,
      najduzaRijec: rijecNajduza.rijec,
      najduzaRijecGrafemi: rijecNajduza.brojGrafema,
      najrjedaRijec: rijecNajrjeda.rijec,
      najrjedaRijecFrekvencija: rijecNajrjeda.frekvencija,
      najrjedaTier: 0,
    });
    statistikeRijeci.push({
      igracId: igrac.id,
      mod: 'dva_igraca',
      najduziStreak: 2 + ((indeks * 11) % 18),
      otkriveneJakoRijetkeGrupe: Math.floor(igrac.odigrane1v1 * ((indeks % 11) / 11)),
      otkriveneSrednjeRijetkeGrupe: Math.floor(igrac.odigrane1v1 * ((indeks % 4) / 4)),
      otkriveneRijetkeGrupe: igrac.odigrane1v1 * (1 + (indeks % 2)),
      upisaneDugeRijeci: igrac.odigrane1v1 * (1 + (indeks % 2)),
      upisaneSrednjeDugeRijeci: Math.floor(igrac.odigrane1v1 * ((indeks % 5) / 5)),
      upisaneJakoDugeRijeci: Math.floor(igrac.odigrane1v1 * ((indeks % 13) / 13)),
      najduzaRijec: rijecNajduza.rijec,
      najduzaRijecGrafemi: rijecNajduza.brojGrafema,
      najrjedaRijec: rijecNajrjeda.rijec,
      najrjedaRijecFrekvencija: rijecNajrjeda.frekvencija,
      najrjedaTier: 0,
    });

    for (const rijec of odabraneRijeci.values()) {
      otkljucaneRijeci.push({
        igracId: igrac.id,
        rijec: rijec.rijec,
        dugaTier: rijec.dugaTier,
        rijetkaTier: rijec.rijetkaTier,
        jakoDuga: rijec.dugaTier === 2,
        jakoRijetka: rijec.rijetkaTier === 2,
        otkljucano,
      });
    }
    for (const [grupa, tier] of grupeIgraca) {
      otkljucaneGrupe.push({ igracId: igrac.id, grupa, tier, otkljucano });
    }
    nizoviPobjeda.push(
      {
        igracId: igrac.id,
        mod: 'cetiri_igraca',
        trenutniNiz: igrac.trenutniNiz4p,
        najboljiNiz: igrac.najboljiNiz4p,
      },
      {
        igracId: igrac.id,
        mod: 'dva_igraca',
        trenutniNiz: igrac.trenutniNiz1v1,
        najboljiNiz: igrac.najboljiNiz1v1,
      },
    );
  }

  return { dnk, statistikeRijeci, otkljucaneRijeci, otkljucaneGrupe, nizoviPobjeda };
}

function napraviPodatke(): {
  igraciPodaci: TestniIgrac[];
  partijePodaci: (typeof partije.$inferInsert)[];
  sudioniciPodaci: (typeof sudioniciPartije.$inferInsert)[];
  od: Date;
  do: Date;
} {
  const slucajno = napraviGenerator();
  const sada = new Date();
  const od = new Date(sada.getTime() - 730 * 24 * 60 * 60 * 1_000);
  const doVrijeme = sada.getTime() - 10 * 60 * 1_000;
  const razmak = (doVrijeme - od.getTime()) / BROJ_PARTIJA;
  const igraciPodaci: TestniIgrac[] = Array.from({ length: BROJ_IGRACA }, (_, indeks) => ({
    id: uuidTestnihPodataka('igrac', indeks + 1),
    nadimak: `${PREFIKS_NADIMKA}${(indeks + 1).toString().padStart(3, '0')}`,
    snaga: indeks,
    odigrane: 0,
    pobjede: 0,
    eliminacijeUkupno: 0,
    bodoviUkupno: 0,
    odigrane1v1: 0,
    pobjede1v1: 0,
    eliminacije1v1: 0,
    bodovi1v1: 0,
    trenutniNiz4p: 0,
    najboljiNiz4p: 0,
    trenutniNiz1v1: 0,
    najboljiNiz1v1: 0,
    stvoren: null,
    zadnjaAktivnost: null,
  }));
  const partijePodaci: (typeof partije.$inferInsert)[] = [];
  const sudioniciPodaci: (typeof sudioniciPartije.$inferInsert)[] = [];

  for (let indeksPartije = 0; indeksPartije < BROJ_PARTIJA; indeksPartije += 1) {
    const pocetak = new Date(od.getTime() + (indeksPartije + slucajno()) * razmak);
    const kraj = new Date(pocetak.getTime() + 60_000 + slucajno() * 120_000);
    const kandidati = new Set<number>();
    while (kandidati.size < 4) kandidati.add(Math.floor(slucajno() * BROJ_IGRACA));

    const ucesnici = [...kandidati].map((indeksIgraca, sjedalo) => ({
      igrac: igraciPodaci[indeksIgraca]!,
      sjedalo,
      rezultat: igraciPodaci[indeksIgraca]!.snaga + (slucajno() - 0.5) * 40,
      eliminacije: 0,
    }));
    ucesnici.sort((a, b) => b.rezultat - a.rezultat);

    const tezineEliminatora = [16, 4, 2, 1];
    for (let eliminacija = 0; eliminacija < 3; eliminacija += 1) {
      let odabir = slucajno() * tezineEliminatora.reduce((zbroj, tezina) => zbroj + tezina, 0);
      for (let indeks = 0; indeks < ucesnici.length; indeks += 1) {
        odabir -= tezineEliminatora[indeks]!;
        if (odabir < 0) {
          ucesnici[indeks]!.eliminacije += 1;
          break;
        }
      }
    }

    const partijaId = uuidTestnihPodataka('partija', indeksPartije + 1);
    const pobjednik = ucesnici[0]!.igrac;
    partijePodaci.push({
      id: partijaId,
      mod: 'cetiri_igraca',
      pocetak,
      kraj,
      status: 'zavrsena',
      pobjednikId: pobjednik.id,
    });

    for (let indeks = 0; indeks < ucesnici.length; indeks += 1) {
      const ucesnik = ucesnici[indeks]!;
      const plasman = (indeks + 1) as Plasman;
      const bodovi = izracunajBodove(
        { plasman, eliminacije: ucesnik.eliminacije },
        'cetiri_igraca',
      );
      const igrac = ucesnik.igrac;
      igrac.odigrane += 1;
      igrac.pobjede += plasman === 1 ? 1 : 0;
      igrac.eliminacijeUkupno += ucesnik.eliminacije;
      igrac.bodoviUkupno += bodovi;
      if (!igrac.stvoren || pocetak < igrac.stvoren) igrac.stvoren = pocetak;
      if (!igrac.zadnjaAktivnost || kraj > igrac.zadnjaAktivnost) igrac.zadnjaAktivnost = kraj;

      sudioniciPodaci.push({
        partijaId,
        igracId: igrac.id,
        nadimak: igrac.nadimak,
        sjedalo: ucesnik.sjedalo,
        plasman,
        bodovi,
        eliminacije: ucesnik.eliminacije,
        iskustvo: 0,
        cekanjeMs: Math.floor(slucajno() * 30_000),
      });
    }

    for (const ucesnik of ucesnici) {
      ucesnik.igrac.trenutniNiz4p = ucesnik === ucesnici[0] ? ucesnik.igrac.trenutniNiz4p + 1 : 0;
      ucesnik.igrac.najboljiNiz4p = Math.max(ucesnik.igrac.najboljiNiz4p, ucesnik.igrac.trenutniNiz4p);
    }
  }

  return { igraciPodaci, partijePodaci, sudioniciPodaci, od, do: new Date(doVrijeme) };
}

function napraviDvojboje(
  igraciPodaci: TestniIgrac[],
  od: Date,
  doVrijeme: Date,
): {
  partije: (typeof partije.$inferInsert)[];
  sudionici: (typeof sudioniciPartije.$inferInsert)[];
} {
  const slucajno = napraviGenerator();
  const partijePodaci: (typeof partije.$inferInsert)[] = [];
  const sudioniciPodaci: (typeof sudioniciPartije.$inferInsert)[] = [];
  const razmak = (doVrijeme.getTime() - od.getTime()) / BROJ_DVOBOJA;

  for (let indeksPartije = 0; indeksPartije < BROJ_DVOBOJA; indeksPartije += 1) {
    const krug = Math.floor(indeksPartije / (BROJ_IGRACA / 2));
    const mjesto = indeksPartije % (BROJ_IGRACA / 2);
    const pomak = krug * 17;
    const prvi = igraciPodaci[(mjesto + pomak) % BROJ_IGRACA]!;
    const drugi = igraciPodaci[(BROJ_IGRACA - 1 - mjesto + pomak) % BROJ_IGRACA]!;
    const pocetak = new Date(od.getTime() + (indeksPartije + slucajno()) * razmak);
    const kraj = new Date(pocetak.getTime() + 30_000 + slucajno() * 90_000);
    const prviPobijedio = prvi.snaga + (slucajno() - 0.5) * 100 >= drugi.snaga + (slucajno() - 0.5) * 100;
    const pobjednik = prviPobijedio ? prvi : drugi;
    const gubitnik = prviPobijedio ? drugi : prvi;
    const partijaId = uuidTestnihPodataka('dvoboj', indeksPartije + 1);

    partijePodaci.push({
      id: partijaId,
      mod: 'dva_igraca',
      pocetak,
      kraj,
      status: 'zavrsena',
      pobjednikId: pobjednik.id,
    });

    for (const [igrac, plasman, sjedalo] of [[pobjednik, 1, prviPobijedio ? 0 : 1], [gubitnik, 2, prviPobijedio ? 1 : 0]] as const) {
      const eliminacije = plasman === 1 ? 1 : 0;
      const bodovi = izracunajBodove({ plasman, eliminacije }, 'dva_igraca');
      igrac.odigrane1v1 += 1;
      igrac.pobjede1v1 += plasman === 1 ? 1 : 0;
      igrac.eliminacije1v1 += eliminacije;
      igrac.bodovi1v1 += bodovi;
      igrac.trenutniNiz1v1 = plasman === 1 ? igrac.trenutniNiz1v1 + 1 : 0;
      igrac.najboljiNiz1v1 = Math.max(igrac.najboljiNiz1v1, igrac.trenutniNiz1v1);
      if (!igrac.zadnjaAktivnost || kraj > igrac.zadnjaAktivnost) igrac.zadnjaAktivnost = kraj;

      sudioniciPodaci.push({
        partijaId,
        igracId: igrac.id,
        nadimak: igrac.nadimak,
        sjedalo,
        plasman,
        bodovi,
        eliminacije,
        iskustvo: 0,
        cekanjeMs: Math.floor(slucajno() * 20_000),
      });
    }
  }

  return { partije: partijePodaci, sudionici: sudioniciPodaci };
}

async function ucitajTestnePodatke(): Promise<void> {
  provjeriLokalnuBazu();
  const { igraciPodaci, partijePodaci, sudioniciPodaci, od, do: doVrijeme } = napraviPodatke();
  const dvojboji = napraviDvojboje(igraciPodaci, od, doVrijeme);
  const svePartije = [...partijePodaci, ...dvojboji.partije];
  const sviSudionici = [...sudioniciPodaci, ...dvojboji.sudionici];
  const kandidatiRijeci = await dohvatiKandidateRijeci();
  const dodatniPodaci = napraviDodatneTestnePodatke(igraciPodaci, kandidatiRijeci);
  const idjeviIgraca = igraciPodaci.map((igrac) => igrac.id);

  await baza.transaction(async (transakcija) => {
    for (const grupaIdjeva of podijeli(idjeviIgraca, VELICINA_UPITA)) {
      const postojeci = await transakcija
        .select({ id: igraci.id, nadimak: igraci.nadimak })
        .from(igraci)
        .where(inArray(igraci.id, grupaIdjeva));
      if (postojeci.some((igrac) => !igrac.nadimak.startsWith(PREFIKS_NADIMKA))) {
        throw new Error('Pronađen je postojeći račun izvan prostora rezerviranog za testne igrače; upis je prekinut.');
      }
    }

    for (const grupa of podijeli(igraciPodaci, VELICINA_GRUPE)) {
      await transakcija
        .insert(igraci)
        .values(grupa.map((igrac) => ({
          id: igrac.id,
          vrsta: 'registriran' as const,
          nadimak: igrac.nadimak,
          emailPotvrdjen: false,
          odigrane: igrac.odigrane,
          pobjede: igrac.pobjede,
          eliminacijeUkupno: igrac.eliminacijeUkupno,
          bodoviUkupno: igrac.bodoviUkupno,
          odigrane1v1: igrac.odigrane1v1,
          pobjede1v1: igrac.pobjede1v1,
          eliminacije1v1: igrac.eliminacije1v1,
          bodovi1v1: igrac.bodovi1v1,
          stvoren: igrac.stvoren ?? od,
          registriranAt: igrac.stvoren ?? od,
          zadnjaAktivnost: igrac.zadnjaAktivnost ?? od,
        })))
        .onConflictDoUpdate({
          target: igraci.id,
          set: {
            vrsta: sql`excluded.vrsta`,
            nadimak: sql`excluded.nadimak`,
            emailPotvrdjen: sql`excluded.email_potvrdjen`,
            odigrane: sql`excluded.odigrane`,
            pobjede: sql`excluded.pobjede`,
            eliminacijeUkupno: sql`excluded.eliminacije_ukupno`,
            bodoviUkupno: sql`excluded.bodovi_ukupno`,
            odigrane1v1: sql`excluded.odigrane_1v1`,
            pobjede1v1: sql`excluded.pobjede_1v1`,
            eliminacije1v1: sql`excluded.eliminacije_1v1`,
            bodovi1v1: sql`excluded.bodovi_1v1`,
            stvoren: sql`excluded.stvoren`,
            registriranAt: sql`excluded.registriran_at`,
            zadnjaAktivnost: sql`excluded.zadnja_aktivnost`,
          },
        });
    }

    for (const grupa of podijeli(svePartije, 1_000)) {
      await transakcija
        .insert(partije)
        .values(grupa)
        .onConflictDoUpdate({
          target: partije.id,
          set: {
            mod: sql`excluded.mod`,
            pocetak: sql`excluded.pocetak`,
            kraj: sql`excluded.kraj`,
            status: sql`excluded.status`,
            pobjednikId: sql`excluded.pobjednik_id`,
          },
        });
    }

    for (const grupa of podijeli(sviSudionici, VELICINA_GRUPE)) {
      await transakcija
        .insert(sudioniciPartije)
        .values(grupa)
        .onConflictDoUpdate({
          target: [sudioniciPartije.partijaId, sudioniciPartije.igracId],
          set: {
            nadimak: sql`excluded.nadimak`,
            sjedalo: sql`excluded.sjedalo`,
            plasman: sql`excluded.plasman`,
            bodovi: sql`excluded.bodovi`,
            eliminacije: sql`excluded.eliminacije`,
            iskustvo: sql`excluded.iskustvo`,
            cekanjeMs: sql`excluded.cekanje_ms`,
          },
        });
    }

    for (const grupa of podijeli(dodatniPodaci.dnk, VELICINA_GRUPE)) {
      await transakcija
        .insert(dnkStatistikeIgraca)
        .values(grupa)
        .onConflictDoUpdate({
          target: [dnkStatistikeIgraca.igracId, dnkStatistikeIgraca.mod],
          set: {
            prihvaceniPotezi: sql`excluded.prihvaceni_potezi`,
            ukupnoTrajanjePrihvaceniPoteziMs: sql`excluded.ukupno_trajanje_prihvacenih_poteza_ms`,
            najduziStreak: sql`excluded.najduzi_streak`,
            dugeRijeci: sql`excluded.duge_rijeci`,
            srednjeDugeRijeci: sql`excluded.srednje_duge_rijeci`,
            jakoDugeRijeci: sql`excluded.jako_duge_rijeci`,
            rijetkeRijeci: sql`excluded.rijetke_rijeci`,
            srednjeRijetkeRijeci: sql`excluded.srednje_rijetke_rijeci`,
            jakoRijetkeRijeci: sql`excluded.jako_rijetke_rijeci`,
            zbrojOcjenaIgre: sql`excluded.zbroj_ocjena_igre`,
            brojOcjenaIgre: sql`excluded.broj_ocjena_igre`,
            otkljucanAt: sql`excluded.otkljucan_at`,
          },
        });
    }

    for (const grupa of podijeli(dodatniPodaci.statistikeRijeci, VELICINA_GRUPE)) {
      await transakcija
        .insert(statistikeRijeciIgraca)
        .values(grupa)
        .onConflictDoUpdate({
          target: [statistikeRijeciIgraca.igracId, statistikeRijeciIgraca.mod],
          set: {
            najduziStreak: sql`excluded.najduzi_streak`,
            otkriveneJakoRijetkeGrupe: sql`excluded.otkrivene_jako_rijetke_grupe`,
            otkriveneSrednjeRijetkeGrupe: sql`excluded.otkrivene_srednje_rijetke_grupe`,
            otkriveneRijetkeGrupe: sql`excluded.otkrivene_rijetke_grupe`,
            upisaneDugeRijeci: sql`excluded.upisane_duge_rijeci`,
            upisaneSrednjeDugeRijeci: sql`excluded.upisane_srednje_duge_rijeci`,
            upisaneJakoDugeRijeci: sql`excluded.upisane_jako_duge_rijeci`,
            najduzaRijec: sql`excluded.najduza_rijec`,
            najduzaRijecGrafemi: sql`excluded.najduza_rijec_grafemi`,
            najrjedaRijec: sql`excluded.najrjeda_rijec`,
            najrjedaRijecFrekvencija: sql`excluded.najrjeda_rijec_frekvencija`,
            najrjedaTier: sql`excluded.najrjeda_tier`,
          },
        });
    }

    for (const grupa of podijeli(dodatniPodaci.otkljucaneRijeci, VELICINA_GRUPE)) {
      await transakcija
        .insert(otkljucaneRijeciIgraca)
        .values(grupa)
        .onConflictDoUpdate({
          target: [otkljucaneRijeciIgraca.igracId, otkljucaneRijeciIgraca.rijec],
          set: {
            dugaTier: sql`excluded.duga_tier`,
            rijetkaTier: sql`excluded.rijetka_tier`,
            jakoDuga: sql`excluded.jako_duga`,
            jakoRijetka: sql`excluded.jako_rijetka`,
            otkljucano: sql`excluded.otkljucano`,
          },
        });
    }

    for (const grupa of podijeli(dodatniPodaci.otkljucaneGrupe, VELICINA_GRUPE)) {
      await transakcija
        .insert(otkljucaneGrupeIgraca)
        .values(grupa)
        .onConflictDoUpdate({
          target: [otkljucaneGrupeIgraca.igracId, otkljucaneGrupeIgraca.grupa],
          set: {
            tier: sql`excluded.tier`,
            otkljucano: sql`excluded.otkljucano`,
          },
        });
    }

    for (const grupa of podijeli(dodatniPodaci.nizoviPobjeda, VELICINA_GRUPE)) {
      await transakcija
        .insert(nizoviPobjedaIgraca)
        .values(grupa)
        .onConflictDoUpdate({
          target: [nizoviPobjedaIgraca.igracId, nizoviPobjedaIgraca.mod],
          set: {
            trenutniNiz: sql`excluded.trenutni_niz`,
            najboljiNiz: sql`excluded.najbolji_niz`,
            zadnjaObradenaPartijaId: sql`null`,
            azurirano: sql`now()`,
          },
        });
    }
  });

  const idjeviPartija = svePartije.map((partija) => partija.id!);
  const idjeviDvojboja = dvojboji.partije.map((partija) => partija.id!);
  const [brojIgraca] = await baza
    .select({ broj: sql<number>`count(*)::int` })
    .from(igraci)
    .where(inArray(igraci.id, idjeviIgraca));
  const [brojPartija] = await baza
    .select({ broj: sql<number>`count(*)::int` })
    .from(partije)
    .where(inArray(partije.id, idjeviPartija));
  const [brojRezultata] = await baza
    .select({ broj: sql<number>`count(*)::int` })
    .from(sudioniciPartije)
    .where(inArray(sudioniciPartije.partijaId, idjeviPartija));
  const [brojDnk] = await baza
    .select({ broj: sql<number>`count(*)::int` })
    .from(dnkStatistikeIgraca)
    .where(inArray(dnkStatistikeIgraca.igracId, idjeviIgraca));
  const [brojStatistikaRijeci] = await baza
    .select({ broj: sql<number>`count(*)::int` })
    .from(statistikeRijeciIgraca)
    .where(inArray(statistikeRijeciIgraca.igracId, idjeviIgraca));
  const [brojOtkljucanihRijeci] = await baza
    .select({ broj: sql<number>`count(*)::int` })
    .from(otkljucaneRijeciIgraca)
    .where(inArray(otkljucaneRijeciIgraca.igracId, idjeviIgraca));
  const [brojDvojboja] = await baza
    .select({ broj: sql<number>`count(*)::int` })
    .from(partije)
    .where(inArray(partije.id, idjeviDvojboja));
  const [brojSudionikaDvojboja] = await baza
    .select({ broj: sql<number>`count(*)::int` })
    .from(sudioniciPartije)
    .where(inArray(sudioniciPartije.partijaId, idjeviDvojboja));
  const [brojNizova] = await baza
    .select({ broj: sql<number>`count(*)::int` })
    .from(nizoviPobjedaIgraca)
    .where(inArray(nizoviPobjedaIgraca.igracId, idjeviIgraca));
  if (
    brojIgraca?.broj !== BROJ_IGRACA ||
    brojPartija?.broj !== BROJ_PARTIJA + BROJ_DVOBOJA ||
    brojRezultata?.broj !== BROJ_PARTIJA * 4 + BROJ_DVOBOJA * 2 ||
    brojDnk?.broj !== BROJ_IGRACA * 2 ||
    brojStatistikaRijeci?.broj !== BROJ_IGRACA * 2 ||
    brojOtkljucanihRijeci?.broj !== dodatniPodaci.otkljucaneRijeci.length
    || brojDvojboja?.broj !== BROJ_DVOBOJA
    || brojSudionikaDvojboja?.broj !== BROJ_DVOBOJA * 2
    || brojNizova?.broj !== BROJ_IGRACA * 2
  ) {
    throw new Error('Provjera spremljenih testnih podataka nije prošla; očekivani broj redaka nije pronađen.');
  }

  const brojPoRangu = new Map<string, number>();
  for (const igrac of igraciPodaci) {
    const prosjek = igrac.bodoviUkupno / igrac.odigrane;
    const rang = izracunajRang(igrac.odigrane, prosjek, 'cetiri_igraca');
    brojPoRangu.set(rang, (brojPoRangu.get(rang) ?? 0) + 1);
  }

  const raspodjelaDvojba = new Map<string, number>();
  for (const igrac of igraciPodaci) {
    const rang = izracunajRang(igrac.odigrane1v1, igrac.bodovi1v1 / igrac.odigrane1v1, 'dva_igraca');
    raspodjelaDvojba.set(rang, (raspodjelaDvojba.get(rang) ?? 0) + 1);
  }

  console.log(`Testni podaci učitani: ${BROJ_IGRACA} igrača, ${BROJ_PARTIJA} četveroboja, ${BROJ_DVOBOJA} dvoboja i ${sviSudionici.length} rezultata.`);
  console.log(`DNK i rekordi: ${brojDnk?.broj} DNK redaka, ${brojStatistikaRijeci?.broj} statistika riječi, ${brojOtkljucanihRijeci?.broj} zapisa kolekcije, ${brojNizova?.broj} nizova pobjeda.`);
  console.log(`Razdoblje: ${od.toISOString()} – ${doVrijeme.toISOString()}`);
  console.log(`Raspodjela rangova: ${[...brojPoRangu].map(([rang, broj]) => `${rang}: ${broj}`).join(', ')}`);
  console.log(`Raspodjela rangova dvoboja: ${[...raspodjelaDvojba].map(([rang, broj]) => `${rang}: ${broj}`).join(', ')}`);
}

ucitajTestnePodatke()
  .catch((greska: unknown) => {
    console.error('Učitavanje testnih podataka nije uspjelo:', greska);
    process.exitCode = 1;
  })
  .finally(zatvoriBazu);