/** Pomoćne funkcije za kompaktni pregled obavijesti na naslovnici. */

export function kratkiBrojNovih(n: number): string {
  if (n <= 0) return '';
  if (n === 1) return '1 nova';
  if (n >= 2 && n <= 4) return `${n} nove`;
  return `${n} novih`;
}

export function zaglavljeObavijesti(brojNeprocitanih: number): string {
  const kratko = kratkiBrojNovih(brojNeprocitanih);
  return kratko ? `Obavijesti · ${kratko}` : 'Obavijesti';
}

/** Relativno vrijeme za kompaktni pregled (HR). */
export function relativnoVrijemeObavijesti(iso: string, sada = new Date()): string {
  const datum = new Date(iso);
  if (Number.isNaN(datum.getTime())) return iso;

  const diffMs = datum.getTime() - sada.getTime();
  const diffSek = Math.round(diffMs / 1000);
  const absSek = Math.abs(diffSek);

  if (absSek < 45) return 'Upravo sad';

  const rtf = new Intl.RelativeTimeFormat('hr', { numeric: 'auto' });

  if (absSek < 60 * 60) {
    const minute = Math.round(diffSek / 60);
    return rtf.format(minute, 'minute');
  }
  if (absSek < 60 * 60 * 24) {
    const sati = Math.round(diffSek / 3600);
    return rtf.format(sati, 'hour');
  }
  if (absSek < 60 * 60 * 24 * 7) {
    const dani = Math.round(diffSek / 86400);
    return rtf.format(dani, 'day');
  }

  try {
    return datum.toLocaleDateString('hr-HR', { day: 'numeric', month: 'short' });
  } catch {
    return iso;
  }
}

export function ikonaZaTipObavijesti(tip: string): string {
  if (
    tip === 'nova_zvjezdica'
    || tip === 'nova_xp_razina'
    || tip === 'nova_kolekcionarska_razina'
    || tip === 'promjena_ranga'
  ) {
    return '/ikone/26-zvjezdica-prazna.png';
  }
  return '/ikone/81-mailbox.webp';
}

/** Indeks nakon uklanjanja stavke; zadržava najbližu postojeću poziciju. */
export function indeksNakonUklanjanja(trenutni: number, ukupnoPrije: number): number {
  if (ukupnoPrije <= 1) return 0;
  if (trenutni >= ukupnoPrije - 1) return Math.max(0, ukupnoPrije - 2);
  return trenutni;
}

export function tekstPozicijePagera(indeks: number, ucitano: number, imaJos: boolean): string {
  if (ucitano <= 0) return '';
  const pozicija = indeks + 1;
  if (imaJos) return `${pozicija} / ${ucitano}+`;
  return `${pozicija} / ${ucitano}`;
}
