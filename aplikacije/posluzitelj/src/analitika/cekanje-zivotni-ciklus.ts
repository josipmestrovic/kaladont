/**
 * Memorijski životni ciklus pokušaja javne čekaonice.
 * INSERT samo pri terminalnom ishodu; ne mijenja matchmaking.
 */
import { randomUUID } from 'node:crypto';
import type { KljucJavnogReda, ModPartije, PravilnikPartije } from 'zajednicko';
import { zabiljeziZapisCekanja } from './cekanje-upis.js';

export type IshodAnalitikeCekanja =
  | 'uparivanje'
  | 'napustanje'
  | 'prekid_veze'
  | 'promjena_reda'
  | 'uklonjen';

export type VrstaRacunaCekanja = 'gost' | 'registriran';

export interface SnimkaPokusajaCekanja {
  attemptId: string;
  generacija: number;
  kljucReda: KljucJavnogReda;
  mod: ModPartije;
  pravila: PravilnikPartije;
  vrstaRacuna: VrstaRacunaCekanja;
  pocetakU: Date;
}

interface AktivniPokusaj extends SnimkaPokusajaCekanja {
  igracId: string;
  zatvoren: boolean;
  pokretanjeUTijeku: boolean;
  odgodeniIshod: IshodAnalitikeCekanja | null;
}

const poIgracu = new Map<string, AktivniPokusaj>();
/** Pokušaji u tijeku pokretanja koje više nisu „trenutni” za igrača (npr. nakon promjene reda). */
const odlozeni = new Map<string, AktivniPokusaj>();

function kljucOdlozenog(igracId: string, generacija: number): string {
  return `${igracId}:${generacija}`;
}

export function resetirajCekanjeZivotniCiklusZaTest(): void {
  poIgracu.clear();
  odlozeni.clear();
}

function snimka(p: AktivniPokusaj): SnimkaPokusajaCekanja {
  return {
    attemptId: p.attemptId,
    generacija: p.generacija,
    kljucReda: p.kljucReda,
    mod: p.mod,
    pravila: p.pravila,
    vrstaRacuna: p.vrstaRacuna,
    pocetakU: p.pocetakU,
  };
}

function ukloniIzMapa(p: AktivniPokusaj): void {
  if (poIgracu.get(p.igracId)?.attemptId === p.attemptId) poIgracu.delete(p.igracId);
  odlozeni.delete(kljucOdlozenog(p.igracId, p.generacija));
}

function zatvori(p: AktivniPokusaj, ishod: IshodAnalitikeCekanja, krajU = new Date()): void {
  if (p.zatvoren) return;
  p.zatvoren = true;
  p.pokretanjeUTijeku = false;
  p.odgodeniIshod = null;
  ukloniIzMapa(p);
  zabiljeziZapisCekanja(snimka(p), ishod, krajU);
}

function nadji(igracId: string, generacija?: number): AktivniPokusaj | undefined {
  if (generacija != null) {
    const odg = odlozeni.get(kljucOdlozenog(igracId, generacija));
    if (odg && !odg.zatvoren) return odg;
    const trenutni = poIgracu.get(igracId);
    if (trenutni && !trenutni.zatvoren && trenutni.generacija === generacija) return trenutni;
    return undefined;
  }
  return poIgracu.get(igracId);
}

export function otvoriPokusajCekanja(opcije: {
  igracId: string;
  generacija: number;
  kljucReda: KljucJavnogReda;
  mod: ModPartije;
  pravila: PravilnikPartije;
  vrstaRacuna: VrstaRacunaCekanja;
  pocetakU: Date;
}): string {
  const stari = poIgracu.get(opcije.igracId);
  if (stari && !stari.zatvoren) {
    if (stari.pokretanjeUTijeku) {
      if (!stari.odgodeniIshod) stari.odgodeniIshod = 'promjena_reda';
      odlozeni.set(kljucOdlozenog(stari.igracId, stari.generacija), stari);
      poIgracu.delete(opcije.igracId);
    } else {
      zatvori(stari, 'promjena_reda');
    }
  }

  const attemptId = randomUUID();
  poIgracu.set(opcije.igracId, {
    igracId: opcije.igracId,
    attemptId,
    generacija: opcije.generacija,
    kljucReda: opcije.kljucReda,
    mod: opcije.mod,
    pravila: opcije.pravila,
    vrstaRacuna: opcije.vrstaRacuna,
    pocetakU: opcije.pocetakU,
    zatvoren: false,
    pokretanjeUTijeku: false,
    odgodeniIshod: null,
  });
  return attemptId;
}

/** Traži zatvaranje; ako traje pokretanje stola, odgodi ishod. */
export function zatvoriPokusajCekanja(
  igracId: string,
  ishod: IshodAnalitikeCekanja,
  opcije?: { generacija?: number },
): void {
  const p = nadji(igracId, opcije?.generacija);
  if (!p || p.zatvoren) return;
  if (opcije?.generacija != null && p.generacija !== opcije.generacija) return;
  if (p.pokretanjeUTijeku) {
    p.odgodeniIshod = ishod;
    return;
  }
  zatvori(p, ishod);
}

export function oznaciPokretanjeCekanja(
  sudionici: ReadonlyArray<{ igracId: string; generacija: number }>,
): void {
  for (const s of sudionici) {
    const p = nadji(s.igracId, s.generacija);
    if (!p || p.zatvoren) continue;
    p.pokretanjeUTijeku = true;
  }
}

export function zavrsiPokretanjeUparivanje(
  sudionici: ReadonlyArray<{ igracId: string; generacija: number }>,
): void {
  for (const s of sudionici) {
    const p = nadji(s.igracId, s.generacija);
    if (!p || p.zatvoren) continue;
    zatvori(p, 'uparivanje');
  }
}

export function zavrsiPokretanjeNeuspjeh(
  sudionici: ReadonlyArray<{ igracId: string; generacija: number }>,
  vraceniIgracIdovi: ReadonlySet<string>,
): void {
  for (const s of sudionici) {
    const p = nadji(s.igracId, s.generacija);
    if (!p || p.zatvoren) continue;
    p.pokretanjeUTijeku = false;
    if (vraceniIgracIdovi.has(s.igracId)) {
      p.odgodeniIshod = null;
      // Ako je bio odložen, vrati ga kao trenutni samo ako igrač nema noviji pokušaj.
      const trenutni = poIgracu.get(s.igracId);
      if (!trenutni || trenutni.attemptId === p.attemptId) {
        poIgracu.set(s.igracId, p);
        odlozeni.delete(kljucOdlozenog(s.igracId, s.generacija));
      }
      continue;
    }
    zatvori(p, p.odgodeniIshod ?? 'uklonjen');
  }
}

export function zatvoriSvePokusajeCekanja(ishod: IshodAnalitikeCekanja = 'uklonjen'): void {
  for (const p of [...poIgracu.values(), ...odlozeni.values()]) {
    if (!p.zatvoren) zatvori(p, ishod);
  }
}

export function dohvatiAktivniPokusajZaTest(igracId: string): AktivniPokusaj | undefined {
  return poIgracu.get(igracId);
}
