/**
 * Klijentski snapshot profila dijeljen između Headera i naslovnice.
 * Jedan in-flight GET /profil po ciklusu; invalidacija pri promjeni identiteta.
 */
import { api, ApiGreska } from '$lib/api.js';
import { osvjeziGostSesijuNakon401 } from '$lib/identitet.js';
import {
  stvoriProfilResurs,
  type ProfilSnapshot,
  type StatusProfila,
} from '$lib/profil-resurs.js';
import type { AvatarConfigV1 } from 'zajednicko';

const resurs = stvoriProfilResurs({
  api,
  oporavi401: () => osvjeziGostSesijuNakon401({ emitirajIdentitet: false }),
  jeApiGreska401: (greska) => greska instanceof ApiGreska && greska.status === 401,
});

export let profil = $state<ProfilSnapshot | null>(null);
export let statusProfila = $state<StatusProfila>('prazno');

function sinkroniziraj() {
  profil = resurs.snapshot;
  statusProfila = resurs.status;
}

resurs.pretplatiSe(sinkroniziraj);
sinkroniziraj();

export function osigurajProfil(opcije?: { forsaj?: boolean; pokusaji?: number }): Promise<void> {
  return resurs.osiguraj(opcije);
}

export function invalidirajProfil(): void {
  resurs.invalidiraj();
}

export function azurirajAvatarProfila(avatarConfig: AvatarConfigV1): void {
  resurs.azurirajAvatar(avatarConfig);
}

export type { ProfilSnapshot, StatusProfila };
