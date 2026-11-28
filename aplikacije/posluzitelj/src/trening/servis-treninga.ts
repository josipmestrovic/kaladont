/**
 * Zagrijavanje (ADR-017 / ADR-019 / PR08 / PR02): trening protiv privremenih botova po profilu težine.
 * Pravilnik je uvijek Klasični (stari ka_zna/dokazi_nastavak se normaliziraju).
 * UI bira 1–3 botova i profil; stari klijent bez profileId dobiva Iskusni, bez brojRacunala → 1.
 * Igrač smije imati samo jedan aktivni kontekst igranja; ulazak u trening napušta javni red.
 */
import { randomUUID } from 'node:crypto';
import {
  AVATAR_RACUNALA,
  AVATAR_RACUNALA_2,
  jePoznatiProfilBota,
  PRAVILNICI_PARTIJE,
  PROFILI_BOTA_IZAZOVA,
  ZADANI_PROFIL_TRENINGA,
  type AvatarConfigV1,
  type KodGreske,
  type PotvrdaTreninga,
  type PravilnikPartije,
  type ProfilBotaIzazova,
} from 'zajednicko';
import { z } from 'zod';
import type { KonfiguracijaBota } from '../bot/konfiguracija-bota.js';
import {
  nadimakProfilaBota,
  razrijesiProfilBotaIliZadani,
  snimkaBotAnalitikeIzRazrijesenog,
  type SnimkaBotAnalitike,
} from '../bot/profili-bota.js';
import type { KaladontIo, KaladontSocket } from '../server.js';
import type { StavkaReda } from '../red/red-cekanja.js';
import type { RezultatPokretanja } from '../igra/politika-ucinka.js';
import { omotajSocketHandler, type ZapisSocketHandlerGreske } from '../sigurnost/socket-handler.js';
import type { ProvjeriOgranicenjeDogadaja } from '../sigurnost/socket-ogranicenja.js';

const PREFIKS_RACUNALA = 'racunalo-';
const PRAVILNIK_TRENINGA: PravilnikPartije = 'klasicni';
const ZADANI_BROJ_RACUNALA_TRENINGA: 1 | 2 | 3 = 1;

/** @deprecated Koristi nadimakProfilaBota; zadržano radi starih importa u testovima. */
export const NADIMAK_RACUNALA = 'Računalo';

/**
 * @deprecated ADR-019: broj botova više ne ovisi o pravilniku; izostanak = 1.
 * Zadržano radi starih importa; uvijek vraća 1.
 */
export function brojRacunalaZaTrening(pravila: PravilnikPartije): 1 | 2 {
  void pravila;
  return 1;
}

const ShemaTreningZapocni = z.object({
  pravila: z.enum(PRAVILNICI_PARTIJE).optional(),
  brojRacunala: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  profileId: z.enum(PROFILI_BOTA_IZAZOVA).optional(),
}).strict().optional();

export function jeRacunalo(igracId: string): boolean {
  return igracId.startsWith(PREFIKS_RACUNALA);
}

function izradiRacunalo(
  indeks: number,
  ukupno: 1 | 2 | 3,
  pravila: PravilnikPartije,
  profileId: ProfilBotaIzazova,
): StavkaReda {
  const nadimak = nadimakProfilaBota(profileId, indeks, ukupno);
  const avatarConfig: AvatarConfigV1 = indeks === 2 ? AVATAR_RACUNALA_2 : AVATAR_RACUNALA;
  return {
    igracId: `${PREFIKS_RACUNALA}${randomUUID()}`,
    vrsta: 'gost',
    upravljac: 'bot',
    nadimak,
    avatarId: 0,
    avatarConfig,
    avatarRevision: 0,
    odigrane: 0,
    pobjede: 0,
    bodoviUkupno: 0,
    iskustvoUkupno: 0,
    usaoU: Date.now(),
    odabranaPravila: pravila,
  };
}

export interface OpcijeServisaTreninga {
  omogucen: () => boolean;
  zapocniTrening: (
    sudionici: StavkaReda[],
    pravila: PravilnikPartije,
    botKonfiguracija: KonfiguracijaBota,
    botAnalitika: SnimkaBotAnalitike,
  ) => Promise<RezultatPokretanja>;
  igracImaAktivnuPartiju: (igracId: string) => boolean;
  igracImaPrivatnuSobu: (igracId: string) => boolean;
  ukloniIzJavnogReda: (igracId: string) => void;
  provjeriDogadaj: ProvjeriOgranicenjeDogadaja;
  zapisSocketHandlerGreske: ZapisSocketHandlerGreske;
}

export interface BrojaciTreninga {
  zapoceti: number;
  odbijeni: number;
  neuspjeli: number;
}

export function registrirajTrening(io: KaladontIo, opcije: OpcijeServisaTreninga): { brojaci: BrojaciTreninga } {
  const brojaci: BrojaciTreninga = { zapoceti: 0, odbijeni: 0, neuspjeli: 0 };

  function odbij(socket: KaladontSocket, potvrda: PotvrdaTreninga | undefined, kod: KodGreske, poruka: string): void {
    brojaci.odbijeni += 1;
    socket.emit('greska', { kod, poruka });
    potvrda?.({ pokrenut: false, kod, poruka });
  }

  io.on('connection', (socket) => {
    socket.on('trening:zapocni', omotajSocketHandler(socket, 'trening:zapocni', opcije.zapisSocketHandlerGreske, async (...argumenti: unknown[]) => {
      const [prvi, drugi, ...dodatni] = argumenti;
      const potvrda = typeof prvi === 'function' ? prvi as PotvrdaTreninga : typeof drugi === 'function' ? drugi as PotvrdaTreninga : undefined;
      const payload = typeof prvi === 'function' ? undefined : prvi;
      const parse = ShemaTreningZapocni.safeParse(payload);
      const neispravno = !parse.success || dodatni.length > 0 || (typeof prvi !== 'function' && drugi !== undefined && !potvrda);
      if (neispravno) {
        socket.emit('greska', { kod: 'NEVALJAN_PAYLOAD', poruka: 'Poslana poruka nije ispravna.' });
        return;
      }
      if (!opcije.provjeriDogadaj(socket.data.igracId, 'trening:zapocni')) {
        potvrda?.({ pokrenut: false, kod: 'PREBRZO', poruka: 'Previše zahtjeva. Pričekaj trenutak.' });
        return;
      }
      if (!opcije.omogucen()) {
        odbij(socket, potvrda, 'TRENING_NEDOSTUPAN', 'Zagrijavanje trenutačno nije dostupno.');
        return;
      }
      // Zagrijavanje ostaje otvoreno i bez potvrđenog emaila (ADR-017 / protokol §6).
      if (opcije.igracImaAktivnuPartiju(socket.data.igracId)) {
        odbij(socket, potvrda, 'VEC_U_PARTIJI', 'Već si u igri. Završi je prije treninga.');
        return;
      }
      if (opcije.igracImaPrivatnuSobu(socket.data.igracId)) {
        odbij(socket, potvrda, 'VEC_U_SOBI', 'Napusti privatnu sobu prije treninga.');
        return;
      }
      opcije.ukloniIzJavnogReda(socket.data.igracId);

      // ADR-019: Trening je isključivo Klasični; stari ka_zna/dokazi_nastavak se normaliziraju.
      const brojRacunala = parse.data?.brojRacunala ?? ZADANI_BROJ_RACUNALA_TRENINGA;
      const pravila = PRAVILNIK_TRENINGA;
      const profileId: ProfilBotaIzazova = jePoznatiProfilBota(parse.data?.profileId)
        ? parse.data!.profileId!
        : ZADANI_PROFIL_TRENINGA;
      const botRazrijeseno = razrijesiProfilBotaIliZadani(profileId);
      const botKonfiguracija = botRazrijeseno.konfiguracija;
      const botAnalitika = snimkaBotAnalitikeIzRazrijesenog(botRazrijeseno);

      const covjek: StavkaReda = {
        igracId: socket.data.igracId,
        vrsta: socket.data.vrsta,
        upravljac: 'covjek',
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
        rangBrojPartija: socket.data.rangBrojPartija ?? 0,
        rangSumaJedinica: socket.data.rangSumaJedinica ?? 0,
        iskustvoUkupno: socket.data.iskustvoUkupno ?? 0,
        trenutniNiz4p: 0,
        trenutniNiz1v1: 0,
        usaoU: Date.now(),
        odabranaPravila: pravila,
      };
      // Privremeni botovi nemaju redak u bazi ni javni profil; ne zauzimaju fond.
      const racunala: StavkaReda[] = [];
      for (let i = 1; i <= brojRacunala; i += 1) {
        racunala.push(izradiRacunalo(i, brojRacunala, pravila, profileId));
      }

      void opcije.zapocniTrening([covjek, ...racunala], pravila, botKonfiguracija, botAnalitika).then((rezultat) => {
        if (rezultat === 'pokrenuta') {
          brojaci.zapoceti += 1;
          potvrda?.({ pokrenut: true });
          return;
        }
        brojaci.neuspjeli += 1;
        const kod: KodGreske = rezultat === 'limit' ? 'PREVISE_PARTIJA' : rezultat === 'zaustavljanje' ? 'TRENING_NEDOSTUPAN' : 'INTERNA';
        const poruka = rezultat === 'limit'
          ? 'Poslužitelj je trenutačno zauzet. Pokušaj ponovno za koji trenutak.'
          : 'Trening nije moguće pokrenuti. Pokušaj ponovno.';
        socket.emit('greska', { kod, poruka });
        potvrda?.({ pokrenut: false, kod, poruka });
      }).catch((greska: unknown) => {
        brojaci.neuspjeli += 1;
        console.error('Neuspjelo pokretanje treninga:', greska);
        potvrda?.({ pokrenut: false, kod: 'INTERNA', poruka: 'Trening nije moguće pokrenuti. Pokušaj ponovno.' });
      });
    }));
  });

  return { brojaci };
}
