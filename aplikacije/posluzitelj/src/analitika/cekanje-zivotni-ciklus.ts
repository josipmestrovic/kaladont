/**
 * Memorijski životni ciklus pokušaja javne čekaonice.
 * INSERT samo pri terminalnom ishodu; ne mijenja matchmaking.
 * Stanje je po instanci (servis reda), ne dijeljeno na razini modula.
 */
import { randomUUID } from 'node:crypto';
import type { KljucJavnogReda, ModPartije, PravilnikPartije } from 'zajednicko';

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

export interface AktivniPokusajCekanjaZaTest extends SnimkaPokusajaCekanja {
  igracId: string;
  zatvoren: boolean;
  pokretanjeUTijeku: boolean;
  odgodeniIshod: IshodAnalitikeCekanja | null;
  odgodeniU: Date | null;
}

type AktivniPokusaj = AktivniPokusajCekanjaZaTest;

export type ZabiljeziZapisCekanjaFn = (
  snimka: SnimkaPokusajaCekanja,
  ishod: IshodAnalitikeCekanja,
  krajU?: Date,
) => void;

export interface CekanjeZivotniCiklus {
  otvoriPokusajCekanja(opcije: {
    igracId: string;
    generacija: number;
    kljucReda: KljucJavnogReda;
    mod: ModPartije;
    pravila: PravilnikPartije;
    vrstaRacuna: VrstaRacunaCekanja;
    pocetakU: Date;
  }): string;
  zatvoriPokusajCekanja(
    igracId: string,
    ishod: IshodAnalitikeCekanja,
    opcije?: { generacija?: number; krajU?: Date },
  ): void;
  oznaciPokretanjeCekanja(
    sudionici: ReadonlyArray<{ igracId: string; generacija: number }>,
  ): void;
  zavrsiPokretanjeUparivanje(
    sudionici: ReadonlyArray<{ igracId: string; generacija: number }>,
  ): void;
  zavrsiPokretanjeNeuspjeh(
    sudionici: ReadonlyArray<{ igracId: string; generacija: number }>,
    vraceniIgracIdovi: ReadonlySet<string>,
  ): void;
  zatvoriSvePokusajeCekanja(ishod?: IshodAnalitikeCekanja): void;
  dohvatiAktivniPokusajZaTest(igracId: string): AktivniPokusajCekanjaZaTest | undefined;
  brojAktivnihZaTest(): number;
}

function kljucOdlozenog(igracId: string, generacija: number): string {
  return `${igracId}:${generacija}`;
}

/** Nova izolirana instanca životnog ciklusa (jedna po servisu reda). */
export function stvoriCekanjeZivotniCiklus(opcije: {
  zabiljezi: ZabiljeziZapisCekanjaFn;
}): CekanjeZivotniCiklus {
  const zabiljezi = opcije.zabiljezi;
  const poIgracu = new Map<string, AktivniPokusaj>();
  /** Pokušaji u tijeku pokretanja koje više nisu „trenutni” za igrača (npr. nakon promjene reda). */
  const odlozeni = new Map<string, AktivniPokusaj>();

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
    p.odgodeniU = null;
    ukloniIzMapa(p);
    zabiljezi(snimka(p), ishod, krajU);
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

  /** Prvi valjani odgođeni ishod i njegovo vrijeme ostaju; naknadni događaji ne prepisuju. */
  function odgodiIshod(p: AktivniPokusaj, ishod: IshodAnalitikeCekanja, u: Date): void {
    if (p.odgodeniIshod != null) return;
    p.odgodeniIshod = ishod;
    p.odgodeniU = u;
  }

  return {
    otvoriPokusajCekanja(opcijeOtvaranja) {
      const stari = poIgracu.get(opcijeOtvaranja.igracId);
      if (stari && !stari.zatvoren) {
        if (stari.pokretanjeUTijeku) {
          odgodiIshod(stari, 'promjena_reda', new Date());
          odlozeni.set(kljucOdlozenog(stari.igracId, stari.generacija), stari);
          poIgracu.delete(opcijeOtvaranja.igracId);
        } else {
          zatvori(stari, 'promjena_reda');
        }
      }

      const attemptId = randomUUID();
      poIgracu.set(opcijeOtvaranja.igracId, {
        igracId: opcijeOtvaranja.igracId,
        attemptId,
        generacija: opcijeOtvaranja.generacija,
        kljucReda: opcijeOtvaranja.kljucReda,
        mod: opcijeOtvaranja.mod,
        pravila: opcijeOtvaranja.pravila,
        vrstaRacuna: opcijeOtvaranja.vrstaRacuna,
        pocetakU: opcijeOtvaranja.pocetakU,
        zatvoren: false,
        pokretanjeUTijeku: false,
        odgodeniIshod: null,
        odgodeniU: null,
      });
      return attemptId;
    },

    zatvoriPokusajCekanja(igracId, ishod, opcijeZatvaranja) {
      const p = nadji(igracId, opcijeZatvaranja?.generacija);
      if (!p || p.zatvoren) return;
      if (opcijeZatvaranja?.generacija != null && p.generacija !== opcijeZatvaranja.generacija) return;
      const krajU = opcijeZatvaranja?.krajU ?? new Date();
      if (p.pokretanjeUTijeku) {
        odgodiIshod(p, ishod, krajU);
        return;
      }
      zatvori(p, ishod, krajU);
    },

    oznaciPokretanjeCekanja(sudionici) {
      for (const s of sudionici) {
        const p = nadji(s.igracId, s.generacija);
        if (!p || p.zatvoren) continue;
        p.pokretanjeUTijeku = true;
      }
    },

    zavrsiPokretanjeUparivanje(sudionici) {
      for (const s of sudionici) {
        const p = nadji(s.igracId, s.generacija);
        if (!p || p.zatvoren) continue;
        zatvori(p, 'uparivanje');
      }
    },

    zavrsiPokretanjeNeuspjeh(sudionici, vraceniIgracIdovi) {
      for (const s of sudionici) {
        const p = nadji(s.igracId, s.generacija);
        if (!p || p.zatvoren) continue;
        p.pokretanjeUTijeku = false;
        if (vraceniIgracIdovi.has(s.igracId)) {
          p.odgodeniIshod = null;
          p.odgodeniU = null;
          // Ako je bio odložen, vrati ga kao trenutni samo ako igrač nema noviji pokušaj.
          const trenutni = poIgracu.get(s.igracId);
          if (!trenutni || trenutni.attemptId === p.attemptId) {
            poIgracu.set(s.igracId, p);
            odlozeni.delete(kljucOdlozenog(s.igracId, s.generacija));
          }
          continue;
        }
        const ishod = p.odgodeniIshod ?? 'uklonjen';
        const krajU = p.odgodeniU ?? new Date();
        zatvori(p, ishod, krajU);
      }
    },

    zatvoriSvePokusajeCekanja(ishod: IshodAnalitikeCekanja = 'uklonjen') {
      for (const p of [...poIgracu.values(), ...odlozeni.values()]) {
        if (!p.zatvoren) zatvori(p, ishod);
      }
    },

    dohvatiAktivniPokusajZaTest(igracId) {
      return poIgracu.get(igracId);
    },

    brojAktivnihZaTest() {
      let n = 0;
      for (const p of poIgracu.values()) if (!p.zatvoren) n += 1;
      for (const p of odlozeni.values()) if (!p.zatvoren) n += 1;
      return n;
    },
  };
}
