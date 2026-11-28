import { describe, expect, it } from 'vitest';
import {
  sanitizirajUmamiNaslov,
  sanitizirajUmamiPutanju,
  sanitizirajUmamiReferrer,
  sanitizirajUmamiUrl,
  umamiBeforeSend,
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

  it('normalizira URL privatne sobe', () => {
    expect(sanitizirajUmamiPutanju('/soba/ABC123')).toBe('/soba/:kod');
    expect(sanitizirajUmamiUrl('/soba/XYZ9')).toBe('/soba/:kod');
  });

  it('normalizira URL partije', () => {
    expect(
      sanitizirajUmamiPutanju('/partija/550e8400-e29b-41d4-a716-446655440000'),
    ).toBe('/partija/:id');
    expect(
      sanitizirajUmamiPutanju('/partija/arhiva/550e8400-e29b-41d4-a716-446655440000'),
    ).toBe('/partija/arhiva/:id');
  });

  it('normalizira dinamički URL profila', () => {
    expect(
      sanitizirajUmamiPutanju('/profil/javni/550e8400-e29b-41d4-a716-446655440000'),
    ).toBe('/profil/javni/:id');
  });

  it('čuva dopuštene UTM parametre', () => {
    expect(
      sanitizirajUmamiUrl(
        '/?utm_source=forum&utm_medium=cta&utm_campaign=lansiranje&token=tajna',
      ),
    ).toBe('/?utm_source=forum&utm_medium=cta&utm_campaign=lansiranje');
  });

  it('sanitizira referrer s kodom sobe i tokenom', () => {
    expect(sanitizirajUmamiReferrer('https://kaladont.hr/soba/ABC123?x=1')).toBe(
      '/soba/:kod',
    );
    expect(
      sanitizirajUmamiReferrer('https://drugi.hr/potvrda-emaila?token=xyz'),
    ).toBe('https://drugi.hr/potvrda-emaila');
  });

  it('ostavlja običan URL naslovnice', () => {
    expect(sanitizirajUmamiUrl('/')).toBe('/');
    expect(sanitizirajUmamiPutanju('/')).toBe('/');
  });

  it('sanitizira naslov s UUID-om', () => {
    expect(
      sanitizirajUmamiNaslov('Partija 550e8400-e29b-41d4-a716-446655440000 | Kaladont'),
    ).toBe('Partija :id | Kaladont');
  });

  it('before-send sanitizira pageview payload', () => {
    const rezultat = umamiBeforeSend('event', {
      url: '/partija/550e8400-e29b-41d4-a716-446655440000?igraj=1',
      referrer: '/soba/AB12CD',
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
      url: '/soba/HELLO1',
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
