import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CACHE_HASHIRANIH_ASETA,
  CACHE_NEVERZIONIRANIH_ASETA,
  razrijesiPutanjuUnutarKorijena,
} from '../src/sigurnost/staticki-aseti.js';

describe('staticki-aseti', () => {
  it('neverzionirani cache nije immutable i zahtijeva revalidaciju', () => {
    expect(CACHE_NEVERZIONIRANIH_ASETA).toContain('must-revalidate');
    expect(CACHE_NEVERZIONIRANIH_ASETA).not.toContain('immutable');
    expect(CACHE_HASHIRANIH_ASETA).toContain('immutable');
  });

  it('prihvaća datoteku unutar korijena i odbija path traversal', () => {
    const korijen = path.resolve('/tmp/kaladont-aseti-korijen');
    const unutar = razrijesiPutanjuUnutarKorijena(korijen, path.join('ikone', '07-igraj.webp'));
    expect(unutar).toBe(path.join(korijen, 'ikone', '07-igraj.webp'));

    expect(razrijesiPutanjuUnutarKorijena(korijen, '../tajna.txt')).toBeNull();
    expect(razrijesiPutanjuUnutarKorijena(korijen, path.join('ikone', '..', '..', 'tajna.txt'))).toBeNull();
    expect(razrijesiPutanjuUnutarKorijena(korijen, '')).toBeNull();
    expect(razrijesiPutanjuUnutarKorijena(korijen, 'a\0b')).toBeNull();
  });
});
