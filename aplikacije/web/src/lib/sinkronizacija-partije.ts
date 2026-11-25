/**
 * Korelirana sinkronizacija partije (#142 D).
 * Jedan postupak po partiji; ne ubija zdravu Socket.IO vezu.
 */
import type { PotvrdaNaredbePoteza, StanjePartije } from 'zajednicko';
import type { KaladontSocket } from './socket.js';
import {
  odlukaNakonSyncSnimke,
  pomakSataIzRtt,
  sljedecaSpremnostPartije,
} from './spremnost-partije.js';
import { postaviSpremnostPartije, stanjeVeze } from './stanje-veze.svelte.js';

export type OdgovorPartijaStanje = {
  snimka: StanjePartije | null;
  potvrdaNaredbe?: PotvrdaNaredbePoteza;
  razlog?: string;
};

type AktivniSync = {
  partijaId: string;
  requestId?: string;
};

let aktivniSync: AktivniSync | null = null;
/** Najbolji uzorak pomaka sata (ms); pasivne poruke ne smiju pregaziti kvalitetniji. */
let pomakSataMs = 0;
let imaKvalitetanPomak = false;

export function dohvatiPomakSataMs(): number {
  return pomakSataMs;
}

export function imaUzorakSata(): boolean {
  return imaKvalitetanPomak;
}

export function syncUTijekuZa(partijaId: string): boolean {
  return aktivniSync?.partijaId === partijaId;
}

export async function sinkronizirajPartiju(ulaz: {
  socket: KaladontSocket;
  partijaId: string;
  requestId?: string;
  aktivniTurnToken?: string | null;
  naSnimku?: (snimka: StanjePartije) => void;
  naPotvrdu?: (potvrda: PotvrdaNaredbePoteza) => void;
  naOcistiNaredbu?: () => void;
}): Promise<{
  ok: boolean;
  odluka: ReturnType<typeof odlukaNakonSyncSnimke> | null;
  odgovor: OdgovorPartijaStanje | null;
}> {
  if (aktivniSync?.partijaId === ulaz.partijaId) {
    return { ok: false, odluka: null, odgovor: null };
  }

  aktivniSync = { partijaId: ulaz.partijaId, requestId: ulaz.requestId };
  postaviSpremnostPartije(sljedecaSpremnostPartije({
    trenutna: stanjeVeze.spremnostPartije,
    dogadaj: 'sync_start',
  }));

  const payload = {
    partijaId: ulaz.partijaId,
    ...(ulaz.requestId ? { requestId: ulaz.requestId } : {}),
  };
  // Wall-clock (Date.now), ne performance.now — pomak se uspoređuje s Date.parse(ISO).
  const t0 = Date.now();

  try {
    const odgovor = await new Promise<OdgovorPartijaStanje>((resolve, reject) => {
      ulaz.socket
        .timeout(5_000)
        .emit('partija:stanje', payload, (greska: Error | null, odg?: OdgovorPartijaStanje) => {
          if (greska) {
            reject(greska);
            return;
          }
          resolve(odg ?? { snimka: null, razlog: 'PRAZAN_ACK' });
        });
    });

    const t1 = Date.now();
    const snimka = odgovor.snimka;
    if (snimka?.serverVrijemeIso) {
      pomakSataMs = pomakSataIzRtt({
        serverVrijemeIso: snimka.serverVrijemeIso,
        klijentSlanjeMs: t0,
        klijentPrijemMs: t1,
      });
      imaKvalitetanPomak = true;
    }

    if (!snimka) {
      if (odgovor.razlog === 'NEMA_PARTIJE') {
        postaviSpremnostPartije('nedostupna');
      } else {
        postaviSpremnostPartije(sljedecaSpremnostPartije({
          trenutna: stanjeVeze.spremnostPartije,
          dogadaj: 'sync_fail',
        }));
      }
      return { ok: false, odluka: null, odgovor };
    }

    ulaz.naSnimku?.(snimka);

    const odluka = odlukaNakonSyncSnimke({
      aktivniRequestId: ulaz.requestId ?? null,
      aktivniTurnToken: ulaz.aktivniTurnToken ?? null,
      snimkaTurnToken: snimka.turnToken,
      potvrdaZaRequestId: Boolean(odgovor.potvrdaNaredbe),
    });

    if (odluka === 'primijeni_potvrdu' && odgovor.potvrdaNaredbe) {
      ulaz.naPotvrdu?.(odgovor.potvrdaNaredbe);
    } else if (odluka === 'prihvati_snimku') {
      ulaz.naOcistiNaredbu?.();
    }

    postaviSpremnostPartije('spremna');
    return { ok: true, odluka, odgovor };
  } catch {
    postaviSpremnostPartije(sljedecaSpremnostPartije({
      trenutna: stanjeVeze.spremnostPartije,
      dogadaj: 'sync_fail',
    }));
    return { ok: false, odluka: null, odgovor: null };
  } finally {
    aktivniSync = null;
  }
}

/** Pasivni emit bez ACK — ne pregazi RTT uzorak. */
export function biljeziPasivniServerVrijeme(serverVrijemeIso: string): void {
  if (imaKvalitetanPomak) return;
  const serverMs = Date.parse(serverVrijemeIso);
  if (!Number.isFinite(serverMs)) return;
  pomakSataMs = serverMs - Date.now();
}
