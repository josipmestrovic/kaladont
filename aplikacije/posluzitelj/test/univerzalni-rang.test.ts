import { describe, expect, it } from 'vitest';
import { izracunajDoprinoseStola, primaUniverzalniRangAgregat } from '../src/igra/univerzalni-rang.js';
import { vratiVeciRang } from 'zajednicko';

describe('univerzalni-rang (PR09)', () => {
  it('prima agregat samo registrirani/admin ljudi', () => {
    expect(primaUniverzalniRangAgregat('covjek', 'registriran')).toBe(true);
    expect(primaUniverzalniRangAgregat('covjek', 'admin')).toBe(true);
    expect(primaUniverzalniRangAgregat('covjek', 'gost')).toBe(false);
    expect(primaUniverzalniRangAgregat('bot', 'registriran')).toBe(false);
  });

  it('vratiVeciRang i dalje bira viši naziv (za --usporedi)', () => {
    expect(vratiVeciRang('Lektor', 'Kaladont')).toBe('Kaladont');
    expect(vratiVeciRang('Kaladont', 'Lektor')).toBe('Kaladont');
    expect(vratiVeciRang(null, 'Lektor')).toBe('Lektor');
  });

  it('izračuna doprinose stola za Troboj 4,2,0', () => {
    const { n, s, poIgracu } = izracunajDoprinoseStola([
      { igracId: 'a', bodovi: 4, upravljac: 'covjek', vrstaIgraca: 'registriran' },
      { igracId: 'b', bodovi: 2, upravljac: 'covjek', vrstaIgraca: 'registriran' },
      { igracId: 'c', bodovi: 0, upravljac: 'bot', vrstaIgraca: 'registriran' },
    ]);
    expect(n).toBe(3);
    expect(s).toBe(6);
    expect(poIgracu.get('a')).toBe(200 * 2520);
    expect(poIgracu.get('b')).toBe(100 * 2520);
    expect(poIgracu.get('c')).toBe(0);
  });
});
