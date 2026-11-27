import { createHash } from 'node:crypto';
import { kanonskiZapisAvatara, validirajAvatarConfig, type AvatarConfigV1 } from 'zajednicko';

/** SHA-256 kanonskog zapisa konfiguracije i verzije renderera. */
export function hashAvataraConfig(config: AvatarConfigV1): string {
  return createHash('sha256').update(kanonskiZapisAvatara(config)).digest('hex');
}

/** Hash za klijentski WebP. Nevaljana konfiguracija nema sliku. */
export function hashSlikeAvatara(config: unknown): string | null {
  if (!validirajAvatarConfig(config)) return null;
  return hashAvataraConfig(config);
}
