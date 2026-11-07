import { describe, expect, it } from 'vitest';
import { noviKolekcionarskiPragovi } from '../src/kolekcija.js';
import {
  hrvatskiBrojObavijesti,
  kljucPrekretniceForme10,
  kljucPrekretniceGostSazetak,
  renderirajSanducicPoruku,
  tekstSanducicToasta,
  tekstZavrsnogSazetka,
  TIP_SANDUCIC_DOBRODOSLICA,
  TIP_SANDUCIC_FORMA_10,
  TIP_SANDUCIC_GOST_SAZETAK_5,
  TIP_SANDUCIC_NOVA_KOLEKCIONARSKA_RAZINA,
  TIP_SANDUCIC_NOVA_XP_RAZINA,
  TIP_SANDUCIC_NOVA_ZVJEZDICA,
  TIP_SANDUCIC_PRIJAVA_IGRACA_UVAZENA,
  TIP_SANDUCIC_PROMJENA_RANGA,
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

  it('renderira PR3 predloške (XP, zvjezdica, kolekcija, rang)', () => {
    const xp = renderirajSanducicPoruku(TIP_SANDUCIC_NOVA_XP_RAZINA, { razina: 3 });
    expect(xp.tekst).toContain('LVL 3');
    expect(xp.poveznica).toBe('/profil');

    const prvaZvijezda = renderirajSanducicPoruku(TIP_SANDUCIC_NOVA_ZVJEZDICA, {
      naziv: 'Zagrijan',
      zvjezdice: 1,
    });
    expect(prvaZvijezda.naslov).toBe('Novo dostignuće!');
    expect(prvaZvijezda.tekst).toContain('Zagrijan');

    const novaZvijezda = renderirajSanducicPoruku(TIP_SANDUCIC_NOVA_ZVJEZDICA, {
      naziv: 'Zagrijan',
      zvjezdice: 2,
    });
    expect(novaZvijezda.naslov).toBe('Nova zvjezdica!');
    expect(novaZvijezda.tekst).toContain('2 zvjezdice');

    const kolekcija = renderirajSanducicPoruku(TIP_SANDUCIC_NOVA_KOLEKCIONARSKA_RAZINA, {
      naziv: 'Prvi koraci',
    });
    expect(kolekcija.tekst).toContain('Prvi koraci');

    const napredak = renderirajSanducicPoruku(TIP_SANDUCIC_PROMJENA_RANGA, {
      mod: 'Dvoboj',
      rang: 'Piskaralo',
      napredak: true,
    });
    expect(napredak.naslov).toBe('Novi rang!');
    expect(napredak.tekst).toContain('Dvoboj');

    const pad = renderirajSanducicPoruku(TIP_SANDUCIC_PROMJENA_RANGA, {
      mod: 'Četveroboj',
      rang: 'Početnik',
      napredak: false,
    });
    expect(pad.naslov).toBe('Promjena ranga');
  });

  it('računa nove kolekcionarske pragove', () => {
    expect(noviKolekcionarskiPragovi(9, 10).map((p) => p.prag)).toEqual([10]);
    expect(noviKolekcionarskiPragovi(9, 25).map((p) => p.prag)).toEqual([10, 25]);
    expect(noviKolekcionarskiPragovi(10, 10)).toEqual([]);
  });

  it('renderira PR4 predloške (forma i gost sažetak)', () => {
    expect(kljucPrekretniceForme10('dva_igraca', 10)).toBe('forma_10:dva_igraca:10');
    expect(kljucPrekretniceGostSazetak(15)).toBe('gost_sazetak:15');

    const dobra = renderirajSanducicPoruku(TIP_SANDUCIC_FORMA_10, {
      mod: 'Dvoboj',
      nazivForme: 'Dobra',
      pobjede: 4,
      trenutniNiz: 2,
    });
    expect(dobra.tekst).toContain('4 pobjede');
    expect(dobra.tekst).toContain('Bravo');
    expect(dobra.poveznica).toBe('/profil#statistika');

    const losa = renderirajSanducicPoruku(TIP_SANDUCIC_FORMA_10, {
      mod: 'Četveroboj',
      nazivForme: 'Loša',
      pobjede: 0,
      trenutniNiz: 0,
    });
    expect(losa.tekst).toContain('Nova igra, nova prilika');

    const gost = renderirajSanducicPoruku(TIP_SANDUCIC_GOST_SAZETAK_5, {
      odigrano: 5,
      pobjede: 2,
      razina: 3,
      brojDostignuca: 2,
      brojZvjezdica: 3,
    });
    expect(gost.tekst).toContain('Odigrano: 5');
    expect(gost.poveznica).toBe('/registracija');

    const reg = renderirajSanducicPoruku(TIP_SANDUCIC_GOST_SAZETAK_5, { registriran: true });
    expect(reg.tekst).toContain('sačuvan registracijom');
    expect(reg.poveznica).toBeNull();
  });
});
