import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { generirajUmamiBeforeSend } from '../../skripte/generiraj-umami-before-send.mjs';
import { IME_UMAMI_BEFORE_SEND } from './umami-sanitizacija.js';

describe('umami-before-send produkcijski IIFE', () => {
  let outfile = '';

  beforeAll(async () => {
    outfile = await generirajUmamiBeforeSend();
  });

  it('registrira handler koji pokriva produkcijsko ponašanje', async () => {
    const kod = readFileSync(outfile, 'utf8');
    expect(kod).toContain('GENERIRANO');

    const trackCalls: unknown[] = [];
    const mockWindow = {
      location: { origin: 'https://kaladont.hr', href: 'https://kaladont.hr/' },
    } as unknown as Window & typeof globalThis;

    vi.stubGlobal('window', mockWindow);
    // IIFE očekuje window u globalnom opsegu
    const fn = new Function('window', `${kod}; return window[${JSON.stringify(IME_UMAMI_BEFORE_SEND)}];`);
    const handler = fn(mockWindow) as (
      type: string,
      payload: Record<string, unknown>,
    ) => Record<string, unknown> | false;

    expect(typeof handler).toBe('function');

    expect(handler('event', { url: '/soba/kreiraj' })).toMatchObject({
      url: '/soba/kreiraj',
    });
    expect(handler('event', { url: '/soba/AB23CD' })).toMatchObject({
      url: '/soba/:kod',
    });
    expect(
      handler('event', {
        url: '/partija/550e8400-e29b-41d4-a716-446655440000/',
        referrer: 'https://vanjski.hr/a?b=1',
      }),
    ).toMatchObject({
      url: '/partija/:id',
      referrer: 'https://vanjski.hr',
    });
    expect(handler('event', null as unknown as Record<string, unknown>)).toBe(false);

    void trackCalls;
    void pathToFileURL;
    vi.unstubAllGlobals();
  });
});
