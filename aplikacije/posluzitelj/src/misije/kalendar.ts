import { ZONA_LJESTVICA, kalendarskeGranice } from 'zajednicko';

const formatDatum = new Intl.DateTimeFormat('en-CA', {
  timeZone: ZONA_LJESTVICA,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

const formatDanTjedna = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONA_LJESTVICA,
  weekday: 'short',
});

/** Zagrebački kalendarski datum kao `YYYY-MM-DD` (za `date` stupce). */
export function zagrebackiDatumIso(trenutak: Date): string {
  return formatDatum.format(trenutak);
}

export function dnevneGranice(trenutak: Date): { od: Date; do: Date } {
  return kalendarskeGranice('dnevno', trenutak);
}

export function tjedneGranice(trenutak: Date): { od: Date; do: Date } {
  return kalendarskeGranice('tjedno', trenutak);
}

function pomakniKalendarskiDan(iso: string, deltaDana: number): string {
  const dijelovi = iso.split('-').map(Number);
  const y = dijelovi[0] ?? 0;
  const m = dijelovi[1] ?? 1;
  const d = dijelovi[2] ?? 1;
  const t = new Date(Date.UTC(y, m - 1, d + deltaDana));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
}

/** Lokalni datumi `[odIso, doIso)` kao YYYY-MM-DD (kalendarski koraci, bez 24h ms). */
export function daniIzmedu(odIso: string, doIso: string): string[] {
  const dani: string[] = [];
  for (let trenutni = odIso; trenutni < doIso; trenutni = pomakniKalendarskiDan(trenutni, 1)) {
    dani.push(trenutni);
  }
  return dani;
}

/** Ponoć Zagreba za YYYY-MM-DD (putem kalendarskih granica). */
export function ponocZaDatumIso(datumIso: string): Date {
  const dijelovi = datumIso.split('-').map(Number);
  const y = dijelovi[0] ?? 0;
  const m = dijelovi[1] ?? 1;
  const d = dijelovi[2] ?? 1;
  // Podne UTC tog kalendarskog dana sigurno pada u taj zagrebački dan.
  const sidro = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return dnevneGranice(sidro).od;
}

/** W06: nova dodjela zabranjena subotom i nedjeljom (petak OK). */
export function jeW06IzvedivZaNovuDodjelu(trenutak: Date): boolean {
  const dan = formatDanTjedna.format(trenutak);
  return dan !== 'Sat' && dan !== 'Sun';
}

export function sljedecaPonocNakon(trenutak: Date): Date {
  return dnevneGranice(trenutak).do;
}
