/**
 * PR13 — četiri nova dostignuća + Dvostruka kruna s Trobojem + Na dvije fronte pairing.
 */
import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import {
  ID_DOSTIGNUCA_DVOSTRUKA_KRUNA,
  ID_DOSTIGNUCA_IMAM_NASTAVAK,
  ID_DOSTIGNUCA_NA_DVIJE_FRONTE,
  ID_DOSTIGNUCA_SALJI_DALJE,
  ID_DOSTIGNUCA_STARA_SKOLA,
  ID_DOSTIGNUCA_TRECA_SRECA,
} from 'zajednicko';
import { baza } from '../src/baza/klijent.js';
import {
  dnkStatistikeIgraca,
  dokaziDostignucaDvostrukaKruna,
  dokaziDostignucaImamNastavak,
  dokaziDostignucaNaDvijeFronte,
  dokaziDostignucaSaljiDalje,
  dokaziDostignucaStaraSkola,
  dokaziDostignucaTop10,
  dokaziDostignucaTrecaSreca,
  dokaziTop10Ulazaka,
  dostignucaIgraca,
  evidencijaDnevnihPobjedaModova,
  igraci,
  napredakDostignucaIgraca,
  obavijestiIgraca,
  obracuniPartija,
  partije,
  pohvaleIgre,
  sudioniciPartije,
  ucinakPosebneRijeci,
} from '../src/baza/shema.js';
import { priznajDnevnuPobjeduModa } from '../src/dostignuca/dodjela-d02.js';
import {
  priznajImamNastavak,
  priznajSaljiDalje,
  priznajStaruSkolu,
  priznajTrecuSrecu,
} from '../src/dostignuca/dodjela-pr13.js';
import { preispitajParoveNaDvijeFronte } from '../src/dostignuca/top10.js';
import { zakljuciPartijuUBazi, type ZapisStatistikeRijeci } from '../src/igra/upis-partije.js';

const igraciZaBrisanje: string[] = [];
const partijeZaBrisanje: string[] = [];

function statistika(
  igracId: string,
  extras: Partial<ZapisStatistikeRijeci> = {},
): ZapisStatistikeRijeci {
  return {
    igracId,
    grupe: [],
    otkljucaneRijeci: [],
    prihvaceniPotezi: 1,
    ukupnoTrajanjePrihvaceniPoteziMs: 1000,
    najduziStreak: 1,
    otkriveneJakoRijetkeGrupe: 0,
    otkriveneSrednjeRijetkeGrupe: 0,
    otkriveneRijetkeGrupe: 0,
    upisaneDugeRijeci: 0,
    upisaneSrednjeDugeRijeci: 0,
    upisaneJakoDugeRijeci: 0,
    najduzaRijec: 'test',
    najduzaRijecGrafemi: 4,
    najrjedaRijec: null,
    najrjedaRijecFrekvencija: null,
    najrjedaTier: null,
    pogresniUnosi: 0,
    dugeRijetkeRijeci: [],
    uspjesniDokazi: 0,
    kaladontSljedeciUzTriPlus: 0,
    ...extras,
  };
}

async function noviIgrac(nadimak: string): Promise<string> {
  const id = randomUUID();
  igraciZaBrisanje.push(id);
  await baza.insert(igraci).values({
    id,
    vrsta: 'registriran',
    nadimak,
    email: `${nadimak}-${id}@example.com`,
  });
  return id;
}

async function novaPartija(
  mod: 'dva_igraca' | 'tri_igraca' | 'cetiri_igraca' = 'tri_igraca',
  pravila: 'klasicni' | 'ka_zna' | 'dokazi_nastavak' = 'ka_zna',
  spojeniDvoboj = false,
): Promise<string> {
  const id = randomUUID();
  partijeZaBrisanje.push(id);
  await baza.insert(partije).values({ id, mod, status: 'u_tijeku', pravila, spojeniDvoboj });
  return id;
}

describe('dostignuća PR13', () => {
  afterEach(async () => {
    for (const partijaId of partijeZaBrisanje.splice(0)) {
      await baza.delete(ucinakPosebneRijeci).where(eq(ucinakPosebneRijeci.partijaId, partijaId));
      await baza.delete(dokaziDostignucaTrecaSreca).where(eq(dokaziDostignucaTrecaSreca.partijaId, partijaId));
      await baza.delete(dokaziDostignucaImamNastavak).where(eq(dokaziDostignucaImamNastavak.partijaId, partijaId));
      await baza.delete(dokaziDostignucaSaljiDalje).where(eq(dokaziDostignucaSaljiDalje.partijaId, partijaId));
      await baza.delete(dokaziDostignucaStaraSkola).where(eq(dokaziDostignucaStaraSkola.partijaId, partijaId));
      await baza.delete(pohvaleIgre).where(eq(pohvaleIgre.igraId, partijaId));
      await baza.delete(obracuniPartija).where(eq(obracuniPartija.partijaId, partijaId));
      await baza.delete(sudioniciPartije).where(eq(sudioniciPartije.partijaId, partijaId));
      await baza.delete(partije).where(eq(partije.id, partijaId));
    }
    for (const igracId of igraciZaBrisanje.splice(0)) {
      await baza.delete(dokaziTop10Ulazaka).where(eq(dokaziTop10Ulazaka.igracId, igracId));
      await baza.delete(dokaziDostignucaTop10).where(eq(dokaziDostignucaTop10.igracId, igracId));
      await baza.delete(dokaziDostignucaNaDvijeFronte).where(eq(dokaziDostignucaNaDvijeFronte.igracId, igracId));
      await baza.delete(dokaziDostignucaDvostrukaKruna).where(eq(dokaziDostignucaDvostrukaKruna.igracId, igracId));
      await baza.delete(evidencijaDnevnihPobjedaModova).where(eq(evidencijaDnevnihPobjedaModova.igracId, igracId));
      await baza.delete(obavijestiIgraca).where(eq(obavijestiIgraca.igracId, igracId));
      await baza.delete(dostignucaIgraca).where(eq(dostignucaIgraca.igracId, igracId));
      await baza.delete(napredakDostignucaIgraca).where(eq(napredakDostignucaIgraca.igracId, igracId));
      await baza.delete(dnkStatistikeIgraca).where(eq(dnkStatistikeIgraca.igracId, igracId));
      await baza.delete(igraci).where(eq(igraci.id, igracId));
    }
  });

  // --- Treća sreća ---
  it('Treća sreća+: Troboj pobjeda; −: Dvoboj i trening', async () => {
    const igracId = await noviIgrac('Treca');
    const zavrsenoU = new Date('2026-11-16T10:00:00.000Z');
    const trobojId = await novaPartija('tri_igraca');

    const troboj = await baza.transaction((tx) =>
      priznajTrecuSrecu(tx, { igracId, partijaId: trobojId, mod: 'tri_igraca', zavrsenoU }));
    expect(troboj.novaDostignuca[0]?.id).toBe(ID_DOSTIGNUCA_TRECA_SRECA);

    const dvobojId = await novaPartija('dva_igraca');
    const dvoboj = await baza.transaction((tx) =>
      priznajTrecuSrecu(tx, { igracId, partijaId: dvobojId, mod: 'dva_igraca', zavrsenoU }));
    expect(dvoboj.doprinosUmetnut).toBe(false);

    // trening / privatno ide kroz samoStatistika — priznajTrecuSrecu se ne zove.
    const partijaId = await novaPartija('tri_igraca');
    await baza.insert(sudioniciPartije).values({ partijaId, igracId, sjedalo: 0 });
    const privatno = await zakljuciPartijuUBazi(
      partijaId,
      igracId,
      [{ igracId, plasman: 1, bodovi: 5, eliminacije: 0, iskustvo: 1, nacinIspadanja: 'pobjednik' }],
      'tri_igraca',
      new Map([[igracId, statistika(igracId)]]),
      true,
      new Map(),
      zavrsenoU,
    );
    expect(privatno.get(igracId)?.novaDostignuca.some((d) => d.id === ID_DOSTIGNUCA_TRECA_SRECA)).toBe(false);

    const [napredak] = await baza.select({ n: napredakDostignucaIgraca.trobojPobjede })
      .from(napredakDostignucaIgraca).where(eq(napredakDostignucaIgraca.igracId, igracId));
    expect(napredak?.n).toBe(1);
  });

  // --- Imam nastavak ---
  it('Imam nastavak: 2 dokaza u jednoj igri → +1; retry istog partija_id → 0', async () => {
    const igracId = await noviIgrac('Imam');
    const partijaId = await novaPartija('dva_igraca', 'dokazi_nastavak');
    const zavrsenoU = new Date('2026-11-16T11:00:00.000Z');

    const prvi = await baza.transaction((tx) =>
      priznajImamNastavak(tx, { igracId, partijaId, uspjesniDokazi: 2, zavrsenoU }));
    expect(prvi.novaDostignuca).toEqual([
      { id: ID_DOSTIGNUCA_IMAM_NASTAVAK, novaRazina: 1, maksimalnaRazina: 5 },
    ]);

    const retry = await baza.transaction((tx) =>
      priznajImamNastavak(tx, { igracId, partijaId, uspjesniDokazi: 5, zavrsenoU }));
    expect(retry.doprinosUmetnut).toBe(false);

    const drugaIgra = await novaPartija();
    const nula = await baza.transaction((tx) =>
      priznajImamNastavak(tx, { igracId, partijaId: drugaIgra, uspjesniDokazi: 0, zavrsenoU }));
    expect(nula.doprinosUmetnut).toBe(false);

    const [napredak] = await baza.select({ n: napredakDostignucaIgraca.igreSDokazom })
      .from(napredakDostignucaIgraca).where(eq(napredakDostignucaIgraca.igracId, igracId));
    expect(napredak?.n).toBe(1);
  });

  // --- Šalji dalje ---
  it('Šalji dalje: 2 valjana ucinka → +2; 2 aktivna → 0; ne-klasični → 0', async () => {
    const igracId = await noviIgrac('Salji');
    const zavrsenoU = new Date('2026-11-16T12:00:00.000Z');

    const zrtvaId = await noviIgrac('ZrtvaSalji');
    const klasicna = await novaPartija('cetiri_igraca', 'klasicni');
    await baza.insert(ucinakPosebneRijeci).values([
      {
        partijaId: klasicna,
        redniBroj: 1,
        rijec: 'kaladont',
        uzrocnikId: igracId,
        zrtvaId,
        vrstaMete: 'sljedeci',
        brojAktivnihPrije: 4,
        ucinak: 'eliminacija',
      },
      {
        partijaId: klasicna,
        redniBroj: 2,
        rijec: 'kalodont',
        uzrocnikId: igracId,
        zrtvaId,
        vrstaMete: 'sljedeci',
        brojAktivnihPrije: 3,
        ucinak: 'eliminacija',
      },
      // završnica s 2 aktivna — ne broji
      {
        partijaId: klasicna,
        redniBroj: 3,
        rijec: 'kaladont',
        uzrocnikId: igracId,
        zrtvaId,
        vrstaMete: 'sljedeci',
        brojAktivnihPrije: 2,
        ucinak: 'eliminacija',
      },
    ]);

    const ishod = await baza.transaction((tx) =>
      priznajSaljiDalje(tx, { igracId, partijaId: klasicna, pravila: 'klasicni', zavrsenoU }));
    expect(ishod.doprinosUmetnut).toBe(true);
    expect(ishod.novaDostignuca.some((d) => d.id === ID_DOSTIGNUCA_SALJI_DALJE)).toBe(true);

    const [napredak] = await baza.select({ n: napredakDostignucaIgraca.kaladontSljedeci })
      .from(napredakDostignucaIgraca).where(eq(napredakDostignucaIgraca.igracId, igracId));
    expect(napredak?.n).toBe(2);

    // KA-ZNA stol — filter pravila
    const kazna = await novaPartija('cetiri_igraca', 'ka_zna');
    await baza.insert(ucinakPosebneRijeci).values({
      partijaId: kazna,
      redniBroj: 1,
      rijec: 'kaladont',
      uzrocnikId: igracId,
      zrtvaId,
      vrstaMete: 'sljedeci',
      brojAktivnihPrije: 4,
      ucinak: 'eliminacija',
    });
    const odbijen = await baza.transaction((tx) =>
      priznajSaljiDalje(tx, { igracId, partijaId: kazna, pravila: 'ka_zna', zavrsenoU }));
    expect(odbijen.doprinosUmetnut).toBe(false);
  });

  // --- Stara škola ---
  it('Stara škola: spojeni Dvoboj — KA-ZNA kartica +; Klasična kartica −', async () => {
    const igracId = await noviIgrac('Stara');
    const zavrsenoU = new Date('2026-11-16T13:00:00.000Z');

    const zrtvaId = await noviIgrac('ZrtvaStara');
    const spojeni = await novaPartija('dva_igraca', 'ka_zna', true);
    await baza.insert(ucinakPosebneRijeci).values({
      partijaId: spojeni,
      redniBroj: 1,
      rijec: 'kaladont',
      uzrocnikId: igracId,
      zrtvaId,
      vrstaMete: 'prethodni',
      brojAktivnihPrije: 2,
      ucinak: 'eliminacija',
    });

    const plus = await baza.transaction((tx) => priznajStaruSkolu(tx, {
      igracId,
      partijaId: spojeni,
      pravila: 'ka_zna',
      odabranaPravila: 'ka_zna',
      spojeniDvoboj: true,
      zavrsenoU,
    }));
    expect(plus.novaDostignuca[0]?.id).toBe(ID_DOSTIGNUCA_STARA_SKOLA);

    const klasicnaKartica = await novaPartija('dva_igraca', 'ka_zna', true);
    await baza.insert(ucinakPosebneRijeci).values({
      partijaId: klasicnaKartica,
      redniBroj: 1,
      rijec: 'kaladont',
      uzrocnikId: igracId,
      zrtvaId,
      vrstaMete: 'prethodni',
      brojAktivnihPrije: 2,
      ucinak: 'eliminacija',
    });
    const minus = await baza.transaction((tx) => priznajStaruSkolu(tx, {
      igracId,
      partijaId: klasicnaKartica,
      pravila: 'ka_zna',
      odabranaPravila: 'klasicni',
      spojeniDvoboj: true,
      zavrsenoU,
    }));
    expect(minus.doprinosUmetnut).toBe(false);
  });

  // --- Dvostruka kruna PR13 ---
  it('Dvostruka kruna: 2p+3p isti dan → +1; samo 3p → 0; 2+3+4 isti dan → 1 doprinos', async () => {
    const igracId = await noviIgrac('Kruna13');
    const dan = new Date('2026-11-16T14:00:00.000Z');

    const samoTroboj = await baza.transaction((tx) =>
      priznajDnevnuPobjeduModa(tx, { igracId, mod: 'tri_igraca', zavrsenoU: dan }));
    expect(samoTroboj.doprinosUmetnut).toBe(false);

    const sDvobojem = await baza.transaction((tx) =>
      priznajDnevnuPobjeduModa(tx, { igracId, mod: 'dva_igraca', zavrsenoU: dan }));
    expect(sDvobojem.novaDostignuca[0]?.id).toBe(ID_DOSTIGNUCA_DVOSTRUKA_KRUNA);

    const cetvrti = await baza.transaction((tx) =>
      priznajDnevnuPobjeduModa(tx, { igracId, mod: 'cetiri_igraca', zavrsenoU: dan }));
    expect(cetvrti.doprinosUmetnut).toBe(false);

    const [napredak] = await baza.select({ n: napredakDostignucaIgraca.dvostrukeKrune })
      .from(napredakDostignucaIgraca).where(eq(napredakDostignucaIgraca.igracId, igracId));
    expect(napredak?.n).toBe(1);
  });

  it('Dvostruka kruna: ponoć Zagreb razdvaja dane', async () => {
    const igracId = await noviIgrac('Ponoc');
    // 2026-11-15 23:30 Europe/Zagreb = 22:30 UTC
    const prije = new Date('2026-11-15T22:30:00.000Z');
    // 2026-11-16 00:30 Europe/Zagreb = 23:30 UTC prethodnog dana... wait
    // Zagreb winter = UTC+1 → lokalna ponoć 16.11 = 2026-11-15T23:00:00.000Z
    const poslije = new Date('2026-11-15T23:30:00.000Z'); // 00:30 Zagreb 16.11.

    await baza.transaction((tx) =>
      priznajDnevnuPobjeduModa(tx, { igracId, mod: 'dva_igraca', zavrsenoU: prije }));
    await baza.transaction((tx) =>
      priznajDnevnuPobjeduModa(tx, { igracId, mod: 'tri_igraca', zavrsenoU: prije }));
    // dan 1 gotov
    const dan2 = await baza.transaction((tx) =>
      priznajDnevnuPobjeduModa(tx, { igracId, mod: 'dva_igraca', zavrsenoU: poslije }));
    expect(dan2.doprinosUmetnut).toBe(false);
    const dan2komplet = await baza.transaction((tx) =>
      priznajDnevnuPobjeduModa(tx, { igracId, mod: 'cetiri_igraca', zavrsenoU: poslije }));
    expect(dan2komplet.doprinosUmetnut).toBe(true);

    const [napredak] = await baza.select({ n: napredakDostignucaIgraca.dvostrukeKrune })
      .from(napredakDostignucaIgraca).where(eq(napredakDostignucaIgraca.igracId, igracId));
    expect(napredak?.n).toBe(2);
  });

  // --- Na dvije fronte preispitivanje ---
  it('preispitajParoveNaDvijeFronte: već obrađeni Troboj+2p bez para → +1', async () => {
    const igracId = await noviIgrac('Prijelaz');
    const dan = new Date('2099-03-03T11:00:00.000Z');
    const kalendarskiPocetak = new Date('2099-03-03T00:00:00.000+01:00');

    // Simuliraj PR11-eru: dva obrađena Top10 dokaza bez pairing dokaza.
    await baza.insert(dokaziTop10Ulazaka).values([
      {
        igracId,
        vrstaRazdoblja: 'dnevno',
        kalendarskiPocetak,
        mod: 'tri_igraca',
        metrika: 'prosjek_bodova',
        mjesto: 1,
        opazenoU: dan,
        izvor: 'partija',
        obradjenoU: dan,
      },
      {
        igracId,
        vrstaRazdoblja: 'dnevno',
        kalendarskiPocetak,
        mod: 'dva_igraca',
        metrika: 'prosjek_bodova',
        mjesto: 2,
        opazenoU: dan,
        izvor: 'partija',
        obradjenoU: dan,
      },
    ]);

    const rezultat = await preispitajParoveNaDvijeFronte({ limit: 50, igracId });
    expect(rezultat.has(igracId)).toBe(true);

    const [napredak] = await baza.select({ n: napredakDostignucaIgraca.naDvijeFronte })
      .from(napredakDostignucaIgraca).where(eq(napredakDostignucaIgraca.igracId, igracId));
    expect(napredak?.n).toBe(1);

    // Idempotentno
    const ponovo = await preispitajParoveNaDvijeFronte({ limit: 50, igracId });
    expect(ponovo.has(igracId)).toBe(false);
    expect(ID_DOSTIGNUCA_NA_DVIJE_FRONTE).toBe('na_dvije_fronte');
  });

  it('zakljuciPartijuUBazi: Troboj pobjeda daje Treću sreću; retry ne duplicira', async () => {
    const igracId = await noviIgrac('Zakljuci');
    const partijaId = await novaPartija('tri_igraca', 'klasicni');
    await baza.insert(sudioniciPartije).values({ partijaId, igracId, sjedalo: 0 });
    const zavrsenoU = new Date('2026-11-16T15:00:00.000Z');

    const agregati = await zakljuciPartijuUBazi(
      partijaId,
      igracId,
      [{ igracId, plasman: 1, bodovi: 5, eliminacije: 1, iskustvo: 5, nacinIspadanja: 'pobjednik' }],
      'tri_igraca',
      new Map([[igracId, statistika(igracId, { uspjesniDokazi: 0 })]]),
      false,
      new Map(),
      zavrsenoU,
      new Map(),
      {
        pravila: 'klasicni',
        spojeniDvoboj: false,
        odabranaPravilaPoIgracu: new Map([[igracId, 'klasicni']]),
      },
    );
    expect(agregati.get(igracId)?.novaDostignuca.some((d) => d.id === ID_DOSTIGNUCA_TRECA_SRECA)).toBe(true);

    const retry = await zakljuciPartijuUBazi(
      partijaId,
      igracId,
      [{ igracId, plasman: 1, bodovi: 5, eliminacije: 1, iskustvo: 5, nacinIspadanja: 'pobjednik' }],
      'tri_igraca',
      new Map([[igracId, statistika(igracId)]]),
      false,
      new Map(),
      zavrsenoU,
      new Map(),
      {
        pravila: 'klasicni',
        spojeniDvoboj: false,
        odabranaPravilaPoIgracu: new Map([[igracId, 'klasicni']]),
      },
    );
    // Drugi poziv: claim već zatvoren → nema novih zvijezda iz servisa
    expect(retry.get(igracId)?.novaDostignuca.some((d) => d.id === ID_DOSTIGNUCA_TRECA_SRECA)).toBeFalsy();

    const [napredak] = await baza.select({ n: napredakDostignucaIgraca.trobojPobjede })
      .from(napredakDostignucaIgraca).where(eq(napredakDostignucaIgraca.igracId, igracId));
    expect(napredak?.n).toBe(1);
  });
});
