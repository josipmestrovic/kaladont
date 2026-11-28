/** Tipovi odgovora admin analitike. */

export type TabAnalitike =
  | 'igraci'
  | 'partije'
  | 'cekaonica'
  | 'botovi'
  | 'izazovi'
  | 'gamifikacija'
  | 'rjecnik';

export type KontekstFilter = '' | 'javna' | 'privatna' | 'trening' | 'izazov';

export interface AgregatPocetnih {
  od: string;
  do: string;
  kontekst: string | null;
  vremenskaZona: string;
  posjecenost: string;
  dodijeljene: number;
  rezervni: number;
  udioRezervnog: number | null;
  nemaKandidata: number;
  raniIncidenti: number;
  udioRanihIncidenata: number | null;
  incidentiNa1: number;
  incidentiNa2: number;
  incidentiNa3: number;
  dvaOdgovoraOk: number;
  triOdgovoraOk: number;
  prozorOk: number;
  nepotpuna: number;
  zatvorenaDrugim: number;
}

export interface IncidentRedak {
  id: string;
  igraId: string;
  redniBrojOtvaranja: number;
  kontekst: string;
  mod: string;
  sustavskaRijec: string | null;
  izvor: string;
  odgovor1: string | null;
  odgovor2: string | null;
  odgovor3: string | null;
  incidentPozicija: number | null;
  incidentRijecUzrok: string | null;
  incidentRazlog: string | null;
  dodijeljenoU: string;
}

export interface Dnevno {
  dani: { dan: string; zapocete: number; zavrsene: number }[];
  ljudi: {
    igraci: number;
    ponavljanja: { prag: number; broj: number; postotak: number | null }[];
    postotakGost: number | null;
    postotakRegistriran: number | null;
    sudjelovanjaGost: number;
    sudjelovanjaRegistriran: number;
  };
}

export interface StatusAnalitike {
  imaMjerenja: boolean;
  mjerenjeOd: string | null;
  zadnjiZapisU: string | null;
  otvaranja: { ukupno: number; otvoreni: number; nepotpuni: number };
  igre: { ukupno: number; bezIshoda: number };
  napomena: string;
}

export interface WilsonInterval {
  low: number;
  high: number;
}

export interface RedakIzazova {
  challengeId: string;
  definitionVersion: number;
  botProfileVersion: number | null;
  turnDurationMs: number | null;
  started: number;
  aktivni: number;
  tehnicki: number;
  uspjesi: number;
  neuspjesi: number;
  igrackiZavrseni: number;
  attemptSuccessBrojnik: number;
  attemptSuccessNazivnik: number;
  attemptSuccessRate: number | null;
  gameWon: number;
  gameWonRate: number | null;
  uniqueStarted: number;
  uniqueSuccess: number;
  uniqueSuccessRate: number | null;
  uniqueSuccessWilson: WilsonInterval | null;
  maliUzorak: boolean;
  firstTrySuccess: number;
  firstTryPlayers: number;
  firstTryRate: number | null;
  attemptsToFirstSuccessMedian: number | null;
  trajanjeMedianMs: number | null;
  trajanjeP90Ms: number | null;
  reasons: Record<string, number>;
  startedGost: number;
  startedRegistriran: number;
  uspjesiGost: number;
  uspjesiRegistriran: number;
}

export interface AgregatIzazova {
  od: string;
  do: string;
  vremenskaZona: string;
  ukupno: {
    started: number;
    aktivni: number;
    tehnicki: number;
    uspjesi: number;
    neuspjesi: number;
    uniqueStarted: number;
    uniqueSuccess: number;
    uniqueSuccessRate: number | null;
    uniqueSuccessWilson: WilsonInterval | null;
    maliUzorak: boolean;
  };
  redovi: RedakIzazova[];
}

export interface AgregatIgraca {
  od: string;
  do: string;
  kontekst: string | null;
  vremenskaZona: string;
  danas: string;
  referentniDan: string;
  referentniDanNezavrsen: boolean;
  mjerenjeOd: string | null;
  napomena: string;
  kpi: {
    dau: number;
    wau: number;
    mau: number;
    dauMau: number | null;
    registracijeRaspon: number;
    konverzija30d: { gosti: number; konvertirani: number; postotak: number | null };
    konverzijaDosadNezrele: { gosti: number; konvertirani: number; postotak: number | null };
  };
  retencijaUkupno: {
    d1: { povratnici: number; kohorta: number; postotak: number | null };
    d7: { povratnici: number; kohorta: number; postotak: number | null };
    d30: { povratnici: number; kohorta: number; postotak: number | null };
  };
  dani: { dan: string; dau: number; novi: number; povratni: number; registracije: number }[];
  retencijaKohorte: {
    kohortaDan: string;
    noviIgraci: number;
    d1Povratnici: number | null;
    d1Postotak: number | null;
    d7Povratnici: number | null;
    d7Postotak: number | null;
    d30Povratnici: number | null;
    d30Postotak: number | null;
    d1Zrela: boolean;
    d7Zrela: boolean;
    d30Zrela: boolean;
  }[];
}

export interface SazetakMisijaVrste {
  dodijeljene: number;
  dovrsene: number;
  aktivne: number;
  zamijenjene: number;
  istekle: number;
  primatelji: number;
  dovrsitelji: number;
  udioTrenutnoDovrsenih: number | null;
  terminalnaStopaDovrsavanja: number | null;
  terminalniNazivnik: number;
  vrijemeDovrsetka: { prosjekSekundi: number | null; medijanSekundi: number | null; uzorak: number };
}

export interface PredlozakZamjene {
  predlozakId: string;
  naziv: string;
  verzijaDefinicije: number;
  broj: number;
}

export interface AgregatGamifikacije {
  od: string;
  do: string;
  kontekst: string | null;
  vremenskaZona: string;
  napomena: string;
  razdoblje: {
    misije: { dnevne: SazetakMisijaVrste; tjedne: SazetakMisijaVrste; napomenaNazivnika: string };
    predlosci: {
      predlozakId: string;
      naziv: string;
      vrsta: string;
      verzijaDefinicije: number;
      dodjele: number;
      dovrsene: number;
      zamijenjene: number;
      istekle: number;
      aktivne: number;
      terminalnaStopaDovrsavanja: number | null;
      stopaZamjenjivanja: number | null;
      maliUzorak: boolean;
    }[];
    zamjene: {
      ukupno: number;
      jedinstveniIgraci: number;
      dnevne: number;
      tjedne: number;
      najcesceZamijenjeni: PredlozakZamjene[];
      najcesceDobiveniKaoZamjena: PredlozakZamjene[];
      stopaPoPredloskuKohorteDodjela: {
        predlozakId: string;
        vrsta: string;
        verzijaDefinicije: number;
        naziv: string;
        zamijenjeneDodjele: number;
        dodjeleKohorte: number;
        stopaZamjenjivanja: number | null;
        maliUzorak: boolean;
      }[];
    };
    dotokDnevnih: { dodijeljeno: number; preskoceno: number; napomena: string };
    doprinosiINagradeMisija: { dostupno: boolean; razlog: string | null };
    doprinosi: Record<string, { doprinosi: number; distinctIgara: number }>;
    xpMisija: {
      ukupnoStvarno: number;
      ukupnoNominalno: number;
      dnevneStvarno: number;
      tjedneStvarno: number;
      brojNagrada: number;
      primatelji: number;
      prosjekStvarnogPoNagradi: number | null;
    };
    xpIzazova: {
      zasebnaMetrika: 'izazovi';
      napomena: string;
      prviUspjesi: number;
      jedinstveniIgraci: number;
      awardedXpUkupno: number;
      prosjekPoPrvomUspjehu: number | null;
    };
    prvaOtkljucavanjaDostignuca: number;
    otkljucavanjaRijeci: number;
  };
  trenutacniPresjek: {
    oznaka: string;
    bazaIgraca: number;
    xpRazine: {
      poRasponu: { raspon: string; broj: number }[];
      prosjekXp: number | null;
      medijanXp: number | null;
      prosjekRazina: number | null;
      medijanRazina: number | null;
      napredovaliIznadPrve: number;
      uzorak: number;
    };
    dostignuca: {
      igraciSBaremJednim: number;
      prosjekOtkljucanih: number | null;
      prosjekZvjezdica: number | null;
      medijanZvjezdica: number | null;
      raspodjelaUkupnihZvjezdica: { raspon: string; broj: number }[];
      igraciSMaksimalnoDovrsenimPojedinim: number;
      poDostignucu: {
        id: string;
        naziv: string;
        otkljucani: number;
        udioOtkljucanih: number | null;
        naMaksimalnojRazini: number;
        prosjekZvjezdicaOtkljucanih: number | null;
        maksimalnaRazina: number;
        raspodjelaRazina: { razina: number; broj: number }[];
      }[];
    };
    kolekcija: {
      igraciSBaremJednomRijeci: number;
      distinctRijeciGlobalno: number;
      prosjekVelicine: number | null;
      medijanVelicine: number | null;
      brojDugihOtkljucavanja: number;
      brojRijetkihOtkljucavanja: number;
      raspodjelaVelicine: { raspon: string; broj: number }[];
    };
  };
}

export interface TrajanjeStat {
  prosjekSekundi: number | null;
  medijanSekundi: number | null;
  p90Sekundi: number | null;
  p95Sekundi?: number | null;
  uzorak: number;
}

export interface SegmentCekanja {
  terminalniPokusaji: number;
  ishodi: { ishod: string; broj: number; postotak: number | null }[];
  trajanjeDoUparivanja: TrajanjeStat;
  trajanjeDoNapustanja: TrajanjeStat;
  distribucijaNapustanja: { interval: string; broj: number; postotak: number | null }[];
}

export interface AgregatCekanjaOdgovor {
  ok: boolean;
  dostupno: boolean;
  razlog?: string;
  od: string;
  do: string;
  kontekst?: string | null;
  vremenskaZona?: string;
  danas?: string;
  mjerenjeOd?: string | null;
  napomena?: string;
  ukupno?: SegmentCekanja;
  gosti?: SegmentCekanja;
  registrirani?: SegmentCekanja;
}

export interface MetrikaPobjedaBotova {
  zavrseneProtivBotova: number;
  pobjedeLjudi: number;
  pobjedeBotova: number;
  nepoznatPobjednik: number;
  udioPobjedaLjudi: number | null;
  udioPobjedaBotova: number | null;
  maliUzorak: boolean;
  wilsonLjudi: WilsonInterval | null;
}

export interface AgregatBotova {
  od: string;
  do: string;
  kontekst: string | null;
  vremenskaZona: string;
  napomena: string;
  pokrivenost: {
    zapocete: number;
    sastav: { broj: number; postotak: number | null };
    profil: { broj: number; postotak: number | null };
    pobjednik: { broj: number; postotak: number | null };
    eliminacije: { broj: number; postotak: number | null };
  };
  uspjesnost: {
    ukupno: MetrikaPobjedaBotova;
    poProfilu: (MetrikaPobjedaBotova & { profil: string })[];
    poFormatu: (MetrikaPobjedaBotova & { mod: string })[];
    poPravilima: (MetrikaPobjedaBotova & { pravila: string })[];
    poVerziji: (MetrikaPobjedaBotova & { verzija: string })[];
  };
  sastavJavnih: (MetrikaPobjedaBotova & { sastav: string; brojIgara: number; udio: number | null })[];
  eliminacije: {
    ljudi: { razlog: string; broj: number; postotak: number | null }[];
    botovi: { razlog: string; broj: number; postotak: number | null }[];
  };
  trajanje: {
    poProfilu: (TrajanjeStat & { profil: string })[];
    poFormatu: (TrajanjeStat & { mod: string })[];
    poPravilima: (TrajanjeStat & { pravila: string })[];
  };
}

export interface AgregatPartija {
  od: string;
  do: string;
  kontekst: string | null;
  vremenskaZona: string;
  napomena: string;
  sazetak: {
    zapocete: number;
    zavrsene: number;
    prekinute: number;
    nepotpuno: number;
    bezIshoda: number;
    jedinstveniIgraci: number;
    stopaZavrsavanja: number | null;
    pokrivenostTerminalnih: number | null;
    trajanje: TrajanjeStat;
    pokrivenostPravila: number | null;
  };
  nacini: {
    kontekst: string;
    zapocete: number;
    zavrsene: number;
    prekinute: number;
    nepotpuno: number;
    bezIshoda: number;
    jedinstveniIgraci: number;
    udioZapocetih: number | null;
    stopaZavrsavanja: number | null;
    pokrivenostTerminalnih: number | null;
    trajanje: TrajanjeStat;
  }[];
  formati: {
    kontekst: string | null;
    mod: string;
    zapocete: number;
    zavrsene: number;
    udioZapocetih: number | null;
    stopaZavrsavanja: number | null;
    trajanje: TrajanjeStat;
  }[];
  pravila: {
    pravila: string;
    zapocete: number;
    zavrsene: number;
    udioZapocetih: number | null;
    stopaZavrsavanja: number | null;
    trajanje: TrajanjeStat;
  }[];
}

export interface StanjeTaba {
  ucitava: boolean;
  greska: string | null;
  ucitano: boolean;
}

export const TABOVI_ANALITIKE: { id: TabAnalitike; oznaka: string }[] = [
  { id: 'igraci', oznaka: 'Igrači i rast' },
  { id: 'partije', oznaka: 'Partije' },
  { id: 'cekaonica', oznaka: 'Čekaonica' },
  { id: 'botovi', oznaka: 'Botovi i balans' },
  { id: 'izazovi', oznaka: 'Izazovi' },
  { id: 'gamifikacija', oznaka: 'Gamifikacija' },
  { id: 'rjecnik', oznaka: 'Rječnik i incidenti' },
];
