import { afterEach, describe, expect, it, vi } from 'vitest';
import { zabiljeziUmamiDogadjaj } from './umami.js';

describe('zabiljeziUmamiDogadjaj', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('šalje event kroz stub', () => {
    const track = vi.fn();
    vi.stubGlobal('window', { umami: { track } });
    zabiljeziUmamiDogadjaj('naslovnica-brza-igra-klik');
    expect(track).toHaveBeenCalledWith('naslovnica-brza-igra-klik');
  });

  it('ne ruši UI kad tracker nedostaje', () => {
    vi.stubGlobal('window', {});
    expect(() => zabiljeziUmamiDogadjaj('naslovnica-trening-klik')).not.toThrow();
  });

  it('ne ruši UI kad tracker baci grešku', () => {
    vi.stubGlobal('window', {
      umami: {
        track: () => {
          throw new Error('blokiran');
        },
      },
    });
    expect(() => zabiljeziUmamiDogadjaj('naslovnica-izazovi-klik')).not.toThrow();
  });
});
