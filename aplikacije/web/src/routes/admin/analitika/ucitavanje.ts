import type { KontekstFilter, TabAnalitike } from './tipovi.js';

export type EndpointAnalitike =
  | 'status'
  | 'igraci'
  | 'dnevno'
  | 'partije'
  | 'cekanje'
  | 'botovi'
  | 'izazovi'
  | 'gamifikacija'
  | 'pocetne-rijeci'
  | 'incidenti';

export interface FilteriAnalitike {
  od: string;
  doDana: string;
  kontekst: KontekstFilter;
  izazovChallengeId: string;
  izazovAccountType: '' | 'gost' | 'registriran';
  stranicaIncidenata: number;
}

/** Endpointi podataka za tab (bez statusa). */
export function endpointiZaTab(tab: TabAnalitike): EndpointAnalitike[] {
  switch (tab) {
    case 'igraci':
      return ['igraci', 'dnevno'];
    case 'partije':
      return ['partije'];
    case 'cekaonica':
      return ['cekanje'];
    case 'botovi':
      return ['botovi'];
    case 'izazovi':
      return ['izazovi'];
    case 'gamifikacija':
      return ['gamifikacija'];
    case 'rjecnik':
      return ['pocetne-rijeci', 'incidenti'];
  }
}

export function tabPrikazujeKontekst(tab: TabAnalitike): boolean {
  return tab !== 'cekaonica' && tab !== 'izazovi';
}

export function tabPrikazujeIzazovFiltere(tab: TabAnalitike): boolean {
  return tab === 'izazovi';
}

/** Query za većinu endpointа; kontekst se šalje samo kad je primjenjiv. */
export function queryZaTab(tab: TabAnalitike, filteri: FilteriAnalitike): string {
  const params = new URLSearchParams();
  if (filteri.od) params.set('od', filteri.od);
  if (filteri.doDana) params.set('do', filteri.doDana);
  if (tabPrikazujeKontekst(tab) && filteri.kontekst) {
    params.set('kontekst', filteri.kontekst);
  }
  if (tab === 'rjecnik') {
    params.set('stranica', String(filteri.stranicaIncidenata));
  }
  return params.toString();
}

export function queryIzazovi(filteri: FilteriAnalitike): string {
  const params = new URLSearchParams();
  if (filteri.od) params.set('od', filteri.od);
  if (filteri.doDana) params.set('do', filteri.doDana);
  if (filteri.izazovChallengeId) params.set('challengeId', filteri.izazovChallengeId);
  if (filteri.izazovAccountType) params.set('accountTypeAtStart', filteri.izazovAccountType);
  return params.toString();
}

export function putanjaEndpointa(
  endpoint: EndpointAnalitike,
  tab: TabAnalitike,
  filteri: FilteriAnalitike,
): string {
  if (endpoint === 'status') return '/admin/analitika/status';
  if (endpoint === 'izazovi') return `/admin/analitika/izazovi?${queryIzazovi(filteri)}`;
  const q = queryZaTab(tab, filteri);
  return `/admin/analitika/${endpoint}?${q}`;
}

/** Brojač zaštite od zastarjelih odgovora. */
export class TokenUcitavanja {
  private trenutni = 0;

  novi(): number {
    this.trenutni += 1;
    return this.trenutni;
  }

  jeAktualan(id: number): boolean {
    return id === this.trenutni;
  }

  get vrijednost(): number {
    return this.trenutni;
  }
}

/** Endpointi za puni refresh aktivnog taba (uključujući status). */
export function endpointiOsvjezavanja(tab: TabAnalitike): EndpointAnalitike[] {
  return ['status', ...endpointiZaTab(tab)];
}

/** Samo nova stranica incidenata — bez statusa i početnih. */
export function endpointiPaginacijeIncidenata(): EndpointAnalitike[] {
  return ['incidenti'];
}
