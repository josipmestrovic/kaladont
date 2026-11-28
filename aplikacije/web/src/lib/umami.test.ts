import { afterEach, describe, expect, it, vi } from 'vitest';
import { zabiljeziUmamiDogadjaj } from './umami.js';

describe('zabiljeziUmamiDogadjaj', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('šalje događaj bez parametara', () => {
    const track = vi.fn();
    vi.stubGlobal('window', { umami: { track } });
    zabiljeziUmamiDogadjaj('privatna-soba-kreirana');
    expect(track).toHaveBeenCalledWith('privatna-soba-kreirana');
    expect(track).toHaveBeenCalledTimes(1);
  });

  it('šalje događaj s parametrima', () => {
    const track = vi.fn();
    vi.stubGlobal('window', { umami: { track } });
    zabiljeziUmamiDogadjaj('mod-klik', { mod: 'brza_igra', izvor: 'naslovnica' });
    expect(track).toHaveBeenCalledWith('mod-klik', {
      mod: 'brza_igra',
      izvor: 'naslovnica',
    });
  });

  it('šalje navigacija-klik s točnim argumentima', () => {
    const track = vi.fn();
    vi.stubGlobal('window', { umami: { track } });
    zabiljeziUmamiDogadjaj('navigacija-klik', {
      odrediste: 'ljestvice',
      izvor: 'naslovnica',
    });
    expect(track).toHaveBeenCalledExactlyOnceWith('navigacija-klik', {
      odrediste: 'ljestvice',
      izvor: 'naslovnica',
    });
  });

  it('ne ruši UI kad tracker nedostaje', () => {
    vi.stubGlobal('window', {});
    expect(() =>
      zabiljeziUmamiDogadjaj('registracija-klik', { izvor: 'naslovnica' }),
    ).not.toThrow();
  });

  it('ne ruši UI kad window nije dostupan', () => {
    vi.stubGlobal('window', undefined);
    expect(() => zabiljeziUmamiDogadjaj('avatar-spremljen')).not.toThrow();
  });

  it('ne ruši UI kad tracker sinkrono baci grešku', () => {
    vi.stubGlobal('window', {
      umami: {
        track: () => {
          throw new Error('blokiran');
        },
      },
    });
    expect(() =>
      zabiljeziUmamiDogadjaj('mod-klik', { mod: 'trening', izvor: 'naslovnica' }),
    ).not.toThrow();
  });

  it('ne ruši UI kad tracker odbije Promise', async () => {
    const track = vi.fn(() => Promise.reject(new Error('mreza')));
    vi.stubGlobal('window', { umami: { track } });
    expect(() => zabiljeziUmamiDogadjaj('privatna-soba-link-kopiran')).not.toThrow();
    await Promise.resolve();
    expect(track).toHaveBeenCalledWith('privatna-soba-link-kopiran');
  });
});
