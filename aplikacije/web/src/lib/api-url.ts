import { ADRESA_POSLUZITELJA } from './konfiguracija.js';

export function apiUrl(putanja: string): string {
  if (!putanja.startsWith('/')) throw new Error('API putanja mora početi kosom crtom.');
  if (putanja === '/api' || putanja.startsWith('/api/')) {
    throw new Error('API putanja već ima /api prefiks.');
  }
  const baza = ADRESA_POSLUZITELJA.replace(/\/+$/, '');
  return `${baza}/api${putanja}`;
}
