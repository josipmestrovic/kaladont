/**
 * Objedinjeni sažetak naslovnice — tanki SQL / postojeći servisi, bez internog HTTP-a.
 * Parcijalne greške vraćaju `null` sekcije (klijent zadržava zadnji uspješan prikaz).
 */
import {
  BROJ_AKTIVNIH_IZAZOVA,
  izgradiAgregateLevela,
  izracunajRangIzAgregata,
  izracunajSazetakZvjezdicaDostignuca,
  kolekcijskiKljucGrupe,
  stanjeIskustva,
  type AvatarConfigV1,
  type OdgovorNaslovnicaSazetka,
} from 'zajednicko';
import { eq } from 'drizzle-orm';
import { hashSlikeAvatara } from '../avatar/hash.js';
import { baza } from '../baza/klijent.js';
import {
  dostignucaIgraca,
  igraci,
  napredakDostignucaIgraca,
  otkljucaneGrupeIgraca,
} from '../baza/shema.js';
import { dohvatiZavrseneChallengeIds } from '../izazovi/pohrana.js';
import { konfiguracija } from '../konfiguracija.js';
import { izgradiOdgovorSazetkaLjestvice } from '../ljestvice/sazetak.js';
import { izgradiStanjeMisijaDto } from '../misije/dto.js';
import { dohvatiNajboljiNizAktivnosti } from '../racuni/aktivnost-dana.js';
import { dohvatiListu, dohvatiSazetak } from '../sanducic/servis.js';

type IgracSesije = typeof igraci.$inferSelect;

/** Ne blokiraj osnovni profil na sporom poretku ljestvica. */
export const LJESTVICE_TIMEOUT_MS = 400;

function izazovOmogucen(): boolean {
  return konfiguracija.IZAZOV_OMOGUCEN === 'true';
}

async function dohvatiBrojOtkljucanihKolekcije(igracId: string): Promise<number> {
  const dopustiVlastitaImena = konfiguracija.DOPUSTI_VLASTITA_IMENA === 'true';
  const grupe = await baza
    .select({ grupa: otkljucaneGrupeIgraca.grupa })
    .from(otkljucaneGrupeIgraca)
    .where(eq(otkljucaneGrupeIgraca.igracId, igracId));
  const kljucevi = new Set<string>();
  for (const redak of grupe) {
    const kljuc = kolekcijskiKljucGrupe(redak.grupa);
    const vrsta = kljuc.split(':')[0] ?? 'ostalo';
    if (!dopustiVlastitaImena && vrsta === 'vlastito_ime') continue;
    kljucevi.add(kljuc);
  }
  return kljucevi.size;
}

async function dohvatiSazetakZvjezdica(
  igracId: string,
  iskustvoUkupno: number,
): Promise<{ ukupnoZvjezdica: number; maksimalnoZvjezdica: number }> {
  const [napredak, otkljucana, najboljiNizAktivnosti] = await Promise.all([
    baza
      .select()
      .from(napredakDostignucaIgraca)
      .where(eq(napredakDostignucaIgraca.igracId, igracId))
      .limit(1),
    baza
      .select({ dostignuceId: dostignucaIgraca.dostignuceId, razina: dostignucaIgraca.razina })
      .from(dostignucaIgraca)
      .where(eq(dostignucaIgraca.igracId, igracId)),
    dohvatiNajboljiNizAktivnosti(igracId),
  ]);
  const razine = new Map(otkljucana.map((redak) => [redak.dostignuceId, redak.razina]));
  const sazetak = izracunajSazetakZvjezdicaDostignuca({
    iskustvoUkupno,
    najboljiNizAktivnosti,
    spremljeneRazine: razine,
    brojac: napredak[0] ?? null,
  });
  return {
    ukupnoZvjezdica: sazetak.ukupnoZvjezdica,
    maksimalnoZvjezdica: sazetak.maksimalnoZvjezdica,
  };
}

async function dohvatiSazetakIzazova(
  igracId: string,
): Promise<NonNullable<OdgovorNaslovnicaSazetka['izazovi']>> {
  const omogucen = izazovOmogucen();
  const ukupno = BROJ_AKTIVNIH_IZAZOVA;
  if (!omogucen) {
    return { omogucen: false, zavrseno: 0, ukupno };
  }
  const zavrseni = await dohvatiZavrseneChallengeIds(igracId);
  const leveli = izgradiAgregateLevela(zavrseni);
  const zavrseno = leveli.reduce((zbroj, level) => zbroj + level.zavrseno, 0);
  return {
    omogucen: true,
    zavrseno: Math.min(Math.max(0, zavrseno), ukupno),
    ukupno,
  };
}

async function dohvatiSazetakMisija(igrac: IgracSesije): Promise<OdgovorNaslovnicaSazetka['misije']> {
  if (igrac.vrsta === 'gost') return null;
  const stanje = await baza.transaction((tx) => izgradiStanjeMisijaDto(tx, igrac.id));
  const dnevneAktivne = stanje.dnevne.aktivne.length;
  const tjedneAktivne = stanje.tjedne.misije.filter((m) => m.status === 'aktivna').length;
  return {
    dnevneAktivne,
    tjedneAktivne,
    ukupnoAktivnih: dnevneAktivne + tjedneAktivne,
    novosti: stanje.novosti,
  };
}

async function dohvatiLjestviceSTimeoutom(
  igracId: string,
  timeoutMs = LJESTVICE_TIMEOUT_MS,
): Promise<NonNullable<OdgovorNaslovnicaSazetka['ljestvice']>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const rezultat = await Promise.race([
      izgradiOdgovorSazetkaLjestvice(igracId).then((odgovor) => ({
        status: odgovor.status,
        izracunatoU: odgovor.izracunatoU,
      })),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('ljestvice-timeout')), timeoutMs);
      }),
    ]);
    return rezultat;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

async function iliNull<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

export async function izgradiNaslovnicaSazetak(igrac: IgracSesije): Promise<OdgovorNaslovnicaSazetka> {
  const rang = izracunajRangIzAgregata(igrac.rangSumaJedinica, igrac.rangBrojPartija);
  const iskustvo = stanjeIskustva(igrac.iskustvoUkupno);
  const profil: OdgovorNaslovnicaSazetka['profil'] = {
    igracId: igrac.id,
    nadimak: igrac.nadimak,
    vrsta: igrac.vrsta,
    avatarId: igrac.avatarId,
    avatarConfig: (igrac.avatarConfig as AvatarConfigV1 | null) ?? null,
    avatarSlikaHash: hashSlikeAvatara(igrac.avatarConfig),
    email: igrac.email,
    rang,
    rang1v1: rang,
    iskustvo,
  };

  const [izazovi, misije, ukupnoOtkljucano, dostignuca, ljestvice, sanducicSazetak, sanducicLista] =
    await Promise.all([
      iliNull(() => dohvatiSazetakIzazova(igrac.id)),
      iliNull(() => dohvatiSazetakMisija(igrac)),
      iliNull(() => dohvatiBrojOtkljucanihKolekcije(igrac.id)),
      iliNull(() => dohvatiSazetakZvjezdica(igrac.id, igrac.iskustvoUkupno)),
      iliNull(() => dohvatiLjestviceSTimeoutom(igrac.id)),
      iliNull(() => dohvatiSazetak(igrac.id)),
      iliNull(() => dohvatiListu(igrac.id, { samoNeprocitane: true, limit: 20 })),
    ]);

  // Gost: misije namjerno null. Registriran + pad: također null (ne lažne nule).
  const misijeOdgovor =
    igrac.vrsta === 'gost' ? null : misije === null ? null : misije;

  let obavijesti: OdgovorNaslovnicaSazetka['obavijesti'] = null;
  if (sanducicSazetak && sanducicLista) {
    obavijesti = {
      brojNeprocitanih: sanducicSazetak.brojNeprocitanih,
      zaNajavu: sanducicSazetak.zaNajavu,
      neprocitane: sanducicLista.poruke,
      sljedeciCursor: sanducicLista.sljedeciCursor,
    };
  } else if (sanducicSazetak) {
    obavijesti = {
      brojNeprocitanih: sanducicSazetak.brojNeprocitanih,
      zaNajavu: sanducicSazetak.zaNajavu,
      neprocitane: [],
      sljedeciCursor: null,
    };
  }

  return {
    ok: true,
    igracId: igrac.id,
    profil,
    izazovi,
    misije: misijeOdgovor,
    kolekcija: ukupnoOtkljucano === null ? null : { ukupnoOtkljucano },
    dostignuca,
    ljestvice,
    obavijesti,
  };
}
