/**
 * Klijentski snapshot profila dijeljen između Headera i naslovnice.
 * Jedan in-flight GET /profil po ciklusu; invalidacija pri promjeni identiteta.
 * Samo u browseru — bez SSR mutable singletona.
 */
import { browser } from '$app/environment';
import { api, ApiGreska } from '$lib/api.js';
import { osvjeziGostSesijuNakon401 } from '$lib/identitet.js';
import {
  stvoriProfilResurs,
  type ProfilResurs,
  type ProfilSnapshot,
  type StatusProfila,
} from '$lib/profil-resurs.js';
import type { AvatarConfigV1 } from 'zajednicko';

/** Mutirajuća kutija — Svelte ne dopušta reassign exportanog `$state`. */
export const stanjeProfila = $state<{
  profil: ProfilSnapshot | null;
  status: StatusProfila;
}>({
  profil: null,
  status: 'prazno',
});

let resurs: ProfilResurs | null = null;

function sinkroniziraj() {
  if (!resurs) return;
  stanjeProfila.profil = resurs.snapshot;
  stanjeProfila.status = resurs.status;
}

function osigurajResurs(): ProfilResurs | null {
  if (!browser) return null;
  if (!resurs) {
    resurs = stvoriProfilResurs({
      api,
      oporavi401: () => osvjeziGostSesijuNakon401({ emitirajIdentitet: false }),
      jeApiGreska401: (greska) => greska instanceof ApiGreska && greska.status === 401,
    });
    resurs.pretplatiSe(sinkroniziraj);
    sinkroniziraj();
  }
  return resurs;
}

export function osigurajProfil(opcije?: { forsaj?: boolean; pokusaji?: number }): Promise<void> {
  const aktivni = osigurajResurs();
  if (!aktivni) return Promise.resolve();
  return aktivni.osiguraj(opcije);
}

export function invalidirajProfil(): void {
  osigurajResurs()?.invalidiraj();
}

export function azurirajAvatarProfila(avatarConfig: AvatarConfigV1): void {
  osigurajResurs()?.azurirajAvatar(avatarConfig);
}

export type { ProfilSnapshot, StatusProfila };
