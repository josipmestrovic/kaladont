/**
 * READ-ONLY agregati gamifikacije (misije, XP, dostignuća, kolekcija, XP izazova).
 * Bez novih upisa tijekom igre; samo admin GET.
 */
import { and, eq, gte, inArray, isNull, lt, sql } from 'drizzle-orm';
import { type BrojaciDostignucaZaIzracun } from 'zajednicko';
import { baza } from '../baza/klijent.js';
import {
  analitikaIgre,
  analitikaSudjelovanja,
  dodjeleMisija,
  doprinosiMisijama,
  dostignucaIgraca,
  dotokDnevnihMisija,
  igraci,
  napredakDostignucaIgraca,
  nagradeMisija,
  nizAktivnostiIgraca,
  otkljucaneRijeciIgraca,
  zamjeneMisija,
  zavrseciIzazova,
} from '../baza/shema.js';
import {
  agregirajDostignucaPresjek,
  agregirajKolekcijuPresjek,
  nazivPredloskaIzSnimke,
  odlukaFiltraMisijskogKonteksta,
  PRAG_MALI_UZORAK_GAMIFIKACIJE,
  raspodjelaRazinaXp,
  statistikaVremenaDovrsetkaSekundi,
  stopeMisija,
} from './gamifikacija-pomoc.js';
import {
  ANALITIKA_VREMENSKA_ZONA,
  danasZagrebIso,
  pocetakDanaZagrebUtc,
  type KontekstOtvaranjaAnalitike,
} from './otvaranja.js';

export { PRAG_MALI_UZORAK_GAMIFIKACIJE };

type VrstaMisije = 'dnevna' | 'tjedna';
type StatusDodjele = 'aktivna' | 'dovrsena' | 'zamijenjena' | 'istekla';

function graniceDana(odDan: string, doDan: string) {
  const od = pocetakDanaZagrebUtc(odDan);
  const doGranica = pocetakDanaZagrebUtc(
    (() => {
      const bazaDatuma = new Date(`${doDan}T12:00:00.000Z`);
      bazaDatuma.setUTCDate(bazaDatuma.getUTCDate() + 1);
      return bazaDatuma.toISOString().slice(0, 10);
    })(),
  );
  return { od, doGranica };
}

function prazanSazetakVrste() {
  return {
    dodijeljene: 0,
    dovrsene: 0,
    aktivne: 0,
    zamijenjene: 0,
    istekle: 0,
    primatelji: 0,
    dovrsitelji: 0,
    udioTrenutnoDovrsenih: null as number | null,
    terminalnaStopaDovrsavanja: null as number | null,
    terminalniNazivnik: 0,
    vrijemeDovrsetka: statistikaVremenaDovrsetkaSekundi([]),
  };
}

function sazetakIzStatusa(
  statusi: Record<StatusDodjele, number>,
  primatelji: number,
  dovrsitelji: number,
  vremenaSekundi: number[],
) {
  const dodijeljene = statusi.aktivna + statusi.dovrsena + statusi.zamijenjena + statusi.istekla;
  const stope = stopeMisija(dodijeljene, statusi.dovrsena, statusi.zamijenjena, statusi.istekla);
  return {
    dodijeljene,
    dovrsene: statusi.dovrsena,
    aktivne: statusi.aktivna,
    zamijenjene: statusi.zamijenjena,
    istekle: statusi.istekla,
    primatelji,
    dovrsitelji,
    udioTrenutnoDovrsenih: stope.udioTrenutnoDovrsenih,
    terminalnaStopaDovrsavanja: stope.terminalnaStopaDovrsavanja,
    terminalniNazivnik: stope.terminalniNazivnik,
    vrijemeDovrsetka: statistikaVremenaDovrsetkaSekundi(vremenaSekundi),
  };
}

async function dohvatiBazuIgraca(): Promise<string[]> {
  const redovi = await baza
    .selectDistinct({ igracId: analitikaSudjelovanja.igracId })
    .from(analitikaSudjelovanja)
    .innerJoin(analitikaIgre, eq(analitikaSudjelovanja.igraId, analitikaIgre.igraId))
    .innerJoin(igraci, eq(analitikaSudjelovanja.igracId, igraci.id))
    .where(and(
      eq(analitikaIgre.ishod, 'zavrsena'),
      eq(igraci.upravljac, 'covjek'),
      isNull(igraci.obrisanAt),
    ));
  return redovi.map((r) => r.igracId);
}

export async function agregirajGamifikaciju(opcije: {
  odDan: string;
  doDan: string;
  kontekst?: KontekstOtvaranjaAnalitike;
}) {
  const { od, doGranica } = graniceDana(opcije.odDan, opcije.doDan);
  const kontekstFilter = opcije.kontekst;
  const odlukaKonteksta = odlukaFiltraMisijskogKonteksta(kontekstFilter);
  const kontekstNapomena = odlukaKonteksta.nacin === 'neprimjenjivo'
    ? 'Filter privatna: doprinosi i XP nagrade misija nisu primjenjivi (N/A). Dodjele/zamjene/dotok i trenutačni presjek ostaju globalni. XP izazova je zasebna metrika izazova.'
    : odlukaKonteksta.nacin === 'filtriraj'
      ? `Filter ${odlukaKonteksta.kontekst}: doprinosi i XP nagrade misija filtrirani po kontekstu izvora. Dodjele/zamjene/dotok i trenutačni presjek ostaju globalni. XP izazova je zasebna metrika izazova.`
      : 'Bez filtera konteksta: svi podaci. XP izazova je zasebna metrika izazova.';

  const dodjele = await baza
    .select({
      id: dodjeleMisija.id,
      igracId: dodjeleMisija.igracId,
      vrsta: dodjeleMisija.vrsta,
      predlozakId: dodjeleMisija.predlozakId,
      verzijaDefinicije: dodjeleMisija.verzijaDefinicije,
      snapshot: dodjeleMisija.snapshot,
      status: dodjeleMisija.status,
      dostupnaOd: dodjeleMisija.dostupnaOd,
      zavrsenaU: dodjeleMisija.zavrsenaU,
      istjeceU: dodjeleMisija.istjeceU,
    })
    .from(dodjeleMisija)
    .where(and(gte(dodjeleMisija.stvorenoU, od), lt(dodjeleMisija.stvorenoU, doGranica)));

  const poVrsti = {
    dnevna: prazanSazetakVrste(),
    tjedna: prazanSazetakVrste(),
  };
  const statusiPoVrsti: Record<VrstaMisije, Record<StatusDodjele, number>> = {
    dnevna: { aktivna: 0, dovrsena: 0, zamijenjena: 0, istekla: 0 },
    tjedna: { aktivna: 0, dovrsena: 0, zamijenjena: 0, istekla: 0 },
  };
  const primateljiPoVrsti: Record<VrstaMisije, Set<string>> = { dnevna: new Set(), tjedna: new Set() };
  const dovrsiteljiPoVrsti: Record<VrstaMisije, Set<string>> = { dnevna: new Set(), tjedna: new Set() };
  const vremenaPoVrsti: Record<VrstaMisije, number[]> = { dnevna: [], tjedna: [] };
  const predlosci = new Map<string, {
    predlozakId: string;
    vrsta: VrstaMisije;
    verzijaDefinicije: number;
    naziv: string;
    statusi: Record<StatusDodjele, number>;
    vremena: number[];
  }>();

  for (const d of dodjele) {
    const vrsta = d.vrsta as VrstaMisije;
    const status = d.status as StatusDodjele;
    statusiPoVrsti[vrsta][status] += 1;
    primateljiPoVrsti[vrsta].add(d.igracId);
    if (status === 'dovrsena') {
      dovrsiteljiPoVrsti[vrsta].add(d.igracId);
      if (d.zavrsenaU && d.dostupnaOd) {
        const sek = (d.zavrsenaU.getTime() - d.dostupnaOd.getTime()) / 1000;
        if (Number.isFinite(sek) && sek >= 0) vremenaPoVrsti[vrsta].push(sek);
      }
    }
    const kljuc = `${d.predlozakId}|${vrsta}|${d.verzijaDefinicije}`;
    let pred = predlosci.get(kljuc);
    if (!pred) {
      pred = {
        predlozakId: d.predlozakId,
        vrsta,
        verzijaDefinicije: d.verzijaDefinicije,
        naziv: nazivPredloskaIzSnimke(d.predlozakId, d.snapshot),
        statusi: { aktivna: 0, dovrsena: 0, zamijenjena: 0, istekla: 0 },
        vremena: [],
      };
      predlosci.set(kljuc, pred);
    }
    pred.statusi[status] += 1;
    if (status === 'dovrsena' && d.zavrsenaU && d.dostupnaOd) {
      const sek = (d.zavrsenaU.getTime() - d.dostupnaOd.getTime()) / 1000;
      if (Number.isFinite(sek) && sek >= 0) pred.vremena.push(sek);
    }
  }

  for (const vrsta of ['dnevna', 'tjedna'] as const) {
    poVrsti[vrsta] = sazetakIzStatusa(
      statusiPoVrsti[vrsta],
      primateljiPoVrsti[vrsta].size,
      dovrsiteljiPoVrsti[vrsta].size,
      vremenaPoVrsti[vrsta],
    );
  }

  const predlosciRedovi = [...predlosci.values()].map((p) => {
    const dodijeljene = p.statusi.aktivna + p.statusi.dovrsena + p.statusi.zamijenjena + p.statusi.istekla;
    const stope = stopeMisija(dodijeljene, p.statusi.dovrsena, p.statusi.zamijenjena, p.statusi.istekla);
    return {
      predlozakId: p.predlozakId,
      naziv: p.naziv,
      vrsta: p.vrsta,
      verzijaDefinicije: p.verzijaDefinicije,
      dodjele: dodijeljene,
      dovrsene: p.statusi.dovrsena,
      zamijenjene: p.statusi.zamijenjena,
      istekle: p.statusi.istekla,
      aktivne: p.statusi.aktivna,
      udioTrenutnoDovrsenih: stope.udioTrenutnoDovrsenih,
      terminalnaStopaDovrsavanja: stope.terminalnaStopaDovrsavanja,
      stopaZamjenjivanja: stope.stopaZamjenjivanja,
      vrijemeDovrsetka: statistikaVremenaDovrsetkaSekundi(p.vremena),
      uzorak: dodijeljene,
      maliUzorak: dodijeljene < PRAG_MALI_UZORAK_GAMIFIKACIJE,
    };
  }).sort((a, b) => b.dodjele - a.dodjele);

  const zamjene = await baza
    .select({
      id: zamjeneMisija.id,
      igracId: zamjeneMisija.igracId,
      vrsta: zamjeneMisija.vrsta,
      staraDodjelaId: zamjeneMisija.staraDodjelaId,
      novaDodjelaId: zamjeneMisija.novaDodjelaId,
    })
    .from(zamjeneMisija)
    .where(and(gte(zamjeneMisija.stvorenoU, od), lt(zamjeneMisija.stvorenoU, doGranica)));

  const dodjelaIdZaZamjene = [...new Set(zamjene.flatMap((z) => [z.staraDodjelaId, z.novaDodjelaId]))];
  const dodjeleZaZamjene = dodjelaIdZaZamjene.length === 0
    ? []
    : await baza
      .select({
        id: dodjeleMisija.id,
        predlozakId: dodjeleMisija.predlozakId,
        verzijaDefinicije: dodjeleMisija.verzijaDefinicije,
        snapshot: dodjeleMisija.snapshot,
      })
      .from(dodjeleMisija)
      .where(inArray(dodjeleMisija.id, dodjelaIdZaZamjene));
  const mapaDodjela = new Map(dodjeleZaZamjene.map((d) => [d.id, d]));

  const zamjenePoVrsti = { dnevna: 0, tjedna: 0 };
  const igraciZamjena = new Set<string>();
  const stare = new Map<string, number>();
  const nove = new Map<string, number>();
  for (const z of zamjene) {
    zamjenePoVrsti[z.vrsta as VrstaMisije] += 1;
    igraciZamjena.add(z.igracId);
    const stara = mapaDodjela.get(z.staraDodjelaId);
    const nova = mapaDodjela.get(z.novaDodjelaId);
    if (stara) {
      const k = `${stara.predlozakId}|${stara.verzijaDefinicije}|${nazivPredloskaIzSnimke(stara.predlozakId, stara.snapshot)}`;
      stare.set(k, (stare.get(k) ?? 0) + 1);
    }
    if (nova) {
      const k = `${nova.predlozakId}|${nova.verzijaDefinicije}|${nazivPredloskaIzSnimke(nova.predlozakId, nova.snapshot)}`;
      nove.set(k, (nove.get(k) ?? 0) + 1);
    }
  }
  const topPredlozak = (mapa: Map<string, number>) =>
    [...mapa.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([kljuc, broj]) => {
        const [predlozakId, verzija, ...nazivDijelovi] = kljuc.split('|');
        return {
          predlozakId: predlozakId!,
          verzijaDefinicije: Number(verzija),
          naziv: nazivDijelovi.join('|') || predlozakId!,
          broj,
        };
      });

  const zamjeneKohortaPredloska = predlosciRedovi.map((p) => ({
    predlozakId: p.predlozakId,
    vrsta: p.vrsta,
    verzijaDefinicije: p.verzijaDefinicije,
    naziv: p.naziv,
    zamijenjeneDodjele: p.zamijenjene,
    dodjeleKohorte: p.dodjele,
    stopaZamjenjivanja: p.stopaZamjenjivanja,
    maliUzorak: p.maliUzorak,
  }));

  const dotok = await baza
    .select({
      status: dotokDnevnihMisija.status,
      broj: sql<number>`count(*)::int`,
    })
    .from(dotokDnevnihMisija)
    .where(and(
      gte(dotokDnevnihMisija.lokalniDatum, opcije.odDan),
      lt(dotokDnevnihMisija.lokalniDatum, (() => {
        const d = new Date(`${opcije.doDan}T12:00:00.000Z`);
        d.setUTCDate(d.getUTCDate() + 1);
        return d.toISOString().slice(0, 10);
      })()),
    ))
    .groupBy(dotokDnevnihMisija.status);

  const dotokBrojevi = { dodijeljeno: 0, preskoceno: 0 };
  for (const r of dotok) {
    if (r.status === 'dodijeljeno' || r.status === 'preskoceno') {
      dotokBrojevi[r.status] = Number(r.broj);
    }
  }

  const doprinosiPoKontekstu = {
    javna: { doprinosi: 0, distinctIgara: 0 },
    trening: { doprinosi: 0, distinctIgara: 0 },
    izazov: { doprinosi: 0, distinctIgara: 0 },
  };
  const xpMisija = {
    ukupnoStvarno: 0,
    ukupnoNominalno: 0,
    dnevneStvarno: 0,
    tjedneStvarno: 0,
    brojNagrada: 0,
    primatelji: new Set<string>(),
  };
  const doprinosiINagradeMisija = odlukaKonteksta.nacin === 'neprimjenjivo'
    ? {
      dostupno: false as const,
      razlog: 'Doprinosi i XP nagrade misija ne postoje za privatne sobe.',
    }
    : { dostupno: true as const, razlog: null as string | null };

  if (odlukaKonteksta.nacin !== 'neprimjenjivo') {
    const doprinosiUvjet = and(
      gte(doprinosiMisijama.stvorenoU, od),
      lt(doprinosiMisijama.stvorenoU, doGranica),
      odlukaKonteksta.nacin === 'filtriraj'
        ? eq(doprinosiMisijama.kontekstIzvora, odlukaKonteksta.kontekst!)
        : undefined,
    );
    const doprinosi = await baza
      .select({
        kontekst: doprinosiMisijama.kontekstIzvora,
        broj: sql<number>`count(*)::int`,
        igre: sql<number>`count(distinct ${doprinosiMisijama.izvorId})::int`,
      })
      .from(doprinosiMisijama)
      .where(doprinosiUvjet)
      .groupBy(doprinosiMisijama.kontekstIzvora);
    for (const r of doprinosi) {
      if (r.kontekst in doprinosiPoKontekstu) {
        doprinosiPoKontekstu[r.kontekst as keyof typeof doprinosiPoKontekstu] = {
          doprinosi: Number(r.broj),
          distinctIgara: Number(r.igre),
        };
      }
    }

    const nagradeUvjet = and(
      gte(nagradeMisija.dodijeljenaU, od),
      lt(nagradeMisija.dodijeljenaU, doGranica),
      odlukaKonteksta.nacin === 'filtriraj'
        ? eq(nagradeMisija.kontekstIzvora, odlukaKonteksta.kontekst!)
        : undefined,
    );
    const nagradeRedovi = await baza
      .select({
        igracId: nagradeMisija.igracId,
        xpStvarno: nagradeMisija.xpStvarno,
        xpNominalno: nagradeMisija.xpNominalno,
        vrsta: dodjeleMisija.vrsta,
      })
      .from(nagradeMisija)
      .innerJoin(dodjeleMisija, eq(nagradeMisija.dodjelaId, dodjeleMisija.id))
      .where(nagradeUvjet);
    xpMisija.brojNagrada = nagradeRedovi.length;
    for (const n of nagradeRedovi) {
      xpMisija.ukupnoStvarno += n.xpStvarno;
      xpMisija.ukupnoNominalno += n.xpNominalno;
      xpMisija.primatelji.add(n.igracId);
      if (n.vrsta === 'dnevna') xpMisija.dnevneStvarno += n.xpStvarno;
      else xpMisija.tjedneStvarno += n.xpStvarno;
    }
  }

  const izazovXpRedovi = await baza
    .select({
      igracId: zavrseciIzazova.igracId,
      awardedXp: zavrseciIzazova.awardedXp,
    })
    .from(zavrseciIzazova)
    .innerJoin(igraci, eq(zavrseciIzazova.igracId, igraci.id))
    .where(and(
      gte(zavrseciIzazova.vrijeme, od),
      lt(zavrseciIzazova.vrijeme, doGranica),
      eq(igraci.upravljac, 'covjek'),
    ));
  const izazovPrimatelji = new Set(izazovXpRedovi.map((r) => r.igracId));
  const izazovXpUkupno = izazovXpRedovi.reduce((s, r) => s + r.awardedXp, 0);

  const prvaOtkljucavanja = await baza
    .select({ broj: sql<number>`count(*)::int` })
    .from(dostignucaIgraca)
    .innerJoin(igraci, eq(dostignucaIgraca.igracId, igraci.id))
    .where(and(
      gte(dostignucaIgraca.prvoOtkljucano, od),
      lt(dostignucaIgraca.prvoOtkljucano, doGranica),
      eq(igraci.upravljac, 'covjek'),
    ));

  const otkljucavanjaRijeciPeriod = await baza
    .select({ broj: sql<number>`count(*)::int` })
    .from(otkljucaneRijeciIgraca)
    .innerJoin(igraci, eq(otkljucaneRijeciIgraca.igracId, igraci.id))
    .where(and(
      gte(otkljucaneRijeciIgraca.otkljucano, od),
      lt(otkljucaneRijeciIgraca.otkljucano, doGranica),
      eq(igraci.upravljac, 'covjek'),
    ));

  // ——— Trenutačni presjek ———
  const bazaIgracaIds = await dohvatiBazuIgraca();
  let xpPresjek = raspodjelaRazinaXp([]);
  let dostignucaPresjek = agregirajDostignucaPresjek([]);
  let kolekcijaPresjek = agregirajKolekcijuPresjek([], 0, 0, 0);

  if (bazaIgracaIds.length > 0) {
    const igraciXp = await baza
      .select({ id: igraci.id, iskustvoUkupno: igraci.iskustvoUkupno })
      .from(igraci)
      .where(and(inArray(igraci.id, bazaIgracaIds), isNull(igraci.obrisanAt)));
    xpPresjek = raspodjelaRazinaXp(igraciXp.map((i) => i.iskustvoUkupno));

    const [napreci, otkljucana, nizovi] = await Promise.all([
      baza.select().from(napredakDostignucaIgraca).where(inArray(napredakDostignucaIgraca.igracId, bazaIgracaIds)),
      baza.select({
        igracId: dostignucaIgraca.igracId,
        dostignuceId: dostignucaIgraca.dostignuceId,
        razina: dostignucaIgraca.razina,
      }).from(dostignucaIgraca).where(inArray(dostignucaIgraca.igracId, bazaIgracaIds)),
      baza.select({
        igracId: nizAktivnostiIgraca.igracId,
        najboljiNiz: nizAktivnostiIgraca.najboljiNiz,
      }).from(nizAktivnostiIgraca).where(inArray(nizAktivnostiIgraca.igracId, bazaIgracaIds)),
    ]);
    const napredakMap = new Map(napreci.map((n) => [n.igracId, n]));
    const razineMap = new Map<string, Map<string, number>>();
    for (const r of otkljucana) {
      const m = razineMap.get(r.igracId) ?? new Map();
      m.set(r.dostignuceId, r.razina);
      razineMap.set(r.igracId, m);
    }
    const nizMap = new Map(nizovi.map((n) => [n.igracId, n.najboljiNiz]));
    const igraciPodaci = igraciXp.map((i) => ({
      iskustvoUkupno: i.iskustvoUkupno,
      najboljiNizAktivnosti: nizMap.get(i.id) ?? 0,
      spremljeneRazine: razineMap.get(i.id) ?? new Map<string, number>(),
      brojac: (napredakMap.get(i.id) ?? null) as BrojaciDostignucaZaIzracun | null,
    }));
    dostignucaPresjek = agregirajDostignucaPresjek(igraciPodaci);

    const kolekcijaAgregat = await baza
      .select({
        igracId: otkljucaneRijeciIgraca.igracId,
        broj: sql<number>`count(*)::int`,
        duge: sql<number>`count(*) filter (where ${otkljucaneRijeciIgraca.dugaTier} is not null)::int`,
        rijetke: sql<number>`count(*) filter (where ${otkljucaneRijeciIgraca.rijetkaTier} is not null)::int`,
      })
      .from(otkljucaneRijeciIgraca)
      .where(inArray(otkljucaneRijeciIgraca.igracId, bazaIgracaIds))
      .groupBy(otkljucaneRijeciIgraca.igracId);
    const velicineMap = new Map(kolekcijaAgregat.map((r) => [r.igracId, Number(r.broj)]));
    const velicine = bazaIgracaIds.map((id) => velicineMap.get(id) ?? 0);
    const brojDugih = kolekcijaAgregat.reduce((s, r) => s + Number(r.duge), 0);
    const brojRijetkih = kolekcijaAgregat.reduce((s, r) => s + Number(r.rijetke), 0);
    const [distinct] = await baza
      .select({ broj: sql<number>`count(distinct ${otkljucaneRijeciIgraca.rijec})::int` })
      .from(otkljucaneRijeciIgraca)
      .where(inArray(otkljucaneRijeciIgraca.igracId, bazaIgracaIds));
    kolekcijaPresjek = agregirajKolekcijuPresjek(velicine, brojDugih, brojRijetkih, Number(distinct?.broj ?? 0));
  }

  return {
    vremenskaZona: ANALITIKA_VREMENSKA_ZONA,
    od: opcije.odDan,
    do: opcije.doDan,
    danas: danasZagrebIso(),
    kontekst: opcije.kontekst ?? null,
    napomena:
      'Razdoblje = događaji u od–do (Zagreb). Trenutačni presjek = stanje sada (XP/razine/zvjezdice/kolekcija); filter datuma ga ne rekonstruira unatrag. '
      + 'Misije: kohorta po stvoreno_u; terminalna stopa = dovrsene/(dovrsene+zamijenjene+istekle); dnevne nemaju kalendarski istek. '
      + 'XP nagrada = xp_stvarno. Dostignuća = max(spremljena, dinamička) kao profil. Botovi isključeni; baza = ljudi s ≥1 završenom igrom. '
      + (kontekstNapomena ?? ''),
    razdoblje: {
      misije: {
        dnevne: poVrsti.dnevna,
        tjedne: poVrsti.tjedna,
        napomenaNazivnika:
          'Terminalna stopa dovršavanja koristi nazivnik dovrsene+zamijenjene+istekle. Aktivne nisu neuspjeh; dnevne mogu ostati aktivne više dana.',
      },
      predlosci: predlosciRedovi,
      zamjene: {
        ukupno: zamjene.length,
        jedinstveniIgraci: igraciZamjena.size,
        dnevne: zamjenePoVrsti.dnevna,
        tjedne: zamjenePoVrsti.tjedna,
        najcesceZamijenjeni: topPredlozak(stare),
        najcesceDobiveniKaoZamjena: topPredlozak(nove),
        stopaPoPredloskuKohorteDodjela: zamjeneKohortaPredloska,
      },
      dotokDnevnih: {
        ...dotokBrojevi,
        napomena: 'Preskočeno nije nužno svjesno odustajanje; dani bez posjeta nemaju zapis.',
      },
      doprinosiINagradeMisija,
      doprinosi: doprinosiPoKontekstu,
      xpMisija: {
        ukupnoStvarno: xpMisija.ukupnoStvarno,
        ukupnoNominalno: xpMisija.ukupnoNominalno,
        dnevneStvarno: xpMisija.dnevneStvarno,
        tjedneStvarno: xpMisija.tjedneStvarno,
        brojNagrada: xpMisija.brojNagrada,
        primatelji: xpMisija.primatelji.size,
        prosjekStvarnogPoNagradi: xpMisija.brojNagrada === 0
          ? null
          : xpMisija.ukupnoStvarno / xpMisija.brojNagrada,
      },
      xpIzazova: {
        zasebnaMetrika: 'izazovi' as const,
        napomena: 'XP iz prvih uspjeha izazova (zavrseci_izazova); ne filtrira se kontekstom Brze/Treninga/Privatne.',
        prviUspjesi: izazovXpRedovi.length,
        jedinstveniIgraci: izazovPrimatelji.size,
        awardedXpUkupno: izazovXpUkupno,
        prosjekPoPrvomUspjehu: izazovXpRedovi.length === 0
          ? null
          : izazovXpUkupno / izazovXpRedovi.length,
      },
      prvaOtkljucavanjaDostignuca: Number(prvaOtkljucavanja[0]?.broj ?? 0),
      otkljucavanjaRijeci: Number(otkljucavanjaRijeciPeriod[0]?.broj ?? 0),
    },
    trenutacniPresjek: {
      oznaka: 'trenutacno',
      bazaIgraca: bazaIgracaIds.length,
      xpRazine: xpPresjek,
      dostignuca: dostignucaPresjek,
      kolekcija: kolekcijaPresjek,
    },
  };
}
