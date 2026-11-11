/**
 * Fastify ruta za prijave grešaka (odrzavanje-rjecnika.md).
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { jeJedinstvenostPrekrsena } from '../baza/greske.js';
import { baza } from '../baza/klijent.js';
import { igraci, partije, potezi, prijave, prijaveIgraca, sudioniciPartije } from '../baza/shema.js';
import { zahtijevajIdentifikaciju, type ZahtjevSIgracem } from '../racuni/autentikacija.js';
import { and, count, eq, inArray, isNotNull } from 'drizzle-orm';

const ShemaPrijave = z
  .object({
    partijaId: z.string().uuid(),
    tip: z.enum(['za_brisanje', 'za_dodavanje']),
    potezId: z.number().int().positive().optional(),
    rijec: z.string().trim().min(2).max(100).optional(),
    poruka: z.string().trim().max(1000).optional(),
  })
  .superRefine((podaci, ctx) => {
    if (podaci.tip === 'za_brisanje' && podaci.potezId == null && !podaci.rijec) {
      ctx.addIssue({ code: 'custom', path: ['potezId'], message: 'potezId ili rijec su obavezni za prijavu odigrane riječi.' });
    }
    if (podaci.tip === 'za_dodavanje' && !podaci.rijec) {
      ctx.addIssue({ code: 'custom', path: ['rijec'], message: 'rijec je obavezna za prijavu odbijene riječi.' });
    }
  });

const ShemaPrijavaIgraca = z.object({
  partijaId: z.string().uuid(),
  prijavljeniIgracId: z.string().uuid(),
  razlog: z.enum(['pogrdan_nadimak', 'neprimjereno_ponasanje', 'drugo']),
  poruka: z.string().trim().max(1000).optional(),
});

class GreskaPrijave extends Error {
  constructor(public readonly status: 404 | 403 | 409 | 429, poruka: string) {
    super(poruka);
  }
}

function normalizirajRijec(ulaz: string): string {
  return ulaz.normalize('NFC').trim().toLowerCase();
}

export async function registrirajPrijaveRute(app: FastifyInstance): Promise<void> {
  app.post('/prijave', { preHandler: zahtijevajIdentifikaciju }, async (zahtjev, odgovor) => {
    const rezultat = ShemaPrijave.safeParse(zahtjev.body);
    if (!rezultat.success) {
      return odgovor.code(400).send({ ok: false, greska: 'Neispravni podaci.' });
    }
    const igrac = (zahtjev as ZahtjevSIgracem).igrac!;
    const tip = rezultat.data.tip;

    try {
      await baza.transaction(async (tx) => {
        const [partija] = await tx
          .select({ id: partije.id })
          .from(partije)
          .where(and(eq(partije.id, rezultat.data.partijaId), inArray(partije.status, ['u_tijeku', 'zavrsena'])))
          .limit(1);
        if (!partija) throw new GreskaPrijave(404, 'Partija ne postoji ili nije dostupna za prijavu.');

        const [sudionik] = await tx
          .select({ igracId: sudioniciPartije.igracId })
          .from(sudioniciPartije)
          .where(and(eq(sudioniciPartije.partijaId, rezultat.data.partijaId), eq(sudioniciPartije.igracId, igrac.id)))
          .for('update')
          .limit(1);
        if (!sudionik) throw new GreskaPrijave(403, 'Samo sudionici partije mogu prijaviti riječ.');

        const [redakBrojaca] = await tx
          .select({ ukupno: count() })
          .from(prijave)
          .where(and(eq(prijave.partijaId, rezultat.data.partijaId), eq(prijave.igracId, igrac.id), eq(prijave.tip, tip)));
        if (Number(redakBrojaca?.ukupno ?? 0) >= 3) {
          throw new GreskaPrijave(429, tip === 'za_brisanje'
            ? 'Dosegnut je limit od 3 prijave odigranih riječi po partiji.'
            : 'Dosegnut je limit od 3 prijave odbijenih riječi po partiji.');
        }

        if (tip === 'za_brisanje') {
          const uvjetPoteza = rezultat.data.potezId != null
            ? and(
                eq(potezi.id, rezultat.data.potezId),
                eq(potezi.partijaId, rezultat.data.partijaId),
                inArray(potezi.vrsta, ['rijec', 'sustav_rijec']),
                isNotNull(potezi.rijec),
              )
            : and(
                eq(potezi.partijaId, rezultat.data.partijaId),
                eq(potezi.rijec, normalizirajRijec(rezultat.data.rijec!)),
                inArray(potezi.vrsta, ['rijec', 'sustav_rijec']),
                isNotNull(potezi.rijec),
              );
          const [potez] = await tx
            .select({ id: potezi.id, rijec: potezi.rijec })
            .from(potezi)
            .where(uvjetPoteza)
            .limit(1);
          if (!potez?.rijec) throw new GreskaPrijave(404, 'Riječ ne pripada navedenoj partiji.');

          const [duplikat] = await tx
            .select({ id: prijave.id })
            .from(prijave)
            .where(and(
              eq(prijave.partijaId, rezultat.data.partijaId),
              eq(prijave.potezId, potez.id),
              eq(prijave.igracId, igrac.id),
              eq(prijave.tip, 'za_brisanje'),
            ))
            .limit(1);
          if (duplikat) throw new GreskaPrijave(409, 'Ovu si riječ već prijavio/la.');

          await tx.insert(prijave).values({
            partijaId: rezultat.data.partijaId,
            potezId: potez.id,
            igracId: igrac.id,
            tip: 'za_brisanje',
            rijec: potez.rijec,
            poruka: rezultat.data.poruka || 'Riječ prijavljena na provjeru.',
          });
          return;
        }

        const rijec = normalizirajRijec(rezultat.data.rijec!);
        const [duplikat] = await tx
          .select({ id: prijave.id })
          .from(prijave)
          .where(and(
            eq(prijave.partijaId, rezultat.data.partijaId),
            eq(prijave.rijec, rijec),
            eq(prijave.igracId, igrac.id),
            eq(prijave.tip, 'za_dodavanje'),
          ))
          .limit(1);
        if (duplikat) throw new GreskaPrijave(409, 'Ovu si riječ već prijavio/la.');

        await tx.insert(prijave).values({
          partijaId: rezultat.data.partijaId,
          potezId: null,
          igracId: igrac.id,
          tip: 'za_dodavanje',
          rijec,
          poruka: rezultat.data.poruka || 'Odbijena riječ prijavljena na provjeru.',
        });
      });
    } catch (greska) {
      if (greska instanceof GreskaPrijave) {
        return odgovor.code(greska.status).send({ ok: false, greska: greska.message });
      }
      if (jeJedinstvenostPrekrsena(greska)) {
        return odgovor.code(409).send({ ok: false, greska: 'Ovu si riječ već prijavio/la.' });
      }
      throw greska;
    }

    return {
      ok: true,
      poruka: tip === 'za_brisanje' ? 'Riječ je prijavljena.' : 'Riječ je prijavljena.',
    };
  });

  app.post('/prijave-igraca', { preHandler: zahtijevajIdentifikaciju }, async (zahtjev, odgovor) => {
    const rezultat = ShemaPrijavaIgraca.safeParse(zahtjev.body);
    if (!rezultat.success) return odgovor.code(400).send({ ok: false, greska: 'Neispravni podaci za prijavu igrača.' });
    const prijavitelj = (zahtjev as ZahtjevSIgracem).igrac!;
    if (prijavitelj.id === rezultat.data.prijavljeniIgracId) {
      return odgovor.code(400).send({ ok: false, greska: 'Ne možeš prijaviti samoga/samu sebe.' });
    }

    try {
      await baza.transaction(async (tx) => {
        const [partija] = await tx
          .select({ id: partije.id })
          .from(partije)
          .where(and(eq(partije.id, rezultat.data.partijaId), inArray(partije.status, ['u_tijeku', 'zavrsena'])))
          .limit(1);
        if (!partija) throw new GreskaPrijave(404, 'Partija nije pronađena.');

        const [sudionik] = await tx.select({ igracId: sudioniciPartije.igracId }).from(sudioniciPartije).where(and(
          eq(sudioniciPartije.partijaId, rezultat.data.partijaId),
          eq(sudioniciPartije.igracId, prijavitelj.id),
        )).limit(1);
        if (!sudionik) throw new GreskaPrijave(403, 'Samo sudionici partije mogu prijaviti igrača.');

        const [prijavljeni] = await tx.select({
          igracId: sudioniciPartije.igracId,
          upravljac: igraci.upravljac,
        }).from(sudioniciPartije)
          .innerJoin(igraci, eq(igraci.id, sudioniciPartije.igracId))
          .where(and(
            eq(sudioniciPartije.partijaId, rezultat.data.partijaId),
            eq(sudioniciPartije.igracId, rezultat.data.prijavljeniIgracId),
          )).limit(1);
        if (!prijavljeni) throw new GreskaPrijave(404, 'Igrač nije sudjelovao u toj partiji.');
        if (prijavljeni.upravljac === 'bot') throw new GreskaPrijave(400, 'Računalnog protivnika nije moguće prijaviti.');

        await tx.insert(prijaveIgraca).values({
          partijaId: rezultat.data.partijaId,
          prijaviteljId: prijavitelj.id,
          prijavljeniIgracId: rezultat.data.prijavljeniIgracId,
          razlog: rezultat.data.razlog,
          poruka: rezultat.data.poruka || 'Igrač prijavljen na provjeru.',
        });
      });
    } catch (greska) {
      if (greska instanceof GreskaPrijave) return odgovor.code(greska.status).send({ ok: false, greska: greska.message });
      if (jeJedinstvenostPrekrsena(greska)) {
        return odgovor.code(409).send({ ok: false, greska: 'Ovog si igrača već prijavio/la za tu partiju.' });
      }
      throw greska;
    }
    return { ok: true, poruka: 'Igrač je prijavljen.' };
  });
}
