import { randomUUID, randomInt } from 'node:crypto';
import { and, count, eq, inArray, notInArray, sql } from 'drizzle-orm';
import { nasumicnaKonfiguracijaAvatara, UZORAK_NADIMKA, MAKSIMALNA_DULJINA_NADIMKA, MINIMALNA_DULJINA_NADIMKA } from 'zajednicko';
import { baza } from '../baza/klijent.js';
import { botovi, izmjeneBotova, igraci, postavkeBotova } from '../baza/shema.js';
import { KANDIDATI_NADIMAKA_BOTOVA, NADIMCI_POCETNOG_FONDA_V3 } from './nadimci.js';
import { ShemaKonfiguracijeBota, ZADANA_KONFIGURACIJA_BOTA } from './konfiguracija-bota.js';

export const MAKSIMALNO_AKTIVNIH_BOTOVA = 100;
const ZAKLJUCAVANJE_FONDA_BOTOVA = 1_784_120_339;

export async function dohvatiLimitAktivnihBotova(): Promise<number> {
  const [zapis] = await baza.select({ konfiguracija: postavkeBotova.konfiguracija }).from(postavkeBotova).where(eq(postavkeBotova.id, 1));
  return zapis ? ShemaKonfiguracijeBota.parse(zapis.konfiguracija).maksimalnoAktivnihBotova : ZADANA_KONFIGURACIJA_BOTA.maksimalnoAktivnihBotova;
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

export async function stvoriBotovePoKljucima(ulazi: readonly UlazNovogBota[], adminId: string | null = null, aktivniLimit = MAKSIMALNO_AKTIVNIH_BOTOVA): Promise<RezultatStvaranjaBotova> {
  if (ulazi.length > MAKSIMALNO_AKTIVNIH_BOTOVA) throw new Error('Jedan zahtjev može stvoriti najviše 100 botova.');
  if (!Number.isInteger(aktivniLimit) || aktivniLimit < 1 || aktivniLimit > MAKSIMALNO_AKTIVNIH_BOTOVA) throw new Error('Limit aktivnih botova mora biti od 1 do 100.');
  if (new Set(ulazi.map((ulaz) => ulaz.kljucSeeda)).size !== ulazi.length) throw new Error('Ključevi botova u zahtjevu moraju biti jedinstveni.');
  for (const ulaz of ulazi) {
    if (!/^[a-z0-9][a-z0-9-]{2,79}$/.test(ulaz.kljucSeeda)) throw new Error('Neispravan verzionirani ključ bota.');
    if (ulaz.tip !== 'gost' && ulaz.tip !== 'imenovani') throw new Error('Nepoznata vrsta prezentacije bota.');
    if (ulaz.nadimak && (!UZORAK_NADIMKA.test(ulaz.nadimak) || ulaz.nadimak.length < MINIMALNA_DULJINA_NADIMKA || ulaz.nadimak.length > MAKSIMALNA_DULJINA_NADIMKA)) throw new Error('Nadimak ne prolazi provjeru formata.');
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
  if (!Number.isInteger(broj) || broj < 1 || broj > 100) throw new Error('Broj novih botova mora biti cijeli broj od 1 do 100.');
  const serija = randomUUID();
  return stvoriBotovePoKljucima(Array.from({ length: broj }, (_, indeks) => ({
    kljucSeeda: `bot-admin-${tip}-${serija}-${String(indeks + 1).padStart(3, '0')}`,
    tip,
  })), adminId, aktivniLimit);
}

export function stavkeZamjeneFondaBotova(): UlazNovogBota[] {
  return [
    ...NADIMCI_POCETNOG_FONDA_V3.map((stavka, indeks) => ({
      kljucSeeda: `bot-v3-imenovani-${String(indeks + 1).padStart(3, '0')}`,
      tip: 'imenovani' as const,
      nadimak: stavka.nadimak,
      pocetnoSlovo: stavka.pocetnoSlovo,
    })),
    ...Array.from({ length: 30 }, (_, indeks) => ({ kljucSeeda: `bot-v3-gost-${String(indeks + 1).padStart(3, '0')}`, tip: 'gost' as const })),
  ];
}

export async function pregledZamjeneFondaBotova() {
  const [aktivni] = await baza.select({ broj: count() }).from(botovi).where(eq(botovi.aktivan, true));
  const ciljevi = stavkeZamjeneFondaBotova();
  const ciljniKljuci = new Set(ciljevi.map((bot) => bot.kljucSeeda));
  const postojeV3 = await baza.select({ kljucSeeda: botovi.kljucSeeda, tip: botovi.tip, aktivan: botovi.aktivan }).from(botovi).where(sql`${botovi.kljucSeeda} like 'bot-v3-%'`);
  const kljucevi = new Map(postojeV3.map((bot) => [bot.kljucSeeda, bot]));
  const stariAktivni = await baza.select({ kljucSeeda: botovi.kljucSeeda, nadimak: igraci.nadimak })
    .from(botovi).innerJoin(igraci, eq(igraci.id, botovi.igracId))
    .where(and(eq(botovi.aktivan, true), notInArray(botovi.kljucSeeda, [...ciljniKljuci])))
    .orderBy(botovi.kljucSeeda);
  const nedostajuciCiljevi = ciljevi.filter((bot) => !kljucevi.has(bot.kljucSeeda));
  return {
    nacin: 'preview',
    aktivnoPrije: Number(aktivni?.broj ?? 0),
    deaktiviratCeAktivnihStarih: Math.max(0, Number(aktivni?.broj ?? 0) - postojeV3.filter((bot) => bot.aktivan).length),
    postojeV3: postojeV3.length,
    nedostajeImenovanih: ciljevi.filter((bot) => bot.tip === 'imenovani' && !kljucevi.has(bot.kljucSeeda)).length,
    nedostajeGostiju: ciljevi.filter((bot) => bot.tip === 'gost' && !kljucevi.has(bot.kljucSeeda)).length,
    mapaZamjene: stariAktivni.map((stari, indeks) => ({ stari, novi: nedostajuciCiljevi[indeks] ?? null })),
    ciljniKljuci: ciljevi.map(({ kljucSeeda, tip }) => ({ kljucSeeda, tip })),
    ciljAktivnih: 70,
    mijenjaStatistiku: false,
  };
}

export async function zamijeniFondBotova(adminId: string | null = null, aktivniLimit = MAKSIMALNO_AKTIVNIH_BOTOVA) {
  if (aktivniLimit < 70) throw new Error('Aktivni limit mora biti barem 70 za zamjenski fond v3.');
  const ciljevi = stavkeZamjeneFondaBotova();
  return baza.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${ZAKLJUCAVANJE_FONDA_BOTOVA})`);
    const postojeV3 = await tx.select({ igracId: botovi.igracId, kljucSeeda: botovi.kljucSeeda, tip: botovi.tip, aktivan: botovi.aktivan, nadimak: igraci.nadimak })
      .from(botovi).innerJoin(igraci, eq(igraci.id, botovi.igracId)).where(sql`${botovi.kljucSeeda} like 'bot-v3-%'`).for('update');
    const poKljucu = new Map(postojeV3.map((bot) => [bot.kljucSeeda, bot]));
    const ciljniKljuci = new Set(ciljevi.map((bot) => bot.kljucSeeda));
    for (const cilj of ciljevi) {
      const postoje = poKljucu.get(cilj.kljucSeeda);
      if (postoje && postoje.tip !== cilj.tip) throw new Error(`Ključ ${cilj.kljucSeeda} već pripada drugom tipu bota.`);
    }
    const sviAktivni = await tx.select({ igracId: botovi.igracId, kljucSeeda: botovi.kljucSeeda })
      .from(botovi).where(eq(botovi.aktivan, true)).for('update');
    const zauzetiNadimci = new Set(postojeV3.filter((bot) => bot.tip === 'imenovani').map((bot) => bot.nadimak.toLocaleLowerCase('hr-HR')));
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
        await stvoriBotaUTransakciji(tx, cilj, adminId, zauzetiNadimci);
        stvoreno += 1;
      } else if (!postoje.aktivan) {
        await tx.update(botovi).set({ aktivan: true }).where(eq(botovi.igracId, postoje.igracId));
        await tx.insert(izmjeneBotova).values({ botId: postoje.igracId, kljucSeeda: postoje.kljucSeeda, akcija: 'aktiviran', aktivanPrije: false, aktivanPoslije: true, adminId });
        aktivirano += 1;
      }
    }
    const [ukupno] = await tx.select({ broj: count() }).from(botovi).where(eq(botovi.aktivan, true));
    if (Number(ukupno?.broj ?? 0) !== 70 || Number(ukupno?.broj ?? 0) > aktivniLimit) throw new Error('Zamjena fonda mora završiti s točno 70 aktivnih botova unutar postavljenog limita.');
    return { ciljAktivnih: 70, stvoreno, aktivirano, deaktivirano, aktivnoPoslije: 70 };
  }, { isolationLevel: 'serializable' });
}

type BotTransaction = Parameters<Parameters<typeof baza.transaction>[0]>[0];

function pocetnaVarijanta(tekst: string, tip: 'malo' | 'veliko') {
  const prvo = tekst[0]!;
  return (tip === 'malo' ? prvo.toLocaleLowerCase('hr-HR') : prvo.toLocaleUpperCase('hr-HR')) + tekst.slice(1);
}

async function izaberiNadimak(tx: BotTransaction, ulaz: Pick<UlazNovogBota, 'nadimak' | 'pocetnoSlovo'>, zauzetiNadimci: ReadonlySet<string>): Promise<string> {
  const kandidati = ulaz.pocetnoSlovo
    ? [ulaz.nadimak, ...KANDIDATI_NADIMAKA_BOTOVA.map((kandidat) => pocetnaVarijanta(kandidat, ulaz.pocetnoSlovo!))].filter((kandidat): kandidat is string => Boolean(kandidat))
    : ulaz.nadimak ? [ulaz.nadimak, ...KANDIDATI_NADIMAKA_BOTOVA] : KANDIDATI_NADIMAKA_BOTOVA;
  for (const kandidat of kandidati) {
    const normalizirani = kandidat.toLocaleLowerCase('hr-HR');
    if (zauzetiNadimci.has(normalizirani)) continue;
    const [postojeci] = await tx.select({ id: igraci.id }).from(igraci).where(sql`lower(${igraci.nadimak}) = ${normalizirani}`).limit(1);
    if (!postojeci) return kandidat;
  }
  throw new Error('Nema slobodnog nadimka u provjerenom fondu kandidata.');
}

async function stvoriBotaUTransakciji(tx: BotTransaction, ulaz: UlazNovogBota, adminId: string | null, zauzetiNadimci: Set<string>) {
  const nadimak = ulaz.tip === 'gost' ? 'Gost' : await izaberiNadimak(tx, ulaz, zauzetiNadimci);
  zauzetiNadimci.add(nadimak.toLocaleLowerCase('hr-HR'));
  const nasumicni = () => randomInt(0, 1_000_000) / 1_000_000;
  const [igrac] = await tx.insert(igraci).values({
    vrsta: 'registriran', upravljac: 'bot', nadimak,
    avatarId: ulaz.tip === 'gost' ? 0 : randomInt(0, 8),
    avatarConfig: ulaz.tip === 'gost' ? null : nasumicnaKonfiguracijaAvatara(nasumicni),
    avatarRevision: ulaz.tip === 'gost' ? 0 : 1,
    email: null, lozinkaHash: null, emailPotvrdjen: true, registriranAt: sql`now()`,
  }).returning({ id: igraci.id });
  if (!igrac) throw new Error('Umetanje bot računa nije uspjelo.');
  await tx.insert(botovi).values({ igracId: igrac.id, kljucSeeda: ulaz.kljucSeeda, tip: ulaz.tip, aktivan: true, verzijaProfila: 3 });
  await tx.insert(izmjeneBotova).values({ botId: igrac.id, kljucSeeda: ulaz.kljucSeeda, akcija: 'stvoren', aktivanPrije: false, aktivanPoslije: true, adminId });
  return { igracId: igrac.id, kljucSeeda: ulaz.kljucSeeda, tip: ulaz.tip, nadimak };
}