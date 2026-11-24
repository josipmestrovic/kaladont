/** Dijeljeni dohvat GET /profil s deduplikacijom i zaštitom od kasnih odgovora. */
import type { AvatarConfigV1 } from 'zajednicko';

export type ProfilIskustvo = {
  razina: number;
  ukupno: number;
  uRazini: number;
  doIduce: number | null;
};

export type ProfilSnapshot = {
  nadimak: string;
  avatarId: number;
  rang: string | null;
  rang1v1: string | null;
  email: string | null;
  vrsta: 'gost' | 'registriran' | 'admin';
  avatarConfig: AvatarConfigV1 | null;
  iskustvo?: ProfilIskustvo;
};

export type StatusProfila = 'prazno' | 'ucitavanje' | 'spreman' | 'greska';

export type ProfilApi = (putanja: string, opcije?: RequestInit) => Promise<ProfilSnapshot>;

export type ProfilResursOvisnosti = {
  api: ProfilApi;
  oporavi401: () => Promise<void>;
  jeApiGreska401: (greska: unknown) => boolean;
};

export function stvoriProfilResurs(ovisnosti: ProfilResursOvisnosti) {
  let snapshot: ProfilSnapshot | null = null;
  let status: StatusProfila = 'prazno';
  let generacija = 0;
  let inFlight: Promise<void> | null = null;
  const pretplatnici = new Set<() => void>();

  function objavi() {
    for (const cb of pretplatnici) cb();
  }

  function postavi(novi: ProfilSnapshot | null, noviStatus: StatusProfila) {
    snapshot = novi;
    status = noviStatus;
    objavi();
  }

  async function dohvati(mojaGeneracija: number, pokusaji: number): Promise<void> {
    if (!snapshot) {
      status = 'ucitavanje';
      objavi();
    }

    let oporavakOdrađen = false;
    let pokusaj = 0;
    while (pokusaj < pokusaji) {
      if (mojaGeneracija !== generacija) return;
      try {
        const odgovor = await ovisnosti.api('/profil');
        if (mojaGeneracija !== generacija) return;
        postavi(odgovor, 'spreman');
        return;
      } catch (greska) {
        if (mojaGeneracija !== generacija) return;
        if (!oporavakOdrađen && ovisnosti.jeApiGreska401(greska)) {
          oporavakOdrađen = true;
          await ovisnosti.oporavi401().catch(() => {});
          if (mojaGeneracija !== generacija) return;
          continue;
        }
        pokusaj += 1;
        if (pokusaj < pokusaji) await new Promise((r) => setTimeout(r, 250 * pokusaj));
      }
    }
    if (mojaGeneracija !== generacija) return;
    postavi(null, 'greska');
  }

  async function osiguraj(opcije: { forsaj?: boolean; pokusaji?: number } = {}): Promise<void> {
    if (opcije.forsaj) {
      generacija += 1;
      if (inFlight) {
        await inFlight.catch(() => {});
      }
      // Drugi paralelni forsaj već pokrenuo novi dohvat — pridruži se umjesto ranog returna.
      if (inFlight) {
        await inFlight;
        return;
      }
    } else if (inFlight) {
      await inFlight;
      return;
    }

    const mojaGeneracija = generacija;
    let pokretanje!: Promise<void>;
    pokretanje = (async () => {
      try {
        await dohvati(mojaGeneracija, opcije.pokusaji ?? 3);
      } finally {
        if (inFlight === pokretanje) inFlight = null;
      }
    })();
    inFlight = pokretanje;
    await pokretanje;
  }

  function invalidiraj() {
    generacija += 1;
    inFlight = null;
    postavi(null, 'prazno');
  }

  function azurirajAvatar(avatarConfig: AvatarConfigV1) {
    if (!snapshot) return;
    postavi({ ...snapshot, avatarConfig }, status === 'greska' || status === 'prazno' ? 'spreman' : status);
  }

  return {
    get snapshot() {
      return snapshot;
    },
    get status() {
      return status;
    },
    get generacija() {
      return generacija;
    },
    get imaInFlight() {
      return inFlight !== null;
    },
    osiguraj,
    invalidiraj,
    azurirajAvatar,
    pretplatiSe(cb: () => void) {
      pretplatnici.add(cb);
      return () => {
        pretplatnici.delete(cb);
      };
    },
  };
}

export type ProfilResurs = ReturnType<typeof stvoriProfilResurs>;
