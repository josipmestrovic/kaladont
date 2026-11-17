import sirovaIzdanja from './izdanja.json';

/**
 * Javna izdanja Kaladonta (ADR-018). Jedini izvor istine je `izdanja.json`:
 * iz njega čitaju stranica Novosti i naslovnica, a `skripte/izdanja/` iz istih
 * podataka izvode Git oznaku i GitHub Release. Pravila izvođenja (`sidro`,
 * `oznaka`) moraju ostati jednaka onima u `skripte/izdanja/izdanja.jq`.
 */
export interface Izdanje {
  /** `2026-11-23`, odnosno `2026-11-23-1` za drugo izdanje istoga dana. */
  id: string;
  /** Dan produkcijske objave u zoni Europe/Zagreb, oblika `YYYY-MM-DD`. */
  objavljeno: string;
  /** 0 za prvo izdanje dana, 1 za drugo, 2 za treće… */
  nastavak: number;
  naslov: string;
  stavke: readonly string[];
  /** HTML sidro zapisa na stranici Novosti. */
  sidro: string;
  /** Git oznaka izdanja; ne prikazuje se u javnom sučelju. */
  oznaka: string;
  /** Datum za prikaz, npr. `23. 11. 2026.` */
  datumHr: string;
}

const OBLIK_DATUMA = /^(\d{4})-(\d{2})-(\d{2})$/;
const DOPUSTENA_POLJA = new Set(['objavljeno', 'nastavak', 'naslov', 'stavke']);

function rastaviDatum(iso: string): { godina: number; mjesec: number; dan: number } | null {
  const dijelovi = OBLIK_DATUMA.exec(iso);
  if (!dijelovi) return null;
  const godina = Number(dijelovi[1]);
  const mjesec = Number(dijelovi[2]);
  const dan = Number(dijelovi[3]);
  // Date.UTC prelijeva nepostojeće datume (30. 2. postaje 2. 3.), pa ih usporedba dijelova otkriva.
  const provjera = new Date(Date.UTC(godina, mjesec - 1, dan));
  if (
    provjera.getUTCFullYear() !== godina ||
    provjera.getUTCMonth() !== mjesec - 1 ||
    provjera.getUTCDate() !== dan
  ) {
    return null;
  }
  return { godina, mjesec, dan };
}

function idIzdanja(objavljeno: string, nastavak: number): string {
  return nastavak === 0 ? objavljeno : `${objavljeno}-${nastavak}`;
}

/**
 * Datum se rastavlja kao tekst; `new Date(iso)` bi ga tumačio u vremenskoj zoni
 * poslužitelja i mogao pomaknuti dan.
 */
export function formatirajDatumHr(iso: string): string {
  const datum = rastaviDatum(iso);
  if (!datum) {
    throw new Error(`Neispravan datum izdanja „${iso}”: očekivan je postojeći datum oblika YYYY-MM-DD.`);
  }
  return `${datum.dan}. ${datum.mjesec}. ${datum.godina}.`;
}

/**
 * Validira sirove zapise, izbacuje nacrte (`objavljeno: null`) i vraća objavljena
 * izdanja od najnovijeg prema najstarijem. Neispravni podaci bacaju grešku, da
 * testovi i prikaz padnu glasno umjesto da prikažu krivi datum.
 */
export function pripremiIzdanja(sirova: unknown): Izdanje[] {
  if (!Array.isArray(sirova)) {
    throw new Error('Izdanja moraju biti polje zapisa.');
  }

  const izdanja: Izdanje[] = [];
  sirova.forEach((zapis: unknown, indeks) => {
    const opis = `Zapis izdanja #${indeks + 1}`;
    if (typeof zapis !== 'object' || zapis === null || Array.isArray(zapis)) {
      throw new Error(`${opis} mora biti objekt.`);
    }

    const nepoznataPolja = Object.keys(zapis).filter((kljuc) => !DOPUSTENA_POLJA.has(kljuc));
    if (nepoznataPolja.length > 0) {
      throw new Error(`${opis} ima nepoznata polja: ${nepoznataPolja.join(', ')}.`);
    }

    const { objavljeno, nastavak, naslov, stavke } = zapis as Record<string, unknown>;

    if (typeof naslov !== 'string' || naslov.trim() === '' || /[\r\n]/.test(naslov)) {
      throw new Error(`${opis}: naslov mora biti neprazan tekst u jednom retku.`);
    }
    if (
      !Array.isArray(stavke) ||
      stavke.length === 0 ||
      !stavke.every((stavka): stavka is string => typeof stavka === 'string' && stavka.trim() !== '')
    ) {
      throw new Error(`${opis} („${naslov}”): stavke moraju biti neprazno polje nepraznih tekstova.`);
    }

    if (objavljeno === null) {
      if (nastavak !== undefined) {
        throw new Error(`${opis} („${naslov}”): nacrt ne smije imati nastavak.`);
      }
      return;
    }
    if (typeof objavljeno !== 'string' || !rastaviDatum(objavljeno)) {
      throw new Error(
        `${opis} („${naslov}”): objavljeno mora biti null ili postojeći datum oblika YYYY-MM-DD.`,
      );
    }
    if (
      nastavak !== undefined &&
      (typeof nastavak !== 'number' || !Number.isInteger(nastavak) || nastavak < 1)
    ) {
      throw new Error(`${opis} („${naslov}”): nastavak mora biti cijeli broj veći od 0.`);
    }

    const brojNastavka = nastavak ?? 0;
    const id = idIzdanja(objavljeno, brojNastavka);
    izdanja.push({
      id,
      objavljeno,
      nastavak: brojNastavka,
      naslov,
      stavke: [...stavke],
      sidro: `izdanje-${id}`,
      oznaka: `v${objavljeno.split('-').join('.')}${brojNastavka === 0 ? '' : `.${brojNastavka}`}`,
      datumHr: formatirajDatumHr(objavljeno),
    });
  });

  const videni = new Set<string>();
  for (const izdanje of izdanja) {
    if (videni.has(izdanje.id)) {
      throw new Error(`Dva izdanja imaju isti datum i nastavak: ${izdanje.id}.`);
    }
    videni.add(izdanje.id);
  }
  for (const izdanje of izdanja) {
    for (let prethodni = 0; prethodni < izdanje.nastavak; prethodni += 1) {
      const idPrethodnog = idIzdanja(izdanje.objavljeno, prethodni);
      if (!videni.has(idPrethodnog)) {
        throw new Error(
          `Izdanje ${izdanje.id} ima nastavak ${izdanje.nastavak}, ali istoga dana nedostaje izdanje ${idPrethodnog}.`,
        );
      }
    }
  }

  return izdanja.sort((a, b) => {
    if (a.objavljeno !== b.objavljeno) return a.objavljeno < b.objavljeno ? 1 : -1;
    return b.nastavak - a.nastavak;
  });
}

export function urlIzdanja(izdanje: Izdanje): string {
  return `/novosti#${izdanje.sidro}`;
}

/** Objavljena izdanja, od najnovijeg prema najstarijem. */
export const IZDANJA: readonly Izdanje[] = pripremiIzdanja(sirovaIzdanja);

export const NAJNOVIJE_IZDANJE: Izdanje | null = IZDANJA[0] ?? null;
