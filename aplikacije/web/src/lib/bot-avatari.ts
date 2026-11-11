/**
 * Katalog namjenskih bot ilustracija (redom 01→20).
 * Dodjela: hash(igracId) % N — ciklus kroz katalog, isti ID → isti avatar.
 */
export const BOT_AVATAR_PUTANJE: readonly string[] = [
  '/avatari/botovi/01-skafander.webp',
  '/avatari/botovi/02-pastoljub.webp',
  '/avatari/botovi/03-brko-na-struju.webp',
  '/avatari/botovi/04-disketas.webp',
  '/avatari/botovi/05-propelerko.webp',
  '/avatari/botovi/06-kvacica.webp',
  '/avatari/botovi/07-burek-na-vezi.webp',
  '/avatari/botovi/08-ronilac-na-suhom.webp',
  '/avatari/botovi/09-lektorka.webp',
  '/avatari/botovi/10-smetalo.webp',
  '/avatari/botovi/11-kazetko.webp',
  '/avatari/botovi/12-spavalica.webp',
  '/avatari/botovi/13-ekspres-lonac.webp',
  '/avatari/botovi/14-harmonikas.webp',
  '/avatari/botovi/15-periskop.webp',
  '/avatari/botovi/16-trubimir.webp',
  '/avatari/botovi/17-jednooki-signal.webp',
  '/avatari/botovi/18-magnetko.webp',
  '/avatari/botovi/19-carapa-na-anteni.webp',
  '/avatari/botovi/20-gramofonko.webp',
];

function hashIdentiteta(identitet: string): number {
  let h = 2166136261;
  for (let i = 0; i < identitet.length; i += 1) {
    h ^= identitet.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministička putanja avatara za bota; null ako katalog još nije popunjen. */
export function putanjaBotAvatara(igracId: string): string | null {
  if (BOT_AVATAR_PUTANJE.length === 0) return null;
  const indeks = hashIdentiteta(igracId) % BOT_AVATAR_PUTANJE.length;
  return BOT_AVATAR_PUTANJE[indeks] ?? null;
}
