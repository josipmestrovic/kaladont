import { describe, expect, it } from 'vitest';
import { PORUKE, validirajPotez } from 'zajednicko';
import { ucitajRjecnik } from '../src/rjecnik/ucitaj.js';

describe('DOPUSTI_VLASTITA_IMENA filter u rječniku', () => {
  it('kad su imena isključena, čisto ime nije igrivo ali daje VLASTITO_IME', async () => {
    const rjecnik = await ucitajRjecnik({ dopustiVlastitaImena: false });
    const ime = 'wqxxxvlastitoime';
    const opca = 'wpxxxopcarjec';
    const kolekcijaPrije = rjecnik.brojKolekcijskihGrupa();
    const vlastitaPrije = rjecnik.brojKolekcijskihGrupaPoVrsti().get('vlastito_ime') ?? 0;

    rjecnik.primijeniUbaci({
      rijec: ime,
      prvaDva: 'wq',
      vrste: ['vlastito_ime'],
      grupe: [`vlastito_ime:${ime}`],
    });
    rjecnik.primijeniUbaci({
      rijec: opca,
      prvaDva: 'wp',
      vrste: ['imenica'],
      grupe: [`imenica:${opca}`],
      frekvencija: 10,
    });

    expect(rjecnik.jeVlastitoIme(ime)).toBe(true);
    expect(rjecnik.jePostojecaRijec(ime)).toBe(false);
    expect(rjecnik.grupeZa(ime)).toEqual([`vlastito_ime:${ime}`]);
    expect(rjecnik.postojeRijeciNa('wq')).toBe(false);
    expect(rjecnik.jePostojecaRijec(opca)).toBe(true);
    expect(rjecnik.postojeRijeciNa('wp')).toBe(true);
    // Ime ne povećava dostupnu kolekciju; opća riječ da.
    expect(rjecnik.brojKolekcijskihGrupa()).toBe(kolekcijaPrije + 1);
    expect(rjecnik.brojKolekcijskihGrupaPoVrsti().get('vlastito_ime') ?? 0).toBe(vlastitaPrije);

    const odbijeno = validirajPotez({
      rijec: ime,
      trazenaSlova: 'wq',
      iskoristeneGrupe: new Set(),
      potrosioGrupu: new Map(),
      rjecnik,
    });
    expect(odbijeno.kod).toBe('VLASTITO_IME');
    expect(odbijeno.poruka).toBe(PORUKE.vlastitoImeNijeDopusteno());

    const prihvaceno = validirajPotez({
      rijec: opca,
      trazenaSlova: 'wp',
      iskoristeneGrupe: new Set(),
      potrosioGrupu: new Map(),
      rjecnik,
    });
    expect(prihvaceno.valjano).toBe(true);

    rjecnik.primijeniUklanjanje(ime);
    rjecnik.primijeniUklanjanje(opca);
  }, 120_000);

  it('kad su imena dopuštena, čisto ime je igrivo', async () => {
    const rjecnik = await ucitajRjecnik({ dopustiVlastitaImena: true });
    const ime = 'wrxxxvlastitoime';

    rjecnik.primijeniUbaci({
      rijec: ime,
      prvaDva: 'wr',
      vrste: ['vlastito_ime'],
      grupe: [`vlastito_ime:${ime}`],
    });

    expect(rjecnik.jePostojecaRijec(ime)).toBe(true);
    expect(rjecnik.postojeRijeciNa('wr')).toBe(true);
    expect(
      validirajPotez({
        rijec: ime,
        trazenaSlova: 'wr',
        iskoristeneGrupe: new Set(),
        potrosioGrupu: new Map(),
        rjecnik,
      }).valjano,
    ).toBe(true);

    rjecnik.primijeniUklanjanje(ime);
  }, 120_000);
});
