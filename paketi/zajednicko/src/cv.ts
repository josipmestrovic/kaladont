import { DEFINICIJE_DOSTIGNUCA } from './dostignuca.js';
import { jeDnkOtkljucan, type DnkKljuc } from './dnk.js';
import { datumZagrebacki, izracunajKalendarskiStaz, type KalendarskiStaz } from './cv-datumi.js';
import { grafemi } from './grafemi.js';
import { PRAGOVI_DULJINE } from './nagrada-za-rijec.js';
import { stanjeIskustva } from './iskustvo.js';
import { BROJ_PARTIJA_ZA_KALIBRACIJU, izracunajRang, vratiVeciRang } from './rangovi.js';

export type CvMod = 'dva_igraca' | 'cetiri_igraca';
export type CvOsnovaStaza = 'registracija' | 'nepoznato';
type CvOs = Exclude<DnkKljuc, 'vjestina'>;
export type CvRecenice = readonly [string, string];

export interface CvBiografija {
  tip: 'opis';
  recenice: CvRecenice;
}

export interface KaladontCvDto {
  verzijaPredlozaka: 1;
  datum: {
    osnova: CvOsnovaStaza;
    oznaka: string;
    pomoc: string | null;
  };
  staz: KalendarskiStaz | null;
  kvalifikacija: {
    rang: string;
    kalibriran: boolean;
    nacini: readonly CvMod[];
    razina: number;
  };
  biografija: CvBiografija;
  istaknuto: readonly string[];
}

export interface CvStatistikaRijeci {
  najduzaRijec: string | null;
  najduzaRijecGrafemi: number;
  najrjedaRijec: string | null;
}

export interface CvDnkStatistika {
  prihvaceniPotezi: number;
  ukupnoTrajanjePrihvaceniPoteziMs: number;
  najduziStreak: number;
  dugeRijeci: number;
  srednjeDugeRijeci: number;
  jakoDugeRijeci: number;
  rijetkeRijeci: number;
  srednjeRijetkeRijeci: number;
  jakoRijetkeRijeci: number;
  osi: readonly { kljuc: DnkKljuc; vrijednost: number }[];
}

export interface CvPodaciModa {
  odigrane: number;
  pobjede: number;
  bodoviUkupno: number;
  eliminacijeUkupno: number;
  dnk: CvDnkStatistika | null;
  statistikaRijeci: CvStatistikaRijeci | null;
}

export interface CvPodaciIgraca {
  igracId: string;
  nadimak: string;
  iskustvoUkupno: number;
  kolekcijaRijeci: number;
  stvoren: Date | string;
  registriranAt: Date | string | null;
  referentniDatum: string;
  dvaIgraca: CvPodaciModa;
  cetiriIgraca: CvPodaciModa;
  dostignuca: readonly { id: string; razina: number }[];
}

export class NevaljaniCvPodaci extends Error {
  constructor() {
    super('Profilni podaci nisu valjani za izradu opisa.');
    this.name = 'NevaljaniCvPodaci';
  }
}

const MIN_PRIHVACENIH_POTEZA_ZA_STIL = 10;
const MIN_ISTAKNUTA_OS = 60;
const MAKS_RAZLIKA_DRUGE_OSI = 20;
const MIN_RAZINA_DOSTIGNUCA = 2;
const MIN_NIZ_RIJECI = 5;
const MAKS_DULJINA_REKORDNE_RIJECI = 64;
const REDOSLIJED_OSI: readonly DnkKljuc[] = ['rijetke_rijeci', 'duge_rijeci', 'taktika', 'fokus', 'brzina'];
const REDOSLIJED_DOSTIGNUCA = [
  'kaladont',
  'rijetkolovac',
  'dugometras',
  'jezik_u_plamenu',
  'slijepa_ulica',
  'lovac_na_glave',
  'zavrsna_rijec',
  'iskusnjara',
] as const;

type Dokaz =
  | { vrsta: 'dostignuce'; tekst: string }
  | { vrsta: 'najduza_rijec'; tekst: string }
  | { vrsta: 'rijetka_rijec'; tekst: string }
  | { vrsta: 'streak'; tekst: string }
  | { vrsta: 'brzina'; tekst: string }
  | { vrsta: 'duge_rijeci'; tekst: string }
  | { vrsta: 'kolekcija'; tekst: string }
  | { vrsta: 'pobjede'; tekst: string };

interface RezultatStila {
  osobine: CvOs[];
}

interface Kvalifikacija {
  rang: string;
  kalibriran: boolean;
  nacini: CvMod[];
  razina: number;
}

function jeNenegativanCijeliBroj(vrijednost: number): boolean {
  return Number.isSafeInteger(vrijednost) && vrijednost >= 0;
}

function validirajMod(podaci: CvPodaciModa, mod: CvMod): void {
  if (
    !jeNenegativanCijeliBroj(podaci.odigrane) ||
    !jeNenegativanCijeliBroj(podaci.pobjede) ||
    !jeNenegativanCijeliBroj(podaci.bodoviUkupno) ||
    !jeNenegativanCijeliBroj(podaci.eliminacijeUkupno) ||
    podaci.pobjede > podaci.odigrane ||
    podaci.bodoviUkupno > podaci.odigrane * (mod === 'dva_igraca' ? 1 : 7) ||
    podaci.eliminacijeUkupno > podaci.odigrane * (mod === 'dva_igraca' ? 1 : 3)
  ) throw new NevaljaniCvPodaci();
}

function datumIso(vrijednost: Date | string | null): string | null {
  if (vrijednost === null) return null;
  const datum = vrijednost instanceof Date ? vrijednost : new Date(vrijednost);
  return datumZagrebacki(datum);
}

function prikazaniStaz(podaci: CvPodaciIgraca): Pick<KaladontCvDto, 'datum' | 'staz'> {
  const registriranAt = podaci.registriranAt;
  const vrijemeRegistracije = registriranAt instanceof Date ? registriranAt : registriranAt ? new Date(registriranAt) : null;
  const vrijemeStvaranja = podaci.stvoren instanceof Date ? podaci.stvoren : new Date(podaci.stvoren);
  const datumRegistracije = datumIso(registriranAt);
  const referentniDatum = datumIso(podaci.referentniDatum);

  if (
    !vrijemeRegistracije ||
    Number.isNaN(vrijemeRegistracije.getTime()) ||
    Number.isNaN(vrijemeStvaranja.getTime()) ||
    vrijemeRegistracije.getTime() < vrijemeStvaranja.getTime() ||
    !datumRegistracije ||
    !referentniDatum
  ) {
    return {
      datum: { osnova: 'nepoznato', oznaka: 'Kaladont staž', pomoc: 'Datum registracije nije zabilježen.' },
      staz: null,
    };
  }

  return {
    datum: { osnova: 'registracija', oznaka: 'Kaladont staž', pomoc: null },
    staz: izracunajKalendarskiStaz(datumRegistracije, referentniDatum),
  };
}

function formatirajBroj(broj: number): string {
  return new Intl.NumberFormat('hr-HR', { maximumFractionDigits: 0 }).format(broj);
}

function oblikBroja(broj: number): 0 | 1 | 2 {
  const zadnjeDvije = broj % 100;
  if (zadnjeDvije >= 11 && zadnjeDvije <= 14) return 2;
  const zadnja = broj % 10;
  if (zadnja === 1) return 0;
  if (zadnja >= 2 && zadnja <= 4) return 1;
  return 2;
}

function formatirajBrojCetveroboja(broj: number): string {
  const oblici = ['Četveroboj', 'Četveroboja', 'Četveroboja'];
  return `${formatirajBroj(broj)} ${oblici[oblikBroja(broj)]!}`;
}

function formatirajBrojDvoboja(broj: number): string {
  const oblici = ['Dvoboj', 'Dvoboja', 'Dvoboja'];
  return `${formatirajBroj(broj)} ${oblici[oblikBroja(broj)]!}`;
}

function sastaviS1(podaci: CvPodaciIgraca): string {
  const dvoboji = podaci.dvaIgraca.odigrane;
  const cetvero = podaci.cetiriIgraca.odigrane;
  const ukupno = dvoboji + cetvero;
  const nadimak = podaci.nadimak;

  if (ukupno === 0) return `${nadimak} još nije završio nijednu javnu partiju.`;
  if (dvoboji > 0 && cetvero === 0) {
    return `${nadimak} je završio ${formatirajBrojDvoboja(dvoboji)}, a Četveroboj još nije odigrao.`;
  }
  if (cetvero > 0 && dvoboji === 0) {
    return `${nadimak} je završio ${formatirajBrojCetveroboja(cetvero)}, a Dvoboj još nije odigrao.`;
  }
  if (dvoboji === cetvero) {
    return `${nadimak} je završio ${formatirajBrojDvoboja(dvoboji)} i ${formatirajBrojCetveroboja(cetvero)}.`;
  }
  if (dvoboji > cetvero) {
    return `${nadimak} je više javnih partija odigrao u Dvoboju: završio je ${formatirajBrojDvoboja(dvoboji)} i ${formatirajBrojCetveroboja(cetvero)}.`;
  }
  return `${nadimak} je više javnih partija odigrao u Četveroboju: završio je ${formatirajBrojDvoboja(dvoboji)} i ${formatirajBrojCetveroboja(cetvero)}.`;
}

function rangZaMod(podaci: CvPodaciModa, mod: CvMod): string {
  const prosjek = podaci.odigrane > 0 ? podaci.bodoviUkupno / podaci.odigrane : 0;
  return izracunajRang(podaci.odigrane, prosjek, mod);
}

function odaberiKvalifikaciju(podaci: CvPodaciIgraca): Kvalifikacija {
  const rangDva = rangZaMod(podaci.dvaIgraca, 'dva_igraca');
  const rangCetiri = rangZaMod(podaci.cetiriIgraca, 'cetiri_igraca');
  const kalibriranDva = podaci.dvaIgraca.odigrane >= BROJ_PARTIJA_ZA_KALIBRACIJU;
  const kalibriranCetiri = podaci.cetiriIgraca.odigrane >= BROJ_PARTIJA_ZA_KALIBRACIJU;
  const veciRang = vratiVeciRang(kalibriranDva ? rangDva : null, kalibriranCetiri ? rangCetiri : null);

  if (!veciRang) return { rang: 'Piskaralo', kalibriran: false, nacini: [], razina: stanjeIskustva(podaci.iskustvoUkupno).razina };

  const nacini: CvMod[] = [];
  if (kalibriranDva && rangDva === veciRang) nacini.push('dva_igraca');
  if (kalibriranCetiri && rangCetiri === veciRang) nacini.push('cetiri_igraca');
  return {
    rang: veciRang,
    kalibriran: true,
    nacini,
    razina: stanjeIskustva(podaci.iskustvoUkupno).razina,
  };
}

function lokacijaRanga(modovi: readonly CvMod[]): string {
  if (modovi.length === 2) return 'u oba načina igre';
  return modovi[0] === 'dva_igraca' ? 'u Dvoboju' : 'u Četveroboju';
}

function sastaviS2(kvalifikacija: Kvalifikacija): string {
  if (kvalifikacija.kalibriran) {
    return `Najvišu trenutačnu titulu „${kvalifikacija.rang}” ostvario je ${lokacijaRanga(kvalifikacija.nacini)}.`;
  }
  return `Rang se dodjeljuje nakon ${formatirajBroj(BROJ_PARTIJA_ZA_KALIBRACIJU)} javnih partija u Dvoboju ili Četveroboju.`;
}

function jeValjanBrojacOpcionalni(vrijednost: number): boolean {
  return jeNenegativanCijeliBroj(vrijednost);
}

function validirajDnk(podaci: CvDnkStatistika | null): { valjani: boolean; nevaljaniPodaci: boolean } {
  if (!podaci) return { valjani: false, nevaljaniPodaci: false };
  const brojaci = [
    podaci.prihvaceniPotezi,
    podaci.ukupnoTrajanjePrihvaceniPoteziMs,
    podaci.najduziStreak,
    podaci.dugeRijeci,
    podaci.srednjeDugeRijeci,
    podaci.jakoDugeRijeci,
    podaci.rijetkeRijeci,
    podaci.srednjeRijetkeRijeci,
    podaci.jakoRijetkeRijeci,
  ];
  const osiValjane = podaci.osi.every((os) => Number.isFinite(os.vrijednost) && os.vrijednost >= 0 && os.vrijednost <= 100);
  const brojaciValjani = brojaci.every(jeValjanBrojacOpcionalni);
  return {
    valjani: jeValjanBrojacOpcionalni(podaci.prihvaceniPotezi),
    nevaljaniPodaci: !brojaciValjani || !osiValjane,
  };
}

function izvorOsValjan(podaci: CvDnkStatistika, eliminacije: number, kljuc: CvOs): boolean {
  if (kljuc === 'brzina') {
    return jeValjanBrojacOpcionalni(podaci.ukupnoTrajanjePrihvaceniPoteziMs) && podaci.ukupnoTrajanjePrihvaceniPoteziMs > 0;
  }
  if (kljuc === 'fokus') {
    return jeValjanBrojacOpcionalni(podaci.najduziStreak) && podaci.najduziStreak > 0 && podaci.najduziStreak <= podaci.prihvaceniPotezi;
  }
  if (kljuc === 'taktika') return eliminacije > 0;
  if (kljuc === 'duge_rijeci') {
    const brojevi = [podaci.dugeRijeci, podaci.srednjeDugeRijeci, podaci.jakoDugeRijeci];
    return brojevi.every(jeValjanBrojacOpcionalni) && brojevi.some((broj) => broj > 0) && brojevi.reduce((suma, broj) => suma + broj, 0) <= podaci.prihvaceniPotezi;
  }
  if (kljuc === 'rijetke_rijeci') {
    const brojevi = [podaci.rijetkeRijeci, podaci.srednjeRijetkeRijeci, podaci.jakoRijetkeRijeci];
    return brojevi.every(jeValjanBrojacOpcionalni) && brojevi.some((broj) => broj > 0);
  }
  return false;
}

function jeOpisivaOs(os: { kljuc: DnkKljuc; vrijednost: number }): os is { kljuc: CvOs; vrijednost: number } {
  return os.kljuc !== 'vjestina' && REDOSLIJED_OSI.includes(os.kljuc);
}

function kandidatiModa(podaci: CvPodaciIgraca): { mod: CvMod; vrijednosti: CvPodaciModa & { dnk: CvDnkStatistika } }[] {
  const kandidati: { mod: CvMod; vrijednosti: CvPodaciModa & { dnk: CvDnkStatistika } }[] = [];
  for (const [mod, vrijednosti] of [
    ['dva_igraca', podaci.dvaIgraca],
    ['cetiri_igraca', podaci.cetiriIgraca],
  ] as const) {
    if (!jeDnkOtkljucan(vrijednosti.odigrane) || !vrijednosti.dnk) continue;
    const validacija = validirajDnk(vrijednosti.dnk);
    if (!validacija.valjani || vrijednosti.dnk.prihvaceniPotezi < MIN_PRIHVACENIH_POTEZA_ZA_STIL) continue;
    kandidati.push({ mod, vrijednosti: { ...vrijednosti, dnk: vrijednosti.dnk } });
  }
  return kandidati.sort((prvi, drugi) =>
    drugi.vrijednosti.odigrane - prvi.vrijednosti.odigrane ||
    (prvi.mod === 'dva_igraca' ? -1 : 1),
  );
}

function odaberiStil(podaci: CvPodaciIgraca): RezultatStila {
  const ukupno = podaci.dvaIgraca.odigrane + podaci.cetiriIgraca.odigrane;
  if (ukupno === 0) return { osobine: [] };

  const listaKandidata = kandidatiModa(podaci);
  if (listaKandidata.length === 0) return { osobine: [] };

  const kandidat = listaKandidata[0]!;
  const dnk = kandidat.vrijednosti.dnk;
  const eliminacije = kandidat.vrijednosti.eliminacijeUkupno;
  const jaki = dnk.osi
    .filter(jeOpisivaOs)
    .filter((os) => Number.isFinite(os.vrijednost) && os.vrijednost >= 0 && os.vrijednost <= 100)
    .filter((os) => os.vrijednost >= MIN_ISTAKNUTA_OS && izvorOsValjan(dnk, eliminacije, os.kljuc))
    .sort((prvi, drugi) =>
      drugi.vrijednost - prvi.vrijednost ||
      REDOSLIJED_OSI.indexOf(prvi.kljuc) - REDOSLIJED_OSI.indexOf(drugi.kljuc),
    );
  const osobine = jaki.length > 0
    ? jaki.slice(0, 2).filter((os, indeks) => indeks === 0 || jaki[0]!.vrijednost - os.vrijednost <= MAKS_RAZLIKA_DRUGE_OSI).map((os) => os.kljuc)
    : [];
  return { osobine };
}

function modLokativ(mod: CvMod): string {
  return mod === 'dva_igraca' ? 'u Dvoboju' : 'u Četveroboju';
}

function oblikSlova(broj: number): string {
  return `${formatirajBroj(broj)} ${['slovo', 'slova', 'slova'][oblikBroja(broj)]!}`;
}

function jeCistaRijec(rijec: string): boolean {
  return rijec.length > 0 && !/[\u0000-\u001f\u007f]/.test(rijec);
}

function dokazDostignuca(podaci: CvPodaciIgraca): Dokaz | null {
  const indeksPoId = new Map<string, number>(REDOSLIJED_DOSTIGNUCA.map((id, indeks) => [id, indeks]));
  const kandidati = podaci.dostignuca.flatMap((dostignuce) => {
    const indeks = indeksPoId.get(dostignuce.id);
    const definicija = DEFINICIJE_DOSTIGNUCA.find((stavka) => stavka.id === dostignuce.id);
    if (
      indeks === undefined ||
      !definicija ||
      !jeNenegativanCijeliBroj(dostignuce.razina) ||
      dostignuce.razina < MIN_RAZINA_DOSTIGNUCA ||
      dostignuce.razina > definicija.pragovi.length
    ) return [];
    return [{ definicija, razina: dostignuce.razina, indeks, udio: dostignuce.razina / definicija.pragovi.length }];
  }).sort((prvi, drugi) => drugi.udio - prvi.udio || prvi.indeks - drugi.indeks);
  const odabrano = kandidati[0];
  if (!odabrano) return null;
  return {
    vrsta: 'dostignuce',
    tekst: `dostignućem „${odabrano.definicija.naziv}” (${formatirajBroj(odabrano.razina)} od ${formatirajBroj(odabrano.definicija.pragovi.length)} razina)`,
  };
}

function dokazNajduzeRijeci(podaci: CvPodaciIgraca): Dokaz | null {
  const kandidati = (['dva_igraca', 'cetiri_igraca'] as const).flatMap((mod) => {
    const podatakModa = mod === 'dva_igraca' ? podaci.dvaIgraca : podaci.cetiriIgraca;
    const statistika = podatakModa.statistikaRijeci;
    if (!statistika || podatakModa.odigrane === 0 || !statistika.najduzaRijec || !jeCistaRijec(statistika.najduzaRijec)) return [];
    const rijec = statistika.najduzaRijec.normalize('NFC').toLocaleLowerCase('hr-HR');
    const duljina = grafemi(rijec).length;
    if (
      !jeNenegativanCijeliBroj(statistika.najduzaRijecGrafemi) ||
      duljina !== statistika.najduzaRijecGrafemi ||
      duljina < PRAGOVI_DULJINE.duga ||
      duljina > MAKS_DULJINA_REKORDNE_RIJECI
    ) return [];
    return [{ mod, rijec, duljina }];
  }).sort((prvi, drugi) =>
    drugi.duljina - prvi.duljina ||
    (prvi.mod === 'dva_igraca' ? -1 : 1) ||
    (prvi.rijec < drugi.rijec ? -1 : prvi.rijec > drugi.rijec ? 1 : 0),
  );
  const odabrano = kandidati[0];
  if (!odabrano) return null;
  return {
    vrsta: 'najduza_rijec',
    tekst: `dugom riječju „${odabrano.rijec}” (${oblikSlova(odabrano.duljina)})`,
  };
}

function dokazRijetkeRijeci(podaci: CvPodaciIgraca): Dokaz | null {
  const kandidati = (['dva_igraca', 'cetiri_igraca'] as const).flatMap((mod) => {
    const podatakModa = mod === 'dva_igraca' ? podaci.dvaIgraca : podaci.cetiriIgraca;
    const rijec = podatakModa.statistikaRijeci?.najrjedaRijec;
    if (podatakModa.odigrane === 0 || !rijec || !jeCistaRijec(rijec)) return [];
    return [{ mod, rijec: rijec.normalize('NFC').toLocaleLowerCase('hr-HR') }];
  }).sort((prvi, drugi) =>
    (prvi.mod === 'dva_igraca' ? -1 : 1) ||
    (prvi.rijec < drugi.rijec ? -1 : prvi.rijec > drugi.rijec ? 1 : 0),
  );
  const odabrano = kandidati[0];
  if (!odabrano) return null;
  return {
    vrsta: 'rijetka_rijec',
    tekst: `riječju „${odabrano.rijec}” iz rijetkog frekvencijskog razreda`,
  };
}

function dokazStreak(podaci: CvPodaciIgraca, stil: RezultatStila): Dokaz | null {
  if (stil.osobine.includes('fokus')) return null;
  const streaki = [podaci.dvaIgraca, podaci.cetiriIgraca]
    .filter((mod) => mod.odigrane > 0 && mod.dnk !== null)
    .map((mod) => mod.dnk!.najduziStreak)
    .filter((streak) => jeNenegativanCijeliBroj(streak));
  const najduzi = Math.max(0, ...streaki);
  if (najduzi < MIN_NIZ_RIJECI) return null;
  return { vrsta: 'streak', tekst: `dugim nizom prihvaćenih riječi (${formatirajBroj(najduzi)})` };
}

function dokazBrzine(podaci: CvPodaciIgraca): Dokaz | null {
  const kandidati = (['dva_igraca', 'cetiri_igraca'] as const).flatMap((mod) => {
    const vrijednosti = mod === 'dva_igraca' ? podaci.dvaIgraca : podaci.cetiriIgraca;
    const dnk = vrijednosti.dnk;
    if (
      vrijednosti.odigrane === 0 ||
      !dnk ||
      !validirajDnk(dnk).valjani ||
      validirajDnk(dnk).nevaljaniPodaci ||
      dnk.prihvaceniPotezi < MIN_PRIHVACENIH_POTEZA_ZA_STIL ||
      dnk.ukupnoTrajanjePrihvaceniPoteziMs <= 0
    ) return [];
    const prosjekMs = dnk.ukupnoTrajanjePrihvaceniPoteziMs / dnk.prihvaceniPotezi;
    if (prosjekMs > 10_000) return [];
    return [{ mod, prosjekMs }];
  }).sort((prvi, drugi) => prvi.prosjekMs - drugi.prosjekMs || (prvi.mod === 'dva_igraca' ? -1 : 1));
  const odabrano = kandidati[0];
  if (!odabrano) return null;
  const sekunde = new Intl.NumberFormat('hr-HR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(odabrano.prosjekMs / 1000);
  return { vrsta: 'brzina', tekst: `prihvaćenim potezima od prosječno ${sekunde} s ${modLokativ(odabrano.mod)}` };
}

function dokazDugihRijeci(podaci: CvPodaciIgraca): Dokaz | null {
  const kandidati = (['dva_igraca', 'cetiri_igraca'] as const).flatMap((mod) => {
    const vrijednosti = mod === 'dva_igraca' ? podaci.dvaIgraca : podaci.cetiriIgraca;
    const dnk = vrijednosti.dnk;
    if (!dnk || vrijednosti.odigrane === 0 || !validirajDnk(dnk).valjani || validirajDnk(dnk).nevaljaniPodaci) return [];
    const ukupno = dnk.dugeRijeci + dnk.srednjeDugeRijeci + dnk.jakoDugeRijeci;
    if (!jeNenegativanCijeliBroj(ukupno) || ukupno === 0 || ukupno > dnk.prihvaceniPotezi) return [];
    return [{ mod, ukupno }];
  }).sort((prvi, drugi) => drugi.ukupno - prvi.ukupno || (prvi.mod === 'dva_igraca' ? -1 : 1));
  const odabrano = kandidati[0];
  if (!odabrano) return null;
  return { vrsta: 'duge_rijeci', tekst: `zabilježenim dugim riječima (${formatirajBroj(odabrano.ukupno)}) ${modLokativ(odabrano.mod)}` };
}

function dokazPobjeda(podaci: CvPodaciIgraca): Dokaz | null {
  const pobjede = podaci.dvaIgraca.pobjede + podaci.cetiriIgraca.pobjede;
  if (pobjede < 1) return null;
  return { vrsta: 'pobjede', tekst: `javnim pobjedama (${formatirajBroj(pobjede)})` };
}

function dokazKolekcije(podaci: CvPodaciIgraca): Dokaz | null {
  if (podaci.kolekcijaRijeci < 10) return null;
  return { vrsta: 'kolekcija', tekst: `kolekcijom od ${formatirajBroj(podaci.kolekcijaRijeci)} riječi` };
}

function odaberiIstaknuto(podaci: CvPodaciIgraca, stil: RezultatStila): string[] {
  const kandidati = [
    dokazDostignuca(podaci),
    dokazStreak(podaci, stil),
    dokazNajduzeRijeci(podaci),
    dokazBrzine(podaci),
    dokazDugihRijeci(podaci),
    dokazRijetkeRijeci(podaci),
    dokazKolekcije(podaci),
    dokazPobjeda(podaci),
  ].filter((dokaz): dokaz is Dokaz => dokaz !== null);
  return kandidati.length >= 2 ? kandidati.slice(0, 3).map((dokaz) => dokaz.tekst) : [];
}

function sastaviRecenice(podaci: CvPodaciIgraca, kvalifikacija: Kvalifikacija): CvRecenice {
  return [sastaviS1(podaci), sastaviS2(kvalifikacija)];
}

export function sastaviKaladontCv(podaci: CvPodaciIgraca): KaladontCvDto {
  validirajMod(podaci.dvaIgraca, 'dva_igraca');
  validirajMod(podaci.cetiriIgraca, 'cetiri_igraca');
  if (!jeNenegativanCijeliBroj(podaci.iskustvoUkupno) || !jeNenegativanCijeliBroj(podaci.kolekcijaRijeci) || podaci.nadimak.length === 0) throw new NevaljaniCvPodaci();

  const kalendarskiStaz = prikazaniStaz(podaci);
  const kvalifikacija = odaberiKvalifikaciju(podaci);
  const stil = odaberiStil(podaci);
  const biografija: CvBiografija = { tip: 'opis', recenice: sastaviRecenice(podaci, kvalifikacija) };
  const istaknuto = odaberiIstaknuto(podaci, stil);

  return {
    verzijaPredlozaka: 1,
    ...kalendarskiStaz,
    kvalifikacija,
    biografija,
    istaknuto,
  };
}