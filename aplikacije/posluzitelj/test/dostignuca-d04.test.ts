import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { eq, inArray, or } from 'drizzle-orm';
import { baza } from '../src/baza/klijent.js';
import {
  dokaziDostignucaCinkaros,
  dokaziDostignucaJezicniDetektiv,
  dostignucaIgraca,
  igraci,
  izmjeneRjecnika,
  napredakDostignucaIgraca,
  obavijestiIgraca,
  partije,
  prijave,
  prijaveIgraca,
  rijeci,
  sudioniciPartije,
} from '../src/baza/shema.js';
import { potvrdiIspravakRjecnika, potvrdiUklanjanjeRacuna } from '../src/dostignuca/potvrde-prijava.js';
import { dovrsiTop10NakonBrisanja, obrisiRacunPoId } from '../src/racuni/brisanje.js';
import { dodajRijec } from '../src/rjecnik/administracija.js';

const igraciZaBrisanje: string[] = [];
const partijeZaBrisanje: string[] = [];
const rijeciZaBrisanje: string[] = [];
const prijaveRijeciZaBrisanje: number[] = [];
const prijaveIgracaZaBrisanje: number[] = [];

/** Samo hrvatska mala slova (bez q/w/x/y) — usklađeno s jeDopustenOblikRijeci. */
const HR_SLOVA = 'abcčćdđefghijklmnoprsštuvzž';

function slucajnaRijec(): string {
  let rijec = 'd';
  while (rijec.length < 14) rijec += HR_SLOVA[Math.floor(Math.random() * HR_SLOVA.length)]!;
  return rijec;
}

async function noviIgrac(
  nadimak: string,
  vrsta: 'registriran' | 'gost' | 'admin' = 'registriran',
  upravljac: 'covjek' | 'bot' = 'covjek',
): Promise<string> {
  const id = randomUUID();
  igraciZaBrisanje.push(id);
  await baza.insert(igraci).values({
    id,
    vrsta,
    upravljac,
    nadimak,
    email: vrsta === 'gost' ? null : `${nadimak}-${id}@example.com`,
    obrisanAt: null,
  });
  return id;
}

async function novaPartija(status: 'u_tijeku' | 'zavrsena' = 'u_tijeku', kraj?: Date): Promise<string> {
  const id = randomUUID();
  partijeZaBrisanje.push(id);
  await baza.insert(partije).values({
    id,
    mod: 'cetiri_igraca',
    status,
    pocetak: kraj ? new Date(kraj.getTime() - 1000) : new Date(),
    kraj: kraj ?? null,
  });
  return id;
}

async function prijavaRijeci(
  partijaId: string,
  igracId: string,
  tip: 'za_dodavanje' | 'za_brisanje',
  rijec: string,
): Promise<number> {
  const [red] = await baza.insert(prijave).values({
    partijaId,
    igracId,
    tip,
    rijec,
    poruka: 'test',
  }).returning({ id: prijave.id });
  if (!red) throw new Error('Prijava riječi nije upisana.');
  prijaveRijeciZaBrisanje.push(red.id);
  return red.id;
}

async function prijavaIgraca(
  partijaId: string,
  prijaviteljId: string,
  prijavljeniIgracId: string,
  razlog: 'pogrdan_nadimak' | 'neprimjereno_ponasanje' | 'drugo' = 'pogrdan_nadimak',
): Promise<number> {
  const [red] = await baza.insert(prijaveIgraca).values({
    partijaId,
    prijaviteljId,
    prijavljeniIgracId,
    razlog,
    poruka: 'test',
  }).returning({ id: prijaveIgraca.id });
  if (!red) throw new Error('Prijava igrača nije upisana.');
  prijaveIgracaZaBrisanje.push(red.id);
  return red.id;
}

async function brojac(igracId: string) {
  const [red] = await baza.select({
    jezicniDetektivi: napredakDostignucaIgraca.jezicniDetektivi,
    cinkarosi: napredakDostignucaIgraca.cinkarosi,
  }).from(napredakDostignucaIgraca).where(eq(napredakDostignucaIgraca.igracId, igracId));
  return red ?? { jezicniDetektivi: 0, cinkarosi: 0 };
}

async function brojDokazaRijeci(igracId: string): Promise<number> {
  const redovi = await baza.select({ rijec: dokaziDostignucaJezicniDetektiv.normaliziranaRijec })
    .from(dokaziDostignucaJezicniDetektiv)
    .where(eq(dokaziDostignucaJezicniDetektiv.igracId, igracId));
  return redovi.length;
}

describe('dostignuća D04 potvrđene prijave', () => {
  afterEach(async () => {
    if (prijaveRijeciZaBrisanje.length > 0) {
      await baza.update(prijave).set({ izmjenaRjecnikaId: null }).where(inArray(prijave.id, prijaveRijeciZaBrisanje));
    }
    if (rijeciZaBrisanje.length > 0) {
      await baza.delete(izmjeneRjecnika).where(inArray(izmjeneRjecnika.rijec, rijeciZaBrisanje));
      await baza.delete(rijeci).where(inArray(rijeci.rijec, rijeciZaBrisanje));
      rijeciZaBrisanje.length = 0;
    }
    if (prijaveRijeciZaBrisanje.length > 0) {
      await baza.delete(prijave).where(inArray(prijave.id, prijaveRijeciZaBrisanje));
      prijaveRijeciZaBrisanje.length = 0;
    }
    if (prijaveIgracaZaBrisanje.length > 0) {
      await baza.delete(prijaveIgraca).where(inArray(prijaveIgraca.id, prijaveIgracaZaBrisanje));
      prijaveIgracaZaBrisanje.length = 0;
    }
    if (igraciZaBrisanje.length > 0) {
      await baza.delete(dokaziDostignucaJezicniDetektiv).where(inArray(dokaziDostignucaJezicniDetektiv.igracId, igraciZaBrisanje));
      await baza.delete(dokaziDostignucaCinkaros).where(or(
        inArray(dokaziDostignucaCinkaros.igracId, igraciZaBrisanje),
        inArray(dokaziDostignucaCinkaros.prijavljeniIgracId, igraciZaBrisanje),
      ));
      await baza.delete(obavijestiIgraca).where(inArray(obavijestiIgraca.igracId, igraciZaBrisanje));
      await baza.delete(dostignucaIgraca).where(inArray(dostignucaIgraca.igracId, igraciZaBrisanje));
      await baza.delete(napredakDostignucaIgraca).where(inArray(napredakDostignucaIgraca.igracId, igraciZaBrisanje));
    }
    if (partijeZaBrisanje.length > 0) {
      await baza.delete(sudioniciPartije).where(inArray(sudioniciPartije.partijaId, partijeZaBrisanje));
      await baza.delete(partije).where(inArray(partije.id, partijeZaBrisanje));
      partijeZaBrisanje.length = 0;
    }
    if (igraciZaBrisanje.length > 0) {
      await baza.delete(igraci).where(inArray(igraci.id, igraciZaBrisanje));
      igraciZaBrisanje.length = 0;
    }
  });

  it('sama prijava, odbijanje, generički riješeno i ručni unos ne daju detektiva', async () => {
    const adminId = await noviIgrac('Moderator');
    const igracId = await noviIgrac('Prijavitelj');
    const partijaId = await novaPartija();
    const rijec = slucajnaRijec();
    rijeciZaBrisanje.push(rijec);
    const prijavaId = await prijavaRijeci(partijaId, igracId, 'za_dodavanje', rijec);
    expect(await brojDokazaRijeci(igracId)).toBe(0);

    await baza.update(prijave).set({ status: 'rijesena', napomenaAdmina: 'dismiss', rijesioId: adminId }).where(eq(prijave.id, prijavaId));
    expect(await brojDokazaRijeci(igracId)).toBe(0);

    const druga = await prijavaRijeci(partijaId, igracId, 'za_dodavanje', `${rijec}b`);
    rijeciZaBrisanje.push(`${rijec}b`);
    await baza.update(prijave).set({ status: 'rijesena', napomenaAdmina: 'pregledano', rijesioId: adminId }).where(eq(prijave.id, druga));
    expect(await brojDokazaRijeci(igracId)).toBe(0);

    await dodajRijec(rijec, 'ručni unos', adminId, 'imenica');
    expect(await brojDokazaRijeci(igracId)).toBe(0);
    const potvrda = await potvrdiIspravakRjecnika({ prijavaId, adminId, smjer: 'dodaj' });
    expect(potvrda.ok && potvrda.promjena).toBe('nema');
    expect(await brojac(igracId)).toMatchObject({ jezicniDetektivi: 0 });
  });

  it('dodavanje, reaktivacija i deaktivacija daju po jedan doprinos, a no-op ne', async () => {
    const adminId = await noviIgrac('Moderator');
    const igracId = await noviIgrac('Detektiv');
    const partijaId = await novaPartija();
    const nova = slucajnaRijec();
    const neaktivna = slucajnaRijec();
    const aktivna = slucajnaRijec();
    const zaBrisanje = slucajnaRijec();
    const vecNeaktivna = slucajnaRijec();
    rijeciZaBrisanje.push(nova, neaktivna, aktivna, zaBrisanje, vecNeaktivna);

    await baza.insert(rijeci).values([
      { rijec: neaktivna, prvaDva: neaktivna.slice(0, 2), zadnjaDva: neaktivna.slice(-2), aktivna: false },
      { rijec: aktivna, prvaDva: aktivna.slice(0, 2), zadnjaDva: aktivna.slice(-2), aktivna: true },
      { rijec: zaBrisanje, prvaDva: zaBrisanje.slice(0, 2), zadnjaDva: zaBrisanje.slice(-2), aktivna: true },
      { rijec: vecNeaktivna, prvaDva: vecNeaktivna.slice(0, 2), zadnjaDva: vecNeaktivna.slice(-2), aktivna: false },
    ]);

    const idNove = await prijavaRijeci(partijaId, igracId, 'za_dodavanje', nova.toUpperCase());
    const dodana = await potvrdiIspravakRjecnika({ prijavaId: idNove, adminId, smjer: 'dodaj' });
    expect(dodana).toMatchObject({ ok: true, promjena: 'dodana', rijec: nova });
    expect((await brojac(igracId)).jezicniDetektivi).toBe(1);

    const idNeaktivne = await prijavaRijeci(partijaId, igracId, 'za_dodavanje', neaktivna);
    const reaktivirana = await potvrdiIspravakRjecnika({ prijavaId: idNeaktivne, adminId, smjer: 'dodaj' });
    expect(reaktivirana).toMatchObject({ ok: true, promjena: 'reaktivirana' });
    expect((await brojac(igracId)).jezicniDetektivi).toBe(2);

    const idAktivne = await prijavaRijeci(partijaId, igracId, 'za_dodavanje', aktivna);
    const bezDodavanja = await potvrdiIspravakRjecnika({ prijavaId: idAktivne, adminId, smjer: 'dodaj' });
    expect(bezDodavanja).toMatchObject({ ok: true, promjena: 'nema', obavijesti: [] });
    const [aktivnaPrijava] = await baza.select({ akcija: prijave.potvrdenaAkcija, napomena: prijave.napomenaAdmina }).from(prijave).where(eq(prijave.id, idAktivne));
    expect(aktivnaPrijava).toMatchObject({ akcija: null, napomena: 'nema_promjene' });

    const idBrisanja = await prijavaRijeci(partijaId, igracId, 'za_brisanje', zaBrisanje);
    const deaktivirana = await potvrdiIspravakRjecnika({ prijavaId: idBrisanja, adminId, smjer: 'deaktiviraj' });
    expect(deaktivirana).toMatchObject({ ok: true, promjena: 'deaktivirana' });
    expect((await brojac(igracId)).jezicniDetektivi).toBe(3);

    const idVecNeaktivne = await prijavaRijeci(partijaId, igracId, 'za_brisanje', vecNeaktivna);
    const bezBrisanja = await potvrdiIspravakRjecnika({ prijavaId: idVecNeaktivne, adminId, smjer: 'deaktiviraj' });
    expect(bezBrisanja).toMatchObject({ ok: true, promjena: 'nema' });
    expect((await brojac(igracId)).jezicniDetektivi).toBe(3);

    const ponovo = await potvrdiIspravakRjecnika({ prijavaId: idNove, adminId, smjer: 'dodaj' });
    expect(ponovo).toMatchObject({ ok: true, promjena: 'nema', obavijesti: [] });
    expect(await brojDokazaRijeci(igracId)).toBe(3);
  });

  it('isti prijavitelj i ista riječ broje se jednom, a različiti prijavitelji svaki dobiju svoj doprinos', async () => {
    const adminId = await noviIgrac('Moderator');
    const prvi = await noviIgrac('Prvi');
    const drugi = await noviIgrac('Drugi');
    const gost = await noviIgrac('Gost', 'gost');
    const obrisani = await noviIgrac('Obrisani');
    await baza.update(igraci).set({ obrisanAt: new Date() }).where(eq(igraci.id, obrisani));
    const partijaId = await novaPartija();
    const rijec = slucajnaRijec();
    rijeciZaBrisanje.push(rijec);

    const idPrvog = await prijavaRijeci(partijaId, prvi, 'za_dodavanje', rijec);
    const drugaPartija = await novaPartija();
    await prijavaRijeci(drugaPartija, prvi, 'za_dodavanje', rijec.toUpperCase());
    await prijavaRijeci(partijaId, drugi, 'za_dodavanje', `  ${rijec}  `);
    await prijavaRijeci(partijaId, gost, 'za_dodavanje', rijec);
    await prijavaRijeci(partijaId, obrisani, 'za_dodavanje', rijec);

    const rezultat = await potvrdiIspravakRjecnika({ prijavaId: idPrvog, adminId, smjer: 'dodaj' });
    expect(rezultat.ok && rezultat.obavijesti.map((stavka) => stavka.igracId).sort()).toEqual([drugi, prvi].sort());
    expect((await brojac(prvi)).jezicniDetektivi).toBe(1);
    expect((await brojac(drugi)).jezicniDetektivi).toBe(1);
    expect(await brojDokazaRijeci(gost)).toBe(0);
    expect(await brojDokazaRijeci(obrisani)).toBe(0);
    expect(await brojDokazaRijeci(prvi)).toBe(1);

    const [oznaka] = await baza.select({ akcija: prijave.potvrdenaAkcija }).from(prijave).where(eq(prijave.igracId, drugi));
    expect(oznaka?.akcija).toBe('dodana');
  });

  it('ponovno uklanjanje iste riječi ne daje drugi doprinos', async () => {
    const adminId = await noviIgrac('Moderator');
    const igracId = await noviIgrac('Jednom');
    const partijaId = await novaPartija();
    const rijec = slucajnaRijec();
    rijeciZaBrisanje.push(rijec);
    const dodavanje = await prijavaRijeci(partijaId, igracId, 'za_dodavanje', rijec);
    await potvrdiIspravakRjecnika({ prijavaId: dodavanje, adminId, smjer: 'dodaj' });
    const brisanje = await prijavaRijeci(await novaPartija(), igracId, 'za_brisanje', rijec);
    const uklonjena = await potvrdiIspravakRjecnika({ prijavaId: brisanje, adminId, smjer: 'deaktiviraj' });
    expect(uklonjena).toMatchObject({ ok: true, promjena: 'deaktivirana' });
    expect((await brojac(igracId)).jezicniDetektivi).toBe(1);
  });

  it('pogrdan nadimak i soft-delete daju Cinkaroša svakom kvalificiranom prijavitelju jednom po računu', async () => {
    const adminId = await noviIgrac('Moderator');
    const prvi = await noviIgrac('Prvi');
    const drugi = await noviIgrac('Drugi');
    const gost = await noviIgrac('Gost', 'gost');
    const meta = `Glupan${slucajnaRijec()}`;
    const prijavljeni = await noviIgrac(meta);
    const partijaId = await novaPartija();
    const idPrvog = await prijavaIgraca(partijaId, prvi, prijavljeni);
    await prijavaIgraca(await novaPartija(), prvi, prijavljeni);
    await prijavaIgraca(partijaId, drugi, prijavljeni);
    await prijavaIgraca(partijaId, gost, prijavljeni);

    const rezultat = await potvrdiUklanjanjeRacuna({ prijavaId: idPrvog, adminId });
    expect(rezultat).toMatchObject({ ok: true, ishod: 'obrisan' });
    expect((await brojac(prvi)).cinkarosi).toBe(1);
    expect((await brojac(drugi)).cinkarosi).toBe(1);
    expect((await brojac(gost)).cinkarosi).toBe(0);

    const obavijesti = await baza.select().from(obavijestiIgraca).where(eq(obavijestiIgraca.dostignuceId, 'cinkaros'));
    const nase = obavijesti.filter((red) => red.igracId === prvi || red.igracId === drugi);
    expect(nase.length).toBeGreaterThan(0);
    for (const red of nase) {
      const tekst = JSON.stringify(red);
      expect(tekst).not.toContain(meta);
      expect(tekst).not.toContain(prvi === red.igracId ? drugi : prvi);
      expect(red.kontekst).toBeNull();
    }

    const dokazPrijavitelja = await baza.select().from(dokaziDostignucaCinkaros).where(eq(dokaziDostignucaCinkaros.igracId, prvi));
    expect(dokazPrijavitelja).toHaveLength(1);

    const ponovo = await potvrdiUklanjanjeRacuna({ prijavaId: idPrvog, adminId });
    expect(ponovo).toMatchObject({ ok: true, ishod: 'vec-obrisan', obavijesti: [] });
    expect((await brojac(prvi)).cinkarosi).toBe(1);
    expect((await brojac(drugi)).cinkarosi).toBe(1);
  });

  it('drugi razlog, dobrovoljno brisanje, zaštićen račun i samoprijava ne daju Cinkaroša', async () => {
    const adminId = await noviIgrac('Moderator');
    const prijavitelj = await noviIgrac('Prijavitelj');
    const drugiRazlog = await noviIgrac('DrugiRazlog');
    const dobrovoljni = await noviIgrac('Dobrovoljni');
    const zasticeni = await noviIgrac('AdminMeta', 'admin');
    const bot = await noviIgrac('BotMeta', 'registriran', 'bot');
    const partijaId = await novaPartija();

    const idDrugog = await prijavaIgraca(partijaId, prijavitelj, drugiRazlog, 'neprimjereno_ponasanje');
    const obrisan = await potvrdiUklanjanjeRacuna({ prijavaId: idDrugog, adminId });
    expect(obrisan).toMatchObject({ ok: true, ishod: 'obrisan', obavijesti: [] });
    expect((await brojac(prijavitelj)).cinkarosi).toBe(0);
    const [oznaka] = await baza.select({ akcija: prijaveIgraca.potvrdenaAkcija, razlog: prijaveIgraca.potvrdeniRazlog })
      .from(prijaveIgraca).where(eq(prijaveIgraca.id, idDrugog));
    expect(oznaka).toMatchObject({ akcija: 'soft_brisanje', razlog: 'neprimjereno_ponasanje' });

    const idDobrovoljnog = await prijavaIgraca(await novaPartija(), prijavitelj, dobrovoljni);
    expect(await obrisiRacunPoId(dobrovoljni)).toBe('obrisan');
    const vec = await potvrdiUklanjanjeRacuna({ prijavaId: idDobrovoljnog, adminId });
    expect(vec).toMatchObject({ ok: true, ishod: 'vec-obrisan', obavijesti: [] });
    expect((await brojac(prijavitelj)).cinkarosi).toBe(0);
    const [bezAkcije] = await baza.select({ akcija: prijaveIgraca.potvrdenaAkcija, napomena: prijaveIgraca.napomenaAdmina })
      .from(prijaveIgraca).where(eq(prijaveIgraca.id, idDobrovoljnog));
    expect(bezAkcije).toMatchObject({ akcija: null, napomena: 'racun_vec_obrisan' });

    const idAdmina = await prijavaIgraca(partijaId, prijavitelj, zasticeni);
    const adminIshod = await potvrdiUklanjanjeRacuna({ prijavaId: idAdmina, adminId });
    expect(adminIshod).toMatchObject({ ok: false, status: 400 });
    const idBota = await prijavaIgraca(partijaId, prijavitelj, bot);
    expect(await potvrdiUklanjanjeRacuna({ prijavaId: idBota, adminId })).toMatchObject({ ok: false, status: 400 });
    const [adminJos] = await baza.select({ obrisanAt: igraci.obrisanAt }).from(igraci).where(eq(igraci.id, zasticeni));
    const [botJos] = await baza.select({ obrisanAt: igraci.obrisanAt }).from(igraci).where(eq(igraci.id, bot));
    expect(adminJos?.obrisanAt).toBeNull();
    expect(botJos?.obrisanAt).toBeNull();

    const idSebe = await prijavaIgraca(await novaPartija(), prijavitelj, prijavitelj);
    expect(await potvrdiUklanjanjeRacuna({ prijavaId: idSebe, adminId })).toMatchObject({ ok: false, status: 400 });
    expect((await brojac(prijavitelj)).cinkarosi).toBe(0);
    expect(await obrisiRacunPoId(randomUUID())).toBe('nije-pronaden');
  });

  it('brisanje prijavljenog računa čuva nagradu prijavitelja, a brisanje prijavitelja briše njegove dokaze', async () => {
    const adminId = await noviIgrac('Moderator');
    const prijavitelj = await noviIgrac('Prijavitelj');
    const meta = await noviIgrac('Meta');
    const id = await prijavaIgraca(await novaPartija(), prijavitelj, meta);
    expect(await potvrdiUklanjanjeRacuna({ prijavaId: id, adminId })).toMatchObject({ ok: true, ishod: 'obrisan' });
    expect((await brojac(prijavitelj)).cinkarosi).toBe(1);
    const prije = await baza.select().from(dokaziDostignucaCinkaros).where(eq(dokaziDostignucaCinkaros.prijavljeniIgracId, meta));
    expect(prije).toHaveLength(1);

    expect(await obrisiRacunPoId(prijavitelj)).toBe('obrisan');
    const poslije = await baza.select().from(dokaziDostignucaJezicniDetektiv).where(eq(dokaziDostignucaJezicniDetektiv.igracId, prijavitelj));
    const cinkaros = await baza.select().from(dokaziDostignucaCinkaros).where(eq(dokaziDostignucaCinkaros.igracId, prijavitelj));
    expect(poslije).toHaveLength(0);
    expect(cinkaros).toHaveLength(0);
  });

  it('potvrđeno brisanje računa s javnom igrom traži osvježenje ljestvice', async () => {
    const adminId = await noviIgrac('Moderator');
    const prijavitelj = await noviIgrac('Prijavitelj');
    const bezIgara = await noviIgrac('BezIgara');
    const sIgrom = await noviIgrac('SIgrom');
    const tiha = await prijavaIgraca(await novaPartija(), prijavitelj, bezIgara);
    const tihiIshod = await potvrdiUklanjanjeRacuna({ prijavaId: tiha, adminId });
    expect(tihiIshod).toMatchObject({ ok: true, ishod: 'obrisan', osvjeziLjestvicu: false });

    const partijaId = await novaPartija('zavrsena', new Date());
    await baza.insert(sudioniciPartije).values({ partijaId, igracId: sIgrom, sjedalo: 0, plasman: 1, bodovi: 8 });
    const glasna = await prijavaIgraca(await novaPartija(), prijavitelj, sIgrom);
    const glasniIshod = await potvrdiUklanjanjeRacuna({ prijavaId: glasna, adminId });
    expect(glasniIshod).toMatchObject({ ok: true, ishod: 'obrisan', osvjeziLjestvicu: true });
    await dovrsiTop10NakonBrisanja();
    expect((await brojac(prijavitelj)).cinkarosi).toBe(2);
  });
});
