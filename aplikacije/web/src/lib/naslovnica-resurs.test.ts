import { describe, expect, it, vi } from 'vitest';
import type { AvatarConfigV1, OdgovorNaslovnicaSazetka } from 'zajednicko';
import { stvoriNaslovnicaResurs } from './naslovnica-resurs.js';

function bazaSazetka(igracId: string, nadimak = 'Gost'): OdgovorNaslovnicaSazetka {
  return {
    ok: true,
    igracId,
    profil: {
      igracId,
      nadimak,
      vrsta: 'gost',
      avatarId: 0,
      avatarConfig: null,
      email: null,
      rang: 'Piskaralo',
      rang1v1: 'Piskaralo',
      iskustvo: { razina: 1, ukupno: 0, uRazini: 0, doIduce: 240 },
    },
    izazovi: { omogucen: true, zavrseno: 0, ukupno: 45 },
    misije: {
      dnevneAktivne: 1,
      tjedneAktivne: 0,
      ukupnoAktivnih: 1,
      novosti: { dnevne: true, tjedne: false },
    },
    kolekcija: { ukupnoOtkljucano: 0 },
    dostignuca: { ukupnoZvjezdica: 0, maksimalnoZvjezdica: 40 },
    ljestvice: { status: { vrsta: 'neutralan' }, izracunatoU: new Date().toISOString() },
    obavijesti: {
      brojNeprocitanih: 0,
      zaNajavu: [],
      neprocitane: [],
      sljedeciCursor: null,
    },
  };
}

describe('naslovnica-resurs', () => {
  it('paralelni forsaj nakon invalidacije završava sa spremnim sažetkom', async () => {
    let otkaziPrvi!: (v: OdgovorNaslovnicaSazetka) => void;
    let pozivi = 0;
    const api = vi.fn(async () => {
      pozivi += 1;
      if (pozivi === 1) {
        return await new Promise<OdgovorNaslovnicaSazetka>((resolve) => {
          otkaziPrvi = resolve;
        });
      }
      return bazaSazetka('id-2', 'Novi');
    });
    const resurs = stvoriNaslovnicaResurs({
      api,
      oporavi401: async () => {},
      jeApiGreska401: () => false,
    });

    const prvi = resurs.osiguraj();
    resurs.invalidiraj();
    const forsajA = resurs.osiguraj({ forsaj: true });
    const forsajB = resurs.osiguraj({ forsaj: true });
    otkaziPrvi(bazaSazetka('id-1', 'Stari'));
    await Promise.all([prvi, forsajA, forsajB]);

    expect(resurs.status).toBe('spreman');
    expect(resurs.sazetak?.profil.nadimak).toBe('Novi');
    expect(resurs.igracId).toBe('id-2');
    expect(pozivi).toBeGreaterThanOrEqual(2);
  });

  it('nakon 401 prima odgovor s drugim igracId', async () => {
    const oporavi401 = vi.fn(async () => {});
    const api = vi
      .fn()
      .mockResolvedValueOnce(bazaSazetka('stari'))
      .mockRejectedValueOnce(Object.assign(new Error('401'), { status: 401 }))
      .mockResolvedValueOnce(bazaSazetka('gost-novi', 'Oporavljen'));
    const resurs = stvoriNaslovnicaResurs({
      api,
      oporavi401,
      jeApiGreska401: (g) =>
        typeof g === 'object' && g !== null && 'status' in g && (g as { status: number }).status === 401,
    });

    await resurs.osiguraj();
    expect(resurs.igracId).toBe('stari');

    await resurs.osiguraj({ forsaj: true });
    expect(oporavi401).toHaveBeenCalled();
    expect(resurs.sazetak?.igracId).toBe('gost-novi');
    expect(resurs.status).toBe('spreman');
  });

  it('azurirajAvatar čuva lokalni config i odbacuje kasni HTTP odgovor', async () => {
    let otkaziForsaj!: (v: OdgovorNaslovnicaSazetka) => void;
    let pozivi = 0;
    const api = vi.fn(async () => {
      pozivi += 1;
      if (pozivi === 1) return bazaSazetka('id-1');
      return await new Promise<OdgovorNaslovnicaSazetka>((resolve) => {
        otkaziForsaj = resolve;
      });
    });
    const resurs = stvoriNaslovnicaResurs({
      api,
      oporavi401: async () => {},
      jeApiGreska401: () => false,
    });

    await resurs.osiguraj();
    const forsaj = resurs.osiguraj({ forsaj: true });
    const lokalni = { verzija: 1, dijelovi: [] } as unknown as AvatarConfigV1;
    resurs.azurirajAvatar(lokalni);

    otkaziForsaj({
      ...bazaSazetka('id-1'),
      profil: {
        ...bazaSazetka('id-1').profil,
        avatarConfig: { verzija: 1, dijelovi: [{ tip: 'stari' }] } as unknown as AvatarConfigV1,
      },
    });
    await forsaj;

    expect(resurs.sazetak?.profil.avatarConfig).toEqual(lokalni);
  });

  it('oznaciNovostiMisijaPregledane briše novosti iz cachea', async () => {
    const api = vi.fn(async () => bazaSazetka('reg-1'));
    const resurs = stvoriNaslovnicaResurs({
      api,
      oporavi401: async () => {},
      jeApiGreska401: () => false,
    });
    await resurs.osiguraj();
    expect(resurs.sazetak?.misije?.novosti.dnevne).toBe(true);

    resurs.oznaciNovostiMisijaPregledane(['dnevna']);
    expect(resurs.sazetak?.misije?.novosti.dnevne).toBe(false);

    // Bez forsaja vraća cache — toast se ne bi smio vratiti.
    await resurs.osiguraj();
    expect(api).toHaveBeenCalledTimes(1);
    expect(resurs.sazetak?.misije?.novosti.dnevne).toBe(false);
  });

  it('kasni HTTP odgovor ne vraća dismissane novosti misija', async () => {
    let otkazi!: (v: OdgovorNaslovnicaSazetka) => void;
    const api = vi
      .fn()
      .mockResolvedValueOnce(bazaSazetka('reg-1'))
      .mockImplementationOnce(
        () =>
          new Promise<OdgovorNaslovnicaSazetka>((resolve) => {
            otkazi = resolve;
          }),
      );
    const resurs = stvoriNaslovnicaResurs({
      api,
      oporavi401: async () => {},
      jeApiGreska401: () => false,
    });
    await resurs.osiguraj();
    const forsaj = resurs.osiguraj({ forsaj: true });
    resurs.oznaciNovostiMisijaPregledane(['dnevna']);
    expect(resurs.sazetak?.misije?.novosti.dnevne).toBe(false);
    otkazi(bazaSazetka('reg-1'));
    await forsaj;
    expect(resurs.sazetak?.misije?.novosti.dnevne).toBe(false);
  });

  it('ukloniObavijestiIzListe ažurira cache liste', async () => {
    const saObavijesti: OdgovorNaslovnicaSazetka = {
      ...bazaSazetka('id-1'),
      obavijesti: {
        brojNeprocitanih: 2,
        zaNajavu: [],
        neprocitane: [
          {
            id: 'p1',
            tip: 'test',
            naslov: 'A',
            tekst: 'a',
            podaci: {},
            poveznica: null,
            stvorenaAt: new Date().toISOString(),
            procitano: false,
          },
          {
            id: 'p2',
            tip: 'test',
            naslov: 'B',
            tekst: 'b',
            podaci: {},
            poveznica: null,
            stvorenaAt: new Date().toISOString(),
            procitano: false,
          },
        ],
        sljedeciCursor: null,
      },
    };
    const api = vi.fn(async () => saObavijesti);
    const resurs = stvoriNaslovnicaResurs({
      api,
      oporavi401: async () => {},
      jeApiGreska401: () => false,
    });
    await resurs.osiguraj();
    resurs.ukloniObavijestiIzListe(['p1']);
    expect(resurs.sazetak?.obavijesti?.neprocitane.map((p) => p.id)).toEqual(['p2']);
    expect(resurs.sazetak?.obavijesti?.brojNeprocitanih).toBe(1);
  });

  it('null obavijesti ne brišu prethodnu listu za istog igrača', async () => {
    const sObavijestima = bazaSazetka('id-1');
    const bezObavijesti: OdgovorNaslovnicaSazetka = {
      ...bazaSazetka('id-1'),
      obavijesti: null,
      kolekcija: { ukupnoOtkljucano: 3 },
    };
    const api = vi
      .fn()
      .mockResolvedValueOnce(sObavijestima)
      .mockResolvedValueOnce(bezObavijesti);
    const resurs = stvoriNaslovnicaResurs({
      api,
      oporavi401: async () => {},
      jeApiGreska401: () => false,
    });
    await resurs.osiguraj();
    expect(resurs.obavijestiLista?.poruke).toEqual([]);
    await resurs.osiguraj({ forsaj: true });
    expect(resurs.sazetak?.kolekcija?.ukupnoOtkljucano).toBe(3);
    expect(resurs.sazetak?.obavijesti).toBeNull();
    expect(resurs.obavijestiLista?.poruke).toEqual([]);
  });

  it('null obavijesti brišu listu kad se igracId promijeni', async () => {
    const stari: OdgovorNaslovnicaSazetka = {
      ...bazaSazetka('stari'),
      obavijesti: {
        brojNeprocitanih: 1,
        zaNajavu: [],
        neprocitane: [
          {
            id: 'tuda',
            tip: 'test',
            naslov: 'Tuđa',
            tekst: 'x',
            podaci: {},
            poveznica: null,
            stvorenaAt: new Date().toISOString(),
            procitano: false,
          },
        ],
        sljedeciCursor: null,
      },
    };
    const novi: OdgovorNaslovnicaSazetka = {
      ...bazaSazetka('novi', 'Novi'),
      obavijesti: null,
    };
    const api = vi.fn().mockResolvedValueOnce(stari).mockResolvedValueOnce(novi);
    const resurs = stvoriNaslovnicaResurs({
      api,
      oporavi401: async () => {},
      jeApiGreska401: () => false,
    });
    await resurs.osiguraj();
    expect(resurs.obavijestiLista?.poruke.map((p) => p.id)).toEqual(['tuda']);
    await resurs.osiguraj({ forsaj: true });
    expect(resurs.igracId).toBe('novi');
    expect(resurs.obavijestiLista).toBeNull();
  });

  it('invalidiraj podiže generaciju i forsaj dohvaća novi sažetak', async () => {
    const api = vi
      .fn()
      .mockResolvedValueOnce(bazaSazetka('id-1', 'Stari'))
      .mockResolvedValueOnce(bazaSazetka('id-2', 'Novi'));
    const resurs = stvoriNaslovnicaResurs({
      api,
      oporavi401: async () => {},
      jeApiGreska401: () => false,
    });
    await resurs.osiguraj();
    resurs.invalidiraj();
    await resurs.osiguraj({ forsaj: true });
    expect(resurs.sazetak?.profil.nadimak).toBe('Novi');
    expect(api).toHaveBeenCalledTimes(2);
  });
});
