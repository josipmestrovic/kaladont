/**
 * Agregati botova i balansa — kohorta po početku igre (Europe/Zagreb).
 * Ne duplicira analitiku Izazova; reuse Wilson / prag malog uzorka.
 */
import { and, eq, gte, lt, type SQL } from 'drizzle-orm';
import { baza } from '../baza/klijent.js';
import {
  analitikaIgre,
  igraci,
  partije,
  type BrojaciEliminacijaAnalitike,
} from '../baza/shema.js';
import { PRAG_MALI_UZORAK_IZAZOVA, wilsonInterval95 } from '../izazovi/analitika.js';
import { medijanTrajanja, p90Trajanja, prosjekTrajanja } from './partije.js';
import {
  ANALITIKA_VREMENSKA_ZONA,
  danasZagrebIso,
  pocetakDanaZagrebUtc,
  type KontekstOtvaranjaAnalitike,
} from './otvaranja.js';
import { prazniBrojaciEliminacija } from './igre.js';

export const PRAG_MALI_UZORAK_BOTOVA = PRAG_MALI_UZORAK_IZAZOVA;

function postotak(brojnik: number, nazivnik: number): number | null {
  if (nazivnik === 0) return null;
  return (brojnik / nazivnik) * 100;
}

function statistikaTrajanja(sekunde: number[]) {
  return {
    prosjekSekundi: prosjekTrajanja(sekunde),
    medijanSekundi: medijanTrajanja(sekunde),
    p90Sekundi: p90Trajanja(sekunde),
    uzorak: sekunde.length,
  };
}

type RazlogElim = keyof BrojaciEliminacijaAnalitike;

function zbrojiEliminacije(
  cilj: BrojaciEliminacijaAnalitike,
  izvor: BrojaciEliminacijaAnalitike | null | undefined,
): void {
  if (!izvor) return;
  for (const kljuc of Object.keys(cilj) as RazlogElim[]) {
    cilj[kljuc] += Number(izvor[kljuc] ?? 0);
  }
}

function redoviEliminacija(brojac: BrojaciEliminacijaAnalitike) {
  const ukupnoPoznato = Object.entries(brojac)
    .filter(([k]) => k !== 'nepoznato')
    .reduce((s, [, v]) => s + v, 0);
  const razlozi: RazlogElim[] = ['ne_znam', 'istek', 'mrtva_slova', 'prekid', 'kaladont', 'nepoznato'];
  return razlozi.map((razlog) => ({
    razlog,
    broj: brojac[razlog],
    postotak: razlog === 'nepoznato'
      ? null
      : postotak(brojac[razlog], ukupnoPoznato),
  }));
}

interface RedIgre {
  kontekst: string;
  mod: string;
  pravila: string | null;
  brojLjudi: number | null;
  brojBotova: number | null;
  profilBotova: string | null;
  verzijaBotPolitike: number | null;
  verzijaProfilaBota: number | null;
  vrstaPobjednika: 'covjek' | 'bot' | null;
  ishod: string | null;
  trajanjeSekundi: number | null;
  eliminacijeLjudi: BrojaciEliminacijaAnalitike | null;
  eliminacijeBotova: BrojaciEliminacijaAnalitike | null;
}

interface BrojacPobjeda {
  zavrseneProtivBotova: number;
  pobjedeLjudi: number;
  pobjedeBotova: number;
  nepoznatPobjednik: number;
}

function prazanBrojacPobjeda(): BrojacPobjeda {
  return { zavrseneProtivBotova: 0, pobjedeLjudi: 0, pobjedeBotova: 0, nepoznatPobjednik: 0 };
}

function zapisiPobjedu(b: BrojacPobjeda, red: RedIgre): void {
  if ((red.brojBotova ?? 0) <= 0) return;
  if (red.ishod !== 'zavrsena') return;
  b.zavrseneProtivBotova += 1;
  if (red.vrstaPobjednika === 'covjek') b.pobjedeLjudi += 1;
  else if (red.vrstaPobjednika === 'bot') b.pobjedeBotova += 1;
  else b.nepoznatPobjednik += 1;
}

function metrikaPobjeda(b: BrojacPobjeda) {
  const poznati = b.pobjedeLjudi + b.pobjedeBotova;
  const udioLjudi = postotak(b.pobjedeLjudi, poznati);
  return {
    ...b,
    udioPobjedaLjudi: udioLjudi,
    udioPobjedaBotova: postotak(b.pobjedeBotova, poznati),
    maliUzorak: poznati < PRAG_MALI_UZORAK_BOTOVA,
    wilsonLjudi: wilsonInterval95(b.pobjedeLjudi, poznati),
  };
}

export async function agregirajBotove(opcije: {
  odDan: string;
  doDan: string;
  kontekst?: KontekstOtvaranjaAnalitike;
}) {
  const od = pocetakDanaZagrebUtc(opcije.odDan);
  const doGranica = pocetakDanaZagrebUtc(
    (() => {
      const bazaDatuma = new Date(`${opcije.doDan}T12:00:00.000Z`);
      bazaDatuma.setUTCDate(bazaDatuma.getUTCDate() + 1);
      return bazaDatuma.toISOString().slice(0, 10);
    })(),
  );

  const uvjetKonteksta: SQL | undefined = opcije.kontekst
    ? eq(analitikaIgre.kontekst, opcije.kontekst)
    : undefined;
  const uvjetKohorte = and(
    gte(analitikaIgre.pocetakU, od),
    lt(analitikaIgre.pocetakU, doGranica),
    uvjetKonteksta,
  );

  const sirovi = await baza
    .select({
      kontekst: analitikaIgre.kontekst,
      mod: analitikaIgre.mod,
      pravila: analitikaIgre.pravila,
      brojLjudi: analitikaIgre.brojLjudi,
      brojBotova: analitikaIgre.brojBotova,
      profilBotova: analitikaIgre.profilBotova,
      verzijaBotPolitike: analitikaIgre.verzijaBotPolitike,
      verzijaProfilaBota: analitikaIgre.verzijaProfilaBota,
      vrstaPobjednika: analitikaIgre.vrstaPobjednika,
      ishod: analitikaIgre.ishod,
      pocetakU: analitikaIgre.pocetakU,
      krajU: analitikaIgre.krajU,
      eliminacijeLjudi: analitikaIgre.eliminacijeLjudi,
      eliminacijeBotova: analitikaIgre.eliminacijeBotova,
      partijaBrojBotova: partije.brojBotova,
      pobjednikUpravljac: igraci.upravljac,
    })
    .from(analitikaIgre)
    .leftJoin(partije, eq(analitikaIgre.igraId, partije.id))
    .leftJoin(igraci, eq(partije.pobjednikId, igraci.id))
    .where(uvjetKohorte);

  const redovi: RedIgre[] = sirovi.map((r) => {
    const brojBotova = r.brojBotova ?? (r.partijaBrojBotova != null ? Number(r.partijaBrojBotova) : null);
    let vrstaPobjednika = r.vrstaPobjednika as 'covjek' | 'bot' | null;
    if (vrstaPobjednika == null && r.pobjednikUpravljac === 'covjek') vrstaPobjednika = 'covjek';
    if (vrstaPobjednika == null && r.pobjednikUpravljac === 'bot') vrstaPobjednika = 'bot';
    let trajanjeSekundi: number | null = null;
    if (r.ishod === 'zavrsena' && r.krajU && r.pocetakU) {
      const ms = r.krajU.getTime() - r.pocetakU.getTime();
      if (Number.isFinite(ms) && ms >= 0) trajanjeSekundi = ms / 1000;
    }
    return {
      kontekst: r.kontekst,
      mod: r.mod,
      pravila: r.pravila,
      brojLjudi: r.brojLjudi,
      brojBotova,
      profilBotova: r.profilBotova,
      verzijaBotPolitike: r.verzijaBotPolitike,
      verzijaProfilaBota: r.verzijaProfilaBota,
      vrstaPobjednika,
      ishod: r.ishod,
      trajanjeSekundi,
      eliminacijeLjudi: r.eliminacijeLjudi,
      eliminacijeBotova: r.eliminacijeBotova,
    };
  });

  const ukupno = prazanBrojacPobjeda();
  const poProfilu = new Map<string, BrojacPobjeda>();
  const poFormatu = new Map<string, BrojacPobjeda>();
  const poPravilima = new Map<string, BrojacPobjeda>();
  const poSastavu = new Map<string, BrojacPobjeda & { brojIgara: number }>();
  const poVerziji = new Map<string, BrojacPobjeda>();
  const eliminacijeLjudi = prazniBrojaciEliminacija();
  const eliminacijeBotova = prazniBrojaciEliminacija();
  const trajanjaPoProfilu = new Map<string, number[]>();
  const trajanjaPoFormatu = new Map<string, number[]>();
  const trajanjaPoPravilima = new Map<string, number[]>();

  let zapocete = 0;
  let pokrivenostSastava = 0;
  let pokrivenostProfila = 0;
  let pokrivenostPobjednika = 0;
  let pokrivenostEliminacija = 0;
  let javneZapocete = 0;

  for (const red of redovi) {
    zapocete += 1;
    if (red.brojBotova != null) pokrivenostSastava += 1;
    if (red.profilBotova != null || red.brojBotova === 0) pokrivenostProfila += 1;
    if (red.ishod === 'zavrsena' && red.vrstaPobjednika != null) pokrivenostPobjednika += 1;
    if (red.eliminacijeLjudi != null || red.eliminacijeBotova != null) pokrivenostEliminacija += 1;

    zapisiPobjedu(ukupno, red);
    zbrojiEliminacije(eliminacijeLjudi, red.eliminacijeLjudi);
    zbrojiEliminacije(eliminacijeBotova, red.eliminacijeBotova);

    if ((red.brojBotova ?? 0) > 0 && red.ishod === 'zavrsena') {
      const profilKljuc = red.profilBotova ?? 'nepoznato';
      const formatKljuc = red.mod;
      const pravilaKljuc = red.pravila ?? 'nepoznato';
      const verzijaKljuc = `p${red.verzijaBotPolitike ?? 'n'}/b${red.verzijaProfilaBota ?? 'n'}`;

      if (!poProfilu.has(profilKljuc)) poProfilu.set(profilKljuc, prazanBrojacPobjeda());
      zapisiPobjedu(poProfilu.get(profilKljuc)!, red);

      if (!poFormatu.has(formatKljuc)) poFormatu.set(formatKljuc, prazanBrojacPobjeda());
      zapisiPobjedu(poFormatu.get(formatKljuc)!, red);

      if (!poPravilima.has(pravilaKljuc)) poPravilima.set(pravilaKljuc, prazanBrojacPobjeda());
      zapisiPobjedu(poPravilima.get(pravilaKljuc)!, red);

      if (!poVerziji.has(verzijaKljuc)) poVerziji.set(verzijaKljuc, prazanBrojacPobjeda());
      zapisiPobjedu(poVerziji.get(verzijaKljuc)!, red);

      if (red.trajanjeSekundi != null) {
        if (!trajanjaPoProfilu.has(profilKljuc)) trajanjaPoProfilu.set(profilKljuc, []);
        trajanjaPoProfilu.get(profilKljuc)!.push(red.trajanjeSekundi);
        if (!trajanjaPoFormatu.has(formatKljuc)) trajanjaPoFormatu.set(formatKljuc, []);
        trajanjaPoFormatu.get(formatKljuc)!.push(red.trajanjeSekundi);
        if (!trajanjaPoPravilima.has(pravilaKljuc)) trajanjaPoPravilima.set(pravilaKljuc, []);
        trajanjaPoPravilima.get(pravilaKljuc)!.push(red.trajanjeSekundi);
      }
    }

    if (red.kontekst === 'javna' && red.brojLjudi != null && red.brojBotova != null) {
      javneZapocete += 1;
      const sastavKljuc = `${red.brojLjudi}c-${red.brojBotova}b`;
      if (!poSastavu.has(sastavKljuc)) {
        poSastavu.set(sastavKljuc, { ...prazanBrojacPobjeda(), brojIgara: 0 });
      }
      const s = poSastavu.get(sastavKljuc)!;
      s.brojIgara += 1;
      zapisiPobjedu(s, red);
    }
  }

  return {
    vremenskaZona: ANALITIKA_VREMENSKA_ZONA,
    od: opcije.odDan,
    do: opcije.doDan,
    danas: danasZagrebIso(),
    kontekst: opcije.kontekst ?? null,
    napomena:
      'Kohorta po početku igre (Europe/Zagreb). Uspješnost protiv botova samo za završene igre s ≥1 botom i poznatom vrstom pobjednika. Snimka profila/verzije je stanje pri startu partije. Eliminacije ≠ završni plasman. Izazov pokušaji ostaju zasebna analitika.',
    pokrivenost: {
      zapocete,
      sastav: { broj: pokrivenostSastava, postotak: postotak(pokrivenostSastava, zapocete) },
      profil: { broj: pokrivenostProfila, postotak: postotak(pokrivenostProfila, zapocete) },
      pobjednik: { broj: pokrivenostPobjednika, postotak: postotak(pokrivenostPobjednika, zapocete) },
      eliminacije: { broj: pokrivenostEliminacija, postotak: postotak(pokrivenostEliminacija, zapocete) },
    },
    uspjesnost: {
      ukupno: metrikaPobjeda(ukupno),
      poProfilu: [...poProfilu.entries()]
        .map(([profil, b]) => ({ profil, ...metrikaPobjeda(b) }))
        .sort((a, b) => b.zavrseneProtivBotova - a.zavrseneProtivBotova),
      poFormatu: [...poFormatu.entries()]
        .map(([mod, b]) => ({ mod, ...metrikaPobjeda(b) }))
        .sort((a, b) => b.zavrseneProtivBotova - a.zavrseneProtivBotova),
      poPravilima: [...poPravilima.entries()]
        .map(([pravila, b]) => ({ pravila, ...metrikaPobjeda(b) }))
        .sort((a, b) => b.zavrseneProtivBotova - a.zavrseneProtivBotova),
      poVerziji: [...poVerziji.entries()]
        .map(([verzija, b]) => ({ verzija, ...metrikaPobjeda(b) }))
        .sort((a, b) => b.zavrseneProtivBotova - a.zavrseneProtivBotova),
    },
    sastavJavnih: [...poSastavu.entries()]
      .map(([sastav, b]) => ({
        sastav,
        brojIgara: b.brojIgara,
        udio: postotak(b.brojIgara, javneZapocete),
        ...metrikaPobjeda(b),
      }))
      .sort((a, b) => b.brojIgara - a.brojIgara),
    eliminacije: {
      ljudi: redoviEliminacija(eliminacijeLjudi),
      botovi: redoviEliminacija(eliminacijeBotova),
    },
    trajanje: {
      poProfilu: [...trajanjaPoProfilu.entries()]
        .map(([profil, sek]) => ({ profil, ...statistikaTrajanja(sek) }))
        .sort((a, b) => b.uzorak - a.uzorak),
      poFormatu: [...trajanjaPoFormatu.entries()]
        .map(([mod, sek]) => ({ mod, ...statistikaTrajanja(sek) }))
        .sort((a, b) => b.uzorak - a.uzorak),
      poPravilima: [...trajanjaPoPravilima.entries()]
        .map(([pravila, sek]) => ({ pravila, ...statistikaTrajanja(sek) }))
        .sort((a, b) => b.uzorak - a.uzorak),
    },
  };
}
