/**
 * Čisti resurs za GET /naslovnica/sazetak — dedup, forsaj, 401, lokalni patchavi.
 * Omotač u stanje-naslovnica.svelte.ts hidrira profil i sandučic.
 */
import type {
  AvatarConfigV1,
  OdgovorNaslovnicaSazetka,
  SanducicPorukaDetalj,
} from 'zajednicko';

export type StatusNaslovnice = 'prazno' | 'ucitavanje' | 'spreman' | 'greska';

export type NaslovnicaApi = (
  putanja: string,
  opcije?: RequestInit,
) => Promise<OdgovorNaslovnicaSazetka>;

export type NaslovnicaResursOvisnosti = {
  api: NaslovnicaApi;
  oporavi401: () => Promise<void>;
  jeApiGreska401: (greska: unknown) => boolean;
  /** Poziva se nakon uspješne primjene sažetka (hidracija profila/sandučića). */
  naPrimjenu?: (odgovor: OdgovorNaslovnicaSazetka) => void;
};

export function stvoriNaslovnicaResurs(ovisnosti: NaslovnicaResursOvisnosti) {
  let sazetak: OdgovorNaslovnicaSazetka | null = null;
  let status: StatusNaslovnice = 'prazno';
  let igracId: string | null = null;
  let obavijestiLista: {
    poruke: SanducicPorukaDetalj[];
    sljedeciCursor: string | null;
  } | null = null;
  let generacija = 0;
  /** Generacija za koju je zadnji uspješan sažetak primijenjen. */
  let primijenjenaGeneracija = -1;
  let inFlight: Promise<void> | null = null;
  const pretplatnici = new Set<() => void>();

  function objavi() {
    for (const cb of pretplatnici) cb();
  }

  function primijeniOdgovor(odgovor: OdgovorNaslovnicaSazetka, mojaGeneracija: number): void {
    sazetak = odgovor;
    igracId = odgovor.igracId;
    status = 'spreman';
    primijenjenaGeneracija = mojaGeneracija;
    // Null obavijesti = podservis pao — zadrži prethodnu listu.
    if (odgovor.obavijesti) {
      obavijestiLista = {
        poruke: odgovor.obavijesti.neprocitane,
        sljedeciCursor: odgovor.obavijesti.sljedeciCursor,
      };
    }
    ovisnosti.naPrimjenu?.(odgovor);
    objavi();
  }

  async function dohvati(mojaGeneracija: number, ocekivaniIgracId: string | null): Promise<void> {
    if (!sazetak) {
      status = 'ucitavanje';
      objavi();
    }

    let oporavakOdrađen = false;
    let pokusaj = 0;
    const maxPokusaja = 3;
    while (pokusaj < maxPokusaja) {
      if (mojaGeneracija !== generacija) return;
      try {
        const odgovor = await ovisnosti.api('/naslovnica/sazetak');
        if (mojaGeneracija !== generacija) return;
        if (ocekivaniIgracId && odgovor.igracId !== ocekivaniIgracId) return;
        primijeniOdgovor(odgovor, mojaGeneracija);
        return;
      } catch (greska) {
        if (mojaGeneracija !== generacija) return;
        if (!oporavakOdrađen && ovisnosti.jeApiGreska401(greska)) {
          oporavakOdrađen = true;
          await ovisnosti.oporavi401().catch(() => {});
          if (mojaGeneracija !== generacija) return;
          // Novi gost token može imati drugi igracId — ne drži stari ocekivani ID.
          continue;
        }
        pokusaj += 1;
        if (pokusaj < maxPokusaja) await new Promise((r) => setTimeout(r, 250 * pokusaj));
      }
    }
    if (mojaGeneracija !== generacija) return;
    if (!sazetak) {
      status = 'greska';
      objavi();
    } else {
      status = 'spreman';
      objavi();
    }
  }

  function imaSvjeziSazetak(): boolean {
    return status === 'spreman' && sazetak !== null && primijenjenaGeneracija === generacija;
  }

  async function osiguraj(opcije: { forsaj?: boolean; igracId?: string | null } = {}): Promise<void> {
    if (opcije.forsaj) {
      generacija += 1;
      if (inFlight) await inFlight.catch(() => {});
      // Drugi paralelni forsaj već pokrenuo dohvat za (barem) trenutnu generaciju — pridruži se.
      if (inFlight) {
        await inFlight;
        if (imaSvjeziSazetak()) return;
        // Zastarjeli in-flight nije primijenio trenutnu generaciju — nastavi s novim dohvatom.
      }
    } else if (inFlight) {
      await inFlight;
      return;
    } else if (status === 'spreman' && sazetak) {
      if (!opcije.igracId || igracId === opcije.igracId) return;
    }

    const mojaGeneracija = generacija;
    const ovaj = dohvati(mojaGeneracija, opcije.igracId ?? null);
    inFlight = ovaj;
    try {
      await ovaj;
    } finally {
      if (inFlight === ovaj) inFlight = null;
    }
  }

  function invalidiraj(): void {
    generacija += 1;
    inFlight = null;
    primijenjenaGeneracija = -1;
    sazetak = null;
    igracId = null;
    obavijestiLista = null;
    status = 'prazno';
    objavi();
  }

  /**
   * Lokalni avatar bez brisanja cachea. Povećava generaciju da kasni HTTP odgovor ne prepiše config.
   */
  function azurirajAvatar(avatarConfig: AvatarConfigV1, avatarSlikaHash: string | null = null): void {
    generacija += 1;
    if (!sazetak) {
      objavi();
      return;
    }
    sazetak = {
      ...sazetak,
      profil: { ...sazetak.profil, avatarConfig, avatarSlikaHash },
    };
    primijenjenaGeneracija = generacija;
    status = 'spreman';
    objavi();
  }

  function oznaciNovostiMisijaPregledane(skupine: readonly ('dnevna' | 'tjedna')[]): void {
    if (!sazetak?.misije) return;
    // Povećaj generaciju da kasni HTTP odgovor ne vrati dismissane novosti.
    generacija += 1;
    const novosti = { ...sazetak.misije.novosti };
    for (const s of skupine) {
      if (s === 'dnevna') novosti.dnevne = false;
      if (s === 'tjedna') novosti.tjedne = false;
    }
    sazetak = {
      ...sazetak,
      misije: { ...sazetak.misije, novosti },
    };
    primijenjenaGeneracija = generacija;
    status = 'spreman';
    objavi();
  }

  function ukloniObavijestiIzListe(ids: readonly string[]): void {
    if (ids.length === 0) return;
    const skup = new Set(ids);
    // Povećaj generaciju da kasni HTTP odgovor ne vrati uklonjene poruke.
    generacija += 1;
    if (obavijestiLista) {
      obavijestiLista = {
        ...obavijestiLista,
        poruke: obavijestiLista.poruke.filter((p) => !skup.has(p.id)),
      };
    }
    if (sazetak?.obavijesti) {
      const neprocitane = sazetak.obavijesti.neprocitane.filter((p) => !skup.has(p.id));
      const broj = Math.max(0, sazetak.obavijesti.brojNeprocitanih - ids.length);
      sazetak = {
        ...sazetak,
        obavijesti: {
          ...sazetak.obavijesti,
          brojNeprocitanih: broj,
          neprocitane,
          zaNajavu: sazetak.obavijesti.zaNajavu.filter((p) => !skup.has(p.id)),
        },
      };
    }
    primijenjenaGeneracija = generacija;
    if (sazetak) status = 'spreman';
    objavi();
  }

  function potrosiPocetnuListuObavijesti(): {
    poruke: SanducicPorukaDetalj[];
    sljedeciCursor: string | null;
  } | null {
    const lista = obavijestiLista;
    obavijestiLista = null;
    return lista;
  }

  return {
    get sazetak() {
      return sazetak;
    },
    get status() {
      return status;
    },
    get igracId() {
      return igracId;
    },
    get obavijestiLista() {
      return obavijestiLista;
    },
    get generacija() {
      return generacija;
    },
    get primijenjenaGeneracija() {
      return primijenjenaGeneracija;
    },
    get imaInFlight() {
      return inFlight !== null;
    },
    osiguraj,
    invalidiraj,
    azurirajAvatar,
    oznaciNovostiMisijaPregledane,
    ukloniObavijestiIzListe,
    potrosiPocetnuListuObavijesti,
    pretplatiSe(cb: () => void) {
      pretplatnici.add(cb);
      return () => {
        pretplatnici.delete(cb);
      };
    },
  };
}

export type NaslovnicaResurs = ReturnType<typeof stvoriNaslovnicaResurs>;
