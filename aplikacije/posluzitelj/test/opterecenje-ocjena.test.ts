import { describe, expect, it } from 'vitest';
import { ocijeniMijesanoMjerenje, ocijeniPopunuReda, ocijeniRacunalneProtivnike, procitajHttpSazetak, type MjerenjePopune } from '../src/cli/opterecenje-ocjena.js';

describe('ocjena predtesta popune reda', () => {
  const dvoboj = (cekanjeMs = 30_400): MjerenjePopune => ({ mod: 'dva_igraca', cekanjeMs, brojBotova: 1, rezervacijeMs: [], potezaBota: 2, zavrsena: true });
  const cetveroboj = (rezervacijeMs = [20_300, 30_100], cekanjeMs = 40_200): MjerenjePopune =>
    ({ mod: 'cetiri_igraca', cekanjeMs, brojBotova: 3, rezervacijeMs, potezaBota: 5, zavrsena: false });
  const ulaz = {
    mjerenja: [dvoboj(), dvoboj(29_000), cetveroboj(), cetveroboj()],
    planirano: { dva_igraca: 2, cetiri_igraca: 2 },
    istekBotovaDelta: 0,
    tehnickeGreskeBotovaDelta: 0,
    iscrpljenjaDelta: 0,
    tehnickeGreskeGeneratora: 0,
  };

  it('prolazi kad su vremena unutar ±3 s, sastav 1/3 bota i rezervacije vidljive na 20 i 30 s', () => {
    const ocjena = ocijeniPopunuReda(ulaz);
    expect(Object.values(ocjena.provjere).every(Boolean)).toBe(true);
    expect(ocjena.pokrenutePartije).toBe(4);
    expect(ocjena.zavrsenePartije).toBe(2);
    expect(ocjena.cekanjeCetverobojaMs).toEqual({ min: 40_200, max: 40_200 });
  });

  it('pada na sporoj popuni, krivom sastavu, nevidljivoj rezervaciji, isteku ili iscrpljenju fonda', () => {
    expect(ocijeniPopunuReda({ ...ulaz, mjerenja: [dvoboj(33_500), cetveroboj()], planirano: { dva_igraca: 1, cetiri_igraca: 1 } }).provjere.cekanjeDvoboja).toBe(false);
    expect(ocijeniPopunuReda({ ...ulaz, mjerenja: [dvoboj(), cetveroboj([20_000, 30_000], 44_000)], planirano: { dva_igraca: 1, cetiri_igraca: 1 } }).provjere.cekanjeCetveroboja).toBe(false);
    expect(ocijeniPopunuReda({ ...ulaz, mjerenja: [{ ...dvoboj(), brojBotova: 0 }] , planirano: { dva_igraca: 1, cetiri_igraca: 0 } }).provjere.sastavDvoboja).toBe(false);
    expect(ocijeniPopunuReda({ ...ulaz, mjerenja: [cetveroboj([20_000])], planirano: { dva_igraca: 0, cetiri_igraca: 1 } }).provjere.rezervacijeVidljive).toBe(false);
    expect(ocijeniPopunuReda({ ...ulaz, mjerenja: [{ ...dvoboj(), cekanjeMs: null }], planirano: { dva_igraca: 1, cetiri_igraca: 0 } }).provjere.svePartijePokrenute).toBe(false);
    expect(ocijeniPopunuReda({ ...ulaz, planirano: { dva_igraca: 10, cetiri_igraca: 10 } }).provjere.svePartijePokrenute).toBe(false);
    expect(ocijeniPopunuReda({ ...ulaz, mjerenja: [{ ...dvoboj(), potezaBota: 0 }], planirano: { dva_igraca: 1, cetiri_igraca: 0 } }).provjere.botoviIgraju).toBe(false);
    expect(ocijeniPopunuReda({ ...ulaz, istekBotovaDelta: 1 }).provjere.botBezIsteka).toBe(false);
    expect(ocijeniPopunuReda({ ...ulaz, istekBotovaDelta: null }).provjere.botBezIsteka).toBe(false);
    expect(ocijeniPopunuReda({ ...ulaz, iscrpljenjaDelta: 2 }).provjere.fondBezIscrpljenja).toBe(false);
    expect(ocijeniPopunuReda({ ...ulaz, tehnickeGreskeGeneratora: 1 }).provjere.tehnickeGreske).toBe(false);
  });
});

describe('ocjena računalnih protivnika', () => {
  const ulaz = {
    brojTreninga: 10,
    zavrsenihTreninga: 12,
    aktivniTreninziUzorci: Array<number>(60).fill(10),
    poteziTreningaMs: [50, 120],
    istekRacunalaGenerator: 0,
    odbijeniTreninzi: 0,
    botIsteciPocetak: 3,
    botIsteciKraj: 3,
    botTehnickeGreskePocetak: 0,
    botTehnickeGreskeKraj: 0,
    eventLoopP95Uzorci: Array<number>(12).fill(12),
  };

  it('prolazi kad su treninzi održani, bot nikad nije istekao i event-loop je miran', () => {
    expect(Object.values(ocijeniRacunalneProtivnike(ulaz).provjere).every(Boolean)).toBe(true);
  });

  it('pada na isteku bota, tehničkoj grešci, odbijenom treningu, sporom event-loopu i nedostajućoj metrici', () => {
    expect(ocijeniRacunalneProtivnike({ ...ulaz, botIsteciKraj: 4 }).provjere.botBezIsteka).toBe(false);
    expect(ocijeniRacunalneProtivnike({ ...ulaz, istekRacunalaGenerator: 1 }).provjere.botBezIsteka).toBe(false);
    expect(ocijeniRacunalneProtivnike({ ...ulaz, botTehnickeGreskeKraj: 1 }).provjere.botBezTehnickihGresaka).toBe(false);
    expect(ocijeniRacunalneProtivnike({ ...ulaz, odbijeniTreninzi: 1 }).provjere.treninziPrihvaceni).toBe(false);
    expect(ocijeniRacunalneProtivnike({ ...ulaz, eventLoopP95Uzorci: [12, 101] }).provjere.eventLoopPosluzitelja).toBe(false);
    expect(ocijeniRacunalneProtivnike({ ...ulaz, eventLoopP95Uzorci: [12, null] }).provjere.eventLoopPosluzitelja).toBe(false);
    expect(ocijeniRacunalneProtivnike({ ...ulaz, botIsteciPocetak: null }).provjere.botBezIsteka).toBe(false);
    expect(ocijeniRacunalneProtivnike({ ...ulaz, aktivniTreninziUzorci: [10, 8, 8] }).provjere.treninziOdrzani).toBe(false);
    expect(ocijeniRacunalneProtivnike({ ...ulaz, aktivniTreninziUzorci: [10, 10, 0] }).provjere.treninziOdrzani).toBe(true);
    expect(ocijeniRacunalneProtivnike({ ...ulaz, poteziTreningaMs: [300] }).provjere.latencijeTrening).toBe(false);
  });

  it('bez traženih treninga preskače trening provjere, ali i dalje traži metrike bota', () => {
    const ocjena = ocijeniRacunalneProtivnike({ ...ulaz, brojTreninga: 0, zavrsenihTreninga: 0, aktivniTreninziUzorci: [], poteziTreningaMs: [] });
    expect(ocjena.provjere.treningZavrsava).toBe(true);
    expect(ocjena.provjere.treninziOdrzani).toBe(true);
    expect(ocjena.provjere.latencijeTrening).toBe(true);
    expect(ocjena.provjere.botBezIsteka).toBe(true);
  });
});

describe('ocjena miješanog mjerenja', () => {
  const ulaz = {
    poteziMs: [100, 250],
    spremanjaMs: [500, 1_000],
    aktivniIgraci: Array<number>(60).fill(100),
    igrackiKorisnici: Array<number>(60).fill(100),
    ciljaniIgraci: 100,
    planiranoDrzanjeMs: 60_000,
    stvarnoDrzanjeMs: 60_000,
  };

  it('prihvaća dovršeno mjerenje unutar pragova', () => {
    expect(Object.values(ocijeniMijesanoMjerenje(ulaz).provjere).every(Boolean)).toBe(true);
  });

  it('odbija spore poteze i spremanja te prazne ili neispravne uzorke', () => {
    expect(ocijeniMijesanoMjerenje({ ...ulaz, poteziMs: [251] }).provjere.p95Potez).toBe(false);
    expect(ocijeniMijesanoMjerenje({ ...ulaz, spremanjaMs: [1_001] }).provjere.p95Spremanje).toBe(false);
    expect(ocijeniMijesanoMjerenje({ ...ulaz, poteziMs: [] }).provjere.p95Potez).toBe(false);
    expect(ocijeniMijesanoMjerenje({ ...ulaz, poteziMs: [NaN] }).provjere.p95Potez).toBe(false);
  });

  it('broji prisutne korisnike odvojeno od prolaznih stanja igre', () => {
    const ocjena = ocijeniMijesanoMjerenje({ ...ulaz, aktivniIgraci: [100, ...Array<number>(59).fill(0)] });
    expect(ocjena.najmanjeAktivnihIgraca).toBe(0);
    expect(ocjena.provjere.igrackiKorisniciOdrzani).toBe(true);
    expect(ocijeniMijesanoMjerenje({ ...ulaz, igrackiKorisnici: Array<number>(60).fill(0) }).provjere.igrackiKorisniciOdrzani).toBe(false);
    expect(ocijeniMijesanoMjerenje({ ...ulaz, aktivniIgraci: Array<number>(60).fill(0) }).provjere.aktivnostIzmjerena).toBe(false);
    expect(ocijeniMijesanoMjerenje({ ...ulaz, aktivniIgraci: [] }).provjere.dovoljnoUzoraka).toBe(false);
    expect(ocijeniMijesanoMjerenje({ ...ulaz, stvarnoDrzanjeMs: 30_000 }).provjere.punoDrzanje).toBe(false);
  });

  it('čita stvarni k6 izvozni format i format s values, bez zamjene nedostajućih metrika nulom', () => {
    const metrics = {
      http_req_failed: { value: 0 },
      http_req_duration: { 'p(95)': 100 },
      http_reqs: { count: 20 },
      kaladont_aktivni_http_drzanje: { min: 3, max: 3 },
      kaladont_http_zahtjevi_drzanje: { count: 15 },
      checks: { value: 1 },
    };
    expect(procitajHttpSazetak({ metrics })).toMatchObject({ stopaGresaka: 0, najmanjeVusDrzanja: 3, brojZahtjevaDrzanja: 15 });
    const ugnijezdene = Object.fromEntries(Object.entries(metrics).map(([naziv, vrijednosti]) => [naziv, { values: vrijednosti }]));
    expect(procitajHttpSazetak({ metrics: ugnijezdene })).toEqual(procitajHttpSazetak({ metrics }));
    expect(() => procitajHttpSazetak({ metrics: {} })).toThrow();
    expect(() => procitajHttpSazetak({ metrics: { ...metrics, http_req_failed: { value: NaN } } })).toThrow();
  });
});