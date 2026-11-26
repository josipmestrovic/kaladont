import { describe, expect, it } from 'vitest';
import { putanjaBotAvatara } from './bot-avatari.js';

describe('putanjaBotAvatara', () => {
  it('vraća stabilnu ilustraciju po nadimku samo za botove', () => {
    expect(putanjaBotAvatara({ jeBot: true, nadimak: 'BOTZILLA', igracId: 'racunalo-xyz' }))
      .toBe('/avatari/botovi/02-pastoljub.webp');
    expect(putanjaBotAvatara({ jeBot: true, nadimak: 'BOTINI', igracId: 'drugi-uuid' }))
      .toBe('/avatari/botovi/05-propelerko.webp');
    expect(putanjaBotAvatara({ jeBot: false, nadimak: 'BOTINI', igracId: 'covjek-1' })).toBeNull();
  });

  it('za nepoznatog bota koristi hash igracId fallback', () => {
    const a = putanjaBotAvatara({ jeBot: true, nadimak: 'StariBot', igracId: 'bot-stari-1' });
    const b = putanjaBotAvatara({ jeBot: true, nadimak: 'StariBot', igracId: 'bot-stari-1' });
    const c = putanjaBotAvatara({ jeBot: true, nadimak: 'StariBot', igracId: 'bot-stari-2' });
    expect(a).toBeTruthy();
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
