/** Koje chunkove završnog ekrana treba učitati za dani kontekst. */

export type ZavrsniChunk =
  | 'rezultatIzazova'
  | 'iskustvo'
  | 'misije'
  | 'dnk'
  | 'panelRijeci'
  | 'panelIgraca';

export interface UlazZavrsnihChunkova {
  /** 'izazov' | 'trening' | 'javna' | 'privatna' | … */
  kontekst: string | null | undefined;
  imaXp: boolean;
  imaMisije: boolean;
  imaDnk: boolean;
  imaIgraceZaPrijavu: boolean;
  /** Idle preload tijekom partije — još nema kraj payload. */
  predvidanje?: boolean;
}

export function odaberiZavrsneChunkove(ulaz: UlazZavrsnihChunkova): ReadonlySet<ZavrsniChunk> {
  const izazov = ulaz.kontekst === 'izazov';
  const trening = ulaz.kontekst === 'trening';
  const odabrano = new Set<ZavrsniChunk>();

  if (izazov) {
    odabrano.add('rezultatIzazova');
    odabrano.add('panelRijeci');
    return odabrano;
  }

  odabrano.add('panelRijeci');

  if (ulaz.predvidanje) {
    odabrano.add('iskustvo');
    odabrano.add('misije');
    // DNK i panel igrača ne predviđamo tijekom igre — učitavaju se kad su poznati.
    return odabrano;
  }

  if (ulaz.imaXp) odabrano.add('iskustvo');
  if (ulaz.imaMisije) odabrano.add('misije');
  if (ulaz.imaDnk && !trening) odabrano.add('dnk');
  // Panel igrača: lazy na prvo otvaranje — nije u preload setu.
  void ulaz.imaIgraceZaPrijavu;

  return odabrano;
}

export function kriticniZavrsniChunkovi(ulaz: UlazZavrsnihChunkova): ReadonlySet<ZavrsniChunk> {
  const izazov = ulaz.kontekst === 'izazov';
  const kriticni = new Set<ZavrsniChunk>(['panelRijeci']);
  if (izazov) {
    kriticni.add('rezultatIzazova');
  } else if (ulaz.imaXp || ulaz.predvidanje) {
    kriticni.add('iskustvo');
  }
  return kriticni;
}
