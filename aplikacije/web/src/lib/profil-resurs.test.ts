import { describe, expect, it, vi } from 'vitest';
import { stvoriProfilResurs, type ProfilSnapshot } from './profil-resurs.js';

function bazaProfila(nadimak: string): ProfilSnapshot {
  return {
    nadimak,
    avatarId: 1,
    rang: 'Piskaralo',
    rang1v1: null,
    email: null,
    vrsta: 'gost',
    avatarConfig: null,
    iskustvo: { razina: 1, ukupno: 0, uRazini: 0, doIduce: 240 },
  };
}

describe('profil-resurs', () => {
  it('dijeli jedan in-flight GET između paralelnih poziva', async () => {
    let pozivi = 0;
    let otkazi!: (v: ProfilSnapshot) => void;
    const api = vi.fn(async () => {
      pozivi += 1;
      return await new Promise<ProfilSnapshot>((resolve) => {
        otkazi = resolve;
      });
    });
    const resurs = stvoriProfilResurs({
      api,
      oporavi401: async () => {},
      jeApiGreska401: () => false,
    });

    const a = resurs.osiguraj();
    const b = resurs.osiguraj();
    expect(pozivi).toBe(1);
    otkazi(bazaProfila('Gost'));
    await Promise.all([a, b]);
    expect(pozivi).toBe(1);
    expect(resurs.snapshot?.nadimak).toBe('Gost');
    expect(resurs.status).toBe('spreman');
  });

  it('zanemaruje kasni odgovor nakon invalidacije', async () => {
    let otkazi!: (v: ProfilSnapshot) => void;
    const api = vi.fn(async () => {
      return await new Promise<ProfilSnapshot>((resolve) => {
        otkazi = resolve;
      });
    });
    const resurs = stvoriProfilResurs({
      api,
      oporavi401: async () => {},
      jeApiGreska401: () => false,
    });

    const prvi = resurs.osiguraj();
    resurs.invalidiraj();
    expect(resurs.snapshot).toBeNull();
    expect(resurs.status).toBe('prazno');

    otkazi(bazaProfila('Stari'));
    await prvi;
    expect(resurs.snapshot).toBeNull();
    expect(resurs.status).toBe('prazno');
  });

  it('forsirani refresh zamjenjuje snapshot novim profilom', async () => {
    const api = vi
      .fn()
      .mockResolvedValueOnce(bazaProfila('Prvi'))
      .mockResolvedValueOnce({ ...bazaProfila('Drugi'), email: 'a@b.c', vrsta: 'registriran' });
    const resurs = stvoriProfilResurs({
      api,
      oporavi401: async () => {},
      jeApiGreska401: () => false,
    });

    await resurs.osiguraj();
    expect(resurs.snapshot?.nadimak).toBe('Prvi');
    await resurs.osiguraj({ forsaj: true });
    expect(resurs.snapshot?.nadimak).toBe('Drugi');
    expect(api).toHaveBeenCalledTimes(2);
  });

  it('nakon 401 oporavka uspijeva bez petlje', async () => {
    const oporavi401 = vi.fn(async () => {});
    const api = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new Error('401'), { status: 401 }))
      .mockResolvedValueOnce(bazaProfila('Oporavljen'));
    const resurs = stvoriProfilResurs({
      api,
      oporavi401,
      jeApiGreska401: (g) => typeof g === 'object' && g !== null && 'status' in g && (g as { status: number }).status === 401,
    });

    await resurs.osiguraj({ pokusaji: 2 });
    expect(oporavi401).toHaveBeenCalledTimes(1);
    expect(api).toHaveBeenCalledTimes(2);
    expect(resurs.snapshot?.nadimak).toBe('Oporavljen');
  });

  it('forsirani refresh usred loada zanemaruje stari odgovor i dohvaća novi', async () => {
    let otkaziPrvi!: (v: ProfilSnapshot) => void;
    let pozivi = 0;
    const api = vi.fn(async () => {
      pozivi += 1;
      if (pozivi === 1) {
        return await new Promise<ProfilSnapshot>((resolve) => {
          otkaziPrvi = resolve;
        });
      }
      return bazaProfila('Novi');
    });
    const resurs = stvoriProfilResurs({
      api,
      oporavi401: async () => {},
      jeApiGreska401: () => false,
    });

    const prvi = resurs.osiguraj();
    const forsaj = resurs.osiguraj({ forsaj: true });
    otkaziPrvi(bazaProfila('Stari'));
    await Promise.all([prvi, forsaj]);
    expect(resurs.snapshot?.nadimak).toBe('Novi');
    expect(pozivi).toBe(2);
  });
});
