/**
 * Trajni sandučic: sažetak, toast najava, ACK pročitano/najavljeno.
 * Postojeći toastovi dostignuća ostaju odvojeni.
 */
import { tekstSanducicToasta, type SanducicPorukaSazetak } from 'zajednicko';
import { api } from './api.js';
import { dohvatiAuthToken } from './identitet.js';
import { dohvatiSocket } from './socket.js';

const TRAJANJE_TOASTA_MS = 6000;

let brojNeprocitanih = $state(0);
let zaNajavu = $state<SanducicPorukaSazetak[]>([]);
let toastPoruka = $state<string | null>(null);
let toastIds = $state<string[]>([]);
let toastAkcijaFokus = $state(false);
let ucitavanje: Promise<void> | null = null;
let pokrenuto = false;
let toastTimer: ReturnType<typeof setTimeout> | null = null;
let putanja = '/';
let zavrsniEkranAktivan = false;
/** Paketi već najavljeni lokalno u ovoj sesiji (prije ACK-a). */
const lokalnoNajavljeno = new Set<string>();

export function dohvatiStanjeSanducica() {
  return {
    get brojNeprocitanih() {
      return brojNeprocitanih;
    },
    get zaNajavu() {
      return zaNajavu;
    },
    get toastPoruka() {
      return toastPoruka;
    },
    get toastIds() {
      return toastIds;
    },
  };
}

export function postaviPutanjuSanducica(nova: string): void {
  putanja = nova;
  void razmotriNajavu();
}

export function postaviZavrsniEkranSanducica(aktivan: boolean): void {
  zavrsniEkranAktivan = aktivan;
  if (aktivan) zatvoriToast(false);
  void razmotriNajavu();
}

function smijeToastati(): boolean {
  if (zavrsniEkranAktivan) return false;
  if (putanja === '/red') return false;
  if (putanja.startsWith('/partija/')) return false;
  if (putanja === '/obavijesti') return false;
  return true;
}

function ocistiLokalno(): void {
  brojNeprocitanih = 0;
  zaNajavu = [];
  lokalnoNajavljeno.clear();
  zatvoriToast(false);
}

export function ocistiStanjeSanducica(): void {
  ocistiLokalno();
}

async function potvrdiNajavu(ids: string[]): Promise<void> {
  const svjeze = ids.filter((id) => !lokalnoNajavljeno.has(id));
  if (svjeze.length === 0) return;
  for (const id of svjeze) lokalnoNajavljeno.add(id);
  try {
    await api('/sanducic/najavi', {
      method: 'POST',
      body: JSON.stringify({ ids: svjeze }),
    });
    zaNajavu = zaNajavu.filter((p) => !svjeze.includes(p.id));
  } catch {
    for (const id of svjeze) lokalnoNajavljeno.delete(id);
  }
}

function zatvoriToast(potvrdi: boolean): void {
  if (toastAkcijaFokus && potvrdi === false && toastPoruka) return;
  const ids = toastIds;
  toastPoruka = null;
  toastIds = [];
  if (toastTimer !== null) {
    clearTimeout(toastTimer);
    toastTimer = null;
  }
  if (potvrdi && ids.length > 0) void potvrdiNajavu(ids);
}

export function zatvoriSanducicToast(): void {
  zatvoriToast(true);
}

export function postaviFokusSanducicToasta(fokus: boolean): void {
  toastAkcijaFokus = fokus;
}

function pokaziToast(poruke: SanducicPorukaSazetak[]): void {
  if (poruke.length === 0) return;
  const ids = poruke.map((p) => p.id);
  toastIds = ids;
  toastPoruka = tekstSanducicToasta(ids.length);
  if (toastTimer !== null) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    if (!toastAkcijaFokus) zatvoriToast(true);
  }, TRAJANJE_TOASTA_MS);
}

async function razmotriNajavu(): Promise<void> {
  const kandidati = zaNajavu.filter((p) => !lokalnoNajavljeno.has(p.id));
  if (kandidati.length === 0) return;
  if (!smijeToastati()) return;
  if (toastPoruka) return;
  pokaziToast(kandidati);
}

/** Broj za završni sažetak; ACK nakon prikaza. */
export function dohvatiBrojZaZavrsniSazetak(): number {
  return zaNajavu.filter((p) => !lokalnoNajavljeno.has(p.id)).length;
}

export async function potvrdiZavrsniSazetak(): Promise<void> {
  const ids = zaNajavu.filter((p) => !lokalnoNajavljeno.has(p.id)).map((p) => p.id);
  if (ids.length === 0) return;
  await potvrdiNajavu(ids);
}

export async function osvjeziSazetakSanducica(): Promise<void> {
  if (!dohvatiAuthToken()) {
    ocistiLokalno();
    return;
  }
  if (ucitavanje) return ucitavanje;
  ucitavanje = (async () => {
    try {
      const odgovor = await api<{ ok: true; brojNeprocitanih: number; zaNajavu: SanducicPorukaSazetak[] }>(
        '/sanducic/sazetak',
      );
      brojNeprocitanih = odgovor.brojNeprocitanih;
      zaNajavu = odgovor.zaNajavu.filter((p) => !lokalnoNajavljeno.has(p.id));
      await razmotriNajavu();
    } catch {
      // Sandučic nije kritičan za igru.
    } finally {
      ucitavanje = null;
    }
  })();
  return ucitavanje;
}

export async function oznaciSanducicProcitane(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  await api('/sanducic/procitano', {
    method: 'POST',
    body: JSON.stringify({ ids }),
  });
  for (const id of ids) lokalnoNajavljeno.add(id);
  await osvjeziSazetakSanducica();
}

export async function oznaciSavSanducicProcitanim(): Promise<void> {
  await api('/sanducic/procitano-sve', {
    method: 'POST',
    body: JSON.stringify({ doAt: new Date().toISOString() }),
  });
  await osvjeziSazetakSanducica();
}

export function pokreniSanducic(): () => void {
  if (typeof window === 'undefined' || pokrenuto) return () => {};
  pokrenuto = true;
  putanja = window.location.pathname;

  const socket = dohvatiSocket();
  const naPromjenu = () => {
    void osvjeziSazetakSanducica();
  };
  const naSpoj = () => {
    void osvjeziSazetakSanducica();
  };
  const naVidljivost = () => {
    if (document.visibilityState === 'visible') void osvjeziSazetakSanducica();
  };
  const naIdentitet = () => {
    ocistiLokalno();
    void osvjeziSazetakSanducica();
  };

  socket.on('sanducic:promjena', naPromjenu);
  socket.on('connect', naSpoj);
  document.addEventListener('visibilitychange', naVidljivost);
  window.addEventListener('kaladont:identitet-promijenjen', naIdentitet);
  void osvjeziSazetakSanducica();

  return () => {
    socket.off('sanducic:promjena', naPromjenu);
    socket.off('connect', naSpoj);
    document.removeEventListener('visibilitychange', naVidljivost);
    window.removeEventListener('kaladont:identitet-promijenjen', naIdentitet);
    ocistiLokalno();
    pokrenuto = false;
  };
}
