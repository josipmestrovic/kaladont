import type { WilsonInterval } from './tipovi.js';

export function postotak(vrijednost: number | null): string {
  if (vrijednost === null) return '—';
  return `${vrijednost.toFixed(1)} %`;
}

export function formatMs(ms: number | null): string {
  if (ms === null) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export function formatSekundi(sekunde: number | null): string {
  if (sekunde === null) return '—';
  if (sekunde < 60) return `${sekunde.toFixed(0)} s`;
  return `${(sekunde / 60).toFixed(1)} min`;
}

export function nazivKonteksta(k: string): string {
  if (k === 'javna') return 'Brza igra';
  if (k === 'privatna') return 'Privatne sobe';
  if (k === 'trening') return 'Trening';
  if (k === 'izazov') return 'Izazovi';
  return k;
}

export function nazivModa(m: string): string {
  if (m === 'dva_igraca') return 'Dvoboj';
  if (m === 'tri_igraca') return 'Troboj';
  if (m === 'cetiri_igraca') return 'Četveroboj';
  return m;
}

export function nazivPravila(p: string): string {
  if (p === 'klasicni') return 'Klasični';
  if (p === 'ka_zna') return 'KA-ZNA';
  if (p === 'dokazi_nastavak') return 'Dokaži nastavak';
  if (p === 'nepoznato') return 'Nepoznato';
  return p;
}

export function nazivIshodaCekanja(i: string): string {
  if (i === 'uparivanje') return 'Uparivanje';
  if (i === 'napustanje') return 'Napuštanje';
  if (i === 'prekid_veze') return 'Prekid veze';
  if (i === 'promjena_reda') return 'Promjena reda';
  if (i === 'uklonjen') return 'Uklonjen';
  return i;
}

export function wilsonTekst(w: WilsonInterval | null): string {
  if (!w) return '—';
  return `${w.low.toFixed(1)}–${w.high.toFixed(1)} %`;
}

export function retencijaTekst(
  postotakVrijednost: number | null,
  povratnici: number,
  kohorta: number,
): string {
  if (postotakVrijednost === null) return 'Još nema dovoljno podataka';
  return `${povratnici} / ${kohorta} (${postotak(postotakVrijednost)})`;
}

export function neprimjenjivoIli(tekst: string, dostupno: boolean): string {
  return dostupno ? tekst : 'Nije primjenjivo';
}
