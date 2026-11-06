import { describe, expect, it } from 'vitest';
import { dohvatiStatusAnalitike } from '../src/analitika/status.js';

describe('status analitike', () => {
  it('ne puca kad min/max iz baze nisu Date instance', async () => {
    const status = await dohvatiStatusAnalitike();
    expect(typeof status.imaMjerenja).toBe('boolean');
    if (status.mjerenjeOd) expect(() => new Date(status.mjerenjeOd!).toISOString()).not.toThrow();
    if (status.zadnjiZapisU) expect(() => new Date(status.zadnjiZapisU!).toISOString()).not.toThrow();
  });
});
