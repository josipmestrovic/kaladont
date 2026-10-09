/**
 * Zagrijavanje (ADR-017): dvoboj protiv privremenog „Računala”, bez javnog reda, fonda i upisa.
 * Igrač smije imati samo jedan aktivni kontekst igranja; ulazak u trening napušta javni red.
 */
import { randomUUID } from 'node:crypto';
import { AVATAR_RACUNALA, type KodGreske, type PotvrdaTreninga } from 'zajednicko';
import type { KaladontIo, KaladontSocket } from '../server.js';
import type { StavkaReda } from '../red/red-cekanja.js';
import type { RezultatPokretanja } from '../igra/politika-ucinka.js';
import { omotajSocketHandler, type ZapisSocketHandlerGreske } from '../sigurnost/socket-handler.js';
import type { ProvjeriOgranicenjeDogadaja } from '../sigurnost/socket-ogranicenja.js';

export const NADIMAK_RACUNALA = 'Računalo';
const PREFIKS_RACUNALA = 'racunalo-';

export function jeRacunalo(igracId: string): boolean {
  return igracId.startsWith(PREFIKS_RACUNALA);
}

export interface OpcijeServisaTreninga {
  omogucen: () => boolean;
  zapocniTrening: (sudionici: StavkaReda[]) => Promise<RezultatPokretanja>;
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
    socket.on('trening:zapocni', omotajSocketHandler(socket, 'trening:zapocni', opcije.zapisSocketHandlerGreske, (...argumenti: unknown[]) => {
      const [prvi, drugi, ...dodatni] = argumenti;
      const potvrda = typeof prvi === 'function' ? prvi as PotvrdaTreninga : typeof drugi === 'function' ? drugi as PotvrdaTreninga : undefined;
      const payload = typeof prvi === 'function' ? undefined : prvi;
      const neispravno = (payload !== undefined && payload !== null) || dodatni.length > 0 || (typeof prvi !== 'function' && drugi !== undefined && !potvrda);
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
      if (opcije.igracImaAktivnuPartiju(socket.data.igracId)) {
        odbij(socket, potvrda, 'VEC_U_PARTIJI', 'Već si u partiji. Završi je prije treninga.');
        return;
      }
      if (opcije.igracImaPrivatnuSobu(socket.data.igracId)) {
        odbij(socket, potvrda, 'VEC_U_SOBI', 'Napusti privatnu sobu prije treninga.');
        return;
      }
      opcije.ukloniIzJavnogReda(socket.data.igracId);

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
        iskustvoUkupno: socket.data.iskustvoUkupno ?? 0,
        trenutniNiz4p: 0,
        trenutniNiz1v1: 0,
        usaoU: Date.now(),
      };
      // Računalo nema redak u bazi ni javni profil; identitet vrijedi samo za ovu partiju.
      const racunalo: StavkaReda = {
        igracId: `${PREFIKS_RACUNALA}${randomUUID()}`,
        vrsta: 'gost',
        upravljac: 'bot',
        nadimak: NADIMAK_RACUNALA,
        avatarId: 0,
        avatarConfig: AVATAR_RACUNALA,
        avatarRevision: 0,
        odigrane: 0,
        pobjede: 0,
        bodoviUkupno: 0,
        iskustvoUkupno: 0,
        usaoU: Date.now(),
      };

      void opcije.zapocniTrening([covjek, racunalo]).then((rezultat) => {
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
