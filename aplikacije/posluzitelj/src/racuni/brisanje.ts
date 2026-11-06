import { and, eq, isNull, sql } from 'drizzle-orm';
import { baza } from '../baza/klijent.js';
import { emitirajNovostiDostignuca } from '../dostignuca/obavijesti.js';
import { imaJavnuIgruUOtvorenomMjesecu, obradiNeobradeneTop10Dokaze, zabiljeziTop10NakonPromjene } from '../dostignuca/top10.js';
import { ocistiMemorijuLjestvica } from '../ljestvice/servis.js';
import {
  aktivnostIgracaDani,
  ciklusiTjednihMisija,
  dnkStatistikeIgraca,
  dodjeleMisija,
  doprinosiMisijama,
  dostignucaIgraca,
  dokaziDostignucaCinkaros,
  dokaziDostignucaCistaPetica,
  dokaziDostignucaDvostrukaKruna,
  dokaziDostignucaJezicniDetektiv,
  dokaziDostignucaMisija,
  dokaziDostignucaPrivatnik,
  dokaziDostignucaNaDvijeFronte,
  dokaziDostignucaRijetkaGrdosija,
  dokaziDostignucaSvePohvale,
  dokaziDostignucaTjedniPaket,
  dokaziDostignucaTop10,
  dokaziTop10Ulazaka,
  dotokDnevnihMisija,
  evidencijaDnevnihPobjedaModova,
  igraci,
  ishodiMisijaIgara,
  napredakDostignucaIgraca,
  nagradeMisija,
  obavijestiIgraca,
  nizAktivnostiIgraca,
  otkljucaneGrupeIgraca,
  otkljucaneRijeciIgraca,
  sesije,
  stanjeMisijaIgraca,
  statistikeRijeciIgraca,
  treningRijeciIgraca,
  pobjedeTreninga,
  zamjeneMisija,
} from '../baza/shema.js';

export type IshodBrisanja = 'obrisan' | 'nije-pronaden' | 'vec-obrisan' | 'zasticen';

async function obrisiRacunUTransakciji(
  transakcija: Parameters<Parameters<typeof baza.transaction>[0]>[0],
  igrac: { id: string; obrisanAt: Date | null; vrsta: 'gost' | 'registriran' | 'admin'; upravljac: 'covjek' | 'bot' },
): Promise<IshodBrisanja> {
  if (igrac.obrisanAt) return 'vec-obrisan';
  // Botovi i admini ne smiju se soft-brisati ovim putem (živ fond / admin pristup).
  if (igrac.upravljac === 'bot' || igrac.vrsta === 'admin') return 'zasticen';

  await transakcija.delete(sesije).where(eq(sesije.igracId, igrac.id));
  await transakcija.delete(statistikeRijeciIgraca).where(eq(statistikeRijeciIgraca.igracId, igrac.id));
  await transakcija.delete(dnkStatistikeIgraca).where(eq(dnkStatistikeIgraca.igracId, igrac.id));
  await transakcija.delete(dokaziDostignucaMisija).where(eq(dokaziDostignucaMisija.igracId, igrac.id));
  await transakcija.delete(dokaziDostignucaPrivatnik).where(eq(dokaziDostignucaPrivatnik.igracId, igrac.id));
  await transakcija.delete(dokaziDostignucaTjedniPaket).where(eq(dokaziDostignucaTjedniPaket.igracId, igrac.id));
  await transakcija.delete(dokaziDostignucaDvostrukaKruna).where(eq(dokaziDostignucaDvostrukaKruna.igracId, igrac.id));
  await transakcija.delete(dokaziDostignucaCistaPetica).where(eq(dokaziDostignucaCistaPetica.igracId, igrac.id));
  await transakcija.delete(dokaziDostignucaSvePohvale).where(eq(dokaziDostignucaSvePohvale.igracId, igrac.id));
  await transakcija.delete(dokaziDostignucaRijetkaGrdosija).where(eq(dokaziDostignucaRijetkaGrdosija.igracId, igrac.id));
  await transakcija.delete(dokaziTop10Ulazaka).where(eq(dokaziTop10Ulazaka.igracId, igrac.id));
  await transakcija.delete(dokaziDostignucaTop10).where(eq(dokaziDostignucaTop10.igracId, igrac.id));
  await transakcija.delete(dokaziDostignucaNaDvijeFronte).where(eq(dokaziDostignucaNaDvijeFronte.igracId, igrac.id));
  await transakcija.delete(dokaziDostignucaJezicniDetektiv).where(eq(dokaziDostignucaJezicniDetektiv.igracId, igrac.id));
  await transakcija.delete(dokaziDostignucaCinkaros).where(eq(dokaziDostignucaCinkaros.igracId, igrac.id));
  await transakcija.delete(evidencijaDnevnihPobjedaModova).where(eq(evidencijaDnevnihPobjedaModova.igracId, igrac.id));
  await transakcija.delete(obavijestiIgraca).where(eq(obavijestiIgraca.igracId, igrac.id));
  await transakcija.delete(napredakDostignucaIgraca).where(eq(napredakDostignucaIgraca.igracId, igrac.id));
  await transakcija.delete(dostignucaIgraca).where(eq(dostignucaIgraca.igracId, igrac.id));
  await transakcija.delete(otkljucaneGrupeIgraca).where(eq(otkljucaneGrupeIgraca.igracId, igrac.id));
  await transakcija.delete(otkljucaneRijeciIgraca).where(eq(otkljucaneRijeciIgraca.igracId, igrac.id));
  await transakcija.delete(treningRijeciIgraca).where(eq(treningRijeciIgraca.igracId, igrac.id));
  await transakcija.delete(pobjedeTreninga).where(eq(pobjedeTreninga.igracId, igrac.id));
  await transakcija.delete(doprinosiMisijama).where(eq(doprinosiMisijama.igracId, igrac.id));
  await transakcija.delete(nagradeMisija).where(eq(nagradeMisija.igracId, igrac.id));
  await transakcija.delete(ishodiMisijaIgara).where(eq(ishodiMisijaIgara.igracId, igrac.id));
  await transakcija.delete(zamjeneMisija).where(eq(zamjeneMisija.igracId, igrac.id));
  await transakcija.delete(dodjeleMisija).where(eq(dodjeleMisija.igracId, igrac.id));
  await transakcija.delete(dotokDnevnihMisija).where(eq(dotokDnevnihMisija.igracId, igrac.id));
  await transakcija.delete(ciklusiTjednihMisija).where(eq(ciklusiTjednihMisija.igracId, igrac.id));
  await transakcija.delete(stanjeMisijaIgraca).where(eq(stanjeMisijaIgraca.igracId, igrac.id));
  await transakcija.delete(aktivnostIgracaDani).where(eq(aktivnostIgracaDani.igracId, igrac.id));
  await transakcija.delete(nizAktivnostiIgraca).where(eq(nizAktivnostiIgraca.igracId, igrac.id));
  await transakcija
    .update(igraci)
    .set({
      vrsta: 'registriran',
      nadimak: 'Obrisani igrač',
      avatarId: 0,
      email: null,
      lozinkaHash: null,
      emailPotvrdjen: false,
      obrisanAt: new Date(),
      odigrane: 0,
      pobjede: 0,
      eliminacijeUkupno: 0,
      bodoviUkupno: 0,
      odigrane1v1: 0,
      pobjede1v1: 0,
      eliminacije1v1: 0,
      bodovi1v1: 0,
      iskustvoUkupno: 0,
    })
    .where(and(eq(igraci.id, igrac.id), isNull(igraci.obrisanAt)));

  return 'obrisan';
}

type TransakcijaBrisanja = Parameters<Parameters<typeof baza.transaction>[0]>[0];

export interface RezultatBrisanjaRacuna {
  ishod: IshodBrisanja;
  /** Istina samo kad je ovo brisanje upisalo Top 10 dokaze koje treba obraditi nakon commita. */
  osvjeziLjestvicu: boolean;
}

async function osvjeziLjestvicuAkoTreba(tx: TransakcijaBrisanja, igracId: string): Promise<boolean> {
  const opazenoU = new Date();
  if (!(await imaJavnuIgruUOtvorenomMjesecu(tx, igracId, opazenoU))) return false;
  await zabiljeziTop10NakonPromjene(tx, {
    modovi: ['cetiri_igraca', 'dva_igraca'],
    opazenoU,
    izvor: 'brisanje',
    partijaId: null,
  });
  return true;
}

export async function dovrsiTop10NakonBrisanja(): Promise<void> {
  try {
    const poIgracu = await obradiNeobradeneTop10Dokaze();
    for (const [igracId, obavijesti] of poIgracu) emitirajNovostiDostignuca(igracId, obavijesti);
    ocistiMemorijuLjestvica();
  } catch (greska) {
    console.error('Top 10 nakon brisanja računa nije obrađen:', greska);
  }
}

async function obrisiZakljucanogIgraca(
  transakcija: TransakcijaBrisanja,
  igrac: { id: string; obrisanAt: Date | null; vrsta: 'gost' | 'registriran' | 'admin'; upravljac: 'covjek' | 'bot' },
): Promise<RezultatBrisanjaRacuna> {
  const ishod = await obrisiRacunUTransakciji(transakcija, igrac);
  if (ishod !== 'obrisan') return { ishod, osvjeziLjestvicu: false };
  return { ishod, osvjeziLjestvicu: await osvjeziLjestvicuAkoTreba(transakcija, igrac.id) };
}

async function obrisiPoIdUnutar(transakcija: TransakcijaBrisanja, igracId: string): Promise<RezultatBrisanjaRacuna> {
  const [igrac] = await transakcija
    .select({
      id: igraci.id,
      obrisanAt: igraci.obrisanAt,
      vrsta: igraci.vrsta,
      upravljac: igraci.upravljac,
    })
    .from(igraci)
    .where(eq(igraci.id, igracId))
    .limit(1)
    .for('update');
  if (!igrac) return { ishod: 'nije-pronaden', osvjeziLjestvicu: false };
  return obrisiZakljucanogIgraca(transakcija, igrac);
}

export async function obrisiRacun(email: string, potvrdi: boolean): Promise<IshodBrisanja> {
  const normaliziraniEmail = email.trim().toLowerCase();
  if (!normaliziraniEmail) throw new Error('Obavezan je --email=<adresa>.');
  if (!potvrdi) throw new Error('Brisanje nije potvrđeno. Dodaj --potvrdi.');

  let osvjezi = false;
  const ishod = await baza.transaction(async (transakcija) => {
    const [igrac] = await transakcija
      .select({
        id: igraci.id,
        email: igraci.email,
        obrisanAt: igraci.obrisanAt,
        vrsta: igraci.vrsta,
        upravljac: igraci.upravljac,
      })
      .from(igraci)
      .where(sql`lower(${igraci.email}) = ${normaliziraniEmail}`)
      .limit(1)
      .for('update');

    if (!igrac) return 'nije-pronaden';
    const rezultat = await obrisiZakljucanogIgraca(transakcija, igrac);
    osvjezi = rezultat.osvjeziLjestvicu;
    return rezultat.ishod;
  });
  if (osvjezi) await dovrsiTop10NakonBrisanja();
  return ishod;
}

export function obrisiRacunPoId(igracId: string): Promise<IshodBrisanja>;
export function obrisiRacunPoId(igracId: string, transakcija: TransakcijaBrisanja): Promise<RezultatBrisanjaRacuna>;
export async function obrisiRacunPoId(
  igracId: string,
  transakcija?: TransakcijaBrisanja,
): Promise<IshodBrisanja | RezultatBrisanjaRacuna> {
  if (transakcija) return obrisiPoIdUnutar(transakcija, igracId);
  let osvjezi = false;
  const ishod = await baza.transaction(async (unutarnja) => {
    const rezultat = await obrisiPoIdUnutar(unutarnja, igracId);
    osvjezi = rezultat.osvjeziLjestvicu;
    return rezultat.ishod;
  });
  if (osvjezi) await dovrsiTop10NakonBrisanja();
  return ishod;
}
