/**
 * Red osobnih obavijesti o otključanim dostignućima.
 * Vuče nepročitane na ulazu, reconnectu i povratku na karticu, te sluša socket.
 */
import type { NovostiDostignuca, ObavijestOtkljucanogDostignuca } from 'zajednicko';
import { api } from './api.js';
import { pustiAudio } from './audio-manager.js';
import { jeRegistriranKorisnik } from './identitet.js';
import { dohvatiSocket } from './socket.js';

const MAKSIMALNO_VIDLJIVIH = 3;
const TRAJANJE_MS = 4500;

let stavke = $state<ObavijestOtkljucanogDostignuca[]>([]);
const poznati = new Set<string>();
const potvrdeni = new Set<string>();
let red: ObavijestOtkljucanogDostignuca[] = [];
let pokrenuto = false;
let ucitavanje: Promise<void> | null = null;

export function dohvatiRedDostignuca() {
  return {
    get stavke() {
      return stavke;
    },
  };
}

function prikaziJos(): boolean {
  const prije = stavke.length;
  while (stavke.length < MAKSIMALNO_VIDLJIVIH && red.length > 0) {
    const sljedeca = red.shift();
    if (!sljedeca) break;
    stavke = [...stavke, sljedeca];
    void potvrdi([sljedeca.id]);
    window.setTimeout(() => zatvoriDostignuce(sljedeca.id), TRAJANJE_MS);
  }
  return stavke.length > prije;
}

export function ubaciObavijestiDostignuca(nove: readonly ObavijestOtkljucanogDostignuca[]): void {
  const svjeze = nove.filter((obavijest) => obavijest.id && !poznati.has(obavijest.id));
  if (svjeze.length === 0) return;
  for (const obavijest of svjeze) poznati.add(obavijest.id);
  red.push(...svjeze);
  if (prikaziJos()) pustiAudio('dostignuce-otkljucano');
}

export function zatvoriDostignuce(id: string): void {
  if (!stavke.some((stavka) => stavka.id === id)) return;
  stavke = stavke.filter((stavka) => stavka.id !== id);
  prikaziJos();
}

export function ocistiObavijestiDostignuca(): void {
  poznati.clear();
  potvrdeni.clear();
  red = [];
  stavke = [];
}

async function potvrdi(ids: string[]): Promise<void> {
  const nepotvrdene = ids.filter((id) => !potvrdeni.has(id));
  if (nepotvrdene.length === 0) return;
  for (const id of nepotvrdene) potvrdeni.add(id);
  try {
    await api('/dostignuca/obavijesti/potvrdi', {
      method: 'POST',
      body: JSON.stringify({ ids: nepotvrdene }),
    });
  } catch {
    for (const id of nepotvrdene) potvrdeni.delete(id);
  }
}

async function ucitajNepotvrdene(): Promise<void> {
  if (!jeRegistriranKorisnik()) return;
  if (ucitavanje) return ucitavanje;
  ucitavanje = (async () => {
    try {
      const odgovor = await api<{ ok: true; obavijesti: ObavijestOtkljucanogDostignuca[] }>('/dostignuca/obavijesti');
      ubaciObavijestiDostignuca(odgovor.obavijesti);
      const nepotvrdeneNaEkranu = stavke.filter((stavka) => !potvrdeni.has(stavka.id)).map((stavka) => stavka.id);
      if (nepotvrdeneNaEkranu.length > 0) await potvrdi(nepotvrdeneNaEkranu);
    } catch {
      // Igra radi i bez pinga; sljedeći reconnect ili vidljivost pokušava ponovo.
    } finally {
      ucitavanje = null;
    }
  })();
  return ucitavanje;
}

export function pokreniObavijestiDostignuca(): () => void {
  if (typeof window === 'undefined' || pokrenuto) return () => {};
  pokrenuto = true;

  const socket = dohvatiSocket();
  const naNovosti = (payload: NovostiDostignuca) => ubaciObavijestiDostignuca(payload.obavijesti ?? []);
  const naSpoj = () => { void ucitajNepotvrdene(); };
  const naVidljivost = () => {
    if (document.visibilityState === 'visible') void ucitajNepotvrdene();
  };
  const naIdentitet = () => {
    ocistiObavijestiDostignuca();
    void ucitajNepotvrdene();
  };

  socket.on('dostignuca:novosti', naNovosti);
  socket.on('connect', naSpoj);
  document.addEventListener('visibilitychange', naVidljivost);
  window.addEventListener('kaladont:identitet-promijenjen', naIdentitet);
  void ucitajNepotvrdene();

  return () => {
    socket.off('dostignuca:novosti', naNovosti);
    socket.off('connect', naSpoj);
    document.removeEventListener('visibilitychange', naVidljivost);
    window.removeEventListener('kaladont:identitet-promijenjen', naIdentitet);
    ocistiObavijestiDostignuca();
    pokrenuto = false;
  };
}
