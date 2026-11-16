/**
 * Upis partije u bazu (model-podataka.md): partije, sudionici_partije, potezi, agregati u igraci.
 * Upisi tijekom igre su fire-and-forget zbog latencije, ali završni tok mora osigurati
 * uspješan upis početka i svih poteza prije isplate XP-a (idempotentni retry).
 */
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { izracunajNovaDostignuca, izracunajOcjenuIgre, izracunajUniverzalniUcinak, jeNapredakUniverzalnogRanga, kolekcijskiKljucGrupe, odrediPohvaleIgre, postotakXpZaOcjenu, MAKSIMALNO_ISKUSTVO, stanjeIskustva, ZADANI_PRAVILNIK, type DnkOs, type DeltaNapretkaDostignuca, type MetrikeMisijaIgre, type ModPartije, type NovoDostignuce, type ObavijestOtkljucanogDostignuca, type PohvalaIgre, type PravilnikPartije, type PromjenaMisije, type UkupnoIskustvoIshoda } from 'zajednicko';
import { bonusPobjednickogNiza, izracunajFormu } from 'zajednicko';
import { baza } from '../baza/klijent.js';
import { jeJedinstvenostPrekrsena } from '../baza/greske.js';
import { botovi, dostignucaIgraca, dnkStatistikeIgraca, igraci, napredakDostignucaIgraca, nizoviPobjedaIgraca, obracuniPartija, otkljucaneGrupeIgraca, otkljucaneRijeciIgraca, partije, pohvaleIgre, potezi, rezultatiFormeIgraca, statistikeModaIgraca, statistikeRijeciIgraca, sudioniciPartije, ucinakPosebneRijeci } from '../baza/shema.js';
import type { VrstaMetePosebneRijeci } from './odluke-pravila.js';
import { emitirajNovostiDostignuca } from '../dostignuca/obavijesti.js';
import { obradiNeobradeneTop10Dokaze, zabiljeziTop10NakonPromjene } from '../dostignuca/top10.js';
import { ocistiMemorijuLjestvica } from '../ljestvice/servis.js';
import { priznajPrivatnika } from '../dostignuca/dodjela.js';
import { priznajCistuPetica, priznajDnevnuPobjeduModa, priznajRijetkuGrdosiju, priznajSvePohvale } from '../dostignuca/dodjela-d02.js';
import { dohvatiIshodMisija, obracunajMisijeZaIgraca } from '../misije/obracun.js';
import {
  emitirajPromjeneSanducica,
  obradiDovrsenuIgruSanducic,
  stvoriPorukeKolekcije,
  stvoriPorukeXpRazina,
  stvoriPorukeZvjezdica,
  stvoriPorukuForme10,
  stvoriPorukuGostSazetak,
  stvoriPorukuPromjeneRanga,
} from '../sanducic/okidaci.js';
import type { MisijeTx } from '../misije/tipovi.js';
import type { SudionikPartije } from './motor-partije.js';
import { primaProfilnuGamifikaciju, type BotTipPrezentacije } from './gamifikacija-racuna.js';
import {
  izracunajDnk,
  prazniDnkBrojaci,
  zbrojiDnkRedove,
  type DnkPodaciZajednicki,
} from './izracun-dnk.js';
import { upisiUniverzalniRangZaStol, type RangSudionikUlaz, type RangUpisRezultat } from './univerzalni-rang.js';

async function brojKolekcijskihStavki(tx: MisijeTx, igracId: string): Promise<number> {
  const redovi = await tx
    .select({ grupa: otkljucaneGrupeIgraca.grupa })
    .from(otkljucaneGrupeIgraca)
    .where(eq(otkljucaneGrupeIgraca.igracId, igracId));
  return new Set(redovi.map((red) => kolekcijskiKljucGrupe(red.grupa))).size;
}

type BrojaciModa = { odigrane: number; bodovi: number; eliminacije: number; pobjede: number };

async function dohvatiBrojaceModa(
  tx: MisijeTx,
  igracId: string,
  mod: ModPartije,
): Promise<BrojaciModa> {
  if (mod === 'tri_igraca') {
    const [red] = await tx
      .select({
        odigrane: statistikeModaIgraca.odigrane,
        bodovi: statistikeModaIgraca.bodovi,
        eliminacije: statistikeModaIgraca.eliminacije,
        pobjede: statistikeModaIgraca.pobjede,
      })
      .from(statistikeModaIgraca)
      .where(and(eq(statistikeModaIgraca.igracId, igracId), eq(statistikeModaIgraca.mod, mod)))
      .limit(1);
    return {
      odigrane: red?.odigrane ?? 0,
      bodovi: red?.bodovi ?? 0,
      eliminacije: red?.eliminacije ?? 0,
      pobjede: red?.pobjede ?? 0,
    };
  }
  const [red] = await tx
    .select({
      odigrane: mod === 'dva_igraca' ? igraci.odigrane1v1 : igraci.odigrane,
      bodovi: mod === 'dva_igraca' ? igraci.bodovi1v1 : igraci.bodoviUkupno,
      eliminacije: mod === 'dva_igraca' ? igraci.eliminacije1v1 : igraci.eliminacijeUkupno,
      pobjede: mod === 'dva_igraca' ? igraci.pobjede1v1 : igraci.pobjede,
    })
    .from(igraci)
    .where(eq(igraci.id, igracId))
    .limit(1);
  return {
    odigrane: red?.odigrane ?? 0,
    bodovi: red?.bodovi ?? 0,
    eliminacije: red?.eliminacije ?? 0,
    pobjede: red?.pobjede ?? 0,
  };
}

/** N2/N3/N4 + eliminacije za zajednički DNK (PR10). */
async function dohvatiBrojaceSvihFormata(tx: MisijeTx, igracId: string): Promise<{
  n2: number;
  n3: number;
  n4: number;
  eliminacijeUkupno: number;
}> {
  const [dva, cetiri, troboj] = await Promise.all([
    dohvatiBrojaceModa(tx, igracId, 'dva_igraca'),
    dohvatiBrojaceModa(tx, igracId, 'cetiri_igraca'),
    dohvatiBrojaceModa(tx, igracId, 'tri_igraca'),
  ]);
  return {
    n2: dva.odigrane,
    n3: troboj.odigrane,
    n4: cetiri.odigrane,
    eliminacijeUkupno: dva.eliminacije + troboj.eliminacije + cetiri.eliminacije,
  };
}

async function dohvatiZbrojeneDnkBrojace(tx: MisijeTx, igracId: string) {
  const redovi = await tx.select().from(dnkStatistikeIgraca).where(eq(dnkStatistikeIgraca.igracId, igracId));
  return zbrojiDnkRedove(redovi);
}

async function dohvatiZajednickiDnkPodaci(
  tx: MisijeTx,
  igracId: string,
  univerzalniUcinak: number,
): Promise<DnkPodaciZajednicki> {
  const [formati, brojaci] = await Promise.all([
    dohvatiBrojaceSvihFormata(tx, igracId),
    dohvatiZbrojeneDnkBrojace(tx, igracId),
  ]);
  return {
    n2: formati.n2,
    n3: formati.n3,
    n4: formati.n4,
    eliminacijeUkupno: formati.eliminacijeUkupno,
    prihvaceniPotezi: brojaci.prihvaceniPotezi,
    ukupnoTrajanjePrihvaceniPoteziMs: brojaci.ukupnoTrajanjePrihvaceniPoteziMs,
    najduziStreak: brojaci.najduziStreak,
    dugeRijeci: brojaci.dugeRijeci,
    srednjeDugeRijeci: brojaci.srednjeDugeRijeci,
    jakoDugeRijeci: brojaci.jakoDugeRijeci,
    rijetkeRijeci: brojaci.rijetkeRijeci,
    srednjeRijetkeRijeci: brojaci.srednjeRijetkeRijeci,
    jakoRijetkeRijeci: brojaci.jakoRijetkeRijeci,
    univerzalniUcinak,
  };
}

export async function zapisiPocetakPartije(
  partijaId: string,
  sudionici: SudionikPartije[],
  cekanjeMsPoIgracu: Map<string, number>,
  mod: ModPartije = 'cetiri_igraca',
  brojBotova = 0,
  opcije: {
    pravila?: PravilnikPartije;
    spojeniDvoboj?: boolean;
  } = {},
): Promise<void> {
  const [postojeca] = await baza
    .select({ id: partije.id })
    .from(partije)
    .where(eq(partije.id, partijaId))
    .limit(1);
  if (postojeca) return;

  const pravila = opcije.pravila ?? ZADANI_PRAVILNIK;
  const spojeniDvoboj = opcije.spojeniDvoboj ?? false;

  try {
    await baza.transaction(async (tx) => {
      await tx.insert(partije).values({
        id: partijaId,
        mod,
        pravila,
        spojeniDvoboj,
        status: 'u_tijeku',
        brojBotova,
      });
      await tx.insert(sudioniciPartije).values(
        sudionici.map((s) => ({
          partijaId,
          igracId: s.igracId,
          nadimak: s.nadimak,
          sjedalo: s.sjedalo,
          odabranaPravila: s.odabranaPravila ?? pravila,
          cekanjeMs: cekanjeMsPoIgracu.get(s.igracId) ?? 0,
        })),
      );
    });
  } catch (greska) {
    if (jeJedinstvenostPrekrsena(greska)) {
      const [vecPostoji] = await baza
        .select({ id: partije.id })
        .from(partije)
        .where(eq(partije.id, partijaId))
        .limit(1);
      if (vecPostoji) return;
    }
    console.error('Neuspio transakcijski upis početka partije:', greska);
    throw new Error('Početak partije nije moguće spremiti.', { cause: greska });
  }
}

/** Restart ili kontrolirano gašenje prekida samo partije koje nisu završile. */
export async function ponistiPartijeUTijekuUBazi(partijaIdovi?: readonly string[]): Promise<number> {
  const uvjet = partijaIdovi && partijaIdovi.length > 0
    ? and(eq(partije.status, 'u_tijeku'), inArray(partije.id, [...partijaIdovi]))
    : eq(partije.status, 'u_tijeku');
  const ponistene = await baza
    .update(partije)
    .set({ status: 'ponistena', kraj: new Date() })
    .where(uvjet)
    .returning({ id: partije.id });
  return ponistene.length;
}

export interface ZapisPoteza {
  partijaId: string;
  runda: number;
  redniBroj: number;
  igracId: string | null;
  vrsta: 'rijec' | 'ne_znam' | 'istek' | 'prekid' | 'auto_kraj' | 'kaladont' | 'sustav_rijec';
  rijec: string | null;
  trazenaSlova: string | null;
  trajanjeMs: number;
}

/**
 * Idempotentan upis: UNIQUE (partija_id, redni_broj) sukob je uspjeh (ponovna provjera),
 * ne novi write. Ostale DB greške se propagiraju.
 */
export async function zapisiPotez(zapis: ZapisPoteza): Promise<void> {
  try {
    await baza.insert(potezi).values(zapis);
  } catch (greska) {
    if (jeJedinstvenostPrekrsena(greska)) return;
    console.error('Neuspio upis poteza:', greska);
    throw greska;
  }
}

export type ZapisUcinakPosebneRijeci = {
  partijaId: string;
  redniBroj: number;
  rijec: string;
  uzrocnikId: string | null;
  zrtvaId: string | null;
  vrstaMete: VrstaMetePosebneRijeci | null;
  brojAktivnihPrije: number;
  ucinak: 'eliminacija' | 'bez_zrtve';
};

/** Idempotentan upis činjenica posebne riječi (PR04 → PR12/13). */
export async function zapisiUcinakPosebneRijeci(zapis: ZapisUcinakPosebneRijeci): Promise<void> {
  try {
    await baza.insert(ucinakPosebneRijeci).values(zapis).onConflictDoNothing();
  } catch (greska) {
    if (jeJedinstvenostPrekrsena(greska)) return;
    console.error('Neuspio upis učinka posebne riječi:', greska);
    throw greska;
  }
}

/** Ponovno osigurava sve payloade (npr. nakon privremenog kvara baze prije završnog XP-a). */
export async function osigurajUpisePoteza(zapisi: readonly ZapisPoteza[]): Promise<void> {
  await Promise.all(zapisi.map((zapis) => zapisiPotez(zapis)));
}

/** Završni retry za učinke posebnih riječi (isti stil kao `osigurajUpisePoteza`). */
export async function osigurajUpiseUcinakaPosebneRijeci(
  zapisi: readonly ZapisUcinakPosebneRijeci[],
): Promise<void> {
  await Promise.all(zapisi.map((zapis) => zapisiUcinakPosebneRijeci(zapis)));
}

export function spremiRaniPorazUBazi(zapis: {
  partijaId: string;
  igracId: string;
  mod: ModPartije;
  plasman: number;
  bodovi: number;
  eliminacije: number;
  nacinIspadanja: 'ne_znam' | 'istek' | 'mrtva_slova' | 'prekid' | 'kaladont';
}): Promise<void> {
  return baza.transaction(async (tx) => {
    await tx.update(sudioniciPartije).set({
      plasman: zapis.plasman,
      bodovi: zapis.bodovi,
      eliminacije: zapis.eliminacije,
      nacinIspadanja: zapis.nacinIspadanja,
    }).where(and(
      eq(sudioniciPartije.partijaId, zapis.partijaId),
      eq(sudioniciPartije.igracId, zapis.igracId),
      sql`${sudioniciPartije.plasman} is null`,
    ));
    await tx.insert(rezultatiFormeIgraca).values({
      igracId: zapis.igracId,
      partijaId: zapis.partijaId,
      mod: zapis.mod,
      plasman: zapis.plasman,
      bodovi: zapis.bodovi,
      eliminacije: zapis.eliminacije,
    }).onConflictDoNothing();
    await tx.insert(nizoviPobjedaIgraca).values({
      igracId: zapis.igracId,
      mod: zapis.mod,
      trenutniNiz: 0,
      najboljiNiz: 0,
      zadnjaObradenaPartijaId: zapis.partijaId,
    }).onConflictDoUpdate({
      target: [nizoviPobjedaIgraca.igracId, nizoviPobjedaIgraca.mod],
      set: {
        trenutniNiz: sql`case when ${nizoviPobjedaIgraca.zadnjaObradenaPartijaId} = ${zapis.partijaId} then ${nizoviPobjedaIgraca.trenutniNiz} else 0 end`,
        zadnjaObradenaPartijaId: zapis.partijaId,
        azurirano: new Date(),
      },
    });
  }).then(() => {}).catch((greska) => {
    console.error('Neuspjelo rano spremanje poraza:', greska);
  });
}

export interface ZapisSudionika {
  igracId: string;
  /** Javni 1..n; privatni može biti 1–8. */
  plasman: number;
  bodovi: number;
  eliminacije: number;
  iskustvo: number;
  nacinIspadanja: 'ne_znam' | 'istek' | 'mrtva_slova' | 'prekid' | 'pobjednik' | 'kaladont';
}

export interface ZapisStatistikeRijeci {
  igracId: string;
  grupe: { grupa: string; tier: number | null }[];
  otkljucaneRijeci: { rijec: string; jakoDuga: boolean; jakoRijetka: boolean; dugaTier: number | null; rijetkaTier: number | null }[];
  prihvaceniPotezi: number;
  ukupnoTrajanjePrihvaceniPoteziMs: number;
  najduziStreak: number;
  otkriveneJakoRijetkeGrupe: number;
  otkriveneSrednjeRijetkeGrupe: number;
  otkriveneRijetkeGrupe: number;
  upisaneDugeRijeci: number;
  upisaneSrednjeDugeRijeci: number;
  upisaneJakoDugeRijeci: number;
  prihvaceneRijetkeRijeci?: number;
  prihvaceneJakoRijetkeRijeci?: number;
  dugeIRijetkeRijeci?: number;
  razlicitiPoceci?: string[];
  najduzaRijec: string | null;
  najduzaRijecGrafemi: number;
  najrjedaRijec: string | null;
  najrjedaRijecFrekvencija: number | null;
  najrjedaTier: number | null;
  /** Poznata nula ili broj pravih pogrešnih unosa. Izostanak = nepoznato, nikad 0. */
  pogresniUnosi?: number;
  /** Oblici kvalificirani tijekom igre (dugi i bilo kojeg tiera rijetkosti), već normalizirani. */
  dugeRijetkeRijeci?: readonly string[];
  /** PR12: uspješni dokazi ovog igrača u ovoj igri. */
  uspjesniDokazi?: number;
  /** PR12: kaladont → sljedeći uz ≥3 aktivna prije poteza. */
  kaladontSljedeciUzTriPlus?: number;
}

/**
 * PR12: pravilnik / spojeni Dvoboj / odabiri s kartica — ulaz u MetrikeMisijaIgre.
 * HINT: brojači dokaza/kaladonta idu kroz ZapisStatistikeRijeci, ne ovdje (ne miješati s achievement deltom).
 */
export type KontekstMisijaZavrseneIgre = {
  pravila: PravilnikPartije;
  spojeniDvoboj: boolean;
  odabranaPravilaPoIgracu: ReadonlyMap<string, PravilnikPartije>;
};

export interface ZapisNapretkaDostignuca {
  delta: DeltaNapretkaDostignuca;
}

interface AgregatZakljucka {
  bodoviUkupno: number;
  odigrane: number;
  pobjede: number;
  iskustvoUkupno: number;
  dovrseneIgre: number;
  novaDostignuca: NovoDostignuce[];
  dnkPrije: DnkOs[];
  dnkPoslije: DnkOs[];
  ocjenaIgre: number | null;
  bonusOcjenaIgre: number;
  nizPrije: number;
  nizPoslije: number;
  najboljiNiz: number;
  osnovniXp: number;
  bonusPobjednickogNizaPostotak: number;
  bonusPobjednickogNizaXp: number;
  forma: ReturnType<typeof izracunajFormu> | null;
  pohvale: PohvalaIgre[];
  upravljac: 'covjek' | 'bot';
  vrstaIgraca: 'gost' | 'registriran' | 'admin';
  botTip: BotTipPrezentacije | null;
  iskustvoPrijePartije: number;
  promjeneMisija?: PromjenaMisije[];
  ukupnoIskustvo?: UkupnoIskustvoIshoda;
  misijeStanjeVerzija?: number;
  /** PR09: univerzalni rang nakon ove partije (ako je upisan). */
  rangBrojPartija?: number;
  rangSumaJedinica?: number;
  rangNaziv?: string;
  /** PR10: N2+N3+N4 nakon partije — za mojDnk unlock (ne formatni odigrane). */
  javnePartijeUkupno?: number;
  /** Privremeni brojači za finalni dnkPoslije nakon upisa ranga. */
  dnkPoslijePodaci?: DnkPodaciZajednicki;
}

/** Sažetak igre za vremenske ljestvice; bez statistike ostaje NULL (nepoznato), nikad 0. */
export function sazetakMetrika(statistika: ZapisStatistikeRijeci | undefined) {
  if (!statistika) return {};
  const imaRijeci = statistika.prihvaceniPotezi > 0;
  if (imaRijeci && (!statistika.najduzaRijec || statistika.najduzaRijecGrafemi <= 0)) {
    // Nekonzistentan sažetak ne smije srušiti upis rezultata; ostaje nepoznat.
    console.error(`Nepotpun sažetak metrika za igrača ${statistika.igracId}; ne upisuje se.`);
    return {};
  }
  return {
    metrikeVerzija: 1,
    prihvaceneRijeci: statistika.prihvaceniPotezi,
    trajanjePrihvacenihMs: imaRijeci ? Math.max(0, Math.round(statistika.ukupnoTrajanjePrihvaceniPoteziMs)) : 0,
    najduziNizRijeci: imaRijeci ? Math.min(Math.max(1, statistika.najduziStreak), statistika.prihvaceniPotezi) : 0,
    najduzaRijec: imaRijeci ? statistika.najduzaRijec : null,
    najduzaRijecGrafemi: imaRijeci ? statistika.najduzaRijecGrafemi : null,
    // NULL ostaje nepoznato. Eksplicitna 0 jest stvarna nula i jedina vrijednost koja može otključati Čistu peticu.
    ...(typeof statistika.pogresniUnosi === 'number' ? { pogresniUnosi: statistika.pogresniUnosi } : {}),
  };
}

function jeNamjerniIzlazak(nacin: string): boolean {
  return nacin === 'prekid' || nacin === 'odspajanje' || nacin === 'napustanje';
}

/** Sandučić / misije / sesije: samo ljudski računi (botovi nemaju inbox). */
function jeLjudskiZaSanducic(upravljac: string): boolean {
  return upravljac === 'covjek';
}

/** Zaključuje partiju transakcijski i vraća ažurirane agregate (bodovi_ukupno, odigrane) po igraču. */
export async function zakljuciPartijuUBazi(
  partijaId: string,
  pobjednikId: string,
  rezultati: ZapisSudionika[],
  mod: ModPartije = 'cetiri_igraca',
  statistike: Map<string, ZapisStatistikeRijeci> = new Map(),
  samoStatistika = false,
  napredakDostignuca: Map<string, ZapisNapretkaDostignuca> = new Map(),
  zavrsenoU: Date = new Date(),
  /** Osnovni bruto XP prije bonusa niza/ocjene (iz motora); za rangiranje pohvale. */
  osnovniBrutoPoIgracu: Map<string, number> = new Map(),
  /** PR12: pravilnik + odabiri za filter misija (javne igre). */
  kontekstMisija: KontekstMisijaZavrseneIgre | null = null,
): Promise<Map<string, AgregatZakljucka>> {
  const agregati = new Map<string, AgregatZakljucka>();
  const obavijestiPoIgracu = new Map<string, ObavijestOtkljucanogDostignuca[]>();
  const sanducicIgraci = new Set<string>();
  const modStatistike = mod;
  let javniZavrsetak = false;

  const zapamtiObavijesti = (igracId: string, obavijesti: readonly ObavijestOtkljucanogDostignuca[]) => {
    if (obavijesti.length === 0) return;
    const lista = obavijestiPoIgracu.get(igracId) ?? [];
    lista.push(...obavijesti);
    obavijestiPoIgracu.set(igracId, lista);
  };

  const pridruziDostignuca = (
    igracId: string,
    nova: readonly NovoDostignuce[],
    upravljac: 'covjek' | 'bot',
    vrstaIgraca: 'gost' | 'registriran' | 'admin',
    iskustvoPrijePartije: number,
  ) => {
    if (nova.length === 0) return;
    const postojeci = agregati.get(igracId);
    if (!postojeci) {
      agregati.set(igracId, {
        bodoviUkupno: 0,
        odigrane: 0,
        pobjede: 0,
        iskustvoUkupno: 0,
        dovrseneIgre: 0,
        novaDostignuca: [...nova],
        dnkPrije: [],
        dnkPoslije: [],
        ocjenaIgre: null,
        bonusOcjenaIgre: 0,
        nizPrije: 0,
        nizPoslije: 0,
        najboljiNiz: 0,
        osnovniXp: 0,
        bonusPobjednickogNizaPostotak: 0,
        bonusPobjednickogNizaXp: 0,
        forma: null,
        pohvale: [],
        upravljac,
        vrstaIgraca,
        botTip: null,
        iskustvoPrijePartije,
      });
      return;
    }
    const poId = new Map(postojeci.novaDostignuca.map((dostignuce) => [dostignuce.id, dostignuce]));
    for (const dostignuce of nova) {
      const staro = poId.get(dostignuce.id);
      if (!staro || dostignuce.novaRazina > staro.novaRazina) poId.set(dostignuce.id, dostignuce);
    }
    postojeci.novaDostignuca = [...poId.values()];
  };

  const primijeniDodjelu = (
    igracId: string,
    ishod: { noveObavijesti: readonly ObavijestOtkljucanogDostignuca[]; novaDostignuca: readonly NovoDostignuce[] },
    upravljac: 'covjek' | 'bot',
    vrstaIgraca: 'gost' | 'registriran' | 'admin',
    iskustvoPrijePartije: number,
  ) => {
    zapamtiObavijesti(igracId, ishod.noveObavijesti);
    pridruziDostignuca(igracId, ishod.novaDostignuca, upravljac, vrstaIgraca, iskustvoPrijePartije);
  };

  await baza.transaction(async (tx) => {
    const brojNovihRijetkihGrupa = new Map<string, number>();
    const claim = samoStatistika
      ? await tx.insert(obracuniPartija)
        .values({ partijaId, vrsta: 'privatna_gamifikacija' })
        .onConflictDoNothing()
        .returning({ partijaId: obracuniPartija.partijaId })
      : await tx.update(partije)
        .set({ status: 'zavrsena', kraj: zavrsenoU, pobjednikId })
        .where(and(eq(partije.id, partijaId), eq(partije.status, 'u_tijeku')))
        .returning({ partijaId: partije.id });

    if (claim.length === 0) {
      const spremljenePohvale = !samoStatistika
        ? await tx.select().from(pohvaleIgre).where(eq(pohvaleIgre.igraId, partijaId))
        : [];
      const pohvalePoIgracu = new Map<string, PohvalaIgre[]>();
      for (const red of spremljenePohvale) {
        const lista = pohvalePoIgracu.get(red.igracId) ?? [];
        lista.push({
          vrsta: red.vrsta,
          vrijednost: red.vrijednost,
          dijeljenoPrvoMjesto: spremljenePohvale.filter((p) => p.vrsta === red.vrsta).length > 1,
        });
        pohvalePoIgracu.set(red.igracId, lista);
      }
      for (const r of rezultati) {
        const [stanjeIgraca] = await tx
          .select({
            iskustvoUkupno: igraci.iskustvoUkupno,
            upravljac: igraci.upravljac,
            vrstaIgraca: igraci.vrsta,
          })
          .from(igraci)
          .where(eq(igraci.id, r.igracId));
        if (stanjeIgraca) {
          const brojaci = await dohvatiBrojaceModa(tx, r.igracId, mod);
          agregati.set(r.igracId, {
            bodoviUkupno: brojaci.bodovi,
            odigrane: brojaci.odigrane,
            pobjede: brojaci.pobjede,
            iskustvoUkupno: stanjeIgraca.iskustvoUkupno,
            dovrseneIgre: 0,
            novaDostignuca: [],
            dnkPrije: [],
            dnkPoslije: [],
            ocjenaIgre: null,
            bonusOcjenaIgre: 0,
            nizPrije: 0,
            nizPoslije: 0,
            najboljiNiz: 0,
            osnovniXp: 0,
            bonusPobjednickogNizaPostotak: 0,
            bonusPobjednickogNizaXp: 0,
            forma: null,
            pohvale: pohvalePoIgracu.get(r.igracId) ?? [],
            upravljac: stanjeIgraca.upravljac,
            vrstaIgraca: stanjeIgraca.vrstaIgraca,
            botTip: null,
            iskustvoPrijePartije: stanjeIgraca.iskustvoUkupno,
          });
          if (!samoStatistika && (stanjeIgraca.vrstaIgraca === 'registriran' || stanjeIgraca.vrstaIgraca === 'admin') && stanjeIgraca.upravljac === 'covjek') {
            const ishod = await dohvatiIshodMisija(tx, r.igracId, 'javna', partijaId);
            const agregat = agregati.get(r.igracId);
            if (ishod && agregat) {
              agregat.promjeneMisija = ishod.promjeneMisija;
              agregat.ukupnoIskustvo = ishod.ukupnoIskustvo;
              agregat.misijeStanjeVerzija = ishod.misijeStanjeVerzija;
            }
          }
        }
      }
      return;
    }

    if (!samoStatistika) {
      await tx.insert(obracuniPartija)
        .values({ partijaId, vrsta: 'javna_partija' })
        .onConflictDoNothing();
    } else {
      await tx.update(partije)
        .set({ status: 'zavrsena', kraj: zavrsenoU, pobjednikId })
        .where(and(eq(partije.id, partijaId), eq(partije.status, 'u_tijeku')));
    }

    for (const r of rezultati) {
      const [stariIgracOsnova] = await tx.select({
        vrsta: igraci.vrsta,
        upravljac: igraci.upravljac,
        iskustvoUkupno: igraci.iskustvoUkupno,
        botTip: botovi.tip,
      }).from(igraci)
        .leftJoin(botovi, eq(botovi.igracId, igraci.id))
        .where(eq(igraci.id, r.igracId));
      const brojaciPrije = await dohvatiBrojaceModa(tx, r.igracId, mod);
      const stariIgrac = stariIgracOsnova
        ? {
          ...stariIgracOsnova,
          odigrane: brojaciPrije.odigrane,
          bodovi: brojaciPrije.bodovi,
          eliminacije: brojaciPrije.eliminacije,
          pobjede: brojaciPrije.pobjede,
        }
        : undefined;
      const upravljac = stariIgrac?.upravljac ?? 'covjek';
      const vrstaIgraca = stariIgrac?.vrsta ?? 'gost';
      const botTip = (stariIgrac?.botTip ?? null) as BotTipPrezentacije | null;
      const primaGamifikaciju = primaProfilnuGamifikaciju(vrstaIgraca, upravljac, botTip);

      // Bot: samo zapis sudionika/povijesti partije; bez nizova, forme, kolekcije, DNK, XP/ranga.
      // Pohvale se i dalje dodjeljuju kasnije iz agregata + osnovniBrutoPoIgracu.
      if (!samoStatistika && upravljac === 'bot') {
        await tx
          .update(sudioniciPartije)
          .set({
            plasman: r.plasman,
            bodovi: r.bodovi,
            eliminacije: r.eliminacije,
            iskustvo: r.iskustvo,
            nacinIspadanja: r.nacinIspadanja,
            ...sazetakMetrika(statistike.get(r.igracId)),
          })
          .where(and(eq(sudioniciPartije.partijaId, partijaId), eq(sudioniciPartije.igracId, r.igracId)));
        agregati.set(r.igracId, {
          bodoviUkupno: stariIgrac?.bodovi ?? 0,
          odigrane: stariIgrac?.odigrane ?? 0,
          pobjede: 0,
          iskustvoUkupno: stariIgrac?.iskustvoUkupno ?? 0,
          dovrseneIgre: 0,
          novaDostignuca: [],
          dnkPrije: [],
          dnkPoslije: [],
          ocjenaIgre: null,
          bonusOcjenaIgre: 0,
          nizPrije: 0,
          nizPoslije: 0,
          najboljiNiz: 0,
          osnovniXp: 0,
          bonusPobjednickogNizaPostotak: 0,
          bonusPobjednickogNizaXp: 0,
          forma: null,
          pohvale: [],
          upravljac,
          vrstaIgraca,
          botTip,
          iskustvoPrijePartije: stariIgrac?.iskustvoUkupno ?? 0,
        });
        continue;
      }

      // PR10: zbroj svih dnk_statistike redova + N2/N3/N4 za zajedničke osi.
      const [rangPrijeRed] = await tx
        .select({
          rangSumaJedinica: igraci.rangSumaJedinica,
          rangBrojPartija: igraci.rangBrojPartija,
        })
        .from(igraci)
        .where(eq(igraci.id, r.igracId))
        .limit(1);
      const ucinakPrije = izracunajUniverzalniUcinak(
        Number(rangPrijeRed?.rangSumaJedinica ?? 0),
        rangPrijeRed?.rangBrojPartija ?? 0,
      );
      const zajednickiPrije = stariIgrac
        ? await dohvatiZajednickiDnkPodaci(tx, r.igracId, ucinakPrije)
        : null;
      const prije = zajednickiPrije ? izracunajDnk(zajednickiPrije) : [];
      const [stariNiz] = !samoStatistika
        ? await tx.select().from(nizoviPobjedaIgraca).where(and(
          eq(nizoviPobjedaIgraca.igracId, r.igracId),
          eq(nizoviPobjedaIgraca.mod, mod),
        )).limit(1)
        : [];
      const [azuriraniNiz] = !samoStatistika
        ? await tx.insert(nizoviPobjedaIgraca).values({
          igracId: r.igracId,
          mod,
          trenutniNiz: r.plasman === 1 ? 1 : 0,
          najboljiNiz: r.plasman === 1 ? 1 : 0,
          zadnjaObradenaPartijaId: partijaId,
        }).onConflictDoUpdate({
          target: [nizoviPobjedaIgraca.igracId, nizoviPobjedaIgraca.mod],
          set: {
            trenutniNiz: sql`case when ${nizoviPobjedaIgraca.zadnjaObradenaPartijaId} = ${partijaId} then ${nizoviPobjedaIgraca.trenutniNiz} when ${r.plasman === 1} then ${nizoviPobjedaIgraca.trenutniNiz} + 1 else 0 end`,
            najboljiNiz: sql`case when ${nizoviPobjedaIgraca.zadnjaObradenaPartijaId} = ${partijaId} then ${nizoviPobjedaIgraca.najboljiNiz} when ${r.plasman === 1} then greatest(${nizoviPobjedaIgraca.najboljiNiz}, ${nizoviPobjedaIgraca.trenutniNiz} + 1) else ${nizoviPobjedaIgraca.najboljiNiz} end`,
            zadnjaObradenaPartijaId: partijaId,
            azurirano: new Date(),
          },
        }).returning()
        : [];
      const nizPrije = stariNiz?.trenutniNiz ?? 0;
      const nizPoslije = azuriraniNiz?.trenutniNiz ?? nizPrije;
      const najboljiNiz = azuriraniNiz?.najboljiNiz ?? stariNiz?.najboljiNiz ?? 0;
      const osnovniXp = r.iskustvo;
      const bonusPobjednickogNizaPostotak = !samoStatistika && r.plasman === 1 ? bonusPobjednickogNiza(nizPoslije, mod) : 0;
      const bonusPobjednickogNizaXp = Math.round(osnovniXp * bonusPobjednickogNizaPostotak / 100);
      r.iskustvo += bonusPobjednickogNizaXp;
      if (!samoStatistika) {
        await tx.insert(rezultatiFormeIgraca).values({
          igracId: r.igracId,
          partijaId,
          mod,
          plasman: r.plasman,
          bodovi: r.bodovi,
          eliminacije: r.eliminacije,
        }).onConflictDoNothing();
      }
      let forma: ReturnType<typeof izracunajFormu> | null = null;
      if (!samoStatistika) {
        const rezultatiForme = await tx.select({
          partijaId: rezultatiFormeIgraca.partijaId,
          kraj: rezultatiFormeIgraca.zavrseno,
          plasman: rezultatiFormeIgraca.plasman,
          bodovi: rezultatiFormeIgraca.bodovi,
          eliminacije: rezultatiFormeIgraca.eliminacije,
        }).from(rezultatiFormeIgraca).where(and(
          eq(rezultatiFormeIgraca.igracId, r.igracId),
          eq(rezultatiFormeIgraca.mod, mod),
        )).orderBy(desc(rezultatiFormeIgraca.zavrseno), desc(rezultatiFormeIgraca.partijaId)).limit(20);
        forma = izracunajFormu(rezultatiForme.map((rezultat) => ({ ...rezultat, kraj: rezultat.kraj.toISOString() })), mod);
      }
      if (!samoStatistika) {
        await tx
          .update(sudioniciPartije)
          .set({
            plasman: r.plasman,
            bodovi: r.bodovi,
            eliminacije: r.eliminacije,
            iskustvo: r.iskustvo,
            nacinIspadanja: r.nacinIspadanja,
            ...sazetakMetrika(statistike.get(r.igracId)),
          })
          .where(and(eq(sudioniciPartije.partijaId, partijaId), eq(sudioniciPartije.igracId, r.igracId)));
      }

      if (!samoStatistika && mod === 'dva_igraca') {
        const [azurirani] = await tx
          .update(igraci)
          .set({
            odigrane1v1: sql`${igraci.odigrane1v1} + 1`,
            pobjede1v1: sql`${igraci.pobjede1v1} + ${r.plasman === 1 ? 1 : 0}`,
            eliminacije1v1: sql`${igraci.eliminacije1v1} + ${r.eliminacije}`,
            bodovi1v1: sql`${igraci.bodovi1v1} + ${r.bodovi}`,
            iskustvoUkupno: sql`least(${igraci.iskustvoUkupno} + ${r.iskustvo}, ${MAKSIMALNO_ISKUSTVO})`,
            dovrseneIgre: sql`${igraci.dovrseneIgre} + 1`,
          })
          .where(eq(igraci.id, r.igracId))
          .returning({
            bodoviUkupno: igraci.bodovi1v1,
            odigrane: igraci.odigrane1v1,
            pobjede: igraci.pobjede1v1,
            iskustvoUkupno: igraci.iskustvoUkupno,
            dovrseneIgre: igraci.dovrseneIgre,
          });

        if (azurirani) {
          agregati.set(r.igracId, {
            ...azurirani,
            novaDostignuca: [],
            dnkPrije: prije,
            dnkPoslije: [],
            ocjenaIgre: 0,
            bonusOcjenaIgre: 0,
            nizPrije,
            nizPoslije,
            najboljiNiz,
            osnovniXp,
            bonusPobjednickogNizaPostotak,
            bonusPobjednickogNizaXp,
            forma,
            pohvale: [],
            upravljac,
            vrstaIgraca,
            botTip,
            iskustvoPrijePartije: stariIgrac?.iskustvoUkupno ?? 0,
          });
        }
      } else if (!samoStatistika && mod === 'tri_igraca') {
        // Troboj: format u statistike_moda_igraca; XP/dovrseneIgre na igraci; bez diranja 2p/4p stupaca.
        const [azuriraniXp] = await tx
          .update(igraci)
          .set({
            iskustvoUkupno: sql`least(${igraci.iskustvoUkupno} + ${r.iskustvo}, ${MAKSIMALNO_ISKUSTVO})`,
            dovrseneIgre: sql`${igraci.dovrseneIgre} + 1`,
          })
          .where(eq(igraci.id, r.igracId))
          .returning({
            iskustvoUkupno: igraci.iskustvoUkupno,
            dovrseneIgre: igraci.dovrseneIgre,
          });
        const [azuriraniMod] = await tx.insert(statistikeModaIgraca).values({
          igracId: r.igracId,
          mod: 'tri_igraca',
          odigrane: 1,
          pobjede: r.plasman === 1 ? 1 : 0,
          eliminacije: r.eliminacije,
          bodovi: r.bodovi,
        }).onConflictDoUpdate({
          target: [statistikeModaIgraca.igracId, statistikeModaIgraca.mod],
          set: {
            odigrane: sql`${statistikeModaIgraca.odigrane} + 1`,
            pobjede: sql`${statistikeModaIgraca.pobjede} + ${r.plasman === 1 ? 1 : 0}`,
            eliminacije: sql`${statistikeModaIgraca.eliminacije} + ${r.eliminacije}`,
            bodovi: sql`${statistikeModaIgraca.bodovi} + ${r.bodovi}`,
            azurirano: new Date(),
          },
        }).returning({
          bodoviUkupno: statistikeModaIgraca.bodovi,
          odigrane: statistikeModaIgraca.odigrane,
          pobjede: statistikeModaIgraca.pobjede,
        });

        if (azuriraniXp && azuriraniMod) {
          agregati.set(r.igracId, {
            bodoviUkupno: azuriraniMod.bodoviUkupno,
            odigrane: azuriraniMod.odigrane,
            pobjede: azuriraniMod.pobjede,
            iskustvoUkupno: azuriraniXp.iskustvoUkupno,
            dovrseneIgre: azuriraniXp.dovrseneIgre,
            novaDostignuca: [],
            dnkPrije: prije,
            dnkPoslije: [],
            ocjenaIgre: 0,
            bonusOcjenaIgre: 0,
            nizPrije,
            nizPoslije,
            najboljiNiz,
            osnovniXp,
            bonusPobjednickogNizaPostotak,
            bonusPobjednickogNizaXp,
            forma,
            pohvale: [],
            upravljac,
            vrstaIgraca,
            botTip,
            iskustvoPrijePartije: stariIgrac?.iskustvoUkupno ?? 0,
          });
        }
      } else if (!samoStatistika && mod === 'cetiri_igraca') {
        const [azurirani] = await tx
          .update(igraci)
          .set({
            odigrane: sql`${igraci.odigrane} + 1`,
            pobjede: sql`${igraci.pobjede} + ${r.plasman === 1 ? 1 : 0}`,
            eliminacijeUkupno: sql`${igraci.eliminacijeUkupno} + ${r.eliminacije}`,
            bodoviUkupno: sql`${igraci.bodoviUkupno} + ${r.bodovi}`,
            iskustvoUkupno: sql`least(${igraci.iskustvoUkupno} + ${r.iskustvo}, ${MAKSIMALNO_ISKUSTVO})`,
            dovrseneIgre: sql`${igraci.dovrseneIgre} + 1`,
          })
          .where(eq(igraci.id, r.igracId))
          .returning({
            bodoviUkupno: igraci.bodoviUkupno,
            odigrane: igraci.odigrane,
            pobjede: igraci.pobjede,
            iskustvoUkupno: igraci.iskustvoUkupno,
            dovrseneIgre: igraci.dovrseneIgre,
          });

        if (azurirani) {
          agregati.set(r.igracId, {
            ...azurirani,
            novaDostignuca: [],
            dnkPrije: prije,
            dnkPoslije: [],
            ocjenaIgre: 0,
            bonusOcjenaIgre: 0,
            nizPrije,
            nizPoslije,
            najboljiNiz,
            osnovniXp,
            bonusPobjednickogNizaPostotak,
            bonusPobjednickogNizaXp,
            forma,
            pohvale: [],
            upravljac,
            vrstaIgraca,
            botTip,
            iskustvoPrijePartije: stariIgrac?.iskustvoUkupno ?? 0,
          });
        }
      }

      const statistika = statistike.get(r.igracId);
      if (statistika) {
        if (statistika.grupe.length > 0) {
          const kolekcijaPrije = jeLjudskiZaSanducic(upravljac) ? await brojKolekcijskihStavki(tx, r.igracId) : 0;
          const grupeNovootkljucane = await tx.insert(otkljucaneGrupeIgraca)
            .values(statistika.grupe.map(({ grupa, tier }) => ({ igracId: r.igracId, grupa, tier, zaDostignuca: true })))
            .onConflictDoNothing()
            .returning({ grupa: otkljucaneGrupeIgraca.grupa });
          const grupePromovirane = await tx.update(otkljucaneGrupeIgraca)
            .set({ zaDostignuca: true })
            .where(and(
              eq(otkljucaneGrupeIgraca.igracId, r.igracId),
              eq(otkljucaneGrupeIgraca.zaDostignuca, false),
              inArray(otkljucaneGrupeIgraca.grupa, statistika.grupe.map(({ grupa }) => grupa)),
            ))
            .returning({ grupa: otkljucaneGrupeIgraca.grupa });
          const promijenjene = new Set([...grupeNovootkljucane, ...grupePromovirane].map(({ grupa }) => grupa));
          brojNovihRijetkihGrupa.set(r.igracId, statistika.grupe.filter(({ grupa, tier }) => promijenjene.has(grupa) && tier !== null).length);
          if (jeLjudskiZaSanducic(upravljac) && (grupeNovootkljucane.length > 0 || grupePromovirane.length > 0)) {
            const kolekcijaPoslije = await brojKolekcijskihStavki(tx, r.igracId);
            const broj = await stvoriPorukeKolekcije({
              igracId: r.igracId,
              brojPrije: kolekcijaPrije,
              brojPoslije: kolekcijaPoslije,
              tx,
              izvorTip: 'partija',
              izvorId: partijaId,
            });
            if (broj > 0) sanducicIgraci.add(r.igracId);
          }
        }
        if (statistika.otkljucaneRijeci.length > 0) {
          await tx.insert(otkljucaneRijeciIgraca)
            .values(statistika.otkljucaneRijeci.map((redak) => ({ igracId: r.igracId, ...redak })))
            .onConflictDoUpdate({
              target: [otkljucaneRijeciIgraca.igracId, otkljucaneRijeciIgraca.rijec],
              set: { jakoDuga: sql`otkljucane_rijeci_igraca.jako_duga or excluded.jako_duga`, jakoRijetka: sql`otkljucane_rijeci_igraca.jako_rijetka or excluded.jako_rijetka`, dugaTier: sql`coalesce(otkljucane_rijeci_igraca.duga_tier, excluded.duga_tier)`, rijetkaTier: sql`coalesce(otkljucane_rijeci_igraca.rijetka_tier, excluded.rijetka_tier)` },
            });
        }
        if (!samoStatistika) await tx
          .insert(statistikeRijeciIgraca)
          .values({
            igracId: r.igracId,
            mod: modStatistike,
            najduziStreak: statistika.najduziStreak,
            otkriveneJakoRijetkeGrupe: statistika.otkriveneJakoRijetkeGrupe,
            otkriveneSrednjeRijetkeGrupe: statistika.otkriveneSrednjeRijetkeGrupe,
            otkriveneRijetkeGrupe: statistika.otkriveneRijetkeGrupe,
            upisaneDugeRijeci: statistika.upisaneDugeRijeci,
            upisaneSrednjeDugeRijeci: statistika.upisaneSrednjeDugeRijeci,
            upisaneJakoDugeRijeci: statistika.upisaneJakoDugeRijeci,
            najduzaRijec: statistika.najduzaRijec,
            najduzaRijecGrafemi: statistika.najduzaRijecGrafemi,
            najrjedaRijec: statistika.najrjedaRijec,
            najrjedaRijecFrekvencija: statistika.najrjedaRijecFrekvencija,
            najrjedaTier: statistika.najrjedaTier,
          })
          .onConflictDoUpdate({
            target: [statistikeRijeciIgraca.igracId, statistikeRijeciIgraca.mod],
            set: {
              najduziStreak: sql`greatest(${statistikeRijeciIgraca.najduziStreak}, excluded.najduzi_streak)`,
              otkriveneJakoRijetkeGrupe: sql`${statistikeRijeciIgraca.otkriveneJakoRijetkeGrupe} + excluded.otkrivene_jako_rijetke_grupe`,
              otkriveneSrednjeRijetkeGrupe: sql`${statistikeRijeciIgraca.otkriveneSrednjeRijetkeGrupe} + excluded.otkrivene_srednje_rijetke_grupe`,
              otkriveneRijetkeGrupe: sql`${statistikeRijeciIgraca.otkriveneRijetkeGrupe} + excluded.otkrivene_rijetke_grupe`,
              upisaneDugeRijeci: sql`${statistikeRijeciIgraca.upisaneDugeRijeci} + excluded.upisane_duge_rijeci`,
              upisaneSrednjeDugeRijeci: sql`${statistikeRijeciIgraca.upisaneSrednjeDugeRijeci} + excluded.upisane_srednje_duge_rijeci`,
              upisaneJakoDugeRijeci: sql`${statistikeRijeciIgraca.upisaneJakoDugeRijeci} + excluded.upisane_jako_duge_rijeci`,
              najduzaRijec: sql`case when excluded.najduza_rijec_grafemi > ${statistikeRijeciIgraca.najduzaRijecGrafemi} then excluded.najduza_rijec else ${statistikeRijeciIgraca.najduzaRijec} end`,
              najduzaRijecGrafemi: sql`greatest(${statistikeRijeciIgraca.najduzaRijecGrafemi}, excluded.najduza_rijec_grafemi)`,
              najrjedaRijec: sql`case when excluded.najrjeda_tier is not null and (${statistikeRijeciIgraca.najrjedaTier} is null or excluded.najrjeda_tier <= ${statistikeRijeciIgraca.najrjedaTier}) then excluded.najrjeda_rijec else ${statistikeRijeciIgraca.najrjedaRijec} end`,
              najrjedaRijecFrekvencija: sql`case when excluded.najrjeda_tier is not null and (${statistikeRijeciIgraca.najrjedaTier} is null or excluded.najrjeda_tier <= ${statistikeRijeciIgraca.najrjedaTier}) then excluded.najrjeda_rijec_frekvencija else ${statistikeRijeciIgraca.najrjedaRijecFrekvencija} end`,
              najrjedaTier: sql`case when excluded.najrjeda_tier is not null and (${statistikeRijeciIgraca.najrjedaTier} is null or excluded.najrjeda_tier <= ${statistikeRijeciIgraca.najrjedaTier}) then excluded.najrjeda_tier else ${statistikeRijeciIgraca.najrjedaTier} end`,
            },
          });
      }

      if (statistika && !samoStatistika) {
        await tx.insert(dnkStatistikeIgraca).values({
          igracId: r.igracId,
          mod,
          prihvaceniPotezi: statistika.prihvaceniPotezi,
          ukupnoTrajanjePrihvaceniPoteziMs: statistika.ukupnoTrajanjePrihvaceniPoteziMs,
          najduziStreak: statistika.najduziStreak,
          dugeRijeci: statistika.upisaneDugeRijeci,
          srednjeDugeRijeci: statistika.upisaneSrednjeDugeRijeci,
          jakoDugeRijeci: statistika.upisaneJakoDugeRijeci,
          rijetkeRijeci: statistika.otkriveneRijetkeGrupe,
          srednjeRijetkeRijeci: statistika.otkriveneSrednjeRijetkeGrupe,
          jakoRijetkeRijeci: statistika.otkriveneJakoRijetkeGrupe,
          otkljucanAt: null,
        }).onConflictDoUpdate({
          target: [dnkStatistikeIgraca.igracId, dnkStatistikeIgraca.mod],
          set: {
            prihvaceniPotezi: sql`${dnkStatistikeIgraca.prihvaceniPotezi} + excluded.prihvaceni_potezi`,
            ukupnoTrajanjePrihvaceniPoteziMs: sql`${dnkStatistikeIgraca.ukupnoTrajanjePrihvaceniPoteziMs} + excluded.ukupno_trajanje_prihvacenih_poteza_ms`,
            najduziStreak: sql`greatest(${dnkStatistikeIgraca.najduziStreak}, excluded.najduzi_streak)`,
            dugeRijeci: sql`${dnkStatistikeIgraca.dugeRijeci} + excluded.duge_rijeci`,
            srednjeDugeRijeci: sql`${dnkStatistikeIgraca.srednjeDugeRijeci} + excluded.srednje_duge_rijeci`,
            jakoDugeRijeci: sql`${dnkStatistikeIgraca.jakoDugeRijeci} + excluded.jako_duge_rijeci`,
            rijetkeRijeci: sql`${dnkStatistikeIgraca.rijetkeRijeci} + excluded.rijetke_rijeci`,
            srednjeRijetkeRijeci: sql`${dnkStatistikeIgraca.srednjeRijetkeRijeci} + excluded.srednje_rijetke_rijeci`,
            jakoRijetkeRijeci: sql`${dnkStatistikeIgraca.jakoRijetkeRijeci} + excluded.jako_rijetke_rijeci`,
          },
        });
      }

      const zapisNapretka = napredakDostignuca.get(r.igracId);
      if (zapisNapretka && primaGamifikaciju) {
        const delta: DeltaNapretkaDostignuca = { ...zapisNapretka.delta };
        delta.rijetkeLeksemskeGrupe = brojNovihRijetkihGrupa.get(r.igracId) ?? 0;
        if (!samoStatistika && r.plasman === 1) delta.javnePobjede = (delta.javnePobjede ?? 0) + 1;

        const [stariNapredak] = await tx.select().from(napredakDostignucaIgraca)
          .where(eq(napredakDostignucaIgraca.igracId, r.igracId));
        const azuriraniNapredak = await tx.insert(napredakDostignucaIgraca).values({
          igracId: r.igracId,
          valjaniPoteziUkupno: delta.valjaniPoteziUkupno ?? 0,
          rijetkeLeksemskeGrupe: delta.rijetkeLeksemskeGrupe ?? 0,
          dugeRijeci: delta.dugeRijeci ?? 0,
          najduziStreak: delta.najduziStreak ?? 0,
          kaladontIzvedbe: delta.kaladontIzvedbe ?? 0,
          kaladontZrtve: delta.kaladontZrtve ?? 0,
          izazvaneEliminacije: delta.izazvaneEliminacije ?? 0,
          mrtvaSlovaEliminacije: delta.mrtvaSlovaEliminacije ?? 0,
          javnePobjede: delta.javnePobjede ?? 0,
        }).onConflictDoUpdate({
          target: napredakDostignucaIgraca.igracId,
          set: {
            valjaniPoteziUkupno: sql`${napredakDostignucaIgraca.valjaniPoteziUkupno} + ${delta.valjaniPoteziUkupno ?? 0}`,
            rijetkeLeksemskeGrupe: sql`${napredakDostignucaIgraca.rijetkeLeksemskeGrupe} + ${delta.rijetkeLeksemskeGrupe ?? 0}`,
            dugeRijeci: sql`${napredakDostignucaIgraca.dugeRijeci} + ${delta.dugeRijeci ?? 0}`,
            najduziStreak: sql`greatest(${napredakDostignucaIgraca.najduziStreak}, ${delta.najduziStreak ?? 0})`,
            kaladontIzvedbe: sql`${napredakDostignucaIgraca.kaladontIzvedbe} + ${delta.kaladontIzvedbe ?? 0}`,
            kaladontZrtve: sql`${napredakDostignucaIgraca.kaladontZrtve} + ${delta.kaladontZrtve ?? 0}`,
            izazvaneEliminacije: sql`${napredakDostignucaIgraca.izazvaneEliminacije} + ${delta.izazvaneEliminacije ?? 0}`,
            mrtvaSlovaEliminacije: sql`${napredakDostignucaIgraca.mrtvaSlovaEliminacije} + ${delta.mrtvaSlovaEliminacije ?? 0}`,
            javnePobjede: sql`${napredakDostignucaIgraca.javnePobjede} + ${delta.javnePobjede ?? 0}`,
            azurirano: new Date(),
          },
        }).returning();
        const napredak = azuriraniNapredak[0] ?? stariNapredak;
        const napredakPrijeIgre = stariNapredak ?? {
          rijetkeLeksemskeGrupe: 0,
          dugeRijeci: 0,
          najduziStreak: 0,
          kaladontIzvedbe: 0,
          kaladontZrtve: 0,
          izazvaneEliminacije: 0,
          mrtvaSlovaEliminacije: 0,
          javnePobjede: 0,
        };
        if (napredak) {
          const agregat = agregati.get(r.igracId);
          const razina = stanjeIskustva(agregat?.iskustvoUkupno ?? 0).razina;
          const razinaPrije = stanjeIskustva(stariIgrac?.iskustvoUkupno ?? 0).razina;
          const trajniPrije = {
            razina: razinaPrije,
            rijetkeLeksemskeGrupe: napredakPrijeIgre.rijetkeLeksemskeGrupe,
            dugeRijeci: napredakPrijeIgre.dugeRijeci,
            najduziStreak: napredakPrijeIgre.najduziStreak,
            kaladontIzvedbe: napredakPrijeIgre.kaladontIzvedbe,
            kaladontZrtve: napredakPrijeIgre.kaladontZrtve,
            izazvaneEliminacije: napredakPrijeIgre.izazvaneEliminacije,
            mrtvaSlovaEliminacije: napredakPrijeIgre.mrtvaSlovaEliminacije,
            javnePobjede: napredakPrijeIgre.javnePobjede,
          };
          const nova = izracunajNovaDostignuca(trajniPrije, delta, razina, samoStatistika);
          if (nova.length > 0) {
            const stareRazina = await tx.select({
              dostignuceId: dostignucaIgraca.dostignuceId,
              razina: dostignucaIgraca.razina,
            }).from(dostignucaIgraca).where(and(
              eq(dostignucaIgraca.igracId, r.igracId),
              inArray(dostignucaIgraca.dostignuceId, nova.map((d) => d.id)),
            ));
            const staraPoId = new Map(stareRazina.map((red) => [red.dostignuceId, red.razina]));
            await tx.insert(dostignucaIgraca).values(nova.map((dostignuce) => ({
              igracId: r.igracId,
              dostignuceId: dostignuce.id,
              razina: dostignuce.novaRazina,
              prvoOtkljucano: new Date(),
              zadnjeOtkljucavanje: new Date(),
            }))).onConflictDoUpdate({
              target: [dostignucaIgraca.igracId, dostignucaIgraca.dostignuceId],
              set: { razina: sql`greatest(${dostignucaIgraca.razina}, excluded.razina)`, zadnjeOtkljucavanje: new Date() },
            });
            for (const dostignuce of nova) {
              if (!jeLjudskiZaSanducic(upravljac)) continue;
              const broj = await stvoriPorukeZvjezdica({
                igracId: r.igracId,
                dostignuceId: dostignuce.id,
                staraRazina: staraPoId.get(dostignuce.id) ?? 0,
                novaRazina: dostignuce.novaRazina,
                tx,
                izvorTip: 'partija',
                izvorId: partijaId,
              });
              if (broj > 0) sanducicIgraci.add(r.igracId);
            }
            if (agregat) agregat.novaDostignuca = nova;
          }
        }
      }

      const agregatZaDnk = agregati.get(r.igracId);
      if (agregatZaDnk) {
        const statistika = statistike.get(r.igracId);
        // Zbroj svih moda (zajednickiPrije) + delta ove partije.
        const bazaPrije = zajednickiPrije ?? {
          n2: 0,
          n3: 0,
          n4: 0,
          eliminacijeUkupno: 0,
          ...prazniDnkBrojaci(),
          univerzalniUcinak: ucinakPrije,
        };
        const ukupniDnk: DnkPodaciZajednicki = {
          n2: bazaPrije.n2 + (mod === 'dva_igraca' ? 1 : 0),
          n3: bazaPrije.n3 + (mod === 'tri_igraca' ? 1 : 0),
          n4: bazaPrije.n4 + (mod === 'cetiri_igraca' ? 1 : 0),
          eliminacijeUkupno: bazaPrije.eliminacijeUkupno + r.eliminacije,
          prihvaceniPotezi: bazaPrije.prihvaceniPotezi + (statistika?.prihvaceniPotezi ?? 0),
          ukupnoTrajanjePrihvaceniPoteziMs:
            bazaPrije.ukupnoTrajanjePrihvaceniPoteziMs + (statistika?.ukupnoTrajanjePrihvaceniPoteziMs ?? 0),
          najduziStreak: Math.max(bazaPrije.najduziStreak, statistika?.najduziStreak ?? 0),
          dugeRijeci: bazaPrije.dugeRijeci + (statistika?.upisaneDugeRijeci ?? 0),
          srednjeDugeRijeci: bazaPrije.srednjeDugeRijeci + (statistika?.upisaneSrednjeDugeRijeci ?? 0),
          jakoDugeRijeci: bazaPrije.jakoDugeRijeci + (statistika?.upisaneJakoDugeRijeci ?? 0),
          rijetkeRijeci: bazaPrije.rijetkeRijeci + (statistika?.otkriveneRijetkeGrupe ?? 0),
          srednjeRijetkeRijeci: bazaPrije.srednjeRijetkeRijeci + (statistika?.otkriveneSrednjeRijetkeGrupe ?? 0),
          jakoRijetkeRijeci: bazaPrije.jakoRijetkeRijeci + (statistika?.otkriveneJakoRijetkeGrupe ?? 0),
          // Vještina se finalizira nakon PR09 upisa ranga (dnkPoslijePodaci).
          univerzalniUcinak: ucinakPrije,
        };
        agregatZaDnk.javnePartijeUkupno = ukupniDnk.n2 + ukupniDnk.n3 + ukupniDnk.n4;
        agregatZaDnk.dnkPoslijePodaci = ukupniDnk;
        agregatZaDnk.dnkPoslije = izracunajDnk(ukupniDnk);
        agregatZaDnk.ocjenaIgre = izracunajOcjenuIgre({
          pobjeda: r.plasman === 1,
          prihvaceniPotezi: statistika?.prihvaceniPotezi ?? 0,
          bodovi: r.bodovi,
          eliminacije: r.eliminacije,
          iskustvo: r.iskustvo,
        });
        agregatZaDnk.bonusOcjenaIgre = postotakXpZaOcjenu(agregatZaDnk.ocjenaIgre);
        const bonusIskustva = Math.round(r.iskustvo * agregatZaDnk.bonusOcjenaIgre / 100);
        if (bonusIskustva > 0 && !samoStatistika && primaGamifikaciju) {
          const [azuriranoIskustvo] = await tx.update(igraci)
            .set({ iskustvoUkupno: sql`least(${igraci.iskustvoUkupno} + ${bonusIskustva}, ${MAKSIMALNO_ISKUSTVO})` })
            .where(eq(igraci.id, r.igracId))
            .returning({ iskustvoUkupno: igraci.iskustvoUkupno });
          if (azuriranoIskustvo) agregatZaDnk.iskustvoUkupno = azuriranoIskustvo.iskustvoUkupno;
        }
        if (agregatZaDnk.ocjenaIgre !== null) {
          await tx.update(dnkStatistikeIgraca)
            .set({
              zbrojOcjenaIgre: sql`${dnkStatistikeIgraca.zbrojOcjenaIgre} + ${agregatZaDnk.ocjenaIgre}`,
              brojOcjenaIgre: sql`${dnkStatistikeIgraca.brojOcjenaIgre} + 1`,
            })
            .where(and(eq(dnkStatistikeIgraca.igracId, r.igracId), eq(dnkStatistikeIgraca.mod, mod)));
        }
      }

      if (
        samoStatistika
        && primaGamifikaciju
        && (statistike.get(r.igracId)?.prihvaceniPotezi ?? 0) >= 1
        && !jeNamjerniIzlazak(r.nacinIspadanja)
      ) {
        const privatnik = await priznajPrivatnika(tx, { igracId: r.igracId, partijaId, zavrsenoU });
        zapamtiObavijesti(r.igracId, privatnik.noveObavijesti);
        pridruziDostignuca(r.igracId, privatnik.novaDostignuca, upravljac, vrstaIgraca, stariIgrac?.iskustvoUkupno ?? 0);
      }

      if (samoStatistika && jeLjudskiZaSanducic(upravljac)) {
        const gostPoruka = await obradiDovrsenuIgruSanducic({
          igracId: r.igracId,
          jeBot: false,
          izvorTip: 'privatna',
          izvorId: partijaId,
          mod,
          tx,
          emitiraj: false,
        });
        if (gostPoruka) sanducicIgraci.add(r.igracId);
      }

      if (!samoStatistika && r.plasman === 1 && primaGamifikaciju) {
        // Dvostruka kruna prati samo Dvoboj+Četveroboj; Troboj ne ulazi do šireg dostignuća.
        if (mod === 'dva_igraca' || mod === 'cetiri_igraca') {
          const kruna = await priznajDnevnuPobjeduModa(tx, { igracId: r.igracId, mod, zavrsenoU });
          primijeniDodjelu(r.igracId, kruna, upravljac, vrstaIgraca, stariIgrac?.iskustvoUkupno ?? 0);
        }
        const statistikaPobjede = statistike.get(r.igracId);
        // Čista petica: pobjeda, ≥5 prihvaćenih riječi i točno 0 pravih pogrešnih unosa.
        // pogresniUnosi broji samo odbijene riječi koje lome niz (nevažeća riječ, krivi nastavak,
        // već iskorištena, vlastito ime, nedopuštena vrsta, nije osnovni oblik, prekratka).
        // Ne broje se zastarjeli token, tuđi red, mrežni retry, limit ni tehničke greške.
        // Izostanak polja je nepoznato i ne smije se tretirati kao 0.
        if (statistikaPobjede && statistikaPobjede.prihvaceniPotezi >= 5 && statistikaPobjede.pogresniUnosi === 0) {
          const petica = await priznajCistuPetica(tx, { igracId: r.igracId, partijaId, zavrsenoU });
          primijeniDodjelu(r.igracId, petica, upravljac, vrstaIgraca, stariIgrac?.iskustvoUkupno ?? 0);
        }
      }

      if (primaGamifikaciju) {
        const oblici = statistike.get(r.igracId)?.dugeRijetkeRijeci ?? [];
        for (const oblik of oblici) {
          const grdosija = await priznajRijetkuGrdosiju(tx, {
            igracId: r.igracId,
            normaliziraniOblik: oblik,
            zavrsenoU,
          });
          primijeniDodjelu(r.igracId, grdosija, upravljac, vrstaIgraca, stariIgrac?.iskustvoUkupno ?? 0);
        }
      }
    }

    if (!samoStatistika) {
      const sudioniciZaPohvalu = rezultati.map((r) => {
        const agregat = agregati.get(r.igracId);
        const osnovniBruto = osnovniBrutoPoIgracu.get(r.igracId) ?? agregat?.osnovniXp ?? 0;
        const bonusNiza = agregat?.bonusPobjednickogNizaXp ?? 0;
        const bonusOcjenaPostotak = agregat?.bonusOcjenaIgre ?? 0;
        const xpZaOcjenu = (agregat?.osnovniXp ?? 0) + bonusNiza;
        const bonusOcjenaXp = Math.round(xpZaOcjenu * bonusOcjenaPostotak / 100);
        return {
          igracId: r.igracId,
          upravljac: agregat?.upravljac ?? 'covjek',
          najduziStreak: statistike.get(r.igracId)?.najduziStreak ?? 0,
          finalniBrutoXp: osnovniBruto + bonusNiza + bonusOcjenaXp,
        };
      });
      const pohvalePoIgracu = odrediPohvaleIgre(sudioniciZaPohvalu);

      for (const [igracId, pohvale] of pohvalePoIgracu) {
        const agregat = agregati.get(igracId);
        if (!agregat) continue;
        agregat.pohvale = pohvale;

        for (const pohvala of pohvale) {
          const umetnuto = await tx.insert(pohvaleIgre).values({
            igraId: partijaId,
            igracId,
            vrsta: pohvala.vrsta,
            vrijednost: pohvala.vrijednost,
          }).onConflictDoNothing().returning({
            igracId: pohvaleIgre.igracId,
            vrsta: pohvaleIgre.vrsta,
          });
          if (umetnuto.length === 0) continue;
          if (!primaProfilnuGamifikaciju(agregat.vrstaIgraca, agregat.upravljac, agregat.botTip)) continue;

          const deltaPohvale: DeltaNapretkaDostignuca = pohvala.vrsta === 'najduzi_niz'
            ? { pohvaleNizUkupno: 1 }
            : { pohvaleXpUkupno: 1 };
          const [stariNapredakPohvale] = await tx.select().from(napredakDostignucaIgraca)
            .where(eq(napredakDostignucaIgraca.igracId, igracId));
          await tx.insert(napredakDostignucaIgraca).values({
            igracId,
            pohvaleNizUkupno: deltaPohvale.pohvaleNizUkupno ?? 0,
            pohvaleXpUkupno: deltaPohvale.pohvaleXpUkupno ?? 0,
          }).onConflictDoUpdate({
            target: napredakDostignucaIgraca.igracId,
            set: {
              pohvaleNizUkupno: sql`${napredakDostignucaIgraca.pohvaleNizUkupno} + ${deltaPohvale.pohvaleNizUkupno ?? 0}`,
              pohvaleXpUkupno: sql`${napredakDostignucaIgraca.pohvaleXpUkupno} + ${deltaPohvale.pohvaleXpUkupno ?? 0}`,
              azurirano: new Date(),
            },
          });
          // Bez razine iskusnjara vidi 0 i lažno otključava za LVL ≥ 10.
          const razinaNakonIgre = stanjeIskustva(agregat.iskustvoUkupno).razina;
          const trajniPrijePohvale = {
            razina: razinaNakonIgre,
            pohvaleNizUkupno: stariNapredakPohvale?.pohvaleNizUkupno ?? 0,
            pohvaleXpUkupno: stariNapredakPohvale?.pohvaleXpUkupno ?? 0,
          };
          const novaPohvala = izracunajNovaDostignuca(
            trajniPrijePohvale,
            deltaPohvale,
            razinaNakonIgre,
            false,
          );
          if (novaPohvala.length > 0) {
            const stareRazina = await tx.select({
              dostignuceId: dostignucaIgraca.dostignuceId,
              razina: dostignucaIgraca.razina,
            }).from(dostignucaIgraca).where(and(
              eq(dostignucaIgraca.igracId, igracId),
              inArray(dostignucaIgraca.dostignuceId, novaPohvala.map((d) => d.id)),
            ));
            const staraPoId = new Map(stareRazina.map((red) => [red.dostignuceId, red.razina]));
            await tx.insert(dostignucaIgraca).values(novaPohvala.map((dostignuce) => ({
              igracId,
              dostignuceId: dostignuce.id,
              razina: dostignuce.novaRazina,
              prvoOtkljucano: new Date(),
              zadnjeOtkljucavanje: new Date(),
            }))).onConflictDoUpdate({
              target: [dostignucaIgraca.igracId, dostignucaIgraca.dostignuceId],
              set: { razina: sql`greatest(${dostignucaIgraca.razina}, excluded.razina)`, zadnjeOtkljucavanje: new Date() },
            });
            for (const dostignuce of novaPohvala) {
              if (!jeLjudskiZaSanducic(agregat.upravljac)) continue;
              const broj = await stvoriPorukeZvjezdica({
                igracId,
                dostignuceId: dostignuce.id,
                staraRazina: staraPoId.get(dostignuce.id) ?? 0,
                novaRazina: dostignuce.novaRazina,
                tx,
                izvorTip: 'partija',
                izvorId: partijaId,
              });
              if (broj > 0) sanducicIgraci.add(igracId);
            }
            agregat.novaDostignuca = [...agregat.novaDostignuca, ...novaPohvala];
          }
        }
      }

      for (const [igracId, pohvale] of pohvalePoIgracu) {
        const imaObje = pohvale.some((pohvala) => pohvala.vrsta === 'najduzi_niz')
          && pohvale.some((pohvala) => pohvala.vrsta === 'najvise_xp');
        if (!imaObje) continue;
        const agregat = agregati.get(igracId);
        if (!agregat || !primaProfilnuGamifikaciju(agregat.vrstaIgraca, agregat.upravljac, agregat.botTip)) continue;
        const sve = await priznajSvePohvale(tx, { igracId, partijaId, zavrsenoU });
        primijeniDodjelu(igracId, sve, agregat.upravljac, agregat.vrstaIgraca, agregat.iskustvoPrijePartije);
      }

      // Misije: nakon partijskog XP-a i pohvala, prije commita.
      // HINT PR12: ranije se Troboj (tri_igraca) namjerno preskakao dok katalog nije imao
      // format/pravilnik filtre. Sada sva tri javna formata ulaze; trening/privatno i dalje
      // ne (samoStatistika / drugi putovi). Generički mod=oba broji Troboj; D12/W20 ne.
      if (mod === 'dva_igraca' || mod === 'tri_igraca' || mod === 'cetiri_igraca') {
      const pravilaStola = kontekstMisija?.pravila ?? ZADANI_PRAVILNIK;
      const spojeniDvoboj = kontekstMisija?.spojeniDvoboj ?? false;
      const igraciZaMisije = [...agregati.entries()]
        .filter(([, a]) => a.upravljac === 'covjek' && (a.vrstaIgraca === 'registriran' || a.vrstaIgraca === 'admin'))
        .sort(([a], [b]) => a.localeCompare(b));

      for (const [igracId, agregat] of igraciZaMisije) {
        const rezultat = rezultati.find((r) => r.igracId === igracId);
        const statistika = statistike.get(igracId);
        if (!rezultat) continue;
        const duge = (statistika?.upisaneDugeRijeci ?? 0)
          + (statistika?.upisaneSrednjeDugeRijeci ?? 0)
          + (statistika?.upisaneJakoDugeRijeci ?? 0);
        const delta = napredakDostignuca.get(igracId)?.delta;
        const odabrana = kontekstMisija?.odabranaPravilaPoIgracu.get(igracId) ?? pravilaStola;
        const metrike: MetrikeMisijaIgre = {
          izvorId: partijaId,
          kontekst: 'javna',
          mod,
          igracId,
          zavrsenoU,
          plasman: rezultat.plasman,
          nacinIspadanja: rezultat.nacinIspadanja,
          prihvaceneRijeci: statistika?.prihvaceniPotezi ?? 0,
          najduziNiz: statistika?.najduziStreak ?? 0,
          dugeRijeci: duge,
          jakoDugeRijeci: statistika?.upisaneJakoDugeRijeci ?? 0,
          rijetkeRijeci: statistika?.prihvaceneRijetkeRijeci ?? 0,
          jakoRijetkeRijeci: statistika?.prihvaceneJakoRijetkeRijeci ?? 0,
          dugeIRijetkeRijeci: statistika?.dugeIRijetkeRijeci ?? 0,
          eliminacije: delta?.izazvaneEliminacije ?? 0,
          kaladontIzvedbe: delta?.kaladontIzvedbe ?? 0,
          razlicitiPoceci: statistika?.razlicitiPoceci ?? [],
          pravila: pravilaStola,
          odabranaPravila: odabrana,
          spojeniDvoboj,
          uspjesniDokazi: statistika?.uspjesniDokazi ?? 0,
          kaladontSljedeciUzTriPlus: statistika?.kaladontSljedeciUzTriPlus ?? 0,
        };
        const [xpRed] = await tx.select({ iskustvoUkupno: igraci.iskustvoUkupno })
          .from(igraci).where(eq(igraci.id, igracId)).for('update');
        const nakonPartijeXp = xpRed?.iskustvoUkupno ?? agregat.iskustvoUkupno;
        const ishod = await obracunajMisijeZaIgraca(
          tx,
          metrike,
          nakonPartijeXp,
          agregat.iskustvoPrijePartije,
        );
        agregat.promjeneMisija = ishod.promjeneMisija;
        agregat.ukupnoIskustvo = ishod.ukupnoIskustvo;
        agregat.misijeStanjeVerzija = ishod.misijeStanjeVerzija;
        agregat.iskustvoUkupno = ishod.ukupnoIskustvo.poslije.ukupno;
        if (ishod.novaDostignuca.length > 0) {
          const poId = new Map(agregat.novaDostignuca.map((d) => [d.id, d]));
          for (const d of ishod.novaDostignuca) {
            const staro = poId.get(d.id);
            if (!staro || d.novaRazina > staro.novaRazina) poId.set(d.id, d);
          }
          agregat.novaDostignuca = [...poId.values()];
        }
        zapamtiObavijesti(igracId, ishod.noveObavijesti ?? []);
      }
      }

      // PR09: univerzalni rang nakon što su svi sirovi bodovi upisani (isti konačni rezultat za sva sjedala).
      // HINT: legacy odigrane/bodovi* već inkrementirani gore; ovdje samo rang_*. Gosti/botovi u N/S, bez agregata.
      const rangSudionici: RangSudionikUlaz[] = [];
      for (const r of rezultati) {
        const a = agregati.get(r.igracId);
        if (!a) continue;
        rangSudionici.push({
          igracId: r.igracId,
          bodovi: r.bodovi,
          upravljac: a.upravljac,
          vrstaIgraca: a.vrstaIgraca,
        });
      }
      const rangPoIgracu: Map<string, RangUpisRezultat> = rangSudionici.length > 0
        ? await upisiUniverzalniRangZaStol(tx, partijaId, rangSudionici, mod)
        : new Map();
      for (const [igracId, rangRez] of rangPoIgracu) {
        const agregat = agregati.get(igracId);
        if (!agregat) continue;
        agregat.rangBrojPartija = rangRez.rangBrojPoslije;
        agregat.rangSumaJedinica = rangRez.rangSumaPoslije;
        agregat.rangNaziv = rangRez.rangPoslije;
        // PR10: Vještina na završnom ekranu koristi učinak nakon ove partije.
        if (agregat.dnkPoslijePodaci) {
          agregat.dnkPoslijePodaci = {
            ...agregat.dnkPoslijePodaci,
            univerzalniUcinak: izracunajUniverzalniUcinak(rangRez.rangSumaPoslije, rangRez.rangBrojPoslije),
          };
          agregat.dnkPoslije = izracunajDnk(agregat.dnkPoslijePodaci);
        }
      }

      // Sandučic: XP, rang, forma_10 i gost sažetak nakon konačnog XP-a (uključujući misije). Botovi nemaju inbox.
      for (const [igracId, agregat] of agregati) {
        if (!jeLjudskiZaSanducic(agregat.upravljac)) continue;
        const razinaPrije = stanjeIskustva(agregat.iskustvoPrijePartije).razina;
        const razinaPoslije = stanjeIskustva(agregat.iskustvoUkupno).razina;
        const xpBroj = await stvoriPorukeXpRazina({
          igracId,
          razinaPrije,
          razinaPoslije,
          tx,
          izvorTip: 'partija',
          izvorId: partijaId,
        });
        if (xpBroj > 0) sanducicIgraci.add(igracId);

        const rezultat = rezultati.find((r) => r.igracId === igracId);
        if (!rezultat) continue;
        // PR09: obavijest o rangu samo iz univerzalnog agregata (ne po formatu).
        const rangRez = rangPoIgracu.get(igracId);
        if (rangRez && rangRez.novoUpisan) {
          const rangPoruka = await stvoriPorukuPromjeneRanga({
            igracId,
            mod,
            rangPrije: rangRez.rangPrije,
            rangPoslije: rangRez.rangPoslije,
            napredak: jeNapredakUniverzalnogRanga(rangRez.rangPrije, rangRez.rangPoslije),
            tx,
            izvorId: partijaId,
          });
          if (rangPoruka) sanducicIgraci.add(igracId);
        }

        const formaPoruka = await stvoriPorukuForme10({
          igracId,
          mod,
          odigraneNakon: agregat.odigrane,
          nazivForme: agregat.forma?.naziv ?? null,
          pobjede: agregat.forma?.brojPobjeda ?? 0,
          trenutniNiz: agregat.nizPoslije,
          tx,
          izvorId: partijaId,
        });
        if (formaPoruka) sanducicIgraci.add(igracId);

        const gostPoruka = await stvoriPorukuGostSazetak({
          igracId,
          jeGost: agregat.vrstaIgraca === 'gost',
          dovrseneNakon: agregat.dovrseneIgre,
          tx,
          izvorTip: 'partija',
          izvorId: partijaId,
          mod,
        });
        if (gostPoruka) sanducicIgraci.add(igracId);
      }
    }

    if (!samoStatistika) {
      javniZavrsetak = true;
      await zabiljeziTop10NakonPromjene(tx, {
        modovi: [mod],
        opazenoU: zavrsenoU,
        izvor: 'partija',
        partijaId,
      });
    }
  });

  if (!samoStatistika) {
    try {
      const top10 = await obradiNeobradeneTop10Dokaze({ partijaId });
      for (const [igracId, obavijesti] of top10) {
        zapamtiObavijesti(igracId, obavijesti);
        const agregat = agregati.get(igracId);
        if (!agregat) continue;
        pridruziDostignuca(
          igracId,
          obavijesti.map((obavijest) => ({
            id: obavijest.dostignuceId,
            novaRazina: obavijest.novaRazina,
            maksimalnaRazina: obavijest.maksimalnaRazina,
          })),
          agregat.upravljac,
          agregat.vrstaIgraca,
          agregat.iskustvoPrijePartije,
        );
        if (obavijesti.length > 0 && agregat.upravljac === 'covjek') sanducicIgraci.add(igracId);
      }
      if (javniZavrsetak) ocistiMemorijuLjestvica();
    } catch (greska) {
      console.error('Obrada Top 10 nakon partije nije uspjela:', partijaId, greska);
    }
  }

  for (const [igracId, obavijesti] of obavijestiPoIgracu) {
    emitirajNovostiDostignuca(igracId, obavijesti);
  }
  for (const [igracId, agregat] of agregati) {
    if (agregat.novaDostignuca.length > 0 && jeLjudskiZaSanducic(agregat.upravljac)) sanducicIgraci.add(igracId);
  }
  emitirajPromjeneSanducica([...sanducicIgraci]);

  return agregati;
}
