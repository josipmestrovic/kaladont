/**
 * Ugovor za objedinjeni sažetak naslovnice (`GET /api/naslovnica/sazetak`).
 * Namijenjen isključivo prikazu naslovnice / Headera — detaljne stranice zadržavaju svoje endpointe.
 */
import type { AvatarConfigV1 } from './avatar.js';
import type { StanjeIskustva } from './iskustvo.js';
import type { StatusSazetkaLjestvice } from './ljestvice.js';
import type { SanducicPorukaDetalj, SanducicPorukaSazetak } from './sanducic.js';

export type VrstaIgracaNaslovnice = 'gost' | 'registriran' | 'admin';

export interface NaslovnicaProfilSazetak {
  igracId: string;
  nadimak: string;
  vrsta: VrstaIgracaNaslovnice;
  avatarId: number;
  avatarConfig: AvatarConfigV1 | null;
  email: string | null;
  rang: string | null;
  rang1v1: string | null;
  iskustvo: StanjeIskustva;
}

export interface NaslovnicaIzazoviSazetak {
  omogucen: boolean;
  zavrseno: number;
  ukupno: number;
}

export interface NaslovnicaMisijeSazetak {
  dnevneAktivne: number;
  tjedneAktivne: number;
  ukupnoAktivnih: number;
  novosti: { dnevne: boolean; tjedne: boolean };
}

export interface NaslovnicaDostignucaSazetak {
  ukupnoZvjezdica: number;
  maksimalnoZvjezdica: number;
}

export interface NaslovnicaLjestviceSazetak {
  status: StatusSazetkaLjestvice;
  izracunatoU: string;
}

export interface NaslovnicaObavijestiSazetak {
  brojNeprocitanih: number;
  zaNajavu: SanducicPorukaSazetak[];
  neprocitane: SanducicPorukaDetalj[];
  sljedeciCursor: string | null;
}

export interface OdgovorNaslovnicaSazetka {
  ok: true;
  igracId: string;
  profil: NaslovnicaProfilSazetak;
  izazovi: NaslovnicaIzazoviSazetak;
  /** `null` za gosta — misije zahtijevaju registraciju. */
  misije: NaslovnicaMisijeSazetak | null;
  kolekcija: { ukupnoOtkljucano: number };
  dostignuca: NaslovnicaDostignucaSazetak;
  ljestvice: NaslovnicaLjestviceSazetak;
  obavijesti: NaslovnicaObavijestiSazetak;
}
