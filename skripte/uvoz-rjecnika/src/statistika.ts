/**
 * Statistika i tekst izvještaja nad agregiranim hrLexom — dijele ga analiza (bez baze) i uvoz.
 */
import { SVE_VRSTE_RIJECI, type VrstaRijeci } from 'zajednicko';
import type { RezultatAgregacije } from './hrlex.js';

interface RedKategorije {
  vrsta: VrstaRijeci;
  oblika: number;
  grupa: number;
  lema: number;
  dvografemskih: number;
}

export interface Statistika {
  kategorije: RedKategorije[]; // sortirano silazno po broju oblika
  frekvencijskiRazredi: Map<string, number>;
  mrtviParovi: [string, number][]; // sortirano silazno po broju riječi
  oblikaNaMrtvimParovima: number;
  ntJeMrtav: boolean;
  ukupnoOblika: number;
  ukupnoGrupa: number;
  uzorciPoVrsti: Map<VrstaRijeci, string[]>;
}

export function izracunajStatistiku(rezultat: RezultatAgregacije): Statistika {
  const { agregat } = rezultat;
  const oblikaPoVrsti = new Map<VrstaRijeci, number>();
  const grupePoVrsti = new Map<VrstaRijeci, Set<string>>();
  const lemePoVrsti = new Map<VrstaRijeci, Set<string>>();
  const dvografemskihPoVrsti = new Map<VrstaRijeci, number>();
  const uzorciPoVrsti = new Map<VrstaRijeci, { uzorak: string[]; vidjeno: number }>();
  for (const vrsta of SVE_VRSTE_RIJECI) {
    oblikaPoVrsti.set(vrsta, 0);
    grupePoVrsti.set(vrsta, new Set());
    lemePoVrsti.set(vrsta, new Set());
    dvografemskihPoVrsti.set(vrsta, 0);
    uzorciPoVrsti.set(vrsta, { uzorak: [], vidjeno: 0 });
  }

  const frekvencijskiRazredi = new Map<string, number>([
    ['0', 0], ['1', 0], ['2–9', 0], ['10–99', 0], ['100–999', 0], ['1000+', 0],
  ]);
  const prviParovi = new Set<string>();
  const zavrsniParovi = new Map<string, number>();
  const sveGrupe = new Set<string>();

  for (const [oblik, podaci] of agregat) {
    prviParovi.add(podaci.prvaDva);
    zavrsniParovi.set(podaci.zadnjaDva, (zavrsniParovi.get(podaci.zadnjaDva) ?? 0) + 1);

    for (const vrsta of podaci.vrste) {
      oblikaPoVrsti.set(vrsta, oblikaPoVrsti.get(vrsta)! + 1);
      if (podaci.brojGrafema === 2) dvografemskihPoVrsti.set(vrsta, dvografemskihPoVrsti.get(vrsta)! + 1);
      const rezervoar = uzorciPoVrsti.get(vrsta)!;
      rezervoar.vidjeno += 1;
      if (rezervoar.uzorak.length < 30) rezervoar.uzorak.push(oblik);
      else if (Math.random() < 30 / rezervoar.vidjeno) rezervoar.uzorak[Math.floor(Math.random() * 30)] = oblik;
    }
    for (const grupa of podaci.grupe) {
      sveGrupe.add(grupa);
      const [vrsta, lema] = grupa.split(':') as [VrstaRijeci, string];
      grupePoVrsti.get(vrsta)!.add(grupa);
      lemePoVrsti.get(vrsta)!.add(lema);
    }

    const f = podaci.frekvencija;
    const razred = f === 0 ? '0' : f === 1 ? '1' : f < 10 ? '2–9' : f < 100 ? '10–99' : f < 1000 ? '100–999' : '1000+';
    frekvencijskiRazredi.set(razred, frekvencijskiRazredi.get(razred)! + 1);
  }

  const mrtviParovi = [...zavrsniParovi.entries()]
    .filter(([par]) => !prviParovi.has(par))
    .sort((a, b) => b[1] - a[1]);

  return {
    kategorije: SVE_VRSTE_RIJECI
      .map((vrsta) => ({
        vrsta,
        oblika: oblikaPoVrsti.get(vrsta)!,
        grupa: grupePoVrsti.get(vrsta)!.size,
        lema: lemePoVrsti.get(vrsta)!.size,
        dvografemskih: dvografemskihPoVrsti.get(vrsta)!,
      }))
      .sort((a, b) => b.oblika - a.oblika),
    frekvencijskiRazredi,
    mrtviParovi,
    oblikaNaMrtvimParovima: mrtviParovi.reduce((zbroj, [, broj]) => zbroj + broj, 0),
    ntJeMrtav: !prviParovi.has('nt'),
    ukupnoOblika: agregat.size,
    ukupnoGrupa: sveGrupe.size,
    uzorciPoVrsti: new Map([...uzorciPoVrsti].map(([vrsta, r]) => [vrsta, r.uzorak.sort()])),
  };
}

export function fmt(n: number): string {
  return n.toLocaleString('hr-HR');
}

/** Markdown izvještaj — zajednička jezgra za analizu i uvoz. */
export function izvjestajMarkdown(naslov: string, rezultat: RezultatAgregacije, statistika: Statistika): string {
  const redci: string[] = [];
  redci.push(`# ${naslov}`);
  redci.push('');
  redci.push(`Generirano: ${new Date().toISOString()}`);
  redci.push('');
  redci.push('## Obrada');
  redci.push('');
  redci.push('| Metrika | Broj |');
  redci.push('|---|---|');
  redci.push(`| Redaka u hrLexu | ${fmt(rezultat.ukupnoRedaka)} |`);
  redci.push(`| Odbačeno (UPOS: PROPN/X/SYM/PUNCT) | ${fmt(rezultat.odbaceniUpos)} |`);
  redci.push(`| Odbačeno (rimski brojevi) | ${fmt(rezultat.odbaceniRimski)} |`);
  redci.push(`| Odbačeno (čišćenje: znakovi/velika slova) | ${fmt(rezultat.odbaceniCiscenje)} |`);
  redci.push(`| Odbačeno (< 2 grafema) | ${fmt(rezultat.odbaceniMaloGrafema)} |`);
  redci.push(`| **Jedinstvenih oblika** | **${fmt(statistika.ukupnoOblika)}** |`);
  redci.push(`| Jedinstvenih grupa (leksem·stupanj) | ${fmt(statistika.ukupnoGrupa)} |`);
  redci.push(`| Redaka kroz stari filtar (Nc.sn) | ${fmt(rezultat.stariFiltar)} |`);
  redci.push('');
  redci.push('## Oblici po kategorijama (silazno)');
  redci.push('');
  redci.push('| Kategorija | Oblika | Grupa | Lema | 2-grafemskih |');
  redci.push('|---|---|---|---|---|');
  for (const { vrsta, oblika, grupa, lema, dvografemskih } of statistika.kategorije) {
    redci.push(`| ${vrsta} | ${fmt(oblika)} | ${fmt(grupa)} | ${fmt(lema)} | ${fmt(dvografemskih)} |`);
  }
  redci.push('');
  redci.push('Napomena: oblik s više kategorija broji se u svakoj (zbroj > ukupno jedinstvenih).');
  redci.push('');
  redci.push('## Frekvencijski razredi (hrWaC)');
  redci.push('');
  redci.push('| Razred | Oblika |');
  redci.push('|---|---|');
  for (const [razred, broj] of statistika.frekvencijskiRazredi) redci.push(`| ${razred} | ${fmt(broj)} |`);
  redci.push('');
  redci.push('## Mrtvi parovi (završeci bez ijednog nastavka)');
  redci.push('');
  redci.push(`- Različitih mrtvih parova: **${fmt(statistika.mrtviParovi.length)}**`);
  redci.push(`- Oblika koji završavaju na mrtav par (auto-win riječi): **${fmt(statistika.oblikaNaMrtvimParovima)}**`);
  redci.push(`- Sanity „nt" je mrtav par: **${statistika.ntJeMrtav ? 'DA ✓' : 'NE ✗ (PROBLEM — kaladont identitet!)'}**`);
  redci.push('');
  redci.push('Top 20 mrtvih parova po broju riječi koje na njih završavaju:');
  redci.push('');
  redci.push('| Par | Riječi koje tako završavaju |');
  redci.push('|---|---|');
  for (const [par, broj] of statistika.mrtviParovi.slice(0, 20)) redci.push(`| ${par} | ${fmt(broj)} |`);
  redci.push('');
  redci.push('## Nasumični uzorci po kategoriji (30 po vrsti — ljudska provjera)');
  redci.push('');
  for (const { vrsta } of statistika.kategorije) {
    redci.push(`### ${vrsta}`);
    redci.push('');
    redci.push(statistika.uzorciPoVrsti.get(vrsta)!.join(', '));
    redci.push('');
  }
  return redci.join('\n');
}
