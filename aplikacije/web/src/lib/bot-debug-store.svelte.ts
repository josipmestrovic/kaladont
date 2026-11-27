import type { BotDebugZapis } from 'zajednicko';

const MAKS_ZAPISA = 100;

let zapisi = $state<BotDebugZapis[]>([]);
let otvoren = $state(false);
let pauza = $state(false);
let pretplacen = $state(false);

export function botDebugZapisi(): readonly BotDebugZapis[] {
  return zapisi;
}

export function botDebugOtvoren(): boolean {
  return otvoren;
}

export function botDebugPauza(): boolean {
  return pauza;
}

export function botDebugPretplacen(): boolean {
  return pretplacen;
}

export function postaviBotDebugOtvoren(v: boolean): void {
  otvoren = v;
}

export function postaviBotDebugPauza(v: boolean): void {
  pauza = v;
}

export function postaviBotDebugPretplacen(v: boolean): void {
  pretplacen = v;
}

export function dodajBotDebugZapis(zapis: BotDebugZapis): void {
  if (pauza) return;
  const bezIstog = zapisi.filter(
    (z) => !(z.turnToken === zapis.turnToken && z.pokusaj === zapis.pokusaj && z.igracId === zapis.igracId),
  );
  zapisi = [zapis, ...bezIstog].slice(0, MAKS_ZAPISA);
}

export function ocistiBotDebugZapise(): void {
  zapisi = [];
}

export function resetirajBotDebugZaPartiju(): void {
  zapisi = [];
  otvoren = false;
  pauza = false;
  pretplacen = false;
}

export function botDebugKaoTekst(): string {
  return zapisi
    .map((z) => {
      const glava = `[${z.nadimak} / ${z.profil}] ${z.trazenaSlova} token=${z.turnToken} pokušaj=${z.pokusaj}`;
      const tijelo = z.linije.join('\n');
      const rez = z.rezultat.rijec
        ? `→ ${z.rezultat.rijec} (${z.rezultat.izvor ?? '?'}) ${z.rezultat.ishodMotora ?? ''}`
        : `→ ${z.posebnaOdluka ?? z.rezultat.ishodMotora ?? '?'}`;
      return `${glava}\n${tijelo}\n${rez}`;
    })
    .join('\n\n');
}
