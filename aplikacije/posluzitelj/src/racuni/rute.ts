/**
 * Fastify rute za račune (registracija, prijava, odjava, potvrda emaila, reset lozinke).
 * Sve poruke o postojanju računa su namjerno generičke (sigurnost-i-privatnost.md).
 */
import type { FastifyInstance } from 'fastify';
import { hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { baza } from '../baza/klijent.js';
import { igraci } from '../baza/shema.js';
import { posaljiEmail } from '../email.js';
import { BROJ_AVATARA } from '../identitet/identitet.js';
import {
  izdajSesijskiToken,
  izdajTokenPotvrdeEmaila,
  izdajTokenResetaLozinke,
  provjeriTokenPotvrdeEmaila,
  provjeriTokenResetaLozinke,
} from './tokeni.js';

const NAZIV_KOLACICA = 'kaladont_sesija';
const TRAJANJE_KOLACICA_MS = 30 * 24 * 60 * 60 * 1000;

const ShemaRegistracije = z.object({
  gostToken: z.string().uuid().optional(),
  email: z.string().email(),
  lozinka: z.string().min(8),
  nadimak: z.string().min(2).max(40).optional(),
});

const ShemaPrijave = z.object({
  email: z.string().email(),
  lozinka: z.string().min(1),
});

const ShemaZaboravljenaLozinka = z.object({ email: z.string().email() });
const ShemaResetLozinke = z.object({ token: z.string(), novaLozinka: z.string().min(8) });

function postaviSesijskiKolacic(odgovor: import('fastify').FastifyReply, token: string): void {
  odgovor.setCookie(NAZIV_KOLACICA, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: TRAJANJE_KOLACICA_MS / 1000,
    path: '/',
  });
}

export async function registrirajRacuneRute(app: FastifyInstance): Promise<void> {
  app.post('/racuni/registracija', async (zahtjev, odgovor) => {
    const rezultat = ShemaRegistracije.safeParse(zahtjev.body);
    if (!rezultat.success) {
      return odgovor.code(400).send({ ok: false, greska: 'Neispravni podaci.' });
    }
    const { gostToken, email, lozinka, nadimak } = rezultat.data;

    const [postojeciEmail] = await baza.select().from(igraci).where(eq(igraci.email, email)).limit(1);
    if (postojeciEmail) {
      return odgovor.code(409).send({ ok: false, greska: 'Ta email adresa je već registrirana.' });
    }

    const lozinkaHash = await argonHash(lozinka);
    const [postojeciGost] = gostToken
      ? await baza.select().from(igraci).where(and(eq(igraci.id, gostToken), eq(igraci.vrsta, 'gost'))).limit(1)
      : [undefined];

    let igracId: string;
    let konacniNadimak: string;

    if (postojeciGost) {
      // RS-20: gost -> registriran je UPDATE istog retka, statistika ostaje
      await baza
        .update(igraci)
        .set({
          vrsta: 'registriran',
          email,
          lozinkaHash,
          emailPotvrdjen: false,
          ...(nadimak ? { nadimak } : {}),
        })
        .where(eq(igraci.id, postojeciGost.id));
      igracId = postojeciGost.id;
      konacniNadimak = nadimak ?? postojeciGost.nadimak;
    } else {
      const [novi] = await baza
        .insert(igraci)
        .values({
          vrsta: 'registriran',
          email,
          lozinkaHash,
          emailPotvrdjen: false,
          nadimak: nadimak ?? email.split('@')[0]!,
          avatarId: Math.floor(Math.random() * BROJ_AVATARA),
        })
        .returning();
      if (!novi) {
        return odgovor.code(500).send({ ok: false, greska: 'Registracija nije uspjela.' });
      }
      igracId = novi.id;
      konacniNadimak = novi.nadimak;
    }

    const tokenPotvrde = izdajTokenPotvrdeEmaila(igracId);
    posaljiEmail(app.log, email, `Potvrdi email: /racuni/potvrdi-email?token=${tokenPotvrde}`);

    const sesijskiToken = izdajSesijskiToken(igracId);
    postaviSesijskiKolacic(odgovor, sesijskiToken);

    return { ok: true, igracId, nadimak: konacniNadimak, sesijskiToken };
  });

  app.post('/racuni/prijava', async (zahtjev, odgovor) => {
    const rezultat = ShemaPrijave.safeParse(zahtjev.body);
    if (!rezultat.success) {
      return odgovor.code(400).send({ ok: false, greska: 'Neispravni podaci.' });
    }
    const { email, lozinka } = rezultat.data;

    const PORUKA_NEUSPJEHA = 'Pogrešan email ili lozinka.'; // namjerno isto za oba slucaja

    const [korisnik] = await baza.select().from(igraci).where(eq(igraci.email, email)).limit(1);
    if (!korisnik || !korisnik.lozinkaHash) {
      return odgovor.code(401).send({ ok: false, greska: PORUKA_NEUSPJEHA });
    }

    const ispravno = await argonVerify(korisnik.lozinkaHash, lozinka);
    if (!ispravno) {
      return odgovor.code(401).send({ ok: false, greska: PORUKA_NEUSPJEHA });
    }

    const sesijskiToken = izdajSesijskiToken(korisnik.id);
    postaviSesijskiKolacic(odgovor, sesijskiToken);

    return { ok: true, igracId: korisnik.id, nadimak: korisnik.nadimak, sesijskiToken };
  });

  app.post('/racuni/odjava', async (_zahtjev, odgovor) => {
    odgovor.clearCookie(NAZIV_KOLACICA, { path: '/' });
    return { ok: true };
  });

  app.get<{ Querystring: { token?: string } }>('/racuni/potvrdi-email', async (zahtjev, odgovor) => {
    const igracId = zahtjev.query.token ? provjeriTokenPotvrdeEmaila(zahtjev.query.token) : null;
    if (!igracId) {
      return odgovor.code(400).send({ ok: false, greska: 'Nevaljan ili istekao link.' });
    }
    await baza.update(igraci).set({ emailPotvrdjen: true }).where(eq(igraci.id, igracId));
    return { ok: true };
  });

  app.post('/racuni/zaboravljena-lozinka', async (zahtjev, odgovor) => {
    const rezultat = ShemaZaboravljenaLozinka.safeParse(zahtjev.body);
    if (!rezultat.success) {
      return odgovor.code(400).send({ ok: false, greska: 'Neispravni podaci.' });
    }

    const PORUKA = 'Ako račun postoji, poslali smo upute na email.'; // ne otkriva postoji li racun

    const [korisnik] = await baza.select().from(igraci).where(eq(igraci.email, rezultat.data.email)).limit(1);
    if (korisnik) {
      const token = izdajTokenResetaLozinke(korisnik.id);
      posaljiEmail(app.log, rezultat.data.email, `Resetiraj lozinku: /racuni/resetiraj-lozinku?token=${token}`);
    }

    return { ok: true, poruka: PORUKA };
  });

  app.post('/racuni/resetiraj-lozinku', async (zahtjev, odgovor) => {
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
