/**
 * Upravljanje privatnim sobama za igru (2-8 igrača, prilagođena pravila i ljestvica sobe).
 */
import {
  SVE_VRSTE_RIJECI,
  izracunajRang,
  stanjeIskustva,
  vratiVeciRang,
  type PostavkePrivatneSobe,
  type StanjePrivatneSobe,
  type AvatarConfigV1,
} from 'zajednicko';
import type { KaladontIo, KaladontSocket } from '../server.js';
import type { StavkaReda } from '../red/red-cekanja.js';
import { z } from 'zod';
import type { ProvjeriOgranicenjeDogadaja } from '../sigurnost/socket-ogranicenja.js';

const ShemaVrstaRijeci = z.enum([
  'imenica',
  'glagol',
  'pridjev',
  'prilog',
  'zamjenica',
  'broj',
  'prijedlog',
  'veznik',
  'cestica',
  'uzvik',
  'vlastito_ime',
]);

const ShemaPostavkePrivatneSobe = z
  .object({
    trajanjePotezaSek: z.union([z.literal(0), z.literal(15), z.literal(30), z.literal(60)]).optional(),
    dopusteneVrste: z.array(ShemaVrstaRijeci).max(11).optional(),
    eliminacijskiBodovi: z.boolean().optional(),
  })
  .strict();

const ShemaStvoriSobu = z
  .object({ postavke: ShemaPostavkePrivatneSobe.optional() })
  .strict()
  .optional();

const ShemaKodSobe = z
  .object({ kod: z.string().trim().regex(/^[A-Z0-9]{6}$/i) })
  .strict();

const PORUKA_NEVALJANOG_PAYLOADA = 'Poslane postavke nisu ispravne.';

const ALFABET_KODA = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function generirajKodSobe(): string {
  let rez = '';
  for (let i = 0; i < 6; i += 1) {
    rez += ALFABET_KODA[Math.floor(Math.random() * ALFABET_KODA.length)];
  }
  return rez;
}

const SOBA_PREFIX = (kod: string) => `soba:${kod.toUpperCase()}`;
const TRAJANJE_NEAKTIVNE_SOBE_MS = 15 * 60_000;

export interface Soba {
  kod: string;
  vlasnikId: string;
  postavke: PostavkePrivatneSobe;
  clanoviMap: Map<
    string,
    {
      igracId: string;
      vrsta: 'gost' | 'registriran' | 'admin';
      nadimak: string;
      avatarId: number;
      avatarConfig: AvatarConfigV1 | null;
      avatarRevision: number;
      rang: string | null;
      odigrane: number;
      pobjede: number;
      bodoviUkupno: number;
      odigrane1v1?: number;
      pobjede1v1?: number;
      bodovi1v1?: number;
      iskustvoUkupno?: number;
    }
  >;
  partijaId: string | null;
  status: 'cekanje' | 'u_tijeku' | 'zavrsena';
  brisanjeTimer: NodeJS.Timeout | null;
  pobjedeUSeriji: Map<string, number>;
  bodoviUSeriji: Map<string, number>;
  obradenePartije: Set<string>;
}

export function dodijeliRezultatSobeAkoNijeObraden(
  soba: Pick<Soba, 'obradenePartije' | 'pobjedeUSeriji' | 'bodoviUSeriji'>,
  partijaId: string,
  pobjednikId: string,
  rezultati: { igracId: string; bodovi: number }[],
): void {
  if (soba.obradenePartije.has(partijaId)) return;
  soba.obradenePartije.add(partijaId);

  const trenutnePobjede = (soba.pobjedeUSeriji.get(pobjednikId) ?? 0) + 1;
  soba.pobjedeUSeriji.set(pobjednikId, trenutnePobjede);

  for (const rezultat of rezultati) {
    const stariBodovi = soba.bodoviUSeriji.get(rezultat.igracId) ?? 0;
    soba.bodoviUSeriji.set(rezultat.igracId, stariBodovi + rezultat.bodovi);
  }
}

function normalizirajPostavke(p?: Partial<PostavkePrivatneSobe>): PostavkePrivatneSobe {
  const trajanjePotezaSek =
    p?.trajanjePotezaSek === 0 || p?.trajanjePotezaSek === 15 || p?.trajanjePotezaSek === 60
      ? p.trajanjePotezaSek
      : 30;

  const dopusteniSkup = new Set(p?.dopusteneVrste ?? []);
  const filtrirane = SVE_VRSTE_RIJECI.filter((v) => dopusteniSkup.has(v));
  const dopusteneVrste = filtrirane.length > 0
    ? SVE_VRSTE_RIJECI.filter((vrsta) => vrsta === 'imenica' || dopusteniSkup.has(vrsta))
    : [...SVE_VRSTE_RIJECI];

  return {
    trajanjePotezaSek,
    dopusteneVrste,
    eliminacijskiBodovi: Boolean(p?.eliminacijskiBodovi),
  };
}

export function registrirajPrivatneSobe(
  io: KaladontIo,
  zapocniPrivatnuPartiju: (
    sudionici: StavkaReda[],
    postavke: PostavkePrivatneSobe,
    kodSobe: string,
  ) => string,
  opcije: {
    maksimalnoSoba: number;
    maksimalnoAktivnihPartija: number;
    brojAktivnihPartija: () => number;
    mozeStvoritiPartiju: () => boolean;
    provjeriDogadaj: ProvjeriOgranicenjeDogadaja;
    igracImaAktivnuPartiju: (igracId: string) => boolean;
    igracMozeIgrati: (socket: KaladontSocket) => boolean;
    ukloniIzJavnogReda: (igracId: string) => void;
  },
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

  function zatvoriSobuZbogVlasnika(soba: Soba): void {
    ponistiBrisanjeSobe(soba);
    const sobaSocketi = io.sockets.adapter.rooms.get(SOBA_PREFIX(soba.kod));
    if (sobaSocketi) {
      for (const socketId of sobaSocketi) {
        const socket = io.sockets.sockets.get(socketId);
        socket?.emit('soba:vlasnik-napustio', { kod: soba.kod });
        socket?.leave(SOBA_PREFIX(soba.kod));
      }
    }
    for (const igracId of soba.clanoviMap.keys()) {
      if (sobaPoIgracu.get(igracId) === soba.kod) sobaPoIgracu.delete(igracId);
    }
    sobe.delete(soba.kod);
  }

  function izradiStanje(soba: Soba, mojIgracId: string): StanjePrivatneSobe {
    const clanovi = [...soba.clanoviMap.values()].map((c) => {
      const odig4 = c.odigrane ?? 0;
      const bod4 = c.bodoviUkupno ?? 0;
      const prosjek4 = odig4 > 0 ? bod4 / odig4 : 0;
      const rang4 = izracunajRang(odig4, prosjek4, 'cetiri_igraca');

      const odig1 = c.odigrane1v1 ?? 0;
      const bod1 = c.bodovi1v1 ?? 0;
      const prosjek1 = odig1 > 0 ? bod1 / odig1 : 0;
      const rang1 = izracunajRang(odig1, prosjek1, 'dva_igraca');

      const veciRang = vratiVeciRang(rang4, rang1);

      return {
        igracId: c.igracId,
        nadimak: c.nadimak,
        avatarId: c.avatarId,
        avatarConfig: c.avatarConfig,
        avatarRevision: c.avatarRevision,
        rang: veciRang === 'Piskaralo' ? null : veciRang,
        razina: stanjeIskustva(c.iskustvoUkupno ?? 0).razina,
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

  function izadjiIzSobe(socket: KaladontSocket) {
    const igracId = socket.data.igracId;
    const kod = sobaPoIgracu.get(igracId);
    if (!kod) return;

    const soba = sobe.get(kod);
    if (!soba) {
      sobaPoIgracu.delete(igracId);
      return;
    }

    if (soba.vlasnikId === igracId && soba.status !== 'u_tijeku') {
      zatvoriSobuZbogVlasnika(soba);
      return;
    }

    socket.leave(SOBA_PREFIX(kod));

    if (soba.status !== 'u_tijeku') {
      soba.clanoviMap.delete(igracId);
      sobaPoIgracu.delete(igracId);
    }

    if (soba.clanoviMap.size === 0) {
      zakaziBrisanjeSobe(soba, TRAJANJE_NEAKTIVNE_SOBE_MS);
    } else {
      if (soba.status === 'cekanje') zakaziBrisanjeSobe(soba, TRAJANJE_NEAKTIVNE_SOBE_MS);
      emitirajStanje(soba);
    }
  }

  io.on('connection', (socket) => {
    socket.on('soba:stvori', (payload) => {
      if (!opcije.provjeriDogadaj(socket.data.igracId, 'soba:stvori')) return;
      if (!opcije.igracMozeIgrati(socket)) {
        socket.emit('greska', { kod: 'EMAIL_NIJE_POTVRDEN', poruka: 'Potvrdi email adresu prije ulaska u partiju.' });
        return;
      }
      if (!opcije.mozeStvoritiPartiju()) {
        socket.emit('greska', { kod: 'INTERNA', poruka: 'Poslužitelj se upravo gasi. Pokušaj ponovno malo kasnije.' });
        return;
      }
      if (opcije.igracImaAktivnuPartiju(socket.data.igracId)) {
        socket.emit('greska', { kod: 'VEC_U_PARTIJI', poruka: 'Ne možeš stvoriti sobu dok je partija aktivna.' });
        return;
      }
      if (sobaPoIgracu.has(socket.data.igracId)) {
        socket.emit('greska', { kod: 'VEC_U_SOBI', poruka: 'Već si u privatnoj sobi.' });
        return;
      }
      if (sobe.size >= opcije.maksimalnoSoba) {
        socket.emit('greska', { kod: 'PREVISE_SOBA', poruka: 'Privremeno je dosegnut najveći broj privatnih soba.' });
        return;
      }
      const rezultat = ShemaStvoriSobu.safeParse(payload);
      if (!rezultat.success) {
        socket.emit('greska', { kod: 'NEVALJAN_PAYLOAD', poruka: PORUKA_NEVALJANOG_PAYLOADA });
        return;
      }

      izadjiIzSobe(socket);

      const postavke = normalizirajPostavke(rezultat.data?.postavke);
      opcije.ukloniIzJavnogReda(socket.data.igracId);
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
              vrsta: socket.data.vrsta,
              nadimak: socket.data.nadimak,
              avatarId: socket.data.avatarId,
              avatarConfig: socket.data.avatarConfig,
              avatarRevision: socket.data.avatarRevision,
              rang: null,
              odigrane: socket.data.odigrane ?? 0,
              pobjede: socket.data.pobjede ?? 0,
              bodoviUkupno: socket.data.bodoviUkupno ?? 0,
              odigrane1v1: socket.data.odigrane1v1 ?? 0,
              pobjede1v1: socket.data.pobjede1v1 ?? 0,
              bodovi1v1: socket.data.bodovi1v1 ?? 0,
              iskustvoUkupno: socket.data.iskustvoUkupno ?? 0,
            },
          ],
        ]),
        partijaId: null,
        status: 'cekanje',
        brisanjeTimer: null,
        pobjedeUSeriji: new Map(),
        bodoviUSeriji: new Map(),
        obradenePartije: new Set(),
      };

      sobe.set(kod, soba);
      sobaPoIgracu.set(igracId, kod);
      socket.join(SOBA_PREFIX(kod));
      zakaziBrisanjeSobe(soba, TRAJANJE_NEAKTIVNE_SOBE_MS);

      socket.emit('soba:stvorena', { kod });
      emitirajStanje(soba);
    });

    socket.on('soba:udji', (payload) => {
      if (!opcije.provjeriDogadaj(socket.data.igracId, 'soba:udji')) return;
      if (!opcije.igracMozeIgrati(socket)) {
        socket.emit('greska', { kod: 'EMAIL_NIJE_POTVRDEN', poruka: 'Potvrdi email adresu prije ulaska u partiju.' });
        return;
      }
      const rezultat = ShemaKodSobe.safeParse(payload);
      if (!rezultat.success) {
        socket.emit('greska', { kod: 'NEVALJAN_PAYLOAD', poruka: 'Kod sobe nije ispravan.' });
        return;
      }
      const kod = rezultat.data.kod.toUpperCase();

      if (opcije.igracImaAktivnuPartiju(socket.data.igracId)) {
        socket.emit('greska', { kod: 'VEC_U_PARTIJI', poruka: 'Ne možeš ući u sobu dok je partija aktivna.' });
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

      izadjiIzSobe(socket);
      opcije.ukloniIzJavnogReda(socket.data.igracId);

      soba.clanoviMap.set(igracId, {
        igracId,
        vrsta: socket.data.vrsta,
        nadimak: socket.data.nadimak,
        avatarId: socket.data.avatarId,
        avatarConfig: socket.data.avatarConfig,
        avatarRevision: socket.data.avatarRevision,
        rang: null,
        odigrane: socket.data.odigrane ?? 0,
        pobjede: socket.data.pobjede ?? 0,
        bodoviUkupno: socket.data.bodoviUkupno ?? 0,
        odigrane1v1: socket.data.odigrane1v1 ?? 0,
        pobjede1v1: socket.data.pobjede1v1 ?? 0,
        bodovi1v1: socket.data.bodovi1v1 ?? 0,
        iskustvoUkupno: socket.data.iskustvoUkupno ?? 0,
      });
      sobaPoIgracu.set(igracId, kod);
      socket.join(SOBA_PREFIX(kod));
      zakaziBrisanjeSobe(soba, TRAJANJE_NEAKTIVNE_SOBE_MS);

      emitirajStanje(soba);
    });

    socket.on('soba:izadji', () => {
      if (!opcije.provjeriDogadaj(socket.data.igracId, 'soba:izadji')) return;
      izadjiIzSobe(socket);
    });

    socket.on('soba:stanje', () => {
      if (!opcije.provjeriDogadaj(socket.data.igracId, 'soba:stanje')) return;
      const kod = sobaPoIgracu.get(socket.data.igracId);
      if (!kod) return;
      const soba = sobe.get(kod);
      if (soba) {
        if (soba.status === 'cekanje') zakaziBrisanjeSobe(soba, TRAJANJE_NEAKTIVNE_SOBE_MS);
        socket.emit('soba:stanje', izradiStanje(soba, socket.data.igracId));
      }
    });

    socket.on('soba:pokreni', () => {
      if (!opcije.provjeriDogadaj(socket.data.igracId, 'soba:pokreni')) return;
      if (!opcije.igracMozeIgrati(socket)) {
        socket.emit('greska', { kod: 'EMAIL_NIJE_POTVRDEN', poruka: 'Potvrdi email adresu prije ulaska u partiju.' });
        return;
      }
      if (!opcije.mozeStvoritiPartiju()) {
        socket.emit('greska', { kod: 'INTERNA', poruka: 'Poslužitelj se upravo gasi. Pokušaj ponovno malo kasnije.' });
        return;
      }
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

      if (opcije.brojAktivnihPartija() >= opcije.maksimalnoAktivnihPartija) {
        socket.emit('greska', { kod: 'PREVISE_PARTIJA', poruka: 'Privremeno je dosegnut najveći broj aktivnih partija.' });
        return;
      }

      ponistiBrisanjeSobe(soba);
      soba.status = 'u_tijeku';

      const sudioniciUlaz: StavkaReda[] = [...soba.clanoviMap.values()].map((c) => ({
        igracId: c.igracId,
        vrsta: c.vrsta,
        nadimak: c.nadimak,
        avatarId: c.avatarId,
        avatarConfig: c.avatarConfig,
        avatarRevision: c.avatarRevision,
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
      izadjiIzSobe(socket);
    });
  });

  return {
    imaPrivatnuSobu: (igracId: string) => sobaPoIgracu.has(igracId),
    registrirajRezultatPartije: (kodSobe: string, partijaId: string, pobjednikId: string, rezultati: { igracId: string; bodovi: number }[]) => {
      const soba = sobe.get(kodSobe);
      if (!soba) return;
      dodijeliRezultatSobeAkoNijeObraden(soba, partijaId, pobjednikId, rezultati);
    },
    naPartijaZavrsila: (partijaId: string) => {
      for (const soba of sobe.values()) {
        if (soba.partijaId === partijaId) {
          soba.status = 'cekanje';
          soba.partijaId = null;
          emitirajStanje(soba);
          zakaziBrisanjeSobe(soba, TRAJANJE_NEAKTIVNE_SOBE_MS);
          break;
        }
      }
    },
  };
}
