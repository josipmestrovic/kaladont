import { afterEach, describe, expect, it, vi } from 'vitest';
import { zabiljeziUmamiDogadjaj } from './umami.js';

describe('zabiljeziUmamiDogadjaj', () => {
  afterEach(() => {
    delete window.umami;
  });

  it('šalje event kroz stub', () => {
    const track = vi.fn();
    window.umami = { track };
    zabiljeziUmamiDogadjaj('naslovnica-brza-igra-klik');
    expect(track).toHaveBeenCalledWith('naslovnica-brza-igra-klik');
  });

  it('ne ruši UI kad tracker nedostaje', () => {
    expect(() => zabiljeziUmamiDogadjaj('naslovnica-trening-klik')).not.toThrow();
  });

  it('ne ruši UI kad tracker baci grešku', () => {
    window.umami = {
      track: () => {
        throw new Error('blokiran');
      },
    };
    expect(() => zabiljeziUmamiDogadjaj('naslovnica-izazovi-klik')).not.toThrow();
  });
});
