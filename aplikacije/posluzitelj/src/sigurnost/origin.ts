export type Okruzenje = 'development' | 'test' | 'staging' | 'production';

const LOKALNI_ORIGINOVI = new Set([
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5174',
  'http://127.0.0.1:5174',
]);

export function jePouzdaniProxy(okruzenje: Okruzenje): boolean {
  return okruzenje === 'staging' || okruzenje === 'production';
}

export function jeDopustenOrigin(okruzenje: Okruzenje, origin: string | undefined): boolean {
  if (!origin) return true;
  return (okruzenje === 'development' || okruzenje === 'test') && LOKALNI_ORIGINOVI.has(origin);
}

export function stvoriCorsOrigin(okruzenje: Okruzenje) {
  return (origin: string | undefined, povratniPoziv: (greska: Error | null, dopusten: boolean) => void) => {
    povratniPoziv(null, jeDopustenOrigin(okruzenje, origin));
  };
}