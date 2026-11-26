import { describe, expect, it } from 'vitest';
import {
  BROJ_JAVNIH_BOTOVA_V5,
  ILUSTRACIJE_BOTOVA,
  KLJUCEVI_ILUSTRACIJA_BOTA,
  NADIMCI_JAVNIH_BOTOVA_V5,
  POSTAVA_TRENING_IZAZOV,
  REZERVNI_NADIMAK_JAVNOG_FONDA_V5,
  jeNadimakJavnogFondaV5,
  jeOdobrenNadimakBota,
  dijeloviNadimkaBota,
  formatirajNadimakBota,
  kljucIlustracijeBota,
  nadimakProfilaBota,
  profilIzNadimkaFiksnogBota,
  putanjaIlustracijeBota,
} from '../src/bot-identiteti.js';

describe('bot-identiteti V5', () => {
  it('ima točno 46 jedinstvenih javnih nadimaka s BOT', () => {
    expect(NADIMCI_JAVNIH_BOTOVA_V5).toHaveLength(46);
    expect(BROJ_JAVNIH_BOTOVA_V5).toBe(46);
    const jedinstveni = new Set(NADIMCI_JAVNIH_BOTOVA_V5.map((n) => n.toLocaleUpperCase('hr-HR')));
    expect(jedinstveni.size).toBe(46);
    for (const nadimak of NADIMCI_JAVNIH_BOTOVA_V5) {
      expect(nadimak).toBe(nadimak.toLocaleUpperCase('hr-HR'));
      expect(nadimak.includes('BOT') || nadimak === 'SABOTER' || nadimak === 'SUBOTA' || nadimak === 'KALABOT').toBe(true);
      expect(jeNadimakJavnogFondaV5(nadimak)).toBe(true);
    }
    expect(jeNadimakJavnogFondaV5(REZERVNI_NADIMAK_JAVNOG_FONDA_V5)).toBe(false);
    expect(jeOdobrenNadimakBota(REZERVNI_NADIMAK_JAVNOG_FONDA_V5)).toBe(true);
  });

  it('fiksna postava ima 3 različita imena po težini i stabilan redoslijed', () => {
    expect(nadimakProfilaBota('pocetnik', 1, 1)).toBe('BOTINI');
    expect(nadimakProfilaBota('pocetnik', 1, 2)).toBe('BOTINI');
    expect(nadimakProfilaBota('pocetnik', 2, 2)).toBe('BOTULJAK');
    expect(nadimakProfilaBota('velemajstor', 1, 3)).toBe('BOTZILLA');
    expect(nadimakProfilaBota('velemajstor', 2, 3)).toBe('BOTOKALIPSA');
    expect(nadimakProfilaBota('velemajstor', 3, 3)).toBe('BOTIVZAUBOJSTVO');
    for (const [profil, postava] of Object.entries(POSTAVA_TRENING_IZAZOV)) {
      expect(new Set(postava).size).toBe(3);
      expect(profilIzNadimkaFiksnogBota(postava[0])).toBe(profil);
      expect(profilIzNadimkaFiksnogBota(postava[2])).toBe(profil);
    }
  });

  it('mapa ilustracija pokriva sve poznate likove i svih 20 asseta', () => {
    for (const nadimak of NADIMCI_JAVNIH_BOTOVA_V5) {
      expect(kljucIlustracijeBota(nadimak)).toBeTruthy();
      expect(putanjaIlustracijeBota(nadimak)).toMatch(/^\/avatari\/botovi\/.+\.webp$/);
    }
    for (const postava of Object.values(POSTAVA_TRENING_IZAZOV)) {
      for (const nadimak of postava) {
        expect(kljucIlustracijeBota(nadimak)).toBeTruthy();
      }
    }
    expect(kljucIlustracijeBota('BOTINI')).toBe(kljucIlustracijeBota('botini'));
    expect(kljucIlustracijeBota('BOTATOUILLE')).toBe('13-ekspres-lonac');
    expect(kljucIlustracijeBota('BOTZILLA')).toBe('02-pastoljub');
    const zastupljeni = new Set(Object.values(ILUSTRACIJE_BOTOVA));
    expect([...KLJUCEVI_ILUSTRACIJA_BOTA].every((k) => zastupljeni.has(k))).toBe(true);
    expect(kljucIlustracijeBota('NepoznatiBot')).toBeNull();
  });

  it('prikaz nadimka: BOT velikim, ostatak malim', () => {
    expect(formatirajNadimakBota('BOTINA')).toBe('BOTina');
    expect(formatirajNadimakBota('BOTANIČAR')).toBe('BOTaničar');
    expect(formatirajNadimakBota('SABOTER')).toBe('saBOTer');
    expect(formatirajNadimakBota('KALABOT')).toBe('kalaBOT');
    expect(dijeloviNadimkaBota('BOTZILLA')).toEqual({ prije: '', bot: 'BOT', poslije: 'zilla' });
    expect(dijeloviNadimkaBota('covjek')).toBeNull();
  });
});
