import { describe, expect, it } from 'vitest';
import type { OdgovorNaslovnicaSazetka } from 'zajednicko';
import { spojiSazetakNaBadgee, type BadgeiNaslovnice } from './naslovnica-sazetak-ui.js';

const prethodno: BadgeiNaslovnice = {
  izazoviPrikaz: { vrsta: 'napredak', opis: '12 / 45' },
  brojRijeciKolekcije: 42,
  dostignucaZvjezdice: { ukupno: 7, maksimalno: 40 },
  ljestviceTekst: '1. mjesto',
};

function sazetakDjelomicno(
  patch: Partial<OdgovorNaslovnicaSazetka>,
): OdgovorNaslovnicaSazetka {
  return {
    ok: true,
    igracId: 'id-1',
    profil: {
      igracId: 'id-1',
      nadimak: 'Test',
      vrsta: 'gost',
      avatarId: 0,
      avatarConfig: null,
      email: null,
      rang: 'Piskaralo',
      rang1v1: 'Piskaralo',
      iskustvo: { razina: 1, ukupno: 0, uRazini: 0, doIduce: 240 },
    },
    izazovi: null,
    misije: null,
    kolekcija: null,
    dostignuca: null,
    ljestvice: null,
    obavijesti: null,
    ...patch,
  };
}

describe('spojiSazetakNaBadgee', () => {
  it('null sekcije ne resetiraju prethodne badgee', () => {
    const rezultat = spojiSazetakNaBadgee(prethodno, sazetakDjelomicno({}));
    expect(rezultat).toEqual(prethodno);
  });

  it('ne-null sekcije ažuriraju samo taj badge', () => {
    const rezultat = spojiSazetakNaBadgee(
      prethodno,
      sazetakDjelomicno({
        kolekcija: { ukupnoOtkljucano: 99 },
        dostignuca: { ukupnoZvjezdica: 3, maksimalnoZvjezdica: 40 },
      }),
    );
    expect(rezultat.brojRijeciKolekcije).toBe(99);
    expect(rezultat.dostignucaZvjezdice.ukupno).toBe(3);
    expect(rezultat.izazoviPrikaz).toEqual(prethodno.izazoviPrikaz);
    expect(rezultat.ljestviceTekst).toBe(prethodno.ljestviceTekst);
  });
});
