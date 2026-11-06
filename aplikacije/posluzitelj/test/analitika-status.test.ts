import { afterAll, describe, expect, it } from 'vitest';
import { dohvatiStatusAnalitike } from '../src/analitika/status.js';

describe('status analitike', () => {
  const prethodniFlag = process.env.ANALITIKA_U_TESTU;
  process.env.ANALITIKA_U_TESTU = '1';

  afterAll(() => {
    if (prethodniFlag === undefined) delete process.env.ANALITIKA_U_TESTU;
    else process.env.ANALITIKA_U_TESTU = prethodniFlag;
  });

  it('ne puca kad min/max iz baze nisu Date instance', async () => {
    const status = await dohvatiStatusAnalitike();
    expect(typeof status.imaMjerenja).toBe('boolean');
    if (status.mjerenjeOd) expect(() => new Date(status.mjerenjeOd!).toISOString()).not.toThrow();
    if (status.zadnjiZapisU) expect(() => new Date(status.zadnjiZapisU!).toISOString()).not.toThrow();
  });
});
