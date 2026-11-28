import { describe, expect, it } from 'vitest';
import {
  detaljIncidenteJeAktualan,
  endpointiOsvjezavanja,
  endpointiPaginacijeIncidenata,
  endpointiZaTab,
  istiOsnovniFilteriSnimke,
  pomakniTabTipkovnicom,
  putanjaEndpointa,
  queryIzazovi,
  queryZaTab,
  snimkaFilteraZaTab,
  tabPrikazujeIzazovFiltere,
  tabPrikazujeKontekst,
  trebaUcitatiTab,
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

  it('ponovno učitava tab kad se relevantni filteri razlikuju', () => {
    const a = snimkaFilteraZaTab('partije', bazaFilteri);
    const b = snimkaFilteraZaTab('partije', { ...bazaFilteri, od: '2025-02-01' });
    expect(a).not.toBe(b);
    expect(trebaUcitatiTab({
      ucitano: true,
      ucitava: false,
      snimkaUcitanog: a,
      snimkaUTijeku: null,
      aktualnaSnimka: b,
    })).toBe(true);
    expect(trebaUcitatiTab({
      ucitano: true,
      ucitava: false,
      snimkaUcitanog: a,
      snimkaUTijeku: null,
      aktualnaSnimka: a,
    })).toBe(false);
    expect(trebaUcitatiTab({
      ucitano: false,
      ucitava: false,
      snimkaUcitanog: null,
      snimkaUTijeku: null,
      aktualnaSnimka: a,
    })).toBe(true);
    expect(trebaUcitatiTab({
      ucitano: false,
      ucitava: true,
      snimkaUcitanog: null,
      snimkaUTijeku: a,
      aktualnaSnimka: a,
    })).toBe(false);
    expect(trebaUcitatiTab({
      ucitano: false,
      ucitava: true,
      snimkaUcitanog: null,
      snimkaUTijeku: a,
      aktualnaSnimka: b,
    })).toBe(true);
  });

  it('ignorira kontekst u snimci za čekaonicu i izazove', () => {
    const c1 = snimkaFilteraZaTab('cekaonica', bazaFilteri);
    const c2 = snimkaFilteraZaTab('cekaonica', { ...bazaFilteri, kontekst: 'javna' });
    expect(c1).toBe(c2);
    expect(c1).not.toContain('kontekst');

    const i1 = snimkaFilteraZaTab('izazovi', bazaFilteri);
    const i2 = snimkaFilteraZaTab('izazovi', { ...bazaFilteri, kontekst: 'trening' });
    expect(i1).toBe(i2);
    expect(i1).toContain('challenge=IZ-01');
  });

  it('pomakne tab tipkovnicom (strelica / Home / End)', () => {
    expect(pomakniTabTipkovnicom('igraci', 'ArrowRight')).toBe('partije');
    expect(pomakniTabTipkovnicom('igraci', 'ArrowLeft')).toBe('rjecnik');
    expect(pomakniTabTipkovnicom('partije', 'Home')).toBe('igraci');
    expect(pomakniTabTipkovnicom('partije', 'End')).toBe('rjecnik');
    expect(pomakniTabTipkovnicom('botovi', 'Enter')).toBeNull();
  });

  it('detalj incidenta zanemaruje zakašnjeli odgovor', () => {
    expect(detaljIncidenteJeAktualan('a', 'a')).toBe(true);
    expect(detaljIncidenteJeAktualan('b', 'a')).toBe(false);
    expect(detaljIncidenteJeAktualan(null, 'a')).toBe(false);
  });

  it('isti osnovni filteri zanemaruju stranicu incidenata', () => {
    const a = snimkaFilteraZaTab('rjecnik', bazaFilteri);
    const b = snimkaFilteraZaTab('rjecnik', { ...bazaFilteri, stranicaIncidenata: 5 });
    const c = snimkaFilteraZaTab('rjecnik', { ...bazaFilteri, od: '2025-03-01' });
    expect(istiOsnovniFilteriSnimke(a, b)).toBe(true);
    expect(istiOsnovniFilteriSnimke(a, c)).toBe(false);
    expect(istiOsnovniFilteriSnimke(null, a)).toBe(false);
  });
});
