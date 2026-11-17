import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Očekivanja za E2E čitaju se iz istog `izdanja.json` koji koristi web, ali se
 * sidro i hrvatski datum ovdje računaju neovisno o `aplikacije/web/src/lib/izdanja.ts`,
 * da test ne ponovi eventualnu grešku modula. Datumi i naslovi stvarnih izdanja
 * ne upisuju se u testove: PR na dan izdanja mijenja samo `izdanja.json`.
 */
export interface OcekivanoIzdanje {
  objavljeno: string;
  nastavak: number;
  naslov: string;
  sidro: string;
  datumHr: string;
}

interface SiroviZapis {
  objavljeno: string | null;
  nastavak?: number;
  naslov: string;
  stavke: string[];
}

const PUTANJA_IZDANJA = fileURLToPath(
  new URL('../../aplikacije/web/src/lib/izdanja.json', import.meta.url),
);

function procitajZapise(): SiroviZapis[] {
  return JSON.parse(readFileSync(PUTANJA_IZDANJA, 'utf8')) as SiroviZapis[];
}

/** Objavljena izdanja, od najnovijeg prema najstarijem. */
export function ocekivanaIzdanja(): OcekivanoIzdanje[] {
  return procitajZapise()
    .filter((zapis): zapis is SiroviZapis & { objavljeno: string } => zapis.objavljeno !== null)
    .map((zapis) => {
      const nastavak = zapis.nastavak ?? 0;
      const [godina, mjesec, dan] = zapis.objavljeno.split('-');
      return {
        objavljeno: zapis.objavljeno,
        nastavak,
        naslov: zapis.naslov,
        sidro: `izdanje-${zapis.objavljeno}${nastavak > 0 ? `-${nastavak}` : ''}`,
        datumHr: `${Number(dan)}. ${Number(mjesec)}. ${godina}.`,
      };
    })
    .sort((a, b) => {
      if (a.objavljeno !== b.objavljeno) return a.objavljeno < b.objavljeno ? 1 : -1;
      return b.nastavak - a.nastavak;
    });
}

/** Naslovi nacrta (`objavljeno: null`); ne smiju se pojaviti u javnom sučelju. */
export function nasloviNacrta(): string[] {
  return procitajZapise()
    .filter((zapis) => zapis.objavljeno === null)
    .map((zapis) => zapis.naslov);
}
