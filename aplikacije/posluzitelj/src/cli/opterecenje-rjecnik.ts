import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { createGunzip } from 'node:zlib';
import { createInterface } from 'node:readline';

interface ZapisRijeci {
  rijec: string;
  prvaDva: string;
  grupe: string[];
}

interface ZaglavljeSnimke {
  vrsta: 'kaladont-rjecnik';
  verzija: 1;
}

export interface SnimkaRjecnika {
  brojRijeci: number;
  sha256: string;
  nasumicnaRijec: (
    prefiks: string,
    potroseneGrupe: ReadonlySet<string>,
    pokusaneRijeci: ReadonlySet<string>,
  ) => Promise<string | null>;
  grupeZaRijec: (rijec: string) => readonly string[];
}

export async function ucitajSnimkuRjecnika(putanja: string): Promise<SnimkaRjecnika> {
  const tok = createReadStream(putanja);
  const citac = createInterface({
    input: putanja.endsWith('.gz') ? tok.pipe(createGunzip()) : tok,
    crlfDelay: Infinity,
  });
  const hash = createHash('sha256');
  const poPrefiksu = new Map<string, ZapisRijeci[]>();
  const grupePoRijeci = new Map<string, readonly string[]>();
  let zaglavljeProcitano = false;
  let brojRijeci = 0;

  try {
    for await (const redak of citac) {
      if (!redak.trim()) continue;
      const zapis: unknown = JSON.parse(redak);
      if (!zaglavljeProcitano) {
        const zaglavlje = zapis as Partial<ZaglavljeSnimke>;
        if (zaglavlje.vrsta !== 'kaladont-rjecnik' || zaglavlje.verzija !== 1) {
          throw new Error('Nepodržan format snimke rječnika za load test.');
        }
        zaglavljeProcitano = true;
        continue;
      }

      if (!jeZapisRijeci(zapis)) throw new Error(`Neispravan zapis riječi na retku ${brojRijeci + 2}.`);
      hash.update(`${redak}\n`);
      grupePoRijeci.set(zapis.rijec, zapis.grupe);
      const prefiks = poPrefiksu.get(zapis.prvaDva) ?? [];
      prefiks.push(zapis);
      poPrefiksu.set(zapis.prvaDva, prefiks);
      brojRijeci += 1;
    }
  } finally {
    citac.close();
  }

  if (!zaglavljeProcitano || brojRijeci === 0) {
    throw new Error('Snimka rječnika je prazna ili nema valjano zaglavlje.');
  }

  return {
    brojRijeci,
    sha256: hash.digest('hex'),
    grupeZaRijec: (rijec) => grupePoRijeci.get(rijec) ?? [],
    async nasumicnaRijec(prefiks, potroseneGrupe, pokusaneRijeci) {
      const kandidati = poPrefiksu.get(prefiks);
      if (!kandidati?.length) return null;
      const pocetak = Math.floor(Math.random() * kandidati.length);
      for (let pomak = 0; pomak < kandidati.length; pomak += 1) {
        const kandidat = kandidati[(pocetak + pomak) % kandidati.length]!;
        if (pokusaneRijeci.has(kandidat.rijec)) continue;
        if (kandidat.grupe.some((grupa) => potroseneGrupe.has(grupa))) continue;
        return kandidat.rijec;
      }
      return null;
    },
  };
}

function jeZapisRijeci(zapis: unknown): zapis is ZapisRijeci {
  if (typeof zapis !== 'object' || zapis === null) return false;
  const vrijednost = zapis as Partial<ZapisRijeci>;
  return typeof vrijednost.rijec === 'string' &&
    vrijednost.rijec.length > 0 &&
    typeof vrijednost.prvaDva === 'string' &&
    vrijednost.prvaDva.length > 0 &&
    Array.isArray(vrijednost.grupe) &&
    vrijednost.grupe.length > 0 &&
    vrijednost.grupe.every((grupa) => typeof grupa === 'string' && grupa.length > 0);
}