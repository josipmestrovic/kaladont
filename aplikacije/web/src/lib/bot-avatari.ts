/**
 * Namjenske bot ilustracije: stabilni lookup po nadimku iz zajedničkog kataloga.
 * Nepoznati povijesni botovi padaju na hash(igracId) kroz isti katalog putanja.
 */
import { putanjaIlustracijeBota } from 'zajednicko';

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

export type UlazBotAvatara = {
  jeBot: boolean;
  nadimak?: string | null;
  igracId?: string | null;
};

/**
 * Putanja bot ilustracije samo kad je `jeBot` autoritativno true.
 * Ljudski igrač s „BOT” u nadimku zadržava vlastiti avatar (vraća null).
 */
export function putanjaBotAvatara(ulaz: UlazBotAvatara | string): string | null {
  if (BOT_AVATAR_PUTANJE.length === 0) return null;

  // Legacy: samo igracId string → hash fallback (povijesni pozivi / testovi).
  if (typeof ulaz === 'string') {
    const indeks = hashIdentiteta(ulaz) % BOT_AVATAR_PUTANJE.length;
    return BOT_AVATAR_PUTANJE[indeks] ?? null;
  }

  if (!ulaz.jeBot) return null;

  const izKataloga = putanjaIlustracijeBota(ulaz.nadimak);
  if (izKataloga) return izKataloga;

  if (!ulaz.igracId) return BOT_AVATAR_PUTANJE[0] ?? null;
  const indeks = hashIdentiteta(ulaz.igracId) % BOT_AVATAR_PUTANJE.length;
  return BOT_AVATAR_PUTANJE[indeks] ?? null;
}
