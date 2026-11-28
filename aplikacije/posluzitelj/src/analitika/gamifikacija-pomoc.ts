/**
 * Čisti helperi za analitiku gamifikacije — bez DB ovisnosti.
 */
import {
  DEFINICIJE_DOSTIGNUCA,
  izracunajRazinuDostignuca,
  izracunajSazetakZvjezdicaDostignuca,
  jeDostignuceVidljivo,
  stanjeIskustva,
  type BrojaciDostignucaZaIzracun,
  type DefinicijaDostignuca,
} from 'zajednicko';
/** Isti prag kao izazovi/botovi; lokalna konstanta da helper ne vuče DB konfiguraciju. */
export const PRAG_MALI_UZORAK_GAMIFIKACIJE = 30;

function prosjek(brojevi: number[]): number | null {
  if (brojevi.length === 0) return null;
  return brojevi.reduce((s, v) => s + v, 0) / brojevi.length;
}

function medijan(brojevi: number[]): number | null {
  if (brojevi.length === 0) return null;
  const s = [...brojevi].sort((a, b) => a - b);
  const sredina = Math.floor(s.length / 2);
  if (s.length % 2 === 0) return (s[sredina - 1]! + s[sredina]!) / 2;
  return s[sredina]!;
}

export const RASPONI_RAZINA_XP = [
  { id: '1-5', od: 1, do: 5 },
  { id: '6-10', od: 6, do: 10 },
  { id: '11-20', od: 11, do: 20 },
  { id: '21-40', od: 21, do: 40 },
  { id: '41-70', od: 41, do: 70 },
  { id: '71-100', od: 71, do: 100 },
] as const;

export function postotak(brojnik: number, nazivnik: number): number | null {
  if (nazivnik === 0) return null;
  return (brojnik / nazivnik) * 100;
}

export type NacinFiltraMisijskogKonteksta = 'sve' | 'filtriraj' | 'neprimjenjivo';

/** Doprinosi/nagrade misija: privatna = N/A; javna/trening/izazov = filter; inače sve. */
export function odlukaFiltraMisijskogKonteksta(
  kontekst: string | undefined | null,
): { nacin: NacinFiltraMisijskogKonteksta; kontekst?: 'javna' | 'trening' | 'izazov' } {
  if (kontekst == null || kontekst === '') return { nacin: 'sve' };
  if (kontekst === 'privatna') return { nacin: 'neprimjenjivo' };
  if (kontekst === 'javna' || kontekst === 'trening' || kontekst === 'izazov') {
    return { nacin: 'filtriraj', kontekst };
  }
  return { nacin: 'sve' };
}

export function stopeMisija(dodjele: number, dovrsene: number, zamijenjene: number, istekle: number) {
  const terminalni = dovrsene + zamijenjene + istekle;
  return {
    udioTrenutnoDovrsenih: postotak(dovrsene, dodjele),
    terminalnaStopaDovrsavanja: postotak(dovrsene, terminalni),
    stopaZamjenjivanja: postotak(zamijenjene, dodjele),
    terminalniNazivnik: terminalni,
  };
}

export function nazivPredloskaIzSnimke(
  predlozakId: string,
  snapshot: unknown,
): string {
  if (snapshot && typeof snapshot === 'object' && 'naziv' in snapshot) {
    const naziv = (snapshot as { naziv?: unknown }).naziv;
    if (typeof naziv === 'string' && naziv.trim()) return naziv;
  }
  return predlozakId;
}

export function statistikaVremenaDovrsetkaSekundi(sekunde: number[]) {
  return {
    prosjekSekundi: prosjek(sekunde),
    medijanSekundi: medijan(sekunde),
    uzorak: sekunde.length,
  };
}

export function kantaRazinaXp(razina: number): string {
  for (const raspon of RASPONI_RAZINA_XP) {
    if (razina >= raspon.od && razina <= raspon.do) return raspon.id;
  }
  if (razina > 100) return '101+';
  return '1-5';
}

export function raspodjelaRazinaXp(iskustva: number[]) {
  const kantice = new Map<string, number>();
  for (const raspon of RASPONI_RAZINA_XP) kantice.set(raspon.id, 0);
  kantice.set('101+', 0);
  const razine: number[] = [];
  let napredovali = 0;
  for (const xp of iskustva) {
    const stanje = stanjeIskustva(xp);
    razine.push(stanje.razina);
    if (stanje.razina > 1) napredovali += 1;
    kantice.set(kantaRazinaXp(stanje.razina), (kantice.get(kantaRazinaXp(stanje.razina)) ?? 0) + 1);
  }
  return {
    poRasponu: [...kantice.entries()]
      .filter(([id, broj]) => id !== '101+' || broj > 0)
      .map(([raspon, broj]) => ({ raspon, broj })),
    prosjekXp: prosjek(iskustva),
    medijanXp: medijan(iskustva),
    prosjekRazina: prosjek(razine),
    medijanRazina: medijan(razine),
    napredovaliIznadPrve: napredovali,
    uzorak: iskustva.length,
  };
}

export function razinaDostignucaZaIgraca(opcije: {
  definicija: DefinicijaDostignuca;
  iskustvoUkupno: number;
  najboljiNizAktivnosti: number;
  spremljenaRazina: number;
  brojac: BrojaciDostignucaZaIzracun | null | undefined;
}): number {
  const razinaIskustva = stanjeIskustva(opcije.iskustvoUkupno).razina;
  const brojac = opcije.brojac ?? {};
  const vrijednost = opcije.definicija.brojac === 'razina'
    ? razinaIskustva
    : opcije.definicija.brojac === 'najboljiNizAktivnosti'
      ? opcije.najboljiNizAktivnosti
      : Number(brojac[opcije.definicija.brojac] ?? 0);
  const izracunata = izracunajRazinuDostignuca(opcije.definicija, vrijednost);
  return Math.max(opcije.spremljenaRazina, izracunata);
}

export function agregirajDostignucaPresjek(igraciPodaci: readonly {
  iskustvoUkupno: number;
  najboljiNizAktivnosti: number;
  spremljeneRazine: ReadonlyMap<string, number>;
  brojac: BrojaciDostignucaZaIzracun | null | undefined;
}[]) {
  const vidljive = DEFINICIJE_DOSTIGNUCA.filter((d) => jeDostignuceVidljivo(d.id));
  const bazaIgraca = igraciPodaci.length;
  const poDostignucu = vidljive.map((definicija) => {
    const maxRazina = definicija.pragovi.length;
    const raspodjela = Array.from({ length: maxRazina + 1 }, () => 0);
    let otkljucani = 0;
    let zbrojZvjezdicaOtkljucanih = 0;
    let naMax = 0;
    for (const igrac of igraciPodaci) {
      const razina = razinaDostignucaZaIgraca({
        definicija,
        iskustvoUkupno: igrac.iskustvoUkupno,
        najboljiNizAktivnosti: igrac.najboljiNizAktivnosti,
        spremljenaRazina: igrac.spremljeneRazine.get(definicija.id) ?? 0,
        brojac: igrac.brojac,
      });
      raspodjela[Math.min(razina, maxRazina)]! += 1;
      if (razina > 0) {
        otkljucani += 1;
        zbrojZvjezdicaOtkljucanih += razina;
      }
      if (razina >= maxRazina) naMax += 1;
    }
    return {
      id: definicija.id,
      naziv: definicija.naziv,
      maksimalnaRazina: maxRazina,
      otkljucani,
      udioOtkljucanih: postotak(otkljucani, bazaIgraca),
      raspodjelaRazina: raspodjela.map((broj, razina) => ({ razina, broj })),
      naMaksimalnojRazini: naMax,
      prosjekZvjezdicaOtkljucanih: otkljucani === 0 ? null : zbrojZvjezdicaOtkljucanih / otkljucani,
    };
  });

  const sazeci = igraciPodaci.map((igrac) => izracunajSazetakZvjezdicaDostignuca({
    iskustvoUkupno: igrac.iskustvoUkupno,
    najboljiNizAktivnosti: igrac.najboljiNizAktivnosti,
    spremljeneRazine: igrac.spremljeneRazine,
    brojac: igrac.brojac,
  }));
  const sBaremJednim = sazeci.filter((s) => s.ukupnoOtkljucanih > 0).length;
  const ukupnoZvjezdica = sazeci.map((s) => s.ukupnoZvjezdica);
  const ukupnoOtkljucanih = sazeci.map((s) => s.ukupnoOtkljucanih);
  const kanticeZvjezdica = [
    { id: '0', od: 0, do: 0 },
    { id: '1-10', od: 1, do: 10 },
    { id: '11-30', od: 11, do: 30 },
    { id: '31-70', od: 31, do: 70 },
    { id: '71-140', od: 71, do: 140 },
    { id: '141+', od: 141, do: Number.POSITIVE_INFINITY },
  ];
  const raspodjelaUkupnih = kanticeZvjezdica.map((k) => ({
    raspon: k.id,
    broj: ukupnoZvjezdica.filter((z) => z >= k.od && z <= k.do).length,
  }));
  const igraciSMaxPojedinim = igraciPodaci.filter((igrac) =>
    vidljive.some((def) => {
      const razina = razinaDostignucaZaIgraca({
        definicija: def,
        iskustvoUkupno: igrac.iskustvoUkupno,
        najboljiNizAktivnosti: igrac.najboljiNizAktivnosti,
        spremljenaRazina: igrac.spremljeneRazine.get(def.id) ?? 0,
        brojac: igrac.brojac,
      });
      return razina >= def.pragovi.length;
    }),
  ).length;

  return {
    bazaIgraca,
    igraciSBaremJednim: sBaremJednim,
    prosjekOtkljucanih: bazaIgraca === 0 ? null : ukupnoOtkljucanih.reduce((a, b) => a + b, 0) / bazaIgraca,
    prosjekZvjezdica: bazaIgraca === 0 ? null : ukupnoZvjezdica.reduce((a, b) => a + b, 0) / bazaIgraca,
    medijanZvjezdica: medijan(ukupnoZvjezdica),
    raspodjelaUkupnihZvjezdica: raspodjelaUkupnih,
    igraciSMaksimalnoDovrsenimPojedinim: igraciSMaxPojedinim,
    poDostignucu,
  };
}

/** Veličina kolekcije = broj redova (riječ se broji jednom i ako je duga i rijetka). */
export function agregirajKolekcijuPresjek(velicine: number[], brojDugih: number, brojRijetkih: number, distinctRijeci: number) {
  const sBaremJednom = velicine.filter((v) => v > 0).length;
  const kantice = [
    { id: '0', od: 0, do: 0 },
    { id: '1-10', od: 1, do: 10 },
    { id: '11-50', od: 11, do: 50 },
    { id: '51-100', od: 51, do: 100 },
    { id: '101-500', od: 101, do: 500 },
    { id: '501+', od: 501, do: Number.POSITIVE_INFINITY },
  ];
  return {
    igraciSBaremJednomRijeci: sBaremJednom,
    distinctRijeciGlobalno: distinctRijeci,
    prosjekVelicine: prosjek(velicine),
    medijanVelicine: medijan(velicine),
    raspodjelaVelicine: kantice.map((k) => ({
      raspon: k.id,
      broj: velicine.filter((v) => v >= k.od && v <= k.do).length,
    })),
    brojDugihOtkljucavanja: brojDugih,
    brojRijetkihOtkljucavanja: brojRijetkih,
    uzorakIgraca: velicine.length,
  };
}
