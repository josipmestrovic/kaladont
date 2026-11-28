import { describe, expect, it } from 'vitest';
import {
  sanitizirajUmamiNaslov,
  sanitizirajUmamiPutanju,
  sanitizirajUmamiReferrer,
  sanitizirajUmamiUrl,
  umamiBeforeSend,
  UTM_MAX_DULJINA,
} from './umami-sanitizacija.js';

describe('umami-sanitizacija', () => {
  it('uklanja token iz queryja na potvrdi emaila', () => {
    expect(sanitizirajUmamiUrl('/potvrda-emaila?token=xyz-tajni')).toBe('/potvrda-emaila');
  });

  it('uklanja token s reset lozinke', () => {
    expect(sanitizirajUmamiUrl('/racuni/resetiraj-lozinku?token=abc123')).toBe(
      '/racuni/resetiraj-lozinku',
    );
  });

  it('ne maskira /soba/kreiraj kao kod', () => {
    expect(sanitizirajUmamiPutanju('/soba/kreiraj')).toBe('/soba/kreiraj');
    expect(sanitizirajUmamiPutanju('/soba/kreiraj/')).toBe('/soba/kreiraj');
  });

  it('normalizira URL privatne sobe', () => {
    expect(sanitizirajUmamiPutanju('/soba/AB23CD')).toBe('/soba/:kod');
    expect(sanitizirajUmamiUrl('/soba/XYZ9AB')).toBe('/soba/:kod');
  });

  it('normalizira URL partije s trailing slash i encodingom', () => {
    expect(
      sanitizirajUmamiPutanju('/partija/550e8400-e29b-41d4-a716-446655440000/'),
    ).toBe('/partija/:id');
    expect(
      sanitizirajUmamiPutanju('/partija/%35550e8400-e29b-41d4-a716-446655440000'.replace('%35', '5')),
    ).toBe('/partija/:id');
    expect(
      sanitizirajUmamiPutanju(
        `/partija/${encodeURIComponent('550e8400-e29b-41d4-a716-446655440000')}`,
      ),
    ).toBe('/partija/:id');
  });

  it('normalizira dinamički URL profila', () => {
    expect(
      sanitizirajUmamiPutanju('/profil/javni/550e8400-e29b-41d4-a716-446655440000'),
    ).toBe('/profil/javni/:id');
  });

  it('čuva dopuštene UTM parametre i skraćuje vrijednosti', () => {
    const duga = 'x'.repeat(100);
    expect(
      sanitizirajUmamiUrl(
        `/?utm_source=${duga}&utm_medium=cta&utm_campaign=lansiranje&token=tajna`,
      ),
    ).toBe(
      `/?utm_source=${'x'.repeat(UTM_MAX_DULJINA)}&utm_medium=cta&utm_campaign=lansiranje`,
    );
  });

  it('vanjski referrer zadržava samo origin', () => {
    expect(sanitizirajUmamiReferrer('https://forum.example/putanja?token=1')).toBe(
      'https://forum.example',
    );
  });

  it('isti-origin referrer sanitizira putanju', () => {
    expect(sanitizirajUmamiReferrer('https://kaladont.hr/soba/AB23CD?x=1')).toBe(
      '/soba/:kod',
    );
  });

  it('ostavlja običan URL naslovnice', () => {
    expect(sanitizirajUmamiUrl('/')).toBe('/');
    expect(sanitizirajUmamiPutanju('/')).toBe('/');
  });

  it('sanitizira naslov s UUID-om i kodom sobe', () => {
    expect(
      sanitizirajUmamiNaslov('Partija 550e8400-e29b-41d4-a716-446655440000 | Kaladont'),
    ).toBe('Partija :id | Kaladont');
    expect(sanitizirajUmamiNaslov('Soba AB23CD | Kaladont')).toBe('Soba :kod | Kaladont');
  });

  it('before-send sanitizira pageview payload', () => {
    const rezultat = umamiBeforeSend('event', {
      url: '/partija/550e8400-e29b-41d4-a716-446655440000?igraj=1',
      referrer: '/soba/AB23CD',
      title: 'Igra | Kaladont',
      website: 'test',
    });
    expect(rezultat).toEqual({
      url: '/partija/:id',
      referrer: '/soba/:kod',
      title: 'Igra | Kaladont',
      website: 'test',
    });
  });

  it('before-send propušta prilagođeni događaj uz sanitizirani url', () => {
    const rezultat = umamiBeforeSend('event', {
      url: '/soba/H3LLW2',
      name: 'privatna-soba-kreirana',
      referrer: '',
    });
    expect(rezultat).toMatchObject({
      url: '/soba/:kod',
      name: 'privatna-soba-kreirana',
    });
  });

  it('before-send odbija neispravan payload', () => {
    expect(umamiBeforeSend('event', null)).toBe(false);
    expect(umamiBeforeSend('event', undefined)).toBe(false);
  });

  it('before-send pri grešci ne šalje (falsy)', () => {
    const problematicni = {
      get url() {
        throw new Error('lom');
      },
    };
    expect(umamiBeforeSend('event', problematicni)).toBe(false);
  });
});
