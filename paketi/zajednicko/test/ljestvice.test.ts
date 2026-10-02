import { describe, expect, it } from 'vitest';
import {
  formatirajOdbrojavanje,
  godisnjicaPocetka,
  graniceRazdoblja,
  kalendarskeGranice,
  minimumIgaraZaRazdoblje,
  prozorOkoMjesta,
} from '../src/ljestvice.js';

const sati = (od: Date, doTrenutka: Date) => (doTrenutka.getTime() - od.getTime()) / 3_600_000;

describe('razdoblja ljestvica (Europe/Zagreb)', () => {
  it('dan počinje u zagrebačku ponoć, ljeti i zimi', () => {
    const ljeto = kalendarskeGranice('dnevno', new Date('2026-10-02T10:00:00Z'));
    expect(ljeto.od.toISOString()).toBe('2026-10-01T22:00:00.000Z');
    expect(ljeto.do.toISOString()).toBe('2026-10-02T22:00:00.000Z');
    const zima = kalendarskeGranice('dnevno', new Date('2026-12-15T23:30:00Z'));
    expect(zima.od.toISOString()).toBe('2026-12-15T23:00:00.000Z');
  });

  it('dani promjene sata traju 23 i 25 sati', () => {
    const proljece = kalendarskeGranice('dnevno', new Date('2026-03-29T12:00:00Z'));
    const jesen = kalendarskeGranice('dnevno', new Date('2026-10-25T12:00:00Z'));
    expect(sati(proljece.od, proljece.do)).toBe(23);
    expect(sati(jesen.od, jesen.do)).toBe(25);
  });

  it('točno u ponoć igra pripada novom danu', () => {
    const ponoc = new Date('2026-10-01T22:00:00Z');
    expect(kalendarskeGranice('dnevno', ponoc).od.toISOString()).toBe(ponoc.toISOString());
    const sekundaPrije = new Date(ponoc.getTime() - 1);
    expect(kalendarskeGranice('dnevno', sekundaPrije).do.toISOString()).toBe(ponoc.toISOString());
  });

  it('tjedan traje od ponedjeljka do ponedjeljka i prelazi Novu godinu', () => {
    const tjedan = kalendarskeGranice('tjedno', new Date('2026-12-31T12:00:00Z'));
    expect(tjedan.od.toISOString()).toBe('2026-12-27T23:00:00.000Z');
    expect(tjedan.do.toISOString()).toBe('2027-01-03T23:00:00.000Z');
    const godina = kalendarskeGranice('godisnje', new Date('2026-12-31T12:00:00Z'));
    expect(godina.do.toISOString()).toBe('2026-12-31T23:00:00.000Z');
  });

  it('mjesec i godina koriste kalendarske granice', () => {
    const mjesec = kalendarskeGranice('mjesecno', new Date('2026-12-10T12:00:00Z'));
    expect(mjesec.od.toISOString()).toBe('2026-11-30T23:00:00.000Z');
    expect(mjesec.do.toISOString()).toBe('2026-12-31T23:00:00.000Z');
  });

  it('obuhvat se reže na početak praćenja bez smanjenja minimuma', () => {
    const pocetak = new Date('2026-10-15T10:00:00Z');
    const granice = graniceRazdoblja('mjesecno', new Date('2026-10-20T10:00:00Z'), pocetak);
    expect(granice.od.toISOString()).toBe(pocetak.toISOString());
    expect(minimumIgaraZaRazdoblje('mjesecno')).toBe(20);
    expect(minimumIgaraZaRazdoblje('dnevno')).toBe(10);
  });

  it('svih vremena je zaključano do prve kalendarske godišnjice', () => {
    const pocetak = new Date('2026-10-15T08:00:00Z');
    const zakljucano = graniceRazdoblja('svih_vremena', new Date('2027-10-15T07:59:59Z'), pocetak);
    const otkljucano = graniceRazdoblja('svih_vremena', new Date('2027-10-15T08:00:00Z'), pocetak);
    expect(zakljucano.zakljucano).toBe(true);
    expect(otkljucano.zakljucano).toBe(false);
    expect(otkljucano.do).toBeNull();
  });

  it('godišnjica 29. veljače prelazi u 28. veljače', () => {
    const godisnjica = godisnjicaPocetka(new Date('2028-02-28T23:00:00Z'));
    expect(godisnjica.toISOString()).toBe('2029-02-27T23:00:00.000Z');
  });
});

describe('prozor „Oko mene"', () => {
  it.each([
    [500, 1000, 496, 505],
    [1, 1000, 1, 10],
    [5, 1000, 1, 10],
    [999, 1000, 991, 1000],
    [1000, 1000, 991, 1000],
    [4, 7, 1, 7],
    [1, 1, 1, 1],
    [11, 11, 2, 11],
  ])('mjesto %i od %i daje %i–%i', (mjesto, ukupno, od, doMjesta) => {
    expect(prozorOkoMjesta(mjesto, ukupno)).toEqual({ od, do: doMjesta });
  });

  it('za svako mjesto do 1000 vraća najviše 10 redaka koji ga sadrže', () => {
    for (let ukupno = 1; ukupno <= 60; ukupno += 1) {
      for (let mjesto = 1; mjesto <= ukupno; mjesto += 1) {
        const prozor = prozorOkoMjesta(mjesto, ukupno);
        expect(prozor.od).toBeGreaterThanOrEqual(1);
        expect(prozor.do - prozor.od + 1).toBe(Math.min(10, ukupno));
        expect(mjesto).toBeGreaterThanOrEqual(prozor.od);
        expect(mjesto).toBeLessThanOrEqual(prozor.do);
      }
    }
  });
});

describe('odbrojavanje', () => {
  it('ispod dana prikazuje sate, minute i sekunde', () => {
    expect(formatirajOdbrojavanje(5_000)).toBe('00:00:05');
    expect(formatirajOdbrojavanje((5 * 3600 + 55 * 60 + 12) * 1000)).toBe('05:55:12');
    expect(formatirajOdbrojavanje(-1)).toBe('00:00:00');
  });

  it('od jednog dana prikazuje dane i sate', () => {
    expect(formatirajOdbrojavanje((5 * 86_400 + 4 * 3600 + 59) * 1000)).toBe('5 d 4 h');
  });
});
