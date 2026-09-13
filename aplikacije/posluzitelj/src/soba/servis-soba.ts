/**
 * Upravljanje privatnim sobama za igru (2-8 igrača, prilagođena pravila i ljestvica sobe).
 */
import {
  SVE_VRSTE_RIJECI,
  izracunajRang,
  vratiVeciRang,
  type PostavkePrivatneSobe,
  type StanjePrivatneSobe,
  type VrstaRijeci,
} from 'zajednicko';
import type { KaladontIo, KaladontSocket } from '../server.js';
import type { StavkaReda } from '../red/red-cekanja.js';

const ALFABET_KODA = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function generirajKodSobe(): string {
  let rez = '';
  for (let i = 0; i < 6; i += 1) {
    rez += ALFABET_KODA[Math.floor(Math.random() * ALFABET_KODA.length)];
  }
  return rez;
}

const SOBA_PREFIX = (kod: string) => `soba:${kod.toUpperCase()}`;

export interface Soba {
  kod: string;
  vlasnikId: string;
  postavke: PostavkePrivatneSobe;
  clanoviMap: Map<
    string,
    {
      igracId: string;
      nadimak: string;
      avatarId: number;
      rang: string | null;
      odigrane: number;
      pobjede: number;
      bodoviUkupno: number;
      odigrane1v1?: number;
      pobjede1v1?: number;
      bodovi1v1?: number;
    }
  >;
  partijaId: string | null;
  status: 'cekanje' | 'u_tijeku' | 'zavrsena';
  brisanjeTimer: NodeJS.Timeout | null;
  pobjedeUSeriji: Map<string, number>;
  bodoviUSeriji: Map<string, number>;
}

function normalizirajPostavke(p?: Partial<PostavkePrivatneSobe>): PostavkePrivatneSobe {
  const trajanjePotezaSek =
    p?.trajanjePotezaSek === 0 || p?.trajanjePotezaSek === 15 || p?.trajanjePotezaSek === 60
      ? p.trajanjePotezaSek
      : 30;

  const dopusteniSkup = new Set(p?.dopusteneVrste ?? []);
  const filtrirane = SVE_VRSTE_RIJECI.filter((v) => dopusteniSkup.has(v));
  const dopusteneVrste = filtrirane.length > 0 ? filtrirane : [...SVE_VRSTE_RIJECI];

  return {
    trajanjePotezaSek,
    dopusteneVrste,
    eliminacijskiBodovi: Boolean(p?.eliminacijskiBodovi),
    samoOsnovniOblici: Boolean(p?.samoOsnovniOblici),
    minDuljinaRijeci: p?.minDuljinaRijeci && p.minDuljinaRijeci > 0 ? p.minDuljinaRijeci : 0,
  };
}

export function registrirajPrivatneSobe(
  io: KaladontIo,
  zapocniPrivatnuPartiju: (
    sudionici: StavkaReda[],
    postavke: PostavkePrivatneSobe,
    kodSobe: string,
  ) => string,
) {
  const sobe = new Map<string, Soba>(); // kod -> Soba
  const sobaPoIgracu = new Map<string, string>(); // igracId -> kod

  function ponistiBrisanjeSobe(soba: Soba) {
    if (soba.brisanjeTimer) {
      clearTimeout(soba.brisanjeTimer);
      soba.brisanjeTimer = null;
    }
  }

  function zakaziBrisanjeSobe(soba: Soba, odgodaMs = 300_000) {
    ponistiBrisanjeSobe(soba);
    soba.brisanjeTimer = setTimeout(() => {
      soba.brisanjeTimer = null;
      for (const [igracId, kod] of sobaPoIgracu.entries()) {
        if (kod === soba.kod) sobaPoIgracu.delete(igracId);
      }
      sobe.delete(soba.kod);
    }, odgodaMs);
    soba.brisanjeTimer.unref();
  }

  function izradiStanje(soba: Soba, mojIgracId: string): StanjePrivatneSobe {
    const clanovi = [...soba.clanoviMap.values()].map((c) => {
      const odig4 = c.odigrane ?? 0;
      const bod4 = c.bodoviUkupno ?? 0;
      const prosjek4 = odig4 > 0 ? bod4 / odig4 : 0;
      const rang4 = izracunajRang(odig4, prosjek4);

      const odig1 = c.odigrane1v1 ?? 0;
      const bod1 = c.bodovi1v1 ?? 0;
      const prosjek1 = odig1 > 0 ? bod1 / odig1 : 0;
      const rang1 = izracunajRang(odig1, prosjek1);

      const veciRang = vratiVeciRang(rang4, rang1);

      return {
        igracId: c.igracId,
        nadimak: c.nadimak,
        avatarId: c.avatarId,
        rang: veciRang === 'Piskaralo' ? null : veciRang,
        jeVlasnik: c.igracId === soba.vlasnikId,
          pobjedeUSobi: soba.pobjedeUSeriji.get(c.igracId) ?? 0,
          bodoviUSobi: soba.bodoviUSeriji.get(c.igracId) ?? 0,
      };
    });

       clanovi.sort((a, b) => b.bodoviUSobi - a.bodoviUSobi || b.pobjedeUSobi - a.pobjedeUSobi);

    return {
      kod: soba.kod,
      mojIgracId,
      postavke: soba.postavke,
      vlasnikId: soba.vlasnikId,
      clanovi,
      partijaId: soba.partijaId,
      status: soba.status,
    };
  }

  function emitirajStanje(soba: Soba) {
    const ioSoba = io.sockets.adapter.rooms.get(SOBA_PREFIX(soba.kod));
    if (!ioSoba) return;
    for (const socketId of ioSoba) {
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit('soba:stanje', izradiStanje(soba, socket.data.igracId));
      }
    }
  }

  function izadjiIzSobe(socket: KaladontSocket, eksplicitnoUkloni = true) {
    const igracId = socket.data.igracId;
    const kod = sobaPoIgracu.get(igracId);
    if (!kod) return;

    const soba = sobe.get(kod);
    if (!soba) {
      sobaPoIgracu.delete(igracId);
      return;
    }

    socket.leave(SOBA_PREFIX(kod));

    if (eksplicitnoUkloni && soba.status !== 'u_tijeku') {
      soba.clanoviMap.delete(igracId);
      sobaPoIgracu.delete(igracId);
    }

    if (soba.clanoviMap.size === 0) {
      zakaziBrisanjeSobe(soba, 60_000);
    } else {
      if (soba.vlasnikId === igracId && soba.clanoviMap.size > 0) {
        soba.vlasnikId = [...soba.clanoviMap.keys()][0]!;
      }
      emitirajStanje(soba);
    }
  }

  io.on('connection', (socket) => {
    socket.on('soba:stvori', (payload) => {
      izadjiIzSobe(socket, true);

      const postavke = normalizirajPostavke(payload?.postavke);
      let kod = generirajKodSobe();
      while (sobe.has(kod)) kod = generirajKodSobe();

      const igracId = socket.data.igracId;
      const soba: Soba = {
        kod,
        vlasnikId: igracId,
        postavke,
        clanoviMap: new Map([
          [
            igracId,
            {
              igracId,
              nadimak: socket.data.nadimak,
              avatarId: socket.data.avatarId,
              rang: null,
              odigrane: socket.data.odigrane ?? 0,
              pobjede: socket.data.pobjede ?? 0,
              bodoviUkupno: socket.data.bodoviUkupno ?? 0,
              odigrane1v1: socket.data.odigrane1v1 ?? 0,
              pobjede1v1: socket.data.pobjede1v1 ?? 0,
              bodovi1v1: socket.data.bodovi1v1 ?? 0,
            },
          ],
        ]),
        partijaId: null,
        status: 'cekanje',
        brisanjeTimer: null,
        pobjedeUSeriji: new Map(),
        bodoviUSeriji: new Map(),
      };

      sobe.set(kod, soba);
      sobaPoIgracu.set(igracId, kod);
      socket.join(SOBA_PREFIX(kod));

      socket.emit('soba:stvorena', { kod });
      emitirajStanje(soba);
    });

    socket.on('soba:udji', (payload) => {
      const kod = payload?.kod?.toString().trim().toUpperCase();
      if (!kod) {
        socket.emit('greska', { kod: 'SOBA_NE_POSTOJI', poruka: 'Kod sobe nije ispravan.' });
        return;
      }

      const soba = sobe.get(kod);
      if (!soba) {
        socket.emit('greska', { kod: 'SOBA_NE_POSTOJI', poruka: 'Soba s tim kodom ne postoji.' });
        return;
      }

      ponistiBrisanjeSobe(soba);

      const igracId = socket.data.igracId;

      if (soba.clanoviMap.has(igracId)) {
        sobaPoIgracu.set(igracId, kod);
        socket.join(SOBA_PREFIX(kod));
        emitirajStanje(soba);
        return;
      }

      if (soba.status !== 'cekanje') {
        socket.emit('greska', { kod: 'SOBA_U_TIJEKU', poruka: 'Igra u ovoj sobi je već u tijeku.' });
        return;
      }

      if (soba.clanoviMap.size >= 8) {
        socket.emit('greska', { kod: 'SOBA_PUNA', poruka: 'Soba je puna (maksimalno 8 igrača).' });
        return;
      }

      izadjiIzSobe(socket, true);

      soba.clanoviMap.set(igracId, {
        igracId,
        nadimak: socket.data.nadimak,
        avatarId: socket.data.avatarId,
        rang: null,
        odigrane: socket.data.odigrane ?? 0,
        pobjede: socket.data.pobjede ?? 0,
        bodoviUkupno: socket.data.bodoviUkupno ?? 0,
        odigrane1v1: socket.data.odigrane1v1 ?? 0,
        pobjede1v1: socket.data.pobjede1v1 ?? 0,
        bodovi1v1: socket.data.bodovi1v1 ?? 0,
      });
      sobaPoIgracu.set(igracId, kod);
      socket.join(SOBA_PREFIX(kod));

      emitirajStanje(soba);
    });

    socket.on('soba:izadji', () => {
      izadjiIzSobe(socket, true);
    });

    socket.on('soba:stanje', () => {
      const kod = sobaPoIgracu.get(socket.data.igracId);
      if (!kod) return;
      const soba = sobe.get(kod);
      if (soba) socket.emit('soba:stanje', izradiStanje(soba, socket.data.igracId));
    });

    socket.on('soba:pokreni', () => {
      const igracId = socket.data.igracId;
      const kod = sobaPoIgracu.get(igracId);
      if (!kod) return;

      const soba = sobe.get(kod);
      if (!soba || soba.vlasnikId !== igracId) {
        socket.emit('greska', { kod: 'NISI_VLASNIK', poruka: 'Samo vlasnik sobe može pokrenuti igru.' });
        return;
      }

      if (soba.clanoviMap.size < 2) {
        socket.emit('greska', { kod: 'NEDOVOLJNO_IGRACA', poruka: 'Za igru su potrebna najmanje 2 igrača.' });
        return;
      }

      if (soba.status !== 'cekanje') return;

      ponistiBrisanjeSobe(soba);
      soba.status = 'u_tijeku';

      const sudioniciUlaz: StavkaReda[] = [...soba.clanoviMap.values()].map((c) => ({
        igracId: c.igracId,
        nadimak: c.nadimak,
        avatarId: c.avatarId,
        odigrane: c.odigrane,
        pobjede: c.pobjede,
        bodoviUkupno: c.bodoviUkupno,
        usaoU: Date.now(),
      }));

      const partijaId = zapocniPrivatnuPartiju(sudioniciUlaz, soba.postavke, soba.kod);
      soba.partijaId = partijaId;

      emitirajStanje(soba);
    });

    socket.on('disconnect', () => {
      izadjiIzSobe(socket, false);
    });
  });

  return {
    registrirajRezultatPartije: (kodSobe: string, pobjednikId: string, rezultati: { igracId: string; bodovi: number }[]) => {
      const soba = sobe.get(kodSobe);
      if (!soba) return;

      const trenutnePobjede = (soba.pobjedeUSeriji.get(pobjednikId) ?? 0) + 1;
      soba.pobjedeUSeriji.set(pobjednikId, trenutnePobjede);

      for (const r of rezultati) {
        const StariBodovi = soba.bodoviUSeriji.get(r.igracId) ?? 0;
        soba.bodoviUSeriji.set(r.igracId, StariBodovi + r.bodovi);
      }
    },
    naPartijaZavrsila: (partijaId: string) => {
      for (const soba of sobe.values()) {
        if (soba.partijaId === partijaId) {
          soba.status = 'cekanje';
          soba.partijaId = null;
          emitirajStanje(soba);
          zakaziBrisanjeSobe(soba, 300_000);
          break;
        }
      }
    },
  };
}
