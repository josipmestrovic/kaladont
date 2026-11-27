/**
 * Zajednički dohvat GET /naslovnica/sazetak za Header i naslovnicu.
 * Semantika u naslovnica-resurs.ts; ovdje hidracija profila/sandučića + Svelte stanje.
 */
import { browser } from '$app/environment';
import type {
  AvatarConfigV1,
  NaslovnicaMisijeSazetak,
  OdgovorNaslovnicaSazetka,
  SanducicPorukaDetalj,
} from 'zajednicko';
import { api, ApiGreska } from '$lib/api.js';
import { osvjeziGostSesijuNakon401 } from '$lib/identitet.js';
import {
  stvoriNaslovnicaResurs,
  type NaslovnicaResurs,
  type StatusNaslovnice,
} from '$lib/naslovnica-resurs.js';
import {
  postaviProfilIzSazetka,
  type ProfilSnapshot,
} from '$lib/stanje-profila.svelte.js';
import {
  osvjeziSazetakSanducica,
  primijeniSazetakSanducicaIzNaslovnice,
} from '$lib/stanje-sanducica.svelte.js';

export type { StatusNaslovnice };

type StanjeNaslovniceUi = {
  status: StatusNaslovnice;
  igracId: string | null;
  sazetak: OdgovorNaslovnicaSazetka | null;
  obavijestiLista: {
    poruke: SanducicPorukaDetalj[];
    sljedeciCursor: string | null;
  } | null;
};

const stanje = $state<StanjeNaslovniceUi>({
  status: 'prazno',
  igracId: null,
  sazetak: null,
  obavijestiLista: null,
});

let resurs: NaslovnicaResurs | null = null;

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
    avatarSlikaHash: p.avatarSlikaHash ?? null,
    iskustvo: p.iskustvo,
  };
}

function sinkroniziraj() {
  if (!resurs) return;
  stanje.status = resurs.status;
  stanje.igracId = resurs.igracId;
  stanje.sazetak = resurs.sazetak;
  stanje.obavijestiLista = resurs.obavijestiLista;
}

function osigurajResurs(): NaslovnicaResurs | null {
  if (!browser) return null;
  if (!resurs) {
    resurs = stvoriNaslovnicaResurs({
      api,
      oporavi401: async () => {
        await osvjeziGostSesijuNakon401({ emitirajIdentitet: false });
      },
      jeApiGreska401: (greska) => greska instanceof ApiGreska && greska.status === 401,
      naPrimjenu: (odgovor) => {
        postaviProfilIzSazetka(uProfilSnapshot(odgovor));
        if (odgovor.obavijesti) {
          primijeniSazetakSanducicaIzNaslovnice({
            brojNeprocitanih: odgovor.obavijesti.brojNeprocitanih,
            zaNajavu: odgovor.obavijesti.zaNajavu,
          });
        } else {
          // Parcijalni pad sandučića u sažetku — fallback na zasebni GET.
          void osvjeziSazetakSanducica();
        }
      },
    });
    resurs.pretplatiSe(sinkroniziraj);
    sinkroniziraj();
  }
  return resurs;
}

export function dohvatiStanjeNaslovnice() {
  osigurajResurs();
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
  osigurajResurs()?.invalidiraj();
}

export function potrosiPocetnuListuObavijesti(): {
  poruke: SanducicPorukaDetalj[];
  sljedeciCursor: string | null;
} | null {
  const aktivni = osigurajResurs();
  if (!aktivni) return null;
  const lista = aktivni.potrosiPocetnuListuObavijesti();
  sinkroniziraj();
  return lista;
}

export function azurirajAvatarNaslovnice(avatarConfig: AvatarConfigV1, avatarSlikaHash: string | null = null): void {
  osigurajResurs()?.azurirajAvatar(avatarConfig, avatarSlikaHash);
}

export function oznaciNovostiMisijaPregledane(skupine: readonly ('dnevna' | 'tjedna')[]): void {
  osigurajResurs()?.oznaciNovostiMisijaPregledane(skupine);
}

export function ukloniObavijestiIzNaslovnice(ids: readonly string[]): void {
  osigurajResurs()?.ukloniObavijestiIzListe(ids);
}

export async function osigurajNaslovnicaSazetak(
  opcije: { forsaj?: boolean; igracId?: string | null } = {},
): Promise<void> {
  const aktivni = osigurajResurs();
  if (!aktivni) return;
  await aktivni.osiguraj(opcije);
}
