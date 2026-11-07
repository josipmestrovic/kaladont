import { describe, expect, it } from 'vitest';
import {
  hrvatskiBrojObavijesti,
  renderirajSanducicPoruku,
  tekstSanducicToasta,
  tekstZavrsnogSazetka,
  TIP_SANDUCIC_DOBRODOSLICA,
  TIP_SANDUCIC_PRIJAVA_IGRACA_UVAZENA,
  TIP_SANDUCIC_PRVA_IGRA,
} from '../src/sanducic.js';

describe('sandučic tekstovi', () => {
  it('bira ispravne hrvatske oblike', () => {
    expect(hrvatskiBrojObavijesti(1)).toBe('1 novu obavijest');
    expect(hrvatskiBrojObavijesti(2)).toBe('2 nove obavijesti');
    expect(hrvatskiBrojObavijesti(5)).toBe('5 novih obavijesti');
    expect(tekstSanducicToasta(3)).toBe('Imaš 3 nove obavijesti.');
    expect(tekstZavrsnogSazetka(1)).toBe('Imaš 1 novu obavijest');
  });

  it('renderira uvodne predloške', () => {
    const dobrodoslica = renderirajSanducicPoruku(TIP_SANDUCIC_DOBRODOSLICA, {
      email: 'ana@example.com',
      emailPotvrdjen: false,
    });
    expect(dobrodoslica.poveznica).toBe('/potvrdi-email');
    expect(dobrodoslica.tekst).toContain('ana@example.com');

    const potvrdeno = renderirajSanducicPoruku(TIP_SANDUCIC_DOBRODOSLICA, { emailPotvrdjen: true });
    expect(potvrdeno.poveznica).toBeNull();

    const gost = renderirajSanducicPoruku(TIP_SANDUCIC_PRVA_IGRA, { gost: true });
    expect(gost.poveznica).toBe('/registracija');
    const reg = renderirajSanducicPoruku(TIP_SANDUCIC_PRVA_IGRA, { gost: false });
    expect(reg.poveznica).toBe('/povratne-informacije');

    const nadimak = renderirajSanducicPoruku(TIP_SANDUCIC_PRIJAVA_IGRACA_UVAZENA, {
      razlog: 'pogrdan_nadimak',
    });
    expect(nadimak.tekst).toContain('vulgarni nadimak');
  });
});
