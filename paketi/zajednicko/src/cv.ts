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
export type CvRecenice =
  | readonly [string, string, string, string]
  | readonly [string, string, string, string, string];

export type CvBiografija =
  | { tip: 'opis'; recenice: CvRecenice }
  | { tip: 'nedovoljno_informacija'; tekst: string };

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
const DOMINANTNI_UDIO = 0.6;
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
  | { vrsta: 'dostignuce'; recenica: string }
  | { vrsta: 'najduza_rijec'; recenica: string }
  | { vrsta: 'rijetka_rijec'; recenica: string }
  | { vrsta: 'streak'; recenica: string }
  | { vrsta: 'pobjede'; recenica: string };

interface RezultatStila {
  mod: CvMod | null;
  osobine: CvOs[];
  primarnaOs: CvOs | null;
  zakljucan: boolean;
  nedostajeUzorak: boolean;
  nevaljaniOpcionalniPodaci: boolean;
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

function formatirajBrojIgru(broj: number): string {
  const oblici = ['igru', 'igre', 'igara'];
  return `${formatirajBroj(broj)} ${oblici[oblikBroja(broj)]!}`;
}

function formatirajBrojDvoboja(broj: number): string {
  const oblici = ['dvoboj', 'dvoboja', 'dvoboja'];
  return `${formatirajBroj(broj)} ${oblici[oblikBroja(broj)]!}`;
}

function formatirajNedostajuceIgre(broj: number): string {
  const oblik = oblikBroja(broj);
  const glagol = oblik === 1 ? 'nedostaju' : 'nedostaje';
  const naziv = oblik === 0 ? 'javna igra' : oblik === 1 ? 'javne igre' : 'javnih igara';
  return `${glagol} mu još ${formatirajBroj(broj)} ${naziv}`;
}

function sastaviS1(podaci: CvPodaciIgraca): string {
  const dvoboji = podaci.dvaIgraca.odigrane;
  const cetvero = podaci.cetiriIgraca.odigrane;
  const ukupno = dvoboji + cetvero;
  const nadimak = `Igrač ${podaci.nadimak}`;

  if (ukupno === 0) return `${nadimak} još nije završio nijednu javnu igru.`;
  if (dvoboji > 0 && cetvero === 0) {
    return `${nadimak} dosad je završio ${formatirajBrojDvoboja(dvoboji)}, a javnu igru učetvero još nije odigrao.`;
  }
  if (cetvero > 0 && dvoboji === 0) {
    return `${nadimak} dosad je završio ${formatirajBrojIgru(cetvero)} učetvero, a javni dvoboj još nije odigrao.`;
  }
  if (ukupno < BROJ_PARTIJA_ZA_KALIBRACIJU) {
    return `${nadimak} dosad je završio ${formatirajBrojDvoboja(dvoboji)} i ${formatirajBrojIgru(cetvero)} učetvero u javnim igrama.`;
  }
  if (dvoboji === cetvero) {
    return `${nadimak} ima podjednak broj javnih igara u oba načina: završio je ${formatirajBrojDvoboja(dvoboji)} i ${formatirajBrojIgru(cetvero)} učetvero.`;
  }
  if (dvoboji / ukupno >= DOMINANTNI_UDIO) {
    return `${nadimak} više javnih igara odigrao je u dvobojima: završio je ${formatirajBrojDvoboja(dvoboji)} i ${formatirajBrojIgru(cetvero)} učetvero.`;
  }
  if (cetvero / ukupno >= DOMINANTNI_UDIO) {
    return `${nadimak} više javnih igara odigrao je učetvero: završio je ${formatirajBrojIgru(cetvero)} učetvero i ${formatirajBrojDvoboja(dvoboji)}.`;
  }
  return `${nadimak} igra oba javna načina: završio je ${formatirajBrojDvoboja(dvoboji)} i ${formatirajBrojIgru(cetvero)} učetvero.`;
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
  if (modovi.length === 2) return 'koji ima u oba načina igre';
  return modovi[0] === 'dva_igraca' ? 'ostvaren u dvobojima' : 'ostvaren u igri učetvero';
}

function sastaviS2(podaci: CvPodaciIgraca, kvalifikacija: Kvalifikacija): string {
  if (kvalifikacija.kalibriran) {
    return `Njegov je najviši trenutačni rang „${kvalifikacija.rang}”, ${lokacijaRanga(kvalifikacija.nacini)}.`;
  }

  const dvoboji = podaci.dvaIgraca.odigrane;
  const cetvero = podaci.cetiriIgraca.odigrane;
  if (dvoboji + cetvero === 0) return 'Trenutačno ima početnu oznaku „Piskaralo”, a prvi rang tek treba steći.';

  const cilj = dvoboji >= cetvero ? 'dvobojima' : 'igri učetvero';
  const preostalo = BROJ_PARTIJA_ZA_KALIBRACIJU - Math.max(dvoboji, cetvero);
  return `Trenutačno ima početnu oznaku „Piskaralo”, a do prvog ranga ${formatirajNedostajuceIgre(preostalo)} u ${cilj}.`;
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
  if (ukupno === 0) return { mod: null, osobine: [], primarnaOs: null, zakljucan: false, nedostajeUzorak: true, nevaljaniOpcionalniPodaci: false };

  const jeOtkljucanNacin = jeDnkOtkljucan(podaci.dvaIgraca.odigrane) || jeDnkOtkljucan(podaci.cetiriIgraca.odigrane);
  const listaKandidata = kandidatiModa(podaci);
  if (listaKandidata.length === 0) {
    const nevaljani = [podaci.dvaIgraca.dnk, podaci.cetiriIgraca.dnk]
      .some((dnk) => dnk !== null && validirajDnk(dnk).nevaljaniPodaci);
    return {
      mod: null,
      osobine: [],
      primarnaOs: null,
      zakljucan: !jeOtkljucanNacin,
      nedostajeUzorak: jeOtkljucanNacin,
      nevaljaniOpcionalniPodaci: nevaljani,
    };
  }

  const kandidat = listaKandidata[0]!;
  const dnk = kandidat.vrijednosti.dnk;
  const eliminacije = kandidat.vrijednosti.eliminacijeUkupno;
  const nevaljaniOpcionalniPodaci = validirajDnk(dnk).nevaljaniPodaci;
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
  return {
    mod: kandidat.mod,
    osobine,
    primarnaOs: osobine[0] ?? null,
    zakljucan: false,
    nedostajeUzorak: false,
    nevaljaniOpcionalniPodaci,
  };
}

function modInstrumental(mod: CvMod): string {
  return mod === 'dva_igraca' ? 'U dvobojima' : 'U igri učetvero';
}

function modLokativ(mod: CvMod): string {
  return mod === 'dva_igraca' ? 'u dvobojima' : 'u igri učetvero';
}

const FRAGMENTI_OSI: Readonly<Record<CvOs, string>> = {
  taktika: 'izazvanim eliminacijama',
  fokus: 'dugim nizom prihvaćenih riječi',
  brzina: 'brzim prihvaćenim potezima',
  duge_rijeci: 'uporabom dugih riječi',
  rijetke_rijeci: 'otkrivanjem rijetkih riječi',
};

function sastaviS3(podaci: CvPodaciIgraca, stil: RezultatStila, osobine: readonly CvOs[] = stil.osobine): string {
  const ukupno = podaci.dvaIgraca.odigrane + podaci.cetiriIgraca.odigrane;
  if (ukupno === 0) return 'Za opis njegova stila u javnim igrama tek treba prikupiti podatke.';
  if (stil.zakljucan) return 'Njegov stil još se oblikuje, a DNK profil otključava nakon deset javnih igara u istom načinu.';
  if (stil.nedostajeUzorak || stil.mod === null) return 'Za pouzdan opis njegova stila još nedostaje zabilježenih podataka o potezima.';
  if (osobine.length === 0) {
    return stil.nevaljaniOpcionalniPodaci
      ? 'Za pouzdan opis njegova stila još nedostaje zabilježenih podataka o potezima.'
      : `Njegov DNK ${modLokativ(stil.mod)} zasad ne izdvaja jednu jasnu specijalnost.`;
  }
  const fragmenti = osobine.map((os) => FRAGMENTI_OSI[os]).join(' i ');
  return `${modInstrumental(stil.mod)} njegov se DNK ističe ${fragmenti}.`;
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
    recenica: `Među njegovim dostignućima ističe se „${odabrano.definicija.naziv}”, s osvojenih ${odabrano.razina} od ${odabrano.definicija.pragovi.length} zvjezdica.`,
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
    recenica: `U javnim igrama njegova najduža zabilježena riječ glasi „${odabrano.rijec}” (${oblikSlova(odabrano.duljina)}).`,
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
    recenica: `Među njegovim zabilježenim rijetkim riječima nalazi se „${odabrano.rijec}”.`,
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
  return { vrsta: 'streak', recenica: `Njegov najdulji niz obuhvaća ${formatirajBroj(najduzi)} uzastopno prihvaćenih riječi.` };
}

function dokazPobjeda(podaci: CvPodaciIgraca): Dokaz | null {
  const pobjede = podaci.dvaIgraca.pobjede + podaci.cetiriIgraca.pobjede;
  if (pobjede < 1) return null;
  const oblici = ['pobjedu', 'pobjede', 'pobjeda'];
  return { vrsta: 'pobjede', recenica: `U javnim igrama dosad je ostvario ${formatirajBroj(pobjede)} ${oblici[oblikBroja(pobjede)]!}.` };
}

function odaberiDokaz(podaci: CvPodaciIgraca, stil: RezultatStila): Dokaz | null {
  return dokazDostignuca(podaci) ?? dokazNajduzeRijeci(podaci) ?? dokazRijetkeRijeci(podaci) ?? dokazStreak(podaci, stil) ?? dokazPobjeda(podaci);
}

function saljivaKategorija(stil: RezultatStila): 'bez_igara' | CvOs | 'neutralno' {
  if (podaciBezJavnihIgara(stil)) return 'bez_igara';
  return stil.primarnaOs ?? 'neutralno';
}

function podaciBezJavnihIgara(stil: RezultatStila): boolean {
  return stil.mod === null && stil.nedostajeUzorak && !stil.zakljucan;
}

const SALE: Readonly<Record<string, readonly [string, string]>> = {
  bez_igara: [
    'Prva javna igra još čeka da otvori ovu priču.',
    'Početak njegove javne statistike još je prazan list.',
  ],
  brzina: [
    'Kad se pojavi prava riječ, njegov odgovor ne čeka dugo.',
    'Ponekad potez stigne prije nego što protivnik završi misao.',
  ],
  duge_rijeci: [
    'U njegovoj igračkoj priči duge riječi zauzimaju posebno mjesto.',
    'Kad riječ potraje, i potez dobije svoju malu priču.',
  ],
  rijetke_rijeci: [
    'U njegovim se igrama katkad pojavi riječ koju protivnik nije očekivao.',
    'Rijetka riječ ponekad postane najpamtljiviji dio njegove igre.',
  ],
  taktika: [
    'Timski je igrač, sve dok ostali ne sjednu za suprotnu stranu stola.',
    'Protivnik ne zna uvijek kamo vodi njegov sljedeći potez.',
  ],
  fokus: [
    'Kad uhvati niz prihvaćenih riječi, teško ga je prekinuti.',
    'Njegovi nizovi riječi znaju potrajati dulje od očekivanog.',
  ],
  neutralno: [
    'Svaka igra njegove priče započinje s dva nova slova.',
    'Njegova igra piše se potez po potez.',
  ],
};

function saljiviTekst(igracId: string, stil: RezultatStila): string {
  const kategorija = saljivaKategorija(stil);
  const zadnjiZnak = igracId.at(-1)?.toLowerCase() ?? '0';
  const varijanta = Number.parseInt(zadnjiZnak, 16) % 2;
  return SALE[kategorija]![varijanta]!;
}

function brojRijeci(tekst: string): number {
  return tekst.trim().split(/\s+/).filter(Boolean).length;
}

function sastaviRecenice(
  podaci: CvPodaciIgraca,
  kvalifikacija: Kvalifikacija,
  stil: RezultatStila,
  dokaz: Dokaz | null,
): CvRecenice {
  let s1 = sastaviS1(podaci);
  let s2 = sastaviS2(podaci, kvalifikacija);
  let osobine = [...stil.osobine];
  let s3 = sastaviS3(podaci, stil, osobine);
  const saljiva = saljiviTekst(podaci.igracId, stil);
  let odabraniDokaz = dokaz;
  let tekst = [s1, s2, s3, ...(odabraniDokaz ? [odabraniDokaz.recenica] : []), saljiva].join(' ');

  if (brojRijeci(tekst) > 120 && odabraniDokaz) {
    odabraniDokaz = null;
    tekst = [s1, s2, s3, saljiva].join(' ');
  }
  if (brojRijeci(tekst) > 120 && osobine.length > 1) {
    osobine = osobine.slice(0, 1);
    s3 = sastaviS3(podaci, stil, osobine);
    tekst = [s1, s2, s3, ...(odabraniDokaz ? [odabraniDokaz.recenica] : []), saljiva].join(' ');
  }
  if (brojRijeci(tekst) > 120) {
    const dvoboji = podaci.dvaIgraca.odigrane;
    const cetvero = podaci.cetiriIgraca.odigrane;
    if (dvoboji > 0 && cetvero > 0) {
      s1 = `Igrač ${podaci.nadimak} ima ${formatirajBrojDvoboja(dvoboji)} i ${formatirajBrojIgru(cetvero)} učetvero u javnim igrama.`;
    }
    if (kvalifikacija.kalibriran) {
      s2 = `Njegov najviši trenutačni rang je „${kvalifikacija.rang}” (${lokacijaRanga(kvalifikacija.nacini)}).`;
    }
    tekst = [s1, s2, s3, ...(odabraniDokaz ? [odabraniDokaz.recenica] : []), saljiva].join(' ');
  }

  if (odabraniDokaz) return [s1, s2, s3, odabraniDokaz.recenica, saljiva];
  return [s1, s2, s3, saljiva];
}

export function sastaviKaladontCv(podaci: CvPodaciIgraca): KaladontCvDto {
  validirajMod(podaci.dvaIgraca, 'dva_igraca');
  validirajMod(podaci.cetiriIgraca, 'cetiri_igraca');
  if (!jeNenegativanCijeliBroj(podaci.iskustvoUkupno) || podaci.nadimak.length === 0) throw new NevaljaniCvPodaci();

  const kalendarskiStaz = prikazaniStaz(podaci);
  const kvalifikacija = odaberiKvalifikaciju(podaci);
  const stil = odaberiStil(podaci);
  const dokaz = odaberiDokaz(podaci, stil);
  const ukupnoJavnihIgara = podaci.dvaIgraca.odigrane + podaci.cetiriIgraca.odigrane;
  const biografija: CvBiografija = ukupnoJavnihIgara === 0 && !dokaz
    ? { tip: 'nedovoljno_informacija', tekst: 'Još nemamo dovoljno informacija za opis ovog igrača.' }
    : { tip: 'opis', recenice: sastaviRecenice(podaci, kvalifikacija, stil, dokaz) };

  return {
    verzijaPredlozaka: 1,
    ...kalendarskiStaz,
    kvalifikacija,
    biografija,
  };
}