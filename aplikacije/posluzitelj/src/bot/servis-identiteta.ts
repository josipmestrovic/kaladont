import { randomUUID, randomInt } from 'node:crypto';
import { and, count, eq, inArray, notInArray, sql } from 'drizzle-orm';
import {
  nasumicnaKonfiguracijaAvatara,
  REZERVNI_NADIMAK_JAVNOG_FONDA_V5,
  UZORAK_NADIMKA,
  MAKSIMALNA_DULJINA_NADIMKA,
  MINIMALNA_DULJINA_NADIMKA,
  ZADANI_AVATAR_CONFIG,
} from 'zajednicko';
import { baza } from '../baza/klijent.js';
import { botovi, izmjeneBotova, igraci, operativnePrimjene, postavkeBotova } from '../baza/shema.js';
import {
  BROJ_GOSTIJU_FONDA_V5,
  CILJ_AKTIVNIH_FONDA_V5,
  NADIMCI_POCETNOG_FONDA_V5,
  ODOBRENI_NADIMCI_NOVIH_BOTOVA,
} from './nadimci.js';
import { ZADANA_KONFIGURACIJA_BOTA } from './konfiguracija-bota.js';
import { parsajSpremljenuKonfiguraciju } from './trajne-postavke.js';

export const MAKSIMALNO_AKTIVNIH_BOTOVA = 100;
const ZAKLJUCAVANJE_FONDA_BOTOVA = 1_784_120_339;
const PREFIKS_FONDA_V5 = 'bot-v5-';
export const KLJUC_OPERATIVNE_PRIMJENE_FONDA_V5 = 'fond-botova-v5';
const VERZIJA_PROFILA_IDENTITETA_V5 = 5;

export async function dohvatiLimitAktivnihBotova(): Promise<number> {
  const [zapis] = await baza.select({ konfiguracija: postavkeBotova.konfiguracija }).from(postavkeBotova).where(eq(postavkeBotova.id, 1));
  return zapis
    ? parsajSpremljenuKonfiguraciju(zapis.konfiguracija).maksimalnoAktivnihBotova
    : ZADANA_KONFIGURACIJA_BOTA.maksimalnoAktivnihBotova;
}

export interface UlazNovogBota {
  kljucSeeda: string;
  tip: 'imenovani' | 'gost';
  nadimak?: string;
  pocetnoSlovo?: 'malo' | 'veliko';
}

export interface RezultatStvaranjaBotova {
  stvoreno: { igracId: string; kljucSeeda: string; tip: 'imenovani' | 'gost'; nadimak: string }[];
  postojalo: number;
  aktivnoPrije: number;
  aktivnoPoslije: number;
}

export async function jeFondBotovaV5Primijenjen(): Promise<boolean> {
  const [red] = await baza.select({ kljuc: operativnePrimjene.kljuc })
    .from(operativnePrimjene)
    .where(eq(operativnePrimjene.kljuc, KLJUC_OPERATIVNE_PRIMJENE_FONDA_V5))
    .limit(1);
  return Boolean(red);
}

export async function stvoriBotovePoKljucima(ulazi: readonly UlazNovogBota[], adminId: string | null = null, aktivniLimit = MAKSIMALNO_AKTIVNIH_BOTOVA): Promise<RezultatStvaranjaBotova> {
  if (ulazi.length > MAKSIMALNO_AKTIVNIH_BOTOVA) throw new Error('Jedan zahtjev može stvoriti najviše 100 botova.');
  if (!Number.isInteger(aktivniLimit) || aktivniLimit < 1 || aktivniLimit > MAKSIMALNO_AKTIVNIH_BOTOVA) throw new Error('Limit aktivnih botova mora biti od 1 do 100.');
  if (new Set(ulazi.map((ulaz) => ulaz.kljucSeeda)).size !== ulazi.length) throw new Error('Ključevi botova u zahtjevu moraju biti jedinstveni.');
  for (const ulaz of ulazi) {
    if (!/^[a-z0-9][a-z0-9-]{2,79}$/.test(ulaz.kljucSeeda)) throw new Error('Neispravan verzionirani ključ bota.');
    if (ulaz.tip === 'gost') throw new Error('Novi gost-botovi nisu dopušteni.');
    if (ulaz.tip !== 'imenovani') throw new Error('Nepoznata vrsta prezentacije bota.');
    if (ulaz.nadimak && (!UZORAK_NADIMKA.test(ulaz.nadimak) || ulaz.nadimak.length < MINIMALNA_DULJINA_NADIMKA || ulaz.nadimak.length > MAKSIMALNA_DULJINA_NADIMKA)) throw new Error('Nadimak ne prolazi provjeru formata.');
    if (ulaz.nadimak && !jeOdobrenNadimakNovogBota(ulaz.nadimak)) throw new Error(`Nadimak nije u odobrenom katalogu: ${ulaz.nadimak}`);
  }

  return baza.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${ZAKLJUCAVANJE_FONDA_BOTOVA})`);
    const postojeci = ulazi.length
      ? await tx.select({ kljucSeeda: botovi.kljucSeeda }).from(botovi).where(inArray(botovi.kljucSeeda, ulazi.map((ulaz) => ulaz.kljucSeeda)))
      : [];
    const postojeciKljuci = new Set(postojeci.map((redak) => redak.kljucSeeda));
    const novi = ulazi.filter((ulaz) => !postojeciKljuci.has(ulaz.kljucSeeda));
    const [brojAktivnih] = await tx.select({ broj: count() }).from(botovi).where(eq(botovi.aktivan, true));
    const aktivnoPrije = Number(brojAktivnih?.broj ?? 0);
    if (aktivnoPrije + novi.length > aktivniLimit) throw new Error(`Fond može imati najviše ${aktivniLimit} aktivnih botova prema trenutačnoj postavci.`);

    const stvoreno: RezultatStvaranjaBotova['stvoreno'] = [];
    const zauzetiNadimci = new Set<string>();
    for (const ulaz of novi) stvoreno.push(await stvoriBotaUTransakciji(tx, ulaz, adminId, zauzetiNadimci));
    return { stvoreno, postojalo: postojeciKljuci.size, aktivnoPrije, aktivnoPoslije: aktivnoPrije + stvoreno.length };
  }, { isolationLevel: 'serializable' });
}

export async function stvoriNoveBotove(broj: number, tip: 'imenovani' | 'gost', adminId: string, aktivniLimit = MAKSIMALNO_AKTIVNIH_BOTOVA): Promise<RezultatStvaranjaBotova> {
  if (tip === 'gost') throw new Error('Novi gost-botovi nisu dopušteni.');
  if (!Number.isInteger(broj) || broj < 1 || broj > 100) throw new Error('Broj novih botova mora biti cijeli broj od 1 do 100.');
  const serija = randomUUID();
  return stvoriBotovePoKljucima(Array.from({ length: broj }, (_, indeks) => ({
    kljucSeeda: `bot-admin-${tip}-${serija}-${String(indeks + 1).padStart(3, '0')}`,
    tip: 'imenovani',
  })), adminId, aktivniLimit);
}

export function stavkeZamjeneFondaBotova(): UlazNovogBota[] {
  return [
    ...NADIMCI_POCETNOG_FONDA_V5.map((stavka, indeks) => ({
      kljucSeeda: `${PREFIKS_FONDA_V5}imenovani-${String(indeks + 1).padStart(3, '0')}`,
      tip: 'imenovani' as const,
      nadimak: stavka.nadimak,
      pocetnoSlovo: stavka.pocetnoSlovo,
    })),
    ...Array.from({ length: BROJ_GOSTIJU_FONDA_V5 }, (_, indeks) => ({
      kljucSeeda: `${PREFIKS_FONDA_V5}gost-${String(indeks + 1).padStart(3, '0')}`,
      tip: 'gost' as const,
    })),
  ];
}

export async function pregledZamjeneFondaBotova() {
  const [aktivni] = await baza.select({ broj: count() }).from(botovi).where(eq(botovi.aktivan, true));
  const ciljevi = stavkeZamjeneFondaBotova();
  const ciljniKljuci = new Set(ciljevi.map((bot) => bot.kljucSeeda));
  const postojeV5 = await baza.select({ kljucSeeda: botovi.kljucSeeda, tip: botovi.tip, aktivan: botovi.aktivan }).from(botovi).where(sql`${botovi.kljucSeeda} like ${`${PREFIKS_FONDA_V5}%`}`);
  const kljucevi = new Map(postojeV5.map((bot) => [bot.kljucSeeda, bot]));
  const stariAktivni = await baza.select({ kljucSeeda: botovi.kljucSeeda, nadimak: igraci.nadimak })
    .from(botovi).innerJoin(igraci, eq(igraci.id, botovi.igracId))
    .where(and(eq(botovi.aktivan, true), notInArray(botovi.kljucSeeda, [...ciljniKljuci])))
    .orderBy(botovi.kljucSeeda);
  const nedostajuciCiljevi = ciljevi.filter((bot) => !kljucevi.has(bot.kljucSeeda));
  const zeljeniNadimci = ciljevi.filter((bot) => bot.tip === 'imenovani' && bot.nadimak).map((bot) => bot.nadimak!);
  const zauzetiZeljeni = zeljeniNadimci.length
    ? await baza.select({ nadimak: igraci.nadimak, igracId: igraci.id, upravljac: igraci.upravljac, kljucSeeda: botovi.kljucSeeda })
      .from(igraci)
      .leftJoin(botovi, eq(botovi.igracId, igraci.id))
      .where(sql`lower(${igraci.nadimak}) in (${sql.join(zeljeniNadimci.map((nadimak) => sql`${nadimak.toLocaleLowerCase('hr-HR')}`), sql`, `)})`)
    : [];
  const ciljniNadimciLower = new Set(zeljeniNadimci.map((n) => n.toLocaleLowerCase('hr-HR')));
  const kolizije = zauzetiZeljeni
    .filter((redak) => {
      if (redak.kljucSeeda && ciljniKljuci.has(redak.kljucSeeda)) return false;
      return ciljniNadimciLower.has(redak.nadimak.toLocaleLowerCase('hr-HR'));
    })
    .map((redak) => ({
      nadimak: redak.nadimak,
      igracId: redak.igracId,
      upravljac: redak.upravljac,
      kljucSeeda: redak.kljucSeeda,
    }));
  const rezervniZauzet = await baza.select({ nadimak: igraci.nadimak }).from(igraci)
    .where(sql`lower(${igraci.nadimak}) = ${REZERVNI_NADIMAK_JAVNOG_FONDA_V5.toLocaleLowerCase('hr-HR')}`)
    .limit(1);
  const planZamjenaKolizija = kolizije.map((kolizija) => ({
    zeljeni: kolizija.nadimak,
    zamjena: rezervniZauzet.length === 0 ? REZERVNI_NADIMAK_JAVNOG_FONDA_V5 : null,
  }));
  const primijenjen = await jeFondBotovaV5Primijenjen();
  return {
    nacin: 'preview',
    primijenjenFondV5: primijenjen,
    aktivnoPrije: Number(aktivni?.broj ?? 0),
    deaktiviratCeAktivnihStarih: stariAktivni.length,
    postojeV5: postojeV5.length,
    nedostajeImenovanih: ciljevi.filter((bot) => bot.tip === 'imenovani' && !kljucevi.has(bot.kljucSeeda)).length,
    nedostajeGostiju: ciljevi.filter((bot) => bot.tip === 'gost' && !kljucevi.has(bot.kljucSeeda)).length,
    zauzetaZeljenaImena: kolizije.map((k) => k.nadimak),
    kolizije,
    planZamjenaKolizija,
    mapaZamjene: stariAktivni.map((stari, indeks) => ({ stari, novi: nedostajuciCiljevi[indeks] ?? null })),
    ciljniKljuci: ciljevi.map(({ kljucSeeda, tip, nadimak }) => ({ kljucSeeda, tip, nadimak: nadimak ?? null })),
    ciljAktivnih: CILJ_AKTIVNIH_FONDA_V5,
    mijenjaStatistiku: false,
  };
}

export async function zamijeniFondBotova(adminId: string | null = null, aktivniLimit = MAKSIMALNO_AKTIVNIH_BOTOVA) {
  if (aktivniLimit < CILJ_AKTIVNIH_FONDA_V5) throw new Error(`Aktivni limit mora biti barem ${CILJ_AKTIVNIH_FONDA_V5} za zamjenski fond v5.`);
  if (await jeFondBotovaV5Primijenjen()) {
    const [aktivni] = await baza.select({ broj: count() }).from(botovi).where(eq(botovi.aktivan, true));
    return {
      ciljAktivnih: CILJ_AKTIVNIH_FONDA_V5,
      stvoreno: 0,
      aktivirano: 0,
      deaktivirano: 0,
      aktivnoPoslije: Number(aktivni?.broj ?? 0),
      preskoceno: true as const,
      razlog: 'fond-botova-v5 već primijenjen',
    };
  }

  const pregled = await pregledZamjeneFondaBotova();
  const neresene = pregled.planZamjenaKolizija.filter((p) => p.zamjena == null);
  if (neresene.length > 0) {
    throw new Error(`Kolizija nadimaka bez odobrene zamjene: ${neresene.map((p) => p.zeljeni).join(', ')}`);
  }
  if (pregled.planZamjenaKolizija.filter((p) => p.zamjena === REZERVNI_NADIMAK_JAVNOG_FONDA_V5).length > 1) {
    throw new Error('Više kolizija zahtijeva isti rezervni nadimak BOTZILLA — zamjena zaustavljena.');
  }

  const ciljevi = stavkeZamjeneFondaBotova().map((cilj) => {
    const kolizija = pregled.planZamjenaKolizija.find((p) => p.zeljeni.toLocaleLowerCase('hr-HR') === cilj.nadimak?.toLocaleLowerCase('hr-HR'));
    if (kolizija?.zamjena) return { ...cilj, nadimak: kolizija.zamjena };
    return cilj;
  });
  if (new Set(ciljevi.map((c) => c.nadimak!.toLocaleLowerCase('hr-HR'))).size !== ciljevi.length) {
    throw new Error('Nakon rezolucije kolizija nadimci fonda V5 nisu jedinstveni.');
  }

  return baza.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${ZAKLJUCAVANJE_FONDA_BOTOVA})`);
    const [vecPrimijenjen] = await tx.select({ kljuc: operativnePrimjene.kljuc })
      .from(operativnePrimjene)
      .where(eq(operativnePrimjene.kljuc, KLJUC_OPERATIVNE_PRIMJENE_FONDA_V5))
      .for('update');
    if (vecPrimijenjen) {
      const [aktivni] = await tx.select({ broj: count() }).from(botovi).where(eq(botovi.aktivan, true));
      return {
        ciljAktivnih: CILJ_AKTIVNIH_FONDA_V5,
        stvoreno: 0,
        aktivirano: 0,
        deaktivirano: 0,
        aktivnoPoslije: Number(aktivni?.broj ?? 0),
        preskoceno: true as const,
        razlog: 'fond-botova-v5 već primijenjen',
      };
    }

    const postojeV5 = await tx.select({ igracId: botovi.igracId, kljucSeeda: botovi.kljucSeeda, tip: botovi.tip, aktivan: botovi.aktivan, nadimak: igraci.nadimak })
      .from(botovi).innerJoin(igraci, eq(igraci.id, botovi.igracId)).where(sql`${botovi.kljucSeeda} like ${`${PREFIKS_FONDA_V5}%`}`).for('update');
    const poKljucu = new Map(postojeV5.map((bot) => [bot.kljucSeeda, bot]));
    const ciljniKljuci = new Set(ciljevi.map((bot) => bot.kljucSeeda));
    for (const cilj of ciljevi) {
      const postoje = poKljucu.get(cilj.kljucSeeda);
      if (postoje && postoje.tip !== cilj.tip) throw new Error(`Ključ ${cilj.kljucSeeda} već pripada drugom tipu bota.`);
    }
    const sviAktivni = await tx.select({ igracId: botovi.igracId, kljucSeeda: botovi.kljucSeeda })
      .from(botovi).where(eq(botovi.aktivan, true)).for('update');
    const zauzetiNadimci = new Set(postojeV5.filter((bot) => bot.tip === 'imenovani').map((bot) => bot.nadimak.toLocaleLowerCase('hr-HR')));
    let deaktivirano = 0;
    for (const bot of sviAktivni) {
      if (ciljniKljuci.has(bot.kljucSeeda)) continue;
      await tx.update(botovi).set({ aktivan: false }).where(eq(botovi.igracId, bot.igracId));
      await tx.insert(izmjeneBotova).values({ botId: bot.igracId, kljucSeeda: bot.kljucSeeda, akcija: 'deaktiviran', aktivanPrije: true, aktivanPoslije: false, adminId });
      deaktivirano += 1;
    }
    let stvoreno = 0;
    let aktivirano = 0;
    for (const cilj of ciljevi) {
      const postoje = poKljucu.get(cilj.kljucSeeda);
      if (!postoje) {
        await stvoriBotaUTransakciji(tx, cilj, adminId, zauzetiNadimci, { strogiNadimak: true });
        stvoreno += 1;
      } else if (!postoje.aktivan) {
        await tx.update(botovi).set({ aktivan: true }).where(eq(botovi.igracId, postoje.igracId));
        await tx.insert(izmjeneBotova).values({ botId: postoje.igracId, kljucSeeda: postoje.kljucSeeda, akcija: 'aktiviran', aktivanPrije: false, aktivanPoslije: true, adminId });
        aktivirano += 1;
      }
    }
    const [ukupno] = await tx.select({ broj: count() }).from(botovi).where(eq(botovi.aktivan, true));
    if (Number(ukupno?.broj ?? 0) !== CILJ_AKTIVNIH_FONDA_V5 || Number(ukupno?.broj ?? 0) > aktivniLimit) {
      throw new Error(`Zamjena fonda mora završiti s točno ${CILJ_AKTIVNIH_FONDA_V5} aktivnih botova unutar postavljenog limita.`);
    }
    const aktivniGosti = await tx.select({ kljucSeeda: botovi.kljucSeeda }).from(botovi)
      .where(and(eq(botovi.aktivan, true), eq(botovi.tip, 'gost')));
    if (aktivniGosti.length > 0) throw new Error('Nakon zamjene V5 ne smije biti aktivnih gost-botova.');

    await tx.insert(operativnePrimjene).values({
      kljuc: KLJUC_OPERATIVNE_PRIMJENE_FONDA_V5,
      napomena: `stvoreno=${stvoreno};aktivirano=${aktivirano};deaktivirano=${deaktivirano}`,
    });

    return {
      ciljAktivnih: CILJ_AKTIVNIH_FONDA_V5,
      stvoreno,
      aktivirano,
      deaktivirano,
      aktivnoPoslije: CILJ_AKTIVNIH_FONDA_V5,
      preskoceno: false as const,
    };
  }, { isolationLevel: 'serializable' });
}

type BotTransaction = Parameters<Parameters<typeof baza.transaction>[0]>[0];

function jeOdobrenNadimakNovogBota(nadimak: string): boolean {
  const gornji = nadimak.toLocaleUpperCase('hr-HR');
  return ODOBRENI_NADIMCI_NOVIH_BOTOVA.some((n) => n.toLocaleUpperCase('hr-HR') === gornji);
}

async function izaberiNadimak(
  tx: BotTransaction,
  ulaz: Pick<UlazNovogBota, 'nadimak'>,
  zauzetiNadimci: ReadonlySet<string>,
  opcije?: { strogiNadimak?: boolean },
): Promise<string> {
  const kandidati = opcije?.strogiNadimak
    ? (ulaz.nadimak ? [ulaz.nadimak] : [])
    : ulaz.nadimak
      ? [ulaz.nadimak, ...ODOBRENI_NADIMCI_NOVIH_BOTOVA.filter((n) => n.toLocaleLowerCase('hr-HR') !== ulaz.nadimak!.toLocaleLowerCase('hr-HR'))]
      : [...ODOBRENI_NADIMCI_NOVIH_BOTOVA];

  for (const kandidat of kandidati) {
    if (!jeOdobrenNadimakNovogBota(kandidat) && opcije?.strogiNadimak !== true) continue;
    if (opcije?.strogiNadimak && !jeOdobrenNadimakNovogBota(kandidat)) {
      throw new Error(`Strogi fond V5 dopušta samo odobrene nadimke: ${kandidat}`);
    }
    const normalizirani = kandidat.toLocaleLowerCase('hr-HR');
    if (zauzetiNadimci.has(normalizirani)) continue;
    const [postojeci] = await tx.select({ id: igraci.id }).from(igraci).where(sql`lower(${igraci.nadimak}) = ${normalizirani}`).limit(1);
    if (!postojeci) return kandidat;
  }
  throw new Error('Nema slobodnog odobrenog nadimka u katalogu botova.');
}

async function stvoriBotaUTransakciji(
  tx: BotTransaction,
  ulaz: UlazNovogBota,
  adminId: string | null,
  zauzetiNadimci: Set<string>,
  opcije?: { strogiNadimak?: boolean },
) {
  const nadimak = ulaz.tip === 'gost' ? 'Gost' : await izaberiNadimak(tx, ulaz, zauzetiNadimci, opcije);
  zauzetiNadimci.add(nadimak.toLocaleLowerCase('hr-HR'));
  const nasumicni = () => randomInt(0, 1_000_000) / 1_000_000;
  const [igrac] = await tx.insert(igraci).values({
    vrsta: 'registriran', upravljac: 'bot', nadimak,
    avatarId: ulaz.tip === 'gost' ? 0 : randomInt(0, 8),
    avatarConfig: ulaz.tip === 'gost' ? ZADANI_AVATAR_CONFIG : nasumicnaKonfiguracijaAvatara(nasumicni),
    avatarRevision: 1,
    email: null, lozinkaHash: null, emailPotvrdjen: true, registriranAt: sql`now()`,
  }).returning({ id: igraci.id });
  if (!igrac) throw new Error('Umetanje bot računa nije uspjelo.');
  await tx.insert(botovi).values({
    igracId: igrac.id,
    kljucSeeda: ulaz.kljucSeeda,
    tip: ulaz.tip,
    aktivan: true,
    verzijaProfila: VERZIJA_PROFILA_IDENTITETA_V5,
  });
  await tx.insert(izmjeneBotova).values({ botId: igrac.id, kljucSeeda: ulaz.kljucSeeda, akcija: 'stvoren', aktivanPrije: false, aktivanPoslije: true, adminId });
  return { igracId: igrac.id, kljucSeeda: ulaz.kljucSeeda, tip: ulaz.tip, nadimak };
}
