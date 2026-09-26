export interface CivilniDatum {
  godina: number;
  mjesec: number;
  dan: number;
}

export interface KalendarskiStaz {
  godine: number;
  mjeseci: number;
  dani: number;
  ukupnoDana: number;
  tekst: string;
}

function parsirajCivilniDatum(vrijednost: string): CivilniDatum | null {
  const podudaranje = /^(\d{4})-(\d{2})-(\d{2})$/.exec(vrijednost);
  if (!podudaranje) return null;

  const godina = Number(podudaranje[1]);
  const mjesec = Number(podudaranje[2]);
  const dan = Number(podudaranje[3]);
  const kandidat = new Date(Date.UTC(godina, mjesec - 1, dan));
  if (
    kandidat.getUTCFullYear() !== godina ||
    kandidat.getUTCMonth() !== mjesec - 1 ||
    kandidat.getUTCDate() !== dan
  ) return null;

  return { godina, mjesec, dan };
}

function serijalizirajCivilniDatum(datum: CivilniDatum): string {
  return `${String(datum.godina).padStart(4, '0')}-${String(datum.mjesec).padStart(2, '0')}-${String(datum.dan).padStart(2, '0')}`;
}

function daniUMjesecu(godina: number, mjesec: number): number {
  return new Date(Date.UTC(godina, mjesec, 0)).getUTCDate();
}

function dodajGodine(datum: CivilniDatum, godine: number): CivilniDatum {
  const godina = datum.godina + godine;
  return {
    godina,
    mjesec: datum.mjesec,
    dan: Math.min(datum.dan, daniUMjesecu(godina, datum.mjesec)),
  };
}

function dodajMjesece(datum: CivilniDatum, mjeseci: number): CivilniDatum {
  const indeksMjeseca = datum.godina * 12 + datum.mjesec - 1 + mjeseci;
  const godina = Math.floor(indeksMjeseca / 12);
  const mjesec = indeksMjeseca - godina * 12 + 1;
  return {
    godina,
    mjesec,
    dan: Math.min(datum.dan, daniUMjesecu(godina, mjesec)),
  };
}

function danIndeksa(datum: CivilniDatum): number {
  return Math.floor(Date.UTC(datum.godina, datum.mjesec - 1, datum.dan) / 86_400_000);
}

function oblikBroja(broj: number): 0 | 1 | 2 {
  const zadnjeDvije = broj % 100;
  if (zadnjeDvije >= 11 && zadnjeDvije <= 14) return 2;
  const zadnja = broj % 10;
  if (zadnja === 1) return 0;
  if (zadnja >= 2 && zadnja <= 4) return 1;
  return 2;
}

function formatirajJedinicu(broj: number, jedinica: 'godine' | 'mjeseci' | 'dani'): string {
  const oblik = oblikBroja(broj);
  const naziv = jedinica === 'godine'
    ? ['godina', 'godine', 'godina'][oblik]!
    : jedinica === 'mjeseci'
      ? ['mjesec', 'mjeseca', 'mjeseci'][oblik]!
      : ['dan', 'dana', 'dana'][oblik]!;
  return `${new Intl.NumberFormat('hr-HR', { maximumFractionDigits: 0 }).format(broj)} ${naziv}`;
}

function formatirajTjedan(broj: number): string {
  const oblik = oblikBroja(broj);
  const naziv = ['tjedan', 'tjedna', 'tjedana'][oblik]!;
  return `${new Intl.NumberFormat('hr-HR', { maximumFractionDigits: 0 }).format(broj)} ${naziv}`;
}

export function formatirajStazBiografski(staz: Pick<KalendarskiStaz, 'ukupnoDana'> | null): string | null {
  if (!staz || !Number.isSafeInteger(staz.ukupnoDana) || staz.ukupnoDana < 0) return null;
  const dana = staz.ukupnoDana;
  if (dana === 0) return 'U čarima Kaladonta uživa tek prvi dan.';
  if (dana < 7) return `U čarima Kaladonta uživa već ${formatirajJedinicu(dana, 'dani')}.`;
  if (dana < 28) return `U čarima Kaladonta uživa već ${formatirajTjedan(Math.floor(dana / 7))}.`;

  const ukupnoMjeseci = Math.floor((dana - 28) / 30) + 1;
  const godine = Math.floor(ukupnoMjeseci / 12);
  const mjeseci = ukupnoMjeseci % 12;
  const trajanje = [
    godine > 0 ? formatirajJedinicu(godine, 'godine') : null,
    mjeseci > 0 ? formatirajJedinicu(mjeseci, 'mjeseci') : null,
  ].filter((jedinica): jedinica is string => jedinica !== null).join(' i ');
  return `S nama je već ${trajanje}.`;
}

export function formatirajKalendarskiStaz(godine: number, mjeseci: number, dani: number): string {
  const jedinice = [
    godine > 0 ? formatirajJedinicu(godine, 'godine') : null,
    mjeseci > 0 ? formatirajJedinicu(mjeseci, 'mjeseci') : null,
    dani > 0 ? formatirajJedinicu(dani, 'dani') : null,
  ].filter((jedinica): jedinica is string => jedinica !== null);

  if (jedinice.length === 0) return 'Prvi dan';
  return jedinice.slice(0, 2).join(' i ');
}

export function jeValjanCivilniDatum(vrijednost: string): boolean {
  return parsirajCivilniDatum(vrijednost) !== null;
}

export function datumZagrebacki(vrijeme: Date): string | null {
  if (Number.isNaN(vrijeme.getTime())) return null;
  const dijelovi = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Zagreb',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(vrijeme);
  const vrijednosti = Object.fromEntries(dijelovi.map((dio) => [dio.type, dio.value]));
  const civilni = `${vrijednosti.year}-${vrijednosti.month}-${vrijednosti.day}`;
  return jeValjanCivilniDatum(civilni) ? civilni : null;
}

export function izracunajKalendarskiStaz(pocetak: string, kraj: string): KalendarskiStaz | null {
  const pocetniDatum = parsirajCivilniDatum(pocetak);
  const zavrsniDatum = parsirajCivilniDatum(kraj);
  if (!pocetniDatum || !zavrsniDatum || danIndeksa(pocetniDatum) > danIndeksa(zavrsniDatum)) return null;

  let godine = zavrsniDatum.godina - pocetniDatum.godina;
  let sidro = dodajGodine(pocetniDatum, godine);
  if (danIndeksa(sidro) > danIndeksa(zavrsniDatum)) {
    godine -= 1;
    sidro = dodajGodine(pocetniDatum, godine);
  }

  const mjeseciMoguci = (zavrsniDatum.godina - sidro.godina) * 12 + zavrsniDatum.mjesec - sidro.mjesec;
  let mjeseci = mjeseciMoguci;
  let sidroMjeseca = dodajMjesece(sidro, mjeseci);
  if (danIndeksa(sidroMjeseca) > danIndeksa(zavrsniDatum)) {
    mjeseci -= 1;
    sidroMjeseca = dodajMjesece(sidro, mjeseci);
  }

  const dani = danIndeksa(zavrsniDatum) - danIndeksa(sidroMjeseca);
  const ukupnoDana = danIndeksa(zavrsniDatum) - danIndeksa(pocetniDatum);
  return {
    godine,
    mjeseci,
    dani,
    ukupnoDana,
    tekst: formatirajKalendarskiStaz(godine, mjeseci, dani),
  };
}

export function datumCivilni(vrijeme: Date): string | null {
  if (Number.isNaN(vrijeme.getTime())) return null;
  return serijalizirajCivilniDatum({
    godina: vrijeme.getUTCFullYear(),
    mjesec: vrijeme.getUTCMonth() + 1,
    dan: vrijeme.getUTCDate(),
  });
}