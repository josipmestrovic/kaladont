/**
 * Spajanje sažetka na UI badgee — null sekcija zadržava prethodni prikaz.
 */
import type { OdgovorNaslovnicaSazetka } from 'zajednicko';
import {
  izracunajPrikazIzazovaIzSazetka,
  type PrikazIzazovaKartice,
} from './naslovnica-izazovi.js';
import {
  normalizirajZvjezdiceDostignuca,
  type PrikazZvjezdicaDostignuca,
} from './naslovnica-dostignuca.js';
import { tekstSazetkaLjestvice } from './naslovnica-ljestvice.js';

export type BadgeiNaslovnice = {
  izazoviPrikaz: PrikazIzazovaKartice;
  brojRijeciKolekcije: number | null;
  dostignucaZvjezdice: PrikazZvjezdicaDostignuca;
  ljestviceTekst: string | null;
};

export function spojiSazetakNaBadgee(
  prethodno: BadgeiNaslovnice,
  sazetak: OdgovorNaslovnicaSazetka,
): BadgeiNaslovnice {
  return {
    izazoviPrikaz: sazetak.izazovi
      ? izracunajPrikazIzazovaIzSazetka(sazetak.izazovi)
      : prethodno.izazoviPrikaz,
    brojRijeciKolekcije: sazetak.kolekcija
      ? sazetak.kolekcija.ukupnoOtkljucano
      : prethodno.brojRijeciKolekcije,
    dostignucaZvjezdice: sazetak.dostignuca
      ? normalizirajZvjezdiceDostignuca(sazetak.dostignuca)
      : prethodno.dostignucaZvjezdice,
    ljestviceTekst: sazetak.ljestvice
      ? tekstSazetkaLjestvice(sazetak.ljestvice.status)
      : prethodno.ljestviceTekst,
  };
}
