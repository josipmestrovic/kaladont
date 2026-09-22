/**
 * Fastify rute za račune (registracija, prijava, odjava, potvrda emaila, reset lozinke).
 * Sve poruke o postojanju računa su namjerno generičke (sigurnost-i-privatnost.md).
 */
import type { FastifyInstance } from 'fastify';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { baza } from '../baza/klijent.js';
import { igraci } from '../baza/shema.js';
import { porukaPotvrdeEmaila, porukaResetaLozinke, posaljiEmail } from '../email.js';
import { konfiguracija } from '../konfiguracija.js';
import { BROJ_AVATARA } from '../identitet/identitet.js';
import { dohvatiSesijuZahtjeva } from './autentikacija.js';
import { izdajSesiju, opozoviSesiju, stvoriGostSesiju } from './sesije.js';
import { MAKSIMALNA_DULJINA_NADIMKA, MINIMALNA_DULJINA_NADIMKA, PORUKA_NEVALJANOG_NADIMKA, UZORAK_NADIMKA, validirajAvatarConfig, type AvatarConfigV1 } from 'zajednicko';
import {
  izdajTokenPotvrdeEmaila,
  izdajTokenResetaLozinke,
  provjeriTokenPotvrdeEmaila,
  provjeriTokenResetaLozinke,
} from './tokeni.js';

export interface OpcijeAuthRateLimita {
  omogucen: boolean;
  maxPokusaja?: number;
  vremenskiProzor?: string;
}

export interface OpcijeRacuna {
  naSesijaOpozvana?: (sesijaId: string) => void | Promise<void>;
}

export function registrirajStariLinkPotvrdeEmaila(app: FastifyInstance): void {
  app.get<{ Querystring: { token?: string } }>(
    '/racuni/potvrdi-email',
    async (zahtjev, odgovor) => odgovor.redirect(`/potvrda-emaila?token=${encodeURIComponent(zahtjev.query.token ?? '')}`),
  );
}

const NAZIV_KOLACICA = 'kaladont_sesija';
const TRAJANJE_KOLACICA_MS = 30 * 24 * 60 * 60 * 1000;

const ShemaRegistracije = z.object({
  email: z.string().email(),
  lozinka: z.string().min(8),
  nadimak: z.string().min(MINIMALNA_DULJINA_NADIMKA, PORUKA_NEVALJANOG_NADIMKA).max(MAKSIMALNA_DULJINA_NADIMKA, PORUKA_NEVALJANOG_NADIMKA).regex(UZORAK_NADIMKA, PORUKA_NEVALJANOG_NADIMKA).optional(),
  avatarId: z
    .number()
    .int()
    .min(0)
    .max(BROJ_AVATARA - 1)
    .optional(),
  avatarConfig: z.unknown().optional(),
});

const ShemaPrijave = z.object({
  email: z.string().email(),
  lozinka: z.string().min(1),
});

const ShemaZaboravljenaLozinka = z.object({ email: z.string().email() });
const ShemaResetLozinke = z.object({ token: z.string(), novaLozinka: z.string().min(8) });
const ShemaTokena = z.object({ token: z.string() });

function normalizirajEmail(email: string): string {
  return email.trim().toLowerCase();
}

function javnaPoveznica(putanja: string): string {
  return new URL(putanja, konfiguracija.JAVNA_ADRESA).toString();
}

function postaviSesijskiKolacic(odgovor: import('fastify').FastifyReply, token: string): void {
  odgovor.setCookie(NAZIV_KOLACICA, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: konfiguracija.NODE_ENV === 'staging' || konfiguracija.NODE_ENV === 'production',
    maxAge: TRAJANJE_KOLACICA_MS / 1000,
    path: '/',
  });
}

export async function registrirajRacuneRute(
  app: FastifyInstance,
  opcijeRateLimita: OpcijeAuthRateLimita,
  opcijeRacuna: OpcijeRacuna = {},
): Promise<void> {
  const limitPokusaja = {
    max: opcijeRateLimita.maxPokusaja ?? 10,
    timeWindow: opcijeRateLimita.vremenskiProzor ?? '15 minutes',
  };
  const limitResetEmaila = {
    max: limitPokusaja.max,
    timeWindow: opcijeRateLimita.vremenskiProzor ?? '15 minutes',
  };
  const limitPotvrde = {
    max: limitPokusaja.max,
    timeWindow: opcijeRateLimita.vremenskiProzor ?? '15 minutes',
  };
  const ogranicenje = (postavke: typeof limitPokusaja) =>
    opcijeRateLimita.omogucen ? { config: { rateLimit: postavke } } : {};

  app.post('/racuni/registracija', ogranicenje(limitPokusaja), async (zahtjev, odgovor) => {
    const rezultat = ShemaRegistracije.safeParse(zahtjev.body);
    if (!rezultat.success) {
      return odgovor.code(400).send({ ok: false, greska: rezultat.error.issues[0]?.message ?? 'Neispravni podaci.' });
    }
    const { email, lozinka, nadimak, avatarId, avatarConfig } = rezultat.data;
    const normaliziraniEmail = normalizirajEmail(email);
    if (avatarConfig !== undefined && !validirajAvatarConfig(avatarConfig)) {
      return odgovor.code(400).send({ ok: false, greska: 'Neispravna konfiguracija avatara.' });
    }
    const kanonskiAvatarConfig = avatarConfig as AvatarConfigV1 | undefined;

    const [postojeciEmail] = await baza
      .select()
      .from(igraci)
      .where(sql`lower(${igraci.email}) = ${normaliziraniEmail}`)
      .limit(1);
    if (postojeciEmail) {
      return odgovor.code(409).send({ ok: false, greska: 'Ta email adresa je već registrirana.' });
    }

    const lozinkaHash = await argonHash(lozinka);
    const gostSesija = await dohvatiSesijuZahtjeva(zahtjev);
    const [postojeciGost] = gostSesija
      ? await baza.select().from(igraci).where(and(eq(igraci.id, gostSesija.igracId), eq(igraci.vrsta, 'gost'))).limit(1)
      : [undefined];

    let igracId: string;
    let konacniNadimak: string;

    if (postojeciGost) {
      // RS-20: gost -> registriran je UPDATE istog retka, statistika ostaje
      await baza
        .update(igraci)
        .set({
          vrsta: 'registriran',
          email: normaliziraniEmail,
          lozinkaHash,
          emailPotvrdjen: false,
          ...(nadimak ? { nadimak } : {}),
          ...(avatarId !== undefined ? { avatarId } : {}),
          ...(kanonskiAvatarConfig ? { avatarConfig: kanonskiAvatarConfig, avatarRevision: sql`${igraci.avatarRevision} + 1` } : {}),
        })
        .where(eq(igraci.id, postojeciGost.id));
      igracId = postojeciGost.id;
      konacniNadimak = nadimak ?? postojeciGost.nadimak;
    } else {
      const [novi] = await baza
        .insert(igraci)
        .values({
          vrsta: 'registriran',
          email: normaliziraniEmail,
          lozinkaHash,
          emailPotvrdjen: false,
          nadimak: nadimak ?? normaliziraniEmail.split('@')[0]!,
          avatarId: avatarId ?? Math.floor(Math.random() * BROJ_AVATARA),
          avatarConfig: kanonskiAvatarConfig ?? null,
        })
        .returning();
      if (!novi) {
        return odgovor.code(500).send({ ok: false, greska: 'Registracija nije uspjela.' });
      }
      igracId = novi.id;
      konacniNadimak = novi.nadimak;
    }

    const tokenPotvrde = izdajTokenPotvrdeEmaila(igracId);
    await posaljiEmail(
      app.log,
      normaliziraniEmail,
      porukaPotvrdeEmaila(javnaPoveznica(`/potvrda-emaila?token=${tokenPotvrde}`)),
    );

    const sesija = await izdajSesiju(igracId);
    postaviSesijskiKolacic(odgovor, sesija.token);

    return { ok: true, igracId, nadimak: konacniNadimak, sesijskiToken: sesija.token };
  });

  app.post('/racuni/gost-sesija', async (_zahtjev, odgovor) => {
    return odgovor.send({ ok: true, ...(await stvoriGostSesiju()) });
  });

  app.post('/racuni/prijava', ogranicenje(limitPokusaja), async (zahtjev, odgovor) => {
    const rezultat = ShemaPrijave.safeParse(zahtjev.body);
    if (!rezultat.success) {
      return odgovor.code(400).send({ ok: false, greska: 'Neispravni podaci.' });
    }
    const { email, lozinka } = rezultat.data;
    const normaliziraniEmail = normalizirajEmail(email);

    const PORUKA_NEUSPJEHA = 'Pogrešan email ili lozinka.'; // namjerno isto za oba slucaja

    const [korisnik] = await baza.select().from(igraci).where(sql`lower(${igraci.email}) = ${normaliziraniEmail}`).limit(1);
    if (!korisnik || !korisnik.lozinkaHash) {
      return odgovor.code(401).send({ ok: false, greska: PORUKA_NEUSPJEHA });
    }

    const ispravno = await argonVerify(korisnik.lozinkaHash, lozinka);
    if (!ispravno) {
      return odgovor.code(401).send({ ok: false, greska: PORUKA_NEUSPJEHA });
    }

    const sesija = await izdajSesiju(korisnik.id);
    postaviSesijskiKolacic(odgovor, sesija.token);

    return { ok: true, igracId: korisnik.id, nadimak: korisnik.nadimak, sesijskiToken: sesija.token };
  });

  app.post('/racuni/odjava', async (zahtjev, odgovor) => {
    const sesija = await dohvatiSesijuZahtjeva(zahtjev);
    if (sesija) {
      await opozoviSesiju(sesija.id);
      await opcijeRacuna.naSesijaOpozvana?.(sesija.id);
    }
    odgovor.clearCookie(NAZIV_KOLACICA, { path: '/' });
    return { ok: true };
  });

  app.get<{ Querystring: { token?: string } }>(
    '/racuni/potvrdi-email',
    ogranicenje(limitPotvrde),
    async (zahtjev, odgovor) => odgovor.redirect(`/potvrda-emaila?token=${encodeURIComponent(zahtjev.query.token ?? '')}`),
  );

  app.post('/racuni/potvrdi-email', ogranicenje(limitPotvrde), async (zahtjev, odgovor) => {
    const rezultat = ShemaTokena.safeParse(zahtjev.body);
    if (!rezultat.success) {
      return odgovor.code(400).send({ ok: false, greska: 'Nevaljan ili istekao link.' });
    }
    const igracId = provjeriTokenPotvrdeEmaila(rezultat.data.token);
    if (!igracId) {
      return odgovor.code(400).send({ ok: false, greska: 'Nevaljan ili istekao link.' });
    }
    await baza.update(igraci).set({ emailPotvrdjen: true }).where(eq(igraci.id, igracId));
    return { ok: true };
  });

  app.post(
    '/racuni/zaboravljena-lozinka',
    ogranicenje(limitResetEmaila),
    async (zahtjev, odgovor) => {
      const rezultat = ShemaZaboravljenaLozinka.safeParse(zahtjev.body);
      if (!rezultat.success) {
        return odgovor.code(400).send({ ok: false, greska: 'Neispravni podaci.' });
      }

      const PORUKA = 'Ako račun postoji, poslali smo upute na email.'; // ne otkriva postoji li racun

      const normaliziraniEmail = normalizirajEmail(rezultat.data.email);
      const [korisnik] = await baza
        .select()
        .from(igraci)
        .where(sql`lower(${igraci.email}) = ${normaliziraniEmail}`)
        .limit(1);
      if (korisnik) {
        const token = izdajTokenResetaLozinke(korisnik.id);
        await posaljiEmail(
          app.log,
          normaliziraniEmail,
          porukaResetaLozinke(javnaPoveznica(`/racuni/resetiraj-lozinku?token=${token}`)),
        );
      }

      return { ok: true, poruka: PORUKA };
    },
  );

  app.post('/racuni/resetiraj-lozinku', ogranicenje(limitPokusaja), async (zahtjev, odgovor) => {
    const rezultat = ShemaResetLozinke.safeParse(zahtjev.body);
    if (!rezultat.success) {
      return odgovor.code(400).send({ ok: false, greska: 'Neispravni podaci.' });
    }
    const igracId = provjeriTokenResetaLozinke(rezultat.data.token);
    if (!igracId) {
      return odgovor.code(400).send({ ok: false, greska: 'Nevaljan ili istekao link.' });
    }

    const lozinkaHash = await argonHash(rezultat.data.novaLozinka);
    await baza.update(igraci).set({ lozinkaHash }).where(eq(igraci.id, igracId));

    return { ok: true };
  });
}
