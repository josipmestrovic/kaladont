/**
 * Spaja RedCekanja na Socket.IO evente (red:udji, red:izadji, red:stanje).
 * RS-16: heartbeat/disconnect uklanja igrača iz reda u real-timeu.
 * RS-17: sastavljanje stola je atomarno (RedCekanja.pokusajSastaviStol).
 *
 * PR06: 9 UI izbora → 8 serverskih ključeva (kljucJavnogReda). Spojeni Dvoboj
 * Klasični+KA-ZNA dijeli jedan red; Troboj i Četveroboj imaju zaseban red po pravilniku.
 */
import type { KljucJavnogReda, ModPartije, PravilnikPartije, StanjeReda } from 'zajednicko';
import {
  izracunajRangIzAgregata,
  javnaSjedalaZaMod,
  kanonskaPravilaZaKljuc,
  KLJUCEVI_JAVNOG_REDA,
  kljucJavnogReda,
  MODOVI_PARTIJE,
  PRAVILNICI_PARTIJE,
  razinaVatre,
  stanjeIskustva,
  ZADANI_PRAVILNIK,
} from 'zajednicko';
import { z } from 'zod';
import type { KaladontIo } from '../server.js';
import { RedCekanja, prvihN, type StavkaReda } from './red-cekanja.js';
import { dohvatiProsjekCekanjaSek } from './prosjek-cekanja.js';
import type { ProvjeriOgranicenjeDogadaja } from '../sigurnost/socket-ogranicenja.js';
import { omotajSocketHandler, type ZapisSocketHandlerGreske } from '../sigurnost/socket-handler.js';
import type { RezultatPokretanja } from '../igra/politika-ucinka.js';
import { PRAGOVI_POPUNE_MS, PopunaReda } from './raspored-popune.js';
import type { FondBotova } from '../bot/fond.js';

const ShemaPayloadReda = z.object({
  mod: z.enum(MODOVI_PARTIJE).optional(),
  pravila: z.enum(PRAVILNICI_PARTIJE).optional(),
}).strict().optional();
const PORUKA_NEVALJANOG_PAYLOADA = 'Poslana poruka nije ispravna.';

function sobaZaKljuc(kljuc: KljucJavnogReda): string {
  return `red-cekanja-${kljuc}`;
}

function razrijesiUlazReda(payload: { mod?: string; pravila?: PravilnikPartije } | undefined):
  | { ok: true; mod: ModPartije; pravila: PravilnikPartije; kljuc: KljucJavnogReda }
  | { ok: false } {
  const mod: ModPartije =
    payload?.mod === 'dva_igraca' ? 'dva_igraca'
      : payload?.mod === 'tri_igraca' ? 'tri_igraca'
        : 'cetiri_igraca';
  const pravila = payload?.pravila ?? ZADANI_PRAVILNIK;
  return { ok: true, mod, pravila, kljuc: kljucJavnogReda(mod, pravila) };
}

export interface OpcijePopuneReda {
  fond: FondBotova;
  omogucena: (mod: ModPartije) => boolean;
  botJeZauzet: (igracId: string) => boolean;
  sada?: () => number;
  /** Samo za testove: kraći pragovi od produkcijskih. */
  pragoviMs?: Partial<Record<ModPartije, readonly number[]>>;
  odstupanjaMs?: Partial<Record<ModPartije, readonly number[]>>;
  dohvatiRaspored?: (mod: ModPartije) => { pragoviMs: readonly number[]; odstupanjaMs?: readonly number[] };
  dohvatiOdmaciNeuspjelogPokretanja?: () => readonly number[];
}

interface KanalReda {
  kljuc: KljucJavnogReda;
  mod: ModPartije;
  soba: string;
  red: RedCekanja;
  popuna: PopunaReda | null;
}

export function registrirajRedCekanja(
  io: KaladontIo,
  naStolSastavljen: (
    stol: StavkaReda[],
    mod: ModPartije,
    meta: { pravila: PravilnikPartije; spojeniDvoboj: boolean; kljuc: KljucJavnogReda },
  ) => Promise<RezultatPokretanja | void> | RezultatPokretanja | void,
  igracImaAktivnuPartiju: (igracId: string) => boolean,
  igracImaPrivatnuSobu: (igracId: string) => boolean,
  mozeStvoritiPartiju: () => boolean,
  razlogBlokadeIgre: (socket: import('../server.js').KaladontSocket) => Promise<{ kod: 'EMAIL_NIJE_POTVRDEN'; poruka: string } | null>,
  provjeriDogadaj: ProvjeriOgranicenjeDogadaja,
  zapisSocketHandlerGreske: ZapisSocketHandlerGreske,
  popunaOpcije?: OpcijePopuneReda,
): { ukloniIzReda: (igracId: string) => void; osvjeziPopunu: () => void; zaustaviPopunu: () => void } {
  /** Namjera: ključ reda + UI odabir. Identičan resend ≠ promjena pravilnika. */
  const namjere = new Map<string, { kljuc: KljucJavnogReda; mod: ModPartije; pravila: PravilnikPartije; generacija: number }>();
  let generacijaUlaska = 0;
  let zaustavljen = false;
  const ponavljanja = new Map<KljucJavnogReda, NodeJS.Timeout>();
  const greskePokretanja = new Map<KljucJavnogReda, number>();

  const kanali = new Map<KljucJavnogReda, KanalReda>();

  function stvoriPopunu(kanal: Omit<KanalReda, 'popuna'>): PopunaReda | null {
    if (!popunaOpcije) return null;
    const { mod, kljuc, red } = kanal;
    return new PopunaReda({
      red,
      fond: popunaOpcije.fond,
      velicinaStola: javnaSjedalaZaMod(mod),
      // Jedan bot ≠ dvije rezervacije: grupaId mora biti jedinstven po ključu reda.
      grupaId: `popuna-${kljuc}`,
      pragoviMs: popunaOpcije.pragoviMs?.[mod] ?? PRAGOVI_POPUNE_MS[mod],
      odstupanjaMs: popunaOpcije.odstupanjaMs?.[mod],
      dohvatiRaspored: popunaOpcije.dohvatiRaspored ? () => popunaOpcije.dohvatiRaspored!(mod) : undefined,
      omogucena: () => !zaustavljen && !ponavljanja.has(kljuc) && popunaOpcije.omogucena(mod) && mozeStvoritiPartiju(),
      pokreniStol: (stol) => pokreniStolSRezultatom(stol, kljuc),
      botJeZauzet: popunaOpcije.botJeZauzet,
      naPromjenu: () => posaljiStanje(kljuc),
      sada: popunaOpcije.sada,
    });
  }

  for (const kljuc of KLJUCEVI_JAVNOG_REDA) {
    const { mod } = kanonskaPravilaZaKljuc(kljuc);
    const bazaKanala = {
      kljuc,
      mod,
      soba: sobaZaKljuc(kljuc),
      red: new RedCekanja(prvihN(javnaSjedalaZaMod(mod))),
    };
    kanali.set(kljuc, { ...bazaKanala, popuna: stvoriPopunu(bazaKanala) });
  }

  function kanalZa(kljuc: KljucJavnogReda): KanalReda {
    return kanali.get(kljuc)!;
  }

  function leaveSvihSobaReda(socket: { leave: (soba: string) => void }): void {
    for (const kljuc of KLJUCEVI_JAVNOG_REDA) socket.leave(sobaZaKljuc(kljuc));
  }

  function izracunajStanje(mojIgracId: string, kljuc: KljucJavnogReda, pravila: PravilnikPartije = ZADANI_PRAVILNIK): StanjeReda {
    const kanal = kanalZa(kljuc);
    const { mod } = kanal;
    const maks = javnaSjedalaZaMod(mod);
    const stavke = [...kanal.red.stanje(), ...(kanal.popuna?.rezerviraniBotovi() ?? [])];
    const mjesta: StanjeReda['mjesta'] = Array.from({ length: maks }, () => null);

    stavke.slice(0, maks).forEach((stavka, indeks) => {
      const odigrane = mod === 'dva_igraca'
        ? (stavka.odigrane1v1 ?? 0)
        : mod === 'tri_igraca'
          ? (stavka.odigrane3p ?? 0)
          : stavka.odigrane;
      const pobjede = mod === 'dva_igraca'
        ? (stavka.pobjede1v1 ?? 0)
        : mod === 'tri_igraca'
          ? (stavka.pobjede3p ?? 0)
          : stavka.pobjede;
      const bodoviUkupno = mod === 'dva_igraca'
        ? (stavka.bodovi1v1 ?? 0)
        : mod === 'tri_igraca'
          ? (stavka.bodovi3p ?? 0)
          : stavka.bodoviUkupno;
      const trenutniNiz = mod === 'dva_igraca'
        ? (stavka.trenutniNiz1v1 ?? 0)
        : mod === 'tri_igraca'
          ? (stavka.trenutniNiz3p ?? 0)
          : (stavka.trenutniNiz4p ?? 0);

      const prosjekBodova = odigrane > 0 ? bodoviUkupno / odigrane : 0;
      // PR09: prikazni rang je univerzalan (ne ovisi o modu reda).
      const rang = izracunajRangIzAgregata(stavka.rangSumaJedinica ?? 0, stavka.rangBrojPartija ?? 0);

      const jeBot = stavka.upravljac === 'bot';
      mjesta[indeks] = {
        igracId: stavka.igracId,
        nadimak: stavka.nadimak,
        jeGost: !jeBot && stavka.vrsta === 'gost',
        jeBot,
        avatarId: stavka.avatarId,
        avatarConfig: stavka.avatarConfig,
        avatarRevision: stavka.avatarRevision,
        rang: jeBot || rang === 'Piskaralo' ? null : rang,
        razina: jeBot ? 0 : stanjeIskustva(stavka.iskustvoUkupno ?? 0).razina,
        odigrane: jeBot ? 0 : odigrane,
        prosjekBodova: jeBot ? 0 : prosjekBodova,
        postotakPobjeda: jeBot || odigrane <= 0 ? 0 : (pobjede / odigrane) * 100,
        trenutniNiz: jeBot ? 0 : trenutniNiz,
        razinaVatre: jeBot ? 0 : razinaVatre(trenutniNiz, mod),
        odabranaPravila: stavka.odabranaPravila ?? ZADANI_PRAVILNIK,
      };
    });
    return { mojIgracId, mod, pravila, mjesta, prosjekCekanjaSek: dohvatiProsjekCekanjaSek() };
  }

  function posaljiStanje(kljuc: KljucJavnogReda): void {
    const sobaSve = sobaZaKljuc(kljuc);
    const socketIdovi = io.sockets.adapter.rooms.get(sobaSve);
    if (!socketIdovi) return;
    for (const socketId of socketIdovi) {
      const socket = io.sockets.sockets.get(socketId);
      if (!socket) continue;
      const pravila = namjere.get(socket.data.igracId)?.pravila ?? ZADANI_PRAVILNIK;
      socket.emit('red:stanje', izracunajStanje(socket.data.igracId, kljuc, pravila));
    }
  }

  function posaljiStanjeSvih(): void {
    for (const kljuc of KLJUCEVI_JAVNOG_REDA) posaljiStanje(kljuc);
  }

  function osvjeziSvePopune(): void {
    for (const kanal of kanali.values()) kanal.popuna?.osvjezi();
  }

  /** Uklanja iz svih redova; vraća stari ključ radi osvježavanja popune. */
  function ukloniIzSvihRedova(igracId: string): KljucJavnogReda | undefined {
    const stari = namjere.get(igracId)?.kljuc;
    namjere.delete(igracId);
    for (const kanal of kanali.values()) kanal.red.izadji(igracId);
    return stari;
  }

  /** Nakon neuspjelog starta vraća samo ljude koji još čekaju isti ključ; zadržava izvorni usaoU. */
  function vratiURed(stol: readonly StavkaReda[], kljuc: KljucJavnogReda, generacije: ReadonlyMap<string, number>): void {
    const kanal = kanalZa(kljuc);
    for (const stavka of stol) {
      if (stavka.upravljac === 'bot') continue;
      const namjera = namjere.get(stavka.igracId);
      const socket = [...io.sockets.sockets.values()].find((veza) => veza.connected && veza.data.igracId === stavka.igracId);
      if (
        !zaustavljen
        && socket
        && namjera?.kljuc === kljuc
        && namjera.generacija === generacije.get(stavka.igracId)
        && !igracImaAktivnuPartiju(stavka.igracId)
        && !igracImaPrivatnuSobu(stavka.igracId)
      ) {
        socket.join(kanal.soba);
        kanal.red.udji(stavka);
      }
    }
  }

  function pokreniStolSRezultatom(stol: StavkaReda[], kljuc: KljucJavnogReda): Promise<RezultatPokretanja> {
    const kanal = kanalZa(kljuc);
    const meta = kanonskaPravilaZaKljuc(kljuc);
    const generacije = new Map(
      stol.filter((stavka) => stavka.upravljac !== 'bot').map((stavka) => [stavka.igracId, namjere.get(stavka.igracId)?.generacija ?? -1]),
    );
    const obradiNeuspjeh = () => {
      vratiURed(stol, kljuc, generacije);
      if (zaustavljen || ponavljanja.has(kljuc)) return;
      const broj = (greskePokretanja.get(kljuc) ?? 0) + 1;
      greskePokretanja.set(kljuc, broj);
      const odmaci = popunaOpcije?.dohvatiOdmaciNeuspjelogPokretanja?.() ?? [1_000, 2_000, 4_000, 5_000];
      const odmak = odmaci[Math.min(broj - 1, odmaci.length - 1)] ?? 5_000;
      const timer = setTimeout(() => {
        ponavljanja.delete(kljuc);
        if (zaustavljen) return;
        const noviStol = kanal.red.pokusajSastaviStol();
        if (noviStol) pokreniStol(noviStol, kljuc);
        else kanal.popuna?.osvjezi();
      }, odmak);
      timer.unref();
      ponavljanja.set(kljuc, timer);
    };
    return Promise.resolve()
      .then(() => naStolSastavljen(stol, meta.mod, { pravila: meta.pravila, spojeniDvoboj: meta.spojeniDvoboj, kljuc }))
      .then((rezultat) => {
        const konacni: RezultatPokretanja = rezultat ?? 'pokrenuta';
        if (konacni !== 'pokrenuta') obradiNeuspjeh();
        else {
          popunaOpcije?.fond.zapamtiProtivnike(stol);
          greskePokretanja.delete(kljuc);
          for (const [igracId, generacija] of generacije) {
            if (namjere.get(igracId)?.generacija === generacija) namjere.delete(igracId);
          }
        }
        return konacni;
      }, (greska: unknown) => {
        console.error('Neuspjelo pokretanje partije:', greska);
        obradiNeuspjeh();
        return 'greska' as const;
      })
      .finally(() => posaljiStanje(kljuc));
  }

  function pokreniStol(stol: StavkaReda[], kljuc: KljucJavnogReda): void {
    void pokreniStolSRezultatom(stol, kljuc).finally(() => kanalZa(kljuc).popuna?.osvjezi());
  }

  io.on('connection', (socket) => {
    socket.on('red:stanje', omotajSocketHandler(socket, 'red:stanje', zapisSocketHandlerGreske, (payload: unknown, ...dodatniArgumenti: unknown[]) => {
      const rezultat = ShemaPayloadReda.safeParse(payload);
      if (!rezultat.success || dodatniArgumenti.length > 0) {
        socket.emit('greska', { kod: 'NEVALJAN_PAYLOAD', poruka: PORUKA_NEVALJANOG_PAYLOADA });
        return;
      }
      if (!provjeriDogadaj(socket.data.igracId, 'red:stanje')) return;
      const ulaz = razrijesiUlazReda(rezultat.data);
      if (!ulaz.ok) {
        socket.emit('greska', { kod: 'NEVALJAN_PAYLOAD', poruka: PORUKA_NEVALJANOG_PAYLOADA });
        return;
      }
      socket.emit('red:stanje', izracunajStanje(socket.data.igracId, ulaz.kljuc, ulaz.pravila));
    }));

    socket.on('red:udji', omotajSocketHandler(socket, 'red:udji', zapisSocketHandlerGreske, async (...argumenti: unknown[]) => {
      const [payload, mogucaPotvrda, ...dodatniArgumenti] = argumenti;
      const rezultat = ShemaPayloadReda.safeParse(payload);
      const potvrda = typeof mogucaPotvrda === 'function'
        ? mogucaPotvrda as (stanje: StanjeReda | null) => void
        : undefined;
      if (!rezultat.success || dodatniArgumenti.length > 0 || (mogucaPotvrda !== undefined && !potvrda)) {
        socket.emit('greska', { kod: 'NEVALJAN_PAYLOAD', poruka: PORUKA_NEVALJANOG_PAYLOADA });
        return;
      }
      if (!provjeriDogadaj(socket.data.igracId, 'red:udji')) {
        potvrda?.(null);
        return;
      }
      const blokada = await razlogBlokadeIgre(socket);
      if (blokada) {
        socket.emit('greska', blokada);
        potvrda?.(null);
        return;
      }
      const ulaz = razrijesiUlazReda(rezultat.data);
      if (!ulaz.ok) {
        socket.emit('greska', { kod: 'NEVALJAN_PAYLOAD', poruka: PORUKA_NEVALJANOG_PAYLOADA });
        potvrda?.(null);
        return;
      }
      const { mod, pravila, kljuc } = ulaz;
      const kanal = kanalZa(kljuc);

      if (igracImaAktivnuPartiju(socket.data.igracId)) {
        potvrda?.(null);
        return;
      }

      if (igracImaPrivatnuSobu(socket.data.igracId)) {
        potvrda?.(null);
        return;
      }

      if (!mozeStvoritiPartiju()) {
        potvrda?.(null);
        return;
      }

      // Identičan zahtjev (isti ključ + ista odabranaPravila) = no-op; zadrži usaoU.
      // Promjena pravilnika (čak i unutar 2-zajednicki) uklanja članstvo i rezervaciju.
      const postojeca = namjere.get(socket.data.igracId);
      if (
        postojeca?.kljuc === kljuc
        && postojeca.pravila === pravila
        && kanal.red.stanje().some((s) => s.igracId === socket.data.igracId)
      ) {
        leaveSvihSobaReda(socket);
        socket.join(kanal.soba);
        potvrda?.(izracunajStanje(socket.data.igracId, kljuc, pravila));
        return;
      }

      const stariKljuc = ukloniIzSvihRedova(socket.data.igracId);
      leaveSvihSobaReda(socket);
      socket.join(kanal.soba);
      namjere.set(socket.data.igracId, { kljuc, mod, pravila, generacija: ++generacijaUlaska });

      kanal.red.udji({
        igracId: socket.data.igracId,
        vrsta: socket.data.vrsta,
        nadimak: socket.data.nadimak,
        avatarId: socket.data.avatarId,
        avatarConfig: socket.data.avatarConfig,
        avatarRevision: socket.data.avatarRevision,
        odigrane: socket.data.odigrane ?? 0,
        pobjede: socket.data.pobjede ?? 0,
        bodoviUkupno: socket.data.bodoviUkupno ?? 0,
        odigrane1v1: socket.data.odigrane1v1 ?? 0,
        pobjede1v1: socket.data.pobjede1v1 ?? 0,
        bodovi1v1: socket.data.bodovi1v1 ?? 0,
        odigrane3p: socket.data.odigrane3p ?? 0,
        pobjede3p: socket.data.pobjede3p ?? 0,
        bodovi3p: socket.data.bodovi3p ?? 0,
        rangBrojPartija: socket.data.rangBrojPartija ?? 0,
        rangSumaJedinica: socket.data.rangSumaJedinica ?? 0,
        iskustvoUkupno: socket.data.iskustvoUkupno ?? 0,
        trenutniNiz4p: socket.data.trenutniNiz4p ?? 0,
        trenutniNiz1v1: socket.data.trenutniNiz1v1 ?? 0,
        trenutniNiz3p: socket.data.trenutniNiz3p ?? 0,
        usaoU: Date.now(),
        odabranaPravila: pravila,
      });
      potvrda?.(izracunajStanje(socket.data.igracId, kljuc, pravila));
      if (stariKljuc && stariKljuc !== kljuc) {
        kanalZa(stariKljuc).popuna?.osvjezi();
        posaljiStanje(stariKljuc);
      }
      posaljiStanje(kljuc);

      const stol = ponavljanja.has(kljuc) ? null : kanal.red.pokusajSastaviStol();
      if (stol) pokreniStol(stol, kljuc);
      else kanal.popuna?.osvjezi();
    }));

    socket.on('red:izadji', omotajSocketHandler(socket, 'red:izadji', zapisSocketHandlerGreske, (...argumenti: unknown[]) => {
      if (argumenti.length > 0) {
        socket.emit('greska', { kod: 'NEVALJAN_PAYLOAD', poruka: PORUKA_NEVALJANOG_PAYLOADA });
        return;
      }
      if (!provjeriDogadaj(socket.data.igracId, 'red:izadji')) return;
      const stariKljuc = ukloniIzSvihRedova(socket.data.igracId);
      leaveSvihSobaReda(socket);
      osvjeziSvePopune();
      if (stariKljuc) posaljiStanje(stariKljuc);
      else posaljiStanjeSvih();
    }));

    socket.on('disconnect', omotajSocketHandler(socket, 'disconnect', zapisSocketHandlerGreske, () => {
      const stariKljuc = ukloniIzSvihRedova(socket.data.igracId);
      osvjeziSvePopune();
      if (stariKljuc) posaljiStanje(stariKljuc);
      else posaljiStanjeSvih();
    }));
  });

  return {
    ukloniIzReda: (igracId: string) => {
      const stariKljuc = ukloniIzSvihRedova(igracId);
      osvjeziSvePopune();
      for (const socket of io.sockets.sockets.values()) {
        if (socket.data.igracId === igracId) leaveSvihSobaReda(socket);
      }
      if (stariKljuc) posaljiStanje(stariKljuc);
      else posaljiStanjeSvih();
    },
    osvjeziPopunu: () => {
      osvjeziSvePopune();
    },
    zaustaviPopunu: () => {
      zaustavljen = true;
      for (const timer of ponavljanja.values()) clearTimeout(timer);
      ponavljanja.clear();
      namjere.clear();
      greskePokretanja.clear();
      for (const kanal of kanali.values()) kanal.popuna?.zaustavi();
    },
  };
}
