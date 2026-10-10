export interface UzorakNadzora {
  vrijeme: string;
  cpuPostotak: number;
  rssBajtovi: number;
  heapBajtovi: number;
  vanjskaMemorijaBajtovi: number;
  eventLoopP95Ms: number;
  http: { zahtjevi: number; greske4xx: number; greske5xx: number; p95Ms: number | null };
  socket: { pokusaji: number; odbijeni: number; autorizirani: number; greskeAutorizacije: number; prekidi: number; p95AutorizacijeMs: number | null; odbijeniOrigin: number; odbijeniIp: number; odbijeniLimit: number };
  igra: { veze: number; partije: number; treninzi: number; slobodniBotovi: number; botoviUPartiji: number; isteciBotova: number; greskeBotova: number };
  baza: { dostupna: boolean | null; trajanjeMs: number | null; provjerenoU: string | null };
}

export interface StanjeAlarma {
  kljuc: string;
  naziv: string;
  aktivan: boolean;
  zadnjaObavijest: string | null;
  greskaSlanja: boolean;
}

export interface PregledNadzora {
  ok: boolean;
  verzija: string;
  digest: string;
  uptimeSekunde: number;
  trenutno: UzorakNadzora | null;
  povijest: UzorakNadzora[];
  alarmi: StanjeAlarma[];
  emailOmogucen: boolean;
}