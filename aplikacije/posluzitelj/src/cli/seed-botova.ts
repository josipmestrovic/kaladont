/**
 * Idempotentan seed javnih bot identiteta (ADR-017).
 *   pnpm --filter posluzitelj seed-botova -- --broj=40
 * Ponovno pokretanje ne mijenja postojeće botove, ne resetira statistiku i ne dira ljudske račune.
 */
import { createHash } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import { nasumicnaKonfiguracijaAvatara, UZORAK_NADIMKA, MAKSIMALNA_DULJINA_NADIMKA, MINIMALNA_DULJINA_NADIMKA } from 'zajednicko';
import { baza, zatvoriBazu } from '../baza/klijent.js';
import { botovi, igraci } from '../baza/shema.js';
import { NADIMCI_BOTOVA } from '../bot/nadimci.js';

export const MAKSIMALNO_BOTOVA = 100;

function rngIzKljuca(kljuc: string): () => number {
  let sjeme = createHash('sha256').update(kljuc).digest().readUInt32LE(0);
  return () => {
    sjeme = (sjeme + 0x6d2b79f5) >>> 0;
    let t = sjeme;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function kljucSeedaBota(redni: number): string {
  return `bot-${String(redni).padStart(3, '0')}`;
}

export async function seedBotova(broj: number): Promise<{ stvoreno: number; postojalo: number }> {
  if (!Number.isInteger(broj) || broj < 1 || broj > MAKSIMALNO_BOTOVA) {
    throw new Error(`--broj mora biti cijeli broj od 1 do ${MAKSIMALNO_BOTOVA}.`);
  }
  let stvoreno = 0;
  let postojalo = 0;
  for (let redni = 1; redni <= broj; redni += 1) {
    const kljuc = kljucSeedaBota(redni);
    const [postojeci] = await baza.select({ igracId: botovi.igracId }).from(botovi).where(eq(botovi.kljucSeeda, kljuc)).limit(1);
    if (postojeci) {
      postojalo += 1;
      continue;
    }
    const rng = rngIzKljuca(kljuc);
    const nadimak = await slobodanNadimak(redni, rng);
    await baza.transaction(async (tx) => {
      const [igrac] = await tx.insert(igraci).values({
        vrsta: 'registriran',
        upravljac: 'bot',
        nadimak,
        avatarId: Math.floor(rng() * 8),
        avatarConfig: nasumicnaKonfiguracijaAvatara(rng),
        avatarRevision: 1,
        email: null,
        lozinkaHash: null,
        emailPotvrdjen: true,
        registriranAt: sql`now()`,
      }).returning({ id: igraci.id });
      if (!igrac) throw new Error('Umetanje bota nije uspjelo.');
      await tx.insert(botovi).values({ igracId: igrac.id, kljucSeeda: kljuc, aktivan: true, verzijaProfila: 1 });
    });
    stvoreno += 1;
  }
  return { stvoreno, postojalo };
}

async function slobodanNadimak(redni: number, rng: () => number): Promise<string> {
  const pomak = Math.floor(rng() * NADIMCI_BOTOVA.length);
  for (let i = 0; i < NADIMCI_BOTOVA.length; i += 1) {
    const kandidat = NADIMCI_BOTOVA[(pomak + i) % NADIMCI_BOTOVA.length]!;
    if (!UZORAK_NADIMKA.test(kandidat) || kandidat.length < MINIMALNA_DULJINA_NADIMKA || kandidat.length > MAKSIMALNA_DULJINA_NADIMKA) continue;
    const [zauzet] = await baza.select({ id: igraci.id }).from(igraci)
      .where(sql`lower(${igraci.nadimak}) = lower(${kandidat})`).limit(1);
    if (!zauzet) return kandidat;
  }
  throw new Error(`Nema slobodnog nadimka za bota ${redni}; proširi fond nadimaka.`);
}

const jePokrenutIzravno = process.argv[1]?.replace(/\\/g, '/').endsWith('/cli/seed-botova.ts');
if (jePokrenutIzravno) {
  const argument = process.argv.find((a) => a.startsWith('--broj='));
  const broj = Number(argument?.slice('--broj='.length) ?? 40);
  seedBotova(broj)
    .then(({ stvoreno, postojalo }) => {
      console.log(`Botovi: stvoreno ${stvoreno}, već postojalo ${postojalo}.`);
    })
    .catch((greska: unknown) => {
      console.error(greska instanceof Error ? greska.message : String(greska));
      process.exitCode = 1;
    })
    .finally(() => zatvoriBazu());
}
