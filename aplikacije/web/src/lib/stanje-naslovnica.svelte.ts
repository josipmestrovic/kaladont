/**
 * Zajednički dohvat GET /naslovnica/sazetak za Header i naslovnicu.
 * Deduplikacija in-flight zahtjeva, zaštita od zastarjelih odgovora i miješanja korisnika.
 */
import { browser } from '$app/environment';
import type {
  NaslovnicaMisijeSazetak,
  OdgovorNaslovnicaSazetka,
  SanducicPorukaDetalj,
} from 'zajednicko';
import { api, ApiGreska } from '$lib/api.js';
import { osvjeziGostSesijuNakon401 } from '$lib/identitet.js';
import {
  postaviProfilIzSazetka,
  type ProfilSnapshot,
} from '$lib/stanje-profila.svelte.js';
import { primijeniSazetakSanducicaIzNaslovnice } from '$lib/stanje-sanducica.svelte.js';

export type StatusNaslovnice = 'prazno' | 'ucitavanje' | 'spreman' | 'greska';

type StanjeNaslovnice = {
  status: StatusNaslovnice;
  igracId: string | null;
  sazetak: OdgovorNaslovnicaSazetka | null;
  /** Početna stranica nepročitanih za NaslovnicaObavijesti. */
  obavijestiLista: {
    poruke: SanducicPorukaDetalj[];
    sljedeciCursor: string | null;
  } | null;
};

const stanje = $state<StanjeNaslovnice>({
  status: 'prazno',
  igracId: null,
  sazetak: null,
  obavijestiLista: null,
});

let generacija = 0;
let inFlight: Promise<void> | null = null;
let igracIdZahtjeva: string | null = null;

function uProfilSnapshot(sazetak: OdgovorNaslovnicaSazetka): ProfilSnapshot {
  const p = sazetak.profil;
  return {
    nadimak: p.nadimak,
    avatarId: p.avatarId,
    rang: p.rang,
    rang1v1: p.rang1v1,
    email: p.email,
    vrsta: p.vrsta,
    avatarConfig: p.avatarConfig,
    iskustvo: p.iskustvo,
  };
}

function primijeniOdgovor(odgovor: OdgovorNaslovnicaSazetka): void {
  stanje.sazetak = odgovor;
  stanje.igracId = odgovor.igracId;
  stanje.status = 'spreman';
  stanje.obavijestiLista = {
    poruke: odgovor.obavijesti.neprocitane,
    sljedeciCursor: odgovor.obavijesti.sljedeciCursor,
  };
  postaviProfilIzSazetka(uProfilSnapshot(odgovor));
  primijeniSazetakSanducicaIzNaslovnice({
    brojNeprocitanih: odgovor.obavijesti.brojNeprocitanih,
    zaNajavu: odgovor.obavijesti.zaNajavu,
  });
}

async function dohvati(mojaGeneracija: number, ocekivaniIgracId: string | null): Promise<void> {
  if (!stanje.sazetak) {
    stanje.status = 'ucitavanje';
  }

  let oporavakOdrađen = false;
  let pokusaj = 0;
  const maxPokusaja = 3;
  while (pokusaj < maxPokusaja) {
    if (mojaGeneracija !== generacija) return;
    try {
      const odgovor = await api<OdgovorNaslovnicaSazetka>('/naslovnica/sazetak');
      if (mojaGeneracija !== generacija) return;
      if (ocekivaniIgracId && odgovor.igracId !== ocekivaniIgracId) return;
      if (igracIdZahtjeva && odgovor.igracId !== igracIdZahtjeva && mojaGeneracija === generacija) {
        // Identitet se promijenio tijekom leta — zanemari.
        return;
      }
      primijeniOdgovor(odgovor);
      return;
    } catch (greska) {
      if (mojaGeneracija !== generacija) return;
      if (!oporavakOdrađen && greska instanceof ApiGreska && greska.status === 401) {
        oporavakOdrađen = true;
        await osvjeziGostSesijuNakon401({ emitirajIdentitet: false }).catch(() => {});
        if (mojaGeneracija !== generacija) return;
        continue;
      }
      pokusaj += 1;
      if (pokusaj < maxPokusaja) await new Promise((r) => setTimeout(r, 250 * pokusaj));
    }
  }
  if (mojaGeneracija !== generacija) return;
  // Zadrži zadnji uspješan sažetak pri mrežnoj grešci.
  if (!stanje.sazetak) stanje.status = 'greska';
  else stanje.status = 'spreman';
}

export function dohvatiStanjeNaslovnice() {
  return {
    get status() {
      return stanje.status;
    },
    get igracId() {
      return stanje.igracId;
    },
    get sazetak() {
      return stanje.sazetak;
    },
    get misije(): NaslovnicaMisijeSazetak | null {
      return stanje.sazetak?.misije ?? null;
    },
    get obavijestiLista() {
      return stanje.obavijestiLista;
    },
  };
}

export function invalidirajNaslovnicaSazetak(): void {
  generacija += 1;
  inFlight = null;
  igracIdZahtjeva = null;
  stanje.status = 'prazno';
  stanje.igracId = null;
  stanje.sazetak = null;
  stanje.obavijestiLista = null;
}

export function potrosiPocetnuListuObavijesti(): {
  poruke: SanducicPorukaDetalj[];
  sljedeciCursor: string | null;
} | null {
  const lista = stanje.obavijestiLista;
  stanje.obavijestiLista = null;
  return lista;
}

export async function osigurajNaslovnicaSazetak(
  opcije: { forsaj?: boolean; igracId?: string | null } = {},
): Promise<void> {
  if (!browser) return;

  if (opcije.forsaj) {
    generacija += 1;
    if (inFlight) await inFlight.catch(() => {});
    if (inFlight) {
      await inFlight;
      return;
    }
  } else if (inFlight) {
    await inFlight;
    return;
  } else if (stanje.status === 'spreman' && stanje.sazetak) {
    if (!opcije.igracId || stanje.igracId === opcije.igracId) return;
  }

  const mojaGeneracija = generacija;
  igracIdZahtjeva = opcije.igracId ?? stanje.igracId;
  const ovaj = dohvati(mojaGeneracija, opcije.igracId ?? null);
  inFlight = ovaj;
  try {
    await ovaj;
  } finally {
    if (inFlight === ovaj) inFlight = null;
  }
}
