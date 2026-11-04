import type { MetrikeMisijaIgre } from 'zajednicko';
import { jeTopDvaCetverobojMisija } from 'zajednicko';
import { zagrebackiDatumIso } from './kalendar.js';
import type { PodstanjeMisije, SnapshotMisije } from './tipovi.js';

export function smijePrimitiMisijskiNapredak(metrike: MetrikeMisijaIgre): boolean {
  if (metrike.prihvaceneRijeci < 1) return false;
  if (metrike.nacinIspadanja === 'prekid') return false;
  return true;
}

export function misijaOdgovaraKontekstu(snapshot: SnapshotMisije, metrike: MetrikeMisijaIgre): boolean {
  if (snapshot.kontekst === 'trening') return metrike.kontekst === 'trening';
  if (metrike.kontekst !== 'javna') return false;
  if (snapshot.mod === 'oba') return true;
  return snapshot.mod === metrike.mod;
}

function plasmanCiljIspunjen(predlozakId: string, metrike: MetrikeMisijaIgre): boolean {
  if (jeTopDvaCetverobojMisija(predlozakId)) {
    return metrike.mod === 'cetiri_igraca' && metrike.plasman >= 1 && metrike.plasman <= 2;
  }
  return metrike.plasman === 1;
}

export interface PrimjenaMetrike {
  noviNapredak: number;
  novoPodstanje: PodstanjeMisije;
  deltaOpis: Record<string, unknown>;
}

/**
 * Primijeni jednu igru na jednu dodjelu (snapshot + trenutni napredak/podstanje).
 * Ne prelazi cilj. Vraća isti napredak ako metrika ne raste.
 */
export function primijeniMetrikuNaDodjelu(ulaz: {
  predlozakId: string;
  snapshot: SnapshotMisije;
  napredak: number;
  podstanje: PodstanjeMisije;
  metrike: MetrikeMisijaIgre;
}): PrimjenaMetrike {
  const { snapshot, metrike } = ulaz;
  const cilj = snapshot.cilj;
  let napredak = ulaz.napredak;
  const podstanje: PodstanjeMisije = {
    podciljevi: { ...(ulaz.podstanje.podciljevi ?? {}) },
    dani: [...(ulaz.podstanje.dani ?? [])],
    poceci: [...(ulaz.podstanje.poceci ?? [])],
  };
  const delta: Record<string, unknown> = { metrika: snapshot.metrika };

  if (!misijaOdgovaraKontekstu(snapshot, metrike)) {
    return { noviNapredak: napredak, novoPodstanje: ulaz.podstanje, deltaOpis: { ...delta, preskoceno: 'kontekst' } };
  }

  switch (snapshot.metrika) {
    case 'partije':
      napredak = Math.min(cilj, napredak + 1);
      delta.delta = 1;
      break;
    case 'pobjede':
    case 'trening_pobjede':
      if (plasmanCiljIspunjen(ulaz.predlozakId, metrike)) {
        napredak = Math.min(cilj, napredak + 1);
        delta.delta = 1;
      }
      break;
    case 'rijeci':
      napredak = Math.min(cilj, napredak + metrike.prihvaceneRijeci);
      delta.delta = metrike.prihvaceneRijeci;
      break;
    case 'niz_max':
      napredak = Math.min(cilj, Math.max(napredak, metrike.najduziNiz));
      delta.najduziNiz = metrike.najduziNiz;
      break;
    case 'rijeci_u_partiji_max':
      napredak = Math.min(cilj, Math.max(napredak, metrike.prihvaceneRijeci));
      delta.prihvaceneRijeci = metrike.prihvaceneRijeci;
      break;
    case 'partije_s_nizom': {
      const prag = snapshot.pragMetrike ?? 5;
      if (metrike.najduziNiz >= prag) {
        napredak = Math.min(cilj, napredak + 1);
        delta.delta = 1;
      }
      break;
    }
    case 'partije_s_rijecima': {
      const prag = snapshot.pragMetrike ?? 3;
      if (metrike.prihvaceneRijeci >= prag) {
        napredak = Math.min(cilj, napredak + 1);
        delta.delta = 1;
      }
      break;
    }
    case 'duge':
      napredak = Math.min(cilj, napredak + metrike.dugeRijeci);
      delta.delta = metrike.dugeRijeci;
      break;
    case 'jako_duge':
      napredak = Math.min(cilj, napredak + metrike.jakoDugeRijeci);
      delta.delta = metrike.jakoDugeRijeci;
      break;
    case 'rijetke':
      napredak = Math.min(cilj, napredak + metrike.rijetkeRijeci);
      delta.delta = metrike.rijetkeRijeci;
      break;
    case 'jako_rijetke':
      napredak = Math.min(cilj, napredak + metrike.jakoRijetkeRijeci);
      delta.delta = metrike.jakoRijetkeRijeci;
      break;
    case 'duge_i_rijetke':
      napredak = Math.min(cilj, napredak + metrike.dugeIRijetkeRijeci);
      delta.delta = metrike.dugeIRijetkeRijeci;
      break;
    case 'eliminacije':
      napredak = Math.min(cilj, napredak + metrike.eliminacije);
      delta.delta = metrike.eliminacije;
      break;
    case 'kaladont':
      napredak = Math.min(cilj, napredak + metrike.kaladontIzvedbe);
      delta.delta = metrike.kaladontIzvedbe;
      break;
    case 'razliciti_poceci': {
      const set = new Set(podstanje.poceci);
      for (const p of metrike.razlicitiPoceci) set.add(p);
      podstanje.poceci = [...set].slice(0, Math.max(cilj, 20));
      napredak = Math.min(cilj, set.size);
      delta.poceci = podstanje.poceci.length;
      break;
    }
    case 'dani': {
      const dan = zagrebackiDatumIso(metrike.zavrsenoU);
      if (!podstanje.dani!.includes(dan)) podstanje.dani!.push(dan);
      napredak = Math.min(cilj, podstanje.dani!.length);
      delta.dani = podstanje.dani;
      break;
    }
    case 'oba_moda': {
      const kljuc = metrike.mod;
      const defPod = snapshot.podciljevi?.find((p) => p.kljuc === kljuc);
      if (defPod) {
        const trenutno = podstanje.podciljevi![kljuc] ?? 0;
        podstanje.podciljevi![kljuc] = Math.min(defPod.cilj, trenutno + 1);
      }
      napredak = Math.min(
        cilj,
        (snapshot.podciljevi ?? []).reduce((suma, p) => suma + Math.min(p.cilj, podstanje.podciljevi![p.kljuc] ?? 0), 0),
      );
      delta.podciljevi = podstanje.podciljevi;
      break;
    }
    default:
      break;
  }

  return { noviNapredak: napredak, novoPodstanje: podstanje, deltaOpis: delta };
}
