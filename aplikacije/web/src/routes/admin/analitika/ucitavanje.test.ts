import { describe, expect, it } from 'vitest';
import {
  endpointiOsvjezavanja,
  endpointiPaginacijeIncidenata,
  endpointiZaTab,
  putanjaEndpointa,
  queryIzazovi,
  queryZaTab,
  tabPrikazujeIzazovFiltere,
  tabPrikazujeKontekst,
  TokenUcitavanja,
} from './ucitavanje.js';
import type { FilteriAnalitike } from './ucitavanje.js';

const bazaFilteri: FilteriAnalitike = {
  od: '2025-01-01',
  doDana: '2025-01-07',
  kontekst: 'privatna',
  izazovChallengeId: 'IZ-01',
  izazovAccountType: 'gost',
  stranicaIncidenata: 2,
};

describe('ucitavanje analitike', () => {
  it('mapira tab na endpointе', () => {
    expect(endpointiZaTab('igraci')).toEqual(['igraci', 'dnevno']);
    expect(endpointiZaTab('partije')).toEqual(['partije']);
    expect(endpointiZaTab('cekaonica')).toEqual(['cekanje']);
    expect(endpointiZaTab('botovi')).toEqual(['botovi']);
    expect(endpointiZaTab('izazovi')).toEqual(['izazovi']);
    expect(endpointiZaTab('gamifikacija')).toEqual(['gamifikacija']);
    expect(endpointiZaTab('rjecnik')).toEqual(['pocetne-rijeci', 'incidenti']);
  });

  it('osvježavanje uključuje status; paginacija samo incidente', () => {
    expect(endpointiOsvjezavanja('partije')).toEqual(['status', 'partije']);
    expect(endpointiPaginacijeIncidenata()).toEqual(['incidenti']);
  });

  it('ne šalje kontekst na čekaonicu i izazove', () => {
    expect(tabPrikazujeKontekst('cekaonica')).toBe(false);
    expect(tabPrikazujeKontekst('izazovi')).toBe(false);
    expect(tabPrikazujeKontekst('igraci')).toBe(true);
    expect(tabPrikazujeIzazovFiltere('izazovi')).toBe(true);
    expect(tabPrikazujeIzazovFiltere('partije')).toBe(false);

    const qCekanje = queryZaTab('cekaonica', bazaFilteri);
    expect(qCekanje).not.toContain('kontekst');
    expect(qCekanje).toContain('od=2025-01-01');

    const qIz = queryIzazovi(bazaFilteri);
    expect(qIz).not.toContain('kontekst');
    expect(qIz).toContain('challengeId=IZ-01');
    expect(qIz).toContain('accountTypeAtStart=gost');

    const qIgraci = queryZaTab('igraci', bazaFilteri);
    expect(qIgraci).toContain('kontekst=privatna');
  });

  it('rječnik šalje stranicu incidenata', () => {
    const q = queryZaTab('rjecnik', bazaFilteri);
    expect(q).toContain('stranica=2');
    expect(q).toContain('kontekst=privatna');
  });

  it('putanjaEndpointa gradi ispravne URL-ove', () => {
    expect(putanjaEndpointa('status', 'igraci', bazaFilteri)).toBe('/admin/analitika/status');
    expect(putanjaEndpointa('izazovi', 'izazovi', bazaFilteri)).toContain('/admin/analitika/izazovi?');
    expect(putanjaEndpointa('cekanje', 'cekaonica', bazaFilteri)).not.toContain('kontekst');
  });

  it('TokenUcitavanja zanemaruje zastarjele odgovore', () => {
    const t = new TokenUcitavanja();
    const prvi = t.novi();
    const drugi = t.novi();
    expect(t.jeAktualan(prvi)).toBe(false);
    expect(t.jeAktualan(drugi)).toBe(true);
    expect(t.vrijednost).toBe(2);
  });

  it('prazan kontekst ne ide u query', () => {
    const q = queryZaTab('partije', { ...bazaFilteri, kontekst: '' });
    expect(q).not.toContain('kontekst');
  });
});
